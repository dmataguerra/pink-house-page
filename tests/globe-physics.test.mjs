import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { dirname, resolve } from 'node:path';
import { build } from 'esbuild';
import { Euler, Mesh, MeshBasicMaterial, OrthographicCamera, PlaneGeometry, Raycaster, SphereGeometry, Vector2, Vector3 } from 'three';

// Exercise the shipped TypeScript modules without a browser or generated files.
async function loadSource(relativePath) {
  const filename = resolve(relativePath);
  const result = await build({ entryPoints: [filename], bundle: true, write: false,
    platform: 'node', format: 'cjs', external: ['three'] });
  const sourceModule = new Module(filename);
  sourceModule.filename = filename;
  sourceModule.paths = Module._nodeModulePaths(dirname(filename));
  sourceModule._compile(result.outputFiles[0].text, filename);
  return sourceModule.exports;
}

const { PointerMotion, GlobeInteraction, bindPointerTracking } = await loadSource('src/globe/interaction.ts');
const { geographicPosition, projectGeographicMarker } = await loadSource('src/globe/projection.ts');
const { MouseTrail } = await loadSource('src/globe/trail.ts');
const near = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance,
  `Expected ${actual} to be within ${tolerance} of ${expected}`);

class TrackedTarget extends EventTarget {
  listeners = new Map();
  addEventListener(type, callback, options) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
    super.addEventListener(type, callback, options);
  }
  removeEventListener(type, callback, options) {
    this.listeners.get(type)?.delete(callback);
    super.removeEventListener(type, callback, options);
  }
  get listenerCount() { return [...this.listeners.values()].reduce((sum, listeners) => sum + listeners.size, 0); }
}

class CanvasStub extends TrackedTarget {
  style = { touchAction: 'manipulation' };
  captures = new Set();
  rect = { left: 10, top: 20, width: 450, height: 450 };
  constructor(eventWindow) { super(); this.ownerDocument = { defaultView: eventWindow }; }
  getBoundingClientRect() { return this.rect; }
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) { this.captures.delete(id); }
}

function createRig(options = {}) {
  const eventWindow = new TrackedTarget();
  const canvas = new CanvasStub(eventWindow);
  const camera = new OrthographicCamera(-2.25, 2.25, 2.25, -2.25, .1, 100);
  camera.position.set(0, 0, 4);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const plane = new Mesh(new PlaneGeometry(4.5, 4.5), new MeshBasicMaterial());
  const interaction = new GlobeInteraction({ canvas, camera, plane, isUI: () => false, ...options });
  return { eventWindow, canvas, camera, plane, interaction, dispose() {
    interaction.dispose(); plane.geometry.dispose(); plane.material.dispose();
  } };
}

function pointer(target, type, { x = 100, y = 100, id = 7, pointerType = 'mouse' } = {}) {
  const event = new Event(type);
  Object.assign(event, { clientX: x, clientY: y, pointerId: id, pointerType, button: 0, isPrimary: true });
  target.dispatchEvent(event);
}

test('first valid UV establishes position without an entry spike; movement uses recovered filters', () => {
  const motion = new PointerMotion();
  motion.position.set(.1, .1);
  motion.update(.1);
  assert.equal(motion.speed, 0);
  assert.equal(motion.velocity.length(), 0);
  assert.deepEqual(motion.previous.toArray(), [.1, .1]);
  motion.position.set(1, 1);
  motion.update(.1);
  const boundedVelocity = 6 * (1 - Math.exp(-1));
  near(motion.velocity.x, boundedVelocity);
  near(motion.velocity.y, boundedVelocity);
  near(motion.speed, 1 - Math.exp(-.4));
  near(motion.direction.length(), 1);
  near(motion.directionTarget.x, Math.SQRT1_2);
  near(motion.directionTarget.y, Math.SQRT1_2);
});

test('jitter is suppressed and a stopped pointer retains its last direction and UV', () => {
  const motion = new PointerMotion();
  motion.position.set(.5, .5);
  motion.update(.1);
  motion.position.x += .001;
  motion.update(.1); // .01 UV/s is below the .02 jitter threshold.
  assert.equal(motion.speed, 0);
  assert.equal(motion.velocity.length(), 0);
  motion.position.set(.4, .4);
  motion.update(.1);
  const directionTarget = motion.directionTarget.clone();
  const pointerUV = motion.position.clone();
  for (let frame = 0; frame < 600; frame++) motion.update(1 / 60);
  assert.deepEqual(motion.position.toArray(), pointerUV.toArray());
  assert.deepEqual(motion.directionTarget.toArray(), directionTarget.toArray());
  near(motion.direction.distanceTo(directionTarget), 0, 1e-9);
  assert.ok(motion.speed < 1e-5);
});

