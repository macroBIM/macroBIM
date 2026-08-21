/* Four stills out of the download beat, so the staging can be looked at before
   an hour of capture is spent on it: the pointer arriving, the frame closing in,
   the button under the pointer, and what the app says after it is pressed.   */
const { chromium } = require('playwright-core');
const fs = require('fs');
const SP = __dirname;
const VW = 2336, VH = 1294;

const LIB = f => {
  let p = SP + '/node_modules/three/build/three.min.js';
  if (f.includes('OrbitControls')) p = SP + '/node_modules/three/examples/js/controls/OrbitControls.js';
  if (f.includes('polybool')) p = SP + '/node_modules/polybooljs/dist/polybool.min.js';
  if (f.includes('exceljs')) p = SP + '/node_modules/exceljs/dist/exceljs.min.js';
  return fs.readFileSync(p, 'utf-8');
};
function clipAt(cx, cy, f) {
  const w = Math.max(320, VW * f), h = w * VH / VW;
  return { x: Math.round(Math.min(Math.max(0, cx - w / 2), VW - w)),
           y: Math.round(Math.min(Math.max(0, cy - h / 2), VH - h)),
           width: Math.round(w), height: Math.round(h) };
}
const mix = (a, b, u) => a + (b - a) * u;

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--allow-file-access-from-files',
           '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const app = await br.newPage({ viewport: { width: VW, height: VH } });
  await app.route('**/{unpkg.com,cdnjs.cloudflare.com}/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: LIB(r.request().url()) }));
  await app.route('**/fonts.{googleapis,gstatic}.com/**', r => r.abort());
  await app.goto('file://' + SP + '/video_page.html', { waitUntil: 'domcontentloaded' });
  await app.waitForFunction(() => { const r = document.getElementById('pb-result');
    return r && /Succeed/.test(r.innerText); }, null, { timeout: 180000 });

  await app.evaluate(() => plateBuilder.openSamples());
  await app.waitForTimeout(600);
  await app.evaluate(() => {
    const d = document.createElement('div');
    d.id = '__cur';
    d.style.cssText = 'position:fixed;z-index:99999;pointer-events:none;left:-99px;top:-99px;' +
      'filter:drop-shadow(0 3px 7px rgba(0,0,0,.55))';
    d.innerHTML = '<svg viewBox="0 0 24 32" width="30" height="40">' +
      '<path d="M2 1 L2 25 L8 19.6 L12.2 29 L16.4 27 L12.2 17.8 L20 17.8 Z"' +
      ' fill="#fff" stroke="#0f172a" stroke-width="1.7" stroke-linejoin="round"/></svg>';
    document.body.appendChild(d);
  });
  const boxOf = sel => app.evaluate(q => { const e = document.querySelector(q);
    const r = e.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height,
             cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; }, sel);
  const btn = await boxOf('#pb-exb2');
  const row = await boxOf('#pb-ex .ext tbody tr:nth-child(3)');
  const cur = (x, y) => app.evaluate(p => { const d = document.getElementById('__cur');
    d.style.left = p.x + 'px'; d.style.top = p.y + 'px'; }, { x: Math.round(x), y: Math.round(y) });

  const shot = (name, clip) => app.screenshot(Object.assign(
    { path: SP + '/pv_' + name + '.jpg', type: 'jpeg', quality: 92 }, clip ? { clip: clip } : {}));

  /* the row the film is after, ringed - so the eye is on the right line before
     the pointer ever moves */
  await app.evaluate(() => {
    const tr = document.querySelector('#pb-ex .ext tbody tr:nth-child(3)');
    tr.style.outline = '3px solid #b45309';
    tr.style.outlineOffset = '-1px';
    tr.style.background = '#fffbeb';
    tr.style.borderRadius = '6px';
  });

  await cur(VW * 0.42, VH * 0.72);
  await shot('1wide', null);                                            // pointer arrives
  const u = 0.55;
  await cur(mix(VW * 0.42, btn.cx - 6, u), mix(VH * 0.72, btn.cy - 5, u));
  await shot('2mid', clipAt(mix(VW / 2, row.x + row.w * 0.62, u),
                            mix(VH / 2, row.y + row.h / 2, u), mix(1, 0.34, u)));
  const tight = clipAt(row.x + row.w * 0.62, row.y + row.h / 2, 0.34);
  await cur(btn.cx - 6, btn.cy - 5);
  await shot('3tight', tight);                                          // on the button
  await app.evaluate(() => plateBuilder.getSample(2));
  await app.waitForTimeout(1100);
  await shot('4saved', tight);                                          // what the app says
  console.log('pv_1wide / 2mid / 3tight / 4saved  ·  button at ' +
              Math.round(btn.cx) + ',' + Math.round(btn.cy));
  await br.close();
})();
