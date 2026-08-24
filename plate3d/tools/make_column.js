/* PLATE3D_COLUMN.xlsx — step one: the column, on its own.

     PARAM   what a person edits
     SECT    the H list      \ the two dropdowns, and which one the Section
     TUBE    the square list /  cell offers follows the Type cell
     input   PLATE3D rows, every value a formula on PARAM

   Three pieces - upper, middle, lower - with a splice wherever two of them
   meet. Type 0 into upper or lower and that piece is gone, and its splice
   with it: no plates, no bolts, no row to delete.

   The splice follows the section, because it has to. An H is spliced with
   cover plates - one on each flange, one each side of the web - and a tube
   cannot be, since nothing reaches inside it to hold a nut. A tube gets an
   end plate welded across each piece and the two bolted together outside the
   wall. Type decides, and nothing on the front sheet has to be told twice.

   The first entry of either list is "user define": pick it and the five
   dimension cells go blank for you to type over. */
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const P3 = path.resolve(__dirname, '..');
const DESIGN = '/home/user/design';
const OUT = P3 + '/' + (process.env.OUT || 'PLATE3D_COLUMN.xlsx');

/* ---------- the two catalogues ---------- */
function csv(file) {
  const ln = fs.readFileSync(DESIGN + '/' + file, 'utf8')
    .replace(/^﻿/, '').split(/\r?\n/).filter(s => s.trim());
  const head = ln[0].split(',').map(s => s.trim());
  return ln.slice(1).map(l => { const f = l.split(','), o = {};
    head.forEach((h, i) => { o[h] = (f[i] || '').trim(); }); return o; });
}
const USER = 'user define';
/* Both tabs are laid out the same way on purpose - name, h, b, tw, tf, r,
   kg/m - so ONE set of VLOOKUP column numbers serves both. A tube has no
   flange, so its wall goes in the tw and the tf column alike, and everything
   downstream that asks how thick the steel is gets the right answer without
   asking what kind of section it is. */
const HS = [[USER, '', '', '', '', '', '']].concat(
  csv('hsection.csv').filter(r => r['KS규격여부'] === 'O')
    .map(r => [`H-${r.H}x${r.B}x${r.t1}x${r.t2} r${r.r}`,
               +r.H, +r.B, +r.t1, +r.t2, +r.r, +r['단위무게']]));
const TB = [[USER, '', '', '', '', '', '']].concat(
  csv('squaretube.csv')
    .map(r => [`R-${r['호칭치수']} r${r.r}`,
               +r.A, +r.B, +r.t, +r.t, +r.r, +r['단위무게']]));
const findH = k => HS.find(s => s[0] === k) || HS[1];
const findT = k => TB.find(s => s[0] === k) || TB[1];
/* UDEF=h,b,tw,tf,r writes the sheet the way a person leaves it after picking
   "user define" and typing over the five cells: the Section name is the list's
   own first entry, and the dimensions are literals rather than a VLOOKUP. It
   is the only honest way to test that path - editing a finished file cannot,
   because the input tab's IF formulas would need recalculating and only Excel
   does that. */
const UDEF = process.env.UDEF ? process.env.UDEF.split(',').map(Number) : null;

/* ---------- what the sheet opens with ---------- */
const TYPE = process.env.CTYPE === 'R' ? 'R' : 'H';
const V = {
  type: TYPE,
  sec: TYPE === 'R' ? (process.env.COLSEC || 'R-300x300x12 r30')
                    : (process.env.COLSEC || 'H-300x300x10x15 r18'),
  up: 700, mid: 1400, dn: 700,
  steel: 'SS275',
  /* the splice, written the way PLATE3D_SPLICE.xlsx writes one: plates by
     width/length/thickness, bolts by a count with a gap in the middle and an
     edge distance at the ends. A column splice is symmetric, so where the
     beam sheet has a Top flange row and a Bottom flange row this has one. */
  gap: 10, cpL: 330,
  foW: 300, foT: 12,                       // flange plate, outer
  fiW: 110, fiT: 10,                       // flange plate, inner - two per flange
  wpW: 234, wpT: 10,                       // web plate - two
  fNL: 4, fIL: 70, fOL: 45,                // flange group: along the column
  fNT: 4, fIT: 100, fOT: 40,               //               across the flange
  wNL: 4, wIL: 60, wOL: 45,                // web group: along the column
  wNT: 3, wIT: 0,  wOT: 40,                //            through the web depth
  alpha: Number(process.env.CALPHA || 0),  // spin the whole column about Z
  epT: 20, epOV: 60,                       // end plate thickness and overhang
  eNX: 3, eOX: 30, eNY: 3, eOY: 30,        // its bolts, one ring round the wall
  dia: 16, grade: 'F10T',
  /* the beams. Four of them, named for the world direction they run in -
     X+ X- Y+ Y- - because a beam follows the building grid and the column is
     turned to suit it, not the other way round. Length 0 and that beam is not
     there, the same switch the column pieces use. Beams are H only: a tube
     beam would have no web to bolt through and nothing to weld a fin to. */
  bmSec: 'H-300x150x6.5x9 r13',
  bmL: [900, 900, 900, 0],                 // X+  X-  Y+  Y-
  /* Which connection each beam uses, by mark. A beam names one; the library
     below says what that mark is. */
  bmC: (process.env.BMC || 'C1,C3,C3,C3').split(','),   // X+  X-  Y+  Y-
  /* THE CONNECTION LIBRARY. Six marks, declared once and picked by name, the
     way a shop drawing calls up C1 rather than describing the detail again at
     every beam. The mark carries no meaning of its own - the Type cell beside
     it says whether it is a fin or an end plate, and the note says it in
     words - which is exactly why a mark survives being re-tuned: change C3
     from a fin to an end plate and "C3" is still true, where "FIN-A" would
     have become a lie.

     End plate bolts through the column; fin plate is welded to it and bolts
     through the BEAM'S web instead - the one that works on a tube, because
     nothing has to reach inside the wall.

     Every type takes the same seven numbers, which is what lets one row shape
     serve them all: how far the beam stops short, the plate's width and
     thickness, and a bolt group as a gauge, an edge distance, a pitch and a
     count. Width 230, not 300, on an end plate: one plate serves all four
     faces and a beam on the WEB face has to fit between the flanges -
     h - 2tf - 2r, which is 234 on the default column. */
  conn: [
    { m: 'C1', t: 'end plate', d: '3 rows, through the col',
      sb: 0,  w: 230, th: 20, g: 140, e: 45, p: 70, n: 3 },
    { m: 'C2', t: 'end plate', d: '4 rows, for a deep beam',
      sb: 0,  w: 230, th: 20, g: 140, e: 45, p: 70, n: 4 },
    { m: 'C3', t: 'fin plate', d: '3 bolts through the web',
      sb: 10, w: 140, th: 10, g: 60,  e: 45, p: 70, n: 3 },
    { m: 'C4', t: 'fin plate', d: '4 bolts through the web',
      sb: 10, w: 140, th: 10, g: 60,  e: 45, p: 70, n: 4 },
    { m: 'C5', t: 'fin plate', d: '2 bolts, a thinner fin',
      sb: 10, w: 120, th: 9,  g: 55,  e: 40, p: 60, n: 2 },
    { m: 'C6', t: '', d: 'spare — set a Type',
      sb: 0,  w: 0,   th: 0,  g: 0,   e: 0,  p: 0,  n: 0 }
  ]
};
/* Column D is 26 characters wide and its neighbour is never empty, so Excel
   CLIPS a longer note rather than spilling it. Catch that here: a truncated
   explanation is worse than none, and it is invisible in the generator. */
V.conn.forEach(x => { if (x.d.length > 25)
  throw new Error('connection note clipped at 26: ' + x.m + ' ' + x.d.length); });
const CONNT = ['end plate', 'fin plate'];    // the types the engine can build
/* The engine reads what a formula LAST EVALUATED TO, not the formula, so the
   cached results below have to follow Type. A generator that always caches
   the H branch ships a tube that loads as an H, which is what happened the
   first time this was tested. */
const H = V.type === 'H';
const SEC = UDEF ? [USER].concat(UDEF).concat([0])
                 : (H ? findH(V.sec) : findT(V.sec));
if (UDEF) V.sec = USER;
const D = {};
D.h = SEC[1]; D.b = SEC[2]; D.tw = SEC[3]; D.tf = SEC[4]; D.r = SEC[5]; D.kg = SEC[6];
D.hole = V.dia + 2;
D.nut = 0.9 * V.dia;
const up5 = x => Math.ceil(x / 5) * 5;
/* Pitch the way the splice sheet works it out: a run that is halved about the
   joint - or about the web - gets pHalf, and the one run that goes straight
   through gets pFull. Same two lines, same meaning, so a reader of one sheet
   is a reader of both. */
const pHalf = (W, N, I, O) => (N / 2 <= 1 ? 0 : (W / 2 - O - I / 2) / (N / 2 - 1));
const pFull = (W, N, I, O) => (N <= 1 ? 0 : (W - 2 * O - I) / (N - 1));
D.pFL = pHalf(V.cpL, V.fNL, V.fIL, V.fOL);      // flange, along the column
D.pFT = pHalf(V.foW, V.fNT, V.fIT, V.fOT);      // flange, across
D.pWL = pHalf(V.cpL, V.wNL, V.wIL, V.wOL);      // web, along
D.pWT = pFull(V.wpW, V.wNT, V.wIT, V.wOT);      // web, through the depth
D.fiY = V.fIT / 2 + D.pFT / 2;                  // inner plate, on its own two lines
D.gripF = V.foT + D.tf + V.fiT;
D.gripW = D.tw + 2 * V.wpT;
// end plate
D.epB = D.h + 2 * V.epOV;
D.epH = D.b + 2 * V.epOV;
D.gripE = 2 * V.epT;
// one length per bolt kind
D.lenF = up5(D.gripF + D.nut + 0.2 * V.dia);
D.lenW = up5(D.gripW + D.nut + 0.2 * V.dia);
D.lenE = up5(D.gripE + D.nut + 0.2 * V.dia);
/* the end plate's bolts go round the wall, not on four corners: a line down
   each side of the plate, on the overhang the tube leaves clear */
