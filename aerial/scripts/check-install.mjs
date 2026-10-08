import { readFile, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// This check uses only Node's standard library so setup can run on a fresh copy.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
try {
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(await readFile(resolve(root, 'package-lock.json'), 'utf8'));
  for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
    const expected = lock.packages[`node_modules/${name}`]?.version;
    const installed = JSON.parse(await readFile(resolve(root, 'node_modules', name, 'package.json'), 'utf8'));
    if (!expected || installed.version !== expected) throw new Error('Installed packages differ from the lockfile.');
  }
  const executable = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const ffmpeg = await stat(resolve(root, 'node_modules/ffmpeg-static', executable));
  if (ffmpeg.size < 1000000) throw new Error('The encoder package is incomplete.');
  console.log('Installed dependencies match the lockfile.');
} catch {
  console.error('Locked dependencies need installation.');
  process.exitCode = 1;
}
