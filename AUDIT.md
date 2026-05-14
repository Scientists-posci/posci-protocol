# POSCI Self-Audit (informal)

> **Scope**: `src/POSCIToken.sol`, `src/POSCIMining.sol`, `src/POSCIGenesis.sol`, `script/Deploy.s.sol`.
> **Method**: Read each contract line by line, looking specifically for:
> 1. Front-runnable initialization
> 2. Reentrancy
> 3. Token loss / lockup
> 4. Math overflow / underflow / off-by-one
> 5. External-call assumptions about Uniswap V4 + Permit2
> 6. Implicit admin powers
>
> **Caveat**: This is a self-audit. **Pay for an external audit before mainnet deploy.** I'm specifically not certain about the V4 PositionManager `multicall` + Permit2 + `MINT_POSITION` path — that part is the highest residual risk.

## Findings

### F-01 [HIGH → FIXED] Front-runnable Genesis binding
**File**: `src/POSCIMining.sol`, original `bindGenesis` and `renounceBinding`.

Both functions were `external` with no `msg.sender` check. After `new POSCIMining(...)` lands on chain but before the deployer's `bindGenesis` tx confirms, an attacker watching the mempool can:
- Call `bindGenesis(maliciousContract)`. The legit deployer's bind reverts; mining is permanently bricked.
- Or call `renounceBinding()`. The legit deployer's bind reverts; mining can never be opened.

**Fix**: Captured `deployer = msg.sender` as immutable in the constructor, gated `bindGenesis` to `msg.sender == deployer`, and folded `renounceBinding` into `bindGenesis` so binding and renouncing happen in one atomic tx (no in-between window).

### F-02 [MED → ACCEPTED] Genesis depends on script-correct funding
**File**: `src/POSCIGenesis.sol`.

The contract has no constructor invariant that `token.balanceOf(this) == 500_000 * 1e18` after deployment. If the deploy script forgets the funding step, `_bootstrap` fails late (when Permit2 tries to pull POSCI for LP).

**Decision**: Accept. Adding a `seal()` callable check materially complicates the API for a one-line script-side error. The deploy script's `require()` checks at the end (lines 60-65 of `script/Deploy.s.sol`) catch this before `--broadcast` reports success.

### F-03 [MED → ACCEPTED] V4 integration is the largest residual risk
**File**: `src/POSCIGenesis.sol`, `_bootstrap` (lines ~115-260).

Three things have to be exactly right for the bootstrap to succeed:
1. `sqrtPriceX96` must be computed exactly correctly for the (250k POSCI, 0.5 ETH) full-range pool.
2. The MINT_POSITION encoding must match what V4 PositionManager's `BipsLibrary.decodeMintParams` expects byte-for-byte.
3. Permit2 must let PositionManager pull POSCI from us during SETTLE_PAIR.

I implemented #1 with a two-step `Math.sqrt` to avoid uint256 overflow. I ported the TickMath constants from V3 (V4 uses identical magic numbers). I wired up Permit2 in the constructor and again at bootstrap.

**However**, V4 mainnet only went live in Jan 2025 and the periphery is still settling. I have **not** end-to-end verified my bootstrap call against a live V4 deployment from this environment.

**Required mitigation** before mainnet:
- `forge test --fork-url $MAINNET_RPC_URL --match-contract POSCIGenesisFork -vvv` must pass against a recent fork.
- Run the full deploy on **Sepolia** (or a fork) and inspect the LP NFT actually lives at `0xdEaD`.
- Cross-check `sqrtPriceX96` against a Uniswap V4 init-pool SDK call.

### F-04 [LOW] No bounds check on `MINING_START_DELAY_HOURS`
**File**: `script/Deploy.s.sol`.

The deploy script reads `MINING_START_DELAY_HOURS` from env with default 24. Setting it to 0 (or 1) is allowed and would look suspicious to the community. Defended via README text only.

**Decision**: Accept; it's a deployer-side choice.

### F-05 [LOW] `permit2.approve` granted with 48-bit max expiration
**File**: `src/POSCIGenesis.sol`, `_bootstrap`.

Genesis grants PositionManager a Permit2 allowance of `uint160(posciForLp)` with `expiration = type(uint48).max` (year 8.9M+). This is fine — even if the bootstrap somehow misfires and the contract is left holding POSCI, the contract has no function to call PositionManager again, so the dangling allowance can't be abused.

### F-06 [INFO] Multiple PoW solutions per L1 block are allowed
**File**: `src/POSCIMining.sol`, `mine()`.

`challengeNumber = blockhash(block.number - 1)` is the same value for every tx in the same block. Two miners with different valid digests can both succeed in the same block. This matches 0xBitcoin's design and is intentional — difficulty retarget compensates over the 1024-mine window.

