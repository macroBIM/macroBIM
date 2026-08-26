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
    if (cf.k === 'R_A' || cf.k === 'R_fix') got = s.R_A;
    else if (cf.k === 'R_B' || cf.k === 'R_pin') got = s.R_B;   // Vj 도 위쪽(국부 +y)이 양이다
    else if (cf.k === 'M_A' || cf.k === 'M_fix') got = -s.M_A;
    else if (cf.k === 'M_B') got = -s.M_B;
    else if (cf.k === 'M_C') got = d.M[Math.floor(d.M.length / 2)];
    else if (cf.k === 'M_max' || cf.k === 'M_max⁺') got = d.Mx.max.v;
    else if (cf.k === 'δ_max') got = -d.yx.abs.v;
    else if (cf.k === 'δ_P') got = -d.y[d.x.findIndex(x => x >= PSET.a - 1e-9)];
    else if (cf.k === 'θ_A') got = Math.abs(d.thetaI);
    else if (cf.k === 'θ_B' || cf.k === 'θ_free') got = Math.abs(d.thetaJ);
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

/* ── ④ 고정단 좌우 반전 ↔ 실제로 뒤집은 모델 ──────────────────────
   거울이 표시만 바꾼 게 아니라 진짜 그 구조인지 확인한다. 뒤집은 결과를
   지점과 하중을 물리적으로 반대로 놓은 모멘트분배 모델(=직접강성법으로
   이미 검증된 경로)과 맞춘다. */
console.log('④ 고정단 좌우 반전 ↔ 물리적으로 뒤집은 모델');
const FLIPSUP = { cant: ['free', 'fix'], pf: ['roller', 'fix'] };
B.Formula.cases.filter(c => B.Formula.canFlip(c.id)).forEach(c => {
  const r = B.Formula.solve(c.id, Object.assign({ flip: true }, PSET));
  const local = r.loads.map(l => Object.assign({}, l, { dir: 'local' }));
  const model = B.Cross.beam([{ L: PSET.L, EI: PSET.EI, loads: local }], FLIPSUP[c.sup]);
  const x = B.Cross.solve(model), sp = x.spans.AB;
  const sc = Math.max(Math.abs(r.diag.Mx.abs.v), 1e-6);
  okAbs(c.id + ' (flip) · M_i', x.moments.AB.i / sc, r.Mi / sc, 1e-8);
  okAbs(c.id + ' (flip) · M_j', x.moments.AB.j / sc, r.Mj / sc, 1e-8);
  okAbs(c.id + ' (flip) · V_i', sp.Vi / sc, r.diag.Vi / sc, 1e-8);
  const ds = Math.max(Math.abs(r.diag.yx.abs.v), 1e-12);
  okAbs(c.id + ' (flip) · δ_max', sp.yx.abs.v / ds, r.diag.yx.abs.v / ds, 1e-5);
  // 대칭이 아닌 값도 짚는다: 처짐 곡선 전체
  let worst = 0;
  for (let k = 0; k < sp.x.length; k++) worst = Math.max(worst, Math.abs(sp.y[k] - r.diag.y[k]) / ds);
  okAbs(c.id + ' (flip) · y(x) 전체', worst, 0, 1e-5);
});

/* ── ⑤ 여러 개·부분 재하 하중 ↔ 직접강성법으로 검증된 경로 ────────
   표준 경우 하나가 아니라 하중을 겹쳐 넣을 수 있게 열었다. 겹친 결과가
   맞는지는 모멘트분배법(=직접강성법 기준해와 이미 대조된 경로)에 같은 문제를
   주고 맞춰 본다. 부분 등분포, 여러 개, 고정단 좌/우까지 돈다. */
