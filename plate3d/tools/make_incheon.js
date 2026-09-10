// PLATE3D_INCHEON.xlsx - the Incheon Bridge, at full size, in mm.
//
// THIS ONE IS MEASURED, NOT REMEMBERED. The first draft of this file was built
// from what I could recall of the bridge and it did not look like it, for the
// same reason the Harbour Bridge did not: a shape recalled is a shape guessed.
// Then the general arrangement, the pylon drawing and the deck section turned
// up, and the work stopped being drawing and became reading.
//
// Everything below is off those drawings:
//
//   spans          80 + 260 + 800 + 260 + 80 = 1,480 m
//   pylon          230.5 m, in lifts of 5 + 55 + 115 + 55.5
//   legs           70 m apart at the footing, 45 m apart at the deck
//   cables         26 a plane a side of each pylon - 208 in all
//   main span      22.5 m to the first, then 2 at 11.25, then 23 at 15
//   deck           33.4 m wide, a 17.6 m box with 8.06 m brackets, 1,371 deep
//   clearance      74 m, over a 625.5 m shipping passage
//
// THE KINK IN THE LEG IS A PREDICTION THAT LANDED. The pylon is an inverted Y
// and its legs are NOT one straight line: they rise almost vertically to 60 m
// and then converge to the shaft at 175 m. Nothing on the drawing says where
// that kink is - it is read off the 55 m and 115 m lifts. Take the leg axis
// from 30 m at the footing to 26 m at the kink and run it to the shaft, and
// the legs come out 45,050 apart where the deck passes between them. The
// drawing says 45,000. That agreement is why this file trusts the two-slope
// leg rather than fitting a curve to a photograph.
//
// AND THE CABLES ARE STRAIGHT, which is the reason this bridge is worth doing
// in PLATE3D at all. The Golden Gate's main cable is a parabola and had to be
// sawn into 130 straight pieces to be written; a stay IS a straight line from
// an anchorage in the pylon to one in the deck, so one stay is one row. There
// is no approximation anywhere in this file. Nothing is sampled, nothing is
// chorded, nothing is close enough at this scale.
//
// THE DECK'S PANEL POINTS ARE THE CABLE POINTS. They are not a regular grid -
// 22.5, then 11.25 twice, then 15 - so the deck cannot be one bay copied the
// way the other bridges' decks are. It is written as a run between the points
// the cables actually land on, because a stay that lands between two cross
// beams lands on nothing.
//
// THE PAINT IS NOT IN THIS FILE. For a picture or a film:
//
//   COLOURS=md.pyl=#dfe6ee,md.stay=#f8fafc,md.dck=#8fa0b3,md.pie=#c3cdd8 \
//     node tools/shot_ggb.js PLATE3D_INCHEON.xlsx
const ExcelJS = require('exceljs');
const OUT = process.argv[2] || __dirname + '/../PLATE3D_INCHEON.xlsx';

/* ===================== off the drawings ===================== */
const MAIN = 800000, SIDE = 260000, END = 80000;
const XP = MAIN / 2;                    // 400000  pylon W1
const XW2 = XP + SIDE;                  // 660000  pier W2
const XW3 = XW2 + END;                  // 740000  pier W3, and the deck's end
const CLR = 74000;                      // the shipping passage, 625.5 m x 74 m
const GD = 1371;                        // girder depth
const WIDE = 33400, BOXW = 17600;       // deck, and the box inside it
const WY = BOXW / 2;                    // 8800    the box webs
const AY = 16000;                       // where a stay lands on the deck
/* THE PYLON IS A LOZENGE, NOT A Y, and that is what was wrong with it.

   The legs do not rise from a wide base and converge. They start 32 m apart at
   the footing, SPLAY OUT to 45 m at the crossbeam, and only then converge to
   the node. Below the deck it is a diamond; above it, one shaft. Read as a
   simple inverted Y - legs wide at the bottom, meeting at the top - it comes
   out a different bridge, which is exactly what it did.

   Every level here is an EL off the drawing, and EL 0.000 is mean sea level:

     EL  13.000   bottom of pylon            32 m between the leg axes
     EL  68.000   crossbeam, and the widest  45 m - the deck bears on it
     EL 167.500   the pylon node             the legs become one shaft
     EL 189.800   bottom of the anchorage    the steel box, 40.8 m of it
     EL 230.600   top of the anchorage
     EL 238.500   top of pylon               225.5 m of pylon in all           */
