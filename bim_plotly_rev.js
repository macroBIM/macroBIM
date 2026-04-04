/* plotly_rev.js v000

	PlotlyViewer
	addDualDimension
	generate3DWireframe
	decomposeArcToLines
	extract_2d_projection

	process_clipped_view_3d ( clip 방법이 좋지 않아 사용하지 않음. 추후에 사용할거 같아 남겨둠)
	
*/

/*
    MACROBIM High-Performance Plotly Viewer (Ratio & Sync Fixed)
    - Fix: Side View ratio distortion by linking scaleanchors
    - Sync: Front-Side (Y), Front-Top (X)
*/
function PlotlyViewer(divId, initial3D = true, bgColor = '#ffffff') {
    const container = document.getElementById(divId);
    if (!container) return null;

    let is3D = initial3D;
    const layers = {
        '0': { color: '#ffffff', type: 'solid', width: 1.5 },
        'dim': { color: '#ff4444', type: 'solid', width: 1 }
    };

    const dataStore = {
        front:  { entities: {}, dims: [] },
        side:   { entities: {}, dims: [] },
        top:    { entities: {}, dims: [] },
        bottom: { entities: {}, dims: [] }
    };

    const _ensureLayer = (view, layer) => {
        if (!dataStore[view].entities[layer]) dataStore[view].entities[layer] = [];
    };

    const _getDashStyle = (type) => {
        if (type === 'hidden' || type === 'dot') return 'dot';
        if (type === 'center' || type === 'dashdot') return 'dashdot';
        return 'solid';
    };

    const _pushArcPts = (targetX, targetY, cx, cy, r, sAng, eAng, steps = 30) => {
        for (let i = 0; i < steps; i++) {
            const t = (sAng + (eAng - sAng) * i / (steps - 1)) * (Math.PI / 180);
            targetX.push(cx + r * Math.cos(t));
            targetY.push(cy + r * Math.sin(t));
        }
        targetX.push(null); targetY.push(null);
    };

    const _calcBounds = (viewData) => {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, hasData = false;
        for (const layer in viewData.entities) {
            viewData.entities[layer].forEach(e => {
                hasData = true;
                if (e.type === "LINE") {
                    minX = Math.min(minX, e.start.x, e.end.x); maxX = Math.max(maxX, e.start.x, e.end.x);
                    minY = Math.min(minY, e.start.y, e.end.y); maxY = Math.max(maxY, e.start.y, e.end.y);
                } else if (e.type === "CIRCLE" || e.type === "ARC") {
                    const r = e.radius;
                    minX = Math.min(minX, e.center.x - r); maxX = Math.max(maxX, e.center.x + r);
                    minY = Math.min(minY, e.center.y - r); maxY = Math.max(maxY, e.center.y + r);
                }
            });
        }
        if (!hasData) return { x: [-100, 100], y: [-100, 100] };
        const sx = (maxX - minX) || 100, sy = (maxY - minY) || 100;
        const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
        const size = Math.max(sx, sy) * 1.3;
        return { x: [cx - size / 2, cx + size / 2], y: [cy - size / 2, cy + size / 2] };
    };

    return {
        addLayer: (name, color, type = 'solid', width = 1.5) => { layers[name] = { color, type, width }; },
        addLine: (view, x1, y1, x2, y2, layer = '0') => {
            if (!dataStore[view]) return; _ensureLayer(view, layer);
            dataStore[view].entities[layer].push({ type: "LINE", start: { x: x1, y: y1 }, end: { x: x2, y: y2 } });
        },
        addCircle: (view, cx, cy, r, layer = '0') => {
            if (!dataStore[view]) return; _ensureLayer(view, layer);
            dataStore[view].entities[layer].push({ type: "CIRCLE", center: { x: cx, y: cy }, radius: r });
        },
        addArc: (view, cx, cy, r, sAng, eAng, layer = '0') => {
            if (!dataStore[view]) return; _ensureLayer(view, layer);
            dataStore[view].entities[layer].push({ type: "ARC", center: { x: cx, y: cy }, radius: r, startAngle: sAng, endAngle: eAng });
        },
        addDimLinear: (view, x1, y1, x2, y2, offset) => {
            if (!dataStore[view]) return;
            dataStore[view].dims.push({ type: "DIM_LINEAR", start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, offset: offset });
        },
        addDimRadius: (view, cx, cy, r, angle) => {
            if (!dataStore[view]) return;
            dataStore[view].dims.push({ type: "DIM_RADIUS", center: { x: cx, y: cy }, radius: r, angle: angle });
        },
        render: function() {
            const traces = [], annots = [], shapes = [];
            const views = ['front', 'side', 'top', 'bottom'];
            const b = views.reduce((acc, v) => ({ ...acc, [v]: _calcBounds(dataStore[v]) }), {});

            views.forEach((vName, idx) => {
                const xN = idx === 0 ? 'x' : 'x' + (idx + 1);
                const yN = idx === 0 ? 'y' : 'y' + (idx + 1);
                const viewData = dataStore[vName];

                for (const layer in viewData.entities) {
                    const lDef = layers[layer] || layers['0'];
                    const cX = [], cY = [];
                    viewData.entities[layer].forEach(e => {
                        if (e.type === "LINE") { cX.push(e.start.x, e.end.x, null); cY.push(e.start.y, e.end.y, null); }
                        else if (e.type === "CIRCLE") { _pushArcPts(cX, cY, e.center.x, e.center.y, e.radius, 0, 360, 50); }
                        else if (e.type === "ARC") { _pushArcPts(cX, cY, e.center.x, e.center.y, e.radius, e.startAngle, e.endAngle, 30); }
                    });
                    traces.push({
                        x: cX, y: cY, mode: 'lines', xaxis: xN, yaxis: yN,
                        line: { color: lDef.color, width: lDef.width, dash: _getDashStyle(lDef.type) },
                        hoverinfo: 'none', showlegend: false
                    });
                }

                const dimColor = layers['dim']?.color || 'red';
                viewData.dims.forEach(d => {
                    if (d.type === "DIM_LINEAR") {
                        const dx = d.end.x - d.start.x, dy = d.end.y - d.start.y, len = Math.sqrt(dx*dx+dy*dy);
                        const nx = -dy/len, ny = dx/len;
                        const p1 = { x: d.start.x + nx * d.offset, y: d.start.y + ny * d.offset };
                        const p2 = { x: d.end.x + nx * d.offset, y: d.end.y + ny * d.offset };
                        traces.push({
                            x: [d.start.x, p1.x, null, d.end.x, p2.x],
                            y: [d.start.y, p1.y, null, d.end.y, p2.y],
                            mode: 'lines', line: { color: '#666', width: 0.8, dash: 'dot' }, xaxis: xN, yaxis: yN, hoverinfo: 'none', showlegend: false
                        });
                        traces.push({
                            x: [p1.x, p2.x], y: [p1.y, p2.y], mode: 'lines+markers', 
                            marker: { symbol: 'circle', size: 5, color: dimColor }, line: { color: dimColor, width: 1 }, 
                            xaxis: xN, yaxis: yN, hoverinfo: 'none', showlegend: false
                        });
                        annots.push({ x: (p1.x+p2.x)/2, y: (p1.y+p2.y)/2, text: len.toFixed(1), showarrow: false, font: { color: dimColor, size: 10, weight: 'bold' }, bgcolor: bgColor, xref: xN, yref: yN });
                    } else if (d.type === "DIM_RADIUS") {
                        const rad = d.angle * Math.PI / 180;
                        const ex = d.center.x + d.radius * Math.cos(rad), ey = d.center.y + d.radius * Math.sin(rad);
                        traces.push({ x: [d.center.x, ex], y: [d.center.y, ey], mode: 'lines+markers', marker: { symbol: 'circle', size: 4, color: dimColor }, line: { color: dimColor, width: 1 }, xaxis: xN, yaxis: yN, hoverinfo: 'none', showlegend: false });
                        annots.push({ x: ex, y: ey, text: "R"+d.radius, showarrow: true, arrowhead: 2, ax: ex + 20*Math.cos(rad), ay: ey + 20*Math.sin(rad), font: { color: dimColor, size: 10 }, xref: xN, yref: yN, axref: xN, ayref: yN });
                    }
                });
            });

            const commonAxis = { showgrid: false, zeroline: false, showticklabels: false, fixedrange: false, linecolor: '#444' };

            let layout = {
                hovermode: 'closest', dragmode: 'pan', showlegend: false,
                paper_bgcolor: bgColor, plot_bgcolor: bgColor,
                margin: { l: 5, r: 5, t: 5, b: 5 }, annotations: annots, shapes: shapes
            };

            if (is3D) {
                const titleStyle = { showarrow: false, font: { size: 13, color: '#888', weight: 'bold' }, xref: 'paper', yref: 'paper', xanchor: 'left', yanchor: 'top' };
                annots.push(
                    { ...titleStyle, x: 0.01, y: 0.99, text: 'TOP' },
                    { ...titleStyle, x: 0.51, y: 0.99, text: 'BOTTOM' },
                    { ...titleStyle, x: 0.01, y: 0.49, text: 'FRONT' },
                    { ...titleStyle, x: 0.51, y: 0.49, text: 'SIDE' }
                );

                Object.assign(layout, {
                    // Front (Base View)
                    xaxis:  { ...commonAxis, domain: [0, 0.49], range: b.front.x },
                    yaxis:  { ...commonAxis, domain: [0, 0.49], range: b.front.y, scaleanchor: 'x', scaleratio: 1 },
                    
                    // Side: Y축은 Front와 매칭, X축은 자신의 Y축에 고정하여 비율 유지
                    xaxis2: { ...commonAxis, domain: [0.51, 1], range: b.side.x, anchor: 'y2', scaleanchor: 'y2', scaleratio: 1 },
                    yaxis2: { ...commonAxis, domain: [0, 0.49], range: b.side.y, anchor: 'x2', matches: 'y' },
                    
                    // Top: X축은 Front와 매칭, Y축은 자신의 X축에 고정하여 비율 유지
                    xaxis3: { ...commonAxis, domain: [0, 0.49], range: b.top.x, anchor: 'y3', matches: 'x' },
                    yaxis3: { ...commonAxis, domain: [0.51, 1], range: b.top.y, anchor: 'x3', scaleanchor: 'x3', scaleratio: 1 },
                    
                    // Bottom: X는 Front 매칭, Y는 Top 매칭
                    xaxis4: { ...commonAxis, domain: [0.51, 1], range: b.bottom.x, anchor: 'y4', matches: 'x' },
                    yaxis4: { ...commonAxis, domain: [0.51, 1], range: b.bottom.y, anchor: 'x4', matches: 'y3' }
                });
            } else {
                Object.assign(layout, {
                    xaxis: { ...commonAxis, range: b.front.x },
                    yaxis: { ...commonAxis, range: b.front.y, scaleanchor: 'x', scaleratio: 1 }
                });
            }

            const config = { responsive: true, scrollZoom: true, displaylogo: false, modeBarButtons: [['pan2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d']] };
            Plotly.newPlot(divId, traces, layout, config);
        },
        clear: function() {
            for (let v in dataStore) { dataStore[v].entities = {}; dataStore[v].dims = []; }
        }
    };
}


