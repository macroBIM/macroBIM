// PLATE3D_HARBOUR.xlsx - the Sydney Harbour Bridge, at full size, in mm.
//
// WHAT IS PUBLISHED AND WHAT IS MINE. The published figures are the input and
// there are six of them: 503 m between the arch bearing pins, 134 m from the
// water to the top of the arch, 49 m of clearance under the roadway, 89 m to
// the top of a pylon, 1,149 m overall, and a deck 48.8 m wide. Everything
// else in this file - the truss depths, the panel count, every section size,
// the pier spacing, the pylon footprint - is MINE. It is designed to those
// six numbers and to what the bridge looks like. It is not Dorman Long's
// drawing and nothing written about this model should say it is.
//
// THE ARCH IS ALREADY STRAIGHT. The Eiffel Tower needed an argument about
// curves: PLATE3D has no curved member, so the tower's profile is an
// exponential sampled at panel points and assembled from straight steel. This
// bridge needs no argument at all. A 503 m two-hinged arch IS a polygon -
// twenty-eight straight chord segments turning a few degrees at every node -
// and that is how it was riveted in 1930. The model is not an approximation
// of a curve here. It is the same shape, made the same way.
//
// Three decisions carry the file:
//
//   - THE ARCH IS AN AXIS AND A DEPTH, not two curves. Writing the top and
//     bottom chords as separate curves and hoping is how you get a lower
//     chord that dives below its own pin. So the axis is a parabola through
//     the pin and the crown - which is the line the thrust takes - and the
//     truss depth is a second, separate function of the same parameter,
//     18 m at the crown, opening to 53 m at the quarter point and closing to
//     ZERO at the pin, because the two chords meet there. Two hinges, two
//     pins, and the arch is one triangle at each end.
//
//   - A QUARTER OF THE ARCH IS WRITTEN, and ASSY does the rest. One half of
//     one truss, mirrored about the crown and then about the centre line:
//     MIR, MIR, four half-trusses, and they cannot drift from each other
//     because there is only one of them in the file.
//
//   - THE STRINGER LINES ARE PLACED TO MISS THE ARCH. The deck is 48.8 m
//     wide and the two arch trusses are 30 m apart, so the deck straddles the
//     arch and the lower chord crosses the roadway. It crosses BETWEEN panel
//     points, where there is no cross girder, and it crosses at y = 15 m,
//     where there is no stringer - the seven stringer lines are at 0, 8.2,
//     16.4 and 24.4 m for that reason and no other. Nothing is notched. The
//     bridge gets through its own deck because the deck was laid out knowing
//     it had to.
//
// THE PAINT IS NOT IN THIS FILE. The engine hands out its palette in read
// order. For a picture or a film, set it the way the other two do:
//
//   COLOURS=md.arh=#9aa7b4,md.brc=#8492a0,md.crn=#9aa7b4,md.dkb=#6f7d8b,\
//           md.pyl=#c9b79a,md.pie=#b6a68c \
//     node tools/shot_ggb.js PLATE3D_HARBOUR.xlsx
//
// GROW - the film's one switch. The two half-arches were built out from the
// abutments as cantilevers, held back by cables through the hillsides, and
// met in the air on 19 August 1930. `GROW=0.4 node tools/make_harbour.js out`
// writes the arch as it stood when each side was four tenths of the way to
// the crown: the panels are NOT hidden, they are not written, so every frame
// of a film is a real model the engine built from a real sheet. Unset, the
// file is byte for byte the workbook that ships.
const ExcelJS = require('exceljs');
const OUT = process.argv[2] || __dirname + '/../PLATE3D_HARBOUR.xlsx';
const GROW = process.env.GROW ? +process.env.GROW : 1;
const staged = GROW < 1;

/* ===================== the published figures ===================== */
const SPAN = 503000;               // arch, pin to pin
const RISEW = 134000;              // water to the top of the arch
const DECKW = 49000;               // water to the roadway
const PYLW = 89000;                // water to the top of a pylon
const WIDE = 48800;                // the roadway, out to out

/* ===================== and my datum ===================== */
// z = 0 is the bearing pin. The water is 12 m below it: the pins sit on the
// abutments, not in the harbour, and every published height above is measured
// from the water, so one number converts them all.
const MSL = -12000;
const HU = RISEW + MSL;            // 122000  top chord at the crown
const ZDK = DECKW + MSL;           //  37000  roadway
const ZPY = PYLW + MSL;            //  77000  top of a pylon
const DC = 16000;                  // truss depth at the crown        (mine)
const DM = 68000;                  // and the number that opens it up (mine)
const DP = 20000;                  // and the SHOE it lands on        (mine)
const PW = 1.8;                    // the bottom chord's exponent     (mine)
const BY = 15000;                  // half the spacing of the two trusses (mine)
/* THE BOTTOM CHORD IS THE PARABOLA, and the depth is stacked on top of it.

   The first version made the arch's AXIS the parabola and split the depth
   either side of it, which is how you would draw a rib in a textbook and it
   is not this bridge. It puts the bottom chord well below a parabola out at
   the haunch, so the chord dives early and meets the roadway a THIRD of the
   way in from the pin. Measured off an elevation of the real bridge it meets
   it a FIFTH of the way in, and the bottom chord through its whole length
   fits z = ZL(1 - u^2) to within a metre or two.

   Which makes sense of the structure rather than just matching a picture: the
   bottom chord is the arch. It is the line the thrust runs down into the pin,
   and a parabola is the line a uniform load wants. The top chord is a
   stiffening chord standing off it, and how far off is a separate question
   with a separate answer.

   u runs 0 at the crown to 1 at the pin, and x is linear in u - equal panels
   measured ALONG THE BRIDGE, not along the arch, because the hangers hang off
   the panel points and the hangers are what the deck is spaced by. */
