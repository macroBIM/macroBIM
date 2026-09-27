/*  jfield.js — 목적함수 J 를 최소화해서 철근 위치를 찾는다.
 *
 *  ── 왜 새로 짓나 ──────────────────────────────────────────────────────
 *  `physics.js` 는 장(field)이 아니라 **탐색**이다. 광선으로 벽을 하나 고르고,
 *  그 위의 한 점을 목표로 찍고, 용수철로 끌어다 붙인다. 어디에도 J 가 없고,
 *  `segEnergy` 는 목적함수가 아니라 운동에너지다. 마주보는 벽이 열 개일 때
 *  「가장 가까운 것」이라는 손으로 쓴 규칙이 동점을 깬다 — 그 규칙이 논문에 없다.
 *
 *  여기서는 논문대로 한다. 조각 하나의 자세 pose = (중점 cx, cy · 각 th) 에 대해
 *
 *      J(pose) = Σ_끝점  d(p, S)²                ← 피복면 인력 (CAF)
 *                + Σ B(g_duct) + Σ B(g_bar)      ← 덕트 · 기존 철근 척력
 *
 *  S 는 **그 조각이 안길 수 있는 피복면들의 합집합**이고, d(p,S) 는 그 집합까지의
 *  거리다. 거리함수는 원래 min 으로 정의된다 (d(p,S) = min_{q∈S}|p-q|) — 그러니
 *  여기 나오는 min 은 동점 규칙이 아니라 **거리의 정의**다. 「멀어서 버린다」가
 *  아니라, 가까운 면이 저절로 이긴다. 어느 면이 막았는지는 결과로 읽는다(contacts).
 *
 *  ── 세 가지 성질 ──────────────────────────────────────────────────────
 *  ① J ≥ 0 이고 2차로 자란다 — 발산하지 않는다. (「법선 방향으로 민다」로 짰던
 *     앞 판은 막을 면이 없으면 무한히 날아갔다. 635 m 짜리 철근이 나왔다.)
 *  ② 조각 길이를 판단하지 않는다. 조각은 강체로 면에 안착하고, 이웃한 두 조각의
 *     **직선 교점**이 코너를 정한다 — 가운데 조각의 길이는 입력이 아니라 출력이다.
 *     복부철근 ⑥-1~⑥-4 는 길이를 하나도 안 주고도 7.5 m 로 선다(bench/jbench.js).
 *  ③ 동점(면이 둘 이상 같은 거리)은 J 의 국소최소가 둘이라는 뜻이고, 어느 쪽으로
 *     갈지는 **init 자세**가 고른다. 설계자의 의도가 들어가는 자리는 거기 하나뿐
 *     이다 — 코드 안의 if 가 아니다. 그래서 init 은 콘크리트 안, 붙을 면 쪽에 둔다.
 *
 *  ── 푸는 순서 ─────────────────────────────────────────────────────────
 *  1단계  덕트·철근을 없는 것으로 두고 피복면에 앉힌다
 *  2단계  그 자리에서 덕트·기존 철근을 켜고 다시 내린다 (비켜나기)
 *  각 단계 안에서는 「끝점을 면에 배정 → 배정을 고정하고 하강 → 다시 배정」을
 *  번갈아 한다(ICP 식 교대최소화). 순서와 교대가 없으면 한쪽 배리어가 능선이 되어
 *  기울기하강이 못 넘는다 — 왜 그런지는 settle() 에 적어 두었다.
 *
 *  ── 안 건드리는 것 ────────────────────────────────────────────────────
 *  `physics.js` · `domain.js` 는 그대로다. 이 파일은 옆에 선다.
 *  화면도 아직 이것을 안 쓴다. `bench/jbench.js` 로만 돌린다.
 */
