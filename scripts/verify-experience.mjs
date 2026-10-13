import { chromium } from '../aerial/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Browser QA uses the Playwright runtime already installed by the aerial project.
// Set QA_BASE_URL to test another local preview; no dependencies are installed.
const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:5173';
const output = path.resolve(process.env.QA_OUTPUT_DIR || 'output/experience-qa/application');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const matrix = process.env.QA_VIEWPORTS ? process.env.QA_VIEWPORTS.split(',').map(value => value.split('x').map(Number)) : process.argv.includes('--quick') ? [[390, 844], [1440, 900]] : [[320, 568], [390, 844], [844, 390], [768, 1024], [1024, 768], [1440, 900], [1920, 1080]];
const report = { baseUrl, observedAt: new Date().toISOString(), checks: [], views: [], fallback: [], warnings: [] };
const check = (name, pass, detail) => { const result = { name, pass: Boolean(pass), detail }; report.checks.push(result); console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${pass ? '' : `: ${JSON.stringify(detail)}`}`); return result; };
const run = async (name, callback) => { try { await callback(); } catch (error) { check(name, false, error.message); } };
const save = () => writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));

async function dismissIntro(page) {
  await page.locator('.ad-page').waitFor({ state: 'visible', timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(180);
  await page.locator('.opening-collage').waitFor({ state: 'detached', timeout: 7000 }).catch(() => {});
}

async function metrics(page) {
  return page.evaluate(() => {
    const measure = selector => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
      return { x: r.x, y: r.y, width: r.width, height: r.height, centerOffset: r.x + r.width / 2 - document.body.getBoundingClientRect().width / 2, font: s.fontFamily, fontSize: s.fontSize, lineHeight: s.lineHeight, letterSpacing: s.letterSpacing, position: s.position, background: s.backgroundColor, color: s.color, touchAction: s.touchAction };
    };
    const width = document.documentElement.clientWidth;
    const offenders = [...document.querySelectorAll('body *')].filter(el => {
      const s = getComputedStyle(el); const r = el.getBoundingClientRect();
      return s.position !== 'fixed' && s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && (r.left < -1 || r.right > width + 1);
    }).slice(0, 15).map(el => ({ tag: el.tagName, class: el.className, width: el.getBoundingClientRect().width, x: el.getBoundingClientRect().x }));
    return { viewport: { width: innerWidth, height: innerHeight, clientWidth: width, layoutWidth: document.body.getBoundingClientRect().width, devicePixelRatio }, scrollHeight: document.documentElement.scrollHeight, scrollWidth: document.documentElement.scrollWidth, overflow: document.documentElement.scrollWidth - width, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, elements: Object.fromEntries(['.ad-page', '.ad-header', '.ad-status', '#event-title', '.ad-date', '.ad-photo-pair', '.ad-about', '.ad-location', '#archive', '.after-dark-planet', '.after-dark-planet-canvas', '.after-dark-footer'].map(selector => [selector, measure(selector)])), offenders, videoStates: [...document.querySelectorAll('video')].map(el => ({ class: el.className, paused: el.paused, currentTime: el.currentTime, readyState: el.readyState, muted: el.muted, autoplay: el.autoplay, visible: el.getBoundingClientRect().bottom > 0 && el.getBoundingClientRect().top < innerHeight })) };
  });
}

async function markerState(page) {
  return page.locator('.after-dark-planet-marker').evaluateAll(elements => elements.map(el => ({ label: el.getAttribute('aria-label'), left: el.style.left, top: el.style.top, opacity: el.style.opacity, visibility: getComputedStyle(el).visibility, disabled: el.disabled, tabIndex: el.tabIndex })));
}

async function paletteState(page) {
  return page.evaluate(() => {
    const color = selector => getComputedStyle(document.querySelector(selector)).color;
    const isOrange = value => {
      const channels = value.match(/^rgba?\(([^)]+)\)/)?.[1].split(',').map(Number);
      return channels && channels[0] > 150 && channels[1] > 45 && channels[1] < channels[0] * .9 && channels[2] < channels[1] * .7 && (channels.length < 4 || channels[3] > .1);
    };
    const orangeControls = [...document.querySelectorAll('a, button')].flatMap(el => {
      const style = getComputedStyle(el), box = el.getBoundingClientRect();
      if (!box.width || !box.height || style.visibility === 'hidden' || style.display === 'none') return [];
      const colors = Object.fromEntries(['color', 'backgroundColor', 'borderTopColor'].map(property => [property, style[property]]));
      return Object.values(colors).some(isOrange) ? [{ text: el.textContent?.trim().slice(0, 90), class: el.className, colors }] : [];
    });
    return {
      title: color('#event-title'), archive: color('#ad-archive-title'), cta: color('.ad-heading-cta'),
      header: getComputedStyle(document.querySelector('.ad-header-bar')).backgroundColor,
      fontFamily: getComputedStyle(document.querySelector('#event-title')).fontFamily,
      interLoaded: document.fonts.check('700 32px Inter') && [...document.fonts].some(face => face.family.replaceAll('"', '').replaceAll("'", '') === 'Inter' && face.status === 'loaded'),
      orangeControls,
    };
  });
}

async function checkNoOrangeControls(page, label) {
  const palette = await paletteState(page);
  check(`${label} controls use the red/pink palette without orange`, palette.orangeControls.length === 0, palette.orangeControls);
  return palette;
}

async function touchSwipe(page, x, y, dx, dy) {
  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  for (let step = 1; step <= 12; step++) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * step / 12, y: y + dy * step / 12, id: 1 }] });
    await page.waitForTimeout(18);
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await client.detach();
  await page.waitForTimeout(250);
}

async function openMenu(page) {
  await page.locator('.ad-menu-button').click();
  await page.locator('#navigation-modal[open]').waitFor();
}

for (const [width, height] of matrix) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: width < 600, reducedMotion: 'no-preference' });
  // Simulated background state exercises the application's visibilitychange
  // listeners without depending on a headed window manager in the QA host.
  await context.addInitScript(() => {
    window.__qaBackground = false;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__qaBackground });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__qaBackground ? 'hidden' : 'visible' });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const label = `${width}x${height}`;
  const entry = { width, height, pageErrors: [], consoleErrors: [], consoleErrorLocations: [], failedRequests: [], failedResponses: [] };
  page.on('pageerror', error => entry.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') { entry.consoleErrors.push(message.text()); entry.consoleErrorLocations.push(message.location()); } });
  page.on('requestfailed', request => entry.failedRequests.push({ url: request.url(), failure: request.failure()?.errorText }));
  page.on('response', response => { if (response.status() >= 400) entry.failedResponses.push({ url: response.url(), status: response.status() }); });
  await run(`${label} load`, async () => {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await dismissIntro(page);
    await page.waitForTimeout(450);
    entry.hero = await metrics(page);
    check(`${label} no horizontal overflow at hero`, entry.hero.overflow <= 1, entry.hero);
    for (const selector of ['.ad-page', '.ad-header', '.ad-status']) {
      const box = entry.hero.elements[selector];
      check(`${label} ${selector} centered`, box && Math.abs(box.centerOffset) <= 1.5, box);
    }
    const h = entry.hero.elements['#event-title'];
    check(`${label} title remains inside viewport`, h && h.x >= 0 && h.x + h.width <= entry.hero.viewport.clientWidth + 1, h);
    check(`${label} header and status fixed`, entry.hero.elements['.ad-header']?.position === 'fixed' && entry.hero.elements['.ad-status']?.position === 'fixed', entry.hero.elements);
    entry.palette = await checkNoOrangeControls(page, `${label} hero`);
    for (const [name, value] of [['event title', entry.palette.title], ['archive title', entry.palette.archive], ['primary CTA', entry.palette.cta]]) {
      check(`${label} ${name} uses reference red`, value === 'rgb(241, 19, 19)', value);
    }
    check(`${label} equivalent Inter font actually loaded`, entry.palette.interLoaded && /^Inter[, ]/.test(entry.palette.fontFamily), entry.palette);
    check(`${label} header uses reference translucent surface`, /^rgba\(17, 17, 17, 0\.7\d*\)$/.test(entry.palette.header), entry.palette.header);
    await page.screenshot({ path: path.join(output, `${label}-hero.png`) });
  });

  await run(`${label} menu keyboard`, async () => {
    const button = page.locator('.ad-menu-button');
    await button.hover();
    entry.menuHover = await button.evaluate(el => ({ color: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor }));
    await button.focus();
    await page.keyboard.press('Enter');
    await page.locator('#navigation-modal[open]').waitFor();
    check(`${label} menu expanded`, await button.getAttribute('aria-expanded') === 'true');
    const menu = page.locator('#navigation-modal');
    let trapped = true;
    for (let step = 0; step < 22; step++) {
      await page.keyboard.press('Tab');
      const inside = await menu.evaluate(el => el.contains(document.activeElement) || document.activeElement === el);
      if (!inside) trapped = false;
    }
    await page.keyboard.press('Shift+Tab');
    trapped &&= await menu.evaluate(el => el.contains(document.activeElement) || document.activeElement === el);
    check(`${label} menu traps forward/backward keyboard focus`, trapped);
    entry.menu = await menu.evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, clientHeight: el.clientHeight, scrollHeight: el.scrollHeight, overflow: getComputedStyle(el).overflow, scrollLock: getComputedStyle(document.documentElement).overflow }; });
    check(`${label} menu contained horizontally`, entry.menu.x >= -1 && entry.menu.x + entry.menu.width <= width + 1, entry.menu);
    check(`${label} menu locks document scroll`, entry.menu.scrollLock === 'hidden', entry.menu);
    await checkNoOrangeControls(page, `${label} menu`);
    await page.screenshot({ path: path.join(output, `${label}-menu.png`) });
    await page.keyboard.press('Escape');
    await page.locator('#navigation-modal[open]').waitFor({ state: 'detached' });
    check(`${label} Escape restores menu trigger focus`, await button.evaluate(el => document.activeElement === el));
    await openMenu(page); await page.locator('#navigation-modal').getByRole('link', { name: /Sobre la noche/i }).click();
    await page.waitForTimeout(700);
    const destination = await page.locator('#about').evaluate(el => ({ y: el.getBoundingClientRect().y, scroll: scrollY }));
    check(`${label} menu anchor closes and navigates`, !(await page.locator('#navigation-modal').evaluate(el => el.open)) && destination.scroll > 50 && Math.abs(destination.y) < 150, destination);
  });

  await run(`${label} content and archive keyboard`, async () => {
    const text = await page.locator('main').innerText();
    check(`${label} Pink House content preserved`, text.includes('THE PINK HOUSE') && text.includes('22 de octubre de 2026') && text.includes('20:00') && text.includes('Lo que pasa en la Pink House'));
    const archive = page.locator('#archive');
    const cards = archive.locator('.ad-past-card');
    check(`${label} exactly three previous parties`, await cards.count() === 3, await cards.locator('h3').allTextContents());
    check(`${label} previous parties title`, await archive.locator('h2').innerText() === 'FIESTAS PASADAS');
    check(`${label} Halloween 2025 description updated without changing title`, await cards.filter({ hasText: 'HALLOWEEN 2025' }).locator('p').innerText() === '"Tuvo que aprender a caminar para que HALLOWEEN 26 pudiera correr"');
    const gallery = archive.locator('.ad-past-gallery');
    await gallery.scrollIntoViewIfNeeded(); await gallery.focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(450);
    check(`${label} party gallery arrow navigation`, await gallery.evaluate(el => el.scrollLeft > 0));
    await page.keyboard.press('End');
    await page.waitForFunction(() => { const rail = document.querySelector('.ad-past-gallery'); return Math.abs(rail.scrollWidth - rail.clientWidth - rail.scrollLeft) < 2; });
    check(`${label} party gallery end reaches last card`, await gallery.evaluate(el => Math.abs(el.scrollWidth - el.clientWidth - el.scrollLeft) < 2));
    await page.keyboard.press('Home');
    await page.waitForFunction(() => document.querySelector('.ad-past-gallery').scrollLeft === 0);
    check(`${label} party gallery home returns to start`, await gallery.evaluate(el => el.scrollLeft === 0));
    const location = page.locator('#location');
    await location.scrollIntoViewIfNeeded(); await page.waitForTimeout(800);
    entry.middle = await metrics(page);
    check(`${label} no horizontal overflow at middle`, entry.middle.overflow <= 1, entry.middle);
    await page.screenshot({ path: path.join(output, `${label}-middle.png`) });
  });

  await run(`${label} RSVP schedule ticket`, async () => {
    await page.locator('.ad-heading-cta').scrollIntoViewIfNeeded();
    await page.locator('.ad-heading-cta').click();
    await page.locator('#attendance-modal[open]').waitFor();
    const links = await page.locator('#attendance-modal a').evaluateAll(elements => elements.map(el => ({ href: el.href, target: el.target, rel: el.rel })));
    check(`${label} RSVP has working external links`, links.length === 2 && links.every(link => /^https:\/\//.test(link.href) && link.target === '_blank' && /noopener|noreferrer/.test(link.rel)), links);
    await checkNoOrangeControls(page, `${label} RSVP`);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /Ver el plan/i }).click();
    await page.locator('#prize-modal[open]').waitFor();
    check(`${label} schedule has activities and event date`, await page.locator('#prize-modal .schedule-item').count() > 2 && (await page.locator('#prize-modal').innerText()).includes('22.10.26'));
    await page.keyboard.press('Escape');
    await openMenu(page);
    await page.locator('#navigation-modal').getByRole('button', { name: /Tu entrada/i }).click();
    await page.locator('#ticket-modal[open]').waitFor();
    check(`${label} ticket shows identity and date`, (await page.locator('#ticket-modal').innerText()).includes('THE PINK HOUSE') && (await page.locator('#ticket-modal').innerText()).includes('22.10.26'));
    await checkNoOrangeControls(page, `${label} ticket`);
    await page.locator('.ticket-cut-control').focus(); await page.keyboard.press('Enter');
    await page.locator('#prize-modal[open]').waitFor({ timeout: 3500 });
    check(`${label} keyboard ticket cut opens schedule`, true);
    await page.keyboard.press('Escape');
  });

  await run(`${label} globe interactions`, async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('#mapa').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const canvas = page.locator('.after-dark-planet-canvas');
    await canvas.waitFor({ state: 'visible' });
    // The renderer is a persistent viewport backdrop, settled by footer scroll.
    for (let settle = 0; settle < 3; settle += 1) {
      await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      await page.waitForTimeout(120);
    }
    await page.waitForFunction(() => {
      const canvas = document.querySelector('.after-dark-planet-canvas');
      const box = canvas?.getBoundingClientRect();
      return Number(canvas?.dataset.globeReveal) >= .999 && box && Math.abs(box.y + box.height / 2 - innerHeight / 2) < 1;
    }, null, { timeout: 5000 });
    entry.globe = await metrics(page);
    check(`${label} no horizontal overflow at globe`, entry.globe.overflow <= 1, entry.globe);
    check(`${label} globe centered`, Math.abs(entry.globe.elements['.after-dark-planet']?.centerOffset ?? 100) <= 1.5, entry.globe.elements['.after-dark-planet']);
    const sceneLayout = await page.evaluate(() => {
      const scene = document.querySelector('#mapa').getBoundingClientRect();
      const planet = document.querySelector('.after-dark-planet').getBoundingClientRect();
      const contentCenter = innerHeight / 2;
      return { scene: scene.toJSON(), planet: planet.toJSON(), centerY: planet.y + planet.height / 2 - contentCenter };
    });
    check(`${label} fixed globe vertically centered in viewport`, Math.abs(sceneLayout.centerY) <= 1.5, sceneLayout);
    check(`${label} globe has no visible toolbar`, await page.locator('.after-dark-globe-tools').count() === 0);
    check(`${label} globe has no standalone attendance CTA`, await page.locator('.after-dark-closing-caption').count() === 0);
    check(`${label} globe is keyboard accessible`, await canvas.getAttribute('tabindex') === '0' && Boolean(await canvas.getAttribute('aria-label')));
    check(`${label} status bar hides over closing controls`, await page.locator('.ad-status').getAttribute('aria-hidden') === 'true');
    await page.screenshot({ path: path.join(output, `${label}-globe.png`) });
    const ready = await canvas.evaluate(el => el.classList.contains('is-ready'));
    check(`${label} WebGL render available`, ready);
    await checkNoOrangeControls(page, `${label} globe`);
    const before = await markerState(page);
    await canvas.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowUp'); await page.waitForTimeout(200);
    const afterKey = await markerState(page);
    check(`${label} arrows rotate marker projection`, JSON.stringify(before) !== JSON.stringify(afterKey), { before, afterKey });
    await page.keyboard.press('Home'); await page.waitForTimeout(150);
    const resetState = await markerState(page);
    const b = await canvas.boundingBox();
    const cx = b.x + b.width / 2, cy = Math.max(40, Math.min(height - 40, b.y + b.height / 2));
    await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + Math.min(80, width / 5), cy + 12, { steps: 10 }); await page.mouse.up(); await page.waitForTimeout(180);
    const afterMouse = await markerState(page);
    check(`${label} mouse drag rotates marker projection`, JSON.stringify(resetState) !== JSON.stringify(afterMouse), { resetState, afterMouse });
    await canvas.focus(); await page.keyboard.press('Home'); await page.waitForTimeout(100);
    const beforeTouch = await markerState(page);
    await touchSwipe(page, cx, cy, Math.min(65, width / 5), 3);
    const afterTouch = await markerState(page);
    check(`${label} horizontal touch rotates globe`, JSON.stringify(beforeTouch) !== JSON.stringify(afterTouch), { beforeTouch, afterTouch });
    const beforeScroll = await page.evaluate(() => scrollY);
    await touchSwipe(page, cx, cy, 3, Math.min(110, height / 4));
    const afterScroll = await page.evaluate(() => scrollY);
    check(`${label} vertical touch over globe scrolls page`, Math.abs(afterScroll - beforeScroll) > 10, { beforeScroll, afterScroll, touchAction: await canvas.evaluate(el => getComputedStyle(el).touchAction) });
    await page.locator('#mapa').scrollIntoViewIfNeeded();
    await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await canvas.focus(); await page.keyboard.press('Home'); await page.waitForTimeout(100);
    const initial = await markerState(page);
    await page.keyboard.press('+'); await page.waitForTimeout(100); const zoomed = await markerState(page);
    await page.keyboard.press('-'); await page.keyboard.press('+'); await page.keyboard.press('Home'); await page.waitForTimeout(100);
    const final = await markerState(page);
    check(`${label} accessible keyboard zoom and reset`, JSON.stringify(initial) !== JSON.stringify(zoomed) && JSON.stringify(final) === JSON.stringify(initial), { initial, zoomed, final });
    const reducedBefore = await markerState(page); await page.waitForTimeout(900); const reducedAfter = await markerState(page);
    check(`${label} dynamic reduced motion stops autonomous rotation`, JSON.stringify(reducedBefore) === JSON.stringify(reducedAfter), { reducedBefore, reducedAfter });
    await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.waitForTimeout(4600);
    const movingBefore = await markerState(page); await page.waitForTimeout(700); const movingAfter = await markerState(page);
    check(`${label} rotation resumes when reduced motion disabled`, JSON.stringify(movingBefore) !== JSON.stringify(movingAfter));
    entry.markers = movingAfter;
    await page.screenshot({ path: path.join(output, `${label}-globe-interaction.png`) });
    const house = page.getByRole('button', { name: /The Pink House, confirmar asistencia/i });
    await canvas.focus(); await page.keyboard.press('Home'); await page.waitForTimeout(200);
    if (await house.isVisible()) {
      await house.focus();
      await house.click(); await page.locator('#attendance-modal[open]').waitFor();
      check(`${label} house marker opens RSVP`, true); await page.keyboard.press('Escape');
    } else check(`${label} house marker visible at reset`, false);
    await canvas.focus(); await page.keyboard.press('Home'); await page.waitForTimeout(150);
    const campus = page.locator('.after-dark-planet-marker--uvm');
    await campus.focus();
    await campus.click(); await page.locator('.after-dark-map-place[role="dialog"]').waitFor();
    check(`${label} campus marker opens contextual detail`, (await page.locator('.after-dark-map-place').innerText()).includes('UVM'));
    await page.keyboard.press('Escape'); await page.waitForTimeout(100);
    check(`${label} campus Escape closes and restores marker focus`, !(await page.locator('.after-dark-map-place').count()) && await campus.evaluate(el => document.activeElement === el));
  });

  await run(`${label} video and orientation`, async () => {
    await page.locator('#location').scrollIntoViewIfNeeded(); await page.waitForTimeout(700);
    entry.videoVisible = await page.locator('video').evaluateAll(elements => elements.map(el => ({ paused: el.paused, time: el.currentTime, readyState: el.readyState })));
    await page.evaluate(() => { window.__qaBackground = true; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(250);
    check(`${label} videos pause in background`, await page.locator('video').evaluateAll(elements => elements.every(el => el.paused)), entry.videoVisible);
    await page.evaluate(() => { window.__qaBackground = false; document.dispatchEvent(new Event('visibilitychange')); });
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForFunction(() => [...document.querySelectorAll('video')].every(el => el.paused), null, { timeout: 2000 }).catch(() => {});
    entry.videoOutside = await page.locator('video').evaluateAll(elements => elements.map(el => ({ src: el.currentSrc, paused: el.paused, currentTime: el.currentTime, top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom, viewport: innerHeight })));
    check(`${label} videos pause outside viewport`, entry.videoOutside.every(el => el.paused), entry.videoOutside);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('#location').scrollIntoViewIfNeeded(); await page.waitForTimeout(450);
    check(`${label} videos pause for reduced motion`, await page.locator('video').evaluateAll(elements => elements.every(el => el.paused)));
    await page.setViewportSize({ width: height, height: width }); await page.waitForTimeout(400);
    entry.orientation = await metrics(page);
    check(`${label} orientation resize no horizontal overflow`, entry.orientation.overflow <= 1, entry.orientation);
    await page.screenshot({ path: path.join(output, `${label}-orientation.png`) });
  });
  check(`${label} no runtime errors`, entry.pageErrors.length === 0 && entry.consoleErrors.length === 0, { pageErrors: entry.pageErrors, consoleErrors: entry.consoleErrors, consoleErrorLocations: entry.consoleErrorLocations, failedResponses: entry.failedResponses });
  report.views.push(entry); await save(); await context.close();
}

for (const [width, height] of [[390, 844], [1440, 900]]) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(kind, ...args) { if (/^webgl|experimental-webgl/.test(kind)) return null; return original.call(this, kind, ...args); };
  });
  const page = await context.newPage();
  await run(`${width}x${height} WebGL disabled fallback`, async () => {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' }); await dismissIntro(page);
    await page.locator('#mapa').scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
    const fallback = page.locator('.after-dark-planet-fallback');
    const detail = await fallback.evaluate(el => ({ opacity: getComputedStyle(el).opacity, visible: el.getBoundingClientRect().width > 0, imageLoaded: el.querySelector('img')?.complete, width: el.getBoundingClientRect().width }));
    check(`${width}x${height} static globe remains visible without WebGL`, Number(detail.opacity) > .9 && detail.visible && detail.imageLoaded, detail);
    const marker = page.getByRole('button', { name: /The Pink House, confirmar asistencia/i });
    check(`${width}x${height} fallback retains usable house marker`, await marker.isVisible() && await marker.isEnabled());
    await marker.click(); await page.locator('#attendance-modal[open]').waitFor();
    check(`${width}x${height} fallback marker opens RSVP`, true); await page.keyboard.press('Escape');
    await page.screenshot({ path: path.join(output, `${width}x${height}-webgl-fallback.png`) });
    report.fallback.push({ width, height, detail });
  });
  await context.close();
}

await run('WebGL context loss and recovery', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage(); await page.goto(baseUrl); await dismissIntro(page); await page.locator('#mapa').scrollIntoViewIfNeeded();
  const canvas = page.locator('.after-dark-planet-canvas'); await canvas.waitFor(); await page.waitForTimeout(300);
  const hasExtension = await canvas.evaluate(el => { const gl = el.getContext('webgl2'); window.__qaLoseContext = gl?.getExtension('WEBGL_lose_context'); return Boolean(window.__qaLoseContext); });
  if (hasExtension) {
    await page.evaluate(() => window.__qaLoseContext.loseContext()); await page.waitForTimeout(250);
    check('Context loss shows fallback', await page.locator('.after-dark-planet-fallback').evaluate(el => Number(getComputedStyle(el).opacity) > .9));
    await page.evaluate(() => window.__qaLoseContext.restoreContext()); await page.waitForTimeout(600);
    check('Context recovery restores WebGL', await canvas.evaluate(el => el.classList.contains('is-ready')));
  } else report.warnings.push('WEBGL_lose_context extension unavailable in this browser.');
  await context.close();
});

await browser.close();
report.summary = { passed: report.checks.filter(c => c.pass).length, failed: report.checks.filter(c => !c.pass).length, total: report.checks.length };
await save(); console.log(JSON.stringify(report.summary));
process.exitCode = report.summary.failed ? 1 : 0;
