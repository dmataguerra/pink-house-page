import { mkdir, open, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { chromium, type Browser } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { selectBrowser } from '../server/browser';
import { REQUIRED_SPEC, binaryPaths, measureImage, redact, runProcess, validateImages, validateVideo, type ImageMetric, type VideoSpec } from './qa';

export const APPROXIMATION_CAPTION = 'VISUALIZACIÓN APROXIMADA · ALTURAS ESTIMADAS';
export interface IllustratedFrame {
  frame: number;
  time: number;
  targetVisible: boolean;
  attributionVisible: boolean;
  approximationLabelVisible: boolean;
  projectedTarget: { x: number; y: number };
  geometryCount: number;
  estimatedHeightCount: number;
}
interface IllustratedApi {
  ready: boolean;
  error: string | null;
  spec: VideoSpec;
  source: Record<string, unknown>;
  renderFrame(index: number): Promise<IllustratedFrame>;
}
interface IllustratedManifest extends VideoSpec {
  version: 1;
  kind: 'cartographic-preview';
  status: 'capturing' | 'captured' | 'validated' | 'failed' | 'preview';
  createdAt: string;
  approximationCaption: string;
  photorealistic: false;
  surveyedGeometryVerified: false;
  targetHouseReconstructionVerified: false;
  source: Record<string, unknown>;
  credits: string[];
  reports: IllustratedFrame[];
  images: ImageMetric[];
  blockedRequests: string[];
  error?: string;
}

const aerialRoot = fileURLToPath(new URL('../', import.meta.url));
const outputRoot = path.resolve(aerialRoot, '..', 'output');
function check(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
async function deadline<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), timeoutMs); })]); }
  finally { if (timer) clearTimeout(timer); }
}

function validateFrame(report: IllustratedFrame, index: number): void {
  check(report.frame === index && Number.isFinite(report.time) && Math.abs(report.time - index / REQUIRED_SPEC.fps) < 0.00001, `Frame ${index}: deterministic camera sequence is invalid.`);
  check(report.targetVisible === true, `Frame ${index}: target coordinate marker is offscreen.`);
  check(report.attributionVisible === true && report.approximationLabelVisible === true, `Frame ${index}: source attribution or approximation caption is hidden.`);
  check(Number.isInteger(report.geometryCount) && report.geometryCount > 0, `Frame ${index}: no illustrated geographic geometry.`);
  check(Number.isInteger(report.estimatedHeightCount) && report.estimatedHeightCount >= 0 && report.estimatedHeightCount <= report.geometryCount, `Frame ${index}: estimated-height count is invalid.`);
  const point = report.projectedTarget;
  check(point && Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 48 && point.x <= REQUIRED_SPEC.width - 48 && point.y >= 48 && point.y <= REQUIRED_SPEC.height - 48, `Frame ${index}: target coordinate marker lies outside the safe frame.`);
}

