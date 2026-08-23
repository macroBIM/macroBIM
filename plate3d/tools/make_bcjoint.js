/* PLATE3D_BCJOINT.xlsx - a bolted beam-to-column connection, double angle cleat.

   Written with sections, one row each, because BOLT removed the reason not to.
   A CUT cannot drill a section - the profile runs the length - so until the
   bolts could find their own holes a connection had to be built from plates,
   which cost the fillets, the section names in the take-off, and three times
   the rows. The plate version of this file existed for that reason and has
   been deleted; nothing in the sheet says CUT or HOLE now.

   The take-off names H-300x300x10x15 and L-60x60x8, the fillets are real, and
   the fifteen holes on the part drawings were never typed.

   Orientation is not guessed. A bar or a section STARTS at the point given and
   runs its Length along the plane's thickness axis - XY +Z, XZ -Y, YZ +X - and
   Alpha rolls it about that axis. Which Alpha puts a web where it belongs is
   read off the model, not remembered.

     node tools/make_bcjoint.js                                         */
const ExcelJS = require('../video/tools/node_modules/exceljs');
const { chromium } = require('../video/tools/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');

const SP = path.resolve(__dirname, '../video/tools');
const P3 = path.resolve(__dirname, '..');
const OUT = P3 + '/PLATE3D_BCJOINT.xlsx';

const C = { h: 300, b: 300, tw: 10, tf: 15, r: 13, len: 1600 };
const B = { h: 300, b: 150, tw: 6.5, tf: 9, r: 13, len: 900 };
const L = { a: 60, b: 60, t: 8, r: 8, r2: 4, len: 140 };
const BOLT = { d: 16, pitch: 40, n: 3, gauge: 35 };
const GAP = 10;

const cFaceX = C.h / 2;
const bWebT  = B.tw / 2;
const bX0    = cFaceX + GAP;
const legAx  = cFaceX;                       // cleat back face on the flange
const gY     = bWebT + BOLT.gauge;
const gX     = cFaceX + BOLT.gauge;
const z0     = -BOLT.pitch * (BOLT.n - 1) / 2;
const ALPHA  = Number(process.env.ALPHA || 0);
const NUT    = BOLT.d * 0.9;                 // the default nut height, 0.9d
const BLEN   = 45;                           // and one catalogue length for both
const gripC  = L.t + C.tf;                   // flange + cleat
const gripB  = 2 * L.t + B.tw;               // cleat + web + cleat

const rows = [];
const R = (...c) => rows.push(c);
const X = () => rows.push([]);

R('# PLATE3D  ·  beam-to-column connection, written with SECT');
R('#   Members are one row each and the take-off names them H-300x300x10x15 and');
R('#   L-60x60x8. The fillets are real. What is missing is the bolt holes: a CUT');
R('#   edits a 2D profile and the profile runs the length, so a hole in a section');
R('#   would be a slot down the whole member. The bolts are shown instead.');
X();
R('# SECT', 'id', 'mat', 'length', 'TYPE', 'base.pt', 'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7');
R('SECT', 'sc.col', 'SS275', C.len, 'H', 'mc', C.h, C.b, C.b, C.tw, C.tf, C.tf, C.r);
R('SECT', 'sc.bm',  'SS275', B.len, 'H', 'mc', B.h, B.b, B.b, B.tw, B.tf, B.tf, B.r);
R('SECT', 'sc.cl',  'SS275', L.len, 'L', 'mc', L.a, L.b, L.t, L.t, L.r, L.r2);
X();
R('# BOLT', 'id', 'mat', 'dia', 'length', '[hole]', '[head_af]', '[head_h]', '[nut_af]',
  '[nut_h]', '[proj]');
R('#   the point on the MODULE row is the underside of the head, so these start');
R('#   on the steel face and the head stands off behind it');
R('#   length = grip + nut + proj, and proj is the thread showing past the nut.');
R('#   Grip is flange + cleat, 23, and cleat + web + cleat, 22.5. Bolts come in');
R('#   catalogue lengths, so both are written 45 and proj takes up the rest -');
R('#   7.6 and 8.1. Left blank proj would be 0.2d and the lengths would come out');
R('#   40.6 and 40.1: two take-off lines for a bolt nobody orders twice.');
R('BOLT', 'bo.c', 'F10T', BOLT.d, BLEN, '', '', '', '', '', BLEN - gripC - NUT);
R('BOLT', 'bo.b', 'F10T', BOLT.d, BLEN, '', '', '', '', '', BLEN - gripB - NUT);
X();
R('# MODULE', 'id', 'member', 'Ref.Pt', 'L.X', 'L.Y', 'L.Z', 'PLANE', 'ROT.X', 'ROT.Y', 'ROT.Z',
  'dx', 'dy', 'dz', 'repeat');
