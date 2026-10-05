/*  bench/jband.js — **갈고리의 축방향은 점이 아니라 띠다.**
 *
 *  ⑤ 의 본래 유도(`jfield.js` hookGeom 주석)는 「다리까지 need · 몸통까지 R」 두
 *  수직거리로 ㄷ 의 자리를 **하나로** 못박는다. 그런데 실제로 철근을 넣을 때 보는
 *  것은 그것이 아니다 :
 *      ㉠ 양쪽 **끝이 피복 안**에 들어가나
 *      ㉡ **덕트**를 비켜 가나
 *      ㉢ 그러고 나서 거기 있는 **종방향에 결속**한다
 *  이고, 결속점이 절곡이 끝나는 바로 그 점일 **이유가 없다.**
 *
 *  몸통의 수직거리 h 가 곧 「코너에서 종방향까지의 축방향 거리」이므로, 세 가지가
 *  전부 **h 하나의 상·하한**으로 떨어진다 :
 *      h ≥ R                절곡 아크 안은 자리가 아니다            K_BAR
 *      h ≤ ℓ                종방향이 다리를 벗어나면 못 건다        K_BAR
 *      h ≥ ℓ−t⁺ , h ≤ t⁻    양쪽 끝이 피복 안                       K_COV
 *  띠 «안» 에서의 선호는 하나다 — **정착은 길수록 좋다**(h 는 작을수록). 다만 그
 *  선호가 **덕트를 이겨서는 안 되므로** 감쇠꼴로 둔다. 여기서 보는 것이 그 서열이다.
 *
 *  실행 :  node bench/jband.js
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { prepare } = require('./jengine');

const ROOT = path.join(__dirname, '..');
const sheet = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture', 's14.json'), 'utf8'));
//  `bench/jsre.js` 가 쓰는 그 다섯 줄 — 도면 8-243 의 ㄷ 다 (주석은 거기에)
//          srebar  id    code dia  init               range         num  ctc  leg    …   z
[['srebar', 'T1',   21, 13, '0,-150,90',       '-6200,6200', 25, 500, 150, '', '', '', 1],
 ['srebar', 'T2',   21, 13, '-3250,-3400,180', '-4500,4500', 21, 300, 150, '', '', '', 2],
 ['srebar', 'T2b',  21, 13, '-3250,-3250,180', '-4500,4500', 21, 300, 150, '', '', '', 3],
 ['srebar', 'T2-1', 21, 13,  '3250,-3400,180', '-4500,4500', 21, 300, 150, '', '', '', 2],
 ['srebar', 'T2-1b',21, 13,  '3250,-3250,180', '-4500,4500', 21, 300, 150, '', '', '', 3]
].forEach(r => {
    const at = sheet.findIndex(x => String(x[0] || '').trim().toLowerCase() === 'end');
    sheet.splice(at < 0 ? sheet.length : at, 0, r);
});
const D = prepare(sheet, {}, 'box');
const { ctx, P, rows } = D;
const Domain = vm.runInContext('Domain', ctx);
['jfield.js', 'jlong.js'].forEach(f =>
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
P._rebarData = rows; P._engine = 'jfield';
Domain.trebarList = []; Domain.lrebarList = []; Domain.queue = [];
rows.forEach(rd => {
    const t = String(rd.type || 'trebar').toLowerCase();
    if (t === 'trebar') { const b = Domain._createTrebarFromData(rd); if (b) Domain.trebarList.push(b); }
    else if (t === 'lrebar') { const g = Domain._createLrebarFromData(rd); if (g) Domain.lrebarList.push(g); }
});
P._swarnBuild = P._expandSrebar(Domain.currentSection) || [];
P._toast = () => {}; P._solveWithJField();

const JF = vm.runInContext('JField', ctx);
const sec = Domain.currentSection;
const K = JF.CONF;
const DIA = 13, R = JF.bendRadius(DIA);
let bad = 0;

/*  ── ① 서열 : 덕트가 넷, 접선점이 하나 ───────────────────────────────────────
    두 항 다 감쇠(Geman-McClure)이고 무르기가 같은 CLR_SOFT 이므로, 포화값의 비가
    **무게의 비**가 된다 : K_CLR / 1 = 4. 새 상수를 만들지 않았다는 것이 이 표다.  */
{
    console.log('① 서열 — 접선점 «선호» 와 덕트 «배리어» (둘 다 감쇠 · 무르기 CLR_SOFT ' + K.CLR_SOFT + ')\n');
    console.log('    어긋남 g     선호 r²      덕트 r²      덕트/선호     옛 선호(2차) r²');
    console.log('   ' + '─'.repeat(74));
    [5, 10, 30, 60, 100, 140, 300].forEach(g => {
        const p = JF.clrRes(g, 1).r, d = JF.clrRes(g, K.K_CLR).r;
        console.log('   ' + String(g).padStart(8) + (p * p).toFixed(0).padStart(12) +
            (d * d).toFixed(0).padStart(13) + (d * d / (p * p)).toFixed(2).padStart(13) +
            (g * g).toFixed(0).padStart(18));
    });
    console.log('   ' + '─'.repeat(74));
    const sat = 1 * K.CLR_SOFT * K.CLR_SOFT, satD = K.K_CLR * K.CLR_SOFT * K.CLR_SOFT;
    console.log('   포화  선호 ' + sat + ' · 덕트 ' + satD + ' — 비 ' + (satD / sat).toFixed(0) +
        ' = K_CLR. **덕트가 이긴다.**');
    console.log('   옛 선호(2차)는 g = 140 에서 ' + (140 * 140) + ' 으로 덕트의 ' +
        (140 * 140 / (JF.clrRes(140, K.K_CLR).r ** 2)).toFixed(1) + ' 배다 — 그래서 못 비켰다.');
    if (satD / sat !== K.K_CLR) { console.log('   ✗ 서열이 K_CLR 과 다르다'); bad++; }
}

