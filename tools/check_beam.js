/* check_beam.js — 두 방법이 맞는지, 셋을 서로 대조해서 확인한다.

   ① 처짐공식표 ↔ 그 경우를 정역학+적분으로 푼 곡선
        교과서 식을 옮겨 적다 틀리면 여기서 걸린다.
   ② 처짐공식법 ↔ 모멘트분배법 (같은 단경간 문제)
        서로 다른 경로로 같은 답이 나와야 한다.
   ③ 모멘트분배법 ↔ 직접강성법 기준해 (tools/beam_ref.js)
        연속보·내민보·라멘·측방변위까지.

     node tools/check_beam.js

   맞지 않으면 0 이 아닌 값으로 끝나므로 커밋 게이트로 쓸 수 있다.        */
'use strict';
const B = require('../beam_engine.js');
const REF = require('./beam_ref.js');

let fail = 0, run = 0;
const F = n => (Math.abs(n) < 1e-9 ? '0' : n.toPrecision(8));

function ok(name, got, want, tol, extra) {
  run++;
  const sc = Math.max(Math.abs(want), 1e-9);
  const err = Math.abs(got - want) / sc;
  if (!(err <= tol)) {
    fail++;
    console.log(`  FAIL  ${name}\n        got ${F(got)}  want ${F(want)}  rel ${err.toExponential(2)} > ${tol}${extra ? '\n        ' + extra : ''}`);
  }
  return err <= tol;
}

/* 이미 모델 전체 크기로 나눠 둔 값끼리는 절대차로 본다 — 0 에 가까운 값을
   자기 자신으로 다시 나누면 의미 없는 실패가 난다. */
function okAbs(name, got, want, tol) {
  run++;
  if (!(Math.abs(got - want) <= tol)) {
    fail++;
    console.log(`  FAIL  ${name}\n        got ${F(got)}  want ${F(want)}  diff ${Math.abs(got - want).toExponential(2)} > ${tol}`);
  }
}

/* ── ① 공식표 ↔ 곡선 ─────────────────────────────────────────────── */
console.log('① 처짐공식표 ↔ 정역학+적분 곡선');
const PSET = { L: 7.5, EI: 21000, w: 13.5, P: 62, M0: 48, a: 2.9 };
B.Formula.cases.forEach(c => {
  const r = B.Formula.solve(c.id, PSET);
  const s = r.summary, d = r.diag;
  c.closed.forEach(cf => {
    const v = cf.f(r.params), tol = cf.tol || 2e-5;
    let got = null, label = `${c.id} · ${cf.k}`;
    if (cf.k === 'R_A') got = s.R_A;
    else if (cf.k === 'R_B') got = s.R_B;   // Vj 도 위쪽(국부 +y)이 양이다
    else if (cf.k === 'M_A') got = -s.M_A;
    else if (cf.k === 'M_B') got = -s.M_B;
    else if (cf.k === 'M_C') got = d.M[Math.floor(d.M.length / 2)];
    else if (cf.k === 'M_max' || cf.k === 'M_max⁺') got = d.Mx.max.v;
    else if (cf.k === 'δ_max') got = -d.yx.abs.v;
    else if (cf.k === 'δ_P') got = -d.y[d.x.findIndex(x => x >= PSET.a - 1e-9)];
    else if (cf.k === 'θ_A') got = Math.abs(d.thetaI);
    else if (cf.k === 'θ_B') got = Math.abs(d.thetaJ);
    if (got === null) return;
    ok(label + `  [${cf.tex}]`, got, v, tol);
  });
  // 고정단은 회전각이 0 이어야 한다 — 단부모멘트가 맞는지에 대한 독립 확인
  const scale = Math.abs(PSET.w * PSET.L ** 3 / PSET.EI);
  if (c.sup === 'ff') { okAbs(c.id + ' · θ_A = 0', d.thetaI / scale, 0, 1e-9); okAbs(c.id + ' · θ_B = 0', d.thetaJ / scale, 0, 1e-9); }
  if (c.sup === 'pf' || c.sup === 'cant') okAbs(c.id + ' · θ_A = 0', d.thetaI / scale, 0, 1e-9);
});

/* ── ② 처짐공식법 ↔ 모멘트분배법 ────────────────────────────────── */
console.log('② 처짐공식법 ↔ 모멘트분배법 (같은 단경간)');
const SUPMAP = { ss: ['pin', 'roller'], cant: ['fix', 'free'], ff: ['fix', 'fix'], pf: ['fix', 'roller'] };
B.Formula.cases.forEach(c => {
  const r = B.Formula.solve(c.id, PSET);
  // Formula 가 만든 하중은 이미 국부 +y 성분이다 — 'grav' 로 두면 한 번 더 뒤집힌다
  const local = r.loads.map(l => Object.assign({}, l, { dir: 'local' }));
  const model = B.Cross.beam([{ L: PSET.L, EI: PSET.EI, loads: local }], SUPMAP[c.sup]);
  const x = B.Cross.solve(model);
  const sp = x.spans.AB, sc = Math.max(Math.abs(r.diag.Mx.abs.v), 1e-6);
  okAbs(c.id + ' · M_i', x.moments.AB.i / sc, r.Mi / sc, 1e-8);
  okAbs(c.id + ' · M_j', x.moments.AB.j / sc, r.Mj / sc, 1e-8);
  okAbs(c.id + ' · δ_max', sp.yx.abs.v / Math.abs(r.diag.yx.abs.v || 1), r.diag.yx.abs.v / Math.abs(r.diag.yx.abs.v || 1), 1e-6);
});

