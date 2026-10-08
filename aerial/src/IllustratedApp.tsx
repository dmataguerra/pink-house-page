import { useEffect, useRef, useState } from 'react';
import { Cartesian3, Color, Ellipsoid, JulianDate, Matrix4, SceneTransforms, Transforms,
  Viewer, PolygonHierarchy, DirectionalLight, ShadowMode, Rectangle,
  TileMapServiceImageryProvider, ImageryLayer, ColorMaterialProperty, ConstantProperty } from 'cesium';
import { TARGET, VIDEO } from './config';
import { illustratedPose } from './illustrated-camera';
import { generateIllustrativeBuildings } from './illustrative-buildings';

interface Way { id: number; tags?: Record<string, string>; geometry?: {lat: number; lon: number}[] }
interface BuildingFeature { geometry: {type: string; coordinates: number[][][]}; properties?: Record<string, unknown> }
export interface IllustratedFrame {
  frame: number; time: number; targetVisible: boolean; attributionVisible: boolean;
  approximationLabelVisible: boolean; projectedTarget: {x: number; y: number};
  geometryCount: number; estimatedHeightCount: number;
}
export interface IllustratedApi {
  ready: boolean; error: string | null; spec: typeof VIDEO; source: Record<string, unknown>;
  renderFrame(index: number): Promise<IllustratedFrame>;
}
declare global { interface Window { illustrated: IllustratedApi } }
const color = (hex: string) => Color.fromCssColorString(hex);

