/* The cards, screenshotted with an alpha channel so ffmpeg can fade them over
   the picture. Solid cards - the title and the outro - keep their background. */
const { chromium } = require('playwright-core');
const fs = require('fs'); const SP = __dirname;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.route('**/fonts.{googleapis,gstatic}.com/**', r => r.abort());
  const files = fs.readdirSync(SP).filter(f => /^t_(c\d\d|v\d\d|t\d\d|o\d\d|x.\d)\.html$/.test(f));
  for (const f of files) {
    await p.goto('file://' + SP + '/' + f, { waitUntil: 'load', timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(350);
    const solid = /^t_(t|o)\d/.test(f);
    await p.screenshot({ path: SP + '/' + f.replace('.html', '.png'), omitBackground: !solid });
  }
  console.log('rendered ' + files.length + ' cards; Inter: ' +
    await p.evaluate(() => document.fonts.check('16px Inter')));
  await b.close();
})();
