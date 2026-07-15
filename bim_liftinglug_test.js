/*
    bim_liftinglug_test.js — TEST build of the lifting-lug drawing (retaining-wall style).
    Front/Back/Left/Center/Right/Top/Bottom rendered as self-contained SVG via
    window.RWSVG (bim_draw_test_core.js). The view logic mirrors the production
    fdraw_liftinglug_2d, recorded through a MockViewer. Reuses geo_liftinglug,
    _emit_dxf_liftinglug (DXF) and render_liftinglug_3d. Overrides fdraw_liftinglug.
*/
(function () {
  "use strict";

  window._lugView = window._lugView || 'front';
  function G(n) { try { return (0, eval)(n); } catch (e) { return undefined; } }

  // layers, matching the production palette (cyan lug, green padeye, red centre)
  function layers(rec) {
    rec.addLayer('lug', 'cyan', 'solid');
    rec.addLayer('hlug', 'cyan', 'hidden');
    rec.addLayer('peye', '#00ff00', 'solid');
    rec.addLayer('hpeye', '#00ff00', 'hidden');
    rec.addLayer('cent', 'red', 'solid');
  }

  // port of fdraw_liftinglug_2d, drawing into a MockViewer (rec)
  function drawLug(viewName, rec, geo, aparam) {
    layers(rec);
    var A = { lug: 'lug', hlug: 'hlug', peye: 'peye', hpeye: 'hpeye', cent: 'cent' };
    var lugW = aparam.lugW, lugH = aparam.lugH, baseH = aparam.baseH, outerR = aparam.outerR,
        innerR = aparam.innerR, padeyeR = aparam.padeyeR, lugT = aparam.lugT, padeyeT = aparam.padeyeT;
    var Rcx = geo.Rcx, Rcy = geo.Rcy, Tlx = geo.Tlx, Tly = geo.Tly, Trx = geo.Trx, Try = geo.Try,
        arc_angb = geo.arc_angb, arc_ange = geo.arc_ange;
    var g = Math.max(15, Math.max(lugW, lugH) * 0.05);

    if (viewName === 'front' || viewName === 'back') {
      rec.addCircle(viewName, Rcx, Rcy, innerR, A.lug);
      rec.addCircle(viewName, Rcx, Rcy, padeyeR, A.peye);
      rec.addLine(viewName, Tlx, Tly, -lugW / 2, baseH, A.lug);
      rec.addLine(viewName, -lugW / 2, baseH, -lugW / 2, 0, A.lug);
      rec.addLine(viewName, -lugW / 2, 0, lugW / 2, 0, A.lug);
      rec.addLine(viewName, lugW / 2, 0, lugW / 2, baseH, A.lug);
      rec.addLine(viewName, lugW / 2, baseH, Trx, Try, A.lug);
      rec.addArc(viewName, Rcx, Rcy, outerR, arc_angb, arc_ange, A.lug);

      rec.addDimRadius(viewName, Rcx, Rcy, outerR, 120, 'R');
      rec.addDimRadius(viewName, Rcx, Rcy, innerR, 0, 'Ri');
      rec.addDimRadius(viewName, Rcx, Rcy, padeyeR, 45, 'Rp');
      rec.addDimLinear(viewName, -lugW / 2, 0, -lugW / 2, lugH, g, 'H');
      rec.addDimLinear(viewName, lugW / 2, 0, lugW / 2, baseH, -g, 'bH');
      rec.addDimLinear(viewName, lugW / 2, baseH, lugW / 2, lugH, -g);
      rec.addDimLinear(viewName, -lugW / 2, 0, lugW / 2, 0, -g, 'W');

    } else if (viewName === 'left' || viewName === 'center' || viewName === 'right') {
      rec.addLine(viewName, -lugT / 2, lugH, lugT / 2, lugH, A.lug);
      rec.addLine(viewName, -lugT / 2, 0, lugT / 2, 0, A.lug);
      rec.addLine(viewName, -lugT / 2, 0, -lugT / 2, lugH, A.lug);
      rec.addLine(viewName, lugT / 2, 0, lugT / 2, lugH, A.lug);
      rec.addLine(viewName, -lugT / 2, baseH, lugT / 2, baseH, A.lug);
      rec.addLine(viewName, -padeyeT / 2, Rcy + padeyeR, -lugT / 2, Rcy + padeyeR, A.peye);
      rec.addLine(viewName, lugT / 2, Rcy + padeyeR, padeyeT / 2, Rcy + padeyeR, A.peye);
      rec.addLine(viewName, -padeyeT / 2, Rcy - padeyeR, -lugT / 2, Rcy - padeyeR, A.peye);
      rec.addLine(viewName, lugT / 2, Rcy - padeyeR, padeyeT / 2, Rcy - padeyeR, A.peye);
      rec.addLine(viewName, -padeyeT / 2, Rcy - padeyeR, -padeyeT / 2, Rcy + padeyeR, A.peye);
      rec.addLine(viewName, padeyeT / 2, Rcy - padeyeR, padeyeT / 2, Rcy + padeyeR, A.peye);
      rec.addLine(viewName, -padeyeT / 2, Rcy + innerR, -lugT / 2, Rcy + innerR, A.hpeye);
      rec.addLine(viewName, -lugT / 2, Rcy + innerR, lugT / 2, Rcy + innerR, A.hlug);
      rec.addLine(viewName, lugT / 2, Rcy + innerR, padeyeT / 2, Rcy + innerR, A.hpeye);
      rec.addLine(viewName, -padeyeT / 2, Rcy - innerR, -lugT / 2, Rcy - innerR, A.hpeye);
      rec.addLine(viewName, -lugT / 2, Rcy - innerR, lugT / 2, Rcy - innerR, A.hlug);
      rec.addLine(viewName, lugT / 2, Rcy - innerR, padeyeT / 2, Rcy - innerR, A.hpeye);

      rec.addDimLinear(viewName, -padeyeT / 2, 0, -padeyeT / 2, lugH, g * 2, 'H');
      rec.addDimLinear(viewName, padeyeT / 2, 0, padeyeT / 2, baseH, -g * 2, 'bH');
      rec.addDimLinear(viewName, padeyeT / 2, baseH, padeyeT / 2, lugH, -g * 2);
      rec.addDimLinear(viewName, -padeyeT / 2, Rcy - padeyeR, -padeyeT / 2, Rcy + padeyeR, g);
      rec.addDimLinear(viewName, padeyeT / 2, Rcy - innerR, padeyeT / 2, Rcy + innerR, -g);

    } else if (viewName === 'top' || viewName === 'bottom') {
      rec.addLine(viewName, -lugW / 2, -lugT / 2, lugW / 2, -lugT / 2, A.lug);
      rec.addLine(viewName, -lugW / 2, lugT / 2, lugW / 2, lugT / 2, A.lug);
      rec.addLine(viewName, -lugW / 2, -lugT / 2, -lugW / 2, lugT / 2, A.lug);
      rec.addLine(viewName, lugW / 2, -lugT / 2, lugW / 2, lugT / 2, A.lug);
      rec.addLine(viewName, -padeyeR, -padeyeT / 2, padeyeR, -padeyeT / 2, A.peye);
      rec.addLine(viewName, -padeyeR, padeyeT / 2, padeyeR, padeyeT / 2, A.peye);
      rec.addLine(viewName, -padeyeR, -padeyeT / 2, -padeyeR, -lugT / 2, A.peye);
      rec.addLine(viewName, -padeyeR, lugT / 2, -padeyeR, padeyeT / 2, A.peye);
      rec.addLine(viewName, padeyeR, -padeyeT / 2, padeyeR, -lugT / 2, A.peye);
      rec.addLine(viewName, padeyeR, lugT / 2, padeyeR, padeyeT / 2, A.peye);
      rec.addLine(viewName, -innerR, -padeyeT / 2, -innerR, padeyeT / 2, A.hlug);
      rec.addLine(viewName, innerR, -padeyeT / 2, innerR, padeyeT / 2, A.hlug);

      rec.addDimLinear(viewName, -lugW / 2, -padeyeT / 2, lugW / 2, -padeyeT / 2, -g * 2, 'W');
      rec.addDimLinear(viewName, -padeyeR, -padeyeT / 2, padeyeR, -padeyeT / 2, -g);
      rec.addDimLinear(viewName, -innerR, padeyeT / 2, innerR, padeyeT / 2, g);
      rec.addDimLinear(viewName, -lugW / 2, -padeyeT / 2, -lugW / 2, padeyeT / 2, g, 'pT');
      rec.addDimLinear(viewName, lugW / 2, -lugT / 2, lugW / 2, lugT / 2, -g, 'T');
    }
  }

  function renderView() {
    var dd = window._lug_drawData;
    if (!dd) return;
    window.RWSVG.mountView({
      host: 'liftinglugplot', bar: 'lug-viewbar', view: window._lugView,
      view3dId: 'lug3d', render3dName: 'render_liftinglug_3d',
      mod3d: 'https://macrobim.github.io/macroBIM/bim_liftinglug_3d.js',
      get3dArgs: function () { return [dd.geo]; },
      drawView: function (view, rec) { drawLug(view, rec, dd.geo, dd.aparam); }
    });
  }

  window.fdraw_liftinglug = function () {
    var host = document.getElementById('liftinglugplot');
    if (!host) return;
    var u = getParams_liftinglug();
    var aparam = u.aparam;
    var ta = document.getElementById('sUserText');
    if (ta) ta.value = u.combText;
    if (Object.values(aparam).some(function (v) { return v <= 0; })) return;
    if (aparam.lugW / 2 < aparam.outerR) { aparam.lugW = aparam.outerR * 2; var e1 = document.getElementById('lugW'); if (e1) e1.value = aparam.lugW; }
    var minH = aparam.outerR + aparam.padeyeR + aparam.baseH;
    if (aparam.lugH < minH) { aparam.lugH = minH; var e2 = document.getElementById('lugH'); if (e2) e2.value = aparam.lugH; }
    var geo = geo_liftinglug(aparam);
    var odxf = G('odxf_lug');
    if (odxf) {
      odxf.init();
      odxf.layer('lug_cent', 1, 'CENTER');
      odxf.layer('lug_hidden', 4, 'HIDDEN');
      odxf.layer('lug_solid', 4, 'CONTINUOUS');
      odxf.layer('padeye', 3, 'CONTINUOUS');
      if (typeof _emit_dxf_liftinglug === 'function') { try { _emit_dxf_liftinglug(geo); } catch (e) {} }
    }
    window._lug_drawData = { geo: geo, aparam: aparam };
    renderView();
  };

  window.lug_setview = function (v) { window._lugView = v; renderView(); };
  window._lugDrawView = drawLug;   // for the headless harness
})();
