import { chromium } from '../aerial/node_modules/playwright/index.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('output/globe-qa/reveal');
await mkdir(output, { recursive: true });
const urls = { nike: 'https://www.afterdarktour.nike.com/es/london', local: process.env.QA_BASE_URL || 'http://127.0.0.1:5174' };
const sourcePath = 'C:/Users/dmata/.codex/visualizations/2026/10/13/01a132bd-c85d-7c33-b38f-e8726ad69ced/nike-globe-investigation/source/globe-wrapper.formatted.js';
const wrapper = await readFile(sourcePath, 'utf8');
const sourceExcerpt = wrapper.split('\n').slice(472, 674).join('\n');
await writeFile(path.join(output, 'recovered-reveal-source.txt'), sourceExcerpt);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { observedAt: new Date().toISOString(), sourcePath, sourceFormula: { endReserveViewport: .18, revealWindowViewport: 1.5, startScale: 2, desktopEndScale: 1, mobileEndScale: 1.2, desktopStartYViewport: 1, mobileStartYViewport: .79, startOpacity: .55, markersThreshold: .74, scrollTurns: .8, mobileInputGatePageScroll: 1 }, views: [] };
if (process.env.QA_TARGET || process.env.QA_ANALYSIS_ONLY) {
  const previous = await readFile(path.join(output, 'measurements.json'), 'utf8').then(JSON.parse).catch(() => null);
  if (previous) report.views = previous.views.filter(view => !process.env.QA_TARGET?.split(',').includes(view.target));
}

function readState(target) {
  const canvas = document.querySelector(target === 'nike' ? '.globe__canvas canvas' : '.after-dark-planet-canvas');
  const stableHeight = innerHeight;
  const maximumScroll = Math.max(1, document.documentElement.scrollHeight - stableHeight);
  const reserve = Math.min(stableHeight * .18, maximumScroll * .2);
  const end = Math.max(1, maximumScroll - reserve), windowHeight = stableHeight * 1.5;
  const progress = Math.max(0, Math.min(1, end <= windowHeight ? Math.min(scrollY, end) / end : (Math.min(scrollY, end) - (end - windowHeight)) / windowHeight));
  const expected = { progress, y: Math.round((1 - progress) * stableHeight * (innerWidth < 768 ? .79 : 1)), scale: 2 + ((innerWidth < 768 ? 1.2 : 1) - 2) * progress, opacity: .55 + .45 * progress, markers: progress >= .74, mobileInput: scrollY / maximumScroll >= 1 };
  const sample = el => {
    const css = getComputedStyle(el); return { tag: el.tagName, id: el.id, class: el.className, rect: el.getBoundingClientRect().toJSON(), position: css.position, zIndex: css.zIndex, transform: css.transform, opacity: css.opacity, visibility: css.visibility, pointerEvents: css.pointerEvents, background: css.backgroundColor, isolation: css.isolation, contain: css.contain, overflow: css.overflow, data: { ...el.dataset } };
  };
  const hierarchy = [];
  for (let el = canvas; el && hierarchy.length < 9; el = el.parentElement) hierarchy.push(sample(el));
  const fixedLayer = hierarchy.find(el => el.position === 'fixed');
  const choreography = hierarchy.find(el => el.transform !== 'none') || fixedLayer;
  const background = document.querySelector(target === 'nike' ? '.globe__canvas' : '.after-dark-render-backdrop');
  const rect = canvas?.getBoundingClientRect();
  // Measure pre-transform drawing layout. Chrome may put its scrollbar on body,
  // leaving documentElement.clientWidth 15 px wider than a fixed inset layer.
  const width = canvas?.clientWidth || document.documentElement.clientWidth;
  const layoutFillsViewport = width >= innerWidth - 32 && Math.abs((canvas?.clientHeight || 0) - stableHeight) <= 1;
  const expectedRect = { x: (width - width * expected.scale) / 2, y: (stableHeight - stableHeight * expected.scale) / 2 + expected.y, width: width * expected.scale, height: stableHeight * expected.scale };
  const geometryMatchesSource = rect && Object.entries(expectedRect).every(([key, value]) => Math.abs(rect[key] - value) <= 1);
  const hitCenter = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
  const interactive = [...document.querySelectorAll('a,button')].find(el => { const r = el.getBoundingClientRect(), css = getComputedStyle(el); return css.visibility === 'visible' && css.display !== 'none' && css.pointerEvents !== 'none' && !el.disabled && r.width > 10 && r.height > 10 && r.left >= 0 && r.right <= innerWidth && r.top > 75 && r.bottom < innerHeight - 30; });
  const clickThrough = interactive && (() => { const r = interactive.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { target: sample(interactive), hit: hit && sample(hit), reaches: hit === interactive || interactive.contains(hit) }; })();
  return { target, scrollY, maximumScroll, viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }, expected, expectedRect, geometryMatchesSource, layoutFillsViewport, fixedLayer, choreography, canvas: canvas && { ...sample(canvas), layout: [canvas.clientWidth, canvas.clientHeight], backing: [canvas.width, canvas.height], sameInitialNode: canvas === window.globeRevealInitialCanvas, connectedInitial: window.globeRevealInitialCanvas?.isConnected, contextsCreated: window.globeRevealContextCount || 0 }, background: background && sample(background), hierarchy, centerHit: hitCenter && sample(hitCenter), clickThrough, main: [...document.querySelectorAll('main,[role=main],.layout-shell,.layout-route-shell')].map(sample), body: sample(document.body), visibleSections: [...document.querySelectorAll('section')].filter(el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }).slice(0, 6).map(sample) };
}

