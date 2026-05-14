# POSCI X (Twitter) Launch Pack

> All copy below uses the **actual deployed addresses** and **live URLs**.
> When pasting on X, the OG card at `scientistdapp.online/opengraph-image` will
> auto-render under any tweet that ends with `scientistdapp.online/...`.
>
> **Tip**: keep links at the END of each tweet — X will hide the OG card if
> you put text after the URL.
>
> Custom domain `scientistdapp.online` is already bound to Vercel — no link changes needed.

---

## Live data (auto-filled into all tweets below)

```
Token CA       : 0xD020e5E5c2724B2661C2FEF9AE878f49410a8B77
Mining contract: 0x9EAdD7dF7701e03d07c3727EC1ba816C2C9De936
Genesis contract:0x7bC1520Da49Cd56D5BE11aA77650cA998951459d
Etherscan      : https://etherscan.io/token/0xD020e5E5c2724B2661C2FEF9AE878f49410a8B77
Frontend       : https://scientistdapp.online
Twitter handle : @scientistsdapp
Mining opens   : 2026-05-13 06:39 UTC  (gate 1)
```

---

# 1️⃣ Pinned Tweet (profile pin)

### English (266 chars)

```
$POSCI — Proof of Scientist

21M cap · No owner · LP burned · No mint
95% mined via PoW in your browser

The hash is YOUR address — nothing for MEV to steal.

⛏️ scientistdapp.online
📜 0xD020e5E5c2724B2661C2FEF9AE878f49410a8B77
```

### 中文 (≤140 字)

```
$POSCI 科学家证明

21M 总量 · 无管理员 · LP 已烧 · 无增发
95% 通过浏览器 PoW 挖矿分发

哈希包含你自己的地址，MEV 抢不走

⛏️ scientistdapp.online
📜 0xD020e5E5c2724B2661C2FEF9AE878f49410a8B77
```

---

# 2️⃣ Launch Thread — English (7 tweets)

### 1/7 — hook (always have CA in first tweet)

```
🧪 Introducing $POSCI — Proof of Scientist

A 21,000,000-cap, owner-less, PoW-mined ERC20 on Ethereum.
95% of supply is mined, not sold.

CA: 0xD020e5E5c2724B2661C2FEF9AE878f49410a8B77
Verified: https://etherscan.io/token/0xD020e5E5c2724B2661C2FEF9AE878f49410a8B77
```

### 2/7 — the name

```
2/ Why "Proof of Scientist"?

Because mining = science:
brute-force hash space until reality agrees with your guess.

keccak256(challenge ‖ msg.sender ‖ nonce) ≤ target → reward.

No ASIC monopoly. CPU + WebGPU in your browser.
```

### 3/7 — distribution

```
3/ Distribution — no presale, no team unlock, no VC:

  500,000 → deployer (already moved to a cold wallet)
  500,000 → initial LP, burned to 0xdEaD
20,000,000 → PoW mining over years

95.24% mined · 2.38% LP · 2.38% deployer
```

### 4/7 — two gates

```
4/ Two startup gates protect launch:

🚪 Time gate — 12h after deploy
🚪 Pool gate — fires only when the 0.5 ETH genesis cap fills

The cap-filling tx ALSO initializes the V4 pool, mints LP, and burns the NFT to 0xdEaD. Atomic. No window for rugs.
```

### 5/7 — anti-MEV

```
5/ MEV bots can't steal your nonce.

Your wallet address is INSIDE the PoW hash.
A copied nonce → different digest → contract revert.

There's literally nothing in the mempool to snipe.

Same design as 0xBitcoin since 2018. Battle-tested.
```

### 6/7 — trustless

```
6/ Receipts:

🔥 LP NFT permanently at 0x000…dEaD
🔒 Mining: no owner, no admin, no pause, no upgrade
🚫 Token: no mint function — supply forever 21M
🛡️ bindGenesis self-renounced atomically at deploy

Read the code on Etherscan. Don't trust me.
```

### 7/7 — CTA

```
7/ Mine. Trade. Verify.

⛏️ Mine: https://scientistdapp.online/mine
🚀 Genesis (0.5 ETH cap): https://scientistdapp.online/genesis
📊 Live network status: https://scientistdapp.online/stats

Ethereum mainnet · Uniswap V4 · WebGPU mining

$POSCI #Ethereum #PoW
```

