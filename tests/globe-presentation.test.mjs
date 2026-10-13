import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { dirname, resolve } from 'node:path';
import { build } from 'esbuild';

const filename = resolve('src/globe/presentation.ts');
const result = await build({ entryPoints: [filename], bundle: true, write: false,
  platform: 'node', format: 'cjs' });
const sourceModule = new Module(filename);
sourceModule.filename = filename;
sourceModule.paths = Module._nodeModulePaths(dirname(filename));
sourceModule._compile(result.outputFiles[0].text, filename);
const { calcGlobePresentation } = sourceModule.exports;
const near = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance,
  `Expected ${actual} to be within ${tolerance} of ${expected}`);
const desktop = { scrollHeight: 6000, viewportHeight: 1000, mobile: false, maxBlur: 14 };

test('persistent globe starts in its recovered translated, scaled, faded state', () => {
  const state = calcGlobePresentation({ ...desktop, scrollY: 0 });
  assert.deepEqual(state, {
    progress: 0, y: 1000, scale: 2, opacity: .55, blur: 14,
    rotationOffset: 0, markersVisible: false, interactive: true,
  });
  // Revealing starts 1.5 viewport heights before the reserved footer boundary.
  assert.equal(calcGlobePresentation({ ...desktop, scrollY: 3319 }).progress, 0);
  assert.equal(calcGlobePresentation({ ...desktop, scrollY: 3320 }).progress, 0);
  assert.ok(calcGlobePresentation({ ...desktop, scrollY: 3321 }).progress > 0);
});

test('desktop midpoint and final reserved window reproduce wrapper interpolation', () => {
  const halfway = calcGlobePresentation({ ...desktop, scrollY: 4070 });
  near(halfway.progress, .5);
  assert.equal(halfway.y, 500);
  near(halfway.scale, 1.5);
  near(halfway.opacity, .775);
  near(halfway.blur, 7);
  near(halfway.rotationOffset, 144);
  const complete = calcGlobePresentation({ ...desktop, scrollY: 4820 });
  assert.deepEqual(complete, {
    progress: 1, y: 0, scale: 1, opacity: 1, blur: 0,
    rotationOffset: 288, markersVisible: true, interactive: true,
  });
  assert.deepEqual(calcGlobePresentation({ ...desktop, scrollY: 5000 }), complete);
  assert.deepEqual(calcGlobePresentation({ ...desktop, scrollY: 9000 }), complete);
});

test('markers reveal at .74 and retain full spatial choreography below and above that threshold', () => {
  const before = calcGlobePresentation({ ...desktop, scrollY: 3320 + 1500 * .739 });
  const threshold = calcGlobePresentation({ ...desktop, scrollY: 3320 + 1500 * .74 });
  const after = calcGlobePresentation({ ...desktop, scrollY: 3320 + 1500 * .741 });
  assert.equal(before.markersVisible, false);
  assert.equal(threshold.markersVisible, true);
  assert.equal(after.markersVisible, true);
  assert.ok(before.rotationOffset < threshold.rotationOffset);
  assert.ok(threshold.rotationOffset < after.rotationOffset);
});

test('mobile uses .79 viewport translation, final scale 1.2, capped blur, and a .9 blur window', () => {
  const mobile = { ...desktop, mobile: true, maxBlur: 6 };
  const initial = calcGlobePresentation({ ...mobile, scrollY: 0 });
  assert.equal(initial.y, 790);
  assert.equal(initial.blur, 6);
  assert.equal(initial.interactive, false);
  const halfway = calcGlobePresentation({ ...mobile, scrollY: 4070 });
  near(halfway.scale, 1.6);
  near(halfway.y, 395);
  assert.equal(halfway.blur, 6);
  const sharpened = calcGlobePresentation({ ...mobile, scrollY: 3320 + 1500 * .9 });
  near(sharpened.progress, .9);
  near(sharpened.blur, 0);
  assert.ok(sharpened.y > 0);
  assert.equal(sharpened.interactive, false);
  const complete = calcGlobePresentation({ ...mobile, scrollY: 4820 });
  near(complete.scale, 1.2);
  assert.equal(complete.y, 0);
  assert.equal(complete.interactive, true);
  // Usability correction: settle/unlock before the literal page bottom.
  assert.ok(4820 < desktop.scrollHeight - desktop.viewportHeight);
});

test('mobile hardware tiers cap shader blur without changing reveal position or rotation', () => {
  const caps = [6, 4, 2.5];
  const states = caps.map(maxBlur => calcGlobePresentation({ ...desktop, mobile: true, maxBlur, scrollY: 0 }));
  assert.deepEqual(states.map(state => state.blur), caps);
  for (const state of states) {
    assert.equal(state.y, 790);
    assert.equal(state.scale, 2);
    assert.equal(state.rotationOffset, 0);
  }
});

test('short pages use proportional page progress and a reserve limited to 20 percent of scroll', () => {
  const short = { scrollHeight: 1500, viewportHeight: 1000, mobile: false };
  const midpoint = calcGlobePresentation({ ...short, scrollY: 200 });
  near(midpoint.progress, .5);
  assert.equal(midpoint.y, 500);
  near(midpoint.rotationOffset, 144);
  assert.equal(calcGlobePresentation({ ...short, scrollY: 400 }).progress, 1);
  assert.equal(calcGlobePresentation({ ...short, scrollY: 500 }).progress, 1);
});

test('overscroll and zero-size page measurements remain finite and clamp at the initial state', () => {
  const overscroll = calcGlobePresentation({ ...desktop, scrollY: -200 });
  assert.equal(overscroll.progress, 0);
  assert.equal(overscroll.y, 1000);
  const empty = calcGlobePresentation({ scrollY: 0, scrollHeight: 0, viewportHeight: 0, mobile: true });
  for (const key of ['progress', 'y', 'scale', 'opacity', 'blur', 'rotationOffset']) assert.ok(Number.isFinite(empty[key]));
  assert.equal(empty.progress, 0);
});

test('reduced motion removes scroll blur while preserving explicit scroll reveal and marker availability', () => {
  const regular = calcGlobePresentation({ ...desktop, scrollY: 4070 });
  const reduced = calcGlobePresentation({ ...desktop, scrollY: 4070, reducedMotion: true });
  assert.deepEqual(reduced, { ...regular, blur: 0 });
  assert.equal(calcGlobePresentation({ ...desktop, scrollY: 4820, reducedMotion: true }).markersVisible, true);
});

test('vertical translation follows the recovered integer-pixel rounding', () => {
  const state = calcGlobePresentation({ ...desktop, scrollY: 3320 + 1500 * .12345 });
  assert.equal(state.y, 877);
});
