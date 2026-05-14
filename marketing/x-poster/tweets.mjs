// All POSCI launch tweet content. Single source of truth — both this module
// and ../x-launch-pack.md should be kept in sync (one is for human review,
// the other is what actually gets posted).
//
// X char limits (free tier):
//   - 280 weighted chars: Latin = 1 weight, CJK = 2 weight
//   - URLs auto-count as 23 chars regardless of length

export const PINNED = {
  english:
`$POSCI — Proof of Scientist

21M cap · No owner · LP burned · No mint
95% mined via PoW in your browser

The hash is YOUR address — nothing for MEV to steal.

⛏️ scientistdapp.online
📜 0xFbcF59DE93B4c62e0EEe21280c9EAA75AFb1E26c`,

  chinese:
`$POSCI 科学家证明

21M 总量 · 无管理员 · LP 已烧 · 无增发
95% 通过浏览器 PoW 挖矿分发

哈希包含你自己的地址，MEV 抢不走

⛏️ scientistdapp.online
📜 0xFbcF59DE93B4c62e0EEe21280c9EAA75AFb1E26c`,
};

export const THREAD_ENGLISH = [
  // 1/7 — hook
`🧪 Introducing $POSCI — Proof of Scientist

A 21,000,000-cap, owner-less, PoW-mined ERC20 on Ethereum.
95% of supply is mined, not sold.

CA: 0xFbcF59DE93B4c62e0EEe21280c9EAA75AFb1E26c
https://etherscan.io/token/0xFbcF59DE93B4c62e0EEe21280c9EAA75AFb1E26c`,

  // 2/7 — the name
`2/ Why "Proof of Scientist"?

Because mining = science:
brute-force hash space until reality agrees with your guess.

keccak256(challenge ‖ msg.sender ‖ nonce) ≤ target → reward.

No ASIC monopoly. CPU + WebGPU in your browser.`,

  // 3/7 — distribution
`3/ Distribution — no presale, no team unlock, no VC:

  500,000 → deployer (already moved to a cold wallet)
  500,000 → initial LP, burned to 0xdEaD
20,000,000 → PoW mining over years

95.24% mined · 2.38% LP · 2.38% deployer`,

  // 4/7 — two gates
`4/ Two startup gates protect launch:

🚪 Time gate — 12h after deploy
🚪 Pool gate — fires only when the 0.5 ETH genesis cap fills

The cap-filling tx ALSO initializes the V4 pool, mints LP, and burns the NFT to 0xdEaD. Atomic.`,

  // 5/7 — anti-MEV
`5/ MEV bots can't steal your nonce.

Your wallet address is INSIDE the PoW hash.
A copied nonce → different digest → contract revert.

There's literally nothing in the mempool to snipe.

Same design as 0xBitcoin since 2018.`,

  // 6/7 — trustless
`6/ Receipts:

🔥 LP NFT permanently at 0x000…dEaD
🔒 Mining: no owner, no admin, no pause
🚫 Token: no mint function — supply forever 21M
🛡️ bindGenesis self-renounced atomically at deploy

Read the code on Etherscan. Don't trust me.`,

  // 7/7 — CTA
`7/ Mine. Trade. Verify.

⛏️ Mine: https://scientistdapp.online/mine
🚀 Genesis (0.5 ETH cap): https://scientistdapp.online/genesis
📊 Status: https://scientistdapp.online/stats

Ethereum mainnet · Uniswap V4 · WebGPU mining

$POSCI #Ethereum #PoW`,
];

