/* PLATE3D_HBASE.xlsx - the haunched box base off the shop drawing
 * (PL HB / HSL / HVT1-3 / HADD1-2, all 10T).
 *
 * Two kinds of number went into this, and they are not equally certain.
 *
 * The PART SCHEDULE is exact. Every plate on the sheet is dimensioned and
 * counted, and every one of them is here at that size, that thickness and that
 * count - HB 340x340 once, HSL 142x220 three times, HVT2 four times, and so on
 * down to the two HADD2. Those are transcribed, not guessed, and the PLATE
 * block can be checked against the schedule line by line.
 *
 * The ASSEMBLY is inferred, and it is inferred from the counts. Four numbers
 * on the schedule do the deciding:
 *
 *   142 = 122 + 2x10   HVT1's top edge wraps HVT3 -> a box 142 outside,
 *                      122 clear, and 122 clear is exactly the opening cut in
 *                      the base plate. The box stands over that opening.
 *   242 - 142 = 100    HVT1's bottom flare, and HVT2's whole base. The flare
 *                      built into HVT1 and the loose triangle HVT2 are the
 *                      same haunch, one drawn into the face plate and one not.
 *   sqrt(100^2+200^2)  = 223.6, and HSL is 220 long. HSL is the sloped plate
 *                      that closes a haunch, 142 wide = the box outside.
 *   3 HSL, 4 HVT2      Three haunches, not four. Three haunches round a square
 *                      box leave four free side edges - the two shared hips
 *                      plus the two open ends - and that is the four HVT2.
 *                      The fourth face carries no haunch; the two HADD plates
 *                      hang off it.
 *
 * That reading also keeps the four anchor holes clear: they sit at the corners
 * (+/-110, +/-110) and every haunch stops at +/-71 across, so nothing covers a
 * bolt. A reading that put a haunch on all four faces would bury two of them.
 *
 * What stays a guess is where the two HADD brackets sit on the free face. The
 * elevation shows them low and outboard and gives no level, so they are two
 * shelf-and-lip brackets at Z_ADD_HI / Z_ADD_LO below - one constant each.
 * If the real detail differs, the fix is that constant and not the model.
 */
const ExcelJS = require('/tmp/claude-0/-home-user/6cdc702a-24df-51eb-b9d9-9f399d189def/scratchpad/node_modules/exceljs');
const OUT = process.argv[2] ||
  '/tmp/claude-0/-home-user/6cdc702a-24df-51eb-b9d9-9f399d189def/scratchpad/PLATE3D_HBASE.xlsx';

/* ===================== from the schedule - exact ===================== */
const T = 10;                                  // every plate on the sheet is 10T
const HB = { w: 340, h: 340 };                 // base plate            1 EA
const HB_OPEN = 122;                           // square opening in it
const HB_BOLT = { d: 22, gx: 220, gy: 220 };   // 4-D22, 60/220/60 both ways
const HSL = { w: 142, h: 220 };                // sloped haunch plate   3 EA
const HVT1 = { wb: 242, wt: 142, h: 200 };     // box face + flare      2 EA
const HVT2 = { wb: 100, h: 200 };              // haunch side gusset    4 EA
const HVT3 = { w: 122, h: 200 };               // box face              2 EA
const HADD1 = { w: 142, h: 50 };               // bracket shelf         2 EA
const HADD2 = { w: 100, h: 40 };               // bracket lip           2 EA
const MAT = 'SS275';                           // not on the drawing - assumed

/* ===================== inferred - the set-out ===================== */
const BOX = HVT1.wt;                 // 142 outside: HVT1's top edge is the box
const HT = HVT1.h;                   // 200 tall: HVT1 and HVT3 are both 200
const RUN = HVT1.wb - HVT1.wt;       // 100 of flare, and HVT2's base
const A = BOX / 2;                   // 71 - the box face, outside
const B = A - T;                     // 61 - the box face, inside
const TOE = A + RUN;                 // 171 - where a haunch lands (plate is 170)
const SLOPE = Math.sqrt(RUN * RUN + HT * HT);          // 223.6, and HSL is 220
const ANG = Math.atan2(RUN, HT) * 180 / Math.PI;       // 26.565 deg off vertical
/* HSL caps the gussets: its inner face lies on the line the gusset edges are
   cut to, so the two touch and nothing interferes. It is set from the toe
   rather than centred, so the plate rests on the base plate and the 3.6 it is
   short of the 223.6 slope all falls at the top, where the fillet closes it.
   The far corner of that toe then stands about 10 proud of the base plate
   edge: the drawing's 340 is the bolt gauge 60+220+60, and the haunch spread
   2x171 = 342 already fills it, so there is no room left for the skin's own
   thickness. A fabricator gives the plate 10 more or copes the toe. */
