// PLATE3D_CRANE.xlsx - a saddle-jib tower crane, after the reference photos.
//
// Everything that repeats is one module placed many times, and every sloping
// member is written as two end points rather than a pair of angles: a mast
// panel, a jib bay, a counter-jib bay, a tower head that leans in on all four
// sides. 48 m of jib and 47 m of height out of about a hundred written rows.
//
// Two rules kept the model honest and are worth stating:
//   - a module's BASE point is put on a member that sits at its local origin,
//     so the ASSY row reads as the place the thing goes and nothing drifts;
//   - bracing sits on its own plane, clear outside the chords, and every brace
//     is trimmed back with OFF - which is what stops the clash check lighting
//     up at every joint.
const ExcelJS = require('exceljs');
const { buildParam, Q } = require('./crane_param.js');
const OUT = process.argv[2] ||
  __dirname + '/../PLATE3D_TOWER.xlsx';

/* A cell that reads the PARAM sheet: the formula Excel recalculates, and the
   value it has right now - which is what PLATE3D reads when the file is opened
   without Excel having touched it. */
const q = (f, v) => ({ f: f, v: v });

/* ===================== dimensions ===================== */
const MW = 1600, MH = MW / 2;      // mast: 1600 square, chord heels on the corners
const MB = 2400, NM = 15;          // panel height, panel count
const Z0 = 1000;                   // mast foot, on top of the base frame
const MTOP = Z0 + MB * NM;         // 37000
const BR = MH + 50;                // 850 - bracing plane, clear outside the chords

const RINGT = 120;                 // slew bearing
const SLEWZ = MTOP + 60;           // 37060 - underside of the outer race
const DKT = SLEWZ + RINGT * 2 + 30; // 37390 - top face of the turntable deck
const MAINH = 700;                 // the two main beams that carry jib and tail

const JBAY = 3000, NJ = 15;        // jib
const JD = 1500, JY = 650;         // depth, half width
const JX0 = 1900;                  // root, from the slew centre
const JBC = DKT + MAINH + 110;      // 38200 - bottom chord, clear of the main beams
const JTZ = JBC + JD;              // 39700 - top of the top chords
const JEND = JX0 + JBAY * NJ;      // 46900
const JTIP = JEND + 1600;          // 48500 - jib radius

const CBAY = 2600, NC = 5;         // counter-jib
const CD = 1200, CY = 650;
const CX0 = -1900;
const CEND = CX0 - CBAY * NC;      // -14900

const HEADZ = DKT + 40;            // head legs start just clear of the deck plate
const APEX = 47000;                // top of the tower head legs
const PIN = APEX + 520;            // where the tie bars are pinned
const HW = 250;                    // half width at the apex
const HH = APEX - HEADZ;

const TRX = 30000;                 // where the trolley is parked
const TRZ = JTZ + 380;             // trolley frame, clear over the top ties
const PZ = JTZ + 560;              // the pendants run above the trolley
const HOOKZ = 14000;               // top of the hook block

const MBq   = () => q('=' + Q.MB, MB);
const JBAYq = () => q('=' + Q.JBAY, JBAY);
const CBAYq = () => q('=' + Q.CBAY, CBAY);
const HHq   = (k) => k === undefined ? q('=' + Q.HEAD, HH)
                                     : q('=' + Q.HEAD + '*' + k, HH * k);
const TIPq  = (k) => k === undefined ? q('=' + Q.TIP, JTIP - JEND)
                                     : q('=' + Q.TIP + '*' + k, (JTIP - JEND) * k);
const ANGq  = () => q('=' + Q.ANG, 0);
// slewed placement: the rotation of where the module used to sit
const CT = 1, ST = 0;                       // the sheet opens at 0 deg
function rotq(xf, xv, yf, yv) {
  yf = yf === undefined ? '0' : yf; yv = yv || 0;
  return [q('=(' + xf + ')*' + Q.CT + '-(' + yf + ')*' + Q.ST, xv * CT - yv * ST),
          q('=(' + xf + ')*' + Q.ST + '+(' + yf + ')*' + Q.CT, xv * ST + yv * CT)];
}
const R = [];
const push = (...r) => R.push(r);
const blank = () => R.push([]);
const rd = v => (v && typeof v === 'object') ? v : Math.round(v * 10) / 10;

/* row writers -------------------------------------------- */
const HDR_MOD = ['# MODULE', 'id', 'member', 'Ref.Pt', 'L.X', 'L.Y', 'L.Z',
                 'PLANE', 'ROT.X', 'ROT.Y', 'ROT.Z'];
const HDR_AX = ['# MODULE', 'id', 'member', 'Ref.Pt', 'LX1', 'LY1', 'LZ1',
                'LX2', 'LY2', 'LZ2', 'OFF_B', 'OFF_E', 'Alpha'];
