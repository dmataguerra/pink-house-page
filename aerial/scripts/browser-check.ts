import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectBrowser } from '../server/browser';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: resolve(root, '.env.local'), quiet: true });
config({ path: resolve(root, '.env'), quiet: true });
try {
  const browser = await selectBrowser();
  console.log(`Browser ready: ${browser.label}.`);
} catch {
  console.error(process.env.CHROMIUM_PATH ? 'CHROMIUM_PATH does not identify an available browser.' : 'No installed Chromium-family browser was found.');
  process.exitCode = process.env.CHROMIUM_PATH ? 2 : 3;
}
