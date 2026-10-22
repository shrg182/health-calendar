const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const context=await browser.newContext({locale:'en-US',serviceWorkers:'block',viewport:{width:375,height:844}});
 const page=await context.newPage();await page.goto('http://127.0.0.1:8769/#settings-shensha');
 for(const id of ['tiande','yuede']){
  const picker=page.locator(`#shensha-picker-${id}`);
  assert.equal(await picker.locator('input[type=checkbox]').count(),22);
  assert.equal(await picker.locator('input[value="甲"]').count(),1);assert.equal(await picker.locator('input[value="子"]').count(),1);assert.equal(await picker.locator('input[value="甲子"]').count(),0);
 }
 for(const id of ['tianyi','lushen','wenchang','yima','huagai','jiangxing','jinyu','tianyi-medical','taohua','yangren','kongwang','jiesha']){
  const picker=page.locator(`#shensha-picker-${id}`);assert.equal(await picker.locator('input[type=checkbox]').count(),12);
  assert.equal(await picker.locator('input[value="甲"]').count(),0);assert.equal(await picker.locator('input[value="子"]').count(),1);assert.equal(await picker.locator('input[value="甲子"]').count(),0);
 }
 for(const id of ['zaisha','yuanchen','kuigang','custom1','custom2','custom3'])assert.equal(await page.locator(`#shensha-picker-${id} input[type=checkbox]`).count(),82);
 const ten=['甲辰','乙巳','丙申','丁亥','戊戌','己丑','庚辰','辛巳','壬申','癸亥'];
 assert.deepEqual(await page.locator('#shensha-picker-shie input[type=checkbox]').evaluateAll(options=>options.map(option=>option.value)),ten);
 await page.evaluate(()=>localStorage.setItem('daymark.shensha.v1',JSON.stringify({
  tiande:{enabled:true,targets:['甲','子','甲子']},tianyi:{enabled:true,targets:['甲','子','甲子']},
  kongwang:{enabled:true,targets:['甲子']},custom1:{enabled:true,targets:['庚辰']},shie:{enabled:true,targets:['甲','子','甲子','庚辰']}
 })));
 await page.reload();assert.match(await page.locator('#shensha-status').innerText(),/Unsupported/);
 assert.equal(await page.locator('#shensha-kongwang').isChecked(),false);
 assert.equal(await page.locator('#shensha-picker-tiande input:checked').count(),2);
 assert.equal(await page.locator('#shensha-picker-tianyi input:checked').count(),1);
 assert.equal(await page.locator('#shensha-picker-custom1 input[value="庚辰"]').isChecked(),true);
 for(const id of ['huagai','jiangxing','jinyu','tianyi-medical','taohua']){await page.locator(`#shensha-${id}`).check();await page.locator(`#shensha-picker-${id} summary`).click();await page.locator(`#shensha-picker-${id} input[value="辰"]`).check();}
 await page.locator('#shensha-form button[type=submit]').click();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('daymark.shensha.v1')));
 assert.deepEqual(saved.shie.targets,['庚辰']);
 assert.deepEqual(saved.tiande.targets,['甲','子']);assert.deepEqual(saved.tianyi.targets,['子']);assert.equal(saved.kongwang.enabled,false);assert.equal(saved.huagai.enabled,true);assert.equal(saved.jiangxing.enabled,true);
 await page.reload();assert.equal(await page.locator('#shensha-status').innerText(),'');
 await page.evaluate(()=>location.hash='day=2026-10-21'); // 戊辰: both new branch targets must match.
 assert.equal(await page.locator('#detail-day-pillar').innerText().then(s=>s.slice(0,2)),'戊辰');
 for(const id of ['jinyu','tianyi-medical','taohua'])assert(await page.locator(`[data-shensha=${id}].shen`).isVisible());
 assert(await page.locator('[data-shensha=huagai]').isVisible());assert(await page.locator('[data-shensha=jiangxing]').isVisible());
 console.log('Passed: per-item group restrictions, five added branch pickers, legacy-target migration, saved selections, Huagai/Jiangxing/Jinyu/Tianyi/Taohua daily matches.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
