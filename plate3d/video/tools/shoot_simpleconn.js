/* Simple connector film - the capture pass.

   Everything on screen is the shipped thing. The page is the production site
   served off disk, the form is quick_simpleconn.js, the model is the engine
   inside the real embed, and every value is TYPED INTO THE REAL BOX - focus,
   keystrokes, change, blur - so what the film claims about the form is what the
   form actually did.

   Two things are new here, and both come from this film showing a FORM rather
   than an app on its own.

   1. The picture is composed. The form is six chapters tall and the view sits
      below all of them, so the two are never on one screen - and this film is
      entirely about typing a number and watching the joint follow. So the 3D
      fills the frame and a crop of the real input block is laid over its top
      right. The crop is a screenshot of the page, never a redrawing of it.

   2. The window is sized for the INSET, not for the picture. At a wide window
      the form's table is 2200px across and unreadable once inset; at 1400 it is
      about 1024, which lands on the frame at roughly 1:1. That would leave the
      3D too small, so the capture harness forces the renderer's pixel ratio up
      instead (see RATIO). Nothing about what is drawn changes - only how finely
      it is sampled - and it lives in the harness exactly as preserveDrawingBuffer
      does, never in the engine.

   shots_simpleconn.json is written after every cut, as the splice pass does:
   when a browser dies an hour in, the frames are worth nothing without the
   record of how long each is held.                                          */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const SRC = SP + '/src_simpleconn';
const CARD = 'simpleconn/';
const MB = path.resolve(SP + '/../../..');            // .../macroBIM
const DZ = path.resolve(MB + '/../design');
const LIBDIR = MB + '/plate3d/tools';
const FPS = 30, MO = 15;
const VW = 1400, VH = 900;                            // sized for the inset
const CW = 1400, CH = 788;                            // 16:9 window of it, for chrome shots
const OW = 1920, OH = 1080;                           // the film
const INS = { w: 0.55, m: 40 };                       // inset width as a fraction, and its margin

fs.rmSync(SRC, { recursive: true, force: true });
fs.mkdirSync(SRC, { recursive: true });

let n = 0, T = 0;
const shots = [], caps = [];
function put(buf, dur) {
  const f = 's' + String(n++).padStart(4, '0') + '.png';
  fs.writeFileSync(SRC + '/' + f, buf);
  shots.push({ file: f, dur: dur });
  T += dur;
  return f;
}
const caption = (id, start, dur) => caps.push({ png: CARD + 's_' + id + '.png', start: start, dur: dur });
const save = () => fs.writeFileSync(SP + '/shots_simpleconn.json',
  JSON.stringify({ fps: FPS, dir: 'src_simpleconn', cards: CARD, w: OW, h: OH,
                   shots: shots, caps: caps }, null, 1));

/* ---------------- serving the two repos, and the harness ---------------- */
const LIB = f => {
  let p = LIBDIR + '/node_modules/three/build/three.min.js';
  if (f.includes('OrbitControls')) p = LIBDIR + '/node_modules/three/examples/js/controls/OrbitControls.js';
  if (f.includes('polybool')) p = LIBDIR + '/node_modules/polybooljs/dist/polybool.min.js';
  if (f.includes('exceljs')) p = LIBDIR + '/node_modules/exceljs/dist/exceljs.min.js';
  return fs.readFileSync(p, 'utf-8');
};
/* Capture only. The engine caps its own pixel ratio at 2, which is right for a
   browser and not enough here: the view pane is about 675 CSS wide at the
   window this film is shot at, and the picture has to reach 1920 across without
   being blown up. three.js hangs setPixelRatio off the instance, not the
   prototype, so the constructor is what has to be wrapped. */
const RATIO = '<script>(function(){var W=THREE.WebGLRenderer;' +
  'THREE.WebGLRenderer=function(p){var o=new W(p);var S=o.setPixelRatio.bind(o);' +
  'o.setPixelRatio=function(){return S(3);};S(3);return o;};' +
  'THREE.WebGLRenderer.prototype=W.prototype;})();</script>';
/* Lifted out of video_page.html rather than copied, so the four films cannot
   drift apart on what the harness is. */
