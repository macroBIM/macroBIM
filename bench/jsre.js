/*  bench/jsre.js — **`srebar` 한 줄이 갈고리 N 개로 서는가.**
 *
 *  갈고리(ㄷ)는 「한 줄 = 철근 하나」가 아니다. 종방향과 같은 직선 위를 같은
 *  간격으로 달리는 **열차**다. 그래서 입력은 `lrebar` 쪽 문법을 쓰고, 풀리는
 *  것은 보통 횡방향과 같다 — 페이지가 한 줄을 `trebar` N 개로 **펼친다**.
 *
 *  도면(8-243)이 이 작업의 과녁이다 :
 *    마크 T1-1 · T1-2 · T1-3   셋 다 같은 ㄷ이다
 *    주기 「ㄷ자 500 × 150 · X = 206~480 / 212~486」  X 가 **범위**다
 *  X 가 범위인 것이 요지다 — 슬래브 두께가 600 → 280 으로 변하니 **몸통 길이가
 *  자리마다 다르고**, 제도에서는 한 수로 적을 수가 없어 범위로 적었다.
 *  즉 **X 는 입력이 아니라 결과**다. (마크가 셋인 것은 길이 셋이라는 뜻이 아니다 —
 *  T1-1 과 T1-2 가 거의 같은 범위를 덮으므로 구간으로 갈린 것으로 보인다. ⑤ 참조)
 *
 *  그래서 여기서 보는 것 :
 *    개수       한 줄이 N 개로 펼쳐졌나 · 버린 자리는 왜 버렸나
 *    몸통 길이   **출력**이다. 입력 칸이 없다. 두께에 따라 변해야 한다
 *    다리의 자리  종방향에 걸렸나 (h = need)
 *    다리의 자세  콘크리트 면과 평행한가 (⑥)
 *    파고듦      이미 놓인 횡방향·종방향을 파고들지 않았나
 *
 *  실행 :  node bench/jsre.js
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { prepare } = require('./jengine');

const ROOT = path.join(__dirname, '..');
const sheet = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture', 's14.json'), 'utf8'));
/*  갈고리 줄은 종방향(`lrebar`) **뒤에** 넣는다 — 시트의 **행 차례가 조립 차례**고,
    갈고리가 종방향 뒤에 와야 종방향에 **걸려** 선다 (앞에 오면 갈고리가 바깥이
    되고 종방향이 그 안에 쌓인다). 고정자료에 D1·D2·D2-1 이 이미 있다.          */
/*  `z` 를 1 로 둔다. **도면이 그렇게 말한다** — 8-243 단면에서 ㄷ(T1)는 **점선**
    이다. 이 단면에 없다는 뜻이고, 교축방향으로 다른 자리에 선다는 뜻이다.
    z 가 0 이면 엔진이 ① 횡방향과 **같은 깊이를 다투는** 것으로 보고 서로 민다
    (JField.sameZ 주석). 종방향은 모든 단면을 뚫으므로 z 와 무관하게 걸린다.     */
