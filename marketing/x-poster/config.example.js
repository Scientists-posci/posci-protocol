// =============================================================================
//  X (Twitter) credentials for the @scientistsdapp launch
// =============================================================================
//
//  How to get these 4 strings (one-time, ~5 minutes):
//
//    1. Go to https://developer.twitter.com/en/portal/dashboard
//       Sign in with the @scientistsdapp account (the account that will post).
//
//    2. If you don't have a Project yet:
//         → Click "Create Project" → name it "posci-launch" → use case: Doing
//           something else → confirm.
//         → It auto-creates an App inside the project.
//
//    3. Open the App → "Keys and tokens" tab:
//         a. "API Key and Secret"        → Generate → copy BOTH strings → paste below
//         b. "Access Token and Secret"   → Generate → make sure the permissions are
//            "Read AND Write" (default is Read-only — change in app settings first!).
//            Copy BOTH strings → paste below.
//
//    4. In the App's "User authentication settings":
//         App permissions     → "Read and write"
//         Type of App         → "Web App, Automated App or Bot"
//         Callback URI        → http://localhost (placeholder, not used)
//         Website URL         → https://scientistdapp.online
//       Save. If you generated tokens BEFORE setting Read/Write, regenerate them.
//
//  IMPORTANT:
//    - This file is git-ignored. Don't paste creds anywhere else (chat, screenshots).
//    - After the launch, REVOKE the tokens at the same dashboard.
//
// =============================================================================

export default {
  // OAuth 1.0a User Context — 4 strings from the App's "Keys and tokens" tab
  appKey:        'YOUR_API_KEY',           // a.k.a. "API Key" / "Consumer Key"
  appSecret:     'YOUR_API_KEY_SECRET',    // a.k.a. "API Key Secret"
  accessToken:   'YOUR_ACCESS_TOKEN',
  accessSecret:  'YOUR_ACCESS_TOKEN_SECRET',

  // Optional safety knobs
  dryRun:        false,                    // if true, prints tweets without posting
  delayBetweenSeconds: 3,                  // seconds between thread tweets (rate-limit friendly)

  // The account that will post (used only for log output)
  handle:        '@scientistsdapp',
};
