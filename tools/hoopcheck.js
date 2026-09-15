/*  폐합철근이 네 면에 제대로 붙었나 — 평면 직사각형과 하나하나 대 본다.
    닫는 한 변은 지금 코드가 이어 붙이는 것이라, 그 변이 네 번째 벽의
    피복선에 얹혀 있는지가 관건이다.                                      */
const lib = require('./probe_lib.js');
const P = lib.P;
const hoops = lib.runHoops();
const t = 2000, cover = 40;
hoops.forEach(h => {
  const ax = (h.plane === 'yz') ? 1 : 0;
  const sp = P._spanAt(h.at, ax);
  const want = cover + (h.dia || 25) / 2;                 // 벽에서 떨어져야 할 거리
  const us = h.pts.map(p => p[0]), zs = h.pts.map(p => p[1]);
  const lo = Math.min(...us), hi = Math.max(...us);
  console.log('\n' + h.id + ' (' + (ax ? 'x=' : 'y=') + h.at + ')  콘크리트 ' +
    sp.lo.toFixed(0) + '~' + sp.hi.toFixed(0) + ' × 두께 ' + t);
  console.log('   네 변이 벽에서 떨어진 거리 (' + want + ' 이어야 한다) :');
  console.log('     긴 축 시작 ' + (lo - sp.lo).toFixed(1).padStart(8) +
              '   끝 ' + (sp.hi - hi).toFixed(1).padStart(8) +
              '   ← from/to 로 자른 쪽은 벽이 아니라 그 선이 기준');
  console.log('     두께 앞   ' + (Math.min(...zs) + t / 2).toFixed(1).padStart(8) +
              '   뒤 ' + (t / 2 - Math.max(...zs)).toFixed(1).padStart(8));
  //  닫는 한 변 = 마지막 점 → 첫 점. 그 변이 어디에 있나
  const a = h.pts[h.pts.length - 2], b = h.pts[0];
  console.log('   닫는 변 : (' + a[0].toFixed(0) + ',' + a[1].toFixed(0) + ') → (' +
              b[0].toFixed(0) + ',' + b[1].toFixed(0) + ')  길이 ' +
              Math.hypot(b[0] - a[0], b[1] - a[1]).toFixed(0));
});
