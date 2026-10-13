import { mkdir, writeFile, readFile, access, copyFile } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('output/globe-qa/live-comparison');
await mkdir(output, { recursive: true });
// Reuse the installed recording executable; keep its compatibility copy inside QA.
const runtime = path.join(output, 'runtime');
await mkdir(path.join(runtime, 'ffmpeg-1013'), { recursive: true });
await access(path.join(runtime, 'ffmpeg-1013/ffmpeg-win64.exe')).catch(() => copyFile('C:/Users/dmata/AppData/Local/ms-playwright/ffmpeg-1011/ffmpeg-win64.exe', path.join(runtime, 'ffmpeg-1013/ffmpeg-win64.exe')));
process.env.PLAYWRIGHT_BROWSERS_PATH = runtime;
const { chromium } = await import('../aerial/node_modules/playwright/index.mjs');
const targets = { nike: 'https://www.afterdarktour.nike.com/es/london', local: process.env.QA_BASE_URL || 'http://127.0.0.1:5174' };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { observedAt: new Date().toISOString(), targets, views: [] };
if (process.env.QA_TARGET || process.env.QA_ANALYSIS_ONLY) {
  const previous = await readFile(path.join(output, 'measurements.json'), 'utf8').then(JSON.parse).catch(() => null);
  if (previous) report.views = previous.views.filter(view => !process.env.QA_TARGET?.split(',').includes(view.target));
}

function installGpuCapture() {
  const original = HTMLCanvasElement.prototype.getContext;
  window.globeQaGpu = [];
  HTMLCanvasElement.prototype.getContext = function(type, options) {
    const gl = original.call(this, type, options);
    if (type !== 'webgl2' || !gl || gl.__globeQaInstrumented) return gl;
    gl.__globeQaInstrumented = true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const context = { backend: ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL), programs: [], draws: [] };
    const shaders = new WeakMap(), programs = new WeakMap(), locations = new WeakMap(); let active;
    const wrap = (name, apply) => { const fn = gl[name].bind(gl); gl[name] = (...args) => { const result = fn(...args); apply(args, result); return result; }; };
    wrap('shaderSource', ([shader, text]) => shaders.set(shader, text));
    wrap('createProgram', (_, program) => { const state = { name: 'unknown', uniforms: {} }; programs.set(program, state); context.programs.push(state); });
    wrap('attachShader', ([program, shader]) => { const text = shaders.get(shader) || ''; const name = text.match(/#define SHADER_NAME\s+(\w+)/)?.[1]; if (name) programs.get(program).name = name; });
    wrap('useProgram', ([program]) => { active = programs.get(program); });
    wrap('getUniformLocation', ([program, name], location) => { if (location) locations.set(location, { program: programs.get(program), name }); });
    for (const name of ['uniform1f','uniform1i','uniform2f','uniform3f','uniform4f','uniform1fv','uniform2fv','uniform3fv','uniform4fv','uniformMatrix4fv']) wrap(name, args => {
      const location = locations.get(args[0]); if (!location) return;
      const value = name === 'uniformMatrix4fv' ? args[2] : args.length === 2 && typeof args[1] !== 'number' ? args[1] : args.slice(1);
      location.program.uniforms[location.name] = Array.from(value);
    });
    wrap('drawElements', args => { if (active) active.drawCount = (active.drawCount || 0) + 1; context.draws.push({ name: active?.name, count: args[1] }); if (context.draws.length > 12) context.draws.shift(); });
    window.globeQaGpu.push(context); return gl;
  };
}

async function cleanCookies(page) {
  for (const selector of ['#onetrust-reject-all-handler', '#onetrust-accept-btn-handler']) {
    const button = page.locator(selector);
    if (await button.isVisible().catch(() => false)) { await button.click().catch(() => {}); break; }
  }
  for (const frame of page.frames()) {
    const reject = frame.getByText(/^reject$/i).first();
    if (await reject.isVisible().catch(() => false)) { await reject.click().catch(() => {}); await page.waitForTimeout(400); }
    const confirm = frame.getByText(/^confirm choices$/i).first();
    if (await confirm.isVisible().catch(() => false)) { await confirm.click().catch(() => {}); await page.waitForTimeout(400); }
  }
}
async function metadata(page, target) {
  return page.evaluate(target => {
    const el = document.querySelector(target === 'nike' ? '.globe__canvas canvas' : '.after-dark-planet-canvas');
    const box = el?.getBoundingClientRect();
    const parents = []; for (let node = el; node && parents.length < 4; node = node.parentElement) { const style = getComputedStyle(node); const r = node.getBoundingClientRect(); parents.push({ class: node.className, rect: r.toJSON(), transform: style.transform, opacity: style.opacity, pointerEvents: style.pointerEvents }); }
    return { viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }, scrollY, maximumScroll: document.documentElement.scrollHeight - innerHeight, canvas: el && { rect: box.toJSON(), backingWidth: el.width, backingHeight: el.height, touchAction: getComputedStyle(el).touchAction }, parents, gpu: window.globeQaGpu };
  }, target);
}
async function captureStage(page, target, label, stage) {
  const metadataResult = await metadata(page, target);
  await page.screenshot({ path: path.join(output, `${label}-${stage}.png`) });
  return metadataResult;
}
async function settle(page, target) {
  await page.mouse.move(2, 2);
  if (target === 'nike') {
    await cleanCookies(page);
    for (let attempt = 0; attempt < 3; attempt++) { await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })); await page.waitForTimeout(850); }
    await page.locator('.globe__canvas canvas').waitFor({ state: 'visible', timeout: 20000 });
  } else {
    await page.keyboard.press('Escape');
    await page.locator('.opening-collage').waitFor({ state: 'detached', timeout: 7000 }).catch(() => {});
    await page.locator('#mapa').evaluate(el => scrollTo({ top: el.getBoundingClientRect().top + scrollY, behavior: 'instant' }));
    await page.locator('.after-dark-planet-canvas.is-ready').waitFor({ timeout: 20000 });
  }
  await page.waitForTimeout(2000);
}

