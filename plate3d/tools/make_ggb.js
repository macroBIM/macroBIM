// PLATE3D_GGB.xlsx - the Golden Gate Bridge, at full size, in mm.
//
// The published figures are the input and nothing here is drawn to taste:
// 4200 ft between the towers, 1125 ft each side span, 746 ft of tower above
// the water, 500 ft of tower above the roadway, 220 ft of clearance under it,
// a 25 ft stiffening truss, suspenders every 50 ft and a 36-3/8 in cable.
// Five things get built and no more - towers, cables, stiffening truss, floor
// system, deck - which is what makes it readable as a sheet, and each of them is
// its own ASSY so the list on the left reads the way the bridge is talked about.
//
// Three decisions carry the model:
//   - the parabola is arithmetic, not shape. Every cable node is z = ZCL + a x^2
//     with a from the sag, so the 128 straight bars per cable are the curve
//     rather than an impression of it;
//   - a module is one plane of the bridge and ASSY puts it on both sides. The
//     cable, the truss and the tower are each written once for y = 0 and
//     placed at y = +/-13716, so half the bridge cannot drift from the other;
//   - the truss stops at the face of the tower leg rather than running through
//     it. The leg is where the truss is carried, and a chord written through
//     the middle of it would be steel that shares steel.
const ExcelJS = require('exceljs');
const OUT = process.argv[2] || __dirname + '/../PLATE3D_GGB.xlsx';

/* ===================== the published figures ===================== */
const FT = 304.8;
const MAIN = 4200 * FT;                 // 1280160 - main span, tower to tower
const SIDE = 1125 * FT;                 //  342900 - one side span
const TX = MAIN / 2;                    //  640080 - tower centre from mid-span
const XA = TX + SIDE;                   //  982980 - the anchorage
const CY = 45 * FT;                     //   13716 - cable, truss and leg, off centre
const TOPZ = 746 * FT;                  //  227400 - tower top over the water

const ZBOT = 220 * FT;                  //   67056 - clearance, under the truss
const TRUSS = 25 * FT;                  //    7620 - stiffening truss, out to out
const HCHD = 1200;                      // chord depth, so the chord centres sit in
const ZBC = ZBOT + HCHD / 2;            //   67656   from the outside faces
const ZTOPF = ZBOT + TRUSS;             //   74676 - top of the top chord: the deck bears here
const ZTC = ZTOPF - HCHD / 2;           //   74076
const HFB = 1500, ZFB = ZTOPF - HFB / 2;   // floor beams, hung inside the truss depth
const ZI0 = ZBC + HCHD / 2 + 10, ZI1 = ZTC - HCHD / 2 - 10;  // posts: between the chord faces
const ZD0 = ZBC + HCHD / 2 + 400, ZD1 = ZTC - HCHD / 2 - 400;  // diagonals: and clear of them
const DGX = 600;                        // and clear of the post at the panel point
const FBI = 500;                        // floor beams stop inside the posts, not the chords
const DKJ = 20;                         // a deck bay is its bay less a joint
const HSG = 700, ZSG = ZTOPF - HSG / 2;    // stringers, flush with the top chord
const TDK = 30, ZDK = ZTOPF + TDK / 2;     // the deck plate lies on top of it
// 227400 - 74706 = 152694 = 501 ft of tower above the roadway. The three
// published heights agree to a foot once the truss is 25 ft out to out.

const PM = 50 * FT;                     //   15240 - suspenders at 50 ft
const NM = Math.round(MAIN / PM);       //      84 - and the main span is exactly 84 of them
const NS = 22, PS = SIDE / NS;          // 15586.4 - the side span does not divide by 50 ft
const TW = 90 * FT;                     //   27432 - out to out of the two trusses
const DKW = TW - 632;                   //   26800 - the deck lies BETWEEN them, which is
                                        //   what leaves the suspenders outside its edge
const DKN = 17700;                      // and what is left between the legs at the tower

