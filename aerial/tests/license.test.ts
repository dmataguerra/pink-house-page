import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { forbiddenSource, loadDataset, validateManifest } from '../server/dataset';

function valid() { return {
  name: 'Juriquilla survey', provider: 'Survey owner', tilesetUrl: '/data/tileset.json',
  captureDate: '2026-10-07', provenance: 'surveyed-photogrammetry',
  containsSurveyedBuildings: true, hasPhotographicTextures: true, targetEllipsoidHeight: 1900,
  coverage: { west: -100.46, south: 20.69, east: -100.43, north: 20.73 },
  attribution: '© Survey owner 2026',
  license: { standaloneVideoExport: true, videoDistribution: true, evidenceFile: './license.txt', reference: 'Owned survey, section 4', reviewedBy: 'Dataset owner', reviewedOn: '2026-10-07' },
}; }
test('missing data stops before any tiles are opened', async () => {
  await assert.rejects(loadDataset('.', ''), /Licensed 3D data is required/);
});
test('separate video and distribution grants are mandatory', () => {
  for (const field of ['standaloneVideoExport', 'videoDistribution'] as const) {
    const value = valid(); value.license[field] = false;
    assert.throws(() => validateManifest(value));
  }
});
test('Google sources, disguised subdomains, terrain and incomplete coverage are rejected', () => {
  for (const host of ['tile.googleapis.com', 'earth.google.com', 'khms.googleusercontent.com', 'foo.gstatic.com', 'google.cn']) {
    assert.equal(forbiddenSource(`https://${host}/tileset.json`), true);
  }
  assert.equal(forbiddenSource('https://survey.example.org/tileset.json'), false);
  assert.throws(() => validateManifest({ ...valid(), tilesetUrl: 'https://tile.googleapis.com/root.json' }), /Google-derived/);
  assert.throws(() => validateManifest({ ...valid(), hasPhotographicTextures: false }));
  assert.throws(() => validateManifest({ ...valid(), containsSurveyedBuildings: false }));
  assert.throws(() => validateManifest({ ...valid(), coverage: { west: -100.445, east: -100.444, south: 20.707, north: 20.708 } }), /coverage/);
});
test('evidence is required and hashed without sending its content to the browser', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'flyover-license-'));
  try {
    await writeFile(join(dir, 'dataset.json'), JSON.stringify(valid()));
    await assert.rejects(loadDataset(dir, './dataset.json'), /evidence file is missing/);
    await writeFile(join(dir, 'license.txt'), 'The survey owner grants permission to create a standalone cinematic MP4 using the surveyed photogrammetry and distribute that video publicly with the prescribed attribution.');
    const config = await loadDataset(dir, './dataset.json');
    assert.match(config.licenseEvidenceSha256, /^[a-f0-9]{64}$/);
    assert.equal('license' in config, false);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
