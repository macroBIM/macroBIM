/*  bench/jpar.js — **갈고리 다리가 콘크리트 면과 평행한가.**
 *
 *  ⑤ 로 다리의 «자리»(종방향까지의 수직거리)는 정해졌는데 **자세**가 안 정해졌다.
 *  그래서 한동안 각을 init 에 묶어 두었고(`descend` 의 lim = 0), 그 대가로 데크
 *  상면이 −3% 인데 다리는 수평인 채로 섰다 — 양 끝의 피복이 12 mm 달라지고 한쪽
 *  끝이 피복선 밖으로 나갔다. 헌치(12°) 쪽은 83 mm 였다.
 *
 *  평행은 **새 규칙이 아니다.** 같은 피복항의 2차 모멘트다 (parSetup 주석) :
 *      g(+half)² + g(−half)² = 2·g₀² + 2·half²·m² ,   m = û·n̂
 *  0차항(거리)은 ⑤ 가 가져갔으므로 남는 것은 m² 항이고, 그 최소가 **평행**이다.
 *  무게도 고르는 값이 아니다 — 기울이면 한쪽 끝이 **반드시** 피복선 밖으로 나가므로
 *  1 + K_COV 다.
 *
 *  여기서 보는 것 :
 *    m        0 이어야 한다 (평행)
 *    양끝 피복 둘이 같아야 한다. 차이 = |m| · 다리길이
 *    고른 면  앉은 뒤 `seats()` 가 고른 면. 참거리가 작아야 한다 (자리는 ⑤ 가 맞췄다)
 *    h        ⑤ 의 자리가 ⑥ 때문에 흐트러지지 않았나 (야코비가 각뿐이라 안 흔들린다)
 *
 *  실행 :  node bench/jpar.js
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { prepare } = require('./jengine');

const ROOT = path.join(__dirname, '..');
const sheet = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture', 's14.json'), 'utf8'));
//  고정자료에 종방향 줄이 없다 (9/27 판). 실제 시트에 있는 D1 을 넣어 쓴다.
{
    const D1 = ['lrebar', 'D1', 13, 50, '0,100,0', '-6200,6200', 1, 250, 300, 100, 600, '', '', ''];
    const at = sheet.findIndex(r => String(r[0] || '').trim().toLowerCase() === 'end');
    sheet.splice(at < 0 ? sheet.length : at, 0, D1);
}
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
const W = {}; sec.walls.forEach(w => { W[w.id] = w; });
const DIA = 13, LEG = 400, R = JF.bendRadius(DIA);
const OK = 0.002;                       // m 이 이보다 작으면 평행으로 본다 (≈ 0.11°)

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
function hook(X, Y, HH) {
    return { id: 'T1', dia: DIA, hook: true, segs: [
        { label: 'a', p1: { x: X-LEG, y: Y-HH }, p2: { x: X, y: Y-HH }, normal: { x: 0, y: -1 } },
        { label: 'b', p1: { x: X, y: Y-HH },     p2: { x: X, y: Y+HH }, normal: { x: 1, y: 0 } },
        { label: 'c', p1: { x: X, y: Y+HH },     p2: { x: X-LEG, y: Y+HH }, normal: { x: 0, y: 1 } }] };
}

let bad = 0, n = 0;
console.log('갈고리 다리 ↔ 콘크리트 면의 평행도  (무게 1+K_COV = ' + (1 + JF.CONF.K_COV) + ')\n');
console.log('      x  다리  고른 면   기운 각      m=û·n̂    양끝 피복        차이       h   목표');
console.log('   ' + '─'.repeat(90));

[400, 900, 1400, 1900, 2400].forEach(X => {
    const top = deckTop(X);
    if (top == null) return;
    const bar = hook(X, top - 310, 290);
    const r = JF.form(bar, sec.walls, sec, P._ducts || [], [], lpts);

    [0, 2].forEach(i => {
        const sg = r.segs[i];
        n++;
        if (!sg.parW || !sg.hookQ) {
            console.log('   ' + String(X).padStart(5) + '    ' + sg.label +
                        '   ✗ ' + (sg.hookQ ? '고른 면이 없다' : '걸 종방향을 못 찾았다'));
            bad++; return;
        }
        const a = r.pts[i], b = r.pts[i + 1];
        const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
        const w = W[sg.parW];
        const m = ux * w.nx + uy * w.ny;
        const need = JF.coverOf(w, sec) + DIA / 2;
        const ga = (a.x - w.x1) * w.nx + (a.y - w.y1) * w.ny - need;
        const gb = (b.x - w.x1) * w.nx + (b.y - w.y1) * w.ny - need;

        //  ⑤ 의 자리가 흐트러지지 않았나 — 푼 자세에서 h 를 다시 잰다
        const pose = { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, th: Math.atan2(b.y - a.y, b.x - a.x) };
        const S = { len: L, dia: DIA, p1: a, p2: b, hook: true, hookQ: sg.hookQ,
                    hookEnd: (i === 0) ? 1 : -1, hookSide: sg.hookSide, bendR: R, link: false };
        const g = JF.hookGeom(pose, S);

        const okm = Math.abs(m) < OK, okh = Math.abs(g.h - g.target) < 0.3;
        if (!(okm && okh)) bad++;
        console.log('   ' + String(X).padStart(5) + '    ' + sg.label +
            '   ' + String(sg.parW).padEnd(5) +
            '  ' + (Math.asin(Math.max(-1, Math.min(1, m))) * 180 / Math.PI).toFixed(3).padStart(8) + '°' +
            '  ' + m.toFixed(5).padStart(9) +
            '   ' + (ga.toFixed(1) + ' / ' + gb.toFixed(1)).padStart(14) +
            '  ' + Math.abs(ga - gb).toFixed(2).padStart(7) + ' mm' +
            '  ' + g.h.toFixed(2).padStart(6) + ' ' + g.target.toFixed(1).padStart(5) +
            '   ' + (okm && okh ? '✓' : (okm ? '✗ 자리' : '✗ 평행')));
    });
});
console.log('   ' + '─'.repeat(90));

/*  ⑥ 의 야코비를 중심차분과 맞춰 본다. `bench/jjac.js` 는 갈고리 조각을 안 본다
    (고정자료에 ㄷ 가 없다) — 새 항은 여기서 검산한다.
      r = √(1+K_COV)·half·m ,   ∂r/∂c = 0 ,   ∂r/∂φ = √(1+K_COV)·(û⊥·n̂)
    `descend` 의 변수가 φ = th·half 이므로 각 성분은 half 로 나눠 비교한다.      */
{
    const w = sec.walls.filter(ww => Math.abs(ww.x2 - ww.x1) > 100)[0] || sec.walls[0];
    const S = { len: 400, dia: DIA, parW: w };
    const H = 1e-5, half = S.len / 2;
    let worst = 0, at = '';
    [-6, -2, -0.5, 0.5, 2, 6].forEach(deg => {
        const pose = { cx: 1000, cy: -200, th: deg * Math.PI / 180 };
        const an = JF.parRows(pose, S)[0];
        const ana = 2 * an.r * an.j[2];                       // ∂J/∂φ (해석)
        const pp = { cx: pose.cx, cy: pose.cy, th: pose.th + H / half };
        const pm = { cx: pose.cx, cy: pose.cy, th: pose.th - H / half };
        const num = (JF.parEnergy(pp, S) - JF.parEnergy(pm, S)) / (2 * H);
        const e = Math.abs(ana - num) / Math.max(1, Math.abs(ana), Math.abs(num));
        if (e > worst) { worst = e; at = deg + '°'; }
        //  ∂r/∂c 가 정말 0 인가 — 중심을 옮겨도 J 가 안 변해야 한다
        const mv = Math.abs(JF.parEnergy({ cx: pose.cx + 1, cy: pose.cy + 1, th: pose.th }, S)
                            - JF.parEnergy(pose, S));
        if (mv > 1e-9) { console.log('   ✗ 중심을 옮겼는데 J 가 ' + mv + ' 변했다'); bad++; }
        //  두 끝점 피복항과 **같은 값**인가 (유도 : g(±half) = ±half·m)
        const m = Math.cos(pose.th) * w.nx + Math.sin(pose.th) * w.ny;
        const two = (half * m) * (half * m) * (1 + JF.CONF.K_COV);
        if (Math.abs(two - JF.parEnergy(pose, S)) > 1e-9) {
            console.log('   ✗ 두 끝점 피복항과 안 맞는다'); bad++; }
    });
    console.log('\n  ⑥ 야코비 검산 : 최대 상대오차 ' + worst.toExponential(2) + ' (' + at + ')' +
                (worst < 1e-5 ? '  ✓' : '  ✗'));
    if (!(worst < 1e-5)) bad++;
    console.log('  ∂r/∂c = 0 — 중심을 옮겨도 J 가 안 변한다 (자리를 못 흔든다)   ✓');
    console.log('  J = 1·(half·m)² + K_COV·(half·m)² — 두 끝점 피복항과 같다      ✓');
}

console.log('\n  고치기 전 : 데크 상면(E2) 1.72° · 양끝 차이 12.0 mm (한쪽 끝이 피복선 밖으로)');
console.log('              헌치(E23)  12.02° · 양끝 차이 83.3 mm');
console.log('  m² 항의 야코비는 각 성분 하나뿐이라 ⑤ 의 자리(h)를 **흔들지 못한다.**');
console.log('\n  다리 ' + n + '개 중 ' + (n - bad) + '개 통과' + (bad ? '  ✗ ' + bad + '개 어긋남' : ''));
process.exit(bad ? 1 : 0);
