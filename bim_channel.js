/*
    Channel 작도를 위한 JS v002
    - box1cell/ibeam 패턴: 3D (left) + tabbed 2D (right)
    - Uniform single cross-section. Simplified outline (sharp corners).
*/
const odxf_channel = dxf_generator();
const scvs_channel = "channelplot";

const _CHAN_KEYS = ['dsech', 'db', 'dtw', 'dtf', 'drw', 'drf'];

function getParams_channel() {
    const getValue = (id) => {
        const el = document.getElementById(id);
        return el ? Number(el.value) : 0;
    };
    let aparam = {
        dh:  getValue('dsech'),
        db:  getValue('db'),
        dtw: getValue('dtw'),
        dtf: getValue('dtf'),
        drw: getValue('drw'),
        drf: getValue('drf'),
    };
    let dseg_leng = getValue('dseg_leng');
    let combText = [aparam.dh, aparam.db, aparam.dtw, aparam.dtf, aparam.drw, aparam.drf].join(',');
    return { aparam, dseg_leng, combText };
}

function putParams_channel(textareaId) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;
    const lines = textarea.value.split('\n');
    if (lines.length < 1) return;
    const values = (lines[0] || '').split(',');
    const dseg_leng = lines.length >= 2 ? lines[1] : '';

    ['dsech', 'db', 'dtw', 'dtf', 'drw', 'drf'].forEach((key, index) => {
        if (values[index] !== undefined) {
            const el = document.getElementById(key);
            if (el) el.value = values[index].trim();
        }
    });
    if (dseg_leng !== undefined && dseg_leng !== '') {
        const el = document.getElementById('dseg_leng');
        if (el) el.value = String(dseg_leng).trim();
    }
    if (typeof fdraw_channel === 'function') fdraw_channel();
}

/*
    geo_channel: Channel cross-section (origin = bottom-left of web outside)
    Returns { points, lines, arcs, outline }
*/
function geo_channel({ dh, db, dtw, dtf, drw, drf }) {
    let opts = [], olines = [], oarcs = [];

    // Corner points (origin: bottom-left outside web, y up, web to the left,
    // flanges extend to the right). drw = inner web/flange fillet (concave),
    // drf = outer flange-tip corner fillet (convex).
    let pbw  = { x: 0,   y: 0 };          // bottom-left web (outside)
    let pbf  = { x: db,  y: 0 };          // bottom-right of bottom flange (tip)
    let pbft = { x: db,  y: dtf };        // top of bottom flange outer edge
    let pbti = { x: dtw, y: dtf };        // inner corner bottom flange / web
    let ptti = { x: dtw, y: dh - dtf };   // inner corner top flange / web
    let ptft = { x: db,  y: dh - dtf };   // bottom of top flange outer edge
    let ptf  = { x: db,  y: dh };         // top-right of top flange (tip)
    let ptw  = { x: 0,   y: dh };         // top-left web (outside)

    [['pbw',pbw],['pbf',pbf],['pbft',pbft],['pbti',pbti],
     ['ptti',ptti],['ptft',ptft],['ptf',ptf],['ptw',ptw]
    ].forEach(([n,p]) => opts.push({[n]: p, name: n}));

    // === Outline traversal (clockwise from top-left) ===
    // Outer corners at flange tip TOP/BOTTOM are sharp (no drf there).
    // drf rounds the CONVEX corner on the flange UNDERSIDE at the tip
    // (where the flange right-side face meets the flange bottom/top face).
    // drw rounds the CONCAVE inner corners at the web-flange junctions.

    // 1) Top edge (sharp outer corner at (db, dh))
    olines.push({ x1: ptw.x, y1: ptw.y, x2: db, y2: dh });

    // 2) Right side of top flange — shortened for underside fillet
    let ye_top_right = drf > 0 ? (dh - dtf + drf) : (dh - dtf);
    olines.push({ x1: db, y1: dh, x2: db, y2: ye_top_right });

    // 3) Top flange underside fillet (convex) at corner (db, dh-dtf)
    //    Center inside the material: (db - drf, dh - dtf + drf)
    //    Arc sweeps from BOTTOM of circle (270°) to RIGHT of circle (360°),
    //    bulging toward the corner in the lower-right of the circle.
    if (drf > 0) {
        oarcs.push({ x: db - drf, y: dh - dtf + drf, r: drf, angb: 270, ange: 360 });
    }

    // 4) Top flange bottom — go LEFT toward inner web
    let xs_top_flange_bot = drf > 0 ? (db - drf) : db;
    let xe_top_flange_bot = drw > 0 ? (dtw + drw) : dtw;
    olines.push({ x1: xs_top_flange_bot, y1: dh - dtf, x2: xe_top_flange_bot, y2: dh - dtf });

    // 5) Inner concave fillet (top) at corner (dtw, dh-dtf)
    if (drw > 0) {
        oarcs.push({ x: dtw + drw, y: dh - dtf - drw, r: drw, angb: 90, ange: 180 });
    }

    // 6) Web inner (vertical)
    let ys_web = drw > 0 ? (dh - dtf - drw) : (dh - dtf);
    let ye_web = drw > 0 ? (dtf + drw)        : dtf;
    olines.push({ x1: dtw, y1: ys_web, x2: dtw, y2: ye_web });

    // 7) Inner concave fillet (bottom) at corner (dtw, dtf)
    if (drw > 0) {
        oarcs.push({ x: dtw + drw, y: dtf + drw, r: drw, angb: 180, ange: 270 });
    }

    // 8) Bottom flange top — go RIGHT toward flange tip
    let xs_bot_flange_top = drw > 0 ? (dtw + drw) : dtw;
    let xe_bot_flange_top = drf > 0 ? (db - drf)  : db;
    olines.push({ x1: xs_bot_flange_top, y1: dtf, x2: xe_bot_flange_top, y2: dtf });

    // 9) Bottom flange underside fillet (convex) at corner (db, dtf)
    //    Center: (db - drf, dtf - drf)
    //    Arc sweeps from RIGHT of circle (0°) to TOP of circle (90°),
    //    bulging toward the corner in the upper-right of the circle.
    if (drf > 0) {
        oarcs.push({ x: db - drf, y: dtf - drf, r: drf, angb: 0, ange: 90 });
    }

    // 10) Right side of bottom flange — shortened for underside fillet
    let ys_bot_right = drf > 0 ? (dtf - drf) : dtf;
    olines.push({ x1: db, y1: ys_bot_right, x2: db, y2: 0 });

    // 11) Bottom edge (sharp outer corner at (db, 0))
    olines.push({ x1: db, y1: 0, x2: pbw.x, y2: pbw.y });

    // 12) Close: web outer (vertical left edge)
    olines.push({ x1: pbw.x, y1: pbw.y, x2: ptw.x, y2: ptw.y });

    // === Outline polygon for 3D loft (sharp corners — fillets simplified) ===
    let outline = [ptw, ptf, ptft, ptti, pbti, pbft, pbf, pbw];

    return { points: opts, lines: olines, arcs: oarcs, outline: outline };
}