/**
 * 통합 2단 치수선 생성 함수 (Shift 기능 추가 및 수정)
 * @param {Object} viewer - PlotlyViewer 인스턴스
 * @param {String} viewName - 'front', 'side' 등
 * @param {Array} pointsList - geo_box1cell의 결과인 points 배열
 * @param {Array<String>} keys - 치수를 뽑을 포인트 이름 목록
 * @param {Object} fixedAxis - 고정할 축과 값 (예: {y: 5000})
 * @param {Number} scale - 도면 스케일 (기본값 1.0)
 * @param {Number} shiftx - (선택) X축 이동량 (기본값 0)
 * @param {Number} shifty - (선택) Y축 이동량 (기본값 0)
 */
function addDualDimension(viewer, viewName, pointsList, keys, fixedAxis, scale = 1.0, shiftx = 0, shifty = 0) {
    // -----------------------------------------------------------
    // [1] 방향 결정 (수평 vs 수직) 및 값 추출
    // -----------------------------------------------------------
    // fixedAxis에 'y'가 있으면 수평 치수, 'x'가 있으면 수직 치수로 판단
    const isHorizontal = fixedAxis.hasOwnProperty('y');
    const fixedVal = isHorizontal ? fixedAxis.y : fixedAxis.x;

    // [핵심 수정] fixedVal이 음수이면 방향을 반대로(-1), 양수면 그대로(1) 설정
    // 예: y = -2000 (하부) -> dir = -1 -> 치수선이 아래로 그려짐
    const dir = fixedVal < 0 ? -1 : 1;

    // -----------------------------------------------------------
    // [2] 함수 내부 설정 변수 (방향 적용)
    // -----------------------------------------------------------
    // 1단(상세)과 2단(전체)의 치수선 간격 (scale 및 방향 dir 적용)
    const GAP_MINOR = 10 * scale * dir;  
    const GAP_MAJOR = 20 * scale * dir; 

    // -----------------------------------------------------------
    // [3] 데이터 추출 및 유효성 검사
    // -----------------------------------------------------------
    let rawPoints = [];
    pointsList.forEach(item => {
        if (keys.includes(item.name) && item[item.name]) {
            rawPoints.push(item[item.name]);
        }
    });

    if (rawPoints.length < 1) {
        return; 
    }

    // -----------------------------------------------------------
    // [4] 좌표 투영
    // -----------------------------------------------------------
    // 점들을 치수선 기준선(fixedAxis) 위로 투영
    const projPoints = rawPoints.map(p => ({
        x: isHorizontal ? p.x : fixedVal,
        y: isHorizontal ? fixedVal : p.y
    }));

    // 정렬 (치수선 꼬임 방지)
    if (isHorizontal) {
        projPoints.sort((a, b) => a.x - b.x); // X축 오름차순
    } else {
        projPoints.sort((a, b) => a.y - b.y); // Y축 오름차순
    }

    // -----------------------------------------------------------
    // [5] 치수선 그리기
    // -----------------------------------------------------------
    
    // 4-1. 상세 치수 (Chain Dimension) - 안쪽
    for (let i = 0; i < projPoints.length - 1; i++) {
        viewer.addDimLinear(
            viewName,
            projPoints[i].x + shiftx, projPoints[i].y + shifty,
            projPoints[i+1].x + shiftx, projPoints[i+1].y + shifty,
            GAP_MINOR 
        );
    }

    // 4-2. 전체 치수 (Total Dimension) - 바깥쪽
    const start = projPoints[0];
    const end = projPoints[projPoints.length - 1];

    viewer.addDimLinear(
        viewName,
        start.x + shiftx, start.y + shifty,
        end.x + shiftx, end.y + shifty,
        GAP_MAJOR 
    );
}

