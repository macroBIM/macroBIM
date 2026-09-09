/* YouTube thumbnails, one per film, all off the same drawing.

   A thumbnail is not a small poster. It is read at about 320 pixels wide in a
   list and nearer 120 on a phone, so it gets one picture and a few words, and
   anything that cannot be read at that size is not a small benefit - it is
   clutter competing with the line that can. The Basics 01 draft had four lines
   of type and lost two of them for exactly that reason.

   The look is the films', not a new one: the title card's ground, Inter 800,
   the same accent on the second line, and the picture on a white card because
   that is how the app really shows it - on the dark blue alone it was a dark
   canvas on a dark page. Someone who has seen one of these should recognise the
   next without reading it. None of them repeats its own YouTube title, which
   sits directly underneath in the same list.

   The hero is grabbed from the shipped engine, not from a frame of the film, so
   a thumbnail can be redrawn without the film's capture still being on disk.

     node mkthumb.js            all of them
     node mkthumb.js basic      one                                          */
const { chromium } = require('playwright-core');
const { execFileSync } = require('child_process');
const FF = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const P3 = path.resolve(SP, '../..');
/* Inter as a data URI. Not in the repository - a woff2 as a base64 string is
   not source - so a card can still be drawn without it, on the system stack.
   The four thumbnails already shipped were drawn WITH it, so put the file back
   next to this one before redrawing any of them or the set stops matching. */
const FONTCSS = fs.existsSync(SP + '/v_font.css')
  ? fs.readFileSync(SP + '/v_font.css', 'utf8') : '';

/* One entry per film.

   `hero` says what to put on the card and how to get it: a `part` is the app's
   flat drawing of one plate, which survives being shrunk because it is a few
   heavy shapes; a `model` is the viewport, aimed. Bolt heads and thin webs do
   not survive, so the splice is shot close on the joint rather than wide on the
   assembly.

   `badge` is only for a numbered series. A promo has no episode number and
   putting one on it would be a lie about what it is. */