const ZSAD = TOPZ - 460;                // 226940 - the cable crown IS the tower top
const ZCL = 82000;                      // and at the low point, clear over the truss
const SAG = ZSAD - ZCL;                 //  144860 = 475 ft
const AP = SAG / (TX * TX);             // z = ZCL + AP x^2
const ZEND = 92000;                     // cable at the end of the suspended side span
const ZANC = 45000;                     // and where it enters the anchorage, past it
// The side span carries the same deck, so it is the same parabola, tipped to
// land on ZEND. It has to end ABOVE the deck: a cable that dips under the truss
// leaves the last suspenders hanging upwards, which is a model that draws and
// is wrong. Past the side span the cable is a free backstay - straight, on the
// slope it already had - down to the anchorage.
const KS = (ZSAD - ZEND + AP * SIDE * SIDE) / SIDE;
const SLOPE = KS - 2 * AP * SIDE;       // 0.272 down, at the end of the side span
const TAIL = (ZEND - ZANC) / SLOPE;     // 172763 - the backstay, on to the anchor block

const LEGTOP = 222000;                  // the legs stop under the saddle blocks
const HB = 33 * FT, BB = 54 * FT;       // 10058 x 16459 at the base
const HT = 6800, BT = 10400;            // and what it tapers to
const legH = z => HB + (HT - HB) * z / LEGTOP;   // across the bridge
const legB = z => BB + (BT - BB) * z / LEGTOP;   // along it
// Wall. A GGB leg is a raft of 3'6" cells, not a single tube, so this stands
// for the whole cellular section - outer skin plus the cell walls inside it -
// and it is what puts the towers at about 40,000 t for the pair. An outer skin
// alone would draw the same picture and weigh half of what a tower weighs.
const legT = z => 120 + (75 - 120) * z / LEGTOP;
const ZL = [0, 40000, ZTOPF, 107000, 138000, 166000, 191000, 207000, LEGTOP];
// The leg is built in lifts, so what stands beside it has to clear the SECTION
// of the lift it is beside - not the smooth taper, which is thinner everywhere
// above a lift's foot. Reading the taper is what put 27 clashes in the report.
const lift = z => { let i = 0; while (ZL[i + 1] !== undefined && z >= ZL[i + 1]) i++; return i; };
const legHat = z => legH(ZL[lift(z)]);
const legBat = z => legB(ZL[lift(z)]);

const LEGX = legBat(ZTC) / 2 + 60;      // 7749 - the leg face the truss stops at

const cblMain = x => ZCL + AP * x * x;
const cblSide = s => ZSAD - KS * s + AP * s * s;   // s from the tower, outward

const r1 = v => Math.round(v * 10) / 10;
const R = [];
const push = (...r) => R.push(r);
const blank = () => R.push([]);

/* row writers -------------------------------------------- */
const HDR_MOD = ['# MODULE', 'id', 'member', 'Ref.Pt', 'L.X', 'L.Y', 'L.Z',
                 'PLANE', 'ROT.X', 'ROT.Y', 'ROT.Z', 'dx', 'dy', 'dz', 'rep'];
const HDR_AX = ['# MODULE', 'id', 'member', 'Ref.Pt', 'LX1', 'LY1', 'LZ1',
                'LX2', 'LY2', 'LZ2', 'OFF_B', 'OFF_E', 'Alpha',
                'dx', 'dy', 'dz', 'rep'];
