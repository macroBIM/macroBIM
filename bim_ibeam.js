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

    // Store for tab switching (before DXF pass so 2D/3D render even if DXF crashes)
    _ibeam_drawData = {
        oibeam_b: oibeam_b,
        oibeam_e: oibeam_e,
        aparam_b: aparam_b,
        aparam_e: aparam_e,
        dseg_leng: dseg_leng,
        alayer: alayer
    };

    try {
    // === DXF layout ===
    //   Row 1 (cross sections): [Front (Begin)]  [Back (End)]
    //   Row 2 (long views):     [Top]            [Bottom]
    //   Row 3 (side view):      [Side]
    let _max_bt   = Math.max(aparam_b.dbt, aparam_e.dbt);
    let _max_bb   = Math.max(aparam_b.dbb, aparam_e.dbb);
    let _max_h    = Math.max(aparam_b.dh,  aparam_e.dh);
    let _max_w    = Math.max(_max_bt, _max_bb);
    let _row_pitch = _max_h * 2.0;                          // vertical pitch between rows
    let _col_pitch = Math.max(_max_w, dseg_leng) * 1.5;     // horizontal pitch between columns

    function _gpx(geo, n) {
        var found = geo.points.find(p => p.name === n);
        return found ? { x: found[n].x, y: found[n].y } : { x: 0, y: 0 };
    }

    // Row 1 — Front (Begin) at column 0
    let dOx_dxf = 0, dOy_dxf = 0;
    oibeam_b.lines.forEach(line => odxf_ibeam.line(
        line.x1 + dOx_dxf, line.y1 + dOy_dxf, line.x2 + dOx_dxf, line.y2 + dOy_dxf, alayer[0]));
    oibeam_b.arcs.forEach(arc => odxf_ibeam.arc(
        arc.x + dOx_dxf, arc.y + dOy_dxf, arc.r, arc.angb, arc.ange, alayer[0]));

    // Row 1 — Back (End) at column 1
    dOx_dxf = _col_pitch; dOy_dxf = 0;
    oibeam_e.lines.forEach(line => odxf_ibeam.line(
        line.x1 + dOx_dxf, line.y1 + dOy_dxf, line.x2 + dOx_dxf, line.y2 + dOy_dxf, alayer[0]));
    oibeam_e.arcs.forEach(arc => odxf_ibeam.arc(
        arc.x + dOx_dxf, arc.y + dOy_dxf, arc.r, arc.angb, arc.ange, alayer[0]));

    // Helper: draw a plan/side view between Begin and End onto DXF at given offset
    function _dxf_long_view(off_x, off_y, pointNames, hiddenNames, axis) {
        // axis = 'top' (plan, x = section_x, y = length): use section x as DXF x
        // axis = 'side' (elevation, x = length, y = section_y)
        let half = dseg_leng / 2;
        pointNames.forEach(function(n) {
            let pb = _gpx(oibeam_b, n);
            let pe = _gpx(oibeam_e, n);
            if (axis === 'top') {
                // begin at y=-half, end at y=+half
                odxf_ibeam.line(off_x + pb.x, off_y - half, off_x + pe.x, off_y + half, alayer[0]);
            } else {
                // axis 'side': begin at x=-half, end at x=+half, section y
                odxf_ibeam.line(off_x - half, off_y + pb.y, off_x + half, off_y + pe.y, alayer[0]);
            }
        });
        // transverse caps (Begin & End edges of the view)
        if (pointNames.length >= 2) {
            let n1 = pointNames[0], n2 = pointNames[pointNames.length - 1];
            let pb1 = _gpx(oibeam_b, n1), pb2 = _gpx(oibeam_b, n2);
            let pe1 = _gpx(oibeam_e, n1), pe2 = _gpx(oibeam_e, n2);
            if (axis === 'top') {
                odxf_ibeam.line(off_x + pb1.x, off_y - half, off_x + pb2.x, off_y - half, alayer[0]);
                odxf_ibeam.line(off_x + pe1.x, off_y + half, off_x + pe2.x, off_y + half, alayer[0]);
            } else {
                odxf_ibeam.line(off_x - half, off_y + pb1.y, off_x - half, off_y + pb2.y, alayer[0]);
                odxf_ibeam.line(off_x + half, off_y + pe1.y, off_x + half, off_y + pe2.y, alayer[0]);
            }
        }
        // hidden lines (web edges through flange)
        hiddenNames.forEach(function(n) {
            let pb = _gpx(oibeam_b, n);
            let pe = _gpx(oibeam_e, n);
            if (axis === 'top') {
                odxf_ibeam.line(off_x + pb.x, off_y - half, off_x + pe.x, off_y + half, alayer[1]);
            } else {
                odxf_ibeam.line(off_x - half, off_y + pb.y, off_x + half, off_y + pe.y, alayer[1]);
            }
        });
    }

    // Row 2 — Top view at column 0
    _dxf_long_view(0, _row_pitch, ['ptl', 'ptr'], ['pwtl', 'pwtr'], 'top');

    // Row 2 — Bottom view at column 1
    _dxf_long_view(_col_pitch, _row_pitch, ['pbl', 'pbr'], ['pwbl', 'pwbr'], 'top');

    // Row 3 — Side (elevation) view at column 0
    _dxf_long_view(0, _row_pitch * 2, ['ptl', 'ptfl', 'pwtl', 'pwbl', 'pbfl', 'pbl'], [], 'side');

    } catch(e) { console.error('ibeam DXF pass error:', e); }

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
    try { _render3d(); } catch(e) { console.error('ibeam 3D render error:', e); }

    // Initial 2D view
    fdraw_ibeam_2d('front');
}

