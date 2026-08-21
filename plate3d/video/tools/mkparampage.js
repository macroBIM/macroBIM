/* The PARAM tab, drawn as a page for the film - read back out of the shipped
   workbook cell by cell, so the sheet on screen is the sheet you download and
   not a picture of one. Four cells get a ring: the ones the film types into. */
const ExcelJS = require('./node_modules/exceljs');
const fs = require('fs');
const SRC = __dirname + '/../../PLATE3D_TOWER.xlsx';
const FONTCSS = fs.readFileSync(__dirname + '/v_font.css', 'utf8');
const LAST = 26;                       // down to the slew row; the pictures follow
const RING = ['D6', 'D12', 'D19', 'C25'];

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const argb = a => a ? '#' + String(a).slice(2) : null;

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SRC);
  const ws = wb.getWorksheet('PARAM');

  const NC = 11, w = [], x = [0];
  for (let ci = 1; ci <= NC; ci++) {
    const px = Math.round((ws.getColumn(ci).width || 9) * 7.6 + 5);
    w.push(px); x.push(x[x.length - 1] + px);
  }
  const y = [0], h = [];
  for (let r = 1; r <= LAST; r++) {
    const hh = Math.round((ws.getRow(r).height || 15) * 1.42);
    h.push(hh); y.push(y[y.length - 1] + hh);
  }
  const W = x[NC], H = y[LAST];

  const merged = {};
  (ws.model.merges || []).forEach(m => {
    const p = s => { const t = s.match(/([A-Z]+)(\d+)/);
      let ci = 0; for (const ch of t[1]) ci = ci * 26 + ch.charCodeAt(0) - 64;
      return [ci, +t[2]]; };
    const [a, b] = m.split(':'), A = p(a), B = p(b);
    for (let r = A[1]; r <= B[1]; r++) for (let ci = A[0]; ci <= B[0]; ci++)
      merged[r + ',' + ci] = (r === A[1] && ci === A[0]) ? [B[0] - A[0] + 1] : null;
  });

  const o = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
             `<rect width="${W}" height="${H}" fill="#ffffff"/>`];
  const at = {};                        // where a ringed cell landed
  for (let r = 1; r <= LAST; r++) {
    for (let ci = 1; ci <= NC; ci++) {
      const key = r + ',' + ci;
      if (key in merged && merged[key] === null) continue;
      const span = (merged[key] || [1])[0];
      const cell = ws.getCell(r, ci);
      const cx = x[ci - 1], cy = y[r - 1], ch = h[r - 1];
      let cw = 0; for (let k = 0; k < span; k++) cw += w[ci - 1 + k];
      at[cell.address.replace(/\$/g, '')] = [cx, cy, cw, ch];
      const fill = cell.fill && cell.fill.fgColor ? argb(cell.fill.fgColor.argb) : null;
      if (fill) o.push(`<rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="${fill}"/>`);
      if (cell.border && cell.border.top)
        o.push(`<rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="none" stroke="#cbd5e1"/>`);
      let v = cell.value;
      if (v && typeof v === 'object' && v.formula !== undefined)
        v = v.result !== undefined ? v.result : 0;
      if (v === null || v === undefined || v === '') continue;
      if (typeof v === 'number') v = Math.round(v * 1e6) / 1e6;
      const f = cell.font || {}, al = cell.alignment || {};
      const size = (f.size || 10) * 1.42;
      const col = f.color && f.color.argb ? argb(f.color.argb) : '#0f172a';
      const anc = al.horizontal === 'center' ? 'middle' : al.horizontal === 'right' ? 'end' : 'start';
      const tx = anc === 'middle' ? cx + cw / 2 : anc === 'end' ? cx + cw - 5 : cx + 5;
      o.push(`<text x="${tx}" y="${cy + ch / 2 + size * 0.36}" font-size="${size.toFixed(1)}"` +
        ` fill="${col}" text-anchor="${anc}" font-family="Arial, Helvetica, sans-serif"` +
        (f.bold ? ' font-weight="700"' : '') + (f.italic ? ' font-style="italic"' : '') +
        `>${esc(v)}</text>`);
    }
  }
  RING.forEach(a => { const b = at[a]; if (!b) return;
    o.push(`<rect class="ring" x="${b[0] - 4}" y="${b[1] - 4}" width="${b[2] + 8}" height="${b[3] + 8}"` +
           ` rx="7" fill="none" stroke="#b45309" stroke-width="3.5"/>`);
  });
  o.push('</svg>');

  const scale = Math.min(1860 / W, 1000 / H);
  fs.writeFileSync(__dirname + '/t_param.html',
`<meta charset="utf-8"><style>${FONTCSS}</style><style>
 *{margin:0;padding:0;box-sizing:border-box}
 html,body{width:1920px;height:1080px;overflow:hidden;background:#fff}
 body{font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
 .tab{font:600 21px/1 Inter,sans-serif;color:#0f172a;padding:22px 0 0 46px}
 .tab i{color:#94a3b8;font-style:normal;font-weight:500;margin-left:16px}
 .wrap{transform:scale(${scale.toFixed(4)});transform-origin:top left;margin:12px 0 0 46px}
 .ring{opacity:0}
 body.lit .ring{opacity:1}
</style><div class="tab">PARAM<i>PARAM &middot; input</i></div>
<div class="wrap">${o.join('')}</div>`);
  console.log('t_param.html  ' + W + 'x' + H + '  scale ' + scale.toFixed(3) +
              '  rings: ' + RING.join(', '));
})();
