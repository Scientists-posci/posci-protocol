# POSCI deploy orchestrator

> One config file → deploy + verify + logo + submission packages all in a single
> `node deploy.mjs`. Designed so you don't have to remember anything.

## What it does

| # | Step | Auto? |
|---|---|---|
| 1 | Pre-flight: balance, gas, RPC, V4 sanity | ✅ |
| 2 | `forge script` deploy + on-chain verify | ✅ |
| 3 | Parse broadcast artifact → save addresses to `.state.json` | ✅ |
| 4 | Render token logo to PNG (32 / 64 / 128 / 256 / 512 / 1024) | ✅ |
| 5 | Generate per-platform submission templates with addresses pre-filled | ✅ |
| 5b | Trust Wallet `assets` repo PR via GitHub API | ✅ (if token set) |
| 6 | Print checklist with click-through URLs for the manual platforms | ✅ |

**What still requires you to click in a browser** (no API exists):
- Etherscan "Update Token Info" (requires deployer wallet EIP-712 signature)
- CoinGecko / CoinMarketCap submission forms
- DexScreener / DexTools (post-pool, optional)

For each of these, the orchestrator hands you a markdown file with all fields
pre-filled — copy-paste, sign, done.

## Setup

```bash
cd deploy
npm install                      # only viem; ~5 MB
cp config.example.js config.js
$EDITOR config.js                # fill in keys
```

Get a fresh deployer key with:

```bash
"C:/Users/18884/.foundry/bin/cast" wallet new
```

**Never** reuse a key that has appeared in any chat / screenshot / repo.
Save the address + private key in a password manager. Send the deploy budget
(~0.02 ETH at current gas) to the new address.

## Run

```bash
# Just the pre-flight (no broadcast):
npm run preflight

# The whole thing:
npm run deploy
```

The orchestrator will:
1. Show you balance, gas, V4 status, etc.
2. Ask `Proceed with mainnet broadcast? (y/N)` once
3. Spawn `forge script ... --broadcast --verify` and stream output
4. Generate everything else without further prompts

If something fails partway, just re-run — `.state.json` tracks progress and
the orchestrator skips completed phases.

## Files it produces

```
deploy/
├── .state.json                   # progress tracker (git-ignored)
├── assets/generated/
│   ├── posci-logo.svg            # vector original copy
│   ├── posci-logo-32.png         # favicon size
│   ├── posci-logo-64.png
│   ├── posci-logo-128.png
│   ├── posci-logo-256.png        # ← upload this to Trust Wallet / Etherscan
│   ├── posci-logo-512.png
│   └── posci-logo-1024.png       # high-res for marketing
└── submissions/
    ├── CHECKLIST.md              # ← read this first, your master to-do
    ├── trustwallet-info.json     # auto-PR'd if github token set
    ├── tokenlist.json            # for Uniswap default-token-list PR
    ├── etherscan-form.md         # paste into Etherscan
    ├── coingecko-form.md
    └── coinmarketcap-form.md
```

## Safety rails

The orchestrator refuses to start if:
- `config.deployerPrivateKey` is missing or still the placeholder
- `config.etherscanApiKey` is missing
- The deployer balance is below `config.safety.minBalanceEth`
- Current gas price exceeds `config.safety.maxGasPriceGwei` (default 80)
- Any of the V4 contract addresses don't have bytecode on the target chain

These are deliberate — better to abort than to half-deploy.

## Flags

```bash
node deploy.mjs --preflight-only       # show stats, do nothing
node deploy.mjs --post-deploy-only     # already deployed; just regenerate logos + packages
node deploy.mjs --skip-confirm         # skip the Y/N prompt (CI use)
node deploy.mjs --no-trustwallet-pr    # skip the GitHub PR even if creds present
```

## Re-runs / recovery

`.state.json` records:
- which phase succeeded
- the three deployed contract addresses
- any URLs returned by sub-services (e.g., the Trust Wallet PR url)

A second `node deploy.mjs` is safe — it'll detect what's done and only do what's
left. To start over from scratch, delete `.state.json`.

## Trust Wallet auto-PR — what gets pushed

When `config.github.token` and `config.github.username` are set:

1. Forks https://github.com/trustwallet/assets to `<your-user>/assets`
2. Creates branch `posci-<addr-prefix>` off `master`
3. Commits two files:
   - `blockchains/ethereum/assets/<CHECKSUMMED_ADDR>/info.json`
   - `blockchains/ethereum/assets/<CHECKSUMMED_ADDR>/logo.png` (256×256)
4. Opens a PR upstream titled `Add POSCI — Proof of Scientist (0x…)`

The PR url is printed and saved to `.state.json`. Trust Wallet usually merges
within 1–2 weeks if the info passes their automated linter.

## When you should NOT run this

- You haven't done a Sepolia rehearsal yet. The contracts pass tests, but
  V4 Sepolia + V4 Mainnet behave the same — proving end-to-end on Sepolia
  costs nothing and catches surprises.
- Gas is over 30 gwei. Wait it out.
- You haven't set `config.project.website` to a working URL. Token lists and
  Trust Wallet's linter check that the site responds.
