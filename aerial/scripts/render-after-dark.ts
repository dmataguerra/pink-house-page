import { mkdir, readFile, writeFile, stat, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { TARGET } from '../src/config';
import { illustratedPose } from '../src/illustrated-camera';
import { gatherData, frameSvgAtPose, type ScenePose } from './render-software';
import { binaryPaths, runProcess, validateVideo } from './qa';

const aerialRoot = fileURLToPath(new URL('../', import.meta.url));
const root = path.resolve(aerialRoot, '..');
const SOURCE_PALETTE = process.argv.includes('--purple-source') ? 'purple' : 'orange';
const HOUSE_ACCENT = SOURCE_PALETTE === 'orange' ? '#ff641a' : '#ed43d4';
const work = path.join(root, 'output', SOURCE_PALETTE === 'orange' ? 'after-dark-video-orange-source-v2-start390-17s' : 'after-dark-video-purple-v2-start390-17s');
const videoFile = path.join(root, 'public/videos/pink-house-after-dark.mp4');
const posterFile = path.join(root, 'public/images/pink-house-after-dark-preview.webp');
const FIRST_SOURCE_FRAME = 390;
const SPEC = { width: 1280, height: 720, fps: 30, duration: 17, frames: 510 };
const POINTS = [
  { name: 'Pink House', latitude: TARGET.latitude, longitude: TARGET.longitude },
  { name: 'UAQ', latitude: 20.70438308336931, longitude: -100.44387705896915 },
  { name: 'UVM', latitude: 20.70827004638903, longitude: -100.4453510329209 },
  { name: 'ENES', latitude: 20.705875489620908, longitude: -100.44812312985161 },
];

async function exists(file: string) { try { await stat(file); return true; } catch { return false; } }
async function json(file: string) { return JSON.parse(await readFile(file, 'utf8')); }

/** Reuse the existing local flyover, including its original 1.35 framing. */
function poseAt(frame: number): ScenePose {
  const pose = illustratedPose(FIRST_SOURCE_FRAME + frame);
  return pose.range < 20000 ? {
    ...pose, east: pose.east * 1.35, north: pose.north * 1.35,
    up: pose.up * 1.35, range: pose.range * 1.35,
  } : pose;
}

/** Apply the palette to vector geometry before rasterization. No image grading. */
function afterDarkTheme(svg: string): string {
  // Remove the two source house dots so the single new ring remains legible.
  svg = svg.replace(/<circle[^>]+r="10" fill="#f1ede8"[^>]+\/>/g, '');
  svg = svg.replace(/<circle[^>]+r="22" fill="#f1ede8"[^>]+\/><circle[^>]+r="9" fill="#f1ede8"[^>]+\/><text[^>]+><\/text>/g, '');
  const purpleColors: Record<string, string> = {
    '#09070e': '#080809', '#110d18': '#0d0d0f',
    '#171717': '#0a0a0c', '#292929': '#151517',
    '#060606': '#030304', '#373737': '#3b1555', '#726b78': '#602681',
    '#ed5290': '#c749ff', '#c72e6c': '#ba32ef', '#661034': '#45115c',
    '#080607': '#240b39', '#000000': '#07050a',
    '#55b9ff': '#c749ff', '#ff1f3d': '#d148f1', '#ffd447': '#e243dd',
    '#f1ede8': '#f6f4f5', '#ffffff': '#ed43d4',
  };
  const colors: Record<string, string> = SOURCE_PALETTE === 'purple' ? purpleColors : {
    ...purpleColors,
    '#373737': '#452116', '#726b78': '#703c25',
    '#ed5290': '#ff641a', '#c72e6c': '#d84b12', '#661034': '#57210d',
    '#080607': '#1c0d07', '#55b9ff': '#ff641a', '#ff1f3d': '#ff792d',
    '#ffd447': '#ffa443', '#ffffff': '#ff641a',
  };
  svg = svg.replace(/#[\da-f]{6}/gi, color => colors[color.toLowerCase()] ?? color);
  svg = svg.replace(/rgb\(([\d.]+),([\d.]+),([\d.]+)\)/g, (_all, red) => {
    const value = Number(red);
    if (value > 100) return SOURCE_PALETTE === 'orange' ? 'rgb(196,66,18)' : 'rgb(181,32,161)';
    const tone = Math.round(value * .72);
    return SOURCE_PALETTE === 'orange' ? `rgb(${tone + 2},${tone},${tone - 1})` : `rgb(${tone + 1},${tone},${tone + 3})`;
  });
  // Keep named campuses in place while adapting the label to the user's name.
  svg = svg.replace(/>FIF<\/text>/g, '>UAQ</text>');
  svg = svg.replace(/(<circle[^>]+r="9"[^>]+)stroke="#(?:ed43d4|ff641a)"/g, '$1stroke="#ffffff"');
  svg = svg.replace(/<text\b([^>]+)fill="#[\da-f]{6}"([^>]+)>/gi,
    (_all, before, after) => `<text${before}fill="#f6f4f5"${after}>`);
  // The source overlay is disabled; the house gets the dark map's own marker.
  return svg.replace(/<g opacity="0">[\s\S]*?<\/g><\/svg>$/, '</svg>');
}

function markerOverlay(time: number): string {
  const pulse = 40 + Math.sin(time * Math.PI) * 3;
  return `<defs><radialGradient id="house-halo"><stop offset="0" stop-color="${HOUSE_ACCENT}" stop-opacity=".28"/><stop offset="1" stop-color="${HOUSE_ACCENT}" stop-opacity="0"/></radialGradient></defs>
  <g font-family="Arial,sans-serif"><circle cx="960" cy="540" r="82" fill="url(#house-halo)"/>
  <circle cx="960" cy="540" r="${pulse.toFixed(2)}" fill="none" stroke="${HOUSE_ACCENT}" stroke-width="1.4" opacity=".8"/>
  <circle cx="960" cy="540" r="24" fill="none" stroke="${HOUSE_ACCENT}" stroke-width="1.2" opacity=".5"/>
  <circle cx="960" cy="540" r="9" fill="${HOUSE_ACCENT}" stroke="#f6f4f5" stroke-width="2"/>
  <line x1="960" y1="531" x2="960" y2="467" stroke="${HOUSE_ACCENT}" stroke-width="2"/>
  <rect x="794" y="414" width="332" height="53" fill="#080809" fill-opacity=".94" stroke="${HOUSE_ACCENT}" stroke-width="1.5"/>
  <text x="960" y="447" fill="#ffffff" text-anchor="middle" font-size="19" font-weight="700" letter-spacing="3">THE PINK HOUSE</text>
  <text x="64" y="63" fill="#ffffff" font-size="15" font-weight="700" letter-spacing="2.8">JURIQUILLA, QUERÉTARO</text>
  <text x="64" y="1028" fill="#e8e5e7" fill-opacity=".65" font-size="12">Visualización aproximada · alturas estimadas</text>
  <text x="1856" y="1052" fill="#e8e5e7" fill-opacity=".55" text-anchor="end" font-size="11">© OpenStreetMap contributors · openstreetmap.org/copyright · Overture · Microsoft Global ML Building Footprints · Google Open Buildings (CC BY 4.0)</text></g>`;
}

export function afterDarkFrameSvg(frame: number, data: ReturnType<typeof gatherData>): string {
  const pose = poseAt(frame);
  const scene = afterDarkTheme(frameSvgAtPose(pose, data, { brand: 'Pink House' }, { overlayOpacity: 0 }));
  return scene.replace('<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"', `<svg xmlns="http://www.w3.org/2000/svg" width="${SPEC.width}" height="${SPEC.height}"`)
    .replace('</svg>', `${markerOverlay(frame / SPEC.fps)}</svg>`);
}

export async function renderAfterDark({ preview = false }: { preview?: boolean } = {}): Promise<void> {
  const osm = await json(path.join(aerialRoot, 'public/open-data/osm.json'));
  const microsoft = await json(path.join(aerialRoot, 'public/open-data/microsoft-buildings.geojson'));
  const overture = await json(path.join(aerialRoot, 'public/open-data/overture-buildings.geojson'));
  const data = gatherData(osm, microsoft, overture, { includeEnesBuilding: true });
  await mkdir(work, { recursive: true });
  await mkdir(path.dirname(videoFile), { recursive: true });
  await mkdir(path.dirname(posterFile), { recursive: true });
  const sampleFrames = [0, 240, 480];
  for (const frame of sampleFrames) {
    const svg = afterDarkFrameSvg(frame, data);
    if (/#[5]5b9ff|#ffd447|>FIF<\/text>/.test(svg)) throw new Error('Legacy color or label remains.');
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    await writeFile(path.join(work, `sample-${String(frame).padStart(3, '0')}.png`), png);
    if (frame === 0) await sharp(png).webp({ quality: 89, effort: 6 }).toFile(posterFile);
    console.log(`Preview frame ${frame}/${SPEC.frames}: ${png.byteLength} bytes.`);
  }
  const source = {
    kind: 'cartographic-preview', style: `after-dark-${SOURCE_PALETTE}`, points: POINTS,
    sourceFrames: [FIRST_SOURCE_FRAME, FIRST_SOURCE_FRAME + SPEC.frames - 1],
    sourceCamera: 'illustratedPose, preserved existing local path and 1.35 framing',
    theme: { palette: SOURCE_PALETTE, ground: '#080809', buildingEdges: SOURCE_PALETTE === 'orange' ? '#703c25' : '#602681', roads: SOURCE_PALETTE === 'orange' ? '#ff641a' : '#c749ff', target: HOUSE_ACCENT, labels: '#f6f4f5' },
    geometryCount: data.structures.length, roads: data.roads.length,
    mappedBuildingCount: data.mappedBuildingCount, microsoftBuildings: data.microsoftCount,
    overtureBuildings: data.overtureCount, proceduralBuildings: data.proceduralCount,
    estimatedHeightCount: data.structures.filter(item => item.heightEstimated).length,
    illustrativeEnesBuilding: true, photorealistic: false, targetHouseReconstructionVerified: false,
    openStreetMap: await json(path.join(aerialRoot, 'public/open-data/source.json')),
    microsoft: await json(path.join(aerialRoot, 'public/open-data/source-microsoft.json')),
    overture: await json(path.join(aerialRoot, 'public/open-data/source-overture.json')),
  };
  await writeFile(path.join(work, 'source.json'), JSON.stringify({ ...SPEC, source }, null, 2));
  if (preview) { console.log('Preview only: no video encoded.'); return; }

  const framesRoot = path.join(work, 'frames');
  await mkdir(framesRoot, { recursive: true });
  const concurrency = 4;
  const pending = new Map<number, Promise<Buffer>>();
  const schedule = (frame: number) => {
    if (frame >= SPEC.frames) return;
    pending.set(frame, sharp(Buffer.from(afterDarkFrameSvg(frame, data))).png({ compressionLevel: 1 }).toBuffer());
  };
  for (let frame = 0; frame < concurrency; frame++) schedule(frame);
  for (let frame = 0; frame < SPEC.frames; frame++) {
    const png = await pending.get(frame)!;
    pending.delete(frame);
    schedule(frame + concurrency);
    await writeFile(path.join(framesRoot, `frame-${String(frame).padStart(6, '0')}.png`), png);
    if ((frame + 1) % 30 === 0) console.log(`Rendered ${frame + 1}/${SPEC.frames} frames.`);
  }
  const { ffmpeg, ffprobe } = binaryPaths();
  const partial = path.join(work, 'pink-house-after-dark.partial.mp4');
  await runProcess(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-framerate', String(SPEC.fps), '-start_number', '0', '-i', path.join(framesRoot, 'frame-%06d.png'), '-frames:v', String(SPEC.frames), '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(SPEC.fps), partial], { timeoutMs: 900_000 });
  console.log('Encoded MP4; validating frames, codec, duration and decoding.');
  const qa = await validateVideo(partial, SPEC);
  const probe = await runProcess(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', partial]);
  const metadata = JSON.parse(probe.stdout);
  if (metadata.streams.some((stream: { codec_type: string }) => stream.codec_type === 'audio')) throw new Error('Unexpected audio stream.');
  const mp4 = await readFile(partial);
  const moov = mp4.indexOf(Buffer.from('moov'));
  const mdat = mp4.indexOf(Buffer.from('mdat'));
  if (moov < 0 || mdat < 0 || moov > mdat) throw new Error('Faststart MP4 atom ordering is incorrect.');
  if (await exists(videoFile)) throw new Error('After Dark output already exists; preserve it before replacing.');
  await rename(partial, videoFile);
  await writeFile(path.join(work, 'qa.json'), JSON.stringify({ ...qa, noAudio: true, faststart: true, bytes: mp4.byteLength }, null, 2));
  await writeFile(path.join(work, 'manifest.json'), JSON.stringify({ ...SPEC, source, status: 'validated', video: videoFile, poster: posterFile }, null, 2));
  console.log(`Validated ${videoFile}: ${SPEC.duration}s, ${SPEC.width}x${SPEC.height}, ${SPEC.fps}fps, ${mp4.byteLength} bytes.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  renderAfterDark({ preview: process.argv.includes('--preview') }).catch(error => { console.error(error); process.exitCode = 1; });
}
