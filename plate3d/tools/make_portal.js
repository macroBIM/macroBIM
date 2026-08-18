// PLATE3D_PORTAL.xlsx - a pitched-roof portal frame shed, off the general
// arrangement drawing.
//
// What the drawing gave and what it did not:
//   read straight off it   UB457x191x82 rafters, UC254x254x73 columns, 6000 bays,
//                          30000 long, bolted haunched eaves, web stiffeners,
//                          flange braces, base plate with anchor bolts in a
//                          grout pocket
//   chosen here            18000 span, 6000 to eaves, 1500 rise. The drawing
//                          contradicts itself on both - the roof plan's bay
//                          dimensions total 34000 against a stated 30000, and
//                          its width reads 15300 where section A-A reads 18000.
//                          Both are one cell each below.
//
// One frame is written once and copied five times; one bay of purlins and rails
// likewise. Everything sloping is written as two end points.
const ExcelJS = require('/tmp/claude-0/-home-user/2c32e469-0690-5fe7-bd2b-b7fdc61d0d9a/scratchpad/node_modules/exceljs');
const OUT = process.argv[2] ||
  '/tmp/claude-0/-home-user/2c32e469-0690-5fe7-bd2b-b7fdc61d0d9a/scratchpad/PLATE3D_PORTAL.xlsx';

/* ===================== the building ===================== */
const BAY = 6000, NBAY = 5;        // 30000 long
const SPAN = 18000, HY = SPAN / 2; // 18000 clear span
const EAVE = 6000;                 // top of column
const RISE = 1500;                 // ridge above eaves -> 9.46 deg

/* ---- sections, from the drawing ---- */
const CH = 254.1, CB = 254.6;      // UC 254x254x73
const RH = 460.0, RB = 191.3;      // UB 457x191x82
const PD = 200, RD = 150;          // purlin depth, side-rail depth

/* ---- derived ---- */
const RUN = Math.hypot(HY, RISE);          // rafter length, eaves to apex
const UY = -HY / RUN, UZ = RISE / RUN;     // unit vector, +Y eaves -> apex
const SLOPE = Math.atan2(RISE, HY) * 180 / Math.PI;
const NY = -UZ, NZ = -UY;                  // roof normal, pointing up and out
const RZ0 = EAVE + (RH / 2) / Math.cos(SLOPE * Math.PI / 180); // rafter axis at the eaves
const RZ1 = RZ0 + RISE;                                        // rafter axis at the apex

const HNCH = 1600, HDEEP = 420;    // haunch: length along the rafter, depth added
const PURL = [0, 1520, 3040, 4560, 6080, 7600];   // purlin lines, along the rafter
const RAIL = [1500, 3000, 4500];                  // side rails, above the floor
/* Clearances. A purlin sits on a cleat, not on the rafter, and rails sit on
   cleats off the column - so both stand clear, and nothing has to be fudged
   later to keep the clash check quiet. */
const POFF = RH / 2 + PD / 2 + 40;      // purlin axis, off the rafter axis
const RYY = HY + CH / 2 + RD / 2 + 40;  // side rail, off the column face
const BOF1 = 330, BOF2 = 250;           // the two roof bracing rods, one under the other

const R = [];
const push = (...r) => R.push(r);
const blank = () => R.push([]);
const rd = v => Math.round(v * 10) / 10;

/* row writers -------------------------------------------- */
const HDR_MOD = ['# MODULE', 'id', 'member', 'Ref.Pt', 'L.X', 'L.Y', 'L.Z',
                 'PLANE', 'ROT.X', 'ROT.Y', 'ROT.Z'];
const HDR_AX = ['# MODULE', 'id', 'member', 'Ref.Pt', 'LX1', 'LY1', 'LZ1',
                'LX2', 'LY2', 'LZ2', 'OFF_B', 'OFF_E', 'Alpha'];
