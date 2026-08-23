/* PLATE3D_BCJOINT.xlsx - a bolted beam-to-column connection, double angle cleat.

   The second connection example, after the beam splice. Same lesson as that
   one and it is the whole reason the sheet looks the way it does: a CUT edits
   a 2D profile and the profile runs the length of the member, so a bolt hole
   only exists where the thing it goes through is a PLATE and the hole runs
   through its thickness. A beam written as SECT H is one tidy row and cannot
   be drilled - the "hole" would be a slot down the whole beam. So the beam,
   the column and the cleats are built from plates, exactly as SPLICE builds
   its beam.

   Geometry, Z up, column standing on Z, beam framing along +X into the
   column's front flange:

              Z                          column  H-300x300x10x15
              |     ___________          beam    H-300x150x6.5x9
        ______|____|  beam     |         cleats  2 x L-60x60x8, 140 long
       |  col |    |___________|         bolts   M16, 3 per leg at 40 pitch
       |      |    |  cleats             gap     10 mm beam end to flange face
       |______|____|
              |
                          ---> X

   Two definitions exist only because one face is drilled and the other is not:
   pl.cfb is the flange the beam lands on, pl.cf the one behind it. Giving both
   the same id would put six holes in the back of the column.

     node tools/make_bcjoint.js            build, then verify
     node tools/make_bcjoint.js --build    build only                        */
const ExcelJS = require('../video/tools/node_modules/exceljs');
const { chromium } = require('../video/tools/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');

const SP = path.resolve(__dirname, '../video/tools');
const P3 = path.resolve(__dirname, '..');
const OUT = P3 + '/PLATE3D_BCJOINT.xlsx';

/* ---- the numbers, in one place, so a reader can change the joint ---- */
const C = { h: 300, b: 300, tw: 10, tf: 15, len: 1600 };   // column
const B = { h: 300, b: 150, tw: 6.5, tf: 9, len: 900 };    // beam
const L = { leg: 60, t: 8, len: 140 };                     // cleat angle
const BOLT = { d: 16, hole: 18, pitch: 40, n: 3, gauge: 35 };
const GAP = 10;                                            // beam end to flange face

const cFaceX = C.h / 2;                       // 150 - front flange outer face
const cFlgX  = cFaceX - C.tf / 2;             // 142.5 - flange mid-plane
const bWebT  = B.tw / 2;                      // 3.25
const bX0    = cFaceX + GAP;                  // 160 - beam starts here
const bXc    = bX0 + B.len / 2;               // beam centre
const legAx  = cFaceX + L.t / 2;              // 154 - leg A mid-plane
const legAyc = bWebT + L.leg / 2;             // 33.25 - leg A centre in Y
const legBy  = bWebT + L.t / 2;               // 7.25 - leg B mid-plane
const legBw  = L.leg - L.t;                   // 52 - leg B, so the corner is not counted twice
const legBx0 = cFaceX + L.t;                  // 158
const legBxc = legBx0 + legBw / 2;            // 184
const gY     = bWebT + BOLT.gauge;            // 38.25 - bolt line off the heel
const gX     = cFaceX + BOLT.gauge;           // 185 - bolt line off the flange face
const z0     = -BOLT.pitch * (BOLT.n - 1) / 2;   // -40

const rows = [];
const R = (...c) => rows.push(c);
const X = () => rows.push([]);

R('# PLATE3D  ·  bolted beam-to-column connection, double angle cleat');
R('#   column  H-' + C.h + 'x' + C.b + 'x' + C.tw + 'x' + C.tf +
  '   beam  H-' + B.h + 'x' + B.b + 'x' + B.tw + 'x' + B.tf +
  '   cleats  L-' + L.leg + 'x' + L.leg + 'x' + L.t);
