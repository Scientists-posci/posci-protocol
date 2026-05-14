'use client';

import { useEffect, useState } from 'react';
import { useWatchContractEvent, usePublicClient } from 'wagmi';
import { Rocket, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatEther, type Hex } from 'viem';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { GENESIS_ABI, GENESIS_ADDRESS } from '@/lib/contracts';
import { formatTokens, shortAddr } from '@/lib/utils';

interface GenesisEntry {
  buyer:    Hex;
  ethIn:    bigint;
  posciOut: bigint;
  txHash:   Hex;
  timestamp: number;
  isBootstrap?: boolean;
}

const MAX_ROWS = 10;

export function GenesisActivity() {
  const client = usePublicClient();
  const [entries, setEntries] = useState<GenesisEntry[]>([]);
  const [bootstrapEvent, setBootstrapEvent] = useState<{ tx: Hex; tokenId: bigint } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!client || GENESIS_ADDRESS === '0x0000000000000000000000000000000000000000') {
      setLoading(false);
      return;
    }
    let stopped = false;
    (async () => {
      try {
        const head = await client.getBlockNumber();
        const fromBlock = head > 50_000n ? head - 50_000n : 0n;
        const buyEvent = GENESIS_ABI.find((x) => x.type === 'event' && x.name === 'GenesisBuy') as any;
        const bootEvent = GENESIS_ABI.find((x) => x.type === 'event' && x.name === 'Bootstrapped') as any;
        const [buys, boots] = await Promise.all([
          client.getLogs({ address: GENESIS_ADDRESS, event: buyEvent, fromBlock, toBlock: head }),
          client.getLogs({ address: GENESIS_ADDRESS, event: bootEvent, fromBlock, toBlock: head }),
        ]);
        const blockTimes = new Map<bigint, number>();
        const rows: GenesisEntry[] = [];
        for (const log of buys.slice(-MAX_ROWS)) {
          let ts = blockTimes.get(log.blockNumber!);
          if (ts == null) {
            const block = await client.getBlock({ blockNumber: log.blockNumber! });
            ts = Number(block.timestamp);
            blockTimes.set(log.blockNumber!, ts);
          }
          rows.push({
            buyer:    (log as any).args.buyer,
            ethIn:    (log as any).args.ethIn,
            posciOut: (log as any).args.posciOut,
            txHash:   log.transactionHash!,
            timestamp: ts,
          });
        }
        if (boots.length > 0) {
          const last = boots[boots.length - 1] as any;
          setBootstrapEvent({ tx: last.transactionHash!, tokenId: last.args.lpTokenId });
        }
        if (!stopped) {
          setEntries(rows.reverse());
          setLoading(false);
        }
      } catch {
        if (!stopped) setLoading(false);
      }
    })();
    return () => { stopped = true; };
  }, [client]);

  useWatchContractEvent({
    address: GENESIS_ADDRESS,
    abi:     GENESIS_ABI,
    eventName: 'GenesisBuy',
    enabled:  GENESIS_ADDRESS !== '0x0000000000000000000000000000000000000000',
    onLogs:   (logs) => {
      const incoming = logs.map<GenesisEntry>((log) => ({
        buyer:    (log as any).args.buyer,
        ethIn:    (log as any).args.ethIn,
        posciOut: (log as any).args.posciOut,
        txHash:   log.transactionHash!,
        timestamp: Math.floor(Date.now() / 1000),
      }));
      setEntries((prev) => [...incoming.reverse(), ...prev].slice(0, MAX_ROWS));
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Rocket className="h-4 w-4 text-accent" /> Genesis Activity
            </CardTitle>
            <CardDescription>Last {MAX_ROWS} purchases that fund the LP.</CardDescription>
          </div>
          {bootstrapEvent && (
            <a
              href={`https://etherscan.io/tx/${bootstrapEvent.tx}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs"
            >
              <Badge variant="success" className="gap-1">
                Bootstrap NFT #{bootstrapEvent.tokenId.toString()} <ExternalLink className="h-3 w-3" />
              </Badge>
            </a>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : entries.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">No genesis purchases yet.</div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {entries.map((e) => (
                <motion.div
                  key={e.txHash}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 30 }}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-secondary/30 px-3 py-2 text-xs"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a
                        href={`https://etherscan.io/address/${e.buyer}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono hover:text-foreground transition-colors min-w-0 truncate"
                      >
                        {shortAddr(e.buyer, 5)}
                      </a>
                    </TooltipTrigger>
                    <TooltipContent>{e.buyer}</TooltipContent>
                  </Tooltip>
                  <div className="font-mono tabular text-accent whitespace-nowrap">
                    {formatEther(e.ethIn)} ETH
                  </div>
                  <div className="font-mono tabular whitespace-nowrap">
                    → {formatTokens(e.posciOut, 18, 0)} POSCI
                  </div>
                  <a href={`https://etherscan.io/tx/${e.txHash}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-accent">
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
