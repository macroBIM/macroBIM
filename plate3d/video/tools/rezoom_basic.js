/* Re-render the two widest sheet pages zoomed, and drop them back in place.

   A MODULE row in coordinate form with the repeat block on it runs to column V.
   Twenty-one columns across a 1920 page leaves the type at about thirteen
   pixels, and the beat those two cuts exist for - four rows becoming one - was
   legible only as a shape. The whole point is that the row is readable.

   Rather than re-run an hour of capture for two stills, the pages are drawn
   again at a scale that fills the frame and the frames are overwritten. Their
   durations are untouched, so the timeline is exactly the one that was shot.

   Frames are found by where they start, not by what they look like: the earlier
   attempt at this matched on hold length and turned up two candidates.

     node rezoom_basic.js                                                     */
const { chromium } = require('playwright-core');
const fs = require('fs');

const SP = __dirname;
const SRC = SP + '/src_basic';

/* start time in the film, the page to draw, and how much of the frame width the
   sheet should take. Times come from the capture log. */
const FIX = [
  { at: 78.6,  page: 'b_sh_cutone.html',  lit: true,  label: 'cut 14 - one CUT row' },
  { at: 159.6, page: 'b_sh_anchone.html', lit: false, label: 'cut 23 - one MODULE row' }
];

(async () => {
  const meta = JSON.parse(fs.readFileSync(SP + '/shots_basic.json', 'utf8'));
  let t = 0;
  const at = [];
  meta.shots.forEach(s => {
    FIX.forEach((f, i) => {
      if (at[i] === undefined && t <= f.at + 1e-6 && t + s.dur > f.at + 1e-6) at[i] = s.file;
    });
    t += s.dur;
  });
  const missing = FIX.filter((f, i) => !at[i]);
  if (missing.length) {
    console.log('no frame at ' + missing.map(f => f.at + 's').join(', ') +
                ' - shots.json does not match the log');
    process.exitCode = 1;
    return;
  }

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  await p.route('**/fonts.{googleapis,gstatic}.com/**', r => r.abort());

  for (let i = 0; i < FIX.length; i++) {
    const f = FIX[i];
    await p.goto('file://' + SP + '/basic/' + f.page, { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready).catch(() => {});
    if (f.lit) await p.evaluate(() => document.body.classList.add('lit'));
    /* Blow the sheet up until it fills the width, and centre what is left. The
       page already scales to fit; this replaces that scale with one that treats
       the frame as the constraint rather than the margin. */
    const got = await p.evaluate(() => {
      const w = document.querySelector('.wrap');
      const svg = w && w.querySelector('svg');
      if (!svg) return null;
      const W = +svg.getAttribute('width'), H = +svg.getAttribute('height');
      const k = Math.min(1880 / W, 900 / H);
      w.style.transform = 'scale(' + k + ')';
      w.style.margin = Math.max(12, (1080 - 64 - H * k) / 2) + 'px 0 0 ' +
                       Math.max(20, (1920 - W * k) / 2) + 'px';
      return { W: W, H: H, k: Math.round(k * 100) / 100 };
    });
    if (!got) { console.log('  no svg in ' + f.page); process.exitCode = 1; continue; }
    await p.waitForTimeout(300);
    fs.writeFileSync(SRC + '/' + at[i], await p.screenshot({ type: 'png' }));
    console.log('  ' + at[i] + '  ' + f.page + '  ' + got.W + 'x' + got.H +
                '  scale ' + got.k + '   ' + f.label);
  }
  await b.close();
  console.log('\nframes replaced; shots.json untouched, timeline unchanged');
})();
