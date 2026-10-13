import { chromium } from '../aerial/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5174';
const output = path.resolve('output/globe-qa/lifecycle');
await mkdir(output, { recursive: true });
const report = { base, checks: [], snapshots: {}, pageErrors: [] };
const check = (name, pass, details) => {
  report.checks.push({ name, pass: !!pass, details });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`);
};
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
page.on('pageerror', error => report.pageErrors.push(error.message));
await page.route('**/__globe-lifecycle', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body style="margin:0;background:black"><main style="width:600px;height:600px"><canvas id="globe" style="width:100%;height:100%"></canvas></main></body></html>' }));
await page.addInitScript(() => {
  const activeRafs = new Set();
  const request = window.requestAnimationFrame.bind(window), cancel = window.cancelAnimationFrame.bind(window);
  window.requestAnimationFrame = callback => {
    const id = request(time => { activeRafs.delete(id); callback(time); });
    activeRafs.add(id); return id;
  };
  window.cancelAnimationFrame = id => { activeRafs.delete(id); cancel(id); };
  const listeners = new Map();
  const add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener;
  const watched = target => target === window || target === document || target instanceof HTMLCanvasElement || target instanceof MediaQueryList;
  EventTarget.prototype.addEventListener = function(type, handler, options) {
    if (handler && watched(this)) {
      const list = listeners.get(this) || []; const capture = typeof options === 'boolean' ? options : !!options?.capture;
      if (!list.some(entry => entry.type === type && entry.handler === handler && entry.capture === capture)) list.push({type, handler, capture});
      listeners.set(this, list);
    }
    return add.call(this, type, handler, options);
  };
  EventTarget.prototype.removeEventListener = function(type, handler, options) {
    if (watched(this)) {
      const capture = typeof options === 'boolean' ? options : !!options?.capture;
      const list = listeners.get(this) || [];
      listeners.set(this, list.filter(entry => entry.type !== type || entry.handler !== handler || entry.capture !== capture));
    }
    return remove.call(this, type, handler, options);
  };
  const observers = new Set();
  for (const name of ['ResizeObserver', 'IntersectionObserver']) {
    const Native = window[name];
    window[name] = class extends Native {
      constructor(...args) { super(...args); observers.add(this); }
      disconnect() { observers.delete(this); return super.disconnect(); }
    };
  }
  window.__lifecycle = () => ({ rafs: activeRafs.size, listeners: [...listeners.values()].reduce((sum, list) => sum + list.length, 0), observers: observers.size,
    listenerTypes: [...listeners.entries()].flatMap(([target,list])=>list.map(entry=>({target:target===window?'window':target===document?'document':target.constructor.name,type:entry.type,handler:entry.handler.name||'anonymous'}))) });
});

try {
  await page.goto(`${base}/__globe-lifecycle`);
  // Playwright installs its own document input helpers on the first predicate.
  // Warm those helpers before measuring resources owned by our renderer.
  await page.waitForFunction(() => document.readyState === 'complete');
  await page.evaluate(async () => {
    const { GlobeRenderer } = await import('/src/globe/GlobeRenderer.ts');
    window.__Renderer = GlobeRenderer;
    window.__baseline = window.__lifecycle();
    window.__frozen = false;
    window.__statuses = [];
    window.__restored = 0;
    window.__make = (mapUrl = '/images/juriquilla-map.svg', overrides = {}) => new GlobeRenderer({
      canvas: document.querySelector('#globe'), mapUrl,
      markers: [{ id: 'center', latitude: 0, longitude: 0 }],
      isFrozen: () => window.__frozen,
      onStatus: status => window.__statuses.push(status),
      onContextRestored: () => { window.__restored++; window.__globe.dispose(); window.__globe = window.__make(); },
      ...overrides,
    });
    window.__globe = window.__make();
    window.__snapshot = () => {
      const globe = window.__globe;
      const targets = [globe.mapTarget, globe.noiseTarget, globe.coronaRead, globe.coronaWrite];
      return { ...window.__lifecycle(), memory: {...globe.renderer.info.memory}, yaw: globe.interaction.yaw,
        time: globe.time, frame: globe.frameCount, quality: globe.quality.name, resolution: globe.quality.resolution,
        targets: targets.map(target => ({ id: target.texture.uuid, width: target.width, height: target.height })),
        trailSize: globe.trail.canvas.width, noiseResolution: globe.noiseMaterial.uniforms.uResolution.value.toArray(),
        backing: [globe.options.canvas.width, globe.options.canvas.height], statuses: [...window.__statuses],
        lost: globe.lost, released: globe.gpuReleased, restored: window.__restored };
    };
  });
  await page.waitForFunction(() => window.__statuses.at(-1) === 'ready');
  await page.waitForTimeout(100);
  const baseline = await page.evaluate(() => window.__baseline);
  const initial = await page.evaluate(() => window.__snapshot());
  report.snapshots.initial = initial;
  const backend = await page.evaluate(() => {
    const gl = document.querySelector('#globe').getContext('webgl2');
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    return extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
  report.backend = backend;
  check('initial desktop allocates four 512-square targets and capped DPR2 backing', initial.targets.every(target => target.width === 512 && target.height === 512) && initial.backing[0] === 1200, initial);
  const idle = await page.evaluate(async () => {
    const first = window.__snapshot(); const start = performance.now();
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {first, last:window.__snapshot(), seconds:(performance.now()-start)/1000};
  });
  const degrees = (idle.last.yaw - idle.first.yaw + 360) % 360;
  check('automatic rotation remains 6 degrees per elapsed second', Math.abs(degrees / idle.seconds - 6) < .25, {...idle, degreesPerSecond:degrees/idle.seconds});

  await page.evaluate(()=>document.querySelector('main').style.transform='translateY(3000px)');
  await page.waitForTimeout(70);
  const offscreen=await page.evaluate(()=>window.__snapshot());
  await page.waitForTimeout(180);
  const offscreenAgain=await page.evaluate(()=>window.__snapshot());
  check('offscreen rendering suspends its RAF, clock and feedback',offscreenAgain.rafs===baseline.rafs && offscreenAgain.time===offscreen.time && offscreenAgain.frame===offscreen.frame,{offscreen,offscreenAgain});
  await page.evaluate(()=>document.querySelector('main').style.transform='');
  await page.waitForTimeout(80);
  const onscreen=await page.evaluate(()=>window.__snapshot());
  check('offscreen resume drops the suspended interval instead of catching up',onscreen.time-offscreenAgain.time<.15 && onscreen.frame-offscreenAgain.frame<10,{offscreenAgain,onscreen});
  await page.evaluate(()=>{
    window.__hidden=true;
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__hidden});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const hidden=await page.evaluate(()=>window.__snapshot());
  await page.waitForTimeout(180);
  const hiddenAgain=await page.evaluate(()=>window.__snapshot());
  check('document hiding suspends rendering without accumulated clock advance',hiddenAgain.rafs===baseline.rafs && hiddenAgain.time===hidden.time && hiddenAgain.frame===hidden.frame,{hidden,hiddenAgain});
  await page.evaluate(()=>{window.__hidden=false;document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForTimeout(80);
  const visible=await page.evaluate(()=>window.__snapshot());
  check('document visibility resume skips stale feedback catchup',visible.time-hiddenAgain.time<.15 && visible.frame-hiddenAgain.frame<10,{hiddenAgain,visible});

  await page.evaluate(() => { window.__frozen = true; window.__globe.command('refresh'); });
  await page.waitForTimeout(60);
  const frozen = await page.evaluate(() => window.__snapshot());
  await page.waitForTimeout(300);
  const frozenAgain = await page.evaluate(() => window.__snapshot());
  check('application focus/dialog/pause freezes yaw, noise clock and feedback', frozen.yaw === frozenAgain.yaw && frozen.time === frozenAgain.time && frozen.frame === frozenAgain.frame, {frozen, frozenAgain});
  await page.evaluate(() => window.__globe.command('right'));
  await page.waitForTimeout(60);
  const keyboard = await page.evaluate(() => window.__snapshot());
  check('manual rotation remains available while autonomous effects are paused', Math.abs((keyboard.yaw - frozen.yaw + 360) % 360 - 16) < .01 && keyboard.time === frozen.time && keyboard.frame === frozen.frame, keyboard);

  await page.evaluate(() => { window.__frozen = false; window.__globe.setMarkerHover('center'); });
  await page.waitForTimeout(80);
  const hover = await page.evaluate(() => window.__snapshot());
  await page.waitForTimeout(250);
  const hoverAgain = await page.evaluate(() => window.__snapshot());
  check('Nike marker hover pauses rotation while noise, pulse and corona continue', hover.yaw === hoverAgain.yaw && hoverAgain.time > hover.time && hoverAgain.frame > hover.frame, {hover, hoverAgain});
  await page.evaluate(() => window.__globe.setMarkerHover(null));

  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForTimeout(100);
  const reduced = await page.evaluate(() => window.__snapshot());
  await page.waitForTimeout(250);
  const reducedAgain = await page.evaluate(() => window.__snapshot());
  check('reduced motion rebuilds every target/trail/uniform to 256 and releases old targets', reduced.targets.every(target => target.width === 256 && !initial.targets.some(old => old.id === target.id)) && reduced.trailSize === 256 && reduced.noiseResolution.every(size => size === 256) && reduced.memory.textures === initial.memory.textures, reduced);
  check('reduced motion stays static with no outstanding animation frame', reduced.yaw === reducedAgain.yaw && reduced.time === reducedAgain.time && reduced.frame === reducedAgain.frame && reducedAgain.rafs === 0, {reduced, reducedAgain});
  await page.evaluate(() => window.__globe.command('right'));
  await page.waitForTimeout(60);
  const reducedKey = await page.evaluate(() => window.__snapshot());
  check('reduced motion permits direct rotation without restarting procedural animation', Math.abs((reducedKey.yaw-reduced.yaw+360)%360-16)<.01 && reducedKey.time===reduced.time && reducedKey.frame===reduced.frame && reducedKey.rafs===0, reducedKey);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.waitForTimeout(100);
  const restoredDesktop = await page.evaluate(() => window.__snapshot());
  check('dynamic quality returns to real 512 allocations without texture-count growth', restoredDesktop.targets.every(target => target.width===512 && !reduced.targets.some(old=>old.id===target.id)) && restoredDesktop.memory.textures===initial.memory.textures, restoredDesktop);

  await page.evaluate(() => { window.__extension = document.querySelector('#globe').getContext('webgl2').getExtension('WEBGL_lose_context'); window.__extension.loseContext(); });
  await page.waitForTimeout(100);
  const lost = await page.evaluate(() => window.__snapshot());
  check('context loss releases all GPU memory, RAFs, observers and input listeners', lost.lost && lost.released && lost.memory.textures===0 && lost.memory.geometries===0 && lost.rafs===baseline.rafs && lost.observers===baseline.observers && lost.listeners===baseline.listeners+1 && lost.statuses.at(-1)==='fallback', {baseline,lost});
  await page.evaluate(() => window.__extension.restoreContext());
  await page.waitForFunction(() => window.__restored===1 && window.__statuses.at(-1)==='ready',{timeout:10000});
  const restored = await page.evaluate(() => window.__snapshot());
  check('restoration recreates a ready renderer on the same canvas', restored.restored===1 && !restored.lost && restored.memory.textures===initial.memory.textures, restored);

  await page.evaluate(() => window.__globe.dispose());
  const disposed = await page.evaluate(() => ({...window.__lifecycle(),memory:{...window.__globe.renderer.info.memory}}));
  check('normal disposal removes every owned RAF/listener/observer and GPU resource', disposed.rafs===baseline.rafs && disposed.listeners===baseline.listeners && disposed.observers===baseline.observers && disposed.memory.textures===0 && disposed.memory.geometries===0, {baseline,disposed});
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type,...args) { return type==='2d' ? null : original.call(this,type,...args); };
    try { window.__make(); } catch(error) { window.__partialError=error.message; }
    finally { HTMLCanvasElement.prototype.getContext=original; }
  });
  const partial = await page.evaluate(() => ({...window.__lifecycle(),error:window.__partialError}));
  check('partial Canvas2D constructor failure leaves no listeners, observers or RAFs', !!partial.error && partial.rafs===baseline.rafs && partial.listeners===baseline.listeners && partial.observers===baseline.observers, {baseline,partial});

  await page.evaluate(() => { window.__globe=window.__make('/images/does-not-exist-globe.png'); });
  await page.waitForFunction(() => window.__globe.lost && window.__globe.gpuReleased);
  const assetFailure = await page.evaluate(() => window.__snapshot());
  check('map loading failure releases resources while retaining only restoration listener', assetFailure.memory.textures===0 && assetFailure.memory.geometries===0 && assetFailure.rafs===baseline.rafs && assetFailure.listeners===baseline.listeners+1, assetFailure);
  await page.evaluate(() => window.__globe.dispose());
  await page.evaluate(() => { window.__globe=window.__make(); });
  await page.waitForFunction(() => window.__globe.ready);
  await page.evaluate(() => {
    window.__globe.noiseMaterial.fragmentShader='void main() { gl_FragColor = deliberatelyMissingShaderValue; }';
    window.__globe.noiseMaterial.needsUpdate=true;
  });
  await page.waitForFunction(() => window.__globe.lost && window.__globe.gpuReleased);
  const shaderFailure=await page.evaluate(()=>window.__snapshot());
  check('shader compilation failure exits the pipeline and safely releases GPU resources',shaderFailure.memory.textures===0 && shaderFailure.memory.geometries===0 && shaderFailure.rafs===baseline.rafs && shaderFailure.listeners===baseline.listeners+1,shaderFailure);
  await page.evaluate(() => window.__globe.dispose());
  const cycles=[];
  for(let cycle=0;cycle<3;cycle++) {
    await page.evaluate(() => { window.__globe=window.__make(); });
    await page.waitForFunction(() => window.__globe.ready);
    const live=await page.evaluate(() => window.__snapshot());
    await page.evaluate(() => window.__globe.dispose());
    cycles.push({live,disposed:await page.evaluate(()=>window.__lifecycle())});
  }
  check('repeated mount/dispose on retained WebGL2 context does not grow resources', cycles.every(cycle=>cycle.live.memory.textures===initial.memory.textures && cycle.disposed.listeners===baseline.listeners && cycle.disposed.rafs===baseline.rafs && cycle.disposed.observers===baseline.observers), cycles);
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{
    Object.defineProperty(navigator,'hardwareConcurrency',{configurable:true,value:2});
    Object.defineProperty(navigator,'deviceMemory',{configurable:true,value:2});
    window.__globe=window.__make();
  });
  await page.waitForFunction(()=>window.__globe.ready);
  const low=await page.evaluate(()=>window.__snapshot());
  await page.evaluate(()=>{
    Object.defineProperty(navigator,'hardwareConcurrency',{configurable:true,value:6});
    Object.defineProperty(navigator,'deviceMemory',{configurable:true,value:0});
    window.__globe.resize();
  });
  await page.waitForTimeout(80);
  const medium=await page.evaluate(()=>window.__snapshot());
  await page.evaluate(()=>{
    Object.defineProperty(navigator,'hardwareConcurrency',{configurable:true,value:8});
    Object.defineProperty(navigator,'deviceMemory',{configurable:true,value:8});
    window.__globe.resize();
  });
  await page.waitForTimeout(80);
  const high=await page.evaluate(()=>window.__snapshot());
  check('mobile low/medium/high rebuild all targets to 320/384/512 with exact DPR caps',low.quality==='mobile-low' && low.targets.every(target=>target.width===320) && low.backing[0]===600 && medium.quality==='mobile-medium' && medium.targets.every(target=>target.width===384) && medium.backing[0]===720 && high.quality==='mobile-high' && high.targets.every(target=>target.width===512) && high.backing[0]===900 && high.memory.textures===low.memory.textures, {low,medium,high});
  await page.evaluate(()=>{
    window.__frozen=true;
    const stage=document.querySelector('main');stage.style.position='relative';
    const ring=document.createElement('span');ring.id='ring';
    ring.style.cssText='position:absolute;width:10px;height:10px;border:1px solid white;transform:translate(-50%,-50%);box-sizing:border-box;pointer-events:none';
    stage.append(ring);
    window.__globe.options.onMarkers=points=>{const point=points[0];ring.style.left=`${point.x}px`;ring.style.top=`${point.y}px`;};
    window.__globe.command('refresh');
  });
  await page.waitForTimeout(50);
  const unscaled=await page.evaluate(()=>({state:window.__snapshot(),point:{...window.__globe.projectedMarkers[0]}}));
  await page.evaluate(()=>{
    document.querySelector('main').style.transform='scale(1.2)';
    window.__globe.resize();
  });
  await page.waitForTimeout(50);
  const scaled=await page.evaluate(()=>{
    const globe=window.__globe,canvas=document.querySelector('#globe'),rect=canvas.getBoundingClientRect(),ring=document.querySelector('#ring').getBoundingClientRect();
    return {state:window.__snapshot(),layout:[globe.width,globe.height],client:[canvas.clientWidth,canvas.clientHeight],rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},point:{...globe.projectedMarkers[0]},ringCenter:[ring.x+ring.width/2,ring.y+ring.height/2]};
  });
  check('CSS scale1.2 keeps layout/DPR backing stable and transforms marker anchor exactly once',scaled.rect.width===720 && scaled.state.backing[0]===unscaled.state.backing[0] && scaled.layout[0]===600 && Math.abs(scaled.point.x-unscaled.point.x)<.01 && Math.abs(scaled.point.y-unscaled.point.y)<.01 && Math.abs(scaled.ringCenter[0]-(scaled.rect.x+scaled.point.x*1.2))<.05 && Math.abs(scaled.ringCenter[1]-(scaled.rect.y+scaled.point.y*1.2))<.05,{unscaled,scaled});
  await page.evaluate(()=>{window.__frozen=false;window.__globe.setMarkerHover('center');});
  await page.waitForTimeout(30);
  await page.mouse.move(scaled.rect.x+scaled.rect.width*.25,scaled.rect.y+scaled.rect.height*.75);
  await page.waitForTimeout(30);
  const scaledPointer=await page.evaluate(()=>window.__globe.interaction.motion.position.toArray());
  check('scaled-canvas pointer raycasting still uses screen bounds and correct square-plane UV',Math.abs(scaledPointer[0]-.25)<.001 && Math.abs(scaledPointer[1]-.75)<.001,scaledPointer);
  await page.evaluate(()=>window.__globe.dispose());

  await page.evaluate(()=>{
    window.__frozen=false;
    document.querySelector('main').style.transform='translateY(3000px) scale(2)';
    window.__globe=window.__make('/images/juriquilla-map.svg',{offscreenSuspension:false});
    window.__globe.setPresentation({rotationOffset:0,blur:14,active:false});
  });
  await page.waitForFunction(()=>window.__globe.ready);
  const backgroundInitial=await page.evaluate(()=>window.__snapshot());
  await page.waitForTimeout(180);
  const backgroundRunning=await page.evaluate(()=>window.__snapshot());
  check('persistent background starts rendering and rotating while CSS-translated offscreen',backgroundRunning.time>backgroundInitial.time && backgroundRunning.frame>backgroundInitial.frame && backgroundRunning.yaw>backgroundInitial.yaw && backgroundRunning.rafs===1,{backgroundInitial,backgroundRunning});
  await page.evaluate(()=>{window.__frozen=true;window.__globe.command('refresh');});
  await page.waitForTimeout(40);
  const presentationBefore=await page.evaluate(()=>({...window.__snapshot(),sharp:window.__globe.sharpMask.uuid,soft:window.__globe.softMask.uuid}));
  await page.evaluate(()=>window.__globe.setPresentation({rotationOffset:72,blur:4,active:false}));
  await page.waitForTimeout(40);
  const presentationAfter=await page.evaluate(()=>{
    const globe=window.__globe,point=globe.projectedMarkers[0],angle=(globe.interaction.yaw+72)*Math.PI/180;
    return {...window.__snapshot(),sharp:globe.sharpMask.uuid,soft:globe.softMask.uuid,mapBlur:globe.blendMaterial.uniforms.mapBlur.value,
      effectiveSphereAngle:globe.sphere.rotation.y+Math.PI/2,point,expectedMarkerX:300+Math.sin(angle)*1.56/2*300};
  });
  check('scroll rotation offsets sphere and marker equally without changing autonomous yaw',presentationAfter.yaw===presentationBefore.yaw && Math.abs(presentationAfter.effectiveSphereAngle-(presentationAfter.yaw+72)*Math.PI/180)<1e-8 && Math.abs(presentationAfter.point.x-presentationAfter.expectedMarkerX)<.001,presentationAfter);
  check('scroll blur replaces masks and map blur while preserving feedback history',presentationAfter.frame===presentationBefore.frame && presentationAfter.targets.every(target=>presentationBefore.targets.some(old=>old.id===target.id)) && presentationAfter.soft!==presentationBefore.soft && presentationAfter.mapBlur===7 && presentationAfter.memory.textures===presentationBefore.memory.textures,{presentationBefore,presentationAfter});
  await page.evaluate(()=>window.__globe.setPresentation({rotationOffset:72,blur:4,active:false}));
  const presentationIdentical=await page.evaluate(()=>({sharp:window.__globe.sharpMask.uuid,soft:window.__globe.softMask.uuid,frame:window.__globe.frameCount}));
  check('unchanged presentation input preserves mask allocations and feedback frame',presentationIdentical.sharp===presentationAfter.sharp && presentationIdentical.soft===presentationAfter.soft && presentationIdentical.frame===presentationAfter.frame,presentationIdentical);
  await page.evaluate(()=>{window.__frozen=false;window.__globe.setPresentation({rotationOffset:288,blur:0,active:true});});
  await page.waitForTimeout(70);
  const revealed=await page.evaluate(()=>({...window.__snapshot(),active:window.__globe.presentationActive,offset:window.__globe.presentationRotationOffset,mapBlur:window.__globe.blendMaterial.uniforms.mapBlur.value}));
  check('revealed background resumes its existing clock and settled source blur',revealed.time>presentationAfter.time && revealed.active && revealed.offset===288 && revealed.mapBlur===3,revealed);
  await page.evaluate(()=>window.__globe.dispose());
  check('no uncaught browser errors occurred', report.pageErrors.length===0, report.pageErrors);
  report.snapshots = {...report.snapshots, offscreen,onscreen,hidden,visible, frozen, hover, reduced, restoredDesktop, lost, restored, disposed, partial, assetFailure, shaderFailure, cycles, low, medium, high, unscaled,scaled,scaledPointer,backgroundInitial,backgroundRunning,presentationBefore,presentationAfter,presentationIdentical,revealed};
} catch(error) {
  check('lifecycle scenario completed',false,error.stack||String(error));
} finally {
  await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
  await browser.close();
}
if(report.checks.some(check=>!check.pass)) process.exitCode=1;
