const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const context = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../translations.js'),'utf8'),context);
const messages = context.window.DAYMARK_TRANSLATIONS;
const parameters = value => [...new Set([...value.matchAll(/\{(\w+)\}/g)].map(match=>match[1]))].sort();
for (const [key,translation] of Object.entries(messages)) {
 for (const language of ['zh','ru','fr','ja']) {
  assert.equal(typeof translation[language],'string',`${language}: ${key}`);
  assert(translation[language].trim(),`${language}: empty message ${key}`);
  assert.deepEqual(parameters(translation[language]),parameters(key),`${language}: placeholders ${key}`);
 }
}
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../release.js'),'utf8'),context);
const release = context.DAYMARK_RELEASE;
assert(/^\d+\.\d+\.\d+-dev\.\d+$/.test(release.version));
assert.equal(new Date(release.date).toISOString().slice(0,10),release.date);
for (const key of release.changes) assert(messages[key],`Missing translated release note: ${key}`);
console.log(`Passed: ${Object.keys(messages).length} complete translations with matching placeholders in Chinese, Japanese, Russian, and French.`);