const ZLC = HU - DC;               // 106000  bottom chord at the crown
const ZLP = -DP / 2;               // -10000  and the bottom of the shoe
/* u to the 1.8, not squared. A parabola is FLAT at its vertex - the first
   panel out from the crown drops 559 mm on a chord that falls 116 m in all -
   so the middle third of the arch is a plateau and the crown does not read as
   round. 1.8 drops 1,003 in that first panel and the top of the arch turns
   where the eye expects it to.

   It is a trade and worth writing down: the rounder the crown, the earlier the
   bottom chord meets the roadway, because a chord that turns sooner is lower
   everywhere in the middle. Squared puts the crossing 23% in from the pin,
   1.8 puts it at 25%, and 1.5 would put it past 30% and look like the first
   version of this file. 1.8 is where the crown looks right and the crossing is
   still near the end. */
const zlo = u => ZLP + (ZLC - ZLP) * (1 - Math.pow(u, PW));
/* The depth grows as u SQUARED, and that is the difference between an arch and
   a lump. Growing it linearly opens the depth faster near the crown than the
   bottom chord falls, so the TOP CHORD RISES AWAY FROM THE CROWN - highest two
   panels out, then coming down. On the drawing it is a flat hump across the
   middle third and it is the first thing you see is wrong. u squared is flat at
   the crown, so the top chord's highest point is the crown, which is where an
   arch keeps it.

   And it closes to 7 m rather than to a point. Two 3.4 m boxes converging on
   one node at 56 degrees share four metres of steel with each other, and no
   trim short of seven metres clears it - which would leave the tip of the arch
   missing. The real bridge does not converge to a point either: it converges
   to a bearing casting a man can stand inside, and the last member across is
   that casting. */
/* And it closes to a SHOE, not to a point. 7 m of depth at the pin makes the
   springing a thin wedge, and the springing of this bridge is the thickest
   thing on it - the two chords land 20 m apart on a bearing casting the size of
   a house, and the depth is still 43 m one panel back. u^12 keeps the truss
   deep until the last panel and then closes it in one. */
const dep = u => DP + (DC - DP + (DM - DC) * u * u) * (1 - Math.pow(u, 12));
const zup = u => zlo(u) + dep(u);

/* THE PANELS ARE NOT EQUAL IN X, and that is what the end of the arch was.

   Equal steps along the BRIDGE give equal steps along the arch only where the
   arch is flat. Out at the springing it is at 65 degrees, so an 18 m step in x
   is a 42 m chord segment - two and a half times the one at the crown. The
   web out there stops being a truss and becomes three enormous stretched
   parallelograms, and the arch stops being a curve and becomes three long
   straight runs into a point. That is the shape that was wrong at the end, and
   it was never the depth or the profile: it was the panelling.

   So the last stretch is spaced by ARC LENGTH along the top chord instead.
   Equal in x while the deck needs it - every hanger has to land on a cross
   girder - and equal along the steel once it does not.

   NDK is the deck's own grid and stays 14 a half span whatever the arch does.
   Past the crossing the deck stands on POSTS rather than hangs, and a post
   bears on the chord wherever the deck needs it rather than at a panel point.
   Not how you would detail it; it is how the deck stays one module copied. */
const NDK = 14;                    // deck bays in a half span
const P = SPAN / 2 / NDK;          // 17964.3
/* Every deck station is still a node, and the long panels are SPLIT.

   The first attempt spaced the last stretch purely by arc length, which threw
   the arch's nodes off the deck's grid - and landing a metre away from a deck
   station is worse than landing on it or well clear of it: the hangers came
   down a metre from the verticals and shared steel with them. So the deck's
   fourteen stations stay nodes, and each panel is divided into as many pieces
   as its own length asks for. Flat panels ask for one. The last one, 42.5 m of
   chord across 18 m of bridge, asks for three. */
const TGT = 21000;                 // as long as a chord segment is allowed to be
const US = [0];
for (let m = 0; m < NDK; m++) {
  const a = m / NDK, b = (m + 1) / NDK;
  let L = 0, pu = a;
  for (let i = 1; i <= 64; i++) {                 // the top chord's own length
    const u = a + (b - a) * i / 64;
    L += Math.hypot((u - pu) * SPAN / 2, zup(pu) - zup(u)); pu = u;
  }
  const k = Math.max(1, Math.ceil(L / TGT));
  for (let i = 1; i <= k; i++) US.push(a + (b - a) * i / k);
}
const NP = US.length - 1;          // panels in a half arch
const U = j => US[j];              // j = 0 at the crown, NP at the pin
const XJ = j => -SPAN / 2 * U(j);  // the half that is written: x <= 0

/* GROW: how many panels in from the pin have been riveted. The arch closes at
   the crown, so building is j counting DOWN from NP. */
const JBUILT = Math.round(NP * (1 - GROW));   // panels above this are not there yet
const up = j => j >= JBUILT;

