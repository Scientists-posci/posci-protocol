import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Hero } from '@/components/feature/hero';
import { MiningStats } from '@/components/feature/mining-stats';
import { Button } from '@/components/ui/button';

const pillars = [
  {
    n: '01',
    title: 'No admin keys',
    body: 'There is no `mint`, no `pause`, no `owner`, no upgrade proxy. The deployer can do exactly what every other holder can.',
  },
  {
    n: '02',
    title: 'LP burned atomically',
    body: 'The same transaction that fills the 0.5 ETH genesis cap also creates the V4 pool, mints LP, and burns the NFT to 0xdEaD.',
  },
  {
    n: '03',
    title: 'No MEV theft',
    body: 'Your address is in the PoW hash. Copying a competitor\'s nonce produces a different digest — there\'s nothing to steal.',
  },
  {
    n: '04',
    title: 'CPU + GPU mining',
    body: 'Mine in your browser with Web Workers (CPU) or WebGPU compute shaders (GPU). Hashrate scales with the slider.',
  },
  {
    n: '05',
    title: 'Bitcoin-style schedule',
    body: '1,000 POSCI per solution, halving every 10,000 solutions, difficulty retarget every 1,024 toward 60s/solution.',
  },
  {
    n: '06',
    title: 'Fair distribution',
    body: 'Deployer 2.4%, genesis 1.2%, initial LP 1.2% (burned), mining 95.2%. No team unlock. No VC bag.',
  },
];

export default function Home() {
  return (
    <>
      <Hero />

      {/* Network telemetry — editorial spec sheet */}
      <section className="container py-20 md:py-32 border-t border-border">
        <div className="flex items-end justify-between flex-wrap gap-6 mb-12">
          <div>
            <div className="eyebrow mb-3">Network · live</div>
            <h2 className="display text-4xl md:text-5xl">Telemetry</h2>
          </div>
          <Button asChild variant="outline" size="default">
            <Link href="/stats">Open dashboard <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
        <MiningStats />
      </section>

      {/* Six pillars — numbered editorial blocks */}
      <section className="container py-20 md:py-32 border-t border-border">
        <div className="mb-12 max-w-2xl">
          <div className="eyebrow mb-3">Principles</div>
          <h2 className="display text-4xl md:text-5xl">Six things this is.</h2>
          <p className="mt-6 text-muted-foreground">
            Every line below maps to code in <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">/src</code>. Audit it before you trust it.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-t border-l border-border">
          {pillars.map((p) => (
            <div
              key={p.n}
              className="border-r border-b border-border p-8 md:p-10 hover:bg-foreground/[0.02] transition-colors"
            >
              <div className="eyebrow mb-6">{p.n}</div>
              <h3 className="text-xl md:text-2xl font-light tracking-tight mb-4">{p.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA strip */}
      <section className="container py-20 md:py-32 border-t border-border text-center">
        <h2 className="display text-4xl md:text-6xl max-w-3xl mx-auto">
          Read the code. <span className="text-muted-foreground">Then mine.</span>
        </h2>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/mine">Start mining <ArrowRight className="h-4 w-4" /></Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/stats">View status</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
