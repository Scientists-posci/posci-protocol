// WebGPU-based PoW miner. Self-tests against js-sha3 on init; if the shader
// or the device disagrees with the reference even once, GPU mining stays off
// and the UI shows a downgrade warning.

import { keccak_256 } from 'js-sha3';
import { KECCAK256_WGSL } from './keccak256.wgsl';

type Hex = `0x${string}`;

export interface GpuMiner {
  start(args: {
    challenge: Hex;
    miner: Hex;
    target: bigint;
    startNonce: bigint;
    powerWorkgroups: number;             // 1..1024
    onHit: (nonce: bigint, digest: Hex) => void;
    onProgress: (attemptsDelta: number) => void;
  }): Promise<void>;
  stop(): void;
  destroy(): void;
}

const WORKGROUP_SIZE = 64;
const PER_THREAD = 32;

function hexToU8(h: string): Uint8Array {
  const s = h.startsWith('0x') ? h.slice(2) : h;
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
  return out;
}

function u8ToHex(b: Uint8Array): Hex {
  let s = '0x';
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, '0');
  return s as Hex;
}

function bigIntTo32BE(v: bigint): Uint8Array {
  const out = new Uint8Array(32);
  let n = v;
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return out;
}

function bytesToBigIntBE(b: Uint8Array): bigint {
  let v = 0n;
  for (let i = 0; i < b.length; i++) v = (v << 8n) | BigInt(b[i]);
  return v;
}

/**
 * Pack a buffer of bytes into a Uint32Array of N "limbs" using LITTLE-ENDIAN
 * 4-byte chunks. Pads with zeros to N * 4 bytes.
 */
function packLE(bytes: Uint8Array, limbs: number): Uint32Array {
  const out = new Uint32Array(limbs);
  for (let i = 0; i < limbs; i++) {
    const o = i * 4;
    out[i] =
      (bytes[o]     ?? 0)        |
      ((bytes[o + 1] ?? 0) << 8) |
      ((bytes[o + 2] ?? 0) << 16) |
      ((bytes[o + 3] ?? 0) << 24);
  }
  return out;
}

/**
 * Pack a 32-byte big-endian number into 8 BE u32 limbs (MSB first).
 */
function packBE(bytes: Uint8Array): Uint32Array {
  const out = new Uint32Array(8);
  for (let i = 0; i < 8; i++) {
    const o = i * 4;
    out[i] =
      ((bytes[o]     ?? 0) << 24) |
      ((bytes[o + 1] ?? 0) << 16) |
      ((bytes[o + 2] ?? 0) << 8)  |
       (bytes[o + 3] ?? 0);
  }
  return out;
}

import type { GpuStatus } from './types';

/** Outcome of a WebGPU probe — kept narrow so the UI can show targeted advice.
 *  Excludes lifecycle states that the probe itself can't produce
 *  ('unprobed' = before probe, 'init-failed' = after a failed startGpu). */
export type WebGpuStatus = Exclude<GpuStatus, 'unprobed' | 'init-failed'>;

export async function probeWebGpu(): Promise<WebGpuStatus> {
  if (typeof navigator === 'undefined') return 'no-navigator';
  if (!('gpu' in navigator)) return 'no-webgpu';
  try {
    // Permissive probe: no powerPreference. Requesting 'high-performance'
    // can return null on machines with only integrated graphics.
    const adapter = await (navigator as any).gpu.requestAdapter();
    return adapter ? 'ok' : 'no-adapter';
  } catch (e) {
    console.warn('[posci] WebGPU probe threw:', e);
    return 'error';
  }
}

export async function isWebGpuSupported(): Promise<boolean> {
  return (await probeWebGpu()) === 'ok';
}