const ZF = 13000, ZK = 68000, ZJ = 167500, ZPY = 238500;
const YB = 16000, YK = 22500;           // half of 32,000 and half of 45,000
const XBT = 75583;                      // top of the crossbeam - the deck sits here
const SHY = 6000, SHX = 7000;           // the shaft
const ZJS = ZJ;                         // and the shaft starts at the node
const ZN = 165000, ZA = 189800;         // the node: legs still two, then one
const YN = 4300;                        // and where the leg axes are when it starts
const CTOP = 230600, CBOT = 189800;     // the steel box anchorage
/* The deck BEARS ON THE CROSSBEAM - the drawing marks the bearing region right
   there - so its soffit is the crossbeam's top and not a round number of metres
   over the water. 74 m is the clearance at the shipping channel, which is not
   the same thing and not at the pylon. */
const ZG = XBT + GD / 2;
const ZDK = XBT + GD;
const NC = 26;                          // stays a plane a side of a pylon

/* The main span chain, straight off the drawing: 22,500 to the first stay,
   then two at 11,250, then twenty-three at 15,000 - which is 26 stays and
   lands 10,000 short of mid-span, both of them numbers the drawing labels. */
const mainX = () => {
  const out = []; let d = 22500;
  out.push(d);
  for (let i = 0; i < 2; i++) { d += 11250; out.push(d); }
  for (let i = 0; i < 23; i++) { d += 15000; out.push(d); }
  return out;                                   // 26 of them, last at 390,000
};
/* The side span carries the same 26 into 260 m, so they are closer together -
   which is what the drawing shows and why only the main span is labelled
   "15 m SPACES". They stop 13,000 short of pier W2. */
const sideX = () => {
  const a = 22500, b = SIDE - 13000, out = [];
  for (let i = 0; i < NC; i++) out.push(a + (b - a) * i / (NC - 1));
  return out;
};

const r1 = v => Math.round(v * 10) / 10;

/* ============== THE ERECTION SEQUENCE ==============
   STAGE=<n> writes the bridge as it stood at step n. Unset writes the bridge.

   A CABLE-STAYED BRIDGE IS NOT BUILT THE WAY A SUSPENSION BRIDGE IS. On the
   Golden Gate the two towers go up, the cable is spun between them, and the
   deck hangs off it inwards from both towers at once - two towers, one take.
   Here there is no cable to hang from: each pylon has to hold up whatever it
   has already built. So the deck grows OUT OF ONE PYLON IN BOTH DIRECTIONS AT
   THE SAME TIME - main span and side span, one segment each way, then the two
   stays that carry them, then the next pair - and the pylon stays balanced the
   whole way out. Incheon has two pylons, so that happens twice at once, and
   the two cantilevers close on each other at mid-span.

   That is why the stages alternate. A segment and its stays are two beats, not
   one, because on site they are two operations and on film you cannot see the
   second one if it arrives with the first.

     0            piers W2 and W3, and the 80 m end span standing on them
     1 .. 8       the pylon, EL 13 to EL 238.5 in eight lifts
     9            the pier table - the first deck either side of the pylon
     10           stay ring 1, four cables, symmetric
     11, 12       segment 2 both ways, then its stays
     ...          twenty-six rings of that, working out to mid-span
     61           closure: the last 20 m at mid-span, and onto pier W2         */
const SG = process.env.STAGE === undefined || process.env.STAGE === ''
  ? null : Math.round(+process.env.STAGE);
const on = s => SG === null || SG >= s;
const PIER = 0, PYL1 = 1, PYLN = 8;        // the pylon rises over eight stages
const TBL = PYL1 + PYLN;                   // 9  the pier table
const segStage = k => TBL + 2 * k;         // segment k out from the pylon
const stayStage = k => TBL + 1 + 2 * k;    // and the ring of stays that holds it
const CLOSE = stayStage(NC - 1) + 1;       // 61

