/*
    LIFTING LUG 작도 JS v002
    - box1cell 패턴: 3D (left) + tabbed 2D (right)
    - Front/Back = flat lug outline (2D true shape)
    - Left/Right/Center = side view (edge-on: lug plate + padeye plates)
    - Top/Bottom = plan (lugW × padeyeT footprint)
*/
const odxf_lug = dxf_generator();
const scvs_lug = "liftinglugplot";

const _LUG_KEYS = ['lugW','lugH','baseH','outerR','innerR','padeyeR','lugT','padeyeT'];

function getParams_liftinglug() {
    const getValue = (id) => {
        const el = document.getElementById(id);
        return el ? Number(el.value) : 0;
    };
    let aparam = {};
    _LUG_KEYS.forEach(k => { aparam[k] = getValue(k); });
    let combText = _LUG_KEYS.map(k => aparam[k]).join(',');
    return { aparam, combText };
}

function putParams_liftinglug(textareaId) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;
    const lines = textarea.value.split('\n');
    const values = (lines[0] || '').split(',');
    _LUG_KEYS.forEach((k, i) => {
        if (values[i] !== undefined) {
            const el = document.getElementById(k);
            if (el) el.value = values[i].trim();
        }
    });
    if (typeof fdraw_liftinglug === 'function') fdraw_liftinglug();
}

/*
    geo_liftinglug — pure function returning:
      {
        Rcx, Rcy         : arc center (also hole/padeye center)
        Tlx, Tly, Trx, Try : tangent points (base corners → outer arc)
        arc_angb, arc_ange : arc angles for the outer curve (degrees)
        aparam           : echoed input (for renderers)
      }
*/
function geo_liftinglug(aparam) {
    let { lugW, lugH, baseH, outerR, innerR, padeyeR } = aparam;

    let Rcx = 0;
    let Rcy = lugH - outerR;

    let dTlx, dTly, dTrx, dTry, arc_angb, arc_ange;

    if (lugW / 2 >= outerR) {
        const dx = lugW / 2;
        const ddiag = Math.sqrt(dx * dx + (Rcy - baseH) * (Rcy - baseH));
        const dTL = Math.sqrt(Math.max(ddiag * ddiag - outerR * outerR, 0));
        const dang1 = Math.atan(Math.abs(Rcy - baseH) / dx);
        const dang2 = Math.atan(outerR / dTL);
        const dang = dang1 + dang2;

        dTlx = -1 * lugW / 2 + dTL * Math.cos(dang);
        dTly = baseH + dTL * Math.sin(dang);
        dTrx = -dTlx;
        dTry = dTly;

        let angb = Math.atan((Math.abs(dTly) - Math.abs(Rcy)) / Math.abs(dTlx));
        let ange = Math.PI - angb;
        arc_angb = angb * 180 / Math.PI;
        arc_ange = ange * 180 / Math.PI;
    } else {
        const dx = lugW / 2;
        const ddiag = Math.sqrt(dx * dx + (Rcy - baseH) * (Rcy - baseH));
        const dTL = Math.sqrt(Math.max(ddiag * ddiag - outerR * outerR, 0));
        const dang1 = Math.atan(Math.abs(Rcy - baseH) / dx);
        const dang2 = Math.atan(outerR / dTL);
        const dang = Math.PI - (dang1 + dang2);

        dTlx = -lugW / 2 + dTL * Math.cos(dang);
        dTly = baseH + dTL * Math.sin(dang);
        dTrx = -dTlx;
        dTry = dTly;

        let angb = -1 * Math.atan(Math.abs(Math.abs(dTly) - Math.abs(Rcy)) / Math.abs(dTlx));
        let ange = Math.PI - angb;
        arc_angb = angb * 180 / Math.PI;
        arc_ange = ange * 180 / Math.PI;
    }

    return {
        Rcx, Rcy, Tlx: dTlx, Tly: dTly, Trx: dTrx, Try: dTry,
        arc_angb, arc_ange, aparam
    };
}

var _lug_drawData = null;

