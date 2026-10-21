async function openSettings(page) {
  if (await page.locator('#settings-page').isHidden()) {
    await page.locator('#open-settings').click();
    await page.locator('#settings-page').waitFor({state:'visible'});
  }
}
async function closeSettings(page) {
  if (await page.locator('#settings-page').isVisible()) {
    await page.goBack();
    await page.locator('#settings-page').waitFor({state:'hidden'});
  }
}
module.exports = {openSettings, closeSettings};
