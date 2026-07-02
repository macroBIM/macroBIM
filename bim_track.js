/*
    Track (stadium/oval) cross-section drawing module
    - B/D: outer width/height (total including semicircles)
    - d: inner height (hollow track shape)
    - Semicircle radius = D/2, straight section = B - D
    - hollow option: true=hollow, false=solid
    - Begin/End (Front/Back) support
    - 3D (left) + tabbed 2D (right) pattern
*/
const odxf_track = dxf_generator();
const scvs_track = "trackplot";

const _TRACK_KEYS = ['dtrack_B', 'dtrack_D', 'dtrack_d'];

function getParams_track() {
    const getValue = (id) => {
        const el = document.getElementById(id);
        return el ? Number(el.value) : 0;
    };

    let aparam_b = {};
    let aparam_e = {};
    _TRACK_KEYS.forEach(k => {
        aparam_b[k] = getValue(k + '_s');
        aparam_e[k] = getValue(k + '_e');
    });
    let chk = document.getElementById('dtrack_hollow');
    aparam_b.hollow = chk ? chk.checked : true;
    aparam_e.hollow = aparam_b.hollow;

    let dseg_leng = getValue('dseg_leng');

    let combText = _TRACK_KEYS.map(k => aparam_b[k]).join(',') + ',' +
                   _TRACK_KEYS.map(k => aparam_e[k]).join(',') + ',' +
                   (aparam_b.hollow ? '1' : '0');
    return { aparam_b, aparam_e, dseg_leng, combText };
}

function putParams_track(textareaId) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;
    const lines = textarea.value.split('\n');
    if (lines.length < 1) return;
    const values = (lines[0] || '').split(',');

    _TRACK_KEYS.forEach((key, index) => {
        if (values[index] !== undefined) {
            const el = document.getElementById(key + '_s');
            if (el) el.value = values[index].trim();
        }
    });
    _TRACK_KEYS.forEach((key, index) => {
        let vi = index + 3;
        if (values[vi] !== undefined) {
            const el = document.getElementById(key + '_e');
            if (el) el.value = values[vi].trim();
        }
    });
    if (values[6] !== undefined) {
        let chk = document.getElementById('dtrack_hollow');
        if (chk) chk.checked = values[6].trim() === '1';
    }
    const dseg_leng = lines.length >= 2 ? lines[1] : '';
    if (dseg_leng !== undefined && dseg_leng !== '') {
        const el = document.getElementById('dseg_leng');
        if (el) el.value = String(dseg_leng).trim();
    }
    if (typeof fdraw_track === 'function') fdraw_track();
}

