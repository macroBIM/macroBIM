/*  bench/jlbench.js — 종방향 철근을 J 로 배치한 결과를 숫자로 찍는다 (`jlong.js`).
 *
 *  확인하려는 것 셋 :
 *    ① 마주보는 면으로 끌려간다            (nors ↔ 벽 법선 게이트)
 *    ② 이미 놓인 철근만큼 밀려난다 (적층)   — 규칙이 아니라 순간격 항의 결과
 *    ③ 절곡부에서 안/바깥 — **두 바닥의 J 를 둘 다** 찍는다 (논문 근거)
 *  그리고 간격(ctc · ctcmin · ctcmax)과 배치한계(range)가 지켜지는지.
 *
 *    node bench/jlbench.js
 */
'use strict';
const path = require('path');
const vm = require('vm');
const fs = require('fs');
const { prepare } = require('./jengine');

const ROOT = path.join(__dirname, '..');
const JField = require('../jfield');
const JLong = require('../jlong');

const hyp = (x, y) => Math.sqrt(x * x + y * y);
const P4 = n => String(Math.round(n)).padStart(6);

//  ── 단면과 횡방향 철근 ────────────────────────────────────────────────
const D = prepare(require('./fixture/s14.json'), {}, 'box');
const { ctx, P, rows, sec } = D;
const Domain = vm.runInContext('Domain', ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'jfield.js'), 'utf8'), ctx, { filename: 'jfield.js' });

P._rebarData = rows;
P._engine = 'jfield';
Domain.trebarList = [];
rows.forEach(rd => {
    if (String(rd.type || 'trebar').toLowerCase() !== 'trebar') return;
    const t = Domain._createTrebarFromData(rd);
    if (t) Domain.trebarList.push(t);
});
P._solveWithJField();

//  절곡철근을 **굴짐 아크까지 포함한 조각들**로 꺼낸다 (화면이 그리는 그것)
const prims = [];
Domain.trebarList.forEach(t => {
    (P._trebarPrimitives(t) || []).forEach(pr => prims.push(Object.assign({ dia: t.dia || 13 }, pr)));
});
console.log(`횡방향 ${Domain.trebarList.length} 개 · 조각(선분+아크) ${prims.length} 개 ` +
            `(아크 ${prims.filter(p => p.t === 'arc').length})`);

//  ── 시험용 lrebar ─────────────────────────────────────────────────────
/*  L1 : 상부슬래브 **하면**(셀 천장 : E15·E16·E24·E23) 을 따라가는 줄.
         법선은 아래(↓) — 벽 법선이 위(콘크리트 쪽)라 마주본다.
         횡방향 ⑤ 가 같은 면에 먼저 누워 있어서 **적층**이 여기서 나온다.
    L2 : 하부슬래브 **하면**(소핏 : E9) 왼쪽 끝, ⑨-1 의 **절곡부** 바로 옆.
         법선은 아래(↓). 굴짐 아크가 코앞이라 **안/바깥 두 바닥**이 여기서 나온다.  */
const GROUPS = [
    { id: 'L1', dia: 16, num: 23, init: { x: 0, y: -200, rot: 0 }, nors: -1,
      range: { min: -3000, max: 3000 }, ctc: 260, ctcmin: 50, ctcmax: 300, path: [] },
    { id: 'L2', dia: 16, num: 7, init: { x: -3200, y: -6600, rot: 0 }, nors: -1,
      range: { min: -300, max: 300 }, ctc: 100, ctcmin: 50, ctcmax: 300, path: [] }
];