### F-07 [INFO] `solutionForChallenge` is unbounded growth
Each successful mine writes one storage slot. Over the full 20M emission with 1000 POSCI/reward starting reward, that's ~20,000 slots in the absolute floor case (more in reality due to halvings). At ~$0.10/slot historic mainnet pricing, the contract pays for ~$2k of storage over its lifetime, charged to miners as gas. This is fine.

### F-08 [INFO] LP burn is "send to dEaD", not `burn()`
V4 positions are an ERC-721 NFT minted by PositionManager. There's no canonical `burn()` that clears state — sending the NFT to `0x000…dEaD` is the standard "burn" pattern and what every fair-launch token I've seen does on V4.

## Things I deliberately did NOT do

- **Did not add Pausable.** A pause function = an admin key. Defeats the design.
- **Did not add a recoverable Owner.** Same.
- **Did not add a "rescue funds" function** for tokens accidentally sent to the contracts. Same.
- **Did not write a custom V4 hook.** Vanilla pool with `hooks = address(0)` is simplest and most auditable.

## Second-pass review (added after fixing F-01..F-04 and validating the V4 path on mainnet fork)

A fresh re-read of all three contracts after the first round of fixes. **No new exploitable issues.** Notes:

### N-01 [INFO] Stale doc comment on `bindGenesis`
Top-of-contract doc still said "called exactly once (by anyone)". Updated to reflect deployer-only + atomic self-renouncement.

### N-02 [INFO] Reward = 0 after MAX_HALVINGS keeps mining "open"
Once `epochCount / HALVING_INTERVAL >= MAX_HALVINGS`, `getMiningReward()` returns 0. `mine()` still succeeds (transferring 0 POSCI), `tokensMinted` doesn't grow, so the contract never trips its `MiningExhausted` revert. Real miners stop because gas > reward. Acceptable; matches Bitcoin's behavior after block subsidy hits 0.

### N-03 [INFO] Refund failure griefing surface
`buyGenesis` calls `msg.sender.call{value: refund}("")` and reverts on failure. A buyer contract whose `receive()` reverts can cause every overpay tx to revert — but they can only block their own buys, and others can still fill the cap. Not a real concern.

### N-04 [INFO] `safeTransfer` to `msg.sender` before bootstrap
The buyer who fills the cap receives their POSCI before `_bootstrap()` runs. Token has no transfer hook (plain OZ ERC20), so no reentrancy. Safe.

### N-05 [INFO] Stale POSCI in genesis after bootstrap
If anyone transfers extra POSCI to the genesis contract (donation, dust), it's locked forever — the contract has no withdrawal. Acceptable; same as any address.

## Additional edge-case tests added (8 new)

| Test | What it proves |
|---|---|
| `test_Halving_RewardZeroAtMaxHalvings` | Reward really hits 0 once 64th halving is reached |
| `test_Halving_RewardSchedule` | Each halving cuts reward exactly in half (5 steps verified) |
| `test_Mine_RevertsWhenExhausted` | Once tokensMinted == 20M, next mine reverts cleanly |
| `test_Mine_RewardCappedToRemaining` | Last block correctly truncates reward to remaining wei |
| `test_Mine_SameSolutionTwiceReverts_SameBlock` | `solutionForChallenge` mapping prevents double-spend |
| `test_Deployer_CannotMineWithoutSolution` | Deployer EOA has no special mining privilege |
| `test_BuyZero_Reverts` | `msg.value == 0` reverts with `ZeroValue` |
| `test_RealOverpayment_RefundsAndBootstraps` | 9 wallets fill 0.45 ETH; a 10th sending 0.5 ETH gets the cap-filling 0.05 charged, the other 0.45 refunded, **and** the bootstrap fires atomically |

**Total test count: 31 (17 unit + 14 mainnet-fork). All passing.**

## Recommendations before mainnet

1. **Pay for an external audit** focused on `_bootstrap`. Even a $2-5k single-day review by a V4-fluent auditor would catch what I might have missed about V4 calldata encoding.
2. **Sepolia rehearsal**: deploy + buy + bootstrap end-to-end on Sepolia. Verify on Etherscan that the LP NFT shows owner `0x…dEaD`.
3. **Diff the TickMath port** in `_getSqrtPriceAtTick` against `lib/v4-core/src/libraries/TickMath.sol` after `forge install` — single hex constant off and the pool initializes at a wrong price.
4. **Diff the LiquidityAmounts port** against `lib/v4-periphery/src/libraries/LiquidityAmounts.sol`.
5. **Time-bound the genesis cap**: if 0.5 ETH never fills, the contract holds the partial-buy POSCI forever. Acceptable, but document.
