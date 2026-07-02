/*
    Octagon (팔각형) 단면 작도를 위한 JS
    - H1/H2/B1/B2: 외부 높이(중간직선/챔퍼)/폭(중간직선/챔퍼)
    - h1/h2/b1/b2: 내부 구멍 높이/폭
    - hollow 옵션: true=중공, false=충실
    - Begin/End (Front/Back) 지원
    - 3D (left) + tabbed 2D (right) 패턴
*/
const odxf_octagon = dxf_generator();
const scvs_octagon = "octagonplot";

const _OCTAGON_KEYS = ['doct_H1','doct_H2','doct_B1','doct_B2','doct_h1','doct_h2','doct_b1','doct_b2'];

function getParams_octagon() {
    const getValue = (id) => {
        const el = document.getElementById(id);
        return el ? Number(el.value) : 0;
    };

    let aparam_b = {};
    let aparam_e = {};
    _OCTAGON_KEYS.forEach(k => {
        aparam_b[k] = getValue(k + '_s');
        aparam_e[k] = getValue(k + '_e');
    });
    let chk = document.getElementById('doct_hollow');
    aparam_b.hollow = chk ? chk.checked : true;
    aparam_e.hollow = aparam_b.hollow;

    let dseg_leng = getValue('dseg_leng');

    let combText = _OCTAGON_KEYS.map(k => aparam_b[k]).join(',') + ',' +
                   _OCTAGON_KEYS.map(k => aparam_e[k]).join(',') + ',' +
                   (aparam_b.hollow ? '1' : '0');
    return { aparam_b, aparam_e, dseg_leng, combText };
}

function putParams_octagon(textareaId) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;
    const lines = textarea.value.split('\n');
    if (lines.length < 1) return;
    const values = (lines[0] || '').split(',');

    _OCTAGON_KEYS.forEach((key, index) => {
        if (values[index] !== undefined) {
            const el = document.getElementById(key + '_s');
            if (el) el.value = values[index].trim();
        }
    });
    _OCTAGON_KEYS.forEach((key, index) => {
        let vi = index + 8;
        if (values[vi] !== undefined) {
            const el = document.getElementById(key + '_e');
            if (el) el.value = values[vi].trim();
        }
    });
    if (values[16] !== undefined) {
        let chk = document.getElementById('doct_hollow');
        if (chk) chk.checked = values[16].trim() === '1';
    }
    const dseg_leng = lines.length >= 2 ? lines[1] : '';
    if (dseg_leng !== undefined && dseg_leng !== '') {
        const el = document.getElementById('dseg_leng');
        if (el) el.value = String(dseg_leng).trim();
    }
    if (typeof fdraw_octagon === 'function') fdraw_octagon();
}

