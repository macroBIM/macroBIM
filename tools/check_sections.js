/* check_sections.js — 화면이 쓰는 단면 물성을 표와 맞춰 본다.

   SimpleBeam 의 Database 는 네 표를 읽는다. 표마다 실려 있는 것이 달라서
   근거를 대는 방법도 다르다.

     H형강 · 채널   표에 Ix 와 단면계수가 둘 다 있다 →
                    우리가 낸 Stop = Ix/y_top 이 표의 값과 맞는지 본다.
                    맞으면 연단거리 y 를 제대로 잡았다는 뜻이다.
     각형강관       Ix 가 없어 A·B·t·r 에서 계산한다. 대조할 Ix 가 없으므로
                    같은 형상식으로 낸 **단면적**을 표의 단면적과 맞춘다.
                    표의 단면적 자체가 형상에서 계산된 값이고(squaretube.md),
                    그것이 맞으면 같은 형상 위의 Ix 도 같은 근거를 갖는다.
     파이프         같은 이유로 단면적을 맞춘다. 여기는 형상이 원환이라
                    닫힌 식이 정확하다.

   검사는 배포되는 코드(beam_formula_test.js 의 sectionRow)를 그대로 부른다.
   사본을 검사하면 사본만 맞는다.

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
function rows(file) { return BF.parseCsv(fs.readFileSync(path.join(DESIGN, file), 'utf8')); }

/* ── ① 표에 단면계수가 실린 것 : Stop 이 그 값과 맞는가 ─────────────── */
console.log('① H형강·채널 — 우리가 낸 Stop ↔ 표의 단면계수');
['hsection', 'channel'].forEach(kind => {
  const cfg = BF.SECT[kind];
  let worst = 0, who = '', n = 0;
  rows(cfg.file).forEach(r => {
    const p = BF.sectionRow(cfg, r);
    const listed = parseFloat(r[cfg.zx]);
    if (!p || !(listed > 0)) return;
    n++;
    const e = Math.abs(p.stop - listed) / listed;
    if (e > worst) { worst = e; who = `${p.name}  Stop ${p.stop.toFixed(2)}  listed ${listed}`; }
    // 표는 유효숫자 3자리라 그 반올림 폭(≈0.5 %)보다 넉넉히 잡는다
    ok(`${cfg.label} ${p.name} · Stop`, e < 0.015, `Stop ${p.stop.toFixed(2)} vs listed ${listed} (${(e * 100).toFixed(2)} %)`);
    ok(`${cfg.label} ${p.name} · 대칭이면 Stop = Sbot`, Math.abs(p.stop - p.sbot) < 1e-9);
  });
  console.log(`   ${cfg.label}: ${n} rows · worst ${(worst * 100).toFixed(2)} %  ${who}`);
});

/* ── ② 표에 Ix 가 없는 것 : 형상식으로 낸 단면적이 표와 맞는가 ────── */
console.log('② 각형강관·파이프 — 형상식 단면적 ↔ 표의 단면적');
['squaretube', 'pipe'].forEach(kind => {
  const cfg = BF.SECT[kind];
  let worst = 0, who = '', n = 0;
  rows(cfg.file).forEach(r => {
    const p = BF.sectionRow(cfg, r);
    const listed = parseFloat(r[cfg.area]);
    if (!p || !(listed > 0)) return;
    n++;
    const e = Math.abs(p.area - listed);
    if (e / listed > worst) { worst = e / listed; who = `${p.name}  calc ${p.area.toFixed(4)}  listed ${listed}`; }
    // 표는 소수 둘째 자리까지 — 그 반올림 폭 안이면 같은 값이다
    ok(`${cfg.label} ${p.name} · area`, e <= Math.max(0.005, listed * 1e-6),
       `calc ${p.area.toFixed(4)} cm² vs listed ${listed} cm²`);
    ok(`${cfg.label} ${p.name} · Ix > 0`, p.ix > 0);
    ok(`${cfg.label} ${p.name} · Stop = Sbot`, Math.abs(p.stop - p.sbot) < 1e-9);
  });
  console.log(`   ${cfg.label}: ${n} rows · worst ${(worst * 100).toFixed(3)} % (표 반올림 폭)  ${who}`);
});

/* ── ③ 형상식 자체의 극한 ───────────────────────────────────────── */
console.log('③ 형상식 극한값');
{
  // 모서리가 없으면 정확히 (BH³ − bh³)/12
  const p = BF.tubeProps(150, 100, 6, 0);
  const exact = (100 * Math.pow(150, 3) - 88 * Math.pow(138, 3)) / 12;
  ok('sharp-corner tube exact', Math.abs(p.I - exact) / exact < 1e-12, `${p.I} vs ${exact}`);
}
{
  // 아주 얇은 벽이면 박벽 정사각 관 근사와 만난다
  const H = 200, t = 0.05, p = BF.tubeProps(H, H, t, 0);
  const thin = 2 * t * H * H * H / 3;
  ok('thin-wall square tube', Math.abs(p.I - thin) / thin < 2e-3, `${p.I.toFixed(0)} vs ${thin.toFixed(0)}`);
}
{
  // 파이프: 아주 얇으면 I → πr³t
  const cfg = BF.SECT.pipe;
  const p = BF.sectionRow(cfg, { '호칭치수': 'thin', D: '200', t: '0.05', '단면적': '1', '단위무게': '1' });
  const r = (200 - 0.05) / 2, thin = Math.PI * Math.pow(r, 3) * 0.05 / 1e4;
  ok('thin-wall pipe', Math.abs(p.ix - thin) / thin < 2e-3, `${p.ix.toFixed(2)} vs ${thin.toFixed(2)} cm⁴`);
}
{
  // 대칭 단면이면 Stop = Sbot = Ix/(H/2)
  const cfg = BF.SECT.hsection, r0 = rows(cfg.file)[0];
  const p = BF.sectionRow(cfg, r0);
  ok('H-Section Stop = Ix/(H/2)', Math.abs(p.stop - p.ix / (+r0.H / 20)) < 1e-9);
}

console.log(`\n${run - fail}/${run} 통과${fail ? `  —  ${fail} 실패` : ''}`);
process.exit(fail ? 1 : 0);