let form = '';
// angle form: put this member's Ref.Pt at (x,y,z) and lay it on PLANE
function M(id, mem, ref, x, y, z, pl, rx, ry, rz) {
  if (form !== 'm') { push.apply(null, HDR_MOD); form = 'm'; }
  push('MODULE', id, mem, ref, rd(x), rd(y), rd(z), pl,
       rx === undefined ? '' : rx, ry === undefined ? '' : ry,
       rz === undefined ? '' : rz);
}
// coordinate form: stretch this bar/section from a to b, trimmed by ob/oe
function A(id, mem, a, b, ob, oe, al) {
  if (form !== 'a') { push.apply(null, HDR_AX); form = 'a'; }
  push('MODULE', id, mem, '', rd(a[0]), rd(a[1]), rd(a[2]),
       rd(b[0]), rd(b[1]), rd(b[2]), ob || '', oe || '', al || '');
}
function BASE(id, mem, pt) {
  if (form !== 'm') { push.apply(null, HDR_MOD); form = 'm'; }
  push('MODULE', id, 'BASE', mem, pt); form = '';
}

/* ===================== parts ===================== */
push('# SECT', 'id', 'mat', 'length', 'TYPE', 'base.pt',
     'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7');
push('SECT', 'sc.mch', 'SM490', MBq(), 'L', 'bl', 150, 150, 14, 14, 14, 7);
push('SECT', 'sc.jch', 'SM490', JBAYq(), 'L', 'bl', 120, 120, 12, 12, 12, 6);
push('SECT', 'sc.cch', 'SM490', CBAYq(), 'L', 'bl', 110, 110, 10, 10, 10, 5);
push('SECT', 'sc.hlg', 'SM490', 9500, 'L', 'bl', 130, 130, 12, 12, 12, 6);
push('SECT', 'sc.main', 'SM490', 4600, 'H', 'mc', 700, 300, 300, 14, 22, 22, 24);
push('SECT', 'sc.bfr', 'SM490', 4800, 'H', 'mc', 600, 250, 250, 12, 19, 19, 22);
push('SECT', 'sc.bcr', 'SM490', 1400, 'H', 'mc', 400, 200, 200, 9, 14, 14, 16);
blank();

push('# BAR', 'id', 'mat', 'dia', 'length');
push('BAR', 'bar.mh', 'SM490', 70, MW);        // mast panel horizontal
push('BAR', 'bar.md', 'SM490', 60, 2885);      // mast panel diagonal
push('BAR', 'bar.lst', 'SS275', 34, MBq());       // ladder stringer
push('BAR', 'bar.lrg', 'SS275', 22, 400);      // ladder rung
push('BAR', 'bar.strut', 'SM490', 130, 4300);  // splayed base strut
push('BAR', 'bar.anb', 'SS400', 48, 180);      // anchor bolt
push('BAR', 'bar.jbc', 'SM490', 100, JBAYq());    // jib bottom chord
push('BAR', 'bar.jth', 'SM490', 70, 1300);     // jib top tie
push('BAR', 'bar.jw', 'SM490', 60, 2200);      // jib web
push('BAR', 'bar.jpl', 'SM490', 55, 3300);     // jib plan brace
push('BAR', 'bar.cbc', 'SM490', 110, CBAYq());    // counter-jib bottom chord
push('BAR', 'bar.ch', 'SM490', 65, 1300);      // counter-jib tie
push('BAR', 'bar.cw', 'SM490', 60, 2000);      // counter-jib web
push('BAR', 'bar.ht', 'SM490', 70, 1600);      // tower head tie
push('BAR', 'bar.hd', 'SM490', 60, 2400);      // tower head diagonal
push('BAR', 'bar.pen', 'SS540', 70, 26000);    // pendant tie bar
push('BAR', 'bar.hang', 'SM490', 80, 800);     // counterweight hanger
push('BAR', 'bar.rope', 'SS275', 26, 26000);   // hoist rope
push('BAR', 'bar.rail', 'SS275', 34, 4800);    // handrail
push('BAR', 'bar.post', 'SS275', 40, 1050);    // handrail post
push('BAR', 'bar.shk', 'SM490', 150, 700);     // hook shank
push('BAR', 'bar.axle', 'SM490', 90, 900);     // trolley / sheave axle
push('BAR', 'bar.barrel', 'SM490', 420, 1300); // hoist drum barrel
blank();

