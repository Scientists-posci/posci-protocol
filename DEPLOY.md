# POSCI Deploy Walkthrough

> 🔒 **The private key never leaves your machine.** Every command below runs on your laptop. Do NOT paste your private key into any chat (including AI), website, or GitHub issue. If you already shared the key from this thread (`0xeb41…0ebc7`), assume it's compromised — generate a new one before doing any of this.

## 0. Generate a fresh deployer key

If you don't already have an offline key:

```bash
# Foundry's `cast` includes a key generator. Save the output to a file
# you control (e.g., a hardware wallet's `cast wallet import --interactive`
# encrypted store).
cast wallet new
```

Output looks like:
```
Successfully created new keypair.
Address:     0x12345...
Private key: 0xabcdef...
```

**Send 0.05–0.10 ETH to that address** (enough for ~3-5 deploy txs at typical mainnet gas).

## 1. Install Foundry + project deps

```bash
# Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Project dependencies
cd posci
forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge install foundry-rs/forge-std --no-commit
```

## 2. Configure `.env`

```bash
cp .env.example .env
$EDITOR .env
```

Fill in:
- `DEPLOYER_PRIVATE_KEY=0x...` (the fresh one from step 0)
- `MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/<your_key>`
- `SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<your_key>`
- `ETHERSCAN_API_KEY=<your_key>` (free at etherscan.io/apis)

## 3. Compile + run unit tests

```bash
forge build
forge test -vv
```

Expected: all `POSCIToken` and `POSCIMining` tests pass without fork. The `POSCIGenesisFork` test self-skips when no `MAINNET_RPC_URL` is set.

## 4. Mainnet-fork integration test (V4 bootstrap)

```bash
forge test --fork-url $MAINNET_RPC_URL --match-contract POSCIGenesisFork -vvv
```

Expected: full bootstrap path including LP NFT going to `0xdEaD`, mining gate flipping open. **If this fails, do not deploy to mainnet.**

## 5. Sepolia rehearsal (strongly recommended)

Sepolia has its own V4 deployment at different addresses. Update `.env` temporarily:
```
V4_POSITION_MANAGER=<sepolia v4 position manager>
PERMIT2=0x000000000022D473030F116dDEE9F6B43aC78BA3   # same on all chains
```

(Look up current Sepolia V4 addresses at https://docs.uniswap.org/contracts/v4/deployments)

```bash
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast --verify -vvv
```

Then:
1. Send 0.5 ETH from a test wallet (or several wallets to respect the 0.05 per-wallet cap) to the genesis contract.
2. Confirm `bootstrapped()` is true and the LP NFT's `ownerOf` is `0x000…dEaD`.
3. Wait until the time gate opens, mine a block from the frontend, confirm POSCI lands.

## 6. Mainnet deploy

Restore mainnet V4 addresses in `.env`:
```
V4_POSITION_MANAGER=0xbD216513d74C8cf14cF4747E6AaA6420FF64ee9e
PERMIT2=0x000000000022D473030F116dDEE9F6B43aC78BA3
MINING_START_DELAY_HOURS=24
```

(Verify the V4 PositionManager address at https://docs.uniswap.org/contracts/v4/deployments before broadcasting — it can change as Uniswap publishes new periphery versions.)

Dry-run first:
```bash
forge script script/Deploy.s.sol:DeployScript --rpc-url $MAINNET_RPC_URL -vvv
```

If the simulation shows the four contracts deploying and the require()s passing, broadcast:

```bash
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $MAINNET_RPC_URL \
  --broadcast --verify -vvv
```

The script logs the three deployed addresses at the end:
```
POSCIToken:    0x...
POSCIMining:   0x...
POSCIGenesis:  0x...
```

**Save these.** The frontend, the marketing materials, and every wallet/CG/CMC submission needs them.

## 7. Wire the frontend

```bash
cd frontend
cp .env.example .env.local
$EDITOR .env.local   # paste the three addresses + your WC project id

npm install
npm run dev          # local sanity check at http://localhost:3000

# When happy, deploy:
npm run build
vercel --prod        # or any other Next.js host
```

## 8. The genesis bootstrap

Genesis can be triggered by anyone — including you. Flow:

```
  10 buyers × 0.05 ETH  →  0.5 ETH cap hit
                              ↓
            same tx: V4 pool created + LP burned + mining gate opens
```

You don't need to participate. If you want to be the bootstrap tx (cool look), just be the 10th buyer. **You'll pay ~3-5x the gas of a normal genesis buy** because your tx also runs `_bootstrap`.

## 9. Submit metadata

Walk through `metadata/trust-wallet-assets.md` — Etherscan token info, Trust Wallet PR, CoinGecko, CoinMarketCap, DexScreener. All require deployer wallet signatures.

## 10. Announce

`marketing/launch-thread.md` has the X thread (English + Chinese) with placeholders. Replace `0xYOUR_CONTRACT` and `YOUR-DOMAIN` and post.

---

## Cost estimate (rough, varies with gas)

| Step | Gas | Cost @ 30 gwei |
|---|---|---|
| Deploy POSCIToken      | ~1.4M | ~0.042 ETH |
| Deploy POSCIMining     | ~1.6M | ~0.048 ETH |
| Deploy POSCIGenesis    | ~3.2M | ~0.096 ETH |
| 2× transfer + bind     | ~150k | ~0.005 ETH |
| Etherscan verify       | 0     | 0          |
| **Total**              | ~6.4M | **~0.19 ETH** |

Plus whoever fires the bootstrap tx pays an extra ~600k gas (~0.018 ETH) on top of their normal genesis buy.

## Costs on Sepolia

Free if you grab from a faucet (e.g., https://sepoliafaucet.com).
