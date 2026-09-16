/*  고리가 공동보다 얼마나 작으냐에 따라 자리를 고를 자유가 얼마나 생기는가.
    몬테카를로를 쓸 값어치가 있는지 가른다 — 자유가 없으면 탐색할 것도 없다.
    (앞서 잰 것은 내가 고리를 공동에 딱 맞게 만들어서 여유 0 이 나왔다.
     실제로는 철근 치수가 도면에서 오므로 남는 여유가 생긴다.)             */
const CAV_W = 7695, CAV_T = 2000;     // 공동 : 격벽 깊이 x 두께 (⑩ 한 가닥 자리)
const COVER = 40, DIA = 25;
const need = COVER + DIA / 2;         // 벽에서 떨어져야 할 거리 52.5

//  직사각 고리를 (du, dv, dθ) 로 흔들었을 때 가장 빠듯한 여유
function worst(hw, ht, du, dv, dth) {
  const c = Math.cos(dth), s = Math.sin(dth);
  let w = 1e18;
  for (const [x0, y0] of [[-hw,-ht],[hw,-ht],[hw,ht],[-hw,ht]]) {
    const x = x0 * c - y0 * s + du, y = x0 * s + y0 * c + dv;
    w = Math.min(w, CAV_W/2 - Math.abs(x) - need, CAV_T/2 - Math.abs(y) - need);
  }
  return w;
}

console.log('공동 ' + CAV_W + ' x ' + CAV_T + ' · 피복+지름반 ' + need + '\n');
console.log('철근이 딱맞는  |  밀 수 있는 양      |  돌릴 수 있는');
console.log('크기보다 작은 양|  긴축      두께     |  각        | 가용역 부피비');
console.log('-'.repeat(68));
[0, 5, 10, 25, 50, 100].forEach(shrink => {
  const hw = (CAV_W - 2*need - shrink) / 2, ht = (CAV_T - 2*need - shrink) / 2;
  const bs = (fn) => { let lo=0, hi=300; while (hi-lo>0.02){const m=(lo+hi)/2; if(fn(m)>=0) lo=m; else hi=m;} return lo; };
  const su = bs(m => worst(hw, ht, m, 0, 0));
  const sv = bs(m => worst(hw, ht, 0, m, 0));
  const sr = bs(m => worst(hw, ht, 0, 0, m/1e5));
  //  무작위 표본으로 가용역 부피비 — 몬테카를로 수용률이 곧 이 값이다
  let ok = 0, N = 40000, BU = 120, BV = 120, BR = 0.01;
  for (let i = 0; i < N; i++) {
    const du = (Math.random()*2-1)*BU, dv = (Math.random()*2-1)*BV, dt = (Math.random()*2-1)*BR;
    if (worst(hw, ht, du, dv, dt) >= 0) ok++;
  }
  console.log(String(shrink).padStart(10) + ' mm |' +
    su.toFixed(1).padStart(8) + sv.toFixed(1).padStart(9) + '  |' +
    (sr/1e5*180/Math.PI).toFixed(3).padStart(8) + '°  |  ' +
    (ok/N*100).toFixed(2) + '%  (수용 ' + ok + '/' + N + ')');
});
