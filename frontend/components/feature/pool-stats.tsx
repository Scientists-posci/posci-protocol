'use client';

import { motion } from 'framer-motion';
import { Droplets, Layers3, ArrowDownToLine, Skull } from 'lucide-react';
import { formatEther } from 'viem';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { usePoolState, useEthPriceUsd } from '@/lib/hooks';
import { formatTokens } from '@/lib/utils';

export function PoolStats() {
  const { data, loading } = usePoolState();
  const ethUsd = useEthPriceUsd();

  const tvlUsd = data && ethUsd ? Number(data.ethReserve) / 1e18 * 2 * ethUsd : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Droplets className="h-4 w-4 text-primary" /> Uniswap V4 Pool
        </CardTitle>
        <CardDescription>
          Full-range LP, fee tier 0.3%. NFT permanently held at <code className="font-mono text-[10px]">0x…dEaD</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <>
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-full" />
          </>
        ) : !data?.initialized ? (
          <Badge variant="warning">Pool not initialized — waiting for genesis cap</Badge>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-1"
            >
              <div className="text-xs uppercase tracking-wider text-muted-foreground">TVL</div>
              <div className="text-2xl font-bold tabular">
                {tvlUsd != null
                  ? `$${tvlUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                  : `${formatEther(data.ethReserve * 2n)} ETH-equiv`}
              </div>
            </motion.div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/40">
              <Reserve icon={<ArrowDownToLine className="h-3 w-3 text-primary" />} label="ETH side" value={`${Number(data.ethReserve) / 1e18} ETH`} />
              <Reserve icon={<Layers3 className="h-3 w-3 text-accent" />} label="POSCI side" value={`${formatTokens(data.posciReserve, 18, 0)} POSCI`} />
              <Reserve icon={<Skull className="h-3 w-3 text-muted-foreground" />} label="Liquidity (L)" value={data.liquidity.toString()} />
              <Reserve icon={<Layers3 className="h-3 w-3 text-muted-foreground" />} label="Active tick" value={data.tick.toString()} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Reserve({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        {icon} {label}
      </div>
      <div className="text-sm font-semibold tabular truncate" title={value}>{value}</div>
    </div>
  );
}
