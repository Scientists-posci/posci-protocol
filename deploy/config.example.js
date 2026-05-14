// =============================================================================
//  POSCI deploy config
// =============================================================================
//  1. Copy this file to `config.js` (which is git-ignored)
//  2. Fill in everything below
//  3. Run `npm install && node deploy.mjs`
//
//  Anything tagged REQUIRED must be set or the orchestrator refuses to start.
//  Anything tagged OPTIONAL gracefully skips that capability.
// =============================================================================

export default {
  // -------------------------------------------------------------------------
  // CHAIN — pick one network. Default mainnet. Use 'sepolia' to rehearse.
  // -------------------------------------------------------------------------
  network: 'mainnet',                 // 'mainnet' | 'sepolia'

  // -------------------------------------------------------------------------
  // KEYS — REQUIRED. Generate a fresh deployer with `cast wallet new`.
  //        NEVER reuse a key that has appeared in any chat / screenshot / repo.
  //        This file is git-ignored, but treat it like cash.
  // -------------------------------------------------------------------------
  deployerPrivateKey: '0xPASTE_FRESH_PRIVATE_KEY_HERE',

  // -------------------------------------------------------------------------
  // RPC — REQUIRED. Free tier from Alchemy / Infura / QuickNode.
  //        For mainnet: e.g. https://eth-mainnet.g.alchemy.com/v2/<key>
  //        For sepolia: e.g. https://eth-sepolia.g.alchemy.com/v2/<key>
  //        Public fallbacks (rate-limited) used if blank.
  // -------------------------------------------------------------------------
  rpcUrl: '',

  // -------------------------------------------------------------------------
  // ETHERSCAN — REQUIRED for source verification (free at etherscan.io/apis).
  //             v2 unified key works for mainnet + sepolia.
  // -------------------------------------------------------------------------
  etherscanApiKey: '',

  // -------------------------------------------------------------------------
  // MINING TIME GATE — hours after deploy until mining unlocks (gate 1).
  //                    Default 24h. Lower values look suspicious.
  // -------------------------------------------------------------------------
  miningStartDelayHours: 24,

  // -------------------------------------------------------------------------
  // PROJECT METADATA — populates Trust Wallet info.json, OG, lists, etc.
  // -------------------------------------------------------------------------
  project: {
    name:        'Proof of Scientist',
    symbol:      'POSCI',
    decimals:    18,
    website:     'https://YOUR-DOMAIN.com',
    twitter:     'https://x.com/scientistsdapp',
    telegram:    '',
    discord:     '',
    github:      '',
    explorerUrl: '',                 // auto-filled after deploy
    description:
      'Proof of Scientist (POSCI) is a 21,000,000 fixed-supply, owner-less, ' +
      'PoW-mined ERC20 on Ethereum mainnet. 95% of supply is mined, not sold. ' +
      'The hash includes msg.sender so a copied nonce is worthless to anyone ' +
      'else — there is no MEV surface to exploit. The genesis sale fills a ' +
      '0.5 ETH cap and atomically initializes a Uniswap V4 pool with the ' +
      'liquidity NFT permanently burned to 0x000…dEaD.',
    tags: ['pow', 'mining', 'fairlaunch'],
  },

  // -------------------------------------------------------------------------
  // SAFE RECIPIENT — STRONGLY RECOMMENDED.
  //   After deploy, the deployer EOA holds 500,000 POSCI (the 2.38% allocation).
  //   If the deployer key was ever exposed (chat, email, screenshot, repo history),
  //   anyone with that key can `transfer` those tokens out the moment they have
  //   value. Setting `safeRecipient` makes the orchestrator transfer all 500K
  //   to that address IN THE SAME ORCHESTRATION RUN, while you're at the keyboard.
  //
  //   This should be:
  //     - a hardware-wallet address (Ledger/Trezor) you control, OR
  //     - a multisig you control, OR
  //     - at minimum, a fresh EOA whose private key never touched any chat/AI.
  //
  //   Leave blank to skip (the 500K stays at the deployer address).
  // -------------------------------------------------------------------------
  safeRecipient: '',

  // -------------------------------------------------------------------------
  // VERCEL — OPTIONAL. If filled, the orchestrator deploys the frontend to
  //          your Vercel account automatically after the contracts deploy.
  //          - Create a token at https://vercel.com/account/tokens (full access)
  //          - Create a Reown / WalletConnect project at https://cloud.reown.com
  //            (needed by RainbowKit; takes 30 seconds, free)
  // -------------------------------------------------------------------------
  vercel: {
    token:       '',                 // vercel_xxx... full-access token
    projectName: 'posci',            // Vercel project slug (created if missing)
    teamId:      '',                 // optional; leave blank for personal account
    wcProjectId: '',                 // Reown/WalletConnect project id (32 hex chars)
  },

  // -------------------------------------------------------------------------
  // GITHUB — OPTIONAL. If set, the orchestrator can fork trustwallet/assets
  //          and open a PR with your token info programmatically.
  //          You'll need: a personal access token with `public_repo` scope:
  //          https://github.com/settings/tokens?type=beta
  // -------------------------------------------------------------------------
  github: {
    token:    '',                    // ghp_... or github_pat_...
    username: '',                    // your GH username — used as fork owner
  },

  // -------------------------------------------------------------------------
  // V4 ADDRESSES — pre-filled per network. Verify against
  //                https://docs.uniswap.org/contracts/v4/deployments
  //                before mainnet broadcast in case Uniswap re-deploys.
  // -------------------------------------------------------------------------
  v4: {
    mainnet: {
      poolManager:     '0x000000000004444c5dC75cB358380D2e3dE08A90',
      positionManager: '0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e',
      permit2:         '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    },
    // sepolia addresses change more often — verify before use
    sepolia: {
      poolManager:     '0xE03A1074c86CFeDd5C142C4F04F1a1536e203543',
      positionManager: '0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4',
      permit2:         '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    },
  },

  // -------------------------------------------------------------------------
  // SAFETY THRESHOLDS — abort deploy if conditions are unsafe
  // -------------------------------------------------------------------------
  safety: {
    minBalanceEth:  '0.005',         // refuse to start if balance < this
    maxGasPriceGwei: 80,             // refuse to start if gas spikes above this
    requireConfirm:  true,           // require interactive Y/n before broadcast
  },
};
