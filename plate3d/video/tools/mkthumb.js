/* YouTube thumbnails, one per film, all off the same drawing.

   A thumbnail is not a small poster. It is read at about 320 pixels wide in a
   list and nearer 120 on a phone, so it gets one picture and a few words, and
   anything that cannot be read at that size is not a small benefit - it is
   clutter competing with the line that can. The Basics 01 draft had four lines
   of type and lost two of them for exactly that reason.

   The look is the films', not a new one: the title card's ground, Inter 800,
   the same accent on the second line. Two layouts share it.

   CARD is the teaching films': the picture on a tilted white card bleeding off
   the right, because that is how the app really shows a part - on the dark blue
   alone it was a dark canvas on a dark page. It suits a joint or a plate, which
   is a compact object with a white sheet behind it.

   BLEED is for a structure. A 2.3 km bridge on a 640 px card is a thread; the
   same bridge across the whole frame, corner to corner, is the picture. The
   type moves to the bottom-left corner - which the diagonal leaves empty - and
   sits under a soft radial wash rather than a straight-edged veil. Someone who
   has seen one of these should recognise the next without reading it.

   The teaching films do not repeat their own YouTube title, which sits directly
   underneath in the same list - there, saying PLATE & CUT twice wastes the only
   two lines there are. A film about a famous structure is the other case: the
   name IS the reason someone stops, and a thumbnail that shows an orange tower
   and says something clever about section counts is a thumbnail that assumed
   the picture speaks. So GGB names it, big, and carries the words people
   actually search with above it.

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
  /* The bridge, and the one entry that does not use the card. Three things
     here that no earlier thumbnail needed.

     FULL BLEED. On a 640 px card a 2.3 km bridge is a thread; across the whole
     frame it is the picture. The first cut of this put the tower close-up on
     the card, which reads at full size and turns to an orange stick at 120 px.

     A DIAGONAL, and that is arithmetic rather than taste. The whole bridge has
     to be in frame and the frame is 16:9, so the longest line available runs
     corner to corner - az -45 / el 34 is the aim whose bounding box comes out
     at 1.81:1, near enough that cropping it to 16:9 leaves almost no sky. Every
     closer angle tried lost the far tower; every flatter one left the bridge a
     band across the middle with air above and below.

     AND THE DECK IS ORANGE. The engine's default and the film's own livery
     leave the deck near white, which at thumbnail size is a white ribbon with
     two orange sticks on it - the bridge everyone knows is orange end to end.
     So the deck and the truss are taken down INTO the orange rather than up
     out of it, and the towers stay the brightest thing. */
  { id: 'ggb',
    out: 'PLATE3D_GGB_thumb.jpg',
    book: P3 + '/PLATE3D_GGB.xlsx',
    bleed: true,
    hero: { kind: 'model', aim: { tx: 0, ty: 0, tz: 98000,
                                  dist: 1500000, az: -45, el: 34 },
            pad: 0.02, aspect: 16 / 9, fill: true },
    livery: { 'MD.TWR': '#f04a14', 'MD.MCB': '#ff9a55', 'MD.HGR': '#ef6a2c',
              'MD.TRS': '#e8531c', 'MD.DK': '#c9451a' },
    /* The name, big, and the words people type into the search box above it.
       The first cut said THREE SECTIONS / 2,219 MEMBERS on the theory that the
       picture already says which bridge - true of someone who has stopped and
       looked, false of everyone scrolling. Nobody searches for three sections. */
    s1: 46, sz: 82,
    l1: '3D BIM MODELING', l2: 'GOLDEN GATE<br>BRIDGE',
    l3: 'by PLATE3D' },

  /* The tower, and the one thing a bridge did not teach: a TALL subject.
     Everything about the Golden Gate thumbnail came from the bridge being 2.3 km
     of horizontal in a horizontal frame, so it went corner to corner and the
     type took the corner the diagonal left. A 300 m tower in a 16:9 frame is the
     opposite problem - the tower fills the HEIGHT and everything either side of
     it is black. Centre it and the type has nowhere to go but on top of it.

     So the tower is put TWO-THIRDS ACROSS, and THE CAMERA does it - not a crop.
     The aim's target is slid 108 m along screen-LEFT, so the camera looks left
     of the tower and the tower sits right of centre in the render. Screen-left
     at azimuth a is world (sin a, -cos a), which at az -40 is (-0.64, -0.77);
     the first cut had that sign the other way round and put the tower at 34%,
     under the type.

     No crop at all here (`crop: false`). The saturation crop is right for a
     compact object on a grid and wrong for this: the tower's upper half
     antialiases down to something the test cannot separate from the ground,
     while the grid in the far corner stays saturated enough to keep, so it
     returned 99% of the canvas and called it the tower. The render is already
     16:9, so there is nothing for a crop to do that the aim cannot do better.

     el 12, low, for the reason the film keeps it low: raise the camera and you
     look down on the tower and 300 m stops reading as 300 m. Low enough to be
     tall, high enough to still be an ISO and not an elevation - this is a
     thumbnail that says 3D BIM.

     The livery is the film's, taken up about a stop: a still read at 320 px has
     to carry on colour what a moving picture carries on movement, and the
     tower is a lattice of thin members that antialias towards the ground.

     The platform modules go the OTHER way, down to a deep amber, and that is
     the one thing this thumbnail had to be told twice. The platform decks came
     back pure WHITE - the brightest thing in the picture after the type, three
     bars across an orange tower. The first guess was that a deck is a plate and
     plates are their own colour scope, so `setColor('plate', ...)` was tried:
     no change at all, because a plate inside a module takes the MODULE's colour
     (the engine checks moduleId first and never reaches the plate override).
     They were the module's colour all along and blowing out, because a deck is
     a flat face pointed straight up at the light. Painted three stops down they
     blow out to warm instead of to paper.

     The film has the same white decks. It is left alone: at 1080p and moving
     they read as the two platform floors, which is what they are, and
     re-shooting seventy seconds of build to warm three slabs is not a trade
     worth making. */
  { id: 'eiffel',
    out: 'PLATE3D_EIFFEL_thumb.jpg',
    book: P3 + '/PLATE3D_EIFFEL.xlsx',
    bleed: true, side: true,
    hero: { kind: 'model', crop: false,
            aim: { tx: -86000, ty: -102000, tz: 138000,
                   dist: 520000, az: -40, el: 10 } },
    livery: { 'MD.LEG': '#f59a34', 'MD.ARC': '#ffb055', 'MD.PL1': '#b5701f',
              'MD.PL2': '#b5701f', 'MD.PL3': '#c07d29', 'MD.SHF': '#ffd79b',
              'MD.TOP': '#ffe9c6' },
    /* The same first line as the bridge, on purpose: the two are a set and the
       words are the ones people type. The name is the second line and it is
       short enough to be bigger than GOLDEN GATE BRIDGE was. */
    s1: 46, sz: 104,
    l1: '3D BIM MODELING', l2: 'EIFFEL<br>TOWER',
    l3: 'by PLATE3D' },

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
    /* `crop: false` means the framing is entirely the camera's. The crop finds
       the steel by saturation, and that works on a compact object standing on a
       grid; on a 300 m lattice it does not, because the tower's own upper half
       antialiases down to a colour the test cannot tell from the ground while
       the grid at the far corner reads saturated enough to keep. It took 99% of
       the canvas and called it the tower. Aiming the camera is the honest fix
       and it is the one the rest of this file already argues for. */
    if (f.hero.crop !== false)
      await tightCrop(page, dst, f.hero.pad == null ? 0.05 : f.hero.pad,
                      f.hero.aspect, f.hero.fill, f.hero.bias);
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
async function tightCrop(page, file, pad, aspect, fill, bias) {
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
      if (a.aspect) {
        const bw = x1 - x0, bh = y1 - y0;
        if (bw / bh > a.aspect) {
          const add = (bw / a.aspect - bh) / 2;
          y0 = Math.max(0, Math.floor(y0 - add)); y1 = Math.min(h, Math.ceil(y1 + add));
        } else if (a.fill) {
          /* And the other way, for a bleed. A BRIDGE is centred here because a
             bridge fills the frame; a TOWER is not, because a tower is a
             vertical thing in a horizontal frame and everything either side of
             it is empty. `bias` says where the steel's centre lands across the
             finished box - 0.5 is centred, 0.68 puts the tower two-thirds over
             and leaves the left of the picture for the type.

             Then: what falls off the canvas is TAKEN FROM THE OTHER SIDE rather
             than shortening the box. Clamping alone gave a box narrower than
             16:9, which `background-size:cover` then blew up to fit and cropped
             the top off the tower - the crop undoing the framing. */
          const want = bh * a.aspect, cx = (x0 + x1) / 2;
          const bias = a.bias == null ? 0.5 : a.bias;
          let nx0 = cx - want * bias, nx1 = nx0 + want;
          if (nx0 < 0) { nx1 = Math.min(w, nx1 - nx0); nx0 = 0; }
          if (nx1 > w) { nx0 = Math.max(0, nx0 - (nx1 - w)); nx1 = w; }
          x0 = Math.floor(nx0); x1 = Math.ceil(nx1);
        }
      }
      const d = document.createElement('canvas');
      d.width = x1 - x0; d.height = y1 - y0;
      d.getContext('2d').drawImage(c, x0, y0, d.width, d.height, 0, 0, d.width, d.height);
      ok({ url: d.toDataURL('image/png'), w: d.width, h: d.height, was: w + 'x' + h });
    };
    im.src = 'data:image/png;base64,' + a.b64;
  }), { b64: b64, pad: pad, aspect: aspect || 0, fill: !!fill, bias: bias });
  if (!out) return;
  fs.writeFileSync(file, Buffer.from(out.url.split(',')[1], 'base64'));
  console.log('    hero cropped to the steel: ' + out.was + ' -> ' + out.w + 'x' + out.h);
}

