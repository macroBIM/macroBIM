/* PLATE3D_SPLICE.xlsx — the macroBIM Splice tool as a PLATE3D workbook.
     PARAM   what a person edits: two members, five plates, three bolt groups
     SECT    the H list the dropdown reads, straight out of design/hsection.csv
     input   PLATE3D rows, every value a formula on PARAM
   Every formula carries its cached result, so the file loads as it stands
   without Excel having to recalculate first. */
const ExcelJS = require('exceljs'), fs = require('fs');

/* ---------- the section list ---------- */
const raw = fs.readFileSync('/home/user/design/hsection.csv', 'utf8');
const csvRows = (function () {
  const ln = raw.replace(/^﻿/, '').split(/\r?\n/).filter(s => s.trim());
  const head = ln[0].split(',');
  return ln.slice(1).map(l => { const f = l.split(','), o = {};
    head.forEach((h, i) => { o[h.trim()] = (f[i] || '').trim(); }); return o; });
})();
const HS = csvRows.filter(r => r['KS규격여부'] === 'O')
  .map(r => ({ key: `H-${r.H}x${r.B}x${r.t1}x${r.t2} r${r.r}`,
               H: +r.H, B: +r.B, t1: +r.t1, t2: +r.t2, r: +r.r, w: +r['단위무게'] }));
const DEF = HS.find(s => s.key === 'H-300x300x10x15 r18') || HS[0];

/* ---------- PARAM, by row ---------- */
const P = 'PARAM';
/* A splice joins a section to itself, so there is one member row, not two.
   There used to be a Left and a Right; nothing on the input tab ever read the
   Right one, so a section typed into it was quietly ignored. One row is what
   the sheet was always doing. */
const R = { title:1, sub:2,
            mHead:4,  mCols:5,  mem:6, gap:7, mNote:8,
            mChk:10,
            pHead:12, pCols:13, tp:14, ti:15, wp:16, bi:17, bp:18,
            pChk:20,
            bHead:22, bCols:23, bVal:24,
            gCols:26, gTop:27, gWeb:28, gBot:29,
            bChk:31,
            dHead:34 };
const c = (col, row) => `${P}!$${col}$${row}`;

/* the numbers the sheet opens with */
const V = {
  H: DEF.H, B: DEF.B, tw: DEF.t1, tf: DEF.t2, r: DEF.r, kg: DEF.w,
  L: 900, gap: 20,
  tpW: 280, tpL: 300, tpT: 12,
  tiW: 110, tiL: 300, tiT: 10,
  wpW: 220, wpL: 280, wpT: 10,
  dia: 22, hole: 24,
  // Long N, In, Out | Trans N, In, Out.  The web's Trans In is 0 - its bolts
  // run right through the depth with no gap at the neutral axis, exactly as
  // bim_boltsplice.js lays them out, which is why it needs two rows and not four.
  tNL: +(process.env.TNL||4), tIL: 70, tOL: 40, tNT: +(process.env.TNT||4), tIT: 100, tOT: 35,
  wNL: +(process.env.WNL||4), wIL: 60, wOL: 40, wNT: +(process.env.WNT||3), wIT: 0,   wOT: 40
};
/* pitches. Flange and web count differently: a flange group is halved about the
   joint gap in both directions, the web only along the beam. */
const pHalf = (W, N, I, O) => (N / 2 <= 1 ? 0 : (W / 2 - O - I / 2) / (N / 2 - 1));
const pFull = (W, N, I, O) => (N <= 1 ? 0 : (W - 2 * O - I) / (N - 1));
const D = {
  pTL: pHalf(V.tpL, V.tNL, V.tIL, V.tOL),        // 75
  pTT: pHalf(V.tpW, V.tNT, V.tIT, V.tOT),        // 55
  pWL: pHalf(V.wpL, V.wNL, V.wIL, V.wOL),        // 70
  pWT: pFull(V.wpW, V.wNT, V.wIT, V.wOT),        // 70
  webD: V.H - 2 * V.tf,                          // 270
  off:  V.gap / 2 + V.L / 2                      // 460
};
/* where things sit, in millimetres about the joint centre */
const Z = {
  fl:  V.H / 2 - V.tf / 2,                       // 142.5  flange plate centre
  tpZ: V.H / 2 + V.tpT / 2,                      // 156    outer plate centre
  tiZ: V.H / 2 - V.tf - V.tiT / 2,               // 130    inner plate centre
  wpY: V.tw / 2 + V.wpT / 2                      // 10     web plate centre
};
/* the inner plate is centred on its own two bolt lines, so one part serves both
   sides of the web - two of the same plate, not a left hand and a right hand */
