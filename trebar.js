// trebar.js v000 (transverse rebar)

class TrebarBase {
    constructor(center, dims, rotation = 0, angs = null, nors = null, barEnds = null) {
        this.center = center;
        this.dims = dims || {};
        this.rotation = rotation;
        this.angs = angs || null;
        this.nors = nors || null;
        this.barEnds = barEnds || null;

        // 하위 호환: 기존 코드가 trebar.ends 를 참조해도 동작하도록 유지
        this.ends = this.barEnds;

        this.segments = [];
        this.state = "ASSEMBLING";
        this.debugPoints = [];
    }

    makeSeg(p1, p2, normal, initialState, label) {
        let nodes = [];
        CONFIG.PHYSICS.NODE_POS.forEach(ratio => {
            nodes.push({
                x: p1.x + (p2.x - p1.x) * ratio,
                y: p1.y + (p2.y - p1.y) * ratio,
                vx: 0,
                vy: 0
            });
        });

        let dx = p2.x - p1.x;
        let dy = p2.y - p1.y;
        let initialLen = MathUtils.hypot(dx, dy);
        let safeLen = initialLen > 1e-9 ? initialLen : 1;

        return {
            label: label,
            p1: { ...p1 },
            p2: { ...p2 },
            nodes: nodes,
            normal: { ...normal },
            initialLen: initialLen,
            uDir: { x: dx / safeLen, y: dy / safeLen },
            state: initialState,
            anchorWall: null,
            fitWall: null,
            contactWall: null
        };
    }

    applyRotation() {
        if (this.rotation === 0) return;

        this.segments.forEach(seg => {
            seg.p1 = geo_rotatePt2D(seg.p1, this.center, this.rotation);
            seg.p2 = geo_rotatePt2D(seg.p2, this.center, this.rotation);

            seg.nodes.forEach(node => {
                let rPos = geo_rotatePt2D(node, this.center, this.rotation);
                node.x = rPos.x;
                node.y = rPos.y;
            });

            let rNorm = geo_rotatePt2D(seg.normal, { x: 0, y: 0 }, this.rotation);
            seg.normal = rNorm;

            let dx = seg.p2.x - seg.p1.x;
            let dy = seg.p2.y - seg.p1.y;
            let len = MathUtils.hypot(dx, dy);
            if (len > 1e-9) {
                seg.uDir = { x: dx / len, y: dy / len };
            }
        });
    }

    buildSequential(lengths, initAngle, defaultAng, defaultNor, getAnchorPos) {
        const segKeys = ["A", "B", "C", "D", "E", "F", "G"];
        const angKeys = ["RA", "RB", "RC", "RD", "RE", "RF"];

        let angArray = defaultAng.map((def, i) => {
            return (this.angs && this.angs[angKeys[i]] !== undefined) ? this.angs[angKeys[i]] : def;
        });

        // nor 입력은 "형상 기본방향(defaultNor)에 대한 배수": +1(기본)=다이어그램 화살표 방향, -1=반대
        let norArray = defaultNor.map((def, i) => {
            let sign = (this.nors && this.nors[segKeys[i]] !== undefined) ? this.nors[segKeys[i]] : 1;
            return sign * def;
        });

        let pts = [{ x: 0, y: 0 }];
        let currentAngle = initAngle;

        for (let i = 0; i < lengths.length; i++) {
            if (i > 0) currentAngle += angArray[i - 1];
            let rad = currentAngle * Math.PI / 180;
            let prev = pts[i];
            pts.push({
                x: prev.x + lengths[i] * Math.cos(rad),
                y: prev.y + lengths[i] * Math.sin(rad)
            });
        }

        let anchor = getAnchorPos(pts);
        let dx = this.center.x - anchor.x;
        let dy = this.center.y - anchor.y;
        pts.forEach(p => {
            p.x += dx;
            p.y += dy;
        });

        this.segments = [];

        for (let i = 0; i < lengths.length; i++) {
            let p1 = pts[i];
            let p2 = pts[i + 1];
            let vx = p2.x - p1.x;
            let vy = p2.y - p1.y;
            let len = MathUtils.hypot(vx, vy);
            let safeLen = len > 1e-9 ? len : 1;
            let ux = vx / safeLen;
            let uy = vy / safeLen;

            let nSign = norArray[i];
            let nx = nSign === 1 ? -uy : uy;
            let ny = nSign === 1 ? ux : -ux;

            let state = (i === 0) ? "FITTING" : "WAITING";
            let segmentLabel = segKeys[i].toLowerCase();

            this.segments.push(this.makeSeg(p1, p2, { x: nx, y: ny }, state, segmentLabel));
        }

        this.applyRotation();
        return this;
    }

