/* beam_ref.js — 검증 전용 기준해 (직접강성법, 평면 라멘 6자유도 요소)

   beam_engine.js 와 겹치는 코드가 없다. 겹치면 검증이 아니라 자기 확인이
   되기 때문이다. 여기서 나오는 단부모멘트·반력이 모멘트분배법 결과와
   맞는지 tools/check_beam.js 가 대조한다.

   축강성 EA 는 아주 크게 잡는다 — 모멘트분배법은 부재가 축방향으로 늘어나지
   않는다고 보므로, 기준해도 같은 가정 위에 있어야 비교가 성립한다.

   부호는 beam_engine.js 와 같다: 단부모멘트 CCW 양, 국부 y 는 i→j 를
   반시계 90°.                                                            */
'use strict';
const B = require('../beam_engine.js');

function refSolve(model, opt) {
  opt = opt || {};
  const P = B.Cross.prepare(model);
  const N = P.nodes.length, ND = 3 * N;
  const K = Array.from({ length: ND }, () => new Array(ND).fill(0));
  const F = new Array(ND).fill(0);
  const fef = {};

  P.members.forEach(m => {
    const L = m.L, EI = m.EI, EA = (opt.EA || 1e10) * EI / (L * L);
    const c = m.ex, s = m.ey;
    const a = EA / L, b = 12 * EI / (L * L * L), g = 6 * EI / (L * L), d = 4 * EI / L, e = 2 * EI / L;
    const kl = [
      [ a, 0, 0, -a, 0, 0],
      [ 0, b, g, 0, -b, g],
      [ 0, g, d, 0, -g, e],
      [-a, 0, 0, a, 0, 0],
      [ 0, -b, -g, 0, b, -g],
      [ 0, g, e, 0, -g, d]
    ];
    const T = [
      [ c, s, 0, 0, 0, 0], [-s, c, 0, 0, 0, 0], [0, 0, 1, 0, 0, 0],
      [ 0, 0, 0, c, s, 0], [0, 0, 0, -s, c, 0], [0, 0, 0, 0, 0, 1]
    ];
    // kg = Tᵀ kl T
    const kt = [];
    for (let i = 0; i < 6; i++) { kt.push([]); for (let j = 0; j < 6; j++) { let v = 0; for (let k = 0; k < 6; k++) v += kl[i][k] * T[k][j]; kt[i].push(v); } }
    const kg = [];
    for (let i = 0; i < 6; i++) { kg.push([]); for (let j = 0; j < 6; j++) { let v = 0; for (let k = 0; k < 6; k++) v += T[k][i] * kt[k][j]; kg[i].push(v); } }

    // 고정단력 (국부) — 에르미트 형상함수의 등가절점하중을 뒤집은 것
    const ff = fixedEnd(m.loads, L);
    fef[m.id] = ff;
    const flg = [];                                    // 전역으로 돌린 고정단력
    const fl = [0, ff.vi, ff.mi, 0, ff.vj, ff.mj];
    for (let i = 0; i < 6; i++) { let v = 0; for (let k = 0; k < 6; k++) v += T[k][i] * fl[k]; flg.push(v); }

    const dof = [3 * m.i.idx, 3 * m.i.idx + 1, 3 * m.i.idx + 2, 3 * m.j.idx, 3 * m.j.idx + 1, 3 * m.j.idx + 2];
    for (let i = 0; i < 6; i++) {
      F[dof[i]] -= flg[i];                             // K d = P − f^F
      for (let j = 0; j < 6; j++) K[dof[i]][dof[j]] += kg[i][j];
    }
    m._kg = kg; m._T = T; m._kl = kl; m._dof = dof;
  });

  P.nodes.forEach(n => { F[3 * n.idx] += n.fx; F[3 * n.idx + 1] += n.fy; F[3 * n.idx + 2] += n.mz; });

  // 지점: 큰 수 대신 행/열을 지운다 (조건수를 망치지 않게)
  const fixed = [];
  P.nodes.forEach(n => { if (n.cx) fixed.push(3 * n.idx); if (n.cy) fixed.push(3 * n.idx + 1); if (n.crz) fixed.push(3 * n.idx + 2); });
  const free = [];
  for (let i = 0; i < ND; i++) if (fixed.indexOf(i) < 0) free.push(i);
  const A = free.map(r => free.map(c => K[r][c])), rhs = free.map(r => F[r]);
  const x = B.Num.solve(A, rhs);
  if (!x) throw new Error('기준해가 특이합니다 (구조 불안정?)');
  const D = new Array(ND).fill(0);
  free.forEach((r, k) => { D[r] = x[k]; });

  const M = {}, ends = {};
  P.members.forEach(m => {
    const dg = m._dof.map(i => D[i]);
    const dl = [];
    for (let i = 0; i < 6; i++) { let v = 0; for (let k = 0; k < 6; k++) v += m._T[i][k] * dg[k]; dl.push(v); }
    const f = [];
    for (let i = 0; i < 6; i++) { let v = 0; for (let k = 0; k < 6; k++) v += m._kl[i][k] * dl[k]; f.push(v); }
    const ff = fef[m.id];
    f[1] += ff.vi; f[2] += ff.mi; f[4] += ff.vj; f[5] += ff.mj;
    f[0] += 0; f[3] += 0;
    M[m.id] = { i: f[2], j: f[5] };
    ends[m.id] = { Vi: f[1], Vj: f[4], Ni: f[0], Nj: f[3] };
  });

  const R = {};
  P.nodes.forEach(n => {
    if (!n.cx && !n.cy && !n.crz) return;
    let fx = 0, fy = 0, mz = 0;
    n.ends.forEach(en => {
      const m = en.m, e = ends[m.id];
      const V = en.e === 'i' ? e.Vi : e.Vj, Nn = en.e === 'i' ? e.Ni : e.Nj;
      fx += V * m.nx + Nn * m.ex; fy += V * m.ny + Nn * m.ey;
      mz += M[m.id][en.e];
    });
    R[n.id] = { fx: fx - n.fx, fy: fy - n.fy, mz: mz - n.mz };
  });

  const disp = {};
  P.nodes.forEach(n => { disp[n.id] = { x: D[3 * n.idx], y: D[3 * n.idx + 1], rz: D[3 * n.idx + 2] }; });
  return { M, ends, R, disp, prep: P };
}

