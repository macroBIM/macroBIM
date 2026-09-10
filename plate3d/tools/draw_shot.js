/* Every drawing the sheet asks for, as a picture, one file each.

       node tools/draw_shot.js [BOOK.xlsx] [outdir]

   check_samples_draw.js answers "did a drawing come out", which is not the same
   question as "is the drawing any good". dxf2svg.js answers the second one but
   hands back the WHOLE sheet as one svg - nine drawings over a metre and a half
   of paper - so a drawing that is wrong is a few hundred pixels somewhere in it
   and nobody looks.

   This is what found the Harbour Bridge's arch section: a view titled SECTION
   THROUGH THE ARCH that was every cross strut at fourteen different heights
   drawn on top of each other, because VIEW draws a module at EVERY placement
   and looking along the bridge stacks them all. It exported. It had entities in
   it. It passed every check there was. It was a smear.

   Save DXF -> svg -> cluster the ink into drawings -> one png each. The
   clustering is the same idea prep_ggb.js uses for the film: the sheet stacks
   its drawings down the page with air between them, so the gaps in y are the
   frames, and a frame contains a drawing rather than a slice of paper.       */
const { chromium } = require('playwright-core');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const P3 = path.resolve(SP, '..');
const BOOK = process.argv[2] || path.join(P3, 'PLATE3D_HARBOUR.xlsx');
const OUT = path.resolve(process.argv[3] || path.join(SP, 'draw'));
const NAME = path.basename(BOOK).replace(/\.xlsx$/i, '');
const DXF = path.join(OUT, NAME + '.dxf'), SVG = path.join(OUT, NAME + '.svg');
const W = +(process.env.W || 1500), H = +(process.env.H || 1000);

const LIB = f => {
  let p = SP + '/node_modules/three/build/three.min.js';
  if (f.includes('OrbitControls')) p = SP + '/node_modules/three/examples/js/controls/OrbitControls.js';
  if (f.includes('polybool')) p = SP + '/node_modules/polybooljs/dist/polybool.min.js';
  if (f.includes('exceljs')) p = SP + '/node_modules/exceljs/dist/exceljs.min.js';
  return fs.readFileSync(p, 'utf-8');
};

/* The drawings, found by their ink. A band of y with air above and below it is
   a drawing; a band thinner than a two-hundredth of the sheet is a title or a
   dimension line that drifted, and is folded into the drawing it belongs to. */
function boxes(svg) {
  const pts = [];
  const re = /<line[^>]*x1="([-\d.eE]+)"[^>]*y1="([-\d.eE]+)"[^>]*x2="([-\d.eE]+)"[^>]*y2="([-\d.eE]+)"/g;
  let m; while ((m = re.exec(svg))) { pts.push([+m[1], +m[2]]); pts.push([+m[3], +m[4]]); }
  if (!pts.length) return [];
  const ys = pts.map(p => p[1]).sort((a, b) => a - b);
  const span = ys[ys.length - 1] - ys[0];
  const bands = []; let s = ys[0], prev = ys[0];
  for (const y of ys) { if (y - prev > span * 0.012) { bands.push([s, prev]); s = y; } prev = y; }
  bands.push([s, prev]);
  return bands.filter(b => b[1] - b[0] > span * 0.004).map(b => {
    const xs = pts.filter(p => p[1] >= b[0] - 1 && p[1] <= b[1] + 1).map(p => p[0]);
    return [Math.min(...xs), b[0], Math.max(...xs) - Math.min(...xs), b[1] - b[0]];
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
           '--enable-unsafe-swiftshader'] });

  // Save DXF, caught out of the blob rather than let through as a download.
  const app = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await app.route('**/{unpkg.com,cdnjs.cloudflare.com}/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: LIB(r.request().url()) }));
  await app.goto('file://' + SP + '/host_test.html', { waitUntil: 'domcontentloaded' });
  await app.waitForTimeout(2500);
  await app.setInputFiles('#pb-file', BOOK);
  await app.waitForFunction(() => { const r = document.getElementById('pb-result');
    return r && /Succeed|Failed|error/i.test(r.innerText); }, null, { timeout: 600000 });
  await app.waitForTimeout(2000);
  await app.evaluate(() => { const o = URL.createObjectURL.bind(URL);
    URL.createObjectURL = bl => { window.__b = bl; return o(bl); }; window.__b = null; });
  await app.evaluate(() => plateBuilder.exportDXF());
  await app.waitForFunction(() => !!window.__b, null, { timeout: 600000 });
  fs.writeFileSync(DXF, await app.evaluate(() => window.__b.text()));
  await app.close();
  execFileSync(process.execPath, [path.join(SP, 'dxf2svg.js'), DXF, SVG], { stdio: 'inherit' });

  const svg = fs.readFileSync(SVG, 'utf8');
  const bs = boxes(svg);
  console.log('\n' + bs.length + ' drawings\n');
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  for (let i = 0; i < bs.length; i++) {
    const b = bs[i], pad = Math.max(b[2], b[3]) * 0.05;
    const vb = [b[0] - pad, b[1] - pad, b[2] + 2 * pad, b[3] + 2 * pad];
    const html = path.join(OUT, '_frame.html');
    fs.writeFileSync(html,
      '<meta charset="utf-8"><style>html,body{margin:0;background:#fff}' +
      'svg{display:block;width:' + W + 'px;height:' + H + 'px}</style>' +
      svg.replace(/^<svg[^>]*>/, '<svg xmlns="http://www.w3.org/2000/svg" ' +
        'preserveAspectRatio="xMidYMid meet" viewBox="' + vb.join(' ') + '">'));
    await page.goto('file://' + html, { waitUntil: 'load' });
    await page.waitForTimeout(800);
    const f = path.join(OUT, NAME + '_' + String(i + 1).padStart(2, '0') + '.png');
    await page.screenshot({ path: f });
    console.log('  ' + path.basename(f) + '   ' +
                Math.round(b[2] / 1000) + ' x ' + Math.round(b[3] / 1000) + ' m of paper');
  }
  fs.rmSync(path.join(OUT, '_frame.html'), { force: true });
  await browser.close();
})();
