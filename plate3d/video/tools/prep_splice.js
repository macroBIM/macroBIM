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

/* ---------- the take-off, as a page ---------- */
async function boqPage(file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const blocks = [];
  for (const name of ['SUMMARY', 'PART LIST']) {
    const ws = wb.getWorksheet(name);
    if (!ws) continue;
    const rows = [];
    ws.eachRow((r, i) => {
      const cells = [];
      for (let c = 1; c <= 9; c++) cells.push(cellText(r.getCell(c)));
      while (cells.length && cells[cells.length - 1] === '') cells.pop();
      rows.push({ i: i, cells: cells });
    });
    blocks.push({ name: name, rows: rows });
  }

  /* The sheet mixes three kinds of row and they cannot share one grid: a
     heading, a table row of numbers, and a sentence of prose sitting in one
     cell. Left in the same fixed columns the prose row stretches the table
     until the numbers fall off the right-hand edge, so it is taken out of the
     grid and allowed to wrap across the width instead. */
  const NC = 9;
  const isNum = v => v !== '' && !isNaN(Number(String(v).replace(/,/g, '')));
  const html = blocks.map(b => {
    const body = b.rows.map(r => {
      if (!r.cells.length) return '<tr class="sp"><td colspan="' + NC + '"></td></tr>';
      const filled = r.cells.filter(Boolean);
      const num = r.cells.map(isNum);
      const long = filled.some(v => String(v).length > 44);
      if (filled.length === 1)
        return `<tr class="hd"><td colspan="${NC}">${esc(filled[0])}</td></tr>`;
      if (long)
        return `<tr class="no"><td>${esc(r.cells[0])}</td>` +
               `<td colspan="${NC - 1}">${esc(filled.slice(1).join(' '))}</td></tr>`;
      /* a key and one word of text is not a table row - given a grid column it
         gets clipped, so it spans like the prose does */
      if (filled.length === 2 && !isNum(filled[1]) && !isNum(r.cells[0]))
        return `<tr class="kv"><td>${esc(r.cells[0])}</td>` +
               `<td colspan="${NC - 1}">${esc(filled[1])}</td></tr>`;
      const cls = num.filter(Boolean).length >= 1 ? 'dt' : 'lb';
      const pad = r.cells.concat(Array(Math.max(0, NC - r.cells.length)).fill(''));
      return '<tr class="' + cls + '">' + pad.slice(0, NC).map((v, k) =>
        `<td class="${num[k] ? 'n' : ''}">${esc(v)}</td>`).join('') + '</tr>';
    }).join('');
    const cols = '<col class="k">' + '<col class="c">'.repeat(NC - 1);
    return `<section><h2>${esc(b.name)}</h2><table>${cols}${body}</table></section>`;
  }).join('');

  fs.writeFileSync(OUT + '/s_boq.html', `<meta charset="utf-8"><style>${FONTCSS}</style><style>
 *{margin:0;padding:0;box-sizing:border-box}
 html{background:#fff}
 body{width:1920px;font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;
      padding:46px 70px 90px;color:#0f172a}
 .tab{font:600 21px/1 Inter,sans-serif;color:#0f172a;margin-bottom:26px}
 .tab i{color:#94a3b8;font-style:normal;font-weight:500;margin-left:16px}
 h2{font:800 40px/1 Inter,sans-serif;letter-spacing:-.02em;margin:34px 0 16px}
 table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:23px;
       font-variant-numeric:tabular-nums}
 col.k{width:22%} col.c{width:9.75%}
 td{padding:9px 14px;border-bottom:1px solid #eef2f7;white-space:nowrap;
    overflow:hidden;text-overflow:ellipsis}
 td.n{text-align:right}
 tr.hd td{font-weight:700;font-size:26px;padding-top:22px;border-bottom:2px solid #0f172a;
          letter-spacing:-.01em;white-space:normal;line-height:1.3}
 tr.lb td{color:#64748b;font-weight:600;font-size:19px;letter-spacing:.03em;
          text-transform:uppercase}
 tr.no td{color:#94a3b8;font-size:19px;font-weight:500;white-space:normal;
          line-height:1.4;border-bottom:none;padding-top:2px}
 tr.no td:first-child{color:#64748b;font-weight:600;text-transform:uppercase;font-size:18px}
 tr.kv td{white-space:normal}
 tr.kv td:first-child{color:#64748b;font-weight:600;text-transform:uppercase;font-size:19px;
                      letter-spacing:.03em}
 tr.sp td{border:none;height:14px}
 tr.dt td:first-child{font-weight:700}
</style><div class="tab">${esc(BOOK.replace('.xlsx', '_BOQ.xlsx'))}<i>SUMMARY &middot; PART LIST &middot; MODULES &middot; ASSEMBLY</i></div>
${html}`);
  const h = await pageHeight(OUT + '/s_boq.html');
  console.log('s_boq.html   ' + blocks.map(b => b.name + ' ' + b.rows.length + ' rows').join(' · ') +
              '   page ' + h + ' px');
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

async function pageHeight(file) {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file://' + file, { waitUntil: 'load' });
  const h = await p.evaluate(() => document.body.scrollHeight);
  await b.close();
  return h;
}

/* --pages rebuilds only the two pages from files already exported, which is
   what you want while their layout is being worked out. */
const PAGES_ONLY = process.argv.includes('--pages');

(async () => {
  if (PAGES_ONLY) {
    execFileSync(process.execPath, [SP + '/dxf2svg.js', OUT + '/s_views.dxf', OUT + '/s_views.svg'],
                 { stdio: 'inherit' });
    dxfPage();
    await boqPage(OUT + '/s_boq.xlsx');
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
  await boqPage(OUT + '/s_boq.xlsx');
})();
