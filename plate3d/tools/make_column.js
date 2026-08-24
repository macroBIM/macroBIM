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
  dia: 16, grade: 'F10T'
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
            sHead: 4,  sCols: 5,  sec: 6,  len: 7,  steel: 8, sNote: 9, sChk: 10,
            pHead: 12, pCols: 13, fo: 14, fi: 15, wp: 16, ep: 17, pNote: 18, pChk: 19,
            bHead: 21, bCols: 22, blt: 23, gCols: 24, gF: 25, gW: 26,
            eCols: 27, gE: 28, bNote: 29, bChk: 30 };
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
const isH = `${K.typ}="H"`;
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
