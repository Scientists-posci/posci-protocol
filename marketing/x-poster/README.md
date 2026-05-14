# POSCI X poster

Programmatic launch posting for `@scientistsdapp`. Reads creds from `config.js`,
posts the launch thread (or any single tweet) via X API v2, persists posted
tweet IDs so re-runs don't double-post.

## One-time setup

```bash
cd marketing/x-poster
npm install
cp config.example.js config.js
# Edit config.js — paste 4 OAuth 1.0a strings
```

### How to get the 4 OAuth 1.0a strings (~5 min)

1. **Sign in to https://developer.twitter.com/en/portal/dashboard with the @scientistsdapp account.** (The 4 keys belong to whoever signs in.)
2. If first time:
   - Click **"Sign up for Free Account"** — answer the use-case form (anything legitimate)
   - Click **"Create Project"** → name `posci-launch` → use case "Doing something else"
3. Open the auto-created App → **Settings** tab → **User authentication settings**:
   - App permissions: **Read and write**
   - Type of App: **Web App, Automated App or Bot**
   - Callback URI / Redirect URL: `http://localhost`
   - Website URL: `https://scientistdapp.online`
   - **Save**
4. Switch to **Keys and tokens** tab:
   - "API Key and Secret" → **Generate** → copy `API Key` + `API Key Secret` → paste into `config.js` as `appKey` + `appSecret`
   - "Access Token and Secret" → **Generate** → confirm permissions show **"Read and write"** → copy both → paste as `accessToken` + `accessSecret`

If you generated tokens BEFORE setting Read+Write in step 3, **regenerate them** in step 4.

## Use

```bash
# Always preview first to see what would be posted
npm run dry

# Post the English launch thread (7 tweets, auto-chained as replies)
npm run post:thread:en

# Post the Chinese version
npm run post:thread:zh

# Post the pinned tweet (you'll need to pin it manually on x.com afterwards)
npm run post:pinned:en

# Post a single standalone tweet
node post.mjs --standalone antiMev
node post.mjs --standalone fair
node post.mjs --standalone browser
node post.mjs --standalone techSpecs
node post.mjs --standalone noPresale

# Event-triggered tweets (post when these happen on chain)
node post.mjs --event miningOpen     # post when time gate opens
node post.mjs --event poolLive       # post when V4 pool initializes
```

Each run prints the tweet URL(s) and writes them to `.posted.json` (git-ignored).
If a thread / standalone has already been posted, the script refuses to re-post.

## Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  POSCI X poster
  Account: @scientistsdapp
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

▸ Verifying credentials
  ✓ authenticated as @scientistsdapp (id 1234567890)

▸ Posting 7-tweet thread (english)…
  ✓ Tweet 1/7 → https://x.com/i/web/status/1991234567890123456
  ✓ Tweet 2/7 → https://x.com/i/web/status/1991234567890123457
  ✓ Tweet 3/7 → https://x.com/i/web/status/1991234567890123458
  ✓ Tweet 4/7 → https://x.com/i/web/status/1991234567890123459
  ✓ Tweet 5/7 → https://x.com/i/web/status/1991234567890123460
  ✓ Tweet 6/7 → https://x.com/i/web/status/1991234567890123461
  ✓ Tweet 7/7 → https://x.com/i/web/status/1991234567890123462

DONE.
```

## Safety

- `config.js` is git-ignored
- `.posted.json` records what's been posted; the script refuses to double-post
  unless you delete the relevant entry
- Always run `npm run dry` first to see exactly what will be posted
- After the launch, **revoke the access tokens** at https://developer.twitter.com
  (Apps → Keys and tokens → Access Token and Secret → Revoke)

## Editing tweet content

All tweet bodies live in `tweets.mjs`. Edit there and re-run.
The companion human-readable copy is in `../x-launch-pack.md` — keep both in sync.

## Pinning

X API v2 doesn't expose a "pin" endpoint anymore. After running
`npm run post:pinned:en`, open the printed URL and pin manually:
tweet → ⋯ menu → "Pin to your profile".
