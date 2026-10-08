import { mkdir, open, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { chromium, type APIResponse, type Browser } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { loadDataset } from '../server/dataset';
import { selectBrowser } from '../server/browser';
import {
  REQUIRED_SPEC, binaryPaths, measureImage, redact, runProcess,
  validateFrame, validateGeometry, validateRun, validateSource,
  type RunManifest,
} from './qa';

const aerialRoot = fileURLToPath(new URL('../', import.meta.url));
const repoRoot = path.resolve(aerialRoot, '..');
const outputRoot = path.join(repoRoot, 'output');

export function prohibitedGoogleUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return ['google.com', 'googleapis.com', 'gstatic.com', 'googleusercontent.com', 'ggpht.com', 'goo.gl']
      .some((domain) => host === domain || host.endsWith(`.${domain}`)) || /(^|\.)google\.[a-z.]{2,}$/.test(host);
  } catch { return false; }
}

export function redirectViolation(requestUrl: string, status: number, location?: string): string | null {
  if (status < 300 || status >= 400) return null;
  const destination = location ? new URL(location, requestUrl) : new URL(requestUrl);
  return prohibitedGoogleUrl(destination.toString()) ? destination.hostname : `unsupported redirect: ${new URL(requestUrl).hostname}`;
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function deadline<T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); })]);
  } finally { if (timer) clearTimeout(timer); }
}

