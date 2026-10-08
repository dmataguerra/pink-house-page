import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import sharp from 'sharp';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

export interface GeometryReport {
  sampleCount: number;
  validSamples: number;
  heightRange: number;
  targetHeight: number;
  verified: boolean;
}

export interface FrameReport {
  frame: number;
  time: number;
  loaded: boolean;
  visibleTiles: number;
  geometryBytes: number;
  textureBytes: number;
  collisionClearance: number;
  targetVisible: boolean;
  targetOccluded: boolean;
  attributionVisible: boolean;
  credits: string[];
  projectedTarget: { x: number; y: number };
}

export interface SourceReport {
  name: string;
  attribution: string;
  licenseEvidenceSha256: string;
}

export interface VideoSpec {
  width: number;
  height: number;
  fps: number;
  frames: number;
  duration: number;
}

export const REQUIRED_SPEC: VideoSpec = {
  width: 1920, height: 1080, fps: 30, frames: 900, duration: 30,
};

export interface ImageMetric {
  frame: number;
  hash: string;
  meanLuma: number;
  darkFraction: number;
  variance: number;
  meanAbsoluteChange: number | null;
}

export interface RunManifest extends VideoSpec {
  version: 1;
  status: 'capturing' | 'captured' | 'validated' | 'failed';
  createdAt: string;
  source: SourceReport;
  geometry: GeometryReport;
  reports: FrameReport[];
  images: ImageMetric[];
  blockedRequests: string[];
  error?: string;
  publishedVideo?: string;
}

export interface BinaryPaths { ffmpeg: string; ffprobe: string }

export interface QualityReport {
  passed: true;
  checkedAt: string;
  video: VideoSpec & { codec: string; pixelFormat: string; decoded: true; encodedSceneChecked: true };
  geometry: GeometryReport;
  images: { exactDuplicates: number; longestDuplicateRun: number; minMeanLuma: number; minVariance: number };
  source: SourceReport;
  attributionVerifiedFrames: number;
  targetVisibleFrames: number;
}

export interface IllustratedFrameReport {
  frame: number;
  time: number;
  targetVisible: boolean;
  attributionVisible: boolean;
  approximationLabelVisible: boolean;
  projectedTarget: { x: number; y: number };
  geometryCount: number;
  estimatedHeightCount: number;
}

export interface IllustratedRunManifest extends VideoSpec {
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
  reports: IllustratedFrameReport[];
  images: ImageMetric[];
  blockedRequests: string[];
}

export interface IllustratedQualityReport {
  kind: 'cartographic-preview';
  passed: true;
  checkedAt: string;
  video: QualityReport['video'];
  images: QualityReport['images'];
  approximationCaption: string;
  photorealistic: false;
  surveyedGeometryVerified: false;
  targetHouseReconstructionVerified: false;
  source: Record<string, unknown>;
  attributionVerifiedFrames: number;
  approximationLabelVerifiedFrames: number;
  targetCoordinateVisibleFrames: number;
  blockedRequests: string[];
}

const ILLUSTRATED_CAPTION = 'VISUALIZACIÓN APROXIMADA · ALTURAS ESTIMADAS';

