import { chromium } from '../aerial/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('output/experience-qa/reference');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const report = [];
for (const [width, height] of [[390, 844], [768, 1024], [1440, 900]]) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 1100, isMobile: width < 600 });
  const page = await context.newPage();
  const entry = { width, height };
  try {
    await page.goto('https://www.afterdarktour.nike.com/es/mexicocity', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);
    const reject = page.getByRole('button', { name: /^REJECT$/i });
    if (await reject.count()) {
      await reject.click(); await page.waitForTimeout(1200);
      const confirmChoices = page.getByRole('button', { name: /^Confirm Choices$/i });
      if (await confirmChoices.count()) { await confirmChoices.click(); await page.waitForTimeout(900); }
    }
    await page.mouse.wheel(0, 1); await page.waitForTimeout(600); await page.evaluate(() => scrollTo(0, 0));
    const menu = page.locator('.header-menu-toggle');
    await menu.hover(); await page.waitForTimeout(300);
    entry.hover = await menu.evaluate(el => ({ color: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor, transition: getComputedStyle(el).transition }));
    await menu.focus();
    entry.focus = await menu.evaluate(el => ({ isFocused: document.activeElement === el, outline: getComputedStyle(el).outline }));
    await menu.click(); await page.waitForTimeout(500);
    entry.menuOpen = await menu.getAttribute('aria-expanded') === 'true';
    await page.screenshot({ path: path.join(output, `${width}x${height}-clean-menu.png`) });
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    entry.escapeClosed = await menu.getAttribute('aria-expanded') === 'false';
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(1200);
    const canvas = page.locator('canvas').last();
    const bounds = await canvas.boundingBox();
    const cx = Math.min(width - 60, Math.max(60, bounds.x + bounds.width / 2));
    const cy = Math.min(height - 120, Math.max(120, bounds.y + bounds.height / 2));
    const client = await context.newCDPSession(page);
    const swipe = async (dx, dy) => {
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 1 }] });
      for (let step = 1; step <= 12; step++) { await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + dx * step / 12, y: cy + dy * step / 12, id: 1 }] }); await page.waitForTimeout(18); }
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(350);
    };
    entry.canvas = await canvas.evaluate(el => { const r = el.getBoundingClientRect(); return { width: r.width, height: r.height, touchAction: getComputedStyle(el).touchAction, tabIndex: el.tabIndex }; });
    const beforeTouch = await page.screenshot(); await swipe(80, 1); const afterTouch = await page.screenshot();
    entry.horizontalTouchVisualChanges = !beforeTouch.equals(afterTouch);
    const beforeScroll = await page.evaluate(() => scrollY); await swipe(2, 120); const afterScroll = await page.evaluate(() => scrollY);
    entry.verticalTouchScroll = { before: beforeScroll, after: afterScroll, delta: afterScroll - beforeScroll };
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(200);
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(300);
    const beforeReduced = await canvas.screenshot(); await page.waitForTimeout(1000); const afterReduced = await canvas.screenshot();
    entry.reducedMotion = { matched: await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), canvasStillChanges: !beforeReduced.equals(afterReduced), runningDOMAnimations: await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length) };
    await page.screenshot({ path: path.join(output, `${width}x${height}-clean-globe-touch.png`) });
    await page.setViewportSize({ width: height, height: width }); await page.waitForTimeout(400);
    entry.orientation = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
    await client.detach();
  } catch (error) { entry.error = error.message; }
  report.push(entry); console.log(JSON.stringify(entry)); await context.close();
}
await writeFile(path.join(output, 'interactions.json'), JSON.stringify(report, null, 2));
await browser.close();
