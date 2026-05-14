#!/usr/bin/env node
//
//  POSCI deploy orchestrator
//
//  Reads ./config.js, runs the full pipeline:
//    [1] Preflight — balance, gas, RPC, V4 sanity
//    [2] Deploy    — `forge script` with --broadcast --verify
//    [3] Parse     — read broadcast artifact, save .state.json
//    [4] Logo      — render PNG at 32/64/128/256/512/1024
//    [5] Submit    — generate per-platform submission packages,
//                     auto-open Trust Wallet PR if github.token is set
//    [6] Checklist — print remaining manual steps with click-through URLs
//
//  Idempotent: re-running after a partial failure picks up from .state.json.
//
//  Flags:
//    --preflight-only       Just run [1], no broadcast
//    --post-deploy-only     Skip [1]+[2], assume .state.json has addresses
//    --skip-confirm         Don't prompt before broadcast (use with care)
//    --no-trustwallet-pr    Skip Trust Wallet PR even if creds present
//

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { getAddress, formatEther } from 'viem';

import { preflight }                              from './lib/preflight.mjs';
import { renderLogos }                            from './lib/render-logo.mjs';
import { buildSubmissions }                       from './lib/submissions.mjs';
import {
  openTrustWalletPr, openTpWalletPr, openImTokenPr,
  openEthereumListsPr, openMetaMaskPr,
  buildTrustWalletInfo, buildTpWalletInfo, buildImTokenInfo,
  buildEthereumListsInfo,
}                                                  from './lib/github-pr.mjs';
import { evacuateDeployerBalance }                from './lib/evacuate.mjs';
import { deployFrontendToVercel }                from './lib/vercel-deploy.mjs';
import { readFileSync as _readFileSync }          from 'node:fs';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT  = resolve(__dirname, '..');
const STATE_FILE = resolve(__dirname, '.state.json');
const ASSETS_DIR = resolve(__dirname, 'assets', 'generated');

const argv = new Set(process.argv.slice(2));
const PREFLIGHT_ONLY    = argv.has('--preflight-only');
const POST_DEPLOY_ONLY  = argv.has('--post-deploy-only');
const SKIP_CONFIRM      = argv.has('--skip-confirm');
const NO_TW_PR          = argv.has('--no-trustwallet-pr');
const SKIP_VERIFY       = argv.has('--skip-verify');
const VERIFY_ONLY       = argv.has('--verify-only');

const COLOR = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', gray: '\x1b[90m',
};
const log = {
  step:    (s) => console.log(`\n${COLOR.cyan}${COLOR.bold}▸ ${s}${COLOR.reset}`),
  ok:      (s) => console.log(`${COLOR.green}  ✓${COLOR.reset} ${s}`),
  warn:    (s) => console.log(`${COLOR.yellow}  ⚠${COLOR.reset} ${s}`),
  err:     (s) => console.error(`${COLOR.red}  ✗${COLOR.reset} ${s}`),
  info:    (s) => console.log(`${COLOR.dim}    ${s}${COLOR.reset}`),
  banner:  (s) => console.log(`\n${COLOR.bold}${s}${COLOR.reset}`),
};

function readState() {
  if (!existsSync(STATE_FILE)) return {};
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')); } catch { return {}; }
}
function writeState(s) {
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2) + '\n');
}

async function loadConfig() {
  const p = resolve(__dirname, 'config.js');
  if (!existsSync(p)) {
    log.err('config.js missing. Copy config.example.js → config.js and fill it in.');
    process.exit(2);
  }
  const mod = await import('file://' + p);
  return mod.default;
}

async function confirm(question) {
  if (SKIP_CONFIRM) return true;
  const rl = readline.createInterface({ input, output });
  const ans = await rl.question(`${COLOR.yellow}${question} (y/N): ${COLOR.reset}`);
  rl.close();
  return ans.trim().toLowerCase() === 'y' || ans.trim().toLowerCase() === 'yes';
}

function spawnForge(args, env) {
  return new Promise((resolve, reject) => {
    const cwd = REPO_ROOT;
    const child = spawn(process.platform === 'win32' ? 'forge.exe' : 'forge', args, {
      cwd, env, stdio: 'inherit',
    });
    child.on('exit', (code) => {
      code === 0 ? resolve() : reject(new Error(`forge exited ${code}`));
    });
    child.on('error', reject);
  });
}

/**
 * Pull deployed addresses out of the broadcast artifact:
 *   broadcast/Deploy.s.sol/<chainId>/run-latest.json
 */
