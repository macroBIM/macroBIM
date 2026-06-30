/*
    H 형강 작도를 위한 JS v002
    - box1cell/ibeam 패턴: 3D (left) + tabbed 2D (right)
    - Uniform single cross-section (no Begin/End taper) — 3D loft uses
      geo_begin == geo_end so the renderer can stay the same.
*/
const odxf_hsec = dxf_generator();
const scvs_hsec = "hsecplot";

const _HSEC_KEYS = ['dsech', 'dbt', 'dbb', 'dtw', 'dttf', 'dtbf', 'dradius'];

function getParams_hsection() {
    const getValue = (id) => {
        const el = document.getElementById(id);
        return el ? Number(el.value) : 0;
    };
    let aparam = {};
    _HSEC_KEYS.forEach(k => { aparam[k] = getValue(k); });
    let dseg_leng = getValue('dseg_leng');
    let combText = _HSEC_KEYS.map(k => aparam[k]).join(',');
    return { aparam, dseg_leng, combText };
}

function putParams_hsection(textareaId) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;
    const lines = textarea.value.split('\n');
    if (lines.length < 1) return;
    const values = (lines[0] || '').split(',');
    const dseg_leng = lines.length >= 2 ? lines[1] : '';

    _HSEC_KEYS.forEach((key, index) => {
        if (values[index] !== undefined) {
            const el = document.getElementById(key);
            if (el) el.value = values[index].trim();
        }
    });
    if (dseg_leng !== undefined && dseg_leng !== '') {
        const el = document.getElementById('dseg_leng');
        if (el) el.value = String(dseg_leng).trim();
    }
    if (typeof fdraw_hsection === 'function') fdraw_hsection();
}

