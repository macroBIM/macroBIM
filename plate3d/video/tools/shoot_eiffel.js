/* Shoot the Eiffel film.

       node video/tools/make_eiffel_stages.js    # 31 workbooks
       node video/tools/mkcards_eiffel.js
       node video/tools/rendercards_eiffel.js
       node video/tools/shoot_eiffel.js          # this
       node video/tools/assemble_eiffel.js

   ONE TAKE. The Golden Gate film was fourteen cuts because a bridge is a lot of
   different things; a tower is one thing going up, and cutting it up would only
   interrupt it. So there are five shots and the middle one is 70 seconds.

   THE CAMERA GROWS WITH THE TOWER. A fixed camera would start with something in
   the bottom corner and end with the top out of frame, so the target, the
   distance and the azimuth all follow the height built so far: the growing top
   stays a third of the way down the frame, the tower fills the frame at every
   size, and the whole thing turns once - exactly once, so the last frame is the
   same face as the first and "finished" reads without being said.

   The elevation barely moves. Raised, the camera looks DOWN at a 300 m thing
   and 300 m stops being 300 m.

   And the model steps 31 times while the camera moves continuously: each
   workbook is loaded once and then held for a couple of dozen frames while the
   orbit carries on. That is what makes a 31-step build look like a take.     */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const P3T = path.resolve(SP, '../../tools');
const BOOKS = path.resolve(SP, '../eiffel');
const P3 = path.resolve(SP, '../..');
const CARDS = path.join(SP, 'cards_eif');
const SRC = path.join(SP, 'eif_src');

const FPS = 30;
const MO = 12;                     // stills per second of camera motion
const VW = 2336, VH = 1294;        // -> 1920x1080 after the assembler's crop
const BUILD = 70;                  // seconds of tower going up
const HOLD = 8;                    // and of it standing there, still turning
/* ONLY=tail skips the 70-second take and shoots the ending alone. The take is
   twenty minutes and the ending is thirty seconds; when the ending is what is
   being worked on, shooting the take again is twenty minutes of the same
   frames. It writes its own shots file, which the assembler is not given. */
const ONLY = process.env.ONLY || '';

/* The model's own grade, lifted for a near-black viewport - see the head of
   tools/make_eiffel.js. Lighter as it goes up, which is how the real tower is
   painted and why the top does not disappear here. */
const LIVERY = { 'MD.LEG': '#e0862e', 'MD.ARC': '#efa04a', 'MD.PL1': '#eec18c',
                 'MD.PL2': '#eec18c', 'MD.PL3': '#f2cb9a', 'MD.SHF': '#ffcb8c',
                 'MD.TOP': '#fff2dc' };
/* The platforms came back near white in the first shoot. They are flat plates
   and they catch all the light there is, so a value picked to be "the lightest
   of the grade" turns into a bar of paper laid across the tower. Brought back
   INTO the orange: still lighter than the piers, no longer a different film. */

const HTOP = 300650;
/* Camera as a function of how much has been built. u = 0 at the ground,
   1 at the top. Everything is linear in u except the azimuth, which is linear
   in TIME - the turn has to be even whether or not the structure is. */
const cam = (u, t) => ({
  tx: 0, ty: 0,
  tz: 12000 + (145000 - 12000) * u,
  /* Sub-linear. Linear distance made the finished tower smaller in frame than
     the half-built one: the camera has to back off to keep the top in, but the
     tower's own height grows faster than its apparent size if the pull-back
     matches it exactly. The 0.82 is what puts 300 m across two thirds of the
     frame at the end, which is where the film has been going for 70 seconds. */
  dist: 190000 + (490000 - 190000) * Math.pow(u, 0.82),
  az: -40 + 360 * t,
  el: 14 + 4 * u
});

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
const caption = (id, start, dur) => caps.push({ png: 'cards_eif/t_' + id + '.png',
                                                start: start, dur: dur });
const card = (id, dur) => put(fs.readFileSync(path.join(CARDS, 't_' + id + '.jpg')), dur);

