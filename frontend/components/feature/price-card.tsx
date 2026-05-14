'use client';

import { motion } from 'framer-motion';
import { TrendingUp, AlertCircle, Sparkles, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { usePoolState, useEthPriceUsd } from '@/lib/hooks';

export function PriceCard() {
  const { data, loading, error } = usePoolState();
  const ethUsd = useEthPriceUsd();

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="h-4 w-4 text-destructive" /> Pool unreachable
          </CardTitle>
          <CardDescription className="text-xs break-all">{String(error.message ?? error)}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const initialized = data?.initialized ?? false;
  const ethPerPosci = data?.ethPerPosci ?? 0;
  const posciPerEth = data?.posciPerEth ?? 0;
  const usdPerPosci = ethUsd && ethPerPosci ? ethUsd * ethPerPosci : null;

  return (
    <Card className="overflow-hidden relative">
      <CardHeader className="relative">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" /> POSCI Price
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 relative">
        {!initialized ? (
          <div className="space-y-2">
            <Badge variant="warning" className="text-xs">Pool not bootstrapped</Badge>
            <p className="text-xs text-muted-foreground">
              Price quotes will appear once the genesis sale fills 0.5 ETH and the V4 pool is initialized.
            </p>
          </div>
        ) : loading ? (
          <Skeleton className="h-10 w-40" />
        ) : (
          <>
            <div className="space-y-1">
              <div className="text-3xl md:text-4xl font-light tabular text-foreground">
                {usdPerPosci != null
                  ? `$${usdPerPosci.toFixed(usdPerPosci < 0.01 ? 6 : 4)}`
                  : `${ethPerPosci.toExponential(3)} ETH`}
              </div>
              <div className="text-xs text-muted-foreground tabular">
                <span className="text-foreground/80">{ethPerPosci.toExponential(4)}</span> ETH per POSCI
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-border/40">
              <div>
                <div className="uppercase tracking-wider text-muted-foreground">1 ETH buys</div>
                <div className="text-sm font-semibold tabular flex items-center gap-1">
                  <Wallet className="h-3 w-3 text-primary" /> {posciPerEth.toLocaleString(undefined, { maximumFractionDigits: 0 })} POSCI
                </div>
              </div>
              <div>
                <div className="uppercase tracking-wider text-muted-foreground">Tick</div>
                <div className="text-sm font-semibold tabular flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-accent" /> {data?.tick}
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