function fdraw_ibeam_2d(viewName) {
    if (!_ibeam_drawData) return;

    var data = _ibeam_drawData;
    var oibeam_b = data.oibeam_b;
    var oibeam_e = data.oibeam_e;
    var aparam_b = data.aparam_b;
    var aparam_e = data.aparam_e;
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
    var ddim_ext = 20;   // dimension extension length
    var ddim_off = 20;   // offset from geometry

    // Helper: cross-section dimensions on a single section (Begin or End)
    function _xsec_dims(geo, ap) {
        var ptl  = gp(geo.points, 'ptl');
        var ptfl = gp(geo.points, 'ptfl');
        var pwtl = gp(geo.points, 'pwtl');
        var pwbl = gp(geo.points, 'pwbl');
        var pbfl = gp(geo.points, 'pbfl');
        var pbl  = gp(geo.points, 'pbl');
        var ptr  = gp(geo.points, 'ptr');
        var pwtr = gp(geo.points, 'pwtr');
        var pwbr = gp(geo.points, 'pwbr');
        var pbr  = gp(geo.points, 'pbr');

        var xleft = Math.min(pbl.x, ptl.x);

        // Vertical chain (left side)
        ocvs.addDimLinear(viewName, xleft - ddim_off, pbl.y,  xleft - ddim_off, ptl.y,  ddim_ext * 6);
        ocvs.addDimLinear(viewName, xleft - ddim_off, pbl.y,  xleft - ddim_off, pbfl.y, ddim_ext * 3);
        ocvs.addDimLinear(viewName, xleft - ddim_off, pbfl.y, xleft - ddim_off, pwbl.y, ddim_ext * 3);
        ocvs.addDimLinear(viewName, xleft - ddim_off, pwbl.y, xleft - ddim_off, pwtl.y, ddim_ext * 3);
        ocvs.addDimLinear(viewName, xleft - ddim_off, pwtl.y, xleft - ddim_off, ptfl.y, ddim_ext * 3);
        ocvs.addDimLinear(viewName, xleft - ddim_off, ptfl.y, xleft - ddim_off, ptl.y,  ddim_ext * 3);

        // Horizontal chain (top)
        ocvs.addDimLinear(viewName, ptl.x,  ptl.y + ddim_off, ptr.x,  ptr.y + ddim_off, ddim_ext * 6);
        ocvs.addDimLinear(viewName, ptl.x,  ptl.y + ddim_off, pwtl.x, ptl.y + ddim_off, ddim_ext * 3);
        ocvs.addDimLinear(viewName, pwtl.x, ptl.y + ddim_off, pwtr.x, ptr.y + ddim_off, ddim_ext * 3);
        ocvs.addDimLinear(viewName, pwtr.x, ptl.y + ddim_off, ptr.x,  ptr.y + ddim_off, ddim_ext * 3);

        // Horizontal chain (bottom)
        ocvs.addDimLinear(viewName, pbl.x,  pbl.y - ddim_off, pbr.x,  pbr.y - ddim_off, ddim_ext * -6);
        ocvs.addDimLinear(viewName, pbl.x,  pbl.y - ddim_off, pwbl.x, pbl.y - ddim_off, ddim_ext * -3);
        ocvs.addDimLinear(viewName, pwbl.x, pbl.y - ddim_off, pwbr.x, pbr.y - ddim_off, ddim_ext * -3);
        ocvs.addDimLinear(viewName, pwbr.x, pbl.y - ddim_off, pbr.x,  pbr.y - ddim_off, ddim_ext * -3);

        // Fillet radii (right side) — only when radius > 0 and arc exists
        var arcsByPos = {};
        geo.arcs.forEach(function(a) {
            // map by approximate position to identify which fillet
            if (a.ox > 0 && a.oy > (ap.dh / 2)) arcsByPos.tr = a;
            else if (a.ox > 0 && a.oy > 0 && a.oy < (ap.dh / 2)) arcsByPos.wbr = a;
            else if (a.ox > 0 && a.oy < (ap.dh / 2) && a.oy > 0) arcsByPos.br = a;
        });
        geo.arcs.forEach(function(a) {
            if (a.ox > 0) {
                var angle = a.oy > (ap.dh * 0.7) ? -45
                          : a.oy > (ap.dh * 0.45) ? 135
                          : a.oy > (ap.dh * 0.15) ? 225
                          : 45;
                ocvs.addDimRadius(viewName, a.ox, a.oy, a.r, angle);
            }
        });

        // Chamfer length
        if (ap.dchb > 0) {
            // place dim near right chamfer
            var chf_xb = pbr.x;
            var chf_yb = pbfl.y; // approx
            ocvs.addDimLinear(viewName, pbr.x + ddim_off, pbr.y + ap.dchb, pbr.x + ddim_off, pbr.y, ddim_ext * -3);
        }
    }

    if (viewName === 'front') {
        oibeam_b.lines.forEach(line =>
            ocvs.addLine(viewName, line.x1, line.y1, line.x2, line.y2, alayer[0]));
        oibeam_b.arcs.forEach(arc =>
            ocvs.addArc(viewName, arc.x, arc.y, arc.r, arc.angb, arc.ange, alayer[0]));
        _xsec_dims(oibeam_b, aparam_b);

    } else if (viewName === 'back') {
        oibeam_e.lines.forEach(line =>
            ocvs.addLine(viewName, line.x1, line.y1, line.x2, line.y2, alayer[0]));
        oibeam_e.arcs.forEach(arc =>
            ocvs.addArc(viewName, arc.x, arc.y, arc.r, arc.angb, arc.ange, alayer[0]));
        _xsec_dims(oibeam_e, aparam_e);

    } else if (viewName === 'top') {
        // Plan view at top flange: x = section x, y = length axis (-half → +half)
        var pts_b = oibeam_b.points;
        var pts_e = oibeam_e.points;

        ['ptl', 'ptr'].forEach(n => {
            p1 = gp(pts_b, n); p2 = gp(pts_e, n);
            ocvs.addLine(viewName, p1.x, -half, p2.x, half, alayer[0]);
        });
        p1 = gp(pts_b, "ptl"); p2 = gp(pts_b, "ptr");
        ocvs.addLine(viewName, p1.x, -half, p2.x, -half, alayer[0]);
        p1 = gp(pts_e, "ptl"); p2 = gp(pts_e, "ptr");
        ocvs.addLine(viewName, p1.x, half, p2.x, half, alayer[0]);

        ['pwtl', 'pwtr'].forEach(n => {
            p1 = gp(pts_b, n); p2 = gp(pts_e, n);
            ocvs.addLine(viewName, p1.x, -half, p2.x, half, alayer[1]);
        });

        // Dimensions
        var ptl_b = gp(pts_b, "ptl"), ptr_b = gp(pts_b, "ptr");
        var pwtl_b = gp(pts_b, "pwtl"), pwtr_b = gp(pts_b, "pwtr");
        var ptl_e = gp(pts_e, "ptl"), ptr_e = gp(pts_e, "ptr");
        // length
        ocvs.addDimLinear(viewName, ptl_b.x - ddim_off, -half, ptl_b.x - ddim_off, half, ddim_ext * 6);
        // Begin width chain
        ocvs.addDimLinear(viewName, ptl_b.x, -half - ddim_off, ptr_b.x, -half - ddim_off, ddim_ext * -6);
        ocvs.addDimLinear(viewName, ptl_b.x, -half - ddim_off, pwtl_b.x, -half - ddim_off, ddim_ext * -3);
        ocvs.addDimLinear(viewName, pwtl_b.x, -half - ddim_off, pwtr_b.x, -half - ddim_off, ddim_ext * -3);
        ocvs.addDimLinear(viewName, pwtr_b.x, -half - ddim_off, ptr_b.x, -half - ddim_off, ddim_ext * -3);
        // End width
        ocvs.addDimLinear(viewName, ptl_e.x, half + ddim_off, ptr_e.x, half + ddim_off, ddim_ext * 6);

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

        var pbl_b = gp(pts_b, "pbl"), pbr_b = gp(pts_b, "pbr");
        var pwbl_b = gp(pts_b, "pwbl"), pwbr_b = gp(pts_b, "pwbr");
        var pbl_e = gp(pts_e, "pbl"), pbr_e = gp(pts_e, "pbr");
        ocvs.addDimLinear(viewName, pbl_b.x - ddim_off, -half, pbl_b.x - ddim_off, half, ddim_ext * 6);
        ocvs.addDimLinear(viewName, pbl_b.x, -half - ddim_off, pbr_b.x, -half - ddim_off, ddim_ext * -6);
        ocvs.addDimLinear(viewName, pbl_b.x, -half - ddim_off, pwbl_b.x, -half - ddim_off, ddim_ext * -3);
        ocvs.addDimLinear(viewName, pwbl_b.x, -half - ddim_off, pwbr_b.x, -half - ddim_off, ddim_ext * -3);
        ocvs.addDimLinear(viewName, pwbr_b.x, -half - ddim_off, pbr_b.x, -half - ddim_off, ddim_ext * -3);
        ocvs.addDimLinear(viewName, pbl_e.x, half + ddim_off, pbr_e.x, half + ddim_off, ddim_ext * 6);

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

        // Dimensions on Begin side (left cap)
        var ptfl_b = gp(pts_b, "ptfl"), pwtl_b = gp(pts_b, "pwtl");
        var pwbl_b = gp(pts_b, "pwbl"), pbfl_b = gp(pts_b, "pbfl");
        ocvs.addDimLinear(viewName, -half - ddim_off, pbb_b.y, -half - ddim_off, pbt_b.y,  ddim_ext * 6);
        ocvs.addDimLinear(viewName, -half - ddim_off, pbb_b.y, -half - ddim_off, pbfl_b.y, ddim_ext * 3);
        ocvs.addDimLinear(viewName, -half - ddim_off, pbfl_b.y, -half - ddim_off, pwbl_b.y, ddim_ext * 3);
        ocvs.addDimLinear(viewName, -half - ddim_off, pwbl_b.y, -half - ddim_off, pwtl_b.y, ddim_ext * 3);
        ocvs.addDimLinear(viewName, -half - ddim_off, pwtl_b.y, -half - ddim_off, ptfl_b.y, ddim_ext * 3);
        ocvs.addDimLinear(viewName, -half - ddim_off, ptfl_b.y, -half - ddim_off, pbt_b.y,  ddim_ext * 3);

        // Length dim on top
        ocvs.addDimLinear(viewName, -half, pbt_b.y + ddim_off, half, pbt_e.y + ddim_off, ddim_ext * 6);

        // End cap height dim
        ocvs.addDimLinear(viewName, half + ddim_off, pbb_e.y, half + ddim_off, pbt_e.y, ddim_ext * 6);
    }

    ocvs.render();
}
