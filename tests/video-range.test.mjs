import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/videos/pink-house.mp4.js';

const video = new TextEncoder().encode('abcdefghijklmnop');
async function request(headers = {}, method = 'GET') {
  return onRequest({
    request: new Request('https://pink-house-page.pages.dev/videos/pink-house.mp4?v=test', { method, headers }),
    env: { ASSETS: { async fetch(assetRequest) {
      assert.equal(assetRequest.headers.get('Range'), null);
      assert.equal(assetRequest.method, 'GET');
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
  const response = await request({ Range: 'bytes=4-8', 'If-Range': '"video-v1"', 'If-None-Match': '"video-v1"' });
  assert.equal(response.status, 206);
  assert.equal(await response.text(), 'efghi');
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
