// Read POSCI/ETH pool state from Uniswap V4 PoolManager.
//
// V4 PoolManager exposes `extsload(bytes32)` which returns any storage slot.
// The pool state lives in `mapping(PoolId => Pool.State) _pools`. The mapping
// is at storage slot 6 in the canonical V4 PoolManager. The Pool.State struct
// starts with Slot0, which packs sqrtPriceX96 / tick / fees into one 32-byte word:
//
//   bits   0..159  uint160  sqrtPriceX96
//   bits 160..183  int24    tick
//   bits 184..207  uint24   protocolFee
//   bits 208..231  uint24   lpFee
//
// Sources:
//   v4-core/src/PoolManager.sol               (mapping at slot 6)
//   v4-core/src/types/Slot0.sol               (Slot0 layout)
//   v4-core/src/extensions/Extsload.sol       (extsload entry point)

import {
  keccak256,
  encodeAbiParameters,
  zeroAddress,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';

export const V4_POOL_MANAGER: Address = '0x000000000004444c5dc75cB358380D2e3dE08A90';
const POOLS_MAPPING_SLOT = 6n;

const POOL_MANAGER_ABI = [
  {
    type: 'function',
    name: 'extsload',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32', name: 'slot' }],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'extsload',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32', name: 'startSlot' }, { type: 'uint256', name: 'nSlots' }],
    outputs: [{ type: 'bytes32[]' }],
  },
] as const;

export interface PoolKey {
  currency0:   Address;
  currency1:   Address;
  fee:         number;
  tickSpacing: number;
  hooks:       Address;
}

export interface PoolSlot0 {
  sqrtPriceX96: bigint;
  tick:         number;
  protocolFee:  number;
  lpFee:        number;
}

export interface PoolReadout {
  poolId:       Hex;
  initialized:  boolean;
  sqrtPriceX96: bigint;
  tick:         number;
  liquidity:    bigint;        // active liquidity (full-range LP)
  posciPerEth:  number;        // POSCI received per ETH
  ethPerPosci:  number;        // ETH received per POSCI
}

/** POSCI/ETH genesis pool key — currency0 is always native ETH (address(0)). */
export function poscieEthPoolKey(posci: Address): PoolKey {
  return {
    currency0:   zeroAddress,
    currency1:   posci,
    fee:         3000,
    tickSpacing: 60,
    hooks:       zeroAddress,
  };
}

export function computePoolId(key: PoolKey): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'address' },
        { type: 'uint24' },
        { type: 'int24' },
        { type: 'address' },
      ],
      [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks],
    ),
  );
}

/** Storage slot of `_pools[poolId]` (the start of the Pool.State struct). */
export function poolStateSlot(poolId: Hex): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'uint256' }],
      [poolId, POOLS_MAPPING_SLOT],
    ),
  );
}

function unpackSlot0(raw: Hex): PoolSlot0 {
  const v = BigInt(raw);
  const sqrtPriceX96 = v & ((1n << 160n) - 1n);
  const tickRaw = (v >> 160n) & ((1n << 24n) - 1n);
  const tick = Number(tickRaw >= 1n << 23n ? tickRaw - (1n << 24n) : tickRaw);
  const protocolFee = Number((v >> 184n) & ((1n << 24n) - 1n));
  const lpFee = Number((v >> 208n) & ((1n << 24n) - 1n));
  return { sqrtPriceX96, tick, protocolFee, lpFee };
}

/**
 * Convert sqrtPriceX96 → linear price (token1 per token0).
 * For our POSCI/ETH pool: token0=ETH, token1=POSCI ⇒ returns POSCI per ETH.
 * Uses a doubled BigInt division to keep precision, then converts to Number.
 */
export function priceFromSqrt(sqrtPriceX96: bigint, decimals0 = 18, decimals1 = 18): number {
  if (sqrtPriceX96 === 0n) return 0;
  // ratio = (sqrtPriceX96 / 2^96)^2 = sqrtPriceX96^2 / 2^192
  // To keep precision we compute (sqrtPriceX96^2 * 1e18) / 2^192 then divide by 1e18 in float.
  const SCALE = 10n ** 18n;
  const num = sqrtPriceX96 * sqrtPriceX96 * SCALE;
  const den = 1n << 192n;
  const scaled = num / den; // ≈ price * 1e18
  const price = Number(scaled) / 1e18;
  // Decimal correction (price ratio per smallest unit, scale to whole-token)
  const adj = 10 ** (decimals0 - decimals1);
  return price * adj;
}

/** Read the full slot0 + liquidity + initialized state in one go. */
export async function readPool(client: PublicClient, posci: Address): Promise<PoolReadout> {
  const key = poscieEthPoolKey(posci);
  const poolId = computePoolId(key);
  const baseSlot = poolStateSlot(poolId);

  // Pool.State layout (V4 reference):
  //   slot 0: Slot0      (packed: sqrtPriceX96 | tick | protocolFee | lpFee)
  //   slot 1: feeGrowthGlobal0X128
  //   slot 2: feeGrowthGlobal1X128
  //   slot 3: liquidity (uint128 packed at low end)
  //
  // We pull all 4 in one extsload call.
  const slots = (await client.readContract({
    address: V4_POOL_MANAGER,
    abi: POOL_MANAGER_ABI,
    functionName: 'extsload',
    args: [baseSlot, 4n],
  })) as Hex[];

  const slot0 = unpackSlot0(slots[0]);
  const liquidityRaw = BigInt(slots[3]);
  const liquidity = liquidityRaw & ((1n << 128n) - 1n);

  // sqrtPrice == 0 ⇒ pool not initialized (genesis hasn't bootstrapped yet)
  const initialized = slot0.sqrtPriceX96 !== 0n;
  const posciPerEth = initialized ? priceFromSqrt(slot0.sqrtPriceX96) : 0;
  const ethPerPosci = initialized && posciPerEth > 0 ? 1 / posciPerEth : 0;

  return {
    poolId,
    initialized,
    sqrtPriceX96: slot0.sqrtPriceX96,
    tick:         slot0.tick,
    liquidity,
    posciPerEth,
    ethPerPosci,
  };
}

/**
 * Estimate the ETH and POSCI reserves currently in the active range of the
 * full-range position.
 *
 * For a full-range position with `liquidity` L at price √P:
 *   x (token0=ETH)   = L / √P
 *   y (token1=POSCI) = L · √P
 *
 * Both in *raw token units* (1e18 since both decimals=18).
 */
export function reservesFromLiquidity(sqrtPriceX96: bigint, liquidity: bigint): { eth: bigint; posci: bigint } {
  if (sqrtPriceX96 === 0n || liquidity === 0n) return { eth: 0n, posci: 0n };
  const Q96 = 1n << 96n;
  // x = L * 2^96 / sqrtPriceX96
  const eth = (liquidity * Q96) / sqrtPriceX96;
  // y = L * sqrtPriceX96 / 2^96
  const posci = (liquidity * sqrtPriceX96) / Q96;
  return { eth, posci };
}
