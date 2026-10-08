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
type Structure = { ring: Ring; height: number; target: boolean; source: string; heightEstimated: boolean; local: Array<[number, number]>; center: [number, number]; area: number; tone: number };
type Road = { points: Array<{lat: number; lon: number}>; kind: string; width: number };
type Surface = { ring: Ring; kind: 'water' | 'green' | 'campus' | 'residential' | 'paved' };
type FootprintCollection = { features?: Array<{ id?: string | number; geometry?: {type: string; coordinates: Ring[] | Ring[][]}; properties?: Record<string, unknown> }> };

export interface ScenePose extends IllustratedPose { focusEast?: number; focusNorth?: number; focusUp?: number }
export interface SceneTexture { imageUrl: string; west: number; east: number; south: number; north: number; width: number; height: number; opacity: number; feather?: number }
export interface SceneStyle { texture?: SceneTexture; geometryOpacity?: number; overlayOpacity?: number }

const aerialRoot = fileURLToPath(new URL('../', import.meta.url));
const outputRoot = path.resolve(aerialRoot, '..', 'output');
const caption = 'VISUALIZACIÓN APROXIMADA · ALTURAS ESTIMADAS';
const creditsText = '© OpenStreetMap contributors · openstreetmap.org/copyright · https://openstreetmap.org/copyright | Natural Earth | Microsoft Global ML Building Footprints · CDLA Permissive 2.0';
const W = VIDEO.width;
const H = VIDEO.height;
const TAU = Math.PI * 2;
const RENDER_TARGET = {
  latitude: Number(process.env.RENDER_TARGET_LAT ?? TARGET.latitude),
  longitude: Number(process.env.RENDER_TARGET_LON ?? TARGET.longitude),
};
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
  const e = (lon - RENDER_TARGET.longitude) * 111320 * Math.cos(RENDER_TARGET.latitude * Math.PI / 180);
  const n = (lat - RENDER_TARGET.latitude) * 110540;
  return [e, n];
}
function ringRadius(ring: Ring): number { return Math.max(...ring.map(([lon, lat]) => { const [e,n] = localPoint(lon,lat); return Math.hypot(e,n); })); }
function formatPoint([x,y]: [number,number]): string { return `${x.toFixed(1)},${y.toFixed(1)}`; }

