/* Shoot the Incheon film.

       node video/tools/make_incheon_stages.js   # 62 workbooks
       node video/tools/mkcards_incheon.js
       node video/tools/rendercards_incheon.js
       node video/tools/shoot_incheon.js         # this
       node video/tools/assemble_incheon.js

   ONE TAKE, like the Eiffel - but the camera does the opposite thing, and that
   is the whole difference between the two films.

   A SUSPENSION BRIDGE PUTS BOTH TOWERS IN ONE TAKE. Spin the cable between
   them and the deck hangs off it; the subject is the pair and the curve. The
   Golden Gate film was framed that way and it was right.

   A CABLE-STAYED BRIDGE HAS NOTHING TO HANG FROM. Each pylon holds up whatever
   it has already built, so the deck grows out of ONE pylon in both directions
   at once and the ring of stays that carries a new segment goes on before the
   next one starts. One side alone and the pylon goes over. So this camera sits
   on one pylon and stays there: what is in frame is that pylon and what that
   pylon has built, and nothing else.

   AND THEN IT LETS GO. Over the last tenth of the take the frame opens to the
   whole 1,480 m, and the second pylon - off-screen for a minute, doing the
   same thing the whole time - arrives already grown. That reveal is the one
   line of the film that the picture says by itself, which is why the caption
   under it is a reply and not a label.

   THE FRAME IS THE MODEL'S, NOT THIS FILE'S. video/incheon/frames.json says,
   for each of the 62 steps, how high the pylon is and how far its cantilever
   has reached. The camera is computed from that. Nothing about the geometry is
   typed in here, so re-staging the model re-aims the camera.

   And the model steps 62 times while the camera moves continuously: each
   workbook is loaded once and held for a dozen frames while the orbit carries
   on. That is what makes a 62-step build look like a take.                  */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const P3T = path.resolve(SP, '../../tools');
const BOOKS = path.resolve(SP, '../incheon');
const P3 = path.resolve(SP, '../..');
const CARDS = path.join(SP, 'cards_inc');
const SRC = path.join(SP, 'inc_src');

const FPS = 30;
const MO = 12;                     // stills per second of camera motion
const VW = 2336, VH = 1294;        // -> 1920x1080 after the assembler's crop
const BUILD = 66;                  // seconds of bridge going up
const HOLD = 8;                    // and of it standing there, still turning
const ONLY = process.env.ONLY || '';

/* The bridge's own colour. Incheon is a white concrete pylon with white
   cables, and on a near-black viewport white is the most legible thing there
   is - so unlike the Eiffel, nothing here has to be lifted to be seen.

   THE CABLES ARE THE ONLY PURE WHITE. 208 of them are the subject; the pylon
   goes a step down and the deck two steps, so the fan reads as the brightest
   thing in every frame without anything else being dimmed to make it so. */
const LIVERY = { 'MD.STAY': '#ffffff', 'MD.PYL': '#e8edf3',
                 'MD.DCK': '#8b98a6', 'MD.PIE': '#c8d2dc' };

const F = JSON.parse(fs.readFileSync(path.join(BOOKS, 'frames.json'), 'utf8'));
const LAST = F[F.length - 1];
/* Where the camera lets go of the pylon, as a fraction of the take. 0.90 of
   66 s is the last 6.6 seconds - long enough to read the whole bridge, short
   enough that it is a reveal and not a retreat. */
const RELEASE = 0.90;
const mix = (a, b, w) => a + (b - a) * w;

/* u = 0 at the first frame of the take, 1 at the last. The subject at u is the
   step's own extent, opened out to the whole bridge over the last tenth. */
const cam = (st, u) => {
  const w = u <= RELEASE ? 0
          : Math.pow((u - RELEASE) / (1 - RELEASE), 0.75);
  const lo = mix(st.xlo, LAST.xlo, w), hi = mix(st.xhi, LAST.xhi, w);
  const span = hi - lo;
  return {
    tx: (lo + hi) / 2, ty: 0,
    /* Just over half the pylon. Aimed at the deck the bridge is a strip across
       the bottom of the frame; aimed at the top of the pylon the deck falls
       out of it. Half way up is where both fit. */
    tz: Math.max(60000, st.ztop * 0.52),
    /* Whichever is harder to fit - the pylon standing up or the cantilever
       lying down. Before the deck starts the span is zero and the pylon
       decides; from the first ring on, the cantilever does. */
    dist: Math.max(330000, st.ztop * 1.5, span * 1.15),
    /* Linear in TIME, not in what is built: the turn has to be even whether or
       not the structure is. Exactly 360 degrees, so the last frame of the take
       is the same face as the first. */
    az: -35 + 360 * u,
    el: 8 + 8 * u
  };
};

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
const caption = (id, start, dur) => caps.push({ png: 'cards_inc/t_' + id + '.png',
                                                start: start, dur: dur });
