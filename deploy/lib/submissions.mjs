// Builds submission packages for Trust Wallet / CoinGecko / CoinMarketCap /
// Etherscan / Uniswap default list — all populated with the actual deployed
// token address, and accompanied by a clear instruction file.

import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getAddress } from 'viem';
import {
  buildTrustWalletInfo, buildTpWalletInfo, buildImTokenInfo, buildEthereumListsInfo,
} from './github-pr.mjs';

/**
 * Write all submission artifacts to `outDir`. Returns a map { filename: path }
 * plus a checklist of which platforms still need a manual web-form step.
 */
export function buildSubmissions({
  outDir,
  tokenAddress, miningAddress, genesisAddress,
  project, chain,
}) {
  mkdirSync(outDir, { recursive: true });

  const checksummed = getAddress(tokenAddress);
  const explorerHost = chain.id === 1 ? 'etherscan.io' : 'sepolia.etherscan.io';
  const explorer = `https://${explorerHost}/token/${checksummed}`;

  const out = {};

  // ── Trust Wallet info.json (also drives MetaMask via the same repo) ──
  const twPath = resolve(outDir, 'trustwallet-info.json');
  writeFileSync(twPath, JSON.stringify(
    buildTrustWalletInfo({ project, tokenAddress, chain }), null, 2) + '\n');
  out.trustwallet_info = twPath;

  // ── TokenPocket info.json ──
  const tpPath = resolve(outDir, 'tpwallet-info.json');
  writeFileSync(tpPath, JSON.stringify(
    buildTpWalletInfo({ project, tokenAddress, chain }), null, 2) + '\n');
  out.tpwallet_info = tpPath;

  // ── imToken token-profile json ──
  const imPath = resolve(outDir, 'imtoken-info.json');
  writeFileSync(imPath, JSON.stringify(
    buildImTokenInfo({ project, tokenAddress, chain }), null, 2) + '\n');
  out.imtoken_info = imPath;

  // ── ethereum-lists/tokens json (MEW · MyCrypto · Trezor) ──
  const elPath = resolve(outDir, 'ethereum-lists-info.json');
  writeFileSync(elPath, JSON.stringify(
    buildEthereumListsInfo({ project, tokenAddress }), null, 2) + '\n');
  out.ethereum_lists_info = elPath;

  // ── Uniswap token list ──
  const tokenList = {
    name: `${project.symbol} Token List`,
    timestamp: new Date().toISOString(),
    version: { major: 1, minor: 0, patch: 0 },
    keywords: project.tags ?? [],
    logoURI: `${project.website.replace(/\/$/, '')}/posci-logo-256.png`,
    tokens: [{
      chainId: chain.id,
      address: checksummed,
      symbol:  project.symbol,
      name:    project.name,
      decimals: project.decimals,
      logoURI: `${project.website.replace(/\/$/, '')}/posci-logo-256.png`,
      tags:    project.tags ?? [],
      extensions: {
        website:     project.website,
        twitter:     project.twitter,
        github:      project.github || undefined,
        description: project.description,
      },
    }],
  };
  const tlPath = resolve(outDir, 'tokenlist.json');
  writeFileSync(tlPath, JSON.stringify(tokenList, null, 2) + '\n');
  out.uniswap_tokenlist = tlPath;

  // ── Etherscan token-info package (for the in-browser form) ──
  const ethInfo = `# Etherscan token info — paste these into the form

> URL to open: ${explorer}
>   1. Sign in with the deployer wallet (the same one that deployed the contract)
>   2. Click "More" → "Update Token Info"
>   3. Sign the EIP-712 challenge
>   4. Paste the fields below

## Fields

| Field         | Value |
|---------------|-------|
| Name          | ${project.name}
| Symbol        | ${project.symbol}
| Decimals      | ${project.decimals}
| Description   | ${project.description.replace(/\s+/g, ' ').trim()}
| Website       | ${project.website}
| Twitter / X   | ${project.twitter}
${project.telegram ? `| Telegram      | ${project.telegram}` : ''}
${project.discord  ? `| Discord       | ${project.discord}`  : ''}
${project.github   ? `| GitHub        | ${project.github}`   : ''}

## Logo upload

Upload \`assets/posci-logo-256.png\` (under 100 KB, PNG, transparent or solid).
`;
  const ePath = resolve(outDir, 'etherscan-form.md');
  writeFileSync(ePath, ethInfo);
  out.etherscan_form = ePath;

  // ── CoinGecko form ──
  const cgForm = `# CoinGecko submission

> Form URL: https://www.coingecko.com/en/coins/new
> Review SLA: 5-15 business days

## Required fields

| Field               | Value |
|---------------------|-------|
| Contract address    | ${checksummed}
| Chain               | Ethereum (mainnet)
| Project name        | ${project.name}
| Symbol              | ${project.symbol}
| Decimals            | ${project.decimals}
| Description         | ${project.description}
| Website             | ${project.website}
| Twitter             | ${project.twitter}
${project.telegram ? `| Telegram            | ${project.telegram}` : ''}
${project.discord  ? `| Discord             | ${project.discord}`  : ''}
${project.github   ? `| Source code         | ${project.github}`   : ''}
| Block explorer      | ${explorer}
| Markets             | https://app.uniswap.org/#/swap?outputCurrency=${checksummed}&chain=ethereum
| Logo (256×256)      | upload assets/posci-logo-256.png

## Listing reasoning (paste into "Additional info")

${project.name} (${project.symbol}) is a fixed-supply fair-launch PoW token.
- Total supply: 21,000,000 (no team unlock, no mint after deploy)
- 95.24% distributed via on-chain PoW mining (EIP-918 style, anti-MEV by msg.sender binding)
- Initial LP burned to 0xdEaD on launch
- Contract has no owner, no admin keys, no upgrade proxy
- Verified source on Etherscan
- Mining contract: ${miningAddress}
- Genesis contract: ${genesisAddress}
`;
  const cgPath = resolve(outDir, 'coingecko-form.md');
  writeFileSync(cgPath, cgForm);
  out.coingecko_form = cgPath;

  // ── CoinMarketCap form (almost identical fields) ──
  const cmcForm = cgForm
    .replace('# CoinGecko submission', '# CoinMarketCap submission')
    .replace('https://www.coingecko.com/en/coins/new', 'https://coinmarketcap.com/request/')
    .replace('5-15 business days', '1-3 weeks');
  const cmcPath = resolve(outDir, 'coinmarketcap-form.md');
  writeFileSync(cmcPath, cmcForm);
  out.coinmarketcap_form = cmcPath;

  // ── Master checklist ──
  const checklist = `# POSCI launch — submission checklist

Generated ${new Date().toISOString()} for token at:
  ${checksummed}  (${chain.name})
  ${explorer}

Companion contracts:
  Mining   : ${miningAddress}
  Genesis  : ${genesisAddress}

---

## ✓ Already done by the orchestrator
- [x] Contracts deployed + verified on ${explorerHost}
- [x] Logo PNGs at 32 / 64 / 128 / 256 / 512 / 1024 px + master SVG
- [x] Submission templates pre-filled (this folder)
- [x] Auto-PR opened for 5 wallet/list repos (if \`config.github.token\` set):
      Trust Wallet · TokenPocket · imToken · ethereum-lists · MetaMask

## ☐ Manual web-form steps (NO API — must be clicked through)

### 1. Etherscan token info  ⭐ MOST IMPORTANT — wallets pull from here
File: \`etherscan-form.md\`
Open: ${explorer}
Use the deployer wallet to sign the EIP-712 challenge.

### 2. Coinbase Wallet (Base App)  ⭐ has huge mobile reach
URL: https://wallet.coinbase.com → search ${checksummed} → "Update here"
Sign with deployer wallet, upload logo, ≤5 business days to approve.
Alt: on-chain EAS attestation — see https://docs.base.org/base-chain/tools/tokens-in-wallet

### 3. CoinGecko
File: \`coingecko-form.md\`
Form: https://www.coingecko.com/en/coins/new

### 4. CoinMarketCap
File: \`coinmarketcap-form.md\`
Form: https://coinmarketcap.com/request/

### 5. DexScreener / DexTools logo  (AFTER V4 pool fills)
Once \`POSCIGenesis.bootstrapped()\` is true and the V4 pool has trades:
- DexScreener "Update token info" — ~$300 one-time, requires deployer wallet
- DexTools "Update Logo & Social Links" — ~$50-100, requires deployer wallet
These dramatically improve trader-side visibility.

## ☐ Free GitHub-PR repos (auto-handled if \`config.github.token\` set)

| Platform | Repo | Auto? | Downstream impact |
|---|---|---|---|
| Trust Wallet | trustwallet/assets | ✅ | Trust + many DEX aggregators |
| TokenPocket | TP-Lab/tokens | ✅ | TP Wallet (huge Asia reach) |
| imToken | consenlabs/token-profile | ✅ | imToken (huge Asia reach) |
| ethereum-lists | ethereum-lists/tokens | ✅ | MEW + MyCrypto + **Trezor** (hardware) |
| MetaMask | MetaMask/contract-metadata | ✅ | MetaMask native recognition |

To enable auto-PR: create a GitHub PAT at https://github.com/settings/tokens?type=beta
(scope: \`public_repo\`), put it in \`config.github.token\` + your username, re-run.

## ☐ Optional: Uniswap default token list (low success rate)
File: \`tokenlist.json\`
Fork: https://github.com/Uniswap/default-token-list
Open a PR. Realistically only merges after the token has marketcap.

## Auto-pulled — NO ACTION REQUIRED

These wallets/sites pull metadata from upstream sources (mostly Etherscan + indexers + Trust Wallet repo). Once steps 1 + 2 + the Trust Wallet PR are done, they'll auto-pick up POSCI:

- **OKX Wallet** — reads Etherscan verified profile + DEX indexers
- **Bitget Wallet** (formerly BitKeep) — same
- **Rainbow Wallet** — uses ethereum-lists + their own list
- **GeckoTerminal** — auto-indexes the V4 pool
- Various other consumer wallets that depend on these upstream sources
`;
  const clPath = resolve(outDir, 'CHECKLIST.md');
  writeFileSync(clPath, checklist);
  out.checklist = clPath;

  return out;
}
