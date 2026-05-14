// Generic GitHub-PR submitter for token-asset repos.
//
// Three wallet/aggregator repos use the same fork → branch → upload → PR flow,
// only differing in directory layout:
//
//   Trust Wallet  (trustwallet/assets):
//     blockchains/ethereum/assets/<CHECKSUMMED_ADDR>/info.json
//     blockchains/ethereum/assets/<CHECKSUMMED_ADDR>/logo.png
//
//   TokenPocket   (TP-Lab/tokens):
//     eth/<CHECKSUMMED_ADDR>/info.json
//     eth/<CHECKSUMMED_ADDR>/logo.png
//
//   imToken       (consenlabs/token-profile):
//     erc20/<CHECKSUMMED_ADDR>.json
//     images/<CHECKSUMMED_ADDR>.png
//
// Each gets a slightly different `info.json` schema too — handled by callers.

import { readFileSync } from 'node:fs';
import { getAddress } from 'viem';

const API = 'https://api.github.com';

async function gh(method, path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Authorization':        `Bearer ${token}`,
      'Accept':               'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent':           'posci-deploy/1.0',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GitHub ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : {};
}

function b64(bytes) { return Buffer.from(bytes).toString('base64'); }

async function ensureFork(token, username, upstreamOwner, upstreamRepo) {
  // Two upstreams can have the same repo name (e.g. TP-Lab/tokens and
  // ethereum-lists/tokens). The simple-name fork can only point at one of
  // them — so we always check that an existing fork's parent matches our
  // intended upstream, and fall back to a disambiguated name if not.
  const disambiguated = `${upstreamOwner}-${upstreamRepo}`.toLowerCase();

  for (const candidate of [upstreamRepo, disambiguated]) {
    try {
      const repo = await gh('GET', `/repos/${username}/${candidate}`, token);
      if (repo.fork && repo.parent?.full_name === `${upstreamOwner}/${upstreamRepo}`) {
        return `${username}/${candidate}`;
      }
    } catch { /* not present */ }
  }

  // No matching fork — create one. Pick a name that won't collide with any
  // existing repo of ours.
  let forkName = upstreamRepo;
  try {
    await gh('GET', `/repos/${username}/${upstreamRepo}`, token);
    // Simple name is taken (by another fork or repo) — use disambiguated.
    forkName = disambiguated;
  } catch { /* simple name is free */ }

  const body = forkName === upstreamRepo ? {} : { name: forkName };
  await gh('POST', `/repos/${upstreamOwner}/${upstreamRepo}/forks`, token, body);

  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 4000));
    try {
      const repo = await gh('GET', `/repos/${username}/${forkName}`, token);
      if (repo.fork && repo.parent?.full_name === `${upstreamOwner}/${upstreamRepo}`) {
        return `${username}/${forkName}`;
      }
    } catch { /* keep polling */ }
  }
  throw new Error(`Fork of ${upstreamOwner}/${upstreamRepo} → ${username}/${forkName} not ready in 120s`);
}

async function getDefaultBranch(token, fork) {
  const r = await gh('GET', `/repos/${fork}`, token);
  return r.default_branch || 'master';
}

async function createBranch(token, fork, branchName, baseBranch) {
  const ref = await gh('GET', `/repos/${fork}/git/refs/heads/${baseBranch}`, token);
  try {
    await gh('POST', `/repos/${fork}/git/refs`, token, {
      ref: `refs/heads/${branchName}`,
      sha: ref.object.sha,
    });
  } catch (e) {
    if (!String(e).includes('Reference already exists')) throw e;
  }
}

async function putFile(token, fork, branch, path, content, commitMsg) {
  let existingSha;
  try {
    const cur = await gh('GET', `/repos/${fork}/contents/${path}?ref=${branch}`, token);
    existingSha = cur.sha;
  } catch { /* new file */ }
  await gh('PUT', `/repos/${fork}/contents/${path}`, token, {
    message: commitMsg,
    content: b64(content),
    branch,
    ...(existingSha ? { sha: existingSha } : {}),
  });
}

async function openPr(token, upstreamOwner, upstreamRepo, baseBranch, fork, branch, title, body) {
  const [forkOwner] = fork.split('/');
  return await gh('POST', `/repos/${upstreamOwner}/${upstreamRepo}/pulls`, token, {
    title,
    head: `${forkOwner}:${branch}`,
    base: baseBranch,
    body,
  });
}

/**
 * High-level helper. Forks an upstream asset repo, uploads two files, opens a PR.
 *
 * @param {object} args
 * @param {string} args.token         - GitHub PAT with `public_repo` scope
 * @param {string} args.username      - Your GH username (used as fork owner)
 * @param {string} args.upstreamOwner - e.g. 'trustwallet'
 * @param {string} args.upstreamRepo  - e.g. 'assets'
 * @param {string} args.branchName    - branch to create on the fork
 * @param {string} args.infoPathInRepo
 * @param {string} args.logoPathInRepo
 * @param {string|Buffer} args.infoBytes
 * @param {string|Buffer} args.logoBytes
 * @param {string} args.prTitle
 * @param {string} args.prBody
 * @returns {Promise<string>} PR html url
 */
