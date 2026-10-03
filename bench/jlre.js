/*  bench/jlre.js — **종방향 철근이 횡방향 철근을 밀어내는가.**
 *
 *  이 저장소에는 오랫동안 한 방향만 있었다 :
 *    횡방향 → 종방향   `jlong.js` 의 `tre`·`bend` 배리어 (`_trebarPrimitives`)
 *    종방향 → 횡방향   **없었다**
 *  같은 두 철근이 닿는 일인데 한쪽에서만 힘이 났다. 갈고리(ㄷ)는 종방향에 걸려
 *  서는 철근이라 이 방향이 없으면 설 자리 자체가 정해지지 않는다.
 *
 *  재는 법 — 조각을 먼저 **종방향 없이** 앉히고, 그 자리 한가운데에 종방향을
 *  하나 놓는다. 겹침이 need 만큼이라 제일 센 자리다. 조각은 비켜나야 하고,
 *  비켜난 뒤의 중심거리가 need 여야 한다.
 *
 *  못 지키는 자리를 **결함과 구분**한다 :
 *    덕트를 빼면 need 에 닿는다  → 덕트와 벽 사이에 끼어 있는 자리다. 타협이 맞다
 *    덕트를 빼도 못 닿는다       → 결함이다
 *
 *  마지막 열은 같은 일을 덕트 무게(K_CLR)로 해 본 것이다. 겹친 채 멈추는 것이
 *  보인다 — `jlong` 이 같은 접촉을 K_BAR 1000 으로 미는데 여기서만 4 로 밀면
 *  **한 접촉이 아니다.** K_LRE 가 1000 인 이유가 이 열이다.
 *
 *  실행 :  node bench/jlre.js
 */
'use strict';
const fs = require('fs'), path = require('path');
const { prepare } = require('./jengine');
const JField = require('../jfield');

const fix = f => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture', f + '.json'), 'utf8'));
const D = prepare(fix('s14'), {}, 'box');
const sec = { covers: D.covers };

const LDIA = 13;                        // 끼워 넣을 종방향 철근의 지름
const OK = 0.5;                         // 이만큼 모자란 것까지는 닿은 것으로 본다 (mm)

function segOf(bar, k) {
    const s = bar.segs[k];
    const vx = s.p2.x - s.p1.x, vy = s.p2.y - s.p1.y;
    const mid = { x: (s.p1.x + s.p2.x) / 2, y: (s.p1.y + s.p2.y) / 2 };
    return { label: s.label, len: Math.hypot(vx, vy) || 1, dia: bar.dia, n0: s.normal,
             p1: s.p1, p2: s.p2, th0: Math.atan2(vy, vx), mid: mid, c0: mid };
}
const endsOf = (sg, pose) => {
    const h = sg.len / 2, ux = Math.cos(pose.th) * h, uy = Math.sin(pose.th) * h;
    return [{ x: pose.cx - ux, y: pose.cy - uy }, { x: pose.cx + ux, y: pose.cy + uy }];
};

//  조각을 ducts 아래서 앉히고, 그 자리 한가운데의 종방향을 놓았을 때의 중심거리
function run(sg, ducts) {
    const r0 = JField.settle(sg, D.walls, sec, ducts, [], []);
    if (r0.stopped === 'no-target') return null;
    const e0 = endsOf(sg, r0.pose);
    const q = { x: (e0[0].x + e0[1].x) / 2, y: (e0[0].y + e0[1].y) / 2, dia: LDIA };
    const r1 = JField.settle(sg, D.walls, sec, ducts, [], [q]);
    return { need: JField.lreNeed(q, sg.dia), d: JField.segToPoint(endsOf(sg, r1.pose), q), q: q };
}

let bad = 0, tight = 0, n = 0, sum2 = 0, sum4 = 0;
console.log('종방향 → 횡방향 척력 (jfield ④ · K_LRE ' + JField.CONF.K_LRE + ')\n');
console.log('  철근       need   종방향을 놓으면   덕트 빼면    무게 4 라면');
console.log('  ' + '─'.repeat(66));

D.bars.forEach(bar => {
    bar.segs.forEach((_, k) => {
        const sg = segOf(bar, k);
        if (!JField.targets(sg, D.walls, sec, sg.dia).length) return;
        const a = run(sg, D.ducts);
        if (!a) return;
        n++;

        const keep = JField.CONF.K_LRE;
        JField.CONF.K_LRE = JField.CONF.K_CLR;
        const w4 = run(sg, D.ducts);
        JField.CONF.K_LRE = keep;
        sum2 += a.d; sum4 += w4 ? w4.d : 0;

        if (a.d >= a.need - OK) return;                 // 지켰다 — 조용히 넘어간다
        const b = run(sg, []);                          // 못 지켰다. 덕트 탓인가
        const byDuct = b && b.d >= b.need - OK;
        if (byDuct) tight++; else bad++;
        console.log('  ' + (bar.id + '[' + sg.label + ']').padEnd(11) +
            String(a.need.toFixed(1)).padStart(5) + '   ' +
            ('✗ ' + a.d.toFixed(1)).padEnd(17) +
            ((byDuct ? '✓ ' : '✗ ') + (b ? b.d.toFixed(1) : '-')).padEnd(12) +
            (w4 ? w4.d.toFixed(1) : '-') +
            (byDuct ? '      ← 덕트와 벽 사이에 끼어 있다' : '      ← **결함**'));
    });
});

console.log('  ' + '─'.repeat(66));
console.log('\n  조각 ' + n + '개 · 지킨 것 ' + (n - tight - bad) +
            ' · 덕트에 끼어 못 지킨 것 ' + tight + (bad ? ' · **결함 ' + bad + '**' : ' · 결함 없음'));
console.log('  평균 중심거리 :  K_LRE ' + JField.CONF.K_LRE + ' 에서 ' + (sum2 / n).toFixed(1) +
            ' mm  ·  무게 4 에서 ' + (sum4 / n).toFixed(1) + ' mm');
console.log('  → 무게가 낮으면 **겹친 채로 멈춘다**. 같은 접촉을 두 엔진이 같은 수로 밀어야 한다.');
process.exit(bad ? 1 : 0);