let form = '';
// angle form: put this member's Ref.Pt at (x,y,z) and lay it on PLANE
function M(id, mem, ref, x, y, z, pl, rep) {
  if (form !== 'm') { push.apply(null, HDR_MOD); form = 'm'; }
  const r = ['MODULE', id, mem, ref, r1(x), r1(y), r1(z), pl, '', '', ''];
  if (rep) r.push(r1(rep[0]), r1(rep[1]), r1(rep[2]), rep[3]);
  push.apply(null, r);
}
// coordinate form: stretch this bar/section from a to b, trimmed by ob/oe
function A(id, mem, a, b, ob, oe, rep) {
  if (form !== 'a') { push.apply(null, HDR_AX); form = 'a'; }
  const r = ['MODULE', id, mem, '', r1(a[0]), r1(a[1]), r1(a[2]),
             r1(b[0]), r1(b[1]), r1(b[2]), ob || '', oe || '', ''];
  if (rep) r.push(r1(rep[0]), r1(rep[1]), r1(rep[2]), rep[3]);
  push.apply(null, r);
}
function BASE(id, mem, pt) {
  if (form !== 'm') { push.apply(null, HDR_MOD); form = 'm'; }
  push('MODULE', id, 'BASE', mem, pt); form = '';
}

push('COORD', 'ZUP');
blank();

/* ===================== sections ===================== */
push('# SECT', 'id', 'mat', 'length', 'TYPE', 'base.pt',
     'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7');
// The tower leg is a cellular steel shaft that loses section as it climbs. A
// rectangular tube per lift is the honest reduction of it: the wall carries the
// take-off, and stepping it is what the real leg does.
const NLIFT = ZL.length - 1;
for (let i = 0; i < NLIFT; i++) push('SECT', 'sc.lg' + (i + 1), 'SM490',
  r1(ZL[i + 1] - ZL[i]), 'R', 'mc', Math.round(legH(ZL[i])),
  Math.round(legB(ZL[i])), Math.round(legT(ZL[i])), 0);
push('SECT', 'sc.st1', 'SM490', 20000, 'R', 'mc', 8000, 12000, 45, 0);  // portal strut, low
push('SECT', 'sc.st2', 'SM490', 20000, 'R', 'mc', 6500, 9000, 35, 0);   // portal strut, high
push('SECT', 'sc.chd', 'SM490', PM, 'H', 'mc', HCHD, 600, 600, 22, 36, 36, 20);
push('SECT', 'sc.vpt', 'SM490', TRUSS, 'H', 'mc', 700, 400, 400, 16, 22, 22, 16);
push('SECT', 'sc.dia', 'SM490', 15000, 'H', 'mc', 500, 350, 350, 14, 20, 20, 14);
push('SECT', 'sc.fb', 'SM490', DKW, 'H', 'mc', HFB, 700, 700, 20, 32, 32, 24);
push('SECT', 'sc.sg', 'SM490', PM, 'H', 'mc', HSG, 300, 300, 12, 19, 19, 16);
blank();

push('# BAR', 'id', 'mat', 'dia', 'length');
push('BAR', 'bar.cbl', 'WIRE', 920, PM);      // 36-3/8 in. Length is reference: the nodes rule
push('BAR', 'bar.hgr', 'WIRE', 70, 10000);    // suspender rope
blank();

push('# PLATE', 'id', 'mat', 'thk', 'shape', 'base.pt', 'B', 'H');
push('PLATE', 'pl.sad', 'SM490', 3000, 'RECT', 'mc', 3000, 3400);   // saddle block
push('PLATE', 'pl.dkm', 'ORTHO', TDK, 'RECT', 'mc', r1(PM - DKJ), r1(DKW));   // deck bay, main span
push('PLATE', 'pl.dks', 'ORTHO', TDK, 'RECT', 'mc', r1(PS - DKJ), r1(DKW));   // deck bay, side span
push('PLATE', 'pl.dnm', 'ORTHO', TDK, 'RECT', 'mc', r1(PM - DKJ), DKN);  // and where it pinches
push('PLATE', 'pl.dns', 'ORTHO', TDK, 'RECT', 'mc', r1(PS - DKJ), DKN);  // past the tower legs
blank();