const NX = HT / SLOPE, NZ = RUN / SLOPE;      // unit normal, out of the slope
const UX = -RUN / SLOPE, UZ = HT / SLOPE;     // unit vector up the slope
const HSL_X = TOE + NX * (T / 2) + UX * (HSL.h / 2);
const HSL_Z = 0 + NZ * (T / 2) + UZ * (HSL.h / 2);
const Z_ADD_HI = 140, Z_ADD_LO = 60; // GUESS - the two shelves on the free face
const X_ADD = -(A + HADD1.h / 2);    // shelf centre, 50 out from the free face
const X_LIP = -(A + HADD1.h) + T / 2;   // lip, outer face flush with the shelf

const R = [];
const push = (...r) => R.push(r);
const blank = () => R.push([]);
const rd = v => Math.round(v * 10000) / 10000;
const HDR_MOD = ['# MODULE', 'id', 'member', 'Ref.Pt', 'L.X', 'L.Y', 'L.Z', 'PLANE',
                 'ROT.X', 'ROT.Y', 'ROT.Z'];
function M(mem, ref, x, y, z, pl, rx, ry, rz) {
  push('MODULE', 'md.hbase', mem, ref, rd(x), rd(y), rd(z), pl,
       rx === undefined ? '' : rd(rx), ry === undefined ? '' : rd(ry),
       rz === undefined ? '' : rd(rz));
}

/* ===================== parts - straight off the schedule ============ */
push('# PLATE', 'id', 'mat', 'thk', 'shape', 'base.pt', 'p1', 'p2', 'p3', 'p4');
push('PLATE', 'pl.hb', MAT, T, 'RECT', 'mc', HB.w, HB.h);
push('PLATE', 'pl.hsl', MAT, T, 'RECT', 'mc', HSL.w, HSL.h);
/* WB WT H OFF_T. OFF_T 0 -> the left edge is upright and the whole 100 of
   flare is on the right, which is how the plate is drawn. */
push('PLATE', 'pl.hvt1', MAT, T, 'TRAP', 'bl', HVT1.wb, HVT1.wt, HVT1.h, 0);
push('PLATE', 'pl.hvt2', MAT, T, 'TRAP', 'bl', HVT2.wb, 0, HVT2.h, 0);
push('PLATE', 'pl.hvt3', MAT, T, 'RECT', 'bl', HVT3.w, HVT3.h);
push('PLATE', 'pl.hadd1', MAT, T, 'RECT', 'mc', HADD1.w, HADD1.h);
push('PLATE', 'pl.hadd2', MAT, T, 'RECT', 'bc', HADD2.w, HADD2.h);
blank();

push('# HOLE', 'id', 'shape', 'base.pt', 'p1', 'p2');
push('HOLE', 'ho.open', 'RECT', 'mc', HB_OPEN, HB_OPEN);
push('HOLE', 'ho.d22', 'CIRC', 'mc', HB_BOLT.d);
blank();

/* ===================== cuts - all of them in the base plate ========= */
push('# CUT', 'plate', 'L.X', 'L.Y', 'shape', 'dx', 'dy', 'repeat',
     'dx2', 'dy2', 'repeat2');
push('CUT', 'pl.hb', 0, 0, 'ho.open');
/* one row, both directions: 60/220/60 across and the same down */
push('CUT', 'pl.hb', -HB_BOLT.gx / 2, -HB_BOLT.gy / 2, 'ho.d22',
     HB_BOLT.gx, 0, 1, 0, HB_BOLT.gy, 1);
blank();

/* ===================== the set =====================
   One module, because the schedule counts every piece EA/SET: the set is the
   thing. Everything below is written in one frame - base plate top face on
   z 0, box centred on the origin - and BASE names that face, so the ASSY row
   lands the model on the frame it was set out in. */

push.apply(null, HDR_MOD);
/* the base plate, its top face on z 0 */
M('pl.hb', 'mc', 0, 0, -T / 2, 'XY');
blank();

/* the box: 142 outside, 122 clear, standing over the opening.
   HVT1 faces +/-Y and carries its own flare out to +X.
   HVT3 faces +/-X and butts between them - 122 wide is exactly the gap. */
M('pl.hvt1_1', 'bl', -A, -(A - T / 2), 0, 'XZ');
M('pl.hvt1_2', 'bl', -A, A - T / 2, 0, 'XZ');
M('pl.hvt3_1', 'bl', -(A - T / 2), -B, 0, 'YZ');
M('pl.hvt3_2', 'bl', A - T / 2, -B, 0, 'YZ');
blank();

/* the four HVT2. HVT1's flare is the side wall of the +X haunch, so only the
   two Y haunches need loose gussets - two each, in the plane of HVT3 and
   carrying straight on out from it. ROT.Z 180 turns the pair that flares -Y. */
