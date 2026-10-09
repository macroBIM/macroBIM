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
 *  ── 철근 하나를 세우는 규칙 (이 엔진의 계약) ──────────────────────────
 *  **딱 세 걸음이다. 되풀이하지 않는다.**
 *
 *    ㉠ 조각마다 제 면을 찾아 **한 번** 앉힌다                      (settle)
 *    ㉡ 앉은 면이 그 조각의 **직선식**이 된다.
 *       이웃한 두 직선의 **교점**이 코너다                     (joinCorners)
 *    ㉢ 코너에서 **입력 길이**(없으면 기본값)만큼 되짚어 자유단을 놓는다
 *
 *  그래서 **입력 길이는 제약이 아니라 출발점**이다 — 「어디서 벽을 찾기 시작하나」를
 *  정할 뿐이고, 앉고 나면 그 조각이 놓인 직선만 남는다. 가운데 조각은 **입력이
 *  필요 없다**(코너끼리 이으면 되니까 길이는 출력이다). 입력 길이가 실제로 쓰이는
 *  자리는 **양 끝 조각의 자유단** 하나뿐이다.
 *
 *  ㉠ 이 끝난 자리는 **고정이다.** 그려진 폴리라인으로 조각을 다시 만들어 또 푸는
 *  고리를 한동안 뒀었는데(순간격을 토막이 아니라 그려진 몸에서 재려던 것), 그
 *  되먹임이 앉은 자리를 흔들었다 : ⑧ 의 다리 둘이 판1 에 제 면(복부 외측 · 셀 바닥)
 *  에 맞게 앉았는데, 판2 에서 코너가 다리를 552 mm 끌어 헌치 끝을 50 mm 벗어나게
 *  만들었고, 그러자 남은 후보가 5.7 m 위의 데크뿐이라 철근이 거기로 올라갔다.
 *  **처음 앉은 자리가 답이다.**
 *
 *  ── 한 조각을 앉히는 순서 (㉠ 의 속) ──────────────────────────────────
 *  1단계  덕트·철근을 없는 것으로 두고 피복면에 앉힌다
 *  2단계  그 자리에서 덕트·기존 철근을 켜고 다시 내린다 (비켜나기)
 *  각 단계 안에서는 「끝점을 면에 배정 → 배정을 고정하고 하강 → 다시 배정」을
 *  번갈아 한다(ICP 식 교대최소화). 순서와 교대가 없으면 한쪽 배리어가 능선이 되어
 *  기울기하강이 못 넘는다 — 왜 그런지는 settle() 에 적어 두었다.
 *
 *  ── 안 건드리는 것 ────────────────────────────────────────────────────
 *  `physics.js` · `domain.js` 는 그대로다. 이 파일은 옆에 선다.
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
            K_CLR: 4.0,        // **덕트** 순간격 위반 (작은 위반에서의 2차 계수)
            /*  K_BAR  **철근끼리의 접촉.** 덕트(K_CLR)와 갈라 둔다 — 성격이 다르다.
                덕트는 구멍이라 **못 지키는** 위반이 흔하다 (복부철근이 TC D440 을
                어디로 가도 120 mm 겹친다). 세게 주면 그 120 이 피복 인력을 이겨
                배근이 통째로 망가진다 — 한때 400 을 줬다가 상면 철근이 단면 밖으로
                수천 mm 날아갔다. 그래서 덕트는 4 다.
                철근끼리는 **지킬 수 있는** 위반이고 지켜야 한다. 그리고 같은 두
                철근이 닿는 일인데 **어느 쪽이 움직이느냐에 따라 뻣뻣함이 달라지면
                한 접촉이 아니다** — `JLong.CONF.K_BAR` 와 같은 1000 을 쓴다.

                K_TRE  **횡방향끼리.** 원칙대로는 K_BAR 과 같은 수여야 한다.
                그런데 **아직 못 올린다.** 올리면 재서 나빠진다 (`bench/jk.js`) :
                  K_TRE      4      20      50     100     200     400    1000
                  겹치는 짝  50      44      44      44      42      42      42
                  피복모자람 없음   없음    없음   -1.8    없음   -2.4    -2.4
                  꼭짓점이동  0.0     8.9    11.5     9.1    24.8    11.2    11.3
                겹침 50 중 **16 은 「엇갈림」**이다 — 두 횡방향이 단면에서 교차한다.
                밀어서 풀 수 있는 것이 아니고, 실제로는 교축방향으로 다른 자리에
                있다(`sameZ`). 그런데 **시트의 trebar z 가 전부 0** 이라 엔진에는
                진짜 충돌로 보인다. 감쇠 배리어의 포화힘이 √K·CLR_SOFT 이므로
                K 를 올리면 **그 못 지킬 힘도 같이 커져서** 멀쩡한 철근을 민다 :
                  K 1000 에서 ①[b] 가 ②[b] 와의 엇갈림에 밀려 피복을 2.4 mm 깼고,
                  20 에서도 횡방향이 종방향 자리로 밀려 D1#50·#95 를 5.9 mm 침범했다
                  (`bench/jbend.js`). 덕트에서 겪은 그 병과 같다.
                **z 를 채우면 올릴 수 있다.** 그때 K_TRE 는 지우고 K_BAR 하나로 간다.  */
            K_BAR: 1000.0,     // 철근끼리 (= JLong.CONF.K_BAR). 바꿀 때는 **같이** 바꾼다
            K_TRE: 4.0,        // 횡방향끼리 — **z 를 채울 때까지** 옛 값에 둔다
            RHO_LINK: 1500.0,  // 연결 조각이 자리를 찾는 반경 (자유단에는 안 건다)
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
            /*  LEG_MIN  **결속점 뒤로 남겨야 하는 곧은 길이** — 지름의 배수.
                갈고리의 다리는 정착하려고 있는 것이라, 종방향을 다리의 **끝**에서
                물면 뒤에 남는 것이 없어 아무것도 정착하지 못한다. 띠를 열었더니
                실제로 그리 갔다 (T1#8 이 h = ℓ 로 미끄러져 정착 0.2 mm 가 됐다).
                값은 **기준이 정한다** — 135° 갈고리의 연장은 6dᵇ 이상이다
                (KDS 14 20 52 · EN 1992-1-1 8.5). H13 이면 78 mm 다.
                이것은 고르는 값이 아니라 **인용**이고, `mat | fck | fy` 가 단면
                입력에 들어오면 그 자리를 정착길이 식이 가져간다 (STATUS 「아직 안
                한 것」). 그때까지는 가장 느슨한 쪽(6dᵇ)을 쓴다.                 */
            LEG_MIN: 6,        // 결속점 뒤 곧은 길이 ≥ 6·dᵇ (135° 갈고리 연장)
            K_AXIAL: 1.0,      // 축방향 미끄러짐을 막는 무게 (피복 인력과 같은 급)
            K_ANCHOR: 1e-6,    // 나머지 방향을 아주 약하게 묶는 무게
            LAM0: 1e-3,        // LM 감쇠의 시작값 (2차 근사를 얼마나 믿을지)
            ITER: 200,         // 한 배정에서의 최대 반복 (가우스-뉴턴이라 몇 번이면 끝난다)
            OUTER: 12,         // 배정 다시 잡기 최대 횟수
            TOL: 1e-4,         // **걸음**이 이보다 작아지면 멈춘다 (mm)
            H: 0.05,           // 수치미분 간격 (mm) — 야코비 검산에만 쓴다
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
        energyParts: function (pose, seg, cons, ducts, placed, lpts, assign) {
            const K = this.CONF, half = seg.len / 2;
            const dx = Math.cos(pose.th) * half, dy = Math.sin(pose.th) * half;
            const pts = [{ x: pose.cx - dx, y: pose.cy - dy }, { x: pose.cx + dx, y: pose.cy + dy }];
            const o = { cover: 0, duct: 0, bar: 0, lre: 0, hook: 0, par: 0, anchor: 0 };

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
                if (!this.sameZ(q, seg)) return;
                const need = (q.dia + seg.dia) / 2;
                this.clearPairs(pts, q.p1, q.p2).forEach(n => {
                    const g = n.d - need;
                    if (g < 0) { const e = this.clrRes(g, K.K_TRE); o.bar += e.r * e.r; }
                });
            });
            (lpts || []).forEach(q => {
                const g = this.segToPoint(pts, q) - this.lreNeed(q, seg.dia);
                if (g < 0) { const e = this.clrRes(g, K.K_BAR); o.lre += e.r * e.r; }
            });
            const ux = Math.cos(pose.th), uy = Math.sin(pose.th);
            const ax = (pose.cx - seg.c0.x) * ux + (pose.cy - seg.c0.y) * uy;
            const pp = -(pose.cx - seg.c0.x) * uy + (pose.cy - seg.c0.y) * ux;
            const at = (pose.th - seg.th0) * half;
            if (seg.hook && seg.hookQ) o.hook = this.hookEnergy(pose, seg);
            if (seg.hook && seg.parW) o.par = this.parEnergy(pose, seg);
            o.anchor = (seg.hook ? 0 : K.K_AXIAL * ax * ax) + K.K_ANCHOR * (pp * pp + at * at);
            o.total = o.cover + o.duct + o.bar + o.lre + o.hook + o.par + o.anchor;
            return o;
        },

        /*  ── 갈고리의 자리는 **벽이 아니라 종방향 철근**이다 ──────────────────
            ㄷ(스터럽)는 단면 평면 **안에** 누워 있고, 그 평면을 **뚫고 지나가는**
            철근만 걸 수 있다 — 그게 종방향(점)이다. 횡방향은 같은 평면에 나란히
            누워 있어 걸 수가 없다(부딪힐 뿐이다). 그래서 인력 대상은 종방향뿐이고,
            콘크리트 피복은 인력이 아니라 **결과**다 (검사로 돌린다).

            ── 절곡 «직전»에서 멈추게 하는 법 ──────────────────────────────────
            철근이 절곡 아크 **안**으로 들어가면 안 되고, 아크가 시작되는 접선점에
            닿아야 한다. 코너 C · 중심선 곡률반경 R · 다리방향 û · 법선 n̂ 일 때
            그 자리는

                q = C − R·û + need·n̂                     (need = (dᵃ+dᵇ)/2)

            이다. 이것을 **두 수직거리**로 쓰면 항이 둘로 끝난다 :

                다리(자유단)  까지의 수직거리 = need      ← 철근에 닿는다
                몸통(연결조각)까지의 수직거리 = R         ← 절곡이 시작되는 거리

            둘을 동시에 만족하는 점이 하나뿐이고 그게 접선점이다. 아크를 따로
            재지 않아도 되고, 다리를 따라 미끄러지는 자유도도 안 남는다 —
            **코너의 자리는 두 직선의 교점이 정하고, 그 교점을 몸통 항이 잡는다.**
            (한때 다리에 축방향 항 K_AX·s² 를 줘 봤는데, `joinCorners` 가 코너를
             교점으로 다시 만들면서 그 항이 지워졌다. 축을 잡는 자리는 몸통이다.)
            ※ 몸통의 이 **못박기는 뒤에 「선호」로 내려갔다.** 축방향은 점이 아니라
              띠다 — 바로 아래 「축방향은 «꼭 접선점» 이 아니다」. 다리의 항(need)은
              그대로 요구다.

            항의 꼴은 피복항과 같다 — 양쪽 우물에 가중치만 어긋나 있다 :
                J = w (d − target)² ,   w = ( d < target ? K_BAR : 1 )
            멀면 당기고(1), 파고들면 세게 민다(K_BAR). 인력과 척력이 한 항이다.

            H13/H13 · R 32.5 이면 코너까지 √(R²+need²) = 35.00, 아크까지 정확히
            need 다. **직선에는 닿고 아크에는 안 들어간다.**

            seg 에 실어 보내는 것 :
              hook     이 조각이 갈고리인가        hookQ    걸 종방향 {x,y,dia}
              hookEnd  코너가 p2 쪽이면 +1         hookSide 법선의 부호
              bendR    중심선 곡률반경             link     연결 조각인가           */
        hookTarget: function (seg) {
            return seg.link ? (seg.bendR || 0) : this.lreNeed(seg.hookQ, seg.dia);
        },

        /*  `alt` 면 **둘째 알**을 본다 — ∩ 의 다리는 위·아래 둘을 문다
            (hookRows 의 「다리가 무는 알이 둘이다」 주석).                      */
        hookGeom: function (pose, seg, alt) {
            const half = seg.len / 2, q = alt ? seg.hookQ2 : seg.hookQ;
            const ux = Math.cos(pose.th), uy = Math.sin(pose.th);
            const nu = (alt ? seg.hookSide2 : seg.hookSide) || 1;
            const nx = nu * -uy, ny = nu * ux;                 // n̂ = ν·u⊥
            const vx = q.x - pose.cx, vy = q.y - pose.cy;
            const h = vx * nx + vy * ny;                       // 중심선까지의 수직거리
            const a = vx * ux + vy * uy;                       // 축방향 (야코비에만 쓴다)
            return { h: h, a: a, half: half, ux: ux, uy: uy, nx: nx, ny: ny,
                     nu: nu, target: alt ? this.lreNeed(q, seg.dia) : this.hookTarget(seg) };
        },

        /*  ── 축방향은 «꼭 접선점» 이 아니다. **띠 안의 어디든** 이다 ──────────────
            위의 유도는 「다리까지 need · 몸통까지 R」 두 수직거리로 자리를 **하나로**
            못박는다. 그런데 실제로 철근을 넣을 때 보는 것은 그것이 아니다 :
              ㉠ 양쪽 **끝이 피복 안**에 들어가나
              ㉡ **덕트**를 비켜 가나
              ㉢ 그러고 나서 거기 있는 **종방향에 결속**한다
            이고, 결속점이 절곡이 끝나는 바로 그 점일 **이유가 없다.** 곧은 구간
            어디서 묶어도 ㄷ 는 제 일을 한다.

            그래서 몸통의 ⑤ 를 **못박기에서 띠로** 바꾼다. 몸통의 수직거리 h 가 곧
            「코너에서 종방향까지의 축방향 거리」이므로(코너는 몸통의 선 위에 있다),
            세 가지가 전부 **h 하나의 상·하한**으로 떨어진다 :

                h ≥ R                절곡 아크 안은 자리가 아니다          (K_BAR)
                h ≤ ℓ                종방향이 다리를 벗어나면 못 건다      (K_BAR)
                h ≥ ℓ − t⁺ , h ≤ t⁻  양쪽 끝이 피복 안                     (K_COV)

            `t⁺` 는 바에서 **자유단 쪽**으로, `t⁻` 는 **코너 쪽**으로 막아서는 면의
            피복선까지 갈 수 있는 거리다 (`reachAhead`). S14 에서 재면 다리가 150 인데
            막아서는 면은 730~11,500 mm 밖이라 **피복 한계는 걸리지 않는다** — 띠는
            [R, ℓ] = [32.5, 150], 폭 118 mm 다. 「끝은 피복 안」이 이미 지켜져 있다는
            뜻이고, 그래서 이 항은 **식에는 있고 S14 에서는 쉰다** (bench/jsre.js ⑦).

            ── 띠 «안» 에서는 무엇이 고르나 ───────────────────────────────────────
            폭 118 mm 가 평평하면 답이 **태어난 자리**로 정해진다 (K_ANCHOR 1e-6 은
            아무것도 못 잡는다). 그건 최적이 아니다. 띠 안의 선호는 하나뿐이다 —
            **정착은 길수록 좋다**, 곧 h 는 작을수록(R 에 가까울수록) 좋다. 도면이
            접선점에 그려 둔 이유가 그것이다.

            그런데 그 선호를 2차로 주면 **덕트를 이긴다.** 이 저장소가 이미 두 번
            겪은 그 병이다 (K_CLR 주석 · K_COV 주석) : 덕트 배리어는 감쇠해서
            √K_CLR·CLR_SOFT 에서 멈추는데 2차 선호는 끝없이 자란다.
                접선점 선호(2차 · 무게 1)   h − R = 140 → 19,600
                덕트 배리어(감쇠 · K_CLR)                →  3,450   ← 5.7 배로 진다
            **지켜야 하는 것이 좋으면 좋은 것에 져서는 안 된다.** 그래서 선호도 같은
            감쇠꼴로 둔다 — 무게는 인력과 같은 1, 무르기는 같은 CLR_SOFT 다 :
                r = (h − R) / √(1 + ((h−R)/CLR_SOFT)²)        포화 r² = 900
            덕트의 포화는 K_CLR·CLR_SOFT² = 3,600 이다. 비가 정확히 K_CLR = 4 —
            **덕트가 넷, 접선점이 하나.** 새 상수를 만들지 않았고, 두 항의 서열이
            CONF 의 두 수에서 그대로 나온다. 작은 어긋남(≲ CLR_SOFT)에서는 예전과
            똑같이 2차라, **덕트가 없는 ㄷ 는 그대로 접선점에 앉는다.**

            다리(자유단)는 안 건드린다 — 「종방향에 결속한다」는 ㉢ 이 그 항이고,
            닿는 것은 띠가 아니라 요구다 (수직거리 = need, 양쪽 우물).             */
        /*  바에서 d 방향으로 나아갈 때 **막아서는 면**의 피복선까지 (mm).
            막는 면이 없으면 null. need = 피복 + 지름/2 로 원본 벽에서 재는 것이
            ①(slack) 과 같다. 맞는 자리가 그 벽 **토막 안**이어야 한다 — 박스 단면은
            볼록이 아니라 무한 직선으로 보면 건너편 면이 걸린다(seats ② 와 같은 이유).
            (바에서 쏜다. 다리의 중심선은 바에서 need 만큼 옆으로 비켜 있지만,
             막아서는 면은 다리와 거의 수직이라 그 비낌은 거리에 거의 안 든다.)    */
        reachAhead: function (p, d, walls, sec, dia) {
            let best = null;
            (walls || []).forEach(w => {
                const dn = d.x * w.nx + d.y * w.ny;
                if (dn > -0.3) return;                           // 막아서지 않는 면
                const s = (p.x - w.x1) * w.nx + (p.y - w.y1) * w.ny;
                if (s <= 0) return;                              // 이미 그 면 바깥
                const t = s / -dn;
                const hx = p.x + d.x * t, hy = p.y + d.y * t;
                const wx = w.x2 - w.x1, wy = w.y2 - w.y1, wl2 = wx * wx + wy * wy || 1;
                const u = ((hx - w.x1) * wx + (hy - w.y1) * wy) / wl2;
                if (u < -0.02 || u > 1.02) return;               // 그 면 토막을 벗어난다
                const tm = (s - (this.coverOf(w, sec) + dia / 2)) / -dn;
                if (best == null || tm < best) best = tm;
            });
            return best;
        },

        /*  몸통의 **띠**. `form` 이 재서 실어 보낸다 (hookBandOf). 안 실려 왔으면
            아래 한쪽만 — 「절곡 아크 안은 안 된다」는 기하라 언제나 참이다.       */
        hookBand: function (seg) {
            const R = seg.bendR || 0;
            return seg.band || { lo: R, hi: Infinity, wLo: this.CONF.K_BAR, wHi: 0, pref: R };
        },

        /*  띠를 잰다 — 다리 하나(자리를 고른 그 다리)와 벽으로 충분하다.
            `q` 걸 종방향 · `dir` 다리가 뻗는 쪽(코너 → 자유단) · `len` 다리 길이.    */
        hookBandOf: function (q, dir, len, R, walls, sec, dia, cap) {
            const K = this.CONF;
            /*  ── ∩ 는 «다리 끝» 에서 문다 ────────────────────────────────────
                ㄷ 의 다리는 철근을 **지나** `leg` 만큼 더 뻗는 정착이라, 무는 자리가
                절곡부 쪽이고 그 뒤로 길이가 남아야 했다 (`LEG_MIN`).
                ∩ 의 다리는 다르다 — **철근줄에서 철근줄까지**가 다리고, 먼 쪽
                철근을 **제 끝으로** 문다. 정착은 반대쪽 절곡(몸통)이 맡는다.
                그래서 띠의 위끝이 ℓ 이고, 선호도 거기다. 아래끝은 그대로 R —
                절곡 아크 안은 여전히 자리가 아니다.                             */
            if (cap) {
                /*  ∩ 도 **코너가 먼저 앉는다** — 선호는 ㄷ 와 같은 쪽(절곡 접선점)이다.
                    갈리는 것은 **위끝**이다 : ㄷ 는 철근을 지나 `leg` 가 남아야 해서
                    ℓ−6dᵇ 인데, ∩ 는 다리 끝이 반대쪽 절곡(몸통)으로 정착하므로 끝까지
                    갈 수 있다 (ℓ). 아래끝과 피복 두 항은 ㄷ 와 **같은 식**이다.     */
                /*  ── 아래끝이 ㄷ 와 다르다 : **R 이 아니라 need** ──────────────
                    ㄷ 의 다리는 철근을 **지나** 뻗으므로 철근이 직선 구간에 있고,
                    「절곡 아크 안은 자리가 아니다」(h ≥ R)가 맞는 말이었다.
                    ∩ 의 코너는 그 철근을 **품는다** — 스터럽 코너 안이 종방향이
                    들어앉는 바로 그 자리다. h ≥ R 로 막으면 몸통이 철근보다 R 만큼
                    더 바깥으로 밀려 **상면 피복을 31 mm 깬다** (재서 확인했다).
                    품을 수 있는 가장 가까운 자리는 몸통에 **맞닿는** 곳이다 :
                        h ≥ need = (dᵖ + dᵇ)/2 + 순간격
                    `need` 와 `R` 사이는 아크 안이다 — 거기가 정상인 것이 스터럽
                    코너이고, 그 「선호로 돌려주기」는 STATUS 「아직 안 한 것」이다. */
                /*  ── 아래끝은 **R** 이다 — 손으로 푼 기하가 아니라 두 항의 교집합 ──
                    「종방향이 ∩ 몸통의 **절곡부 시작부분**에 매치되는 것이 가장 J 값이
                     작을 것 같은데?」 — 맞다. 한때 `need`(알이 몸통 직선에 닿는 자리)로,
                    다음엔 「아크에 품긴 자리」 19.77 로 두었는데 **둘 다 틀렸다.**
                    19.77 은 «알이 아크에만 닿는다» 의 답이라, 그때 알은 다리에서
                    옆으로도 19.77 이어서 **다리의 갈고리 요구(= need)를 5.27 mm 어긴다.**
                    엔진이 거는 요구 둘을 **같이** 세워야 한다. 코너 좌표계 (h, l) 에서
                    아크중심은 (R, R) 이고 :
                        ① 다리가 문다          l = need
                        ② 아크 안을 안 깬다     |q − c| ≤ R − dˢ/2 − dᵖ/2 = R − need
                        ⇒ (h − R)² + (need − R)² ≤ (R − need)²  ⇒  (h−R)² ≤ 0  ⇒  **h = R**
                    그래서 ∩ 의 아래끝은 ㄷ 와 **같은 R** 이다 — 특례가 하나 줄었다.
                    그리고 R 은 내가 고른 수가 아니라 `bendRadius(dia)` 다.
                    ②를 **항으로** 넣은 것이 아래 `arcRows` 다 — 그래야 「h = R」이
                    적어 넣은 값이 아니라 **J 가 찾는 자리**가 된다.               */
                let clo = R, cwLo = K.K_BAR, chi = len, cwHi = K.K_BAR;
                const ctf = this.reachAhead(q, dir, walls, sec, dia);
                const ctc = this.reachAhead(q, { x: -dir.x, y: -dir.y }, walls, sec, dia);
                if (ctf != null && len - ctf > clo) { clo = len - ctf; cwLo = K.K_COV; }
                if (ctc != null && ctc < chi) { chi = ctc; cwHi = K.K_COV; }
                const cshut = chi < clo;
                return { lo: clo, hi: cshut ? clo : chi, wLo: cwLo, wHi: cwHi,
                         pref: clo, shut: cshut, tf: ctf, tc: ctc, len: len };
            }
            /*  위끝은 「다리 위에 있다」(h ≤ ℓ)가 아니라 **「정착이 남는다」**다 —
                끝에서 물면 뒤에 아무것도 안 남는다 (CONF.LEG_MIN 주석).         */
            let lo = R, wLo = K.K_BAR, hi = len - K.LEG_MIN * dia, wHi = K.K_COV;
            const tf = this.reachAhead(q, dir, walls, sec, dia);
            const tc = this.reachAhead(q, { x: -dir.x, y: -dir.y }, walls, sec, dia);
            if (tf != null && len - tf > lo) { lo = len - tf; wLo = K.K_COV; }   // 자유단이 밖으로
            if (tc != null && tc < hi) { hi = tc; wHi = K.K_COV; }               // 코너가 밖으로
            //  띠가 닫히면 «그 자리엔 넣을 수 없다» 가 맞는 말이다 — 아래끝에 못박고 알린다
            const shut = hi < lo;
            if (shut) hi = lo;
            return { lo: lo, hi: hi, wLo: wLo, wHi: wHi,
                     pref: Math.min(Math.max(R, lo), hi), shut: shut,
                     tf: tf, tc: tc, len: len };
        },

        /*  잔차와 야코비. 변수는 (cx, cy, φ = th·half) — 전부 mm.
              h = (q − c)·n̂      ∂h/∂c = −n̂      ∂h/∂th = −ν·(q − c)·û = −ν·a
            잔차가 h 의 함수 f 면 ∂r/∂x = f′(h)·∂h/∂x 다 — 줄을 몇 개 쌓아도 같다.  */
        /*  ── **절곡 아크의 순간격** — 「절곡부 안은 자리가 아니다」를 항으로 ──────
            여태 아크는 J 에 **없었다** (`hookTarget` : 「직선에는 닿고 아크에는 안
            들어간다」). 그래서 알이 절곡부 안으로 들어가도 아무도 안 밀었고, 나는
            그 자리를 **손으로 풀어 적어 넣으려** 했다. 그건 이 논문이 치우려는 바로
            그 짓이다 — 자리는 **장이 찾아야** 한다.
            아크는 반지름 R 의 강재다. 알과의 순간격은 두 원의 그것이고, 식도 저장소가
            이미 쓰는 꼴(순간격 ≥ need)이다 :
                c    아크중심 — 코너에서 다리축·법선으로 각각 R
                g    = (R − need) − |q − c|        (알은 아크 **안**이다)
                J   += K_BAR · g²   (g < 0 일 때만 — 깨는 쪽만 민다)
            다리가 알을 물고 있으면(l = need) 이 항은 **h = R 에서만 0** 이다.
            곧 「절곡부 시작부분」이 **적어 넣은 값이 아니라 J 의 바닥**이 된다.
            변수는 몸통의 h 하나다 :  ∂g/∂h = −(h − R)/|q − c|.                  */
        arcRows: function (pose, seg, g, out) {
            if (!seg.cap || !seg.link || !seg.hookQ) return out;
            const R = seg.bendR || 0, need = this.lreNeed(seg.hookQ, seg.dia);
            if (!(R > need)) return out;
            const dh = g.h - R, dl = need - R;
            const d = Math.sqrt(dh * dh + dl * dl) || 1e-9;
            const gap = (R - need) - d;
            if (gap >= 0) return out;                       // 아크 밖 — 아무 말 없다
            const w = Math.sqrt(this.CONF.K_BAR);
            const s = w * (dh / d);                         // ∂(w·gap)/∂h = −w·dh/d
            const half = Math.max(g.half, 1);
            out.push({ r: w * gap, j: [-s * g.nx, -s * g.ny, -s * g.nu * g.a / half] });
            return out;
        },

        arcEnergy: function (pose, seg, g) {
            if (!seg.cap || !seg.link || !seg.hookQ) return 0;
            const R = seg.bendR || 0, need = this.lreNeed(seg.hookQ, seg.dia);
            if (!(R > need)) return 0;
            const dh = g.h - R, dl = need - R;
            const gap = (R - need) - Math.sqrt(dh * dh + dl * dl);
            return gap < 0 ? this.CONF.K_BAR * gap * gap : 0;
        },

        hookRows: function (pose, seg) {
            const K = this.CONF, g = this.hookGeom(pose, seg), half = Math.max(g.half, 1);
            const mk = (r, s) => ({ r: r, j: [-s * g.nx, -s * g.ny, -s * g.nu * g.a / half] });
            if (!seg.link) {                       // 다리 — 종방향에 **닿는다** (요구)
                /*  ── ∩ 의 다리는 **알을 둘** 문다 ─────────────────────────────
                    「몸통과 맞닿는 수직철근 부분을 먼저 종방향을 감싸는 위치로
                     정착한다 … 수직철근의 마지막 부분을 슬래브 하단 피복까지 내리고,
                     그 위치에서 가장 가까운 종방향으로 철근을 위치한다 … 이렇게 되면
                     90 도를 유지할 필요가 없다」
                    위 알 하나만 물면 다리의 **각이 안 정해진다** — 그래서 태어난
                    각(연직)이 그대로 남았다. 아래 알을 하나 더 물리면 두 요구가
                    각을 정한다 : 다리는 **두 알을 잇는 선과 나란**해지고, 90° 는
                    처음 활성화 때의 출발값일 뿐이 된다.
                    줄은 같은 꼴이다 — 수직거리가 need 가 되라는 양쪽 우물.
                    (갈고리 안쪽이 모자란 쪽만 K_BAR 로 세게 미는 것도 그대로다.)  */
                const out1 = [];
                const gh = g.h - g.target;
                const w = Math.sqrt(gh < 0 ? K.K_BAR : 1);
                out1.push(mk(w * gh, w));
                if (seg.hookQ2) {
                    const g2 = this.hookGeom(pose, seg, true);
                    const mk2 = (r, s2) => ({ r: r,
                        j: [-s2 * g2.nx, -s2 * g2.ny, -s2 * g2.nu * g2.a / half] });
                    const gh2 = g2.h - g2.target;
                    const w2 = Math.sqrt(gh2 < 0 ? K.K_BAR : 1);
                    out1.push(mk2(w2 * gh2, w2));
                }
                return out1;
            }
            const b = this.hookBand(seg), out = [];
            if (g.h < b.lo) { const w = Math.sqrt(b.wLo); out.push(mk(w * (g.h - b.lo), w)); }
            else if (g.h > b.hi && b.wHi > 0) {
                const w = Math.sqrt(b.wHi); out.push(mk(w * (g.h - b.hi), w));
            }
            const e = this.clrRes(g.h - b.pref, 1);        // 접선점 선호 — 감쇠 · 무게 1
            out.push(mk(e.r, e.s));
            this.arcRows(pose, seg, g, out);               // 절곡 아크의 순간격
            return out;
        },

        hookEnergy: function (pose, seg) {
            const K = this.CONF, g = this.hookGeom(pose, seg);
            if (!seg.link) {
                const gh = g.h - g.target;
                let J0 = (gh < 0 ? K.K_BAR : 1) * gh * gh;
                if (seg.hookQ2) {                      // 아래 알 (hookRows 주석)
                    const g2 = this.hookGeom(pose, seg, true), gh2 = g2.h - g2.target;
                    J0 += (gh2 < 0 ? K.K_BAR : 1) * gh2 * gh2;
                }
                return J0;
            }
            const b = this.hookBand(seg);
            let J = 0;
            if (g.h < b.lo) J += b.wLo * (g.h - b.lo) * (g.h - b.lo);
            else if (g.h > b.hi && b.wHi > 0) J += b.wHi * (g.h - b.hi) * (g.h - b.hi);
            const e = this.clrRes(g.h - b.pref, 1);
            return J + e.r * e.r + this.arcEnergy(pose, seg, g);   // 절곡 아크 순간격
        },

        /*  ── ⑥ 갈고리 다리가 콘크리트 면과 «평행» 해지는 항 ────────────────────
            ⑤ 로 다리의 **자리**(종방향까지의 수직거리)는 정해졌다. 그런데 자세가
            안 정해진다 — 점 하나에서 거리 need 인 직선은 무한히 많다. 그래서
            한동안 각을 init 에 **묶어** 두었다(`descend` 의 lim = 0). 그 대가가
            이것이다 : 데크 상면은 −3% 로 기울어 있는데 다리는 수평인 채로 선다.
            S14 에서 재면 **다리 양 끝의 피복이 12 mm 달라지고**, 한쪽 끝은 피복선
            밖으로 6~11 mm 나간다. 헌치(E23, 12°) 쪽은 83 mm 다.

            ── 평행은 «새 규칙»이 아니다. 같은 피복장의 2차 모멘트다 ──────────────
            곧은 조각이 평면 벽 가까이 있을 때, 축좌표 s 인 점의 피복 여유는
                g(s) = g₀ + s·m ,    g₀ = (c−p)·n̂ − need ,   m = û·n̂
            두 끝점에서 재면 (엔진이 ① 에서 하는 그것) :
                g(+half)² + g(−half)² = 2·g₀²  +  2·half²·m²
            **거리의 0차항 + 기울기의 m² 항**이고, m² 항의 최소는 m = 0 — 평행이다.
            곧 ① 안에 평행이 이미 들어 있었다. 갈고리는 `cons = []` 로 **그 항을
            잃은 것**이지, 평행이라는 규칙이 따로 없던 것이 아니다.

            ── 무게는 고르는 값이 아니다. 유도로 1 + K_COV 다 ──────────────────
            다리를 기울이면 한쪽 끝은 피복선 **안**으로, 다른 쪽 끝은 **반드시
            밖으로** 나간다 (g₀ 를 ⑤ 가 가져갔으므로 g(±half) = ±half·m 이다).
            안쪽은 무게 1, 밖은 K_COV 다. 그래서
                J = 1·(half·m)² + K_COV·(half·m)² = (1 + K_COV)·half²·m²
            상태에 안 딸린 상수다. **평행은 「피복을 깨지 않는 유일한 자세」**이고,
            그 벌점은 피복 위반의 벌점 그대로다. 새 K 를 만들지 않는다.

            ── 0차는 철근이, 2차는 콘크리트가 ────────────────────────────────
            ① 을 통째로 주면 안 된다. 그러면 벽이 다리를 **피복선으로 끌어당겨**
            ⑤ 와 다툰다 — 다리의 자리는 종방향이 정하고 콘크리트 피복은 **결과**다
            (hookGeom 주석). 그래서 0차항(거리)은 ⑤ 가 갖고 여기는 2차항만 쓴다.
            야코비가 각 성분 하나뿐(∂r/∂c = 0)이므로 **자리를 흔들 수가 없다** :
                r = √(1+K_COV) · half · m ,   ∂r/∂φ = √(1+K_COV) · (û⊥·n̂)
            자유도 셋이 이렇게 갈린다 — ⑤ 가 수직거리, ⑥ 가 각, 코너가 축방향.

            ── 어느 면인가 : «앉은 뒤에» 찾는다 ────────────────────────────────
            걸 종방향을 찾을 때는 콘크리트를 안 본다(⑤). 앉은 **뒤에** 그 자리에서
            `seats()` 를 돌려 가장 가까운 면을 고른다 — 보통 조각과 같은 규칙
            (법선이 마주보고 · 콘크리트 쪽이고 · 띠 안이고, 그 중 가장 가까운 것).
            S14 에서 그 참거리가 1~11 mm 다. **자리는 이미 맞았고 각만 틀렸다**는
            뜻이고, 그래서 ⑥ 는 각만 고친다.
            면이 바뀌면 다시 내려간다 (`alternate` 와 같은 교대최소화). 헌치 근처
            에서는 E23(6 mm)과 E24(30 mm)가 10° 차이로 나란히 있어 몇 mm 움직임에
            고른 면이 뒤집힐 수 있다 — 되돌아오면 거기서 멈추고 보고한다.         */
        parSetup: function (seg, walls, sec, pose) {
            const half = seg.len / 2;
            const dx = Math.cos(pose.th) * half, dy = Math.sin(pose.th) * half;
            const p1 = { x: pose.cx - dx, y: pose.cy - dy };
            const p2 = { x: pose.cx + dx, y: pose.cy + dy };
            //  `seats()` 는 init 기하(p1·p2·mid)를 본다. **앉은 자세**로 갈아 준다.
            const at = { len: seg.len, dia: seg.dia, n0: seg.n0, link: seg.link,
                         p1: p1, p2: p2, mid: { x: pose.cx, y: pose.cy } };
            const cands = this.seats(at, walls, sec, seg.dia).filter(c => c.used);
            let best = null;
            cands.forEach(c => { if (!best || c.d < best.d) best = c; });
            seg.parW = best ? best.w : null;
            seg.parD = best ? best.d : null;
            return seg.parW;
        },

        //  m = û·n̂ (0 이면 평행) 과 ∂m/∂th = û⊥·n̂
        parGeom: function (pose, seg) {
            const w = seg.parW;
            const ux = Math.cos(pose.th), uy = Math.sin(pose.th);
            return { m: ux * w.nx + uy * w.ny, dm: -uy * w.nx + ux * w.ny,
                     half: Math.max(seg.len / 2, 1) };
        },

        parRows: function (pose, seg) {
            const g = this.parGeom(pose, seg);
            const k = Math.sqrt(1 + this.CONF.K_COV);          // 유도값 — 주석 참조
            return [{ r: k * g.half * g.m, j: [0, 0, k * g.dm] }];
        },

        parEnergy: function (pose, seg) {
            const g = this.parGeom(pose, seg);
            return (1 + this.CONF.K_COV) * g.half * g.half * g.m * g.m;
        },

        /*  ── 같은 단면에 있는 철근인가 (z) ────────────────────────────────────
            **횡방향끼리만 z 를 본다.** 물리가 셋으로 갈린다 :
              횡방향 ↔ 횡방향   둘 다 단면 평면에 **눕는다**  → 같은 z 에서만 만난다
              횡방향 ↔ 종방향   종방향은 모든 단면을 **뚫는다** → 언제나 만난다
              종방향 ↔ 종방향   둘 다 축방향                   → 언제나 만난다
            그래서 `placed`(횡방향 조각)에만 걸고, `lpts`(종방향 점)에는 안 건다.
            도면이 그렇게 그린다 — 8-243 단면에서 ㄷ(T1)는 **점선**이다. 이 단면에
            없다는 뜻이고, ① 횡방향과 같은 깊이에 보여도 서로 부딪히지 않는다.
            (z 는 예전 엔진 `_relaxRebar` 만 보고 있었고 `jfield` 는 몰랐다.)      */
        sameZ: function (a, b) {
            return (a.z || 0) === (b.z || 0);
        },

        //  중심선 곡률반경 (페이지의 bendRadiusForDia 와 같은 규칙). bar.bendR 이 이긴다.
        bendRadius: function (dia) {
            const inside = (dia <= 16) ? 2 * dia : 3.5 * dia;
            return inside + dia / 2;
        },

        /*  ── 갈고리가 **걸 종방향 하나**를 고른다 ──────────────────────────────
            벽은 안 본다. 고르는 자리가 둘로 갈린다 :

            ── 자유단(다리) : «절곡부에 가장 가까운» 철근이다 ───────────────────
            한때 「조각까지 가장 가까운 것」(segToPoint)으로 골랐다. **다리에서는
            그 거리가 못 가른다** — 다리는 부재 면을 따라 눕고 종방향 줄도 같은 면에
            누우므로, 다리를 따라 늘어선 철근이 **전부 같은 수직거리**에 있다.
            그래서 사실상 아무거나 골랐고, 재 보니 물어야 할 자리에서 평균 66 mm ·
            최악 282 mm 어긋나 있었다 (|s|<5 인 다리가 194 중 76).
            갈고리가 무는 자리는 **절곡부**다 — 다리는 그 철근을 지나 `leg` 만큼 더
            뻗는 정착이다. 그러니 **코너에 가장 가까운 철근**이 그 철근이다.

            ── 연결 조각(몸통) : «이웃한 다리가 문 그 철근» 이다 ─────────────────
            몸통은 다리에 수직이라, 몸통의 수직거리는 곧 **다리의 축방향 좌표**다.
            목표를 R 로 두면 코너가 그 철근의 접선점에 선다 (hookGeom 주석).
            그런데 몸통이 **제 나름대로 가장 가까운 철근**을 고르면 다리가 문 것과
            다른 철근이 되어, 두 제약이 서로 다른 자리를 가리킨다. 그것이 위의
            66 mm 다. **한 ㄷ 는 «한 자리» 를 문다** — 몸통은 다리의 선택을 따른다.

            ── 둘째 다리 : 첫째 철근의 «짝» 이다 ───────────────────────────────
            같은 까닭으로 둘째 다리도 제 나름대로 고르면 안 된다. ㄷ 가 무는 것은
            **한 무리의 한 짝**이다 — `gap` 을 준 종방향 무리는 한 자리(`t`)에 상·하
            두 알이 서고, 그 둘이 같은 자리에 서도록 `jlong` 에 `K_TIE` 를 넣어 둔
            것이 바로 이것 때문이다(「나중에 ㄷ자 갈고리 하나가 두 다리를 같이
            붙잡으므로 같은 자리에 서야 한다」).
            그래서 둘째 다리는 **같은 무리(`g`) · 같은 자리(`t`)** 의 다른 알을 쓴다.
            짝이 없으면 **그 자리엔 ㄷ 가 없다** — 버린다.
            이게 없으면 갈고리가 **다른 무리**의 철근을 문다. 복부 위에서 실제로
            그랬다 : 상부슬래브 ㄷ 의 아래 다리가 슬래브 아랫줄(거기선 끊긴다) 대신
            **D2 복부철근**을 물어, 몸통이 603 mm 로 늘어나 슬래브와 복부 이음부를
            가로지르고 복부 스터럽과 겹쳤다. 거기엔 슬래브 ㄷ 가 설 짝이 없다.
            (`g`·`t` 를 안 실어 보내면 — 벤치처럼 — **자리 어긋남**이 가장 작은 것을
             고르는 옛 규칙으로 돌아간다.)

            ── 법선의 부호(ν) ──────────────────────────────────────────────────
            다리는 **그 철근을 향하는 쪽**이다 (어느 면에 안기느냐의 문제다).
            몸통은 다르다 — **다리가 뻗어 나가는 쪽**이어야 한다. 부호를 철근에서
            가져오면 「몸통에서 R 떨어진 곳」이 **ㄷ 바깥쪽**이 될 수 있고, 그러면
            갈고리가 제 밖에 있는 철근을 무는 꼴이 된다 (실제로 그랬다 : 철근이
            코너 **너머** 32.5 에 서서 다리는 반대 방향으로 뻗었다). 다리 쪽으로
            고정해 두면 h < 0 이 「철근이 아직 ㄷ 밖이다」가 되어, 무거운 쪽
            가중치가 ㄷ 를 **철근을 품는 자리로 끌어온다.**                        */
        /*  ── 걸 철근은 «가장 가까운 것» 이 아니라 **J 가 고른다** ──────────────
            코너에 가장 가까운 철근을 고르면, 그 자리에 **덕트가 있어도** 거기로 간다.
            실제로 ㄷ 조각 13 개가 덕트를 가로질렀다 (최악 −140.5 — T1#18 의 몸통이
            TC1R 한가운데를 지났다). 덕트가 못 밀어낸 것이 아니다 :
              ⑤(자리) 잔차  h−R = 140 · 무게 1          → 19,600
              덕트 배리어   √4·140/√(1+(140/30)²) = 58.7 → 3,450   ← 포화해서 진다
            **덕트는 못 지키는 위반이 흔해서 일부러 무르게 둔 항**이다(K_CLR 4).
            그러니 무게 싸움으로 풀 일이 아니다 — ㄷ 는 **옆 철근으로 옮겨 가면**
            그만이고, 그것은 연속 자유도가 아니라 **배정**의 문제다.
            이 저장소는 그것을 이미 교대최소화로 푼다(`alternate`). 같은 방식으로,
            닿을 수 있는 철근 몇을 놓고 **ㄷ 를 그 자리로 옮겨 본 뒤 덕트 위반이
            가장 작은 것**을 고른다. 같으면 코너에 가까운 쪽이다.
            (옮기는 양은 기하가 준다 : 그 철근이 **접선점**에 오도록 축방향으로
             a − R 만큼. ㄷ 는 강체라 세 조각이 같이 간다.)                       */
        hookPick: function (segs, lpts, ducts) {
            const ends = segs.filter(s => !s.link), e0 = ends[0];
            if (!e0) return null;
            const corner = (e0.hookEnd === 1) ? e0.p2 : e0.p1;
            const free = (e0.hookEnd === 1) ? e0.p1 : e0.p2;
            const dx0 = free.x - corner.x, dy0 = free.y - corner.y;
            const L = hyp(dx0, dy0) || 1, ux = dx0 / L, uy = dy0 / L;
            const R = e0.bendR || 0;
            /*  고를 수 있는 범위는 **제 칸**이다 — `hookSpan`(= ctc/2). 그보다 멀면
                옆 ㄷ 의 자리이고, 둘이 같은 철근을 물면 서로 겹친다(전에 그랬다).
                **안 주면 고르지 않는다.** 한때 다리 길이(400)로 대신했는데, 그건
                제 칸이 아니라 «팔 길이» 다 — 옆자리까지 다 들어와, 덕트가 없는
                벤치에서도 ㄷ 가 250 mm 떨어진 철근으로 건너갔다(s 252.0 / −265.1).
                칸을 모르면 돌아다닐 자격이 없다 — 옛 규칙(코너 최근접)에 맡긴다.  */
            const span = e0.hookSpan;
            if (!(span > 0)) return null;
            const cand = (lpts || [])
                .map(q => ({ q: q, d: hyp(q.x - corner.x, q.y - corner.y) }))
                .filter(o => o.d <= span).sort((a, b) => a.d - b.d).slice(0, 8);
            if (!cand.length) return null;
            let best = null;
            cand.forEach(o => {
                const a = (o.q.x - corner.x) * ux + (o.q.y - corner.y) * uy;
                const mx = (a - R) * ux, my = (a - R) * uy;     // ㄷ 를 이만큼 옮기면 접선점
                let viol = 0;
                segs.forEach(s => {
                    const p1 = { x: s.p1.x + mx, y: s.p1.y + my };
                    const p2 = { x: s.p2.x + mx, y: s.p2.y + my };
                    (ducts || []).forEach(d => {
                        const need = (d.D / 2) + (d.clr != null ? d.clr : 30) + s.dia / 2;
                        const g = this.segToPoint([p1, p2], d) - need;
                        if (g < 0) viol += g * g;
                    });
                });
                if (!best || viol < best.viol - 1 ||
                    (Math.abs(viol - best.viol) <= 1 && o.d < best.d)) best = { q: o.q, viol: viol, d: o.d };
            });
            return best && best.q;
        },

        hookSetup: function (seg, lpts, inherit) {
            let q = null;
            if (inherit && inherit.use) q = inherit.q;      // 이미 고른 것 (hookPick)
            else if (inherit && inherit.body) q = inherit.q;   // 몸통 — 다리가 고른 것 그대로
            else {
                /*  **닿을 수 있는 것만 후보다.** 다리는 그 철근을 지나 `leg` 만큼 더
                    뻗는 정착이므로, 물 수 있는 철근은 코너에서 **다리 길이 안**에
                    있는 것뿐이다. 문턱이 아니라 **다리 자신의 길이**다.
                    이게 없으면 자리에 철근이 없는 ㄷ 가 멀리 있는 철근까지 끌려가
                    이웃 ㄷ 와 같은 철근을 문다 (복부 바닥에서 실제로 그랬다 — 바깥줄
                    종방향이 −5,645 에서 끝나는데 −5,800 자리의 ㄷ 가 거기까지 올라와
                    옆 ㄷ 와 13 mm 겹쳤다). 없으면 **그 자리엔 갈고리가 없다.**      */
                /*  **재는 자리는 «몸통과 만나는 끝» 이다 — ㄷ 도 ∩ 도 같다.**
                    철근을 먼저 잡아 주는 것은 절곡부다 : 몸통과 다리가 만나는 그
                    코너가 종방향에 걸려 앉고, 다리는 거기서부터 뻗는다. ∩ 를 한때
                    **자유단**에서 재게 해 두었는데(아래 ①), 그건 「끝이 아래 줄에
                    닿는 그림」을 맞추려던 것이지 안착의 기준이 아니었다. 기준이
                    없으니 후보가 「끝에서 가까운 아무 알」이 되고, 몸통이 기울어
                    두 다리가 같은 줄에 **같이** 닿을 수 없는 자리에서 한쪽이
                    허공에 떴다 (재면 7 개 · 최악 81 mm).                         */
                const c = (seg.hookEnd === 1) ? seg.p2 : seg.p1;
                /*  ── ∩ 는 **제 칸 안에서** 고른다 ───────────────────────────────
                    ㄷ 의 다리는 철근을 지나 뻗는 정착이라 「닿을 수 있는 것」이 곧
                    다리 길이였다. ∩ 의 다리는 두께를 가로지르므로 그 길이가
                    **옆으로 돌아다닐 자격**과 아무 상관이 없다 — 660 mm 짜리 다리가
                    660 mm 떨어진 알까지 후보로 보면 이웃 ∩ 의 자리를 통째로 덮는다.
                    ∩ 의 칸은 ㄷ 와 같은 것이다 : **간격의 절반**(`hookSpan` = ctc/2,
                    `hookPick` 주석). 「그룹으로 넣는 철근은 ctc 를 지켜야 한다」가
                    여기서 지켜진다 — 새 칸을 안 만들고 이미 적은 `ctc` 를 쓴다.     */
                const reachRaw = seg.len || hyp(seg.p2.x - seg.p1.x, seg.p2.y - seg.p1.y);
                const reach = (seg.cap && seg.hookSpan > 0)
                              ? Math.min(reachRaw, seg.hookSpan) : reachRaw;
                const a = inherit && inherit.axis, q0 = inherit && inherit.q;
                //  짝을 알아볼 수 있나 — 무리(g)와 자리(t)가 실려 왔을 때만
                const pair = !!(q0 && q0.g != null && q0.t != null) && !seg.cap;
                /*  ── ∩ 는 «짝» 의 뜻이 다르다 ──────────────────────────────────
                    ㄷ 는 두 다리가 **한 자리(t)의 상·하 두 알**을 문다 — 그래서 짝은
                    「같은 g · 같은 t」다. ∩ 는 두 다리가 **같은 줄의 다른 두 자리**를
                    문다 (몸통만큼 떨어져 있다). 그래서 짝은 「같은 g · **다른** t」이고,
                    그 중 **제 코너에 가장 가까운** 것이다.
                    이걸 안 가르면 ∩ 는 한 자리도 못 선다 — 실제로 14 개 중 13 개가
                    조용히 버려졌다 (같은 t 인 알이 없으니 후보가 0 이 된다).       */
                const capPair = !!(seg.cap && q0 && q0.g != null);
                let best = null;
                (lpts || []).forEach(p => {
                    if (q0 && p === q0) return;
                    //  **이미 다른 ∩ 가 감싼 알은 후보가 아니다** (solve 의 주석)
                    if (seg.cap && seg._claim && seg._claim.has(p)) return;
                    if (capPair && !(p.g === q0.g &&
                                     (p.t == null || q0.t == null || Math.abs(p.t - q0.t) > 1))) return;
                    if (pair && !(p.g === q0.g && p.t != null && Math.abs(p.t - q0.t) < 1)) return;
                    const d = hyp(p.x - c.x, p.y - c.y);
                    if (d > reach) return;                       // 다리가 못 닿는다
                    /*  ∩ 은 알을 **감싸므로** 안쪽 알만 후보다 (위 `_inSide` 주석) */
                    if (seg.cap && seg._inSide) {
                        const vx = seg.p2.x - seg.p1.x, vy = seg.p2.y - seg.p1.y;
                        const L3 = hyp(vx, vy) || 1;
                        const t3 = (p.x - seg.mid.x) * (-vy / L3) + (p.y - seg.mid.y) * (vx / L3);
                        if ((t3 >= 0 ? 1 : -1) !== seg._inSide) return;
                    }
                    //  짝을 모를 때만 — 첫째와 **같은 자리**가 먼저. 같으면 가까운 쪽.
                    const st = (a && !pair && !capPair) ? Math.abs((p.x - q0.x) * a.x + (p.y - q0.y) * a.y) : 0;
                    if (!best || st < best.st - 1 ||
                        (Math.abs(st - best.st) <= 1 && d < best.d)) best = { st: st, d: d, q: p };
                });
                q = best && best.q;
            }
            if (!q) { seg.hookQ = null; return null; }
            seg.hookQ = q;
            const vx = seg.p2.x - seg.p1.x, vy = seg.p2.y - seg.p1.y;
            const L = hyp(vx, vy) || 1, ux = vx / L, uy = vy / L;
            const t = (inherit && inherit.body)
                ? inherit.dir.x * (-uy) + inherit.dir.y * ux       // 몸통 — 다리가 뻗는 쪽
                : (q.x - seg.mid.x) * (-uy) + (q.y - seg.mid.y) * ux;   // 다리 — (q−c)·u⊥
            //  ∩ 은 **안쪽**으로 문다 — 위도 아래도 (위 `_inSide` 주석)
            seg.hookSide = (seg.cap && seg._inSide && !(inherit && inherit.body))
                           ? seg._inSide : ((t >= 0) ? 1 : -1);
            return q;
        },

        /*  횡방향 조각이 **종방향 철근**과 지켜야 할 중심거리.
            종방향은 단면에서 점이라 덕트와 같은 수학이지만 need 가 다르다 —
            덕트는 「외경/2 + 순간격」, 철근은 「지름 둘의 평균 + 순간격」이다.
            `clr` 을 안 주면 0 : 갈고리는 종방향에 **맞닿아** 걸리는 철근이다.      */
        lreNeed: function (q, dia) {
            return ((q.dia || 13) + dia) / 2 + (q.clr != null ? q.clr : 0);
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
              ② 조각이 그 면의 **콘크리트 쪽에 있다.** 철근은 콘크리트 안에 묻히므로
                 면의 바깥에서 그 면에 안길 수는 없다. 이것이 없으면 셀(빈 공간)
                 건너편 면이 후보가 된다 — 복부 철근의 다리가 위로 2.8 m 날아가
                 상부슬래브 하면에 「아래에서」 붙는 일이 실제로 났다.
                 박스 단면은 볼록(convex)이 아니라서 게이트만으로는 안 걸러진다.
              ③ 조각이 지나는 **띠** 안에 있다 — 옆으로 비켜난 면은 앉을 자리가
                 아니다. 띠는 **원본 벽**으로 잰다 (피복벽은 코너에서 늘어난다).

            ── 규칙에 예외를 두지 않는다 ────────────────────────────────────────
            한때 ③ 에 예외를 달았다. ⑧-1 의 다리 b 에 길이를 안 주면 기본값 400 mm 가
            되는데, 그러면 다리가 복부(두께 500 mm) 밑에서 끝나 하부슬래브 상면(E18)
            **위로 나오지 못한다** — 띠가 50 mm 모자란다. 그래서 참거리 72 mm 인 E18 이
            버려지고 5,714 mm 위의 데크 상면(E1)만 후보로 남는다. 그걸 막으려고
            「띠 밖이라도 가까우면 후보로 본다」를 넣었다가 뺐다. **그건 입력이 모자란
            것이지 규칙이 모자란 것이 아니다.** 400 mm 다리는 그 면에 닿을 수 없고,
            엔진이 닿은 척해 줄 일이 아니다 (닿으려면 최소 450 mm 가 필요하다).
            규칙은 규칙대로 두고, **모자란 입력은 보이게 한다** — `seats()` 가 버린
            면까지 거리와 함께 돌려주고, 화면과 `bench/jspawn.js` 가 그것을 읽는다.   */
        targets: function (seg, walls, sec, dia) {
            return this.seats(seg, walls, sec, dia).filter(c => c.used);
        },

        /*  `targets()` 의 **판정 과정을 남긴 판**. ①② 를 지난 면을 걸러낸 것까지
            다 돌려준다 :
              { w, need, d, band, gap, used }
              d     피복면(유한한 토막)까지의 **참거리** (mm)
              band  조각의 축 범위 안에 그 면이 있나 (조각이 그 면 **위에** 있나) = ③
              gap   띠가 모자란 거리 (mm). 0 이면 면 위에 있다
              used  후보로 살아남았나 (= band. targets() 가 이 줄만 가져간다)
            푸는 데 쓰는 것은 `used` 뿐이고, `d` 와 `gap` 은 **보여 주기 위한 것**이다.
            입력이 왜 그렇게 풀렸는지는 「무엇을 골랐나」가 아니라 「무엇이 있었고
            무엇을 왜 버렸나」에 있다 — **가장 가까운 면이 후보에 못 들어온 조각**이
            곧 입력이 모자란 조각이다(⑧-1 의 400 mm 다리 : E18 72 mm 가 띠 밖이라
            빠지고 E1 5,781 mm 가 쓰였다). 규칙을 두 군데 적지 않으려고 targets() 가
            이것을 불러 쓴다 (거리를 재는 방법이 둘이 되면 조용히 어긋난다).       */
        seats: function (seg, walls, sec, dia) {
            const n = seg.n0, all = [];
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
                const ov = Math.min(L, Math.max(a, b)) - Math.max(0, Math.min(a, b));
                /*  ④ **연결 조각(가운데)은 자리를 찾아 나서지 않는다** — CONF.RHO_LINK.
                    자유단에는 안 건다. 그 조각은 제 면에 닿는 것이 일이라 얼마가
                    걸리든 가야 한다 (⑥ 의 다리 3.2 m).                            */
                const far = !!seg.link && d > this.CONF.RHO_LINK;
                all.push({ w: w, need: need, d: d, band: ov > 0, far: far,
                           gap: ov > 0 ? 0 : -ov, used: ov > 0 && !far });
            });
            return all;
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
        energy: function (pose, seg, cons, ducts, placed, lpts, assign) {
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
                if (!this.sameZ(q, seg)) return;              // 다른 단면의 철근이다 (sameZ 주석)
                const need = (q.dia + seg.dia) / 2;
                this.clearPairs(pts, q.p1, q.p2).forEach(n => {
                    const g = n.d - need;
                    if (g < 0) { const e = this.clrRes(g, K.K_TRE); J += e.r * e.r; }
                });
            });

            /*  ④ 이미 놓인 **종방향 철근** — 단면에서 점이라 ② 와 같은 수학이다.
                이 항이 없으면 종방향은 횡방향을 피해 가는데(jlong 의 `tre` 배리어)
                횡방향은 종방향을 못 본다 — **한 접촉이 한쪽에서만 작동**했다.
                갈고리(ㄷ)가 종방향에 걸려 서려면 이쪽 방향이 있어야 한다.          */
            (lpts || []).forEach(q => {
                if (q === seg.hookQ) return;          // 제 자리는 ⑤ 가 맡는다 (이중 계산 금지)
                const g = this.segToPoint(pts, q) - this.lreNeed(q, seg.dia);
                if (g < 0) { const e = this.clrRes(g, K.K_BAR); J += e.r * e.r; }
            });

            //  ⑤ 갈고리 다리 — 자리가 종방향 철근이다 (hookGeom 주석)
            if (seg.hook && seg.hookQ) J += this.hookEnergy(pose, seg);
            //  ⑥ 갈고리 다리의 자세 — 콘크리트 면과 평행 (parSetup 주석)
            if (seg.hook && seg.parW) J += this.parEnergy(pose, seg);

            /*  ⓪ 제자리 고정항 — residuals() 의 그것과 같다 (설명은 거기에).
                갈고리 다리는 **축방향을 철근이 잡으므로** init 축 고정을 끈다 —
                둘이 같은 방향을 서로 다른 자리로 당기면 타협점에 선다.          */
            const ux = Math.cos(pose.th), uy = Math.sin(pose.th);
            const dcx = pose.cx - seg.c0.x, dcy = pose.cy - seg.c0.y;
            const ax = dcx * ux + dcy * uy;                  // 축방향 미끄러짐
            const pp = -dcx * uy + dcy * ux;                 // 면 쪽 이동
            const at = (pose.th - seg.th0) * half;
            J += (seg.hook ? 0 : K.K_AXIAL * ax * ax) + K.K_ANCHOR * (pp * pp + at * at);

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
        /*  `k` 를 주면 그 무게로 잰다 (안 주면 K_CLR). 종방향 철근과의 접촉만
            K_BAR 로 들어온다 — 이유는 CONF.K_BAR 주석에.                        */
        clrRes: function (g, k) {
            k = Math.sqrt(k != null ? k : this.CONF.K_CLR);
            const d = this.CONF.CLR_SOFT;
            const t = g / d, u = 1 + t * t;
            return { r: k * g / Math.sqrt(u), s: k / (u * Math.sqrt(u)) };
        },

        //  두 선분 사이의 최단거리. **clearPairs 와 같은 근거로 잰다** —
        //  거리를 재는 방법이 둘이 되면 조용히 어긋난다.
        segToSeg: function (pts, q1, q2) {
            return Math.min.apply(null, this.clearPairs(pts, q1, q2).map(n => n.d));
        },

        /*  (wrapTo 는 지웠다. 판을 거듭하며 앞 판의 각을 다음 판의 출발각으로
            넘길 때만 쓰던 것이다 — `Math.atan2` 가 ±180° 에서 부호를 뒤집는 탓에
            각 제한(th0 ± 30°)이 조각을 통째로 돌려 버리는 일이 있었다.
            판이 하나뿐이면 출발각은 언제나 th0 이라 감을 일이 없다.)             */

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
        residuals: function (pose, seg, cons, ducts, placed, lpts, assign) {
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
            //  ⑤ 갈고리 다리 — 자리가 종방향 철근이다 (hookGeom 주석)
            if (seg.hook && seg.hookQ) this.hookRows(pose, seg).forEach(r => rows.push(r));
            //  ⑥ 갈고리 다리의 자세 — 콘크리트 면과 평행 (parSetup 주석)
            if (seg.hook && seg.parW) this.parRows(pose, seg).forEach(r => rows.push(r));

            const ka = Math.sqrt(K.K_ANCHOR), kx = Math.sqrt(seg.hook ? 0 : K.K_AXIAL);
            const dcx = pose.cx - seg.c0.x, dcy = pose.cy - seg.c0.y;
            const ax = dcx * ux + dcy * uy;                  // 축방향 미끄러짐
            const pp = -dcx * uy + dcy * ux;                 // 면 쪽 이동
            if (!seg.hook) rows.push({ r: kx * ax, j: [kx * ux, kx * uy, kx * pp / half] });
            rows.push({ r: ka * pp, j: [-ka * uy, ka * ux, -ka * ax / half] });
            rows.push({ r: ka * (pose.th - seg.th0) * half, j: [0, 0, ka] });

            /*  `near.d ≈ 0` — 장애물이 조각 **위에** 정확히 서 있는 자리.
                밀 방향이 수학적으로 없다. 예전에는 여기서 줄을 안 만들고 넘어갔는데,
                `energy()` 는 그 겹침을 그대로 세므로 **J 는 크고 기울기는 0** 인
                자리가 생긴다 — 조각이 겹친 채 못 움직인다 (⑥-1[b] ⑥-4[b] 가
                종방향을 제 위에 놓았을 때 0.0 mm 도 안 비켰다. 거기 J 228,000).
                방향은 고를 것이 없다. 이 저장소가 이미 정해 둔 그것이다 —
                **바깥은 거푸집이고 안쪽이 콘크리트다. 겹은 안쪽으로 쌓인다**
                (settle 의 NUDGE 주석). n0 는 조각이 바라보는 벽 쪽이므로 −n0 다.    */
            const clearRow = (q, need, near, k) => {
                const g = near.d - need;
                if (g >= 0) return;                                // 여유가 있다
                const e = this.clrRes(g, k);                       // 되내려가는 손실 (clrRes 참조)
                const deg = near.d < 1e-9;
                const ex = deg ? -seg.n0.x : (near.x - q.x) / near.d;
                const ey = deg ? -seg.n0.y : (near.y - q.y) / near.d;
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
                if (!this.sameZ(q, seg)) return;              // 다른 단면의 철근이다
                const need = (q.dia + seg.dia) / 2;
                this.clearPairs(pts, q.p1, q.p2).forEach(n => {
                    clearRow({ x: n.qx, y: n.qy }, need, n, K.K_TRE);
                });
            });

            //  ④ 종방향 철근 — 점이라 ② 와 같은 꼴. 무게는 K_BAR (CONF 주석 참조)
            (lpts || []).forEach(q => {
                if (q === seg.hookQ) return;          // 제 자리는 ⑤ 가 맡는다
                clearRow(q, this.lreNeed(q, seg.dia), this.closestOnSeg(pts, q), K.K_BAR);
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
        grad: function (pose, seg, cons, ducts, placed, lpts, assign) {
            const h = this.CONF.H, half = Math.max(seg.len / 2, 1), g = {};
            [['cx', h], ['cy', h], ['th', h / half]].forEach(([k, hh]) => {
                const a = Object.assign({}, pose); a[k] += hh;
                const b = Object.assign({}, pose); b[k] -= hh;
                g[k] = (this.energy(a, seg, cons, ducts, placed, lpts, assign) -
                        this.energy(b, seg, cons, ducts, placed, lpts, assign)) / (2 * hh);
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
        descend: function (pose, seg, cons, ducts, placed, lpts, assign) {
            const K = this.CONF, half = Math.max(seg.len / 2, 1);
            /*  **각은 그것을 정해 주는 항이 있을 때만 풀린다.**
                보통 조각은 앉은 벽이 각을 정해 준다 (form 의 「앉은 면이 그 조각의
                직선식이다」). 갈고리 다리는 ⑤ 로 **자리만** 정해지므로 — 점 하나에서
                거리 13 인 직선은 무한히 많다 — 1단계에서는 각을 묶는다(lim 0).
                그러지 않으면 LM 이 각을 흘려 다리가 기울고 코너가 수십 mm 어긋난다.
                2단계에서 ⑥(평행항)이 붙으면 각을 정해 주는 것이 생기므로 **그때
                풀어 준다.** 그래도 init 주위 THMAX 안이다 — 자세의 바탕은 `code` ·
                `rot` 이 정하는 설계 의도이고, 장은 그것을 **면에 맞춰 다듬는다**. */
            const lim = (seg.hook && !seg.parW) ? 0 : K.THMAX * Math.PI / 180;
            let last = this.energy(pose, seg, cons, ducts, placed, lpts, assign);
            let lam = K.LAM0, i = 0;

            for (; i < K.ITER; i++) {
                const rows = this.residuals(pose, seg, cons, ducts, placed, lpts, assign);
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
                const Jn = this.energy(nx, seg, cons, ducts, placed, lpts, assign);
                /*  피복선에 닿아 있는데 밖으로 나가는 걸음이면 받지 않는다 (atRest 참조).
                    **단, 지금 피복을 지키고 있을 때만이다.**
                    `atRest` 는 `|g| < BAND` 라서 「피복선 안쪽 4 mm」뿐 아니라
                    **「피복을 4 mm 침범한 자리」도 닿아 있다고 본다.** 그 자리에서
                    면으로 가는 걸음은 아직 침범 중이라 `feasible(nx)` 가 거짓이고,
                    그래서 **전부 거부된다 — 위반한 채로 갇힌다.**
                    상부슬래브 ㄷ 를 상면에서 140 mm 아래에 두면 다리가 피복선을
                    9.52 mm 침범한 채 32 반복을 돌고 멈췄다. 거부를 풀면 6 반복에
                    정확히 0.00 으로 앉는다. 120 mm 아래에서 출발하면 멀쩡했다 —
                    **init 에 따라 답이 달라지고 있었다.**
                    여과가 할 일은 **지키고 있는 것을 깨지 않는 것**이지, 못 지키고
                    있는 것이 지키러 가는 길을 막는 것이 아니다.                   */
                const bad = this.feasible(pose, seg, cons, assign) &&
                            this.atRest(pose, seg, cons, assign) &&
                            !this.feasible(nx, seg, cons, assign);

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
        settle: function (seg, walls, sec, ducts, placed, lpts) {
            const pose0 = { cx: seg.c0.x, cy: seg.c0.y, th: seg.th0 };

            /*  **갈고리 다리는 «자리를 찾을 때» 벽을 안 본다.** 자리가 종방향
                철근이다 (hookGeom 주석). 그래서 벽 후보를 비우고(cons = []) ⑤ 로
                내려간다. 그러나 **앉은 뒤에는 콘크리트를 본다** — 다리는 면과
                평행해야 한다 (parSetup 주석). 세 걸음이다 :
                  1단계  종방향에 걸려 앉는다        각은 묶인 채 (lim 0)
                  2단계  그 자리에서 면을 고르고     각을 풀어 평행으로 돌린다
                  ㉢     면이 바뀌면 다시 2단계 (교대최소화. 되돌아오면 멈춘다)   */
            if (seg.hook) {          //  link(몸통)여도 여기로 온다 — 목표만 R 로 다르다
                if (!this.hookSetup(seg, lpts, seg._inherit))
                    return { pose: pose0, cons: [], iter: 0, stopped: 'no-seat', contacts: [] };
                this._seg = seg.label || '';
                seg.parW = null; seg.parD = null;
                this._stage = 1;
                const h1 = this.descend(pose0, seg, [], [], [], [], []);     // 자리만
                this._stage = 2;

                let pose = h1.pose, iter = h1.iter, J = h1.J, stop = h1.stopped || null;
                const seen = [];
                let o = 0;
                for (; o < this.CONF.OUTER; o++) {
                    const w = this.parSetup(seg, walls, sec, pose);
                    const id = w ? w.id : '-';
                    if (seen.length) {
                        //  같은 면이 다시 나왔다 — 끝이거나(마지막과 같다) 진동이다
                        if (seen.indexOf(id) >= 0) {
                            if (seen[seen.length - 1] !== id) stop = stop || 'par-cycle';
                            break;
                        }
                    }
                    seen.push(id);
                    const h = this.descend(pose, seg, [], ducts, placed, lpts, []);
                    pose = h.pose; iter += h.iter; J = h.J; stop = stop || h.stopped || null;
                }
                if (o >= this.CONF.OUTER) stop = stop || 'outer-limit';
                /*  `rest` 는 **고른 면**이다 (양 끝 같은 면). form 이 이것으로
                    「앉은 면이 그 조각의 직선식이다」를 적용해 자유단까지 같은 선에
                    올려 주고, 화면·표·`bench` 가 피복을 이 면에서 잰다.            */
                const rest = seg.parW ? [seg.parW.id, seg.parW.id] : [];
                return { pose: pose, cons: [], iter: iter,
                         Jcover: h1.J, J: J, outer: o + 1, rest: rest, hookQ: seg.hookQ,
                         parW: seg.parW ? seg.parW.id : null,
                         stopped: stop, contacts: [] };
            }

            const cons = this.targets(seg, walls, sec, seg.dia);
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
            const r1 = this.alternate(pose0, seg, cons, [], [], []);

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
            const r2 = this.alternate(start, seg, cons, ducts, placed, lpts);

            return {
                pose: r2.pose, cons: cons, iter: r1.iter + r2.iter,
                Jcover: r1.J, J: r2.J, outer: r2.outer,
                stopped: r2.stopped || r1.stopped || null,
                rest: r2.assign.map(i => cons[i].w.id),
                contacts: this.contacts(r2.pose, seg, cons)
            };
        },

        //  배정 ↔ 하강 교대. 배정이 안 바뀌면 끝이다.
        alternate: function (pose, seg, cons, ducts, placed, lpts) {
            const K = this.CONF, seen = {};
            let assign = this.assignOf(pose, seg, cons);
            let iter = 0, J = null, cycled = false, o = 0;
            for (; o < K.OUTER; o++) {
                const key = assign.join(',');
                if (seen[key]) { cycled = true; break; }
                seen[key] = 1;
                const r = this.descend(pose, seg, cons, ducts, placed, lpts, assign);
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

        /*  철근 하나. **딱 세 걸음이다.**

              ㉠ 조각마다 제 면을 찾아 한 번 앉힌다 (settle)
              ㉡ 앉은 면의 피복선이 그 조각의 **직선식**이 된다.
                 이웃한 두 직선의 **교점**이 코너다 (joinCorners)
              ㉢ 코너에서 **입력 길이**(없으면 기본값)만큼 되짚어 자유단을 놓는다

            ── 입력 길이는 제약이 아니라 **출발점**이다 ─────────────────────────
            조각의 길이는 「어디서 벽을 찾기 시작하나」를 정할 뿐이다. 앉고 나면
            그 조각이 놓인 **직선**만 남는다 — 길이는 거기서 아무 일도 하지 않는다.
            그래서 가운데 조각은 **입력이 필요 없다.** 코너와 코너를 잇기만 하면
            되니까 길이는 출력이다 (ㄷ자 스터럽 몸통이 400 을 줘도 7.5 m 로 서는
            이유). 입력 길이가 실제로 쓰이는 자리는 **양 끝 조각의 자유단** 하나다.

            ── 한때 판(pass)을 거듭했다. 그게 ⑧ 을 망쳤다 ─────────────────────
            앉힌 뒤 그려진 폴리라인으로 **조각을 다시 만들어 또 푸는** 고리가 있었다.
            순간격을 토막이 아니라 그려진 몸에서 재려던 것인데, 그 되먹임이 앉은
            자리를 흔든다 :
              판1  ⑧ 의 a → 복부 외측면(E6) · b → 셀 바닥 헌치(E21)   둘 다 맞게 앉았다
              판2  a 가 코너를 x=3452 로 끌어 b 를 552 mm 오른쪽으로 옮긴다 →
                   헌치는 x=3000 에서 끝나므로 b 의 띠가 50 mm 모자라 E21 이 빠지고,
                   남은 후보가 데크 상면(E2) 하나뿐이라 **b 가 5.7 m 위로 올라간다**
              판3  a 는 복부면의 길이를 벗어나 후보가 0 개가 된다 (no-target)
            **처음 앉은 자리가 답이다.** 다시 풀 이유가 없다.                     */
        form: function (bar, walls, sec, ducts, placed, lpts, claim) {
            this._pass = 1;
            const segs = bar.segs.map((s, i, arr) => {
                const vx = s.p2.x - s.p1.x, vy = s.p2.y - s.p1.y;
                const L = hyp(vx, vy) || 1;
                const th = Math.atan2(vy, vx);
                const mid = { x: (s.p1.x + s.p2.x) / 2, y: (s.p1.y + s.p2.y) / 2 };
                //  `link` = 두 코너 사이의 **연결 조각**. 양 끝(자유단)이 아닌 것.
                const link = i > 0 && i < arr.length - 1;
                /*  `bar.hook` 이면 **자유단이 갈고리 다리**다 — 벽이 아니라 종방향을
                    자리로 쓴다 (hookGeom 주석). 가운데 연결 조각은 그대로 둔다.
                    코너는 첫 조각이면 p2 쪽(+1), 마지막이면 p1 쪽(−1)이다.        */
                return { label: s.label, len: L, len0: L, dia: bar.dia, n0: s.normal, th0: th,
                         link: link, z: bar.z || 0, hookSpan: bar.hookSpan || 0,
                         cap: !!bar.cap,
                         //  임자 명단 — `settle` 이 조각마다 `hookSetup` 을 다시 부르므로
                         //  인자가 아니라 **조각에 실어** 보낸다 (거기까지 따라가야 한다)
                         _claim: claim || null,
                         hook: !!bar.hook && arr.length > 1,
                         hookEnd: (i === 0) ? 1 : -1,
                         bendR: bar.bendR || this.bendRadius(bar.dia),
                         p1: s.p1, p2: s.p2, mid: mid, c0: mid };
            });

            /*  **한 ㄷ 는 «한 자리» 를 문다.** 자유단(다리)이 절곡부에 가장 가까운
                종방향을 고르고, 가운데 연결 조각(몸통)은 **그 선택을 따른다** —
                몸통의 수직거리가 곧 다리의 축방향이므로, 둘이 다른 철근을 보면
                코너가 접선점에 안 선다 (hookSetup 주석).
                두 다리의 철근은 «짝» 이어야 한다 — `jlong` 의 `K_TIE` 가 상·하
                종방향을 같은 자리에 묶는 것이 그래서다. 짝이 아니면 한쪽 다리의
                절곡부가 어긋나고, 그 어긋남은 결과에 그대로 남아 보인다.        */
            if (bar.hook && segs.length > 1) {
                const ends = segs.filter(s => !s.link);
                /*  ── ∩ 은 알을 **감싼다** — 위도 아래도 «안쪽» 이다 ───────────────
                    「몸통과 맞닿는 수직철근 부분을 종방향을 **감싸는** 위치로 정착」
                    「종방향이 **∩ 내부에** 배치되는 형태로」 — 둘 다 안쪽이다.
                    한쪽만 안쪽으로 두었더니 위를 바깥으로 문 다리가 생겼고(7 개),
                    그런 다리는 두 요구가 서로 반대라 **둘 사이에 끼여** 양쪽 다
                    47.6 mm 씩 어긋났다. 안쪽이 어느 쪽인지는 ∩ 가 말해 준다 —
                    두 다리의 한가운데 쪽이다.                                    */
                if (bar.cap) {
                    const mx = ends.reduce((a, s) => a + s.mid.x, 0) / ends.length;
                    const my = ends.reduce((a, s) => a + s.mid.y, 0) / ends.length;
                    ends.forEach(s => {
                        const vx = s.p2.x - s.p1.x, vy = s.p2.y - s.p1.y;
                        const L2 = hyp(vx, vy) || 1;
                        s._inSide = ((mx - s.mid.x) * (-vy / L2) + (my - s.mid.y) * (vx / L2)) >= 0 ? 1 : -1;
                    });
                }
                const e0 = ends[0];
                /*  ㉮ 첫째 다리가 «자리» 를 정한다 — **덕트를 피해서** (hookPick 주석)
                    고른 것은 `_inherit` 에 실어 둔다. `settle` 이 조각마다 **다시**
                    `hookSetup` 을 부르므로, 여기서 `seg.hookQ` 만 박아 두면 거기서
                    옛 규칙(코너 최근접)으로 **조용히 덮인다.** 실제로 그랬다 :
                    T1#3 의 다리는 (−4877,−140) 을, 몸통은 고른 (−5099,−93) 을 물어
                    둘이 **다른 철근**을 보고 있었고, 코너가 189 mm 어긋났다
                    (hookSetup 주석의 그 병이 배정 쪽에서 되살아난 것이다).         */
                if (e0) {
                    /*  ∩ 는 **자유단**에서 문다. `hookPick` 은 코너에서 재므로
                        그대로 쓰면 위 철근줄을 골라 ㄷ 가 통째로 뒤집힌다
                        (재서 확인했다 — 몸통이 상면 밖으로 637 mm 솟았다).
                        덕트를 비키는 일이라 하부슬래브에는 쓸 데도 없다 — 끈다.   */
                    const pick = bar.cap ? null : this.hookPick(segs, lpts, ducts);
                    if (pick) e0._inherit = { q: pick, use: true };
                    this.hookSetup(e0, lpts, e0._inherit);
                }
                if (e0 && e0.hookQ) {
                    //  다리가 뻗는 쪽 = 코너 → 자유단.  축 = 그 반대(코너 쪽)
                    const c = (e0.hookEnd === 1) ? e0.p2 : e0.p1;
                    const f = (e0.hookEnd === 1) ? e0.p1 : e0.p2;
                    const dx = f.x - c.x, dy = f.y - c.y, dl = hyp(dx, dy) || 1;
                    const dir = { x: dx / dl, y: dy / dl };
                    const lead = { q: e0.hookQ, dir: dir, axis: dir };
                    //  ㉯ 나머지 다리는 **같은 자리**, ㉰ 몸통은 **그 철근 그대로**
                    ends.slice(1).forEach(s => { s._inherit = lead; });
                    /*  ㉱ 몸통이 축방향을 정한다 — 못박지 않고 **띠**로 준다
                        (hookRows 위 주석). 띠는 다리 하나와 벽에서 나온다.        */
                    const band = this.hookBandOf(e0.hookQ, dir, e0.len0,
                                                 e0.bendR || 0, walls, sec, bar.dia, !!bar.cap);
                    segs.forEach(s => {
                        if (!s.link) return;
                        s._inherit = { q: lead.q, dir: dir, body: true };
                        s.band = band;
                    });
                    /*  ── ㉲ ∩ 의 다리는 **아래 알도 문다** ───────────────────────
                        「수직철근의 마지막 부분을 슬래브 하단 피복까지 내리고,
                         그 위치에서 가장 가까운 종방향으로 철근을 위치한다. 이때
                         종방향이 **∩ 내부에 배치되는** 형태로 위치를 찾는다.」
                        차례가 그대로 식이 된다 :
                          ① 다리는 연직으로 태어나 있다 (`_expandSrebar` 의 `angs`)
                          ② 위 알은 이미 물었다 (`hookSetup` — 코너 쪽)
                          ③ 제 끝까지 내려가 **그 끝에서 가장 가까운** 알을 고른다
                          ④ 그 알이 **∩ 안쪽**에 오도록 무는 쪽을 정한다
                        고르는 것은 거리뿐이다 — 인력장이 가장 가까운 것을 당긴다.
                        이미 위 알로 물린 것은 뺀다 (한 알을 두 번 물 수 없다).     */
                    if (bar.cap && bar.endMode === 'tangent') {
                        //  ∩ 의 «안쪽» — 두 다리의 한가운데 쪽
                        const mx = ends.reduce((a, s) => a + s.mid.x, 0) / ends.length;
                        const my = ends.reduce((a, s) => a + s.mid.y, 0) / ends.length;
                        const mine = new Set();
                        ends.forEach(s => {
                            const tip = (s.hookEnd === 1) ? s.p1 : s.p2;   // 자유단 (아래 끝)
                            const cnr = (s.hookEnd === 1) ? s.p2 : s.p1;
                            const vx = s.p2.x - s.p1.x, vy = s.p2.y - s.p1.y;
                            const L2 = hyp(vx, vy) || 1, ux2 = vx / L2, uy2 = vy / L2;
                            //  다리에서 ∩ 한가운데로 가는 쪽이 «안쪽» 이다
                            const inSide = ((mx - s.mid.x) * (-uy2) + (my - s.mid.y) * ux2) >= 0 ? 1 : -1;
                            let best = null;
                            (lpts || []).forEach(q => {
                                if (q === s.hookQ || mine.has(q)) return;
                                if (claim && claim.has(q)) return;
                                const d = hyp(q.x - tip.x, q.y - tip.y);
                                if (d > (s.hookSpan > 0 ? s.hookSpan : s.len0)) return;
                                //  위 알 쪽으로 되돌아간 것은 «아래» 알이 아니다
                                if (!((q.x - cnr.x) * (tip.x - cnr.x) +
                                      (q.y - cnr.y) * (tip.y - cnr.y) > 0)) return;
                                //  **∩ 안쪽에 오는 알만** — 바깥에 두면 다리가 알을 등진다
                                const t2 = (q.x - s.mid.x) * (-uy2) + (q.y - s.mid.y) * ux2;
                                if ((t2 >= 0 ? 1 : -1) !== inSide) return;
                                if (!best || d < best.d) best = { d: d, q: q };
                            });
                            if (!best) return;
                            mine.add(best.q);
                            s.hookQ2 = best.q;
                            s.hookSide2 = inSide;      //  h 가 양수가 되는 쪽 = 안쪽
                        });
                    }
                }
            }

            const byId = {};
            (walls || []).forEach(w => { byId[w.id] = w; });

            //  ㉠ 각자 한 번 앉는다
            const res = segs.map(sg => {
                /*  ── **∩ 의 다리가 벽체를 어느 쪽으로 찾나** ─────────────────────
                    규칙은 하나이고, ∩ 가 어디 서느냐로 갈린다 :
                      복부  다리가 복부 면을 **따라 눕는다** → 제 **법선**으로 찾는다.
                            면에 안기므로 `seats` 가 그대로 맞고, 면이 기울면 두 다리가
                            서로 다른 길이로 줄어 **벽체 경사를 맞춘다**.
                      하부  다리가 두께를 **가로지른다** → 법선은 옆을 보고, 그 쪽엔
                            쓸 면이 없다. **접선**(다리가 뻗는 쪽)으로 찾아야 한다.
                    그래서 접선으로 찾는 다리에게는 **앉을 면을 주지 않는다.** 주면
                    `seats` 의 ③(띠)이 벽이 길다는 이유로 **3 m 밖 복부면**(E7 · E10)을
                    통과시키고, 그 면의 피복 우물이 다리를 그 벽 방향으로 세운다 —
                    실제로 다리 13 개가 전부 정확히 90.00°(연직)가 됐었다. 그 자리의
                    슬래브 면은 6.44° ~ −9.81° 인데도.
                    한때 이것을 **반경**(`RHO_LINK` 1500)으로 막았는데, 그건 이 규칙의
                    그림자였다 — 「멀면 아니다」가 아니라 **「그 쪽으로 안 찾는다」**가
                    맞는 말이다. 길이는 `_capLegs` 가 접선으로 재어 준다.          */
                /*  ⑥ 「몸통은 **수평 무시하고** 양단을 연결해 마무리한다」 —
                    그래서 몸통이 면과 **나란해지라**는 요구는 뗀다 (아래 `rw` 가
                    그것이고, `bar.cap` 이면 안 쓴다).
                    그렇다고 **면을 통째로 떼면 안 된다.** 한때 그렇게 했더니 몸통의
                    **피복 우물까지 같이 떨어져 나갔고**, 밀어낼 항이 없으니 몸통이
                    상면 피복 안으로 **19.2 mm** 들어갔다 (5 개가 그랬다).
                    「수평 무시」는 *나란히 서라* 를 떼라는 말이지 *피복* 을 떼라는
                    말이 아니다. 면을 안 주는 것은 **다리**뿐이다 — 다리는 두께를
                    가로질러 어느 면에도 못 앉는다(재면 `rest` 가 빈다).          */
                const tang = !!bar.cap && !sg.link && bar.endMode === 'tangent';
                const r = this.settle(sg, tang ? [] : walls, sec, ducts, placed, lpts);
                const half = sg.len / 2;
                let ux = Math.cos(r.pose.th), uy = Math.sin(r.pose.th);

                /*  **앉은 면이 그 조각의 직선식이다.** 방향을 벽에서 가져온다.
                    토막은 덕트·이웃 철근에 밀려 벽과 몇 도 어긋난 채 멈출 수 있다
                    (⑥-2 의 윗다리가 데크면과 1.6° 틀어졌다 — 덕트 581 · 철근 627 이
                    피복 125 를 밀어낸 자리다). 그 토막을 코너에서 400 mm 늘리면
                    어긋남이 그대로 커져서 자유단이 피복선 **밖으로** 16.6 mm 나갔다.
                    벽에서 방향을 가져오면 그 일이 없어진다 — 늘려도 같은 선 위다.
                    **중점은 안 건드린다** : 덕트에 밀려난 만큼(면에서 떨어진 거리)은
                    J 가 찾은 값이고, 그건 살려 둬야 한다. 방향만 벽의 것으로 바꾼다.
                    두 끝이 서로 다른 면에 앉았으면(헌치를 타고 넘는 조각) 벽이 하나로
                    정해지지 않으므로 앉은 자세를 그대로 쓴다.                      */
                /*  ── ∩ 의 **다리**에는 이 규칙을 안 쓴다 ────────────────────────
                    위 규칙은 「다리가 부재를 따라 누워 제 면에 안긴다」는 ㄷ 를 두고
                    한 말이다. ∩ 의 다리는 두께를 **가로지르므로** 제 법선이 옆을
                    보는데, 하부슬래브에는 그 쪽에 쓸 면이 없어 멀리 있는 **복부면
                    (연직)** 을 집는다. 그러면 다리가 그 벽의 방향으로 **끌려가** 13 개
                    전부 정확히 90.00°(연직)가 됐다 — 그 자리의 슬래브 면은 6.44° ~
                    −9.81° 인데도. 「양단부가 슬래브에 수직으로 딱 맞게」가 안 된 까닭이
                    이것이다.
                    ∩ 의 다리 방향은 **태어날 때 제 면의 법선으로** 정해져 들어온다
                    (`_expandSrebar` 의 자리별 `tilt`). 여기서 벽이 덮지만 않으면
                    그 방향이 그대로 간다 — 앉은 자세를 쓰는 것이 맞고, 그건 바로
                    아래 「두 끝이 서로 다른 면에 앉았으면」과 같은 처분이다.      */
                const rw = (!(bar.cap && !sg.link) &&
                            r.rest && r.rest.length === 2 && r.rest[0] === r.rest[1])
                           ? byId[r.rest[0]] : null;
                if (rw) {
                    const wx = rw.x2 - rw.x1, wy = rw.y2 - rw.y1, wl = hyp(wx, wy) || 1;
                    let vx = wx / wl, vy = wy / wl;
                    if (vx * ux + vy * uy < 0) { vx = -vx; vy = -vy; }   // 진행 방향에 맞춘다
                    ux = vx; uy = vy;
                }
                const dx = ux * half, dy = uy * half;
                return {
                    label: sg.label, iter: r.iter, J: r.J, Jcover: r.Jcover, len0: sg.len0,
                    cons: r.cons.map(c => c.w.id), contacts: r.contacts || [],
                    rest: r.rest || [], stopped: r.stopped || null,
                    //  갈고리 다리는 「어느 종방향에 걸렸나」가 결과다 (rest 의 자리)
                    hook: !!sg.hook, hookQ: sg.hookQ || null, hookSide: sg.hookSide || 1,
                    //  ∩ 의 다리는 알을 둘 문다 — 둘째도 결과에 실어 보낸다
                    hookQ2: sg.hookQ2 || null, hookSide2: sg.hookSide2 || 1,
                    link: !!sg.link, band: sg.band || null,
                    parW: r.parW || null, bendR: sg.bendR || 0,
                    u: { x: ux, y: uy },
                    p1: { x: r.pose.cx - dx, y: r.pose.cy - dy },
                    p2: { x: r.pose.cx + dx, y: r.pose.cy + dy }
                };
            });

            //  ㉡′ 축방향은 **ㄷ 의 자유도**다 — 조각이 아니라 ㄷ 로 한 번 더 내린다
            const slide = this.axialSlide(res, bar, ducts, placed, lpts);

            //  ㉡㉢ 교점으로 잇고, 자유단은 입력 길이만큼 되짚는다
            const pts = this.joinCorners(res);

            //  출력 길이 — 폴리라인에서 잰다 (가운데 조각은 여기서 정해진다)
            res.forEach((s, i) => { s.len = hyp(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y); });
            const total = res.reduce((a, s) => a + s.len, 0);

            return { id: bar.id, dia: bar.dia, segs: res, pts: pts, len: total,
                     pass: 1, moved: 0, slide: slide };
        },

        /*  ── ㄷ 의 축방향은 «조각» 이 아니라 «ㄷ» 의 자유도다 ──────────────────
            이 엔진은 J 를 **조각마다** 내린다 (블록 좌표하강). 조각이 서로 독립인
            동안은 그래도 된다. 갈고리는 아니다 — 자유도를 세어 보면 그렇다 :

              평면에서 강체 ㄷ 는 자유도 셋이다.
                ⑤ 다리가 제 종방향에 닿는다        → 가로 하나를 먹는다
                ⑥ 다리가 제 면과 나란해진다        → 각 하나를 먹는다
                남는 하나가 **축방향**이고, 그것이 몸통의 h 다 (hookRows 위 주석).

            그런데 그 **하나뿐인 자유도**를 몸통 혼자 쥐고 있고, 몸통은 `settle` 에서
            **제 조각의** 장애물만 본다. 그래서 **다리가 덕트를 파고들어도 몸통은
            가만히 있는다.** 실제로 그랬다 : T1#8 은 다리 a 가 TC1L 을 22.9 mm
            파고든 채 h 112 에 섰는데, 같은 J 를 **ㄷ 전체로** 썰어 보면 h 150 이
            2,113 → 1,107 로 더 낮다. 띠 안이고, 갈 수 있는데 못 갔다.

            ── 새 항도 새 자유도도 아니다 ────────────────────────────────────
            여기서 더하는 것이 없다. **같은 J** (덕트 K_CLR · 철근 K_BAR/K_TRE ·
            띠와 접선점 선호) 를 **같은 한 자유도** 위에서 내릴 뿐이다. 달라지는 것은
            **쪼개는 방식**이고, 그건 장이 아니라 푸는 순서의 문제였다.
            이 저장소가 이미 쓰는 그 교대최소화의 마지막 블록이다 (`alternate` ·
            자리 배정 · `par-cycle` 과 같은 구조) :
                조각마다 내린다  →  ㄷ 로 축방향 한 번  →  코너를 잇는다

            ── 왜 기울기 한 걸음이 아니라 «훑기» 인가 ────────────────────────
            덕트·철근 배리어는 되내려가는(redescending) 꼴이라 **볼록하지 않다.**
            기울기는 제가 선 골짜기만 본다 — 이 저장소가 이미 적어 둔 그 병이다
            (「능선을 못 넘고 덕트 위에 걸터앉는다」). 그런데 이 블록은 변수가
            **하나**고 구간이 **띠로 막혀 있다.** 유계 1차원에서는 훑는 것이
            전역최소이고, 기울기보다 **강한** 답이다. 2 mm 로 훑고 0.1 mm 로 다듬는다.

            ── 움직이는 것은 몸통의 선 하나다 ────────────────────────────────
            몸통의 선을 n̂ 으로 δ 옮기면 `joinCorners` 가 코너를 **다리의 선 위에서**
            옮겨 준다 — 다리의 선은 그대로이므로 ⑤(닿음)도 ⑥(각)도 변하지 않는다.
            곧 δ 는 **다른 모든 항을 건드리지 않는 순수한 축방향 자유도**다.
            그래서 δ 를 재는 J 에 ⑤ 와 ⑥ 을 넣지 않는다 (상수라 최소를 안 옮긴다).  */
        axialSlide: function (res, bar, ducts, placed, lpts) {
            const K = this.CONF;
            let bi = -1;
            for (let i = 0; i < res.length; i++)
                if (res[i].link && res[i].band && res[i].hookQ) bi = i;
            if (bi < 0) return null;

            const sg = res[bi], b = sg.band, q = sg.hookQ;
            const L = hyp(sg.p2.x - sg.p1.x, sg.p2.y - sg.p1.y) || 1;
            const ux = (sg.p2.x - sg.p1.x) / L, uy = (sg.p2.y - sg.p1.y) / L;
            const nu = sg.hookSide || 1;
            const nx = nu * -uy, ny = nu * ux;
            const cx = (sg.p1.x + sg.p2.x) / 2, cy = (sg.p1.y + sg.p2.y) / 2;
            const h0 = (q.x - cx) * nx + (q.y - cy) * ny;      // 지금의 h
            //  띠를 δ 로 옮긴다 : 몸통을 +n̂ 으로 δ 옮기면 h 는 δ 만큼 **준다**
            const dLo = h0 - b.hi, dHi = h0 - b.lo;
            if (!(dHi > dLo)) return null;

            //  **닿을 수 있는 것만 본다** — 띠를 훑는 동안 ㄷ 가 지나는 자리 둘레
            const span = Math.max(Math.abs(dLo), Math.abs(dHi));
            let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
            res.forEach(r => { [r.p1, r.p2].forEach(p => {
                x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
                y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }); });
            const pad = span + 800;
            const inBox = p => p.x > x0 - pad && p.x < x1 + pad && p.y > y0 - pad && p.y < y1 + pad;
            const dus = (ducts || []).filter(inBox);
            const lps = (lpts || []).filter(p => inBox(p) && !res.some(r => r.hookQ === p));
            const bars = (placed || []).filter(o => (o.z || 0) === (bar.z || 0) &&
                                                    (inBox(o.p1) || inBox(o.p2)));

            /*  **위반**과 **선호**를 갈라 둔다. 벌점으로 섞으면 안 되는 까닭은 ↓.   */
            const parts = d => {
                const rs = res.map((r, i) => i !== bi ? r : {
                    u: r.u, len0: r.len0,
                    p1: { x: r.p1.x + nx * d, y: r.p1.y + ny * d },
                    p2: { x: r.p2.x + nx * d, y: r.p2.y + ny * d } });
                const pts = this.joinCorners(rs);
                let v = 0, bite = 0;          // bite — **mm 로 잰** 가장 깊은 파고듦
                for (let i = 0; i + 1 < pts.length; i++) {
                    const pp = [pts[i], pts[i + 1]];
                    dus.forEach(k => {
                        const need = (k.D / 2) + (k.clr != null ? k.clr : 30) + bar.dia / 2;
                        const g = this.segToPoint(pp, k) - need;
                        if (g < 0) { const e = this.clrRes(g); v += e.r * e.r; bite = Math.min(bite, g); }
                    });
                    lps.forEach(p => {
                        const g = this.segToPoint(pp, p) - this.lreNeed(p, bar.dia);
                        if (g < 0) { const e = this.clrRes(g, K.K_BAR); v += e.r * e.r; bite = Math.min(bite, g); }
                    });
                    bars.forEach(o => {
                        const need = (o.dia + bar.dia) / 2;
                        this.clearPairs(pp, o.p1, o.p2).forEach(n => {
                            const g = n.d - need;
                            if (g < 0) { const e = this.clrRes(g, K.K_TRE); v += e.r * e.r; bite = Math.min(bite, g); }
                        });
                    });
                }
                //  띠(하드) 와 접선점 선호(감쇠) — hookRows 와 **같은 식**이다
                const h = h0 - d;
                let p = 0;
                if (h < b.lo) p += b.wLo * (h - b.lo) * (h - b.lo);
                else if (h > b.hi && b.wHi > 0) p += b.wHi * (h - b.hi) * (h - b.hi);
                const e = this.clrRes(h - b.pref, 1);
                return { v: v, p: p + e.r * e.r, bite: bite };
            };
            const cost = d => { const o = parts(d); return o.v + o.p; };
            /*  **지키고 있나는 mm 로 가른다.** 에너지로 「v === 0」을 보면 안 된다 —
                다리는 제 종방향 줄과 정확히 need 만큼 떨어져 **나란히** 눕는데, 그 줄이
                데크 기울기를 타고 있어 몇몇 알이 1e-5 mm 쯤 어긋난다. 에너지로 보면
                그것도 위반이라 가능영역이 통째로 비어 보여서, 멀쩡히 앉아 있던 ㄷ 가
                117 mm 날아갔다 (벤치 x = 400 · 900 에서 J 0 → 844).
                자는 **공학이 아니라 수치**다 — 1 µm 는 재는 오차지 순간격이 아니다.
                (공학 쪽 자인 `TOUCH` 0.5 mm 를 쓰면 안 된다. 그걸 쓰면 선호가 ㄷ 를
                 **그 0.5 mm 끝까지** 끌어당겨, 0.0 으로 설 수 있는 자리가 있는데도
                 −0.5 에 선다. 실제로 그랬다.)                                     */
            const okv = o => o.bite > -1e-3;

            /*  ── 지킬 수 있으면 «지킨다» — 벌점이 아니라 여과다 ──────────────────
                순간격 벌점은 g = 0 에서 **2차로 사라진다.** 그래서 반대쪽에서 아무리
                약한 힘이 당겨도 **언제나 조금은 겹친 채로** 멈춘다. T1#9 가 그랬다 :
                  h 60.6 에서 덕트 −1.9 · 덕트 기울기 2·K_CLR·g = 15.2
                                        접선점 선호 기울기 ≈ 2·(h−R) = 56
                  → 선호가 이겨서 1.9 mm 를 겹친 채 선다. 그런데 **h 72 에서는 덕트가
                    정확히 0.0 이고 정착도 78 로 지켜진다** — 둘 다 되는 자리가 있다.
                벌점으로 섞는 한 그 자리를 못 고른다. 2차로 사라지는 항은 제약을
                **강제할 수가 없다** — 그건 기하의 성질이 아니라 벌점법의 성질이다.

                이 저장소는 이미 그 답을 쓴다 (`descend` 의 `feasible`·`atRest`) :
                「여과가 할 일은 **지키고 있는 것을 깨지 않는 것**이다.」
                순간격은 **지켜야 하는 것**이고 접선점은 **좋으면 좋은 것**이다.
                그래서 이 블록에서는 이렇게 고른다 :
                  ㉮ 띠 안에 위반 0 인 자리가 **있으면** — 그 중에서 선호가 가장 작은 것
                  ㉯ 없으면 — 예전처럼 J = 위반 + 선호 를 최소로 (못 지키는 타협)
                이것을 여기서 할 수 있는 까닭은 이 블록이 **1차원이고 유계**이기
                때문이다. 훑으면 가능영역이 통째로 보인다 — 기울기로는 못 하는 일이다. */
            const base = parts(0), J0 = base.v + base.p;
            let bd = 0, bJ = J0, feas = null, feasP = Infinity;
            for (let d = dLo; d <= dHi + 1e-9; d += 1) {
                const o = parts(d);
                if (o.v + o.p < bJ - 1e-9) { bJ = o.v + o.p; bd = d; }
                if (okv(o) && o.p < feasP) { feasP = o.p; feas = d; }
            }
            if (feas != null) {
                /*  가능영역 안에서 선호는 pref 에 가까울수록 작다 — 그러니 **pref 쪽으로
                    한 발씩 다가가다 위반이 생기면 멈춘다.** (가능영역의 가장자리다.)  */
                const want = h0 - b.pref;               // 선호가 바라는 δ
                const step = (want > feas) ? 0.1 : -0.1;
                for (let d = feas + step; (step > 0 ? d <= want + step / 2 : d >= want - step / 2); d += step) {
                    if (d < dLo || d > dHi) break;
                    if (!okv(parts(d))) break;
                    feas = d;
                }
                /*  **바라는 자리 자체를 마지막에 한 번 본다.** 0.1 씩 더하다 보면
                    끝에서 1e-17 쯤 넘쳐 고리가 한 걸음 일찍 끝난다 — 그러면 멀쩡히
                    선호 자리에 설 수 있는 ㄷ 가 0.1 mm 밀린 채 남는다 (J 0 → 0.01).  */
                if (want >= dLo && want <= dHi && okv(parts(want))) feas = want;
                bd = feas; bJ = parts(feas).v + parts(feas).p;
            } else {
                for (let d = Math.max(dLo, bd - 1); d <= Math.min(dHi, bd + 1) + 1e-9; d += 0.1) {
                    const J = cost(d); if (J < bJ - 1e-9) { bJ = J; bd = d; }
                }
            }
            /*  `v` 를 같이 낸다 — 고르는 자가 **둘**이기 때문이다 (위반이 먼저,
                같으면 J). 벤치는 그 사전식 차례로 검사한다.
                **옮기기 전에** 잰다 — 옮기고 나서 `parts(0)` 을 부르면 그것은
                이미 «옮긴 자리»다 (한 번 그렇게 적었다가 위반이 0 → 0 으로 보였다). */
            const fin = parts(bd);
            if (bd !== 0) {
                sg.p1 = { x: sg.p1.x + nx * bd, y: sg.p1.y + ny * bd };
                sg.p2 = { x: sg.p2.x + nx * bd, y: sg.p2.y + ny * bd };
            }
            return { d: bd, h0: h0, h: h0 - bd, J0: J0, J: bJ,
                     v0: base.v, v: fin.v, feas: feas != null, lo: b.lo, hi: b.hi };
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
        /*  `placed0` — **이미 놓여 있는 것**을 가지고 시작한다 (선택).
            갈고리(srebar)는 종방향 **뒤에** 풀리는데, 그때 횡방향은 벌써 다 놓여
            있다. 빈 배열로 시작하면 갈고리가 그 횡방향을 못 보고 통과한다.
            꼴은 `placed` 와 같다 : { p1, p2, dia, z }.                          */
        /*  ── **한 종방향을 둘이 감싸지 않는다** ────────────────────────────────
            ∩ 의 두 다리는 「같은 줄의 다른 두 자리」를 문다(`capPair`). 그런데 그
            규칙은 **제 안에서만** 보므로, 이웃한 ∩ 가 같은 알을 무는 것은 못 막는다.
            S14 에서 재면 26 개 다리 중 **6 개**가 옆 ∩ 와 알을 나눠 물었다
            (`t = 2000 · 1125 · 250 · −1125 · −1500 · −2375`). ctc 450 에 몸통이 387 이라
            이웃한 ∩ 의 «안쪽 다리» 둘이 **63 mm** 밖에 안 떨어져, 125 짜리 줄에서
            둘 사이에 알이 하나뿐인 자리가 생기기 때문이다.
            그래서 **먼저 문 쪽이 그 알을 가진다** — 뒤에 오는 ∩ 는 제 칸(`hookSpan`
            = ctc/2) 안에서 **남은 알**을 고른다. 차례가 곧 임자다 (`placed` 와 같은
            규칙이다 — 이미 놓인 것이 다음 것의 조건이 된다).                     */
        solve: function (bars, walls, sec, ducts, lpts, placed0) {
            const placed = (placed0 || []).slice(), out = [];
            const claim = new Set();
            (bars || []).forEach(b => {
                const r = this.form(b, walls, sec, ducts, placed, lpts, claim);
                out.push(r);
                //  **다 만든 뒤에** 임자를 적는다 — 만드는 중에는 제 알을 몇 번씩 본다
                if (b.cap) (r.segs || []).forEach(s => { if (s.hookQ) claim.add(s.hookQ); });
                for (let i = 0; i + 1 < r.pts.length; i++)
                    placed.push({ p1: r.pts[i], p2: r.pts[i + 1], dia: b.dia, z: b.z || 0 });
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