/*
    geo_octagon: octagonal cross-section (origin = bottom-center)
    H1 = middle straight height, H2 = chamfer height (top & bottom)
    B1 = middle straight width,  B2 = chamfer width (left & right)
    Total height = H1 + 2*H2, Total width = B1 + 2*B2
    h1/h2/b1/b2 = inner dimensions (same pattern), hollow = bool
    Returns { points, lines, arcs, outerOutline, innerOutline }
*/
function geo_octagon({ doct_H1, doct_H2, doct_B1, doct_B2, doct_h1, doct_h2, doct_b1, doct_b2, hollow }) {
    let H1 = doct_H1, H2 = doct_H2, B1 = doct_B1, B2 = doct_B2;
    let h1 = doct_h1, h2 = doct_h2, b1 = doct_b1, b2 = doct_b2;
    let opts = [], olines = [], oarcs = [];

    let W = B1 + 2 * B2;       // total outer width
    let TH = H1 + 2 * H2;      // total outer height

    // Outer octagon vertices (origin = bottom-center, y=0 at bottom)
    let p1 = { x: -B1 / 2, y: 0 };           // bottom edge left
    let p2 = { x:  B1 / 2, y: 0 };           // bottom edge right
    let p3 = { x:  W / 2,  y: H2 };          // right-bottom chamfer end
    let p4 = { x:  W / 2,  y: H2 + H1 };     // right-top chamfer start
    let p5 = { x:  B1 / 2, y: TH };          // top edge right
    let p6 = { x: -B1 / 2, y: TH };          // top edge left
    let p7 = { x: -W / 2,  y: H2 + H1 };     // left-top chamfer start
    let p8 = { x: -W / 2,  y: H2 };          // left-bottom chamfer end

    [['p1', p1], ['p2', p2], ['p3', p3], ['p4', p4],
     ['p5', p5], ['p6', p6], ['p7', p7], ['p8', p8]
    ].forEach(([n, p]) => opts.push({ [n]: p, name: n }));

    let outerPts = [p1, p2, p3, p4, p5, p6, p7, p8];
    for (let i = 0; i < outerPts.length; i++) {
        let next = (i + 1) % outerPts.length;
        olines.push({ x1: outerPts[i].x, y1: outerPts[i].y, x2: outerPts[next].x, y2: outerPts[next].y });
    }

    let outerOutline = outerPts;
    let innerOutline = null;

    let iW = b1 + 2 * b2;      // total inner width
    let iTH = h1 + 2 * h2;     // total inner height

    if (hollow && h1 > 0 && b1 > 0 && iTH < TH && iW < W) {
        let cy = TH / 2;  // center vertically in outer octagon

        let i1 = { x: -b1 / 2, y: cy - iTH / 2 };
        let i2 = { x:  b1 / 2, y: cy - iTH / 2 };
        let i3 = { x:  iW / 2, y: cy - iTH / 2 + h2 };
        let i4 = { x:  iW / 2, y: cy - iTH / 2 + h2 + h1 };
        let i5 = { x:  b1 / 2, y: cy + iTH / 2 };
        let i6 = { x: -b1 / 2, y: cy + iTH / 2 };
        let i7 = { x: -iW / 2, y: cy - iTH / 2 + h2 + h1 };
        let i8 = { x: -iW / 2, y: cy - iTH / 2 + h2 };

        [['i1', i1], ['i2', i2], ['i3', i3], ['i4', i4],
         ['i5', i5], ['i6', i6], ['i7', i7], ['i8', i8]
        ].forEach(([n, p]) => opts.push({ [n]: p, name: n }));

        let innerPts = [i1, i2, i3, i4, i5, i6, i7, i8];
        for (let i = 0; i < innerPts.length; i++) {
            let next = (i + 1) % innerPts.length;
            olines.push({ x1: innerPts[i].x, y1: innerPts[i].y, x2: innerPts[next].x, y2: innerPts[next].y });
        }

        innerOutline = innerPts;
    }

    return { points: opts, lines: olines, arcs: oarcs, outerOutline, innerOutline };
}

var _octagon_drawData = null;

