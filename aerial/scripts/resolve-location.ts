import { coordinatesFromMapsUrl, distanceMeters } from '../server/location';
import { TARGET } from '../src/config';
const shortUrl = 'https://maps.app.goo.gl/LYGenKGTPA1pnLqaA';
try {
  const response = await fetch(shortUrl, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error('The Maps location URL did not resolve.');
  const marker = coordinatesFromMapsUrl(response.url);
  // Inspect redirect coordinates only; never request 3D content or analyze imagery.
  console.log(JSON.stringify({ requestedTarget: TARGET, resolvedMarker: marker, distanceMeters: distanceMeters(TARGET, marker), focalPoint: 'requestedTarget' }, null, 2));
} catch { console.error('Unable to resolve the short URL. The explicitly supplied target coordinates remain authoritative.'); process.exitCode = 2; }