D.eX  = D.epB / 2 - V.eOX;                      // the two bolt lines across X
D.eY  = D.epH / 2 - V.eOY;
D.pEX = V.eNX <= 1 ? 0 : (D.epB - 2 * V.eOX) / (V.eNX - 1);
D.pEY = V.eNY <= 1 ? 0 : (D.epH - 2 * V.eOY) / (V.eNY - 1);
D.nE  = 2 * V.eNX + 2 * Math.max(0, V.eNY - 2);
/* the beams */
const BM = findH(V.bmSec);
D.bmH = BM[1]; D.bmB = BM[2]; D.bmW = BM[3]; D.bmF = BM[4]; D.bmR = BM[5]; D.bmKg = BM[6];
/* Which connection each beam ended up with, resolved once here so the cached
   results below can be read off it. A mark that is not in the library
   resolves to nothing - no type, no plate - which is what the sheet's own
   IFERROR does, so the cache and the formula agree even when a beam names a
   mark that does not exist. */
const NOCONN = { m: '', t: '', d: '', sb: 0, w: 0, th: 0, g: 0, e: 0, p: 0, n: 0 };
D.cn = V.bmC.map(m => V.conn.find(c => c.m === m) || NOCONN);
const cnH = c => c.p * (c.n - 1) + 2 * c.e;      // plate height, from its bolts
/* Which face a beam meets depends on Alpha, because the directions are the
   world's and the column turns inside them. At 0 the flanges face X; at ±90
   they face Y, and an X beam then lands on the web. A tube has four alike
   walls and does not care. */
const SQ = V.alpha % 180 === 0;
D.faceX = SQ ? D.h / 2 : (H ? D.tw / 2 : D.b / 2);
D.faceY = SQ ? (H ? D.tw / 2 : D.b / 2) : D.h / 2;
D.thruX = SQ ? D.tf : D.tw;
D.thruY = SQ ? D.tw : D.tf;
/* An H column is bolted through: the nut goes inside, between the flanges.
   A tube cannot be - nothing reaches in to hold it - so it takes a second
   plate welded to its wall and the two are bolted face to face, clear of the
   beam. That is the whole of the difference. */
/* Per beam now, not per book: two beams can carry different marks, so the
   grip a bolt has to cross - and therefore its length - is a beam's own. */
D.bGrip = D.cn.map((c, i) => {
  const thru = (i < 2 ? D.thruX : D.thruY);
  return c.t === 'end plate' ? (H ? thru + c.th : 2 * c.th) : c.th + D.bmW;
});
D.bLen = D.bGrip.map(g => up5(g + D.nut + 0.2 * V.dia));
// beam start, out from the column face
D.bOff = D.cn.map(c => c.t === 'end plate' ? (H ? c.th : 2 * c.th) : c.sb);
const rnd = x => +(+x).toFixed(4);
const pick = (a, b) => (H ? a : b);
/* the column stiffener. Horizontal plates inside the H, one sheet row per
   LEVEL - a signed height measured from the middle column's centre, which is
   where the beams sit, so a beam's top flange and its bottom flange are two
   rows. Eight rows because four beams have eight flanges between them. A tube
   gets none: nothing reaches inside a closed wall to weld one in.
   Thickness 0 and that row is not there, the switch the whole book uses. */
const NSTF = 8;
V.stf = [];
[1, -1].forEach(s => V.stf.push({
  t: s > 0 ? 'beam top flange' : 'beam bottom flange',
  off: rnd(s * (D.bmH - D.bmF) / 2),      // the default beam's flange centre
  w: rnd((D.b - D.tw) / 2), d: rnd(D.h - 2 * D.tf), th: 12
}));
while (V.stf.length < NSTF) V.stf.push({ t: '', off: 0, w: 0, d: 0, th: 0 });
D.stfN = H ? V.stf.filter(s => s.th > 0).length * 2 : 0;

/* ---------- style ---------- */
const FONT = 'Arial';
const wb = new ExcelJS.Workbook();
wb.creator = 'PLATE3D';
function sty(cell, o) {
  o = o || {};
  cell.font = { name: FONT, size: o.size || 10, bold: !!o.bold,
                color: o.color ? { argb: o.color } : undefined, italic: !!o.italic };
  cell.alignment = { horizontal: o.h || 'left', vertical: 'middle', wrapText: !!o.wrap };
  if (o.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: o.fill } };
  if (o.border) { const s = { style: 'thin', color: { argb: 'FFCBD5E1' } };
    cell.border = { top: s, left: s, bottom: s, right: s }; }
  if (o.fmt) cell.numFmt = o.fmt;
  return cell;
}
const INK = 'FF0F172A', MUTE = 'FF64748B', BLUE = 'FF1D4ED8', WARN = 'FFB45309';
const HEADFILL = 'FF0F172A', BANDFILL = 'FFF1F5F9', INFILL = 'FFEFF6FF';
const OFFTXT = 'FF94A3B8';

const ps = wb.addWorksheet('PARAM');
const is = wb.addWorksheet('input');

/* ================= PARAM ================= */
/* Laid out the way PLATE3D_SPLICE.xlsx lays a splice out, on purpose: plates
   by Width / Length / Thick / Qty, bolts by a group with a count, a gap left
   in the middle and an edge distance at the ends. Read one sheet and you can
   read the other. The one change is that a column splice is symmetric, so
   where the beam sheet carries a Top flange row and a Bottom flange row this
   carries one Flange row for both. */
const P = 'PARAM';
const R = { title: 1, sub: 2,
            sHead: 4,  sCols: 5,  sec: 6,  len: 7,  steel: 8,
            sNote: 9,  aNote: 10, sChk: 11,
            pHead: 13, pCols: 14, fo: 15, fi: 16, wp: 17, ep: 18, pNote: 19, pChk: 20,
            bHead: 22, bCols: 23, blt: 24, gCols: 25, gF: 26, gW: 27,
            eCols: 28, gE: 29, bNote: 30, bChk: 31,
            mHead: 33, mCols: 34, bm0: 35, mNote: 39, mChk: 40,
            nHead: 42, nCols: 43, cn0: 44, nNote: 50, nChk: 51,
            tHead: 53, tCols: 54, stf0: 55, tNote: 63, tChk: 64 };
const BMROW = [35, 36, 37, 38];                  // X+  X-  Y+  Y-
const CNROW = V.conn.map((_, i) => R.cn0 + i);                       // 44..49
const STFROW = Array.from({ length: NSTF }, (_, i) => R.stf0 + i);   // 55..62
const c = (col, row) => `${P}!$${col}$${row}`;
const K = {
  typ: c('C', R.sec), sec: c('D', R.sec),
  h: c('E', R.sec), b: c('F', R.sec), tw: c('G', R.sec), tf: c('H', R.sec),
  r: c('I', R.sec), alpha: c('J', R.sec), kg: c('K', R.sec),
  up: c('E', R.len), mid: c('G', R.len), dn: c('I', R.len),
  steel: c('C', R.steel),
  foW: c('E', R.fo), foL: c('F', R.fo), foT: c('G', R.fo), gap: c('J', R.fo),
  fiW: c('E', R.fi), fiL: c('F', R.fi), fiT: c('G', R.fi),
  wpW: c('E', R.wp), wpL: c('F', R.wp), wpT: c('G', R.wp),
  epW: c('E', R.ep), epL: c('F', R.ep), epT: c('G', R.ep),
  dia: c('E', R.blt), hole: c('F', R.blt), grade: c('G', R.blt),
  lenF: c('H', R.blt), lenW: c('I', R.blt), lenE: c('J', R.blt),
  fNL: c('E', R.gF), fIL: c('F', R.gF), fOL: c('G', R.gF),
  fNT: c('H', R.gF), fIT: c('I', R.gF), fOT: c('J', R.gF),
  wNL: c('E', R.gW), wIL: c('F', R.gW), wOL: c('G', R.gW),
  wNT: c('H', R.gW), wIT: c('I', R.gW), wOT: c('J', R.gW),
  eNX: c('E', R.gE), eOX: c('F', R.gE), eNY: c('H', R.gE), eOY: c('I', R.gE),
  epOV: c('J', R.ep)
};
// one beam's cells, by its row
const BMK = i => ({ det: c('C', BMROW[i]), sec: c('D', BMROW[i]), h: c('E', BMROW[i]), b: c('F', BMROW[i]),
                   tw: c('G', BMROW[i]), tf: c('H', BMROW[i]), r: c('I', BMROW[i]),
                   len: c('J', BMROW[i]), kg: c('K', BMROW[i]) });
// one stiffener level's cells, by its row
const SK = i => ({ off: c('E', STFROW[i]), w: c('F', STFROW[i]),
                   d: c('G', STFROW[i]), th: c('H', STFROW[i]) });
/* The connection library, looked up by the mark a beam names. IFERROR is not
   decoration: a mark that is not in the list would otherwise put #N/A through
   every formula downstream and the whole sheet would go red. Falling back to
   0 - and to "" for the type - makes an unknown mark behave as no connection
   at all, which is what a person who has just mistyped one wants to see. The
   check row says so in words. */
