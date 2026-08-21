/* Cuts 10 and 11 only - the two the crash took. They append to the frames that
   survived, so the hour already spent is not spent again.
   shots.json is written after each, which is what the first pass should have
   done: it saved once at the end, so a browser that died in cut 10 took the
   record of all 562 good frames with it. */
const { chromium } = require('playwright-core');
const fs = require('fs'); const path = require('path');
const SP = __dirname, SRC = SP + '/src', V = '/home/user/macroBIM/plate3d/video/';
const FPS = 30, MO = 15, VW = 2336, VH = 1294;

const base = JSON.parse(fs.readFileSync(SP + '/shots_recovered.json', 'utf8'));
const shots = base.shots, caps = base.caps;
let n = shots.length, T = shots.reduce((a, s) => a + s.dur, 0);
console.log('이어붙이기 시작: ' + n + '장, ' + T.toFixed(2) + 's');

function put(buf, dur) {
  const f = 's' + String(n++).padStart(4, '0') + '.jpg';
  fs.writeFileSync(SRC + '/' + f, buf);
  shots.push({ file: f, dur: dur }); T += dur;
}
const save = () => fs.writeFileSync(SP + '/shots.json',
  JSON.stringify({ fps: FPS, shots: shots, caps: caps }, null, 1));
const caption = (id, start, dur) => caps.push({ png: 't_' + id + '.png', start: start, dur: dur });
const LIB = f => { let p = SP + '/node_modules/three/build/three.min.js';
  if (f.includes('OrbitControls')) p = SP + '/node_modules/three/examples/js/controls/OrbitControls.js';
  if (f.includes('polybool')) p = SP + '/node_modules/polybooljs/dist/polybool.min.js';
  if (f.includes('exceljs')) p = SP + '/node_modules/exceljs/dist/exceljs.min.js';
  return fs.readFileSync(p, 'utf-8'); };
const ease = u => u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
const mix = (a, b, u) => a + (b - a) * u;

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox','--allow-file-access-from-files',
           '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const wire = async p => { await p.route('**/{unpkg.com,cdnjs.cloudflare.com}/**', r =>
      r.fulfill({ contentType: 'application/javascript', body: LIB(r.request().url()) }));
    await p.route('**/fonts.{googleapis,gstatic}.com/**', r => r.abort()); };
  const app = await br.newPage({ viewport: { width: VW, height: VH } });
  await wire(app);
  await app.goto('file://' + SP + '/video_page.html', { waitUntil: 'domcontentloaded' });
  await app.waitForTimeout(3500);

  /* 10  all of it at once */
  await app.setInputFiles('#pb-file', V + 'TOWER_5_ALL.xlsx');
  await app.waitForFunction(b => { const r = document.getElementById('pb-result');
    return r && r.innerText.indexOf(b) >= 0 && /Succeed/.test(r.innerText); },
    'TOWER_5_ALL.xlsx', { timeout: 300000 });
  await app.waitForTimeout(900);
  const c = await app.evaluate(() => window.__cam());
  caption('c10', T + 0.8, 5.6);
  const k = Math.round(7.0 * MO);
  for (let i = 0; i < k; i++) {
    const u = ease(i / (k - 1));
    await app.evaluate(a => window.__aim(a.tx, a.ty, a.tz, a.dist, a.az, a.el),
      { ...c, az: mix(c.az - 14, c.az + 10, u), el: mix(c.el, c.el + 5, u),
        dist: c.dist * mix(1.04, 0.92, u) });
    const d = await app.evaluate(() => window.__grab(0.92));
    put(Buffer.from(d.split(',')[1], 'base64'), 7.0 / k);
  }
  save(); console.log('  [' + T.toFixed(2) + 's] 10 hero');

  /* 11  outro */
  const doc = await br.newPage({ viewport: { width: 1920, height: 1080 } });
  await wire(doc);
  await doc.goto('file://' + SP + '/t_o11.html', { waitUntil: 'load' });
  await doc.waitForTimeout(500);
  put(await doc.screenshot({ type: 'jpeg', quality: 92 }), 5.0);
  save(); console.log('  [' + T.toFixed(2) + 's] 11 outro');

  console.log('\n' + shots.length + ' stills · ' + caps.length + ' captions · ' + T.toFixed(2) + ' s');
  await br.close();
})();