const tiY = V.tIT / 2 + D.pTT / 2;               // 77.5
const tiV = D.pTT / 2;                           // 27.5  bolt offset in the plate
/* bolt lines, from the joint */
const AX = {
  fL: [V.tIL / 2, V.tIL / 2 + D.pTL],            // 35, 110
  fT: [V.tIT / 2, V.tIT / 2 + D.pTT],            // 50, 105
  wL: [V.wIL / 2, V.wIL / 2 + D.pWL],            // 30, 100
  wT: (function () { const o = [], n = V.wNT;    // -70, 0, 70
    for (let i = 0; i < n; i++) o.push(-(V.wpW / 2 - V.wOT) + i * D.pWT); return o; })()
};
/* bolt lengths: the grip plus 30 for head, nut and washers */
const gripF = (V.H / 2 + V.tpT) - (V.H / 2 - V.tf - V.tiT);   // 37
const gripW = V.tw + 2 * V.wpT;                                // 30
const boltF = gripF + 30, boltW = gripW + 30;                  // 67, 60
const nBolt = V.tNL * V.tNT * 2 + V.wNL * V.wNT;               // 44

/* ---------- style helpers ---------- */
const FONT = 'Arial';
const wb = new ExcelJS.Workbook();
wb.creator = 'PLATE3D';
function sty(cell, o) {
  o = o || {};
  cell.font = { name: FONT, size: o.size || 10, bold: !!o.bold,
                color: o.color ? { argb: o.color } : undefined,
                italic: !!o.italic };
  cell.alignment = { horizontal: o.h || 'left', vertical: 'middle',
                     wrapText: !!o.wrap };
  if (o.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: o.fill } };
  if (o.border) {
    const s = { style: 'thin', color: { argb: 'FFCBD5E1' } };
    cell.border = { top: s, left: s, bottom: s, right: s };
  }
  if (o.fmt) cell.numFmt = o.fmt;
  return cell;
}
const INK = 'FF0F172A', MUTE = 'FF64748B', BLUE = 'FF1D4ED8', WARN = 'FFB45309';
const HEADFILL = 'FF0F172A', BANDFILL = 'FFF1F5F9', INFILL = 'FFEFF6FF';

/* ================= SECT ================= */
const ws = wb.addWorksheet('SECT');
ws.columns = [{ width: 26 }, { width: 9 }, { width: 9 }, { width: 9 },
              { width: 9 }, { width: 9 }, { width: 11 }];
['Section', 'H', 'B', 't1', 't2', 'r', 'kg/m'].forEach((t, i) =>
  sty(ws.getCell(1, i + 1), { bold: true, color: 'FFFFFFFF', fill: HEADFILL,
                              h: i ? 'center' : 'left', border: true }).value = t);
HS.forEach((s, j) => {
  const row = j + 2;
  [s.key, s.H, s.B, s.t1, s.t2, s.r, s.w].forEach((v, i) =>
    sty(ws.getCell(row, i + 1), { h: i ? 'center' : 'left', border: true,
                                  fill: j % 2 ? BANDFILL : undefined }).value = v);
});
ws.views = [{ state: 'frozen', ySplit: 1 }];
const SECTREF = `SECT!$A$2:$A$${HS.length + 1}`;

/* ================= PARAM ================= */
const ps = wb.addWorksheet('PARAM');
ps.columns = [{ width: 3 }, { width: 21 }, { width: 25 }, { width: 10 }, { width: 10 },
              { width: 10 }, { width: 10 }, { width: 10 }, { width: 11 }, { width: 11 },
              { width: 3 }, { width: 3 }];
ps.views = [{ showGridLines: false }];

function head(row, n, text, note) {
  sty(ps.getCell(row, 2), { bold: true, size: 12, color: 'FFFFFFFF', fill: HEADFILL }).value =
    '  ' + n + '.  ' + text;
  for (let col = 3; col <= 10; col++)
    sty(ps.getCell(row, col), { fill: HEADFILL, color: 'FFFFFFFF', size: 9 }).value =
      col === 3 && note ? note : null;
  ps.getRow(row).height = 20;
}
function cols(row, labels) {
  labels.forEach((t, i) => {
    if (t === null) return;
    sty(ps.getCell(row, i + 2), { bold: true, size: 9, color: MUTE,
                                  h: i ? 'center' : 'left' }).value = t;
  });
}
function label(row, t, sub) {
  sty(ps.getCell(row, 2), { bold: true, size: 10, color: INK }).value = t;
  if (sub) sty(ps.getCell(row, 2), { bold: true }).note = sub;
}
function inp(row, col, value, fmt) {
  const cell = sty(ps.getCell(row, col), { h: 'center', border: true, fill: INFILL,
                                           color: BLUE, bold: true, fmt: fmt });
  cell.value = value;
  return cell;
}
function calc(row, col, formula, result, fmt) {
  const cell = sty(ps.getCell(row, col), { h: 'center', border: true, color: MUTE, fmt: fmt });
  cell.value = { formula: formula, result: result };
  return cell;
}
function note(row, t) {
  sty(ps.getCell(row, 2), { size: 9, italic: true, color: MUTE }).value = t;
  ps.mergeCells(row, 2, row, 10);
}
function checked(row, pairs) {
  sty(ps.getCell(row, 2), { size: 9, bold: true, color: WARN }).value = 'checked for you';
  let col = 3;
  pairs.forEach(p => {
    sty(ps.getCell(row, col), { size: 9, color: MUTE, h: 'right' }).value = p[0];
    const cell = sty(ps.getCell(row, col + 1), { size: 9, bold: true, color: WARN, h: 'left' });
    cell.value = { formula: p[1], result: p[2] };
    col += 2;
  });
}

