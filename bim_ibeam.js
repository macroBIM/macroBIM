/*
    i Beam 작도를 위한 JS  v002
    - Tapered Begin/End cross-section support (_s / _e IDs)
    - box1cell-style split layout: 3D (left) + tabbed 2D viewport (right)
*/
const odxf_ibeam = dxf_generator();
const scvs_ibeam = "ibeamplot";

const _IBEAM_KEYS = ['dh', 'dbt', 'dbb', 'dttf', 'dttf1', 'dtbf', 'dtbf1',
                     'dtw', 'drtf', 'drwt', 'drwb', 'drbf', 'dchb'];

function getParams_ibeam() {
    const getValue = (id) => {
        const el = document.getElementById(id);
        return el ? Number(el.value) : 0;
    };

    let aparam_b = {};
    let aparam_e = {};
    _IBEAM_KEYS.forEach(k => {
        aparam_b[k] = getValue(k + '_s');
        aparam_e[k] = getValue(k + '_e');
    });

    let dseg_leng = getValue('dseg_leng');
    let combText_b = _IBEAM_KEYS.map(k => aparam_b[k]).join(',');
    let combText_e = _IBEAM_KEYS.map(k => aparam_e[k]).join(',');

    return { aparam_b, aparam_e, dseg_leng, combText_b, combText_e };
}

function putParams_ibeam(textareaId) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;

    const lines = textarea.value.split('\n');
    if (lines.length < 1) return;

    const values_b = (lines[0] || '').split(',');
    const values_e = (lines.length >= 3 ? lines[1] : lines[0] || '').split(',');
    const dseg_leng = lines.length >= 3 ? lines[2] : (lines[1] || '');

    _IBEAM_KEYS.forEach((key, index) => {
        if (values_b[index] !== undefined) {
            const elS = document.getElementById(key + '_s');
            if (elS) elS.value = values_b[index].trim();
        }
        if (values_e[index] !== undefined) {
            const elE = document.getElementById(key + '_e');
            if (elE) elE.value = values_e[index].trim();
        }
    });

    if (dseg_leng !== undefined && dseg_leng !== '') {
        const el = document.getElementById('dseg_leng');
        if (el) el.value = String(dseg_leng).trim();
    }

    if (typeof fdraw_ibeam === 'function') fdraw_ibeam();
}

