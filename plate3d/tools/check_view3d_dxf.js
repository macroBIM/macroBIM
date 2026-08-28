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
const VARIANTS = {
  named:  [['VIEW', 'md.wpl', 'FRONT', 'SUBJECT']],
  angles: [['VIEW', 'md.wpl', '3D', -90, 0, 'SUBJECT']],
  lower:  [['VIEW', 'md.wpl', '3d', -90, 0, 'SUBJECT']],       // case of the keyword
  top:    [['VIEW', 'md.wpl', 'TOP', 'SUBJECT']],
  topAng: [['VIEW', 'md.wpl', '3D', 0, 90, 'SUBJECT']],
  iso:    [['VIEW', 'md.wpl', 'ISO', 'SUBJECT']],
  isoSE:  [['VIEW', 'md.wpl', 'ISO-SE', 'SUBJECT']],           // ISO is SE
  isoUnd: [['VIEW', 'md.wpl', 'ISO_SE', 'SUBJECT']],           // and ISO_SE is ISO-SE
  isoNE:  [['VIEW', 'md.wpl', 'ISO-NE', 'SUBJECT']],           // a different corner
  assy:   [['VIEW', 'as.splice', 'ISO', 'SUBJECT']],           // the subject is an ASSY id
  bad:    [['VIEW', 'md.wpl', 'SIDEWAYS', 'nowhere'],
           ['VIEW', 'md.wpl', '3D', -90, 120, 'over the pole'],
           ['VIEW', 'md.wpl', 'FRONT', 'SUBJECT']]
};
const VIEW_ROWS = [100, 101, 102, 103, 104];   // the book's own VIEW rows
const KEY_COL = 2;                             // column B holds the keyword

async function makeBook(name, rows) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(BOOK);
  const ws = wb.getWorksheet('input');
  VIEW_ROWS.forEach(function (r, i) {
    const row = ws.getRow(r);
    // clear the row's VIEW cells, then write the variant's if it has one here
    for (let c = KEY_COL; c <= KEY_COL + 5; c++) row.getCell(c).value = null;
    if (rows[i]) rows[i].forEach(function (v, j) { row.getCell(KEY_COL + j).value = v; });
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
  (bodyOf(dxf).match(new RegExp('^\\s*' + kind + '\\s*$', 'gm')) || []).length;

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
  await page.click('#pb-fmenu > button');
  await page.waitForTimeout(150);
  await page.click('#pb-fmenu .drop button:nth-of-type(2)');       // Save DXF
  await page.waitForTimeout(250);
  // only the VIEWS block, so nothing but the drawing under test is in the file
  const avail = await page.evaluate(() => {
    const out = {};
    ['assembly', 'module', 'part', 'views'].forEach(k => {
      const c = document.getElementById('pb-sc-' + k);
      if (!c) return;
      out[k] = c.disabled ? 'unavailable' : true;
      if (!c.disabled && c.checked !== (k === 'views')) c.click();
    });
    return out;
  });
  if (avail.views === 'unavailable') {          // the sheet named no drawing at all
    await page.click('#pb-scale button:not(.accent)');
    return { dxf: null, report: report, views: 'unavailable' };
  }
  await page.fill('#pb-sc-views-v', '10');
  await page.click('#pb-scale .accent');
  await page.waitForFunction(() => !!window.__b, null, { timeout: 900000 });
  return { dxf: await page.evaluate(() => window.__b.text()), report: report,
           views: avail.views };
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
    const f = await makeBook(name, VARIANTS[name]);
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
       'lengths ' + (got.angles.dxf || '').length + ' vs ' + got.named.dxf.length +
       ', LINEs ' + countOf(got.angles.dxf || '', 'LINE') + ' vs ' + countOf(got.named.dxf, 'LINE'));
  ok(got.topAng.dxf === got.top.dxf, '3D 0 90 is byte-identical to TOP');
  ok(got.lower.dxf === got.named.dxf, 'the 3d keyword is not case-sensitive');

  console.log('\nthe isometrics');
  ok(!!got.iso.dxf && got.iso.dxf !== got.named.dxf, 'ISO draws, and is not FRONT');
  ok(got.isoSE.dxf === got.iso.dxf, 'ISO on its own is the SE corner');
  ok(got.isoUnd.dxf === got.iso.dxf, 'ISO_SE is read as ISO-SE');
  ok(!!got.isoNE.dxf && got.isoNE.dxf !== got.iso.dxf, 'ISO-NE is a different corner from ISO');
  /* An isometric of a plate seen square-on in FRONT has to carry more lines:
     the four edges that were hidden behind their own faces come into view. */
  ok(countOf(got.iso.dxf, 'LINE') > countOf(got.named.dxf, 'LINE'),
     'the isometric shows more edges than the face-on view',
     countOf(got.iso.dxf, 'LINE') + ' vs ' + countOf(got.named.dxf, 'LINE'));

  console.log('\nthe subject can be an assembly');
  ok(!!got.assy.dxf, 'an ASSY id draws');
  ok(got.assy.dxf && countOf(got.assy.dxf, 'LINE') > countOf(got.iso.dxf, 'LINE'),
     'the whole assembly carries more than the one module in it',
     got.assy.dxf ? countOf(got.assy.dxf, 'LINE') + ' vs ' + countOf(got.iso.dxf, 'LINE') : 'no drawing');

  console.log('\na row that is wrong says so, and does not take the sheet down with it');
  const rep = got.bad.report;
  ok(/SIDEWAYS/.test(rep), 'the unknown direction is named in the report');
  ok(/3D <AZ> <EL>/.test(rep), 'the report offers 3D <AZ> <EL>');
  ok(/ISO-NE/.test(rep), 'the report offers the isometric corners');
  ok(/-90 to 90/.test(rep), 'EL past the pole is explained, not just refused');
  ok(got.bad.dxf === got.named.dxf, 'the one good row in that sheet still draws FRONT');

  ok(errs.length === 0, 'no page errors', errs.join(' | '));

  if (!KEEP) files.forEach(f => { try { fs.unlinkSync(f); } catch (e) {} });
  console.log('\n' + checks + ' checks, ' + (bad ? bad + ' FAILED' : 'all passed'));
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
