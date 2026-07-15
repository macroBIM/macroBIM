/*
    bim_hsection_test.js — TEST build of the H-section drawing (retaining-wall style).
    Renders a SINGLE switchable view into #hsecplot; the view (3D / Front / Back / Left /
    Center / Right / Top / Bottom) is chosen from buttons placed in the card header, via
    hsec_setview(). Overrides fdraw_hsection() from bim_hsection.js and reuses its geometry,
    DXF, Konva and 3D helpers (all loaded globally on the page). Loaded on demand by
    layout_body_test.js only — production (bim_hsection.js) is unaffected.
*/
(function () {
  "use strict";

  window._hsecView = window._hsecView || 'front';

  // highlight the active view button in the header bar (light theme, matching the card header)
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

  // 3D render (loads three.js + the 3D module on demand, like the original)
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
      var s = document.createElement('script');
      s.src = urls[i];
      s.onload = function () { next(i + 1); };
      s.onerror = function () { next(i + 1); };
      document.head.appendChild(s);
    })(0);
  }

  // render the currently-selected single view, full width, into #hsecplot
  function renderView() {
    var host = document.getElementById(scvs_hsec);              // 'hsecplot'
    if (!host || typeof _hsec_drawData === 'undefined' || !_hsec_drawData) return;
    var dd = _hsec_drawData, view = window._hsecView;
    host.innerHTML = '';
    host.style.cssText = 'width:100%;height:560px;background:#000;';
    setActive(view);
    var inner = document.createElement('div');
    if (view === '3d') {
      inner.id = 'hsec3d';
      inner.style.cssText = 'width:100%;height:560px;background:#1a1a2e;';
      host.appendChild(inner);
      render3d(dd);
    } else {
      inner.id = 'hsec_2dview';
      inner.style.cssText = 'width:100%;height:560px;background:#000;';
      host.appendChild(inner);
      if (typeof fdraw_hsection_2d === 'function') fdraw_hsection_2d(view);   // reuses the base 2D logic
    }
  }

  // override the base entry point: rebuild the DXF + draw data, then render the single view
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

  // header buttons call this to switch the single view (no DXF rebuild needed)
  window.hsec_setview = function (name) { window._hsecView = name; renderView(); };
})();