/*
    geo_ibeam: compute cross-section geometry for one I-beam section
    Returns { points, lines, arcs, outline }
      points  : named points (ptl, ptfl, pwtl, pwbl, pbfl, pbl, ...) for view computations
      lines   : array of {x1,y1,x2,y2} for 2D drawing of the cross-section
      arcs    : array of {x,y,r,angb,ange} for 2D drawing
      outline : ordered closed polygon (clockwise) — used for 3D loft and shape capping
*/
function geo_ibeam({ dh, dbt, dbb, dttf, dttf1, dtbf, dtbf1, dtw,
                     drtf, drwt, drwb, drbf, dchb }) {
    let opts = [];
    let olines = [];
    let oarcs = [];

    // Corner points (origin: bottom-center, y up)
    let ptl  = { x: -dbt / 2,  y: dh };
    let ptfl = { x: -dbt / 2,  y: dh - dttf };
    let pwtl = { x: -dtw / 2,  y: dh - dttf - dttf1 };
    let pwbl = { x: -dtw / 2,  y: dtbf + dtbf1 };
    let pbfl = { x: -dbb / 2,  y: dtbf };
    let pbl  = { x: -dbb / 2,  y: 0 };

    let ptr  = { x:  dbt / 2,  y: dh };
    let ptfr = { x:  dbt / 2,  y: dh - dttf };
    let pwtr = { x:  dtw / 2,  y: dh - dttf - dttf1 };
    let pwbr = { x:  dtw / 2,  y: dtbf + dtbf1 };
    let pbfr = { x:  dbb / 2,  y: dtbf };
    let pbr  = { x:  dbb / 2,  y: 0 };

    let pbc  = { x: 0, y: 0 };

    [['ptl',ptl],['ptfl',ptfl],['pwtl',pwtl],['pwbl',pwbl],['pbfl',pbfl],['pbl',pbl],
     ['ptr',ptr],['ptfr',ptfr],['pwtr',pwtr],['pwbr',pwbr],['pbfr',pbfr],['pbr',pbr]
    ].forEach(([n, p]) => opts.push({[n]: p, name: n}));

    // Fillets / chamfers (left)
    let fil_tl  = geo_fillet(ptl,  ptfl, pwtl, drtf);
    let fil_wtl = geo_fillet(ptfl, pwtl, pwbl, drwt);
    let fil_wbl = geo_fillet(pwtl, pwbl, pbfl, drwb);
    let fil_bl  = geo_fillet(pwbl, pbfl, pbl,  drbf);
    let chf_bl  = geo_chamfer(pbfl, pbl, pbc,  dchb);

    // Fillets / chamfers (right)
    let fil_tr  = geo_fillet(ptr,  ptfr, pwtr, drtf);
    let fil_wtr = geo_fillet(ptfr, pwtr, pwbr, drwt);
    let fil_wbr = geo_fillet(pwtr, pwbr, pbfr, drwb);
    let fil_br  = geo_fillet(pwbr, pbfr, pbr,  drbf);
    let chf_br  = geo_chamfer(pbfr, pbr, pbc,  dchb);

    // === Helper: emit line+optional fillet arc for a corner ===
    function emitEdge(startPt, endPt, fillet, hasFillet) {
        // emits line from startPt to (fillet.xb,yb) and arc; returns next start
        if (!hasFillet) {
            olines.push({ x1: startPt.x, y1: startPt.y, x2: endPt.x, y2: endPt.y });
            return endPt;
        }
        olines.push({ x1: startPt.x, y1: startPt.y, x2: fillet.xb, y2: fillet.yb });
        oarcs.push({ x: fillet.ox, y: fillet.oy, r: fillet.r,
                     angb: fillet.angb, ange: fillet.ange });
        return { x: fillet.xe, y: fillet.ye };
    }

    // === LEFT side outline (top → bottom) ===
    let cur = ptl;
    cur = emitEdge(cur, ptfl, fil_tl,  drtf > 0);
    cur = emitEdge(cur, pwtl, fil_wtl, drwt > 0);
    cur = emitEdge(cur, pwbl, fil_wbl, drwb > 0);
    cur = emitEdge(cur, pbfl, fil_bl,  drbf > 0);
    // Chamfer / direct to pbl
    if (dchb > 0) {
        olines.push({ x1: cur.x, y1: cur.y, x2: chf_bl.xb, y2: chf_bl.yb });
        olines.push({ x1: chf_bl.xb, y1: chf_bl.yb, x2: chf_bl.xe, y2: chf_bl.ye });
    } else {
        olines.push({ x1: cur.x, y1: cur.y, x2: pbl.x, y2: pbl.y });
    }

    // === RIGHT side outline (top → bottom) ===
    cur = ptr;
    cur = emitEdge(cur, ptfr, fil_tr,  drtf > 0);
    cur = emitEdge(cur, pwtr, fil_wtr, drwt > 0);
    cur = emitEdge(cur, pwbr, fil_wbr, drwb > 0);
    cur = emitEdge(cur, pbfr, fil_br,  drbf > 0);
    if (dchb > 0) {
        olines.push({ x1: cur.x, y1: cur.y, x2: chf_br.xb, y2: chf_br.yb });
        olines.push({ x1: chf_br.xb, y1: chf_br.yb, x2: chf_br.xe, y2: chf_br.ye });
    } else {
        olines.push({ x1: cur.x, y1: cur.y, x2: pbr.x, y2: pbr.y });
    }

    // === Top edge & bottom edge (close the outline) ===
    olines.push({ x1: ptl.x, y1: ptl.y, x2: ptr.x, y2: ptr.y });
    if (dchb > 0) {
        olines.push({ x1: chf_bl.xe, y1: chf_bl.ye, x2: chf_br.xe, y2: chf_br.ye });
    } else {
        olines.push({ x1: pbl.x, y1: pbl.y, x2: pbr.x, y2: pbr.y });
    }

    // === Outline polygon for 3D loft (clockwise, no fillets — sharp corners) ===
    let outline = [];
    outline.push({ x: ptl.x,  y: ptl.y  });
    outline.push({ x: ptr.x,  y: ptr.y  });
    outline.push({ x: ptfr.x, y: ptfr.y });
    outline.push({ x: pwtr.x, y: pwtr.y });
    outline.push({ x: pwbr.x, y: pwbr.y });
    outline.push({ x: pbfr.x, y: pbfr.y });
    if (dchb > 0) {
        outline.push({ x: chf_br.xb, y: chf_br.yb });
        outline.push({ x: chf_br.xe, y: chf_br.ye });
        outline.push({ x: chf_bl.xe, y: chf_bl.ye });
        outline.push({ x: chf_bl.xb, y: chf_bl.yb });
    } else {
        outline.push({ x: pbr.x, y: pbr.y });
        outline.push({ x: pbl.x, y: pbl.y });
    }
    outline.push({ x: pbfl.x, y: pbfl.y });
    outline.push({ x: pwbl.x, y: pwbl.y });
    outline.push({ x: pwtl.x, y: pwtl.y });
    outline.push({ x: ptfl.x, y: ptfl.y });

    return { points: opts, lines: olines, arcs: oarcs, outline: outline };
}