test('velocity, speed-fall, and invalid-UV decay match their documented exponential constants', () => {
  const motion = new PointerMotion();
  motion.position.set(.5, .5);
  motion.previous.copy(motion.position);
  motion.velocity.set(.5, 0);
  motion.speed = .8;
  motion.update(.2);
  const velocity = .5 * Math.exp(-2);
  near(motion.velocity.x, velocity);
  near(motion.speed, .8 + (velocity / 1.2 - .8) * (1 - Math.exp(-1.4 * .2)));
  const previousVelocity = motion.velocity.x;
  const previousSpeed = motion.speed;
  motion.position.set(-10, -10);
  motion.update(.25);
  near(motion.velocity.x, previousVelocity * Math.exp(-2.5));
  near(motion.speed, previousSpeed * Math.exp(-2.5));
  assert.deepEqual(motion.previous.toArray(), [-10, -10]);
});

test('automatic rotation advances 6 degrees per second independently of update cadence', () => {
  const one = createRig();
  const many = createRig();
  try {
    one.interaction.update(10);
    for (let frame = 0; frame < 600; frame++) many.interaction.update(1 / 60);
    near(one.interaction.yaw, 60);
    near(many.interaction.yaw, 60, 1e-8);
    one.interaction.update(1, { hover: true });
    near(one.interaction.yaw, 60);
    one.interaction.update(1, { frozen: true });
    near(one.interaction.yaw, 60);
  } finally { one.dispose(); many.dispose(); }
});

test('release inertia uses exp(-7.5 dt), source Euler angle integration, and the .01 cutoff', () => {
  const rig = createRig();
  try {
    const interaction = rig.interaction;
    interaction.autoRotateEnabled = false;
    interaction.spinVelocity.set(-20, 120);
    interaction.update(.1);
    near(interaction.pitch, -2);
    near(interaction.yaw, 12);
    near(interaction.spinVelocity.x, -20 * Math.exp(-.75));
    near(interaction.spinVelocity.y, 120 * Math.exp(-.75));
    for (let frame = 0; frame < 120; frame++) interaction.update(1 / 60);
    assert.equal(interaction.spinVelocity.length(), 0);
  } finally { rig.dispose(); }
});

test('drag rotates .22/.18 degrees per pixel, captures input, and cancellation restores state', () => {
  let dragStarts = 0;
  const rig = createRig({ onDragStart: () => dragStarts++ });
  try {
    pointer(rig.canvas, 'pointerdown');
    assert.equal(rig.interaction.dragging, true);
    assert.equal(rig.interaction.autoRotateEnabled, false);
    assert.equal(rig.canvas.hasPointerCapture(7), true);
    pointer(rig.eventWindow, 'pointermove', { x: 200, y: 150 });
    near(rig.interaction.yaw, 22);
    near(rig.interaction.pitch, 9);
    assert.ok(rig.interaction.spinVelocity.y > 0);
    pointer(rig.eventWindow, 'pointercancel');
    assert.equal(rig.interaction.dragging, false);
    assert.equal(rig.interaction.autoRotateEnabled, true);
    assert.equal(rig.interaction.spinVelocity.length(), 0);
    assert.equal(rig.canvas.captures.size, 0);
    assert.equal(dragStarts, 1);
  } finally { rig.dispose(); }
});

test('touch reserves vertical scroll and starts horizontal drag only after 8px intent', () => {
  const rig = createRig({ mobile: true });
  try {
    assert.equal(rig.canvas.style.touchAction, 'pan-y');
    pointer(rig.canvas, 'pointerdown', { pointerType: 'touch' });
    pointer(rig.eventWindow, 'pointermove', { x: 107, y: 102, pointerType: 'touch' });
    assert.equal(rig.interaction.dragging, false);
    assert.equal(rig.canvas.captures.size, 0);
    pointer(rig.eventWindow, 'pointermove', { x: 109, y: 102, pointerType: 'touch' });
    assert.equal(rig.interaction.dragging, true);
    near(rig.interaction.yaw, 9 * .22);
    near(rig.interaction.pitch, 0);
    pointer(rig.eventWindow, 'pointerup', { pointerType: 'touch' });
    const yaw = rig.interaction.yaw;
    pointer(rig.canvas, 'pointerdown', { id: 8, pointerType: 'touch' });
    pointer(rig.eventWindow, 'pointermove', { x: 102, y: 112, id: 8, pointerType: 'touch' });
    assert.equal(rig.interaction.dragging, false);
    assert.equal(rig.canvas.captures.size, 0);
    near(rig.interaction.yaw, yaw);
  } finally { rig.dispose(); }
});