/* 사용법
const geoData = geo_box1cell(params); // points 리스트가 들어있음
const myViewer = PlotlyViewer('myDiv');
const topDimPoints = ['ptl', 'ptc', 'ptr']; 

// 3. 함수 실행
addDualDimension(
    myViewer, 
    'front', 
    geoData.points,   // 전체 포인트 데이터
    topDimPoints,     // ['ptl', 'ptc', 'ptr'] 전달
    { y: 2000 },      // Y=2000 위치에 수평선으로 그림
    1.0
);
addDualDimension(
    myViewer, 
    'front', 
    geoData.points, 
    ['pbr', 'ptr'], 
    { x: 3000 },              // X축을 3000으로 고정 (-> 수직 치수선이 됨)
    1.0 
);
*/

/**
 * 2026.01.03 create
 * 3D 라인에서 조건(View, Name)에 맞는 선만 추출하여 2D 좌표로 변환하는 함수
 * @param {Array} lines3D - generate3DWireframe에서 생성된 3D 라인 배열
 * @param {String} viewMode - 'PLAN' (평면: x,z) 또는 'SIDE' (측면: z,y)
 * @param {Object} filterOpts - 필터 옵션
 * {
 * targetView: string | Array | '',  // 예: 'side' 또는 ['side', 'top']
 * targetNames: Array | []           // 예: ['ptl', 'ptc']
 * }
 */
function extract_2d_projection(lines3D, viewMode, filterOpts = {}) {
    let resultLines = [];
    
    // 1. 대소문자 무시 처리
    const mode = (viewMode || '').toUpperCase();

    // 2. targetView 정규화 (문자열이면 배열로 변환, 빈 값이면 null)
    let targetViews = null;
    if (filterOpts.targetView) {
        if (Array.isArray(filterOpts.targetView)) {
            // 배열이고 비어있지 않으면 사용
            if (filterOpts.targetView.length > 0) targetViews = filterOpts.targetView;
        } else if (typeof filterOpts.targetView === 'string' && filterOpts.targetView.trim() !== '') {
            // 문자열이면 배열로 감싸서 처리
            targetViews = [filterOpts.targetView];
        }
    }

    // 3. targetNames 정규화
    const targetNames = (filterOpts.targetNames && Array.isArray(filterOpts.targetNames) && filterOpts.targetNames.length > 0) ? filterOpts.targetNames : null;

    lines3D.forEach(line => {
        let isMatch = false;

        // 필터가 아무것도 없으면 -> 전체 출력
        if (!targetViews && !targetNames) {
            isMatch = true;
        } else {
            // [수정] views 배열 처리 (하나라도 일치하면 true)
            let matchView = false;
            if (targetViews) {
                if (line.views && Array.isArray(line.views)) {
                    // 교집합 확인: line.views 중 하나라도 targetViews에 포함되는가?
                    matchView = line.views.some(view => targetViews.includes(view));
                }
            }

            let matchName = false;
            if (targetNames) {
                if (line.name && targetNames.includes(line.name)) {
                    matchName = true;
                }
            }

            // OR 로직 (View 조건 만족 OR Name 조건 만족)
            if (targetViews && !targetNames) isMatch = matchView;
            else if (!targetViews && targetNames) isMatch = matchName;
            else isMatch = matchView || matchName; 
        }

        // 3. 조건 통과 시 2D 좌표 투영
        if (isMatch) {
            let p1 = {}, p2 = {};

            if (mode === 'PLAN') {
                // [평면도] X, Z (화면 Y가 길이방향)
                p1 = { x: line.x1, y: line.z1 };
                p2 = { x: line.x2, y: line.z2 };
            } else {
                // [측면도] Y, Z (화면 X가 높이, Y가 길이방향)
                p1 = { x: line.y1, y: line.z1 };
                p2 = { x: line.y2, y: line.z2 };
            }

            resultLines.push({
                x1: p1.x, y1: p1.y,
                x2: p2.x, y2: p2.y,
                part: line.part,
                name: line.name
            });
        }
    });

    return resultLines;
}


 /*
 * ==========================================================
 * 3. Logic: 3D Generation (Arc Longitudinal Connection Added)
 *    2026.01.03 - 출력을 위한 키값 추가, Arc 연결 시 이름(name) 기준 매칭으로 수정
 *    2026.01.02 - arc 보이게 수정한 버젼
 * ==========================================================
 */
