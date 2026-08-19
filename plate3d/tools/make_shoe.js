/* PLATE3D_SHOE.xlsx - the embedded base / levelling shoe off the shop drawing.
 *
 * Two kinds of number went into this, and they are not equally certain.
 *
 * The PART SCHEDULE is exact. Every plate on the drawing is dimensioned and
 * counted, and every one of them is here at that size, that thickness and that
 * quantity - C1 100x300x10 twice, C2 120x300x10 twice, T1 350x300x8 once, and
 * so on down to the four D20 levelling bolts. Those are transcribed, not
 * guessed, and the sheet's PLATE block can be checked against the drawing line
 * by line.
 *
 * The ASSEMBLY is inferred. The drawing dimensions the pieces but not where
 * they meet: there are two small elevations and no overall sizes beyond a 240
 * across the end view. So the stack-up below is read off the elevations and the
 * 3D views - the box is 240 across because B1 is, 300 deep because S1's 290
 * plus B1's 10 comes to it, 280 tall because S1 is. Where the drawing is silent
 * the joint is made the way a fabricator would: plates flush at the outside,
 * butted not lapped, stiffeners on the centreline.
 *
 * Each inferred figure is one constant at the top with its reasoning next to
 * it. If the real detail differs, the fix is that constant and not the model.
 */
const ExcelJS = require('/tmp/claude-0/-home-user/2c32e469-0690-5fe7-bd2b-b7fdc61d0d9a/scratchpad/node_modules/exceljs');
const OUT = process.argv[2] ||
  '/tmp/claude-0/-home-user/2c32e469-0690-5fe7-bd2b-b7fdc61d0d9a/scratchpad/PLATE3D_SHOE.xlsx';

/* ===================== from the schedule - exact ===================== */
const C1 = { w: 100, h: 300, t: 10 };      // column web   2 EA
const C2 = { w: 120, h: 300, t: 10 };      // column flange 2 EA
const T1 = { w: 350, h: 300, t: 8 };       // levelling plate, 4 bolt holes
const F1 = { w: 240, h: 170, t: 10 };      // front upper, Ø30
const F2 = { w: 60, h: 300, t: 8 };        // front ledge
const F3 = { w: 240, h: 100, t: 8 };       // front lower
const S1 = { w: 290, h: 280, t: 8 };       // side, notch 50 x 110   2 EA
const B1 = { w: 240, h: 280, t: 10 };      // back, Ø30
const K1 = { w: 240, h: 220, t: 10 };      // stiffener
const K2 = { w: 290, h: 220, t: 10 };      // stiffener
const T2 = { w: 260, h: 240, t: 10 };      // base plate, 4 holes
const LV = { d: 20, len: 135 };            // levelling bolt D20 F10.8   4 EA

const NOTCH = { w: 50, h: 110 };           // S1's bottom corner
const D30 = 30;                            // the Ø30 through F1 and B1
const F1_HOLE = 30;                        // Ø30 up from F1's bottom edge
const B1_HOLE = 125;                       // Ø30 up from B1's bottom edge
const T1_BOLT = [90, 220, 40, 40, 220, 40];  // 350 across, 300 down
const T2_BOLT = [30, 200, 30, 30, 180, 30];  // 260 across, 240 down

/* ===================== inferred - the stack-up ===================== */
const BW = B1.w;                    // 240 across: the one overall size on the drawing
const BD = S1.w + B1.t;             // 300 deep: side plate plus the back it butts to
const BH = S1.h;                    // 280 tall: the side plate is the full height
const YB = B1.t / 2;                // back plate, outer face on y = 0
const XS = BW / 2 - S1.t / 2;       // sides flush with the 240 outside
const ZT2 = -T2.t / 2;              // base plate under the box
const YT2 = 5 + T2.h / 2;           // 240 deep, clear of the notched front corner
const YF1 = BD - F1.t / 2;          // front upper closes the box at the front face
const ZF1 = BH - F1.h / 2;          // ... hung from the top, 170 down
const YF3 = BD - NOTCH.w + F3.t / 2;   // front lower, set back into the notch
const ZF3 = F3.h / 2;               // ... standing on the base
const ZF2 = NOTCH.h + F2.t / 2;     // the ledge that roofs the notch
const MAT = 'SM490';

const R = [];
const push = (...r) => R.push(r);
const blank = () => R.push([]);
const rd = v => Math.round(v * 100) / 100;
const HDR_MOD = ['# MODULE', 'id', 'member', 'Ref.Pt', 'L.X', 'L.Y', 'L.Z', 'PLANE',
                 'ROT.X', 'ROT.Y', 'ROT.Z'];
const HDR_AX = ['# MODULE', 'id', 'member', 'Ref.Pt', 'LX1', 'LY1', 'LZ1',
                'LX2', 'LY2', 'LZ2', 'OFF_B', 'OFF_E', 'Alpha'];
