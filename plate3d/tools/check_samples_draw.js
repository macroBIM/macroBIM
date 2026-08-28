/* Every sample workbook has to come out of Save DXF with a drawing in it.

       node tools/check_samples_draw.js

   Drawings are no longer produced unless a sheet asks for them, which makes
   this the check that did not need to exist before: a sample whose rows do not
   ask is a sample that exports an empty nothing, and it looks exactly like a
   sample that works right up until someone presses the button.

   Each book is loaded into the real app and exported. Passing means a file
   came back with entities in it, and that the report carried no warning about
   a VIEW or a PLOT row - a book that asks for six drawings and silently gets
   five is the failure this is really for. */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const P3 = path.resolve(__dirname, '..');
const SP = __dirname;
const ONLY = process.argv.slice(2).filter(a => a[0] !== '-');

const LIB = f => {
  let p = SP + '/node_modules/three/build/three.min.js';
  if (f.includes('OrbitControls')) p = SP + '/node_modules/three/examples/js/controls/OrbitControls.js';
  if (f.includes('polybool')) p = SP + '/node_modules/polybooljs/dist/polybool.min.js';
  if (f.includes('exceljs')) p = SP + '/node_modules/exceljs/dist/exceljs.min.js';
  return fs.readFileSync(p, 'utf-8');
};
const countOf = (dxf, kind) =>
  !dxf ? 0 : (dxf.match(new RegExp('^\\s*' + kind + '\\s*$', 'gm')) || []).length;

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
           '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.route('**/{unpkg.com,cdnjs.cloudflare.com}/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: LIB(r.request().url()) }));
  await page.route('**/fonts.{googleapis,gstatic}.com/**', r => r.abort());
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  page.on('dialog', async d => { page.__alert = d.message(); await d.dismiss(); });
  await page.goto('file://' + SP + '/host_test.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  let books = fs.readdirSync(P3).filter(f => /^PLATE3D_.*\.xlsx$/.test(f)).sort();
  if (ONLY.length) books = books.filter(b => ONLY.some(o => b.indexOf(o) >= 0));

  let bad = 0;
  console.log('book                      lines   arcs   text   drawing rows');
  for (const b of books) {
    page.__alert = null;
    await page.setInputFiles('#pb-file', path.join(P3, b));
    try {
      await page.waitForFunction(n => {
        const r = document.getElementById('pb-result');
        return r && r.innerText.indexOf(n) >= 0 && /Succeed|Failed|error/i.test(r.innerText);
      }, b, { timeout: 300000 });
    } catch (e) { console.log('  ' + b.padEnd(24) + 'NEVER LOADED'); bad++; continue; }
    await page.waitForTimeout(700);
    const report = await page.evaluate(() =>
      (document.getElementById('pb-result') || {}).innerText || '');
    const asked = (report.match(/views (\d+)/) || [0, 0])[1];

    await page.evaluate(() => {
      const o = URL.createObjectURL.bind(URL);
      URL.createObjectURL = bl => { window.__b = bl; return o(bl); };
      window.__b = null;
    });
    await page.evaluate(() => plateBuilder.exportDXF());
    let dxf = null;
    try {
      await page.waitForFunction(() => !!window.__b, null, { timeout: 600000 });
      dxf = await page.evaluate(() => window.__b.text());
    } catch (e) { /* alert, or nothing drawn */ }

    /* A warning naming a VIEW or a PLOT row means the sheet asked for a drawing
       it did not get, which a file that is merely non-empty will not show. */
    const rowWarn = (report.match(/row \d+: (VIEW|PLOT)[^\n]*/g) || []);
    const isTemplate = /TEMPLATE/.test(b);
    const okDraw = isTemplate ? dxf === null : (dxf && countOf(dxf, 'LINE') > 0);
    if (!okDraw || rowWarn.length) bad++;
    console.log('  ' + b.padEnd(24) +
                String(countOf(dxf, 'LINE')).padStart(6) +
                String(countOf(dxf, 'ARC') + countOf(dxf, 'CIRCLE')).padStart(7) +
                String(countOf(dxf, 'TEXT')).padStart(7) +
                '   ' + (asked || '0') +
                (okDraw ? '' : '   ← NO DRAWING' + (isTemplate ? ' (expected: the empty template)' : '')) +
                (rowWarn.length ? '\n      ' + rowWarn.join('\n      ') : ''));
  }
  if (errs.length) { console.log('\npage errors:\n  ' + errs.join('\n  ')); bad++; }
  console.log('\n' + books.length + ' books, ' + (bad ? bad + ' PROBLEM' : 'all draw'));
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
