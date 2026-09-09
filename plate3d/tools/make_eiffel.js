// PLATE3D_EIFFEL.xlsx - the Eiffel Tower, at full size, in mm.
//
// The published figures are the input: 125 m square between the outer faces of
// the four piers, platforms at 57.63 m, 115.73 m and 276.13 m, and 300.65 m to
// the top of the structure in 1889. Five things get built and no more - the
// piers, the arches between them, the platforms, the shaft above the second
// platform, and the lantern - which is what makes it readable as a sheet, and
// each is its own ASSY so the list on the left reads the way the tower is
// talked about.
//
// Three decisions carry the model:
//
//   - THE CURVE IS ARITHMETIC. Every pier node comes out of h = h0 exp(-z/L),
//     and L is fixed by two published numbers: 125 m at the ground, 35 m at the
//     second platform. Nothing is drawn to taste, and the check is that the
//     FIRST platform then falls out at 66.3 m against a published 65 m - a
//     figure the curve was never told. Eiffel's profile is an exponential
//     because the wind moment is; this file is that sentence.
//
//   - A PANEL IS AS TALL AS THE PIER IS WIDE. Panel heights shrink in the same
//     geometric ratio as the section, so every X brace is the same shape from
//     the ground to the second platform. Equal panels give squat braces at the
//     bottom and slender ones at the top - a picture of a tower, not a tower.
//
//   - ONE PIER IS WRITTEN ONCE, where it really stands, and ASSY turns it 90
//     degrees three times about the tower axis. Four piers cannot drift from
//     each other because there is only one of them in the file. Same for the
//     arch.
const ExcelJS = require('exceljs');
const OUT = process.argv[2] || __dirname + '/../PLATE3D_EIFFEL.xlsx';

/* ===================== the published figures ===================== */
const H1 = 57630;                  // first platform
const H2 = 115730;                 // second platform
const H3 = 276130;                 // third platform
const HTOP = 300650;               // top of the structure
const BASE = 125000;               // the square, outer face to outer face
const WB = 26000;                  // one pier, across, at the ground
const HA0 = BASE / 2 - WB / 2;     // 49500 - the pier axis, per axis, at the ground
const HA2 = 13500, W2 = 8000;      // and where the four of them have converged

/* The two exponentials. L comes from the ground and the second platform; the
   first platform is then a PREDICTION and it lands within 2 % of the published
   65 m. That agreement is why this file uses a curve rather than a spline
   through three points. */
const LA = H2 / Math.log(HA0 / HA2);      //  89072
const LW = H2 / Math.log(WB / W2);        //  98188
const hA = z => HA0 * Math.exp(-z / LA);
const wP = z => WB * Math.exp(-z / LW);

/* Above the second platform the four piers are one shaft and it stops being an
   exponential of the wind moment - there is no leg left to lean. Same form, its
   own length, tied to the third platform. */
const HB3 = 5000;
const LB = (H3 - H2) / Math.log(HA2 / HB3);
const hB = z => HA2 * Math.exp(-(z - H2) / LB);
const HC = 3000;                                     // the lantern above it
const hC = z => HB3 + (HC - HB3) * (z - H3) / (HTOP - H3);

/* Panels sized by what they brace: h / (face width) is constant all the way up,
   so one X brace shape serves the whole pier - which is what the tower does and
   why it reads as one thing and not as fourteen. */
function panels(z0, z1, n, wf) {
  const r = Math.pow(wf(z1) / wf(z0), 1 / n);
  const h0 = (z1 - z0) * (1 - r) / (1 - Math.pow(r, n));
  const z = [z0];
  for (let i = 0; i < n; i++) z.push(z[i] + h0 * Math.pow(r, i));
  z[n] = z1;                                        // land exactly, not nearly
  return z;
}
const NLP = 16, NSP = 12, NTP = 3;
const ZP = panels(0, H2, NLP, wP);
const ZS = panels(H2, H3, NSP, z => 2 * hB(z));
const ZT = panels(H3, HTOP, NTP, z => 2 * hC(z));