/*  ── ② 띠는 어디서 나오나 ───────────────────────────────────────────────────
    S14 의 ㄷ 를 전부 재서, 상·하한을 **무엇이 정했나**로 세어 본다.
    다리가 150 인데 막아서는 면은 수백~수천 mm 밖이라 **피복 한계는 안 걸린다** —
    「끝은 피복 안」이 이미 지켜져 있다는 뜻이고, 그래서 그 항은 식에는 있고
    여기서는 쉰다. 쉬는 것과 없는 것은 다르다 (다리가 길거나 끝이 단부면에
    가까운 단면에서는 이 항이 상한을 정한다).                                   */
const hooks = Domain.trebarList.filter(t => t._srebar);
const bands = [];
{
    let byBend = 0, byLeg = 0, byCov = 0, shut = 0, wmin = Infinity, wmax = 0;
    hooks.forEach(t => {
        const sg = t.segments; if (sg.length < 3 || !sg[0].hookQ) return;
        const a = sg[0], q = a.hookQ;
        //  폴리라인 차례 — 첫 조각은 p1 이 자유단, p2 가 코너다
        const dl = Math.hypot(a.p1.x - a.p2.x, a.p1.y - a.p2.y) || 1;
        const dir = { x: (a.p1.x - a.p2.x) / dl, y: (a.p1.y - a.p2.y) / dl };
        const b = JF.hookBandOf(q, dir, a.len0 || dl, R, sec.walls, sec, t.dia);
        //  h — 코너에서 종방향까지, 다리가 뻗는 쪽으로
        b.h = (q.x - a.p2.x) * dir.x + (q.y - a.p2.y) * dir.y;
        b.id = t.id; bands.push(b);
        if (b.shut) shut++;
        if (Math.abs(b.lo - R) < 0.01) byBend++; else byCov++;
        if (Math.abs(b.hi - b.len) < 0.01) byLeg++; else byCov++;
        const w = b.hi - b.lo; wmin = Math.min(wmin, w); wmax = Math.max(wmax, w);
    });
    console.log('\n② 띠 — ㄷ ' + bands.length + '개');
    console.log('   아래끝을 절곡(R)이 정한 것 ' + byBend + ' · 위끝을 다리 길이(ℓ)가 정한 것 ' + byLeg +
        ' · 피복이 정한 것 ' + byCov + ' · 닫힌 자리 ' + shut);
    console.log('   폭 ' + wmin.toFixed(1) + ' ~ ' + wmax.toFixed(1) + ' mm' +
        '   (옛 규칙은 폭 0 — 접선점 하나에 못박았다)');
    const t1 = bands[0];
    console.log('   보기 ' + t1.id + ' : ℓ ' + t1.len.toFixed(0) + ' · R ' + R +
        ' · 자유단 쪽 t⁺ ' + (t1.tf == null ? '막는 면 없음' : t1.tf.toFixed(0)) +
        ' · 코너 쪽 t⁻ ' + (t1.tc == null ? '막는 면 없음' : t1.tc.toFixed(0)) +
        '  → [' + t1.lo.toFixed(1) + ', ' + t1.hi.toFixed(1) + ']');
    if (!bands.length) { console.log('   ✗ 갈고리가 없다'); bad++; }
}