push('# PLATE', 'id', 'mat', 'thk', 'shape', 'base.pt', 'p1', 'p2', 'p3', 'p4');
push('PLATE', 'pl.bped', 'SM490', 50, 'RECT', 'mc', 1900, 1900);    // mast pedestal
push('PLATE', 'pl.fpl', 'SM490', 60, 'RECT', 'mc', 900, 900);       // foot plate
push('PLATE', 'pl.ring', 'SM490', RINGT, 'CIRC', 'mc', 2400);       // slew ring
push('PLATE', 'pl.rinn', 'SM490', RINGT, 'CIRC', 'mc', 1900);       // inner race
push('PLATE', 'pl.dk', 'SM490', 30, 'RECT', 'mc', 3800, 2600);      // turntable deck
push('PLATE', 'pl.gbx', 'SM490', 350, 'RECT', 'mc', 650, 500);      // slew gearbox
push('PLATE', 'pl.hcap', 'SM490', 40, 'RECT', 'mc', 900, 900);      // apex cap
push('PLATE', 'pl.hear', 'SM490', 30, 'TRAP', 'bl', 1000, 320, 760, 340); // apex ear
push('PLATE', 'pl.pap', 'SM490', 40, 'RECT', 'mc', 900, 500);       // tie-bar pin plate
push('PLATE', 'pl.jrt', 'SM490', 25, 'TRAP', 'bl', 2050, 900, 1450, 0);   // jib root
push('PLATE', 'pl.crt', 'SM490', 25, 'TRAP', 'bl', 1750, 800, 1250, 0);   // c-jib root
push('PLATE', 'pl.cwt', 'SM490', 150, 'RECT', 'mc', 2100, 1500);    // counterweight
push('PLATE', 'pl.cwh', 'SM490', 30, 'RECT', 'mc', 1300, 900);      // cwt hanger
push('PLATE', 'pl.mdk', 'SM490', 10, 'RECT', 'mc', 5200, 2000);     // machinery deck
push('PLATE', 'pl.dfl', 'SM490', 50, 'CIRC', 'mc', 900);           // drum flange
push('PLATE', 'pl.mot', 'SM490', 380, 'RECT', 'mc', 650, 550);      // hoist motor
push('PLATE', 'pl.cabf', 'SS275', 6, 'RECT', 'mc', 1900, 2080);     // cab floor / roof
push('PLATE', 'pl.cabs', 'SS275', 6, 'RECT', 'mc', 1900, 2180);     // cab side
push('PLATE', 'pl.cabg', 'GLASS', 8, 'RECT', 'mc', 2080, 2180);     // cab glazing
push('PLATE', 'pl.tfr', 'SM490', 25, 'RECT', 'mc', 1400, 1600);     // trolley frame
push('PLATE', 'pl.twh', 'SM490', 90, 'CIRC', 'mc', 320);            // trolley wheel
push('PLATE', 'pl.hbk', 'SM490', 30, 'TRAP', 'bl', 1200, 700, 1000, 250); // hook cheek
push('PLATE', 'pl.shv', 'SM490', 50, 'CIRC', 'mc', 620);            // sheave
push('PLATE', 'pl.hk', 'SM490', 90, 'TRAP', 'bl', 900, 250, 1200, 325); // the hook
blank();

push('# HOLE', 'id', 'shape', 'base.pt', 'd');
push('HOLE', 'ho.race', 'CIRC', 'mc', 1700);
push('HOLE', 'ho.bore', 'CIRC', 'mc', 1500);
push('HOLE', 'ho.anb', 'CIRC', 'mc', 52);
push('HOLE', 'ho.axle', 'CIRC', 'mc', 95);
push('HOLE', 'ho.pin', 'CIRC', 'mc', 130);
blank();

push('# CUT', 'plate', 'L.X', 'L.Y', 'shape', 'dx', 'dy', 'repeat');
push('CUT', 'pl.ring', 0, 0, 'ho.race');       // a slew bearing is a ring
push('CUT', 'pl.rinn', 0, 0, 'ho.bore');
push('CUT', 'pl.fpl', -280, -280, 'ho.anb', 560, 0, 1);
push('CUT', 'pl.fpl', -280, 280, 'ho.anb', 560, 0, 1);
push('CUT', 'pl.twh', 0, 0, 'ho.axle');
push('CUT', 'pl.shv', 0, 0, 'ho.axle');
push('CUT', 'pl.hear', 760, 420, 'ho.pin');
push('CUT', 'pl.pap', 0, 0, 'ho.pin');
blank();

/* ===================== the mast panel ===================== */
// Four angle chords standing on the corners of a 1600 square, a ring of
// horizontals and one diagonal per face - all of it on the 850 plane, bolted
// flat to the outside of the chords the way a real mast panel is.
const CORN = [[-MH, -MH, 0], [MH, -MH, 90], [MH, MH, 180], [-MH, MH, 270]];
// A leaning member's section frame comes out turned 45 deg to the world axes,
// so the head legs need their own roll to keep the angle pointing inward.
const HROLL = [225, 225, 225, 225];
CORN.forEach((c, i) => A('md.mast', 'sc.mch_' + (i + 1),
                         [c[0], c[1], 0], [c[0], c[1], MBq()], 0, 0, c[2]));