sty(ps.getCell(R.title, 2), { bold: true, size: 18, color: INK }).value = 'BOLTED SPLICE';
sty(ps.getCell(R.sub, 2), { size: 10, color: MUTE }).value =
  'Fill in the blue cells. Everything else follows — the input tab is written from this one, and nothing on it needs touching.';
ps.getRow(R.title).height = 26;

/* ---- 1. members ---- */
head(R.mHead, 1, 'MEMBER AND JOINT', 'pick a section and the sizes fill themselves in');
cols(R.mCols, ['', 'Section', 'H', 'B', 't1 web', 't2 flange', 'r', 'kg/m', 'Length']);
[['Member', R.mem]].forEach(([t, row]) => {
  label(row, t);
  inp(row, 3, DEF.key);
  ps.getCell(row, 3).dataValidation = { type: 'list', allowBlank: false,
    formulae: [SECTREF], showErrorMessage: true,
    error: 'Pick one from the SECT tab.' };
  [['H', 2, DEF.H], ['B', 3, DEF.B], ['t1', 4, DEF.t1],
   ['t2', 5, DEF.t2], ['r', 6, DEF.r], ['kg', 7, DEF.w]].forEach(([, n, val], i) =>
    calc(row, 4 + i, `IFERROR(VLOOKUP($C$${row},SECT!$A:$G,${n},FALSE),"")`, val));
  inp(row, 10, V.L);
});
label(R.gap, 'Joint gap');
inp(R.gap, 3, V.gap);
note(R.mNote, 'One section, spliced to itself — both sides of the joint are the same member, so there is one row to fill in and Length is the reach of each side. Each side is drawn as three plates — top flange, bottom flange, web — because a rolled section cannot be drilled: a CUT on a SECT cuts its whole length. Root fillets are modelled as eight fillet strips.');
checked(R.mChk, [
  ['clear web depth', `=${c('D', R.mem)}-2*${c('G', R.mem)}`, D.webD],
  ['member centre at ±', `=${c('C', R.gap)}/2+${c('J', R.mem)}/2`, D.off]]);

/* ---- 2. plates ---- */
head(R.pHead, 2, 'SPLICE PLATES', 'width across, length along the beam');
cols(R.pCols, ['', 'Width', 'Length', 'Thick', 'Qty', 'Material']);
const PL = [[R.tp, 'Top plate', V.tpW, V.tpL, V.tpT, 1],
            [R.ti, 'Top inner plate', V.tiW, V.tiL, V.tiT, 2],
            [R.wp, 'Web plate', V.wpW, V.wpL, V.wpT, 2],
            [R.bi, 'Bottom inner plate', V.tiW, V.tiL, V.tiT, 2],
            [R.bp, 'Bottom plate', V.tpW, V.tpL, V.tpT, 1]];
PL.forEach(([row, t, w, l, th, q]) => {
  label(row, t);
  inp(row, 3, w); inp(row, 4, l); inp(row, 5, th);
  sty(ps.getCell(row, 6), { h: 'center', color: MUTE }).value = q;
  inp(row, 7, 'SM355');
  ps.getCell(row, 7).dataValidation = { type: 'list', allowBlank: false,
    formulae: ['"SS275,SM355,SM420,SM460,SM490"'] };
});
const plSteel = (V.tpW * V.tpL * V.tpT * 2 + V.tiW * V.tiL * V.tiT * 4
                 + V.wpW * V.wpL * V.wpT * 2) * 7.85e-6;
checked(R.pChk, [
  ['plate steel, kg', `=ROUND((${c('C',R.tp)}*${c('D',R.tp)}*${c('E',R.tp)}*2` +
    `+${c('C',R.ti)}*${c('D',R.ti)}*${c('E',R.ti)}*4` +
    `+${c('C',R.wp)}*${c('D',R.wp)}*${c('E',R.wp)}*2)*7.85/1000000,1)`,
    Math.round(plSteel * 10) / 10]]);

/* ---- 3. bolts ---- */
head(R.bHead, 3, 'BOLTS', 'the shank and the hole are different sizes');
cols(R.bCols, ['', 'Bolt dia', 'Hole dia', 'Grade', 'Flange bolt L', 'Web bolt L']);
label(R.bVal, 'Bolt');
inp(R.bVal, 3, V.dia); inp(R.bVal, 4, V.hole); inp(R.bVal, 5, 'F10T');
ps.getCell(R.bVal, 5).dataValidation = { type: 'list', allowBlank: false,
  formulae: ['"F8T,F10T,F13T"'] };
