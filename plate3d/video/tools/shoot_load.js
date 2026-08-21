/* Reshoot the mast beat with the step the film was missing.

   As cut, the beat went: the sheet says 15, the sheet says 25, the crane is
   taller. That reads as though the app watches the workbook. It does not - the
   sheet is saved and Load Excel is pressed, and leaving that out misstates how
   the thing is used.

   So the beat now runs: 15 -> caret -> 25 -> File -> Load Excel -> the crane
   follows. Cause before effect, and only once: cuts 7 to 9 can cut straight
   because the loop has been shown.

   This shoots that one beat and splices it in place of the old one, rather than
   running the whole hour again. Frames before and after are reused untouched;
   captions after the beat shift by the difference in length.               */
const { chromium } = require('playwright-core');
const fs = require('fs');
const SP = __dirname, SRC = SP + '/src', NEW = SP + '/src6';
const V = '/home/user/macroBIM/plate3d/video/';
const FPS = 30, MO = 15, VW = 2336, VH = 1294;

const CUT6_FROM = 114, CUT6_COUNT = 98;      // checked against the timeline below
const base = JSON.parse(fs.readFileSync(SP + '/shots.json', 'utf8'));
const at = i => base.shots.slice(0, i).reduce((a, s) => a + s.dur, 0);
const T0 = at(CUT6_FROM), T1 = at(CUT6_FROM + CUT6_COUNT);
if (Math.abs(T0 - 27.34) > 0.01 || Math.abs(T1 - 38.34) > 0.01)
  throw new Error('cut 6 is not where it was thought to be: ' + T0.toFixed(2) + '..' + T1.toFixed(2));
console.log('cut 6: frames ' + CUT6_FROM + '..' + (CUT6_FROM + CUT6_COUNT - 1) +
            '  ' + T0.toFixed(2) + '..' + T1.toFixed(2) + 's');

fs.rmSync(NEW, { recursive: true, force: true }); fs.mkdirSync(NEW, { recursive: true });
let n = 0, T = T0;
const shots = [], caps = [];
function put(buf, dur) {
  const f = 'n' + String(n++).padStart(4, '0') + '.jpg';
  fs.writeFileSync(NEW + '/' + f, buf); shots.push({ file: f, dur: dur }); T += dur;
}
const caption = (id, start, dur) => caps.push({ png: 't_' + id + '.png', start: start, dur: dur });
const LIB = f => { let p = SP + '/node_modules/three/build/three.min.js';
  if (f.includes('OrbitControls')) p = SP + '/node_modules/three/examples/js/controls/OrbitControls.js';
  if (f.includes('polybool')) p = SP + '/node_modules/polybooljs/dist/polybool.min.js';
  if (f.includes('exceljs')) p = SP + '/node_modules/exceljs/dist/exceljs.min.js';
  return fs.readFileSync(p, 'utf-8'); };
