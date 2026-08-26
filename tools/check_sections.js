/* check_sections.js — 각형강관 Ix 를 믿어도 되는지 확인한다.

   squaretube.csv 에는 Ix 가 없다. 그래서 beam_formula_test.js 가 A·B·t·r 에서
   계산하는데, 계산된 값을 대조할 표가 없으므로 근거를 다른 데서 가져온다:
   **같은 형상식으로 낸 단면적**이 표의 단면적과 맞는지 본다. 표의 단면적은
   squaretube.md 가 밝힌 대로 형상에서 계산된 값이므로, 면적이 152행 전부
   맞으면 형상 모델이 표와 같다는 뜻이고, 그 위에서 낸 Ix 도 같은 근거를 갖는다.

   덤으로 H형강·채널 표는 Ix 열이 실제로 읽히는지, 값이 양수인지만 본다.

     node tools/check_sections.js                                          */
'use strict';
const fs = require('fs');
const path = require('path');
const BF = require('../beam_formula_test.js');
const DESIGN = path.resolve(__dirname, '../../design');

let fail = 0, run = 0;
function ok(name, cond, detail) {
  run++;
  if (!cond) { fail++; console.log(`  FAIL  ${name}${detail ? '\n        ' + detail : ''}`); }
}

function rows(file) {
  return BF.parseCsv(fs.readFileSync(path.join(DESIGN, file), 'utf8'));
}

/* ── 각형강관 : 형상식 ↔ 표의 단면적 ─────────────────────────────── */
console.log('① 각형강관 형상식 ↔ 표의 단면적');
let worst = 0, worstRow = '', n = 0;
rows('squaretube.csv').forEach(r => {
  const H = +r.A, B = +r.B, t = +r.t, rr = +r.r, listed = parseFloat(r['단면적']);
  if (!(H > 0 && B > 0 && t > 0 && listed > 0)) return;
  n++;
  const p = BF.tubeProps(H, B, t, rr);
  // 표의 단면적은 소수 둘째 자리까지다 — 그 반올림 폭 안에 들어오면 같은 값이다
  const calc = p.A / 100, tol = Math.max(0.005, listed * 1e-6);
  const err = Math.abs(calc - listed);
  if (err / listed > worst) { worst = err / listed; worstRow = `${r['호칭치수']}  calc ${calc.toFixed(4)}  listed ${listed}`; }
  ok(`squaretube ${r['호칭치수']} · area`, err <= tol, `calc ${calc.toFixed(4)} cm²  listed ${listed} cm²`);
  ok(`squaretube ${r['호칭치수']} · Ix > 0`, p.I > 0);
});
console.log(`   ${n} rows · worst area deviation ${(worst * 100).toFixed(3)} % (표는 소수 2자리 반올림)`);

/* 얇은 벽 극한 : 두께가 아주 얇으면 I → 정사각 관의 박벽 근사와 만나야 한다 */
{
  const H = 200, t = 0.05;
  const p = BF.tubeProps(H, H, t, 0);
  const thin = 2 * t * H * H * H / 3;                       // 박벽 정사각 관 (모서리 없음)
  ok('thin-wall limit', Math.abs(p.I - thin) / thin < 2e-3, `I ${p.I.toFixed(0)} vs ${thin.toFixed(0)}`);
}
/* 모서리가 없으면 정확히 (BH³ − bh³)/12 여야 한다 */
{
  const p = BF.tubeProps(150, 100, 6, 0);
  const exact = (100 * Math.pow(150, 3) - 88 * Math.pow(138, 3)) / 12;
  ok('sharp-corner tube exact', Math.abs(p.I - exact) / exact < 1e-12, `${p.I} vs ${exact}`);
}

/* ── H형강·채널 : 표의 Ix 를 읽을 수 있는가 ──────────────────────── */
console.log('② H형강·채널 표의 Ix 열');
[['hsection.csv', 'H-Section'], ['channel.csv', 'Channel']].forEach(([file, label]) => {
  const rs = rows(file);
  ok(`${label} · 행이 있다`, rs.length > 5, `${rs.length} rows`);
  let bad = 0;
  rs.forEach(r => { if (!(parseFloat(r.Ix) > 0)) bad++; });
  ok(`${label} · 모든 행에 Ix > 0`, bad === 0, `${bad} rows without Ix`);
  // 표의 Ix 가 형상과 크게 어긋나지 않는지 (H형강은 근사식으로 ±6 % 안)
  if (label === 'H-Section') {
    let mx = 0, who = '';
    rs.forEach(r => {
      const H = +r.H, B = +r.B, t1 = +r.t1, t2 = +r.t2, Ix = parseFloat(r.Ix);
      if (!(H > 0 && Ix > 0)) return;
      const approx = (B * Math.pow(H, 3) - (B - t1) * Math.pow(H - 2 * t2, 3)) / 12 / 1e4;   // 필릿 무시
      const e = Math.abs(approx - Ix) / Ix;
      if (e > mx) { mx = e; who = `${r['호칭치수']} approx ${approx.toFixed(0)} vs ${Ix}`; }
    });
    ok('H-Section · Ix 가 형상 근사와 6 % 안', mx < 0.06, `worst ${(mx * 100).toFixed(2)} %  ${who}`);
  }
});

console.log(`\n${run - fail}/${run} 통과${fail ? `  —  ${fail} 실패` : ''}`);
process.exit(fail ? 1 : 0);
