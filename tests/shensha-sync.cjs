const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const metadata=new Map();let offlineA=false, delayReadA=false, releaseRead=null;
 async function device(name){const context=await browser.newContext({locale:'en-US',serviceWorkers:'block'});
 await context.route('**/sync-config.js',r=>r.fulfill({contentType:'text/javascript',body:"window.DAYMARK_SYNC={url:'https://cloud.test',publishableKey:'test'}"}));
 await context.route('https://cloud.test/**',async r=>{
  if(name==='A'&&offlineA)return r.abort('failed');
  const req=r.request(),url=new URL(req.url()),body=req.postDataJSON();let data={};
  if(url.pathname.endsWith('/token')){const id=body.email?body.email.split('@')[0]:body.refresh_token;data={access_token:id,refresh_token:id,expires_in:3600,user:{id,email:`${id}@test.com`}};}
  else {const id=req.headers().authorization?.split(' ')[1];
   if(url.pathname.endsWith('/user')){
    if(req.method()==='PUT'){
     assert.deepEqual(Object.keys(body),['data']);assert.deepEqual(Object.keys(body.data),['daymark_shensha']);
     metadata.set(id,{...(metadata.get(id)||{other:'preserve-me'}),...body.data});
    }
    data={id,user_metadata:metadata.get(id)||{other:'preserve-me'}};
   } else if(url.pathname.endsWith('/read_daily_notes'))data=[];
  }
  if(name==='A' && req.method()==='GET' && delayReadA) {
   delayReadA=false;const snapshot=JSON.parse(JSON.stringify(data));
   await new Promise(resolve=>{releaseRead=resolve;});return r.fulfill({json:snapshot});
  }
  await r.fulfill({json:data});
 });return {context,page:await context.newPage()};}
 const {page:a,context:ctxA}=await device('A'),{page:b}=await device('B');
 await a.goto('http://127.0.0.1:8769/');await a.evaluate(()=>localStorage.setItem('daymark.shensha.v1',JSON.stringify({tiande:{enabled:true,targets:['甲']},custom1:{enabled:true,targets:['庚辰']}})));await a.reload();
 async function settings(page){if(await page.locator('#settings-page').isHidden())await page.locator('#open-settings').click();}
 async function synced(page){await page.waitForFunction(()=>document.querySelector('#sync-status').textContent==='Synced.');}
 async function login(page,id){await settings(page);await page.locator('#account-email').fill(`${id}@test.com`);await page.locator('#account-password').fill('password123');await page.locator('#account-form button[type=submit]').click();await synced(page);}
 async function sync(page){await settings(page);await page.locator('#sync-now').click();await synced(page);}
 async function save(page){await page.locator('#shensha-form button[type=submit]').click();await synced(page);await page.waitForFunction(()=>document.querySelector('#shensha-status').textContent==='Shensha selections synced.');}
 async function choose(page,id,values){await page.locator(`#shensha-${id}`).check();const picker=page.locator(`#shensha-picker-${id}`);if(!(await picker.evaluate(el=>el.open)))await picker.locator('summary').click();for(const check of await picker.locator('input[type=checkbox]:checked').all())await check.uncheck();for(const value of values)await picker.locator(`input[value="${value}"]`).check();}
 await login(a,'alice');assert(await a.locator('#shensha-use-local').isVisible());assert.equal(await a.locator('#shensha-tiande').isChecked(),false);assert.equal(metadata.has('alice'),false);
 await a.locator('#shensha-use-local').click();await synced(a);await a.waitForFunction(()=>document.querySelector('#shensha-status').textContent==='Shensha selections synced.');
 assert.equal(metadata.get('alice').other,'preserve-me');assert.deepEqual(metadata.get('alice').daymark_shensha.settings.tiande.targets,[0]);
 await b.goto('http://127.0.0.1:8769/');await login(b,'alice');assert(await b.locator('#shensha-tiande').isChecked());assert(await b.locator('#shensha-picker-custom1 input[value="庚辰"]').isChecked());
 await choose(b,'tiande',['乙']);await save(b);await sync(a);assert(await a.locator('#shensha-picker-tiande input[value="乙"]').isChecked());
 // Background pulls preserve unsaved picker edits.
 await choose(a,'tiande',['丙']);await choose(b,'tiande',['丁']);await save(b);await sync(a);
 assert(await a.locator('#shensha-picker-tiande input[value="丙"]').isChecked());assert.equal(await a.evaluate(()=>window.DaymarkNotes.canReload()),false);
 await save(a);await sync(b);assert(await b.locator('#shensha-picker-tiande input[value="丙"]').isChecked());
 // A save arriving during a background read must upload after that read completes.
 delayReadA=true;await a.locator('#sync-now').click();
 while(!releaseRead)await new Promise(resolve=>setTimeout(resolve,10));
 await choose(a,'tiande',['庚']);await a.locator('#shensha-form button[type=submit]').click();releaseRead();
 await a.waitForFunction(()=>document.querySelector('#shensha-status').textContent==='Shensha selections synced.');
 assert.deepEqual(metadata.get('alice').daymark_shensha.settings.tiande.targets,[6]);
 // Invalid future cloud data must not clear the current selections.
 const valid=JSON.parse(JSON.stringify(metadata.get('alice')));
 metadata.set('alice',{daymark_shensha:{version:999,settings:{}}});
 await a.locator('#sync-now').click();await a.waitForFunction(()=>document.querySelector('#sync-status').textContent.startsWith('Sync failed'));
 assert(await a.locator('#shensha-picker-tiande input[value="庚"]').isChecked());metadata.set('alice',valid);await sync(a);
 // Persist an offline save through reload and automatically retry when online.
 offlineA=true;await choose(a,'tiande',['戊']);await a.locator('#shensha-form button[type=submit]').click();await a.waitForFunction(()=>document.querySelector('#sync-status').textContent.startsWith('Sync failed'));
 assert.equal(await a.evaluate(()=>window.DaymarkNotes.canReload()),false);
 a.once('dialog',dialog=>dialog.dismiss());await a.locator('#sign-out').click();assert(await a.locator('#sign-out').isVisible());
 await a.reload();await a.waitForFunction(()=>document.querySelector('#account-form').hidden===false);assert(await a.evaluate(()=>JSON.parse(localStorage.getItem('daymark.shensha.account.v1:alice')).pending));
 offlineA=false;await a.evaluate(()=>window.dispatchEvent(new Event('online')));await synced(a);assert(await a.locator('#shensha-picker-tiande input[value="戊"]').isChecked());await sync(b);assert(await b.locator('#shensha-picker-tiande input[value="戊"]').isChecked());
 // Sign-out restores local selections; a second account never inherits Alice's targets.
 await a.locator('#sign-out').click();await a.waitForFunction(()=>document.querySelector('#account-form').hidden===false);assert(await a.locator('#shensha-picker-tiande input[value="甲"]').isChecked());
 await login(a,'bob');assert.equal(await a.locator('#shensha-tiande').isChecked(),false);assert.equal(metadata.has('bob'),false);
 await choose(a,'kongwang',['子']);await save(a);assert.equal(metadata.get('bob').daymark_shensha.settings.kongwang.enabled,true);assert.deepEqual(metadata.get('alice').daymark_shensha.settings.tiande.targets,[4]);
 console.log('Passed: explicit local migration, two-device settings sync, custom targets, account separation, offline persistence/retry, dirty-edit protection, pending sign-out guard, unrelated metadata preservation.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