test('reduced motion freezes autonomous effects while commands and direct drag remain usable', () => {
  const rig = createRig();
  try {
    rig.interaction.motion.position.set(.5, .5);
    rig.interaction.motion.speed = 1;
    rig.interaction.spinVelocity.set(10, 20);
    rig.interaction.update(1, { reducedMotion: true });
    assert.equal(rig.interaction.yaw, 0);
    assert.equal(rig.interaction.pitch, 0);
    assert.equal(rig.interaction.motion.speed, 0);
    const point = rig.interaction.motion.position.clone();
    pointer(rig.eventWindow, 'pointermove', { x: 400, y: 300 });
    assert.deepEqual(rig.interaction.motion.position.toArray(), point.toArray());
    rig.interaction.rotateBy(16, -12);
    near(rig.interaction.yaw, 16);
    near(rig.interaction.pitch, -12);
    rig.interaction.update(1, { reducedMotion: true, frozen: true });
    pointer(rig.canvas, 'pointerdown');
    pointer(rig.eventWindow, 'pointermove', { x: 150, y: 100 });
    near(rig.interaction.yaw, 27);
    pointer(rig.eventWindow, 'pointerup');
    assert.equal(rig.interaction.spinVelocity.length(), 0);
  } finally { rig.dispose(); }
});

test('pointer raycasting hits black square corners where the geographic sphere has no intersection', () => {
  const rig = createRig();
  const motion = new PointerMotion();
  const tracking = bindPointerTracking({ ...rig, motion });
  const sphere = new Mesh(new SphereGeometry(1.56, 32, 32), new MeshBasicMaterial());
  try {
    assert.equal(tracking.sample(420, 80), true);
    near(motion.position.x, 410 / 450);
    near(motion.position.y, 60 / 450);
    const raycaster = new Raycaster();
    raycaster.setFromCamera(new Vector2(2 * 410 / 450 - 1, 1 - 2 * 60 / 450), rig.camera);
    sphere.updateMatrixWorld();
    assert.equal(raycaster.intersectObject(sphere).length, 0);
  } finally { tracking.dispose(); sphere.geometry.dispose(); sphere.material.dispose(); rig.dispose(); }
});

test('cropped square extensions accept UV hits outside the canvas rect; miss and exit retain UV', () => {
  const rig = createRig();
  const motion = new PointerMotion();
  const hits = [];
  rig.canvas.rect.width = 900;
  rig.camera.left = -4.5;
  rig.camera.right = 4.5;
  rig.camera.updateProjectionMatrix();
  rig.plane.scale.setScalar(2);
  const tracking = bindPointerTracking({ ...rig, motion, onHit: valid => hits.push(valid) });
  try {
    assert.equal(tracking.sample(460, -80), true);
    assert.ok(motion.position.y > 0 && motion.position.y < 1);
    const lastUV = motion.position.clone();
    assert.equal(tracking.sample(460, -500), false);
    rig.eventWindow.dispatchEvent(new Event('mouseleave'));
    assert.deepEqual(motion.position.toArray(), lastUV.toArray());
    assert.deepEqual(hits, [true, false, false]);
  } finally { tracking.dispose(); rig.dispose(); }
});

test('marker geography aligns with actual sphere UV vertices after source -90 degree yaw correction', () => {
  const geometry = new SphereGeometry(1.56, 32, 32);
  const camera = new OrthographicCamera(-2.25, 2.25, 2.25, -2.25, .1, 100);
  camera.position.set(0, 0, 4);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const syntheticBounds = { west: 10, east: 30, south: 40, north: 60 };
  try {
    for (const index of [8 * 33 + 13, 12 * 33 + 17, 16 * 33 + 20, 20 * 33 + 22]) {
      const u = geometry.attributes.uv.getX(index);
      const v = geometry.attributes.uv.getY(index);
      const latitude = 180 * v - 90;
      const longitude = (u - .5) * 360;
      for (const yaw of [-15, 0, 18]) {
        const pitch = 12;
        const spherePoint = new Vector3().fromBufferAttribute(geometry.attributes.position, index);
        spherePoint.applyEuler(new Euler(pitch * Math.PI / 180, yaw * Math.PI / 180 - Math.PI / 2, 0));
        const markerPoint = geographicPosition(latitude, longitude).applyEuler(new Euler(pitch * Math.PI / 180, yaw * Math.PI / 180, 0));
        assert.ok(markerPoint.distanceTo(spherePoint) < 1e-7);
        const geographic = projectGeographicMarker(latitude, longitude, { yaw, pitch, camera, width: 900, height: 900 });
        const local = projectGeographicMarker(syntheticBounds.south + v * 20, syntheticBounds.west + u * 20,
          { yaw, pitch, camera, width: 900, height: 900, bounds: syntheticBounds });
        near(geographic.x, local.x);
        near(geographic.y, local.y);
        assert.equal(geographic.front, local.front);
      }
    }
  } finally { geometry.dispose(); }
});