const FACE = [
  { p: [[-MH, -BR, MBq()], [MH, -BR, MBq()]], d: [[-MH, -BR, 0], [MH, -BR, MBq()]] },
  { p: [[BR, -MH, MBq()], [BR, MH, MBq()]], d: [[BR, -MH, 0], [BR, MH, MBq()]] },
  { p: [[MH, BR, MBq()], [-MH, BR, MBq()]], d: [[MH, BR, 0], [-MH, BR, MBq()]] },
  { p: [[-BR, MH, MBq()], [-BR, -MH, MBq()]], d: [[-BR, MH, 0], [-BR, -MH, MBq()]] }
];
FACE.forEach((f, i) => A('md.mast', 'bar.mh_' + (i + 1), f.p[0], f.p[1]));
FACE.forEach((f, i) => A('md.mast', 'bar.md_' + (i + 1), f.d[0], f.d[1], 95, 95));
A('md.mast', 'bar.lst_1', [520, -220, 0], [520, -220, MBq()]);
A('md.mast', 'bar.lst_2', [520, 220, 0], [520, 220, MBq()]);
// the rungs sit at sixths of the panel, so they follow a panel of any height
[['/6', 400], ['/2', 1200], ['*5/6', 2000]].forEach((k, i) => {
  const z = q('=' + Q.MB + k[0], k[1]);
  A('md.mast', 'bar.lrg_' + (i + 1), [520, -220, z], [520, 220, z], 25, 25);
});
BASE('md.mast', 'sc.mch_1', 'bl');
blank();

/* ===================== the base ===================== */
// A square frame of H-600, four struts splayed up to the mast chords and a
// bolted foot plate on each corner. Local (0,0,0) is the mast foot: the
// pedestal sits just under it, which is what the BASE row points at.
const BX = 2400, BQ = BX / MH;
M('md.base', 'pl.bped', 'mc+', 0, 0, 0, 'XY');
// the two beams that run in X are continuous; the two in Y butt into them
A('md.base', 'sc.bfr_1', [-BX, -BX, -400], [BX, -BX, -400]);
A('md.base', 'sc.bfr_3', [-BX, BX, -400], [BX, BX, -400]);
A('md.base', 'sc.bfr_2', [BX, -BX, -400], [BX, BX, -400], 140, 140);
A('md.base', 'sc.bfr_4', [-BX, -BX, -400], [-BX, BX, -400], 140, 140);
[[1, 0], [0, 1], [-1, 0], [0, -1]].forEach((n, i) =>
  A('md.base', 'sc.bcr_' + (i + 1), [n[0] * 1000, n[1] * 1000, -400],
    [n[0] * BX, n[1] * BX, -400], 0, 140));
CORN.forEach((c, i) => A('md.base', 'bar.strut_' + (i + 1),
                         [c[0] * BQ, c[1] * BQ, 0], [c[0], c[1], q('=' + Q.MB + '*1.35', MB * 1.35)], 0, 350));
CORN.forEach((c, i) => M('md.base', 'pl.fpl_' + (i + 1), 'mc+',
                         c[0] * BQ, c[1] * BQ, -700, 'XY'));
CORN.forEach((c, i) => [[-280, -280], [280, -280], [-280, 280], [280, 280]].forEach((o, j) =>
  A('md.base', 'bar.anb_' + (i * 4 + j + 1),
    [c[0] * BQ + o[0], c[1] * BQ + o[1], -790], [c[0] * BQ + o[0], c[1] * BQ + o[1], -670])));
BASE('md.base', 'pl.bped', 'mc+');
blank();

/* ===================== slewing deck ===================== */
// Local z = 0 at the top of the mast. Both races are cut hollow, which is what
// a slew bearing is - and takes eight tonnes off the take-off.
M('md.slew', 'pl.ring', 'mc-', 0, 0, 0, 'XY');
M('md.slew', 'pl.rinn', 'mc-', 0, 0, RINGT, 'XY');
M('md.slew', 'pl.dk', 'mc-', 0, 0, RINGT * 2, 'XY');
const DZ = RINGT * 2 + 30;                       // top face of the deck plate
A('md.slew', 'sc.main_1', [-2300, -1150, DZ + MAINH / 2], [2300, -1150, DZ + MAINH / 2]);
A('md.slew', 'sc.main_2', [-2300, 1150, DZ + MAINH / 2], [2300, 1150, DZ + MAINH / 2]);
M('md.slew', 'pl.gbx', 'mc', -1500, 0, DZ + 320, 'XY');
BASE('md.slew', 'pl.ring', 'mc-');
blank();

/* ===================== tower head ===================== */
// Four legs leaning in from the deck to a 500 square at the apex - eight
// numbers each, and no sensible pair of angles for a member that leans two
// ways. The jib and counter-jib root brackets belong to the head, so they
// live here too and there is nothing left to line up by hand.
const HLEV = [0.28, 0.55, 0.80];
CORN.forEach((c, i) => A('md.head', 'sc.hlg_' + (i + 1), [c[0], c[1], 0],
                         [Math.sign(c[0]) * HW, Math.sign(c[1]) * HW, HHq()], 0, 0, HROLL[i]));
