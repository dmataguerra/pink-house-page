import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';
import { TARGET } from '../src/config';

// The published catalog is pinned for reproducibility. Raw imagery is never downloaded.
const CATALOG = 'https://bfppub.blob.core.windows.net/%24web/2026-08-13/dataset-links.csv';
const REPOSITORY = 'https://github.com/microsoft/GlobalMLBuildingFootprints';
const LICENSE_URL = 'https://cdla.dev/permissive-2-0/';
const LICENSE_TEXT_URL = 'https://raw.githubusercontent.com/Community-Data-License-Agreements/Releases/main/CDLA-Permissive-2.0.txt';
const RADIUS = 1400;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
type Position = [number, number];
interface Feature {
  type: 'Feature';
  id?: string | number;
  properties: Record<string, unknown>;
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: Position[][] | Position[][][] };
}

function quadkey(lon: number, lat: number, zoom = 9): string {
  const n = 2 ** zoom;
  const latitude = lat * Math.PI / 180;
  const x = Math.floor((lon + 180) / 360 * n);
  const y = Math.floor((1 - Math.log(Math.tan(latitude) + 1 / Math.cos(latitude)) / Math.PI) / 2 * n);
  let key = '';
  for (let level = zoom; level > 0; level--) {
    const mask = 1 << (level - 1);
    key += ((x & mask) ? 1 : 0) + ((y & mask) ? 2 : 0);
  }
  return key;
}

function csvRow(row: string): string[] {
  const values: string[] = [];
  let value = '', quoted = false;
  for (let i = 0; i < row.length; i++) {
    if (row[i] === '"') {
      if (quoted && row[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (row[i] === ',' && !quoted) { values.push(value); value = ''; }
    else value += row[i];
  }
  values.push(value);
  return values;
}

function polygons(feature: Feature): Position[][][] {
  return feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates as Position[][]]
    : feature.geometry.coordinates as Position[][][];
}

function ringContains(ring: Position[], point: Position): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x, y] = ring[i], [previousX, previousY] = ring[j];
    if ((y > point[1]) !== (previousY > point[1]) &&
      point[0] < (previousX - x) * (point[1] - y) / (previousY - y) + x) inside = !inside;
  }
  return inside;
}

function containsTarget(feature: Feature): boolean {
  const point: Position = [TARGET.longitude, TARGET.latitude];
  return polygons(feature).some(([outer, ...holes]) => ringContains(outer, point) && !holes.some((hole) => ringContains(hole, point)));
}

function nearestDistance(feature: Feature): number {
  const scaleX = 111320 * Math.cos(TARGET.latitude * Math.PI / 180);
  let closest = Infinity;
  for (const polygon of polygons(feature)) for (const ring of polygon) {
    for (let i = 0; i < ring.length - 1; i++) {
      const x = (ring[i][0] - TARGET.longitude) * scaleX;
      const y = (ring[i][1] - TARGET.latitude) * 111320;
      const dx = (ring[i + 1][0] - ring[i][0]) * scaleX;
      const dy = (ring[i + 1][1] - ring[i][1]) * 111320;
      const denominator = dx * dx + dy * dy;
      const t = denominator ? Math.max(0, Math.min(1, -(x * dx + y * dy) / denominator)) : 0;
      closest = Math.min(closest, Math.hypot(x + t * dx, y + t * dy));
    }
  }
  return closest;
}

async function get(url: string, timeout = 180000): Promise<Response> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeout), headers: { 'User-Agent': 'open-house-flyover/1.0' } });
  if (!response.ok) throw new Error(`Open dataset request failed with HTTP ${response.status}.`);
  return response;
}

