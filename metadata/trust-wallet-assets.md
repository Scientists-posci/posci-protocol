# 钱包 / 列表提交清单

部署完成、合约 verified、池子上线之后，按下面这个顺序走。每一步都需要部署者钱包签名，**不要把私钥交给任何人**。

---

## 0. 准备物料（一次性）

- [ ] `posci-logo-256.png` — 256×256，PNG，透明底，< 100KB
- [ ] `posci-logo-svg.svg` — 矢量原版（备用）
- [ ] 合约地址（部署后）：`0x________________________________________`
- [ ] Etherscan 链接：`https://etherscan.io/token/0x...`
- [ ] 域名：`https://________________`
- [ ] X 账号：`https://x.com/________________`
- [ ] 项目一句话简介（中英）：见 `marketing/website-copy.md`

---

## 1. Etherscan Token Update（最重要，钱包/聚合器都从这里抓）

1. 打开 `https://etherscan.io/token/<contract>`
2. 右上角 "More" → "Update Token Info"
3. 用部署者钱包签 EIP-712 消息
4. 上传 logo + 填官网 + 填 X + 填 Telegram/Discord（如有）
5. 提交，等 24-48h 审核

**不需要**给 Etherscan 钱也能过，但内容必须真实。

---

## 2. Trust Wallet Assets repo（间接驱动 MetaMask 的 logo）

1. fork `https://github.com/trustwallet/assets`
2. 在 `blockchains/ethereum/assets/<CHECKSUMMED_ADDRESS>/` 下放：
   - `logo.png` (256x256, < 100KB)
   - `info.json`（模板见下）
3. 提 PR，标题 `Add POSCI (Proof of Scientist)`
4. 通过后，自动同步到 Trust Wallet / MetaMask / 部分 DEX 聚合器

**`info.json` 模板**：

```json
{
  "name": "Proof of Scientist",
  "type": "ERC20",
  "symbol": "POSCI",
  "decimals": 18,
  "website": "https://YOUR-DOMAIN",
  "description": "Fair-launch PoW mining token on Ethereum mainnet. 21M cap, no owner, no mint, LP burned. 20M emitted via Bitcoin-style proof-of-work mining.",
  "explorer": "https://etherscan.io/token/0xYOUR_CONTRACT",
  "status": "active",
  "id": "0xYOUR_CONTRACT",
  "links": [
    { "name": "twitter",  "url": "https://x.com/YOUR_HANDLE" },
    { "name": "github",   "url": "https://github.com/YOUR_REPO" }
  ],
  "tags": ["defi"]
}
```

---

## 3. CoinGecko 申请

1. `https://www.coingecko.com/en/coins/new`
2. 填表，需提供：
   - 合约地址 / 链
   - Logo（直接上传）
   - 项目简介（≥ 200 字，照抄 `marketing/website-copy.md` 的 EN 版本）
   - 主流交易场所链接（Uniswap V4 池子）：`https://app.uniswap.org/#/swap?outputCurrency=0xYOUR_CONTRACT&chain=ethereum`
   - GeckoTerminal 已抓到的池子链接（一般 24h 内自动出现）
3. 审核 5-15 天

---

## 4. CoinMarketCap 申请

1. `https://coinmarketcap.com/request/`
2. 选 "Add cryptoasset"
3. 填的字段和 CG 几乎一样
4. 审核 1-3 周

---

## 5. Uniswap Default Token List（可选，但有助于在官方界面默认显示）

1. fork `https://github.com/Uniswap/default-token-list`
2. 把本仓库 `metadata/tokenlist.json` 里的 token 项加到他们的列表
3. 提 PR

通常需要：MarketCap > 阈值、社区呼声、足够交易量。**新发币基本不会立刻通过**，
但你也可以自托管 `tokenlist.json` 然后在 Uniswap UI "Manage" → "Lists" 让用户手动添加你的列表 URL。

---

## 6. DEX Screener / DexTools 资料完善

部署 + 池子上线后通常自动收录，但要补全资料才显示完整：

- DexScreener: `https://dexscreener.com/ethereum/0xYOUR_POOL_ADDRESS` → "Update token info" → 钱包签名 → 上传 logo + 链接 (~$300)
- DexTools: 同理，"Update Logo & Social Links" (~$50-100)

这两个不是必须，但能让二级市场看起来"正经"。

---

## 7. MetaMask 自动 logo

不用单独提交 — 步骤 2 (Trust Wallet) 通过后，MetaMask 会自动从 Trust Wallet 仓库拉。
如果 24-48h 后 MetaMask 还没显示 logo，检查 Trust Wallet PR 是否真的合入。

---

## 验收清单

- [ ] Etherscan token page 显示 logo + 简介 + 链接
- [ ] Trust Wallet PR 已合入
- [ ] MetaMask 添加自定义代币时能看到 logo
- [ ] CoinGecko 已收录（搜索 "POSCI" 能找到）
- [ ] DexScreener 池子页面显示 logo + X + 官网
