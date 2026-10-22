const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const tokens=new Map(),revoked=new Set();let serial=0,refreshes=0,offline=false;
 function session(id){const token=`session-${++serial}`;tokens.set(token,id);return{access_token:token,refresh_token:token,expires_in:3600,user:{id,email:`${id}@test.com`}};}
 async function device(){const c=await browser.newContext({locale:'en-US',serviceWorkers:'block'});await c.route('**/sync-config.js',r=>r.fulfill({contentType:'text/javascript',body:"window.DAYMARK_SYNC={url:'https://cloud.test',publishableKey:'test'}"}));await c.route('https://cloud.test/**',async r=>{
  if(offline)return r.abort('failed');const u=new URL(r.request().url()),body=r.request().postDataJSON();let data={};
  if(u.pathname.endsWith('/token')){
   if(u.searchParams.get('grant_type')==='password')data=session(body.email.split('@')[0]);
   else{refreshes++;const id=tokens.get(body.refresh_token);if(!id||revoked.has(body.refresh_token))return r.fulfill({status:400,json:{msg:'Refresh token expired. Sign in again.'}});tokens.delete(body.refresh_token);data=session(id);}
  }else if(u.pathname.endsWith('/logout')){assert.equal(u.searchParams.get('scope'),'local');revoked.add(r.request().headers().authorization.split(' ')[1]);}
  else if(u.pathname.endsWith('/read_daily_notes'))data=[];
  await r.fulfill({json:data});});return c;}
 const a=await device(),b=await device();let p=await a.newPage(),q=await b.newPage();
 async function login(page){await page.goto('http://127.0.0.1:8769/#settings-account');await page.locator('#account-email').fill('alice@test.com');await page.locator('#account-password').fill('password123');await page.locator('#account-form button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#sync-status').textContent==='Synced.');}
 async function restored(page){await page.waitForFunction(()=>document.querySelector('#account-label').textContent==='Signed in as alice@test.com');await page.waitForFunction(()=>document.querySelector('#sync-status').textContent==='Synced.');}
 const key='daymark.auth.v1:https://cloud.test';
 await login(p);const first=await p.evaluate(k=>JSON.parse(localStorage.getItem(k)).refresh_token,key);
 await p.reload();await restored(p);assert(refreshes>0);const next=await p.evaluate(k=>JSON.parse(localStorage.getItem(k)).refresh_token,key);assert.notEqual(first,next);
 // Closing and reopening a tab restores the account without password entry.
 await p.close();p=await a.newPage();await p.goto('http://127.0.0.1:8769/#settings-account');await restored(p);
 await login(q);await q.reload();await restored(q);await p.reload();await restored(p);
 // A second tab cannot revoke or overwrite the first tab's persisted session.
 const before=await p.evaluate(k=>localStorage.getItem(k),key);const extra=await a.newPage();await extra.goto('http://127.0.0.1:8769/#settings-account');await extra.waitForFunction(()=>document.querySelector('#account-status').textContent.includes('another tab'));assert.equal(await p.evaluate(k=>localStorage.getItem(k),key),before);await extra.close();
 await p.locator('#sign-out').click();await p.waitForFunction(()=>document.querySelector('#account-form').hidden===false);assert.equal(await p.evaluate(k=>localStorage.getItem(k),key),null);
 await q.reload();await restored(q); // Signing out device A does not sign out B.
 offline=true;await q.reload();await q.waitForFunction(()=>document.querySelector('#account-form').hidden===false&&document.querySelector('#account-status').textContent.includes('fetch'));assert(await q.evaluate(k=>Boolean(localStorage.getItem(k)),key));
 offline=false;await q.evaluate(()=>window.dispatchEvent(new Event('online')));await restored(q);
 const token=await q.evaluate(k=>JSON.parse(localStorage.getItem(k)).refresh_token,key);revoked.add(token);await q.reload();await q.waitForFunction(()=>document.querySelector('#account-status').textContent.includes('expired'));assert.equal(await q.evaluate(k=>localStorage.getItem(k),key),null);
 console.log('Passed: reload/reopen restoration, rotated refresh persistence, two independent devices, local sign-out, same-browser lock isolation, offline retention, revoked-session cleanup.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
