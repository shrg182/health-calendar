const playwright = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
(async () => {
 const engine = process.env.TEST_ENGINE || 'chromium';
 const browser = await playwright[engine].launch(engine === 'chromium' ? {channel:'chrome',headless:true} : {headless:true});
 try {
  const context = await browser.newContext({viewport:{width:320,height:800},locale:'ru-RU',serviceWorkers:'block'});
  let signIns = 0;
  await context.route('**/sync-config.js', r=>r.fulfill({contentType:'text/javascript',body:"window.DAYMARK_SYNC={url:'https://cloud.test',publishableKey:'test'}"}));
  await context.route('https://cloud.test/**',r=>{
   const path=new URL(r.request().url()).pathname;
   if(path.endsWith('/token')) { signIns++; return r.fulfill({json:{user:{id:'language-test',email:'test@example.invalid'},access_token:'test-only',refresh_token:'test-only',expires_in:3600}}); }
   if(path.endsWith('/read_daily_notes')) return r.fulfill({json:[]});
   return r.fulfill({json:{}});
  });
  const page=await context.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:8769/');
  assert.equal(await page.locator('html').getAttribute('lang'),'ru-RU');
  assert.equal(await page.locator('#page-title').textContent(),'Календарь');
  assert.equal(await page.locator('#days .day').count(),42);
  for(const lang of ['zh','en','ru']) {
   await page.locator('#language-choice').selectOption(lang);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${lang} calendar overflow`);
   if(process.env.SCREENSHOTS) await page.screenshot({path:`/tmp/daymark-language-${lang}.png`,fullPage:true});
  }
  // Leap-month labels and day identity do not depend on interface language.
  await page.locator('#find-date').fill('2025-07-25');await page.locator('#date-form button').click();
  const key=new URL(page.url()).hash;
  assert((await page.locator('#detail-lunar').textContent()).includes('Вставной'));
  await page.locator('#daily-note').fill('Calendar — 今天 — Сегодня');
  for(const lang of ['en','zh','ru']) {
   await page.locator('#language-choice').selectOption(lang);
   assert.equal(new URL(page.url()).hash,key);
   assert.equal(await page.locator('#daily-note').inputValue(),'Calendar — 今天 — Сегодня');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${lang} details overflow`);
  }
  await page.locator('#language-choice').selectOption('en');
  assert((await page.locator('#detail-lunar').textContent()).includes('Leap lunar month 6, day 1'));
  assert(/[āáǎàīíǐìūúǔùēéěèōóǒò]/u.test(await page.locator('#detail-day-pillar').textContent()));
  await page.locator('#save-note').click();await page.waitForFunction(()=>document.querySelector('#note-status').textContent==='Saved on this device.');
  await page.locator('#language-choice').selectOption('zh');
  assert.equal(await page.locator('#note-status').textContent(),'已保存到此设备。');
  assert.equal(await page.locator('#detail-lunar').textContent(),'农历闰六月初一');
  assert(/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/.test(await page.locator('#detail-day-pillar').textContent()));
  await page.reload();assert.equal(await page.locator('#language-choice').inputValue(),'zh');
  await page.waitForFunction(()=>!document.querySelector('#daily-note').disabled);
  assert.equal(await page.locator('#daily-note').inputValue(),'Calendar — 今天 — Сегодня');
  await page.locator('#account-email').fill('test@example.invalid');await page.locator('#account-password').fill('test-password');
  await page.locator('#language-choice').selectOption('ru');
  assert.equal(await page.locator('#account-password').inputValue(),'test-password');
  await page.locator('#language-choice').selectOption('zh');
  await page.locator('#account-form button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#sync-status').textContent==='已同步。');
  await page.locator('#daily-note').fill('Unchanged account draft');
  await page.locator('#language-choice').selectOption('ru');
  assert.equal(await page.locator('#account-label').textContent(),'Вы вошли как test@example.invalid');
  assert.equal(await page.locator('#sync-status').textContent(),'Синхронизировано.');
  assert.equal(await page.locator('#daily-note').inputValue(),'Unchanged account draft');assert.equal(signIns,1);
  assert.deepEqual(errors,[]);
  const denied = await browser.newContext({locale:'zh-CN',serviceWorkers:'block'});
  await denied.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('denied')};Storage.prototype.setItem=()=>{throw Error('denied')};});
  const p=await denied.newPage();await p.goto(process.env.TEST_URL || 'http://127.0.0.1:8769/');
  assert.equal(await p.locator('#language-choice').inputValue(),'zh');
  await p.locator('#language-choice').selectOption('ru');
  assert((await p.locator('#language-status').textContent()).includes('не смог сохранить'));
  assert.equal(await p.locator('#page-title').textContent(),'Календарь');
  console.log(`Passed (${engine}): language detection/persistence, all mobile layouts, leap month, GanZhi pronunciation, unchanged notes/drafts/date/account, translated status, storage-denied fallback.`);
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