function fdraw_liftinglug() {
    var alayer = {
        lug:   'lug_outline',
        hlug:  'lug_hidden',
        peye:  'padeye_outline',
        hpeye: 'padeye_hidden',
        cent:  'lug_center'
    };

    var _container = document.getElementById(scvs_lug);
    if (!_container) return;
    _container.innerHTML = '';
    _container.style.display = 'flex';
    _container.style.gap = '2px';
    _container.style.backgroundColor = '#000';
    _container.style.height = '560px';

    var div3d = document.createElement('div');
    div3d.id = 'lug3d';
    div3d.style.cssText = 'width:50%;height:560px;background:#1a1a2e;';
    _container.appendChild(div3d);

    var divRight = document.createElement('div');
    divRight.style.cssText = 'width:50%;height:560px;';

    var tabBar = document.createElement('div');
    tabBar.style.cssText = 'display:flex;gap:2px;padding:4px;background:#1e293b;flex-wrap:wrap;height:34px;box-sizing:border-box;';
    ['Front','Back','Left','Center','Right','Top','Bottom'].forEach(function(name, i) {
        var btn = document.createElement('button');
        btn.textContent = name;
        btn.id = 'lug_tab_' + name.toLowerCase();
        btn.style.cssText = 'padding:4px 10px;border:1px solid #475569;background:' +
            (i === 0 ? '#2563eb' : '#334155') + ';color:' +
            (i === 0 ? '#fff' : '#94a3b8') +
            ';cursor:pointer;border-radius:4px;font-size:11px;font-weight:600;';
        btn.onclick = function() { fdraw_liftinglug_2d(name.toLowerCase()); };
        tabBar.appendChild(btn);
    });
    divRight.appendChild(tabBar);

    var viewport2d = document.createElement('div');
    viewport2d.id = 'lug_2dview';
    viewport2d.style.cssText = 'width:100%;height:526px;background:#000;';
    divRight.appendChild(viewport2d);
    _container.appendChild(divRight);

    let auserdata = getParams_liftinglug();
    let aparam = auserdata.aparam;
    let ouserTextArea = document.getElementById('sUserText');
    if (ouserTextArea) ouserTextArea.value = auserdata.combText;

    // Sanity — bail if any dim is non-positive
    if (Object.values(aparam).some(v => v <= 0)) return;

    // Enforce constraints (only when values are already sensible)
    if (aparam.lugW / 2 < aparam.outerR) {
        aparam.lugW = aparam.outerR * 2;
        var lugWEl = document.getElementById('lugW');
        if (lugWEl) lugWEl.value = aparam.lugW;
    }
    var minRequiredHeight = aparam.outerR + aparam.padeyeR + aparam.baseH;
    if (aparam.lugH < minRequiredHeight) {
        aparam.lugH = minRequiredHeight;
        var lugHEl = document.getElementById('lugH');
        if (lugHEl) lugHEl.value = aparam.lugH;
    }

    let geo = geo_liftinglug(aparam);

    // DXF prep + emit 4 views like the old code
    odxf_lug.init();
    odxf_lug.layer("lug_cent", 1, "CENTER");
    odxf_lug.layer("lug_hidden", 4, "HIDDEN");
    odxf_lug.layer("lug_solid", 4, "CONTINUOUS");
    odxf_lug.layer("padeye", 3, "CONTINUOUS");

    _emit_dxf_liftinglug(geo);

    _lug_drawData = { geo, aparam, alayer };

    // 3D
    function _render3d() {
        if (typeof render_liftinglug_3d === 'function' && typeof THREE !== 'undefined') {
            render_liftinglug_3d('lug3d', geo);
            return;
        }
        var msg = document.getElementById('lug3d');
        if (msg) msg.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;font-size:14px;">3D Loading...</div>';
        var urls = [];
        if (typeof THREE === 'undefined') {
            urls.push('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
            urls.push('https://unpkg.com/three@0.128.0/examples/js/controls/OrbitControls.js');
        }
        if (typeof render_liftinglug_3d !== 'function') {
            urls.push('https://macrobim.github.io/macroBIM/bim_liftinglug_3d.js');
        }
        (function loadNext(i) {
            if (i >= urls.length) {
                if (typeof render_liftinglug_3d === 'function') render_liftinglug_3d('lug3d', geo);
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

    fdraw_liftinglug_2d('front');
}

function fdraw_liftinglug_2d(viewName) {
    if (!_lug_drawData) return;
    var data = _lug_drawData;
    var geo = data.geo;
    var aparam = data.aparam;
    var alayer = data.alayer;

    ['front','back','left','center','right','top','bottom'].forEach(function(name) {
        var btn = document.getElementById('lug_tab_' + name);
        if (!btn) return;
        if (name === viewName) {
            btn.style.background = '#2563eb'; btn.style.color = '#fff'; btn.style.borderColor = '#2563eb';
        } else {
            btn.style.background = '#334155'; btn.style.color = '#94a3b8'; btn.style.borderColor = '#475569';
        }
    });

    var ocvs = new KonvaViewer('lug_2dview', {
        gridCols: 1, layout: [{ views: [viewName], span: 1 }]
    });
    ocvs.addLayer(alayer.lug,   'cyan',    'solid',  2);
    ocvs.addLayer(alayer.hlug,  'cyan',    'hidden', 1.5);
    ocvs.addLayer(alayer.peye,  '#00ff00', 'solid',  2);
    ocvs.addLayer(alayer.hpeye, '#00ff00', 'hidden', 1.5);
    ocvs.addLayer(alayer.cent,  'red',     'solid',  2);

    var { lugW, lugH, baseH, outerR, innerR, padeyeR, lugT, padeyeT } = aparam;
    var { Rcx, Rcy, Tlx, Tly, Trx, Try, arc_angb, arc_ange } = geo;
    var dDimgap = Math.max(15, Math.max(lugW, lugH) * 0.05);

    if (viewName === 'front' || viewName === 'back') {
        // Flat outline of the lug plate
        ocvs.addCircle(viewName, Rcx, Rcy, innerR, alayer.lug);
        ocvs.addCircle(viewName, Rcx, Rcy, padeyeR, alayer.peye);
        ocvs.addLine(viewName, Tlx, Tly, -lugW/2, baseH, alayer.lug);
        ocvs.addLine(viewName, -lugW/2, baseH, -lugW/2, 0, alayer.lug);
        ocvs.addLine(viewName, -lugW/2, 0, lugW/2, 0, alayer.lug);
        ocvs.addLine(viewName, lugW/2, 0, lugW/2, baseH, alayer.lug);
        ocvs.addLine(viewName, lugW/2, baseH, Trx, Try, alayer.lug);
        ocvs.addArc(viewName, Rcx, Rcy, outerR, arc_angb, arc_ange, alayer.lug);

        ocvs.addDimRadius(viewName, Rcx, Rcy, outerR, 120);
        ocvs.addDimRadius(viewName, Rcx, Rcy, innerR, 0);
        ocvs.addDimRadius(viewName, Rcx, Rcy, padeyeR, 45);
        ocvs.addDimLinear(viewName, -lugW/2, 0, -lugW/2, lugH, dDimgap);
        ocvs.addDimLinear(viewName, lugW/2, 0, lugW/2, baseH, -dDimgap);
        ocvs.addDimLinear(viewName, lugW/2, baseH, lugW/2, lugH, -dDimgap);
        ocvs.addDimLinear(viewName, -lugW/2, 0, lugW/2, 0, -dDimgap);

    } else if (viewName === 'left' || viewName === 'center' || viewName === 'right') {
        // Side elevation (edge-on): lug plate + padeye plates
        ocvs.addLine(viewName, -lugT/2, lugH, lugT/2, lugH, alayer.lug);
        ocvs.addLine(viewName, -lugT/2, 0, lugT/2, 0, alayer.lug);
        ocvs.addLine(viewName, -lugT/2, 0, -lugT/2, lugH, alayer.lug);
        ocvs.addLine(viewName,  lugT/2, 0, lugT/2, lugH, alayer.lug);
        ocvs.addLine(viewName, -lugT/2, baseH, lugT/2, baseH, alayer.lug);
        // Padeye plates (annular in front, rectangles from the side)
        ocvs.addLine(viewName, -padeyeT/2, Rcy + padeyeR, -lugT/2, Rcy + padeyeR, alayer.peye);
        ocvs.addLine(viewName,  lugT/2,    Rcy + padeyeR, padeyeT/2, Rcy + padeyeR, alayer.peye);
        ocvs.addLine(viewName, -padeyeT/2, Rcy - padeyeR, -lugT/2, Rcy - padeyeR, alayer.peye);
        ocvs.addLine(viewName,  lugT/2,    Rcy - padeyeR, padeyeT/2, Rcy - padeyeR, alayer.peye);
        ocvs.addLine(viewName, -padeyeT/2, Rcy - padeyeR, -padeyeT/2, Rcy + padeyeR, alayer.peye);
        ocvs.addLine(viewName,  padeyeT/2, Rcy - padeyeR,  padeyeT/2, Rcy + padeyeR, alayer.peye);
        // Hidden hole edges
        ocvs.addLine(viewName, -padeyeT/2, Rcy + innerR, -lugT/2, Rcy + innerR, alayer.hpeye);
        ocvs.addLine(viewName, -lugT/2, Rcy + innerR, lugT/2, Rcy + innerR, alayer.hlug);
        ocvs.addLine(viewName,  lugT/2, Rcy + innerR, padeyeT/2, Rcy + innerR, alayer.hpeye);
        ocvs.addLine(viewName, -padeyeT/2, Rcy - innerR, -lugT/2, Rcy - innerR, alayer.hpeye);
        ocvs.addLine(viewName, -lugT/2, Rcy - innerR, lugT/2, Rcy - innerR, alayer.hlug);
        ocvs.addLine(viewName,  lugT/2, Rcy - innerR, padeyeT/2, Rcy - innerR, alayer.hpeye);

        ocvs.addDimLinear(viewName, -padeyeT/2, 0, -padeyeT/2, lugH, dDimgap*2);
        ocvs.addDimLinear(viewName, padeyeT/2, 0, padeyeT/2, baseH, -dDimgap*2);
        ocvs.addDimLinear(viewName, padeyeT/2, baseH, padeyeT/2, lugH, -dDimgap*2);
        ocvs.addDimLinear(viewName, -padeyeT/2, Rcy - padeyeR, -padeyeT/2, Rcy + padeyeR, dDimgap);
        ocvs.addDimLinear(viewName,  padeyeT/2, Rcy - innerR, padeyeT/2, Rcy + innerR, -dDimgap);

    } else if (viewName === 'top' || viewName === 'bottom') {
        // Plan looking down (or up) — lugW × padeyeT footprint
        ocvs.addLine(viewName, -lugW/2, -lugT/2, lugW/2, -lugT/2, alayer.lug);
        ocvs.addLine(viewName, -lugW/2,  lugT/2, lugW/2,  lugT/2, alayer.lug);
        ocvs.addLine(viewName, -lugW/2, -lugT/2, -lugW/2, lugT/2, alayer.lug);
        ocvs.addLine(viewName,  lugW/2, -lugT/2,  lugW/2, lugT/2, alayer.lug);
        // Padeye rectangles on either side of the lug plate
        ocvs.addLine(viewName, -padeyeR, -padeyeT/2,  padeyeR, -padeyeT/2, alayer.peye);
        ocvs.addLine(viewName, -padeyeR,  padeyeT/2,  padeyeR,  padeyeT/2, alayer.peye);
        ocvs.addLine(viewName, -padeyeR, -padeyeT/2, -padeyeR, -lugT/2, alayer.peye);
        ocvs.addLine(viewName, -padeyeR,  lugT/2, -padeyeR,  padeyeT/2, alayer.peye);
        ocvs.addLine(viewName,  padeyeR, -padeyeT/2,  padeyeR, -lugT/2, alayer.peye);
        ocvs.addLine(viewName,  padeyeR,  lugT/2,  padeyeR,  padeyeT/2, alayer.peye);
        // Hole projection
        ocvs.addLine(viewName, -innerR, -padeyeT/2, -innerR,  padeyeT/2, alayer.hlug);
        ocvs.addLine(viewName,  innerR, -padeyeT/2,  innerR,  padeyeT/2, alayer.hlug);

        ocvs.addDimLinear(viewName, -lugW/2, -padeyeT/2, lugW/2, -padeyeT/2, -dDimgap*2);
        ocvs.addDimLinear(viewName, -padeyeR, -padeyeT/2, padeyeR, -padeyeT/2, -dDimgap);
        ocvs.addDimLinear(viewName, -innerR,  padeyeT/2, innerR,  padeyeT/2, dDimgap);
        ocvs.addDimLinear(viewName, -lugW/2, -padeyeT/2, -lugW/2, padeyeT/2, dDimgap);
        ocvs.addDimLinear(viewName,  lugW/2, -lugT/2,  lugW/2, lugT/2, -dDimgap);
    }

    ocvs.render();
}

/* --- DXF emission (unchanged layout from v001, kept for now) --- */
function _emit_dxf_liftinglug(geo) {
    let { lugW, lugH, baseH, outerR, innerR, padeyeR, lugT, padeyeT } = geo.aparam;
    let { Rcx, Rcy, Tlx, Tly, Trx, Try, arc_angb, arc_ange } = geo;
    var dDim_ext = 20;

    var dOx = 0, dOy = 0;
    var dOx_side = lugW * 1.5, dOy_side = 0;
    var dOx_top = 0, dOy_top = lugH * 1.5;
    var dOx_bot = lugW * 1.5, dOy_bot = lugH * 1.5;

    // Front
    odxf_lug.line(dOx + Tlx, dOy + Tly, dOx - lugW/2, dOy + baseH, "lug_solid");
    odxf_lug.line(dOx - lugW/2, dOy + baseH, dOx - lugW/2, dOy, "lug_solid");
    odxf_lug.line(dOx - lugW/2, dOy, dOx + lugW/2, dOy, "lug_solid");
    odxf_lug.line(dOx + lugW/2, dOy, dOx + lugW/2, dOy + baseH, "lug_solid");
    odxf_lug.line(dOx + lugW/2, dOy + baseH, dOx + Trx, dOy + Try, "lug_solid");
    odxf_lug.arc(dOx + Rcx, dOy + Rcy, outerR, arc_angb, arc_ange, "lug_solid");
    odxf_lug.circle(dOx + Rcx, dOy + Rcy, innerR, "lug_solid");
    odxf_lug.circle(dOx + Rcx, dOy + Rcy, padeyeR, "padeye");

    // Side
    odxf_lug.line(dOx_side - lugT/2, dOy_side, dOx_side + lugT/2, dOy_side, "lug_solid");
    odxf_lug.line(dOx_side + lugT/2, dOy_side, dOx_side + lugT/2, dOy_side + lugH, "lug_solid");
    odxf_lug.line(dOx_side + lugT/2, dOy_side + lugH, dOx_side - lugT/2, dOy_side + lugH, "lug_solid");
    odxf_lug.line(dOx_side - lugT/2, dOy_side + lugH, dOx_side - lugT/2, dOy_side, "lug_solid");
    odxf_lug.line(dOx_side - lugT/2, dOy_side + baseH, dOx_side + lugT/2, dOy_side + baseH, "lug_solid");
    odxf_lug.line(dOx_side - padeyeT/2, dOy_side + Rcy - padeyeR, dOx_side - padeyeT/2, dOy_side + Rcy + padeyeR, "padeye");
    odxf_lug.line(dOx_side + padeyeT/2, dOy_side + Rcy - padeyeR, dOx_side + padeyeT/2, dOy_side + Rcy + padeyeR, "padeye");
    odxf_lug.line(dOx_side - padeyeT/2, dOy_side + Rcy + padeyeR, dOx_side - lugT/2, dOy_side + Rcy + padeyeR, "padeye");
    odxf_lug.line(dOx_side + padeyeT/2, dOy_side + Rcy + padeyeR, dOx_side + lugT/2, dOy_side + Rcy + padeyeR, "padeye");
    odxf_lug.line(dOx_side - padeyeT/2, dOy_side + Rcy - padeyeR, dOx_side - lugT/2, dOy_side + Rcy - padeyeR, "padeye");
    odxf_lug.line(dOx_side + padeyeT/2, dOy_side + Rcy - padeyeR, dOx_side + lugT/2, dOy_side + Rcy - padeyeR, "padeye");

    // Top
    odxf_lug.line(dOx_top - lugW/2, dOy_top - lugT/2, dOx_top + lugW/2, dOy_top - lugT/2, "lug_solid");
    odxf_lug.line(dOx_top + lugW/2, dOy_top - lugT/2, dOx_top + lugW/2, dOy_top + lugT/2, "lug_solid");
    odxf_lug.line(dOx_top + lugW/2, dOy_top + lugT/2, dOx_top - lugW/2, dOy_top + lugT/2, "lug_solid");
    odxf_lug.line(dOx_top - lugW/2, dOy_top + lugT/2, dOx_top - lugW/2, dOy_top - lugT/2, "lug_solid");
    odxf_lug.line(dOx_top - padeyeR, dOy_top - padeyeT/2, dOx_top + padeyeR, dOy_top - padeyeT/2, "padeye");
    odxf_lug.line(dOx_top - padeyeR, dOy_top + padeyeT/2, dOx_top + padeyeR, dOy_top + padeyeT/2, "padeye");
    odxf_lug.line(dOx_top - padeyeR, dOy_top - padeyeT/2, dOx_top - padeyeR, dOy_top - lugT/2, "padeye");
    odxf_lug.line(dOx_top - padeyeR, dOy_top + padeyeT/2, dOx_top - padeyeR, dOy_top + lugT/2, "padeye");
    odxf_lug.line(dOx_top + padeyeR, dOy_top - padeyeT/2, dOx_top + padeyeR, dOy_top - lugT/2, "padeye");
    odxf_lug.line(dOx_top + padeyeR, dOy_top + padeyeT/2, dOx_top + padeyeR, dOy_top + lugT/2, "padeye");

    // Bottom (same as top)
    odxf_lug.line(dOx_bot - lugW/2, dOy_bot - lugT/2, dOx_bot + lugW/2, dOy_bot - lugT/2, "lug_solid");
    odxf_lug.line(dOx_bot + lugW/2, dOy_bot - lugT/2, dOx_bot + lugW/2, dOy_bot + lugT/2, "lug_solid");
    odxf_lug.line(dOx_bot + lugW/2, dOy_bot + lugT/2, dOx_bot - lugW/2, dOy_bot + lugT/2, "lug_solid");
    odxf_lug.line(dOx_bot - lugW/2, dOy_bot + lugT/2, dOx_bot - lugW/2, dOy_bot - lugT/2, "lug_solid");
    odxf_lug.line(dOx_bot - padeyeR, dOy_bot - padeyeT/2, dOx_bot + padeyeR, dOy_bot - padeyeT/2, "padeye");
    odxf_lug.line(dOx_bot - padeyeR, dOy_bot + padeyeT/2, dOx_bot + padeyeR, dOy_bot + padeyeT/2, "padeye");
    odxf_lug.line(dOx_bot - padeyeR, dOy_bot - padeyeT/2, dOx_bot - padeyeR, dOy_bot - lugT/2, "padeye");
    odxf_lug.line(dOx_bot - padeyeR, dOy_bot + padeyeT/2, dOx_bot - padeyeR, dOy_bot + lugT/2, "padeye");
    odxf_lug.line(dOx_bot + padeyeR, dOy_bot - padeyeT/2, dOx_bot + padeyeR, dOy_bot - lugT/2, "padeye");
    odxf_lug.line(dOx_bot + padeyeR, dOy_bot + padeyeT/2, dOx_bot + padeyeR, dOy_bot + lugT/2, "padeye");
}
