/* Shoot the Golden Gate film.

       node video/tools/prep_ggb.js          # 86 workbooks + the DXF sheet
       node video/tools/mkcards_ggb.js
       node video/tools/rendercards_ggb.js
       node video/tools/shoot_ggb.js         # this - about 15 minutes
       node video/tools/assemble_ggb.js

   Writes ggb_src/s0000.jpg… and shots_ggb.json, which is the same contract the
   other films' assemblers read: every still carries how long it is held, and
   the captions carry when they come up.

   Two things make this shoot different from the ones before it.

   THE CAMERA IS SET, NOT AVOIDED. video_page.html hands over __aim, so after
   every load the camera is put back where it was. The earlier films had to not
   touch the View buttons and hope the engine did not refit; here the sequence
   of 86 workbooks arrives into one frame because each one is aimed into it.

   NOTHING IS HIDDEN BY HAND. The bridge grows because each file IS the bridge
   at that moment - a bay only exists once the bays between it and a tower do.
   The alternative was to toggle members in the viewer, which would have made
   the erection a lighting effect rather than a model.                        */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const P3T = path.resolve(SP, '../../tools');       // plate3d/tools - node_modules live there
const BOOKS = path.resolve(SP, '../ggb');
const CARDS = path.join(SP, 'cards_ggb');
const SRC = path.join(SP, 'ggb_src');
const DXFPAGE = path.join(SP, 'ggb_dxf.html');

const FPS = 30;
const MO = 12;                    // stills per second of camera motion
const VW = 2336, VH = 1294;       // -> 1920x1080 after the assembler's crop

/* International Orange. The colour is not in the sheet - the engine hands out a
   palette in read order - so it is set here the same way the swatch in the app
   sets it, once per load because a load resets it. */
/* Five oranges, not one. The bridge is International Orange, but a film of it
   all in one tone is a film where the truss going out cannot be seen going out.
   So the livery is graded by value instead: towers deepest, cables bright,
   the truss lighter than the cables it hangs from, the deck lightest of all -
   because the deck is the thing that advances in the last cut. */
const LIVERY = { 'MD.TWR': '#b8351a', 'MD.MCB': '#ff6a2a', 'MD.HGR': '#d1552e',
                 'MD.TRS': '#ffb070', 'MD.DK': '#ffd6b8' };

/* The three cameras, each chosen by looking at what it gave - see
   video/tools/aim_ggb.js and SCRIPT_GGB.md §7. */
const ISO   = { tx: 0, ty: 0, tz: 98000, dist: 1950000, az: -62, el: 19 };
const BUILD = { tx: 0, ty: 0, tz: 125000, dist: 1050000, az: 85, el: 4 };
const HERO  = { tx: 640080, ty: 0, tz: 165000, dist: 360000, az: 55, el: -4 };
/* And the three that look at ONE thing. The first cut of these stood too far
   back: the caption said eight lifts, one bay, straight segments, and the frame
   showed a stick, a stretch of bridge, and a curve. A close-up has to be close
   enough that the words are already true before they are read. */
const S_TWR = { tx: -640080, ty: 0, tz: 150000, dist: 260000, az: 62, el: 4 };
const S_TRS = { tx: -350000, ty: 0, tz: 71000, dist: 45000, az: 72, el: 10 };
const S_CBL = { tx: -640080, ty: 0, tz: 215000, dist: 95000, az: 80, el: 5 };

const LIB = f => {
  let p = P3T + '/node_modules/three/build/three.min.js';
  if (f.includes('OrbitControls')) p = P3T + '/node_modules/three/examples/js/controls/OrbitControls.js';
  if (f.includes('polybool')) p = P3T + '/node_modules/polybooljs/dist/polybool.min.js';
  if (f.includes('exceljs')) p = P3T + '/node_modules/exceljs/dist/exceljs.min.js';
  return fs.readFileSync(p, 'utf-8');
};

