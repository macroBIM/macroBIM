/*  bench/check.js — 지금 엔진이 어디까지 맞는지 한 번에 본다.
 *  기준은 도면이다 (8-244 / 8-243 철근표).
 *  실행 :  node bench/check.js
 */
'use strict';
const fs = require('fs'), path = require('path');
const { run } = require('./engine');
const G = require('./geom');

const fix = f => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture', f + '.json'), 'utf8'));

//  도면이 말하는 값 — 이것과 맞아야 한다
//    tol 을 주면 길이 허용오차가 커진다. 둔각 V(코드 15)는 코너가 **출력**이다 —
//    두 조각이 제 벽에 안착한 뒤 두 직선의 교점으로 이어지므로, 꺾임각이 도면과
//    조금만 달라도 전체 길이가 몇십 mm 움직인다. 그 차이 자체가 볼 값이다.
const TRUTH = {
  s15: {
    '1-1': { len: 4990, x: [-6154, -1356] },
    '1':   { len: 8000, x: [-1654,  6153] },
    '2':   { len: 1590, x: [ 4741,  6141] },
    '4-1': { len: 2540, x: [-5607, -3123] },
    '3-1': { len: 2730, x: [ 3019,  5717] }
  },
  //  8-243 주두부 배근도(1) SECTION A-A. x 는 도면이 직접 주지 않는 것이 있어 길이만 본다.
  s14: {
    '1-1': { len: 4990, x: [-6154, -1354] },
    '1':   { len: 8000, x: [-1654,  6154] },
    '2':   { len: 1590 },
    '2-1': { len: 1590 },
    '3':   { len: 5055, tol: 60 },
    '4':   { len: 5055, tol: 60 },
    '5':   { len: 4000 }
  }
};

function report(tag, sheet, page, truth) {
  const r = run(sheet, {}, 40000, page);
  console.log('\n=== ' + tag + '  [' + r.outcome + '] ===');
  let bad = 0;
  r.bars.forEach(b => {
    const xs = b.pts.map(p => p[0]);
    const x0 = Math.round(Math.min(...xs)), x1 = Math.round(Math.max(...xs));
    const os = G.outsideLength(b.pts, r.outer, r.openings);
    let verdict = '';
    if (truth && truth[b.id]) {
      const t = truth[b.id];
      const okLen = Math.abs(b.len - t.len) <= (t.tol || 2);
      const okPos = !t.x || (Math.abs(x0 - t.x[0]) <= 5 && Math.abs(x1 - t.x[1]) <= 5);
      verdict = (okLen && okPos) ? '  도면과 일치' : ('  ✗ 도면 ' + t.len + (t.x ? ' x ' + t.x[0] + '..' + t.x[1] : ''));
      if (!(okLen && okPos)) bad++;
    }
    console.log('  ' + b.id.padEnd(4) + (b.state || '?').padEnd(11) +
      '길이 ' + String(Math.round(b.len)).padStart(5) +
      '   x ' + String(x0).padStart(6) + '..' + String(x1).padStart(6) +
      '   밖 ' + String(Math.round(os.outside)).padStart(4) + verdict);
  });
  if (truth) console.log('  → ' + (bad ? bad + ' 개 어긋남' : '전부 도면과 일치'));
  return bad;
}

//  ① 기준 경로 : set 을 쓰는 S15. 이것이 깨지면 엔진이 상한 것이다.
report('S15 · 격벽 페이지 · set 있음  (기준)', fix('s15'), 'dia', TRUTH.s15);

//  ② 새 경로 : init 만으로 놓는 S14 (set 도 angs 도 없다)
report('S14 · 박스 페이지 · init 만', fix('s14'), 'box', TRUTH.s14);

//  ③ 새 경로 · 기본 길이 (segs 미입력) — 길이를 안 줘도 형상이 서는지만 본다
const noSegs = JSON.parse(JSON.stringify(fix('s14')));
noSegs.forEach(r => {
  if (String(r[0] || '').trim().toLowerCase() === 'trebar') r[6] = '';
});
report('S14 · init 만 + segs 미입력 (기본 400)', noSegs, 'box', null);
