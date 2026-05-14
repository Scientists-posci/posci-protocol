# X 发射线程（EN + 中文双版）

> 部署完成、池子上线、Etherscan verified 之后再发。
> 公开合约地址前先在测试网完整跑一遍。

---

## English version (7 tweets)

**1/7**
🧪 Introducing **Proof of Scientist** ($POSCI)
A fair-launch, PoW-mined ERC20 on Ethereum.
21,000,000 total. No owner. No mint. LP burned.
Contract: 0xYOUR_CONTRACT
Etherscan: https://etherscan.io/token/0xYOUR_CONTRACT

**2/7**
Why "Proof of Scientist"?
Because mining POSCI requires the same thing science does:
brute-forcing hash space until reality agrees with your guess.
keccak256(challenge ‖ msg.sender ‖ nonce) ≤ target → reward.

**3/7**
Distribution (no presale, no team unlock, no VC):
• 500,000 — deployer (2.38%)
• 250,000 — genesis sale (1.19%)
• 250,000 — initial LP, burned to 0xdEaD (1.19%)
• 20,000,000 — PoW mining over time (95.24%)

**4/7**
Two gates protect launch from front-runners:
🚪 Gate 1 — time lock: mining opens 24h after deploy
🚪 Gate 2 — pool lock: only opens after the 0.5 ETH genesis cap fills
                            and the V4 LP is burned IN THE SAME TX
Atomic. Unstoppable.

**5/7**
Anti-MEV by design:
Your mining nonce includes YOUR address. A copied nonce
produces a different digest for anyone else. There's literally
nothing to steal from the mempool.

**6/7**
🔥 LP NFT is sent to 0x000…dEaD at bootstrap.
🔒 Mining contract has no owner, no admin, no pause.
🚫 Token has no mint function. Supply is permanently 21M.
You don't need to trust me. Read the code.

**7/7**
Mine: https://YOUR-DOMAIN/mine
Buy genesis (until cap fills): https://YOUR-DOMAIN/genesis
Code: https://github.com/YOUR_REPO
Pool: https://app.uniswap.org/#/swap?outputCurrency=0xYOUR_CONTRACT

#Ethereum #PoW #UniswapV4 $POSCI

---

## 中文版（7 推）

**1/7**
🧪 上线 **Proof of Scientist**（$POSCI）
以太坊主网，PoW 公平挖矿 ERC20。
总量 21,000,000，无管理员、无增发、LP 已销毁。
合约：0xYOUR_CONTRACT
Etherscan：https://etherscan.io/token/0xYOUR_CONTRACT

**2/7**
为什么叫"科学家证明"（Proof of Scientist）？
因为挖矿做的事跟科学一样：
在 hash 空间里硬算，直到现实承认你的猜测。
keccak256(challenge ‖ 你的地址 ‖ nonce) ≤ target → 出币。

**3/7**
分配（无预售、无团队解锁、无 VC）：
• 50 万 —— 部署者（2.38%）
• 25 万 —— 创世售卖（1.19%）
• 25 万 —— 初始 LP，烧到 0xdEaD（1.19%）
• 2000 万 —— PoW 挖矿（95.24%）

**4/7**
双门防抢跑：
🚪 门 1 —— 时间锁：部署后 24h 才能挖
🚪 门 2 —— 池子锁：创世售满 0.5 ETH、Uniswap V4 LP 烧完
                              才会被同笔交易开启
原子操作，无法绕过。

**5/7**
天生抗 MEV：
你的 nonce 必须配你自己的地址才能算出 digest。
别人复制 mempool 里的 nonce → 算出的 digest 跟你不一样 →
合约直接 revert。**mempool 里没东西可抢**。

**6/7**
🔥 LP NFT 上线即烧到 0x000…dEaD
🔒 挖矿合约无 owner、无管理员、无暂停
🚫 代币无 mint，总量永久锁定 21M
不用信我，自己读代码。

**7/7**
挖矿前端：https://YOUR-DOMAIN/mine
创世购买（卖完即止）：https://YOUR-DOMAIN/genesis
开源代码：https://github.com/YOUR_REPO
池子：https://app.uniswap.org/#/swap?outputCurrency=0xYOUR_CONTRACT

#以太坊 #PoW #UniswapV4 $POSCI
