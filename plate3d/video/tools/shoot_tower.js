/* Tower crane film - the capture pass.

   Everything on screen is real. The models are built by the shipped engine from
   the shipped example; the spreadsheet page is that workbook read back cell by
   cell; the app chrome is the app. The claim of the film is that four cells
   drive the crane, so a mock-up of any of it would be a lie about the one thing
   being claimed.

   The four change beats are shot from a camera framed on the BIGGER of the two
   states, then the smaller one is loaded into that same frame. Otherwise the
   engine re-fits on every load and a crane that doubled in height looks
   identical - the growth is the shot.

   Frames come off the WebGL canvas rather than through page.screenshot: the
   compositor runs on a software rasteriser here and costs ~2.8 s a frame,
   against ~1.1 s for a drawing-buffer read. Only the beats that must show the
   app chrome pay full price, and those are stills.                          */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const SRC = SP + '/src';
const P3 = '/home/user/macroBIM/plate3d/';
const V = P3 + 'video/';
const FPS = 30, MO = 15;
const VW = 2336, VH = 1294;           // -> about 1920x1080 of canvas

fs.rmSync(SRC, { recursive: true, force: true });
fs.mkdirSync(SRC, { recursive: true });

let n = 0, T = 0;
const shots = [], caps = [];
function put(buf, dur) {
  const f = 's' + String(n++).padStart(4, '0') + '.jpg';
  fs.writeFileSync(SRC + '/' + f, buf);
  shots.push({ file: f, dur: dur });
  T += dur;
  return f;
}
const caption = (id, start, dur) => caps.push({ png: 't_' + id + '.png', start: start, dur: dur });

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

let app, doc;
// Wait on the file's own name: the page builds the tower as its opening demo,
// so a member count alone would match before the sheet under test is read.
async function load(file) {
  const base = path.basename(file);
  await app.setInputFiles('#pb-file', file);
  await app.waitForFunction(b => {
    const r = document.getElementById('pb-result');
    return r && r.innerText.indexOf(b) >= 0 && /Succeed/.test(r.innerText);
  }, base, { timeout: 300000 });
  await app.waitForTimeout(900);
}
const cam = () => app.evaluate(() => window.__cam());
const aim = c => app.evaluate(a => window.__aim(a.tx, a.ty, a.tz, a.dist, a.az, a.el), c);
async function frame(dur) {
  const d = await app.evaluate(() => window.__grab(0.92));
  return put(Buffer.from(d.split(',')[1], 'base64'), dur);
}
async function move(dur, fn) {
  const k = Math.max(1, Math.round(dur * MO));
  for (let i = 0; i < k; i++) { await fn(k === 1 ? 0 : i / (k - 1), i, k); await frame(dur / k); }
}
const ease = u => u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
const mix = (a, b, u) => a + (b - a) * u;

async function page2(file) {
  await doc.goto('file://' + SP + '/' + file, { waitUntil: 'load', timeout: 30000 });
  await doc.waitForTimeout(450);
}
const still = dur => doc.screenshot({ type: 'jpeg', quality: 92 }).then(b => put(b, dur));
const chrome = dur => app.screenshot({ type: 'jpeg', quality: 92 }).then(b => put(b, dur));

/* A pointer the film can drive. Drawn into the page rather than composited
   afterwards, so it is occluded and shadowed by the same page it points at -
   and so the zoom below magnifies it along with everything else. */
async function pointer() {
  await app.evaluate(() => {
    if (document.getElementById('__cur')) return;
    const d = document.createElement('div');
    d.id = '__cur';
    d.style.cssText = 'position:fixed;z-index:99999;pointer-events:none;left:-99px;top:-99px;' +
      'filter:drop-shadow(0 3px 7px rgba(0,0,0,.55))';
    d.innerHTML = '<svg viewBox="0 0 24 32" width="30" height="40">' +
      '<path d="M2 1 L2 25 L8 19.6 L12.2 29 L16.4 27 L12.2 17.8 L20 17.8 Z"' +
      ' fill="#fff" stroke="#0f172a" stroke-width="1.7" stroke-linejoin="round"/></svg>';
    document.body.appendChild(d);
  });
}
const curTo = (x, y) => app.evaluate(p => {
  const d = document.getElementById('__cur');
  if (d) { d.style.left = p.x + 'px'; d.style.top = p.y + 'px'; }
}, { x: Math.round(x), y: Math.round(y) });
// where something is on screen, so the shot can aim at it by name
const boxOf = sel => app.evaluate(q => {
  const e = document.querySelector(q); if (!e) return null;
  const r = e.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2,
           cy: r.top + r.height / 2 };
}, sel);
/* A clip rectangle at the film's aspect, centred on a point, `f` of full width.
   Kept inside the viewport so the crop never runs off the edge. */
function clipAt(cx, cy, f) {
  const w = Math.max(320, VW * f), h = w * VH / VW;
  let x = Math.min(Math.max(0, cx - w / 2), VW - w);
  let y = Math.min(Math.max(0, cy - h / 2), VH - h);
  return { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) };
}
const clipShot = (clip, dur) =>
  app.screenshot({ type: 'jpeg', quality: 92, clip: clip }).then(b => put(b, dur));

