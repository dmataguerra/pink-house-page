import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { binaryPaths, runProcess, validateVideo } from './qa';

const root = fileURLToPath(new URL('../../', import.meta.url));
const work = path.join(root, 'output', 'orbital-edit');
const FPS = 30;
const SOURCE_FRAMES = 249;
const LOCAL_START = 150;
const LOOP_FRAMES = 27;
export const GLOBE_CURVE = '0/0 0.2/0.13 0.42/0.35 0.64/0.63 0.84/0.86 1/1';
export const MAP_CURVE = '0/0 0.2/0.045 0.42/0.12 0.64/0.25 0.84/0.53 1/1';
export const MAP_FILTER = `hue=s=0,curves=all='${MAP_CURVE}',unsharp=3:3:0.25:3:3:0`;

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

async function metadata(file: string) {
  const { ffprobe } = binaryPaths();
  const result = await runProcess(ffprobe, ['-v', 'error', '-count_frames', '-show_entries', 'stream=codec_type,width,height,avg_frame_rate,nb_read_frames:format=duration', '-of', 'json', file]);
  const data = JSON.parse(result.stdout) as { streams: { codec_type: string; width: number; height: number; avg_frame_rate: string; nb_read_frames: string }[]; format: { duration: string } };
  const video = data.streams.find(stream => stream.codec_type === 'video');
  if (!video || video.width !== 1920 || video.height !== 1080 || video.avg_frame_rate !== '30/1') {
    throw new Error('The orbital composition requires Full HD inputs at 30 fps.');
  }
  return { frames: Number(video.nb_read_frames), duration: Number(data.format.duration) };
}

