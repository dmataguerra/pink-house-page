import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { config } from 'dotenv';
import { selectBrowser } from '../server/browser';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: resolve(root, '.env.local'), quiet: true });
config({ path: resolve(root, '.env'), quiet: true });
const selectedBrowser = await selectBrowser();
// Always check the denial path, even on a machine with a configured real survey.
process.env.DATASET_MANIFEST = './private/__intentionally_missing_smoke_manifest__.json';
const server = await createServer({ configFile: resolve(root, 'vite.config.ts'), server: { port: 0, strictPort: false }, logLevel: 'error' });
let browser;
try {
  await server.listen();
  const address = server.httpServer!.address();
  assert.ok(address && typeof address !== 'string');
  browser = await chromium.launch({ headless: true, executablePath: selectedBrowser.executablePath });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  const page = await context.newPage();
  const external: string[] = [];
  const origin = `http://127.0.0.1:${address.port}`;
  await context.route('**/*', async route => {
    if (new URL(route.request().url()).origin !== origin) {
      external.push(new URL(route.request().url()).hostname);
      await route.abort('blockedbyclient');
    } else await route.continue();
  });
  await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.flyover?.error));
  const api = await page.evaluate(() => ({ ready: window.flyover.ready, error: window.flyover.error, source: window.flyover.source }));
  assert.equal(api.ready, false);
  assert.match(api.error!, /manifest is missing/);
  assert.equal(api.source.name, '');
  assert.equal(await page.locator('canvas').count(), 0);
  assert.equal(external.length, 0, 'No geographic data or other external content may be requested without a licensed dataset.');
  assert.equal(await page.getByText('A real view needs').count(), 1);
  const output = resolve(root, '../output/verification');
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: resolve(output, 'missing-data.png') });
  console.log('Browser smoke passed at 1920×1080: data gate visible, no 3D canvas, no external requests, no captured house video.');
} finally { await browser?.close(); await server.close(); }
