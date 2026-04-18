// =========================================================================
// 🟦 PART: LONGITUDINAL REBAR ENGINE (lrebar.js) - v008
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

        this.gravDir = { x: -uy * gravSign, y: ux * gravSign };
        this.initData = { x: cx, y: cy, rot: rotDeg, grav: gravSign };
        this.rangeData = { min: rMin, max: rMax };
        this.ux = ux;
        this.uy = uy;
        this.minCtc = (bar.min !== undefined) ? bar.min : 0;
        this.ctc = ctc;

        this.particles = [];
        for (let i = 0; i < num; i++) {
            let t = (num === 1) ? (rMin + rMax) / 2 : rMin + (i * ctc);
            this.particles.push({
                x: cx + ux * t,
                y: cy + uy * t,
                vx: 0, vy: 0,
                target: null,
                t: t,
                state: "FITTING"
            });
        }
    }
}

const LRebarEngine = {
    create: (data) => new LRebarGroup(data),

    _findTarget: (px, py, gravDir, dia, coverWalls) => {
        let minDist = Infinity;
        let foundTarget = null;
        coverWalls.forEach(w => {
            const dotNormal = gravDir.x * w.nx + gravDir.y * w.ny;
            if (dotNormal < -0.01) {
                const hit = MathUtils.rayLineIntersect(
                    { x: px, y: py }, gravDir,
                    { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }
                );
                if (hit && hit.dist > 0.01 && hit.dist < minDist) {
                    const dotCheck = (hit.x - px) * gravDir.x + (hit.y - py) * gravDir.y;
                    if (dotCheck > 0) {
                        minDist = hit.dist;
                        let travelOffset = (dia / 2) / Math.abs(dotNormal);
                        foundTarget = {
                            x: hit.x - gravDir.x * travelOffset,
                            y: hit.y - gravDir.y * travelOffset
                        };
                    }
                }
            }
        });
        return foundTarget;
    },

    _hasValidTarget: (px, py, gravDir, coverWalls) => {
        let found = false;
        coverWalls.forEach(w => {
            if (found) return;
            const dotNormal = gravDir.x * w.nx + gravDir.y * w.ny;
            if (dotNormal < -0.01) {
                const hit = MathUtils.rayLineIntersect(
                    { x: px, y: py }, gravDir,
                    { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }
                );
                if (hit && hit.dist > 0.01) {
                    const dotCheck = (hit.x - px) * gravDir.x + (hit.y - py) * gravDir.y;
                    if (dotCheck > 0) found = true;
                }
            }
        });
        return found;
    },

    _findBoundaryT: (group, tInvalid, tValid, coverWalls) => {
        let lo = tInvalid, hi = tValid;
        const cx = group.initData.x, cy = group.initData.y;
        const ux = group.ux, uy = group.uy;

        for (let i = 0; i < 15; i++) {
            let mid = (lo + hi) / 2;
            if (LRebarEngine._hasValidTarget(cx + ux * mid, cy + uy * mid, group.gravDir, coverWalls)) {
                hi = mid;
            } else {
                lo = mid;
            }
        }
        return hi;
    },

    _clampAndSpace: (group, coverWalls) => {
        const particles = group.particles;
        const n = particles.length;
        if (n < 2) return;

        const cx = group.initData.x, cy = group.initData.y;
        const ux = group.ux, uy = group.uy;
        const minCtc = group.minCtc;

        let firstValidIdx = -1;
        for (let i = 0; i < n; i++) {
            if (particles[i].target) { firstValidIdx = i; break; }
        }
        if (firstValidIdx === -1) return;

        let lastValidIdx = -1;
        for (let i = n - 1; i >= 0; i--) {
            if (particles[i].target) { lastValidIdx = i; break; }
        }

        const setParticleT = (p, t) => {
            p.t = t;
            p.x = cx + ux * t;
            p.y = cy + uy * t;
            p.target = LRebarEngine._findTarget(p.x, p.y, group.gravDir, group.dia, coverWalls);
        };

        if (firstValidIdx > 0) {
            let boundaryT = LRebarEngine._findBoundaryT(group, particles[0].t, particles[firstValidIdx].t, coverWalls);
            for (let i = 0; i < firstValidIdx; i++) setParticleT(particles[i], boundaryT);
        }

        if (lastValidIdx < n - 1) {
            let boundaryT = LRebarEngine._findBoundaryT(group, particles[n - 1].t, particles[lastValidIdx].t, coverWalls);
            for (let i = n - 1; i > lastValidIdx; i--) setParticleT(particles[i], boundaryT);
        }

        if (minCtc > 0) {
            for (let i = 1; i < n; i++) {
                if (particles[i].t - particles[i - 1].t < minCtc - 0.1) {
                    setParticleT(particles[i], particles[i - 1].t + minCtc);
                }
            }
            for (let i = n - 2; i >= 0; i--) {
                if (particles[i + 1].t - particles[i].t < minCtc - 0.1) {
                    setParticleT(particles[i], particles[i + 1].t - minCtc);
                }
            }
        }
    },

    step: (group, coverWalls) => {
        if (group.state === "SETTLED" || group.num === 0) return;

        if (!group.isTargeted) {
            group.particles.forEach(p => {
                p.target = LRebarEngine._findTarget(p.x, p.y, group.gravDir, group.dia, coverWalls);
            });

            LRebarEngine._clampAndSpace(group, coverWalls);

            group.particles.forEach(p => {
                if (!p.target) {
                    console.warn(`[LREBAR] ${group.id}: 파티클이 피복면을 찾지 못했습니다. (x:${p.x.toFixed(1)}, y:${p.y.toFixed(1)})`);
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

        if (allSettled) group.state = "SETTLED";
    }
};
