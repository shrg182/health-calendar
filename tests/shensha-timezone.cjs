const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:8769/';
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const context=await browser.newContext({locale:'en-US',timezoneId:'America/Detroit',serviceWorkers:'block'});
 await context.addInitScript(()=>localStorage.setItem('daymark.shensha.v1',JSON.stringify({custom1:{enabled:true,targets:[...'甲乙丙丁戊己庚辛壬癸']}})));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'#day=2026-02-03');
 assert.equal(await page.locator('#shensha-time').count(),0);
 assert.equal(await page.locator('#settings-time').isVisible(),false);
 assert.match(await page.locator('#shensha-zone-summary').innerText(),/America\/Detroit/);
 async function save(zone){
  await page.goto(base+'#settings-time');
  await page.locator('#shensha-zone-source').selectOption('birthplace');
  await page.locator('#shensha-birthplace-zone').fill(zone);
  await page.locator('#shensha-timezone-form button').click();
 }
 await save('Invalid/City');
 assert.equal(await page.locator('#shensha-birthplace-zone').evaluate(el=>el.validity.valid),false);
 assert.equal(await page.evaluate(()=>DaymarkShensha.timeZone),'America/Detroit');
 await save('Pacific/Kiritimati');
 assert.equal(await page.evaluate(()=>DaymarkShensha.timeZone),'Pacific/Kiritimati');
 await page.reload();assert.equal(await page.locator('#shensha-zone-source').inputValue(),'birthplace');
 await page.goto(base+'#day=2026-02-03');
 await page.locator('#shensha-display').selectOption('cards');
 const east=await page.locator('.shensha-date-card .ganzhi').first().innerText();
 const calendar=await page.locator('#detail-month-pillar').innerText();
 assert((await page.locator('.shensha-hour-slot').count())>0);
 await save('Pacific/Honolulu');
 await page.goto(base+'#day=2026-02-03');
 const west=await page.locator('.shensha-date-card .ganzhi').first().innerText();
 assert.notEqual(east,west,'Solar-term civil date must follow the selected zone');
 assert.equal(await page.locator('#detail-month-pillar').innerText(),calendar,'Main calendar stays device-local');
 assert.match(await page.locator('#shensha-zone-summary').innerText(),/Pacific\/Honolulu/);
 await page.goto(base+'#settings-time');
 await page.locator('#shensha-zone-source').selectOption('device');
 await page.locator('#shensha-timezone-form button').click();
 assert.equal(await page.evaluate(()=>DaymarkShensha.timeZone),'America/Detroit');
 await page.goto(base+'#day=2026-10-22');
 for(const [start,pillar] of [['00:00','甲子'],['01:00','乙丑'],['09:00','己巳'],['11:00','庚午'],['23:00','甲子']]) {
  assert.equal(await page.locator(`.shensha-hour-slot[data-start="${start}"]`).getAttribute('data-pillar'),pillar);
 }
 await page.goto(base+'#settings-time');
 for(const lang of ['zh','ja','ru','fr','en']){
  await page.locator('#language-choice').selectOption(lang);
  await page.setViewportSize({width:320,height:900});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 await page.locator('#settings-time').screenshot({path:'/tmp/daymark-timezone-settings.png'});
 assert.deepEqual(errors,[]);
 console.log('Passed: Settings relocation, device/birthplace zones, invalid-zone rejection, persistence, zone-dependent solar boundary, hour slots, unchanged main calendar, five-language mobile layout.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