export async function submitAssetPr({
  token, username,
  upstreamOwner, upstreamRepo,
  branchName,
  infoPathInRepo, logoPathInRepo,
  infoBytes, logoBytes,
  prTitle, prBody,
}) {
  const fork = await ensureFork(token, username, upstreamOwner, upstreamRepo);
  const baseBranch = await getDefaultBranch(token, fork);
  await createBranch(token, fork, branchName, baseBranch);

  await putFile(token, fork, branchName, infoPathInRepo,
    infoBytes, `Add ${branchName} — info`);
  await putFile(token, fork, branchName, logoPathInRepo,
    logoBytes, `Add ${branchName} — logo`);

  const pr = await openPr(token, upstreamOwner, upstreamRepo, baseBranch,
    fork, branchName, prTitle, prBody);
  return pr.html_url;
}

// =============================================================================
// Wallet-specific wrappers
// =============================================================================

export async function openTrustWalletPr({ token, username, tokenAddress, project, infoBytes, logoBytes }) {
  const addr = getAddress(tokenAddress);
  return submitAssetPr({
    token, username,
    upstreamOwner: 'trustwallet',
    upstreamRepo:  'assets',
    branchName:    `posci-${addr.slice(2, 10).toLowerCase()}`,
    infoPathInRepo: `blockchains/ethereum/assets/${addr}/info.json`,
    logoPathInRepo: `blockchains/ethereum/assets/${addr}/logo.png`,
    infoBytes, logoBytes,
    prTitle: `Add ${project.symbol} — ${project.name} (${addr})`,
    prBody: trustWalletBody(project, addr),
  });
}

export async function openTpWalletPr({ token, username, tokenAddress, project, infoBytes, logoBytes }) {
  const addr = getAddress(tokenAddress);
  return submitAssetPr({
    token, username,
    upstreamOwner: 'TP-Lab',
    upstreamRepo:  'tokens',
    branchName:    `posci-${addr.slice(2, 10).toLowerCase()}`,
    infoPathInRepo: `eth/${addr}/info.json`,
    logoPathInRepo: `eth/${addr}/logo.png`,
    infoBytes, logoBytes,
    prTitle: `Add ${project.symbol} — ${project.name} (${addr})`,
    prBody: trustWalletBody(project, addr),
  });
}

export async function openImTokenPr({ token, username, tokenAddress, project, infoBytes, logoBytes }) {
  const addr = getAddress(tokenAddress);
  return submitAssetPr({
    token, username,
    upstreamOwner: 'consenlabs',
    upstreamRepo:  'token-profile',
    branchName:    `posci-${addr.slice(2, 10).toLowerCase()}`,
    infoPathInRepo: `erc20/${addr}.json`,
    logoPathInRepo: `images/${addr}.png`,
    infoBytes, logoBytes,
    prTitle: `Add ${project.symbol} — ${project.name}`,
    prBody: trustWalletBody(project, addr),
  });
}

/**
 * ethereum-lists/tokens — backs MEW, MyCrypto, Trezor (via IPFS), WallETH.
 * Schema: a single JSON file at tokens/eth/<CHECKSUMMED_ADDR>.json
 * No logo upload needed — the schema only references logo by URL.
 */
export async function openEthereumListsPr({ token, username, tokenAddress, project, infoBytes }) {
  const addr = getAddress(tokenAddress);
  return submitAssetPr({
    token, username,
    upstreamOwner: 'ethereum-lists',
    upstreamRepo:  'tokens',
    branchName:    `posci-${addr.slice(2, 10).toLowerCase()}`,
    infoPathInRepo: `tokens/eth/${addr}.json`,
    // ethereum-lists doesn't store logos in the repo; we use the same path
    // for both args (the second putFile is a no-op overwrite of the first).
    logoPathInRepo: `tokens/eth/${addr}.json`,
    infoBytes, logoBytes: infoBytes,
    prTitle: `Add ${project.symbol} (${project.name})`,
    prBody: trustWalletBody(project, addr),
  });
}

/**
 * MetaMask/contract-metadata — directly powers MetaMask's token recognition.
 * Schema: edit `contract-map.json` (single big map, addr → metadata) +
 *         add SVG logo at `images/<filename>.svg`
 * This requires fetching + editing the shared JSON, so we can't reuse
 * `submitAssetPr` directly. Custom flow below.
 */
