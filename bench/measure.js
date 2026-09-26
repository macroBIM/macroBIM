/*  bench/measure.js — 0단계. 실제 단면(S15)을 돌려 논문의 크기를 잰다.
 *
 *  재는 것 셋
 *    ① 종료 분류        — 무엇이 안착하고 무엇이 멈추는가
 *    ② 능동 제약 수      — 제약이 하나면 전진으로 충분, 둘 이상이면 최적화가 필요하다
 *    ③ 결정도 D/U/I     — 유일 결정 / 과소 결정 / 과대 제약
 *
 *  판정은 전부 bench/geom.js (순수 기하)로 한다. 엔진 함수를 부르지 않는다.
 *
 *  실행:  node bench/measure.js
 */
'use strict';
const fs = require('fs'), path = require('path');
const { run } = require('./engine');
const G = require('./geom');

const FIX = process.argv[2] || 's15';
const SHEET = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture/' + FIX + '.json'), 'utf8'));

//  측정 전에 고정하는 값들 — 나중에 manifest.json 으로 뺀다
const CFG = {
  TOL_ACTIVE: 1.0,     // 제약이 '능동'이라고 볼 여유 (mm)
  PROBE: [1, 10],      // 결정도 탐침 이동량 (mm)
  S_MIN: 25,           // 순간격 최소 (임시 — 기준에서 가져와야 한다)
  D_CLR: 25,           // 철근-덕트 최소 이격 (duct 행의 clr 이 있으면 그쪽이 이긴다)
  BUDGET: 40000
};

const r = run(SHEET, {}, CFG.BUDGET);
const cov = r.covers || {};
const covMin = Math.min(...Object.values(cov).filter(v => typeof v === 'number' && v > 0));
const ductPolys = (r.ducts || []).map(d => d.pts);
const holePolys = [...r.openings, ...ductPolys];
const polys = [r.outer, ...holePolys];

//  피복은 면마다 다르다 (상면 50 / 외측 40 / 내측 30). 전체 최소값으로 판정하면
//  상면에 붙은 철근이 10mm 더 자유로워 보인다 — 면마다 그 면의 피복으로 본다.
//  벽의 tag 는 solver 의 출력이 아니라 입력 분류이므로 써도 순환논증이 아니다.
const COVER_EDGES = r.walls.map(w => ({
  e: [w.x1, w.y1, w.x2, w.y2],
  c: (typeof cov[w.tag] === 'number' && cov[w.tag] > 0) ? cov[w.tag] : covMin
}));

//  그 철근에 실제로 걸리는 피복 여유 = min over 벽 (표면거리 − 그 벽의 피복)
function coverSlack(pts, dia) {
  const half = dia / 2, ls = G.lineEdges(pts);
  let worst = Infinity, at = null, dmin = Infinity;
  COVER_EDGES.forEach(w => {
    let d = Infinity;
    ls.forEach(s => {
      const v = G.segSegDist(s[0], s[1], s[2], s[3], w.e[0], w.e[1], w.e[2], w.e[3]);
      if (v < d) d = v;
    });
    const slack = (d - half) - w.c;
    if (slack < worst) { worst = slack; at = w.c; dmin = d - half; }
  });
  return { slack: worst, cover: at, clear: dmin };
}

//  겹이음인가 — 두 철근이 나란히 겹쳐 붙어 있으면 간섭이 아니라 설계된 이음이다.
//  (2D 단면에서는 이음 두 가닥이 같은 자리에 겹쳐 보인다)
function lapLength(a, b, ha, hb, step = 5) {
  const near = ha + hb + 3;
  let L = 0;
  G.lineEdges(a).forEach(([ax, ay, bx, by]) => {
    const len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      let d = Infinity;
      G.lineEdges(b).forEach(s => {
        const v = G.ptSegDist(x, y, s[0], s[1], s[2], s[3]);
        if (v < d) d = v;
      });
      if (d < near) L += len / n;
    }
  });
  return L;
}
const LAP_MIN = 100;    // 이만큼 이상 나란히 겹쳐 있으면 이음으로 본다

console.log('=== 단면 =========================================');
console.log('  종료      :', r.outcome, '· 스텝', r.steps, '· 큐', r.done + '/' + r.queued);
console.log('  피복      :', JSON.stringify(cov), '→ 최소', covMin);
console.log('  덕트      :', (r.ducts||[]).length, '개');
console.log('  외곽 점   :', r.outer.length, '· 개구부', r.openings.length,
            r.openings.map(o => o.length + '점').join(','));
console.log('  벽        :', r.walls.length);
if (r.badRows.length) console.log('  못 만든 행:', r.badRows.join(', '));

//  철근의 표면 기준 여유 = 중심선 거리 − 지름/2
const bars = r.bars.filter(b => b.pts.length >= 2 && b.finite);

//  ── 판정 ────────────────────────────────────────────────
function judge(b, others) {
  const half = (b.dia || 0) / 2;
  const si = G.selfIntersects(b.pts);
  const os = G.outsideLength(b.pts, r.outer, holePolys);
  const cs = coverSlack(b.pts, b.dia);
  //  겹이음은 간섭이 아니다 — 나란히 겹친 구간이 길면 이음으로 보고 뺀다
  let clearR = Infinity, near = null, laps = [];
  others.forEach(o => {
    const oh = (o.dia || 0) / 2;
    if (lapLength(b.pts, o.pts, half, oh) > LAP_MIN) { laps.push(o.id); return; }
    const d = G.minDistLines(b.pts, o.pts) - half - oh;
    if (d < clearR) { clearR = d; near = o.id; }
  });
  //  덕트와의 여유는 따로 본다 (요구 이격이 피복과 다르다)
  let clearD = Infinity, nearD = null;
  (r.ducts || []).forEach(d => {
    const v = G.minDistLines(b.pts, d.pts) - half;
    if (v < clearD) { clearD = v; nearD = d.id; }
  });
  return { si, os, coverClear: cs.clear, coverSlack: cs.slack, coverUsed: cs.cover,
           barClear: clearR, nearBar: near, laps, ductClear: clearD, nearDuct: nearD };
}

