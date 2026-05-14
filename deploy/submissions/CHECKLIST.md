# POSCI launch — submission checklist

Generated 2026-05-13T01:18:54.940Z for token at:
  0xD020e5E5c2724B2661C2FEF9AE878f49410a8B77  (mainnet)
  https://etherscan.io/token/0xD020e5E5c2724B2661C2FEF9AE878f49410a8B77

Companion contracts:
  Mining   : 0x9EAdD7dF7701e03d07c3727EC1ba816C2C9De936
  Genesis  : 0x7bC1520Da49Cd56D5BE11aA77650cA998951459d

---

## ✓ Already done by the orchestrator
- [x] Contracts deployed + verified on etherscan.io
- [x] Logo PNGs at 32 / 64 / 128 / 256 / 512 / 1024 px + master SVG
- [x] Submission templates pre-filled (this folder)
- [x] Auto-PR opened for 5 wallet/list repos (if `config.github.token` set):
      Trust Wallet · TokenPocket · imToken · ethereum-lists · MetaMask

## ☐ Manual web-form steps (NO API — must be clicked through)

### 1. Etherscan token info  ⭐ MOST IMPORTANT — wallets pull from here
File: `etherscan-form.md`
Open: https://etherscan.io/token/0xD020e5E5c2724B2661C2FEF9AE878f49410a8B77
Use the deployer wallet to sign the EIP-712 challenge.

### 2. Coinbase Wallet (Base App)  ⭐ has huge mobile reach
URL: https://wallet.coinbase.com → search 0xD020e5E5c2724B2661C2FEF9AE878f49410a8B77 → "Update here"
Sign with deployer wallet, upload logo, ≤5 business days to approve.
Alt: on-chain EAS attestation — see https://docs.base.org/base-chain/tools/tokens-in-wallet

### 3. CoinGecko
File: `coingecko-form.md`
Form: https://www.coingecko.com/en/coins/new

### 4. CoinMarketCap
File: `coinmarketcap-form.md`
Form: https://coinmarketcap.com/request/

### 5. DexScreener / DexTools logo  (AFTER V4 pool fills)
Once `POSCIGenesis.bootstrapped()` is true and the V4 pool has trades:
- DexScreener "Update token info" — ~$300 one-time, requires deployer wallet
- DexTools "Update Logo & Social Links" — ~$50-100, requires deployer wallet
These dramatically improve trader-side visibility.

## ☐ Free GitHub-PR repos (auto-handled if `config.github.token` set)

| Platform | Repo | Auto? | Downstream impact |
|---|---|---|---|
| Trust Wallet | trustwallet/assets | ✅ | Trust + many DEX aggregators |
| TokenPocket | TP-Lab/tokens | ✅ | TP Wallet (huge Asia reach) |
| imToken | consenlabs/token-profile | ✅ | imToken (huge Asia reach) |
| ethereum-lists | ethereum-lists/tokens | ✅ | MEW + MyCrypto + **Trezor** (hardware) |
| MetaMask | MetaMask/contract-metadata | ✅ | MetaMask native recognition |

To enable auto-PR: create a GitHub PAT at https://github.com/settings/tokens?type=beta
(scope: `public_repo`), put it in `config.github.token` + your username, re-run.

## ☐ Optional: Uniswap default token list (low success rate)
File: `tokenlist.json`
Fork: https://github.com/Uniswap/default-token-list
Open a PR. Realistically only merges after the token has marketcap.

## Auto-pulled — NO ACTION REQUIRED

These wallets/sites pull metadata from upstream sources (mostly Etherscan + indexers + Trust Wallet repo). Once steps 1 + 2 + the Trust Wallet PR are done, they'll auto-pick up POSCI:

- **OKX Wallet** — reads Etherscan verified profile + DEX indexers
- **Bitget Wallet** (formerly BitKeep) — same
- **Rainbow Wallet** — uses ethereum-lists + their own list
- **GeckoTerminal** — auto-indexes the V4 pool
- Various other consumer wallets that depend on these upstream sources
