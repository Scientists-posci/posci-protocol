# 部署到 Vercel — 全程指南

> 这一步**没有任何资金风险**。Vercel 部署的是 React 静态站点，钱包连接和合约调用都在用户浏览器里发生。Vercel 服务端永远不接触私钥。

## 你需要先准备的 4 样东西

### 1. Vercel 账号（免费）
注册 https://vercel.com，用 GitHub / GitLab / 邮箱都行。Hobby plan 免费够用。

### 2. WalletConnect / Reown 项目 ID（免费，必需）
没这个钱包连接不会工作。
- 打开 https://cloud.reown.com
- 注册 → New Project → 起个名（"POSCI"）
- 复制那个 32 字符的 **Project ID**
- 在 Reown 的 dashboard 里把允许域名设为你的 Vercel 域名（比如 `posci-xxx.vercel.app` 和你以后绑的自定义域名）

### 3. 一个稳定的以太坊主网 RPC（强烈推荐）
公共 RPC（如 ethereum.publicnode.com）会限速，二级页面一刷新就转圈。建议拿个免费的 Alchemy 或 QuickNode：
- Alchemy：https://dashboard.alchemy.com → Create new app → Ethereum / Mainnet → 拿 HTTPS URL
- 在 Alchemy dashboard 里把 "Allowed origins" 设为你的 Vercel 域名（防 key 被滥用，因为 NEXT_PUBLIC_ 前缀的环境变量会进客户端 bundle）

### 4. 部署后的合约地址
等你按 `DEPLOY.md` 把 3 个合约部署到 mainnet 后，会有：
```
NEXT_PUBLIC_TOKEN_ADDRESS=0x....
NEXT_PUBLIC_MINING_ADDRESS=0x....
NEXT_PUBLIC_GENESIS_ADDRESS=0x....
```

> ⚠ 在合约部署之前你也可以先把前端部署上去（contract 地址保持 0x000...0），状态页会优雅地显示 "addresses not configured"。

---

## 部署方式 A：Vercel CLI（推荐，最快）

```bash
# 1. 装 Vercel CLI
npm i -g vercel

# 2. 进 frontend 目录
cd "C:/Users/18884/Desktop/挖矿/posci/frontend"

# 3. 第一次部署 — Vercel 会问你几个问题
vercel
#   ? Set up and deploy "posci/frontend"? Y
#   ? Which scope? <你的账号>
#   ? Link to existing project? N
#   ? What's your project's name? posci
#   ? In which directory is your code located? ./
#   (Vercel 自动检测到 Next.js)
#   ? Want to modify these settings? N

# 4. CLI 会拿到一个 preview URL，比如 posci-xxx.vercel.app
#    打开看一眼，没问题就推生产：
vercel --prod
```

部署完成后，去 Vercel dashboard → 你的项目 → Settings → Environment Variables，把 4 个 `NEXT_PUBLIC_*` 加进去：

| Key | Value | Environment |
|---|---|---|
| `NEXT_PUBLIC_WC_PROJECT_ID`     | 你 Reown 的 32 字符 ID    | Production, Preview, Development |
| `NEXT_PUBLIC_RPC_URL`           | 你 Alchemy 的 HTTPS URL  | Production, Preview |
| `NEXT_PUBLIC_TOKEN_ADDRESS`     | 部署后填，先放 `0x000...0` | All |
| `NEXT_PUBLIC_MINING_ADDRESS`    | 同上                      | All |
| `NEXT_PUBLIC_GENESIS_ADDRESS`   | 同上                      | All |

加完后**再 redeploy 一次**：Vercel dashboard → Deployments → ⋮ → Redeploy。

---

## 部署方式 B：GitHub 集成（适合后续要自动 CI/CD）

```bash
# 1. 在 posci/ 根目录把代码推到 GitHub
cd "C:/Users/18884/Desktop/挖矿/posci"
git init   # 如果还没初始化
git add .
git commit -m "POSCI launch"
gh repo create posci --public --source=. --push
# 或者你手动建 repo 再 git push origin main

# 2. Vercel dashboard → New Project → Import Git Repository → 选你的 posci repo
#    - Framework Preset: Next.js (自动)
#    - Root Directory: frontend  ← 重要，指向 frontend 子目录
#    - Build/Output: 默认即可
#    - 在这里就能加 Environment Variables
# 3. Deploy
```

之后每次 `git push origin main`，Vercel 自动重新部署。

---

## 验证清单（部署后必看）

✅ 打开 `https://你的域名.vercel.app/`，hero 动画顺、"Connect Wallet" 按钮能弹钱包
✅ 打开 `/stats`，价格卡 + V4 池 + 系统健康清单都不报错（即使 contract 还没部署，应该显示"not bootstrapped"或"addresses not configured"）
✅ 打开 `/mine`，挖矿 UI 显示完整，CPU 滑杆可拖。如果你的浏览器 Chrome 113+，GPU 选项可用
✅ 打开 `/genesis`，能看到 Genesis 卡片（因合约未部署所以数字都是 0）
✅ 打开 DevTools 看 Console 没有红色错误（黄色 warning 可忽略）
✅ Vercel Analytics 里看到首批访问

---

## 自定义域名（可选）

1. 买个域名（Namecheap / Cloudflare / 阿里云都行）
2. Vercel dashboard → Project → Settings → Domains → Add `your-domain.com`
3. Vercel 会给你两条 DNS 记录（CNAME 或 A），到你域名注册商那里加上
4. 几分钟后就生效，HTTPS 证书 Vercel 自动签

记得回 Reown / Alchemy 的允许域名列表里把新域名也加进去。

---

## 我能帮你做的 vs 你必须自己做的

| 我能做 | 你必须自己做 |
|---|---|
| ✅ 写好所有代码、配置 | ❌ 注册 Vercel / Reown / Alchemy 账号（验证邮箱、绑卡） |
| ✅ 写好 `vercel.json` 让 Vercel 一键认识 | ❌ 用你的账号 `vercel` 命令登录授权 |
| ✅ 写好环境变量模板和说明 | ❌ 把你的 Project ID / RPC URL 贴进 Vercel dashboard |
| ✅ 本地 `npm run build` 验证 0 错误 | ❌ 域名解析、买域名 |

**注意**：永远不要把 Vercel token / Reown ID 贴到对话里给我（哪怕是 AI）。这些不算高敏感（不能直接动你的钱），但也是好习惯。

---

## 万一出问题

- **白屏 / Console 报 "Cannot read properties of undefined"**：99% 是环境变量没填好。Vercel dashboard 里检查 4 个 NEXT_PUBLIC_ 变量都在，并触发重新部署
- **钱包弹不出来**：Reown Project ID 没填或域名没加白名单
- **接口 429 / 限速**：换个 RPC，或者升级 Alchemy plan
- **`/stats` 永远转圈**：检查 RPC URL 真的能用（`curl` 一下）
- **合约调用 revert "unknown error"**：合约地址填错链了（可能填了 sepolia 的地址但前端连 mainnet）