/*  ── ③ 띠를 지키는가 · 띠 안에서 어디에 앉는가 ───────────────────────────────
    덕트가 없는 ㄷ 는 **접선점(선호)** 에 그대로 앉아야 한다 — 작은 어긋남에서는
    감쇠항도 2차라 옛 답과 같다. 덕트에 걸린 ㄷ 만 띠 안에서 비켜난다.           */
{
    let out = 0, atPref = 0, pushed = 0, anc = Infinity, atA = '';
    bands.forEach(b => {
        if (b.h < b.lo - 2 || b.h > b.hi + 2) { out++; console.log('   ✗ ' + b.id +
            ' h ' + b.h.toFixed(1) + ' 이 띠 [' + b.lo.toFixed(1) + ', ' + b.hi.toFixed(1) + '] 밖'); }
        if (Math.abs(b.h - b.pref) <= 1) atPref++; else pushed++;
        const a = b.len - b.h;
        if (a < anc) { anc = a; atA = b.id; }
    });
    console.log('\n③ 앉은 자리 — 접선점(선호)에 그대로 ' + atPref + ' · 띠 안에서 비켜남 ' + pushed +
        ' · 띠 밖 ' + out);
    console.log('   결속점 뒤로 남은 곧은 길이(정착) 최소 ' + anc.toFixed(1) + ' mm (' + atA +
        ')  — 접선점에 못박으면 ℓ−R = ' + (bands[0].len - R).toFixed(1));
    if (out) bad += out;
}

