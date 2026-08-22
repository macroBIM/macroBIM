/* Teaching film - the capture pass. 30 cuts, SCRIPT_BASIC.md section 6.

   Everything on screen is real. The model is built by the shipped engine from
   the shipped example; the sheet pages are that workbook read back cell by
   cell; the nine-point and thickness diagrams are the app's own Guide panel,
   not redrawn. A viewer who learns a diagram here can find it again inside the
   app, which is the job of a teaching film.

   Three things differ from the two promo passes:

   Capture is at 2x and the stills are PNG. The promos were honestly 1920x1080
   and still looked soft on YouTube, because the picture went through JPEG at
   capture, JPEG again at normalise and H.264 last, and 1080p is the tier
   YouTube gives its thinnest bitrate. Thin lines and small type - which is all
   this film is - are what that ruins first. The engine already caps its own
   pixel ratio at 2, so deviceScaleFactor: 2 is all it takes to get real detail
   rather than an upscale, and 1440p out is also where YouTube switches to VP9.

   The cut list is data, not code. Each entry says what to put on screen and how
   long to hold it, so the film can be re-timed from the script without touching
   the machinery, and so a missing card or page is caught before the browser
   starts rather than 20 minutes in.

   shots.json is written after every cut, as on the splice pass - the tower's
   wrote once at the end and lost 562 good frames to a crash at 52 minutes.

     node shoot_basic.js                                                      */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const SRC = SP + '/src_basic';
const CARD = 'basic/';
const P3 = path.resolve(SP, '../..');
const FPS = 30, MO = 15;                 // move frames per second of screen time
const VW = 2336, VH = 1294;              // -> about 1920x1080 of canvas, then x2

const BOOK = P3 + '/PLATE3D_BASIC.xlsx';
const CASE = SP + '/basic/PLATE3D_';

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
const caption = (id, start, dur) => caps.push({ png: CARD + 'b_' + id + '.png', start: start, dur: dur });
const save = () => fs.writeFileSync(SP + '/shots_basic.json',
  JSON.stringify({ fps: FPS, dir: 'src_basic', cards: CARD, w: 2560, h: 1440,
                   shots: shots, caps: caps }, null, 1));

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
/* PNG off the canvas, not JPEG: this is the first of the three generations the
   promos lost, and it is the cheapest one to stop losing. */
async function frame(dur) {
  const d = await app.evaluate(() => {
    window.__pbDraw();
    return window.__pbCanvas.toDataURL('image/png');
  });
  return put(Buffer.from(d.split(',')[1], 'base64'), dur);
}
async function move(dur, fn) {
  const k = Math.max(1, Math.round(dur * MO));
  for (let i = 0; i < k; i++) { await fn(k === 1 ? 0 : i / (k - 1), i, k); await frame(dur / k); }
}
const ease = u => u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
const mix = (a, b, u) => a + (b - a) * u;

/* a flat page - a card, or a block of the sheet */
async function page2(file, lit) {
  await doc.goto('file://' + SP + '/' + file, { waitUntil: 'load', timeout: 30000 });
  await doc.evaluate(() => document.fonts.load('700 20px Inter')
    .then(() => document.fonts.load('600 46px Inter'))
    .then(() => document.fonts.load('800 82px Inter'))
    .then(() => document.fonts.ready)).catch(() => {});
  if (lit) await doc.evaluate(() => document.body.classList.add('lit'));
  await doc.waitForTimeout(450);
}
const still = dur => doc.screenshot({ type: 'png' }).then(b => put(b, dur));
const chrome = dur => app.screenshot({ type: 'png' }).then(b => put(b, dur));

/* Hold a page, then light its ring partway through, so the eye lands on the
   block first and the column second. One page, two beats, no extra file. */
async function sheet(file, dur, ring) {
  await page2(file);
  if (!ring) { await still(dur); return; }
  await still(dur * 0.42);
  await doc.evaluate(() => document.body.classList.add('lit'));
  await doc.waitForTimeout(120);
  await still(dur * 0.58);
}

/* The Guide panel, scrolled to a heading by its text. The film shows the app's
   own drawings rather than new ones: found again later inside the app, and they
   cannot drift from the engine the way a redrawn copy would.

   The headings have to be the ones the guide actually writes, and guessing at
   them fails silently - the panel opens, nothing matches, and it is captured
   sitting at the top. The first pass did exactly that on two cuts and the only
   sign was a null in the log, which is why the found heading is returned and
   printed. The real ones, for reference:

     h2  The nine points
     h3  BASE.pt - a shape's own origin
     h3  Ref.Pt and the +- faces          <- the thickness faces
     h3  MODULE - parts into a unit                                          */
async function guide(headings, dur) {
  await app.evaluate(() => plateBuilder.openGuide());
  await app.waitForTimeout(500);
  const ok = await app.evaluate(hs => {
    const doc = document.querySelector('#pb-help .doc');
    if (!doc) return null;
    for (const h of hs) {
      const el = [...doc.querySelectorAll('h1,h2,h3')]
        .find(e => e.textContent.trim().toLowerCase().indexOf(h.toLowerCase()) >= 0);
      if (el) { doc.scrollTop = el.offsetTop - 24; return el.textContent.trim(); }
    }
    return null;
  }, headings);
  await app.waitForTimeout(400);
  await chrome(dur);
  await app.evaluate(() => plateBuilder.closeGuide());
  await app.waitForTimeout(300);
  return ok;
}