    finalize() {
        // 인접 조각의 코너를 서로의 직선 교점으로 맞춘다.
        //  ⚠ 교점이 두 조각의 안착 구간에서 크게 벗어나면(예: 완만한 헌치 + 수직 웹처럼
        //    두 면에 동시에 밀착할 수 없는 형상) 그 교점으로 끌고 가면 안 된다.
        //    안착한 조각이 자기 지지면 밖으로 밀려나 FIT 이 확장할 면을 잃기 때문.
        //    이 경우 각 조각은 제자리에 두고, 코너는 두 자유단의 중점으로 부드럽게 잇는다.
        for (let i = 0; i < this.segments.length - 1; i++) {
            let seg1 = this.segments[i];
            let seg2 = this.segments[i + 1];
            let corner = MathUtils.getLineIntersection(seg1.p1, seg1.p2, seg2.p1, seg2.p2);

            if (corner) {
                let pull1 = MathUtils.hypot(corner.x - seg1.p2.x, corner.y - seg1.p2.y);
                let pull2 = MathUtils.hypot(corner.x - seg2.p1.x, corner.y - seg2.p1.y);
                let limit = Math.max(seg1.initialLen, seg2.initialLen) * 0.5;
                if (pull1 <= limit && pull2 <= limit) {
                    seg1.p2 = corner;
                    seg2.p1 = corner;
                } else {
                    // 각 조각은 자기 안착 직선 위에 남긴다. 코너는 '덜 끌려가는 쪽'의 끝점을
                    // 그대로 쓰고, 반대쪽 조각만 그 점까지 자기 방향으로 이동시킨다.
                    //  · followFirst(15번)은 먼저 안착한 앞 조각이 기준 — 뒤 조각을 맞춘다.
                    //    (거리 비교로 고르면 a 가 자기 지지면에서 밀려나 배근이 어긋난다)
                    if (this.followFirst || pull1 <= pull2) {
                        let c = { x: seg1.p2.x, y: seg1.p2.y };            // seg1 유지
                        seg2.p1 = { x: c.x, y: c.y };
                        seg2.p2 = { x: c.x + seg2.uDir.x * seg2.initialLen, y: c.y + seg2.uDir.y * seg2.initialLen };
                        seg2.displaced = true;    // 코너를 맞추려 옮겨진 조각 — 안착면이 무의미해져 FIT 확장 금지
                    } else {
                        let c = { x: seg2.p1.x, y: seg2.p1.y };            // seg2 유지
                        seg1.p2 = { x: c.x, y: c.y };
                        seg1.p1 = { x: c.x - seg1.uDir.x * seg1.initialLen, y: c.y - seg1.uDir.y * seg1.initialLen };
                        seg1.displaced = true;
                    }
                }
            }
        }

        // 양 끝 조각의 자유단을 '입력 길이'로 되돌린다.
        //  ⚠ 자유단만 코너 기준으로 역산할 것 — 예전에는 p1/p2 를 통째로 다시 잡아
        //    이미 벽에 안착한 조각이 코너 쪽으로 통째로 끌려갔다(헌치에 붙었던 다리가
        //    헌치 밖으로 밀려나 FIT 이 확장할 지지면을 잃는 원인).
        //    코너(= 안착 직선끼리의 교점)는 유지되므로 조각은 자기 면 위에 남는다.
        if (this.segments.length > 1) {
            let first = this.segments[0];
            let angF = Math.atan2(first.uDir.y, first.uDir.x);
            first.p1 = {
                x: first.p2.x - Math.cos(angF) * first.initialLen,
                y: first.p2.y - Math.sin(angF) * first.initialLen
            };

            let last = this.segments[this.segments.length - 1];
            let angL = Math.atan2(last.uDir.y, last.uDir.x);
            last.p2 = {
                x: last.p1.x + Math.cos(angL) * last.initialLen,
                y: last.p1.y + Math.sin(angL) * last.initialLen
            };
        }
    }
}

// --- Shape 클래스들 ---
class Shape01 extends TrebarBase {
    generate() {
        let A = this.dims.A || 400;
        return this.buildSequential(
            [A],
            0,
            [],
            [1],
            (pts) => ({ x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 })
        );
    }
}