function generate3DWireframe(sectionStart, sectionEnd, zStart, zEnd) {
    let lines3D = [];

    // 1. 일반 직선(Lines) 처리 (단면 & 종방향) - 기존 동일
    const addSectionLines = (section, z) => {
        section.lines.forEach(l => {
            lines3D.push({ 
                x1: l.x1, y1: l.y1, z1: z, 
                x2: l.x2, y2: l.y2, z2: z, 
                part: l.part, 
                views: l.views, 
                name: l.name 
            });
        });
    };
    addSectionLines(sectionStart, zStart);
    addSectionLines(sectionEnd, zEnd);

    // Point Map 생성 (직선 종방향 연결) - 기존 동일
    const createPointMap = (pointArr) => {
        const map = {};
        pointArr.forEach(item => {
            if (item.name) map[item.name] = { ...item[item.name], part: item.part, views: item.views };
        });
        return map;
    };
    const mapStart = createPointMap(sectionStart.points);
    const mapEnd = createPointMap(sectionEnd.points);

    for (const [key, ptS] of Object.entries(mapStart)) {
        const ptE = mapEnd[key];
        if (ptE) {
            lines3D.push({
                x1: ptS.x, y1: ptS.y, z1: zStart,
                x2: ptE.x, y2: ptE.y, z2: zEnd,
                part: ptS.part, 
                name: key,       
                views: ptS.views 
            });
        }
    }

    // 2. Arc 처리 (단면 분할 + 종방향 연결) - ⭐ 로직 변경
    const getArcVertices = (arc, z, segments) => {
        let vertices = [];
        const rad = Math.PI / 180;
        const step = ((arc.ange - arc.angb) * rad) / segments;
        const startRad = arc.angb * rad;

        for (let i = 0; i <= segments; i++) {
            const a = startRad + step * i;
            vertices.push({
                x: arc.x + arc.r * Math.cos(a),
                y: arc.y + arc.r * Math.sin(a),
                z: z
            });
        }
        return vertices;
    };

    // ⭐ Arc들을 이름(name)을 키로 하는 맵으로 변환
    const createArcMap = (arcArr) => {
        const map = {};
        arcArr.forEach(arc => {
            // 이름이 없으면 임시로 인덱스라도 쓰겠지만, 가급적 이름을 부여해야 함
            if (arc.name) {
                map[arc.name] = arc;
            }
        });
        return map;
    };

    const startArcsMap = createArcMap(sectionStart.arcs || []);
    const endArcsMap = createArcMap(sectionEnd.arcs || []);
    const segCount = 10;

    // Start 단면의 아크를 기준으로 순회하며 End 단면의 같은 이름 아크를 찾음
    for (const [name, arcS] of Object.entries(startArcsMap)) {
        const arcE = endArcsMap[name];
        
        // End 단면에 대응하는 아크가 없으면 종방향 연결 불가 -> 단면만 그리고 패스
        if (!arcE) {
            // (옵션) 시작 단면 아크만이라도 그림
            const vertsS = getArcVertices(arcS, zStart, segCount);
            for (let j = 0; j < segCount; j++) {
                lines3D.push({ x1: vertsS[j].x, y1: vertsS[j].y, z1: zStart, x2: vertsS[j+1].x, y2: vertsS[j+1].y, z2: zStart, part: arcS.part, views: arcS.views, name: arcS.name });
            }
            continue;
        }

        // 대응하는 아크가 있으면 연결
        const vertsS = getArcVertices(arcS, zStart, segCount);
        const vertsE = getArcVertices(arcE, zEnd, segCount);

        // (1) 단면 아크 (Start & End Face)
        for (let j = 0; j < segCount; j++) {
            lines3D.push({ x1: vertsS[j].x, y1: vertsS[j].y, z1: zStart, x2: vertsS[j+1].x, y2: vertsS[j+1].y, z2: zStart, part: arcS.part, views: arcS.views, name: arcS.name });
            lines3D.push({ x1: vertsE[j].x, y1: vertsE[j].y, z1: zEnd, x2: vertsE[j+1].x, y2: vertsE[j+1].y, z2: zEnd, part: arcE.part, views: arcE.views, name: arcE.name });
        }

        // (2) 종방향 아크 연결 (Longitudinal)
        for (let j = 0; j <= segCount; j++) {
            lines3D.push({
                x1: vertsS[j].x, y1: vertsS[j].y, z1: zStart,
                x2: vertsE[j].x, y2: vertsE[j].y, z2: zEnd,
                part: arcS.part,
                views: arcS.views,
                name: arcS.name // ⭐ 종방향 선에도 해당 아크의 이름을 부여 (예: 'pwtl')
            });
        }
    }

    return { lines: lines3D };
}

/**
 * Arc를 직선들로 분할하는 헬퍼 함수
 */
function decomposeArcToLines(arc, segments = 6) {
    let lines = [];
    const rad = Math.PI / 180;
    const startRad = arc.angb * rad;
    const endRad = arc.ange * rad;
    const step = (endRad - startRad) / segments;

    for (let i = 0; i < segments; i++) {
        const a1 = startRad + step * i;
        const a2 = startRad + step * (i + 1);
        lines.push({
            x1: arc.x + arc.r * Math.cos(a1),
            y1: arc.y + arc.r * Math.sin(a1),
            x2: arc.x + arc.r * Math.cos(a2),
            y2: arc.y + arc.r * Math.sin(a2),
            part: arc.part
        });
    }
    return lines;
}



