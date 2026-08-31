/* A DXF, as a picture — LINE, ARC, CIRCLE and TEXT, which is all this engine
   writes.

       node tools/dxf2svg.js in.dxf out.svg

   Not a viewer and not a check. It exists so a drawing can be LOOKED at
   without opening CAD: every other output here has a way to be seen, and the
   DXF - the thing the business actually ships - did not. */
const fs = require('fs');

function parse(dxf) {
  const L = dxf.split(/\r?\n/).map(s => s.trim());
  const out = [];
  for (let i = 0; i < L.length; i++) {
    const kind = L[i];
    if (!['LINE', 'ARC', 'CIRCLE', 'TEXT'].includes(kind)) continue;
    const g = {};
    for (let j = i + 1; j < L.length - 1; j += 2) {
      const c = L[j];
      if (['0'].includes(c)) break;                 // next entity
      g[c] = L[j + 1];
    }
    const n = k => (g[k] === undefined ? null : +g[k]);
    if (kind === 'LINE') out.push({ k: 'L', x1: n('10'), y1: n('20'), x2: n('11'), y2: n('21'), lay: g['8'] });
    else if (kind === 'CIRCLE') out.push({ k: 'C', x: n('10'), y: n('20'), r: n('40'), lay: g['8'] });
    else if (kind === 'ARC') out.push({ k: 'A', x: n('10'), y: n('20'), r: n('40'),
                                        a0: n('50'), a1: n('51'), lay: g['8'] });
    else out.push({ k: 'T', x: n('10'), y: n('20'), h: n('40') || 2.5, s: g['1'] || '', lay: g['8'] });
  }
  return out;
}

const src = process.argv[2], dst = process.argv[3];
if (!src || !dst) { console.error('usage: node tools/dxf2svg.js in.dxf out.svg'); process.exit(2); }
const e = parse(fs.readFileSync(src, 'utf-8'));
let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
const see = (x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
e.forEach(o => {
  if (o.k === 'L') { see(o.x1, o.y1); see(o.x2, o.y2); }
  else if (o.k === 'T') see(o.x, o.y);
  else { see(o.x - o.r, o.y - o.r); see(o.x + o.r, o.y + o.r); }
});
const pad = Math.max(10, (x1 - x0) * 0.02);
x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
const W = x1 - x0, H = y1 - y0;
const P = (x, y) => (x - x0).toFixed(2) + ',' + (y1 - y).toFixed(2);   // DXF y is up
const body = e.map(o => {
  const col = /HIDDEN/i.test(o.lay || '') ? '#94a3b8'
            : /DIM|TEXT|TITLE/i.test(o.lay || '') ? '#2563eb' : '#0f172a';
  if (o.k === 'L') {
    const [ax, ay] = P(o.x1, o.y1).split(','), [bx, by] = P(o.x2, o.y2).split(',');
    return `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${col}" stroke-width="${W/1400}"/>`;
  }
  if (o.k === 'C') {
    const [cx, cy] = P(o.x, o.y).split(',');
    return `<circle cx="${cx}" cy="${cy}" r="${o.r}" fill="none" stroke="${col}" stroke-width="${W/1400}"/>`;
  }
  if (o.k === 'A') {
    const r = o.r, a0 = o.a0 * Math.PI / 180, a1 = o.a1 * Math.PI / 180;
    const s = P(o.x + r * Math.cos(a0), o.y + r * Math.sin(a0));
    const t = P(o.x + r * Math.cos(a1), o.y + r * Math.sin(a1));
    let sweep = o.a1 - o.a0; while (sweep < 0) sweep += 360;
    return `<path d="M${s} A${r},${r} 0 ${sweep > 180 ? 1 : 0} 0 ${t}" fill="none" stroke="${col}" stroke-width="${W/1400}"/>`;
  }
  const [tx, ty] = P(o.x, o.y).split(',');
  return `<text x="${tx}" y="${ty}" font-size="${o.h}" fill="${col}" font-family="monospace">${
    String(o.s).replace(/[<&>]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}</text>`;
}).join('\n');
fs.writeFileSync(dst,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(2)} ${H.toFixed(2)}" ` +
  `width="1100" style="background:#fff">\n${body}\n</svg>\n`);
console.log(e.length + ' entities  ·  ' + W.toFixed(0) + ' x ' + H.toFixed(0) + '  →  ' + dst);