const CNTAB = `${P}!$B$${R.cn0}:$K$${R.cn0 + V.conn.length - 1}`;
const CNMARK = `${P}!$B$${R.cn0}:$B$${R.cn0 + V.conn.length - 1}`;
const CNTYPE = `${P}!$C$${R.cn0}:$C$${R.cn0 + V.conn.length - 1}`;
const CNW    = `${P}!$F$${R.cn0}:$F$${R.cn0 + V.conn.length - 1}`;
// column numbers inside that table: B=1 mark, C=2 type, D=3 note, E=4 setback…
const CC = { typ: 2, note: 3, sb: 4, w: 5, th: 6, g: 7, e: 8, p: 9, n: 10 };
const cv  = (i, n) => `IFERROR(VLOOKUP(${BMK(i).det},${CNTAB},${n},FALSE),0)`;
const cvt = i => `IFERROR(VLOOKUP(${BMK(i).det},${CNTAB},${CC.typ},FALSE),"")`;
// one beam's connection, as formulas and as the values they cache to
const CNK = i => ({
  t: cvt(i), sb: cv(i, CC.sb), w: cv(i, CC.w), th: cv(i, CC.th),
  g: cv(i, CC.g), e: cv(i, CC.e), p: cv(i, CC.p), n: cv(i, CC.n),
  h: `(${cv(i, CC.p)}*(${cv(i, CC.n)}-1)+2*${cv(i, CC.e)})`
});
const isH = `${K.typ}="H"`;
/* Where a beam meets the column, and how much steel its bolt has to cross.
   Both follow Alpha, because the four directions belong to the world and the
   column turns inside them: at 0 the flanges face X, at ±90 they face Y. */
const SQf    = `MOD(${K.alpha},180)=0`;
const faceXf = `IF(${SQf},${K.h}/2,IF(${isH},${K.tw}/2,${K.b}/2))`;
const faceYf = `IF(${SQf},IF(${isH},${K.tw}/2,${K.b}/2),${K.h}/2)`;
const thruXf = `IF(${SQf},${K.tf},${K.tw})`;
const thruYf = `IF(${SQf},${K.tw},${K.tf})`;
// the four pitches, as formulas, in the splice sheet's own two shapes
const F = {
  pFL: `(${K.foL}/2-${K.fOL}-${K.fIL}/2)/(${K.fNL}/2-1)`,
  pFT: `(${K.foW}/2-${K.fOT}-${K.fIT}/2)/(${K.fNT}/2-1)`,
  pWL: `(${K.wpL}/2-${K.wOL}-${K.wIL}/2)/(${K.wNL}/2-1)`,
  pWT: `(${K.wpW}-2*${K.wOT}-${K.wIT})/(${K.wNT}-1)`
};
F.fiY = `(${K.fIT}/2+(${F.pFT})/2)`;

ps.columns = [{ width: 3 }, { width: 21 }, { width: 9 }, { width: 26 }, { width: 10 },
              { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 },
              { width: 11 }, { width: 3 }];
ps.views = [{ showGridLines: false }];

function head(row, n, text, note) {
  sty(ps.getCell(row, 2), { bold: true, size: 12, color: 'FFFFFFFF', fill: HEADFILL })
    .value = '  ' + n + '.  ' + text;
  for (let col = 3; col <= 11; col++)
    sty(ps.getCell(row, col), { fill: HEADFILL, color: 'FFFFFFFF', size: 9 })
      .value = col === 3 && note ? note : null;
  if (note) ps.mergeCells(row, 3, row, 11);
  ps.getRow(row).height = 20;
}
function cols(row, labels) {
  labels.forEach((t, i) => { if (!t) return;
    sty(ps.getCell(row, i + 2), { bold: true, size: 9, color: MUTE, h: i ? 'center' : 'left' })
      .value = t; });
}
const label = (row, t, o) =>
  sty(ps.getCell(row, 2), Object.assign({ bold: true, size: 10, color: INK }, o || {})).value = t;
function inp(row, col, value, fmt) {
  const cell = sty(ps.getCell(row, col), { h: 'center', border: true, fill: INFILL,
                                           color: BLUE, bold: true, fmt: fmt });
  cell.value = value; return cell;
}
function calc(row, col, formula, result, fmt, o) {
  const cell = sty(ps.getCell(row, col), Object.assign(
    { h: 'center', border: true, color: MUTE, fmt: fmt }, o || {}));
  cell.value = { formula: formula, result: result }; return cell;
}
function note(row, t) {
  sty(ps.getCell(row, 2), { size: 9, italic: true, color: MUTE }).value = t;
  ps.mergeCells(row, 2, row, 11);
  if (t.length > 150) throw new Error('note too long: ' + t.length);
}
function checked(row, pairs) {
  sty(ps.getCell(row, 2), { size: 9, bold: true, color: WARN }).value = 'checked for you';
  let col = 3;
  pairs.forEach(p => {
    sty(ps.getCell(row, col), { size: 9, color: MUTE, h: 'right' }).value = p[0];
    sty(ps.getCell(row, col + 1), { size: 9, bold: true, color: WARN, h: 'left' })
      .value = { formula: p[1], result: p[2] };
    col += 2;
  });
}

sty(ps.getCell(R.title, 2), { bold: true, size: 18, color: INK }).value = 'COLUMN';
sty(ps.getCell(R.sub, 2), { size: 10, color: MUTE }).value =
  'Three pieces and a splice where two of them meet. Fill in the blue cells — the input tab is written from this one.';
ps.getRow(R.title).height = 26;

/* ---- 1. section ---- */
head(R.sHead, 1, 'SECTION', 'Type decides which list the Section cell offers — H sections, or square tubes');
cols(R.sCols, ['', 'Type', 'Section', 'h', 'b', 'tw / t', 'tf', 'r', 'Alpha', 'kg/m']);
label(R.sec, 'Column');
inp(R.sec, 3, V.type).dataValidation = { type: 'list', allowBlank: false,
  formulae: ['"H,R"'], showErrorMessage: true,
  error: 'H for an I section, R for a square tube.' };
inp(R.sec, 4, V.sec);
const look = n => `IF(${isH},IFERROR(VLOOKUP($D$${R.sec},SECT!$A:$G,${n},FALSE),""),` +
                  `IFERROR(VLOOKUP($D$${R.sec},TUBE!$A:$G,${n},FALSE),""))`;
[[2, D.h], [3, D.b], [4, D.tw], [5, D.tf], [6, D.r]].forEach(([n, val], i) => {
  if (UDEF) inp(R.sec, 5 + i, val, '0.##');            // typed over, as a person leaves it
  else calc(R.sec, 5 + i, look(n), val, '0.##', { fill: INFILL, color: BLUE, bold: true });
});
/* Alpha spins the whole column about its own axis - section, plates and
   bolts together, because the ASSY row that places each module carries the
   rotation and a module turns as one piece. 0 leaves the flanges facing X. */
inp(R.sec, 10, V.alpha).dataValidation = { type: 'list', allowBlank: false,
  formulae: ['"0,90,-90"'], showErrorMessage: true,
  error: '0, 90 or -90 degrees about the column axis.' };
if (UDEF) sty(ps.getCell(R.sec, 11), { h: 'center', color: MUTE }).value = '—';
else calc(R.sec, 11, look(7), D.kg, '0.0');
label(R.len, 'Length');
[['upper', V.up], ['middle', V.mid], ['lower', V.dn]].forEach(([t, v], i) => {
  sty(ps.getCell(R.len, 4 + i * 2), { size: 9, bold: true, color: MUTE, h: 'right' }).value = t;
  inp(R.len, 5 + i * 2, v);
});
label(R.steel, 'Steel');
inp(R.steel, 3, V.steel);
sty(ps.getCell(R.steel, 5), { size: 9, bold: true, color: WARN }).value =
  'put 0 in upper or lower if you do not want that piece — its splice goes with it';
ps.mergeCells(R.steel, 5, R.steel, 11);
note(R.sNote, 'Pick "user define" at the top of either list and the five cells go blank — type over them. A tube has no flange, so its wall goes in tw and tf alike.');
/* Alpha earns a line of its own: it is the one cell on the sheet that moves
   everything at once, and a reader who has just met Type needs telling that
   this is not another kind of section but the same one, turned. */
note(R.aNote, 'Alpha turns the whole column about its axis, plates and bolts with it. 0 faces the flanges along X, ±90 along Y; a tube looks alike either way.');
checked(R.sChk, [
  ['section', `IF(${K.h}="","fill in the dimensions","ok")`, 'ok'],
  ['splices', `(IF(${K.up}>0,1,0)+IF(${K.dn}>0,1,0))&" of 2"`,
    ((V.up > 0 ? 1 : 0) + (V.dn > 0 ? 1 : 0)) + ' of 2'],
  ['flanges face', `IF(${isH},IF(MOD(${K.alpha},180)=0,"X","Y"),"all four alike")`,
    pick(V.alpha % 180 === 0 ? 'X' : 'Y', 'all four alike')]
]);

/* ---- 2. plates ---- */
head(R.pHead, 2, 'SPLICE PLATES', 'cover plates on an H, an end plate on a tube — Type keeps whichever the section calls for');
cols(R.pCols, ['', '', '', 'Width', 'Length', 'Thick', 'Qty', 'Material', 'joint gap']);
const PLT = [
  [R.fo, 'Flange plate',       V.foW, V.cpL, V.foT, 2, 'H'],
  [R.fi, 'Flange inner plate', V.fiW, V.cpL, V.fiT, 4, 'H'],
  [R.wp, 'Web plate',          V.wpW, V.cpL, V.wpT, 2, 'H'],
  [R.ep, 'End plate',          D.epB, D.epH, V.epT, 2, 'R']
];
PLT.forEach(([row, t, w, l, th, q, only]) => {
  label(row, t, { color: (only === 'H') === H ? INK : OFFTXT });
  if (only === 'R') {          // the end plate follows the column plus its overhang
    calc(row, 5, `${K.h}+2*${K.epOV}`, w, '0.##');
    calc(row, 6, `${K.b}+2*${K.epOV}`, l, '0.##');
  } else { inp(row, 5, w); inp(row, 6, l); }
  inp(row, 7, th);
  sty(ps.getCell(row, 8), { h: 'center', color: MUTE }).value = q;
  inp(row, 9, V.steel);
  sty(ps.getCell(row, 11), { size: 9, italic: true, color: MUTE, h: 'center' })
    .value = 'Type ' + only;
});
inp(R.fo, 10, V.gap);
sty(ps.getCell(R.ep, 10), { size: 9, bold: true, color: MUTE, h: 'right' }).value = null;
inp(R.ep, 10, V.epOV);
sty(ps.getCell(R.pCols, 10), { bold: true, size: 9, color: MUTE, h: 'center' })
  .value = 'gap / over';