export const THREAD_CHINESE = [
  // 1/7
`🧪 上线 $POSCI 科学家证明

以太坊主网 · 21,000,000 总量 · 无管理员
95% 通过 PoW 挖矿分发，不是卖给你

CA: 0xFbcF59DE93B4c62e0EEe21280c9EAA75AFb1E26c
https://etherscan.io/token/0xFbcF59DE93B4c62e0EEe21280c9EAA75AFb1E26c`,

  // 2/7
`2/ 为什么叫"科学家证明"？

挖矿做的事跟科学一样：
在 hash 空间里硬算，直到现实承认你的猜测

keccak256(challenge ‖ 你的地址 ‖ nonce) ≤ target → 出币

没 ASIC 垄断，浏览器 CPU + WebGPU 就能挖`,

  // 3/7
`3/ 分配 — 无预售、无团队解锁、无 VC：

   50 万 → 部署者（已转入冷钱包）
   50 万 → 初始 LP，烧到 0xdEaD
2000 万 → PoW 挖矿

95.24% 挖矿 · 2.38% LP · 2.38% 部署者`,

  // 4/7
`4/ 双重启动门：

🚪 时间门 — 部署后 12 小时
🚪 池子门 — 创世售卖填满 0.5 ETH 才会触发

那一笔填满的交易同时：建 V4 池 + 加 LP + 烧 LP NFT
原子操作，没有 rug 的窗口`,

  // 5/7
`5/ 为什么 MEV 偷不走你的 nonce：

钱包地址写在 PoW hash 里
别人复制你的 nonce → digest 不一样 → 合约 revert

mempool 里没东西可抢

跟 0xBitcoin 2018 年同款设计`,

  // 6/7
`6/ 凭据：

🔥 LP NFT 永久销毁到 0x000…dEaD
🔒 挖矿合约：无 owner、无管理员、无暂停
🚫 代币：无 mint，总量永远 21M
🛡️ bindGenesis 已原子 renounce

自己读 Etherscan 代码`,

  // 7/7
`7/ 挖矿、交易、自己验证：

⛏️ 挖矿：https://scientistdapp.online/mine
🚀 创世：https://scientistdapp.online/genesis
📊 状态：https://scientistdapp.online/stats

以太坊主网 · Uniswap V4 · WebGPU 挖矿

$POSCI #以太坊 #PoW`,
];

export const STANDALONE = {
  antiMev:
`You can't snipe a $POSCI nonce.

The hash includes the miner's address:
keccak256(challenge ‖ msg.sender ‖ nonce)

Copy a competitor's nonce → digest doesn't match → revert.

There's no MEV surface. By design.

https://scientistdapp.online`,

  fair:
`$POSCI launch checklist:

✅ Verified on Etherscan
✅ LP burned to 0xdEaD on bootstrap
✅ Owner: none — bindGenesis self-renounced
✅ Mint: no function exists
✅ Distribution: 95% via PoW

Nothing to trust. Just code.

https://scientistdapp.online`,

  browser:
`You can mine $POSCI from a Chrome tab.

WebGPU compute shader, custom keccak256 kernel.
Sliders for CPU workers + GPU power.
First valid hash auto-submits.

This is what mining looked like before ASICs.

⛏️ https://scientistdapp.online/mine`,

  techSpecs:
`$POSCI under the hood:

• Solidity 0.8.26, via_ir
• 0xBitcoin-style PoW (anti-MEV)
• Bitcoin schedule: 1000 reward, halving / 10k mines, retarget / 1024
• Uniswap V4 native (PoolManager + Permit2)
• Atomic genesis: same tx fills cap + builds pool + burns LP

https://etherscan.io/token/0xFbcF59DE93B4c62e0EEe21280c9EAA75AFb1E26c`,

  noPresale:
`$POSCI distribution:

❌ No presale
❌ No team allocation
❌ No VC unlock
❌ No marketing budget

✅ 95% via on-chain PoW mining
✅ 0.5 ETH genesis → instantly becomes burned LP
✅ Deployer keeps 2.38%

That's it. That's the model.

https://scientistdapp.online`,
};

export const EVENT_TRIGGERED = {
  miningOpen:
`⛏️ $POSCI mining is OPEN.

Time gate: ✅
Pool gate: ⏳ (waiting for 0.5 ETH genesis to fill)

You can already start hashing — first solver after the pool gate flips wins the first reward.

Connect → Hybrid → Start Mining
https://scientistdapp.online/mine`,

  poolLive:
`🚀 $POSCI genesis filled. V4 pool LIVE.

LP NFT just got burned to 0xdEaD in the same tx.
Mining gate is now OPEN.

Trade: https://app.uniswap.org/#/swap?outputCurrency=0xFbcF59DE93B4c62e0EEe21280c9EAA75AFb1E26c

Mine: https://scientistdapp.online/mine`,
};
