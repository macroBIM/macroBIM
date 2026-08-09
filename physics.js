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
            let extra = (wallStack[w.id] || 0) + currentDia / 2;
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
        return scan(segNormal) || scan({ x: -segNormal.x, y: -segNormal.y });
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

        // FIT: 안착한 벽(피복선)의 "전체 면"을 바 축에 투영해 결정적으로 산출.
        //  · 벽 양 끝점을 바 축 파라미터 t(작다=start 쪽, 크다=end 쪽)로 정렬 → start=min(t), end=max(t)
        //  · 도로 크라운(경사 꺾임)처럼 한 면이 완만한 각도로 여러 벽에 분할된 경우,
        //    안착 벽과 방향 차가 FIT_MERGE_ANG(기본 6°) 이내인 "이웃 벽"을 같은 면으로 병합.
        //    → 크라운(≈4°)은 한 면으로 이어지고, 헌치·웹(큰 꺾임)은 병합되지 않음.
        //  · val 은 면 끝단을 넘는 추가 연장량(0=끝단까지).
        const FIT_MERGE_ANG = (CONFIG.PHYSICS && CONFIG.PHYSICS.FIT_MERGE_ANG != null) ? CONFIG.PHYSICS.FIT_MERGE_ANG : 6;
        const mergeCos = Math.cos(FIT_MERGE_ANG * Math.PI / 180);

        //  · 끝단별 기준 벽 = "그 끝에 가까운 노드가 안착한 벽" (seg.nodeWalls, p1쪽→p2쪽 순).
        //    예) 크라운 분할 하면에서 좌노드=E15, 우노드=E28 → start 는 E15 의 시점부,
        //        end 는 E28 의 종점부로 각각 확장. (set 앵커 등 노드 정보 없으면 fitWall 폴백)
        const getFitSpan = (seg, side) => {
            let fitWall = null;
            if (seg.nodeWalls && seg.nodeWalls.length) {
                fitWall = (side === 'start') ? seg.nodeWalls[0] : seg.nodeWalls[seg.nodeWalls.length - 1];
            }
            if (!fitWall) fitWall = Physics.getSegmentFitWall(seg);
            if (!fitWall) return null;
            let fitKey = fitWall.id || `${fitWall.x1},${fitWall.y1},${fitWall.x2},${fitWall.y2}`;

            // 안착 벽이 속한 루프의 피복선(트림 완료)을 순서대로 확보
            let loops = Physics.splitWallLoops(walls || []);
            let coverLoop = null, idxInLoop = -1;
            for (let li = 0; li < loops.length && !coverLoop; li++) {
                let trimmed = Physics.trimShiftedLoop(loops[li], wallStack, dia);
                for (let wi = 0; wi < trimmed.length; wi++) {
                    let k = trimmed[wi].id || `${trimmed[wi].origWall.x1},${trimmed[wi].origWall.y1},${trimmed[wi].origWall.x2},${trimmed[wi].origWall.y2}`;
                    if (k === fitKey) { coverLoop = trimmed; idxInLoop = wi; break; }
                }
            }
            if (!coverLoop) {
                let cw = getCoverWallForSeg(seg);
                if (!cw) return null;
                coverLoop = [cw]; idxInLoop = 0;
            }

            const dirOf = (w) => {
                let dx = w.x2 - w.x1, dy = w.y2 - w.y1, l = MathUtils.hypot(dx, dy);
                return l > 1e-9 ? { x: dx / l, y: dy / l } : { x: 1, y: 0 };
            };
            let baseDir = dirOf(coverLoop[idxInLoop]);
            let n = coverLoop.length;
            let merged = [coverLoop[idxInLoop]];
            let ids = [coverLoop[idxInLoop].id || '?'];
            // 양방향으로 이웃 벽 병합 (안착 벽 방향 기준 각도 → 곡선에서 누적 이탈 제한)
            for (let dirStep = -1; dirStep <= 1; dirStep += 2) {
                for (let s = 1; s < n; s++) {
                    let j = ((idxInLoop + dirStep * s) % n + n) % n;
                    if (j === idxInLoop) break;
                    let d = dirOf(coverLoop[j]);
                    if (d.x * baseDir.x + d.y * baseDir.y < mergeCos) break;
                    merged.push(coverLoop[j]);
                    if (dirStep < 0) ids.unshift(coverLoop[j].id || '?'); else ids.push(coverLoop[j].id || '?');
                }
            }

            let o = seg.p1, u = seg.uDir;
            let lo = Infinity, hi = -Infinity;
            merged.forEach((w) => {
                [[w.x1, w.y1], [w.x2, w.y2]].forEach((p) => {
                    let t = (p[0] - o.x) * u.x + (p[1] - o.y) * u.y;
                    if (t < lo) lo = t;
                    if (t > hi) hi = t;
                });
            });
            return {
                wallId: ids.join('+'),
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
