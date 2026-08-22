/* Basics 03, BAR & SECT - the capture pass. 33 cuts, SCRIPT_BARSECT.md section 5.

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
const SRC = SP + '/src_barsect';
const CARD = 'barsect/';
const P3 = path.resolve(SP, '../..');
const FPS = 30, MO = 15;                 // move frames per second of screen time
const VW = 2336, VH = 1294;              // -> about 1920x1080 of canvas, then x2

const BOOK = P3 + '/PLATE3D_BASIC.xlsx';
const CASE = SP + '/barsect/PLATE3D_';

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
const caption = (id, start, dur) => caps.push({ png: CARD + 's3_' + id + '.png', start: start, dur: dur });
const save = () => fs.writeFileSync(SP + '/shots_barsect.json',
  JSON.stringify({ fps: FPS, dir: 'src_barsect', cards: CARD, w: 2560, h: 1440,
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

/* The part preview - the app's own drawing of one plate, flat on, with its
   nine points named on the outline, its origin marked, its holes dimensioned
   and its weight along the bottom.

   This is what the first pass should have been built on and was not. Every
   caption about shapes, points, origins and holes was read over the finished
   frame turning, which showed none of them: the film said "three shapes" while
   a bent rotated, and said "on the real outline, not a bounding box" while
   nothing with an outline was on screen. The app draws all of it already.

   Ids are upper case inside the engine - preview('pl.stf') finds nothing and
   returns quietly, which is how the first probe came back with the main view
   screenshotted and no error anywhere. */
const boxOf = sel => app.evaluate(q => {
  const e = document.querySelector(q); if (!e) return null;
  const r = e.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}, sel);

/* Frame on the preview card rather than the whole browser.

   The first re-shoot got the right picture and then showed it small: the card
   is about half the width of the window, so the plate drawing inside it landed
   at roughly a quarter of the frame with app chrome all round. In a teaching
   film the thing being taught should be the picture, not a window in it. A
   little of the app is kept at the edges so it still reads as the real screen.

   Clipping is in CSS pixels and the page runs at deviceScaleFactor 2, so a
   1140-wide card comes out 2280 wide - all but native for a 2560 frame. */
async function cardShot(dur, pad) {
  const b = await boxOf('#pb-modal .box');
  if (!b) return chrome(dur);
  const m = (pad === undefined ? 0.07 : pad);
  const w = Math.min(VW, b.w * (1 + m * 2)), h = w * VH / VW;
  const x = Math.min(Math.max(0, b.x + b.w / 2 - w / 2), VW - w);
  const y = Math.min(Math.max(0, b.y + b.h / 2 - h / 2), VH - h);
  return app.screenshot({ type: 'png', clip: { x: Math.round(x), y: Math.round(y),
    width: Math.round(w), height: Math.round(h) } }).then(buf => put(buf, dur));
}

async function part(id, dur) {
  await app.evaluate(i => plateBuilder.preview(i), id.toUpperCase());
  await app.waitForTimeout(1400);
  const open = await app.evaluate(() => {
    const m = document.getElementById('pb-modal');
    return !!m && getComputedStyle(m).display !== 'none';
  });
  if (!open) throw new Error('preview(' + id + ') did not open - check the id');
  await cardShot(dur);
  await app.evaluate(() => plateBuilder.closePreview());
  await app.waitForTimeout(400);
}

/* The module preview - the members of one module listed with their PLANE and
   Ref.Pt beside the 3D of just that module, and the BASE point labelled on it.
   `hide` switches members off by row number so a plane or a datum can be shown
   one part at a time. */
async function unit(id, dur, hide) {
  await app.evaluate(i => plateBuilder.previewModule(i), id.toUpperCase());
  await app.waitForTimeout(2200);
  const open = await app.evaluate(() => {
    const m = document.getElementById('pb-modal');
    return !!m && getComputedStyle(m).display !== 'none';
  });
  if (!open) throw new Error('previewModule(' + id + ') did not open - check the id');
  await cardShot(dur, 0.02);
  await app.evaluate(() => plateBuilder.closePreview());
  await app.waitForTimeout(400);
}

/* Two states of the same thing, cut between: load the first, hold, load the
   second, hold. Used for every beat whose point is what changed. */
async function swap(a, b, dur, show) {
  await load(a);
  await show(dur * 0.45);
  await load(b);
  await show(dur * 0.55);
}

/* Turn the model a little while holding it - a still 3D shot reads as a
   screenshot, and the point of the viewport is that it is not one. */
