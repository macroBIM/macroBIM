/* Does a VIEW row given as angles draw what the named view draws?

       node tools/check_view3d_dxf.js

   check_view3d.js holds the arithmetic - that AZ / EL rebuilds the six named
   direction triples exactly. This holds the thing that actually matters to
   somebody using it: that `VIEW md.wpl 3D -90 0` and `VIEW md.wpl FRONT` come
   out of the real engine as THE SAME DXF, byte for byte, and not as two
   drawings that merely look alike.

   Everything is driven through the app the way a person drives it - a workbook
   into the file input, Save DXF, the VIEWS block ticked - because the parser,
   the subject lookup and the projection are all on that path and a unit test
   of the maths alone would pass with any of them broken.

   PLATE3D_SPLICE.xlsx is the subject: it is the sample that names its own
   drawings, so its VIEW rows can be swapped for the ones under test. */
const { chromium } = require('playwright-core');
const ExcelJS = require('./node_modules/exceljs');
const fs = require('fs');
const path = require('path');

const P3 = path.resolve(__dirname, '..');
const SP = __dirname;
const BOOK = P3 + '/PLATE3D_SPLICE.xlsx';
const OUT = process.env.TMPDIR || '/tmp';
const KEEP = process.argv.includes('--keep');

const LIB = f => {
  let p = SP + '/node_modules/three/build/three.min.js';
  if (f.includes('OrbitControls')) p = SP + '/node_modules/three/examples/js/controls/OrbitControls.js';
  if (f.includes('polybool')) p = SP + '/node_modules/polybooljs/dist/polybool.min.js';
  if (f.includes('exceljs')) p = SP + '/node_modules/exceljs/dist/exceljs.min.js';
  return fs.readFileSync(p, 'utf-8');
};

/* The rows each variant puts in place of the book's own five VIEW rows. Every
   drawing is titled SUBJECT, because a title is written into the DXF and two
   files can only be compared byte for byte if the only thing that differs
   between them is the thing under test. */
const N = null;                       // an empty cell, which is not a zero
const VARIANTS = {
  //        VIEW   id           dir       AZ    EL  scale  title
  named:  [['VIEW', 'md.wpl', 'FRONT',   N,    N,    10, 'SUBJECT']],
  angles: [['VIEW', 'md.wpl', '3D',    -90,    0,    10, 'SUBJECT']],
  lower:  [['VIEW', 'md.wpl', '3d',    -90,    0,    10, 'SUBJECT']],
  top:    [['VIEW', 'md.wpl', 'TOP',     N,    N,    10, 'SUBJECT']],
  topAng: [['VIEW', 'md.wpl', '3D',      0,   90,    10, 'SUBJECT']],
  iso:    [['VIEW', 'md.wpl', 'ISO',     N,    N,    10, 'SUBJECT']],
  isoSE:  [['VIEW', 'md.wpl', 'ISO-SE',  N,    N,    10, 'SUBJECT']],
  isoUnd: [['VIEW', 'md.wpl', 'ISO_SE',  N,    N,    10, 'SUBJECT']],
  isoNE:  [['VIEW', 'md.wpl', 'ISO-NE',  N,    N,    10, 'SUBJECT']],
  assy:   [['VIEW', 'as.splice', 'ISO',  N,    N,    10, 'SUBJECT']],
  scaled: [['VIEW', 'md.wpl', 'FRONT',   N,    N,    50, 'SUBJECT']],
  // the parts, asked for by a different word because they are a different thing
  plotAll:  [['PLOT', 'PART', 'ALL', 10]],
  /* The splice sample is all plate - no rolled section anywhere in it - so
     asking it for sections has to come back with nothing, and say so rather
     than write an empty file. The sections themselves are tested on PORTAL,
     which has six. */
  plotSect: [['PLOT', 'SECT', 'ALL', 10]],
  plotBoth: [['PLOT', 'PART', 'ALL', 10], ['PLOT', 'SECT', 'ALL', 10]],
  mixed:  [['VIEW', 'md.wpl', 'FRONT',   N,    N,    10, 'SUBJECT'],
           ['PLOT', 'PART', 'ALL', 10]],
  none:   [],                                        // a sheet that asks for nothing
  bad:    [['VIEW', 'md.wpl', 'SIDEWAYS', N,   N,    10, 'nowhere'],
           ['VIEW', 'md.wpl', '3D',    -90,  120,    10, 'over the pole'],
           ['VIEW', 'md.wpl', 'TOP',   -45,   35,    10, 'written the old way'],
           ['VIEW', 'md.wpl', 'ISO',     N,    N,     N, 'no scale'],
           ['PLOT', 'CHEESE', 'ALL', 10],
           ['VIEW', 'md.wpl', 'FRONT',   N,    N,    10, 'SUBJECT']]
};
const KEY_COL = 2;                             // column B holds the keyword

