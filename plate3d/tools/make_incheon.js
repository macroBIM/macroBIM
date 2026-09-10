// PLATE3D_INCHEON.xlsx - the Incheon Bridge, at full size, in mm.
//
// WHAT IS PUBLISHED AND WHAT IS MINE. Five figures are the input: an 800 m main
// span, pylons 230.5 m above the water, 74 m of clearance under the deck, a
// 1,480 m cable-stayed length and a deck 33.4 m wide, opened 2009. Everything
// else - the pylon's proportions, the cable spacing, every section size, the
// girder depth, the pier shapes - is MINE. It is designed to those five and to
// what the bridge looks like, and nothing written about this model should say
// it is Chodai's drawing.
//
// THE CABLES ARE STRAIGHT, and that is the whole reason this bridge is here.
//
// The Golden Gate's main cable is a parabola, so it had to be sawn into 130
// straight segments to be written at all, and the film had to say so. A
// cable-stayed bridge has no such problem: a stay IS a straight line from an
// anchorage in the pylon to an anchorage in the deck, and one stay is one
// member. There is no approximation anywhere in this file. Nothing is sampled,
// nothing is chorded, nothing is "close enough at this scale".
//
// Three decisions carry it:
//
//   - ONE STAY IS ONE ROW. 132 of them, and the fan is arithmetic: the deck
//     anchorages are the deck's own bay, 20 m apart, and the pylon anchorages
//     are spread up the shaft. Semi-fan, which is what the bridge has and what
//     every cable-stayed bridge built since 1980 has, because a pure fan puts
//     forty anchorages on one point.
//
//   - THE PYLON IS AN INVERTED Y AND THE DECK GOES BETWEEN ITS LEGS. That one
//     sentence fixes where the legs meet: they have to still be outside the
//     33.4 m deck where they pass it. Legs 70 m apart at the pier and meeting
//     at 150 m puts them 36.3 m apart at deck level - 1.4 m clear either side.
//     Meeting lower makes a pylon the deck cannot get through.
//
//   - ONE DECK BAY, WRITTEN ONCE, COPIED 74 TIMES. 20 m a bay, and the spans
//     are 80 + 260 + 800 + 260 + 80 because every one of those is a whole
//     number of bays. A stay lands on a cross beam or it lands on nothing.
//
// THE PAINT IS NOT IN THIS FILE. For a picture or a film:
//
//   COLOURS=md.pyl=#e2e8f0,md.stay=#f8fafc,md.dkb=#94a3b8,md.pie=#cbd5e1 \
//     node tools/shot_ggb.js PLATE3D_INCHEON.xlsx
const ExcelJS = require('exceljs');
const OUT = process.argv[2] || __dirname + '/../PLATE3D_INCHEON.xlsx';

/* ===================== the published figures ===================== */
const MAIN = 800000;               // main span
const ZPY = 230500;                // pylons, above the water
const CLR = 74000;                 // clearance under the deck
const WIDE = 33400;                // deck, out to out

/* ===================== and my numbers ===================== */
const BAY = 20000;                 // one deck bay, and one stay spacing
const SIDE = 260000, END = 80000;  // side and end spans: 1,480 m in all
const XP = MAIN / 2;               // 400000 - the pylons
const XEND = XP + SIDE + END;      // 740000 - where the deck stops
const GD = 2500;                   // girder depth
const ZG = CLR + GD / 2;           // 75250 - the girders' axis
const ZDK = CLR + GD;              // 76500 - the road surface
const HW = WIDE / 2;               // 16700
const EY = 15000;                  // the edge girders, and where a stay lands
const SY = [0, 7500];              // the stringers between them
/* The pylon. Legs 70 m apart at the pier top and meeting at 150 m, which is
   what it takes for a 33.4 m deck to pass between them. */
