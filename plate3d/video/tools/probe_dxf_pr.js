/* Does a tube's bore reach the DXF?

   The take-off was checked against the catalogue and the section preview was
   looked at, but neither says anything about the file a fabricator actually
   receives. A pipe whose part drawing is a solid disc weighs 2.83 kg/m on the
   BOQ and gets cut as a bar in the shop - the two outputs would disagree and
   only one of them is on the saw.

   One section per book, and only the PART block enabled, so the DXF holds
   exactly one drawing and nothing has to be picked out of a sheet.

   The test is geometric rather than a count. Every outline point is measured
   from the drawing's own centre, and a tube must show TWO shells: an outer at
   the full radius and an inner at the wall ratio. An H has no second shell and
   is the control - if the check passes an H, it is not testing anything.

     node probe_dxf_pr.js                                                     */
const ExcelJS = require('./node_modules/exceljs');
const { chromium } = require('playwright-core');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const P3 = path.resolve(SP, '../..');
const OUT = SP + '/probe';
fs.mkdirSync(OUT, { recursive: true });

const CASES = [
  { id: 'H', v: [200, 200, 200, 8, 12, 12, 16], shells: 1,
    what: 'H-200 (control - solid, must show one shell)' },
  { id: 'P', v: [48.6, 2.5], shells: 2, ratio: (48.6 - 5) / 48.6,
    what: 'P-48.6x2.5  bore at 89.7% of the outside' },
  { id: 'R', v: [100, 100, 6, 12], shells: 2, ratio: 88 / 100,
    what: 'R-100x100x6  bore at 88% of the outside' }
];

const LIB = f => {
  let p = SP + '/node_modules/three/build/three.min.js';
  if (f.includes('OrbitControls')) p = SP + '/node_modules/three/examples/js/controls/OrbitControls.js';
  if (f.includes('polybool')) p = SP + '/node_modules/polybooljs/dist/polybool.min.js';
  if (f.includes('exceljs')) p = SP + '/node_modules/exceljs/dist/exceljs.min.js';
  return fs.readFileSync(p, 'utf-8');
};

/* Every vertex the outline layer puts on the page: both ends of each LINE and
   the centre/radius of each CIRCLE. A CIRCLE is worth knowing about on its own
   - a pipe drawn as one is a pipe; drawn as forty-eight LINEs it is a polygon
   that measures right and reads wrong. */
function outlinePoints(text) {
  const L = text.split(/\r?\n/);
  const pts = [], circles = [];
  let inEnt = false, kind = null, e = {};
  const flush = () => {
    if (kind === 'LINE' && e['8'] === 'PL3D-OUTLINE') {
      pts.push([+e['10'], +e['20']]);
      pts.push([+e['11'], +e['21']]);
    }
    if (kind === 'CIRCLE' && e['8'] === 'PL3D-OUTLINE')
      circles.push({ x: +e['10'], y: +e['20'], r: +e['40'] });
    kind = null; e = {};
  };
  for (let i = 0; i < L.length - 1; i += 2) {
    const c = L[i].trim(), v = L[i + 1].trim();
    if (c === '2' && v === 'ENTITIES') { inEnt = true; continue; }
    if (c === '2' && v === 'OBJECTS') { flush(); inEnt = false; }
    if (!inEnt) continue;
    if (c === '0') { flush(); kind = v; continue; }
    if (kind) e[c] = v;
  }
  flush();
  return { pts: pts, circles: circles };
}

/* Count the closed loops the outline draws, by joining LINEs that share an
   end. Shape-agnostic, which the first version of this was not: it measured
   every point's distance from the centre and called a band of equal distances
   a shell, which is only meaningful for a circle. It read six shells off an H
   and a wrong wall ratio off a rectangle - and the H was in the list as the
   control precisely so a broken instrument would show itself before it was
   believed about P and R.

   A solid section draws one loop. A tube draws two: the outside and the bore.
   That is the whole question, and it does not care what shape either is. */
function loops(pts) {
  const key = p => p[0].toFixed(4) + ',' + p[1].toFixed(4);
  const adj = new Map();
  for (let i = 0; i < pts.length; i += 2) {
    const a = key(pts[i]), b = key(pts[i + 1]);
    if (a === b) continue;
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push(b); adj.get(b).push(a);
  }
  const seen = new Set();
  const out = [];
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const stack = [start]; seen.add(start);
    let n = 0, deg2 = true;
    while (stack.length) {
      const v = stack.pop(); n++;
      const ns = adj.get(v);
      if (ns.length !== 2) deg2 = false;
      ns.forEach(w => { if (!seen.has(w)) { seen.add(w); stack.push(w); } });
    }
    if (n >= 3) out.push({ n: n, closed: deg2 });
  }
  return out;
}
/* the two extents an outline occupies: the whole thing, and whatever sits
   inside it once the outer rectangle's own points are set aside */
function extents(pts) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return { w: Math.max(...xs) - Math.min(...xs),
           h: Math.max(...ys) - Math.min(...ys) };
}

/* The outer extent of the smaller of two loops. Walked from the loop's own
   points rather than from the whole cloud, so a rectangle's corners do not
   stand in for a radius. */
