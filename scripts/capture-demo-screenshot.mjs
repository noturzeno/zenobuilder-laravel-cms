/**
 * Capture docs/demo-screenshot.png from examples/minimal-builder.html.
 * Requires: npx serve (started separately) or pass BASE_URL env.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'docs');
const outFile = join(outDir, 'demo-screenshot.png');
const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:3456';
const url = `${baseUrl.replace(/\/$/, '')}/minimal-builder.html`;

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
});

await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
await page.waitForTimeout(500);

await page.screenshot({ path: outFile, fullPage: true });
await browser.close();

console.log(`Wrote ${outFile}`);