/* ===================== the deck ===================== */
// 64 bays of the arch's own panel. 28 of them are the arch; the other 36 are
// the approach viaducts, 18 a side. That lands the overall length on 1,149.7 m
// against a published 1,149 - a metre out, and the alternative is a deck whose
// cross girders miss the hangers, which is worse than a metre.
const NBAY = 64, NAP = 18;
const XEND = SPAN / 2 + NAP * P;   // 574571
const HALFW = WIDE / 2;            // 24400
/* NINE stringer lines, and the gaps in them are the whole point.

   The arch comes through the roadway at y = 15 m, and it is not a line: the
   bottom chord is a 3.4 m box and the diagonals stand 2.8 m outside it on the
   face, so the steel occupies 13.3 to 18.7 m either side of the centre. A
   stringer anywhere in that band is a stringer with a bridge through it - the
   first draft put one at 16.4 and the report found it four times.

   So the lines are inside it and outside it and nowhere in it:
   0, 6.5, 12.5 - then the arch - then 20.5 and the 24.4 m edge. */
const SY = [0, 6500, 12500];                    // inside the arch: the roadway
const SYO = [20500, HALFW];                     // outside it: the footway
const GY = 13000, GO = 19200;                   // where the three girders stop
/* And the cross girder is SHALLOW. 2.4 m over 48.8 m is not much, but this is
   a grillage on hangers a panel apart, not a simple span - and the depth is
   set by the one place it is tight: at the tenth node the bottom chord passes
   1.1 m under the roadway, and a 3.5 m girder there is a girder with a chord
   through it. 2.4 m clears by 440. */
const CGH = 2400, STH = 1000;
const CGT = ZDK - STH - 50;                     // top of the girder
const CGZ = CGT - CGH / 2;
const STZ = ZDK - STH / 2;                      // stringers, their top AT the deck
const PIERN = 6, PIERE = 3;        // six piers a side, every three bays -
                                   // the sixth is the abutment the deck ends on

/* ===================== the pylons ===================== */
/* Right at the springing and just outside it, straddling the roadway, which is
   what the elevation shows: the arch lands between the two of them. Everything
   here is mine except the 89 m. */
const PYX = SPAN / 2 + 16000, PYY = 33500;
/* Five lifts, not three. A pylon is a tapered tower and PLATE3D has no tapered
   member, so the taper is a staircase - and three steps up 89 m is a staircase
   you can count from the far side of the harbour. Five is fine at that
   distance, and the step is 1.5 m on 30. */
const NPY = 5;
const PYB = [], PYD = [], PYF = [];             // along the bridge, across it, top
for (let k = 0; k < NPY; k++) {
  const t = k / (NPY - 1);
  PYB.push(Math.round(30000 - 6000 * t));
  PYD.push(Math.round(15000 - 3000 * t));
  PYF.push((k + 1) / NPY);
}
const PYT = 80;                                 // the skin
const PYH = PYF.map((f, i) => (ZPY - MSL) * (f - (i ? PYF[i - 1] : 0)));
const PYZ = PYF.map((f, i) => MSL + (ZPY - MSL) * ((i ? PYF[i - 1] : 0) + f) / 2);

const r1 = v => Math.round(v * 10) / 10;
const R = [];
const push = (...r) => R.push(r);
const blank = () => R.push([]);

/* row writers - the same two forms the tower uses */
const HDR_MOD = ['# MODULE', 'id', 'member', 'Ref.Pt', 'L.X', 'L.Y', 'L.Z',
                 'PLANE', 'ROT.X', 'ROT.Y', 'ROT.Z', 'dx', 'dy', 'dz', 'rep'];
const HDR_AX = ['# MODULE', 'id', 'member', 'Ref.Pt', 'LX1', 'LY1', 'LZ1',
                'LX2', 'LY2', 'LZ2', 'OFF_B', 'OFF_E', 'Alpha',
                'dx', 'dy', 'dz', 'rep'];
let form = '';
const MADE = new Set();
/* Where a module's datum actually LANDS, and it is not where it reads.

   `MODULE <id> BASE <member> mc` names a datum; it does not move anything. The
   ASSY row that places the module has to name the SAME point, or the module is
   translated by the difference.

   And `mc` is the mid-centre of the section's PROFILE, taken at the member's
   START - not the middle of the member. The nine names (tl tc tr ml mc mr bl
   bc br) are points on the cross section; the member's own length has nothing
   to do with them. Reading `mc` as mid-length cost an afternoon here: it put
   the arch 8.9 m along and 634 mm up, the bracing 15 m off centre - which is
   exactly the half-spacing of the two trusses, so every cross strut ran down
   the middle of a chord - and the deck 24.4 m sideways, which is exactly half
   its width. Three separate "impossible" clashes, one arithmetic mistake.

   The tell was that the clash did not move when the strut's end trim went from
   1.85 m to 6 m. A trim that changes nothing is not the thing that is wrong.

   So: every module is written where it stands, and A() remembers the START of
   the first member of each section for the ASSY row to quote back. */
const DATUM = {}, COUNT = {};
function A(id, mem, a, b, ob, oe) {
  ob = ob || 0; oe = oe || 0;
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const L = Math.hypot(d[0], d[1], d[2]);
  if (L < ob + oe + 500) return;                 // nothing left after the trims
  if (form !== 'a') { push.apply(null, HDR_AX); form = 'a'; }
  push('MODULE', id, mem, '', r1(a[0]), r1(a[1]), r1(a[2]),
       r1(b[0]), r1(b[1]), r1(b[2]), ob ? r1(ob) : '', oe ? r1(oe) : '', '');
  MADE.add(id);
  const k = id + '|' + mem;
  COUNT[k] = (COUNT[k] || 0) + 1;
  if (!DATUM[k]) DATUM[k] = [a[0], a[1], a[2]];
}
/* BASE names an INSTANCE, not a section. `BASE sc.uc` makes the engine say
   "SC.UC names 14 members - taking the first" on the panel every time the book
   is opened, which is a warning about the sheet being vague rather than about
   anything being wrong. `sc.uc_1` is that same first member said out loud, and
   the panel goes quiet. */
