/* PSC 가 내보낸 DXF 를 그린다. 13번 컷이 "버튼이 만든 그 파일" 을 보여줘야 하므로,
   해석하지 않고 파일에 쓰인 엔티티를 그대로 하나씩 옮긴다.
   (plate3d/video/tools/dxf2svg.js 와 같은 규칙. 그쪽은 ARC 가 없는 파일이었고
    이 파일에는 ARC 가 있어서 따로 둔다.)

   레이어는 파일이 선언한 대로 씁니다 — psc 는 실선, psc-hid 는 HIDDEN 선종이라
   파선으로, psc-txt 는 TEXT. CAD 에서 열었을 때 보이는 것이 그것입니다.

     node dxf2svg_psc.js in.dxf out.svg                                      */
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
    cur = /^(LINE|ARC|CIRCLE|TEXT)$/.test(val.trim()) ? { t: val.trim() } : null;
    if (val.trim() === 'ENDSEC') break;
  } else if (cur) {
    cur[code] = (code === '1' || code === '8') ? val.trim() : parseFloat(val);
  }
}
if (cur) ents.push(cur);

/* 도면 범위 — 종이가 그림을 따라간다 */
let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
const grow = (x, y) => { if (!isFinite(x) || !isFinite(y)) return;
  x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
ents.forEach(e => {
  if (e.t === 'LINE') { grow(e['10'], e['20']); grow(e['11'], e['21']); }
  else if (e.t === 'ARC' || e.t === 'CIRCLE') {
    grow(e['10'] - e['40'], e['20'] - e['40']); grow(e['10'] + e['40'], e['20'] + e['40']);
  } else if (e.t === 'TEXT') { grow(e['10'], e['20']); grow(e['10'] + e['40'] * 12, e['20'] + e['40']); }
});
const W = x1 - x0, H = y1 - y0, pad = Math.max(W, H) * 0.035;
const SW = Math.max(W, H) / 1150;                 // 선 굵기 — 도면 크기에 비례

const arcPts = (cx, cy, r, a0, a1) => {
  const span = ((a1 - a0) % 360 + 360) % 360, n = Math.max(8, Math.round(span / 4));
  const p = [];
  for (let k = 0; k <= n; k++) {
    const a = (a0 + span * k / n) * Math.PI / 180;
    p.push((cx + r * Math.cos(a)).toFixed(2) + ',' + (-(cy + r * Math.sin(a))).toFixed(2));
  }
  return p.join(' ');
};

let svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' +
  (x0 - pad) + ' ' + (-y1 - pad) + ' ' + (W + 2 * pad) + ' ' + (H + 2 * pad) + '">' +
  '<rect x="' + (x0 - pad) + '" y="' + (-y1 - pad) + '" width="' + (W + 2 * pad) +
  '" height="' + (H + 2 * pad) + '" fill="#fff"/>';

ents.forEach(e => {
  const lay = e['8'] || '';
  const hid = lay === 'psc-hid';
  const col = lay === 'psc-txt' ? '#1d4ed8' : '#0f172a';
  const dash = hid ? ' stroke-dasharray="' + (SW * 13).toFixed(1) + ',' + (SW * 8).toFixed(1) + '"' : '';
  const sw = (hid ? SW * 1.7 : SW * 2.1).toFixed(2);
  if (e.t === 'LINE')
    svg += '<line x1="' + e['10'] + '" y1="' + (-e['20']) + '" x2="' + e['11'] + '" y2="' +
           (-e['21']) + '" stroke="' + col + '" stroke-width="' + sw + '"' + dash + '/>';
  else if (e.t === 'ARC')
    svg += '<polyline points="' + arcPts(e['10'], e['20'], e['40'], e['50'], e['51']) +
           '" fill="none" stroke="' + col + '" stroke-width="' + sw + '"' + dash + '/>';
  else if (e.t === 'CIRCLE')
    svg += '<circle cx="' + e['10'] + '" cy="' + (-e['20']) + '" r="' + e['40'] +
           '" fill="none" stroke="' + col + '" stroke-width="' + sw + '"/>';
  else if (e.t === 'TEXT')
    svg += '<text x="' + e['10'] + '" y="' + (-e['20']) + '" font-size="' + e['40'] +
           '" fill="' + col + '" font-family="Inter,system-ui,sans-serif" font-weight="600"' +
           ' letter-spacing="' + (e['40'] * 0.06).toFixed(1) + '">' +
           String(e['1'] || '').replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</text>';
});
svg += '</svg>';
fs.writeFileSync(OUT, svg);
const by = {};
ents.forEach(e => { by[e.t] = (by[e.t] || 0) + 1; });
console.log(OUT + ' — ' + Object.keys(by).map(k => k + ' ' + by[k]).join(' · ') +
            '  (' + Math.round(W) + ' × ' + Math.round(H) + ')');
