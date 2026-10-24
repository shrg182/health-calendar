const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const context=await browser.newContext({locale:'en-US',serviceWorkers:'block'});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const previous of ['-1:30','1:10','custom','closed']){
  await page.goto('http://127.0.0.1:8769/#calendar');
  await page.locator('#jump-year').fill('2026');await page.locator('#jump-month').selectOption('9');await page.locator('#month-form button').click();
  if(previous==='custom'){
   await page.locator('#shensha-period').selectOption('custom');await page.locator('#shensha-start').fill('2026-09-01');await page.locator('#shensha-end').fill('2026-10-31');await page.locator('#shensha-range-form button[type=submit]').click();await page.locator('#shensha-page-next').click();
  }else if(previous==='closed')await page.locator('#shensha-close').click();
  else await page.locator('#shensha-period').selectOption(previous);
  await page.locator('#days [data-date="2026-10-26"]').click();
  assert.equal(new URL(page.url()).hash,'#day=2026-10-26');
  assert.equal(await page.locator('#shensha-period').inputValue(),'day');
  assert(await page.locator('#shensha-custom-range').isHidden());
  assert(await page.locator('#shensha-result-pages').isHidden());
  const rows=page.locator('#shensha-period-results li[data-date]');assert.equal(await rows.count(),1);assert.equal(await rows.first().getAttribute('data-date'),'2026-10-26');
 }
 // Later view/language changes must preserve a newly chosen range.
 await page.locator('#shensha-period').selectOption('1:3');await page.locator('#shensha-display').selectOption('cards');await page.locator('#language-choice').selectOption('ja');
 assert.equal(await page.locator('#shensha-period').inputValue(),'1:3');assert.equal(await page.locator('#shensha-period-results li[data-date]').count(),3);
 assert.deepEqual(errors,[]);console.log('Passed: main-calendar selection resets preset, paginated custom, and closed results to the clicked day; later display and language changes retain the chosen period.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
