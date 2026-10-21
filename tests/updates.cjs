const {openSettings, closeSettings} = require('./ui.cjs');
const playwright = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
(async () => {
 const root = path.resolve(__dirname,'..');
 let nextRelease = false;
 const current = fs.readFileSync(path.join(root,'release.js'),'utf8');
 const originalVersion = current.match(/version: '([^']+)'/)[1];
 const newVersion = `${originalVersion}.test`;
 const server = http.createServer((req,res)=>{
  let name = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(name === '/') name = '/index.html';
  const file = path.resolve(root,'.'+name);
  if(!file.startsWith(root+path.sep)) {res.writeHead(403);res.end();return;}
  try {
   let body = fs.readFileSync(file);
   if(name === '/release.js' && nextRelease) body = Buffer.from(current.replace(originalVersion,newVersion));
   res.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':name.endsWith('.png')?'image/png':'application/json','Cache-Control':'no-store'});
   res.end(body);
  } catch {res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const engine=process.env.TEST_ENGINE || 'chromium';
 const browser = await playwright[engine].launch(engine==='chromium'?{channel:'chrome',headless:true}:{headless:true});
 try {
  const context = await browser.newContext({viewport:{width:320,height:800},locale:'en-US'});
  const page = await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const origin=`http://127.0.0.1:${server.address().port}`;
  await page.goto(origin);
  await openSettings(page);
  assert.equal(await page.locator('#app-version').textContent(),`v${originalVersion}`);
  assert(await page.locator('#release-new').isVisible());
  await page.locator('#whats-new').click();assert(await page.locator('#release-help').isVisible());
  assert.equal(await page.locator('#release-changes li').count(),await page.evaluate(()=>window.DAYMARK_RELEASE.changes.length));
  assert(await page.locator('#release-new').isHidden());
  await page.locator('#release-help button').click();
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await page.reload();assert(await page.locator('#release-new').isHidden());
  await page.locator('#language-choice').selectOption('zh');
  await page.locator('#whats-new').click();assert.equal(await page.locator('#release-title').textContent(),'更新内容');
  await page.locator('#release-help button').click();await page.locator('#language-choice').selectOption('ru');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if (process.env.SCREENSHOTS) {
   await page.screenshot({path:'/tmp/daymark-version-mobile.png',fullPage:true});
   await page.locator('#whats-new').click();
   await page.screenshot({path:'/tmp/daymark-release-dialog.png'});
   await page.locator('#release-help button').click();
  }
  await page.locator('#language-choice').selectOption('en');
  await closeSettings(page);
  await page.locator('#days .day:not(.outside)').first().click();
  await page.waitForFunction(()=>!document.querySelector('#daily-note').disabled);
  await page.locator('#daily-note').fill('Keep my draft during updates');
  const hash = new URL(page.url()).hash;
  // This second tab must not reload or lose its own draft when the first updates.
  const other=await context.newPage();await other.goto(page.url());
  await other.waitForFunction(()=>!document.querySelector('#daily-note').disabled);
  await other.locator('#daily-note').fill('Another tab draft');
  nextRelease = true;
  await openSettings(page);
  await page.locator('#check-updates').click();
  await page.locator('#update-notice').waitFor({state:'visible'});
  assert.equal(await page.locator('#calendar-update').evaluate(el=>el.hidden),false);
  await page.locator('#apply-update').click();
  assert((await page.locator('#update-status').textContent()).includes('Save your drafts'));
  assert.equal(await page.locator('#daily-note').inputValue(),'Keep my draft during updates');
  assert.equal(await page.locator('#app-version').textContent(),`v${originalVersion}`);
  await closeSettings(page);
  await page.locator('#save-note').click();
  await page.waitForFunction(()=>window.DaymarkNotes.canReload());
  await openSettings(page);
  await page.locator('#apply-update').click();
  await page.waitForFunction(v=>document.querySelector('#app-version').textContent===`v${v}`,newVersion);
  assert.equal(new URL(page.url()).hash,'#settings');
  await page.locator('#settings-back').click();
  await page.locator('#days .has-note').click();
  await page.waitForFunction(()=>!document.querySelector('#daily-note').disabled);
  assert.equal(await page.locator('#daily-note').inputValue(),'Keep my draft during updates');
  assert.equal(new URL(page.url()).hash,hash);
  await openSettings(page);
  assert(await page.locator('#release-new').isVisible());
  assert.equal(await other.locator('#daily-note').inputValue(),'Another tab draft');
  assert.equal(await other.locator('#app-version').textContent(),`v${originalVersion}`);
  await context.setOffline(true);await page.locator('#check-updates').click();
  await page.waitForFunction(()=>document.querySelector('#update-status').textContent.includes('Could not check'));
  assert.deepEqual(errors,[]);
  console.log(`Passed (${engine}): version and translated release notes, unread tracking, real waiting-worker update, draft guard, saved note/date preservation, other-tab protection, offline failure message.`);
 } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exit(1)});
