// =========================================================================
// 🟦 PART: LONGITUDINAL REBAR ENGINE (lrebar.js) - v002
// =========================================================================

const GRAVITY_K = 0.08;
const DAMPING = 0.80;
const CONVERGE = 0.2;

class LRebarGroup {
    constructor(data) {
        this.id = data.id || "L_UNKNOWN";
        this.state = "FITTING";
        this.isTargeted = false; // ⭐ 사전 목표 할당 완료 여부 플래그

        // 1. init 파싱 (기준점, 기울기, 중력방향)
        const init = data.init || {};
        const cx = init.x || 0;
        const cy = init.y || 0;
        const rotDeg = init.rot || 0;
        const rotRad = rotDeg * Math.PI / 180;
        const gravSign = init.grav === -1 ? -1 : 1; // 1: 위쪽(정방향), -1: 아래쪽(역방향)

        // 2. range 파싱 (배치 구간)
        const range = data.range || { min: 0, max: 0 };
        const rMin = range.min || 0;
        const rMax = range.max || 0;
        const totalLen = rMax - rMin;

        // 3. bar 파싱 (직경, 개수, 간격)
        const bar = data.bar || {};
        this.dia = bar.dia || 13;

        // 개수(num) 필수 검증
        if (bar.num === undefined || bar.num < 1) {
            console.error(`[LREBAR ERROR] ${this.id}: 철근 개수(num)가 입력되지 않았습니다.`);
            this.num = 0; 
        } else {
            this.num = bar.num;
        }

        let num = this.num;
        let ctc = 0;

        // 실제 간격(ctc) 재계산
        if (num > 1) {
            ctc = totalLen / (num - 1);
        }

        if (num > 1 && bar.min !== undefined && ctc < bar.min) {
            console.warn(`[LREBAR WARNING] ${this.id}: 계산된 철근 간격(${ctc.toFixed(1)}mm)이 허용 최소 간격(${bar.min}mm)보다 작습니다.`);
        }

        // 4. 벡터 계산 (직선 벡터 및 법선(중력) 벡터)
        const ux = Math.cos(rotRad); 
        const uy = Math.sin(rotRad); 

        // 법선 벡터에 gravSign을 곱해 최종 탐색 방향 결정
        this.gravDir = {
            x: -uy * gravSign,
            y: ux * gravSign
        };

        // 5. 입자(철근) 생성 및 초기 위치 세팅
        this.particles = [];
        for (let i = 0; i < num; i++) {
            let localDist = (num === 1) ? (rMin + rMax) / 2 : rMin + (i * ctc);

            let px = cx + ux * localDist;
            let py = cy + uy * localDist;

            this.particles.push({
                x: px,
                y: py,
                vx: 0,
                vy: 0,
                target: null, // ⭐ 이동해야 할 최종 목적지
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
        if (group.state === "SETTLED" || group.num === 0) return;

        // ⭐ 1단계: 생성 후 최초 1회만 타겟 탐색 (Pre-Targeting)
        if (!group.isTargeted) {
            group.particles.forEach(p => {
                let minDist = Infinity;
                let foundTarget = null;

                // 중력 방향(gravDir)으로 레이캐스트를 쏴서 목표 벽면 탐색
                coverWalls.forEach(w => {
                    const hit = MathUtils.rayLineIntersect(
                        { x: p.x, y: p.y }, group.gravDir,
                        { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }
                    );

                    // 자기 자신과 바로 맞닿아 있는 경우를 피하기 위해 dist > 0.01 조건 적용
                    if (hit && hit.dist > 0.01 && hit.dist < minDist) {
                        const dotCheck = (hit.x - p.x) * group.gravDir.x + (hit.y - p.y) * group.gravDir.y;
                        if (dotCheck > 0) { // 정확히 바라보는 방향에 있는 벽면인지 체크
                            minDist = hit.dist;
                            foundTarget = { x: hit.x, y: hit.y };
                        }
                    }
                });

                if (foundTarget) {
                    p.target = foundTarget; // 목표 할당
                } else {
                    // 목표를 찾지 못했다면 허공으로 날아가지 않도록 제자리에 고정
                    console.warn(`[LREBAR] ${group.id}의 입자가 방향(${group.gravDir.x.toFixed(2)}, ${group.gravDir.y.toFixed(2)})에서 피복면을 찾지 못했습니다.`);
                    p.state = "SETTLED";
                }
            });
            group.isTargeted = true; // 탐색 완료 플래그
        }

        // ⭐ 2단계: 할당된 타겟을 향해 동력학적으로 이동 (Physics Move)
        let allSettled = true;

        group.particles.forEach(p => {
            if (p.state === "SETTLED") return;
            allSettled = false;

            if (p.target) {
                const dx = p.target.x - p.x;
                const dy = p.target.y - p.y;
                const err = Math.hypot(dx, dy);

                // 중력 가속도 및 감쇠력 적용 (목표물을 향해 빨려들어가는 로직)
                p.vx += dx * GRAVITY_K;
                p.vy += dy * GRAVITY_K;
                p.vx *= DAMPING;
                p.vy *= DAMPING;

                p.x += p.vx;
                p.y += p.vy;

                // 목표점에 거의 도달하면 안착 처리
                if (Math.abs(p.vx) + Math.abs(p.vy) < CONVERGE && err < 1.0) {
                    p.x = p.target.x;
                    p.y = p.target.y;
                    p.state = "SETTLED";
                }
            }
        });

        // 모든 입자가 안착했다면 그룹의 상태도 완료로 변경
        if (allSettled) {
            group.state = "SETTLED";
        }
    }
};