const plKg = (V.foW * V.cpL * V.foT * 2 + V.fiW * V.cpL * V.fiT * 4
              + V.wpW * V.cpL * V.wpT * 2) * 7.85e-6;
const epKg = D.epB * D.epH * V.epT * 2 * 7.85e-6;
note(R.pNote, 'Width is across the flange or through the web; Length runs along the column. The end plate follows the section, plus 60 all round.');
checked(R.pChk, [
  ['in use', `IF(${isH},"cover plates","end plate")`, pick('cover plates', 'end plate')],
  ['plate steel, kg', `ROUND(IF(${isH},${K.foW}*${K.foL}*${K.foT}*2+${K.fiW}*${K.fiL}*${K.fiT}*4` +
    `+${K.wpW}*${K.wpL}*${K.wpT}*2,${K.epW}*${K.epL}*${K.epT}*2)*7.85/1000000,1)`,
    Math.round(pick(plKg, epKg) * 10) / 10],
  /* A plate narrower than the steel it covers is a detail; a plate wider is a
     mistake, and changing the section is exactly how you get one without
     noticing - the plate widths are typed, so they do not follow. */
  ['plates fit', `IF(${isH},IF(AND(${K.foW}<=${K.b},${K.wpW}<=${K.h}-2*${K.tf}-2*${K.r}),"ok",` +
    `IF(${K.foW}>${K.b},"flange plate too wide","web plate too deep")),"n/a")`,
    pick(V.foW <= D.b && V.wpW <= D.h - 2 * D.tf - 2 * D.r ? 'ok'
         : (V.foW > D.b ? 'flange plate too wide' : 'web plate too deep'), 'n/a')]
]);

/* ---- 3. bolts ---- */
head(R.bHead, 3, 'BOLTS', 'the shank and the hole are different sizes, and each grip gets its own length');
cols(R.bCols, ['', '', '', 'dia', 'hole', 'grade', 'flange L', 'web L', 'end L']);
label(R.blt, 'Bolt');
inp(R.blt, 5, V.dia);
calc(R.blt, 6, `${K.dia}+2`, D.hole, '0.##');
inp(R.blt, 7, V.grade).dataValidation = { type: 'list', allowBlank: false,
  formulae: ['"F8T,F10T,F13T"'] };
/* Wrapped in IF, and not for tidiness: a tube leaves tf and tw blank, and
   CEILING of a blank is #VALUE! - which is what these two showed. */
calc(R.blt, 8, `IF(${isH},CEILING(${K.foT}+${K.tf}+${K.fiT}+1.1*${K.dia},5),"—")`,
     pick(D.lenF, '—'), '0.##', { color: INK, bold: true });
calc(R.blt, 9, `IF(${isH},CEILING(${K.tw}+2*${K.wpT}+1.1*${K.dia},5),"—")`,
     pick(D.lenW, '—'), '0.##', { color: INK, bold: true });
calc(R.blt, 10, `IF(${isH},"—",CEILING(2*${K.epT}+1.1*${K.dia},5))`,
     pick('—', D.lenE), '0.##', { color: INK, bold: true });
cols(R.gCols, ['bolt group', '', '', 'Long N', 'In', 'Out', 'Trans N', 'In', 'Out']);
[[R.gF, 'Flange', V.fNL, V.fIL, V.fOL, V.fNT, V.fIT, V.fOT],
 [R.gW, 'Web',    V.wNL, V.wIL, V.wOL, V.wNT, V.wIT, V.wOT]
].forEach(([row, t, ...vals]) => {
  label(row, t, { color: H ? INK : OFFTXT });
  vals.forEach((v, i) => inp(row, 5 + i, v));
});
/* The end plate's bolts are a ring round a rectangle, not a group split about
   a joint, so Long and Trans mean nothing here and would only mislead. It gets
   its own heading, in the plate's own words: Width and Length, the two columns
   the plate is already written in above. */
cols(R.eCols, ['', '', '', 'Width N', 'Out', '', 'Length N', 'Out']);
label(R.gE, 'End plate', { color: H ? OFFTXT : INK });
inp(R.gE, 5, V.eNX);
inp(R.gE, 6, V.eOX);
inp(R.gE, 8, V.eNY);
inp(R.gE, 9, V.eOY);
note(R.bNote, 'Flange and Web: Long is along the column, Trans across it. End plate: how many bolts down each side of the plate, and Out from its edge.');
checked(R.bChk, [
  ['flange pitch', `IF(${isH},ROUND(${F.pFL},1)&" / "&ROUND(${F.pFT},1),"n/a")`,
    pick(rnd(D.pFL) + ' / ' + rnd(D.pFT), 'n/a')],
  ['web pitch', `IF(${isH},ROUND(${F.pWL},1)&" / "&ROUND(${F.pWT},1),"n/a")`,
    pick(rnd(D.pWL) + ' / ' + rnd(D.pWT), 'n/a')],
  ['bolts', `IF(${isH},2*${K.fNL}*${K.fNT}+${K.wNL}*${K.wNT},` +
    `2*${K.eNX}+2*MAX(0,${K.eNY}-2))&" per splice"`,
    pick(2 * V.fNL * V.fNT + V.wNL * V.wNT, D.nE) + ' per splice']
]);

/* ---- 4. the beams ---- */
head(R.mHead, 4, 'BEAMS', 'four world directions - X+ X- Y+ Y-. Length 0 and that beam is not there');
cols(R.mCols, ['', 'Detail', 'Section', 'h', 'b', 'tw', 'tf', 'r', 'Length', 'kg/m']);
const BMDIR = ['X+', 'X-', 'Y+', 'Y-'];
const bmLook = n => `IFERROR(VLOOKUP($D$ROW,SECT!$A:$G,${n},FALSE),"")`;
BMDIR.forEach((dir, i) => {
  const row = BMROW[i];
  label(row, dir, { color: V.bmL[i] > 0 ? INK : OFFTXT });
  /* The list is the library's own mark column, not a literal, so renaming C3
     in chapter 5 renames it in this dropdown too. What it cannot do is follow
     a mark a beam has ALREADY picked - that cell keeps the old text - which
     is why chapter 5 checks that every beam still finds its mark. */
  inp(row, 3, V.bmC[i]).dataValidation = { type: 'list', allowBlank: false,
    formulae: [CNMARK], showErrorMessage: true,
    error: 'Name one of the connections declared in chapter 5.' };
  inp(row, 4, V.bmSec);
  ps.getCell(row, 4).dataValidation = { type: 'list', allowBlank: false,
    formulae: [`SECT!$A$2:$A$${HS.length + 1}`], showErrorMessage: true,
    error: 'Pick an H section — a beam has to have a web to bolt through.' };
  [[2, D.bmH], [3, D.bmB], [4, D.bmW], [5, D.bmF], [6, D.bmR]].forEach(([n, val], j) =>
    calc(row, 5 + j, bmLook(n).replace('ROW', row), val, '0.##',
         { fill: INFILL, color: BLUE, bold: true }));
  inp(row, 10, V.bmL[i]);
  calc(row, 11, bmLook(7).replace('ROW', row), D.bmKg, '0.0');
});
note(R.mNote, 'Beams are H only: a tube has no web to bolt through. The direction is the world\'s, so Alpha decides whether a beam lands on a flange or on the web.');
checked(R.mChk, [
  ['X faces', `IF(${isH},IF(MOD(${K.alpha},180)=0,"flange","web"),"tube wall")`,
    pick(SQ ? 'flange' : 'web', 'tube wall')],
  ['Y faces', `IF(${isH},IF(MOD(${K.alpha},180)=0,"web","flange"),"tube wall")`,
    pick(SQ ? 'web' : 'flange', 'tube wall')],
  ['beams', `(IF(${BMK(0).len}>0,1,0)+IF(${BMK(1).len}>0,1,0)+IF(${BMK(2).len}>0,1,0)` +
    `+IF(${BMK(3).len}>0,1,0))&" of 4"`, V.bmL.filter(x => x > 0).length + ' of 4']
]);

/* ---- 5. the connection library ----
   Six marks, declared once. A beam names one in chapter 4 and every number
   below follows by VLOOKUP - so a detail is described once however many beams
   share it, and re-tuning C3 re-tunes all of them at once.

   The mark is deliberately meaningless. The Type cell beside it says what the
   connection IS and the note says it in words, which is what keeps a mark
   honest: change C3 from a fin to an end plate and "C3" is still true, where
   a name like "FIN-A" would quietly have become a lie.

   One row shape serves both types because they take the same seven numbers.
   The plate height is not among them - it follows from pitch, count and edge
   - so it is worked out where it is used rather than typed here. */
