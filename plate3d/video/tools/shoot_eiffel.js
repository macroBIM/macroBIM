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
const CARDS = path.join(SP, 'cards_eif');
const SRC = path.join(SP, 'eif_src');

const FPS = 30;
const MO = 12;                     // stills per second of camera motion
const VW = 2336, VH = 1294;        // -> 1920x1080 after the assembler's crop
const BUILD = 70;                  // seconds of tower going up
const HOLD = 8;                    // and of it standing there, still turning

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
  card('open', 4);
  console.log('  1 opening card');

  /* 2 - the take. Heights come out of the file names' order, which is the
     order make_eiffel_stages.js wrote them: panel top by panel top. */
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

  /* 4 - where to get it, shown rather than spelled out. The app's own Examples
     panel, opened by the button that opens it, and the row's own DOWNLOAD
     pressed. The engine fetches the workbook beside itself, so the request is
     routed to the file on disk: the button really goes to `saved` because the
     download really happened, which is the only reason to film it. */
  await app.route('**/PLATE3D_EIFFEL.xlsx', r => r.fulfill({
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    body: fs.readFileSync(path.resolve(SP, '../../PLATE3D_EIFFEL.xlsx')) }));
  const clip = async () => {
    const b = await app.evaluate(() => {
      const x = document.querySelector('#pb-ex .box').getBoundingClientRect();
      let h = Math.min(innerHeight, x.height * 1.09), w = h * 16 / 9;
      if (w > innerWidth) { w = innerWidth; h = w * 9 / 16; }
      return { x: Math.max(0, Math.min(innerWidth - w, x.x + x.width / 2 - w / 2)),
               y: Math.max(0, Math.min(innerHeight - h, x.y + x.height / 2 - h / 2)),
               width: w, height: h };
    });
    return app.screenshot({ type: 'jpeg', quality: 92, clip: b });
  };
  const row = () => app.evaluate(() => {
    const rs = [].slice.call(document.querySelectorAll('#pb-exlist tbody tr'));
    return rs.findIndex(t => (t.getAttribute('title') || '').indexOf('EIFFEL') >= 0);
  });
  await app.evaluate(() => window.plateBuilder.openSamples());
  await app.waitForTimeout(700);
  caption('dl', T, 10);
  put(await clip(), 2.2);                       // the list, as it opens
  const ri = await row();
  await app.evaluate(i => {                     // the row, lit the way a pointer lits it
    const r = document.querySelectorAll('#pb-exlist tbody tr')[i];
    r.style.background = '#f0fdf4'; r.scrollIntoView({ block: 'center' });
    const b = r.querySelector('.exb');
    if (b) { b.style.background = '#047857'; b.style.color = '#fff'; b.style.borderColor = '#047857'; }
  }, ri);
  await app.waitForTimeout(400);
  put(await clip(), 2.2);
  await app.evaluate(i => window.plateBuilder.getSample(i), ri);
  await app.waitForFunction(i => {
    const b = document.getElementById('pb-exb' + i);
    return b && /saved|failed/i.test(b.textContent);
  }, ri, { timeout: 60000 });
  await app.waitForTimeout(250);
  put(await clip(), 3.4);                       // and it says saved, because it is
  console.log('  4 the Examples panel, and the button pressed');

  /* 5 */
  card('end', 4);

  fs.writeFileSync(path.join(SP, 'shots_eif.json'),
    JSON.stringify({ fps: FPS, src: 'eif_src', out: 'PLATE3D_EIFFEL.mp4',
                     shots: shots, caps: caps }, null, 1));
  await browser.close();
  console.log('\n' + shots.length + ' stills · ' + caps.length + ' captions · ' +
              T.toFixed(1) + ' s\n' + SRC);
})();
