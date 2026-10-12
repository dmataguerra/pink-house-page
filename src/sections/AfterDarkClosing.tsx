import { useEffect, useRef, useState } from 'react';
import './AfterDarkClosing.css';

type AfterDarkClosingProps = {
  onConfirm: () => void;
  onSchedule: () => void;
  onMap?: () => void;
};

// This regional map uses the same supplied points as the existing aerial video.
// Its local geography is expanded over a sphere; these are not global latitudes.
const mapBounds = { west: -100.4534, east: -100.4374, south: 20.6988, north: 20.7138 };
const locations = [
  { id: 'uaq', label: 'UAQ', latitude: 20.70438308336931, longitude: -100.44387705896915 },
  { id: 'uvm', label: 'UVM', latitude: 20.70827004638903, longitude: -100.4453510329209 },
  { id: 'enes', label: 'ENES', latitude: 20.705875489620908, longitude: -100.44812312985161 },
  { id: 'house', label: 'THE PINK HOUSE', latitude: 20.707390681241908, longitude: -100.44438633247219 },
];
const mapTexture = `${import.meta.env.BASE_URL}images/juriquilla-map.svg`;
const vertexShader = `
attribute vec2 position;
varying vec2 uv;
void main() { uv = position * .5 + .5; gl_Position = vec4(position, 0., 1.); }
`;
const fragmentShader = `
precision highp float;
varying vec2 uv;
uniform sampler2D geography;
uniform vec2 rotation;
uniform float time;
const float PI = 3.14159265359;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
}
float haze(vec2 p) {
  return noise(p * 2.3 + vec2(time * .018, -time * .012)) * .6
    + noise(p * 5.1 - vec2(time * .01, time * .016)) * .3
    + noise(p * 11. + time * .008) * .1;
}
void main() {
  vec2 p = uv * 2. - 1.;
  float radius = length(p);
  float halo = exp(-pow(max(length(p - vec2(0., -.04)) - .55, 0.), 2.) * 12.) * .38;
  float bloom = exp(-(p.x * p.x / .27 + pow(p.y + .68, 2.) / .115)) * .42;
  if (radius > .724) {
    float edgeFade = 1. - smoothstep(.84, 1., radius);
    gl_FragColor = vec4(mix(vec3(1., .30, .02), vec3(1., .72, .16), bloom * 2.), min(halo + bloom, .8) * edgeFade);
    return;
  }
  vec2 face = p / .72;
  vec3 normal = vec3(face, sqrt(max(0., 1. - dot(face, face))));
  float cp = cos(rotation.y), sp = sin(rotation.y);
  float cy = cos(rotation.x), sy = sin(rotation.x);
  vec3 tilted = vec3(normal.x, cp * normal.y + sp * normal.z, -sp * normal.y + cp * normal.z);
  vec3 world = vec3(cy * tilted.x - sy * tilted.z, tilted.y, sy * tilted.x + cy * tilted.z);
  vec2 coordinates = vec2(atan(world.x, world.z) / (2. * PI) + .5, .5 - asin(clamp(world.y, -1., 1.)) / PI);
  float map = texture2D(geography, coordinates).r;
  float terrain = smoothstep(.34, .94, map) * .28;
  float mist = haze(coordinates * 2.4 + p * .35);
  float fog = smoothstep(.22, .76, mist + (1. - normal.z) * .24);
  float light = max(dot(normal, normalize(vec3(-.45, .7, 1.))), 0.);
  float fillLight = max(dot(normal, normalize(vec3(.55, -.35, .6))), 0.);
  float pink = 1. - smoothstep(-.72, .25, normal.y);
  vec3 accent = mix(vec3(.86, .30, .035), vec3(1., .64, .12), pink);
  vec3 water = mix(vec3(.18, .08, .018), vec3(.25, .12, .025), pink);
  vec3 fogColor = mix(vec3(.95, .35, .04), vec3(1., .72, .18), .5 + pink * .25);
  vec3 softenedTerrain = mix(water, accent, terrain);
  vec3 color = mix(softenedTerrain, fogColor, fog * .27) * (.42 + .52 * light + .12 * fillLight);
  color += accent * pow(1. - normal.z, 4.) * (.1 + .08 * pink);
  float highlight = pow(max(dot(reflect(-normalize(vec3(-.45, .7, 1.)), normal), vec3(0., 0., 1.)), 0.), 35.);
  color += vec3(1., .65, .26) * highlight * .055;
  color *= .97 + noise(coordinates * 1700.) * .06;
  float veilNoise = haze(p * 1.7 + coordinates * 1.2 + vec2(time * .025, -time * .018));
  float frontVeil = smoothstep(.34, .74, veilNoise) * (.22 + .12 * (1. - normal.z));
  float edgeVeil = smoothstep(.52, .92, radius) * .11;
  color = mix(color, fogColor, min(.68, frontVeil + edgeVeil));
  float edge = 1. - smoothstep(.717, .724, radius);
  gl_FragColor = vec4(color, edge);
}
`;

