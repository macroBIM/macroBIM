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

// 11a : 11 의 거울상. 11 은 세로 다리 a 가 **왼쪽**에 서고 b 가 오른쪽으로 가는데,
//     이것은 a 가 **오른쪽**에 서고 b 가 왼쪽으로 간다.
//     **회전으로는 이 꼴이 안 나온다** — 11 을 돌리면 (↓→)(→↑)(↑←)(←↓) 네 짝만
//     나오고 (↓←) 는 그 안에 없다. 거울상은 회전이 아니다. 23 · 23a 와 같은 이유다.
//     법선은 23a 와 같은 근거로 **바깥쪽**이어야 한다 : 세로축 대칭이므로 a 의 법선은
//     왼쪽 → 오른쪽으로 뒤집히고, b 의 법선(아래)은 그대로다.
class Shape11M extends TrebarBase {
    generate() {
        let A = this.dims.A || 400;
        let B = this.dims.B || 400;
        return this.buildSequential([A, B], -90, [-90], [1, 1], (pts) => pts[1]);
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

/*  21a : ∩ — **굽는 모양은 21 과 같고, 콘크리트가 정하는 쪽이 다르다.**
 *
 *  재서 확인한 것부터 : 같은 공장에 넣으면 둘은 **같은 철근**으로 나온다.
 *      21  rot 180  A150 B500 C150  →  a 150세로 · b 500가로 · c 150세로   (ㄷ · 복부)
 *      21  rot 180  A660 B387 C660  →  a 660세로 · b 387가로 · c 660세로   (∩ · 하부)
 *  조각 수도 방향도 같고 **치수 비율만** 다르다. 그래서 가공표에는 둘 다 BS 8666 의
 *  21 로 나가야 한다 — `fabCode` 가 그것이다. 같은 모양으로 굽는 철근을 집계에서
 *  두 줄로 쪼개면 그건 틀린 표다.
 *
 *  그런데 **엔진에서는 한 가지를 뜻하지 않는다.** 같은 `21 · rot 180` 인데
 *      ㄷ  몸통 B 가 면에서 면 → 늘어나는 것이 **몸통**, 적는 것은 다리(`leg`)
 *      ∩  다리 A·C 가 면에서 면 → 늘어나는 것이 **다리**, 적는 것은 몸통(`body`)
 *  이고, 여기서 열차 방향·짝 규칙·띠·안착하는 끝이 **전부** 갈린다. 그 갈림을
 *  「어느 칸이 채워졌나」로 눈치채게 두었더니 시트를 읽어서는 알 수가 없었다.
 *  그래서 **코드가 말하게** 한다 : `21a` 면 ∩ 다.
 *
 *  기본 치수를 21 과 다르게 두는 까닭은 Shape Codes 카드 때문이다. 카드는 손으로
 *  그린 그림이 아니라 이 공장에서 기본 치수로 뜬 것이라, 400/400/400 으로 두면
 *  21 과 **똑같은 그림**이 두 장 걸린다. 다리를 길게·몸통을 짧게 두면 카드가
 *  곧바로 「무엇이 늘어나는 쪽인가」를 말한다.                                  */
class Shape21Cap extends TrebarBase {
    generate() {
        let A = this.dims.A || 620;
        let B = this.dims.B || 300;
        let C = this.dims.C || 620;

        let r = this.buildSequential(
            [A, B, C],
            -90,
            [90, 90],
            [-1, -1, -1],
            (pts) => ({ x: pts[1].x + B / 2, y: pts[1].y })
        );
        r.cap = true;          //  ∩ — 면에서 면인 것이 «다리» 다 (엔진이 이것으로 가른다)
        r.fabCode = 21;        //  가공표에는 21 로 나간다 — 21 과 같은 모양으로 굽는다
        return r;
    }
}

// 23: Z(크랭크). BS 8666 의 A + B + (C).
//     21 과 조각 수는 같지만 **A 와 C 가 B 의 반대쪽에 선다** — 21 은 같은 쪽(ㄷ)이다.
//     A 가 -90 으로 내려와 +90 턴 → B 수평, 다시 -90 턴 → C 가 내려간다.
//     법선도 A 와 C 가 서로 반대다. 크랭크는 **마주보는 두 면을 하나가 건너 무는** 철근이라,
//     21 처럼 세 법선을 같은 쪽으로 두면 C 가 제 벽을 영영 못 찾는다.
class Shape23 extends TrebarBase {
    generate() {
        let A = this.dims.A || 400;
        let B = this.dims.B || 400;
        let C = this.dims.C || 400;

        return this.buildSequential(
            [A, B, C],
            -90,
            [90, -90],
            [-1, -1, 1],
            (pts) => ({ x: pts[1].x + B / 2, y: pts[1].y })
        );
    }
}

// 23-1 : 23 의 거울상. 23 은 시작·끝 조각이 (위 · 아래) 인데 이것은 (아래 · 위) 다.
//     **회전만으로는 이 꼴이 안 나온다** — 코드 23 의 네 rot 이 주는 짝은
//     (위·아래)(왼·오)(아래·위)... 처럼 보이지만, 돌리면 몸통 방향까지 같이 돌아간다.
//     몸통을 수평으로 둔 채 두 다리만 뒤집으려면 형상 자체가 하나 더 있어야 한다.
//     A 가 +90 으로 올라가고 -90 턴 → B 수평, 다시 +90 턴 → C 가 올라간다.
class Shape23M extends TrebarBase {
    generate() {
        let A = this.dims.A || 400;
        let B = this.dims.B || 400;
        let C = this.dims.C || 400;

        //  nors 는 23 과 **같은 바깥 방향**이어야 한다.
        //    a 는 왼쪽 세로다 → 법선은 왼쪽(바깥)
        //    c 는 오른쪽 세로다 → 법선은 오른쪽(바깥)
        //  [-1,-1,1] 로 두었더니 둘 다 **몸통 쪽(안쪽)** 을 봤다. 다리는 바깥 면에
        //  안기는 것이라 안쪽을 보면 제 면을 영영 못 찾는다 — 23 을 위아래로
        //  뒤집으면 세로 방향(x)은 그대로이므로 법선도 23 과 같아야 맞는다.
        return this.buildSequential(
            [A, B, C],
            90,
            [-90, 90],
            [1, -1, -1],
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

    /*  「23a」 처럼 가지가 붙은 코드를 숫자 하나로 바꾼다 : '23a' → 23.1, '11a' → 11.1
        엑셀에는 도면 그대로 적고, 엔진 안에서는 숫자로 다룬다. a→.1, b→.2 …
        옛 표기 '23-1' 도 그대로 읽는다 — 이미 적어 둔 시트가 **조용히 죽지 않게**
        해야 한다. 못 읽는 코드는 형상이 null 이 되어 철근 한 개가 그냥 사라진다
        (예전에 '23-1' 이 표에서 22 로 계산돼 실제로 한 개가 사라졌다).           */
    static normCode(v) {
        const s = String(v == null ? '' : v).trim();
        const m = s.match(/^(\d+)\s*([a-zA-Z])$/);
        if (m) return Number(m[1]) + (m[2].toLowerCase().charCodeAt(0) - 96) / 10;
        const old = s.match(/^(\d+)\s*-\s*(\d+)$/);          // 옛 표기
        if (old) return Number(old[1]) + Number(old[2]) / 10;
        return Number(s);
    }

    static create(code, center, dims, rotation = 0, angs = null, nors = null, barEnds = null) {
        let r = null;
        code = TrebarFactory.normCode(code);

        if (code === 1) r = new Shape01(center, dims, rotation, angs, nors, barEnds);
        else if (code === 11) r = new Shape11(center, dims, rotation, angs, nors, barEnds);
        else if (code === 11.1) r = new Shape11M(center, dims, rotation, angs, nors, barEnds);
        else if (code === 14) r = new Shape14(center, dims, rotation, angs, nors, barEnds);
        else if (code === 15) r = new Shape15(center, dims, rotation, angs, nors, barEnds);
        else if (code === 21) r = new Shape21(center, dims, rotation, angs, nors, barEnds);
        else if (code === 21.1) r = new Shape21Cap(center, dims, rotation, angs, nors, barEnds);
        else if (code === 23) r = new Shape23(center, dims, rotation, angs, nors, barEnds);
        else if (code === 23.1) r = new Shape23M(center, dims, rotation, angs, nors, barEnds);
        else if (code === 41) r = new Shape41(center, dims, rotation, angs, nors, barEnds);

        return r ? r.generate() : null;
    }
}
