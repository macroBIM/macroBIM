// lrebar.js v001 - Longitudinal Rebar Engine

const LRebarEngine = {

    _dist: (a, b) => Math.hypot(b.x - a.x, b.y - a.y),

    // set IDs 순서대로 cover wall 경로(polyline) 생성
    buildPath: (setIds, walls) => {
        if (!setIds || setIds.length === 0) return [];

        const coverWalls = Physics.buildCoverWalls(walls);
        const cwMap = {};
        coverWalls.forEach(cw => {
            const key = cw.id || (cw.origWall && cw.origWall.id);
            if (key) cwMap[key] = cw;
        });

        const path = [];
        setIds.forEach(id => {
            const cw = cwMap[String(id).toUpperCase()];
            if (!cw) { console.warn(`[LREBAR] wall "${id}" not found`); return; }

            if (path.length === 0) {
                path.push({ x: cw.x1, y: cw.y1 }, { x: cw.x2, y: cw.y2 });
            } else {
                const last = path[path.length - 1];
                const d1 = LRebarEngine._dist(last, { x: cw.x1, y: cw.y1 });
                const d2 = LRebarEngine._dist(last, { x: cw.x2, y: cw.y2 });
                // 이전 끝점과 더 가까운 쪽을 연결
                if (d1 <= d2) {
                    path.push({ x: cw.x2, y: cw.y2 });
                } else {
                    path.push({ x: cw.x1, y: cw.y1 });
                }
            }
        });
        return path;
    },

    pathLength: (pts) => {
        let len = 0;
        for (let i = 0; i < pts.length - 1; i++) len += LRebarEngine._dist(pts[i], pts[i + 1]);
        return len;
    },

    // 경로 위 거리 t인 점 반환
    pointAtDist: (pts, t) => {
        let rem = t;
        for (let i = 0; i < pts.length - 1; i++) {
            const segLen = LRebarEngine._dist(pts[i], pts[i + 1]);
            if (rem <= segLen + 1e-6 || i === pts.length - 2) {
                const ratio = segLen > 1e-9 ? Math.min(rem / segLen, 1.0) : 0;
                return {
                    x: pts[i].x + (pts[i + 1].x - pts[i].x) * ratio,
                    y: pts[i].y + (pts[i + 1].y - pts[i].y) * ratio
                };
            }
            rem -= segLen;
        }
        return { ...pts[pts.length - 1] };
    },

    // LREBAR 데이터 전체 계산 → 그룹별 위치 배열 반환
    compute: (lrebarData, walls) => {
        if (!lrebarData || !walls) return [];
        const results = [];

        lrebarData.forEach(data => {
            const setIds = data.set   || [];
            const range  = data.range || {};
            const bar    = data.bar   || {};

            const path = LRebarEngine.buildPath(setIds, walls);
            if (path.length < 2) { console.warn(`[LREBAR] ${data.id}: 유효한 path 없음`); return; }

            const totalLen = LRebarEngine.pathLength(path);
            const startT   = Number(range.b) || 0;
            const endT     = totalLen - (Number(range.e) || 0);
            if (endT - startT < 1) { console.warn(`[LREBAR] ${data.id}: 유효 구간 없음`); return; }

            const usable = endT - startT;
            let num = bar.num ? Number(bar.num) : 0;
            let ctc = bar.ctc ? Number(bar.ctc) : 0;

            if (num >= 2) {
                ctc = usable / (num - 1);
            } else if (num === 1) {
                ctc = 0;
            } else if (ctc > 0) {
                num = Math.round(usable / ctc) + 1;
                ctc = num > 1 ? usable / (num - 1) : 0;
            } else {
                console.warn(`[LREBAR] ${data.id}: num 또는 ctc 필요`); return;
            }

            if (bar.max && ctc > bar.max) console.warn(`[LREBAR] ${data.id}: CTC ${ctc.toFixed(0)} > max ${bar.max}`);
            if (bar.min && ctc < bar.min) console.warn(`[LREBAR] ${data.id}: CTC ${ctc.toFixed(0)} < min ${bar.min}`);

            const positions = [];
            for (let i = 0; i < num; i++) {
                const t = num > 1 ? startT + i * ctc : startT + usable / 2;
                positions.push(LRebarEngine.pointAtDist(path, t));
            }

            results.push({ id: data.id, dia: Number(bar.dia) || 16, ctc, positions });
        });

        return results;
    }
};