const FILMS = [
  { id: 'basic',
    out: 'PLATE3D_BASIC_thumb.jpg',
    book: P3 + '/PLATE3D_BASIC.xlsx',
    hero: { kind: 'part', id: 'PL.CLT' },
    badge: '01', badgeNote: 'BASICS',
    l1: 'HOW TO USE', l2: 'PLATE &amp; CUT' },

  { id: 'barsect',
    out: 'PLATE3D_BARSECT_thumb.jpg',
    book: P3 + '/PLATE3D_BASIC.xlsx',
    /* The H section's own drawing - fillets, seven dimensions, the thing the
       episode is about. A section drawn flat survives being shrunk for the same
       reason the plate did: a few heavy shapes rather than thin lines. */
    hero: { kind: 'part', id: 'SC.COL' },
    badge: '02', badgeNote: 'BASICS',
    l1: 'HOW TO USE', l2: 'BAR &amp; SECT' },

  { id: 'splice',
    out: 'PLATE3D_SPLICE_thumb.jpg',
    book: SP + '/../SPLICE_3_BOLT.xlsx',
    /* az 200, not -34. The joint has to sit on the RIGHT of the hero image,
       because the card bleeds off the right edge of the thumbnail and its left
       third is under the wash the type sits on - frame the connection on the
       left and the thumbnail shows a wall of flange. At 0.42 it was closer
       still and showed nothing but web. */
    hero: { kind: 'model', az: 200, el: 24, dist: 0.85 },
    l1: 'BOLTED SPLICE', l2: 'MADE SIMPLE' },

  /* The bridge. Two things here that no earlier thumbnail needed.

     The camera is ABSOLUTE, not the engine's own view pulled in by a factor.
     Every other hero is a small object the engine frames sensibly; a 2.3 km
     bridge framed sensibly is a line across the middle of the picture, and no
     multiple of that distance is a thumbnail. So this one stands where the
     film's hero shot stands - under a tower, looking up along the cables.

     And the paint is set, because International Orange is the one thing about
     this bridge everybody already knows. The engine hands out its palette in
     read order; the film restates it on every load and so does this. */
  { id: 'ggb',
    out: 'PLATE3D_GGB_thumb.jpg',
    book: P3 + '/PLATE3D_GGB.xlsx',
    /* Six framings were shot and looked at. The film's own hero - in under the
       tower, looking up - is a tower and two dark diagonals: dramatic at full
       size, unreadable at 120 px. This one stands back until the WHOLE tower is
       in, with the main cable coming down across it and the deck running off to
       the corner. That silhouette is the one thing a viewer recognises before
       reading anything. The tower sits right of centre because the card bleeds
       off the right edge and the type's wash covers the card's left third.
       Straight on (az 90) put the two shafts of the tower on top of each other;
       az 40 opens them. */
    hero: { kind: 'model', aim: { tx: -640080, ty: 0, tz: 190000,
                                  dist: 230000, az: 40, el: 6 },
            pad: 0.05, aspect: 1.62 },
    /* The film's five oranges, lifted. On screen for 16 seconds a dark tower
       reads as steel; at 120 px in a list it reads as brown. */
    livery: { 'MD.TWR': '#e04a1c', 'MD.MCB': '#ff7a35', 'MD.HGR': '#e0642e',
              'MD.TRS': '#ffb070', 'MD.DK': '#ffdcc0' },
    /* The picture says Golden Gate Bridge; the words do not repeat it, and
       they do not repeat the YouTube title sitting under them either. What is
       left to say is the surprising part - how little was written. */
    l1: 'THREE SECTIONS', l2: '2,219<br>MEMBERS' },

  { id: 'simpleconn',
    out: 'PLATE3D_SIMPLECONN_thumb.jpg',
    book: P3 + '/PLATE3D_COLUMN.xlsx',
    /* The engine's own azimuth turned a quarter, and pulled in a third. The
       quarter turn brings the beam that was hiding behind the column round to
       the front right, so three of the four read as separate members instead
       of two and a stub; the other quarter turns put the column across the
       joint and hid it. Closer than 0.65 and the camera is inside the
       connection - 0.45 was one beam and a wall of flange.

       The framing is the CAMERA's, not a crop of a wider render: cropping to
       zoom throws away the pixels it is zooming into. */
    hero: { kind: 'model', az: 42, el: 28, dist: 0.65 },
    /* Two lines for the claim, and a smaller first line, because the type has
       to stop before the card. COLUMN-BEAM JOINT at 62 is 17 characters and
       the WIDEST thing on the card - wider than the claim under it - so it was
       the first line that lay across the drawing, not the second. Both sizes
       are checked against the card's edge in the run below rather than judged
       by eye; the first drafts were 52px over it. */
    s1: 52, sz: 88,
    l1: 'BEAM TO COLUMN', l2: 'SIMPLE<br>CONNECTION' }
];

const LIB = f => {
  let p = SP + '/node_modules/three/build/three.min.js';
  if (f.includes('OrbitControls')) p = SP + '/node_modules/three/examples/js/controls/OrbitControls.js';
  if (f.includes('polybool')) p = SP + '/node_modules/polybooljs/dist/polybool.min.js';
  if (f.includes('exceljs')) p = SP + '/node_modules/exceljs/dist/exceljs.min.js';
  return fs.readFileSync(p, 'utf-8');
};

async function grabHero(page, f) {
  await page.setInputFiles('#pb-file', f.book);
  await page.waitForFunction(b => {
    const r = document.getElementById('pb-result');
    return r && r.innerText.indexOf(b) >= 0 && /Succeed/.test(r.innerText);
  }, path.basename(f.book), { timeout: 300000 });
  await page.waitForTimeout(1500);

  const dst = SP + '/thumb_hero_' + f.id + '.png';
  if (f.hero.kind === 'part') {
    await page.evaluate(i => plateBuilder.preview(i), f.hero.id);
    await page.waitForTimeout(2500);
    await page.locator('#pb-pv-canvas').screenshot({ path: dst });
    await page.evaluate(() => plateBuilder.closePreview());
    await page.waitForTimeout(500);
  } else {
    if (f.livery) await page.evaluate(l => Object.keys(l).forEach(k => {
      try { window.plateBuilder.setColor('module', k, l[k]); } catch (e) {}
    }), f.livery);
    await page.evaluate(h => {
      if (h.aim) return window.__aim(h.aim.tx, h.aim.ty, h.aim.tz,
                                     h.aim.dist, h.aim.az, h.aim.el);
      const c = window.__cam();
      window.__aim(c.tx, c.ty, c.tz, c.dist * h.dist, h.az, h.el);
    }, f.hero);
    await page.waitForTimeout(900);
    const d = await page.evaluate(() => {
      window.__pbDraw();
      return window.__pbCanvas.toDataURL('image/png');
    });
    fs.writeFileSync(dst, Buffer.from(d.split(',')[1], 'base64'));
    await tightCrop(page, dst, f.hero.pad == null ? 0.05 : f.hero.pad, f.hero.aspect);
  }
  return dst;
}

