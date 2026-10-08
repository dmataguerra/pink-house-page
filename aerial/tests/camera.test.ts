import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAMERA_DURATION, CAMERA_FPS, framePose, type CameraPose } from '../src/camera.ts';

const close = (actual: number, expected: number, tolerance = 1e-9): void => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
};
const at = (seconds: number): CameraPose => framePose(seconds * CAMERA_FPS);
const pathFields = ['east', 'north', 'up', 'heading', 'pitch', 'range'] as const;

test('canonical timing and cinematic compositions match the intended sequence', () => {
  assert.equal(CAMERA_DURATION, 30);
  assert.equal(CAMERA_FPS, 30);
  const anchors = [
    [0, 650, 350, 'establishing'],
    [5, 620, 330, 'approach'],
    [10, 140, 90, 'orbit'],
    [20, 140, 90, 'reveal'],
    [25, 240, 65, 'pullback'],
    [30, 800, 440, 'pullback'],
  ] as const;
  for (const [seconds, range, up, phase] of anchors) {
    const pose = at(seconds);
    close(pose.time, seconds);
    close(pose.range, range);
    close(pose.up, up);
    assert.equal(pose.phase, phase);
  }
});

test('all 900 frames are finite, deterministic, distinct and aimed at the fixed target', () => {
  const signatures = new Set<string>();
  let previousHeading = -Infinity;
  for (let frame = 0; frame < CAMERA_DURATION * CAMERA_FPS; frame += 1) {
    const pose = framePose(frame);
    assert.deepEqual(pose, framePose(frame));
    for (const field of pathFields) assert.ok(Number.isFinite(pose[field]), `${frame}: ${field}`);
    assert.ok(pose.up >= 65, `${frame}: nominal vertical clearance`);
    assert.ok(pose.range > pose.up, `${frame}: horizontal clearance`);
    assert.ok(pose.heading > previousHeading, `${frame}: heading must advance`);
    previousHeading = pose.heading;
    close(Math.hypot(pose.east, pose.north, pose.up), pose.range);
    const horizontal = Math.hypot(pose.east, pose.north);
    close(-pose.east / horizontal, Math.sin(pose.heading));
    close(-pose.north / horizontal, Math.cos(pose.heading));
    close(pose.pitch, -Math.atan2(pose.up, horizontal));
    assert.ok(pose.pitch < 0 && pose.pitch > -Math.PI / 2);
    signatures.add(pathFields.map((field) => pose[field].toFixed(8)).join(','));
  }
  assert.equal(signatures.size, 900, 'every captured frame must have a distinct camera pose');
});

test('orbit completes exactly 360 degrees at a constant radius and height', () => {
  const start = at(10);
  const finish = at(20);
  close(finish.heading - start.heading, Math.PI * 2);
  close(finish.east, start.east);
  close(finish.north, start.north);
  close(at(15).heading - start.heading, Math.PI);
  for (let frame = 10 * CAMERA_FPS; frame <= 20 * CAMERA_FPS; frame += 1) {
    const pose = framePose(frame);
    close(pose.range, 140);
    close(pose.up, 90);
  }
});

test('segment boundaries preserve position, velocity and acceleration continuity', () => {
  const delta = 0.0001;
  for (const boundary of [5, 10, 20, 25]) {
    const before2 = at(boundary - 2 * delta);
    const before = at(boundary - delta);
    const center = at(boundary);
    const after = at(boundary + delta);
    const after2 = at(boundary + 2 * delta);
    for (const field of pathFields) {
      close(before[field], after[field], 0.00001);
      const leftVelocity = (center[field] - before[field]) / delta;
      const rightVelocity = (after[field] - center[field]) / delta;
      close(leftVelocity, 0, 0.0001);
      close(rightVelocity, 0, 0.0001);
      const leftAcceleration = (center[field] - 2 * before[field] + before2[field]) / delta ** 2;
      const rightAcceleration = (after2[field] - 2 * after[field] + center[field]) / delta ** 2;
      close(leftAcceleration, 0, 0.2);
      close(rightAcceleration, 0, 0.2);
      close(leftAcceleration, rightAcceleration, 0.3);
    }
  }
});

test('finite frames clamp and shortened durations preserve the whole sequence', () => {
  assert.deepEqual(framePose(-100), framePose(0));
  assert.deepEqual(framePose(10000), at(30));
  assert.deepEqual(framePose(30 * 60, 60), at(30));
  const shorter = framePose(5 * 30, 30, 15);
  const canonical = at(10);
  for (const field of pathFields) close(shorter[field], canonical[field]);
  assert.equal(shorter.phase, 'orbit');
  assert.equal(shorter.time, 5);
  assert.equal(framePose(10000, 30, 15).time, 15);
});

test('invalid inputs fail clearly instead of generating corrupt camera coordinates', () => {
  for (const frame of [NaN, Infinity, -Infinity]) assert.throws(() => framePose(frame), RangeError);
  for (const fps of [0, -1, NaN, Infinity]) assert.throws(() => framePose(0, fps), RangeError);
  for (const duration of [0, -1, 30.001, NaN, Infinity]) {
    assert.throws(() => framePose(0, 30, duration), RangeError);
  }
});