/*
 * ==========================================================
 * 2026.01.03 - 다중 단면 연결 지원 (Multi-Section)
 * Input: sections = [ { data: geo_box1cell_result, z: 0 }, { data: ..., z: 4000 }, ... ]
 * ==========================================================
 */
function generate3DWireframeMulti(sections) {
    let lines3D = [];

    // ----------------------------------------------------------
    // 1. Helper Functions (내부 함수)
    // ----------------------------------------------------------
    
    // (1) 일반 직선(Lines)의 횡방향(Transverse) 추가
    const addTransverseLines = (sectionData, z) => {
        sectionData.lines.forEach(l => {
            lines3D.push({ 
                x1: l.x1, y1: l.y1, z1: z, 
                x2: l.x2, y2: l.y2, z2: z, 
                part: l.part, views: l.views, name: l.name 
            });
        });
    };

    // (2) 아크(Arc)의 정점 계산
    const getArcVertices = (arc, z, segments) => {
        let vertices = [];
        const rad = Math.PI / 180;
        const step = ((arc.ange - arc.angb) * rad) / segments;
        const startRad = arc.angb * rad;

        for (let i = 0; i <= segments; i++) {
            const a = startRad + step * i;
            vertices.push({
                x: arc.x + arc.r * Math.cos(a),
                y: arc.y + arc.r * Math.sin(a),
                z: z
            });
        }
        return vertices;
    };

    // (3) 아크 맵 생성 (이름 기준 매칭용)
    const createArcMap = (arcArr) => {
        const map = {};
        arcArr.forEach(arc => { if (arc.name) map[arc.name] = arc; });
        return map;
    };

    // (4) 포인트 맵 생성 (이름 기준 매칭용)
    const createPointMap = (pointArr) => {
        const map = {};
        pointArr.forEach(item => {
            if (item.name) map[item.name] = { ...item[item.name], part: item.part, views: item.views };
        });
        return map;
    };

    // ----------------------------------------------------------
    // 2. Main Logic
    // ----------------------------------------------------------
    const segCount = 6; // 아크 분할 개수

    // Step A: 모든 단면의 "자체 형상(횡방향)" 그리기
    sections.forEach(sec => {
        // 직선 그리기
        addTransverseLines(sec.data, sec.z);
        
        // 아크 그리기 (단면상에서의 곡선)
        if (sec.data.arcs) {
            sec.data.arcs.forEach(arc => {
                const verts = getArcVertices(arc, sec.z, segCount);
                for (let j = 0; j < segCount; j++) {
                    lines3D.push({ 
                        x1: verts[j].x, y1: verts[j].y, z1: sec.z, 
                        x2: verts[j+1].x, y2: verts[j+1].y, z2: sec.z, 
                        part: arc.part, views: arc.views, name: arc.name 
                    });
                }
            });
        }
    });

    // Step B: 구간별 "연결 형상(종방향)" 그리기 (i 와 i+1 연결)
    for (let i = 0; i < sections.length - 1; i++) {
        const startSec = sections[i];
        const endSec = sections[i+1];
        
        const zS = startSec.z;
        const zE = endSec.z;

        // B-1. 직선 포인트 연결 (Longitudinal Lines)
        const mapStart = createPointMap(startSec.data.points);
        const mapEnd = createPointMap(endSec.data.points);

        for (const [key, ptS] of Object.entries(mapStart)) {
            const ptE = mapEnd[key];
            if (ptE) {
                lines3D.push({
                    x1: ptS.x, y1: ptS.y, z1: zS,
                    x2: ptE.x, y2: ptE.y, z2: zE,
                    part: ptS.part, name: key, views: ptS.views 
                });
            }
        }

        // B-2. 아크 연결 (Longitudinal Arcs)
        const startArcsMap = createArcMap(startSec.data.arcs || []);
        const endArcsMap = createArcMap(endSec.data.arcs || []);

        for (const [name, arcS] of Object.entries(startArcsMap)) {
            const arcE = endArcsMap[name];
            if (arcE) {
                const vertsS = getArcVertices(arcS, zS, segCount);
                const vertsE = getArcVertices(arcE, zE, segCount);

                // 종방향 연결선 그리기
                for (let j = 0; j <= segCount; j++) {
                    lines3D.push({
                        x1: vertsS[j].x, y1: vertsS[j].y, z1: zS,
                        x2: vertsE[j].x, y2: vertsE[j].y, z2: zE,
                        part: arcS.part, views: arcS.views, name: arcS.name
                    });
                }
            }
        }
    }

    return { lines: lines3D };
}


	/**
	 * points 배열을 분석하여 A1 도면 기준 최적 스케일을 반환하는 함수
	 * @param {Array} points - geo_box1cell에서 반환된 점 데이터 배열
	 * @param {number} paperSize - 'A1' (기본값) 또는 'A3' 등
	 * @returns {number} 최적화된 정수 스케일 (예: 100, 200)
	 */
	function get_scalebyVal(width, height, paperSize = 'A1') {

		// 3. 용지 크기 설정 (단위: mm)
		let paper_w, paper_h;
		
		if (paperSize === 'A3') {
			paper_w = 420; paper_h = 297;
		} else {
			// 기본 A1
			paper_w = 841; paper_h = 594;
		}

		// 4. 여백 및 치수 영역을 고려한 안전 비율 설정
		// 도면의 약 70% 영역 안에 형상이 들어가야 함 (나머지 30%는 치수/제목)
		const SAFE_RATIO = 0.70; 
		const MARGIN = 40; // 테두리 여백 (좌우합 40, 상하합 40)

		const effective_w = (paper_w - MARGIN) * SAFE_RATIO;
		const effective_h = (paper_h - MARGIN) * SAFE_RATIO;

		// 5. 가분수 스케일 계산 (형상크기 / 종이유효크기)
		const raw_scale_x = width / effective_w;
		const raw_scale_y = height / effective_h;
		
		// 더 큰 축척을 기준으로 삼아야 종이를 벗어나지 않음
		const raw_scale = Math.max(raw_scale_x, raw_scale_y);

		// 6. 표준 정수 스케일(Standard Scale)로 보정
		// 토목/건축 실무에서 사용하는 스케일 단위
		const standard_scales = [
			1, 2, 5, 10, 20, 30, 40, 50, 60, 
			80, 100, 120, 150, 200, 250, 300, 
			400, 500, 600, 800, 1000, 1200
		];

		let final_scale = standard_scales[standard_scales.length - 1]; // 못 찾으면 최대값

		for (let s of standard_scales) {
			if (s >= raw_scale) {
				final_scale = s;
				break; 
			}
		}

		return final_scale;

	}
	 
	function get_scale(points, paperSize = 'A1') {
		
		// 1. 유효성 검사
		if (!points || points.length === 0) return 100; // 기본값

		// 2. 전체 형상의 Bounding Box(최소/최대 좌표) 계산
		let minX = Infinity, maxX = -Infinity;
		let minY = Infinity, maxY = -Infinity;

		points.forEach(item => {
			// 데이터 구조가 { ptName: {x, y}, name: "ptName" } 형태라고 가정
			// item.name을 키(key)로 사용하여 좌표 객체에 접근
			const coord = item[item.name]; 
			
			if (coord && typeof coord.x === 'number' && typeof coord.y === 'number') {
				if (coord.x < minX) minX = coord.x;
				if (coord.x > maxX) maxX = coord.x;
				if (coord.y < minY) minY = coord.y;
				if (coord.y > maxY) maxY = coord.y;
			}
		});

		// 형상의 전체 폭과 높이
		const obj_width = maxX - minX;
		const obj_height = maxY - minY;

		// 3. 용지 크기 설정 (단위: mm)
		let paper_w, paper_h;
		
		if (paperSize === 'A3') {
			paper_w = 420; paper_h = 297;
		} else {
			// 기본 A1
			paper_w = 841; paper_h = 594;
		}

		// 4. 여백 및 치수 영역을 고려한 안전 비율 설정
		// 도면의 약 70% 영역 안에 형상이 들어가야 함 (나머지 30%는 치수/제목)
		const SAFE_RATIO = 0.70; 
		const MARGIN = 40; // 테두리 여백 (좌우합 40, 상하합 40)

		const effective_w = (paper_w - MARGIN) * SAFE_RATIO;
		const effective_h = (paper_h - MARGIN) * SAFE_RATIO;

		// 5. 가분수 스케일 계산 (형상크기 / 종이유효크기)
		const raw_scale_x = obj_width / effective_w;
		const raw_scale_y = obj_height / effective_h;
		
		// 더 큰 축척을 기준으로 삼아야 종이를 벗어나지 않음
		const raw_scale = Math.max(raw_scale_x, raw_scale_y);

		// 6. 표준 정수 스케일(Standard Scale)로 보정
		// 토목/건축 실무에서 사용하는 스케일 단위
		const standard_scales = [
			1, 2, 5, 10, 20, 30, 40, 50, 60, 
			80, 100, 120, 150, 200, 250, 300, 
			400, 500, 600, 800, 1000, 1200
		];

		let final_scale = standard_scales[standard_scales.length - 1]; // 못 찾으면 최대값

		for (let s of standard_scales) {
			if (s >= raw_scale) {
				final_scale = s;
				break; 
			}
		}

		// (옵션) 콘솔에서 계산 결과 확인
		// console.log(`Obj Size: ${obj_width.toFixed(0)}x${obj_height.toFixed(0)}, Raw Scale: ${raw_scale.toFixed(2)}, Final: 1/${final_scale}`);

		return final_scale;
	}	




