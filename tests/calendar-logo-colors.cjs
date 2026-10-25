const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const targets=[...'子丑寅卯辰巳午未申酉戌亥'];
 for(const [settings,kind,name] of [[{},'none',null],[{tiande:{enabled:true,targets:[...'甲乙丙丁戊己庚辛壬癸']}},'shen','Heavenly Virtue'],[{yangren:{enabled:true,targets}},'sha','Sheep Blade'],[{kongwang:{enabled:true,targets}},'kongwang','Empty Void'],[{yangren:{enabled:true,targets},kongwang:{enabled:true,targets}},'sha','Sheep Blade']]){
  const c=await b.newContext({locale:'en-US',timezoneId:'America/Detroit',serviceWorkers:'block'});
  await c.addInitScript(s=>localStorage.setItem('daymark.shensha.v1',JSON.stringify(s)),settings);
  const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.install({time:new Date('2026-10-24T12:00:00-04:00')});
  await p.goto('http://127.0.0.1:8769/#day=2026-10-26');assert.equal(await p.locator('#logo-day').innerText(),'24');assert.equal(await p.locator('#calendar-home').getAttribute('data-shensha'),kind);
  const expected={none:'rgb(255, 255, 255)',shen:'rgb(35, 96, 67)',sha:'rgb(161, 38, 38)',kongwang:'rgb(96, 104, 98)'};
  assert.equal(await p.locator('#logo-month').evaluate(el=>getComputedStyle(el).backgroundColor),expected[kind]);
  if(kind==='none')assert.equal(await p.locator('.calendar-date-logo').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
  if(name)assert((await p.locator('#calendar-home').getAttribute('title')).includes(name));
  if(kind==='sha'){
   await p.locator('#open-settings').click();await p.locator('#shensha-yangren').uncheck();if(settings.kongwang)await p.locator('#shensha-kongwang').uncheck();await p.locator('#shensha-form button[type=submit]').click();
   assert.equal(await p.locator('#calendar-home').getAttribute('data-shensha'),'none');
  }
  assert.deepEqual(errors,[]);await c.close();
 }
 console.log('Passed: leading-item order, Shen green/Sha red/Kongwang grey, no-match default, today independent of selected day, tooltip names, and immediate saved-settings refresh.');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
