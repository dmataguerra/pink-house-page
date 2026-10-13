import { Camera, Mesh, Raycaster, Vector2 } from 'three';

export const POINTER_FILTER = Object.freeze({
  maxVelocity: 6,
  jitterSpeed: .02,
  minimumDirectionSpeed: .03,
  directionRate: 6,
  velocityRate: 10,
  speedForFull: 1.2,
  speedRise: 4,
  speedFall: 1.4,
});

export const wrap360 = (value: number) => ((value % 360) + 360) % 360;
export const wrap180 = (value: number) => wrap360(value + 180) - 180;
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const validUV = (point: Vector2) => point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;

/** Render-update motion filters, in top-down square-plane UV coordinates. */
export class PointerMotion {
  readonly position = new Vector2(-10, -10);
  readonly previous = new Vector2(-10, -10);
  readonly velocity = new Vector2();
  readonly direction = new Vector2(1, 0);
  readonly directionTarget = new Vector2(1, 0);
  speed = 0;

  update(dt: number) {
    dt = Math.max(0, dt);
    if (!validUV(this.position) || !validUV(this.previous)) {
      const decay = Math.exp(-10 * dt);
      this.velocity.multiplyScalar(decay);
      this.speed *= decay;
      this.previous.copy(this.position);
      return;
    }
    const inverseDelta = 1 / Math.max(dt, .001);
    let x = clamp((this.position.x - this.previous.x) * inverseDelta, -6, 6);
    let y = clamp((this.position.y - this.previous.y) * inverseDelta, -6, 6);
    let magnitude = Math.hypot(x, y);
    if (magnitude < POINTER_FILTER.jitterSpeed) { x = 0; y = 0; magnitude = 0; }
    if (magnitude > POINTER_FILTER.minimumDirectionSpeed) this.directionTarget.set(x / magnitude, y / magnitude);
    this.direction.lerp(this.directionTarget, 1 - Math.exp(-POINTER_FILTER.directionRate * dt));
    if (this.direction.length() > 1e-6) this.direction.normalize();
    else this.direction.set(1, 0);
    const velocityMix = 1 - Math.exp(-POINTER_FILTER.velocityRate * dt);
    this.velocity.x += (x - this.velocity.x) * velocityMix;
    this.velocity.y += (y - this.velocity.y) * velocityMix;
    const targetSpeed = clamp(this.velocity.length() / POINTER_FILTER.speedForFull, 0, 1);
    const rate = targetSpeed > this.speed ? POINTER_FILTER.speedRise : POINTER_FILTER.speedFall;
    this.speed += (targetSpeed - this.speed) * (1 - Math.exp(-rate * dt));
    this.previous.copy(this.position);
  }

  reset() {
    this.position.set(-10, -10);
    this.previous.set(-10, -10);
    this.velocity.set(0, 0);
    this.direction.set(1, 0);
    this.directionTarget.set(1, 0);
    this.speed = 0;
  }

  stop() {
    this.previous.copy(this.position);
    this.velocity.set(0, 0);
    this.speed = 0;
  }
}

export type PointerTrackingOptions = {
  canvas: HTMLCanvasElement;
  camera: Camera;
  plane: Mesh;
  motion: PointerMotion;
  enabled?: () => boolean;
  onHit?: (valid: boolean) => void;
};

/** Raycasts the full square, including its black corners and cropped extensions. */
export function bindPointerTracking({ canvas, camera, plane, motion, enabled = () => true, onHit }: PointerTrackingOptions) {
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const eventWindow = canvas.ownerDocument.defaultView ?? window;
  const sample = (clientX: number, clientY: number) => {
    if (!enabled()) return false;
    const rect = canvas.getBoundingClientRect();
    ndc.set(2 * (clientX - rect.left) / Math.max(rect.width, 1) - 1,
      1 - 2 * (clientY - rect.top) / Math.max(rect.height, 1));
    // Commands/resizes may precede the next render, so keep matrices current.
    camera.updateMatrixWorld();
    plane.updateWorldMatrix(true, false);
    raycaster.setFromCamera(ndc, camera);
    const intersection = raycaster.intersectObject(plane, false)[0];
    if (intersection?.uv) {
      motion.position.set(clamp(intersection.uv.x, 0, 1), clamp(1 - intersection.uv.y, 0, 1));
      onHit?.(true);
      return true;
    }
    // Nike retains the last valid UV on misses and pointer exit.
    onHit?.(false);
    return false;
  };
  const pointerMove = (event: PointerEvent) => sample(event.clientX, event.clientY);
  const touchMove = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (touch) sample(touch.clientX, touch.clientY);
  };
  const leave = () => onHit?.(false);
  eventWindow.addEventListener('pointermove', pointerMove, { passive: true });
  eventWindow.addEventListener('touchmove', touchMove, { passive: true });
  eventWindow.addEventListener('mouseleave', leave);
  return {
    sample,
    dispose() {
      eventWindow.removeEventListener('pointermove', pointerMove);
      eventWindow.removeEventListener('touchmove', touchMove);
      eventWindow.removeEventListener('mouseleave', leave);
    },
  };
}