async function exists(file: string): Promise<boolean> {
  try { await stat(file); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
}

/** Preserve previous deliverables, and publish by a same-volume rename only after QA. */
async function publish(partialVideo: string, manifestFile: string, qaFile: string, stamp: string, manifest: RunManifest) {
  const finalVideo = path.join(outputRoot, 'house_flyover.mp4');
  const finalManifest = path.join(outputRoot, 'house_flyover.manifest.json');
  const finalQa = path.join(outputRoot, 'house_flyover.qa.json');
  const targets = [finalVideo, finalManifest, finalQa];
  const originals: Array<{ final: string; backup: string }> = [];
  const published: string[] = [];
  try {
    for (const final of targets) {
      if (await exists(final)) {
        requireCondition((await stat(final)).isFile(), `Cannot replace non-file output ${path.basename(final)}.`);
        const backup = path.join(outputRoot, `${path.parse(final).name}.previous-${stamp}${path.extname(final)}`);
        requireCondition(path.dirname(backup) === outputRoot, 'Backup path escaped the output directory.');
        requireCondition(!(await exists(backup)), 'Previous-output backup already exists.');
        await rename(final, backup);
        originals.push({ final, backup });
      }
    }
    manifest.status = 'validated';
    manifest.publishedVideo = 'output/house_flyover.mp4';
    await writeFile(manifestFile, JSON.stringify(manifest, null, 2));
    // The MP4 is committed last; its existence therefore implies sidecars were published.
    await rename(manifestFile, finalManifest); published.push(finalManifest);
    await rename(qaFile, finalQa); published.push(finalQa);
    await rename(partialVideo, finalVideo); published.push(finalVideo);
  } catch (error) {
    for (const final of published.reverse()) {
      const recovery = path.join(path.dirname(partialVideo), `unpublished-${path.basename(final)}`);
      await rename(final, recovery).catch(() => undefined);
    }
    for (const original of originals.reverse()) await rename(original.backup, original.final).catch(() => undefined);
    throw error;
  }
}

export async function render(): Promise<void> {
  loadDotenv({ path: path.join(aerialRoot, '.env.local'), quiet: true });
  loadDotenv({ path: path.join(aerialRoot, '.env'), quiet: true });
  if (process.env.FLYOVER_MODE !== 'surveyed') {
    // The default deliverable is an explicitly approximate cartographic
    // preview. The software renderer is deterministic and works in restricted
    // runners where Chromium cannot connect to localhost; the Cesium/Playwright
    // implementation remains available through render-illustrated.ts.
    const { renderPinkHouse } = await import('./render-pink-house');
    return renderPinkHouse({ preview: process.argv.includes('--preview') });
  }
  // Rights and geographic coverage are checked before any browser or output
  // directory is created. The app repeats this check when loading its source.
  await loadDataset(aerialRoot);
  const selectedBrowser = await selectBrowser();
  const binaries = binaryPaths();
  await mkdir(outputRoot, { recursive: true });
  const lockPath = path.join(outputRoot, '.render.lock');
  const lock = await open(lockPath, 'wx').catch((error) => {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error('Another render owns output/.render.lock. Check that process before removing a stale lock.');
    throw error;
  });
  const stamp = `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
  const work = path.join(outputRoot, `.render-${stamp}`);
  const framesRoot = path.join(work, 'frames');
  const manifestFile = path.join(work, 'manifest.json');
  let manifest: RunManifest | undefined;
  let server: ViteDevServer | undefined;
  let browser: Browser | undefined;
  const blockedRequests: string[] = [];
  const pageErrors: string[] = [];
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    await mkdir(framesRoot, { recursive: true });
    server = await createServer({
      root: aerialRoot,
      configFile: path.join(aerialRoot, 'vite.config.ts'),
      server: { host: '127.0.0.1', port: 0, strictPort: false, open: false },
      logLevel: 'error',
    });
    await server.listen();
    const address = server.httpServer?.address();
    requireCondition(address && typeof address !== 'string', 'Vite did not provide a local server address.');
    const url = `http://127.0.0.1:${address.port}/?render=1`;
    const args = ['--enable-webgl', '--ignore-gpu-blocklist'];
    if (process.env.SOFTWARE_RENDERING === 'true') args.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader');
    browser = await chromium.launch({
      headless: true, args, timeout: 60_000,
      executablePath: selectedBrowser.executablePath,
    });
    const context = await browser.newContext({ viewport: { width: REQUIRED_SPEC.width, height: REQUIRED_SPEC.height }, deviceScaleFactor: 1, serviceWorkers: 'block' });
    const recordViolation = (host: string) => { if (!blockedRequests.includes(host)) blockedRequests.push(host); };
    // Observe actual browser URLs too; redirect policy below stops external
    // chains before following their first Location header.
    context.on('request', (request) => {
      if (prohibitedGoogleUrl(request.url())) recordViolation(new URL(request.url()).hostname);
    });
    context.on('response', (response) => {
      if (prohibitedGoogleUrl(response.url())) recordViolation(new URL(response.url()).hostname);
    });
    await context.route('**/*', async (route) => {
      const requestUrl = route.request().url();
      const parsedUrl = new URL(requestUrl);
      if (prohibitedGoogleUrl(requestUrl)) {
        // Record only a host, never credentials or query strings.
        recordViolation(parsedUrl.hostname);
        await route.abort('blockedbyclient');
        return;
      }
      if (parsedUrl.hostname === '127.0.0.1' && parsedUrl.port === String(address.port)) {
        await route.continue();
        return;
      }
      // Playwright routing is called for the initial request of a redirect
      // chain. Fetch without redirects and reject every external redirect,
      // including redirects from independent providers to Google endpoints.
      let fetched: APIResponse | undefined;
      try {
        const response = fetched = await route.fetch({ maxRedirects: 0, timeout: 60_000 });
        const violation = redirectViolation(requestUrl, response.status(), response.headers().location);
        if (violation) {
          recordViolation(violation);
          pageErrors.push(`Unsupported external asset redirect from ${parsedUrl.hostname}; configure a final licensed asset URL.`);
          await route.abort('blockedbyclient');
          return;
        }
        if (prohibitedGoogleUrl(response.url())) {
          recordViolation(new URL(response.url()).hostname);
          await route.abort('blockedbyclient');
          return;
        }
        await route.fulfill({ response });
      } catch (error) {
        pageErrors.push(`Asset request failed for ${parsedUrl.hostname}: ${redact(error)}`);
        await route.abort('failed').catch(() => undefined);
      } finally {
        // APIRequestContext otherwise retains the response bytes for the
        // browser's lifetime, duplicating large photogrammetry tile payloads.
        await fetched?.dispose().catch(() => undefined);
      }
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => pageErrors.push(redact(error)));
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => Boolean(window.flyover?.ready || window.flyover?.error), undefined, { timeout: 180_000 });
    const config = await page.evaluate(() => {
      const api = window.flyover;
      if (!api || api.error) throw new Error(api?.error || 'Flyover API missing.');
      return { width: api.width, height: api.height, fps: api.fps, frames: api.frames, duration: api.duration, source: api.source };
    });
    for (const key of ['width', 'height', 'fps', 'frames', 'duration'] as const) {
      requireCondition(config[key] === REQUIRED_SPEC[key], `Application ${key} does not match required output.`);
    }
    validateSource(config.source);
    requireCondition(blockedRequests.length === 0, 'A prohibited Google request or unsupported external redirect occurred. Rendering stopped before capture.');
    const geometry = await deadline(page.evaluate(async () => {
      if (!window.flyover) throw new Error('Flyover API missing.');
      return await window.flyover.prepare();
    }), 240_000, 'Geometry verification exceeded its deadline.');
    validateGeometry(geometry);
    requireCondition(pageErrors.length === 0, `Browser error: ${pageErrors.join('; ')}`);
    const encoder = await runProcess(binaries.ffmpeg, ['-hide_banner', '-encoders'], { timeoutMs: 30_000 });
    requireCondition(/\blibx264\b/.test(encoder.stdout), 'This FFmpeg build has no libx264 H.264 encoder.');
    await runProcess(binaries.ffprobe, ['-version'], { timeoutMs: 30_000 });
    manifest = { version: 1, status: 'capturing', createdAt: new Date().toISOString(), ...config, geometry, reports: [], images: [], blockedRequests };
    await writeFile(manifestFile, JSON.stringify(manifest, null, 2));
    console.log(`Verified licensed 3D dataset: ${redact(config.source.name)}. Capturing ${config.frames} deterministic frames.`);
    let previousPixels: Uint8Array | undefined;
    for (let frame = 0; frame < config.frames; frame++) {
      const report = await deadline(page.evaluate(async (index) => {
        if (!window.flyover) throw new Error('Flyover API missing.');
        if (window.flyover.error) throw new Error(window.flyover.error);
        return await window.flyover.renderFrame(index);
      }, frame), 180_000, `Frame ${frame} did not finish loading/rendering.`);
      requireCondition(blockedRequests.length === 0, 'A prohibited Google request or unsupported external redirect occurred. Rendering stopped before capture.');
      requireCondition(pageErrors.length === 0, `Browser error: ${pageErrors.join('; ')}`);
      validateFrame(report, frame, config, config.source);
      const png = await page.screenshot({ path: path.join(framesRoot, `frame-${String(frame).padStart(6, '0')}.png`), type: 'png', animations: 'disabled', caret: 'hide', scale: 'css', timeout: 60_000 });
      const measured = await measureImage(png, frame, previousPixels);
      previousPixels = measured.pixels;
      manifest.reports.push(report);
      manifest.images.push(measured.metric);
      if ((frame + 1) % 30 === 0 || frame === config.frames - 1) {
        await writeFile(manifestFile, JSON.stringify(manifest, null, 2));
        console.log(`Captured ${frame + 1}/${config.frames} frames (${((frame + 1) / config.fps).toFixed(1)} video seconds).`);
      }
    }
    manifest.status = 'captured';
    await writeFile(manifestFile, JSON.stringify(manifest, null, 2));
    // All captures complete before closing the browser. No data is exported from Google.
    await browser.close(); browser = undefined;
    await server.close(); server = undefined;
    const partialVideo = path.join(work, 'house_flyover.partial.mp4');
    console.log('Encoding captured frames and validating the complete video.');
    await runProcess(binaries.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-n', '-framerate', String(config.fps), '-start_number', '0', '-i', path.join(framesRoot, 'frame-%06d.png'), '-frames:v', String(config.frames), '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(config.fps), partialVideo]);
    const qa = await validateRun(partialVideo, manifest);
    const qaFile = path.join(work, 'qa.json');
    await writeFile(qaFile, JSON.stringify(qa, null, 2));
    await publish(partialVideo, manifestFile, qaFile, stamp, manifest);
    console.log('Produced and validated output/house_flyover.mp4 (1920×1080, 30 fps, 30 seconds).');
    console.log(`Capture diagnostics retained at output/${path.basename(work)}.`);
  } catch (error) {
    const message = redact(error);
    if (manifest) {
      manifest.status = 'failed'; manifest.error = message;
      await writeFile(manifestFile, JSON.stringify(manifest, null, 2)).catch(() => undefined);
    } else {
      await writeFile(path.join(work, 'failure.json'), JSON.stringify({ status: 'failed', error: message, blockedRequests, createdAt: new Date().toISOString() }, null, 2)).catch(() => undefined);
    }
    throw new Error(message);
  } finally {
    await browser?.close().catch(() => undefined);
    await server?.close().catch(() => undefined);
    await lock.close();
    await unlink(lockPath).catch(() => undefined);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  render().catch((error) => { console.error(redact(error)); process.exitCode = 1; });
}