/*  ── ④ 야코비 검산 — `bench/jjac.js` 는 갈고리 조각을 안 본다 ────────────────
    항을 더하면서 야코비를 안 고치면 **조용히 틀린다.** 띠의 두 배리어는 구간마다
    선형이고, 선호는 감쇠항이라 dr/dh = u^(−3/2) 다. 세 구간(아래끝 밖 · 띠 안 ·
    위끝 밖)에서 모두 중심차분과 맞는지 본다. 꺾임(h = lo, hi)에서는 중심차분이
    못 쓰므로 BAND 보다 가까운 자세는 뺀다 (jjac 과 같은 규칙).                 */
{
    const q = { x: 0, y: 0, dia: DIA };
    const len = 150, band = { lo: R, hi: len, wLo: K.K_BAR, wHi: K.K_BAR, pref: R, len: len };
    //  몸통 — 수직으로 세우고, n̂ 은 +x 쪽(다리가 뻗는 쪽)
    const S = { label: 'b', len: 300, dia: DIA, link: true, hook: true,
                hookQ: q, hookEnd: -1, hookSide: 1, bendR: R, band: band };
    const H = 0.02, BANDK = 1.0;
    let worst = 0, at = '', n = 0, skip = 0;
    //  h = (q − c)·n̂ 이고 n̂ = ν·û⊥. th = 90° 면 û = (0,1), û⊥ = (−1,0), ν = 1 → n̂ = (−1,0)
    //  즉 cx 를 −h 로 두면 h 가 된다.
    [-20, 0, 10, 32.5, 60, 100, 149, 160, 200].forEach(h => {
        const pose = { cx: -h, cy: 0, th: Math.PI / 2 };
        if (Math.abs(h - band.lo) < BANDK || Math.abs(h - band.hi) < BANDK) { skip++; return; }
        const rows = JF.hookRows(pose, S);
        const ga = [0, 0, 0];
        rows.forEach(rw => { for (let a = 0; a < 3; a++) ga[a] += 2 * rw.j[a] * rw.r; });
        const half = S.len / 2;
        const E = p => JF.hookEnergy(p, S);
        const num = [
            (E({ cx: pose.cx + H, cy: pose.cy, th: pose.th }) -
             E({ cx: pose.cx - H, cy: pose.cy, th: pose.th })) / (2 * H),
            (E({ cx: pose.cx, cy: pose.cy + H, th: pose.th }) -
             E({ cx: pose.cx, cy: pose.cy - H, th: pose.th })) / (2 * H),
            (E({ cx: pose.cx, cy: pose.cy, th: pose.th + H / half }) -
             E({ cx: pose.cx, cy: pose.cy, th: pose.th - H / half })) / (2 * H)
        ];
        for (let a = 0; a < 3; a++) {
            const den = Math.max(1, Math.abs(num[a]), Math.abs(ga[a]));
            const rel = Math.abs(ga[a] - num[a]) / den;
            n++;
            if (rel > worst) { worst = rel; at = 'h ' + h + ' [' + 'cx,cy,φ'.split(',')[a] + ']'; }
        }
    });
    console.log('\n④ 야코비 검산 (몸통 ⑤ = 띠 + 감쇠 선호) : 표본 ' + n + '개, 꺾임 근처 ' + skip + '자세 제외');
    console.log('   최대 상대오차 ' + worst.toExponential(2) + (at ? '  (' + at + ')' : '') +
        (worst < 1e-3 ? '   ✓' : '   ✗'));
    if (!(worst < 1e-3)) bad++;
}

/*  ── ⑤ 덕트에 얼마나 걸리나 ─────────────────────────────────────────────────
    띠가 있어야 덕트가 ㄷ 를 **밀 수 있다.** 못박혀 있으면 ⑤ 의 2차 잔차가
    감쇠하는 덕트 배리어를 늘 이긴다 (① 의 마지막 줄).                          */
{
    const ducts = P._ducts || [];
    let cnt = 0, worst = 0, atw = '';
    hooks.forEach(t => (t.segments || []).forEach((s, i) => ducts.forEach(d => {
        const need = (d.D / 2) + (d.clr != null ? d.clr : 30) + (t.dia || 13) / 2;
        const g = JF.segToPoint([s.p1, s.p2], d) - need;
        if (g < 0) { cnt++; if (g < worst) { worst = g; atw = t.id + '[' + 'abc'[i] + '] ↔ ' + (d.id || ''); } }
    })));
    console.log('\n⑤ 덕트 — 침범 ' + cnt + '건 · 최악 ' + worst.toFixed(1) + (atw ? ' (' + atw + ')' : ''));
    console.log('   못박았을 때 : 13건 · 최악 −140.5 (T1#18 의 몸통이 TC1R 한가운데를 지났다)');
    console.log('   남는 것은 **띠 안에 피할 자리가 없는 것**이다 — 덕트는 못 지키는 위반이');
    console.log('   흔한 항이고(K_CLR 주석), 그것을 무게로 억지로 지키게 하면 배근이 망가진다.');
}

console.log('\n' + (bad ? '  ✗ ' + bad + '곳 어긋남' : '  모두 통과'));
process.exit(bad ? 1 : 0);
