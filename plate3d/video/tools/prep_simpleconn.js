/* Everything cuts 14 and 15 need, pulled out of the app once so the capture
   pass does not have to.

   All three are files the form really wrote, from the state the film leaves it
   in: four beams, an H-300 column, the shipped defaults. The take-off comes
   down the form's Save menu as a workbook and is read back cell by cell; the
   drawing comes down the same menu and is drawn entity by entity; the workbook
   comes off Export .xlsx, which patches the shipped PLATE3D_COLUMN.xlsx rather
   than inventing one. None of the three is illustrated - the film's whole claim
   is that filling in a form hands you these, and a mock-up would be a lie about
   the one thing being claimed.

   Cut 15 has to reach the input tab. PARAM alone reads as "the form exported
   the form"; it is the SECT, PLATE and NOTCH rows that show it is the same
   grammar the first three films taught.

     node prep_simpleconn.js  [--pages]                                      */
const { chromium } = require('playwright-core');
const { execFileSync } = require('child_process');
const ExcelJS = require('./node_modules/exceljs');
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const OUT = SP + '/simpleconn';
const MB = path.resolve(SP + '/../../..');
const DZ = path.resolve(MB + '/../design');
const LIBDIR = MB + '/plate3d/tools';
const FONTCSS = fs.readFileSync(SP + '/v_font.css', 'utf8');
fs.mkdirSync(OUT, { recursive: true });

const LIB = f => {
  let p = LIBDIR + '/node_modules/three/build/three.min.js';
  if (f.includes('OrbitControls')) p = LIBDIR + '/node_modules/three/examples/js/controls/OrbitControls.js';
  if (f.includes('polybool')) p = LIBDIR + '/node_modules/polybooljs/dist/polybool.min.js';
  if (f.includes('exceljs')) p = LIBDIR + '/node_modules/exceljs/dist/exceljs.min.js';
  return fs.readFileSync(p, 'utf-8');
};
const HOST = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
  '<link rel="stylesheet" href="/design/layout_style.css"></head>' +
  '<body style="margin:0;display:flex;flex-direction:column;height:100vh">' +
  '<div id="app-root"></div>' +
  ['rebartable_claude', 'steelsection_claude', 'mod_concrete', 'mod_rebar',
   'mod_rebar_leng', 'layout_body'].map(f => '<script src="/design/' + f + '.js"></script>').join('') +
  '<script>window.addEventListener("DOMContentLoaded",function(){' +
  'initLayout({visits:1,totalVisits:2});});</script></body></html>';
const mime = f => f.endsWith('.css') ? 'text/css'
  : f.endsWith('.js') ? 'application/javascript'
  : f.endsWith('.html') ? 'text/html'
  : f.endsWith('.csv') ? 'text/csv' : 'application/octet-stream';
async function serve(page) {
  await page.route('**/*', route => {
    const raw = route.request().url();
    if (raw.startsWith('file:')) return route.continue();
    const u = new URL(raw), p = u.pathname;
    if (u.hostname === 'prep.test' && p === '/host.html')
      return route.fulfill({ contentType: 'text/html', body: HOST });
    if (u.hostname.includes('unpkg') || u.hostname.includes('cdnjs'))
      return route.fulfill({ contentType: 'application/javascript', body: LIB(u.href) });
    if (u.hostname.includes('fonts.')) return route.abort();
    let f = null;
    if (p.startsWith('/design/')) f = path.join(DZ, p.slice(8));
    else if (p.startsWith('/macroBIM/')) f = path.join(MB, p.slice(10));
    if (f && fs.existsSync(f))
      return route.fulfill({ body: fs.readFileSync(f), contentType: mime(f) });
    return route.abort();
  });
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/* ---------- a workbook's sheets, as pages ----------
   Drawn by xlsxpreview.js, which reads the column widths, fonts, fills,
   borders, alignment and number formats the workbook actually stores. The rule
   this obeys was learnt the hard way on the splice film: what is on screen has
   to be what opening the file looks like, so the sheet is never re-typeset. */
async function sheetPages(file, want) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const names = wb.worksheets.map(w => w.name);
  console.log('  sheets: ' + names.join(', '));
  want.forEach(a => {
    const i = names.findIndex(n => n.toLowerCase() === a.sheet.toLowerCase());
    if (i < 0) throw new Error('no "' + a.sheet + '" sheet in ' + path.basename(file));
    execFileSync(process.execPath,
      [SP + '/xlsxpreview.js', file, String(i), OUT + '/' + a.out + '.html', String(a.rows)],
      { stdio: 'inherit' });
  });
}