/* The pylon is clipped by an elevation, not by whole members, so that it
   RISES rather than steps. A part-built taper is a real taper of its own -
   the two end sections interpolated at the height the clip falls at - which
   is a thing TAPER can be asked for directly. */
const PTOP = (SG === null || SG >= TBL) ? ZPY
           : (SG < PYL1 ? -1 : ZF + (ZPY - ZF) * (SG - PYL1 + 1) / PYLN);
const lift = (z0, z1) => PTOP >= z1 ? 1 : (PTOP <= z0 ? 0 : (PTOP - z0) / (z1 - z0));
const upto = (a, b, f) => [a[0] + (b[0] - a[0]) * f,
                           a[1] + (b[1] - a[1]) * f,
                           a[2] + (b[2] - a[2]) * f];
const SDIM = { 'sc.la': [10000, 10000, 120, 0], 'sc.lb': [8000, 8000, 120, 0],
               'sc.lc': [5000, 5000, 120, 0],
               'sc.na': [11062, 7000, 120, 0], 'sc.nb': [6004, 7000, 120, 0] };
const L1 = Math.hypot(YK - YB, ZK - ZF);
const L2 = Math.hypot(YK - YN, ZN - ZK);
const TP = [['tp.lg1', 'sc.la', 'sc.lb', ZF, ZK, L1],
            ['tp.lg2', 'sc.lb', 'sc.lc', ZK, ZN, L2],
            ['tp.nod', 'sc.na', 'sc.nb', ZN, ZA, ZA - ZN]].map(t => {
  const f = lift(t[3], t[4]), part = f > 0 && f < 1;
  return { id: t[0], a: t[1], b: t[2], L: t[5], f: f,
           use: part ? t[0] + 'p' : t[0], end: part ? t[2] + 'p' : t[2],
           part: part };
});

const R = [];
const push = (...r) => R.push(r);
const blank = () => R.push([]);
const HDR_MOD = ['# MODULE', 'id', 'member', 'Ref.Pt', 'L.X', 'L.Y', 'L.Z',
                 'PLANE', 'ROT.X', 'ROT.Y', 'ROT.Z'];
const HDR_AX = ['# MODULE', 'id', 'member', 'Ref.Pt', 'LX1', 'LY1', 'LZ1',
                'LX2', 'LY2', 'LZ2', 'OFF_B', 'OFF_E', 'Alpha'];
let form = '';
const MADE = new Set(), DATUM = {}, COUNT = {}, FIRST = {};
function A(id, mem, a, b, ob, oe) {
  ob = ob || 0; oe = oe || 0;
  const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  if (L < ob + oe + 300) return;
  if (form !== 'a') { push.apply(null, HDR_AX); form = 'a'; }
  push('MODULE', id, mem, '', r1(a[0]), r1(a[1]), r1(a[2]),
       r1(b[0]), r1(b[1]), r1(b[2]), ob ? r1(ob) : '', oe ? r1(oe) : '', '');
  MADE.add(id);
  if (!FIRST[id]) FIRST[id] = mem;
  const k = id + '|' + mem;
  COUNT[k] = (COUNT[k] || 0) + 1;
  if (!DATUM[k]) DATUM[k] = [a[0], a[1], a[2]];
}
// BASE names an INSTANCE, and _1 only when there IS more than one of it here.
function BASE_(id) {
  if (!MADE.has(id)) return;
  const mem = FIRST[id];
  if (form !== 'm') { push.apply(null, HDR_MOD); form = 'm'; }
  push('MODULE', id, 'BASE', mem + (COUNT[id + '|' + mem] > 1 ? '_1' : ''), 'mc');
  form = '';
}
const AT = (id, mem) => DATUM[id + '|' + mem] || [0, 0, 0];

push('COORD', 'ZUP');
blank();

