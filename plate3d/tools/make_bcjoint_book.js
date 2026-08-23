/* PLATE3D_BCJOINT.xlsx — the beam-to-column joint as a parametric workbook.
     PARAM   what a person edits: two sections, a cleat, one bolt group
     SECT    the H list the dropdown reads, from design/hsection.csv
     ANGLE   the L list, from design/equalangle.csv + unequalangle.csv
     input   PLATE3D rows, every value a formula on PARAM
   Every formula carries its cached result, so the file loads as it stands
   without Excel having to recalculate first.

   The plain typed version is still make_bcjoint.js. This one replaces the
   workbook it wrote, the way make_splice_book.js replaced make_splice.js:
   the input tab keeps its comments, so nothing it taught is lost. */
const ExcelJS = require('exceljs'), fs = require('path') && require('fs');
const P3 = require('path').resolve(__dirname, '..');
const DESIGN = '/home/user/design';
const OUT = P3 + '/' + (process.env.OUT || 'PLATE3D_BCJOINT.xlsx');

/* ---------- the catalogues ---------- */
function csv(file) {
  const ln = fs.readFileSync(DESIGN + '/' + file, 'utf8')
    .replace(/^﻿/, '').split(/\r?\n/).filter(s => s.trim());
  const head = ln[0].split(',').map(s => s.trim());
  return ln.slice(1).map(l => { const f = l.split(','), o = {};
    head.forEach((h, i) => { o[h] = (f[i] || '').trim(); }); return o; });
}
/* H sections. Named the way the splice book names them, so a reader who has
   seen one workbook recognises the other. */
const HS = csv('hsection.csv').filter(r => r['KS규격여부'] === 'O')
  .map(r => ({ key: `H-${r.H}x${r.B}x${r.t1}x${r.t2} r${r.r}`,
               h: +r.H, b: +r.B, tw: +r.t1, tf: +r.t2, r: +r.r, kg: +r['단위무게'] }));
/* Angles. The name has to carry the thickness: the catalogue lists 60x60 twice
   and 65x65 three times, so "60x60" alone picks whichever row VLOOKUP meets
   first - which is how a 4mm cleat gets used where an 8 was meant. */
const AN = csv('equalangle.csv')
  .map(r => ({ key: `L-${r.A}x${r.B}x${r.t} r${r.r1}/${r.r2}`,
               a: +r.A, b: +r.B, t: +r.t, r1: +r.r1, r2: +r.r2, kg: +r['단위무게'] }))
  .concat(csv('unequalangle.csv').filter(r => r['KS규격여부'] === 'O')
    .map(r => ({ key: `L-${r.A}x${r.B}x${r.t} r${r.r1}/${r.r2}`,
                 a: +r.A, b: +r.B, t: +r.t, r1: +r.r1, r2: +r.r2, kg: +r['단위무게'] })));

const pick = (list, k) => list.find(s => s.key === k) || list[0];
/* The typed version used H-300x300x10x15 r13 and L-60x60x8. Neither is in the
   book: the KS H-300x300 has r18, and 60x60 only comes in 4 and 5. The cleat
   moves to 65x65x8, which keeps the 8 the grips are built on.

   The three env names are how a different pick gets tested. The engine reads
   the cached result of every formula, not the formula, so changing a dropdown
   by hand in the file proves nothing - the numbers below it would not move.
   Regenerating is the only honest way to see another section built. */
const COL = pick(HS, process.env.COLSEC || 'H-300x300x10x15 r18');
const BM  = pick(HS, process.env.BMSEC  || 'H-300x150x6.5x9 r13');
const CLT = pick(AN, process.env.CLSEC  || 'L-65x65x8 r8.5/6');

/* ---------- PARAM, by row ---------- */
const P = 'PARAM';
const R = { title: 1, sub: 2,
            mHead: 4,  mCols: 5,  col: 6,  bm: 7, gap: 8, steel: 9, mNote: 10, mChk: 11,
            cHead: 13, cCols: 14, cl: 15,  cNote: 16, cChk: 17,
            bHead: 19, bCols: 20, blt: 21, lCols: 22, len: 23, bNote: 24, bChk: 25 };
