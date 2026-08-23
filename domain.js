// =========================================================================
// 🟦 PART 1: DOMAIN LOGIC (domain.js)  v004
// =========================================================================

const CONFIG = {
    TBEAM: { H: 600, W: 800, tf: 150, tc: 100, twt: 300, twb: 250, corners: { TT: "C20", TH: "F80", BT: "F30" } },
    COVER: 50,
    PHYSICS: { GRAVITY_K: 0.08, DAMPING: 0.80, CONVERGE: 0.2, NODE_POS: [0.4, 0.6] }
};

const PARAMS = {
    WEB_X: 2000,
    BOTTOM_Y: -1800,
    CANT_X: 4800,
    CANT_Y: -100,
    COVER: 50
};

const Domain = {
    // 사용자가 외부에서 주입할 데이터 저장소
    USER_BOX_DATA: null,
    USER_REBAR_DATA: null,   // ⭐ 통합 입력 (type: "trebar"|"lrebar")
    USER_TREBAR_DATA: null,  // (레거시) 횡방향 전용 배열
    USER_LREBAR_DATA: null,  // (레거시) 종방향 전용 배열

    currentSection: null,
    trebarList: [],
    lrebarList: [],
    queue: [],               // ⭐ 통합 처리 큐: [{kind:"trebar"|"lrebar", obj}, ...]
    activeQueueIndex: 0,
    isPaused: false,
    wallStack: {},           // ⭐ 벽 id별 누적 적층 두께 (mm)

    togglePause: () => {
        Domain.isPaused = !Domain.isPaused;
        const btn = document.getElementById("btnPause");
        if(btn) btn.innerHTML = Domain.isPaused ? "▶ Start" : "⏸ Pause";
    },

    // ─────────────────────────────────────────────────────────
    // 입력 데이터 → trebar 객체 변환
    // ─────────────────────────────────────────────────────────
    _createTrebarFromData: (rawData) => {
        const data = {};
        Object.keys(rawData).forEach(k => data[k.toLowerCase()] = rawData[k]);

        ['angs', 'nors'].forEach(prop => {
            if (data[prop]) {
                const upperObj = {};
                Object.keys(data[prop]).forEach(innerKey => upperObj[innerKey.toUpperCase()] = data[prop][innerKey]);
                data[prop] = upperObj;
            }
        });

        let safeDims = {};
        let anchorSegKey = 'A';
        let targetSetId = null;
        let ignoredSetKeys = [];

        if (data.segs) {
            Object.keys(data.segs).forEach(k => {
                let segKey = k.toUpperCase();
                let segProps = data.segs[k];
                if (!segProps || typeof segProps !== 'object') return;
                if (segProps.len !== undefined) safeDims[segKey] = segProps.len;
                if (segProps.set) {
                    if (!targetSetId) { anchorSegKey = segKey; targetSetId = segProps.set; }
                    else { ignoredSetKeys.push(segKey); }
                }
            });
            if (ignoredSetKeys.length > 0) {
                console.warn(`[SET IGNORE] ${data.id || 'UNKNOWN'} 에서 set이 여러 개 입력. 첫 번째('${anchorSegKey}')만 사용, [${ignoredSetKeys.join(', ')}] 무시.`);
            }
        } else if (data.dims) {
            safeDims = data.dims;
        }

        let finalBarEnds = null;
        let rawBarEnds = data.barends || data.ends;
        if (rawBarEnds) {
            finalBarEnds = {};
            Object.keys(rawBarEnds).forEach(k => {
                let key = k.toLowerCase();
                let rule = rawBarEnds[k];
                if (!rule) return;
                let mode = Object.keys(rule)[0];
                if (!mode) return;
                if (key === 'start' || key === 'b') {
                    finalBarEnds.start = { type: mode.toUpperCase(), val: Number(rule[mode]) };
                } else if (key === 'end' || key === 'e') {
                    finalBarEnds.end = { type: mode.toUpperCase(), val: Number(rule[mode]) };
                }
            });
            if (Object.keys(finalBarEnds).length === 0) finalBarEnds = null;
        }

        let actualDims = EquationParser.evalDims(safeDims, PARAMS);
        let initData = data.init || {};
        let rawX = initData.x !== undefined ? initData.x : data.x;
        let rawY = initData.y !== undefined ? initData.y : data.y;
        let rawRot = initData.rot !== undefined ? initData.rot : data.rot;

        let startX = 0, startY = 0, rot = 0;
        let targetWall = null;

        if (targetSetId) {
            targetWall = Domain.currentSection.walls.find(w => w.id === targetSetId.toUpperCase());
            if (!targetWall) {
                startX = EquationParser.eval(rawX, PARAMS) || 0;
                startY = EquationParser.eval(rawY, PARAMS) || 0;
                rot = EquationParser.eval(rawRot, PARAMS) || 0;
            }
        } else {
            startX = EquationParser.eval(rawX, PARAMS) || 0;
            startY = EquationParser.eval(rawY, PARAMS) || 0;
            rot = EquationParser.eval(rawRot, PARAMS) || 0;
        }

        let rb = TrebarFactory.create(data.code, { x: startX, y: startY }, actualDims || {}, rot, data.angs, data.nors, finalBarEnds);
        if (!rb) return null;

        rb.id = data.id;
        rb.dia = data.dia || 13;

        if (targetWall) {
            let segIndex = anchorSegKey.charCodeAt(0) - 65;
            if (segIndex < 0 || segIndex >= rb.segments.length) segIndex = 0;
            let tSeg = rb.segments[segIndex];

            let wx = targetWall.x2 - targetWall.x1;
            let wy = targetWall.y2 - targetWall.y1;
            let wallAng = Math.atan2(wy, wx);
            let sx = tSeg.p2.x - tSeg.p1.x;
            let sy = tSeg.p2.y - tSeg.p1.y;
            let segAng = Math.atan2(sy, sx);

            let extraRot = Number(rawRot) || 0;
            let deltaAng = wallAng - segAng + (extraRot * Math.PI / 180);
            let cosA = Math.cos(deltaAng);
            let sinA = Math.sin(deltaAng);

            const rotatePt = (p) => {
                let nx = p.x * cosA - p.y * sinA;
                let ny = p.x * sinA + p.y * cosA;
                p.x = nx; p.y = ny;
            };
            const rotateVec = (v) => {
                let nx = v.x * cosA - v.y * sinA;
                let ny = v.x * sinA + v.y * cosA;
                v.x = nx; v.y = ny;
            };

            rb.segments.forEach(s => {
                rotatePt(s.p1); rotatePt(s.p2);
                s.nodes.forEach(n => rotatePt(n));
                rotateVec(s.normal); rotateVec(s.uDir);
            });

            let cx = (tSeg.p1.x + tSeg.p2.x) / 2;
            let cy = (tSeg.p1.y + tSeg.p2.y) / 2;
            let cType = targetWall.tag ? targetWall.tag.toLowerCase() : 'outer';
            let coverVal = Domain.currentSection.covers[cType] || 50;
            // ⭐ set anchor도 wallStack 반영 (이전 적층 위로 spawn)
            let stackOffset = Physics.stackAt(Domain.wallStack, targetWall,
                (targetWall.x1 + targetWall.x2) / 2, (targetWall.y1 + targetWall.y2) / 2);
            let spawnDist = coverVal + stackOffset + (rb.dia || 0) / 2;

            let tcx = ((targetWall.x1 + targetWall.x2) / 2) + (targetWall.nx * spawnDist);
            let tcy = ((targetWall.y1 + targetWall.y2) / 2) + (targetWall.ny * spawnDist);
            let tx = tcx - cx;
            let ty = tcy - cy;

            rb.segments.forEach(s => {
                s.p1.x += tx; s.p1.y += ty;
                s.p2.x += tx; s.p2.y += ty;
                s.nodes.forEach(n => { n.x += tx; n.y += ty; });
            });

            tSeg.anchorWall = targetWall;
            tSeg.fitWall = targetWall;
            tSeg.contactWall = targetWall;

            rb.segments.forEach((s, index) => {
                s.state = (index === segIndex) ? "SETTLED" : "WAITING";
            });

            console.log(`[🎯 SET] ${rb.id} 횡방향 철근의 '${anchorSegKey}' 구간이 ${targetWall.id} 벽체에 닻을 내렸습니다.`);
        }

        return rb;
    },

    // ─────────────────────────────────────────────────────────
    // 입력 데이터 → lrebar group 변환
    // ─────────────────────────────────────────────────────────
    _createLrebarFromData: (rawData) => {
        const data = { ...rawData };
        if (data.init) {
            data.init = {
                x: EquationParser.eval(data.init.x, PARAMS) || 0,
                y: EquationParser.eval(data.init.y, PARAMS) || 0,
                rot: EquationParser.eval(data.init.rot, PARAMS) || 0,
                grav: data.init.grav
            };
        }
        return LRebarEngine.create(data);
    },

    // ─────────────────────────────────────────────────────────
    // 입력 배열 정규화 — 통합 USER_REBAR_DATA 우선, 없으면 레거시
    // ─────────────────────────────────────────────────────────
    _resolveInputList: () => {
        if (Array.isArray(Domain.USER_REBAR_DATA) && Domain.USER_REBAR_DATA.length > 0) {
            return Domain.USER_REBAR_DATA;
        }
        const list = [];
        if (Array.isArray(Domain.USER_TREBAR_DATA)) {
            Domain.USER_TREBAR_DATA.forEach(d => list.push({ ...d, type: "trebar" }));
        }
        if (Array.isArray(Domain.USER_LREBAR_DATA)) {
            Domain.USER_LREBAR_DATA.forEach(d => list.push({ ...d, type: "lrebar" }));
        }
        return list;
    },

    buildModel: (secType) => {
        Domain.currentSection = null;
        Domain.trebarList = [];
        Domain.lrebarList = [];
        Domain.queue = [];
        Domain.activeQueueIndex = 0;
        Domain.isPaused = false;
        Domain.wallStack = {};

        if (secType === "TBEAM") {
            Domain.currentSection = new TBeam(0, 0, CONFIG.TBEAM);
            Domain.currentSection.generate();
        } else {
            Domain.currentSection = new BoxGirder(0, 0, null);
            Domain.currentSection.generate(Domain.USER_BOX_DATA);
        }

        if (secType !== "BOXGIRDER") return;

        const inputList = Domain._resolveInputList();
        inputList.forEach(rawData => {
            const type = String(rawData.type || "trebar").toLowerCase();
            if (type === "trebar") {
                const rb = Domain._createTrebarFromData(rawData);
                if (rb) {
                    Domain.trebarList.push(rb);
                    Domain.queue.push({ kind: "trebar", obj: rb });
                }
            } else if (type === "lrebar") {
                if (typeof LRebarEngine === 'undefined') return;
                const group = Domain._createLrebarFromData(rawData);
                Domain.lrebarList.push(group);
                Domain.queue.push({ kind: "lrebar", obj: group });
            }
        });
    },

    // ─────────────────────────────────────────────────────────
    // 통합 큐 순차 처리
    // ─────────────────────────────────────────────────────────
    stepPhysics: () => {
        if (Domain.isPaused) return;
        if (Domain.activeQueueIndex >= Domain.queue.length) return;

        const item = Domain.queue[Domain.activeQueueIndex];

        if (item.kind === "trebar") {
            const trebar = item.obj;
            Physics.updatePhysics(trebar, Domain.currentSection.walls, Domain.wallStack);
            if (trebar.state === "FORMED") {
                const spanMap = Domain._collectTrebarWalls(trebar);
                // 적층 진단 로그 — 세그별 안착 벽 + 벽별 적층 구간
                const segInfo = trebar.segments.map(s => {
                    const w = s.fitWall || s.anchorWall || s.contactWall;
                    return s.label + '=' + ((w && w.id) || '?');
                }).join(', ');
                Domain._accumulateStack(trebar.dia || 0, spanMap);
                const stackInfo = Object.keys(spanMap).map(id =>
                    id + '[' + spanMap[id].spans.map(sp => Math.round(sp[0]) + '~' + Math.round(sp[1])).join(',') + ']'
                ).join(', ');
                console.log('[STACK] ' + (trebar.id || '?') + ' (dia ' + (trebar.dia || 0) + ') 세그[' + segInfo + '] → 구간적층 {' + stackInfo + '}');
                Domain.activeQueueIndex++;
            }
        } else if (item.kind === "lrebar") {
            const group = item.obj;
            const coverWalls = Physics.buildCoverWalls(Domain.currentSection.walls);
            LRebarEngine.step(group, coverWalls, Domain.wallStack);
            if (group.state === "SETTLED") {
                Domain._accumulateStack(group.dia || 0, Domain._collectLrebarWalls(group));
                Domain.activeQueueIndex++;
            }
        }
    },

    // 철근이 실제로 얹힌 벽 + 그 벽 위의 축방향 구간(세그먼트 투영) 수집
    //  · fitWall/nodeWalls/spanWalls 모두 등록 (크라운 분할 하면의 양쪽 포함)
    //  · 구간 단위라, 같은 벽의 서로 다른 영역에 있는 철근끼리는 적층되지 않음
    _collectTrebarWalls: (trebar) => {
        const map = {};   // id → { wall, spans: [[lo, hi], ...] }
        const wallById = {};
        ((Domain.currentSection && Domain.currentSection.walls) || []).forEach(w => { if (w.id) wallById[w.id] = w; });
        const addSpan = (wall, seg) => {
            if (!wall || !wall.id || !seg || !seg.p1 || !seg.p2) return;
            const orig = wallById[wall.id] || wall;
            const dx = orig.x2 - orig.x1, dy = orig.y2 - orig.y1;
            const L = MathUtils.hypot(dx, dy) || 1;
            const t1 = ((seg.p1.x - orig.x1) * dx + (seg.p1.y - orig.y1) * dy) / L;
            const t2 = ((seg.p2.x - orig.x1) * dx + (seg.p2.y - orig.y1) * dy) / L;
            const lo = Math.max(0, Math.min(t1, t2)), hi = Math.min(L, Math.max(t1, t2));
            if (hi <= lo + 0.5) return;
            if (!map[orig.id]) map[orig.id] = { wall: orig, spans: [] };
            map[orig.id].spans.push([lo, hi]);
        };
        trebar.segments.forEach(seg => {
            addSpan(seg.fitWall || seg.anchorWall || seg.contactWall, seg);
            (seg.nodeWalls || []).forEach(nw => addSpan(nw, seg));
            (seg.spanWalls || []).forEach(id => addSpan(wallById[id], seg));
        });
        return map;
    },

    _collectLrebarWalls: (group) => {
        const map = {};   // 종방향은 경로 벽 전체 구간에 적층 (기존 동작 유지)
        const pathWalls = group._pathWalls || [];
        pathWalls.forEach(w => {
            const orig = w.origWall || w;
            if (!orig.id) return;
            const L = MathUtils.hypot(orig.x2 - orig.x1, orig.y2 - orig.y1) || 1;
            if (!map[orig.id]) map[orig.id] = { wall: orig, spans: [] };
            map[orig.id].spans.push([0, L]);
        });
        return map;
    },

    _accumulateStack: (inc, spanMap) => {
        if (!inc || !spanMap) return;
        Object.keys(spanMap).forEach(id => {
            // 같은 철근이 한 벽에 여러 구간을 등록하면 겹침 병합 후 1회만 적층 (이중 적층 방지)
            const spans = spanMap[id].spans.slice().sort((a, b) => a[0] - b[0]);
            const merged = [];
            spans.forEach(sp => {
                const last = merged[merged.length - 1];
                if (last && sp[0] <= last[1] + 1) last[1] = Math.max(last[1], sp[1]);
                else merged.push([sp[0], sp[1]]);
            });
            if (!Domain.wallStack[id]) Domain.wallStack[id] = [];
            merged.forEach(sp => Domain.wallStack[id].push({ lo: sp[0], hi: sp[1], th: inc }));
        });
    }
};
