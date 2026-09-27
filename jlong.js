/*  jlong.js — 종방향 철근을 J 로 배치한다. `jfield.js` 의 점(點) 판이다.
 *
 *  ── 무엇이 다른가 ─────────────────────────────────────────────────────
 *  횡방향 철근(`jfield.js`)은 조각이 **강체 선분**이라 자세가 (cx, cy, th) 셋이다.
 *  종방향 철근은 단면에서 **점**이다 — 자세가 (x, y) 둘이고 각이 없다.
 *  그래서 J 의 항은 같고 야코비의 열이 하나 줄어든다. 거리를 재는 방법
 *  (`clrRes` · `closestOnSeg` · `coverOf`)은 `JField` 것을 **그대로 불러 쓴다** —
 *  재는 방법이 둘이 되면 조용히 어긋난다.
 *
 *  ── 한 무리를 한꺼번에 푼다 ───────────────────────────────────────────
 *  종방향 철근은 하나씩 따로 풀 수 없다. 간격이 이웃을 묶기 때문이다. 그래서
 *  미지수는 무리 전체 {pᵢ} ∈ R²ᴺ 이다 (N = num, **입력이고 불변**).
 *
 *      J = Σᵢ [ d(pᵢ,S)²  +  B(덕트) + B(절곡철근 선분) + B(절곡철근 아크) ]
 *        + Σᵢ<ⱼ B(종방향끼리)                       ← 적층이 여기서 나온다
 *        + Σ_gap [ B(sᵢ − ctcmin) + B(ctcmax − sᵢ) ]   sᵢ = tᵢ₊₁ − tᵢ
 *        + Σᵢ    [ B(tᵢ − range⁻) + B(range⁺ − tᵢ) ]   ← 배치한계, 넘을 수 없다
 *        + Σᵢ    K_A·|pᵢ − pᵢ⁰|²                       ← ctc 균등배치로의 복귀
 *
 *  ── 축과 법선이 갈린다 ───────────────────────────────────────────────
 *  배치 직선을 `init`(기준점 O · 기울기 rot)이 준다. û = (cos rot, sin rot),
 *  n̂ = û 를 90° 돌린 것에 `nors`(±1)를 곱한 것 — **철근이 끌려갈 쪽**이다.
 *  점의 자리를 p = O + û·t + n̂·h 로 보면
 *      t (축 방향)    ctc · ctcmin · ctcmax · range
 *      h (법선 방향)  피복 인력 · 적층 · 덕트 · 절곡철근
 *  두 방향은 **장애물을 통해서만** 엮인다. 미지수는 그대로 (x,y) 로 두고,
 *  t 는 tᵢ = (pᵢ − O)·û 로 읽어 쓴다 (제약이 항등식으로 지켜진다 — 라그랑주 승수가
 *  필요 없다. 간격을 미지수로 두면 Σsᵢ = 길이 라는 등식 제약이 생긴다).
 *
 *  ── 배치의 출발 ───────────────────────────────────────────────────────
 *      tᵢ⁰ = ( i − (num−1)/2 ) · ctc            i = 0 … num−1
 *  홀수면 (num−1)/2 가 정수라 **init 에 한 개**가 놓이고, 짝수면 반정수라
 *  **init 좌우로 균등하게** 갈린다. 경우를 나눌 필요가 없다.
 *
 *  ── 절곡부에서 어느 쪽으로 밀리나 ─────────────────────────────────────
 *  규칙을 쓰지 않는다. **−∇J 가 그 방향이다.** 굴짐 아크(중심 c · 반지름 R)에서
 *      ρ = |p − c| ,  g = (ρ > R) ? ρ − (R+need) : (R−need) − ρ
 *      ∂g/∂p = ±(p − c)/ρ
 *  이 부호가 곧 「안쪽이냐 바깥쪽이냐」다. 배리어라 하강이 관(tube)을 건너지 못하므로
 *  어느 주머니인지는 **태어난 자리**가 정한다(규칙 ③).
 *  다만 **논문에는 두 바닥의 J 를 둘 다 싣는다** — `pockets()` 가 그 값을 낸다.
 */
