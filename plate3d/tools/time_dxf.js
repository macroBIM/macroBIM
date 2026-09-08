/* How long Save DXF takes, per workbook.

       node tools/time_dxf.js [BOOK.xlsx ...]        (default: every PLATE3D_*)
       SAVE=<dir> node tools/time_dxf.js BOOK.xlsx   (also keep the DXF)

   It exists because the slowness that mattered was never visible from here.
   Every other check asks whether the output is RIGHT; a drawing that is right
   and takes four minutes is a button people stop pressing, and nothing in the
   repo would have said so. PLATE3D_GGB is what found it - 2219 members over
   2 km - so that book is the one to watch.

   ENGINE=prod times the shipped engine instead of the test build. */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const P3 = path.resolve(SP, '..');
let BOOKS = process.argv.slice(2);
if (!BOOKS.length) {
  BOOKS = fs.readdirSync(P3).filter(f => /^PLATE3D_.*\.xlsx$/.test(f)).sort()
            .map(f => path.join(P3, f));
}
const LIB = f => {
  let p = SP + '/node_modules/three/build/three.min.js';
  if (f.includes('OrbitControls')) p = SP + '/node_modules/three/examples/js/controls/OrbitControls.js';
  if (f.includes('polybool')) p = SP + '/node_modules/polybooljs/dist/polybool.min.js';
  if (f.includes('exceljs')) p = SP + '/node_modules/exceljs/dist/exceljs.min.js';
  return fs.readFileSync(p, 'utf-8');
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
           '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.route('**/{unpkg.com,cdnjs.cloudflare.com}/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: LIB(r.request().url()) }));
  const HOST = process.env.ENGINE === 'prod' ? '/host_lock.html' : '/host_test.html';
  await page.goto('file://' + SP + HOST, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  console.log('\nengine: ' + HOST.slice(1));
  console.log('book                        views    load       DXF        size');

  let worst = 0;
  for (const bk of BOOKS) {
    const t0 = Date.now();
    await page.setInputFiles('#pb-file', bk);
    await page.waitForFunction(n => {
      const r = document.getElementById('pb-result');
      return r && r.innerText.indexOf(n) >= 0 && /Succeed|Failed|error/i.test(r.innerText);
    }, path.basename(bk), { timeout: 900000 });
    const load = (Date.now() - t0) / 1000;
    await page.waitForTimeout(1500);
    /* The blob Save DXF hands the browser is caught rather than downloaded, so
       the number is the build and nothing else. */
    const r = await page.evaluate(async () => {
      const o = URL.createObjectURL.bind(URL);
      let blob = null;
      URL.createObjectURL = bl => { blob = bl; return o(bl); };
      const t = performance.now();
      plateBuilder.exportDXF();
      const ms = performance.now() - t;
      URL.createObjectURL = o;
      const panel = (document.getElementById('pb-result') || {}).innerText || '';
      return { ms: ms, bytes: blob ? blob.size : 0,
               txt: blob ? await blob.text() : '',
               views: (panel.match(/views (\d+)/) || [0, '0'])[1] };
    });
    if (process.env.SAVE) {
      fs.mkdirSync(process.env.SAVE, { recursive: true });
      fs.writeFileSync(path.join(process.env.SAVE,
        path.basename(bk).replace(/\.xlsx$/i, '') + '.dxf'), r.txt);
    }
    const secs = r.ms / 1000;
    if (secs > worst) worst = secs;
    console.log('  ' + path.basename(bk).padEnd(26) +
                String(r.views).padStart(3) +
                (load.toFixed(1) + ' s').padStart(9) +
                (secs.toFixed(1) + ' s').padStart(10) +
                ((r.bytes / 1e6).toFixed(2) + ' MB').padStart(11) +
                (secs > 20 ? '   ← slow' : ''));
  }
  console.log('\n' + BOOKS.length + ' books · slowest DXF ' + worst.toFixed(1) + ' s');
  await browser.close();
})();
