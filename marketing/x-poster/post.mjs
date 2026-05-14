#!/usr/bin/env node
//
//  POSCI X poster
//
//  Reads ./config.js for OAuth credentials, posts the requested content via
//  X API v2, and writes posted tweet IDs to .posted.json so re-runs don't
//  double-post.
//
//  Usage:
//    node post.mjs --thread english     # post the 7-tweet English launch thread
//    node post.mjs --thread chinese     # post the 7-tweet Chinese launch thread
//    node post.mjs --pinned english     # post just the pinned tweet (English)
//    node post.mjs --pinned chinese     # post just the pinned tweet (Chinese)
//    node post.mjs --standalone <name>  # post one standalone (antiMev / fair / browser / techSpecs / noPresale)
//    node post.mjs --event <name>       # post an event-triggered tweet (miningOpen / poolLive)
//    node post.mjs --dry-run --thread english    # print only, don't post
//

import { TwitterApi } from 'twitter-api-v2';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PINNED, THREAD_ENGLISH, THREAD_CHINESE, STANDALONE, EVENT_TRIGGERED,
} from './tweets.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, 'config.js');
const STATE_PATH  = resolve(__dirname, '.posted.json');

const COLOR = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m',
};
const log = {
  step: (s) => console.log(`\n${COLOR.cyan}${COLOR.bold}▸ ${s}${COLOR.reset}`),
  ok:   (s) => console.log(`${COLOR.green}  ✓${COLOR.reset} ${s}`),
  warn: (s) => console.log(`${COLOR.yellow}  ⚠${COLOR.reset} ${s}`),
  err:  (s) => console.error(`${COLOR.red}  ✗${COLOR.reset} ${s}`),
  info: (s) => console.log(`${COLOR.dim}    ${s}${COLOR.reset}`),
};

// ---------------- arg parsing ----------------
const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');

function flag(name) {
  const i = argv.indexOf(name);
  if (i < 0) return null;
  return argv[i + 1] || true;
}

const threadLang     = flag('--thread');     // 'english' | 'chinese'
const pinnedLang     = flag('--pinned');     // 'english' | 'chinese'
const standaloneName = flag('--standalone'); // string in STANDALONE keys
const eventName      = flag('--event');      // string in EVENT_TRIGGERED keys

if (!threadLang && !pinnedLang && !standaloneName && !eventName) {
  console.error('Specify one of:');
  console.error('  --thread <english|chinese>');
  console.error('  --pinned <english|chinese>');
  console.error('  --standalone <antiMev|fair|browser|techSpecs|noPresale>');
  console.error('  --event <miningOpen|poolLive>');
  console.error('Add --dry-run to preview without posting.');
  process.exit(2);
}

// ---------------- config loader ----------------
async function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    log.err('config.js missing. Copy config.example.js → config.js and fill it in.');
    process.exit(2);
  }
  const mod = await import('file://' + CONFIG_PATH);
  const cfg = mod.default;
  if (!DRY_RUN) {
    const need = ['appKey', 'appSecret', 'accessToken', 'accessSecret'];
    for (const k of need) {
      const v = cfg[k];
      if (!v || /YOUR_|PASTE/.test(v)) {
        log.err(`config.${k} missing or placeholder text`);
        process.exit(2);
      }
    }
  }
  return cfg;
}

function loadState() {
  if (!existsSync(STATE_PATH)) return {};
  try { return JSON.parse(readFileSync(STATE_PATH, 'utf8')); } catch { return {}; }
}
function saveState(s) {
  writeFileSync(STATE_PATH, JSON.stringify(s, null, 2) + '\n');
}

// ---------------- weighted char counter (Latin=1, CJK=2; URLs auto=23) ----------------
function tweetWeight(text) {
  // Replace URLs with 23 placeholder chars
  const urlRe = /https?:\/\/\S+/g;
  const urlless = text.replace(urlRe, 'x'.repeat(23));
  let n = 0;
  for (const ch of urlless) {
    const cp = ch.codePointAt(0);
    // Rough CJK weighting: anything outside basic Latin counts double
    n += cp > 0x024F ? 2 : 1;
  }
  return n;
}

