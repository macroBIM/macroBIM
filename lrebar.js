// lrebar.js v002 - Physics-based Longitudinal Rebar Engine

class LRebarGroup {
    constructor(data) {
        this.id = data.id || "LREBAR";
        this.dia = Number(data.bar && data.bar.dia) || 16;
        this.state = "FITTING";
        this.particles = [];

        const init = data.init || {};
        const cx = Number(init.x) || 0;
        const cy = Number(init.y) || 0;
        const rotRad = (Number(init.rot) || 0) * Math.PI / 180;

        const range = data.range || {};
        const rb = Number(range.b) || 0;
        const re = Number(range.e) || 0;
        const totalLen = rb + re;

        const bar = data.bar || {};
        let num = bar.num ? Number(bar.num) : 0;
        let ctc = bar.ctc ? Number(bar.ctc) : 0;

        if (num >= 2) {
            ctc = totalLen / (num - 1);
        } else if (num === 1) {
            ctc = 0;
        } else if (ctc > 0) {
            num = Math.round(totalLen / ctc) + 1;
            ctc = num > 1 ? totalLen / (num - 1) : 0;
        }

        this.ctc = ctc;
        if (bar.max && ctc > bar.max) console.warn(`[LREBAR] ${this.id}: CTC ${ctc.toFixed(0)} > max ${bar.max}`);
        if (bar.min && ctc < bar.min) console.warn(`[LREBAR] ${this.id}: CTC ${ctc.toFixed(0)} < min ${bar.min}`);

        const gravDeg = (data.grav !== undefined) ? Number(data.grav) : -90;
        this.gravDir = {
            x: Math.cos(gravDeg * Math.PI / 180),
            y: Math.sin(gravDeg * Math.PI / 180)
        };

        const ux = Math.cos(rotRad);
        const uy = Math.sin(rotRad);
        const sx = cx - ux * rb;
        const sy = cy - uy * rb;

        for (let i = 0; i < num; i++) {
            const t = num > 1 ? i * ctc : totalLen / 2;
            this.particles.push({
                x: sx + ux * t,
                y: sy + uy * t,
                vx: 0, vy: 0,
                state: "FITTING"
            });
        }
    }
}

const LRebarEngine = {

    create: (data) => new LRebarGroup(data),

    step: (group, walls) => {
        if (group.state === "SETTLED") return;

        const { GRAVITY_K, DAMPING, CONVERGE } = CONFIG.PHYSICS;
        const coverWalls = Physics.buildCoverWalls(walls);
        let allSettled = true;

        group.particles.forEach(p => {
            if (p.state === "SETTLED") return;
            allSettled = false;

            let minDist = Infinity;
            let target = null;

            coverWalls.forEach(w => {
                const hit = MathUtils.rayLineIntersect(
                    { x: p.x, y: p.y },
                    group.gravDir,
                    { x: w.x1, y: w.y1 },
                    { x: w.x2, y: w.y2 }
                );
                if (hit && hit.dist > 0.1 && hit.dist < minDist) {
                    const dotCheck = (hit.x - p.x) * group.gravDir.x + (hit.y - p.y) * group.gravDir.y;
                    if (dotCheck > 0) {
                        minDist = hit.dist;
                        target = { x: hit.x, y: hit.y };
                    }
                }
            });

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