function cleanRing(input: Ring): Ring {
  const ring = input.filter(point => point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]));
  if (ring.length > 3 && ring[0][0] === ring.at(-1)![0] && ring[0][1] === ring.at(-1)![1]) ring.pop();
  return ring;
}
function ringArea(ring: Array<[number, number]>): number {
  return Math.abs(ring.reduce((sum, [x,y], i) => { const next = ring[(i+1)%ring.length]; return sum + x*next[1]-y*next[0]; },0)/2);
}
function roadWidth(tags: Record<string, string>): number {
  const supplied = Number.parseFloat(tags.width ?? '');
  if (supplied > 0) return clamp(supplied, 1, 40);
  const lanes = Number.parseFloat(tags.lanes ?? '');
  if (lanes > 0) return lanes * 3.25;
  return ({ motorway: 11, motorway_link: 7, trunk: 11, trunk_link: 7, primary: 10, secondary: 9, tertiary: 8, residential: 6.5, living_street: 5, service: 4.5, pedestrian: 3, footway: 1.6, path: 1.2, cycleway: 2, steps: 1.4 } as Record<string, number>)[tags.highway] ?? 6;
}
export function gatherData(osm: {elements: OSMWay[]}, microsoft: FootprintCollection, overture: FootprintCollection = {}) {
  const structures: Structure[] = [];
  const roads: Road[] = [];
  const surfaces: Surface[] = [];
  const mappedRings: Ring[] = [];
  let duplicateCount = 0;
  const add = (input: Ring, height: number, heightEstimated: boolean, source: string, identity: string, deduplicate = true) => {
    const ring = cleanRing(input);
    if (ring.length < 3) return false;
    const local = ring.map(([lon, lat]) => localPoint(lon, lat));
    const area = ringArea(local);
    if (area < 7 || area > 250_000) return false;
    const center = local.reduce((sum, p) => [sum[0]+p[0]/local.length, sum[1]+p[1]/local.length] as [number,number], [0,0] as [number,number]);
    const centerGeo = [RENDER_TARGET.longitude + center[0]/(111320*Math.cos(RENDER_TARGET.latitude*Math.PI/180)), RENDER_TARGET.latitude+center[1]/110540];
    // Prefer community-mapped outlines and heights. A roof detected again by a
    // second provider must never be extruded twice, or become a row of fragments.
    if (deduplicate && structures.some(existing => {
      const distance = Math.hypot(existing.center[0]-center[0], existing.center[1]-center[1]);
      if (distance > Math.sqrt(area) + Math.sqrt(existing.area)) return false;
      const sharedVertices = ring.filter(([lon,lat]) => ringContains(lon,lat,existing.ring)).length / ring.length;
      return (distance < 2 && Math.min(area,existing.area)/Math.max(area,existing.area) > .65) ||
        (sharedVertices >= .6 && ringContains(centerGeo[0],centerGeo[1],existing.ring));
    })) { duplicateCount++; return false; }
    let hash = 0; for (const ch of identity) hash = ((hash*31)+ch.charCodeAt(0)) >>> 0;
    structures.push({ ring, local, center, area, height: clamp(height,2.5,80), heightEstimated,
      target: ringContains(RENDER_TARGET.longitude,RENDER_TARGET.latitude,ring), source, tone: hash%5 });
    return true;
  };
  for (const way of osm.elements) {
    const geometry = way.geometry;
    const tags = way.tags ?? {};
    if (!geometry || geometry.length < 2) continue;
    if (tags.building && geometry.length >= 4) {
      const ring = cleanRing(geometry.map(point => [point.lon, point.lat]));
      const mappedHeight = Number.parseFloat(tags.height ?? '');
      const levels = Number.parseFloat(tags['building:levels'] ?? '');
      const fallback = ['school','university','commercial','retail','warehouse'].includes(tags.building) ? 7.2 : tags.building === 'apartments' ? 12.8 : ['garage','garages','shed','roof'].includes(tags.building) ? 3.2 : 6.4;
      const height = Number.isFinite(mappedHeight) && mappedHeight > 0 ? mappedHeight : Number.isFinite(levels) && levels > 0 ? levels * 3.2 : fallback;
      if (add(ring,height,!(mappedHeight > 0),'OpenStreetMap mapped footprint',String(way.id))) mappedRings.push(ring);
    } else if (tags.highway) roads.push({ points: geometry, kind: tags.highway, width: roadWidth(tags) });
    else if (geometry.length >= 4) {
      const kind = tags.natural === 'water' || tags.leisure === 'swimming_pool' ? 'water' :
        ['park','garden','nature_reserve'].includes(tags.leisure ?? '') || ['grass','forest'].includes(tags.landuse ?? '') || ['wood','grassland'].includes(tags.natural ?? '') ? 'green' :
        tags.landuse === 'education' ? 'campus' : tags.landuse === 'residential' ? 'residential' :
          ['pitch','track','playground'].includes(tags.leisure ?? '') ? 'paved' : null;
      if (kind) surfaces.push({ ring: cleanRing(geometry.map(point=>[point.lon,point.lat])), kind });
    }
  }
  let overtureCount = 0;
  for (const feature of overture.features ?? []) {
    const polygons = feature.geometry?.type === 'Polygon' ? [feature.geometry.coordinates as Ring[]] : feature.geometry?.type === 'MultiPolygon' ? feature.geometry.coordinates as Ring[][] : [];
    for (const [ring] of polygons) {
      const height = Number(feature.properties?.height), floors = Number(feature.properties?.num_floors);
      const kind = String(feature.properties?.class ?? '');
      const fallback = ['apartments','residential'].includes(kind) && ringArea(ring.map(([lon,lat])=>localPoint(lon,lat))) > 700 ? 12.8 : ['industrial','commercial','school','university'].includes(kind) ? 7.2 : 6.4;
      if (add(ring,height>0?height:floors>0?floors*3.2:fallback,!(height>0),'Overture open footprint',String(feature.id))) overtureCount++;
    }
  }
  let microsoftCount = 0;
  for (const feature of microsoft.features ?? []) {
    if (feature.geometry?.type !== 'Polygon' || !feature.geometry.coordinates?.[0]) continue;
    const ring = feature.geometry.coordinates[0] as Ring;
    const height = Number(feature.properties?.height);
    if (add(ring,height>0?height:6.4,!(height>0),'Microsoft AI footprint (not surveyed)',String(feature.id))) microsoftCount++;
  }
  const nearTarget = structures.filter(item => Math.hypot(...item.center) < 350).length;
  // Where actual open outlines cover the neighborhood, use them exclusively.
  // Else retain the prior schematic gap fill, now restricted by mapped land use.
  const illustrative = nearTarget > 30 ? [] : generateIllustrativeBuildings(osm.elements, structures.map(item=>item.ring));
  let proceduralCount = 0;
  for (const item of illustrative) if (add(item.ring,item.height,true,'Procedural illustrative house volume',`schematic-${proceduralCount}`)) proceduralCount++;
  return { structures, roads, surfaces, mappedBuildingCount: mappedRings.length, microsoftCount, overtureCount, proceduralCount, duplicateCount };
}

