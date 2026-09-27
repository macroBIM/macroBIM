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
            K_CLR: 4.0,        // 순간격 위반 벌점 (작은 위반에서의 2차 계수)
            CLR_SOFT: 30.0,    // 이 이상 벌어진 위반은 힘이 되내려간다 (mm) — clrRes 참조
            THMAX: 30,         // init 자세에서 벗어날 수 있는 각의 한계 (도)
            /*  ⓪ 제자리 고정. **방향마다 다르다.**
                K_AXIAL   조각이 **제 축을 따라 미끄러지는 것**은 막는다. 그 자리는
                          J 가 정하는 것이 아니라 코너와 입력 길이가 정한다. 약하게
                          두었더니 ⑥-2 의 아래 다리가 ⑥-1 의 다리 밑에서 **옆으로
                          400 mm 빠져나가** 겹침을 피했다 — 비용이 1e-6×400² = 0.16.
                          그러고는 폴리라인을 다시 그릴 때 제자리로 돌아와 그대로 겹쳤다.
                          겹치면 **위로 쌓여야지 옆으로 도망가면 안 된다.**
                K_ANCHOR  면 쪽 이동과 회전은 거의 안 묶는다. 제약이 없는 방향에서만
                          유일하게 일하라고 두는 값이다.                              */
            K_AXIAL: 1.0,      // 축방향 미끄러짐을 막는 무게 (피복 인력과 같은 급)
            K_ANCHOR: 1e-6,    // 나머지 방향을 아주 약하게 묶는 무게
            LAM0: 1e-3,        // LM 감쇠의 시작값 (2차 근사를 얼마나 믿을지)
            ITER: 200,         // 한 배정에서의 최대 반복 (가우스-뉴턴이라 몇 번이면 끝난다)
            OUTER: 12,         // 배정 다시 잡기 최대 횟수
            TOL: 1e-4,         // **걸음**이 이보다 작아지면 멈춘다 (mm)
            H: 0.05,           // 수치미분 간격 (mm) — 야코비 검산에만 쓴다
            PASS: 8,           // 그려진 폴리라인으로 다시 푸는 바깥 판의 최대 횟수
            PASSTOL: 0.2,      // 폴리라인이 이만큼도 안 움직이면 판을 멈춘다 (mm)
            RELAX: 0.5,        // 그 되먹임을 늦추는 비율 (1 이면 그대로, 출렁인다)
            /*  NEAR  띠 밖이라도 「닿는다」고 볼 거리 (mm). 조각의 축 범위에서
                      비켜난 면은 원래 자리가 아니지만, 코너 바로 옆의 면은 비켜난
                      것이 아니라 **닿아 있는** 것이다 (targets ③ 참조).
                SEAT  가장 가까운 자리보다 이만큼 넘게 먼 면은 자리가 아니다.
                      **절대거리가 아니다** — ㄷ자 스터럽의 다리는 유일한 후보인
                      하면까지 3.2 m 를 가야 한다. 둘 다 논문에서 교정할 값이다.   */
            NEAR: 200.0,       // 띠 밖의 면을 그래도 자리로 볼 거리 (mm)
            SEAT: 1000.0,      // 가장 가까운 자리와의 거리 차 한계 (mm)
            BAND: 5.0,         // 피복선에 「닿아 있다」고 볼 폭 (mm) — 여과를 거는 구간
            TOUCH: 0.5,        // 이만큼 붙으면 접촉으로 본다 (mm)
            NUDGE: 1.0         // 2단계 시작 전 안쪽으로 밀어 대칭을 깨는 양 (mm)
        },

        /*  ── 과정을 남기는 자리 ───────────────────────────────────────────
            논문에 실으려면 **답만이 아니라 과정**이 있어야 한다. 그런데 반복마다
            무언가를 쌓으면 평소에도 값을 치른다. 그래서 **원할 때만 켠다** :
              JField.TRACE = [];   … 풀고 나면 그 배열에 한 줄씩 쌓여 있다
              JField.TRACE = null; … 끈다 (기본)
            한 줄 = { pass, seg, stage, i, J, lam, move }.
            stage 1 은 콘크리트만, 2 는 덕트·철근까지 켠 단계다.                 */
        TRACE: null,
        _pass: 0, _seg: '', _stage: 0,
        _rec: function (row) {
            if (!this.TRACE) return;
            row.pass = this._pass; row.seg = this._seg; row.stage = this._stage;
            this.TRACE.push(row);
        },

        /*  J 를 **항별로** 나눠 돌려준다. energy() 와 같은 식을 쓰되 합치지 않는다 —
            덕트가 철근을 피복선에서 몇 mm 밀어냈는지가 여기서 수치로 나온다.     */
        energyParts: function (pose, seg, cons, ducts, placed, assign) {
            const K = this.CONF, half = seg.len / 2;
            const dx = Math.cos(pose.th) * half, dy = Math.sin(pose.th) * half;
            const pts = [{ x: pose.cx - dx, y: pose.cy - dy }, { x: pose.cx + dx, y: pose.cy + dy }];
            const o = { cover: 0, duct: 0, bar: 0, anchor: 0 };

            pts.forEach((p, i) => {
                const c = (assign && cons[assign[i]]) || this.nearestCon(p, cons);
                if (!c) return;
                const g = this.slack(p.x, p.y, c);
                o.cover += g * g * (g < 0 ? K.K_COV : 1);
            });
            (ducts || []).forEach(d => {
                const need = (d.D / 2) + (d.clr != null ? d.clr : 30) + seg.dia / 2;
                const g = this.segToPoint(pts, d) - need;
                if (g < 0) { const e = this.clrRes(g); o.duct += e.r * e.r; }
            });
            (placed || []).forEach(q => {
                const need = (q.dia + seg.dia) / 2;
                this.clearPairs(pts, q.p1, q.p2).forEach(n => {
                    const g = n.d - need;
                    if (g < 0) { const e = this.clrRes(g); o.bar += e.r * e.r; }
                });
            });
            const ux = Math.cos(pose.th), uy = Math.sin(pose.th);
            const ax = (pose.cx - seg.c0.x) * ux + (pose.cy - seg.c0.y) * uy;
            const pp = -(pose.cx - seg.c0.x) * uy + (pose.cy - seg.c0.y) * ux;
            const at = (pose.th - seg.th0) * half;
            o.anchor = K.K_AXIAL * ax * ax + K.K_ANCHOR * (pp * pp + at * at);
            o.total = o.cover + o.duct + o.bar + o.anchor;
            return o;
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

        /*  조각이 **앉을 수 있는** 면. 네 가지를 본다.
              ① 법선이 마주본다 (게이트) — 철근의 법선은 제가 안길 면을 가리키고,
                 벽의 법선은 콘크리트 안을 가리킨다. 그래서 내적이 음수여야 한다.
              ② 조각이 그 면의 **콘크리트 쪽에 있다.** 철근은 콘크리트 안에 묻히므로
                 면의 바깥에서 그 면에 안길 수는 없다. 이것이 없으면 셀(빈 공간)
                 건너편 면이 후보가 된다 — 복부 철근의 다리가 위로 2.8 m 날아가
                 상부슬래브 하면에 「아래에서」 붙는 일이 실제로 났다.
                 박스 단면은 볼록(convex)이 아니라서 게이트만으로는 안 걸러진다.
              ③ 조각이 지나는 **띠** 안에 있다 — 옆으로 비켜난 면은 앉을 자리가
                 아니다. 띠는 **원본 벽**으로 잰다 (피복벽은 코너에서 늘어난다).
                 단, 띠 밖이라도 **손에 닿을 만큼 가까우면**(NEAR) 자리로 본다.
              ④ 가장 가까운 자리보다 **터무니없이 먼**(SEAT 초과) 면은 자리가 아니다.

            ── ③④ 가 왜 둘 다 있어야 하나 (한때 ③ 만 있었고, 그게 틀렸다) ───────
            ③ 만으로 걸렀을 때 규칙이 **뒤집힌** 자리가 있었다. ⑧-1 의 다리 b
            (길이를 안 줘서 기본값 400 mm, 복부 아래에 눕는다) 를 보면 :
              · 하부슬래브 헌치 상면 E18 — 참거리 **72 mm**. 그런데 그 면은 다리 끝보다
                **50 mm** 오른쪽에서 시작하므로 **띠 밖**이라 버려졌다
              · 데크 상면 E1 — **5,714 mm** 위. 띠 안이라 **유일한 후보**로 남았다
            50 mm 이 왜 나오나 : 다리는 복부 외측면에서 50 mm 안쪽(x=-3450)에서 태어나
            오른쪽으로 400 mm 간다. 그런데 헌치면은 복부 **내측면**(x=-3000)에서 시작한다 —
            복부 두께가 500 mm 이니 **400 mm 다리는 복부 밑에서 끝난다.** 그 위는 데크까지
            전부 복부 콘크리트다. 「위에 아무 면도 없는」 다리가 만들어지는 자리다.
            그래서 「마주보는 가장 가까운 면」이 5.7 m 위의 데크가 되고, 다리가 거기까지
            올라갔다. 올라간 다리가 코너를 끌고 가니 몸통 a 도 따라 올라가 복부면(E11)
            의 길이를 벗어나고, 그러면 a 마저 후보를 잃어 **캔틸레버 선단(E14)** 으로
            옮겨 붙었다 — 하부슬래브에서 태어난 철근이 3 m 를 날아가 선단에 섰다.
            띠는 **옆으로 비켜난 면**을 걸러야 맞지만, 50 mm 는 비켜난 것이 아니다.

            ④ 는 ICP 에서 대응을 최대거리로 걸러내는 그것이다. **절대거리가 아니라
            가장 가까운 자리와의 차이**로 재야 한다 — ㄷ자 스터럽의 다리는 태어난
            자리에서 3.2 m 떨어진 하면까지 가야 하는데(길이를 안 주면 코너가 길이를
            정한다), 그 다리에게는 하면이 **유일한** 후보라서 그대로 이긴다.
            절대거리로 잘랐으면 그 스터럽이 죽는다.
            거리는 **피복면(유한한 토막)까지의 참거리**로 잰다 — 무한직선까지의
            수직거리로 재면 옆으로 한참 비켜난 면이 「0 mm」로 보인다.              */
        targets: function (seg, walls, sec, dia) {
            const n = seg.n0, cand = [];
            /*  띠의 축은 **조각의 두 끝점**에서 뽑는다. th0(= init 각)으로 뽑으면 안 된다 —
                판을 거듭하면 조각을 폴리라인에서 다시 만드는데, 그때 p1·p2 는
                **폴리라인 차례**로 들어오므로 init 때와 앞뒤가 뒤집힐 수 있다.
                그러면 띠가 뒤로 깔려서 **모든 벽이 걸러진다.** 실제로 ⑥-2(코드 23-1)의
                몸통이 후보를 하나도 못 찾아 태어난 자리에 400 mm 토막으로 남았고,
                그림에서 철근이 끊어져 보였다.                                       */
            const vx = seg.p2.x - seg.p1.x, vy = seg.p2.y - seg.p1.y;
            const L = hyp(vx, vy) || 1;
            const ux = vx / L, uy = vy / L;
            const pr = (x, y) => (x - seg.p1.x) * ux + (y - seg.p1.y) * uy;
            const side = (w, p) => (p.x - w.x1) * w.nx + (p.y - w.y1) * w.ny;
            const body = [seg.p1, seg.p2];

            (walls || []).forEach(w => {
                if (w.nx * n.x + w.ny * n.y > this.CONF.GATE) return;
                //  ② 는 「조각의 **어느 한 부분이라도** 그 면의 콘크리트 쪽에 있나」다.
                //     전부 안쪽일 것을 요구하면, 헌치처럼 기울어진 면 위를 지나는 긴
                //     철근이 제 면을 잃는다 (4 m 짜리 하면철근이 후보를 전부 잃었다).
                if (![seg.p1, seg.mid, seg.p2].some(p => side(w, p) > 0)) return;
                const need = this.coverOf(w, sec) + dia / 2;
                //  참거리 — 벽을 법선으로 need 만큼 민 **토막**까지. 코너에서 서로
                //  안 만나는 것은 상관없다. 여기서는 재기만 하고, 제약은 원본 벽에 건다.
                const q1 = { x: w.x1 + w.nx * need, y: w.y1 + w.ny * need };
                const q2 = { x: w.x2 + w.nx * need, y: w.y2 + w.ny * need };
                const d = Math.min.apply(null, this.pairCands(body, q1, q2).map(c => c.d));
                const a = pr(w.x1, w.y1), b = pr(w.x2, w.y2);
                const band = Math.min(L, Math.max(a, b)) - Math.max(0, Math.min(a, b)) > 0;
                if (!band && d > this.CONF.NEAR) return;
                cand.push({ w: w, need: need, d: d });
            });

            if (!cand.length) return [];
            const best = Math.min.apply(null, cand.map(c => c.d));
            return cand.filter(c => c.d <= best + this.CONF.SEAT);
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
                if (g < 0) { const e = this.clrRes(g); J += e.r * e.r; }
            });

            /*  ③ 이미 놓인 철근 — 겹치면 벌점. **선분끼리** 잰다.
                꼭짓점끼리만 보면 나란히 지나가는 두 철근이 서로를 못 본다 —
                피복면을 공유하는 철근이 겹으로 쌓이는(적층) 현상이 안 나온다.
                physics.js 는 이것을 wallStack 표로 손수 관리한다. 여기서는
                순간격 제약 하나가 그 일을 한다.                                  */
            (placed || []).forEach(q => {
                const need = (q.dia + seg.dia) / 2;
                this.clearPairs(pts, q.p1, q.p2).forEach(n => {
                    const g = n.d - need;
                    if (g < 0) { const e = this.clrRes(g); J += e.r * e.r; }
                });
            });

            //  ⓪ 제자리 고정항 — residuals() 의 그것과 같다 (설명은 거기에)
            const ux = Math.cos(pose.th), uy = Math.sin(pose.th);
            const dcx = pose.cx - seg.c0.x, dcy = pose.cy - seg.c0.y;
            const ax = dcx * ux + dcy * uy;                  // 축방향 미끄러짐
            const pp = -dcx * uy + dcy * ux;                 // 면 쪽 이동
            const at = (pose.th - seg.th0) * half;
            J += K.K_AXIAL * ax * ax + K.K_ANCHOR * (pp * pp + at * at);

            return J;
        },

        /*  ── 못 지키는 순간격이 나머지를 망치면 안 된다 ────────────────────
            순간격 위반을 그냥 K·g² 로 주면 **지킬 수 없는** 위반이 제일 큰 힘이 된다.
            복부철근은 상부슬래브를 지나야 하고 거기 TC 덕트(D440)가 있다 — 어디로
            가도 120 mm 겹친다. 2차 벌점이면 그 120 mm 가 피복 인력을 이겨서 철근을
            복부면에서 통째로 밀어낸다. 겹침은 그대로인데 배근만 망가진다.

            그래서 **되내려가는(redescending) 손실**을 쓴다 (Geman-McClure) :

                ρ(g) = K·g² / (1 + (g/δ)²)        →  |g|→∞ 이면 ρ → K·δ² (유계)

            작은 위반에서는 예전과 똑같이 2차라 적층(22 mm)은 그대로 밀어내고,
            큰 위반에서는 힘이 되내려가 피복(=구조 요구)이 이긴다.
            **못 지키는 것은 보고할 일이지 배근을 비틀 일이 아니다.**
            잔차꼴로 두면 r = √K·g/√u (u = 1+(g/δ)²) 이고 미분이 딱 떨어진다 :
                dr/dg = √K · u^(−3/2)                                             */
        clrRes: function (g) {
            const k = Math.sqrt(this.CONF.K_CLR), d = this.CONF.CLR_SOFT;
            const t = g / d, u = 1 + t * t;
            return { r: k * g / Math.sqrt(u), s: k / (u * Math.sqrt(u)) };
        },

        //  두 선분 사이의 최단거리. **clearPairs 와 같은 근거로 잰다** —
        //  거리를 재는 방법이 둘이 되면 조용히 어긋난다.
        segToSeg: function (pts, q1, q2) {
            return Math.min.apply(null, this.clearPairs(pts, q1, q2).map(n => n.d));
        },

        /*  각을 기준각 주위로 감는다.
            `Math.atan2` 는 (−180°, 180°] 을 돌려준다. 그래서 ±180° 근처에서
            **부호가 뒤집힌다** — 실제로는 1.7° 차이인데 숫자로는 358° 차이가 된다.
            그 값을 그대로 각 제한(th0 ± 30°)에 넣으면 클램프가 조각을 30° 통째로
            돌려 버린다. ①-1 의 4.8 m 다리가 그렇게 돌아가 피복이 22 mm 모자랐다.  */
        wrapTo: function (th, ref) {
            const TAU = Math.PI * 2;
            return ref + (((th - ref + Math.PI) % TAU) + TAU) % TAU - Math.PI;
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

        //  선분(두 점)에서 한 점까지 — 거리와 **가장 가까운 점**(야코비가 쓴다)
        closestOnSeg: function (pts, q) {
            const ax = pts[0].x, ay = pts[0].y;
            const bx = pts[1].x - ax, by = pts[1].y - ay;
            const L2 = bx * bx + by * by;
            let t = L2 > 1e-9 ? ((q.x - ax) * bx + (q.y - ay) * by) / L2 : 0;
            t = Math.max(0, Math.min(1, t));
            const x = ax + bx * t, y = ay + by * t;
            return { x: x, y: y, t: t, d: hyp(q.x - x, q.y - y) };
        },

        //  선분(두 점)에서 한 점까지의 거리
        segToPoint: function (pts, q) {
            return this.closestOnSeg(pts, q).d;
        },

        /*  순간격을 재는 **표본 쌍** — 내 끝점 둘, 상대 끝점 둘, 넷 다 쓴다.
            최단점 하나만 보면 안 되는 이유가 있다. 두 선분이 나란히 겹치면 최단점이
            한쪽 끝에 걸리는데, 그러면 모형은 「그 한 점만 피하면 된다」고 보고
            **돌려서** 그 끝만 떼어 놓으려 한다 — 반대쪽 끝이 더 파묻히는 것은
            모형에 없으니 모른다. 실제로 ⑥-2 가 ⑥-1 위에 1 mm 옆에 얹힌 채
            꼼짝을 안 했다(거기 J 1,766, 18 mm 안쪽으로 가면 758).
            넷을 다 보면 그 꼼수가 없어진다. 한 점에서만 닿는 경우(코너끼리)는
            나머지 셋이 여유라 예전과 똑같이 동작한다.                            */
        clearPairs: function (pts, q1, q2) {
            const c = this.pairCands(pts, q1, q2);
            return this.crossing(pts, q1, q2) ? [{ d: 0, t: 0.5, x: 0, y: 0, qx: 0, qy: 0 }] : c;
        },

        crossing: function (pts, q1, q2) {
            const o = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
            const s1 = o(pts[0], pts[1], q1), s2 = o(pts[0], pts[1], q2);
            const s3 = o(q1, q2, pts[0]), s4 = o(q1, q2, pts[1]);
            return ((s1 > 0) !== (s2 > 0)) && ((s3 > 0) !== (s4 > 0));
        },

        pairCands: function (pts, q1, q2) {
            return [
                (() => { const r = this.closestOnSeg(pts, q1); return { d: r.d, t: r.t, x: r.x, y: r.y, qx: q1.x, qy: q1.y }; })(),
                (() => { const r = this.closestOnSeg(pts, q2); return { d: r.d, t: r.t, x: r.x, y: r.y, qx: q2.x, qy: q2.y }; })(),
                (() => { const r = this.closestOnSeg([q1, q2], pts[0]); return { d: r.d, t: 0, x: pts[0].x, y: pts[0].y, qx: r.x, qy: r.y }; })(),
                (() => { const r = this.closestOnSeg([q1, q2], pts[1]); return { d: r.d, t: 1, x: pts[1].x, y: pts[1].y, qx: r.x, qy: r.y }; })()
            ];
        },

        /*  ── 잔차와 해석 야코비 ──────────────────────────────────────────
            J 는 처음부터 **제곱합**이다 : J = Σ rₖ² . 그러면 야코비 ∂rₖ/∂x 만
            있으면 가우스-뉴턴으로 한 번에 바닥 가까이 간다 — 기울기하강처럼
            수천 번 기어가지 않아도 된다.

            자세 변수는 (cx, cy, φ) 셋이고 **셋 다 mm 다.** φ = th·(길이/2) 는
            끝점이 회전으로 움직인 호길이다. 라디안과 mm 를 섞으면 (JᵀJ + λI) 의
            λ 가 무슨 단위인지 알 수 없게 된다 — 그래서 단위를 맞춰 둔다.

              p₁ = c − (L/2)·u ,  p₂ = c + (L/2)·u ,  u = (cos th, sin th)
              ∂pᵢ/∂c = I ,  ∂pᵢ/∂φ = sᵢ·u⊥      (s₁=−1, s₂=+1, u⊥ = (−sin th, cos th))

            ① 피복   r = √w·g ,  g = (p−w₁)·n − need ,  w = (g<0 ? K_COV : 1)
                      ∂g/∂c = n ,  ∂g/∂φ = sᵢ·(u⊥·n)
            ② 덕트   r = √K_CLR·(d−need)  (d<need 일 때만)
                      d 는 선분에서 덕트 중심까지. 가장 가까운 점 x(t) 를 쓰면
                      ∂d/∂c = ê ,  ∂d/∂φ = (2t−1)·(u⊥·ê) ,  ê = (x−q)/d
                      t 는 **고정해도 된다** — 최소점이라 ∂d/∂t = 0 이다(포락선 정리).
            ③ 철근   ②와 같다. q 자리에 상대 선분의 가장 가까운 점을 넣는다.      */
        residuals: function (pose, seg, cons, ducts, placed, assign) {
            const K = this.CONF, half = seg.len / 2;
            const cs = Math.cos(pose.th), sn = Math.sin(pose.th);
            const ux = cs, uy = sn, px = -sn, py = cs;            // u, u⊥
            const pts = [{ x: pose.cx - ux * half, y: pose.cy - uy * half },
                         { x: pose.cx + ux * half, y: pose.cy + uy * half }];
            const sg = [-1, 1], rows = [];

            //  ① 피복
            pts.forEach((p, i) => {
                const c = cons[assign[i]];
                if (!c) return;
                const g = this.slack(p.x, p.y, c);
                const w = Math.sqrt(g < 0 ? K.K_COV : 1);
                rows.push({ r: w * g,
                            j: [w * c.w.nx, w * c.w.ny, w * sg[i] * (px * c.w.nx + py * c.w.ny)] });
            });

            /*  ⓪ init 고정항 — **아주 약하게** 제자리에 묶는다.
                조각이 제 면을 따라 미끄러지는 방향은 J 가 정해 주지 않는다. 앞 판
                (되추적 기울기하강)에서는 걸음이 언제나 제약 법선 방향이라 그 방향으로
                저절로 안 움직였는데, 그건 알고리즘의 우연이지 모형이 아니었다.
                가우스-뉴턴은 그 우연이 없어서 조각이 면을 따라 흘렀다(③④ 가 370 mm
                밖으로 나갔다). 그러니 모형에 적어 넣는다 — **그 방향은 init 이 정한다.**
                무게가 1e-6 이라 제약이 있는 방향에서는 0.003 mm 수준이고(무시),
                아무도 안 잡아 주는 방향에서만 유일하게 일하는 항이다.
                덕트가 철근을 면을 따라 밀어내는 것(K_CLR=4)도 막지 않는다.           */
            const ka = Math.sqrt(K.K_ANCHOR), kx = Math.sqrt(K.K_AXIAL);
            const dcx = pose.cx - seg.c0.x, dcy = pose.cy - seg.c0.y;
            const ax = dcx * ux + dcy * uy;                  // 축방향 미끄러짐
            const pp = -dcx * uy + dcy * ux;                 // 면 쪽 이동
            rows.push({ r: kx * ax, j: [kx * ux, kx * uy, kx * pp / half] });
            rows.push({ r: ka * pp, j: [-ka * uy, ka * ux, -ka * ax / half] });
            rows.push({ r: ka * (pose.th - seg.th0) * half, j: [0, 0, ka] });

            const clearRow = (q, need, near) => {
                const g = near.d - need;
                if (g >= 0 || near.d < 1e-9) return;               // 여유가 있거나 방향이 없다
                const e = this.clrRes(g);                          // 되내려가는 손실 (clrRes 참조)
                const ex = (near.x - q.x) / near.d, ey = (near.y - q.y) / near.d;
                rows.push({ r: e.r,
                            j: [e.s * ex, e.s * ey, e.s * (2 * near.t - 1) * (px * ex + py * ey)] });
            };

            //  ② 덕트
            (ducts || []).forEach(d => {
                const need = (d.D / 2) + (d.clr != null ? d.clr : 30) + seg.dia / 2;
                clearRow(d, need, this.closestOnSeg(pts, d));
            });

            //  ③ 이미 놓인 철근 — energy() 와 **같은 표본 쌍**을 쓴다 (clearPairs)
            (placed || []).forEach(q => {
                const need = (q.dia + seg.dia) / 2;
                this.clearPairs(pts, q.p1, q.p2).forEach(n => {
                    clearRow({ x: n.qx, y: n.qy }, need, n);
                });
            });

            return rows;
        },

        //  대칭 3×3 풀이 (가우스 소거 + 부분 피벗). 못 풀면 null.
        solve3: function (A, b) {
            const M = [[A[0][0], A[0][1], A[0][2], b[0]],
                       [A[1][0], A[1][1], A[1][2], b[1]],
                       [A[2][0], A[2][1], A[2][2], b[2]]];
            for (let i = 0; i < 3; i++) {
                let p = i;
                for (let k = i + 1; k < 3; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
                if (Math.abs(M[p][i]) < 1e-12) return null;
                const t = M[i]; M[i] = M[p]; M[p] = t;
                for (let k = i + 1; k < 3; k++) {
                    const f = M[k][i] / M[i][i];
                    for (let c = i; c < 4; c++) M[k][c] -= f * M[i][c];
                }
            }
            const x = [0, 0, 0];
            for (let i = 2; i >= 0; i--) {
                let s = M[i][3];
                for (let c = i + 1; c < 3; c++) s -= M[i][c] * x[c];
                x[i] = s / M[i][i];
            }
            return x;
        },

        /*  수치 기울기. **푸는 데는 안 쓴다** — 해석 야코비(residuals)가 맞는지
            검산하는 자리로 남겨 둔다 (`bench/jjac.js`). J 의 항을 새로 더할 때
            야코비를 같이 안 고치면 조용히 틀리므로, 그때 이것과 맞춰 보면 된다.
            각은 **끝점이 움직인 거리**로 환산해서 잰다 — 세 변수의 단위를 mm 로 맞춘다. */
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
            return this.slacks(pose, seg, cons, assign).every(g => g >= -1e-9);
        },

        /*  **언제** 그 여과를 거는가가 중요하다.
            「한 번 지키면 영영 안 깬다」로 걸면 가우스-뉴턴이 아예 못 간다 —
            한 걸음에 1,186 mm 를 가서 목표면을 18 mm 지나쳤다가 다음 걸음에
            돌아오는 것이 정상인데, 그 첫 걸음이 거부되면 J 가 419,332 에서
            꼼짝을 못 한다(실제로 ③④ 가 거기 갇혔다).
            여과가 진짜로 할 일은 **어느 쪽에 앉을지**를 정하는 것이지 가는 길을
            막는 것이 아니다. 그래서 **이미 피복선에 닿아 있을 때만** 건다.
            깊숙이 안쪽에서 면을 향해 가는 큰 걸음은 그냥 보낸다.                 */
        atRest: function (pose, seg, cons, assign) {
            const gs = this.slacks(pose, seg, cons, assign);
            return gs.length > 0 && Math.min.apply(null, gs.map(Math.abs)) < this.CONF.BAND;
        },

        slacks: function (pose, seg, cons, assign) {
            const half = seg.len / 2;
            const dx = Math.cos(pose.th) * half, dy = Math.sin(pose.th) * half;
            const pts = [{ x: pose.cx - dx, y: pose.cy - dy }, { x: pose.cx + dx, y: pose.cy + dy }];
            const out = [];
            pts.forEach((p, i) => {
                const c = cons[assign[i]];
                if (c) out.push(this.slack(p.x, p.y, c));
            });
            return out;
        },

        /*  배정을 고정한 채 바닥까지 내려간다 — **가우스-뉴턴 + 감쇠(LM)**.

            J = Σ rₖ² 이므로 야코비 A 를 쌓아 (AᵀA + λ·diag)Δ = −Aᵀr 을 풀면
            2차 근사의 바닥으로 **한 번에** 간다. λ 는 그 근사를 얼마나 믿을지다 —
            줄면 믿고 늘리고(λ↓), 늘면 안 믿고 기울기하강 쪽으로 물러선다(λ↑).

            감쇠가 꼭 필요한 이유가 둘 있다.
              ㉠ 잔차가 둘(끝점 둘)인데 변수는 셋이라 AᵀA 가 특이하다. 조각이
                 면을 따라 미끄러지는 방향은 J 가 정해 주지 않는다 — 그 방향은
                 init 이 정한다. λ 가 그 방향의 걸음을 0 으로 만들어 준다.
              ㉡ 덕트·철근 항은 g=0 에서 꺾인다. 꺾인 곳에서는 2차 근사가 틀리므로
                 λ 가 커지며 알아서 잔걸음으로 바뀐다.

            앞 판(되추적 기울기하강)은 조각 하나에 최대 6,000 번을 돌았다. 그나마
            600 번이면 바닥이었는데 **멈추질 못했다** — 정지 조건이 |기울기|<1e-3
            인데, K_COV 로 우물을 한쪽만 무겁게 만든 탓에 g=0 에서 2계도함수가 튀고
            중심차분이 거기서 ≈K·h/2 의 가짜 기울기를 냈다(5e-2 에서 바닥을 침).
            여기서는 **걸음의 크기**로 멈춘다. 가짜 기울기가 끼어들 자리가 없다.     */
        descend: function (pose, seg, cons, ducts, placed, assign) {
            const K = this.CONF, half = Math.max(seg.len / 2, 1);
            const lim = K.THMAX * Math.PI / 180;
            let last = this.energy(pose, seg, cons, ducts, placed, assign);
            let lam = K.LAM0, i = 0;

            for (; i < K.ITER; i++) {
                const rows = this.residuals(pose, seg, cons, ducts, placed, assign);
                if (!rows.length) break;

                //  AᵀA 와 Aᵀr
                const H = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], g = [0, 0, 0];
                rows.forEach(rw => {
                    for (let a = 0; a < 3; a++) {
                        g[a] += rw.j[a] * rw.r;
                        for (let b = 0; b < 3; b++) H[a][b] += rw.j[a] * rw.j[b];
                    }
                });

                //  λ 는 대각을 키운다 (Marquardt). 대각이 0 인 방향은 단위로 받친다.
                const A = [H[0].slice(), H[1].slice(), H[2].slice()];
                for (let a = 0; a < 3; a++) A[a][a] += lam * (H[a][a] > 1e-12 ? H[a][a] : 1);
                const d = this.solve3(A, [-g[0], -g[1], -g[2]]);
                if (!d) { lam *= 8; if (lam > 1e12) break; continue; }

                /*  각은 init 자세 주위 THMAX 안으로 묶는다 (투영).
                    엔진이 할 일은 **면에 맞춰 다듬는 것**이다 — 데크가 -3% 기울어
                    있으니 그만큼은 돌아야 하지만, 통째로 뒤집혀 다른 면에 붙는 것은
                    설계 의도(init)를 버리는 것이다. 자세를 정하는 자리는 init 하나뿐. */
                const nx = {
                    cx: pose.cx + d[0], cy: pose.cy + d[1],
                    th: Math.max(seg.th0 - lim, Math.min(seg.th0 + lim, pose.th + d[2] / half))
                };
                const Jn = this.energy(nx, seg, cons, ducts, placed, assign);
                //  피복선에 닿아 있는데 밖으로 나가는 걸음이면 받지 않는다 (atRest 참조)
                const bad = this.atRest(pose, seg, cons, assign) && !this.feasible(nx, seg, cons, assign);

                if (Jn <= last && !bad) {                    // 내려가고 피복을 안 깨면 받는다
                    const move = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
                    pose = nx; last = Jn; lam = Math.max(lam * 0.3, 1e-12);
                    this._rec({ i: i, J: Jn, lam: lam, move: move, ok: 1,
                                cx: pose.cx, cy: pose.cy, th: pose.th });
                    if (move < K.TOL) { i++; break; }        // 걸음이 이만큼 작아지면 끝
                } else {
                    this._rec({ i: i, J: last, lam: lam, move: 0, ok: 0,
                                cx: pose.cx, cy: pose.cy, th: pose.th });
                    lam *= 8; if (lam > 1e12) break;         // 근사를 못 믿겠으면 잔걸음으로
                }
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
            const pose0 = { cx: seg.c0.x, cy: seg.c0.y,
                            th: (seg.thS == null) ? seg.th0 : seg.thS };
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
            this._seg = seg.label || '';
            this._stage = 1;
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

            this._stage = 2;
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

        /*  철근 하나. 조각들을 **각자** 내린 뒤, 이웃한 두 직선의 교점으로 잇는다.

            ── 왜 판(pass)을 거듭하나 ────────────────────────────────────────
            조각은 **입력 길이짜리 토막**으로 풀리는데, 그려지는 것은 교점으로 이어
            늘린 폴리라인이다. 가운데 조각은 늘어나고 끝 조각은 제 직선 위를
            미끄러진다 — 방향과 피복거리는 같지만 **축방향 자리가 다르다.**
            그래서 한 판만 돌면 순간격을 엉뚱한 데서 재게 된다. ⑥-2 의 아래 다리가
            그랬다 : 토막은 x 2555..2955 에 있는데 그려지는 다리는 3032..3431 이고,
            ⑥-1 의 다리(3049..3449)와 같은 피복선에 겹친다. 엔진은 못 보고,
            그림에서는 22 mm 파묻힌다.

            그래서 **그려진 폴리라인으로 조각을 다시 만들어** 또 푼다.
            토막의 위치·길이만 바꾸고, 회전의 기준점도 그려진 조각의 중점이 된다.
              (한때 토막은 그대로 두고 「순간격 잴 몸」만 길게 준 적이 있는데,
               그러면 회전이 **토막의 중점**을 축으로 일어나 팔 길이가 항끼리
               열몇 배 어긋난다 — 몸통이 복부면에서 109 mm 기울어 버렸다.)
            기준으로 남기는 것은 둘뿐이다 : 입력 길이(len0)와 init 각(th0).
            앞의 것은 자유단을 되짚는 데, 뒤의 것은 각을 묶는 데 쓴다.            */
        form: function (bar, walls, sec, ducts, placed) {
            const base = bar.segs.map(s => {
                const vx = s.p2.x - s.p1.x, vy = s.p2.y - s.p1.y;
                const L = hyp(vx, vy) || 1;
                const th = Math.atan2(vy, vx);
                //  법선의 손잡이 — init 이 준 법선이 축의 어느 쪽인지 기억해 둔다
                const side = (-Math.sin(th) * s.normal.x + Math.cos(th) * s.normal.y) >= 0 ? 1 : -1;
                return { label: s.label, len0: L, dia: bar.dia, n0: s.normal, side: side, th0: th };
            });
            //  1판은 입력 그대로 — 토막 길이 · init 자리
            let segs = bar.segs.map((s, i) => Object.assign({}, base[i], {
                len: base[i].len0, p1: s.p1, p2: s.p2,
                mid: { x: (s.p1.x + s.p2.x) / 2, y: (s.p1.y + s.p2.y) / 2 },
                c0: { x: (s.p1.x + s.p2.x) / 2, y: (s.p1.y + s.p2.y) / 2 }
            }));

            let res = null, pts = null, pass = 0, moved = Infinity;
            for (; pass < this.CONF.PASS; pass++) {
                this._pass = pass + 1;
                res = segs.map((sg, i) => {
                    const r = this.settle(sg, walls, sec, ducts, placed);
                    const half = sg.len / 2;
                    const dx = Math.cos(r.pose.th) * half, dy = Math.sin(r.pose.th) * half;
                    return {
                        label: sg.label, iter: r.iter, J: r.J, Jcover: r.Jcover, len0: base[i].len0,
                        cons: r.cons.map(c => c.w.id), contacts: r.contacts || [],
                        rest: r.rest || [], stopped: r.stopped || null,
                        u: { x: Math.cos(r.pose.th), y: Math.sin(r.pose.th) },
                        p1: { x: r.pose.cx - dx, y: r.pose.cy - dy },
                        p2: { x: r.pose.cx + dx, y: r.pose.cy + dy }
                    };
                });

                const npts = this.joinCorners(res);
                moved = pts ? Math.max.apply(null,
                    npts.map((p, i) => hyp(p.x - pts[i].x, p.y - pts[i].y))) : Infinity;
                pts = npts;
                if (moved < this.CONF.PASSTOL) { pass++; break; }

                /*  다음 판 : **그려진 조각**으로 다시 만든다.
                    늦춰서 옮긴다(under-relaxation) — 다리가 코너를 정하고 코너가
                    몸통을 정하는 되먹임이라, 그대로 넘기면 판마다 출렁인다.       */
                const a = this.CONF.RELAX;
                segs = segs.map((sg, i) => {
                    const p = pts[i], q = pts[i + 1];
                    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
                    const L = hyp(q.x - p.x, q.y - p.y) || 1;
                    const c = { x: sg.c0.x + a * (mx - sg.c0.x), y: sg.c0.y + a * (my - sg.c0.y) };
                    return Object.assign({}, sg, {
                        len: sg.len + a * (L - sg.len), c0: c, mid: c,
                        p1: p, p2: q,                       //  targets() 의 띠 판정에 쓰인다
                        //  더운 출발. **th0 주위로 감아서** 넘긴다 (wrapTo 참조)
                        thS: this.wrapTo(Math.atan2(res[i].u.y, res[i].u.x), base[i].th0)
                    });
                });
            }

            //  출력 길이 — 폴리라인에서 잰다
            res.forEach((s, i) => { s.len = hyp(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y); });
            const total = res.reduce((a, s) => a + s.len, 0);

            return { id: bar.id, dia: bar.dia, segs: res, pts: pts, len: total,
                     pass: pass, moved: moved };
        },

        /*  코너 = 이웃한 두 직선의 교점. 평행이면 안착한 끝점을 그대로 둔다.
            **중간 조각의 길이는 교점이 정한다** — ㄷ자 몸통을 기본값 400 으로
            넣어도 복부 깊이만큼 늘어나는 이유다. 길이는 출력이다.
            양 끝 조각만은 코너에서 **입력 길이**만큼 되짚는다 — 자유단의 위치는
            도면이 주는 값(겹이음 위치)이고, 콘크리트가 정해 주지 않는다.         */
        joinCorners: function (res) {
            const pts = [], corner = [];
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
            return pts;
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
