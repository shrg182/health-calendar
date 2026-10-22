const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const context=await browser.newContext({locale:'en-US',timezoneId:'America/Detroit',viewport:{width:390,height:844},serviceWorkers:'block'});
 await context.addInitScript(()=>localStorage.setItem('daymark.shensha.v1',JSON.stringify({
  tiande:{enabled:true,targets:[...'甲乙丙丁戊己庚辛壬癸']},
  kongwang:{enabled:true,targets:['子']},
  custom1:{enabled:true,targets:['甲']}
 })));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8769/#day=2028-03-15');
 assert.equal(await page.locator('#shensha-reference').inputValue(),'2028-03-15');
 const dates=()=>page.locator('#shensha-period-results li').evaluateAll(rows=>rows.map(row=>row.dataset.date));
 async function run(ref,direction,length,first,last,count){
  await page.locator('#shensha-reference').fill(ref);await page.locator('#shensha-reference').dispatchEvent('change');
  await page.locator(`[data-direction="${direction}"][data-shensha-period="${length}"]`).click();
  const actual=await dates();assert.equal(actual.length,count);assert.equal(actual[0],first);assert.equal(actual.at(-1),last);
  assert(!actual.includes(ref));return actual;
 }
 await run('2028-03-15',-1,'month','2028-02-01','2028-02-29',29);
 await run('2028-01-15',-1,'month','2027-12-01','2027-12-31',31);
 await run('2028-01-31',1,'month','2028-02-01','2028-02-29',29);
 await run('2028-12-15',1,'month','2029-01-01','2029-01-31',31);
 await run('2026-03-10',-1,'7','2026-03-03','2026-03-09',7); // crosses spring DST
 await run('2026-10-28',1,'10','2026-10-29','2026-11-07',10); // crosses autumn DST
 await run('2026-10-22',-1,'10','2026-10-12','2026-10-21',10);
 await run('2026-10-22',1,'7','2026-10-23','2026-10-29',7);
 // Every day matches tiande; only 子 days trigger the inactive override.
 for(const row of await page.locator('#shensha-period-results li').all()){
  const pillar=(await row.locator('a').innerText()).split(' · ')[1];
  assert.equal(await row.locator('.inactive').count()>0,pillar.endsWith('子'));
  assert.equal(await row.locator('.important').count(),pillar.startsWith('甲')?1:0);
 }
 await page.waitForFunction(()=>!document.querySelector('#daily-note').disabled);
 await page.locator('#daily-note').fill('Keep this period-navigation draft');
 await page.locator('#shensha-period-results li a').first().click();
 assert.equal(new URL(page.url()).hash,'#day=2026-10-23');
 assert.equal(await page.locator('#shensha-reference').inputValue(),'2026-10-22');
 await page.goBack();assert.equal(await page.locator('#daily-note').inputValue(),'Keep this period-navigation draft');await page.locator('#daily-note').fill('');
 for(const lang of ['zh','ru','fr','en']){await page.locator('#language-choice').selectOption(lang);assert.equal((await dates()).length,7);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 await run('1901-01-04',-1,'7','1901-01-01','1901-01-03',3);
 await page.locator('#shensha-reference').fill('1901-01-01');await page.locator('#shensha-reference').dispatchEvent('change');
 assert(await page.locator('[data-direction="-1"][data-shensha-period="month"]').isDisabled());
 await run('2100-12-28',1,'10','2100-12-29','2100-12-31',3);
 await page.locator('#shensha-reference').fill('');await page.locator('#shensha-reference').dispatchEvent('change');assert.match(await page.locator('#shensha-period-status').innerText(),/reference date/);assert.equal((await dates()).length,0);
 await page.locator('#shensha-reference').fill('2026-10-22');await page.locator('#shensha-reference').dispatchEvent('change');
 await page.setViewportSize({width:320,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.locator('#shensha-period-panel').screenshot({path:'/tmp/daymark-shensha-periods.png'});
 await page.locator('#open-settings').click();assert(await page.locator('#shensha-period-panel').isHidden());
 // Saving a target change recalculates the existing period.
 await page.locator('#shensha-tiande').uncheck();await page.locator('#shensha-kongwang').uncheck();
 const picker=page.locator('#shensha-picker-custom1');await picker.locator('summary').click();
 await picker.locator('input[value="甲"]').uncheck();await picker.locator('input[value="甲子"]').check();
 await page.locator('#shensha-form button[type=submit]').click();await page.goBack();
 assert.match(await page.locator('#shensha-period-status').innerText(),/no matching dates/);assert.equal((await dates()).length,0);
 await page.locator('#open-settings').click();await page.locator('#shensha-custom1').uncheck();
 await page.locator('#shensha-form button[type=submit]').click();await page.goBack();assert.match(await page.locator('#shensha-period-status').innerText(),/Settings first/);assert.equal((await dates()).length,0);
 assert.deepEqual(errors,[]);
 console.log('Passed: six period buttons, leap/year/DST boundaries, clipping, Kongwang/custom styles, result navigation/drafts, stable reference, live settings/language, empty input, mobile fit.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
