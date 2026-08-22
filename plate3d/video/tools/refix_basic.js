/* Retake the two Guide stills that were captured at the wrong scroll position,
   and put them back where they were.

   Cuts 19 and 20 asked the Guide panel for headings it does not write. Nothing
   matched, the panel stayed at the top of the document, and the two thickness
   diagrams the cuts are about never appeared. shoot_basic.js now asks for the
   right headings, but re-running the whole pass to fix two frames would be an
   hour of capture for eight seconds of film.

   Both cuts are a single held still - `chrome(6.0)` and `chrome(7.0)` - so the
   fix is two files. The frame numbers are found in shots.json by their held
   durations rather than counted by hand, and the durations are not touched, so
   the timeline is exactly the one that was shot.

     node refix_basic.js                                                      */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const SRC = SP + '/src_basic';
const VW = 2336, VH = 1294;
const BOOK = path.resolve(SP, '../..') + '/PLATE3D_BASIC.xlsx';

/* Which still, and what it should have been showing. `after` is the cut before
   it, used to find the right frame: cut 21 is the first sheet page after them,
   and cuts 19 and 20 are the only two whole-window stills held that long. */
const FIX = [
  { cut: 19, dur: 6.0, heading: 'BASE.pt' },
  { cut: 20, dur: 7.0, heading: 'Ref.Pt and the' }
];

const LIB = f => {
  let p = SP + '/node_modules/three/build/three.min.js';
  if (f.includes('OrbitControls')) p = SP + '/node_modules/three/examples/js/controls/OrbitControls.js';
  if (f.includes('polybool')) p = SP + '/node_modules/polybooljs/dist/polybool.min.js';
  if (f.includes('exceljs')) p = SP + '/node_modules/exceljs/dist/exceljs.min.js';
  return fs.readFileSync(p, 'utf-8');
};

(async () => {
  const meta = JSON.parse(fs.readFileSync(SP + '/shots_basic.json', 'utf8'));

  /* Locate the two stills by where they start in the film, not by how long
     they are held: two separate pairs happen to be held 6.0s and 7.0s, and
     guessing between them would silently replace the wrong picture. The start
     times come from the capture log - cut 19 opens at 124.0s and cut 20 at
     130.0s - and shots.json carries the durations that produce them, so the
     cumulative sum is exact rather than approximate. */
  let t = 0, at = -1;
  for (let i = 0; i < meta.shots.length; i++) {
    if (Math.abs(t - 124.0) < 1e-6 &&
        Math.abs(meta.shots[i].dur - 6.0) < 1e-6 &&
        Math.abs(meta.shots[i + 1].dur - 7.0) < 1e-6) { at = i; break; }
    t += meta.shots[i].dur;
  }
  if (at < 0) { console.log('no still starting at 124.0s held 6.0s - shots.json does not match the log'); return; }
  FIX[0].file = meta.shots[at].file;
  FIX[1].file = meta.shots[at + 1].file;
  console.log('replacing ' + FIX.map(f => f.file + ' (cut ' + f.cut + ')').join(' and '));

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--allow-file-access-from-files',
           '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const app = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 });
  await app.route('**/{unpkg.com,cdnjs.cloudflare.com}/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: LIB(r.request().url()) }));
  await app.route('**/fonts.{googleapis,gstatic}.com/**', r => r.abort());
  await app.goto('file://' + SP + '/video_page.html', { waitUntil: 'domcontentloaded' });
  await app.waitForTimeout(3500);

  await app.setInputFiles('#pb-file', BOOK);
  await app.waitForFunction(() => /Succeed/.test(
    document.getElementById('pb-result').innerText), null, { timeout: 300000 });
  await app.waitForTimeout(1200);

  let bad = 0;
  for (const f of FIX) {
    await app.evaluate(() => plateBuilder.openGuide());
    await app.waitForTimeout(500);
    const got = await app.evaluate(h => {
      const d = document.querySelector('#pb-help .doc');
      if (!d) return null;
      const el = [...d.querySelectorAll('h1,h2,h3')]
        .find(e => e.textContent.trim().toLowerCase().indexOf(h.toLowerCase()) >= 0);
      if (!el) return null;
      d.scrollTop = el.offsetTop - 24;
      return el.textContent.trim();
    }, f.heading);
    if (!got) {
      console.log('  cut ' + f.cut + '  STILL NOT FOUND: ' + f.heading + ' - frame left alone');
      bad++;
      await app.evaluate(() => plateBuilder.closeGuide());
      continue;
    }
    await app.waitForTimeout(450);
    fs.writeFileSync(SRC + '/' + f.file, await app.screenshot({ type: 'png' }));
    console.log('  cut ' + f.cut + '  ' + f.file + '  ->  ' + got);
    await app.evaluate(() => plateBuilder.closeGuide());
    await app.waitForTimeout(300);
  }
  await browser.close();
  console.log(bad ? '\n' + bad + ' frame(s) not replaced'
                  : '\nboth frames replaced; shots.json untouched, timeline unchanged');
  process.exitCode = bad ? 1 : 0;
})();