/* A chord is a twentieth of the face it stands at the corner of - which is what
   keeps a 26 m pier and an 8 m one looking like the same tower - and the wall
   is a thirty-second of the chord. One section per lift, not per panel. */
const chordAt = w => Math.max(340, Math.round(w / 20 / 10) * 10);
const wallAt = s => Math.max(12, Math.round(s / 32 / 2) * 2);
const NLIFT = 4, PERLIFT = NLP / NLIFT;
const legLift = i => Math.min(NLIFT - 1, Math.floor(i / PERLIFT));
const legSide = k => chordAt(wP(ZP[Math.round(k * PERLIFT)]));
/* The shaft carries what sixteen pier chords carried, on four - so a shaft
   chord is four pier chords' steel, which is twice the side. */
const SHLIFT = 3, PERSH = NSP / SHLIFT;
const shLift = i => Math.min(SHLIFT - 1, Math.floor(i / PERSH));
const shSide = k => Math.max(360,
  Math.round(2 * chordAt(wP(H2)) * Math.pow(HB3 / HA2, k / SHLIFT) / 10) * 10);

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
function M(id, mem, ref, x, y, z, pl) {
  if (form !== 'm') { push.apply(null, HDR_MOD); form = 'm'; }
  push('MODULE', id, mem, ref, r1(x), r1(y), r1(z), pl, '', '', '');
}
function A(id, mem, a, b, ob, oe) {
  if (form !== 'a') { push.apply(null, HDR_AX); form = 'a'; }
  push('MODULE', id, mem, '', r1(a[0]), r1(a[1]), r1(a[2]),
       r1(b[0]), r1(b[1]), r1(b[2]), ob ? r1(ob) : '', oe ? r1(oe) : '', '');
}
function BASE_(id, mem, pt) {
  if (form !== 'm') { push.apply(null, HDR_MOD); form = 'm'; }
  push('MODULE', id, 'BASE', mem, pt); form = '';
}

push('COORD', 'ZUP');
blank();

/* ===================== sections ===================== */
push('# SECT', 'id', 'mat', 'length', 'TYPE', 'base.pt',
     'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7');
// Square tubes for every chord. A pier chord leans two ways at once, and a
// square section is the one that does not have to be told which way is up.
for (let i = 0; i < NLIFT; i++) {
  const s = legSide(i);
  push('SECT', 'sc.lg' + (i + 1), 'IRON',
       r1(ZP[(i + 1) * PERLIFT] - ZP[i * PERLIFT]), 'R', 'mc', s, s, wallAt(s), 0);
}
for (let i = 0; i < SHLIFT; i++) {
  const s = shSide(i);
  push('SECT', 'sc.sh' + (i + 1), 'IRON',
       r1(ZS[(i + 1) * PERSH] - ZS[i * PERSH]), 'R', 'mc', s, s, wallAt(s), 0);
}
push('SECT', 'sc.tp', 'IRON', 8000, 'R', 'mc', 360, 360, 12, 0);
push('SECT', 'sc.hz', 'IRON', 20000, 'H', 'mc', 700, 400, 400, 14, 20, 20, 16);
push('SECT', 'sc.dg', 'IRON', 22000, 'H', 'mc', 500, 300, 300, 12, 16, 16, 14);
push('SECT', 'sc.hs', 'IRON', 14000, 'H', 'mc', 500, 300, 300, 12, 16, 16, 14);
push('SECT', 'sc.ds', 'IRON', 16000, 'H', 'mc', 400, 250, 250, 10, 14, 14, 12);
push('SECT', 'sc.ar', 'IRON', 12000, 'H', 'mc', 900, 450, 450, 16, 25, 25, 18);
push('SECT', 'sc.av', 'IRON', 4200, 'H', 'mc', 400, 250, 250, 10, 14, 14, 12);
push('SECT', 'sc.gd', 'IRON', 30000, 'H', 'mc', 1100, 600, 600, 18, 28, 28, 20);
push('SECT', 'sc.bm', 'IRON', 14000, 'H', 'mc', 600, 300, 300, 12, 18, 18, 14);
blank();