async function publish(work: string, stamp: string, manifest: IllustratedManifest, qa: Record<string, unknown>): Promise<void> {
  const manifestFile = path.join(work, 'manifest.json');
  const qaFile = path.join(work, 'qa.json');
  manifest.status = 'validated';
  await writeFile(manifestFile, JSON.stringify(manifest, null, 2));
  await writeFile(qaFile, JSON.stringify(qa, null, 2));
  const items = [
    { partial: manifestFile, final: path.join(outputRoot, 'house_flyover.manifest.json') },
    { partial: qaFile, final: path.join(outputRoot, 'house_flyover.qa.json') },
    { partial: path.join(work, 'house_flyover.partial.mp4'), final: path.join(outputRoot, 'house_flyover.mp4') },
  ];
  const backups: Array<{ final: string; backup: string }> = [];
  const published: typeof items = [];
  try {
    for (const item of items) {
      check(path.dirname(item.final) === outputRoot && path.dirname(item.partial) === work, 'Publication path escaped the output directory.');
      let existing;
      try { existing = await stat(item.final); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      if (existing) {
        check(existing.isFile(), 'Cannot replace a non-file output.');
        const parsed = path.parse(item.final);
        const backup = path.join(outputRoot, `${parsed.name}.previous-${stamp}${parsed.ext}`);
        check(path.dirname(backup) === outputRoot, 'Backup path escaped the output directory.');
        await rename(item.final, backup);
        backups.push({ final: item.final, backup });
      }
    }
    // Publish the video last, only after its QA sidecars exist.
    for (const item of items) { await rename(item.partial, item.final); published.push(item); }
  } catch (error) {
    for (const item of published.reverse()) await rename(item.final, item.partial).catch(() => undefined);
    for (const item of backups.reverse()) await rename(item.backup, item.final).catch(() => undefined);
    throw error;
  }
}

export async function renderIllustrated({ preview = false }: { preview?: boolean } = {}): Promise<void> {
  loadDotenv({ path: path.join(aerialRoot, '.env.local'), quiet: true });
  loadDotenv({ path: path.join(aerialRoot, '.env'), quiet: true });
  const selected = await selectBrowser();
  const binaries = binaryPaths();
  if (!preview) {
    const encoders = await runProcess(binaries.ffmpeg, ['-hide_banner', '-encoders'], { timeoutMs: 30_000 });
    check(/\blibx264\b/.test(encoders.stdout), 'FFmpeg requires the libx264 encoder.');
    await runProcess(binaries.ffprobe, ['-version'], { timeoutMs: 30_000 });
  }
  await mkdir(outputRoot, { recursive: true });
  const lockFile = path.join(outputRoot, '.render.lock');
  const lock = await open(lockFile, 'wx').catch((error) => {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error('Another render owns output/.render.lock.');
    throw error;
  });
  const stamp = `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
  const work = path.join(outputRoot, `.render-illustrated-${stamp}`);
  const frameRoot = preview ? path.join(outputRoot, 'verification') : path.join(work, 'frames');
  const blockedRequests: string[] = [];
  const errors: string[] = [];
  let browser: Browser | undefined;
  let server: ViteDevServer | undefined;
  let manifest: IllustratedManifest | undefined;
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, mode: 'illustrated', startedAt: new Date().toISOString() }));
    await mkdir(work, { recursive: true });
    await mkdir(frameRoot, { recursive: true });
    // Use the same fixed localhost port as the interactive preview. In the
    // managed Windows runner, ephemeral port binding is denied by the sandbox.
    server = await createServer({ root: aerialRoot, configFile: path.join(aerialRoot, 'vite.config.ts'), server: { host: '127.0.0.1', port: 4175, strictPort: true, open: false }, logLevel: 'error' });
    await server.listen();
    const address = server.httpServer?.address();
    check(address && typeof address !== 'string', 'Local preview server did not start.');
    const origin = `http://127.0.0.1:${address.port}`;
    const args = ['--enable-webgl', '--ignore-gpu-blocklist'];
    if (process.env.SOFTWARE_RENDERING === 'true') args.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader');
    browser = await chromium.launch({ headless: true, executablePath: selected.executablePath, args, timeout: 60_000 });
    const context = await browser.newContext({ viewport: { width: REQUIRED_SPEC.width, height: REQUIRED_SPEC.height }, deviceScaleFactor: 1, serviceWorkers: 'block' });
    const recordBlocked = (value: string) => { if (!blockedRequests.includes(value)) blockedRequests.push(value); };
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) { recordBlocked(url.hostname || url.protocol); await route.abort('blockedbyclient'); return; }
      // Let Chromium load the local Vite server directly. Using route.fetch for
      // localhost makes the browser's network namespace fail in sandboxed
      // Windows runners even though normal preview navigation works.
      await route.continue();
      return;
    });
    context.on('response', (response) => {
      const url = new URL(response.url());
      if (url.origin !== origin) recordBlocked(url.hostname || url.protocol);
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(redact(error)));
    await page.goto(`${origin}/?mode=illustrated&render=1`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => {
      const api = (window as unknown as { illustrated?: IllustratedApi }).illustrated;
      return Boolean(api?.ready || api?.error);
    }, undefined, { timeout: 180_000 });
    const initial = await page.evaluate(() => {
      const api = (window as unknown as { illustrated?: IllustratedApi }).illustrated;
      if (!api || api.error) throw new Error(api?.error || 'Illustrated renderer API missing.');
      return { spec: api.spec, source: api.source };
    });
    for (const key of ['width', 'height', 'fps', 'frames', 'duration'] as const) check(initial.spec[key] === REQUIRED_SPEC[key], `Illustrated application ${key} differs from required video.`);
    check(initial.source && typeof initial.source === 'object', 'Open geographic source provenance is missing.');
    manifest = { version: 1, kind: 'cartographic-preview', status: preview ? 'preview' : 'capturing', createdAt: new Date().toISOString(), ...REQUIRED_SPEC, approximationCaption: APPROXIMATION_CAPTION, photorealistic: false, surveyedGeometryVerified: false, targetHouseReconstructionVerified: false, source: initial.source, credits: [], reports: [], images: [], blockedRequests };
    const frames = preview ? [0, 240, 450, 700] : Array.from({ length: REQUIRED_SPEC.frames }, (_, i) => i);
    let previousPixels: Uint8Array | undefined;
    for (const frame of frames) {
      const report = await deadline(page.evaluate(async (index) => {
        const api = (window as unknown as { illustrated?: IllustratedApi }).illustrated;
        if (!api || api.error) throw new Error(api?.error || 'Illustrated renderer API missing.');
        return await api.renderFrame(index);
      }, frame), 60_000, `Illustrated frame ${frame} did not finish rendering.`);
      check(blockedRequests.length === 0, 'Illustrated capture attempted an external network request; only local open geographic data is allowed.');
      check(errors.length === 0, `Browser error: ${errors.join('; ')}`);
      validateFrame(report, frame);
      const labels = await page.evaluate((caption) => {
        const visibleText = Array.from(document.querySelectorAll('body *')).filter((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= innerHeight && style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0;
        }).map((element) => (element as HTMLElement).innerText || '').join(' ').replace(/\s+/g, ' ');
        const licenseLink = Array.from(document.querySelectorAll('a[href]')).some((element) => {
          const anchor = element as HTMLAnchorElement;
          const rect = anchor.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= innerHeight && /openstreetmap\.org\/copyright|opendatacommons\.org\/licenses\/odbl/i.test(anchor.href);
        });
        return { caption: visibleText.includes(caption), attribution: /OpenStreetMap/i.test(visibleText) && (licenseLink || /openstreetmap\.org\/copyright|opendatacommons\.org\/licenses\/odbl/i.test(visibleText)), text: visibleText };
      }, APPROXIMATION_CAPTION);
      check(labels.caption && labels.attribution, `Frame ${frame}: permanent approximation caption or OSM license credit is not visibly rendered.`);
      if (!manifest.credits.length) manifest.credits = [APPROXIMATION_CAPTION, labels.text];
      const filename = preview ? `illustrated-preview-${frame}.png` : `frame-${String(frame).padStart(6, '0')}.png`;
      const png = await page.screenshot({ path: path.join(frameRoot, filename), type: 'png', animations: 'disabled', caret: 'hide', scale: 'css', timeout: 60_000 });
      const measured = await measureImage(png, frame, previousPixels);
      previousPixels = measured.pixels;
      manifest.reports.push(report); manifest.images.push(measured.metric);
      if (preview || (frame + 1) % 30 === 0) {
        await writeFile(path.join(work, 'manifest.json'), JSON.stringify(manifest, null, 2));
        console.log(preview ? `Saved illustrated preview frame ${frame}.` : `Captured ${frame + 1}/${REQUIRED_SPEC.frames} illustrated frames.`);
      }
    }
    await browser.close(); browser = undefined;
    await server.close(); server = undefined;
    if (preview) {
      await writeFile(path.join(frameRoot, 'illustrated-preview.json'), JSON.stringify(manifest, null, 2));
      console.log('Illustrated preview screenshots saved under output/verification. No preview MP4 was published.');
      return;
    }
    manifest.status = 'captured';
    const imageQa = validateImages(manifest.images, REQUIRED_SPEC.frames, REQUIRED_SPEC.fps);
    await writeFile(path.join(work, 'manifest.json'), JSON.stringify(manifest, null, 2));
    const partial = path.join(work, 'house_flyover.partial.mp4');
    console.log('Encoding and checking the illustrated MP4.');
    await runProcess(binaries.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-n', '-framerate', '30', '-start_number', '0', '-i', path.join(frameRoot, 'frame-%06d.png'), '-frames:v', '900', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', '30', partial]);
    const technical = await validateVideo(partial, REQUIRED_SPEC, binaries);
    const qa = { kind: 'cartographic-preview', passed: true, checkedAt: new Date().toISOString(), video: technical, images: imageQa, approximationCaption: APPROXIMATION_CAPTION, photorealistic: false, surveyedGeometryVerified: false, targetHouseReconstructionVerified: false, source: manifest.source, attributionVerifiedFrames: manifest.reports.length, approximationLabelVerifiedFrames: manifest.reports.length, targetCoordinateVisibleFrames: manifest.reports.length, blockedRequests };
    await publish(work, stamp, manifest, qa);
    console.log('Produced and validated output/house_flyover.mp4: illustrated geographic preview, 1920×1080, 30 fps, 30 seconds; heights are estimated.');
  } catch (error) {
    const message = redact(error);
    if (manifest) { manifest.status = 'failed'; manifest.error = message; }
    await writeFile(path.join(work, 'manifest.json'), JSON.stringify(manifest || { kind: 'cartographic-preview', status: 'failed', error: message, blockedRequests }, null, 2)).catch(() => undefined);
    throw new Error(message);
  } finally {
    await browser?.close().catch(() => undefined);
    await server?.close().catch(() => undefined);
    await lock.close();
    await unlink(lockFile).catch(() => undefined);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  renderIllustrated({ preview: process.argv.includes('--preview') }).catch((error) => { console.error(redact(error)); process.exitCode = 1; });
}