/* ── ③ 모멘트분배법 ↔ 직접강성법 기준해 ────────────────────────── */
console.log('③ 모멘트분배법 ↔ 직접강성법 기준해');
const W = w => [{ type: 'w', w1: w }];
const MODELS = {
  '단순보': B.Cross.beam([{ L: 9, EI: 1, loads: W(14) }], ['pin', 'roller']),
  '캔틸레버': B.Cross.beam([{ L: 6, EI: 1, loads: W(8) }], ['fix', 'free']),
  '양단고정': B.Cross.beam([{ L: 9, EI: 1, loads: W(14) }], ['fix', 'fix']),
  '1단고정 타단힌지': B.Cross.beam([{ L: 9, EI: 1, loads: W(14) }], ['fix', 'roller']),
  '2경간(EI·L 다름)': B.Cross.beam([{ L: 8, EI: 2, loads: W(12) }, { L: 6, EI: 1, loads: [{ type: 'P', P: 40, a: 3 }] }], ['pin', 'roller', 'fix']),
  '3경간 등간': B.Cross.beam([{ L: 10, EI: 1, loads: W(10) }, { L: 10, EI: 1, loads: W(10) }, { L: 10, EI: 1, loads: W(10) }], ['pin', 'roller', 'roller', 'roller']),
  '4경간+부분등분포': B.Cross.beam([
      { L: 8, EI: 1, loads: [{ type: 'w', w1: 20, a: 2, b: 6 }] },
      { L: 6, EI: 1.4, loads: W(11) },
      { L: 7, EI: 1, loads: [{ type: 'w', w1: 0, w2: 24 }] },
      { L: 5, EI: 0.8, loads: [{ type: 'M', M: 35, a: 2 }] }], ['fix', 'roller', 'roller', 'roller', 'pin']),
  '내민보(양쪽)': {
    nodes: [{ id: 'A', x: 0, y: 0, sup: 'free' }, { id: 'B', x: 2, y: 0, sup: 'pin' },
            { id: 'C', x: 10, y: 0, sup: 'roller' }, { id: 'D', x: 12.5, y: 0, sup: 'free' }],
    members: [{ id: 'AB', i: 'A', j: 'B', EI: 1, loads: W(15) },
              { id: 'BC', i: 'B', j: 'C', EI: 1, loads: [{ type: 'w', w1: 15 }, { type: 'P', P: 30, a: 5 }] },
              { id: 'CD', i: 'C', j: 'D', EI: 1, loads: W(15) }] },
  '절점모멘트 있는 연속보': B.Cross.beam([{ L: 7, EI: 1, loads: W(9) }, { L: 7, EI: 1, loads: W(9) }],
      ['fix', 'roller', 'roller'], { nodeLoads: { C: { mz: 40 } } }),
  '라멘(수평 구속)': {
    nodes: [{ id: 'A', x: 0, y: 0, sup: 'fix' }, { id: 'B', x: 0, y: 4, sup: 'rollerh' },
            { id: 'C', x: 6, y: 4, sup: 'free' }, { id: 'D', x: 6, y: 0, sup: 'fix' }],
    members: [{ id: 'AB', i: 'A', j: 'B', EI: 2 }, { id: 'BC', i: 'B', j: 'C', EI: 3, loads: W(20) },
              { id: 'DC', i: 'D', j: 'C', EI: 2 }] },
  '포탈 라멘(측방변위)': {
    nodes: [{ id: 'A', x: 0, y: 0, sup: 'fix' }, { id: 'B', x: 0, y: 4, sup: 'free', load: { fx: 40 } },
            { id: 'C', x: 6, y: 4, sup: 'free' }, { id: 'D', x: 6, y: 0, sup: 'fix' }],
    members: [{ id: 'AB', i: 'A', j: 'B', EI: 2 }, { id: 'BC', i: 'B', j: 'C', EI: 3, loads: W(20) },
              { id: 'DC', i: 'D', j: 'C', EI: 2 }] },
  '힌지지점 라멘': {
    nodes: [{ id: 'A', x: 0, y: 0, sup: 'pin' }, { id: 'B', x: 0, y: 5, sup: 'free' },
            { id: 'C', x: 8, y: 5, sup: 'free', load: { fx: 25 } }, { id: 'D', x: 8, y: 0, sup: 'pin' }],
    members: [{ id: 'AB', i: 'A', j: 'B', EI: 1 }, { id: 'BC', i: 'B', j: 'C', EI: 2, loads: W(18) },
              { id: 'DC', i: 'D', j: 'C', EI: 1 }] },
  '2층 라멘(측방변위 2)': {
    nodes: [{ id: 'A', x: 0, y: 0, sup: 'fix' }, { id: 'B', x: 0, y: 3.5, sup: 'free', load: { fx: 30 } },
            { id: 'C', x: 0, y: 7, sup: 'free', load: { fx: 20 } }, { id: 'D', x: 6, y: 7, sup: 'free' },
            { id: 'E', x: 6, y: 3.5, sup: 'free' }, { id: 'F', x: 6, y: 0, sup: 'fix' }],
    members: [{ id: 'AB', i: 'A', j: 'B', EI: 2 }, { id: 'BC', i: 'B', j: 'C', EI: 1.5 },
              { id: 'CD', i: 'C', j: 'D', EI: 2, loads: W(14) }, { id: 'ED', i: 'E', j: 'D', EI: 1.5 },
              { id: 'FE', i: 'F', j: 'E', EI: 2 }, { id: 'BE', i: 'B', j: 'E', EI: 2.5, loads: W(18) }] },
  '박공 라멘(경사부재)': {
    nodes: [{ id: 'A', x: 0, y: 0, sup: 'pin' }, { id: 'B', x: 0, y: 4, sup: 'free' },
            { id: 'C', x: 5, y: 6, sup: 'free' }, { id: 'D', x: 10, y: 4, sup: 'free' },
            { id: 'E', x: 10, y: 0, sup: 'pin' }],
    members: [{ id: 'AB', i: 'A', j: 'B', EI: 1 }, { id: 'BC', i: 'B', j: 'C', EI: 1.2, loads: W(12) },
              { id: 'CD', i: 'C', j: 'D', EI: 1.2, loads: W(12) }, { id: 'ED', i: 'E', j: 'D', EI: 1 }] }
};