/* ===================== the platform plates ===================== */
// The floor is four plates, one per side, and THE CORNERS ARE LEFT OPEN -
// because that is where the pier comes through. A ring of four full plates
// would be pierced by sixteen chords, and sixteen holes is a different sheet.
const P1 = { z: H1, ro: hA(H1) + wP(H1) / 2, ri: hA(H1) - wP(H1) / 2, nb: 6, t: 30, go: 1400 };
const P2 = { z: H2, ro: hA(H2) + wP(H2) / 2, ri: hA(H2) - wP(H2) / 2, nb: 4, t: 30, go: 1400 };
/* 18.7 m square, published - and its inner edge is set outside the shaft it
   rings rather than inside it. There are no leaning chords up here, so the
   girders sit on the edges themselves. */
const P3 = { z: H3, ro: 9350, ri: 6400, nb: 3, t: 25, go: 0 };
const PL = [['pl1', P1], ['pl2', P2], ['pl3', P3]];
PL.forEach(e => { e[1].mid = (e[1].ro + e[1].ri) / 2; e[1].wid = e[1].ro - e[1].ri; });

push('# PLATE', 'id', 'mat', 'thk', 'shape', 'base.pt', 'B', 'H');
PL.forEach(e => push('PLATE', 'pl.' + e[0], 'IRON', e[1].t, 'RECT', 'mc',
                     r1(2 * e[1].ri - 2600), r1(e[1].wid)));
blank();

/* ===================== one pier ===================== */
push('#', 'ONE PIER - four chords on the curve, ground to the second platform');
/* Clearances, and every one of them is a clash the report found.

   A CHORD IS A PIECE PER PANEL. The chord turns at every node, so two segments
   meeting there are not parallel and their boxes overlap however small the
   kink. 80 mm off each end is a 160 mm gap in a member 1.3 m thick, invisible
   at 300 m, and true: each panel of the real pier IS a piece.

   AN X IS TWO MEMBERS THROUGH ONE POINT. They are set 420 either side of the
   face, which is where the rivets put them: far enough apart not to be one
   member twice, and far enough OFF the face to clear the ring lying on it - the
   ring is 400 wide and the brace 300, so anything under 350 is still the ring.

   AND THE BRACES DO NOT REACH THE CORNERS. They start a seventh of the way in
   along the edge and 800 above the ring, so a brace can only meet the ring in
   the middle of the ring's span, where the ring is not. Reaching to the corner
   put a brace into the chord AND into the ring at the same node - 980 of the
   first 4266 clashes were that one point. */
const DG = 420, BIN = 0.14, BZ = 800;
const corners = (half, a) => [[half - a, half - a], [half + a, half - a],
                              [half + a, half + a], [half - a, half + a]];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/* One lattice writer for the pier, the shaft and the lantern: four chords on a
   square that moves and shrinks, a ring at every level, an X on every face. */
