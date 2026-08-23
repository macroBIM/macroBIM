/* Lock what the app hands to a customer.

   The formats are a promise now: a take-off with its columns reordered, a DXF
   with a renamed layer or a dimension style that moved breaks work someone has
   already done. Those changes are cheap to make by accident and expensive to
   notice - the take-off drifted once and was caught by eye, in a video, weeks
   later.

   So the shape of every output is fingerprinted and the fingerprint is
   committed. Shape, not content:

     locked      sheet names and order, column order and headings, layer names,
                 entity kinds, block banners, the file-name rule, every
                 dimension-style constant, the keyword grammar
     not locked  weights, member counts, part ids, row counts, timestamps -
                 everything that moves when the model moves

   Locking the numbers would fail on every honest edit, and a check that always
   fails is a check nobody reads.

     node tools/lock_format.js            compare, and exit 1 if anything moved
     node tools/lock_format.js --update   accept what is there now              */
const { chromium } = require('playwright-core');
const ExcelJS = require('./node_modules/exceljs');
const fs = require('fs');
const path = require('path');

const P3 = path.resolve(__dirname, '..');
const SP = __dirname;
const LOCK = P3 + '/FORMAT_LOCK.json';
const UPDATE = process.argv.includes('--update');

/* Two books, because no single one reaches every block. BASIC is every keyword
   once and drives ASSEMBLY / MODULE / PART; SPLICE is the one that names its
   own drawings, so it is the only way to reach the VIEWS block - and with it
   the hidden-line layer, which nothing else produces. */
const BOOKS = ['PLATE3D_BASIC.xlsx', 'PLATE3D_SPLICE.xlsx'];
const SCALES = { assembly: '50', module: '20', part: '10', views: '10' };

const LIB = f => {
  let p = SP + '/node_modules/three/build/three.min.js';
  if (f.includes('OrbitControls')) p = SP + '/node_modules/three/examples/js/controls/OrbitControls.js';
  if (f.includes('polybool')) p = SP + '/node_modules/polybooljs/dist/polybool.min.js';
  if (f.includes('exceljs')) p = SP + '/node_modules/exceljs/dist/exceljs.min.js';
  return fs.readFileSync(p, 'utf-8');
};

/* ---- what counts as content rather than shape ---- */
const isNum = v => v !== '' && !isNaN(Number(String(v).replace(/,/g, '')));
function normalise(t) {
  return String(t)
    .replace(/\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?/g, '<when>')
    .replace(/[A-Za-z0-9_.\-]+\.xlsx/gi, '<book>')
    .trim();
}

/* ---- the take-off ---- */
async function boqShape(file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  return wb.worksheets.map(ws => {
    const labels = [];
    ws.eachRow(r => {
      const cells = [];
      for (let c = 1; c <= 14; c++) {
        let v = r.getCell(c).value;
        if (v && typeof v === 'object' && v.formula !== undefined)
          v = v.result !== undefined ? v.result : '';
        cells.push(v == null ? '' : String(v));
      }
      while (cells.length && cells[cells.length - 1] === '') cells.pop();
      const filled = cells.filter(Boolean);
      // a row of words is a heading or a table header - a row with numbers in
      // it is data, and data is the model's business, not the format's
      if (filled.length && !filled.some(isNum)) labels.push(cells.map(normalise).join(' | '));
    });
    return { sheet: ws.name, cols: ws.columnCount, labels: labels };
  });
}

/* ---- the drawing ---- */
function dxfShape(text) {
  const L = text.split(/\r?\n/);
  const layers = new Set(), kinds = new Set(), banners = [];
  let inEnt = false, cur = null;
  for (let i = 0; i < L.length - 1; i += 2) {
    const code = L[i].trim(), val = L[i + 1].trim();
    if (code === '2' && val === 'ENTITIES') { inEnt = true; continue; }
    if (code === '2' && val === 'OBJECTS') inEnt = false;
    if (!inEnt) continue;
    if (code === '0') cur = val;
    if (code === '0' && /^(LINE|CIRCLE|ARC|SOLID|TEXT|MTEXT|LWPOLYLINE|INSERT|DIMENSION)$/.test(val))
      kinds.add(val);
    if (code === '8') layers.add(val);
    // the banner each block writes at its own top - "VIEWS 1:10"
    if (code === '1' && cur === 'TEXT' && /^\s*(ASSEMBLY|MODULES?|PARTS?|VIEWS)\b.*1:/i.test(val))
      banners.push(val.replace(/1:\s*\d+/, '1:<scale>').trim());
  }
  return { layers: [...layers].sort(), entities: [...kinds].sort(),
           banners: [...new Set(banners)].sort() };
}

/* ---- the keyword grammar, as the app itself states it ---- */
async function grammarShape(page) {
  return page.evaluate(() => {
    plateBuilder.openGuide();
    const out = [];
    document.querySelectorAll('#pb-help table.xls').forEach(t => {
      const rows = [...t.querySelectorAll('tr')].map(tr =>
        [...tr.children].map(td => td.textContent.trim()).join(' '));
      if (rows.length) out.push(rows);
    });
    plateBuilder.closeGuide();
    return out;
  });
}

/* ---- compare ---- */
function walk(a, b, at, hits) {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A === B) return;
  if (Array.isArray(a) && Array.isArray(b)) {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) walk(a[i], b[i], at + '[' + i + ']', hits);
    return;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    [...new Set([...Object.keys(a), ...Object.keys(b)])]
      .forEach(k => walk(a[k], b[k], at + '.' + k, hits));
    return;
  }
  hits.push({ at: at, was: a, now: b });
}