/* ===================== sections ===================== */
/* WALLS ARE A SKIN, not the real thing. The pylon and the piers are concrete
   and this sheet has no concrete; the deck's box has diaphragms and stiffeners
   and this sheet has none of that either. Only the OUTSIDE is modelled, which
   is what the model is for - so every big box here is 120 mm of wall and the
   weight the app shows is the weight of that skin, not of the bridge. Written
   with the real 1.25 m pylon walls it came out at 165,000 t, which is a number
   about nothing. */
push('# SECT', 'id', 'mat', 'length', 'TYPE', 'base.pt',
     'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7');
/* A stay is a PIPE, because a stay is strands inside a sheath and the sheath
   is a pipe. Two sizes: the long ones out to mid-span carry more. */
push('SECT', 'sc.ca', 'SM570', 250000, 'P', 'mc', 200, 14);
push('SECT', 'sc.cb', 'SM570', 150000, 'P', 'mc', 160, 12);
// the deck: a box 17.6 m wide and 1,371 deep, written as its two webs and its
// centre line, with a cross beam at every stay
/* The deck is ONE BOX, not a set of girders. It is 17.6 m wide and 1,371 deep
   and that box is what you see from underneath; the diaphragms and stiffeners
   inside it are not modelled and are not meant to be. The 8.06 m either side is
   a bracket at every stay point, carrying the footway and the anchorage. */
push('SECT', 'sc.gb', 'SM490', 15000, 'R', 'mc', GD, BOXW, 30, 0);
push('SECT', 'sc.br', 'SM490', r1(WIDE / 2 - WY), 'H', 'mc', 1100, 600, 600, 12, 18, 18, 12);
// the pylon: square boxes, because a leaning leg has no up to be told about
/* THE LEGS AND THE NODE ARE VARIABLE SECTION. TAPER builds a member out of two
   already-defined sections - it does not modify one - so these are shapes only,
   never placed; the TAPER rows place what they make of them.

   The sizes come off the five sections through the node. Going up, the pylon is
   two legs 3,567 wide with 2,401 between them (11,062 over all), then two of
   1,650 with 700 between (6,879), then the single anchorage box at 6,004. So the
   node is not a joint - it is twenty-five metres of pylon squeezing two legs
   into one box, and one taper is exactly that. */
push('SECT', 'sc.la', 'SM490', 1000, 'R', 'mc', 10000, 10000, 120, 0);
push('SECT', 'sc.lb', 'SM490', 1000, 'R', 'mc', 8000, 8000, 120, 0);
push('SECT', 'sc.lc', 'SM490', 1000, 'R', 'mc', 5000, 5000, 120, 0);
push('SECT', 'sc.na', 'SM490', 1000, 'R', 'mc', 11062, 7000, 120, 0);
push('SECT', 'sc.nb', 'SM490', 1000, 'R', 'mc', 6004, 7000, 120, 0);
push('SECT', 'sc.p3', 'SM490', r1(ZPY - ZA), 'R', 'mc', 6004, 7000, 120, 0);
push('SECT', 'sc.px', 'SM490', 45000, 'R', 'mc', r1(XBT - ZK), 7000, 120, 0);
push('SECT', 'sc.pc', 'SM490', r1(ZG - GD / 2), 'R', 'mc', 9000, 5000, 120, 0);
/* A pylon caught half way up one of its tapers ends on a section that is not
   in the drawing: the two ends of that taper, interpolated at the height the
   lift reached. It is written out like any other section, because that is
   what it is. */
TP.filter(t => t.part).forEach(t => push('SECT', t.end, 'SM490', 1000, 'R', 'mc',
  ...SDIM[t.a].map((v, i) => r1(v + (SDIM[t.b][i] - v) * t.f))));
blank();

/* ===================== the variable sections ===================== */
push('# TAPER', 'id', 'begin', 'end', 'beg.pt', 'end.pt', 'taper.pt', 'Length');
// mc to mc, because a column is concentric. bc to bc gives it one flat face.
TP.filter(t => t.f > 0).forEach(t =>
  push('TAPER', t.use, t.a, t.end, 'mc', 'mc', 'mc', r1(t.L * t.f)));