class Shape11 extends TrebarBase {
    generate() {
        let A = this.dims.A || 400;
        let B = this.dims.B || 400;
        return this.buildSequential([A, B], -90, [90], [-1, -1], (pts) => pts[1]);
    }
}

// 14: 사이각 45° 예각 V형 (좌우 대칭, 위로 벌어짐) — 각 다리가 수평과 67.5°
//     A 가 -67.5° 로 내려와 꺾임점에서 +135° 턴 → +67.5° 로 상승. 수직축 대칭.
class Shape14 extends TrebarBase {
    generate() {
        let A = this.dims.A || 400;
        let B = this.dims.B || 400;
        return this.buildSequential([A, B], -67.5, [135], [-1, -1], (pts) => pts[1]);
    }
}

// 15: 사이각 135° 둔각 V형 (좌우 대칭, 위로 벌어짐) — 각 다리가 수평과 22.5°
//     A 가 -22.5° 로 내려와 꺾임점에서 +45° 턴 → +22.5° 로 상승. 수직축 대칭.
class Shape15 extends TrebarBase {
    generate() {
        let A = this.dims.A || 400;
        let B = this.dims.B || 400;
        let r = this.buildSequential([A, B], -22.5, [45], [-1, -1], (pts) => pts[1]);
        r.followFirst = true;   // a 가 안착하며 움직인 만큼 b 의 '초기 위치'도 함께 옮긴다
        r.keepObtuse = true;    // 두 다리 사이각은 둔각(>90°) 유지
        r.segments[0].designTurnDeg = 135;   // 거의 펴졌을 때 되돌릴 기준 사이각
        return r;
    }
}

class Shape21 extends TrebarBase {
    generate() {
        let A = this.dims.A || 400;
        let B = this.dims.B || 400;
        let C = this.dims.C || 400;

        return this.buildSequential(
            [A, B, C],
            -90,
            [90, 90],
            [-1, -1, -1],
            (pts) => ({ x: pts[1].x + B / 2, y: pts[1].y })
        );
    }
}

class Shape41 extends TrebarBase {
    generate() {
        let A = this.dims.A || 400;
        let B = this.dims.B || 1000;
        let C = this.dims.C || 400;
        let D = this.dims.D || 1000;
        let E = this.dims.E || 400;

        return this.buildSequential(
            [A, B, C, D, E],
            0,
            [-90, 90, 90, -90],
            [1, -1, -1, -1, 1],
            (pts) => ({ x: pts[2].x + C / 2, y: pts[2].y })
        );
    }
}

// --- TrebarFactory ---
class TrebarFactory {
    static normalizeParams(data) {
        const normalized = {};
        Object.keys(data || {}).forEach(key => {
            normalized[key.toLowerCase()] = data[key];
        });
        return normalized;
    }

    static parseBarEnds(barEndsData) {
        if (!barEndsData) return null;

        const parsed = {};

        Object.keys(barEndsData).forEach(key => {
            const k = String(key).toLowerCase();
            const ruleObj = barEndsData[key];
            if (!ruleObj || typeof ruleObj !== "object") return;

            const commands = Object.keys(ruleObj);
            if (commands.length === 0) return;

            const command = commands[0];
            const val = Number(ruleObj[command]);

            const payload = {
                type: String(command).toUpperCase(),
                val: Number.isFinite(val) ? val : 0
            };

            if (k === "start" || k === "b") {
                parsed.start = payload;
            } else if (k === "end" || k === "e") {
                parsed.end = payload;
            }
        });

        return Object.keys(parsed).length > 0 ? parsed : null;
    }

    static create(code, center, dims, rotation = 0, angs = null, nors = null, barEnds = null) {
        let r = null;

        if (code === 1) r = new Shape01(center, dims, rotation, angs, nors, barEnds);
        else if (code === 11) r = new Shape11(center, dims, rotation, angs, nors, barEnds);
        else if (code === 14) r = new Shape14(center, dims, rotation, angs, nors, barEnds);
        else if (code === 15) r = new Shape15(center, dims, rotation, angs, nors, barEnds);
        else if (code === 21) r = new Shape21(center, dims, rotation, angs, nors, barEnds);
        else if (code === 41) r = new Shape41(center, dims, rotation, angs, nors, barEnds);

        return r ? r.generate() : null;
    }
}
