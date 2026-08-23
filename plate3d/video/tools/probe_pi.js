/* What weighing a circle as a circle actually moves.

   Curves are polygons here, so anything round has always weighed a little
   under: a 48-gon holds 99.71% of the circle it is inscribed in, a 32-gon hole
   removes 99.36% of the hole it stands for. Both errors are small and both
   point the same way, and until the DXF started exporting real circles they
   were at least consistent with the drawing.

   Now the drawing says circle, so the take-off has to as well. This weighs
   every shipped example on both engines and says which figures move and by how
   much - a change to what a customer is billed needs a number beside it, not a
   claim that it is small.

   The direction is fixed and worth checking: a round OUTLINE gains area, so a
   bar or a pipe gets heavier; a round HOLE removes more area, so a drilled
   plate gets lighter. A model with both moves whichever way it is made of.

     node probe_pi.js                                                         */
const ExcelJS = require('./node_modules/exceljs');
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const P3 = path.resolve(SP, '../..');

const BOOKS = ['PLATE3D_BASIC.xlsx', 'PLATE3D_SPLICE.xlsx', 'PLATE3D_TOWER.xlsx',
               'PLATE3D_PORTAL.xlsx', 'PLATE3D_SHOE.xlsx', 'PLATE3D_NODE.xlsx'];

/* and the round things, where the whole point shows */
const MADE = [
  { id: 'pipe',  rows: ['SECT', 'sc.t', 'SS400', 1000, 'P', 'mc', 48.6, 2.5],
    hand: (Math.PI / 4 * (48.6 * 48.6 - 43.6 * 43.6)) * 1000 * 7.85e-6,
    what: 'P-48.6x2.5   catalogue 2.84 kg/m' },
  { id: 'pipeL', rows: ['SECT', 'sc.t', 'SS400', 1000, 'P', 'mc', 216.3, 5.8],
    hand: (Math.PI / 4 * (216.3 * 216.3 - 204.7 * 204.7)) * 1000 * 7.85e-6,
    what: 'P-216.3x5.8  catalogue 30.1 kg/m' },
  { id: 'bar',   rows: ['BAR', 'bar.t', 'SS400', 48.6, 1000], bar: true,
    hand: (Math.PI / 4 * 48.6 * 48.6) * 1000 * 7.85e-6,
    what: 'BAR 48.6 solid' }
];

const LIB = f => {
  let p = SP + '/node_modules/three/build/three.min.js';
  if (f.includes('OrbitControls')) p = SP + '/node_modules/three/examples/js/controls/OrbitControls.js';
  if (f.includes('polybool')) p = SP + '/node_modules/polybooljs/dist/polybool.min.js';
  if (f.includes('exceljs')) p = SP + '/node_modules/exceljs/dist/exceljs.min.js';
  return fs.readFileSync(p, 'utf-8');
};

async function made(c) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('input');
  let r = 1;
  const put = a => { const row = ws.getRow(r++);
    a.forEach((v, i) => { if (v !== null) row.getCell(i + 2).value = v; }); };
  put(c.bar ? ['# BAR', 'id', 'mat', 'dia', 'length']
            : ['# SECT', 'id', 'mat', 'length', 'TYPE', 'base.pt',
               'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7']);
  put(c.rows);
  put(['# ASSY', 'id', 'ref', 'cmd', 'p1', 'p2', 'p3']);
  put(['ASSY', 'as.t', c.rows[1], 'ADD', 0, 0, 0]);
  put(['END']);
  const f = SP + '/probe/PI_' + c.id + '.xlsx';
  await wb.xlsx.writeFile(f);
  return f;
}

async function weighAll(host, files) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
           '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 },
                                       acceptDownloads: true });
  await page.route('**/{unpkg.com,cdnjs.cloudflare.com}/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: LIB(r.request().url()) }));
  await page.route('**/fonts.{googleapis,gstatic}.com/**', r => r.abort());
  await page.goto('file://' + P3 + '/tools/' + host, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const out = {};
  for (const f of files) {
    if (!fs.existsSync(f)) { out[path.basename(f)] = null; continue; }
    await page.setInputFiles('#pb-file', f);
    try {
      await page.waitForFunction(b => {
        const r = document.getElementById('pb-result');
        return r && r.innerText.indexOf(b) >= 0 && /Succeed/.test(r.innerText);
      }, path.basename(f), { timeout: 240000 });
    } catch (e) { out[path.basename(f)] = null; continue; }
    await page.waitForTimeout(900);
    try {
      const tmp = SP + '/.pi.xlsx';
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 240000 }),
                                      page.evaluate(() => plateBuilder.exportBOQ())]);
      await dl.saveAs(tmp);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(tmp);
      fs.unlinkSync(tmp);
      const ws = wb.getWorksheet('SUMMARY');
      let col = null, kg = null;
      ws.eachRow(row => {
        for (let i = 1; i <= 14 && col === null; i++)
          if (/weight\s*\(?kg/i.test(String(row.getCell(i).value || ''))) col = i;
        if (col === null) return;
        if (!/^total/i.test(String(row.getCell(1).value || '').trim())) return;
        let v = row.getCell(col).value;
        if (v && typeof v === 'object' && v.formula !== undefined) v = v.result;
        if (typeof v === 'number') kg = v;
      });
      out[path.basename(f)] = kg;
    } catch (e) { out[path.basename(f)] = null; }
  }
  await browser.close();
  return out;
}

(async () => {
  fs.mkdirSync(SP + '/probe', { recursive: true });
  const files = BOOKS.map(b => P3 + '/' + b);
  for (const c of MADE) files.push(await made(c));

  const now  = await weighAll('host_lock.html', files);
  const then = await weighAll('host_test.html', files);

  console.log('  book                    shipped kg        with pi        change');
  files.forEach(f => {
    const b = path.basename(f);
    const a = now[b], c = then[b];
    if (a === null || c === null || a === undefined || c === undefined) {
      console.log('  ' + b.padEnd(24) + '  (no weight)'); return;
    }
    const d = (c - a) / a * 100;
    console.log('  ' + b.padEnd(24) + String(a.toFixed(3)).padStart(11) + '  ' +
                String(c.toFixed(3)).padStart(13) + '   ' +
                (d >= 0 ? '+' : '') + d.toFixed(3) + '%');
  });
  console.log('');
  MADE.forEach(c => {
    const b = 'PI_' + c.id + '.xlsx';
    if (then[b] === null || then[b] === undefined) return;
    const off = (then[b] - c.hand) / c.hand * 100;
    console.log('  ' + c.what.padEnd(34) + then[b].toFixed(4) + ' vs ' +
                c.hand.toFixed(4) + ' by hand   ' +
                (off >= 0 ? '+' : '') + off.toFixed(4) + '%');
  });
})();
