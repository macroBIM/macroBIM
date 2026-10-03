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
            RHO0: 1500.0,      // 인력의 영향 반경 (mm) — seatsAt 주석
            K_COV: 20.0,       // 피복 부족(slack < 0) 쪽 벌점
            /*  순간격의 무게는 **상대를 가려야 한다.**
                K_CLR/CLR_SOFT  **덕트** — 되내려간다. 복부철근이 TC 덕트(D440)를 어디로
                                가도 못 피하는 것처럼, 못 지키는 위반이 있다. 그런 것이
                                배근을 비틀면 안 된다 (jfield.clrRes 와 같은 근거).
                K_BAR           **철근끼리** — 사실상 2차, 그리고 무겁다. (울타리 꼴은
                                덕트와 같이 쓰지만 여기서 다루는 겹침은 mm 단위라
                                되내림이 1 % 아래다 — 2차와 다를 바 없다.)
                                이쪽은 **언제나 지킬 수 있다** — 한 겹 안으로 들어가면
                                된다. 되내려가는 손실(K_CLR 4)로 두었더니 피복 인력
                                (무게 1)이 이겨서, 기존 철근에서 13 mm 떨어져야 할
                                종방향 철근이 **10.3 mm 에 멈췄다**(2.7 mm 겹침).
                                「기존 철근만큼 밀려난다」는 타협할 값이 아니다.

                크기는 **잔차로 정한다.** 철근 한 겹 뒤에 앉은 철근은 피복면에서
                r_cov ≈ 13.5 mm 떨어지고, 그 인력 항의 무게는 1 이다. 겹침 항과
                맞서 멈추는 자리는 √K_BAR·δ ≈ r_cov, 즉  **δ ≲ r_cov / √K_BAR** 다.
                (재 보면 20 → 3.6 mm · 80 → 0.8 · 320 → 0.27 · 1280 → 0 으로,
                 언제나 이 울타리 안이다.)  겹침을 도면에 적히는 단위보다 작게,
                δ ≤ 0.5 mm 로 누르려면 K_BAR ≥ (13.5/0.5)² = 729 → **1000**.       */
            K_CLR: 4.0,        // 덕트 순간격 위반 (작은 위반에서의 2차 계수)
            CLR_SOFT: 30.0,    // 이보다 큰 덕트 위반은 힘이 되내려간다 (mm)
            K_BAR: 1000.0,     // 철근끼리의 순간격 위반 — 위 울타리에서 나온 값
            /*  ctcmin 과 range 는 **딱딱하게**, ctcmax 는 **되내려가게** 둔다.
                철근이 겹치는 것과 배치한계를 넘는 것은 타협할 수 없다.
                최대간격은 개수가 불변이면 못 지킬 수가 있다 — 그때는 **보고**할
                일이지 배근을 비틀 일이 아니다 (jfield 의 clrRes 와 같은 근거).

                「딱딱하다」는 **꼴**(되내려가지 않는 2차)이지 크기가 아니다. 무게는
                항마다 제 잔차 울타리로 정한다(K_BAR 참조). 이 둘을 K_BAR 과 나란히
                1000 으로 올려도 보았는데, 도면 입력(D1)은 한 자리도 안 움직였고 —
                애초에 위반이 없다 — 일부러 빡빡하게 만든 시험 무리(L2 : 7개 × ctc
                100 을 딱 600 mm 한계에 넣고 옆에 절곡부)에서만 갈렸다. 20 에서는
                배치한계·최소간격이 **0.6·0.7 mm** 밀리고 겹침이 0 인데, 1000 으로
                올리면 그 둘이 0 이 되는 대신 절곡부를 **7.7 mm** 파고든다. 못 푸는
                입력이 어디로 새는지의 문제고, mm 단위로 새는 쪽이 낫다. 그래서 둔다. */
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
            /*  K_A 가 **설계 간격을 붙드는 힘**이다. 0.02 로 두었더니 너무 물러서,
                데크 중앙의 여덟 개가 통째로 **17.9 mm 오른쪽으로 밀렸다** — ① 과 ①-1
                이 겹이음하는 자리(자유단이 x=-1653·-1356 으로 **둘 다 왼쪽**)에서 생긴
                작은 힘이 사슬을 타고 가운데까지 퍼진 것이다. 간격도 324 mm 까지 늘어졌다.
                0.5 로 올리면 치우침 17.9 → 0.2 mm, 최대간격 324 → 268 mm,
                기존 철근과의 최악 겹침 -9.1 → -2.4 mm 로 **모든 값이 같이 좋아진다.**
                장애물 옆에서 비켜서는 것은 그대로 한다 — 멀리 퍼지지 않을 뿐이다.    */
            K_A: 0.5,          // 축 방향 (ctc 균등배치로 복귀)
            K_N: 1e-6,         // 법선 방향 (거의 자유)
            /*  ⑧ 짝 묶기. 상·하 한 쌍은 나중에 **ㄷ자 갈고리 하나**가 같이 붙잡는다 —
                두 다리가 같은 자리(t)에 서야 갈고리가 걸린다. 그런데 두 줄은 각자
                제 장애물을 피해 축 방향으로 비켜서므로, 묶지 않으면 어긋난다
                (K_BAR 20 일 때 중앙값 8.1 · 최대 55 mm, 1000 으로 올리니 25.8 · 51).
                **K_BAR 탓이 아니다** — 묶는 항이 없었을 뿐이고, 겹침을 더 세게
                피하게 했더니 더 많이 비켜선 것이다.
                크기는 K_BAR 과 같은 울타리로 정한다. 아랫줄을 옆으로 미는 것은 결국
                겹침 항이고 그 잔차는 √K_BAR·δ 이므로, 묶음이 이기려면 K_TIE 가
                K_BAR 급이어야 한다. **K_TIE 1000** 에서 재 보면 어긋남이
                중앙값 0.1 · 최대 3.0 mm 다 (묶기 전 25.8 · 50.8).
                묶으면 아랫줄은 옆으로 못 비킨다 — 대신 **겹 너머로** 들어가야 한다.
                그 길을 `rescue()` 가 낸다. 둘은 같이 있어야 한다.                 */
            K_TIE: 1000.0,     // 상·하 짝을 같은 t 에 묶는다 (축 방향만)
            NUDGE: 1.0,        // 2단계 시작 전 안쪽으로 밀어 대칭을 깨는 양 (mm)
            COS_END: 0.5,      // 배치 직선이 이보다 비스듬히 만나는 면은 «단부»가 아니다 (60°)
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

        /*  ── 태어나는 자리 : 열차를 **무엇에 맞출지**는 `align` 이 말한다 ───
            규칙은 하나다 — **열차는 `align` 이 가리키는 것에 맞춘다.**
              init   (기본)  init 이 열차의 한가운데다. 지금까지의 규칙 그대로고,
                            `range` 는 init 기준 −/+ 의 **한계**일 뿐이다.
                            (−/+ 를 따로 넣으므로 좌우가 대칭이 아닐 수 있다.
                             그 비대칭을 열차 자리로 옮겨 읽으면 안 된다.)
              center        `range` 의 한가운데. 복부처럼 「단면을 가로지르는 줄」이
                            이쪽이다 — 이때는 init 을 **직선을 따라** 어디에 찍든
                            같은 답이 나온다(직선이 안 변하므로).
              min / max     한계의 한쪽 끝에 붙인다.
            숨은 조건으로 갈리지 않는다. 안 적으면 init 이고, 예전과 같다.        */
        layout: function (g) {
            const a = this.axes(g), N = g.num, out = [];
            const half = (N - 1) * g.ctc / 2, R = g.range;
            const ok = R && isFinite(R.min) && isFinite(R.max);
            const al = String(g.align || 'init').toLowerCase();
            const c = (!ok || al === 'init') ? 0
                    : (al === 'center') ? (R.min + R.max) / 2
                    : (al === 'min') ? R.min + half
                    : (al === 'max') ? R.max - half : 0;
            for (let i = 0; i < N; i++) {
                const t = c + (i - (N - 1) / 2) * g.ctc;
                out.push({ x: a.O.x + a.u.x * t, y: a.O.y + a.u.y * t, t: t });
            }
            return out;
        },

        /*  ── `range` 를 안 적으면 **콘크리트가 준다** ─────────────────────
            배치 직선을 양쪽으로 쏘아 콘크리트를 벗어나는 두 면을 찾고, 면마다
            `피복 + ½지름` 만큼 물러난 구간을 돌려준다. 복부처럼 「단면을 가로지르는
            줄」은 사람이 끝을 계산할 이유가 없다 — 콘크리트가 이미 알고 있다.
            지키는 것 둘 :
              ㉠ **정면으로 만나는 면만** 끝이다 (|û·n̂| ≥ COS_END). 비스듬히 스치며
                 빠져나가는 것은 단부가 아니다 — 데크 하면(−3 %)에 수평선을 쏘면
                 x 3,333 에서 «나가기»는 하지만 그건 슬래브 끝이 아니다.
              ㉡ 양쪽을 다 못 찾으면 **null** 을 돌려준다. 조용히 틀리지 않는다.
            쏘는 자리는 부르는 쪽이 정한다(짝이면 면에서 물린 자리를 준다).        */
        spanOf: function (p, g, walls, sec) {
            const a = this.axes(g), u = a.u, K = this.CONF;
            let lo = null, hi = null;
            (walls || []).forEach(w => {
                const ex = w.x2 - w.x1, ey = w.y2 - w.y1;
                const den = u.x * ey - u.y * ex;
                if (Math.abs(den) < 1e-9) return;                       // 나란하다
                const t = ((w.x1 - p.x) * ey - (w.y1 - p.y) * ex) / den;
                const q = ((w.x1 - p.x) * u.y - (w.y1 - p.y) * u.x) / den;
                if (q < -1e-9 || q > 1 + 1e-9) return;                  // 벽 토막 밖
                if (Math.abs(u.x * w.nx + u.y * w.ny) < K.COS_END) return;   // ㉠ 스치는 것
                const back = (JF.coverOf(w, sec) + g.dia / 2) /
                             Math.abs(u.x * w.nx + u.y * w.ny);
                if (t <= 0 && (!lo || t > lo.t)) lo = { t: t, back: back, id: w.id };
                if (t >= 0 && (!hi || t < hi.t)) hi = { t: t, back: back, id: w.id };
            });
            if (!lo || !hi) return null;                                // ㉡
            const min = lo.t + lo.back, max = hi.t - hi.back;
            return (max > min) ? { min: min, max: max, lo: lo.id, hi: hi.id } : null;
        },

        /*  range 안에 ctc 로 담을 수 있는 개수 (보고용 — 개수는 입력이라 안 고친다).
            **양쪽을 따로 세면 안 된다** — 짝수 개면 열차가 ctc/2 만큼 비켜서 놓이므로
            한쪽씩 세는 것보다 하나 더 들어간다(50 개 × 250 = 12,250 이 ±6,200 =
            12,400 에 들어가는데 한쪽씩 세면 49 개라고 나왔다).                     */
        capacity: function (g) {
            return Math.floor((g.range.max - g.range.min) / g.ctc) + 1;
        },

        /*  ── 점이 콘크리트 «안»인가 — +x 로 쏘아 교차 홀짝 (even-odd) ──────
            단면은 바깥 고리 + 셀 고리다. 셀 안에 있으면 두 고리를 다 지나 짝수가
            되므로 「밖」으로 나온다 — 따로 가를 것이 없다.                      */
        inside: function (p, walls) {
            let c = false;
            (walls || []).forEach(w => {
                if ((w.y1 > p.y) === (w.y2 > p.y)) return;
                const x = w.x1 + (p.y - w.y1) / (w.y2 - w.y1) * (w.x2 - w.x1);
                if (x > p.x) c = !c;
            });
            return c;
        },

        //  점 p 에서 dir 로 쏜 광선이 벽 토막 w 를 만나는 매개변수 (없으면 null)
        rayHit: function (p, dir, w) {
            const ex = w.x2 - w.x1, ey = w.y2 - w.y1;
            const den = dir.x * ey - dir.y * ex;
            if (Math.abs(den) < 1e-9) return null;                  // 나란하다
            const t = ((w.x1 - p.x) * ey - (w.y1 - p.y) * ex) / den;
            const q = ((w.x1 - p.x) * dir.y - (w.y1 - p.y) * dir.x) / den;
            /*  **t = 0 을 거르면 안 된다** — 면 «위»에 정확히 선 철근이 자기가 선
                그 면을 못 본다. `gap` 으로 태어나는 줄이 바로 그 경우다(두 줄이
                면 위에서 태어난다). 서 있는 면이 곧 첫 경계다.                  */
            return (t > -1e-6 && q >= -1e-9 && q <= 1 + 1e-9) ? Math.max(t, 0) : null;
        },

        /*  ── 점이 앉을 수 있는 면 — **보이는 것만 작용한다** ──────────────────
            APF 의 인력은 장이지 조회가 아니다. 장은 물체를 통과하지 못한다.
            그래서 **n̂ 방향으로 쏜 광선이 콘크리트를 벗어나는 첫 경계**가 그 철근이
            느끼는 면이고, 그 너머는 보이지 않는다. 점이 콘크리트 밖이면 −n̂ 으로
            **들어오는** 첫 경계다(배치 직선이 밖이어도 끌려 들어오면 될 일이다).
            첫 경계가 마주보지 않으면 **그 자리엔 앉을 데가 없다.**

            한때 여기서 벽 24 개를 전부 훑어 「게이트 → band(수선의 발이 면 안) →
            꼭짓점 규칙 → 폴백 → 가장 가까운 것」으로 골랐다. 그 사다리는 전부
            **비국소성을 기하로 가린 땜질**이었다 :
              · 복부 안줄이 E17 끝 위에 서면 **9,237 mm 건너 E3** 가 배정됐다
              · 면의 «끝점»이 641 mm 로 가까워 보여 헌치 **모서리에 매달렸다**(band 가 막던 것)
            광선은 **면에 맞지 끝점에 안 맞고**(끝점은 측도 0), 첫 경계 너머를 못 본다.
            그래서 band·꼭짓점 규칙·폴백이 **막을 상황 자체가 안 생긴다.**
            남는 것은 게이트 하나 — 그건 땜질이 아니라 `nors` 의 물리적 뜻이다.     */
        seatsAt: function (p, n0, walls, sec, dia) {
            const ins = this.inside(p, walls);
            const dir = ins ? n0 : { x: -n0.x, y: -n0.y };
            let first = null;
            (walls || []).forEach(w => {
                const t = this.rayHit(p, dir, w);
                if (t != null && (!first || t < first.t)) first = { t: t, w: w };
            });
            if (!first) return [];                                   // 보이는 것이 없다
            /*  **영향 반경** (Khatib 의 ρ₀). 가시성만으로는 못 막는 자리가 있다 —
                하부슬래브는 콘크리트가 통째로 이어져 있어, 복부 밑에 선 철근이
                **건너편 복부(6,500 mm)를 정말로 본다.** 사이에 가로막는 것이 없다.
                장은 무한히 멀리까지 당기지 않는다.
                크기는 재서 정한다 — 배치 직선을 훑으며 배정되는 거리를 보면
                  정당한 쪽 (제 부재의 면)  0 ~ **609** mm
                  가짜 쪽 (건너편 부재)    **2,700** ~ 9,200 mm
                로 **4.4 배** 떨어져 있다. 그 사이 어디든 되고, 두 배 남짓씩
                여유를 두어 1,500 으로 잡는다. 부재 두께(복부 500 · 슬래브 495 ·
                캔틸레버 300) 의 세 배라, 어느 부재에서도 제 면은 보인다.        */
            if (first.t > this.CONF.RHO0) return [];
            if (first.w.nx * n0.x + first.w.ny * n0.y > this.CONF.GATE) return [];
            return [{ w: first.w, need: JF.coverOf(first.w, sec) + dia / 2,
                      d: first.t, tt: 0.5, band: true, used: true }];
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
        toPrim: function (p, pr, reach) {
            /*  **멀면 바로 버린다.** 장애물은 단면 전체에 52 조각쯤 있는데, 한 철근을
                미는 것은 그중 제 옆에 있는 한둘뿐이다. 그런데 잔차를 한 번 뽑을 때마다
                52 조각을 모두 재고 있었다(아크는 atan2·cos·sin 까지 돈다).
                조각마다 **감싸는 네모**를 한 번 구해 두고, 그 밖으로 R 보다 멀면
                계산 없이 넘긴다. R 은 부르는 쪽이 「이만큼 안이면 본다」로 준다.     */
            if (reach != null) {
                let b = pr._bb;
                if (!b) {
                    b = (pr.t === 'line')
                        ? [Math.min(pr.p[0], pr.p[2]), Math.min(pr.p[1], pr.p[3]),
                           Math.max(pr.p[0], pr.p[2]), Math.max(pr.p[1], pr.p[3])]
                        : [pr.p[0] - pr.p[2], pr.p[1] - pr.p[2],
                           pr.p[0] + pr.p[2], pr.p[1] + pr.p[2]];
                    pr._bb = b;
                }
                if (p.x < b[0] - reach || p.x > b[2] + reach ||
                    p.y < b[1] - reach || p.y > b[3] + reach) return null;
            }
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
                        const need = (pr.dia + dia) / 2;
                        const e = this.toPrim(p, pr, need + dia);
                        if (!e) return;
                        barrier(pr.t === 'arc' ? 'bend' : 'tre', p, i, e.d, e.ex, e.ey,
                                need, K.K_BAR, K.CLR_SOFT);
                    });
                });
                //  ④ 종방향끼리 — **적층이 여기서 나온다**
                for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
                    const dx = P[i].x - P[j].x, dy = P[i].y - P[j].y, d = hyp(dx, dy);
                    if (d < 1e-9) continue;
                    const gg = d - dia;                     // 중심거리 ≥ 지름
                    if (gg >= 0) continue;
                    const kk = Math.sqrt(K.K_BAR), tt = gg / K.CLR_SOFT, u = 1 + tt * tt;
                    const rr = kk * gg / Math.sqrt(u), sc = kk / (u * Math.sqrt(u));
                    push('lre', rr, [2 * i, 2 * i + 1, 2 * j, 2 * j + 1],
                         [sc * dx / d, sc * dy / d, -sc * dx / d, -sc * dy / d]);
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

            //  ⑧ 짝 묶기 — 상·하 한 쌍은 **같은 자리(t)** 에 서야 한다 (K_TIE 주석)
            if (ctx.tie) {
                const kt = Math.sqrt(K.K_TIE);
                P.forEach((p, i) => {
                    if (ctx.tie[i] == null) return;
                    push('tie', kt * (tOf(p) - ctx.tie[i]), [2 * i, 2 * i + 1],
                         [kt * a.u.x, kt * a.u.y]);
                });
            }

            return rows;
        },

        energy: function (P, g, ctx) {
            return this.residuals(P, g, ctx).reduce((s, w) => s + w.r * w.r, 0);
        },

        //  항별로 나눠 본다 (논문 표 — 어느 항이 얼마나 밀었나). tag 로 그냥 더한다.
        parts: function (P, g, ctx) {
            const o = { cover: 0, duct: 0, tre: 0, bend: 0, lre: 0,
                        ctcmin: 0, ctcmax: 0, range: 0, home: 0, tie: 0, total: 0 };
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
                    const need = (pr.dia + g.dia) / 2;
                    const e = this.toPrim(p, pr, need + g.dia);
                    out.push(e ? e.d - need : 1e9);
                });
            });
            for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++)
                out.push(hyp(P[i].x - P[j].x, P[i].y - P[j].y) - g.dia);
            return out;
        },

        /*  철근 **하나**가 장애물을 뚫고 지나가나 — 여유가 있던 것이 겹치게 되면 참.
            같은 무리끼리는 안 본다(간격항이 맡는다. 서로 밀며 같이 움직이는 것을
            「뚫었다」로 보면 무리가 통째로 선다).                                  */
        gapsOf: function (p, g, ctx) {
            const out = [];
            (ctx.ducts || []).forEach(d => out.push(hyp(p.x - d.x, p.y - d.y) -
                ((d.D / 2) + (d.clr != null ? d.clr : 30) + g.dia / 2)));
            (ctx.prims || []).forEach(pr => {
                const need = (pr.dia + g.dia) / 2;
                const e = this.toPrim(p, pr, need + g.dia);
                out.push(e ? e.d - need : 1e9);
            });
            return out;
        },

        hits: function (a, b, g, ctx) {
            return this.crosses(this.gapsOf(a, g, ctx), this.gapsOf(b, g, ctx));
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
                /*  **1단계에는 안 건다.** 1단계는 덕트·철근을 없는 것으로 두고 피복면을
                    찾아 앉는 단계다 — 거기까지 가는 길을 막으면 철근이 장애물 **바깥쪽**
                    (거푸집 쪽)에 걸터앉아 버린다. 실제로 데크 상면 종방향 50개가
                    피복선 밖 13 mm 에 멈췄다(J 가 훨씬 높은 자리다).
                    막을 일은 2단계다 : 제 자리에 앉은 뒤 **비켜나는** 방향을 정할 때.   */
                /*  출발점의 여유는 **걸음마다 한 번만** 잰다 — 반토막을 칠 때마다 다시
                    재고 있었다. 그 자리가 전체 시간의 **82%** 였다(50개 한 무리에
                    58 초 중 `hits` 가 308,266 번 · `toPrim` 이 3,480 만 번).
                    반토막도 6 번이면 1/64 이라 넉넉하다.                          */
                for (let i = 0; i < P.length && ctx.stage >= 2; i++) {
                    const g0 = this.gapsOf(P[i], g, ctx);
                    let f = 1;
                    for (let c = 0; c < 6 && this.crosses(g0, this.gapsOf(Q[i], g, ctx)); c++) {
                        f *= 0.5;
                        Q[i] = { x: P[i].x + d[2 * i] * f, y: P[i].y + d[2 * i + 1] * f };
                    }
                    if (this.crosses(g0, this.gapsOf(Q[i], g, ctx))) Q[i] = { x: P[i].x, y: P[i].y };
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

        /*  ── 철근 **하나**에 걸리는 잔차만 뽑는다 ─────────────────────────
            `residuals()` 는 무리 전체를 훑는다 — 철근 N 개 × 장애물 M 개 + 철근쌍 N²/2.
            `escape` 는 철근마다 후보 둘을 내려보는데, 그 안에서 전체를 다시 훑으면
            **N 배가 곱해진다.** 실제로 50개짜리 한 무리에 **58 초**가 걸렸다
            (횡방향 16개 전체가 60 ms 다). 한 철근만 움직일 때 달라지는 항은
            **그 철근에 걸린 것뿐**이므로 그것만 뽑는다 — 받아들일지 견주는 것도
            그 부분합으로 하면 전체 J 의 증감과 똑같다.                          */
        localRows: function (P, i, g, ctx) {
            const K = this.CONF, rows = [], a = this.axes(g), dia = g.dia, p = P[i];
            const push = (tag, r, idx, j) => rows.push({ tag: tag, r: r, idx: idx, j: j });

            const c = ctx.assign[i];
            if (c) {
                const e = this.cover(p, c);
                const w = Math.sqrt(e.g < 0 ? K.K_COV : 1);
                push('cover', w * e.g, [0, 1], [w * e.ex, w * e.ey]);
            }
            const barrier = (tag, d, ex, ey, need, k, soft) => {
                const gg = d - need;
                if (gg >= 0) return;
                const kk = Math.sqrt(k), tt = gg / soft, u = 1 + tt * tt;
                push(tag, kk * gg / Math.sqrt(u), [0, 1],
                     [kk / (u * Math.sqrt(u)) * ex, kk / (u * Math.sqrt(u)) * ey]);
            };
            if (ctx.stage >= 2) {
                (ctx.ducts || []).forEach(d => {
                    const dist = hyp(p.x - d.x, p.y - d.y);
                    if (dist < 1e-9) return;
                    barrier('duct', dist, (p.x - d.x) / dist, (p.y - d.y) / dist,
                            (d.D / 2) + (d.clr != null ? d.clr : 30) + dia / 2, K.K_CLR, K.CLR_SOFT);
                });
                (ctx.prims || []).forEach(pr => {
                    const need = (pr.dia + dia) / 2;
                    const e = this.toPrim(p, pr, need + dia);
                    if (e) barrier(pr.t === 'arc' ? 'bend' : 'tre', e.d, e.ex, e.ey,
                                   need, K.K_BAR, K.CLR_SOFT);
                });
                for (let j = 0; j < P.length; j++) {
                    if (j === i) continue;
                    const dx = p.x - P[j].x, dy = p.y - P[j].y, d = hyp(dx, dy);
                    if (d < 1e-9) continue;
                    const gg = d - dia;
                    if (gg >= 0) continue;
                    const kk = Math.sqrt(K.K_BAR), tt = gg / K.CLR_SOFT, u = 1 + tt * tt;
                    const sc = kk / (u * Math.sqrt(u));
                    push('lre', kk * gg / Math.sqrt(u), [0, 1], [sc * dx / d, sc * dy / d]);
                }
            }
            //  간격 — 앞뒤 이웃 둘만 (∂t/∂p = û)
            const tOf = q => (q.x - a.O.x) * a.u.x + (q.y - a.O.y) * a.u.y;
            [[i - 1, i, -1], [i, i + 1, 1]].forEach(([lo, hi, sgn]) => {
                if (lo < 0 || hi >= P.length) return;
                const sp = tOf(P[hi]) - tOf(P[lo]);
                if (g.ctcmin != null && sp - g.ctcmin < 0) {
                    const kk = Math.sqrt(K.K_CTCMIN);
                    push('ctcmin', kk * (sp - g.ctcmin), [0, 1],
                         [sgn * kk * a.u.x, sgn * kk * a.u.y]);
                }
                if (g.ctcmax != null && g.ctcmax - sp < 0) {
                    const gg = g.ctcmax - sp, kk = Math.sqrt(K.K_CTCMAX);
                    const tt = gg / K.CTCMAX_SOFT, u = 1 + tt * tt, sc = kk / (u * Math.sqrt(u));
                    push('ctcmax', kk * gg / Math.sqrt(u), [0, 1],
                         [-sgn * sc * a.u.x, -sgn * sc * a.u.y]);
                }
            });
            const t = tOf(p), kr = Math.sqrt(K.K_RANGE);
            if (t < g.range.min) push('range', kr * (t - g.range.min), [0, 1], [kr * a.u.x, kr * a.u.y]);
            if (t > g.range.max) push('range', kr * (g.range.max - t), [0, 1], [-kr * a.u.x, -kr * a.u.y]);

            const ka = Math.sqrt(K.K_A), kn = Math.sqrt(K.K_N);
            const dx0 = p.x - ctx.home[i].x, dy0 = p.y - ctx.home[i].y;
            push('home', ka * (dx0 * a.u.x + dy0 * a.u.y), [0, 1], [ka * a.u.x, ka * a.u.y]);
            push('home', kn * (dx0 * a.n.x + dy0 * a.n.y), [0, 1], [kn * a.n.x, kn * a.n.y]);
            if (ctx.tie && ctx.tie[i] != null) {
                const kt = Math.sqrt(K.K_TIE);
                push('tie', kt * (t - ctx.tie[i]), [0, 1], [kt * a.u.x, kt * a.u.y]);
            }
            return rows;
        },

        localEnergy: function (P, i, g, ctx) {
            return this.localRows(P, i, g, ctx).reduce((s, w) => s + w.r * w.r, 0);
        },

        /*  **철근 하나만** 내린다 (나머지는 고정).                              */
        descendOne: function (P, i, g, ctx) {
            const K = this.CONF;
            let last = this.localEnergy(P, i, g, ctx), lam = K.LAM0;
            for (let it = 0; it < 60; it++) {
                const rows = this.localRows(P, i, g, ctx);
                const H = [[0, 0], [0, 0]], gr = [0, 0];
                rows.forEach(w => {
                    for (let a = 0; a < 2; a++) {
                        gr[a] += w.j[a] * w.r;
                        for (let b = 0; b < 2; b++) H[a][b] += w.j[a] * w.j[b];
                    }
                });
                const A = [[H[0][0] + lam * (H[0][0] > 1e-12 ? H[0][0] : 1), H[0][1]],
                           [H[1][0], H[1][1] + lam * (H[1][1] > 1e-12 ? H[1][1] : 1)]];
                const det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
                if (Math.abs(det) < 1e-12) { lam *= 8; if (lam > 1e12) break; continue; }
                const dx = (-gr[0] * A[1][1] + gr[1] * A[0][1]) / det;
                const dy = (-gr[1] * A[0][0] + gr[0] * A[1][0]) / det;
                const Q = P.slice(); Q[i] = { x: P[i].x + dx, y: P[i].y + dy };
                const Jn = this.localEnergy(Q, i, g, ctx);
                if (Jn <= last && !this.hits(P[i], Q[i], g, ctx)) {
                    P = Q; last = Jn; lam = Math.max(lam * 0.3, 1e-12);
                    if (hyp(dx, dy) < K.TOL) break;
                } else { lam *= 8; if (lam > 1e12) break; }
            }
            return { P: P, J: last };
        },

        /*  ── 건너편 주머니가 더 낮으면 건너간다 ────────────────────────────
            척력은 장애물을 감싼 **관(tube)** 이라, 그 양쪽이 각각 J 의 바닥이다.
            하강은 관을 못 넘으므로 태어난 쪽 바닥에서 멈춘다 — 그런데 **건너편이 더
            낮을 수 있다.** 실제로 소핏 종방향 철근이 ⑨-1 의 다리 **바깥쪽**(거푸집 쪽)에
            멈췄는데(J 6,596), 다리 건너 안쪽이 J 4,890 이었다.
            그래서 장애물에 걸린 철근마다 **건너편으로 되비춰 내려보고 J 를 견준다.**
            낮으면 건너가고 아니면 제자리다 — **고르는 것은 J 하나**이고, 규칙이 아니다.
            (1 mm 쯤 살짝 미는 것으로는 못 넘는다. 지름만큼 건너가야 한다.)          */
        escape: function (P, g, ctx, rounds) {
            const a = this.axes(g);
            let moved = true;
            for (let r = 0; r < (rounds || 4) && moved; r++) {
                moved = false;
                for (let i = 0; i < P.length; i++) {
                    /*  장애물에 **닿아 있거나 가까운** 철근을 본다.
                        「겹쳐 있을 때만」으로 두었더니, 상대에 **딱 붙어 선**(여유 0.0)
                        철근이 걸러졌다 — 데크 중앙의 종방향 철근이 횡방향 철근의
                        **거푸집 쪽**에 13.0 mm 로 딱 붙어 서 있었는데(피복 13 mm 부족),
                        반대쪽으로 넘기면 J 가 3,380 → 169 인 자리였다.
                        닿은 것도 후보다 — **어느 쪽인지는 J 가 고른다.**            */
                    let near = null;
                    (ctx.prims || []).forEach(pr => {
                        const need = (pr.dia + g.dia) / 2;
                        const e = this.toPrim(P[i], pr, need + g.dia);
                        if (!e) return;
                        const gg = e.d - need;
                        if (gg < g.dia && (!near || gg < near.g)) near = { e: e, g: gg, need: need };
                    });
                    if (!near) continue;
                    const J0 = this.localEnergy(P, i, g, ctx);
                    /*  후보는 둘이다. **어느 쪽인지는 J 가 고른다.**
                      ㉠ 관 건너편 — 장애물을 넘어 반대쪽 바닥으로
                      ㉡ 같은 쪽으로 **비켜서기** — 장애물에서 필요거리만큼 떨어진 자리.
                         겹친 채로 멈춘 철근은 대개 이쪽이 답이다(먼저 놓인 철근 위로
                         쌓이는 그 자리다). ㉠ 만 보던 판은 ⑨-1 의 다리에 0.1 mm 붙어
                         멈춘 철근을 못 구했다 — 건너편은 거푸집 쪽이라 더 나빴다.      */
                    const cand = [
                        { x: P[i].x - near.e.ex * (2 * (near.e.d + near.need) + 1),
                          y: P[i].y - near.e.ey * (2 * (near.e.d + near.need) + 1) },
                        { x: P[i].x + near.e.ex * (near.need - near.e.d + 1),
                          y: P[i].y + near.e.ey * (near.need - near.e.d + 1) }
                    ];
                    let best = null;
                    cand.forEach(q => {
                        const Q = P.slice(); Q[i] = q;
                        const r2 = this.descendOne(Q, i, g, ctx);
                        if (!best || r2.J < best.J) best = r2;
                    });
                    if (best && best.J < J0 - 1e-9) { P = best.P; moved = true; }
                }
            }
            return P;
        },


        /*  ── 짝을 «같이» 옆으로 밀어 본다 ────────────────────────────────
            두 켜 사이에 낀 철근은 위 켜가 아래로, 아래 켜가 위로 민다. 두 켜가
            **나란하지 않으면** 그 두 힘이 안 지워지고, 합력이 쐐기가 **벌어지는
            쪽**을 가리킨다 — 옆으로 빠지라는 뜻이다. S14 캔틸레버가 그렇다 :
              ④ 기울기 −12.02° · ②-1 −1.72°  →  **10.3° 쐐기**
              x −5125 에서 두 중심선 사이 21.3 mm (D13 이 들어가려면 26 필요)
              x −5100 으로 **25 mm** 옆으로 가면 25.8 mm — 들어간다
            그런데 아랫줄 혼자 옆으로 가면 묶음 항(K_TIE)이 1000×25² 로 막는다.
            **짝이 같이 가야 한다** — 같이 가면 묶음 값은 그대로 0 이다.
            그래서 **윗줄과 아랫줄을 한 몸으로 보고** 자리(t)를 옆으로 옮겨 보며
            두 줄의 J 를 **더해서** 견준다. 재 보면 (묶음 뺀 국소 J) :
              지금 (아랫줄이 겹을 넘어감)   아래 1,157 + 위   183 = 1,340
              짝이 같이 25 mm 옆으로       아래   502 + 위   489 =   991  ← 낮다
            고르는 것은 여기서도 J 다. 옮길 자리가 없으면 제자리에 있는다.      */
        /*  ── 쐐기 — 두 켜 사이에 낀 자리를 잰다 ─────────────────────────
            **규칙** (이 자리에서 위로 갈지 옆으로 갈지) :
              ㉠ 나를 **마주보고** 누르는 두 조각 A·B 를 찾는다 (척력 방향의 내적 < 0).
              ㉡ 두 중심선 사이의 너비  w = d_A + d_B
                 들어가는 데 드는 값     need = need_A + need_B
                 (D13 셋이면 need = 13 + 13 = 26 mm)
              ㉢ w ≥ need 면 이미 들어가 있다 — 아무것도 안 한다.
              ㉣ w < need 면 **합력**을 본다. 두 척력은 서로 지우려 들지만 두 켜가
                 나란하지 않으면 남는 것이 있고, 그 축 성분이 **쐐기가 벌어지는
                 쪽**을 가리킨다.  F = Σ(−gg_i)·n̂_i ,  벌어지는 쪽 = sign(F·û)
                 (부호가 dw/dt 와 같은지 여기서 같이 확인한다.)
              ㉤ 그쪽으로 s* = (need − w)/(dw/dt) 만큼 가면 틈이 생긴다.
                 **닿는 데 있으면**(|s*| ≤ span) 옆으로 갈 자리를 내놓고,
                 **없으면**(두 켜가 나란해 dw/dt ≈ 0 이거나 너무 멀면) 내놓지 않는다
                 — 그것이 「빈틈이 없는 자리」이고, 그때는 위로 올라간다(`rescue`).
            S14 캔틸레버 : ④ −12.02° · ②-1 −1.72° 라 dw/dt = 0.183 mm/mm,
            x −5125 에서 w 21.3 · need 26 → s* = +25.7 mm. 재 본 값과 맞는다.     */
        wedge: function (p, g, ctx, u, span) {
            const list = [];
            (ctx.prims || []).forEach(pr => {
                const need = (pr.dia + g.dia) / 2;
                const e = this.toPrim(p, pr, need + g.dia);
                if (!e) return;
                list.push({ pr: pr, need: need, d: e.d, ex: e.ex, ey: e.ey, gg: e.d - need });
            });
            if (list.length < 2) return null;
            list.sort((q, r) => q.gg - r.gg);
            const A = list[0];
            let B = null;
            for (let k = 1; k < list.length; k++)
                if (list[k].ex * A.ex + list[k].ey * A.ey < -0.5) { B = list[k]; break; }
            if (!B) return null;                               // 마주보고 누르는 짝이 없다
            const w = A.d + B.d, need = A.need + B.need;
            if (w >= need) return { w: w, need: need, fits: true, s: 0, A: A.pr._id, B: B.pr._id };
            //  합력의 축 성분
            const fx = (-A.gg) * A.ex + (-B.gg) * B.ex, fy = (-A.gg) * A.ey + (-B.gg) * B.ey;
            const fa = fx * u.x + fy * u.y;
            //  쐐기가 벌어지는 기울기 (수치로 — 아크도 같은 식으로 다룬다)
            const D = Math.max(2, g.dia / 4);
            const wAt = q => {
                const ea = this.toPrim(q, A.pr, 1e9), eb = this.toPrim(q, B.pr, 1e9);
                return (ea && eb) ? ea.d + eb.d : null;
            };
            const wp = wAt({ x: p.x + u.x * D, y: p.y + u.y * D });
            const wm = wAt({ x: p.x - u.x * D, y: p.y - u.y * D });
            if (wp == null || wm == null) return { w: w, need: need, fits: false, s: null };
            const dw = (wp - wm) / (2 * D);
            if (Math.abs(dw) < 1e-3) return { w: w, need: need, fits: false, s: null, dw: dw };
            const s = (need - w) / dw;                          // 부호까지 그대로
            const lim = span || 4 * g.dia;
            return { w: w, need: need, fits: false, dw: dw, fa: fa,
                     agree: (fa === 0 || (fa > 0) === (s > 0)),
                     s: (Math.abs(s) <= lim) ? s : null,
                     A: A.pr._id, B: B.pr._id };
        },

        slidePairs: function (PT, PB, gT, gB, ctxT, ctxB, tie, seatT, seatB, stuck, span, step) {
            span = span || 4 * gT.dia; step = step || Math.max(2, gT.dia / 4);
            const K = this.CONF, a = this.axes(gT), out = tie.slice();
            for (let i = 0; i < PB.length; i++) {
                if (tie[i] == null) continue;
                /*  **한 켜 뒤보다 깊이 들어간 짝에게만** 묻는다. 멀쩡히 앉은 철근까지
                    옆으로 떠보면 배치가 통째로 흔들리고 느려진다.                */
                const c0 = seatB(PB[i]);
                if (!c0 || this.slack(PB[i], c0) < 2.2 * gT.dia) continue;
                ctxT.assign[i] = seatT(PT[i]); ctxB.assign[i] = c0; ctxB.tie = out;
                let best = { s: 0, J: this.localEnergy(PT, i, gT, ctxT) + this.localEnergy(PB, i, gB, ctxB),
                             pt: PT[i], pb: PB[i] };
                /*  **규칙이 자리를 고른다** — 눈감고 훑지 않는다 (wedge 주석).
                    쐐기가 「여기서 벌어진다」고 하면 그 자리와 한 뼘 더 간 자리만
                    내려본다. 아무것도 안 내놓으면 빈틈이 없는 것이고, 그때는
                    위로 올라간 지금 자리가 답이다.                              */
                const wd = this.wedge((stuck && stuck[i]) || PB[i], gB, ctxB, a.u, span);
                if (!wd || wd.s == null) continue;
                const cand = [wd.s, wd.s * 1.25, wd.s + Math.sign(wd.s) * gB.dia];
                for (let ci = 0; ci < cand.length; ci++) {
                    const s = cand[ci];
                    if (!s || Math.abs(s) > span) continue;
                    const qT = { x: PT[i].x + a.u.x * s, y: PT[i].y + a.u.y * s };
                    const qB = { x: PB[i].x + a.u.x * s, y: PB[i].y + a.u.y * s };
                    const cT = seatT(qT), cB = seatB(qB);
                    if (!cT || !cB) continue;
                    const QT = PT.slice(); QT[i] = qT;
                    const t2 = out.slice(); t2[i] = tie[i] + s;
                    const cxT = Object.assign({}, ctxT, { assign: ctxT.assign.slice() }); cxT.assign[i] = cT;
                    const cxB = Object.assign({}, ctxB, { assign: ctxB.assign.slice(), tie: t2 }); cxB.assign[i] = cB;
                    const rT = this.descendOne(QT, i, gT, cxT);
                    /*  아랫줄은 **깊이도 두 가지**를 내려본다. 지금 자리를 옆으로만
                        옮기면 이미 겹을 넘어선 자리라, 관에 막혀 쐐기로 못 내려온다 —
                        그래서 그 자리의 **피복선 위**에서도 한 번 내려본다.        */
                    const sl = this.slack(qB, cB);
                    const cands = [qB, { x: qB.x - cB.w.nx * (sl - K.NUDGE),
                                         y: qB.y - cB.w.ny * (sl - K.NUDGE) }];
                    let rB = null;
                    cands.forEach(q => {
                        const QB = PB.slice(); QB[i] = q;
                        const r = this.descendOne(QB, i, gB, cxB);
                        if (!rB || r.J < rB.J) rB = r;
                    });
                    const J = rT.J + rB.J;
                    if (J < best.J - 1e-9) best = { s: s, J: J, pt: rT.P[i], pb: rB.P[i] };
                }
                if (best.s) { PT[i] = best.pt; PB[i] = best.pb; out[i] = tie[i] + best.s; }
            }
            return { PT: PT, PB: PB, tie: out };
        },

        /*  ── 겹을 통째로 넘어간 자리로 구해 낸다 (마지막 손질) ─────────────
            `escape` 의 ㉡ 는 **걸린 놈 하나**에서만 비켜선다. 두 겹이 나란히 누워
            있으면 그 **사이**에 서는데, 들어갈 수 없는 틈일 수 있다. 데크 중앙의
            아래쪽 종방향 철근이 ④ 와 ⑤ 사이(22 mm · 필요 26)에 끼려다 못 끼고
            ④ 의 **거푸집 쪽**으로 밀려나 피복이 12.7 mm 모자랐다. 실제로는
            49 mm 만 더 들어가면 ④·⑤ 를 **둘 다 넘긴** 빈자리가 있다.
            그래서 **끝까지 위반이 남은 철근에게만** 그 자리를 후보로 준다.
            (누구에게나 주면 멀쩡히 앉은 철근까지 한 겹 더 들어가 간격이 315 mm
             까지 벌어졌다 — 한계 300. 이것은 구제이지 배치 규칙이 아니다.)
            고르는 것은 여전히 J 다.                                          */
        rescue: function (P, g, ctx) {
            const a = this.axes(g);
            for (let i = 0; i < P.length; i++) {
                const seat = (ctx.assign || [])[i];
                if (!seat) continue;
                let worst = 0;
                (ctx.prims || []).forEach(pr => {
                    const need = (pr.dia + g.dia) / 2;
                    const e = this.toPrim(P[i], pr, need + g.dia);
                    if (e && need - e.d > worst) worst = need - e.d;
                });
                const sl = this.slack(P[i], seat);
                if (worst <= 0.05 && sl >= -0.05) continue;      // 멀쩡하면 손대지 않는다
                /*  들어가는 방향은 면의 법선에서 **축 성분을 뺀 것**이다. 면이 기울어
                    있으면 법선을 그대로 타고 49 mm 들어갈 때 자리(t)가 7 mm 밀리는데,
                    짝으로 묶인 철근은 그것이 묶음 항에 54,000 으로 잡혀 이 후보가 늘
                    진다. 옆으로 밀 이유가 없다 — 곧장 안으로만 들어간다.            */
                let dx = seat.w.nx, dy = seat.w.ny;
                const ax = dx * a.u.x + dy * a.u.y;
                dx -= ax * a.u.x; dy -= ax * a.u.y;
                const dn = hyp(dx, dy);
                if (dn > 1e-9) { dx /= dn; dy /= dn; } else { dx = a.n.x; dy = a.n.y; }
                const step = g.dia / 4, lim = 10 * g.dia;
                let q = null;
                for (let t = step; t <= lim; t += step) {
                    const c = { x: P[i].x + dx * t, y: P[i].y + dy * t };
                    let clear = true;
                    for (let k = 0; k < (ctx.prims || []).length; k++) {
                        const pr = ctx.prims[k], need = (pr.dia + g.dia) / 2;
                        const e = this.toPrim(c, pr, need + g.dia);
                        if (e && e.d < need) { clear = false; break; }
                    }
                    if (clear) { q = c; break; }
                }
                if (!q) continue;
                const J0 = this.localEnergy(P, i, g, ctx);
                const Q = P.slice(); Q[i] = q;
                const r = this.descendOne(Q, i, g, ctx);
                if (r.J < J0 - 1e-9) P = r.P;
            }
            return P;
        },

        /*  한 무리를 푼다. `jfield.settle()` 과 같은 차례다 :
            1단계 콘크리트만 → 2단계 덕트·철근을 켜고 다시 내린다.
            각 단계 안에서 「면 배정 → 고정하고 하강 → 다시 배정」을 번갈아 한다.  */
        solve: function (g, walls, sec, ducts, prims, tie) {
            const a = this.axes(g);
            /*  `range` 가 없으면 **콘크리트가 준다** (spanOf 주석). 못 찾으면
                「한계 없음」으로 둔다 — 그때 열차 한가운데는 init 이다.
                쏘는 자리는 배치 직선 위의 init 이 아니라 **면에서 물린 자리**다 :
                짝(`gap`)으로 태어난 줄은 정확히 면 «위»에 서므로, 거기서 쏘면
                이웃한 토막(셀)을 잡는다. 실제로 앉을 자리까지 한 번 당겨서 쏜다. */
            if (!g.range || !isFinite(g.range.min) || !isFinite(g.range.max)) {
                const st = this.seatsAt(a.O, a.n, walls, sec, g.dia).filter(c => c.used);
                const c = st.length ? this.nearestSeat(a.O, st) : null;
                const from = c ? { x: a.O.x + c.w.nx * c.need, y: a.O.y + c.w.ny * c.need } : a.O;
                const sp = this.spanOf(from, g, walls, sec);
                /*  콘크리트가 준 한계에는 **init 기준이라는 뜻이 없다** — 그 구간은
                    단면이 정한 것이지 사람이 init 에서 잰 것이 아니다. 그러니 이때의
                    기본 맞춤은 `center` 다. 사람이 `align` 을 적었으면 그것이 이긴다. */
                g = Object.assign({}, g, { range: sp || { min: -Infinity, max: Infinity },
                                           align: g.align || (sp ? 'center' : 'init'),
                                           _autoRange: !!sp });
            }
            const home = this.layout(g);
            let P = home.map(p => ({ x: p.x, y: p.y }));
            /*  짝으로 들어온 아랫줄은 **윗줄이 앉은 자리에서 태어난다.** 균등배치에서
                출발해 놓고 묶으면 첫 걸음이 통째로 끌려가 헛돈다.                */
            if (tie) P = P.map((p, i) => (tie[i] == null ? p
                : { x: p.x + a.u.x * (tie[i] - home[i].t),
                    y: p.y + a.u.y * (tie[i] - home[i].t) }));
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

            let iter = 0, J = null, stuck = null;
            [1, 2].forEach(stage => {
                /*  2단계에 들어가기 전에 **안쪽으로 살짝** 민다.
                    1단계가 끝나면 철근이 피복선 위에 앉는데, 먼저 놓인 철근도 같은 선 위에
                    있으면 거기가 척력의 **꼭대기**(대칭점)라 방향이 정해지지 않는다.
                    밀 방향은 고를 것이 없다 — 바깥은 거푸집이고 안쪽이 콘크리트다.
                    겹은 안쪽으로 쌓인다 (jfield.settle 의 NUDGE 와 같은 근거).        */
                if (stage === 2) {
                    P = P.map(p => {
                        const s = seatsFor(p);
                        const c = s.length ? this.nearestSeat(p, s) : null;
                        if (!c) return p;
                        return { x: p.x + c.w.nx * this.CONF.NUDGE, y: p.y + c.w.ny * this.CONF.NUDGE };
                    });
                }
                let assign = assignOf(P), seen = {};
                for (let o = 0; o < this.CONF.OUTER; o++) {
                    const key = assign.map(c => c ? c.w.id : '-').join(',');
                    if (seen[key]) break;
                    seen[key] = 1;
                    const ctx = { assign: assign, home: home, ducts: ducts, prims: prims, stage: stage, tie: tie };
                    const r = this.descend(P, g, ctx);
                    P = r.P; J = r.J; iter += r.iter;
                    const next = assignOf(P);
                    if (next.map(c => c ? c.w.id : '-').join(',') === key) break;
                    assign = next;
                }
                //  2단계가 끝나면 **건너편 주머니와 J 를 견준다** (escape 참조)
                if (stage === 2) {
                    /*  **겹에 끼어 멈춘 자리**를 여기서 남겨 둔다 — `escape` 가 관을
                        건너고 `rescue` 가 위로 올리고 나면, 그 철근은 더 이상 두 켜
                        «사이»에 있지 않아 나중에 쐐기를 재려 해도 마주보고 누르는
                        짝이 안 보인다. 옆으로 갈지 위로 갈지는 **낀 자리**에서
                        판단해야 한다 (wedge 주석의 규칙).                        */
                    stuck = P.map(p => ({ x: p.x, y: p.y }));
                    const ctx = { assign: assignOf(P), home: home, ducts: ducts, prims: prims, stage: 2, tie: tie };
                    P = this.escape(P, g, ctx);
                    let r = this.descend(P, g, { assign: assignOf(P), home: home,
                                                 ducts: ducts, prims: prims, stage: 2, tie: tie });
                    P = r.P; J = r.J; iter += r.iter;
                    //  아직 위반이 남은 철근만 겹 너머로 구해 내고 한 번 더 내린다
                    const P2 = this.rescue(P, g, { assign: assignOf(P), home: home,
                                                   ducts: ducts, prims: prims, stage: 2, tie: tie });
                    if (P2 !== P) {
                        P = P2;
                        r = this.descend(P, g, { assign: assignOf(P), home: home,
                                                 ducts: ducts, prims: prims, stage: 2, tie: tie });
                        P = r.P; J = r.J; iter += r.iter;
                    }
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

            return { id: g.id, bars: bars, gaps: gaps, J: J, iter: iter, range: g.range, auto: !!g._autoRange,
                     home: home, tie: tie || null, stuck: stuck, axes: a, capacity: this.capacity(g) };
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
                           ducts: ducts, prims: prims, stage: 2, tie: res.tie || null };
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
            const r = this.descend(Q, g, { assign: Q.map(seatOf), home: res.home, tie: res.tie || null,
                                           ducts: ducts, prims: prims, stage: 2 });
            return { here: here, other: r.J, side: side, d: e.d, need: need, moved: r.P[i] };
        }
    };

    root.JLong = JLong;
    if (typeof module !== 'undefined' && module.exports) module.exports = JLong;

})(typeof globalThis !== 'undefined' ? globalThis : this);