Object.keys(MODELS).forEach(name => {
  const model = MODELS[name];
  let a, b;
  try { a = B.Cross.solve(model); b = REF.refSolve(model); }
  catch (e) { fail++; console.log(`  FAIL  ${name}: ${e.message}`); return; }
  let sc = 1e-9;
  Object.keys(a.moments).forEach(k => ['i', 'j'].forEach(e => { sc = Math.max(sc, Math.abs(b.M[k][e])); }));
  Object.keys(a.moments).forEach(k => ['i', 'j'].forEach(e => {
    okAbs(`${name} · M(${k}.${e})`, a.moments[k][e] / sc, b.M[k][e] / sc, 3e-6);
  }));
  let rs = 1e-9;
  Object.keys(a.reactions).forEach(k => ['fx', 'fy', 'mz'].forEach(e => { rs = Math.max(rs, Math.abs(b.R[k][e])); }));
  Object.keys(a.reactions).forEach(k => ['fx', 'fy', 'mz'].forEach(e => {
    okAbs(`${name} · R(${k}.${e})`, a.reactions[k][e] / rs, b.R[k][e] / rs, 3e-6);
  }));
  // 처짐·회전: 절점값을 기준해와 맞춰 본다. 크기 기준은 모델 전체의 최대값
  // 하나로 잡는다 — 부재마다 다시 잡으면 0 에 가까운 값이 자기 자신으로
  // 나뉘어 의미 없는 실패가 난다.
  let vScale = 1e-12, tScale = 1e-12;
  Object.keys(a.spans).forEach(id => {
    const m = a.prep.mById[id], sp = a.spans[id], di = b.disp[m.i.id], dj = b.disp[m.j.id];
    vScale = Math.max(vScale, Math.abs(di.x * m.nx + di.y * m.ny), Math.abs(dj.x * m.nx + dj.y * m.ny),
                      Math.abs(sp.yx.abs.v));      // 지점이 안 움직이는 연속보라도 경간 처짐은 있다
    sp.theta.forEach(v => { tScale = Math.max(tScale, Math.abs(v)); });
    tScale = Math.max(tScale, Math.abs(di.rz), Math.abs(dj.rz));
  });
  Object.keys(a.spans).forEach(id => {
    const m = a.prep.mById[id], sp = a.spans[id];
    const di = b.disp[m.i.id], dj = b.disp[m.j.id];
    okAbs(`${name} · v(${id}.i)`, sp.y[0] / vScale, (di.x * m.nx + di.y * m.ny) / vScale, 1e-5);
    okAbs(`${name} · v(${id}.j)`, sp.y[sp.y.length - 1] / vScale, (dj.x * m.nx + dj.y * m.ny) / vScale, 1e-5);
    okAbs(`${name} · θ(${id}.i)`, sp.theta[0] / tScale, di.rz / tScale, 1e-5);
    okAbs(`${name} · θ(${id}.j)`, sp.theta[sp.theta.length - 1] / tScale, dj.rz / tScale, 1e-5);
  });
});

console.log(`\n${run - fail}/${run} 통과${fail ? `  —  ${fail} 실패` : ''}`);
process.exit(fail ? 1 : 0);