R('#   Every module starts at ITS OWN origin and the ASSY row places it. A');
R('#   section held by BASE is held at the centre of its STARTING face, so');
R('#   writing a world coordinate in the MODULE row and adding BASE as well');
R('#   drags the member back - which is what put the column at z 0..1600.');
R('#   ROT.Z 90 turns the column so its FLANGES face the beam. Without it the');
R('#   flanges face across and the beam lands on the web edge - which a 300x300');
R('#   bounding box cannot show, being square either way. What showed it was');
R('#   the bolts finding nothing to drill.');
R('MODULE', 'md.col', 'sc.col', '', 0, 0, 0, 'XY', 0, 0, 90);
R('MODULE', 'md.col', 'BASE', 'sc.col', 'mc');
X();
R('MODULE', 'md.bm', 'sc.bm', '', 0, 0, 0, 'YZ');
R('MODULE', 'md.bm', 'BASE', 'sc.bm', 'mc');
X();
R('#   the cleat, and the bolts that hold it to the column. Local z runs from');
R('#   the cleat’s starting face, so the bolt line sits at half the length in.');
R('MODULE', 'md.cl', 'sc.cl', '', 0, 0, 0, 'XY');
R('MODULE', 'md.cl', 'bo.c', '', -(L.a / 2 + C.tf), BOLT.gauge - L.b / 2, L.len / 2 + z0, 'YZ',
  0, 0, 0, 0, 0, BOLT.pitch, BOLT.n - 1);
R('MODULE', 'md.cl', 'BASE', 'sc.cl', 'mc');
X();
R('MODULE', 'md.bb', 'bo.b', '', 0, 0, 0, 'XZ', 0, 0, 0, 0, 0, BOLT.pitch, BOLT.n - 1);
R('MODULE', 'md.bb', 'BASE', 'bo.b_1', 'mc');
X();
R('# ASSY', 'id', 'ref', 'cmd', 'p1', 'p2', 'p3', 'p4');
R('ASSY', 'as.j', 'md.col', 'ADD', 0, 0, -C.len / 2);
R('ASSY', 'as.j', 'md.bm',  'ADD', bX0, 0, 0);
R('#   the L is held on its bbox centre, which sits 30 in from the heel on both');
R('#   legs - so the heel lands at the flange face and the beam web');
R('ASSY', 'as.cl', 'md.cl', 'ADD', legAx + L.a / 2, bWebT + L.b / 2, -L.len / 2);
R('ASSY', 'as.clm', 'as.cl', 'MIR', 0, 0, 0, 'XZ');
R('ASSY', 'as.j', 'md.bb',  'ADD', gX, bWebT + L.t, z0);
X();
R('END');

(async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('input');
  ws.getColumn(2).width = 11; ws.getColumn(3).width = 12; ws.getColumn(4).width = 10;
  for (let i = 5; i <= 18; i++) ws.getColumn(i).width = 9;
  rows.forEach((r, i) => {
    const row = ws.getRow(i + 1);
    r.forEach((v, j) => { if (v !== '' && v !== null && v !== undefined) row.getCell(j + 2).value = v; });
    const head = String(r[0] || '');
    if (head.charAt(0) === '#')
      row.eachCell(c => { c.font = { italic: true, size: 10, color: { argb: 'FF64748B' } }; });
    else if (head) row.getCell(2).font = { bold: true, color: { argb: 'FF1D4ED8' } };
  });
  await wb.xlsx.writeFile(OUT);
  console.log('  PLATE3D_BCJOINT.xlsx  ' + rows.length + ' rows');

  const LIB = f => {
    let p = SP + '/node_modules/three/build/three.min.js';
    if (f.includes('OrbitControls')) p = SP + '/node_modules/three/examples/js/controls/OrbitControls.js';
    if (f.includes('polybool')) p = SP + '/node_modules/polybooljs/dist/polybool.min.js';
    if (f.includes('exceljs')) p = SP + '/node_modules/exceljs/dist/exceljs.min.js';
    return fs.readFileSync(p, 'utf-8');
  };
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  await page.route('**/{unpkg.com,cdnjs.cloudflare.com}/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: LIB(r.request().url()) }));
  await page.route('**/fonts.{googleapis,gstatic}.com/**', r => r.abort());
  await page.goto('file://' + SP + '/video_page.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.setInputFiles('#pb-file', OUT);
  await page.waitForFunction(b => {
    const r = document.getElementById('pb-result');
    return r && r.innerText.indexOf(b) >= 0;
  }, path.basename(OUT), { timeout: 120000 });
  await page.waitForTimeout(2000);
  console.log('\n' + (await page.evaluate(() =>
    document.getElementById('pb-result').innerText)).trim().slice(0, 400));
  const bb = await page.evaluate(() => {
    const out = [];
    window.__pbS.traverse(o => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes) return;
      o.updateWorldMatrix(true, false);
      const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
      const b = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
      out.push([+b.min.x.toFixed(1), +b.max.x.toFixed(1), +b.min.y.toFixed(1),
                +b.max.y.toFixed(1), +b.min.z.toFixed(1), +b.max.z.toFixed(1)]);
    });
    const seen = {}, u = [];
    out.forEach(r => { const k = r.join(','); if (!seen[k]) { seen[k] = 1; u.push(r); } });
    return u;
  });
  console.log('\n  X min..max        Y min..max        Z min..max');
  bb.forEach(r => console.log('  ' + String(r[0]).padStart(7) + ' ..' + String(r[1]).padStart(7) +
    '   ' + String(r[2]).padStart(7) + ' ..' + String(r[3]).padStart(7) +
    '   ' + String(r[4]).padStart(7) + ' ..' + String(r[5]).padStart(7)));
  await browser.close();
})();
