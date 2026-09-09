/* Pick a camera, by looking at what it gives.

       CAM=tx,ty,tz,dist,az,el  SUF=_try1  node video/tools/aim_ggb.js BOOK.xlsx …

   __aim takes a shot the way a shot is described - stand here, look there - but
   the numbers that make a good frame are not guessable from the model's bounds.
   This loads a workbook into the capture harness, aims, and writes the frame,
   so a camera can be chosen by seeing it rather than by arithmetic.

   Frames come off the WebGL canvas, so what lands in the file is what the video
   will show: no app chrome, no sidebar, the same pixels.

   Defaults to the erection camera the script settled on.                     */
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const SP = __dirname;                                   // plate3d/video/tools
const P3T = path.resolve(SP, '../../tools');            // plate3d/tools (node_modules)
const LIB = f => { let p = P3T + '/node_modules/three/build/three.min.js';
  if (f.includes('OrbitControls')) p = P3T + '/node_modules/three/examples/js/controls/OrbitControls.js';
  if (f.includes('polybool')) p = P3T + '/node_modules/polybooljs/dist/polybool.min.js';
  if (f.includes('exceljs')) p = P3T + '/node_modules/exceljs/dist/exceljs.min.js';
  return fs.readFileSync(p, 'utf-8'); };
const C = (process.env.CAM || '0,0,125000,1050000,85,4').split(',').map(Number);
const CAM = { tx: C[0], ty: C[1], tz: C[2], dist: C[3], az: C[4], el: C[5] };
const SUF = process.env.SUF || '';
const BOOKS = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await b.newPage({ viewport: { width: 2336, height: 1294 } });
  await page.route('**/{unpkg.com,cdnjs.cloudflare.com}/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: LIB(r.request().url()) }));
  await page.goto('file://' + SP + '/video_page.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  for (const bk of BOOKS) {
    await page.setInputFiles('#pb-file', bk);
    await page.waitForFunction(n => { const r = document.getElementById('pb-result');
      return r && r.innerText.indexOf(n) >= 0 && /Succeed|Failed|error/i.test(r.innerText);
    }, path.basename(bk), { timeout: 300000 });
    await page.waitForTimeout(1200);
    const CL = (process.env.COLOURS || '').split(',').filter(Boolean);
    for (const c of CL) { const [k, hex] = c.split('=');
      await page.evaluate(a => window.plateBuilder.setColor('module', a.k.trim().toUpperCase(), a.hex.trim()),
        { k, hex }); }
    if (CL.length) await page.waitForTimeout(600);
    const ok = await page.evaluate(c => window.__aim(c.tx, c.ty, c.tz, c.dist, c.az, c.el), CAM);
    await page.waitForTimeout(400);
    const d = await page.evaluate(() => window.__grab(0.92));
    if (!d) { console.log('  ' + path.basename(bk) + '  NO CANVAS (aim=' + ok + ')'); continue; }
    const out = path.resolve(SP, '../../tools/shot/cam_' + path.basename(bk).replace(/\.xlsx$/, '') + SUF + '.jpg');
    fs.writeFileSync(out, Buffer.from(d.split(',')[1], 'base64'));
    console.log('  aim=' + ok + '  ' + out);
  }
  await b.close();
})();
