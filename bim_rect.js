/*
    Rect (직사각형) 단면 작도를 위한 JS
    - H/B: 외부 높이/폭, h/b: 내부 구멍 높이/폭
    - hollow 옵션: true=중공, false=충실
    - 3D (left) + tabbed 2D (right) 패턴
*/
const odxf_rect = dxf_generator();
const scvs_rect = "rectplot";

const _RECT_KEYS = ['drect_H', 'drect_B', 'drect_h', 'drect_b'];

function getParams_rect() {
    const getValue = (id) => {
        const el = document.getElementById(id);
        return el ? Number(el.value) : 0;
    };
    let aparam = {};
    _RECT_KEYS.forEach(k => { aparam[k] = getValue(k); });
    let chk = document.getElementById('drect_hollow');
    aparam.hollow = chk ? chk.checked : true;
    let dseg_leng = getValue('dseg_leng');
    let combText = _RECT_KEYS.map(k => aparam[k]).join(',') + ',' + (aparam.hollow ? '1' : '0');
    return { aparam, dseg_leng, combText };
}

function putParams_rect(textareaId) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;
    const lines = textarea.value.split('\n');
    if (lines.length < 1) return;
    const values = (lines[0] || '').split(',');

    _RECT_KEYS.forEach((key, index) => {
        if (values[index] !== undefined) {
            const el = document.getElementById(key);
            if (el) el.value = values[index].trim();
        }
    });
    if (values[4] !== undefined) {
        let chk = document.getElementById('drect_hollow');
        if (chk) chk.checked = values[4].trim() === '1';
    }
    const dseg_leng = lines.length >= 2 ? lines[1] : '';
    if (dseg_leng !== undefined && dseg_leng !== '') {
        const el = document.getElementById('dseg_leng');
        if (el) el.value = String(dseg_leng).trim();
    }
    if (typeof fdraw_rect === 'function') fdraw_rect();
}

/*
    geo_rect: rectangular cross-section (origin = bottom-left corner)
    H, B = outer dimensions; h, b = inner hole dimensions; hollow = bool
    Returns { points, lines, arcs, outerOutline, innerOutline }
*/
function geo_rect({ drect_H, drect_B, drect_h, drect_b, hollow }) {
    let H = drect_H, B = drect_B, h = drect_h, b = drect_b;
    let opts = [], olines = [], oarcs = [];

    let pbl = { x: -B / 2, y: 0 };
    let pbr = { x:  B / 2, y: 0 };
    let ptr = { x:  B / 2, y: H };
    let ptl = { x: -B / 2, y: H };

    [['pbl', pbl], ['pbr', pbr], ['ptr', ptr], ['ptl', ptl]
    ].forEach(([n, p]) => opts.push({ [n]: p, name: n }));

    olines.push({ x1: pbl.x, y1: pbl.y, x2: pbr.x, y2: pbr.y });
    olines.push({ x1: pbr.x, y1: pbr.y, x2: ptr.x, y2: ptr.y });
    olines.push({ x1: ptr.x, y1: ptr.y, x2: ptl.x, y2: ptl.y });
    olines.push({ x1: ptl.x, y1: ptl.y, x2: pbl.x, y2: pbl.y });

    let outerOutline = [pbl, pbr, ptr, ptl];
    let innerOutline = null;

    if (hollow && h > 0 && b > 0 && h < H && b < B) {
        let cy = H / 2;
        let ibl = { x: -b / 2, y: cy - h / 2 };
        let ibr = { x:  b / 2, y: cy - h / 2 };
        let itr = { x:  b / 2, y: cy + h / 2 };
        let itl = { x: -b / 2, y: cy + h / 2 };

        [['ibl', ibl], ['ibr', ibr], ['itr', itr], ['itl', itl]
        ].forEach(([n, p]) => opts.push({ [n]: p, name: n }));

        olines.push({ x1: ibl.x, y1: ibl.y, x2: ibr.x, y2: ibr.y });
        olines.push({ x1: ibr.x, y1: ibr.y, x2: itr.x, y2: itr.y });
        olines.push({ x1: itr.x, y1: itr.y, x2: itl.x, y2: itl.y });
        olines.push({ x1: itl.x, y1: itl.y, x2: ibl.x, y2: ibl.y });

        innerOutline = [ibl, ibr, itr, itl];
    }

    return { points: opts, lines: olines, arcs: oarcs, outerOutline, innerOutline };
}

var _rect_drawData = null;

