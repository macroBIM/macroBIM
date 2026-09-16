/*  순서를 바꾸면 결과가 달라지는가 — "한꺼번에 풀기"가 필요한지 가르는 시험.
    달라지지 않으면 철근들이 자리를 안 다투는 것이고, 그러면 순차/동시가
    같은 답을 낸다. 달라지면 순서가 물리적으로 의미를 갖는다는 뜻이다.     */
const lib = require('./probe_lib.js');
const P = lib.P, Domain = lib.Domain, sec = lib.sec;
const fs = require('fs');
const sheet = JSON.parse(fs.readFileSync('s15_input.json', 'utf8'));
const base = P._parseRebar(sheet) || [];

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
  const out = {};
  Domain.trebarList.forEach(t => {
    const pts = [[t.segments[0].p1.x, t.segments[0].p1.y]];
    t.segments.forEach(s => pts.push([s.p2.x, s.p2.y]));
    out[t.id] = pts;
  });
  return out;
}

const ref = settle(base.map(r => JSON.parse(JSON.stringify(r))));
console.log('기준 순서로 안착한 철근 : ' + Object.keys(ref).join(', ') + '\n');

//  순서를 여러 가지로 섞어 본다
const PERMS = [
  ['뒤집기',        rs => rs.slice().reverse()],
  ['한 칸 밀기',    rs => rs.slice(1).concat(rs.slice(0, 1))],
  ['무작위 A',      rs => rs.slice().sort(() => Math.random() - 0.5)],
  ['무작위 B',      rs => rs.slice().sort(() => Math.random() - 0.5)],
];
PERMS.forEach(([name, f]) => {
  const rows = f(base).map(r => JSON.parse(JSON.stringify(r)));
  const got = settle(rows);
  let worst = 0, who = '';
  Object.keys(ref).forEach(id => {
    if (!got[id]) { worst = Infinity; who = id + '(없음)'; return; }
    ref[id].forEach((p, i) => {
      const q = got[id][i];
      if (!q) return;
      const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
      if (d > worst) { worst = d; who = id; }
    });
  });
  console.log('  ' + name.padEnd(10) + '(' + rows.map(r => r.id).join(' ') + ')  →  ' +
    (worst < 0.5 ? '같다' : '최대 ' + worst.toFixed(1) + ' mm 차이 · ' + who));
});
