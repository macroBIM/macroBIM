/*  bench/jk.js — **횡방향끼리의 무게 `K_TRE` 를 얼마로 둘 것인가.**
 *
 *  `jfield` 는 오랫동안 덕트와 철근을 **같은 무게**(K_CLR 4)로 밀고 있었다.
 *  둘은 성격이 다르다 :
 *    덕트   구멍이다. **못 지키는** 위반이 흔하다 — 복부철근이 TC(D440) 를 어디로
 *           가도 120 mm 겹친다. 세게 주면 그 120 이 피복 인력을 이겨 배근이
 *           통째로 망가진다 (한때 400 을 줬다가 상면 철근이 단면 밖으로 날아갔다).
 *    철근   **지킬 수 있는** 위반이고 지켜야 한다. 그리고 같은 두 철근이 닿는 일을
 *           `jlong` 은 K_BAR 1000 으로 미는데 `jfield` 만 4 로 밀면 **한 접촉이
 *           아니다** (bench/jlre.js 의 마지막 열이 그 차이다).
 *
 *  그래서 값을 쓸어 보고 **재서 정한다.** 보는 것 :
 *    겹치는 짝 / 최악 순간격   많이 겹치나
 *    피복이 모자란 곳          철근을 밀다가 피복을 깨지 않나
 *    단면 밖 · 붙을 면         배근이 망가지지 않나
 *    꼭짓점 이동 · 반복        기존 답에서 얼마나 움직이나
 *
 *  실행 :  node bench/jk.js
 */
'use strict';
const fs = require('fs'), path = require('path');
const { prepare } = require('./jengine');
const JField = require('../jfield');

const fix = f => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture', f + '.json'), 'utf8'));

function run(k) {
    JField.CONF.K_TRE = k;
    const D = prepare(fix('s14'), {}, 'box');
    const sec = { covers: D.covers };
    const out = JField.solve(D.bars, D.walls, sec, D.ducts, []);

    const segs = [];
    out.forEach((r, bi) => {
        for (let i = 0; i + 1 < r.pts.length; i++)
            segs.push({ id: D.bars[bi].id, i: i, p1: r.pts[i], p2: r.pts[i + 1], dia: D.bars[bi].dia });
    });
    let worst = 0, pairs = 0, at = '', cross = 0;
    for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
        if (segs[i].id === segs[j].id) continue;
        const need = (segs[i].dia + segs[j].dia) / 2;
        const d = JField.segToSeg([segs[i].p1, segs[i].p2], segs[j].p1, segs[j].p2);
        const g = d - need;
        if (g < -0.05) { pairs++;
            if (d < 0.5) cross++;                        // 거리 0 = **엇갈려 지나간다**
            if (g < worst) { worst = g; at = segs[i].id + '↔' + segs[j].id; } }
    }
    /*  피복 — **그려진 폴리라인에서 다시 잰다** (`bench/jbench.js` 와 같은 방법).
        한때 `contacts` 로 쟀는데 그건 |g| < TOUCH 인 것만 담겨 있어서 **모자란
        것이 안 잡혔다** — K_BAR 1000 에서 생긴 2.4 mm 부족을 놓쳤다.          */
    const W = {}; D.walls.forEach(w => { W[w.id] = w; });
    let cov = 0, covAt = '';
    out.forEach(b => b.segs.forEach((sg, i) => {
        [b.pts[i], b.pts[i + 1]].forEach((p, kk) => {
            const id = sg.rest && sg.rest[kk], w = id && W[id];
            if (!w) return;
            const need = (D.covers[String(w.tag).toLowerCase()] || 50) + b.dia / 2;
            const g = (p.x - w.x1) * w.nx + (p.y - w.y1) * w.ny - need;
            if (g < cov) { cov = g; covAt = b.id + '[' + sg.label + ']→' + id; }
        });
    }));
    const iter = out.reduce((a, r) => a + r.segs.reduce((b, s) => b + (s.iter || 0), 0), 0);
    const miss = out.filter(r => r.segs.some(s => s.stopped === 'no-target')).map(r => r.id);
    return { out: out, D: D, pairs: pairs, cross: cross, worst: worst, at: at, cov: cov, covAt: covAt, iter: iter, miss: miss };
}

const KS = [4, 20, 50, 100, 200, 400, 1000];
const base = run(4);
console.log('철근끼리의 무게 K_TRE(횡방향끼리) 를 쓸어 본다  (덕트는 K_CLR ' + JField.CONF.K_CLR + ' 로 고정)\n');
console.log('   K_TRE   겹치는 짝(엇갈림)   최악 순간격            피복 모자람              반복   꼭짓점 이동');
console.log('   ' + '─'.repeat(96));
KS.forEach(k => {
    const r = run(k);
    let mv = 0;
    r.out.forEach((o, i) => o.pts.forEach((p, j) => {
        const q = base.out[i].pts[j];
        const d = Math.hypot(p.x - q.x, p.y - q.y); if (d > mv) mv = d;
    }));
    console.log('   ' + String(k).padStart(5) + '   ' + (String(r.pairs) + ' (' + r.cross + ')').padStart(13) +
        '   ' + (r.worst.toFixed(1) + ' (' + r.at + ')').padEnd(22) +
        '   ' + (r.cov < -0.5 ? ('✗ ' + r.cov.toFixed(1) + ' ' + r.covAt) : '없음').padEnd(22) +
        '   ' + String(r.iter).padStart(5) +
        '   ' + mv.toFixed(1).padStart(7) + (r.miss.length ? '   ✗ 붙을 면 없음 ' + r.miss.join(',') : ''));
});
console.log('   ' + '─'.repeat(96));
console.log('\n  **엇갈림**(거리 0)은 두 철근이 단면에서 교차한다는 뜻이고, 밀어서 풀 수 있는 것이');
console.log('  아니다 — 실제로는 교축방향으로 다른 자리에 있다(`z`). 거기는 K 를 올려도 안 줄어든다.');
console.log('\n  고를 값은 **겹침을 줄이면서 피복을 안 깨는** 쪽이다.');
console.log('  `jlong` 이 같은 접촉을 미는 값은 K_BAR 1000 이다 — 두 엔진이 같아야 한 접촉이다.');
JField.CONF.K_TRE = 4;
