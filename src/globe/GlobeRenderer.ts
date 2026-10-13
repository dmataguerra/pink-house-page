import {
  CanvasTexture, LinearFilter, LinearMipmapLinearFilter, MathUtils, Mesh, MeshBasicMaterial,
  NoBlending, NoColorSpace, OrthographicCamera, PlaneGeometry, RGBAFormat,
  Scene, ShaderMaterial, SphereGeometry, Texture, TextureLoader, Vector2,
  Vector3, WebGLRenderer, WebGLRenderTarget,
} from 'three';
import type { IUniform } from 'three';
import { blendFragmentShader, coronaFragmentShader, noiseFragmentShader, noiseVertexShader, vertexShader } from './shaders';
import { GlobeInteraction } from './interaction';
import { MouseTrail } from './trail';
import { projectGeographicMarker } from './projection';
import { selectGlobeQuality } from './quality';
import type { GlobeQuality } from './quality';

export type GlobeMarker = { id: string; latitude: number; longitude: number };
export type ProjectedMarker = { id: string; x: number; y: number; front: boolean };
export type GlobeCommand = 'left' | 'right' | 'up' | 'down' | 'closer' | 'farther' | 'reset' | 'refresh';
export type GlobePresentation = { rotationOffset: number; blur: number; active: boolean };
export type GlobeRendererOptions = {
  canvas: HTMLCanvasElement;
  mapUrl: string;
  markers: GlobeMarker[];
  onStatus?: (status: 'ready' | 'fallback') => void;
  onMarkers?: (markers: ProjectedMarker[]) => void;
  isFrozen?: () => boolean;
  onContextRestored?: () => void;
  onDragStart?: () => void;
  markerBounds?: { west: number; east: number; south: number; north: number };
  /** Keep the original continuous background animation when CSS moves it offscreen. */
  offscreenSuspension?: boolean;
};

type Uniforms = Record<string, IUniform>;
const uniform = (value: unknown): IUniform => ({ value });
const FRAME = 1 / 60;
const RADIUS = 1.56;

/** Geographic sphere → warped Worley → persistent corona → composite display plane. */
export class GlobeRenderer {
  private readonly options: GlobeRendererOptions;
  private readonly renderer!: WebGLRenderer;
  private readonly camera = new OrthographicCamera(-2.25, 2.25, 2.25, -2.25, .1, 2000);
  private readonly mapCamera = new OrthographicCamera(-2.25, 2.25, 2.25, -2.25, .1, 1000);
  private readonly passCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly mapScene = new Scene();
  private readonly noiseScene = new Scene();
  private readonly coronaScene = new Scene();
  private readonly finalScene = new Scene();
  private readonly sphereGeometry = new SphereGeometry(RADIUS, 32, 32);
  private readonly passGeometry = new PlaneGeometry(2, 2);
  private readonly finalGeometry = new PlaneGeometry(12, 12);
  private readonly mapMaterial = new MeshBasicMaterial({ color: 0xffffff });
  private readonly sphere = new Mesh(this.sphereGeometry, this.mapMaterial);
  private readonly noiseMaterial!: ShaderMaterial;
  private readonly coronaMaterial!: ShaderMaterial;
  private readonly blendMaterial!: ShaderMaterial;
  private readonly plane!: Mesh<PlaneGeometry, ShaderMaterial>;
  private readonly interaction!: GlobeInteraction;
  private readonly trail!: MouseTrail;
  private readonly motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly resizeObserver!: ResizeObserver;
  private readonly intersectionObserver!: IntersectionObserver;
  private quality!: GlobeQuality;
  private mapTarget!: WebGLRenderTarget;
  private noiseTarget!: WebGLRenderTarget;
  private coronaRead!: WebGLRenderTarget;
  private coronaWrite!: WebGLRenderTarget;
  private sharpMask!: CanvasTexture;
  private softMask!: CanvasTexture;
  private mapTexture: Texture | null = null;
  private frameCount = 0;
  private time = 0;
  private accumulator = 0;
  private previousTime = 0;
  private elapsedSinceRender = 0;
  private animationId = 0;
  private width = 1;
  private height = 1;
  private fillFactor = 1;
  private zoom = 1;
  private dirty = true;
  private visible = true;
  private disposed = false;
  private lost = false;
  private gpuReleased = false;
  private lifecycleDetached = false;
  private mapLoaded = false;
  private ready = false;
  private hoveredMarker: string | null = null;
  private projectedMarkers: ProjectedMarker[] = [];
  private readonly pulseNdc = new Vector3();
  private maskHalfHeight = Number.NaN;
  private presentationRotationOffset = 0;
  private presentationBlur = 0;
  private presentationActive = true;

