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
  /* end plate bolts through the column; fin plate is welded to it and bolts
     through the BEAM'S web instead - which is the one that works on a tube,
     because nothing has to reach inside the wall */
  bmD: ['end plate', 'fin plate', 'fin plate', 'fin plate'],
  /* 230, not 300: one plate serves all four faces, and a beam on the WEB face
     has to fit between the flanges - h - 2tf - 2r, which is 234 on the default
     column. A plate sized for the flange face drives straight through them. */
  bepW: 230, bepT: 20, bepG: 140, bepE: 45, bepP: 70, bepN: 3,
  finB: 140, finT: 10, finG: 60, finE: 45, finP: 70, finN: 3, finS: 10
};
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
D.bepH = V.bepP * (V.bepN - 1) + 2 * V.bepE;
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
D.bGripX = H ? D.thruX + V.bepT : 2 * V.bepT;
D.bGripY = H ? D.thruY + V.bepT : 2 * V.bepT;
D.bLenX = up5(D.bGripX + D.nut + 0.2 * V.dia);
D.bLenY = up5(D.bGripY + D.nut + 0.2 * V.dia);
D.bOff  = H ? V.bepT : 2 * V.bepT;               // beam start, out from the face
D.finH  = V.finP * (V.finN - 1) + 2 * V.finE;
D.gripFin = V.finT + D.bmW;
D.lenFin  = up5(D.gripFin + D.nut + 0.2 * V.dia);
const rnd = x => +(+x).toFixed(4);
const pick = (a, b) => (H ? a : b);

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
            nHead: 42, nCols: 43, bep: 44, fin2: 45, nNote: 46, nChk: 47 };
const BMROW = [35, 36, 37, 38];                  // X+  X-  Y+  Y-
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
  epOV: c('J', R.ep),
  bepW: c('E', R.bep), bepH: c('F', R.bep), bepT: c('G', R.bep),
  bepG: c('H', R.bep), bepE: c('I', R.bep), bepP: c('J', R.bep), bepN: c('K', R.bep),
  finS: c('D', R.fin2), finB: c('E', R.fin2), finH: c('F', R.fin2), finT: c('G', R.fin2),
  finG: c('H', R.fin2), finE: c('I', R.fin2), finP: c('J', R.fin2), finN: c('K', R.fin2)
};
// one beam's cells, by its row
const BMK = i => ({ det: c('C', BMROW[i]), sec: c('D', BMROW[i]), h: c('E', BMROW[i]), b: c('F', BMROW[i]),
                   tw: c('G', BMROW[i]), tf: c('H', BMROW[i]), r: c('I', BMROW[i]),
                   len: c('J', BMROW[i]), kg: c('K', BMROW[i]) });
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
  inp(row, 3, V.bmD[i]).dataValidation = { type: 'list', allowBlank: false,
    formulae: ['"end plate,fin plate"'], showErrorMessage: true,
    error: 'end plate bolts through the column; fin plate bolts through the beam web.' };
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

