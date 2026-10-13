import { chromium } from '../aerial/node_modules/playwright/index.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Controlled framebuffer comparisons, independent of page layout and its clock.
// Recovered shader files remain external QA evidence and are never production assets.
const source = process.env.NIKE_GLOBE_SOURCE || 'C:/Users/dmata/.codex/visualizations/2026/10/13/01a132bd-c85d-7c33-b38f-e8726ad69ced/nike-globe-investigation/source';
const output = path.resolve(process.env.SHADER_QA_OUTPUT || 'output/globe-qa/shaders');
const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:5174';
await mkdir(output, { recursive: true });
const recovered = Object.fromEntries(await Promise.all([
  ['noise', 'gS-fragmentShader.glsl'], ['corona', 'pS-fragmentShader.glsl'], ['blend', 'dS-fragmentShader.glsl'],
].map(async ([key, file]) => [key, await readFile(path.join(source, file), 'utf8')])));
const referenceHashes = Object.fromEntries(Object.entries(recovered).map(([key, text]) => [key, createHash('sha256').update(text).digest('hex')]));
const portabilityCorrections = [
  ['smoothstep(uMouseRadius, 0.0, d)', '(1.0 - smoothstep(0.0, uMouseRadius, d))'],
  ['smoothstep(ringWidth, 0.0, abs(d - pr))', '(1.0 - smoothstep(0.0, ringWidth, abs(d - pr)))'],
  ['smoothstep(pr, 0.0, d)', '(1.0 - smoothstep(0.0, pr, d))'],
];
for (const [from, to] of portabilityCorrections) {
  if (!recovered.noise.includes(from)) throw new Error(`Missing recovered portability expression: ${from}`);
  recovered.noise = recovered.noise.replace(from, to);
}
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 740 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('requestfailed', request => console.log('FAILED REQUEST', request.url(), request.failure()));
page.on('response', response => { if (response.status() >= 400) console.log('HTTP ERROR', response.status(), response.url()); });
await page.route('**/__shader-qa', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><style>body{margin:0;background:#090909;color:white;font:14px Arial}#title{padding:12px}#images{display:flex;gap:10px;padding:10px}canvas{width:512px;height:512px}figure{margin:0}figcaption{padding:8px}</style></head><body><div id="title">Shader framebuffer comparison</div><div id="images"></div></body></html>' }));
// Supply byte-identical local modules through Playwright routes: this fixture is
// reproducible without any network permission or a running development server.
for (const file of ['three.module.js', 'three.core.js']) {
  const body = await readFile(path.resolve('node_modules/three/build', file), 'utf8');
  await page.route(`**/node_modules/three/build/${file}`, route => route.fulfill({ contentType: 'text/javascript', body }));
}
const shaderModule = await readFile(path.resolve('src/globe/shaders.ts'), 'utf8');
await page.route('**/src/globe/shaders.ts', route => route.fulfill({ contentType: 'text/javascript', body: shaderModule }));
try {
  await page.goto(`${baseUrl}/__shader-qa`);
  const result = await page.evaluate(async ({ recovered }) => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const authored = await import('/src/globe/shaders.ts');
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: false });
    renderer.setSize(512, 512);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 1);
    const gl = renderer.getContext();
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const backend = { version: gl.getParameter(gl.VERSION), vendor: info && gl.getParameter(info.UNMASKED_VENDOR_WEBGL), renderer: info && gl.getParameter(info.UNMASKED_RENDERER_WEBGL), three: THREE.REVISION };
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const resources = [];
    function fixtureTexture(draw) {
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
      const context = canvas.getContext('2d'); draw(context);
      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      resources.push(texture); return texture;
    }
    const trail = fixtureTexture(ctx => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 512, 512);
      ctx.lineCap = 'round'; ctx.lineWidth = 35; ctx.strokeStyle = '#eee'; ctx.filter = 'blur(9px)';
      ctx.beginPath(); ctx.moveTo(70, 330); ctx.bezierCurveTo(160, 60, 350, 470, 430, 130); ctx.stroke();
    });
    const sharp = fixtureTexture(ctx => { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 512, 512); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(256, 256, 177.49, 0, Math.PI * 2); ctx.fill(); });
    const soft = fixtureTexture(ctx => { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 512, 512); ctx.fillStyle = '#fff'; ctx.filter = 'blur(3.5px)'; ctx.beginPath(); ctx.arc(256, 256, 177.49, 0, Math.PI * 2); ctx.fill(); });
    const map = fixtureTexture(ctx => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 512, 512); ctx.save(); ctx.beginPath(); ctx.arc(256, 256, 177.49, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(84, 142); ctx.bezierCurveTo(300, 36, 139, 236, 376, 255); ctx.bezierCurveTo(494, 355, 254, 303, 300, 477); ctx.lineTo(81, 399); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(245, 190, 35, 18, .5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    });
    const feedback = fixtureTexture(ctx => {
      const gradient = ctx.createRadialGradient(250, 247, 128, 250, 247, 220); gradient.addColorStop(0, '#fff'); gradient.addColorStop(.3, '#ddd'); gradient.addColorStop(1, '#000');
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 512, 512); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 512, 512); ctx.fillStyle = '#bbb'; ctx.beginPath(); ctx.arc(112, 172, 24, 0, Math.PI * 2); ctx.fill();
    });
    function target(size) { const rt = new THREE.WebGLRenderTarget(size, size, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false }); resources.push(rt); return rt; }
    function uniforms(values) { return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { value }])); }
    function pass(fragmentShader, values, noise = false) {
      const material = new THREE.ShaderMaterial({ vertexShader: noise ? authored.noiseVertexShader : authored.vertexShader, fragmentShader, uniforms: uniforms(values), depthTest: false, depthWrite: false });
      const scene = new THREE.Scene(); scene.add(new THREE.Mesh(geometry, material)); resources.push(material); return { scene, material };
    }
    function draw(pass, rt) { renderer.setRenderTarget(rt); renderer.render(pass.scene, camera); }
    function pixels(rt) { const rgba = new Uint8Array(rt.width * rt.height * 4); renderer.readRenderTargetPixels(rt, 0, 0, rt.width, rt.height, rgba); return rgba; }
    function compare(a, b) {
      let sum = 0, square = 0, max = 0, changed = 0, overOne = 0, overTwo = 0;
      for (let i = 0; i < a.length; ++i) { const delta = Math.abs(a[i] - b[i]); sum += delta; square += delta * delta; max = Math.max(max, delta); if (delta) changed++; if (delta > 1) overOne++; if (delta > 2) overTwo++; }
      return { channels: a.length, maximumByteError: max, meanByteError: sum / a.length, rootMeanSquareByteError: Math.sqrt(square / a.length), changedChannelFraction: changed / a.length, greaterThanOneFraction: overOne / a.length, greaterThanTwoFraction: overTwo / a.length, pass: max <= 1 };
    }
    function show(name, a, b, size) {
      document.querySelector('#title').textContent = `${name} — reference / independent implementation / absolute difference × 32`;
      const images = document.querySelector('#images'); images.innerHTML = '';
      ['Recovered portable GLSL', 'Independent implementation', 'Absolute difference × 32'].forEach((label, index) => {
        const figure = document.createElement('figure'); const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
        const data = new Uint8ClampedArray(a.length);
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) for (let c = 0; c < 4; c++) {
          const from = ((size - 1 - y) * size + x) * 4 + c; const to = (y * size + x) * 4 + c;
          data[to] = index === 0 ? a[from] : index === 1 ? b[from] : c === 3 ? 255 : Math.min(255, Math.abs(a[from] - b[from]) * 32);
        }
        canvas.getContext('2d').putImageData(new ImageData(data, size, size), 0, 0);
        const caption = document.createElement('figcaption'); caption.textContent = label; figure.append(canvas, caption); images.append(figure);
      });
    }
    const noiseDefaults = { noisetype: 2, noiseSeed: 1234.5678, noiseScale: 7.125, noiseSpeed: .04, noiseEvolveSpeed: 1.3, time: 0, uResolution: new THREE.Vector2(512, 512), u_mouse: new THREE.Vector2(-10, -10), u_mouseSpeed: 0, u_mouseDir: new THREE.Vector2(1, 0), uVelStrength: 1, uVelTrail: .7 / 1.425, uMouseEnabled: 1, uMouseStrength: 1.5, uMouseRadius: .3 / 1.425, uMouseTrailTex: trail, uPulseEnabled: 0, uPulseCenter: new THREE.Vector2(.42, .58), uPulseStrength: .6, uPulseRadius: .05 / 1.425, uPulseFrequency: 1 };
    const noiseReference = pass(recovered.noise, noiseDefaults, true); const noiseActual = pass(authored.noiseFragmentShader, noiseDefaults, true);
    const coronaDefaults = { iBuffer: feedback, iNoise: trail, iGlobeSphere: soft, uResolution: new THREE.Vector2(512, 512), uFrameCount: 12, uDisplaceFactor: .0015, uMixFactor: .06, uScaleFactor: .3, uExpandFactor: .4, uUvScale: 1.425, uTime: 0 };
    const coronaReference = pass(recovered.corona, coronaDefaults); const coronaActual = pass(authored.coronaFragmentShader, coronaDefaults);
    const blendDefaults = { uResolution: new THREE.Vector2(512, 512), uUvScale: 1.425, tDiffuse: map, tDisplacementTexture: feedback, tGlobeSphere: soft, tGlobeSphereSharp: sharp, tNoise: trail, uColor1: new THREE.Vector3(1, 0, 0), uColor2: new THREE.Vector3(1, .2470588, .7372549), uBackgroundColor: new THREE.Vector3(0, 0, 0), levelsBlack: 0, levelsWhite: 1, gamma: 1, mapStrength: .6, sphereInvert: 1, sphereAdd: 1, mapBlur: 3 / 1.425, innerNoiseAmount: 1.5, innerNoiseBlur: 10 * (512 / 1000) / 1.425, innerNoiseBlack: 0, innerNoiseWhite: .8, innerNoiseGamma: 1.6, uDebugView: 0 };
    const blendReference = pass(recovered.blend, blendDefaults); const blendActual = pass(authored.blendFragmentShader, blendDefaults);
    const checks = []; const visual = {};
    function update(pair, values) { pair.forEach(p => Object.entries(values).forEach(([name, value]) => { p.material.uniforms[name].value = value; })); }
    function measure(name, pair, size = 512, keep = false) {
      const a = target(size); const b = target(size); draw(pair[0], a); draw(pair[1], b); const reference = pixels(a); const actual = pixels(b);
      checks.push({ name, size, ...compare(reference, actual) }); if (keep) visual[name] = { reference, actual, size }; return { a, b };
    }
    const scenarios = [
      { name: 'noise-offscreen-t0', time: 0, u_mouse: new THREE.Vector2(-10, -10), u_mouseSpeed: 0 },
      { name: 'noise-stationary-t3', time: 3, u_mouse: new THREE.Vector2(.48, .52), u_mouseSpeed: 0 },
      { name: 'noise-moving-trail-t7', time: 7, u_mouse: new THREE.Vector2(.62, .35), u_mouseSpeed: .78, u_mouseDir: new THREE.Vector2(.8, .6) },
      { name: 'noise-slow-trail-t12', time: 12, u_mouse: new THREE.Vector2(.3, .65), u_mouseSpeed: .08, u_mouseDir: new THREE.Vector2(-.6, -.8) },
      { name: 'noise-marker-pulse-t19', time: 19.125, u_mouse: new THREE.Vector2(.55, .5), u_mouseSpeed: .4, uPulseEnabled: 1 },
      { name: 'noise-384-tier-t31', time: 31.1, uResolution: new THREE.Vector2(384, 384), u_mouse: new THREE.Vector2(.7, .48), u_mouseSpeed: .6, uPulseEnabled: 0 },
      { name: 'noise-320-tier-t4', time: 4.6, uResolution: new THREE.Vector2(320, 320), u_mouse: new THREE.Vector2(.34, .52), u_mouseSpeed: .72 },
      { name: 'noise-lite-256-t50', time: 50.75, uResolution: new THREE.Vector2(256, 256), uMouseEnabled: 0, uVelTrail: 0, u_mouseSpeed: 0, u_mouse: new THREE.Vector2(-10, -10) },
    ];
    for (const s of scenarios) { const { name, ...values } = s; update([noiseReference, noiseActual], { ...noiseDefaults, ...values }); measure(name, [noiseReference, noiseActual], values.uResolution?.x || 512, name === 'noise-moving-trail-t7'); }
    update([noiseReference, noiseActual], { ...noiseDefaults, time: 7, u_mouse: new THREE.Vector2(.62, .35), u_mouseSpeed: .78, u_mouseDir: new THREE.Vector2(.8, .6) });
    const commonNoise = target(512); draw(noiseReference, commonNoise); update([coronaReference, coronaActual], { iNoise: commonNoise.texture }); update([blendReference, blendActual], { tNoise: commonNoise.texture });
    measure('corona-replenish-advection', [coronaReference, coronaActual]);
    update([coronaReference, coronaActual], { uFrameCount: 3 }); measure('corona-startup', [coronaReference, coronaActual]);
    update([coronaReference, coronaActual], { uFrameCount: 33, uExpandFactor: .2, uDisplaceFactor: .001 }); measure('corona-hover', [coronaReference, coronaActual]);
    measure('composite-normal', [blendReference, blendActual], 512, true);
    update([blendReference, blendActual], { mapBlur: 0, innerNoiseBlur: 0 }); measure('composite-no-blur', [blendReference, blendActual]);
    update([blendReference, blendActual], { ...blendDefaults, tNoise: commonNoise.texture, levelsBlack: .1, levelsWhite: .9, gamma: 1.7, innerNoiseGamma: .85 }); measure('composite-custom-levels', [blendReference, blendActual]);
    // Advance separate feedback buffers using each implementation's own noise.
    const independentNoise = [target(512), target(512)]; let previous = [target(512), target(512)]; let next = [target(512), target(512)];
    const finals = [target(512), target(512)];
    update([coronaReference, coronaActual], coronaDefaults); update([blendReference, blendActual], blendDefaults);
    for (let frame = 1; frame <= 16; frame++) {
      update([noiseReference, noiseActual], { ...noiseDefaults, time: 9 + frame / 60, u_mouse: new THREE.Vector2(.35 + frame * .012, .51), u_mouseSpeed: .64, u_mouseDir: new THREE.Vector2(1, 0) });
      [noiseReference, noiseActual].forEach((p, index) => draw(p, independentNoise[index]));
      [coronaReference, coronaActual].forEach((p, index) => { p.material.uniforms.iBuffer.value = previous[index].texture; p.material.uniforms.iNoise.value = independentNoise[index].texture; p.material.uniforms.uFrameCount.value = frame; draw(p, next[index]); });
      [previous, next] = [next, previous];
      [blendReference, blendActual].forEach((p, index) => { p.material.uniforms.tNoise.value = independentNoise[index].texture; p.material.uniforms.tDisplacementTexture.value = previous[index].texture; draw(p, finals[index]); });
      if ([1, 5, 10, 16].includes(frame)) checks.push({ name: `pipeline-feedback-frame-${frame}`, size: 512, ...compare(pixels(finals[0]), pixels(finals[1])) });
    }
    visual['pipeline-feedback-frame-16'] = { reference: pixels(finals[0]), actual: pixels(finals[1]), size: 512 };
    window.shaderQaShow = name => { const v = visual[name]; show(name, v.reference, v.actual, v.size); };
    window.shaderQaShow('pipeline-feedback-frame-16');
    const programs = renderer.info.programs.map(program => ({ name: program.name, runnable: program.diagnostics?.runnable ?? true, vertexLog: program.diagnostics?.vertexShader?.log ?? '', fragmentLog: program.diagnostics?.fragmentShader?.log ?? '' }));
    resources.forEach(resource => resource.dispose()); geometry.dispose(); renderer.dispose();
    return { backend, checks, programs, screenshots: Object.keys(visual) };
  }, { recovered });
  for (const name of result.screenshots) { await page.evaluate(name => window.shaderQaShow(name), name); await page.screenshot({ path: path.join(output, `${name}.png`) }); }
  const report = { observedAt: new Date().toISOString(), baseUrl, referenceHashes, authoredShaderModuleSha256: createHash('sha256').update(shaderModule).digest('hex'), portabilityCorrections: portabilityCorrections.map(([from, to]) => ({ from, to })), fixture: 'Synthetic common geographic map, circular sharp/soft masks, blurred painted trail, nonuniform feedback; byte-exact input textures and uniforms; RGBA8 framebuffer readback on Three r182. No Nike assets added to production.', ...result, errors };
  report.pass = errors.length === 0 && result.checks.every(check => check.pass) && result.programs.every(program => program.runnable);
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await writeFile(path.join(output, 'summary.md'), `# Controlled GPU shader comparison\n\nBackend: ${result.backend.renderer}; WebGL: ${result.backend.version}; Three r${result.backend.three}.\n\nRecovered reference applies only the three documented portable descending-smoothstep corrections. All other formulas, uniform values, common textures and timing are identical. Readback compares rendered RGBA8 bytes, independent of page layout. Synthetic QA geography avoids introducing Nike artwork into production. Local module routes make this test independent of a running Vite server. Source hashes are preserved in report.json.\n\n| Case | Max byte error | Mean byte error | Channels differing by >1 | Pass |\n| --- | ---: | ---: | ---: | :---: |\n${result.checks.map(check => `| ${check.name} | ${check.maximumByteError} | ${check.meanByteError.toFixed(8)} | ${(check.greaterThanOneFraction * 100).toFixed(6)}% | ${check.pass ? 'yes' : 'no'} |`).join('\n')}\n\nTolerance: maximum channel error ≤1/255 (one output quantization step); no channel may differ by more. ${result.checks.length} cases; ${result.programs.length} compiled programs; ${errors.length} browser errors. Overall: **${report.pass ? 'PASS' : 'FAIL'}**.\n\nThis validates actual shader outputs on the named backend; it does not measure hardware GPU performance or prove cross-driver byte identity.\n`);
  console.log(JSON.stringify({ pass: report.pass, backend: result.backend, checks: result.checks, errors }, null, 2));
  if (!report.pass) process.exitCode = 1;
} finally { await browser.close(); }
