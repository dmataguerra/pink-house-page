import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {
  REQUIRED_SPEC, binaryPaths, measureImage, redact, runProcess, validateFrame, validateGeometry,
  validateImages, validateProbe, validateSource, validateVideo, type FrameReport, type ImageMetric,
} from '../scripts/qa';
import { prohibitedGoogleUrl, redirectViolation } from '../scripts/render';

const source = { name: 'Licensed survey', attribution: 'Survey © Owner', licenseEvidenceSha256: 'a'.repeat(64) };
const frame: FrameReport = {
  frame: 30, time: 1, loaded: true, visibleTiles: 8, geometryBytes: 4096,
  textureBytes: 8192, collisionClearance: 60, targetVisible: true,
  targetOccluded: false, attributionVisible: true, credits: [source.attribution],
  projectedTarget: { x: 960, y: 540 },
};

test('each frame requires visible textured geometry, target clearance, and full attribution', () => {
  validateFrame(frame, 30, REQUIRED_SPEC, source);
  for (const changed of [
    { loaded: false }, { textureBytes: 0 }, { geometryBytes: 0 }, { targetOccluded: true },
    { collisionClearance: 2 }, { attributionVisible: false }, { credits: ['Owner'] },
    { projectedTarget: { x: -1, y: 540 } }, { time: 2 },
  ]) assert.throws(() => validateFrame({ ...frame, ...changed }, 30, REQUIRED_SPEC, source));
});

test('terrain-only and geographically sparse samples fail geometry QA', () => {
  const geometry = { sampleCount: 34, validSamples: 30, heightRange: 12, targetHeight: 1840, verified: true };
  validateGeometry(geometry);
  assert.throws(() => validateGeometry({ ...geometry, heightRange: 0.4 }));
  assert.throws(() => validateGeometry({ ...geometry, validSamples: 12 }));
  assert.throws(() => validateGeometry({ ...geometry, verified: false }));
});

test('Google URLs and names are rejected, independent of query strings', () => {
  for (const url of ['https://tile.googleapis.com/v1/3dtiles/root.json?key=secret', 'https://maps.google.com/x', 'https://khms0.google.cn/x', 'https://maps.app.goo.gl/id', 'https://www.gstatic.com/x']) assert.equal(prohibitedGoogleUrl(url), true);
  assert.equal(prohibitedGoogleUrl('https://survey.example.org/tileset.json'), false);
  validateSource(source);
  assert.throws(() => validateSource({ ...source, name: 'Google Earth' }));
  assert.throws(() => validateSource({ ...source, licenseEvidenceSha256: '' }));
});

test('external redirects are rejected before following Google or independent URLs', () => {
  const requestUrl = 'https://survey.example.org/tileset.json';
  assert.equal(redirectViolation(requestUrl, 302, 'https://tile.googleapis.com/v1/root.json?key=secret'), 'tile.googleapis.com');
  assert.equal(redirectViolation(requestUrl, 301, 'https://cdn.example.org/tileset.json'), 'unsupported redirect: survey.example.org');
  assert.equal(redirectViolation(requestUrl, 307, '/different/path'), 'unsupported redirect: survey.example.org');
  assert.equal(redirectViolation(requestUrl, 200), null);
});

test('FFprobe must confirm a fully decoded H.264 1080p/30 stream', () => {
  const stream = { codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, pix_fmt: 'yuv420p', avg_frame_rate: '30/1', r_frame_rate: '30/1', nb_read_frames: '900' };
  const probe = { streams: [stream], format: { duration: '30.000000' } };
  assert.equal(validateProbe(probe, REQUIRED_SPEC).decoded, true);
  for (const changed of [{ width: 1280 }, { avg_frame_rate: '24/1' }, { nb_read_frames: '899' }, { codec_name: 'vp9' }, { pix_fmt: 'yuv444p' }]) assert.throws(() => validateProbe({ ...probe, streams: [{ ...stream, ...changed }] }, REQUIRED_SPEC));
  assert.throws(() => validateProbe({ ...probe, format: { duration: '29' } }, REQUIRED_SPEC));
});

