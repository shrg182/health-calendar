const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const c=await b.newContext({locale:'en-US',timezoneId:'America/Detroit',serviceWorkers:'block'});const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.clock.install({time:new Date('2026-10-24T12:00:00-04:00')});
 await p.goto('http://127.0.0.1:8769/#day=2026-10-26');
 assert.equal(await p.locator('#logo-day').innerText(),'24');assert.equal(await p.locator('#logo-month').innerText(),'Oct');assert.match(await p.locator('#calendar-home').getAttribute('aria-label'),/Today.*October 24/);
 for(const lang of ['zh','ja','ru','fr','en']){await p.locator('#language-choice').selectOption(lang);assert.equal(await p.locator('#logo-day').innerText(),'24');for(const width of [320,390,1440]){await p.setViewportSize({width,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}}
 await p.clock.setFixedTime(new Date('2026-10-25T00:01:00-04:00'));await p.evaluate(()=>window.dispatchEvent(new Event('focus')));assert.equal(await p.locator('#logo-day').innerText(),'25');
 await p.locator('#calendar-home').click();assert.equal(new URL(p.url()).hash,'#calendar');
 await p.setViewportSize({width:390,height:844});await p.locator('.topbar').screenshot({path:'/tmp/daymark-date-logo.png'});
 assert.deepEqual(errors,[]);console.log('Passed: today differs from selected date, translated month and accessible date, date rollover on focus, calendar-home action, and five-language mobile layout.');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