/* The model is a tall thing and the viewport is 16:9, so the engine fits it by
   HEIGHT and leaves half the picture as empty floor either side. On a card that
   is read at 320px wide, that empty floor is most of the card: the joint came
   out small with nothing round it but grid.

   So the frame is cut back to the steel. Which is not the same as cutting back
   to the ink - the grid is drawn right across the floor, so any "what differs
   from the background" box is the whole canvas. The members are the SATURATED
   pixels: green, blue, yellow, orange, brown against a neutral grey grid and a
   near-black ground. That separates them cleanly, and the crop keeps a margin
   so the joint is not shaved. */
async function tightCrop(page, file, pad, aspect) {
  const b64 = fs.readFileSync(file).toString('base64');
  const out = await page.evaluate(a => new Promise(ok => {
    const im = new Image();
    im.onload = () => {
      const w = im.width, h = im.height;
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const x = c.getContext('2d');
      x.drawImage(im, 0, 0);
      const px = x.getImageData(0, 0, w, h).data;
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let yy = 0; yy < h; yy += 2) {
        for (let xx = 0; xx < w; xx += 2) {
          const o = (yy * w + xx) * 4, r = px[o], g = px[o + 1], b = px[o + 2];
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
          if (mx - mn < 34) continue;                 // grey: grid, ground, shadow
          if (xx < x0) x0 = xx; if (xx > x1) x1 = xx;
          if (yy < y0) y0 = yy; if (yy > y1) y1 = yy;
        }
      }
      if (x1 < x0) return ok(null);                   // nothing saturated: leave it be
      const mw = (x1 - x0) * a.pad, mh = (y1 - y0) * a.pad;
      x0 = Math.max(0, Math.floor(x0 - mw)); x1 = Math.min(w, Math.ceil(x1 + mw));
      y0 = Math.max(0, Math.floor(y0 - mh)); y1 = Math.min(h, Math.ceil(y1 + mh));
      /* A bridge is wide, so cropping to its steel gives a 2:1 letterbox, and a
         letterbox on the white card reads as a slot rather than a picture. So
         the short side is opened back up until the box is no wider than asked
         for - taking back sky and water, which is what a photograph of a bridge
         has in it anyway. */
      if (a.aspect && (x1 - x0) / (y1 - y0) > a.aspect) {
        const want = (x1 - x0) / a.aspect, add = (want - (y1 - y0)) / 2;
        y0 = Math.max(0, Math.floor(y0 - add)); y1 = Math.min(h, Math.ceil(y1 + add));
      }
      const d = document.createElement('canvas');
      d.width = x1 - x0; d.height = y1 - y0;
      d.getContext('2d').drawImage(c, x0, y0, d.width, d.height, 0, 0, d.width, d.height);
      ok({ url: d.toDataURL('image/png'), w: d.width, h: d.height, was: w + 'x' + h });
    };
    im.src = 'data:image/png;base64,' + a.b64;
  }), { b64: b64, pad: pad, aspect: aspect || 0 });
  if (!out) return;
  fs.writeFileSync(file, Buffer.from(out.url.split(',')[1], 'base64'));
  console.log('    hero cropped to the steel: ' + out.was + ' -> ' + out.w + 'x' + out.h);
}

