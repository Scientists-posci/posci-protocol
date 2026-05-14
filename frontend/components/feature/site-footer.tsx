import Link from 'next/link';
import { FileCode2, ExternalLink, Github, Terminal } from 'lucide-react';
import { XLogo } from './x-icon';
import { PosciLogo } from './posci-logo';

const X_HANDLE_URL = 'https://x.com/scientistsdapp';
const X_HANDLE = '@scientistsdapp';
const GITHUB_URL = 'https://github.com/Scientists-posci/posci-miner';

export function SiteFooter() {
  return (
    <footer className="relative z-10 mt-24 border-t border-border bg-background">
      <div className="container py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
          <div className="space-y-3">
            <Link href="/" className="flex items-center gap-3 text-foreground">
              <PosciLogo size={28} className="text-foreground" />
              <span className="font-medium tracking-tight">POSCI</span>
            </Link>
            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
              A 21,000,000-cap, owner-less, PoW-mined ERC20 on Ethereum. Mine in your browser. Audit the code.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Protocol</h4>
            <ul className="space-y-1.5 text-sm">
              <li><Link href="/mine"    className="text-muted-foreground hover:text-foreground transition-colors">Mining</Link></li>
              <li><Link href="/genesis" className="text-muted-foreground hover:text-foreground transition-colors">Genesis sale</Link></li>
              <li><Link href="/stats"   className="text-muted-foreground hover:text-foreground transition-colors">Network status</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Community</h4>
            <ul className="space-y-1.5 text-sm">
              <li>
                <a
                  href={X_HANDLE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group"
                >
                  <XLogo size={12} className="opacity-70 group-hover:opacity-100" /> {X_HANDLE} on X
                </a>
              </li>
              <li>
                <a
                  href="https://etherscan.io"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="h-3 w-3 opacity-70" /> Etherscan
                </a>
              </li>
              <li>
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Github className="h-3 w-3 opacity-70" /> CLI miner on GitHub
                </a>
              </li>
              <li>
                <a
                  href={`${GITHUB_URL}#installation`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Terminal className="h-3 w-3 opacity-70" /> npm i -g posci-miner
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border/30 flex items-center justify-between flex-wrap gap-3 text-xs text-muted-foreground">
          <div>POSCI is open-source. The protocol has no owner, no admin, no upgrade path.</div>
          <div>Not financial advice. DYOR.</div>
        </div>
      </div>
    </footer>
  );
}
