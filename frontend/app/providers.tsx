'use client';

import * as React from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';

import { wagmiConfig } from '@/lib/wagmi-config';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 12_000, refetchOnWindowFocus: false } },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: 'hsl(217 91% 60%)',
            accentColorForeground: 'white',
            borderRadius: 'large',
            fontStack: 'system',
            overlayBlur: 'small',
          })}
          modalSize="compact"
        >
          <TooltipProvider delayDuration={150}>
            {children}
            <Toaster
              theme="dark"
              richColors
              position="top-right"
              toastOptions={{
                style: {
                  background: 'hsl(222 47% 7% / 0.92)',
                  border: '1px solid hsl(217 33% 18%)',
                  backdropFilter: 'blur(16px)',
                },
              }}
            />
          </TooltipProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