function BASE_(id, mem) {
  if (!MADE.has(id)) return;
  if (form !== 'm') { push.apply(null, HDR_MOD); form = 'm'; }
  // and _1 only when there IS more than one: a section used once keeps its own
  // name, and asking for SC.PY1_1 where only SC.PY1 exists is an error, not a
  // warning - the module falls back to the origin and the pylon walks off.
  push('MODULE', id, 'BASE', mem + (COUNT[id + '|' + mem] > 1 ? '_1' : ''), 'mc');
  form = '';
}
const AT = (id, mem) => DATUM[id + '|' + mem] || [0, 0, 0];

push('COORD', 'ZUP');
blank();

/* ===================== sections ===================== */
// Square boxes for the arch. A chord that turns at every node leans one way
// only here - the arch is a plane truss - but the box is what the bridge is
// built of and it is also the section that never has to be told which way is
// up.
push('# SECT', 'id', 'mat', 'length', 'TYPE', 'base.pt',
     'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7');
push('SECT', 'sc.uc', 'SM490', r1(P), 'R', 'mc', 3200, 3200, 45, 0);
push('SECT', 'sc.lc', 'SM490', r1(P), 'R', 'mc', 3400, 3400, 50, 0);
push('SECT', 'sc.av', 'SM490', 30000, 'R', 'mc', 1600, 1600, 25, 0);
push('SECT', 'sc.sh', 'SM490', r1(DP), 'R', 'mc', 5000, 5000, 90, 0);
push('SECT', 'sc.ad', 'SM490', 36000, 'R', 'mc', 1800, 1800, 28, 0);
push('SECT', 'sc.cs', 'SM490', 26000, 'R', 'mc', 2000, 2000, 30, 0);
push('SECT', 'sc.cd', 'SM490', 34000, 'R', 'mc', 1200, 1200, 20, 0);
push('SECT', 'sc.hg', 'SM490', 40000, 'R', 'mc', 900, 900, 30, 0);
push('SECT', 'sc.ps', 'SM490', 30000, 'R', 'mc', 1400, 1400, 25, 0);
push('SECT', 'sc.cg', 'SM490', r1(2 * GY), 'H', 'mc', CGH, 1000, 1000, 22, 40, 40, 24);
push('SECT', 'sc.st', 'SM490', r1(P), 'H', 'mc', STH, 400, 400, 12, 20, 20, 14);
/* The pylons, three lifts of one rectangular box each, and the box IS the
   pylon - not a frame standing inside one. They are granite in life and this
   sheet has no stone in it, so they are written as an 80 mm skin: thick enough
   to be a section and thin enough that the tonnage they add is a number you
   can subtract rather than a number that eats the bridge. The generator prints
   what they weigh so the steel figure can be quoted without them. */
/* Across the bridge FIRST, along it second. A box on a vertical member has no
   "up" to line its section up with, so the engine takes the first dimension
   across. Written the natural way round - 30 along the bridge, 15 across - the
   pylons came out 30 m wide and ate the footway. */
for (let k = 0; k < NPY; k++)
  push('SECT', 'sc.py' + (k + 1), 'SM490', r1(PYH[k]), 'R', 'mc',
       PYD[k], PYB[k], PYT, 0);
push('SECT', 'sc.ic', 'SM490', r1(ZDK - MSL), 'R', 'mc', 2400, 2400, 50, 0);
push('SECT', 'sc.ir', 'SM490', 30000, 'H', 'mc', 1400, 700, 700, 18, 26, 26, 20);
blank();

/* ===================== a quarter of the arch ===================== */
push('#', 'ONE HALF OF ONE ARCH TRUSS - mirrored about the crown, then about the centre line');
/* Clearances, and each one is a clash the report found.

   A CHORD IS A PIECE PER PANEL, and 200 comes off each end. The chord turns
   about three degrees at every node, so two 3.2 m boxes meeting there overlap
   by about 85 mm however you draw them. Each panel of the real arch is a
   piece too, spliced at the node.

   A WEB MEMBER STOPS AT THE FACE OF THE CHORD, not at its centre line: half
   the chord plus 300. Run to the node and every vertical is buried a metre
   and three quarters into both chords.

   AND THE DIAGONALS ARE ON THE OUTSIDE FACE. A vertical and a diagonal that
   both reach the same node are the same steel twice. The real truss puts its
   web plates either side of the chord box; this one puts the diagonal on the
   outer face, 2,100 off the truss plane, and then a diagonal cannot meet a
   vertical anywhere. */
/* Every trim here is a number, not a guess, and each one answers a clash the
   report found.

   A CHORD IS A PIECE PER PANEL, and what comes off each end is what the KINK
   at that node costs: half the box times the tangent of half the turn. The
   chord turns three degrees near the crown and seventeen at the last node
   before the pin, so a constant offset is either a gap at the crown or steel
   through steel at the springing. This one is neither: it is 60 mm of clearance
   plus exactly the overlap the geometry makes. At the crown the turn is twice
   the first panel's slope, because the other half of the arch is a mirror.

   A WEB MEMBER STOPS AT THE FACE OF THE CHORD, and the face of a LEANING chord
   is further away than half its depth: a 3.6 m box on a 40 degree slope is
   4.7 m deep measured up the vertical. Trimming by half the box put every
   vertical a metre into both chords near the haunch, which is where the arch
   leans most.

   AND THE DIAGONALS ARE ON THE OUTSIDE FACE, 2,800 off the truss plane, which
   is half the chord plus half the diagonal plus 300. A vertical and a diagonal
   that both run to the same node are the same steel twice; put the diagonal on
   the outer face and it cannot meet a vertical anywhere. The real truss has its
   web plates either side of the chord box for the same reason. */
