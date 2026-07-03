/*
    Circle (원형) 단면 작도를 위한 JS
    - D: 외경(outer diameter), d: 내경(inner diameter)
    - t = (D-d)/2 벽두께 (informational)
    - hollow 옵션: true=중공, false=충실
    - Begin/End (Front/Back) 지원
    - 3D (left) + tabbed 2D (right) 패턴
*/
const odxf_circle = dxf_generator();
const scvs_circle = "circleplot";

const _CIRCLE_KEYS = ['dcircle_D', 'dcircle_d'];

function getParams_circle() {
    const getValue = (id) => {
        const el = document.getElementById(id);
        return el ? Number(el.value) : 0;
    };

    let aparam_b = {};
    let aparam_e = {};
    _CIRCLE_KEYS.forEach(k => {
        aparam_b[k] = getValue(k + '_s');
        aparam_e[k] = getValue(k + '_e');
    });
    let chk = document.getElementById('dcircle_hollow');
    aparam_b.hollow = chk ? chk.checked : true;
    aparam_e.hollow = aparam_b.hollow;

    let dseg_leng = getValue('dseg_leng');

    let combText = _CIRCLE_KEYS.map(k => aparam_b[k]).join(',') + ',' +
                   _CIRCLE_KEYS.map(k => aparam_e[k]).join(',') + ',' +
                   (aparam_b.hollow ? '1' : '0');
    return { aparam_b, aparam_e, dseg_leng, combText };
}

function putParams_circle(textareaId) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;
    const lines = textarea.value.split('\n');
    if (lines.length < 1) return;
    const values = (lines[0] || '').split(',');

    // line1: D_s, d_s, D_e, d_e, hollow(1/0)
    _CIRCLE_KEYS.forEach((key, index) => {
        if (values[index] !== undefined) {
            const el = document.getElementById(key + '_s');
            if (el) el.value = values[index].trim();
        }
    });
    _CIRCLE_KEYS.forEach((key, index) => {
        let vi = index + 2;
        if (values[vi] !== undefined) {
            const el = document.getElementById(key + '_e');
            if (el) el.value = values[vi].trim();
        }
    });
    if (values[4] !== undefined) {
        let chk = document.getElementById('dcircle_hollow');
        if (chk) chk.checked = values[4].trim() === '1';
    }
    const dseg_leng = lines.length >= 2 ? lines[1] : '';
    if (dseg_leng !== undefined && dseg_leng !== '') {
        const el = document.getElementById('dseg_leng');
        if (el) el.value = String(dseg_leng).trim();
    }
    if (typeof fdraw_circle === 'function') fdraw_circle();
}