(function (root) {
    'use strict';

    const JF = (typeof require === 'function' && typeof module !== 'undefined')
               ? require('./jfield.js') : root.JField;

    const hyp = (x, y) => Math.sqrt(x * x + y * y);
    const D2R = Math.PI / 180;

    const JLong = {

        CONF: {
            GATE: -0.6,        // 법선이 마주본다고 볼 내적 한계 (jfield 와 같은 값)
            K_COV: 20.0,       // 피복 부족(slack < 0) 쪽 벌점
            K_CLR: 4.0,        // 순간격 위반 (작은 위반에서의 2차 계수)
            CLR_SOFT: 30.0,    // 이보다 큰 위반은 힘이 되내려간다 (mm)
            /*  ctcmin 과 range 는 **딱딱하게**, ctcmax 는 **되내려가게** 둔다.
                철근이 겹치는 것과 배치한계를 넘는 것은 타협할 수 없다.
                최대간격은 개수가 불변이면 못 지킬 수가 있다 — 그때는 **보고**할
                일이지 배근을 비틀 일이 아니다 (jfield 의 clrRes 와 같은 근거).   */
            K_CTCMIN: 20.0,    // 최소간격 위반 벌점 (딱딱)
            K_CTCMAX: 1.0,     // 최대간격 위반 벌점 (되내려감)
            CTCMAX_SOFT: 200.0,// 최대간격 위반이 이만큼 벌어지면 힘이 되내려간다 (mm)
            K_RANGE: 20.0,     // 배치한계 위반 벌점 (딱딱)
            /*  ⓪ 제자리 고정. **방향마다 다르다** (jfield 의 K_AXIAL/K_ANCHOR 와 같은 근거).
                K_A   축(û) 방향 — ctc 균등배치로 되돌린다. 교란을 장애물 근처에 가둔다.
                K_N   법선(n̂) 방향 — 거의 안 묶는다. 벽까지 가는 것이 이 철근의 일이고,
                      그 거리는 J 가 정한다. 한때 등방으로 두었더니 배치 직선에서
                      피복선까지 가는 **정당한 이동**에 벌점이 붙어(200 mm → 800)
                      항들의 균형이 깨졌다.                                        */
            K_A: 0.02,         // 축 방향 (ctc 균등배치로 복귀)
            K_N: 1e-6,         // 법선 방향 (거의 자유)
            LAM0: 1e-3, ITER: 300, OUTER: 8, TOL: 1e-4
        },

        /*  ── 태어난 자리 ──────────────────────────────────────────────────
            group = { id, dia, num, init:{x,y,rot}, nors:±1,
                      range:{min,max}, ctc, ctcmin, ctcmax, path:[...] }        */
        axes: function (g) {
            const th = (g.init.rot || 0) * D2R;
            const ux = Math.cos(th), uy = Math.sin(th);
            const s = (g.nors === -1) ? -1 : 1;
            return { O: { x: g.init.x, y: g.init.y },
                     u: { x: ux, y: uy },
                     n: { x: -uy * s, y: ux * s } };      // 철근이 끌려갈 쪽
        },

        layout: function (g) {
            const a = this.axes(g), N = g.num, out = [];
            for (let i = 0; i < N; i++) {
                const t = (i - (N - 1) / 2) * g.ctc;
                out.push({ x: a.O.x + a.u.x * t, y: a.O.y + a.u.y * t, t: t });
            }
            return out;
        },

        //  range 가 담을 수 있는 개수 (보고용 — 개수는 입력이라 엔진이 안 고친다)
        capacity: function (g) {
            const lo = Math.floor(Math.abs(g.range.min) / g.ctc);
            const hi = Math.floor(Math.abs(g.range.max) / g.ctc);
            return lo + hi + 1;
        },

        /*  ── 점이 앉을 수 있는 면 ──────────────────────────────────────────
            `JField.seats()` 를 **그대로 못 쓴다.** 그 띠 판정은 조각의 축 범위로
            재는데 점은 축이 없어서 길이 0 이 되고, 그러면 모든 벽이 걸러진다.
            점에서의 띠는 「**수선의 발이 그 벽의 길이 안에 있나**」다.
            나머지 둘(게이트 · 콘크리트 쪽)은 조각 때와 글자 그대로 같다.        */
        seatsAt: function (p, n0, walls, sec, dia) {
            const out = [];
            (walls || []).forEach(w => {
                if (w.nx * n0.x + w.ny * n0.y > this.CONF.GATE) return;          // ① 마주보나
                if ((p.x - w.x1) * w.nx + (p.y - w.y1) * w.ny <= 0) return;      // ② 콘크리트 쪽인가
                const need = JF.coverOf(w, sec) + dia / 2;
                /*  ③ 은 **없다.** 조각과 달리 점에는 띠를 걸지 않는다.
                    조각은 축 범위가 있어서 「옆으로 비켜난 면」을 띠로 걸러야 하지만,
                    점은 **거리 자체가 그 일을 한다** — 비켜난 면은 저절로 멀다.
                    띠를 걸었더니 두 벽의 **이음매에 선 점**이 양쪽 모두에서 빠졌다
                    (E15/E16 이음매 x=-1250 의 철근이 후보를 전부 잃고 6.4 m 아래
                    하부슬래브 하면 E9 으로 날아갔다). 기울어진 두 면이 만나는 자리에서
                    수선의 발은 양쪽 다 길이 밖으로 0.1% 씩 빠져나간다.
                    그래서 후보는 ①② 만으로 두고, **어느 면인지는 거리가 정한다**
                    — d(p,S) = min 의 정의 그대로다 (nearestSeat 참조).              */
                const ex = w.x2 - w.x1, ey = w.y2 - w.y1, L2 = ex * ex + ey * ey;
                const tt = L2 > 1e-9 ? ((p.x - w.x1) * ex + (p.y - w.y1) * ey) / L2 : 0.5;
                const r = JF.closestOnSeg([{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }], p);
                out.push({ w: w, need: need, d: r.d, band: tt >= 0 && tt <= 1, used: true });
            });
            return out;
        },

        /*  점에서 그 면의 **피복면까지** — 안쪽이 +, 피복 부족이 −.
            거리는 **유한한 토막**까지 잰다. 무한직선까지의 수직거리로 재면, 벽의 길이를
            벗어난 자리에 있는 철근이 **늘어난 직선** 위로 끌려간다 — 실제로 ⑧-1 의
            절곡부 옆(E18 의 왼쪽 끝 너머, 복부 밑) 철근들이 그렇게 끌려가 피복선을
            1.9 mm 넘었다. 피복면은 벽이 끝나는 자리에서 같이 끝난다.
              q = 벽 토막 위의 가장 가까운 점,  d = |p − q|,  s = (p−w1)·n 의 부호
              g = sign(s)·d − need           ∂g/∂p = sign(s)·(p − q)/d
            토막 안에서는 d = |s| 라 예전 식과 **같은 값**이고, 벗어난 자리에서만
            끝점 쪽으로 당긴다.                                                    */
        cover: function (p, c) {
            const w = c.w;
            const sgn = ((p.x - w.x1) * w.nx + (p.y - w.y1) * w.ny) >= 0 ? 1 : -1;
            const r = JF.closestOnSeg([{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }], p);
            const d = Math.max(r.d, 1e-9);
            return { g: sgn * d - c.need, ex: sgn * (p.x - r.x) / d, ey: sgn * (p.y - r.y) / d };
        },

        //  옛 이름 — 보고용 (피복 여유 한 값만 필요할 때)
        slack: function (p, c) { return this.cover(p, c).g; },

        /*  어느 면에 앉나 — **피복면(유한한 토막)까지의 참거리**로 고른다.
            무한직선까지의 수직거리(slack)로 재면 옆으로 한참 비켜난 면이 0 으로 보인다.
            `c.d` 는 벽 토막까지의 거리이므로 피복면까지는 |d − need| 다.           */
        nearestSeat: function (p, cons) {
            let best = null, bd = Infinity;
            cons.forEach(c => {
                const d = Math.abs(this.cover(p, c).g);
                if (d < bd) { bd = d; best = c; }
            });
            return best;
        },

        /*  ── 절곡철근까지의 거리 ──────────────────────────────────────────
            `prims` 는 페이지의 `_trebarPrimitives()` 가 주는 것과 같은 꼴이다 :
              { t:'line', p:[x1,y1,x2,y2] }              곧은 구간
              { t:'arc',  p:[ox,oy,r,angb,ange] }        굴짐(절곡) — 각은 도(°)
            돌려주는 것 : { d, ex, ey } — 거리와 **상대에서 나를 향하는 단위벡터**.
            아크에서 ρ>R 이면 바깥, ρ<R 이면 안쪽이고 그 부호가 그대로 ex,ey 다.  */
        toPrim: function (p, pr) {
            if (pr.t === 'line') {
                const a = { x: pr.p[0], y: pr.p[1] }, b = { x: pr.p[2], y: pr.p[3] };
                const r = JF.closestOnSeg([a, b], p);
                if (r.d < 1e-9) return null;
                return { d: r.d, ex: (p.x - r.x) / r.d, ey: (p.y - r.y) / r.d };
            }
            const cx = pr.p[0], cy = pr.p[1], R = pr.p[2];
            const rho = hyp(p.x - cx, p.y - cy);
            if (rho < 1e-9) return null;
            //  각이 아크 구간 안인가 (구간 밖이면 가까운 끝점까지의 거리로 본다)
            let a0 = pr.p[3], a1 = pr.p[4], span = a1 - a0;
            while (span < 0) span += 360; while (span > 360) span -= 360;
            let ang = Math.atan2(p.y - cy, p.x - cx) / D2R - a0;
            while (ang < 0) ang += 360; while (ang > 360) ang -= 360;
            if (ang <= span) {
                const sgn = (rho > R) ? 1 : -1;                    // 바깥이면 +, 안쪽이면 −
                return { d: Math.abs(rho - R),
                         ex: sgn * (p.x - cx) / rho, ey: sgn * (p.y - cy) / rho };
            }
            let best = null;
            [a0, a0 + span].forEach(a => {
                const q = { x: cx + R * Math.cos(a * D2R), y: cy + R * Math.sin(a * D2R) };
                const d = hyp(p.x - q.x, p.y - q.y);
                if (d > 1e-9 && (!best || d < best.d))
                    best = { d: d, ex: (p.x - q.x) / d, ey: (p.y - q.y) / d };
            });
            return best;
        },

        /*  ── 잔차와 해석 야코비 ───────────────────────────────────────────
            미지수는 {pᵢ} 2N 개. 한 줄(row)은 { r, idx:[...], j:[...] } 로 두어
            **어느 철근의 어느 좌표에 걸리는지**만 적는다 (희소).                */
        residuals: function (P, g, ctx) {
            const K = this.CONF, N = P.length, rows = [];
            const a = this.axes(g), dia = g.dia;
            const push = (tag, r, idx, j) => rows.push({ tag: tag, r: r, idx: idx, j: j });

            //  ① 피복면 인력 — 배정된 면까지의 거리
            P.forEach((p, i) => {
                const c = ctx.assign[i];
                if (!c) return;
                const e = this.cover(p, c);
                const w = Math.sqrt(e.g < 0 ? K.K_COV : 1);
                push('cover', w * e.g, [2 * i, 2 * i + 1], [w * e.ex, w * e.ey]);
            });

            const barrier = (tag, p, i, d, ex, ey, need, k, soft) => {
                const gg = d - need;
                if (gg >= 0) return;
                const kk = Math.sqrt(k), tt = gg / soft, u = 1 + tt * tt;
                const rr = kk * gg / Math.sqrt(u), s = kk / (u * Math.sqrt(u));
                push(tag, rr, [2 * i, 2 * i + 1], [s * ex, s * ey]);
            };

            if (ctx.stage >= 2) {
                //  ② 덕트
                P.forEach((p, i) => {
                    (ctx.ducts || []).forEach(d => {
                        const dist = hyp(p.x - d.x, p.y - d.y);
                        if (dist < 1e-9) return;
                        const need = (d.D / 2) + (d.clr != null ? d.clr : 30) + dia / 2;
                        barrier('duct', p, i, dist, (p.x - d.x) / dist, (p.y - d.y) / dist,
                                need, K.K_CLR, K.CLR_SOFT);
                    });
                    //  ③ 절곡철근 — 곧은 구간과 굴짐 아크를 같은 꼴로 본다
                    (ctx.prims || []).forEach(pr => {
                        const e = this.toPrim(p, pr);
                        if (!e) return;
                        barrier(pr.t === 'arc' ? 'bend' : 'tre', p, i, e.d, e.ex, e.ey,
                                (pr.dia + dia) / 2, K.K_CLR, K.CLR_SOFT);
                    });
                });
                //  ④ 종방향끼리 — **적층이 여기서 나온다**
                for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
                    const dx = P[i].x - P[j].x, dy = P[i].y - P[j].y, d = hyp(dx, dy);
                    if (d < 1e-9) continue;
                    const gg = d - dia;                     // 중심거리 ≥ 지름
                    if (gg >= 0) continue;
                    const kk = Math.sqrt(K.K_CLR), tt = gg / K.CLR_SOFT, u = 1 + tt * tt;
                    const rr = kk * gg / Math.sqrt(u), s = kk / (u * Math.sqrt(u));
                    push('lre', rr, [2 * i, 2 * i + 1, 2 * j, 2 * j + 1],
                         [s * dx / d, s * dy / d, -s * dx / d, -s * dy / d]);
                }
            }

            //  ⑤ 간격 — t 축에서만 잰다.  ∂t/∂p = û
            const tOf = p => (p.x - a.O.x) * a.u.x + (p.y - a.O.y) * a.u.y;
            for (let i = 0; i + 1 < N; i++) {
                const s = tOf(P[i + 1]) - tOf(P[i]);
                if (g.ctcmin != null) {
                    const gg = s - g.ctcmin;
                    if (gg < 0) {
                        const kk = Math.sqrt(K.K_CTCMIN);
                        push('ctcmin', kk * gg, [2 * i, 2 * i + 1, 2 * (i + 1), 2 * (i + 1) + 1],
                             [-kk * a.u.x, -kk * a.u.y, kk * a.u.x, kk * a.u.y]);
                    }
                }
                if (g.ctcmax != null) {
                    const gg = g.ctcmax - s;
                    if (gg < 0) {                                   // 되내려가는 손실
                        const kk = Math.sqrt(K.K_CTCMAX), tt = gg / K.CTCMAX_SOFT, u = 1 + tt * tt;
                        const rr = kk * gg / Math.sqrt(u), sc = kk / (u * Math.sqrt(u));
                        push('ctcmax', rr, [2 * i, 2 * i + 1, 2 * (i + 1), 2 * (i + 1) + 1],
                             [sc * a.u.x, sc * a.u.y, -sc * a.u.x, -sc * a.u.y]);
                    }
                }
            }

            //  ⑥ 배치한계 — 넘을 수 없다
            P.forEach((p, i) => {
                const t = tOf(p), kk = Math.sqrt(K.K_RANGE);
                if (t < g.range.min)
                    push('range', kk * (t - g.range.min), [2 * i, 2 * i + 1], [kk * a.u.x, kk * a.u.y]);
                if (t > g.range.max)
                    push('range', kk * (g.range.max - t), [2 * i, 2 * i + 1], [-kk * a.u.x, -kk * a.u.y]);
            });

            //  ⑦ 균등배치로의 복귀 — 축 방향만 묶는다 (K_A · K_N 주석 참조)
            const ka = Math.sqrt(K.K_A), kn = Math.sqrt(K.K_N);
            P.forEach((p, i) => {
                const dx = p.x - ctx.home[i].x, dy = p.y - ctx.home[i].y;
                push('home', ka * (dx * a.u.x + dy * a.u.y), [2 * i, 2 * i + 1],
                     [ka * a.u.x, ka * a.u.y]);
                push('home', kn * (dx * a.n.x + dy * a.n.y), [2 * i, 2 * i + 1],
                     [kn * a.n.x, kn * a.n.y]);
            });

            return rows;
        },

        energy: function (P, g, ctx) {
            return this.residuals(P, g, ctx).reduce((s, w) => s + w.r * w.r, 0);
        },

        //  항별로 나눠 본다 (논문 표 — 어느 항이 얼마나 밀었나). tag 로 그냥 더한다.
        parts: function (P, g, ctx) {
            const o = { cover: 0, duct: 0, tre: 0, bend: 0, lre: 0,
                        ctcmin: 0, ctcmax: 0, range: 0, home: 0, total: 0 };
            this.residuals(P, g, ctx).forEach(w => {
                const v = w.r * w.r;
                if (o[w.tag] != null) o[w.tag] += v;
                o.total += v;
            });
            return o;
        },

        //  대칭 정규방정식 풀이 (가우스 소거 + 부분 피벗). 못 풀면 null.
        solveN: function (A, b) {
            const n = b.length, M = A.map((row, i) => row.concat([b[i]]));
            for (let i = 0; i < n; i++) {
                let p = i;
                for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
                if (Math.abs(M[p][i]) < 1e-12) return null;
                const t = M[i]; M[i] = M[p]; M[p] = t;
                for (let k = i + 1; k < n; k++) {
                    const f = M[k][i] / M[i][i];
                    if (f === 0) continue;
                    for (let c = i; c <= n; c++) M[k][c] -= f * M[i][c];
                }
            }
            const x = new Array(n).fill(0);
            for (let i = n - 1; i >= 0; i--) {
                let s = M[i][n];
                for (let c = i + 1; c < n; c++) s -= M[i][c] * x[c];
                x[i] = s / M[i][i];
            }
            return x;
        },

        /*  ── 관(tube)을 뚫고 지나가지 못하게 ──────────────────────────────
            순간격 손실은 **되내려간다**(clrRes). 못 지키는 위반이 배근을 비틀지
            않게 하려는 것인데, 그 대신 **유계**라서 인력이 세면 철근이 상대를
            **뚫고 지나갈 수 있다.** 실제로 소핏의 종방향 철근이 ⑨-1 의 다리를
            통과해 피복선 밖으로 3.4 mm 나갔다 — 원래는 다리 **위로 쌓여야** 한다.
            그래서 jfield 가 피복에 쓰는 장치를 그대로 쓴다 : **여유가 있던 것이
            겹치게 되는 걸음은 받지 않는다.** 이미 겹쳐 있는 것(못 지키는 위반)은
            막지 않는다 — 그건 보고할 일이지 여기서 막을 일이 아니다.
            이것이 있어야 「어느 주머니인가는 태어난 자리가 정한다」가 참이 된다.  */
        gaps: function (P, g, ctx) {
            const out = [];
            P.forEach((p, i) => {
                (ctx.ducts || []).forEach(d => {
                    const dist = hyp(p.x - d.x, p.y - d.y);
                    out.push(dist - ((d.D / 2) + (d.clr != null ? d.clr : 30) + g.dia / 2));
                });
                (ctx.prims || []).forEach(pr => {
                    const e = this.toPrim(p, pr);
                    out.push(e ? e.d - (pr.dia + g.dia) / 2 : 1e9);
                });
            });
            for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++)
                out.push(hyp(P[i].x - P[j].x, P[i].y - P[j].y) - g.dia);
            return out;
        },

        /*  철근 **하나**가 장애물을 뚫고 지나가나 — 여유가 있던 것이 겹치게 되면 참.
            같은 무리끼리는 안 본다(간격항이 맡는다. 서로 밀며 같이 움직이는 것을
            「뚫었다」로 보면 무리가 통째로 선다).                                  */
        hits: function (a, b, g, ctx) {
            const one = p => {
                const out = [];
                (ctx.ducts || []).forEach(d => out.push(hyp(p.x - d.x, p.y - d.y) -
                    ((d.D / 2) + (d.clr != null ? d.clr : 30) + g.dia / 2)));
                (ctx.prims || []).forEach(pr => {
                    const e = this.toPrim(p, pr);
                    out.push(e ? e.d - (pr.dia + g.dia) / 2 : 1e9);
                });
                return out;
            };
            return this.crosses(one(a), one(b));
        },

        crosses: function (before, after) {
            for (let k = 0; k < before.length; k++)
                if (before[k] >= 0 && after[k] < 0) return true;      // 여유 → 겹침
            return false;
        },

        //  배정을 고정한 채 바닥까지 내려간다 — 가우스-뉴턴 + 감쇠(LM)
        descend: function (P, g, ctx) {
            const K = this.CONF, n = 2 * P.length;
            let last = this.energy(P, g, ctx), lam = K.LAM0, it = 0;
            for (; it < K.ITER; it++) {
                const rows = this.residuals(P, g, ctx);
                const H = Array.from({ length: n }, () => new Array(n).fill(0));
                const gr = new Array(n).fill(0);
                rows.forEach(w => {
                    for (let a = 0; a < w.idx.length; a++) {
                        gr[w.idx[a]] += w.j[a] * w.r;
                        for (let b = 0; b < w.idx.length; b++) H[w.idx[a]][w.idx[b]] += w.j[a] * w.j[b];
                    }
                });
                const A = H.map(r => r.slice());
                for (let a = 0; a < n; a++) A[a][a] += lam * (H[a][a] > 1e-12 ? H[a][a] : 1);
                const d = this.solveN(A, gr.map(v => -v));
                if (!d) { lam *= 8; if (lam > 1e12) break; continue; }
                /*  **관을 뚫는 걸음은 거부하지 않고 잘라 쓴다.**
                    1단계는 덕트·철근을 J 에서 빼지만 그렇다고 뚫고 지나가도 된다는
                    뜻은 아니다(빼 두었더니 소핏 철근이 ⑨-1 의 다리를 통과해 피복선
                    밖까지 내려갔다). 그렇다고 통째로 거부하면 **가는 길이 막힌다** —
                    λ 만 커지다가 목표에서 100 mm 앞에 주저앉는다(jfield 의 atRest 가
                    풀던 그 문제다). 그래서 **닿을 때까지만 줄여서** 받는다.
                    이미 겹쳐 있는 것(못 지키는 위반)은 막지 않는다 — 보고할 일이다.  */
                /*  걸음을 **철근마다 따로** 자른다. 무리를 통째로 자르면 한 개가
                    막힐 때 **스물세 개가 다 선다** — 실제로 그랬다(목표에서 187 mm 앞에
                    주저앉았다). 막히는 것은 그 철근이지 무리가 아니다.               */
                let Q = P.map((p, i) => ({ x: p.x + d[2 * i], y: p.y + d[2 * i + 1] }));
                for (let i = 0; i < P.length; i++) {
                    let f = 1;
                    for (let c = 0; c < 20 && this.hits(P[i], Q[i], g, ctx); c++) {
                        f *= 0.5;
                        Q[i] = { x: P[i].x + d[2 * i] * f, y: P[i].y + d[2 * i + 1] * f };
                    }
                    if (this.hits(P[i], Q[i], g, ctx)) Q[i] = { x: P[i].x, y: P[i].y };
                }
                const Jn = this.energy(Q, g, ctx);
                if (Jn <= last) {
                    let mv = 0;
                    Q.forEach((q, i) => { mv += (q.x - P[i].x) ** 2 + (q.y - P[i].y) ** 2; });
                    P = Q; last = Jn; lam = Math.max(lam * 0.3, 1e-12);
                    if (Math.sqrt(mv) < K.TOL) { it++; break; }
                } else { lam *= 8; if (lam > 1e12) break; }
            }
            return { P: P, J: last, iter: it };
        },

        /*  한 무리를 푼다. `jfield.settle()` 과 같은 차례다 :
            1단계 콘크리트만 → 2단계 덕트·철근을 켜고 다시 내린다.
            각 단계 안에서 「면 배정 → 고정하고 하강 → 다시 배정」을 번갈아 한다.  */
        solve: function (g, walls, sec, ducts, prims) {
            const home = this.layout(g);
            let P = home.map(p => ({ x: p.x, y: p.y }));
            const a = this.axes(g);
            const pathSet = (g.path && g.path.length)
                            ? g.path.reduce((o, k) => (o[String(k).toUpperCase()] = 1, o), {}) : null;

            const seatsFor = p => {
                let s = this.seatsAt(p, a.n, walls, sec, g.dia).filter(c => c.used);
                if (pathSet) s = s.filter(c => pathSet[String(c.w.id).toUpperCase()]);
                return s;
            };
            const assignOf = Q => Q.map(p => {
                const s = seatsFor(p);
                return s.length ? this.nearestSeat(p, s) : null;
            });

            let iter = 0, J = null;
            [1, 2].forEach(stage => {
                let assign = assignOf(P), seen = {};
                for (let o = 0; o < this.CONF.OUTER; o++) {
                    const key = assign.map(c => c ? c.w.id : '-').join(',');
                    if (seen[key]) break;
                    seen[key] = 1;
                    const ctx = { assign: assign, home: home, ducts: ducts, prims: prims, stage: stage };
                    const r = this.descend(P, g, ctx);
                    P = r.P; J = r.J; iter += r.iter;
                    const next = assignOf(P);
                    if (next.map(c => c ? c.w.id : '-').join(',') === key) break;
                    assign = next;
                }
            });

            const assign = assignOf(P);
            const tOf = p => (p.x - a.O.x) * a.u.x + (p.y - a.O.y) * a.u.y;
            const bars = P.map((p, i) => ({
                i: i, x: p.x, y: p.y, t: tOf(p), t0: home[i].t,
                rest: assign[i] ? assign[i].w.id : null,
                slack: assign[i] ? this.slack(p, assign[i]) : null
            }));
            const gaps = [];
            for (let i = 0; i + 1 < bars.length; i++) gaps.push(bars[i + 1].t - bars[i].t);

            return { id: g.id, bars: bars, gaps: gaps, J: J, iter: iter,
                     home: home, axes: a, capacity: this.capacity(g) };
        },

        /*  ── 논문용 : 절곡부의 **두 바닥** ────────────────────────────────
            하강은 배리어를 못 넘으므로 태어난 쪽 바닥으로만 간다. 「왜 이쪽인가」를
            J 로 보이려면 반대쪽 바닥의 J 도 있어야 한다. 그래서 철근 하나를
            **가장 가까운 절곡 경로를 기준으로 반대쪽에 되비추어** 다시 내리고,
            두 J 를 같이 돌려준다. 나머지 철근은 그대로 둔다(부분 최소화).        */
        pockets: function (g, walls, sec, ducts, prims, res, i) {
            const P = res.bars.map(b => ({ x: b.x, y: b.y }));
            const seatOf = p => {
                const s = this.seatsAt(p, res.axes.n, walls, sec, g.dia).filter(c => c.used);
                return s.length ? this.nearestSeat(p, s) : null;
            };
            const ctx0 = { assign: P.map(seatOf), home: res.home,
                           ducts: ducts, prims: prims, stage: 2 };
            const here = this.energy(P, g, ctx0);

            //  **아크만** 본다 — 주머니가 둘로 갈리는 것은 굴짐(절곡)에서다
            let best = null;
            (prims || []).forEach(pr => {
                if (pr.t !== 'arc') return;
                const e = this.toPrim(P[i], pr);
                if (e && (!best || e.d < best.e.d)) best = { pr: pr, e: e };
            });
            if (!best) return { here: here, other: null, side: null, d: null };

            const need = (best.pr.dia + g.dia) / 2, e = best.e;
            const rho = hyp(P[i].x - best.pr.p[0], P[i].y - best.pr.p[1]);
            const side = rho > best.pr.p[2] ? '바깥' : '안쪽';

            //  관(tube) 건너편으로 되비춘 뒤, **그 철근만** 다시 내린다 (나머지 고정)
            const jump = 2 * (e.d + need) + 1;
            const Q = P.map((p, k) => k === i
                ? { x: p.x - e.ex * jump, y: p.y - e.ey * jump } : { x: p.x, y: p.y });
            const r = this.descend(Q, g, { assign: Q.map(seatOf), home: res.home,
                                           ducts: ducts, prims: prims, stage: 2 });
            return { here: here, other: r.J, side: side, d: e.d, need: need, moved: r.P[i] };
        }
    };

    root.JLong = JLong;
    if (typeof module !== 'undefined' && module.exports) module.exports = JLong;

})(typeof globalThis !== 'undefined' ? globalThis : this);
