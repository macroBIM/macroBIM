/* The workbooks the BAR & SECT film types its way through.

   Same rule as episode 01: every one is PLATE3D_BASIC.xlsx with a few cells
   changed, never a purpose-built model, because the film says "this is the
   example you can download" and a model that only exists inside the film would
   make that a lie.

   Each case declares what it expects and the script checks it against the real
   engine. Two of them are checks worth having:

     C23  Alpha 90 -> 0 must leave the weight identical to the decimal. Alpha
          turns a member about its own axis; it does not move it or cut it. If
          the number moves, the caption on that cut is false.

     C31  a CUT on a section. The engine takes it and the hole runs the whole
          length, which is the beat - and the weight is the only way to see it
          is really cutting rather than being counted and ignored.

     node make_barsect_cases.js            build, then verify
     node make_barsect_cases.js --build    build only                         */
const ExcelJS = require('./node_modules/exceljs');
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const OUT = SP + '/barsect';
const SRC = path.resolve(SP, '../..') + '/PLATE3D_BASIC.xlsx';
fs.mkdirSync(OUT, { recursive: true });

const C = { B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9, J: 10, K: 11, L: 12,
            M: 13, N: 14 };

/* Rows of PLATE3D_BASIC.xlsx these cases touch. Read off the file, not
   remembered - the verify pass is what will say so if the example is re-cut. */
const R = {
  scCol:   18,        // SECT sc.col SM490 3000 H mc  200 200 200 8 12 12 16
  hoLast:  12,        // last HOLE row (ho.pen) - a new HOLE goes after it
  cutLast: 33,        // last CUT row - new CUT rows go after it
  brc1:    59,        // MODULE md.bay sc.brc_1 ... 170 170
  str:     61         // MODULE md.bay sc.str   ... 110 110 90
};

/* Strip the sheet to two definitions and an ASSY that never mentions a module -
   the thing cut 30 is about. Verified before it went in the script: three ASSY
   rows, no MODULE row at all, and the panel reports modules 0 with six members
   placed. */
function bare(ws) {
  ws.spliceRows(2, ws.rowCount);
  let r = 2;
  const put = a => { const row = ws.getRow(r++);
    a.forEach((v, i) => { if (v !== null) row.getCell(i + 2).value = v; }); };
  put(['# BAR', 'id', 'mat', 'dia', 'length']);
  put(['BAR', 'bar.t', 'SS400', 24, 2000]);
  put(['# SECT', 'id', 'mat', 'length', 'TYPE', 'base.pt',
       'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7']);
  put(['SECT', 'sc.t', 'SM490', 1500, 'H', 'mc', 200, 200, 200, 8, 12, 12, 16]);
  put(['# ASSY', 'id', 'ref', 'cmd', 'p1', 'p2', 'p3', 'p4']);
  put(['ASSY', 'as.t', 'bar.t', 'ADD', 0, 0, 0]);
  put(['ASSY', 'as.t', 'sc.t', 'ADD', 600, 0, 0]);
  put(['ASSY', 'as.t', 'as.t', 'COPY', 0, 800, 0, 2]);
  put(['END']);
}

const CASES = [
  {
    id: 'c12', same: false,
    what: 'sc.col becomes a 1200-deep built-up girder',
    why: 'cut 12 - standard or custom, the same row',
    edit: ws => {
      const r = ws.getRow(R.scCol);
      [[C.H, 1200], [C.I, 400], [C.J, 400], [C.K, 12],
       [C.L, 25], [C.M, 25], [C.N, 0]].forEach(p => { r.getCell(p[0]).value = p[1]; });
    }
  },
  {
    id: 'c20', same: false,
    what: 'brace OFF_B / OFF_E 170 -> 0',
    why: 'cut 20 - the steel runs all the way to the node',
    edit: ws => {
      const r = ws.getRow(R.brc1);
      r.getCell(C.L).value = 0;
      r.getCell(C.M).value = 0;
    }
  },
  {
    id: 'c23', same: true,
    what: 'strut Alpha 90 -> 0',
    why: 'cut 23 - it turns and nothing else changes',
    /* The one case that must come back bit-identical. Alpha rotates a member
       about its own axis: the two points it spans do not move, the length does
       not change, no steel is removed. A different weight would mean the film
       is telling the viewer something the engine does not do. */
    edit: ws => { ws.getRow(R.str).getCell(C.N).value = 0; }
  },
  {
    id: 'c30', members: 6,
    what: 'a bar and a section into an ASSY, no MODULE',
    why: 'cut 30 - modules 0, and six members still stand',
    edit: ws => bare(ws)
  },
  {
    id: 'c31', same: false,
    what: 'two 14mm holes through the column top flange',
    why: 'cut 31 - a CUT edits the profile, and the profile runs the length',
    /* sc.col is H-200 about mc, so the section spans y -100..100 and its top
       flange, 16 thick, sits between 84 and 100. y 92 is the middle of it and
       x +-60 is clear of the 8mm web. The rows go in after the blocks they
       belong to, later ones first so the earlier row numbers stay valid. */
    edit: ws => {
      ws.spliceRows(R.cutLast + 1, 0, [], []);
      [[R.cutLast + 1, -60], [R.cutLast + 2, 60]].forEach(p => {
        const r = ws.getRow(p[0]);
        r.getCell(C.B).value = 'CUT';
        r.getCell(C.C).value = 'sc.col';
        r.getCell(C.D).value = p[1];
        r.getCell(C.E).value = 92;
        r.getCell(C.F).value = 'ho.14';
      });
      ws.spliceRows(R.hoLast + 1, 0, []);
      const h = ws.getRow(R.hoLast + 1);
      h.getCell(C.B).value = 'HOLE';
      h.getCell(C.C).value = 'ho.14';
      h.getCell(C.D).value = 'CIRC';
      h.getCell(C.E).value = 'mc';
      h.getCell(C.F).value = 14;
    }
  }
];

