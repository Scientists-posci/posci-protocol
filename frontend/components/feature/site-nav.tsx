'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Atom, Pickaxe, Rocket, Activity, Github } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { XLogo } from './x-icon';
import { PosciLogo } from './posci-logo';

const links = [
  { href: '/',        label: 'Home',    icon: Atom },
  { href: '/mine',    label: 'Mine',    icon: Pickaxe },
  { href: '/genesis', label: 'Genesis', icon: Rocket },
  { href: '/stats',   label: 'Status',  icon: Activity },
];

const X_HANDLE_URL = 'https://x.com/scientistsdapp';
const GITHUB_URL = 'https://github.com/Scientists-posci/posci-miner';

export function SiteNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/55 backdrop-blur-2xl">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group text-foreground">
          <PosciLogo size={32} className="text-foreground transition-opacity group-hover:opacity-80" />
          <div className="flex flex-col leading-none">
            <span className="font-medium tracking-tight text-sm">POSCI</span>
            <span className="eyebrow text-[9px] mt-0.5">Proof of Scientist</span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
                {active && (
                  <motion.div
                    layoutId="nav-underline"
                    className="absolute inset-x-2 -bottom-0.5 h-px bg-foreground"
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                  />
                )}
              </Link>
            );
          })}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="POSCI CLI miner on GitHub"
            className="flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
          >
            <Github className="h-4 w-4" />
          </a>
          <a
            href={X_HANDLE_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="POSCI on X"
            className="flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
          >
            <XLogo size={14} />
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={X_HANDLE_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="POSCI on X"
            className="md:hidden flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
          >
            <XLogo size={14} />
          </a>
          <ConnectButton showBalance={false} chainStatus="icon" accountStatus={{ smallScreen: 'avatar', largeScreen: 'full' }} />
        </div>
      </div>
    </header>
  );
}
