const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const context=await browser.newContext({locale:'en-US',timezoneId:'America/Detroit',viewport:{width:390,height:844},serviceWorkers:'block'});
 await context.addInitScript(()=>localStorage.setItem('daymark.shensha.v1',JSON.stringify({
  tiande:{enabled:true,targets:[...'甲乙丙丁戊己庚辛壬癸']},tianyi:{enabled:true,targets:['巳']},kongwang:{enabled:true,targets:['子']}
 })));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8769/#day=2026-10-22');
 await page.locator('#shensha-display').selectOption('cards');
 const cards=()=>page.locator('#shensha-period-results li.shensha-date-card');
 const dates=()=>cards().evaluateAll(rows=>rows.map(row=>row.dataset.date));
 async function range(start,end){await page.locator('#shensha-start').fill(start);await page.locator('#shensha-end').fill(end);await page.locator('#shensha-range-form button[type=submit]').click();}
 await range('2026-10-21','2026-10-23');assert.deepEqual(await dates(),['2026-10-21','2026-10-22','2026-10-23']);
 const card=page.locator('[data-date="2026-10-22"].shensha-date-card');
 assert.match(await card.locator('.shensha-result-date').innerText(),/Thursday/);assert.match(await card.locator('.lunar').innerText(),/Lunar month/);
 assert(await card.locator('.ganzhi').isVisible());
 assert.match(await card.locator('.ganzhi').innerText(),/Year pillar 丙午.*Month pillar 戊戌.*Day pillar 己巳/);
 assert.equal(await card.locator(':scope > .shensha-matches [data-shensha=tiande]').count(),1);
 assert.equal(await card.locator(':scope > .shensha-matches [data-shensha=tiande]').innerText(),'Heavenly Virtue（天德） +++');
 assert.equal(await card.locator(':scope > .shensha-matches [data-shensha=tianyi]').innerText(),'Heavenly Mentor（天乙）');
 assert.equal(await card.locator('details').getAttribute('open'),null);
 await card.locator('summary').click();assert(await card.locator('.intense').first().isVisible());
 await range('2026-10-17','2026-10-17');assert.match(await cards().innerText(),/Inactive/);assert.equal(await cards().locator('.intense').count(),0);
 await range('2026-10-23','2026-10-21');assert.match(await page.locator('#shensha-period-status').innerText(),/end on or after/);assert.equal(await cards().count(),0);
 for(const [ref,dir,len,start,end,count] of [['2028-03-15',-1,'month','2028-02-01','2028-02-29',29],['2026-03-10',-1,'7','2026-03-03','2026-03-09',7],['2026-10-28',1,'10','2026-10-29','2026-11-07',10]]){
  await page.locator('#shensha-reference').fill(ref);await page.locator('#shensha-reference').dispatchEvent('change');
  const button=page.locator(`[data-direction="${dir}"][data-shensha-period="${len}"]`);await button.click();
  assert.equal(await page.locator('#shensha-start').inputValue(),start);assert.equal(await page.locator('#shensha-end').inputValue(),end);
  const actual=await dates();assert.equal(actual.length,count);assert.equal(actual[0],start);assert.equal(actual.at(-1),end);
  await button.click();assert(await page.locator('#shensha-period-results').isHidden());assert.equal(await cards().count(),0);
 }
 await range('1901-01-01','2100-12-31');assert.equal(await cards().count(),31);assert.equal((await dates())[0],'1901-01-01');assert(await page.locator('#shensha-page-prev').isDisabled());
 await page.locator('#shensha-page-next').click();assert.equal((await dates())[0],'1901-02-01');await page.locator('#shensha-page-prev').click();assert.equal((await dates())[0],'1901-01-01');
 await range('2100-12-28','2100-12-31');assert.equal(await cards().count(),4);assert(await page.locator('#shensha-result-pages').isHidden());
 await range('2026-10-21','2026-10-23');
 for(const lang of ['zh','ru','fr','en']){await page.locator('#language-choice').selectOption(lang);for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}}
 await page.setViewportSize({width:390,height:844});await page.locator('#shensha-period-panel').screenshot({path:'/tmp/daymark-range-cards.png'});
 await page.waitForFunction(()=>!document.querySelector('#daily-note').disabled);await page.locator('#daily-note').fill('Keep my draft');
 await card.locator('.shensha-result-date').click();assert.equal(new URL(page.url()).hash,'#day=2026-10-22');assert.equal(await page.locator('#daily-note').inputValue(),'Keep my draft');
 await page.locator('#shensha-close').click();assert(await page.locator('#shensha-period-results').isHidden());
 assert.deepEqual(errors,[]);console.log('Passed: inclusive ranges, validation, shortcuts, leap/DST boundaries, 1901–2100 pagination, calendar cards, unique names, single/repeated signs, hour strength, Void, drafts, four languages and mobile layout.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