const card = (id, dur) => put(fs.readFileSync(path.join(CARDS, 't_' + id + '.jpg')), dur);

(async () => {
  fs.rmSync(SRC, { recursive: true, force: true });
  fs.mkdirSync(SRC, { recursive: true });

  const books = fs.readdirSync(BOOKS).filter(f => /\.xlsx$/.test(f)).sort();
  if (!books.length) throw new Error('no workbooks - run make_incheon_stages.js');
  if (books.length !== F.length)
    throw new Error(books.length + ' workbooks for ' + F.length + ' frames');

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
           '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
  const app = await browser.newPage({ viewport: { width: VW, height: VH },
                                      acceptDownloads: true });
  await app.route('**/{unpkg.com,cdnjs.cloudflare.com}/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: LIB(r.request().url()) }));
  await app.goto('file://' + SP + '/video_page.html', { waitUntil: 'domcontentloaded' });
  await app.waitForTimeout(3000);

  const aim = c => app.evaluate(a => window.__aim(a.tx, a.ty, a.tz, a.dist, a.az, a.el), c);
  const grab = () => app.evaluate(() => window.__grab(0.92))
                        .then(d => Buffer.from(d.split(',')[1], 'base64'));
  async function load(book) {
    await app.setInputFiles('#pb-file', path.join(BOOKS, book));
    await app.waitForFunction(f => {
      const r = document.getElementById('pb-result');
      return r && r.innerText.indexOf(f) >= 0 && /Succeed|Failed|error/i.test(r.innerText);
    }, book, { timeout: 300000 });
    /* A stage that fails is a frame of a bridge that is not this bridge, and
       it would go by in a twelfth of a second without anyone seeing it. */
    const bad = await app.evaluate(() =>
      /Failed|error/i.test((document.getElementById('pb-result') || {}).innerText || ''));
    if (bad) throw new Error(book + ' did not load');
    await app.evaluate(l => Object.keys(l).forEach(k => {
      try { window.plateBuilder.setColor('module', k, l[k]); } catch (e) {}
    }), LIVERY);
    await app.waitForTimeout(350);
  }

  /* 1 - the card the film opens on */
  if (!ONLY) { card('open', 4); console.log('  1 opening card'); }

  /* 2 - the take */
  if (!ONLY) {
  const K = Math.round(BUILD * MO);          // stills in the build
  const per = K / books.length;              // and how many each book holds
  caption('pyl', T + 2, 7);
  caption('both', T + 16, 6);
  caption('rows', T + 32, 7);
  caption('exact', T + 46, 6);
  /* On the reveal, not before it. RELEASE is when the camera starts to open
     out; the line lands a beat after that, when the second pylon is actually
     in frame. */
  caption('other', T + BUILD * RELEASE + 1.2, 5.4);
  let done = 0;
  for (let b = 0; b < books.length; b++) {
    await load(books[b]);
    const upto = Math.round((b + 1) * per);
    for (; done < upto; done++) {
      const u = done / (K - 1);
      await aim(cam(F[b], u));
      put(await grab(), BUILD / K);
    }
    process.stdout.write(b % 10 === 9 ? '' + (b + 1) : '.');
  }
  console.log('\n  2 the take - ' + books.length + ' workbooks, ' + K + ' stills');

  /* 3 - finished, and the turn carries on so the take does not stop dead */
  const H = Math.round(HOLD * MO);
  for (let i = 0; i < H; i++) {
    await aim(cam(LAST, 1 + 0.28 * (i + 1) / H));
    put(await grab(), HOLD / H);
  }
  console.log('  3 finished');
  }

  /* 4 - where to get it, WALKED INTO rather than spelled out. The macroBIM
     site is run off this disk: `site_page.html` is the shell the live PHP page
     puts round `layout_body.js`, and that file - the design repository's own -
     builds the sidebar and every page. So the menu on screen is the real menu
     and PLATE3D opens the real embed. macrobim.github.io is routed to the
     working tree, so the frame, the engine and the workbook all come off this
     disk and nothing is fetched.

     Which also makes the download real: the engine asks for the workbook on
     the site's own origin, gets it, and the button says `saved` because it
     saved. This shot could not be taken at all until TAPER reached the shipped
     engine - before that the Example list had no Incheon row to press, and a
     film that shows a download of a file nobody can open is the one thing the
     first of these films decided never to do. */
  const TYPE = f => f.endsWith('.html') ? 'text/html'
    : f.endsWith('.js') ? 'application/javascript'
    : f.endsWith('.css') ? 'text/css'
    : f.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : 'application/octet-stream';
  const site = await browser.newPage({ viewport: { width: 1600, height: 900 },
                                       acceptDownloads: true });
  await site.route('**/{unpkg.com,cdnjs.cloudflare.com}/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: LIB(r.request().url()) }));
  await site.route('**/fonts.{googleapis,gstatic}.com/**', r => r.abort());
  await site.route('**://macrobim.github.io/**', r => {
    const rel = new URL(r.request().url()).pathname
      .replace(/^\/macroBIM\//, '').replace(/^\/design\//, '');
    const f = path.join(P3, '..', rel);
    if (!fs.existsSync(f)) return r.abort();
    r.fulfill({ contentType: TYPE(f), body: fs.readFileSync(f) });
  });
  let saved = false;
  site.on('download', () => { saved = true; });
  await site.goto('file://' + SP + '/site_page.html', { waitUntil: 'load' });
  await site.waitForTimeout(1500);
  const shot = d => site.screenshot({ type: 'jpeg', quality: 92 }).then(b => put(b, d));

  caption('nav', T, 8);
  await shot(2.6);                                   // the site, and its menu
  const LEG = '#sidebar a[data-page="draw-plate3d"]';
  await site.hover(LEG);
  await site.waitForTimeout(400);
  await shot(1.8);                                   // PLATE3D, under the pointer
  await site.click(LEG);
  const fr = await site.waitForSelector('iframe[title="PLATE3D"]')
    .then(h => h.contentFrame());
  await fr.waitForSelector('#pb-app', { timeout: 120000 });
  await site.waitForTimeout(2200);
  await shot(3.0);                                   // the app, in the page

  await fr.hover('#pb-app .guide.ex');
  await site.waitForTimeout(400);
  await shot(1.8);                                   // Example, under the pointer
  await fr.click('#pb-app .guide.ex');
  await site.waitForTimeout(1500);
  caption('dl', T, 9);
  await shot(2.4);                                   // the list
  const ri = await fr.evaluate(() => [].slice.call(
    document.querySelectorAll('#pb-exlist tbody tr'))
    .findIndex(t => (t.getAttribute('title') || '').indexOf('INCHEON') >= 0));
  if (ri < 0) throw new Error('no Incheon row on the Example list - is the engine promoted?');
  await fr.evaluate(i => {
    const r = document.querySelectorAll('#pb-exlist tbody tr')[i];
    r.style.background = '#f0fdf4'; r.scrollIntoView({ block: 'center' });
    const b = r.querySelector('.exb');
    if (b) { b.style.background = '#047857'; b.style.color = '#fff'; b.style.borderColor = '#047857'; }
  }, ri);
  await site.waitForTimeout(400);
  await shot(2.2);                                   // the row
  /* The engine clears the `saved` badge 2.6 s after it sets it - long enough
     for a person reading the list, shorter than a screenshot of this page. So
     that one timer is stopped. Everything else really happens. */
  await fr.evaluate(() => {
    const st = window.setTimeout;
    window.setTimeout = (fn, ms) => (ms === 2600 ? 0 : st(fn, ms));
  });
  await fr.evaluate(i => window.plateBuilder.getSample(i), ri);
  await fr.waitForFunction(i => {
    const b = document.getElementById('pb-exb' + i);
    return b && /saved|failed/i.test(b.textContent);
  }, ri, { timeout: 60000 });
  const said = await fr.evaluate(i =>
    document.getElementById('pb-exb' + i).textContent.trim(), ri);
  if (!/saved/i.test(said)) throw new Error('the download said "' + said + '"');
  await fr.evaluate(i => { const b = document.getElementById('pb-exb' + i);
    b.textContent = 'saved'; b.className = 'exb ok'; }, ri);
  /* The frame comes off another origin, so Chromium runs it in its own process
     and a page screenshot can be a paint behind it. */
  await fr.evaluate(() => new Promise(r =>
    requestAnimationFrame(() => requestAnimationFrame(r))));
  await site.waitForTimeout(900);
  await shot(3.6);                                   // and it says saved
  if (!saved) throw new Error('the button said saved but nothing was downloaded');
  await site.close();
  console.log('  4 into the site, and the workbook taken');

  /* 5 */
  card('end', 4);

  fs.writeFileSync(path.join(SP, ONLY ? 'shots_inc_' + ONLY + '.json' : 'shots_inc.json'),
    JSON.stringify({ fps: FPS, src: 'inc_src', out: 'PLATE3D_INCHEON.mp4',
                     shots: shots, caps: caps }, null, 1));
  await browser.close();
  console.log('\n' + shots.length + ' stills · ' + caps.length + ' captions · ' +
              T.toFixed(1) + ' s\n' + SRC);
})();