GROUPS.forEach(group => {
    console.log(`\n══════ 무리 ${group.id}  D${group.dia} × ${group.num}개  ctc ${group.ctc}  ` +
        `range ${group.range.min}..${group.range.max}  ctcmin ${group.ctcmin} ctcmax ${group.ctcmax} ══════`);
    console.log(`  init (${group.init.x},${group.init.y}) rot ${group.init.rot}° · nors ${group.nors} ` +
        `→ 법선 (${JLong.axes(group).n.x.toFixed(2)},${JLong.axes(group).n.y.toFixed(2)})`);
    console.log(`  담을 수 있는 개수 ${JLong.capacity(group)} 개 · 열차 길이 ${(group.num - 1) * group.ctc} mm ` +
        `(한계 구간 ${group.range.max - group.range.min} mm)` +
        ((group.num - 1) * group.ctc > group.range.max - group.range.min ? '   ✗ 한계보다 길다' : ''));

    const res = JLong.solve(group, D.walls, sec, D.ducts, prims);

    console.log('\n  #   태어난 t →  앉은 t   이동      좌표            앉은 면  피복여유');
    res.bars.forEach(b => {
        console.log(`  ${String(b.i).padStart(2)}  ${P4(b.t0)} → ${P4(b.t)}  ${P4(b.t - b.t0)}   ` +
            `(${P4(b.x)},${P4(b.y)})   ${String(b.rest || '없음').padEnd(5)} ` +
            `${b.slack == null ? '   -' : b.slack.toFixed(1).padStart(6)}`);
    });

    console.log('\n  간격 (t 축) :  ' + res.gaps.map(g => Math.round(g)).join('  '));
    const gmin = Math.min.apply(null, res.gaps), gmax = Math.max.apply(null, res.gaps);
    console.log(`  최소 ${Math.round(gmin)} (한계 ${group.ctcmin})  ·  최대 ${Math.round(gmax)} (한계 ${group.ctcmax})` +
        (gmin < group.ctcmin - 0.5 ? '   ✗ 최소간격 위반' : '') +
        (gmax > group.ctcmax + 0.5 ? '   ✗ 최대간격 위반' : ''));
    const outOf = res.bars.filter(b => b.t < group.range.min - 0.5 || b.t > group.range.max + 0.5);
    console.log('  배치한계 : ' + (outOf.length ? `✗ ${outOf.length} 개가 벗어났다` : '전부 안'));
    const noSeat = res.bars.filter(b => !b.rest);
    console.log('  붙을 면  : ' + (noSeat.length ? `✗ ${noSeat.length} 개가 못 찾았다` : '전부 찾았다'));

    const assign = res.bars.map(b => {
        const p = { x: b.x, y: b.y };
        const st = JLong.seatsAt(p, res.axes.n, D.walls, sec, group.dia).filter(c => c.used);
        return st.length ? JLong.nearestSeat(p, st) : null;
    });
    const pp = JLong.parts(res.bars.map(b => ({ x: b.x, y: b.y })), group,
        { assign: assign, home: res.home, ducts: D.ducts, prims: prims, stage: 2 });
    console.log('\n  J 항별 :  ' + Object.keys(pp).filter(k => k !== 'total')
        .map(k => `${k} ${pp[k].toFixed(1)}`).join('  ') + `   합 ${pp.total.toFixed(1)}`);
    console.log(`  반복 ${res.iter}`);

    //  절곡부 — 두 바닥의 J. **아크가 실제로 밀고 있는 철근만** 본다.
    const hits = [];
    res.bars.forEach(b => {
        let nd = Infinity;
        prims.filter(pr => pr.t === 'arc').forEach(pr => {
            const e = JLong.toPrim({ x: b.x, y: b.y }, pr);
            if (e && e.d < nd) nd = e.d;
        });
        if (nd < 3 * group.dia) hits.push({ b: b, d: nd });
    });
    console.log('\n  절곡부 — 안/바깥 두 바닥의 J');
    if (!hits.length) console.log(`   (굴짐 아크 ${3 * group.dia} mm 안에 든 철근이 없다)`);
    hits.slice(0, 4).forEach(h => {
        const q = JLong.pockets(group, D.walls, sec, D.ducts, prims, res, h.b.i);
        console.log(`   #${h.b.i}  아크까지 ${Math.round(q.d)} mm (필요 ${q.need}) · 지금 **${q.side}** 쪽` +
            `   여기 J ${q.here.toFixed(0)}  ·  건너편 J ${q.other == null ? '-' : q.other.toFixed(0)}` +
            (q.other != null ? (q.here <= q.other ? '   → 여기가 낮다'
                                                  : '   → 건너편이 낮다 (init 이 이쪽에 두었다)') : ''));
    });
});