var _ibeam_drawData = null;

function fdraw_ibeam() {
    var alayer = ['ibeam_solid', 'ibeam_hidden', 'ibeam_center'];

    // Split layout: 3D (left) + Tabbed 2D (right)
    var _container = document.getElementById(scvs_ibeam);
    if (!_container) return;
    _container.innerHTML = '';
    _container.style.display = 'flex';
    _container.style.gap = '2px';
    _container.style.backgroundColor = '#000';
    _container.style.height = '560px';

    var div3d = document.createElement('div');
    div3d.id = 'ibeam3d';
    div3d.style.cssText = 'width:50%;height:560px;background:#1a1a2e;';
    _container.appendChild(div3d);

    var divRight = document.createElement('div');
    divRight.style.cssText = 'width:50%;height:560px;display:flex;flex-direction:column;';

    var tabBar = document.createElement('div');
    tabBar.style.cssText = 'display:flex;gap:2px;padding:4px;background:#1e293b;flex-wrap:wrap;flex-shrink:0;';
    var tabNames = ['Front', 'Back', 'Left', 'Center', 'Right', 'Top', 'Bottom'];
    tabNames.forEach(function(name, i) {
        var btn = document.createElement('button');
        btn.textContent = name;
        btn.id = 'ibeam_tab_' + name.toLowerCase();
        btn.style.cssText = 'padding:4px 10px;border:1px solid #475569;background:' +
            (i === 0 ? '#2563eb' : '#334155') + ';color:' +
            (i === 0 ? '#fff' : '#94a3b8') +
            ';cursor:pointer;border-radius:4px;font-size:11px;font-weight:600;';
        btn.onclick = function() { fdraw_ibeam_2d(name.toLowerCase()); };
        tabBar.appendChild(btn);
    });
    divRight.appendChild(tabBar);

    var viewport2d = document.createElement('div');
    viewport2d.id = 'ibeam_2dview';
    viewport2d.style.cssText = 'width:100%;flex:1;background:#000;';
    divRight.appendChild(viewport2d);
    _container.appendChild(divRight);

    // DXF preparation
    odxf_ibeam.init();
    odxf_ibeam.layer(alayer[0], 4, "CONTINUOUS");
    odxf_ibeam.layer(alayer[1], 4, "HIDDEN");
    odxf_ibeam.layer(alayer[2], 1, "CENTER");

    // Load data
    let auserdata = getParams_ibeam();
    let aparam_b = auserdata.aparam_b;
    let aparam_e = auserdata.aparam_e;
    let dseg_leng = auserdata.dseg_leng;

    // Reflect into CSV textarea
    let ouserTextArea = document.getElementById('sUserText');
    if (ouserTextArea) {
        ouserTextArea.value = auserdata.combText_b + "\n" + auserdata.combText_e + "\n" + dseg_leng;
    }

    // Compute begin/end cross-section geometries
    let oibeam_b = geo_ibeam(aparam_b);
    let oibeam_e = geo_ibeam(aparam_e);

    // DXF: Begin front + End back, side-by-side
    let dOx_dxf = Math.max(aparam_b.dbt, aparam_e.dbt) * -1.0;
    oibeam_b.lines.forEach(line => odxf_ibeam.line(
        line.x1 + dOx_dxf, line.y1, line.x2 + dOx_dxf, line.y2, alayer[0]));
    oibeam_b.arcs.forEach(arc => odxf_ibeam.arc(
        arc.x + dOx_dxf, arc.y, arc.r, arc.angb, arc.ange, alayer[0]));

    dOx_dxf = Math.max(aparam_b.dbt, aparam_e.dbt) * 1.0;
    oibeam_e.lines.forEach(line => odxf_ibeam.line(
        line.x1 + dOx_dxf, line.y1, line.x2 + dOx_dxf, line.y2, alayer[0]));
    oibeam_e.arcs.forEach(arc => odxf_ibeam.arc(
        arc.x + dOx_dxf, arc.y, arc.r, arc.angb, arc.ange, alayer[0]));

    // Store for tab switching
    _ibeam_drawData = {
        oibeam_b: oibeam_b,
        oibeam_e: oibeam_e,
        aparam_b: aparam_b,
        aparam_e: aparam_e,
        dseg_leng: dseg_leng,
        alayer: alayer
    };

    // Render 3D view (dynamically load Three.js if missing)
    function _render3d() {
        if (typeof render_ibeam_3d === 'function' && typeof THREE !== 'undefined') {
            render_ibeam_3d('ibeam3d', oibeam_b, oibeam_e, dseg_leng);
            return;
        }
        var msg3d = document.getElementById('ibeam3d');
        if (msg3d) {
            msg3d.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;font-size:14px;">3D Loading...</div>';
        }
        var urls = [];
        if (typeof THREE === 'undefined') {
            urls.push('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
            urls.push('https://unpkg.com/three@0.128.0/examples/js/controls/OrbitControls.js');
        }
        if (typeof render_ibeam_3d !== 'function') {
            urls.push('https://macrobim.github.io/macroBIM/bim_ibeam_3d.js');
        }
        (function loadNext(i) {
            if (i >= urls.length) {
                if (typeof render_ibeam_3d === 'function') {
                    render_ibeam_3d('ibeam3d', oibeam_b, oibeam_e, dseg_leng);
                }
                return;
            }
            var s = document.createElement('script');
            s.src = urls[i];
            s.onload = function() { loadNext(i + 1); };
            s.onerror = function() { loadNext(i + 1); };
            document.head.appendChild(s);
        })(0);
    }
    _render3d();

    // Initial 2D view
    fdraw_ibeam_2d('front');
}

function fdraw_ibeam_2d(viewName) {
    if (!_ibeam_drawData) return;

    var data = _ibeam_drawData;
    var oibeam_b = data.oibeam_b;
    var oibeam_e = data.oibeam_e;
    var dseg_leng = data.dseg_leng;
    var alayer = data.alayer;

    // Update tab styles
    ['front', 'back', 'left', 'center', 'right', 'top', 'bottom'].forEach(function(name) {
        var btn = document.getElementById('ibeam_tab_' + name);
        if (!btn) return;
        if (name === viewName) {
            btn.style.background = '#2563eb';
            btn.style.color = '#fff';
            btn.style.borderColor = '#2563eb';
        } else {
            btn.style.background = '#334155';
            btn.style.color = '#94a3b8';
            btn.style.borderColor = '#475569';
        }
    });

    // Single-view KonvaViewer
    var ocvs = new KonvaViewer('ibeam_2dview', {
        gridCols: 1,
        layout: [{ views: [viewName], span: 1 }]
    });

    ocvs.addLayer(alayer[0], 'cyan', 'solid', 1.5);
    ocvs.addLayer(alayer[1], 'cyan', 'hidden', 1.5);
    ocvs.addLayer(alayer[2], 'red', 'solid', 1.5);

    function gp(points, name) {
        var found = points.find(function(p) { return p.name === name; });
        if (found) return { ...found[name] };
        return { x: 0, y: 0 };
    }

    var p1, p2;
    var half = dseg_leng / 2;

    if (viewName === 'front') {
        oibeam_b.lines.forEach(line =>
            ocvs.addLine(viewName, line.x1, line.y1, line.x2, line.y2, alayer[0]));
        oibeam_b.arcs.forEach(arc =>
            ocvs.addArc(viewName, arc.x, arc.y, arc.r, arc.angb, arc.ange, alayer[0]));

    } else if (viewName === 'back') {
        oibeam_e.lines.forEach(line =>
            ocvs.addLine(viewName, line.x1, line.y1, line.x2, line.y2, alayer[0]));
        oibeam_e.arcs.forEach(arc =>
            ocvs.addArc(viewName, arc.x, arc.y, arc.r, arc.angb, arc.ange, alayer[0]));

    } else if (viewName === 'top') {
        // Plan view at top flange: x = section x, y = length axis (-half → +half)
        var pts_b = oibeam_b.points;
        var pts_e = oibeam_e.points;

        // outer outline lines (begin→end edges along length)
        ['ptl', 'ptr'].forEach(n => {
            p1 = gp(pts_b, n); p2 = gp(pts_e, n);
            ocvs.addLine(viewName, p1.x, -half, p2.x, half, alayer[0]);
        });
        // begin/end transverse lines
        p1 = gp(pts_b, "ptl"); p2 = gp(pts_b, "ptr");
        ocvs.addLine(viewName, p1.x, -half, p2.x, -half, alayer[0]);
        p1 = gp(pts_e, "ptl"); p2 = gp(pts_e, "ptr");
        ocvs.addLine(viewName, p1.x, half, p2.x, half, alayer[0]);

        // Hidden: web edges visible from top through flange
        ['pwtl', 'pwtr'].forEach(n => {
            p1 = gp(pts_b, n); p2 = gp(pts_e, n);
            ocvs.addLine(viewName, p1.x, -half, p2.x, half, alayer[1]);
        });

    } else if (viewName === 'bottom') {
        var pts_b = oibeam_b.points;
        var pts_e = oibeam_e.points;

        ['pbl', 'pbr'].forEach(n => {
            p1 = gp(pts_b, n); p2 = gp(pts_e, n);
            ocvs.addLine(viewName, p1.x, -half, p2.x, half, alayer[0]);
        });
        p1 = gp(pts_b, "pbl"); p2 = gp(pts_b, "pbr");
        ocvs.addLine(viewName, p1.x, -half, p2.x, -half, alayer[0]);
        p1 = gp(pts_e, "pbl"); p2 = gp(pts_e, "pbr");
        ocvs.addLine(viewName, p1.x, half, p2.x, half, alayer[0]);

        ['pwbl', 'pwbr'].forEach(n => {
            p1 = gp(pts_b, n); p2 = gp(pts_e, n);
            ocvs.addLine(viewName, p1.x, -half, p2.x, half, alayer[1]);
        });

    } else if (viewName === 'left' || viewName === 'right' || viewName === 'center') {
        // Side view: x = length axis (-half → +half), y = section height
        var pts_b = oibeam_b.points;
        var pts_e = oibeam_e.points;

        ['ptl', 'ptfl', 'pwtl', 'pwbl', 'pbfl', 'pbl'].forEach(n => {
            p1 = gp(pts_b, n);
            p2 = gp(pts_e, n);
            ocvs.addLine(viewName, -half, p1.y, half, p2.y, alayer[0]);
        });

        // End caps
        let pbt_b = gp(pts_b, "ptl"), pbb_b = gp(pts_b, "pbl");
        let pbt_e = gp(pts_e, "ptl"), pbb_e = gp(pts_e, "pbl");
        ocvs.addLine(viewName, -half, pbb_b.y, -half, pbt_b.y, alayer[0]);
        ocvs.addLine(viewName,  half, pbb_e.y,  half, pbt_e.y, alayer[0]);
    }

    ocvs.render();
}
