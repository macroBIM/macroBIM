/* The teaching film's cards, screenshotted with an alpha channel so ffmpeg can
   fade them over the picture.

   Which cards keep their background is the whole of the logic here:

     pills   b_c*   transparent - a lozenge over live footage
     section b_s*   transparent - and this is the subtle one. The scrim is the
                                  card, but it is a *translucent* scrim: the
                                  frame underneath has to show through at 14%,
                                  which is the difference between a chapter
                                  heading laid over the model and a slide that
                                  threw the model away. Screenshot it solid and
                                  Chromium composites rgba(11,18,32,.86) onto
                                  white, baking the alpha into flat grey - which
                                  is exactly what happened the first time.
                                  omitBackground keeps the alpha channel, so
                                  ffmpeg does the compositing over real footage.
     title   b_t02  solid        - it replaces the picture outright
     outro   b_o31  solid        - so does it                                 */
const { chromium } = require('playwright-core');
const fs = require('fs');
const SP = __dirname + '/basic';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.route('**/fonts.{googleapis,gstatic}.com/**', r => r.abort());
  const files = fs.readdirSync(SP).filter(f => /^b_.*\.html$/.test(f)).sort();
  for (const f of files) {
    await p.goto('file://' + SP + '/' + f, { waitUntil: 'load', timeout: 20000 }).catch(() => {});
    /* Inter is embedded as a data: URL with font-display:swap, so it is fetched
       lazily - screenshot too early and the card goes out in the fallback face.
       Ask for it, then wait for the font set to settle. */
    await p.evaluate(() => document.fonts.load('700 20px Inter')
      .then(() => document.fonts.load('600 46px Inter'))
      .then(() => document.fonts.load('800 82px Inter'))
      .then(() => document.fonts.ready)).catch(() => {});
    await p.waitForTimeout(350);
    const solid = /^b_(t|o)\d/.test(f);
    await p.screenshot({ path: SP + '/' + f.replace('.html', '.png'), omitBackground: !solid });
  }
  /* ask about a weight the cards actually use - 400 is never drawn here, so
     checking it reports "false" on a page that is set in Inter throughout */
  console.log('rendered ' + files.length + ' cards; Inter: ' +
    await p.evaluate(() => document.fonts.check('700 20px Inter')));
  await b.close();
})();