// ==========================================================
//	2026.01.03
// Babylon.js 3D Viewer Logic
// ==========================================================

// ==========================================================
// Babylon.js 3D Viewer Logic (수정됨)
// ==========================================================
// ==========================================================
// Babylon.js 3D Viewer Logic (수정됨: 엔진 리셋 로직 추가)
// ==========================================================

function open3DView() {
    // 1. 데이터 확인
    if (!G_LastWireframe3D || !G_LastWireframe3D.lines || G_LastWireframe3D.lines.length === 0) {
        alert("3D 데이터가 없습니다. 먼저 'DRAWING VIEW'를 갱신해주세요.");
        return;
    }

    // 2. 컨테이너 보이기
    const container = document.getElementById("div_3d_container");
    if (!container) {
        console.error("div_3d_container not found inside HTML");
        return;
    }
    container.style.display = "flex";

    // 3. 캔버스 가져오기
    const canvas = document.getElementById("renderCanvas");

    // 4. 엔진 초기화 및 캔버스 갱신 확인
    // (이미 엔진이 떠 있어도, 사용자가 메뉴를 다시 클릭해서 캔버스가 바뀌었으면 엔진을 죽이고 다시 만들어야 함)
    if (babylonEngine) {
        // 현재 엔진이 사용 중인 캔버스와 화면의 캔버스가 다른지 확인
        if (babylonEngine.getRenderingCanvas() !== canvas) {
            babylonEngine.dispose(); // 구형 엔진 폐기
            babylonEngine = null;
        }
    }

    if (!babylonEngine) {
        babylonEngine = new BABYLON.Engine(canvas, true);
        
        // 창 크기 변경 대응
        window.addEventListener("resize", function () {
            if (babylonEngine) babylonEngine.resize();
        });
    }

    // 5. 컨테이너가 보이자마자 리사이즈 (중요: 크기 0 방지)
    babylonEngine.resize();

    // 6. 씬 생성
    if (babylonScene) {
        babylonScene.dispose(); // 기존 씬 제거
    }
    
    // 데이터 전달하여 씬 만들기
    babylonScene = createScene(canvas, G_LastWireframe3D.lines);

    // 7. 렌더 루프 시작
    babylonEngine.runRenderLoop(function () {
        if (babylonScene) {
            babylonScene.render();
        }
    });
}

function close3DView() {
    const container = document.getElementById("div_3d_container");
    if (container) container.style.display = "none";
    
    // 렌더링 멈춤 (자원 절약)
    if (babylonEngine) {
        babylonEngine.stopRenderLoop();
    }
}