/* ---- 5. the beam end plate ---- */
head(R.nHead, 5, 'BEAM CONNECTION', 'end plate bolts through the column; fin plate is welded to it and bolts through the beam web — the one a tube can take');
cols(R.nCols, ['', '', 'setback', 'width', 'height', 'thick', 'gauge', 'edge', 'pitch', 'count']);
label(R.bep, 'End plate');
inp(R.bep, 5, V.bepW);
calc(R.bep, 6, `${K.bepP}*(${K.bepN}-1)+2*${K.bepE}`, D.bepH, '0.##');
inp(R.bep, 7, V.bepT);
inp(R.bep, 8, V.bepG);
inp(R.bep, 9, V.bepE);
inp(R.bep, 10, V.bepP);
inp(R.bep, 11, V.bepN);
label(R.fin2, 'Fin plate');
inp(R.fin2, 4, V.finS);
inp(R.fin2, 5, V.finB);
calc(R.fin2, 6, `${K.finP}*(${K.finN}-1)+2*${K.finE}`, D.finH, '0.##');
inp(R.fin2, 7, V.finT);
inp(R.fin2, 8, V.finG);
inp(R.fin2, 9, V.finE);
inp(R.fin2, 10, V.finP);
inp(R.fin2, 11, V.finN);
sty(ps.getCell(R.bep, 4), { h: 'center', color: MUTE }).value = 0;
note(R.nNote, 'Each height follows its own bolts. End plate gauge is across the beam web; fin plate gauge is out from the column face, setback the beam end short.');
checked(R.nChk, [
  ['gauge', `IF(${isH},IF(${K.bepG}>=${BMK(0).tw}+3*${K.dia},"ok","too tight for the web"),` +
    `IF(${K.bepG}>=${BMK(0).b}+3*${K.dia},"ok","must clear the beam on a tube"))`,
    H ? (V.bepG >= D.bmW + 3 * V.dia ? 'ok' : 'too tight for the web')
      : (V.bepG >= D.bmB + 3 * V.dia ? 'ok' : 'must clear the beam on a tube')],
  ['edge', `IF(${K.bepW}/2-${K.bepG}/2>=1.5*${K.dia},"ok","plate too narrow")`,
    V.bepW / 2 - V.bepG / 2 >= 1.5 * V.dia ? 'ok' : 'plate too narrow'],
  /* The web face is the tight one. A plate wide enough for a flange face
     drives straight through the flanges when it is used on the web, and one
     plate serves all four - so it has to suit the narrower of them. */
  ['between flanges', `IF(${isH},IF(${K.bepW}<=${K.h}-2*${K.tf}-2*${K.r},` +
    `${K.bepW}&" ≤ "&(${K.h}-2*${K.tf}-2*${K.r}),"hits the flanges on a web face"),"n/a")`,
    pick(V.bepW <= D.h - 2 * D.tf - 2 * D.r
         ? V.bepW + ' ≤ ' + (D.h - 2 * D.tf - 2 * D.r) : 'hits the flanges on a web face', 'n/a')],
  ['bolt', `"M"&${K.dia}&" L"&IF(${isH},CEILING(MAX(${thruXf},${thruYf})+${K.bepT}+1.1*${K.dia},5),` +
    `CEILING(2*${K.bepT}+1.1*${K.dia},5))`,
    'M' + V.dia + ' L' + Math.max(D.bLenX, D.bLenY)],
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
row(['PLATE', 'pl.bep', f(K.steel, V.steel), f(K.bepT, V.bepT), 'RECT', 'mc',
     f(K.bepW, V.bepW), f(K.bepH, D.bepH)], 'the beam end plate');
row(['PLATE', 'pl.fin', f(K.steel, V.steel), f(K.finT, V.finT), 'RECT', 'mc',
     f(K.finB, V.finB), f(K.finH, D.finH)], 'the fin plate — welded to the column, not the beam');
row(['BOLT', 'bo.fin', f(K.grade, V.grade), f(K.dia, V.dia),
     f(`CEILING(${K.finT}+${BMK(0).tw}+1.1*${K.dia},5)`, D.lenFin), f(K.hole, D.hole),
     '', '', '', f(`0.9*${K.dia}`, D.nut),
     f(`CEILING(${K.finT}+${BMK(0).tw}+1.1*${K.dia},5)-${K.finT}-${BMK(0).tw}-0.9*${K.dia}`,
       rnd(D.lenFin - D.gripFin - D.nut))],
    'the fin plate bolt: through plate and web, and never through the column');
[['x', thruXf, D.bGripX, D.bLenX], ['y', thruYf, D.bGripY, D.bLenY]].forEach(([t, thru, grip, len]) => {
  const lf = `IF(${isH},CEILING(${thru}+${K.bepT}+1.1*${K.dia},5),CEILING(2*${K.bepT}+1.1*${K.dia},5))`;
  const gf = `IF(${isH},${thru}+${K.bepT},2*${K.bepT})`;
  row(['BOLT', 'bo.b' + t, f(K.grade, V.grade), f(K.dia, V.dia), f(lf, len), f(K.hole, D.hole),
       '', '', '', f(`0.9*${K.dia}`, D.nut),
       f(`(${lf})-(${gf})-0.9*${K.dia}`, rnd(len - grip - D.nut))],
      t === 'x' ? 'through the flange on an H column, or through two plates on a tube' : '');
});

note2('');
note2('Each beam is one module, written for BOTH details at once. Its origin is the START FACE OF THE BEAM, which is the point BASE holds, so every other row is a distance measured back from there.');
BDIR.forEach((B, i) => {
  const b = BMK(i), isX = B.ax === 'X';
  const thru = isX ? thruXf : thruYf;
  const thruV = isX ? D.thruX : D.thruY;
  const bolt = 'bo.b' + (isX ? 'x' : 'y');
  const ep = `${b.det}="end plate"`, fin = `${b.det}="fin plate"`;
  const isEP = V.bmD[i] === 'end plate', isFin = V.bmD[i] === 'fin plate';
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
  note2('beam ' + B.d + '  —  ' + (live ? V.bmD[i] : 'off, its Length being 0'));
  // end plate on the beam end
  row(['MODULE', 'md.bm' + B.k, onEP('pl.bep'), 'mc']
      .concat(pair(out(`-${K.bepT}/2`, -V.bepT / 2), zero))
      .concat([0, B.plane, 0, 0, B.rot]),
      i === 0 ? 'end plate, on the beam end' : '');
  // and its twin on a tube wall, where the bolt cannot go through
  row(['MODULE', 'md.bm' + B.k, onEPR('pl.bep'), 'mc']
      .concat(pair(out(`-1.5*${K.bepT}`, -1.5 * V.bepT), zero))
      .concat([0, B.plane, 0, 0, B.rot]),
      i === 0 ? 'on a tube column, a second one welded to the wall' : '');
  // fin plate, welded to the column and standing out beside the beam web
  row(['MODULE', 'md.bm' + B.k, onFin('pl.fin'), 'mc']
      .concat(pair(out(`${K.finB}/2-${K.finS}`, V.finB / 2 - V.finS),
                   acr(`${b.tw}/2+${K.finT}/2`, rnd(D.bmW / 2 + V.finT / 2))))
      .concat([0, finPlane, 0, 0, B.rot]),
      i === 0 ? 'fin plate, reaching out from the column beside the web' : '');
  row(['MODULE', 'md.bm' + B.k, on('sc.bm' + B.k), '', 0, 0, 0, B.plane, 0, 0, B.rot],
      i === 0 ? 'the beam, at the module origin' : '');
  // the bolts. An end plate bolt runs along the beam, two across the web; a
  // fin plate bolt runs across it, in one line.
  row(['MODULE', 'md.bm' + B.k,
       f(`IF(${b.len}<=0,"",IF(${ep},"${bolt}","bo.fin"))`,
         !live ? '' : (isEP ? bolt : 'bo.fin')), '']
      .concat(pair(out(`IF(${ep},IF(${isH},-((${thru})+${K.bepT}),-2*${K.bepT}),${K.finG}-${K.finS})`,
                       isEP ? (H ? -(thruV + V.bepT) : -2 * V.bepT) : V.finG - V.finS),
                   acr(`IF(${ep},-${K.bepG}/2,${b.tw}/2+${K.finT})`,
                       isEP ? -V.bepG / 2 : rnd(D.bmW / 2 + V.finT))))
      .concat([f(`IF(${ep},-${K.bepP}*(${K.bepN}-1)/2,-${K.finP}*(${K.finN}-1)/2)`,
                 isEP ? -V.bepP * (V.bepN - 1) / 2 : -V.finP * (V.finN - 1) / 2),
               f(`IF(${ep},"${B.plane}","${finPlane}")`, isEP ? B.plane : finPlane),
               0, 0, B.rot])
      .concat(pair(zero, acr(`IF(${ep},${K.bepG},0)`, isEP ? V.bepG : 0)))
      .concat([0, f(`IF(${ep},1,0)`, isEP ? 1 : 0)])
      .concat([0, 0, f(`IF(${ep},${K.bepP},${K.finP})`, isEP ? V.bepP : V.finP),
               f(`IF(${ep},${K.bepN}-1,${K.finN}-1)`, isEP ? V.bepN - 1 : V.finN - 1)]),
      i === 0 ? 'two across the web on an end plate, one line on a fin' : '');
  row(['MODULE', 'md.bm' + B.k, 'BASE', 'sc.bm' + B.k, 'mc']);
});

note2('');
note2('The beams go on last. No spin: they belong to the grid, not to the column.');
BDIR.forEach((B, i) => {
  const b = BMK(i), isX = B.ax === 'X';
  const face = isX ? faceXf : faceYf, faceV = isX ? D.faceX : D.faceY;
  const at = `(${face})+IF(${b.det}="end plate",IF(${isH},${K.bepT},2*${K.bepT}),${K.finS})`;
  const atV = faceV + (V.bmD[i] === 'end plate' ? D.bOff : V.finS);
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
});
