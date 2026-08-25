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

/* ---------- the model ----------
   Everything the column IS - the defaults, everything derived from them, and
   the rows the engine reads - lives in column_model.js, because QuickPlate3D
   builds the same column in a browser with no workbook at all. Two copies of
   this arithmetic would agree right up until the day one of them was edited.

   What is left here is only what needs a file: the catalogues off disk, the
   PARAM sheet's layout and styling, and writing the .xlsx. The names below are
   the ones the chapters were already written against, so those read unchanged.

   The overrides - CTYPE, COLSEC, CALPHA, UDEF, BMC, BML - are read by the
   module out of the environment it is handed, so the shell and a browser
   reach the same switches. */
const CM = require('./column_model.js');
const cat = { HS: HS, TB: TB, findH: findH, findT: findT };
const prep = CM.defaults(process.env, cat);
const M = CM.build(prep.V, cat, prep);
const V = M.V, D = M.D, H = M.H, SEC = M.SEC, SQ = M.SQ, UDEF = prep.UDEF;
const R = M.R, K = M.K, F = M.F, CC = M.CC;
const BMROW = M.BMROW, CNROW = M.CNROW, STFROW = M.STFROW, NSTF = M.NSTF;
const BMK = M.BMK, SK = M.SK, CNK = M.CNK, CONNT = M.CONNT;
const CNTAB = M.CNTAB, CNMARK = M.CNMARK, CNTYPE = M.CNTYPE, CNW = M.CNW;
const isH = M.isH, SQf = M.SQf;
const faceXf = M.faceXf, faceYf = M.faceYf, thruXf = M.thruXf, thruYf = M.thruYf;
const pick = M.pick, rnd = M.rnd, cnH = M.cnH;
const BDIR = M.BDIR;                      // the four beam directions, for the report

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
/* Chapter order, and why it is this one:

     1 SECTION            what the column is
     2 COLUMN STIFFENER   what goes inside it
     3 SPLICE PLATES      how its pieces join
     4 BOLTS
     5 CONNECTION         the library of details
     6 BEAMS              each one names a detail from 5

   The column is finished before anything hangs off it, and a connection is
   declared before a beam can name one - so the sheet is read forwards, with
   no cell pointing at a chapter you have not filled in yet. */

/* B..L carry the sheet, M is the right margin. The last data column was K
   until the connection library needed a mark column and a note column ahead
   of its numbers; rather than drop the plate height to make room, the sheet
   got one column wider. Chapters that do not need L simply leave it empty -
   the header bar and the notes still run the full width, so a block reads as
   one block. */
const LASTC = 12;                                // L
ps.columns = [{ width: 3 }, { width: 21 }, { width: 9 }, { width: 26 }, { width: 10 },
              { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 },
              { width: 10 }, { width: 11 }, { width: 3 }];
ps.views = [{ showGridLines: false }];

function head(row, n, text, note) {
  sty(ps.getCell(row, 2), { bold: true, size: 12, color: 'FFFFFFFF', fill: HEADFILL })
    .value = '  ' + n + '.  ' + text;
  for (let col = 3; col <= LASTC; col++)
    sty(ps.getCell(row, col), { fill: HEADFILL, color: 'FFFFFFFF', size: 9 })
      .value = col === 3 && note ? note : null;
  if (note) ps.mergeCells(row, 3, row, LASTC);
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
  ps.mergeCells(row, 2, row, LASTC);
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
ps.mergeCells(R.steel, 5, R.steel, LASTC);
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

/* ---- 2. the column stiffener ----
   Straight after the section, because that is what it belongs to: it is steel
   welded inside the column, not part of any beam. One sheet row is one LEVEL,
   and the level is signed - up is positive - so a beam's two flanges are two
   rows. The offsets do depend on how deep the beams are, which is chapter 6,
   so the check row carries each beam's flange height for copying up. */
head(R.tHead, 2, 'COLUMN STIFFENER', 'horizontal plates inside an H — a tube cannot take one, nothing reaches inside the wall');
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

/* ---- 3. plates ---- */
head(R.pHead, 3, 'SPLICE PLATES', 'cover plates on an H, an end plate on a tube — Type keeps whichever the section calls for');
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

/* ---- 4. bolts ---- */
head(R.bHead, 4, 'BOLTS', 'the shank and the hole are different sizes, and each grip gets its own length');
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
head(R.nHead, 5, 'CONNECTION', 'declare them here, then name one against each beam below — end plate bolts through the column, fin plate through the beam web');
cols(R.nCols, ['', 'Type', 'what it is', 'setback', 'width', 'height', 'thick',
               'gauge', 'edge', 'pitch', 'count']);
V.conn.forEach((cn, i) => {
  const rw = CNROW[i];
  label(rw, cn.m, { color: cn.t ? INK : OFFTXT });
  inp(rw, 3, cn.t || null).dataValidation = { type: 'list', allowBlank: true,
    formulae: [`"${CONNT.join(',')}"`], showErrorMessage: true,
    error: 'end plate bolts through the column; fin plate bolts through the beam web.' };
  sty(inp(rw, 4, cn.d || null), { h: 'left', border: true, fill: INFILL,
                                  color: BLUE, bold: true });
  inp(rw, 5, cn.sb, '0.##');
  inp(rw, 6, cn.w, '0.##');
  // shown, not typed: the plate is exactly as deep as its bolt group needs
  calc(rw, 7, `K${rw}*(L${rw}-1)+2*J${rw}`, cnH(cn), '0.##');
  [[8, cn.th], [9, cn.g], [10, cn.e], [11, cn.p], [12, cn.n]]
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

/* ---- 6. the beams ---- */
head(R.mHead, 6, 'BEAMS', 'four world directions - X+ X- Y+ Y-. Length 0 and that beam is not there');
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
[`B${R.fo}:L${R.wp}`, `B${R.gF}:L${R.gW}`, `H${R.blt}:I${R.blt}`]
  .forEach(ref => dimWhen(ref, NOT_H));
// the end plate detail, its own bolt heading and row
[`B${R.ep}:L${R.ep}`, `B${R.eCols}:L${R.gE}`, `J${R.blt}:J${R.blt}`]
  .forEach(ref => dimWhen(ref, IS_H));
// the stiffener block, which only an H can take
dimWhen(`B${R.stf0}:L${R.stf0 + NSTF - 1}`, NOT_H);

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

/* ================= input =================
   The rows come from the model module; this only lays them out. Each cell is
   either a plain value or { f, v } - a formula with the result it last
   evaluated to - and the workbook needs both: Excel recalculates from `f` when
   PARAM changes, and the engine reads `v`. Column 1 is the comment margin,
   which the parser ignores. */
is.columns = [{ width: 50 }, { width: 11 }, { width: 12 }, { width: 11 }, { width: 10 }]
  .concat(Array.from({ length: 14 }, () => ({ width: 9 })));
is.views = [{ showGridLines: false }];
let ir = 0;
M.rows.forEach(r => {
  ir++;
  if (r.comment) sty(is.getCell(ir, 1), { size: 9, italic: true, color: MUTE }).value = r.comment;
  r.cells.forEach((v, i) => {
    const cell = sty(is.getCell(ir, i + 2), { size: 10, h: i ? 'center' : 'left',
                                              color: i ? INK : BLUE, bold: !i });
    if (v && typeof v === 'object') cell.value = { formula: v.f, result: v.v };
    else if (v !== null && v !== undefined && v !== '') cell.value = v;
  });
});


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