const HFACE = [
  { c: [[-1, -1], [1, -1]], n: [0, -1] }, { c: [[1, -1], [1, 1]], n: [1, 0] },
  { c: [[1, 1], [-1, 1]], n: [0, 1] }, { c: [[-1, 1], [-1, -1]], n: [-1, 0] }
];
// a ring point, pushed 60 outboard of the leg it passes
function hp(sx, sy, t, n) {
  const s = MH + (HW - MH) * t;
  return [sx * s + n[0] * 150, sy * s + n[1] * 150, HHq(t)];
}
let hn = 0, hd = 0;
HLEV.forEach(t => HFACE.forEach(f =>
  A('md.head', 'bar.ht_' + (++hn), hp(f.c[0][0], f.c[0][1], t, f.n),
    hp(f.c[1][0], f.c[1][1], t, f.n), 80, 80)));
[[0, HLEV[0], 90, 110], [HLEV[0], HLEV[1], 110, 110],
 [HLEV[1], HLEV[2], 110, 110], [HLEV[2], 1, 110, 90]].forEach(sg =>
  HFACE.forEach(f => A('md.head', 'bar.hd_' + (++hd),
                       hp(f.c[0][0], f.c[0][1], sg[0], f.n),
                       hp(f.c[1][0], f.c[1][1], sg[1], f.n), sg[2], sg[3])));
M('md.head', 'pl.hcap', 'mc-', 0, 0, q('=' + Q.HEAD + '+60', HH + 60), 'XY');
M('md.head', 'pl.hear_1', 'bl', -500, -220, q('=' + Q.HEAD + '+100', HH + 100), 'XZ');
M('md.head', 'pl.hear_2', 'bl', -500, 220, q('=' + Q.HEAD + '+100', HH + 100), 'XZ');
M('md.head', 'pl.jrt_1', 'bl', 150, -480, JBC - HEADZ + 50, 'XZ');
M('md.head', 'pl.jrt_2', 'bl', 150, 480, JBC - HEADZ + 50, 'XZ');
M('md.head', 'pl.crt_1', 'bl', -150, -480, JBC - HEADZ + 50, 'XZ', 0, 0, 180);
M('md.head', 'pl.crt_2', 'bl', -150, 480, JBC - HEADZ + 50, 'XZ', 0, 0, 180);
A('md.head', 'bar.axle_1', [1750, -410, JBC - HEADZ + 120], [1750, 410, JBC - HEADZ + 120]);
A('md.head', 'bar.axle_2', [-1600, -410, JBC - HEADZ + 120], [-1600, 410, JBC - HEADZ + 120]);
BASE('md.head', 'sc.hlg_1', 'bl');
blank();

/* ===================== jib bay ===================== */
// local z: 0 on the bottom chord, JD at the top of the top chords
const JHEEL = JD - 120;
A('md.jib', 'sc.jch_1', [0, JY, JHEEL], [JBAYq(), JY, JHEEL], 0, 0, 90);
A('md.jib', 'sc.jch_2', [0, -JY, JHEEL], [JBAYq(), -JY, JHEEL], 0, 0, 0);
A('md.jib', 'bar.jbc', [0, 0, 0], [JBAYq(), 0, 0]);
A('md.jib', 'bar.jth', [JBAYq(), -JY, JD + 55], [JBAYq(), JY, JD + 55]);
A('md.jib', 'bar.jw_1', [0, JY, JHEEL], [JBAYq(), 0, 0], 90, 200);
A('md.jib', 'bar.jw_2', [0, -JY, JHEEL], [JBAYq(), 0, 0], 90, 200);
A('md.jib', 'bar.jw_3', [JBAYq(), JY, JHEEL], [JBAYq(), 0, 0], 60, 110);
A('md.jib', 'bar.jw_4', [JBAYq(), -JY, JHEEL], [JBAYq(), 0, 0], 60, 110);
A('md.jib', 'bar.jpl', [0, JY, JD + 55], [JBAYq(), -JY, JD + 55], 130, 130);
BASE('md.jib', 'bar.jbc', 'mc');
blank();

/* jib tip: the bottom chord climbs to meet the top chords */
const TL = JTIP - JEND;
A('md.jtip', 'sc.jch_1', [0, JY, JHEEL], [TIPq(), 160, JHEEL], 90, 40, 90);
A('md.jtip', 'sc.jch_2', [0, -JY, JHEEL], [TIPq(), -160, JHEEL], 90, 40, 0);
A('md.jtip', 'bar.jbc', [0, 0, 0], [TIPq(), 0, JHEEL - 70], 0, 150);
A('md.jtip', 'bar.jw_1', [0, JY, JHEEL], [TIPq(0.55), 0, (JHEEL - 70) * 0.55], 90, 190);
A('md.jtip', 'bar.jw_2', [0, -JY, JHEEL], [TIPq(0.55), 0, (JHEEL - 70) * 0.55], 90, 190);
BASE('md.jtip', 'bar.jbc', 'mc');
blank();

