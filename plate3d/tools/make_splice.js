// PLATE3D_SPLICE.xlsx - a bolted beam splice, and the reason to build a section
// out of plates instead of writing SECT.
//
// SECT draws a rolled section correctly, fillets and all, but a CUT on it runs
// the whole length: the profile is what gets cut, and the length is what it is
// extruded by, so a hole becomes a slot from one end to the other. To put a bolt
// hole through a flange the flange has to be a plate in its own right - its face
// the outline, its thickness the thickness - and then CUT means what it says.
//
// The root fillet survives that. It is a square of side r with a disc of radius
// r taken out of the far corner, extruded along the beam: exactly the region
// between the two flat faces and the arc, to the last decimal. Made once and
// turned four ways - the shape is symmetric about its own diagonal, so its
// mirror image is one of its rotations.
//
// Cost: one rolled beam becomes seven pieces. Worth it where the holes are,
// which is why only the two beams either side of the splice are built this way.
const ExcelJS = require('/tmp/claude-0/-home-user/2c32e469-0690-5fe7-bd2b-b7fdc61d0d9a/scratchpad/node_modules/exceljs');
const OUT = process.argv[2] ||
  '/tmp/claude-0/-home-user/2c32e469-0690-5fe7-bd2b-b7fdc61d0d9a/scratchpad/PLATE3D_SPLICE.xlsx';

/* ===================== H-500x200x10x16, r20 ===================== */
const H = 500, B = 200, TW = 10, TF = 16, RR = 20;
const ZW = H / 2 - TF;             // 234 - flange underside, web half depth
const LEN = 1800;                  // each beam
const GAP = 20;                    // between the two beam ends

/* ---- the bolt group ---- */
const E1 = 70, E2 = 180;           // rows either side of the splice
const G = 66;                      // flange gauge
const WZ = 90;                     // web rows
const SPL = 480, SPT = 12;         // splice plate length, thickness
const IW = 66;                     // inner flange plate width

const R = [];
const push = (...r) => R.push(r);
const blank = () => R.push([]);
const rd = v => Math.round(v * 10) / 10;
const HDR_MOD = ['# MODULE', 'id', 'member', 'Ref.Pt', 'L.X', 'L.Y', 'L.Z', 'PLANE',
                 'ROT.X', 'ROT.Y', 'ROT.Z'];
const HDR_AX = ['# MODULE', 'id', 'member', 'Ref.Pt', 'LX1', 'LY1', 'LZ1',
                'LX2', 'LY2', 'LZ2', 'OFF_B', 'OFF_E', 'Alpha'];
let form = '';
function M(id, mem, ref, x, y, z, pl, rx) {
  if (form !== 'm') { push.apply(null, HDR_MOD); form = 'm'; }
  push('MODULE', id, mem, ref, rd(x), rd(y), rd(z), pl, rx === undefined ? '' : rx);
}
function A(id, mem, a, b, ob, oe) {
  if (form !== 'a') { push.apply(null, HDR_AX); form = 'a'; }
  push('MODULE', id, mem, '', rd(a[0]), rd(a[1]), rd(a[2]),
       rd(b[0]), rd(b[1]), rd(b[2]), ob || '', oe || '');
}
function BASE(id, mem, pt) {
  if (form !== 'm') { push.apply(null, HDR_MOD); form = 'm'; }
  push('MODULE', id, 'BASE', mem, pt); form = '';
}

/* ===================== parts ===================== */
push('# PLATE', 'id', 'mat', 'thk', 'shape', 'base.pt', 'p1', 'p2');
push('PLATE', 'pl.fl', 'SM490', TF, 'RECT', 'mc', LEN, B);        // flange: face is the outline
push('PLATE', 'pl.wb', 'SM490', TW, 'RECT', 'mc', LEN, H - 2 * TF); // web
push('PLATE', 'pl.fil', 'SM490', LEN, 'RECT', 'bl', RR, RR);      // fillet: thk IS the length
push('PLATE', 'pl.fsp', 'SM490', SPT, 'RECT', 'mc', SPL, B);      // outer flange splice
push('PLATE', 'pl.isp', 'SM490', SPT, 'RECT', 'mc', SPL, IW);     // inner flange splice
push('PLATE', 'pl.wsp', 'SM490', 10, 'RECT', 'mc', SPL, 300);     // web splice
blank();

push('# BAR', 'id', 'mat', 'dia', 'length');
push('BAR', 'bar.m22', 'F10T', 22, 100);
blank();

push('# HOLE', 'id', 'shape', 'base.pt', 'd');
push('HOLE', 'ho.m24', 'CIRC', 'mc', 24);
push('HOLE', 'ho.fil', 'CIRC', 'mc', 2 * RR);
blank();

/* ===================== cuts ===================== */
/* One arc makes the fillet; the rest are the bolt group, and the same group is
   drilled into the beam and into every plate that laps it. */
push('# CUT', 'plate', 'L.X', 'L.Y', 'shape', 'dx', 'dy', 'repeat');
push('CUT', 'pl.fil', RR, 0, 'ho.fil');
const CX = E1 - GAP / 2 - LEN / 2;    // bolt line, in the plate's own coordinates
[-G, G].forEach(g => push('CUT', 'pl.fl', CX, g, 'ho.m24', E2 - E1, 0, 1));
[-WZ, WZ].forEach(z => push('CUT', 'pl.wb', CX, z, 'ho.m24', E2 - E1, 0, 1));
[-G, G].forEach(g => {                                   // splice plates, both sides
  push('CUT', 'pl.fsp', -E2, g, 'ho.m24', E2 - E1, 0, 1);
  push('CUT', 'pl.fsp', E1, g, 'ho.m24', E2 - E1, 0, 1);
});
push('CUT', 'pl.isp', -E2, 0, 'ho.m24', E2 - E1, 0, 1);
push('CUT', 'pl.isp', E1, 0, 'ho.m24', E2 - E1, 0, 1);
[-WZ, WZ].forEach(z => {
  push('CUT', 'pl.wsp', -E2, z, 'ho.m24', E2 - E1, 0, 1);
  push('CUT', 'pl.wsp', E1, z, 'ho.m24', E2 - E1, 0, 1);
});
blank();

