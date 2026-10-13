import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GlobeCommand, GlobeRenderer, ProjectedMarker } from '../globe/GlobeRenderer';
import { calcGlobePresentation } from '../globe/presentation';
import { selectGlobeQuality } from '../globe/quality';
import AfterDarkFooter from './AfterDarkFooter';
import './AfterDarkClosing.css';

type AfterDarkClosingProps = {
  onConfirm: () => void;
};

// These local coordinates preserve the relationship used by the supplied aerial map.
const locations = [
  { id: 'uaq', label: 'UAQ', latitude: 20.70438308336931, longitude: -100.44387705896915 },
  { id: 'uvm', label: 'UVM', latitude: 20.70827004638903, longitude: -100.4453510329209 },
  { id: 'enes', label: 'ENES', latitude: 20.705875489620908, longitude: -100.44812312985161 },
  { id: 'house', label: 'THE PINK HOUSE', latitude: 20.707390681241908, longitude: -100.44438633247219 },
] as const;
const mapTexture = `${import.meta.env.BASE_URL}images/juriquilla-map.svg`;
const markerBounds = { west: -100.4534, east: -100.4374, south: 20.6988, north: 20.7138 };
const commands: Record<string, GlobeCommand> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  Home: 'reset',
  '+': 'closer',
  '=': 'closer',
  '-': 'farther',
};