export function redact(message: unknown): string {
  let result = message instanceof Error ? message.message : String(message);
  for (const [name, value] of Object.entries(process.env)) {
    if (value && value.length > 5 && /key|token|secret|password|credential|auth|tileset_url/i.test(name)) {
      result = result.split(value).join('[redacted]');
    }
  }
  result = result.replace(/https?:\/\/[^\s"'<>]+/gi, (url) => {
    try {
      const parsed = new URL(url);
      parsed.username = '';
      parsed.password = '';
      if (parsed.search) parsed.search = '?redacted';
      parsed.hash = '';
      return parsed.toString();
    } catch { return '[redacted URL]'; }
  });
  return result.replace(/((?:api[_-]?key|access[_-]?token|authorization|bearer|password|secret)\s*[=:]\s*)[^\s,;]+/gi, '$1[redacted]');
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function binaryPaths(): BinaryPaths {
  const ffmpeg = process.env.FFMPEG_PATH || ffmpegStatic;
  const ffprobe = process.env.FFPROBE_PATH || ffprobeStatic.path;
  assert(ffmpeg && ffprobe, 'FFmpeg and FFprobe are required. Install dependencies or configure FFMPEG_PATH and FFPROBE_PATH.');
  return { ffmpeg, ffprobe };
}

/** No shell is involved; child-process arguments cannot execute shell substitutions. */
export async function runProcess(
  executable: string,
  args: string[],
  options: { timeoutMs?: number; maxOutputBytes?: number } = {},
): Promise<{ stdout: string; stderr: string }> {
  const timeoutMs = options.timeoutMs ?? 600_000;
  const maxOutputBytes = options.maxOutputBytes ?? 8_000_000;
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let bytes = 0;
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill('SIGKILL');
      reject(error);
    };
    const timer = setTimeout(() => fail(new Error(`${path.basename(executable)} exceeded its ${Math.round(timeoutMs / 1000)} second deadline.`)), timeoutMs);
    const append = (chunk: Buffer, stream: 'stdout' | 'stderr') => {
      bytes += chunk.length;
      if (bytes > maxOutputBytes) return fail(new Error(`${path.basename(executable)} produced excessive diagnostic output.`));
      if (stream === 'stdout') stdout += chunk.toString();
      else stderr += chunk.toString();
    };
    child.stdout.on('data', (chunk: Buffer) => append(chunk, 'stdout'));
    child.stderr.on('data', (chunk: Buffer) => append(chunk, 'stderr'));
    child.on('error', (error) => fail(new Error(redact(error))));
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) reject(new Error(`${path.basename(executable)} failed (${code}): ${redact(stderr).slice(-4000)}`));
      else resolve({ stdout, stderr });
    });
  });
}

export function validateSource(source: SourceReport): void {
  assert(source && typeof source.name === 'string' && source.name.trim().length > 0, 'A named licensed dataset is required.');
  assert(!/google|earth\s+studio/i.test(`${source.name} ${source.attribution}`), 'Google geographic imagery is prohibited in this standalone export pipeline.');
  assert(typeof source.attribution === 'string' && source.attribution.trim().length > 0, 'Dataset attribution is required.');
  assert(typeof source.licenseEvidenceSha256 === 'string' && /^[a-f0-9]{64}$/i.test(source.licenseEvidenceSha256), 'Verified license evidence SHA-256 is required.');
}

export function validateGeometry(report: GeometryReport): void {
  assert(report?.verified === true, 'Actual textured 3D building geometry was not verified.');
  assert(Number.isInteger(report.sampleCount) && report.sampleCount >= 9, 'At least nine geographic geometry samples are required.');
  assert(Number.isInteger(report.validSamples) && report.validSamples >= 9 && report.validSamples <= report.sampleCount, 'Invalid or insufficient geometry samples.');
  assert(report.validSamples / report.sampleCount >= 0.8, 'Less than 80% of geographic samples contain 3D geometry.');
  assert(finite(report.heightRange) && report.heightRange >= 2, 'Surveyed surface relief did not meet geometry checks.');
  assert(finite(report.targetHeight), 'The target surface elevation is missing.');
}