/* The two lengths open as the grip plus 30 for head, nut and washers. They are
   input cells, not results: type a stock length over either one and the model
   takes it. */
inp(R.bVal, 6, { formula: `${c('E',R.tp)}+${c('G',R.mem)}+${c('E',R.ti)}+30`, result: boltF });
inp(R.bVal, 7, { formula: `${c('F',R.mem)}+2*${c('E',R.wp)}+30`, result: boltW });

cols(R.gCols, ['bolt group', 'Long N', 'In', 'Out', 'Trans N', 'In', 'Out']);
sty(ps.getCell(R.gCols - 0, 3), { bold: true, size: 9, color: MUTE, h: 'center' });
[[R.gTop, 'Top flange', V.tNL, V.tIL, V.tOL, V.tNT, V.tIT, V.tOT],
 [R.gWeb, 'Web',        V.wNL, V.wIL, V.wOL, V.wNT, V.wIT, V.wOT],
 [R.gBot, 'Bottom flange', V.tNL, V.tIL, V.tOL, V.tNT, V.tIT, V.tOT]
].forEach(([row, t, ...vals]) => {
  label(row, t);
  vals.forEach((v, i) => inp(row, 3 + i, v));
});
note(R.gCols + 4, 'Long = along the beam, Trans = across the flange or through the web depth. In is the gap left in the middle, Out the edge distance. The web opens with Trans In = 0: its bolts run right through the depth with no gap at the neutral axis.');
checked(R.bChk, [
  ['flange pitch', `=ROUND((${c('D',R.tp)}/2-${c('E',R.gTop)}-${c('D',R.gTop)}/2)/(${c('C',R.gTop)}/2-1),1)` +
    `&" / "&ROUND((${c('C',R.tp)}/2-${c('H',R.gTop)}-${c('G',R.gTop)}/2)/(${c('F',R.gTop)}/2-1),1)`,
    D.pTL + ' / ' + D.pTT],
  ['web pitch', `=ROUND((${c('D',R.wp)}/2-${c('E',R.gWeb)}-${c('D',R.gWeb)}/2)/(${c('C',R.gWeb)}/2-1),1)` +
    `&" / "&ROUND((${c('C',R.wp)}-2*${c('H',R.gWeb)}-${c('G',R.gWeb)})/(${c('F',R.gWeb)}-1),1)`,
    D.pWL + ' / ' + D.pWT],
  ['bolts', `=${c('C',R.gTop)}*${c('F',R.gTop)}+${c('C',R.gBot)}*${c('F',R.gBot)}` +
    `+${c('C',R.gWeb)}*${c('F',R.gWeb)}`, nBolt]]);

/* ---- 4. the pictures ----
   Under the tables, not beside them. Squeezed into a column margin they came
   out at a couple of hundred pixels and none of the lettering could be read. */
const AS = JSON.parse(fs.readFileSync(__dirname + '/art_size.json', 'utf8'));
head(R.dHead, 4, 'WHAT THE NUMBERS MEAN', 'the same drawings, to the sizes above');
let irow = R.dHead + 2;
function art(file, key, wPx, caption) {
  sty(ps.getCell(irow, 2), { bold: true, size: 10, color: INK }).value = caption;
  irow++;
  const id = wb.addImage({ filename: __dirname + '/' + file, extension: 'png' });
  const hPx = AS[key].h / AS[key].w * wPx;
  ps.addImage(id, { tl: { col: 1.2, row: irow - 1 }, ext: { width: wPx, height: hPx } });
  irow += Math.ceil(hPx / 20) + 3;            // a default row is about 20px tall
}
art('art_plan.png', 'plan', 830, 'The joint in plan — one section either side, and the gap between');
art('art_sect.png', 'sect', 700, 'The section at the joint — which plate goes where');
art('art_bolt.png', 'bolt', 900, 'Top flange and Bottom flange bolt groups');
art('art_web.png',  'web',  880, 'Web bolt group — Trans In is 0, so the depth is one run');

/* ================= input ================= */
const is = wb.addWorksheet('input');
is.columns = [{ width: 46 }, { width: 10 }, { width: 12 }, { width: 10 }, { width: 10 },
              { width: 10 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 },
              { width: 9 }, { width: 9 }];
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

/* --- the hole --- */
note2('');
row(['HOLE', 'ho.b', 'CIRC', 'mc', f(`=${c('D', R.bVal)}`, V.hole)],
    'the bolt hole - PARAM row ' + R.bVal + ', the hole column, not the shank');
row(['HOLE', 'ho.fil', 'CIRC', 'mc', f(`=2*${c('H', R.mem)}`, 2 * V.r)],
    'the root fillet: a disc of 2r taken out of an r x r square leaves the concave corner');

/* --- plates --- */
const FL = `(${c('D',R.mem)}/2-${c('G',R.mem)}/2)`;               // flange centre Z
note2('');
note2('PLATE  id  material  thickness  RECT  base.pt  B(along beam)  H(across)');
row(['PLATE', 'pl.tf', f(`=${c('G',R.tp)}`, 'SM355'), f(`=${c('G',R.mem)}`, V.tf), 'RECT', 'mc',
     f(`=${c('J',R.mem)}`, V.L), f(`=${c('E',R.mem)}`, V.B)], 'beam top flange, one member');
