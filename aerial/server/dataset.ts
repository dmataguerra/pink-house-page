import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import { TARGET, type DatasetConfig } from '../src/config';

const nonempty = z.string().trim().min(3);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const datasetSchema = z.object({
  name: nonempty,
  provider: nonempty,
  tilesetUrl: nonempty,
  captureDate: date,
  provenance: z.enum(['surveyed-photogrammetry', 'licensed-textured-surface-mesh']),
  containsSurveyedBuildings: z.literal(true),
  hasPhotographicTextures: z.literal(true),
  targetEllipsoidHeight: z.number().finite().min(-500).max(9000),
  coverage: z.object({
    west: z.number().min(-180).max(180), south: z.number().min(-90).max(90),
    east: z.number().min(-180).max(180), north: z.number().min(-90).max(90),
  }),
  attribution: nonempty,
  license: z.object({
    standaloneVideoExport: z.literal(true),
    videoDistribution: z.literal(true),
    evidenceFile: nonempty,
    reference: nonempty,
    reviewedBy: nonempty,
    reviewedOn: date,
  }),
});

export function forbiddenSource(url: string): boolean {
  try {
    const host = new URL(url, 'http://127.0.0.1').hostname.toLowerCase();
    return /(^|\.)(google\.[a-z.]+|googleapis\.com|gstatic\.com|googleusercontent\.com|google\.cn|googleearth\.com)$/.test(host);
  } catch { return true; }
}

export function validateManifest(value: unknown) {
  if (value && typeof value === 'object') {
    const fields = value as Record<string, unknown>;
    if ([fields.name, fields.provider, fields.attribution].some(field => typeof field === 'string' && /REPLACE|placeholder/i.test(field))) {
      throw new Error('No licensed property data is configured. The dataset file is still the setup template.');
    }
  }
  const data = datasetSchema.parse(value);
  if (/REPLACE|example|placeholder/i.test([data.name, data.provider, data.attribution, data.license.reference].join(' '))) {
    throw new Error('Replace all example fields with verified survey and license information.');
  }
  if (forbiddenSource(data.tilesetUrl) || /google/i.test(data.provider)) {
    throw new Error('Google-derived data is not authorized for this standalone video.');
  }
  if (!data.tilesetUrl.startsWith('/data/') && !/^https:\/\//i.test(data.tilesetUrl)) {
    throw new Error('Use /data/tileset.json for local data or an HTTPS licensed tileset URL.');
  }
  // Full camera envelope plus neighborhood margin: approximately 900 m from the target.
  const latRadius = 900 / 111320;
  const lonRadius = latRadius / Math.cos(TARGET.latitude * Math.PI / 180);
  const c = data.coverage;
  if (c.west > TARGET.longitude - lonRadius || c.east < TARGET.longitude + lonRadius ||
      c.south > TARGET.latitude - latRadius || c.north < TARGET.latitude + latRadius) {
    throw new Error('Surveyed coverage must include the target and the 900 m camera/neighborhood envelope.');
  }
  if (c.west >= c.east || c.south >= c.north) throw new Error('Invalid survey coverage bounds.');
  return data;
}

export async function loadDataset(root: string, path = process.env.DATASET_MANIFEST): Promise<DatasetConfig> {
  if (!path) throw new Error('Licensed 3D data is required. Set DATASET_MANIFEST in aerial/.env.local.');
  const manifestPath = resolve(root, path);
  let raw: unknown;
  try { raw = JSON.parse(await readFile(manifestPath, 'utf8')); }
  catch { throw new Error('Dataset manifest is missing or is not valid JSON. See dataset.example.json.'); }
  const data = validateManifest(raw);
  let evidence: string;
  try { evidence = await readFile(resolve(dirname(manifestPath), data.license.evidenceFile), 'utf8'); }
  catch { throw new Error('License evidence file is missing; record the actual video export and distribution permission.'); }
  if (evidence.trim().length < 100 || /REPLACE|placeholder/i.test(evidence)) {
    throw new Error('License evidence must contain the actual grant of video rights, not an example.');
  }
  return {
    name: data.name, provider: data.provider, tilesetUrl: data.tilesetUrl,
    captureDate: data.captureDate, targetEllipsoidHeight: data.targetEllipsoidHeight,
    attribution: data.attribution, coverage: data.coverage,
    licenseEvidenceSha256: createHash('sha256').update(evidence).digest('hex'),
  };
}