  constructor(options: GlobeRendererOptions) {
    this.options = options;
    try {
      this.quality = selectGlobeQuality(this.motionPreference.matches);
      const context = options.canvas.getContext('webgl2', {
        alpha: true, antialias: !this.quality.reducedMotion, premultipliedAlpha: true,
        depth: true, stencil: false, preserveDrawingBuffer: false,
      });
      if (!context) throw new Error('The globe requires WebGL2.');
      this.renderer = new WebGLRenderer({ canvas: options.canvas, context, alpha: true, antialias: !this.quality.reducedMotion });
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.debug.checkShaderErrors = true;
      this.renderer.debug.onShaderError = (gl, program, vertexShader, fragmentShader) => {
        const details = [
          gl.getProgramInfoLog(program),
          gl.getShaderInfoLog(vertexShader),
          gl.getShaderInfoLog(fragmentShader),
        ].filter(Boolean).join(' | ') || 'Unknown WebGL program error.';
        console.error(`Globe shader program failed: ${details}`);
        this.fail();
      };
      this.noiseMaterial = this.material('NoiseMaterial', noiseVertexShader, noiseFragmentShader, {
        noisetype: uniform(2), noiseSeed: uniform(1234.5678), noiseScale: uniform(5),
        noiseSpeed: uniform(.04), noiseEvolveSpeed: uniform(1.3), time: uniform(0),
        uResolution: uniform(new Vector2(512, 512)), u_mouse: uniform(new Vector2(-10, -10)),
        u_mouseSpeed: uniform(0), uVelStrength: uniform(1), uVelTrail: uniform(.7),
        u_mouseDir: uniform(new Vector2(1, 0)), uMouseEnabled: uniform(1),
        uMouseStrength: uniform(1.5), uMouseRadius: uniform(.3), uMouseTrailTex: uniform(null),
        uPulseEnabled: uniform(1), uPulseCenter: uniform(new Vector2(-1, -1)),
        uPulseStrength: uniform(.6), uPulseRadius: uniform(.05), uPulseFrequency: uniform(1),
      });
      this.coronaMaterial = this.material('CoronaShaderMaterial', vertexShader, coronaFragmentShader, {
        iBuffer: uniform(null), iNoise: uniform(null), iGlobeSphere: uniform(null),
        uResolution: uniform(new Vector2(512, 512)), uFrameCount: uniform(0),
        uDisplaceFactor: uniform(.0015), uMixFactor: uniform(.06), uScaleFactor: uniform(.3),
        uExpandFactor: uniform(.4), uUvScale: uniform(1), uTime: uniform(0),
      });
      this.blendMaterial = this.material('BlendShaderMaterial', vertexShader, blendFragmentShader, {
        uResolution: uniform(new Vector2(512, 512)), uUvScale: uniform(1),
        tDiffuse: uniform(null), tDisplacementTexture: uniform(null), tGlobeSphere: uniform(null),
        tGlobeSphereSharp: uniform(null), tNoise: uniform(null),
        // Source uniforms are raw channel values, without Three.Color's sRGB conversion.
        uColor1: uniform(new Vector3(241 / 255, 19 / 255, 19 / 255)),
        uColor2: uniform(new Vector3(1, 63 / 255, 188 / 255)), uBackgroundColor: uniform(new Vector3()),
        levelsBlack: uniform(0), levelsWhite: uniform(1), gamma: uniform(1),
        mapStrength: uniform(.6), sphereInvert: uniform(1), sphereAdd: uniform(1), mapBlur: uniform(3),
        innerNoiseAmount: uniform(1.5), innerNoiseBlur: uniform(10), innerNoiseBlack: uniform(0),
        innerNoiseWhite: uniform(.8), innerNoiseGamma: uniform(1.6), uDebugView: uniform(0),
      });
      this.mapScene.add(this.sphere);
      this.noiseScene.add(new Mesh(this.passGeometry, this.noiseMaterial));
      this.coronaScene.add(new Mesh(this.passGeometry, this.coronaMaterial));
      this.plane = new Mesh(this.finalGeometry, this.blendMaterial);
      this.finalScene.add(this.plane);
      this.camera.position.set(0, 0, 4);
      this.camera.lookAt(0, 0, 0);
      this.camera.updateMatrixWorld();
      this.trail = new MouseTrail(this.quality.resolution);
      this.interaction = new GlobeInteraction({ canvas: options.canvas, camera: this.camera, plane: this.plane,
        mobile: this.quality.mobile, initialYaw: 0, initialPitch: 0,
        onDragStart: options.onDragStart,
        onChange: () => { this.dirty = true; this.schedule(); } });
      this.interaction.update(0, { reducedMotion: this.quality.reducedMotion, frozen: !!options.isFrozen?.() });
      this.resizeObserver = new ResizeObserver(this.resize);
      this.resizeObserver.observe(options.canvas.parentElement || options.canvas);
      this.intersectionObserver = new IntersectionObserver(entries => {
        if (this.options.offscreenSuspension === false) return;
        const entry = entries[0];
        if (!entry) return;
        this.visible = entry.isIntersecting;
        this.resetTiming();
        if (this.visible) this.schedule(); else this.cancelFrame();
      }, { rootMargin: '120px' });
      if (options.offscreenSuspension !== false) this.intersectionObserver.observe(options.canvas);
      this.motionPreference.addEventListener('change', this.onPreferenceChange);
      window.addEventListener('resize', this.resize, { passive: true });
      document.addEventListener('visibilitychange', this.onVisibility);
      options.canvas.addEventListener('webglcontextlost', this.onContextLost);
      options.canvas.addEventListener('webglcontextrestored', this.onContextRestored);
      this.resize();
      if (this.lost) throw new Error('Globe initialization failed.');
      const loader = new TextureLoader();
      const texture = loader.load(options.mapUrl, loaded => {
        if (this.disposed || this.lost) { loaded.dispose(); return; }
        loaded.colorSpace = NoColorSpace;
        loaded.minFilter = LinearMipmapLinearFilter;
        loaded.magFilter = LinearFilter;
        loaded.generateMipmaps = true;
        this.mapLoaded = true;
        this.dirty = true;
        this.schedule();
      }, undefined, () => this.fail());
      texture.colorSpace = NoColorSpace;
      this.mapTexture = texture;
      this.mapMaterial.map = texture;
      this.mapMaterial.needsUpdate = true;
      this.schedule();
    } catch (error) {
      // A failed constructor never reaches React's instance cleanup. Release even
      // partially initialized resources before returning control to the fallback.
      this.dispose();
      throw error;
    }
  }