row(['PLATE', 'pl.bf', f(`=${c('G',R.tp)}`, 'SM355'), f(`=${c('G',R.mem)}`, V.tf), 'RECT', 'mc',
     f(`=${c('J',R.mem)}`, V.L), f(`=${c('E',R.mem)}`, V.B)], 'beam bottom flange');
row(['PLATE', 'pl.wb', f(`=${c('G',R.tp)}`, 'SM355'), f(`=${c('F',R.mem)}`, V.tw), 'RECT', 'mc',
     f(`=${c('J',R.mem)}`, V.L), f(`=${c('D',R.mem)}-2*${c('G',R.mem)}`, D.webD)], 'beam web');
/* The root fillet, drawn as a member of its own: an r x r square standing in the
   section, extruded the length of the beam, with a disc of 2r taken out of its
   far corner. Four of them per member fill the re-entrant corners the three
   plates leave, and they are what brings the section back to its book weight -
   91.8 kg/m without them, 94.0 with, against the 94 the table gives. */
row(['PLATE', 'pl.fil', f(`=${c('G',R.tp)}`, 'SM355'), f(`=${c('J',R.mem)}`, V.L), 'RECT', 'mc',
     f(`=${c('H',R.mem)}`, V.r), f(`=${c('H',R.mem)}`, V.r)], 'root fillet, x8 - four each member');
row(['PLATE', 'pl.tp', f(`=${c('G',R.tp)}`, 'SM355'), f(`=${c('E',R.tp)}`, V.tpT), 'RECT', 'mc',
     f(`=${c('D',R.tp)}`, V.tpL), f(`=${c('C',R.tp)}`, V.tpW)], 'outer top plate');
row(['PLATE', 'pl.ti', f(`=${c('G',R.ti)}`, 'SM355'), f(`=${c('E',R.ti)}`, V.tiT), 'RECT', 'mc',
     f(`=${c('D',R.ti)}`, V.tiL), f(`=${c('C',R.ti)}`, V.tiW)], 'inner top plate, x2');
row(['PLATE', 'pl.wp', f(`=${c('G',R.wp)}`, 'SM355'), f(`=${c('E',R.wp)}`, V.wpT), 'RECT', 'mc',
     f(`=${c('D',R.wp)}`, V.wpL), f(`=${c('C',R.wp)}`, V.wpW)], 'web plate, x2');
row(['PLATE', 'pl.bi', f(`=${c('G',R.bi)}`, 'SM355'), f(`=${c('E',R.bi)}`, V.tiT), 'RECT', 'mc',
     f(`=${c('D',R.bi)}`, V.tiL), f(`=${c('C',R.bi)}`, V.tiW)], 'inner bottom plate, x2');
row(['PLATE', 'pl.bp', f(`=${c('G',R.bp)}`, 'SM355'), f(`=${c('E',R.bp)}`, V.tpT), 'RECT', 'mc',
     f(`=${c('D',R.bp)}`, V.tpL), f(`=${c('C',R.bp)}`, V.tpW)], 'outer bottom plate');

/* --- bars --- */
note2('');
note2('BAR  id  material  diameter  length     the shank, not the hole');
row(['BAR', 'bo.f', 'SS275', f(`=${c('C',R.bVal)}`, V.dia),
     f(`=${c('F',R.bVal)}`, boltF)], 'flange bolt - length from PARAM, which you can overwrite');
row(['BAR', 'bo.w', 'SS275', f(`=${c('C',R.bVal)}`, V.dia),
     f(`=${c('G',R.bVal)}`, boltW)], 'web bolt');

/* ---- the bolt CUT rows ---- */
/* formula fragments for the four pitches and the bolt lines */
const F = {
  pTL: `(${c('D',R.tp)}/2-${c('E',R.gTop)}-${c('D',R.gTop)}/2)/(${c('C',R.gTop)}/2-1)`,
  pTT: `(${c('C',R.tp)}/2-${c('H',R.gTop)}-${c('G',R.gTop)}/2)/(${c('F',R.gTop)}/2-1)`,
  pWL: `(${c('D',R.wp)}/2-${c('E',R.gWeb)}-${c('D',R.gWeb)}/2)/(${c('C',R.gWeb)}/2-1)`,
  pWT: `(${c('C',R.wp)}-2*${c('H',R.gWeb)}-${c('G',R.gWeb)})/(${c('F',R.gWeb)}-1)`,
  iL:  `${c('D',R.gTop)}/2`, iT: `${c('G',R.gTop)}/2`,
  wiL: `${c('D',R.gWeb)}/2`,
  nL:  `${c('C',R.gTop)}/2-1`, nT: `${c('F',R.gTop)}/2-1`,
  wnL: `${c('C',R.gWeb)}/2-1`, wnT: `${c('F',R.gWeb)}-1`,
  off: `${c('C',R.gap)}/2+${c('J',R.mem)}/2`
};
const nL = V.tNL / 2 - 1, nT = V.tNT / 2 - 1, wnL = V.wNL / 2 - 1, wnT = V.wNT - 1;