const PYB = 35000, PYZ = 8000, PYJ = 150000;
const PYS = 5000;                  // the shaft, square
const CTOP = 227000, CBOT = 168000;   // where the stays reach up the shaft
const NM = 19, NS = 12;            // stays each side of a pylon: main, then side
const PIERX = [XP + SIDE, XEND];   // and the piers under the side spans

const r1 = v => Math.round(v * 10) / 10;
const R = [];
const push = (...r) => R.push(r);
const blank = () => R.push([]);
const HDR_MOD = ['# MODULE', 'id', 'member', 'Ref.Pt', 'L.X', 'L.Y', 'L.Z',
                 'PLANE', 'ROT.X', 'ROT.Y', 'ROT.Z'];
const HDR_AX = ['# MODULE', 'id', 'member', 'Ref.Pt', 'LX1', 'LY1', 'LZ1',
                'LX2', 'LY2', 'LZ2', 'OFF_B', 'OFF_E', 'Alpha'];
let form = '';
const MADE = new Set(), DATUM = {}, COUNT = {};
function A(id, mem, a, b, ob, oe) {
  ob = ob || 0; oe = oe || 0;
  const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  if (L < ob + oe + 500) return;
  if (form !== 'a') { push.apply(null, HDR_AX); form = 'a'; }
  push('MODULE', id, mem, '', r1(a[0]), r1(a[1]), r1(a[2]),
       r1(b[0]), r1(b[1]), r1(b[2]), ob ? r1(ob) : '', oe ? r1(oe) : '', '');
  MADE.add(id);
  const k = id + '|' + mem;
  COUNT[k] = (COUNT[k] || 0) + 1;
  if (!DATUM[k]) DATUM[k] = [a[0], a[1], a[2]];
}
// BASE names an INSTANCE. _1 only when the section really has more than one here.
function BASE_(id, mem) {
  if (!MADE.has(id)) return;
  if (form !== 'm') { push.apply(null, HDR_MOD); form = 'm'; }
  push('MODULE', id, 'BASE', mem + (COUNT[id + '|' + mem] > 1 ? '_1' : ''), 'mc');
  form = '';
}
const AT = (id, mem) => DATUM[id + '|' + mem] || [0, 0, 0];

push('COORD', 'ZUP');
blank();

/* ===================== sections ===================== */
push('# SECT', 'id', 'mat', 'length', 'TYPE', 'base.pt',
     'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7');
/* A stay is a PIPE, because a stay is a bundle of strands inside a sheath and
   the sheath is a pipe. Every other member in this file is a box or an H; the
   one that is round is the one that is round. */
push('SECT', 'sc.st1', 'SM570', 250000, 'P', 'mc', 200, 12);
push('SECT', 'sc.st2', 'SM570', 180000, 'P', 'mc', 160, 10);
push('SECT', 'sc.eg', 'SM490', r1(BAY), 'H', 'mc', GD, 1200, 1200, 24, 40, 40, 26);
push('SECT', 'sc.cb', 'SM490', r1(WIDE), 'H', 'mc', 2000, 700, 700, 18, 30, 30, 20);
push('SECT', 'sc.sg', 'SM490', r1(BAY), 'H', 'mc', 900, 350, 350, 12, 18, 18, 14);
// The pylon legs lean two ways at once, so they are square: a square never has
// to be told which way is up.
push('SECT', 'sc.pl', 'SM490', 160000, 'R', 'mc', 7000, 7000, 90, 0);
push('SECT', 'sc.ps', 'SM490', r1(ZPY - PYJ), 'R', 'mc', PYS, PYS, 70, 0);
push('SECT', 'sc.px', 'SM490', 40000, 'R', 'mc', 4000, 4000, 50, 0);
push('SECT', 'sc.pc', 'SM490', r1(ZG - GD / 2), 'R', 'mc', 8000, 5000, 80, 0);
blank();

/* ===================== one deck bay ===================== */
push('#', 'ONE DECK BAY - two edge girders, a cross beam and three stringers, copied 74 times');
/* The cross beam hangs UNDER the girders rather than framing into them, which
   is what lets one bay be copied without a single member being cut. The
   stringers sit on it the same way. */
