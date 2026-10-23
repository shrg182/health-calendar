const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  for(const configured of [false,true]){
   const context=await browser.newContext({serviceWorkers:configured?'allow':'block'});
   if(configured)await context.addInitScript(()=>localStorage.setItem('daymark.shensha.v1',JSON.stringify({tiande:{enabled:true,targets:[...'甲乙丙丁戊己庚辛壬癸']}})));
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   // Simulate an incompatible old response retained under an unversioned URL.
   await page.route('**/*.js',route=>route.fulfill({contentType:'text/javascript',body:'throw new Error("Stale unversioned asset loaded")'}));
   await page.goto('http://127.0.0.1:8769/#calendar');
   await page.locator('#shensha-period').selectOption('-1:10');
   assert(await page.locator('#shensha-close').isVisible());
   if(configured){
    assert.equal(await page.locator('.shensha-encounter-cell').count(),10);
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await context.setOffline(true);
    await page.reload();
    await page.locator('#shensha-period').selectOption('-1:10');
    assert.equal(await page.locator('.shensha-encounter-cell').count(),10);
   }else assert.match(await page.locator('#shensha-period-status').innerText(),/Select Shensha targets/);
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('Passed: versioned scripts bypass stale URLs; selected periods show configured results or setup guidance; offline results work.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