export function validateFrame(report: FrameReport, index: number, spec: VideoSpec, source?: SourceReport): void {
  const prefix = `Frame ${index}: `;
  assert(report?.frame === index, `${prefix}frame sequence is not deterministic.`);
  assert(finite(report.time) && Math.abs(report.time - index / spec.fps) < 0.00001, `${prefix}camera time is incorrect.`);
  assert(report.loaded === true, `${prefix}3D assets are still loading.`);
  assert(finite(report.visibleTiles) && report.visibleTiles > 0, `${prefix}no visible 3D tiles.`);
  assert(finite(report.geometryBytes) && report.geometryBytes > 0, `${prefix}no building geometry loaded.`);
  assert(finite(report.textureBytes) && report.textureBytes > 0, `${prefix}no textures loaded.`);
  assert(finite(report.collisionClearance) && report.collisionClearance >= 10, `${prefix}camera is too close to geometry or clearance is unverified.`);
  assert(report.targetVisible === true && report.targetOccluded === false, `${prefix}target property is offscreen or occluded.`);
  assert(report.projectedTarget && finite(report.projectedTarget.x) && finite(report.projectedTarget.y), `${prefix}target projection is invalid.`);
  const { x, y } = report.projectedTarget;
  assert(x >= 48 && x <= spec.width - 48 && y >= 48 && y <= spec.height - 48, `${prefix}target lies outside the safe frame.`);
  assert(report.attributionVisible === true, `${prefix}required attribution is hidden.`);
  assert(Array.isArray(report.credits) && report.credits.every((credit) => typeof credit === 'string') && report.credits.some((credit) => credit.trim()), `${prefix}visible credits are missing.`);
  if (source) {
    const credits = report.credits.join(' ').replace(/\s+/g, ' ').trim();
    const attribution = source.attribution.replace(/\s+/g, ' ').trim();
    assert(credits.includes(attribution), `${prefix}dataset attribution is incomplete.`);
  }
}

export async function measureImage(png: Buffer, frame: number, previous?: Uint8Array): Promise<{ metric: ImageMetric; pixels: Uint8Array }> {
  const metadata = await sharp(png).metadata();
  assert(metadata.width && metadata.height, `Frame ${frame}: invalid PNG.`);
  // Ignore the edges and attribution strip when checking scene brightness/detail.
  const pixels = await sharp(png)
    .extract({ left: Math.floor(metadata.width * 0.05), top: Math.floor(metadata.height * 0.05), width: Math.floor(metadata.width * 0.9), height: Math.floor(metadata.height * 0.8) })
    .resize(160, 90, { fit: 'fill' })
    .removeAlpha().greyscale().raw().toBuffer();
  let sum = 0;
  let squared = 0;
  let dark = 0;
  let change = 0;
  for (let i = 0; i < pixels.length; i++) {
    const value = pixels[i];
    sum += value;
    squared += value * value;
    if (value < 16) dark++;
    if (previous) change += Math.abs(value - previous[i]);
  }
  const meanLuma = sum / pixels.length;
  const metric = {
    frame, hash: createHash('sha256').update(pixels).digest('hex'),
    meanLuma, darkFraction: dark / pixels.length,
    variance: squared / pixels.length - meanLuma * meanLuma,
    meanAbsoluteChange: previous ? change / pixels.length : null,
  };
  validateImage(metric);
  return { metric, pixels };
}

export function validateImage(metric: ImageMetric): void {
  assert(finite(metric.meanLuma) && metric.meanLuma >= 5 && finite(metric.darkFraction) && metric.darkFraction < 0.97, `Frame ${metric.frame}: black or nearly black scene.`);
  assert(finite(metric.variance) && metric.variance >= 8, `Frame ${metric.frame}: scene lacks texture/detail.`);
  assert(/^[a-f0-9]{64}$/.test(metric.hash), `Frame ${metric.frame}: image digest is missing.`);
  assert(metric.meanAbsoluteChange === null || (finite(metric.meanAbsoluteChange) && metric.meanAbsoluteChange >= 0), `Frame ${metric.frame}: image motion measurement is invalid.`);
}

