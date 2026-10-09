import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { onRequest } from '../functions/videos/pink-house.mp4.js';
import { videoByteLength } from '../cloudflare/video-metadata.js';

// Model the platform's fixed-length stream contract in Node's Web Streams.
globalThis.FixedLengthStream = class extends TransformStream {
  constructor(expectedLength) {
    let delivered = 0;
    super({
      transform(chunk, controller) {
        delivered += chunk.byteLength;
        assert.ok(delivered <= expectedLength, 'Stream exceeded its declared length');
        controller.enqueue(chunk);
      },
      flush() { assert.equal(delivered, expectedLength, 'Stream ended before its declared length'); },
    });
  }
};

const video = new TextEncoder().encode('abcdefghijklmnop');
async function request(headers = {}, method = 'GET') {
  return onRequest({
    waitUntil(promise) { assert.equal(typeof promise.then, 'function'); },
    request: new Request('https://pink-house-page.pages.dev/videos/pink-house.mp4?v=test', { method, headers }),
    env: { ASSETS: { async fetch(assetRequest) {
      assert.equal(assetRequest.headers.get('Range'), null);
      assert.equal(assetRequest.method, 'GET');
      if (assetRequest.headers.get('If-None-Match') === '"video-v1"') {
        return new Response(null, { status: 304, headers: { ETag: '"video-v1"' } });
      }
      let offset = 0;
      const body = new ReadableStream({ pull(controller) {
        if (offset === video.length) { controller.close(); return; }
        controller.enqueue(video.subarray(offset, offset + 3));
        offset = Math.min(video.length, offset + 3);
      } });
      return new Response(body, { headers: { 'Content-Length': String(video.length), 'Content-Type': 'video/mp4', ETag: '"video-v1"' } });
    } } },
  });
}

test('normal GET preserves the original file and advertises seeking', async () => {
  const response = await request();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Accept-Ranges'), 'bytes');
  assert.equal(response.headers.get('Content-Type'), 'video/mp4');
  assert.equal(await response.text(), 'abcdefghijklmnop');
});
for (const [range, text, contentRange] of [
  ['bytes=0-', 'abcdefghijklmnop', 'bytes 0-15/16'],
  ['bytes=4-8', 'efghi', 'bytes 4-8/16'],
  ['bytes=8-', 'ijklmnop', 'bytes 8-15/16'],
  ['bytes=-4', 'mnop', 'bytes 12-15/16'],
  ['bytes=14-99', 'op', 'bytes 14-15/16'],
  ['bytes=-99', 'abcdefghijklmnop', 'bytes 0-15/16'],
]) {
  test(`partial response ${range} returns exact bytes across stream chunks`, async () => {
    const response = await request({ Range: range });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('Content-Range'), contentRange);
    assert.equal(response.headers.get('Content-Length'), String(text.length));
    assert.equal(await response.text(), text);
  });
}
for (const range of ['bytes=16-', 'bytes=9-2', 'bytes=-0']) {
  test(`unsatisfiable ${range} returns 416 without a media body`, async () => {
    const response = await request({ Range: range });
    assert.equal(response.status, 416);
    assert.equal(response.headers.get('Content-Range'), 'bytes */16');
    assert.equal(await response.text(), '');
  });
}
test('unsupported multipart range falls back to a full response', async () => {
  const response = await request({ Range: 'bytes=0-2,8-9' });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'abcdefghijklmnop');
});
test('matching If-Range preserves partial delivery', async () => {
  const response = await request({ Range: 'bytes=4-8', 'If-Range': '"video-v1"' });
  assert.equal(response.status, 206);
  assert.equal(await response.text(), 'efghi');
});
test('conditional cache validation takes precedence over Range', async () => {
  const response = await request({ Range: 'bytes=4-8', 'If-Range': '"video-v1"', 'If-None-Match': '"video-v1"' });
  assert.equal(response.status, 304);
  assert.equal(response.headers.get('Content-Range'), null);
  assert.equal(await response.text(), '');
});
test('changed If-Range returns the new whole file', async () => {
  const response = await request({ Range: 'bytes=4-8', 'If-Range': '"old-version"' });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'abcdefghijklmnop');
});
test('HEAD returns metadata with no body', async () => {
  const response = await request({}, 'HEAD');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Length'), '16');
  assert.equal(response.headers.get('Accept-Ranges'), 'bytes');
  assert.equal(await response.text(), '');
});
test('unsupported methods cannot alter the uploaded asset', async () => {
  const response = await request({}, 'POST');
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('Allow'), 'GET, HEAD');
});
test('build metadata matches the original uploaded MP4', () => {
  assert.equal(videoByteLength, statSync(new URL('../public/videos/pink-house.mp4', import.meta.url)).size);
});
test('missing ASSETS length still returns exact original MP4 bytes', async () => {
  const original = readFileSync(new URL('../public/videos/pink-house.mp4', import.meta.url));
  const response = await onRequest({
    request: new Request('https://pink-house-page.pages.dev/videos/pink-house.mp4', { headers: { Range: 'bytes=0-15' } }),
    waitUntil(promise) { assert.equal(typeof promise.then, 'function'); },
    env: { ASSETS: { async fetch() { return new Response(original, { headers: { 'Content-Type': 'video/mp4' } }); } } },
  });
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('Content-Range'), `bytes 0-15/${original.length}`);
  assert.equal(response.headers.get('Content-Length'), '16');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array(original.subarray(0, 16)));
});