const half = { uc: 1600, lc: 1700 };
// The slope of panel j, as an ANGLE and not an atan2. atan2 answers in all four
// quadrants, and a chord drawn from the crown outwards runs in -x, so atan2
// returns 176 degrees where the slope is 4 - which took the tangent of 176 for
// the crown offset and put a metre and a third of chord through its own mirror
// image. A chord is never vertical. atan is enough.
const ang = (zf, j) => Math.atan((zf(U(j + 1)) - zf(U(j))) / (XJ(j + 1) - XJ(j)));
function kink(zf, j) {
  if (j <= 0) return 2 * Math.abs(ang(zf, 0));   // the crown, against its mirror
  if (j >= NP) return 0;                         // the pin: the chord stops
  return Math.abs(ang(zf, j) - ang(zf, j - 1));
}
const chordOff = (zf, S, j) => r1(S * Math.tan(kink(zf, j) / 2) + 150);
// How far a member has to stop short of a LEANING chord, straight up. Two
// terms, and the second is the one that was missing. S/cos t is the chord's own
// half depth measured vertically - a 3.6 m box on a 40 degree slope is 4.7 m
// deep that way. Then w*tan t, because the arriving member is not a line
// either: its own corner, w off its axis, reaches further under the slope than
// its centre does. Leaving that out is 950 mm at the haunch, which is exactly
// what the report kept finding.
const steep = (zf, j) => Math.max(j > 0 ? Math.abs(ang(zf, j - 1)) : 0,
                                  j < NP ? Math.abs(ang(zf, j)) : 0);
/* The same question asked anywhere along a chord rather than at a node, for the
   deck's own stations - which are the deck's grid now and not the arch's. */
const slopeAt = (zf, u) => {
  const h = 0.004, a = Math.max(0, u - h), b = Math.min(1, u + h);
  return Math.abs(Math.atan((zf(b) - zf(a)) / ((b - a) * -SPAN / 2)));
};
const faceAt = (zf, S, u, w) => {
  const t = slopeAt(zf, u);
  return r1(S / Math.cos(t) + w * Math.tan(t) + 400);
};
function faceUp(zf, S, j, w) {
  const t = steep(zf, j);
  return r1(S / Math.cos(t) + w * Math.tan(t) + 400);
}
const DGY = 2800;
for (let j = 0; j < NP; j++) {                 // panels: j to j+1, crown outward
  if (!up(j)) continue;
  const x0 = XJ(j), x1 = XJ(j + 1), u0 = U(j), u1 = U(j + 1);
  A('md.arh', 'sc.uc', [x0, -BY, zup(u0)], [x1, -BY, zup(u1)],
    chordOff(zup, half.uc, j), chordOff(zup, half.uc, j + 1));
  A('md.arh', 'sc.lc', [x0, -BY, zlo(u0)], [x1, -BY, zlo(u1)],
    chordOff(zlo, half.lc, j), chordOff(zlo, half.lc, j + 1));
  /* One diagonal a panel, leaning back toward the crown - the way the load
     runs out of an arch and into the pin. */
  A('md.arh', 'sc.ad', [x0, -BY - DGY, zlo(u0)], [x1, -BY - DGY, zup(u1)],
    faceUp(zlo, half.lc, j, 900), faceUp(zup, half.uc, j + 1, 900));
}
for (let j = 1; j < NP; j++) {                 // verticals, crown and pin excluded
  if (!up(j)) continue;
  const u = U(j), x = XJ(j);
  A('md.arh', 'sc.av', [x, -BY, zlo(u)], [x, -BY, zup(u)],
    faceUp(zlo, half.lc, j, 800), faceUp(zup, half.uc, j, 800));
}
/* And the casting the two chords land on: the vertical at the pin, which the
   loop above stops one short of so that it is not written twice. It is the last
   member of the arch and the only one that is not steel doing structure - it is
   the bearing, and the two hinges of a two-hinged arch are these. */
if (up(NP - 1)) A('md.arh', 'sc.sh', [XJ(NP), -BY, zlo(1)], [XJ(NP), -BY, zup(1)],
                  faceUp(zlo, half.lc, NP, 2500), faceUp(zup, half.uc, NP, 2500));
BASE_('md.arh', 'sc.uc');
blank();

/* ===================== across the bridge ===================== */
push('#', 'CROSS BRACING AND HANGERS - one half, mirrored about the crown');
/* The two trusses are braced in the plane of each chord, and with ONE diagonal
   a bay rather than an X. Two crossing diagonals meet in the middle of the bay
   and that middle is one point of steel shared - the tower's braces cost five
   rounds of the clash report before they were pulled off the face. A Warren in
   plan has no crossing at all. */
// A member arriving along y stops short of the chord by the chord's own half
// width PLUS its own, because a box is not a line either way round.
const CSO = half.uc + 1000 + 300, CSL = half.lc + 1000 + 300;
const CDO = half.uc + 600 + 300;
// The plan bracing hangs under the top chord, and how far under depends on how
// steep the chord is there: a 3.2 m box on a 56 degree slope is 5.7 m deep
// measured vertically, and 2.4 m of drop leaves the bracing inside it.
const PB = j => r1(half.uc / Math.cos(steep(zup, j)) + 600 + 900);
/* A strut is written only where it CLEARS THE ROADWAY, and it is asked the
   same question whichever chord it is on. The deck's girders occupy a band
   3,550 to 5,950 below the roadway right across the bridge, and both chords
   cross that band on their way down to the pins - the bottom one at the tenth
   node, the top one at the thirteenth. A strut there is a strut through the
   deck it is holding up. Those two panel points are braced by the ones either
   side of them, which is what the real bridge does at the same place and for
   the same reason. */
