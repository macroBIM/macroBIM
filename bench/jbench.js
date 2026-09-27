/*  bench/jbench.js — J 엔진(jfield.js)이 어디까지 맞는지 본다.
 *  기존 엔진과 **같은 입력**(bench/fixture/*.json)에 같은 도면 기준을 쓴다.
 *  실행 :  node bench/jbench.js            (전부)
 *          node bench/jbench.js s14 6-1    (한 철근만, 조각별 접촉까지)
 */
'use strict';
const fs = require('fs'), path = require('path');
const { prepare } = require('./jengine');
const JField = require('../jfield');
const G = require('./geom');

const fix = f => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture', f + '.json'), 'utf8'));

//  도면 (8-243 / 8-244). check.js 의 것과 같은 값이다.
const TRUTH = {
  s15: {
    '1-1': { len: 4990, x: [-6154, -1356] },
    '1':   { len: 8000, x: [-1654,  6153] },
    '2':   { len: 1590, x: [ 4741,  6141] },
    '4-1': { len: 2540, x: [-5607, -3123] },
    '3-1': { len: 2730, x: [ 3019,  5717] }
  },
  s14: {
    '1-1': { len: 4990, x: [-6154, -1354] },
    '1':   { len: 8000, x: [-1654,  6154] },
    '2':   { len: 1590 },
    '2-1': { len: 1590 },
    '3':   { len: 5055, tol: 60 },
    '4':   { len: 5055, tol: 60 },
    '5':   { len: 4000 }
  }
};

const CASES = {
  //  S15 는 `set` 로 「어느 벽에 붙일지」를 직접 지정하는 옛 입력이다. set 은 철근을
  //  그 벽으로 회전·이동시켜 놓으므로, 그렇게 놓인 자세가 단면 **밖**일 수 있다
  //  (bar 1 의 다리가 선단에서 800 mm 밖으로 나간다). J 엔진의 계약은 init 하나이므로
  //  S15 의 set 행들은 이 엔진의 시험이 못 된다 — 참고로만 찍는다.
  s15: { page: 'dia', truth: TRUTH.s15, note: 'set 기반 옛 입력 — J 엔진의 계약(init)이 아니다. 참고용.' },
  s14: { page: 'box', truth: TRUTH.s14 }
};

//  trebar 의 segs 칸(조각 길이)을 전부 비운다 — 기본값 400 만으로 서는지 본다
function stripSegs(sheet) {
  const s = JSON.parse(JSON.stringify(sheet));
  s.forEach(r => { if (String(r[0] || '').trim().toLowerCase() === 'trebar') r[6] = ''; });
  return s;
}

function solve(name, sheet) {
  const c = CASES[name];
  const D = prepare(sheet || fix(name), {}, c.page);
  const sec = { covers: D.covers };
  return { D: D, out: JField.solve(D.bars, D.walls, sec, D.ducts) };
}

/*  철근이 덕트 순간격을 못 지킨 만큼 (2단계가 남긴 것).
    0 이 아니면 피복과 순간격을 동시에 만족할 수 없는 자리다 — 설계가 볼 값이다.   */
function ductClash(b, ducts) {
  let worst = 0, who = null;
  for (let i = 0; i + 1 < b.pts.length; i++) {
    const e = [b.pts[i], b.pts[i + 1]];
    (ducts || []).forEach(d => {
      const need = d.D / 2 + (d.clr != null ? d.clr : 30) + b.dia / 2;
      const g = JField.segToPoint(e, d) - need;
      if (g < worst) { worst = g; who = d.id; }
    });
  }
  return { g: worst, id: who };
}

