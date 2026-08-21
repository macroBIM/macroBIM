/* The corner inset that shows the cell being changed.

   Same idea as the tower's mkcellcards.js - the sheet itself, lifted out of the
   workbook the beat loads, so the number on screen is the number in the file.
   One thing is added: a splice beat's consequence is not always in the row
   being typed. Changing the section fills six cells beside it, but changing the
   web plate moves a weight two rows down and changing the bolt count moves a
   pitch nine rows down. So each card carries its "checked for you" row
   underneath, greyed, and that row is the whole point of the beat.

   Three per beat: BEFORE, the cell cleared with a caret, AFTER. Cut between
   them and it reads as typing. Each beat starts from where the last one ended,
   because that is how the film runs.                                        */
const ExcelJS = require('./node_modules/exceljs');
const fs = require('fs');
const V = __dirname + '/../';
const OUT = __dirname + '/splice';
const FONTCSS = fs.readFileSync(__dirname + '/v_font.css', 'utf8');
fs.mkdirSync(OUT, { recursive: true });

const C0 = 2, C1 = 10;                    // the columns worth showing: B..J
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/* band row, label row, value row, the column being typed, and the derived row */
const BEATS = [
  { id: 's', band: 4,  cols: 5,  val: 6,  hot: 3, calc: 10,
    from: 'SPLICE_0_BASE.xlsx',  to: 'SPLICE_1_SECT.xlsx'  },
  { id: 'p', band: 12, cols: 13, val: 16, hot: 3, calc: 20,
    from: 'SPLICE_1_SECT.xlsx',  to: 'SPLICE_2_PLATE.xlsx' },
  { id: 'b', band: 22, cols: 26, val: 28, hot: 6, calc: 31,
    from: 'SPLICE_2_PLATE.xlsx', to: 'SPLICE_3_BOLT.xlsx'  }
];

function cellText(c) {
  let v = c.value;
  if (v && typeof v === 'object' && v.formula !== undefined)
    v = v.result !== undefined ? v.result : 0;
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(Math.round(v * 1e6) / 1e6);
  return String(v);
}

async function strip(file, b, typing) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(V + file);
  const ws = wb.getWorksheet('PARAM');
  const wid = [];
  for (let ci = C0; ci <= C1; ci++) wid.push(Math.round((ws.getColumn(ci).width || 9) * 9.4));

  /* the band title is a merged sentence; only its first clause is the heading */
  const band = esc(String(ws.getCell(b.band, 2).value || '').trim());

  let labels = '', values = '', calc = '';
  for (let ci = C0; ci <= C1; ci++) {
    const k = ci - C0;
    labels += `<td style="width:${wid[k]}px" class="lab">${esc(cellText(ws.getCell(b.cols, ci)))}</td>`;

    const cell = ws.getCell(b.val, ci);
    const txt = ci === b.hot && typing === 'caret' ? '' : esc(cellText(cell));
    const isIn = !!(cell.fill && cell.fill.fgColor);            // a blue input cell
    const isCalc = !!(cell.value && typeof cell.value === 'object' && cell.value.formula);
    const cls = [ci === C0 ? 'nm' : isIn ? 'in' : isCalc ? 'ca' : 'pl',
                 ci === b.hot ? 'hot' : ''].join(' ');
    values += `<td class="${cls}">${txt}${typing === 'caret' && ci === b.hot ? '<i></i>' : ''}</td>`;

    calc += `<td class="${ci === C0 ? 'cnm' : 'cv'}">${esc(cellText(ws.getCell(b.calc, ci)))}</td>`;
  }
  return `<div class="card">
 <div class="band">${band}</div>
 <table><tr class="l">${labels}</tr><tr class="v">${values}</tr>
        <tr class="c">${calc}</tr></table></div>`;
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
    vertical-align:-4px}
 /* the row the sheet worked out for you - it moves on its own, so it is set
    apart rather than shown as another thing to fill in */
 tr.c td{border:none;height:34px;font:600 17px Inter,sans-serif;color:#0f766e;
    background:#f0fdfa}
 tr.c td.cnm{color:#94a3b8;font-weight:500;text-align:left}
</style>${inner}`;

(async () => {
  for (const b of BEATS) {
    fs.writeFileSync(OUT + '/s_x' + b.id + '0.html', PAGE(await strip(b.from, b)));
    fs.writeFileSync(OUT + '/s_x' + b.id + '1.html', PAGE(await strip(b.from, b, 'caret')));
    fs.writeFileSync(OUT + '/s_x' + b.id + '2.html', PAGE(await strip(b.to, b)));
    console.log('s_x' + b.id + '0/1/2.html   ' + b.from + ' -> ' + b.to);
  }
})();