export async function openMetaMaskPr({
  token, username, tokenAddress, project, logoSvgBytes,
}) {
  const addr = getAddress(tokenAddress);
  const upstreamOwner = 'MetaMask';
  const upstreamRepo  = 'contract-metadata';
  const branchName    = `posci-${addr.slice(2, 10).toLowerCase()}`;
  const logoFile      = `${project.symbol.toLowerCase()}.svg`;

  // Fork + branch
  const fork = await ensureFork(token, username, upstreamOwner, upstreamRepo);
  const baseBranch = await getDefaultBranch(token, fork);
  await createBranch(token, fork, branchName, baseBranch);

  // 1) Pull current contract-map.json
  const mapMeta = await gh('GET', `/repos/${fork}/contents/contract-map.json?ref=${branchName}`, token);
  const currentMap = JSON.parse(Buffer.from(mapMeta.content, 'base64').toString('utf8'));

  // 2) Insert our entry
  if (currentMap[addr]) {
    throw new Error(`MetaMask map already contains ${addr}`);
  }
  currentMap[addr] = {
    name:     project.name,
    logo:     logoFile,
    erc20:    true,
    symbol:   project.symbol,
    decimals: project.decimals,
  };
  // Sort by address (matches their convention) for clean diff
  const sorted = Object.keys(currentMap).sort().reduce((acc, k) => {
    acc[k] = currentMap[k];
    return acc;
  }, {});
  const newMapStr = JSON.stringify(sorted, null, 2) + '\n';

  // 3) Push edited map (preserve sha)
  await gh('PUT', `/repos/${fork}/contents/contract-map.json`, token, {
    message: `Add ${project.symbol} (${project.name}) to contract-map`,
    content: b64(Buffer.from(newMapStr)),
    branch:  branchName,
    sha:     mapMeta.sha,
  });

  // 4) Push SVG logo
  await putFile(token, fork, branchName, `images/${logoFile}`,
    logoSvgBytes, `Add ${project.symbol} logo`);

  // 5) Open PR
  const pr = await openPr(token, upstreamOwner, upstreamRepo, baseBranch,
    fork, branchName,
    `Add ${project.symbol} (${project.name}) — ${addr}`,
    trustWalletBody(project, addr));
  return pr.html_url;
}

function trustWalletBody(project, addr) {
  return [
    `**Token:** ${project.name} (${project.symbol})`,
    `**Address:** \`${addr}\``,
    `**Website:** ${project.website}`,
    `**Twitter:** ${project.twitter}`,
    '',
    project.description.replace(/\s+/g, ' ').trim(),
    '',
    `Etherscan: https://etherscan.io/token/${addr}`,
  ].join('\n');
}

// =============================================================================
// Per-wallet info.json schemas
// =============================================================================

export function buildTrustWalletInfo({ project, tokenAddress, chain }) {
  const addr = getAddress(tokenAddress);
  return {
    name: project.name,
    type: 'ERC20',
    symbol: project.symbol,
    decimals: project.decimals,
    website: project.website,
    description: project.description.replace(/\s+/g, ' ').trim(),
    explorer: `https://${chain.id === 1 ? 'etherscan.io' : 'sepolia.etherscan.io'}/token/${addr}`,
    status: 'active',
    id: addr,
    links: [
      project.twitter  && { name: 'twitter',  url: project.twitter  },
      project.telegram && { name: 'telegram', url: project.telegram },
      project.discord  && { name: 'discord',  url: project.discord  },
      project.github   && { name: 'github',   url: project.github   },
    ].filter(Boolean),
    tags: project.tags ?? [],
  };
}

/** TP Wallet info.json — almost identical to TW, with a `holders` placeholder. */
export function buildTpWalletInfo({ project, tokenAddress, chain }) {
  return {
    ...buildTrustWalletInfo({ project, tokenAddress, chain }),
    research: project.website,
  };
}

/** ethereum-lists/tokens schema — used by MEW, MyCrypto, Trezor. */
export function buildEthereumListsInfo({ project, tokenAddress }) {
  const addr = getAddress(tokenAddress);
  return {
    symbol:   project.symbol,
    name:     project.name,
    type:     'ERC20',
    address:  addr,
    ens_address: '',
    decimals: project.decimals,
    website:  project.website,
    logo: {
      src:    `${project.website.replace(/\/$/, '')}/posci-logo-128.png`,
      width:  '128',
      height: '128',
      ipfs_hash: '',
    },
    support: {
      email: '',
      url:   project.website,
    },
    social: {
      blog:        '',
      chat:        '',
      facebook:    '',
      forum:       '',
      github:      project.github || '',
      gitter:      '',
      instagram:   '',
      linkedin:    '',
      reddit:      '',
      slack:       '',
      telegram:    project.telegram || '',
      twitter:     project.twitter || '',
      youtube:     '',
    },
  };
}

/** imToken token-profile json schema (consenlabs). */
export function buildImTokenInfo({ project, tokenAddress, chain }) {
  const addr = getAddress(tokenAddress);
  return {
    symbol:           project.symbol,
    address:          addr,
    overview: {
      en:             project.description.replace(/\s+/g, ' ').trim(),
      zh:             project.description.replace(/\s+/g, ' ').trim(),
    },
    decimals:         project.decimals,
    name:             project.name,
    website:          project.website,
    links: {
      twitter:        project.twitter || undefined,
      telegram:       project.telegram || undefined,
      discord:        project.discord || undefined,
      github:         project.github || undefined,
      explorer:       `https://${chain.id === 1 ? 'etherscan.io' : 'sepolia.etherscan.io'}/token/${addr}`,
    },
    social: {
      twitter:        project.twitter || undefined,
    },
    initial_price: {},
    price: {},
    support: {
      hardware:       false,
    },
  };
}
