'use client';

import { useReadContracts } from 'wagmi';
import { Coins, Gauge, Hourglass, Layers, Sparkles, TrendingDown } from 'lucide-react';
import { MINING_ABI, MINING_ADDRESS } from '@/lib/contracts';
import { formatTokens } from '@/lib/utils';
import { StatTile } from './stat-tile';

export function MiningStats() {
  const { data } = useReadContracts({
    contracts: [
      { address: MINING_ADDRESS, abi: MINING_ABI, functionName: 'getMiningReward' },
      { address: MINING_ADDRESS, abi: MINING_ABI, functionName: 'getMiningDifficulty' },
      { address: MINING_ADDRESS, abi: MINING_ABI, functionName: 'getRemainingSupply' },
      { address: MINING_ADDRESS, abi: MINING_ABI, functionName: 'getEpochsUntilHalving' },
      { address: MINING_ADDRESS, abi: MINING_ABI, functionName: 'epochCount' },
      { address: MINING_ADDRESS, abi: MINING_ABI, functionName: 'tokensMinted' },
    ],
    query: { refetchInterval: 12000 },
  });

  const reward         = (data?.[0]?.result as bigint | undefined) ?? 0n;
  const difficulty     = (data?.[1]?.result as bigint | undefined) ?? 0n;
  const remaining      = (data?.[2]?.result as bigint | undefined) ?? 0n;
  const epochsToHalve  = (data?.[3]?.result as bigint | undefined) ?? 0n;
  const epochCount     = (data?.[4]?.result as bigint | undefined) ?? 0n;
  const minted         = (data?.[5]?.result as bigint | undefined) ?? 0n;
  const totalMined     = minted;
  const minedPct       = remaining + minted > 0n ? Number((minted * 10000n) / (minted + remaining)) / 100 : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <StatTile
        label="Reward / block"
        value={`${formatTokens(reward, 18, 0)} POSCI`}
        hint="Halves every 10,000 mines"
        icon={Coins}
        accent="primary"
        loading={!data}
      />
      <StatTile
        label="Network difficulty"
        value={difficulty > 0n ? difficulty.toString() : '—'}
        hint="Higher = more hashes per block"
        icon={Gauge}
        accent="accent"
        loading={!data}
      />
      <StatTile
        label="Remaining to mine"
        value={`${formatTokens(remaining, 18, 0)} POSCI`}
        hint={`${minedPct.toFixed(2)}% mined so far`}
        icon={TrendingDown}
        accent="success"
        loading={!data}
      />
      <StatTile
        label="Mines until halving"
        value={epochsToHalve.toString()}
        hint={`Epoch ${epochCount.toString()}`}
        icon={Hourglass}
        accent="warning"
        loading={!data}
      />
      <StatTile
        label="Total mined"
        value={`${formatTokens(totalMined, 18, 0)} POSCI`}
        hint="Across all miners"
        icon={Sparkles}
        accent="primary"
        loading={!data}
      />
      <StatTile
        label="Epoch count"
        value={epochCount.toString()}
        hint="Successful PoW solutions"
        icon={Layers}
        accent="accent"
        loading={!data}
      />
    </div>
  );
}
