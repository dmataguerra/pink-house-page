import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TARGET } from '../src/config';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const query = `[out:json][timeout:60];(
way["building"](around:1400,${TARGET.latitude},${TARGET.longitude});
way["highway"](around:1400,${TARGET.latitude},${TARGET.longitude});
way["landuse"](around:1400,${TARGET.latitude},${TARGET.longitude});
way["leisure"](around:1400,${TARGET.latitude},${TARGET.longitude});
way["natural"](around:1400,${TARGET.latitude},${TARGET.longitude});
);out geom;`;
const response = await fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  headers: { 'User-Agent': 'JuriquillaHouseFlyover/0.1 (local geographic preview)', 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ data: query }),
  signal: AbortSignal.timeout(120000),
});
if (!response.ok) throw new Error(`OpenStreetMap data query returned ${response.status}.`);
const data = await response.json() as { elements: Array<{ id:number; tags?: Record<string,string>; geometry?: unknown[] }>; osm3s?: {timestamp_osm_base?:string} };
if (!Array.isArray(data.elements) || !data.elements.length) throw new Error('No usable local map data was returned.');
await mkdir(resolve(root, 'public/open-data'), { recursive: true });
await writeFile(resolve(root, 'public/open-data/osm.json'), JSON.stringify(data));
const summary = {
  source: 'OpenStreetMap', license: 'ODbL 1.0', attribution: '© OpenStreetMap contributors · openstreetmap.org/copyright',
  endpoint: 'https://overpass-api.de/api/interpreter', fetchedAt: new Date().toISOString(),
  dataDate: data.osm3s?.timestamp_osm_base, target: TARGET, queryRadiusMeters: 1400,
  elements: data.elements.length, buildings: data.elements.filter(e => e.tags?.building).length,
  roads: data.elements.filter(e => e.tags?.highway).length,
  measuredBuildingHeights: data.elements.filter(e => e.tags?.building && e.tags.height).length,
  limitations: ['Mapped building footprints only; missing outlines are not reconstructed.', 'Unmapped heights are explicitly estimated.', 'No photographic facade or roof textures are available in this source.', 'Correct target building identity is unverified; the supplied coordinate is marked.'],
};
await writeFile(resolve(root, 'public/open-data/source.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
