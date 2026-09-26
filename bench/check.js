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
const TRUTH = {
  s15: {
    '1-1': { len: 4990, x: [-6154, -1356] },
    '1':   { len: 8000, x: [-1654,  6153] },
    '2':   { len: 1590, x: [ 4741,  6141] },
    '4-1': { len: 2540, x: [-5607, -3123] },
    '3-1': { len: 2730, x: [ 3019,  5717] }
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
      const okLen = Math.abs(b.len - t.len) <= 2;
      const okPos = Math.abs(x0 - t.x[0]) <= 5 && Math.abs(x1 - t.x[1]) <= 5;
      verdict = (okLen && okPos) ? '  도면과 일치' : ('  ✗ 도면 ' + t.len + ' x ' + t.x[0] + '..' + t.x[1]);
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

//  ② 새 경로 : init 만으로 놓는 S14
report('S14 · 박스 페이지 · init 만', fix('s14'), 'box', null);

//  ③ 새 경로 · 기본 길이 (segs 미입력)
const noSegs = JSON.parse(JSON.stringify(fix('s14')));
noSegs.forEach(r => {
  if (String(r[0] || '').trim().toLowerCase() !== 'trebar') return;
  const id = String(r[1]);
  r[6] = '';
  if (id === '1-1') r[4] = '-5800,1000,-90';
  if (id === '1')   r[4] = '5800,-150,180';
  if (id === '2')   r[4] = '6000,-350,90';
});
report('S14 · init 만 + segs 미입력 (기본 400)', noSegs, 'box', null);