/* ===================== counter-jib bay ===================== */
const CHEEL = CD - 110;
A('md.cjib', 'sc.cch_1', [0, CY, CHEEL], [CBAYq(), CY, CHEEL], 0, 0, 90);
A('md.cjib', 'sc.cch_2', [0, -CY, CHEEL], [CBAYq(), -CY, CHEEL], 0, 0, 0);
A('md.cjib', 'bar.cbc', [0, 0, 0], [CBAYq(), 0, 0]);
A('md.cjib', 'bar.ch', [CBAYq(), -CY, CD + 50], [CBAYq(), CY, CD + 50]);
A('md.cjib', 'bar.cw_1', [0, CY, CHEEL], [CBAYq(), 0, 0], 90, 280);
A('md.cjib', 'bar.cw_2', [0, -CY, CHEEL], [CBAYq(), 0, 0], 90, 280);
A('md.cjib', 'bar.cw_3', [CBAYq(), CY, CHEEL], [CBAYq(), 0, 0], 60, 110);
A('md.cjib', 'bar.cw_4', [CBAYq(), -CY, CHEEL], [CBAYq(), 0, 0], 60, 110);
BASE('md.cjib', 'bar.cbc', 'mc');
blank();

/* ===================== machinery deck ===================== */
// Local z = 0 is the deck plate, which lands on the counter-jib top chords.
M('md.mach', 'pl.mdk', 'mc+', 0, 0, 0, 'XY');
A('md.mach', 'bar.barrel', [-1370, 0, 620], [-130, 0, 620]);
M('md.mach', 'pl.dfl_1', 'mc', -1400, 0, 620, 'YZ');
M('md.mach', 'pl.dfl_2', 'mc', -100, 0, 620, 'YZ');
M('md.mach', 'pl.mot', 'mc', 900, 0, 360, 'YZ');
let mp = 0, mr = 0;
[-1, 1].forEach(s => {
  [-2400, -900, 700, 2200].forEach(x =>
    A('md.mach', 'bar.post_' + (++mp), [x, s * 950, 0], [x, s * 950, 1050]));
  A('md.mach', 'bar.rail_' + (++mr), [-2400, s * 995, 1020], [2200, s * 995, 1020]);
  A('md.mach', 'bar.rail_' + (++mr), [-2400, s * 995, 560], [2200, s * 995, 560]);
});
BASE('md.mach', 'pl.mdk', 'mc+');
blank();

/* ===================== counterweight ===================== */
// Local (0,0,0) is the centre of the first slab; the hangers reach up to the
// counter-jib bottom chord, so the ASSY row places the slab, not the bracket.
[0, 1, 2, 3, 4].forEach(i =>
  M('md.cwt', 'pl.cwt_' + (i + 1), 'mc', i * 180, 0, 0, 'YZ'));
M('md.cwt', 'pl.cwh_1', 'mc', 360, -790, 1240, 'XZ');
M('md.cwt', 'pl.cwh_2', 'mc', 360, 790, 1240, 'XZ');
[[-40, -880], [760, -880], [-40, 880], [760, 880]].forEach((o, i) =>
  A('md.cwt', 'bar.hang_' + (i + 1), [o[0], o[1], 790], [o[0], o[1], 1600]));
BASE('md.cwt', 'pl.cwt_1', 'mc');
blank();

/* ===================== operator cab ===================== */
M('md.cab', 'pl.cabf_1', 'mc', 0, 0, 0, 'XY');
M('md.cab', 'pl.cabf_2', 'mc', 0, 0, 2200, 'XY');
M('md.cab', 'pl.cabs_1', 'mc', 0, -1050, 1100, 'XZ');
M('md.cab', 'pl.cabs_2', 'mc', 0, 1050, 1100, 'XZ');
M('md.cab', 'pl.cabg_1', 'mc', 950, 0, 1100, 'YZ');
M('md.cab', 'pl.cabg_2', 'mc', -950, 0, 1100, 'YZ');
BASE('md.cab', 'pl.cabf_1', 'mc');
blank();

/* ===================== trolley, ropes, hook ===================== */
M('md.trly', 'pl.tfr', 'mc', 0, 0, 0, 'XY');
let tw = 0;
[-480, 480].forEach(x => [-720, 720].forEach(y =>
  M('md.trly', 'pl.twh_' + (++tw), 'mc', x, y, -200, 'XZ')));
A('md.trly', 'bar.axle_1', [-480, -800, -200], [-480, 800, -200]);
A('md.trly', 'bar.axle_2', [480, -800, -200], [480, 800, -200]);
BASE('md.trly', 'pl.tfr', 'mc');
blank();

