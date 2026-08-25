/* PLATE3D_HINGE.xlsx - DEVICE (HINGE), the girder-bottom hinge device.
 *
 * The PART SCHEDULE is exact. All ten plates are here at their scheduled size,
 * thickness and count - DEVBS 830x220x15 once, OUTFL 220x340x15 twice, WEB
 * 100x340x10 four times, GHSP1 four, GHSL three, down to the single GHADD.
 * Those are transcribed and can be checked line by line.
 *
 * The ASSEMBLY is inferred, and it is inferred unevenly. Three things the
 * drawing does fix, and they are the spine of the model:
 *
 *   830 = 195 + 440 + 195   OUTFL is 220 wide and the plate is 830, so an end
 *                           box whose outer edge is the plate end runs in to
 *                           415 - 220 = 195. The chain on the elevation is the
 *                           end boxes, and the 440 between them is the hinge.
 *   340                     OUTFL, INNFL and WEB all share it. That is the
 *                           projection: the end boxes stand 340 off the back
 *                           plate, flanges top and bottom, two webs between.
 *   140                     GHADD is 140 long and the notch in the bottom of
 *                           DEVBS is 140 wide. It closes that notch.
 *
 * The hinge itself (GHSL, GHSP1, GHSP2) and the camera bracket (HCAW, HCAS)
 * are the weak half. The elevation shows two members leaning in towards the
 * centre and the schedule counts 2 GHSP2, 4 GHSP1 and 3 GHSL, so each leaning
 * member gets one web, two gussets and one face plate, and the third GHSL sits
 * on the centreline between them. The lean angle is taken from GHSP2's own
 * bottom cut - 47 over 93 is 26.8 deg, which is the angle a plate leaning that
 * much needs if its foot is to sit flat. That is a derivation, not a reading,
 * and LEAN below is the one constant to change if it is wrong.
 *
 * Outlines read off a small drawing, each isolated so a correction is one line:
 *   DEVBS   830x220 with the 140x40 notch and four D22. The stepped top edge
 *           on the drawing is NOT modelled - it could not be read.
 *   GHSP2   pentagon: 125 wide, 232 up the left, 186 up the right, 32 of flat
 *           bottom, then the 47 rise. 232 - 186 = 46 ~ 47 closes it, so this
 *           one is checked by its own numbers.
 *   GHSP1   trapezoid 95 across the top, 15 across the bottom, 160 high.
 *   HCAS    375 tall, 88 across the top with a 20 offset, two D22 on the
 *           143/150/83 chain. The least certain outline of the ten.
 *   GHADD   140x50 flat. Detail A-A's R10 nose is NOT modelled.
 */
const ExcelJS = require('/tmp/claude-0/-home-user/6cdc702a-24df-51eb-b9d9-9f399d189def/scratchpad/node_modules/exceljs');
const OUT = process.argv[2] ||
  '/tmp/claude-0/-home-user/6cdc702a-24df-51eb-b9d9-9f399d189def/scratchpad/PLATE3D_HINGE.xlsx';

/* ===================== from the schedule - exact ===================== */
const DEVBS = { w: 830, h: 220, t: 15 };        // back plate            1 EA
const NOTCH = { w: 140, h: 40 };                // in its bottom edge
const DEV_BOLT = { d: 22, x: 40, z1: 70, z2: 150 };  // 4-D22, from the ends/top
const CAW = { w: 285, h: 194, t: 10 };          // camera wall plate     1 EA
const CAS = { w: 88, h: 375, t: 10, off: 20 };  // camera support        2 EA
const CAS_BOLT = { d: 22, z1: 83, z2: 232 };    // on the 143/150/83 chain
const OUTFL = { w: 220, h: 340, t: 15 };        // outer flange          2 EA
const INNFL = { w: 160, h: 340, t: 15 };        // inner flange          2 EA
const WEB = { w: 100, h: 340, t: 10 };          // web                   4 EA
const GHSL = { w: 140, h: 220, t: 15 };         // hinge face plate      3 EA
const GHSP1 = { wt: 95, wb: 15, h: 160, t: 10 };   // hinge gusset       4 EA
const GHSP2 = { w: 125, hl: 232, hr: 186, tab: 32, t: 10 };  // hinge web 2 EA
const GHADD = { w: 140, h: 50, t: 15 };         // notch closer          1 EA
const MAT15 = 'SM490', MAT10 = 'SM490';         // not on the drawing - assumed

