/* What distance actually contains the bridge.

       node video/tools/probe_inc_frame.js [factor ...]

   The take's framing constant was guessed twice and wrong twice - once too far
   (the closure at half frame) and once too near (the near end off the corner).
   Guessing a third time is how a twenty-minute shoot gets spent on a question
   that takes one minute to answer, so this loads the finished bridge and takes
   one frame per candidate at the azimuth the take ends on.                   */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const P3T = path.resolve(SP, '../../tools');
const BOOKS = path.resolve(SP, '../incheon');
const F = JSON.parse(fs.readFileSync(path.join(BOOKS, 'frames.json'), 'utf8'));
const LAST = F[F.length - 1];
const FACTORS = process.argv.slice(2).map(Number);
if (!FACTORS.length) FACTORS.push(1.0, 1.15, 1.3, 1.45);

const LIVERY = { 'MD.STAY': '#ffffff', 'MD.PYL': '#e8edf3',
                 'MD.DCK': '#6f7c8b', 'MD.PIE': '#aab6c2' };
const LIB = f => {
  let p = P3T + '/node_modules/three/build/three.min.js';
  if (f.includes('OrbitControls')) p = P3T + '/node_modules/three/examples/js/controls/OrbitControls.js';
  if (f.includes('polybool')) p = P3T + '/node_modules/polybooljs/dist/polybool.min.js';
  if (f.includes('exceljs')) p = P3T + '/node_modules/exceljs/dist/exceljs.min.js';
  return fs.readFileSync(p, 'utf-8');
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
           '--enable-unsafe-swiftshader'] });
  const app = await b.newPage({ viewport: { width: 2336, height: 1294 } });
  await app.route('**/{unpkg.com,cdnjs.cloudflare.com}/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: LIB(r.request().url()) }));
  await app.goto('file://' + SP + '/video_page.html', { waitUntil: 'domcontentloaded' });
  await app.waitForTimeout(3000);
  const book = 'INC_' + String(F.length - 1).padStart(2, '0') + '.xlsx';
  await app.setInputFiles('#pb-file', path.join(BOOKS, book));
  await app.waitForFunction(f => {
    const r = document.getElementById('pb-result');
    return r && r.innerText.indexOf(f) >= 0 && /Succeed|Failed|error/i.test(r.innerText);
  }, book, { timeout: 300000 });
  await app.evaluate(l => Object.keys(l).forEach(k => {
    try { window.plateBuilder.setColor('module', k, l[k]); } catch (e) {}
  }), LIVERY);
  await app.waitForTimeout(600);

  const span = LAST.xhi - LAST.xlo;
  // the last frame of the take, and the one a quarter turn before it
  for (const u of [1.0, 0.75]) {
    const az = -35 + 360 * u;
    const face = Math.max(0.7, Math.abs(Math.cos(az * Math.PI / 180)));
    for (const k of FACTORS) {
      const d = Math.max(330000, LAST.ztop * 1.5, span * face * k);
      await app.evaluate(a => window.__aim(a.tx, a.ty, a.tz, a.dist, a.az, a.el),
        { tx: 0, ty: 0, tz: Math.max(60000, LAST.ztop * 0.52),
          dist: d, az: az, el: 8 + 8 * u });
      await app.waitForTimeout(250);
      const png = await app.evaluate(() => window.__grab(0.92));
      const f = path.join(SP, 'probe_u' + Math.round(u * 100) + '_k' +
                              String(k).replace('.', '') + '.jpg');
      fs.writeFileSync(f, Buffer.from(png.split(',')[1], 'base64'));
      console.log('u ' + u + '  k ' + k + '  az ' + az.toFixed(0) +
                  '  dist ' + Math.round(d) + '  ' + path.basename(f));
    }
  }
  await b.close();
})();