// The hook block, and the four falls of rope back up to the trolley. The drop
// is the rope's length, so the rope is written as a coordinate too.
const DROP = TRZ - HOOKZ;
A('md.hook', 'bar.shk', [0, 0, 0], [0, 0, -700]);
M('md.hook', 'pl.hbk_1', 'bl', -600, -230, 20, 'XZ');
M('md.hook', 'pl.hbk_2', 'bl', -600, 230, 20, 'XZ');
[-150, 0, 150].forEach((y, i) =>
  M('md.hook', 'pl.shv_' + (i + 1), 'mc', 0, y, 520, 'XZ'));
A('md.hook', 'bar.axle', [0, -205, 520], [0, 205, 520]);
M('md.hook', 'pl.hk', 'bl', -450, 0, -1910, 'XZ');
[[-380, -75], [380, -75], [-380, 75], [380, 75]].forEach((o, i) =>
  A('md.hook', 'bar.rope_' + (i + 1), [o[0], o[1], 520],
    [o[0], o[1], q('=' + Q.DROP, DROP)], 300, 60));
BASE('md.hook', 'bar.shk', 'mc');
blank();

/* ===================== pendants ===================== */
// The tie bars are pinned at one plate at the top of the head, so that plate is
// the module origin and every bar below is the real geometry off the elevation.
// The hang points are fractions of the jib, not fixed radii, so the pendants
// follow a jib of any length. Both heights below the pin come out as a constant
// less the A-frame: the deck-to-jib distances above them do not move.
const PJ1 = 21400, PJ2 = 45400, PC1 = CEND + 1200;
const dz = t => t - PIN;
const PJ1q = () => q('=' + Q.JX0 + '+' + Q.JBAY + '*ROUND((' + Q.NJ + '-2)/2,0)', PJ1);
const PJ2q = () => q('=' + Q.JEND + '-1500', PJ2);
const PC1q = () => q('=' + Q.CEND + '+1200', PC1);
const DZJq = () => q('=2310-' + Q.HEAD, dz(PZ));
const DZCq = () => q('=1800-' + Q.HEAD, dz(JBC + CD + 350));
M('md.pend', 'pl.pap', 'mc', 0, 0, 0, 'XZ');
A('md.pend', 'bar.pen_1', [0, -130, 0], [PJ1q(), -JY, DZJq()], 150, 70);
A('md.pend', 'bar.pen_2', [0, 130, 0], [PJ1q(), JY, DZJq()], 150, 70);
A('md.pend', 'bar.pen_3', [PJ1q(), -JY, DZJq()], [PJ2q(), -JY, DZJq()]);
A('md.pend', 'bar.pen_4', [PJ1q(), JY, DZJq()], [PJ2q(), JY, DZJq()]);
A('md.pend', 'bar.pen_5', [0, -130, 0], [PC1q(), -CY, DZCq()], 150, 0);
A('md.pend', 'bar.pen_6', [0, 130, 0], [PC1q(), CY, DZCq()], 150, 0);
BASE('md.pend', 'pl.pap', 'mc');
blank();

/* ===================== assembly ===================== */
push('# ASSY', 'id', 'ref', 'cmd', 'G.X / d.X', 'G.Y', 'G.Z',
     'ROT.X / axis', 'ROT.Y / ang', 'ROT.Z / rep');
push('ASSY', 'as.base', 'md.base', 'ADD', 0, 0, q('=' + Q.Z0, Z0));
blank();
push('ASSY', 'as.mast', 'md.mast', 'ADD', -MH, -MH, q('=' + Q.Z0, Z0));
push('ASSY', 'as.mast', 'as.mast', 'COPY', 0, 0, MBq(), q('=' + Q.NM + '-1', NM - 1));
blank();
// everything from here up turns with the jib: the placement is the rotation of
// where it used to be, and each module carries the same angle as its own ROT.Z
push('ASSY', 'as.turn', 'md.slew', 'ADD', 0, 0,
     q('=' + Q.MTOP + '+60', SLEWZ), 0, 0, ANGq());
push('ASSY', 'as.turn', 'md.head', 'ADD', ...rotq('-800', -MH, '-800', -MH),
     q('=' + Q.MTOP + '+370', HEADZ), 0, 0, ANGq());
push('ASSY', 'as.turn', 'md.cab', 'ADD', ...rotq('2400', 2400),
     q('=' + Q.MTOP + '+330-2270', DKT - 2270), 0, 0, ANGq());
blank();
push('ASSY', 'as.jib', 'md.jib', 'ADD', ...rotq(Q.JX0, JX0),
     q('=' + Q.JBC, JBC), 0, 0, ANGq());
push('ASSY', 'as.jib', 'as.jib', 'COPY', ...rotq(Q.JBAY, JBAY), 0,
     q('=' + Q.NJ + '-1', NJ - 1));
