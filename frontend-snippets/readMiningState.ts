// Read live mining state for the frontend dashboard.
import { createPublicClient, http, formatEther, type Address } from 'viem';
import { mainnet } from 'viem/chains';

const MINING_ADDRESS: Address = '0xFILL_AFTER_DEPLOY';

const ABI = [
  { type: 'function', name: 'getMiningReward',     stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'getMiningDifficulty', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'getMiningTarget',     stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'getChallengeNumber',  stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
  { type: 'function', name: 'getRemainingSupply',  stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'getEpochsUntilHalving', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'epochCount',          stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'tokensMinted',        stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'miningStartTime',     stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'poolGateOpen',        stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
] as const;

const client = createPublicClient({ chain: mainnet, transport: http() });

export async function readMiningState() {
  const calls = ABI.map((fn) => ({
    address: MINING_ADDRESS,
    abi: ABI,
    functionName: fn.name,
  })) as const;

  const r = await client.multicall({ contracts: calls as any, allowFailure: false });
  const [
    reward, difficulty, target, challenge, remaining, epochsToHalving,
    epochCount, tokensMinted, startTime, poolGate,
  ] = r as any;

  return {
    rewardPerMine:       formatEther(reward) + ' POSCI',
    difficulty:          difficulty.toString(),
    target:              target.toString(),
    challengeNumber:     challenge as `0x${string}`,
    remainingSupply:     formatEther(remaining) + ' POSCI',
    tokensMinted:        formatEther(tokensMinted) + ' POSCI',
    epochsUntilHalving:  Number(epochsToHalving),
    epochCount:          Number(epochCount),
    miningStartTime:     new Date(Number(startTime) * 1000).toISOString(),
    poolGateOpen:        Boolean(poolGate),
    timeGateOpen:        Date.now() / 1000 >= Number(startTime),
  };
}
