const playwright=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const engine=process.env.TEST_ENGINE || 'chromium';
 const browser=await playwright[engine].launch(engine==='chromium'?{channel:'chrome',headless:true}:{headless:true});
 try {
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'en-US',serviceWorkers:'block'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8769/');
  assert(await page.locator('#calendar-page').isVisible());assert(await page.locator('#account-form').isHidden());
  assert(await page.locator('.view-switch').isHidden());assert(await page.locator('#install-app').isHidden());
  assert((await page.locator('#calendar-card').boundingBox()).y<350,'Calendar should appear near top on phone');
  assert.equal((await page.locator('label[for=language-choice]').boundingBox()).width,1);
  assert.equal(await page.locator('.brand').count(),0);
  for(const lang of ['en','zh','ru']) {
   await page.locator('#language-choice').selectOption(lang);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   if(process.env.SCREENSHOTS) await page.screenshot({path:`/tmp/daymark-main-${lang}.png`,fullPage:true});
   await page.locator('#open-settings').click();assert(await page.locator('#settings-page').isVisible());
   assert(await page.locator('#calendar-page').isHidden());
   assert.equal(await page.locator('#open-settings').getAttribute('aria-expanded'),'true');
   await page.locator('[data-view=gregorian]').click();
   if(process.env.SCREENSHOTS) await page.screenshot({path:`/tmp/daymark-settings-${lang}.png`,fullPage:true});
   await page.locator('#settings-back').click();assert(await page.locator('#calendar-card').evaluate(e=>e.classList.contains('greg-only')));
  }
  await page.locator('#language-choice').selectOption('en');
  await page.locator('#days .day:not(.outside)').first().click();
  await page.waitForFunction(()=>!document.querySelector('#daily-note').disabled);
  const dayHash=new URL(page.url()).hash;
  await page.locator('#daily-note').fill('Keep this draft while visiting Settings');
  await page.locator('#open-settings').click();await page.locator('#account-password').fill('fake-test-only');
  await page.locator('#language-choice').selectOption('ru');
  assert.equal(await page.locator('#account-password').inputValue(),'fake-test-only');
  await page.goBack();await page.locator('#detail-page').waitFor({state:'visible'});
  assert.equal(new URL(page.url()).hash,dayHash);assert.equal(await page.locator('#daily-note').inputValue(),'Keep this draft while visiting Settings');
  await page.locator('#daily-note').fill('');
  await page.goto('http://127.0.0.1:8769/#settings-display');
  assert(await page.locator('#settings-page').isVisible());
  assert.equal(await page.locator('[data-view=gregorian]').getAttribute('aria-pressed'),'true');
  await page.locator('#calendar-home').click();assert(await page.locator('#calendar-page').isVisible());
  await page.locator('#calendar-sync').click();assert.equal(new URL(page.url()).hash,'#settings-account');
  for(const width of [320,375,430]) {
   await page.setViewportSize({width,height:844});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.locator('#settings-back').click();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.locator('#open-settings').click();
  }
  assert.deepEqual(errors,[]);
  console.log(`Passed (${engine}): calendar-first layout, translated Settings, hidden account/display controls, saved view, draft/password preservation, browser Back/direct routes, compact status links, phone layouts.`);
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