blank();

/* ===================== the deck ===================== */
push('#', 'THE DECK - its panel points ARE the stay points, so nothing lands between two cross beams');
/* Every x the deck has a node at: the stays, the pylons, the piers, mid-span
   and the two ends. Built once, sorted, de-duplicated - and the girder is the
   run between them. */
const XS = new Set([0, XP, XW2, XW3]);
mainX().forEach(d => XS.add(XP - d));
sideX().forEach(d => XS.add(XP + d));
const XL = [...XS].sort((a, b) => a - b);
const NODES = XL.slice().reverse().map(x => -x).concat(XL.slice(1)).sort((a, b) => a - b);
/* WHEN EACH NODE ARRIVES. Node k out from a pylon arrives with segment k, on
   both sides of that pylon at once and at both pylons at once - that is what
   balanced cantilever means. Mid-span arrives last, at closure. The piers and
   the 80 m end span standing on them are there from the first frame, because
   that span is built on falsework and not cantilevered out of anything. */
const NST = new Map();
const nk = x => String(r1(x));
const setN = (x, st) => { NST.set(nk(x), st); NST.set(nk(-x), st); };
setN(-XP, TBL);
mainX().forEach((d, k) => setN(-XP + d, segStage(k)));
sideX().forEach((d, k) => setN(-XP - d, segStage(k)));
setN(0, CLOSE);
setN(-XW2, PIER); setN(-XW3, PIER);
const nst = x => { const v = NST.get(nk(x)); return v === undefined ? CLOSE : v; };
// a run needs BOTH its ends built, which is what puts the last 20 m at closure
for (let i = 0; i < NODES.length - 1; i++)
  if (on(Math.max(nst(NODES[i]), nst(NODES[i + 1]))))
    A('md.dck', 'sc.gb', [NODES[i], 0, ZG], [NODES[i + 1], 0, ZG]);
/* One bracket a side at every node, which is every stay point - a stay that
   lands between two brackets lands on nothing. */
NODES.forEach(x => { if (!on(nst(x))) return; [-1, 1].forEach(s =>
  A('md.dck', 'sc.br', [x, s * WY, ZG - 100], [x, s * WIDE / 2, ZG - 100], 200, 0)); });
BASE_('md.dck');
blank();

/* ===================== one pylon ===================== */
push('#', 'ONE PYLON - two legs that flow into one box, not two boxes that step');
/* The legs never meet at a point and there is no hole where they would. They
   splay to the crossbeam, converge to 3.5 m off centre at EL 165 - still two
   legs, 2 m apart - and from there ONE tapered member squeezes 11 m of double
   leg into the 6 m anchorage box by EL 189.8. Written as stepped boxes the same
   twenty-five metres came out as a staircase with a black gap under it. */
/* The kink at the crossbeam turns 21 degrees, so the two legs share steel there
   like any other kink: half the box times the tangent of half the turn. And the
   leg tops stop just short of the node's underside, because an inclined box's
   corner reaches past the level its axis ends at. */
const A1 = Math.atan((YK - YB) / (ZK - ZF)), A2 = Math.atan((YK - YN) / (ZN - ZK));
const KO = r1(4000 * Math.tan((A1 + A2) / 2) + 300);
const TO = r1(2500 * Math.tan(A2) + 400);
/* A lift that has not reached the next kink ends square, so it takes no trim
   at its top - there is nothing above it yet to share steel with. */
const [T1, T2, T3] = TP;
[-1, 1].forEach(s => {
  const a1 = [-XP, s * YB, ZF], b1 = [-XP, s * YK, ZK];
  if (T1.f > 0) A('md.pyl', T1.use, a1, upto(a1, b1, T1.f), 0, T1.f >= 1 ? KO : 0);
  const b2 = [-XP, s * YN, ZN];
  if (T2.f > 0) A('md.pyl', T2.use, b1, upto(b1, b2, T2.f), KO, T2.f >= 1 ? TO : 0);
});
const a3 = [-XP, 0, ZN], b3 = [-XP, 0, ZA], b4 = [-XP, 0, ZPY];
if (T3.f > 0) A('md.pyl', T3.use, a3, upto(a3, b3, T3.f), 0, 0);
const FS = lift(ZA, ZPY);
if (FS > 0) A('md.pyl', 'sc.p3', b3, upto(b3, b4, FS), 0, 0);
/* The crossbeam. 45 m between the leg faces at EL 68, and the deck bears on its
   top at EL 75.583 - which is why the deck in this file is not at a round
   height above the water. */
