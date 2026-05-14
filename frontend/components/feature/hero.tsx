'use client';

import Link from 'next/link';
import { ArrowRight, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HeroOrb } from './hero-orb';

const stats = [
  { k: 'Total supply',     v: '21,000,000', sub: 'POSCI · fixed forever' },
  { k: 'Mined fraction',   v: '95.24%',     sub: 'distributed via PoW'   },
  { k: 'Owner / admin',    v: 'None',       sub: 'no privileged caller'  },
  { k: 'Network',          v: 'Ethereum',   sub: 'Uniswap V4 · LP burned' },
];

export function Hero() {
  return (
    <section className="relative">
      {/* Eyebrow strip */}
      <div className="container">
        <div className="border-b border-border/60 pt-5 pb-3 flex items-center justify-between text-xs">
          <span className="eyebrow">Ethereum mainnet · Layer 1</span>
          <span className="eyebrow flex items-center gap-2">
            <span className="live-dot" /> Live
          </span>
        </div>
      </div>

      {/* The cinematic hero. Full viewport height-ish, centered text over the orb. */}
      <div className="relative isolate overflow-hidden">
        {/* Background orb, centered, behind text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <HeroOrb size={720} />
        </div>

        {/* Faint film grain on top of the orb composition */}
        <div className="absolute inset-0 grain pointer-events-none" />

        {/* Centered content */}
        <div className="relative container pt-28 pb-32 md:pt-40 md:pb-48 min-h-[78vh] flex flex-col items-center justify-center text-center">
          <div className="max-w-5xl animate-[heroIn_900ms_cubic-bezier(0.16,1,0.3,1)_both]">
            <div className="eyebrow mb-7">
              Proof of Scientist · POSCI
            </div>

            <h1 className="display text-6xl sm:text-7xl md:text-[8.5rem] lg:text-[10rem]">
              Mine the chain.
            </h1>

            <p className="mt-9 max-w-2xl mx-auto text-base md:text-lg text-muted-foreground leading-relaxed">
              A 21,000,000-cap, owner-less, PoW-mined ERC20 on Ethereum mainnet.
              95% of supply is mined, not sold. The hash includes your address —
              there is nothing in the mempool to steal.
            </p>

            <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="group min-w-[200px]">
                <Link href="/mine">
                  Start mining <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="min-w-[200px]">
                <Link href="/genesis">Buy genesis</Link>
              </Button>
            </div>
          </div>

          {/* Scroll-cue arrow */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-muted-foreground opacity-60 animate-[scrollHint_2s_ease-in-out_infinite]">
            <ArrowDown className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Tech-spec stats strip — full-bleed editorial */}
      <div
        className="border-t border-border bg-background/40 backdrop-blur-xl animate-[heroIn_700ms_ease-out_400ms_both]"
      >
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4">
            {stats.map((s, i) => (
              <div
                key={s.k}
                className={`py-8 px-1 md:px-7 ${i > 0 ? 'md:border-l border-border/60' : ''}`}
              >
                <div className="eyebrow mb-3">{s.k}</div>
                <div className="text-2xl md:text-3xl font-light tracking-tight tabular">{s.v}</div>
                <div className="text-xs text-muted-foreground mt-2">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
