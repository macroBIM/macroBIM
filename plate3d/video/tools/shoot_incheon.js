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

   A CABLE-STAYED BRIDGE IS ONE PYLON'S STORY, and at Incheon it is told in two
   halves. The side span goes up first in big blocks on falsework, its stays
   are strung, the bents come out - and from then on that span is the anchor
   holding the pylon down, so the main span can go out on its own, one segment
   and one ring of stays at a time, with nothing balancing it on the other
   side. Two different operations, which is why the camera can stay on one
   pylon for a minute without repeating itself: what is in frame is that pylon
   and what that pylon has built, and nothing else.

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
/* ONLY=tail skips the 66-second take and shoots the ending alone. The take
   is twenty minutes and the ending is half of one; when the ending is what
   is being worked on, shooting the take again is twenty minutes of the same
   frames. It writes its own stills directory and its own shots file, and
   the assembler is given neither. */
const ONLY = process.env.ONLY || '';
const SRC = path.join(SP, 'inc_src');
/* ONLY=tail RESUMES: it keeps the stills the take already wrote, picks the
   numbering up where they stop, and shoots the ending onto the end of them.

   The first version of this emptied SRC before doing anything, which is not
   what "shoot the ending alone" means when the ending and the take share a
   directory - it deleted 792 stills to save twenty minutes and then cost
   twenty minutes. The second version wrote somewhere else, which kept the
   take safe and left the two halves in different folders with no film in
   either. This one is the useful shape: the take writes a manifest of itself
   when it finishes, and the ending reads it back.

   Which matters because the ending is what keeps needing work. It is the only
   part of the film with a browser, a site, an iframe and a button in it. */
const TAKE = path.join(SP, 'inc_take.json');
const RESUME = ONLY === 'tail';

const FPS = 30;
const MO = 12;                     // stills per second of camera motion
const VW = 2336, VH = 1294;        // -> 1920x1080 after the assembler's crop
const BUILD = 76;                  // seconds of bridge going up
const HOLD = 8;                    // and of it standing there, still turning

/* The bridge's own colour. Incheon is a white concrete pylon with white
   cables, and on a near-black viewport white is the most legible thing there
   is - so unlike the Eiffel, nothing here has to be lifted to be seen.

   THE CABLES ARE THE ONLY PURE WHITE. 208 of them are the subject; the pylon
   goes a step down and the deck two steps, so the fan reads as the brightest
   thing in every frame without anything else being dimmed to make it so. */
const LIVERY = { 'MD.STAY': '#ffffff', 'MD.PYL': '#e8edf3',
                 'MD.DCK': '#6f7c8b', 'MD.PIE': '#aab6c2' };