function JuriquillaGlobe({ onConfirm }: { onConfirm: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const markerElements = useRef(new Map<string, HTMLButtonElement>());
  const renderer = useRef<GlobeRenderer | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const selectedRef = useRef<(typeof locations)[number] | null>(null);
  const focusRef = useRef(false);
  const markersVisibleRef = useRef(false);
  const instructionsId = useId();
  const placeTitleId = useId();
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [selected, setSelected] = useState<(typeof locations)[number] | null>(null);
  const [contextVersion, setContextVersion] = useState(0);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const [markersVisible, setMarkersVisible] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const ready = status === 'ready';
  useEffect(() => { setPortalHost(document.querySelector<HTMLElement>('.after-dark-site') || document.body); }, []);

  const closePlace = () => {
    setSelected(null);
    selectedRef.current = null;
    previousFocus.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    const element = canvas.current;
    const planet = surface.current;
    if (!element || !planet) return;
    let disposed = false;
    let instance: GlobeRenderer | null = null;
    let starting = false;
    let viewLeft = 0, viewScale = 1;
    let presentationFrame = 0;
    let lastInteractive = false;
    const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
    setStatus('loading');
    const metrics = new Map<string, { width: number; height: number; ring: number; label: number; gap: number }>();
    const measure = () => {
      const bounds = planet.getBoundingClientRect();
      viewLeft = bounds.left; viewScale = bounds.width / Math.max(1, planet.clientWidth);
      for (const [id, marker] of markerElements.current) metrics.set(id, {
        width: marker.offsetWidth, height: marker.offsetHeight,
        ring: (marker.firstElementChild as HTMLElement)?.offsetWidth || 16,
        label: (marker.lastElementChild as HTMLElement)?.offsetWidth || 70,
        gap: parseFloat(getComputedStyle(marker).columnGap) || 0,
      });
    };
    const updateMarkers = (markers: ProjectedMarker[]) => {
      const width = planet.clientWidth, viewport = document.documentElement.clientWidth;
      const safeLeft = Math.max(0, (8 - viewLeft) / viewScale);
      const safeRight = Math.min(width, (viewport - viewLeft - 8) / viewScale);
      const occupied: { left: number; right: number; top: number; bottom: number }[] = [];
      for (const point of [...markers].sort((a, b) => Number(b.id === 'house') - Number(a.id === 'house'))) {
        const marker = markerElements.current.get(point.id), metric = metrics.get(point.id);
        if (!marker || !metric) continue;
        const right = point.x >= width / 2;
        // Preserve the ring's geographic anchor; only the label avoids collisions.
        const left = right ? point.x - metric.width + metric.ring / 2 : point.x - metric.ring / 2;
        const naturalLabel = left + (right ? 0 : metric.ring + metric.gap);
        const labelLeft = Math.max(safeLeft, Math.min(safeRight - metric.label, naturalLabel));
        const labelHeight = Math.min(metric.height, 30);
        let offset = 0;
        const overlaps = () => occupied.some(box => labelLeft < box.right + 6 && labelLeft + metric.label > box.left - 6 && point.y + offset - labelHeight / 2 < box.bottom + 4 && point.y + offset + labelHeight / 2 > box.top - 4);
        while (overlaps() && Math.abs(offset) < 112) offset += point.y < planet.clientHeight / 2 ? -28 : 28;
        marker.dataset.side = right ? 'right' : 'left';
        marker.style.left = `${left.toFixed(3)}px`;
        marker.style.top = `${point.y.toFixed(3)}px`;
        marker.style.setProperty('--marker-label-offset', `${offset}px`);
        marker.style.setProperty('--marker-label-x', `${(labelLeft - naturalLabel).toFixed(3)}px`);
        // The translucent capsule follows the shifted label. When its row is
        // aligned, extend it around the geographic ring without moving that point.
        const labelInButton = labelLeft - left;
        const ringInButton = right ? metric.width - metric.ring : 0;
        marker.style.setProperty('--marker-pill-left', `${offset ? 0 : Math.min(0, ringInButton - labelInButton) - 3}px`);
        marker.style.setProperty('--marker-pill-right', `${offset ? 0 : Math.min(0, labelInButton + metric.label - ringInButton - metric.ring) - 3}px`);
        marker.style.opacity = '1';
        marker.style.visibility = markersVisibleRef.current ? 'visible' : 'hidden';
        marker.disabled = !markersVisibleRef.current;
        marker.tabIndex = markersVisibleRef.current ? 0 : -1;
        occupied.push({ left: labelLeft, right: labelLeft + metric.label, top: point.y + offset - labelHeight / 2, bottom: point.y + offset + labelHeight / 2 });
      }
    };
    const updatePresentation = () => {
      presentationFrame = 0;
      if (disposed) return;
      const quality = selectGlobeQuality(motionPreference.matches);
      const maxBlur = quality.name === 'mobile-high' ? 6 : quality.name === 'mobile-medium' ? 4 : quality.name === 'mobile-low' ? 2.5 : 14;
      const pose = calcGlobePresentation({ scrollY: window.scrollY,
        scrollHeight: document.documentElement.scrollHeight, viewportHeight: planet.clientHeight,
        mobile: quality.mobile, maxBlur, reducedMotion: motionPreference.matches });
      planet.style.transform = `translate3d(0, ${pose.y}px, 0) scale(${pose.scale})`;
      planet.style.opacity = String(pose.opacity);
      planet.dataset.markersVisible = String(pose.markersVisible);
      planet.dataset.interactive = String(pose.interactive);
      element.dataset.globeReveal = pose.progress.toFixed(6);
      if (markersVisibleRef.current !== pose.markersVisible) {
        markersVisibleRef.current = pose.markersVisible; setMarkersVisible(pose.markersVisible);
      }
      if (lastInteractive !== pose.interactive) { lastInteractive = pose.interactive; setInteractive(pose.interactive); }
      instance?.setPresentation({ rotationOffset: pose.rotationOffset, blur: pose.blur, active: pose.interactive });
      measure();
      for (const marker of markerElements.current.values()) {
        marker.disabled = !pose.markersVisible; marker.tabIndex = pose.markersVisible ? 0 : -1;
      }
    };
    const requestPresentation = () => { if (!presentationFrame) presentationFrame = requestAnimationFrame(updatePresentation); };
    const sizeObserver = new ResizeObserver(measure);
    sizeObserver.observe(planet);
    const pageObserver = new ResizeObserver(requestPresentation);
    pageObserver.observe(document.documentElement);
    window.addEventListener('scroll', requestPresentation, { passive: true });
    window.addEventListener('resize', requestPresentation, { passive: true });
    motionPreference.addEventListener('change', requestPresentation);
    measure();
    void document.fonts.ready.then(() => { if (!disposed) { measure(); instance?.command('refresh'); } });
    const start = async () => {
      if (starting || disposed) return;
      starting = true;
      try {
      const { GlobeRenderer: GlobeRendererClass } = await import('../globe/GlobeRenderer');
      if (disposed) return;
      instance = new GlobeRendererClass({
        canvas: element,
        mapUrl: mapTexture,
        markers: locations.map(({ id, latitude, longitude }) => ({ id, latitude, longitude })),
        markerBounds,
        offscreenSuspension: false,
        isFrozen: () => selectedRef.current !== null || focusRef.current,
        onDragStart: () => { focusRef.current = false; },
        onStatus: nextStatus => {
          if (!disposed) {
            if (nextStatus === 'fallback') {
              for (const marker of markerElements.current.values()) {
                for (const property of ['left', 'top', 'opacity', 'visibility', '--marker-label-offset', '--marker-label-x']) marker.style.removeProperty(property);
                marker.dataset.side = 'left'; marker.disabled = false; marker.tabIndex = 0;
              }
            }
            setStatus(nextStatus);
            requestPresentation();
          }
        },
        onMarkers: updateMarkers,
        onContextRestored: () => {
          if (!disposed) setContextVersion(version => version + 1);
        },
      });
      renderer.current = instance;
      updatePresentation();
      } catch {
        if (!disposed) setStatus('fallback');
      }
    };
    updatePresentation();
    void start();
    return () => {
      disposed = true;
      cancelAnimationFrame(presentationFrame);
      sizeObserver.disconnect(); pageObserver.disconnect(); instance?.dispose();
      window.removeEventListener('scroll', requestPresentation);
      window.removeEventListener('resize', requestPresentation);
      motionPreference.removeEventListener('change', requestPresentation);
      if (renderer.current === instance) renderer.current = null;
    };
  }, [contextVersion, portalHost]);

  useEffect(() => {
    renderer.current?.command('refresh');
    if (selected) closeButton.current?.focus({ preventScroll: true });
  }, [selected]);

  const issueCommand = (command: GlobeCommand) => renderer.current?.command(command);

  return <div
    className="after-dark-globe"
    onFocusCapture={event => { const target = event.target as HTMLElement; focusRef.current = target === canvas.current && target.matches(':focus-visible'); issueCommand('refresh'); }}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) { focusRef.current = false; issueCommand('refresh'); } }}
    onKeyDownCapture={event => {
      const command = commands[event.key];
      if (command) {
        event.preventDefault();
        issueCommand(command);
      }
    }}
  >
    {portalHost && createPortal(<div className="after-dark-render-backdrop">
    <div ref={surface} data-markers-visible="false" data-interactive="false" className={`after-dark-planet ${ready ? 'is-webgl-ready' : 'is-fallback'}`}>
      <div className="after-dark-planet-fallback" aria-hidden="true"><img src={mapTexture} alt="" /></div>
      <canvas
        ref={canvas}
        className={`after-dark-planet-canvas${ready ? ' is-ready' : ''}`}
        tabIndex={ready && markersVisible && interactive ? 0 : -1}
        aria-hidden={!ready || !markersVisible}
        role="img"
        aria-label="Mapa interactivo de Juriquilla adaptado a una esfera"
        aria-describedby={instructionsId}
      />
      <div className="after-dark-planet-moments" role="group" aria-label="Ubicaciones de Juriquilla">
        {locations.map(location => <button
          key={location.id}
          ref={element => {
            if (element) markerElements.current.set(location.id, element);
            else markerElements.current.delete(location.id);
          }}
          className={`after-dark-planet-marker after-dark-planet-marker--${location.id}`}
          type="button"
          onPointerEnter={() => renderer.current?.setMarkerHover(location.id)}
          onPointerLeave={() => renderer.current?.setMarkerHover(null)}
          onFocus={() => renderer.current?.setMarkerHover(location.id)}
          onBlur={() => renderer.current?.setMarkerHover(null)}
          onClick={event => {
            if (location.id === 'house') onConfirm();
            else {
              previousFocus.current = event.currentTarget;
              selectedRef.current = location;
              setSelected(location);
            }
          }}
          aria-label={location.id === 'house' ? 'The Pink House, confirmar asistencia' : `${location.label}, zona de Juriquilla`}
          aria-haspopup={location.id === 'house' ? undefined : 'dialog'}
        >
          <span className="after-dark-planet-marker-ring" aria-hidden="true"><span /></span>
          <span className="after-dark-planet-marker-label">{location.label}</span>
        </button>)}
      </div>
    </div>
    </div>, portalHost)}
      {selected && <div className="after-dark-map-place" role="dialog" aria-labelledby={placeTitleId} onKeyDown={event => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          closePlace();
        }
      }}>
        <button ref={closeButton} className="after-dark-map-place-close" type="button" onClick={closePlace} aria-label="Cerrar ubicación">×</button>
        <h3 id={placeTitleId}>{selected.label}</h3>
        <p>Zona de Juriquilla</p>
      </div>}
    <span className="after-dark-globe-status" role="status">{status === 'fallback' ? 'Vista estática del mapa. Las ubicaciones siguen disponibles.' : ''}</span>
    <p id={instructionsId} className="sr-only">Mueve el cursor para interactuar con la atmósfera. Arrastra para girar, usa las flechas y Home para restablecer; selecciona los puntos para explorar ubicaciones.</p>
  </div>;
}

export default function AfterDarkClosing({ onConfirm }: AfterDarkClosingProps) {
  return <section className="after-dark-closing" aria-label="The Pink House en Juriquilla">
    <div className="after-dark-universe" id="mapa">
      <JuriquillaGlobe onConfirm={onConfirm} />
    </div>
    <AfterDarkFooter onConfirm={onConfirm} />
  </section>;
}