note2('');
note2('CUT  plate  L.X  L.Y  shape  dx dy repeat  dx2 dy2 repeat2      one row per quadrant the plate reaches');

/* the outer flange plates: all four quadrants, centred on the joint */
[['pl.tp', 'outer top plate'], ['pl.bp', 'outer bottom plate']].forEach(([id, what]) => {
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sy], k) => {
    row(['CUT', id, f(`=${sx > 0 ? '' : '-'}(${F.iL})`, sx * AX.fL[0]),
         f(`=${sy > 0 ? '' : '-'}(${F.iT})`, sy * AX.fT[0]), 'ho.b',
         f(`=${sx > 0 ? '' : '-'}(${F.pTL})`, sx * D.pTL), 0, f(`=${F.nL}`, nL),
         0, f(`=${sy > 0 ? '' : '-'}(${F.pTT})`, sy * D.pTT), f(`=${F.nT}`, nT)],
        k === 0 ? what + ' - four quadrants' : '');
  });
});
/* the inner plates: both halves along the beam, one side of the web */
[['pl.ti', 'inner top plate'], ['pl.bi', 'inner bottom plate']].forEach(([id, what]) => {
  [1, -1].forEach((sx, k) => {
    row(['CUT', id, f(`=${sx > 0 ? '' : '-'}(${F.iL})`, sx * AX.fL[0]),
         f(`=-(${F.pTT})/2`, -tiV), 'ho.b',
         f(`=${sx > 0 ? '' : '-'}(${F.pTL})`, sx * D.pTL), 0, f(`=${F.nL}`, nL),
         0, f(`=${F.pTT}`, D.pTT), 1],
        k === 0 ? what + ' - centred on its own two bolt lines, so one part serves both sides' : '');
  });
});
/* the beam flanges: one member, so one half along the beam, both sides across */
[['pl.tf', 'beam top flange'], ['pl.bf', 'beam bottom flange']].forEach(([id, what]) => {
  [1, -1].forEach((sy, k) => {
    row(['CUT', id, f(`=${F.off}-${F.iL}`, D.off - AX.fL[0]),
         f(`=${sy > 0 ? '' : '-'}(${F.iT})`, sy * AX.fT[0]), 'ho.b',
         f(`=-(${F.pTL})`, -D.pTL), 0, f(`=${F.nL}`, nL),
         0, f(`=${sy > 0 ? '' : '-'}(${F.pTT})`, sy * D.pTT), f(`=${F.nT}`, nT)],
        k === 0 ? what + ' - measured from the plate centre, the joint end is +' : '');
  });
});
/* the web plate: both halves along the beam, one run through the depth */
[1, -1].forEach((sx, k) => {
  row(['CUT', 'pl.wp', f(`=${sx > 0 ? '' : '-'}(${F.wiL})`, sx * AX.wL[0]),
       f(`=-(${c('C',R.wp)}/2-${c('H',R.gWeb)})`, AX.wT[0]), 'ho.b',
       f(`=${sx > 0 ? '' : '-'}(${F.pWL})`, sx * D.pWL), 0, f(`=${F.wnL}`, wnL),
       0, f(`=${F.pWT}`, D.pWT), f(`=${F.wnT}`, wnT)],
      k === 0 ? 'web plate - the depth is one run, no gap at the neutral axis, so two rows not four' : '');
});
/* the beam web: one member */
row(['CUT', 'pl.fil', f(`=${c('H',R.mem)}/2`, V.r / 2), f(`=-${c('H',R.mem)}/2`, -V.r / 2),
     'ho.fil'], 'the disc sits on the far corner of the square, leaving the fillet');
/* the beam web: one member */
row(['CUT', 'pl.wb', f(`=${F.off}-${F.wiL}-(${F.pWL})*(${F.wnL})`, D.off - AX.wL[1]),
     f(`=-(${c('C',R.wp)}/2-${c('H',R.gWeb)})`, AX.wT[0]), 'ho.b',
     f(`=${F.pWL}`, D.pWL), 0, f(`=${F.wnL}`, wnL),
     0, f(`=${F.pWT}`, D.pWT), f(`=${F.wnT}`, wnT)], 'beam web - one member');