---

# 3️⃣ Launch Thread — 中文 (7 推)

### 1/7

```
🧪 上线 $POSCI 科学家证明

以太坊主网 · 21,000,000 总量 · 无管理员
95% 通过 PoW 挖矿分发，不是卖给你

CA: 0xD020e5E5c2724B2661C2FEF9AE878f49410a8B77
Etherscan：https://etherscan.io/token/0xD020e5E5c2724B2661C2FEF9AE878f49410a8B77
```

### 2/7

```
2/ 为什么叫"科学家证明"？

挖矿做的事跟科学一样：
在 hash 空间里硬算，直到现实承认你的猜测

keccak256(challenge ‖ 你的地址 ‖ nonce) ≤ target → 出币

没 ASIC 垄断、没矿场，浏览器 CPU + WebGPU 就能挖
```

### 3/7

```
3/ 分配 — 无预售、无团队解锁、无 VC：

   50 万 → 部署者（已转入冷钱包）
   50 万 → 初始 LP，烧到 0xdEaD
2000 万 → PoW 挖矿，慢慢出

95.24% 挖矿 · 2.38% LP · 2.38% 部署者
```

### 4/7

```
4/ 双重启动门：

🚪 时间门 — 部署后 12 小时
🚪 池子门 — 创世售卖填满 0.5 ETH 才会触发

那一笔填满的交易**同时**：建 V4 池 + 加 LP + 烧 LP NFT
原子操作，没有 rug 的窗口
```

### 5/7

```
5/ 为什么 MEV 机器人偷不走你的 nonce：

你的钱包地址写在 PoW hash 里
别人复制你的 nonce → 算出的 digest 跟你不一样 → 合约 revert

mempool 里**没东西**可抢

跟 0xBitcoin 2018 年同款设计，久经考验
```

### 6/7

```
6/ 凭据：

🔥 LP NFT 永久销毁到 0x000…dEaD
🔒 挖矿合约：无 owner、无管理员、无暂停、无升级
🚫 代币：无 mint，总量永远 21M
🛡️ bindGenesis 部署时已原子 renounce

不用信我，自己读 Etherscan 代码
```

### 7/7

```
7/ 挖矿、交易、自己验证：

⛏️ 浏览器挖矿：https://scientistdapp.online/mine
🚀 创世购买（0.5 ETH 上限）：https://scientistdapp.online/genesis
📊 实时网络状态：https://scientistdapp.online/stats

以太坊主网 · Uniswap V4 · WebGPU 挖矿

$POSCI #以太坊 #PoW
```

---

# 4️⃣ Standalone tweets (drop into replies / quote tweets)

### A. The "anti-MEV" angle

```
You can't snipe a $POSCI nonce.

Because the hash includes the miner's address:
keccak256(challenge ‖ msg.sender ‖ nonce)

Copy a competitor's nonce → digest doesn't match → revert.

There's no MEV surface. By design.

https://scientistdapp.online
```

### B. The "fully fair" angle

```
$POSCI launch checklist:

✅ Contract: verified on Etherscan
✅ LP: burned to 0xdEaD on bootstrap
✅ Owner: none — bindGenesis self-renounced
✅ Mint: no function exists
✅ Distribution: 95% via PoW

Nothing to trust. Just code.

https://scientistdapp.online
```

### C. The "browser mining" angle

```
You can mine $POSCI from a Chrome tab.

WebGPU compute shader, custom keccak256 kernel.
Sliders for CPU workers + GPU power.
First valid hash auto-submits.

This is what mining looked like before ASICs.

⛏️ https://scientistdapp.online/mine
```

### D. The "tech specs" angle (for devs)

```
$POSCI under the hood:

• Solidity 0.8.26, via_ir
• 0xBitcoin-style PoW (anti-MEV)
• Bitcoin schedule: 1000 reward, halving / 10k mines, retarget / 1024
• Uniswap V4 native (PoolManager + Permit2)
• Atomic genesis: same tx fills cap + builds pool + burns LP

https://etherscan.io/token/0xD020e5E5c2724B2661C2FEF9AE878f49410a8B77
```

