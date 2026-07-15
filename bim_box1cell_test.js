/*
    bim_box1cell_test.js — TEST build of the single-cell box culvert drawing
    (retaining-wall style). Begin/End sections + tapered plan/side views drawn as
    self-contained SVG via window.RWSVG (bim_draw_test_core.js). View logic mirrors
    the production fdraw_box1cell_2d, recorded through a MockViewer, with variable
    labels on the main dims. Reuses geo_box1cell + odxf_box1cell + render_box1cell_3d.
    Overrides fdraw_box1cell.
*/
(function () {
  "use strict";

  window._box1cellView = window._box1cellView || 'front';
  function G(n) { try { return (0, eval)(n); } catch (e) { return undefined; } }

  function layers(rec) {
    rec.addLayer('s', 'cyan', 'solid');
    rec.addLayer('h', 'cyan', 'hidden');
    rec.addLayer('c', 'red', 'solid');
  }
  function gp(points, name) { var f = points.find(function (p) { return p.name === name; }); return f ? Object.assign({}, f[name]) : { x: 0, y: 0 }; }

  function xsecDims(rec, view, geo, off, ext) {
    var ptl = gp(geo.points, 'ptl'), ptr = gp(geo.points, 'ptr'), ptc = gp(geo.points, 'ptc'),
        pcml = gp(geo.points, 'pcml'), pcmr = gp(geo.points, 'pcmr'), pwtl = gp(geo.points, 'pwtl'), pwtr = gp(geo.points, 'pwtr'),
        pbl = gp(geo.points, 'pbl'), pbr = gp(geo.points, 'pbr'), pbc = gp(geo.points, 'pbc'),
        ptsl = gp(geo.points, 'ptsl'), pbsl = gp(geo.points, 'pbsl');
    var ymax = Math.max(ptl.y, ptr.y, ptc.y), ymin = Math.min(pbl.y, pbr.y, pbc.y);
    var xleft = Math.min(ptl.x, pbl.x);
    rec.addDimLinear(view, xleft - off, ymin, xleft - off, ymax, ext * 6, 'H');
    if (ptsl.x !== 0 || ptsl.y !== 0) rec.addDimLinear(view, xleft - off, ptsl.y, xleft - off, ymax, ext * 3, 't1');
    if (pbsl.x !== 0 || pbsl.y !== 0) rec.addDimLinear(view, xleft - off, ymin, xleft - off, pbsl.y, ext * 3, 'tb');
    rec.addDimLinear(view, ptl.x, ymax + off, ptr.x, ymax + off, ext * 6, 'Bt');
    rec.addDimLinear(view, ptl.x, ymax + off, pcml.x, ymax + off, ext * 3);
    rec.addDimLinear(view, pcml.x, ymax + off, pwtl.x, ymax + off, ext * 3);
    rec.addDimLinear(view, pwtl.x, ymax + off, pwtr.x, ymax + off, ext * 3, 'bc');
    rec.addDimLinear(view, pwtr.x, ymax + off, pcmr.x, ymax + off, ext * 3);
    rec.addDimLinear(view, pcmr.x, ymax + off, ptr.x, ymax + off, ext * 3);
    rec.addDimLinear(view, pbl.x, ymin - off, pbr.x, ymin - off, ext * -6, 'Bb');
  }

  function drawBox1cell(viewName, rec, data) {
    layers(rec);
    var gb = data.obox1cell_b, ge = data.obox1cell_e, apb = data.aparam_b, ape = data.aparam_e;
    var half = data.dseg_leng / 2;
    var ref = Math.max(apb.dh, ape.dh, apb.dbt, ape.dbt, 100);
    var off = Math.max(50, ref * 0.015), ext = off;
    var p1, p2;
    var pts_b = gb.points, pts_e = ge.points;

    if (viewName === 'front') {
      gb.lines.forEach(function (l) { rec.addLine(viewName, l.x1, l.y1, l.x2, l.y2, 's'); });
      gb.arcs.forEach(function (a) { rec.addArc(viewName, a.x, a.y, a.r, a.angb, a.ange, 's'); });
      xsecDims(rec, viewName, gb, off, ext);
    } else if (viewName === 'back') {
      ge.lines.forEach(function (l) { rec.addLine(viewName, l.x1, l.y1, l.x2, l.y2, 's'); });
      ge.arcs.forEach(function (a) { rec.addArc(viewName, a.x, a.y, a.r, a.angb, a.ange, 's'); });
      xsecDims(rec, viewName, ge, off, ext);
    } else if (viewName === 'top') {
      ['ptc', 'ptl', 'ptr'].forEach(function (n) { p1 = gp(pts_b, n); p1.y = -half; p2 = gp(pts_e, n); p2.y = half; rec.addLine(viewName, p1.x, p1.y, p2.x, p2.y, 's'); });
      p1 = gp(pts_b, 'ptl'); p1.y = -half; p2 = gp(pts_b, 'ptr'); p2.y = -half; rec.addLine(viewName, p1.x, p1.y, p2.x, p2.y, 's');
      p1 = gp(pts_e, 'ptl'); p1.y = half; p2 = gp(pts_e, 'ptr'); p2.y = half; rec.addLine(viewName, p1.x, p1.y, p2.x, p2.y, 's');
      ['pwtl', 'pwtr', 'pwtlin', 'pwtrin', 'ptsl', 'ptsr', 'pcml', 'pcmr'].forEach(function (n) { p1 = gp(pts_b, n); p1.y = -half; p2 = gp(pts_e, n); p2.y = half; rec.addLine(viewName, p1.x, p1.y, p2.x, p2.y, 'h'); });
      var ptl_b = gp(pts_b, 'ptl'), ptr_b = gp(pts_b, 'ptr'), ptl_e = gp(pts_e, 'ptl'), ptr_e = gp(pts_e, 'ptr');
      rec.addDimLinear(viewName, Math.min(ptl_b.x, ptl_e.x) - off, -half, Math.min(ptl_b.x, ptl_e.x) - off, half, ext * 6, 'L');
      rec.addDimLinear(viewName, ptl_b.x, -half - off, ptr_b.x, -half - off, ext * -6, 'Bt');
      rec.addDimLinear(viewName, ptl_e.x, half + off, ptr_e.x, half + off, ext * 6, 'Bt');
    } else if (viewName === 'bottom') {
      ['pbl', 'pbr'].forEach(function (n) { p1 = gp(pts_b, n); p1.y = -half; p2 = gp(pts_e, n); p2.y = half; rec.addLine(viewName, p1.x, p1.y, p2.x, p2.y, 's'); });
      p1 = gp(pts_b, 'pbl'); p1.y = -half; p2 = gp(pts_b, 'pbr'); p2.y = -half; rec.addLine(viewName, p1.x, p1.y, p2.x, p2.y, 's');
      p1 = gp(pts_e, 'pbl'); p1.y = half; p2 = gp(pts_e, 'pbr'); p2.y = half; rec.addLine(viewName, p1.x, p1.y, p2.x, p2.y, 's');
      ['pwblin', 'pwbrin', 'pbsl', 'pbsr'].forEach(function (n) { p1 = gp(pts_b, n); p1.y = -half; p2 = gp(pts_e, n); p2.y = half; rec.addLine(viewName, p1.x, p1.y, p2.x, p2.y, 'h'); });
      var pbl_b = gp(pts_b, 'pbl'), pbr_b = gp(pts_b, 'pbr'), pbl_e = gp(pts_e, 'pbl'), pbr_e = gp(pts_e, 'pbr');
      rec.addDimLinear(viewName, Math.min(pbl_b.x, pbl_e.x) - off, -half, Math.min(pbl_b.x, pbl_e.x) - off, half, ext * 6, 'L');
      rec.addDimLinear(viewName, pbl_b.x, -half - off, pbr_b.x, -half - off, ext * -6, 'Bb');
      rec.addDimLinear(viewName, pbl_e.x, half + off, pbr_e.x, half + off, ext * 6, 'Bb');
    } else if (viewName === 'center') {
      ['ptc', 'pbc', 'ptsc', 'pbsc'].forEach(function (n) { p1 = gp(pts_b, n); p1.x = -half; p2 = gp(pts_e, n); p2.x = half; rec.addLine(viewName, p1.x, p1.y, p2.x, p2.y, 's'); });
      p1 = gp(pts_b, 'ptc'); p1.x = -half; p2 = gp(pts_b, 'pbc'); p2.x = -half; rec.addLine(viewName, p1.x, p1.y, p2.x, p2.y, 's');
      p1 = gp(pts_e, 'ptc'); p1.x = half; p2 = gp(pts_e, 'pbc'); p2.x = half; rec.addLine(viewName, p1.x, p1.y, p2.x, p2.y, 's');
      var ptc_b = gp(pts_b, 'ptc'), pbc_b = gp(pts_b, 'pbc'), ptc_e = gp(pts_e, 'ptc'), pbc_e = gp(pts_e, 'pbc');
      rec.addDimLinear(viewName, -half, Math.max(ptc_b.y, ptc_e.y) + off, half, Math.max(ptc_b.y, ptc_e.y) + off, ext * 6, 'L');
      rec.addDimLinear(viewName, -half - off, pbc_b.y, -half - off, ptc_b.y, ext * 6, 'H');
      rec.addDimLinear(viewName, half + off, pbc_e.y, half + off, ptc_e.y, ext * -6, 'H');
    } else if (viewName === 'left') {
      p1 = gp(pts_b, 'ptc'); p1.x = -half; p2 = gp(pts_e, 'ptc'); p2.x = half; rec.addLine(viewName, p1.x, p1.y, p2.x, p2.y, 's');
      p1 = gp(pts_b, 'pbc'); p1.x = -half; p2 = gp(pts_e, 'pbc'); p2.x = half; rec.addLine(viewName, p1.x, p1.y, p2.x, p2.y, 's');
      p1 = apb.dsltl >= 0 ? gp(pts_b, 'ptc') : gp(pts_b, 'ptl');
      p2 = apb.dslb * 1 >= 0 ? gp(pts_b, 'pbl') : gp(pts_b, 'pbc');
      p1.x = -half; p2.x = -half; rec.addLine(viewName, p1.x, p1.y, p2.x, p2.y, 's');
      p1 = ape.dsltl * 1 >= 0 ? gp(pts_e, 'ptc') : gp(pts_e, 'ptl');
      p2 = ape.dslb * 1 >= 0 ? gp(pts_e, 'pbl') : gp(pts_e, 'pbc');
      p1.x = half; p2.x = half; rec.addLine(viewName, p1.x, p1.y, p2.x, p2.y, 's');
      ['ptl', 'pcl', 'pcml', 'pwtl', 'pbl'].forEach(function (n) { p1 = gp(pts_b, n); p1.x = -half; p2 = gp(pts_e, n); p2.x = half; rec.addLine(viewName, p1.x, p1.y, p2.x, p2.y, 's'); });
      ['ptsl', 'pwtlin', 'pwblin', 'pbhl', 'pbsl'].forEach(function (n) { p1 = gp(pts_b, n); p1.x = -half; p2 = gp(pts_e, n); p2.x = half; rec.addLine(viewName, p1.x, p1.y, p2.x, p2.y, 'h'); });
      var ptl_b = gp(pts_b, 'ptl'), pbl_b = gp(pts_b, 'pbl'), ptl_e = gp(pts_e, 'ptl'), pbl_e = gp(pts_e, 'pbl');
      rec.addDimLinear(viewName, -half, Math.max(ptl_b.y, ptl_e.y) + off, half, Math.max(ptl_b.y, ptl_e.y) + off, ext * 6, 'L');
      rec.addDimLinear(viewName, -half - off, pbl_b.y, -half - off, ptl_b.y, ext * 6, 'H');
      rec.addDimLinear(viewName, half + off, pbl_e.y, half + off, ptl_e.y, ext * -6, 'H');
    } else if (viewName === 'right') {
      p1 = gp(pts_b, 'ptc'); p1.x = -half; p2 = gp(pts_e, 'ptc'); p2.x = half; rec.addLine(viewName, p1.x, p1.y, p2.x, p2.y, 's');
      p1 = gp(pts_b, 'pbc'); p1.x = -half; p2 = gp(pts_e, 'pbc'); p2.x = half; rec.addLine(viewName, p1.x, p1.y, p2.x, p2.y, 's');
      p1 = apb.dsltr >= 0 ? gp(pts_b, 'ptr') : gp(pts_b, 'ptc');
      p2 = apb.dslb * 1 >= 0 ? gp(pts_b, 'pbc') : gp(pts_b, 'pbr');
      p1.x = -half; p2.x = -half; rec.addLine(viewName, p1.x, p1.y, p2.x, p2.y, 's');
      p1 = ape.dsltr * 1 >= 0 ? gp(pts_e, 'ptr') : gp(pts_e, 'ptc');
      p2 = ape.dslb * 1 >= 0 ? gp(pts_e, 'pbc') : gp(pts_e, 'pbr');
      p1.x = half; p2.x = half; rec.addLine(viewName, p1.x, p1.y, p2.x, p2.y, 's');
      ['ptr', 'pcr', 'pcmr', 'pwtr', 'pbr'].forEach(function (n) { p1 = gp(pts_b, n); p1.x = -half; p2 = gp(pts_e, n); p2.x = half; rec.addLine(viewName, p1.x, p1.y, p2.x, p2.y, 's'); });
      ['ptsr', 'pwtrin', 'pwbrin', 'pbhr', 'pbsr'].forEach(function (n) { p1 = gp(pts_b, n); p1.x = -half; p2 = gp(pts_e, n); p2.x = half; rec.addLine(viewName, p1.x, p1.y, p2.x, p2.y, 'h'); });
      var ptr_b = gp(pts_b, 'ptr'), pbr_b = gp(pts_b, 'pbr'), ptr_e = gp(pts_e, 'ptr'), pbr_e = gp(pts_e, 'pbr');
      rec.addDimLinear(viewName, -half, Math.max(ptr_b.y, ptr_e.y) + off, half, Math.max(ptr_b.y, ptr_e.y) + off, ext * 6, 'L');
      rec.addDimLinear(viewName, -half - off, pbr_b.y, -half - off, ptr_b.y, ext * 6, 'H');
      rec.addDimLinear(viewName, half + off, pbr_e.y, half + off, ptr_e.y, ext * -6, 'H');
    }
  }

  function renderView() {
    var dd = window._box1cell_drawData;
    if (!dd) return;
    window.RWSVG.mountView({
      host: 'box1cellplot', bar: 'box1cell-viewbar', view: window._box1cellView,
      view3dId: 'box1cell3d', render3dName: 'render_box1cell_3d',
      mod3d: 'https://macrobim.github.io/macroBIM/bim_box1cell_3d.js',
      get3dArgs: function () { return [dd.obox1cell_b, dd.obox1cell_e, dd.dseg_leng]; },
      drawView: function (view, rec) { drawBox1cell(view, rec, dd); }
    });
  }

  window.fdraw_box1cell = function () {
    var host = document.getElementById('box1cellplot');
    if (!host) return;
    var alayer = ['box1cell_solid', 'box1cell_hidden', 'box1cell_center'];
    var u = getParams_box1cell();
    var apb = u.aparam_b, ape = u.aparam_e, dseg = u.dseg_leng;
    var ta = document.getElementById('sUserText');
    if (ta) ta.value = u.combText_b + "\n" + u.combText_e + "\n" + dseg;
    var gb = geo_box1cell(apb), ge = geo_box1cell(ape);
    var odxf = G('odxf_box1cell');
    if (odxf) {
      odxf.init();
      odxf.layer(alayer[0], 4, 'CONTINUOUS');
      odxf.layer(alayer[1], 4, 'HIDDEN');
      odxf.layer(alayer[2], 1, 'CENTER');
      var col = Math.max(apb.dbt, ape.dbt, dseg) * 1.5;
      gb.lines.forEach(function (l) { odxf.line(l.x1, l.y1, l.x2, l.y2, alayer[0]); });
      gb.arcs.forEach(function (a) { odxf.arc(a.x, a.y, a.r, a.angb, a.ange, alayer[0]); });
      ge.lines.forEach(function (l) { odxf.line(l.x1 + col, l.y1, l.x2 + col, l.y2, alayer[0]); });
      ge.arcs.forEach(function (a) { odxf.arc(a.x + col, a.y, a.r, a.angb, a.ange, alayer[0]); });
    }
    window._box1cell_drawData = { obox1cell_b: gb, obox1cell_e: ge, aparam_b: apb, aparam_e: ape, dseg_leng: dseg, alayer: alayer };
    renderView();
  };

  window.box1cell_setview = function (v) { window._box1cellView = v; renderView(); };
  window._box1cellDrawView = drawBox1cell;   // for the headless harness
})();
