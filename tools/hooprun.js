/*  페이지의 crebar 경로(_loadCrebarFromExcel → _settleHoops)를 그대로 돌린다.
    도면이 말하는 자리에 놓이는지만 본다 — 크기는 콘크리트가 정한다.        */
const lib = require('./probe_lib.js');
const hoops = lib.runHoops();
console.log('\n=== 폐합철근이 자기 자리를 찾았나 ===');
hoops.forEach(h => {
  const us = h.pts.map(p => p[0]), zs = h.pts.map(p => p[1]);
  const lo = Math.min(...us), hi = Math.max(...us);
  const closed = h.pts[0][0] === h.pts[h.pts.length - 1][0] &&
                 h.pts[0][1] === h.pts[h.pts.length - 1][1];
  const per = h.pts.slice(1).reduce((s, p, i) =>
    s + Math.hypot(p[0] - h.pts[i][0], p[1] - h.pts[i][1]), 0);
  console.log('  ' + h.id.padEnd(5) + ' ' + h.state.padEnd(8) +
    (h.plane === 'yz' ? '세로 x=' : '가로 y=') + String(h.at).padStart(6) +
    ' · ' + (h.plane === 'yz' ? 'y' : 'x') + ' ' + lo.toFixed(0).padStart(6) + '~' + hi.toFixed(0).padStart(6) +
    ' (' + (hi - lo).toFixed(0).padStart(5) + ')' +
    ' · 두께 ' + (Math.max(...zs) - Math.min(...zs)).toFixed(0) +
    ' · 둘레 ' + per.toFixed(0).padStart(6) + (closed ? ' · 닫힘' : ' · 열림!'));
});
