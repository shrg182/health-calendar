const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({channel:'chrome', headless:true});
 const rows = new Map(); let unavailable = false;
 const errors = [];
 async function device() {
  const context = await browser.newContext({viewport:{width:390,height:844}, serviceWorkers:'block'});
  await context.route('**/sync-config.js', route => route.fulfill({contentType:'text/javascript', body:"window.DAYMARK_SYNC={url:'https://cloud.test',publishableKey:'public-test'}"}));
  await context.route('https://cloud.test/**', async route => {
   if (unavailable) return route.abort('failed');
   const request = route.request(), path = new URL(request.url()).pathname;
   const body = request.postDataJSON();
   let data = {};
   if (path.endsWith('/token')) {
    const id = body.email.split('@')[0];
    data = {access_token:id, refresh_token:id, expires_in:3600, user:{id,email:body.email}};
   } else if (!path.endsWith('/logout')) {
    const id = request.headers().authorization.split(' ')[1];
    if (!rows.has(id)) rows.set(id, new Map());
    const store = rows.get(id);
    if (path.endsWith('/read_daily_notes')) data = [...store.values()];
    else if (path.endsWith('/sync_daily_note')) {
     const old = store.get(body.p_date);
     if ((old?.revision || 0) !== body.p_revision) data = {conflict:true,note:old};
     else {
      const note = {date:body.p_date,text:body.p_text,deleted:body.p_deleted,revision:(old?.revision || 0)+1,created_at:old?.created_at || new Date().toISOString(),updated_at:new Date().toISOString()};
      store.set(note.date,note); data = {conflict:false,note};
     }
    } else throw Error(path);
   }
   await route.fulfill({json:data});
  });
  const page = await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8769/');
  await page.locator('#days .day:not(.outside)').first().click();
  await page.waitForFunction(()=>!document.querySelector('#daily-note').disabled);
  return {context,page};
 }
 const synced = p => p.waitForFunction(()=>document.querySelector('#sync-status').textContent==='Synced.');
 async function login(p,id) {
  await p.locator('#account-email').fill(`${id}@test.com`);
  await p.locator('#account-password').fill('password123');
  await p.locator('#account-form button[type=submit]').click(); await synced(p);
 }
 async function save(p,text) {
  await p.waitForFunction(()=>!document.querySelector('#save-note').disabled);
  await p.locator('#daily-note').fill(text); await p.locator('#save-note').click();
 }
 try {
  const {page:a,context:ctx} = await device();
  await save(a,'Legacy local note');
  await login(a,'alice'); assert.equal(await a.locator('#daily-note').inputValue(),'');
  await save(a,'Alice private'); await synced(a);
  const {page:b} = await device(); await login(b,'alice');
  assert.equal(await b.locator('#daily-note').inputValue(),'Alice private');
  // A second tab in the same browser must not race the account cache.
  const tab = await ctx.newPage(); await tab.goto(a.url());
  await tab.locator('#account-email').fill('alice@test.com'); await tab.locator('#account-password').fill('password123');
  await tab.locator('#account-form button[type=submit]').click();
  await tab.waitForFunction(()=>document.querySelector('#sync-status').textContent.includes('another tab')); await tab.close();
  await a.locator('#sign-out').click();
  await a.waitForFunction(()=>document.querySelector('#account-label').textContent.startsWith('Local notes'));
  assert.equal(await a.locator('#daily-note').inputValue(),'Legacy local note');
  const cached = await a.evaluate(async()=>new Promise((resolve,reject)=>{const r=indexedDB.open('daymark-account-alice');r.onsuccess=()=>{const db=r.result;const q=db.transaction('notes').objectStore('notes').getAll();q.onsuccess=()=>{resolve(q.result);db.close()};q.onerror=reject}}));
  assert.equal(cached.length,0);
  await login(a,'bob'); assert.equal(await a.locator('#daily-note').inputValue(),'');
  await save(a,'Bob private'); await synced(a);
  assert.equal(rows.get('alice').values().next().value.text,'Alice private');
  await a.locator('#sign-out').click(); await a.locator('#account-form').waitFor({state:'visible'});
  await login(a,'alice');
  unavailable = true;
  await save(a,'Offline Alice');
  await a.waitForFunction(()=>document.querySelector('#sync-status').textContent.startsWith('Sync failed'));
  assert.equal(await a.locator('#daily-note').inputValue(),'Offline Alice');
  unavailable = false;
  await save(b,'Other device Alice'); await synced(b);
  await a.locator('#sync-now').click(); await a.locator('#sync-conflict').waitFor({state:'visible'});
  assert.equal(await a.locator('#conflict-local').textContent(),'Offline Alice');
  assert.equal(await a.locator('#conflict-cloud').textContent(),'Other device Alice');
  await a.locator('#keep-local').click(); await synced(a);
  await b.locator('#sync-now').click(); await synced(b);
  assert.equal(await b.locator('#daily-note').inputValue(),'Offline Alice');
  // A background pull must not advance the base revision of an unsaved draft.
  await a.locator('#daily-note').fill('Unsaved draft');
  await save(b,'New remote version'); await synced(b);
  await a.locator('#sync-now').click(); await synced(a);
  assert.equal(await a.locator('#daily-note').inputValue(),'Unsaved draft');
  await a.locator('#save-note').click();
  await a.locator('#sync-conflict').waitFor({state:'visible'});
  await a.locator('#keep-cloud').click(); await synced(a);
  assert.equal(await a.locator('#daily-note').inputValue(),'New remote version');
  a.once('dialog',d=>d.accept()); await a.locator('#delete-note').click(); await synced(a);
  await b.locator('#sync-now').click(); await synced(b);
  assert.equal(await b.locator('#daily-note').inputValue(),'');
  assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
  console.log('Passed: account isolation, explicit legacy separation, cross-device sync, cache removal, tab locking, offline queue, conflict preservation/resolution, deletion propagation, mobile fit.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
