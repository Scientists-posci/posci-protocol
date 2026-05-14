'use client';

import { useMemo } from 'react';
import { useReadContracts, useAccount } from 'wagmi';
import { Trophy, Pickaxe } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

import { MINING_ABI, MINING_ADDRESS } from '@/lib/contracts';
import { shortAddr } from '@/lib/utils';

const TOP_N = 10;
const MAX_BATCH = 100;

export function Leaderboard() {
  const { address: me } = useAccount();

  const { data: countRead } = useReadContracts({
    contracts: [
      { address: MINING_ADDRESS, abi: MINING_ABI, functionName: 'minersCount' },
      { address: MINING_ADDRESS, abi: MINING_ABI, functionName: 'epochCount' },
    ],
    query: { refetchInterval: 12_000 },
  });

  const minersCount = (countRead?.[0]?.result as bigint | undefined) ?? 0n;
  const epochCount  = (countRead?.[1]?.result as bigint | undefined) ?? 0n;

  // Pull a single batch; if there are more than MAX_BATCH miners, additional
  // pages can be added later. For now MVP shows top 10 from the first 100.
  const fetchSize = minersCount > BigInt(MAX_BATCH) ? BigInt(MAX_BATCH) : minersCount;

  const { data: batch } = useReadContracts({
    contracts: [
      {
        address:      MINING_ADDRESS,
        abi:          MINING_ABI,
        functionName: 'topMinersBatch',
        args:         [0n, fetchSize],
      },
    ],
    query: { enabled: minersCount > 0n, refetchInterval: 12_000 },
  });

  const ranked = useMemo(() => {
    const result = batch?.[0]?.result as readonly [readonly `0x${string}`[], readonly bigint[]] | undefined;
    if (!result) return [];
    const [addrs, wins] = result;
    return addrs
      .map((addr, i) => ({ addr, wins: wins[i] }))
      .sort((a, b) => (b.wins > a.wins ? 1 : b.wins < a.wins ? -1 : 0))
      .slice(0, TOP_N);
  }, [batch]);

  const totalSolutions = epochCount;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4 text-accent" />
          Top miners
        </CardTitle>
        <CardDescription>
          Cumulative solutions claimed per address. Ranked by solutions — proxy for sustained hashrate.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {minersCount === 0n ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            No solutions yet. Mining unlocks after Genesis bootstrap.
          </div>
        ) : !batch ? (
          <div className="space-y-2">
            {Array.from({ length: TOP_N }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-1.5">
            {ranked.map((row, i) => {
              const sharePct = totalSolutions > 0n
                ? (Number(row.wins) * 100) / Number(totalSolutions)
                : 0;
              const isMe = me && row.addr.toLowerCase() === me.toLowerCase();
              return (
                <div
                  key={row.addr}
                  className={`flex items-center gap-3 rounded-md border border-border/30 p-2.5 ${isMe ? 'bg-accent/10 border-accent/40' : 'bg-secondary/20'}`}
                >
                  <div className="text-sm font-mono tabular text-muted-foreground w-6 text-right">
                    {i + 1}
                  </div>
                  <div className="font-mono text-sm flex-1 min-w-0 truncate">
                    {shortAddr(row.addr, 5)}
                    {isMe && <Badge variant="accent" className="ml-2 px-1.5 py-0">you</Badge>}
                  </div>
                  <div className="flex items-center gap-1.5 text-sm tabular">
                    <Pickaxe className="h-3.5 w-3.5 text-muted-foreground" />
                    {row.wins.toString()}
                  </div>
                  <div className="text-xs text-muted-foreground tabular w-12 text-right">
                    {sharePct.toFixed(1)}%
                  </div>
                </div>
              );
            })}
            {minersCount > BigInt(MAX_BATCH) && (
              <p className="text-xs text-muted-foreground pt-2 text-center">
                Showing top {TOP_N} of first {MAX_BATCH} miners ({minersCount.toString()} total). Pagination coming.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
