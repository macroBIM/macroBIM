// =========================================================================
// 🟦 PART: LONGITUDINAL REBAR ENGINE (lrebar.js) - v004
// =========================================================================

const GRAVITY_K = 0.08;
const DAMPING = 0.80;
const CONVERGE = 0.2;

class LRebarGroup {
    constructor(data) {
        this.id = data.id || "L_UNKNOWN";
        this.state = "FITTING";
        this.isTargeted = false; 

        // 1. init 파싱 (기준점, 기울기, 중력방향)
        const init = data.init || {};
        const cx = init.x || 0;
        const cy = init.y || 0;
        const rotDeg = init.rot || 0;
        const rotRad = rotDeg * Math.PI / 180;
        const gravSign = init.grav === -1 ? -1 : 1; 

        // 2. range 파싱 (배치 구간)
        const range = data.range || { min: 0, max: 0 };
        const rMin = range.min || 0;
        const rMax = range.max || 0;
        const totalLen = rMax - rMin;

        // 3. bar 파싱 (직경, 개수, 간격, 피복)
        const bar = data.bar || {};
        this.dia = bar.dia || 13;
        
        // ⭐ [추가] 피복 두께 파싱 (입력이 없으면 기본값 50 적용)
        this.cover = bar.cover !== undefined ? bar.cover : 50; 
        
        // ⭐ [추가] 벽면에서 떨어져야 할 실제 거리 (피복 + 철근 반지름)
        this.offset = this.cover + (this.dia / 2); 

        if (bar.num === undefined || bar.num < 1) {
            console.error(`[LREBAR ERROR] ${this.id}: 철근 개수(num)가 입력되지 않았습니다.`);
            this.num = 0; 
        } else {
            this.num = bar.num;
        }

        let num = this.num;
        let ctc = 0;

        if (num > 1) {
            ctc = totalLen / (num - 1);
        }

        if (num > 1 && bar.min !== undefined && ctc < bar.min) {
            console.warn(`[LREBAR WARNING] ${this.id}: 계산된 철근 간격(${ctc.toFixed(1)}mm)이 허용 최소 간격(${bar.min}mm)보다 작습니다.`);
        }

        // 4. 벡터 계산 
        const ux = Math.cos(rotRad); 
        const uy = Math.sin(rotRad); 

        this.gravDir = {
            x: -uy * gravSign,
            y: ux * gravSign
        };

        // 5. 입자 생성
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
                target: null, 
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

        // ⭐ 1단계: Pre-Targeting
        if (!group.isTargeted) {
            group.particles.forEach(p => {
                let minDist = Infinity;
                let foundTarget = null;

                coverWalls.forEach(w => {
                    const dotNormal = group.gravDir.x * w.nx + group.gravDir.y * w.ny;

                    // 마주보는 면에 대해서만 검사
                    if (dotNormal < -0.01) {
                        const hit = MathUtils.rayLineIntersect(
                            { x: p.x, y: p.y }, group.gravDir,
                            { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }
                        );

                        if (hit && hit.dist > 0.01 && hit.dist < minDist) {
                            const dotCheck = (hit.x - p.x) * group.gravDir.x + (hit.y - p.y) * group.gravDir.y;
                            if (dotCheck > 0) { 
                                minDist = hit.dist;
                                
                                // ⭐ [핵심 수정] 교차점에서 벽의 법선(Normal) 방향으로 offset만큼 안쪽으로 밀어넣기
                                foundTarget = { 
                                    x: hit.x + w.nx * group.offset, 
                                    y: hit.y + w.ny * group.offset 
                                };
                            }
                        }
                    }
                });

                if (foundTarget) {
                    p.target = foundTarget;
                } else {
                    console.warn(`[LREBAR] ${group.id} 입자가 마주보는 피복면을 찾지 못했습니다.`);
                    p.state = "SETTLED";
                }
            });
            group.isTargeted = true; 
        }

        // ⭐ 2단계: 동력학적 이동 (Physics Move)
        let allSettled = true;

        group.particles.forEach(p => {
            if (p.state === "SETTLED") return;
            allSettled = false;

            if (p.target) {
                const dx = p.target.x - p.x;
                const dy = p.target.y - p.y;
                const err = Math.hypot(dx, dy);

                p.vx += dx * GRAVITY_K;
                p.vy += dy * GRAVITY_K;
                p.vx *= DAMPING;
                p.vy *= DAMPING;

                p.x += p.vx;
                p.y += p.vy;

                if (Math.abs(p.vx) + Math.abs(p.vy) < CONVERGE && err < 1.0) {
                    p.x = p.target.x;
                    p.y = p.target.y;
                    p.state = "SETTLED";
                }
            }
        });

        if (allSettled) {
            group.state = "SETTLED";
        }
    }
};