/* ===================== inferred - the set-out ===================== */
const HW = DEVBS.w / 2;                 // 415 - the back plate's half length
const END_IN = HW - OUTFL.w;            // 195 - where an end box stops
const XC = HW - OUTFL.w / 2;            // 305 - an end box's centre
const DEEP = OUTFL.h;                   // 340 - how far everything projects
const Z_BOT = OUTFL.t / 2;              // bottom flange, on z 0
const Z_TOP = OUTFL.t + WEB.w + INNFL.t / 2;    // top flange, over the webs
const Z_WEB = OUTFL.t + WEB.w / 2;              // webs, between them
const X_WEB = INNFL.w / 2 - WEB.t / 2;  // webs under the top flange's edges
const RISE = GHSP2.hl - GHSP2.hr;       // 46 - GHSP2's own bottom cut
const RUN = GHSP2.w - GHSP2.tab;        // 93 - ... over this
const LEAN = Math.atan2(RISE, RUN) * 180 / Math.PI;   // 26.3 deg - the lean
const X_HIN = 220;                      // GUESS - the hinge members' feet
const Y_HIN = DEEP / 2;                 // GUESS - and their depth

const R = [];
const push = (...r) => R.push(r);
const blank = () => R.push([]);
const rd = v => Math.round(v * 10000) / 10000;
const HDR_MOD = ['# MODULE', 'id', 'member', 'Ref.Pt', 'L.X', 'L.Y', 'L.Z', 'PLANE',
                 'ROT.X', 'ROT.Y', 'ROT.Z'];
function M(mem, ref, x, y, z, pl, rx, ry, rz) {
  push('MODULE', 'md.hinge', mem, ref, rd(x), rd(y), rd(z), pl,
       rx === undefined ? '' : rd(rx), ry === undefined ? '' : rd(ry),
       rz === undefined ? '' : rd(rz));
}

/* ===================== parts ===================== */
push('# PLATE', 'id', 'mat', 'thk', 'shape', 'base.pt', 'p1', 'p2', 'p3', 'p4');
push('PLATE', 'pl.devbs', MAT15, DEVBS.t, 'RECT', 'mc', DEVBS.w, DEVBS.h);
push('PLATE', 'pl.caw', MAT10, CAW.t, 'RECT', 'mc', CAW.w, CAW.h);
/* the sloped side is read as running the full height - see the header note */
push('PLATE', 'pl.cas', MAT10, CAS.t, 'TRAP', 'bl', CAS.w, CAS.w - CAS.off,
     CAS.h, CAS.off);
push('PLATE', 'pl.outfl', MAT15, OUTFL.t, 'RECT', 'mc', OUTFL.w, OUTFL.h);
push('PLATE', 'pl.innfl', MAT15, INNFL.t, 'RECT', 'mc', INNFL.w, INNFL.h);
push('PLATE', 'pl.web', MAT10, WEB.t, 'RECT', 'mc', WEB.w, WEB.h);
push('PLATE', 'pl.ghsl', MAT15, GHSL.t, 'RECT', 'mc', GHSL.w, GHSL.h);
push('PLATE', 'pl.ghsp1', MAT10, GHSP1.t, 'TRAP', 'bl', GHSP1.wb, GHSP1.wt,
     GHSP1.h, 0);