/* ===================== the tower ===================== */
// One tower, written about its own centreline: the legs at y = -/+13716, the
// portal struts between them, a saddle block on each leg. ASSY puts it at both
// towers. The struts are pulled back by half the leg at their own level, so
// they land on the face instead of inside it.
push('#', 'ONE TOWER - legs, portal struts, cable saddles');
for (let i = 0; i < NLIFT; i++) {
  A('md.twr', 'sc.lg' + (i + 1), [0, -CY, ZL[i]], [0, -CY, ZL[i + 1]]);
  A('md.twr', 'sc.lg' + (i + 1), [0, CY, ZL[i]], [0, CY, ZL[i + 1]]);
}
// Each strut sits inside one lift rather than across a step, so one pull-back
// answers for its whole depth. The gaps get shorter going up, which is the
// tower's own proportion and the thing the eye reads it by.
[[12000, 'sc.st1'], [46000, 'sc.st1'], [62000, 'sc.st1'],
 [111000, 'sc.st2'], [142000, 'sc.st2'], [170000, 'sc.st2'],
 [195000, 'sc.st2'], [211000, 'sc.st2']].forEach(t => {
  const o = r1(legHat(t[0]) / 2 + 10);
  A('md.twr', t[1], [0, -CY, t[0]], [0, CY, t[0]], o, o);
});
M('md.twr', 'pl.sad', 'mc', 0, -CY, LEGTOP + 1500, 'XY');
M('md.twr', 'pl.sad', 'mc', 0, CY, LEGTOP + 1500, 'XY');
BASE('md.twr', 'sc.lg1_1', 'mc');       // the -Y leg, at its foot
blank();

/* ===================== one cable ===================== */
// 128 straight bars and 127 suspenders, in the plane y = 0. Every node comes
// out of the parabola, so the sag is a number in this file and not a drawing:
// change SAG and the cable, the suspenders and nothing else follow.
push('#', 'ONE MAIN CABLE - 130 bars on the parabola, anchorage to anchorage');
const NODE = [[-XA - TAIL, ZANC]];      // west anchorage
for (let j = NS; j >= 0; j--) NODE.push([-TX - j * PS, cblSide(j * PS)]);
for (let i = 1; i <= NM; i++) NODE.push([-TX + i * PM, cblMain(-TX + i * PM)]);
for (let j = 1; j <= NS; j++) NODE.push([TX + j * PS, cblSide(j * PS)]);
NODE.push([XA + TAIL, ZANC]);           // east anchorage
const SAD1 = 1 + NS, SAD2 = SAD1 + NM;  // the two nodes that sit on a saddle
for (let i = 0; i < NODE.length - 1; i++)
  A('md.mcb', 'bar.cbl', [NODE[i][0], 0, NODE[i][1]],
    [NODE[i + 1][0], 0, NODE[i + 1][1]],
    i === SAD1 || i === SAD2 ? 400 : 30, i + 1 === SAD1 || i + 1 === SAD2 ? 400 : 30);
blank();
// The ropes are their own module and their own assembly. They are a different
// thing from the cable that carries them - a different member, hung vertically
// instead of run on the curve, replaced on their own cycle and counted on their
// own line - and a take-off that says so is worth two rows in the ASSY block.
push('#', 'THE HANGER ROPES - vertical, one at every node but the saddles');
NODE.forEach((n, i) => {
  if (i === 0 || i === NODE.length - 1 || i === SAD1 || i === SAD2) return;
  A('md.hgr', 'bar.hgr', [n[0], 0, n[1]], [n[0], 0, ZTOPF], 700);
});
BASE('md.mcb', 'bar.cbl_1', 'mc');      // the first bar, at the west anchorage
BASE('md.hgr', 'bar.hgr_1', 'mc');      // the first rope, at the end of the side span
blank();

