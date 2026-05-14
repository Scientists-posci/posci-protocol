'use client';

import { useReadContracts } from 'wagmi';
import { Coins, Gauge, Hourglass, Sparkles, TrendingDown, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

import { MINING_ABI, MINING_ADDRESS } from '@/lib/contracts';
import { Progress } from '@/components/ui/progress';
import { StatTile } from './stat-tile';
import { formatHashrate, formatTokens } from '@/lib/utils';

const TOTAL_MINING_SUPPLY = 20_000_000n * 10n ** 18n;

/**
 * Heuristic network hashrate from on-chain difficulty:
 *   networkHashrate = difficulty * 2^22 / TARGET_INTERVAL
 * (since MAXIMUM_TARGET = 2^234 ⇒ expected hashes/find = 2^22 * difficulty)
 */
function estimatedHashrate(difficulty: bigint, targetIntervalSec = 60): number {
  if (difficulty === 0n) return 0;
  const expectedHashes = Number(difficulty) * 2 ** 22;
  return expectedHashes / targetIntervalSec;
}

export function NetworkStats() {
  const { data } = useReadContracts({
    contracts: [
      { address: MINING_ADDRESS, abi: MINING_ABI, functionName: 'getMiningReward' },
      { address: MINING_ADDRESS, abi: MINING_ABI, functionName: 'getMiningDifficulty' },
      { address: MINING_ADDRESS, abi: MINING_ABI, functionName: 'getRemainingSupply' },
      { address: MINING_ADDRESS, abi: MINING_ABI, functionName: 'getEpochsUntilHalving' },
      { address: MINING_ADDRESS, abi: MINING_ABI, functionName: 'epochCount' },
      { address: MINING_ADDRESS, abi: MINING_ABI, functionName: 'tokensMinted' },
    ],
    query: { refetchInterval: 12_000 },
  });

  const reward         = (data?.[0]?.result as bigint | undefined) ?? 0n;
  const difficulty     = (data?.[1]?.result as bigint | undefined) ?? 0n;
  const remaining      = (data?.[2]?.result as bigint | undefined) ?? 0n;
  const epochsToHalve  = (data?.[3]?.result as bigint | undefined) ?? 0n;
  const epochCount     = (data?.[4]?.result as bigint | undefined) ?? 0n;
  const minted         = (data?.[5]?.result as bigint | undefined) ?? 0n;

  const minedPct  = TOTAL_MINING_SUPPLY > 0n ? Number((minted * 10000n) / TOTAL_MINING_SUPPLY) / 100 : 0;
  const hashrate  = estimatedHashrate(difficulty);

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="border border-border bg-card p-5 space-y-3 relative overflow-hidden"
      >
        <div className="relative flex items-baseline justify-between flex-wrap gap-2">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Mining progress</div>
            <div className="text-2xl font-bold tabular">
              {formatTokens(minted, 18, 0)} / 20,000,000 POSCI
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Mined</div>
            <div className="text-2xl font-light tabular text-foreground">
              {minedPct.toFixed(3)}%
            </div>
          </div>
        </div>
        <Progress value={Math.min(100, minedPct)} className="relative h-2" />
      </motion.div>

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
          value={difficulty > 0n ? difficulty.toLocaleString() : '—'}
          hint="adjusts every 1024 mines"
          icon={Gauge}
          accent="accent"
          loading={!data}
        />
        <StatTile
          label="Network hashrate ≈"
          value={formatHashrate(hashrate)}
          hint="implied by current difficulty"
          icon={Zap}
          accent="warning"
          loading={!data}
        />
        <StatTile
          label="Mines until halving"
          value={epochsToHalve.toString()}
          hint={`epoch ${epochCount.toString()}`}
          icon={Hourglass}
          accent="warning"
          loading={!data}
        />
        <StatTile
          label="Remaining to mine"
          value={`${formatTokens(remaining, 18, 0)} POSCI`}
          hint={`${(100 - minedPct).toFixed(2)}% of pool`}
          icon={TrendingDown}
          accent="success"
          loading={!data}
        />
        <StatTile
          label="Epochs"
          value={epochCount.toLocaleString()}
          hint="cumulative successful mines"
          icon={Sparkles}
          accent="primary"
          loading={!data}
        />
      </div>
    </div>
  );
}