push('PLATE', 'pl.ghsp2', MAT10, GHSP2.t, 'RECT', 'bl', GHSP2.w, GHSP2.hl);
push('PLATE', 'pl.ghadd', MAT15, GHADD.t, 'RECT', 'mc', GHADD.w, GHADD.h);
blank();

push('# HOLE', 'id', 'shape', 'base.pt', 'p1', 'p2', 'p3', 'p4');
push('HOLE', 'ho.d22', 'CIRC', 'mc', DEV_BOLT.d);
/* cut oversize so the notch leaves the plate edge cleanly - a cut tangent to
   the outline is the one case the 2D booleans do not like */
push('HOLE', 'ho.notch', 'RECT', 'bc', NOTCH.w, NOTCH.h + 12);
/* GHSP2's bottom-right corner. The triangle is scaled up along its own
   hypotenuse so it starts and ends outside the plate, same reason. */
const E = 10, EX = RUN * E / RISE;
push('HOLE', 'ho.ghcut', 'TRAP', 'bl', rd(RUN + EX + E), 0,
     rd(RISE + E + RISE * E / RUN), rd(RUN + EX + E));
blank();

push('# CUT', 'plate', 'L.X', 'L.Y', 'shape', 'dx', 'dy', 'repeat',
     'dx2', 'dy2', 'repeat2');
push('CUT', 'pl.devbs', 0, -DEVBS.h / 2 - 6, 'ho.notch');
push('CUT', 'pl.devbs', -(HW - DEV_BOLT.x), DEVBS.h / 2 - DEV_BOLT.z2, 'ho.d22',
     2 * (HW - DEV_BOLT.x), 0, 1, 0, DEV_BOLT.z2 - DEV_BOLT.z1, 1);
push('CUT', 'pl.ghsp2', rd(GHSP2.tab - EX), -E, 'ho.ghcut');
push('CUT', 'pl.cas', CAS.w / 2 - CAS.off, CAS_BOLT.z1, 'ho.d22',
     0, CAS_BOLT.z2 - CAS_BOLT.z1, 1);
blank();

/* ===================== the device =====================
   One frame: the back plate's front face on y 0, its bottom edge on z 0, its
   centre on x 0. Everything projects into +y. */
push.apply(null, HDR_MOD);
M('pl.devbs', 'mc', 0, -DEVBS.t / 2, DEVBS.h / 2, 'XZ');
blank();

/* the two end boxes - flanges top and bottom, two webs between, all 340 out */
for (const s of [-1, 1]) {
  const n = s < 0 ? '_1' : '_2';
  M('pl.outfl' + n, 'mc', s * XC, DEEP / 2, Z_BOT, 'XY');
  M('pl.innfl' + n, 'mc', s * XC, DEEP / 2, Z_TOP, 'XY');
  M('pl.web' + (s < 0 ? '_1' : '_3'), 'mc', s * XC - X_WEB, DEEP / 2, Z_WEB, 'YZ', -90);
  M('pl.web' + (s < 0 ? '_2' : '_4'), 'mc', s * XC + X_WEB, DEEP / 2, Z_WEB, 'YZ', -90);
}
blank();

/* the hinge: two members leaning in from x +/-220, each a GHSP2 web with two
   GHSP1 gussets and a GHSL face; the third GHSL on the centreline */
for (const s of [-1, 1]) {
  const n = s < 0 ? '_1' : '_2';
  M('pl.ghsp2' + n, 'bl', s * X_HIN, Y_HIN - GHSP2.t / 2, 0, 'XZ', 0, s * LEAN, 0);
  M('pl.ghsp1' + (s < 0 ? '_1' : '_3'), 'bl', s * X_HIN, Y_HIN - GHSP1.t / 2 - 60,
    0, 'XZ', 0, s * LEAN, 0);
  M('pl.ghsp1' + (s < 0 ? '_2' : '_4'), 'bl', s * X_HIN, Y_HIN - GHSP1.t / 2 + 60,
    0, 'XZ', 0, s * LEAN, 0);
  M('pl.ghsl' + n, 'mc', s * (X_HIN - 70), Y_HIN, GHSL.h / 2, 'YZ', 0, s * LEAN, 0);
}
M('pl.ghsl_3', 'mc', 0, Y_HIN, GHSL.h / 2, 'YZ');
blank();