function report(name, tag, sheet, useTruth) {
  const c = CASES[name], { D, out } = solve(name, sheet);
  const truth = (useTruth === false) ? null : c.truth;
  console.log('\n=== ' + (tag || name.toUpperCase() + ' · J 엔진') + ' ===');
  if (c.note) console.log('  ※ ' + c.note);
  let bad = 0;
  out.forEach(b => {
    const pts = b.pts.map(p => [p.x, p.y]);
    const xs = pts.map(p => p[0]);
    const x0 = Math.round(Math.min(...xs)), x1 = Math.round(Math.max(...xs));
    const os = Math.round(G.outsideLength(pts, D.outer, []).outside);
    const cl = ductClash(b, D.ducts);
    //  조각마다 : 어느 면에 앉았나 + 피복선에서 얼마나 떨어졌나(덕트가 밀어낸 양)
    const seat = b.segs.map(s => {
      if (s.stopped === 'no-target') return s.label + ':없음';
      const rest = (s.rest && s.rest[0]) || '?';
      const g = s.contacts.length ? s.contacts[0].g : null;
      return s.label + ':' + rest + (g == null ? '' : (g >= 0 ? '+' : '') + g.toFixed(0));
    }).join(' ');

    let verdict = '', fail = false;
    const t = truth && truth[b.id];
    if (t) {
      const okLen = Math.abs(b.len - t.len) <= (t.tol || 2);
      const okPos = !t.x || (Math.abs(x0 - t.x[0]) <= 5 && Math.abs(x1 - t.x[1]) <= 5);
      if (!(okLen && okPos)) {
        fail = true;
        verdict += '  ✗ 도면 ' + t.len + (t.x ? ' x ' + t.x[0] + '..' + t.x[1] : '');
      }
    }
    //  단면 밖으로 나간 것은 도면표에 없어도 실패다
    if (os > 1) { fail = true; verdict += '  ✗ 단면 밖'; }
    if (fail) bad++;

    console.log('  ' + String(b.id).padEnd(4) +
      '길이 ' + String(Math.round(b.len)).padStart(5) +
      '  x ' + String(x0).padStart(6) + '..' + String(x1).padStart(6) +
      '  밖 ' + String(os).padStart(4) +
      '  덕트 ' + (cl.g < -0.5 ? (cl.id + ' ' + cl.g.toFixed(0)) : '여유').padEnd(12) +
      seat + verdict);
  });
  console.log('  → ' + (bad ? bad + ' 개 어긋남' : '전부 도면과 일치 · 전부 단면 안'));
  return bad;
}

//  한 철근만 — 조각마다 어떤 면이 후보였고 무엇이 실제로 막았는지
function detail(name, barId) {
  const { D, out } = solve(name);
  const b = out.find(x => String(x.id) === String(barId));
  if (!b) { console.log('그런 철근이 없다 : ' + barId); return; }
  console.log('\n=== ' + name.toUpperCase() + ' · ' + b.id + ' (D' + b.dia + ') ===');
  b.segs.forEach((s, i) => {
    console.log('  조각 ' + s.label + '   기본길이 ' + Math.round(s.len0) +
                ' → 출력 ' + Math.round(s.len) + '   반복 ' + s.iter +
                '   J ' + (s.J == null ? '—' : s.J.toFixed(3)) +
                (s.stopped ? '   [' + s.stopped + ']' : ''));
    console.log('      후보(게이트+범위) : ' + (s.cons.join(' ') || '없음'));
    console.log('      접촉 : ' + (s.contacts.map(c =>
      c.id + '(' + c.tag + ') g=' + c.g.toFixed(2) + ' λ=' + c.lam.toFixed(1)).join('  ') || '없음'));
    console.log('      ' + [b.pts[i], b.pts[i + 1]].map(p =>
      '(' + Math.round(p.x) + ',' + Math.round(p.y) + ')').join(' → '));
  });
  console.log('  전체 길이 ' + Math.round(b.len));
}

const [which, barId] = process.argv.slice(2);
if (which && barId) detail(which, barId);
else if (which) report(which);
else {
  report('s15');
  report('s14');
  //  길이를 **하나도** 주지 않고 돌린다. 조각은 전부 기본값 400 으로 태어나고,
  //  몸통 길이는 이웃 두 직선의 교점이 정한다 — 길이가 출력이라는 것의 시험이다.
  report('s14', 'S14 · J 엔진 · segs 미입력 (전부 기본 400)', stripSegs(fix('s14')), false);
}
