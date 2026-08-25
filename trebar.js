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
        // 조각의 방향을 뒤집는다(끝점 교환) — 기하는 그대로, 어느 끝이 코너에 붙는지만 바뀜
        const flip = (sg) => {
            let t = sg.p1; sg.p1 = sg.p2; sg.p2 = t;
            sg.uDir = { x: -sg.uDir.x, y: -sg.uDir.y };
        };
        for (let i = 0; i < this.segments.length - 1; i++) {
            let seg1 = this.segments[i];
            let seg2 = this.segments[i + 1];
            let corner = MathUtils.getLineIntersection(seg1.p1, seg1.p2, seg2.p1, seg2.p2);

            if (corner) {
                // 두 조각이 거의 평행하면 교점이 사실상 무한히 멀어진다(28km 짜리 철근이 나옴).
                // 그런 교점은 쓰지 않고 기존 방식(양쪽 자유단을 그대로 유지)으로 둔다.
                let farLimit = Math.max(seg1.initialLen, seg2.initialLen) * 6 + 2000;
                let dc1 = Math.min(MathUtils.hypot(corner.x - seg1.p1.x, corner.y - seg1.p1.y),
                                   MathUtils.hypot(corner.x - seg1.p2.x, corner.y - seg1.p2.y));
                let dc2 = Math.min(MathUtils.hypot(corner.x - seg2.p1.x, corner.y - seg2.p1.y),
                                   MathUtils.hypot(corner.x - seg2.p2.x, corner.y - seg2.p2.y));
                if (!isFinite(dc1) || !isFinite(dc2) || dc1 > farLimit || dc2 > farLimit) {
                    console.warn(`[SHAPE] ${this.id || '?'} 의 '${seg1.label}'-'${seg2.label}' 가 거의 평행해 ` +
                                 `교점이 너무 멀다(${Math.round(Math.max(dc1, dc2))}mm) — 코너 맞춤 생략`);
                    continue;
                }
                // 코너에는 '더 가까운 끝' 을 붙이고 먼 끝은 안착한 자리에 남긴다.
                //  항상 seg1.p2 / seg2.p1 을 쓰면, 코너가 반대쪽에 생긴 경우(웹에 안착한 다리 등)
                //  조각이 뒤집혀 사이각이 예각으로 계산된다.
                if (this.acute || this.obtuse) {
                    let d1a = MathUtils.hypot(corner.x - seg1.p1.x, corner.y - seg1.p1.y);
                    let d1b = MathUtils.hypot(corner.x - seg1.p2.x, corner.y - seg1.p2.y);
                    if (d1a < d1b) flip(seg1);
                    let d2a = MathUtils.hypot(corner.x - seg2.p1.x, corner.y - seg2.p1.y);
                    let d2b = MathUtils.hypot(corner.x - seg2.p2.x, corner.y - seg2.p2.y);
                    if (d2b < d2a) flip(seg2);
                }
                seg1.p2 = corner;
                seg2.p1 = corner;
            }
        }

        // 첫 조각의 자유단(시점)은 '안착한 그 자리' 를 그대로 쓴다. 코너까지의 길이는 결과값.
        //  예전에는 코너에서 입력길이만큼 되짚어 p1 을 다시 잡았는데, 그러면 코너가 안착 끝점보다
        //  멀 때 조각이 자기 직선을 따라 통째로 미끄러진다(헌치에 붙어 있던 다리가 헌치 끝을
        //  지나쳐 버림). 방향·피복은 유지돼도 배근 위치가 달라지므로 시점을 고정한다.
        if (this.segments.length > 0) {
            let first = this.segments[0];
            if (this.acute || this.obtuse) {
                first.initialLen = MathUtils.hypot(first.p2.x - first.p1.x, first.p2.y - first.p1.y);
            } else {
                let angF = Math.atan2(first.uDir.y, first.uDir.x);
                first.p1 = {
                    x: first.p2.x - Math.cos(angF) * first.initialLen,
                    y: first.p2.y - Math.sin(angF) * first.initialLen
                };
            }
        }

        if (this.segments.length > 1) {
            let last = this.segments[this.segments.length - 1];
            let dir = { x: last.uDir.x, y: last.uDir.y };

            // 마지막 조각은 코너에서 어느 쪽으로 뻗을지 두 방향 중 하나다(같은 직선 위).
            // obtuse 형상(15번)은 '내각이 둔각이 되는 쪽'을 고른다 — 예각 쪽으로 뻗으면
            // 카탈로그 형상과 반대로 접힌 철근이 된다.
            if ((this.obtuse || this.acute) && this.segments.length >= 2) {
                let prev = this.segments[this.segments.length - 2];
                // 코너에서 앞 조각(남아있는 자유단) 쪽 방향
                let inDir = { x: prev.p1.x - last.p1.x, y: prev.p1.y - last.p1.y };
                let iL = MathUtils.hypot(inDir.x, inDir.y) || 1;
                inDir = { x: inDir.x / iL, y: inDir.y / iL };
                let dotNow = inDir.x * dir.x + inDir.y * dir.y;       // >0 이면 내각 < 90°(예각)
                let wantAcute = !!this.acute;
                let isAcute = dotNow > 0;
                if (isAcute !== wantAcute) {                          // 요구와 다르면 반대쪽으로
                    dir = { x: -dir.x, y: -dir.y };
                    last.uDir = { x: dir.x, y: dir.y };
                    last.normal = { x: -last.normal.x, y: -last.normal.y };
                }
            }

            last.p2 = {
                x: last.p1.x + dir.x * last.initialLen,
                y: last.p1.y + dir.y * last.initialLen
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
        let r = this.buildSequential([A, B], -67.5, [135], [-1, -1], (pts) => pts[1]);
        r.acute = true;      // 두 다리 내각은 예각(<90°) — finalize 가 그 방향으로 마지막 조각을 뻗는다
        return r;
    }
}

// 15: 사이각 135° 둔각 V형 (좌우 대칭, 위로 벌어짐) — 각 다리가 수평과 22.5°
//     A 가 -22.5° 로 내려와 꺾임점에서 +45° 턴 → +22.5° 로 상승. 수직축 대칭.
class Shape15 extends TrebarBase {
    generate() {
        let A = this.dims.A || 400;
        let B = this.dims.B || 400;
        let r = this.buildSequential([A, B], -22.5, [45], [-1, -1], (pts) => pts[1]);
        r.obtuse = true;     // 두 다리 내각은 둔각(>90°) — finalize 가 그 방향으로 마지막 조각을 뻗는다
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
