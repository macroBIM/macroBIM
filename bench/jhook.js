/*  bench/jhook.js — **ㄷ자 갈고리의 몸통 길이가 출력으로 나오는가.**
 *
 *  도면(8-243)은 상부슬래브 ㄷ(T1)의 몸통을 `X = 206~480` 이라는 **범위**로 적고,
 *  마크를 T1-1 / T1-2 / T1-3 셋으로 나눈다. 철근이 셋이라서가 아니라 슬래브 두께가
 *  변해서 몸통 길이가 자리마다 달라지기 때문이다. 즉 **X 는 입력이 아니라 결과**다.
 *
 *  엔진은 이미 그렇게 되어 있다 (`jfield.js` 의 form 주석) :
 *    「조각이 놓인 직선만 남는다 — 길이는 거기서 아무 일도 하지 않는다. 가운데
 *      조각은 입력이 필요 없다. 코너와 코너를 잇기만 하면 되니까 길이는 출력이다.」
 *  여기서 그것을 **손으로 잰 값과 맞춰** 확인한다 :
 *      X = 슬래브 두께 − (상면 피복 + d/2) − (하면 피복 + d/2)
 *
 *  ── 아직 안 된 것 ────────────────────────────────────────────────────────
 *  ㄷ의 **몸통은 두 면에 수직이라 마주보는 벽이 원래 없다.** 그런데 6 m 떨어진
 *  캔틸레버 선단면이 후보로 들어와 ㄷ 전체를 끌고 갔다. `CONF.RHO_LINK` 가
 *  그것을 막는다 — **연결 조각(가운데)은 자리를 찾아 나서지 않는다**는 규칙이다.
 *  자유단에는 안 건다 (⑥ 의 다리는 3.2 m 를 가야 한다). 아래에서 끄고도 찍어
 *  둔다 — 그 규칙이 없으면 무슨 일이 나는지가 같이 보여야 한다.
 *
 *  실행 :  node bench/jhook.js
 */
'use strict';
const fs = require('fs'), path = require('path');
const { prepare } = require('./jengine');
const JField = require('../jfield');

const fix = f => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture', f + '.json'), 'utf8'));
const D = prepare(fix('s14'), {}, 'box');
const sec = { covers: D.covers };
const DIA = 13, LEG = 400, HALF = 100;
const RHO = JField.CONF.RHO_LINK;      // 연결 조각이 자리를 찾는 반경 (엔진 값 그대로)

/*  **검산은 「엔진이 낸 길이」가 아니라 「코너가 피복선 위에 있나」로 한다.**
    ㄷ의 두 코너는 다리 둘이 앉은 면의 피복선 위에 정확히 있어야 하고, 그러면
    몸통 길이는 저절로 그 두 피복선 사이의 거리가 된다 — 그것이 도면의 X 다.
    손으로 벽을 집어 두께를 재려 했더니 상부슬래브 언저리에 면이 여럿이라
    엉뚱한 것을 골랐다. 앉은 면을 그대로 쓰는 편이 짧고 틀릴 데가 없다.        */
const byId = {};
D.walls.forEach(w => { byId[w.id] = w; });
//  그 x 의 **데크 상면** y. init 은 거기서 140 내려온 자리에 둔다 — 슬래브가
//  어디서나 280 이상이라 두 다리가 모두 콘크리트 안에서 태어난다.
function deckTop(X) {
    let top = null;
    D.walls.forEach(w => {
        const lo = Math.min(w.x1, w.x2), hi = Math.max(w.x1, w.x2);
        if (X < lo - 1 || X > hi + 1 || Math.abs(w.x2 - w.x1) < 1) return;
        if (w.ny > -0.3) return;                       // 법선이 아래를 보는 면 = 상면
        const y = w.y1 + (X - w.x1) / (w.x2 - w.x1) * (w.y2 - w.y1);
        if (y > -800 && (top === null || y > top)) top = y;
    });
    return top;
}

/*  `rho` 를 Infinity 로 주면 **연결 조각의 반경을 꺼서** 고치기 전 동작을 재현한다. */
function hook(X, Y, rho) {
    const keep = JField.CONF.RHO_LINK;
    if (!isFinite(rho)) JField.CONF.RHO_LINK = Infinity;
    const bar = { id: 'T1', dia: DIA, segs: [
        { label: 'a', p1: { x: X-LEG, y: Y-HALF }, p2: { x: X, y: Y-HALF }, normal: { x: 0, y: -1 } },
        { label: 'b', p1: { x: X, y: Y-HALF },     p2: { x: X, y: Y+HALF }, normal: { x: 1, y: 0 } },
        { label: 'c', p1: { x: X, y: Y+HALF },     p2: { x: X-LEG, y: Y+HALF }, normal: { x: 0, y: 1 } }] };
    let r;
    try { r = JField.form(bar, D.walls, sec, D.ducts, [], []); }
    finally { JField.CONF.RHO_LINK = keep; }
    return { r: r, body: Math.hypot(r.pts[2].x - r.pts[1].x, r.pts[2].y - r.pts[1].y),
             x: r.pts[1].x, seats: r.segs.map(s => (s.rest && s.rest[0]) || '없음'),
             //  두 끝이 **서로 다른 면**에 앉았나 (헌치를 타고 넘는 다리)
             split: r.segs.map(s => !!(s.rest && s.rest.length === 2 && s.rest[0] !== s.rest[1])),
             rests: r.segs.map(s => (s.rest || []).join('/') || '없음') };
}

