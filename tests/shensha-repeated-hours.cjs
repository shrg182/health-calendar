const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const context=await browser.newContext({serviceWorkers:'block'});
 await context.addInitScript(()=>localStorage.setItem('daymark.shensha.v1',JSON.stringify({yima:{enabled:true,targets:['午']},yangren:{enabled:true,targets:['巳']},kongwang:{enabled:true,targets:['子']}})));
 const page=await context.newPage();await page.goto('http://127.0.0.1:8769/#day=2026-10-22');
 const render=async pillars=>page.evaluate(pillars=>{
  const date=new Date(2026,9,22,12),group=pillar=>({pillar,start:date,end:date});
  DaymarkShensha.configure({contextForDate:()=>({year:group(pillars[0]),month:group(pillars[1]),day:group(pillars[2]),hours:[{pillar:'庚午',startMinute:0,endMinute:720},{pillar:'己巳',startMinute:720,endMinute:1440}]}),openDay:()=>{}});
  DaymarkShensha.show(date);
 },pillars);
 await render(['甲午','丙午','己巳']);
 const hours=page.locator('#shensha-matches [data-pillar-scope=hour-schedule]');
 assert.equal(await hours.locator('[data-shensha=yima]').count(),1);
 assert.equal(await hours.locator('[data-shensha=yangren]').count(),0);
 assert.equal(await page.locator('#shensha-inactive').isVisible(),false);
 await render(['甲午','丁巳','己巳']);
 assert.equal(await hours.locator('[data-shensha=yima]').count(),0);
 assert.equal(await hours.locator('[data-shensha=yangren]').count(),1);
 assert.match(await page.locator('#shensha-matches > [data-pillar-scope=hour]').innerText(),/Sheep Blade（羊刃）/);
 await render(['甲午','丁酉','己巳']);assert.equal(await hours.locator('.shensha-hour-list').count(),0);
 assert.equal(await page.locator('#shensha-matches > [data-pillar-scope=hour]').count(),0);
 await render(['甲子','丁酉','己巳']);assert(await page.locator('#shensha-inactive').isVisible());
 for(const lang of ['zh','ru','fr','en']){await page.locator('#language-choice').selectOption(lang);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 console.log('Passed: per-item two-pillar threshold, Horse and Sheep Blade hour indications, absent isolated hours, Void handling, translations.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
