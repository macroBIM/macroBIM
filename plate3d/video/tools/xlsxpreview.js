/* Draw a worksheet the way Excel will draw it.

   Not a pretty rendering of the numbers - a reading of what the file actually
   stores: column widths, row heights, fonts, fills, borders, alignment and
   number formats. The point is to check the styling that was written, so
   inventing any of it would defeat the exercise. */
const ExcelJS = require('./node_modules/exceljs');
const fs = require('fs');

const FILE = process.argv[2];
const SHEET = +(process.argv[3] || 0);
const OUT = process.argv[4] || 'preview.html';
const ROWS = +(process.argv[5] || 30);

const argb = (c, d) => (c && c.argb ? '#' + c.argb.slice(2) : d);
const pt = v => (v * 96 / 72).toFixed(1) + 'px';
// Excel's column width is in characters of the default font; 7px a character
// plus 5px of padding is the conversion Excel itself documents.
const colPx = w => Math.round((w || 8.43) * 7 + 5);

function fmt(v, f) {
  if (v == null || v === '') return '';
  if (typeof v === 'object') {
    if (v.result !== undefined) v = v.result;
    else if (v.text !== undefined) return v.text;
    else if (v.richText) return v.richText.map(t => t.text).join('');
    else return '';
  }
  if (typeof v !== 'number' || !f) return String(v);
  if (/%/.test(f)) {
    const dp = (f.match(/\.(0+)/) || [, ''])[1].length;
    return (v * 100).toFixed(dp) + '%';
  }
  const m = f.match(/\.([0#]+)/);
  let s;
  if (m && /0/.test(m[1])) s = v.toFixed(m[1].length);
  else if (m) s = String(Math.round(v * Math.pow(10, m[1].length)) / Math.pow(10, m[1].length));
  else s = String(Math.round(v));
  if (/#,##0/.test(f)) {
    const p = s.split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    s = p.join('.');
  }
  return s;
}

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);
  const ws = wb.worksheets[SHEET];
  const view = ws.views && ws.views[0] || {};
  const grid = view.showGridLines !== false;
  const nCol = Math.min(ws.columnCount || 10, 12);

  let widths = [];
  for (let i = 1; i <= nCol; i++) widths.push(colPx(ws.getColumn(i).width));

  let body = '';
  let r = 0;
  ws.eachRow({ includeEmpty: true }, (row, idx) => {
    if (r++ >= ROWS) return;
    const h = row.height ? pt(row.height) : pt(15);
    let tds = '';
    for (let ci = 1; ci <= nCol; ci++) {
      const c = row.getCell(ci);
      const f = c.font || {};
      const b = c.border || {};
      const st = [];
      st.push('font-weight:' + (f.bold ? 700 : 400));
      if (f.italic) st.push('font-style:italic');
      st.push('font-size:' + (f.size || 11) + 'pt');
      st.push('color:' + argb(f.color, '#000'));
      if (c.fill && c.fill.fgColor) st.push('background:' + argb(c.fill.fgColor, 'transparent'));
      const edge = (e, side) => e ? ('border-' + side + ':' +
        (e.style === 'medium' ? '2px' : e.style === 'thick' ? '3px' : '1px') + ' solid ' +
        argb(e.color, '#000')) : '';
      if (b.top) st.push(edge(b.top, 'top'));
      if (b.bottom) st.push(edge(b.bottom, 'bottom'));
      const al = c.alignment || {};
      const numeric = typeof (c.value && c.value.result !== undefined ? c.value.result : c.value) === 'number';
      st.push('text-align:' + (al.horizontal || (numeric ? 'right' : 'left')));
      st.push('vertical-align:' + (al.vertical === 'middle' ? 'middle' : 'bottom'));
      tds += '<td style="' + st.join(';') + '">' + String(fmt(c.value, c.numFmt))
        .replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</td>';
    }
    body += '<tr style="height:' + h + '">' + tds + '</tr>';
  });

  fs.writeFileSync(OUT, `<meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#fff;font-family:Calibri,Carlito,"Liberation Sans",sans-serif;padding:0}
    table{border-collapse:collapse;table-layout:fixed;width:${widths.reduce((a,b)=>a+b,0)}px}
    td{padding:0 5px;overflow:hidden;white-space:nowrap;
       ${grid ? 'outline:0.5px solid #d9d9d9;outline-offset:-0.5px' : ''}}
  </style><table><colgroup>` +
    widths.map(w => '<col style="width:' + w + 'px">').join('') +
    '</colgroup>' + body + '</table>');
  console.log(OUT + '  ' + ws.name + '  gridlines=' + grid + '  cols=' + nCol);
})();
