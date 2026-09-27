/*  bench/shape_rot.js — 형상 코드가 rot 에 따라 어느 방향으로 서는지 확인한다.
 *
 *  주의 : 조각의 p1→p2 는 **진행 방향**이지 '다리가 어느 쪽에 있나' 가 아니다.
 *  코드 11 의 A 는 자유단(p1)에서 코너(p2)로 내려오므로, 진행 방향이 아래면
 *  다리는 **위**에 있다. 둘은 반대다. 여기서는 **코너 기준 위치**로 찍는다.
 *  (이 둘을 섞어서 한 번 틀린 표를 적은 적이 있다)
 *
 *  실행 :  node bench/shape_rot.js
 */
'use strict';
const vm = require('vm');
const { makeContext } = require('./engine');

const { ctx } = makeContext();                    // 엔진과 같은 차례로 올라간 컨텍스트
const TrebarFactory = vm.runInContext('TrebarFactory', ctx);

const dirName = (dx, dy) => {
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return '·';
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? '오른쪽' : '왼쪽')
                                     : (dy > 0 ? '위' : '아래');
};

const CODES = [1, 11, 11.1, 14, 15, 21, 23, 23.1];

CODES.forEach(code => {
  console.log('');
  //  23.1 → '23a' 처럼 가지는 글자로 적는다 (엔진 안에서만 숫자다)
  const name = (c => { const b = Math.floor(c), f = Math.round((c - b) * 10);
                       return f ? b + String.fromCharCode(96 + f) : String(b); })(code);
  console.log('코드 ' + name + '  (rot 은 반시계가 +)');
  console.log('   rot    첫조각 위치    끝조각 방향');
  [0, 90, 180, -90].forEach(rot => {
    let t = null;
    try { t = TrebarFactory.create(code, { x: 0, y: 0 }, {}, rot); } catch (e) {}
    if (!t || !t.segments || t.segments.length < 1) { console.log('  ' + String(rot).padStart(4) + '   (못 만듦)'); return; }
    const a = t.segments[0], b = t.segments[t.segments.length - 1];
    if (t.segments.length < 2) {
      console.log('  ' + String(rot).padStart(4) + '   ' +
        dirName(a.p2.x - a.p1.x, a.p2.y - a.p1.y).padEnd(14) + '(직선 하나)');
      return;
    }
    //  코너 = a.p2.  다리의 위치 = 코너에서 자유단(a.p1) 쪽
    console.log('  ' + String(rot).padStart(4) + '   ' +
      dirName(a.p1.x - a.p2.x, a.p1.y - a.p2.y).padEnd(14) +
      dirName(b.p2.x - b.p1.x, b.p2.y - b.p1.y));
  });
});

console.log('');
console.log('좌측 캔틸레버 1-1 이 필요한 것 : 다리 아래 · 몸통 오른쪽');
console.log('우측 캔틸레버 1   이 필요한 것 : 다리 아래 · 몸통 왼쪽');
