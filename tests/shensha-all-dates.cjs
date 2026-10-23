const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const context=await browser.newContext({locale:'en-US',timezoneId:'America/Detroit',serviceWorkers:'block'});
 await context.addInitScript(()=>localStorage.setItem('daymark.shensha.v1',JSON.stringify({tianyi:{enabled:true,targets:['巳']}})));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8769/#calendar');
 async function range(start,end){await page.locator('#shensha-period').selectOption('custom');await page.locator('#shensha-start').fill(start);await page.locator('#shensha-end').fill(end);await page.locator('#shensha-range-form button[type=submit]').click();}
 const rows=page.locator('#shensha-period-results li[data-date]');
 for(const display of ['calendar','cards']){
  await page.locator('#shensha-display').selectOption(display);
  await range('2026-10-20','2026-10-24');
  assert.deepEqual(await rows.evaluateAll(rs=>rs.map(r=>r.dataset.date)),['2026-10-20','2026-10-21','2026-10-22','2026-10-23','2026-10-24']);
  assert.equal(await page.locator('.shensha-no-encounters').count(),4);
  assert.equal(await page.locator('#shensha-period-results [data-shensha=tianyi]').count(),1);
  assert.equal(await page.locator('[data-date="2026-10-20"] .shensha-no-encounters').innerText(),'No Shensha encounters.');
  await range('2026-10-20','2026-10-21');assert.equal(await rows.count(),2);assert.equal(await page.locator('.shensha-no-encounters').count(),2);
  await range('2026-10-01','2026-11-09');assert.equal(await rows.count(),31);
  await page.locator('#shensha-page-next').click();assert.equal(await rows.count(),9);assert.equal(await rows.first().getAttribute('data-date'),'2026-11-01');
  await page.locator('#shensha-page-prev').click();assert.equal(await rows.first().getAttribute('data-date'),'2026-10-01');
 }
 await range('2026-10-20','2026-10-21');
 for(const lang of ['zh','ja','ru','fr','en']){await page.locator('#language-choice').selectOption(lang);assert.equal(await rows.count(),2);for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}}
 await page.locator('[data-date="2026-10-20"] .shensha-result-date').click();assert.equal(new URL(page.url()).hash,'#day=2026-10-20');
 assert.deepEqual(errors,[]);console.log('Passed: every date shown with sparse or no encounters in both views, continuous pagination, five languages, mobile layout, and navigation from an empty day.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
