/* Can PLATE3D make a hollow tube?

   A shoring system is almost entirely pipe. SECT has no pipe type and BAR is a
   solid round bar, so the only route is CUT-ing a smaller circle out of a BAR's
   profile. A BAR is stored in plates[] as SHAPE 'CIRC', which is where CUT
   looks, so it should work - but a weight is the only thing that says whether
   the hole is really removed or merely drawn.

   Two probes, one member each, so the arithmetic is checkable by hand:

     t1  BAR 48.6 solid, 1000 long   pi/4 x 48.6^2 x 1000 x 7.85e-6 = 14.562 kg
     t2  same, CUT by a 44 circle    pi/4 x (48.6^2-44^2) x ...     =  2.626 kg

   If t2 comes back near 14.5 the hole was ignored and shoring is off the table
   until the engine gains a pipe. Circles are polygonised, so a percent or so
   under the exact figure is expected, not a failure.                         */
const ExcelJS = require('./node_modules/exceljs');
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const OUT = SP + '/probe';
fs.mkdirSync(OUT, { recursive: true });

const D_OUT = 48.6, D_IN = 44.0, LEN = 1000, RHO = 7.85e-6;
const area = d => Math.PI / 4 * d * d;

const CASES = [
  { id: 't1', what: 'BAR 48.6 solid',
    kg: area(D_OUT) * LEN * RHO, cut: false },
  { id: 't2', what: 'BAR 48.6 with a 44 circle cut out',
    kg: (area(D_OUT) - area(D_IN)) * LEN * RHO, cut: true }
];

async function book(c) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('input');
  let r = 1;
  const put = a => { const row = ws.getRow(r++);
    a.forEach((v, i) => { if (v !== null) row.getCell(i + 2).value = v; }); };
  put(['# HOLE', 'id', 'TYPE', 'base.pt', 'D']);
  put(['HOLE', 'ho.in', 'CIRC', 'mc', D_IN]);
  put(['# BAR', 'id', 'mat', 'dia', 'length']);
  put(['BAR', 'bar.p', 'SS400', D_OUT, LEN]);
  if (c.cut) {
    put(['# CUT', 'target', 'L.X', 'L.Y', 'shape']);
    put(['CUT', 'bar.p', 0, 0, 'ho.in']);
  }
  put(['# ASSY', 'id', 'ref', 'cmd', 'p1', 'p2', 'p3']);
  put(['ASSY', 'as.p', 'bar.p', 'ADD', 0, 0, 0]);
  put(['END']);
  const f = OUT + '/PROBE_' + c.id.toUpperCase() + '.xlsx';
  await wb.xlsx.writeFile(f);
  return f;
}

const LIB = f => {
  let p = SP + '/node_modules/three/build/three.min.js';
  if (f.includes('OrbitControls')) p = SP + '/node_modules/three/examples/js/controls/OrbitControls.js';
  if (f.includes('polybool')) p = SP + '/node_modules/polybooljs/dist/polybool.min.js';
  if (f.includes('exceljs')) p = SP + '/node_modules/exceljs/dist/exceljs.min.js';
  return fs.readFileSync(p, 'utf-8');
};

async function weigh(page, file) {
  await page.setInputFiles('#pb-file', file);
  await page.waitForFunction(b => {
    const r = document.getElementById('pb-result');
    return r && r.innerText.indexOf(b) >= 0 && /Succeed|Failed/.test(r.innerText);
  }, path.basename(file), { timeout: 180000 });
  await page.waitForTimeout(700);
  const txt = (await page.evaluate(() =>
    document.getElementById('pb-result').innerText)).trim();
  const line = txt.split('\n').filter(l => /placed \d+/.test(l)).pop() || '';

  const tmp = SP + '/.probe.xlsx';
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }),
                                  page.evaluate(() => plateBuilder.exportBOQ())]);
  await dl.saveAs(tmp);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(tmp);
  fs.unlinkSync(tmp);
  const ws = wb.getWorksheet('SUMMARY');
  let col = null, kg = null;
  ws.eachRow(row => {
    for (let c = 1; c <= 14 && col === null; c++)
      if (/weight\s*\(?kg/i.test(String(row.getCell(c).value || ''))) col = c;
    if (col === null) return;
    if (!/^total/i.test(String(row.getCell(1).value || '').trim())) return;
    let v = row.getCell(col).value;
    if (v && typeof v === 'object' && v.formula !== undefined) v = v.result;
    if (typeof v === 'number') kg = v;
  });
  return { members: Number((line.match(/placed (\d+)/) || [])[1]),
           kg: kg === null ? null : Math.round(kg * 1000) / 1000,
           warn: /Failed|error/i.test(txt) };
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
           '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 860 },
                                       acceptDownloads: true });
  await page.route('**/{unpkg.com,cdnjs.cloudflare.com}/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: LIB(r.request().url()) }));
  await page.route('**/fonts.{googleapis,gstatic}.com/**', r => r.abort());
  await page.goto('file://' + SP + '/video_page.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const got = {};
  for (const c of CASES) {
    const f = await book(c);
    const g = await weigh(page, f);
    got[c.id] = g;
    console.log('  ' + c.id + '  ' + c.what.padEnd(36) +
                String(g.members).padStart(2) + ' member   ' +
                String(g.kg).padStart(8) + ' kg   (hand: ' + c.kg.toFixed(3) + ')');
  }
  await browser.close();

  const solid = got.t1.kg, tube = got.t2.kg;
  console.log('');
  if (tube === null || solid === null) { console.log('  no weight came back'); return; }
  const want = CASES[1].kg;
  const off  = Math.abs(tube - want) / want * 100;
  if (Math.abs(tube - solid) < solid * 0.02)
    console.log('  CUT IGNORED on a BAR - the weight did not move. No pipe.');
  else if (off < 3)
    console.log('  TUBE WORKS - ' + tube + ' kg against ' + want.toFixed(3) +
                ' by hand, ' + off.toFixed(1) + '% under (circle is polygonised).');
  else
    console.log('  something was removed, but ' + off.toFixed(1) +
                '% off the hand figure - look before trusting it.');
})();