(function (root) {
    'use strict';

    const hyp = (x, y) => Math.sqrt(x * x + y * y);

    const JField = {

        //  기본값. 벤치에서 덮어쓸 수 있다.
        CONF: {
            GATE: -0.6,        // 법선이 마주본다고 볼 내적 한계 (논문에서 검증할 값)
            /*  세 항의 **상대 무게**. 전부 거리²(mm²) 라 단위가 같다 — 그래서 기본은 1 이다.
                K_COV  피복선을 넘어선(피복 부족) 쪽은 그냥 모자란 것이 아니라 위반이다.
                K_CLR  덕트·철근 순간격 위반. 한때 400 을 줬더니 인력항(1)을 압도해서,
                       상면 철근이 덕트를 피해 단면 밖으로 수천 mm 날아갔다.
                       세 무게는 논문에서 교정할 값이다 — 코드에 숨기지 않는다.          */
            K_COV: 20.0,       // 피복 부족(slack < 0) 쪽 벌점
            K_CLR: 4.0,        // 순간격 위반 벌점
            THMAX: 30,         // init 자세에서 벗어날 수 있는 각의 한계 (도)
            STEP: 0.05,        // 하강 스텝 (mm 단위로 쓴다)
            ITER: 3000,        // 한 배정에서의 최대 반복
            OUTER: 12,         // 배정 다시 잡기 최대 횟수
            TOL: 1e-3,         // 기울기 노름이 이보다 작으면 멈춘다 (mm)
            H: 0.05,           // 수치미분 간격 (mm)
            TOUCH: 0.5,        // 이만큼 붙으면 접촉으로 본다 (mm)
            NUDGE: 1.0         // 2단계 시작 전 안쪽으로 밀어 대칭을 깨는 양 (mm)
        },

        /*  벽이 요구하는 피복. 벽의 tag(top/outer/inner)가 정한다 —
            physics.js 의 getWallCoverValue 와 같은 규칙이지만 Domain 을 안 쳐다본다.
            제약은 **원본 콘크리트 벽**에 건다. 피복벽(오프셋된 선)을 쓰지 않는 이유는
            그것이 코너에서 서로 만나게 늘어나 있어서, 조각이 벽의 범위 밖에서도
            제약을 받게 되기 때문이다.  need = 피복 + 지름/2 (철근 중심선까지).      */
        coverOf: function (w, sec) {
            const c = (sec && sec.covers) || {};
            const tag = (w && w.tag) ? String(w.tag).toLowerCase() : 'outer';
            return c[tag] != null ? c[tag] : 50;
        },

        /*  조각이 **앉을 수 있는** 면. 세 가지만 본다. 전부 부호와 범위 문제다 —
            가깝다·멀다는 **여기서 보지 않는다.** 그건 J 가 할 일이다.
              ① 법선이 마주본다 (게이트) — 철근의 법선은 제가 안길 면을 가리키고,
                 벽의 법선은 콘크리트 안을 가리킨다. 그래서 내적이 음수여야 한다.
              ② 조각이 지나는 띠 안에 있다 — 옆으로 비켜난 면은 앉을 자리가 아니다.
                 띠는 **원본 벽**으로 잰다 (피복벽은 코너에서 늘어난다).
              ③ 조각이 그 면의 **콘크리트 쪽에 있다.** 철근은 콘크리트 안에 묻히므로
                 면의 바깥에서 그 면에 안길 수는 없다. 이것이 없으면 셀(빈 공간)
                 건너편 면이 후보가 된다 — 복부 철근의 다리가 위로 2.8 m 날아가
                 상부슬래브 하면에 「아래에서」 붙는 일이 실제로 났다.
                 박스 단면은 볼록(convex)이 아니라서 게이트만으로는 안 걸러진다.     */
        targets: function (seg, walls, sec, dia) {
            const n = seg.n0, out = [];
            const ux = Math.cos(seg.th0), uy = Math.sin(seg.th0);
            const L = seg.len;
            const pr = (x, y) => (x - seg.p1.x) * ux + (y - seg.p1.y) * uy;
            const side = (w, p) => (p.x - w.x1) * w.nx + (p.y - w.y1) * w.ny;

            (walls || []).forEach(w => {
                if (w.nx * n.x + w.ny * n.y > this.CONF.GATE) return;
                const a = pr(w.x1, w.y1), b = pr(w.x2, w.y2);
                if (Math.min(L, Math.max(a, b)) - Math.max(0, Math.min(a, b)) <= 0) return;
                //  ③ 은 「조각의 **어느 한 부분이라도** 그 면의 콘크리트 쪽에 있나」다.
                //     전부 안쪽일 것을 요구하면, 헌치처럼 기울어진 면 위를 지나는 긴
                //     철근이 제 면을 잃는다 (4 m 짜리 하면철근이 후보를 전부 잃었다).
                if (![seg.p1, seg.mid, seg.p2].some(p => side(w, p) > 0)) return;
                out.push({ w: w, need: this.coverOf(w, sec) + dia / 2 });
            });
            return out;
        },

        //  점이 벽의 피복선보다 얼마나 안쪽인가. 0 이면 피복선 위, 음수면 넘어섰다.
        slack: function (px, py, c) {
            const w = c.w;
            return (px - w.x1) * w.nx + (py - w.y1) * w.ny - c.need;
        },

        /*  J. 자세는 (중점 cx,cy · 각 th) 세 자유도. 조각은 강체다.
            거리는 **피복선까지의 수직거리**(=slack)로 잰다. 한때 「조각의 법선축을
            따라」 재 봤는데, 그러면 조각이 돌아서 법선이 벽과 수직이 되는 순간
            그 벽이 후보에서 빠지고 J 가 0 이 된다 — 아무 데도 안 붙고 J=0 인
            가짜 최소가 생긴다(실제로 철근이 38 도 돌아 단면 밖으로 날아갔다).
            수직거리는 자세와 무관하게 정의되므로 J=0 은 **정말로 면에 앉은 것**뿐이다. */
        energy: function (pose, seg, cons, ducts, placed, assign) {
            const K = this.CONF;
            const half = seg.len / 2;
            const dx = Math.cos(pose.th) * half, dy = Math.sin(pose.th) * half;
            const pts = [{ x: pose.cx - dx, y: pose.cy - dy }, { x: pose.cx + dx, y: pose.cy + dy }];
            let J = 0;

            /*  ① 피복면 인력 — 배정된 면까지의 거리².
                안쪽(g>0)은 「아직 안 앉았다」, 바깥쪽(g<0)은 「피복이 모자라다」 —
                후자가 위반이므로 더 무겁게 준다(한쪽으로 기울어진 우물).
                assign 이 없으면 그 자리에서 가장 가까운 면을 쓴다(보고용).          */
            pts.forEach((p, i) => {
                const c = (assign && cons[assign[i]]) || this.nearestCon(p, cons);
                if (!c) return;
                const g = this.slack(p.x, p.y, c);
                J += g * g * (g < 0 ? K.K_COV : 1);
            });

            //  ② 덕트 — 순간격을 못 지키면 벌점 (한쪽 배리어)
            (ducts || []).forEach(d => {
                const need = (d.D / 2) + (d.clr != null ? d.clr : 30) + seg.dia / 2;
                const g = this.segToPoint(pts, d) - need;
                if (g < 0) J += K.K_CLR * g * g;
            });

            /*  ③ 이미 놓인 철근 — 겹치면 벌점. **선분끼리** 잰다.
                꼭짓점끼리만 보면 나란히 지나가는 두 철근이 서로를 못 본다 —
                피복면을 공유하는 철근이 겹으로 쌓이는(적층) 현상이 안 나온다.
                physics.js 는 이것을 wallStack 표로 손수 관리한다. 여기서는
                순간격 제약 하나가 그 일을 한다.                                  */
            (placed || []).forEach(q => {
                const need = (q.dia + seg.dia) / 2;
                const g = this.segToSeg(pts, q.p1, q.p2) - need;
                if (g < 0) J += K.K_CLR * g * g;
            });

            return J;
        },

        //  두 선분 사이의 최단거리
        segToSeg: function (pts, q1, q2) {
            const d = Math.min(
                this.segToPoint(pts, q1), this.segToPoint(pts, q2),
                this.segToPoint([q1, q2], pts[0]), this.segToPoint([q1, q2], pts[1]));
            //  교차하면 0
            const o = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
            const s1 = o(pts[0], pts[1], q1), s2 = o(pts[0], pts[1], q2);
            const s3 = o(q1, q2, pts[0]), s4 = o(q1, q2, pts[1]);
            if (((s1 > 0) !== (s2 > 0)) && ((s3 > 0) !== (s4 > 0))) return 0;
            return d;
        },

        //  그 점에서 가장 가까운 면
        nearestCon: function (p, cons) {
            let best = null, bd = Infinity;
            cons.forEach(c => {
                const d = Math.abs(this.slack(p.x, p.y, c));
                if (d < bd) { bd = d; best = c; }
            });
            return best;
        },

        //  두 끝점이 각각 어느 면에 배정되는가 (지금 자세에서 가장 가까운 것)
        assignOf: function (pose, seg, cons) {
            const half = seg.len / 2;
            const dx = Math.cos(pose.th) * half, dy = Math.sin(pose.th) * half;
            const pts = [{ x: pose.cx - dx, y: pose.cy - dy }, { x: pose.cx + dx, y: pose.cy + dy }];
            return pts.map(p => {
                let bi = 0, bd = Infinity;
                cons.forEach((c, i) => {
                    const d = Math.abs(this.slack(p.x, p.y, c));
                    if (d < bd) { bd = d; bi = i; }
                });
                return bi;
            });
        },

        //  선분(두 점)에서 한 점까지의 거리
        segToPoint: function (pts, q) {
            const ax = pts[0].x, ay = pts[0].y;
            const bx = pts[1].x - ax, by = pts[1].y - ay;
            const L2 = bx * bx + by * by;
            let t = L2 > 1e-9 ? ((q.x - ax) * bx + (q.y - ay) * by) / L2 : 0;
            t = Math.max(0, Math.min(1, t));
            return hyp(q.x - (ax + bx * t), q.y - (ay + by * t));
        },

        //  수치 기울기. J 를 바꿔 가며 실험할 것이므로 해석 미분은 나중에.
        //  각은 **끝점이 움직인 거리**로 환산해서 잰다 — 세 변수의 단위를 mm 로 맞춘다.
        grad: function (pose, seg, cons, ducts, placed, assign) {
            const h = this.CONF.H, half = Math.max(seg.len / 2, 1), g = {};
            [['cx', h], ['cy', h], ['th', h / half]].forEach(([k, hh]) => {
                const a = Object.assign({}, pose); a[k] += hh;
                const b = Object.assign({}, pose); b[k] -= hh;
                g[k] = (this.energy(a, seg, cons, ducts, placed, assign) -
                        this.energy(b, seg, cons, ducts, placed, assign)) / (2 * hh);
            });
            g.th /= half;          //  ∂J/∂(끝점 호길이) → 같은 스텝으로 갱신할 수 있게
            return g;
        },

        /*  배정을 고정한 채 내려간다. 배정이 고정되면 J 는 자세에 대해 매끄러운
            2차꼴이라 되추적(backtracking) 하강이 곧장 바닥까지 간다.               */
        /*  배정된 면의 피복을 지키고 있나. 「지키던 것을 깨는 걸음」은 받지 않는다 —
            피복은 무르지 않는 제약이다(내부점법의 그 성질). 이것이 없으면 두 철근이
            같은 피복선에 앉을 때, 나중 것이 **피복선 바깥으로** 2 mm 밀려나 멈춘다.
            안쪽으로 겹쳐 쌓이는 것이 옳다 — 안쪽은 콘크리트고 바깥쪽은 거푸집이다.
            (physics.js 의 wallStack 표가 하던 일을 제약 하나가 한다.)               */
        feasible: function (pose, seg, cons, assign) {
            const half = seg.len / 2;
            const dx = Math.cos(pose.th) * half, dy = Math.sin(pose.th) * half;
            const pts = [{ x: pose.cx - dx, y: pose.cy - dy }, { x: pose.cx + dx, y: pose.cy + dy }];
            return pts.every((p, i) => {
                const c = cons[assign[i]];
                return !c || this.slack(p.x, p.y, c) >= -1e-9;
            });
        },

        descend: function (pose, seg, cons, ducts, placed, assign) {
            const K = this.CONF, half = Math.max(seg.len / 2, 1);
            const lim = K.THMAX * Math.PI / 180;
            let step = K.STEP, last = this.energy(pose, seg, cons, ducts, placed, assign), i = 0;
            let feas = this.feasible(pose, seg, cons, assign);
            for (; i < K.ITER; i++) {
                const g = this.grad(pose, seg, cons, ducts, placed, assign);
                if (Math.sqrt(g.cx * g.cx + g.cy * g.cy + g.th * g.th) < K.TOL) break;
                /*  각은 init 자세 주위 THMAX 안으로 묶는다 (투영 기울기하강).
                    엔진이 할 일은 **면에 맞춰 다듬는 것**이다 — 데크가 -3% 기울어
                    있으니 그만큼은 돌아야 하지만, 통째로 뒤집혀 다른 면에 붙는 것은
                    설계 의도(init)를 버리는 것이다. 자세를 정하는 자리는 init 하나뿐. */
                const nx = {
                    cx: pose.cx - step * g.cx,
                    cy: pose.cy - step * g.cy,
                    th: Math.max(seg.th0 - lim,
                        Math.min(seg.th0 + lim, pose.th - step * g.th / half))
                };
                const Jn = this.energy(nx, seg, cons, ducts, placed, assign);
                const fn = this.feasible(nx, seg, cons, assign);
                if (Jn <= last && !(feas && !fn)) {                       // 내려가고 피복을 안 깨면
                    pose = nx; last = Jn; feas = fn; step *= 1.05;        //  조금 크게
                } else { step *= 0.5; if (step < 1e-12) break; }          // 넘치면 물러선다
            }
            return { pose: pose, J: last, iter: i };
        },

        /*  한 조각을 J 가 가장 낮은 자리로 내린다.
            조각은 강체다 — 길이는 안 바뀐다. 중점과 각만 움직인다.

            **배정과 하강을 번갈아 한다** (ICP 와 같은 교대최소화) :
              ㉠ 지금 자세에서 각 끝점이 가장 가까운 면에 배정된다
              ㉡ 그 배정을 고정하고 J 를 바닥까지 내린다
              ㉢ 다시 배정한다. 안 바뀌면 끝이다.
            이렇게 하지 않고 매 스텝 min 을 다시 잡으면 두 가지가 터진다 —
            목표면을 지나쳐 **반대쪽 먼 면에 잡혀 가거나**(바닥슬래브까지 6.4 m
            날아갔다), 지나치지 않게 스텝을 조르면 한 끝점이 면에 닿은 뒤로는
            스텝이 0 에 가까워져 **다른 끝점이 영영 못 따라온다**(3000 반복으로도
            250 mm 를 못 줄였다). 배정을 고정하면 두 문제가 같이 사라진다.
            배정이 되돌아오면(진동) 거기서 멈추고 그 사실을 보고한다.              */
        settle: function (seg, walls, sec, ducts, placed) {
            const cons = this.targets(seg, walls, sec, seg.dia);
            const pose0 = { cx: seg.c0.x, cy: seg.c0.y, th: seg.th0 };
            if (!cons.length)
                return { pose: pose0, cons: cons, iter: 0, stopped: 'no-target', contacts: [] };

            /*  **두 단계로 내린다.** 덕트·철근의 벌점은 한쪽 배리어라서 능선이 된다 —
                init 자세가 덕트 열 **위**에 있고 목표면이 그 **아래**면, 기울기하강은
                능선을 못 넘고 덕트 위에 걸터앉는다 (실제로 캔틸레버 하면철근이
                하면에서 207 mm 떠서 멈췄다. 거기 J 는 123,308, 하면에 앉으면 1,215).
                그래서 순서를 준다 — 이 저장소가 이미 적어 둔 그 순서다 :
                  1단계  콘크리트 피복을 찾아 앉는다   (덕트는 없는 것으로)
                  2단계  그 자리가 덕트와 겹치면 비켜난다
                덕트는 구멍이지 목표가 아니다.                                      */
            const r1 = this.alternate(pose0, seg, cons, [], []);

            /*  2단계에 들어가기 전에 **안쪽으로 살짝** 밀어 대칭을 깬다.
                두 철근이 같은 피복선에 정확히 겹쳐 앉으면 거기가 척력 벌점의
                꼭대기(대칭점)다 — 수치미분이 좌우 대칭이라 기울기가 0 이 되어
                꼭대기에 그대로 얹혀 있는다(실제로 ⑥-2 가 ⑥-1 과 같은 선에 섰다).
                밀 방향은 고를 것이 없다. 바깥은 거푸집이고 안쪽이 콘크리트다 —
                겹은 안쪽으로 쌓인다. 충돌이 없으면 2단계가 다시 피복선으로 붙인다.  */
            const nud = this.CONF.NUDGE, aw = r1.assign.map(i => cons[i].w);
            const nx = (aw[0].nx + aw[1].nx) / 2, ny = (aw[0].ny + aw[1].ny) / 2;
            const nl = hyp(nx, ny) || 1;
            const start = { cx: r1.pose.cx + nx / nl * nud, cy: r1.pose.cy + ny / nl * nud, th: r1.pose.th };

            const r2 = this.alternate(start, seg, cons, ducts, placed);

            return {
                pose: r2.pose, cons: cons, iter: r1.iter + r2.iter,
                Jcover: r1.J, J: r2.J, outer: r2.outer,
                stopped: r2.stopped || r1.stopped || null,
                rest: r2.assign.map(i => cons[i].w.id),
                contacts: this.contacts(r2.pose, seg, cons)
            };
        },

        //  배정 ↔ 하강 교대. 배정이 안 바뀌면 끝이다.
        alternate: function (pose, seg, cons, ducts, placed) {
            const K = this.CONF, seen = {};
            let assign = this.assignOf(pose, seg, cons);
            let iter = 0, J = null, cycled = false, o = 0;
            for (; o < K.OUTER; o++) {
                const key = assign.join(',');
                if (seen[key]) { cycled = true; break; }
                seen[key] = 1;
                const r = this.descend(pose, seg, cons, ducts, placed, assign);
                pose = r.pose; J = r.J; iter += r.iter;
                const next = this.assignOf(pose, seg, cons);
                if (next.join(',') === key) break;
                assign = next;
            }
            return {
                pose: pose, J: J, iter: iter, outer: o + 1, assign: assign,
                stopped: cycled ? 'assign-cycle' : (o >= K.OUTER ? 'outer-limit' : null)
            };
        },

        /*  **접촉은 우리가 고르지 않는다.** 내려간 자리에서 여유 g 가 0 인 면이 접촉이고,
            그 항의 기울기 2|t| 가 곧 승수 λ — 논문의 접촉력이다.
            마주보는 벽이 열 개여도 먼저 막는 것 하나가 저절로 답이 된다.           */
        contacts: function (pose, seg, cons) {
            const half = seg.len / 2, T = this.CONF.TOUCH;
            const dx = Math.cos(pose.th) * half, dy = Math.sin(pose.th) * half;
            const pts = [{ x: pose.cx - dx, y: pose.cy - dy }, { x: pose.cx + dx, y: pose.cy + dy }];
            const out = [];
            cons.forEach(c => {
                let g = Infinity;
                pts.forEach(p => { g = Math.min(g, this.slack(p.x, p.y, c)); });
                if (Math.abs(g) < T) out.push({ id: c.w.id, tag: c.w.tag, g: g, lam: 2 * Math.abs(g) });
            });
            return out.sort((a, b) => Math.abs(a.g) - Math.abs(b.g));
        },

        /*  철근 하나. 조각들을 **각자** 내린 뒤, 이웃한 두 직선의 교점으로 잇는다.   */
        form: function (bar, walls, sec, ducts, placed) {
            const segs = bar.segs.map(s => {
                const vx = s.p2.x - s.p1.x, vy = s.p2.y - s.p1.y;
                const L = hyp(vx, vy) || 1;
                const th = Math.atan2(vy, vx);
                //  법선의 손잡이 — init 이 준 법선이 축의 어느 쪽인지 기억해 둔다
                const side = (-Math.sin(th) * s.normal.x + Math.cos(th) * s.normal.y) >= 0 ? 1 : -1;
                return {
                    label: s.label, len: L, dia: bar.dia, n0: s.normal, side: side,
                    p1: s.p1, p2: s.p2, th0: th,
                    mid: { x: (s.p1.x + s.p2.x) / 2, y: (s.p1.y + s.p2.y) / 2 },
                    c0: { x: (s.p1.x + s.p2.x) / 2, y: (s.p1.y + s.p2.y) / 2 }
                };
            });

            const res = segs.map(sg => {
                const r = this.settle(sg, walls, sec, ducts, placed);
                const half = sg.len / 2;
                const dx = Math.cos(r.pose.th) * half, dy = Math.sin(r.pose.th) * half;
                return {
                    label: sg.label, iter: r.iter, J: r.J, Jcover: r.Jcover, len0: sg.len,
                    cons: r.cons.map(c => c.w.id), contacts: r.contacts || [],
                    rest: r.rest || [], stopped: r.stopped || null,
                    u: { x: Math.cos(r.pose.th), y: Math.sin(r.pose.th) },
                    p1: { x: r.pose.cx - dx, y: r.pose.cy - dy },
                    p2: { x: r.pose.cx + dx, y: r.pose.cy + dy }
                };
            });

            /*  코너 = 이웃한 두 직선의 교점. 평행이면 안착한 끝점을 그대로 둔다.
                **중간 조각의 길이는 교점이 정한다** — ㄷ자 몸통을 기본값 400 으로
                넣어도 복부 깊이만큼 늘어나는 이유다. 길이는 출력이다.
                양 끝 조각만은 코너에서 입력 길이만큼 되짚는다 — 자유단의 위치는
                도면이 주는 값(겹이음 위치)이고, 콘크리트가 정해 주지 않는다.       */
            const pts = [];
            const corner = [];
            for (let i = 0; i + 1 < res.length; i++)
                corner.push(this.lineX(res[i], res[i + 1]) || { x: res[i].p2.x, y: res[i].p2.y });

            if (res.length === 1) {
                pts.push({ x: res[0].p1.x, y: res[0].p1.y }, { x: res[0].p2.x, y: res[0].p2.y });
            } else {
                const f = res[0], c0 = corner[0];
                pts.push({ x: c0.x - f.u.x * f.len0, y: c0.y - f.u.y * f.len0 });
                corner.forEach(c => pts.push({ x: c.x, y: c.y }));
                const l = res[res.length - 1], cN = corner[corner.length - 1];
                pts.push({ x: cN.x + l.u.x * l.len0, y: cN.y + l.u.y * l.len0 });
            }

            //  출력 길이 — 폴리라인에서 잰다
            res.forEach((s, i) => { s.len = hyp(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y); });
            const total = res.reduce((a, s) => a + s.len, 0);

            return { id: bar.id, dia: bar.dia, segs: res, pts: pts, len: total };
        },

        /*  한 단면. 철근을 입력 순서대로 놓고, 놓인 것은 다음 철근의 척력이 된다.
            (지금 척력은 꼭짓점만 본다 — 논문 주장 3 은 선분끼리로 바꿔야 한다.)   */
        solve: function (bars, walls, sec, ducts) {
            const placed = [], out = [];
            (bars || []).forEach(b => {
                const r = this.form(b, walls, sec, ducts, placed);
                out.push(r);
                for (let i = 0; i + 1 < r.pts.length; i++)
                    placed.push({ p1: r.pts[i], p2: r.pts[i + 1], dia: b.dia });
            });
            return out;
        },

        //  두 조각이 놓인 직선의 교점
        lineX: function (a, b) {
            const r = { x: a.p2.x - a.p1.x, y: a.p2.y - a.p1.y };
            const s = { x: b.p2.x - b.p1.x, y: b.p2.y - b.p1.y };
            const den = r.x * s.y - r.y * s.x;
            if (Math.abs(den) < 1e-9) return null;
            const t = ((b.p1.x - a.p1.x) * s.y - (b.p1.y - a.p1.y) * s.x) / den;
            return { x: a.p1.x + r.x * t, y: a.p1.y + r.y * t };
        }
    };

    root.JField = JField;
    if (typeof module !== 'undefined' && module.exports) module.exports = JField;

})(typeof globalThis !== 'undefined' ? globalThis : this);
