/* The corner inset that shows the cell being changed.

   The film used to draw a chip: old number struck through, new number beside
   it. That is a graphic I invented. This is the sheet itself - the section band,
   the column labels and the value row, lifted straight out of the workbook the
   beat loads, so the number on screen is the number in the file and the derived
   cells beside it are what Excel worked out.

   Two per beat: BEFORE off TOWER_0_BASE, AFTER off the case file. Cut between
   them and it reads as typing.                                              */
const ExcelJS = require('./node_modules/exceljs');
const fs = require('fs');
const V = __dirname + '/../';
const FONTCSS = fs.readFileSync(__dirname + '/v_font.css', 'utf8');

const BEATS = [
  { id: 'm', file: 'TOWER_1_MAST.xlsx', head: 4, cols: 5, val: 6, hot: 4 },   // D = Panels
  { id: 'j', file: 'TOWER_2_JIB.xlsx',  head: 10, cols: 11, val: 12, hot: 4 },
  { id: 's', file: 'slew/TOWER_S15.xlsx', head: 23, cols: 24, val: 25, hot: 3 }
];
const C0 = 2, C1 = 10;                    // the columns worth showing: B..J
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

function cellText(c) {
  let v = c.value;
  if (v && typeof v === 'object' && v.formula !== undefined)
    v = v.result !== undefined ? v.result : 0;
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(Math.round(v * 1e6) / 1e6);
  return String(v);
}

async function strip(file, b, typing, hotOver) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(V + file);
  const ws = wb.getWorksheet('PARAM');
  const wid = [];
  for (let ci = C0; ci <= C1; ci++) wid.push(Math.round((ws.getColumn(ci).width || 9) * 9.4));

  const band = esc(String(ws.getCell(b.head, 2).value || '').trim());
  let labels = '', values = '';
  for (let ci = C0; ci <= C1; ci++) {
    const k = ci - C0;
    const lab = esc(cellText(ws.getCell(b.cols, ci)));
    labels += `<td style="width:${wid[k]}px" class="lab">${lab}</td>`;
    const cell = ws.getCell(b.val, ci);
    const txt = ci === (hotOver === undefined ? b.hot : hotOver) && typing === 'caret'
      ? '' : esc(cellText(cell));
    const isIn = !!(cell.fill && cell.fill.fgColor);           // a blue input cell
    const isCalc = !!(cell.value && typeof cell.value === 'object' && cell.value.formula);
    const hot = hotOver === undefined ? b.hot : hotOver;
    const cls = [ci === C0 ? 'nm' : isIn ? 'in' : isCalc ? 'ca' : 'pl',
                 ci === hot ? 'hot' : ''].join(' ');
    values += `<td class="${cls}">${txt}${typing === 'caret' && ci === hot ? '<i></i>' : ''}</td>`;
  }
  return `<div class="card">
 <div class="band">${band}</div>
 <table><tr class="l">${labels}</tr><tr class="v">${values}</tr></table></div>`;
}

const PAGE = inner => `<meta charset="utf-8"><style>${FONTCSS}</style><style>
 *{margin:0;padding:0;box-sizing:border-box}
 html,body{width:1920px;height:1080px;overflow:hidden}
 body{background:transparent;font-family:Inter,system-ui,sans-serif;
      -webkit-font-smoothing:antialiased;
      display:flex;align-items:flex-start;justify-content:flex-end;padding:66px 78px 0 0}
 .card{background:#fff;border-radius:16px;overflow:hidden;
       box-shadow:0 26px 70px rgba(2,6,23,.55),0 0 0 1px rgba(15,23,42,.12)}
 .band{background:#0f172a;color:#fff;font:700 20px/1 Inter,sans-serif;
       letter-spacing:.01em;padding:15px 20px}
 table{border-collapse:collapse;font-family:Arial,"Liberation Sans",sans-serif}
 td{padding:0 9px;height:40px;white-space:nowrap;border:1px solid #e2e8f0;
    text-align:center;font-size:19px;font-variant-numeric:tabular-nums}
 tr.l td{font:700 14px Inter,sans-serif;color:#64748b;height:30px;border:none;
    padding-top:9px}
 tr.l td:first-child{text-align:left}
 td.nm{font:700 19px Inter,sans-serif;color:#0f172a;text-align:left;border:none}
 td.in{background:#eff6ff;color:#1d4ed8;font-weight:700}
 td.ca{color:#64748b}
 td.pl{border:none;color:#94a3b8}
 td.hot{box-shadow:inset 0 0 0 3px #b45309}
 td.hot i{display:inline-block;width:3px;height:23px;background:#0f172a;
    vertical-align:-4px;animation:none}
</style>${inner}`;

(async () => {
  for (const b of BEATS) {
    fs.writeFileSync(__dirname + '/t_x' + b.id + '0.html',
      PAGE(await strip('TOWER_0_BASE.xlsx', b)));                 // before
    fs.writeFileSync(__dirname + '/t_x' + b.id + '1.html',
      PAGE(await strip('TOWER_0_BASE.xlsx', b, 'caret')));        // cleared, caret
    fs.writeFileSync(__dirname + '/t_x' + b.id + '2.html',
      PAGE(await strip(b.file, b)));                              // after
    console.log('t_x' + b.id + '0/1/2.html   ' + b.file);
  }

  /* The hoist is two moves in one row: the hook comes up, then it comes in.
     Five cards rather than three, because the second change starts from where
     the first one left off. */
  const H = { head: 17, cols: 18, val: 19, hot: 4 };          // D = Hook drop
  const seq = [
    ['h0', 'TOWER_0_BASE.xlsx',    undefined, 4],             // as it stands
    ['h1', 'TOWER_0_BASE.xlsx',    'caret',   4],             // hook drop cleared
    ['h2', 'TOWER_3_HOOK.xlsx',    undefined, 4],             // 5000 - the hook is up
    ['h3', 'TOWER_3_HOOK.xlsx',    'caret',   3],             // trolley R cleared
    ['h4', 'TOWER_4_TROLLEY.xlsx', undefined, 3]              // 10000 - and in
  ];
  for (const [id, file, typing, hot] of seq)
    fs.writeFileSync(__dirname + '/t_x' + id + '.html',
      PAGE(await strip(file, H, typing, hot)));
  console.log('t_xh0..h4.html   hoist, two moves');
})();
