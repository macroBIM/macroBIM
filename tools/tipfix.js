/*  철근 2 · 2-1 (캔틸레버 하면, 190 다리 + 1,400) 을 격벽 단면에서 다시 짚는다.
    다리가 있어야 할 곳은 캔틸레버 **선단**이고, 콘크리트 안으로 돌아야 한다.
    셀 벽을 뺀 지금 무엇을 주면 그렇게 되는지 조합을 훑는다.                */
const lib = require('./probe_lib.js');
const { runCase, outer } = lib;
const TIP = { '2': 6200, '2-1': -6200 };          // 그 철근의 자유단(선단) x
function show(id, label, patch) {
  const r = runCase(id, patch);
  if (!r) return console.log('  ' + label.padEnd(26) + ' → 실패');
  const xs = r.pts.map(p => p[0]);
  //  짧은 조각(190)의 위치 = 다리
  let leg = null;
  for (let i = 0; i + 1 < r.pts.length; i++) {
    const L = Math.hypot(r.pts[i+1][0]-r.pts[i][0], r.pts[i+1][1]-r.pts[i][1]);
    if (L < 400) leg = r.pts[i];
  }
  const dTip = leg ? Math.abs(leg[0] - TIP[id]) : NaN;
  console.log('  ' + label.padEnd(26) + ' → ' + r.state.padEnd(11) +
    '길이 ' + r.len.toFixed(0).padStart(6) +
    ' · 밖 ' + String(r.out).padStart(2) + '/' + r.tot +
    ' · 다리 x ' + (leg ? leg[0].toFixed(0).padStart(6) : '   -  ') +
    ' (선단에서 ' + (isFinite(dTip) ? dTip.toFixed(0) : '?') + ')');
}
['2', '2-1'].forEach(id => {
  const ra = (id === '2') ? 88.282 : 91.718;
  console.log('\n── 철근 ' + id + '  (다리가 x≈' + TIP[id] + ', 길이 1,590 이어야 한다)');
  show(id, '지금 그대로', {});
  show(id, '꺾임각 부호 뒤집기', { angs: { ra: -ra } });
  [['start','fit'], ['start','ray'], ['end','fit'], ['end','ray']].forEach(([side, mode]) => {
    const be = {}; be[side] = {}; be[side][mode] = 0;
    show(id, side + ':' + mode, { barEnds: be });
    show(id, side + ':' + mode + ' + 각 뒤집기', { barEnds: be, angs: { ra: -ra } });
  });
});
