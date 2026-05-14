# POSCI Frontend

Next.js 15 + Tailwind + shadcn/ui + RainbowKit + WebGPU.
CPU mining via Web Workers, GPU mining via a custom WGSL keccak256 compute shader.

## Quick start

```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local: NEXT_PUBLIC_WC_PROJECT_ID and the three contract addresses

npm run dev
# open http://localhost:3000
```

## Pages

| Route | Purpose |
|---|---|
| `/`        | Hero, feature pillars, live mining stats. |
| `/mine`    | Mining engine UI. CPU + GPU controls, hashrate meter, recent solutions. |
| `/genesis` | Genesis sale widget — progress bar, buy form, what-happens-when-it-fills. |

## Mining engine architecture

```
                                  ┌────────────────┐
                                  │ MiningManager  │ ← React subscribes to (state, hit) events
                                  │ (lib/mining)   │
                                  └────────┬───────┘
                          disjoint ranges  │
              ┌───────────────────────────┼──────────────────────────┐
              ↓                           ↓                          ↓
       ┌────────────┐              ┌────────────┐             ┌────────────┐
       │ CPU Worker │ × N          │ CPU Worker │             │ GPU Miner  │
       │ (js-sha3)  │              │ (js-sha3)  │             │ (WGSL)     │
       └────────────┘              └────────────┘             └────────────┘
```

- **CPU**: each Web Worker runs `js-sha3.keccak_256` in a tight 4096-attempt batch loop, then yields to receive `stop` messages.
- **GPU**: `gpu-miner.ts` uploads a uniform buffer (challenge | miner | target | baseNonce | perThread), dispatches a configurable number of workgroups (each 64 threads × 32 nonces), reads back the `Hits` storage buffer, and verifies hits against `js-sha3` before posting them up.
- **Self-test**: on init, the GPU miner runs a tiny dispatch with a known input and compares the output bit-for-bit against `js-sha3`. If they disagree, GPU mining is disabled and the UI degrades to CPU only.

## Power knobs

| Engine | Knob | Range | Effect |
|---|---|---|---|
| CPU | Workers | 0..min(32, hardwareConcurrency) | Number of parallel JS Web Workers. |
| GPU | Workgroups/dispatch | 1..1024 | Each dispatch tries `workgroups × 64 × 32` nonces. Higher = faster but uses more GPU per frame. |

If the slider goes too high you'll see the page get janky. Drop it back. There's no "GPU TDR safe range" applied; users self-tune.

## Hashrate accounting

Each engine reports cumulative attempts to the manager. The manager samples every 500 ms and applies an EMA (α=0.18). Total hashrate = CPU + GPU.

## WebGPU support matrix

| Browser | OS | Status |
|---|---|---|
| Chrome 113+ | Win/Mac/Linux/Android | ✅ |
| Edge 113+ | Win/Mac | ✅ |
| Safari 17+ | macOS 14+ / iOS 17+ | ✅ (sometimes flag-gated) |
| Firefox | any | ❌ as of 2026-05; CPU only |

The UI auto-detects and shows a warning Alert if WebGPU isn't available; the CPU tab still works everywhere.

## Wallet

`RainbowKitProvider` wraps everything; the `<ConnectButton />` lives in `components/feature/site-nav.tsx`. Get a free WalletConnect (now Reown) project id at https://cloud.reown.com and put it in `.env.local`.

## After deploy: filling in addresses

When you deploy the contracts (see `posci/README.md`), the deploy script prints:

```
POSCIToken:    0x...
POSCIMining:   0x...
POSCIGenesis:  0x...
```

Paste these into `frontend/.env.local`:

```
NEXT_PUBLIC_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_MINING_ADDRESS=0x...
NEXT_PUBLIC_GENESIS_ADDRESS=0x...
```

Restart `npm run dev`. The hero and the `/mine` and `/genesis` pages will start showing live data.

## Build for production

```bash
npm run build
npm run start
# or deploy to Vercel — `vercel --prod`
```

The `next.config.mjs` sets COOP/COEP headers needed for some WebGPU debug paths. They're harmless on Vercel.

## Customizing the look

- Tailwind theme: `tailwind.config.ts` (colors via CSS variables in `app/globals.css`)
- Background animation: `components/feature/orbital-bg.tsx`
- Hero copy: `components/feature/hero.tsx`
- Logo monogram: the gradient square in `site-nav.tsx`

Replace the placeholder logo in `public/posci-logo.svg` (currently a Φ monogram) with whatever you commission. The tokenlist.json in `metadata/` references this same file.

## Known limitations

- **No leaderboard.** Add `useWatchContractEvent` on `MINING_ABI`'s `Mined` event if you want a live miner ranking.
- **No GPU vendor detection.** WebGPU exposes adapter info but I don't currently surface "you're on Intel Iris, expect ~3 MH/s" hints.
- **No mobile-optimized mining UI.** Slider works on touch but the layout assumes ≥ md breakpoint.
- **The CPU worker uses `setTimeout(0)` between batches** to stay interruptible. This caps single-worker hashrate around 60-80kH/s on a modern laptop. For real grinding, GPU is the answer.
