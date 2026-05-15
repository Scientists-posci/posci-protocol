import type { Address, Hex } from 'viem';

export type MinerKind = 'cpu' | 'gpu';

export interface MiningJob {
  challenge:    Hex;        // 0x-prefixed 32-byte hex
  miner:        Address;    // 0x-prefixed 20-byte hex
  target:       bigint;     // uint256 mining target (digest must be ≤ this)
  startNonce:   bigint;     // base offset; each engine gets a disjoint range
}

export interface MiningHit {
  nonce:  bigint;
  digest: Hex;              // 0x-prefixed 32-byte hex
  source: MinerKind;
}

export interface EngineStats {
  source:   MinerKind;
  hashrate: number;         // hashes per second, smoothed
  attempts: bigint;         // cumulative attempts since start
  active:   boolean;
}

export type GpuStatus = 'ok' | 'no-navigator' | 'no-webgpu' | 'no-adapter' | 'error' | 'unprobed';

export interface ManagerState {
  job:       MiningJob | null;
  hit:       MiningHit | null;
  cpuStats:  EngineStats;
  gpuStats:  EngineStats;
  cpuWorkers: number;
  gpuPower:   number;       // 1..1024 workgroups per dispatch
  gpuAvailable: boolean;
  gpuStatus:  GpuStatus;
}
