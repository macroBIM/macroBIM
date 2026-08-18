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

/* The exported workbook, rendered as two pages of the film. It is read back the
   same way the input sheets are, so the numbers on screen are the numbers the
   app wrote - including the formulas, which is why the cached result is taken. */
async function buildBoqPages(file) {
  const FONTCSS = fs.readFileSync(SP + '/v_font.css', 'utf8');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const val = v => v == null ? '' : (typeof v === 'object'
    ? (v.result !== undefined ? v.result : (v.text !== undefined ? v.text : ''))
    : v);
  const fmt = v => typeof v === 'number'
    ? (Math.abs(v) >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 3 })
                           : String(Math.round(v * 1000) / 1000))
    : String(v);
  wb.worksheets.slice(0, 2).forEach((ws, i) => {
    let rows = [];
    ws.eachRow({ includeEmpty: true }, r => {
      const a = [];
      for (let cc = 1; cc <= 9; cc++) a.push(fmt(val(r.getCell(cc).value)));
      rows.push(a);
    });
    rows = rows.slice(0, 26);
    let h = '<table class="bq">';
    rows.forEach((r, k) => {
      h += '<tr>';
      r.forEach((v, cx) => {
        const num = /^-?[\d,]+(\.\d+)?$/.test(v) && v !== '';
        h += '<td class="' + (k === 0 ? 'h0 ' : '') + (num ? 'n' : '') + '">' + v + '</td>';
      });
      h += '</tr>';
    });
    fs.writeFileSync(SP + '/v_boq_' + (i + 1) + '.html',
      '<meta charset="utf-8"><style>' + FONTCSS + `
      *{margin:0;padding:0;box-sizing:border-box}
      html,body{width:1920px;height:1080px;background:#fff;overflow:hidden}
      body{font:400 21px/1.5 Inter,sans-serif;-webkit-font-smoothing:antialiased;padding:46px 60px}
      .tt{font-size:26px;font-weight:700;color:#0f172a;margin-bottom:20px;letter-spacing:-.02em}
      .tt span{color:#64748b;font-weight:500}
      .bq{width:100%;border-collapse:collapse;table-layout:fixed}
      .bq td{border-bottom:1px solid #e2e8f0;padding:8px 12px;white-space:nowrap;
             overflow:hidden;text-overflow:ellipsis;color:#0f172a}
      .bq td.n{text-align:right;font-variant-numeric:tabular-nums}
      .bq td.h0{font-weight:700;color:#1d4ed8;border-bottom:2px solid #1d4ed8}
      </style><div class="tt">` + ws.name + ' <span>&mdash; PLATE3D take-off, written by the app</span></div>' + h + '</table>');
  });
}