  private material(name: string, vertex: string, fragment: string, uniforms: Uniforms): ShaderMaterial {
    return new ShaderMaterial({ name, vertexShader: vertex, fragmentShader: fragment, uniforms,
      blending: NoBlending, depthTest: false, depthWrite: false, toneMapped: false });
  }

  private target(size: number, depthBuffer = false): WebGLRenderTarget {
    return new WebGLRenderTarget(size, size, { format: RGBAFormat, minFilter: LinearFilter,
      magFilter: LinearFilter, generateMipmaps: false, depthBuffer, stencilBuffer: false });
  }

  private rebuildTargets(): void {
    this.mapTarget?.dispose(); this.noiseTarget?.dispose();
    this.coronaRead?.dispose(); this.coronaWrite?.dispose();
    const size = this.quality.resolution;
    this.mapTarget = this.target(size, true);
    this.noiseTarget = this.target(size);
    this.coronaRead = this.target(size);
    this.coronaWrite = this.target(size);
    this.trail.resize(size);
    for (const material of [this.noiseMaterial, this.coronaMaterial, this.blendMaterial]) {
      material.uniforms.uResolution.value.set(size, size);
    }
    this.noiseMaterial.uniforms.uMouseTrailTex.value = this.trail.texture;
    this.coronaMaterial.uniforms.iNoise.value = this.noiseTarget.texture;
    this.blendMaterial.uniforms.tDiffuse.value = this.mapTarget.texture;
    this.blendMaterial.uniforms.tNoise.value = this.noiseTarget.texture;
    this.clearFeedback();
  }

