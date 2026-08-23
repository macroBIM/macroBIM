/* SECT P and R - do the new hollow types weigh what they should?

   Each case carries its area worked out by hand, and where the shape is a real
   catalogue item the published kg/m sits beside it. The published figure is the
   one that matters: a take-off is only worth having if a scaffold tube called
   48.6x2.5 comes out at the 2.84 kg/m every rental sheet in the country prints.

   Curves are polygonised, so the app is expected to read a little UNDER, never
   over: 48 segments on a circle is 0.29% light, and SECT_SEG=8 per quarter on a
   corner is a rounding error next to that. Anything over, or anything more than
   half a percent under, is a bug and not a tessellation.

     node probe_sect_pr.js                                                    */
const ExcelJS = require('./node_modules/exceljs');
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const OUT = SP + '/probe';
fs.mkdirSync(OUT, { recursive: true });

const LEN = 1000, RHO = 7.85e-6;
const K = 4 - Math.PI;                       // area a full corner rounding removes
const circ = d => Math.PI / 4 * d * d;
const rect = (h, b, r) => h * b - K * r * r;

/* type, the values as they go on the row, area by hand, and the catalogue */
const CASES = [
  { id: 'p1', type: 'P', v: [48.6, 2.5],
    A: circ(48.6) - circ(48.6 - 5), book: 2.84,
    what: 'P-48.6x2.5   scaffold tube' },
  { id: 'p2', type: 'P', v: [216.3, 5.8],
    A: circ(216.3) - circ(216.3 - 11.6), book: 30.1,
    what: 'P-216.3x5.8  STK400 pipe' },
  { id: 'r1', type: 'R', v: [100, 100, 6, 12],
    A: rect(100, 100, 12) - rect(88, 88, 6), book: 17.0,
    what: 'R-100x100x6  square, r12' },
  { id: 'r2', type: 'R', v: [150, 100, 6, 12],
    A: rect(150, 100, 12) - rect(138, 88, 6), book: 21.7,
    what: 'R-150x100x6  rectangular' },
  { id: 'r3', type: 'R', v: [100, 100, 6, 0],
    A: rect(100, 100, 0) - rect(88, 88, 0), book: null,
    what: 'R-100x100x6  r blank = square corner' },
  { id: 'r4', type: 'R', v: [100, 100, 6, 4],
    A: rect(100, 100, 4) - rect(88, 88, 0), book: null,
    what: 'R-100x100x6  r4 < t, so the bore is square' },
  { id: 'a1', type: 'PIPE', v: [48.6, 2.5],
    A: circ(48.6) - circ(43.6), book: 2.84,
    what: 'TYPE "PIPE" must read as P' },
  { id: 'a2', type: 'SHS', v: [100, 100, 6, 12],
    A: rect(100, 100, 12) - rect(88, 88, 6), book: 17.0,
    what: 'TYPE "SHS" must read as R' }
];

/* rows the engine must refuse outright */
const BAD = [
  { id: 'x1', type: 'P', v: [50, 25],       why: 'wall meets in the middle' },
  { id: 'x2', type: 'R', v: [100, 100, 50], why: '2t = h' },
  { id: 'x3', type: 'R', v: [100, 100, 6, 60], why: 'r past half the width' },
  { id: 'x4', type: 'P', v: [48.6, 0],      why: 'no wall' }
];

async function book(c) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('input');
  let r = 1;
  const put = a => { const row = ws.getRow(r++);
    a.forEach((v, i) => { if (v !== null) row.getCell(i + 2).value = v; }); };
  put(['# SECT', 'id', 'mat', 'length', 'TYPE', 'base.pt',
       'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7']);
  put(['SECT', 'sc.t', 'SS400', LEN, c.type, 'mc'].concat(c.v));
  put(['# ASSY', 'id', 'ref', 'cmd', 'p1', 'p2', 'p3']);
  put(['ASSY', 'as.t', 'sc.t', 'ADD', 0, 0, 0]);
  put(['END']);
  const f = OUT + '/PR_' + c.id.toUpperCase() + '.xlsx';
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

/* Wait on the file name alone, not on a verdict word. A row the engine
   refuses leaves a panel that says neither Succeed nor Failed - it says what
   was wrong with the row - and waiting for one of those words is how the first
   run of this script sat for three minutes on a case that had already
   answered. */
async function load(page, file) {
  await page.setInputFiles('#pb-file', file);
  await page.waitForFunction(b => {
    const r = document.getElementById('pb-result');
    return r && r.innerText.indexOf(b) >= 0;
  }, path.basename(file), { timeout: 60000 });
  await page.waitForTimeout(1200);
  return (await page.evaluate(() =>
    document.getElementById('pb-result').innerText)).trim();
}

async function weigh(page) {
  const tmp = SP + '/.pr.xlsx';
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }),
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
  return kg;
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

  let bad = 0;
  console.log('  case  shape                                   app kg/m   by hand   diff     catalogue');
  for (const c of CASES) {
    const txt = await load(page, await book(c));
    if (!/Succeed/.test(txt)) {
      console.log('  ' + c.id + '   ' + c.what.padEnd(38) + ' REFUSED - ' +
                  (txt.split('\n').filter(l => /—|--/.test(l)).pop() || '').slice(0, 60));
      bad++; continue;
    }
    const kg = await weigh(page);
    const hand = c.A * LEN * RHO;
    const d = (kg - hand) / hand * 100;
    const cat = c.book === null ? '' :
      (Math.abs(kg - c.book) / c.book * 100).toFixed(1) + '% off ' + c.book;
    const ok = d <= 0.02 && d > -0.6;
    if (!ok) bad++;
    console.log('  ' + c.id + '   ' + c.what.padEnd(38) +
                kg.toFixed(3).padStart(9) + ' ' + hand.toFixed(3).padStart(9) + '  ' +
                (d >= 0 ? '+' : '') + d.toFixed(2) + '%' + (ok ? '  ' : ' !') +
                '   ' + cat);
  }

  console.log('\n  rows that must be refused');
  for (const c of BAD) {
    const txt = await load(page, await book(c));
    const refused = !/Succeed/.test(txt) || /placed 0/.test(txt);
    if (!refused) bad++;
    const msg = (txt.split('\n').filter(l => /—/.test(l)).pop() || '').trim();
    console.log('  ' + c.id + '   ' + c.why.padEnd(26) +
                (refused ? 'refused   ' : 'ACCEPTED - WRONG   ') +
                msg.replace(/^.*—\s*/, '').slice(0, 62));
  }
  await browser.close();
  console.log('\n' + (bad ? bad + ' wrong' : 'every case within tessellation, every bad row refused'));
  process.exitCode = bad ? 1 : 0;
})();