const c = (col, row) => `${P}!$${col}$${row}`;

/* every cell PARAM owns, named once */
const K = {
  cSec: c('C', R.col), cH: c('D', R.col), cB: c('E', R.col), cW: c('F', R.col),
  cF: c('G', R.col), cR: c('H', R.col), cKg: c('I', R.col), cLen: c('J', R.col),
  bSec: c('C', R.bm), bH: c('D', R.bm), bB: c('E', R.bm), bW: c('F', R.bm),
  bF: c('G', R.bm), bR: c('H', R.bm), bKg: c('I', R.bm), bLen: c('J', R.bm),
  gap: c('C', R.gap), steel: c('C', R.steel),
  lSec: c('C', R.cl), lA: c('D', R.cl), lB: c('E', R.cl), lT: c('F', R.cl),
  lR1: c('G', R.cl), lR2: c('H', R.cl), lKg: c('I', R.cl),
  end: c('J', R.cl), lLen: c('K', R.cl),
  grade: c('C', R.blt), dia: c('D', R.blt), hole: c('E', R.blt),
  pitch: c('F', R.blt), n: c('G', R.blt), gauge: c('H', R.blt),
  gripC: c('C', R.len), gripB: c('D', R.len), nut: c('E', R.len),
  need: c('F', R.len), bl: c('G', R.len), pjC: c('H', R.len), pjB: c('I', R.len)
};

/* the numbers the sheet opens with */
const V = {
  colLen: 1600, bmLen: 900, gap: 10, steel: 'SS275',
  end: 30, grade: 'F10T', dia: 16, pitch: 40, n: 3, gauge: 35
};
const D = {
  hole:  V.dia + 2,
  lLen:  V.pitch * (V.n - 1) + 2 * V.end,
  gripC: CLT.t + COL.tf,
  gripB: 2 * CLT.t + BM.tw,
  nut:   0.9 * V.dia
};
D.need = Math.max(D.gripC, D.gripB) + D.nut + 0.2 * V.dia;
D.bl   = Math.ceil(D.need / 5) * 5;
D.pjC  = +(D.bl - D.gripC - D.nut).toFixed(4);
D.pjB  = +(D.bl - D.gripB - D.nut).toFixed(4);
D.z0   = -V.pitch * (V.n - 1) / 2;
D.face = COL.h / 2;
const rnd = x => +x.toFixed(4);

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

/* ---------- a catalogue tab ---------- */
function catalogue(name, cols, rows) {
  const ws = wb.addWorksheet(name);
  ws.columns = [{ width: 26 }].concat(cols.slice(1).map(() => ({ width: 9 })));
  cols.forEach((t, i) => sty(ws.getCell(1, i + 1), { bold: true, color: 'FFFFFFFF',
    fill: HEADFILL, h: i ? 'center' : 'left', border: true }).value = t);
  rows.forEach((v, j) => v.forEach((x, i) => sty(ws.getCell(j + 2, i + 1),
    { h: i ? 'center' : 'left', border: true, fill: j % 2 ? BANDFILL : undefined }).value = x));
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  return `${name}!$A$2:$A$${rows.length + 1}`;
}

/* Tab order is creation order, and the file should open on the sheet a person
   edits. The engine finds its rows by the tab NAME "input", so where it sits
   costs it nothing. */
const ps = wb.addWorksheet('PARAM');
const is = wb.addWorksheet('input');

/* ================= PARAM ================= */
/* B is wide enough for the longest block title at 12pt, because a title that
   spills is a title that gets cut: the note in C is sitting right next to it
   and text only overflows into an empty cell. */
ps.columns = [{ width: 3 }, { width: 24 }, { width: 24 }, { width: 9 }, { width: 9 },
              { width: 9 }, { width: 9 }, { width: 9 }, { width: 10 }, { width: 10 },
              { width: 11 }, { width: 3 }];
ps.views = [{ showGridLines: false }];

