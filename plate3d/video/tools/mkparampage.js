/* The PARAM tab, drawn as a page for the film - read back out of the shipped
   workbook cell by cell, so the sheet on screen is the sheet you download and
   not a picture of one. The cells the film types into get a ring.

   Defaults are the tower's. The splice film passes its own:
     BOOK=../../PLATE3D_SPLICE.xlsx RING=C6,C16,F28 LAST=31 OUT=t_param_splice \
       node mkparampage.js

   The teaching film draws blocks out of the middle of an `input` sheet rather
   than a whole PARAM tab, so it also sets SHEET, FIRST and NC:

     BOOK=../../PLATE3D_BASIC.xlsx SHEET=input FIRST=1 LAST=7 NC=11 \
       RING=G2 OUT=basic/b_sh_plate TABS=input node mkparampage.js

   FIRST is a real crop, not a scroll: rows above it are not drawn and the
   block sits at the top of the page. Row numbers down the gutter stay the
   sheet's own, because the point of showing the sheet is that the viewer can
   find the same row in the file they downloaded.                            */
const ExcelJS = require('./node_modules/exceljs');
const fs = require('fs');
const SRC = __dirname + '/' + (process.env.BOOK || '../../PLATE3D_TOWER.xlsx');
const FONTCSS = fs.readFileSync(__dirname + '/v_font.css', 'utf8');
const SHEET = process.env.SHEET || 'PARAM';
const FIRST = +(process.env.FIRST || 1);
const LAST = +(process.env.LAST || 26);   // the tower's: down to the slew row
/* An empty RING means "no ring on this page", which `||` would read as unset
   and answer with the tower's four. Only an absent variable takes the default. */
const RING = (process.env.RING === undefined ? 'D6,D12,D19,C25' : process.env.RING)
  .split(',').map(s => s.trim()).filter(Boolean);
const OUT = __dirname + '/' + (process.env.OUT || 't_param') + '.html';
const TABS = process.env.TABS || 'PARAM &middot; input';   // the tab strip as the book has it
/* Both of these default to what the tower and splice films already produce, so
   adding them cannot move a frame of those two. ACTIVE is the tab drawn in bold
   - BASIC has no PARAM tab, its sheet is called input. VALIGN centres a short
   block in the frame; a full PARAM tab fills the height anyway and does not
   care, but a six-row PLATE block pinned to the top leaves the screen empty. */
const ACTIVE = process.env.ACTIVE || 'PARAM';
const VALIGN = process.env.VALIGN || 'top';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const argb = a => a ? '#' + String(a).slice(2) : null;

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SRC);
  const ws = wb.getWorksheet(SHEET);
  if (!ws) throw new Error('no sheet named ' + SHEET + ' in ' + SRC);

  const NC = +(process.env.NC || 11), w = [], x = [0];
  for (let ci = 1; ci <= NC; ci++) {
    const px = Math.round((ws.getColumn(ci).width || 9) * 7.6 + 5);
    w.push(px); x.push(x[x.length - 1] + px);
  }
  const y = [0], h = [];
  for (let r = FIRST; r <= LAST; r++) {
    const hh = Math.round((ws.getRow(r).height || 15) * 1.42);
    h.push(hh); y.push(y[y.length - 1] + hh);
  }
  const W = x[NC], H = y[y.length - 1];

  const merged = {};
  (ws.model.merges || []).forEach(m => {
    const p = s => { const t = s.match(/([A-Z]+)(\d+)/);
      let ci = 0; for (const ch of t[1]) ci = ci * 26 + ch.charCodeAt(0) - 64;
      return [ci, +t[2]]; };
    const [a, b] = m.split(':'), A = p(a), B = p(b);
    for (let r = A[1]; r <= B[1]; r++) for (let ci = A[0]; ci <= B[0]; ci++)
      merged[r + ',' + ci] = (r === A[1] && ci === A[0]) ? [B[0] - A[0] + 1] : null;
  });

  /* a cell counts as empty for spilling if it holds nothing to draw */
  const isEmpty = (r, ci) => {
    if ((r + ',' + ci) in merged) return false;
    let v = ws.getCell(r, ci).value;
    if (v && typeof v === 'object' && v.formula !== undefined)
      v = v.result !== undefined ? v.result : '';
    return v === null || v === undefined || v === '';
  };

  const o = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
             `<rect width="${W}" height="${H}" fill="#ffffff"/>`];
  const at = {};                        // where a ringed cell landed
  for (let r = FIRST; r <= LAST; r++) {
    for (let ci = 1; ci <= NC; ci++) {
      const key = r + ',' + ci;
      if (key in merged && merged[key] === null) continue;
      const span = (merged[key] || [1])[0];
      const cell = ws.getCell(r, ci);
      const cx = x[ci - 1], cy = y[r - FIRST], ch = h[r - FIRST];
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
      /* points to pixels is 96/72 = 1.333. It was 1.42 here, which is 7 % too
         big against the 7.6 px column unit below, and that is enough to clip a
         section heading that fits in Excel. */
      const size = (f.size || 10) * 1.3333;
      const col = f.color && f.color.argb ? argb(f.color.argb) : '#0f172a';
      const anc = al.horizontal === 'center' ? 'middle' : al.horizontal === 'right' ? 'end' : 'start';
      const tx = anc === 'middle' ? cx + cw / 2 : anc === 'end' ? cx + cw - 5 : cx + 5;
      /* Excel spills a long entry into the next cell only while that cell is
         empty, and clips it the moment something is in there. Without this the
         section headings get written over by the note beside them; with a flat
         clip to the cell box, the title and the notes get cut instead. So the
         run of empty neighbours is measured, the way Excel measures it. */
      let lx = cx, rx = cx + cw;
      if (!(key in merged)) {                       // a merge already has its box
        if (anc !== 'end')
          for (let k = ci + span; k <= NC && isEmpty(r, k); k++) rx += w[k - 1];
        if (anc !== 'start')
          for (let k = ci - 1; k >= 1 && isEmpty(r, k); k--) lx -= w[k - 1];
      }
      const cid = 'c' + r + '_' + ci;
      o.push(`<clipPath id="${cid}"><rect x="${lx}" y="${cy}" width="${rx - lx + 2}" height="${ch}"/></clipPath>`);
      o.push(`<text clip-path="url(#${cid})" x="${tx}" y="${cy + ch / 2 + size * 0.36}" font-size="${size.toFixed(1)}"` +
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
  const top = VALIGN === 'center'
    ? Math.max(12, Math.round((1080 - 64 - H * scale) / 2)) : 12;
  fs.writeFileSync(OUT,
`<meta charset="utf-8"><style>${FONTCSS}</style><style>
 *{margin:0;padding:0;box-sizing:border-box}
 html,body{width:1920px;height:1080px;overflow:hidden;background:#fff}
 body{font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
 .tab{font:600 21px/1 Inter,sans-serif;color:#0f172a;padding:22px 0 0 46px}
 .tab i{color:#94a3b8;font-style:normal;font-weight:500;margin-left:16px}
 .wrap{transform:scale(${scale.toFixed(4)});transform-origin:top left;margin:${top}px 0 0 46px}
 .ring{opacity:0}
 body.lit .ring{opacity:1}
</style><div class="tab">${ACTIVE}<i>${TABS}</i></div>
<div class="wrap">${o.join('')}</div>`);
  console.log(require('path').basename(OUT) + '  ' + W + 'x' + H + '  scale ' + scale.toFixed(3) +
              '  rings: ' + RING.join(', '));
})();
