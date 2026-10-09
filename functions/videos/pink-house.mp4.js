// Pages' static server ignores Range. Serve only this MP4 as seekable media.
function byteWindow(body, start, length) {
  const reader = body.getReader();
  let position = 0;
  let remaining = length;
  return new ReadableStream({
    async pull(controller) {
      while (remaining > 0) {
        const { value, done } = await reader.read();
        if (done) {
          controller.error(new Error('Video asset ended before the requested range'));
          return;
        }
        const chunkEnd = position + value.byteLength;
        if (chunkEnd <= start) {
          position = chunkEnd;
          continue;
        }
        const offset = Math.max(0, start - position);
        const count = Math.min(value.byteLength - offset, remaining);
        controller.enqueue(value.subarray(offset, offset + count));
        position = chunkEnd;
        remaining -= count;
        if (remaining === 0) {
          controller.close();
          await reader.cancel();
        }
        return;
      }
    },
    cancel(reason) { return reader.cancel(reason); },
  });
}

export async function onRequest({ request, env }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  const range = request.method === 'GET' ? request.headers.get('Range') : null;
  const ifRange = request.headers.get('If-Range');
  const assetRequestHeaders = new Headers(request.headers);
  assetRequestHeaders.delete('Range');
  assetRequestHeaders.delete('If-Range');
  if (range) {
    assetRequestHeaders.delete('If-None-Match');
    assetRequestHeaders.delete('If-Modified-Since');
  }
  // This binding bypasses Functions and keeps the original uploaded MP4.
  const asset = await env.ASSETS.fetch(new Request(request.url, {
    method: 'GET', headers: assetRequestHeaders,
  }));
  const headers = new Headers(asset.headers);
  if (request.method === 'HEAD') {
    await asset.body?.cancel();
    headers.set('Accept-Ranges', 'bytes');
    return new Response(null, { status: asset.status, headers });
  }
  if (asset.status !== 200) return asset;
  const size = Number(headers.get('Content-Length'));
  if (!Number.isSafeInteger(size) || size <= 0 || !asset.body) return asset;
  headers.set('Accept-Ranges', 'bytes');
  const match = range?.match(/^bytes=(\d*)-(\d*)$/i);
  const validatorMatches = !ifRange || (!ifRange.startsWith('W/') && ifRange === headers.get('ETag'));
  if (!match || (!match[1] && !match[2]) || !validatorMatches) {
    return new Response(asset.body, { status: 200, headers });
  }
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  if (!Number.isSafeInteger(start) || start >= size || start > end) {
    await asset.body.cancel();
    headers.set('Content-Range', `bytes */${size}`);
    headers.set('Content-Length', '0');
    return new Response(null, { status: 416, headers });
  }
  const length = end - start + 1;
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(length));
  const body = start === 0 && length === size ? asset.body : byteWindow(asset.body, start, length);
  return new Response(body, { status: 206, headers });
}