R('#   Built from plates, not sections. A CUT edits a 2D profile and the profile');
R('#   runs the whole length, so a bolt hole is only a hole where it goes through');
R('#   a plate’s thickness. A beam written as SECT H cannot be drilled.');
X();
R('# HOLE', 'id', 'TYPE', 'base.pt', 'D');
R('HOLE', 'ho.b', 'CIRC', 'mc', BOLT.hole);
X();
R('# PLATE', 'id', 'mat', 'thk', 'shape', 'base.pt', 'p1', 'p2');
R('PLATE', 'pl.cfb', 'SS275', C.tf, 'RECT', 'mc', C.b, C.len);      // front flange, drilled
R('PLATE', 'pl.cf',  'SS275', C.tf, 'RECT', 'mc', C.b, C.len);      // back flange, plain
R('PLATE', 'pl.cw',  'SS275', C.tw, 'RECT', 'mc', C.h - 2 * C.tf, C.len);
R('PLATE', 'pl.bf',  'SS275', B.tf, 'RECT', 'mc', B.len, B.b);
R('PLATE', 'pl.bw',  'SS275', B.tw, 'RECT', 'mc', B.len, B.h - 2 * B.tf);
R('PLATE', 'pl.la',  'SS275', L.t,  'RECT', 'mc', L.leg, L.len);    // cleat leg on the column
R('PLATE', 'pl.lb',  'SS275', L.t,  'RECT', 'mc', legBw, L.len);    // cleat leg on the beam web
X();
R('# BAR', 'id', 'mat', 'dia', 'length');
R('BAR', 'bo.c', 'SS275', BOLT.d, L.t + C.tf + 25);                  // through cleat + flange
R('BAR', 'bo.b', 'SS275', BOLT.d, 2 * L.t + B.tw + 25);              // through cleat + web + cleat
X();
R('# CUT', 'target', 'L.X', 'L.Y', 'shape', 'dx', 'dy', 'repeat');
R('CUT', 'pl.cfb',  gY, z0, 'ho.b', 0, BOLT.pitch, BOLT.n - 1);
R('CUT', 'pl.cfb', -gY, z0, 'ho.b', 0, BOLT.pitch, BOLT.n - 1);
R('CUT', 'pl.bw', gX - bXc, z0, 'ho.b', 0, BOLT.pitch, BOLT.n - 1);
R('CUT', 'pl.la', BOLT.gauge - L.leg / 2, z0, 'ho.b', 0, BOLT.pitch, BOLT.n - 1);
R('CUT', 'pl.lb', gX - legBxc, z0, 'ho.b', 0, BOLT.pitch, BOLT.n - 1);
X();
R('# MODULE', 'id', 'member', 'Ref.Pt', 'L.X', 'L.Y', 'L.Z', 'PLANE');
R('#   Each module is written in ITS OWN local frame, with BASE on a point that');
R('#   sits at that frame’s origin, and the ASSY row decides where it lands.');
R('#   Writing world coordinates inside a module and then adding a BASE row');
R('#   drags the whole module back so that BASE meets the ASSY point - which is');
R('#   what BASE is for, and is exactly how the first draft of this sheet put');
R('#   the beam through the middle of the column.');
X();
R('MODULE', 'md.col', 'pl.cfb', 'mc',  cFlgX, 0, 0, 'YZ');
R('MODULE', 'md.col', 'pl.cf',  'mc', -cFlgX, 0, 0, 'YZ');
R('MODULE', 'md.col', 'pl.cw',  'mc', 0, 0, 0, 'XZ');
R('MODULE', 'md.col', 'BASE', 'pl.cw', 'mc');
X();
R('#   beam, local origin at its own centre');
R('MODULE', 'md.beam', 'pl.bf', 'mc', 0, 0,  B.h / 2 - B.tf / 2, 'XY');
R('MODULE', 'md.beam', 'pl.bf', 'mc', 0, 0, -(B.h / 2 - B.tf / 2), 'XY');
R('MODULE', 'md.beam', 'pl.bw', 'mc', 0, 0, 0, 'XZ');
R('MODULE', 'md.beam', 'BASE', 'pl.bw', 'mc');
X();
R('#   one cleat and the bolts that hold it to the column, local origin on leg A.');
R('#   The pair is made by mirroring this, so it is written once.');
R('# MODULE', 'id', 'member', 'Ref.Pt', 'L.X', 'L.Y', 'L.Z', 'PLANE', 'ROT.X', 'ROT.Y', 'ROT.Z',
  'dx', 'dy', 'dz', 'repeat');
R('MODULE', 'md.cl', 'pl.la', 'mc', 0, 0, 0, 'YZ');
R('MODULE', 'md.cl', 'pl.lb', 'mc', legBxc - legAx, legBy - legAyc, 0, 'XZ');
R('MODULE', 'md.cl', 'bo.c', '', -(L.t / 2 + C.tf + 10), gY - legAyc, z0, 'YZ',
  0, 0, 0, 0, 0, BOLT.pitch, BOLT.n - 1);
R('MODULE', 'md.cl', 'BASE', 'pl.la', 'mc');
X();
R('#   the bolts through both cleats and the beam web, local origin on the first');
R('MODULE', 'md.bb', 'bo.b', '', 0, 0, 0, 'XZ', 0, 0, 0, 0, 0, BOLT.pitch, BOLT.n - 1);
R('MODULE', 'md.bb', 'BASE', 'bo.b_1', 'mc');
X();
R('# ASSY', 'id', 'ref', 'cmd', 'p1', 'p2', 'p3', 'p4');
R('ASSY', 'as.j', 'md.col',  'ADD', 0, 0, 0);
R('ASSY', 'as.j', 'md.beam', 'ADD', bXc, 0, 0);
R('#   as.cl is an assembly in its own right - placing it once is enough, and');
R('#   the mirror reflects it where it stands. Adding as.cl into as.j as well');
R('#   put a second cleat back at the origin: an ADD row re-places its source.');
R('ASSY', 'as.cl', 'md.cl',  'ADD', legAx, legAyc, 0);
R('ASSY', 'as.clm', 'as.cl', 'MIR', 0, 0, 0, 'XZ');
R('ASSY', 'as.j', 'md.bb',   'ADD', gX, legBy + L.t / 2 + 10, z0);
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
    else if (head)
      row.getCell(2).font = { bold: true, color: { argb: 'FF1D4ED8' } };
  });
  await wb.xlsx.writeFile(OUT);
  console.log('  PLATE3D_BCJOINT.xlsx  ' + rows.length + ' rows');
  if (process.argv.includes('--build')) return;

  const LIB = f => {
    let p = SP + '/node_modules/three/build/three.min.js';
    if (f.includes('OrbitControls')) p = SP + '/node_modules/three/examples/js/controls/OrbitControls.js';
    if (f.includes('polybool')) p = SP + '/node_modules/polybooljs/dist/polybool.min.js';
    if (f.includes('exceljs')) p = SP + '/node_modules/exceljs/dist/exceljs.min.js';
    return fs.readFileSync(p, 'utf-8');
  };
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
  await page.route('**/{unpkg.com,cdnjs.cloudflare.com}/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: LIB(r.request().url()) }));
  await page.route('**/fonts.{googleapis,gstatic}.com/**', r => r.abort());
  await page.goto('file://' + P3 + '/tools/host_lock.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.setInputFiles('#pb-file', OUT);
  await page.waitForFunction(b => {
    const r = document.getElementById('pb-result');
    return r && r.innerText.indexOf(b) >= 0;
  }, path.basename(OUT), { timeout: 120000 });
  await page.waitForTimeout(2500);
  console.log('\n' + (await page.evaluate(() =>
    document.getElementById('pb-result').innerText)).trim());
  await browser.close();
})();
