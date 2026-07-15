/*
    bim_hsection_test.js — TEST build of the H-section drawing (retaining-wall style).
    - 2D views (Front / Back / Left / Center / Right / Top / Bottom) are rendered as a
      SELF-CONTAINED SVG in the retaining-wall look (white grid, ink outline, blue dims),
      sized to match the Dimension Input card. 3D stays on three.js.
    - The view is chosen from buttons in the card header via hsec_setview().
    - Overrides fdraw_hsection() from bim_hsection.js and reuses its geometry (geo_hsection)
      + DXF (odxf_hsec) + 3D (render_hsection_3d) helpers. Loaded on demand by
      layout_body_test.js only — production bim_hsection.js is unaffected.
*/
(function () {
  "use strict";

  window._hsecView = window._hsecView || 'front';

  var INK = '#182430', DIM = '#2563eb', HID = '#94a3b8', CEN = '#e5484d';

  function setActive(view) {
    var bar = document.getElementById('hsec-viewbar');
    if (!bar) return;
    Array.prototype.forEach.call(bar.querySelectorAll('[data-hview]'), function (b) {
      var on = b.getAttribute('data-hview') === view;
      b.style.background = on ? '#2563eb' : '#eef2f6';
      b.style.color = on ? '#fff' : '#475569';
      b.style.borderColor = on ? '#2563eb' : '#cbd5e1';
    });
  }

  // ---- per-view geometry in model coords (origin = bottom-centre, y up) ----
  // returns { L:[{x1,y1,x2,y2,lay}], A:[{x,y,r,a1,a2}], DL:[{x1,y1,x2,y2,gap}], DR:[{x,y,r,ang}] }
  function buildView(view, geo, aparam, dseg_leng) {
    var L = [], A = [], DL = [], DR = [];
    function gp(n) { var f = geo.points.find(function (p) { return p.name === n; }); return f ? Object.assign({}, f[n]) : { x: 0, y: 0 }; }
    var half = dseg_leng / 2, off = 20, ext = 20;
    var S = 'solid', H = 'hidden';

    if (view === 'front' || view === 'back') {
      geo.lines.forEach(function (l) { L.push({ x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2, lay: S }); });
      geo.arcs.forEach(function (a) { A.push({ x: a.x, y: a.y, r: a.r, a1: a.angb, a2: a.ange }); });
      var ptl = gp('ptl'), ptr = gp('ptr'), pbl = gp('pbl'), pbr = gp('pbr');
      var ptfl = gp('ptfl'), pwtl = gp('pwtl'), pwbl = gp('pwbl'), pbfl = gp('pbfl'), pwtr = gp('pwtr');
      var xleft = Math.min(pbl.x, ptl.x);
      DL.push({ x1: xleft - off, y1: pbl.y, x2: xleft - off, y2: ptl.y, gap: ext * 6, t: 'H' });
      DL.push({ x1: xleft - off, y1: pbl.y, x2: xleft - off, y2: pbfl.y, gap: ext * 3, t: 'tbf' });
      DL.push({ x1: xleft - off, y1: pwbl.y, x2: xleft - off, y2: pwtl.y, gap: ext * 3, t: 'hw' });
      DL.push({ x1: xleft - off, y1: ptfl.y, x2: xleft - off, y2: ptl.y, gap: ext * 3, t: 'tft' });
      DL.push({ x1: ptl.x, y1: ptl.y + off, x2: ptr.x, y2: ptr.y + off, gap: ext * 6, t: 'Bt' });
      DL.push({ x1: pbl.x, y1: pbl.y - off, x2: pbr.x, y2: pbr.y - off, gap: ext * -6, t: 'Bb' });
      DL.push({ x1: pwtl.x, y1: (pwtl.y + pwbl.y) / 2, x2: pwtr.x, y2: (pwtl.y + pwbl.y) / 2, gap: ext * 1, t: 'tw' });
      geo.arcs.forEach(function (a) {
        DR.push({ x: a.x, y: a.y, r: a.r, ang: (a.angb + a.ange) / 2 });   // point at the arc mid-point
      });
    } else if (view === 'top' || view === 'bottom') {
      var top = view === 'top';
      var oL = top ? ['ptl', 'ptr'] : ['pbl', 'pbr'];
      var wL = top ? ['pwtl', 'pwtr'] : ['pwbl', 'pwbr'];
      var o0 = gp(oL[0]), o1 = gp(oL[1]), w0 = gp(wL[0]), w1 = gp(wL[1]);
      oL.forEach(function (n) { var p = gp(n); L.push({ x1: p.x, y1: -half, x2: p.x, y2: half, lay: S }); });
      L.push({ x1: o0.x, y1: -half, x2: o1.x, y2: -half, lay: S });
      L.push({ x1: o0.x, y1: half, x2: o1.x, y2: half, lay: S });
      wL.forEach(function (n) { var p = gp(n); L.push({ x1: p.x, y1: -half, x2: p.x, y2: half, lay: H }); });
      DL.push({ x1: o0.x - off, y1: -half, x2: o0.x - off, y2: half, gap: ext * 6, t: 'L' });
      DL.push({ x1: o0.x, y1: half + off, x2: o1.x, y2: half + off, gap: ext * 6, t: top ? 'Bt' : 'Bb' });
      DL.push({ x1: w0.x, y1: half + off, x2: w1.x, y2: half + off, gap: ext * 3, t: 'tw' });
    } else { // left / right / center
      var ptl2 = gp('ptl'), pbl2 = gp('pbl'), ptfl2 = gp('ptfl'), pwtl2 = gp('pwtl'), pwbl2 = gp('pwbl'), pbfl2 = gp('pbfl');
      ['ptl', 'ptfl', 'pwtl', 'pwbl', 'pbfl', 'pbl'].forEach(function (n) { var p = gp(n); L.push({ x1: -half, y1: p.y, x2: half, y2: p.y, lay: S }); });
      L.push({ x1: -half, y1: pbl2.y, x2: -half, y2: ptl2.y, lay: S });
      L.push({ x1: half, y1: pbl2.y, x2: half, y2: ptl2.y, lay: S });
      DL.push({ x1: -half - off, y1: pbl2.y, x2: -half - off, y2: ptl2.y, gap: ext * 6, t: 'H' });
      DL.push({ x1: -half - off, y1: pbl2.y, x2: -half - off, y2: pbfl2.y, gap: ext * 3, t: 'tbf' });
      DL.push({ x1: -half - off, y1: pwtl2.y, x2: -half - off, y2: ptfl2.y, gap: ext * 3, t: 'tft' });
      DL.push({ x1: -half, y1: ptl2.y + off, x2: half, y2: ptl2.y + off, gap: ext * 6, t: 'L' });
    }
    return { L: L, A: A, DL: DL, DR: DR };
  }

  // ---- SVG rendering (retaining-wall look) ----
  function renderSVG(vd, W, Hpx) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    function acc(x, y) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    vd.L.forEach(function (l) { acc(l.x1, l.y1); acc(l.x2, l.y2); });
    vd.A.forEach(function (a) { acc(a.x - a.r, a.y - a.r); acc(a.x + a.r, a.y + a.r); });
    vd.DL.forEach(function (d) {
      var len = Math.hypot(d.x2 - d.x1, d.y2 - d.y1) || 1, nx = -(d.y2 - d.y1) / len, ny = (d.x2 - d.x1) / len;
      acc(d.x1, d.y1); acc(d.x2, d.y2);
      acc(d.x1 + nx * d.gap, d.y1 + ny * d.gap); acc(d.x2 + nx * d.gap, d.y2 + ny * d.gap);
    });
    vd.DR.forEach(function (d) { acc(d.x, d.y); var rr = d.ang * Math.PI / 180; acc(d.x + d.r * Math.cos(rr), d.y + d.r * Math.sin(rr)); });
    if (!isFinite(minX)) { minX = 0; maxX = 1; minY = 0; maxY = 1; }

    var padL = 46, padR = 30, padT = 30, padB = 30;
    var bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY);
    var s = Math.min((W - padL - padR) / bw, (Hpx - padT - padB) / bh);
    var cW = W, cH = Hpx;
    var ox = (cW - bw * s) / 2 - minX * s;               // centre horizontally
    var oy = (cH - bh * s) / 2 + maxY * s;               // y-up → screen y-down
    function SX(x) { return ox + x * s; }
    function SY(y) { return oy - y * s; }
    function f(n) { return Math.round(n * 100) / 100; }

    var e = [];
    function line(x1, y1, x2, y2, col, w, dash) { e.push('<line x1="' + f(x1) + '" y1="' + f(y1) + '" x2="' + f(x2) + '" y2="' + f(y2) + '" stroke="' + col + '" stroke-width="' + w + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>'); }
    function poly(pts, col, w) { e.push('<polyline points="' + pts + '" fill="none" stroke="' + col + '" stroke-width="' + w + '"/>'); }
    function arrow(x, y, ux, uy, col) { var a = 7, bx = x - a * ux, by = y - a * uy, px = -uy * a * 0.34, py = ux * a * 0.34; e.push('<polygon points="' + f(x) + ',' + f(y) + ' ' + f(bx + px) + ',' + f(by + py) + ' ' + f(bx - px) + ',' + f(by - py) + '" fill="' + col + '"/>'); }
    function text(x, y, str, col, rot) { e.push('<text x="' + f(x) + '" y="' + f(y) + '" fill="' + col + '" font-size="11.5" font-family="ui-monospace,Menlo,Consolas,monospace" text-anchor="middle" dominant-baseline="middle"' + (rot ? ' transform="rotate(' + f(rot) + ' ' + f(x) + ' ' + f(y) + ')"' : '') + '>' + str + '</text>'); }
    function num(v) { return String(Math.round(v)); }

    // outline / hidden lines
    vd.L.forEach(function (l) {
      if (l.lay === 'hidden') line(SX(l.x1), SY(l.y1), SX(l.x2), SY(l.y2), HID, 1, '6 3');
      else line(SX(l.x1), SY(l.y1), SX(l.x2), SY(l.y2), INK, 1.8);
    });
    // arcs (sampled)
    vd.A.forEach(function (a) {
      var pts = [], a1 = a.a1, a2 = a.a2, n = 14;
      for (var i = 0; i <= n; i++) { var t = (a1 + (a2 - a1) * i / n) * Math.PI / 180; pts.push(f(SX(a.x + a.r * Math.cos(t))) + ',' + f(SY(a.y + a.r * Math.sin(t)))); }
      poly(pts.join(' '), INK, 1.8);
    });
    // linear dims (blue arrows + witness + value)
    vd.DL.forEach(function (d) {
      var len = Math.hypot(d.x2 - d.x1, d.y2 - d.y1); if (len === 0) return;
      var nx = -(d.y2 - d.y1) / len, ny = (d.x2 - d.x1) / len;
      var p1x = d.x1 + nx * d.gap, p1y = d.y1 + ny * d.gap, p2x = d.x2 + nx * d.gap, p2y = d.y2 + ny * d.gap;
      var s1x = SX(p1x), s1y = SY(p1y), s2x = SX(p2x), s2y = SY(p2y);
      var dl = Math.hypot(s2x - s1x, s2y - s1y) || 1, ux = (s2x - s1x) / dl, uy = (s2y - s1y) / dl;
      line(s1x, s1y, s2x, s2y, DIM, 1);
      arrow(s1x, s1y, -ux, -uy, DIM); arrow(s2x, s2y, ux, uy, DIM);
      line(SX(d.x1), SY(d.y1), s1x, s1y, DIM, 0.6, '2 2');       // witness
      line(SX(d.x2), SY(d.y2), s2x, s2y, DIM, 0.6, '2 2');
      var ang = Math.atan2(s2y - s1y, s2x - s1x) * 180 / Math.PI; if (ang > 90 || ang < -90) ang += 180;
      // text on the OUTER side (the placement side): left dim → left, right → right, top → above, bottom → below
      var sgn = d.gap >= 0 ? 1 : -1, gdx = nx * sgn, gdy = -ny * sgn, gm = Math.hypot(gdx, gdy) || 1;
      var mx = (s1x + s2x) / 2 + gdx / gm * 12, my = (s1y + s2y) / 2 + gdy / gm * 12;
      text(mx, my, (d.t ? d.t + '=' : '') + num(len), DIM, ang);
    });
    // radius dims
    vd.DR.forEach(function (d) {
      var rr = d.ang * Math.PI / 180, tx = SX(d.x), ty = SY(d.y), px = SX(d.x + d.r * Math.cos(rr)), py = SY(d.y + d.r * Math.sin(rr));
      var dl = Math.hypot(px - tx, py - ty) || 1;
      line(tx, ty, px, py, DIM, 0.9, '4 3');
      arrow(px, py, (px - tx) / dl, (py - ty) / dl, DIM);
      var ang = Math.atan2(py - ty, px - tx) * 180 / Math.PI; if (ang > 90 || ang < -90) ang += 180;
      text((tx + px) / 2, (ty + py) / 2 - 7, 'R' + num(d.r), DIM, ang);
    });

    var bg = 'background:linear-gradient(#e2e8f0 1px,transparent 1px) 0 0/26px 26px,linear-gradient(90deg,#e2e8f0 1px,transparent 1px) 0 0/26px 26px,#fff;';
    return '<svg width="' + cW + '" height="' + cH + '" viewBox="0 0 ' + cW + ' ' + cH + '" style="display:block;' + bg + '">' + e.join('') + '</svg>';
  }

  // 3D (unchanged path — loads three.js + the 3D module on demand)
  function render3d(dd) {
    function go() { if (typeof render_hsection_3d === 'function') render_hsection_3d('hsec3d', dd.geo, dd.geo, dd.dseg_leng); }
    if (typeof render_hsection_3d === 'function' && typeof THREE !== 'undefined') { go(); return; }
    var host = document.getElementById('hsec3d');
    if (host) host.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;font-size:14px;">3D Loading...</div>';
    var urls = [];
    if (typeof THREE === 'undefined') {
      urls.push('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
      urls.push('https://unpkg.com/three@0.128.0/examples/js/controls/OrbitControls.js');
    }
    if (typeof render_hsection_3d !== 'function') urls.push('https://macrobim.github.io/macroBIM/bim_hsection_3d.js');
    (function next(i) {
      if (i >= urls.length) { go(); return; }
      var sc = document.createElement('script'); sc.src = urls[i];
      sc.onload = function () { next(i + 1); }; sc.onerror = function () { next(i + 1); };
      document.head.appendChild(sc);
    })(0);
  }

  // height that makes the drawing card match the Dimension Input card
  function matchHeight() {
    var cards = document.querySelectorAll('.hs-card');
    if (cards.length > 1) {
      var rightH = cards[1].getBoundingClientRect().height;
      var lhd = cards[0].querySelector('.hs-hd');
      var t = rightH - (lhd ? lhd.getBoundingClientRect().height : 40) - 1;
      if (t > 220) return Math.round(t);
    }
    return 480;
  }

  // wheel-zoom (toward cursor) + drag-pan via the SVG viewBox
  function attachZoomPan(svg) {
    var vb = (svg.getAttribute('viewBox') || '0 0 1 1').split(/\s+/).map(Number);
    var cur = { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
    function apply() { svg.setAttribute('viewBox', cur.x + ' ' + cur.y + ' ' + cur.w + ' ' + cur.h); }
    svg.style.cursor = 'grab'; svg.style.touchAction = 'none';
    svg.addEventListener('wheel', function (e) {
      e.preventDefault();
      var r = svg.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
      var mx = cur.x + fx * cur.w, my = cur.y + fy * cur.h, k = e.deltaY < 0 ? 0.9 : 1.1;
      cur.w *= k; cur.h *= k; cur.x = mx - fx * cur.w; cur.y = my - fy * cur.h; apply();
    }, { passive: false });
    var drag = false, lx = 0, ly = 0;
    svg.addEventListener('pointerdown', function (e) { drag = true; lx = e.clientX; ly = e.clientY; svg.style.cursor = 'grabbing'; try { svg.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); });
    svg.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var r = svg.getBoundingClientRect();
      cur.x -= (e.clientX - lx) / r.width * cur.w; cur.y -= (e.clientY - ly) / r.height * cur.h;
      lx = e.clientX; ly = e.clientY; apply();
    });
    function end(e) { drag = false; svg.style.cursor = 'grab'; if (e && e.pointerId != null) { try { svg.releasePointerCapture(e.pointerId); } catch (_) {} } }
    svg.addEventListener('pointerup', end); svg.addEventListener('pointerleave', end);
  }

  function renderView() {
    var host = document.getElementById(scvs_hsec);
    if (!host || typeof _hsec_drawData === 'undefined' || !_hsec_drawData) return;
    var dd = _hsec_drawData, view = window._hsecView;
    host.innerHTML = '';
    setActive(view);
    var Hpx = matchHeight();
    host.style.cssText = 'width:100%;height:' + Hpx + 'px;';
    if (view === '3d') {
      var d3 = document.createElement('div');
      d3.id = 'hsec3d';
      d3.style.cssText = 'width:100%;height:' + Hpx + 'px;background:#1a1a2e;';
      host.appendChild(d3);
      render3d(dd);
    } else {
      var W = host.clientWidth || 600;
      host.innerHTML = renderSVG(buildView(view, dd.geo, dd.aparam, dd.dseg_leng), W, Hpx);
      var svg = host.querySelector('svg');
      if (svg) attachZoomPan(svg);
    }
  }

  // override the base entry point: rebuild the DXF + draw data, then render the current view
  window.fdraw_hsection = function () {
    var host = document.getElementById(scvs_hsec);
    if (!host) return;
    var alayer = ['hsec_solid', 'hsec_hidden', 'hsec_center'];
    odxf_hsec.init();
    odxf_hsec.layer(alayer[0], 4, "CONTINUOUS");
    odxf_hsec.layer(alayer[1], 4, "HIDDEN");
    odxf_hsec.layer(alayer[2], 1, "CENTER");

    var u = getParams_hsection();
    var aparam = u.aparam, dseg_leng = u.dseg_leng;
    var ta = document.getElementById('sUserText');
    if (ta) ta.value = u.combText + "\n" + dseg_leng;

    var geo = geo_hsection(aparam);
    var _w = Math.max(aparam.dbt, aparam.dbb);
    var _col = Math.max(_w, dseg_leng) * 1.5, _row = aparam.dsech * 2.0;

    geo.lines.forEach(function (l) { odxf_hsec.line(l.x1, l.y1, l.x2, l.y2, alayer[0]); });
    geo.arcs.forEach(function (a) { odxf_hsec.arc(a.x, a.y, a.r, a.angb, a.ange, alayer[0]); });

    function _dxf_long(ox, oy, names, hidden, axis) {
      var half = dseg_leng / 2;
      function _gp(n) { var f = geo.points.find(function (p) { return p.name === n; }); return f ? f[n] : { x: 0, y: 0 }; }
      names.forEach(function (n) {
        var p = _gp(n);
        if (axis === 'top') odxf_hsec.line(ox + p.x, oy - half, ox + p.x, oy + half, alayer[0]);
        else odxf_hsec.line(ox - half, oy + p.y, ox + half, oy + p.y, alayer[0]);
      });
      if (names.length >= 2) {
        var n1 = _gp(names[0]), n2 = _gp(names[names.length - 1]);
        if (axis === 'top') {
          odxf_hsec.line(ox + n1.x, oy - half, ox + n2.x, oy - half, alayer[0]);
          odxf_hsec.line(ox + n1.x, oy + half, ox + n2.x, oy + half, alayer[0]);
        } else {
          odxf_hsec.line(ox - half, oy + n1.y, ox - half, oy + n2.y, alayer[0]);
          odxf_hsec.line(ox + half, oy + n1.y, ox + half, oy + n2.y, alayer[0]);
        }
      }
      hidden.forEach(function (n) {
        var p = _gp(n);
        if (axis === 'top') odxf_hsec.line(ox + p.x, oy - half, ox + p.x, oy + half, alayer[1]);
        else odxf_hsec.line(ox - half, oy + p.y, ox + half, oy + p.y, alayer[1]);
      });
    }
    _dxf_long(0, _row, ['ptl', 'ptr'], ['pwtl', 'pwtr'], 'top');
    _dxf_long(_col, _row, ['pbl', 'pbr'], ['pwbl', 'pwbr'], 'top');
    _dxf_long(0, _row * 2, ['ptl', 'ptfl', 'pwtl', 'pwbl', 'pbfl', 'pbl'], [], 'side');

    _hsec_drawData = { geo: geo, aparam: aparam, dseg_leng: dseg_leng, alayer: alayer };
    renderView();
  };

  window.hsec_setview = function (name) { window._hsecView = name; renderView(); };

  // expose the pure renderers so the harness / other views can reuse them
  window._hsecBuildView = buildView;
  window._hsecRenderSVG = renderSVG;
})();
