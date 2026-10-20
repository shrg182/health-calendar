const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../sync.js'), 'utf8');
for (const [hash, cleaned, message] of [
  ['#access_token=test-only&refresh_token=test-only&type=signup', true, 'Confirmation link received'],
  ['#error=access_denied&error_code=otp_expired', true, 'could not be completed'],
  ['#day=2026-10-20', false, ''],
  ['', false, '']
]) {
  let replaced;
  const context = {
    window:{DAYMARK_SYNC:{url:'https://example.invalid', publishableKey:'test'}},
    location:{hash, pathname:'/calendar/', search:'?view=combined'},
    history:{state:{test:true}, replaceState:(state, title, url) => { replaced = url; }},
    URLSearchParams
  };
  vm.runInNewContext(source, context);
  assert.equal(Boolean(replaced), cleaned);
  if (cleaned) assert.equal(replaced, '/calendar/?view=combined');
  assert(context.window.DaymarkSync.callbackMessage.includes(message));
}
console.log('Passed: callback token cleanup, expired links, date routes, ordinary page loads.');
