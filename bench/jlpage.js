/*  bench/jlpage.js — **페이지 경로 그대로** 종방향 철근을 J 로 푼다.
 *
 *  `bench/jlbench.js` 는 엔진(`jlong.js`)만 직접 부르지만, 여기서는 시트 한 줄을
 *  넣고 페이지가 하는 차례를 그대로 태운다 :
 *    _parseRebar → Domain._createLrebarFromData → _solveWithJField → _solveLrebarWithJ
 *  화면에서 「Load Excel」 한 것과 같은 길이다. particles 까지 확인한다.
 *
 *    node bench/jlpage.js
 */
'use strict';
const path = require('path');
const vm = require('vm');
const fs = require('fs');
const { prepare } = require('./jengine');

const ROOT = path.join(__dirname, '..');

//  시트에 넣을 lrebar 한 줄 (화면 입력표의 칸 차례 그대로)
//   0        1     2     3        4            5         6      7      8       9      10    11    12
//  lrebar | id | dia | num | init(x,y,rot)| range(−,+)| nors | ctc | ctcmax | ctcmin | gap | path | z
//  gap 을 주면 한 줄이 상·하 두 줄이 된다 (정상 최대 509 mm · 복부 6,700 mm 이라 600 이면 갈린다)
const ROW = ['lrebar', 'D1', 13, 50, '0,-100,0', '-6200,6200', 1, 250, 300, 100, 600, '', 0, ''];

const sheet = JSON.parse(JSON.stringify(require('./fixture/s14.json')));
const at = sheet.findIndex(r => String(r[0] || '').trim().toLowerCase() === 'end');
sheet.splice(at < 0 ? sheet.length : at, 0, ROW);

const D = prepare(sheet, {}, 'box');
const { ctx, P, rows, sec } = D;
const Domain = vm.runInContext('Domain', ctx);
['jfield.js', 'jlong.js'].forEach(f =>
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));

//  페이지가 하는 대로 채운다
P._rebarData = rows;
P._engine = 'jfield';
Domain.trebarList = []; Domain.lrebarList = []; Domain.queue = [];
rows.forEach(rd => {
    const t = String(rd.type || 'trebar').toLowerCase();
    if (t === 'trebar') {
        const rb = Domain._createTrebarFromData(rd);
        if (rb) { Domain.trebarList.push(rb); Domain.queue.push({ kind: 'trebar', obj: rb }); }
    } else if (t === 'lrebar') {
        const g = Domain._createLrebarFromData(rd);
        if (g) { Domain.lrebarList.push(g); Domain.queue.push({ kind: 'lrebar', obj: g }); }
    }
});

console.log(`입력 : trebar ${Domain.trebarList.length} · lrebar ${Domain.lrebarList.length}`);
const toasts = [];
P._toast = (m) => toasts.push(m);

const ok = P._solveWithJField();
console.log(`_solveWithJField → ${ok}`);

Domain.lrebarList.forEach(grp => {
    const d = (P._ldiag || {})[String(grp.id)];
    console.log(`\n══ ${grp.id} ══  ${grp.particles ? grp.particles.length : 0} 개 · state ${grp.state}` +
        (d && d.dropped ? `  (짝 ${d.dropped}개 버림)` : ''));
    if (!d) { console.log('  (J 로 안 풀렸다)'); return; }
    const g = d.g, res = d.res;
    console.log(`  D${g.dia} × ${g.num}  ctc ${g.ctc}  range ${g.range.min}..${g.range.max}  ` +
                `ctcmin ${g.ctcmin} ctcmax ${g.ctcmax}  nors ${g.nors} → 법선 (${res.axes.n.x.toFixed(2)},${res.axes.n.y.toFixed(2)})`);
    console.log(`  담을 수 있는 개수 ${res.capacity} · 열차 ${(g.num - 1) * g.ctc} mm / 한계 ${g.range.max - g.range.min} mm`);

    const seat = {};
    res.bars.forEach(b => { const k = b.rest || '없음'; seat[k] = (seat[k] || 0) + 1; });
    console.log('  앉은 면 : ' + Object.keys(seat).map(k => `${k} ${seat[k]}개`).join(' · '));

    const show = [0, 1, 2, Math.floor(res.bars.length / 2), res.bars.length - 2, res.bars.length - 1];
    console.log('   #      t        좌표             면      피복여유');
    show.filter((v, i, a) => a.indexOf(v) === i).forEach(i => {
        const b = res.bars[i];
        console.log(`  ${String(i).padStart(2)}  ${String(Math.round(b.t)).padStart(6)}  ` +
            `(${String(Math.round(b.x)).padStart(6)},${String(Math.round(b.y)).padStart(6)})   ` +
            `${String(b.rest || '없음').padEnd(6)} ${b.slack == null ? '   -' : b.slack.toFixed(1).padStart(7)}`);
    });
    if (d.pair) {
        const seatB = {};
        d.pair.bars.forEach((b, i) => {
            const a = res.bars[i]; if (!a) return;
            const sep = Math.hypot(b.x - a.x, b.y - a.y);
            const k = (sep > g.gap) ? '버림' : (b.rest || '없음');
            seatB[k] = (seatB[k] || 0) + 1;
        });
        console.log('  아래쪽 줄 : ' + Object.keys(seatB).map(k => `${k} ${seatB[k]}개`).join(' · '));
        console.log('  버린 자리 : ' + d.pair.bars.map((b, i) => {
            const a = res.bars[i]; if (!a) return null;
            const sep = Math.hypot(b.x - a.x, b.y - a.y);
            return sep > g.gap ? `x ${Math.round(b.x)} (간격 ${Math.round(sep)})` : null;
        }).filter(Boolean).join('  ') || '없음');
    }
    const lo = Math.min.apply(null, res.gaps), hi = Math.max.apply(null, res.gaps);
    console.log(`  간격 : 최소 ${Math.round(lo)} · 최대 ${Math.round(hi)}  (한계 ${g.ctcmin}..${g.ctcmax})`);
    console.log(`  J ${res.J == null ? '-' : Math.round(res.J)} · 반복 ${res.iter}`);
    //  그림이 읽는 자리까지 확인
    const p0 = grp.particles && grp.particles[0];
    console.log(`  particles[0] = (${p0 ? Math.round(p0.x) : '-'},${p0 ? Math.round(p0.y) : '-'}) state ${p0 ? p0.state : '-'}`);
});

console.log('\n토스트 :');
if (!toasts.length) console.log('  (없음)');
toasts.forEach(t => String(t).split(' · ').forEach(x => console.log('  · ' + x)));