const CBZ = ZG - GD / 2 - 1000 - 50;
A('md.dkb', 'sc.cb', [-XEND, -HW, CBZ], [-XEND, HW, CBZ]);
[-1, 1].forEach(s => A('md.dkb', 'sc.eg',
  [-XEND, s * EY, ZG], [-XEND + BAY, s * EY, ZG]));
SY.forEach(y => [-1, 1].forEach(s => {
  if (y === 0 && s === 1) return;
  A('md.dkb', 'sc.sg', [-XEND, s * y, ZG - 400], [-XEND + BAY, s * y, ZG - 400]);
}));
BASE_('md.dkb', 'sc.cb');
blank();

/* ===================== one pylon ===================== */
push('#', 'ONE PYLON - two legs, a shaft, and the deck passing between them');
const leg = s => [[s * PYB, PYZ], [0, PYJ]];
[-1, 1].forEach(s => A('md.pyl', 'sc.pl',
  [-XP, s * PYB, PYZ], [-XP, 0, PYJ], 0, 0));
A('md.pyl', 'sc.ps', [-XP, 0, PYJ], [-XP, 0, ZPY], 0, 0);
/* Two struts between the legs: one under the deck, where a real pylon carries
   the girders, and one below it. Both stop clear of the leg boxes. */
[ZG - GD / 2 - 3500, PYZ + (PYJ - PYZ) * 0.28].forEach(z => {
  const t = (z - PYZ) / (PYJ - PYZ), y = PYB * (1 - t);
  A('md.pyl', 'sc.px', [-XP, -y, z], [-XP, y, z], 4500, 4500);
});
BASE_('md.pyl', 'sc.pl');
blank();

/* ===================== the stays ===================== */
push('#', 'THE STAYS - one member each, and not one of them is an approximation');
/* A semi-fan. The deck anchorages are the deck's own bay, so a stay lands on a
   cross beam; the pylon anchorages are spread down the top quarter of the
   shaft, because a pure fan asks forty cables to meet at one point and a pure
   harp wastes the height. Nineteen into the main span and twelve into the side
   span from each side of each pylon - the side span carries fewer because it
   is shorter and because the back stays are what hold the pylon up. */
const anch = (i, n) => CTOP - (CTOP - CBOT) * i / (n - 1);
for (let i = 0; i < NM; i++) {                       // into the main span
  const x = -XP + (i + 2) * BAY, z = anch(i, NM);
  [-1, 1].forEach(s => A('md.stay', i < NM / 2 ? 'sc.st1' : 'sc.st2',
    [-XP, 0, z], [x, s * EY, ZG], PYS, GD / 2));
}
for (let i = 0; i < NS; i++) {                       // and back into the side span
  const x = -XP - (i + 2) * BAY, z = anch(i, NS);
  [-1, 1].forEach(s => A('md.stay', 'sc.st1',
    [-XP, 0, z], [x, s * EY, ZG], PYS, GD / 2));
}
BASE_('md.stay', 'sc.st1');
blank();

/* ===================== one pier ===================== */
push('#', 'ONE PIER - under the side spans, and under each end of the deck');
[-1, 1].forEach(s => A('md.pie', 'sc.pc',
  [-PIERX[0], s * EY, 0], [-PIERX[0], s * EY, ZG - GD / 2], 0, 100));
A('md.pie', 'sc.px', [-PIERX[0], -EY, ZG - GD / 2 - 6000],
                     [-PIERX[0], EY, ZG - GD / 2 - 6000], 3000, 3000);
BASE_('md.pie', 'sc.pc');
blank();