function head(row, n, text, note) {
  sty(ps.getCell(row, 2), { bold: true, size: 12, color: 'FFFFFFFF', fill: HEADFILL })
    .value = '  ' + n + '.  ' + text;
  for (let col = 3; col <= 11; col++)
    sty(ps.getCell(row, col), { fill: HEADFILL, color: 'FFFFFFFF', size: 9 })
      .value = col === 3 && note ? note : null;
  if (note) ps.mergeCells(row, 3, row, 11);     // or it stops at C and is cut
  ps.getRow(row).height = 20;
}
function cols(row, labels) {
  labels.forEach((t, i) => { if (t === null || t === '') return;
    sty(ps.getCell(row, i + 2), { bold: true, size: 9, color: MUTE, h: i ? 'center' : 'left' })
      .value = t; });
}
const label = (row, t) =>
  sty(ps.getCell(row, 2), { bold: true, size: 10, color: INK }).value = t;
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
/* Merged, so it cannot overflow: whatever does not fit is simply not read.
   Keep these to about 120 characters. */
function note(row, t) {
  sty(ps.getCell(row, 2), { size: 9, italic: true, color: MUTE }).value = t;
  ps.mergeCells(row, 2, row, 11);
  if (t.length > 125) throw new Error('note too long for the merged width: ' + t.length);
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

sty(ps.getCell(R.title, 2), { bold: true, size: 18, color: INK }).value = 'BEAM TO COLUMN';
sty(ps.getCell(R.sub, 2), { size: 10, color: MUTE }).value =
  'Double angle cleat, bolted both sides. Fill in the blue cells — the input tab is written from this one and nothing on it needs touching.';
ps.getRow(R.title).height = 26;

/* ---- 1. members ---- */
head(R.mHead, 1, 'MEMBERS', 'section, length, the gap to the column face, and the steel grade');
cols(R.mCols, ['', 'Section', 'h', 'b', 'tw', 'tf', 'r', 'kg/m', 'Length']);
const SECTREF = { H: null, L: null };          // filled after the tabs are made
function member(row, name, sec, len) {
  label(row, name);
  inp(row, 3, sec.key);
  [['h', 2, sec.h], ['b', 3, sec.b], ['tw', 4, sec.tw], ['tf', 5, sec.tf],
   ['r', 6, sec.r], ['kg', 7, sec.kg]].forEach(([, n, val], i) =>
    calc(row, 4 + i, `IFERROR(VLOOKUP($C$${row},SECT!$A:$G,${n},FALSE),"")`, val,
         n === 7 ? '0.0' : '0.##'));
  inp(row, 10, len);
}
member(R.col, 'Column', COL, V.colLen);
member(R.bm,  'Beam',   BM,  V.bmLen);
label(R.gap, 'Gap');   inp(R.gap, 3, V.gap);
sty(ps.getCell(R.gap, 4), { size: 9, italic: true, color: MUTE }).value =
  'beam end to column face';
label(R.steel, 'Steel'); inp(R.steel, 3, V.steel);
sty(ps.getCell(R.steel, 4), { size: 9, italic: true, color: MUTE }).value =
  'all three sections — the bolts carry their own grade';
note(R.mNote, 'The input tab turns the column 90° so its flanges face the beam. A square column cannot show that in a bounding box.');
checked(R.mChk, [
  ['gap', `IF(${K.gap}>0,${K.gap}&" ok","must be > 0")`, V.gap + ' ok'],
  ['face X', `${K.cH}/2`, D.face]
]);

/* ---- 2. cleat ---- */
head(R.cHead, 2, 'CLEAT', 'two of them, one either side of the beam web - pick the angle and the end distance');
cols(R.cCols, ['', 'Angle', 'a', 'b', 't', 'r1', 'r2', 'kg/m', 'End', 'Length']);
label(R.cl, 'Angle');
inp(R.cl, 3, CLT.key);
[['a', 2, CLT.a], ['b', 3, CLT.b], ['t', 4, CLT.t], ['r1', 5, CLT.r1],
 ['r2', 6, CLT.r2], ['kg', 7, CLT.kg]].forEach(([, n, val], i) =>
  calc(R.cl, 4 + i, `IFERROR(VLOOKUP($C$${R.cl},ANGLE!$A:$G,${n},FALSE),"")`, val,
       n === 7 ? '0.0' : '0.##'));
inp(R.cl, 10, V.end);
/* Length follows the bolts rather than being typed. A cleat shorter than its
   own bolt chain is a drawing that cannot be fabricated, and the way to make
   that impossible is to not let anyone write it. */
calc(R.cl, 11, `${K.pitch}*(${K.n}-1)+2*${K.end}`, D.lLen, '0.##');
note(R.cNote, 'End is the outer bolt to the end of the cleat, so Length = pitch × (count − 1) + 2 × End. A Length cannot be typed short.');
checked(R.cChk, [
  ['in the web', `IF(${K.lLen}<=${K.bH}-2*${K.bF}-2*${K.bR},${K.lLen}&" ≤ "&(${K.bH}-2*${K.bF}-2*${K.bR}),"too long for the web")`,
    D.lLen + ' ≤ ' + (BM.h - 2 * BM.tf - 2 * BM.r)],
  ['on flange', `IF(${K.bW}/2+${K.lB}<=${K.cB}/2,ROUND(${K.bW}/2+${K.lB},0)&" ≤ "&(${K.cB}/2),"too wide")`,
    Math.round(BM.tw / 2 + CLT.b) + ' ≤ ' + COL.b / 2],
  ['fillet', `IF(${K.gauge}>=${K.lT}+${K.lR1},${K.gauge}&" ≥ "&(${K.lT}+${K.lR1}),"in the fillet")`,
    V.gauge + ' ≥ ' + rnd(CLT.t + CLT.r1)],
  ['beam end', `IF(${K.gauge}-${K.gap}>=1.5*${K.dia},(${K.gauge}-${K.gap})&" ≥ "&(1.5*${K.dia}),"too near")`,
    (V.gauge - V.gap) + ' ≥ ' + 1.5 * V.dia]
]);

/* ---- 3. bolts ---- */
head(R.bHead, 3, 'BOLTS', 'one group - the same bolt size holds the cleat to the column and to the beam');
cols(R.bCols, ['', 'Grade', 'Dia', 'Hole', 'Pitch', 'Count', 'Gauge']);
label(R.blt, 'Bolt');
inp(R.blt, 3, V.grade);
inp(R.blt, 4, V.dia);
calc(R.blt, 5, `${K.dia}+2`, D.hole, '0.##');
inp(R.blt, 6, V.pitch);
inp(R.blt, 7, V.n);
inp(R.blt, 8, V.gauge);
cols(R.lCols, ['', 'grip column', 'grip beam', 'nut', 'needed', 'LENGTH', 'proj col', 'proj beam']);
label(R.len, 'Lengths');
calc(R.len, 3, `${K.lT}+${K.cF}`, D.gripC, '0.##');
calc(R.len, 4, `2*${K.lT}+${K.bW}`, D.gripB, '0.##');
calc(R.len, 5, `0.9*${K.dia}`, D.nut, '0.##');
calc(R.len, 6, `MAX(${K.gripC},${K.gripB})+${K.nut}+0.2*${K.dia}`, rnd(D.need), '0.##');
/* One length for both groups, rounded up to something a merchant stocks. Left
   to itself each group would come out on its own millimetre - 40.6 and 40.1
   here - and the take-off would carry two lines for a bolt nobody orders
   twice. Overwrite the cell to use a length of your own; the check below
   still holds you to the grip. */
calc(R.len, 7, `CEILING(${K.need},5)`, D.bl, '0.##', { color: INK, bold: true });
calc(R.len, 8, `${K.bl}-${K.gripC}-${K.nut}`, D.pjC, '0.##');
calc(R.len, 9, `${K.bl}-${K.gripB}-${K.nut}`, D.pjB, '0.##');
note(R.bNote, 'One LENGTH for both groups, rounded up to 5; proj takes up what the grip leaves. That is what keeps the take-off to one line.');
checked(R.bChk, [
  ['pitch', `IF(${K.pitch}>=2.5*${K.dia},${K.pitch}&" ≥ "&(2.5*${K.dia}),"under 2.5d")`,
    V.pitch + ' ≥ ' + 2.5 * V.dia],
  ['end', `IF(${K.end}>=1.5*${K.dia},${K.end}&" ≥ "&(1.5*${K.dia}),"under 1.5d")`,
    V.end + ' ≥ ' + 1.5 * V.dia],
  ['edge', `IF(MIN(${K.lA},${K.lB})-${K.gauge}>=1.5*${K.dia},(MIN(${K.lA},${K.lB})-${K.gauge})&" ≥ "&(1.5*${K.dia}),"under 1.5d")`,
    (Math.min(CLT.a, CLT.b) - V.gauge) + ' ≥ ' + 1.5 * V.dia],
  ['length', `IF(${K.bl}>=${K.need},${K.bl}&" ≥ "&ROUND(${K.need},1),"shorter than the grip")`,
    D.bl + ' ≥ ' + rnd(D.need)]
]);

/* ================= the catalogue tabs ================= */
SECTREF.H = catalogue('SECT', ['Section', 'h', 'b', 'tw', 'tf', 'r', 'kg/m'],
  HS.map(s => [s.key, s.h, s.b, s.tw, s.tf, s.r, s.kg]));
SECTREF.L = catalogue('ANGLE', ['Angle', 'a', 'b', 't', 'r1', 'r2', 'kg/m'],
  AN.map(s => [s.key, s.a, s.b, s.t, s.r1, s.r2, s.kg]));
[[R.col, SECTREF.H], [R.bm, SECTREF.H], [R.cl, SECTREF.L]].forEach(([row, ref]) => {
  ps.getCell(row, 3).dataValidation = { type: 'list', allowBlank: false, formulae: [ref],
    showErrorMessage: true, error: 'Pick one from the catalogue tab.' };
});

/* ================= input ================= */
is.columns = [{ width: 44 }, { width: 11 }, { width: 12 }, { width: 10 }, { width: 10 }]
  .concat(Array.from({ length: 13 }, () => ({ width: 9 })));
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

/* --- sections --- */
note2('');
note2('SECT  id  material  length  TYPE  base.pt  v1..v7');
row(['SECT', 'sc.col', f(K.steel, V.steel), f(K.cLen, V.colLen), 'H', 'mc',
     f(K.cH, COL.h), f(K.cB, COL.b), f(K.cB, COL.b), f(K.cW, COL.tw),
     f(K.cF, COL.tf), f(K.cF, COL.tf), f(K.cR, COL.r)], 'column');
row(['SECT', 'sc.bm', f(K.steel, V.steel), f(K.bLen, V.bmLen), 'H', 'mc',
     f(K.bH, BM.h), f(K.bB, BM.b), f(K.bB, BM.b), f(K.bW, BM.tw),
     f(K.bF, BM.tf), f(K.bF, BM.tf), f(K.bR, BM.r)], 'beam');
row(['SECT', 'sc.cl', f(K.steel, V.steel), f(K.lLen, D.lLen), 'L', 'mc',
     f(K.lA, CLT.a), f(K.lB, CLT.b), f(K.lT, CLT.t), f(K.lT, CLT.t),
     f(K.lR1, CLT.r1), f(K.lR2, CLT.r2)], 'cleat, x2 — the L is the whole reason there is no CUT row here');

/* --- bolts --- */
note2('');
note2('BOLT  id  material  dia  length  hole  [head_af]  [head_h]  [nut_af]  nut_h  proj');
note2('The point on the MODULE row is the underside of the head. Both bolts are the same length, and proj — the thread past the nut — takes up whatever the grip leaves, so the take-off carries one line and not two.');
row(['BOLT', 'bo.c', f(K.grade, V.grade), f(K.dia, V.dia), f(K.bl, D.bl),
     f(K.hole, D.hole), '', '', '', f(K.nut, D.nut), f(K.pjC, D.pjC)],
    'through the column flange and one cleat leg');
row(['BOLT', 'bo.b', f(K.grade, V.grade), f(K.dia, V.dia), f(K.bl, D.bl),
     f(K.hole, D.hole), '', '', '', f(K.nut, D.nut), f(K.pjB, D.pjB)],
    'through cleat, beam web and cleat');

/* --- modules --- */
const z0 = `-${K.pitch}*(${K.n}-1)/2`;
note2('');
note2('MODULE  id  member  Ref.Pt  L.X  L.Y  L.Z  PLANE  [ROT.X ROT.Y ROT.Z]  [dx dy dz repeat]');
note2('Every module starts at its own origin and the ASSY rows below place it. A section held by BASE is held at the centre of its starting face, so writing a world coordinate here as well would drag the member back.');
row(['MODULE', 'md.col', 'sc.col', '', 0, 0, 0, 'XY', 0, 0, 90],
    'ROT.Z 90 turns the column so its FLANGES face the beam');
row(['MODULE', 'md.col', 'BASE', 'sc.col', 'mc']);
note2('');
row(['MODULE', 'md.bm', 'sc.bm', '', 0, 0, 0, 'YZ']);
row(['MODULE', 'md.bm', 'BASE', 'sc.bm', 'mc']);
note2('');
row(['MODULE', 'md.cl', 'sc.cl', '', 0, 0, 0, 'XY'], 'the cleat, and the bolts that hold it to the column');
row(['MODULE', 'md.cl', 'bo.c', '',
     f(`-(${K.lA}/2+${K.cF})`, rnd(-(CLT.a / 2 + COL.tf))),
     f(`${K.gauge}-${K.lB}/2`, rnd(V.gauge - CLT.b / 2)),
     f(`${K.lLen}/2+${z0}`, rnd(D.lLen / 2 + D.z0)), 'YZ', 0, 0, 0,
     0, 0, f(K.pitch, V.pitch), f(`${K.n}-1`, V.n - 1)],
    'the head stands off behind the flange, and the shank runs through flange and leg');
row(['MODULE', 'md.cl', 'BASE', 'sc.cl', 'mc']);
note2('');
row(['MODULE', 'md.bb', 'bo.b', '', 0, 0, 0, 'XZ', 0, 0, 0,
     0, 0, f(K.pitch, V.pitch), f(`${K.n}-1`, V.n - 1)]);
row(['MODULE', 'md.bb', 'BASE', 'bo.b_1', 'mc']);

/* --- assembly --- */
note2('');
note2('ASSY  id  ref  cmd  p1 p2 p3 p4');
row(['ASSY', 'as.j', 'md.col', 'ADD', 0, 0, f(`-${K.cLen}/2`, -V.colLen / 2)]);
row(['ASSY', 'as.j', 'md.bm', 'ADD', f(`${K.cH}/2+${K.gap}`, COL.h / 2 + V.gap), 0, 0],
    'the beam starts one gap clear of the column face');
row(['ASSY', 'as.cl', 'md.cl', 'ADD',
     f(`${K.cH}/2+${K.lA}/2`, rnd(COL.h / 2 + CLT.a / 2)),
     f(`${K.bW}/2+${K.lB}/2`, rnd(BM.tw / 2 + CLT.b / 2)),
     f(`-${K.lLen}/2`, -D.lLen / 2)],
    'the L is held on its bbox centre, so the heel lands on the flange face and the web');
row(['ASSY', 'as.clm', 'as.cl', 'MIR', 0, 0, 0, 'XZ'], 'the other cleat');
row(['ASSY', 'as.j', 'md.bb', 'ADD',
     f(`${K.cH}/2+${K.gauge}`, rnd(COL.h / 2 + V.gauge)),
     f(`${K.bW}/2+${K.lT}`, rnd(BM.tw / 2 + CLT.t)),
     f(z0, D.z0)]);
note2('');
row(['END']);

wb.xlsx.writeFile(OUT).then(() => {
  console.log('written ' + OUT.split('/').pop());
  console.log('  SECT  ' + HS.length + ' sections   ANGLE  ' + AN.length + ' angles');
  console.log('  input ' + ir + ' rows');
  console.log('  column ' + COL.key + '   beam ' + BM.key);
  console.log('  cleat  ' + CLT.key + '   length ' + D.lLen + ' (end ' + V.end + ')');
  console.log('  grips  ' + D.gripC + ' / ' + D.gripB + '   needed ' + rnd(D.need) +
              '   LENGTH ' + D.bl + '   proj ' + D.pjC + ' / ' + D.pjB);
  console.log('  column face at X ' + D.face + '   first bolt z ' + D.z0);
});