function metric(index: number): ImageMetric {
  return { frame: index, hash: createHash('sha256').update(String(index)).digest('hex'), meanLuma: 100, darkFraction: 0.1, variance: 400, meanAbsoluteChange: index ? 1 : null };
}

test('complete freeze and excessive repeated frames fail screenshot QA', () => {
  const images = Array.from({ length: 900 }, (_, i) => metric(i));
  assert.equal(validateImages(images, 900, 30).exactDuplicates, 0);
  const frozen = images.map((image, i) => ({ ...image, hash: i < 20 ? images[0].hash : image.hash }));
  assert.throws(() => validateImages(frozen, 900, 30), /Frozen scene/);
  const duplicates = images.map((image, i) => ({ ...image, hash: i % 10 === 1 ? images[i - 1].hash : image.hash }));
  assert.throws(() => validateImages(duplicates, 900, 30), /Excessive duplicate/);
});

test('black frames and uniform missing-texture scenes fail pixel QA', async () => {
  const black = await sharp({ create: { width: 320, height: 180, channels: 3, background: '#000' } }).png().toBuffer();
  await assert.rejects(() => measureImage(black, 0), /black scene/);
  const blank = await sharp({ create: { width: 320, height: 180, channels: 3, background: '#888' } }).png().toBuffer();
  await assert.rejects(() => measureImage(blank, 0), /lacks texture/);
});

test('error redaction removes URL credentials/query tokens and known secrets', () => {
  process.env.TEST_RENDER_SECRET = 'unique-sensitive-value';
  try {
    const message = redact('Failed https://user:pass@survey.example.org/tiles?key=unknown-token with unique-sensitive-value api_key=another-token');
    assert.equal(message.includes('user:pass'), false);
    assert.equal(message.includes('unknown-token'), false);
    assert.equal(message.includes('unique-sensitive-value'), false);
    assert.equal(message.includes('another-token'), false);
  } finally { delete process.env.TEST_RENDER_SECRET; }
});

test('FFmpeg and FFprobe round trip a diagnostic synthetic fixture; corrupt video fails', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'flyover-qa-fixture-'));
  const video = path.join(directory, 'diagnostic-synthetic-fixture.mp4');
  const image = path.join(directory, 'diagnostic-frame.png');
  const binaries = binaryPaths();
  try {
    await runProcess(binaries.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=30:duration=1', '-frames:v', '30', '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', video], { timeoutMs: 60_000 });
    const spec = { width: 320, height: 180, fps: 30, frames: 30, duration: 1 };
    assert.equal((await validateVideo(video, spec, binaries)).decoded, true);
    await runProcess(binaries.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-i', video, '-frames:v', '1', image], { timeoutMs: 60_000 });
    assert((await measureImage(await readFile(image), 0)).metric.variance > 8);
    for (const [name, pattern, expectedError] of [
      ['black', 'color=c=black:s=320x180:r=30:d=1', /black frame/],
      ['frozen', 'color=c=gray:s=320x180:r=30:d=1', /frozen interval/],
    ] as const) {
      const invalidVideo = path.join(directory, `diagnostic-${name}.mp4`);
      await runProcess(binaries.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-f', 'lavfi', '-i', pattern, '-frames:v', '30', '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', invalidVideo], { timeoutMs: 60_000 });
      await assert.rejects(() => validateVideo(invalidVideo, spec, binaries), expectedError);
    }
    await writeFile(video, 'This is deliberately not an MP4.');
    await assert.rejects(() => validateVideo(video, spec, binaries));
  } finally {
    // The temporary fixture has no geographic data and is never a final deliverable.
    const checkedDirectory = path.resolve(directory);
    assert.equal(path.dirname(checkedDirectory), path.resolve(tmpdir()));
    assert(path.basename(checkedDirectory).startsWith('flyover-qa-fixture-'));
    await rm(checkedDirectory, { recursive: true, force: true });
  }
});
