const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const context=await browser.newContext({serviceWorkers:'block',locale:'en-US',viewport:{width:390,height:844}});
 await context.addInitScript(()=>localStorage.setItem('daymark.shensha.v1',JSON.stringify({tiande:{enabled:true,targets:[...'甲乙丙丁戊己庚辛壬癸']},yuede:{enabled:true,targets:[...'甲乙丙丁戊己庚辛壬癸']},tianyi:{enabled:true,targets:['巳']},yangren:{enabled:true,targets:['巳']},kongwang:{enabled:true,targets:['子']}})));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8769/#calendar');
 await page.locator('#jump-year').fill('2026');await page.locator('#jump-month').selectOption('9');await page.locator('#month-form button').click();
 assert.equal(await page.locator('#days .calendar-shensha').count(),0);
 await page.locator('#shensha-period').selectOption('custom');await page.locator('#shensha-start').fill('2026-10-17');await page.locator('#shensha-end').fill('2026-10-23');await page.locator('#shensha-range-form button[type=submit]').click();
 const cell=page.locator('#shensha-period-results [data-date="2026-10-22"]');
 assert.equal(await cell.locator('.ganzhi').count(),0);
 assert.equal(await cell.locator('.calendar-shensha-name').first().innerText(),'Heavenly Virtue');
 assert.equal(await cell.locator('.shensha-badge').count(),2);assert.equal(await cell.locator('.calendar-shensha-strength').first().innerText(),'+++');assert.equal(await cell.locator('.calendar-shensha-more').innerText(),'2 more');
 assert.match(await cell.getAttribute('aria-label'),/Heavenly Mentor（天乙）.*Sheep Blade（羊刃）/);
 assert.equal(await page.locator('#shensha-period-results [data-date="2026-10-17"] .inactive').count(),2);
 for(const lang of ['zh','ja','ru','fr','en']){await page.locator('#language-choice').selectOption(lang);for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}}
 await page.setViewportSize({width:390,height:844});await page.locator('#shensha-period-results').screenshot({path:'/tmp/daymark-calendar-shensha.png'});
 await page.locator('#shensha-display').selectOption('cards');
 assert.equal(await page.locator('#shensha-period-results .shensha-date-card').count(),7);
 assert.equal(await cell.locator(':scope > .shensha-matches .shensha-badge').count(),4);
 assert.match(await cell.locator('.ganzhi').innerText(),/Year pillar.*Month pillar.*Day pillar/);
 assert.match(await cell.locator(':scope > .shensha-matches').innerText(),/Heavenly Virtue（天德）/);
 await page.reload();assert.equal(await page.locator('#shensha-display').inputValue(),'cards');
 await page.locator('#shensha-period').selectOption('custom');await page.locator('#shensha-start').fill('2026-10-22');await page.locator('#shensha-end').fill('2026-10-22');await page.locator('#shensha-range-form button[type=submit]').click();
 await page.locator('#shensha-display').selectOption('calendar');assert.equal(await page.locator('#shensha-period-results .shensha-encounter-cell').count(),1);
 await cell.locator('.shensha-result-date').click();assert.equal(new URL(page.url()).hash,'#day=2026-10-22');assert(await page.locator('#detail-day-pillar').isVisible());
 await page.locator('#open-settings').click();for(const id of ['tiande','yuede','tianyi','yangren','kongwang'])await page.locator(`#shensha-${id}`).uncheck();await page.locator('#shensha-form button[type=submit]').click();
 await page.goto('http://127.0.0.1:8769/#calendar');assert.equal(await page.locator('#days .calendar-shensha').count(),0);
 assert.deepEqual(errors,[]);console.log('Passed: clean main calendar, encounter-only previews, saved detailed-card option, repeated signs, overflow count, full accessible names, inactive dates, day navigation, settings updates, translations, mobile widths.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