function fdraw_rect() {
    var alayer = ['rect_solid', 'rect_hidden', 'rect_center'];

    var _container = document.getElementById(scvs_rect);
    if (!_container) return;
    _container.innerHTML = '';
    _container.style.display = 'flex';
    _container.style.gap = '2px';
    _container.style.backgroundColor = '#000';
    _container.style.height = '560px';

    var div3d = document.createElement('div');
    div3d.id = 'rect3d';
    div3d.style.cssText = 'width:50%;height:560px;background:#1a1a2e;';
    _container.appendChild(div3d);

    var divRight = document.createElement('div');
    divRight.style.cssText = 'width:50%;height:560px;';

    var tabBar = document.createElement('div');
    tabBar.style.cssText = 'display:flex;gap:2px;padding:4px;background:#1e293b;flex-wrap:wrap;height:34px;box-sizing:border-box;';
    ['Front', 'Back', 'Left', 'Right', 'Top', 'Bottom'].forEach(function (name, i) {
        var btn = document.createElement('button');
        btn.textContent = name;
        btn.id = 'rect_tab_' + name.toLowerCase();
        btn.style.cssText = 'padding:4px 10px;border:1px solid #475569;background:' +
            (i === 0 ? '#2563eb' : '#334155') + ';color:' +
            (i === 0 ? '#fff' : '#94a3b8') +
            ';cursor:pointer;border-radius:4px;font-size:11px;font-weight:600;';
        btn.onclick = function () { fdraw_rect_2d(name.toLowerCase()); };
        tabBar.appendChild(btn);
    });
    divRight.appendChild(tabBar);

    var viewport2d = document.createElement('div');
    viewport2d.id = 'rect_2dview';
    viewport2d.style.cssText = 'width:100%;height:526px;background:#000;';
    divRight.appendChild(viewport2d);
    _container.appendChild(divRight);

    odxf_rect.init();
    odxf_rect.layer(alayer[0], 4, "CONTINUOUS");
    odxf_rect.layer(alayer[1], 4, "HIDDEN");
    odxf_rect.layer(alayer[2], 1, "CENTER");

    let auserdata = getParams_rect();
    let aparam = auserdata.aparam;
    let dseg_leng = auserdata.dseg_leng;

    let ouserTextArea = document.getElementById('sUserText');
    if (ouserTextArea) ouserTextArea.value = auserdata.combText + "\n" + dseg_leng;

    let geo = geo_rect(aparam);

    // ── DXF layout ──
    let H = aparam.drect_H, B = aparam.drect_B;
    let _col = Math.max(B, dseg_leng) * 1.5;
    let _row = H * 2.0;
    let half = dseg_leng / 2;

    // Row0: Front view (cross-section at origin)
    geo.lines.forEach(l => odxf_rect.line(l.x1, l.y1, l.x2, l.y2, alayer[0]));

    // Row1: Top view (looking down — outer B x Length)
    let ox_top = 0, oy_top = _row;
    odxf_rect.line(ox_top - B / 2, oy_top - half, ox_top + B / 2, oy_top - half, alayer[0]);
    odxf_rect.line(ox_top + B / 2, oy_top - half, ox_top + B / 2, oy_top + half, alayer[0]);
    odxf_rect.line(ox_top + B / 2, oy_top + half, ox_top - B / 2, oy_top + half, alayer[0]);
    odxf_rect.line(ox_top - B / 2, oy_top + half, ox_top - B / 2, oy_top - half, alayer[0]);
    if (geo.innerOutline) {
        let b = aparam.drect_b;
        odxf_rect.line(ox_top - b / 2, oy_top - half, ox_top - b / 2, oy_top + half, alayer[1]);
        odxf_rect.line(ox_top + b / 2, oy_top - half, ox_top + b / 2, oy_top + half, alayer[1]);
    }

    // Row1 col1: Bottom view
    let ox_bot = _col, oy_bot = _row;
    odxf_rect.line(ox_bot - B / 2, oy_bot - half, ox_bot + B / 2, oy_bot - half, alayer[0]);
    odxf_rect.line(ox_bot + B / 2, oy_bot - half, ox_bot + B / 2, oy_bot + half, alayer[0]);
    odxf_rect.line(ox_bot + B / 2, oy_bot + half, ox_bot - B / 2, oy_bot + half, alayer[0]);
    odxf_rect.line(ox_bot - B / 2, oy_bot + half, ox_bot - B / 2, oy_bot - half, alayer[0]);
    if (geo.innerOutline) {
        let b = aparam.drect_b;
        odxf_rect.line(ox_bot - b / 2, oy_bot - half, ox_bot - b / 2, oy_bot + half, alayer[1]);
        odxf_rect.line(ox_bot + b / 2, oy_bot - half, ox_bot + b / 2, oy_bot + half, alayer[1]);
    }

    // Row2: Left/Right side view (H x Length)
    let ox_side = 0, oy_side = _row * 2;
    odxf_rect.line(ox_side - half, oy_side,     ox_side + half, oy_side,     alayer[0]);
    odxf_rect.line(ox_side + half, oy_side,     ox_side + half, oy_side + H, alayer[0]);
    odxf_rect.line(ox_side + half, oy_side + H, ox_side - half, oy_side + H, alayer[0]);
    odxf_rect.line(ox_side - half, oy_side + H, ox_side - half, oy_side,     alayer[0]);
    if (geo.innerOutline) {
        let ih = aparam.drect_h, cy = H / 2;
        odxf_rect.line(ox_side - half, oy_side + cy - ih / 2, ox_side + half, oy_side + cy - ih / 2, alayer[1]);
        odxf_rect.line(ox_side - half, oy_side + cy + ih / 2, ox_side + half, oy_side + cy + ih / 2, alayer[1]);
    }

    _rect_drawData = { geo, aparam, dseg_leng, alayer };

    // ── 3D ──
    function _render3d() {
        if (typeof render_rect_3d === 'function' && typeof THREE !== 'undefined') {
            render_rect_3d('rect3d', geo, geo, dseg_leng);
            return;
        }
        var msg = document.getElementById('rect3d');
        if (msg) msg.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;font-size:14px;">3D Loading...</div>';
        var urls = [];
        if (typeof THREE === 'undefined') {
            urls.push('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
            urls.push('https://unpkg.com/three@0.128.0/examples/js/controls/OrbitControls.js');
        }
        if (typeof render_rect_3d !== 'function') {
            urls.push('https://macrobim.github.io/macroBIM/bim_rect_3d.js');
        }
        (function loadNext(i) {
            if (i >= urls.length) {
                if (typeof render_rect_3d === 'function') render_rect_3d('rect3d', geo, geo, dseg_leng);
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

    fdraw_rect_2d('front');
}

function fdraw_rect_2d(viewName) {
    if (!_rect_drawData) return;
    var data = _rect_drawData;
    var geo = data.geo;
    var aparam = data.aparam;
    var dseg_leng = data.dseg_leng;
    var alayer = data.alayer;

    ['front', 'back', 'left', 'right', 'top', 'bottom'].forEach(function (name) {
        var btn = document.getElementById('rect_tab_' + name);
        if (!btn) return;
        if (name === viewName) {
            btn.style.background = '#2563eb'; btn.style.color = '#fff'; btn.style.borderColor = '#2563eb';
        } else {
            btn.style.background = '#334155'; btn.style.color = '#94a3b8'; btn.style.borderColor = '#475569';
        }
    });

    var ocvs = new KonvaViewer('rect_2dview', {
        gridCols: 1, layout: [{ views: [viewName], span: 1 }]
    });
    ocvs.addLayer(alayer[0], 'cyan', 'solid', 1.5);
    ocvs.addLayer(alayer[1], 'cyan', 'hidden', 1.5);
    ocvs.addLayer(alayer[2], 'red', 'solid', 1.5);

    function gp(name) { var f = geo.points.find(p => p.name === name); return f ? Object.assign({}, f[name]) : { x: 0, y: 0 }; }
    var half = dseg_leng / 2;
    var H = aparam.drect_H, B = aparam.drect_B;
    var h = aparam.drect_h, b = aparam.drect_b;
    var hasHole = aparam.hollow && h > 0 && b > 0 && h < H && b < B;
    var ddim_off = Math.max(H, B) * 0.04, ddim_ext = Math.max(H, B) * 0.04;
    var cy = H / 2;

    if (viewName === 'front' || viewName === 'back') {
        // Outer rectangle
        geo.lines.forEach(l => ocvs.addLine(viewName, l.x1, l.y1, l.x2, l.y2, alayer[0]));

        var ptl = gp('ptl'), ptr = gp('ptr'), pbl = gp('pbl'), pbr = gp('pbr');
        // Total height (left)
        ocvs.addDimLinear(viewName, ptl.x - ddim_off, pbl.y, ptl.x - ddim_off, ptl.y, ddim_ext * 6);
        // Total width (top)
        ocvs.addDimLinear(viewName, ptl.x, ptl.y + ddim_off, ptr.x, ptr.y + ddim_off, ddim_ext * 6);
        // Total width (bottom)
        ocvs.addDimLinear(viewName, pbl.x, pbl.y - ddim_off, pbr.x, pbr.y - ddim_off, ddim_ext * -6);

        if (hasHole) {
            var itl = gp('itl'), itr = gp('itr'), ibl = gp('ibl'), ibr = gp('ibr');
            // Inner h dimension (right side)
            ocvs.addDimLinear(viewName, ptr.x + ddim_off, ibl.y, ptr.x + ddim_off, itl.y, ddim_ext * 6);
            // Inner b dimension (inside)
            ocvs.addDimLinear(viewName, ibl.x, ibl.y - ddim_off * 0.5, ibr.x, ibr.y - ddim_off * 0.5, ddim_ext * 3);
            // Wall thickness b-side
            ocvs.addDimLinear(viewName, ptl.x, ptl.y + ddim_off, itl.x, itl.y + ddim_off, ddim_ext * 3);
        }

    } else if (viewName === 'top') {
        // Looking down: B x dseg_leng
        ocvs.addLine(viewName, -B / 2, -half, B / 2, -half, alayer[0]);
        ocvs.addLine(viewName, B / 2, -half, B / 2, half, alayer[0]);
        ocvs.addLine(viewName, B / 2, half, -B / 2, half, alayer[0]);
        ocvs.addLine(viewName, -B / 2, half, -B / 2, -half, alayer[0]);
        if (hasHole) {
            ocvs.addLine(viewName, -b / 2, -half, -b / 2, half, alayer[1]);
            ocvs.addLine(viewName, b / 2, -half, b / 2, half, alayer[1]);
        }
        ocvs.addDimLinear(viewName, -B / 2 - ddim_off, -half, -B / 2 - ddim_off, half, ddim_ext * 6);
        ocvs.addDimLinear(viewName, -B / 2, half + ddim_off, B / 2, half + ddim_off, ddim_ext * 6);
        if (hasHole) {
            ocvs.addDimLinear(viewName, -b / 2, half + ddim_off, b / 2, half + ddim_off, ddim_ext * 3);
        }

    } else if (viewName === 'bottom') {
        ocvs.addLine(viewName, -B / 2, -half, B / 2, -half, alayer[0]);
        ocvs.addLine(viewName, B / 2, -half, B / 2, half, alayer[0]);
        ocvs.addLine(viewName, B / 2, half, -B / 2, half, alayer[0]);
        ocvs.addLine(viewName, -B / 2, half, -B / 2, -half, alayer[0]);
        if (hasHole) {
            ocvs.addLine(viewName, -b / 2, -half, -b / 2, half, alayer[1]);
            ocvs.addLine(viewName, b / 2, -half, b / 2, half, alayer[1]);
        }
        ocvs.addDimLinear(viewName, -B / 2 - ddim_off, -half, -B / 2 - ddim_off, half, ddim_ext * 6);
        ocvs.addDimLinear(viewName, -B / 2, half + ddim_off, B / 2, half + ddim_off, ddim_ext * 6);
        if (hasHole) {
            ocvs.addDimLinear(viewName, -b / 2, half + ddim_off, b / 2, half + ddim_off, ddim_ext * 3);
        }

    } else if (viewName === 'left' || viewName === 'right') {
        // Side view: H x dseg_leng
        ocvs.addLine(viewName, -half, 0, half, 0, alayer[0]);
        ocvs.addLine(viewName, half, 0, half, H, alayer[0]);
        ocvs.addLine(viewName, half, H, -half, H, alayer[0]);
        ocvs.addLine(viewName, -half, H, -half, 0, alayer[0]);
        if (hasHole) {
            ocvs.addLine(viewName, -half, cy - h / 2, half, cy - h / 2, alayer[1]);
            ocvs.addLine(viewName, -half, cy + h / 2, half, cy + h / 2, alayer[1]);
        }
        ocvs.addDimLinear(viewName, -half - ddim_off, 0, -half - ddim_off, H, ddim_ext * 6);
        ocvs.addDimLinear(viewName, -half, H + ddim_off, half, H + ddim_off, ddim_ext * 6);
        if (hasHole) {
            ocvs.addDimLinear(viewName, half + ddim_off, cy - h / 2, half + ddim_off, cy + h / 2, ddim_ext * 6);
        }
    }

    ocvs.render();
}
