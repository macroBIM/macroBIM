/*  bench/jspawn.js — **태어난 자리**를 검사한다. 푸는 것과 무관하다.
 *
 *  ── 왜 이 검사가 따로 있나 ─────────────────────────────────────────────
 *  J 는 한 번에 푼다. 그래서 화면에도 표에도 **결과만** 남고, 그 결과가 「입력이
 *  이상해서 그렇게 된 것」인지 「엔진이 이상해서 그렇게 된 것」인지 구별되지 않는다.
 *  실제로 ⑧-1 의 다리가 하부슬래브가 아니라 캔틸레버 선단에 붙은 일이 있었는데,
 *  원인은 엔진이 아니라 **기본값 400 mm 다리가 복부 밑에서 끝나 제 면(하부슬래브
 *  상면) 위로 나오지 못한 것**이었다 — 띠가 50 mm 모자랐다. 그 50 mm 는 결과를
 *  아무리 들여다봐도 안 보이고, **태어난 자리에서 무엇이 보였나**를 봐야 나온다.
 *
 *  `JField.seats()` 는 버린 면까지 다 돌려준다. 그것을 조각마다 그대로 찍는다.
 *    참거리   피복면(유한한 토막)까지의 거리
 *    면 위에  조각의 축 범위 안에 그 면이 있나
 *    모자람   띠가 모자란 거리 (0 이면 면 위에 있다)
 *
 *  ── 무엇을 어긋남으로 보나 ─────────────────────────────────────────────
 *    ✗ 붙을 면 없음        법선 방향에 마주보는 면이 하나도 없다
 *    ✗ 가장 가까운 면이 빠짐  참거리로 가장 가까운 면이 **조각의 축 범위 밖**이라
 *                          후보가 못 되고, 더 먼 면이 쓰였다. 엔진은 규칙대로
 *                          움직인 것이고 **입력이 모자란 것**이다 — 그 차이를 찍는다.
 *  참거리가 **크다고 어긋난 것이 아니다** — ㄷ자 스터럽의 다리는 길이를 안 주면
 *  3.2 m 를 가서 하면에 앉는다. 그것이 이 엔진의 기능이다(코너가 길이를 정한다).
 *
 *    node bench/jspawn.js            도면 입력
 *    node bench/jspawn.js strip      segs 미입력 (전부 기본 400) — 위 사고의 재현
 */
'use strict';
const path = require('path');
const { prepare } = require('./jengine');
const JField = require('../jfield');

const STRIP = process.argv.slice(2).includes('strip');
const hyp = (x, y) => Math.sqrt(x * x + y * y);
const pad = (s, n) => String(s).padStart(n);

function diag(bar, walls, sec) {
    const dia = bar.dia || 13;
    return bar.segs.map(s => {
        const len = hyp(s.p2.x - s.p1.x, s.p2.y - s.p1.y) || 1;
        const mid = { x: (s.p1.x + s.p2.x) / 2, y: (s.p1.y + s.p2.y) / 2 };
        const seg = { label: s.label, len: len, dia: dia, n0: s.normal,
                      p1: s.p1, p2: s.p2, mid: mid, c0: mid,
                      th0: Math.atan2(s.p2.y - s.p1.y, s.p2.x - s.p1.x) };
        //  seats() 는 벽 객체를 그대로 물고 온다 (c.w) — 찍기 쉽게 풀어 둔다
        const seats = JField.seats(seg, walls, sec, dia)
            .map(c => ({ id: c.w.id, tag: c.w.tag, d: c.d, band: c.band, gap: c.gap, used: c.used }))
            .sort((a, b) => a.d - b.d);
        const use = seats.filter(c => c.used);
        return {
            label: s.label, p1: s.p1, p2: s.p2, len: len, n: s.normal, seats: seats,
            none: use.length === 0,
            //  가장 가까운 면(seats[0])이 후보(use[0])가 아니면 입력이 모자란 것이다
            miss: (use.length && seats.length && seats[0].id !== use[0].id)
                  ? { near: seats[0], seat: use[0] } : null,
            reach: use.length ? use[0].d : null
        };
    });
}

const patch = STRIP ? { rows: rows => rows.map(r => Object.assign({}, r, { segs: '' })) } : {};
const D = prepare(require('./fixture/s14.json'), patch, 'box');
const sec = { covers: D.covers };

console.log(`\n=== S14 · 태어난 자리 검사${STRIP ? ' · segs 미입력 (전부 기본 400)' : ''} ===`);
let bad = 0;
D.bars.forEach(bar => {
    diag(bar, D.walls, sec).forEach(d => {
        const tag = d.none ? '  ✗ 붙을 면 없음'
                  : (d.miss ? `  ✗ 가장 가까운 ${d.miss.near.id} ${Math.round(d.miss.near.d)} mm 가 ` +
                              `${Math.round(d.miss.near.gap)} mm 차이로 빠지고 ${d.miss.seat.id} ` +
                              `${Math.round(d.miss.seat.d)} mm 가 쓰였다` : '');
        if (tag) bad++;
        console.log(
            `  ${(bar.id + '[' + d.label + ']').padEnd(8)} ` +
            `태어난 자리 (${pad(Math.round(d.p1.x), 6)},${pad(Math.round(d.p1.y), 6)})→` +
            `(${pad(Math.round(d.p2.x), 6)},${pad(Math.round(d.p2.y), 6)})  ` +
            `길이 ${pad(Math.round(d.len), 5)}  법선 (${d.n.x.toFixed(2)},${d.n.y.toFixed(2)})  ` +
            `가까운 후보 ${d.reach == null ? '  없음' : pad(Math.round(d.reach), 6) + ' mm'}${tag}`);
        //  후보를 들여다볼 필요가 있는 조각만 펼친다
        if (tag) d.seats.forEach(c => console.log(
            `           ${String(c.id).padEnd(4)} ${String(c.tag || '').padEnd(6)} ` +
            `참거리 ${pad(Math.round(c.d), 6)} mm  면 위에 ${c.band ? '●' : ' '}  ` +
            `모자람 ${pad(c.gap > 0 ? Math.round(c.gap) : '', 5)}  ${c.used ? '후보' : '버림'}`));
    });
});
console.log(bad ? `  → ${bad} 개 조각이 태어난 자리에서 제 면을 못 만난다 (입력을 고칠 자리)`
                : '  → 전부 제 면 위에서 태어났다');
