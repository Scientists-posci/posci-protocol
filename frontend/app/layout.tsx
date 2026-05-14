import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Providers } from './providers';
import { SiteNav } from '@/components/feature/site-nav';
import { SiteFooter } from '@/components/feature/site-footer';
import { OrbitalBg } from '@/components/feature/orbital-bg';
import './globals.css';

// Self-hosted via next/font — no FOIT, no external CDN, optimal subsetting.
// Inter at 100-700 unlocks the design system's `font-weight: 200` display
// look + the cv11/ss01/ss03/ss04 OpenType features already in globals.css.
const inter = Inter({
  subsets:  ['latin', 'latin-ext'],
  display:  'swap',
  variable: '--font-sans',
  weight:   ['200', '300', '400', '500', '600', '700'],
});

// JetBrains Mono for numbers, addresses, and any .font-mono / .tabular cell.
// Built-in tabular figures, friendly slashed-zero, excellent at small sizes.
const jbmono = JetBrains_Mono({
  subsets:  ['latin'],
  display:  'swap',
  variable: '--font-mono',
  weight:   ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'POSCI — Proof of Scientist',
  description:
    'Fair-launch, owner-less, PoW-mined ERC20 on Ethereum. 21M cap, LP burned, mine in your browser with CPU or WebGPU.',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'https://posci.vercel.app')
  ),
  openGraph: {
    title: 'POSCI — Proof of Scientist',
    description: 'Fair-launch PoW token on Ethereum. Mine it in your browser.',
    type: 'website',
    siteName: 'POSCI',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@scientistsdapp',
    creator: '@scientistsdapp',
    title: 'POSCI — Proof of Scientist',
    description: '21M cap, owner-less, PoW-mined ERC20 on Ethereum. Mine in your browser.',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a1233',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jbmono.variable}`}>
      <body className="min-h-screen relative overflow-x-hidden font-sans">
        <OrbitalBg />
        <Providers>
          <SiteNav />
          <main className="relative z-10">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