//        srebar  id   code dia  init        range          num  ctc  leg       ...      z
const T1 = ['srebar', 'T1', 21, 13, '0,-150,90', '-6200,6200', 25, 500, 150, '', '', '', 1];
{
    const at = sheet.findIndex(r => String(r[0] || '').trim().toLowerCase() === 'end');
    sheet.splice(at < 0 ? sheet.length : at, 0, T1);
}
const D = prepare(sheet, {}, 'box');
const { ctx, P, rows } = D;
const Domain = vm.runInContext('Domain', ctx);
['jfield.js', 'jlong.js'].forEach(f =>
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
const JF = vm.runInContext('JField', ctx);
const JL = vm.runInContext('JLong', ctx);

P._rebarData = rows; P._engine = 'jfield';
Domain.trebarList = []; Domain.lrebarList = []; Domain.queue = [];
rows.forEach(rd => {
    const t = String(rd.type || 'trebar').toLowerCase();
    if (t === 'trebar') { const b = Domain._createTrebarFromData(rd); if (b) { Domain.trebarList.push(b); Domain.queue.push({ kind: 'trebar', obj: b }); } }
    else if (t === 'lrebar') { const g = Domain._createLrebarFromData(rd); if (g) { Domain.lrebarList.push(g); Domain.queue.push({ kind: 'lrebar', obj: g }); } }
});
const sec = Domain.currentSection;
//  페이지가 _applyGenericSection 에서 하는 그 한 줄 (여기서는 단면을 따로 만들지 않는다)
P._swarnBuild = P._expandSrebar(sec) || [];
/*  **태어난 꼴을 먼저 떠 둔다.** 못 간 다리가 「결함」인지 「덕트에 끼인 것」인지
    가르려면 같은 출발점에서 **덕트 없이** 한 번 더 풀어 봐야 한다
    (`bench/jlre.js` 가 쓰는 그 가름법이다).                                   */
const BIRTH = Domain.trebarList.filter(t => t._srebar).map(t => ({
    id: String(t.id), dia: t.dia, z: t.z || 0, hook: true,
    segs: t.segments.map(s => ({ label: s.label,
        p1: { x: s.p1.x, y: s.p1.y }, p2: { x: s.p2.x, y: s.p2.y },
        normal: { x: s.normal.x, y: s.normal.y } }))
}));
const TOAST = [];
P._toast = (m) => TOAST.push(m);
P._solveWithJField();

let bad = 0;
const hooks = Domain.trebarList.filter(t => t._srebar);
const W = {}; sec.walls.forEach(w => { W[w.id] = w; });

console.log('srebar 한 줄 → 갈고리 열차  (code ' + T1[2] + ' · num ' + T1[6] +
            ' · ctc ' + T1[7] + ' · leg ' + T1[8] + ')\n');

//  ── ① 펼치기 ────────────────────────────────────────────────────────────
const dg = (P._sdiag || {})['T1'] || {};
console.log('  ① 펼치기 : ' + (dg.made || 0) + '/' + (dg.num || 0) + '개' +
            (dg.pulled ? ' · 부재 안으로 끌어들인 것 ' + dg.pulled : '') +
            (dg.outside ? ' · 버림(콘크리트 밖) ' + dg.outside : '') +
            (dg.oneSide ? ' · 버림(마주보는 면이 한쪽뿐) ' + dg.oneSide : '') +
            '   열차 방향 (' + (dg.u ? dg.u.x.toFixed(2) + ',' + dg.u.y.toFixed(2) : '?') + ')' +
            '  몸통 방향 (' + (dg.n ? dg.n.x.toFixed(2) + ',' + dg.n.y.toFixed(2) : '?') + ')');
if (!hooks.length) { console.log('\n  ✗ 하나도 안 섰다'); process.exit(1); }
P._swarnBuild.forEach(w => console.log('     · ' + w));

//  ── ② 몸통 길이는 «출력» 이다 ─────────────────────────────────────────────
const body = hooks.map(t => {
    const s = t.segments[1];
    return { id: t.id, x: (s.p1.x + s.p2.x) / 2, len: Math.hypot(s.p2.x - s.p1.x, s.p2.y - s.p1.y) };
}).sort((a, b) => a.x - b.x);
const bmin = Math.min.apply(null, body.map(b => b.len));
const bmax = Math.max.apply(null, body.map(b => b.len));
console.log('\n  ② 몸통 길이(출력) ' + bmin.toFixed(0) + ' ~ ' + bmax.toFixed(0) + ' mm' +
            '   — 입력 칸이 **없다**. 도면의 X = 206~480 과 견준다');
console.log('     x 를 따라 :  ' + body.filter((_, i) => i % 3 === 0)
            .map(b => Math.round(b.x) + ':' + Math.round(b.len)).join('  '));
if (bmax - bmin < 20) { console.log('     ✗ 자리마다 안 변한다 — 두께를 안 보고 있다'); bad++; }

/*  ── 덕트 없이 한 번 더 — 「결함」과 「덕트에 끼인 것」을 가른다 ──────────────
    갈고리의 자리는 종방향이고, 덕트는 **구멍이지 목표가 아니다.** 덕트가 사이에
    있으면 다리가 종방향에 못 닿는 자리가 생기는데 그건 타협이 맞다. 결함은
    덕트를 빼도 못 닿는 것이다.                                                */
const lptsAll = P._lrebarPoints();
const noDuct = {};
{
    const r = JF.solve(BIRTH, sec.walls, sec, [], lptsAll, []);
    r.forEach(b => b.segs.forEach((sg, i) => {
        if (i !== 0 && i !== 2) return;
        const a = b.pts[i], c = b.pts[i + 1];
        const L = Math.hypot(c.x - a.x, c.y - a.y) || 1;
        const pose = { cx: (a.x + c.x) / 2, cy: (a.y + c.y) / 2, th: Math.atan2(c.y - a.y, c.x - a.x) };
        const S = { len: L, dia: b.dia, p1: a, p2: c, hook: true, hookQ: sg.hookQ,
                    hookEnd: (i === 0) ? 1 : -1, hookSide: sg.hookSide,
                    bendR: JF.bendRadius(b.dia), link: false };
        if (!sg.hookQ) return;
        const g = JF.hookGeom(pose, S);
        noDuct[b.id + '[' + sg.label + ']'] = Math.abs(g.h - g.target);
    }));
}

//  ── ③ 다리의 자리와 자세 ────────────────────────────────────────────────
console.log('\n  ③ 다리 — 자리는 종방향(h = need) · 자세는 면과 평행(m = 0)');
console.log('      철근      다리   걸린 종방향         h   목표     면    기운 각   양끝 피복차');
console.log('     ' + '─'.repeat(84));
let noSeat = 0, noPar = 0, offH = 0, tight = 0, squeeze = 0, said_n = 0, offM = 0, shown = 0;
const tightList = [], sqList = [], saidList = [];
hooks.forEach(t => {
    [0, 2].forEach(i => {
        const s = t.segments[i];
        if (!s.hookQ) { noSeat++; return; }
        const L = Math.hypot(s.p2.x - s.p1.x, s.p2.y - s.p1.y) || 1;
        const ux = (s.p2.x - s.p1.x) / L, uy = (s.p2.y - s.p1.y) / L;
        const pose = { cx: (s.p1.x + s.p2.x) / 2, cy: (s.p1.y + s.p2.y) / 2, th: Math.atan2(uy, ux) };
        const S = { len: L, dia: t.dia, p1: s.p1, p2: s.p2, hook: true, hookQ: s.hookQ,
                    hookEnd: (i === 0) ? 1 : -1, hookSide: s.hookSide, bendR: JF.bendRadius(t.dia),
                    link: false };
        const g = JF.hookGeom(pose, S);
        const key = t.id + '[' + s.label + ']';
        const okh = Math.abs(g.h - g.target) < 0.5;
        /*  못 닿았으면 **왜 못 닿았는지**를 묻는다. 셋으로 갈린다 :
              덕트에 끼었다        덕트를 빼면 닿는다. 구멍은 목표가 아니니 타협이 맞다
              다른 종방향에 끼었다 이웃 종방향이 제 순간격 안에 들어와 있다. 그 자리엔
                                   다리가 들어갈 틈이 없다 — 입력(ㄷ 의 구간)을 보라는 신호
              결함                 둘 다 아니다                                       */
        const byDuct = !okh && noDuct[key] != null && noDuct[key] < 0.5;
        let nb = null;
        lptsAll.forEach(q => {
            if (s.hookQ && Math.abs(q.x - s.hookQ.x) < 1e-6 && Math.abs(q.y - s.hookQ.y) < 1e-6) return;
            const gg = JF.segToPoint([s.p1, s.p2], q) - JF.lreNeed(q, t.dia);
            if (nb == null || gg < nb) nb = gg;
        });
        const bySqueeze = !okh && !byDuct && nb != null && nb < -0.5;
        /*  **엔진이 스스로 못 끝냈다고 말한 것**은 결함이 아니다 — 보고다.
            `par-cycle` 은 평행해질 면이 두 개 사이에서 뒤집혔다는 뜻이고(헌치
            모서리), `no-seat` 은 걸 종방향이 없다는 뜻이다. 둘 다 페이지가 경고로
            낸다. 결함은 **아무 말 없이 어긋난 것**이다.                          */
        const said = !okh && (s.stopped === 'par-cycle' || s.stopped === 'no-seat'
                              || s.stopped === 'outer-limit');
        if (!okh) {
            if (byDuct) { tight++; tightList.push(key); }
            else if (bySqueeze) { squeeze++; sqList.push(key + ' ' + nb.toFixed(1)); }
            else if (said) { said_n++; saidList.push(key + ' ' + s.stopped); }
            else offH++;
        }
        const w = s.fitWall;
        let m = null, dcov = null;
        if (!w) noPar++;
        else {
            m = ux * w.nx + uy * w.ny;
            const need = JF.coverOf(w, sec) + t.dia / 2;
            const ga = (s.p1.x - w.x1) * w.nx + (s.p1.y - w.y1) * w.ny - need;
            const gb = (s.p2.x - w.x1) * w.nx + (s.p2.y - w.y1) * w.ny - need;
            dcov = Math.abs(ga - gb);
            if (Math.abs(m) > 0.002) offM++;
        }
        const par = (m != null && Math.abs(m) <= 0.002);
        if (shown < 8 || !okh) {
            shown++;
            console.log('     ' + String(t.id).padEnd(9) + '   ' + s.label +
                '    (' + s.hookQ.x.toFixed(0).padStart(5) + ',' + s.hookQ.y.toFixed(1).padStart(7) + ')' +
                '  ' + g.h.toFixed(2).padStart(6) + ' ' + g.target.toFixed(1).padStart(5) +
                '   ' + String(w ? w.id : '-').padEnd(5) +
                ' ' + (m == null ? '     -' : (Math.asin(Math.max(-1, Math.min(1, m))) * 180 / Math.PI).toFixed(3).padStart(7)) + '°' +
                '  ' + (dcov == null ? '    -' : dcov.toFixed(2).padStart(6) + ' mm') +
                '   ' + ((okh && par) ? '✓' : byDuct ? '≈ 덕트에 끼었다'
                                              : bySqueeze ? '≈ 다른 종방향에 끼었다'
                                              : said ? '! ' + s.stopped + ' (경고로 낸다)' : '✗'));
        }
    });
});
console.log('     ' + '─'.repeat(84));
console.log('     다리 ' + hooks.length * 2 + '개 ·  자리 못 찾음 ' + noSeat +
            ' · 덕트에 끼어 못 닿음 ' + tight + (tightList.length ? ' (' + tightList.join(' ') + ')' : '') +
            ' · 다른 종방향에 끼어 못 닿음 ' + squeeze + (sqList.length ? ' (' + sqList.join(' ') + ')' : '') +
            '\n              엔진이 못 끝냈다고 말한 것 ' + said_n + (saidList.length ? ' (' + saidList.join(' · ') + ')' : '') +
            ' · **결함** ' + offH + ' · 안 평행 ' + offM);
console.log('     («면 못 찾음» ' + noPar + ' — 복부 안쪽처럼 띠 안에 마주보는 면이 없는 자리다.');
console.log('      그때 ⑥ 가 꺼지고 각은 init 에 묶인다 — 정해 주는 것이 없으면 풀지 않는다.)');
bad += noSeat + offH + offM;

//  ── ④ 파고들지 않았나 ───────────────────────────────────────────────────
const lpts = P._lrebarPoints();
const segs = [];
Domain.trebarList.forEach(t => (t.segments || []).forEach((s, i) =>
    segs.push({ id: t.id, i: i, p1: s.p1, p2: s.p2, dia: t.dia || 13, z: t.z || 0,
                hook: !!t._srebar, hookQ: s.hookQ || null })));
let biteT = 0, biteL = 0, worstT = 0, worstL = 0, atT = '', atL = '';
segs.filter(s => s.hook).forEach(s => {
    segs.forEach(o => {
        if (o.id === s.id) return;
        if ((o.z || 0) !== (s.z || 0)) return;                 // 다른 단면이다 (JField.sameZ)
        const need = (o.dia + s.dia) / 2;
        const g = JF.segToSeg([s.p1, s.p2], o.p1, o.p2) - need;
        if (g < -0.5) { biteT++; if (g < worstT) { worstT = g; atT = s.id + '#' + s.i + '↔' + o.id + '#' + o.i; } }
    });
    lpts.forEach(q => {
        if (s.hookQ && Math.abs(q.x - s.hookQ.x) < 1e-6 && Math.abs(q.y - s.hookQ.y) < 1e-6) return;
        const g = JF.segToPoint([s.p1, s.p2], q) - JF.lreNeed(q, s.dia);
        if (g < -0.5) { biteL++; if (g < worstL) { worstL = g; atL = s.id + '#' + s.i; } }
    });
});
console.log('\n  ④ 파고듦 :  횡방향 ' + biteT + '쌍 (최악 ' + worstT.toFixed(1) +
            (atT ? ' ' + atT : '') + ')  ·  종방향 ' + biteL + '개 (최악 ' + worstL.toFixed(1) +
            (atL ? ' ' + atL : '') + ')');
console.log('     ㄷ 의 z 가 1 이라 ① 횡방향과는 **같은 단면에서 만나지 않는다** (도면에서 점선).');
console.log('     종방향은 모든 단면을 뚫으므로 z 와 무관하게 걸린다 (JField.sameZ).');
bad += biteT + biteL;

/*  ── ⑤ 마크 — **길이로 묶는다. 몇 가지가 될지는 가공 쪽 판단이다** ──────────────
    도면(8-243)은 마크가 셋인데, 그 셋이 길이 셋이라는 뜻은 **아니다** : T1-1 의
    주기가 `X = 206~480`, T1-2 가 `212~486` 으로 **둘이 거의 같은 범위를 덮는다.**
    즉 도면은 X 를 **범위로 적었다** — 「한 수로 적을 수 없다」는 제도 쪽 자백이고,
    마크 셋은 길이가 아니라 구간(좌·중·우)으로 갈린 것으로 보인다.
    우리는 자리마다 값을 내므로, 묶음은 **눈금을 얼마로 둘지**의 문제가 된다.
    그 민감도를 숨기지 않고 같이 찍는다 — 고르는 것은 가공이고, 엔진은 값을 낸다. */
const marks = P._smarks || [];
console.log('\n  ⑤ 마크 (전장 ' + P.MARK_STEP + ' mm 눈금) — **몇 가지로 묶을지는 가공 판단**이다');
console.log('      마크      개수   전장      몸통');
console.log('     ' + '─'.repeat(50));
marks.slice(0, 6).forEach(m => console.log('     ' + m.mark.padEnd(9) + String(m.num).padStart(4) +
    String(m.len).padStart(9) + '   ' + Math.round(m.bodyMin) + '~' + Math.round(m.bodyMax)));
if (marks.length > 6) console.log('     … ' + (marks.length - 6) + '가지 더');
console.log('     ' + '─'.repeat(50));
console.log('     마크 ' + marks.length + '가지 · 철근 ' +
            marks.reduce((a, m) => a + m.num, 0) + '개');
const keepStep = P.MARK_STEP;
const sweep = [10, 25, 50, 100, 200].map(s => { P.MARK_STEP = s; return s + ':' + P._srebarMarks().length; });
P.MARK_STEP = keepStep;
console.log('     눈금을 바꾸면 (눈금:가지수)  ' + sweep.join('  ') +
            '   ← 길이는 그대로고 **묶음만** 변한다');
console.log('     도면은 한 마크가 X 206~480 을 다 덮는다 — 그보다 훨씬 거친 묶음이다.');
if (!marks.length) { console.log('     ✗ 마크가 안 나왔다'); bad++; }

/*  ── ⑥ 경고 — **화면이 실제로 말해 주나** ───────────────────────────────────
    못 닿은 다리도 뒤집힌 면도, 재서 아는 것만으로는 쓸모가 없다. 화면이
    말해 줘야 입력을 고칠 수 있다. 여기서 보는 것은 그 토스트 한 줄이다.     */
console.log('\n  ⑥ 화면 경고 (토스트) — 재서 안 것이 **사람에게 가는가**');
if (!TOAST.length) { console.log('     ✗ 아무 말도 안 했다'); bad++; }
TOAST.join(' · ').split(' · ').forEach(t => console.log('     · ' + t));
if (said_n && TOAST.join(' ').indexOf('평행해질 면이 뒤집힘') < 0) {
    console.log('     ✗ par-cycle 을 말하지 않았다'); bad++;
}
if ((tight + squeeze + said_n) && TOAST.join(' ').indexOf('못 닿았습니다') < 0) {
    console.log('     ✗ 못 닿은 다리를 말하지 않았다'); bad++;
}

console.log('\n  입력에서 **사라진 것** : 몸통 길이 X · 마크 (11)(11-1)(12) · nors · ctcmax · ctcmin');
console.log('  → ' + (bad ? '✗ 어긋남 ' + bad : '전부 맞는다'));
process.exit(bad ? 1 : 0);
