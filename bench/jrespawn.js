/*  bench/jrespawn.js — Respawn 이 **태어난 자리를 먼저 보여 주는지** 확인한다.
 *
 *  ── 왜 이 검사가 있나 ──────────────────────────────────────────────────
 *  이 자리는 두 번 깨졌다.
 *    ① 「Respawn 을 눌러도 아무 일도 안 일어난다」 — J 는 결정적이라 전체를 다시
 *       풀면 같은 답이 나와 화면이 한 픽셀도 안 변했다.
 *    ② 「초기 형상이 아예 안 보인다」 — J 는 한 번에 풀어서 스폰 상태가 화면에
 *       한 프레임도 안 나왔다.
 *  둘 다 **그림이 없으면 안 보이는** 종류라, 눈으로만 확인하면 또 깨진다.
 *  그래서 상태로 확인한다 : 누른 직후엔 **태어난 자리**, SPAWN_HOLD 뒤엔 **답**.
 *
 *  실행 :  node bench/jrespawn.js
 */
'use strict';
const path = require('path');
const vm = require('vm');
const { prepare } = require('./jengine');

const ID = '8-1';
const hyp = (x, y) => Math.sqrt(x * x + y * y);
const P2 = p => `(${p.x.toFixed(0)},${p.y.toFixed(0)})`;
const poly = t => (t.segments || []).map((s, i) => (i ? '' : P2(s.p1)) + '→' + P2(s.p2)).join('');

const D = prepare(require('./fixture/s14.json'), {}, 'box');
const { ctx, P, rows } = D;
//  `class Domain` 은 컨텍스트의 전역 **속성**이 아니라 스크립트 스코프에 있다 —
//  jengine 이 하는 것과 같이 꺼내 쓴다.
const Domain = vm.runInContext('Domain', ctx);

/*  브라우저에서는 페이지가 `jfield.js` 를 같이 읽어 들인다. 벤치의 컨텍스트에는
    그게 없어서 `_solveWithJField()` 가 조용히 false 로 빠진다 — 여기서 넣어 준다. */
vm.runInContext(require('fs').readFileSync(path.join(__dirname, '..', 'jfield.js'), 'utf8'),
                ctx, { filename: 'jfield.js' });

//  페이지가 제 파이프라인으로 돌 수 있게 채워 준다
P._rebarData = rows;
P._engine = 'jfield';
Domain.trebarList = [];
rows.forEach(rd => {
    if (String(rd.type || 'trebar').toLowerCase() !== 'trebar') return;
    const t = Domain._createTrebarFromData(rd);
    if (t) Domain.trebarList.push(t);
});

let fail = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) fail++; };

//  ① 먼저 단면 전체를 J 로 푼다
const solved = P._solveWithJField();
ok(solved, '단면 전체를 J 로 풀었다');
const bar = () => Domain.trebarList.filter(t => String(t.id) === ID)[0];
const answer = poly(bar());
console.log(`    ${ID} 답  ${answer}`);

//  태어난 자리(스폰) 를 따로 만들어 둔다 — 비교 기준
const born = Domain._createTrebarFromData(rows.filter(r => String(r.id) === ID)[0]);
const bornPoly = poly(born);
console.log(`    ${ID} 태어난 자리  ${bornPoly}`);
ok(bornPoly !== answer, '태어난 자리와 답이 서로 다르다 (안 다르면 이 검사가 무의미하다)');

//  ② setTimeout 을 가로채서 「누른 직후」와 「SPAWN_HOLD 뒤」를 나눠 본다
let held = null, heldMs = null;
ctx.setTimeout = (fn, ms) => { held = fn; heldMs = ms; return 0; };

P._resolveOneWithJField(ID);

console.log('\n  ── 누른 직후 (SPAWN_HOLD 전) ──');
ok(held !== null, '푸는 일을 SPAWN_HOLD 뒤로 미뤘다');
ok(heldMs === P.SPAWN_HOLD, `기다리는 시간이 SPAWN_HOLD (${P.SPAWN_HOLD} ms) 다  — 받은 값 ${heldMs}`);
ok(poly(bar()) === bornPoly, '화면에 올라간 철근이 **태어난 자리**에 있다');
ok(bar().state !== 'FORMED', '아직 안착 전 상태다 (직선 토막으로 그려진다)');
const ghost = (P._spawn || []).filter(s => String(s.id) === ID)[0];
ok(!!ghost, '태어난 자리 유령(점선)이 이 철근 것으로 새로 잡혔다');
if (ghost) {
    const segPts = [];
    born.segments.forEach((sg, i) => { if (i === 0) segPts.push(sg.p1); segPts.push(sg.p2); });
    const same = ghost.pts.length === segPts.length &&
        ghost.pts.every((p, i) => hyp(p.x - segPts[i].x, p.y - segPts[i].y) < 1e-6);
    ok(same, '유령의 점들이 태어난 자리와 같다');
}
ok((P._spawn || []).filter(s => String(s.id) === ID).length === 1, '유령이 겹쳐 쌓이지 않는다 (누를 때마다 하나)');
ok(String(P._focusId) === ID, '다시 푸는 철근이 강조된다');

//  ③ SPAWN_HOLD 가 지난 뒤
held();
console.log('\n  ── SPAWN_HOLD 뒤 ──');
ok(bar().state === 'FORMED', '안착했다');
ok(poly(bar()) === answer, '답이 단면 전체를 풀었을 때와 같다 (J 는 결정적이다)');

console.log(fail ? `\n  → ${fail} 개 어긋남` : '\n  → 전부 통과');
process.exitCode = fail ? 1 : 0;