console.log('⑤ 다중·부분재하 하중 ↔ 모멘트분배법');
const LSETS = [
  { n: '전지간 등분포', ld: [{ type: 'w', w: 25, a: 0, b: 7.5 }] },
  { n: '부분 등분포', ld: [{ type: 'w', w: 18, a: 1.5, b: 4 }] },
  { n: '등분포 + 집중', ld: [{ type: 'w', w: 12, a: 0, b: 7.5 }, { type: 'P', P: 40, a: 2.6 }] },
  { n: '집중 3개', ld: [{ type: 'P', P: 30, a: 1.5 }, { type: 'P', P: 55, a: 3.9 }, { type: 'P', P: 20, a: 6.2 }] },
  { n: '등분포 2구간 + 집중', ld: [{ type: 'w', w: 22, a: 0, b: 3 }, { type: 'w', w: 9, a: 4.2, b: 3.3 }, { type: 'P', P: 48, a: 3.6 }] },
  { n: '단부 집중 + 부분등분포', ld: [{ type: 'P', P: 35, a: 7.5 }, { type: 'w', w: 14, a: 0, b: 2.5 }] }
];
const SUPMODEL = { ff: ['fix', 'fix'], cant: ['fix', 'free'], cantR: ['free', 'fix'] };
const LL = 7.5, EE = 21000;
LSETS.forEach(set => {
  ['ff', 'cant', 'cantR'].forEach(mode => {
    const sup = (mode === 'ff') ? 'ff' : 'cant', flip = (mode === 'cantR');
    let r;
    try { r = B.Formula.solveLoads({ sup: sup, flip: flip, L: LL, EI: EE, loads: set.ld }); }
    catch (e) { fail++; console.log(`  FAIL  ${set.n} / ${mode}: ${e.message}`); return; }
    const local = r.loads.map(l => Object.assign({}, l, { dir: 'local' }));
    const model = B.Cross.beam([{ L: LL, EI: EE, loads: local }], SUPMODEL[mode]);
    const x = B.Cross.solve(model), sp = x.spans.AB;
    const sc = Math.max(Math.abs(r.diag.Mx.abs.v), 1e-6);
    const ds = Math.max(Math.abs(r.diag.yx.abs.v), 1e-12);
    const tag = `${set.n} / ${mode}`;
    okAbs(`${tag} · M_i`, x.moments.AB.i / sc, r.Mi / sc, 1e-8);
    okAbs(`${tag} · M_j`, x.moments.AB.j / sc, r.Mj / sc, 1e-8);
    okAbs(`${tag} · V_i`, sp.Vi / sc, r.diag.Vi / sc, 1e-8);
    let wM = 0, wY = 0;
    for (let k = 0; k < sp.x.length; k++) {
      wM = Math.max(wM, Math.abs(sp.M[k] - r.diag.M[k]) / sc);
      wY = Math.max(wY, Math.abs(sp.y[k] - r.diag.y[k]) / ds);
    }
    okAbs(`${tag} · M(x) 전체`, wM, 0, 1e-7);
    okAbs(`${tag} · y(x) 전체`, wY, 0, 1e-5);
    // 정역학: 반력의 합 = 전체 하중
    const W = set.ld.reduce((a, l) => a + (l.type === 'w' ? l.w * l.b : l.P), 0);
    okAbs(`${tag} · ΣR = ΣW`, (r.diag.Vi + r.diag.Vj) / W, 1, 1e-9);
  });
});

/* 표준 경우와 겹치면 옛 경로와 값이 같아야 한다 */
console.log('⑥ solveLoads ↔ solve (표준 경우가 걸릴 때)');
[['ff', [{ type: 'w', w: 25, a: 0, b: 7.5 }], 'ff-udl', { w: 25 }],
 ['ff', [{ type: 'P', P: 60, a: 3.75 }], 'ff-pmid', { P: 60 }],
 ['ff', [{ type: 'P', P: 60, a: 2.9 }], 'ff-pa', { P: 60, a: 2.9 }],
 ['cant', [{ type: 'w', w: 25, a: 0, b: 7.5 }], 'cant-udl', { w: 25 }],
 ['cant', [{ type: 'P', P: 60, a: 7.5 }], 'cant-pend', { P: 60 }],
 ['cant', [{ type: 'P', P: 60, a: 2.9 }], 'cant-pa', { P: 60, a: 2.9 }]
].forEach(([sup, ld, want, extra]) => {
  const a = B.Formula.solveLoads({ sup, flip: false, L: LL, EI: EE, loads: ld });
  const b = B.Formula.solve(want, Object.assign({ L: LL, EI: EE }, extra));
  ok(`${want} · 경우 인식`, a.matched === want ? 1 : 0, 1, 0);
  const sc = Math.max(Math.abs(b.diag.Mx.abs.v), 1e-6);
  okAbs(`${want} · M_i`, a.Mi / sc, b.Mi / sc, 1e-12);
  okAbs(`${want} · δ_max`, a.diag.yx.abs.v / b.diag.yx.abs.v, 1, 1e-12);
  okAbs(`${want} · 공식 개수`, a.closed.length, b.closed.length, 0);
});

