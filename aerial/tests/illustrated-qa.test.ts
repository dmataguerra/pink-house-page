import test from 'node:test';
import assert from 'node:assert/strict';
import { REQUIRED_SPEC, validateIllustratedMetadata, type IllustratedRunManifest } from '../scripts/qa';

function fixture(): IllustratedRunManifest {
  return {
    ...REQUIRED_SPEC, version: 1, kind: 'cartographic-preview', status: 'captured', createdAt: '2026-10-08T00:00:00Z',
    approximationCaption: 'VISUALIZACIÓN APROXIMADA · ALTURAS ESTIMADAS',
    photorealistic: false, surveyedGeometryVerified: false, targetHouseReconstructionVerified: false,
    source: { kind: 'cartographic-preview', geometryCount: 144, estimatedHeightCount: 143, openStreetMap: { license: 'ODbL 1.0' } },
    credits: ['VISUALIZACIÓN APROXIMADA · ALTURAS ESTIMADAS', '© OpenStreetMap contributors · openstreetmap.org/copyright'],
    reports: Array.from({ length: 900 }, (_, frame) => ({ frame, time: frame / 30, geometryCount: 144, estimatedHeightCount: 143, targetVisible: true, attributionVisible: true, approximationLabelVisible: true, projectedTarget: { x: 960, y: 540 } })),
    images: [], blockedRequests: [],
  };
}

test('illustrated QA accepts correctly labeled complete metadata without a survey assertion', () => {
  const manifest = fixture();
  validateIllustratedMetadata(manifest);
  assert.equal('geometry' in manifest, false);
  assert.equal(manifest.surveyedGeometryVerified, false);
});

test('illustrated QA accepts the licensed Open Buildings vectors but rejects Maps imagery', () => {
  const manifest=fixture();
  manifest.source.overture={datasets:['Google Open Buildings','Microsoft ML Buildings'],license:'ODbL-1.0'};
  validateIllustratedMetadata(manifest);
  manifest.source.imagery='Google Maps 3D Tiles';
  assert.throws(()=>validateIllustratedMetadata(manifest));
});

test('illustrated QA rejects photographic survey claims, hidden labels, and external requests', () => {
  for (const mutate of [
    (manifest: IllustratedRunManifest) => { (manifest as unknown as { photorealistic: boolean }).photorealistic = true; },
    (manifest: IllustratedRunManifest) => { (manifest as unknown as { surveyedGeometryVerified: boolean }).surveyedGeometryVerified = true; },
    (manifest: IllustratedRunManifest) => { manifest.reports[500].approximationLabelVisible = false; },
    (manifest: IllustratedRunManifest) => { manifest.reports[500].attributionVisible = false; },
    (manifest: IllustratedRunManifest) => { manifest.blockedRequests.push('tile.googleapis.com'); },
    (manifest: IllustratedRunManifest) => { manifest.approximationCaption = ''; },
  ]) {
    const manifest = fixture(); mutate(manifest);
    assert.throws(() => validateIllustratedMetadata(manifest));
  }
});

test('illustrated QA requires all frames, correct coordinate projection, and honest height counts', () => {
  for (const mutate of [
    (manifest: IllustratedRunManifest) => { manifest.reports.pop(); },
    (manifest: IllustratedRunManifest) => { manifest.reports[800].time = 0; },
    (manifest: IllustratedRunManifest) => { manifest.reports[800].projectedTarget.x = -10; },
    (manifest: IllustratedRunManifest) => { manifest.reports[800].geometryCount = 0; },
    (manifest: IllustratedRunManifest) => { manifest.reports[800].estimatedHeightCount = 144; },
    (manifest: IllustratedRunManifest) => { manifest.source.kind = 'survey'; },
    (manifest: IllustratedRunManifest) => { manifest.credits = ['OpenStreetMap']; },
    (manifest: IllustratedRunManifest) => { manifest.status = 'preview'; },
  ]) {
    const manifest = fixture(); mutate(manifest);
    assert.throws(() => validateIllustratedMetadata(manifest));
  }
});