  private rebuildMasks(resetFeedback = true): void {
    this.sharpMask?.dispose(); this.softMask?.dispose();
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d');
    const blurred = document.createElement('canvas');
    blurred.width = blurred.height = size;
    const blurContext = blurred.getContext('2d');
    if (!context || !blurContext) throw new Error('Canvas masks require a 2D context.');
    context.fillStyle = '#000'; context.fillRect(0, 0, size, size);
    context.fillStyle = '#fff'; context.beginPath();
    context.arc(size / 2, size / 2, size * Math.min(.5, .5 * RADIUS / this.mapCamera.top), 0, Math.PI * 2);
    context.fill();
    blurContext.fillStyle = '#000'; blurContext.fillRect(0, 0, size, size);
    blurContext.filter = `blur(${7 + this.presentationBlur}px)`; blurContext.drawImage(canvas, 0, 0); blurContext.filter = 'none';
    this.sharpMask = new CanvasTexture(canvas);
    this.softMask = new CanvasTexture(blurred);
    for (const texture of [this.sharpMask, this.softMask]) {
      texture.minFilter = texture.magFilter = LinearFilter;
      texture.generateMipmaps = false;
      texture.colorSpace = NoColorSpace;
    }
    this.coronaMaterial.uniforms.iGlobeSphere.value = this.softMask;
    this.blendMaterial.uniforms.tGlobeSphere.value = this.softMask;
    this.blendMaterial.uniforms.tGlobeSphereSharp.value = this.sharpMask;
    this.maskHalfHeight = this.mapCamera.top;
    if (resetFeedback) this.clearFeedback();
  }

  private clearFeedback(): void {
    this.frameCount = 0;
    this.accumulator = 0;
    if (!this.coronaRead || !this.coronaWrite) return;
    this.renderer.setRenderTarget(this.coronaRead); this.renderer.clear();
    this.renderer.setRenderTarget(this.coronaWrite); this.renderer.clear();
    this.renderer.setRenderTarget(null);
  }

  private readonly resize = (): void => {
    if (this.disposed || this.lost) return;
    try {
      const canvas = this.options.canvas;
      // CSS entrance/mobile scaling affects screen-space pointer coordinates,
      // but must not be baked into the backing buffer or DOM projection again.
      this.width = Math.max(1, canvas.clientWidth || canvas.parentElement?.clientWidth || 1);
      this.height = Math.max(1, canvas.clientHeight || canvas.parentElement?.clientHeight || 1);
      const nextQuality = selectGlobeQuality(this.motionPreference.matches);
      const resizeTargets = !this.mapTarget || nextQuality.resolution !== this.quality.resolution;
      this.quality = nextQuality;
      this.interaction.setMobile(this.quality.mobile);
      this.renderer.setPixelRatio(this.quality.pixelRatio);
      this.renderer.setSize(this.width, this.height, false);
      const halfHeight = (this.quality.mobile ? 2 : 2.25) / this.zoom;
      const aspect = this.width / this.height;
      this.camera.left = -halfHeight * aspect; this.camera.right = halfHeight * aspect;
      this.camera.top = halfHeight; this.camera.bottom = -halfHeight;
      const z = window.innerWidth < 700 ? 5.5 : 4;
      this.camera.position.z = z;
      this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
      this.mapCamera.left = this.mapCamera.bottom = -halfHeight;
      this.mapCamera.right = this.mapCamera.top = halfHeight;
      this.mapCamera.position.set(0, 0, z); this.mapCamera.lookAt(0, 0, 0);
      this.mapCamera.updateProjectionMatrix(); this.mapCamera.updateMatrixWorld();
      const squareSize = 2 * halfHeight * Math.max(1, aspect);
      this.plane.scale.set(squareSize / 12, squareSize / 12, 1);
      this.plane.lookAt(this.camera.position); this.plane.updateMatrixWorld();
      this.fillFactor = Math.max(aspect, 1 / aspect);
      if (resizeTargets) this.rebuildTargets();
      if (!this.sharpMask || this.maskHalfHeight !== halfHeight) this.rebuildMasks();
      this.pushUniforms();
      this.dirty = true;
      this.resetTiming();
      this.schedule();
    } catch { this.fail(); }
  };

