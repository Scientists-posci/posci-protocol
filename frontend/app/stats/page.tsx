import { PriceCard }       from '@/components/feature/price-card';
import { PoolStats }        from '@/components/feature/pool-stats';
import { NetworkStats }     from '@/components/feature/network-stats';
import { LiveMiningFeed }   from '@/components/feature/live-mining-feed';
import { GenesisActivity }  from '@/components/feature/genesis-activity';
import { Leaderboard }      from '@/components/feature/leaderboard';
import { SystemHealth }     from '@/components/feature/system-health';

export const metadata = {
  title: 'Network Status — POSCI',
  description: 'Live POSCI network state: price, pool reserves, mining difficulty, latest blocks, system health.',
};

export default function StatsPage() {
  return (
    <section className="container py-10 md:py-14 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Network Status
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Everything below is read directly from Ethereum mainnet — no backend, no cache layer. Refreshes on a 12-second interval and live-streams new mining and genesis events.
        </p>
      </header>

      {/* Top row: price + pool TVL — what people glance at first */}
      <div className="grid md:grid-cols-2 gap-4">
        <PriceCard />
        <PoolStats />
      </div>

      {/* Network mining state */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Mining Network</h2>
        <NetworkStats />
      </section>

      {/* Live activity */}
      <section className="grid lg:grid-cols-2 gap-4">
        <LiveMiningFeed />
        <GenesisActivity />
      </section>

      {/* Top miners leaderboard */}
      <Leaderboard />

      {/* Health checklist + contract directory */}
      <SystemHealth />
    </section>
  );
}
