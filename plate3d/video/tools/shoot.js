/* PLATE3D promo film - the capture pass.

   Everything on screen is the real thing: the models are built by the engine
   from the shipped sheets, the spreadsheet pages are those sheets read back cell
   by cell, and the take-off is the workbook the app actually exports. Nothing is
   mocked up, because the whole claim of the film is that the picture came out of
   the rows.

   Frames come off the WebGL canvas rather than through page.screenshot: the
   compositor runs on a software rasteriser here and costs ~2.8 s a frame, while
   reading the drawing buffer costs ~1.1 s. Only the beats that need the app
   chrome - the sidebar, the toolbar - pay the full price, and those are stills.

   Output is a list of distinct images plus how long each is held. The assembler
   turns that into a constant-rate sequence with symlinks, so a four-second hold
   costs one JPEG rather than a hundred and twenty. */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('./node_modules/exceljs');

const SP = __dirname;
const SRC = SP + '/src';
const P3 = '/home/user/macroBIM/plate3d/';
const FPS = 30;                       // the film
const MO = 15;                        // camera moves are rendered at half rate
const VW = 2336, VH = 1294;           // -> a canvas of about 1920x1080

fs.rmSync(SRC, { recursive: true, force: true });
fs.mkdirSync(SRC, { recursive: true });

let n = 0, T = 0;
const shots = [];                     // { file, dur }
const caps = [];                      // { png, start, dur }
function put(buf, dur) {
  const f = 's' + String(n++).padStart(4, '0') + '.jpg';
  fs.writeFileSync(SRC + '/' + f, buf);
  shots.push({ file: f, dur: dur });
  T += dur;
  return f;
}
function caption(id, start, dur) { caps.push({ png: 'v_' + id + '.png', start: start, dur: dur }); }

