// =========================================================================
// 🟦 PART: PHYSICS ENGINE (physic.js) - v001
// =========================================================================

const Physics = {
    _EPS: 1e-6,

    getWallCoverValue: (wall) => {
        let cType = wall && wall.tag ? String(wall.tag).toLowerCase() : "outer";
        let covers = (Domain.currentSection && Domain.currentSection.covers) ? Domain.currentSection.covers : {};
        return covers[cType] || 50;
    },

    // 구간(interval) 적층 조회 — wallStack[id] = [{lo, hi, th}] (벽 시점부터 축방향 거리 구간)
    //  해당 위치에 걸친 구간 두께의 합. 같은 벽이라도 다른 영역이면 0 →
    //  서로 겹치지 않는 철근끼리는 적층되지 않는다 (좌/우 철근이 하면 벽을 공유해도 독립).
    stackAt: (wallStack, wall, px, py) => {
        if (!wallStack || !wall) return 0;
        const list = wallStack[wall.id];
        if (!list || !list.length) return 0;
        const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1;
        const L = MathUtils.hypot(dx, dy) || 1;
        const t = ((px - wall.x1) * dx + (py - wall.y1) * dy) / L;
        let sum = 0;
        list.forEach(iv => { if (t >= iv.lo - 1 && t <= iv.hi + 1) sum += iv.th; });
        return sum;
    },

    buildShiftedWall: (wall, extraOffset = 0) => {
        let coverVal = Physics.getWallCoverValue(wall);
        let total = coverVal + extraOffset;
        return {
            id: wall.id,
            tag: wall.tag,
            nx: wall.nx,  // ⭐ 원본 콘크리트 법선 강제 유지
            ny: wall.ny,  // ⭐ 원본 콘크리트 법선 강제 유지
            origWall: wall,
            x1: wall.x1 + wall.nx * total,
            y1: wall.y1 + wall.ny * total,
            x2: wall.x2 + wall.nx * total,
            y2: wall.y2 + wall.ny * total
        };
    },

    pointsClose: (a, b, tol = 1.0) => {
        if (!a || !b) return false;
        return MathUtils.hypot(a.x - b.x, a.y - b.y) <= tol;
    },

    splitWallLoops: (walls) => {
        let loops = [];
        let current = [];
        let firstStart = null;

        walls.forEach((w) => {
            if (current.length === 0) {
                current.push(w);
                firstStart = { x: w.x1, y: w.y1 };
                return;
            }

            current.push(w);
            let endPt = { x: w.x2, y: w.y2 };
            if (Physics.pointsClose(endPt, firstStart, 1.0)) {
                loops.push(current);
                current = [];
                firstStart = null;
            }
        });

        if (current.length > 0) loops.push(current);
        return loops;
    },

    trimShiftedLoop: (loopWalls, wallStack = {}, currentDia = 0) => {
        let shifted = loopWalls.map(w => {
            let extra = currentDia / 2;   // 적층은 벽 전체가 아니라 위치별(stackAt)로 반영
            return Physics.buildShiftedWall(w, extra);
        });
        let n = shifted.length;
        if (n === 0) return [];
        if (n === 1) return shifted;

        let trimmed = [];

        for (let i = 0; i < n; i++) {
            let prev = shifted[(i - 1 + n) % n];
            let curr = shifted[i];
            let next = shifted[(i + 1) % n];

            let start = MathUtils.getLineIntersection(
                { x: prev.x1, y: prev.y1 }, { x: prev.x2, y: prev.y2 },
                { x: curr.x1, y: curr.y1 }, { x: curr.x2, y: curr.y2 }
            );

            let end = MathUtils.getLineIntersection(
                { x: curr.x1, y: curr.y1 }, { x: curr.x2, y: curr.y2 },
                { x: next.x1, y: next.y1 }, { x: next.x2, y: next.y2 }
            );

            let sx = start ? start.x : curr.x1;
            let sy = start ? start.y : curr.y1;
            let ex = end ? end.x : curr.x2;
            let ey = end ? end.y : curr.y2;

            let len = MathUtils.hypot(ex - sx, ey - sy);
            if (len < Physics._EPS) {
                sx = curr.x1; sy = curr.y1;
                ex = curr.x2; ey = curr.y2;
            }

            trimmed.push({
                id: curr.id,
                tag: curr.tag,
                nx: curr.origWall.nx, // ⭐ 다듬어진 선분도 무조건 원본 콘크리트 법선 강제 유지!
                ny: curr.origWall.ny, // ⭐ 다듬어진 선분도 무조건 원본 콘크리트 법선 강제 유지!
                origWall: curr.origWall,
                x1: sx,
                y1: sy,
                x2: ex,
                y2: ey
            });
        }

        return trimmed;
    },

    buildCoverWalls: (walls, wallStack = {}, currentDia = 0) => {
        let loops = Physics.splitWallLoops(walls || []);
        let coverWalls = [];
        loops.forEach(loop => {
            let trimmedLoop = Physics.trimShiftedLoop(loop, wallStack, currentDia);
            trimmedLoop.forEach(w => coverWalls.push(w));
        });
        return coverWalls;
    },

    getCoverWallMap: (walls, wallStack = {}, currentDia = 0) => {
        let map = new Map();
        let coverWalls = Physics.buildCoverWalls(walls, wallStack, currentDia);
        coverWalls.forEach(cw => {
            let key = cw.id || (cw.origWall ? cw.origWall.id : null) || `${cw.origWall.x1},${cw.origWall.y1},${cw.origWall.x2},${cw.origWall.y2}`;
            map.set(key, cw);
        });
        return map;
    },

    getCoverWallByOrigWall: (origWall, walls, coverWallMap = null) => {
        if (!origWall) return null;
        let key = origWall.id || `${origWall.x1},${origWall.y1},${origWall.x2},${origWall.y2}`;
        let map = coverWallMap || Physics.getCoverWallMap(walls);
        return map.get(key) || null;
    },

    getGravityTarget: (px, py, segNormal, walls, wallStack = {}, currentDia = 0) => {
        const OPPOSITE_THRESHOLD = -0.6;
        let coverWalls = Physics.buildCoverWalls(walls, wallStack, currentDia);

        // dir 방향 광선으로 대향 벽 탐색 (전방 우선, 없으면 후방 폴백에 재사용)
        const scan = (dir) => {
            let minDist = Infinity;
            let target = null;
            coverWalls.forEach(w => {
                let dot = w.nx * segNormal.x + w.ny * segNormal.y;
                if (dot > OPPOSITE_THRESHOLD) return;

                let dx = w.x2 - w.x1;
                let dy = w.y2 - w.y1;
                let len = Math.sqrt(dx * dx + dy * dy);
                if (len < 0.5) return;               // 길이 0 벽(0값 치수의 퇴화 세그먼트) 무시
                let p1 = { x: w.x1, y: w.y1 };
                let p2 = { x: w.x2, y: w.y2 };

                if (len > 0 && len < 500) {
                    let midX = (p1.x + p2.x) / 2;
                    let midY = (p1.y + p2.y) / 2;
                    let ux = dx / len;
                    let uy = dy / len;
                    let halfLen = 250;
                    p1 = { x: midX - ux * halfLen, y: midY - uy * halfLen };
                    p2 = { x: midX + ux * halfLen, y: midY + uy * halfLen };
                }

                let hit = MathUtils.rayLineIntersect({ x: px, y: py }, dir, p1, p2);
                if (hit && hit.dist < minDist) {
                    minDist = hit.dist;
                    target = {
                        x: hit.x,
                        y: hit.y,
                        wall: w.origWall || w,
                        coverWall: w
                    };
                }
            });
            return target;
        };

        // 전방(법선 방향) 우선. 실패 시 후방 폴백:
        // 노드가 피복선을 지나쳐(벽보다 안쪽에) 스폰되면 전방 광선이 벽을 영영 못 잡아
        // 안착 불가 → barEnds(fit) 도 실행되지 않음. 뒤로 끌어올려 벽에 되붙인다.
        const res = scan(segNormal) || scan({ x: -segNormal.x, y: -segNormal.y });
        if (res && res.wall) {
            const st = Physics.stackAt(wallStack, res.wall, res.x, res.y);
            if (st) { res.x += res.wall.nx * st; res.y += res.wall.ny * st; }
        }
        return res;
    },

    // finalize 후 형상 붕괴 감지 — 코너 교점이 원래 길이보다 훨씬 멀면 각 세그가 거의 평행해진 것
    checkFormed: (trebar) => {
        const segs = trebar.segments || [];
        for (let i = 0; i < segs.length; i++) {
            const L = MathUtils.hypot(segs[i].p2.x - segs[i].p1.x, segs[i].p2.y - segs[i].p1.y);
            if (!isFinite(L) || L > segs[i].initialLen * 4 + 100) {
                console.warn(`[FORM] ${trebar.id || '?'} 의 '${segs[i].label}' 조각이 ${Math.round(L)}mm 로 늘어남 ` +
                             `(입력 ${Math.round(segs[i].initialLen)}mm) — 이웃 조각과 거의 평행해 코너 교점이 멀어짐. rot/angs 확인`);
                return false;
            }
        }
        return true;
    },

    updatePhysics: (trebar, walls, wallStack = {}) => {
        if (trebar.state === "FORMED") return;

        const { GRAVITY_K, DAMPING, CONVERGE } = CONFIG.PHYSICS;
        const dia = trebar.dia || 0;
        trebar.debugPoints = [];
        let allSegmentsSettled = true;

        trebar.segments.forEach((seg, idx) => {
            if (seg.state === "WAITING") {
                allSegmentsSettled = false;
                if (idx === 0 || trebar.segments[idx - 1].state === "SETTLED") seg.state = "FITTING";
            }

            if (seg.state === "FITTING") {
                allSegmentsSettled = false;

                let segEnergy = 0;
                let maxPosError = 0;
                let validTargets = 0;
                let hitInfos = [];

                seg.nodes.forEach(node => {
                    let target = Physics.getGravityTarget(node.x, node.y, seg.normal, walls, wallStack, dia);

                    if (target) {
                        let dx = target.x - node.x;
                        let dy = target.y - node.y;
                        let err = MathUtils.hypot(dx, dy);

                        validTargets++;
                        trebar.debugPoints.push(target);

                        seg.contactWall = target.wall;
                        hitInfos.push({ wall: target.wall, dist: err });

                        if (err > maxPosError) maxPosError = err;

                        node.vx += dx * GRAVITY_K;
                        node.vy += dy * GRAVITY_K;
                    }

                    node.vx *= DAMPING;
                    node.vy *= DAMPING;
                    node.x += node.vx;
                    node.y += node.vy;

                    segEnergy += Math.abs(node.vx) + Math.abs(node.vy);
                });

                if (validTargets === seg.nodes.length && segEnergy < CONVERGE && maxPosError < 1.0) {
                    seg.state = "SETTLED";
                    seg.fitWall = Physics.resolveSegmentFitWall(seg, hitInfos);
                    seg.nodeWalls = hitInfos.map(h => h.wall);   // 노드별 안착 벽 (p1쪽 → p2쪽 순) — FIT 이 끝단별로 사용
                    Physics.restoreSegmentLine(seg);
                }
            }
        });

        if (allSegmentsSettled && trebar.state !== "FORMED") {
            if (trebar.finalize) trebar.finalize();
            Physics.applyTrebarEnds(trebar, walls, wallStack);
            Physics.checkFormed(trebar);
            trebar.state = "FORMED";
        }
    },

    resolveSegmentFitWall: (seg, hitInfos = []) => {
        if (seg.anchorWall) return seg.anchorWall;

        const wallMap = new Map();

        hitInfos.forEach(info => {
            if (!info.wall) return;
            const wallId = info.wall.id || `${info.wall.x1},${info.wall.y1},${info.wall.x2},${info.wall.y2}`;

            if (!wallMap.has(wallId)) {
                wallMap.set(wallId, {
                    wall: info.wall,
                    count: 0,
                    totalDist: 0
                });
            }

            const acc = wallMap.get(wallId);
            acc.count += 1;
            acc.totalDist += info.dist || 0;
        });

        let best = null;
        wallMap.forEach(item => {
            if (!best || item.count > best.count || (item.count === best.count && item.totalDist < best.totalDist)) {
                best = item;
            }
        });

        return best ? best.wall : (seg.contactWall || null);
    },

    getSegmentFitWall: (seg) => {
        return seg.fitWall || seg.anchorWall || seg.contactWall || null;
    },

    restoreSegmentLine: (seg) => {
        let n1 = seg.nodes[0];
        let n2 = seg.nodes[1];
        let cx = (n1.x + n2.x) / 2;
        let cy = (n1.y + n2.y) / 2;
        let dx = n2.x - n1.x;
        let dy = n2.y - n1.y;
        let dist = MathUtils.hypot(dx, dy);
        let ux, uy;

        if (dist > 0.01) {
            ux = dx / dist;
            uy = dy / dist;
            if (ux * seg.uDir.x + uy * seg.uDir.y < 0) {
                ux = -ux;
                uy = -uy;
            }
        } else {
            ux = seg.uDir.x;
            uy = seg.uDir.y;
        }

        seg.uDir = { x: ux, y: uy };
        let halfLen = seg.initialLen / 2;
        seg.p1 = { x: cx - ux * halfLen, y: cy - uy * halfLen };
        seg.p2 = { x: cx + ux * halfLen, y: cy + uy * halfLen };
    },

    projectPointToLine: (point, lineOrigin, lineDir) => {
        let dx = point.x - lineOrigin.x;
        let dy = point.y - lineOrigin.y;
        let dot = dx * lineDir.x + dy * lineDir.y;
        return {
            x: lineOrigin.x + dot * lineDir.x,
            y: lineOrigin.y + dot * lineDir.y
        };
    },

    applyTrebarEnds: (trebar, walls, wallStack = {}) => {
        const barEnds = trebar.barEnds || trebar.ends;
        if (!barEnds || !trebar.segments || trebar.segments.length === 0) return;

        const dia = trebar.dia || 0;
        const coverWallMap = Physics.getCoverWallMap(walls, wallStack, dia);

        const parseEndRule = (ruleObj) => {
            if (!ruleObj) return null;
            if (ruleObj.type !== undefined) {
                return { type: String(ruleObj.type).toUpperCase(), val: Number(ruleObj.val) || 0 };
            }
            let keys = Object.keys(ruleObj);
            if (keys.length > 0) {
                return { type: String(keys[0]).toUpperCase(), val: Number(ruleObj[keys[0]]) || 0 };
            }
            return null;
        };

        const getCoverWallForSeg = (seg) => {
            let wall = Physics.getSegmentFitWall(seg);
            if (!wall) return null;
            return Physics.getCoverWallByOrigWall(wall, walls, coverWallMap);
        };

        // FIT: 끝단별로 "그 끝단 위치에서 법선 방향으로 안착하는 벽"을 기준 벽으로 삼고,
        //      그 벽(피복선, 이웃 트림 완료)의 해당 방향 끝단까지 확장. (각도 병합 없음)
        //  · start = p1 위치 아래 벽의 시점부(min t), end = p2 위치 아래 벽의 종점부(max t)
        //    예) 크라운 분할 하면: p1 쪽은 E15 → E15 시점부, p2 쪽은 E28 → E28 종점부.
        //  · 폴백: 끝단 광선 실패 → 그 쪽 노드의 안착 벽(nodeWalls) → 다수결 fitWall
        //  · val 은 벽 끝단을 넘는 추가 연장량(0=끝단까지).
        const getFitSpan = (seg, side) => {
            let endPt = (side === 'start') ? seg.p1 : seg.p2;
            let refWall = null;
            let tgt = Physics.getGravityTarget(endPt.x, endPt.y, seg.normal, walls, wallStack, dia);
            if (tgt && tgt.wall) refWall = tgt.wall;
            if (!refWall && seg.nodeWalls && seg.nodeWalls.length) {
                refWall = (side === 'start') ? seg.nodeWalls[0] : seg.nodeWalls[seg.nodeWalls.length - 1];
            }
            if (!refWall) refWall = Physics.getSegmentFitWall(seg);
            if (!refWall) return null;
            let cw = Physics.getCoverWallByOrigWall(refWall, walls, coverWallMap);
            if (!cw) return null;

            let o = seg.p1, u = seg.uDir;
            // 벽 끝점의 "법선 단면선"과 세그 축의 교점 파라미터 t.
            //  · 세그가 벽과 평행하면 수직투영과 동일 (기존 동작 유지)
            //  · 기울어진 세그(예: 15번 a다리 45°)는 벽 끝단면에서 정확히 멈춤 —
            //    수직투영만 쓰면 끝단면을 지나 허공으로 삐져나감
            const endT = (ex, ey) => {
                let det = u.x * cw.ny - u.y * cw.nx;
                if (Math.abs(det) < 1e-9) return (ex - o.x) * u.x + (ey - o.y) * u.y;   // 세그 ∥ 법선 → 투영 폴백
                return ((ex - o.x) * cw.ny - (ey - o.y) * cw.nx) / det;
            };
            let t1 = endT(cw.x1, cw.y1);
            let t2 = endT(cw.x2, cw.y2);
            let lo = Math.min(t1, t2), hi = Math.max(t1, t2);

            // ── 표면과 나란한 바(데크/슬래브 횡철근)는 콘크리트 경계까지 연장 ──
            // 기준 벽의 끝(크라운 분할, 헌치 시작 등)에서 멈추면 슬래브 절반만 배근된다.
            // 바 축을 따라 광선을 쏴 실제로 막히는 피복면(캔틸레버 선단, 복부 내측 등)을
            // 찾아 그 지점까지 연장한다. 축과 기울어진 세그(15번 45° 다리 등)는 평행 조건을
            // 만족하지 않으므로 기존의 '기준 벽 끝단면에서 정지' 규칙이 그대로 유지된다.
            // 평행 판정은 '세그먼트가 안착한 벽'(다수결 fitWall) 기준 — 끝점 아래 벽으로 재면
            // 끝이 우연히 단차/헌치 위에 걸렸을 때 한쪽만 연장되어 좌우 비대칭이 된다.
            let baseWall = Physics.getSegmentFitWall(seg) || refWall;
            let wdx = baseWall.x2 - baseWall.x1, wdy = baseWall.y2 - baseWall.y1;
            let wlen = Math.hypot(wdx, wdy) || 1;
            let par = Math.abs((wdx * u.x + wdy * u.y) / wlen);
            if (par >= 0.9999985) {
                // 표면과 나란한 바(데크/슬래브 횡철근)는 '콘크리트 안에서 피복을 확보한 채
                // 갈 수 있는 데까지' 연장한다. 기준 벽 조각 단위로 끊으면 크라운 분할·단차에서
                // 절반만 배근되고, 단순 광선만 쓰면 모따기·헌치를 지나쳐 단면 밖으로 나간다.
                let mid = { x: (seg.p1.x + seg.p2.x) / 2, y: (seg.p1.y + seg.p2.y) / 2 };
                let segDist = (px, py, ax, ay, bx, by) => {
                    let ex = bx - ax, ey = by - ay, L2 = ex * ex + ey * ey;
                    let s = L2 ? ((px - ax) * ex + (py - ay) * ey) / L2 : 0;
                    s = s < 0 ? 0 : (s > 1 ? 1 : s);
                    return Math.hypot(px - (ax + s * ex), py - (ay + s * ey));
                };
                // 콘크리트 내부 판정 (외곽 + 공동 루프 교차 홀짝)
                let inside = (px, py) => {
                    let cross = false;
                    for (let wi = 0; wi < walls.length; wi++) {
                        let w = walls[wi];
                        if ((w.y1 > py) !== (w.y2 > py)) {
                            let xx = (w.x2 - w.x1) * (py - w.y1) / (w.y2 - w.y1) + w.x1;
                            if (px < xx) cross = !cross;
                        }
                    }
                    return cross;
                };
                // 지지면 추적 : 바가 붙어 있는 면을 따라가되, 그 면이 꺾이거나(0.1° 초과)
                // 멀어지면 거기서 끝낸다. 크라운처럼 같은 평면이 조각으로 나뉜 곳은 그대로 통과.
                let nFit = { x: baseWall.nx, y: baseWall.ny };
                let sup = { x: -nFit.x, y: -nFit.y };               // 바 → 지지면 방향
                let probe = (px, py) => {                          // 지지면까지 거리와 그 면
                    let best = null, bestT = Infinity;
                    for (let wi = 0; wi < walls.length; wi++) {
                        let w = walls[wi];
                        let ex = w.x2 - w.x1, ey = w.y2 - w.y1;
                        let den = sup.x * ey - sup.y * ex;
                        if (Math.abs(den) < 1e-9) continue;
                        let rx = w.x1 - px, ry = w.y1 - py;
                        let tR = (rx * ey - ry * ex) / den;
                        let sS = (rx * sup.y - ry * sup.x) / den;
                        if (tR <= 0.01 || tR >= bestT) continue;
                        if (sS < -1e-6 || sS > 1 + 1e-6) continue;
                        bestT = tR; best = w;
                    }
                    return best ? { t: bestT, w: best } : null;
                };
                let base = probe(mid.x, mid.y);
                let baseT = base ? base.t : 0;
                let supportOK = (px, py) => {
                    if (!base) return true;                        // 지지면을 못 찾으면 이 조건은 생략
                    let q = probe(px, py);
                    if (!q) return false;
                    let ex = q.w.x2 - q.w.x1, ey = q.w.y2 - q.w.y1, el = Math.hypot(ex, ey) || 1;
                    if (Math.abs((ex * u.x + ey * u.y) / el) < 0.9999985) return false;   // 0.1° 초과로 꺾임
                    return Math.abs(q.t - baseT) <= 3.0;           // 같은 높이(단차 없음)
                };

                // 축을 따라 전진 : 콘크리트를 벗어나거나(→ 그 면의 피복만큼 후퇴)
                //                  지지면 여유가 줄어들면(→ 그 지점에서 정지) 종료
                let reach = (dSign) => {
                    let dx = u.x * dSign, dy = u.y * dSign;
                    const STEP = 25, LIMIT = 60000;
                    let good = 0, exited = false, stopped = false;
                    for (let s = STEP; s <= LIMIT; s += STEP) {
                        let px = mid.x + dx * s, py = mid.y + dy * s;
                        if (!inside(px, py)) { exited = true; break; }
                        if (!supportOK(px, py)) { stopped = true; break; }
                        good = s;
                    }
                    if (!exited && !stopped) return good;
                    let a = good, b = good + STEP, test = exited
                        ? function (m) { return inside(mid.x + dx * m, mid.y + dy * m); }
                        : function (m) { return supportOK(mid.x + dx * m, mid.y + dy * m); };
                    for (let it = 0; it < 14; it++) {                 // 경계 1mm 이내
                        let m = (a + b) / 2;
                        if (test(m)) a = m; else b = m;
                    }
                    if (!exited) return a;                            // 지지면이 끝남 → 추가 후퇴 없음
                    let ex = mid.x + dx * a, ey = mid.y + dy * a;     // 콘크리트 경계 지점
                    let near = null, nd2 = Infinity;
                    for (let wi = 0; wi < walls.length; wi++) {
                        let w = walls[wi];
                        let dd = segDist(ex, ey, w.x1, w.y1, w.x2, w.y2);
                        if (dd < nd2) { nd2 = dd; near = w; }
                    }
                    if (!near) return a;
                    let need = Physics.getWallCoverValue(near) + Physics.stackAt(wallStack, near, ex, ey) + dia / 2;
                    let cosA = Math.abs(near.nx * dx + near.ny * dy);  // 비스듬한 면이면 축방향 후퇴량 증가
                    return Math.max(0, a - need / Math.max(0.2, cosA));
                };
                let tMid = (mid.x - o.x) * u.x + (mid.y - o.y) * u.y;
                // 경사면에서 need/cosA 후퇴가 과도해 세그가 뒤집히거나 사라지지 않도록,
                // 확장 결과가 원래 세그 길이의 절반 미만이면 FIT 확장을 포기하고 원래 끝을 유지.
                let rch = reach(side === 'start' ? -1 : 1);
                let half = seg.initialLen / 2;
                if (!isFinite(rch) || rch < half * 0.5) {
                    console.warn(`[FIT] ${trebar.id || '?'} 의 '${seg.label}' ${side} 확장이 과소(${Math.round(rch)}mm < ` +
                                 `${Math.round(half)}mm) — 경사면 후퇴 과다로 판단해 원래 길이 유지`);
                    rch = half;
                }
                if (side === 'start') lo = tMid - rch; else hi = tMid + rch;
            }

            return {
                wallId: cw.id || (cw.origWall && cw.origWall.id) || '?',
                refId: refWall.id || null,
                lo: { x: o.x + u.x * lo, y: o.y + u.y * lo },
                hi: { x: o.x + u.x * hi, y: o.y + u.y * hi }
            };
        };

        const updateSegLen = (seg) => {
            seg.initialLen = MathUtils.hypot(seg.p2.x - seg.p1.x, seg.p2.y - seg.p1.y);
        };

        const startRule = parseEndRule(barEnds.start || barEnds.B);
        const endRule = parseEndRule(barEnds.end || barEnds.E);

        // FIT 스팬은 p1/p2 를 바꾸기 전에 미리 계산 (start 적용이 end 계산에 영향 주지 않도록)
        const firstSeg = trebar.segments[0];
        const lastSeg = trebar.segments[trebar.segments.length - 1];
        const startSpan = (startRule && startRule.type === "FIT") ? getFitSpan(firstSeg, 'start') : null;
        const endSpan = (endRule && endRule.type === "FIT") ? getFitSpan(lastSeg, 'end') : null;
        // FIT 끝단 기준 벽 기록 → 적층(wallStack)이 바가 걸친 모든 벽에 등록되도록
        //  (예: 크라운 분할 하면의 TSB — 시점 E15·종점 E28 둘 다. 한쪽만 등록되면 좌우 적층 어긋남)
        if (startSpan && startSpan.refId) { firstSeg.spanWalls = firstSeg.spanWalls || []; if (firstSeg.spanWalls.indexOf(startSpan.refId) < 0) firstSeg.spanWalls.push(startSpan.refId); }
        if (endSpan && endSpan.refId) { lastSeg.spanWalls = lastSeg.spanWalls || []; if (lastSeg.spanWalls.indexOf(endSpan.refId) < 0) lastSeg.spanWalls.push(endSpan.refId); }
        if (startSpan || endSpan) {
            console.log(`[FIT] ${trebar.id || ''} → ` +
                (startSpan ? `시점: ${startSpan.wallId}` : '') +
                (startSpan && endSpan ? ' ~ ' : '') +
                (endSpan ? `종점: ${endSpan.wallId}` : ''));
        }

        if (startRule) {
            let seg = firstSeg;

            if (startRule.type === "FIT") {
                if (startSpan) {
                    seg.p1 = {
                        x: startSpan.lo.x - seg.uDir.x * startRule.val,
                        y: startSpan.lo.y - seg.uDir.y * startRule.val
                    };
                    updateSegLen(seg);
                }
            } else if (startRule.type === "RAY") {
                let rayDir = { x: -seg.uDir.x, y: -seg.uDir.y };
                let rayOrigin = {
                    x: seg.p1.x + rayDir.x * 10,
                    y: seg.p1.y + rayDir.y * 10
                };
                let hit = Physics.rayCastGlobal(rayOrigin, rayDir, walls, wallStack, dia);
                if (hit) {
                    seg.p1 = {
                        x: hit.x - seg.uDir.x * startRule.val,
                        y: hit.y - seg.uDir.y * startRule.val
                    };
                    updateSegLen(seg);
                }
            }
        }

        if (endRule) {
            let seg = lastSeg;

            if (endRule.type === "FIT") {
                if (endSpan) {
                    seg.p2 = {
                        x: endSpan.hi.x + seg.uDir.x * endRule.val,
                        y: endSpan.hi.y + seg.uDir.y * endRule.val
                    };
                    updateSegLen(seg);
                }
            } else if (endRule.type === "RAY") {
                let rayOrigin = {
                    x: seg.p2.x + seg.uDir.x * 10,
                    y: seg.p2.y + seg.uDir.y * 10
                };
                let hit = Physics.rayCastGlobal(rayOrigin, seg.uDir, walls, wallStack, dia);
                if (hit) {
                    seg.p2 = {
                        x: hit.x + seg.uDir.x * endRule.val,
                        y: hit.y + seg.uDir.y * endRule.val
                    };
                    updateSegLen(seg);
                }
            }
        }
    },

    rayCastGlobal: (origin, dir, walls, wallStack = {}, currentDia = 0) => {
        let bestHit = null;
        let minDist = Infinity;
        let coverWalls = Physics.buildCoverWalls(walls, wallStack, currentDia);

        coverWalls.forEach(w => {
            let hit = MathUtils.rayLineIntersect(origin, dir, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
            if (hit && hit.dist < minDist && hit.dist > 0.1) {
                let dotCheck = (hit.x - origin.x) * dir.x + (hit.y - origin.y) * dir.y;
                if (dotCheck > 0) {
                    minDist = hit.dist;
                    bestHit = {
                        x: hit.x,
                        y: hit.y,
                        dist: hit.dist,
                        wall: w.origWall || w,
                        coverWall: w
                    };
                }
            }
        });

        return bestHit;
    }
};
