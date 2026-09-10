/* What the clash report actually says, grouped and located.

       node tools/clash_dump.js BOOK.xlsx

   shot_ggb prints the panel's one-line summary, which names the section pairs
   and stops. That is enough to know a model is wrong and never enough to know
   where. This prints every clash as: the two member names, and where the pair
   sits - so a fix can be aimed at the node that has it rather than at the
   whole model.                                                             */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const SP = __dirname;
const BOOK = process.argv[2] || path.join(SP, '..', 'PLATE3D_HARBOUR.xlsx');
const LIB = f => {
  let p = SP + '/node_modules/three/build/three.min.js';
  if (f.includes('OrbitControls')) p = SP + '/node_modules/three/examples/js/controls/OrbitControls.js';
  if (f.includes('polybool')) p = SP + '/node_modules/polybooljs/dist/polybool.min.js';
  if (f.includes('exceljs')) p = SP + '/node_modules/exceljs/dist/exceljs.min.js';
  return fs.readFileSync(p, 'utf-8');
};
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  await p.route('**/{unpkg.com,cdnjs.cloudflare.com}/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: LIB(r.request().url()) }));
  await p.route('**/fonts.{googleapis,gstatic}.com/**', r => r.abort());
  await p.goto('file://' + SP + '/host_test.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);
  await p.setInputFiles('#pb-file', BOOK);
  await p.waitForFunction(n => { const r = document.getElementById('pb-result');
    return r && r.innerText.indexOf(n) >= 0 && /Succeed|Failed|error/i.test(r.innerText); },
    path.basename(BOOK), { timeout: 600000 });
  await p.waitForTimeout(3000);
  const out = await p.evaluate(() => {
    const cs = window.plateBuilder.clashes() || [];
    return cs.map(c => JSON.parse(JSON.stringify(c))).slice(0, 4000);
  });
  if (!out.length) { console.log('no clashes'); await b.close(); return; }
  console.log('keys: ' + Object.keys(out[0]).join(', '));
  const g = {};
  out.forEach(c => {
    const k = [c.a, c.b].sort().join('  ×  ');
    (g[k] = g[k] || []).push(c);
  });
  Object.keys(g).sort((x, y) => g[y].length - g[x].length).forEach(k => {
    const l = g[k];
    console.log('\n' + String(l.length).padStart(4) + '  ' + k);
    l.slice(0, 4).forEach(c => console.log('        ' + JSON.stringify(c)));
  });
  await b.close();
})();