export async function createGpuMiner(): Promise<GpuMiner | null> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) return null;
  const gpu = (navigator as any).gpu as GPU;
  // Prefer the discrete GPU on hybrid-graphics laptops, but fall back to
  // the default adapter if 'high-performance' returns null (e.g. integrated
  // graphics only).
  let adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) adapter = await gpu.requestAdapter();
  if (!adapter) return null;

  const device = await adapter.requestDevice();
  if (!device) return null;

  const module = device.createShaderModule({ code: KECCAK256_WGSL });
  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module, entryPoint: 'main' },
  });

  // Buffers
  // Params layout (std140-ish, vec4 aligned):
  //   vec4 challenge[2]   = 32 B
  //   vec4 miner[2]       = 32 B (only first 5 limbs meaningful)
  //   vec4 target[2]      = 32 B
  //   vec2 baseNonce + u32 perThread + u32 _pad = 16 B
  // total = 112 B, aligned to 16
  const PARAMS_BYTES = 32 + 32 + 32 + 16;
  const paramsBuffer = device.createBuffer({
    size: PARAMS_BYTES,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // Hits: count(u32) + 3*u32 padding + 16 entries * (8 u32 = 32 B header + 32 B digest = 64 B)
  // Each Hit struct = 64 B (4 u32 header + 8 u32 digest)
  const HIT_SIZE = 64;
  const HITS_BYTES = 16 + 16 * HIT_SIZE;
  const hitsBuffer = device.createBuffer({
    size: HITS_BYTES,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  const readBuffer = device.createBuffer({
    size: HITS_BYTES,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: paramsBuffer } },
      { binding: 1, resource: { buffer: hitsBuffer } },
    ],
  });

  // ---- self-test: hash a known input and verify against js-sha3 ----
  // Using max-target so any digest passes; the kernel will then write a hit
  // we can compare bit-for-bit.
  {
    const testChallenge = new Uint8Array(32).fill(0xab);
    const testMiner = new Uint8Array(20).fill(0xcd);
    const target = (1n << 256n) - 1n; // accept everything
    const baseNonce = 0n;

    writeParams(device, paramsBuffer, testChallenge, testMiner, target, baseNonce, 1);
    device.queue.writeBuffer(hitsBuffer, 0, new Uint32Array([0, 0, 0, 0]));

    const enc = device.createCommandEncoder();
    const pass = enc.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(1);
    pass.end();
    enc.copyBufferToBuffer(hitsBuffer, 0, readBuffer, 0, HITS_BYTES);
    device.queue.submit([enc.finish()]);

    await readBuffer.mapAsync(GPUMapMode.READ);
    const arr = new Uint32Array(readBuffer.getMappedRange().slice(0));
    readBuffer.unmap();

    const count = arr[0];
    if (count === 0) throw new Error('GPU self-test produced no hit');

    // First hit is at byte offset 16
    const firstDigest = new Uint8Array(32);
    for (let i = 0; i < 8; i++) {
      const w = arr[4 + 4 + i]; // 4 (header) + 4 (Hit header) + i
      firstDigest[i * 4]     = (w >>> 24) & 0xff;
      firstDigest[i * 4 + 1] = (w >>> 16) & 0xff;
      firstDigest[i * 4 + 2] = (w >>> 8)  & 0xff;
      firstDigest[i * 4 + 3] =  w         & 0xff;
    }
    const nonce = BigInt(arr[4]); // first hit's nonceLo, hi=0 for tiny test
    const refInput = new Uint8Array(84);
    refInput.set(testChallenge, 0);
    refInput.set(testMiner, 32);
    refInput.set(bigIntTo32BE(nonce), 52);
    const refDigest = new Uint8Array(keccak_256.arrayBuffer(refInput));
    for (let i = 0; i < 32; i++) {
      if (firstDigest[i] !== refDigest[i]) {
        throw new Error(`GPU self-test mismatch at byte ${i}: gpu=${firstDigest[i].toString(16)} ref=${refDigest[i].toString(16)}`);
      }
    }
  }

  let running = false;

  return {
    async start(args) {
      const challengeBytes = hexToU8(args.challenge);
      const minerBytes     = hexToU8(args.miner);
      const targetBytes    = bigIntTo32BE(args.target);

      let nonce = args.startNonce;
      running = true;

      while (running) {
        const workgroups = Math.max(1, Math.min(1024, Math.floor(args.powerWorkgroups)));
        writeParams(device, paramsBuffer, challengeBytes, minerBytes, args.target, nonce, PER_THREAD);
        device.queue.writeBuffer(hitsBuffer, 0, new Uint32Array([0, 0, 0, 0]));

        const enc = device.createCommandEncoder();
        const pass = enc.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(workgroups);
        pass.end();
        enc.copyBufferToBuffer(hitsBuffer, 0, readBuffer, 0, HITS_BYTES);
        device.queue.submit([enc.finish()]);

        await readBuffer.mapAsync(GPUMapMode.READ);
        const arr = new Uint32Array(readBuffer.getMappedRange().slice(0));
        readBuffer.unmap();

        const count = Math.min(arr[0], 16);
        for (let i = 0; i < count; i++) {
          const off = 4 + i * 16; // 4 header u32, then per-hit 16 u32 = 64 B
          const lo = arr[off];
          const hi = arr[off + 1];
          const n = (BigInt(hi) << 32n) | BigInt(lo);
          const dBytes = new Uint8Array(32);
          for (let k = 0; k < 8; k++) {
            const w = arr[off + 4 + k];
            dBytes[k * 4]     = (w >>> 24) & 0xff;
            dBytes[k * 4 + 1] = (w >>> 16) & 0xff;
            dBytes[k * 4 + 2] = (w >>> 8)  & 0xff;
            dBytes[k * 4 + 3] =  w         & 0xff;
          }
          // Defense in depth: verify on CPU before reporting to chain.
          const ref = new Uint8Array(84);
          ref.set(challengeBytes, 0);
          ref.set(minerBytes, 32);
          ref.set(bigIntTo32BE(n), 52);
          const refDigest = new Uint8Array(keccak_256.arrayBuffer(ref));
          let ok = true;
          for (let k = 0; k < 32; k++) {
            if (refDigest[k] !== dBytes[k]) { ok = false; break; }
          }
          if (ok && bytesToBigIntBE(refDigest) <= args.target) {
            args.onHit(n, u8ToHex(refDigest));
          }
        }

        const tried = BigInt(workgroups) * BigInt(WORKGROUP_SIZE) * BigInt(PER_THREAD);
        nonce += tried;
        args.onProgress(Number(tried));
      }
    },
    stop() {
      running = false;
    },
    destroy() {
      running = false;
      paramsBuffer.destroy();
      hitsBuffer.destroy();
      readBuffer.destroy();
    },
  };
}

