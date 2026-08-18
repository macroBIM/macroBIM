/* The pages the video needs that PLATE3D does not draw itself: the sheet the
   model comes out of, the take-off it produces, and the two outro cards.
   The sheet is the real file read back cell by cell - a mock-up would be a lie
   about the one thing the video is claiming. */
const FONTCSS = require("fs").readFileSync(__dirname + "/v_font.css", "utf8");
const ExcelJS = require('./node_modules/exceljs');
const fs = require('fs');
const P3 = '/home/user/macroBIM/plate3d/';

const HEAD = `<meta charset="utf-8">
<style>${FONTCSS}</style>
<style>
 *{box-sizing:border-box;margin:0;padding:0}
 body{font:400 15px/1.45 Inter,system-ui,sans-serif;background:#fff;color:#0f172a;
      -webkit-font-smoothing:antialiased}
 .xl{width:100%;border-collapse:collapse;table-layout:fixed}
 .xl th,.xl td{border:1px solid #e2e8f0;padding:5px 9px;white-space:nowrap;
      overflow:hidden;text-overflow:ellipsis;font-size:15px;height:30px}
 .xl thead th{background:#f1f5f9;color:#64748b;font-weight:600;font-size:13px;
      text-align:center;position:sticky;top:0}
 .rn{background:#f1f5f9;color:#94a3b8;font-size:12px;text-align:center;width:52px;
      font-weight:600}
 .note{color:#94a3b8;font-style:italic;font-size:13px}
 .kw{color:#1d4ed8;font-weight:700}
 .hd{color:#64748b;font-style:italic;font-size:13px}
 .num{text-align:right;font-variant-numeric:tabular-nums}
 .drv{background:#fde68a;color:#7c2d12;font-weight:700;text-align:center;
      box-shadow:inset 0 0 0 3px #b45309}
 .der{color:#94a3b8;font-style:italic;text-align:center}
</style>`;

function sheetHTML(rows, cols, opt) {
  opt = opt || {};
  const L = 'ABCDEFGHIJKLMNOP'.split('');
  let h = '<table class="xl"><colgroup><col style="width:52px">';
  for (let i = 0; i < cols; i++) h += '<col style="width:' + (i === 0 ? 300 : 96) + 'px">';
  h += '</colgroup><thead><tr><th class="rn"></th>';
  for (let i = 0; i < cols; i++) h += '<th>' + L[i] + '</th>';
  h += '</tr></thead><tbody>';
  rows.forEach((r, i) => {
    h += '<tr><td class="rn">' + (i + 1) + '</td>';
    for (let c = 0; c < cols; c++) {
      const v = r[c] == null ? '' : String(r[c]);
      const addr = L[c] + (i + 1);
      let cls = '';
      if (c === 0) cls = 'note';
      else if (v.charAt(0) === '#') cls = 'hd';
      else if (c === 1 && v) cls = 'kw';
      else if (/^-?[\d.]+$/.test(v)) cls = 'num';
      if (opt.drv === addr) cls = 'drv';
      if (opt.der && opt.der.indexOf(addr) >= 0) cls = 'der';
      h += '<td class="' + cls + '">' + v.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</td>';
    }
    h += '</tr>';
  });
  return h + '</tbody></table>';
}

async function readRows(file, maxCol) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets[0];
  const out = [];
  ws.eachRow({ includeEmpty: true }, row => {
    const r = [];
    for (let c = 1; c <= maxCol; c++) {
      const v = row.getCell(c).value;
      r.push(v && typeof v === 'object'
        ? (v.result !== undefined ? v.result : (v.formula ? '=' + v.formula : (v.text || '')))
        : v);
    }
    out.push(r);
  });
  return out;
}

(async () => {
  // 1. the tower sheet, for the scroll
  const tw = await readRows(P3 + 'PLATE3D_TOWER.xlsx', 12);
  fs.writeFileSync('v_sheet_tower.html', HEAD + sheetHTML(tw, 12));
  console.log('v_sheet_tower.html   ' + tw.length + ' rows');

  // 2. the portal sheet at the driver cell, before and after
  for (const [n, tag] of [[5, 'before'], [9, 'after']]) {
    const pr = await readRows(P3 + 'video/PLATE3D_VIDEO_' + (n === 5 ? '30M' : '54M') + '.xlsx', 11);
    const win = pr.slice(98, 118);              // rows 99..118 - the ASSY block
    const off = 98;
    const shift = a => a[0] + (parseInt(a.slice(1), 10) - off);
    fs.writeFileSync('v_sheet_' + tag + '.html',
      HEAD + '<style>.xl td,.xl th{height:44px;font-size:20px}.rn{font-size:15px}</style>' +
      sheetHTML(win, 11, { drv: shift('I106'), der: ['F112','F115','I109'].map(shift) })
        .replace(/<td class="rn">(\d+)<\/td>/g, (m, d) => '<td class="rn">' + (+d + off) + '</td>'));
    console.log('v_sheet_' + tag + '.html  I106 = ' + n);
  }
})();