/* ---- modules ---- */
note2('');
note2('MODULE  id  member  ref.pt  L.X  L.Y  L.Z  PLANE  [ROT.X ROT.Y ROT.Z]');
note2('Every coordinate below is the real one, measured from the joint centre. A module is placed by its BASE point, so each ASSY row further down repeats that point - which lands the module exactly where these rows say.');
const baseAt = {};                        // module -> where its BASE member sits
function mod(id, member, x, y, z, plane, rot, comment) {
  row(['MODULE', id, member, 'mc', x, y, z, plane,
       rot ? rot[0] : null, rot ? rot[1] : null, rot ? rot[2] : null], comment);
}
function base(id, member, at) {
  row(['MODULE', id, 'BASE', member, 'mc']);
  baseAt[id] = at;
}
const FLz = f(`=${FL}`, Z.fl), FLzn = f(`=-${FL}`, -Z.fl);
const OFF = f(`=-(${F.off})`, -D.off), OFFp = f(`=${F.off}`, D.off);
/* the four fillet corners of a section, and the spin that puts each one's disc
   on the corner away from the web-flange junction */
const filY = f(`=${c('F',R.mem)}/2+${c('H',R.mem)}/2`, V.tw / 2 + V.r / 2);
const filYn = f(`=-(${c('F',R.mem)}/2+${c('H',R.mem)}/2)`, -(V.tw / 2 + V.r / 2));
const filZ = f(`=${c('D',R.mem)}/2-${c('G',R.mem)}-${c('H',R.mem)}/2`,
               V.H / 2 - V.tf - V.r / 2);
const filZn = f(`=-(${c('D',R.mem)}/2-${c('G',R.mem)}-${c('H',R.mem)}/2)`,
                -(V.H / 2 - V.tf - V.r / 2));
const FIL = [[filY, filZ, 0], [filYn, filZ, 270], [filY, filZn, 90], [filYn, filZn, 180]];
function member(id, X, flip) {
  mod(id, 'pl.tf', X, 0, FLz, 'XY', flip ? [0, 0, 180] : null,
      flip ? 'right member - the same parts, turned end for end' : 'left member');
  mod(id, 'pl.bf', X, 0, FLzn, 'XY', flip ? [0, 0, 180] : null);
  mod(id, 'pl.wb', X, 0, 0, 'XZ', flip ? [0, 180, 0] : null);
  FIL.forEach(q => mod(id, 'pl.fil', X, q[0], q[1], 'YZ', [q[2], 0, 0]));
  base(id, 'pl.tf', [X, 0, FLz]);
}
member('md.beaml', OFF, false);
member('md.beamr', OFFp, true);

const tpZ = f(`=${c('D',R.mem)}/2+${c('E',R.tp)}/2`, Z.tpZ);
const tpZn = f(`=-(${c('D',R.mem)}/2+${c('E',R.tp)}/2)`, -Z.tpZ);
const tiZ = f(`=${c('D',R.mem)}/2-${c('G',R.mem)}-${c('E',R.ti)}/2`, Z.tiZ);
const tiZn = f(`=-(${c('D',R.mem)}/2-${c('G',R.mem)}-${c('E',R.ti)}/2)`, -Z.tiZ);
const tiYf = f(`=${c('G',R.gTop)}/2+(${F.pTT})/2`, tiY);
const tiYn = f(`=-(${c('G',R.gTop)}/2+(${F.pTT})/2)`, -tiY);
const wpYf = f(`=${c('F',R.mem)}/2+${c('E',R.wp)}/2`, Z.wpY);
const wpYn = f(`=-(${c('F',R.mem)}/2+${c('E',R.wp)}/2)`, -Z.wpY);

mod('md.tpo', 'pl.tp', 0, 0, tpZ, 'XY', null, 'top flange, outer plate');
base('md.tpo', 'pl.tp', [0, 0, tpZ]);
mod('md.tpi', 'pl.ti', 0, tiYf, tiZ, 'XY', null, 'top flange, the two inner plates');
mod('md.tpi', 'pl.ti', 0, tiYn, tiZ, 'XY');
base('md.tpi', 'pl.ti_1', [0, tiYf, tiZ]);
mod('md.bpo', 'pl.bp', 0, 0, tpZn, 'XY', null, 'bottom flange, outer plate');
base('md.bpo', 'pl.bp', [0, 0, tpZn]);
mod('md.bpi', 'pl.bi', 0, tiYf, tiZn, 'XY', null, 'bottom flange, the two inner plates');
mod('md.bpi', 'pl.bi', 0, tiYn, tiZn, 'XY');
base('md.bpi', 'pl.bi_1', [0, tiYf, tiZn]);
mod('md.wpl', 'pl.wp', 0, wpYf, 0, 'XZ', null, 'web, one plate on each face');
mod('md.wpl', 'pl.wp', 0, wpYn, 0, 'XZ');
base('md.wpl', 'pl.wp_1', [0, wpYf, 0]);

/* ---- the bolts ---- */
note2('');
note2('The bolts, one row each. These are placed at the layout PARAM opens with; change a bolt count and the holes follow but these rows do not.');
/* a bar starts at the point given and runs along the plane normal, so each one
   begins 15 short of its grip and is 30 longer than it - head one end, nut the
   other. The top pack is gripped from Z = H/2 - t2 - inner up; the bottom pack
   from Z = -(H/2 + outer) up. */