async function main() {
  const latRadius = RADIUS / 111320;
  const lonRadius = latRadius / Math.cos(TARGET.latitude * Math.PI / 180);
  const bounds = {
    west: TARGET.longitude - lonRadius, south: TARGET.latitude - latRadius,
    east: TARGET.longitude + lonRadius, north: TARGET.latitude + latRadius,
  };
  const keys = new Set<string>();
  for (const lon of [bounds.west, bounds.east]) for (const lat of [bounds.south, bounds.north]) keys.add(quadkey(lon, lat));
  console.log(`Fetching Microsoft open footprint catalog for Mexico, quadkeys ${[...keys].join(', ')}.`);
  const catalog = await (await get(CATALOG)).text();
  const lines = catalog.trim().split(/\r?\n/);
  const header = csvRow(lines.shift()!.replace(/^\uFEFF/, ''));
  const rows = lines.map(csvRow).map((row) => Object.fromEntries(header.map((name, i) => [name, row[i]])));
  const tiles = rows.filter((row) => row.Location === 'Mexico' && keys.has(row.QuadKey));
  if (!tiles.length) throw new Error('No Mexico tiles found for the target in the pinned Microsoft catalog.');
  const licenseText = await (await get(LICENSE_TEXT_URL)).text();
  const output = resolve(root, 'public/open-data');
  await mkdir(output, { recursive: true });
  const features: Feature[] = [];
  const downloads: Array<Record<string, unknown>> = [];
  for (const tile of tiles) {
    const catalogUrl = new URL(tile.Url);
    const host = catalogUrl.hostname;
    const publishedHosts = ['bfppub.blob.core.windows.net', 'bfppub.z5.web.core.windows.net', 'minedbuildings.z5.web.core.windows.net', 'minedbuildings.blob.core.windows.net'];
    if (!publishedHosts.includes(host)) throw new Error(`Unexpected footprint host in catalog: ${host}.`);
    // The Azure static-site and blob endpoints expose the same public $web object.
    // The blob endpoint avoids the severe static-site throttling observed in this run.
    const downloadUrl = host === 'bfppub.z5.web.core.windows.net'
      ? `https://bfppub.blob.core.windows.net/%24web${catalogUrl.pathname}`
      : tile.Url;
    console.log(`Streaming footprint tile ${tile.QuadKey} (${tile.Size || 'published gzip'}).`);
    const response = await get(downloadUrl, 900000);
    if (!response.body) throw new Error('Footprint download has no response body.');
    const compressed = Readable.fromWeb(response.body as never);
    const hash = createHash('sha256');
    let bytes = 0, records = 0;
    compressed.on('data', (chunk: Buffer) => { hash.update(chunk); bytes += chunk.length; });
    const uncompressed = compressed.pipe(createGunzip());
    const reader = createInterface({ input: uncompressed, crlfDelay: Infinity });
    let streamError: Error | undefined;
    const stopReading = (error: Error) => {
      streamError = error;
      reader.close();
      compressed.destroy();
      uncompressed.destroy();
    };
    compressed.on('error', stopReading);
    uncompressed.on('error', stopReading);
    for await (const line of reader) {
      if (!line.trim()) continue;
      records++;
      if (records % 25000 === 0) console.log(`Read ${records} source outlines; retained ${features.length}; received ${(bytes / 1024 / 1024).toFixed(1)} MB.`);
      const feature = JSON.parse(line) as Feature;
      if (feature.type !== 'Feature' || !['Polygon', 'MultiPolygon'].includes(feature.geometry?.type)) continue;
      const coordinates = polygons(feature).flat(2);
      const west = Math.min(...coordinates.map((point) => point[0]));
      const east = Math.max(...coordinates.map((point) => point[0]));
      const south = Math.min(...coordinates.map((point) => point[1]));
      const north = Math.max(...coordinates.map((point) => point[1]));
      if (west > bounds.east || east < bounds.west || south > bounds.north || north < bounds.south) continue;
      // Retain entire intersecting outlines rather than cutting their edges into artificial roofs.
      feature.id = feature.id ?? `microsoft-${tile.QuadKey}-${records}`;
      feature.properties = {
        ...(feature.properties || {}),
        footprintSource: 'Microsoft Global ML Building Footprints',
        footprintMethod: 'AI detected from imagery; not surveyed',
        heightMethod: Number(feature.properties?.height) > 0 ? 'AI estimate, not measured' : 'No supplied height',
      };
      features.push(feature);
      if (features.length === 1 || features.length % 100 === 0) {
        await writeFile(resolve(output, 'microsoft-buildings.geojson'), JSON.stringify({ type: 'FeatureCollection', features }));
        await writeFile(resolve(output, 'source-microsoft.json'), JSON.stringify({
          source: 'Microsoft Global ML Building Footprints', license: 'CDLA Permissive 2.0', licenseUrl: LICENSE_URL,
          licenseText, licenseTextSource: LICENSE_TEXT_URL, repository: REPOSITORY, catalog: CATALOG,
          attribution: 'Microsoft Global ML Building Footprints · CDLA Permissive 2.0',
          target: TARGET, queryRadiusMeters: RADIUS, subsetBounds: bounds, buildings: features.length,
          fetchedAt: new Date().toISOString(), downloadComplete: false,
          limitations: ['Download in progress: this is a partial footprint subset.', 'AI footprint detections and estimated heights; no surveyed roofs or photographic textures.', 'Target house identity remains unverified.'],
        }, null, 2));
      }
    }
    if (streamError) throw streamError;
    downloads.push({ quadkey: tile.QuadKey, url: downloadUrl, catalogUrl: tile.Url, catalogSize: tile.Size, bytes, records, sha256: hash.digest('hex') });
  }
  if (!features.length) throw new Error('Downloaded tiles contain no footprints intersecting the target area.');
  const containing = features.filter(containsTarget);
  const nearest = features.map((feature) => ({ id: feature.id, distanceMeters: Math.round(nearestDistance(feature) * 10) / 10, containsTarget: containsTarget(feature), properties: feature.properties }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 5);
  const collection = JSON.stringify({ type: 'FeatureCollection', name: 'Microsoft AI footprint subset near requested coordinates', features });
  const source = {
    source: 'Microsoft Global ML Building Footprints', license: 'CDLA Permissive 2.0',
    licenseUrl: LICENSE_URL, licenseText, licenseTextSource: LICENSE_TEXT_URL,
    attribution: 'Microsoft Global ML Building Footprints · CDLA Permissive 2.0',
    repository: REPOSITORY, catalog: CATALOG, catalogSha256: createHash('sha256').update(catalog).digest('hex'),
    fetchedAt: new Date().toISOString(), downloadComplete: true, target: TARGET, queryRadiusMeters: RADIUS, subsetBounds: bounds,
    extraction: 'Full source footprint geometries whose bounds intersect the 1400 m target bounding envelope; no invented outlines.',
    downloads, buildings: features.length,
    suppliedAiHeightEstimates: features.filter((feature) => Number(feature.properties.height) > 0).length,
    targetContainingFootprints: containing.map((feature) => feature.id), nearestFootprints: nearest,
    subsetSha256: createHash('sha256').update(collection).digest('hex'),
    limitations: [
      'Footprints are AI detections, not field surveys; target identity is unverified even if a polygon contains the coordinate.',
      'No photographs, facade textures, roof slopes, vegetation meshes or terrain heights are supplied.',
      'Any supplied height is a model estimate. Missing heights must be labeled as visualization assumptions.',
      'Source imagery dates vary; the catalog publication date is not a target-area capture date.',
    ],
  };
  await writeFile(resolve(output, 'microsoft-buildings.geojson'), collection);
  await writeFile(resolve(output, 'source-microsoft.json'), JSON.stringify(source, null, 2));
  console.log(JSON.stringify({ buildings: source.buildings, suppliedAiHeightEstimates: source.suppliedAiHeightEstimates, targetContainingFootprints: source.targetContainingFootprints, nearest }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
