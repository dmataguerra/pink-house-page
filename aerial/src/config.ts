export const TARGET = Object.freeze({
  latitude: 20.707390681241908,
  longitude: -100.44438633247219,
  address: 'Paseo de Libero 172, Juriquilla, Querétaro, Mexico',
});
export const VIDEO = Object.freeze({ width: 1920, height: 1080, fps: 30, duration: 30, frames: 900 });

export interface DatasetConfig {
  name: string;
  provider: string;
  tilesetUrl: string;
  captureDate: string;
  targetEllipsoidHeight: number;
  attribution: string;
  licenseEvidenceSha256: string;
  coverage: { west: number; south: number; east: number; north: number };
}
export interface GeometryReport {
  sampleCount: number;
  validSamples: number;
  heightRange: number;
  targetHeight: number;
  verified: boolean;
}
export interface FrameReport {
  frame: number;
  time: number;
  loaded: boolean;
  visibleTiles: number;
  geometryBytes: number;
  textureBytes: number;
  collisionClearance: number;
  targetVisible: boolean;
  targetOccluded: boolean;
  attributionVisible: boolean;
  credits: string[];
  projectedTarget: { x: number; y: number };
}
export interface FlyoverApi {
  ready: boolean;
  error: string | null;
  frames: number;
  fps: number;
  duration: number;
  width: number;
  height: number;
  source: { name: string; attribution: string; licenseEvidenceSha256: string };
  prepare(): Promise<GeometryReport>;
  renderFrame(index: number): Promise<FrameReport>;
}
declare global { interface Window { flyover: FlyoverApi } }