function smallerLoopExtent(pts, closed) {
  const key = p => p[0].toFixed(4) + ',' + p[1].toFixed(4);
  const adj = new Map(), at = new Map();
  for (let i = 0; i < pts.length; i += 2)
    [pts[i], pts[i + 1]].forEach((p, j, arr) => {
      const a = key(p), b = key(arr[1 - j]);
      if (a === b) return;
      if (!adj.has(a)) { adj.set(a, []); at.set(a, p); }
      adj.get(a).push(b);
    });
  const groups = [];
  const seen = new Set();
  for (const s of adj.keys()) {
    if (seen.has(s)) continue;
    const st = [s]; seen.add(s); const mem = [];
    while (st.length) { const v = st.pop(); mem.push(at.get(v));
      adj.get(v).forEach(w => { if (!seen.has(w)) { seen.add(w); st.push(w); } }); }
    if (mem.length >= 3) groups.push(mem);
  }
  const ex = groups.map(m => {
    const xs = m.map(p => p[0]), ys = m.map(p => p[1]);
    return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  }).sort((a, b) => a - b);
  void closed;
  return ex.length ? ex[0] : 0;
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
           '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 },
                                       acceptDownloads: true });
  await page.route('**/{unpkg.com,cdnjs.cloudflare.com}/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: LIB(r.request().url()) }));
  await page.route('**/fonts.{googleapis,gstatic}.com/**', r => r.abort());
  /* the shipped engine, off host_lock.html - the point is the file a customer
     runs, not the build changes land in */
  await page.goto('file://' + P3 + '/tools/host_lock.html', { waitUntil: 'domcontentloaded' });
  await page.addInitScript(() => {});
  await page.evaluate(() => {
    const c = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) window.__name = this.download;
      return c.apply(this, arguments);
    };
    const u = URL.createObjectURL;
    URL.createObjectURL = function (b) { window.__b = b; return u.apply(URL, arguments); };
  });
  await page.waitForTimeout(2000);

  let bad = 0;
  for (const c of CASES) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('input');
    let r = 1;
    const put = a => { const row = ws.getRow(r++);
      a.forEach((v, i) => { if (v !== null) row.getCell(i + 2).value = v; }); };
    put(['# SECT', 'id', 'mat', 'length', 'TYPE', 'base.pt',
         'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7']);
    put(['SECT', 'sc.t', 'SS400', 1000, c.id, 'mc'].concat(c.v));
    put(['# ASSY', 'id', 'ref', 'cmd', 'p1', 'p2', 'p3']);
    put(['ASSY', 'as.t', 'sc.t', 'ADD', 0, 0, 0]);
    put(['END']);
    const f = OUT + '/DXF_' + c.id + '.xlsx';
    await wb.xlsx.writeFile(f);

    await page.evaluate(() => { window.__b = null; window.__name = null; });
    await page.setInputFiles('#pb-file', f);
    await page.waitForFunction(b => {
      const el = document.getElementById('pb-result');
      return el && el.innerText.indexOf(b) >= 0;
    }, path.basename(f), { timeout: 60000 });
    await page.waitForTimeout(1200);

    await page.evaluate(() => plateBuilder.exportDXF());
    await page.waitForSelector('#pb-scale', { timeout: 20000 });
    /* only PART - one drawing in the file, so nothing has to be located */
    for (const k of ['assembly', 'module', 'part', 'views']) {
      await page.evaluate(id => {
        const el = document.getElementById('pb-sc-' + id);
        if (!el || el.disabled) return;
        const want = id === 'part';
        if (el.checked !== want) el.click();
      }, k);
    }
    await page.fill('#pb-sc-part-v', '10').catch(() => {});
    await page.click('#pb-scale .accent');
    await page.waitForFunction(() => !!window.__b, null, { timeout: 120000 });
    const txt = await page.evaluate(() => window.__b.text());
    const dxf = OUT + '/PR_' + c.id + '.dxf';
    fs.writeFileSync(dxf, txt);

    const g = outlinePoints(txt);
    const lp = loops(g.pts);
    const closed = lp.filter(l => l.closed);
    const svg = OUT + '/PR_' + c.id + '.svg';
    try { execFileSync(process.execPath, [SP + '/dxf2svg.js', dxf, svg], { stdio: 'pipe' }); }
    catch (e) { }

    let verdict;
    if (closed.length !== c.shells) {
      verdict = 'want ' + c.shells + ' closed loop(s), got ' + closed.length +
                ' (of ' + lp.length + ')';
      bad++;
    } else if (c.ratio) {
      /* both loops measured the same way, so the ratio is the wall and not an
         artefact of how either shape curves */
      const byN = closed.slice().sort((a, b) => b.n - a.n);
      const all = extents(g.pts);
      const inner = smallerLoopExtent(g.pts, closed);
      const got = inner / Math.max(all.w, all.h);
      const off = Math.abs(got - c.ratio) / c.ratio * 100;
      verdict = 'bore/outside ' + got.toFixed(3) + ' vs ' + c.ratio.toFixed(3) +
                (off < 1.5 ? '  OK' : '  OFF by ' + off.toFixed(1) + '%');
      if (off >= 1.5) bad++;
      void byN;
    } else verdict = 'one loop - solid, as it should be';

    console.log('  ' + c.id + '  ' + c.what.padEnd(46));
    console.log('     ' + (fs.statSync(dxf).size / 1024).toFixed(0) + ' KB · ' +
                g.pts.length / 2 + ' outline LINEs · ' + g.circles.length + ' CIRCLEs · ' +
                closed.length + ' closed loop(s)   ' + verdict);
  }
  await browser.close();
  console.log('\n' + (bad ? bad + ' wrong' : 'the bore is in the drawing'));
  process.exitCode = bad ? 1 : 0;
})();
