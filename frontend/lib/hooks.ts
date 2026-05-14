'use client';

import { useEffect, useState } from 'react';
import { usePublicClient } from 'wagmi';
import type { Address } from 'viem';

import { TOKEN_ADDRESS } from './contracts';
import { readPool, reservesFromLiquidity, type PoolReadout } from './v4-state';

/** Live POSCI/ETH pool data, refreshed every `intervalMs` (default 12s). */
export function usePoolState(intervalMs = 12_000) {
  const client = usePublicClient();
  const [data, setData] = useState<PoolReadout & { ethReserve: bigint; posciReserve: bigint } | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!client || TOKEN_ADDRESS === '0x0000000000000000000000000000000000000000') {
      setLoading(false);
      return;
    }
    let stopped = false;

    const tick = async () => {
      try {
        const pool = await readPool(client as any, TOKEN_ADDRESS as Address);
        const { eth, posci } = reservesFromLiquidity(pool.sqrtPriceX96, pool.liquidity);
        if (!stopped) {
          setData({ ...pool, ethReserve: eth, posciReserve: posci });
          setError(null);
          setLoading(false);
        }
      } catch (e: any) {
        if (!stopped) {
          setError(e);
          setLoading(false);
        }
      }
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => { stopped = true; clearInterval(id); };
  }, [client, intervalMs]);

  return { data, loading, error };
}

/**
 * ETH price in USD via Chainlink ETH/USD aggregator on mainnet.
 * Address: 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419
 * Decimals: 8.
 */
const CHAINLINK_ETH_USD: Address = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419';
const CHAINLINK_ABI = [
  {
    type: 'function',
    name: 'latestRoundData',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { type: 'uint80', name: 'roundId' },
      { type: 'int256', name: 'answer' },
      { type: 'uint256', name: 'startedAt' },
      { type: 'uint256', name: 'updatedAt' },
      { type: 'uint80', name: 'answeredInRound' },
    ],
  },
] as const;

export function useEthPriceUsd(intervalMs = 60_000) {
  const client = usePublicClient();
  const [usd, setUsd] = useState<number | null>(null);

  useEffect(() => {
    if (!client) return;
    let stopped = false;

    const tick = async () => {
      try {
        const r = (await client.readContract({
          address: CHAINLINK_ETH_USD,
          abi: CHAINLINK_ABI,
          functionName: 'latestRoundData',
        })) as readonly [bigint, bigint, bigint, bigint, bigint];
        const answer = r[1];
        if (!stopped) setUsd(Number(answer) / 1e8);
      } catch {
        // public RPC may rate-limit; just skip this tick
      }
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => { stopped = true; clearInterval(id); };
  }, [client, intervalMs]);

  return usd;
}
