/* Cards to images.

       node video/tools/rendercards_inc.js

   Full cards come out as opaque JPEG because they are shots and go through the
   same normalise pass as every other still. Overlay cards come out as PNG with
   a real alpha channel, which is what lets the assembler fade them in over the
   model rather than cutting to them. */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const DIR = path.join(SP, 'cards_inc');
const index = JSON.parse(fs.readFileSync(path.join(DIR, 'index.json'), 'utf8'));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
                                    args: ['--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  for (const id of Object.keys(index)) {
    const kind = index[id];
    await page.goto('file://' + path.join(DIR, 't_' + id + '.html'),
                    { waitUntil: 'load' });
    await page.waitForTimeout(180);
    if (kind === 'full') {
      await page.screenshot({ path: path.join(DIR, 't_' + id + '.jpg'),
                              type: 'jpeg', quality: 95 });
    } else {
      await page.screenshot({ path: path.join(DIR, 't_' + id + '.png'),
                              omitBackground: true });
    }
    console.log('  t_' + id + (kind === 'full' ? '.jpg' : '.png'));
  }
  await b.close();
})();
