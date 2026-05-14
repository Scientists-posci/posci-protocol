'use client';

import { useEffect, useState } from 'react';
import { useWatchContractEvent, usePublicClient } from 'wagmi';
import { Pickaxe, Hash, ExternalLink, Activity, Radio } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Hex } from 'viem';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { MINING_ABI, MINING_ADDRESS } from '@/lib/contracts';
import { formatTokens, shortAddr } from '@/lib/utils';

interface MineEntry {
  miner:      Hex;
  reward:     bigint;
  epoch:      bigint;
  txHash:     Hex;
  blockNumber: bigint;
  timestamp:  number;
  source:     'live' | 'history';
}

const MAX_ROWS = 12;

export function LiveMiningFeed() {
  const client = usePublicClient();
  const [entries, setEntries] = useState<MineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Backfill: pull last 5000 blocks of Mined events on mount.
  useEffect(() => {
    if (!client || MINING_ADDRESS === '0x0000000000000000000000000000000000000000') {
      setLoading(false);
      return;
    }
    let stopped = false;
    (async () => {
      try {
        const head = await client.getBlockNumber();
        const fromBlock = head > 5000n ? head - 5000n : 0n;
        const logs = await client.getLogs({
          address: MINING_ADDRESS,
          event: MINING_ABI.find((x) => x.type === 'event' && x.name === 'Mined') as any,
          fromBlock,
          toBlock: head,
        });
        const blockTimes = new Map<bigint, number>();
        const rows: MineEntry[] = [];
        for (const log of logs.slice(-MAX_ROWS)) {
          let ts = blockTimes.get(log.blockNumber!);
          if (ts == null) {
            const block = await client.getBlock({ blockNumber: log.blockNumber! });
            ts = Number(block.timestamp);
            blockTimes.set(log.blockNumber!, ts);
          }
          rows.push({
            miner:       (log as any).args.miner,
            reward:      (log as any).args.reward,
            epoch:       (log as any).args.epochCount,
            txHash:      log.transactionHash!,
            blockNumber: log.blockNumber!,
            timestamp:   ts,
            source:      'history',
          });
        }
        if (!stopped) {
          setEntries(rows.reverse());
          setLoading(false);
        }
      } catch (e) {
        if (!stopped) setLoading(false);
      }
    })();
    return () => { stopped = true; };
  }, [client]);

  // Live: subscribe to new Mined events.
  useWatchContractEvent({
    address: MINING_ADDRESS,
    abi:     MINING_ABI,
    eventName: 'Mined',
    enabled:  MINING_ADDRESS !== '0x0000000000000000000000000000000000000000',
    onLogs:   (logs) => {
      const incoming = logs.map<MineEntry>((log) => ({
        miner:       (log as any).args.miner,
        reward:      (log as any).args.reward,
        epoch:       (log as any).args.epochCount,
        txHash:      log.transactionHash!,
        blockNumber: log.blockNumber!,
        timestamp:   Math.floor(Date.now() / 1000),
        source:      'live',
      }));
      setEntries((prev) => [...incoming.reverse(), ...prev].slice(0, MAX_ROWS));
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Pickaxe className="h-4 w-4 text-primary" /> Live Mining Feed
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
            </CardTitle>
            <CardDescription>Last {MAX_ROWS} successful PoW solutions across the network.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            <Activity className="h-6 w-6 mx-auto mb-2 opacity-40" />
            No mines yet. Be first.
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {entries.map((e) => (
                <motion.div
                  key={e.txHash}
                  layout
                  initial={{ opacity: 0, y: -10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 30 }}
                  transition={{ type: 'spring', damping: 18, stiffness: 220 }}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-secondary/30 px-3 py-2 text-xs hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Badge variant={e.source === 'live' ? 'success' : 'secondary'} className="shrink-0 gap-1">
                      {e.source === 'live' ? (
                        <>
                          <Radio className="h-3 w-3 animate-pulse" /> live
                        </>
                      ) : (
                        `#${e.epoch}`
                      )}
                    </Badge>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={`https://etherscan.io/address/${e.miner}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono truncate hover:text-foreground transition-colors"
                        >
                          {shortAddr(e.miner, 5)}
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>{e.miner}</TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="font-mono tabular text-primary font-semibold whitespace-nowrap">
                    +{formatTokens(e.reward, 18, 0)} POSCI
                  </div>
                  <div className="text-muted-foreground tabular shrink-0 w-20 text-right">
                    {timeAgo(e.timestamp)}
                  </div>
                  <a
                    href={`https://etherscan.io/tx/${e.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-accent transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function timeAgo(ts: number): string {
  const sec = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}
