/* The YouTube thumbnail for Basics 01.

   A thumbnail is not a small poster. It is read at about 250 pixels wide in a
   list and nearer 120 on a phone, so it gets one picture and three or four
   words, and everything else is a distraction. What it must NOT do is repeat
   the YouTube title - that sits underneath it in the same list, and saying the
   same thing twice wastes the only two things the viewer sees.

   It borrows the films' look rather than inventing one: the title card's ground
   (#0b1220), Inter 800, and the same accent on the second line. Someone who has
   seen one of these should recognise the next without reading it.

   The picture is the app's own drawing of a plate - its nine points named on
   the outline, its holes dimensioned. It survives being shrunk, which a thin
   steel frame does not, and it is what the video is about. Both heroes are
   grabbed by mkthumb_basic's own capture pass; hero_model.png is kept for a
   variant.

   Out at 1280x720, drawn at 2x and downsampled, which is sharper than drawing
   at 1x. YouTube wants at least 1280x720 and under 2 MB.

     node mkthumb_basic.js                                                    */
const { chromium } = require('playwright-core');
const { execFileSync } = require('child_process');
const FF = require('ffmpeg-static');
const fs = require('fs');

const SP = __dirname;
const OUT = SP + '/basic';
const FONTCSS = fs.readFileSync(SP + '/v_font.css', 'utf8');

const b64 = f => 'data:image/png;base64,' + fs.readFileSync(OUT + '/' + f).toString('base64');

/* Two lines, and only two.

   The first draft had four: an eyebrow reading SPREADSHEET -> 3D above the
   title and PLATE3D BASICS beside the badge. Shrunk to the 320 pixels a list
   actually gives you, both were grey mush. A line that cannot be read at
   thumbnail size is not a small benefit, it is clutter competing with the line
   that can - so they are gone and what is left got bigger.

   HOW TO USE stays small because it is the grammar of the title, not the
   subject; PLATE & CUT is what someone scanning for it is scanning for. The 01
   is what makes a series read as a series, so it leads rather than sitting in a
   corner at 40px.

   The drawing needs its own ground. On the dark blue it was a dark canvas on a
   dark page and the outline was the only thing separating them; on a white card
   - which is how the app really shows it - the whole picture separates at any
   size. */
const PAGE = `<meta charset="utf-8"><style>${FONTCSS}</style><style>
 *{margin:0;padding:0;box-sizing:border-box}
 html,body{width:1280px;height:720px;overflow:hidden}
 body{background:#0b1220;font-family:Inter,system-ui,sans-serif;
      -webkit-font-smoothing:antialiased;position:relative}

 /* the card the app draws a part on, bled off the right edge */
 .hero{position:absolute;right:-56px;top:50%;transform:translateY(-50%) rotate(-6deg);
       width:640px;background:#fff;border-radius:18px;padding:16px;
       box-shadow:0 46px 90px rgba(0,0,0,.62)}
 .hero img{width:100%;display:block;border-radius:8px}
 /* a wash so the type never sits on the drawing */
 .veil{position:absolute;inset:0;
       background:linear-gradient(100deg,#0b1220 42%,rgba(11,18,32,.9) 58%,rgba(11,18,32,0) 76%)}

 .txt{position:absolute;left:62px;top:50%;transform:translateY(-50%);z-index:2}
 .no{display:inline-flex;align-items:center;gap:14px;margin-bottom:22px}
 .no b{font:800 54px/1 Inter,sans-serif;color:#0b1220;background:#38bdf8;
       padding:10px 20px;border-radius:12px;letter-spacing:-.03em}
 .no i{font:800 40px/1 Inter,sans-serif;color:#64748b;font-style:normal;
       letter-spacing:-.02em}
 .l1{font:800 62px/1 Inter,sans-serif;color:#cbd5e1;letter-spacing:-.03em}
 .l2{font:800 122px/1.02 Inter,sans-serif;color:#38bdf8;letter-spacing:-.05em;
     margin-top:8px}
</style>
<div class="hero"><img src="${b64('hero_plate.png')}"></div>
<div class="veil"></div>
<div class="txt">
  <div class="no"><b>01</b><i>BASICS</i></div>
  <div class="l1">HOW TO USE</div>
  <div class="l2">PLATE &amp; CUT</div>
</div>`;

(async () => {
  fs.writeFileSync(OUT + '/thumb_basic.html', PAGE);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  await p.route('**/fonts.{googleapis,gstatic}.com/**', r => r.abort());
  await p.goto('file://' + OUT + '/thumb_basic.html', { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.load('800 116px Inter')
    .then(() => document.fonts.load('700 30px Inter'))
    .then(() => document.fonts.ready)).catch(() => {});
  await p.waitForTimeout(400);
  await p.screenshot({ path: OUT + '/thumb_basic_2x.png' });
  await b.close();

  /* down to 1280x720. Drawing at 2x and shrinking beats drawing at 1x - the
     type keeps its edges instead of being hinted onto a coarse grid. */
  const out = SP + '/../PLATE3D_BASIC_thumb.jpg';
  execFileSync(FF, ['-hide_banner', '-loglevel', 'error', '-y',
    '-i', OUT + '/thumb_basic_2x.png',
    '-vf', 'scale=1280:720:flags=lanczos', '-q:v', '2', out]);
  console.log(out.replace(/.*\//, '') + '  ' +
              (fs.statSync(out).size / 1024).toFixed(0) + ' KB  ·  1280x720');
})();
