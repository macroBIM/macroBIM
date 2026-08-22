/* Zoom the two take-off stills to fill the frame, and drop them back in place.

   xlsxpreview draws the workbook at the size Excel gives it - real column
   widths in real pixels - and does not scale to any frame, which is exactly
   what makes it trustworthy. On a 1920 page that leaves a SUMMARY sheet sitting
   in the top-left corner with most of the screen white. Correct, and unreadable
   at video size.

   What is applied here is a uniform scale on the whole table and nothing else.
   That is the same thing as changing the zoom in Excel: every column keeps its
   width relative to every other, the fonts keep their sizes relative to the
   cells, the fills, borders, alignment and number formats are untouched. The
   format is not what changes; the camera is. The first promo showed the
   take-off filling the frame and that is the look being kept.

   Frames are located by where they start in the film, from the capture log -
   matching on hold length has turned up two candidates before now.

     node rezoom_splice.js                                                    */
const { chromium } = require('playwright-core');
const fs = require('fs');

const SP = __dirname;
const SRC = SP + '/src_splice';

/* start time in the film, and the page that belongs there. Cut 9 runs
   62.79 -> 74.79s: SUMMARY for the first 5.4s, PART LIST for the rest. */
const FIX = [
  { at: 64.0, page: 'splice/s_boq1.html', label: 'cut 9 - SUMMARY' },
  { at: 70.0, page: 'splice/s_boq2.html', label: 'cut 9 - PART LIST' }
];

(async () => {
  const meta = JSON.parse(fs.readFileSync(SP + '/shots_splice.json', 'utf8'));
  let t = 0;
  const at = [];
  meta.shots.forEach(s => {
    FIX.forEach((f, i) => {
      if (at[i] === undefined && t <= f.at && t + s.dur > f.at) at[i] = s.file;
    });
    t += s.dur;
  });
  const miss = FIX.filter((f, i) => !at[i]);
  if (miss.length) {
    console.log('no frame at ' + miss.map(f => f.at + 's').join(', '));
    process.exitCode = 1;
    return;
  }
  if (at[0] === at[1]) {
    console.log('both times land on the same still - the cut is not two pages');
    process.exitCode = 1;
    return;
  }

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  await p.route('**/fonts.{googleapis,gstatic}.com/**', r => r.abort());

  for (let i = 0; i < FIX.length; i++) {
    const f = FIX[i];
    await p.goto('file://' + SP + '/' + f.page, { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready).catch(() => {});
    const got = await p.evaluate(() => {
      const tb = document.querySelector('table');
      if (!tb) return null;
      const W = tb.offsetWidth, H = tb.offsetHeight;
      /* fit, never stretch past 3x - beyond that the hinting the browser did at
         the real size starts to show as soft edges rather than crisp cells */
      const k = Math.min(1840 / W, 1000 / H, 3);
      document.body.style.cssText = 'background:#fff;margin:0;padding:0;' +
        'width:1920px;height:1080px;overflow:hidden';
      tb.style.transformOrigin = 'top left';
      tb.style.transform = 'scale(' + k + ')';
      tb.style.position = 'absolute';
      tb.style.left = Math.max(24, (1920 - W * k) / 2) + 'px';
      tb.style.top = Math.max(24, (1080 - H * k) / 2) + 'px';
      return { W: W, H: H, k: Math.round(k * 100) / 100 };
    });
    if (!got) { console.log('  no table in ' + f.page); process.exitCode = 1; continue; }
    await p.waitForTimeout(300);
    fs.writeFileSync(SRC + '/' + at[i], await p.screenshot({ type: 'png' }));
    console.log('  ' + at[i] + '  ' + f.page.replace('splice/', '') + '  ' +
                got.W + 'x' + got.H + '  scale ' + got.k + '   ' + f.label);
  }
  await b.close();
  console.log('\nframes replaced; format untouched, only the zoom');
})();
