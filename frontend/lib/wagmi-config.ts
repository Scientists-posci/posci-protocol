import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet } from 'wagmi/chains';
import { http, fallback } from 'wagmi';

const wcProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? 'posci-fallback';

// Alchemy is fast and reliable for `eth_call` / `eth_getBalance` etc, but its
// FREE tier caps `eth_getLogs` at a 10-block range. The activity feed,
// leaderboard, and bootstrap-event readers all need much wider ranges. Fall
// back to publicnode (no key, no range limit) when Alchemy rejects a call.
const primaryRpc = process.env.NEXT_PUBLIC_RPC_URL || 'https://eth-mainnet.public.blastapi.io';
const fallbackRpc = 'https://ethereum-rpc.publicnode.com';

export const wagmiConfig = getDefaultConfig({
  appName: 'POSCI — Proof of Scientist',
  projectId: wcProjectId,
  chains: [mainnet],
  transports: {
    [mainnet.id]: fallback([
      http(primaryRpc),
      http(fallbackRpc),
    ]),
  },
  ssr: true,
});
