/* Everything cuts 9 and 10 need, pulled out of the app once so the capture pass
   does not have to.

   Both are files the app really wrote. The BOQ comes down the File menu as a
   workbook and is read back cell by cell; the DXF comes down the same menu and
   is drawn entity by entity. Neither is illustrated - the claim of the film is
   that pressing a button hands you these, and a mock-up would be a lie about
   the one thing being claimed.

     node prep_splice.js                                                     */
const { chromium } = require('playwright-core');
const { execFileSync } = require('child_process');
const ExcelJS = require('./node_modules/exceljs');
const fs = require('fs');

const SP = __dirname;
const OUT = SP + '/splice';
const V = SP + '/../';
const BOOK = 'SPLICE_3_BOLT.xlsx';
const FONTCSS = fs.readFileSync(SP + '/v_font.css', 'utf8');
fs.mkdirSync(OUT, { recursive: true });

const LIB = f => {
  let p = SP + '/node_modules/three/build/three.min.js';
  if (f.includes('OrbitControls')) p = SP + '/node_modules/three/examples/js/controls/OrbitControls.js';
  if (f.includes('polybool')) p = SP + '/node_modules/polybooljs/dist/polybool.min.js';
  if (f.includes('exceljs')) p = SP + '/node_modules/exceljs/dist/exceljs.min.js';
  return fs.readFileSync(p, 'utf-8');
};

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const cellText = c => {
  let v = c.value;
  if (v && typeof v === 'object' && v.formula !== undefined)
    v = v.result !== undefined ? v.result : '';
  if (v === null || v === undefined) return '';
  if (typeof v === 'number')
    return Math.abs(v) >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 1 })
                               : String(Math.round(v * 100) / 100);
  return String(v);
};

/* ---------- the take-off, as pages ---------- */

/* Drawn by xlsxpreview.js, which reads the column widths, fonts, fills,
   borders, alignment and number formats the workbook actually stores.

   The first cut of this film re-typeset the take-off as an HTML document -
   big headings, its own column widths, labels in capitals. It looked tidier
   and it was wrong: the film says "press the button and this is what you
   get", so what is on screen has to be what opening the file looks like. It
   also broke step with the first promo, which drew it correctly. One sheet,
   one page; SUMMARY and PART LIST are the two the film shows.              */
function boqPages(file) {
  [['0', 's_boq1', 20], ['1', 's_boq2', 26]].forEach(function (a) {
    execFileSync(process.execPath,
      [SP + '/xlsxpreview.js', file, a[0], OUT + '/' + a[1] + '.html', String(a[2])],
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
</style><div class="tab">${esc(BOOK.replace('.xlsx', '.dxf'))}<i>5 views &middot; 1:10</i></div>
<div id="st">${svg}</div>
<script>
window.__meta = ${JSON.stringify(meta)};
/* put a band of the sheet in the middle of the frame at a given zoom */
window.__view = function (i, z) {
  var v = window.__meta.views[i], st = document.getElementById('st');
  var k = z || Math.min(1780 / window.__meta.width, 900 / (v.bottom - v.top));
  st.style.transform = 'scale(' + k + ')';
  st.style.left = ((1920 - window.__meta.width * k) / 2) + 'px';
  st.style.top  = (64 + (1016 - (v.bottom - v.top) * k) / 2 - v.top * k) + 'px';
  return { title: v.title, scale: k };
};
/* and the same for an arbitrary point, for the close-up */
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

/* --pages rebuilds only the two pages from files already exported, which is
   what you want while their layout is being worked out. */
const PAGES_ONLY = process.argv.includes('--pages');

(async () => {
  if (PAGES_ONLY) {
    execFileSync(process.execPath, [SP + '/dxf2svg.js', OUT + '/s_views.dxf', OUT + '/s_views.svg'],
                 { stdio: 'inherit' });
    dxfPage();
    boqPages(OUT + '/s_boq.xlsx');
    return;
  }
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const app = await browser.newPage({ viewport: { width: 1600, height: 900 }, acceptDownloads: true });
  await app.route('**/{unpkg.com,cdnjs.cloudflare.com}/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: LIB(r.request().url()) }));
  await app.route('**/fonts.{googleapis,gstatic}.com/**', r => r.abort());
  await app.goto('file://' + SP + '/video_page.html', { waitUntil: 'domcontentloaded' });
  await app.waitForTimeout(2500);
  await app.setInputFiles('#pb-file', V + BOOK);
  await app.waitForFunction(b => {
    const r = document.getElementById('pb-result');
    return r && r.innerText.indexOf(b) >= 0 && /Succeed/.test(r.innerText);
  }, BOOK, { timeout: 300000 });
  await app.waitForTimeout(1500);
  console.log((await app.evaluate(() => document.getElementById('pb-result').innerText)).trim().split('\n').pop());

  const [boq] = await Promise.all([app.waitForEvent('download', { timeout: 180000 }),
                                   app.evaluate(() => window.plateBuilder.exportBOQ())]);
  await boq.saveAs(OUT + '/s_boq.xlsx');
  console.log('s_boq.xlsx   ' + boq.suggestedFilename());

  /* The drawing comes down the same menu, and the menu asks which blocks and at
     what scale. Views only at 1:10 - the assembly and part blocks would put
     hundreds of pages behind the five the film is about. The file is caught off
     URL.createObjectURL rather than as a download, because that is where the
     app hands it over and it saves waiting on the browser's own plumbing. */
  await app.evaluate(() => { const o = URL.createObjectURL.bind(URL);
    URL.createObjectURL = bl => { window.__b = bl; return o(bl); }; window.__b = null; });
  await app.click('#pb-fmenu > button');
  await app.waitForTimeout(200);
  await app.click('#pb-fmenu .drop button:nth-of-type(2)');        // Save DXF
  await app.waitForTimeout(300);
  for (const k of ['assembly', 'module', 'part', 'views']) {
    const on = k === 'views';
    await app.evaluate(([id, want]) => {
      const c = document.getElementById('pb-sc-' + id);
      if (c && !c.disabled && c.checked !== want) c.click();
    }, [k, on]);
    if (on) await app.fill('#pb-sc-' + k + '-v', '10');
  }
  await app.click('#pb-scale .accent');
  await app.waitForFunction(() => !!window.__b, null, { timeout: 300000 });
  fs.writeFileSync(OUT + '/s_views.dxf', await app.evaluate(() => window.__b.text()));
  console.log('s_views.dxf  ' + (fs.statSync(OUT + '/s_views.dxf').size / 1e6).toFixed(2) + ' MB');
  await browser.close();

  execFileSync(process.execPath, [SP + '/dxf2svg.js', OUT + '/s_views.dxf', OUT + '/s_views.svg'],
               { stdio: 'inherit' });
  dxfPage();
  boqPages(OUT + '/s_boq.xlsx');
})();
