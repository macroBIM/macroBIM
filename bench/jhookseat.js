/*  bench/jhookseat.js — **갈고리 다리가 종방향에 걸려 서는가.**
 *
 *  ㄷ(스터럽)는 단면 평면 안에 누워 있고, 그 평면을 **뚫고 지나가는** 철근만
 *  걸 수 있다 — 종방향(점)이다. 횡방향은 같은 평면에 나란히 누워 있어 걸 수가
 *  없다(부딪힐 뿐이다). 그래서 다리의 자리는 **벽이 아니라 종방향**이고,
 *  콘크리트 피복은 인력이 아니라 **결과**다.
 *
 *  유도는 `jfield.js` 의 hookGeom 주석에 있다. 여기서 보는 것은 그 최소점이다 :
 *      h = need        다리 중심선에서 종방향까지 (맞닿는다)
 *      s = 0           절곡 **접선점**. 그보다 코너 쪽으로 가면 아크를 파고든다
 *      q = C − R·û + need·n̂
 *  즉 **직선 구간에는 닿고, 절곡 아크에는 안 들어간다.**
 *
 *  s = 0 은 그 뒤 **요구에서 선호로 내려갔다** — 결속점이 절곡이 끝나는 바로 그
 *  점일 이유가 없고, 축방향은 점이 아니라 띠 s ∈ [0, ℓ−R] 다 (`bench/jband.js`).
 *  그래서 재는 자도 **띠**다. 막는 것이 없으면 선호가 s = 0 을 고르므로 대개는
 *  예전 답 그대로이고, **비켜난 자리는 그 까닭(δ 와 J 가 얼마나 내려갔나)을 같이
 *  찍는다** — 여기 ㄷ 는 다리가 400 mm 라 띠가 367 mm 로 넓고(실제 T1 은 150),
 *  덕트와 종방향이 들어와 있어 한 자리는 실제로 244 mm 미끄러진다.
 *
 *  실행 :  node bench/jhookseat.js
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { prepare } = require('./jengine');

const ROOT = path.join(__dirname, '..');
const sheet = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture', 's14.json'), 'utf8'));
const D = prepare(sheet, {}, 'box');
const { ctx, P, rows } = D;
const Domain = vm.runInContext('Domain', ctx);
['jfield.js', 'jlong.js'].forEach(f =>
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
P._rebarData = rows; P._engine = 'jfield';
Domain.trebarList = []; Domain.lrebarList = []; Domain.queue = [];
rows.forEach(rd => {
    const t = String(rd.type || 'trebar').toLowerCase();
    if (t === 'trebar') { const b = Domain._createTrebarFromData(rd); if (b) { Domain.trebarList.push(b); Domain.queue.push({ kind: 'trebar', obj: b }); } }
    else if (t === 'lrebar') { const g = Domain._createLrebarFromData(rd); if (g) { Domain.lrebarList.push(g); Domain.queue.push({ kind: 'lrebar', obj: g }); } }
});
P._toast = () => {}; P._solveWithJField();

const JF = vm.runInContext('JField', ctx);
const sec = Domain.currentSection;
const lpts = P._lrebarPoints();
const DIA = 13, LEG = 400, R = JF.bendRadius(DIA), NEED = DIA;

function deckTop(X) {
    let t = null;
    sec.walls.forEach(w => {
        const lo = Math.min(w.x1, w.x2), hi = Math.max(w.x1, w.x2);
        if (X < lo - 1 || X > hi + 1 || Math.abs(w.x2 - w.x1) < 1 || w.ny > -0.3) return;
        const y = w.y1 + (X - w.x1) / (w.x2 - w.x1) * (w.y2 - w.y1);
        if (y > -800 && (t === null || y > t)) t = y;
    });
    return t;
}

//  ㄷ 하나 — 몸통 세로 · 다리 둘 왼쪽 · 길이는 자유단만 준다
function hook(X, Y, HH) {
    return { id: 'T1', dia: DIA, hook: true, segs: [
        { label: 'a', p1: { x: X-LEG, y: Y-HH }, p2: { x: X, y: Y-HH }, normal: { x: 0, y: -1 } },
        { label: 'b', p1: { x: X, y: Y-HH },     p2: { x: X, y: Y+HH }, normal: { x: 1, y: 0 } },
        { label: 'c', p1: { x: X, y: Y+HH },     p2: { x: X-LEG, y: Y+HH }, normal: { x: 0, y: 1 } }] };
}

let bad = 0, n = 0;
console.log('갈고리 다리의 자리 = 종방향  (H13/H13 · 중심선 곡률반경 ' + R + ' · need ' + NEED + ')\n');
console.log('    x     다리   걸린 종방향         h   목표      피복    몸통 X   철근깊이');
console.log('   ' + '─'.repeat(86));

[400, 900, 1400, 1900, 2400].forEach(X => {
    const top = deckTop(X);
    if (top == null) return;
    /*  **ㄷ 를 크게 띄워 놓고 줄어들게 한다.** 다리가 제 철근보다 «바깥»에서
        출발해야 바깥 우물(철근을 품는 쪽)에 앉는다 — 안쪽에서 출발하면 철근을
        못 넘어 반대쪽에 선다(등성이를 못 넘는다). 갈고리는 벽을 안 보므로
        콘크리트 밖에서 출발해도 상관없다.                                      */
    const bar = hook(X, top - 310, 290);          // 윗다리 깊이 20 · 아랫다리 600
    let r;
    try { r = JF.form(bar, sec.walls, sec, P._ducts || [], [], lpts); }
    catch (e) { console.log('  ' + X + '  ✗ ' + e.message); bad++; return; }

    const body = Math.hypot(r.pts[2].x - r.pts[1].x, r.pts[2].y - r.pts[1].y);
    [0, 2].forEach(i => {
        const sg = r.segs[i];
        //  푼 자세에서 h·s 를 다시 잰다 (엔진이 쓰는 그 식으로)
        const a = r.pts[i], b = r.pts[i + 1];
        const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const pose = { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, th: Math.atan2(b.y - a.y, b.x - a.x) };
        const S = { len: L, dia: DIA, p1: a, p2: b, hook: true, hookQ: sg.hookQ,
                    hookEnd: (i === 0) ? 1 : -1, hookSide: sg.hookSide, bendR: R };
        if (!S.hookQ) { console.log('  ' + X + '[' + sg.label + ']  ✗ 걸 종방향을 못 찾았다'); bad++; n++; return; }
        S.link = (i === 1);
        const g = JF.hookGeom(pose, S);

        /*  s — **축방향**. 코너(절곡부)에서 종방향까지가 R 이어야 한다.
            한때 여기 `oks = true` 라고 박아 두고 「s = 0 접선점」이라고 적어 두었다.
            **재지 않고 통과시킨 것**이고, 그 사이 실제로는 평균 66 mm 어긋나 있었다
            (jfield hookSetup 주석). 이제 잰다.                                  */
        const half = L / 2;
        const sOff = ((S.hookEnd === 1) ? (half - g.a) : (g.a + half)) - R;
        /*  재는 자는 **띠**다 : s ∈ [0, ℓ−R]. 아래로 벗어나면 절곡 아크를 파고든
            것이고, 위로 벗어나면 종방향이 다리 밖이라 아예 못 문 것이다. 그 사이는
            덕트·이웃 철근에 밀린 **타협**이고, 얼마나 밀렸는지는 아래에 찍는다.
            여유 2 mm 는 폴리라인 코너와 푼 자세의 차다 (`bench/jsre.js` ⑦).      */
        const okh = Math.abs(g.h - g.target) < 0.3;
        const oks = sOff >= -2 && sOff <= (LEG - R) + 2;
        n++; if (!(okh && oks)) bad++;
        /*  피복은 **그 점이 선 x** 에서 잰다 (데크가 -3% 로 기울어 있다).
            한때 `deckTop(S.hookQ.x)` 로 쟀는데, 그러면 상면은 종방향의 x 에서
            재면서 y 는 코너의 x 에서 가져온다 — 두 x 가 250 mm 떨어져 있어
            −3% 로 7.5 mm 가 어긋났다. 다리가 수평일 때는 안 보였고, ⑥(평행항)이
            다리를 데크와 나란히 돌리자 51 → 59 로 보여 **피복이 변한 것처럼**
            보였다. 변한 것은 피복이 아니라 이 측정이다 (bench/jpar.js 가 벽까지의
            수직거리로 제대로 재면 1.0~1.8 mm 안쪽, 곧 피복 51.0~51.8 이다).      */
        const c = (i === 2) ? (deckTop(a.x) - a.y - DIA / 2) : null;
        console.log('  ' + String(X).padStart(5) + '      ' + sg.label +
            '    (' + S.hookQ.x.toFixed(0).padStart(5) + ',' + S.hookQ.y.toFixed(1).padStart(7) + ')' +
            '   ' + g.h.toFixed(2).padStart(6) + ' ' + g.target.toFixed(1).padStart(6) +
            '   ' + (c == null ? '     -' : c.toFixed(1).padStart(6)) +
            '   ' + (i === 0 ? body.toFixed(1).padStart(7) : '       ') +
            '  ' + (i === 0 ? ('깊이 ' + (deckTop(S.hookQ.x) - S.hookQ.y).toFixed(0)).padStart(9)
                            : ('깊이 ' + (deckTop(S.hookQ.x) - S.hookQ.y).toFixed(0)).padStart(9)) +
            '  s ' + sOff.toFixed(1).padStart(6) +
            '   ' + (okh && oks ? '✓' : (okh ? '✗ 띠 밖' : '✗ 자리')));
    });
    /*  **비켜난 자리는 까닭을 찍는다.** ⑦(축방향)은 ㄷ 전체로 한 번 더 내리는
        블록이라(`JField.axialSlide`), 얼마나 옮겼고 J 가 얼마나 내려갔는지가
        그대로 나온다. 옮겼는데 J 가 안 내려갔으면 그게 결함이다.               */
    const sl = r.slide;
    if (sl && Math.abs(sl.d) > 2) {
        const drop = sl.J0 > 0 ? (sl.J0 / Math.max(sl.J, 1e-9)) : 1;
        console.log('           ↳ ⑦ 축방향 : ' + sl.d.toFixed(1) + ' mm 미끄러졌다 (h ' +
            sl.h0.toFixed(1) + ' → ' + sl.h.toFixed(1) + ' · 띠 [' + sl.lo.toFixed(0) + ',' +
            sl.hi.toFixed(0) + '])  J ' + sl.J0.toFixed(0) + ' → ' + sl.J.toFixed(0) +
            (sl.J < sl.J0 ? '  (' + drop.toFixed(1) + '배 내려갔다)' : '  ✗ 안 내려갔다'));
        if (!(sl.J < sl.J0)) bad++;
    }
});
console.log('   ' + '─'.repeat(86));
console.log('\n  다리는 h = need(' + NEED + ') — 이것은 **요구**다 (종방향에 닿는다).');
console.log('  축방향은 띠 s ∈ [0, ' + (LEG - R) + '] 이고, s = 0(접선점)은 **선호**다 — 정착이 가장 길다.');
console.log('  막는 것이 없으면 선호가 접선점을 고르고, 막히면 띠 안에서 비켜난다 (⑦ JField.axialSlide).');
console.log('\n  다리 ' + n + '개 중 ' + (n - bad) + '개 통과' + (bad ? '  ✗ ' + bad + '개 어긋남' : ''));
process.exit(bad ? 1 : 0);
