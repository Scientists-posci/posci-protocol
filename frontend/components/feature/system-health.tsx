'use client';

import { useReadContracts } from 'wagmi';
import { ShieldCheck, ShieldAlert, Lock, Pickaxe, Rocket, Atom, Skull, ExternalLink, Check, Loader2, Flame } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TOKEN_ABI, TOKEN_ADDRESS, MINING_ABI, MINING_ADDRESS, GENESIS_ABI, GENESIS_ADDRESS } from '@/lib/contracts';
import { usePoolState } from '@/lib/hooks';
import { shortAddr } from '@/lib/utils';

const NOT_DEPLOYED = '0x0000000000000000000000000000000000000000';
const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD' as const;
const MINING_EMISSION_CAP = 20_000_000n * 10n ** 18n;

export function SystemHealth() {
  const ready = TOKEN_ADDRESS !== NOT_DEPLOYED && MINING_ADDRESS !== NOT_DEPLOYED && GENESIS_ADDRESS !== NOT_DEPLOYED;

  const { data: chain } = useReadContracts({
    contracts: [
      { address: TOKEN_ADDRESS,   abi: TOKEN_ABI,   functionName: 'totalSupply' },
      { address: MINING_ADDRESS,  abi: MINING_ABI,  functionName: 'bindingRenounced' },
      { address: MINING_ADDRESS,  abi: MINING_ABI,  functionName: 'genesis' },
      { address: MINING_ADDRESS,  abi: MINING_ABI,  functionName: 'poolGateOpen' },
      { address: MINING_ADDRESS,  abi: MINING_ABI,  functionName: 'miningStartTime' },
      { address: GENESIS_ADDRESS, abi: GENESIS_ABI, functionName: 'bootstrapped' },
      { address: TOKEN_ADDRESS,   abi: TOKEN_ABI,   functionName: 'balanceOf', args: [DEAD_ADDRESS] },
      { address: TOKEN_ADDRESS,   abi: TOKEN_ABI,   functionName: 'balanceOf', args: [MINING_ADDRESS] },
      { address: MINING_ADDRESS,  abi: MINING_ABI,  functionName: 'tokensMinted' },
    ],
    query: { refetchInterval: 30_000, enabled: ready },
  });

  const { data: pool } = usePoolState();

  const totalSupply      = (chain?.[0]?.result as bigint | undefined) ?? 0n;
  const bindingRenounced = (chain?.[1]?.result as boolean | undefined) ?? false;
  const boundGenesis     = (chain?.[2]?.result as `0x${string}` | undefined) ?? NOT_DEPLOYED;
  const poolGateOpen     = (chain?.[3]?.result as boolean | undefined) ?? false;
  const miningStart      = (chain?.[4]?.result as bigint | undefined) ?? 0n;
  const bootstrapped     = (chain?.[5]?.result as boolean | undefined) ?? false;
  const deadBalance      = (chain?.[6]?.result as bigint | undefined) ?? 0n;
  const miningBalance    = (chain?.[7]?.result as bigint | undefined) ?? 0n;
  const tokensMinted     = (chain?.[8]?.result as bigint | undefined) ?? 0n;

  // POSCI that can never circulate:
  //  (a) explicit burns to 0xdEaD (e.g., Genesis forceBootstrap leftover)
  //  (b) the unreachable buffer in mining contract = balance - (cap - emitted so far)
  //      (cap = 20M; deploy sends 20.5M; the 500K excess is past the emission ceiling)
  const miningEmissionRemaining = MINING_EMISSION_CAP > tokensMinted
    ? MINING_EMISSION_CAP - tokensMinted
    : 0n;
  const miningStranded = miningBalance > miningEmissionRemaining
    ? miningBalance - miningEmissionRemaining
    : 0n;
  const totalBurned = deadBalance + miningStranded;

  const checks = [
    {
      ok:    totalSupply === 21_000_000n * 10n ** 18n,
      icon:  Atom,
      title: 'Token deployed (21M cap)',
      hint:  ready ? `total supply ${(Number(totalSupply) / 1e18).toLocaleString()} POSCI` : 'addresses not configured',
    },
    {
      ok:    bindingRenounced,
      icon:  Lock,
      title: 'Mining binding renounced',
      hint:  bindingRenounced ? 'no admin can re-bind genesis' : 'still bindable — deploy not finalized',
    },
    {
      ok:    boundGenesis.toLowerCase() === GENESIS_ADDRESS.toLowerCase() && boundGenesis !== NOT_DEPLOYED,
      icon:  Rocket,
      title: 'Genesis ↔ Mining wired',
      hint:  `bound to ${shortAddr(boundGenesis, 5)}`,
    },
    {
      ok:    Date.now() / 1000 >= Number(miningStart) && miningStart > 0n,
      icon:  Pickaxe,
      title: 'Time gate (T-lock)',
      hint:  miningStart > 0n
        ? Date.now() / 1000 >= Number(miningStart)
          ? `opened ${new Date(Number(miningStart) * 1000).toLocaleString()}`
          : `opens at ${new Date(Number(miningStart) * 1000).toLocaleString()}`
        : '—',
    },
    {
      ok:    bootstrapped && poolGateOpen,
      icon:  Pickaxe,
      title: 'Pool gate (genesis-flipped)',
      hint:  poolGateOpen ? 'open — mining is live' : bootstrapped ? 'bootstrap done, awaiting flip' : 'genesis cap not yet filled',
    },
    {
      ok:    pool?.initialized ?? false,
      icon:  Skull,
      title: 'V4 pool initialized + LP burned',
      hint:  pool?.initialized
        ? `${(Number(pool.ethReserve) / 1e18).toFixed(4)} ETH reserve`
        : 'awaiting bootstrap',
    },
    {
      ok:    true,
      icon:  Flame,
      title: 'POSCI permanently burned',
      hint:  `${(Number(totalBurned) / 1e18).toLocaleString()} POSCI (founder reserve + any genesis leftover) → unreachable forever`,
    },
  ];

  const allOk = checks.every((c) => c.ok);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              {allOk ? <ShieldCheck className="h-4 w-4 text-emerald-400" /> : <ShieldAlert className="h-4 w-4 text-amber-400" />}
              System Health
            </CardTitle>
            <CardDescription>End-to-end invariants — all on-chain, no backend.</CardDescription>
          </div>
          <Badge variant={allOk ? 'success' : 'warning'}>{allOk ? 'all green' : 'in progress'}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {!ready && (
          <div className="text-xs text-muted-foreground py-2">
            Contracts not configured. Set <code className="font-mono">NEXT_PUBLIC_*_ADDRESS</code> env vars after deploying.
          </div>
        )}
        {ready && !chain
          ? Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)
          : checks.map(({ ok, icon: Icon, title, hint }) => (
            <div key={title} className="flex items-center gap-3 rounded-md border border-border/30 bg-secondary/20 p-2.5">
              <div className={`grid place-items-center h-7 w-7 rounded-md ${ok ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium leading-tight">{title}</div>
                <div className="text-xs text-muted-foreground truncate">{hint}</div>
              </div>
              <Badge variant={ok ? 'success' : 'warning'} className="shrink-0 px-1.5">
                {ok ? <Check className="h-3 w-3" /> : <Loader2 className="h-3 w-3 animate-spin" />}
              </Badge>
            </div>
          ))}

        {ready && (
          <div className="pt-3 border-t border-border/30 space-y-1.5 text-xs">
            <ContractRow label="POSCIToken"   addr={TOKEN_ADDRESS} />
            <ContractRow label="POSCIMining"  addr={MINING_ADDRESS} />
            <ContractRow label="POSCIGenesis" addr={GENESIS_ADDRESS} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ContractRow({ label, addr }: { label: string; addr: string }) {
  return (
    <a
      href={`https://etherscan.io/address/${addr}`}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-secondary/40 transition-colors group"
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-foreground/80 group-hover:text-accent flex items-center gap-1">
        {shortAddr(addr, 5)} <ExternalLink className="h-3 w-3" />
      </span>
    </a>
  );
}
