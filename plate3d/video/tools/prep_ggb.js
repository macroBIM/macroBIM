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
const FRAMES = path.join(SP, 'ggb_frames.json');
const SHEET = path.join(SP, 'ggb_sheet.html');

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
  if (!fs.existsSync(SVG)) await exportDXF();
  else console.log('DXF already exported: ' + SVG);
  buildDrawingPage();

  /* ---- 3. the input sheet, drawn as the sheet ---- */
  buildSheetPage();
})();

/* Save DXF, caught out of the blob rather than let through as a download. */
async function exportDXF() {
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
}

/* The svg is inlined rather than linked: a page that <img>s it cannot have its
   viewBox pushed around, and pushing the viewBox is how the shot moves from the
   whole sheet to one drawing.

   TWO THINGS THIS PAGE GETS RIGHT that the first version did not. The svg is
   pinned at 1920x1080 with preserveAspectRatio, not left to size itself: a
   width:100%/height:auto svg given a wide viewBox renders as a 120 px strip
   across the top of a 1080 px page, which is a frame that is nine tenths empty -
   the sheet was never in the middle, there was no middle. And the windows are
   not fractions of the sheet any more: each drawing's own extent is measured out
   of the geometry, so a frame contains a drawing rather than a slice of paper.  */
function buildDrawingPage() {
  const svg = fs.readFileSync(SVG, 'utf8');
  const box = sheetBox(svg);
  /* Everything is clipped to the frame's own box. Without this the letterbox
     bands that a 6:1 drawing leaves in a 16:9 frame are not empty - the svg goes
     on painting the sheet outside its viewBox, so the drawing above and the one
     below hang into the top and bottom of the shot. */
  const body = svg
    .replace(/^<svg[^>]*>/,
      '<svg xmlns="http://www.w3.org/2000/svg" id="sh" width="1920" height="1080"' +
      ' preserveAspectRatio="xMidYMid meet" viewBox="' + box.join(' ') + '">' +
      '<clipPath id="cp"><rect id="cpr" x="' + box[0] + '" y="' + box[1] +
      '" width="' + box[2] + '" height="' + box[3] + '"/></clipPath>' +
      '<g clip-path="url(#cp)">')
    .replace(/<\/svg>\s*$/, '</g></svg>');
  fs.writeFileSync(PAGE,
    '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
    'html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#fff}' +
    'svg{display:block}</style></head><body>' + body + '</body></html>');
  const fr = drawingBoxes(svg);
  fs.writeFileSync(FRAMES, JSON.stringify(fr, null, 1));
  console.log('  ' + PAGE);
  fr.forEach(d => console.log('    ' + d.title.padEnd(50) +
    ' ' + Math.round(d.box[2]) + ' x ' + Math.round(d.box[3]) +
    '  ar ' + (d.box[2] / d.box[3]).toFixed(1)));
}

/* Every drawn thing dxf2svg emits, as points. LINE and CIRCLE carry the
   geometry; the TEXT that ends in a scale is a drawing title, and titles are
   what divide one drawing from the next down the sheet. */
function parts(svg) {
  const pts = [], titles = [];
  let m;
  const lre = /<line x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"/g;
  while ((m = lre.exec(svg))) { pts.push([+m[1], +m[2]]); pts.push([+m[3], +m[4]]); }
  const cre = /<circle cx="([-\d.]+)" cy="([-\d.]+)" r="([\d.]+)"/g;
  while ((m = cre.exec(svg))) {
    pts.push([+m[1] - +m[3], +m[2] - +m[3]]); pts.push([+m[1] + +m[3], +m[2] + +m[3]]);
  }
  const tre = /<text x="([-\d.]+)" y="([-\d.]+)" font-size="([\d.]+)"[^>]*>([^<]*)<\/text>/g;
  while ((m = tre.exec(svg)))
    if (/1:\d+\s*$/.test(m[4]))
      titles.push({ x: +m[1], y: +m[2], fs: +m[3], t: m[4].replace(/\s+/g, ' ').trim() });
  titles.sort((a, b) => a.y - b.y);
  return { pts, titles };
}

function pad(x0, y0, x1, y1, f) {
  const px = (x1 - x0) * f, py = (y1 - y0) * f;
  return [x0 - px, y0 - py, (x1 - x0) + 2 * px, (y1 - y0) + 2 * py];
}

function sheetBox(svg) {
  const { pts } = parts(svg);
  let a = 1e18, b = 1e18, c = -1e18, d = -1e18;
  pts.forEach(p => { if (p[0] < a) a = p[0]; if (p[0] > c) c = p[0];
                     if (p[1] < b) b = p[1]; if (p[1] > d) d = p[1]; });
  return pad(a, b, c, d, 0.02);
}