export function validateImages(images: ImageMetric[], expectedFrames: number, fps: number): QualityReport['images'] {
  assert(images.length === expectedFrames, 'Image QA measurements are incomplete.');
  let exactDuplicates = 0;
  let longestDuplicateRun = 1;
  let run = 1;
  const hashes = new Set<string>();
  for (let i = 0; i < images.length; i++) {
    assert(images[i].frame === i, 'Image QA frame sequence is invalid.');
    validateImage(images[i]);
    if (hashes.has(images[i].hash)) exactDuplicates++;
    hashes.add(images[i].hash);
    if (i > 0 && images[i].hash === images[i - 1].hash) run++;
    else run = 1;
    longestDuplicateRun = Math.max(longestDuplicateRun, run);
  }
  assert(longestDuplicateRun <= Math.ceil(fps * 0.5), `Frozen scene: ${longestDuplicateRun} consecutive identical scene frames.`);
  assert(exactDuplicates / expectedFrames <= 0.05, `Excessive duplicate frames: ${exactDuplicates}/${expectedFrames}.`);
  return {
    exactDuplicates, longestDuplicateRun,
    minMeanLuma: Math.min(...images.map((image) => image.meanLuma)),
    minVariance: Math.min(...images.map((image) => image.variance)),
  };
}

function rate(value: unknown): number {
  if (typeof value !== 'string') return NaN;
  const [numerator, denominator = '1'] = value.split('/').map(Number);
  return numerator / Number(denominator);
}

export function validateProbe(probe: unknown, spec: VideoSpec): Omit<QualityReport['video'], 'encodedSceneChecked'> {
  const data = probe as { streams?: Array<Record<string, unknown>>; format?: Record<string, unknown> };
  assert(data && Array.isArray(data.streams), 'FFprobe returned no stream metadata.');
  const streams = data.streams.filter((stream) => stream.codec_type === 'video');
  assert(streams.length === 1, 'Exactly one video stream is required.');
  const stream = streams[0];
  assert(stream.codec_name === 'h264', 'Video codec must be H.264.');
  assert(stream.pix_fmt === 'yuv420p', 'Video pixel format must be yuv420p.');
  assert(stream.width === spec.width && stream.height === spec.height, 'Video resolution is incorrect.');
  assert(Math.abs(rate(stream.avg_frame_rate) - spec.fps) < 0.00001 && Math.abs(rate(stream.r_frame_rate) - spec.fps) < 0.00001, 'Video frame rate is incorrect.');
  assert(Number(stream.nb_read_frames) === spec.frames, 'Decoded video frame count is incorrect.');
  const duration = Number(data.format?.duration);
  assert(finite(duration) && Math.abs(duration - spec.duration) <= 1 / spec.fps + 0.001, 'Video duration is incorrect.');
  return { ...spec, duration, codec: 'h264', pixelFormat: 'yuv420p', decoded: true };
}

