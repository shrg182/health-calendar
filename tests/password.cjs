const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const context=await browser.newContext({locale:'en-US',viewport:{width:390,height:844},serviceWorkers:'block'});
 let stored='password123',updates=0,fail=false;
 await context.route('https://*.supabase.co/**',async route=>{
  const path=new URL(route.request().url()).pathname,body=route.request().postDataJSON();let data={};
  if(path.endsWith('/token')){if(body.password!==stored)return route.fulfill({status:400,json:{msg:'Invalid login credentials'}});data={access_token:'mock',refresh_token:'mock',expires_in:3600,user:{id:'password-test',email:body.email}};}
  else if(path.endsWith('/read_daily_notes'))data=[];
  else if(path.endsWith('/user')){assert.equal(route.request().method(),'PUT');assert.equal(route.request().headers().authorization,'Bearer mock');assert.equal(body.current_password,stored);if(fail)return route.fulfill({status:422,json:{msg:'Password policy rejected'}});stored=body.password;updates++;}
  await route.fulfill({json:data});
 });
 const page=await context.newPage();await page.goto('http://127.0.0.1:8769/#settings-account');assert(await page.locator('#password-form').isHidden());
 await page.locator('#account-email').fill('test@example.com');await page.locator('#account-password').fill(stored);await page.locator('#account-form button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#sync-status').textContent==='Synced.');assert(await page.locator('#password-form').isVisible());
 await page.evaluate(()=>location.hash='day=2026-10-25');await page.waitForFunction(()=>!document.querySelector('#daily-note').disabled);await page.locator('#daily-note').fill('Keep my draft');await page.locator('#open-settings').click();
 async function change(current,next,confirm=next){await page.locator('#current-password').fill(current);await page.locator('#new-password').fill(next);await page.locator('#confirm-password').fill(confirm);await page.locator('#change-password').click();}
 await change(stored,'newPassword123','different123');assert.match(await page.locator('#password-status').innerText(),/do not match/);assert.equal(updates,0);
 await change('wrongPassword','newPassword123');await page.waitForFunction(()=>document.querySelector('#password-status').textContent.includes('Could not'));assert.equal(updates,0);assert.equal(await page.locator('#current-password').inputValue(),'');
 fail=true;await change(stored,'newPassword123');await page.waitForFunction(()=>document.querySelector('#password-status').textContent.includes('policy rejected'));assert.equal(updates,0);
 fail=false;await change(stored,'newPassword123');await page.waitForFunction(()=>document.querySelector('#password-status').textContent.startsWith('Password changed.'));assert.equal(updates,1);assert.equal(await page.locator('#new-password').inputValue(),'');
 for(const lang of ['zh','ru','fr','en']){await page.locator('#language-choice').selectOption(lang);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 await page.goBack();assert.equal(await page.locator('#daily-note').inputValue(),'Keep my draft');
 console.log('Passed: signed-in password setting, mismatch/wrong-current/server failures, authenticated PUT, field clearing, draft preservation, translated phone layout.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
