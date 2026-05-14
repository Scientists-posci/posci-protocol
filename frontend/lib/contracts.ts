import type { Address } from 'viem';

export const TOKEN_ADDRESS:   Address = (process.env.NEXT_PUBLIC_TOKEN_ADDRESS   as Address) ?? '0x0000000000000000000000000000000000000000';
export const MINING_ADDRESS:  Address = (process.env.NEXT_PUBLIC_MINING_ADDRESS  as Address) ?? '0x0000000000000000000000000000000000000000';
export const GENESIS_ADDRESS: Address = (process.env.NEXT_PUBLIC_GENESIS_ADDRESS as Address) ?? '0x0000000000000000000000000000000000000000';

export const TOKEN_ABI = [
  { type: 'function', name: 'balanceOf',   stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'decimals',    stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'symbol',      stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'name',        stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
] as const;

export const MINING_ABI = [
  { type: 'function', name: 'mine', stateMutability: 'nonpayable',
    inputs: [{ name: 'nonce', type: 'uint256' }, { name: 'challengeDigest', type: 'bytes32' }], outputs: [] },
  { type: 'function', name: 'challengeNumber',       stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
  { type: 'function', name: 'miningTarget',          stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'getMiningReward',       stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'getMiningDifficulty',   stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'getRemainingSupply',    stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'getEpochsUntilHalving', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'epochCount',            stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'tokensMinted',          stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'miningStartTime',       stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'poolGateOpen',          stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'TOTAL_MINING_SUPPLY',   stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'INITIAL_REWARD',        stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'HALVING_INTERVAL',      stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'bindingRenounced',      stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'genesis',               stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'deployer',              stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'solutionsByMiner',      stateMutability: 'view', inputs: [{ name: 'miner', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'miners',                stateMutability: 'view', inputs: [{ name: 'i',     type: 'uint256' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'minersCount',           stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'topMinersBatch',        stateMutability: 'view',
    inputs:  [{ name: 'start', type: 'uint256' }, { name: 'count', type: 'uint256' }],
    outputs: [{ name: 'addrs', type: 'address[]' }, { name: 'wins', type: 'uint256[]' }] },
  { type: 'event',    name: 'Mined', inputs: [
    { name: 'miner',              type: 'address', indexed: true },
    { name: 'reward',             type: 'uint256' },
    { name: 'epochCount',         type: 'uint256' },
    { name: 'newChallengeNumber', type: 'bytes32' },
  ] },
] as const;

export const GENESIS_ABI = [
  { type: 'function', name: 'buyGenesis',            stateMutability: 'payable',    inputs: [], outputs: [] },
  { type: 'function', name: 'forceBootstrap',        stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'function', name: 'totalContributed',      stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'bootstrapped',          stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'contributed',           stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'GENESIS_HARD_CAP',      stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'GENESIS_PER_WALLET',    stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'POSCI_FOR_GENESIS',     stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'deployedAt',            stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'FORCE_BOOTSTRAP_DELAY', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'MIN_BOOTSTRAP_ETH',     stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'event', name: 'GenesisBuy', inputs: [
    { name: 'buyer',    type: 'address', indexed: true },
    { name: 'ethIn',    type: 'uint256' },
    { name: 'posciOut', type: 'uint256' },
  ] },
  { type: 'event', name: 'Bootstrapped', inputs: [
    { name: 'ethToLp',   type: 'uint256' },
    { name: 'posciToLp', type: 'uint256' },
    { name: 'lpTokenId', type: 'uint256' },
  ] },
  { type: 'event', name: 'ForceBootstrapped', inputs: [
    { name: 'ethToLp',     type: 'uint256' },
    { name: 'posciToLp',   type: 'uint256' },
    { name: 'posciBurned', type: 'uint256' },
  ] },
] as const;