export function IllustratedApp() {
  const container = useRef<HTMLDivElement>(null);
  const credits = useRef<HTMLDivElement>(null);
  const marker = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLDivElement>(null);
  const phase = useRef<HTMLSpanElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Preparando la vista de Juriquilla…');
  const [microsoft, setMicrosoft] = useState(false);
  useEffect(() => {
    let viewer: Viewer | undefined;
    let disposed = false;
    const api: IllustratedApi = window.illustrated = {
      ready: false, error: null, spec: VIDEO, source: {},
      renderFrame: async () => { throw new Error('La escena todavía está cargando.'); },
    };
    async function initialize() {
      const [osmResponse, sourceResponse] = await Promise.all([fetch('/open-data/osm.json'), fetch('/open-data/source.json')]);
      if (!osmResponse.ok || !sourceResponse.ok) throw new Error('Ejecuta npm run fetch:open para descargar la cartografía.');
      const osm = await osmResponse.json() as {elements: Way[]};
      const source = await sourceResponse.json() as Record<string, unknown>;
      let microsoftFeatures: BuildingFeature[] = [];
      let microsoftSource: Record<string, unknown> | null = null;
      const msResponse = await fetch('/open-data/microsoft-buildings.geojson');
      if (msResponse.ok && msResponse.headers.get('content-type')?.includes('json')) {
        microsoftFeatures = (await msResponse.json()).features ?? [];
        const provenance = await fetch('/open-data/source-microsoft.json');
        if (!provenance.ok) throw new Error('Falta la procedencia de los edificios adicionales.');
        microsoftSource = await provenance.json();
        if (microsoftSource?.downloadComplete === false) { microsoftFeatures = []; microsoftSource = null; }
        setMicrosoft(microsoftFeatures.length > 0);
      }
      if (disposed) return;
      const earth = await TileMapServiceImageryProvider.fromUrl('/cesium/Assets/Textures/NaturalEarthII');
      viewer = new Viewer(container.current!, {
        animation: false, timeline: false, baseLayerPicker: false, baseLayer: new ImageryLayer(earth),
        geocoder: false, homeButton: false, navigationHelpButton: false, sceneModePicker: false,
        fullscreenButton: false, infoBox: false, selectionIndicator: false,
        skyBox: false, shouldAnimate: false, shadows: true, creditContainer: credits.current!,
        contextOptions: {webgl: {preserveDrawingBuffer: true, alpha: false, antialias: true}},
      });
      viewer.resolutionScale = 1;
      viewer.clock.currentTime = JulianDate.fromIso8601('2026-10-07T18:00:00Z');
      viewer.clock.shouldAnimate = false;
      const scene = viewer.scene;
      scene.backgroundColor = color('#101c2c');
      scene.fog.enabled = false;
      scene.globe.enableLighting = false;
      scene.globe.maximumScreenSpaceError = 2;
      scene.screenSpaceCameraController.enableInputs = false;
      scene.postProcessStages.fxaa.enabled = true;
      scene.shadowMap.maximumDistance = 3000;
      scene.shadowMap.size = 2048;
      scene.renderError.addEventListener((_scene, error) => { api.error = String(error); });
      const coordinates = (points: {lat: number; lon: number}[], height = 0) =>
        Cartesian3.fromDegreesArrayHeights(points.flatMap(p => [p.lon, p.lat, height]));
      const target = Cartesian3.fromDegrees(TARGET.longitude, TARGET.latitude, 1);
      const transform = Transforms.eastNorthUpToFixedFrame(target);
      const sunlight = Matrix4.multiplyByPointAsVector(transform,new Cartesian3(0.45,-0.35,-1),new Cartesian3());
      scene.light = new DirectionalLight({direction:Cartesian3.normalize(sunlight,sunlight),intensity:1.25});
      scene.shadowMap.softShadows = true;
      scene.shadowMap.darkness = 0.45;
      const groundMaterial = new ColorMaterialProperty(color('#c9c6b7'));
      const localGround = viewer.entities.add({rectangle: {
        coordinates: Rectangle.fromDegrees(TARGET.longitude-.09,TARGET.latitude-.09,TARGET.longitude+.09,TARGET.latitude+.09),
        height: 0.05, material: groundMaterial, shadows: ShadowMode.RECEIVE_ONLY}});
      let geometryCount = 0, estimatedHeightCount = 0, osmBuildings = 0, roads = 0;
      const buildingPolygons: number[][][] = [];
      function addBuilding(ring: number[][], height: number, estimated: boolean, id: string) {
        if (ring.length < 4) return;
        const positions = Cartesian3.fromDegreesArray(ring.flatMap(p => [p[0], p[1]]));
        const palette = ['#d7c7b8','#c1b0a4','#d7cfc1','#bfc2c3','#b49d91','#dbb6a2'];
        const code = [...id].reduce((sum,c) => sum+c.charCodeAt(0),0);
        const isTarget = inside(TARGET.longitude,TARGET.latitude,ring);
        viewer!.entities.add({id, polygon: {hierarchy: new PolygonHierarchy(positions), height: 0.3,
          extrudedHeight: height, material: color(isTarget ? '#d876a0' : palette[code%palette.length]),
          outline: false, shadows: ShadowMode.CAST_ONLY}});
        const centerLon = ring.reduce((sum,p)=>sum+p[0],0)/ring.length;
        const centerLat = ring.reduce((sum,p)=>sum+p[1],0)/ring.length;
        if (Math.hypot((centerLon-TARGET.longitude)*104000,(centerLat-TARGET.latitude)*111000)<450) {
          viewer!.entities.add({id:`${id}-roof`,polygon:{hierarchy:new PolygonHierarchy(positions),height:height+0.04,
            material:color(isTarget?'#d969a2':'#8e969a'),shadows:ShadowMode.DISABLED}});
        }
        geometryCount++;
        if (estimated) estimatedHeightCount++;
      }
      for (const way of osm.elements) {
        const points = way.geometry, tags = way.tags ?? {};
        if (!points || points.length < 2) continue;
        if (tags.building && points.length > 3) {
          const mappedHeight = Number.parseFloat(tags.height || ''), levels = Number.parseFloat(tags['building:levels'] || '');
          const height = Number.isFinite(mappedHeight) && mappedHeight > 0 ? mappedHeight
            : Number.isFinite(levels) && levels > 0 ? levels * 3.2 : 6.4;
          const ring = points.map(p => [p.lon,p.lat]);
          addBuilding(ring, height, !Number.isFinite(mappedHeight), `osm-building-${way.id}`);
          buildingPolygons.push(ring); osmBuildings++;
        } else if (tags.highway) {
          const widths: Record<string, number> = {motorway:14,trunk:14,primary:12,secondary:10,tertiary:9,
            residential:7,unclassified:7,service:4.5,footway:1.7,path:1.2,cycleway:2,steps:1.5,pedestrian:4,living_street:5};
          const width = widths[tags.highway] ?? 5, isPath = ['footway','path','steps','cycleway'].includes(tags.highway);
          viewer.entities.add({corridor: {positions: coordinates(points), width: width + (isPath ? 0 : 2),
            height: 0.17, material: color(isPath ? '#bdb49f' : '#e4dfd1')}});
          if (!isPath) viewer.entities.add({corridor: {positions: coordinates(points), width,
            height: 0.24, material: color('#858d8e')}});
          roads++;
        } else if (points.length > 3 && (tags.landuse || tags.leisure || tags.natural)) {
          const water = tags.natural === 'water';
          const green = ['grass','forest','meadow','recreation_ground'].includes(tags.landuse)
            || ['park','garden','golf_course','pitch'].includes(tags.leisure) || ['wood','scrub','heath'].includes(tags.natural);
          const fill = water ? '#82adaf' : green ? '#a5b19b' : tags.landuse === 'residential' ? '#d1cebf' : '#babeae';
          viewer.entities.add({polygon: {hierarchy: new PolygonHierarchy(coordinates(points)), height: 0.1,
            material: color(fill), shadows: ShadowMode.RECEIVE_ONLY}});
        }
      }
      function inside(lon: number, lat: number, ring: number[][]) {
        let hit = false;
        for (let i = 0,j = ring.length - 1; i < ring.length; j = i++) {
          const [x,y] = ring[i], [px,py] = ring[j];
          if ((y > lat) !== (py > lat) && lon < (px-x)*(lat-y)/(py-y)+x) hit = !hit;
        }
        return hit;
      }
      let microsoftBuildings = 0;
      const allFootprints = [...buildingPolygons];
      for (const [i, feature] of microsoftFeatures.entries()) {
        if (feature.geometry.type !== 'Polygon') continue;
        const ring = feature.geometry.coordinates[0];
        const lon = ring.reduce((s,p) => s+p[0],0)/ring.length, lat = ring.reduce((s,p) => s+p[1],0)/ring.length;
        if (buildingPolygons.some(p => inside(lon,lat,p))) continue;
        const rawHeight = Number(feature.properties?.height ?? -1);
        addBuilding(ring, rawHeight > 0 && rawHeight < 150 ? rawHeight : 6.4, true, `microsoft-${i}`);
        allFootprints.push(ring);
        microsoftBuildings++;
      }
      // The user requested game-map-style volumes and explicitly accepts
      // approximate structures. These procedural houses are identified in the
      // source manifest and caption; they are never claimed as actual outlines.
      const illustrative = generateIllustrativeBuildings(osm.elements,allFootprints);
      illustrative.forEach((building,i) => addBuilding(building.ring,building.height,true,`illustrative-${i}`));
      viewer.entities.add({position: Cartesian3.fromDegrees(TARGET.longitude,TARGET.latitude,0.5),
        ellipse: {semiMajorAxis: 12, semiMinorAxis: 12, height: 0.5, material: color('#e1549c').withAlpha(0.75)}});
      api.source = {kind:'cartographic-preview',openStreetMap:source,microsoft:microsoftSource,
        naturalEarth: {name:'Natural Earth II',license:'Public domain',url:'https://www.naturalearthdata.com/about/terms-of-use/'},
        osmBuildings,microsoftBuildings,proceduralBuildings:illustrative.length,geometryCount,estimatedHeightCount,roads,
        proceduralMethod:'Illustrative house volumes aligned to nearby mapped roads, plus a symbolic target house if no footprint contains its coordinate. Not actual surveyed or inferred building outlines.',
        terrain:'Ellipsoid with flat illustrative local ground; no measured terrain model.',
        targetHouseVerified:false,photographicTextures:false,
        limitations:['Building footprints are mapped or AI-derived; heights are mostly estimated.',
          'The marker indicates the supplied coordinate; the specific house is not reconstructed or verified.']};
      async function settle(frames = 2) {
        await new Promise<void>((resolve,reject) => {
          let count = 0;
          const timeout = window.setTimeout(() => {remove();reject(new Error('La escena no terminó de dibujarse.'));},60000);
          const remove = scene.postRender.addEventListener(() => {
            count = scene.globe.tilesLoaded ? count+1 : 0;
            if (count >= frames) {remove();clearTimeout(timeout);resolve();}
          });
          scene.requestRender();
        });
      }
      function visible(selector: string) {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) return false;
        const bounds = element.getBoundingClientRect();
        return bounds.width>0 && bounds.height>0 && bounds.top>=0 && bounds.bottom<=innerHeight
          && getComputedStyle(element).visibility!=='hidden';
      }
      api.renderFrame = async index => {
        if (!Number.isInteger(index) || index<0 || index>=VIDEO.frames) throw new Error('Frame fuera de rango.');
        const pose = illustratedPose(index);
        const destination = Matrix4.multiplyByPoint(transform,new Cartesian3(pose.east,pose.north,pose.up),new Cartesian3());
        const direction = Cartesian3.normalize(Cartesian3.subtract(target,destination,new Cartesian3()),new Cartesian3());
        const localUp = Ellipsoid.WGS84.geodeticSurfaceNormal(destination,new Cartesian3());
        const right = Cartesian3.normalize(Cartesian3.cross(direction,localUp,new Cartesian3()),new Cartesian3());
        const up = Cartesian3.normalize(Cartesian3.cross(right,direction,new Cartesian3()),new Cartesian3());
        scene.camera.setView({destination,orientation:{direction,up}});
        localGround.show = pose.range < 20000;
        groundMaterial.color = new ConstantProperty(color('#c9c6b7').withAlpha(Math.max(0,Math.min(1,(20000-pose.range)/14000))));
        shell.current?.classList.toggle('in-space',pose.range>40000);
        await settle();
        const projected = SceneTransforms.worldToWindowCoordinates(scene,target);
        if (phase.current) phase.current.textContent = pose.range>1000000 ? 'DESDE LA ÓRBITA' : pose.range>10000 ? 'MÉXICO · QUERÉTARO' : pose.range>500 ? 'JURIQUILLA' : 'PASEO DE LIBERO 172';
        if (progress.current) progress.current.style.width = `${(index+1)/VIDEO.frames*100}%`;
        if (marker.current && projected) {marker.current.style.left=`${projected.x}px`;marker.current.style.top=`${projected.y}px`;}
        await settle();
        return {frame:index,time:index/VIDEO.fps,geometryCount,estimatedHeightCount,
          targetVisible:!!projected && projected.x>40 && projected.x<VIDEO.width-40 && projected.y>40 && projected.y<VIDEO.height-100,
          attributionVisible:visible('.illustrated-attribution'),approximationLabelVisible:visible('.approximation'),
          projectedTarget:projected ? {x:projected.x,y:projected.y} : {x:-1,y:-1}};
      };
      // Upload all entity geometry and preload every camera scale before recording.
      await api.renderFrame(450);
      await settle(60);
      for (const index of [0,90,150,210,270,330,360,450,600,750,899,0]) await api.renderFrame(index);
      setStatus('');
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      api.ready = true;
      if (!new URLSearchParams(location.search).has('render')) {
        let index = 0;
        const play = async () => {if(disposed||api.error)return;await api.renderFrame(index++%VIDEO.frames);if(!disposed)setTimeout(play,1000/VIDEO.fps);};
        void play();
      }
    }
    initialize().catch(error => {api.error=error instanceof Error ? error.message:String(error);setStatus(api.error);});
    return () => {disposed=true;if(viewer&&!viewer.isDestroyed())viewer.destroy();};
  },[]);
  return <div className="illustrated in-space" ref={shell}>
    <div className="scene" ref={container}/><div className="film-vignette"/>
    <header className="film-title"><div>QUERÉTARO, MÉXICO</div>
      <h1>Pink House</h1><p>Juriquilla · Querétaro</p></header>
    <div className="film-phase"><span className="film-dot"/><span ref={phase}>DESDE LA ÓRBITA</span></div>
    <div className="target-marker" ref={marker}><div className="target-label">PINK HOUSE</div><div className="target-stem"/><div className="target-dot"/></div>
    <footer className="film-footer"><div className="approximation">VISUALIZACIÓN APROXIMADA · ALTURAS ESTIMADAS <span> · ESTRUCTURAS ESTILIZADAS</span></div>
      <div className="illustrated-attribution">© OpenStreetMap contributors · openstreetmap.org/copyright | Natural Earth{microsoft&&' | Edificios: Microsoft · CDLA Permissive 2.0'}</div>
      <div className="credits" ref={credits}/><div className="film-progress"><div ref={progress}/></div></footer>
    {status&&<div className="status"><div className="card"><div className="eyebrow">Juriquilla · Querétaro</div><h1>Preparando el recorrido</h1><p>{status}</p></div></div>}
  </div>;
}
