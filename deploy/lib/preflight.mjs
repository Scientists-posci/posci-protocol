// Pre-flight checks. Refuses to proceed if anything looks off.

import {
  createPublicClient, http,
  formatEther, parseEther, formatGwei,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, sepolia } from 'viem/chains';

export function chainOf(network) {
  if (network === 'mainnet') return mainnet;
  if (network === 'sepolia') return sepolia;
  throw new Error(`Unsupported network: ${network}`);
}

export function clientFor(config) {
  const chain = chainOf(config.network);
  const transport = http(config.rpcUrl || undefined);
  const publicClient = createPublicClient({ chain, transport });
  return { chain, publicClient };
}

function need(value, label) {
  if (!value || (typeof value === 'string' && value.includes('PASTE'))) {
    throw new Error(`config.${label} is missing or still has the placeholder text`);
  }
  return value;
}

/**
 * Validate config, derive the deployer address, contact RPC, check balance,
 * check gas. Throws (with a clear message) if anything is unsafe.
 *
 * Returns { account, deployerAddress, balance, gasPriceGwei, estCostEth, chain, publicClient }.
 */
export async function preflight(config) {
  // Must-have keys
  need(config.deployerPrivateKey, 'deployerPrivateKey');
  need(config.etherscanApiKey,    'etherscanApiKey');
  need(config.network,            'network');

  if (!/^0x[0-9a-fA-F]{64}$/.test(config.deployerPrivateKey)) {
    throw new Error(
      'deployerPrivateKey must be a 0x-prefixed 64-hex-char string. ' +
      'Generate one with: cast wallet new'
    );
  }

  const account = privateKeyToAccount(config.deployerPrivateKey);
  const { chain, publicClient } = clientFor(config);

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' POSCI deploy — pre-flight checks');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`  Network        : ${chain.name} (chainId ${chain.id})`);
  console.log(`  Deployer addr  : ${account.address}`);
  console.log(`  RPC            : ${config.rpcUrl || `(public default for ${chain.name})`}`);

  // 1. Can we talk to the RPC?
  let blockNumber;
  try {
    blockNumber = await publicClient.getBlockNumber();
  } catch (e) {
    throw new Error(`RPC unreachable: ${e.message ?? e}`);
  }
  console.log(`  Latest block   : ${blockNumber}`);

  // 2. Gas price
  const gasPrice = await publicClient.getGasPrice();
  const gasPriceGwei = Number(formatGwei(gasPrice));
  console.log(`  Gas price      : ${gasPriceGwei.toFixed(3)} gwei`);

  if (gasPriceGwei > config.safety.maxGasPriceGwei) {
    throw new Error(
      `Gas price ${gasPriceGwei.toFixed(1)} gwei exceeds safety cap of ` +
      `${config.safety.maxGasPriceGwei} gwei. Wait for it to drop or raise the cap.`
    );
  }

  // 3. Balance check
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`  Balance        : ${formatEther(balance)} ETH`);

  // 4. Estimated cost
  // Total gas ≈ 4.3M from prior dry-runs. We use a 1.4x safety multiplier.
  const ESTIMATED_GAS = 4_300_000n;
  const SAFETY_MULTIPLIER = 14n;
  const estCost = (ESTIMATED_GAS * gasPrice * SAFETY_MULTIPLIER) / 10n;
  console.log(`  Est deploy cost: ${formatEther(estCost)} ETH (incl 1.4× safety margin)`);

  const minBalance = parseEther(config.safety.minBalanceEth);
  if (balance < minBalance) {
    throw new Error(
      `Balance ${formatEther(balance)} ETH < safety floor ${config.safety.minBalanceEth} ETH. ` +
      `Top up address ${account.address}.`
    );
  }
  if (balance < estCost) {
    throw new Error(
      `Balance ${formatEther(balance)} ETH may be insufficient. ` +
      `Estimated need: ${formatEther(estCost)} ETH. ` +
      `Top up address ${account.address} or wait for gas to drop.`
    );
  }

  // 5. Confirm V4 addresses are actually contracts on this chain
  const v4 = config.v4[config.network];
  for (const [k, addr] of Object.entries(v4)) {
    const code = await publicClient.getBytecode({ address: addr });
    if (!code || code === '0x') {
      throw new Error(`v4.${config.network}.${k} (${addr}) has no bytecode on ${chain.name}`);
    }
  }
  console.log(`  V4 addresses   : ✓ all 3 deployed on ${chain.name}`);

  // 6. Etherscan API reachability (verification depends on it)
  let etherscanReachable = false;
  try {
    const url = `https://api.etherscan.io/v2/api?chainid=${chain.id}&module=stats&action=ethsupply&apikey=${config.etherscanApiKey}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) {
      const j = await res.json();
      etherscanReachable = j.status === '1' || j.message === 'OK' || !!j.result;
    }
  } catch {
    etherscanReachable = false;
  }
  if (etherscanReachable) {
    console.log(`  Etherscan API  : ✓ reachable, key valid`);
  } else {
    console.log(`  Etherscan API  : ⚠ UNREACHABLE — source verification will fail`);
    console.log(`                   Deploy can still succeed; just skip --verify and run it later`);
    console.log(`                   from a network that can reach api.etherscan.io.`);
  }

  console.log('');
  console.log('  Pre-flight: ✓ ALL CHECKS PASSED');
  console.log('');

  return {
    account, deployerAddress: account.address, balance,
    gasPriceGwei, estCostEth: formatEther(estCost), chain, publicClient,
    etherscanReachable,
  };
}