if (PTOP >= XBT)
  A('md.pyl', 'sc.px', [-XP, -YK, (ZK + XBT) / 2], [-XP, YK, (ZK + XBT) / 2], 6000, 6000);
BASE_('md.pyl');
blank();

/* ===================== the stays ===================== */
push('#', 'THE STAYS - 26 a plane a side of a pylon, 208 in all, and every one of them one row');
/* A semi-fan: the deck end of each stay is where the drawing puts it, and the
   pylon end is spread down the 55.5 m anchorage block - because a pure fan
   asks fifty-two cables to meet at one point. */
/* THE LONGEST STAY ANCHORS HIGHEST. i counts outward along the deck, so i = 0
   is the stay that lands 22.5 m from the pylon and i = 25 is the one that
   reaches to within 10 m of mid-span - and it is that last, longest, flattest
   one that goes to the top of the block. Written the other way round the fan
   is upside down: the short steep stays crowd the top and the long ones leave
   from the bottom, which no cable-stayed bridge does, because the whole point
   of putting the anchorage high is to give the far end of the span some angle
   to pull at. */
const anch = i => CBOT + (CTOP - CBOT) * i / (NC - 1);
/* A STAY LEAVES THE FACE OF THE ANCHORAGE BOX, not its centre line.

   The first version started every stay on the shaft's axis and trimmed it back
   out - twenty metres for the steep ones, which is true of the real cable and
   wrong for a drawing of it. What you see is not a stay that starts inside the
   box; it is a stay that starts twenty metres DOWN ITS OWN LENGTH, and since
   the steep ones run nearly parallel to the shaft that put the bottom of the
   fan at EL 164 when the anchorage block stops at EL 189.8. The fan reached a
   quarter of the way down the pylon that has no cables on it at all.

   This model is a skin - the inside of the box is not drawn and is not meant
   to be - so the honest place to start a stay is where it comes out: the face
   of the box, at the elevation it is anchored at. Then the fan is the block's
   height and nothing else. */
const stay = (d, i, s, sec, R) => {
  const out = SHX / 2 + R + 60;
  const a = [-XP + (d > 0 ? out : -out), s * 700, anch(i)];
  const b = [-XP + d, s * AY, ZDK];
  A('md.stay', sec, a, b, 0, 400);
};
/* THE RING IS FOUR CABLES, and they go on together. Main span and side span,
   left plane and right plane - the pylon is only balanced if the ring is
   complete, so a stage that put on one of them would be a stage of a bridge
   that would fall over. */
mainX().forEach((d, i) => { if (!on(stayStage(i))) return; [-1, 1].forEach(s =>
  stay(d, i, s, d > 200000 ? 'sc.ca' : 'sc.cb', d > 200000 ? 100 : 80)); });
sideX().forEach((d, i) => { if (!on(stayStage(i))) return;
  [-1, 1].forEach(s => stay(-d, i, s, 'sc.ca', 100)); });
BASE_('md.stay');
blank();

/* ===================== the piers ===================== */
push('#', 'PIERS W2 AND W3 - under the side span and under the end of the deck');
if (on(PIER)) {
  [XW2, XW3].forEach((x, k) => [-1, 1].forEach(s =>
    A('md.pie', 'sc.pc', [-x, s * WY, 0], [-x, s * WY, ZG - GD / 2 - 300], 0, 0)));
  [XW2, XW3].forEach(x =>
    A('md.pie', 'sc.px', [-x, -WY, ZG - GD / 2 - 12000], [-x, WY, ZG - GD / 2 - 12000],
      5000, 5000));
}
BASE_('md.pie');
blank();

