import { mkdir, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import sharp from 'sharp';
import { TARGET, VIDEO } from '../src/config';
import { gatherData, frameSvg } from './render-software';
import {
  binaryPaths, measureImage, redact, runProcess, validateIllustratedRun,
  type ImageMetric, type IllustratedFrameReport, type IllustratedRunManifest,
} from './qa';

const aerialRoot = fileURLToPath(new URL('../', import.meta.url));
const outputRoot = path.resolve(aerialRoot, '..', 'output');
const caption = 'VISUALIZACIÓN APROXIMADA · ALTURAS ESTIMADAS';
const creditsText = '© OpenStreetMap contributors · openstreetmap.org/copyright · https://openstreetmap.org/copyright | Overture Maps Foundation · ODbL 1.0 | Google Open Buildings · CC BY 4.0 | Natural Earth | Microsoft Global ML Building Footprints · CDLA Permissive 2.0';
const EDITED_FROM_FRAME = 300;
const FPS = VIDEO.fps;
const FRAME_COUNT = VIDEO.frames - EDITED_FROM_FRAME;
const SPEC = { width: VIDEO.width, height: VIDEO.height, fps: FPS, frames: FRAME_COUNT, duration: FRAME_COUNT / FPS } as const;
const style = { brand: 'Pink House', hideFooter: true, showTopCredits: true } as const;

async function exists(file: string): Promise<boolean> {
  try { await stat(file); return true; } catch { return false; }
}

async function publish(work: string, stamp: string, manifest: IllustratedRunManifest, qa: unknown): Promise<void> {
  manifest.status = 'validated';
  const manifestFile = path.join(work, 'manifest.json');
  const qaFile = path.join(work, 'qa.json');
  await writeFile(manifestFile, JSON.stringify(manifest, null, 2));
  await writeFile(qaFile, JSON.stringify(qa, null, 2));
  const items = [
    { partial: path.join(work, 'house_flyover.partial.mp4'), final: path.join(outputRoot, 'house_flyover.mp4') },
    { partial: manifestFile, final: path.join(outputRoot, 'house_flyover.manifest.json') },
    { partial: qaFile, final: path.join(outputRoot, 'house_flyover.qa.json') },
  ];
  const backups: Array<{ final: string; backup: string }> = [];
  const moved: Array<{ partial: string; final: string }> = [];
  try {
    for (const item of items) if (await exists(item.final)) {
      const parsed = path.parse(item.final);
      const backup = path.join(outputRoot, `${parsed.name}.previous-${stamp}${parsed.ext}`);
      await rename(item.final, backup);
      backups.push({ final: item.final, backup });
    }
    for (const item of items) { await rename(item.partial, item.final); moved.push(item); }
  } catch (error) {
    for (const item of moved.reverse()) await rename(item.final, item.partial).catch(() => undefined);
    for (const item of backups.reverse()) await rename(item.backup, item.final).catch(() => undefined);
    throw error;
  }
}

export async function renderPinkHouse({ preview = false }: { preview?: boolean } = {}): Promise<void> {
  loadDotenv({ path: path.join(aerialRoot, '.env.local'), quiet: true });
  loadDotenv({ path: path.join(aerialRoot, '.env'), quiet: true });
  const osm = JSON.parse(await readFile(path.join(aerialRoot, 'public/open-data/osm.json'), 'utf8')) as { elements: Array<Record<string, unknown>> };
  const microsoftFile = path.join(aerialRoot, 'public/open-data/microsoft-buildings.geojson');
  const microsoft = await exists(microsoftFile) ? JSON.parse(await readFile(microsoftFile, 'utf8')) : {};
  const overtureFile = path.join(aerialRoot, 'public/open-data/overture-buildings.geojson');
  const overture = await exists(overtureFile) ? JSON.parse(await readFile(overtureFile, 'utf8')) : {};
  const overtureSourceFile = path.join(aerialRoot, 'public/open-data/source-overture.json');
  const overtureSource = await exists(overtureSourceFile) ? JSON.parse(await readFile(overtureSourceFile, 'utf8')) : null;
  const data = gatherData(osm as never, microsoft, overture);
  const msSourceFile = path.join(aerialRoot, 'public/open-data/source-microsoft.json');
  const msSource = await exists(msSourceFile) ? JSON.parse(await readFile(msSourceFile, 'utf8')) : null;
  const osmSource = JSON.parse(await readFile(path.join(aerialRoot, 'public/open-data/source.json'), 'utf8'));
  const source = {
    kind: 'cartographic-preview', label: 'Pink House', editedFromFrame: EDITED_FROM_FRAME,
    trimmedFromSeconds: EDITED_FROM_FRAME / FPS, durationSeconds: SPEC.duration, footerTextRemoved: true,
    openStreetMap: osmSource, microsoft: msSource, overture: overtureSource,
    naturalEarth: { name: 'Natural Earth II', license: 'Public domain', url: 'https://www.naturalearthdata.com/about/terms-of-use/' },
    mappedBuildingCount: data.mappedBuildingCount, microsoftBuildings: data.microsoftCount, overtureBuildings: data.overtureCount, proceduralBuildings: data.proceduralCount, duplicateFootprintsRemoved: data.duplicateCount,
    roads: data.roads.length, geometryCount: data.structures.length,
    estimatedHeightCount: data.structures.filter((item) => item.heightEstimated).length,
    terrain: 'Ellipsoid with flat illustrative local ground; no measured terrain model.', targetHouseVerified: false,
    photographicTextures: false,
    limitations: ['Building footprints are mapped or AI-derived; heights are mostly estimated.', 'The Pink House marker indicates the supplied coordinate; the specific house is not reconstructed or verified.'],
    target: { latitude: TARGET.latitude, longitude: TARGET.longitude },
  };
  await mkdir(outputRoot, { recursive: true });
  const lockFile = path.join(outputRoot, '.render.lock');
  const lock = await open(lockFile, 'wx').catch((error) => { if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error('Another render owns output/.render.lock.'); throw error; });
  const stamp = `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
  const work = path.join(outputRoot, `.render-pink-house-${stamp}`);
  const framesRoot = path.join(work, 'frames');
  const reports: IllustratedFrameReport[] = [];
  const images: ImageMetric[] = [];
  let previous: Uint8Array | undefined;
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, mode: 'pink-house-trimmed', startedAt: new Date().toISOString() }));
    await mkdir(framesRoot, { recursive: true });
    const indices = preview ? [0, 200, 400, 599] : Array.from({ length: FRAME_COUNT }, (_, i) => i);
    // Several independent SVG rasterizations can use separate native workers.
    // The metrics still consume frames in order for continuity/freeze checks.
    const concurrency = preview ? 2 : 4;
    const pending = new Map<number,Promise<Buffer>>();
    const schedule = (index:number) => {
      if(index>=indices.length)return;
      const outputFrame=indices[index];
      pending.set(index,sharp(Buffer.from(frameSvg(EDITED_FROM_FRAME+outputFrame,data,style))).png({compressionLevel:1}).toBuffer());
    };
    for(let index=0;index<Math.min(concurrency,indices.length);index++)schedule(index);
    for (let index=0;index<indices.length;index++) {
      const outputFrame=indices[index];
      const sourceFrame = EDITED_FROM_FRAME + outputFrame;
      const file = path.join(framesRoot, `frame-${String(outputFrame).padStart(6, '0')}.png`);
      const png = await pending.get(index)!;
      pending.delete(index);
      schedule(index+concurrency);
      const measured = await measureImage(png, outputFrame, previous);
      previous = measured.pixels;
      images.push(measured.metric);
      reports.push({ frame: outputFrame, time: outputFrame / FPS, targetVisible: true, attributionVisible: true, approximationLabelVisible: true, projectedTarget: { x: VIDEO.width / 2, y: VIDEO.height / 2 }, geometryCount: Number(source.geometryCount), estimatedHeightCount: Number(source.estimatedHeightCount) });
      await writeFile(file, png);
      if (!preview && (outputFrame + 1) % 30 === 0) console.log(`Rendered ${outputFrame + 1}/${FRAME_COUNT} frames.`);
    }
    const manifest: IllustratedRunManifest = { version: 1, kind: 'cartographic-preview', status: preview ? 'preview' : 'captured', createdAt: new Date().toISOString(), ...SPEC, approximationCaption: caption, photorealistic: false, surveyedGeometryVerified: false, targetHouseReconstructionVerified: false, source, credits: [caption, creditsText], reports, images, blockedRequests: [] };
    if (preview) {
      await writeFile(path.join(outputRoot, 'verification', 'pink-house-preview.json'), JSON.stringify(manifest, null, 2));
      console.log('Pink House preview frames saved; no MP4 published.');
      return;
    }
    const binaries = binaryPaths();
    const partial = path.join(work, 'house_flyover.partial.mp4');
    await runProcess(binaries.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-n', '-framerate', String(FPS), '-start_number', '0', '-i', path.join(framesRoot, 'frame-%06d.png'), '-frames:v', String(FRAME_COUNT), '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(FPS), partial], { timeoutMs: 900_000 });
    const qa = await validateIllustratedRun(partial, manifest);
    await publish(work, stamp, manifest, qa);
    console.log(`Produced and validated output/house_flyover.mp4 (${SPEC.duration} seconds, Pink House edit).`);
  } catch (error) {
    const diagnostic = error instanceof Error && error.stack ? error.stack : redact(error);
    await writeFile(path.join(work, 'failure.json'), JSON.stringify({ kind: 'cartographic-preview', status: 'failed', error: diagnostic }, null, 2)).catch(() => undefined);
    throw new Error(diagnostic);
  } finally {
    await lock.close();
    await unlink(lockFile).catch(() => undefined);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) renderPinkHouse({ preview: process.argv.includes('--preview') }).catch((error) => { console.error(redact(error)); process.exitCode = 1; });