/* ===================== one stiffening truss ===================== */
// Chords, posts and diagonals in the plane y = 0, over three runs: the west
// side span, the main span, the east side span. Each run stops at the face of
// the tower leg with a short closing bay, which is the one place the panel grid
// does not reach - the leg is 7220 either side of the tower centreline.
push('#', 'ONE STIFFENING TRUSS - 25 ft deep, stopping at the tower legs');
const RUN = [
  { x0: -XA, p: PS, n: NS, endHi: true },        // west side span -> tower
  { x0: -TX, p: PM, n: NM, both: true },         // main span, tower to tower
  { x0: TX, p: PS, n: NS, startHi: true }        // tower -> east side span
];
RUN.forEach(run => {
  // full bays: the first and last of a run are inside the leg and are dropped
  const i0 = (run.both || run.startHi) ? 1 : 0;
  const i1 = (run.both || run.endHi) ? run.n - 1 : run.n;   // exclusive
  const x0 = run.x0 + i0 * run.p, nb = i1 - i0;
  [ZTC, ZBC].forEach(z => A('md.trs', 'sc.chd', [x0, 0, z],
                            [x0 + run.p, 0, z], 0, 0, [run.p, 0, 0, nb - 1]));
  // and the short bay that closes onto the leg face
  if (run.both || run.startHi) [ZTC, ZBC].forEach(z =>
    A('md.trs', 'sc.chd', [run.x0 + LEGX, 0, z], [x0, 0, z], 0, 10));
  if (run.both || run.endHi) [ZTC, ZBC].forEach(z =>
    A('md.trs', 'sc.chd', [x0 + nb * run.p, 0, z],
      [run.x0 + run.n * run.p - LEGX, 0, z], 10, 0));
  // a post on every panel point that is not inside a leg. Posts and diagonals
  // are written between the chord FACES, not the work lines: a member cut back
  // along its own axis by half a chord still leaves a sloping end inside the
  // chord, and the clash report is right to say so.
  A('md.trs', 'sc.vpt', [x0, 0, ZI0], [x0, 0, ZI1], 0, 0, [run.p, 0, 0, nb]);
  // diagonals fall away from mid-span, so they turn over at the centre
  const half = run.both ? Math.floor(nb / 2) : nb;
  A('md.trs', 'sc.dia', [x0 + DGX, 0, ZD0], [x0 + run.p - DGX, 0, ZD1], 0, 0,
    [run.p, 0, 0, half - 1]);
  if (run.both) A('md.trs', 'sc.dia', [x0 + half * run.p + DGX, 0, ZD1],
                  [x0 + (half + 1) * run.p - DGX, 0, ZD0], 0, 0,
                  [run.p, 0, 0, nb - half - 1]);
});
BASE('md.trs', 'sc.chd_1', 'mc');       // top chord, first bay of the west side span
blank();

/* ===================== the floor system and the deck ===================== */
// Floor beams across at every panel point, stringers between them, and the deck
// on top. The deck is full width except for the two bays at each tower, where
// the legs take the footway and a narrower bay is what is left - the pinch that
// is there on the bridge.
push('#', 'FLOOR BEAMS, STRINGERS, DECK - full width but at the legs');
RUN.forEach(run => {
  const i0 = run.startHi || run.both ? 1 : 0;
  const i1 = run.endHi || run.both ? run.n - 1 : run.n;
  const x0 = run.x0 + i0 * run.p;
  A('md.dk', 'sc.fb', [x0, -CY + FBI, ZFB], [x0, CY - FBI, ZFB], 0, 0,
    [run.p, 0, 0, i1 - i0]);
});
blank();
[0, -6000, 6000].forEach(y => RUN.forEach(run =>
  A('md.dk', 'sc.sg', [run.x0, y, ZSG], [run.x0 + run.p, y, ZSG], 350, 350,
    [run.p, 0, 0, run.n - 1])));
blank();
RUN.forEach(run => {
  const wide = run.p === PM ? 'pl.dkm' : 'pl.dks';
  const narrow = run.p === PM ? 'pl.dnm' : 'pl.dns';
  const i0 = run.startHi || run.both ? 1 : 0;
  const i1 = run.endHi || run.both ? run.n - 1 : run.n;
  const c = i => run.x0 + (i + 0.5) * run.p;    // bay centre
  M('md.dk', wide, 'mc', c(i0), 0, ZDK, 'XY', [run.p, 0, 0, i1 - i0 - 1]);
  if (i0) M('md.dk', narrow, 'mc', c(0), 0, ZDK, 'XY');
  if (i1 < run.n) M('md.dk', narrow, 'mc', c(run.n - 1), 0, ZDK, 'XY');
});
BASE('md.dk', 'sc.fb_1', 'mc');
blank();