export type InteractionOptions = {
  canvas: HTMLCanvasElement;
  camera: Camera;
  plane: Mesh;
  initialYaw?: number;
  initialPitch?: number;
  mobile?: boolean;
  onChange?: () => void;
  onDragStart?: () => void;
  isUI?: (target: EventTarget | null) => boolean;
};

export type InteractionUpdateOptions = { reducedMotion?: boolean; frozen?: boolean; hover?: boolean };

/** Source drag physics, with touch intent/cancellation and lifecycle corrections. */
export class GlobeInteraction {
  readonly motion = new PointerMotion();
  readonly spinVelocity = new Vector2(); // pitch, yaw degrees/second
  yaw: number;
  pitch: number;
  roll = 0;
  dragging = false;
  autoRotateEnabled = true;
  markerHover = false;
  mobile: boolean;
  private readonly canvas: HTMLCanvasElement;
  private readonly eventWindow: Window;
  private readonly options: InteractionOptions;
  private readonly tracking: ReturnType<typeof bindPointerTracking>;
  private readonly previousTouchAction: string;
  private readonly start = new Vector2();
  private readonly startRotation = new Vector2();
  private readonly lastPosition = new Vector2();
  private lastTime = 0;
  private activePointer: number | null = null;
  private pendingTouch = false;
  private autoBeforeDrag: boolean | null = null;
  private reducedMotion = false;
  private frozen = false;
  private disposed = false;

  constructor(options: InteractionOptions) {
    this.options = options;
    this.canvas = options.canvas;
    this.eventWindow = this.canvas.ownerDocument.defaultView ?? window;
    this.yaw = options.initialYaw ?? 0;
    this.pitch = options.initialPitch ?? 0;
    this.mobile = options.mobile ?? false;
    this.previousTouchAction = this.canvas.style.touchAction;
    this.canvas.style.touchAction = 'pan-y';
    this.tracking = bindPointerTracking({ ...options, motion: this.motion,
      enabled: () => !this.disposed && !this.reducedMotion && !this.frozen });
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.eventWindow.addEventListener('pointermove', this.onPointerMove, { passive: true });
    this.eventWindow.addEventListener('pointerup', this.onPointerUp, { passive: true });
    this.eventWindow.addEventListener('pointercancel', this.onPointerCancel, { passive: true });
    this.canvas.addEventListener('lostpointercapture', this.onLostCapture);
    this.eventWindow.addEventListener('blur', this.onBlur);
  }

  private onPointerDown = (event: PointerEvent) => {
    if (this.disposed || this.activePointer !== null || event.button !== 0 || event.isPrimary === false) return;
    const isUI = this.options.isUI?.(event.target) ??
      (event.target instanceof Element && !!event.target.closest('button, a, input, select, textarea, [role="button"]'));
    if (isUI) return;
    this.activePointer = event.pointerId;
    this.pendingTouch = event.pointerType === 'touch';
    this.start.set(event.clientX, event.clientY);
    this.startRotation.set(this.pitch, this.yaw);
    this.lastPosition.copy(this.start);
    this.lastTime = performance.now();
    if (!this.pendingTouch) this.beginDrag();
  };

  private beginDrag() {
    this.pendingTouch = false;
    this.dragging = true;
    this.spinVelocity.set(0, 0);
    this.autoBeforeDrag = this.autoRotateEnabled;
    this.autoRotateEnabled = false;
    this.options.onDragStart?.();
    if (this.activePointer !== null) {
      try { this.canvas.setPointerCapture(this.activePointer); } catch { /* Pointer already cancelled. */ }
    }
    this.options.onChange?.();
  }

