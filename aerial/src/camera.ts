/** The canonical sequence lasts 30 seconds and is sampled at 30 frames/second. */
export const CAMERA_DURATION = 30;
export const CAMERA_FPS = 30;

/**
 * Camera coordinates relative to the fixed focal target, in an east/north/up
 * local frame. Distances are metres. Heading is an unwrapped angle in radians,
 * clockwise from north, looking toward the target. Pitch is in radians, with
 * negative values looking downward. Range is the slant distance to the target.
 *
 * `up` is clearance above the focal point, not a terrain collision guarantee.
 * The renderer must place that point using the dataset's actual roof/ground
 * elevation and check the surrounding geometry before recording.
 */
export interface CameraPose {
  east: number;
  north: number;
  up: number;
  heading: number;
  pitch: number;
  range: number;
  phase: 'establishing' | 'approach' | 'orbit' | 'reveal' | 'pullback';
  time: number;
}

interface Keyframe {
  time: number;
  range: number;
  up: number;
  heading: number;
}

const radians = (degrees: number): number => (degrees * Math.PI) / 180;

// Each segment uses quintic easing. Its first and second derivatives are zero
// at both ends, making the complete position and orientation path C2 continuous.
// Heading stays unwrapped so the full orbit cannot collapse to a shortest-path
// interpolation between equivalent orientations.
const KEYFRAMES: readonly Keyframe[] = [
  { time: 0, range: 650, up: 350, heading: radians(-45) },
  { time: 5, range: 620, up: 330, heading: radians(-20) },
  { time: 10, range: 140, up: 90, heading: radians(25) },
  { time: 20, range: 140, up: 90, heading: radians(385) },
  { time: 25, range: 240, up: 65, heading: radians(420) },
  { time: 30, range: 800, up: 440, heading: radians(450) },
];

const PHASES: readonly CameraPose['phase'][] = [
  'establishing',
  'approach',
  'orbit',
  'reveal',
  'pullback',
];

function smootherstep(value: number): number {
  const x = Math.max(0, Math.min(1, value));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function interpolate(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

/**
 * Return a reproducible pose for an integer or fractional frame number.
 * Out-of-range finite frames clamp to the start or final composition. A shorter
 * duration proportionally compresses the entire sequence; duration may not
 * exceed the canonical 30-second maximum. There is no wall-clock dependency.
 */
export function framePose(
  frame: number,
  fps = CAMERA_FPS,
  duration = CAMERA_DURATION,
): CameraPose {
  if (!Number.isFinite(frame)) {
    throw new RangeError('frame must be finite');
  }
  if (!Number.isFinite(fps) || fps <= 0) {
    throw new RangeError('fps must be finite and greater than zero');
  }
  if (!Number.isFinite(duration) || duration <= 0 || duration > CAMERA_DURATION) {
    throw new RangeError(`duration must be greater than zero and at most ${CAMERA_DURATION} seconds`);
  }

  const time = Math.max(0, Math.min(duration, frame / fps));
  const sequenceTime = (time / duration) * CAMERA_DURATION;
  let segment = KEYFRAMES.length - 2;
  for (let index = 0; index < KEYFRAMES.length - 1; index += 1) {
    if (sequenceTime < KEYFRAMES[index + 1].time) {
      segment = index;
      break;
    }
  }

  const start = KEYFRAMES[segment];
  const end = KEYFRAMES[segment + 1];
  const amount = smootherstep((sequenceTime - start.time) / (end.time - start.time));
  const range = interpolate(start.range, end.range, amount);
  const up = interpolate(start.up, end.up, amount);
  const heading = interpolate(start.heading, end.heading, amount);
  const horizontal = Math.sqrt(range * range - up * up);

  return {
    east: -Math.sin(heading) * horizontal,
    north: -Math.cos(heading) * horizontal,
    up,
    heading,
    pitch: -Math.atan2(up, horizontal),
    range,
    phase: PHASES[segment],
    time,
  };
}
