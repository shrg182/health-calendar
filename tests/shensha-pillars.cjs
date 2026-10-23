const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const context=await browser.newContext({locale:'en-US',timezoneId:'America/Detroit',viewport:{width:390,height:844},serviceWorkers:'block'});
 await context.addInitScript(()=>localStorage.setItem('daymark.shensha.v1',JSON.stringify({
  tiande:{enabled:true,targets:['丙']},yuede:{enabled:true,targets:['戊']},tianyi:{enabled:true,targets:['巳']},
  shie:{enabled:true,targets:['戊戌']},custom1:{enabled:true,targets:Array.from({length:60},(_,i)=>'甲乙丙丁戊己庚辛壬癸'[i%10]+'子丑寅卯辰巳午未申酉戌亥'[i%12])},
  yuanchen:{enabled:true,targets:['巳']},kuigang:{enabled:true,targets:['庚辰']}
 })));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8769/#day=2026-10-22');
 const group=scope=>page.locator(`#shensha-matches > [data-pillar-scope=${scope}]`);
 assert.equal(await group('year').getAttribute('data-pillar'),'丙午');
 assert.equal(await group('month').getAttribute('data-pillar'),'戊戌');
 assert.equal(await group('day').getAttribute('data-pillar'),'己巳');
 assert.equal(await group('hour').getAttribute('data-pillar'),'庚午');
 assert(await group('year').locator('[data-shensha=tiande]').isVisible());assert(await group('month').locator('[data-shensha=shie]').isVisible());
 assert(await group('month').locator('[data-shensha=yuede]').isVisible());assert(await group('day').locator('[data-shensha=tianyi]').isVisible());
 assert.equal(await group('hour').locator('[data-shensha=custom1]').innerText(),'庚午');
 // HKO table 5: 甲/己 days start 甲子; branch slots use table 3.
 for(const [time,pillar] of [['00:00','甲子'],['01:00','乙丑'],['03:00','丙寅'],['09:00','己巳'],['12:00','庚午'],['13:00','辛未'],['21:00','乙亥'],['23:00','甲子']]){
  await page.locator('#shensha-time').fill(time);await page.locator('#shensha-time').dispatchEvent('change');assert.equal(await group('hour').getAttribute('data-pillar'),pillar);
 }
 await page.locator('#shensha-time').fill('12:00');await page.locator('#shensha-time').dispatchEvent('change');
 const ranges=await Promise.all(['year','month'].map(async scope=>[await group(scope).getAttribute('data-start'),await group(scope).getAttribute('data-end')]));
 await page.goto('http://127.0.0.1:8769/#day=2026-10-23');
 for(const [i,scope] of ['year','month'].entries())assert.deepEqual([await group(scope).getAttribute('data-start'),await group(scope).getAttribute('data-end')],ranges[i]);
 assert.equal(await group('hour').getAttribute('data-pillar'),'壬午');
 for(const [date,year,month] of [['2026-02-01','乙巳',null],['2026-02-10','丙午',null],['2026-10-01','丙午','丁酉'],['2026-11-15','丙午','己亥']]){
  await page.goto(`http://127.0.0.1:8769/#day=${date}`);assert.equal(await group('year').getAttribute('data-pillar'),year);if(month)assert.equal(await group('month').getAttribute('data-pillar'),month);
 }
 await page.goto('http://127.0.0.1:8769/#day=2026-10-22');
 await page.locator('[data-direction="1"][data-shensha-period="7"]').click();
 assert.equal(await page.locator('#shensha-period-results > [data-pillar-scope=year]').count(),1);
 assert.equal(await page.locator('#shensha-period-results > [data-pillar-scope=month]').count(),1);
 assert.equal(await page.locator('#shensha-period-results li[data-date]').count(),7);
 await page.locator('#open-settings').click();assert.equal(await page.locator('#shensha-yuanchen,#shensha-kuigang').count(),0);
 await page.locator('#shensha-kongwang').check();await page.locator('#shensha-picker-kongwang summary').click();await page.locator('#shensha-picker-kongwang input[value="子"]').check();
 await page.locator('#shensha-form button[type=submit]').click();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('daymark.shensha.v1')));assert.equal(saved.yuanchen,undefined);assert.equal(saved.kuigang,undefined);assert(saved.tiande.enabled);
 await page.goBack();
 // An isolated 子 hour no longer deactivates the date.
 assert(await page.locator('#shensha-inactive').isHidden());assert.equal(await group('year').locator('.inactive').count(),0);assert(await group('hour').locator('[data-shensha=custom1]:not(.inactive)').isVisible());
 assert(await page.locator('#shensha-matches [data-pillar-scope=hour-schedule] .shensha-hour-list').count());
 for(const lang of ['zh','ru','fr','en']){await page.locator('#language-choice').selectOption(lang);for(const width of [320,430,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}}
 await page.setViewportSize({width:390,height:844});await page.locator('#shensha-detail').screenshot({path:'/tmp/daymark-four-pillars.png'});
 assert.deepEqual(errors,[]);console.log('Passed: removed entries, four scope matching, HKO hour fixtures, solar year/month ranges, interval deduplication, legacy settings, whole-day Void policy, multilingual mobile layouts.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