/* 고정단력 f^F = −∫ q N dx  (모멘트하중이면 −C·N′) */
function fixedEnd(loads, L) {
  const Lo = B.Load;
  let vi = 0, vj = 0, mi = 0, mj = 0;
  (loads || []).forEach(ld0 => {
    const o = Lo.norm(ld0, L);
    if (o.type === 'w') {
      vi -= Lo._iq(o, [1, 0, -3 / (L * L), 2 / (L ** 3)]);
      vj -= Lo._iq(o, [0, 0, 3 / (L * L), -2 / (L ** 3)]);
      mi -= Lo._iq(o, [0, 1, -2 / L, 1 / (L * L)]);   // N2 = L(s−2s²+s³) = x − 2x²/L + x³/L²
      mj -= Lo._iq(o, [0, 0, -1 / L, 1 / (L * L)]);   // N4 = L(−s²+s³)   = −x²/L + x³/L²
    } else if (o.type === 'P') {
      const s = o.a / L;
      vi -= o.P * (1 - 3 * s * s + 2 * s ** 3);
      vj -= o.P * (3 * s * s - 2 * s ** 3);
      mi -= o.P * L * (s - 2 * s * s + s ** 3);
      mj -= o.P * L * (-s * s + s ** 3);
    } else if (o.type === 'M') {
      const s = o.a / L;
      vi -= o.M * 6 * (s * s - s) / L;
      vj -= o.M * 6 * (s - s * s) / L;
      mi -= o.M * (1 - 4 * s + 3 * s * s);
      mj -= o.M * (-2 * s + 3 * s * s);
    }
  });
  return { vi, vj, mi, mj };
}

module.exports = { refSolve, fixedEnd };