// ---------------- core posters ----------------
async function postThread(client, tweets) {
  const state = loadState();
  const threadKey = `thread:${threadLang}`;
  if (state[threadKey]) {
    log.warn(`Thread already posted: ${state[threadKey].url}`);
    log.info(`Delete .posted.json to allow re-post.`);
    return;
  }

  // Pre-flight: warn on overweight tweets
  const overweight = tweets.map((t, i) => ({ i, w: tweetWeight(t) })).filter(x => x.w > 280);
  if (overweight.length) {
    log.warn(`The following tweets are over 280 weighted chars and will be rejected by X:`);
    for (const { i, w } of overweight) log.info(`  Tweet ${i + 1}: ${w} weighted chars`);
    log.info(`Edit tweets.mjs to shorten them.`);
    process.exit(1);
  }

  if (DRY_RUN) {
    log.warn(`DRY RUN — would post ${tweets.length} tweets:`);
    tweets.forEach((t, i) => {
      console.log(`\n${COLOR.dim}─── Tweet ${i + 1}/${tweets.length} (${tweetWeight(t)} weighted chars) ───${COLOR.reset}`);
      console.log(t);
    });
    return;
  }

  log.step(`Posting ${tweets.length}-tweet thread (${threadLang})…`);
  const result = await client.v2.tweetThread(tweets);
  // result is array of TweetV2PostTweetResult objects with .data.id
  const posted = result.map((r, i) => ({
    n: i + 1,
    id: r.data.id,
    url: `https://x.com/i/web/status/${r.data.id}`,
  }));
  for (const p of posted) log.ok(`Tweet ${p.n}/${tweets.length} → ${p.url}`);

  state[threadKey] = {
    posted_at: new Date().toISOString(),
    tweets: posted,
    url: posted[0].url,  // canonical thread URL = first tweet
  };
  saveState(state);
}

async function postSingle(client, text, key) {
  const state = loadState();
  if (state[key]) {
    log.warn(`Already posted: ${state[key].url}`);
    log.info(`Delete .posted.json or remove this entry to allow re-post.`);
    return;
  }
  const w = tweetWeight(text);
  if (w > 280) {
    log.err(`Tweet is ${w} weighted chars (limit 280). Aborting.`);
    process.exit(1);
  }

  if (DRY_RUN) {
    log.warn(`DRY RUN — would post (${w} weighted chars):`);
    console.log('\n' + text);
    return;
  }

  log.step(`Posting…`);
  const r = await client.v2.tweet(text);
  const url = `https://x.com/i/web/status/${r.data.id}`;
  log.ok(url);
  state[key] = { posted_at: new Date().toISOString(), id: r.data.id, url };
  saveState(state);
}

// ---------------- main ----------------
async function main() {
  const cfg = await loadConfig();

  console.log(`${COLOR.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLOR.reset}`);
  console.log(`${COLOR.bold}  POSCI X poster${COLOR.reset}`);
  console.log(`  Account: ${cfg.handle}`);
  if (DRY_RUN) console.log(`${COLOR.yellow}  DRY RUN MODE — no tweets will be posted${COLOR.reset}`);
  console.log(`${COLOR.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLOR.reset}`);

  const client = new TwitterApi({
    appKey:       cfg.appKey,
    appSecret:    cfg.appSecret,
    accessToken:  cfg.accessToken,
    accessSecret: cfg.accessSecret,
  });

  // Verify auth before doing anything
  if (!DRY_RUN) {
    log.step('Verifying credentials');
    try {
      const me = await client.v2.me();
      log.ok(`authenticated as @${me.data.username} (id ${me.data.id})`);
    } catch (e) {
      log.err(`Auth failed: ${e.message ?? e}`);
      log.info('Check that the app has Read AND Write permissions, and that');
      log.info('the access tokens were generated AFTER setting Read+Write.');
      process.exit(1);
    }
  }

  if (threadLang) {
    const tweets = threadLang === 'english' ? THREAD_ENGLISH
                 : threadLang === 'chinese' ? THREAD_CHINESE
                 : null;
    if (!tweets) {
      log.err(`Unknown thread language: ${threadLang}`); process.exit(2);
    }
    await postThread(client, tweets);
  } else if (pinnedLang) {
    const text = PINNED[pinnedLang];
    if (!text) { log.err(`Unknown pinned language: ${pinnedLang}`); process.exit(2); }
    await postSingle(client, text, `pinned:${pinnedLang}`);
    log.info(`To pin: open the tweet on x.com → ⋯ → Pin to your profile`);
  } else if (standaloneName) {
    const text = STANDALONE[standaloneName];
    if (!text) { log.err(`Unknown standalone: ${standaloneName}. Options: ${Object.keys(STANDALONE).join(', ')}`); process.exit(2); }
    await postSingle(client, text, `standalone:${standaloneName}`);
  } else if (eventName) {
    const text = EVENT_TRIGGERED[eventName];
    if (!text) { log.err(`Unknown event: ${eventName}. Options: ${Object.keys(EVENT_TRIGGERED).join(', ')}`); process.exit(2); }
    await postSingle(client, text, `event:${eventName}`);
  }

  console.log(`\n${COLOR.bold}DONE.${COLOR.reset}`);
}

main().catch((e) => {
  console.error(`\n${COLOR.red}${COLOR.bold}FATAL${COLOR.reset}\n${e.stack ?? e.message ?? e}`);
  process.exit(1);
});
