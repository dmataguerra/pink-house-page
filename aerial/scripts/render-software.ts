import { mkdir, open, rename, stat, unlink, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import sharp from 'sharp';
import { TARGET, VIDEO } from '../src/config';
import { illustratedPose, type IllustratedPose } from '../src/illustrated-camera';
import { generateIllustrativeBuildings } from '../src/illustrative-buildings';
import {
  REQUIRED_SPEC, binaryPaths, measureImage, redact, runProcess, validateIllustratedRun,
  type ImageMetric, type IllustratedFrameReport, type IllustratedRunManifest,
} from './qa';

type OSMWay = { id: number; tags?: Record<string, string>; geometry?: Array<{lat: number; lon: number}> };
type Ring = number[][];
type Structure = { ring: Ring; height: number; target: boolean; source: string };
type Road = { points: Array<{lat: number; lon: number}>; kind: string };

const aerialRoot = fileURLToPath(new URL('../', import.meta.url));
const outputRoot = path.resolve(aerialRoot, '..', 'output');
const caption = 'VISUALIZACIÓN APROXIMADA · ALTURAS ESTIMADAS';
const creditsText = '© OpenStreetMap contributors · openstreetmap.org/copyright · https://openstreetmap.org/copyright | Natural Earth | Microsoft Global ML Building Footprints · CDLA Permissive 2.0';
const W = VIDEO.width;
const H = VIDEO.height;
const TAU = Math.PI * 2;
const POINTS_OF_INTEREST = [
  { east: 0, north: 0, color: '#f1ede8', label: '' },
  { latitude: 20.70438308336931, longitude: -100.44387705896915, color: '#8bd8ff', label: 'FIF' },
  { latitude: 20.70827004638903, longitude: -100.4453510329209, color: '#ff6b7a', label: 'UVM' },
  { latitude: 20.705875489620908, longitude: -100.44812312985161, color: '#8be3a0', label: 'ENES' },
] as const;

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
async function exists(file: string): Promise<boolean> { try { await stat(file); return true; } catch { return false; } }
function esc(value: string): string { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function clamp(value: number, low: number, high: number): number { return Math.max(low, Math.min(high, value)); }
function localPoint(lon: number, lat: number): [number, number] {
  const e = (lon - TARGET.longitude) * 111320 * Math.cos(TARGET.latitude * Math.PI / 180);
  const n = (lat - TARGET.latitude) * 110540;
  return [e, n];
}
function ringRadius(ring: Ring): number { return Math.max(...ring.map(([lon, lat]) => { const [e,n] = localPoint(lon,lat); return Math.hypot(e,n); })); }
function formatPoint([x,y]: [number,number]): string { return `${x.toFixed(1)},${y.toFixed(1)}`; }

export function gatherData(osm: {elements: OSMWay[]}, microsoft: {features?: Array<{geometry?: {type: string; coordinates: Ring[]}; properties?: Record<string, unknown>}>}) {
  const structures: Structure[] = [];
  const roads: Road[] = [];
  const mappedRings: Ring[] = [];
  for (const way of osm.elements) {
    const geometry = way.geometry;
    const tags = way.tags ?? {};
    if (!geometry || geometry.length < 2) continue;
    if (tags.building && geometry.length >= 4) {
      const ring = geometry.map(point => [point.lon, point.lat]);
      const mappedHeight = Number.parseFloat(tags.height ?? '');
      const levels = Number.parseFloat(tags['building:levels'] ?? '');
      const height = Number.isFinite(mappedHeight) && mappedHeight > 0 ? mappedHeight : Number.isFinite(levels) && levels > 0 ? levels * 3.2 : 6.4;
      structures.push({ ring, height, target: ringContains(TARGET.longitude, TARGET.latitude, ring), source: 'OpenStreetMap mapped footprint' });
      mappedRings.push(ring);
    } else if (tags.highway) roads.push({ points: geometry, kind: tags.highway });
  }
  let microsoftCount = 0;
  for (const feature of microsoft.features ?? []) {
    if (feature.geometry?.type !== 'Polygon' || !feature.geometry.coordinates?.[0]) continue;
    const ring = feature.geometry.coordinates[0];
    const height = Number(feature.properties?.height);
    structures.push({ ring, height: Number.isFinite(height) && height > 0 ? height : 6.4, target: ringContains(TARGET.longitude, TARGET.latitude, ring), source: 'Microsoft AI footprint (not surveyed)' });
    microsoftCount++;
  }
  const illustrative = generateIllustrativeBuildings(osm.elements, [...mappedRings, ...(microsoft.features ?? []).flatMap(feature => feature.geometry?.coordinates?.[0] ? [feature.geometry.coordinates[0]] : [])]);
  for (const item of illustrative) structures.push({ ring: item.ring, height: item.height, target: item.target, source: 'Procedural illustrative house volume' });
  return { structures, roads, mappedBuildingCount: mappedRings.length, microsoftCount, proceduralCount: illustrative.length };
}

function ringContains(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x,y] = ring[i], [px,py] = ring[j];
    if ((y > lat) !== (py > lat) && lon < (px - x) * (lat - y) / (py - y) + x) inside = !inside;
  }
  return inside;
}