head(R.nHead, 5, 'CONNECTION', 'declare them here, then name one against each beam above — end plate bolts through the column, fin plate through the beam web');
cols(R.nCols, ['', 'Type', 'what it is', 'setback', 'width', 'thick', 'gauge', 'edge', 'pitch', 'count']);
V.conn.forEach((cn, i) => {
  const rw = CNROW[i];
  label(rw, cn.m, { color: cn.t ? INK : OFFTXT });
  inp(rw, 3, cn.t || null).dataValidation = { type: 'list', allowBlank: true,
    formulae: [`"${CONNT.join(',')}"`], showErrorMessage: true,
    error: 'end plate bolts through the column; fin plate bolts through the beam web.' };
  sty(inp(rw, 4, cn.d || null), { h: 'left', border: true, fill: INFILL,
                                  color: BLUE, bold: true });
  [[5, cn.sb], [6, cn.w], [7, cn.th], [8, cn.g], [9, cn.e], [10, cn.p], [11, cn.n]]
    .forEach(([col, v]) => inp(rw, col, v, '0.##'));
});
note(R.nNote, 'The mark is just a mark — Type says what it is. End plate gauge is across the beam web, fin plate gauge out from the column face.');
checked(R.nChk, [
  /* The one failure this restructure introduces: a beam naming a mark that is
     not in the list. VLOOKUP would give #N/A, IFERROR turns that into nothing
     at all, and nothing at all is silent - so it has to be said here. */
  ['marks', `IF(${[0, 1, 2, 3].map(i =>
      `COUNTIF(${CNMARK},${BMK(i).det})`).join('+')}=4,"all 4 beams found theirs",` +
    `"a beam names a mark that is not in the list")`,
    V.bmC.every(m => V.conn.some(c => c.m === m))
      ? 'all 4 beams found theirs' : 'a beam names a mark that is not in the list'],
  /* SUMPRODUCT to get a conditional MAX without MAXIFS, which LibreOffice and
     older Excel do not both have. Off rows carry 0 and cannot win a MAX. */
  ['widest end plate', `IF(NOT(${isH}),"n/a",IF(SUMPRODUCT(MAX((${CNTYPE}="end plate")*` +
    `(${CNW})))<=${K.h}-2*${K.tf}-2*${K.r},"fits between the flanges",` +
    `"hits the flanges on a web face"))`,
    pick(Math.max.apply(null, V.conn.filter(x => x.t === 'end plate').map(x => x.w).concat([0]))
      <= D.h - 2 * D.tf - 2 * D.r ? 'fits between the flanges'
      : 'hits the flanges on a web face', 'n/a')],
  ['longest bolt', `"M"&${K.dia}&" L"&MAX(${[0, 1, 2, 3].map(i => {
      const c = CNK(i), thru = i < 2 ? thruXf : thruYf;
      return `IF(${c.t}="end plate",CEILING(IF(${isH},${thru}+${c.th},2*${c.th})+1.1*${K.dia},5),` +
             `IF(${c.t}="fin plate",CEILING(${c.th}+${BMK(i).tw}+1.1*${K.dia},5),0))`;
    }).join(',')})`,
    'M' + V.dia + ' L' + Math.max.apply(null, D.bLen)],
  /* A beam on a WEB face sits between the flanges, and its own flange has to
     pass them. Where it does not, the detailer strips the beam flange back -
     and PLATE3D cannot do that yet: CUT edits a profile that runs the whole
     length and FIT cuts one plane, neither of which is a notch at an end. So
     it says so rather than letting the two quietly overlap. */
  ['flange passes', `IF(NOT(${isH}),"n/a",IF(MOD(${K.alpha},180)=0,` +
    `IF(MAX(${BMK(2).b},${BMK(3).b})<=${K.h}-2*${K.tf}-2*${K.r},"ok","strip the beam flange"),` +
    `IF(MAX(${BMK(0).b},${BMK(1).b})<=${K.h}-2*${K.tf}-2*${K.r},"ok","strip the beam flange")))`,
    pick(D.bmB <= D.h - 2 * D.tf - 2 * D.r ? 'ok' : 'strip the beam flange', 'n/a')]
]);

/* ---- 6. the column stiffener ----
   Last, not first, though it is a column input: you cannot write an offset
   until you know how deep the beams are, and putting it here leaves chapters
   2 to 5 on the rows they already had. One sheet row is one LEVEL, and the
   level is signed - up is positive - so a beam's two flanges are two rows. */
head(R.tHead, 6, 'COLUMN STIFFENER', 'horizontal plates inside an H — a tube cannot take one, nothing reaches inside the wall');
cols(R.tCols, ['', '', 'for', 'offset', 'width', 'depth', 'thick']);
V.stf.forEach((s, i) => {
  const rw = STFROW[i];
  label(rw, String(i + 1), { color: (H && s.th > 0) ? INK : OFFTXT });
  sty(inp(rw, 4, s.t || null), { h: 'left', border: true, fill: INFILL,
                                 color: BLUE, bold: true });
  [[5, s.off], [6, s.w], [7, s.d], [8, s.th]].forEach(([col, v]) => inp(rw, col, v, '0.##'));
});
note(R.tNote, 'Offset is signed, from the middle column\'s centre — where the beams sit. Width runs out from the web, depth between the flanges. Thick 0 = off.');
checked(R.tChk, [
  /* Two plates a level, always: the web splits the space between the flanges
     in two and no single plate can span it. */
  ['plates', `IF(${isH},${STFROW.map(r => `IF($H$${r}>0,2,0)`).join('+')},0)&" of ${NSTF * 2}"`,
    D.stfN + ' of ' + NSTF * 2],
  ['fits', `IF(NOT(${isH}),"n/a",IF(MAX($F$${R.stf0}:$F$${R.stf0 + NSTF - 1})>(${K.b}-${K.tw})/2,` +
    `"too wide",IF(MAX($G$${R.stf0}:$G$${R.stf0 + NSTF - 1})>${K.h}-2*${K.tf},"too deep","ok")))`,
    pick(Math.max.apply(null, V.stf.map(s => s.w)) > (D.b - D.tw) / 2 ? 'too wide'
      : (Math.max.apply(null, V.stf.map(s => s.d)) > D.h - 2 * D.tf ? 'too deep' : 'ok'), 'n/a')],
  /* The number a person actually wants while filling this block in: where
     each beam's flange centre sits, which is what an offset is usually set to. */
  ['beam flange at ±', [0, 1, 2, 3].map(i =>
    `ROUND((${BMK(i).h}-${BMK(i).tf})/2,1)`).join('&" / "&'),
    [0, 1, 2, 3].map(() => rnd((D.bmH - D.bmF) / 2)).join(' / ')]
]);

/* ---- grey out whichever detail the section is not using ----
   The labels were already dimmed, but the cells beside them stayed blue and
   blue means "type here". A conditional format is the only way to say it in
   the file itself: Excel re-reads the rule every time Type changes, which a
   static style cannot. Everything stays editable - it is dimmed, not locked,
   because a person may well be setting up the other detail before switching.
   The preview tool here does not render conditional formats, so what is
   checked below is that the rules are in the file, not how they look. */
