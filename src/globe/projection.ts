import { Camera, Euler, MathUtils, Vector3 } from 'three';

/** The recovered geographic mapping includes the source sphere's -90° UV alignment. */
export function geographicPosition(latitude: number, longitude: number, radius = 1.56) {
  const polar = MathUtils.degToRad(90 - latitude);
  const azimuth = MathUtils.degToRad(90 - longitude);
  return new Vector3(radius * Math.sin(polar) * Math.cos(azimuth),
    radius * Math.cos(polar), radius * Math.sin(polar) * Math.sin(azimuth));
}

export type MarkerProjectionOptions = {
  yaw: number;
  pitch?: number;
  roll?: number;
  radius?: number;
  camera: Camera;
  width: number;
  height: number;
  mobileYScale?: number;
  bounds?: { west: number; east: number; south: number; north: number };
};

export function projectGeographicMarker(latitude: number, longitude: number,
  { yaw, pitch = 0, roll = 0, radius = 1.56, camera, width, height, mobileYScale = 1, bounds }: MarkerProjectionOptions) {
  const position = bounds
    ? (() => {
      const localLongitude = ((longitude - bounds.west) / (bounds.east - bounds.west) - .5) * Math.PI * 2;
      const localLatitude = ((latitude - bounds.south) / (bounds.north - bounds.south) - .5) * Math.PI;
      return new Vector3(
        radius * Math.sin(localLongitude) * Math.cos(localLatitude),
        radius * Math.sin(localLatitude),
        radius * Math.cos(localLongitude) * Math.cos(localLatitude),
      );
    })()
    : geographicPosition(latitude, longitude, radius);
  position.applyEuler(new Euler(MathUtils.degToRad(pitch), MathUtils.degToRad(yaw), MathUtils.degToRad(roll), 'XYZ'));
  const normal = position.clone().normalize();
  const cameraDirection = camera.position.clone().normalize();
  const front = normal.dot(cameraDirection) >= 0;
  if (!front) {
    position.copy(normal).projectOnPlane(cameraDirection);
    // An exactly antipodal point has no preferred rim direction. Stable fallback.
    if (position.lengthSq() < 1e-12) position.set(1, 0, 0).projectOnPlane(cameraDirection);
    if (position.lengthSq() < 1e-12) position.set(0, 1, 0).projectOnPlane(cameraDirection);
    position.normalize().multiplyScalar(radius);
  }
  camera.updateMatrixWorld();
  position.project(camera);
  return { x: (position.x + 1) * width / 2,
    y: height / 2 - position.y * height / 2 * mobileYScale, front };
}
