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

    buildShiftedWall: (wall) => {
        let coverVal = Physics.getWallCoverValue(wall);
        return {
            id: wall.id,
            tag: wall.tag,
            nx: wall.nx,  // ⭐ 원본 콘크리트 법선 강제 유지
            ny: wall.ny,  // ⭐ 원본 콘크리트 법선 강제 유지
            origWall: wall,
            x1: wall.x1 + wall.nx * coverVal,
            y1: wall.y1 + wall.ny * coverVal,
            x2: wall.x2 + wall.nx * coverVal,
            y2: wall.y2 + wall.ny * coverVal
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

    trimShiftedLoop: (loopWalls) => {
        let shifted = loopWalls.map(w => Physics.buildShiftedWall(w));
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

    buildCoverWalls: (walls) => {
        let loops = Physics.splitWallLoops(walls || []);
        let coverWalls = [];
        loops.forEach(loop => {
            let trimmedLoop = Physics.trimShiftedLoop(loop);
            trimmedLoop.forEach(w => coverWalls.push(w));
        });
        return coverWalls;
    },

    getCoverWallMap: (walls) => {
        let map = new Map();
        let coverWalls = Physics.buildCoverWalls(walls);
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

    getGravityTarget: (px, py, segNormal, walls, rebarWallMap = null, ownDia = 0, ownType = "rebar") => {
        let minDist = Infinity;
        let target = null;
        const OPPOSITE_THRESHOLD = -0.6;
        let coverWalls = Physics.buildCoverWalls(walls);

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

            let hit = MathUtils.rayLineIntersect({ x: px, y: py }, segNormal, p1, p2);
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

        if (target && rebarWallMap) {
            const stackOffset = Physics._stackOffsetForHit(target, rebarWallMap, ownDia, ownType);
            if (stackOffset > 0.001) {
                const dotN = segNormal.x * target.wall.nx + segNormal.y * target.wall.ny;
                const absDotN = Math.abs(dotN);
                if (absDotN > 0.01) {
                    const travelOffset = stackOffset / absDotN;
                    target = {
                        x: target.x - segNormal.x * travelOffset,
                        y: target.y - segNormal.y * travelOffset,
                        wall: target.wall,
                        coverWall: target.coverWall
                    };
                }
            }
        }

        return target;
    },

    updatePhysics: (rebar, walls, rebarWallMap = null) => {
        if (rebar.state === "FORMED") return;

        const { GRAVITY_K, DAMPING, CONVERGE } = CONFIG.PHYSICS;
        const ownDia = rebar.dia || 13;
        rebar.debugPoints = [];
        let allSegmentsSettled = true;

        rebar.segments.forEach((seg, idx) => {
            if (seg.state === "WAITING") {
                allSegmentsSettled = false;
                if (idx === 0 || rebar.segments[idx - 1].state === "SETTLED") seg.state = "FITTING";
            }

            if (seg.state === "FITTING") {
                allSegmentsSettled = false;

                let segEnergy = 0;
                let maxPosError = 0;
                let validTargets = 0;
                let hitInfos = [];

                seg.nodes.forEach(node => {
                    let target = Physics.getGravityTarget(node.x, node.y, seg.normal, walls, rebarWallMap, ownDia, "rebar");

                    if (target) {
                        let dx = target.x - node.x;
                        let dy = target.y - node.y;
                        let err = MathUtils.hypot(dx, dy);

                        validTargets++;
                        rebar.debugPoints.push(target);

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
                    Physics.restoreSegmentLine(seg);
                }
            }
        });

        if (allSegmentsSettled && rebar.state !== "FORMED") {
            if (rebar.finalize) rebar.finalize();
            Physics.applyRebarEnds(rebar, walls);
            rebar.state = "FORMED";
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

    applyRebarEnds: (rebar, walls) => {
        const barEnds = rebar.barEnds || rebar.ends;
        if (!barEnds || !rebar.segments || rebar.segments.length === 0) return;

        const coverWallMap = Physics.getCoverWallMap(walls);

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

        const getFarthestWallPoint = (seg, coverWall, anchorPoint) => {
            let wp1 = { x: coverWall.x1, y: coverWall.y1 };
            let wp2 = { x: coverWall.x2, y: coverWall.y2 };

            let d1 = (wp1.x - anchorPoint.x) ** 2 + (wp1.y - anchorPoint.y) ** 2;
            let d2 = (wp2.x - anchorPoint.x) ** 2 + (wp2.y - anchorPoint.y) ** 2;

            let targetP = (d1 > d2) ? wp1 : wp2;
            return Physics.projectPointToLine(targetP, seg.p1, seg.uDir);
        };

        const updateSegLen = (seg) => {
            seg.initialLen = MathUtils.hypot(seg.p2.x - seg.p1.x, seg.p2.y - seg.p1.y);
        };

        const startRule = parseEndRule(barEnds.start || barEnds.B);
        const endRule = parseEndRule(barEnds.end || barEnds.E);

        if (startRule) {
            let seg = rebar.segments[0];

            if (startRule.type === "FIT") {
                let coverWall = getCoverWallForSeg(seg);
                if (coverWall) {
                    let projected = getFarthestWallPoint(seg, coverWall, seg.p2);
                    seg.p1 = {
                        x: projected.x + seg.uDir.x * startRule.val,
                        y: projected.y + seg.uDir.y * startRule.val
                    };
                    updateSegLen(seg);
                }
            } else if (startRule.type === "RAY") {
                let rayDir = { x: -seg.uDir.x, y: -seg.uDir.y };
                let rayOrigin = {
                    x: seg.p1.x + rayDir.x * 10,
                    y: seg.p1.y + rayDir.y * 10
                };
                let hit = Physics.rayCastGlobal(rayOrigin, rayDir, walls);
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
            let seg = rebar.segments[rebar.segments.length - 1];

            if (endRule.type === "FIT") {
                let coverWall = getCoverWallForSeg(seg);
                if (coverWall) {
                    let projected = getFarthestWallPoint(seg, coverWall, seg.p1);
                    seg.p2 = {
                        x: projected.x + seg.uDir.x * endRule.val,
                        y: projected.y + seg.uDir.y * endRule.val
                    };
                    updateSegLen(seg);
                }
            } else if (endRule.type === "RAY") {
                let rayOrigin = {
                    x: seg.p2.x + seg.uDir.x * 10,
                    y: seg.p2.y + seg.uDir.y * 10
                };
                let hit = Physics.rayCastGlobal(rayOrigin, seg.uDir, walls);
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

    buildRebarWallMap: (placedItems) => {
        const map = new Map();
        if (!placedItems) return map;
        placedItems.forEach(item => {
            if (!item || !item.obj) return;
            if (item.kind === "rebar" && item.obj.state === "FORMED") {
                Physics._registerRebarSegments(map, item.obj);
            } else if (item.kind === "lrebar" && item.obj.state === "SETTLED") {
                Physics._registerLRebarParticles(map, item.obj);
            }
        });
        return map;
    },

    _pushMapEntry: (map, wallId, entry) => {
        if (!map.has(wallId)) map.set(wallId, []);
        map.get(wallId).push(entry);
    },

    _registerRebarSegments: (map, rebar) => {
        const dia = rebar.dia || 13;
        rebar.segments.forEach(seg => {
            const wall = seg.fitWall || seg.contactWall;
            if (!wall) return;
            const wallId = wall.id || `${wall.x1},${wall.y1},${wall.x2},${wall.y2}`;

            const wDx = wall.x2 - wall.x1;
            const wDy = wall.y2 - wall.y1;
            const wLen = MathUtils.hypot(wDx, wDy);
            if (wLen < 1e-6) return;
            const ux = wDx / wLen;
            const uy = wDy / wLen;

            const t1 = (seg.p1.x - wall.x1) * ux + (seg.p1.y - wall.y1) * uy;
            const t2 = (seg.p2.x - wall.x1) * ux + (seg.p2.y - wall.y1) * uy;
            const tMin = Math.min(t1, t2);
            const tMax = Math.max(t1, t2);

            const mx = (seg.p1.x + seg.p2.x) / 2;
            const my = (seg.p1.y + seg.p2.y) / 2;
            const concPerpDist = (mx - wall.x1) * wall.nx + (my - wall.y1) * wall.ny;
            const coverVal = Physics.getWallCoverValue(wall);
            const centerOffset = concPerpDist - coverVal;

            Physics._pushMapEntry(map, wallId, { tMin, tMax, dia, centerOffset });
        });
    },

    _registerLRebarParticles: (map, group) => {
        const dia = group.dia || 13;
        const halfDia = dia / 2;
        const pathWalls = group._pathWalls || [];
        if (pathWalls.length === 0) return;

        group.particles.forEach(p => {
            if (p.state !== "SETTLED") return;

            let bestWall = null;
            let bestPerp = Infinity;
            for (const w of pathWalls) {
                const wDx = w.x2 - w.x1;
                const wDy = w.y2 - w.y1;
                const wLen = MathUtils.hypot(wDx, wDy);
                if (wLen < 1e-6) continue;
                const ux = wDx / wLen;
                const uy = wDy / wLen;
                const dx = p.x - w.x1;
                const dy = p.y - w.y1;
                const along = dx * ux + dy * uy;
                const perp = Math.abs(dx * (-uy) + dy * ux);
                if (along < -5 || along > wLen + 5) continue;
                if (perp < bestPerp) {
                    bestPerp = perp;
                    bestWall = w;
                }
            }
            if (!bestWall) return;
            if (bestPerp > 500) return;

            const origWall = bestWall.origWall || bestWall;
            const wallId = bestWall.id || origWall.id;
            if (!wallId) return;

            const owDx = origWall.x2 - origWall.x1;
            const owDy = origWall.y2 - origWall.y1;
            const owLen = MathUtils.hypot(owDx, owDy);
            if (owLen < 1e-6) return;
            const oux = owDx / owLen;
            const ouy = owDy / owLen;
            const tCenter = (p.x - origWall.x1) * oux + (p.y - origWall.y1) * ouy;

            const coverVal = Physics.getWallCoverValue(origWall);
            const concPerpDist = (p.x - origWall.x1) * origWall.nx + (p.y - origWall.y1) * origWall.ny;
            const centerOffset = concPerpDist - coverVal;

            Physics._pushMapEntry(map, wallId, {
                tMin: tCenter - halfDia,
                tMax: tCenter + halfDia,
                dia,
                centerOffset
            });
        });
    },

    computeStackOffset: (rebarWallMap, wallId, t, ownDia, ownType = "rebar") => {
        const baseForFirst = (ownType === "lrebar") ? ownDia / 2 : 0;
        if (!rebarWallMap) return baseForFirst;
        const entries = rebarWallMap.get(wallId);
        if (!entries || entries.length === 0) return baseForFirst;

        let topOfStack = -Infinity;
        let hasOverlap = false;
        for (const e of entries) {
            if (t >= e.tMin - 0.1 && t <= e.tMax + 0.1) {
                hasOverlap = true;
                const top = e.centerOffset + e.dia / 2;
                if (top > topOfStack) topOfStack = top;
            }
        }
        if (!hasOverlap) return baseForFirst;
        return topOfStack + ownDia / 2;
    },

    _stackOffsetForHit: (target, rebarWallMap, ownDia, ownType) => {
        const wall = target.wall;
        if (!wall || !wall.id) return 0;
        const wDx = wall.x2 - wall.x1;
        const wDy = wall.y2 - wall.y1;
        const wLen = MathUtils.hypot(wDx, wDy);
        if (wLen < 1e-6) return 0;
        const ux = wDx / wLen;
        const uy = wDy / wLen;
        const t = (target.x - wall.x1) * ux + (target.y - wall.y1) * uy;
        return Physics.computeStackOffset(rebarWallMap, wall.id, t, ownDia, ownType);
    },

    rayCastGlobal: (origin, dir, walls) => {
        let bestHit = null;
        let minDist = Infinity;
        let coverWalls = Physics.buildCoverWalls(walls);

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