function lattice(id, ZL, halfOf, aOf, chordOf, hzSect, dgSect) {
  for (let i = 0; i < ZL.length - 1; i++) {
    const z0 = ZL[i], z1 = ZL[i + 1];
    const c0 = corners(halfOf(z0), aOf(z0)), c1 = corners(halfOf(z1), aOf(z1));
    const cs = chordOf(i), o = cs / 2 + 900;
    for (let k = 0; k < 4; k++)
      A(id, chordSect(id, i), [c0[k][0], c0[k][1], z0], [c1[k][0], c1[k][1], z1], 80, 80);
    for (let k = 0; k < 4; k++) {
      const p = k, q = (k + 1) % 4;
      A(id, hzSect, [c1[p][0], c1[p][1], z1], [c1[q][0], c1[q][1], z1], o, o);
      const n = [1, 0, 1, 0];        // face 0 and 2 are y-faces, 1 and 3 x-faces
      const s = [-1, 1, 1, -1];      // and the offset is outward from the axis
      const d1 = [0, 0], d2 = [0, 0];
      d1[n[k]] = s[k] * DG; d2[n[k]] = -s[k] * DG;
      const a0 = lerp(c0[p], c0[q], BIN), b0 = lerp(c0[p], c0[q], 1 - BIN);
      const a1 = lerp(c1[p], c1[q], BIN), b1 = lerp(c1[p], c1[q], 1 - BIN);
      A(id, dgSect, [a0[0] + d1[0], a0[1] + d1[1], z0 + BZ],
                    [b1[0] + d1[0], b1[1] + d1[1], z1 - BZ]);
      A(id, dgSect, [b0[0] + d2[0], b0[1] + d2[1], z0 + BZ],
                    [a1[0] + d2[0], a1[1] + d2[1], z1 - BZ]);
    }
  }
}
function chordSect(id, i) {
  if (id === 'md.leg') return 'sc.lg' + (legLift(i) + 1);
  if (id === 'md.shf') return 'sc.sh' + (shLift(i) + 1);
  return 'sc.tp';
}
lattice('md.leg', ZP, hA, z => wP(z) / 2, i => legSide(legLift(i)), 'sc.hz', 'sc.dg');
BASE_('md.leg', 'sc.lg1_1', 'mc');
blank();

/* ===================== one arch ===================== */
// The arch on the +X side, springing just inside the two piers there and
// leaning in with them: its x is the pier axis at its own height, so it stays
// on the tower rather than beside it.
push('#', 'ONE ARCH - between two piers, springing at 20 m, crown at 43 m');
const AZ0 = 20000, AZC = 43000, ADEP = 4200, NA = 16;
/* Cleared at the TOP of the arch's own depth, not at the springing. The pier
   leans in as it rises, so a clearance measured at 20 m is already inside the
   chord 4.2 m higher up - which is where the upper rib ends. */
const AYS = hA(AZ0 + ADEP) - wP(AZ0 + ADEP) / 2 - 900;
const arcZ = y => AZC - (AZC - AZ0) * (y / AYS) * (y / AYS);
const arcPt = (y, up) => { const z = arcZ(y) + (up ? ADEP : 0); return [hA(z), y, z]; };
for (let i = 0; i < NA; i++) {
  const y0 = -AYS + 2 * AYS * i / NA, y1 = -AYS + 2 * AYS * (i + 1) / NA;
  A('md.arc', 'sc.ar', arcPt(y0, 0), arcPt(y1, 0), 150, 150);
  A('md.arc', 'sc.ar', arcPt(y0, 1), arcPt(y1, 1), 150, 150);
}
/* Each post is cut back by what the rib actually is where it meets it, not by
   one number for all of them. A rib 900 deep lying at 59 degrees - which is what
   the parabola does at the springing - is 1740 of height, and a constant that
   clears the crown leaves six posts a panel in the rib. */
for (let i = 1; i < NA; i++) {
  const y = -AYS + 2 * AYS * i / NA;
  const t = Math.abs(2 * (AZC - AZ0) * y / (AYS * AYS));      // the rib's slope here
  const off = 450 / Math.cos(Math.atan(t)) + 200 * t + 150;
  A('md.arc', 'sc.av', arcPt(y, 0), arcPt(y, 1), r1(off), r1(off));
}
BASE_('md.arc', 'sc.ar_1', 'mc');
blank();

