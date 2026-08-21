/* Draw a PLATE3D DXF, so cut 10 can show the drawing the button produced
   rather than a picture of one.

   The file is unusually plain - LINE, CIRCLE, SOLID and TEXT, four layers, no
   blocks and no ARC - so the whole reader is the group-code walk below and the
   whole renderer is one SVG element per entity. Nothing here interprets the
   drawing; it just puts on screen exactly what the export wrote.

     node dxf2svg.js in.dxf out.svg [pageIndex]                             */
const fs = require('fs');
const IN = process.argv[2], OUT = process.argv[3] || IN.replace(/\.dxf$/, '.svg');

const src = fs.readFileSync(IN, 'utf8').split(/\r?\n/);
const ents = [];
let i = 0;
while (i < src.length - 1 && !(src[i].trim() === '2' && src[i + 1].trim() === 'ENTITIES')) i += 2;
i += 2;
let cur = null;
for (; i < src.length - 1; i += 2) {
  const code = src[i].trim(), val = src[i + 1];
  if (code === '0') {
    if (cur) ents.push(cur);
    cur = /^(LINE|CIRCLE|SOLID|TEXT)$/.test(val.trim()) ? { t: val.trim() } : null;
    if (val.trim() === 'ENDSEC') break;
  } else if (cur) {
    cur[code] = /^\d+(\.\d+)?$/.test(val.trim()) || /^-?\d/.test(val.trim())
      ? parseFloat(val) : val;
    if (code === '1' || code === '8' || code === '7') cur[code] = val.trim();
  }
}
if (cur) ents.push(cur);

/* extents, so the page fits the paper rather than the other way round */
let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
const grow = (x, y) => { if (!isFinite(x) || !isFinite(y)) return;
  if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
ents.forEach(e => {
  if (e.t === 'LINE') { grow(e['10'], e['20']); grow(e['11'], e['21']); }
  else if (e.t === 'CIRCLE') { grow(e['10'] - e['40'], e['20'] - e['40']);
                               grow(e['10'] + e['40'], e['20'] + e['40']); }
  else if (e.t === 'SOLID') { for (let k = 0; k < 4; k++) grow(e[10 + k], e[20 + k]); }
  else if (e.t === 'TEXT') { grow(e['10'], e['20']); }
});

const PAD = 30;
const W = x1 - x0, H = y1 - y0;
const flip = y => (y1 - y) + PAD;                   // DXF is y-up, SVG is y-down
const px = x => (x - x0) + PAD;

const STYLE = {
  'PL3D-OUTLINE': 'stroke:#0f172a;stroke-width:1.4;fill:none',
  'PL3D-HIDDEN':  'stroke:#94a3b8;stroke-width:0.8;fill:none;stroke-dasharray:6 4',
  'PL3D-DIM':     'stroke:#2563eb;stroke-width:0.6;fill:none',
  'PL3D-TITLE':   'stroke:#0f172a;stroke-width:1;fill:none'
};
const INK = { 'PL3D-DIM': '#2563eb', 'PL3D-HIDDEN': '#94a3b8' };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const out = [];
ents.forEach(e => {
  const lay = e['8'] || 'PL3D-OUTLINE';
  const st = STYLE[lay] || STYLE['PL3D-OUTLINE'];
  if (e.t === 'LINE')
    out.push(`<line x1="${px(e['10']).toFixed(2)}" y1="${flip(e['20']).toFixed(2)}" ` +
             `x2="${px(e['11']).toFixed(2)}" y2="${flip(e['21']).toFixed(2)}" style="${st}"/>`);
  else if (e.t === 'CIRCLE')
    out.push(`<circle cx="${px(e['10']).toFixed(2)}" cy="${flip(e['20']).toFixed(2)}" ` +
             `r="${e['40'].toFixed(2)}" style="${st}"/>`);
  else if (e.t === 'SOLID') {
    // DXF SOLID corner order is 0,1,3,2 - hand it round the quad, not across it
    const o = [0, 1, 3, 2].map(k => px(e[10 + k]).toFixed(2) + ',' + flip(e[20 + k]).toFixed(2));
    out.push(`<polygon points="${o.join(' ')}" style="fill:${INK[lay] || '#0f172a'};stroke:none"/>`);
  } else if (e.t === 'TEXT') {
    const h = e['40'] || 2.5, rot = e['50'] || 0;
    const ax = e['11'] !== undefined ? e['11'] : e['10'];
    const ay = e['21'] !== undefined ? e['21'] : e['20'];
    const anch = { 0: 'start', 1: 'middle', 2: 'end' }[e['72'] || 0] || 'start';
    const x = px(ax).toFixed(2), y = flip(ay).toFixed(2);
    out.push(`<text x="${x}" y="${y}" font-size="${h}" text-anchor="${anch}" ` +
             `dominant-baseline="middle" fill="${INK[lay] || '#0f172a'}" ` +
             `font-family="Arial, Liberation Sans, sans-serif"` +
             (rot ? ` transform="rotate(${(-rot).toFixed(2)} ${x} ${y})"` : '') +
             `>${esc(e['1'] || '')}</text>`);
  }
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${(W + 2 * PAD).toFixed(0)}" ` +
  `height="${(H + 2 * PAD).toFixed(0)}" viewBox="0 0 ${(W + 2 * PAD).toFixed(2)} ${(H + 2 * PAD).toFixed(2)}">` +
  `<rect width="100%" height="100%" fill="#fff"/>` + out.join('') + `</svg>`;
fs.writeFileSync(OUT, svg);
const by = {};
ents.forEach(e => { by[e.t] = (by[e.t] || 0) + 1; });
console.log(ents.length + ' entities ' + JSON.stringify(by));
console.log('extents ' + W.toFixed(0) + ' x ' + H.toFixed(0) + '  -> ' + OUT);
