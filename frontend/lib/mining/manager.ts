// Mining manager. Owns the CPU worker pool and GPU miner, distributes
// disjoint nonce ranges to each engine, smooths hashrate, and forwards
// hits up to the React layer via a subscriber callback.

'use client';

import type { Address, Hex } from 'viem';
import type { ManagerState, MiningHit, MiningJob, EngineStats } from './types';
import { createGpuMiner, isWebGpuSupported, type GpuMiner } from './gpu-miner';

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
      this.gpuAvailable = await isWebGpuSupported();
    } catch {
      this.gpuAvailable = false;
    }
    this.emitState();
    return this.gpuAvailable;
  }

  async start(challenge: Hex, miner: Address, target: bigint, useCpu: boolean, useGpu: boolean) {
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

    if (useCpu) this.startCpu();
    if (useGpu) await this.startGpu();

    this.statsTimer = setInterval(() => this.tickStats(), STATS_TICK_MS);
    this.emitState();
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

  private async startGpu() {
    if (!this.job) return;
    if (!this.gpu) {
      if (!this.gpuPromise) this.gpuPromise = createGpuMiner();
      try {
        this.gpu = await this.gpuPromise;
      } catch (e) {
        console.warn('GPU init failed:', e);
        this.gpuAvailable = false;
        this.emitState();
        return;
      }
      if (!this.gpu) {
        this.gpuAvailable = false;
        this.emitState();
        return;
      }
      this.gpuAvailable = true;
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
      console.warn('GPU mining error:', e);
      this.gpuStats.active = false;
      this.emitState();
    });
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
    });
  }
}