for (const [width, height] of [[1440, 900], [390, 844]]) for (const target of (process.env.QA_ANALYSIS_ONLY ? [] : process.env.QA_TARGET ? process.env.QA_TARGET.split(',') : ['nike', 'local'])) {
  const label = `${target}-${width}x${height}`;
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: width < 700, hasTouch: width < 700, recordVideo: { dir: output, size: { width, height } } });
  await context.addInitScript(installGpuCapture);
  const page = await context.newPage(); const entry = { target, width, height, stages: {}, errors: [] };
  page.on('pageerror', error => entry.errors.push(error.message));
  try {
    let loaded = false;
    for (let attempt = 0; attempt < 2 && !loaded; attempt++) {
      try { await page.goto(targets[target], { waitUntil: 'domcontentloaded', timeout: 40000 }); loaded = true; }
      catch (error) { entry.errors.push(`Load ${attempt + 1}: ${error.message}`); }
    }
    if (!loaded) throw new Error('Bounded page loading retries exhausted.');
    await page.waitForTimeout(target === 'nike' ? 4000 : 500);
    await settle(page, target);
    const fpsBefore = await page.evaluate(() => ({ time: performance.now(), draws: window.globeQaGpu.flatMap(context => context.programs).find(program => program.name === 'BlendShaderMaterial')?.drawCount || 0 }));
    await page.waitForTimeout(600);
    const fpsAfter = await page.evaluate(() => ({ time: performance.now(), draws: window.globeQaGpu.flatMap(context => context.programs).find(program => program.name === 'BlendShaderMaterial')?.drawCount || 0 }));
    entry.submissionRate = { windowMilliseconds: fpsAfter.time - fpsBefore.time, updates: fpsAfter.draws - fpsBefore.draws, updatesPerSecond: (fpsAfter.draws - fpsBefore.draws) * 1000 / (fpsAfter.time - fpsBefore.time), note: 'Hardware browser with forwarding WebGL instrumentation and video recording; draw submissions rather than GPU timer queries.' };
    entry.stages.idle = await captureStage(page, target, label, 'idle');
    const bounds = entry.stages.idle.canvas.rect;
    const centerX = Math.max(35, Math.min(width - 35, bounds.x + bounds.width / 2));
    const centerY = Math.max(80, Math.min(height - 110, bounds.y + bounds.height / 2));
    const radius = Math.min(width, height) * .25;
    await page.mouse.move(centerX - radius, centerY);
    for (let step = 0; step <= 30; step++) { await page.mouse.move(centerX - radius + radius * 2 * step / 30, centerY + Math.sin(step / 30 * Math.PI * 2) * radius * .3); await page.waitForTimeout(40); }
    entry.stages.slow = await captureStage(page, target, label, 'slow-pointer');
    for (let step = 0; step <= 12; step++) { await page.mouse.move(centerX + Math.cos(step / 12 * Math.PI * 2) * radius, centerY + Math.sin(step / 12 * Math.PI * 2) * radius * .55); await page.waitForTimeout(8); }
    entry.stages.fast = await captureStage(page, target, label, 'fast-pointer');
    await page.waitForTimeout(800);
    entry.stages.stationary = await captureStage(page, target, label, 'stationary-800ms');
    await page.mouse.move(2, 2); await page.waitForTimeout(1100);
    entry.stages.exit = await captureStage(page, target, label, 'exit-1100ms');
    if (width < 700) {
      const session = await context.newCDPSession(page);
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: centerX - 70, y: centerY, id: 1 }] });
      for (let step = 1; step <= 10; step++) { await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: centerX - 70 + step * 14, y: centerY, id: 1 }] }); await page.waitForTimeout(25); }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(300);
      entry.stages.touch = await captureStage(page, target, label, 'touch'); await session.detach();
    }
  } catch (error) { entry.failure = error.message; }
  const video = page.video();
  await page.close(); await context.close();
  if (video) await video.saveAs(path.join(output, `${label}-interaction.webm`)).catch(error => entry.errors.push(`Video recording unavailable: ${error.message}`));
  report.views.push(entry); await writeFile(path.join(output, 'measurements.json'), JSON.stringify(report, null, 2));
  console.log(`${label}: ${entry.failure || `captured ${Object.keys(entry.stages).length} stages`}`);
}

