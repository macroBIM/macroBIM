/* Simple connector, put through the real engine.

       node tools/check_simpleconn.js

   The form does not hand anyone a workbook: it builds the rows in the browser
   and posts them straight into the viewer. So nothing about it is covered by
   the sample-book checks, and the one thing a person will press first - Save
   DXF - is exactly the thing nobody has run.

   Rows come from column_model.js, the same copy the .xlsx generator uses, so
   this tests what the form actually sends. Every connection type is built,
   because the row set changes with it.

   What has to hold:

     · the sheet builds with no errors and places members
     · Save DXF comes back with a drawing in it - which needs VIEW or PLOT
       rows, since a drawing is only made because a row asked for one
     · Save BOQ comes back
*/
const { chromium } = require('playwright-core');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const P3 = path.resolve(__dirname, '..');
const SP = __dirname;
const DESIGN = path.resolve(P3, '..', '..', 'design');
const CM = require('../column_model.js');

function csv(file) {
  const ln = fs.readFileSync(path.join(DESIGN, file), 'utf8')
    .replace(/^﻿/, '').split(/\r?\n/).filter(s => s.trim());
  const head = ln[0].split(',').map(s => s.trim());
  return ln.slice(1).map(l => { const f = l.split(','), o = {};
    head.forEach((h, i) => { o[h] = (f[i] || '').trim(); }); return o; });
}
const USER = 'user define';
const HS = [[USER, '', '', '', '', '', '']].concat(
  csv('hsection.csv').filter(r => r['KS규격여부'] === 'O')
    .map(r => [`H-${r.H}x${r.B}x${r.t1}x${r.t2} r${r.r}`,
               +r.H, +r.B, +r.t1, +r.t2, +r.r, +r['단위무게']]));
const TB = [[USER, '', '', '', '', '', '']].concat(
  csv('squaretube.csv').map(r => [`R-${r['호칭치수']} r${r.r}`,
               +r.A, +r.B, +r.t, +r.t, +r.r, +r['단위무게']]));
const cat = { HS, TB,
  findH: k => HS.find(s => s[0] === k) || HS[1],
  findT: k => TB.find(s => s[0] === k) || TB[1] };

const LIB = f => {
  let p = SP + '/node_modules/three/build/three.min.js';
  if (f.includes('OrbitControls')) p = SP + '/node_modules/three/examples/js/controls/OrbitControls.js';
  if (f.includes('polybool')) p = SP + '/node_modules/polybooljs/dist/polybool.min.js';
  if (f.includes('exceljs')) p = SP + '/node_modules/exceljs/dist/exceljs.min.js';
  return fs.readFileSync(p, 'utf-8');
};
const countOf = (dxf, kind) =>
  !dxf ? 0 : (dxf.match(new RegExp('^\\s*' + kind + '\\s*$', 'gm')) || []).length;

let bad = 0, checks = 0;
const ok = (c, what, d) => {
  checks++;
  if (c) { console.log('  ok    ' + what); return; }
  bad++;
  console.log('  FAIL  ' + what + (d ? '  [' + d + ']' : ''));
};

/* CTYPE is the COLUMN's section - H or a square tube - and it is the axis the
   row set really turns on: a tube has no inner or web plates and none of the
   bolts that hold them. The connection marks C1..C6 are per beam, and the
   defaults already carry a mix of them. */