/* The variant's rows go into a copy of a real book, immediately before its END,
   and whatever drawing rows the book already had are blanked first. Finding END
   rather than naming row numbers is what lets a second book be used for the
   sections - and it was a hardcoded list of five rows that quietly dropped the
   sixth row of a six-row variant, which is a test passing by not running. */
async function makeBook(book, name, rows) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(book);
  const ws = wb.getWorksheet('input');
  let endRow = null;
  const kw = r => String((ws.getRow(r).getCell(KEY_COL).value) || '').toUpperCase();
  for (let r = 1; r <= ws.rowCount; r++) {
    if (kw(r) === 'END') { endRow = r; break; }
    if (kw(r) === 'VIEW' || kw(r) === 'PLOT') {
      const row = ws.getRow(r);
      for (let c = KEY_COL; c <= KEY_COL + 8; c++) row.getCell(c).value = null;
      row.commit();
    }
  }
  if (!endRow) throw new Error(book + ' has no END row');
  rows.forEach(function (r, i) {
    const row = ws.insertRow(endRow + i, []);
    // a null in a variant is an EMPTY cell, which is not the same as a zero;
    // telling those apart is half of what these rows are testing
    r.forEach(function (v, j) { if (v !== null) row.getCell(KEY_COL + j).value = v; });
    row.commit();
  });
  const f = path.join(OUT, 'view3d_' + name + '.xlsx');
  await wb.xlsx.writeFile(f);
  return f;
}

// the entity geometry, with the header and anything dated left out
function bodyOf(dxf) {
  const i = dxf.indexOf('ENTITIES');
  return i < 0 ? dxf : dxf.slice(i);
}
const countOf = (dxf, kind) =>
  !dxf ? 0 : (bodyOf(dxf).match(new RegExp('^\\s*' + kind + '\\s*$', 'gm')) || []).length;

async function drawWith(page, file) {
  await page.setInputFiles('#pb-file', file);
  await page.waitForFunction(b => {
    const r = document.getElementById('pb-result');
    return r && r.innerText.indexOf(b) >= 0 && /Succeed|Failed|error/i.test(r.innerText);
  }, path.basename(file), { timeout: 300000 });
  await page.waitForTimeout(900);
  const report = await page.evaluate(() =>
    (document.getElementById('pb-result') || {}).innerText || '');

  await page.evaluate(() => {
    const o = URL.createObjectURL.bind(URL);
    URL.createObjectURL = bl => { window.__b = bl; return o(bl); };
    window.__b = null;
    const c = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { return c.apply(this, arguments); };
  });
  /* Nothing is asked before the file is written any more - every drawing came
     from a row that carried its own scale. A sheet that names no drawing says
     so in an alert, which is caught here rather than left to hang the run. */
  var alerted = null;
  var onDialog = function (d) { alerted = d.message(); d.dismiss(); };
  page.on('dialog', onDialog);
  await page.click('#pb-fmenu > button');
  await page.waitForTimeout(150);
  await page.click('#pb-fmenu .drop button:nth-of-type(2)');       // Save DXF
  var dxf = null;
  try {
    await page.waitForFunction(() => !!window.__b, null, { timeout: 240000 });
    dxf = await page.evaluate(() => window.__b.text());
  } catch (e) { /* the alert path, or nothing to draw */ }
  page.off('dialog', onDialog);
  return { dxf: dxf, report: report, alert: alerted };
}

