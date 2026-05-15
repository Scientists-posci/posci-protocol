'use client';

import { useEffect, useState, useRef } from 'react';
import { useAccount, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useEstimateFeesPerGas } from 'wagmi';
import { Cpu, Zap, Play, Square, Activity, Hash, AlertTriangle, ShieldAlert, CheckCircle2, ChevronsUpDown, Circle, Clock, Check, Fuel } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { formatEther, type Hex } from 'viem';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { MINING_ABI, MINING_ADDRESS } from '@/lib/contracts';
import { MiningManager } from '@/lib/mining/manager';
import type { GpuStatus } from '@/lib/mining/types';
import { formatHashrate, shortAddr } from '@/lib/utils';

// Empirical: repeat miner ~110k gas, new miner first mine ~180k (extra cold
// SSTORE for solutionsByMiner / _hasMined / miners.push), retarget tx +60k.
// 240k covers ~99% of cases; capping prevents wallets from over-padding the
// gas limit on top of their own inflated estimateGas.
const MINE_GAS_LIMIT = 240_000n;

export function MiningControls() {
  const { address, isConnected } = useAccount();
  const [manager] = useState(() => new MiningManager());
  const [running, setRunning] = useState(false);
  const [useCpu, setUseCpu] = useState(true);
  const [useGpu, setUseGpu] = useState(true);
  const [cpuWorkers, setCpuWorkers] = useState(typeof navigator !== 'undefined' ? Math.max(1, Math.min(8, navigator.hardwareConcurrency ?? 4)) : 4);
  const [gpuPower, setGpuPower] = useState(64);
  const [cpuHashrate, setCpuHashrate] = useState(0);
  const [gpuHashrate, setGpuHashrate] = useState(0);
  const [gpuAvailable, setGpuAvailable] = useState(false);
  const [gpuStatus, setGpuStatus] = useState<GpuStatus>('unprobed');
  const [gpuError, setGpuError] = useState<string | null>(null);
  const { data: feeData } = useEstimateFeesPerGas({ query: { refetchInterval: 12_000 } });
  const [solutions, setSolutions] = useState<{ nonce: bigint; digest: Hex; source: 'cpu' | 'gpu'; submitted?: boolean }[]>([]);
  const submitting = useRef(false);

  const { data, refetch } = useReadContracts({
    contracts: [
      { address: MINING_ADDRESS, abi: MINING_ABI, functionName: 'challengeNumber' },
      { address: MINING_ADDRESS, abi: MINING_ABI, functionName: 'miningTarget' },
      { address: MINING_ADDRESS, abi: MINING_ABI, functionName: 'miningStartTime' },
      { address: MINING_ADDRESS, abi: MINING_ABI, functionName: 'poolGateOpen' },
    ],
    query: { refetchInterval: 6000 },
  });
  const challenge      = data?.[0]?.result as Hex | undefined;
  const target         = data?.[1]?.result as bigint | undefined;
  const miningStart    = data?.[2]?.result as bigint | undefined;
  const poolOpen       = data?.[3]?.result as boolean | undefined;
  const timeOpen       = miningStart != null ? BigInt(Math.floor(Date.now() / 1000)) >= miningStart : false;
  const canMine        = isConnected && challenge && target && timeOpen && poolOpen === true;

  const { writeContractAsync, data: txHash } = useWriteContract();
  const { isLoading: txConfirming, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    manager.probeGpu().then((ok) => {
      setGpuAvailable(ok);
      setGpuStatus(manager.getGpuStatus());
    });
    manager.on('state', (s) => {
      setCpuHashrate(s.cpuStats.hashrate);
      setGpuHashrate(s.gpuStats.hashrate);
      setGpuAvailable(s.gpuAvailable);
      setGpuStatus(s.gpuStatus);
    });
    manager.on('hit', async (h) => {
      setSolutions((prev) => [{ ...h }, ...prev].slice(0, 8));
      // Auto-submit the first solution we find on this challenge.
      if (submitting.current) return;
      submitting.current = true;
      try {
        await writeContractAsync({
          address: MINING_ADDRESS,
          abi: MINING_ABI,
          functionName: 'mine',
          args: [h.nonce, h.digest],
          // Explicit cap so wallets don't pad on top of their own inflated
          // estimateGas. Actual usage is ~110–180k; 240k is the headroom
          // we need for first-mine + retarget edge cases.
          gas: MINE_GAS_LIMIT,
        });
        toast.success('Solution submitted', { description: `${h.source.toUpperCase()} hit at nonce ${h.nonce.toString()}` });
        manager.stop(); setRunning(false);
      } catch (e: any) {
        toast.error('Submit failed', { description: e?.shortMessage ?? e?.message ?? 'unknown error' });
      } finally {
        submitting.current = false;
      }
    });
    return () => manager.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { manager.setCpuWorkers(useCpu ? cpuWorkers : 0); }, [cpuWorkers, useCpu, manager]);
  useEffect(() => { manager.setGpuPower(gpuPower); }, [gpuPower, manager]);

  useEffect(() => {
    if (txSuccess) {
      toast.success('Block mined!', { description: 'Reward credited to your wallet.' });
      refetch();
    }
  }, [txSuccess, refetch]);

  async function start() {
    if (!canMine || !address || !challenge || !target) {
      toast.error('Not ready', { description: 'Connect wallet and wait for both gates to open.' });
      return;
    }
    setSolutions([]);
    setGpuError(null);
    try {
      await manager.start(challenge, address, target, useCpu, useGpu && gpuAvailable);
      setRunning(true);
    } catch (e: any) {
      setGpuError(e?.message ?? 'GPU failed');
      toast.error('GPU init failed', { description: e?.message ?? 'Falling back to CPU' });
      // Try CPU only
      if (useCpu) {
        await manager.start(challenge, address, target, true, false);
        setRunning(true);
      }
    }
  }

  function stop() {
    manager.stop();
    setRunning(false);
  }

  const totalRate = cpuHashrate + gpuHashrate;

  // Estimated ETH cost of a single mine() tx at current fees. ~150k gas is
  // the typical actual usage (240k is the limit we set to cap wallet padding;
  // base fee is only billed on gas used, not limit). Shows the user upfront
  // what each successful solution will burn.
  const gasFeeWei = feeData?.maxFeePerGas;
  const estCostEth = gasFeeWei ? formatEther(gasFeeWei * 150_000n) : null;
  const baseFeeGwei = gasFeeWei ? Number(gasFeeWei / 1_000_000_000n) : null;

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-accent" />
              Mining Engine
            </CardTitle>
            <CardDescription>
              CPU workers + WebGPU compute. The kernel hash includes <code className="text-accent font-mono text-xs">msg.sender</code>, so nothing in your nonce stream can be stolen by a bot.
            </CardDescription>
          </div>
          <Badge variant={running ? 'success' : 'secondary'} className="text-xs">
            <Circle className={`h-2 w-2 fill-current ${running ? 'animate-pulse' : ''}`} />
            {running ? 'mining' : 'idle'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Gate state alerts */}
        {(!timeOpen || !poolOpen) && isConnected && (
          <Alert variant="warning">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Mining is not open yet</AlertTitle>
            <AlertDescription className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Time gate:</span>
                {timeOpen ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400">
                    <Check className="h-3.5 w-3.5" /> open
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-300">
                    <Clock className="h-3.5 w-3.5" />
                    opens at {miningStart ? new Date(Number(miningStart) * 1000).toLocaleString() : '—'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Pool gate:</span>
                {poolOpen ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400">
                    <Check className="h-3.5 w-3.5" /> open
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-300">
                    <Clock className="h-3.5 w-3.5" /> closed (genesis cap not yet filled)
                  </span>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}
        {!isConnected && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Connect a wallet to start mining</AlertTitle>
            <AlertDescription>Your address is part of the PoW hash — that's how anti-MEV works.</AlertDescription>
          </Alert>
        )}
        {gpuError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>GPU disabled</AlertTitle>
            <AlertDescription>{gpuError}</AlertDescription>
          </Alert>
        )}

        {/* Engine selectors */}
        <Tabs defaultValue="hybrid" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="cpu"   onClick={() => { setUseCpu(true);  setUseGpu(false); }}>
              <Cpu className="h-4 w-4" /> CPU
            </TabsTrigger>
            <TabsTrigger value="gpu"   onClick={() => { setUseCpu(false); setUseGpu(true);  }}>
              <Zap className="h-4 w-4" /> GPU
            </TabsTrigger>
            <TabsTrigger value="hybrid" onClick={() => { setUseCpu(true);  setUseGpu(true);  }}>
              <ChevronsUpDown className="h-4 w-4" /> Hybrid
            </TabsTrigger>
          </TabsList>

          {/* CPU power */}
          <TabsContent value="cpu" className="space-y-4">
            <CpuControl workers={cpuWorkers} setWorkers={setCpuWorkers} hashrate={cpuHashrate} active={useCpu && running} />
          </TabsContent>
          <TabsContent value="gpu" className="space-y-4">
            <GpuControl power={gpuPower} setPower={setGpuPower} hashrate={gpuHashrate} available={gpuAvailable} status={gpuStatus} active={useGpu && running} />
          </TabsContent>
          <TabsContent value="hybrid" className="space-y-4">
            <CpuControl workers={cpuWorkers} setWorkers={setCpuWorkers} hashrate={cpuHashrate} active={useCpu && running} />
            <Separator />
            <GpuControl power={gpuPower} setPower={setGpuPower} hashrate={gpuHashrate} available={gpuAvailable} status={gpuStatus} active={useGpu && running} />
          </TabsContent>
        </Tabs>

        <Separator />

        {/* Total + actions */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Total hashrate</div>
            <div className="text-3xl font-light tabular text-foreground">
              {formatHashrate(totalRate)}
            </div>
          </div>
          <div className="flex gap-2">
            {!running ? (
              <Button onClick={start} variant="gradient" size="lg" disabled={!canMine}>
                <Play className="h-4 w-4" /> Start Mining
              </Button>
            ) : (
              <Button onClick={stop} variant="destructive" size="lg">
                <Square className="h-4 w-4" /> Stop
              </Button>
            )}
          </div>
        </div>

        {/* Gas preview — what each successful solution costs to submit */}
        {isConnected && estCostEth && baseFeeGwei != null && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-secondary/20 px-4 py-2.5 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Fuel className="h-3.5 w-3.5" />
              <span>Per-solution gas (mainnet)</span>
            </div>
            <div className="flex items-center gap-3 font-mono tabular">
              <span className="text-muted-foreground">{baseFeeGwei} gwei</span>
              <span className="text-foreground">≈ {Number(estCostEth).toFixed(5)} ETH</span>
            </div>
          </div>
        )}

        {/* Solutions */}
        <AnimatePresence>
          {solutions.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <Separator className="mb-4" />
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Hash className="h-3 w-3" /> Recent solutions
                </div>
                {solutions.map((s, i) => (
                  <motion.div
                    key={s.digest + i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between rounded-md border border-border/50 bg-card/50 p-3 text-xs"
                  >
                    <div className="flex items-center gap-2 font-mono">
                      <Badge variant={s.source === 'gpu' ? 'accent' : 'default'}>
                        {s.source === 'gpu' ? <Zap className="h-3 w-3" /> : <Cpu className="h-3 w-3" />}
                        {s.source.toUpperCase()}
                      </Badge>
                      <span className="text-muted-foreground">nonce</span>
                      <span>{s.nonce.toString()}</span>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-muted-foreground font-mono cursor-help">{shortAddr(s.digest, 8)}</span>
                      </TooltipTrigger>
                      <TooltipContent>{s.digest}</TooltipContent>
                    </Tooltip>
                    {txConfirming && i === 0 && <span className="text-amber-400">submitting…</span>}
                    {txSuccess    && i === 0 && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

function CpuControl({ workers, setWorkers, hashrate, active }: { workers: number; setWorkers: (n: number) => void; hashrate: number; active: boolean }) {
  const max = typeof navigator !== 'undefined' ? Math.max(2, Math.min(32, navigator.hardwareConcurrency ?? 8)) : 8;
  return (
    <div className="space-y-3 rounded-lg border border-border/50 bg-secondary/40 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-primary" />
          <div>
            <div className="text-sm font-medium">CPU Workers</div>
            <div className="text-xs text-muted-foreground">Threads dedicated to keccak</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Rate</div>
          <div className={`tabular text-sm font-semibold ${active ? 'text-primary' : 'text-muted-foreground'}`}>
            {formatHashrate(hashrate)}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Slider value={[workers]} min={0} max={max} step={1} onValueChange={(v) => setWorkers(v[0])} />
        <Badge variant="outline" className="font-mono">{workers}/{max}</Badge>
      </div>
    </div>
  );
}

function GpuControl({ power, setPower, hashrate, available, status, active }: { power: number; setPower: (n: number) => void; hashrate: number; available: boolean; status: GpuStatus; active: boolean }) {
  return (
    <div className={`space-y-3 rounded-lg border p-4 ${available ? 'border-border/50 bg-secondary/40' : 'border-amber-500/30 bg-amber-500/5'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-accent" />
          <div>
            <div className="text-sm font-medium">GPU Power {!available && <Badge variant="warning" className="ml-2 text-[10px]">unavailable</Badge>}</div>
            <div className="text-xs text-muted-foreground">Workgroups per dispatch (each = 64 threads × 32 nonces)</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Rate</div>
          <div className={`tabular text-sm font-semibold ${active ? 'text-accent' : 'text-muted-foreground'}`}>
            {formatHashrate(hashrate)}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Slider value={[power]} min={1} max={1024} step={1} disabled={!available} onValueChange={(v) => setPower(v[0])} />
        <Badge variant="outline" className="font-mono">{power}</Badge>
      </div>
      {!available && (
        <p className="text-xs text-amber-300/80">
          {status === 'no-webgpu' && (
            <>This browser has no WebGPU. Use desktop Chrome 113+ / Edge 113+, or Safari 18+ on macOS 15 (Sequoia) / iOS 18. Mobile Chrome supports it on Android 14+ (Chrome 121+).</>
          )}
          {status === 'no-adapter' && (
            <>WebGPU is present but no compatible GPU adapter is available — usually missing or outdated graphics drivers, or WebGPU disabled in <code className="font-mono text-[11px]">chrome://flags</code>. CPU mining still works.</>
          )}
          {status === 'error' && (
            <>WebGPU initialisation failed. Check the browser console; CPU mining still works.</>
          )}
          {(status === 'unprobed' || status === 'no-navigator') && (
            <>Probing WebGPU… if this persists, your browser does not expose <code className="font-mono text-[11px]">navigator.gpu</code>. Try desktop Chrome 113+ / Safari 18+.</>
          )}
        </p>
      )}
    </div>
  );
}
