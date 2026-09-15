/*  개구부 벽이 물리에 몇 장 들어가 있나 — 화면에 한 개로 보이는 것이
    그리기 문제인지 진짜 벽이 하나뿐인지 가른다. */
const lib = require('./probe_lib.js');
const P = lib.P;
//  8-020 A-A 의 팔각 개구부 (1200 x 1500, 모따기 250) 를 직접 얹고 단면을 다시 만든다
const B = 1200, H = 1500, C = 250, X = 0, Yc = -700;
const pts = [
  [-B/2 + C, Yc + H/2], [ B/2 - C, Yc + H/2], [ B/2, Yc + H/2 - C], [ B/2, Yc - H/2 + C],
  [ B/2 - C, Yc - H/2], [-B/2 + C, Yc - H/2], [-B/2, Yc - H/2 + C], [-B/2, Yc + H/2 - C]
].map(p => [p[0] + X, p[1]]);
P._openings = [{ pts: pts }];
const sec = P._buildSectionFromBim();
const bySrc = {}, walls = sec.walls;
walls.forEach(w => { const k = w.src || '(없음)'; bySrc[k] = (bySrc[k] || 0) + 1; });
console.log('\n단면 벽 ' + walls.length + '장 · src 별 :');
Object.keys(bySrc).forEach(k => console.log('   ' + k.padEnd(10) + ' ' + bySrc[k] + '장'));
console.log('\n개구부 벽 하나하나 (법선이 콘크리트 쪽을 보는지) :');
walls.filter(w => String(w.src || '').indexOf('open') === 0).forEach(w => {
  const mx = (w.x1 + w.x2) / 2, my = (w.y1 + w.y2) / 2;
  //  개구부 중심에서 멀어지는 쪽이면 콘크리트 쪽이다
  const away = (mx - X) * w.nx + (my - Yc) * w.ny > 0;
  console.log('   ' + w.id.padEnd(4) + ' tag ' + w.tag.padEnd(6) +
    '(' + w.x1.toFixed(0).padStart(5) + ',' + w.y1.toFixed(0).padStart(6) + ')→(' +
    w.x2.toFixed(0).padStart(5) + ',' + w.y2.toFixed(0).padStart(6) + ')' +
    ' n(' + w.nx.toFixed(2).padStart(5) + ',' + w.ny.toFixed(2).padStart(5) + ')' +
    (away ? '  바깥(콘크리트) ✓' : '  안쪽 ✗'));
});

//  Toggle Normals 가 실제로 몇 개를 그리는지 — 같은 묶기 규칙을 그대로 돌려 본다
function picksOf(walls) {
  var picks = [], ni = 0;
  while (ni < walls.length) {
    var n0 = walls[ni];
    if (!n0.src) { picks.push(n0); ni++; continue; }
    var nj = ni;
    while (nj + 1 < walls.length && walls[nj + 1].src === n0.src) nj++;
    picks.push(walls[(ni + nj) >> 1]);
    ni = nj + 1;
  }
  return picks;
}
const picks = picksOf(walls);
const openPicks = picks.filter(w => String(w.src || '').indexOf('open') === 0);
console.log('\n화살표로 그려지는 개수 : 전체 ' + picks.length + ' · 그중 개구부 ' + openPicks.length +
            '  (개구부 벽은 8장 → 8개여야 맞다)');