let form = '';
function M(id, mem, ref, x, y, z, pl, rz) {
  if (form !== 'm') { push.apply(null, HDR_MOD); form = 'm'; }
  push('MODULE', id, mem, ref, rd(x), rd(y), rd(z), pl, '', '', rz === undefined ? '' : rz);
}
function A(id, mem, a, b) {
  if (form !== 'a') { push.apply(null, HDR_AX); form = 'a'; }
  push('MODULE', id, mem, '', rd(a[0]), rd(a[1]), rd(a[2]), rd(b[0]), rd(b[1]), rd(b[2]));
}
function BASE(id, mem, pt) {
  if (form !== 'm') { push.apply(null, HDR_MOD); form = 'm'; }
  push('MODULE', id, 'BASE', mem, pt); form = '';
}

/* ===================== parts ===================== */
push('# PLATE', 'id', 'mat', 'thk', 'shape', 'base.pt', 'p1', 'p2');
push('PLATE', 'pl.c1', MAT, C1.t, 'RECT', 'mc', C1.w, C1.h);
push('PLATE', 'pl.c2', MAT, C2.t, 'RECT', 'mc', C2.w, C2.h);
push('PLATE', 'pl.t1', MAT, T1.t, 'RECT', 'mc', T1.w, T1.h);
push('PLATE', 'pl.f1', MAT, F1.t, 'RECT', 'mc', F1.w, F1.h);
push('PLATE', 'pl.f2', MAT, F2.t, 'RECT', 'mc', F2.w, F2.h);
push('PLATE', 'pl.f3', MAT, F3.t, 'RECT', 'mc', F3.w, F3.h);
push('PLATE', 'pl.s1', MAT, S1.t, 'RECT', 'mc', S1.w, S1.h);
push('PLATE', 'pl.b1', MAT, B1.t, 'RECT', 'mc', B1.w, B1.h);
push('PLATE', 'pl.k1', MAT, K1.t, 'RECT', 'mc', K1.w, K1.h);
push('PLATE', 'pl.k2', MAT, K2.t, 'RECT', 'mc', K2.w, K2.h);
push('PLATE', 'pl.t2', MAT, T2.t, 'RECT', 'mc', T2.w, T2.h);
blank();

push('# BAR', 'id', 'mat', 'dia', 'length');
push('BAR', 'bar.lv', 'F10T', LV.d, LV.len);
blank();

push('# HOLE', 'id', 'shape', 'base.pt', 'p1', 'p2');
push('HOLE', 'ho.30', 'CIRC', 'mc', D30);
push('HOLE', 'ho.lv', 'CIRC', 'mc', LV.d + 2);
/* the notch is cut oversize so it leaves the plate edge cleanly instead of
   running exactly along it - a cut that is tangent to the outline is the one
   case the 2D booleans do not like */
push('HOLE', 'ho.notch', 'RECT', 'bl', NOTCH.w + 6, NOTCH.h + 6);
/* the two stiffeners cross on the centreline, so they are half-lapped: a slot
   the thickness of the other plate, half the depth, down one and up the other.
   That is how the pair is actually made, and it is the only way two plates can
   occupy one line without the clash check being right about them. */
push('HOLE', 'ho.lapk1', 'RECT', 'tc', K2.t + 1, K1.h / 2 + 5);
push('HOLE', 'ho.lapk2', 'RECT', 'bc', K1.t + 1, K2.h / 2 + 5);
blank();

/* ===================== cuts ===================== */
push('# CUT', 'plate', 'L.X', 'L.Y', 'shape');
push('CUT', 'pl.s1', -S1.w / 2 - 6, -S1.h / 2 - 6, 'ho.notch');   // front-bottom corner
push('CUT', 'pl.k1', 0, K1.h / 2 + 5, 'ho.lapk1');    // slot down from the top edge
push('CUT', 'pl.k2', 0, -K2.h / 2 - 5, 'ho.lapk2');   // slot up from the bottom edge
push('CUT', 'pl.f1', 0, -F1.h / 2 + F1_HOLE, 'ho.30');
push('CUT', 'pl.b1', 0, -B1.h / 2 + B1_HOLE, 'ho.30');
// T1's four levelling-bolt holes, and T2's four
for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
  push('CUT', 'pl.t1', sx * T1_BOLT[1] / 2 + (T1.w / 2 - T1_BOLT[0] - T1_BOLT[1] / 2),
       sy * T1_BOLT[4] / 2, 'ho.lv');
  push('CUT', 'pl.t2', sx * T2_BOLT[1] / 2, sy * T2_BOLT[4] / 2, 'ho.lv');
}
blank();

/* ===================== the box =====================
   No BASE row on any of the three modules. Every member below is written in
   one absolute frame - back face at y 0, underside of the box at z 0 - so the
   module origin IS that frame, and ASSY ADD 0 0 0 leaves it where it was
   written. Naming a BASE member here would drag each module by wherever that
   member happens to sit. */
/* Plate normals: XZ faces the back and front (normal Y), YZ the two sides
   (normal X), XY the horizontal plates (normal Z). The box is set out from its
   back face, so y runs 0 at the back to 300 at the front. */
