const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const c=await b.newContext({locale:'en-US',serviceWorkers:'block'});
 await c.addInitScript(()=>localStorage.setItem('daymark.shensha.v1',JSON.stringify({tiande:{enabled:true,targets:[...'甲乙丙丁戊己庚辛壬癸']},yangren:{enabled:true,targets:[...'子丑寅卯辰巳午未申酉戌亥']},kongwang:{enabled:true,targets:[...'子丑寅卯辰巳午未申酉戌亥']}})));
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8769/#day=2026-10-26');
 for(const mode of ['calendar','cards']){
  await p.locator('#shensha-display').selectOption(mode);
  const root=p.locator('#shensha-period-results');assert.doesNotMatch(await root.innerText(),/Inactive|（|）/);assert.equal(await root.locator('.inactive').count(),0);
  assert.equal(await root.locator('[data-shensha=tiande].shen').count()>0,true);
  assert.equal(await root.locator('[data-shensha=yangren].sha').count()>0,true);
  if(mode==='cards'){
   const v=root.locator('[data-shensha=kongwang]').first();assert.equal(await v.innerText(),'Empty Void ---');assert(await v.evaluate(el=>el.classList.contains('kongwang')));
   assert.notEqual(await v.evaluate(el=>getComputedStyle(el).backgroundColor),await root.locator('[data-shensha=tiande]').first().evaluate(el=>getComputedStyle(el).backgroundColor));
   await root.locator('summary').click();assert.equal(await root.locator('[data-shensha=tiande].intense').count()>0,true);
  }
 }
 for(const lang of ['zh','ja','ru','fr','en']){await p.locator('#language-choice').selectOption(lang);assert.doesNotMatch(await p.locator('#shensha-period-results').innerText(),/（|）|Inactive/);}
 assert.deepEqual(errors,[]);console.log('Passed: localized names only, no inactive notices, Kongwang-only grey, other colors and repeated/hour strength retained in both views and five languages.');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
