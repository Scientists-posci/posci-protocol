// Atomically evacuate the deployer's 500,000 POSCI to a safer address right
// after deploy. Use this when the deployer key may have been exposed (or even
// just as defense-in-depth: hot deploy keys should never *hold* token value).

import {
  createWalletClient, createPublicClient, http,
  formatEther, getAddress, isAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, sepolia } from 'viem/chains';

const ERC20_ABI = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view',
    inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'transfer', stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'bool' }] },
];

function chainOf(network) {
  if (network === 'mainnet') return mainnet;
  if (network === 'sepolia') return sepolia;
  throw new Error(`Unsupported network: ${network}`);
}

/**
 * Move every POSCI the deployer holds to `safeRecipient`. Returns { txHash, amount }.
 * Throws if recipient is invalid, deployer holds zero, or the broadcast fails.
 */
export async function evacuateDeployerBalance({
  network, rpcUrl, deployerPrivateKey,
  tokenAddress, safeRecipient,
}) {
  if (!isAddress(safeRecipient)) {
    throw new Error(`safeRecipient is not a valid address: ${safeRecipient}`);
  }
  const chain = chainOf(network);
  const transport = http(rpcUrl || undefined);
  const account = privateKeyToAccount(deployerPrivateKey);

  // Refuse to send to self — that's a no-op but a clear sign of misconfig.
  if (getAddress(safeRecipient) === getAddress(account.address)) {
    throw new Error(`safeRecipient equals deployer address — that defeats the purpose`);
  }

  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ chain, transport, account });

  const balance = await publicClient.readContract({
    address: getAddress(tokenAddress),
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });
  if (balance === 0n) {
    throw new Error(`Deployer holds 0 POSCI — nothing to evacuate (already moved?)`);
  }

  const txHash = await walletClient.writeContract({
    address: getAddress(tokenAddress),
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [getAddress(safeRecipient), balance],
  });

  // Wait for confirmation so subsequent steps (and the user) see the result land.
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 180_000 });
  if (receipt.status !== 'success') {
    throw new Error(`Evacuation tx ${txHash} reverted on-chain`);
  }

  return { txHash, amount: balance, amountFormatted: formatEther(balance) };
}