function parseBroadcast(chainId) {
  const root = resolve(REPO_ROOT, 'broadcast', 'Deploy.s.sol', String(chainId));
  if (!existsSync(root)) throw new Error(`no broadcast artifacts in ${root}`);
  const candidates = readdirSync(root)
    .filter(f => f.startsWith('run-') && f.endsWith('.json'))
    .map(f => ({ f, t: f.includes('latest') ? Infinity : Number(f.replace(/[^0-9]/g, '')) || 0 }))
    .sort((a, b) => b.t - a.t);
  if (!candidates.length) throw new Error('no run-*.json broadcast artifact');
  const file = resolve(root, candidates[0].f);
  const data = JSON.parse(readFileSync(file, 'utf8'));

  const txs = data.transactions ?? [];
  const out = {};
  for (const tx of txs) {
    if (tx.transactionType !== 'CREATE') continue;
    const name = tx.contractName;
    const addr = getAddress(tx.contractAddress);
    if (name === 'POSCIToken')   out.tokenAddress   = addr;
    if (name === 'POSCIMining')  out.miningAddress  = addr;
    if (name === 'POSCIGenesis') out.genesisAddress = addr;
  }
  if (!out.tokenAddress || !out.miningAddress || !out.genesisAddress) {
    throw new Error(`broadcast artifact missing one of the three contracts: ${JSON.stringify(out)}`);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
async function verifyOnly(config, state) {
  if (!state.tokenAddress || !state.miningAddress || !state.genesisAddress) {
    throw new Error('No deployed addresses in .state.json — deploy first.');
  }
  log.step('[verify-only] Re-running Etherscan source verification');
  const rpcEnvVar = config.network === 'mainnet' ? 'MAINNET_RPC_URL' : 'SEPOLIA_RPC_URL';
  const env = {
    ...process.env,
    [rpcEnvVar]:         config.rpcUrl,
    ETHERSCAN_API_KEY:   config.etherscanApiKey,
  };
  const chainId = state.chainId;
  const verifyContract = async (addr, contractPath) => {
    log.info(`Verifying ${contractPath} at ${addr}...`);
    await new Promise((res, rej) => {
      const child = spawn(process.platform === 'win32' ? 'forge.exe' : 'forge', [
        'verify-contract',
        addr,
        contractPath,
        '--chain-id', String(chainId),
        '--etherscan-api-key', config.etherscanApiKey,
        '--rpc-url', config.rpcUrl,
        '--watch',
      ], { cwd: REPO_ROOT, env, stdio: 'inherit' });
      child.on('exit', (c) => c === 0 ? res() : rej(new Error(`verify ${addr} exited ${c}`)));
      child.on('error', rej);
    });
  };
  await verifyContract(state.tokenAddress,   'src/POSCIToken.sol:POSCIToken');
  await verifyContract(state.miningAddress,  'src/POSCIMining.sol:POSCIMining');
  await verifyContract(state.genesisAddress, 'src/POSCIGenesis.sol:POSCIGenesis');
  state.verifiedAt = new Date().toISOString();
  writeState(state);
  log.ok('All 3 contracts verified.');
}

// ─────────────────────────────────────────────────────────────────────────
async function main() {
  const config = await loadConfig();
  let state = readState();

  log.banner('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log.banner('  POSCI DEPLOY ORCHESTRATOR');
  log.banner('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (VERIFY_ONLY) {
    await verifyOnly(config, state);
    return;
  }

  // ---------- [1] PREFLIGHT ----------
  let preflightResult;
  if (!POST_DEPLOY_ONLY) {
    log.step('[1/6] Pre-flight checks');
    preflightResult = await preflight(config);
    state.network         = config.network;
    state.chainId         = preflightResult.chain.id;
    state.deployerAddress = preflightResult.deployerAddress;
    writeState(state);

    if (PREFLIGHT_ONLY) {
      log.banner('Pre-flight only — stopping here. Re-run without --preflight-only to broadcast.');
      return;
    }
  }

  // ---------- [2] DEPLOY ----------
  if (!POST_DEPLOY_ONLY && !state.deployedAt) {
    log.step('[2/6] Deploy contracts');

    if (!preflightResult) preflightResult = await preflight(config);

    log.warn(`About to broadcast to ${preflightResult.chain.name} from ${preflightResult.deployerAddress}`);
    log.warn(`Estimated cost: ~${preflightResult.estCostEth} ETH (current gas ${preflightResult.gasPriceGwei.toFixed(2)} gwei)`);

    const ok = await confirm(`Proceed with mainnet broadcast?`);
    if (!ok) {
      log.warn('Aborted by user.');
      return;
    }

    const v4 = config.v4[config.network];
    const env = {
      ...process.env,
      DEPLOYER_PRIVATE_KEY:       config.deployerPrivateKey,
      MAINNET_RPC_URL:            config.rpcUrl || preflightResult.chain.rpcUrls?.default?.http?.[0] || '',
      SEPOLIA_RPC_URL:            config.rpcUrl || preflightResult.chain.rpcUrls?.default?.http?.[0] || '',
      ETHERSCAN_API_KEY:          config.etherscanApiKey,
      V4_POSITION_MANAGER:        v4.positionManager,
      PERMIT2:                    v4.permit2,
      MINING_START_DELAY_HOURS:   String(config.miningStartDelayHours ?? 24),
    };
    const rpcEnvVar = config.network === 'mainnet' ? 'MAINNET_RPC_URL' : 'SEPOLIA_RPC_URL';

    // Decide whether to pass --verify based on Etherscan reachability.
    const willVerify = !SKIP_VERIFY && (preflightResult?.etherscanReachable ?? true);
    const forgeArgs = [
      'script', 'script/Deploy.s.sol:DeployScript',
      '--rpc-url', env[rpcEnvVar],
      '--broadcast',
      '-vvv',
    ];
    if (willVerify) forgeArgs.splice(forgeArgs.length - 1, 0, '--verify');
    if (!willVerify) {
      log.warn('Skipping --verify (Etherscan unreachable or --skip-verify set).');
      log.info('Run `node deploy.mjs --verify-only` later from a network that can reach Etherscan.');
    }

    await spawnForge(forgeArgs, env);

    state.deployedAt    = new Date().toISOString();
    state.verifiedAt    = willVerify ? state.deployedAt : null;
    writeState(state);
    log.ok(willVerify ? `Deploy + verify complete.` : `Deploy complete (verify pending).`);
  } else if (state.deployedAt) {
    log.info(`Skipping deploy (already broadcast at ${state.deployedAt}).`);
  }

  // ---------- [3] PARSE ARTIFACT ----------
  log.step('[3/6] Read broadcast artifact');
  if (!state.tokenAddress) {
    const addrs = parseBroadcast(state.chainId);
    Object.assign(state, addrs);
    writeState(state);
  }
  log.ok(`POSCIToken   : ${state.tokenAddress}`);
  log.ok(`POSCIMining  : ${state.miningAddress}`);
  log.ok(`POSCIGenesis : ${state.genesisAddress}`);

  // ---------- [3b] EVACUATE deployer's 500K POSCI to safeRecipient ----------
  const sameAddr = config.safeRecipient
    && config.safeRecipient.toLowerCase() === state.deployerAddress.toLowerCase();
  if (sameAddr) {
    log.step('[3b] Evacuate 500,000 POSCI to safeRecipient');
    log.warn(`safeRecipient equals deployer address — skipping evacuation (no-op).`);
    log.warn(`The 500K POSCI stays at ${state.deployerAddress}. If this key is`);
    log.warn(`exposed, anyone with it can transfer those tokens away. Move them`);
    log.warn(`manually from a safe environment.`);
  } else if (config.safeRecipient && !state.evacuationTx) {
    log.step('[3b] Evacuate 500,000 POSCI to safeRecipient');
    log.info(`from ${state.deployerAddress} → to ${config.safeRecipient}`);
    try {
      const r = await evacuateDeployerBalance({
        network:            config.network,
        rpcUrl:             config.rpcUrl,
        deployerPrivateKey: config.deployerPrivateKey,
        tokenAddress:       state.tokenAddress,
        safeRecipient:      config.safeRecipient,
      });
      state.evacuationTx     = r.txHash;
      state.evacuatedAmount  = r.amountFormatted;
      state.evacuatedTo      = config.safeRecipient;
      writeState(state);
      log.ok(`Moved ${r.amountFormatted} POSCI in tx ${r.txHash}`);
    } catch (e) {
      log.err(`Evacuation FAILED: ${e.message}`);
      log.warn(`The 500K POSCI is still at ${state.deployerAddress}.`);
      log.warn(`You must move it manually before someone with key access does.`);
      // Don't abort — let the user continue post-deploy steps.
    }
  } else if (state.evacuationTx) {
    log.info(`Skipping evacuation (already done in tx ${state.evacuationTx}).`);
  } else {
    log.warn('safeRecipient not set — 500K POSCI stays at the deployer EOA.');
    log.warn('If the deployer key is compromised, those tokens are at risk.');
  }

  // ---------- [4] LOGO ----------
  log.step('[4/6] Render token logo (PNG @ 32/64/128/256/512/1024)');
  try {
    const files = renderLogos(ASSETS_DIR);
    state.logoFiles = files;
    writeState(state);
    log.ok(`Generated ${files.length} files → ${ASSETS_DIR}`);
  } catch (e) {
    log.warn(`Logo rendering failed: ${e.message}`);
    log.info(`You can supply PNGs manually at ${ASSETS_DIR}`);
  }

  // ---------- [5] SUBMISSION PACKAGES ----------
  log.step('[5/6] Build submission packages');
  const subDir = resolve(__dirname, 'submissions');
  const subs = buildSubmissions({
    outDir: subDir,
    tokenAddress:   state.tokenAddress,
    miningAddress:  state.miningAddress,
    genesisAddress: state.genesisAddress,
    project:        config.project,
    chain:          { id: state.chainId, name: state.network },
  });
  for (const [k, v] of Object.entries(subs)) log.ok(`${k}: ${v}`);

  // Auto-PR to wallet asset repos if GitHub creds configured
  if (!NO_TW_PR && config.github?.token && config.github?.username && state.tokenAddress) {
    const logoPng = resolve(ASSETS_DIR, 'posci-logo-256.png');
    const logoBytes = _readFileSync(logoPng);
    const chain = { id: state.chainId, name: state.network };

    const wallets = [
      {
        name:     'Trust Wallet',
        stateKey: 'trustwalletPr',
        run:      () => openTrustWalletPr({
          token: config.github.token, username: config.github.username,
          tokenAddress: state.tokenAddress, project: config.project,
          infoBytes: Buffer.from(JSON.stringify(
            buildTrustWalletInfo({ project: config.project, tokenAddress: state.tokenAddress, chain }),
            null, 2) + '\n'),
          logoBytes,
        }),
      },
      {
        name:     'TokenPocket',
        stateKey: 'tpwalletPr',
        run:      () => openTpWalletPr({
          token: config.github.token, username: config.github.username,
          tokenAddress: state.tokenAddress, project: config.project,
          infoBytes: Buffer.from(JSON.stringify(
            buildTpWalletInfo({ project: config.project, tokenAddress: state.tokenAddress, chain }),
            null, 2) + '\n'),
          logoBytes,
        }),
      },
      {
        name:     'imToken',
        stateKey: 'imtokenPr',
        run:      () => openImTokenPr({
          token: config.github.token, username: config.github.username,
          tokenAddress: state.tokenAddress, project: config.project,
          infoBytes: Buffer.from(JSON.stringify(
            buildImTokenInfo({ project: config.project, tokenAddress: state.tokenAddress, chain }),
            null, 2) + '\n'),
          logoBytes,
        }),
      },
      {
        name:     'ethereum-lists (MEW · MyCrypto · Trezor)',
        stateKey: 'ethereumListsPr',
        run:      () => openEthereumListsPr({
          token: config.github.token, username: config.github.username,
          tokenAddress: state.tokenAddress, project: config.project,
          infoBytes: Buffer.from(JSON.stringify(
            buildEthereumListsInfo({ project: config.project, tokenAddress: state.tokenAddress }),
            null, 2) + '\n'),
        }),
      },
      {
        name:     'MetaMask contract-metadata',
        stateKey: 'metamaskPr',
        run:      () => openMetaMaskPr({
          token: config.github.token, username: config.github.username,
          tokenAddress: state.tokenAddress, project: config.project,
          logoSvgBytes: _readFileSync(resolve(ASSETS_DIR, 'posci-logo.svg')),
        }),
      },
    ];

    log.step('[5b] Auto-open wallet PRs (5 platforms)');
    for (const w of wallets) {
      if (state[w.stateKey]) {
        log.info(`${w.name}: already open at ${state[w.stateKey]}`);
        continue;
      }
      try {
        const url = await w.run();
        state[w.stateKey] = url;
        writeState(state);
        log.ok(`${w.name} PR: ${url}`);
      } catch (e) {
        log.warn(`${w.name} PR failed: ${e.message}`);
      }
    }
  } else if (!NO_TW_PR) {
    log.info(`Wallet PRs skipped (set config.github.token + .username to enable).`);
  }

  // ---------- [5c] DEPLOY FRONTEND TO VERCEL ----------
  if (config.vercel?.token && !state.vercelUrl) {
    log.step('[5c] Deploy frontend to Vercel');
    try {
      const r = await deployFrontendToVercel({
        vercelConfig:      config.vercel,
        contractAddresses: {
          tokenAddress:   state.tokenAddress,
          miningAddress:  state.miningAddress,
          genesisAddress: state.genesisAddress,
        },
        rpcUrl: config.rpcUrl,
      });
      state.vercelUrl       = r.productionUrl;
      state.vercelProjectId = r.projectId;
      writeState(state);
      log.ok(`Frontend live: ${r.productionUrl}`);
    } catch (e) {
      log.warn(`Vercel deploy failed: ${e.message}`);
      log.info(`You can deploy manually: cd frontend && npx vercel --prod`);
    }
  } else if (!config.vercel?.token) {
    log.info(`Vercel deploy skipped (set config.vercel.token to enable).`);
  } else {
    log.info(`Vercel already deployed: ${state.vercelUrl}`);
  }

  // ---------- [6] FINAL CHECKLIST ----------
  log.step('[6/6] Manual steps remaining (no API exists for these)');
  const explorerHost = state.chainId === 1 ? 'etherscan.io' : 'sepolia.etherscan.io';
  console.log('');
  if (state.vercelUrl) {
    console.log(`  🌐 Frontend (live)     : ${state.vercelUrl}`);
  }
  console.log(`  Etherscan token page  : https://${explorerHost}/token/${state.tokenAddress}`);
  console.log(`  Mining contract page  : https://${explorerHost}/address/${state.miningAddress}`);
  console.log(`  Genesis contract page : https://${explorerHost}/address/${state.genesisAddress}`);
  console.log('');
  console.log(`  1. Open the token page above → click "More" → "Update Token Info"`);
  console.log(`     Paste fields from submissions/etherscan-form.md`);
  console.log(`     Upload assets/generated/posci-logo-256.png`);
  console.log(`     Sign the EIP-712 challenge with the deployer wallet.`);
  console.log('');
  console.log(`  2. Submit CoinGecko form     → see submissions/coingecko-form.md`);
  console.log(`  3. Submit CoinMarketCap      → see submissions/coinmarketcap-form.md`);
  if (!state.trustwalletPr) {
    console.log(`  4. Trust Wallet PR  (free)      → see submissions/trustwallet-info.json`);
  }
  if (!state.tpwalletPr) {
    console.log(`  5. TokenPocket PR   (free)      → fork TP-Lab/tokens, add eth/<addr>/{info.json,logo.png}`);
    console.log(`        OR paid official portal (1000 USDT) → https://www.tokenpocket.pro/zh/submit/token`);
  }
  if (!state.imtokenPr) {
    console.log(`  6. imToken PR       (free)      → fork consenlabs/token-profile`);
  }
  if (!state.ethereumListsPr) {
    console.log(`  7. ethereum-lists/tokens  → backs MEW + MyCrypto + Trezor (free GitHub PR)`);
  }
  if (!state.metamaskPr) {
    console.log(`  8. MetaMask contract-metadata → backs MetaMask itself (free GitHub PR)`);
  }
  console.log('');
  console.log(`  Coinbase Wallet: open https://wallet.coinbase.com → search ${state.tokenAddress}`);
  console.log(`                   → "Update here" → upload logo + EIP-712 signature`);
  console.log(`                   (OR use on-chain EAS attestation — see CHECKLIST.md)`);
  console.log('');
  console.log(`  Auto-pulled (no extra work needed, runs off Etherscan + indexers):`);
  console.log(`    • OKX Wallet · Bitget Wallet · Rainbow · Phantom (for ETH)`);
  console.log(`    • DexScreener · DexTools · GeckoTerminal (after V4 pool fills)`);
  console.log('');
  console.log(`  Master checklist: ${subs.checklist}`);
  console.log('');

  log.banner('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log.banner('  ALL AUTOMATED STEPS COMPLETE.');
  log.banner('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch((e) => {
  console.error(`\n${COLOR.red}${COLOR.bold}FATAL${COLOR.reset}\n${e.stack || e.message}\n`);
  process.exit(1);
});
