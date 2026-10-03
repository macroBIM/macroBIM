/*  bench/jjac.js — jfield.js 의 **해석 야코비가 맞는지** 수치미분으로 검산한다.
 *
 *  푸는 데는 해석 야코비(JField.residuals)만 쓴다. 그런데 J 에 항을 하나 더할 때
 *  야코비를 같이 안 고치면 **조용히 틀린다** — 답이 이상해지는 게 아니라 조금
 *  덜 수렴할 뿐이라 눈치채기 어렵다. 그래서 항을 건드릴 때마다 이것을 돌린다.
 *
 *  비교 대상 :  ∂J/∂x  (해석 : 2·Aᵀr)   vs   중심차분 (JField.grad)
 *  실행 :  node bench/jjac.js
 */
'use strict';
const fs = require('fs'), path = require('path');
const { prepare } = require('./jengine');
const JField = require('../jfield');

const fix = f => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture', f + '.json'), 'utf8'));
const D = prepare(fix('s14'), {}, 'box');
const sec = { covers: D.covers };

//  자세를 조금 흔들어서 **제약이 살아 있는 자리**에서 재야 의미가 있다
const JITTER = [[0, 0, 0], [37, -21, 0.03], [-64, 15, -0.05], [8, 44, 0.11]];

/*  꺾인 자리에서는 중심차분 자체가 못 쓴다.
    피복항은 g<0 쪽 무게가 K_COV 라 g=0 에서 2계도함수가 튀고, 덕트·철근항은
    g=0 에서 켜지고 꺼진다. 그런 점을 h 폭으로 가로지르면 중심차분이 O(K·h) 의
    가짜 값을 낸다 — 해석 야코비가 맞아도 「틀렸다」고 나온다.
    그래서 **어느 항도 꺾임에서 BAND 보다 가깝지 않은 자세**에서만 비교한다.

    꺾임은 두 군데다. g=0 (항이 켜지고 꺼지는 자리)과 **d=0** (장애물이 조각
    위에 정확히 선 자리) 이다. 후자에서는 |·| 가 미분 불가라 중심차분이 아예
    없는 값을 낸다 — 해석 쪽은 거기서 **열거분(subgradient)** 으로 −n0 를 쓴다
    (`jfield.js` clearRow). 둘 다 BAND 밖에서만 잰다.                        */
const BAND = 1.0;
function kinkDist(pose, seg, cons, ducts, placed, lpts, assign) {
  const half = seg.len / 2;
  const dx = Math.cos(pose.th) * half, dy = Math.sin(pose.th) * half;
  const pts = [{ x: pose.cx - dx, y: pose.cy - dy }, { x: pose.cx + dx, y: pose.cy + dy }];
  let m = Infinity;
  pts.forEach((p, i) => {
    const c = cons[assign[i]];
    if (c) m = Math.min(m, Math.abs(JField.slack(p.x, p.y, c)));
  });
  (ducts || []).forEach(d => {
    const need = d.D / 2 + (d.clr != null ? d.clr : 30) + seg.dia / 2;
    const dd = JField.segToPoint(pts, d);
    m = Math.min(m, Math.abs(dd - need), dd);
  });
  (placed || []).forEach(q => {
    const need = (q.dia + seg.dia) / 2;
    JField.clearPairs(pts, q.p1, q.p2).forEach(n => { m = Math.min(m, Math.abs(n.d - need), n.d); });
  });
  (lpts || []).forEach(q => {
    const dd = JField.segToPoint(pts, q);
    m = Math.min(m, Math.abs(dd - JField.lreNeed(q, seg.dia)), dd);
  });
  return m;
}

let worst = 0, worstAt = '', n = 0, skipped = 0;
const placed = [];