(async () => {
  fs.rmSync(SRC, { recursive: true, force: true });
  fs.mkdirSync(SRC, { recursive: true });

  const books = fs.readdirSync(BOOKS).filter(f => /\.xlsx$/.test(f)).sort();
  if (!books.length) throw new Error('no workbooks - run make_eiffel_stages.js');
  /* --allow-file-access-from-files, and downloads accepted. The last shot is
     the app fetching the workbook and saving it; from a file:// page Chromium
     refuses that fetch by default, and the button honestly reported `failed`.
     A film that shows a download has to have downloaded something. */
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
    await app.evaluate(l => Object.keys(l).forEach(k => {
      try { window.plateBuilder.setColor('module', k, l[k]); } catch (e) {}
    }), LIVERY);
    await app.waitForTimeout(350);
  }

  /* 1 - the card the film opens on */
  if (!ONLY) { card('open', 4); console.log('  1 opening card'); }

  /* 2 - the take. Heights come out of the file names' order, which is the
     order make_eiffel_stages.js wrote them: panel top by panel top. */
  if (!ONLY) {
  const K = Math.round(BUILD * MO);          // stills in the build
  const per = K / books.length;              // and how many each book holds
  caption('mem', T, 7);
  caption('arc', T + 16, 5);
  caption('pl1', T + 30, 5);
  caption('one', T + 46, 6);
  caption('top', T + BUILD - 6, 6);
  let done = 0;
  for (let b = 0; b < books.length; b++) {
    await load(books[b]);
    const upto = Math.round((b + 1) * per);
    for (; done < upto; done++) {
      const t = done / (K - 1);
      await aim(cam((b + 1) / books.length, t));
      put(await grab(), BUILD / K);
    }
    process.stdout.write(b % 5 === 4 ? '' + (b + 1) : '.');
  }
  console.log('\n  2 the take - ' + books.length + ' workbooks, ' + K + ' stills');

  /* 3 - finished, and the turn carries on so the take does not stop dead */
  const H = Math.round(HOLD * MO);
  for (let i = 0; i < H; i++) {
    await aim(cam(1, 1 + 0.28 * (i + 1) / H));
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

     Which also makes the download real: the engine asks for the workbook on the
     site's own origin, gets it, and the button says `saved` because it saved. */
  const TYPE = f => f.endsWith('.html') ? 'text/html'
    : f.endsWith('.js') ? 'application/javascript'
    : f.endsWith('.css') ? 'text/css'
    : f.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : 'application/octet-stream';
  /* 1600x900, not the 2336x1294 the viewport shoots at. This page is a web
     page, not a model: what has to be read is the menu, the Example button and
     a row of a list, and at 2336 the frame scales DOWN to 1920 and all three
     get smaller. At 1600 it scales up a fifth and they are legible. */
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
  await site.waitForTimeout(1500);              // the panel has to be up before it is filmed
  caption('dl', T, 9);
  await shot(2.4);                                   // the list
  const ri = await fr.evaluate(() => [].slice.call(
    document.querySelectorAll('#pb-exlist tbody tr'))
    .findIndex(t => (t.getAttribute('title') || '').indexOf('EIFFEL') >= 0));
  if (ri < 0) throw new Error('no Eiffel row on the Example list');
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
  /* Belt and braces on the badge. Stopping the 2.6 s timer should be enough and
     was not - the reset still landed before the frame. So the state the app
     REALLY reached, asserted on the line above, is written back immediately
     before the shutter. Holding a state is not inventing one. */
  await fr.evaluate(i => { const b = document.getElementById('pb-exb' + i);
    b.textContent = 'saved'; b.className = 'exb ok'; }, ri);
  /* The frame comes off another origin, so Chromium runs it in its own process
     and a page screenshot can be a paint behind it. The DOM said `saved` and the
     picture said `download` - the same frame, two processes. Two animation
     frames inside the iframe and a beat outside it, and they agree. */
  await fr.evaluate(() => new Promise(r =>
    requestAnimationFrame(() => requestAnimationFrame(r))));
  await site.waitForTimeout(900);
  await shot(3.6);                                   // and it says saved
  if (!saved) throw new Error('the button said saved but nothing was downloaded');
  await site.close();
  console.log('  4 into the site, and the workbook taken');

  /* 5 */
  card('end', 4);

  fs.writeFileSync(path.join(SP, ONLY ? 'shots_eif_' + ONLY + '.json' : 'shots_eif.json'),
    JSON.stringify({ fps: FPS, src: 'eif_src', out: 'PLATE3D_EIFFEL.mp4',
                     shots: shots, caps: caps }, null, 1));
  await browser.close();
  console.log('\n' + shots.length + ' stills · ' + caps.length + ' captions · ' +
              T.toFixed(1) + ' s\n' + SRC);
})();
