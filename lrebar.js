// =========================================================================
// 🟦 PART: LONGITUDINAL REBAR ENGINE (lrebar.js) - v000
// =========================================================================

const GRAVITY_K = 0.08;
const DAMPING = 0.80;
const CONVERGE = 0.2;

class LRebarGroup {
    constructor(data) {
        this.id = data.id || "L_UNKNOWN";
        this.state = "FITTING";

        // 1. init 파싱 (기준점, 기울기, 중력방향)
        const init = data.init || {};
        const cx = init.x || 0;
        const cy = init.y || 0;
        const rotDeg = init.rot || 0;
        const rotRad = rotDeg * Math.PI / 180;
        const gravSign = init.grav === -1 ? -1 : 1; // 기본값은 1 (정방향)

        // 2. range 파싱 (배치 구간)
        const range = data.range || { min: 0, max: 0 };
        const rMin = range.min || 0;
        const rMax = range.max || 0;
        const totalLen = rMax - rMin;

        // 3. bar 파싱 (직경, 개수, 간격)
        const bar = data.bar || {};
        this.dia = bar.dia || 13;
        let num = bar.num;
        let ctc = bar.ctc;

        // CTC 및 개수 자동 계산 로직
        if (num === undefined && ctc !== undefined && ctc > 0) {
            num = Math.floor(totalLen / ctc) + 1;
        } else if (num !== undefined && num > 1) {
            ctc = totalLen / (num - 1);
        } else {
            num = 1;
            ctc = 0;
        }

        // 안전망: 최소 간격(min) 검증
        if (bar.min && ctc < bar.min) {
            console.warn(`[LREBAR WARNING] ${this.id}: 계산된 철근 간격(${ctc.toFixed(1)}mm)이 허용 최소 간격(${bar.min}mm)보다 작습니다.`);
        }

        // 4. 벡터 계산 (직선 벡터 및 법선(중력) 벡터)
        const ux = Math.cos(rotRad); // 선의 X 방향 벡터
        const uy = Math.sin(rotRad); // 선의 Y 방향 벡터

        // 법선 벡터 (Normal Vector): 선 벡터를 90도 회전 (-uy, ux)
        // 여기에 gravSign(+1 또는 -1)을 곱해 최종 낙하 방향 결정
        this.gravDir = {
            x: -uy * gravSign,
            y: ux * gravSign
        };

        // 5. 입자(철근) 생성 및 초기 위치 세팅
        this.particles = [];
        for (let i = 0; i < num; i++) {
            // 중심점(cx, cy)으로부터의 로컬 거리 계산 (min 위치에서 출발)
            let localDist = num === 1 ? (rMin + rMax) / 2 : rMin + (i * ctc);

            let px = cx + ux * localDist;
            let py = cy + uy * localDist;

            this.particles.push({
                x: px,
                y: py,
                vx: 0,
                vy: 0,
                state: "FITTING"
            });
        }
    }
}

const LRebarEngine = {
    create: (data) => {
        return new LRebarGroup(data);
    },

    step: (group, coverWalls) => {
        if (group.state === "SETTLED") return;

        let allSettled = true;

        group.particles.forEach(p => {
            if (p.state === "SETTLED") return;
            allSettled = false;

            let minDist = Infinity;
            let target = null;

            // 중력 방향(gravDir)으로 레이캐스트 쏘기
            coverWalls.forEach(w => {
                const hit = MathUtils.rayLineIntersect(
                    { x: p.x, y: p.y }, group.gravDir,
                    { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }
                );

                if (hit && hit.dist > 0.1 && hit.dist < minDist) {
                    const dotCheck = (hit.x - p.x) * group.gravDir.x + (hit.y - p.y) * group.gravDir.y;
                    if (dotCheck > 0) {
                        minDist = hit.dist;
                        target = { x: hit.x, y: hit.y };
                    }
                }
            });

            // 타겟(벽면)을 향해 동력학적으로 이동
            if (target) {
                const dx = target.x - p.x;
                const dy = target.y - p.y;
                const err = Math.hypot(dx, dy);

                p.vx += dx * GRAVITY_K;
                p.vy += dy * GRAVITY_K;
                p.vx *= DAMPING;
                p.vy *= DAMPING;

                p.x += p.vx;
                p.y += p.vy;

                if (Math.abs(p.vx) + Math.abs(p.vy) < CONVERGE && err < 1.0) {
                    p.x = target.x;
                    p.y = target.y;
                    p.state = "SETTLED";
                }
            }
        });

        if (allSettled) {
            group.state = "SETTLED";
        }
    }
};
