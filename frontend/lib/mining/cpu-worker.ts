/// <reference lib="webworker" />
//
// CPU mining worker. Uses js-sha3 for keccak256 (matches Solidity's keccak256).
// Started by the manager; runs forever in a loop, posting (a) periodic hashrate
// updates and (b) hits when found. Killed by terminate() on the main thread.

import { keccak_256 } from 'js-sha3';

type Hex = `0x${string}`;

interface StartMessage {
  type:        'start';
  challenge:   Hex;
  miner:       Hex;
  target:      string;       // bigint hex
  startNonce:  string;       // bigint hex
  stride:      string;       // increment per attempt (= total worker count)
}

interface StopMessage {
  type: 'stop';
}

type IncomingMessage = StartMessage | StopMessage;

interface HitOutgoing {
  type: 'hit';
  nonce: string;             // bigint hex
  digest: Hex;
}

interface StatsOutgoing {
  type: 'stats';
  attemptsDelta: number;
}

interface ReadyOutgoing {
  type: 'ready';
}

let running = false;

function hexToBytes(h: string): Uint8Array {
  const s = h.startsWith('0x') ? h.slice(2) : h;
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
  return out;
}

function bytesToBigIntBE(b: Uint8Array): bigint {
  let v = 0n;
  for (let i = 0; i < b.length; i++) v = (v << 8n) | BigInt(b[i]);
  return v;
}

function nonceToBytesBE32(n: bigint): Uint8Array {
  const out = new Uint8Array(32);
  let v = n;
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

self.onmessage = (e: MessageEvent<IncomingMessage>) => {
  const msg = e.data;
  if (msg.type === 'stop') {
    running = false;
    return;
  }
  if (msg.type !== 'start') return;

  running = true;
  const challenge  = hexToBytes(msg.challenge);
  const miner      = hexToBytes(msg.miner);
  const target     = BigInt(msg.target);
  const stride     = BigInt(msg.stride);

  let nonce = BigInt(msg.startNonce);
  let attemptsThisBatch = 0;
  const BATCH = 4096;
  const buf = new Uint8Array(84); // 32 + 20 + 32
  buf.set(challenge, 0);
  buf.set(miner, 32);

  const tick = () => {
    if (!running) return;
    for (let i = 0; i < BATCH && running; i++) {
      const nb = nonceToBytesBE32(nonce);
      buf.set(nb, 52);
      const digest = keccak_256.arrayBuffer(buf);
      const view = new Uint8Array(digest);
      const v = bytesToBigIntBE(view);
      if (v <= target) {
        const hex = '0x' + Array.from(view).map(b => b.toString(16).padStart(2, '0')).join('') as Hex;
        const out: HitOutgoing = { type: 'hit', nonce: '0x' + nonce.toString(16), digest: hex };
        (self as unknown as Worker).postMessage(out);
      }
      nonce += stride;
      attemptsThisBatch++;
    }
    const stats: StatsOutgoing = { type: 'stats', attemptsDelta: attemptsThisBatch };
    (self as unknown as Worker).postMessage(stats);
    attemptsThisBatch = 0;
    // Yield to event loop so we can receive 'stop' messages.
    setTimeout(tick, 0);
  };

  const ready: ReadyOutgoing = { type: 'ready' };
  (self as unknown as Worker).postMessage(ready);
  tick();
};

export {};
