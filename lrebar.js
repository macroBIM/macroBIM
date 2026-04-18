// =========================================================================
// 🟦 PART: LONGITUDINAL REBAR ENGINE (lrebar.js) - v007
// =========================================================================

const GRAVITY_K = 0.08;
const DAMPING = 0.80;
const CONVERGE = 0.2;

class LRebarGroup {
    constructor(data) {
        this.id = data.id || "L_UNKNOWN";
        this.state = "FITTING";
        this.isTargeted = false; 

        const init = data.init || {};
        const cx = init.x || 0;
        const cy = init.y || 0;
        const rotDeg = init.rot || 0;
        const rotRad = rotDeg * Math.PI / 180;
        const gravSign = init.grav === -1 ? -1 : 1; 

        const range = data.range || { min: 0, max: 0 };
        const rMin = range.min || 0;
        const rMax = range.max || 0;
        const totalLen = rMax - rMin;

        const bar = data.bar || {};
        this.dia = bar.dia || 13;

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

        const ux = Math.cos(rotRad); 
        const uy = Math.sin(rotRad); 

        this.gravDir = {
            x: -uy * gravSign,
            y: ux * gravSign
        };

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

        if (!group.isTargeted) {
            group.particles.forEach(p => {
                let minDist = Infinity;
                let foundTarget = null;

                coverWalls.forEach(w => {
                    const dotNormal = group.gravDir.x * w.nx + group.gravDir.y * w.ny;

                    // ⭐ [복구 완료] 사용자님의 논리대로 부등호를 다시 < -0.01 (마주보는 면)로 되돌렸습니다!
                    // 이 조건 하나로 하부 상면(dot=1)은 통과하고 하부 하면(dot=-1)에 정착합니다.
                    if (dotNormal < -0.01) {
                        const hit = MathUtils.rayLineIntersect(
                            { x: p.x, y: p.y }, group.gravDir,
                            { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }
                        );

                        if (hit && hit.dist > 0.01 && hit.dist < minDist) {
                            const dotCheck = (hit.x - p.x) * group.gravDir.x + (hit.y - p.y) * group.gravDir.y;
                            if (dotCheck > 0) { 
                                minDist = hit.dist;
                                
                                let radiusOffset = group.dia / 2;
                                let travelOffset = radiusOffset / Math.abs(dotNormal); 
                                
                                foundTarget = { 
                                    x: hit.x - group.gravDir.x * travelOffset, 
                                    y: hit.y - group.gravDir.y * travelOffset 
                                };
                            }
                        }
                    }
                });

                if (foundTarget) {
                    p.target = foundTarget; 
                } else {
                    console.warn(`[LREBAR WARNING] ${group.id} 입자가 부딪힐 외곽 피복면을 찾지 못했습니다. (x:${p.x.toFixed(1)}, y:${p.y.toFixed(1)})`);
                    p.state = "SETTLED";
                }
            });
            group.isTargeted = true; 
        }

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
