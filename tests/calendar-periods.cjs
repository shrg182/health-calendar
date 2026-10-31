const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
const http=require('node:http'), fs=require('node:fs'),path=require('node:path');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname; const file=path.join(root,name==='/'?'index.html':name);try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({locale:'en-US',timezoneId:'America/Detroit',serviceWorkers:'block'});
 const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.clock.install({time:new Date('2026-10-30T12:00:00-04:00')});
 await p.goto(`http://127.0.0.1:${server.address().port}`);
 const choose=period=>p.locator(`[data-period="${period}"]`).click();
 const jump=async(year,month)=>{await p.locator('#jump-year').fill(String(year));await p.locator('#jump-month').selectOption(String(month));await p.locator('#month-form button').click();};
 const dates=()=>p.locator('#days .day').evaluateAll(els=>els.map(e=>e.dataset.date));
 assert.equal(await p.locator('#days .day').count(),42);
 await choose('week');assert.deepEqual(await dates(),['2026-10-25','2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-10-31']);
 await p.locator('#next').click();assert.equal((await dates())[0],'2026-11-01');
 await p.locator('#next').click();assert.equal((await dates())[0],'2026-11-08'); // DST transition
 await p.locator('#today').click();assert.equal((await dates())[0],'2026-10-25');
 await choose('year');assert.equal(await p.locator('.mini-month').count(),12);assert.equal(await p.locator('.mini-day').count(),365);
 await jump(2028,1);assert.equal(await p.locator('.mini-day').count(),366);
 await p.locator('[data-date="2028-02-29"]').click();assert.equal(new URL(p.url()).hash,'#day=2028-02-29');
 await p.locator('#calendar-home').click();assert.equal(await p.locator('[data-period="year"]').getAttribute('aria-pressed'),'true');
 await p.locator('.mini-month-title').nth(1).click();assert.equal(await p.locator('[data-period="month"]').getAttribute('aria-pressed'),'true');assert.match(await p.locator('#month-title').innerText(),/February 2028/);
 await jump(1901,0);assert(await p.locator('#prev').isDisabled());
 await choose('week');assert(await p.locator('#prev').isDisabled());assert(await p.locator('[data-date="1900-12-30"]').isDisabled());
 await p.locator('#next').click();assert.equal((await dates())[0],'1901-01-06');await p.locator('#prev').click();assert.equal((await dates())[0],'1900-12-30');
 await choose('year');await jump(2100,11);assert(await p.locator('#next').isDisabled());
 await choose('month');assert(await p.locator('#next').isDisabled());await choose('week');assert(await p.locator('#next').isDisabled()===false); // Dec 1 can advance
 await p.locator('#today').click();await choose('year');await p.reload();assert.equal(await p.locator('[data-period="year"]').getAttribute('aria-pressed'),'true');
 for(const lang of ['en','zh','ja','ru','fr']){await p.locator('#language-choice').selectOption(lang);for(const width of [320,390,1440]){await p.setViewportSize({width,height:900});for(const period of ['year','month','week']){await choose(period);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${lang} ${width} ${period}`);}}}
 await p.evaluate(()=>localStorage.setItem('daymark.shensha.v1',JSON.stringify({tiande:{enabled:true,targets:[...'甲乙丙丁戊己庚辛壬癸']},yuede:{enabled:true,targets:[...'甲乙丙丁戊己庚辛壬癸']},yangren:{enabled:true,targets:[...'子丑寅卯辰巳午未申酉戌亥']},kongwang:{enabled:true,targets:[...'子丑寅卯辰巳午未申酉戌亥']}})));
 await p.reload();await choose('week');
 assert.equal(await p.locator('#days .week-shensha').count(),7);
 for(const cell of await p.locator('#days .day').all()) {
   assert.equal(await cell.locator('.week-shensha .shensha-badge').count(),4);
   assert.equal(await cell.locator('.week-shensha .kongwang').count(),1);
   assert.match(await cell.locator('.week-shensha').innerText(),/\+\+\+/);
 }
 assert(await p.locator('#shensha-period-panel').isHidden());
 await p.locator('#open-settings').click();await p.locator('#shensha-tiande').uncheck();await p.locator('#shensha-form button[type=submit]').click();await p.locator('#calendar-home').click();
 assert.equal(await p.locator('#days .week-shensha .shensha-badge').count(),21);
 for(const lang of ['en','zh','ja','ru','fr']) {await p.locator('#language-choice').selectOption(lang);await p.setViewportSize({width:320,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await p.locator('#days .week-shensha .shensha-badge').count(),21);}
 await choose('month');assert.equal(await p.locator('#days .week-shensha').count(),0);assert(await p.locator('#shensha-period-panel').isVisible());
 await p.locator('#language-choice').selectOption('en');await choose('week');
 assert.equal(await p.locator('.week-note-preview').count(),0);
 await p.locator('#days [data-date="2026-10-30"]').click();
 const note='First line\nSecond line <b>plain text</b>\nThird line\nFourth line should be clipped\nFifth line';
 await p.locator('#daily-note').fill(note);await p.locator('#save-note').click();await p.waitForFunction(()=>window.DaymarkNotes.savedText('2026-10-30').includes('Fifth line'));
 await p.locator('#calendar-home').click();
 const preview=p.locator('#days [data-date="2026-10-30"] .week-note-preview');
 assert.equal(await preview.textContent(),note);assert.equal(await preview.locator('b').count(),0);
 assert.equal(await preview.evaluate(el=>getComputedStyle(el).whiteSpace),'pre-wrap');
 assert(await preview.evaluate(el=>el.scrollHeight>el.clientHeight && el.clientHeight<=Math.ceil(parseFloat(getComputedStyle(el).lineHeight)*3)));
 assert.equal(await p.locator('.week-note-preview').count(),1);
 await p.reload();assert.equal(await preview.textContent(),note);
 await p.locator('#days [data-date="2026-10-30"]').click();assert.equal(await p.locator('#daily-note').inputValue(),note);
 await p.locator('#daily-note').fill('Unsaved draft');await p.locator('#calendar-home').click();assert.equal(await preview.textContent(),note);
 await p.locator('#days [data-date="2026-10-30"]').click();await p.locator('#daily-note').fill('Updated saved note');await p.locator('#save-note').click();await p.waitForFunction(()=>window.DaymarkNotes.savedText('2026-10-30')==='Updated saved note');
 await p.locator('#calendar-home').click();assert.equal(await preview.textContent(),'Updated saved note');
 await p.locator('#days [data-date="2026-10-30"]').click();p.once('dialog',d=>d.accept());await p.locator('#delete-note').click();await p.waitForFunction(()=>!window.DaymarkNotes.dates.has('2026-10-30'));await p.locator('#calendar-home').click();assert.equal(await p.locator('.week-note-preview').count(),0);
 await p.locator('#language-choice').selectOption('en');await p.setViewportSize({width:1440,height:1000});await choose('year');await p.screenshot({path:'/tmp/daymark-year-view.png'});
 await p.setViewportSize({width:390,height:844});await choose('week');await p.screenshot({path:'/tmp/daymark-week-view.png'});
 assert.deepEqual(errors,[]);console.log('Passed: year/month/week navigation, leap year, DST, limits, date details, persistence, and five-language responsive layouts.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exit(1)});
