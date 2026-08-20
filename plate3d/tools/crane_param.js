/* PARAM sheet draft for the tower crane, in the splice book's format.
   The blue cells are what a person fills in; the grey ones follow; the amber
   "checked for you" rows are the ones that catch a number that has gone past
   what the steel can do - a hook below ground, a trolley off the end of the
   jib, a head that has sunk under its own deck.
   The four asks are sections 1 (mast), 2 (jib), 3 (hoist) and 4 (slew).      */
const fs = require('fs');

const FONT = 'Arial';
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
const INK='FF0F172A', MUTE='FF64748B', BLUE='FF1D4ED8', WARN='FFB45309';
const HEADFILL='FF0F172A', INFILL='FFEFF6FF';

const P = 'PARAM';
const R = { title:1, sub:2,
            mHead:4,  mCols:5,  mast:6,  mNote:7,  mChk:8,
            jHead:10, jCols:11, jib:12,  cjib:13,  jNote:14, jChk:15,
            hHead:17, hCols:18, hoist:19, hNote:20, hChk:21,
            sHead:23, sCols:24, slew:25, sNote:26,
            dHead:28 };
const c = (col, row) => `${P}!$${col}$${row}`;

function buildParam(wb) {
const ps = wb.addWorksheet('PARAM');
ps.columns = [{ width:3 }, { width:22 }, { width:11 }, { width:11 }, { width:11 },
              { width:11 }, { width:3 }, { width:13 }, { width:13 }, { width:13 },
              { width:3 }];
ps.views = [{ showGridLines: false }];

function head(row, n, text, note) {
  sty(ps.getCell(row, 2), { bold:true, size:12, color:'FFFFFFFF', fill:HEADFILL })
    .value = '  ' + n + '.  ' + text;
  for (let col = 3; col <= 10; col++)
    sty(ps.getCell(row, col), { fill:HEADFILL, color:'FFFFFFFF', size:9 })
      .value = col === 3 && note ? note : null;
  ps.getRow(row).height = 20;
}
function cols(row, labels) {
  labels.forEach((t, i) => { if (t === null) return;
    sty(ps.getCell(row, i + 2), { bold:true, size:9, color:MUTE, h: i ? 'center':'left' })
      .value = t; });
}
function label(row, t) { sty(ps.getCell(row, 2), { bold:true, size:10, color:INK }).value = t; }
function inp(row, col, value, fmt) {
  const cell = sty(ps.getCell(row, col), { h:'center', border:true, fill:INFILL,
                                           color:BLUE, bold:true, fmt:fmt });
  cell.value = value; return cell;
}
function calc(row, col, formula, result, fmt) {
  const cell = sty(ps.getCell(row, col), { h:'center', border:true, color:MUTE, fmt:fmt });
  cell.value = { formula: formula, result: result }; return cell;
}
function note(row, t) {
  sty(ps.getCell(row, 2), { size:9, italic:true, color:MUTE }).value = t;
  ps.mergeCells(row, 2, row, 10);
}
function checked(row, pairs) {
  sty(ps.getCell(row, 2), { size:9, bold:true, color:WARN }).value = 'checked for you';
  let col = 3;
  pairs.forEach(p => {
    sty(ps.getCell(row, col), { size:9, color:MUTE, h:'right' }).value = p[0];
    sty(ps.getCell(row, col + 1), { size:9, bold:true, color:WARN, h:'left' })
      .value = { formula: p[1], result: p[2] };
    col += 2;
  });
}

/* the crane as it stands today */
const V = { MB:2400, NM:15, Z0:1000, HEAD:9630,
            JBAY:3000, NJ:15, JX0:1900, JTIPL:1600,
            CBAY:2600, NC:5, CX0:-1900,
            TRX:30000, DROP:26020, SLEW:0,
            CWW:2100, CWH:1500, CWT:150, NCW:5 };
const Z = { MTOP:37000, DKT:37330, APEX:47000, TOP:47860,
            JEND:46900, JTIP:48500, CEND:-14900,
            JBC:38140, JTZ:39640, TRZ:40020, HOOK:14000 };

sty(ps.getCell(R.title, 2), { bold:true, size:18, color:INK }).value = 'TOWER CRANE';
sty(ps.getCell(R.sub, 2), { size:10, color:MUTE }).value =
  'Fill in the blue cells. Everything else follows — the input tab is written from this one, and nothing on it needs touching.';
ps.getRow(R.title).height = 26;

/* ---- 1. mast ---- */
head(R.mHead, 1, 'MAST', 'how tall the tower stands — panel count is the height');
cols(R.mCols, ['', 'Panel ht', 'Panels', 'Foot lvl', 'A-frame ht', null,
               'Mast top', 'Apex', 'Overall']);
label(R.mast, 'Mast');
inp(R.mast, 3, V.MB); inp(R.mast, 4, V.NM); inp(R.mast, 5, V.Z0); inp(R.mast, 6, V.HEAD);
calc(R.mast, 8, `=${c('E',R.mast)}+${c('C',R.mast)}*${c('D',R.mast)}`, Z.MTOP);
calc(R.mast, 9, `=${c('H',R.mast)}+370+${c('F',R.mast)}`, Z.APEX);
calc(R.mast, 10, `=${c('I',R.mast)}+860`, Z.TOP);
note(R.mNote, 'Panels is the only cell that changes the height — the slewing deck, the tower head, ' +
     'the jib, the counter-jib and the hoist all ride on Mast top. Head ht is measured from the ' +
     'deck to the apex, so the A-frame keeps its shape at any tower height.');
checked(R.mChk, [
  ['panels', `=IF(${c('D',R.mast)}<3,"at least 3",IF(${c('D',R.mast)}>40,"over 40 — free-standing?","ok "&${c('D',R.mast)}))`, 'ok 15'],
  ['overall', `=TEXT(${c('J',R.mast)}/1000,"0.0")&" m"`, '47.9 m']]);

/* ---- 2. jib ---- */
head(R.jHead, 2, 'JIB AND TAIL', 'how far it reaches — bay count is the radius');
cols(R.jCols, ['', 'Bay', 'Bays', 'Root', 'Tip', null, 'End', 'Radius', 'Bottom chord']);
label(R.jib, 'Jib');
inp(R.jib, 3, V.JBAY); inp(R.jib, 4, V.NJ); inp(R.jib, 5, V.JX0); inp(R.jib, 6, V.JTIPL);
calc(R.jib, 8, `=${c('E',R.jib)}+${c('C',R.jib)}*${c('D',R.jib)}`, Z.JEND);
calc(R.jib, 9, `=${c('H',R.jib)}+${c('F',R.jib)}`, Z.JTIP);
calc(R.jib, 10, `=${c('H',R.mast)}+1140`, Z.JBC);
label(R.cjib, 'Counter-jib');
inp(R.cjib, 3, V.CBAY); inp(R.cjib, 4, V.NC); inp(R.cjib, 5, -V.CX0);
sty(ps.getCell(R.cjib, 6), { h:'center', size:9, color:MUTE }).value = '—';
calc(R.cjib, 8, `=-${c('E',R.cjib)}-${c('C',R.cjib)}*${c('D',R.cjib)}`, Z.CEND);
calc(R.cjib, 9, `=-${c('H',R.cjib)}`, 14900);
note(R.jNote, 'Bays is the only cell that changes the reach. The jib tip module, the pendant hang ' +
     'points and the trolley limit are all worked out from End — nothing on the input tab is ' +
     'written to a fixed radius.');
checked(R.jChk, [
  ['pendant at', `=TEXT(${c('E',R.jib)}+${c('C',R.jib)}*ROUND((${c('D',R.jib)}-2)/2,0),"0")&" / "&TEXT(${c('H',R.jib)}-1500,"0")`, '21400 / 45400'],
  ['radius', `=TEXT(${c('I',R.jib)}/1000,"0.0")&" m"`, '48.5 m']]);

/* ---- 3. hoist ---- */
head(R.hHead, 3, 'HOIST', 'where the trolley parks and how far the hook hangs');
cols(R.hCols, ['', 'Trolley R', 'Hook drop', null, null, null,
               'Trolley lvl', 'Hook lvl', 'Ground clr']);
label(R.hoist, 'Hoist');
inp(R.hoist, 3, V.TRX); inp(R.hoist, 4, V.DROP);
calc(R.hoist, 8, `=${c('J',R.jib)}+1880`, Z.TRZ);
calc(R.hoist, 9, `=${c('H',R.hoist)}-${c('D',R.hoist)}`, Z.HOOK);
calc(R.hoist, 10, `=${c('I',R.hoist)}-1910`, 12090);
note(R.hNote, 'Hook drop is the rope, measured down from the trolley — so the hook keeps the same ' +
     'drop when the tower grows, which is what you want when the two are animated together. ' +
     'Both the hook module and the four falls of rope read this one cell.');
checked(R.hChk, [
  ['trolley', `=IF(${c('C',R.hoist)}>${c('H',R.jib)}-1500,"past the jib end","ok")`, 'ok'],
  ['hook', `=IF(${c('J',R.hoist)}<0,"below ground by "&TEXT(-${c('J',R.hoist)}/1000,"0.0")&" m","ok")`, 'ok']]);

/* ---- 4. slew ---- */
head(R.sHead, 4, 'JIB SLEW', 'which way the jib points — the mast stays put');
cols(R.sCols, ['', 'Jib angle °', null, null, null, null, 'cos', 'sin', 'Jib points']);
label(R.slew, 'Jib slew');
inp(R.slew, 3, V.SLEW);
calc(R.slew, 8, `=COS(RADIANS(${c('C',R.slew)}))`, 1, '0.000000');
calc(R.slew, 9, `=SIN(RADIANS(${c('C',R.slew)}))`, 0, '0.000000');
calc(R.slew, 10, `=TEXT(MOD(${c('C',R.slew)},360),"0")&"° from +X"`, '0° from +X');
note(R.sNote, 'The jib turns, and everything that rides with it: counter-jib, counterweight, ' +
     'tower head, cab, machinery deck, pendants, trolley and hook — the slewing deck and all of ' +
     'it above the bearing. The base and the mast do not move. The axis is the mast centre line, ' +
     'so 0 deg is the jib along +X.');

/* ---- 5. the drawings ----
   Under the tables rather than beside them: squeezed into a column margin the
   lettering cannot be read, which is what the splice book already found out. */
const AS = JSON.parse(fs.readFileSync(__dirname + '/cart_size.json', 'utf8'));
head(R.dHead, 5, 'WHAT THE NUMBERS MEAN', 'the same cells, drawn where they act');
let irow = R.dHead + 2;
function art(file, key, wPx, caption) {
  sty(ps.getCell(irow, 2), { bold:true, size:10, color:INK }).value = caption;
  irow++;
  const id = wb.addImage({ filename: __dirname + '/' + file, extension: 'png' });
  const hPx = AS[key].h / AS[key].w * wPx;
  ps.addImage(id, { tl: { col: 1.2, row: irow - 1 }, ext: { width: wPx, height: hPx } });
  irow += Math.ceil(hPx / 20) + 3;
}
art('cart_elev.png', 'elev', 1000, 'Elevation \u2014 every blue cell, dimensioned where it acts');
art('cart_plan.png', 'plan', 620, 'Plan \u2014 the jib angle, drawn here at 40\u00b0');

return { R: R, Q: Q, sty: sty, INK: INK, MUTE: MUTE, BLUE: BLUE, WARN: WARN,
         HEADFILL: HEADFILL, INFILL: INFILL, FONT: FONT };
}

/* Where every number on the input tab comes from. One place, so a row moving on
   the PARAM sheet cannot quietly leave the input tab pointing at the wrong cell. */
const Q = {
  MB:   c('C', 6),  NM:   c('D', 6),  Z0:   c('E', 6),  HEAD: c('F', 6),
  MTOP: c('H', 6),  APEX: c('I', 6),
  JBAY: c('C', 12), NJ:   c('D', 12), JX0:  c('E', 12), TIP:  c('F', 12),
  JEND: c('H', 12), JTIP: c('I', 12), JBC:  c('J', 12),
  CBAY: c('C', 13), NC:   c('D', 13), CX0:  c('E', 13), CEND: c('H', 13),
  TRX:  c('C', 19), DROP: c('D', 19), TRZ:  c('H', 19), HOOK: c('I', 19),
  ANG:  c('C', 25), CT:   c('H', 25), ST:   c('I', 25)
};
module.exports = { buildParam: buildParam, Q: Q, sty: sty, R: R };