function writeParams(
  device: GPUDevice,
  buf: GPUBuffer,
  challenge: Uint8Array,
  miner: Uint8Array,
  target: bigint,
  baseNonce: bigint,
  perThread: number,
) {
  const data = new ArrayBuffer(112);
  const u32 = new Uint32Array(data);
  // challenge: 8 LE u32 limbs into vec4[2]
  const c = packLE(challenge, 8);
  for (let i = 0; i < 8; i++) u32[i] = c[i];
  // miner: 5 LE u32 limbs into vec4[2] (last 3 ignored)
  const m = packLE(miner, 8);            // pad with zeros, only first 5 are read
  for (let i = 0; i < 8; i++) u32[8 + i] = m[i];
  // target: 8 BE u32 limbs into vec4[2]
  const t = packBE(bigIntTo32BE(target));
  for (let i = 0; i < 8; i++) u32[16 + i] = t[i];
  // baseNonce.lo, baseNonce.hi, perThread, _pad
  const nLo = Number(baseNonce & 0xffffffffn);
  const nHi = Number((baseNonce >> 32n) & 0xffffffffn);
  u32[24] = nLo;
  u32[25] = nHi;
  u32[26] = perThread;
  u32[27] = 0;
  device.queue.writeBuffer(buf, 0, data);
}

// Minimal WebGPU type stubs in case @types/wicg-webgpu isn't installed.
declare const GPUBufferUsage: { UNIFORM: number; STORAGE: number; COPY_SRC: number; COPY_DST: number; MAP_READ: number };
declare const GPUMapMode: { READ: number };
type GPU = any;
type GPUDevice = any;
type GPUBuffer = any;