  private pushUniforms(): void {
    const F = this.fillFactor;
    const n = this.noiseMaterial.uniforms;
    n.noiseScale.value = 5 * F;
    n.uMouseRadius.value = .3 / F;
    n.uVelTrail.value = this.quality.trailAmount / F;
    n.uMouseEnabled.value = this.quality.reducedMotion ? 0 : 1;
    n.uPulseEnabled.value = this.quality.reducedMotion ? 0 : 1;
    n.uPulseRadius.value = .05 / F;
    const c = this.coronaMaterial.uniforms;
    c.uUvScale.value = F;
    c.uExpandFactor.value = this.hoveredMarker ? .2 : .4;
    c.uDisplaceFactor.value = this.hoveredMarker ? .001 : .0015;
    const b = this.blendMaterial.uniforms;
    b.uUvScale.value = F;
    b.mapBlur.value = (3 + this.presentationBlur) / F;
    b.innerNoiseBlur.value = 10 * this.quality.resolution / Math.max(1, Math.min(this.options.canvas.width, this.options.canvas.height)) / F;
  }

  private updateMarkers(): void {
    const radius = RADIUS * Math.min(1, this.width / this.height);
    this.projectedMarkers = this.options.markers.map(marker => {
      const point = projectGeographicMarker(marker.latitude, marker.longitude, {
        yaw: this.interaction.yaw + this.presentationRotationOffset, pitch: this.interaction.pitch, roll: this.interaction.roll,
        radius, camera: this.camera, width: this.width, height: this.height,
        bounds: this.options.markerBounds,
      });
      return { id: marker.id, ...point, y: this.quality.mobile ? this.height / 2 + (point.y - this.height / 2) * .8 : point.y };
    });
    this.options.onMarkers?.(this.projectedMarkers);
  }

  private setPulse(): void {
    const center = this.noiseMaterial.uniforms.uPulseCenter.value as Vector2;
    const marker = this.projectedMarkers.find(point => point.id === this.hoveredMarker);
    if (!marker || this.quality.reducedMotion) { center.set(-1, -1); return; }
    // Convert DOM ring screen position to the same top-down square-plane UV as the pointer.
    this.pulseNdc.set(marker.x / this.width * 2 - 1, 1 - marker.y / this.height * 2, 0).unproject(this.camera);
    this.plane.worldToLocal(this.pulseNdc);
    center.set(this.pulseNdc.x / 12 + .5, .5 - this.pulseNdc.y / 12);
  }