/*
    _trackOutline: generate polygon approximation of a track (stadium) shape.
    cx, cy = center of shape; w = total width; h = total height (= semicircle diameter)
    Origin is bottom-center, so cy = h/2.
    Returns array of {x, y} points (counterclockwise).
    nSeg = number of segments per semicircle (default 32).
*/
function _trackOutline(w, h, nSeg) {
    nSeg = nSeg || 32;
    var pts = [];
    var r = h / 2;
    var straightHalf = (w - h) / 2;
    if (straightHalf < 0) straightHalf = 0;
    var cy = h / 2;

    // Bottom straight line: right to left (we build CCW)
    // Start at bottom-right of right semicircle, go along bottom, then left semicircle, top, right semicircle

    // Right semicircle: center at (straightHalf, cy), from -90 deg to +90 deg
    for (var i = 0; i <= nSeg; i++) {
        var ang = (-Math.PI / 2) + (Math.PI * i / nSeg);
        pts.push({ x: straightHalf + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
    }
    // Top straight line: from right semicircle top to left semicircle top (right to left)
    // Already at (straightHalf, cy + r) = (straightHalf, h), next point is (-straightHalf, h)
    // Left semicircle: center at (-straightHalf, cy), from +90 deg to +270 deg
    for (var i = 0; i <= nSeg; i++) {
        var ang = (Math.PI / 2) + (Math.PI * i / nSeg);
        pts.push({ x: -straightHalf + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
    }
    // Bottom straight line closes back to start point automatically

    return pts;
}

/*
    geo_track: track (stadium) cross-section (origin = bottom-center)
    B = outer width, D = outer height, d = inner height; hollow = bool
    Inner width = B - (D - d) (uniform wall thickness)
    Returns { points, lines, arcs, outerOutline, innerOutline }
*/
function geo_track({ dtrack_B, dtrack_D, dtrack_d, hollow }) {
    var B = dtrack_B, D = dtrack_D, d = dtrack_d;
    var opts = [], olines = [], oarcs = [];

    var r = D / 2;
    var straightHalf = (B - D) / 2;
    if (straightHalf < 0) straightHalf = 0;

    // Key points for dimensioning
    var ptop   = { x: 0, y: D };
    var pbot   = { x: 0, y: 0 };
    var pleft  = { x: -B / 2, y: D / 2 };
    var pright = { x:  B / 2, y: D / 2 };
    var ptl    = { x: -straightHalf, y: D };
    var ptr    = { x:  straightHalf, y: D };
    var pbl    = { x: -straightHalf, y: 0 };
    var pbr    = { x:  straightHalf, y: 0 };

    [['ptop', ptop], ['pbot', pbot], ['pleft', pleft], ['pright', pright],
     ['ptl', ptl], ['ptr', ptr], ['pbl', pbl], ['pbr', pbr]
    ].forEach(([n, p]) => opts.push({ [n]: p, name: n }));

    // DXF arcs for outer shape
    // Left semicircle: center (-straightHalf, D/2), r=D/2, from 90 to 270 deg
    oarcs.push({ x: -straightHalf, y: D / 2, r: r, angb: 90, ange: 270 });
    // Right semicircle: center (straightHalf, D/2), r=D/2, from 270 to 90 deg (i.e. -90 to 90)
    oarcs.push({ x: straightHalf, y: D / 2, r: r, angb: 270, ange: 90 });

    // DXF lines for outer straight segments
    // Top: left to right
    if (straightHalf > 0) {
        olines.push({ x1: -straightHalf, y1: D, x2: straightHalf, y2: D });
        // Bottom: right to left
        olines.push({ x1: straightHalf, y1: 0, x2: -straightHalf, y2: 0 });
    }

    // Polygon outline for 3D and Konva
    var outerOutline = _trackOutline(B, D, 32);
    var innerOutline = null;

    if (hollow && d > 0 && d < D) {
        var innerW = B - (D - d);
        if (innerW > 0) {
            var ri = d / 2;
            var innerStraightHalf = (innerW - d) / 2;
            if (innerStraightHalf < 0) innerStraightHalf = 0;

            // Offset so inner is centered vertically
            var wallThick = (D - d) / 2;

            // Inner key points
            var itop   = { x: 0, y: D / 2 + d / 2 };
            var ibot   = { x: 0, y: D / 2 - d / 2 };
            var ileft  = { x: -innerW / 2, y: D / 2 };
            var iright = { x:  innerW / 2, y: D / 2 };

            [['itop', itop], ['ibot', ibot], ['ileft', ileft], ['iright', iright]
            ].forEach(([n, p]) => opts.push({ [n]: p, name: n }));

            // Inner arcs
            oarcs.push({ x: -innerStraightHalf, y: D / 2, r: ri, angb: 90, ange: 270 });
            oarcs.push({ x: innerStraightHalf, y: D / 2, r: ri, angb: 270, ange: 90 });

            // Inner straight lines
            if (innerStraightHalf > 0) {
                olines.push({ x1: -innerStraightHalf, y1: D / 2 + ri, x2: innerStraightHalf, y2: D / 2 + ri });
                olines.push({ x1: innerStraightHalf, y1: D / 2 - ri, x2: -innerStraightHalf, y2: D / 2 - ri });
            }

            // Inner polygon outline offset vertically to center
            var rawInner = _trackOutline(innerW, d, 32);
            // Shift up by wallThick (rawInner has origin at bottom-center with y from 0..d)
            innerOutline = rawInner.map(p => ({ x: p.x, y: p.y + wallThick }));
        }
    }

    return { points: opts, lines: olines, arcs: oarcs, outerOutline, innerOutline };
}

var _track_drawData = null;

function fdraw_track() {
    var alayer = ['track_solid', 'track_hidden', 'track_center'];

    var _container = document.getElementById(scvs_track);
    if (!_container) return;
    _container.innerHTML = '';
    _container.style.display = 'flex';
    _container.style.gap = '2px';
    _container.style.backgroundColor = '#000';
    _container.style.height = '560px';

    var div3d = document.createElement('div');
    div3d.id = 'track3d';
    div3d.style.cssText = 'width:50%;height:560px;background:#1a1a2e;';
    _container.appendChild(div3d);

    var divRight = document.createElement('div');
    divRight.style.cssText = 'width:50%;height:560px;';

    var tabBar = document.createElement('div');
    tabBar.style.cssText = 'display:flex;gap:2px;padding:4px;background:#1e293b;flex-wrap:wrap;height:34px;box-sizing:border-box;';
    ['Front', 'Back', 'Left', 'Right', 'Top', 'Bottom'].forEach(function (name, i) {
        var btn = document.createElement('button');
        btn.textContent = name;
        btn.id = 'track_tab_' + name.toLowerCase();
        btn.style.cssText = 'padding:4px 10px;border:1px solid #475569;background:' +
            (i === 0 ? '#2563eb' : '#334155') + ';color:' +
            (i === 0 ? '#fff' : '#94a3b8') +
            ';cursor:pointer;border-radius:4px;font-size:11px;font-weight:600;';
        btn.onclick = function () { fdraw_track_2d(name.toLowerCase()); };
        tabBar.appendChild(btn);
    });
    divRight.appendChild(tabBar);

    var viewport2d = document.createElement('div');
    viewport2d.id = 'track_2dview';
    viewport2d.style.cssText = 'width:100%;height:526px;background:#000;';
    divRight.appendChild(viewport2d);
    _container.appendChild(divRight);

    odxf_track.init();
    odxf_track.layer(alayer[0], 4, "CONTINUOUS");
    odxf_track.layer(alayer[1], 4, "HIDDEN");
    odxf_track.layer(alayer[2], 1, "CENTER");

    let auserdata = getParams_track();
    let aparam_b = auserdata.aparam_b;
    let aparam_e = auserdata.aparam_e;
    let dseg_leng = auserdata.dseg_leng;

    let ouserTextArea = document.getElementById('sUserText');
    if (ouserTextArea) ouserTextArea.value = auserdata.combText + "\n" + dseg_leng;

    let geoBegin = geo_track(aparam_b);
    let geoEnd = geo_track(aparam_e);

    // ── DXF layout ──
    let Bb = aparam_b.dtrack_B, Db = aparam_b.dtrack_D;
    let Be = aparam_e.dtrack_B, De = aparam_e.dtrack_D;
    let Dmax = Math.max(Db, De), Bmax = Math.max(Bb, Be);
    let half = dseg_leng / 2;
    let gap = Math.max(Dmax, Bmax) * 0.4;
    let _col = Math.max(Bmax, dseg_leng) * 1.5;

    // Row0 col0: Front (begin) cross-section at origin
    geoBegin.arcs.forEach(a => odxf_track.arc(a.x, a.y, a.r, a.angb, a.ange, alayer[0]));
    geoBegin.lines.forEach(l => odxf_track.line(l.x1, l.y1, l.x2, l.y2, alayer[0]));

    // Row0 col1: Back (end) cross-section
    geoEnd.arcs.forEach(a => odxf_track.arc(a.x + _col, a.y, a.r, a.angb, a.ange, alayer[0]));
    geoEnd.lines.forEach(l => odxf_track.line(l.x1 + _col, l.y1, l.x2 + _col, l.y2, alayer[0]));

    // Row1: Top and Bottom views (tapered B from begin to end)
    let oy_top = Dmax + gap + half;
    let ox_top = 0;
    // Top view -- outer trapezoid
    odxf_track.line(ox_top - Bb / 2, oy_top - half, ox_top - Be / 2, oy_top + half, alayer[0]);
    odxf_track.line(ox_top - Be / 2, oy_top + half, ox_top + Be / 2, oy_top + half, alayer[0]);
    odxf_track.line(ox_top + Be / 2, oy_top + half, ox_top + Bb / 2, oy_top - half, alayer[0]);
    odxf_track.line(ox_top + Bb / 2, oy_top - half, ox_top - Bb / 2, oy_top - half, alayer[0]);
    if (geoBegin.innerOutline && geoEnd.innerOutline) {
        let db = aparam_b.dtrack_d, de = aparam_e.dtrack_d;
        let iwb = Bb - (Db - db), iwe = Be - (De - de);
        odxf_track.line(ox_top - iwb / 2, oy_top - half, ox_top - iwe / 2, oy_top + half, alayer[1]);
        odxf_track.line(ox_top + iwb / 2, oy_top - half, ox_top + iwe / 2, oy_top + half, alayer[1]);
    }

    // Bottom view
    let ox_bot = _col, oy_bot = oy_top;
    odxf_track.line(ox_bot - Bb / 2, oy_bot - half, ox_bot - Be / 2, oy_bot + half, alayer[0]);
    odxf_track.line(ox_bot - Be / 2, oy_bot + half, ox_bot + Be / 2, oy_bot + half, alayer[0]);
    odxf_track.line(ox_bot + Be / 2, oy_bot + half, ox_bot + Bb / 2, oy_bot - half, alayer[0]);
    odxf_track.line(ox_bot + Bb / 2, oy_bot - half, ox_bot - Bb / 2, oy_bot - half, alayer[0]);
    if (geoBegin.innerOutline && geoEnd.innerOutline) {
        let db = aparam_b.dtrack_d, de = aparam_e.dtrack_d;
        let iwb = Bb - (Db - db), iwe = Be - (De - de);
        odxf_track.line(ox_bot - iwb / 2, oy_bot - half, ox_bot - iwe / 2, oy_bot + half, alayer[1]);
        odxf_track.line(ox_bot + iwb / 2, oy_bot - half, ox_bot + iwe / 2, oy_bot + half, alayer[1]);
    }

    // Row2: Left/Right side view (tapered D x Length)
    let oy_side = oy_top + half + gap;
    let ox_side = 0;
    odxf_track.line(ox_side - half, oy_side,       ox_side + half, oy_side,       alayer[0]);
    odxf_track.line(ox_side + half, oy_side,       ox_side + half, oy_side + De,  alayer[0]);
    odxf_track.line(ox_side + half, oy_side + De,  ox_side - half, oy_side + Db,  alayer[0]);
    odxf_track.line(ox_side - half, oy_side + Db,  ox_side - half, oy_side,       alayer[0]);
    if (geoBegin.innerOutline && geoEnd.innerOutline) {
        let db = aparam_b.dtrack_d, de = aparam_e.dtrack_d;
        let cyb = Db / 2, cye = De / 2;
        odxf_track.line(ox_side - half, oy_side + cyb - db / 2, ox_side + half, oy_side + cye - de / 2, alayer[1]);
        odxf_track.line(ox_side - half, oy_side + cyb + db / 2, ox_side + half, oy_side + cye + de / 2, alayer[1]);
    }

    _track_drawData = { geoBegin, geoEnd, aparam_b, aparam_e, dseg_leng, alayer };

    // ── 3D ──
    function _render3d() {
        if (typeof render_track_3d === 'function' && typeof THREE !== 'undefined') {
            render_track_3d('track3d', geoBegin, geoEnd, dseg_leng);
            return;
        }
        var msg = document.getElementById('track3d');
        if (msg) msg.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;font-size:14px;">3D Loading...</div>';
        var urls = [];
        if (typeof THREE === 'undefined') {
            urls.push('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
            urls.push('https://unpkg.com/three@0.128.0/examples/js/controls/OrbitControls.js');
        }
        if (typeof render_track_3d !== 'function') {
            urls.push('https://macrobim.github.io/macroBIM/bim_track_3d.js');
        }
        (function loadNext(i) {
            if (i >= urls.length) {
                if (typeof render_track_3d === 'function') render_track_3d('track3d', geoBegin, geoEnd, dseg_leng);
                return;
            }
            var s = document.createElement('script');
            s.src = urls[i];
            s.onload = function () { loadNext(i + 1); };
            s.onerror = function () { loadNext(i + 1); };
            document.head.appendChild(s);
        })(0);
    }
    _render3d();

    fdraw_track_2d('front');
}

function fdraw_track_2d(viewName) {
    if (!_track_drawData) return;
    var data = _track_drawData;
    var geoBegin = data.geoBegin;
    var geoEnd = data.geoEnd;
    var aparam_b = data.aparam_b;
    var aparam_e = data.aparam_e;
    var dseg_leng = data.dseg_leng;
    var alayer = data.alayer;

    ['front', 'back', 'left', 'right', 'top', 'bottom'].forEach(function (name) {
        var btn = document.getElementById('track_tab_' + name);
        if (!btn) return;
        if (name === viewName) {
            btn.style.background = '#2563eb'; btn.style.color = '#fff'; btn.style.borderColor = '#2563eb';
        } else {
            btn.style.background = '#334155'; btn.style.color = '#94a3b8'; btn.style.borderColor = '#475569';
        }
    });

    var ocvs = new KonvaViewer('track_2dview', {
        gridCols: 1, layout: [{ views: [viewName], span: 1 }]
    });
    ocvs.addLayer(alayer[0], 'cyan', 'solid', 1.5);
    ocvs.addLayer(alayer[1], 'cyan', 'hidden', 1.5);
    ocvs.addLayer(alayer[2], 'red', 'solid', 1.5);

    var half = dseg_leng / 2;
    var Bb = aparam_b.dtrack_B, Db = aparam_b.dtrack_D, db = aparam_b.dtrack_d;
    var Be = aparam_e.dtrack_B, De = aparam_e.dtrack_D, de = aparam_e.dtrack_d;
    var Dmax = Math.max(Db, De), Bmax = Math.max(Bb, Be);
    var ddim_off = Math.max(Dmax, Bmax) * 0.04, ddim_ext = Math.max(Dmax, Bmax) * 0.04;

    if (viewName === 'front' || viewName === 'back') {
        var geo = (viewName === 'front') ? geoBegin : geoEnd;
        var ap = (viewName === 'front') ? aparam_b : aparam_e;
        var B = ap.dtrack_B, D = ap.dtrack_D, d_inner = ap.dtrack_d;

        // Draw arcs and lines
        geo.arcs.forEach(a => ocvs.addArc(viewName, a.x, a.y, a.r, a.angb, a.ange, alayer[0]));
        geo.lines.forEach(l => ocvs.addLine(viewName, l.x1, l.y1, l.x2, l.y2, alayer[0]));

        // Dimensions
        function gp(name) { var f = geo.points.find(p => p.name === name); return f ? Object.assign({}, f[name]) : { x: 0, y: 0 }; }
        var pleft = gp('pleft'), pright = gp('pright'), ptop = gp('ptop'), pbot = gp('pbot');

        // Height dimension on left side
        ocvs.addDimLinear(viewName, -B / 2 - ddim_off, 0, -B / 2 - ddim_off, D, ddim_ext * 6);
        // Width dimension on top
        ocvs.addDimLinear(viewName, -B / 2, D + ddim_off, B / 2, D + ddim_off, ddim_ext * 6);
        // Width dimension on bottom
        ocvs.addDimLinear(viewName, -B / 2, -ddim_off, B / 2, -ddim_off, ddim_ext * -6);

        if (ap.hollow && d_inner > 0 && d_inner < D) {
            var innerW = B - (D - d_inner);
            if (innerW > 0) {
                // Inner height dimension on right side
                ocvs.addDimLinear(viewName, B / 2 + ddim_off, D / 2 - d_inner / 2, B / 2 + ddim_off, D / 2 + d_inner / 2, ddim_ext * 6);
            }
        }

    } else if (viewName === 'top' || viewName === 'bottom') {
        // Tapered plan view: B changes from Bb to Be over length
        ocvs.addLine(viewName, -Bb / 2, -half, -Be / 2, half, alayer[0]);
        ocvs.addLine(viewName, -Be / 2, half, Be / 2, half, alayer[0]);
        ocvs.addLine(viewName, Be / 2, half, Bb / 2, -half, alayer[0]);
        ocvs.addLine(viewName, Bb / 2, -half, -Bb / 2, -half, alayer[0]);

        var hasHoleB = aparam_b.hollow && db > 0 && db < Db;
        var hasHoleE = aparam_e.hollow && de > 0 && de < De;
        if (hasHoleB && hasHoleE) {
            var iwb = Bb - (Db - db), iwe = Be - (De - de);
            ocvs.addLine(viewName, -iwb / 2, -half, -iwe / 2, half, alayer[1]);
            ocvs.addLine(viewName, iwb / 2, -half, iwe / 2, half, alayer[1]);
        }
        ocvs.addDimLinear(viewName, -Bmax / 2 - ddim_off, -half, -Bmax / 2 - ddim_off, half, ddim_ext * 6);
        ocvs.addDimLinear(viewName, -Bb / 2, -half - ddim_off, Bb / 2, -half - ddim_off, ddim_ext * -6);
        ocvs.addDimLinear(viewName, -Be / 2, half + ddim_off, Be / 2, half + ddim_off, ddim_ext * 6);

    } else if (viewName === 'left' || viewName === 'right') {
        // Tapered side view: D changes from Db to De over length
        ocvs.addLine(viewName, -half, 0, half, 0, alayer[0]);
        ocvs.addLine(viewName, half, 0, half, De, alayer[0]);
        ocvs.addLine(viewName, half, De, -half, Db, alayer[0]);
        ocvs.addLine(viewName, -half, Db, -half, 0, alayer[0]);

        var hasHoleB = aparam_b.hollow && db > 0 && db < Db;
        var hasHoleE = aparam_e.hollow && de > 0 && de < De;
        if (hasHoleB && hasHoleE) {
            var cyb = Db / 2, cye = De / 2;
            ocvs.addLine(viewName, -half, cyb - db / 2, half, cye - de / 2, alayer[1]);
            ocvs.addLine(viewName, -half, cyb + db / 2, half, cye + de / 2, alayer[1]);
        }
        ocvs.addDimLinear(viewName, -half - ddim_off, 0, -half - ddim_off, Db, ddim_ext * 6);
        ocvs.addDimLinear(viewName, half + ddim_off, 0, half + ddim_off, De, ddim_ext * 6);
        ocvs.addDimLinear(viewName, -half, Dmax + ddim_off, half, Dmax + ddim_off, ddim_ext * 6);
    }

    ocvs.render();
}
