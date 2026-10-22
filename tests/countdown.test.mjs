import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/lib/countdown.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { remainingSeconds, countdownValues } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const start = Date.parse('2026-10-23T02:00:00Z');

test('targets October 22 at 8 pm in central Mexico, independently of the visitor timezone', () => {
  assert.equal(remainingSeconds(Date.parse('2026-10-22T20:00:00-06:00')), 0);
  assert.equal(remainingSeconds(Date.parse('2026-10-22T20:00:00Z')), 6 * 3600);
});

test('hours-only view keeps total hours above 24 and 99', () => {
  assert.deepEqual(countdownValues(49 * 3600 + 125, true), [49, 2, 5]);
  assert.deepEqual(countdownValues(100 * 3600, true), [100, 0, 0]);
});

test('transitions from 24 hours and carries minutes and seconds correctly', () => {
  assert.deepEqual(countdownValues(86400, true), [24, 0, 0]);
  assert.deepEqual(countdownValues(86399, true), [23, 59, 59]);
  assert.deepEqual(countdownValues(3599, true), [0, 59, 59]);
  assert.deepEqual(countdownValues(60, true), [0, 1, 0]);
});

test('does not show zero before the start and stays at zero after it', () => {
  assert.equal(remainingSeconds(start - 1), 1);
  assert.equal(remainingSeconds(start), 0);
  assert.equal(remainingSeconds(start + 86400000), 0);
  assert.deepEqual(countdownValues(-1, true), [0, 0, 0]);
});

test('recomputes from the fixed event time when reloaded or resumed', () => {
  assert.equal(remainingSeconds(start - 86400000), 86400);
  assert.equal(remainingSeconds(start - 3600000), 3600);
});

test('other existing countdown consumers retain their days format', () => {
  assert.deepEqual(countdownValues(49 * 3600 + 125), [2, 1, 2, 5]);
});