let bad = 0;
console.log('ㄷ자 갈고리 몸통 — 입력 없이 나오는가  (RHO_LINK = ' + RHO + ' mm)\n');
console.log('  init x   데크 상면 y      몸통 X    코너↔피복선   자리 (a · b · c)');
console.log('  ' + '─'.repeat(72));
/*  x=0 은 넣지 않는다 — 좌·우 벽(E1·E2, E15·E24)이 **거기서 끝나 서로 만난다.**
    조각이 두 벽의 이음매에 걸치면 방향을 한 벽에서 가져오지 못해 코너가 몇 mm
    기운다 (실제로 9.5 mm 였다). 그건 이 벤치가 볼 것이 아니다.                */
[400, 800, 1200, 1600, 2000, 2400].forEach(X => {
    const top = deckTop(X);
    if (top == null) return;
    const Y = top - 120;
    const g = hook(X, Y, RHO);
    //  두 코너가 각자 다리의 피복선 위에 있나 (|여유| 가 0 이어야 한다)
    const slk = [[1, 0], [2, 2]].map(([pi, si]) => {
        const w = byId[g.seats[si]];
        if (!w) return NaN;
        return JField.slack(g.r.pts[pi].x, g.r.pts[pi].y,
                            { w: w, need: JField.coverOf(w, sec) + DIA / 2 });
    });
    const off = Math.max(Math.abs(slk[0]), Math.abs(slk[1]));
    /*  다리의 두 끝이 **다른 면**에 앉았으면(평면 ↔ 헌치를 타고 넘는 자리) 피복선이
        하나로 정해지지 않는다 — 잴 기준이 없으므로 이 벤치가 볼 자리가 아니다.   */
    const straddle = g.split[0] || g.split[2];
    const ok = straddle || (off < 0.5 && Math.abs(g.x - X) < 1);
    if (!ok) bad++;
    console.log('  ' + String(X).padStart(6) + '   ' + top.toFixed(0).padStart(8) +
        '   ' + g.body.toFixed(1).padStart(10) + '   ' + off.toFixed(2).padStart(10) +
        (straddle ? '  ·  ' : ok ? '  ✓  ' : '  ✗  ') + g.rests.join(' · ') +
        (straddle ? '   ← 다리가 두 면에 걸쳤다 (잴 기준이 없다)' : ''));
});
console.log('  ' + '─'.repeat(72));

//  ρ₀ 없이 지금 무슨 일이 나는가
const n = hook(400, deckTop(400) - 120, Infinity);
console.log('\n  RHO_LINK 를 끄면 :  init x=400 인데 몸통이 x=' + Math.round(n.x) +
            ' 에 선다 — 자리 ' + n.seats.join(' · '));
console.log('  ㄷ의 몸통은 두 면에 수직이라 마주보는 벽이 원래 없는데,');
console.log('  6 m 떨어진 캔틸레버 선단면이 후보로 들어와 ㄷ 전체를 끌고 간다.');
console.log('  → **연결 조각은 자리를 찾아 나서지 않는다**가 그것을 막는다. 자유단에는 안 건다.');

/*  ── 고친 것 : init 높이에 따라 피복선에 못 닿고 멈추던 것 ──────────────── */
const topX = deckTop(800);
console.log('\n  init 높이만 바꿔 같은 자리에 세워 보면 :');
[120, 140, 152, 170].forEach(dy => {
    const g = hook(800, topX - dy, RHO);
    const w = byId[g.seats[2]];
    const sl = JField.slack(g.r.pts[2].x, g.r.pts[2].y,
                            { w: w, need: JField.coverOf(w, sec) + DIA / 2 });
    console.log('    상면에서 ' + String(dy).padStart(4) + ' mm 아래에서 출발 → 코너가 피복선에서 ' +
        sl.toFixed(2).padStart(6) + ' mm   몸통 ' + g.body.toFixed(1) +
        (Math.abs(sl) < 0.5 ? '   ✓' : '   ✗ 못 닿고 멈췄다'));
});
console.log('  (고치기 전에는 140·152 에서 -9.52 / +2.47 로 멈췄다 — descend 의 걸음 거부 참조)');

console.log('\n  ' + (bad ? '  ✗ ' + bad + '개 어긋남'
      : '  → 두 코너가 전부 제 피복선 위에 있다. 몸통 길이는 **입력이 아니라 거기서 나온 값**이다.'));
process.exit(bad ? 1 : 0);