let bad = 0, checks = 0;
function ok(cond, what, got) {
  checks++;
  if (cond) { console.log('  ok    ' + what); return; }
  bad++;
  console.log('  FAIL  ' + what + (got === undefined ? '' : '\n          ' + got));
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
           '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  await page.route('**/{unpkg.com,cdnjs.cloudflare.com}/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: LIB(r.request().url()) }));
  await page.route('**/fonts.{googleapis,gstatic}.com/**', r => r.abort());
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto('file://' + SP + '/host_test.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const got = {};
  const files = [];
  for (const name of Object.keys(VARIANTS)) {
    const f = await makeBook(BOOK, name, VARIANTS[name]);
    files.push(f);
    got[name] = await drawWith(page, f);
    const d = got[name].dxf;
    console.log(name.padEnd(7) + (d ? d.length + ' bytes, ' + countOf(d, 'LINE') + ' LINE, ' +
                countOf(d, 'TEXT') + ' TEXT' : 'no drawing'));
  }

  console.log('\nangles and names are the same drawing');
  ok(!!got.named.dxf, 'FRONT by name draws something');
  ok(got.angles.dxf === got.named.dxf,
     '3D -90 0 is byte-identical to FRONT',
     got.angles.dxf === got.named.dxf ? undefined :
       'lengths ' + (got.angles.dxf || '').length + ' vs ' + got.named.dxf.length);
  ok(got.topAng.dxf === got.top.dxf, '3D 0 90 is byte-identical to TOP');
  ok(got.lower.dxf === got.named.dxf, 'the 3d keyword is not case-sensitive');
  ok(!!got.scaled.dxf && got.scaled.dxf !== got.named.dxf,
     'the same view at 1:50 is a different file from the same view at 1:10');

  console.log('\nthe isometrics');
  ok(!!got.iso.dxf && got.iso.dxf !== got.named.dxf, 'ISO draws, and is not FRONT');
  ok(got.isoSE.dxf === got.iso.dxf, 'ISO on its own is the SE corner');
  ok(got.isoUnd.dxf === got.iso.dxf, 'ISO_SE is read as ISO-SE');
  ok(!!got.isoNE.dxf && got.isoNE.dxf !== got.iso.dxf, 'ISO-NE is a different corner');

  console.log('\nthe subject can be an assembly');
  ok(!!got.assy.dxf, 'an ASSY id draws');
  ok(got.assy.dxf && countOf(got.assy.dxf, 'LINE') > countOf(got.iso.dxf, 'LINE'),
     'the whole assembly carries more than the one module in it');

  console.log('\nhidden lines are gone');
  /* The web plate seen face on: both its caps land on the same outline, and
     with the far one removed the near one has to survive. A plate that lost
     its own outline would show as a drawing with nothing in it. */
  ok(countOf(got.named.dxf, 'LINE') > 0, 'a plate seen face on still has an outline');
  /* An isometric of a splice used to carry every edge near and far. Removing
     what is behind steel has to take some of them away and cannot take them
     all: a picture with nothing left is not hidden-line removal, it is a bug. */
  const isoN = countOf(got.iso.dxf, 'LINE');
  ok(isoN > 0, 'the isometric still has lines', isoN);
  console.log('        isometric of one module: ' + isoN + ' lines');
  console.log('        isometric of the assembly: ' + countOf(got.assy.dxf, 'LINE') + ' lines');

  console.log('\nPLOT draws the parts');
  ok(!!got.plotAll.dxf, 'PLOT PART ALL draws');
  /* This book is all plate. Asking it for sections must come back with nothing
     and say so - not write a file with a title over an empty frame. */
  ok(got.plotSect.dxf === null, 'PLOT SECT on an all-plate model draws nothing');
  ok(/nothing to write|does not hold/.test(got.plotSect.alert || ''),
     'and says why rather than writing an empty file', got.plotSect.alert);
  ok(got.plotBoth.dxf === got.plotAll.dxf,
     'PART + SECT on that model is the PART drawing, unchanged');
  ok(!!got.mixed.dxf && countOf(got.mixed.dxf, 'LINE') >
       Math.max(countOf(got.named.dxf, 'LINE'), countOf(got.plotAll.dxf, 'LINE')),
     'a VIEW and a PLOT in one sheet both come out');

  console.log('\na sheet that asks for nothing says so');
  ok(got.none.dxf === null, 'no drawing is written');
  ok(/VIEW/.test(got.none.alert || '') && /PLOT/.test(got.none.alert || ''),
     'and the message shows both rows', got.none.alert);

  console.log('\na row that is wrong says so, and does not take the sheet down');
  const rep = got.bad.report;
  ok(/SIDEWAYS/.test(rep), 'the unknown direction is named');
  ok(/3D <AZ> <EL>/.test(rep), 'the report offers 3D <AZ> <EL>');
  ok(/-90 to 90/.test(rep), 'EL past the pole is explained');
  ok(/AZ and EL cells belong to 3D only/.test(rep),
     'a named direction with angles in it is caught - that is the old row shape');
  ok(/needs a scale/.test(rep), 'a row with no scale is caught');
  ok(/CHEESE/.test(rep), 'PLOT with a kind that is not one is caught');
  ok(got.bad.dxf === got.named.dxf, 'the one good row in that sheet still draws FRONT');

  /* Sections, on a book that has some. PORTAL carries six SECT rows, so this
     is where PLOT SECT has something to draw and where the split between the
     two words can be seen to matter. */
  console.log('\nsections, on a model that has them (PORTAL)');
  const PORTAL = P3 + '/PLATE3D_PORTAL.xlsx';
  const pv = {
    pPart: [['PLOT', 'PART', 'ALL', 10]],
    pSect: [['PLOT', 'SECT', 'ALL', 20]],
    pBoth: [['PLOT', 'PART', 'ALL', 10], ['PLOT', 'SECT', 'ALL', 20]],
    pIso:  [['VIEW', 'md.bay', 'ISO', null, null, 25, 'BAY']]
  };
  const pg = {};
  for (const name of Object.keys(pv)) {
    const f = await makeBook(PORTAL, name, pv[name]);
    files.push(f);
    pg[name] = await drawWith(page, f);
    console.log('  ' + name.padEnd(6) + (pg[name].dxf
      ? countOf(pg[name].dxf, 'LINE') + ' lines' : 'no drawing'));
  }
  ok(!!pg.pSect.dxf, 'PLOT SECT ALL draws where there are sections');
  ok(!!pg.pPart.dxf, 'PLOT PART ALL draws there too');
  ok(pg.pPart.dxf !== pg.pSect.dxf, 'plates and sections are different drawings');
  ok(countOf(pg.pBoth.dxf, 'LINE') >
       Math.max(countOf(pg.pPart.dxf, 'LINE'), countOf(pg.pSect.dxf, 'LINE')),
     'asking for both draws more than either');
  ok(!!pg.pIso.dxf, 'a module of it draws as an isometric');

  ok(errs.length === 0, 'no page errors', errs.join(' | '));

  if (!KEEP) files.forEach(f => { try { fs.unlinkSync(f); } catch (e) {} });
  console.log('\n' + checks + ' checks, ' + (bad ? bad + ' FAILED' : 'all passed'));
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