/* GHADD closes the 140 notch in the bottom of the back plate */
M('pl.ghadd', 'mc', 0, GHADD.h / 2, NOTCH.h - GHADD.t / 2, 'XY');
blank();

/* the camera bracket, off the +x end: the wall plate and its two supports */
const X_CAW = HW + CAS.h / 2;
M('pl.caw', 'mc', X_CAW, DEEP / 2, CAW.h / 2, 'XZ');
M('pl.cas_1', 'bl', HW, DEEP / 2 - CAW.w / 2 + CAS.t / 2, 0, 'XZ', 0, 0, 0);
M('pl.cas_2', 'bl', HW, DEEP / 2 + CAW.w / 2 - CAS.t / 2, 0, 'XZ', 0, 0, 0);
blank();

push('# MODULE', 'id', 'BASE', 'member', 'pt');
push('MODULE', 'md.hinge', 'BASE', 'pl.devbs', 'mc');
blank();
push('# ASSY', 'id', 'ref', 'cmd', 'G.X', 'G.Y', 'G.Z');
push('ASSY', 'as.hinge', 'md.hinge', 'ADD', 0, rd(-DEVBS.t / 2), rd(DEVBS.h / 2));
push('END');

/* ===================== write ===================== */
(async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('input');
  const at = (kw, id) => R.findIndex(r => r[0] === kw && (id === undefined || r[1] === id));
  const notes = {};
  const put = (i, t) => { if (i >= 0) notes[i] = t; };
  put(0, 'DEVICE (HINGE) - every plate at its scheduled size, thickness and count');
  put(at('PLATE', 'pl.devbs'), 'PL HDEVBS 15T 1 EA/SET - 830x220, 140x40 notch, 4-D22');
  put(at('PLATE', 'pl.caw'), 'PL HCAW   10T 1 EA/SET - 285x194');
  put(at('PLATE', 'pl.cas'), 'PL HCAS   10T 2 EA/SET - 375 tall, 88 top, 20 offset');
  put(at('PLATE', 'pl.outfl'), 'PL OUTFL  15T 2 EA/SET - 220x340');
  put(at('PLATE', 'pl.innfl'), 'PL INNFL  15T 2 EA/SET - 160x340');
  put(at('PLATE', 'pl.web'), 'PL WEB    10T 4 EA/SET - 100x340');
  put(at('PLATE', 'pl.ghsl'), 'PL GHSL   15T 3 EA/SET - 140x220');
  put(at('PLATE', 'pl.ghsp1'), 'PL GHSP1  10T 4 EA/SET - 95 top, 15 bottom, 160 high');
  put(at('PLATE', 'pl.ghsp2'), 'PL GHSP2  10T 2 EA/SET - 125 wide, 232 / 186, 32 tab');
  put(at('PLATE', 'pl.ghadd'), 'PL GHADD  15T 1 EA/SET - 140x50, closes the notch');
  put(at('# CUT'), 'the notch, 4-D22 in the back plate, GHSP2 corner, 2-D22 in HCAS');
  put(at('# ASSY'), 'one set, on the frame it was set out in');
  R.forEach((r, i) => ws.addRow(r.length ? [notes[i] || ''].concat(r) : []));
  ws.getColumn(1).width = 64;
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
  console.log('back plate ' + DEVBS.w + 'x' + DEVBS.h + ' , end boxes at +/-' + XC +
              ' , projection ' + DEEP);
  console.log('hinge lean ' + rd(LEAN) + ' deg, from GHSP2\'s own ' + RISE + '/' + RUN);
})();