/* ===================== the platforms ===================== */
push('#', 'THE PLATFORMS - a ring on the four piers, one module each');
function platform(id, p, tag) {
  /* The girder ring is set 1400 CLEAR of the chord lines, outside and inside.
     On the lines themselves every girder would run through four chords, which
     is the platform holding itself up by passing through what holds it up. And
     the clearance is not the chord's half-width: the chord LEANS, so over the
     1100 depth of a girder it moves 200 sideways, and 900 was not enough. */
  const GO = p.go, g = 620, ro = p.ro + GO, ri = p.ri - GO;
  A(id, 'sc.gd', [-ro, -ro, p.z], [ro, -ro, p.z]);
  A(id, 'sc.gd', [-ro, ro, p.z], [ro, ro, p.z]);
  A(id, 'sc.gd', [-ro, -ro, p.z], [-ro, ro, p.z], g, g);
  A(id, 'sc.gd', [ro, -ro, p.z], [ro, ro, p.z], g, g);
  A(id, 'sc.gd', [-ri, -ri, p.z], [ri, -ri, p.z]);
  A(id, 'sc.gd', [-ri, ri, p.z], [ri, ri, p.z]);
  A(id, 'sc.gd', [-ri, -ri, p.z], [-ri, ri, p.z], g, g);
  A(id, 'sc.gd', [ri, -ri, p.z], [ri, ri, p.z], g, g);
  for (let k = 1; k < p.nb; k++) {
    const t = -ri + 2 * ri * k / p.nb;
    A(id, 'sc.bm', [t, -ro, p.z], [t, -ri, p.z], g, g);
    A(id, 'sc.bm', [t, ri, p.z], [t, ro, p.z], g, g);
    A(id, 'sc.bm', [-ro, t, p.z], [-ri, t, p.z], g, g);
    A(id, 'sc.bm', [ri, t, p.z], [ro, t, p.z], g, g);
  }
  const zt = p.z + 560 + p.t / 2;    // the floor lies on top of the girders
  M(id, 'pl.' + tag, 'mc', 0, -p.mid, zt, 'XY');
  M(id, 'pl.' + tag, 'mc', 0, p.mid, zt, 'XY');
  M(id, 'pl.' + tag, 'mc', -p.mid, 0, zt, 'XY');
  M(id, 'pl.' + tag, 'mc', p.mid, 0, zt, 'XY');
  BASE_(id, 'sc.gd_1', 'mc');
}
PL.forEach(e => { platform('md.' + e[0], e[1], e[0]); blank(); });

/* ===================== the shaft and the lantern ===================== */
push('#', 'THE SHAFT - second platform to third, four chords, no legs left');
lattice('md.shf', ZS, () => 0, hB, i => shSide(shLift(i)), 'sc.hs', 'sc.ds');
BASE_('md.shf', 'sc.sh1_1', 'mc');
blank();
push('#', 'THE LANTERN - the last 24 m, and the top of the tower in 1889');
lattice('md.top', ZT, () => 0, hC, () => 360, 'sc.ds', 'sc.ds');
BASE_('md.top', 'sc.tp_1', 'mc');
blank();

/* ===================== the drawings ===================== */
// VIEW on a module draws it wherever it is PLACED, so one pier drawn front-on
// is the four of them - which for a tower with four-fold symmetry is the
// elevation everybody means.
push('# VIEW', 'module', 'dir', 'AZ', 'EL', 'scale', 'title');
push('VIEW', 'ALL', 'FRONT', '', '', 1000, 'EIFFEL TOWER - GENERAL ARRANGEMENT');
push('VIEW', 'ALL', 'TOP', '', '', 1000, 'EIFFEL TOWER - PLAN');
push('VIEW', 'md.leg', 'FRONT', '', '', 500, 'THE PIERS - ELEVATION');
push('VIEW', 'md.leg', 'TOP', '', '', 500, 'THE PIERS - PLAN AT THE GROUND');
push('VIEW', 'md.arc', 'RIGHT', '', '', 200, 'THE ARCH - ELEVATION');
push('VIEW', 'md.pl1', 'TOP', '', '', 500, 'FIRST PLATFORM - PLAN');
push('VIEW', 'md.pl2', 'TOP', '', '', 200, 'SECOND PLATFORM - PLAN');
push('VIEW', 'md.shf', 'FRONT', '', '', 500, 'THE SHAFT - ELEVATION');
push('VIEW', 'md.top', 'FRONT', '', '', 100, 'THE LANTERN - ELEVATION');
blank();

