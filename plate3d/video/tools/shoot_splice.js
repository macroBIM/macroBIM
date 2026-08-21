/* Splice film - the capture pass.

   Everything on screen is real. The models are built by the shipped engine from
   the shipped example; the PARAM page is that workbook read back cell by cell;
   the take-off and the drawing are the files the app wrote when the buttons
   were pressed. The claim is that a spreadsheet gets you all three, so a
   mock-up of any of it would be a lie about the one thing being claimed.

   Two things are done differently from the tower's pass:

   Load Excel is in the film from the first change beat. The tower shot the
   beats as sheet-then-model and had to go back and splice the missing step in;
   cause belongs before effect, and once it has been seen the later beats can
   cut straight.

   shots.json is written after every cut. The tower's pass wrote it once at the
   end, and when the browser died 52 minutes in, 562 good frames were left with
   no record of how long each is held.                                       */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const SRC = SP + '/src_splice';
const CARD = 'splice/';
const V = SP + '/../';
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
const caption = (id, start, dur) => caps.push({ png: CARD + 's_' + id + '.png', start: start, dur: dur });
const save = () => fs.writeFileSync(SP + '/shots_splice.json',
  JSON.stringify({ fps: FPS, dir: 'src_splice', cards: CARD, shots: shots, caps: caps }, null, 1));

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
  await doc.evaluate(() => document.fonts.load('700 26px Inter')
    .then(() => document.fonts.load('800 40px Inter')).then(() => document.fonts.ready)).catch(() => {});
  await doc.waitForTimeout(450);
}
const still = dur => doc.screenshot({ type: 'jpeg', quality: 92 }).then(b => put(b, dur));
const chrome = dur => app.screenshot({ type: 'jpeg', quality: 92 }).then(b => put(b, dur));

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
const hideCur = () => app.evaluate(() => { const d = document.getElementById('__cur');
  if (d) d.style.left = '-99px'; });
const boxOf = sel => app.evaluate(q => {
  const e = document.querySelector(q); if (!e) return null;
  const r = e.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2,
           cy: r.top + r.height / 2 };
}, sel);
function clipAt(cx, cy, f) {
  const w = Math.max(320, VW * f), h = w * VH / VW;
  const x = Math.min(Math.max(0, cx - w / 2), VW - w);
  const y = Math.min(Math.max(0, cy - h / 2), VH - h);
  return { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) };
}
const clipShot = (clip, dur) =>
  app.screenshot({ type: 'jpeg', quality: 92, clip: clip }).then(b => put(b, dur));

/* File > Load Excel, driven through the app's own handlers. The pointer is the
   only staged thing; the menu opens and the item highlights because the app
   does it. */
async function loadExcelBeat(clip) {
  const fb = await boxOf('#pb-fmenu button.accent');
  const kA = 8;
  for (let i = 0; i < kA; i++) {
    const u = ease(i / (kA - 1));
    await curTo(mix(VW * 0.30, fb.cx, u), mix(VH * 0.42, fb.cy + 2, u));
    await clipShot(clip, 0.9 / kA);
  }
  await app.evaluate(() => { document.querySelector('#pb-fmenu button.accent').style.transform = 'scale(.95)'; });
  await clipShot(clip, 0.24);
  await app.evaluate(() => { document.querySelector('#pb-fmenu button.accent').style.transform = '';
    plateBuilder.toggleFileMenu(new MouseEvent('click')); });
  await app.waitForTimeout(400);
  await clipShot(clip, 0.5);
  const le = await boxOf('#pb-fmenu .drop button');
  const kB = 5;
  for (let i = 0; i < kB; i++) {
    const u = ease(i / (kB - 1));
    await curTo(mix(fb.cx, le.cx - 30, u), mix(fb.cy + 2, le.cy, u));
    await clipShot(clip, 0.6 / kB);
  }
  await app.evaluate(() => { const b = document.querySelector('#pb-fmenu .drop button');
    b.style.background = '#eff6ff'; b.style.color = '#1d4ed8'; });
  await clipShot(clip, 0.45);
  await app.evaluate(() => { const b = document.querySelector('#pb-fmenu .drop button');
    b.style.transform = 'scale(.97)'; b.style.filter = 'brightness(.94)'; });
  await clipShot(clip, 0.26);
  await app.evaluate(() => { const b = document.querySelector('#pb-fmenu .drop button');
    b.style.transform = ''; b.style.filter = ''; b.style.background = ''; b.style.color = '';
    plateBuilder.closeFileMenu && plateBuilder.closeFileMenu();
    const m = document.querySelector('#pb-fmenu'); if (m) m.classList.remove('open');
  });
  await hideCur();
  await app.waitForTimeout(200);
}

/* One change beat: frame on the deeper of the two, hold the shallower, type,
   press Load Excel, and let the joint follow. */
