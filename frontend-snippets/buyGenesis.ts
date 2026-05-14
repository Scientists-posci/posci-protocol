// Browser-side genesis buy. Drop into your Next.js / Vite frontend.
// Deps: viem ^2.x, wagmi ^2.x (only the public client is needed if you BYO wallet).

import {
  createWalletClient,
  custom,
  parseEther,
  type Address,
  type Hex,
} from 'viem';
import { mainnet } from 'viem/chains';

// --- replace after deploy ---
const GENESIS_ADDRESS: Address = '0xFILL_AFTER_DEPLOY';
// ---------------------------

const GENESIS_ABI = [
  {
    type: 'function',
    name: 'buyGenesis',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'totalContributed',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'bootstrapped',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'contributed',
    stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'GENESIS_HARD_CAP',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'GENESIS_PER_WALLET',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;

/** Send `ethAmount` ether (string, e.g. "0.05") to the genesis contract. */
export async function buyGenesis(ethAmount: string): Promise<Hex> {
  if (!window.ethereum) throw new Error('No injected wallet');

  const wallet = createWalletClient({
    chain: mainnet,
    transport: custom(window.ethereum),
  });

  const [account] = await wallet.requestAddresses();

  const hash = await wallet.writeContract({
    account,
    address: GENESIS_ADDRESS,
    abi: GENESIS_ABI,
    functionName: 'buyGenesis',
    value: parseEther(ethAmount),
  });

  return hash;
}

declare global {
  interface Window {
    ethereum?: any;
  }
}