/* THE DECK CAME BACK BRIGHTER THAN THE CABLES, which is the Eiffel's platforms
   again: the deck is a flat top face and it catches all the light there is, so
   a value two steps below the pylon renders above it. It is down two more
   steps here and it is still the line that makes the bridge readable at
   1,480 m - it is just no longer the first thing the eye lands on. The fan is
   the subject and the fan is what is white. */

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
  const az = -35 + 360 * u;
  /* HOW MUCH OF THE LENGTH THE CAMERA CAN ACTUALLY SEE. The bridge runs along
     x, so square-on it is 1,480 m wide in frame and end-on it is nothing -
     and the take turns through both. Framed on the span alone the bridge
     breathed between filling the frame and filling half of it, and the
     closure, which is the shot the whole take is going towards, came out at
     half: a long thin thing in the middle of a lot of grid.

     cos of the azimuth is exactly the foreshortening, so multiplying by it
     holds the framing constant all the way round instead of at one bearing.
     The floor is not a framing number - it is the camera staying OUTSIDE the
     bridge. End-on, cos goes to zero and the distance with it, and 0.7 of the
     span is the nearest a camera can be to the middle of something 740 m long
     in each direction and still be looking at it. */
  const face = Math.max(0.7, Math.abs(Math.cos(az * Math.PI / 180)));
  return {
    tx: (lo + hi) / 2, ty: 0,
    /* Just over half the pylon. Aimed at the deck the bridge is a strip across
       the bottom of the frame; aimed at the top of the pylon the deck falls
       out of it. Half way up is where both fit. */
    tz: Math.max(60000, st.ztop * 0.52),
    /* Whichever is harder to fit - the pylon standing up or the cantilever
       lying down. Before the deck starts the span is zero and the pylon
       decides; from the first ring on, the cantilever does. Both constants put
       their subject across about four fifths of the frame, which is what makes
       the hand-over between them invisible.

       THE 1.2 IS MEASURED, NOT GUESSED. Guessed twice and wrong twice - once
       too far, once near enough that the near end of the bridge went off the
       bottom corner, because a perspective camera makes the near half of a
       1,480 m object much larger than the far half and no amount of arithmetic
       about angles catches that. probe_inc_frame.js loads the finished bridge
       and takes one frame per candidate at the bearing the take ends on, which
       is a minute against the twenty a shoot costs. */
    dist: Math.max(330000, st.ztop * 1.5, span * face * 1.2),
    /* Linear in TIME, not in what is built: the turn has to be even whether or
       not the structure is. Exactly 360 degrees, so the last frame of the take
       is the same face as the first. */
    az: az,
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
  if (RESUME) {
    if (!fs.existsSync(TAKE))
      throw new Error('no take to resume - run the shoot without ONLY first');
    const t = JSON.parse(fs.readFileSync(TAKE, 'utf8'));
    t.shots.forEach(x => shots.push(x));
    t.caps.forEach(x => caps.push(x));
    n = t.n; T = t.T;
    const have = fs.readdirSync(SRC).filter(f => /^s\d+\.jpg$/.test(f)).length;
    if (have !== n) throw new Error(have + ' stills on disk for a take of ' + n);
    console.log('  resuming after ' + n + ' stills · ' + T.toFixed(1) + ' s');
  } else {
    fs.rmSync(SRC, { recursive: true, force: true });
    fs.mkdirSync(SRC, { recursive: true });
  }

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
  /* Timed against the stages, not spaced by eye. 79 stages over BUILD is a
     shade under a second each, so: the pylon runs to about 12 s, the side
     span's blocks to 17, its cables to 30 - and the bents come out right
     there, which is where `fan` sits. The main span has the rest. */
  caption('pyl', T + 2, 6);
  caption('side', T + 9, 5);
  caption('fan', T + 20, 7);
  caption('seg', T + 29, 6);
  caption('rows', T + 42, 7);
  caption('exact', T + 54, 6);
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
  /* The take's own manifest, so ONLY=tail can pick it up. Written here rather
     than at the end because what comes after it is the part that keeps
     failing, and a manifest written after the failure is no manifest. */
  fs.writeFileSync(TAKE, JSON.stringify({ shots: shots, caps: caps, n: n, T: T }));
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
  /* THE FRAME IS RE-FOUND EACH ROUND, not held. Taken once and waited on, this
     timed out after two minutes on a selector its own log said had "resolved to
     visible" - the handle was for the frame as it was before the embed
     navigated, so the element was found in an execution context that no longer
     paints. Looking the frame up again each time costs a round trip and cannot
     go stale. */
  const fr = await (async () => {
    const t0 = Date.now();
    for (;;) {
      const f = site.frames().find(x => /embed\.html/.test(x.url()));
      if (f) {
        try {
          await f.waitForFunction(() => {
            const e = document.getElementById('pb-app');
            return !!e && e.getBoundingClientRect().width > 0;
          }, null, { timeout: 5000 });
          return f;
        } catch (e) { /* it moved under us - look again */ }
      }
      if (Date.now() - t0 > 180000) throw new Error('the PLATE3D frame never came up');
      await site.waitForTimeout(500);
    }
  })();
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
  /* The same two-frame settle the saved shot gets. Without it this beat was a
     picture of the list BEFORE the row was scrolled to and lit - the frame is
     on another origin and its paint arrives after the parent's screenshot. Two
     seconds of the film pointing at nothing. */
  await fr.evaluate(() => new Promise(r =>
    requestAnimationFrame(() => requestAnimationFrame(r))));
  await site.waitForTimeout(700);
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

  fs.writeFileSync(path.join(SP, 'shots_inc.json'),
    JSON.stringify({ fps: FPS, src: 'inc_src', out: 'PLATE3D_INCHEON.mp4',
                     shots: shots, caps: caps }, null, 1));
  await browser.close();
  console.log('\n' + shots.length + ' stills · ' + caps.length + ' captions · ' +
              T.toFixed(1) + ' s\n' + SRC);
})();
