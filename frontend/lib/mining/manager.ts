// Mining manager. Owns the CPU worker pool and GPU miner, distributes
// disjoint nonce ranges to each engine, smooths hashrate, and forwards
// hits up to the React layer via a subscriber callback.

'use client';

import type { Address, Hex } from 'viem';
import type { ManagerState, MiningHit, MiningJob, EngineStats, GpuStatus } from './types';
import { createGpuMiner, probeWebGpu, type GpuMiner } from './gpu-miner';

const SMOOTH_ALPHA = 0.18; // EMA factor for hashrate smoothing
const STATS_TICK_MS = 500;

interface ManagerEvents {
  state: (s: ManagerState) => void;
  hit:   (h: MiningHit) => void;
}

export class MiningManager {
  private workers: Worker[] = [];
  private gpu: GpuMiner | null = null;
  private gpuPromise: Promise<GpuMiner | null> | null = null;
  private job: MiningJob | null = null;
  private listeners: Partial<ManagerEvents> = {};

  private cpuAttempts = 0n;
  private gpuAttempts = 0n;
  private cpuLastSampleAt = 0;
  private gpuLastSampleAt = 0;
  private cpuLastSampleAttempts = 0n;
  private gpuLastSampleAttempts = 0n;

  private cpuStats: EngineStats = { source: 'cpu', hashrate: 0, attempts: 0n, active: false };
  private gpuStats: EngineStats = { source: 'gpu', hashrate: 0, attempts: 0n, active: false };

  private cpuWorkerCount = Math.max(1, Math.min(16, navigator?.hardwareConcurrency ?? 4));
  private gpuPower = 64;
  private gpuAvailable = false;
  private gpuStatus: GpuStatus = 'unprobed';
  private gpuError: string | null = null;
  private statsTimer: ReturnType<typeof setInterval> | null = null;

  on<K extends keyof ManagerEvents>(event: K, fn: ManagerEvents[K]) {
    this.listeners[event] = fn;
  }

  setCpuWorkers(n: number) {
    this.cpuWorkerCount = Math.max(0, Math.min(32, Math.floor(n)));
    if (this.job) {
      this.stopCpu();
      this.startCpu();
    }
    this.emitState();
  }

  setGpuPower(p: number) {
    this.gpuPower = Math.max(1, Math.min(1024, Math.floor(p)));
    this.emitState();
  }

  async probeGpu(): Promise<boolean> {
    if (this.gpuAvailable) return true;
    try {
      this.gpuStatus = await probeWebGpu();
      this.gpuAvailable = this.gpuStatus === 'ok';
    } catch (e) {
      console.warn('[posci] probeGpu threw:', e);
      this.gpuStatus = 'error';
      this.gpuAvailable = false;
    }
    this.emitState();
    return this.gpuAvailable;
  }

  getGpuStatus(): GpuStatus {
    return this.gpuStatus;
  }

  getGpuError(): string | null {
    return this.gpuError;
  }

  /**
   * Start mining. Returns a small report so the caller knows whether GPU
   * actually came up, and whether an automatic CPU fallback was used.
   */
  async start(challenge: Hex, miner: Address, target: bigint, useCpu: boolean, useGpu: boolean):
    Promise<{ cpuStarted: boolean; gpuStarted: boolean; gpuFellBackToCpu: boolean }>
  {
    this.stop();
    const startNonce = BigInt(Math.floor(Math.random() * 0xffffffff));
    this.job = { challenge, miner, target, startNonce };

    this.cpuAttempts = 0n;
    this.gpuAttempts = 0n;
    this.cpuLastSampleAt = Date.now();
    this.gpuLastSampleAt = Date.now();
    this.cpuLastSampleAttempts = 0n;
    this.gpuLastSampleAttempts = 0n;
    this.cpuStats = { source: 'cpu', hashrate: 0, attempts: 0n, active: false };
    this.gpuStats = { source: 'gpu', hashrate: 0, attempts: 0n, active: false };

    let gpuStarted = false;
    let gpuFellBackToCpu = false;
    if (useGpu) {
      gpuStarted = await this.startGpu();
      // If the user asked for GPU-only mining but GPU init failed, spin up
      // CPU workers automatically instead of leaving Total at 0 H/s with no
      // indication that anything is wrong. Without this fallback the UI
      // sits there showing "Stop" but mining nothing.
      if (!gpuStarted && !useCpu && this.cpuWorkerCount > 0) {
        useCpu = true;
        gpuFellBackToCpu = true;
      }
    }
    let cpuStarted = false;
    if (useCpu) {
      this.startCpu();
      cpuStarted = this.cpuStats.active;
    }

    this.statsTimer = setInterval(() => this.tickStats(), STATS_TICK_MS);
    this.emitState();
    return { cpuStarted, gpuStarted, gpuFellBackToCpu };
  }

  stop() {
    this.stopCpu();
    this.stopGpu();
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
    this.job = null;
    this.cpuStats.active = false;
    this.gpuStats.active = false;
    this.emitState();
  }

  destroy() {
    this.stop();
    if (this.gpu) this.gpu.destroy();
    this.gpu = null;
  }

  // ---------------- CPU ----------------

