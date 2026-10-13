import { CanvasTexture, LinearFilter } from 'three';
import type { PointerMotion } from './interaction';

export type TrailUpdateOptions = {
  motion: PointerMotion;
  trailAmount: number;
  mouseRadius: number;
  fillFactor: number;
  enabled: boolean;
};

/** Fading CanvasTexture history; the noise shader applies its recovered nine taps. */
export class MouseTrail {
  readonly canvas: HTMLCanvasElement;
  readonly texture: CanvasTexture;
  private readonly context: CanvasRenderingContext2D;
  private hasPrevious = false;
  private previousX = 0;
  private previousY = 0;
  private disposed = false;

  constructor(size = 512) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = Math.max(1, Math.round(size));
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Canvas2D is required for the globe pointer trail.');
    this.context = context;
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.texture = new CanvasTexture(this.canvas);
    this.texture.minFilter = this.texture.magFilter = LinearFilter;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;
  }

  update(dt: number, { motion, trailAmount, mouseRadius, fillFactor, enabled }: TrailUpdateOptions) {
    if (this.disposed) return;
    const context = this.context;
    const size = this.canvas.width;
    const amount = Math.max(0, Math.min(1, trailAmount));
    const inverseFill = 1 / Math.max(fillFactor, 1e-6);
    const decayRate = 2 + (.25 - 2) * amount;
    const opacity = 1 - Math.exp(-decayRate * Math.max(dt, 1 / 120));
    context.globalCompositeOperation = 'source-over';
    context.filter = 'none';
    context.fillStyle = `rgba(0,0,0,${opacity})`;
    context.fillRect(0, 0, size, size);
    const point = motion.position;
    if (!enabled || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
      this.hasPrevious = false;
      this.texture.needsUpdate = true;
      return;
    }
    const x = point.x * size;
    const y = point.y * size;
    const speed = Math.max(0, Math.min(1, motion.speed));
    const radius = Math.max(1, mouseRadius * inverseFill * size * .33);
    context.lineCap = context.lineJoin = 'round';
    context.strokeStyle = `rgba(255,255,255,${.16 + speed * .34})`;
    context.lineWidth = Math.max(1, radius * 1.4);
    context.filter = `blur(${((1.2 + (3.5 - 1.2) * amount) * inverseFill).toFixed(2)}px)`;
    const dx = x - this.previousX;
    const dy = y - this.previousY;
    if (this.hasPrevious && dx * dx + dy * dy >= .35 * .35) {
      context.beginPath();
      context.moveTo(this.previousX, this.previousY);
      context.lineTo(x, y);
      context.stroke();
    } else this.hasPrevious = true;
    context.filter = 'none';
    this.previousX = x;
    this.previousY = y;
    this.texture.needsUpdate = true;
  }

  resize(size: number) {
    const nextSize = Math.max(1, Math.round(size));
    if (this.disposed || nextSize === this.canvas.width) return;
    // Keep the CanvasTexture identity used by material uniforms. Reallocate GPU storage.
    this.texture.dispose();
    this.canvas.width = this.canvas.height = nextSize;
    this.hasPrevious = false;
    this.texture.needsUpdate = true;
  }

  clear() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.hasPrevious = false;
    this.texture.needsUpdate = true;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.texture.dispose();
    this.canvas.width = this.canvas.height = 1;
    this.hasPrevious = false;
  }
}