/*
    geo_circle: circular cross-section (origin = bottom-center, center at (0, D/2))
    D = outer diameter, d = inner diameter; hollow = bool
    Returns { points, lines, arcs, outerOutline, innerOutline }
*/
function geo_circle({ dcircle_D, dcircle_d, hollow }) {
    var D = dcircle_D, d = dcircle_d;
    var opts = [], olines = [], oarcs = [];
    var cx = 0, cy = D / 2;
    var R = D / 2;
    var NSEG = 64;

    // Named reference points
    [['ptop', { x: 0, y: D }],
     ['pbot', { x: 0, y: 0 }],
     ['pleft', { x: -D / 2, y: D / 2 }],
     ['pright', { x: D / 2, y: D / 2 }]
    ].forEach(([n, p]) => opts.push({ [n]: p, name: n }));

    // Outer circle arc for DXF
    oarcs.push({ x: cx, y: cy, r: R, angb: 0, ange: 360 });

    // Outer outline (polygon approximation for 3D / shape ops)
    var outerOutline = [];
    for (var i = 0; i < NSEG; i++) {
        var ang = (2 * Math.PI * i) / NSEG;
        outerOutline.push({ x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang) });
    }

    var innerOutline = null;
    if (hollow && d > 0 && d < D) {
        var r = d / 2;
        oarcs.push({ x: cx, y: cy, r: r, angb: 0, ange: 360 });

        innerOutline = [];
        for (var i = 0; i < NSEG; i++) {
            var ang = (2 * Math.PI * i) / NSEG;
            innerOutline.push({ x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
        }
    }

    return { points: opts, lines: olines, arcs: oarcs, outerOutline, innerOutline };
}

var _circle_drawData = null;

function fdraw_circle() {
    var alayer = ['circle_solid', 'circle_hidden', 'circle_center'];

    var _container = document.getElementById(scvs_circle);
    if (!_container) return;
    _container.innerHTML = '';
    _container.style.display = 'flex';
    _container.style.gap = '2px';
    _container.style.backgroundColor = '#000';
    _container.style.height = '560px';

    var div3d = document.createElement('div');
    div3d.id = 'circle3d';
    div3d.style.cssText = 'width:50%;height:560px;background:#1a1a2e;';
    _container.appendChild(div3d);

    var divRight = document.createElement('div');
    divRight.style.cssText = 'width:50%;height:560px;';

    var tabBar = document.createElement('div');
    tabBar.style.cssText = 'display:flex;gap:2px;padding:4px;background:#1e293b;flex-wrap:wrap;height:34px;box-sizing:border-box;';
    ['Front', 'Back', 'Left', 'Right', 'Top', 'Bottom'].forEach(function (name, i) {
        var btn = document.createElement('button');
        btn.textContent = name;
        btn.id = 'circle_tab_' + name.toLowerCase();
        btn.style.cssText = 'padding:4px 10px;border:1px solid #475569;background:' +
            (i === 0 ? '#2563eb' : '#334155') + ';color:' +
            (i === 0 ? '#fff' : '#94a3b8') +
            ';cursor:pointer;border-radius:4px;font-size:11px;font-weight:600;';
        btn.onclick = function () { fdraw_circle_2d(name.toLowerCase()); };
        tabBar.appendChild(btn);
    });
    divRight.appendChild(tabBar);

    var viewport2d = document.createElement('div');
    viewport2d.id = 'circle_2dview';
    viewport2d.style.cssText = 'width:100%;height:526px;background:#000;';
    divRight.appendChild(viewport2d);
    _container.appendChild(divRight);

    odxf_circle.init();
    odxf_circle.layer(alayer[0], 4, "CONTINUOUS");
    odxf_circle.layer(alayer[1], 4, "HIDDEN");
    odxf_circle.layer(alayer[2], 1, "CENTER");

    let auserdata = getParams_circle();
    let aparam_b = auserdata.aparam_b;
    let aparam_e = auserdata.aparam_e;
    let dseg_leng = auserdata.dseg_leng;

    let ouserTextArea = document.getElementById('sUserText');
    if (ouserTextArea) ouserTextArea.value = auserdata.combText + "\n" + dseg_leng;

    let geoBegin = geo_circle(aparam_b);
    let geoEnd = geo_circle(aparam_e);

    // ── DXF layout ──
    let Db = aparam_b.dcircle_D, db = aparam_b.dcircle_d;
    let De = aparam_e.dcircle_D, de = aparam_e.dcircle_d;
    let Dmax = Math.max(Db, De);
    let half = dseg_leng / 2;
    let gap = Dmax * 0.4;
    let _col = Math.max(Dmax, dseg_leng) * 1.5;

    // Row0 col0: Front (begin) cross-section — circles at origin
    var cx_b = 0, cy_b = Db / 2;
    odxf_circle.circle(cx_b, cy_b, Db / 2, alayer[0]);
    if (aparam_b.hollow && db > 0 && db < Db) {
        odxf_circle.circle(cx_b, cy_b, db / 2, alayer[0]);
    }

    // Row0 col1: Back (end) cross-section
    var cx_e = _col, cy_e = De / 2;
    odxf_circle.circle(cx_e, cy_e, De / 2, alayer[0]);
    if (aparam_e.hollow && de > 0 && de < De) {
        odxf_circle.circle(cx_e, cy_e, de / 2, alayer[0]);
    }

    // Row1: Top view — tapered plan (width = D changes over length)
    var oy_top = Dmax + gap + half;
    var ox_top = 0;
    // Outer trapezoid
    odxf_circle.line(ox_top - Db / 2, oy_top - half, ox_top - De / 2, oy_top + half, alayer[0]);
    odxf_circle.line(ox_top - De / 2, oy_top + half, ox_top + De / 2, oy_top + half, alayer[0]);
    odxf_circle.line(ox_top + De / 2, oy_top + half, ox_top + Db / 2, oy_top - half, alayer[0]);
    odxf_circle.line(ox_top + Db / 2, oy_top - half, ox_top - Db / 2, oy_top - half, alayer[0]);
    // Inner hidden lines if hollow
    var hasHoleB = aparam_b.hollow && db > 0 && db < Db;
    var hasHoleE = aparam_e.hollow && de > 0 && de < De;
    if (hasHoleB && hasHoleE) {
        odxf_circle.line(ox_top - db / 2, oy_top - half, ox_top - de / 2, oy_top + half, alayer[1]);
        odxf_circle.line(ox_top + db / 2, oy_top - half, ox_top + de / 2, oy_top + half, alayer[1]);
    }

    // Bottom view
    var ox_bot = _col, oy_bot = oy_top;
    odxf_circle.line(ox_bot - Db / 2, oy_bot - half, ox_bot - De / 2, oy_bot + half, alayer[0]);
    odxf_circle.line(ox_bot - De / 2, oy_bot + half, ox_bot + De / 2, oy_bot + half, alayer[0]);
    odxf_circle.line(ox_bot + De / 2, oy_bot + half, ox_bot + Db / 2, oy_bot - half, alayer[0]);
    odxf_circle.line(ox_bot + Db / 2, oy_bot - half, ox_bot - Db / 2, oy_bot - half, alayer[0]);
    if (hasHoleB && hasHoleE) {
        odxf_circle.line(ox_bot - db / 2, oy_bot - half, ox_bot - de / 2, oy_bot + half, alayer[1]);
        odxf_circle.line(ox_bot + db / 2, oy_bot - half, ox_bot + de / 2, oy_bot + half, alayer[1]);
    }

    // Row2: Side view — tapered (height = D changes over length)
    var oy_side = oy_top + half + gap;
    var ox_side = 0;
    odxf_circle.line(ox_side - half, oy_side,      ox_side + half, oy_side,      alayer[0]);
    odxf_circle.line(ox_side + half, oy_side,      ox_side + half, oy_side + De, alayer[0]);
    odxf_circle.line(ox_side + half, oy_side + De,  ox_side - half, oy_side + Db, alayer[0]);
    odxf_circle.line(ox_side - half, oy_side + Db,  ox_side - half, oy_side,      alayer[0]);
    if (hasHoleB && hasHoleE) {
        var cyb_side = Db / 2, cye_side = De / 2;
        odxf_circle.line(ox_side - half, oy_side + cyb_side - db / 2, ox_side + half, oy_side + cye_side - de / 2, alayer[1]);
        odxf_circle.line(ox_side - half, oy_side + cyb_side + db / 2, ox_side + half, oy_side + cye_side + de / 2, alayer[1]);
    }

    _circle_drawData = { geoBegin, geoEnd, aparam_b, aparam_e, dseg_leng, alayer };

    // ── 3D ──
    function _render3d() {
        if (typeof render_circle_3d === 'function' && typeof THREE !== 'undefined') {
            render_circle_3d('circle3d', geoBegin, geoEnd, dseg_leng);
            return;
        }
        var msg = document.getElementById('circle3d');
        if (msg) msg.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;font-size:14px;">3D Loading...</div>';
        var urls = [];
        if (typeof THREE === 'undefined') {
            urls.push('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
            urls.push('https://unpkg.com/three@0.128.0/examples/js/controls/OrbitControls.js');
        }
        if (typeof render_circle_3d !== 'function') {
            urls.push('https://macrobim.github.io/macroBIM/bim_circle_3d.js');
        }
        (function loadNext(i) {
            if (i >= urls.length) {
                if (typeof render_circle_3d === 'function') render_circle_3d('circle3d', geoBegin, geoEnd, dseg_leng);
                return;
            }
            var s = document.createElement('script');
            s.src = urls[i];
            s.onload = function () { loadNext(i + 1); };
            s.onerror = function () { loadNext(i + 1); };
            document.head.appendChild(s);
        })(0);
    }
    try { _render3d(); } catch(e) { console.error('circle 3D render error:', e); }

    fdraw_circle_2d('front');
}

function fdraw_circle_2d(viewName) {
    if (!_circle_drawData) return;
    var data = _circle_drawData;
    var geoBegin = data.geoBegin;
    var geoEnd = data.geoEnd;
    var aparam_b = data.aparam_b;
    var aparam_e = data.aparam_e;
    var dseg_leng = data.dseg_leng;
    var alayer = data.alayer;

    ['front', 'back', 'left', 'right', 'top', 'bottom'].forEach(function (name) {
        var btn = document.getElementById('circle_tab_' + name);
        if (!btn) return;
        if (name === viewName) {
            btn.style.background = '#2563eb'; btn.style.color = '#fff'; btn.style.borderColor = '#2563eb';
        } else {
            btn.style.background = '#334155'; btn.style.color = '#94a3b8'; btn.style.borderColor = '#475569';
        }
    });

    var ocvs = new KonvaViewer('circle_2dview', {
        gridCols: 1, layout: [{ views: [viewName], span: 1 }]
    });
    ocvs.addLayer(alayer[0], 'cyan', 'solid', 1.5);
    ocvs.addLayer(alayer[1], 'cyan', 'hidden', 1.5);
    ocvs.addLayer(alayer[2], 'red', 'solid', 1.5);

    var half = dseg_leng / 2;
    var Db = aparam_b.dcircle_D, db = aparam_b.dcircle_d;
    var De = aparam_e.dcircle_D, de = aparam_e.dcircle_d;
    var Dmax = Math.max(Db, De);
    var ddim_off = Dmax * 0.04, ddim_ext = Dmax * 0.04;

    if (viewName === 'front') {
        var D = Db, d = db, ap = aparam_b;
        var cx = 0, cy = D / 2, R = D / 2;
        var hasHole = ap.hollow && d > 0 && d < D;

        // Outer circle
        ocvs.addCircle(viewName, cx, cy, R, alayer[0]);
        // Inner circle if hollow
        if (hasHole) {
            ocvs.addCircle(viewName, cx, cy, d / 2, alayer[0]);
        }

        if (hasHole) {
            ocvs.addDimLinear(viewName, cx + R + ddim_off, cy - d / 2, cx + R + ddim_off, cy + d / 2, ddim_ext * -6);
        }
        ocvs.addDimLinear(viewName, cx + R + ddim_off * 4, 0, cx + R + ddim_off * 4, D, ddim_ext * -6);

    } else if (viewName === 'back') {
        var D = De, d = de, ap = aparam_e;
        var cx = 0, cy = D / 2, R = D / 2;
        var hasHole = ap.hollow && d > 0 && d < D;

        ocvs.addCircle(viewName, cx, cy, R, alayer[0]);
        if (hasHole) {
            ocvs.addCircle(viewName, cx, cy, d / 2, alayer[0]);
        }

        if (hasHole) {
            ocvs.addDimLinear(viewName, cx + R + ddim_off, cy - d / 2, cx + R + ddim_off, cy + d / 2, ddim_ext * -6);
        }
        ocvs.addDimLinear(viewName, cx + R + ddim_off * 4, 0, cx + R + ddim_off * 4, D, ddim_ext * -6);

    } else if (viewName === 'top' || viewName === 'bottom') {
        // Tapered plan view: D changes width from Db to De over length
        ocvs.addLine(viewName, -Db / 2, -half, -De / 2, half, alayer[0]);
        ocvs.addLine(viewName, -De / 2, half, De / 2, half, alayer[0]);
        ocvs.addLine(viewName, De / 2, half, Db / 2, -half, alayer[0]);
        ocvs.addLine(viewName, Db / 2, -half, -Db / 2, -half, alayer[0]);

        var hasHoleB = aparam_b.hollow && db > 0 && db < Db;
        var hasHoleE = aparam_e.hollow && de > 0 && de < De;
        if (hasHoleB && hasHoleE) {
            ocvs.addLine(viewName, -db / 2, -half, -de / 2, half, alayer[1]);
            ocvs.addLine(viewName, db / 2, -half, de / 2, half, alayer[1]);
        }
        ocvs.addDimLinear(viewName, -Dmax / 2 - ddim_off, -half, -Dmax / 2 - ddim_off, half, ddim_ext * 6);
        ocvs.addDimLinear(viewName, -Db / 2, -half - ddim_off, Db / 2, -half - ddim_off, ddim_ext * -6);
        if (hasHoleB && hasHoleE) {
            ocvs.addDimLinear(viewName, -de / 2, half + ddim_off, de / 2, half + ddim_off, ddim_ext * 6);
        } else {
            ocvs.addDimLinear(viewName, -De / 2, half + ddim_off, De / 2, half + ddim_off, ddim_ext * 6);
        }

    } else if (viewName === 'left' || viewName === 'right') {
        // Tapered side view: D changes height from Db to De over length
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
        if (hasHoleB && hasHoleE) {
            var cye2 = De / 2;
            ocvs.addDimLinear(viewName, half + ddim_off, cye2 - de / 2, half + ddim_off, cye2 + de / 2, ddim_ext * -6);
        } else {
            ocvs.addDimLinear(viewName, half + ddim_off, 0, half + ddim_off, De, ddim_ext * -6);
        }
        ocvs.addDimLinear(viewName, -half, Dmax + ddim_off, half, Dmax + ddim_off, ddim_ext * 6);
    }

    ocvs.render();
}