const SHIM = (() => {
  const s = fs.readFileSync(SP + '/video_page.html', 'utf8');
  const a = s.indexOf('<script>\n/* Capture harness');
  const b = s.indexOf('})();\n</script>', a);
  if (a < 0 || b < a) throw new Error('capture harness not found in video_page.html');
  return s.slice(a, b + '})();\n</script>'.length) + RATIO;
})();
const HOST = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
  '<link rel="stylesheet" href="/design/layout_style.css"></head>' +
  '<body style="margin:0;display:flex;flex-direction:column;height:100vh">' +
  '<div id="app-root"></div>' +
  ['rebartable_claude', 'steelsection_claude', 'mod_concrete', 'mod_rebar',
   'mod_rebar_leng', 'layout_body'].map(f => '<script src="/design/' + f + '.js"></script>').join('') +
  '<script>window.addEventListener("DOMContentLoaded",function(){' +
  'initLayout({visits:1,totalVisits:2});});</script></body></html>';

/* The stage: the picture full bleed, the crop of the form over its top right.
   A canvas rather than a screenshotted page - a film is thousands of frames and
   a screenshot costs a compositor pass each, while drawing two images and
   reading the buffer back is the same picture for a fraction of the time. */
const STAGE = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0">
<canvas id="c" width="${OW}" height="${OH}"></canvas>
<script>
var C = document.getElementById('c'), X = C.getContext('2d');
function img(u){ return new Promise(function(ok){ var i=new Image(); i.onload=function(){ok(i);}; i.src=u; }); }
window.__stage = function (pic, ins, opt) {
  opt = opt || {};
  return Promise.all([img(pic), ins ? img(ins) : null]).then(function (r) {
    var p = r[0], q = r[1], W = ${OW}, H = ${OH};
    X.clearRect(0, 0, W, H);
    var s = Math.max(W / p.width, H / p.height);          // fill, do not squash
    X.drawImage(p, (W - p.width * s) / 2, (H - p.height * s) / 2, p.width * s, p.height * s);
    if (!q) return C.toDataURL('image/png');
    var w = Math.round(W * (opt.w || 0.55)), h = Math.round(w * q.height / q.width);
    var m = opt.m == null ? 40 : opt.m, x = W - w - m, y = m, rd = 14;
    X.save();
    X.shadowColor = 'rgba(2,6,23,.55)'; X.shadowBlur = 38; X.shadowOffsetY = 12;
    X.fillStyle = '#fff';
    X.beginPath();
    if (X.roundRect) X.roundRect(x - 10, y - 10, w + 20, h + 20, rd); else X.rect(x - 10, y - 10, w + 20, h + 20);
    X.fill();
    X.restore();
    X.save();
    X.beginPath();
    if (X.roundRect) X.roundRect(x, y, w, h, rd - 6); else X.rect(x, y, w, h);
    X.clip();
    X.drawImage(q, x, y, w, h);
    X.restore();
    return C.toDataURL('image/png');
  });
};
</script></body></html>`;

const mime = f => f.endsWith('.css') ? 'text/css'
  : f.endsWith('.js') ? 'application/javascript'
  : f.endsWith('.html') ? 'text/html'
  : f.endsWith('.csv') ? 'text/csv' : 'application/octet-stream';

/* The card pages are local files with the font inlined, so they need nothing
   intercepted - only Google's copy of it kept out, which would otherwise be
   fetched over a network this run does not have. */
async function wire(page) {
  await page.route('**/fonts.{googleapis,gstatic}.com/**', r => r.abort());
}
async function serve(page) {
  await page.route('**/*', route => {
    const raw = route.request().url();
    if (raw.startsWith('file:')) return route.continue();   // a card page, off disk
    const u = new URL(raw), p = u.pathname;
    if (u.hostname === 'shoot.test' && p === '/host.html')
      return route.fulfill({ contentType: 'text/html', body: HOST });
    if (u.hostname === 'shoot.test' && p === '/stage.html')
      return route.fulfill({ contentType: 'text/html', body: STAGE });
    if (u.hostname.includes('unpkg') || u.hostname.includes('cdnjs'))
      return route.fulfill({ contentType: 'application/javascript', body: LIB(u.href) });
    if (u.hostname.includes('fonts.')) return route.abort();
    let f = null;
    if (p.startsWith('/design/')) f = path.join(DZ, p.slice(8));
    else if (p.startsWith('/macroBIM/')) f = path.join(MB, p.slice(10));
    if (f && fs.existsSync(f)) {
      if (/embed(_test)?\.html$/.test(f)) {                 // the harness, ahead of the engine
        const h = fs.readFileSync(f, 'utf8');
        const at = h.search(/<script src="plate_builder(_test)?\.js/);
        if (at < 0) throw new Error('no engine tag in ' + f);
        return route.fulfill({ contentType: 'text/html', body: h.slice(0, at) + SHIM + '\n' + h.slice(at) });
      }
      return route.fulfill({ body: fs.readFileSync(f), contentType: mime(f) });
    }
    return route.abort();
  });
}

/* ---------------- the pieces of a shot ---------------- */
let A, emb, S, D;
const MOUNT = '#mount-quick-simpleconn ';
const SEL = k => MOUNT + '[data-k="' + k + '"]';
const ease = u => u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
const mix = (a, b, u) => a + (b - a) * u;

const pic = () => emb.evaluate(() => { window.__pbDraw();
  return window.__pbCanvas.toDataURL('image/png'); });
const cam = () => emb.evaluate(() => window.__cam());
const aim = c => emb.evaluate(a => window.__aim(a.tx, a.ty, a.tz, a.dist, a.az, a.el), c);

/* The block of the form a cut is about: its dark heading down through the rows
   named. Taken off the live page - it is the site, at the size the site draws
   it - and never redrawn. */
async function block(ch, rows) {
  const box = await A.evaluate(a => {
    const el = document.querySelector('#mount-quick-simpleconn [data-ch="' + a.ch + '"]');
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const h3 = el.querySelector('h3'), tb = el.querySelector('table');
    const t = h3.getBoundingClientRect();
    const last = a.rows ? tb.rows[Math.min(a.rows, tb.rows.length - 1)] : tb.rows[tb.rows.length - 1];
    const b = last.getBoundingClientRect(), z = tb.getBoundingClientRect();
    return { x: t.left - 8, y: t.top - 8, width: z.width + 16, height: b.bottom - t.top + 16 };
  }, { ch: ch, rows: rows || 0 });
  if (!box) throw new Error('no chapter ' + ch + ' on the page');
  await A.waitForTimeout(160);
  return box;
}
const shot = async box => 'data:image/png;base64,' +
  (await A.screenshot({ clip: box, type: 'png' })).toString('base64');

async function frame(dur, ins) {
  const p = await pic();
  const d = await S.evaluate(a => window.__stage(a.p, a.i, a.o), { p: p, i: ins || null, o: INS });
  return put(Buffer.from(d.split(',')[1], 'base64'), dur);
}
async function move(dur, fn, ins) {
  const k = Math.max(1, Math.round(dur * MO));
  for (let i = 0; i < k; i++) { await fn(k === 1 ? 0 : i / (k - 1), i, k); await frame(dur / k, ins); }
}
const hold = async (dur, box) => frame(dur, box ? await shot(box) : null);
// the site itself, in a 16:9 window of the browser
const chrome = dur => A.screenshot({ type: 'png', clip: { x: 0, y: 0, width: CW, height: CH } })
  .then(b => put(b, dur));
const still = dur => D.screenshot({ type: 'png' }).then(b => put(b, dur));

async function page2(file) {
  await D.goto('file://' + SP + '/' + file, { waitUntil: 'load', timeout: 30000 });
  await D.evaluate(() => document.fonts.load('700 26px Inter')
    .then(() => document.fonts.load('800 40px Inter')).then(() => document.fonts.ready)).catch(() => {});
  await D.waitForTimeout(450);
}

/* What the model came out as, read back off the panel the way a viewer reads
   it. Every number this film quotes is measured here, never assumed. */
async function built() {
  const t = await emb.evaluate(() => (document.getElementById('pb-result') || {}).innerText || '');
  const m = t.match(/placed (\d+)/);
  const w = (await emb.evaluate(() => (document.getElementById('pb-total') || {}).innerText || ''))
    .match(/([\d.]+)\s*kg/);
  return { n: m ? +m[1] : null, kg: w ? +w[1] : null };
}
const settle = async (ms) => { await A.waitForTimeout(ms || 2400); return built(); };

/* A value typed into the real box, one keystroke at a time, with the inset
   re-taken between them so the digits are seen landing. */
async function typeIn(k, text, box, per) {
  const sel = SEL(k);
  await A.focus(sel);
  await A.keyboard.press('Control+a');
  const s = String(text);
  for (let i = 0; i < s.length; i++) {
    await A.keyboard.type(s[i]);
    await frame(per == null ? 0.16 : per, await shot(box));
  }
  await A.dispatchEvent(sel, 'change');
  await A.evaluate(q => { const e = document.querySelector(q); if (e) e.blur(); }, sel);
}
/* One box at a time, and not four in a row. Every handler in the form ends in
   redraw(), which rebuilds the table - so filling four boxes and then firing
   four change events keeps only the first: the redraw puts the other three back
   to what V still says, and their change then reports the old value. The first
   pass of this film lost a beam to exactly that, and the ladder read
   116 - 124 - 124 instead of 111 - 119 - 124. */
async function setCell(k, v) {
  const sel = SEL(k);
  await A.fill(sel, String(v));
  await A.dispatchEvent(sel, 'change');
  await A.waitForTimeout(280);                  // let the redraw land first
}
const setAll = async (keys, v) => { for (const k of keys) await setCell(k, v); };
async function pick(k, value, box) {
  await A.selectOption(SEL(k), value);
  await A.evaluate(q => { const e = document.querySelector(q); if (e) e.blur(); }, SEL(k));
  if (box) await frame(0.4, await shot(box));
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
           '--enable-unsafe-swiftshader'] });
  A = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 });
  await serve(A);
  A.on('pageerror', e => console.log('  ERR ' + String(e).slice(0, 140)));
  await A.goto('https://shoot.test/host.html', { waitUntil: 'domcontentloaded' });
  // the layout wires showPage on DOMContentLoaded; wait for it rather than
  // guessing at a delay
  await A.waitForFunction(() => typeof window.showPage === 'function', null, { timeout: 60000 });
  await A.evaluate(() => window.showPage('quick-simpleconn'));
  await A.waitForFunction(() => !!document.querySelector('#mount-quick-simpleconn iframe'),
                          null, { timeout: 60000 });
  await A.waitForTimeout(10000);
  emb = A.frames().find(f => /embed/.test(f.url()));
  if (!emb) throw new Error('the form never brought up its frame');

  S = await browser.newPage({ viewport: { width: OW, height: OH } });
  await serve(S);
  await S.goto('https://shoot.test/stage.html', { waitUntil: 'domcontentloaded' });
  D = await browser.newPage({ viewport: { width: OW, height: OH }, deviceScaleFactor: 2 });
  await wire(D);

  const log = async m => { save(); const b = await built();
    console.log('  [' + T.toFixed(1).padStart(5) + 's] ' + m +
                (b.n ? '   ' + b.n + ' members · ' + b.kg + ' kg' : '')); };

  /* the cells this film types into, by the address the form gives them */
  const K = { type: 'c0r1i0', sect: 'c0r1i1', alpha: 'c0r1i7',
              up: 'c0r2i3', mid: 'c0r2i5', low: 'c0r2i7',
              thick: ['c1r1i5', 'c1r2i5'], clear: ['c1r1i6', 'c1r2i6'],
              bmL: ['c5r1i7', 'c5r2i7', 'c5r3i7', 'c5r4i7'],
              bmD: ['c5r1i0', 'c5r2i0', 'c5r3i0', 'c5r4i0'] };
  const H300 = 'H-300x300x10x15 r18', H440 = 'H-440x300x11x18 r13', TUBE = 'R-300x300x12 r30';

  /* ---- 1  the finished joint, turning. Four beams, so the shape the whole
       film is about is on screen before a single box is named. ---- */
  await setAll(K.bmL, 900);
  await settle(3000);
  let c = await cam();
  caption('c01', 0.3, 4.6);
  await move(6.0, u => aim({ ...c, az: mix(c.az - 10, c.az + 10, u), el: c.el + 2 }));
  await log('1 the joint');

  /* ---- 2  title ---- */
  await page2(CARD + 's_t02.html');
  await still(4.0);
  await log('2 title');

  /* ---- 3  it is already open: the sidebar, the group, the item ---- */
  await A.evaluate(() => window.showPage('home'));
  await A.waitForTimeout(900);
  caption('c03', T + 0.3, 5.4);
  await chrome(1.4);
  await A.evaluate(() => { const t = document.getElementById('quick3dToggle');
    if (t) t.click(); });
  await A.waitForTimeout(700);
  await chrome(1.8);
  await A.evaluate(() => window.showPage('quick-simpleconn'));
  await A.waitForTimeout(2600);
  emb = A.frames().find(f => /embed/.test(f.url()));
  await A.waitForTimeout(7000);
  await chrome(2.8);
  await log('3 already open');

  /* ---- 4  the whole form, once, top to bottom ---- */
  caption('c04', T + 0.3, 5.4);
  const sc = await A.evaluate(() => {
    const all = [document.scrollingElement];
    document.querySelectorAll('*').forEach(e => {
      if (e.scrollHeight > e.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(e).overflowY))
        all.push(e);
    });
    const e = all.filter(Boolean).sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
    e.dataset.shootScroller = '1';
    return { h: e.scrollHeight - e.clientHeight };
  });
  const scrollTo = y => A.evaluate(v => {
    const e = document.querySelector('[data-shoot-scroller="1"]') || document.scrollingElement;
    e.scrollTop = v;
  }, y);
  const kS = 30;
  for (let i = 0; i < kS; i++) {
    await scrollTo(Math.round(sc.h * ease(i / (kS - 1))));
    await chrome(6.0 / kS);
  }
  await scrollTo(0);
  await log('4 six blocks');

  /* ---- 5-9 are the column, and they read best with no beams in the way ---- */
  await setAll(K.bmL, 0);
  await settle(3000);
  const colCam = await cam();                   // one viewpoint for the whole column tour
  await log('   beams cleared');

  /* ---- 5  three pieces, and 0 takes one away ---- */
  let b1 = await block(1);
  await aim(colCam);
  caption('c05', T + 0.3, 11.2);
  await hold(2.4, b1);
  await typeIn(K.up, '0', b1, 0.3);
  await settle();
  await hold(3.6, await block(1));
  await typeIn(K.up, '700', b1, 0.22);
  await settle();
  await aim(colCam);
  await hold(3.4, await block(1));
  await log('5 three pieces');

  /* ---- 6  name the section, and five boxes fill themselves ---- */
  caption('c06', T + 0.3, 13.2);
  await hold(2.0, await block(1));
  await pick(K.sect, H440, b1);
  await settle();
  await aim(colCam);
  await hold(4.2, await block(1));
  await pick(K.alpha, '90', b1);
  await settle();
  await aim(colCam);
  await hold(3.4, await block(1));
  await pick(K.alpha, '0', b1);
  await settle();
  await aim(colCam);
  await hold(2.6, await block(1));
  await log('6 H-440x300x11x18 r13');

  /* ---- 7  or a tube, and the detail follows ---- */
  caption('c07', T + 0.3, 11.2);
  await pick(K.type, 'R', b1);
  await settle();
  await A.selectOption(SEL(K.sect), TUBE).catch(() => {});
  await A.dispatchEvent(SEL(K.sect), 'change');
  await settle();
  await aim(colCam);
  await hold(5.5, await block(1));
  // chapter 2 goes grey and chapter 3 turns into an end plate: both are the
  // point of the cut, so both are shown
  await hold(3.2, await block(2, 3));
  await hold(3.0, await block(3));
  await log('7 a tube');

  /* ---- 8  back to an H, and the splice plates it calls for ---- */
  await pick(K.type, 'H', b1);
  await settle();
  await A.selectOption(SEL(K.sect), H300).catch(() => {});
  await A.dispatchEvent(SEL(K.sect), 'change');
  await settle();
  await aim(colCam);
  caption('c08', T + 0.3, 9.2);
  await hold(4.6, await block(3));
  await hold(5.4, await block(3));
  await log('8 splice plates');

  /* ---- 9  the bolts, and a length per grip ---- */
  caption('c09', T + 0.3, 5.2);
  await hold(6.0, await block(4));
  await log('9 bolts');

  /* ---- 10  a length typed, a beam standing. The camera is set on the four
       beams first so the last one does not walk out of frame. ---- */
  await setAll(K.bmL, 900);
  await settle(3000);
  const bmCam = await cam();
  await setAll(K.bmL, 0);
  await settle(3000);
  await aim(bmCam);
  caption('c10', T + 0.3, 19.2);
  let b6 = await block(6);
  await hold(2.2, b6);
  for (let i = 0; i < 4; i++) {
    await typeIn(K.bmL[i], '900', b6, 0.2);
    const r = await settle();
    await aim(bmCam);
    b6 = await block(6);
    await hold(3.6, b6);
    console.log('     beam ' + (i + 1) + ' -> ' + r.n + ' members · ' + r.kg + ' kg');
  }
  await log('10 four beams');

  /* ---- 11  declared in chapter 5, named against a beam in chapter 6. The two
       are far apart on the page, so the cut carries both insets. ---- */
  caption('c11', T + 0.3, 15.2);
  await hold(4.4, await block(5, 5));
  await hold(3.2, await block(6));
  await pick(K.bmD[2], 'C1', b6);
  const r11 = await settle();
  await aim(bmCam);
  await hold(4.4, await block(6));
  await hold(3.6, await block(5, 5));
  await log('11 Y+ becomes C1  (' + r11.n + ')');
  await pick(K.bmD[2], 'C3', b6);
  await settle();
  await aim(bmCam);

  /* ---- 12  turn the stiffeners off and the coped flange comes back ---- */
  const b2 = await block(2, 3);
  caption('c12', T + 0.3, 15.2);
  await hold(3.0, b2);
  await setAll(K.thick, 0);
  const r12 = await settle();
  await aim(bmCam);
  await hold(5.2, await block(2, 3));
  await setAll(K.thick, 12);
  await settle();
  await aim(bmCam);
  await hold(5.0, await block(2, 3));
  await log('12 stiffener off -> ' + r12.n + ' · ' + r12.kg + ' kg, and back');

  /* ---- 13  the room the clearance leaves ---- */
  caption('c13', T + 0.3, 9.2);
  await hold(2.6, await block(2, 3));
  await setAll(K.clear, 0);
  const r13 = await settle();
  await aim(bmCam);
  await hold(5.0, await block(2, 3));
  await setAll(K.clear, 20);
  await settle();
  await aim(bmCam);
  await hold(2.4, await block(2, 3));
  await log('13 clearance 0 -> ' + r13.n + ' · ' + r13.kg + ' kg');

  /* ---- 14  what comes out: the drawing and the take-off. Both are the files
       prep_simpleconn.js pulled out of this same form, drawn the way the file
       is drawn and never re-typeset - the film says "press the button and this
       is what you get", so a tidier version would be a lie about the one thing
       being claimed. ---- */
  caption('c14', T + 0.3, 13.4);
  await page2(CARD + 's_dxf.html');
  const nv = await D.evaluate(() => window.__meta.views.length);
  for (let i = 0; i < nv; i++) {
    await D.evaluate(k => window.__view(k), i);
    await D.waitForTimeout(160);
    await still(6.6 / nv);
  }
  await page2(CARD + 's_boq1.html');
  await still(3.4);
  await page2(CARD + 's_boq2.html');
  await still(4.0);
  await log('14 drawing and take-off');

  /* ---- 15  and the sheet, which was there all along. PARAM alone would read
       as the form exporting the form; it is the input tab - SECT, PLATE, the
       NOTCH rows cut 12 turned off - that shows it is the same grammar the
       first three films taught. ---- */
  caption('c15', T + 0.3, 9.4);
  await page2(CARD + 's_param.html');
  await still(4.0);
  await page2(CARD + 's_input.html');
  await still(6.0);
  await log('15 the sheet, all along');

  /* ---- 16  the signature ---- */
  await page2(CARD + 's_o16.html');
  await still(5.0);
  await log('16 outro');

  save();
  console.log('\n' + shots.length + ' stills · ' + caps.length + ' captions · ' +
              T.toFixed(1) + ' s');
  await browser.close();
})();
