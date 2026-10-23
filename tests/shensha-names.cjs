const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const context=await browser.newContext({locale:'en-US',serviceWorkers:'block',viewport:{width:375,height:844}});
 const labels={tiande:'天德',yuede:'月德',tianyi:'天乙',wenchang:'文昌',lushen:'禄神',yima:'驿马',huagai:'华盖',jiangxing:'将星',jinyu:'金舆','tianyi-medical':'天医',taohua:'桃花',yangren:'羊刃',jiesha:'劫煞',zaisha:'灾煞',yuanchen:'元辰',kongwang:'空亡',kuigang:'魁罡',shie:'十恶大败',yinyang:'阴阳差错',tianluodiwang:'天罗地网'};
 const settings=Object.fromEntries(Object.keys(labels).map(id=>[id,{enabled:id!=='kongwang',targets:['shie','yinyang','kuigang'].includes(id)?['癸亥']:['亥']}]));
 settings.custom1={enabled:true,targets:['癸亥']};
 await context.addInitScript(data=>localStorage.setItem('daymark.shensha.v1',JSON.stringify(data)),settings);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8769/#day=2026-10-16');
 const original=await page.evaluate(()=>localStorage.getItem('daymark.shensha.v1'));
 const expected={en:'Relay Horse（驿马）',zh:'驿马',ru:'Почтовая лошадь（驿马）',fr:'Cheval de relais（驿马）'};
 for(const lang of ['en','zh','ru','fr']){
  await page.locator('#language-choice').selectOption(lang);
  assert.equal(await page.locator('#shensha-matches [data-shensha=yima]').innerText(),'+ '+expected[lang]);
  assert((await page.locator('#shensha-matches [data-shensha=yangren]').innerText()).startsWith('− '));
  assert.equal(await page.locator('#shensha-matches [data-shensha=custom1]').innerText(),'癸亥');
  for(const badge of await page.locator('#shensha-matches .shensha-badge:not(.important)').all())assert(!/Shen · positive|Sha · negative|神 · 正向|煞 · 负向/.test(await badge.innerText()));
  await page.locator('[data-direction="1"][data-shensha-period="month"]').click();
  assert((await page.locator('#shensha-period-results [data-shensha=yima]').first().innerText()).includes(expected[lang]));
  await page.locator('[data-direction="1"][data-shensha-period="month"]').click();
  await page.locator('#open-settings').click();
  for(const [id,chinese] of Object.entries(labels)){
   const name=await page.locator(`#shensha-${id}`).locator('..').locator('span').innerText();
   assert(lang==='zh'?name===chinese:name.endsWith(`（${chinese}）`)&&name!==chinese);
  }
  assert.equal(await page.locator('#shensha-yima').locator('..').locator('span').innerText(),expected[lang]);
  for(const width of [320,375,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  await page.goBack();
  assert.equal(await page.evaluate(()=>localStorage.getItem('daymark.shensha.v1')),original);
 }
 await page.locator('#open-settings').click();await page.locator('#shensha-kongwang').check();await page.locator('#shensha-form button[type=submit]').click();await page.goBack();
 assert.equal(await page.locator('#shensha-matches .inactive').count(),21);
 assert((await page.locator('#shensha-matches [data-shensha=yima]').innerText()).startsWith('+ Cheval de relais（驿马）'));
 assert((await page.locator('#shensha-matches [data-shensha=kongwang]').innerText()).startsWith('− Vide（空亡）'));
 await page.locator('#language-choice').selectOption('en');await page.setViewportSize({width:375,height:844});
 await page.locator('#shensha-detail').screenshot({path:'/tmp/daymark-localized-shensha.png'});
 assert.deepEqual(errors,[]);
 console.log('Passed: 20 localized names in four languages, Chinese references, +/- day and period badges, unnamed custom values, inactive labels, selection preservation, phone/desktop fit.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
