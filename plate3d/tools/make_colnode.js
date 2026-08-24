/* PLATE3D_COLNODE.xlsx — one column, four beams, and up to two splices.
     PARAM   what a person edits
     SECT    the H list the dropdowns read, from design/hsection.csv
     input   PLATE3D rows, every value a formula on PARAM

   The column is an H or a square tube. Each of its four faces takes an end
   plate, a fin plate, or nothing, chosen on the front sheet. A splice appears
   above or below simply by giving that piece of column a length; type 0 and
   the piece, its plates and its bolts are all gone.

   There is not one CUT row in the file. BOLT drills what it passes through,
   plates included - which is what collapsed three connection details into
   one grammar. */
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const P3 = path.resolve(__dirname, '..');
const DESIGN = '/home/user/design';
const OUT = P3 + '/' + (process.env.OUT || 'PLATE3D_COLNODE.xlsx');

/* ---------- the H catalogue ---------- */
function csv(file) {
  const ln = fs.readFileSync(DESIGN + '/' + file, 'utf8')
    .replace(/^﻿/, '').split(/\r?\n/).filter(s => s.trim());
  const head = ln[0].split(',').map(s => s.trim());
  return ln.slice(1).map(l => { const f = l.split(','), o = {};
    head.forEach((h, i) => { o[h] = (f[i] || '').trim(); }); return o; });
}
const HS = csv('hsection.csv').filter(r => r['KS규격여부'] === 'O')
  .map(r => ({ key: `H-${r.H}x${r.B}x${r.t1}x${r.t2} r${r.r}`,
               h: +r.H, b: +r.B, tw: +r.t1, tf: +r.t2, r: +r.r, kg: +r['단위무게'] }));
const pick = k => HS.find(s => s.key === k) || HS[0];
const COL = pick(process.env.COLSEC || 'H-300x300x10x15 r18');
const BM  = pick(process.env.BMSEC  || 'H-300x150x6.5x9 r13');

/* ---------- what the sheet opens with ---------- */
const V = {
  type: process.env.CTYPE || 'H',          // H or R
  rh: 300, rb: 300, rt: 12, rr: 24,        // the tube, when Type is R
  mid: 1400, up: 700, dn: 700,             // column pieces; 0 = no splice there
  steel: 'SS275',
  bmLen: 900,
  /* one of each on both kinds of face, so the model shows all four cases:
     a plate onto a flange, a fin onto a flange, a fin onto the web, a plate
     onto the web */
  fXP: 'end plate', fXN: 'fin plate', fYP: 'fin plate', fYN: 'end plate',
  epB: 180, epT: 12, epG: 90,              // end plate: width, thickness, gauge
  finB: 140, finT: 10, finG: 60,           // fin plate: reach, thickness, gauge
  spT: 20, spOV: 60,                       // splice plate thickness and overhang
  edge: 45,                                // bolt to the edge of a connector
  grade: 'F10T', dia: 16, pitch: 70, n: 3
};

/* ---------- everything that follows from it ---------- */
const D = {};
D.hole = V.dia + 2;
D.nut = 0.9 * V.dia;
// the column, whichever kind it is
D.cH  = V.type === 'H' ? COL.h  : V.rh;    // across X, because of the ROT.Z 90
D.cB  = V.type === 'H' ? COL.b  : V.rb;    // across Y
D.cW  = V.type === 'H' ? COL.tw : V.rt;    // web, or the tube wall
D.cF  = V.type === 'H' ? COL.tf : V.rt;    // flange, or the tube wall again
// the face a beam meets, measured from the column axis
D.faceX = D.cH / 2;                                       // the flange, or a wall
D.faceY = V.type === 'H' ? D.cW / 2 : D.cB / 2;           // the web, or a wall
// what a bolt has to pass through
D.thruX = D.cF;                            // flange, or wall
D.thruY = V.type === 'H' ? D.cW : D.cW;    // web, or wall - the same number
// connectors, sized by their own bolts
D.conH = V.pitch * (V.n - 1) + 2 * V.edge; // end plate and fin plate height
D.spB  = D.cH + 2 * V.spOV;                // splice plate, across X
D.spH  = D.cB + 2 * V.spOV;                // across Y
D.spG  = [D.cH / 2 + V.spOV / 2, D.cB / 2 + V.spOV / 2];   // its four bolts
// grips
D.gripEP = D.thruX + V.epT;                // end plate on a flange face
D.gripEPy = D.thruY + V.epT;               // end plate on a web face
D.gripFin = V.finT + BM.tw;                // fin plate, either face
D.gripSp = 2 * V.spT;                      // two splice plates back to back
D.needC = Math.max(D.gripEP, D.gripEPy, D.gripFin) + D.nut + 0.2 * V.dia;
D.needS = D.gripSp + D.nut + 0.2 * V.dia;
const up5 = x => Math.ceil(x / 5) * 5;
D.blC = up5(D.needC);
D.blS = up5(D.needS);
// where the column pieces sit along Z, the beam centreline being 0
D.midTop = V.mid / 2;
D.upZ = D.midTop + 2 * V.spT;              // where the upper piece starts
D.dnZ = -D.midTop - 2 * V.spT;             // where the lower piece ends
D.z0 = -V.pitch * (V.n - 1) / 2;           // the first bolt of a chain
const rnd = x => +(+x).toFixed(4);

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

