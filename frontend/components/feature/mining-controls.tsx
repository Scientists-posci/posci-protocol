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

type GasTier = 'standard' | 'fast' | 'aggressive' | 'custom';

const GAS_TIER_LABELS: Record<GasTier, string> = {
  standard:   'Standard',
  fast:       'Fast',
  aggressive: 'Turbo',
  custom:     'Custom',
};

// Convert a base EIP-1559 fee suggestion to the actual fees this tx will
// pay, scaled by the user's chosen tier. Returns undefined if the network
// estimate isn't loaded yet (caller falls back to wallet defaults).
function feesForTier(
  tier: GasTier,
  baseMaxFee: bigint | undefined,
  basePriority: bigint | undefined,
  customPriorityGwei: string,
  customMaxGwei: string,
): { maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint } | undefined {
  if (tier === 'custom') {
    const p = customPriorityGwei.trim();
    const m = customMaxGwei.trim();
    if (!p && !m) return undefined; // no overrides → wallet defaults
    const out: { maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint } = {};
    if (p) out.maxPriorityFeePerGas = BigInt(Math.round(parseFloat(p) * 1e9));
    if (m) out.maxFeePerGas = BigInt(Math.round(parseFloat(m) * 1e9));
    return out;
  }
  if (!baseMaxFee || !basePriority) return undefined;
  // Tier multipliers chosen so each step ~doubles inclusion priority:
  //   standard   = network suggestion (no override needed but explicit)
  //   fast       = 2× priority, 1.5× max
  //   aggressive = 4× priority, 2× max
  const mult = tier === 'standard' ? { p: 1, m: 1 }
             : tier === 'fast'     ? { p: 2, m: 1.5 }
             : /* aggressive */      { p: 4, m: 2 };
  return {
    maxPriorityFeePerGas: (basePriority * BigInt(Math.round(mult.p * 1000))) / 1000n,
    maxFeePerGas:         (baseMaxFee   * BigInt(Math.round(mult.m * 1000))) / 1000n,
  };
}

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
  const [minedThisSession, setMinedThisSession] = useState(0);
  const [gasTier, setGasTier] = useState<'standard' | 'fast' | 'aggressive' | 'custom'>('fast');
  const [customPriorityGwei, setCustomPriorityGwei] = useState('');
  const [customMaxGwei, setCustomMaxGwei] = useState('');
  const submitting = useRef(false);
  // After a tx is broadcast, hits found on the still-stale on-chain
  // challenge would auto-submit and revert — burning gas. We hold the gate
  // closed until the polled challenge actually rotates and the workers are
  // hot-swapped to the new job.
  const awaitingRotation = useRef(false);
  const prevChallenge = useRef<Hex | undefined>(undefined);

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
  const { isLoading: txConfirming, isSuccess: receiptAvailable, data: receipt } = useWaitForTransactionReceipt({ hash: txHash });
  const txConfirmed = receiptAvailable && receipt?.status === 'success';
  const txReverted  = receiptAvailable && receipt?.status === 'reverted';

  // Mirror the React state the (closure-captured) 'hit' handler needs.
  // Without this, the handler — registered once in a useEffect([]) — would
  // forever see the initial render's undefined challenge/target and ignore
  // every hit.
  const handlerStateRef = useRef({
    challenge, target,
    gasTier, customPriorityGwei, customMaxGwei,
    feeData,
  });
  handlerStateRef.current = {
    challenge, target,
    gasTier, customPriorityGwei, customMaxGwei,
    feeData,
  };

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
      // Two gates for auto-submit:
      //  1. submitting — a tx is currently being signed/broadcast.
      //  2. awaitingRotation — a tx was broadcast, but the on-chain challenge
      //     hasn't rotated yet. Hits found in this window are on a stale
      //     challenge and would revert with WrongDigest (burning gas).
      if (submitting.current || awaitingRotation.current) return;
      const live = handlerStateRef.current;
      if (!live.challenge || !live.target) return;
      submitting.current = true;
      try {
        const fees = feesForTier(
          live.gasTier,
          live.feeData?.maxFeePerGas,
          live.feeData?.maxPriorityFeePerGas,
          live.customPriorityGwei,
          live.customMaxGwei,
        );
        await writeContractAsync({
          address: MINING_ADDRESS,
          abi: MINING_ABI,
          functionName: 'mine',
          args: [h.nonce, h.digest],
          // Explicit cap so wallets don't pad on top of their own inflated
          // estimateGas. Actual usage is ~110–180k; 240k is the headroom
          // we need for first-mine + retarget edge cases.
          gas: MINE_GAS_LIMIT,
          ...(fees ?? {}),
        });
        toast.success('Solution submitted', {
          description: `${h.source.toUpperCase()} hit · waiting for confirmation, mining continues…`,
        });
        // Don't stop the manager — workers keep hashing. We just close the
        // gate until the challenge rotates so we don't ship a stale tx.
        awaitingRotation.current = true;
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

  // ── tx receipt → session counter & rapid re-poll ──────────────────────
  // Receipt.status === 'success' means our mine() landed. We bump the
  // session counter and refetch the chain immediately so the rotation
  // effect below can hot-swap workers without waiting up to 6s for the
  // next poll tick.
  useEffect(() => {
    if (txConfirmed) {
      setMinedThisSession((n) => n + 1);
      toast.success('Block mined!', { description: 'Reward credited. Switching to the new challenge…' });
      refetch();
    } else if (txReverted) {
      toast.error('Submission reverted', {
        description: 'Likely beaten to the block by another miner. Re-opening for the next challenge.',
      });
      // Don't wait for rotation — let the worker submit on the next hit
      // (which will be on whatever the current challenge is).
      awaitingRotation.current = false;
      refetch();
    }
  }, [txConfirmed, txReverted, refetch]);

  // ── challenge rotation → hot-swap manager job ─────────────────────────
  // When the on-chain challenge advances (either our tx landed, or someone
  // else's did), tell the manager to retarget every worker at the new
  // challenge / new mining target. Without this the workers keep hashing
  // the stale challenge and produce solutions that revert.
  useEffect(() => {
    if (!running || !challenge || !target || !address) {
      prevChallenge.current = challenge;
      return;
    }
    if (prevChallenge.current && prevChallenge.current !== challenge) {
      manager.setJob(challenge, address, target).catch((e) => {
        console.warn('[posci] hot-swap challenge failed:', e);
      });
      awaitingRotation.current = false;
    }
    prevChallenge.current = challenge;
  }, [challenge, target, running, address, manager]);

  async function start() {
    if (!canMine || !address || !challenge || !target) {
      toast.error('Not ready', { description: 'Connect wallet and wait for both gates to open.' });
      return;
    }
    setSolutions([]);
    setMinedThisSession(0);
    setGpuError(null);
    submitting.current = false;
    awaitingRotation.current = false;
    prevChallenge.current = challenge;
    try {
      const r = await manager.start(challenge, address, target, useCpu, useGpu && gpuAvailable);
      setRunning(r.cpuStarted || r.gpuStarted);
      if (r.gpuFellBackToCpu) {
        const reason = manager.getGpuError() ?? 'GPU initialisation failed';
        setGpuError(reason);
        toast.warning('GPU unavailable — using CPU instead', {
          description: reason,
        });
      } else if (useGpu && gpuAvailable && !r.gpuStarted) {
        const reason = manager.getGpuError() ?? 'GPU initialisation failed';
        setGpuError(reason);
        toast.error('GPU disabled', { description: reason });
      }
    } catch (e: any) {
      setGpuError(e?.message ?? 'Mining failed to start');
      toast.error('Failed to start', { description: e?.message ?? 'unknown error' });
    }
  }

  function stop() {
    manager.stop();
    setRunning(false);
    submitting.current = false;
    awaitingRotation.current = false;
  }

  const totalRate = cpuHashrate + gpuHashrate;

  // Effective fees for the currently-selected tier. ~150k is the typical
  // actual gas used per mine() (240k limit only caps wallet padding; base
  // fee is billed on gas used, not the limit).
  const tierFees = feesForTier(
    gasTier,
    feeData?.maxFeePerGas,
    feeData?.maxPriorityFeePerGas,
    customPriorityGwei,
    customMaxGwei,
  );
  const effectiveMax  = tierFees?.maxFeePerGas         ?? feeData?.maxFeePerGas;
  const effectivePrio = tierFees?.maxPriorityFeePerGas ?? feeData?.maxPriorityFeePerGas;
  const estCostEth    = effectiveMax ? formatEther(effectiveMax * 150_000n) : null;
  const tipGwei       = effectivePrio ? Number(effectivePrio) / 1e9 : null;
  const maxGwei       = effectiveMax  ? Number(effectiveMax)  / 1e9 : null;

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
            <GpuControl power={gpuPower} setPower={setGpuPower} hashrate={gpuHashrate} available={gpuAvailable} status={gpuStatus} initError={gpuError} active={useGpu && running} />
          </TabsContent>
          <TabsContent value="hybrid" className="space-y-4">
            <CpuControl workers={cpuWorkers} setWorkers={setCpuWorkers} hashrate={cpuHashrate} active={useCpu && running} />
            <Separator />
            <GpuControl power={gpuPower} setPower={setGpuPower} hashrate={gpuHashrate} available={gpuAvailable} status={gpuStatus} initError={gpuError} active={useGpu && running} />
          </TabsContent>
        </Tabs>

        <Separator />

        {/* Total + actions */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-baseline gap-6">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Total hashrate</div>
              <div className="text-3xl font-light tabular text-foreground">
                {formatHashrate(totalRate)}
              </div>
            </div>
            {running && (
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Mined this session</div>
                <div className="text-3xl font-light tabular text-accent">{minedThisSession}</div>
              </div>
            )}
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

        {/* Gas tier — let users pay more to avoid getting beaten / stuck */}
        {isConnected && (
          <div className="space-y-2 rounded-md border border-border/50 bg-secondary/20 px-4 py-3">
            <div className="flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Fuel className="h-3.5 w-3.5" />
                <span>Gas tier · per-solution cost</span>
              </div>
              <div className="font-mono tabular text-foreground">
                {estCostEth ? `≈ ${Number(estCostEth).toFixed(5)} ETH` : '— ETH'}
                {tipGwei != null && maxGwei != null && (
                  <span className="ml-2 text-muted-foreground">({tipGwei.toFixed(2)}/{maxGwei.toFixed(2)} gwei tip/max)</span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {(['standard','fast','aggressive','custom'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setGasTier(t)}
                  className={`rounded px-2 py-1.5 text-xs font-medium border transition-colors ${
                    gasTier === t
                      ? 'border-accent/60 bg-accent/15 text-accent'
                      : 'border-border/60 bg-card/40 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {GAS_TIER_LABELS[t]}
                </button>
              ))}
            </div>
            {gasTier === 'custom' && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  Priority tip (gwei)
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.1"
                    placeholder="2"
                    value={customPriorityGwei}
                    onChange={(e) => setCustomPriorityGwei(e.target.value)}
                    className="rounded border border-border/60 bg-card/60 px-2 py-1 font-mono tabular text-sm text-foreground focus:outline-none focus:border-accent/60"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  Max fee (gwei)
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.1"
                    placeholder="auto"
                    value={customMaxGwei}
                    onChange={(e) => setCustomMaxGwei(e.target.value)}
                    className="rounded border border-border/60 bg-card/60 px-2 py-1 font-mono tabular text-sm text-foreground focus:outline-none focus:border-accent/60"
                  />
                </label>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Mining is a race — higher tip = first inclusion. Pick Turbo if you keep losing blocks to other miners. Max fee caps what you'll ever pay per gas; you only spend the actual base fee + tip.
            </p>
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
                    {txConfirmed  && i === 0 && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
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

function GpuControl({ power, setPower, hashrate, available, status, initError, active }: { power: number; setPower: (n: number) => void; hashrate: number; available: boolean; status: GpuStatus; initError: string | null; active: boolean }) {
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
          {status === 'init-failed' && (
            <>
              GPU shader self-test failed on this device — typically integrated
              graphics where the WGSL kernel mis-compiles. CPU mining was
              started automatically.
              {initError && (
                <span className="block mt-1 font-mono text-[11px] text-amber-400/70">{initError}</span>
              )}
            </>
          )}
          {(status === 'unprobed' || status === 'no-navigator') && (
            <>Probing WebGPU… if this persists, your browser does not expose <code className="font-mono text-[11px]">navigator.gpu</code>. Try desktop Chrome 113+ / Safari 18+.</>
          )}
        </p>
      )}
    </div>
  );
}
