import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { loadDataset } from '../server/dataset';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: resolve(root, '.env.local'), quiet: true });
config({ path: resolve(root, '.env'), quiet: true });
try {
  const data = await loadDataset(root);
  console.log(JSON.stringify({ status: 'manifest-authorized', dataset: data.name, evidenceSha256: data.licenseEvidenceSha256, geometry: 'Requires live mesh and camera checks before capture.' }, null, 2));
} catch (error) {
  const message = error instanceof Error ? error.message : 'Preflight failed.';
  console.error(message.startsWith('[') ? 'Manifest validation failed. Required fields: surveyed provenance, textures, export/distribution rights, license reference and reviewer.' : message);
  process.exitCode = 2;
}
