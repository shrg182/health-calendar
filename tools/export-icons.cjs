// Run with PLAYWRIGHT_PATH pointing to Playwright when it is not installed locally.
const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const root = path.resolve(__dirname, '..');
  const browser = await chromium.launch({channel:'chrome', headless:true});
  try {
    
    for (const size of [192, 512]) {
      const page = await browser.newPage({viewport:{width:size, height:size}, deviceScaleFactor:1});
      await page.setContent('<style>html,body{margin:0;width:100%;height:100%}svg{display:block;width:100%;height:100%}</style>' + fs.readFileSync(path.join(root, 'icons/calendar.svg'), 'utf8'));
      await page.screenshot({path:path.join(root, `icons/calendar-${size}.png`)});
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