let form = '';
function M(id, mem, ref, x, y, z, pl, rx, ry, rz) {
  if (form !== 'm') { push.apply(null, HDR_MOD); form = 'm'; }
  push('MODULE', id, mem, ref, rd(x), rd(y), rd(z), pl,
       rx === undefined ? '' : rd(rx), ry === undefined ? '' : rd(ry),
       rz === undefined ? '' : rd(rz));
}
function A(id, mem, a, b, ob, oe, al) {
  if (form !== 'a') { push.apply(null, HDR_AX); form = 'a'; }
  push('MODULE', id, mem, '', rd(a[0]), rd(a[1]), rd(a[2]),
       rd(b[0]), rd(b[1]), rd(b[2]), ob || '', oe || '', al === undefined ? '' : rd(al));
}
function BASE(id, mem, pt) {
  if (form !== 'm') { push.apply(null, HDR_MOD); form = 'm'; }
  push('MODULE', id, 'BASE', mem, pt); form = '';
}
// a point on the rafter axis, s along it from the eaves, on the +/-Y slope
function raf(sgn, s, off) {
  off = off || 0;
  return [0, sgn * (HY + UY * s + (off || 0) * NY), RZ0 + UZ * s + (off || 0) * NZ];
}

/* ===================== parts ===================== */
push('# SECT', 'id', 'mat', 'length', 'TYPE', 'base.pt',
     'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7');
push('SECT', 'sc.col', 'S355', EAVE, 'H', 'mc', CH, CB, CB, 8.6, 14.2, 14.2, 12.7);
push('SECT', 'sc.raf', 'S355', 12000, 'H', 'mc', RH, RB, RB, 9.9, 16, 16, 10.2);
push('SECT', 'sc.pur', 'S450', BAY, 'C', 'mc', PD, 75, 2.5, 2.5, 5, 2.5);
push('SECT', 'sc.rail', 'S450', BAY, 'C', 'mc', RD, 65, 2.5, 2.5, 5, 2.5);
push('SECT', 'sc.fb', 'S275', 1400, 'L', 'mc', 75, 75, 6, 6, 8, 4);
push('SECT', 'sc.gab', 'S355', EAVE, 'H', 'mc', 203.2, 133.2, 133.2, 5.8, 7.8, 7.8, 7.6);
blank();

push('# BAR', 'id', 'mat', 'dia', 'length');
push('BAR', 'bar.anch', 'S275', 24, 700);      // anchor bolt, into the pocket
push('BAR', 'bar.brc', 'S275', 24, 12000);     // bracing rod
blank();

push('# PLATE', 'id', 'mat', 'thk', 'shape', 'base.pt', 'p1', 'p2', 'p3', 'p4');
push('PLATE', 'pl.base', 'S275', 20, 'RECT', 'mc', 400, 400);        // Detail 1
push('PLATE', 'pl.epl', 'S275', 25, 'RECT', 'mc', 200, 880);         // Detail 2
push('PLATE', 'pl.apx', 'S275', 20, 'RECT', 'mc', 200, 460);         // apex plate
push('PLATE', 'pl.stf', 'S275', 10, 'RECT', 'mc', 108, 220);         // web stiffener, one side of the web
push('PLATE', 'pl.hnch', 'S355', 10, 'TRAP', 'bl', HNCH, 0, HDEEP, 0); // haunch web
blank();

push('# HOLE', 'id', 'shape', 'base.pt', 'd');
push('HOLE', 'ho.m24', 'CIRC', 'mc', 26);
push('HOLE', 'ho.m20', 'CIRC', 'mc', 22);
blank();

push('# CUT', 'plate', 'L.X', 'L.Y', 'shape', 'dx', 'dy', 'repeat');
push('CUT', 'pl.base', -140, -140, 'ho.m24', 280, 0, 1);
push('CUT', 'pl.base', -140, 140, 'ho.m24', 280, 0, 1);
[-350, -230, -110, 110, 230, 350].forEach(v =>
  push('CUT', 'pl.epl', -55, v, 'ho.m20', 110, 0, 1));      // 6 rows of 2
[-160, -55, 55, 160].forEach(v =>
  push('CUT', 'pl.apx', -55, v, 'ho.m20', 110, 0, 1));
blank();