const ps = wb.addWorksheet('PARAM');
const is = wb.addWorksheet('input');

/* ================= PARAM ================= */
const P = 'PARAM';
const R = { title: 1, sub: 2,
            cHead: 4,  cCols: 5,  cH: 6,  cR: 7,  cTyp: 8, cLen: 9, cNote: 10, cChk: 11,
            bHead: 13, bCols: 14, bm: 15, fCols: 16, face: 17, bNote: 18, bChk: 19,
            kHead: 21, kCols: 22, ep: 23, fin: 24, sp: 25, kNote: 26, kChk: 27,
            tHead: 29, tCols: 30, blt: 31, lCols: 32, len: 33, tNote: 34, tChk: 35 };
const c = (col, row) => `${P}!$${col}$${row}`;
const K = {
  hSec: c('C', R.cH), hH: c('D', R.cH), hB: c('E', R.cH), hW: c('F', R.cH),
  hF: c('G', R.cH), hR: c('H', R.cH), hKg: c('I', R.cH),
  rH: c('D', R.cR), rB: c('E', R.cR), rT: c('F', R.cR), rR: c('G', R.cR),
  typ: c('C', R.cTyp),
  mid: c('C', R.cLen), up: c('D', R.cLen), dn: c('E', R.cLen),
  steel: c('G', R.cLen),
  bSec: c('C', R.bm), bH: c('D', R.bm), bB: c('E', R.bm), bW: c('F', R.bm),
  bF: c('G', R.bm), bR: c('H', R.bm), bKg: c('I', R.bm), bLen: c('J', R.bm),
  fXP: c('C', R.face), fXN: c('E', R.face), fYP: c('G', R.face), fYN: c('I', R.face),
  epB: c('C', R.ep), epH: c('D', R.ep), epT: c('E', R.ep), epG: c('F', R.ep),
  finB: c('C', R.fin), finH: c('D', R.fin), finT: c('E', R.fin), finG: c('F', R.fin),
  spB: c('C', R.sp), spH: c('D', R.sp), spT: c('E', R.sp), spOV: c('F', R.sp),
  edge: c('G', R.ep),
  grade: c('C', R.blt), dia: c('D', R.blt), hole: c('E', R.blt),
  pitch: c('F', R.blt), n: c('G', R.blt),
  gEP: c('C', R.len), gFin: c('D', R.len), gSp: c('E', R.len), nut: c('F', R.len),
  blC: c('G', R.len), blS: c('H', R.len)
};
// the two numbers every arm is hung on
const FACEX = `${K.typ}="H",${K.hH}/2,${K.rH}/2`;          // used inside IF(...)
const faceX = `IF(${FACEX})`;
const faceY = `IF(${K.typ}="H",${K.hW}/2,${K.rB}/2)`;
const thruX = `IF(${K.typ}="H",${K.hF},${K.rT})`;
const thruY = `IF(${K.typ}="H",${K.hW},${K.rT})`;
const cHf   = `IF(${K.typ}="H",${K.hH},${K.rH})`;
const cBf   = `IF(${K.typ}="H",${K.hB},${K.rB})`;

