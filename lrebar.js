// =========================================================================
// 🟦 PART: LONGITUDINAL REBAR ENGINE (lrebar.js) - v006
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

    // 파라미터로 이미 피복(cover) 처리가 완료된 coverWalls가 넘어옴
    step: (group, coverWalls) => {
        if (group.state === "SETTLED" || group.num === 0) return;

        // ⭐ 1단계: 생성 후 최초 1회만 타겟 탐색 (Pre-Targeting & Trajectory Offset)
        if (!group.isTargeted) {
            group.particles.forEach(p => {
                let minDist = Infinity;
                let foundTarget = null;

                // 1. 피복만큼 떨어진 선(coverWalls)들을 대상으로 탐색
                coverWalls.forEach(w => {
                    const dotNormal = group.gravDir.x * w.nx + group.gravDir.y * w.ny;

                    // 2. 철근 중력방향과 피복의 법선이 서로 반대(마주보는)인 놈만 필터링
                    if (dotNormal < -0.01) {
                        const hit = MathUtils.rayLineIntersect(
                            { x: p.x, y: p.y }, group.gravDir,
                            { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }
                        );

                        // 3. 가장 가까운 선 찾기
                        if (hit && hit.dist > 0.01 && hit.dist < minDist) {
                            const dotCheck = (hit.x - p.x) * group.gravDir.x + (hit.y - p.y) * group.gravDir.y;
                            if (dotCheck > 0) { 
                                minDist = hit.dist;
                                
                                // 4. 철근 반지름(dia/2) 보정 (궤적 역방향 오프셋)
                                // 피복은 이미 적용되어 있으므로 반지름만 처리. 
                                // 빗면(헌치)에서도 수직 궤적을 유지하기 위해 삼각비(dotNormal) 적용
                                let radiusOffset = group.dia / 2;
                                let travelOffset = radiusOffset / Math.abs(dotNormal); 
                                
                                // 찾은 교차점에서 낙하 궤적의 반대 방향으로 뒤로 물러남
                                foundTarget = { 
                                    x: hit.x - group.gravDir.x * travelOffset, 
                                    y: hit.y - group.gravDir.y * travelOffset 
                                };
                            }
                        }
                    }
                });

                if (foundTarget) {
                    p.target = foundTarget; // 찾은 최종 목적지를 파티클에 할당
                } else {
                    console.warn(`[LREBAR WARNING] ${group.id} 입자가 마주보는 피복면을 찾지 못했습니다. (x:${p.x.toFixed(1)}, y:${p.y.toFixed(1)})`);
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