const CASES = [['H  (default)', {}], ['R  (tube column)', { CTYPE: 'R' }]];

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

  console.log('column             rows  placed        kg   DXF lines   BOQ');
  for (const [t, over] of CASES) {
    const V = CM.defaults(over, cat);
    const rows = CM.values(CM.build(V, cat).rows);
    /* Column A of these rows is the annotation column, exactly as in the
       workbook, so the keyword is the first cell that IS one. */
    const KW = ['COORD','SECT','PLATE','HOLE','CUT','BAR','BOLT','MODULE','ASSY',
                'VIEW','PLOT','FIT','END'];
    const kws = {};
    rows.forEach(r => {
      for (let i = 0; i < 2; i++) {
        const k = String(r[i] === undefined || r[i] === null ? '' : r[i]).trim().toUpperCase();
        if (KW.indexOf(k) >= 0) { kws[k] = (kws[k] || 0) + 1; return; }
      }
    });

    page.__alert = null;
    const built = await page.evaluate(async rows => {
      window.__b = null;
      const on = e => { if (e.data && e.data.plate3d === 'built') window.__b = e.data; };
      window.addEventListener('message', on);
      window.postMessage({ plate3d: 'rows', rows: rows, name: 'Simple connector' }, '*');
      await new Promise(res => setTimeout(res, 3000));
      window.removeEventListener('message', on);
      const tot = document.getElementById('pb-total');
      const m = (tot ? tot.innerText : '').match(/Placed members:\s*(\d+).*?Total weight:\s*([\d.]+)/s);
      return { built: window.__b,
               placed: m ? +m[1] : -1, kg: m ? +m[2] : -1,
               panel: ((document.getElementById('pb-result') || {}).innerText || '')
                        .replace(/\n/g, ' | ') };
    }, rows);

    const grab = async cmd => {
      page.__alert = null;
      await page.evaluate(() => {
        const o = URL.createObjectURL.bind(URL);
        URL.createObjectURL = bl => { window.__f = bl; return o(bl); };
        window.__f = null;
      });
      await page.evaluate(c => plateBuilder[c](), cmd);
      try {
        await page.waitForFunction(() => !!window.__f, null, { timeout: 45000 });
        return await page.evaluate(() => window.__f.size);
      } catch (e) { return 0; }
    };
    const dxfSize = await grab('exportDXF');
    const dxfAlert = page.__alert;
    let dxf = null;
    if (dxfSize) dxf = await page.evaluate(() => window.__f.text());
    const boqSize = await grab('exportBOQ');

    console.log('  ' + t.padEnd(18) + String(rows.length).padStart(4) +
      String(built.placed).padStart(8) + String(built.kg).padStart(10) +
      String(countOf(dxf, 'LINE')).padStart(12) + '   ' + (boqSize ? 'yes' : 'NO'));
    console.log('      keywords: ' +
      KW.filter(k => kws[k]).map(k => k + ' ' + kws[k]).join(' · '));
    /* Anything the parser complained about, which is where a row shape that
       has moved on since this was written would show up. */
    const warn = (built.panel.match(/row \d+:[^|]+/g) || []).map(w => w.trim());
    if (warn.length) console.log('      ' + warn.slice(0, 6).join('\n      '));
    ok(warn.length === 0, t + ': no row is refused or complained about',
       warn.slice(0, 3).join(' / '));

    ok(built.built && built.built.errors === 0 && built.placed > 0,
       t + ': the sheet builds and places members',
       built.panel.slice(0, 260));
    ok(countOf(dxf, 'LINE') > 0, t + ': Save DXF comes back with a drawing',
       dxfAlert ? 'alert: ' + dxfAlert.replace(/\n+/g, ' ').slice(0, 160)
                : 'no entities');
    ok(boqSize > 0, t + ': Save BOQ comes back');
    ok(!!(kws.VIEW || kws.PLOT), t + ': the sheet asks for at least one drawing',
       'no VIEW and no PLOT row — a drawing is only made because a row asked');
  }

  /* The form and PLATE3D_COLUMN.xlsx are built by ONE copy of the model, and
     that is the only thing making them agree. Nothing enforced it, and they
     had already come apart: the workbook carried three drawing rows the model
     did not emit, so the form drew nothing — and regenerating the workbook
     would have quietly dropped them from there too. Compared here row for
     row, in values, because that is what the engine reads either way. */
  console.log('');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(P3, 'PLATE3D_COLUMN.xlsx'));
  const ws = wb.worksheets.filter(w => String(w.name).toLowerCase() === 'input')[0];
  /* Compared as FORMULAS, not as values. A formula whose cached answer is 0
     or blank is stored by Excel with no cached answer at all, so reading the
     book by value turns those cells into nothing and every such row looks
     like a difference. The workbook is written from the model's formulas, so
     that is the thing the two actually share. */
  const norm = c => {
    if (c === null || c === undefined) return '';
    if (typeof c === 'object') {
      if (c.formula !== undefined) return '=' + c.formula;
      if (c.sharedFormula !== undefined) return '=' + c.sharedFormula;
      if (c.richText) return c.richText.map(t => t.text).join('');
      if (c.result !== undefined) return String(c.result);
      if (c.text !== undefined) return String(c.text);
      return JSON.stringify(c);
    }
    return String(c);
  };
  const clean = r => { const o = r.map(norm);
    while (o.length && o[o.length - 1] === '') o.pop(); return o; };
  const book = [];
  ws.eachRow({ includeEmpty: false }, r => {
    const t = clean((r.values || []).slice(2));   // column A is the annotation
    if (t.length) book.push(t);
  });
  const form = CM.build(CM.defaults({}, cat), cat).rows
    .map(r => clean((r.cells || []).map(c =>
      (c && typeof c === 'object' && c.f !== undefined) ? { formula: c.f } : c)))
    .filter(r => r.length);

  let diff = '';
  for (let i = 0; i < Math.max(book.length, form.length); i++) {
    const a = (form[i] || []).join(' | '), b = (book[i] || []).join(' | ');
    if (a === b) continue;
    diff = 'row ' + (i + 1) + '\n          form: ' + (a || '(none)').slice(0, 150) +
           '\n          book: ' + (b || '(none)').slice(0, 150);
    break;
  }
  ok(!diff, 'the form sends exactly what PLATE3D_COLUMN.xlsx holds',
     'form ' + form.length + ' rows, book ' + book.length + ' rows\n        ' + diff);

  if (errs.length) { bad++; console.log('\npage errors:\n  ' + errs.join('\n  ')); }
  console.log('\n' + checks + ' checks · ' + (bad ? bad + ' FAILED' : 'all pass'));
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