export async function validateVideo(file: string, spec: VideoSpec, binaries = binaryPaths()): Promise<QualityReport['video']> {
  const probe = await runProcess(binaries.ffprobe, ['-v', 'error', '-count_frames', '-show_entries', 'stream=codec_type,codec_name,width,height,pix_fmt,r_frame_rate,avg_frame_rate,nb_read_frames:format=duration', '-of', 'json', file]);
  assert(!probe.stderr.trim(), `FFprobe reported decoding errors: ${redact(probe.stderr).slice(-2000)}`);
  const report = validateProbe(JSON.parse(probe.stdout), spec);
  const decoded = await runProcess(binaries.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-xerror', '-err_detect', 'explode', '-i', file, '-map', '0:v:0', '-f', 'null', '-']);
  assert(!decoded.stderr.trim(), `Video decoding reported errors: ${redact(decoded.stderr).slice(-2000)}`);
  // Check the delivered, decoded MP4 as well as the source PNGs. A zero black
  // duration catches even a single black frame; freezes lasting half a second
  // fail. -70 dB tolerates codec noise without treating ordinary motion as static.
  const scene = await runProcess(binaries.ffmpeg, ['-hide_banner', '-nostats', '-loglevel', 'info', '-nostdin', '-xerror', '-err_detect', 'explode', '-i', file, '-map', '0:v:0', '-vf', 'blackdetect=d=0:pic_th=0.97:pix_th=0.06,freezedetect=n=-70dB:d=0.5', '-an', '-f', 'null', '-']);
  assert(!/black_start\s*:/i.test(scene.stderr), 'The encoded MP4 contains a black frame/interval.');
  assert(!/freeze_start\s*:/i.test(scene.stderr), 'The encoded MP4 contains a frozen interval of at least 0.5 seconds.');
  return { ...report, encodedSceneChecked: true };
}

export async function validateRun(video: string, manifest: RunManifest): Promise<QualityReport> {
  assert(manifest.version === 1, 'Unsupported render manifest version.');
  for (const key of ['width', 'height', 'fps', 'frames', 'duration'] as const) {
    assert(manifest[key] === REQUIRED_SPEC[key], `Production output ${key} differs from the required specification.`);
  }
  assert(manifest.status === 'captured' || manifest.status === 'validated', 'The complete frame sequence was not captured.');
  assert(Array.isArray(manifest.blockedRequests) && manifest.blockedRequests.length === 0, 'A prohibited Google request or unapproved redirect occurred; export is forbidden.');
  validateSource(manifest.source);
  validateGeometry(manifest.geometry);
  assert(Array.isArray(manifest.reports) && manifest.reports.length === manifest.frames, 'Per-frame render diagnostics are incomplete.');
  manifest.reports.forEach((frame, index) => validateFrame(frame, index, manifest, manifest.source));
  const images = validateImages(manifest.images, manifest.frames, manifest.fps);
  const technical = await validateVideo(video, manifest);
  return {
    passed: true, checkedAt: new Date().toISOString(), video: technical,
    geometry: manifest.geometry, images, source: manifest.source,
    attributionVerifiedFrames: manifest.reports.length,
    targetVisibleFrames: manifest.reports.length,
  };
}

/** Validate an explicitly approximate illustration without claiming a survey. */
export function validateIllustratedMetadata(manifest: IllustratedRunManifest): void {
  assert(manifest && manifest.version === 1 && manifest.kind === 'cartographic-preview', 'A cartographic-preview manifest is required.');
  assert(manifest.width === REQUIRED_SPEC.width && manifest.height === REQUIRED_SPEC.height && manifest.fps === REQUIRED_SPEC.fps, 'Illustrated output dimensions or frame rate differ from the required specification.');
  assert(Number.isInteger(manifest.frames) && manifest.frames > 0 && manifest.frames <= REQUIRED_SPEC.frames, 'Illustrated output frame count is outside the supported 30-second maximum.');
  assert(Number.isFinite(manifest.duration) && Math.abs(manifest.duration - manifest.frames / manifest.fps) <= 1 / manifest.fps + 0.001, 'Illustrated output duration does not match its frame count.');
  assert(manifest.status === 'captured' || manifest.status === 'validated', 'The complete illustrated frame sequence was not captured.');
  assert(manifest.photorealistic === false && manifest.surveyedGeometryVerified === false && manifest.targetHouseReconstructionVerified === false, 'An illustrated video must not claim a photographic survey or verified house reconstruction.');
  assert(manifest.approximationCaption === ILLUSTRATED_CAPTION, 'The permanent estimated-height approximation caption is missing.');
  assert(Array.isArray(manifest.blockedRequests) && manifest.blockedRequests.length === 0, 'Illustrated capture requested external content; only local open geographic data is permitted.');
  const source = manifest.source;
  assert(source && typeof source === 'object' && source.kind === 'cartographic-preview', 'Illustrated geographic source provenance is missing or has the wrong kind.');
  assert(!/google|earth\s+studio/i.test(JSON.stringify(source)), 'Google geographic imagery is prohibited in this cartographic export.');
  assert(Number.isInteger(source.geometryCount) && Number(source.geometryCount) > 0, 'Illustrated geographic source contains no geometry.');
  assert(Number.isInteger(source.estimatedHeightCount) && Number(source.estimatedHeightCount) >= 0 && Number(source.estimatedHeightCount) <= Number(source.geometryCount), 'Illustrated source estimated-height count is invalid.');
  assert(Array.isArray(manifest.credits) && manifest.credits.every((credit) => typeof credit === 'string'), 'Illustrated credit evidence is missing.');
  const credits = manifest.credits.join(' ').replace(/\s+/g, ' ');
  assert(credits.includes(ILLUSTRATED_CAPTION), 'Visible credit evidence omits the approximation caption.');
  assert(/OpenStreetMap/i.test(credits) && /openstreetmap\.org\/copyright|opendatacommons\.org\/licenses\/odbl/i.test(credits), 'Visible OpenStreetMap attribution and license reference are required.');
  assert(Array.isArray(manifest.reports) && manifest.reports.length === manifest.frames, 'Illustrated per-frame diagnostics are incomplete.');
  manifest.reports.forEach((report, index) => {
    const prefix = `Illustrated frame ${index}: `;
    assert(report && report.frame === index && finite(report.time) && Math.abs(report.time - index / manifest.fps) < 0.00001, `${prefix}camera sequence is invalid.`);
    assert(report.targetVisible === true, `${prefix}target coordinate marker is offscreen.`);
    assert(report.attributionVisible === true && report.approximationLabelVisible === true, `${prefix}attribution or approximation caption is hidden.`);
    assert(Number.isInteger(report.geometryCount) && report.geometryCount === source.geometryCount, `${prefix}geographic geometry count differs from source provenance.`);
    assert(Number.isInteger(report.estimatedHeightCount) && report.estimatedHeightCount === source.estimatedHeightCount, `${prefix}estimated-height count differs from source provenance.`);
    const point = report.projectedTarget;
    assert(point && finite(point.x) && finite(point.y) && point.x >= 48 && point.x <= manifest.width - 48 && point.y >= 48 && point.y <= manifest.height - 48, `${prefix}target coordinate marker lies outside the safe frame.`);
  });
}

export async function validateIllustratedRun(video: string, manifest: IllustratedRunManifest): Promise<IllustratedQualityReport> {
  validateIllustratedMetadata(manifest);
  const images = validateImages(manifest.images, manifest.frames, manifest.fps);
  const technical = await validateVideo(video, manifest);
  return {
    kind: 'cartographic-preview', passed: true, checkedAt: new Date().toISOString(),
    video: technical, images, approximationCaption: manifest.approximationCaption,
    photorealistic: false, surveyedGeometryVerified: false, targetHouseReconstructionVerified: false,
    source: manifest.source, attributionVerifiedFrames: manifest.reports.length,
    approximationLabelVerifiedFrames: manifest.reports.length,
    targetCoordinateVisibleFrames: manifest.reports.length, blockedRequests: manifest.blockedRequests,
  };
}

async function main() {
  const aerialRoot = fileURLToPath(new URL('../', import.meta.url));
  loadDotenv({ path: path.join(aerialRoot, '.env.local'), quiet: true });
  loadDotenv({ path: path.join(aerialRoot, '.env'), quiet: true });
  const args = process.argv.slice(2);
  const option = (name: string) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const video = option('--video');
  const manifestFile = option('--manifest');
  assert(video && manifestFile, 'Usage from aerial/: npm run qa -- --video ../output/house_flyover.mp4 --manifest ../output/house_flyover.manifest.json');
  const manifest = JSON.parse(await readFile(path.resolve(manifestFile), 'utf8')) as RunManifest | IllustratedRunManifest;
  const report = 'kind' in manifest && manifest.kind === 'cartographic-preview'
    ? await validateIllustratedRun(path.resolve(video), manifest)
    : await validateRun(path.resolve(video), manifest as RunManifest);
  const reportFile = option('--report') || path.join(path.dirname(path.resolve(video)), `${path.parse(video).name}.qa.json`);
  await writeFile(reportFile, JSON.stringify(report, null, 2));
  console.log(`QA passed: ${report.video.width}×${report.video.height}, ${report.video.fps} fps, ${report.video.duration} seconds, ${manifest.frames} decoded frames.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(redact(error)); process.exitCode = 1; });
}