/* ===================== half a portal frame ===================== */
/* The frame is symmetric, so only the right-hand half is written and ASSY MIR
   makes the other. That is also what puts the haunch the right way up on both
   sides: a mirrored plate comes back mirrored, where a rotation cannot get
   there from here. */
A('md.half', 'sc.col', [0, HY, 0], [0, HY, EAVE]);
A('md.half', 'sc.raf', raf(1, 0), raf(1, RUN), 220, 110);
M('md.half', 'pl.base', 'mc+', 0, HY, 0, 'XY');
[[-140, -140], [140, -140], [-140, 140], [140, 140]].forEach((o, j) =>
  A('md.half', 'bar.anch_' + (j + 1),
    [o[0], HY + o[1], -420], [o[0], HY + o[1], 60]));
// the bolted end plate stands on the column's inner face, over the haunch
M('md.half', 'pl.epl', 'mc', 0, HY - CH / 2 - 20, EAVE - 60, 'XZ');
// the haunch: a wedge under the rafter, deepest at the column
M('md.half', 'pl.hnch', 'bl', 0, raf(1, 220, -RH / 2 - 15)[1], raf(1, 220, -RH / 2 - 15)[2],
  'YZ', 180 - SLOPE);
// column web stiffeners, in pairs either side of the web, opposite the haunch
let sn = 0;
[EAVE - 120, EAVE - HDEEP - 120].forEach(z => [-66, 66].forEach(x =>
  M('md.half', 'pl.stf_' + (++sn), 'mc', x, HY, z, 'XY')));
BASE('md.half', 'sc.col', 'mc');
blank();

/* ===================== one bay of sheeting rails ===================== */
/* The ridge purlin sits on the centre line, so it is the datum: its work point
   is (0, 0, ridge) and the ASSY row reads the same. */
A('md.bay', 'sc.pur_0', [0, 0, RZ1 + POFF], [BAY, 0, RZ1 + POFF]);
let pn = 0, rn = 0;
[-1, 1].forEach(s => {
  PURL.forEach(d => {
    const p = raf(s, d, POFF);
    A('md.bay', 'sc.pur_' + (++pn), [0, p[1], p[2]], [BAY, p[1], p[2]], 0, 0, -s * SLOPE);
  });
  RAIL.forEach(z => A('md.bay', 'sc.rail_' + (++rn),
                      [0, s * RYY, z], [BAY, s * RYY, z], 0, 0, -s * 90));
});
// flange braces: an angle from the rafter's bottom flange out to a purlin, so
// it leans along the building - which is why it belongs to the bay, not the frame
let fn = 0;
[-1, 1].forEach(s2 => [PURL[1], PURL[3]].forEach(d => {
  const a = raf(s2, d, -RH / 2), b = raf(s2, d, POFF - PD / 2);
  A('md.bay', 'sc.fb_' + (++fn), [0, a[1], a[2]], [900, b[1], b[2]], 200, 140);
}));
BASE('md.bay', 'sc.pur_0', 'mc');
blank();

/* ===================== the braced bay ===================== */
/* Rods cross in the plane of the roof and in the plane of each wall. */
const PA = raf(1, PURL[0], BOF1), PB = raf(1, PURL[1], BOF1);
const QA = raf(1, PURL[0], BOF2), QB = raf(1, PURL[1], BOF2);
[1, -1].forEach((g, k) => {
  A('md.brc', 'bar.brc_' + (k * 2 + 1), [0, g * PA[1], PA[2]], [BAY, g * PB[1], PB[2]], 260, 260);
  A('md.brc', 'bar.brc_' + (k * 2 + 2), [BAY, g * QA[1], QA[2]], [0, g * QB[1], QB[2]], 260, 260);
});
[-1, 1].forEach((s2, i) => {
  // the two rods of a wall X pass either side of each other, as they do on site
  A('md.brc', 'bar.brc_' + (i * 2 + 5), [0, s2 * HY - 25, 300], [BAY, s2 * HY - 25, EAVE - 300], 200, 200);
  A('md.brc', 'bar.brc_' + (i * 2 + 6), [BAY, s2 * HY + 25, 300], [0, s2 * HY + 25, EAVE - 300], 200, 200);
});
BASE('md.brc', 'bar.brc_1', 'mc');
blank();