function fdraw_octagon() {
    var alayer = ['oct_solid', 'oct_hidden', 'oct_center'];

    var _container = document.getElementById(scvs_octagon);
    if (!_container) return;
    _container.innerHTML = '';
    _container.style.display = 'flex';
    _container.style.gap = '2px';
    _container.style.backgroundColor = '#000';
    _container.style.height = '560px';

    var div3d = document.createElement('div');
    div3d.id = 'oct3d';
    div3d.style.cssText = 'width:50%;height:560px;background:#1a1a2e;';
    _container.appendChild(div3d);

    var divRight = document.createElement('div');
    divRight.style.cssText = 'width:50%;height:560px;';

    var tabBar = document.createElement('div');
    tabBar.style.cssText = 'display:flex;gap:2px;padding:4px;background:#1e293b;flex-wrap:wrap;height:34px;box-sizing:border-box;';
    ['Front', 'Back', 'Left', 'Right', 'Top', 'Bottom'].forEach(function (name, i) {
        var btn = document.createElement('button');
        btn.textContent = name;
        btn.id = 'oct_tab_' + name.toLowerCase();
        btn.style.cssText = 'padding:4px 10px;border:1px solid #475569;background:' +
            (i === 0 ? '#2563eb' : '#334155') + ';color:' +
            (i === 0 ? '#fff' : '#94a3b8') +
            ';cursor:pointer;border-radius:4px;font-size:11px;font-weight:600;';
        btn.onclick = function () { fdraw_octagon_2d(name.toLowerCase()); };
        tabBar.appendChild(btn);
    });
    divRight.appendChild(tabBar);

    var viewport2d = document.createElement('div');
    viewport2d.id = 'oct_2dview';
    viewport2d.style.cssText = 'width:100%;height:526px;background:#000;';
    divRight.appendChild(viewport2d);
    _container.appendChild(divRight);

    odxf_octagon.init();
    odxf_octagon.layer(alayer[0], 4, "CONTINUOUS");
    odxf_octagon.layer(alayer[1], 4, "HIDDEN");
    odxf_octagon.layer(alayer[2], 1, "CENTER");

    let auserdata = getParams_octagon();
    let aparam_b = auserdata.aparam_b;
    let aparam_e = auserdata.aparam_e;
    let dseg_leng = auserdata.dseg_leng;

    let ouserTextArea = document.getElementById('sUserText');
    if (ouserTextArea) ouserTextArea.value = auserdata.combText + "\n" + dseg_leng;

    let geoBegin = geo_octagon(aparam_b);
    let geoEnd = geo_octagon(aparam_e);

    // ── DXF layout ──
    let Hb = aparam_b.doct_H1 + 2 * aparam_b.doct_H2, Bb = aparam_b.doct_B1 + 2 * aparam_b.doct_B2;
    let He = aparam_e.doct_H1 + 2 * aparam_e.doct_H2, Be = aparam_e.doct_B1 + 2 * aparam_e.doct_B2;
    let Hmax = Math.max(Hb, He), Bmax = Math.max(Bb, Be);
    let half = dseg_leng / 2;
    let gap = Math.max(Hmax, Bmax) * 0.4;
    let _col = Math.max(Bmax, dseg_leng) * 1.5;

    // Row0 col0: Front (begin) cross-section at origin
    geoBegin.lines.forEach(l => odxf_octagon.line(l.x1, l.y1, l.x2, l.y2, alayer[0]));
    // Row0 col1: Back (end) cross-section
    geoEnd.lines.forEach(l => odxf_octagon.line(l.x1 + _col, l.y1, l.x2 + _col, l.y2, alayer[0]));

    // Row1: Top and Bottom views (tapered)
    // Top view — outer outline: width tapers from Bb to Be along length
    let oy_top = Hmax + gap + half;
    let ox_top = 0;
    odxf_octagon.line(ox_top - Bb / 2, oy_top - half, ox_top - Be / 2, oy_top + half, alayer[0]);
    odxf_octagon.line(ox_top - Be / 2, oy_top + half, ox_top + Be / 2, oy_top + half, alayer[0]);
    odxf_octagon.line(ox_top + Be / 2, oy_top + half, ox_top + Bb / 2, oy_top - half, alayer[0]);
    odxf_octagon.line(ox_top + Bb / 2, oy_top - half, ox_top - Bb / 2, oy_top - half, alayer[0]);
    if (geoBegin.innerOutline && geoEnd.innerOutline) {
        let bb = aparam_b.doct_b1 + 2 * aparam_b.doct_b2;
        let be = aparam_e.doct_b1 + 2 * aparam_e.doct_b2;
        odxf_octagon.line(ox_top - bb / 2, oy_top - half, ox_top - be / 2, oy_top + half, alayer[1]);
        odxf_octagon.line(ox_top + bb / 2, oy_top - half, ox_top + be / 2, oy_top + half, alayer[1]);
    }

    // Bottom view
    let ox_bot = _col, oy_bot = oy_top;
    odxf_octagon.line(ox_bot - Bb / 2, oy_bot - half, ox_bot - Be / 2, oy_bot + half, alayer[0]);
    odxf_octagon.line(ox_bot - Be / 2, oy_bot + half, ox_bot + Be / 2, oy_bot + half, alayer[0]);
    odxf_octagon.line(ox_bot + Be / 2, oy_bot + half, ox_bot + Bb / 2, oy_bot - half, alayer[0]);
    odxf_octagon.line(ox_bot + Bb / 2, oy_bot - half, ox_bot - Bb / 2, oy_bot - half, alayer[0]);
    if (geoBegin.innerOutline && geoEnd.innerOutline) {
        let bb = aparam_b.doct_b1 + 2 * aparam_b.doct_b2;
        let be = aparam_e.doct_b1 + 2 * aparam_e.doct_b2;
        odxf_octagon.line(ox_bot - bb / 2, oy_bot - half, ox_bot - be / 2, oy_bot + half, alayer[1]);
        odxf_octagon.line(ox_bot + bb / 2, oy_bot - half, ox_bot + be / 2, oy_bot + half, alayer[1]);
    }

    // Row2: Left/Right side view (tapered H x Length)
    let oy_side = oy_top + half + gap;
    let ox_side = 0;
    odxf_octagon.line(ox_side - half, oy_side,      ox_side + half, oy_side,      alayer[0]);
    odxf_octagon.line(ox_side + half, oy_side,      ox_side + half, oy_side + He, alayer[0]);
    odxf_octagon.line(ox_side + half, oy_side + He,  ox_side - half, oy_side + Hb, alayer[0]);
    odxf_octagon.line(ox_side - half, oy_side + Hb,  ox_side - half, oy_side,      alayer[0]);
    if (geoBegin.innerOutline && geoEnd.innerOutline) {
        let hb = aparam_b.doct_h1 + 2 * aparam_b.doct_h2;
        let he = aparam_e.doct_h1 + 2 * aparam_e.doct_h2;
        let cyb = Hb / 2, cye = He / 2;
        odxf_octagon.line(ox_side - half, oy_side + cyb - hb / 2, ox_side + half, oy_side + cye - he / 2, alayer[1]);
        odxf_octagon.line(ox_side - half, oy_side + cyb + hb / 2, ox_side + half, oy_side + cye + he / 2, alayer[1]);
    }

    _octagon_drawData = { geoBegin, geoEnd, aparam_b, aparam_e, dseg_leng, alayer };

    // ── 3D ──
    function _render3d() {
        if (typeof render_octagon_3d === 'function' && typeof THREE !== 'undefined') {
            render_octagon_3d('oct3d', geoBegin, geoEnd, dseg_leng);
            return;
        }
        var msg = document.getElementById('oct3d');
        if (msg) msg.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;font-size:14px;">3D Loading...</div>';
        var urls = [];
        if (typeof THREE === 'undefined') {
            urls.push('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
            urls.push('https://unpkg.com/three@0.128.0/examples/js/controls/OrbitControls.js');
        }
        if (typeof render_octagon_3d !== 'function') {
            urls.push('https://macrobim.github.io/macroBIM/bim_octagon_3d.js');
        }
        (function loadNext(i) {
            if (i >= urls.length) {
                if (typeof render_octagon_3d === 'function') render_octagon_3d('oct3d', geoBegin, geoEnd, dseg_leng);
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

    fdraw_octagon_2d('front');
}

function fdraw_octagon_2d(viewName) {
    if (!_octagon_drawData) return;
    var data = _octagon_drawData;
    var geoBegin = data.geoBegin;
    var geoEnd = data.geoEnd;
    var aparam_b = data.aparam_b;
    var aparam_e = data.aparam_e;
    var dseg_leng = data.dseg_leng;
    var alayer = data.alayer;

    ['front', 'back', 'left', 'right', 'top', 'bottom'].forEach(function (name) {
        var btn = document.getElementById('oct_tab_' + name);
        if (!btn) return;
        if (name === viewName) {
            btn.style.background = '#2563eb'; btn.style.color = '#fff'; btn.style.borderColor = '#2563eb';
        } else {
            btn.style.background = '#334155'; btn.style.color = '#94a3b8'; btn.style.borderColor = '#475569';
        }
    });

    var ocvs = new KonvaViewer('oct_2dview', {
        gridCols: 1, layout: [{ views: [viewName], span: 1 }]
    });
    ocvs.addLayer(alayer[0], 'cyan', 'solid', 1.5);
    ocvs.addLayer(alayer[1], 'cyan', 'hidden', 1.5);
    ocvs.addLayer(alayer[2], 'red', 'solid', 1.5);

    var half = dseg_leng / 2;
    var Hb = aparam_b.doct_H1 + 2 * aparam_b.doct_H2, Bb = aparam_b.doct_B1 + 2 * aparam_b.doct_B2;
    var He = aparam_e.doct_H1 + 2 * aparam_e.doct_H2, Be = aparam_e.doct_B1 + 2 * aparam_e.doct_B2;
    var hb = aparam_b.doct_h1 + 2 * aparam_b.doct_h2, bb = aparam_b.doct_b1 + 2 * aparam_b.doct_b2;
    var he = aparam_e.doct_h1 + 2 * aparam_e.doct_h2, be = aparam_e.doct_b1 + 2 * aparam_e.doct_b2;
    var Hmax = Math.max(Hb, He), Bmax = Math.max(Bb, Be);
    var ddim_off = Math.max(Hmax, Bmax) * 0.04, ddim_ext = Math.max(Hmax, Bmax) * 0.04;

    if (viewName === 'front') {
        var geo = geoBegin, ap = aparam_b;
        var H = Hb, B = Bb;
        var iTH = ap.doct_h1 + 2 * ap.doct_h2, iW = ap.doct_b1 + 2 * ap.doct_b2;
        var hasHole = ap.hollow && ap.doct_h1 > 0 && ap.doct_b1 > 0 && iTH < H && iW < B;
        function gp(name) { var f = geo.points.find(p => p.name === name); return f ? Object.assign({}, f[name]) : { x: 0, y: 0 }; }

        geo.lines.forEach(l => ocvs.addLine(viewName, l.x1, l.y1, l.x2, l.y2, alayer[0]));

        var op1 = gp('p1'), op2 = gp('p2'), op3 = gp('p3'), op4 = gp('p4');
        var op5 = gp('p5'), op6 = gp('p6'), op7 = gp('p7'), op8 = gp('p8');
        // Outer dimensions: total height (left side), total width (top & bottom)
        ocvs.addDimLinear(viewName, op8.x - ddim_off, op1.y, op8.x - ddim_off, op6.y, ddim_ext * 6);
        ocvs.addDimLinear(viewName, op6.x, op6.y + ddim_off, op5.x, op5.y + ddim_off, ddim_ext * 6);
        ocvs.addDimLinear(viewName, op1.x, op1.y - ddim_off, op2.x, op2.y - ddim_off, ddim_ext * -6);
        if (hasHole) {
            var ip1 = gp('i1'), ip5 = gp('i5'), ip3 = gp('i3');
            ocvs.addDimLinear(viewName, op3.x + ddim_off, ip1.y, op3.x + ddim_off, ip5.y, ddim_ext * 6);
            ocvs.addDimLinear(viewName, ip1.x, ip1.y - ddim_off * 0.5, gp('i2').x, gp('i2').y - ddim_off * 0.5, ddim_ext * 3);
        }

    } else if (viewName === 'back') {
        var geo = geoEnd, ap = aparam_e;
        var H = He, B = Be;
        var iTH = ap.doct_h1 + 2 * ap.doct_h2, iW = ap.doct_b1 + 2 * ap.doct_b2;
        var hasHole = ap.hollow && ap.doct_h1 > 0 && ap.doct_b1 > 0 && iTH < H && iW < B;
        function gp2(name) { var f = geo.points.find(p => p.name === name); return f ? Object.assign({}, f[name]) : { x: 0, y: 0 }; }

        geo.lines.forEach(l => ocvs.addLine(viewName, l.x1, l.y1, l.x2, l.y2, alayer[0]));

        var op1 = gp2('p1'), op2 = gp2('p2'), op3 = gp2('p3'), op4 = gp2('p4');
        var op5 = gp2('p5'), op6 = gp2('p6'), op7 = gp2('p7'), op8 = gp2('p8');
        ocvs.addDimLinear(viewName, op8.x - ddim_off, op1.y, op8.x - ddim_off, op6.y, ddim_ext * 6);
        ocvs.addDimLinear(viewName, op6.x, op6.y + ddim_off, op5.x, op5.y + ddim_off, ddim_ext * 6);
        ocvs.addDimLinear(viewName, op1.x, op1.y - ddim_off, op2.x, op2.y - ddim_off, ddim_ext * -6);
        if (hasHole) {
            var ip1 = gp2('i1'), ip5 = gp2('i5'), ip3 = gp2('i3');
            ocvs.addDimLinear(viewName, op3.x + ddim_off, ip1.y, op3.x + ddim_off, ip5.y, ddim_ext * 6);
            ocvs.addDimLinear(viewName, ip1.x, ip1.y - ddim_off * 0.5, gp2('i2').x, gp2('i2').y - ddim_off * 0.5, ddim_ext * 3);
        }

    } else if (viewName === 'top' || viewName === 'bottom') {
        // Tapered plan view: total width changes from Bb to Be over length
        ocvs.addLine(viewName, -Bb / 2, -half, -Be / 2, half, alayer[0]);
        ocvs.addLine(viewName, -Be / 2, half, Be / 2, half, alayer[0]);
        ocvs.addLine(viewName, Be / 2, half, Bb / 2, -half, alayer[0]);
        ocvs.addLine(viewName, Bb / 2, -half, -Bb / 2, -half, alayer[0]);

        var hasHoleB = aparam_b.hollow && aparam_b.doct_h1 > 0 && aparam_b.doct_b1 > 0 && hb < Hb && bb < Bb;
        var hasHoleE = aparam_e.hollow && aparam_e.doct_h1 > 0 && aparam_e.doct_b1 > 0 && he < He && be < Be;
        if (hasHoleB && hasHoleE) {
            ocvs.addLine(viewName, -bb / 2, -half, -be / 2, half, alayer[1]);
            ocvs.addLine(viewName, bb / 2, -half, be / 2, half, alayer[1]);
        }
        ocvs.addDimLinear(viewName, -Bmax / 2 - ddim_off, -half, -Bmax / 2 - ddim_off, half, ddim_ext * 6);
        ocvs.addDimLinear(viewName, -Bb / 2, -half - ddim_off, Bb / 2, -half - ddim_off, ddim_ext * -6);
        ocvs.addDimLinear(viewName, -Be / 2, half + ddim_off, Be / 2, half + ddim_off, ddim_ext * 6);

    } else if (viewName === 'left' || viewName === 'right') {
        // Tapered side view: total height changes from Hb to He over length
        ocvs.addLine(viewName, -half, 0, half, 0, alayer[0]);
        ocvs.addLine(viewName, half, 0, half, He, alayer[0]);
        ocvs.addLine(viewName, half, He, -half, Hb, alayer[0]);
        ocvs.addLine(viewName, -half, Hb, -half, 0, alayer[0]);

        var hasHoleB = aparam_b.hollow && aparam_b.doct_h1 > 0 && aparam_b.doct_b1 > 0 && hb < Hb && bb < Bb;
        var hasHoleE = aparam_e.hollow && aparam_e.doct_h1 > 0 && aparam_e.doct_b1 > 0 && he < He && be < Be;
        if (hasHoleB && hasHoleE) {
            var cyb = Hb / 2, cye = He / 2;
            ocvs.addLine(viewName, -half, cyb - hb / 2, half, cye - he / 2, alayer[1]);
            ocvs.addLine(viewName, -half, cyb + hb / 2, half, cye + he / 2, alayer[1]);
        }
        ocvs.addDimLinear(viewName, -half - ddim_off, 0, -half - ddim_off, Hb, ddim_ext * 6);
        ocvs.addDimLinear(viewName, half + ddim_off, 0, half + ddim_off, He, ddim_ext * 6);
        ocvs.addDimLinear(viewName, -half, Hmax + ddim_off, half, Hmax + ddim_off, ddim_ext * 6);
    }

    ocvs.render();
}
