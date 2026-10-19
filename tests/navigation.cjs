const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.locator('#jump-month').selectOption('1');
    await page.locator('#jump-year').fill('2028');
    await page.locator('#month-form button').click();
    if (!await page.locator('[data-date="2028-02-29"]').count()) throw Error('Leap date missing');
    await page.locator('#find-date').fill('2028-02-29');
    await page.locator('#date-form button').click();
    await page.locator('#detail-page').waitFor({ state: 'visible' });
    if (!page.url().endsWith('#day=2028-02-29')) throw Error('Incorrect date route');
    await page.locator('#back-to-calendar').click();
    await page.locator('#calendar-page').waitFor({ state: 'visible' });
    await page.locator('[data-view="lunar"]').click();
    await page.reload();
    if (await page.locator('[data-view="lunar"]').getAttribute('aria-pressed') !== 'true') throw Error('Preference not restored');
    for (const [year, month, button] of [['1901', '0', '#prev'], ['2100', '11', '#next']]) {
      await page.locator('#jump-year').fill(year);
      await page.locator('#jump-month').selectOption(month);
      await page.locator('#month-form button').click();
      if (!await page.locator(button).isDisabled()) throw Error('Boundary missing');
    }
    for (const width of [320, 375, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      for (const view of ['gregorian', 'lunar', 'combined']) {
        await page.locator(`[data-view="${view}"]`).click();
        if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error(`Overflow at ${width}px in ${view}`);
      }
      for (const selector of ['#prev', '#next', '#today', '.view-btn', '#jump-month', '#jump-year', '#find-date']) {
        const bounds = await page.locator(selector).first().boundingBox();
        if (bounds.height < 44) throw Error(`Small control: ${selector}`);
      }
      await page.locator('[data-date="2100-12-15"]').click();
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error(`Detail overflow at ${width}px`);
      await page.locator('#back-to-calendar').click();
      await page.locator('#calendar-page').waitFor({ state: 'visible' });
    }
    if (errors.length) throw Error(errors.join('\n'));
    console.log('Passed: leap-day navigation, date search/back, preference reload, range boundaries, mobile overflow, and no browser errors.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
