// =========================================================================
// 🟦 PART: LONGITUDINAL REBAR ENGINE (lrebar.js) - v015
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

        this.path = Array.isArray(data.path) ? data.path.slice() : [];
        if (this.path.length === 0) {
            console.warn(`[LREBAR WARNING] ${this.id}: path가 비어있습니다. 타겟 벽체를 지정해주세요.`);
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

        const tCenter = (rMin + rMax) / 2;
        this.particles = [];
        for (let i = 0; i < num; i++) {
            this.particles.push({
                x: cx + ux * tCenter,
                y: cy + uy * tCenter,
                vx: 0, vy: 0,
                target: null,
                t: tCenter,
                state: "FITTING"
            });
        }
    }
}

const LRebarEngine = {
    create: (data) => new LRebarGroup(data),

    _filterPathCoverWalls: (group, coverWalls) => {
        if (!group.path || group.path.length === 0) return [];
        const pathSet = new Set(group.path);
        return coverWalls.filter(w => {
            const id = w.id || (w.origWall && w.origWall.id);
            return id && pathSet.has(id);
        });
    },

    _computePathTRange: (group, pathWalls) => {
        const cx = group.initData.x, cy = group.initData.y;
        const ux = group.ux, uy = group.uy;
        let tMin = Infinity, tMax = -Infinity;
        pathWalls.forEach(w => {
            const ow = w.origWall || w;
            const t1 = (ow.x1 - cx) * ux + (ow.y1 - cy) * uy;
            const t2 = (ow.x2 - cx) * ux + (ow.y2 - cy) * uy;
            if (t1 < tMin) tMin = t1;
            if (t1 > tMax) tMax = t1;
            if (t2 < tMin) tMin = t2;
            if (t2 > tMax) tMax = t2;
        });
        return { tMin, tMax };
    },

    _findTarget: (px, py, gravDir, dia, pathWalls) => {
        let minDist = Infinity;
        let foundTarget = null;
        pathWalls.forEach(w => {
            const dotNormal = gravDir.x * w.nx + gravDir.y * w.ny;
            if (dotNormal < -0.01) {
                const hit = MathUtils.rayLineIntersect(
                    { x: px, y: py }, gravDir,
                    { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }
                );
                if (hit && hit.dist > 0.01 && hit.dist < minDist) {
                    const dotCheck = (hit.x - px) * gravDir.x + (hit.y - py) * gravDir.y;
                    if (dotCheck > 0) {
                        const wx = hit.x - w.x1, wy = hit.y - w.y1;
                        const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
                        const gamma = (wx * dx + wy * dy) / (dx * dx + dy * dy);
                        if (gamma < 0 || gamma > 1) return;
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

    _distributeOnPath: (group, pathRange, pathWalls) => {
        const particles = group.particles;
        const n = particles.length;
        if (n === 0) return;

        const cx = group.initData.x, cy = group.initData.y;
        const ux = group.ux, uy = group.uy;
        const rMin = group.rangeData.min;
        const rMax = group.rangeData.max;
        const ctc = group.ctc;
        const minCtc = group.minCtc;
        const { tMin, tMax } = pathRange;

        const setParticleT = (p, t) => {
            p.t = t;
            p.x = cx + ux * t;
            p.y = cy + uy * t;
            p.target = LRebarEngine._findTarget(p.x, p.y, group.gravDir, group.dia, pathWalls);
        };

        for (let i = 0; i < n; i++) {
            let t = (n === 1) ? (rMin + rMax) / 2 : rMin + (i * ctc);
            setParticleT(particles[i], t);
        }

        if (particles[0].t < tMin) setParticleT(particles[0], tMin);
        if (particles[n - 1].t > tMax) setParticleT(particles[n - 1], tMax);

        if (minCtc > 0 && n >= 2) {
            for (let i = n - 2; i >= 0; i--) {
                if (particles[i + 1].t - particles[i].t < minCtc - 0.1) {
                    setParticleT(particles[i], particles[i + 1].t - minCtc);
                }
            }
            for (let i = 1; i < n; i++) {
                if (particles[i].t - particles[i - 1].t < minCtc - 0.1) {
                    setParticleT(particles[i], particles[i - 1].t + minCtc);
                }
            }
        }
    },

    step: (group, coverWalls) => {
        if (group.state === "SETTLED" || group.num === 0) return;

        if (group.state === "FITTING") {
            if (!group.isTargeted) {
                const pathWalls = LRebarEngine._filterPathCoverWalls(group, coverWalls);
                if (pathWalls.length === 0) {
                    console.warn(`[LREBAR] ${group.id}: path 벽체를 coverWalls에서 찾을 수 없습니다. (path: ${JSON.stringify(group.path)})`);
                    group.state = "SETTLED";
                    return;
                }
                group._pathWalls = pathWalls;

                group.particles.forEach(p => {
                    p.target = LRebarEngine._findTarget(p.x, p.y, group.gravDir, group.dia, pathWalls);
                });

                group.particles.forEach(p => {
                    if (!p.target) {
                        console.warn(`[LREBAR] ${group.id}: 파티클이 path 타겟을 찾지 못했습니다. (x:${p.x.toFixed(1)}, y:${p.y.toFixed(1)})`);
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
                group.state = "DISTRIBUTING";
                const pathRange = LRebarEngine._computePathTRange(group, group._pathWalls);
                LRebarEngine._distributeOnPath(group, pathRange, group._pathWalls);

                group.particles.forEach(p => {
                    if (!p.target) {
                        console.warn(`[LREBAR] ${group.id}: 분배 후 타겟 없음. (t:${p.t.toFixed(1)})`);
                    }
                    p.state = "FITTING";
                    p.vx = 0;
                    p.vy = 0;
                });
            }
        } else if (group.state === "DISTRIBUTING") {
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
    }
};
