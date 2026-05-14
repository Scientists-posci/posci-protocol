# 落地页文案

## Hero — EN

# Proof of Scientist
### A 21,000,000-cap, owner-less, PoW-mined ERC20 on Ethereum.

Genesis sold out in one transaction. LP burned. 95% of supply is mined, not sold.
Mining hash includes your address — no MEV bot can steal your nonce.

[Mine POSCI →]   [View contract on Etherscan →]

---

## Hero — 中文

# 科学家证明
### 以太坊主网 PoW 挖矿代币 · 总量 21,000,000 · 无管理员

创世售卖原子完成、LP 永久销毁、95% 流通量靠算力挖出。
挖矿哈希包含你的地址 —— mempool 里 MEV 机器人偷不走你的 nonce。

[开始挖矿 →]   [查看 Etherscan 合约 →]

---

## Specs Block

| Spec | Value |
|---|---|
| Network | Ethereum mainnet |
| Token standard | ERC-20 + Permit |
| Total supply | 21,000,000 POSCI (fixed forever) |
| Decimals | 18 |
| Genesis cap | 0.5 ETH (250,000 POSCI sold + 250,000 paired in LP) |
| Mining supply | 20,000,000 POSCI (95.24%) |
| Initial reward | 1,000 POSCI per valid solution |
| Halving | Every 10,000 solutions |
| Difficulty retarget | Every 1,024 solutions, target 60s/solution |
| Owner / admin | **None** — no privileged functions exist |
| LP | Burned to 0x000…dEaD on bootstrap |

---

## Three pillars

### 1. Fair launch, atomic.
The genesis sale fills 0.5 ETH and **the same transaction** initializes the
Uniswap V4 pool, mints a full-range LP position, and burns the LP NFT to a
dead address. There is no window where the deployer can rug or front-run.

### 2. Owner-less by design.
Read the source. There is no `mint`, no `pause`, no `owner`, no `upgradeTo`,
no admin role. The deployer's only post-launch capability is what every other
holder has: `transfer` and `mine`.

### 3. PoW the way it should be.
Every mining attempt commits `keccak256(challenge || msg.sender || nonce)`.
Because your address is in the hash, copying a competitor's nonce produces a
different digest — there is **literally nothing for an MEV bot to steal**.
This is the same anti-frontrun design used by 0xBitcoin since 2018.

---

## How mining works (one paragraph)

You pick a nonce. You compute `keccak256(challenge || your_address || nonce)`
locally. If the resulting digest is numerically ≤ the current `miningTarget`,
you call `mine(nonce, digest)` on the mining contract and receive the current
reward. Difficulty automatically retargets every 1,024 rewards toward
60 seconds per reward. Reward halves every 10,000 successful mines. The
contract holds 20M POSCI; mining ends when that vault is empty.

[Mine in browser (CPU)]   [Mine on GPU (CLI)]   [Read the code]

---

## FAQ (compressed)

**Why no presale?** Because the only thing presales reliably distribute is exit liquidity. The 0.5 ETH genesis is a launch wick, not a fundraise.

**Why 0.5 ETH?** Small enough that no one can buy out the launch. Large enough that a real V4 pool exists from second one.

**Can the team rug?** There is no team token, no admin function, no upgradeable proxy, no LP withdrawal. The literal answer is no.

**Why not Uniswap V2/V3?** V4 is cheaper to swap on long-term thanks to singleton + flash accounting, and we wanted to be V4-native from day one.

**Where do I report bugs?** Open an issue on the GitHub repo. There is no DM line, because there is no team to DM.