function compileShader(gl: WebGLRenderingContext, kind: number, source: string) {
  const shader = gl.createShader(kind);
  if (!shader) throw new Error('Unable to create globe shader.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    throw new Error('Unable to compile globe shader.');
  }
  return shader;
}

function JuriquillaGlobe({ onConfirm }: { onConfirm: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const markerElements = useRef(new Map<string, HTMLButtonElement>());
  const rotation = useRef({ yaw: 0, pitch: 0 });
  const zoom = useRef(1);
  const reset = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false);
  const [contextVersion, setContextVersion] = useState(0);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let disposed = false;
    let frame = 0;
    let visible = false;
    let textureLoaded = false;
    let dragging = false;
    let lastX = 0, lastY = 0, lastTime = 0;
    let velocity = 0;
    let idleUntil = 0;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const shaders: WebGLShader[] = [];
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    let texture: WebGLTexture | null = null;
    let observer: IntersectionObserver | undefined;
    let resizeObserver: ResizeObserver | undefined;

    const projectMarkers = () => {
      const { yaw, pitch } = rotation.current;
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      for (const location of locations) {
        const marker = markerElements.current.get(location.id);
        if (!marker) continue;
        const longitude = ((location.longitude - mapBounds.west) / (mapBounds.east - mapBounds.west) - .5) * Math.PI * 2;
        const latitude = ((location.latitude - mapBounds.south) / (mapBounds.north - mapBounds.south) - .5) * Math.PI;
        const x = Math.sin(longitude) * Math.cos(latitude);
        const y = Math.sin(latitude);
        const z = Math.cos(longitude) * Math.cos(latitude);
        const rotatedX = cy * x + sy * z;
        const rotatedZ = -sy * x + cy * z;
        const rotatedY = cp * y - sp * rotatedZ;
        const depth = sp * y + cp * rotatedZ;
        marker.style.left = `${50 + rotatedX * 36 * zoom.current}%`;
        marker.style.top = `${50 - rotatedY * 36 * zoom.current}%`;
        marker.style.opacity = String(Math.min(1, Math.max(0, depth * 4)));
        marker.style.visibility = depth > .04 ? 'visible' : 'hidden';
        marker.disabled = depth <= .04;
        marker.tabIndex = depth > .04 ? 0 : -1;
      }
    };
    projectMarkers();
    reset.current = () => { rotation.current = { yaw: 0, pitch: 0 }; projectMarkers(); };
    const gl = element.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
    if (!gl) return;

    try {
      shaders.push(compileShader(gl, gl.VERTEX_SHADER, vertexShader));
      shaders.push(compileShader(gl, gl.FRAGMENT_SHADER, fragmentShader));
      program = gl.createProgram();
      if (!program) throw new Error('Unable to initialize globe.');
      for (const shader of shaders) gl.attachShader(program, shader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Unable to link globe.');
      gl.useProgram(program);
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(gl.getUniformLocation(program, 'geography'), 0);
      const orientation = gl.getUniformLocation(program, 'rotation');
      const clock = gl.getUniformLocation(program, 'time');
      const resize = () => {
        const size = Math.max(1, Math.round(element.clientWidth * Math.min(window.devicePixelRatio, 1.5)));
        element.width = size;
        element.height = size;
        gl.viewport(0, 0, size, size);
        if (textureLoaded) {
          gl.uniform2f(orientation, rotation.current.yaw, rotation.current.pitch);
          gl.uniform1f(clock, performance.now() * .001);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
          projectMarkers();
        }
      };
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(element);
      resize();
      const draw = (time: number) => {
        frame = 0;
        if (disposed || !visible || !textureLoaded || document.hidden) return;
        const elapsed = Math.min(32, time - (lastTime || time));
        lastTime = time;
        if (!dragging && Math.abs(velocity) > .000005) {
          rotation.current.yaw += velocity * elapsed;
          velocity *= Math.pow(.94, elapsed / 16.67);
        }
        if (!dragging && !reducedMotion && time > idleUntil && Math.abs(velocity) < .00002) {
          const resume = Math.min(1, (time - idleUntil) / 1000);
          rotation.current.yaw += elapsed * .000028 * resume;
        }
        gl.uniform2f(orientation, rotation.current.yaw, rotation.current.pitch);
        gl.uniform1f(clock, time * .001);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        projectMarkers();
        if (!reducedMotion || dragging || Math.abs(velocity) > .000005) frame = requestAnimationFrame(draw);
      };
      const requestDraw = () => { if (!frame && visible && textureLoaded && !document.hidden) frame = requestAnimationFrame(draw); };
      const visibilityChange = () => {
        cancelAnimationFrame(frame);
        frame = 0;
        lastTime = 0;
        if (!document.hidden) requestDraw();
      };
      const image = new Image();
      image.onload = () => {
        if (disposed || gl.isContextLost()) return;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        textureLoaded = true;
        setReady(true);
        requestDraw();
      };
      image.src = mapTexture;
      observer = new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        if (visible) { lastTime = 0; requestDraw(); }
        else { cancelAnimationFrame(frame); frame = 0; }
      }, { rootMargin: '100px' });
      observer.observe(element);
      const pointerDown = (event: PointerEvent) => {
        if (event.button !== 0 || !textureLoaded) return;
        dragging = true;
        velocity = 0;
        idleUntil = performance.now() + 3000;
        lastX = event.clientX;
        lastY = event.clientY;
        element.setPointerCapture(event.pointerId);
        element.classList.add('is-dragging');
        requestDraw();
      };
      const wheel = (event: WheelEvent) => {
        event.preventDefault();
        zoom.current = Math.min(1.18, Math.max(.86, zoom.current - event.deltaY * .0008));
        element.style.transform = `scale(${zoom.current})`;
        projectMarkers();
      };
      const pointerMove = (event: PointerEvent) => {
        if (!dragging) return;
        idleUntil = performance.now() + 3000;
        const scale = Math.PI * 1.5 / element.clientWidth;
        velocity = reducedMotion ? 0 : (event.clientX - lastX) * scale / 16;
        rotation.current.yaw += (event.clientX - lastX) * scale;
        rotation.current.pitch = Math.max(-1.05, Math.min(1.05, rotation.current.pitch + (event.clientY - lastY) * scale));
        lastX = event.clientX;
        lastY = event.clientY;
        requestDraw();
      };
      const pointerUp = () => { dragging = false; idleUntil = performance.now() + 3000; element.classList.remove('is-dragging'); requestDraw(); };
      const lostPointerCapture = () => {
        if (!dragging) return;
        velocity = 0;
        pointerUp();
      };
      const keyDown = (event: KeyboardEvent) => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
        event.preventDefault();
        idleUntil = performance.now() + 3000;
        velocity = 0;
        if (event.key === 'Home') rotation.current = { yaw: 0, pitch: 0 };
        if (event.key === 'ArrowLeft') rotation.current.yaw -= .12;
        if (event.key === 'ArrowRight') rotation.current.yaw += .12;
        if (event.key === 'ArrowUp') rotation.current.pitch = Math.max(-1.05, rotation.current.pitch - .12);
        if (event.key === 'ArrowDown') rotation.current.pitch = Math.min(1.05, rotation.current.pitch + .12);
        requestDraw();
      };
      const lostContext = (event: Event) => {
        event.preventDefault();
        textureLoaded = false;
        velocity = 0;
        dragging = false;
        element.classList.remove('is-dragging');
        setReady(false);
        cancelAnimationFrame(frame);
        frame = 0;
      };
      const restoredContext = () => setContextVersion(version => version + 1);
      reset.current = () => { rotation.current = { yaw: 0, pitch: 0 }; velocity = 0; idleUntil = performance.now() + 3000; requestDraw(); };
      element.addEventListener('pointerdown', pointerDown);
      element.addEventListener('pointermove', pointerMove);
      element.addEventListener('pointerup', pointerUp);
      element.addEventListener('pointercancel', lostPointerCapture);
      element.addEventListener('lostpointercapture', lostPointerCapture);
      element.addEventListener('wheel', wheel, { passive: false });
      element.addEventListener('keydown', keyDown);
      element.addEventListener('webglcontextlost', lostContext);
      element.addEventListener('webglcontextrestored', restoredContext);
      document.addEventListener('visibilitychange', visibilityChange);
      return () => {
        disposed = true;
        cancelAnimationFrame(frame);
        observer?.disconnect();
        resizeObserver?.disconnect();
        image.onload = null;
        element.removeEventListener('pointerdown', pointerDown);
        element.removeEventListener('pointermove', pointerMove);
        element.removeEventListener('pointerup', pointerUp);
        element.removeEventListener('pointercancel', lostPointerCapture);
        element.removeEventListener('lostpointercapture', lostPointerCapture);
        element.removeEventListener('wheel', wheel);
        element.removeEventListener('keydown', keyDown);
        element.removeEventListener('webglcontextlost', lostContext);
        element.removeEventListener('webglcontextrestored', restoredContext);
        document.removeEventListener('visibilitychange', visibilityChange);
        shaders.forEach(shader => gl.deleteShader(shader));
        gl.deleteProgram(program);
        gl.deleteBuffer(buffer);
        gl.deleteTexture(texture);
      };
    } catch {
      shaders.forEach(shader => gl.deleteShader(shader));
      if (program) gl.deleteProgram(program);
      if (buffer) gl.deleteBuffer(buffer);
      if (texture) gl.deleteTexture(texture);
      observer?.disconnect();
      resizeObserver?.disconnect();
      setReady(false);
    }
  }, [contextVersion]);

  return <>
    <div className={`after-dark-planet ${ready ? 'is-webgl-ready' : ''}`}>
      <div className="after-dark-planet-fallback" style={{ opacity: ready ? 0 : 1 }} aria-hidden="true"><img src={mapTexture} alt="" /></div>
      <canvas ref={canvas} className={`after-dark-planet-canvas${ready ? ' is-ready' : ''}`} style={{ opacity: ready ? 1 : 0 }} tabIndex={0} role="img" aria-label="Mapa de Juriquilla adaptado a una esfera. Usa las flechas para girar y la tecla Inicio para volver." />
      <div className="after-dark-planet-moments" aria-label="Ubicaciones de Juriquilla">
        {locations.map(location => <button key={location.id} ref={element => { if (element) markerElements.current.set(location.id, element); else markerElements.current.delete(location.id); }} className={`after-dark-planet-marker after-dark-planet-marker--${location.id}`} type="button" onClick={location.id === 'house' ? onConfirm : undefined} aria-label={location.id === 'house' ? 'The Pink House, confirmar asistencia' : `${location.label}, zona de Juriquilla`}>
          <span className="after-dark-planet-marker-ring" aria-hidden="true"><span /></span>
          <span>{location.label}</span>
        </button>)}
      </div>
    </div>
  </>;
}

export default function AfterDarkClosing({ onConfirm }: AfterDarkClosingProps) {
  return <section className="after-dark-closing" aria-label="The Pink House en Juriquilla">
    <div className="after-dark-universe" id="mapa">
      <JuriquillaGlobe onConfirm={onConfirm} />
    </div>
    <footer className="after-dark-footer" id="footer">
      <a className="after-dark-footer-brand" href="#top" aria-label="The Pink House, volver al inicio">
        <span>PINK<br />HOUSE</span>
      </a>
      <p className="after-dark-footer-tagline">LA CASA DE SIEMPRE,<br />UNA NOCHE DIFERENTE.</p>
      <div className="after-dark-footer-next">
        <p className="after-dark-footer-heading">PRÓXIMO EVENTO:</p>
        <button className="after-dark-footer-event" onClick={onConfirm} type="button" aria-label="Halloween, confirmar asistencia">HALLOWEEN</button>
      </div>
    </footer>
  </section>;
}