  private render(dt: number, steps: number, frozen = !!this.options.isFrozen?.()): void {
    const effectsPaused = this.quality.reducedMotion || frozen;
    this.interaction.update(dt, { reducedMotion: this.quality.reducedMotion, frozen, hover: !!this.hoveredMarker });
    this.sphere.rotation.set(MathUtils.degToRad(this.interaction.pitch), MathUtils.degToRad(this.interaction.yaw + this.presentationRotationOffset) - Math.PI / 2, MathUtils.degToRad(this.interaction.roll));
    if (!effectsPaused) this.trail.update(dt, { motion: this.interaction.motion, trailAmount: this.quality.trailAmount,
      mouseRadius: .3, fillFactor: this.fillFactor, enabled: true });
    const n = this.noiseMaterial.uniforms;
    n.u_mouse.value.copy(this.interaction.motion.position);
    n.u_mouseSpeed.value = this.interaction.motion.speed;
    n.u_mouseDir.value.copy(this.interaction.motion.direction);
    n.uMouseTrailTex.value = this.trail.texture;
    this.updateMarkers(); this.setPulse(); this.pushUniforms();
    this.renderer.setRenderTarget(this.mapTarget);
    this.renderer.render(this.mapScene, this.mapCamera);
    if (this.lost || this.disposed) return;
    if (!effectsPaused) this.time += dt;
    for (let step = 0; step < steps; step += 1) {
      // The procedural clock remains elapsed-time based; only the nonlinear
      // feedback recurrence is fixed at 60 Hz. Bounded steps avoid stall backlogs.
      const stepTime = effectsPaused ? this.time : Math.max(0, this.time - this.accumulator - (steps - 1 - step) * FRAME);
      n.time.value = stepTime;
      this.renderer.setRenderTarget(this.noiseTarget);
      this.renderer.render(this.noiseScene, this.passCamera);
      if (this.lost || this.disposed) return;
      const c = this.coronaMaterial.uniforms;
      c.iBuffer.value = this.coronaRead.texture;
      c.uTime.value = stepTime; c.uFrameCount.value = ++this.frameCount;
      this.renderer.setRenderTarget(this.coronaWrite);
      this.renderer.render(this.coronaScene, this.passCamera);
      if (this.lost || this.disposed) return;
      const previous = this.coronaRead; this.coronaRead = this.coronaWrite; this.coronaWrite = previous;
    }
    // Portable correction: show the newest feedback output, instead of Nike's fixed-A sampler.
    this.blendMaterial.uniforms.tDisplacementTexture.value = this.coronaRead.texture;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.finalScene, this.camera);
    if (this.lost || this.disposed) return;
    this.dirty = false;
    if (this.mapLoaded && !this.ready && !this.lost) { this.ready = true; this.options.onStatus?.('ready'); }
    this.updateDiagnostics(steps);
  }

  private updateDiagnostics(steps: number): void {
    // Cheap read-only state makes architecture/physics checks possible without GPU interception.
    const canvas = this.options.canvas;
    canvas.dataset.engine = 'three.js r182';
    canvas.dataset.globePipeline = 'sphere>noise>corona>composite';
    canvas.dataset.globeQuality = this.quality.name;
    canvas.dataset.globeResolution = String(this.quality.resolution);
    canvas.dataset.globeYaw = this.interaction.yaw.toFixed(4);
    canvas.dataset.globeEffectiveYaw = (this.interaction.yaw + this.presentationRotationOffset).toFixed(4);
    canvas.dataset.globePresentationActive = String(this.presentationActive);
    canvas.dataset.globePresentationBlur = this.presentationBlur.toFixed(4);
    canvas.dataset.globePitch = this.interaction.pitch.toFixed(4);
    canvas.dataset.globeTime = this.time.toFixed(4);
    canvas.dataset.globeSpeed = this.interaction.motion.speed.toFixed(4);
    canvas.dataset.globeMouse = `${this.interaction.motion.position.x.toFixed(4)},${this.interaction.motion.position.y.toFixed(4)}`;
    canvas.dataset.globeFeedbackFrame = String(this.frameCount);
    canvas.dataset.globeDraws = String(2 + 2 * steps);
    canvas.dataset.globeFrozen = String(!!this.options.isFrozen?.());
  }

  private readonly animate = (now: number): void => {
    this.animationId = 0;
    if (this.disposed || this.lost || !this.visible || document.hidden) { this.resetTiming(); return; }
    const dt = this.previousTime ? Math.max(0, (now - this.previousTime) / 1000) : FRAME;
    this.previousTime = now;
    this.elapsedSinceRender += dt;
    try {
      const frozen = !!this.options.isFrozen?.();
      if (this.quality.reducedMotion || frozen) {
        // Polling an application pause may continue, but no GPU work, clock
        // advance, trail fading, or feedback advance occurs while it is still.
        this.interaction.update(0, { reducedMotion: this.quality.reducedMotion, frozen, hover: !!this.hoveredMarker });
        this.accumulator = 0;
        if (this.dirty || this.interaction.dragging) {
          this.render(0, this.frameCount === 0 ? 1 : 0, frozen);
        }
        this.elapsedSinceRender = 0;
      } else {
        this.accumulator = Math.min(4 * FRAME, this.accumulator + dt);
        const steps = Math.floor((this.accumulator + 1e-7) / FRAME);
        if (steps > 0) {
          this.accumulator -= steps * FRAME;
          this.render(this.elapsedSinceRender, steps, false);
          this.elapsedSinceRender = 0;
        }
      }
    } catch { this.fail(); }
    if (!this.quality.reducedMotion || this.interaction.dragging) this.schedule();
    else this.resetTiming();
  };

  private schedule(): void {
    if (!this.animationId && !this.disposed && !this.lost && this.visible && !document.hidden) this.animationId = requestAnimationFrame(this.animate);
  }
  private cancelFrame(): void { if (this.animationId) cancelAnimationFrame(this.animationId); this.animationId = 0; }
  private resetTiming(): void { this.previousTime = 0; this.accumulator = 0; this.elapsedSinceRender = 0; }
  private readonly onVisibility = (): void => { this.resetTiming(); if (document.hidden) this.cancelFrame(); else this.schedule(); };
  private readonly onPreferenceChange = (): void => {
    if (this.disposed || this.lost) return;
    this.trail.clear(); this.interaction.reset(this.interaction.yaw, this.interaction.pitch); this.resize();
  };
  private readonly onContextLost = (event: Event): void => { event.preventDefault(); this.fail(); };
  private readonly onContextRestored = (): void => { if (!this.disposed && this.lost) this.options.onContextRestored?.(); };
  private fail(): void {
    if (this.disposed || this.lost) return;
    this.lost = true;
    this.cancelFrame();
    this.detachLifecycle();
    this.options.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.interaction?.dispose();
    // Shader failures can arrive during Three's program binding. Release after
    // that call returns, and retain only the restoration listener for React.
    queueMicrotask(() => this.releaseGPUResources());
    this.options.onStatus?.('fallback');
  }

  setMarkerHover(id: string | null): void { this.hoveredMarker = id; this.dirty = true; this.schedule(); }

  setPresentation({ rotationOffset, blur, active }: GlobePresentation): void {
    if (this.disposed || this.lost) return;
    const offset = Number.isFinite(rotationOffset) ? rotationOffset : 0;
    const amount = Number.isFinite(blur) ? Math.max(0, blur) : 0;
    const blurChanged = amount !== this.presentationBlur;
    if (!blurChanged && offset === this.presentationRotationOffset && active === this.presentationActive) return;
    this.presentationRotationOffset = offset;
    this.presentationBlur = amount;
    this.presentationActive = active;
    if (!active) this.hoveredMarker = null;
    try {
      // Scroll replaces the source masks while the existing feedback continues
      // evolving, so atmosphere history survives the reveal choreography.
      if (blurChanged) this.rebuildMasks(false);
      this.pushUniforms();
      this.dirty = true;
      this.schedule();
    } catch { this.fail(); }
  }

  command(action: GlobeCommand): void {
    if (this.disposed || this.lost) return;
    switch (action) {
      case 'left': this.interaction.rotateBy(-16, 0); break;
      case 'right': this.interaction.rotateBy(16, 0); break;
      case 'up': this.interaction.rotateBy(0, -12); break;
      case 'down': this.interaction.rotateBy(0, 12); break;
      case 'closer': this.zoom = Math.min(1.18, this.zoom + .06); this.resize(); break;
      case 'farther': this.zoom = Math.max(.82, this.zoom - .06); this.resize(); break;
      case 'reset': this.interaction.reset(); this.zoom = 1; this.trail.clear(); this.resize(); break;
      // Application focus/dialog changes invalidate the view without erasing
      // the persistent atmosphere or the pointer history being paused.
      case 'refresh': break;
    }
    this.dirty = true; this.schedule();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelFrame();
    this.detachLifecycle();
    this.options.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.options.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.releaseGPUResources();
  }

  private detachLifecycle(): void {
    if (this.lifecycleDetached) return;
    this.lifecycleDetached = true;
    this.resizeObserver?.disconnect(); this.intersectionObserver?.disconnect();
    this.motionPreference.removeEventListener('change', this.onPreferenceChange);
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  private releaseGPUResources(): void {
    if (this.gpuReleased) return;
    this.gpuReleased = true;
    this.interaction?.dispose(); this.trail?.dispose();
    this.mapTarget?.dispose(); this.noiseTarget?.dispose(); this.coronaRead?.dispose(); this.coronaWrite?.dispose();
    this.sharpMask?.dispose(); this.softMask?.dispose(); this.mapTexture?.dispose();
    this.sphereGeometry.dispose(); this.passGeometry.dispose(); this.finalGeometry.dispose();
    this.mapMaterial.dispose(); this.noiseMaterial?.dispose(); this.coronaMaterial?.dispose(); this.blendMaterial?.dispose();
    this.mapScene.clear(); this.noiseScene.clear(); this.coronaScene.clear(); this.finalScene.clear();
    this.renderer?.dispose();
  }
}