push('ASSY', 'as.jib', 'md.jtip', 'ADD', ...rotq(Q.JEND + '+90', JEND + 90),
     q('=' + Q.JBC, JBC), 0, 0, ANGq());
blank();
push('ASSY', 'as.cjib', 'md.cjib', 'ADD', ...rotq('-' + Q.CX0, CX0),
     q('=' + Q.JBC, JBC), 0, 0, q('=180+' + Q.ANG, 180));
push('ASSY', 'as.cjib', 'as.cjib', 'COPY', ...rotq('-' + Q.CBAY, -CBAY), 0,
     q('=' + Q.NC + '-1', NC - 1));
push('ASSY', 'as.cjib', 'md.mach', 'ADD',
     ...rotq('(-' + Q.CX0 + '+' + Q.CEND + ')/2+600', -7800),
     q('=' + Q.JBC + '+1330', JBC + CD + 130), 0, 0, ANGq());
push('ASSY', 'as.cjib', 'md.cwt', 'ADD', ...rotq(Q.CEND + '+1000', CEND + 1000),
     q('=' + Q.JBC + '-1600', JBC - 1600), 0, 0, ANGq());
blank();
push('ASSY', 'as.tie', 'md.pend', 'ADD', 0, 0,
     q('=' + Q.APEX + '+520', PIN), 0, 0, ANGq());
blank();
// the trolley is held on the jib: past the end it would hang off nothing, and
// the PARAM sheet says so in its own words
const TRXq = () => 'MIN(' + Q.TRX + ',' + Q.JEND + '-1500)';
push('ASSY', 'as.hoist', 'md.trly', 'ADD', ...rotq(TRXq(), TRX),
     q('=' + Q.TRZ, TRZ), 0, 0, ANGq());
push('ASSY', 'as.hoist', 'md.hook', 'ADD', ...rotq(TRXq(), TRX),
     q('=' + Q.HOOK, HOOKZ), 0, 0, ANGq());
push('END');

/* ===================== write ===================== */
(async () => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PLATE3D';
  buildParam(wb);
  const ws = wb.addWorksheet('input');
  const at = (kw, id) => R.findIndex(r => r[0] === kw && (id === undefined || r[1] === id));
  const notes = {};
  const put = (i, t) => { if (i >= 0) notes[i] = t; };
  put(0, 'Saddle-jib tower crane. Every teal number is read from the PARAM tab - ' +
         'change it there, not here.');
  put(at('SECT', 'sc.mch'), 'mast chord. The length here is the panel; the coordinates rule');
  put(at('SECT', 'sc.hlg'), 'tower head leg - leans two ways, so it is written as two points');
  put(at('BAR', 'bar.jbc'), 'jib bottom chord');
  put(at('BAR', 'bar.pen'), 'pendant tie bar');
  put(at('PLATE', 'pl.cwt'), 'counterweight slab x5');
  put(at('# CUT'), 'a slew bearing is a ring, so it is cut like one');
  put(at('MODULE', 'md.mast'), 'ONE mast panel: 4 chords, 4 horizontals, 4 diagonals, ladder');
  put(at('MODULE', 'md.jib'), 'ONE jib bay - 3 chords and the web that ties them');
  put(at('# ASSY'), 'and now the whole crane');
  // a cell is either a plain value or {f, v}: the formula Excel will recalculate
  // and the value it holds right now, which is what PLATE3D reads
  const cel = x => (x && typeof x === 'object' && x.f !== undefined)
    ? { formula: x.f, result: x.v } : x;
  R.forEach((r, i) => ws.addRow(r.length ? [notes[i] || ''].concat(r.map(cel)) : []));
  ws.getColumn(1).width = 58;
  ws.getColumn(2).width = 11;
  ws.getColumn(3).width = 12;
  ws.getColumn(4).width = 12;
  for (let c = 5; c <= 17; c++) ws.getColumn(c).width = 9;
  ws.eachRow(row => row.eachCell({ includeEmpty: false }, cell => {
    const v = String(cell.value == null ? '' : cell.value);
    if (cell.col === 1) { cell.font = { italic: true, color: { argb: 'FF94A3B8' }, size: 10 }; return; }
    if (v.charAt(0) === '#') cell.font = { italic: true, color: { argb: 'FF64748B' }, size: 10 };
    else if (cell.col === 2) cell.font = { bold: true, color: { argb: 'FF1D4ED8' } };
    // a cell that reads the PARAM sheet is marked, so it is obvious at a glance
    // which numbers on this tab are decided somewhere else
    else if (cell.formula) cell.font = { color: { argb: 'FF0E7490' } };
  }));
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  wb.views = [{ activeTab: 0 }];
  await wb.xlsx.writeFile(OUT);
  console.log('wrote ' + OUT + '  (' + R.length + ' rows)');
})();
