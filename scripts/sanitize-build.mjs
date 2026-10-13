import { existsSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, relative, isAbsolute } from 'node:path';

// These legacy fonts have no verified redistribution license (docs/BRAND.md).
// Keep the original workspace files; omit them from the deliverable build.
const project = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(project, 'dist');
const fonts = resolve(output, 'fonts');
for (const file of existsSync(fonts) ? readdirSync(fonts, { withFileTypes: true }) : []) {
  if (!file.isFile() || !/^FoundersGrotesk-.*\.woff2$/.test(file.name)) continue;
  const target = resolve(fonts, file.name);
  const withinOutput = relative(output, target);
  if (withinOutput.startsWith('..') || isAbsolute(withinOutput)) throw new Error('Invalid build font path.');
  rmSync(target);
}