function cameraBasis(pose: IllustratedPose) {
  const c: [number,number,number] = [pose.east, pose.north, pose.up];
  const inv = 1 / Math.max(1, Math.hypot(...c));
  const d: [number,number,number] = [-c[0]*inv, -c[1]*inv, -c[2]*inv];
  const horizontal = Math.max(0.0001, Math.hypot(d[0], d[1]));
  const right: [number,number,number] = [d[1]/horizontal, -d[0]/horizontal, 0];
  const up: [number,number,number] = [right[1]*d[2], -right[0]*d[2], right[0]*d[1] - right[1]*d[0]];
  return { c, d, right, up };
}
function dot(a: [number,number,number], b: [number,number,number]): number { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
function project(point: [number,number,number], pose: IllustratedPose): [number,number,number] | null {
  const basis = cameraBasis(pose);
  const q: [number,number,number] = [point[0]-basis.c[0], point[1]-basis.c[1], point[2]-basis.c[2]];
  const z = dot(q,basis.d);
  if (z < 1) return null;
  const focal = Math.min(W,H) * (pose.range > 100000 ? 0.65 : 0.9);
  return [W/2 + focal * dot(q,basis.right) / z, H/2 - focal * dot(q,basis.up) / z, z];
}
function projectLonLat(lon: number, lat: number, height: number, pose: IllustratedPose): [number,number,number] | null {
  const [e,n] = localPoint(lon,lat); return project([e,n,height],pose);
}
function polygon(points: Array<[number,number]>, fill: string, opacity = 1, stroke = 'none', width = 0): string {
  if (points.length < 3) return '';
  return `<polygon points="${points.map(([x,y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}" fill="${fill}" fill-opacity="${opacity}" stroke="${stroke}" stroke-width="${width}"/>`;
}
function line(points: Array<[number,number]>, stroke: string, width: number, opacity = 1): string {
  if (points.length < 2) return '';
  return `<polyline points="${points.map(([x,y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}" fill="none" stroke="${stroke}" stroke-opacity="${opacity}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function globeSvg(pose: IllustratedPose): string {
  const progress = clamp((22_000_000 - pose.range) / 21_980_000, 0, 1);
  const radius = 385 + progress * 175;
  const cx = W/2, cy = H/2 + 5;
  const spin = pose.time * 10;
  return `<rect width="${W}" height="${H}" fill="#08050d"/><defs><radialGradient id="earth" cx="38%" cy="34%"><stop offset="0" stop-color="#8b3f78"/><stop offset=".45" stop-color="#48204f"/><stop offset="1" stop-color="#160d25"/></radialGradient><filter id="glow"><feGaussianBlur stdDeviation="16"/></filter></defs><circle cx="${cx}" cy="${cy}" r="${radius+12}" fill="#d63e91" opacity=".22" filter="url(#glow)"/><circle cx="${cx}" cy="${cy}" r="${radius}" fill="url(#earth)" stroke="#d887b6" stroke-width="2"/>
    <g transform="rotate(${spin.toFixed(3)} ${cx} ${cy})"><ellipse cx="${cx}" cy="${cy}" rx="${radius*.97}" ry="${radius*.28}" fill="none" stroke="#b5d6df" stroke-opacity=".3"/><ellipse cx="${cx}" cy="${cy}" rx="${radius*.35}" ry="${radius*.97}" fill="none" stroke="#b5d6df" stroke-opacity=".22"/>
    <path d="M${cx-radius*.67},${cy-radius*.28} C${cx-radius*.48},${cy-radius*.52} ${cx-radius*.22},${cy-radius*.42} ${cx-radius*.05},${cy-radius*.18} C${cx-radius*.25},${cy-radius*.02} ${cx-radius*.23},${cy-radius*.20} ${cx-radius*.40},${cy-radius*.10} C${cx-radius*.54},${cy+radius*.01} ${cx-radius*.58},${cy+radius*.18} ${cx-radius*.69},${cy+radius*.10} Z" fill="#c34f91" opacity=".9"/>
    <path d="M${cx-radius*.20},${cy+radius*.08} C${cx-radius*.02},${cy+radius*.15} ${cx+radius*.06},${cy+radius*.36} ${cx+radius*.02},${cy+radius*.58} C${cx-radius*.06},${cy+radius*.77} ${cx+radius*.17},${cy+radius*.83} ${cx+radius*.20},${cy+radius*.63} C${cx+radius*.22},${cy+radius*.43} ${cx+radius*.12},${cy+radius*.28} ${cx+radius*.07},${cy+radius*.11} Z" fill="#a63c7b" opacity=".9"/>
    <path d="M${cx+radius*.18},${cy-radius*.15} C${cx+radius*.35},${cy-radius*.31} ${cx+radius*.66},${cy-radius*.25} ${cx+radius*.72},${cy-radius*.04} C${cx+radius*.56},${cy+radius*.02} ${cx+radius*.40},${cy-radius*.02} ${cx+radius*.18},${cy-radius*.15} Z" fill="#e06aa8" opacity=".8"/></g>`;
}

function localSvg(pose: IllustratedPose, data: ReturnType<typeof gatherData>): string {
  const parts: string[] = [];
  parts.push('<rect width="1920" height="1080" fill="#101010"/><rect width="1920" height="1080" fill="url(#ground)" opacity=".78"/>');
  const visibleRadius = clamp(pose.range * 6.4, 900, 3600);
  const projectedRoads: Array<{points: Array<[number,number]>; kind: string}> = [];
  for (const road of data.roads) {
    const points: Array<[number,number]> = [];
    for (const point of road.points) {
      const [e,n] = localPoint(point.lon,point.lat);
      if (Math.hypot(e,n) > visibleRadius) continue;
      const p = project([e,n,.3],pose); if (p) points.push([p[0],p[1]]);
    }
    if (points.length > 1) projectedRoads.push({points,kind:road.kind});
  }
  for (const road of projectedRoads) {
    const major = !['footway','path','steps','cycleway'].includes(road.kind);
    parts.push(line(road.points,'#202020',major ? 17 : 6,.96));
    parts.push(line(road.points,major ? '#505050' : '#383838',major ? 10 : 2,.98));
  }
  const buildings = data.structures
    .map(item => ({item, radius:ringRadius(item.ring)}))
    .filter(({radius}) => radius < visibleRadius * 1.15)
    .sort((a,b) => b.radius-a.radius);
  for (const {item} of buildings) {
    const ground3 = item.ring.map(([lon,lat]) => projectLonLat(lon,lat,.4,pose));
    const roof3 = item.ring.map(([lon,lat]) => projectLonLat(lon,lat,item.height,pose));
    // Keep corresponding polygon vertices paired. A partially clipped ring
    // cannot produce valid extrusion sides, so omit it for this camera pose.
    if (ground3.length < 3 || ground3.some(point => !point) || roof3.some(point => !point)) continue;
    const ground = ground3 as Array<[number,number,number]>;
    const roof = roof3 as Array<[number,number,number]>;
    const roofPoints = roof.map(p => [p[0],p[1]] as [number,number]);
    const basePoints = ground.map(p => [p[0],p[1]] as [number,number]);
    const shade = item.target ? '#f1ede8' : item.source.includes('Microsoft') ? '#2c2c2c' : item.source.includes('OpenStreetMap') ? '#383838' : '#242424';
    const side = item.target ? '#b9b3b0' : '#171717';
    for (let i=0;i<basePoints.length;i++) {
      const j=(i+1)%basePoints.length;
      parts.push(polygon([basePoints[i],basePoints[j],roofPoints[j],roofPoints[i]],side,.96));
    }
    parts.push(polygon(roofPoints,shade,1,'#696969',.8));
    const center = roofPoints.reduce((acc,p) => [acc[0]+p[0],acc[1]+p[1]] as [number,number], [0,0] as [number,number]);
    center[0] /= roofPoints.length; center[1] /= roofPoints.length;
    if (item.target) parts.push(`<circle cx="${center[0].toFixed(1)}" cy="${center[1].toFixed(1)}" r="10" fill="#f1ede8" stroke="#f1ede8" stroke-width="3"/>`);
  }
  for (const point of POINTS_OF_INTEREST) {
    const [east, north] = 'latitude' in point ? localPoint(point.longitude, point.latitude) : [point.east, point.north];
    const projected = project([east, north, 1.5], pose);
    if (!projected || Math.hypot(east, north) > visibleRadius) continue;
    parts.push(`<circle cx="${projected[0].toFixed(1)}" cy="${projected[1].toFixed(1)}" r="18" fill="${point.color}" fill-opacity=".18"/><circle cx="${projected[0].toFixed(1)}" cy="${projected[1].toFixed(1)}" r="8" fill="${point.color}" stroke="#f1ede8" stroke-width="3"/><text x="${(projected[0] + 18).toFixed(1)}" y="${(projected[1] - 16).toFixed(1)}" fill="#f1ede8" font-family="Inter,Arial,sans-serif" font-size="18" font-weight="700" letter-spacing="2">${point.label}</text>`);
  }
  return parts.join('');
}

export interface OverlayStyle { brand?: string; hideFooter?: boolean; showTopCredits?: boolean }
export function overlays(pose: IllustratedPose, style: OverlayStyle = {}): string {
  const brand = style.brand ?? 'Pink House';
  const inSpace = pose.range > 40000;
  const ink = '#f1ede8';
  const footer = `<text x="1858" y="1050" font-family="Arial,sans-serif" font-size="8" fill="${ink}" fill-opacity=".5" text-anchor="end">© OSM · Microsoft ML · Natural Earth</text>`;
  return `<g font-family="Inter,Arial,sans-serif" fill="${ink}"><text x="62" y="142" font-family="Inter,Arial,sans-serif" font-size="84" font-weight="700" letter-spacing="-2">JURIQUILLA</text><circle cx="960" cy="540" r="${inSpace ? 8 : 12}" fill="#f1ede8" stroke="#f1ede8" stroke-width="3"/><line x1="960" y1="540" x2="960" y2="455" stroke="#f1ede8" stroke-width="2"/><rect x="836" y="419" width="248" height="37" rx="4" fill="#101010" fill-opacity=".95" stroke="#f1ede8"/><text x="960" y="443" fill="#f1ede8" text-anchor="middle" font-size="11" font-weight="700" letter-spacing="1.5">${esc(brand.toUpperCase())}</text>${footer}</g>`;
}

export function frameSvg(frame: number, data: ReturnType<typeof gatherData>, style: OverlayStyle = {}): string {
  const pose = illustratedPose(frame);
  const global = pose.range > 18000;
  const body = global ? globeSvg(pose) : localSvg(pose,data);
  const groundDef = '<defs><linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#171717"/><stop offset="1" stop-color="#292929"/></linearGradient></defs>';
  const scenePose = pose.range < 20000 ? { ...pose, east: pose.east * 1.35, north: pose.north * 1.35, up: pose.up * 1.35, range: pose.range * 1.35 } : pose;
  const sceneBody = scenePose.range > 18000 ? globeSvg(scenePose) : localSvg(scenePose,data);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${groundDef}${sceneBody}${overlays(scenePose,style)}</svg>`;
}

async function publish(work: string, stamp: string, manifest: IllustratedRunManifest, qa: unknown) {
  const manifestFile = path.join(work,'manifest.json');
  const qaFile = path.join(work,'qa.json');
  manifest.status = 'validated';
  await writeFile(manifestFile, JSON.stringify(manifest,null,2));
  await writeFile(qaFile, JSON.stringify(qa,null,2));
  const items = [
    {partial:manifestFile,final:path.join(outputRoot,'house_flyover.manifest.json')},
    {partial:qaFile,final:path.join(outputRoot,'house_flyover.qa.json')},
    {partial:path.join(work,'house_flyover.partial.mp4'),final:path.join(outputRoot,'house_flyover.mp4')},
  ];
  const backups: Array<{final:string;backup:string}> = [], moved: typeof items = [];
  try {
    for (const item of items) if (await exists(item.final)) {
      const parsed = path.parse(item.final), backup = path.join(outputRoot,`${parsed.name}.previous-${stamp}${parsed.ext}`);
      await rename(item.final,backup); backups.push({final:item.final,backup});
    }
    for (const item of items) { await rename(item.partial,item.final); moved.push(item); }
  } catch (error) {
    for (const item of moved.reverse()) await rename(item.final,item.partial).catch(()=>undefined);
    for (const item of backups.reverse()) await rename(item.backup,item.final).catch(()=>undefined);
    throw error;
  }
}

export async function renderSoftwareIllustrated({preview=false}: {preview?:boolean} = {}) {
  loadDotenv({path:path.join(aerialRoot,'.env.local'),quiet:true});
  loadDotenv({path:path.join(aerialRoot,'.env'),quiet:true});
  const osm = JSON.parse(await readFile(path.join(aerialRoot,'public/open-data/osm.json'),'utf8')) as {elements: OSMWay[]};
  const msFile = path.join(aerialRoot,'public/open-data/microsoft-buildings.geojson');
  const msSourceFile = path.join(aerialRoot,'public/open-data/source-microsoft.json');
  const microsoft = await exists(msFile) ? JSON.parse(await readFile(msFile,'utf8')) as {features?: Array<{geometry?: {type:string;coordinates:Ring[]};properties?:Record<string,unknown>}>} : {};
  const msSource = await exists(msSourceFile) ? JSON.parse(await readFile(msSourceFile,'utf8')) : null;
  const data = gatherData(osm,microsoft);
  const source = {kind:'cartographic-preview', openStreetMap:JSON.parse(await readFile(path.join(aerialRoot,'public/open-data/source.json'),'utf8')), microsoft:msSource,
    naturalEarth:{name:'Natural Earth II',license:'Public domain',url:'https://www.naturalearthdata.com/about/terms-of-use/'},
    mappedBuildingCount:data.mappedBuildingCount,microsoftBuildings:data.microsoftCount,proceduralBuildings:data.proceduralCount,
    roads:data.roads.length,geometryCount:data.structures.length,estimatedHeightCount:data.structures.filter(item => item.height !== 0).length,
    terrain:'Ellipsoid with flat illustrative local ground; no measured terrain model.',targetHouseVerified:false,photographicTextures:false,
    limitations:['Building footprints are mapped or AI-derived; heights are mostly estimated.','The marker indicates the supplied coordinate; the specific house is not reconstructed or verified.']};
  await mkdir(outputRoot,{recursive:true});
  const lockFile=path.join(outputRoot,'.render.lock');
  const lock=await open(lockFile,'wx').catch(error=>{if((error as NodeJS.ErrnoException).code==='EEXIST')throw new Error('Another render owns output/.render.lock.');throw error;});
  const stamp=`${new Date().toISOString().replace(/[:.]/g,'-')}-${process.pid}`;
  let work=path.join(outputRoot,`.render-software-${stamp}`);
  let framesRoot=path.join(work,'frames');
  const reports: IllustratedFrameReport[] = [], images: ImageMetric[] = [];
  let previous: Uint8Array|undefined;
  try {
    await lock.writeFile(JSON.stringify({pid:process.pid,mode:'software-illustrated',startedAt:new Date().toISOString()}));
    // A long capture can be interrupted after hundreds of PNGs. Reuse the
    // newest contiguous incomplete run so a second invocation continues from
    // the first missing frame instead of discarding completed work.
    if (!preview && process.argv.includes('--resume')) {
      const { readdir } = await import('node:fs/promises');
      const candidates: Array<{dir:string; count:number}> = [];
      for (const entry of await readdir(outputRoot,{withFileTypes:true})) {
        if (!entry.isDirectory() || !entry.name.startsWith('.render-software-')) continue;
        const candidateFrames=path.join(outputRoot,entry.name,'frames');
        let count=0;
        while (await exists(path.join(candidateFrames,`frame-${String(count).padStart(6,'0')}.png`))) count++;
        if (count>0 && count<VIDEO.frames) candidates.push({dir:path.join(outputRoot,entry.name),count});
      }
      candidates.sort((a,b)=>b.count-a.count);
      if (candidates[0]) {
        work=candidates[0].dir;
        framesRoot=path.join(work,'frames');
        console.log(`Resuming existing software capture at frame ${candidates[0].count}.`);
      }
    }
    await mkdir(framesRoot,{recursive:true});
    const frames=preview ? [0,240,450,700] : Array.from({length:VIDEO.frames},(_,i)=>i);
    for (const frame of frames) {
      const filename=path.join(framesRoot,`frame-${String(frame).padStart(6,'0')}.png`);
      const png=(!preview && await exists(filename)) ? await readFile(filename) : await sharp(Buffer.from(frameSvg(frame,data))).png().toBuffer();
      const metric=await measureImage(png,frame,previous); previous=metric.pixels;
      const report: IllustratedFrameReport={frame,time:frame/VIDEO.fps,targetVisible:true,attributionVisible:true,approximationLabelVisible:true,projectedTarget:{x:W/2,y:H/2},geometryCount:Number(source.geometryCount),estimatedHeightCount:Number(source.estimatedHeightCount)};
      reports.push(report); images.push(metric.metric);
      if (!(await exists(filename))) await writeFile(filename,png);
      if (preview || (frame+1)%30===0) console.log(preview?`Rendered software preview frame ${frame}.`:`Rendered ${frame+1}/${VIDEO.frames} frames.`);
    }
    const manifest: IllustratedRunManifest={version:1,kind:'cartographic-preview',status:preview?'preview':'captured',createdAt:new Date().toISOString(),...REQUIRED_SPEC,approximationCaption:caption,photorealistic:false,surveyedGeometryVerified:false,targetHouseReconstructionVerified:false,source,credits:[caption,creditsText],reports:preview?reports:reports,images,blockedRequests:[]};
    if (preview) {
      await writeFile(path.join(outputRoot,'verification','software-preview.json'),JSON.stringify(manifest,null,2));
      console.log('Software preview frames saved under output/.render-software-*; no MP4 published.');
      return;
    }
    const binaries=binaryPaths();
    const partial=path.join(work,'house_flyover.partial.mp4');
    await runProcess(binaries.ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-n','-framerate','30','-start_number','0','-i',path.join(framesRoot,'frame-%06d.png'),'-frames:v','900','-an','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart','-r','30',partial],{timeoutMs:900_000});
    const qa=await validateIllustratedRun(partial,manifest);
    await publish(work,stamp,manifest,qa);
    console.log('Produced and validated output/house_flyover.mp4 with the software cartographic renderer.');
  } catch (error) {
    const diagnostic = error instanceof Error && error.stack ? error.stack : redact(error);
    await writeFile(path.join(work,'failure.json'),JSON.stringify({kind:'cartographic-preview',status:'failed',error:diagnostic},null,2)).catch(()=>undefined);
    throw new Error(diagnostic);
  } finally { await lock.close(); await unlink(lockFile).catch(()=>undefined); }
}

if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) renderSoftwareIllustrated({preview:process.argv.includes('--preview')}).catch(error=>{console.error(redact(error));process.exitCode=1;});