/*
    geo_hsection: cross-section of H beam (origin = bottom-center, y up)
    Returns { points, lines, arcs, outline }
*/
function geo_hsection({ dsech, dbt, dbb, dtw, dttf, dtbf, dradius }) {
    let opts = [], olines = [], oarcs = [];
    let dh = dsech;

    // Outer corner points
    let ptl  = { x: -dbt / 2, y: dh };
    let ptr  = { x:  dbt / 2, y: dh };
    let ptfl = { x: -dbt / 2, y: dh - dttf };
    let ptfr = { x:  dbt / 2, y: dh - dttf };
    let pwtl = { x: -dtw / 2, y: dh - dttf };
    let pwtr = { x:  dtw / 2, y: dh - dttf };
    let pwbl = { x: -dtw / 2, y: dtbf };
    let pwbr = { x:  dtw / 2, y: dtbf };
    let pbfl = { x: -dbb / 2, y: dtbf };
    let pbfr = { x:  dbb / 2, y: dtbf };
    let pbl  = { x: -dbb / 2, y: 0 };
    let pbr  = { x:  dbb / 2, y: 0 };

    [['ptl',ptl],['ptr',ptr],['ptfl',ptfl],['ptfr',ptfr],
     ['pwtl',pwtl],['pwtr',pwtr],['pwbl',pwbl],['pwbr',pwbr],
     ['pbfl',pbfl],['pbfr',pbfr],['pbl',pbl],['pbr',pbr]
    ].forEach(([n,p]) => opts.push({[n]: p, name: n}));

    // === Lines (cross-section outline) ===
    // Top flange (rectangle): ptl→ptr→ptfr (right side)→inside web→ptfl (left side)
    olines.push({ x1: ptl.x, y1: ptl.y, x2: ptr.x, y2: ptr.y });        // top edge
    olines.push({ x1: ptr.x, y1: ptr.y, x2: ptfr.x, y2: ptfr.y });      // right side of top flange
    olines.push({ x1: ptfl.x, y1: ptfl.y, x2: ptl.x, y2: ptl.y });      // left side of top flange

    // From top flange inner to web (right side)
    if (dradius > 0) {
        // fillet between (ptfr) → top flange bottom going left → fillet → web going down
        let fil_tr = { ox: dtw/2 + dradius, oy: dh - dttf - dradius, r: dradius };
        olines.push({ x1: ptfr.x, y1: ptfr.y, x2: dtw/2 + dradius, y2: dh - dttf });
        oarcs.push({ x: fil_tr.ox, y: fil_tr.oy, r: dradius, angb: 90, ange: 180 });
        olines.push({ x1: dtw/2, y1: dh - dttf - dradius, x2: dtw/2, y2: dtbf + dradius });
        let fil_br = { ox: dtw/2 + dradius, oy: dtbf + dradius, r: dradius };
        oarcs.push({ x: fil_br.ox, y: fil_br.oy, r: dradius, angb: 180, ange: 270 });
        olines.push({ x1: dtw/2 + dradius, y1: dtbf, x2: pbfr.x, y2: pbfr.y });
        // left mirror
        olines.push({ x1: ptfl.x, y1: ptfl.y, x2: -dtw/2 - dradius, y2: dh - dttf });
        let fil_tl = { ox: -dtw/2 - dradius, oy: dh - dttf - dradius, r: dradius };
        oarcs.push({ x: fil_tl.ox, y: fil_tl.oy, r: dradius, angb: 0, ange: 90 });
        olines.push({ x1: -dtw/2, y1: dh - dttf - dradius, x2: -dtw/2, y2: dtbf + dradius });
        let fil_bl = { ox: -dtw/2 - dradius, oy: dtbf + dradius, r: dradius };
        oarcs.push({ x: fil_bl.ox, y: fil_bl.oy, r: dradius, angb: 270, ange: 360 });
        olines.push({ x1: -dtw/2 - dradius, y1: dtbf, x2: pbfl.x, y2: pbfl.y });
    } else {
        // Sharp corners
        olines.push({ x1: ptfr.x, y1: ptfr.y, x2: pwtr.x, y2: pwtr.y });
        olines.push({ x1: pwtr.x, y1: pwtr.y, x2: pwbr.x, y2: pwbr.y });
        olines.push({ x1: pwbr.x, y1: pwbr.y, x2: pbfr.x, y2: pbfr.y });
        olines.push({ x1: ptfl.x, y1: ptfl.y, x2: pwtl.x, y2: pwtl.y });
        olines.push({ x1: pwtl.x, y1: pwtl.y, x2: pwbl.x, y2: pwbl.y });
        olines.push({ x1: pwbl.x, y1: pwbl.y, x2: pbfl.x, y2: pbfl.y });
    }

    // Bottom flange
    olines.push({ x1: pbfr.x, y1: pbfr.y, x2: pbr.x, y2: pbr.y });
    olines.push({ x1: pbr.x,  y1: pbr.y,  x2: pbl.x, y2: pbl.y });
    olines.push({ x1: pbl.x,  y1: pbl.y,  x2: pbfl.x, y2: pbfl.y });

    // === Outline (clockwise, sharp corners) for 3D loft ===
    let outline = [
        ptl, ptr, ptfr, pwtr, pwbr, pbfr, pbr, pbl, pbfl, pwbl, pwtl, ptfl
    ];

    return { points: opts, lines: olines, arcs: oarcs, outline: outline };
}

var _hsec_drawData = null;