/* Turn the model a little while holding it - a still 3D shot reads as a
   screenshot, and the point of the viewport is that it is not one. */
async function orbit(dur, sweep, zoom) {
  const c = await cam();
  await move(dur, u => aim({ ...c, az: mix(c.az - sweep / 2, c.az + sweep / 2, u),
                             dist: c.dist * mix(1, zoom === undefined ? 1 : zoom, ease(u)) }));
}

(async () => {
  /* Everything the cut list needs, checked before the browser starts. A missing
     card is 20 minutes of shooting thrown away if it is found at the encode. */
  const need = ['t02', 's10', 's16', 'o30'].map(i => CARD + 'b_' + i + '.png')
    .concat(['plate', 'trap', 'basept', 'hole', 'cut1', 'cutrep', 'cutpl', 'module',
             'plane', 'thick', 'anchor', 'base', 'assy'].map(i => CARD + 'b_sh_' + i + '.html'))
    .concat([1, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22, 23, 24, 25,
             26, 27, 28, 29].map(i => CARD + 'b_c' + String(i).padStart(2, '0') + '.png'))
    .concat(['B13A', 'B13B', 'B14', 'B22'].map(i => 'basic/PLATE3D_' + i + '.xlsx'));
  const missing = need.filter(f => !fs.existsSync(SP + '/' + f));
  if (missing.length) {
    console.log('missing before the shoot even starts:\n  ' + missing.join('\n  '));
    console.log('\nrun: node mkcards_basic.js && node rendercards_basic.js && ' +
                'node mksheets_basic.js && node make_basic_cases.js');
    process.exitCode = 1;
    return;
  }

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--allow-file-access-from-files',
           '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  app = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 });
  await wire(app);
  await app.goto('file://' + SP + '/video_page.html', { waitUntil: 'domcontentloaded' });
  await app.waitForTimeout(3500);
  doc = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  await wire(doc);
  const log = m => { save(); console.log('  [' + T.toFixed(1) + 's] ' + m); };

  /* ---- 1  the model builds itself from the ground up, 6s ---- */
  await load(BOOK);
  const wide = await cam();
  caption('c01', 0.3, 4.6);
  await move(6.0, u => {
    const f = ease(u);
    return app.evaluate(v => window.__reveal(v), 0.06 + 0.94 * f)
      .then(() => aim({ ...wide, az: wide.az - 8 + 16 * f, dist: wide.dist * (1.10 - 0.10 * f) }));
  });
  await app.evaluate(() => window.__revealAll());
  log('1 reveal');

  /* ---- 2  title, 4s ---- */
  await page2(CARD + 'b_t02.html');
  await still(4.0);
  log('2 title');

  /* ---- 3  Example > Basic, 6s ---- */
  const which = await app.evaluate(() => {
    plateBuilder.openSamples();
    return 1;
  });
  await app.waitForTimeout(700);
  await app.evaluate(() => {
    const rows = [...document.querySelectorAll('#pb-ex .ext tbody tr')];
    const tr = rows.find(r => /basic/i.test(r.textContent));
    if (tr) { tr.style.outline = '3px solid #b45309'; tr.style.outlineOffset = '-1px';
              tr.style.background = '#fffbeb'; tr.scrollIntoView({ block: 'center' }); }
  });
  caption('c03', T + 0.3, 4.6);
  await chrome(6.0);
  await app.evaluate(() => plateBuilder.closeSamples());
  await app.waitForTimeout(300);
  log('3 example');

  /* ---- 4-6  PLATE: one row is one part, three shapes, TRAP ---- */
  caption('c04', T + 0.3, 4.6);
  await sheet(CARD + 'b_sh_plate.html', 7.0);
  log('4 PLATE block');

  caption('c05', T + 0.3, 4.6);
  await orbit(7.0, 26, 0.92);
  log('5 three shapes');

  caption('c06', T + 0.3, 4.6);
  await sheet(CARD + 'b_sh_trap.html', 8.0, true);
  log('6 TRAP');

  /* ---- 7-9  the nine points ---- */
  caption('c07', T + 0.3, 4.6);
  const g1 = await guide(['nine points', 'reference point'], 7.0);
  log('7 guide: ' + g1);

  caption('c08', T + 0.3, 4.6);
  await orbit(7.0, -22, 0.90);
  log('8 points on the real outline');

  caption('c09', T + 0.3, 4.8);
  await sheet(CARD + 'b_sh_basept.html', 8.0, true);
  log('9 base.pt column');

  /* ---- 10  section card ---- */
  await page2(CARD + 'b_s10.html');
  await still(6.0);
  log('10 section: holes');

  /* ---- 11-15  HOLE and CUT ---- */
  caption('c11', T + 0.3, 4.6);
  await sheet(CARD + 'b_sh_hole.html', 7.0, true);
  log('11 HOLE block');

  caption('c12', T + 0.3, 4.8);
  await sheet(CARD + 'b_sh_cut1.html', 7.0, true);
  log('12 CUT measured from the plate origin');

  /* 13 - one hole becomes three. The sheet says it and the model shows it, so
     the two case workbooks are loaded either side of the sheet page. */
  await load(CASE + 'B13A.xlsx');
  const cl = await cam();
  caption('c13', T + 0.3, 4.6);
  await move(2.2, u => aim({ ...cl, az: cl.az + 6 * u }));
  await sheet(CARD + 'b_sh_cutrep.html', 2.4, true);
  await load(CASE + 'B13B.xlsx');
  await aim(cl);
  await move(2.4, u => aim({ ...cl, az: cl.az + 6 + 8 * ease(u), dist: cl.dist * (1 - 0.05 * ease(u)) }));
  log('13 dx dy repeat');

  /* 14 - and the second axis, which is where a row disappears */
  caption('c14', T + 0.3, 4.8);
  await load(CASE + 'B14.xlsx');
  await aim(cl);
  await move(3.0, u => aim({ ...cl, az: cl.az - 8 * ease(u) }));
  await sheet(CARD + 'b_sh_cutrep.html', 3.0, true);
  await load(BOOK);
  await aim(cl);
  await move(3.0, u => aim({ ...cl, az: cl.az + 10 * ease(u), dist: cl.dist * (1 - 0.06 * ease(u)) }));
  log('14 dx2 dy2 repeat2');

  caption('c15', T + 0.3, 4.6);
  await sheet(CARD + 'b_sh_cutpl.html', 7.0, true);
  log('15 a shape can be another plate');

  /* ---- 16  section card ---- */
  await page2(CARD + 'b_s16.html');
  await still(5.0);
  log('16 section: stand them up');

  /* ---- 17-22  MODULE ---- */
  caption('c17', T + 0.3, 4.6);
  await sheet(CARD + 'b_sh_module.html', 7.0, true);
  log('17 MODULE block');

  caption('c18', T + 0.3, 4.8);
  await sheet(CARD + 'b_sh_plane.html', 4.5, true);
  await orbit(4.5, 30, 0.9);
  log('18 PLANE');

  caption('c19', T + 0.3, 4.6);
  const g2 = await guide(['BASE.pt', 'nine points'], 6.0);
  log('19 guide: ' + g2);

  caption('c20', T + 0.3, 4.6);
  const g3 = await guide(['Ref.Pt and the', 'BASE.pt'], 7.0);
  log('20 guide: ' + g3);

  caption('c21', T + 0.3, 4.8);
  await sheet(CARD + 'b_sh_thick.html', 7.0, true);
  log('21 mc- on the drawing dimension');

  /* 22 - four anchor rows become one, and the model must not move */
  caption('c22', T + 0.3, 5.0);
  await load(BOOK);
  const ca = await cam();
  await move(3.0, u => aim({ ...ca, az: ca.az + 8 * ease(u), dist: ca.dist * (1 - 0.10 * ease(u)) }));
  await sheet(CARD + 'b_sh_anchor.html', 3.5);
  await load(CASE + 'B22.xlsx');
  await aim(ca);
  await move(3.5, u => aim({ ...ca, az: ca.az + 8 - 14 * ease(u), dist: ca.dist * 0.90 }));
  log('22 four rows became one');

  /* ---- 23-25  BASE ---- */
  caption('c23', T + 0.3, 4.6);
  await sheet(CARD + 'b_sh_base.html', 7.0, true);
  log('23 BASE');

  caption('c24', T + 0.3, 4.6);
  await load(BOOK);
  await orbit(7.0, 24, 0.88);
  log('24 read where it sits');

  /* ---- 25-28  ASSY, one command per cut ---- */
  caption('c25', T + 0.3, 4.6);
  await sheet(CARD + 'b_sh_assy.html', 6.0, true);
  log('25 ASSY block');

  caption('c26', T + 0.3, 4.6);
  await orbit(6.0, 20, 1.06);
  log('26 MIR');

  caption('c27', T + 0.3, 4.6);
  await orbit(6.0, -24, 1.08);
  log('27 COPY');

  caption('c28', T + 0.3, 4.6);
  await orbit(6.0, 26, 0.92);
  log('28 ROT');

  /* ---- 29  the whole model again, finished ---- */
  caption('c29', T + 0.3, 5.0);
  const cz = await cam();
  await move(8.0, u => aim({ ...cz, az: mix(cz.az - 16, cz.az + 16, ease(u)),
                             el: cz.el + 3 * Math.sin(Math.PI * u),
                             dist: cz.dist * mix(1.04, 0.96, ease(u)) }));
  log('29 closing orbit');

  /* ---- 30  logo ---- */
  await page2(CARD + 'b_o30.html');
  await still(5.0);
  log('30 outro');

  await browser.close();
  save();
  console.log('\n' + shots.length + ' stills · ' + caps.length + ' captions · ' +
              T.toFixed(1) + ' s');
})();