const LIB = f => {
  let p = SP + '/node_modules/three/build/three.min.js';
  if (f.includes('OrbitControls')) p = SP + '/node_modules/three/examples/js/controls/OrbitControls.js';
  if (f.includes('polybool')) p = SP + '/node_modules/polybooljs/dist/polybool.min.js';
  if (f.includes('exceljs')) p = SP + '/node_modules/exceljs/dist/exceljs.min.js';
  return fs.readFileSync(p, 'utf-8');
};

async function build() {
  for (const c of CASES) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(SRC);
    c.edit(wb.getWorksheet('input'));
    await wb.xlsx.writeFile(OUT + '/PLATE3D_' + c.id.toUpperCase() + '.xlsx');
    console.log('  ' + c.id.padEnd(6) + c.what);
  }
}

async function weigh(page, file) {
  await page.setInputFiles('#pb-file', file);
  await page.waitForFunction(b => {
    const r = document.getElementById('pb-result');
    return r && r.innerText.indexOf(b) >= 0 && /Succeed/.test(r.innerText);
  }, path.basename(file), { timeout: 300000 });
  await page.waitForTimeout(900);
  const txt = (await page.evaluate(() =>
    document.getElementById('pb-result').innerText)).trim();
  const line = txt.split('\n').filter(l => /placed \d+/.test(l)).pop() || '';

  const tmp = SP + '/.bs_boq.xlsx';
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }),
                                  page.evaluate(() => plateBuilder.exportBOQ())]);
  await dl.saveAs(tmp);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(tmp);
  fs.unlinkSync(tmp);
  const ws = wb.getWorksheet('SUMMARY');
  let col = null, kg = null;
  ws.eachRow(r => {
    for (let c = 1; c <= 14 && col === null; c++)
      if (/weight\s*\(?kg/i.test(String(r.getCell(c).value || ''))) col = c;
    if (col === null) return;
    if (!/^total/i.test(String(r.getCell(1).value || '').trim())) return;
    let v = r.getCell(col).value;
    if (v && typeof v === 'object' && v.formula !== undefined) v = v.result;
    if (typeof v === 'number') kg = v;
  });
  return { members: Number((line.match(/placed (\d+)/) || [])[1]),
           kg: kg === null ? null : Math.round(kg * 1000) / 1000 };
}

(async () => {
  await build();
  if (process.argv.includes('--build')) return;

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

  const base = await weigh(page, SRC);
  console.log('\n  BASIC  ' + String(base.members).padStart(3) + ' members  ' +
              String(base.kg).padStart(10) + ' kg   (the yardstick)\n');

  let bad = 0;
  for (const c of CASES) {
    const g = await weigh(page, OUT + '/PLATE3D_' + c.id.toUpperCase() + '.xlsx');
    const same = g.members === base.members && g.kg === base.kg;
    let verdict;
    if (c.members !== undefined)
      verdict = g.members === c.members ? c.members + ' members  OK'
                                        : 'want ' + c.members + ', got ' + g.members;
    else if (c.same) verdict = same ? 'identical to BASIC  OK' : 'CHANGED - must not';
    else if (g.members !== base.members) verdict = 'member count moved - should not';
    else verdict = (g.kg > base.kg ? '+' : '') +
                   (Math.round((g.kg - base.kg) * 1000) / 1000) + ' kg';
    if (/must|should|want/.test(verdict)) bad++;
    console.log('  ' + c.id.padEnd(6) + String(g.members).padStart(3) + ' members  ' +
                String(g.kg).padStart(10) + ' kg   ' + verdict);
    if (/must|should|want/.test(verdict)) console.log('         ' + c.why);
  }
  await browser.close();
  console.log('\n' + (bad ? bad + ' case(s) wrong - do not shoot these'
                          : 'all ' + CASES.length + ' cases behave as the script says'));
  process.exitCode = bad ? 1 : 0;
})();