const shots = [], caps = [];
let n = 0, T = 0;
function put(buf, dur) {
  const f = 's' + String(n++).padStart(4, '0') + '.jpg';
  fs.writeFileSync(path.join(SRC, f), buf);
  shots.push({ file: f, dur: dur });
  T += dur;
}
const caption = (id, start, dur) => caps.push({ png: 'cards_ggb/t_' + id + '.png',
                                                start: start, dur: dur });
const card = (id, dur) => put(fs.readFileSync(path.join(CARDS, 't_' + id + '.jpg')), dur);
const ease = u => u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
const mix = (a, b, u) => a + (b - a) * u;

(async () => {
  fs.rmSync(SRC, { recursive: true, force: true });
  fs.mkdirSync(SRC, { recursive: true });

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
           '--enable-unsafe-swiftshader'] });
  const app = await browser.newPage({ viewport: { width: VW, height: VH } });
  await app.route('**/{unpkg.com,cdnjs.cloudflare.com}/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: LIB(r.request().url()) }));
  await app.goto('file://' + SP + '/video_page.html', { waitUntil: 'domcontentloaded' });
  await app.waitForTimeout(3000);

  const aim = c => app.evaluate(a => window.__aim(a.tx, a.ty, a.tz, a.dist, a.az, a.el), c);
  const grab = () => app.evaluate(() => window.__grab(0.92))
                        .then(d => Buffer.from(d.split(',')[1], 'base64'));
  async function frame(dur) { put(await grab(), dur); }
  async function move(dur, fn) {                      // a camera move, as stills
    const k = Math.max(1, Math.round(dur * MO));
    for (let i = 0; i < k; i++) { await fn(k === 1 ? 0 : i / (k - 1)); await frame(dur / k); }
  }
  /* Load a workbook and put the camera back. The engine reframes on every load
     and repaints the palette from scratch, so both are restated here - that is
     what lets 86 files be one shot. */
  async function load(book, cam) {
    await app.setInputFiles('#pb-file', path.join(BOOKS, book));
    await app.waitForFunction(f => {
      const r = document.getElementById('pb-result');
      return r && r.innerText.indexOf(f) >= 0 && /Succeed|Failed|error/i.test(r.innerText);
    }, book, { timeout: 300000 });
    await app.evaluate(l => Object.keys(l).forEach(k => {
      try { window.plateBuilder.setColor('module', k, l[k]); } catch (e) {}
    }), LIVERY);
    await app.waitForTimeout(500);
    if (cam) await aim(cam);
    await app.waitForTimeout(180);
  }
  const log = m => console.log('  ' + String(Math.round(T)).padStart(3) + 's  ' + m);

  /* 1 — the card the film opens on */
  card('open', 6);
  log('1 opening card');

  /* 2 — the whole bridge, ISO, all of it in frame */
  await load('GGB_05_done.xlsx', ISO);
  caption('aerial', T, 12);
  await move(12, u => aim({ ...ISO, az: mix(ISO.az, ISO.az + 24, ease(u)),
                                    el: mix(ISO.el, ISO.el + 7, ease(u)) }));
  log('2 aerial orbit');

  /* 3-5 — the three things that get written, each seen in place.
     Not the preview window: the preview draws on its own canvas and would need
     its own capture path, and a section is more legible standing in the bridge
     than floating on a grid. */
  await load('GGB_00_towers.xlsx', { ...S_TWR, dist: S_TWR.dist * 1.6 });
  caption('sec1', T, 9);
  await move(9, u => aim({ ...S_TWR, dist: mix(S_TWR.dist * 1.6, S_TWR.dist, ease(u)) }));
  log('3 tower lift');

  await load('GGB_03_truss_41.xlsx', { ...S_TRS, dist: S_TRS.dist * 3.2 });
  caption('sec2', T, 9);
  await move(9, u => aim({ ...S_TRS, dist: mix(S_TRS.dist * 3.2, S_TRS.dist, ease(u)) }));
  log('4 truss bay');

  await load('GGB_01_cables.xlsx', { ...S_CBL, dist: S_CBL.dist * 2.6 });
  caption('sec3', T, 9);
  await move(9, u => aim({ ...S_CBL, dist: mix(S_CBL.dist * 2.6, S_CBL.dist, ease(u)) }));
  log('5 cable segment');

  /* 6-10 — the erection. One camera, 86 files, nothing else moves. */
  await load('GGB_00_towers.xlsx', BUILD);
  caption('build', T, 5);
  await frame(5);
  log('6 towers');

  await load('GGB_01_cables.xlsx', BUILD);
  caption('cables', T, 5);
  await frame(5);
  log('7 main cables');

  await load('GGB_02_ropes.xlsx', BUILD);
  caption('ropes', T, 5);
  await frame(5);
  log('8 hanger ropes');

  const N = 41, HOLD = 16 / N;
  caption('truss', T, 16);
  for (let i = 1; i <= N; i++) {
    await load('GGB_03_truss_' + String(i).padStart(2, '0') + '.xlsx', BUILD);
    await frame(HOLD);
  }
  log('9 truss, out from both towers');

  caption('deck', T, 16);
  for (let i = 1; i <= N; i++) {
    await load('GGB_04_deck_' + String(i).padStart(2, '0') + '.xlsx', BUILD);
    await frame(HOLD);
  }
  log('10 deck follows');

  /* 11 — finished, under the tower. No caption: there is nothing to add. */
  await load('GGB_05_done.xlsx', HERO);
  await move(10, u => aim({ ...HERO, az: mix(HERO.az, HERO.az + 15, ease(u)) }));
  log('11 hero');

  /* 12 — the drawings. A pre-rendered sheet, because Save DXF takes six
     seconds and what the film shows is the file, not the wait. */
  if (fs.existsSync(DXFPAGE)) {
    const doc = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await doc.goto('file://' + DXFPAGE, { waitUntil: 'load', timeout: 180000 });
    await doc.waitForTimeout(3000);
    caption('dxf', T, 10);
    const vb = await doc.evaluate(() => document.querySelector('svg').getAttribute('viewBox'));
    const v = vb.split(/\s+/).map(Number);
    const views = [[0, 1], [0, 0.16], [0.02, 0.075], [0.03, 0.045]];  // sheet -> the GA
    for (const [y0, h] of views) {
      await doc.evaluate(a => document.querySelector('svg')
        .setAttribute('viewBox', a[0] + ' ' + a[1] + ' ' + a[2] + ' ' + a[3]),
        [v[0], v[1] + v[3] * y0, v[2], v[3] * h]);
      await doc.waitForTimeout(700);
      put(await doc.screenshot({ type: 'jpeg', quality: 92 }), 2.5);
    }
    await doc.close();
    log('12 nine drawings');
  } else {
    console.log('  (no ' + path.basename(DXFPAGE) + ' - run prep_ggb.js; cut 12 skipped)');
  }

  /* 13 — what the app says it weighs. The sidebar has to be in shot, so this
     is the one frame that goes through page.screenshot. */
  await load('GGB_05_done.xlsx', ISO);
  caption('count', T, 6);
  put(await app.screenshot({ type: 'jpeg', quality: 92 }), 6);
  log('13 members and weight');

  /* 14 */
  card('end', 6);
  log('14 outro');

  fs.writeFileSync(path.join(SP, 'shots_ggb.json'),
    JSON.stringify({ fps: FPS, src: 'ggb_src', out: 'PLATE3D_GGB.mp4',
                     shots: shots, caps: caps }, null, 1));
  await browser.close();
  console.log('\n' + shots.length + ' stills · ' + caps.length + ' captions · ' +
              T.toFixed(1) + ' s\n' + SRC);
})();
