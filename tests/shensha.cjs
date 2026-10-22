const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const context=await browser.newContext({locale:'en-US',viewport:{width:390,height:844},serviceWorkers:'block'});
 const page=await context.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8769/#day=2026-10-25');
 await page.waitForFunction(()=>!document.querySelector('#daily-note').disabled);
 assert(await page.locator('#shensha-detail').isHidden());
 const pillar=(await page.locator('#detail-day-pillar').innerText()).slice(0,2);
 await page.locator('#daily-note').fill('Draft survives matching settings');
 await page.locator('#open-settings').click();
 assert.equal(await page.locator('.shensha-row > label input[type=checkbox]').count(),18);
 assert.equal(await page.locator('#shensha-picker-kuigang summary').getAttribute('aria-disabled'),'true');
 assert.equal(await page.locator('#shensha-fields select').count(),0);
 assert.equal(await page.locator('#shensha-fields input[placeholder]').count(),0);
 async function enable(id,type,targets){
  await page.locator(`#shensha-${id}`).check();
  const picker=page.locator(`#shensha-picker-${id}`);await picker.locator('summary').click();
  for(const option of await picker.locator('input[type=checkbox]:checked').all())await option.uncheck();
  for(const value of new Set(targets.split('、')))await picker.locator(`input[type=checkbox][value="${value}"]`).check();
  await picker.locator('summary').click();
 }
 async function save(){await page.locator('#shensha-form button[type=submit]').click();}
 await page.locator('#shensha-kuigang').check();await save();
 assert.match(await page.locator('#shensha-status').innerText(),/at least one/);
 assert.equal(await page.evaluate(()=>localStorage.getItem('daymark.shensha.v1')),null);
 await enable('kuigang','pillar',pillar);
 await enable('shie','pillar',pillar);
 await enable('tiande','stem',pillar[0]);await save();
 await page.goBack();
 assert.equal(await page.locator('#daily-note').inputValue(),'Draft survives matching settings');
 assert.equal(await page.locator('.shensha-badge.sha').count(),2);
 assert.equal(await page.locator('.shensha-badge.shen').count(),1);
 assert(await page.locator('#shensha-inactive').isHidden());
 await page.locator('#open-settings').click();await enable('kongwang','branch',pillar[1]);await save();await page.goBack();
 assert.equal(await page.locator('.shensha-badge.inactive').count(),4);
 assert.equal(await page.locator('.shensha-badge.sha,.shensha-badge.shen').count(),0);
 assert(await page.locator('#shensha-inactive').isVisible());
 await page.locator('#daily-note').fill('');await page.reload();
 assert.equal(await page.locator('.shensha-badge.inactive').count(),4);
 await page.locator('#open-settings').click();await page.locator('#shensha-kongwang').uncheck();await save();await page.goBack();
 assert.equal(await page.locator('.shensha-badge.sha').count(),2);
 for(const lang of ['zh','ru','fr','en']){
  await page.locator('#language-choice').selectOption(lang);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('#open-settings').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.goBack();
 }
 // Nonmatching targets must show the empty state, never an inactive day.
 await page.locator('#open-settings').click();
 for(const id of ['kuigang','shie','tiande'])await page.locator(`#shensha-${id}`).uncheck();
 const other=pillar[1]==='子'?'丑':'子';await enable('kongwang','branch',other);await save();await page.goBack();
 assert(await page.locator('#shensha-empty').isVisible());assert(await page.locator('#shensha-inactive').isHidden());
 // Custom slots accept each target type, stay unnamed, persist, and obey Kongwang.
 await page.locator('#open-settings').click();
 await page.locator('#shensha-kongwang').uncheck();
 await enable('custom1','pillar',pillar);
 await enable('custom2','stem',pillar[0]);
 await enable('custom3','branch',pillar[1]);
 assert.equal(await page.locator('.shensha-row.important .shensha-chip').first().evaluate(el=>getComputedStyle(el).fontWeight),'700');
 await save();await page.goBack();
 assert.equal(await page.locator('.shensha-badge.custom.important').count(),3);
 assert.equal(await page.locator('[data-shensha=custom1]').innerText(),pillar);
 assert.equal(await page.locator('[data-shensha=custom1]').evaluate(el=>getComputedStyle(el).fontWeight),'700');
 await page.reload();assert.equal(await page.locator('.shensha-badge.custom.important').count(),3);
 await page.locator('#open-settings').click();await enable('kongwang','branch',pillar[1]);await save();await page.goBack();
 assert.equal(await page.locator('.shensha-badge.inactive.important').count(),3);
 await page.locator('#open-settings').click();await page.locator('#shensha-custom1').uncheck();await save();await page.goBack();
 assert.equal(await page.locator('[data-shensha=custom1]').count(),0);
 await page.goto('http://127.0.0.1:8769/#settings-shensha');assert(await page.locator('#settings-shensha').isVisible());
 await page.setViewportSize({width:320,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 // Search filters all three groups; chips can remove and reselect targets.
 await page.locator('#shensha-custom2').check();
 const picker=page.locator('#shensha-picker-custom2');await picker.locator('summary').click();
 await picker.locator('input[type=search]').fill('庚辰');
 assert.equal(await picker.locator('[data-value]:visible').count(),1);
 await picker.locator('input[type=search]').fill('');
 assert.equal(await picker.locator('[data-value]:visible').count(),82);
 await picker.locator('summary').click();
 await page.locator('.shensha-row').filter({has:page.locator('#shensha-custom2')}).locator('.shensha-chip').click();
 assert.equal(await picker.locator('input[type=checkbox]:checked').count(),0);
 await page.screenshot({path:'/tmp/daymark-shensha-settings.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('Passed: 15 named rules and 3 bold custom slots, validation, separate matches, Kongwang override, disable/no-match behavior, persistence, drafts, four languages, phone layout, direct route.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