M('md.shoe', 'pl.b1', 'mc', 0, YB, BH / 2, 'XZ');
M('md.shoe', 'pl.s1_1', 'mc', XS, B1.t + S1.w / 2, BH / 2, 'YZ');
M('md.shoe', 'pl.s1_2', 'mc', -XS, B1.t + S1.w / 2, BH / 2, 'YZ');
M('md.shoe', 'pl.t2', 'mc', 0, YT2, ZT2, 'XY');
M('md.shoe', 'pl.f1', 'mc', 0, YF1, ZF1, 'XZ');
M('md.shoe', 'pl.f3', 'mc', 0, YF3, ZF3, 'XZ');
M('md.shoe', 'pl.f2', 'mc', 0, BD - F2.w / 2, ZF2, 'XY', 90);   // 300 across, 60 deep
/* the two stiffeners, on the centreline of the box: K2 runs the depth, K1 the
   width, so the levelling plate above is carried both ways */
M('md.shoe', 'pl.k2', 'mc', 0, B1.t + K2.w / 2, BH - K2.h / 2, 'YZ');
M('md.shoe', 'pl.k1', 'mc', 0, BD / 2, BH - K1.h / 2, 'XZ');
/* the levelling plate caps the box, and the column stands on it */
M('md.shoe', 'pl.t1', 'mc', 0, T1.h / 2 - 10, BH + T1.t / 2, 'XY', 90);
blank();

/* ===================== the column, 120 x 120 box ===================== */
const CZ = BH + T1.t + C1.h / 2;
const CY = T1.h / 2 - 10;                   // on the levelling plate's centre
M('md.shoe', 'pl.c2_1', 'mc', 0, CY + (C1.w + C2.t) / 2, CZ, 'XZ');
M('md.shoe', 'pl.c2_2', 'mc', 0, CY - (C1.w + C2.t) / 2, CZ, 'XZ');
M('md.shoe', 'pl.c1_1', 'mc', (C2.w - C1.t) / 2, CY, CZ, 'YZ');
M('md.shoe', 'pl.c1_2', 'mc', -(C2.w - C1.t) / 2, CY, CZ, 'YZ');
blank();

/* ===================== the four levelling bolts ===================== */
/* The 220 gauge falls inside the 240 box, so a bolt run down into it would go
   straight through a side plate. It threads the levelling plate and stops:
   from the plate's underside up, through its own clearance hole. */
const BX = T1_BOLT[1] / 2, BY = T1_BOLT[4] / 2;
let n = 0;
for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
  A('md.shoe', 'bar.lv_' + (++n),
    [sx * BX, CY + sy * BY, BH],
    [sx * BX, CY + sy * BY, BH + LV.len]);
}
blank();

/* ===================== assembly =====================
   One module, because the drawing counts every piece EA/SET: the set is the
   thing. Its datum is the base plate's centre, and the ASSY row puts that
   datum back where the base plate was written - so the model lands exactly on
   the frame the members were set out in. */
BASE('md.shoe', 'pl.t2', 'mc');
blank();
push('# ASSY', 'id', 'ref', 'cmd', 'G.X', 'G.Y', 'G.Z');
push('ASSY', 'as.shoe', 'md.shoe', 'ADD', 0, rd(YT2), rd(ZT2));
push('END');

/* ===================== write ===================== */
(async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('input');
  const at = (kw, id) => R.findIndex(r => r[0] === kw && (id === undefined || r[1] === id));
  const notes = {};
  const put = (i, t) => { if (i >= 0) notes[i] = t; };
  put(0, 'EMBEDDED BASE / LEVELLING SHOE - every plate at its scheduled size, thickness and count');
  put(at('PLATE', 'pl.c1'), 'PL C1 10T  2 EA/SET');
  put(at('PLATE', 'pl.c2'), 'PL C2 10T  2 EA/SET');
  put(at('PLATE', 'pl.t1'), 'PL T1 8T   1 EA/SET  - 4 levelling-bolt holes');
  put(at('PLATE', 'pl.s1'), 'PL S1 8T   2 EA/SET  - notched 50 x 110');
  put(at('PLATE', 'pl.t2'), 'PL T2 10T  1 EA/SET  - 4 holes');
  put(at('BAR', 'bar.lv'), 'LEVELLING BOLT D20 F10.8  4 EA/SET');
  put(at('# CUT'), 'the notch, the two Ø30, and the eight bolt holes');
  put(at('# ASSY'), 'box + column + bolts');
  R.forEach((r, i) => ws.addRow(r.length ? [notes[i] || ''].concat(r) : []));
  ws.getColumn(1).width = 66;
  ws.getColumn(2).width = 11;
  ws.getColumn(3).width = 11;
  ws.getColumn(4).width = 10;
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
  console.log('box ' + BW + ' x ' + BD + ' x ' + BH + ' , column ' + C2.w + ' x ' +
              (C1.w + 2 * C2.t) + ' x ' + C1.h);
})();