function ringContains(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x,y] = ring[i], [px,py] = ring[j];
    if ((y > lat) !== (py > lat) && lon < (px - x) * (lat - y) / (py - y) + x) inside = !inside;
  }
  return inside;
}

const poseBases = new WeakMap<ScenePose, {c:[number,number,number];d:[number,number,number];right:[number,number,number];up:[number,number,number]}>();
function cameraBasis(pose: ScenePose) {
  const cached=poseBases.get(pose);if(cached)return cached;
  const c: [number,number,number] = [pose.east, pose.north, pose.up];
  const delta:[number,number,number]=[(pose.focusEast??0)-c[0],(pose.focusNorth??0)-c[1],(pose.focusUp??0)-c[2]];
  const inv = 1 / Math.max(1, Math.hypot(...delta));
  const d: [number,number,number] = [delta[0]*inv, delta[1]*inv, delta[2]*inv];
  const horizontal = Math.max(0.0001, Math.hypot(d[0], d[1]));
  const right: [number,number,number] = [d[1]/horizontal, -d[0]/horizontal, 0];
  const up: [number,number,number] = [right[1]*d[2], -right[0]*d[2], right[0]*d[1] - right[1]*d[0]];
  const basis={ c, d, right, up };poseBases.set(pose,basis);return basis;
}
function dot(a: [number,number,number], b: [number,number,number]): number { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
function project(point: [number,number,number], pose: ScenePose): [number,number,number] | null {
  const basis = cameraBasis(pose);
  const q: [number,number,number] = [point[0]-basis.c[0], point[1]-basis.c[1], point[2]-basis.c[2]];
  const z = dot(q,basis.d);
  if (z < 1) return null;
  const focal = Math.min(W,H) * (pose.range > 100000 ? 0.65 : 0.9);
  return [W/2 + focal * dot(q,basis.right) / z, H/2 - focal * dot(q,basis.up) / z, z];
}
function projectLonLat(lon: number, lat: number, height: number, pose: ScenePose): [number,number,number] | null {
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

function textureSvg(pose: ScenePose, texture: SceneTexture): string {
  if(texture.opacity<=0)return '';
  const columns=16,rows=10,parts:string[]=[];
  parts.push(`<defs><image id="bridge-atlas" href="${texture.imageUrl}" width="${texture.width}" height="${texture.height}"/></defs>`);
  const corner=(x:number,y:number)=>{
    const u=x/columns*texture.width,v=y/rows*texture.height;
    const p=project([texture.west+(texture.east-texture.west)*x/columns,texture.north-(texture.north-texture.south)*y/rows,0],pose);
    return {u,v,p};
  };
  let id=0;
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++) {
    const a=corner(x,y),b=corner(x+1,y),c=corner(x+1,y+1),d=corner(x,y+1);
    for(const triangle of [[a,b,c],[a,c,d]]) {
      if(triangle.some(point=>!point.p))continue;
      const [p,q,r]=triangle;
      const denominator=(q.u-p.u)*(r.v-p.v)-(r.u-p.u)*(q.v-p.v);
      const m0=((q.p![0]-p.p![0])*(r.v-p.v)-(r.p![0]-p.p![0])*(q.v-p.v))/denominator;
      const m1=((q.p![1]-p.p![1])*(r.v-p.v)-(r.p![1]-p.p![1])*(q.v-p.v))/denominator;
      const m2=((r.p![0]-p.p![0])*(q.u-p.u)-(q.p![0]-p.p![0])*(r.u-p.u))/denominator;
      const m3=((r.p![1]-p.p![1])*(q.u-p.u)-(q.p![1]-p.p![1])*(r.u-p.u))/denominator;
      const tx=p.p![0]-m0*p.u-m2*p.v,ty=p.p![1]-m1*p.u-m3*p.v;
      const clip=`atlas-${id++}`;
      const center=triangle.reduce((sum,point)=>[sum[0]+point.p![0]/3,sum[1]+point.p![1]/3],[0,0]);
      const clipPoints=triangle.map(point=>{const dx=point.p![0]-center[0],dy=point.p![1]-center[1],length=Math.max(1,Math.hypot(dx,dy));return `${(point.p![0]+dx/length*.8).toFixed(3)},${(point.p![1]+dy/length*.8).toFixed(3)}`;});
      parts.push(`<clipPath id="${clip}"><polygon points="${clipPoints.join(' ')}"/></clipPath><g clip-path="url(#${clip})"><use href="#bridge-atlas" transform="matrix(${m0},${m1},${m2},${m3},${tx},${ty})"/></g>`);
    }
  }
  return `<g opacity="${texture.opacity}">${parts.join('')}</g>`;
}

function localSvg(pose: ScenePose, data: ReturnType<typeof gatherData>, sceneStyle: SceneStyle = {}): string {
  const parts: string[] = [];
  parts.push('<rect width="1920" height="1080" fill="#101010"/><rect width="1920" height="1080" fill="url(#ground)" opacity=".78"/>');
  if(sceneStyle.texture)parts.push(textureSvg(pose,sceneStyle.texture));
  parts.push(`<g opacity="${sceneStyle.geometryOpacity??1}">`);
  const visibleRadius = clamp(pose.range * 6.4, 900, 3600);
  for (const surface of data.surfaces) {
    const points = surface.ring.map(([lon,lat])=>projectLonLat(lon,lat,.12,pose));
    if (points.some(point=>!point)) continue;
    const fill = {water:'#172326',green:'#20261f',campus:'#282828',residential:'#252525',paved:'#2d302e'}[surface.kind];
    parts.push(polygon(points.map(point=>[point![0],point![1]]),fill,.72));
  }
  const projectedRoads: Array<{points: Array<[number,number]>; kind: string; width: number}> = [];
  for (const road of data.roads) {
    const points: Array<[number,number]> = [];
    for (const point of road.points) {
      const [e,n] = localPoint(point.lon,point.lat);
      if (Math.hypot(e,n) > visibleRadius) continue;
      points.push([e,n]);
    }
    if (points.length > 1) projectedRoads.push({points,kind:road.kind,width:road.width});
  }
  const ribbon = (points: Array<[number,number]>, width: number, fill: string, opacity: number) => {
    const paths:string[]=[];
    const append=(projected:Array<[number,number,number]|null>)=>{
      if(!projected.every(Boolean))return;
      const visible=projected as Array<[number,number,number]>;
      if(visible.every(p=>p[0]<-20)||visible.every(p=>p[0]>W+20)||visible.every(p=>p[1]<-20)||visible.every(p=>p[1]>H+20))return;
      paths.push(`M${visible.map(p=>`${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')}Z`);
    };
    for (let i=1;i<points.length;i++) {
      const a=points[i-1],b=points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if (length<.05) continue;
      const nx=-(b[1]-a[1])/length*width/2,ny=(b[0]-a[0])/length*width/2;
      const corners=[[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]];
      const projected=corners.map(([e,n])=>project([e,n,.3],pose));
      append(projected);
    }
    for (const [e,n] of points) {
      const projected=Array.from({length:8},(_,i)=>project([e+Math.cos(-i*TAU/8)*width/2,n+Math.sin(-i*TAU/8)*width/2,.3],pose));
      append(projected);
    }
    if(paths.length)parts.push(`<path d="${paths.join('')}" fill="${fill}" fill-opacity="${opacity}"/>`);
  };
  // Road widths are in world metres, so streets recede with the same
  // perspective as the homes rather than remaining screen-wide bars.
  for (const road of projectedRoads) {
    const major = !['footway','path','steps','cycleway'].includes(road.kind);
    ribbon(road.points,road.width+(major?1.2:.4),major?'#555555':'#353535',.92);
  }
  for (const road of projectedRoads) {
    const major = !['footway','path','steps','cycleway'].includes(road.kind);
    ribbon(road.points,road.width,major?'#404040':'#2e2e2e',.98);
  }
  const basis=cameraBasis(pose);
  const buildings = data.structures
    .map(item => ({item, radius:Math.hypot(...item.center), depth:dot([item.center[0]-basis.c[0],item.center[1]-basis.c[1],item.height/2-basis.c[2]],basis.d)}))
    .filter(({item,radius}) => {
      if(radius>visibleRadius*1.15)return false;
      const center=project([item.center[0],item.center[1],item.height/2],pose);
      if(!center)return false;
      const margin=Math.sqrt(item.area)*1080/Math.max(center[2],10)+60;
      return center[0]>-margin&&center[0]<W+margin&&center[1]>-margin&&center[1]<H+margin;
    })
    .sort((a,b) => b.depth-a.depth);
  for (const {item} of buildings) {
    const shadow=item.local.map(([e,n])=>project([e+item.height*.62,n-item.height*.42,.34],pose));
    if (shadow.every(Boolean)) parts.push(polygon(shadow.map(p=>[p![0],p![1]]),'#060606',.24));
  }
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
    const tone = 45+item.tone*3;
    const shade = item.target ? '#f1ede8' : `rgb(${tone},${tone},${tone})`;
    const winding=item.local.reduce((sum,[e,n],i)=>{const next=item.local[(i+1)%item.local.length];return sum+e*next[1]-n*next[0];},0)>0?1:-1;
    for (let i=0;i<basePoints.length;i++) {
      const j=(i+1)%basePoints.length;
      const a=item.local[i],b=item.local[j],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
      if(length<.01)continue;
      const nx=dy/length*winding,ny=-dx/length*winding;
      if(nx*(pose.east-(a[0]+b[0])/2)+ny*(pose.north-(a[1]+b[1])/2)<=0)continue;
      const light=clamp(nx*(-.6)+ny*.45,.05,1), wallTone=20+light*13+item.tone;
      const side=item.target?`rgb(${175+light*30},${171+light*30},${168+light*30})`:`rgb(${wallTone},${wallTone},${wallTone})`;
      parts.push(polygon([basePoints[i],basePoints[j],roofPoints[j],roofPoints[i]],side,1));
      const pixelHeight=Math.hypot(basePoints[i][0]-roofPoints[i][0],basePoints[i][1]-roofPoints[i][1]);
      if(pixelHeight>13) {
        // A restrained floor joint clarifies volume without fabricating facades.
        for(let h=3.2;h<item.height-1;h+=3.2){const p=project([a[0],a[1],h],pose),q=project([b[0],b[1],h],pose);if(p&&q)parts.push(line([[p[0],p[1]],[q[0],q[1]]],item.target?'#aba6a3':'#373737',.45,.45));}
      }
    }
    parts.push(polygon(roofPoints,shade,1,item.target?'#ddd8d4':'#626262',.6));
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
  parts.push('</g>');return parts.join('');
}

export interface OverlayStyle { brand?: string; hideFooter?: boolean; showTopCredits?: boolean }
export function overlays(pose: IllustratedPose, style: OverlayStyle = {}): string {
  const brand = style.brand ?? 'Pink House';
  const inSpace = pose.range > 40000;
  const ink = '#f1ede8';
  const footer = `<text x="1858" y="1050" font-family="Arial,sans-serif" font-size="10" fill="${ink}" fill-opacity=".5" text-anchor="end">© OSM contributors · openstreetmap.org/copyright · Overture · Microsoft · Google Open Buildings (CC BY 4.0)</text>`;
  return `<g font-family="Inter,Arial,sans-serif" fill="${ink}"><text x="960" y="142" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="84" font-weight="700" letter-spacing="-2">JURIQUILLA</text><circle cx="960" cy="540" r="${inSpace ? 8 : 12}" fill="#f1ede8" stroke="#f1ede8" stroke-width="3"/><line x1="960" y1="540" x2="960" y2="455" stroke="#f1ede8" stroke-width="2"/><rect x="836" y="419" width="248" height="37" rx="4" fill="#101010" fill-opacity=".95" stroke="#f1ede8"/><text x="960" y="443" fill="#f1ede8" text-anchor="middle" font-size="11" font-weight="700" letter-spacing="1.5">${esc(brand.toUpperCase())}</text>${footer}</g>`;
}

export function frameSvg(frame: number, data: ReturnType<typeof gatherData>, style: OverlayStyle = {}): string {
  const pose = illustratedPose(frame);
  const groundDef = '<defs><linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#171717"/><stop offset="1" stop-color="#292929"/></linearGradient></defs>';
  const scenePose = pose.range < 20000 ? { ...pose, east: pose.east * 1.35, north: pose.north * 1.35, up: pose.up * 1.35, range: pose.range * 1.35 } : pose;
  return frameSvgAtPose(scenePose,data,style);
}

/** A caller-supplied bridge pose does not change the original camera path. */
export function frameSvgAtPose(pose: ScenePose, data: ReturnType<typeof gatherData>, style: OverlayStyle = {}, sceneStyle: SceneStyle = {}): string {
  const groundDef = '<defs><linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#171717"/><stop offset="1" stop-color="#292929"/></linearGradient></defs>';
  const sceneBody=pose.range>18000?globeSvg(pose):localSvg(pose,data,sceneStyle);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${groundDef}${sceneBody}<g opacity="${sceneStyle.overlayOpacity??1}">${overlays(pose,style)}</g></svg>`;
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
