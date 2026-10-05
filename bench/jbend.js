/*  bench/jbend.js — **종방향이 횡방향 강재를 파고들지 않는가.**
 *
 *  ── 한 번 뒤집힌 자리다. 적어 둔다 ──────────────────────────────────────────
 *  처음에는 「절곡부 «안»에 낀 것」을 **결함으로** 셌다. 갈고리에서 정한 규칙
 *  (철근은 절곡 아크가 아니라 그 전 직선 구간에 닿는다)을 종방향에도 그대로 적용해,
 *  `toPrim` 이 오목한 쪽에서 **접선 방향**으로, `d` 를 「구간 안으로 들어간 호길이」로
 *  주고 need 0 으로 받게 했다.
 *
 *  그 자가 틀렸다. 다른 모든 항(피복·겹침·덕트)은 **표면까지의 mm** 로 재는데 이것만
 *  «영역 안으로 들어간 길이» 로 쟀다. 그래서 크기가 터무니없이 커졌다 :
 *    복부 위 D1 한 알이 ⑥-4 의 절곡 원(R 88) 안에 들자 호길이 33 mm 로 매겨져
 *    **J 492,047 짜리 벽**이 섰다. 그 알은 가장 가까운 강재에서 **41.8 mm** 떨어져
 *    있었다 — 겹친 것이 하나도 없는데 벽이 선 것이고, 피복 인력(10,816)으로는
 *    46 분의 1 이라 못 넘어 알이 **공중에 떴다.**
 *
 *  그래서 **미는 것은 강재지 영역이 아니다** 로 돌렸다 (`toPrim` 주석). 0 이 되는
 *  자리가 영역의 가장자리가 아니라 **강재의 표면**이다. 그러자 뜬 알이 내려와
 *  아크에 **여유 0.0 으로 붙었고**, 종방향 250 개 중 249 개가 강재에 닿았다.
 *
 *  그 결과 **여섯이 절곡부 «안쪽»에 닿아 선다** (ρ = R − need 정확히) :
 *      D1#0 · #49 · #50 · #95   19.5 = 32.5 − 13      (①-1 ① ②-1 ② 의 선단 절곡)
 *      D1#11 · #37              70.5 = 88.0 − 17.5    (⑥-4 ⑥-2 의 복부 절곡)
 *  이것은 **파고든 것이 아니라 닿은 것**이다. 스터럽 코너 «안»은 실제로 종방향이
 *  앉는 자리이기도 하다. 「절곡부 안은 자리가 아니다」는 **갈고리가 종방향을 무는
 *  자리**에서 나온 선호이고, 순간격과 한 항에 섞여 있던 것을 떼어 냈다.
 *  그 선호를 어떤 크기로 돌려줄지는 **아직 안 정했다** — 여기서는 «세기만» 한다.
 *
 *  그래서 이 벤치가 **막는 것은 파고듦 하나**다.
 *
 *  실행 :  node bench/jbend.js
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
console.log('  횡방향을 파고든 것      : ' + bite + '개   ← 이것만 결함이다');
console.log('  절곡부 «안»에 닿은 것   : ' + wedged + '개   (파고든 것이 아니라 «닿은» 것 — 위 주석)');
if (list.length) { console.log(''); list.slice(0, 20).forEach(t => console.log(t)); }
console.log('\n  미는 것은 **강재**지 «영역» 이 아니다 — 0 이 되는 자리가 강재의 표면이다.');
console.log('  절곡부 안에 «닿아» 선 것은 ρ = R − need 로, 겹친 것이 없다.');
console.log('  「절곡부 안은 자리가 아니다」를 선호로 어떻게 돌려줄지는 아직 안 정했다.');
console.log('\n  → ' + (bite ? '✗ 파고들었다' : '파고든 것이 없다'));
process.exit(bite ? 1 : 0);
