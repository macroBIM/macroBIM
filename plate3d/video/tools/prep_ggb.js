/* Everything the shoot needs that is not a camera move.

       node video/tools/prep_ggb.js

   1. The 86 erection workbooks, if they are not already there.
   2. The DXF the finished sheet asks for - exported from the app, not written
      here - and the page that draws it.

   The drawing is rendered by tools/dxf2svg.js, which reads the LINE, ARC,
   CIRCLE and TEXT the engine actually wrote. The film shows the file, and
   re-typesetting it into something prettier would be a lie about the one thing
   the film claims: press the button and this comes out. That rule is the first
   line of video/README.md and it was learned by breaking it.                */
const { chromium } = require('playwright-core');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const P3 = path.resolve(SP, '../..');              // plate3d
const P3T = path.join(P3, 'tools');
const BOOKS = path.resolve(SP, '../ggb');
const BOOK = path.join(P3, 'PLATE3D_GGB.xlsx');
const DXF = path.join(SP, 'ggb.dxf');
const SVG = path.join(SP, 'ggb.svg');
const PAGE = path.join(SP, 'ggb_dxf.html');

const LIB = f => {
  let p = P3T + '/node_modules/three/build/three.min.js';
  if (f.includes('OrbitControls')) p = P3T + '/node_modules/three/examples/js/controls/OrbitControls.js';
  if (f.includes('polybool')) p = P3T + '/node_modules/polybooljs/dist/polybool.min.js';
  if (f.includes('exceljs')) p = P3T + '/node_modules/exceljs/dist/exceljs.min.js';
  return fs.readFileSync(p, 'utf-8');
};

(async () => {
  /* ---- 1. the erection ---- */
  const want = 86;
  const have = fs.existsSync(BOOKS)
    ? fs.readdirSync(BOOKS).filter(f => /\.xlsx$/.test(f)).length : 0;
  if (have !== want) {
    console.log('building the erection workbooks ...');
    execFileSync(process.execPath, [path.join(SP, 'make_ggb_stages.js')], { stdio: 'inherit' });
  } else {
    console.log(have + ' workbooks already in ' + BOOKS);
  }

  /* ---- 2. the drawings ---- */
  if (fs.existsSync(PAGE) && fs.existsSync(SVG)) {
    console.log('drawing page already built: ' + PAGE);
    return;
  }
  console.log('exporting the DXF from the app (about a minute) ...');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
           '--enable-unsafe-swiftshader'] });
  const page = await b.newPage({ viewport: { width: 1400, height: 900 } });
  await page.route('**/{unpkg.com,cdnjs.cloudflare.com}/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: LIB(r.request().url()) }));
  await page.goto('file://' + SP + '/video_page.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.setInputFiles('#pb-file', BOOK);
  await page.waitForFunction(() => {
    const r = document.getElementById('pb-result');
    return r && /Succeed|Failed|error/i.test(r.innerText);
  }, null, { timeout: 600000 });
  await page.waitForTimeout(2000);
  // catch the blob Save DXF hands the browser rather than letting it download
  await page.evaluate(() => {
    const o = URL.createObjectURL.bind(URL);
    URL.createObjectURL = bl => { window.__b = bl; return o(bl); };
    window.__b = null;
  });
  await page.evaluate(() => plateBuilder.exportDXF());
  await page.waitForFunction(() => !!window.__b, null, { timeout: 600000 });
  const dxf = await page.evaluate(() => window.__b.text());
  fs.writeFileSync(DXF, dxf);
  await b.close();
  console.log('  ' + (dxf.length / 1e6).toFixed(1) + ' MB  ' + DXF);

  execFileSync(process.execPath, [path.join(P3T, 'dxf2svg.js'), DXF, SVG], { stdio: 'inherit' });

  /* The svg is inlined rather than linked: a page that <img>s it cannot have
     its viewBox pushed around, and pushing the viewBox is how the shot zooms
     from the whole sheet down to the general arrangement. */
  fs.writeFileSync(PAGE,
    '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
    'html,body{margin:0;background:#fff}svg{width:100%;height:auto;display:block}' +
    '</style></head><body>' + fs.readFileSync(SVG, 'utf8') + '</body></html>');
  console.log('  ' + PAGE);
})();
