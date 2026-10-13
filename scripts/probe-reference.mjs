import { chromium } from '../aerial/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Observe public layout and behavior only. No source or remote assets are saved.
const output = path.resolve('output/experience-qa/reference');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const matrix = [
  [320, 568], [390, 844], [844, 390], [768, 1024], [1024, 768], [1440, 900], [1920, 1080],
];
const report = { url: 'https://www.afterdarktour.nike.com/es/mexicocity', observedAt: new Date().toISOString(), views: [] };

for (const [width, height] of matrix) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 1100, isMobile: width < 600, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const entry = { width, height, errors: [] };
  page.on('pageerror', error => entry.errors.push(error.message));
  try {
    await page.goto(report.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(6500);
    await page.mouse.wheel(0, 1);
    await page.waitForTimeout(1500);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(output, `${width}x${height}-hero.png`) });
    entry.layout = await page.evaluate(() => {
      const sample = element => {
        const r = element.getBoundingClientRect();
        const s = getComputedStyle(element);
        return { tag: element.tagName, text: (element.innerText ?? element.textContent ?? '').trim().slice(0, 120), x: r.x, y: r.y, width: r.width, height: r.height, font: s.fontFamily, fontSize: s.fontSize, lineHeight: s.lineHeight, letterSpacing: s.letterSpacing, position: s.position, color: s.color, background: s.backgroundColor, transform: s.transform, touchAction: s.touchAction };
      };
      return { viewport: { width: innerWidth, height: innerHeight }, pageHeight: document.documentElement.scrollHeight, overflow: document.documentElement.scrollWidth - innerWidth, headings: [...document.querySelectorAll('h1,h2,h3')].slice(0, 22).map(sample), navigation: [...document.querySelectorAll('header,nav,button')].slice(0, 18).map(sample), canvases: [...document.querySelectorAll('canvas')].map(sample), videos: [...document.querySelectorAll('video')].map(v => ({ ...sample(v), autoplay: v.autoplay, muted: v.muted, paused: v.paused })) };
    });
    // Observe hover/focus and open/close navigation without leaving the reference.
    const candidates = page.getByRole('button').filter({ hasText: /menu|menú/i });
    if (await candidates.count()) {
      const menu = candidates.first();
      await menu.hover();
      entry.menuHover = await menu.evaluate(el => { const s = getComputedStyle(el); return { color: s.color, background: s.backgroundColor, transform: s.transform, outline: s.outline }; });
      await menu.focus();
      entry.menuFocus = await menu.evaluate(el => ({ focus: document.activeElement === el, outline: getComputedStyle(el).outline }));
      await menu.click();
      await page.waitForTimeout(700);
      entry.openMenu = await page.evaluate(() => ({ dialogCount: document.querySelectorAll('[role="dialog"],dialog[open]').length, bodyOverflow: getComputedStyle(document.body).overflow, links: [...document.querySelectorAll('nav a')].map(e => ({ text: e.innerText, href: e.getAttribute('href') })) }));
      await page.screenshot({ path: path.join(output, `${width}x${height}-menu.png`) });
      await page.keyboard.press('Escape');
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(350);
    entry.reducedMotion = await page.evaluate(() => ({ media: matchMedia('(prefers-reduced-motion: reduce)').matches, animations: document.getAnimations().slice(0, 30).map(a => ({ state: a.playState, duration: a.effect?.getTiming().duration })) }));
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight / 2));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(output, `${width}x${height}-middle.png`) });
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(1800);
    await page.screenshot({ path: path.join(output, `${width}x${height}-globe.png`) });
    const globe = page.locator('canvas').last();
    if (await globe.count()) {
      entry.globe = await globe.evaluate(el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return { x: r.x, y: r.y, width: r.width, height: r.height, touchAction: s.touchAction, role: el.getAttribute('role'), tabindex: el.getAttribute('tabindex') }; });
      const bounds = await globe.boundingBox();
      if (bounds && bounds.y < height && bounds.y + bounds.height > 0) {
        const x = Math.min(width - 20, Math.max(20, bounds.x + bounds.width / 2));
        const y = Math.min(height - 25, Math.max(25, bounds.y + bounds.height / 2));
        await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 60, y + 10, { steps: 8 }); await page.mouse.up();
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(output, `${width}x${height}-globe-drag.png`) });
        entry.dragAttempted = true;
      }
    }
    await page.setViewportSize({ width: height, height: width });
    await page.waitForTimeout(700);
    entry.resized = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth - innerWidth }));
  } catch (error) { entry.failure = error.message; }
  report.views.push(entry);
  await writeFile(path.join(output, 'measurements.json'), JSON.stringify(report, null, 2));
  console.log(`${width}x${height}: ${entry.failure || `height ${entry.layout?.pageHeight}, overflow ${entry.layout?.overflow}`}`);
  await context.close();
}
await browser.close();