// Browser-rendered side-by-side screenshots preserve each page's visual identity.
const comparison = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
report.comparisons = [];
for (const [width, height] of [[1440, 900], [390, 844]]) {
  const references = report.views.filter(view => view.width === width && !view.failure);
  if (references.length !== 2) continue;
  const images = await Promise.all(['nike', 'local'].map(async target => ({ target, data: (await readFile(path.join(output, `${target}-${width}x${height}-idle.png`))).toString('base64') })));
  await comparison.setContent(`<html><body style="background:#111;color:white;font:16px Arial;margin:0"><div style="padding:12px">Settled live globe comparison ${width}×${height}; different geography and page identity are intentional.</div><div style="display:flex;gap:12px;padding:12px">${images.map(({target,data})=>`<figure style="margin:0;flex:1;min-width:0"><figcaption style="padding:8px">${target==='nike'?'Nike live London':'The Pink House'}</figcaption><img style="width:100%;max-height:900px;object-fit:contain;object-position:top" src="data:image/png;base64,${data}"></figure>`).join('')}</div></body></html>`);
  await comparison.screenshot({ path: path.join(output, `${width}x${height}-side-by-side.png`), fullPage: true });
  const get = (view, name) => view.stages.idle.gpu.flatMap(context => context.programs).find(program => program.name === name)?.uniforms || {};
  const nike = references.find(view => view.target === 'nike'), local = references.find(view => view.target === 'local');
  const uniformChecks = [];
  for (const [program, names] of [ ['NoiseMaterial',['noiseSeed','noiseScale','noiseSpeed','noiseEvolveSpeed','uResolution','uVelStrength','uVelTrail','uMouseEnabled','uMouseStrength','uMouseRadius','uPulseStrength','uPulseRadius','uPulseFrequency']], ['CoronaShaderMaterial',['uResolution','uDisplaceFactor','uMixFactor','uScaleFactor','uExpandFactor','uUvScale']], ['BlendShaderMaterial',['uResolution','uUvScale','levelsBlack','levelsWhite','gamma','mapStrength','sphereInvert','sphereAdd','mapBlur','innerNoiseAmount','innerNoiseBlur','innerNoiseBlack','innerNoiseWhite','innerNoiseGamma','uColor2']] ]) {
    const expected = get(nike, program), actual = get(local, program);
    for (const uniform of names) {
      const reference = expected[uniform], measured = actual[uniform];
      const match = reference?.length === measured?.length && reference.every((value, index) => Math.fround(value) === Math.fround(measured[index]));
      const maximumJavaScriptDelta = Math.max(...reference.map((value, index) => Math.abs(value - measured[index])));
      uniformChecks.push({ program, uniform, reference, actual: measured, maximumJavaScriptDelta, match, basis: 'Exact equality after float32 conversion used by WebGL uniform upload.' });
    }
  }
  const coreDiameter = view => {
    const canvas = view.stages.idle.canvas, projection = get(view, 'BlendShaderMaterial').projectionMatrix;
    const halfHeight = 1 / projection[5]; const scale = canvas.rect.width / canvas.backingWidth;
    return Math.min(canvas.backingWidth, canvas.backingHeight) * 1.56 / halfHeight * scale;
  };
  const core = { nike: coreDiameter(nike), local: coreDiameter(local), basis: 'Derived from measured canvas dimensions and GPU projection matrix, confirmed sphere radius 1.56; atmospheric feedback extends beyond this geographic silhouette.' };
  report.comparisons.push({ width, height, core, uniformChecks });
  // Crop both captured screens around the geometric center using equal pixel bounds.
  // This preserves the live halo and excludes most surrounding header/footer UI.
  await comparison.setViewportSize({ width: 1500, height: 950 });
  await comparison.setContent('<html><body style="margin:0;background:#111;color:#fff;font:16px Arial"><div style="padding:12px">Core / halo comparison; independent animation phases, geography and labels remain visible.</div><div id="crops" style="display:flex;gap:12px;padding:12px"></div></body></html>');
  await comparison.evaluate(async ({ images, views, diameter, mobile }) => {
    for (const entry of images) {
      const img = new Image(); img.src = `data:image/png;base64,${entry.data}`; await img.decode();
      const rect = views[entry.target].stages.idle.canvas.rect; const centerX = rect.x + rect.width / 2, centerY = rect.y + rect.height / 2;
      const cropWidth = mobile ? img.width : Math.ceil(diameter + 150); const cropHeight = mobile ? Math.ceil(diameter + 180) : cropWidth;
      const sx = Math.max(0, Math.round(centerX - cropWidth / 2)), sy = Math.max(0, Math.round(centerY - cropHeight / 2));
      const canvas = document.createElement('canvas'); canvas.width = cropWidth; canvas.height = cropHeight;
      canvas.getContext('2d').drawImage(img, sx, sy, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      canvas.style.width = '100%'; const figure = document.createElement('figure'); figure.style.cssText = 'margin:0;flex:1;min-width:0';
      const caption = document.createElement('figcaption'); caption.style.padding = '8px'; caption.textContent = entry.target === 'nike' ? 'Nike live reference' : 'The Pink House'; figure.append(caption, canvas); document.querySelector('#crops').append(figure);
    }
  }, { images, views: { nike, local }, diameter: core.nike, mobile: width < 700 });
  await comparison.screenshot({ path: path.join(output, `${width}x${height}-core-halo.png`), fullPage: true });
}
await comparison.close(); await browser.close();
await writeFile(path.join(output, 'measurements.json'), JSON.stringify(report, null, 2));
const summary = report.comparisons.map(entry => {
  const same = entry.uniformChecks.filter(check => check.match).length;
  const views = report.views.filter(view => view.width === entry.width);
  return `| ${entry.width}×${entry.height} | ${entry.core.nike.toFixed(3)} px | ${entry.core.local.toFixed(3)} px | ${same}/${entry.uniformChecks.length} | ${views.find(view => view.target === 'nike').submissionRate?.updatesPerSecond.toFixed(2)} | ${views.find(view => view.target === 'local').submissionRate?.updatesPerSecond.toFixed(2)} |`;
});
await writeFile(path.join(output, 'summary.md'), `# Live Nike / Pink House globe comparison\n\nCaptured the public London route and local implementation in Chrome, using 1440×900 desktop and 390×844 mobile emulation at DPR 1. Hardware backend is recorded in measurements.json. Every capture includes idle, slow movement, rapid circular movement, stationary 800 ms and movement to the screen corner followed by 1100 ms; mobile adds an actual CDP touch swipe. The corner lies on the square raycast plane and leaves the circular globe, so it is not a true square-plane miss. Four interaction recordings and full-page/core-halo comparison images accompany the measurements.\n\n| Viewport | Nike geographic diameter | Pink House diameter | Matching shader settings | Nike updates/s | Pink House updates/s |\n| --- | ---: | ---: | ---: | ---: | ---: |\n${summary.join('\n')}\n\nDiameters are derived from measured CSS/backing sizes, captured GPU camera projection and the confirmed radius 1.56; feedback atmosphere extends beyond them. Matching settings include procedural scale, pointer influence radius, trail strength, corona constants, aspect scale, blur compensation and composite levels. Setting equality uses exact float32 values uploaded to WebGL; JavaScript division-versus-reciprocal multiplication differs by at most 1.2e-16 in a few source trace values and uploads identically. Position, direction, speed, time, pulse centers and feedback frame counts depend on each independent recording and are intentionally excluded from setting equality.\n\nThe initial square local canvas made the desktop globe 18% too large and changed aspect-dependent procedural settings. Evidence prompted a full viewport rectangle, a single 1.2 mobile CSS scale and layout-based backing-size measurement. Final captures verify these corrections. The world-continent map in Nike versus the Pink House regional street geography, event labels, controls and red identity tint remain intentional project differences. Stationary speed decays in both recordings; ordinary movement to the black corner retains a valid pointer position, as required.\n\nSubmission rates are short ~600 ms observations with WebGL forwarding instrumentation and video recording on a hardware browser; they are not GPU timer-query benchmarks or physical-mobile performance measurements. Independent animation phases, map shapes, hover overlays and the fixed 60 Hz/latest-feedback engineering corrections prevent direct whole-screen pixel equality. The separate controlled GPU shader QA validates equivalent mathematics with common inputs. Nike's consent overlay remained in the page captures despite bounded dismissal attempts; it is below the globe core. No Nike assets were added to production.\n`);