const gripC = (V.H / 2 + V.tpT + V.H / 2 - V.tf - V.tiT) / 2;      // 143.5
const GC = `(${c('D',R.mem)}/2+${c('E',R.tp)}+${c('D',R.mem)}/2-${c('G',R.mem)}-${c('E',R.ti)})/2`;
const zFt = f(`=${GC}-${c('F',R.bVal)}/2`, gripC - boltF / 2);
const zF  = f(`=-(${GC})-${c('F',R.bVal)}/2`, -gripC - boltF / 2);
/* One row per quadrant, exactly like the CUT rows that drill for them - the
   two repeat axes carry the counts, and the counts are formulas. Ten rows
   however many bolts there are, and the front sheet moves them all. */
let nb = 0, bolt1 = null;
const repL = `${c('C',R.gTop)}/2-1`, repT = `${c('F',R.gTop)}/2-1`;
const repWL = `${c('C',R.gWeb)}/2-1`, repWT = `${c('F',R.gWeb)}-1`;
for (const sz of [1, -1]) {
  for (const sx of [1, -1]) {
    for (const sy of [1, -1]) {
      const sgx = sx > 0 ? '' : '-', sgy = sy > 0 ? '' : '-';
      const px = f(`=${sgx}(${F.iL})`, sx * V.tIL / 2);
      const py = f(`=${sgy}(${F.iT})`, sy * V.tIT / 2);
      const pz = sz > 0 ? zFt : zF;
      if (!bolt1) bolt1 = [px, py, pz];
      row(['MODULE', 'md.blt', 'bo.f', '', px, py, pz, 'XY', 0, 0, 0,
           f(`=${sgx}(${F.pTL})`, sx * D.pTL), 0, 0, f(`=${repL}`, V.tNL / 2 - 1),
           0, f(`=${sgy}(${F.pTT})`, sy * D.pTT), 0, f(`=${repT}`, V.tNT / 2 - 1)],
          nb++ ? '' : 'flange bolts - one row a quadrant, the counts from PARAM');
    }
  }
}
for (const sx of [1, -1]) {
  const sgx = sx > 0 ? '' : '-';
  row(['MODULE', 'md.blt', 'bo.w', '',
       f(`=${sgx}(${F.wiL})`, sx * V.wIL / 2),
       f(`=${c('G',R.bVal)}/2`, boltW / 2),
       f(`=-(${c('C',R.wp)}/2-${c('H',R.gWeb)})`, -(V.wpW / 2 - V.wOT)),
       'XZ', 0, 0, 0,
       f(`=${sgx}(${F.pWL})`, sx * D.pWL), 0, 0, f(`=${repWL}`, V.wNL / 2 - 1),
       0, 0, f(`=${F.pWT}`, D.pWT), f(`=${repWT}`, V.wNT - 1)],
      nb++ === 8 ? 'web bolts - the depth is one run, so two rows not four' : '');
}
base('md.blt', 'bo.f_1', bolt1);

/* ---- assembly ---- */
note2('');
note2('ASSY places a module by its BASE point, so each row repeats where that point already is — which leaves every module exactly where its own rows put it.');
['md.beaml', 'md.beamr', 'md.tpo', 'md.tpi', 'md.bpo', 'md.bpi', 'md.wpl', 'md.blt']
  .forEach(m => row(['ASSY', 'as.splice', m, 'ADD'].concat(baseAt[m])));

/* ---- the drawings ---- */
note2('');
note2('VIEW  module  from  title      the drawings Save DXF makes, named by this sheet');
[['md.tpo', 'TOP', 'TOP FLANGE - FROM ABOVE'],
 ['md.tpi', 'BOTTOM', 'TOP FLANGE - FROM BELOW'],
 ['md.bpo', 'BOTTOM', 'BOTTOM FLANGE - FROM BELOW'],
 ['md.bpi', 'TOP', 'BOTTOM FLANGE - FROM ABOVE'],
 ['md.wpl', 'FRONT', 'WEB - SIDE']
].forEach(v => row(['VIEW', v[0], v[1], v[2]]));

note2('');
row(['END']);

wb.xlsx.writeFile(__dirname + '/' + (process.env.OUT||'PLATE3D_SPLICE.xlsx')).then(() => {
  console.log('written PLATE3D_SPLICE.xlsx');
  console.log('  SECT  ' + HS.length + ' rows');
  console.log('  input ' + ir + ' rows');
  console.log('  pitch flange ' + D.pTL + ' / ' + D.pTT + '   web ' + D.pWL + ' / ' + D.pWT);
  console.log('  bolt lines  flange X ±' + AX.fL.join(' ±') + '  Y ±' + AX.fT.join(' ±'));
  console.log('              web    X ±' + AX.wL.join(' ±') + '  Z ' + AX.wT.join(' '));
  console.log('  inner plate centre ±' + tiY + ', bolts at ±' + tiV + ' in the plate');
  console.log('  bolts ' + nBolt + '  (from ' + nb + ' rows)   lengths ' + boltF + ' / ' + boltW);
});