//  능동 제약 = 여유가 목표값에 TOL 이내로 붙어 있는 것
//  능동 제약 = 여유가 0 에 붙어 있는 것 (하한이 곧 목표라, 최적해에서는 대부분 능동이다)
function activeSet(j) {
  const a = [];
  if (Math.abs(j.coverSlack) <= CFG.TOL_ACTIVE) a.push('cover:' + j.coverUsed);
  if (isFinite(j.barClear) && Math.abs(j.barClear - CFG.S_MIN) <= CFG.TOL_ACTIVE) a.push('spacing');
  if (isFinite(j.barClear) && j.barClear <= CFG.TOL_ACTIVE) a.push('contact');
  if (isFinite(j.ductClear) && j.ductClear <= CFG.D_CLR + CFG.TOL_ACTIVE) a.push('duct');
  return a;
}

//  실행가능한가 (하드 제약만)
function feasible(pts, dia, others) {
  const half = dia / 2;
  if (G.outsideLength(pts, r.outer, holePolys).outside > 1) return false;
  if (coverSlack(pts, dia).slack < -0.5) return false;
  for (const d of (r.ducts || []))
    if (G.minDistLines(pts, d.pts) - half < (d.clr || CFG.D_CLR) - 0.5) return false;
  for (const o of others) {
    const oh = (o.dia || 0) / 2;
    if (lapLength(pts, o.pts, half, oh) > LAP_MIN) continue;      // 이음은 간섭이 아니다
    if (G.minDistLines(pts, o.pts) - half - oh < CFG.S_MIN - 0.5) return false;
  }
  return true;
}

//  결정도 — 네 방향(±법선 ±접선)으로 밀어 보고 실행가능이 남는지
function determinacy(b, others) {
  //  가장 긴 세그먼트를 접선으로 본다
  let best = 0, ux = 1, uy = 0;
  for (let i = 0; i + 1 < b.pts.length; i++) {
    const dx = b.pts[i + 1][0] - b.pts[i][0], dy = b.pts[i + 1][1] - b.pts[i][1];
    const L = Math.hypot(dx, dy);
    if (L > best) { best = L; ux = dx / L; uy = dy / L; }
  }
  const dirs = [[ux, uy], [-ux, -uy], [-uy, ux], [uy, -ux]];
  const out = {};
  CFG.PROBE.forEach(d => {
    out[d] = dirs.map(([vx, vy]) =>
      feasible(b.pts.map(p => [p[0] + vx * d, p[1] + vy * d]), b.dia, others) ? 1 : 0);
  });
  const here = feasible(b.pts, b.dia, others);
  const free1 = out[CFG.PROBE[0]].reduce((a, v) => a + v, 0);
  return { here, free1, probe: out };
}

console.log('\n=== 철근 =========================================');
const hdr = ['id', 'dia', 'state', 'len', '피복여유/기준', '철근여유', '덕트여유', '능동제약', '결정도'];
console.log('  ' + hdr.join(' | '));
const tally = { D: 0, U: 0, I: 0 };
const act = {};

bars.forEach(b => {
  const others = bars.filter(o => o.id !== b.id);
  const j = judge(b, others);
  const A = activeSet(j);
  const det = determinacy(b, others);
  let cls;
  if (!det.here) cls = 'I';                   // 지금 자리가 이미 실행불가 — 과대 제약
  else if (det.free1 === 0) cls = 'D';        // 1mm 도 못 움직임 — 유일 결정
  else cls = 'U';                             // 움직일 자리가 있음 — 과소 결정
  tally[cls]++;
  act[A.length] = (act[A.length] || 0) + 1;

  console.log('  ' + [
    b.id.padEnd(5), String(b.dia).padStart(3), (b.state || '?').padEnd(9),
    b.len.toFixed(0).padStart(6),
    (j.coverClear.toFixed(1) + '/' + j.coverUsed).padStart(9),
    (isFinite(j.barClear) ? j.barClear.toFixed(1) + '(' + j.nearBar + ')' : '-').padStart(12),
    (isFinite(j.ductClear) ? j.ductClear.toFixed(1) + '(' + j.nearDuct + ')' : '-').padStart(12),
    (A.join('+') || '-').padEnd(14),
    cls + ' [' + det.probe[CFG.PROBE[0]].join('') + '/' + det.probe[CFG.PROBE[1]].join('') + ']'
  ].join(' | '));
  if (j.si) console.log('        ! 자기교차 변 ' + j.si.join('-'));
  if (j.os.outside > 1) console.log('        ! 콘크리트 밖 ' + j.os.outside.toFixed(0) +
                                    ' / ' + j.os.total.toFixed(0) + ' mm');
});

const n = bars.length || 1;
console.log('\n=== 결정도 =======================================');
console.log('  D 유일결정 ' + tally.D + '  U 과소결정 ' + tally.U + '  I 과대제약 ' + tally.I +
            '   →  (U+I)/전체 = ' + (((tally.U + tally.I) / n) * 100).toFixed(0) + '%');
console.log('  능동 제약 수 분포 :', JSON.stringify(act));
console.log('  탐침 표기 [1mm/10mm], 순서 = +접선 −접선 +법선 −법선, 1=실행가능');
