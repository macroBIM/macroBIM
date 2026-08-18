const { chromium } = require('playwright-core');
const fs = require('fs');
const SP = '/tmp/claude-0/-home-user/2c32e469-0690-5fe7-bd2b-b7fdc61d0d9a/scratchpad';
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.route('**/fonts.{googleapis,gstatic}.com/**', r => r.abort());
  const files = fs.readdirSync(SP).filter(f => /^v_(c\d\d|s\d\d|o\d)\.html$/.test(f));
  for (const f of files) {
    await page.goto('file://' + SP + '/' + f, { waitUntil: 'load', timeout: 20000 }).catch(()=>{});
    await page.waitForTimeout(400);
    const solid = /^v_o/.test(f);
    await page.screenshot({ path: SP + '/' + f.replace('.html', '.png'), omitBackground: !solid });
  }
  const fam = await page.evaluate(() => {
    const d = document.createElement('span');
    d.style.font = '400 16px Inter'; d.textContent = 'x'; document.body.appendChild(d);
    return document.fonts.check('16px Inter');
  });
  console.log('rendered ' + files.length + ' cards;  Inter available: ' + fam);
  await browser.close();
})();