/* ===================== one beam, out of seven plates ===================== */
M('md.beam', 'pl.wb', 'mc', 0, 0, 0, 'XZ');
M('md.beam', 'pl.fl_1', 'mc', 0, 0, ZW + TF / 2, 'XY');
M('md.beam', 'pl.fl_2', 'mc', 0, 0, -ZW - TF / 2, 'XY');
/* the four fillets: one definition, turned. The two flat faces of the piece
   land on the web and on the flange; the arc faces out. */
M('md.beam', 'pl.fil_1', 'bl', 0, TW / 2, ZW - RR, 'YZ', 0);
M('md.beam', 'pl.fil_2', 'bl', 0, -TW / 2 - RR, ZW, 'YZ', 270);
M('md.beam', 'pl.fil_3', 'bl', 0, TW / 2 + RR, -ZW, 'YZ', 90);
M('md.beam', 'pl.fil_4', 'bl', 0, -TW / 2, -ZW + RR, 'YZ', 180);
BASE('md.beam', 'pl.wb', 'mc');
blank();

/* ===================== the splice ===================== */
const ZO = ZW + TF + SPT / 2;      // outer plate, on top of the flange
const ZI = ZW - SPT / 2;           // inner plates, under it
M('md.spl', 'pl.fsp_1', 'mc', 0, 0, ZO, 'XY');
M('md.spl', 'pl.fsp_2', 'mc', 0, 0, -ZO, 'XY');
let n = 0;
[1, -1].forEach(s => [1, -1].forEach(g =>
  M('md.spl', 'pl.isp_' + (++n), 'mc', 0, g * G, s * ZI, 'XY')));
M('md.spl', 'pl.wsp_1', 'mc', 0, TW / 2 + 5, 0, 'XZ');
M('md.spl', 'pl.wsp_2', 'mc', 0, -TW / 2 - 5, 0, 'XZ');
let bn = 0;
[-E2, -E1, E1, E2].forEach(x => {
  [-G, G].forEach(g => [1, -1].forEach(s =>
    A('md.spl', 'bar.m22_' + (++bn), [x, g, s * (ZI - SPT / 2 - 8)],
      [x, g, s * (ZO + SPT / 2 + 8)])));
  [-WZ, WZ].forEach(z =>
    A('md.spl', 'bar.m22_' + (++bn), [x, -TW / 2 - 10 - 8, z], [x, TW / 2 + 10 + 8, z]));
});
BASE('md.spl', 'pl.fsp_1', 'mc');
blank();

/* ===================== assembly ===================== */
push('# ASSY', 'id', 'ref', 'cmd', 'G.X / d.X', 'G.Y', 'G.Z', 'ROT / PLANE');
push('ASSY', 'as.beam', 'md.beam', 'ADD', LEN / 2 + GAP / 2, 0, 0);
push('ASSY', 'as.beam', 'as.beam', 'MIR', 0, 0, 0, 'YZ');
blank();
push('ASSY', 'as.spl', 'md.spl', 'ADD', 0, 0, ZO);
push('END');

/* ===================== write ===================== */
(async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('input');
  const at = (kw, id) => R.findIndex(r => r[0] === kw && (id === undefined || r[1] === id));
  const notes = {};
  const put = (i, t) => { if (i >= 0) notes[i] = t; };
  put(0, 'Bolted beam splice - H-500x200x10x16 built from plates, so it can be drilled');
  put(at('PLATE', 'pl.fl'), 'the FACE is the outline and thk is the thickness - so CUT drills');
  put(at('PLATE', 'pl.fil'), 'the fillet: thk is the BEAM LENGTH, so it extrudes along the beam');
  put(at('CUT', 'pl.fil'), 'square minus a disc on its far corner = the fillet, exactly');
  put(at('MODULE', 'md.beam'), 'ONE beam = 7 plates. MIR makes the one on the other side');
  put(at('# ASSY'), 'two beams and the splice that joins them');
  R.forEach((r, i) => ws.addRow(r.length ? [notes[i] || ''].concat(r) : []));
  ws.getColumn(1).width = 62;
  ws.getColumn(2).width = 11;
  ws.getColumn(3).width = 12;
  ws.getColumn(4).width = 11;
  for (let c = 5; c <= 15; c++) ws.getColumn(c).width = 9;
  ws.eachRow(row => row.eachCell({ includeEmpty: false }, cell => {
    const v = String(cell.value == null ? '' : cell.value);
    if (cell.col === 1) { cell.font = { italic: true, color: { argb: 'FF94A3B8' }, size: 10 }; return; }
    if (v.charAt(0) === '#') cell.font = { italic: true, color: { argb: 'FF64748B' }, size: 10 };
    else if (cell.col === 2) cell.font = { bold: true, color: { argb: 'FF1D4ED8' } };
  }));
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  await wb.xlsx.writeFile(OUT);
  const area = 2 * B * TF + (H - 2 * TF) * TW + 4 * RR * RR * (1 - Math.PI / 4);
  console.log('wrote ' + OUT + '  (' + R.length + ' rows)');
  console.log('H-500x200x10x16 r20: area ' + area.toFixed(0) + ' mm2 (book 11420)');
})();