/* ===================== the drawings the sheet asks for ===================== */
// Without these rows Save DXF hands back a file with nothing drawn in it. The
// sheet knows which part is worth a sheet of paper, from where, and at what
// scale - and at these lengths the scale is most of the decision: 1:500 puts a
// 227 m tower on 450 mm of paper, and 2 km of bridge needs 1:5000 to fit at all.
// Every part gets its drawing: leaving the cable and the deck out left a DXF
// that was missing the two things a suspension bridge is.
//
// The first row names neither a module nor an assembly. A general arrangement
// is the towers AND the cables AND the deck, and those are three assemblies, so
// no id can ask for it - which is why `ALL` exists. It is the drawing the set
// opens with, and the one that shows the bridge is a bridge.
//
// The plan of the trusses is the one row that names an ASSY rather than a
// module, and it has to be. A module is ONE plane of the bridge, so its plan is
// a line; the pair of them 27.4 m apart is the plan somebody wants.
push('# VIEW', 'module', 'dir', 'AZ', 'EL', 'scale', 'title');
push('VIEW', 'ALL', 'FRONT', '', '', 5000, 'GOLDEN GATE BRIDGE - GENERAL ARRANGEMENT');
push('VIEW', 'md.twr', 'RIGHT', '', '', 500, 'TOWER - ELEVATION ACROSS THE BRIDGE');
push('VIEW', 'md.twr', 'FRONT', '', '', 500, 'TOWER - ELEVATION ALONG THE BRIDGE');
push('VIEW', 'md.twr', 'TOP', '', '', 500, 'TOWER - PLAN');
push('VIEW', 'md.mcb', 'FRONT', '', '', 5000, 'MAIN CABLE - ANCHORAGE TO ANCHORAGE');
push('VIEW', 'md.hgr', 'FRONT', '', '', 5000, 'HANGER ROPES - ELEVATION');
push('VIEW', 'md.trs', 'FRONT', '', '', 5000, 'STIFFENING TRUSS - ELEVATION');
push('VIEW', 'as.trs', 'TOP', '', '', 5000, 'STIFFENING TRUSSES - PLAN');
push('VIEW', 'md.dk', 'TOP', '', '', 5000, 'FLOOR SYSTEM AND DECK - PLAN');
blank();

/* ===================== the bridge ===================== */
// One assembly per major part, which is how the bridge is talked about and how
// the left-hand list should read: towers, main cables, hanger ropes, trusses,
// floor system. The two cables are split because they are two members doing two
// jobs, and a list that says `as.hgr 254 x bar.hgr` answers a question that one
// merged CABLES assembly cannot. Each
// module is written once for one plane and the ASSY rows put it on both sides,
// so the two halves cannot drift apart.
push('# ASSY', 'id', 'ref', 'cmd', 'G.X', 'G.Y', 'G.Z');
push('#', 'TOWERS - one module, both piers');
push('ASSY', 'as.twr', 'md.twr', 'ADD', -TX, -CY, 0);
push('ASSY', 'as.twr', 'md.twr', 'ADD', TX, -CY, 0);
blank();
push('# ASSY', 'id', 'ref', 'cmd', 'G.X', 'G.Y', 'G.Z');
push('#', 'MAIN CABLES - one plane, both sides');
push('ASSY', 'as.mcb', 'md.mcb', 'ADD', r1(-XA - TAIL), -CY, r1(ZANC));
push('ASSY', 'as.mcb', 'md.mcb', 'ADD', r1(-XA - TAIL), CY, r1(ZANC));
blank();
push('# ASSY', 'id', 'ref', 'cmd', 'G.X', 'G.Y', 'G.Z');
push('#', 'HANGER ROPES - the same two planes, hung off the cables above');
push('ASSY', 'as.hgr', 'md.hgr', 'ADD', -XA, -CY, ZEND);
push('ASSY', 'as.hgr', 'md.hgr', 'ADD', -XA, CY, ZEND);
blank();
push('# ASSY', 'id', 'ref', 'cmd', 'G.X', 'G.Y', 'G.Z');
push('#', 'STIFFENING TRUSSES - one plane, both sides');
push('ASSY', 'as.trs', 'md.trs', 'ADD', -XA, -CY, ZTC);
push('ASSY', 'as.trs', 'md.trs', 'ADD', -XA, CY, ZTC);
blank();
push('# ASSY', 'id', 'ref', 'cmd', 'G.X', 'G.Y', 'G.Z');
push('#', 'FLOOR SYSTEM AND DECK');
push('ASSY', 'as.dk', 'md.dk', 'ADD', -XA, -CY + FBI, ZFB);
push('END');