D.bars.forEach(bar => {
  const segs = bar.segs.map(s => {
    const vx = s.p2.x - s.p1.x, vy = s.p2.y - s.p1.y;
    const th = Math.atan2(vy, vx);
    return {
      label: s.label, len: Math.hypot(vx, vy) || 1, dia: bar.dia, n0: s.normal,
      p1: s.p1, p2: s.p2, th0: th,
      mid: { x: (s.p1.x + s.p2.x) / 2, y: (s.p1.y + s.p2.y) / 2 },
      c0: { x: (s.p1.x + s.p2.x) / 2, y: (s.p1.y + s.p2.y) / 2 }
    };
  });

  segs.forEach(sg => {
    const cons = JField.targets(sg, D.walls, sec, sg.dia);
    if (!cons.length) return;
    //  실제로 푼 자리 근처에서 본다
    const r = JField.settle(sg, D.walls, sec, D.ducts, placed, []);
    const half = sg.len / 2;

    /*  **종방향 철근 항(④)도 검산에 들어가게** 한 점을 일부러 겹쳐 놓는다.
        앉은 자리에서 법선 쪽으로 need−8 만큼 떨어뜨리면 g = −8 이라 항이 켜지고,
        꺾임(g=0)에서도 BAND 보다 멀다. 이 점은 **검산용**이지 배근이 아니다 —
        자리는 위에서 종방향 없이(`[]`) 이미 잡았다.                            */
    const lneed = JField.lreNeed({ dia: 13 }, sg.dia);
    const lpts = [{ x: r.pose.cx + sg.n0.x * (lneed - 8),
                    y: r.pose.cy + sg.n0.y * (lneed - 8), dia: 13 }];

    JITTER.forEach(j => {
      const pose = { cx: r.pose.cx + j[0], cy: r.pose.cy + j[1], th: r.pose.th + j[2] };
      const assign = JField.assignOf(pose, sg, cons);
      if (kinkDist(pose, sg, cons, D.ducts, placed, lpts, assign) < BAND) { skipped++; return; }

      //  해석 : ∂J/∂x = 2·Aᵀr   (J = Σ rₖ²)
      const rows = JField.residuals(pose, sg, cons, D.ducts, placed, lpts, assign);
      const ga = [0, 0, 0];
      rows.forEach(rw => { for (let a = 0; a < 3; a++) ga[a] += 2 * rw.j[a] * rw.r; });

      //  수치 : 중심차분 (grad 는 ∂J/∂cx, ∂J/∂cy, ∂J/∂호길이 를 돌려준다)
      const gn = JField.grad(pose, sg, cons, D.ducts, placed, lpts, assign);
      const num = [gn.cx, gn.cy, gn.th];

      for (let a = 0; a < 3; a++) {
        const den = Math.max(1, Math.abs(num[a]), Math.abs(ga[a]));
        const rel = Math.abs(ga[a] - num[a]) / den;
        n++;
        if (rel > worst) { worst = rel; worstAt = bar.id + '.' + sg.label + ' [' + 'cx,cy,φ'.split(',')[a] + ']'; }
      }
    });
  });

  //  다음 철근이 보도록 이 철근을 놓는다 (척력항도 검산에 들어가게)
  const done = JField.form(bar, D.walls, sec, D.ducts, placed, []);
  for (let i = 0; i + 1 < done.pts.length; i++)
    placed.push({ p1: done.pts[i], p2: done.pts[i + 1], dia: bar.dia });
});

console.log('해석 야코비 vs 중심차분 — 표본 ' + n + '개 (꺾임 근처 ' + skipped + '자세 제외)');
console.log('  최대 상대오차 ' + worst.toExponential(2) + (worstAt ? '  (' + worstAt + ')' : ''));
//  중심차분은 꺾인 항(g=0)에서 O(h) 의 오차를 내므로 1e-3 을 넘지 않으면 맞는 것으로 본다
console.log(worst < 1e-3 ? '  → 야코비 일치' : '  → ✗ 어긋난다. J 에 더한 항의 미분을 확인할 것');
process.exit(worst < 1e-3 ? 0 : 1);