async function fingerprintBook(page, book) {
  const out = {};
  await page.setInputFiles('#pb-file', P3 + '/' + book);
  await page.waitForFunction(b => {
    const r = document.getElementById('pb-result');
    return r && r.innerText.indexOf(b) >= 0 && /Succeed/.test(r.innerText);
  }, book, { timeout: 300000 });
  await page.waitForTimeout(1200);

  const tmp = SP + '/.lock_boq.xlsx';
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }),
                                  page.evaluate(() => plateBuilder.exportBOQ())]);
  await dl.saveAs(tmp);
  out.boq = await boqShape(tmp);
  out.boqName = dl.suggestedFilename().replace(/^.*?(_BOQ\.xlsx)$/, '<book>$1');
  fs.unlinkSync(tmp);

  /* The file is caught where the app hands it over. The anchor it saves through
     is never put in the document, so the name has to be read off the click
     rather than found in the DOM. */
  await page.evaluate(() => {
    const o = URL.createObjectURL.bind(URL);
    URL.createObjectURL = bl => { window.__b = bl; return o(bl); };
    window.__b = null; window.__name = null;
    const c = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) window.__name = this.download;
      return c.apply(this, arguments);
    };
  });
  await page.click('#pb-fmenu > button');
  await page.waitForTimeout(200);
  await page.click('#pb-fmenu .drop button:nth-of-type(2)');       // Save DXF
  await page.waitForTimeout(300);
  /* A block whose input sheet names nothing is offered greyed out - VIEWS is
     only there when the sheet asked for drawings. Which blocks a given sheet
     can produce is itself part of the format, so it is recorded rather than
     forced. */
  out.dxfBlocks = {};
  for (const k of Object.keys(SCALES)) {
    const on = await page.evaluate(id => {
      const c = document.getElementById('pb-sc-' + id);
      if (!c) return null;
      if (!c.disabled && !c.checked) c.click();
      return c.disabled ? 'unavailable' : c.checked;
    }, k);
    out.dxfBlocks[k] = on;
    if (on === true) await page.fill('#pb-sc-' + k + '-v', SCALES[k]);
  }
  await page.click('#pb-scale .accent');
  await page.waitForFunction(() => !!window.__b, null, { timeout: 900000 });
  out.dxf = dxfShape(await page.evaluate(() => window.__b.text()));
  // plate_builder_A50-M20-P10.dxf - the stem is fixed, the scales are not
  let name = await page.evaluate(() => window.__name);
  if (name) name = name.replace(/([AMPV])\d+/g, '$1<scale>');
  out.dxfName = name;
  return out;
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
           '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 },
                                       acceptDownloads: true });
  await page.route('**/{unpkg.com,cdnjs.cloudflare.com}/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: LIB(r.request().url()) }));
  await page.route('**/fonts.{googleapis,gstatic}.com/**', r => r.abort());
  /* the shipped engine, which is what the lock is a promise about. ENGINE=test
     points at the other one so a change can be held against the lock BEFORE it
     is promoted - the answer wanted there is "format unchanged", and getting it
     after the sync instead of before is getting it too late. --update is
     refused in that mode: the lock must never be written from a build nobody
     has received. */
  const HOST = process.env.ENGINE === 'test' ? 'host_test.html' : 'host_lock.html';
  if (process.env.ENGINE === 'test' && UPDATE) {
    console.log('--update reads the shipped engine only; drop ENGINE=test');
    process.exitCode = 1;
    await browser.close();
    return;
  }
  await page.goto('file://' + SP + '/' + HOST, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const now = { books: {} };

  /* model-independent: the annotation style at 1:1 and scaled, so both the
     constants and the rule that multiplies them are held, and the keyword
     grammar as the app itself states it */
  now.dimstyle = await page.evaluate(() => ({
    base: plateBuilder.dimStyleBase,
    at50: plateBuilder.dimStyle(50)
  }));
  now.grammar = await grammarShape(page);

  for (const book of BOOKS) {
    now.books[book] = await fingerprintBook(page, book);
    console.log('  read ' + book);
  }
  await browser.close();

  if (UPDATE || !fs.existsSync(LOCK)) {
    fs.writeFileSync(LOCK, JSON.stringify(now, null, 1));
    console.log((fs.existsSync(LOCK) ? 'wrote ' : 'created ') + path.relative(P3, LOCK));
    Object.keys(now.books).forEach(function (b) {
      const f = now.books[b];
      console.log('  ' + b);
      console.log('    boq      ' + f.boq.map(x => x.sheet).join(' · '));
      console.log('    layers   ' + f.dxf.layers.join(' '));
      console.log('    blocks   ' + Object.keys(f.dxfBlocks)
        .map(k => k + '=' + f.dxfBlocks[k]).join(' '));
    });
    console.log('  dimstyle  ' + Object.keys(now.dimstyle.base).length + ' constants');
    console.log('  grammar   ' + now.grammar.length + ' keyword tables');
    return;
  }

  const was = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
  const hits = [];
  walk(was, now, '', hits);
  if (!hits.length) {
    console.log('format unchanged  ·  ' + Object.keys(now.books).length + ' books · ' +
                Object.keys(now.dimstyle.base).length + ' dimstyle constants · ' +
                now.grammar.length + ' keyword tables');
    return;
  }
  console.log('FORMAT CHANGED  ·  ' + hits.length + (hits.length > 1 ? ' differences' : ' difference') + '\n');
  hits.slice(0, 40).forEach(h => {
    console.log('  ' + h.at.replace(/^\./, ''));
    console.log('    was  ' + JSON.stringify(h.was));
    console.log('    now  ' + JSON.stringify(h.now));
  });
  if (hits.length > 40) console.log('  … and ' + (hits.length - 40) + ' more');
  console.log('\nIf this was meant, run with --update and say why in the commit.');
  process.exitCode = 1;
})();