/* One box per drawing: everything between this title and the next one, plus the
   title itself, which sits above its drawing. Monospace at 0.6 em a character is
   close enough to keep a title inside the frame it names.

   AND THEN THE GAP. Two of the nine are drawn 1:500 but contain both towers,
   which stand 1,280 m apart - so the drawing is a tower, a kilometre of nothing,
   and a tower. Framed whole that is a frame with nothing in the middle of it,
   which is exactly what the first cut of this shot looked like. So the ink in a
   band is clustered along x and a run of empty wider than a sixth of the drawing
   splits it: each cluster becomes its own frame and gets the whole screen. A
   drawing whose ink is continuous - the general arrangement, the cable, the
   truss - has one cluster and is unchanged by this.                          */
function drawingBoxes(svg) {
  const { pts, titles } = parts(svg);
  const out = [];
  titles.forEach((t, i) => {
    const y0 = t.y, y1 = i + 1 < titles.length ? titles[i + 1].y : Infinity;
    const own = pts.filter(p => p[1] >= y0 && p[1] < y1);
    if (!own.length) return;
    let a = 1e18, c = -1e18, b = t.y - t.fs * 1.35, d = t.y;
    own.forEach(p => { if (p[0] < a) a = p[0]; if (p[0] > c) c = p[0];
                       if (p[1] < b) b = p[1]; if (p[1] > d) d = p[1]; });

    const NB = 400, W = c - a, bin = new Array(NB).fill(false);
    own.forEach(p => bin[Math.min(NB - 1, Math.floor((p[0] - a) / W * NB))] = true);
    /* A gap only counts when it is wide against the drawing's OWN height. The
       first rule here was a fraction of the width, which split the two legs of
       a tower cross-elevation - a drawing 98 m wide - as readily as it split the
       1,280 m between two towers. */
    const GB = Math.max(2.5 * (d - b), 0.1 * W) / W * NB;
    const runs = [];                       // [firstBin, lastBin] of ink
    let s0 = -1, gap = 0;
    for (let k = 0; k < NB; k++) {
      if (bin[k]) { if (s0 < 0) s0 = k; gap = 0; }
      else if (s0 >= 0 && ++gap > GB) { runs.push([s0, k - gap]); s0 = -1; }
    }
    if (s0 >= 0) runs.push([s0, NB - 1]);

    /* Where a drawing did split, the clusters are the same tower twice - so
       only the first is framed, and it is framed as the drawing it belongs to.
       Nine titles, nine frames, one of them showing one of two identical halves. */
    const title = t.t;
    runs.slice(0, 1).forEach((r, k) => {
      let x0 = a + r[0] / NB * W, x1 = a + (r[1] + 1) / NB * W;
      let ya = 1e18, yb = -1e18;
      own.forEach(p => { if (p[0] >= x0 && p[0] <= x1) {
        if (p[1] < ya) ya = p[1]; if (p[1] > yb) yb = p[1]; } });
      if (runs.length === 1) { x0 = a; x1 = c; ya = b; yb = d; }
      else if (k === 0) { x0 = Math.min(x0, t.x); ya = Math.min(ya, b); }
      out.push({ title: title, half: runs.length > 1, box: pad(x0, ya, x1, yb, 0.04),
                 run: runBox(pad(x0, ya, x1, yb, 0.04)) });
    });
  });
  return out;
}

/* A window to run ALONG a drawing, for the one shot that travels instead of
   holding. The window is the drawing's own height and 16:9 of it wide, so the
   structure fills the frame top to bottom and the frame walks the length.

   It was aimed at the stiffening truss first, and that was wrong twice over.
   Wound in far enough to read, the drawing's own ink stops being lines - a DXF
   sets line weights against the sheet, so at 1:5000 a chord line is 28 % of the
   truss's depth and no magnification will make a lattice of it. And the shot
   was never about the truss: the general arrangement is two kilometres long and
   340 m tall, which at frame height gives a tower, the cables coming off it,
   hangers close enough to count, and mid-span - which is what "two kilometres
   on one sheet" means when you go and look. */
function runBox(box) {
  const h = box[3], w = h * 16 / 9;
  if (box[2] < w * 1.5) return null;              // nothing to travel along
  return { y: box[1], h: h, w: w, from: box[0], to: box[0] + box[2] - w };
}

/* The input tab, drawn as the tab - read back out of the shipped workbook, at
   reading size and as tall as it is, so the shoot can pan down it. */
function buildSheetPage() {
  execFileSync(process.execPath, [path.join(SP, 'mkparampage.js')],
    { stdio: 'inherit', env: { ...process.env,
      BOOK: '../../PLATE3D_GGB.xlsx', SHEET: 'input', FIRST: '1', LAST: '414',
      NC: '18', RING: '', TABS: '', ACTIVE: 'input', FITW: '1', OUT: 'ggb_sheet' } });
  console.log('  ' + SHEET);
}
