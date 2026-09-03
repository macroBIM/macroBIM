/* The Simple connector cards, screenshotted with an alpha channel so ffmpeg can fade them
   over the picture. Solid cards - the title, the three-panel ground and the
   outro - keep their background. */
const { chromium } = require('playwright-core');
const fs = require('fs');
const SP = __dirname + '/simpleconn';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.route('**/fonts.{googleapis,gstatic}.com/**', r => r.abort());
  // only the cards mkcards wrote - the prep pages share this directory
  const files = JSON.parse(fs.readFileSync(SP + '/cards.json', 'utf8'))
    .map(id => id + '.html').sort();
  for (const f of files) {
    await p.goto('file://' + SP + '/' + f, { waitUntil: 'load', timeout: 20000 }).catch(() => {});
    /* Inter is embedded as a data: URL with font-display:swap, so it is fetched
       lazily - screenshot too early and the card goes out in the fallback face.
       Ask for it, then wait for the font set to settle. */
    await p.evaluate(() => document.fonts.load('700 20px Inter')
      .then(() => document.fonts.load('600 46px Inter'))
      .then(() => document.fonts.ready)).catch(() => {});
    await p.waitForTimeout(350);
    const solid = /^s_(t|d|o)\d/.test(f);
    await p.screenshot({ path: SP + '/' + f.replace('.html', '.png'), omitBackground: !solid });
  }
  /* ask about a weight the cards actually use - 400 is never drawn here, so
     checking it reports "false" on a page that is set in Inter throughout */
  console.log('rendered ' + files.length + ' cards; Inter: ' +
    await p.evaluate(() => document.fonts.check('700 20px Inter')));
  await b.close();
})();