const LIB = f => {
  let p = SP + '/node_modules/three/build/three.min.js';
  if (f.includes('OrbitControls')) p = SP + '/node_modules/three/examples/js/controls/OrbitControls.js';
  if (f.includes('polybool')) p = SP + '/node_modules/polybooljs/dist/polybool.min.js';
  if (f.includes('exceljs')) p = SP + '/node_modules/exceljs/dist/exceljs.min.js';
  return fs.readFileSync(p, 'utf-8');
};
async function wire(page) {
  await page.route('**/{unpkg.com,cdnjs.cloudflare.com}/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: LIB(r.request().url()) }));
  await page.route('**/fonts.{googleapis,gstatic}.com/**', r => r.abort());
}

/* ---------- the 3D page ---------- */
let app;                              // the PLATE3D page
// Wait on the file's own name, not on the member count: the page builds the
// tower as its opening demo, so a count alone would match before the sheet
// under test has been read at all.
async function load(file, expect) {
  const base = path.basename(file);
  await app.setInputFiles('#pb-file', file);
  await app.waitForFunction(a => {
    const r = document.getElementById('pb-result'), t = document.getElementById('pb-total');
    return r && t && r.innerText.indexOf(a[0]) >= 0 && t.innerText.indexOf(a[1]) >= 0;
  }, [base, expect], { timeout: 300000 });
  await app.waitForTimeout(1200);
}
const cam = () => app.evaluate(() => window.__cam());
const aim = c => app.evaluate(a => window.__aim(a.tx, a.ty, a.tz, a.dist, a.az, a.el), c);
async function frame(dur) {
  const d = await app.evaluate(() => window.__grab(0.92));
  return put(Buffer.from(d.split(',')[1], 'base64'), dur);
}
// A camera move: `fn(u)` places the camera for u in [0,1], rendered at MO fps.
async function move(dur, fn) {
  const k = Math.max(1, Math.round(dur * MO));
  for (let i = 0; i < k; i++) {
    await fn(k === 1 ? 0 : i / (k - 1), i, k);
    await frame(dur / k);
  }
}
const ease = u => u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
const mix = (a, b, u) => a + (b - a) * u;

/* ---------- the flat pages ---------- */
let doc;                              // a second tab for spreadsheets and cards
async function page2(file) {
  await doc.goto('file://' + SP + '/' + file, { waitUntil: 'load', timeout: 30000 });
  await doc.waitForTimeout(500);
}
async function still(dur) {
  return put(await doc.screenshot({ type: 'jpeg', quality: 92 }), dur);
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

  app = await browser.newPage({ viewport: { width: VW, height: VH } });
  await wire(app);
  await app.goto('file://' + SP + '/video_page.html', { waitUntil: 'domcontentloaded' });
  await app.waitForTimeout(3500);

  doc = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await wire(doc);

  const t = () => T.toFixed(2);
  const log = m => console.log('  [' + t() + 's] ' + m);

  /* ===== 1  INTRO - the crane, turning ===== */
  await load(P3 + 'PLATE3D_TOWER.xlsx', '575');
  let c = await cam();
  caption('c01', 0.2, 2.6);
  await move(3.0, u => aim({ ...c, az: mix(c.az - 7, c.az + 7, u), dist: c.dist * 1.02 }));
  log('1 intro orbit');

  /* ===== 2  the sheet it came out of ===== */
  await page2('v_sheet_tower.html');
  const maxY = await doc.evaluate(() => document.body.scrollHeight - window.innerHeight);
  caption('c02', T + 0.2, 3.1);
  {
    const k = Math.round(3.5 * MO);
    for (let i = 0; i < k; i++) {
      await doc.evaluate(y => window.scrollTo(0, y), Math.round(maxY * 0.62 * ease(i / (k - 1))));
      await still(3.5 / k);
    }
  }
  log('2 sheet scroll');

  /* ===== 3  rows become a structure ===== */
  await load(P3 + 'PLATE3D_SAMPLE.xlsx', '48');
  c = await cam();
  caption('c03', T + 0.3, 3.9);
  await app.evaluate(() => window.__reveal(0));
  await move(2.6, async u => {
    await app.evaluate(f => window.__reveal(f), ease(u));
    await aim({ ...c, az: mix(c.az - 5, c.az + 1, u) });
  });
  await app.evaluate(() => window.__revealAll());
  await move(1.9, u => aim({ ...c, az: mix(c.az + 1, c.az + 8, u) }));
  log('3 sample builds');

  /* ===== 4  the portal, and the one cell that sets its length =====
     Both states are shot from the camera that frames the LONG building, so the
     short one sits in the same space with room to grow into. The two are then
     cut a second apart in beat 6 - far enough back and you are asking the
     audience to remember a building they last saw six seconds ago, which is
     not a demonstration of anything. */
  await load(P3 + 'video/PLATE3D_VIDEO_54M.xlsx', '497');
  const wide = await cam();
  await load(P3 + 'video/PLATE3D_VIDEO_30M.xlsx', '297');
  caption('c04', T + 0.2, 3.5);
  caps.push({ png: 'v_s30.png', start: T + 0.2, dur: 1.9 });
  await move(1.8, u => aim({ ...wide, az: mix(wide.az - 2, wide.az, u) }));
  await page2('v_sheet_before.html');
  await doc.evaluate(() => document.querySelector('.drv').scrollIntoView({ block: 'center' }));
  await still(1.2);
  log('4 portal + driver cell');

  /* ===== 5  change it ===== */
  caption('c05', T + 0.1, 2.8);
  await still(0.75);                              // 5
  await doc.evaluate(() => { document.querySelector('.drv').textContent = '█'; });
  await still(0.35);                              // caret
  await doc.evaluate(() => { document.querySelector('.drv').textContent = '9'; });
  await still(0.85);                              // 9
  await page2('v_sheet_after.html');              // and the three derived cells follow
  await doc.evaluate(() => document.querySelector('.drv').scrollIntoView({ block: 'center' }));
  await still(1.05);
  log('5 typing');

  /* ===== 6  the whole building follows =====
     The app still holds the 30 m model, so re-establishing it costs a frame and
     no reload. Then the cut: same camera, same ground, four more frames of
     building where there was nothing. */
  caption('c06', T + 1.1, 4.6);
  caps.push({ png: 'v_s30.png', start: T, dur: 1.0 });
  await aim(wide);
  await frame(1.0);
  await load(P3 + 'video/PLATE3D_VIDEO_54M.xlsx', '497');
  await aim(wide);
  caps.push({ png: 'v_s54.png', start: T, dur: 5.9 });
  await frame(1.4);
  await move(5.6, u => aim({ ...wide, az: mix(wide.az, wide.az + 26, ease(u)),
                             el: mix(wide.el, wide.el + 6, ease(u)),
                             dist: wide.dist * mix(1, 0.88, ease(u)) }));
  log('6 growth');

  /* ===== 7  347 rows, one crane - built from the ground up ===== */
  await load(P3 + 'PLATE3D_TOWER.xlsx', '575');
  c = await cam();
  caption('c07', T + 0.3, 4.4);
  await app.evaluate(() => window.__reveal(0));
  await move(5.0, async u => {
    await app.evaluate(f => window.__reveal(f), Math.pow(u, 0.85));
    await aim({ ...c, az: mix(c.az - 12, c.az - 2, u), dist: c.dist * mix(1.05, 1.0, u) });
  });
  await app.evaluate(() => window.__revealAll());
  log('7 crane assembles');

  /* ===== 8  every member real ===== */
  caption('c08', T + 0.3, 5.2);
  await move(6.0, u => aim({ ...c, az: mix(c.az - 2, c.az + 32, ease(u)),
                             el: mix(c.el, c.el - 8, ease(u)) }));
  log('8 hero pan');

  /* ===== 9  down to the last hole ===== */
  caption('c09', T + 0.4, 3.2);
  const near = { tx: 0, ty: 0, tz: 37600, dist: 7000, az: c.az + 40, el: 6 };
  const far = { tx: c.tx, ty: c.ty, tz: c.tz, dist: c.dist, az: c.az + 32, el: c.el - 8 };
  await move(4.0, u => aim({
    tx: mix(far.tx, near.tx, ease(u)), ty: mix(far.ty, near.ty, ease(u)),
    tz: mix(far.tz, near.tz, ease(u)), dist: mix(far.dist, near.dist, ease(u)),
    az: mix(far.az, near.az, ease(u)), el: mix(far.el, near.el, ease(u)) }));
  log('9 detail push-in');

  /* ===== 10  the take-off the app writes ===== */
  const dl = await Promise.all([
    app.waitForEvent('download', { timeout: 180000 }),
    app.evaluate(() => window.plateBuilder.exportBOQ())
  ]);
  const boq = SP + '/v_boq.xlsx';
  await dl[0].saveAs(boq);
  await buildBoqPages(boq);
  caption('c10', T + 0.3, 5.2);
  await page2('v_boq_1.html'); await still(3.0);
  await page2('v_boq_2.html'); await still(3.0);
  log('10 BOQ');

  /* ===== 11  it is a browser tab ===== */
  await aim({ ...c, az: c.az + 6, el: c.el });
  await app.evaluate(() => window.__pbDraw());
  caption('c11', T + 0.3, 3.4);
  put(await app.screenshot({ type: 'jpeg', quality: 92 }), 2.0);
  await aim({ ...c, az: c.az + 14, el: c.el + 2 });
  await app.evaluate(() => window.__pbDraw());
  put(await app.screenshot({ type: 'jpeg', quality: 92 }), 2.0);
  log('11 the whole app');

  /* ===== 12/13  outro ===== */
  await page2('v_o1.html'); await still(2.6);
  await page2('v_o2.html'); await still(3.4);
  log('12 outro');

  fs.writeFileSync(SP + '/shots.json', JSON.stringify({ fps: FPS, total: T, shots, caps }, null, 1));
  console.log('\n' + shots.length + ' distinct frames, ' + T.toFixed(1) + ' s');
  await browser.close();
})().catch(e => { console.error('FAILED: ' + e.message); process.exit(1); });