ps.columns = [{ width: 3 }, { width: 22 }, { width: 24 }, { width: 11 }, { width: 11 },
              { width: 11 }, { width: 11 }, { width: 11 }, { width: 11 }, { width: 11 },
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

sty(ps.getCell(R.title, 2), { bold: true, size: 18, color: INK }).value = 'COLUMN NODE';
sty(ps.getCell(R.sub, 2), { size: 10, color: MUTE }).value =
  'One column, four beams, and up to two splices. Fill in the blue cells — the input tab is written from this one.';
ps.getRow(R.title).height = 26;

/* ---- 1. column ---- */
head(R.cHead, 1, 'COLUMN', 'an H or a square tube - fill in the row that matches Type, the other is ignored');
cols(R.cCols, ['', 'Section', 'h', 'b', 'tw / t', 'tf', 'r', 'kg/m']);
label(R.cH, 'H section');
inp(R.cH, 3, COL.key);
[[2, COL.h], [3, COL.b], [4, COL.tw], [5, COL.tf], [6, COL.r], [7, COL.kg]]
  .forEach(([n, val], i) => calc(R.cH, 4 + i,
    `IFERROR(VLOOKUP($C$${R.cH},SECT!$A:$G,${n},FALSE),"")`, val, n === 7 ? '0.0' : '0.##'));
label(R.cR, 'Square tube');
[V.rh, V.rb, V.rt, V.rr].forEach((v, i) => inp(R.cR, 4 + i, v));
sty(ps.getCell(R.cR, 8), { size: 9, italic: true, color: MUTE }).value = 'r blank = square corner';
label(R.cTyp, 'Type');
inp(R.cTyp, 3, V.type);
ps.getCell(R.cTyp, 3).dataValidation = { type: 'list', allowBlank: false,
  formulae: ['"H,R"'], showErrorMessage: true, error: 'H or R.' };
label(R.cLen, 'Lengths');
/* the column-piece headings sit on the Type row, which is otherwise empty to
   the right of its one cell */
[['middle', V.mid], ['upper', V.up], ['lower', V.dn]].forEach(([t, v], i) => {
  sty(ps.getCell(R.cLen - 1, 3 + i), { bold: true, size: 9, color: MUTE, h: 'center' }).value = t;
  inp(R.cLen, 3 + i, v);
});
sty(ps.getCell(R.cLen - 1, 7), { bold: true, size: 9, color: MUTE, h: 'center' }).value = 'Steel';
inp(R.cLen, 7, V.steel);
note(R.cNote, 'Upper and lower are the column above and below the splice. Type 0 and it is gone — piece, plates and bolts. The engine then says that module is empty, which is the switch working.');
checked(R.cChk, [
  ['face X', faceX, D.faceX],
  ['face Y', faceY, D.faceY],
  ['splices', `(IF(${K.up}>0,1,0)+IF(${K.dn}>0,1,0))&" of 2"`,
    ((V.up > 0 ? 1 : 0) + (V.dn > 0 ? 1 : 0)) + ' of 2']
]);

/* ---- 2. beams ---- */
head(R.bHead, 2, 'BEAMS', 'one section, four faces - each face takes an end plate, a fin plate, or nothing');
cols(R.bCols, ['', 'Section', 'h', 'b', 'tw', 'tf', 'r', 'kg/m', 'Length']);
label(R.bm, 'Beam');
inp(R.bm, 3, BM.key);
[[2, BM.h], [3, BM.b], [4, BM.tw], [5, BM.tf], [6, BM.r], [7, BM.kg]]
  .forEach(([n, val], i) => calc(R.bm, 4 + i,
    `IFERROR(VLOOKUP($C$${R.bm},SECT!$A:$G,${n},FALSE),"")`, val, n === 7 ? '0.0' : '0.##'));
inp(R.bm, 10, V.bmLen);
['+X  flange face', '-X  flange face', '+Y  web face', '-Y  web face']
  .forEach((t, i) => sty(ps.getCell(R.fCols, 3 + i * 2),
    { bold: true, size: 9, color: MUTE, h: 'center' }).value = t);
label(R.face, 'Connection');
[V.fXP, V.fXN, V.fYP, V.fYN].forEach((v, i) => {
  const cell = inp(R.face, 3 + i * 2, v);
  ps.mergeCells(R.face, 3 + i * 2, R.face, 4 + i * 2);
  cell.dataValidation = { type: 'list', allowBlank: false,
    formulae: ['"end plate,fin plate,none"'], showErrorMessage: true,
    error: 'end plate, fin plate or none.' };
});
note(R.bNote, 'On an H column the X faces are the flanges and the Y faces are the web, so a Y beam sits between the flanges. A tube has four alike walls.');
checked(R.bChk, [
  ['between flanges', `IF(${K.typ}<>"H","n/a - tube",IF(${K.bB}<=${K.hH}-2*${K.hF},${K.bB}&" ≤ "&(${K.hH}-2*${K.hF}),"beam too wide"))`,
    BM.b + ' ≤ ' + (COL.h - 2 * COL.tf)],
  ['connectors', `COUNTIF(${K.fXP}&${K.fXN}&${K.fYP}&${K.fYN},"*")&" faces set"`, '4 faces set'],
  ['end plate on a tube', `IF(AND(${K.typ}="R",OR(${K.fXP}="end plate",${K.fXN}="end plate",${K.fYP}="end plate",${K.fYN}="end plate")),"needs blind bolts","-")`,
    '-']
]);

/* ---- 3. connectors ---- */
head(R.kHead, 3, 'CONNECTORS', 'height follows the bolts, so a plate can never be shorter than the chain it carries');
cols(R.kCols, ['', 'width / reach', 'height', 'thickness', 'gauge', 'overhang', 'edge']);
label(R.ep, 'End plate');
inp(R.ep, 3, V.epB);
calc(R.ep, 4, `${K.pitch}*(${K.n}-1)+2*${K.edge}`, D.conH, '0.##');
inp(R.ep, 5, V.epT);
inp(R.ep, 6, V.epG);
inp(R.ep, 8, V.edge);
label(R.fin, 'Fin plate');
inp(R.fin, 3, V.finB);
calc(R.fin, 4, `${K.pitch}*(${K.n}-1)+2*${K.edge}`, D.conH, '0.##');
inp(R.fin, 5, V.finT);
inp(R.fin, 6, V.finG);
label(R.sp, 'Splice plate');
calc(R.sp, 3, `${cHf}+2*${K.spOV}`, D.spB, '0.##');
calc(R.sp, 4, `${cBf}+2*${K.spOV}`, D.spH, '0.##');
inp(R.sp, 5, V.spT);
inp(R.sp, 6, V.spOV);
note(R.kNote, 'End plate gauge is across the beam web; fin plate gauge is out from the column face. The splice plate is the column plus an overhang all round.');
checked(R.kChk, [
  ['ep clears web', `IF(${K.epG}/2>=${K.bW}/2+1.5*${K.dia},"ok","gauge too tight")`,
    V.epG / 2 >= BM.tw / 2 + 1.5 * V.dia ? 'ok' : 'gauge too tight'],
  ['ep width', `IF(${K.epB}>=${K.epG}+3*${K.dia},${K.epB}&" ≥ "&(${K.epG}+3*${K.dia}),"too narrow")`,
    V.epB + ' ≥ ' + (V.epG + 3 * V.dia)],
  ['fin reach', `IF(${K.finB}>=${K.finG}+1.5*${K.dia},${K.finB}&" ≥ "&(${K.finG}+1.5*${K.dia}),"too short")`,
    V.finB + ' ≥ ' + (V.finG + 1.5 * V.dia)],
  ['edge', `IF(${K.edge}>=1.5*${K.dia},${K.edge}&" ≥ "&(1.5*${K.dia}),"under 1.5d")`,
    V.edge + ' ≥ ' + 1.5 * V.dia]
]);

/* ---- 4. bolts ---- */
head(R.tHead, 4, 'BOLTS', 'one size throughout; two lengths, because a splice grips two plates and a connection grips one');
cols(R.tCols, ['', 'Grade', 'Dia', 'Hole', 'Pitch', 'Count']);
label(R.blt, 'Bolt');
inp(R.blt, 3, V.grade);
inp(R.blt, 4, V.dia);
calc(R.blt, 5, `${K.dia}+2`, D.hole, '0.##');
inp(R.blt, 6, V.pitch);
inp(R.blt, 7, V.n);
cols(R.lCols, ['', 'grip end plate', 'grip fin', 'grip splice', 'nut',
               'LENGTH conn', 'LENGTH splice']);
label(R.len, 'Lengths');
calc(R.len, 3, `${thruX}+${K.epT}`, D.gripEP, '0.##');
calc(R.len, 4, `${K.finT}+${K.bW}`, D.gripFin, '0.##');
calc(R.len, 5, `2*${K.spT}`, D.gripSp, '0.##');
calc(R.len, 6, `0.9*${K.dia}`, D.nut, '0.##');
calc(R.len, 7, `CEILING(MAX(${K.gEP},${K.gFin},${thruY}+${K.epT})+${K.nut}+0.2*${K.dia},5)`,
     D.blC, '0.##', { color: INK, bold: true });
calc(R.len, 8, `CEILING(${K.gSp}+${K.nut}+0.2*${K.dia},5)`, D.blS, '0.##',
     { color: INK, bold: true });
note(R.tNote, 'proj — the thread past the nut — takes up what each grip leaves, so every connection bolt is one take-off line and every splice bolt another.');
checked(R.tChk, [
  ['pitch', `IF(${K.pitch}>=2.5*${K.dia},${K.pitch}&" ≥ "&(2.5*${K.dia}),"under 2.5d")`,
    V.pitch + ' ≥ ' + 2.5 * V.dia],
  ['conn bolt', `${K.blC}&" for "&ROUND(MAX(${K.gEP},${K.gFin}),1)`,
    D.blC + ' for ' + rnd(Math.max(D.gripEP, D.gripFin))],
  ['splice bolt', `${K.blS}&" for "&${K.gSp}`, D.blS + ' for ' + D.gripSp]
]);

/* ================= SECT ================= */
const ss = wb.addWorksheet('SECT');
ss.columns = [{ width: 26 }].concat([1, 2, 3, 4, 5, 6].map(() => ({ width: 9 })));
['Section', 'h', 'b', 'tw', 'tf', 'r', 'kg/m'].forEach((t, i) =>
  sty(ss.getCell(1, i + 1), { bold: true, color: 'FFFFFFFF', fill: HEADFILL,
                              h: i ? 'center' : 'left', border: true }).value = t);
HS.forEach((s, j) => [s.key, s.h, s.b, s.tw, s.tf, s.r, s.kg].forEach((x, i) =>
  sty(ss.getCell(j + 2, i + 1), { h: i ? 'center' : 'left', border: true,
                                  fill: j % 2 ? BANDFILL : undefined }).value = x));
ss.views = [{ state: 'frozen', ySplit: 1 }];
const SECTREF = `SECT!$A$2:$A$${HS.length + 1}`;
[R.cH, R.bm].forEach(row => { ps.getCell(row, 3).dataValidation = {
  type: 'list', allowBlank: false, formulae: [SECTREF], showErrorMessage: true,
  error: 'Pick one from the SECT tab.' }; });

/* ================= input ================= */
is.columns = [{ width: 46 }, { width: 11 }, { width: 12 }, { width: 11 }, { width: 10 }]
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
note2('There is no CUT row in this file. BOLT drills what its shank passes through, plates included, so a hole is never drawn twice.');
row(['COORD', 'ZUP']);

/* --- the column, in three pieces --- */
const pieceLen = { mid: `${K.mid}`, up: `MAX(1,${K.up})`, dn: `MAX(1,${K.dn})` };
const pieceVal = { mid: V.mid, up: Math.max(1, V.up), dn: Math.max(1, V.dn) };
note2('');
note2('SECT  id  material  length  TYPE  base.pt  v1..v7        an H wants seven values, a tube wants four - the last three go blank by formula');
['mid', 'up', 'dn'].forEach((k, i) => {
  row(['SECT', 'sc.c' + (i + 1), f(K.steel, V.steel), f(pieceLen[k], pieceVal[k]),
       f(`IF(${K.typ}="H","H","R")`, V.type === 'H' ? 'H' : 'R'), 'mc',
       f(cHf, D.cH), f(cBf, D.cB), f(`IF(${K.typ}="H",${K.hB},${K.rT})`,
         V.type === 'H' ? COL.b : V.rt),
       f(`IF(${K.typ}="H",${K.hW},${K.rR})`, V.type === 'H' ? COL.tw : V.rr),
       f(`IF(${K.typ}="H",${K.hF},"")`, V.type === 'H' ? COL.tf : ''),
       f(`IF(${K.typ}="H",${K.hF},"")`, V.type === 'H' ? COL.tf : ''),
       f(`IF(${K.typ}="H",${K.hR},"")`, V.type === 'H' ? COL.r : '')],
      k === 'mid' ? 'the column: middle, upper, lower. MAX(1,..) keeps a definition alive even when its piece is switched off above' : '');
});
row(['SECT', 'sc.bm', f(K.steel, V.steel), f(K.bLen, V.bmLen), 'H', 'mc',
     f(K.bH, BM.h), f(K.bB, BM.b), f(K.bB, BM.b), f(K.bW, BM.tw),
     f(K.bF, BM.tf), f(K.bF, BM.tf), f(K.bR, BM.r)], 'the beam, one section for all four arms');

/* --- the plates --- */
note2('');
note2('PLATE  id  material  thickness  RECT  base.pt  B  H');
row(['PLATE', 'pl.ep', f(K.steel, V.steel), f(K.epT, V.epT), 'RECT', 'mc',
     f(K.epB, V.epB), f(K.epH, D.conH)], 'end plate - welded to the beam, bolted to the column');
row(['PLATE', 'pl.fin', f(K.steel, V.steel), f(K.finT, V.finT), 'RECT', 'mc',
     f(K.finB, V.finB), f(K.finH, D.conH)], 'fin plate - welded to the column, bolted through the beam web');
row(['PLATE', 'pl.sp', f(K.steel, V.steel), f(K.spT, V.spT), 'RECT', 'mc',
     f(K.spB, D.spB), f(K.spH, D.spH)], 'splice plate - the column plus an overhang all round');

/* --- the bolts --- */
note2('');
note2('BOLT  id  material  dia  length  hole  [head_af]  [head_h]  [nut_af]  nut_h  proj');
row(['BOLT', 'bo.ep', f(K.grade, V.grade), f(K.dia, V.dia), f(K.blC, D.blC),
     f(K.hole, D.hole), '', '', '', f(K.nut, D.nut),
     f(`${K.blC}-${K.gEP}-${K.nut}`, rnd(D.blC - D.gripEP - D.nut))], 'end plate bolt');
row(['BOLT', 'bo.fin', f(K.grade, V.grade), f(K.dia, V.dia), f(K.blC, D.blC),
     f(K.hole, D.hole), '', '', '', f(K.nut, D.nut),
     f(`${K.blC}-${K.gFin}-${K.nut}`, rnd(D.blC - D.gripFin - D.nut))], 'fin plate bolt - same length, more thread showing');
row(['BOLT', 'bo.sp', f(K.grade, V.grade), f(K.dia, V.dia), f(K.blS, D.blS),
     f(K.hole, D.hole), '', '', '', f(K.nut, D.nut),
     f(`${K.blS}-${K.gSp}-${K.nut}`, rnd(D.blS - D.gripSp - D.nut))], 'splice bolt');

/* --- the column modules --- */
note2('');
note2('MODULE  id  member  Ref.Pt  L.X  L.Y  L.Z  PLANE  [ROT.X ROT.Y ROT.Z]  [dx dy dz repeat]');
note2('ROT.Z 90 turns the column so its h runs along X. A square column cannot show that in a bounding box, so it is written down rather than looked for.');
['mid', 'up', 'dn'].forEach((k, i) => {
  const on = k === 'mid' ? '"sc.c1"' :
    `IF(${k === 'up' ? K.up : K.dn}>0,"sc.c${i + 1}","")`;
  const onV = k === 'mid' ? 'sc.c1' : ((k === 'up' ? V.up : V.dn) > 0 ? 'sc.c' + (i + 1) : '');
  row(['MODULE', 'md.c' + (i + 1), f(on, onV), '', 0, 0, 0, 'XY', 0, 0, 90],
      k === 'mid' ? 'a blank member is simply not there - which is how a length of 0 removes a piece' : '');
  row(['MODULE', 'md.c' + (i + 1), 'BASE', 'sc.c' + (i + 1), 'mc']);
});

/* --- the four arms --- */
/* Each arm is one module holding an end plate, a fin plate, a beam and a bolt
   chain. PARAM turns two of the four members off, and every coordinate that
   differs between the two details is an IF on the same cell. */
const FACES = [
  { id: 'ax', k: K.fXP, v: V.fXP, sign: 1,  plane: 'YZ', rot: 0,   axis: 'X' },
  { id: 'bx', k: K.fXN, v: V.fXN, sign: -1, plane: 'YZ', rot: 180, axis: 'X' },
  { id: 'ay', k: K.fYP, v: V.fYP, sign: 1,  plane: 'XZ', rot: 180, axis: 'Y' },
  { id: 'by', k: K.fYN, v: V.fYN, sign: -1, plane: 'XZ', rot: 0,   axis: 'Y' }
];
FACES.forEach(F => {
  const isX = F.axis === 'X';
  const sg = F.sign;
  const face  = isX ? faceX : faceY,  faceV = isX ? D.faceX : D.faceY;
  const thru  = isX ? thruX : thruY,  thruV = isX ? D.thruX : D.thruY;
  const ep = `${F.k}="end plate"`, fin = `${F.k}="fin plate"`;
  const isEP = F.v === 'end plate', isFin = F.v === 'fin plate';
  const finPlane = F.plane === 'YZ' ? 'XZ' : 'YZ';
  /* The arm's origin is the START FACE OF THE BEAM, because that is the point
     BASE holds. Everything else is written as a distance OUTWARD from there,
     and `out` turns that into the module coordinate for whichever of the four
     faces this is: the -X and -Y arms measure the same distances the other
     way, and ROT.Z 180 turns the members themselves round to match. */
  const out = (formula, value) => [
    sg > 0 ? formula : `-(${formula})`, sg * value];
  const XY = (o, a) => isX ? [o, a] : [a, o];       // out / across -> L.X, L.Y
  const pair = (o, a) => { const p = XY(o, a);
    return [f(p[0][0], p[0][1]), f(p[1][0], p[1][1])]; };
  const flat = v => [`${v}`, v];                    // a number, either way round
  note2('');
  note2('arm ' + F.id + '  -  the ' + (sg > 0 ? '+' : '-') + F.axis +
        ' face, "' + F.v + '" on PARAM. Both details are written out and PARAM keeps one.');
  // end plate - sits between the column face and the beam, so half a thickness back
  row(['MODULE', 'md.' + F.id, f(`IF(${ep},"pl.ep","")`, isEP ? 'pl.ep' : ''), 'mc']
      .concat(pair(out(`-${K.epT}/2`, -V.epT / 2), flat(0)))
      .concat([0, F.plane, 0, 0, F.rot]),
      'end plate - welded to the beam end, bearing on the column');
  // fin plate - reaches out from the face, standing beside the web
  row(['MODULE', 'md.' + F.id, f(`IF(${fin},"pl.fin","")`, isFin ? 'pl.fin' : ''), 'mc']
      .concat(pair(out(`${K.finB}/2`, V.finB / 2),
                   flat(rnd(BM.tw / 2 + V.finT / 2))))
      .concat([0, finPlane, 0, 0, F.rot]),
      'fin plate - welded to the column, standing beside the beam web');
  // the beam - the module origin, which is why BASE can hold it
  row(['MODULE', 'md.' + F.id,
       f(`IF(${F.k}="none","","sc.bm")`, F.v === 'none' ? '' : 'sc.bm'), '',
       0, 0, 0, F.plane, 0, 0, F.rot],
      'the beam, at the module origin - "none" takes it away with everything else');
  // the bolts. An end plate bolt runs along the beam and comes in a grid two
  // wide; a fin plate bolt runs across it and comes in a single line.
  row(['MODULE', 'md.' + F.id,
       f(`IF(${ep},"bo.ep",IF(${fin},"bo.fin",""))`, isEP ? 'bo.ep' : isFin ? 'bo.fin' : ''), '']
      .concat(pair(out(`IF(${ep},-(${thru}+${K.epT}),${K.finG})`,
                       isEP ? -(thruV + V.epT) : V.finG),
                   [`IF(${ep},${K.epG}/2,${K.bW}/2+${K.finT})`,
                    isEP ? V.epG / 2 : rnd(BM.tw / 2 + V.finT)]))
      .concat([f(`-${K.pitch}*(${K.n}-1)/2`, D.z0),
               f(`IF(${ep},"${F.plane}","${finPlane}")`, isEP ? F.plane : finPlane),
               0, 0, F.rot])
      // first axis: across the web, and only an end plate has two lines of it
      .concat(pair([`IF(${ep},0,0)`, 0], [`IF(${ep},-${K.epG},0)`, isEP ? -V.epG : 0]))
      .concat([0, f(`IF(${ep},1,0)`, isEP ? 1 : 0)])
      // second axis: down the chain, which both details have
      .concat([0, 0, f(K.pitch, V.pitch), f(`${K.n}-1`, V.n - 1)]),
      'an end plate bolt runs along the beam, a fin plate bolt across it');
  row(['MODULE', 'md.' + F.id, 'BASE', 'sc.bm', 'mc']);
});

/* --- the splices --- */
note2('');
note2('a splice: two plates back to back and four bolts. Both are switched by the length of the column piece they join.');
[['u', K.up, V.up, 1], ['d', K.dn, V.dn, -1]].forEach(([s, klen, vlen, sg]) => {
  const on = `IF(${klen}>0,"pl.sp","")`, onV = vlen > 0 ? 'pl.sp' : '';
  const onb = `IF(${klen}>0,"bo.sp","")`, onbV = vlen > 0 ? 'bo.sp' : '';
  /* mc in the Ref.Pt column, and not just on the PLATE row: a blank Ref.Pt
     hangs the plate on its corner, and BASE then drags the whole module half
     a plate sideways to put it back - which is what moved the bolts. */
  row(['MODULE', 'md.sp' + s, f(on, onV), 'mc', 0, 0, 0, 'XY'],
      s === 'u' ? 'two plates back to back, the joint between them' : '');
  row(['MODULE', 'md.sp' + s, f(on, onV), 'mc', 0, 0, f(K.spT, V.spT), 'XY']);
  row(['MODULE', 'md.sp' + s, f(onb, onbV), '',
       f(`-(${cHf}/2+${K.spOV}/2)`, -D.spG[0]), f(`-(${cBf}/2+${K.spOV}/2)`, -D.spG[1]),
       f(`-${K.spT}/2`, -V.spT / 2), 'XY',
       0, 0, 0,
       f(`${cHf}+${K.spOV}`, D.spG[0] * 2), 0, 0, 1,
       0, f(`${cBf}+${K.spOV}`, D.spG[1] * 2), 0, 1],
      s === 'u' ? 'four bolts, one at each corner, clear of the column' : '');
  row(['MODULE', 'md.sp' + s, 'BASE', 'pl.sp_1', 'mc']);
});

/* --- assembly --- */
note2('');
note2('ASSY  id  ref  cmd  p1 p2 p3 p4');
row(['ASSY', 'as.n', 'md.c1', 'ADD', 0, 0, f(`-${K.mid}/2`, -V.mid / 2)], 'the middle piece, centred on the beams');
row(['ASSY', 'as.n', 'md.c2', 'ADD', 0, 0,
     f(`${K.mid}/2+2*${K.spT}`, D.upZ)], 'the upper piece, clear of its two splice plates');
row(['ASSY', 'as.n', 'md.c3', 'ADD', 0, 0,
     f(`-(${K.mid}/2+2*${K.spT}+MAX(1,${K.dn}))`, -(D.midTop + 2 * V.spT + Math.max(1, V.dn)))],
    'the lower piece');
row(['ASSY', 'as.n', 'md.spu', 'ADD', 0, 0,
     f(`${K.mid}/2+${K.spT}/2`, D.midTop + V.spT / 2)],
    'the splice plates land between the two pieces of column, not over them');
row(['ASSY', 'as.n', 'md.spd', 'ADD', 0, 0,
     f(`-(${K.mid}/2+1.5*${K.spT})`, -(D.midTop + 1.5 * V.spT))]);
FACES.forEach(F => {
  const isX = F.axis === 'X';
  const face = isX ? faceX : faceY, faceV = isX ? D.faceX : D.faceY;
  const isEP = F.v === 'end plate';
  const at = `${face}+IF(${F.k}="end plate",${K.epT},0)`;
  const atV = faceV + (isEP ? V.epT : 0);
  const cell = f(F.sign > 0 ? at : `-(${at})`, F.sign * atV);
  row(['ASSY', 'as.n', 'md.' + F.id, 'ADD', isX ? cell : 0, isX ? 0 : cell, 0],
      F.id === 'ax' ? 'the beam start: on the column face, or an end plate further out' : '');
});
note2('');
row(['END']);

wb.xlsx.writeFile(OUT).then(() => {
  console.log('written ' + OUT.split('/').pop());
  console.log('  SECT  ' + HS.length + ' sections   input ' + ir + ' rows');
  console.log('  column ' + (V.type === 'H' ? COL.key : `R-${V.rh}x${V.rb}x${V.rt} r${V.rr}`) +
              '   pieces ' + V.mid + ' / ' + V.up + ' / ' + V.dn);
  console.log('  faces  +X ' + V.fXP + '  -X ' + V.fXN + '  +Y ' + V.fYP + '  -Y ' + V.fYN);
  console.log('  face X ' + D.faceX + '   face Y ' + D.faceY);
  console.log('  grips  ep ' + D.gripEP + '  fin ' + D.gripFin + '  splice ' + D.gripSp);
  console.log('  bolts  connection ' + D.blC + '   splice ' + D.blS);
});