/* ── ⑦ 중첩 ────────────────────────────────────────────────────────
   결과창에서 하중을 하나씩 떼어 볼 수 있게 했다. 그 화면이 뜻을 가지려면
   각 하중의 기여를 더한 것이 전체와 같아야 한다 — 선형탄성이므로 정확히
   같아야 하고, 조금이라도 어긋나면 떼어 본 그림이 거짓말이 된다. */
console.log('⑦ 하중별 기여의 합 ↔ 전체');
LSETS.filter(s2 => s2.ld.length > 1).forEach(set => {
  ['ff', 'cant', 'cantR'].forEach(mode => {
    const sup = (mode === 'ff') ? 'ff' : 'cant', flip = (mode === 'cantR');
    const all = B.Formula.solveLoads({ sup, flip, L: LL, EI: EE, loads: set.ld });
    const parts = set.ld.map(l => B.Formula.solveLoads({ sup, flip, L: LL, EI: EE, loads: [l] }));
    const sc = Math.max(Math.abs(all.diag.Mx.abs.v), 1e-6);
    const ds = Math.max(Math.abs(all.diag.yx.abs.v), 1e-12);
    const tag = `${set.n} / ${mode}`;
    okAbs(`${tag} · ΣM_i`, parts.reduce((a, p) => a + p.Mi, 0) / sc, all.Mi / sc, 1e-10);
    okAbs(`${tag} · ΣM_j`, parts.reduce((a, p) => a + p.Mj, 0) / sc, all.Mj / sc, 1e-10);
    okAbs(`${tag} · ΣV_i`, parts.reduce((a, p) => a + p.diag.Vi, 0) / sc, all.diag.Vi / sc, 1e-10);
    // 곡선 전체도 더해져야 한다. 격자는 하중 위치에서 끊기므로 부재마다 다르다 —
    // 공통 좌표에서 선형보간해 비교한다.
    const at = (d, x) => {
      let k = 1;
      while (k < d.x.length - 1 && d.x[k] < x) k++;
      const x0 = d.x[k - 1], x1 = d.x[k], t = (x1 - x0) < 1e-12 ? 0 : (x - x0) / (x1 - x0);
      return { M: d.M[k - 1] + (d.M[k] - d.M[k - 1]) * t, y: d.y[k - 1] + (d.y[k] - d.y[k - 1]) * t };
    };
    let wM = 0, wY = 0;
    for (let i = 0; i <= 40; i++) {
      const x = LL * i / 40;
      const a = at(all.diag, x);
      const p = parts.reduce((acc, q) => { const v = at(q.diag, x); return { M: acc.M + v.M, y: acc.y + v.y }; }, { M: 0, y: 0 });
      wM = Math.max(wM, Math.abs(p.M - a.M) / sc);
      wY = Math.max(wY, Math.abs(p.y - a.y) / ds);
    }
    okAbs(`${tag} · ΣM(x)`, wM, 0, 2e-4);      // 선형보간 오차가 섞여 있다
    okAbs(`${tag} · Σy(x)`, wY, 0, 2e-4);
  });
});

console.log(`\n${run - fail}/${run} 통과${fail ? `  —  ${fail} 실패` : ''}`);
process.exit(fail ? 1 : 0);
