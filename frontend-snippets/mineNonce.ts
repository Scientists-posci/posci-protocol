// Browser-side miner. CPU-only — for serious mining use a GPU cuda/opencl
// kernel and pipe results back to the same `submitSolution` function.
//
// The on-chain check is exactly:
//   keccak256(abi.encodePacked(challenge, msg.sender, nonce))
// solc encodePacked of (bytes32, address, uint256) is:
//   32 bytes challenge || 20 bytes address || 32 bytes nonce  =  84 bytes
//
// We use viem's keccak256 + concat for byte-perfect parity with Solidity.

import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  keccak256,
  concat,
  encodePacked,
  pad,
  toBytes,
  toHex,
  type Address,
  type Hex,
} from 'viem';
import { mainnet } from 'viem/chains';

const MINING_ADDRESS: Address = '0xFILL_AFTER_DEPLOY';

const MINING_ABI = [
  {
    type: 'function',
    name: 'mine',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'nonce', type: 'uint256' },
      { name: 'challengeDigest', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'challengeNumber',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'miningTarget',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

/** Build the canonical PoW digest the way the contract does. */
export function buildDigest(challenge: Hex, miner: Address, nonce: bigint): Hex {
  return keccak256(encodePacked(['bytes32', 'address', 'uint256'], [challenge, miner, nonce]));
}

/** Search nonces serially. Returns the first hit. */
export async function findNonce(
  miner: Address,
  startNonce: bigint = 0n,
  onProgress?: (tried: bigint) => void,
): Promise<{ nonce: bigint; digest: Hex }> {
  const challenge = await publicClient.readContract({
    address: MINING_ADDRESS,
    abi: MINING_ABI,
    functionName: 'challengeNumber',
  });
  const target = await publicClient.readContract({
    address: MINING_ADDRESS,
    abi: MINING_ABI,
    functionName: 'miningTarget',
  });

  let nonce = startNonce;
  while (true) {
    const digest = buildDigest(challenge, miner, nonce);
    if (BigInt(digest) <= target) return { nonce, digest };
    nonce += 1n;
    if (onProgress && nonce % 10000n === 0n) onProgress(nonce - startNonce);
  }
}

/** Submit a (nonce, digest) pair found by `findNonce`. */
export async function submitSolution(nonce: bigint, digest: Hex): Promise<Hex> {
  if (!window.ethereum) throw new Error('No injected wallet');
  const wallet = createWalletClient({
    chain: mainnet,
    transport: custom(window.ethereum),
  });
  const [account] = await wallet.requestAddresses();
  return wallet.writeContract({
    account,
    address: MINING_ADDRESS,
    abi: MINING_ABI,
    functionName: 'mine',
    args: [nonce, digest],
  });
}

declare global {
  interface Window {
    ethereum?: any;
  }
}
