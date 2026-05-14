# v1 → v2 migration announcement (draft)

Fill in the `{{...}}` placeholders after deploy. Post from `@scientistsdapp`.

---

## Pinned thread

**1/ 🪦 POSCI v1 had a structural deadlock. v2 fixes it.**

v1 needed 0.5 ETH in Genesis before mining could start. Organic raise stalled at 0.0006 ETH after launch. Without that fill, the pool gate stayed closed and mining was permanently locked.

That's not "slow launch" — that's a dead protocol.

**2/ What v2 changes**

POSCIGenesis adds a single new function: `forceBootstrap()`.

- Permissionless (anyone can call)
- Unlocks 24 hours after deploy
- Uses whatever ETH has been raised (proportional LP at the original 1 ETH = 500K POSCI ratio)
- Below 0.01 ETH? burn unsold POSCI, open mining gate, no initial pool
- Same immutability story: no admin, no upgrade, no pause, no fee

POSCIToken and POSCIMining are unchanged byte-for-byte.

**3/ New contract addresses**

- Token:   `{{NEW_TOKEN_ADDRESS}}`
- Mining:  `{{NEW_MINING_ADDRESS}}`
- Genesis: `{{NEW_GENESIS_ADDRESS}}`

v1 (deprecated, do not interact):
- Token:   `0xD020e5E5c2724B2661C2FEF9AE878f49410a8B77`
- Mining:  `0x9EAdD7dF7701e03d07c3727EC1ba816C2C9De936`
- Genesis: `0x7bC1520Da49Cd56D5BE11aA77650cA998951459d`

**4/ For the v1 buyer**

One wallet bought 0.0006 ETH worth of POSCI on v1. They were made whole:

- ETH refund tx: `{{REFUND_TX_HASH}}`
- New POSCI airdrop tx: `{{AIRDROP_TX_HASH}}`

Both signed from the deployer wallet within the same window as v2 deploy. No one is left holding worthless v1 tokens.

**5/ Mining will unlock when**

- 24 hours after deploy: `{{V2_MINING_UNLOCK_UTC}}` UTC
- ...whether or not Genesis filled.

If Genesis still hasn't filled by then, anyone — including you — can hit "Force unlock mining" on scientistdapp.online/genesis. The contract handles the rest.

**6/ Open-source, audited, verified**

- Source on Etherscan: links above
- Tests: 37 pass on mainnet fork (including 6 new forceBootstrap edge cases)
- Source repo: {{GITHUB_REPO_URL}}
- Self-audit: AUDIT.md in repo

Same fair-launch ethos. Same chain. Same wallet — same deployer EOA. Just an unstuck Genesis.

---

## Shorter standalone post (for non-thread)

POSCI v2 is live.

v1 Genesis cap-fill stalled, leaving mining permanently gated. v2 adds a permissionless `forceBootstrap()` that anyone can call 24h after deploy to finalize Genesis with whatever ETH was actually raised.

The v1 buyer was refunded ETH and airdropped equivalent v2 POSCI.

- Token: `{{NEW_TOKEN_ADDRESS}}`
- Mining: `{{NEW_MINING_ADDRESS}}`
- Genesis: `{{NEW_GENESIS_ADDRESS}}`

scientistdapp.online