M('pl.hvt2_1', 'bl', A - T / 2, A, 0, 'YZ');
M('pl.hvt2_2', 'bl', -(A - T / 2), A, 0, 'YZ');
M('pl.hvt2_3', 'bl', A - T / 2, -A, 0, 'YZ', 0, 0, 180);
M('pl.hvt2_4', 'bl', -(A - T / 2), -A, 0, 'YZ', 0, 0, 180);
blank();

/* the three HSL, one over each haunch, laid on the sloped edges of the
   gussets below them and standing on the base plate.
   The clash check paints these six contacts red and is wrong about all six.
   A gusset and the skin over it meet at an angle, so the pair falls to the
   OBB approximation, and a triangle's OBB is twice the triangle - the empty
   half of each gusset's box is exactly where the skin lies. Pull the skin
   3 mm clear into open air and the same six bands come back, which is the
   proof: they are the case README.md warns about, not an interference. */
M('pl.hsl_1', 'mc', HSL_X, 0, HSL_Z, 'YZ', 0, -ANG, 0);
M('pl.hsl_2', 'mc', 0, HSL_X, HSL_Z, 'XZ', ANG, 0, 0);
M('pl.hsl_3', 'mc', 0, -HSL_X, HSL_Z, 'XZ', -ANG, 0, 0);
blank();

/* the free face, -X: two shelf-and-lip brackets. Levels are the guess. */
M('pl.hadd1_1', 'mc', X_ADD, 0, Z_ADD_HI, 'XY', 0, 0, 90);
M('pl.hadd1_2', 'mc', X_ADD, 0, Z_ADD_LO, 'XY', 0, 0, 90);
M('pl.hadd2_1', 'bc', X_LIP, 0, Z_ADD_HI + T / 2, 'YZ');
M('pl.hadd2_2', 'bc', X_LIP, 0, Z_ADD_LO + T / 2, 'YZ');
blank();

/* datum = the top face of the base plate, which is z 0 as written above -
   so ASSY ADD 0 0 0 leaves every plate exactly where it was set out. */
push('# MODULE', 'id', 'BASE', 'member', 'pt');
push('MODULE', 'md.hbase', 'BASE', 'pl.hb', 'mc+');
blank();

push('# ASSY', 'id', 'ref', 'cmd', 'G.X', 'G.Y', 'G.Z');
push('ASSY', 'as.hbase', 'md.hbase', 'ADD', 0, 0, 0);
push('END');

/* ===================== write ===================== */
(async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('input');
  const at = (kw, id) => R.findIndex(r => r[0] === kw && (id === undefined || r[1] === id));
  const notes = {};
  const put = (i, t) => { if (i >= 0) notes[i] = t; };
  put(0, 'HAUNCHED BOX BASE - every plate at its scheduled size, thickness and count');
  put(at('PLATE', 'pl.hb'), 'PL HB    10T  1 EA/SET  - 340x340, 122 sq opening, 4-D22');
  put(at('PLATE', 'pl.hsl'), 'PL HSL   10T  3 EA/SET  - 142x220, closes a haunch');
  put(at('PLATE', 'pl.hvt1'), 'PL HVT1  10T  2 EA/SET  - 242 -> 142 over 200, flare on one side');
  put(at('PLATE', 'pl.hvt2'), 'PL HVT2  10T  4 EA/SET  - 100x200 triangle, the same flare loose');
  put(at('PLATE', 'pl.hvt3'), 'PL HVT3  10T  2 EA/SET  - 122x200, butts between the HVT1');
  put(at('PLATE', 'pl.hadd1'), 'PL HADD1 10T  2 EA/SET  - 142x50');
  put(at('PLATE', 'pl.hadd2'), 'PL HADD2 10T  2 EA/SET  - 100x40');
  put(at('# HOLE'), 'the 122 square opening and the D22 anchor hole');
  put(at('# CUT'), 'both cuts are in the base plate - opening, then 4 anchors in one row');
  put(at('# ASSY'), 'one set, on the frame it was set out in');
  R.forEach((r, i) => ws.addRow(r.length ? [notes[i] || ''].concat(r) : []));
  ws.getColumn(1).width = 66;
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
  console.log('wrote ' + OUT + '  (' + R.length + ' rows)');
  console.log('box ' + BOX + ' sq outside, ' + (BOX - 2 * T) + ' clear, ' + HT + ' tall');
  console.log('haunch toe at ' + TOE + ' , base plate half-width ' + (HB.w / 2));
  console.log('slope ' + rd(SLOPE) + ' at ' + rd(ANG) + ' deg , HSL is ' + HSL.h);
})();