// The deck is everything from the bottom of its girders to the road surface -
// 3,450 of girder and then a metre of stringer. Measuring only to the girders
// let a strut sit 30 mm clear of them and straight through twelve stringers.
const clearsDeck = z => z + 1000 < CGZ - CGH / 2 || z - 1000 > ZDK;
for (let j = 1; j <= NP; j++) {
  if (!up(j - 1)) continue;
  const x = XJ(j), u = U(j);
  if (clearsDeck(zup(u)))
    A('md.brc', 'sc.cs', [x, -BY, zup(u)], [x, BY, zup(u)], CSO, CSO);
  if (clearsDeck(zlo(u)))
    A('md.brc', 'sc.cs', [x, -BY, zlo(u)], [x, BY, zlo(u)], CSL, CSL);
}
/* Plan bracing: ONE diagonal a bay, not an X. Two crossing diagonals meet in
   the middle of the bay and that middle is one point of steel shared - the
   tower's braces cost five rounds of the clash report before they were pulled
   off the face. A Warren in plan never crosses itself. It hangs 2,400 under
   the top chord so it clears both the chord and the struts at the nodes. */
for (let j = 0; j < NP; j++) {
  if (!up(j)) continue;
  /* Not across the roadway. In the last panels but one the top chord dives from
     above the deck to below it, and a diagonal drawn from one end to the other
     goes through the roadway on the way - which is a diagonal through six
     stringers. The arch there is braced by its struts; the panel that crosses
     the deck is the one panel that cannot have a diagonal in plan. */
  const zA = zup(U(j)), zB = zup(U(j + 1));
  if ((zA > ZDK + 3000) !== (zB > ZDK + 3000)) continue;
  const s2 = j % 2 ? 1 : -1;
  // and the plan diagonal is trimmed along ITS axis, which is longer than the
  // 30 m it crosses - so the trim is scaled by that ratio or it falls short.
  const L2 = Math.hypot(P, 2 * BY), CD = r1(CDO * L2 / (2 * BY));
  A('md.brc', 'sc.cd', [XJ(j), s2 * BY, zup(U(j)) - PB(j)],
                       [XJ(j + 1), -s2 * BY, zup(U(j + 1)) - PB(j + 1)], CD, CD);
}
/* The hangers and the posts are the same member and one rule: a vertical
   between the deck and the nearest chord. Above the roadway the lower chord
   hangs it; below the roadway the lower chord is too far down and the TOP
   chord is what the deck stands on - which is what the last two panels of the
   real bridge do, and if you stand the post on the lower chord there instead
   it goes straight through the top chord on its way up. */
for (let m = 1; m <= NDK; m++) {         // the DECK's stations, not the arch's
  const u = m / NDK;
  if (u < US[JBUILT] - 1e-9) continue;   // that station is not under an arch yet
  const x = -SPAN / 2 * u;
  /* Whichever chord is NEARER the roadway, which is the only rule that works
     the whole way along. Near the crown that is the bottom chord and the member
     hangs; past the crossing the bottom chord has dived and the top chord is
     what the deck stands on. Choosing by a fixed height instead put a post at
     the thirteenth station on the bottom chord and sent it up through the top
     one on the way. Where the nearer chord is at deck level there is nothing to
     write - the deck bears on the truss directly - and A() drops it. */
  const onTop = Math.abs(zup(u) - ZDK) < Math.abs(zlo(u) - ZDK);
  const zf = onTop ? zup : zlo, S = onTop ? half.uc : half.lc;
  const z = zf(u), hang = z > ZDK;
  const t = faceAt(zf, S, u, hang ? 450 : 700);
  [-BY, BY].forEach(y => A('md.brc', hang ? 'sc.hg' : 'sc.ps',
    [x, y, z], [x, y, hang ? CGT : CGZ - CGH / 2], t, 100));
}
BASE_('md.brc', 'sc.cs');
blank();

/* ===================== the crown line ===================== */
push('#', 'THE CROWN - the four members that stand ON the mirror plane, so they are placed once');
// 19 August 1930, and the only members in the file that cannot be mirrored:
// anything at x = 0 would be reflected onto itself.
if (GROW >= 1) {
  [-BY, BY].forEach(y => A('md.crn', 'sc.av', [0, y, zlo(0)], [0, y, zup(0)],
    faceUp(zlo, half.lc, 0, 800), faceUp(zup, half.uc, 0, 800)));
  A('md.crn', 'sc.cs', [0, -BY, zup(0)], [0, BY, zup(0)], CSO, CSO);
  A('md.crn', 'sc.cs', [0, -BY, zlo(0)], [0, BY, zlo(0)], CSL, CSL);
  [-BY, BY].forEach(y => A('md.crn', 'sc.hg', [0, y, zlo(0)], [0, y, CGT],
    faceUp(zlo, half.lc, 0, 450), 100));
  BASE_('md.crn', 'sc.av');
}
blank();

/* ===================== one deck bay ===================== */
push('#', 'ONE DECK BAY - a cross girder and seven stringers, copied sixty-four times');
/* The cross girder hangs UNDER the stringers rather than framing into them:
   4.9 m of girder with the stringers sitting on top is how a deck this wide is
   built, and it also means a stringer never has to be cut. The 50 mm between
   the two is a gap, not a joint - steel that only touches is not a clash, but
   steel that touches is also nothing to look at. */