### E. The "no presale BS" angle

```
$POSCI distribution:

❌ No presale
❌ No team allocation
❌ No VC unlock
❌ No marketing budget

✅ 95% of 21M supply via on-chain PoW mining
✅ 0.5 ETH genesis sale → instantly becomes burned LP
✅ Deployer keeps 2.38% (publicly)

That's it. That's the model.

https://scientistdapp.online
```

---

# 5️⃣ Event-triggered tweets (post when these happen)

### When mining time gate opens (~12h after deploy)

```
⛏️ $POSCI mining is OPEN.

Time gate: ✅
Pool gate: ⏳ (waiting for 0.5 ETH genesis to fill)

You can already start hashing — first solver after the pool gate flips wins the first reward.

Connect → Hybrid → Start Mining
https://scientistdapp.online/mine
```

### When genesis cap fills (V4 pool atomically created)

```
🚀 $POSCI genesis filled. V4 pool LIVE.

LP NFT just got burned to 0xdEaD in the same tx.
Mining gate is now OPEN.

Trade: https://app.uniswap.org/#/swap?outputCurrency=0xD020e5E5c2724B2661C2FEF9AE878f49410a8B77

Mine: https://scientistdapp.online/mine
```

### When first POSCI is mined (after both gates open)

```
First $POSCI block mined.

Miner: <0x...address>
Reward: 1,000 POSCI
Block: <number>
Tx: https://etherscan.io/tx/<hash>

Mine: https://scientistdapp.online/mine
```

### Daily mining update template

```
📊 $POSCI · day <N>

Mined so far: <X> / 20,000,000 POSCI (<Y>%)
Active miners: <count> unique addresses
Network hashrate ≈ <rate>
Until next halving: <Z> blocks

Status: https://scientistdapp.online/stats
```

---

# 6️⃣ Reply templates for FUD / Q&A

### "Is this safe?"

```
Read the contracts:
• POSCIToken: https://etherscan.io/address/0xD020e5E5c2724B2661C2FEF9AE878f49410a8B77#code
• POSCIMining: https://etherscan.io/address/0x9EAdD7dF7701e03d07c3727EC1ba816C2C9De936#code
• POSCIGenesis: https://etherscan.io/address/0x7bC1520Da49Cd56D5BE11aA77650cA998951459d#code

No mint. No owner. No upgrade proxy. LP burned at bootstrap.
Audit it yourself.
```

### "Why 0.5 ETH genesis?"

```
Small enough that one whale can't buy out the launch.
Big enough to seed a real V4 pool from second one.

Per-wallet cap is 0.05 ETH → minimum 10 buyers.

The 0.5 ETH never touches a team wallet. Same tx that fills it builds the LP and burns the NFT.
```

### "How is this different from XYZ memecoin?"

```
1. No mint function → supply forever 21M
2. No owner / admin / pause
3. LP burned to 0xdEaD on launch
4. 95% mined, not sold
5. Anti-MEV mining hash includes your address

It's literally just code. Nobody runs anything.
```

---

# 7️⃣ Posting checklist (do these in order)

- [ ] **Step 1**: Update X handle bio (suggestion below)
- [ ] **Step 2**: Pin the pinned-tweet copy
- [ ] **Step 3**: Post the 7-tweet launch thread
- [ ] **Step 4**: Within 24h, post 2-3 standalone tweets (Section 4) as quote-retweets or replies
- [ ] **Step 5**: Bind `scientistdapp.online` → Vercel and search-replace links
- [ ] **Step 6**: When mining gate opens (~12h post-deploy), post the "mining open" tweet
- [ ] **Step 7**: When V4 pool fills, post the "pool live" tweet

---

# 8️⃣ Suggested X profile bio (160 chars)

### English

```
21M-cap, owner-less, PoW-mined ERC20 on Ethereum.
95% mined in your browser. LP burned. No admin.
scientistdapp.online
```

### 中文

```
以太坊浏览器 PoW 公平挖矿
21M 总量 · 无管理员 · LP 已烧
95% 流通量靠算力挖出
scientistdapp.online
```