test('rear-facing markers remain at the projected rim, including an antipodal point', () => {
  const camera = new OrthographicCamera(-2.25, 2.25, 2.25, -2.25, .1, 100);
  camera.position.set(0, 0, 4);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  for (const [latitude, longitude] of [[0, 180], [25, 140], [-35, -160]]) {
    const marker = projectGeographicMarker(latitude, longitude, { yaw: 0, camera, width: 900, height: 900 });
    assert.equal(marker.front, false);
    near(Math.hypot(marker.x - 450, marker.y - 450), 1.56 * 900 / 4.5, 1e-8);
    assert.ok(Number.isFinite(marker.x) && Number.isFinite(marker.y));
  }
});

test('interaction disposal releases capture, restores touch-action, and removes every listener', () => {
  let changes = 0;
  const rig = createRig({ onChange: () => changes++ });
  pointer(rig.canvas, 'pointerdown');
  assert.ok(rig.eventWindow.listenerCount > 0 && rig.canvas.listenerCount > 0);
  rig.interaction.dispose();
  assert.equal(rig.canvas.captures.size, 0);
  assert.equal(rig.canvas.style.touchAction, 'manipulation');
  assert.equal(rig.eventWindow.listenerCount, 0);
  assert.equal(rig.canvas.listenerCount, 0);
  const disposedChanges = changes;
  pointer(rig.canvas, 'pointerdown');
  pointer(rig.eventWindow, 'pointermove', { x: 300 });
  rig.interaction.dispose();
  assert.equal(changes, disposedChanges);
  rig.dispose();
});

test('trail uses source decay, paints moving segments only, and reallocates/disposes its GPU texture', () => {
  const previousDocument = globalThis.document;
  const context = {
    fills: [], strokes: [], clears: [],
    clearRect(...args) { this.clears.push(args); },
    fillRect(...args) { this.fills.push({ args, style: this.fillStyle, operation: this.globalCompositeOperation }); },
    beginPath() {}, moveTo(x, y) { this.start = [x, y]; }, lineTo(x, y) { this.end = [x, y]; },
    stroke() { this.strokes.push({ start: this.start, end: this.end, filter: this.filter, width: this.lineWidth, style: this.strokeStyle }); },
  };
  const canvas = { width: 0, height: 0, getContext: () => context };
  globalThis.document = { createElement: () => canvas };
  let trail;
  try {
    trail = new MouseTrail(512);
    let disposals = 0;
    trail.texture.addEventListener('dispose', () => disposals++);
    const motion = new PointerMotion();
    motion.position.set(.5, .5);
    motion.speed = .5;
    const options = { motion, trailAmount: .7, mouseRadius: .3, fillFactor: 2, enabled: true };
    trail.update(.1, options);
    const opacity = Number(context.fills[0].style.slice('rgba(0,0,0,'.length, -1));
    near(opacity, 1 - Math.exp(-.775 * .1));
    assert.equal(context.fills[0].operation, 'source-over');
    assert.equal(context.strokes.length, 0);
    trail.update(.1, options);
    assert.equal(context.strokes.length, 0);
    motion.position.x += 1 / 512;
    trail.update(.1, options);
    assert.equal(context.strokes.length, 1);
    assert.deepEqual(context.strokes[0].start, [256, 256]);
    assert.deepEqual(context.strokes[0].end, [257, 256]);
    near(context.strokes[0].width, .3 / 2 * 512 * .33 * 1.4);
    assert.equal(context.strokes[0].filter, 'blur(1.40px)');
    assert.equal(context.filter, 'none');
    const texture = trail.texture;
    trail.resize(320);
    assert.equal(trail.texture, texture);
    assert.equal(canvas.width, 320);
    assert.equal(disposals, 1);
    trail.update(.1, options);
    assert.equal(context.strokes.length, 1); // Resizing resets the previous stroke point.
    trail.dispose();
    trail.dispose();
    assert.equal(disposals, 2);
    assert.equal(canvas.width, 1);
  } finally { trail?.dispose(); globalThis.document = previousDocument; }
});