var _channel_drawData = null;

function fdraw_channel() {
    var alayer = ['channel_solid', 'channel_hidden', 'channel_center'];

    var _container = document.getElementById(scvs_channel);
    if (!_container) return;
    _container.innerHTML = '';
    _container.style.display = 'flex';
    _container.style.gap = '2px';
    _container.style.backgroundColor = '#000';
    _container.style.height = '560px';

    var div3d = document.createElement('div');
    div3d.id = 'channel3d';
    div3d.style.cssText = 'width:50%;height:560px;background:#1a1a2e;';
    _container.appendChild(div3d);

    var divRight = document.createElement('div');
    divRight.style.cssText = 'width:50%;height:560px;';

    var tabBar = document.createElement('div');
    tabBar.style.cssText = 'display:flex;gap:2px;padding:4px;background:#1e293b;flex-wrap:wrap;height:34px;box-sizing:border-box;';
    ['Front','Back','Left','Center','Right','Top','Bottom'].forEach(function(name, i) {
        var btn = document.createElement('button');
        btn.textContent = name;
        btn.id = 'channel_tab_' + name.toLowerCase();
        btn.style.cssText = 'padding:4px 10px;border:1px solid #475569;background:' +
            (i === 0 ? '#2563eb' : '#334155') + ';color:' +
            (i === 0 ? '#fff' : '#94a3b8') +
            ';cursor:pointer;border-radius:4px;font-size:11px;font-weight:600;';
        btn.onclick = function() { fdraw_channel_2d(name.toLowerCase()); };
        tabBar.appendChild(btn);
    });
    divRight.appendChild(tabBar);

    var viewport2d = document.createElement('div');
    viewport2d.id = 'channel_2dview';
    viewport2d.style.cssText = 'width:100%;height:526px;background:#000;';
    divRight.appendChild(viewport2d);
    _container.appendChild(divRight);

    odxf_channel.init();
    odxf_channel.layer(alayer[0], 4, "CONTINUOUS");
    odxf_channel.layer(alayer[1], 4, "HIDDEN");
    odxf_channel.layer(alayer[2], 1, "CENTER");

    let auserdata = getParams_channel();
    let aparam = auserdata.aparam;
    let dseg_leng = auserdata.dseg_leng;
    let ouserTextArea = document.getElementById('sUserText');
    if (ouserTextArea) ouserTextArea.value = auserdata.combText + "\n" + dseg_leng;

    let geo = geo_channel(aparam);

    // DXF output
    let _col = Math.max(aparam.db, dseg_leng) * 1.5;
    let _row = aparam.dh * 2.0;
    geo.lines.forEach(l => odxf_channel.line(l.x1, l.y1, l.x2, l.y2, alayer[0]));
    geo.arcs.forEach(a => odxf_channel.arc(a.x, a.y, a.r, a.angb, a.ange, alayer[0]));

    function _dxf_long(off_x, off_y, names, hidden, axis) {
        let half = dseg_leng / 2;
        function _gp(n) { var f = geo.points.find(p => p.name === n); return f ? f[n] : {x:0,y:0}; }
        names.forEach(n => {
            let p = _gp(n);
            if (axis === 'top') odxf_channel.line(off_x + p.x, off_y - half, off_x + p.x, off_y + half, alayer[0]);
            else odxf_channel.line(off_x - half, off_y + p.y, off_x + half, off_y + p.y, alayer[0]);
        });
        if (names.length >= 2) {
            let n1 = _gp(names[0]), n2 = _gp(names[names.length-1]);
            if (axis === 'top') {
                odxf_channel.line(off_x + n1.x, off_y - half, off_x + n2.x, off_y - half, alayer[0]);
                odxf_channel.line(off_x + n1.x, off_y + half, off_x + n2.x, off_y + half, alayer[0]);
            } else {
                odxf_channel.line(off_x - half, off_y + n1.y, off_x - half, off_y + n2.y, alayer[0]);
                odxf_channel.line(off_x + half, off_y + n1.y, off_x + half, off_y + n2.y, alayer[0]);
            }
        }
        hidden.forEach(n => {
            let p = _gp(n);
            if (axis === 'top') odxf_channel.line(off_x + p.x, off_y - half, off_x + p.x, off_y + half, alayer[1]);
            else odxf_channel.line(off_x - half, off_y + p.y, off_x + half, off_y + p.y, alayer[1]);
        });
    }
    _dxf_long(0,    _row,    ['ptw','ptf'], ['pbti','ptti'], 'top');
    _dxf_long(_col, _row,    ['pbw','pbf'], [], 'top');
    _dxf_long(0,    _row*2,  ['ptw','ptf','ptft','pbft','pbf','pbw'], [], 'side');

    _channel_drawData = { geo, aparam, dseg_leng, alayer };

    function _render3d() {
        if (typeof render_channel_3d === 'function' && typeof THREE !== 'undefined') {
            render_channel_3d('channel3d', geo, geo, dseg_leng);
            return;
        }
        var msg = document.getElementById('channel3d');
        if (msg) msg.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;font-size:14px;">3D Loading...</div>';
        var urls = [];
        if (typeof THREE === 'undefined') {
            urls.push('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
            urls.push('https://unpkg.com/three@0.128.0/examples/js/controls/OrbitControls.js');
        }
        if (typeof render_channel_3d !== 'function') {
            urls.push('https://macrobim.github.io/macroBIM/bim_channel_3d.js');
        }
        (function loadNext(i) {
            if (i >= urls.length) {
                if (typeof render_channel_3d === 'function') render_channel_3d('channel3d', geo, geo, dseg_leng);
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

    fdraw_channel_2d('front');
}

function fdraw_channel_2d(viewName) {
    if (!_channel_drawData) return;
    var data = _channel_drawData;
    var geo = data.geo;
    var aparam = data.aparam;
    var dseg_leng = data.dseg_leng;
    var alayer = data.alayer;

    ['front','back','left','center','right','top','bottom'].forEach(function(name) {
        var btn = document.getElementById('channel_tab_' + name);
        if (!btn) return;
        if (name === viewName) {
            btn.style.background = '#2563eb'; btn.style.color = '#fff'; btn.style.borderColor = '#2563eb';
        } else {
            btn.style.background = '#334155'; btn.style.color = '#94a3b8'; btn.style.borderColor = '#475569';
        }
    });

    var ocvs = new KonvaViewer('channel_2dview', {
        gridCols: 1, layout: [{ views: [viewName], span: 1 }]
    });
    ocvs.addLayer(alayer[0], 'cyan', 'solid', 1.5);
    ocvs.addLayer(alayer[1], 'cyan', 'hidden', 1.5);
    ocvs.addLayer(alayer[2], 'red', 'solid', 1.5);

    function gp(name) { var f = geo.points.find(p => p.name === name); return f ? Object.assign({}, f[name]) : {x:0,y:0}; }
    var half = dseg_leng / 2;
    var ddim_off = 20, ddim_ext = 20;

    if (viewName === 'front' || viewName === 'back') {
        geo.lines.forEach(l => ocvs.addLine(viewName, l.x1, l.y1, l.x2, l.y2, alayer[0]));
        geo.arcs.forEach(a => ocvs.addArc(viewName, a.x, a.y, a.r, a.angb, a.ange, alayer[0]));

        var pbw = gp('pbw'), ptw = gp('ptw'), pbf = gp('pbf'), ptf = gp('ptf');
        var pbti = gp('pbti'), pbft = gp('pbft');
        // Total height (left)
        ocvs.addDimLinear(viewName, pbw.x - ddim_off, pbw.y, pbw.x - ddim_off, ptw.y, ddim_ext * 6);
        // tf (bottom flange thickness)
        ocvs.addDimLinear(viewName, pbw.x - ddim_off, pbw.y, pbw.x - ddim_off, pbft.y, ddim_ext * 3);
        // tf (top flange thickness)
        ocvs.addDimLinear(viewName, pbw.x - ddim_off, gp('ptft').y, pbw.x - ddim_off, ptw.y, ddim_ext * 3);
        // db (total width on top)
        ocvs.addDimLinear(viewName, ptw.x, ptw.y + ddim_off, ptf.x, ptf.y + ddim_off, ddim_ext * 6);
        // tw (web thickness)
        ocvs.addDimLinear(viewName, ptw.x, ptw.y + ddim_off, pbti.x, ptw.y + ddim_off, ddim_ext * 3);

    } else if (viewName === 'top') {
        var ptw = gp('ptw'), ptf = gp('ptf'), pbti = gp('pbti');
        ['ptw','ptf'].forEach(n => {
            var p = gp(n);
            ocvs.addLine(viewName, p.x, -half, p.x, half, alayer[0]);
        });
        ocvs.addLine(viewName, ptw.x, -half, ptf.x, -half, alayer[0]);
        ocvs.addLine(viewName, ptw.x,  half, ptf.x,  half, alayer[0]);
        // hidden: web inner edge
        ocvs.addLine(viewName, pbti.x, -half, pbti.x, half, alayer[1]);
        ocvs.addDimLinear(viewName, ptw.x - ddim_off, -half, ptw.x - ddim_off, half, ddim_ext * 6);
        ocvs.addDimLinear(viewName, ptw.x, half + ddim_off, ptf.x, half + ddim_off, ddim_ext * 6);

    } else if (viewName === 'bottom') {
        var pbw = gp('pbw'), pbf = gp('pbf'), pbti = gp('pbti');
        ['pbw','pbf'].forEach(n => {
            var p = gp(n);
            ocvs.addLine(viewName, p.x, -half, p.x, half, alayer[0]);
        });
        ocvs.addLine(viewName, pbw.x, -half, pbf.x, -half, alayer[0]);
        ocvs.addLine(viewName, pbw.x,  half, pbf.x,  half, alayer[0]);
        ocvs.addLine(viewName, pbti.x, -half, pbti.x, half, alayer[1]);
        ocvs.addDimLinear(viewName, pbw.x - ddim_off, -half, pbw.x - ddim_off, half, ddim_ext * 6);
        ocvs.addDimLinear(viewName, pbw.x, half + ddim_off, pbf.x, half + ddim_off, ddim_ext * 6);

    } else if (viewName === 'left' || viewName === 'right' || viewName === 'center') {
        var ptw = gp('ptw'), pbw = gp('pbw');
        ['ptw','ptft','pbft','pbw'].forEach(n => {
            var p = gp(n);
            ocvs.addLine(viewName, -half, p.y, half, p.y, alayer[0]);
        });
        ocvs.addLine(viewName, -half, pbw.y, -half, ptw.y, alayer[0]);
        ocvs.addLine(viewName,  half, pbw.y,  half, ptw.y, alayer[0]);
        ocvs.addDimLinear(viewName, -half - ddim_off, pbw.y, -half - ddim_off, ptw.y, ddim_ext * 6);
        ocvs.addDimLinear(viewName, -half, ptw.y + ddim_off, half, ptw.y + ddim_off, ddim_ext * 6);
    }

    ocvs.render();
}
