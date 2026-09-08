/* A look at a workbook without opening a browser by hand.

       node tools/shot_ggb.js [BOOK.xlsx] [outdir]

   ENGINE=prod points it at host_lock.html - the shipped engine, which is the
   one a visitor actually gets - instead of the test build. A sheet that only
   works on the test engine is a sheet nobody can use yet.

   Loads the book into the real app, prints what the result panel says - rows,
   members, weight, and every warning - and saves one picture per view. The
   panel is the point: a model that draws is not the same as a model the engine
   had nothing to complain about, and the warnings are where the difference
   shows up. */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const P3 = path.resolve(SP, '..');
const BOOK = process.argv[2] || path.join(P3, 'PLATE3D_GGB.xlsx');
const OUT = process.argv[3] || path.join(SP, 'shot');
const TAG = process.env.TAG ? '_' + process.env.TAG : '';

const LIB = f => {
  let p = SP + '/node_modules/three/build/three.min.js';
  if (f.includes('OrbitControls')) p = SP + '/node_modules/three/examples/js/controls/OrbitControls.js';
  if (f.includes('polybool')) p = SP + '/node_modules/polybooljs/dist/polybool.min.js';
  if (f.includes('exceljs')) p = SP + '/node_modules/exceljs/dist/exceljs.min.js';
  return fs.readFileSync(p, 'utf-8');
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
           '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1800, height: 1000 },
                                       deviceScaleFactor: 1 });
  await page.route('**/{unpkg.com,cdnjs.cloudflare.com}/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: LIB(r.request().url()) }));
  await page.route('**/fonts.{googleapis,gstatic}.com/**', r => r.abort());
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  page.on('dialog', async d => { errs.push('alert: ' + d.message()); await d.dismiss(); });
  const HOST = process.env.ENGINE === 'prod' ? '/host_lock.html' : '/host_test.html';
  await page.goto('file://' + SP + HOST, { waitUntil: 'domcontentloaded' });
  console.log('engine: ' + HOST.slice(1));
  await page.waitForTimeout(2500);

  const name = path.basename(BOOK);
  await page.setInputFiles('#pb-file', BOOK);
  await page.waitForFunction(n => {
    const r = document.getElementById('pb-result');
    return r && r.innerText.indexOf(n) >= 0 && /Succeed|Failed|error/i.test(r.innerText);
  }, name, { timeout: 600000 });
  await page.waitForTimeout(4000);

  const info = await page.evaluate(() => ({
    panel: (document.getElementById('pb-result') || {}).innerText || '',
    total: (document.getElementById('pb-total') || {}).innerText || '',
    clash: (window.plateBuilder.clashes() || []).length
  }));
  console.log('\n--- result panel -----------------------------------------');
  console.log(info.panel.trim());
  console.log('--- total ------------------------------------------------');
  console.log(info.total.trim() + '   clashes: ' + info.clash);
  console.log('----------------------------------------------------------\n');

  /* Colour is not in the sheet - the engine hands out a palette in read order
     and the only way to say otherwise is the swatch in the left-hand list. So
     the same override the swatch calls is available here, which is what makes a
     picture in a chosen livery repeatable:
         COLOURS='md.dk=#f04a00,md.twr=#c0362c' node tools/shot_ggb.js         */
  const CL = (process.env.COLOURS || process.env.COLORS || '').split(',').filter(Boolean);
  for (const c of CL) {
    const [k, hex] = c.split('=');
    await page.evaluate(a => window.plateBuilder.setColor(
      a.k.indexOf('as.') === 0 ? 'module' : 'module', a.k.trim().toUpperCase(), a.hex.trim()),
      { k, hex });
  }
  if (CL.length) { await page.waitForTimeout(2500); console.log('  colours: ' + CL.join(' ')); }

  for (const v of ['iso', 'front', 'side', 'top']) {
    await page.evaluate(k => window.plateBuilder.setView(k), v);
    await page.waitForTimeout(1800);
    const f = path.join(OUT, name.replace(/\.xlsx$/i, '') + TAG + '_' + v + '.png');
    await page.screenshot({ path: f });
    console.log('  ' + f);
  }
  // and one module on its own, which is where the detail is legible
  for (const m of (process.env.PVMOD || 'md.twr').split(',')) {
    const got = await page.evaluate(k => {
      if (!window.plateBuilder.previewModule) return false;
      window.plateBuilder.previewModule(k.toUpperCase()); return true;
    }, m);
    if (!got) continue;
    await page.waitForTimeout(3000);
    const f = path.join(OUT, name.replace(/\.xlsx$/i, '') + '_' + m + '.png');
    await page.screenshot({ path: f });
    console.log('  ' + f);
    await page.evaluate(() => window.plateBuilder.closePreview());
    await page.waitForTimeout(600);
  }
  if (errs.length) console.log('\npage errors:\n  ' + errs.join('\n  '));
  await browser.close();
})();
