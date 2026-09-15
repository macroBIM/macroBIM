/*  페이지의 crebar 경로(_loadCrebarFromExcel → _settleHoops)를 그대로 돌린다. */
const lib = require('./probe_lib.js');
const hoops = lib.runHoops();
const EXPECT = { '10': 3812, '10-1': 4312, '10-2': 11562 };
console.log('\n=== 폐합철근이 자기 자리를 찾았나 ===');
hoops.forEach(h => {
  const xs = h.pts.map(p => p[0]), zs = h.pts.map(p => p[1]);
  const w = Math.max(...xs) - Math.min(...xs), t = Math.max(...zs) - Math.min(...zs);
  const exp = EXPECT[h.id];
  console.log('  ' + h.id.padEnd(5) + ' ' + h.state.padEnd(11) +
    '· 감은 크기 ' + w.toFixed(0).padStart(6) + ' x ' + t.toFixed(0).padStart(5) +
    ' · 점 ' + h.pts.length + (h.pts[0][0] === h.pts[h.pts.length-1][0] &&
                               h.pts[0][1] === h.pts[h.pts.length-1][1] ? ' (닫힘)' : ' (열림!)') +
    ' · 도면 기대폭 ' + exp + ' → 차이 ' + (w - exp).toFixed(0));
  console.log('        ' + h.pts.map(p => '(' + p[0].toFixed(0) + ',' + p[1].toFixed(0) + ')').join(' '));
});