/* THREE girders a bay, not one, and the gap between them is the arch.

   A 48.8 m cross girder in one piece is a girder with an arch truss through it:
   at the tenth node and outwards the web of the arch stands in the roadway, and
   twelve of those were the last exact clashes in the model. Cutting the girder
   at the arch is not a dodge round the report - it is what the bridge does.
   The roadway and the railway run BETWEEN the two arch trusses and the footway
   and the cycleway run OUTSIDE them, which is why you walk across the Sydney
   Harbour Bridge on the outside of the steel and drive through the middle of
   it. Three girders, two of them footway brackets, and the stringers sit on
   whichever one is under them. */
A('md.dkb', 'sc.cg', [-XEND, -GY, CGZ], [-XEND, GY, CGZ]);
[-1, 1].forEach(sg => A('md.dkb', 'sc.cg',
  [-XEND, sg * GO, CGZ], [-XEND, sg * HALFW, CGZ]));
SY.concat(SYO).forEach(y => [-1, 1].forEach(sg => {
  if (y === 0 && sg === 1) return;
  A('md.dkb', 'sc.st', [-XEND, sg * y, STZ], [-XEND + P, sg * y, STZ]);
}));
BASE_('md.dkb', 'sc.cg');
blank();

/* ===================== one pylon ===================== */
push('#', 'ONE PYLON - 89 m of granite over a steel frame, and it carries nothing');
// Four of them and not one of them is structural: they were added because a
// bare steel arch was thought to need an anchor for the eye. Modelled as the
// frame inside the stone, which is the only part of a pylon a steel sheet has
// anything to say about.
if (GROW >= 1) {
  for (let k = 0; k < NPY; k++)
    A('md.pyl', 'sc.py' + (k + 1),
      [-PYX, -PYY, MSL + (ZPY - MSL) * (k ? PYF[k - 1] : 0)],
      [-PYX, -PYY, MSL + (ZPY - MSL) * PYF[k]], 0, 0);
  BASE_('md.pyl', 'sc.py1');
}
blank();

/* ===================== one approach pier ===================== */
push('#', 'ONE APPROACH PIER - six a side, every third bay, the last one the abutment');
const PIB = 12000, PID = 34000, PIX = -(SPAN / 2 + PIERE * P);
const pic = [[PIX - PIB / 2, -PID / 2], [PIX + PIB / 2, -PID / 2],
             [PIX + PIB / 2, PID / 2], [PIX - PIB / 2, PID / 2]];
if (GROW >= 1) {
  pic.forEach(c => A('md.pie', 'sc.ic', [c[0], c[1], MSL], [c[0], c[1], CGZ - CGH / 2], 0, 100));
  for (let k = 0; k <= 2; k++) {
    const z = MSL + (CGZ - CGH / 2 - MSL) * k / 2;
    if (k === 2) continue;                        // the deck is the top ring
    for (let i = 0; i < 4; i++) {
      const a = pic[i], b = pic[(i + 1) % 4];
      A('md.pie', 'sc.ir', [a[0], a[1], z], [b[0], b[1], z], 1500, 1500);
    }
  }
  BASE_('md.pie', 'sc.ic');
}
blank();

/* ===================== the drawings ===================== */
if (!staged) {
push('# VIEW', 'module', 'dir', 'AZ', 'EL', 'scale', 'title');
/* RIGHT looks ALONG the bridge, which is the only direction a cross section can
   be taken in. The first cut asked for the deck bay FRONT and called it a cross
   section; FRONT looks across the bridge, and since VIEW draws a module at
   every placement, sixty-four bays came out side by side as a 1,150 m strip.
   It was a drawing - it was just an elevation of the whole deck with CROSS
   SECTION written on it.

   Looking along the bridge instead, those same sixty-four placements land on
   top of each other and the drawing is one bay, seen the way a section is
   seen.

   Which is also why the section through the ARCH is taken on md.crn and not on
   md.brc. Both are bracing; the difference is that md.brc has a strut at every
   one of fourteen heights and md.crn has its four members at ONE station. Look
   along the bridge at md.brc and all fourteen land on top of each other - not
   a section, a smear of the whole arch's bracing, and it was on the sheet
   titled SECTION THROUGH THE ARCH. A section wants a module that lives at one
   station, and at the crown that is exactly what md.crn is. */
push('VIEW', 'ALL', 'FRONT', '', '', 2000, 'SYDNEY HARBOUR BRIDGE - GENERAL ARRANGEMENT');
push('VIEW', 'ALL', 'TOP', '', '', 2000, 'SYDNEY HARBOUR BRIDGE - PLAN');
push('VIEW', 'md.arh', 'FRONT', '', '', 1000, 'THE ARCH - ELEVATION');
push('VIEW', 'md.brc', 'TOP', '', '', 1000, 'ARCH BRACING - PLAN');
push('VIEW', 'md.crn', 'RIGHT', '', '', 200, 'SECTION THROUGH THE ARCH AT THE CROWN');
push('VIEW', 'md.brc', 'FRONT', '', '', 1000, 'HANGERS AND POSTS - ELEVATION');
push('VIEW', 'md.dkb', 'RIGHT', '', '', 100, 'THE DECK - CROSS SECTION');
push('VIEW', 'md.pyl', 'RIGHT', '', '', 300, 'THE PYLONS - SECTION');
push('VIEW', 'md.pie', 'RIGHT', '', '', 200, 'APPROACH PIER - SECTION');
blank();
}

/* ===================== the assemblies ===================== */
/* Every module is written WHERE IT STANDS, so every ADD row quotes that
   module's own datum straight back at it and moves nothing. Then MIR, COPY and
   ROT do all the placing - which is the point: the file contains a quarter of
   an arch, one deck bay, one pylon and one pier, and the bridge is what the
   assembly rows make of them. */
