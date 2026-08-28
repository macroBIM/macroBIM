/* check_beam_multi.js — MultiBEAM(연속보)이 내는 값을 폐합식·등가모델과 대조한다.
   배포되는 코드와 같은 길을 쓴다: 엔진이 만든 경간 곡선을 받아 부호만 뒤집는다.
   사본을 검사하면 사본만 맞는다.  실행: node tools/check_beam_multi.js  */
const B = require(require('path').join(__dirname, '..', 'beam_engine.js'));
const w = (L,q) => [{type:'w', w1:-q, w2:-q, a:0, b:L}];
let pass = 0, fail = 0;
const ok = (name, got, want, tol) => {
  const d = Math.abs(got - want);
  if (d <= (tol || 0.02)) { pass++; }
  else { fail++; console.log('  ✗', name, 'got', got.toFixed(3), 'want', want.toFixed(3)); }
};
/* 배포되는 코드와 같은 길을 쓴다 — 엔진이 만든 경간 곡선을 받아 부호만 뒤집는다.
   사본을 검사하면 사본만 맞는다. */
const negSpan = e => ({ x: e.x, S: e.S.map(v=>-v), M: e.M.map(v=>-v),
                        y: e.y.map(v=>-v), theta: (e.theta||[]).map(v=>-v) });
function solve(spans, sup) {
  const r = B.Cross.solve(B.Cross.beam(spans, sup));
  const out = { M: {}, R: {}, curves: [], disp: r.disp };
  spans.forEach((sp, k) => {
    const id = String.fromCharCode(65+k) + String.fromCharCode(66+k);
    const dd = negSpan(r.spans[id]);
    out.M[id] = { i: dd.M[0], j: dd.M[dd.M.length-1] };
    out.curves.push(dd);
  });
  for (const k in r.reactions) out.R[k] = -r.reactions[k].fy;
  return out;
}
const EI = 205000 * 20400e4 * 1e-9;

console.log('① 1경간 단순보  w=25 L=8  → M중앙 = wL²/8 = 200');
{ const r = solve([{L:8, EI, loads:w(8,25)}], ['pin','roller']);
  ok('M max', Math.max(...r.curves[0].M), 200, 0.3);
  ok('R A', r.R.A, 100, 0.02); ok('R B', r.R.B, 100, 0.02); }

console.log('② 1경간 양단고정  → 단부 -wL²/12 = -133.33, 중앙 +66.67');
{ const r = solve([{L:8, EI, loads:w(8,25)}], ['fix','fix']);
  ok('M(0)',  r.curves[0].M[0], -133.333, 0.3);
  ok('M 중앙', Math.max(...r.curves[0].M), 66.667, 0.3); }

console.log('③ 2경간 등간 8+8  w=25  → M_B = -wL²/8 = -200, R_A = 3wL/8 = 75, R_B = 10wL/8 = 250');
{ const r = solve([{L:8,EI,loads:w(8,25)},{L:8,EI,loads:w(8,25)}], ['pin','roller','roller']);
  ok('M_B', r.M.AB.j, -200, 0.3); ok('R A', r.R.A, 75, 0.05);
  ok('R B', r.R.B, 250, 0.05); ok('R C', r.R.C, 75, 0.05); }

console.log('④ 3경간 등간 8+8+8  w=25  → M_B = M_C = -0.1wL² = -160, R_A = 0.4wL = 80');
{ const r = solve([0,1,2].map(()=>({L:8,EI,loads:w(8,25)})), ['pin','roller','roller','roller']);
  ok('M_B', r.M.AB.j, -160, 0.4); ok('M_C', r.M.BC.j, -160, 0.4);
  ok('R A', r.R.A, 80, 0.1); ok('R B', r.R.B, 220, 0.2); }

console.log('⑤ 5경간 등간 6m  w=20  → 반력 합 = 총하중');
{ const sp = [0,1,2,3,4].map(()=>({L:6,EI,loads:w(6,20)}));
  const r = solve(sp, ['pin','roller','roller','roller','roller','roller']);
  const sum = Object.values(r.R).reduce((a,b)=>a+b,0);
  ok('반력 합', sum, 20*30, 0.05); }