const PAGE = (f, hero) => `<meta charset="utf-8"><style>${FONTCSS}</style><style>
 *{margin:0;padding:0;box-sizing:border-box}
 html,body{width:1280px;height:720px;overflow:hidden}
 body{background:#0b1220;font-family:Inter,system-ui,sans-serif;
      -webkit-font-smoothing:antialiased;position:relative}
${f.bleed ? `
 .bleed{position:absolute;inset:0;background-size:cover;background-position:center;
        background-image:url(data:image/png;base64,${fs.readFileSync(hero).toString('base64')})}
${f.side ? `
 /* A TOWER, so the empty half is a side rather than a corner. The wash runs off
    the left edge and the type sits in the middle of it - dropped to the bottom
    corner it would be under the widest part of the tower, which is its base. */
 .veil{position:absolute;inset:0;background:
       radial-gradient(78% 130% at 2% 50%,
       rgba(11,18,32,.97) 0%,rgba(11,18,32,.92) 40%,
       rgba(11,18,32,.4) 66%,rgba(11,18,32,0) 84%),
       /* and a hand on the bottom edge, because the app's ground grid runs off
          the frame there and a grid line reaching the corner of a thumbnail is
          the one thing in the picture that is not the tower. It sinks the far
          grid without taking the feet, which are the widest and most
          recognisable part of the whole silhouette. */
       linear-gradient(to top, rgba(11,18,32,.72) 0%, rgba(11,18,32,0) 20%)}
 .txt{position:absolute;left:62px;top:50%;transform:translateY(-50%);z-index:2}` : `
 /* A radial wash in the corner the diagonal leaves empty, not a straight-edged
    veil: an edge across a full-bleed picture reads as a band laid over it. */
 .veil{position:absolute;inset:0;background:radial-gradient(120% 95% at 6% 96%,
       rgba(11,18,32,.97) 0%,rgba(11,18,32,.9) 34%,
       rgba(11,18,32,.35) 60%,rgba(11,18,32,0) 78%)}
 .txt{position:absolute;left:62px;bottom:56px;z-index:2}`}` : `
 .hero{position:absolute;right:-56px;top:50%;transform:translateY(-50%) rotate(-6deg);
       width:640px;background:#fff;border-radius:18px;padding:16px;
       box-shadow:0 46px 90px rgba(0,0,0,.62)}
 .hero img{width:100%;display:block;border-radius:8px}
 .veil{position:absolute;inset:0;
       background:linear-gradient(100deg,#0b1220 42%,rgba(11,18,32,.9) 58%,rgba(11,18,32,0) 76%)}
 .txt{position:absolute;left:62px;top:50%;transform:translateY(-50%);z-index:2}`}
 .no{display:inline-flex;align-items:center;gap:14px;margin-bottom:22px}
 .no b{font:800 54px/1 Inter,sans-serif;color:#0b1220;background:#38bdf8;
       padding:10px 20px;border-radius:12px;letter-spacing:-.03em}
 .no i{font:800 40px/1 Inter,sans-serif;color:#64748b;font-style:normal;
       letter-spacing:-.02em}
 .l1{font:800 ${f.s1 || 62}px/1 Inter,sans-serif;color:#cbd5e1;letter-spacing:-.03em}
 .l2{font:800 ${f.sz || (f.l2.length > 12 ? 104 : 122)}px/1.02 Inter,sans-serif;color:#38bdf8;
     letter-spacing:-.05em;margin-top:8px}
 /* An optional third line, for a film whose claim is a number. Muted and small
    on purpose: it is the line you read AFTER the other two have stopped you,
    and anything bigger competes with the name above it. */
 .l3{font:600 34px/1 Inter,sans-serif;color:#7c8ea3;letter-spacing:-.01em;margin-top:20px}
</style>
${f.bleed ? '<div class="bleed"></div>'
          : `<div class="hero"><img src="data:image/png;base64,${fs.readFileSync(hero).toString('base64')}"></div>`}
<div class="veil"></div>
<div class="txt">
  ${f.badge ? `<div class="no"><b>${f.badge}</b><i>${f.badgeNote}</i></div>` : ''}
  <div class="l1">${f.l1}</div>
  <div class="l2">${f.l2}</div>
  ${f.l3 ? `<div class="l3">${f.l3}</div>` : ''}
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
      const h = document.querySelector('.hero');
      if (!h) return null;                       // bleed layout: no card to run into
      const t = document.querySelector('.txt').getBoundingClientRect();
      return Math.round(t.right - h.getBoundingClientRect().left);
    });
    const png = SP + '/thumb_' + f.id + '_2x.png';
    await card.screenshot({ path: png });
    const out = SP + '/../' + f.out;
    execFileSync(FF, ['-hide_banner', '-loglevel', 'error', '-y', '-i', png,
      '-vf', 'scale=1280:720:flags=lanczos', '-q:v', '2', out]);
    console.log('  ' + f.out + '  ' + (fs.statSync(out).size / 1024).toFixed(0) +
                ' KB  ·  1280x720  ·  ' +
                (over === null ? 'full bleed'
                 : over > 0 ? '** type over the card by ' + over + 'px **'
                            : 'type clears the card by ' + (-over) + 'px'));
  }
  await browser.close();
})();