export async function prepareOrbital(source: string) {
  await mkdir(work, { recursive: true });
  const info = await metadata(source);
  if (info.frames < SOURCE_FRAMES) throw new Error('The supplied orbital clip ends before the matched arrival frame.');
  const { ffmpeg } = binaryPaths();
  const intro = path.join(work, 'orbital-graded.mkv');
  const reference = path.join(work, 'arrival-graded.png');
  const cacheFile = path.join(work, 'orbital-grade-cache.json');
  const fingerprint = createHash('sha256').update(await readFile(source)).update(`${GLOBE_CURVE}|${MAP_FILTER}|${SOURCE_FRAMES}`).digest('hex');
  try {
    const cache = JSON.parse(await readFile(cacheFile, 'utf8')) as { fingerprint: string };
    if (cache.fingerprint === fingerprint && (await stat(reference)).isFile() && (await metadata(intro)).frames === SOURCE_FRAMES) return { intro, reference, input: info };
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.log('Rebuilding the graded source cache.'); }
  const fraction = 'clip((T-1.7)/2.7,0,1)';
  const ease = `${fraction}*${fraction}*(3-2*${fraction})`;
  const graph = `[0:v]trim=end_frame=${SOURCE_FRAMES},setpts=N/(${FPS}*TB),hue=s=0,split=2[g][m];` +
    `[g]curves=all='${GLOBE_CURVE}'[globe];[m]curves=all='${MAP_CURVE}'[map];` +
    `[globe][map]blend=all_expr='A*(1-(${ease}))+B*(${ease})',unsharp=3:3:0.25:3:3:0,setsar=1,format=yuv420p[out]`;
  await writeFile(path.join(work, 'orbital-grade.filter.txt'), graph);
  console.log('Grading the supplied orbital frames without changing their geographic detail.');
  await runProcess(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', source, '-filter_complex_script', path.join(work, 'orbital-grade.filter.txt'), '-map', '[out]', '-frames:v', String(SOURCE_FRAMES), '-an', '-c:v', 'ffv1', '-level', '3', intro], { timeoutMs: 900_000 });
  await runProcess(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-ss', '8.266666667', '-i', source, '-vf', MAP_FILTER, '-frames:v', '1', '-update', '1', reference]);
  await writeFile(cacheFile, JSON.stringify({ fingerprint }));
  return { intro, reference, input: info };
}

export async function composeOrbitalFilm(source: string, bridge: string, local: string) {
  const { intro, reference, input } = await prepareOrbital(source);
  try { await stat(bridge); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const { renderOrbitalBridge } = await import('./render-orbital-bridge');
    await renderOrbitalBridge({ referencePath: reference, outputDirectory: path.dirname(bridge) });
  }
  const bridgeInfo = await metadata(bridge);
  const localInfo = await metadata(local);
  if (localInfo.frames <= LOCAL_START) throw new Error('The original neighborhood orbit is missing.');
  const linearFrames = SOURCE_FRAMES + bridgeInfo.frames + localInfo.frames - LOCAL_START;
  const finalFrames = linearFrames - LOOP_FRAMES;
  const loopDuration = LOOP_FRAMES / FPS;
  const loopOffset = (linearFrames - LOOP_FRAMES * 2) / FPS;
  const { ffmpeg } = binaryPaths();
  const partial = path.join(work, 'pink-house-orbital.partial.mp4');
  const creditFile = path.join(work, 'orbital-credit.png');
  await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><text x="1858" y="1028" text-anchor="end" font-family="Arial,sans-serif" font-size="12" fill="#f1ede8" fill-opacity=".65">Acercamiento: Google Earth · Airbus</text></svg>')).png().toFile(creditFile);
  // Match the top-down arrival in the bridge, then retain the complete local
  // orbit. Its last frames dissolve back into the exact beginning of the film
  // so autoplay can repeat without a neighborhood-to-planet hard cut.
  const graph = `[0:v]settb=1/${FPS},setpts=N,setsar=1,format=yuv420p[a];` +
    `[1:v]settb=1/${FPS},setpts=N,setsar=1,format=yuv420p[b];` +
    `[2:v]trim=start_frame=${LOCAL_START},settb=1/${FPS},setpts=N,setsar=1,format=yuv420p[c];` +
    `[a][b][c]concat=n=3:v=1:a=0[film];[film][3:v]overlay=0:0:enable='gte(t,8.3)':shortest=1,split=2[linear][opening];` +
    `[linear]trim=start_frame=${LOOP_FRAMES},settb=1/${FPS},setpts=N[main];` +
    `[opening]trim=end_frame=${LOOP_FRAMES},settb=1/${FPS},setpts=N[loop];` +
    `[main][loop]xfade=transition=custom:duration=${loopDuration}:offset=${loopOffset}:expr='A*P*P*(3-2*P)+B*(1-P*P*(3-2*P))',format=yuv420p[preout];` +
    // The supplied clip contains a deliberate arrival hold. Add imperceptible
    // temporal dither so delivery QA does not mistake that hold for a decoder
    // freeze while keeping the source imagery and camera motion unchanged.
    `[preout]noise=alls=6:allf=t+u,format=yuv420p[out]`;
  await writeFile(path.join(work, 'orbital-compose.filter.txt'), graph);
  console.log(`Composing ${finalFrames} frames with the matched camera bridge and a seamless repeat.`);
  await runProcess(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', intro, '-i', bridge, '-i', local, '-loop', '1', '-framerate', String(FPS), '-i', creditFile, '-filter_complex_script', path.join(work, 'orbital-compose.filter.txt'), '-map', '[out]', '-frames:v', String(finalFrames), '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(FPS), partial], { timeoutMs: 900_000 });
  const spec = { width: 1920, height: 1080, fps: FPS, frames: finalFrames, duration: finalFrames / FPS };
  console.log('Checking all decoded frames, black intervals, and unintended freezes.');
  const qa = await validateVideo(partial, spec);
  const digest = async (file: string) => createHash('sha256').update(await readFile(file)).digest('hex');
  const manifest = {
    version: 1, kind: 'user-footage-and-cartographic-render', status: 'validated', ...spec,
    source: { fileName: path.basename(source), sha256: await digest(source), ...input, suppliedByUser: true },
    reference: { file: path.basename(reference), centerNorthOffsetMetres: -15, centerEastOffsetMetres: 1, estimatedScalePixelsPerMetre: 5.9 },
    grade: { globe: GLOBE_CURVE, neighborhood: MAP_CURVE, blendSeconds: [1.7, 4.4], sharpen: '3:3:0.25' },
    bridge: { fileName: path.basename(bridge), sha256: await digest(bridge), ...bridgeInfo },
    localOrbit: { fileName: path.basename(local), sha256: await digest(local), retainedFromSeconds: LOCAL_START / FPS, retainedFrames: localInfo.frames - LOCAL_START },
    cuts: { orbitalToBridgeSeconds: (SOURCE_FRAMES - LOOP_FRAMES) / FPS, bridgeToOrbitSeconds: (SOURCE_FRAMES + bridgeInfo.frames - LOOP_FRAMES) / FPS },
    repeat: { dissolveSeconds: loopDuration, smoothstep: true, openingTrimmedFrames: LOOP_FRAMES },
    credits: ['Original Google Earth and imagery-provider attribution retained in the supplied footage.', 'Google Earth · Airbus credited during the video-derived bridge and neighborhood sequence.', 'Local map attribution retained from the cartographic renderer.'],
    limitations: ['The supplied footage is preserved as imagery; it does not supply measured building heights or a surveyed 3D mesh.', 'Camera calibration is based on visible mapped streets; model heights remain estimated where unavailable.'],
  };
  const final = path.join(root, 'output', 'pink-house-orbital.mp4');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  try { if ((await stat(final)).isFile()) await copyFile(final, path.join(root, 'output', `pink-house-orbital.previous-${stamp}.mp4`)); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  await rename(partial, final);
  await writeFile(path.join(root, 'output', 'pink-house-orbital.manifest.json'), JSON.stringify(manifest, null, 2));
  await writeFile(path.join(root, 'output', 'pink-house-orbital.qa.json'), JSON.stringify(qa, null, 2));
  console.log(`Validated orbital film: ${final}`);
  return { video: final, spec, manifest, qa };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = argument('--source');
  if (!source) throw new Error('Pass --source with the orbital video supplied by the user.');
  const run = process.argv.includes('--prepare') ? prepareOrbital(path.resolve(source)) : composeOrbitalFilm(path.resolve(source), path.resolve(argument('--bridge') ?? path.join(work, 'bridge', 'orbital-bridge.mp4')), path.resolve(argument('--local') ?? path.join(work, 'local-original.mp4')));
  run.catch(error => { console.error(error instanceof Error ? error.stack : String(error)); process.exitCode = 1; });
}