console.log('⑥ 부등경간 8+6+8  w=25  → 반력 합 = 총하중, 단부모멘트 연속');
{ const r = solve([{L:8,EI,loads:w(8,25)},{L:6,EI,loads:w(6,25)},{L:8,EI,loads:w(8,25)}],
                  ['pin','roller','roller','roller']);
  ok('반력 합', Object.values(r.R).reduce((a,b)=>a+b,0), 25*22, 0.05);
  ok('B 에서 연속', r.M.AB.j, r.M.BC.i, 1e-6);
  ok('C 에서 연속', r.M.BC.j, r.M.CD.i, 1e-6); }

console.log('⑦ 집중하중 3경간  P=100 각 경간 중앙  → 반력 합 = 300');
{ const P = (L,p) => [{type:'P', P:-p, a:L/2}];
  const r = solve([0,1,2].map(()=>({L:8,EI,loads:P(8,100)})), ['pin','roller','roller','roller']);
  ok('반력 합', Object.values(r.R).reduce((a,b)=>a+b,0), 300, 0.05); }

console.log('⑧ 캔틸레버 L=5 w=25  → M_fix = -wL²/2, 자유단 δ = -wL⁴/8EI, θ = wL³/6EI');
{ const L=5, q=25, r = solve([{L,EI,loads:w(L,q)}], ['fix','free']);
  const c = r.curves[0], last = c.x.length-1;
  ok('M_fix',   c.M[0],        -q*L*L/2,          0.02);
  ok('M_tip',   c.M[last],      0,                0.02);
  ok('V_tip',   c.S[last],      0,                0.02);
  ok('δ_tip',   c.y[last]*1000, -q*L**4/(8*EI)*1000,   0.01);
  ok('θ_tip',   c.theta[last]*1000, -q*L**3/(6*EI)*1000, 0.01); }

console.log('⑨ 안쪽 지점을 Free 로 두면 그 절점이 없는 보와 같아야 한다 (8+6+8, B 자유 = 14+8)');
{ const a = solve([8,6,8].map(L=>({L,EI,loads:w(L,25)})), ['pin','free','roller','roller']);
  const b = solve([14,8].map(L=>({L,EI,loads:w(L,25)})), ['pin','roller','roller']);
  ok('R A', a.R.A, b.R.A, 1e-6); ok('R C', a.R.C, b.R.B, 1e-6); ok('R D', a.R.D, b.R.C, 1e-6);
  ok('B 에 반력 없음', a.R.B || 0, 0, 1e-9);
  // 자유절점을 사이에 두고 처짐·처짐각이 이어진다
  const c1 = a.curves[0], c2 = a.curves[1], n = c1.x.length-1;
  ok('δ 연속',  c1.y[n]*1000,     c2.y[0]*1000,     1e-6);
  ok('θ 연속',  c1.theta[n]*1000, c2.theta[0]*1000, 1e-6);
  ok('M 연속',  c1.M[n],          c2.M[0],          1e-6);
  // 그리고 그 처짐은 등가 2경간 모델의 같은 자리(x=8) 값과 같다
  const at = (c,x)=>{ for(let i=1;i<c.x.length;i++) if(c.x[i]>=x-1e-9){
    const t=c.x[i]===c.x[i-1]?0:(x-c.x[i-1])/(c.x[i]-c.x[i-1]); return c.y[i-1]+t*(c.y[i]-c.y[i-1]); } };
  ok('δ(B) = 등가모델 δ(8)', c1.y[n]*1000, at(b.curves[0],8)*1000, 0.02); }

console.log('⑩ 내민보 8 + 내민 2 (끝단 Free)  → R_A 손계산, 내민단 모멘트, 반력 합');
{ const q=25, r = solve([{L:8,EI,loads:w(8,q)},{L:2,EI,loads:w(2,q)}], ['pin','roller','free']);
  ok('R A',   r.R.A, (q*8*4 - q*2*2/2)/8, 0.02);
  ok('반력 합', Object.values(r.R).reduce((a,b)=>a+b,0), q*10, 0.02);
  const c2 = r.curves[1], n = c2.x.length-1;
  ok('내민단 M=0', c2.M[n], 0, 0.02);
  ok('B 의 M', c2.M[0], -q*2*2/2, 0.02);
  ok('자유단 처짐이 0 이 아니다', Math.min(Math.abs(c2.y[n]*1000), 1), 1, 0.5); }

console.log('\n' + pass + '/' + (pass+fail) + ' 통과');
