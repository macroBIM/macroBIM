/*
    bim_ibeam_test.js — TEST build of the I-beam (plate girder) drawing
    (retaining-wall style). Begin/End cross-sections drawn as self-contained SVG
    via window.RWSVG (bim_draw_test_core.js). View logic mirrors the production
    fdraw_ibeam_2d, recorded through a MockViewer, with variable labels on the
    main dims. Reuses geo_ibeam + odxf_ibeam + render_ibeam_3d. Overrides fdraw_ibeam.
    mm | in toggle (2026-10-25): inputs, dimension labels and DXF ($INSUNITS) share one unit.
*/
(function () {
  "use strict";

  window._ibeamView = window._ibeamView || 'front';
  window._ibeamUnit = window._ibeamUnit || 'mm';   // 'mm' | 'in' — 입력·치수·DXF 가 같은 단위
  var MM_PER_IN = 25.4;
  var _KEYS = ['dh', 'dbt', 'dbb', 'dttf', 'dttf1', 'dtbf', 'dtbf1', 'dtw', 'drtf', 'drwt', 'drwb', 'drbf', 'dchb'];
  function unitK() { return window._ibeamUnit === 'in' ? 1 / MM_PER_IN : 1; }

  // mm | in 토글 — 페이지 틀(layout_body.js)은 그대로 두고 여기서 붙인다.
  // 바꾸면 입력값을 환산해 같은 형상을 다른 단위로 다시 그린다.
  function ensureUnitBar() {
    var mount = document.getElementById('mount-draw-ibeam');
    if (!mount || mount.querySelector('#ibeam-unitbar')) return;
    var dxfBtn = Array.prototype.find.call(mount.querySelectorAll('.hs-btn'), function (b) { return /DXF/i.test(b.textContent); });
    if (!dxfBtn || !dxfBtn.parentNode) return;
    var bar = document.createElement('span');
    bar.id = 'ibeam-unitbar';
    bar.style.cssText = 'display:inline-flex;gap:0;margin-right:4px;';
    ['mm', 'in'].forEach(function (u, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'hs-vbtn'; b.textContent = u; b.setAttribute('data-unit', u);
      b.style.borderRadius = i === 0 ? '6px 0 0 6px' : '0 6px 6px 0';
      b.onclick = function () { window.ibeam_setunit(u); };
      bar.appendChild(b);
    });
    dxfBtn.parentNode.insertBefore(bar, dxfBtn.parentNode.firstChild);
  }
  function paintUnitBar() {
    var mount = document.getElementById('mount-draw-ibeam');
    if (!mount) return;
    mount.querySelectorAll('#ibeam-unitbar button').forEach(function (b) {
      var on = b.getAttribute('data-unit') === window._ibeamUnit;
      b.style.background = on ? '#2563eb' : ''; b.style.color = on ? '#fff' : ''; b.style.borderColor = on ? '#2563eb' : '';
    });
    mount.querySelectorAll('.hs-unit').forEach(function (el) { el.textContent = window._ibeamUnit; });
  }
  function roundU(v, u) { return u === 'in' ? Math.round(v * 1000) / 1000 : Math.round(v * 10) / 10; }
  function G(n) { try { return (0, eval)(n); } catch (e) { return undefined; } }

  function layers(rec) {
    rec.addLayer('s', 'cyan', 'solid');
    rec.addLayer('h', 'cyan', 'hidden');
    rec.addLayer('c', 'red', 'solid');
  }
  function gp(points, name) { var f = points.find(function (p) { return p.name === name; }); return f ? Object.assign({}, f[name]) : { x: 0, y: 0 }; }

  // cross-section dimension chain for one section (Begin or End)
  function xsecDims(rec, view, geo, ap, off, ext) {
    var ptl = gp(geo.points, 'ptl'), ptfl = gp(geo.points, 'ptfl'), pwtl = gp(geo.points, 'pwtl'),
        pwbl = gp(geo.points, 'pwbl'), pbfl = gp(geo.points, 'pbfl'), pbl = gp(geo.points, 'pbl'),
        ptr = gp(geo.points, 'ptr'), pwtr = gp(geo.points, 'pwtr'), pwbr = gp(geo.points, 'pwbr'), pbr = gp(geo.points, 'pbr');
    var xleft = Math.min(pbl.x, ptl.x);
    // vertical chain (left)
    rec.addDimLinear(view, xleft - off, pbl.y, xleft - off, ptl.y, ext * 6, 'H');
    rec.addDimLinear(view, xleft - off, pbl.y, xleft - off, pbfl.y, ext * 3, 'tbf');
    rec.addDimLinear(view, xleft - off, pbfl.y, xleft - off, pwbl.y, ext * 3, 'tbf1');
    rec.addDimLinear(view, xleft - off, pwbl.y, xleft - off, pwtl.y, ext * 3, 'hw');
    rec.addDimLinear(view, xleft - off, pwtl.y, xleft - off, ptfl.y, ext * 3, 'ttf1');
    rec.addDimLinear(view, xleft - off, ptfl.y, xleft - off, ptl.y, ext * 3, 'ttf');
    // horizontal chain (top)
    rec.addDimLinear(view, ptl.x, ptl.y + off, ptr.x, ptr.y + off, ext * 6, 'Bt');
    rec.addDimLinear(view, ptl.x, ptl.y + off, pwtl.x, ptl.y + off, ext * 3);
    rec.addDimLinear(view, pwtl.x, ptl.y + off, pwtr.x, ptr.y + off, ext * 3, 'tw');
    rec.addDimLinear(view, pwtr.x, ptl.y + off, ptr.x, ptr.y + off, ext * 3);
    // horizontal chain (bottom)
    rec.addDimLinear(view, pbl.x, pbl.y - off, pbr.x, pbr.y - off, ext * -6, 'Bb');
    rec.addDimLinear(view, pbl.x, pbl.y - off, pwbl.x, pbl.y - off, ext * -3);
    rec.addDimLinear(view, pwbl.x, pbl.y - off, pwbr.x, pbr.y - off, ext * -3, 'tw');
    rec.addDimLinear(view, pwbr.x, pbl.y - off, pbr.x, pbr.y - off, ext * -3);
    // fillet radii (right side, at arc mid-point)
    geo.arcs.forEach(function (a) {
      if (a.x > 0) rec.addDimRadius(view, a.x, a.y, a.r, (a.angb + a.ange) / 2, 'R');
    });
    // chamfer height
    if (ap.dchb > 0) rec.addDimLinear(view, pbr.x + off, pbr.y + ap.dchb, pbr.x + off, pbr.y, ext * -3, 'chb');
  }

  function drawIbeam(viewName, rec, data) {
    layers(rec);
    var gb = data.oibeam_b, ge = data.oibeam_e, apb = data.aparam_b, ape = data.aparam_e;
    var k = data.k || 1;   // 치수 간격도 단위를 따른다 (20 mm ≈ 0.79 in)
    var half = data.dseg_leng / 2, off = 20 * k, ext = 20 * k;

    if (viewName === 'front') {
      gb.lines.forEach(function (l) { rec.addLine(viewName, l.x1, l.y1, l.x2, l.y2, 's'); });
      gb.arcs.forEach(function (a) { rec.addArc(viewName, a.x, a.y, a.r, a.angb, a.ange, 's'); });
      xsecDims(rec, viewName, gb, apb, off, ext);
    } else if (viewName === 'back') {
      ge.lines.forEach(function (l) { rec.addLine(viewName, l.x1, l.y1, l.x2, l.y2, 's'); });
      ge.arcs.forEach(function (a) { rec.addArc(viewName, a.x, a.y, a.r, a.angb, a.ange, 's'); });
      xsecDims(rec, viewName, ge, ape, off, ext);
    } else if (viewName === 'top' || viewName === 'bottom') {
      var top = viewName === 'top';
      var oN = top ? ['ptl', 'ptr'] : ['pbl', 'pbr'];
      var wN = top ? ['pwtl', 'pwtr'] : ['pwbl', 'pwbr'];
      oN.forEach(function (n) { var p1 = gp(gb.points, n), p2 = gp(ge.points, n); rec.addLine(viewName, p1.x, -half, p2.x, half, 's'); });
      var b0 = gp(gb.points, oN[0]), b1 = gp(gb.points, oN[1]);
      var e0 = gp(ge.points, oN[0]), e1 = gp(ge.points, oN[1]);
      rec.addLine(viewName, b0.x, -half, b1.x, -half, 's');
      rec.addLine(viewName, e0.x, half, e1.x, half, 's');
      wN.forEach(function (n) { var p1 = gp(gb.points, n), p2 = gp(ge.points, n); rec.addLine(viewName, p1.x, -half, p2.x, half, 'h'); });
      var w0b = gp(gb.points, wN[0]), w1b = gp(gb.points, wN[1]);
      // dims
      rec.addDimLinear(viewName, b0.x - off, -half, b0.x - off, half, ext * 6, 'L');
      rec.addDimLinear(viewName, b0.x, -half - off, b1.x, -half - off, ext * -6, top ? 'Bt' : 'Bb');
      rec.addDimLinear(viewName, w0b.x, -half - off, w1b.x, -half - off, ext * -3, 'tw');
      rec.addDimLinear(viewName, e0.x, half + off, e1.x, half + off, ext * 6, top ? 'Bt' : 'Bb');
    } else { // left / right / center
      ['ptl', 'ptfl', 'pwtl', 'pwbl', 'pbfl', 'pbl'].forEach(function (n) {
        var p1 = gp(gb.points, n), p2 = gp(ge.points, n);
        rec.addLine(viewName, -half, p1.y, half, p2.y, 's');
      });
      var tb = gp(gb.points, 'ptl'), bb = gp(gb.points, 'pbl');
      var te = gp(ge.points, 'ptl'), be = gp(ge.points, 'pbl');
      rec.addLine(viewName, -half, bb.y, -half, tb.y, 's');
      rec.addLine(viewName, half, be.y, half, te.y, 's');
      var ptfl_b = gp(gb.points, 'ptfl'), pwtl_b = gp(gb.points, 'pwtl'), pwbl_b = gp(gb.points, 'pwbl'), pbfl_b = gp(gb.points, 'pbfl');
      rec.addDimLinear(viewName, -half - off, bb.y, -half - off, tb.y, ext * 6, 'H');
      rec.addDimLinear(viewName, -half - off, bb.y, -half - off, pbfl_b.y, ext * 3, 'tbf');
      rec.addDimLinear(viewName, -half - off, pbfl_b.y, -half - off, pwbl_b.y, ext * 3, 'tbf1');
      rec.addDimLinear(viewName, -half - off, pwbl_b.y, -half - off, pwtl_b.y, ext * 3, 'hw');
      rec.addDimLinear(viewName, -half - off, pwtl_b.y, -half - off, ptfl_b.y, ext * 3, 'ttf1');
      rec.addDimLinear(viewName, -half - off, ptfl_b.y, -half - off, tb.y, ext * 3, 'ttf');
      rec.addDimLinear(viewName, -half, tb.y + off, half, te.y + off, ext * 6, 'L');
      rec.addDimLinear(viewName, half + off, be.y, half + off, te.y, ext * -6, 'H');
    }
  }

  function renderView() {
    var dd = window._ibeam_drawData;
    if (!dd) return;
    window.RWSVG.mountView({
      host: 'ibeamplot', bar: 'ibeam-viewbar', view: window._ibeamView,
      view3dId: 'ibeam3d', render3dName: 'render_ibeam_3d',
      mod3d: 'https://macrobim.github.io/macroBIM/bim_ibeam_3d.js',
      get3dArgs: function () { return [dd.oibeam_b, dd.oibeam_e, dd.dseg_leng]; },
      drawView: function (view, rec) { rec.dec = dd.unit === 'in' ? 2 : 0; drawIbeam(view, rec, dd); }
    });
  }

  window.fdraw_ibeam = function () {
    var host = document.getElementById('ibeamplot');
    if (!host) return;
    ensureUnitBar(); paintUnitBar();
    var alayer = ['ibeam_solid', 'ibeam_hidden', 'ibeam_center'];
    var u = getParams_ibeam();
    var apb = u.aparam_b, ape = u.aparam_e, dseg = u.dseg_leng;
    var ta = document.getElementById('sUserText');
    if (ta) ta.value = u.combText_b + "\n" + u.combText_e + "\n" + dseg;
    var gb = geo_ibeam(apb), ge = geo_ibeam(ape);
    var odxf = G('odxf_ibeam');
    if (odxf) {
      odxf.init();
      if (odxf.units) odxf.units(window._ibeamUnit);
      odxf.layer(alayer[0], 4, 'CONTINUOUS');
      odxf.layer(alayer[1], 4, 'HIDDEN');
      odxf.layer(alayer[2], 1, 'CENTER');
      var col = Math.max(apb.dbt, ape.dbt, dseg) * 1.5;
      gb.lines.forEach(function (l) { odxf.line(l.x1, l.y1, l.x2, l.y2, alayer[0]); });
      gb.arcs.forEach(function (a) { odxf.arc(a.x, a.y, a.r, a.angb, a.ange, alayer[0]); });
      ge.lines.forEach(function (l) { odxf.line(l.x1 + col, l.y1, l.x2 + col, l.y2, alayer[0]); });
      ge.arcs.forEach(function (a) { odxf.arc(a.x + col, a.y, a.r, a.angb, a.ange, alayer[0]); });
    }
    window._ibeam_drawData = { oibeam_b: gb, oibeam_e: ge, aparam_b: apb, aparam_e: ape, dseg_leng: dseg, alayer: alayer, unit: window._ibeamUnit, k: unitK() };
    renderView();
  };

  window.ibeam_setview = function (v) { window._ibeamView = v; renderView(); };

  // 단위 바꾸기 : 값을 환산해 같은 형상으로 다시 그린다
  window.ibeam_setunit = function (u) {
    if (u !== 'mm' && u !== 'in') return;
    var from = window._ibeamUnit;
    if (u !== from) {
      var f = u === 'in' ? 1 / MM_PER_IN : MM_PER_IN;
      var ids = [];
      _KEYS.forEach(function (key) { ids.push(key + '_s', key + '_e'); });
      ids.push('dseg_leng');
      ids.forEach(function (id) {
        var el = document.getElementById(id);
        if (el && el.value !== '') el.value = roundU(Number(el.value) * f, u);
      });
      window._ibeamUnit = u;
    }
    window.fdraw_ibeam();
  };

  // 한 번에 채우기 : 블로그·링크에서 표준 단면을 열 때 쓴다.
  //   ibeam_load('in', [h,bt,bb,ttf,ttf1,tbf,tbf1,tw,rtf,rwt,rwb,rbf,chb], L)
  window.ibeam_load = function (u, vals, L) {
    window._ibeamUnit = (u === 'in') ? 'in' : 'mm';
    _KEYS.forEach(function (key, i) {
      if (vals[i] == null) return;
      ['_s', '_e'].forEach(function (sfx) { var el = document.getElementById(key + sfx); if (el) el.value = vals[i]; });
    });
    var el = document.getElementById('dseg_leng'); if (el && L != null) el.value = L;
    window.fdraw_ibeam();
  };
  window._ibeamDrawView = drawIbeam;   // for the headless harness
})();
