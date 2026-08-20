/* Getting a patched PLATE3D onto a page, with the CDN libraries served from
   node_modules so the run needs no network. */
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const SP = __dirname;

const LIB = url => {
  let p = SP + '/node_modules/three/build/three.min.js';
  if (url.includes('OrbitControls')) p = SP + '/node_modules/three/examples/js/controls/OrbitControls.js';
  if (url.includes('polybool'))      p = SP + '/node_modules/polybooljs/dist/polybool.min.js';
  if (url.includes('exceljs'))       p = SP + '/node_modules/exceljs/dist/exceljs.min.js';
  return fs.readFileSync(p, 'utf-8');
};

exports.open = async function (w, h) {
  if (!fs.existsSync(SP + '/_engine.js')) {
    console.error('_engine.js missing - run `node patch.js` first.');
    process.exit(1);
  }
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.route('**/{unpkg.com,cdnjs.cloudflare.com}/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: LIB(r.request().url()) }));
  await page.goto('file://' + SP + '/page.html', { waitUntil: 'domcontentloaded' });
  // the engine opens on TOWER by itself (DEMO_ROWS), so there is nothing to load
  await page.waitForFunction(() => window.__pbItems && window.__pbItems().length > 0,
                             null, { timeout: 180000 });
  await page.waitForTimeout(1500);          // let the first frames settle
  return { browser, page };
};

exports.ease = u => u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
exports.seg  = (t, a, b) => t <= a ? 0 : t >= b ? 1 : exports.ease((t - a) / (b - a));