/* ===================== the drawings ===================== */
// RIGHT looks ALONG the bridge, which is the only direction a section can be
// taken in - and a module placed many times lands on top of itself there.
push('# VIEW', 'module', 'dir', 'AZ', 'EL', 'scale', 'title');
const V = (md, dir, sc, t) => { if (md === 'ALL' || MADE.has(md))
  push('VIEW', md, dir, '', '', sc, t); };
V('ALL', 'FRONT', 2000, 'INCHEON BRIDGE - GENERAL ARRANGEMENT');
V('ALL', 'TOP', 2000, 'INCHEON BRIDGE - PLAN');
V('md.pyl', 'FRONT', 500, 'THE PYLON - ELEVATION');
V('md.pyl', 'RIGHT', 500, 'THE PYLON - SECTION');
V('md.stay', 'FRONT', 1000, 'THE STAYS - ELEVATION');
V('md.stay', 'TOP', 1000, 'THE STAYS - PLAN');
V('md.dck', 'RIGHT', 200, 'THE DECK - CROSS SECTION');
V('md.pie', 'RIGHT', 200, 'PIER - SECTION');
blank();

/* ===================== the assemblies ===================== */
/* Every module is written WHERE IT STANDS, so every ADD row quotes that
   module's own datum back at it and moves nothing. Then one MIR does the rest:
   the bridge is symmetric about mid-span, so half of it is written. */
const put = (as, md) => { const d = AT(md, FIRST[md]);
  push('ASSY', as, md, 'ADD', r1(d[0]), r1(d[1]), r1(d[2])); };

push('# ASSY', 'id', 'ref', 'cmd', 'G.X', 'G.Y', 'G.Z', 'PLANE');
push('#', 'THE DECK - written end to end, because its panel points are not a grid');
if (MADE.has('md.dck')) put('as.dck', 'md.dck');
blank();
push('# ASSY', 'id', 'ref', 'cmd', 'G.X', 'G.Y', 'G.Z', 'PLANE');
push('#', 'PYLON, STAYS AND PIERS - one half written, mirrored about mid-span');
if (MADE.has('md.pyl')) {
  put('as.pyl', 'md.pyl');
  push('ASSY', 'as.pyl', 'as.pyl', 'MIR', 0, 0, 0, 'YZ');
}
if (MADE.has('md.stay')) {
  put('as.stay', 'md.stay');
  push('ASSY', 'as.stay', 'as.stay', 'MIR', 0, 0, 0, 'YZ');
}
if (MADE.has('md.pie')) {
  put('as.pie', 'md.pie');
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
  note(0, 'INCHEON BRIDGE  ·  800 m main span, 230.5 m pylons, 208 stays  ·  mm, Z up'
       + (SG === null ? '' : '   ·   ERECTION STAGE ' + SG + ' of ' + CLOSE));
  note(at('SECT', 'sc.ca'), 'a stay. A PIPE, because a stay is strands inside a sheath');
  note(at('SECT', 'sc.gb'), 'the deck: one box, 17.6 m by 1,371, skin only');
  // a note ON THE ROW AFTER a comment, and only if that comment is there -
  // at() gives -1 when it is not, and -1 + 1 is the title row
  const note1 = (i, t) => { if (i > 0) note(i + 1, t); };
  note1(at('#', 'ONE PYLON - two legs that flow into one box, not two boxes that step'),
        '32 m apart at the footing, 45 m at the crossbeam, then one shaft: a lozenge, not a Y');
  note1(at('#', 'THE STAYS - 26 a plane a side of a pylon, 208 in all, and every one of them one row'),
        '22.5 m to the first, then 2 at 11.25, then 23 at 15 - and 10 m short of mid-span');
  note(at('# VIEW'), 'eight drawings. RIGHT looks along the bridge - the only way a section can');
  note(at('# ASSY'), 'half the bridge written, one MIR about mid-span');
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
  console.log('wrote ' + OUT + '  (' + R.length + ' rows'
    + (SG === null ? '' : ', stage ' + SG + '/' + CLOSE) + ')');
})();