function fdraw_hsection() {
    var alayer = ['hsec_solid', 'hsec_hidden', 'hsec_center'];

    var _container = document.getElementById(scvs_hsec);
    if (!_container) return;
    _container.innerHTML = '';
    _container.style.display = 'flex';
    _container.style.gap = '2px';
    _container.style.backgroundColor = '#000';
    _container.style.height = '560px';

    var div3d = document.createElement('div');
    div3d.id = 'hsec3d';
    div3d.style.cssText = 'width:50%;height:560px;background:#1a1a2e;';
    _container.appendChild(div3d);

    var divRight = document.createElement('div');
    divRight.style.cssText = 'width:50%;height:560px;';

    var tabBar = document.createElement('div');
    tabBar.style.cssText = 'display:flex;gap:2px;padding:4px;background:#1e293b;flex-wrap:wrap;height:34px;box-sizing:border-box;';
    ['Front', 'Back', 'Left', 'Center', 'Right', 'Top', 'Bottom'].forEach(function(name, i) {
        var btn = document.createElement('button');
        btn.textContent = name;
        btn.id = 'hsec_tab_' + name.toLowerCase();
        btn.style.cssText = 'padding:4px 10px;border:1px solid #475569;background:' +
            (i === 0 ? '#2563eb' : '#334155') + ';color:' +
            (i === 0 ? '#fff' : '#94a3b8') +
            ';cursor:pointer;border-radius:4px;font-size:11px;font-weight:600;';
        btn.onclick = function() { fdraw_hsection_2d(name.toLowerCase()); };
        tabBar.appendChild(btn);
    });
    divRight.appendChild(tabBar);

    var viewport2d = document.createElement('div');
    viewport2d.id = 'hsec_2dview';
    viewport2d.style.cssText = 'width:100%;height:526px;background:#000;';
    divRight.appendChild(viewport2d);
    _container.appendChild(divRight);

    odxf_hsec.init();
    odxf_hsec.layer(alayer[0], 4, "CONTINUOUS");
    odxf_hsec.layer(alayer[1], 4, "HIDDEN");
    odxf_hsec.layer(alayer[2], 1, "CENTER");

    let auserdata = getParams_hsection();
    let aparam = auserdata.aparam;
    let dseg_leng = auserdata.dseg_leng;

    let ouserTextArea = document.getElementById('sUserText');
    if (ouserTextArea) ouserTextArea.value = auserdata.combText + "\n" + dseg_leng;

    let geo = geo_hsection(aparam);

    // DXF: front + top + bottom + side layout
    let _w = Math.max(aparam.dbt, aparam.dbb);
    let _col = Math.max(_w, dseg_leng) * 1.5;
    let _row = aparam.dsech * 2.0;

    // Row1 Front at (0,0)
    geo.lines.forEach(l => odxf_hsec.line(l.x1, l.y1, l.x2, l.y2, alayer[0]));
    geo.arcs.forEach(a => odxf_hsec.arc(a.x, a.y, a.r, a.angb, a.ange, alayer[0]));

    // Helper for long views in DXF
    function _dxf_long(off_x, off_y, names, hidden, axis) {
        let half = dseg_leng / 2;
        function _gp(n) { var f = geo.points.find(p => p.name === n); return f ? f[n] : {x:0,y:0}; }
        names.forEach(n => {
            let p = _gp(n);
            if (axis === 'top') odxf_hsec.line(off_x + p.x, off_y - half, off_x + p.x, off_y + half, alayer[0]);
            else odxf_hsec.line(off_x - half, off_y + p.y, off_x + half, off_y + p.y, alayer[0]);
        });
        // transverse caps
        if (names.length >= 2) {
            let n1 = _gp(names[0]), n2 = _gp(names[names.length-1]);
            if (axis === 'top') {
                odxf_hsec.line(off_x + n1.x, off_y - half, off_x + n2.x, off_y - half, alayer[0]);
                odxf_hsec.line(off_x + n1.x, off_y + half, off_x + n2.x, off_y + half, alayer[0]);
            } else {
                odxf_hsec.line(off_x - half, off_y + n1.y, off_x - half, off_y + n2.y, alayer[0]);
                odxf_hsec.line(off_x + half, off_y + n1.y, off_x + half, off_y + n2.y, alayer[0]);
            }
        }
        hidden.forEach(n => {
            let p = _gp(n);
            if (axis === 'top') odxf_hsec.line(off_x + p.x, off_y - half, off_x + p.x, off_y + half, alayer[1]);
            else odxf_hsec.line(off_x - half, off_y + p.y, off_x + half, off_y + p.y, alayer[1]);
        });
    }
    _dxf_long(0,      _row,     ['ptl','ptr'], ['pwtl','pwtr'], 'top');
    _dxf_long(_col,   _row,     ['pbl','pbr'], ['pwbl','pwbr'], 'top');
    _dxf_long(0,      _row * 2, ['ptl','ptfl','pwtl','pwbl','pbfl','pbl'], [], 'side');

    _hsec_drawData = { geo, aparam, dseg_leng, alayer };

    // 3D
    function _render3d() {
        if (typeof render_hsection_3d === 'function' && typeof THREE !== 'undefined') {
            render_hsection_3d('hsec3d', geo, geo, dseg_leng);
            return;
        }
        var msg = document.getElementById('hsec3d');
        if (msg) msg.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;font-size:14px;">3D Loading...</div>';
        var urls = [];
        if (typeof THREE === 'undefined') {
            urls.push('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
            urls.push('https://unpkg.com/three@0.128.0/examples/js/controls/OrbitControls.js');
        }
        if (typeof render_hsection_3d !== 'function') {
            urls.push('https://macrobim.github.io/macroBIM/bim_hsection_3d.js');
        }
        (function loadNext(i) {
            if (i >= urls.length) {
                if (typeof render_hsection_3d === 'function') render_hsection_3d('hsec3d', geo, geo, dseg_leng);
                return;
            }
            var s = document.createElement('script');
            s.src = urls[i];
            s.onload = function() { loadNext(i+1); };
            s.onerror = function() { loadNext(i+1); };
            document.head.appendChild(s);
        })(0);
    }
    _render3d();

    fdraw_hsection_2d('front');
}

function fdraw_hsection_2d(viewName) {
    if (!_hsec_drawData) return;
    var data = _hsec_drawData;
    var geo = data.geo;
    var aparam = data.aparam;
    var dseg_leng = data.dseg_leng;
    var alayer = data.alayer;

    ['front','back','left','center','right','top','bottom'].forEach(function(name) {
        var btn = document.getElementById('hsec_tab_' + name);
        if (!btn) return;
        if (name === viewName) {
            btn.style.background = '#2563eb'; btn.style.color = '#fff'; btn.style.borderColor = '#2563eb';
        } else {
            btn.style.background = '#334155'; btn.style.color = '#94a3b8'; btn.style.borderColor = '#475569';
        }
    });

    var ocvs = new KonvaViewer('hsec_2dview', {
        gridCols: 1, layout: [{ views: [viewName], span: 1 }]
    });
    ocvs.addLayer(alayer[0], 'cyan', 'solid', 1.5);
    ocvs.addLayer(alayer[1], 'cyan', 'hidden', 1.5);
    ocvs.addLayer(alayer[2], 'red', 'solid', 1.5);

    function gp(name) { var f = geo.points.find(p => p.name === name); return f ? Object.assign({}, f[name]) : {x:0,y:0}; }
    var half = dseg_leng / 2;
    var ddim_off = 20, ddim_ext = 20;

    if (viewName === 'front' || viewName === 'back') {
        // Same cross-section either way (uniform)
        geo.lines.forEach(l => ocvs.addLine(viewName, l.x1, l.y1, l.x2, l.y2, alayer[0]));
        geo.arcs.forEach(a => ocvs.addArc(viewName, a.x, a.y, a.r, a.angb, a.ange, alayer[0]));

        var ptl = gp('ptl'), ptr = gp('ptr'), pbl = gp('pbl'), pbr = gp('pbr');
        var ptfl = gp('ptfl'), pwtl = gp('pwtl'), pwbl = gp('pwbl'), pbfl = gp('pbfl');
        var xleft = Math.min(pbl.x, ptl.x);

        // Vertical chain on left: total / tbf / web / ttf
        ocvs.addDimLinear(viewName, xleft - ddim_off, pbl.y,  xleft - ddim_off, ptl.y,  ddim_ext * 6);
        ocvs.addDimLinear(viewName, xleft - ddim_off, pbl.y,  xleft - ddim_off, pbfl.y, ddim_ext * 3);
        ocvs.addDimLinear(viewName, xleft - ddim_off, pwbl.y, xleft - ddim_off, pwtl.y, ddim_ext * 3);
        ocvs.addDimLinear(viewName, xleft - ddim_off, ptfl.y, xleft - ddim_off, ptl.y,  ddim_ext * 3);
        // Top width
        ocvs.addDimLinear(viewName, ptl.x, ptl.y + ddim_off, ptr.x, ptr.y + ddim_off, ddim_ext * 6);
        // Bottom width
        ocvs.addDimLinear(viewName, pbl.x, pbl.y - ddim_off, pbr.x, pbr.y - ddim_off, ddim_ext * -6);
        // Web thickness (centered)
        ocvs.addDimLinear(viewName, pwtl.x, (pwtl.y + pwbl.y)/2, gp('pwtr').x, (pwtl.y + pwbl.y)/2, ddim_ext * 1);
        // Radii (use a.x/a.y — arc data uses those keys, not ox/oy)
        geo.arcs.forEach(a => {
            var ang = a.x > 0 ? (a.y > aparam.dsech / 2 ? -45 : 45)
                              : (a.y > aparam.dsech / 2 ? 135 : 225);
            ocvs.addDimRadius(viewName, a.x, a.y, a.r, ang);
        });

    } else if (viewName === 'top') {
        var ptl = gp('ptl'), ptr = gp('ptr'), pwtl = gp('pwtl'), pwtr = gp('pwtr');
        ['ptl','ptr'].forEach(n => {
            var p = gp(n);
            ocvs.addLine(viewName, p.x, -half, p.x, half, alayer[0]);
        });
        ocvs.addLine(viewName, ptl.x, -half, ptr.x, -half, alayer[0]);
        ocvs.addLine(viewName, ptl.x,  half, ptr.x,  half, alayer[0]);
        ['pwtl','pwtr'].forEach(n => {
            var p = gp(n);
            ocvs.addLine(viewName, p.x, -half, p.x, half, alayer[1]);
        });
        // dims
        ocvs.addDimLinear(viewName, ptl.x - ddim_off, -half, ptl.x - ddim_off, half, ddim_ext * 6);
        ocvs.addDimLinear(viewName, ptl.x, half + ddim_off, ptr.x, half + ddim_off, ddim_ext * 6);
        ocvs.addDimLinear(viewName, pwtl.x, half + ddim_off, pwtr.x, half + ddim_off, ddim_ext * 3);

    } else if (viewName === 'bottom') {
        var pbl = gp('pbl'), pbr = gp('pbr'), pwbl = gp('pwbl'), pwbr = gp('pwbr');
        ['pbl','pbr'].forEach(n => {
            var p = gp(n);
            ocvs.addLine(viewName, p.x, -half, p.x, half, alayer[0]);
        });
        ocvs.addLine(viewName, pbl.x, -half, pbr.x, -half, alayer[0]);
        ocvs.addLine(viewName, pbl.x,  half, pbr.x,  half, alayer[0]);
        ['pwbl','pwbr'].forEach(n => {
            var p = gp(n);
            ocvs.addLine(viewName, p.x, -half, p.x, half, alayer[1]);
        });
        ocvs.addDimLinear(viewName, pbl.x - ddim_off, -half, pbl.x - ddim_off, half, ddim_ext * 6);
        ocvs.addDimLinear(viewName, pbl.x, half + ddim_off, pbr.x, half + ddim_off, ddim_ext * 6);
        ocvs.addDimLinear(viewName, pwbl.x, half + ddim_off, pwbr.x, half + ddim_off, ddim_ext * 3);

    } else if (viewName === 'left' || viewName === 'right' || viewName === 'center') {
        var ptl = gp('ptl'), pbl = gp('pbl'), ptfl = gp('ptfl'), pwtl = gp('pwtl');
        var pwbl = gp('pwbl'), pbfl = gp('pbfl');
        ['ptl','ptfl','pwtl','pwbl','pbfl','pbl'].forEach(n => {
            var p = gp(n);
            ocvs.addLine(viewName, -half, p.y, half, p.y, alayer[0]);
        });
        ocvs.addLine(viewName, -half, pbl.y, -half, ptl.y, alayer[0]);
        ocvs.addLine(viewName,  half, pbl.y,  half, ptl.y, alayer[0]);
        // dims
        ocvs.addDimLinear(viewName, -half - ddim_off, pbl.y, -half - ddim_off, ptl.y, ddim_ext * 6);
        ocvs.addDimLinear(viewName, -half - ddim_off, pbl.y, -half - ddim_off, pbfl.y, ddim_ext * 3);
        ocvs.addDimLinear(viewName, -half - ddim_off, pwtl.y, -half - ddim_off, ptfl.y, ddim_ext * 3);
        ocvs.addDimLinear(viewName, -half, ptl.y + ddim_off, half, ptl.y + ddim_off, ddim_ext * 6);
    }

    ocvs.render();
}