  private startCpu() {
    if (!this.job || this.cpuWorkerCount === 0) return;
    const totalEngines = BigInt(this.cpuWorkerCount + 1); // +1 reserved for GPU stride
    for (let i = 0; i < this.cpuWorkerCount; i++) {
      const w = new Worker(new URL('./cpu-worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e) => this.onCpuMessage(e.data);
      w.postMessage({
        type: 'start',
        challenge: this.job.challenge,
        miner: this.job.miner,
        target: '0x' + this.job.target.toString(16),
        startNonce: '0x' + (this.job.startNonce + BigInt(i)).toString(16),
        stride: '0x' + totalEngines.toString(16),
      });
      this.workers.push(w);
    }
    this.cpuStats.active = true;
  }

  private stopCpu() {
    for (const w of this.workers) {
      try { w.postMessage({ type: 'stop' }); } catch {}
      w.terminate();
    }
    this.workers = [];
    this.cpuStats.active = false;
  }

  private onCpuMessage(msg: any) {
    if (msg.type === 'stats') {
      this.cpuAttempts += BigInt(msg.attemptsDelta);
    } else if (msg.type === 'hit') {
      const hit: MiningHit = { nonce: BigInt(msg.nonce), digest: msg.digest, source: 'cpu' };
      this.listeners.hit?.(hit);
    }
  }

  // ---------------- GPU ----------------

  /**
   * Attempt to start the GPU engine. Returns true on success, false if the
   * device/shader could not be initialised (e.g. WGSL self-test mismatch on
   * an integrated GPU). The caller is responsible for falling back to CPU
   * mining when this returns false.
   */
  private async startGpu(): Promise<boolean> {
    if (!this.job) return false;
    if (!this.gpu) {
      // Recreate the promise on every startup. The previous design cached a
      // single rejected promise forever, so a transient failure (driver
      // hiccup, first-time-after-tab-suspend) became permanent for the
      // session. We want every Start click to get a fresh attempt.
      this.gpuPromise = createGpuMiner();
      try {
        this.gpu = await this.gpuPromise;
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        console.warn('[posci] GPU init failed:', msg);
        this.gpuError = msg;
        this.gpuStatus = 'init-failed';
        this.gpuAvailable = false;
        this.emitState();
        return false;
      }
      if (!this.gpu) {
        this.gpuError = 'requestAdapter / requestDevice returned null';
        this.gpuStatus = 'init-failed';
        this.gpuAvailable = false;
        this.emitState();
        return false;
      }
      this.gpuAvailable = true;
      this.gpuError = null;
    }
    const reservedStride = BigInt(this.cpuWorkerCount + 1); // GPU walks at +cpuWorkerCount * GPU dispatch size
    const gpuStartNonce = this.job.startNonce + BigInt(this.cpuWorkerCount); // disjoint from CPU lanes
    this.gpuStats.active = true;

    // Run forever — promise resolves when stop() is called.
    this.gpu.start({
      challenge: this.job.challenge,
      miner: this.job.miner,
      target: this.job.target,
      startNonce: gpuStartNonce * reservedStride, // nudge into a different range
      powerWorkgroups: this.gpuPower,
      onHit: (nonce, digest) => {
        const hit: MiningHit = { nonce, digest, source: 'gpu' };
        this.listeners.hit?.(hit);
      },
      onProgress: (delta) => {
        this.gpuAttempts += BigInt(delta);
      },
    }).catch((e) => {
      console.warn('[posci] GPU mining loop error:', e);
      this.gpuStats.active = false;
      this.emitState();
    });
    return true;
  }

  private stopGpu() {
    if (this.gpu) this.gpu.stop();
    this.gpuStats.active = false;
  }

  // ---------------- stats ----------------

  private tickStats() {
    const now = Date.now();
    // CPU
    {
      const dt = (now - this.cpuLastSampleAt) / 1000;
      const da = Number(this.cpuAttempts - this.cpuLastSampleAttempts);
      const inst = dt > 0 ? da / dt : 0;
      this.cpuStats.hashrate = this.cpuStats.hashrate * (1 - SMOOTH_ALPHA) + inst * SMOOTH_ALPHA;
      this.cpuStats.attempts = this.cpuAttempts;
      this.cpuLastSampleAt = now;
      this.cpuLastSampleAttempts = this.cpuAttempts;
    }
    // GPU
    {
      const dt = (now - this.gpuLastSampleAt) / 1000;
      const da = Number(this.gpuAttempts - this.gpuLastSampleAttempts);
      const inst = dt > 0 ? da / dt : 0;
      this.gpuStats.hashrate = this.gpuStats.hashrate * (1 - SMOOTH_ALPHA) + inst * SMOOTH_ALPHA;
      this.gpuStats.attempts = this.gpuAttempts;
      this.gpuLastSampleAt = now;
      this.gpuLastSampleAttempts = this.gpuAttempts;
    }
    this.emitState();
  }

  private emitState() {
    this.listeners.state?.({
      job: this.job,
      hit: null,
      cpuStats: { ...this.cpuStats },
      gpuStats: { ...this.gpuStats },
      cpuWorkers: this.cpuWorkerCount,
      gpuPower: this.gpuPower,
      gpuAvailable: this.gpuAvailable,
      gpuStatus: this.gpuStatus,
    });
  }
}