// 3D 카메라 초기화 함수
function reset3DCamera() {
    // 씬이나 카메라가 없으면 중단
    if (!babylonScene || !babylonScene.activeCamera) return;

    const camera = babylonScene.activeCamera;

    // createScene에서 저장해둔 초기값(_initial...)이 있는지 확인
    if (camera._initialState) {
        // 부드럽게 돌아오는 애니메이션 효과를 원하면 Animation 라이브러리를 써야 하지만,
        // 여기서는 즉각적인 반응을 위해 값을 바로 대입합니다.
        
        // 1. 타겟 복구
        camera.setTarget(camera._initialState.target.clone());
        
        // 2. 회전각 및 거리 복구
        camera.alpha = camera._initialState.alpha;
        camera.beta = camera._initialState.beta;
        camera.radius = camera._initialState.radius;
    }
}

function createScene(canvas, linesData) {
    const scene = new BABYLON.Scene(babylonEngine);
    
    // 배경색: 어두운 회색
    scene.clearColor = new BABYLON.Color4(0.1, 0.1, 0.1, 1);

    // Bounds(경계) 계산을 위한 변수 초기화
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    // 라인 배열 준비 (용도별 분류)
    let extLines = [];    // 외형선
    let intLines = [];    // 숨은선/내측선
    let centerLines = []; // 중심선

    // 1. 데이터 분류 및 Min/Max 좌표 계산
    linesData.forEach(l => {
        // Babylon은 Y-up 좌표계입니다. (입력 데이터: x, y, z 그대로 사용)
        const p1 = new BABYLON.Vector3(l.x1, l.y1, l.z1);
        const p2 = new BABYLON.Vector3(l.x2, l.y2, l.z2);
        const path = [p1, p2];

        // Min/Max 갱신
        minX = Math.min(minX, l.x1, l.x2); maxX = Math.max(maxX, l.x1, l.x2);
        minY = Math.min(minY, l.y1, l.y2); maxY = Math.max(maxY, l.y1, l.y2);
        minZ = Math.min(minZ, l.z1, l.z2); maxZ = Math.max(maxZ, l.z1, l.z2);

        // 스타일 분류 (이름 > 파트 순)
        if (l.name && ['ptc', 'pbc', 'ptsc', 'pbsc'].includes(l.name)) {
            centerLines.push(path);
        } else if (['int', 'internal', 'hidden_part'].includes(l.part)) {
            intLines.push(path);
        } else {
            extLines.push(path);
        }
    });

    // 2. Mesh 생성 (LineSystem 사용 - 성능 최적화)
    
    // (A) 외측선 (Cyan)
    if (extLines.length > 0) {
        const extMesh = BABYLON.MeshBuilder.CreateLineSystem("ext", { lines: extLines }, scene);
        extMesh.color = new BABYLON.Color3(0, 1, 1); 
    }
    // (B) 내측선 (Gray + 투명도)
    if (intLines.length > 0) {
        const intMesh = BABYLON.MeshBuilder.CreateLineSystem("int", { lines: intLines }, scene);
        intMesh.color = new BABYLON.Color3(0.5, 0.5, 0.5); 
        intMesh.alpha = 0.5; // 약간 흐리게
    }
    // (C) 중심선 (Red)
    if (centerLines.length > 0) {
        const centerMesh = BABYLON.MeshBuilder.CreateLineSystem("center", { lines: centerLines }, scene);
        centerMesh.color = new BABYLON.Color3(1, 0, 0); 
    }

    // 3. 카메라 타겟 자동 설정 (모델의 중심으로)
    // 데이터가 없는 경우를 대비한 방어 코드
    if (minX === Infinity) { minX=0; maxX=0; minY=0; maxY=0; minZ=0; maxZ=0; }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;
    
    // 모델 크기(대각선 길이) 계산 - 줌/이동 감도 조절용
    const sizeX = Math.abs(maxX - minX);
    const sizeY = Math.abs(maxY - minY);
    const sizeZ = Math.abs(maxZ - minZ);
    const diagonal = Math.sqrt(sizeX*sizeX + sizeY*sizeY + sizeZ*sizeZ) || 100;

    // 4. 카메라 생성 및 설정
    // ⭐ [ISO View 초기값 설정]
    // Alpha(수평 회전): -Math.PI / 4 (45도 대각선 방향)
    // Beta(수직 회전): Math.PI / 3 (60도, 위에서 아래로 내려다봄)
    const initAlpha = -Math.PI / 4;  
    const initBeta = Math.PI / 3;    
    const initRadius = diagonal * 1.5; // 모델 전체가 보이도록 거리 설정
    const initTarget = new BABYLON.Vector3(centerX, centerY, centerZ);

    const camera = new BABYLON.ArcRotateCamera("camera", initAlpha, initBeta, initRadius, initTarget, scene);
    
    // ⭐ [Reset 기능을 위한 초기 상태 저장]
    camera._initialState = {
        alpha: initAlpha,
        beta: initBeta,
        radius: initRadius,
        target: initTarget.clone()
    };

    // ⭐ [대형 모델을 위한 조작감 보정]
    camera.wheelDeltaPercentage = 0.01; 
    camera.panningSensibility = 10000 / (diagonal || 1); 
    camera.minZ = 1; 
    camera.maxZ = diagonal * 10; 

    // 마우스 컨트롤 연결
    camera.attachControl(canvas, true);

    // 5. 조명 추가
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 1.0;

    return scene;
}



