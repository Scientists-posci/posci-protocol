// Renders the SVG token logo to PNG at the sizes wallets/explorers want.
// Uses Chrome headless (zero npm deps), reads the project's master SVG.

import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

function findChrome() {
  for (const path of CHROME_CANDIDATES) {
    if (existsSync(path)) return path;
  }
  throw new Error('No Chrome/Edge binary found. Install Chrome or set CHROME_PATH.');
}

/**
 * Render the master SVG at given pixel sizes, write PNGs to `outDir`.
 * Sizes covered: 32, 64, 128, 256, 512, 1024.
 * Returns the list of generated file paths.
 */
export function renderLogos(outDir) {
  const masterSvg = resolve(REPO_ROOT, 'metadata', 'posci-logo.svg');
  if (!existsSync(masterSvg)) {
    throw new Error(`Master logo SVG missing at ${masterSvg}`);
  }
  mkdirSync(outDir, { recursive: true });

  // Copy SVG verbatim — wallets that accept SVG (esp. token lists) prefer vector.
  copyFileSync(masterSvg, resolve(outDir, 'posci-logo.svg'));

  const chrome = process.env.CHROME_PATH || findChrome();
  const svgContent = readFileSync(masterSvg, 'utf8');
  const generated = [resolve(outDir, 'posci-logo.svg')];

  const sizes = [32, 64, 128, 256, 512, 1024];

  for (const size of sizes) {
    // Build a tiny HTML wrapper that draws ONLY the SVG at the exact pixel size.
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;background:transparent;}
body{width:${size}px;height:${size}px;display:block;overflow:hidden;}
svg{width:${size}px;height:${size}px;display:block;}
</style></head><body>${svgContent}</body></html>`;

    const htmlPath = resolve(outDir, `_render-${size}.html`);
    const outPath  = resolve(outDir, `posci-logo-${size}.png`);
    writeFileSync(htmlPath, html);

    const fileUrl = process.platform === 'win32'
      ? 'file:///' + htmlPath.replace(/\\/g, '/')
      : 'file://' + htmlPath;

    const args = [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--default-background-color=00000000',
      `--window-size=${size},${size}`,
      `--screenshot=${outPath}`,
      fileUrl,
    ];
    const r = spawnSync(chrome, args, { stdio: 'pipe', encoding: 'utf8' });
    if (r.status !== 0 && !existsSync(outPath)) {
      throw new Error(`Chrome failed rendering ${size}px:\n${r.stderr || r.stdout}`);
    }
    generated.push(outPath);
    // Clean up the temp HTML
    try {
      const { unlinkSync } = require('node:fs');
      unlinkSync(htmlPath);
    } catch { /* ignore */ }
  }

  return generated;
}
