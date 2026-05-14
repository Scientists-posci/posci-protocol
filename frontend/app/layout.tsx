import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';
import { SiteNav } from '@/components/feature/site-nav';
import { SiteFooter } from '@/components/feature/site-footer';
import { OrbitalBg } from '@/components/feature/orbital-bg';
import './globals.css';

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
    <html lang="en" className="dark">
      <body className="min-h-screen relative overflow-x-hidden">
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