/* ===================== write ===================== */
(async () => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PLATE3D';
  const ws = wb.addWorksheet('input');
  const at = (kw, id) => R.findIndex(r => r[0] === kw && (id === undefined || r[1] === id));
  const notes = {};
  const put = (i, t) => { if (i >= 0) notes[i] = t; };
  put(0, 'GOLDEN GATE BRIDGE  ·  1280.16 m main span  ·  mm, Z up');
  put(at('SECT', 'sc.lg1'), 'tower leg, lift 1 of 8 - R h=across the bridge, b=along it');
  put(at('SECT', 'sc.chd'), 'stiffening truss chord. 25 ft between the outside faces');
  put(at('BAR', 'bar.cbl'), '36-3/8 in main cable. 5218 kg/m of it');
  put(at('PLATE', 'pl.dkm'), 'one deck bay, 50 ft x 90 ft');
  put(at('PLATE', 'pl.dnm'), 'and the narrow bay beside a tower leg');
  put(at('MODULE', 'md.twr'), 'ONE tower: 8 leg lifts x 2, 8 portal struts, 2 saddles');
  put(at('MODULE', 'md.hgr'), 'and the ropes on their own, so they count on their own line');
  put(at('#', 'ONE MAIN CABLE - 130 bars on the parabola, anchorage to anchorage') + 1,
      'west anchorage. z = ZCL + a x^2 gives every node from here on');
  put(at('#', 'THE HANGER ROPES - vertical, one at every node but the saddles') + 1,
      'the same nodes, straight down to the top chord');
  put(at('#', 'ONE STIFFENING TRUSS - 25 ft deep, stopping at the tower legs') + 1,
      'one row = 20 bays. The chord is a repeat, not 20 rows');
  put(at('# VIEW'), 'nine drawings. The first is ALL - the whole bridge on one sheet');
  put(at('# ASSY'), 'one assembly per part - towers, main cables, ropes, trusses, deck');
  R.forEach((r, i) => ws.addRow(r.length ? [notes[i] || ''].concat(r) : []));
  ws.getColumn(1).width = 52;
  ws.getColumn(2).width = 11;
  ws.getColumn(3).width = 11;
  ws.getColumn(4).width = 10;
  for (let c = 5; c <= 18; c++) ws.getColumn(c).width = 10;
  ws.eachRow(row => row.eachCell({ includeEmpty: false }, cell => {
    const v = String(cell.value == null ? '' : cell.value);
    if (cell.col === 1) { cell.font = { italic: true, color: { argb: 'FF94A3B8' }, size: 10 }; return; }
    if (v.charAt(0) === '#') cell.font = { italic: true, color: { argb: 'FF64748B' }, size: 10 };
    else if (cell.col === 2) cell.font = { bold: true, color: { argb: 'FF1D4ED8' } };
  }));
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  await wb.xlsx.writeFile(OUT);
  console.log('wrote ' + OUT + '  (' + R.length + ' rows)');
})();