/* ===================== the drawings ===================== */
// RIGHT looks ALONG the bridge, which is the only direction a cross section can
// be taken in - and a module placed many times lands on top of itself there,
// so the drawing is one of it rather than all of them side by side.
push('# VIEW', 'module', 'dir', 'AZ', 'EL', 'scale', 'title');
push('VIEW', 'ALL', 'FRONT', '', '', 2000, 'INCHEON BRIDGE - GENERAL ARRANGEMENT');
push('VIEW', 'ALL', 'TOP', '', '', 2000, 'INCHEON BRIDGE - PLAN');
push('VIEW', 'md.pyl', 'FRONT', '', '', 500, 'THE PYLON - ELEVATION');
push('VIEW', 'md.pyl', 'RIGHT', '', '', 500, 'THE PYLON - SECTION');
push('VIEW', 'md.stay', 'FRONT', '', '', 1000, 'THE STAYS - ELEVATION');
push('VIEW', 'md.stay', 'TOP', '', '', 1000, 'THE STAYS - PLAN');
push('VIEW', 'md.dkb', 'RIGHT', '', '', 100, 'THE DECK - CROSS SECTION');
push('VIEW', 'md.pie', 'RIGHT', '', '', 200, 'ONE PIER - SECTION');
blank();

/* ===================== the assemblies ===================== */
/* Every module is written WHERE IT STANDS, so every ADD row quotes that
   module's own datum straight back at it and moves nothing. Then COPY and MIR
   do the placing. */
const DATUM_OF = { 'md.dkb': 'sc.cb', 'md.pyl': 'sc.pl',
                   'md.stay': 'sc.st1', 'md.pie': 'sc.pc' };
const put = (as, md) => { const d = AT(md, DATUM_OF[md]);
  push('ASSY', as, md, 'ADD', r1(d[0]), r1(d[1]), r1(d[2])); };

push('# ASSY', 'id', 'ref', 'cmd', 'G.X', 'G.Y', 'G.Z', 'rep');
push('#', 'THE DECK - one bay, seventy-four of them, end to end');
if (MADE.has('md.dkb')) {
  put('as.dck', 'md.dkb');
  push('ASSY', 'as.dck', 'as.dck', 'COPY', r1(BAY), 0, 0, (2 * XEND) / BAY - 1);
}
blank();
push('# ASSY', 'id', 'ref', 'cmd', 'G.X', 'G.Y', 'G.Z', 'PLANE');
push('#', 'THE PYLONS - one written, the other a mirror');
if (MADE.has('md.pyl')) {
  put('as.pyl', 'md.pyl');
  push('ASSY', 'as.pyl', 'as.pyl', 'MIR', 0, 0, 0, 'YZ');
}
blank();
push('# ASSY', 'id', 'ref', 'cmd', 'G.X', 'G.Y', 'G.Z', 'PLANE');
push('#', 'THE STAYS - one pylon\'s worth, mirrored to the other');
if (MADE.has('md.stay')) {
  put('as.stay', 'md.stay');
  push('ASSY', 'as.stay', 'as.stay', 'MIR', 0, 0, 0, 'YZ');
}
blank();
push('# ASSY', 'id', 'ref', 'cmd', 'G.X', 'G.Y', 'G.Z', 'PLANE');
push('#', 'THE PIERS - two a side');
if (MADE.has('md.pie')) {
  put('as.pie', 'md.pie');
  push('ASSY', 'as.pie', 'as.pie', 'COPY', r1(-(PIERX[1] - PIERX[0])), 0, 0, 1);
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
  note(0, 'INCHEON BRIDGE  ·  800 m main span, 230.5 m pylons  ·  mm, Z up');
  note(at('SECT', 'sc.st1'), 'a stay. A PIPE, because a stay is strands inside a sheath');
  note(at('SECT', 'sc.pl'), 'pylon leg - square, because it leans two ways at once');
  note(at('#', 'THE STAYS - one member each, and not one of them is an approximation') + 1,
       'semi-fan: deck anchorages on the deck’s own bay, pylon anchorages down the top quarter');
  note(at('# VIEW'), 'eight drawings. RIGHT looks along the bridge - the only way a section can');
  note(at('# ASSY'), 'one bay COPIED, one pylon MIRRORED. The bridge is what these rows make of them');
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