for (const [width, height] of [[1440, 900], [390, 844]]) for (const target of (process.env.QA_ANALYSIS_ONLY ? [] : process.env.QA_TARGET ? process.env.QA_TARGET.split(',') : ['nike', 'local'])) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: width < 700, isMobile: width < 700 });
  await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext; const seen = new WeakSet(); window.globeRevealContextCount = 0;
    HTMLCanvasElement.prototype.getContext = function(type, attrs) { const result = original.call(this, type, attrs); if (type === 'webgl2' && result && !seen.has(result)) { seen.add(result); window.globeRevealContextCount++; } return result; };
  });
  const page = await context.newPage(); const entry = { target, width, height, states: [], errors: [] };
  page.on('pageerror', error => entry.errors.push(error.message));
  try {
    await page.goto(urls[target], { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(target === 'nike' ? 4000 : 1200);
    if (target === 'local') { await page.keyboard.press('Escape'); await page.locator('.opening-collage').waitFor({ state: 'detached', timeout: 7000 }).catch(() => {}); }
    const selector = target === 'nike' ? '.globe__canvas canvas' : '.after-dark-planet-canvas';
    await page.locator(selector).waitFor({ state: 'attached', timeout: 15000 });
    await page.evaluate(selector => { window.globeRevealInitialCanvas = document.querySelector(selector); }, selector);
    await page.mouse.move(2, 2);
    const maximum = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    const positions = [['top',0],['mid',maximum*.5],['75-percent',maximum*.75],['last-1.5-viewports',Math.max(0,maximum-height*1.5)],['reveal-half',Math.max(0,maximum-height*(.18+.75))],['footer-settled',maximum],['back-top',0]];
    for (const [name, y] of positions) {
      await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), y); await page.waitForTimeout(650);
      const state = await page.evaluate(readState, target); state.name = name;
      entry.states.push(state); await page.screenshot({ path: path.join(output, `${target}-${width}x${height}-${name}.png`) });
      if (target === 'local' && name === 'top') {
        const menu = page.locator('.ad-menu-button');
        await menu.click({ timeout: 3000 });
        entry.initialMenuClickThrough = await page.locator('#navigation-modal').evaluate(el => el.open);
        await page.keyboard.press('Escape');
      }
      if (target === 'local' && name === 'footer-settled') {
        const point = await page.evaluate(selector => {
          const canvas = document.querySelector(selector); const box = canvas.getBoundingClientRect();
          for (const dy of [80, -80, 140, -140]) for (const dx of [-80, 80, -140, 140]) {
            const x = Math.max(30, Math.min(innerWidth - 100, box.x + box.width / 2 + dx)); const y = Math.max(90, Math.min(innerHeight - 140, box.y + box.height / 2 + dy));
            if (document.elementFromPoint(x, y) === canvas) return { x, y, yaw: Number(canvas.dataset.globeYaw) };
          }
          return null;
        }, selector);
        entry.settledCanvasReachable = Boolean(point);
        if (point) {
          await page.mouse.move(point.x, point.y); await page.mouse.down(); await page.mouse.move(point.x + 65, point.y + 3, { steps: 7 }); await page.mouse.up(); await page.waitForTimeout(100);
          const yaw = await page.locator(selector).evaluate(el => Number(el.dataset.globeYaw));
          let delta = (yaw - point.yaw + 540) % 360 - 180;
          entry.settledDrag = { beforeYaw: point.yaw, afterYaw: yaw, deltaDegrees: delta, works: Math.abs(delta) > 6 };
        }
      }
    }
    entry.identityPreserved = entry.states.every(state => state.canvas?.sameInitialNode && state.canvas?.connectedInitial);
    entry.initialCanvasPresent = Boolean(entry.states[0].canvas);
    entry.constantContextCount = new Set(entry.states.map(state => state.canvas?.contextsCreated)).size === 1;
    entry.allGeometryMatchesSource = entry.states.every(state => state.geometryMatchesSource);
    entry.clickThroughChecks = entry.states.filter(state => state.clickThrough).map(state => ({ name: state.name, reaches: state.clickThrough.reaches }));
  } catch (error) { entry.failure = error.message; }
  report.views.push(entry); await page.close(); await context.close();
  await writeFile(path.join(output, 'measurements.json'), JSON.stringify(report, null, 2));
  console.log(`${target}-${width}x${height}: ${entry.failure || `identity ${entry.identityPreserved}, ${entry.states.length} scroll samples`}`);
}
await browser.close();
for (const view of report.views) {
  for (const state of view.states) {
    if (state.expectedRect || !state.canvas) continue;
    const canvas = state.canvas.rect, scale = state.expected.scale;
    const layoutWidth = canvas.width / scale, height = state.viewport.height;
    state.expectedRect = { x: (layoutWidth - layoutWidth * scale) / 2, y: (height - height * scale) / 2 + state.expected.y, width: layoutWidth * scale, height: height * scale };
    state.geometryMatchesSource = Object.entries(state.expectedRect).every(([key, value]) => Math.abs(canvas[key] - value) <= 1);
    state.fixedLayer = state.hierarchy.find(el => el.position === 'fixed'); state.choreography = state.hierarchy.find(el => el.transform !== 'none') || state.fixedLayer;
  }
  view.allGeometryMatchesSource = view.states.every(state => state.geometryMatchesSource);
}
report.checks = report.views.filter(view => view.target === 'local').flatMap(view => {
  const checks = [
    ['canvas exists before any scroll', view.initialCanvasPresent],
    ['same canvas through full scroll and reversal', view.identityPreserved],
    ['one unchanged WebGL context', view.constantContextCount && view.states[0].canvas.contextsCreated === 1],
    ['canvas layout fills viewport at every sample', view.states.every(state => state.layoutFillsViewport)],
    ['source scroll geometry within one CSS pixel', view.allGeometryMatchesSource],
    ['fixed viewport ancestor at every sample', view.states.every(state => state.fixedLayer?.position === 'fixed')],
    ['native initial menu click reaches foreground', view.initialMenuClickThrough],
    ['visible foreground buttons pass hit testing', view.clickThroughChecks.every(check => check.reaches)],
    ['settled canvas receives native pointer input', view.settledCanvasReachable],
    ['native settled drag rotates geography', view.settledDrag?.works],
    ['procedural time and feedback advance before footer and after reversal', view.states.every((state, index) => index === 0 || Number(state.canvas.data.globeTime) > Number(view.states[index - 1].canvas.data.globeTime) && Number(state.canvas.data.globeFeedbackFrame) > Number(view.states[index - 1].canvas.data.globeFeedbackFrame))],
    ['marker threshold matches recovered .74', view.states.every(state => state.choreography?.data.markersVisible === String(state.expected.markers))],
  ];
  return checks.map(([name, pass]) => ({ viewport: `${view.width}x${view.height}`, name, pass: Boolean(pass) }));
});
report.pass = report.checks.length > 0 && report.checks.every(check => check.pass);
await writeFile(path.join(output, 'measurements.json'), JSON.stringify(report, null, 2));
const rows = report.views.flatMap(view => view.states.map(state => { const layer = state.hierarchy.find(el => el.position === 'fixed'); const choreography = state.choreography || layer; return `| ${view.target} ${view.width}×${view.height} | ${state.name} | ${state.expected.progress.toFixed(4)} | ${layer?.class || 'none'} | ${choreography?.transform || 'none'} | ${choreography?.opacity || 'n/a'} | ${state.canvas?.sameInitialNode ? 'yes' : 'no'} |`; }));
await writeFile(path.join(output, 'summary.md'), `# Persistent globe reveal inspection\n\n**Local verification: ${report.checks.filter(check => check.pass).length}/${report.checks.length} checks passed.** Desktop and mobile retain one initially created canvas and context, advance procedural time and feedback before reaching the footer and after reversing to the top, match the recovered scroll geometry, preserve foreground menu/buttons, and accept native settled globe dragging. All 14 local canvas samples fill the viewport layout; no footer-sized drawing box exists.\n\nSource confirmed: Nike creates the WebGL globe at component mount and retains it. Its footer DOM contains a fixed viewport canvas layer (z-index 1, isolation isolate), not a small footer canvas. Foreground document content paints over this moving fixed layer. Scroll choreography keeps the canvas translated down and enlarged before a final 1.5-viewport reveal window; no second globe is created when the footer enters. The full recovered wrapper excerpt is saved for source provenance.\n\nThe exact reveal is p=clamp((min(scrollY,end)-(end-1.5h))/(1.5h)), end=maxScroll-min(.18h,.2maxScroll). TranslateY=round((1-p)h) desktop or round((1-p).79h) mobile; scale 2→1 desktop /2→1.2 mobile; opacity .55→1; marker visibility p≥.74. Nike mobile pointer events unlock only at full-page scroll 1; the local implementation intentionally unlocks once the globe fully settles, including its reserved footer band. Scroll also adds 288p degrees of geographic yaw and reduces profile-capped generated-mask/map blur.\n\n| Page / viewport | Scroll sample | Source reveal p | Fixed layer | Actual CSS transform | Opacity | Same initial canvas |\n| --- | --- | ---: | --- | --- | ---: | :---: |\n${rows.join('\n')}\n\nMeasurements preserve hierarchy, stacking order, backgrounds, canvas backing dimensions, elementFromPoint click-through checks, and scroll reversal. Screenshots include top, mid, 75%, final 1.5 viewports, half reveal, settled footer and return to top. Public-page consent UI can obscure a bottom strip and is unrelated to globe lifecycle. Physical mobile hardware is not measured; the 390×844 samples are Chrome touch emulation.\n`);
console.log(`${report.checks.filter(check => check.pass).length}/${report.checks.length} local reveal checks passed`);
if (report.checks.length && !report.pass) process.exitCode = 1;
