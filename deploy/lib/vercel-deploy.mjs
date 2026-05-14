// Programmatic Vercel deployment for the POSCI frontend.
//
// Flow:
//   1. Validate token (GET /v2/user)
//   2. Find or create the project (GET /v9/projects/<name> → POST /v10/projects)
//   3. Set/update the 5 NEXT_PUBLIC_* env vars (POST /v10/projects/<id>/env)
//   4. Spawn `npx vercel deploy --prod --yes --token=...` from the frontend dir
//   5. Return the production URL printed by the CLI
//
// The CLI handles the dirty work: tarball, file upload, deployment ping,
// log streaming. We use REST only for project + env-var idempotency.

import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT     = resolve(__dirname, '..', '..');     // posci/
const FRONTEND_DIR  = resolve(REPO_ROOT, 'frontend');     // posci/frontend
// Vercel project's rootDirectory='frontend' → run CLI from posci/, not posci/frontend.
// Otherwise CLI looks for posci/frontend/frontend which doesn't exist.
const VERCEL_CWD    = REPO_ROOT;

const VERCEL_API = 'https://api.vercel.com';

async function vercel(token, method, path, body, teamId) {
  const url = new URL(`${VERCEL_API}${path}`);
  if (teamId) url.searchParams.set('teamId', teamId);
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Vercel ${method} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : {};
}

async function findOrCreateProject(token, projectName, teamId) {
  try {
    const proj = await vercel(token, 'GET', `/v9/projects/${projectName}`, null, teamId);
    return { project: proj, existed: true };
  } catch (e) {
    if (!String(e).includes('404')) throw e;
  }
  const created = await vercel(token, 'POST', '/v10/projects', {
    name: projectName,
    framework: 'nextjs',
    rootDirectory: 'frontend',
  }, teamId);
  return { project: created, existed: false };
}

/**
 * Idempotently set an env var on the project for production+preview+development.
 * Vercel's API rejects duplicates, so we delete-then-create.
 */
async function upsertEnv(token, projectId, key, value, teamId) {
  // Delete any existing var with this key (across targets)
  try {
    const list = await vercel(token, 'GET', `/v9/projects/${projectId}/env`, null, teamId);
    for (const e of list.envs ?? []) {
      if (e.key === key) {
        await vercel(token, 'DELETE', `/v9/projects/${projectId}/env/${e.id}`, null, teamId);
      }
    }
  } catch { /* keep going — we'll just try create */ }

  await vercel(token, 'POST', `/v10/projects/${projectId}/env`, {
    key,
    value,
    target: ['production', 'preview', 'development'],
    type: 'plain',
  }, teamId);
}

function spawnVercelCli(token, scope) {
  return new Promise((res, rej) => {
    // Build the command as a single string for shell mode (Windows-safe).
    const scopeFlag = scope ? ` --scope ${scope}` : '';
    const cmd = `npx --yes vercel@latest deploy --prod --yes --token ${token}${scopeFlag}`;

    let stdoutData = '';
    const child = spawn(cmd, [], {
      cwd: VERCEL_CWD,
      stdio: ['inherit', 'pipe', 'inherit'],
      env: { ...process.env, VERCEL_TOKEN: token },
      shell: true,
    });
    child.stdout.on('data', (chunk) => {
      const s = chunk.toString();
      stdoutData += s;
      process.stdout.write(s);
    });
    child.on('exit', (code) => {
      if (code !== 0) return rej(new Error(`vercel deploy exited ${code}`));
      const urlMatch = stdoutData.match(/https:\/\/[a-zA-Z0-9.-]+\.vercel\.app/g);
      const productionUrl = urlMatch ? urlMatch[urlMatch.length - 1] : null;
      res({ productionUrl, raw: stdoutData });
    });
    child.on('error', rej);
  });
}

/**
 * Top-level: deploy frontend to Vercel with deployed contract addresses
 * baked in as NEXT_PUBLIC_* env vars.
 *
 * @returns {Promise<{ productionUrl, projectId, projectName }>}
 */
export async function deployFrontendToVercel({
  vercelConfig, contractAddresses, rpcUrl,
}) {
  if (!vercelConfig?.token) throw new Error('vercel.token missing');
  const { token, projectName = 'posci', teamId = '', wcProjectId = '' } = vercelConfig;

  // 1. Auth check
  const me = await vercel(token, 'GET', '/v2/user', null, teamId);
  console.log(`  [vercel] authenticated as ${me.user?.username || me.user?.email}`);

  // 1b. Resolve scope (CLI needs --scope in non-interactive mode).
  //     Pick the first team if any, else fall back to the user's username.
  let scope = teamId;
  if (!scope) {
    try {
      const teams = await vercel(token, 'GET', '/v2/teams', null);
      if (teams.teams?.length) {
        scope = teams.teams[0].slug;
        console.log(`  [vercel] using team scope: ${scope}`);
      } else {
        scope = me.user?.username || '';
        console.log(`  [vercel] using personal scope: ${scope}`);
      }
    } catch {
      scope = me.user?.username || '';
    }
  }

  // 2. Project
  const { project, existed } = await findOrCreateProject(token, projectName, teamId);
  console.log(`  [vercel] project '${projectName}' (${project.id}) — ${existed ? 'existed' : 'created'}`);

  // 3. Env vars
  const envs = {
    NEXT_PUBLIC_TOKEN_ADDRESS:   contractAddresses.tokenAddress,
    NEXT_PUBLIC_MINING_ADDRESS:  contractAddresses.miningAddress,
    NEXT_PUBLIC_GENESIS_ADDRESS: contractAddresses.genesisAddress,
    NEXT_PUBLIC_RPC_URL:         rpcUrl || '',
    NEXT_PUBLIC_WC_PROJECT_ID:   wcProjectId || '',
  };
  for (const [k, v] of Object.entries(envs)) {
    if (v) {
      await upsertEnv(token, project.id, k, v, teamId);
      console.log(`  [vercel] env ${k} = ${v.slice(0, 12)}…`);
    }
  }

  // 4. Write .vercel/project.json so the CLI is "linked" without interactive prompts
  //    Need the actual orgId (team_xxx) — fetch from the team list when scope is a team slug.
  let orgId;
  try {
    const teamsList = await vercel(token, 'GET', '/v2/teams', null);
    const matchedTeam = teamsList.teams?.find(t => t.slug === scope);
    orgId = matchedTeam?.id || me.user?.id;
  } catch {
    orgId = me.user?.id;
  }
  // .vercel/project.json must live next to where we run the CLI from
  const dotVercelDir = resolve(VERCEL_CWD, '.vercel');
  mkdirSync(dotVercelDir, { recursive: true });
  writeFileSync(resolve(dotVercelDir, 'project.json'),
    JSON.stringify({ projectId: project.id, orgId }, null, 2) + '\n');
  console.log(`  [vercel] linked .vercel/project.json (orgId=${orgId}, projectId=${project.id})`);

  // 5. Trigger deploy via CLI (handles file upload)
  console.log(`  [vercel] running 'npx vercel deploy --prod' from ${VERCEL_CWD}`);
  const { productionUrl } = await spawnVercelCli(token, scope);

  return {
    productionUrl: productionUrl ?? `https://${projectName}.vercel.app`,
    projectId:     project.id,
    projectName,
  };
}
