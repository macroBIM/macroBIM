/*  같은 벽에 여러 가닥을 몰아넣어 자리를 다투게 한다.
    이때 순서가 결과를 바꾸면, 순서는 물리적 의미를 갖는 것이다.           */
const lib = require('./probe_lib.js');
const P = lib.P, Domain = lib.Domain, sec = lib.sec;

//  데크 상면(E1) 한 곳에 직선 철근 여섯 가닥을 몰아넣는다
const bars = ['A','B','C','D','E','F'].map((n, i) => ({
  type: 'trebar', id: n, code: 1, dia: 25,
  segs: { a: { len: 3000, set: 'E1' } }
}));

function settle(rows) {
  Domain.currentSection = sec;
  Domain.trebarList = []; Domain.queue = []; Domain.activeQueueIndex = 0;
  Domain.isPaused = false; Domain.wallStack = {};
  Domain.USER_REBAR_DATA = rows;
  rows.forEach(rd => { try {
    const rb = Domain._createTrebarFromData(rd);
    if (rb) { Domain.trebarList.push(rb); Domain.queue.push({ kind: 'trebar', obj: rb }); }
  } catch (e) {} });
  for (let i = 0; i < 60000 && Domain.activeQueueIndex < Domain.queue.length; i++) Domain.stepPhysics();
  const o = {};
  Domain.trebarList.forEach(t => { o[t.id] = [t.segments[0].p1.x, t.segments[0].p1.y]; });
  return o;
}

const ref = settle(bars.map(b => JSON.parse(JSON.stringify(b))));
console.log('같은 벽(E1)에 여섯 가닥 — 기준 순서 A B C D E F');
Object.keys(ref).forEach(k => console.log('   ' + k + ' : (' + ref[k][0].toFixed(0) + ', ' + ref[k][1].toFixed(1) + ')'));

const rev = settle(bars.slice().reverse().map(b => JSON.parse(JSON.stringify(b))));
console.log('\n순서를 뒤집으면 (F E D C B A)');
let worst = 0;
Object.keys(ref).forEach(k => {
  const d = Math.hypot(ref[k][0]-rev[k][0], ref[k][1]-rev[k][1]);
  worst = Math.max(worst, d);
  console.log('   ' + k + ' : (' + rev[k][0].toFixed(0) + ', ' + rev[k][1].toFixed(1) + ')' +
    (d > 0.5 ? '   ← ' + d.toFixed(1) + ' mm 옮겨짐' : ''));
});
console.log('\n최대 차이 : ' + worst.toFixed(1) + ' mm');