/* ===================== the assemblies ===================== */
// One pier and one arch, each turned three times about the tower axis. The
// four-fold symmetry is a command, not four copies of the geometry.
push('# ASSY', 'id', 'ref', 'cmd', 'G.X', 'G.Y', 'G.Z', 'ROT.X', 'ROT.Y', 'ROT.Z');
push('#', 'THE PIERS - one module, turned four ways');
push('ASSY', 'as.leg', 'md.leg', 'ADD', r1(hA(0) - wP(0) / 2), r1(hA(0) - wP(0) / 2), 0);
push('ASSY', 'as.leg', 'as.leg', 'ROT', 0, 0, 0, 'Z', 90, 3);
blank();
push('# ASSY', 'id', 'ref', 'cmd', 'G.X', 'G.Y', 'G.Z');
push('#', 'THE ARCHES - the same, on the four sides');
push('ASSY', 'as.arc', 'md.arc', 'ADD', r1(arcPt(-AYS, 0)[0]), r1(-AYS), r1(AZ0));
push('ASSY', 'as.arc', 'as.arc', 'ROT', 0, 0, 0, 'Z', 90, 3);
blank();
push('# ASSY', 'id', 'ref', 'cmd', 'G.X', 'G.Y', 'G.Z');
push('#', 'THE PLATFORMS - three of them, one assembly');
PL.forEach(e => push('ASSY', 'as.plt', 'md.' + e[0], 'ADD',
                     r1(-(e[1].ro + e[1].go)), r1(-(e[1].ro + e[1].go)), e[1].z));
blank();
push('# ASSY', 'id', 'ref', 'cmd', 'G.X', 'G.Y', 'G.Z');
push('#', 'THE SHAFT AND THE LANTERN');
push('ASSY', 'as.shf', 'md.shf', 'ADD', r1(-hB(H2)), r1(-hB(H2)), H2);
push('ASSY', 'as.top', 'md.top', 'ADD', r1(-hC(H3)), r1(-hC(H3)), H3);
push('END');

/* ===================== write ===================== */
(async () => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PLATE3D';
  const ws = wb.addWorksheet('input');
  const at = (kw, id) => R.findIndex(r => r[0] === kw && (id === undefined || r[1] === id));
  const notes = {};
  const put = (i, t) => { if (i >= 0) notes[i] = t; };
  put(0, 'EIFFEL TOWER  ·  125 m square, 300.65 m tall  ·  mm, Z up');
  put(at('SECT', 'sc.lg1'), 'pier chord, lift 1 of 4 - a square tube leans two ways at once');
  put(at('SECT', 'sc.ar'), 'the arch rib. 900 deep, and 4200 between the two of them');
  put(at('SECT', 'sc.gd'), 'platform girder');
  put(at('PLATE', 'pl.pl1'), 'the first floor, tiled so it meets at the corners');
  put(at('MODULE', 'md.leg'), 'ONE pier: 14 panels, each as tall as the pier is wide');
  put(at('#', 'ONE ARCH - between two piers, springing at 20 m, crown at 43 m') + 1,
      'z = crown - rise (y/ys)^2, and x follows the pier it leans with');
  put(at('#', 'THE SHAFT - second platform to third, four chords, no legs left') + 1,
      'four chords carrying what sixteen carried below');
  put(at('# VIEW'), 'nine drawings. VIEW on a module draws every place it is put');
  put(at('# ASSY'), 'one assembly per part - piers, arches, platforms, shaft, lantern');
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
