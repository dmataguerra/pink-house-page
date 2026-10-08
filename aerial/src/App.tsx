import { useEffect, useRef, useState } from 'react';
import {
  Cartesian3, Cartographic, Color, Ellipsoid, JulianDate,
  Matrix4, SceneTransforms, Transforms, Viewer, Cesium3DTileset,
  type Cesium3DTile,
} from 'cesium';
import { TARGET, VIDEO, type DatasetConfig, type FlyoverApi, type FrameReport, type GeometryReport } from './config';
import { framePose } from './camera';

export function App() {
  const container = useRef<HTMLDivElement>(null);
  const credits = useRef<HTMLDivElement>(null);
  const footer = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Checking licensed 3D data…');
  const [source, setSource] = useState<DatasetConfig | null>(null);

  useEffect(() => {
    let viewer: Viewer | undefined;
    let disposed = false;
    let failure = '';
    const fail = (message: string) => {
      failure = message;
      api.error = message;
      api.ready = false;
      if (!disposed) setStatus(message);
    };
    const api: FlyoverApi = {
      ...VIDEO, ready: false, error: null,
      source: { name: '', attribution: '', licenseEvidenceSha256: '' },
      prepare: async () => { throw new Error('Licensed scene is not ready.'); },
      renderFrame: async () => { throw new Error('Licensed scene is not ready.'); },
    };
    window.flyover = api;

    async function initialize() {
      const response = await fetch('/api/dataset', { cache: 'no-store' });
      const result = await response.json() as { dataset?: DatasetConfig; error?: string };
      if (!response.ok || !result.dataset) throw new Error(result.error || 'Licensed dataset unavailable.');
      if (disposed) return;
      const data = result.dataset;
      setSource(data);
      viewer = new Viewer(container.current!, {
        animation: false, timeline: false, baseLayerPicker: false, baseLayer: false,
        geocoder: false, homeButton: false, navigationHelpButton: false,
        sceneModePicker: false, fullscreenButton: false, infoBox: false,
        selectionIndicator: false, globe: false, skyBox: false,
        shouldAnimate: false, shadows: false, creditContainer: credits.current!,
        contextOptions: { webgl: { preserveDrawingBuffer: true, alpha: false, antialias: true } },
      });
      const scene = viewer.scene;
      viewer.resolutionScale = 1;
      viewer.clock.currentTime = JulianDate.fromIso8601('2026-10-07T18:00:00Z');
      viewer.clock.shouldAnimate = false;
      scene.backgroundColor = Color.fromCssColorString('#15252d');
      scene.screenSpaceCameraController.enableInputs = false;
      scene.postProcessStages.fxaa.enabled = true;
      scene.fog.enabled = false;
      const tileset = await Cesium3DTileset.fromUrl(data.tilesetUrl, {
        showCreditsOnScreen: true,
        maximumScreenSpaceError: 1,
        dynamicScreenSpaceError: false,
        skipLevelOfDetail: false,
        foveatedScreenSpaceError: false,
        cullRequestsWhileMoving: false,
        cacheBytes: 1024 * 1024 * 1024,
        maximumCacheOverflowBytes: 1024 * 1024 * 1024,
        enableCollision: true,
      });
      if (disposed) { tileset.destroy(); return; }
      scene.primitives.add(tileset);
      // Never log the tileset's URL: licensed providers may embed credentials.
      tileset.tileFailed.addEventListener(() => fail('A required survey tile or texture failed to load.'));
      scene.renderError.addEventListener(() => fail('The 3D scene could not finish rendering.'));
      let visible = new Set<Cesium3DTile>();
      let geometryBytes = 0;
      let textureBytes = 0;
      tileset.tileVisible.addEventListener(tile => {
        if (!visible.has(tile)) {
          visible.add(tile);
          geometryBytes += tile.content.geometryByteLength;
          textureBytes += tile.content.texturesByteLength;
        }
      });
      scene.preRender.addEventListener(() => { visible = new Set(); geometryBytes = 0; textureBytes = 0; });
      let targetHeight = data.targetEllipsoidHeight;
      let target = Cartesian3.fromDegrees(TARGET.longitude, TARGET.latitude, targetHeight);
      let transform = Transforms.eastNorthUpToFixedFrame(target);
      let prepared = false;
      let geometry: GeometryReport | null = null;

      function setCamera(index: number) {
        const pose = framePose(index);
        const destination = Matrix4.multiplyByPoint(transform, new Cartesian3(pose.east, pose.north, pose.up), new Cartesian3());
        const direction = Cartesian3.normalize(Cartesian3.subtract(target, destination, new Cartesian3()), new Cartesian3());
        const localUp = Ellipsoid.WGS84.geodeticSurfaceNormal(destination, new Cartesian3());
        const right = Cartesian3.normalize(Cartesian3.cross(direction, localUp, new Cartesian3()), new Cartesian3());
        const up = Cartesian3.normalize(Cartesian3.cross(right, direction, new Cartesian3()), new Cartesian3());
        scene.camera.setView({ destination, orientation: { direction, up } });
      }

      function settle(timeoutMs = 60000): Promise<void> {
        return new Promise((resolve, reject) => {
          const start = performance.now();
          let stable = 0;
          const remove = scene.postRender.addEventListener(() => {
            if (failure || disposed) { remove(); reject(new Error(failure || 'Scene closed.')); return; }
            if (performance.now() - start > timeoutMs) { remove(); reject(new Error('Required 3D assets did not finish loading.')); return; }
            stable = tileset.tilesLoaded && visible.size > 0 ? stable + 1 : 0;
            if (stable >= 4) { remove(); resolve(); }
          });
          scene.requestRender();
        });
      }

      function coordinate(east: number, north: number) {
        const point = Matrix4.multiplyByPoint(transform, new Cartesian3(east, north, 0), new Cartesian3());
        return Cartographic.fromCartesian(point);
      }
      async function sample(points: Cartographic[]) {
        if (!scene.sampleHeightSupported) throw new Error('This browser cannot verify surveyed 3D surface geometry.');
        return await scene.sampleHeightMostDetailed(points);
      }

      api.source = { name: data.name, attribution: data.attribution, licenseEvidenceSha256: data.licenseEvidenceSha256 };
      api.prepare = async () => {
        if (geometry) return geometry;
        setCamera(300);
        await settle();
        const positions: Cartographic[] = [];
        for (const east of [-8, 0, 8]) for (const north of [-8, 0, 8]) positions.push(coordinate(east, north));
        for (const east of [-120, -60, 0, 60, 120]) for (const north of [-120, -60, 0, 60, 120]) positions.push(coordinate(east, north));
        const sampled = await sample(positions);
        const heights = sampled.map(p => p?.height).filter((h): h is number => Number.isFinite(h));
        const centerHeight = sampled[4]?.height;
        if (typeof centerHeight !== 'number' || !Number.isFinite(centerHeight)) throw new Error('No actual 3D surface exists at the target coordinate.');
        targetHeight = centerHeight;
        target = Cartesian3.fromDegrees(TARGET.longitude, TARGET.latitude, targetHeight);
        transform = Transforms.eastNorthUpToFixedFrame(target);
        geometry = {
          sampleCount: sampled.length,
          validSamples: heights.length,
          heightRange: heights.length ? Math.max(...heights) - Math.min(...heights) : 0,
          targetHeight,
          verified: heights.length >= Math.ceil(sampled.length * 0.8) && heights.length > 8 &&
            Math.max(...heights) - Math.min(...heights) >= 2,
        };
        if (!geometry.verified) throw new Error('Neighborhood probes did not verify sufficient non-flat 3D geometry.');
        // Inspect each one-second view before capture. Assets remain renderer-managed.
        for (let i = 0; i < VIDEO.frames; i += VIDEO.fps) { setCamera(i); await settle(); }
        prepared = true;
        setCamera(0);
        await settle();
        return geometry;
      };

      api.renderFrame = async (index: number): Promise<FrameReport> => {
        if (!prepared) throw new Error('Run geometry and camera preparation before capturing frames.');
        if (!Number.isInteger(index) || index < 0 || index >= VIDEO.frames) throw new Error('Invalid capture frame.');
        if (failure) throw new Error(failure);
        setCamera(index);
        await settle();
        const cameraCoordinate = Cartographic.fromCartesian(scene.camera.positionWC);
        const [surface] = await sample([cameraCoordinate.clone()]);
        if (!surface || !Number.isFinite(surface.height)) throw new Error('Survey coverage is missing beneath the camera.');
        const clearance = cameraCoordinate.height - surface.height;
        if (clearance < 10) throw new Error('Camera path intersects or approaches surveyed geometry.');
        await settle();
        const delta = Cartesian3.subtract(target, scene.camera.positionWC, new Cartesian3());
        const direction = Cartesian3.normalize(delta, new Cartesian3());
        const projected = SceneTransforms.worldToWindowCoordinates(scene, target);
        if (!scene.pickPositionSupported) throw new Error('This browser cannot check target occlusion.');
        // The depth-buffer surface at the target pixel detects intervening roofs/trees.
        const hit = projected ? scene.pickPosition(projected) : undefined;
        const targetOccluded = !hit || Cartesian3.distance(hit, target) > 3;
        const targetVisible = !!projected && projected.x > 40 && projected.x < VIDEO.width - 40 &&
          projected.y > 40 && projected.y < VIDEO.height - 80 &&
          Cartesian3.dot(direction, scene.camera.directionWC) > 0;
        await settle();
        const creditElement = credits.current!;
        const creditText = creditElement.innerText.trim();
        const imageCredits = Array.from(creditElement.querySelectorAll('img')).map(img => img.alt).filter(Boolean);
        const required = footer.current!;
        const box = required.getBoundingClientRect();
        const expander = creditElement.querySelector<HTMLElement>('.cesium-credit-expand-link');
        const hiddenCredits = expander && getComputedStyle(expander).display !== 'none' && expander.getBoundingClientRect().width > 0;
        const creditNodes = Array.from(creditElement.querySelectorAll<HTMLElement>('a:not(.cesium-credit-expand-link),img,.cesium-credit-textContainer,.cesium-credit-logoContainer'));
        const allCreditsVisible = !hiddenCredits && creditNodes.every(node => {
          if (!node.textContent?.trim() && !node.querySelector('img') && node.tagName !== 'IMG') return true;
          const bounds = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          const image = node.tagName === 'IMG' ? node as HTMLImageElement : null;
          return bounds.width > 0 && bounds.height > 0 && bounds.left >= 0 && bounds.right <= VIDEO.width + 1 &&
            bounds.top >= box.top && bounds.bottom <= VIDEO.height + 1 &&
            style.display !== 'none' && style.visibility === 'visible' && style.opacity !== '0' &&
            (!image || (image.complete && image.naturalWidth > 0));
        });
        const attributionVisible = required.innerText.includes(data.attribution) && box.height > 0 &&
          box.bottom <= VIDEO.height + 1 && box.top > 0 && box.height < VIDEO.height / 4 &&
          getComputedStyle(required).visibility === 'visible' && getComputedStyle(required).opacity !== '0' && allCreditsVisible;
        return {
          frame: index, time: index / VIDEO.fps, loaded: tileset.tilesLoaded,
          visibleTiles: visible.size,
          geometryBytes, textureBytes,
          collisionClearance: clearance, targetVisible, targetOccluded,
          attributionVisible, credits: [data.attribution, creditText, ...imageCredits].filter(Boolean),
          projectedTarget: projected ? { x: projected.x, y: projected.y } : { x: -1, y: -1 },
        };
      };
      setCamera(0);
      await settle();
      api.ready = true;
      setStatus('');
    }
    initialize().catch(error => {
      // Third-party Cesium errors may include credential-bearing URLs.
      const safe = error instanceof Error && !/https?:|key=|token=/i.test(error.message) ? error.message : 'The licensed 3D source could not be opened.';
      fail(safe);
    });
    return () => { disposed = true; if (viewer && !viewer.isDestroyed()) viewer.destroy(); };
  }, []);

  return <>
    <div className="scene" ref={container} />
    {status && <main className="status"><section className="card">
      <div className="eyebrow">Juriquilla · Querétaro</div>
      <h1>A real view needs<br />a real 3D survey.</h1>
      <p>{status}</p>
      <p className="detail">The flyover requires surveyed buildings and photographic textures from a source licensed for standalone video. {source ? 'The supplied survey must pass coverage and geometry checks before recording.' : 'No suitable dataset has been supplied.'}</p>
      <div className="coordinates">20.7073906812° N &nbsp; · &nbsp; 100.4443863325° W</div>
    </section></main>}
    <div className="attribution" ref={footer} style={{ display: source && !status ? 'flex' : 'none' }}>
      <span>{source?.attribution}</span><div className="credits" ref={credits} />
    </div>
  </>;
}