const DATUM_OF = { 'md.arh': 'sc.uc', 'md.brc': 'sc.cs', 'md.crn': 'sc.av',
                   'md.dkb': 'sc.cg', 'md.pyl': 'sc.py1', 'md.pie': 'sc.ic' };
const put = (as, md) => { const d = AT(md, DATUM_OF[md]);
  push('ASSY', as, md, 'ADD', r1(d[0]), r1(d[1]), r1(d[2])); };

push('# ASSY', 'id', 'ref', 'cmd', 'G.X', 'G.Y', 'G.Z', 'PLANE');
push('#', 'THE ARCH - a quarter written, mirrored about the crown and the centre line');
if (MADE.has('md.arh')) {
  put('as.arh', 'md.arh');
  push('ASSY', 'as.arh', 'as.arh', 'MIR', 0, 0, 0, 'YZ');
  push('ASSY', 'as.arh', 'as.arh', 'MIR', 0, 0, 0, 'XZ');
}
blank();
push('# ASSY', 'id', 'ref', 'cmd', 'G.X', 'G.Y', 'G.Z', 'PLANE');
push('#', 'BRACING AND HANGERS - across the bridge already, so the crown mirror only');
if (MADE.has('md.brc')) {
  put('as.brc', 'md.brc');
  push('ASSY', 'as.brc', 'as.brc', 'MIR', 0, 0, 0, 'YZ');
}
blank();
push('# ASSY', 'id', 'ref', 'cmd', 'G.X', 'G.Y', 'G.Z');
push('#', 'THE CROWN - placed once, and never mirrored');
if (MADE.has('md.crn')) put('as.crn', 'md.crn');
blank();
push('# ASSY', 'id', 'ref', 'cmd', 'G.X', 'G.Y', 'G.Z', 'rep');
push('#', 'THE DECK - one bay, sixty-four of them, end to end');
if (MADE.has('md.dkb')) {
  put('as.dck', 'md.dkb');
  push('ASSY', 'as.dck', 'as.dck', 'COPY', r1(P), 0, 0, NBAY - 1);
}
blank();
push('# ASSY', 'id', 'ref', 'cmd', 'G.X', 'G.Y', 'G.Z', 'PLANE');
push('#', 'THE PYLONS - four, and the same one');
if (MADE.has('md.pyl')) {
  put('as.pyl', 'md.pyl');
  push('ASSY', 'as.pyl', 'as.pyl', 'MIR', 0, 0, 0, 'YZ');
  push('ASSY', 'as.pyl', 'as.pyl', 'MIR', 0, 0, 0, 'XZ');
}
blank();
push('# ASSY', 'id', 'ref', 'cmd', 'G.X', 'G.Y', 'G.Z', 'rep');
push('#', 'THE APPROACH PIERS - six up one side, then the other side is a mirror');
if (MADE.has('md.pie')) {
  put('as.pie', 'md.pie');
  push('ASSY', 'as.pie', 'as.pie', 'COPY', r1(-PIERE * P), 0, 0, PIERN - 1);
  push('ASSY', 'as.pie', 'as.pie', 'MIR', 0, 0, 0, 'YZ');
}
push('END');

/* ===================== write ===================== */
(async () => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PLATE3D';
  const ws = wb.addWorksheet('input');
  const at = (kw, id) => R.findIndex(r => r[0] === kw && (id === undefined || r[1] === id));
  const notes = {};
  const note = (i, t) => { if (i >= 0) notes[i] = t; };
  note(0, 'SYDNEY HARBOUR BRIDGE  ·  503 m arch, 1,149 m overall  ·  mm, Z up');
  note(at('SECT', 'sc.uc'), 'arch top chord - a box, one piece per panel');
  note(at('SECT', 'sc.lc'), 'arch bottom chord - the one that comes through the roadway');
  note(at('SECT', 'sc.hg'), 'hanger. The same section stands as a post where the chord is below the deck');
  note(at('SECT', 'sc.cg'), 'deck cross girder, in three pieces a bay - the arch comes through the roadway');
  note(at('SECT', 'sc.py1'), 'pylon, lift 1 of 5. GRANITE in life: written as an 80 mm skin, and 18,037 t of the total is this');
  note(at('#', 'ONE HALF OF ONE ARCH TRUSS - mirrored about the crown, then about the centre line') + 1,
      'the BOTTOM chord is the parabola: 106 m at the crown, and the depth stands on it');
  note(at('#', 'THE CROWN - the four members that stand ON the mirror plane, so they are placed once') + 1,
      'a member on the mirror plane would be reflected onto itself');
  note(at('#', 'ONE DECK BAY - a cross girder and seven stringers, copied sixty-four times') + 1,
      'the stringer lines are at 0 / 8.2 / 16.4 / 24.4 m: nothing at 15, which is where the arch comes through');
  note(at('# VIEW'), 'nine drawings. VIEW on a module draws every place it is put');
  note(at('# ASSY'), 'MIR twice and the arch is four half-trusses from one');
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
  const pyv = PYB.reduce((a, b, i) =>
    a + (b * PYD[i] - (b - 2 * PYT) * (PYD[i] - 2 * PYT)) * PYH[i], 0) * 4;
  console.log('wrote ' + OUT + '  (' + R.length + ' rows)');
  console.log('  four pylons as an ' + PYT + ' mm skin: ' +
              (pyv * 7.85e-6 / 1000).toFixed(0) + ' t of the total, and granite in life');
})();