async function beat(before, after, id, hold, swap, orbit, withLoad) {
  await load(after);
  const wide = await cam();
  await load(before);
  await aim(wide);
  caption('x' + id + '0', T + 0.25, hold - 0.30);
  await frame(hold);
  caption('x' + id + '1', T - 0.15, 0.75);
  await frame(0.9);
  if (withLoad) {
    const fb = await boxOf('#pb-fmenu button.accent');
    await curTo(VW * 0.30, VH * 0.42);
    await loadExcelBeat(clipAt(fb.cx + 210, fb.cy + 190, 0.40));
  }
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
  const log = m => { save(); console.log('  [' + T.toFixed(2) + 's] ' + m); };

  /* 1  the finished joint, turning, bolts catching the light */
  await load(V + 'SPLICE_3_BOLT.xlsx');
  let c = await cam();
  caption('c01', 0.3, 4.2);
  await move(5.0, u => aim({ ...c, az: mix(c.az - 9, c.az + 9, u), el: c.el + 2,
                             dist: c.dist * 1.0 }));
  log('1 intro orbit');

  /* 2  title card */
  await page2(CARD + 's_t02.html');
  await still(4.0);
  log('2 title');

  /* 3  it runs in the browser - and the example is one button away */
  await pointer();
  const ex = await boxOf('button.guide.ex');
  await curTo(VW * 0.62, VH * 0.46);
  caption('c03', T + 0.3, 4.6);
  await chrome(1.6);
  const kA = 12;
  for (let i = 0; i < kA; i++) {
    const u = ease(i / (kA - 1));
    await curTo(mix(VW * 0.62, ex.cx - 4, u), mix(VH * 0.46, ex.cy - 4, u));
    await clipShot(clipAt(mix(VW / 2, ex.cx - 260, u), mix(VH / 2, ex.cy + 250, u),
                          mix(1, 0.44, u)), 1.5 / kA);
  }
  const exTight = clipAt(ex.cx - 260, ex.cy + 250, 0.44);
  await clipShot(exTight, 0.4);
  await app.evaluate(() => { const b = document.querySelector('button.guide.ex');
    b.style.transform = 'scale(.94)'; b.style.filter = 'brightness(.9)'; });
  await clipShot(exTight, 0.28);
  await app.evaluate(() => { const b = document.querySelector('button.guide.ex');
    b.style.transform = ''; b.style.filter = ''; plateBuilder.openSamples(); });
  await app.waitForTimeout(700);
  await clipShot(exTight, 0.5);
  await chrome(1.0);
  log('3 reach for Example');

  /* 4  take the splice. The row is found by its own name rather than by an
     index, so a re-ordered sample list cannot silently ring the wrong one. */
  const which = await app.evaluate(() => {
    const rows = [...document.querySelectorAll('#pb-ex .ext tbody tr')];
    const i = rows.findIndex(r => /splice/i.test(r.textContent));
    if (i < 0) return -1;
    const tr = rows[i];
    tr.style.outline = '3px solid #b45309';
    tr.style.outlineOffset = '-1px';
    tr.style.background = '#fffbeb';
    tr.style.borderRadius = '6px';
    return i;
  });
  if (which < 0) throw new Error('no Beam splice row in the sample list');
  const btn = await boxOf('#pb-exb' + which);
  const row = await boxOf('#pb-ex .ext tbody tr:nth-child(' + (which + 1) + ')');
  await curTo(VW * 0.42, VH * 0.74);
  caption('c04', T + 0.3, 4.6);
  await chrome(1.3);
  const kB = 14;
  for (let i = 0; i < kB; i++) {
    const u = ease(i / (kB - 1));
    await curTo(mix(VW * 0.42, btn.cx - 6, u), mix(VH * 0.74, btn.cy - 5, u));
    await clipShot(clipAt(mix(VW / 2, row.x + row.w * 0.62, u),
                          mix(VH / 2, row.y + row.h / 2, u),
                          mix(1, 0.34, u)), 1.6 / kB);
  }
  const tight = clipAt(row.x + row.w * 0.62, row.y + row.h / 2, 0.34);
  await clipShot(tight, 0.4);
  await app.evaluate(i => { const b = document.getElementById('pb-exb' + i);
    b.style.transform = 'scale(.94)'; b.style.filter = 'brightness(.92)'; }, which);
  await clipShot(tight, 0.26);
  await app.evaluate(i => { const b = document.getElementById('pb-exb' + i);
    b.style.transform = ''; b.style.filter = ''; plateBuilder.getSample(i); }, which);
  await app.waitForTimeout(900);
  await clipShot(tight, 1.6);
  await app.waitForTimeout(2200);
  await hideCur();
  await app.evaluate(() => plateBuilder.closeSamples());
  await chrome(0.9);
  log('4 take the splice');

  /* 5  the three cells */
  await page2(CARD + 's_param.html');
  await still(1.6);
  caption('c05', T + 0.2, 5.2);
  await doc.evaluate(() => document.body.classList.add('lit'));
  await still(5.4);
  log('5 PARAM');

  /* 6-8  one cell at a time. Only the first carries Load Excel: once the loop
     has been seen, repeating it three times would just be slower. */
  await beat(V + 'SPLICE_0_BASE.xlsx', V + 'SPLICE_1_SECT.xlsx',  's', 2.6, 2.0, 6.0, true);
  log('6 section');
  await beat(V + 'SPLICE_1_SECT.xlsx', V + 'SPLICE_2_PLATE.xlsx', 'p', 2.4, 1.8, 5.4, false);
  log('7 plate');
  await beat(V + 'SPLICE_2_PLATE.xlsx', V + 'SPLICE_3_BOLT.xlsx', 'b', 2.4, 1.8, 5.4, false);
  log('8 bolts');

  /* 9  the take-off. Held at the totals, then walked down into the part list,
     where the two rows the last two beats changed are sitting. */
  await page2(CARD + 's_boq.html');
  caption('c09', T + 0.3, 11.6);
  await still(2.6);
  const H = await doc.evaluate(() => document.body.scrollHeight);
  const kC = Math.round(7.0 * 8);
  for (let i = 0; i < kC; i++) {
    const u = ease(i / (kC - 1));
    await doc.evaluate(y => window.scrollTo(0, y), Math.round(u * (H - 1080)));
    await still(7.0 / kC);
  }
  await still(2.4);
  log('9 take-off');

  /* 10  the drawing. Five views, one frame each, then in on the web - the pitch
     chain there is the bolt beat's own arithmetic, written by the exporter. */
  await page2(CARD + 's_dxf.html');
  caption('c10', T + 0.3, 14.6);
  const nv = await doc.evaluate(() => window.__meta.views.length);
  for (let i = 0; i < nv; i++) {
    await doc.evaluate(k => window.__view(k), i);
    await doc.waitForTimeout(160);
    await still(1.9);
  }
  const web = await doc.evaluate(() => {
    const v = window.__meta.views[window.__meta.views.length - 1];
    return { x: window.__meta.width / 2, y: (v.top + v.bottom) / 2 };
  });
  const kD = Math.round(4.0 * 8);
  for (let i = 0; i < kD; i++) {
    const u = ease(i / (kD - 1));
    await doc.evaluate(a => window.__at(a.x, a.y, a.k), { x: web.x, y: web.y, k: mix(0.44, 1.15, u) });
    await still(4.0 / kD);
  }
  await still(1.6);
  log('10 drawing');

  /* 11  the joint again, close */
  await load(V + 'SPLICE_3_BOLT.xlsx');
  c = await cam();
  await move(6.8, u => aim({ ...c, az: mix(c.az - 12, c.az + 8, ease(u)),
                             el: mix(c.el, c.el + 6, ease(u)),
                             dist: c.dist * mix(1.02, 0.90, ease(u)) }));
  log('11 hero');

  /* 12  the three of them, side by side. The panels are the three things the
     film just produced, grabbed here rather than drawn: the model off the
     canvas, and the two pages as they stood in cuts 9 and 10. An empty
     three-panel graphic would be the one place the film illustrated itself. */
  const shot = await app.evaluate(() => window.__grab(0.94));
  fs.writeFileSync(SP + '/' + CARD + 'd12_model.jpg',
                   Buffer.from(shot.split(',')[1], 'base64'));
  await page2(CARD + 's_boq.html');
  await doc.evaluate(() => window.scrollTo(0, 0));
  await doc.screenshot({ path: SP + '/' + CARD + 'd12_boq.jpg', type: 'jpeg', quality: 92 });
  await page2(CARD + 's_dxf.html');
  await doc.evaluate(() => window.__view(window.__meta.views.length - 1));
  await doc.waitForTimeout(200);
  await doc.screenshot({ path: SP + '/' + CARD + 'd12_dxf.jpg', type: 'jpeg', quality: 92 });
  const b64 = f => 'data:image/jpeg;base64,' +
    fs.readFileSync(SP + '/' + CARD + f).toString('base64');
  await page2(CARD + 's_d12.html');
  await doc.evaluate(u => {
    ['b1', 'b2', 'b3'].forEach((id, i) => {
      const e = document.getElementById(id);
      if (e) e.style.backgroundImage = 'url(' + u[i] + ')';
    });
  }, [b64('d12_model.jpg'), b64('d12_boq.jpg'), b64('d12_dxf.jpg')]);
  await doc.waitForTimeout(400);
  caption('c12', T + 0.4, 4.4);
  await still(5.0);
  log('12 three deliverables');

  /* 13  outro */
  await page2(CARD + 's_o13.html');
  await still(5.0);
  log('13 outro');

  save();
  console.log('\n' + shots.length + ' stills · ' + caps.length + ' captions · ' +
              T.toFixed(1) + ' s');
  await browser.close();
})();