const PAGE = (f, hero) => `<meta charset="utf-8"><style>${FONTCSS}</style><style>
 *{margin:0;padding:0;box-sizing:border-box}
 html,body{width:1280px;height:720px;overflow:hidden}
 body{background:#0b1220;font-family:Inter,system-ui,sans-serif;
      -webkit-font-smoothing:antialiased;position:relative}
 .hero{position:absolute;right:-56px;top:50%;transform:translateY(-50%) rotate(-6deg);
       width:640px;background:#fff;border-radius:18px;padding:16px;
       box-shadow:0 46px 90px rgba(0,0,0,.62)}
 .hero img{width:100%;display:block;border-radius:8px}
 .veil{position:absolute;inset:0;
       background:linear-gradient(100deg,#0b1220 42%,rgba(11,18,32,.9) 58%,rgba(11,18,32,0) 76%)}
 .txt{position:absolute;left:62px;top:50%;transform:translateY(-50%);z-index:2}
 .no{display:inline-flex;align-items:center;gap:14px;margin-bottom:22px}
 .no b{font:800 54px/1 Inter,sans-serif;color:#0b1220;background:#38bdf8;
       padding:10px 20px;border-radius:12px;letter-spacing:-.03em}
 .no i{font:800 40px/1 Inter,sans-serif;color:#64748b;font-style:normal;
       letter-spacing:-.02em}
 .l1{font:800 ${f.s1 || 62}px/1 Inter,sans-serif;color:#cbd5e1;letter-spacing:-.03em}
 .l2{font:800 ${f.sz || (f.l2.length > 12 ? 104 : 122)}px/1.02 Inter,sans-serif;color:#38bdf8;
     letter-spacing:-.05em;margin-top:8px}
</style>
<div class="hero"><img src="data:image/png;base64,${fs.readFileSync(hero).toString('base64')}"></div>
<div class="veil"></div>
<div class="txt">
  ${f.badge ? `<div class="no"><b>${f.badge}</b><i>${f.badgeNote}</i></div>` : ''}
  <div class="l1">${f.l1}</div>
  <div class="l2">${f.l2}</div>
</div>`;

(async () => {
  const only = process.argv[2];
  const list = only ? FILMS.filter(f => f.id === only) : FILMS;
  if (!list.length) { console.log('no film called ' + only); process.exitCode = 1; return; }

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
           '--enable-unsafe-swiftshader'] });
  const app = await browser.newPage({ viewport: { width: 1800, height: 1100 },
                                      deviceScaleFactor: 3 });
  await app.route('**/{unpkg.com,cdnjs.cloudflare.com}/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: LIB(r.request().url()) }));
  await app.route('**/fonts.{googleapis,gstatic}.com/**', r => r.abort());
  await app.goto('file://' + SP + '/video_page.html', { waitUntil: 'domcontentloaded' });
  await app.waitForTimeout(3000);

  /* drawn at 2x and downsampled, which is sharper than drawing at 1x - the type
     keeps its edges instead of being hinted onto a coarse grid */
  const card = await browser.newPage({ viewport: { width: 1280, height: 720 },
                                       deviceScaleFactor: 2 });
  await card.route('**/fonts.{googleapis,gstatic}.com/**', r => r.abort());

  for (const f of list) {
    const hero = await grabHero(app, f);
    const html = SP + '/thumb_' + f.id + '.html';
    fs.writeFileSync(html, PAGE(f, hero));
    await card.goto('file://' + html, { waitUntil: 'load' });
    await card.evaluate(() => document.fonts.load('800 122px Inter')
      .then(() => document.fonts.load('800 40px Inter'))
      .then(() => document.fonts.ready)).catch(() => {});
    await card.waitForTimeout(400);
    /* Measured, not eyeballed: the right edge of the type against the left
       edge of the card. Every early draft of the Simple connector thumbnail
       had the first line lying across the drawing by about 50px. */
    const over = await card.evaluate(() => {
      const t = document.querySelector('.txt').getBoundingClientRect();
      const h = document.querySelector('.hero').getBoundingClientRect();
      return Math.round(t.right - h.left);
    });
    const png = SP + '/thumb_' + f.id + '_2x.png';
    await card.screenshot({ path: png });
    const out = SP + '/../' + f.out;
    execFileSync(FF, ['-hide_banner', '-loglevel', 'error', '-y', '-i', png,
      '-vf', 'scale=1280:720:flags=lanczos', '-q:v', '2', out]);
    console.log('  ' + f.out + '  ' + (fs.statSync(out).size / 1024).toFixed(0) +
                ' KB  ·  1280x720  ·  ' +
                (over > 0 ? '** type over the card by ' + over + 'px **'
                          : 'type clears the card by ' + (-over) + 'px'));
  }
  await browser.close();
})();
