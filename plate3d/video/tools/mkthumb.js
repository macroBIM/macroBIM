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
const FONTCSS = fs.readFileSync(SP + '/v_font.css', 'utf8');

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

  { id: 'splice',
    out: 'PLATE3D_SPLICE_thumb.jpg',
    book: SP + '/../SPLICE_3_BOLT.xlsx',
    hero: { kind: 'model', az: -34, el: 16, dist: 0.42 },
    l1: 'BOLTED SPLICE', l2: 'MADE SIMPLE' }
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
    await page.evaluate(h => {
      const c = window.__cam();
      window.__aim(c.tx, c.ty, c.tz, c.dist * h.dist, h.az, h.el);
    }, f.hero);
    await page.waitForTimeout(900);
    const d = await page.evaluate(() => {
      window.__pbDraw();
      return window.__pbCanvas.toDataURL('image/png');
    });
    fs.writeFileSync(dst, Buffer.from(d.split(',')[1], 'base64'));
  }
  return dst;
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
 .l1{font:800 62px/1 Inter,sans-serif;color:#cbd5e1;letter-spacing:-.03em}
 .l2{font:800 ${f.l2.length > 12 ? 104 : 122}px/1.02 Inter,sans-serif;color:#38bdf8;
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
    const png = SP + '/thumb_' + f.id + '_2x.png';
    await card.screenshot({ path: png });
    const out = SP + '/../' + f.out;
    execFileSync(FF, ['-hide_banner', '-loglevel', 'error', '-y', '-i', png,
      '-vf', 'scale=1280:720:flags=lanczos', '-q:v', '2', out]);
    console.log('  ' + f.out + '  ' + (fs.statSync(out).size / 1024).toFixed(0) +
                ' KB  ·  1280x720');
  }
  await browser.close();
})();
