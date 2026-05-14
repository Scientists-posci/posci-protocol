'use client';

import { useEffect, useState } from 'react';
import { useAccount, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther, type Hex } from 'viem';
import { Rocket, Sparkles, Wallet, Lock, AlertCircle, ArrowRight, CheckCircle2, Loader2, Unlock, Timer } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

import { GENESIS_ABI, GENESIS_ADDRESS } from '@/lib/contracts';
import { formatTokens } from '@/lib/utils';

export function GenesisWidget() {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState('0.05');

  const { data, refetch } = useReadContracts({
    contracts: [
      { address: GENESIS_ADDRESS, abi: GENESIS_ABI, functionName: 'totalContributed' },
      { address: GENESIS_ADDRESS, abi: GENESIS_ABI, functionName: 'GENESIS_HARD_CAP' },
      { address: GENESIS_ADDRESS, abi: GENESIS_ABI, functionName: 'GENESIS_PER_WALLET' },
      { address: GENESIS_ADDRESS, abi: GENESIS_ABI, functionName: 'POSCI_FOR_GENESIS' },
      { address: GENESIS_ADDRESS, abi: GENESIS_ABI, functionName: 'bootstrapped' },
      { address: GENESIS_ADDRESS, abi: GENESIS_ABI, functionName: 'contributed', args: address ? [address] : undefined },
      { address: GENESIS_ADDRESS, abi: GENESIS_ABI, functionName: 'deployedAt' },
      { address: GENESIS_ADDRESS, abi: GENESIS_ABI, functionName: 'FORCE_BOOTSTRAP_DELAY' },
    ],
    query: { refetchInterval: 8000 },
  });

  const total          = (data?.[0]?.result as bigint | undefined) ?? 0n;
  const hardCap        = (data?.[1]?.result as bigint | undefined) ?? parseEther('0.5');
  const perWallet      = (data?.[2]?.result as bigint | undefined) ?? parseEther('0.05');
  const posciForGen    = (data?.[3]?.result as bigint | undefined) ?? 250_000n * 10n ** 18n;
  const bootstrapped   = (data?.[4]?.result as boolean | undefined) ?? false;
  const myContribution = (data?.[5]?.result as bigint | undefined) ?? 0n;
  const deployedAt     = (data?.[6]?.result as bigint | undefined) ?? 0n;
  const forceDelay     = (data?.[7]?.result as bigint | undefined) ?? 86400n;

  const filledPct = hardCap > 0n ? Number((total * 10000n) / hardCap) / 100 : 0;
  const myCapLeft = perWallet - myContribution;

  let parsedValue = 0n;
  let parseErr: string | null = null;
  try {
    parsedValue = amount.length ? parseEther(amount) : 0n;
  } catch {
    parseErr = 'Invalid number';
  }
  const expectedPosci = parsedValue * posciForGen / hardCap;

  const { writeContractAsync, data: txHash, isPending } = useWriteContract();
  const { isLoading: txConfirming, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (txSuccess) {
      toast.success('Genesis purchase confirmed', { description: 'POSCI in your wallet. Mining gate may now be open.' });
      refetch();
    }
  }, [txSuccess, refetch]);

  async function buy() {
    if (!isConnected) {
      toast.error('Connect a wallet first');
      return;
    }
    if (parsedValue > myCapLeft) {
      toast.error('Per-wallet cap exceeded', { description: `You can still contribute ${formatEther(myCapLeft)} ETH` });
      return;
    }
    try {
      await writeContractAsync({
        address: GENESIS_ADDRESS,
        abi: GENESIS_ABI,
        functionName: 'buyGenesis',
        value: parsedValue,
      });
      toast.success('Transaction sent');
    } catch (e: any) {
      toast.error('Buy failed', { description: e?.shortMessage ?? e?.message });
    }
  }

  const closed = bootstrapped || total >= hardCap;

  return (
    <Card className="overflow-hidden relative">
      <CardHeader className="relative">
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          Genesis Sale
          <Badge variant={closed ? 'success' : 'accent'}>{closed ? 'Closed · Pool live' : 'Open'}</Badge>
        </CardTitle>
        <CardDescription>
          One-shot, atomic launch. The instant 0.5 ETH fills, the same transaction creates the Uniswap V4 pool and burns the LP NFT.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 relative">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between items-baseline text-sm">
            <span className="font-mono tabular text-2xl font-light text-foreground">
              {formatEther(total)} ETH
            </span>
            <span className="text-muted-foreground tabular">/ {formatEther(hardCap)} ETH cap</span>
          </div>
          <Progress value={filledPct} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{filledPct.toFixed(1)}% filled</span>
            <span>per-wallet cap {formatEther(perWallet)} ETH</span>
          </div>
        </div>

        <Separator />

        {/* Buy form */}
        {closed ? (
          <Alert variant="success">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Genesis is closed</AlertTitle>
            <AlertDescription>
              The pool is live on Uniswap V4 and the LP NFT lives at <code className="font-mono">0x…dEaD</code>. Trade or mine.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Wallet className="h-4 w-4 text-accent" /> Amount in ETH
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.001"
                  min="0"
                  max={formatEther(myCapLeft)}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="font-mono tabular text-base"
                />
                <Button variant="outline" size="default" onClick={() => setAmount(formatEther(myCapLeft))} disabled={!isConnected}>
                  Max
                </Button>
              </div>
              {parseErr && <p className="text-xs text-destructive">{parseErr}</p>}
              {isConnected && (
                <p className="text-xs text-muted-foreground">
                  Your remaining cap: <span className="text-foreground font-mono">{formatEther(myCapLeft)}</span> ETH
                </p>
              )}
            </div>

            <div className="rounded-lg border border-border/50 bg-secondary/40 p-4 space-y-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">You will receive</div>
              <div className="flex items-center gap-2 text-2xl font-bold tabular">
                <Sparkles className="h-5 w-5 text-accent" />
                {formatTokens(expectedPosci)} POSCI
              </div>
              <div className="text-xs text-muted-foreground">
                Price: 1 ETH = 500,000 POSCI · Initial pool price.
              </div>
            </div>

            <Button onClick={buy} variant="gradient" size="xl" className="w-full" disabled={!isConnected || isPending || txConfirming || parsedValue === 0n || parsedValue > myCapLeft}>
              {isPending || txConfirming ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> {txConfirming ? 'Confirming…' : 'Awaiting wallet…'}</>
              ) : (
                <>Buy Genesis <ArrowRight className="h-4 w-4" /></>
              )}
            </Button>

            <Alert>
              <Lock className="h-4 w-4" />
              <AlertTitle>What happens when this fills?</AlertTitle>
              <AlertDescription>
                If your buy is the one that fills the cap, your transaction <em>also</em> initializes the V4 pool, mints LP, and burns the NFT.
                Costs slightly more gas — and you go down in history as the bootstrap tx.
              </AlertDescription>
            </Alert>

            {deployedAt > 0n && (
              <ForceUnlockPanel
                deployedAt={deployedAt}
                delay={forceDelay}
                isConnected={isConnected}
                onUnlocked={refetch}
              />
            )}
          </>
        )}

        {!isConnected && (
          <Alert variant="warning">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Connect a wallet to buy</AlertTitle>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function ForceUnlockPanel({
  deployedAt,
  delay,
  isConnected,
  onUnlocked,
}: {
  deployedAt: bigint;
  delay: bigint;
  isConnected: boolean;
  onUnlocked: () => void;
}) {
  const unlockAt = Number(deployedAt + delay) * 1000;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const msLeft = unlockAt - now;
  const unlocked = msLeft <= 0;

  const { writeContractAsync, data: txHash, isPending } = useWriteContract();
  const { isLoading: txConfirming, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (txSuccess) {
      toast.success('Mining unlocked', { description: 'Pool gate is open. Miners can now claim.' });
      onUnlocked();
    }
  }, [txSuccess, onUnlocked]);

  async function unlock() {
    if (!isConnected) {
      toast.error('Connect a wallet first');
      return;
    }
    try {
      await writeContractAsync({
        address: GENESIS_ADDRESS,
        abi: GENESIS_ABI,
        functionName: 'forceBootstrap',
      });
      toast.success('Unlock tx sent');
    } catch (e: any) {
      toast.error('Force-bootstrap failed', { description: e?.shortMessage ?? e?.message });
    }
  }

  const hrs  = Math.max(0, Math.floor(msLeft / 3_600_000));
  const mins = Math.max(0, Math.floor((msLeft % 3_600_000) / 60_000));
  const secs = Math.max(0, Math.floor((msLeft % 60_000) / 1_000));

  return (
    <Alert variant={unlocked ? 'success' : 'default'}>
      {unlocked ? <Unlock className="h-4 w-4" /> : <Timer className="h-4 w-4" />}
      <AlertTitle>{unlocked ? 'Mining unlock available' : 'Mining unlocks in'}</AlertTitle>
      <AlertDescription className="space-y-3">
        {unlocked ? (
          <>
            <p>
              Anyone can finalize Genesis with the ETH raised so far. The pool gets built at the same price ratio (1 ETH = 500K POSCI) and the mining gate opens permanently. Unsold POSCI is burned to <code className="font-mono">0x…dEaD</code>.
            </p>
            <Button onClick={unlock} variant="outline" size="default" className="w-full" disabled={!isConnected || isPending || txConfirming}>
              {isPending || txConfirming ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> {txConfirming ? 'Confirming…' : 'Awaiting wallet…'}</>
              ) : (
                <><Unlock className="h-4 w-4" /> Force unlock mining</>
              )}
            </Button>
          </>
        ) : (
          <p className="font-mono tabular text-lg">
            {String(hrs).padStart(2, '0')}:{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
