# POSCI — Proof of Scientist

> 21M cap, owner-less, PoW-mined ERC20 on Ethereum mainnet, atomically launched on Uniswap V4.

```
┌─────────────────────────────────────────────────────────────┐
│  POSCIToken (ERC20, no admin)                               │
│      └── 21,000,000 minted once in constructor              │
│                                                             │
│  POSCIGenesis  ──── 0.5 ETH cap ────► Uniswap V4 Pool       │
│      ├── 0.05 ETH per wallet                                │
│      ├── atomic: init pool + mint LP + burn LP NFT          │
│      └── on bootstrap → opens mining gate (one-way)         │
│                                                             │
│  POSCIMining (0xBitcoin-style PoW)                          │
│      ├── gate 1: time (deploy + 24h)                        │
│      ├── gate 2: pool gate (set by Genesis, irreversible)   │
│      ├── digest = keccak256(challenge || msg.sender || N)   │
│      ├── halving every 10,000 mines                         │
│      └── difficulty retarget every 1,024 mines (60s target) │
└─────────────────────────────────────────────────────────────┘
```

## Quick start

```bash
# 0. Prereqs
curl -L https://foundry.paradigm.xyz | bash && foundryup

# 1. Install deps (this creates lib/ from git submodules)
cd posci
forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge install foundry-rs/forge-std --no-commit

# 2. Build
forge build

# 3. Configure
cp .env.example .env
# edit .env: DEPLOYER_PRIVATE_KEY, MAINNET_RPC_URL, ETHERSCAN_API_KEY

# 4. Test (unit tests + mainnet-fork integration)
forge test -vvv
forge test --fork-url $MAINNET_RPC_URL --match-contract POSCIGenesisFork -vvv

# 5. Sepolia dry-run (highly recommended before mainnet)
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast --verify

# 6. Mainnet deploy + verify in one shot
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $MAINNET_RPC_URL \
  --broadcast --verify
```

After the deploy script runs successfully, the deployer wallet has:
- 500,000 POSCI
- (some ETH dust left over from gas)

The deployer wallet has **no special powers** over any contract — `bindGenesis` was already called and `renounceBinding` already locked it.

## What's in the box

| Path | Purpose |
|---|---|
| `src/POSCIToken.sol` | Plain ERC-20 + Permit. No mint/owner/pause. |
| `src/POSCIMining.sol` | 0xBitcoin-style PoW with two startup gates. |
| `src/POSCIGenesis.sol` | 0.5 ETH genesis + atomic V4 pool init + LP burn. |
| `src/interfaces/IUniswapV4.sol` | Minimal V4 PoolManager / PositionManager / Permit2 surfaces. |
| `script/Deploy.s.sol` | One-shot deploy + wire + renounce. |
| `test/POSCIToken.t.sol` | Token invariants (supply, no admin selectors). |
| `test/POSCIMining.t.sol` | Gates, anti-frontrun, halving math. |
| `test/POSCIGenesis.t.sol` | Mainnet-fork V4 bootstrap end-to-end. |
| `metadata/` | Logo + tokenlist + wallet/CG/CMC submission checklist. |
| `marketing/` | X launch thread, pinned tweet, web copy, lite paper. |
| `frontend-snippets/` | viem snippets for buy / mine / dashboard. |

## Deployment values (verify on chain before sharing addresses)

These are the mainnet addresses the deploy script reads from `.env`. Always
re-verify against https://docs.uniswap.org/contracts/v4/deployments before
broadcasting.

| Var | Value (mainnet, May 2026) |
|---|---|
| `V4_POOL_MANAGER` | `0x000000000004444c5dC75cB358380D2e3dE08A90` |
| `V4_POSITION_MANAGER` | `0xbD216513d74C8cf14cF4747E6AaA6420FF64ee9e` |
| `PERMIT2` | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |

## Post-deploy checklist

1. **All four contracts verified on Etherscan** (the `--verify` flag handles this; double-check each page).
2. **POSCIMining state**: `bindingRenounced() == true`, `genesis() == <genesis addr>`, `poolGateOpen() == false` (until first 0.5 ETH of buys).
3. **POSCIGenesis state**: `totalContributed() == 0`, `bootstrapped() == false`.
4. **Token balances**: deployer 500k, genesis 500k, mining 20M.
5. **Trigger genesis** (you can be the first buyer with a different wallet, or wait for community).
6. **After bootstrap**: confirm `mining.poolGateOpen() == true` and the LP NFT lives at `0x000…dEaD` (read PositionManager `ownerOf(<lpTokenId>)`).
7. **Submit metadata**: walk through `metadata/trust-wallet-assets.md` step by step.
8. **Publish marketing**: paste `marketing/launch-thread.md` into X, pin `marketing/pinned-tweet.md`.

## Security disclosures

- **Not audited.** Strongly recommended: pay for a focused review (~$2-5k) on
  the V4 integration in `POSCIGenesis._bootstrap` before mainnet.
- The on-chain TickMath / LiquidityAmounts in `POSCIGenesis` are direct ports
  of the Uniswap V3/V4 reference implementations. Trust through code review
  rather than reuse — **diff against the upstream** before deploy.
- Any value of `MINING_START_DELAY_HOURS` < 24 is allowed but will look
  suspicious to community. Default and recommendation: 24.
- The genesis hard cap is small on purpose — if you raise it, also raise
  `GENESIS_PER_WALLET` proportionally to keep ≥ 10-20 minimum buyers.

## License

MIT. Use, fork, audit, ship.