/* ===================== gable end posts ===================== */
[-1, 1].forEach((s, i) => {
  const y = s * HY / 3;
  const z = RZ0 + UZ * (HY - Math.abs(y)) / Math.abs(UY) - RH / 2;
  A('md.gable', 'sc.gab_' + (i + 1), [0, y, 0], [0, y, z], 0, 40);
});
BASE('md.gable', 'sc.gab_1', 'mc');
blank();

/* ===================== assembly ===================== */
push('# ASSY', 'id', 'ref', 'cmd', 'G.X / d.X', 'G.Y', 'G.Z',
     'ROT.X / axis', 'ROT.Y / ang', 'ROT.Z / rep');
push('ASSY', 'as.frame', 'md.half', 'ADD', 0, HY, 0);
push('ASSY', 'as.frame', 'as.frame', 'MIR', 0, 0, 0, 'XZ');
push('ASSY', 'as.frame', 'pl.apx', 'ADD', 0, 0, RZ1 - 230, 90);
push('ASSY', 'as.frame', 'as.frame', 'COPY', BAY, 0, 0, NBAY);
blank();
push('ASSY', 'as.skin', 'md.bay', 'ADD', 0, 0, RZ1 + POFF);
push('ASSY', 'as.skin', 'as.skin', 'COPY', BAY, 0, 0, NBAY - 1);
blank();
push('ASSY', 'as.brc', 'md.brc', 'ADD', 0, PA[1], PA[2]);
push('ASSY', 'as.brc', 'md.brc', 'ADD', BAY * (NBAY - 1), PA[1], PA[2]);
blank();
push('ASSY', 'as.gable', 'md.gable', 'ADD', 0, -HY / 3, 0);
push('ASSY', 'as.gable', 'md.gable', 'ADD', BAY * NBAY, -HY / 3, 0);
push('END');

/* ===================== write ===================== */
(async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('input');
  const at = (kw, id) => R.findIndex(r => r[0] === kw && (id === undefined || r[1] === id));
  const notes = {};
  const put = (i, t) => { if (i >= 0) notes[i] = t; };
  put(0, 'Portal frame shed - ' + SPAN / 1000 + ' m span, ' + BAY * NBAY / 1000 +
         ' m long, ' + EAVE / 1000 + ' m to eaves');
  put(at('SECT', 'sc.col'), 'UC 254x254x73, off the drawing');
  put(at('SECT', 'sc.raf'), 'UB 457x191x82. 12000 is stock - the coordinates cut it');
  put(at('PLATE', 'pl.epl'), 'Detail 2: bolted end plate, 880 deep over the haunch');
  put(at('PLATE', 'pl.base'), 'Detail 1: base plate, 4 anchor bolts');
  put(at('MODULE', 'md.half'), 'HALF a frame. ASSY MIR makes the other half');
  put(at('MODULE', 'md.bay'), 'ONE bay of purlins and side rails');
  put(at('# ASSY'), 'six frames, five bays, braced at both ends');
  R.forEach((r, i) => ws.addRow(r.length ? [notes[i] || ''].concat(r) : []));
  ws.getColumn(1).width = 54;
  ws.getColumn(2).width = 11;
  ws.getColumn(3).width = 12;
  ws.getColumn(4).width = 11;
  for (let c = 5; c <= 17; c++) ws.getColumn(c).width = 9;
  ws.eachRow(row => row.eachCell({ includeEmpty: false }, cell => {
    const v = String(cell.value == null ? '' : cell.value);
    if (cell.col === 1) { cell.font = { italic: true, color: { argb: 'FF94A3B8' }, size: 10 }; return; }
    if (v.charAt(0) === '#') cell.font = { italic: true, color: { argb: 'FF64748B' }, size: 10 };
    else if (cell.col === 2) cell.font = { bold: true, color: { argb: 'FF1D4ED8' } };
  }));
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  await wb.xlsx.writeFile(OUT);
  console.log('wrote ' + OUT + '  (' + R.length + ' rows)  slope ' + SLOPE.toFixed(2) + ' deg');
})();