/* The exported workbook, as two pages of the film.

   Read back the way Excel reads it: the column widths, row heights, fonts,
   fills, borders, alignments and number formats stored in the file, not a set
   chosen here. The first cut of this film drew the take-off in the film's own
   house style, and the moment the real export was restyled the two drifted
   apart - a picture of a spreadsheet that no longer looked like the
   spreadsheet. Now the only liberty taken is scale: the sheet is drawn at its
   own size and then zoomed to fill the frame, the way you would zoom it on
   screen to read it.

   The row numbers and column letters are the same chrome the input sheet gets
   earlier in the film, so both spreadsheet beats read as the same thing. */
async function buildBoqPages(file) {
  const FONTCSS = fs.readFileSync(SP + '/v_font.css', 'utf8');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);

  const argb = (c, d) => (c && c.argb ? '#' + c.argb.slice(2) : d);
  const colPx = w => Math.round((w || 8.43) * 7 + 5);     // Excel's own conversion
  const ptPx = v => v * 96 / 72;
  const esc2 = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  function cellText(v, f) {
    if (v == null || v === '') return '';
    if (typeof v === 'object') {
      if (v.result !== undefined) v = v.result;
      else if (v.text !== undefined) return v.text;
      else if (v.richText) return v.richText.map(t => t.text).join('');
      else return '';
    }
    if (typeof v !== 'number' || !f) return String(v);
    if (/%/.test(f)) {
      const dp = (f.match(/\.(0+)/) || [, ''])[1].length;
      return (v * 100).toFixed(dp) + '%';
    }
    const m = f.match(/\.([0#]+)/);
    let t;
    if (m && /0/.test(m[1])) t = v.toFixed(m[1].length);
    else if (m) { const k = Math.pow(10, m[1].length); t = String(Math.round(v * k) / k); }
    else t = String(Math.round(v));
    if (/#,##0/.test(f)) {
      const q = t.split('.');
      q[0] = q[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      t = q.join('.');
    }
    return t;
  }

  const PAGES = [[0, 22], [1, 24]];           // SUMMARY, PART LIST : sheet, rows
  const L = 'ABCDEFGHIJKLMNOP'.split('');
  PAGES.forEach(([si, nRow], pi) => {
    const ws = wb.worksheets[si];
    const nCol = Math.min(ws.columnCount || 8, si === 0 ? 5 : 12);
    const widths = [];
    for (let i = 1; i <= nCol; i++) widths.push(colPx(ws.getColumn(i).width));
    const GUT = 54;
    const natural = GUT + widths.reduce((a, b) => a + b, 0);
    const scale = Math.min(2.6, (1920 - 96) / natural);   // zoom to fill, never past 2.6x

    let body = '', r = 0;
    ws.eachRow({ includeEmpty: true }, (row, idx) => {
      if (r++ >= nRow) return;
      const text = [];
      for (let ci = 1; ci <= nCol + 1; ci++)
        text.push(cellText(row.getCell(ci).value, row.getCell(ci).numFmt));
      let tds = '<td class="rn">' + idx + '</td>';
      for (let ci = 1; ci <= nCol; ci++) {
        const c = row.getCell(ci);
        const f = c.font || {}, b = c.border || {}, al = c.alignment || {};
        const st = ['font-weight:' + (f.bold ? 700 : 400),
                    'font-size:' + (f.size || 11) + 'pt',
                    'color:' + argb(f.color, '#000')];
        if (f.italic) st.push('font-style:italic');
        // single quotes only: a double quote here would close the style attribute
        if (f.name) st.push("font-family:'" + f.name + "',Arial,'Liberation Sans',sans-serif");
        if (c.fill && c.fill.fgColor) st.push('background:' + argb(c.fill.fgColor, 'transparent'));
        const edge = (e, side) => 'border-' + side + ':' +
          (e.style === 'medium' ? '2px' : e.style === 'thick' ? '3px' : '1px') +
          ' solid ' + argb(e.color, '#000');
        if (b.top) st.push(edge(b.top, 'top'));
        if (b.bottom) st.push(edge(b.bottom, 'bottom'));
        const raw = c.value && c.value.result !== undefined ? c.value.result : c.value;
        st.push('text-align:' + (al.horizontal || (typeof raw === 'number' ? 'right' : 'left')));
        st.push('vertical-align:' + (al.vertical === 'middle' ? 'middle' : 'bottom'));
        // a long entry runs on over an empty neighbour, the way Excel shows it
        if (text[ci - 1] && !text[ci] && (al.horizontal || 'left') === 'left')
          st.push('overflow:visible');
        tds += '<td style="' + st.join(';') + '">' + esc2(cellText(c.value, c.numFmt)) + '</td>';
      }
      body += '<tr style="height:' + (row.height ? ptPx(row.height) : ptPx(15)).toFixed(1) +
              'px">' + tds + '</tr>';
    });

    let head = '<tr class="hd"><th class="rn"></th>';
    for (let i = 0; i < nCol; i++) head += '<th>' + L[i] + '</th>';
    head += '</tr>';

    fs.writeFileSync(SP + '/v_boq_' + (pi + 1) + '.html',
      '<meta charset="utf-8"><style>' + FONTCSS + `
      *{margin:0;padding:0;box-sizing:border-box}
      html,body{width:1920px;height:1080px;background:#fff;overflow:hidden}
      body{-webkit-font-smoothing:antialiased}
      .tab{font:600 20px/1 Inter,sans-serif;color:#0f172a;padding:20px 0 0 48px}
      .tab i{color:#94a3b8;font-style:normal;font-weight:500;margin-left:14px}
      .wrap{transform:scale(${scale.toFixed(3)});transform-origin:top left;
            margin:14px 0 0 48px;width:${natural}px}
      table{border-collapse:collapse;table-layout:fixed;width:${natural}px;
            font-family:Arial,"Liberation Sans",sans-serif}
      td{padding:0 5px;overflow:hidden;white-space:nowrap;position:relative}
      th{background:#f1f5f9;color:#94a3b8;font:600 10pt Arial,sans-serif;height:22px;
         border:1px solid #e2e8f0}
      td.rn,th.rn{width:${GUT}px;background:#f1f5f9;color:#94a3b8;text-align:center;
         font:600 9pt Arial,sans-serif;border:1px solid #e2e8f0}
      </style><div class="tab">` + esc2(ws.name) +
      '<i>' + esc2(wb.worksheets.map(w => w.name).join('  ·  ')) + '</i></div>' +
      '<div class="wrap"><table><colgroup><col style="width:' + GUT + 'px">' +
      widths.map(w => '<col style="width:' + w + 'px">').join('') +
      '</colgroup>' + head + body + '</table></div>');
  });
}