async function orbit(dur, sweep, zoom, pull) {
  const c = await cam();
  /* `pull` stands the camera further back before the move starts. The engine
     fits the view to whatever it just loaded, and on the one-command assembly
     workbooks that fit is tight enough to run the columns off the bottom of a
     16:9 frame. A model half out of frame is not a picture of what the command
     did. */
  const d0 = c.dist * (pull === undefined ? 1 : pull);
  await move(dur, u => aim({ ...c, az: mix(c.az - sweep / 2, c.az + sweep / 2, u),
                             dist: d0 * mix(1, zoom === undefined ? 1 : zoom, ease(u)) }));
}

(async () => {
  /* Everything the cut list needs, before the browser starts. */
  const need = ['t02', 's13', 's18', 's24', 'o33'].map(i => CARD + 's3_' + i + '.png')
    .concat(['three', 'bar', 'sect', 'secth', 'sectr', 'girder', 'two', 'plane',
             'coord', 'off', 'anchor', 'alpha', 'assy', 'cutsect']
             .map(i => CARD + 's3_sh_' + i + '.html'))
    .concat([1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 19, 20, 21, 22, 23,
             25, 26, 27, 28, 29, 30, 31, 32]
             .map(i => CARD + 's3_c' + String(i).padStart(2, '0') + '.png'))
    .concat(['C12', 'C20', 'C23', 'C31'].map(i => 'barsect/PLATE3D_' + i + '.xlsx'))
    .concat(['basic/PLATE3D_B22.xlsx']);
  const missing = need.filter(f => !fs.existsSync(SP + '/' + f));
  if (missing.length) {
    console.log('missing before the shoot starts:\n  ' + missing.join('\n  '));
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

  /* ---- 1  the bent, then only the steel that is not a plate ---- */
  await load(BOOK);
  const wide = await cam();
  caption('c01', 0.3, 4.6);
  await move(3.4, u => {
    const f = ease(u);
    return app.evaluate(v => window.__reveal(v), 0.06 + 0.94 * f)
      .then(() => aim({ ...wide, az: wide.az - 6 + 10 * f }));
  });
  await app.evaluate(() => window.__revealAll());
  /* fade the plates out so what is left is the subject of the episode */
  await app.evaluate(() => {
    if (!window.__pbS) return;
    window.__pbS.traverse(o => {
      if (o.material && o.userData && /^PL\./i.test(String(o.userData.id || ''))) {
        o.material.transparent = true; o.material.opacity = 0.12;
      }
    });
  });
  await move(2.6, u => aim({ ...wide, az: wide.az + 4 + 10 * ease(u),
                             dist: wide.dist * mix(1, 0.93, ease(u)) }));
  log('1 not every part is a plate');

  /* ---- 2  title ---- */
  await page2(CARD + 's3_t02.html');
  await still(4.0);
  log('2 title');

  /* ---- 3-4  three tables, three keywords ---- */
  await load(BOOK);
  caption('c03', T + 0.3, 4.6);
  await chrome(6.0);
  log('3 three tables');

  caption('c04', T + 0.3, 4.8);
  await sheet(CARD + 's3_sh_three.html', 8.0);
  log('4 plate, bar, section');

  /* ---- 5-6  BAR ---- */
  caption('c05', T + 0.3, 4.6);
  await sheet(CARD + 's3_sh_bar.html', 7.0, true);
  log('5 BAR block');

  caption('c06', T + 0.3, 4.6);
  await part('BAR.ANCH', 7.0);
  log('6 a round bar');

  /* ---- 7-12  SECT ---- */
  caption('c07', T + 0.3, 4.8);
  await sheet(CARD + 's3_sh_sect.html', 8.0, true);
  log('7 SECT block');

  caption('c08', T + 0.3, 4.8);
  await sheet(CARD + 's3_sh_secth.html', 3.4, true);
  await part('SC.COL', 4.6);
  log('8 you type the dimensions');

  caption('c09', T + 0.3, 5.0);
  await part('SC.COL', 9.0);
  log('9 H takes seven');

  caption('c10', T + 0.3, 4.6);
  await part('SC.STR', 4.0);
  await part('SC.BRC', 4.0);
  log('10 C and L take six');

  caption('c11', T + 0.3, 4.2);
  await sheet(CARD + 's3_sh_sectr.html', 6.0, true);
  log('11 r left blank');

  /* 12 - the same row, a girder no catalogue lists */
  caption('c12', T + 0.3, 4.8);
  await sheet(CARD + 's3_sh_girder.html', 3.6, true);
  await load(CASE + 'C12.xlsx');
  await part('SC.COL', 5.4);
  log('12 standard or custom');

  /* ---- 13  section card ---- */
  await load(BOOK);
  await page2(CARD + 's3_s13.html');
  await still(5.0);
  log('13 section: where does the length come from');

  /* ---- 14-17  two grammars ---- */
  caption('c14', T + 0.3, 5.0);
  await sheet(CARD + 's3_sh_two.html', 9.0, true);
  log('14 the eighth column');

  caption('c15', T + 0.3, 5.0);
  await sheet(CARD + 's3_sh_plane.html', 4.0, true);
  await unit('MD.COL', 5.0);
  log('15 a plane name');

  caption('c16', T + 0.3, 5.0);
  await sheet(CARD + 's3_sh_coord.html', 4.0, true);
  await unit('MD.BAY', 5.0);
  log('16 two points');

  caption('c17', T + 0.3, 4.6);
  await chrome(7.0);
  log('17 ref on the length');

  /* ---- 18  section card ---- */
  await page2(CARD + 's3_s18.html');
  await still(5.0);
  log('18 section: work lines and steel');

  /* ---- 19-23  OFF and Alpha ---- */
  caption('c19', T + 0.3, 5.0);
  await sheet(CARD + 's3_sh_off.html', 3.6, true);
  await unit('MD.BAY', 5.4);
  log('19 type the node, trim the steel');

  /* 20 - OFF 170 against OFF 0, the same camera on both */
  caption('c20', T + 0.3, 5.0);
  {
    const c = await cam();
    await load(CASE + 'C20.xlsx');
    await aim(c); await move(4.4, u => aim({ ...c, az: c.az + 5 * u }));
    await load(BOOK);
    await aim(c); await move(4.6, u => aim({ ...c, az: c.az + 5 - 9 * ease(u) }));
  }
  log('20 positive pulls back');

  caption('c21', T + 0.3, 5.0);
  await sheet(CARD + 's3_sh_anchor.html', 3.6, true);
  await unit('MD.COL', 5.4);
  log('21 negative runs past');

  caption('c22', T + 0.3, 4.6);
  await unit('MD.BAY', 7.0);
  log('22 real length');

  /* 23 - Alpha, camera nailed down so only the member turns */
  caption('c23', T + 0.3, 4.6);
  {
    const c = await cam();
    await load(CASE + 'C23.xlsx');
    await aim(c); await frame(3.4);
    await load(BOOK);
    await aim(c); await frame(3.6);
  }
  log('23 Alpha turns it about its own axis');

  /* ---- 24  section card ---- */
  await page2(CARD + 's3_s24.html');
  await still(5.0);
  log('24 section: one row is one member');

  /* ---- 25-30  repeat and ASSY ---- */
  caption('c25', T + 0.3, 5.0);
  await sheet(CARD + 's3_sh_anchor.html', 3.0);
  await load(SP + '/basic/PLATE3D_B22.xlsx');
  await unit('MD.COL', 6.0);
  log('25 the repeat block, on both grammars');

  await load(BOOK);
  caption('c26', T + 0.3, 4.8);
  await sheet(CARD + 's3_sh_assy.html', 8.0, true);
  log('26 ASSY block');

  caption('c27', T + 0.3, 4.6);
  await orbit(7.0, 20, 1.04);
  log('27 MIR');

  caption('c28', T + 0.3, 4.6);
  await orbit(7.0, -22, 1.06);
  log('28 COPY');

  caption('c29', T + 0.3, 4.6);
  await orbit(7.0, 24, 0.94);
  log('29 ROT');

  /* 30 - a bar straight into an assembly, no module at all */
  caption('c30', T + 0.3, 4.8);
  await chrome(8.0);
  log('30 skip the module');

  /* ---- 31  a CUT on a section: the profile first, then the solid ---- */
  caption('c31', T + 0.3, 5.0);
  await load(CASE + 'C31.xlsx');
  await sheet(CARD + 's3_sh_cutsect.html', 2.6);
  await part('SC.COL', 3.4);
  await unit('MD.COL', 3.0);
  log('31 CUT edits the profile');

  /* ---- 32  the whole thing again ---- */
  await load(BOOK);
  caption('c32', T + 0.3, 5.0);
  {
    const cz = await cam();
    await move(8.0, u => aim({ ...cz, az: mix(cz.az - 16, cz.az + 16, ease(u)),
                               el: cz.el + 3 * Math.sin(Math.PI * u),
                               dist: cz.dist * mix(1.04, 0.96, ease(u)) }));
  }
  log('32 closing orbit');

  /* ---- 33  logo ---- */
  await page2(CARD + 's3_o33.html');
  await still(5.0);
  log('33 outro');

  await browser.close();
  save();
  console.log('\n' + shots.length + ' stills · ' + caps.length + ' captions · ' +
              T.toFixed(1) + ' s');
})();