/* One change beat: frame on the big one, hold the small one, then swap. */
async function beat(before, after, id, hold, swap, orbit) {
  await load(after);
  const wide = await cam();
  await load(before);
  await aim(wide);
  // the sheet is shown as it is, then cleared, then typed - so the derived
  // cells beside the one being changed are seen to move with it
  caption('x' + id + '0', T + 0.25, hold - 0.30);
  await frame(hold);
  caption('x' + id + '1', T - 0.15, 0.75);
  await load(after);
  await aim(wide);
  caption('x' + id + '2', T + 0.30, swap + orbit - 0.45);
  await frame(swap);
  await move(orbit, u => aim({ ...wide, az: mix(wide.az, wide.az + 16, ease(u)),
                               dist: wide.dist * mix(1, 0.94, ease(u)) }));
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--allow-file-access-from-files',
            '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  app = await browser.newPage({ viewport: { width: VW, height: VH } });
  await wire(app);
  await app.goto('file://' + SP + '/video_page.html', { waitUntil: 'domcontentloaded' });
  await app.waitForTimeout(3500);
  doc = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await wire(doc);
  const log = m => console.log('  [' + T.toFixed(2) + 's] ' + m);

  /* 1  the crane, turning */
  await load(V + 'TOWER_0_BASE.xlsx');
  let c = await cam();
  caption('c01', 0.3, 4.2);
  await move(5.0, u => aim({ ...c, az: mix(c.az - 8, c.az + 8, u), dist: c.dist * 1.02 }));
  log('1 intro orbit');

  /* 2  title card */
  await page2('t_t02.html');
  await still(4.0);
  log('2 title');

  /* 3  it runs in the browser */
  caption('c03', T + 0.3, 5.2);
  await chrome(6.0);
  log('3 app chrome');

  /* 4  take the example - reach for the button, close in on it, press it.
     The click is the app's own: it fetches the workbook sitting next to the
     engine and the button says so. Nothing is staged but the pointer. */
  await app.evaluate(() => plateBuilder.openSamples());
  await app.waitForTimeout(600);
  await pointer();
  const btn = await boxOf('#pb-exb2');            // the Tower crane row
  const row = await boxOf('#pb-ex .ext tbody tr:nth-child(3)');
  await curTo(VW * 0.42, VH * 0.72);
  caption('c04', T + 0.3, 4.4);
  await chrome(1.0);
  // the hand goes over, and the frame closes in with it
  const k = 16;
  for (let i = 0; i < k; i++) {
    const u = ease(i / (k - 1));
    await curTo(mix(VW * 0.42, btn.cx - 6, u), mix(VH * 0.72, btn.cy - 5, u));
    await clipShot(clipAt(mix(VW / 2, row.x + row.w * 0.62, u),
                          mix(VH / 2, row.y + row.h / 2, u),
                          mix(1, 0.34, u)), 1.7 / k);
  }
  const tight = clipAt(row.x + row.w * 0.62, row.y + row.h / 2, 0.34);
  await clipShot(tight, 0.45);
  await app.evaluate(() => { const b = document.getElementById('pb-exb2');
    b.style.transform = 'scale(.94)'; b.style.filter = 'brightness(.92)'; });
  await clipShot(tight, 0.25);                    // pressed
  await app.evaluate(() => { const b = document.getElementById('pb-exb2');
    b.style.transform = ''; b.style.filter = ''; plateBuilder.getSample(2); });
  await app.waitForTimeout(700);
  await clipShot(tight, 1.5);                     // 'saved'
  await app.waitForTimeout(2400);
  await app.evaluate(() => { const d = document.getElementById('__cur');
    if (d) d.style.left = '-99px'; plateBuilder.closeSamples(); });
  await chrome(1.1);
  log('4 examples + download');

  /* 5  the four cells */
  await page2('t_param.html');
  await still(1.6);
  caption('c05', T + 0.2, 5.2);
  await doc.evaluate(() => document.body.classList.add('lit'));
  await still(5.4);
  log('5 PARAM');

  /* 6-8  one cell at a time */
  await beat(V + 'TOWER_0_BASE.xlsx', V + 'TOWER_1_MAST.xlsx', 'm', 2.6, 2.0, 6.4);
  log('6 mast');
  await beat(V + 'TOWER_0_BASE.xlsx', V + 'TOWER_2_JIB.xlsx', 'j', 2.6, 2.0, 6.4);
  log('7 jib');
  await beat(V + 'TOWER_0_BASE.xlsx', V + 'TOWER_3_HOOK.xlsx', 'h', 2.4, 1.8, 5.8);
  log('8 hook');

  /* 9  the turn - one file per step, so the jib turns and the mast does not */
  const STEP = fs.readdirSync(V + 'slew').filter(f => /\.xlsx$/.test(f)).sort();
  await load(V + 'slew/' + STEP[0]);
  const turn = await cam();
  caption('xs2', T + 0.3, 12.4);
  for (const f of STEP) {
    await load(V + 'slew/' + f);
    await aim(turn);
    await frame(13.0 / STEP.length);
  }
  log('9 slew');

  /* 10  all four at once */
  await load(V + 'TOWER_4_ALL.xlsx');
  c = await cam();
  caption('c10', T + 0.8, 5.6);
  await move(7.0, u => aim({ ...c, az: mix(c.az - 14, c.az + 10, ease(u)),
                             el: mix(c.el, c.el + 5, ease(u)),
                             dist: c.dist * mix(1.04, 0.92, ease(u)) }));
  log('10 hero');

  /* 11  outro */
  await page2('t_o11.html');
  await still(5.0);
  log('11 outro');

  fs.writeFileSync(SP + '/shots.json',
    JSON.stringify({ fps: FPS, shots: shots, caps: caps }, null, 1));
  console.log('\n' + shots.length + ' stills · ' + caps.length + ' captions · ' +
              T.toFixed(1) + ' s');
  await browser.close();
})();
