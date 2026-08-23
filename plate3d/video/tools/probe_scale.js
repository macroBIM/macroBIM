/* How big a shoring deck can the engine actually hold?

   A 20x30m slab on a 1.2m grid is around 470 verticals, and with ledgers at
   three levels and jacks the part count runs to five thousand. That is an
   order of magnitude past anything PLATE3D has been asked to draw, so the
   question is not whether the sheet can say it - COPY says it in one row - but
   whether the browser stays usable afterwards.

   Each case is one cut tube copied along three axes, which is the same work
   the real model would do. The CUT happens once, on the definition, not once
   per placed member, so the tube costs nothing extra at scale - that is worth
   confirming too.

     node probe_scale.js                                                      */
const ExcelJS = require('./node_modules/exceljs');
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const OUT = SP + '/probe';
fs.mkdirSync(OUT, { recursive: true });

/* nx, ny, nz are copies ADDED, so the member count is (nx+1)(ny+1)(nz+1) */
const CASES = [
  { id: 's1', nx:  5, ny:  5, nz: 1, what: 'a small deck' },
  { id: 's2', nx: 11, ny: 11, nz: 2, what: 'a bay of a floor' },
  { id: 's3', nx: 17, ny: 25, nz: 2, what: '20x30m slab, 1.2m grid, 3 lifts' },
  { id: 's4', nx: 17, ny: 25, nz: 9, what: 'ten lifts - past anything real' }
];

async function book(c) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('input');
  let r = 1;
  const put = a => { const row = ws.getRow(r++);
    a.forEach((v, i) => { if (v !== null) row.getCell(i + 2).value = v; }); };
  put(['# HOLE', 'id', 'TYPE', 'base.pt', 'D']);
  put(['HOLE', 'ho.in', 'CIRC', 'mc', 44]);
  put(['# BAR', 'id', 'mat', 'dia', 'length']);
  put(['BAR', 'bar.v', 'SS400', 48.6, 2000]);
  put(['# CUT', 'target', 'L.X', 'L.Y', 'shape']);
  put(['CUT', 'bar.v', 0, 0, 'ho.in']);
  put(['# ASSY', 'id', 'ref', 'cmd', 'p1', 'p2', 'p3', 'p4']);
  put(['ASSY', 'as.d', 'bar.v', 'ADD', 0, 0, 0]);
  put(['ASSY', 'as.d', 'as.d', 'COPY', 1200, 0, 0, c.nx]);
  put(['ASSY', 'as.d', 'as.d', 'COPY', 0, 1200, 0, c.ny]);
  put(['ASSY', 'as.d', 'as.d', 'COPY', 0, 0, 2000, c.nz]);
  put(['END']);
  const f = OUT + '/SCALE_' + c.id.toUpperCase() + '.xlsx';
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

  console.log('  case   want    got     build     BOQ     redraw   kg');
  for (const c of CASES) {
    const f = await book(c);
    const want = (c.nx + 1) * (c.ny + 1) * (c.nz + 1);

    let t = Date.now();
    await page.setInputFiles('#pb-file', f);
    let ok = true;
    try {
      await page.waitForFunction(b => {
        const r = document.getElementById('pb-result');
        return r && r.innerText.indexOf(b) >= 0 && /Succeed|Failed/.test(r.innerText);
      }, path.basename(f), { timeout: 240000 });
    } catch (e) { ok = false; }
    const tBuild = (Date.now() - t) / 1000;
    if (!ok) { console.log('  ' + c.id + '   ' + String(want).padStart(5) +
                           '   TIMED OUT after ' + tBuild.toFixed(1) + 's   ' + c.what); continue; }

    const txt = await page.evaluate(() => document.getElementById('pb-result').innerText);
    const got = Number((txt.match(/placed (\d+)/g) || []).pop().match(/(\d+)/)[1]);

    /* one redraw, which is what a drag costs */
    t = Date.now();
    await page.evaluate(() => { window.__pbDraw && window.__pbDraw(); });
    const tDraw = (Date.now() - t) / 1000;

    t = Date.now();
    let kg = null;
    try {
      const tmp = SP + '/.scale.xlsx';
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 240000 }),
                                      page.evaluate(() => plateBuilder.exportBOQ())]);
      await dl.saveAs(tmp);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(tmp);
      fs.unlinkSync(tmp);
      const ws = wb.getWorksheet('SUMMARY');
      let col = null;
      ws.eachRow(row => {
        for (let i = 1; i <= 14 && col === null; i++)
          if (/weight\s*\(?kg/i.test(String(row.getCell(i).value || ''))) col = i;
        if (col === null) return;
        if (!/^total/i.test(String(row.getCell(1).value || '').trim())) return;
        let v = row.getCell(col).value;
        if (v && typeof v === 'object' && v.formula !== undefined) v = v.result;
        if (typeof v === 'number') kg = Math.round(v);
      });
    } catch (e) { kg = null; }
    const tBoq = (Date.now() - t) / 1000;

    console.log('  ' + c.id + '   ' + String(want).padStart(5) + '  ' +
                String(got).padStart(5) + '  ' +
                (tBuild.toFixed(1) + 's').padStart(8) + '  ' +
                (tBoq.toFixed(1) + 's').padStart(7) + '  ' +
                (tDraw.toFixed(2) + 's').padStart(7) + '   ' +
                String(kg === null ? '-' : kg).padStart(6) + '   ' + c.what);
  }
  await browser.close();
})();
