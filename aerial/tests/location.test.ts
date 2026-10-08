import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coordinatesFromMapsUrl, distanceMeters } from '../server/location';
import { TARGET } from '../src/config';
test('place marker is chosen over the offset Maps viewport center', () => {
  const result = coordinatesFromMapsUrl('https://www.google.com/maps/place/property/@20.7072552,-100.4469505,17z/data=!3m1!4b1!4m6!3m5!1sabc!8m2!3d20.7072502!4d-100.4443756');
  assert.deepEqual(result, { latitude: 20.7072502, longitude: -100.4443756, kind: 'place-marker' });
  assert.ok(distanceMeters(TARGET, result) > 15 && distanceMeters(TARGET, result) < 16);
});
test('camera coordinates are explicitly marked as a fallback and invalid links rejected', () => {
  assert.equal(coordinatesFromMapsUrl('https://www.google.com/maps/@20.7,-100.4,17z').kind, 'camera-center');
  assert.throws(() => coordinatesFromMapsUrl('https://evil.example/@20.7,-100.4,17z'));
  assert.throws(() => coordinatesFromMapsUrl('https://www.google.com/maps/@120,-100.4,17z'));
  assert.throws(() => coordinatesFromMapsUrl('https://www.google.com/maps/place/no-coordinates'));
});