const DIMFONT = { color: { argb: 'FFB9C2CE' } };
const DIMFILL = { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFF9FAFB' } };
function dimWhen(ref, formula) {
  ps.addConditionalFormatting({ ref: ref, rules: [{
    type: 'expression', priority: 1, formulae: [formula],
    style: { font: DIMFONT, fill: DIMFILL } }] });
}
const NOT_H = `$C$${R.sec}<>"H"`, IS_H = `$C$${R.sec}="H"`;
// the cover plate detail, and its two bolt groups
[`B${R.fo}:K${R.wp}`, `B${R.gF}:K${R.gW}`, `H${R.blt}:I${R.blt}`]
  .forEach(ref => dimWhen(ref, NOT_H));
// the end plate detail, its own bolt heading and row
[`B${R.ep}:K${R.ep}`, `B${R.eCols}:K${R.gE}`, `J${R.blt}:J${R.blt}`]
  .forEach(ref => dimWhen(ref, IS_H));
// the stiffener block, which only an H can take
dimWhen(`B${R.stf0}:K${R.stf0 + NSTF - 1}`, NOT_H);

/* ================= the two catalogue tabs ================= */
function catalogue(name, rows) {
  const ws = wb.addWorksheet(name);
  ws.columns = [{ width: 26 }].concat([1, 2, 3, 4, 5, 6].map(() => ({ width: 9 })));
  ['Section', 'h', 'b', 'tw', 'tf', 'r', 'kg/m'].forEach((t, i) =>
    sty(ws.getCell(1, i + 1), { bold: true, color: 'FFFFFFFF', fill: HEADFILL,
                                h: i ? 'center' : 'left', border: true }).value = t);
  rows.forEach((v, j) => v.forEach((x, i) =>
    sty(ws.getCell(j + 2, i + 1), { h: i ? 'center' : 'left', border: true,
      fill: j === 0 ? 'FFFEF3C7' : (j % 2 ? BANDFILL : undefined),
      bold: j === 0 }).value = x === '' ? null : x));
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  return `${name}!$A$2:$A$${rows.length + 1}`;
}
/* Two names and one INDIRECT is what makes the Section list follow Type.
   Excel and LibreOffice honour it; Google Sheets does not do INDIRECT in a
   validation and shows the whole list instead. */
wb.definedNames.add(catalogue('SECT', HS), 'SEC_H');
wb.definedNames.add(catalogue('TUBE', TB), 'SEC_R');
ps.getCell(R.sec, 4).dataValidation = { type: 'list', allowBlank: false,
  formulae: [`INDIRECT("SEC_"&$C$${R.sec})`], showErrorMessage: true,
  error: 'Pick one from the list, or "user define" at the top of it.' };

/* ================= input ================= */
is.columns = [{ width: 50 }, { width: 11 }, { width: 12 }, { width: 11 }, { width: 10 }]
  .concat(Array.from({ length: 14 }, () => ({ width: 9 })));
is.views = [{ showGridLines: false }];
let ir = 0;
function row(cells, comment) {
  ir++;
  if (comment) sty(is.getCell(ir, 1), { size: 9, italic: true, color: MUTE }).value = comment;
  cells.forEach((v, i) => {
    const cell = sty(is.getCell(ir, i + 2), { size: 10, h: i ? 'center' : 'left',
                                              color: i ? INK : BLUE, bold: !i });
    if (v && typeof v === 'object') cell.value = { formula: v.f, result: v.v };
    else if (v !== null && v !== undefined && v !== '') cell.value = v;
  });
}
const f = (formula, value) => ({ f: formula, v: value });
function note2(t) { ir++; sty(is.getCell(ir, 1), { size: 9, italic: true, color: MUTE }).value = t; }

note2('Written from PARAM. Nothing here needs editing — change the front sheet instead.');
row(['COORD', 'ZUP']);

const PIECES = [['c1', 'upper', K.up, V.up], ['c2', 'middle', K.mid, V.mid],
                ['c3', 'lower', K.dn, V.dn]];
note2('');
note2('SECT  id  material  length  TYPE  base.pt  v1..v7        an H takes seven values, a tube four — the last three go blank by formula');
note2('MAX(1,..) keeps the definition alive when its piece is switched off below: a SECT of length 0 is not defined at all, and the MODULE naming it then fails.');
PIECES.forEach(([id, what, klen, vlen]) => {
  row(['SECT', 'sc.' + id, f(K.steel, V.steel),
       f(`MAX(1,${klen})`, Math.max(1, vlen)),
       f(`IF(${isH},"H","R")`, V.type), 'mc',
       f(K.h, D.h), f(K.b, D.b),
       f(`IF(${isH},${K.b},${K.tw})`, pick(D.b, D.tw)),
       f(`IF(${isH},${K.tw},${K.r})`, pick(D.tw, D.r)),
       f(`IF(${isH},${K.tf},"")`, pick(D.tf, '')),
       f(`IF(${isH},${K.tf},"")`, pick(D.tf, '')),
       f(`IF(${isH},${K.r},"")`, pick(D.r, ''))], what);
});

note2('');
note2('PLATE / BOLT   —   pl.fo is the flange cover plate on an H and the end plate on a tube; the inner and web plates are switched off on a tube, and so are the bolts that hold them.');
row(['PLATE', 'pl.fo', f(K.steel, V.steel),
     f(`IF(${isH},${K.foT},${K.epT})`, pick(V.foT, V.epT)), 'RECT', 'mc',
     f(`IF(${isH},${K.foW},${K.epW})`, pick(V.foW, D.epB)),
     f(`IF(${isH},${K.foL},${K.epL})`, pick(V.cpL, D.epH))], 'flange plate, or end plate');
row(['PLATE', 'pl.fi', f(K.steel, V.steel), f(K.fiT, V.fiT), 'RECT', 'mc',
     f(K.fiW, V.fiW), f(K.fiL, V.cpL)], 'flange inner plate, x4 — H only');
row(['PLATE', 'pl.wp', f(K.steel, V.steel), f(K.wpT, V.wpT), 'RECT', 'mc',
     f(K.wpW, V.wpW), f(K.wpL, V.cpL)], 'web plate, x2 — H only');
row(['BOLT', 'bo.f', f(K.grade, V.grade), f(K.dia, V.dia),
     f(`IF(${isH},${K.lenF},${K.lenE})`, pick(D.lenF, D.lenE)), f(K.hole, D.hole),
     '', '', '', f(`0.9*${K.dia}`, D.nut),
     f(`IF(${isH},${K.lenF}-${K.foT}-${K.tf}-${K.fiT},${K.lenE}-2*${K.epT})-0.9*${K.dia}`,
       rnd(pick(D.lenF - D.gripF, D.lenE - D.gripE) - D.nut))], 'flange bolt, or end plate bolt');
row(['BOLT', 'bo.w', f(K.grade, V.grade), f(K.dia, V.dia),
     f(`IF(${isH},${K.lenW},1)`, pick(D.lenW, 1)), f(K.hole, D.hole),
     '', '', '', f(`0.9*${K.dia}`, D.nut),
     f(`IF(${isH},${K.lenW}-${K.tw}-2*${K.wpT}-0.9*${K.dia},0)`,
       pick(rnd(D.lenW - D.gripW - D.nut), 0))],
    'web bolt — H only');

note2('');
note2('the stiffeners, one plate per level. RECT takes B then H: B runs along the column\'s h and is the DEPTH between the flanges, H runs along b and is the WIDTH out from the web.');
note2('MAX(1,..) once more — a plate of zero size is not defined at all, and the MODULE naming it would then fail rather than quietly skip.');
V.stf.forEach((s, i) => {
  const k = SK(i);
  row(['PLATE', 'pl.stf' + (i + 1), f(K.steel, V.steel),
       f(`MAX(1,${k.th})`, Math.max(1, s.th)), 'RECT', 'mc',
       f(`MAX(1,${k.d})`, Math.max(1, s.d)),
       f(`MAX(1,${k.w})`, Math.max(1, s.w))],
      i === 0 ? 'level 1 — every row of chapter 6 gets one of these' : '');
});

note2('');
note2('MODULE  id  member  Ref.Pt  L.X  L.Y  L.Z  PLANE  [ROT.X ROT.Y ROT.Z]  [dx dy dz repeat]  [dx2 dy2 dz2 repeat2]');
note2('ROT.Z 90 turns the section so its h runs along X. A square column cannot show that in a bounding box, so it is written down rather than looked for.');
PIECES.forEach(([id, what, klen, vlen], i) => {
  const on = i === 1 ? `"sc.${id}"` : `IF(${klen}>0,"sc.${id}","")`;
  const onV = i === 1 ? 'sc.' + id : (vlen > 0 ? 'sc.' + id : '');
  row(['MODULE', 'md.' + id, f(on, onV), '', 0, 0, 0, 'XY', 0, 0, 90],
      i === 0 ? 'a blank member is simply not there — which is how a length of 0 removes a piece' : '');
  row(['MODULE', 'md.' + id, 'BASE', 'sc.' + id, 'mc']);
});

/* the splice. Its origin is the middle of the joint. */
const fox = `(${K.h}/2+${K.foT}/2)`,            foxV = D.h / 2 + V.foT / 2;
const fix = `(${K.h}/2-${K.tf}-${K.fiT}/2)`,    fixV = D.h / 2 - D.tf - V.fiT / 2;
const bfx = `(${K.h}/2-${K.tf}-${K.fiT})`,      bfxV = D.h / 2 - D.tf - V.fiT;
const wpy = `(${K.tw}/2+${K.wpT}/2)`,           wpyV = D.tw / 2 + V.wpT / 2;
const bwy = `(${K.tw}/2+${K.wpT})`,             bwyV = D.tw / 2 + V.wpT;
const wx0 = `(${K.wpW}/2-${K.wOT})`,            wx0V = V.wpW / 2 - V.wOT;
const eX  = `(${K.epW}/2-${K.eOX})`,            eY  = `(${K.epL}/2-${K.eOY})`;
const pEX = `((${K.epW}-2*${K.eOX})/(${K.eNX}-1))`;
const pEY = `((${K.epL}-2*${K.eOY})/(${K.eNY}-1))`;
const sgn = (sg, e) => (sg > 0 ? `(${e})` : `-(${e})`);
note2('');
note2('The splice, its origin the middle of the joint. Every quadrant of a bolt group is one row: the two repeat axes reach across the flange and along the column, and the four sign combinations are the four corners of the pattern.');
[['u', K.up, V.up], ['d', K.dn, V.dn]].forEach(([sd, klen, vlen]) => {
  const both  = m => f(`IF(${klen}>0,"${m}","")`, vlen > 0 ? m : '');
  const hOnly = m => f(`IF(AND(${klen}>0,${isH}),"${m}","")`, (vlen > 0 && H) ? m : '');
  const first = sd === 'u';
  // flange plates - or the two end plates
  [1, -1].forEach(sg => {
    row(['MODULE', 'md.sp' + sd, both('pl.fo'), 'mc',
         f(`IF(${isH},${sgn(sg, fox)},0)`, pick(sg * foxV, 0)), 0,
         f(`IF(${isH},0,${sgn(sg, `${K.epT}/2`)})`, pick(0, sg * V.epT / 2)),
         f(`IF(${isH},"YZ","XY")`, pick('YZ', 'XY'))],
        first && sg > 0 ? 'flange plate on each flange — or, on a tube, the two end plates' : '');
  });
  // flange inner plates, two per flange
  [1, -1].forEach(sx => [1, -1].forEach(sy => {
    row(['MODULE', 'md.sp' + sd, hOnly('pl.fi'), 'mc',
         f(sgn(sx, fix), sx * fixV), f(sgn(sy, F.fiY), sy * D.fiY), 0, 'YZ'],
        first && sx > 0 && sy > 0 ? 'inner plates, each centred on its own two bolt lines' : '');
  }));
  // web plates
  [1, -1].forEach(sy => {
    row(['MODULE', 'md.sp' + sd, hOnly('pl.wp'), 'mc',
         0, f(sgn(sy, wpy), sy * wpyV), 0, 'XZ'],
        first && sy > 0 ? 'web plate, one each side' : '');
  });
  // flange bolts: one row per quadrant, per flange - H only
  [1, -1].forEach(sx => [1, -1].forEach(sz => [1, -1].forEach(sy => {
    row(['MODULE', 'md.sp' + sd, hOnly('bo.f'), '',
         f(sgn(sx, bfx), sx * bfxV),
         f(sgn(sy, `${K.fIT}/2`), sy * V.fIT / 2),
         f(sgn(sz, `${K.fIL}/2`), sz * V.fIL / 2), 'YZ',
         0, 0, sx > 0 ? 0 : 180,
         0, f(sgn(sy, F.pFT), sy * rnd(D.pFT)), 0, f(`${K.fNT}/2-1`, V.fNT / 2 - 1),
         0, 0, f(sgn(sz, F.pFL), sz * rnd(D.pFL)), f(`${K.fNL}/2-1`, V.fNL / 2 - 1)],
        first && sx > 0 && sz > 0 && sy > 0
          ? 'one quadrant of the flange group; eight rows make the two flanges' : '');
  })));
  /* the end plate's bolts - a ring round the wall, not four corners. Two rows
     run the full line down the X sides; two more fill in the Y sides between
     them, which is why those start one pitch in and count two fewer. */
  const rOn = m => f(`IF(AND(${klen}>0,NOT(${isH})),"${m}","")`, (vlen > 0 && !H) ? m : '');
  const rOn3 = m => f(`IF(AND(${klen}>0,NOT(${isH}),${K.eNY}>2),"${m}","")`,
                      (vlen > 0 && !H && V.eNY > 2) ? m : '');
  [1, -1].forEach(sy => {
    row(['MODULE', 'md.sp' + sd, rOn('bo.f'), '',
         f(`-${eX}`, -D.eX), f(sgn(sy, eY), sy * D.eY),
         f(`-${K.epT}/2`, -V.epT / 2), 'XY', 0, 0, 0,
         f(pEX, rnd(D.pEX)), 0, 0, f(`${K.eNX}-1`, V.eNX - 1)],
        first && sy > 0 ? 'end plate: a full line down each X side of the plate' : '');
  });
  [1, -1].forEach(sx => {
    row(['MODULE', 'md.sp' + sd, rOn3('bo.f'), '',
         f(sgn(sx, eX), sx * D.eX), f(`-${eY}+${pEY}`, -D.eY + rnd(D.pEY)),
         f(`-${K.epT}/2`, -V.epT / 2), 'XY', 0, 0, 0,
         /* the step goes to 0 with the count: a delta with nothing to repeat
            is a row the engine rightly asks about */
         0, f(`IF(${K.eNY}>3,${pEY},0)`, V.eNY > 3 ? rnd(D.pEY) : 0), 0,
            f(`MAX(0,${K.eNY}-3)`, Math.max(0, V.eNY - 3))],
        first && sx > 0 ? 'and the Y sides between them, corners already taken' : '');
  });
  // web bolts: one row per side of the joint, the depth in one run
  [1, -1].forEach(sz => {
    row(['MODULE', 'md.sp' + sd, hOnly('bo.w'), '',
         f(`-${wx0}`, -wx0V), f(bwy, bwyV), f(sgn(sz, `${K.wIL}/2`), sz * V.wIL / 2), 'XZ',
         0, 0, 0,
         f(F.pWT, rnd(D.pWT)), 0, 0, f(`${K.wNT}-1`, V.wNT - 1),
         0, 0, f(sgn(sz, F.pWL), sz * rnd(D.pWL)), f(`${K.wNL}/2-1`, V.wNL / 2 - 1)],
        first && sz > 0 ? 'the web: no gap at the middle of the depth, so it is one run across' : '');
  });
  row(['MODULE', 'md.sp' + sd, 'BASE', 'pl.fo_1', 'mc']);
});

/* The stiffeners ride INSIDE md.c2 rather than in a module of their own, and
   that one decision pays for the whole block: the ASSY row that places md.c2
   carries `spin`, so Alpha turns the stiffeners with the section and not one
   formula here has to know what Alpha is. md.c2's BASE is the centre of the
   section's START face, so local z runs 0 to `mid` and the centre - which is
   also where the beams sit - is at mid/2.
   Inside the module the section carries ROT.Z 90, so its h lies along X and
   its b along Y. The plates do not: each is laid flat in XY, which is why the
   PLATE row above puts the depth first. The repeat then drops the second
   plate on the far side of the web. */
note2('');
note2('the stiffeners, inside the middle column module so Alpha turns them with it. Local z 0 is the foot of that piece, so its centre — and the beams — are at mid/2.');
note2('One row per level; the repeat puts the second plate the other side of the web, the web splitting the space between the flanges in two.');
const stfHalf  = `(${K.b}+${K.tw})/4`;
const stfHalfV = rnd((D.b + D.tw) / 4);
V.stf.forEach((s, i) => {
  const k = SK(i), live = H && s.th > 0;
  row(['MODULE', 'md.c2',
       f(`IF(AND(${isH},${k.th}>0),"pl.stf${i + 1}","")`, live ? 'pl.stf' + (i + 1) : ''),
       'mc', 0, f(`-${stfHalf}`, -stfHalfV),
       f(`${K.mid}/2+${k.off}`, rnd(V.mid / 2 + s.off)), 'XY', 0, 0, 0,
       0, f(`2*${stfHalf}`, 2 * stfHalfV), 0, 1],
      i === 0 ? 'level 1, one plate each side of the web' : '');
});

/* BASE holds pl.fo_1, so a splice ASSY row names where THAT plate goes. */
const jointU  = `(${K.mid}/2+IF(${isH},${K.gap}/2,${K.epT}))`;
const jointUV = V.mid / 2 + pick(V.gap / 2, V.epT);
const clearU  = `(${K.mid}/2+IF(${isH},${K.gap},2*${K.epT}))`;
const clearUV = V.mid / 2 + pick(V.gap, 2 * V.epT);
note2('');
note2('ASSY  id  ref  cmd  p1 p2 p3        BASE holds pl.fo_1, so a splice row names where THAT plate sits, not where the joint is');
/* ASSY ... ADD takes a three-axis rotation after its point, so the whole
   module turns as one piece - plates and bolts with the section, which is what
   makes Alpha safe. A column piece is placed ON the axis, so spinning it about
   its own base point is a spin in place. The splice is not: BASE holds
   pl.fo_1, which sits out on the flange, so its point has to be carried round
   the axis as well. Rotating a rigid body about P and then putting P where the
   rotation would have sent it is the same as rotating the lot about the
   origin. */
const rotX = (e, v) => f(`ROUND((${e})*COS(RADIANS(${K.alpha})),6)`,
                         rnd(v * Math.cos(V.alpha * Math.PI / 180)));
const rotY = (e, v) => f(`ROUND((${e})*SIN(RADIANS(${K.alpha})),6)`,
                         rnd(v * Math.sin(V.alpha * Math.PI / 180)));
const spin = [0, 0, f(K.alpha, V.alpha)];
row(['ASSY', 'as.col', 'md.c2', 'ADD', 0, 0, f(`-${K.mid}/2`, -V.mid / 2)].concat(spin),
    'middle');
row(['ASSY', 'as.col', 'md.c1', 'ADD', 0, 0, f(clearU, clearUV)].concat(spin),
    'upper, clear of the joint');
row(['ASSY', 'as.col', 'md.c3', 'ADD', 0, 0,
     f(`-(${clearU}+MAX(1,${K.dn}))`, -(clearUV + Math.max(1, V.dn)))].concat(spin), 'lower');
const foxOn = `IF(${isH},${fox},0)`, foxOnV = pick(foxV, 0);
row(['ASSY', 'as.col', 'md.spu', 'ADD',
     rotX(foxOn, foxOnV), rotY(foxOn, foxOnV),
     f(`${jointU}+IF(${isH},0,-${K.epT}/2)`, jointUV + pick(0, -V.epT / 2))].concat(spin),
    'the splice point goes round the axis with the rest of it');
row(['ASSY', 'as.col', 'md.spd', 'ADD',
     rotX(foxOn, foxOnV), rotY(foxOn, foxOnV),
     f(`-${jointU}+IF(${isH},0,${K.epT}/2)`, -jointUV + pick(0, V.epT / 2))].concat(spin));
/* ---- the beams ---- */
/* Four of them, in the world's directions. They carry no `spin`: a beam
   follows the building grid and it is the column that turns inside it, which
   is why Alpha reaches these rows only through the face it presents. */
const BDIR = [
  { k: 'a', d: 'X+', ax: 'X', sg:  1, plane: 'YZ', rot: 0   },
  { k: 'b', d: 'X-', ax: 'X', sg: -1, plane: 'YZ', rot: 180 },
  { k: 'c', d: 'Y+', ax: 'Y', sg:  1, plane: 'XZ', rot: 180 },
  { k: 'd', d: 'Y-', ax: 'Y', sg: -1, plane: 'XZ', rot: 0   }
];
note2('');
note2('SECT / PLATE / BOLT for the beams. One end plate serves all four; the bolt comes in two lengths because an X face and a Y face are not the same thickness of steel once Alpha has turned the column.');
BDIR.forEach((B, i) => {
  const b = BMK(i);
  row(['SECT', 'sc.bm' + B.k, f(K.steel, V.steel),
       f(`MAX(1,${b.len})`, Math.max(1, V.bmL[i])), 'H', 'mc',
       f(b.h, D.bmH), f(b.b, D.bmB), f(b.b, D.bmB), f(b.tw, D.bmW),
       f(b.tf, D.bmF), f(b.tf, D.bmF), f(b.r, D.bmR)],
      i === 0 ? 'one per direction, so each can be its own section' : '');
});
/* One plate and one bolt PER BEAM, where there used to be one of each per
   book. Two beams can now name different marks, so neither the plate nor the
   bolt is a property of the column any more - it is a property of the beam
   that carries it. The two types share a row because they take the same
   numbers: width across or out, height from the bolt group, one thickness. */
note2('');
note2('One plate and one bolt for each beam, since each beam names its own connection. The plate is the end plate or the fin depending on that mark; MAX(1,..) keeps it defined when the mark is blank.');
BDIR.forEach((B, i) => {
  const b = BMK(i), C = CNK(i), cn = D.cn[i], isX = B.ax === 'X';
  row(['PLATE', 'pl.cn' + B.k, f(K.steel, V.steel),
       f(`MAX(1,${C.th})`, Math.max(1, cn.th)), 'RECT', 'mc',
       f(`MAX(1,${C.w})`, Math.max(1, cn.w)),
       f(`MAX(1,${C.h})`, Math.max(1, cnH(cn)))],
      i === 0 ? 'the end plate or the fin, whichever this beam\'s mark names' : '');
});
BDIR.forEach((B, i) => {
  const b = BMK(i), C = CNK(i), cn = D.cn[i];
  const thru = i < 2 ? thruXf : thruYf;
  /* An end plate bolt crosses the column wall and the plate; on a tube it
     crosses two plates instead, nothing reaching inside to hold a nut. A fin
     bolt crosses the fin and the beam's own web, and never the column. */
  const gf = `IF(${C.t}="end plate",IF(${isH},${thru}+${C.th},2*${C.th}),${C.th}+${b.tw})`;
  const lf = `CEILING(${gf}+1.1*${K.dia},5)`;
  row(['BOLT', 'bo.cn' + B.k, f(K.grade, V.grade), f(K.dia, V.dia),
       f(`MAX(1,${lf})`, Math.max(1, D.bLen[i])), f(K.hole, D.hole),
       '', '', '', f(`0.9*${K.dia}`, D.nut),
       f(`MAX(0,(${lf})-(${gf})-0.9*${K.dia})`,
         Math.max(0, rnd(D.bLen[i] - D.bGrip[i] - D.nut)))],
      i === 0 ? 'its length follows the grip, and the grip follows the mark' : '');
});

note2('');
note2('Each beam is one module, written for BOTH details at once. Its origin is the START FACE OF THE BEAM, which is the point BASE holds, so every other row is a distance measured back from there.');
BDIR.forEach((B, i) => {
  const b = BMK(i), isX = B.ax === 'X';
  const thru = isX ? thruXf : thruYf;
  const thruV = isX ? D.thruX : D.thruY;
  const bolt = 'bo.cn' + B.k, plate = 'pl.cn' + B.k;
  /* The type no longer sits in the beam's own row - the beam names a mark and
     the mark carries the type - so every branch below asks the library. */
  const C = CNK(i), cn = D.cn[i];
  const ep = `${C.t}="end plate"`, fin = `${C.t}="fin plate"`;
  const isEP = cn.t === 'end plate', isFin = cn.t === 'fin plate';
  const live = V.bmL[i] > 0;
  const onEP  = m => f(`IF(AND(${b.len}>0,${ep}),"${m}","")`, (live && isEP) ? m : '');
  const onEPR = m => f(`IF(AND(${b.len}>0,${ep},NOT(${isH})),"${m}","")`, (live && isEP && !H) ? m : '');
  const onFin = m => f(`IF(AND(${b.len}>0,${fin}),"${m}","")`, (live && isFin) ? m : '');
  const on    = m => f(`IF(${b.len}>0,"${m}","")`, live ? m : '');
  /* ROT.Z 180 turns BOTH horizontal axes, so the across offset has to be
     signed exactly as the outward one is. Leaving it unsigned looked right on
     X+ and Y+ and put the X- fin bolt at Y 13.25..29.75 - past the web
     entirely, bolted to nothing. Y+ survived only because the two planes
     extrude opposite ways (YZ gives +X, XZ gives -Y) and the two errors
     cancelled. */
  const sgn = (e, v) => (B.sg > 0 ? [e, v] : [`-(${e})`, -v]);
  const out = sgn, acr = sgn;
  const XY = (o, a) => isX ? [o, a] : [a, o];
  const pair = (o, a) => { const q = XY(o, a); return [f(q[0][0], q[0][1]), f(q[1][0], q[1][1])]; };
  const zero = ['0', 0];
  const finPlane = B.plane === 'YZ' ? 'XZ' : 'YZ';
  note2('');
  note2('beam ' + B.d + '  —  ' + (live ? V.bmC[i] + ', ' + (cn.t || 'a mark with no type')
                                        : 'off, its Length being 0'));
  // end plate on the beam end
  row(['MODULE', 'md.bm' + B.k, onEP(plate), 'mc']
      .concat(pair(out(`-${C.th}/2`, -cn.th / 2), zero))
      .concat([0, B.plane, 0, 0, B.rot]),
      i === 0 ? 'end plate, on the beam end' : '');
  // and its twin on a tube wall, where the bolt cannot go through
  row(['MODULE', 'md.bm' + B.k, onEPR(plate), 'mc']
      .concat(pair(out(`-1.5*${C.th}`, -1.5 * cn.th), zero))
      .concat([0, B.plane, 0, 0, B.rot]),
      i === 0 ? 'on a tube column, a second one welded to the wall' : '');
  // fin plate, welded to the column and standing out beside the beam web
  row(['MODULE', 'md.bm' + B.k, onFin(plate), 'mc']
      .concat(pair(out(`${C.w}/2-${C.sb}`, cn.w / 2 - cn.sb),
                   acr(`${b.tw}/2+${C.th}/2`, rnd(D.bmW / 2 + cn.th / 2))))
      .concat([0, finPlane, 0, 0, B.rot]),
      i === 0 ? 'fin plate, reaching out from the column beside the web' : '');
  row(['MODULE', 'md.bm' + B.k, on('sc.bm' + B.k), '', 0, 0, 0, B.plane, 0, 0, B.rot],
      i === 0 ? 'the beam, at the module origin' : '');
  // the bolts. An end plate bolt runs along the beam, two across the web; a
  // fin plate bolt runs across it, in one line.
  row(['MODULE', 'md.bm' + B.k,
       f(`IF(OR(${b.len}<=0,AND(NOT(${ep}),NOT(${fin}))),"","${bolt}")`,
         (live && (isEP || isFin)) ? bolt : ''), '']
      .concat(pair(out(`IF(${ep},IF(${isH},-((${thru})+${C.th}),-2*${C.th}),${C.g}-${C.sb})`,
                       isEP ? (H ? -(thruV + cn.th) : -2 * cn.th) : cn.g - cn.sb),
                   acr(`IF(${ep},-${C.g}/2,${b.tw}/2+${C.th})`,
                       isEP ? -cn.g / 2 : rnd(D.bmW / 2 + cn.th))))
      .concat([f(`-${C.p}*(${C.n}-1)/2`, -cn.p * (cn.n - 1) / 2),
               f(`IF(${ep},"${B.plane}","${finPlane}")`, isEP ? B.plane : finPlane),
               0, 0, B.rot])
      .concat(pair(zero, acr(`IF(${ep},${C.g},0)`, isEP ? cn.g : 0)))
      .concat([0, f(`IF(${ep},1,0)`, isEP ? 1 : 0)])
      .concat([0, 0, f(C.p, cn.p), f(`${C.n}-1`, cn.n - 1)]),
      i === 0 ? 'two across the web on an end plate, one line on a fin' : '');
  row(['MODULE', 'md.bm' + B.k, 'BASE', 'sc.bm' + B.k, 'mc']);
});

note2('');
note2('The beams go on last. No spin: they belong to the grid, not to the column.');
BDIR.forEach((B, i) => {
  const b = BMK(i), isX = B.ax === 'X';
  const face = isX ? faceXf : faceYf, faceV = isX ? D.faceX : D.faceY;
  const C = CNK(i);
  const at = `(${face})+IF(${C.t}="end plate",IF(${isH},${C.th},2*${C.th}),${C.sb})`;
  const atV = faceV + D.bOff[i];
  const cell = f(B.sg > 0 ? at : `-(${at})`, B.sg * atV);
  row(['ASSY', 'as.col', 'md.bm' + B.k, 'ADD',
       isX ? cell : 0, isX ? 0 : cell, 0],
      i === 0 ? 'the beam start: the column face, plus the plate or plates in front of it' : '');
});

note2('');
row(['END']);

wb.xlsx.writeFile(OUT).then(() => {
  console.log('written ' + OUT.split('/').pop());
  console.log('  SECT ' + (HS.length - 1) + ' H sections   TUBE ' + (TB.length - 1) +
              ' tubes   (each led by "' + USER + '")');
  console.log('  input ' + ir + ' rows');
  console.log('  Type ' + V.type + '   ' + V.sec);
  console.log('  upper ' + V.up + ' / middle ' + V.mid + ' / lower ' + V.dn);
  if (H) {
    console.log('  cover plates  flange ' + V.foW + 'x' + V.cpL + 'x' + V.foT +
                ' x2   inner ' + V.fiW + 'x' + V.cpL + 'x' + V.fiT +
                ' x4   web ' + V.wpW + 'x' + V.cpL + 'x' + V.wpT + ' x2');
    console.log('  pitch  flange ' + rnd(D.pFL) + ' / ' + rnd(D.pFT) +
                '   web ' + rnd(D.pWL) + ' / ' + rnd(D.pWT));
    console.log('  bolts  M' + V.dia + '  flange L' + D.lenF + ' x' + (2 * V.fNL * V.fNT) +
                '   web L' + D.lenW + ' x' + (V.wNL * V.wNT) + '  per splice');
  } else {
    console.log('  end plate ' + D.epB + 'x' + D.epH + 'x' + V.epT +
                '  (column + ' + V.epOV + ' all round)');
    console.log('  bolt ring  M' + V.dia + ' L' + D.lenE + '  ' + V.eNX + ' down each X side, ' +
                V.eNY + ' each Y   lines at ±' + D.eX + ', ±' + D.eY +
                '   pitch ' + rnd(D.pEX) + ' / ' + rnd(D.pEY) + '   ' + D.nE + ' bolts');
  }
  console.log('  connections  ' + V.conn.map(x =>
    x.m + '=' + (x.t || 'spare')).join('  '));
  console.log('  beams  ' + BDIR.map((B, i) => B.d + ' ' + V.bmC[i] +
    (V.bmL[i] > 0 ? '' : ' (off)')).join('   '));
  console.log('  stiffener  ' + D.stfN + ' plates at ' +
    (V.stf.filter(s => s.th > 0).map(s => s.off).join(', ') || '—'));
});
