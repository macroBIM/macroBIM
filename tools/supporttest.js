/*  지지 관계가 실제로 뽑히는지 — 같은 벽에 여러 가닥을 몰아넣어 확인한다. */
const lib = require('./probe_lib.js');
const P = lib.P, Domain = lib.Domain, sec = lib.sec;

function run(rows, label) {
  Domain.currentSection = sec;
  Domain.trebarList = []; Domain.queue = []; Domain.activeQueueIndex = 0;
  Domain.isPaused = false; Domain.wallStack = {}; Domain._stackSeq = 0;
  Domain.USER_REBAR_DATA = rows;
  rows.forEach(rd => { try {
    const rb = Domain._createTrebarFromData(rd);
    if (rb) { Domain.trebarList.push(rb); Domain.queue.push({ kind: 'trebar', obj: rb }); }
  } catch (e) {} });
  for (let i = 0; i < 60000 && Domain.activeQueueIndex < Domain.queue.length; i++) Domain.stepPhysics();
  console.log('\n' + label);
  P.supportTable().forEach(r => {
    r.segs.forEach(sg => {
      const on = sg.on ? sg.on + '(' + sg.tag + ')' : '없음';
      const over = (sg.over && sg.over.length) ? '  위에 얹힘 → ' + sg.over.join(', ')
                                               : '  콘크리트에 직접';
      console.log('   ' + String(r.id).padEnd(4) + ' seq' + String(r.seq).padStart(2) +
                  ' · 조각 ' + sg.seg + ' → ' + on.padEnd(12) + over);
    });
  });
}

const stack = ['A','B','C','D'].map(n => ({
  type: 'trebar', id: n, code: 1, dia: 25, segs: { a: { len: 3000, set: 'E1' } } }));
run(stack.map(b => JSON.parse(JSON.stringify(b))), '같은 벽(E1)에 네 가닥 — 놓은 순서 A B C D');
run(stack.slice().reverse().map(b => JSON.parse(JSON.stringify(b))), '순서를 뒤집으면 D C B A');
