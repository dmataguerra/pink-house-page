import { TARGET } from './config';

export interface IllustrativeRoadWay {
  id?: number | string;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
}

/** Every generated outline and height is a visualization assumption. */
export interface IllustrativeBuilding {
  /** Closed longitude/latitude ring, in degrees. */
  ring: number[][];
  height: number;
  /** Symbolic property marker, never a verified building reconstruction. */
  target: boolean;
}

type Point = { x: number; y: number };
type Ring = readonly (readonly number[])[];
const LAT_METRES = 111_320;
const LON_METRES = LAT_METRES * Math.cos(TARGET.latitude * Math.PI / 180);
const RADIUS = 400;
const MAX_BUILDINGS = 500;
const ROAD_OFFSET = 12;
const SPACING = 13;
const JUNCTION_CLEARANCE = 18;

function local(lon: number, lat: number): Point {
  return { x: (lon - TARGET.longitude) * LON_METRES, y: (lat - TARGET.latitude) * LAT_METRES };
}

function distanceSquared(a: Point, b: Point): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

function segmentDistance(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared)) : 0;
  return Math.sqrt(distanceSquared(point, { x: a.x + t * dx, y: a.y + t * dy }));
}

function inside(point: Point, ring: readonly Point[]): boolean {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if (segmentDistance(point, a, b) < 0.01) return true;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) result = !result;
  }
  return result;
}

function rectangle(center: Point, direction: Point, frontage: number, depth: number): Point[] {
  const normal = { x: -direction.y, y: direction.x };
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([along, across]) => ({
    x: center.x + direction.x * along * frontage / 2 + normal.x * across * depth / 2,
    y: center.y + direction.y * along * frontage / 2 + normal.y * across * depth / 2,
  }));
  return [...corners, { ...corners[0] }];
}

function geographic(ring: readonly Point[]): number[][] {
  return ring.map(point => [TARGET.longitude + point.x / LON_METRES, TARGET.latitude + point.y / LAT_METRES]);
}

function hash(value: string): number {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) result = Math.imul(result ^ value.charCodeAt(i), 16777619);
  return result >>> 0;
}

/**
 * Populate a deliberately approximate map-style neighborhood from actual OSM
 * residential/living_street/service road alignments. These small rectangles
 * are invented scenery, not mapped footprints or accurate property models.
 * Existing footprint input is read-only; no geographic requests are performed.
 */
export function generateIllustrativeBuildings(
  osmWays: readonly IllustrativeRoadWay[],
  existingFootprints: readonly Ring[],
): IllustrativeBuilding[] {
  const origin = { x: 0, y: 0 };
  const footprints = existingFootprints.map(ring => ring
    .filter(point => point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]))
    .map(point => local(point[0], point[1])))
    .filter(ring => ring.length >= 3)
    .map(ring => ({ ring, west: Math.min(...ring.map(p => p.x)), east: Math.max(...ring.map(p => p.x)),
      south: Math.min(...ring.map(p => p.y)), north: Math.max(...ring.map(p => p.y)) }));
  const roads = osmWays.filter(way => ['residential', 'living_street', 'service'].includes(way.tags?.highway ?? '') && (way.geometry?.length ?? 0) >= 2)
    .map(way => ({ id: String(way.id ?? ''), points: way.geometry!
      .filter(point => Number.isFinite(point.lon) && Number.isFinite(point.lat))
      .map(point => local(point.lon, point.lat)) }))
    .filter(road => road.points.length >= 2);

  // Shared vertices identify junctions. Road endpoints are also left clear to
  // avoid putting decorative houses in cul-de-sacs or at interrupted geometry.
  const vertexCounts = new Map<string, { point: Point; count: number }>();
  const junctions: Point[] = [];
  for (const road of roads) {
    junctions.push(road.points[0], road.points[road.points.length - 1]);
    const visited = new Set<string>();
    for (const point of road.points) {
      const key = `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
      if (visited.has(key)) continue;
      visited.add(key);
      const entry = vertexCounts.get(key);
      if (entry) entry.count++;
      else vertexCounts.set(key, { point, count: 1 });
    }
  }
  for (const entry of vertexCounts.values()) if (entry.count > 1) junctions.push(entry.point);

  const candidates: { center: Point; direction: Point; key: string; radiusSquared: number }[] = [];
  let targetDirection = { x: 1, y: 0 }, nearestRoad = Infinity;
  for (const road of roads) {
    let accumulated = 0;
    for (let segment = 1; segment < road.points.length; segment++) {
      const a = road.points[segment - 1], b = road.points[segment];
      const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
      if (length < 0.01) continue;
      const direction = { x: dx / length, y: dy / length };
      const proximity = segmentDistance(origin, a, b);
      if (proximity < nearestRoad) { nearestRoad = proximity; targetDirection = direction; }
      if (proximity <= RADIUS) {
        const projected = -a.x * direction.x - a.y * direction.y;
        const perpendicularSquared = Math.max(0, a.x * a.x + a.y * a.y - projected * projected);
        const halfSpan = Math.sqrt(Math.max(0, RADIUS * RADIUS - perpendicularSquared));
        const from = Math.max(0, projected - halfSpan), to = Math.min(length, projected + halfSpan);
        const firstSlot = Math.ceil((accumulated + from - SPACING / 2) / SPACING);
        const lastSlot = Math.floor((accumulated + to - SPACING / 2) / SPACING);
        for (let slot = firstSlot; slot <= lastSlot; slot++) {
          const along = slot * SPACING + SPACING / 2 - accumulated;
          for (const side of [-1, 1]) {
            const center = { x: a.x + direction.x * along - direction.y * ROAD_OFFSET * side,
              y: a.y + direction.y * along + direction.x * ROAD_OFFSET * side };
            const radiusSquared = center.x * center.x + center.y * center.y;
            if (radiusSquared <= RADIUS * RADIUS) candidates.push({ center, direction, radiusSquared,
              key: `${road.id}:${segment}:${slot}:${side}` });
          }
        }
      }
      accumulated += length;
    }
  }
  candidates.sort((a, b) => a.radiusSquared - b.radiusSquared || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const result: IllustrativeBuilding[] = [];
  const generatedCenters: Point[] = [];
  if (!footprints.some(footprint => inside(origin, footprint.ring))) {
    result.push({ ring: geographic(rectangle(origin, targetDirection, 10, 15)), height: 6.4, target: true });
    generatedCenters.push(origin);
  }
  for (const candidate of candidates) {
    if (result.length >= MAX_BUILDINGS) break;
    const center = candidate.center;
    if (junctions.some(point => distanceSquared(center, point) < JUNCTION_CLEARANCE ** 2)) continue;
    if (generatedCenters.some(point => distanceSquared(center, point) < 10 ** 2)) continue;
    // An 8×12 m rectangle fits inside a circle of radius 7.22 m. Keeping its
    // center at least 8 m from any existing boundary prevents footprint overlap.
    const conflicts = footprints.some(footprint => {
      if (center.x < footprint.west - 8 || center.x > footprint.east + 8 ||
          center.y < footprint.south - 8 || center.y > footprint.north + 8) return false;
      if (inside(center, footprint.ring)) return true;
      return footprint.ring.some((point, index) => segmentDistance(center, point, footprint.ring[(index + 1) % footprint.ring.length]) < 8);
    });
    if (conflicts) continue;
    result.push({ ring: geographic(rectangle(center, candidate.direction, 8, 12)),
      height: hash(candidate.key) % 3 === 0 ? 9.6 : 6.4, target: false });
    generatedCenters.push(center);
  }
  return result;
}
