import { copyFile, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { binaryPaths, runProcess, validateVideo } from './qa';

const root = fileURLToPath(new URL('../../', import.meta.url));
const work = path.join(root, 'output/after-dark-video-orange');
const purpleWork = path.join(root, 'output/after-dark-video-purple');
const finalVideo = path.join(root, 'public/videos/pink-house-after-dark.mp4');
const poster = path.join(root, 'public/images/pink-house-after-dark-preview.webp');
const purpleSource = path.join(purpleWork, 'pink-house-after-dark-purple.mp4');
const spec = { width: 1280, height: 720, fps: 30, duration: 20, frames: 600 };
const filter = 'hue=h=90:s=1.2';

async function exists(file: string) { try { await stat(file); return true; } catch { return false; } }
async function main() {
  await mkdir(work, { recursive: true });
  if (!await exists(purpleSource)) await copyFile(finalVideo, purpleSource);
  const { ffmpeg, ffprobe } = binaryPaths();
  const partial = path.join(work, 'pink-house-after-dark-orange.partial.mp4');
  await runProcess(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', purpleSource, '-vf', filter, '-map', '0:v:0', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30', '-frames:v', '600', '-movflags', '+faststart', partial], { timeoutMs: 900_000 });
  console.log('Orange color change encoded; checking the delivered video.');
  const qa = await validateVideo(partial, spec);
  const probe = JSON.parse((await runProcess(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', partial])).stdout);
  if (probe.streams.some((stream: { codec_type: string }) => stream.codec_type === 'audio')) throw new Error('Unexpected audio.');
  const bytes = await readFile(partial);
  const moov = bytes.indexOf(Buffer.from('moov')), mdat = bytes.indexOf(Buffer.from('mdat'));
  if (moov < 0 || mdat < 0 || moov > mdat) throw new Error('MP4 faststart check failed.');
  for (const frame of [0, 270, 540]) {
    const sample = path.join(work, `sample-${String(frame).padStart(3, '0')}.png`);
    await runProcess(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-ss', String(frame / spec.fps), '-i', partial, '-frames:v', '1', sample]);
    if (frame === 0) await sharp(sample).webp({ quality: 89, effort: 6 }).toFile(poster);
  }
  const sourceManifest = JSON.parse(await readFile(path.join(purpleWork, 'manifest.json'), 'utf8'));
  await writeFile(path.join(work, 'manifest.json'), JSON.stringify({ ...sourceManifest, status: 'validated', video: finalVideo, poster, finalColor: 'intense orange / amber on charcoal', themeAccent: '#ff641a', colorChange: { method: 'FFmpeg video hue rotation', filter, source: purpleSource, preserve: ['geometry', 'coordinates', 'camera', 'timing', 'white labels', 'charcoal buildings'] } }, null, 2));
  await writeFile(path.join(work, 'qa.json'), JSON.stringify({ ...qa, noAudio: true, faststart: true, bytes: bytes.byteLength, filter }, null, 2));
  await rename(partial, finalVideo);
  console.log(`Validated orange video and extracted poster: ${bytes.byteLength} bytes, 20s/720p/30fps.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