/* ---------- the drawing, as a page ---------- */
function dxfPage() {
  const svg = fs.readFileSync(OUT + '/s_views.svg', 'utf8');
  const meta = JSON.parse(fs.readFileSync(OUT + '/s_views.json', 'utf8'));
  fs.writeFileSync(OUT + '/s_dxf.html', `<meta charset="utf-8"><style>${FONTCSS}</style><style>
 *{margin:0;padding:0;box-sizing:border-box}
 html,body{width:1920px;height:1080px;overflow:hidden;background:#fff}
 body{font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
 .tab{position:fixed;top:0;left:0;right:0;height:64px;background:#fff;z-index:2;
      font:600 21px/64px Inter,sans-serif;color:#0f172a;padding-left:56px;
      border-bottom:1px solid #eef2f7}
 .tab i{color:#94a3b8;font-style:normal;font-weight:500;margin-left:16px}
 #st{position:absolute;transform-origin:top left}
</style><div class="tab">PLATE3D_COLUMN.dxf<i>${meta.views.length} view${meta.views.length > 1 ? 's' : ''}</i></div>
<div id="st">${svg}</div>
<script>
window.__meta = ${JSON.stringify(meta)};
window.__view = function (i, z) {
  var v = window.__meta.views[i], st = document.getElementById('st');
  var k = z || Math.min(1780 / window.__meta.width, 900 / (v.bottom - v.top));
  st.style.transform = 'scale(' + k + ')';
  st.style.left = ((1920 - window.__meta.width * k) / 2) + 'px';
  st.style.top  = (64 + (1016 - (v.bottom - v.top) * k) / 2 - v.top * k) + 'px';
  return { title: v.title, scale: k };
};
window.__at = function (x, y, k) {
  var st = document.getElementById('st');
  st.style.transform = 'scale(' + k + ')';
  st.style.left = (960 - x * k) + 'px';
  st.style.top  = (64 + 508 - y * k) + 'px';
};
<\/script>`);
  console.log('s_dxf.html   ' + meta.views.length + ' views · sheet ' +
              Math.round(meta.width) + ' x ' + Math.round(meta.height));
}

const PAGES_ONLY = process.argv.includes('--pages');

