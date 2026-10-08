export function coordinatesFromMapsUrl(value: string): { latitude: number; longitude: number; kind: 'place-marker' | 'camera-center' } {
  const url = new URL(value);
  if (!/(^|\.)google\.[a-z.]+$/.test(url.hostname)) throw new Error('Expected a resolved Google Maps URL.');
  const decoded = decodeURIComponent(url.href);
  const marker = decoded.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  const view = decoded.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const match = marker || view;
  if (!match) throw new Error('The resolved Maps URL has no geographic coordinates.');
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw new Error('Maps URL contains invalid coordinates.');
  }
  return { latitude, longitude, kind: marker ? 'place-marker' : 'camera-center' };
}
export function distanceMeters(a: {latitude:number;longitude:number}, b: {latitude:number;longitude:number}) {
  const radians = (value: number) => value * Math.PI / 180;
  const dlat = radians(b.latitude - a.latitude), dlon = radians(b.longitude - a.longitude);
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dlon / 2) ** 2;
  return 6371008.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