  private onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== this.activePointer) return;
    const dx = event.clientX - this.start.x;
    const dy = event.clientY - this.start.y;
    if (this.pendingTouch) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
      if (Math.abs(dy) >= Math.abs(dx)) { this.endDrag(true); return; }
      this.beginDrag();
    }
    if (!this.dragging) return;
    this.yaw = wrap360(this.startRotation.y + dx * .22);
    this.pitch = wrap180(this.startRotation.x + (this.mobile ? 0 : dy * .18));
    const now = performance.now();
    const eventDt = Math.max((now - this.lastTime) / 1000, .001);
    const pitchVelocity = this.mobile ? 0 : (event.clientY - this.lastPosition.y) * .18 / eventDt;
    const yawVelocity = (event.clientX - this.lastPosition.x) * .22 / eventDt;
    this.spinVelocity.x += (pitchVelocity - this.spinVelocity.x) * .35;
    this.spinVelocity.y += (yawVelocity - this.spinVelocity.y) * .35;
    this.lastPosition.set(event.clientX, event.clientY);
    this.lastTime = now;
    this.options.onChange?.();
  };

  private endDrag(cancelled: boolean) {
    const pointerId = this.activePointer;
    const wasDragging = this.dragging;
    this.activePointer = null;
    this.pendingTouch = false;
    this.dragging = false;
    if (this.autoBeforeDrag !== null) this.autoRotateEnabled = this.autoBeforeDrag;
    this.autoBeforeDrag = null;
    if (cancelled || this.reducedMotion) this.spinVelocity.set(0, 0);
    if (pointerId !== null) {
      try {
        if (this.canvas.hasPointerCapture(pointerId)) this.canvas.releasePointerCapture(pointerId);
      } catch { /* The browser may have implicitly released a cancelled pointer. */ }
    }
    if (wasDragging) this.options.onChange?.();
  }

  private onPointerUp = (event: PointerEvent) => {
    if (event.pointerId === this.activePointer) this.endDrag(false);
  };
  private onPointerCancel = (event: PointerEvent) => {
    if (event.pointerId === this.activePointer) this.endDrag(true);
  };
  private onLostCapture = (event: PointerEvent) => {
    if (event.pointerId === this.activePointer) this.endDrag(true);
  };
  private onBlur = () => this.endDrag(true);

  update(dt: number, { reducedMotion = false, frozen = false, hover = false }: InteractionUpdateOptions = {}) {
    this.reducedMotion = reducedMotion;
    this.frozen = frozen;
    this.markerHover = hover;
    dt = Math.max(0, dt);
    if (reducedMotion || frozen) this.motion.stop();
    else this.motion.update(dt);
    if (this.dragging || reducedMotion || frozen) return;
    if (this.autoRotateEnabled && !this.markerHover) this.yaw = wrap360(this.yaw + 6 * dt);
    this.pitch = wrap180(this.pitch + this.spinVelocity.x * dt);
    this.yaw = wrap360(this.yaw + this.spinVelocity.y * dt);
    this.spinVelocity.multiplyScalar(Math.exp(-7.5 * dt));
    if (Math.abs(this.spinVelocity.x) < .01) this.spinVelocity.x = 0;
    if (Math.abs(this.spinVelocity.y) < .01) this.spinVelocity.y = 0;
  }

  rotateBy(yawDelta: number, pitchDelta = 0) {
    this.yaw = wrap360(this.yaw + yawDelta);
    this.pitch = wrap180(this.pitch + pitchDelta);
    this.spinVelocity.set(0, 0);
    this.options.onChange?.();
  }

  reset(yaw = 0, pitch = 0) {
    this.endDrag(true);
    this.yaw = wrap360(yaw);
    this.pitch = wrap180(pitch);
    this.roll = 0;
    this.motion.reset();
    this.options.onChange?.();
  }

  setMobile(mobile: boolean) { this.mobile = mobile; }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.endDrag(true);
    this.tracking.dispose();
    this.canvas.style.touchAction = this.previousTouchAction;
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.eventWindow.removeEventListener('pointermove', this.onPointerMove);
    this.eventWindow.removeEventListener('pointerup', this.onPointerUp);
    this.eventWindow.removeEventListener('pointercancel', this.onPointerCancel);
    this.canvas.removeEventListener('lostpointercapture', this.onLostCapture);
    this.eventWindow.removeEventListener('blur', this.onBlur);
  }
}