(async () => {
  if (PAGES_ONLY) {
    execFileSync(process.execPath, [SP + '/dxf2svg.js', OUT + '/s_views.dxf', OUT + '/s_views.svg'],
                 { stdio: 'inherit' });
    dxfPage();
    await sheetPages(OUT + '/s_boq.xlsx', [{ sheet: 'SUMMARY', out: 's_boq1', rows: 20 },
                                           { sheet: 'PART LIST', out: 's_boq2', rows: 26 }]);
    await sheetPages(OUT + '/s_book.xlsx', [{ sheet: 'PARAM', out: 's_param', rows: 26 },
                                            { sheet: 'input', out: 's_input', rows: 30 }]);
    return;
  }
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const A = await browser.newPage({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  await serve(A);
  A.on('pageerror', e => console.log('  ERR ' + String(e).slice(0, 140)));
  await A.goto('https://prep.test/host.html', { waitUntil: 'domcontentloaded' });
  // the layout wires showPage on DOMContentLoaded; wait for it rather than
  // guessing at a delay
  await A.waitForFunction(() => typeof window.showPage === 'function', null, { timeout: 60000 });
  await A.evaluate(() => window.showPage('quick-simpleconn'));
  await A.waitForFunction(() => !!document.querySelector('#mount-quick-simpleconn iframe'),
                          null, { timeout: 60000 });
  await A.waitForTimeout(10000);

  /* The state the film leaves the form in: all four beams up. One box at a
     time - every handler ends in redraw(), so a batch would keep only the
     first. (The capture pass hit this and lost a beam.) */
  const MOUNT = '#mount-quick-simpleconn ';
  for (const k of ['c5r1i7', 'c5r2i7', 'c5r3i7', 'c5r4i7']) {
    const sel = MOUNT + '[data-k="' + k + '"]';
    await A.fill(sel, '900');
    await A.dispatchEvent(sel, 'change');
    await A.waitForTimeout(300);
  }
  await A.waitForTimeout(3000);
  const emb = A.frames().find(f => /embed/.test(f.url()));
  console.log('state        ' +
    (await emb.evaluate(() => (document.getElementById('pb-total') || {}).innerText || '')).trim());

  /* ---- the take-off, off the form's own Save menu ---- */
  await A.click(MOUNT + '#qsc-save');
  await A.waitForTimeout(200);
  const [boq] = await Promise.all([
    A.waitForEvent('download', { timeout: 180000 }),
    A.click(MOUNT + '#qsc-savemenu .d button[data-cmd="exportBOQ"]')]);
  await boq.saveAs(OUT + '/s_boq.xlsx');
  console.log('s_boq.xlsx   ' + boq.suggestedFilename());

  /* ---- the workbook, off Export .xlsx ---- */
  const [book] = await Promise.all([
    A.waitForEvent('download', { timeout: 180000 }),
    A.click(MOUNT + '#qsc-export')]);
  await book.saveAs(OUT + '/s_book.xlsx');
  console.log('s_book.xlsx  ' + book.suggestedFilename());

  /* ---- the drawing. The Save menu hands the command to the frame, and the
     frame asks which blocks and at what scale, so the dialog is inside it. The
     file is caught off URL.createObjectURL, where the app hands it over. ---- */
  await emb.evaluate(() => { const o = URL.createObjectURL.bind(URL);
    URL.createObjectURL = bl => { window.__b = bl; return o(bl); }; window.__b = null; });
  await A.click(MOUNT + '#qsc-save');
  await A.waitForTimeout(200);
  await A.click(MOUNT + '#qsc-savemenu .d button[data-cmd="exportDXF"]');
  /* No dialog to answer. The engine used to ask which blocks and at what
     scale; every drawing is now asked for by a VIEW or PLOT row on the sheet
     and carries its own scale, so Save DXF simply writes the file. */
  await emb.waitForFunction(() => !!window.__b, null, { timeout: 300000 });
  fs.writeFileSync(OUT + '/s_views.dxf', await emb.evaluate(() => window.__b.text()));
  console.log('s_views.dxf  ' + (fs.statSync(OUT + '/s_views.dxf').size / 1e6).toFixed(2) + ' MB');
  await browser.close();

  execFileSync(process.execPath, [SP + '/dxf2svg.js', OUT + '/s_views.dxf', OUT + '/s_views.svg'],
               { stdio: 'inherit' });
  dxfPage();
  await sheetPages(OUT + '/s_boq.xlsx', [{ sheet: 'SUMMARY', out: 's_boq1', rows: 20 },
                                         { sheet: 'PART LIST', out: 's_boq2', rows: 26 }]);
  await sheetPages(OUT + '/s_book.xlsx', [{ sheet: 'PARAM', out: 's_param', rows: 26 },
                                          { sheet: 'input', out: 's_input', rows: 30 }]);
})();
