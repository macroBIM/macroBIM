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

/*  오른쪽 복부 내측 철근 ⑥-2 를 **거울상 크랭크(23-1)** 로 바꾼다.
    23 과 23-1 은 회전으로 서로를 못 만든다 — 몸통을 세워 둔 채 다리 둘만
    뒤집는 꼴이라 형상이 따로 있어야 한다(trebar.js Shape23M 주석).
    왼쪽 ⑥-3 은 거울 위치라 코드 23 + rot 90 이 제자리다 — 그대로 둔다.    */
function mirrorCrank(sheet) {
  const s = JSON.parse(JSON.stringify(sheet));
  s.forEach(r => {
    if (String(r[0] || '').trim().toLowerCase() !== 'trebar') return;
    if (String(r[1]) === '6-2') { r[2] = '23-1'; r[4] = '3050,-3520,-90'; }
  });
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
    /*  붙을 면을 못 찾은 조각이 있으면 그 철근은 **끊어진다** — 그 조각만 태어난
        자리에 토막으로 남는다. 도면 길이와 우연히 맞더라도 실패로 센다.        */
    if (b.segs.some(s => s.stopped === 'no-target')) { fail = true; verdict += '  ✗ 붙을 면 없음'; }
    if (fail) bad++;

    console.log('  ' + String(b.id).padEnd(4) +
      '길이 ' + String(Math.round(b.len)).padStart(5) +
      '  x ' + String(x0).padStart(6) + '..' + String(x1).padStart(6) +
      '  밖 ' + String(os).padStart(4) +
      '  덕트 ' + (cl.g < -0.5 ? (cl.id + ' ' + cl.g.toFixed(0)) : '여유').padEnd(12) +
      seat + verdict);
  });
  console.log('  → ' + (bad ? bad + ' 개 어긋남' : '전부 도면과 일치 · 전부 단면 안'));

  /*  철근끼리 순간격 — 논문 주장 ③ 이 지켜졌는지. 0 이 아니면 두 철근이 겹친다.
      지금 남아 있는 것은 **엔진이 제 힘으로 못 보는** 겹침이다 : 순간격은 조각이
      안착한 **강체 토막** 자리에서 재는데, 그려지는 것은 코너로 이어 늘린
      폴리라인이라 끝 조각은 위치가 다르다. ⑥-1·⑥-2 의 아래 다리가 그렇다.    */
  const AB = 'abcdef';
  let worst = 0, who = null;
  for (let i = 0; i < out.length; i++) for (let k = i + 1; k < out.length; k++) {
    const need = (out[i].dia + out[k].dia) / 2;
    for (let a = 0; a + 1 < out[i].pts.length; a++) for (let c = 0; c + 1 < out[k].pts.length; c++) {
      const d = JField.segToSeg([out[i].pts[a], out[i].pts[a + 1]], out[k].pts[c], out[k].pts[c + 1]);
      if (d - need < worst) {
        worst = d - need;
        who = out[i].id + '[' + AB[a] + '] ↔ ' + out[k].id + '[' + AB[c] + ']';
      }
    }
  }
  console.log('  철근끼리 최악 순간격 : ' + (worst < -0.5 ? worst.toFixed(1) + ' mm  (' + who + ')' : '여유'));

  /*  **피복이 모자란 곳** — 안착한 면까지의 여유를 그려진 폴리라인에서 다시 잰다.
      지금까지 벤치는 「단면 밖인가」만 봤다. 피복은 단면 안이라도 모자랄 수 있고,
      그건 구조적으로 그냥 틀린 것이다. 각을 ±180° 근처에서 안 감던 시절
      ①-1 의 다리가 22 mm 모자랐는데 표의 어느 칸에도 안 나왔다.               */
  const W = {};
  D.walls.forEach(w => { W[w.id] = w; });
  let cv = 0, cvWho = null;
  out.forEach(b => b.segs.forEach((sg, i) => {
    /*  끝점마다 **제 벽**으로 잰다. rest 는 두 끝점의 배정이지 조각 하나의 벽이
        아니다 — 하나로 뭉뚱그리면, 헌치를 걸친 철근을 평평한 쪽 벽의 **연장선**에
        대고 재게 되어 있지도 않은 피복부족이 255 mm 씩 찍힌다.               */
    [b.pts[i], b.pts[i + 1]].forEach((p, k) => {
      const id = sg.rest && sg.rest[k];
      const w = id && W[id];
      if (!w) return;
      const need = (D.covers[String(w.tag).toLowerCase()] || 50) + b.dia / 2;
      const g = (p.x - w.x1) * w.nx + (p.y - w.y1) * w.ny - need;
      if (g < cv) { cv = g; cvWho = b.id + '[' + sg.label + '] → ' + id; }
    });
  }));
  console.log('  피복이 모자란 곳     : ' + (cv < -0.5 ? cv.toFixed(1) + ' mm  (' + cvWho + ')' : '없음'));

  let it = 0, ns = 0;
  out.forEach(b => b.segs.forEach(s => { it += s.iter; ns++; }));
  console.log('  반복 : 조각 ' + ns + '개 · 합계 ' + it + ' · 평균 ' + (it / ns).toFixed(1));
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
  //  거울상 코드 23-1 (Shape23M). 띠의 축을 init 각으로 뽑던 시절 이 형상의 몸통이
  //  후보를 하나도 못 찾아 철근이 끊어졌다 — 그 자리를 지키는 시험이다.
  report('s14', 'S14 · J 엔진 · ⑥-2 를 코드 23-1 로 (거울상 크랭크)', mirrorCrank(fix('s14')), false);
}
