import { chromium } from '../aerial/node_modules/playwright/index.mjs';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({headless:true,channel:'chrome'});
await mkdir('output/party-qa',{recursive:true});
for (const width of [390,1440]) {
 const page = await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.QA_BASE_URL || 'http://127.0.0.1:5182');
 const archive=page.locator('#archive'); await archive.scrollIntoViewIfNeeded();
 const gallery=archive.locator('.ad-past-gallery'); await gallery.focus();
 await page.keyboard.press('ArrowRight'); await page.waitForTimeout(400);
 if(!(await gallery.evaluate(el=>el.scrollLeft>0))) throw new Error('Gallery does not respond to keyboard');
 await page.keyboard.press('Home');
 await page.waitForTimeout(600);
 const images=await archive.locator('img').evaluateAll(els=>els.map(e=>({src:e.getAttribute('src'),loaded:e.complete && e.naturalWidth>0,width:e.naturalWidth,height:e.naturalHeight})));
 if(images.length!==3||images.some(e=>!e.loaded)) throw new Error('Party photos not loaded '+JSON.stringify(images));
 if(await page.getByRole('tab').count()) throw new Error('View selector still present');
 if(await page.locator('.ad-location-flat').count()) throw new Error('Flat view still present');
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) throw new Error('Horizontal overflow');
 await archive.screenshot({path:`output/party-qa/archive-${width}.png`});
 await page.locator('#location').scrollIntoViewIfNeeded();
 await page.getByRole('button',{name:'Ampliar mapa de Juriquilla'}).click();
 await page.getByRole('dialog').waitFor();
 if(errors.length) throw new Error(errors.join('\n'));
 console.log(JSON.stringify({width,images,selectorRemoved:true,expandWorks:true,errors})); await page.close();
}
await browser.close();