// ==========================================================
// 3. Integrated Clipped View Engine (3D Wireframe -> 2D Projection)
/*
*  26.01.02
*/
function process_clipped_view_3d(lines3D, clipDef, viewMode, bShowGuides = false) {
    let resultLines = [];
    const vec = {
        sub: (v1, v2) => ({ x: v1.x - v2.x, y: v1.y - v2.y, z: v1.z - v2.z }),
        cross: (v1, v2) => ({ x: v1.y * v2.z - v1.z * v2.y, y: v1.z * v2.x - v1.x * v2.z, z: v1.x * v2.y - v1.y * v2.x }),
        dot: (v1, v2) => v1.x * v2.x + v1.y * v2.y + v1.z * v2.z,
        add: (v1, v2) => ({ x: v1.x + v2.x, y: v1.y + v2.y, z: v1.z + v2.z }),
        scale: (v, s) => ({ x: v.x * s, y: v.y * s, z: v.z * s }),
        normalize: (v) => {
            const len = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
            return len < 1e-10 ? {x:0, y:0, z:0} : { x: v.x/len, y: v.y/len, z: v.z/len };
        }
    };

    const s = clipDef.startPts; 
    const e = clipDef.endPts;
    const center = { x: (s[0].x + e[2].x)/2, y: (s[0].y + e[2].y)/2, z: (s[0].z + e[2].z)/2 };

    function createPlaneInward(p1, p2, p3) {
        const v1 = vec.sub(p2, p1), v2 = vec.sub(p3, p1);
        let normal = vec.normalize(vec.cross(v1, v2));
        let D = -vec.dot(normal, p1);
        if (vec.dot(normal, center) + D < 0) {
            normal = vec.scale(normal, -1);
            D = -vec.dot(normal, p1);
        }
        return { normal, D };
    }

    const planes = [
        createPlaneInward(s[0], s[1], e[1]), createPlaneInward(s[1], s[2], e[2]),
        createPlaneInward(s[2], s[3], e[3]), createPlaneInward(s[3], s[0], e[0]),
        createPlaneInward(s[0], s[1], s[2]), createPlaneInward(e[0], e[1], e[2])
    ];

    function clipLine3D(p1, p2) {
        let tMin = 0.0, tMax = 1.0;
        const dir = vec.sub(p2, p1);
        for (const plane of planes) {
            const dist = vec.dot(plane.normal, p1) + plane.D;
            const denom = vec.dot(plane.normal, dir);
            if (Math.abs(denom) < 1e-10) {
                if (dist < -1e-5) return null;
            } else {
                const t = -dist / denom;
                if (denom > 0) tMin = Math.max(tMin, t);
                else tMax = Math.min(tMax, t);
            }
        }
        if (tMin > tMax + 1e-10) return null;
        return { p1: vec.add(p1, vec.scale(dir, Math.max(0, tMin))), p2: vec.add(p1, vec.scale(dir, Math.min(1, tMax))) };
    }

    function project(pt) {
        return viewMode === 'PLAN' ? { x: pt.z, y: pt.x } : { x: pt.z, y: pt.y };
    }

    lines3D.forEach(line => {
        const clipped = clipLine3D({x:line.x1, y:line.y1, z:line.z1}, {x:line.x2, y:line.y2, z:line.z2});
        if (clipped) {
            const p1 = project(clipped.p1), p2 = project(clipped.p2);
            resultLines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, part: line.part });
        }
    });

    return resultLines;
}
      

/*
    let obox1cell_b = geo_box1cell(aparam_b);
    let obox1cell_e = geo_box1cell(aparam_e);
    
    let wireframe3D = generate3DWireframe(obox1cell_b, obox1cell_e, 0, dseg_leng);      
    
    let clipRangeDef = {
        start: {
            z: -100, 
            yTop: 1000,     xMinTop: -10000,    xMaxTop: 10000, 
            yBottom: -9000, xMinBottom: -10000, xMaxBottom: 10000 
        },
        end: {
            z: dseg_leng + 100,
            yTop: 1000,     xMinTop: -10000,    xMaxTop: 10000,  
            yBottom: -9000, xMinBottom: -10000, xMaxBottom: 10000 
        }
    };
    
    // ⭐ [수정] 마지막 인자: showGuides (true: 표시, false: 숨김)
    const bShowGuides = true; // 가이드 라인 숨김

    const lines2D = process_integrated_view_3d(
        wireframe3D.lines,  
        dseg_leng, 
        clipRangeDef, 
        'PLAN',  // PLAN / SIDE
        bShowGuides 
    );      
*/



// ==========================================================
// 3. Logic: 3D Generation & View Processing
// ==========================================================
function generate3DWireframe_old(sectionStart, sectionEnd, zStart, zEnd) {
    let lines3D = [];

// --- 1. 단면 선분(Transverse) 추가 로직 ---
    const addSectionDataTo3D = (section, z, sectionType) => {
        // (1) 일반 직선(lines) 추가
        section.lines.forEach(l => {
            lines3D.push({
                x1: l.x1, y1: l.y1, z1: z,
                x2: l.x2, y2: l.y2, z2: z,
                part: l.part,
                name: "transverse_line"
            });
        });

        // (2) 호(arcs)를 직선으로 변환하여 추가 ⭐
        // 호의 시작점(angb)과 끝점(ange) 좌표를 계산하여 연결
        if (section.arcs) {
            section.arcs.forEach(a => {
                const rb = a.r;
                const angbRad = a.angb * (Math.PI / 180);
                const angeRad = a.ange * (Math.PI / 180);

                // 호의 시작점 좌표
                const xStart = a.x + rb * Math.cos(angbRad);
                const yStart = a.y + rb * Math.sin(angbRad);
                
                // 호의 끝점 좌표
                const xEnd = a.x + rb * Math.cos(angeRad);
                const yEnd = a.y + rb * Math.sin(angeRad);

                lines3D.push({
                    x1: xStart, y1: yStart, z1: z,
                    x2: xEnd,   y2: yEnd,   z2: z,
                    part: a.part,
                    name: "transverse_arc_chord" // 호의 현(Chord)임을 명시
                });
            });
        }
    };

    addSectionDataTo3D(sectionStart, zStart, "start_section");
    addSectionDataTo3D(sectionEnd, zEnd, "end_section");

    // [수정] Point Map 생성 시 part 정보 보존
    const createPointMap = (pointArr) => {
        const map = {};
        pointArr.forEach(item => {
            if (item.name && item[item.name]) {
                // 좌표와 함께 part 정보도 복사
                map[item.name] = { ...item[item.name], part: item.part };
            }
        });
        return map;
    };

    const mapStart = createPointMap(sectionStart.points);
    const mapEnd = createPointMap(sectionEnd.points);

    for (const [key, ptS] of Object.entries(mapStart)) {
        const ptE = mapEnd[key];
        if (ptE) {
            
            lines3D.push({
                x1: ptS.x, y1: ptS.y, z1: zStart,
                x2: ptE.x, y2: ptE.y, z2: zEnd,
                part: ptS.part, 
                name: key
            });
        }
    }

    return { lines: lines3D };
}


