/** Local camera offset in metres, relative to the fixed geographic target. */
export interface IllustratedPose {
  east: number;
  north: number;
  up: number;
  /** Slant distance to the target, in metres. */
  range: number;
  /** Deterministic video time in seconds. */
  time: number;
  phase: 'space' | 'zoom' | 'approach' | 'orbit' | 'pullback';
}

interface MotionKey {
  time: number;
  logRange: number;
  logRangeVelocity: number;
  elevation: number;
  elevationVelocity: number;
  heading: number;
  headingVelocity: number;
}

const FPS = 30;
const DURATION = 30;
const radians = (degrees: number): number => degrees * Math.PI / 180;
const orbitVelocity = Math.PI * 2 / 13;
const orbitElevation = Math.asin(150 / 220);

// Interpolate logarithmic range so the move from space to street scale remains
// legible. Shared nonzero tangent velocities prevent a pause at phase changes.
// Orbit range/elevation are constant; its unwrapped heading advances exactly
// 2π radians between 15 and 28 seconds at one consistent angular speed.
const KEYS: readonly MotionKey[] = [
  {
    time: 0, logRange: Math.log(22_000_000), logRangeVelocity: -0.06,
    elevation: Math.asin(21_998_000 / 22_000_000), elevationVelocity: radians(-0.6),
    heading: radians(-15), headingVelocity: radians(8),
  },
  {
    time: 3, logRange: Math.log(16_000_000), logRangeVelocity: -0.13,
    elevation: radians(87), elevationVelocity: radians(-1),
    heading: radians(20), headingVelocity: radians(10),
  },
  {
    time: 12, logRange: Math.log(650), logRangeVelocity: -0.32,
    elevation: radians(45), elevationVelocity: radians(-1),
    heading: radians(100), headingVelocity: radians(12),
  },
  {
    time: 15, logRange: Math.log(220), logRangeVelocity: 0,
    elevation: orbitElevation, elevationVelocity: 0,
    heading: radians(160), headingVelocity: orbitVelocity,
  },
  {
    time: 28, logRange: Math.log(220), logRangeVelocity: 0,
    elevation: orbitElevation, elevationVelocity: 0,
    heading: radians(520), headingVelocity: orbitVelocity,
  },
  {
    time: 30, logRange: Math.log(360), logRangeVelocity: 0.3,
    elevation: Math.asin(240 / 360), elevationVelocity: radians(-0.7),
    heading: radians(565), headingVelocity: radians(18),
  },
];

const PHASES: readonly IllustratedPose['phase'][] = ['space', 'zoom', 'approach', 'orbit', 'pullback'];

/** Cubic Hermite interpolation with tangents measured in units per second. */
function hermite(start: number, end: number, velocityStart: number, velocityEnd: number, time: number, duration: number): number {
  const t = Math.max(0, Math.min(1, time / duration));
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * start +
    (t3 - 2 * t2 + t) * duration * velocityStart +
    (-2 * t3 + 3 * t2) * end +
    (t3 - t2) * duration * velocityEnd;
}

/**
 * Sample one of 900 video frames (0 through 899) at 30 FPS. Fractional frames
 * are supported for inspection; finite out-of-range inputs clamp to 0–30 s.
 * The Earth-scale opening is nearly above the target, with a small horizontal
 * offset to keep the renderer's look-at orientation away from a vertical pole.
 * The result has no dependence on wall-clock time or rendering speed.
 */
export function illustratedPose(frame: number): IllustratedPose {
  if (!Number.isFinite(frame)) throw new RangeError('frame must be finite');
  const time = Math.max(0, Math.min(DURATION, frame / FPS));
  let index = KEYS.length - 2;
  for (let candidate = 0; candidate < KEYS.length - 1; candidate += 1) {
    if (time < KEYS[candidate + 1].time) {
      index = candidate;
      break;
    }
  }
  const start = KEYS[index];
  const end = KEYS[index + 1];
  const elapsed = time - start.time;
  const duration = end.time - start.time;
  const range = Math.exp(hermite(start.logRange, end.logRange, start.logRangeVelocity, end.logRangeVelocity, elapsed, duration));
  const elevation = hermite(start.elevation, end.elevation, start.elevationVelocity, end.elevationVelocity, elapsed, duration);
  const heading = hermite(start.heading, end.heading, start.headingVelocity, end.headingVelocity, elapsed, duration);
  const horizontal = range * Math.cos(elevation);

  return {
    east: -Math.sin(heading) * horizontal,
    north: -Math.cos(heading) * horizontal,
    up: range * Math.sin(elevation),
    range,
    time,
    phase: PHASES[index],
  };
}
