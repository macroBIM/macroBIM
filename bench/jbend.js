/*  bench/jbend.js — **종방향이 횡방향의 절곡부 «안»에 끼지 않는가.**
 *
 *  갈고리에서 정한 규칙은 종방향을 놓을 때도 그대로다 — 철근은 절곡 아크가 아니라
 *  **그 전 직선 구간**에 닿는다. 도면의 갈고리 상세가 그렇게 그려져 있다.
 *
 *  그런데 `jlong` 의 아크 배리어는 오목한 쪽에서도 **반지름 방향**으로 밀고 있었다 —
 *  곡률중심 쪽으로. 그러면 철근이 코너에 **박힌다.** S14 에서 실제로 여섯이
 *  곡률중심에서 정확히 R−need 에 끼어 있었다 :
 *
 *      D1#0 · #49 · #50 · #95   19.5 = 32.5 − 13      (①-1 ① ②-1 ② 의 선단 절곡)
 *      D1#11 · #38              70.5 = 88.0 − 17.5    (⑥-4 ⑥-1 의 복부 절곡)
 *
 *  고친 뒤에는 **접선 방향으로 빠져나와** 직선 구간에 닿는다 (toPrim 의 `corner`).
 *
 *  실행 :  node bench/jbend.js
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

const JL = vm.runInContext('JLong', ctx);
const prims = [];
Domain.trebarList.forEach(t => (P._trebarPrimitives(t) || []).forEach(pr =>
    prims.push({ t: pr.t, p: pr.p, dia: t.dia || 13, id: String(t.id) })));

let wedged = 0, bite = 0, n = 0;
const list = [];
Domain.lrebarList.forEach(g => {
    const dia = g.dia || 13;
    (g.particles || []).forEach((q, i) => {
        n++;
        let line = null, arc = null;
        prims.forEach(pr => {
            const need = (pr.dia + dia) / 2;
            const e = JL.toPrim(q, pr, need + dia + 200);
            if (!e) return;
            const d = Math.abs(e.d);
            if (pr.t === 'line') { if (!line || d < line.d) line = { d: d, need: need, id: pr.id }; }
            else {
                const rho = Math.hypot(q.x - pr.p[0], q.y - pr.p[1]);
                if (!arc || d < arc.d) arc = { d: d, need: need, id: pr.id, corner: !!e.corner, rho: rho, R: pr.p[2] };
            }
        });
        if (arc && arc.corner) {               // 절곡부 **안**에 있다
            wedged++;
            list.push('   ' + (g.id + '#' + i).padEnd(8) + ' 절곡부 안 (' + arc.id + ')  곡률중심에서 ' +
                      arc.rho.toFixed(1) + ' / R ' + arc.R.toFixed(1));
        }
        if (line && line.d < line.need - 0.3) { bite++;
            list.push('   ' + (g.id + '#' + i).padEnd(8) + ' 직선(' + line.id + ') 을 ' +
                      (line.need - line.d).toFixed(1) + ' mm 파고든다'); }
        if (arc && !arc.corner && arc.d < arc.need - 0.3) { bite++;
            list.push('   ' + (g.id + '#' + i).padEnd(8) + ' 아크(' + arc.id + ') 를 ' +
                      (arc.need - arc.d).toFixed(1) + ' mm 파고든다'); }
    });
});

console.log('종방향 ' + n + '개 · 횡방향 조각 ' + prims.length +
            '개 (직선 ' + prims.filter(p => p.t === 'line').length +
            ' · 아크 ' + prims.filter(p => p.t === 'arc').length + ')\n');
console.log('  절곡부 «안»에 낀 것 : ' + wedged + '개');
console.log('  횡방향을 파고든 것  : ' + bite + '개');
if (list.length) { console.log(''); list.slice(0, 20).forEach(t => console.log(t)); }
console.log('\n  철근은 절곡 아크가 아니라 **그 전 직선 구간**에 닿아야 한다.');
console.log('  (고치기 전 : D1 여섯이 코너에 박혀 있었다 — 19.5 = 32.5−13 · 70.5 = 88−17.5)');
console.log('\n  → ' + ((wedged || bite) ? '✗ 어긋남' : '전부 직선 구간에 닿는다'));
process.exit((wedged || bite) ? 1 : 0);