const ease = u => u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
const mix = (a, b, u) => a + (b - a) * u;

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox','--allow-file-access-from-files',
           '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const app = await br.newPage({ viewport: { width: VW, height: VH } });
  await app.route('**/{unpkg.com,cdnjs.cloudflare.com}/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: LIB(r.request().url()) }));
  await app.route('**/fonts.{googleapis,gstatic}.com/**', r => r.abort());
  await app.goto('file://' + SP + '/video_page.html', { waitUntil: 'domcontentloaded' });
  await app.waitForTimeout(3500);

  const load = async f => { await app.setInputFiles('#pb-file', V + f);
    await app.waitForFunction(b => { const r = document.getElementById('pb-result');
      return r && r.innerText.indexOf(b) >= 0 && /Succeed/.test(r.innerText); }, f, { timeout: 300000 });
    await app.waitForTimeout(900); };
  const cam = () => app.evaluate(() => window.__cam());
  const aim = c => app.evaluate(a => window.__aim(a.tx, a.ty, a.tz, a.dist, a.az, a.el), c);
  const frame = async dur => put(Buffer.from(
    (await app.evaluate(() => window.__grab(0.92))).split(',')[1], 'base64'), dur);
  const chrome = dur => app.screenshot({ type: 'jpeg', quality: 92 }).then(b => put(b, dur));
  const clipShot = (clip, dur) =>
    app.screenshot({ type: 'jpeg', quality: 92, clip: clip }).then(b => put(b, dur));
  function clipAt(cx, cy, f) {
    const w = Math.max(320, VW * f), h = w * VH / VW;
    return { x: Math.round(Math.min(Math.max(0, cx - w / 2), VW - w)),
             y: Math.round(Math.min(Math.max(0, cy - h / 2), VH - h)),
             width: Math.round(w), height: Math.round(h) };
  }
  const boxOf = sel => app.evaluate(q => { const e = document.querySelector(q); if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height,
             cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; }, sel);
  const curTo = (x, y) => app.evaluate(p => { const d = document.getElementById('__cur');
    if (d) { d.style.left = p.x + 'px'; d.style.top = p.y + 'px'; } },
    { x: Math.round(x), y: Math.round(y) });
  await app.evaluate(() => {
    const d = document.createElement('div'); d.id = '__cur';
    d.style.cssText = 'position:fixed;z-index:99999;pointer-events:none;left:-99px;top:-99px;' +
      'filter:drop-shadow(0 3px 7px rgba(0,0,0,.55))';
    d.innerHTML = '<svg viewBox="0 0 24 32" width="30" height="40">' +
      '<path d="M2 1 L2 25 L8 19.6 L12.2 29 L16.4 27 L12.2 17.8 L20 17.8 Z"' +
      ' fill="#fff" stroke="#0f172a" stroke-width="1.7" stroke-linejoin="round"/></svg>';
    document.body.appendChild(d);
  });

  await load('TOWER_1_MAST.xlsx');
  const wide = await cam();
  await load('TOWER_0_BASE.xlsx');
  await aim(wide);

  /* the sheet as it stands, then cleared, then typed */
  caption('xm0', T + 0.25, 1.9);
  await frame(2.2);
  caption('xm1', T - 0.15, 0.70);
  caption('xm2', T + 0.25, 5.4);              // 25 is on screen from here on
  await frame(1.2);

  /* and now the step the film was missing */
  const fb = await boxOf('#pb-fmenu button.accent');
  await curTo(VW * 0.30, VH * 0.42);
  const kA = 9;
  for (let i = 0; i < kA; i++) {
    const u = ease(i / (kA - 1));
    await curTo(mix(VW * 0.30, fb.cx, u), mix(VH * 0.42, fb.cy + 2, u));
    await clipShot(clipAt(mix(VW / 2, fb.cx + 210, u), mix(VH / 2, fb.cy + 190, u),
                          mix(1, 0.40, u)), 1.1 / kA);
  }
  const menuClip = clipAt(fb.cx + 210, fb.cy + 190, 0.40);
  await app.evaluate(() => { const b = document.querySelector('#pb-fmenu button.accent');
    b.style.transform = 'scale(.95)'; });
  await clipShot(menuClip, 0.26);
  await app.evaluate(() => { document.querySelector('#pb-fmenu button.accent').style.transform = '';
    plateBuilder.toggleFileMenu(new MouseEvent('click')); });
  await app.waitForTimeout(400);
  await clipShot(menuClip, 0.55);                             // the menu is open
  const le = await boxOf('#pb-fmenu .drop button');
  const kB = 6;
  for (let i = 0; i < kB; i++) {
    await curTo(mix(fb.cx, le.cx - 30, ease(i / (kB - 1))),
                mix(fb.cy + 2, le.cy, ease(i / (kB - 1))));
    await clipShot(menuClip, 0.75 / kB);
  }
  await app.evaluate(() => { const b = document.querySelector('#pb-fmenu .drop button');
    b.style.background = '#eff6ff'; b.style.color = '#1d4ed8'; });
  await clipShot(menuClip, 0.5);                              // Load Excel, under the pointer
  await app.evaluate(() => { const b = document.querySelector('#pb-fmenu .drop button');
    b.style.transform = 'scale(.97)'; b.style.filter = 'brightness(.94)'; });
  await clipShot(menuClip, 0.28);                             // pressed
  await app.evaluate(() => { const b = document.querySelector('#pb-fmenu .drop button');
    b.style.transform = ''; b.style.filter = ''; b.style.background = ''; b.style.color = '';
    plateBuilder.closeFileMenu && plateBuilder.closeFileMenu();
    const m = document.querySelector('#pb-fmenu'); if (m) m.classList.remove('open');
    const d = document.getElementById('__cur'); if (d) d.style.left = '-99px';
  });
  await app.waitForTimeout(250);
  await chrome(0.6);

  /* and the crane follows */
  await load('TOWER_1_MAST.xlsx');
  await aim(wide);
  await frame(1.6);
  const k = Math.round(6.4 * MO);
  for (let i = 0; i < k; i++) {
    const u = ease(i / (k - 1));
    await aim({ ...wide, az: mix(wide.az, wide.az + 16, u), dist: wide.dist * mix(1, 0.94, u) });
    await frame(6.4 / k);
  }
  const DUR = T - T0;
  console.log(shots.length + ' frames · ' + DUR.toFixed(2) + 's  (was 11.00s)');

  /* ---- splice ---- */
  const delta = DUR - (T1 - T0);
  const out = { fps: FPS, shots: [], caps: [] };
  const OUT = SP + '/src2';
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  let m = 0;
  const take = (dir, file, dur) => {
    const f = 's' + String(m++).padStart(4, '0') + '.jpg';
    fs.copyFileSync(dir + '/' + file, OUT + '/' + f);
    out.shots.push({ file: f, dur: dur });
  };
  base.shots.slice(0, CUT6_FROM).forEach(s => take(SRC, s.file, s.dur));
  shots.forEach(s => take(NEW, s.file, s.dur));
  base.shots.slice(CUT6_FROM + CUT6_COUNT).forEach(s => take(SRC, s.file, s.dur));
  // captions: the beat's own are replaced; everything after it moves by delta
  base.caps.forEach(c => {
    if (/t_xm[012]\.png/.test(c.png)) return;                 // replaced below
    out.caps.push(c.start >= T1 - 0.001 ? { ...c, start: c.start + delta } : c);
  });
  caps.forEach(c => out.caps.push(c));
  out.caps.sort((a, b) => a.start - b.start);
  fs.writeFileSync(SP + '/shots.json', JSON.stringify(out, null, 1));
  fs.rmSync(SRC, { recursive: true, force: true });
  fs.renameSync(OUT, SRC);
  const total = out.shots.reduce((a, s) => a + s.dur, 0);
  console.log('spliced: ' + out.shots.length + ' stills · ' + out.caps.length +
              ' captions · ' + total.toFixed(2) + 's  (' +
              (delta >= 0 ? '+' : '') + delta.toFixed(2) + 's)');
  await br.close();
})();
