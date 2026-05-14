# Proof of Scientist — Lite Paper

**One-line:** A 21M-cap, owner-less, fair-launched ERC20 on Ethereum where
95% of supply is distributed via Bitcoin-style PoW mining and the remaining
5% bootstraps a permanently-burned Uniswap V4 liquidity pool, atomically.

## 1. Problem

The default ERC20 launch playbook on Ethereum is:
1. Team holds 20-40%.
2. VCs hold 10-30%, vesting (usually short).
3. A "fair launch" presale that is in practice presale → dump.
4. Multisig admin keys that can mint, pause, or upgrade the token.

Each of those is a unilateral lever held by a small group. POSCI eliminates
all four.

## 2. Design

### 2.1 Token (`POSCIToken`)
- ERC-20 + EIP-2612 Permit.
- `MAX_SUPPLY = 21,000,000 * 1e18`, minted **once** in the constructor.
- No `mint`, no `owner`, no `pause`, no upgrade proxy, no admin role.

### 2.2 Genesis (`POSCIGenesis`)
A one-shot bootstrap contract:
- Accepts ETH up to a `0.5 ether` global cap.
- Per-wallet cap `0.05 ether` (minimum 10 distinct buyers).
- Sells 250,000 POSCI proportionally.
- When the global cap fills, **in the same transaction**:
  1. Initializes the POSCI/ETH pool on Uniswap V4 PoolManager.
  2. Mints a full-range LP position with all 0.5 ETH + 250,000 POSCI.
  3. Transfers the LP NFT to `0x000…dEaD`.
  4. Opens the mining contract's pool gate (one-way switch).
- No owner, no withdrawal function, no upgrade path.

### 2.3 Mining (`POSCIMining`)
A direct adaptation of the 0xBitcoin / EIP-918 model:
- `mine(nonce, digest)` succeeds iff:
  - `block.timestamp >= miningStartTime` (gate 1, set at deploy).
  - `poolGateOpen == true` (gate 2, set by Genesis).
  - `digest == keccak256(challenge || msg.sender || nonce)`.
  - `uint256(digest) <= miningTarget`.
  - `solutionForChallenge[digest] == false`.
- Reward starts at 1,000 POSCI and halves every 10,000 successful mines.
  Geometric sum: 1,000 × 10,000 × 2 = 20,000,000 POSCI — matches mining vault.
- Difficulty retargets every 1,024 mines toward 60 s/mine, clamped to ±4×.
- The only admin-ish hook is `bindGenesis(address)`, callable once before
  `renounceBinding()` is called. The deploy script does both atomically;
  after deployment both rails are permanently sealed.

## 3. Distribution

| Bucket | Amount | % | Mechanism |
|---|---|---|---|
| Deployer | 500,000 | 2.38% | Direct mint in constructor |
| Genesis sale | 250,000 | 1.19% | Sold for 0.5 ETH total, capped per wallet |
| Initial LP | 250,000 | 1.19% | Paired with 0.5 ETH, LP NFT burned |
| Mining vault | 20,000,000 | 95.24% | PoW emission over ~20-40 years at target rate |

## 4. Security properties

- **No mint surface.** The token's `_mint` is called once in the constructor.
- **No LP withdrawal.** The LP NFT lives at `0xdEaD`.
- **No mining drain.** The mining contract only transfers via `mine()`, which
  requires a valid PoW solution and pays out at most `getMiningReward()`.
- **No reentrancy.** Genesis is `nonReentrant`. Mining performs token transfer
  **after** all state writes (CEI-compatible).
- **No MEV theft.** `msg.sender` is mixed into the PoW digest, so copying a
  pending nonce produces a different (invalid) digest for the copier.
- **No upgrade proxy.** Contracts are not behind a proxy.
- **No `selfdestruct`, `delegatecall`, or `tx.origin`.**

## 5. Comparison to prior art

| | POSCI | 0xBitcoin | WOTS | Standard ERC20 launch |
|---|---|---|---|---|
| Owner-less from t=0 | ✅ | ✅ | ✅ | ❌ |
| Atomic LP burn | ✅ | ❌ | ❌ | ❌ |
| Pool depth gate | ✅ | ❌ | ❌ | ❌ |
| Anti-MEV mining | ✅ | ✅ | ✅ | n/a |
| Uniswap V4 native | ✅ | ❌ | ❌ | rarely |
| Halving / retarget | ✅ | ✅ | ✅ | n/a |

## 6. Known limitations

- **No bug bounty fund.** There is no treasury. A bug found post-deploy can
  only be reported and disclosed — there is no contract upgrade path.
- **First-block latency.** The first mining tx after `openPoolGate()` may
  see an unusually short or long interval; difficulty self-corrects within
  1,024 mines.
- **Gas spikes.** A retarget tx costs ~5-10k extra gas. Miners should plan
  for this every 1,024 successful mines.
- **Halving end.** After 64 halvings the reward is effectively 0 and any
  remaining vault dust is unmineable. This is by design — Bitcoin has the
  same property.

## 7. Verification

Anyone can verify the entire system in three steps:

1. `git clone https://github.com/YOUR_REPO && cd posci && forge test`
2. Compare deployed bytecode at the addresses in the launch tweet against
   `forge inspect <contract> bytecode`.
3. Confirm on Etherscan that:
   - `POSCIMining.bindingRenounced() == true`
   - `POSCIGenesis.bootstrapped() == true`
   - LP NFT id from the bootstrap tx has `ownerOf == 0xdEaD`

There is no off-chain trust required to use POSCI.
