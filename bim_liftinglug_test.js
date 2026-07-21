/*
    bim_liftinglug_test.js — TEST build of the lifting-lug drawing (retaining-wall style).

    Front/Back/Left/Center/Right/Top/Bottom rendered as self-contained SVG via
    window.RWSVG (bim_draw_test_core.js).

    This TEST build EXTENDS the production lug with four extra design cases (all
    driven from layout_body_test.js only — the production bim_liftinglug.js and
    layout_body.js are untouched):

      1. Eccentricity (ecc / "off")  — the pad-eye/hole centre is offset
         horizontally from the lug-base centreline, so the plate outline
         becomes an asymmetric (skewed) trapezoid.  Geometry generalised via
         tangent-from-point so ecc = 0 reduces to the symmetric production shape.
      2. Lower-body extension (bodyExt) — the straight body below the shoulders
         is lengthened (a long lug), matching the "L3 / tangent-line" case.
      3. Base plate (bpOn) — a plate under the lug that welds to the shell.
         Its in-plane length can be drawn to a finite size (bpW / bpL) or shown
         as effectively infinite with a zig-zag break line (bpMode).
      4. Welds — three joints (pad→lug, lug→base, base→shell), each annotated
         with an AWS-style weld symbol whose type (fillet / PJP / CJP) and size
         are chosen per joint.

    Self-contained: this module reads its OWN params (readLugTestParams) and
    computes its OWN geometry (geoLugTest) so nothing in the production module
    has to change.  It still reuses render_liftinglug_3d and _emit_dxf_liftinglug
    (they only read the eight base fields, which geoLugTest also provides).
    Overrides window.fdraw_liftinglug / window.putParams_lug_test.
*/
(function () {
  "use strict";

  window._lugView = window._lugView || 'front';
  function G(n) { try { return (0, eval)(n); } catch (e) { return undefined; } }

  // numeric input ids, in batch-CSV order
  var NUMKEYS = ['lugW', 'lugH', 'baseH', 'outerR', 'innerR', 'padeyeR', 'lugT', 'padeyeT',
                 'ecc', 'bodyExt', 'bpW', 'bpT', 'bpL', 'weldLugSize', 'weldPadSize', 'weldBaseSize'];

  // ── params ────────────────────────────────────────────────────────────────
  function readLugTestParams() {
    function num(id) { var e = document.getElementById(id); return e ? Number(e.value) : 0; }
    function sel(id, def) { var e = document.getElementById(id); return (e && e.value) ? e.value : def; }
    var aparam = {};
    NUMKEYS.forEach(function (k) { aparam[k] = num(k); });
    var weld = {
      pad:  { type: sel('weldPadType',  'fillet'), size: aparam.weldPadSize },
      lug:  { type: sel('weldLugType',  'fillet'), size: aparam.weldLugSize },
      base: { type: sel('weldBaseType', 'fillet'), size: aparam.weldBaseSize }
    };
    var opt = { bpOn: sel('bpOn', 'none'), bpMode: sel('bpMode', 'infinite') };
    return { aparam: aparam, weld: weld, opt: opt, combText: NUMKEYS.map(function (k) { return aparam[k]; }).join(',') };
  }

  // CSV textarea → numeric inputs → redraw (test replacement for putParams_liftinglug)
  window.putParams_lug_test = function (taId) {
    var ta = document.getElementById(taId);
    if (!ta) return;
    var vals = (ta.value.split('\n')[0] || '').split(',');
    NUMKEYS.forEach(function (k, i) {
      if (vals[i] !== undefined) { var el = document.getElementById(k); if (el) el.value = vals[i].trim(); }
    });
    if (typeof window.fdraw_liftinglug === 'function') window.fdraw_liftinglug();
  };

  // ── geometry ────────────────────────────────────────────────────────────────
  // tangent point from external point P to circle (C,R); branch = +1 / -1.
  function tangentPt(Px, Py, Cx, Cy, R, branch) {
    var dx = Px - Cx, dy = Py - Cy, d2 = dx * dx + dy * dy, R2 = R * R;
    var a = R2 / d2, q = R * Math.sqrt(Math.max(d2 - R2, 0)) / d2;
    return { x: Cx + a * dx + branch * q * (-dy), y: Cy + a * dy + branch * q * (dx) };
  }

  // geoLugTest — eccentric-capable outline; provides all production geo fields
  // (Rcx, Rcy, Tlx/Tly, Trx/Try, arc_angb, arc_ange, aparam) plus sideH.
  function geoLugTest(aparam) {
    var lugW = aparam.lugW, lugH = aparam.lugH, baseH = aparam.baseH, outerR = aparam.outerR,
        ecc = aparam.ecc || 0, bodyExt = aparam.bodyExt || 0;
    var sideH = baseH + bodyExt;                 // straight-side height (lower body)
    var Rcx = ecc, Rcy = lugH - outerR;          // arc / hole / pad-eye centre

    var PL = { x: -lugW / 2, y: sideH }, PR = { x: lugW / 2, y: sideH };
    // pick the outer branch for each shoulder (min-x on the left, max-x on the right)
    var lA = tangentPt(PL.x, PL.y, Rcx, Rcy, outerR, +1), lB = tangentPt(PL.x, PL.y, Rcx, Rcy, outerR, -1);
    var Tl = (lA.x <= lB.x) ? lA : lB;
    var rA = tangentPt(PR.x, PR.y, Rcx, Rcy, outerR, +1), rB = tangentPt(PR.x, PR.y, Rcx, Rcy, outerR, -1);
    var Tr = (rA.x >= rB.x) ? rA : rB;

    var angR = Math.atan2(Tr.y - Rcy, Tr.x - Rcx) * 180 / Math.PI;   // right shoulder
    var angL = Math.atan2(Tl.y - Rcy, Tl.x - Rcx) * 180 / Math.PI;   // left shoulder
    // addArc draws a1→a2 CCW over the top: start at right (small), end at left (large)
    var arc_angb = angR, arc_ange = angL; if (arc_ange <= arc_angb) arc_ange += 360;

    return {
      Rcx: Rcx, Rcy: Rcy, Tlx: Tl.x, Tly: Tl.y, Trx: Tr.x, Try: Tr.y,
      arc_angb: arc_angb, arc_ange: arc_ange, sideH: sideH, aparam: aparam
    };
  }

  // ── layers ────────────────────────────────────────────────────────────────
  function layers(rec) {
    rec.addLayer('lug', 'cyan', 'solid');
    rec.addLayer('hlug', 'cyan', 'hidden');
    rec.addLayer('peye', '#00ff00', 'solid');
    rec.addLayer('hpeye', '#00ff00', 'hidden');
    rec.addLayer('cent', 'red', 'solid');
    rec.addLayer('base', '#f59e0b', 'solid');   // base plate (amber)
    rec.addLayer('weld', '#dc2626', 'solid');   // weld symbols (red-orange)
  }

  // ── drawing helpers ─────────────────────────────────────────────────────────
  // zig-zag break line from (x1,y1)→(x2,y2) with `kinks` alternating offsets.
  function zigzag(rec, v, x1, y1, x2, y2, kinks, amp, layer) {
    var dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, px = -dy / len, py = dx / len;
    var pts = [[x1, y1]];
    for (var i = 1; i <= kinks; i++) {
      var t = i / (kinks + 1), bx = x1 + dx * t, by = y1 + dy * t, sgn = (i % 2 === 0) ? 1 : -1;
      pts.push([bx + px * amp * sgn, by + py * amp * sgn]);
    }
    pts.push([x2, y2]);
    for (var j = 0; j < pts.length - 1; j++) rec.addLine(v, pts[j][0], pts[j][1], pts[j + 1][0], pts[j + 1][1], layer);
  }

  // AWS-style weld symbol. Joint at (jx,jy); leader elbow at (ex,ey); reference
  // line runs horizontally toward `refDir` (+1 right / -1 left). `type` is
  // 'fillet' | 'pjp' | 'cjp'; `size` in model units. Symbol + label sit on the
  // arrow side (below the reference line).
  function weldSymbol(rec, v, jx, jy, ex, ey, refDir, type, size, g, layer) {
    if (!type || type === 'none') return;
    var refLen = g * 2.6, leg = g * 0.9;
    var rx0 = ex, rx1 = ex + refDir * refLen;
    // leader + reference line
    rec.addLine(v, jx, jy, ex, ey, layer);
    rec.addLine(v, rx0, ey, rx1, ey, layer);
    // arrowhead at the joint
    var adx = ex - jx, ady = ey - jy, al = Math.hypot(adx, ady) || 1, ux = adx / al, uy = ady / al;
    var ah = g * 0.5, ppx = -uy, ppy = ux;
    rec.addLine(v, jx, jy, jx + ux * ah + ppx * ah * 0.4, jy + uy * ah + ppy * ah * 0.4, layer);
    rec.addLine(v, jx, jy, jx + ux * ah - ppx * ah * 0.4, jy + uy * ah - ppy * ah * 0.4, layer);
    // symbol at mid reference line (below = arrow side, i.e. toward -y here)
    var sx = ex + refDir * refLen * 0.45, sy = ey;
    var t = (type || '').toLowerCase();
    if (t === 'fillet') {
      // right triangle sitting under the reference line
      rec.addLine(v, sx, sy, sx, sy - leg, layer);
      rec.addLine(v, sx, sy - leg, sx + leg, sy, layer);
      rec.addLine(v, sx, sy, sx + leg, sy, layer);
    } else {
      // groove V under the reference line (CJP full / PJP partial depth)
      var depth = (t === 'pjp') ? leg * 0.65 : leg;
      rec.addLine(v, sx - leg * 0.55, sy, sx, sy - depth, layer);
      rec.addLine(v, sx + leg * 0.55, sy, sx, sy - depth, layer);
    }
    // label: "<size> <TYPE>"  (fillet shows size△; groove shows CJP / (size)PJP)
    var lbl;
    if (t === 'fillet') lbl = (size ? size + '' : '') + '△';
    else if (t === 'cjp') lbl = 'CJP';
    else lbl = '(' + (size || 0) + ')PJP';
    rec.addText(v, ex + refDir * refLen + refDir * g * 1.4, ey, lbl, 0);
  }

  // ── per-view drawing ──────────────────────────────────────────────────────
  function drawLug(viewName, rec, geo, aparam, weld, opt) {
    layers(rec);
    var A = { lug: 'lug', hlug: 'hlug', peye: 'peye', hpeye: 'hpeye', cent: 'cent', base: 'base', weld: 'weld' };
    var lugW = aparam.lugW, lugH = aparam.lugH, baseH = aparam.baseH, outerR = aparam.outerR,
        innerR = aparam.innerR, padeyeR = aparam.padeyeR, lugT = aparam.lugT, padeyeT = aparam.padeyeT;
    var Rcx = geo.Rcx, Rcy = geo.Rcy, Tlx = geo.Tlx, Tly = geo.Tly, Trx = geo.Trx, Try = geo.Try,
        arc_angb = geo.arc_angb, arc_ange = geo.arc_ange, sideH = geo.sideH;
    var g = Math.max(15, Math.max(lugW, lugH) * 0.05);
    var bpOn = opt && opt.bpOn === 'plate';
    var bpInf = opt && opt.bpMode === 'infinite';
    var bpW = aparam.bpW || lugW * 1.6, bpT = aparam.bpT || 20, bpL = aparam.bpL || padeyeT * 2.2;
    weld = weld || { pad: {}, lug: {}, base: {} };

    if (viewName === 'front' || viewName === 'back') {
      // lug plate outline (eccentric-capable)
      rec.addLine(viewName, Tlx, Tly, -lugW / 2, sideH, A.lug);
      rec.addLine(viewName, -lugW / 2, sideH, -lugW / 2, 0, A.lug);
      rec.addLine(viewName, -lugW / 2, 0, lugW / 2, 0, A.lug);
      rec.addLine(viewName, lugW / 2, 0, lugW / 2, sideH, A.lug);
      rec.addLine(viewName, lugW / 2, sideH, Trx, Try, A.lug);
      rec.addArc(viewName, Rcx, Rcy, outerR, arc_angb, arc_ange, A.lug);
      rec.addCircle(viewName, Rcx, Rcy, innerR, A.lug);
      rec.addCircle(viewName, Rcx, Rcy, padeyeR, A.peye);
      // vertical centre line through the hole
      rec.addLine(viewName, Rcx, (bpOn ? -bpT - g : 0), Rcx, lugH + g * 0.6, A.cent);

      // base plate
      if (bpOn) drawBasePlateFront(rec, viewName, A, lugW, bpW, bpT, g, bpInf);

      // dims
      rec.addDimRadius(viewName, Rcx, Rcy, outerR, 135, 'R');
      rec.addDimRadius(viewName, Rcx, Rcy, innerR, 225, 'd');
      rec.addDimRadius(viewName, Rcx, Rcy, padeyeR, 305, 'Rp');
      rec.addDimLinear(viewName, -lugW / 2, 0, -lugW / 2, lugH, g, 'H');
      rec.addDimLinear(viewName, lugW / 2, 0, lugW / 2, sideH, -g, 'sH');
      rec.addDimLinear(viewName, -lugW / 2, 0, lugW / 2, 0, -g * 2.2, 'W');
      if (Math.abs(aparam.ecc) > 1e-6) rec.addDimLinear(viewName, 0, lugH, Rcx, lugH, g * 1.8, 'off');
      if (bpOn) rec.addDimLinear(viewName, -bpW / 2, -bpT, bpW / 2, -bpT, -g * 1.6, bpInf ? 'B(∞)' : 'B');

      // welds — pad→lug (at pad-eye edge), lug→base (bottom corner), base→shell
      weldSymbol(rec, viewName, Rcx + padeyeR * 0.7, Rcy + padeyeR * 0.7, Rcx + outerR + g * 1.5, Rcy + outerR, +1,
                 weld.pad.type, weld.pad.size, g, A.weld);
      var byTop = bpOn ? 0 : 0;
      weldSymbol(rec, viewName, -lugW / 2, byTop, -lugW / 2 - g * 2.2, -g * 1.4, -1,
                 weld.lug.type, weld.lug.size, g, A.weld);
      if (bpOn) weldSymbol(rec, viewName, bpW / 2 * 0.5, -bpT, bpW / 2 + g * 1.2, -bpT - g * 1.6, +1,
                           weld.base.type, weld.base.size, g, A.weld);

    } else if (viewName === 'left' || viewName === 'center' || viewName === 'right') {
      // side elevation (edge-on): lug plate + pad plates
      rec.addLine(viewName, -lugT / 2, lugH, lugT / 2, lugH, A.lug);
      rec.addLine(viewName, -lugT / 2, 0, lugT / 2, 0, A.lug);
      rec.addLine(viewName, -lugT / 2, 0, -lugT / 2, lugH, A.lug);
      rec.addLine(viewName, lugT / 2, 0, lugT / 2, lugH, A.lug);
      rec.addLine(viewName, -lugT / 2, sideH, lugT / 2, sideH, A.lug);
      // pad plates
      rec.addLine(viewName, -padeyeT / 2, Rcy + padeyeR, -lugT / 2, Rcy + padeyeR, A.peye);
      rec.addLine(viewName, lugT / 2, Rcy + padeyeR, padeyeT / 2, Rcy + padeyeR, A.peye);
      rec.addLine(viewName, -padeyeT / 2, Rcy - padeyeR, -lugT / 2, Rcy - padeyeR, A.peye);
      rec.addLine(viewName, lugT / 2, Rcy - padeyeR, padeyeT / 2, Rcy - padeyeR, A.peye);
      rec.addLine(viewName, -padeyeT / 2, Rcy - padeyeR, -padeyeT / 2, Rcy + padeyeR, A.peye);
      rec.addLine(viewName, padeyeT / 2, Rcy - padeyeR, padeyeT / 2, Rcy + padeyeR, A.peye);
      // hidden hole edges
      rec.addLine(viewName, -padeyeT / 2, Rcy + innerR, -lugT / 2, Rcy + innerR, A.hpeye);
      rec.addLine(viewName, -lugT / 2, Rcy + innerR, lugT / 2, Rcy + innerR, A.hlug);
      rec.addLine(viewName, lugT / 2, Rcy + innerR, padeyeT / 2, Rcy + innerR, A.hpeye);
      rec.addLine(viewName, -padeyeT / 2, Rcy - innerR, -lugT / 2, Rcy - innerR, A.hpeye);
      rec.addLine(viewName, -lugT / 2, Rcy - innerR, lugT / 2, Rcy - innerR, A.hlug);
      rec.addLine(viewName, lugT / 2, Rcy - innerR, padeyeT / 2, Rcy - innerR, A.hpeye);

      if (bpOn) drawBasePlateSide(rec, viewName, A, padeyeT, bpL, bpT, g, bpInf);

      rec.addDimLinear(viewName, -padeyeT / 2, 0, -padeyeT / 2, lugH, g * 2, 'H');
      rec.addDimLinear(viewName, padeyeT / 2, 0, padeyeT / 2, sideH, -g * 2, 'sH');
      rec.addDimLinear(viewName, -padeyeT / 2, Rcy - padeyeR, -padeyeT / 2, Rcy + padeyeR, g, 'Dp');
      rec.addDimLinear(viewName, padeyeT / 2, Rcy - innerR, padeyeT / 2, Rcy + innerR, -g);
      rec.addDimLinear(viewName, -lugT / 2, lugH, lugT / 2, lugH, g * 1.2, 't');
      rec.addDimLinear(viewName, -padeyeT / 2, Rcy + padeyeR, padeyeT / 2, Rcy + padeyeR, g * 1.6, 'tp');
      if (bpOn) rec.addDimLinear(viewName, -bpL / 2, -bpT, bpL / 2, -bpT, -g * 1.6, bpInf ? 'C(∞)' : 'C');

      // welds — pad→lug (pad-plate edge to lug face), lug→base, base→shell
      weldSymbol(rec, viewName, lugT / 2, Rcy + padeyeR, padeyeT / 2 + g * 1.4, Rcy + padeyeR + g, +1,
                 weld.pad.type, weld.pad.size, g, A.weld);
      weldSymbol(rec, viewName, lugT / 2, 0, padeyeT / 2 + g * 1.6, -g * 1.2, +1,
                 weld.lug.type, weld.lug.size, g, A.weld);
      if (bpOn) weldSymbol(rec, viewName, bpL / 2 * 0.5, -bpT, bpL / 2 + g * 1.2, -bpT - g * 1.6, +1,
                           weld.base.type, weld.base.size, g, A.weld);

    } else if (viewName === 'top' || viewName === 'bottom') {
      rec.addLine(viewName, -lugW / 2, -lugT / 2, lugW / 2, -lugT / 2, A.lug);
      rec.addLine(viewName, -lugW / 2, lugT / 2, lugW / 2, lugT / 2, A.lug);
      rec.addLine(viewName, -lugW / 2, -lugT / 2, -lugW / 2, lugT / 2, A.lug);
      rec.addLine(viewName, lugW / 2, -lugT / 2, lugW / 2, lugT / 2, A.lug);
      rec.addLine(viewName, Rcx - padeyeR, -padeyeT / 2, Rcx + padeyeR, -padeyeT / 2, A.peye);
      rec.addLine(viewName, Rcx - padeyeR, padeyeT / 2, Rcx + padeyeR, padeyeT / 2, A.peye);
      rec.addLine(viewName, Rcx - padeyeR, -padeyeT / 2, Rcx - padeyeR, -lugT / 2, A.peye);
      rec.addLine(viewName, Rcx - padeyeR, lugT / 2, Rcx - padeyeR, padeyeT / 2, A.peye);
      rec.addLine(viewName, Rcx + padeyeR, -padeyeT / 2, Rcx + padeyeR, -lugT / 2, A.peye);
      rec.addLine(viewName, Rcx + padeyeR, lugT / 2, Rcx + padeyeR, padeyeT / 2, A.peye);
      rec.addLine(viewName, Rcx - innerR, -padeyeT / 2, Rcx - innerR, padeyeT / 2, A.hlug);
      rec.addLine(viewName, Rcx + innerR, -padeyeT / 2, Rcx + innerR, padeyeT / 2, A.hlug);

      rec.addDimLinear(viewName, -lugW / 2, -padeyeT / 2, lugW / 2, -padeyeT / 2, -g * 2, 'W');
      rec.addDimLinear(viewName, Rcx - padeyeR, -padeyeT / 2, Rcx + padeyeR, -padeyeT / 2, -g, 'Rp2');
      rec.addDimLinear(viewName, Rcx - innerR, padeyeT / 2, Rcx + innerR, padeyeT / 2, g, 'd');
      rec.addDimLinear(viewName, -lugW / 2, -padeyeT / 2, -lugW / 2, padeyeT / 2, g, 'tp');
      rec.addDimLinear(viewName, lugW / 2, -lugT / 2, lugW / 2, lugT / 2, -g, 't');
      if (Math.abs(aparam.ecc) > 1e-6) rec.addDimLinear(viewName, 0, padeyeT / 2, Rcx, padeyeT / 2, g * 1.8, 'off');
    }
  }

  // base plate — FRONT view (rectangle under the lug, y in [-bpT,0])
  function drawBasePlateFront(rec, v, A, lugW, bpW, bpT, g, inf) {
    var hx = bpW / 2;
    rec.addLine(v, -hx, 0, hx, 0, A.base);
    rec.addLine(v, -hx, -bpT, hx, -bpT, A.base);
    if (inf) {
      zigzag(rec, v, -hx, 0, -hx, -bpT, 3, bpT * 0.28, A.base);
      zigzag(rec, v, hx, 0, hx, -bpT, 3, bpT * 0.28, A.base);
    } else {
      rec.addLine(v, -hx, 0, -hx, -bpT, A.base);
      rec.addLine(v, hx, 0, hx, -bpT, A.base);
    }
  }

  // base plate — SIDE view (rectangle under the lug, depth = bpL)
  function drawBasePlateSide(rec, v, A, padeyeT, bpL, bpT, g, inf) {
    var hx = bpL / 2;
    rec.addLine(v, -hx, 0, hx, 0, A.base);
    rec.addLine(v, -hx, -bpT, hx, -bpT, A.base);
    if (inf) {
      zigzag(rec, v, -hx, 0, -hx, -bpT, 3, bpT * 0.28, A.base);
      zigzag(rec, v, hx, 0, hx, -bpT, 3, bpT * 0.28, A.base);
    } else {
      rec.addLine(v, -hx, 0, -hx, -bpT, A.base);
      rec.addLine(v, hx, 0, hx, -bpT, A.base);
    }
  }

  // ── render / entry points ────────────────────────────────────────────────
  function renderView() {
    var dd = window._lug_drawData;
    if (!dd) return;
    window.RWSVG.mountView({
      host: 'liftinglugplot', bar: 'lug-viewbar', view: window._lugView,
      view3dId: 'lug3d', render3dName: 'render_liftinglug_3d',
      mod3d: 'https://macrobim.github.io/macroBIM/bim_liftinglug_3d.js',
      get3dArgs: function () { return [dd.geo]; },
      drawView: function (view, rec) { drawLug(view, rec, dd.geo, dd.aparam, dd.weld, dd.opt); }
    });
  }

  window.fdraw_liftinglug = function () {
    var host = document.getElementById('liftinglugplot');
    if (!host) return;
    var u = readLugTestParams();
    var aparam = u.aparam;
    var ta = document.getElementById('sUserText');
    if (ta) ta.value = u.combText;

    // sanity — core dims must be positive (weld/plate/ecc/ext may be 0)
    var core = ['lugW', 'lugH', 'baseH', 'outerR', 'innerR', 'padeyeR', 'lugT', 'padeyeT'];
    if (core.some(function (k) { return aparam[k] <= 0; })) return;

    // constraints
    if (aparam.lugW / 2 < aparam.outerR + Math.abs(aparam.ecc)) {
      aparam.lugW = (aparam.outerR + Math.abs(aparam.ecc)) * 2;
      var e1 = document.getElementById('lugW'); if (e1) e1.value = aparam.lugW;
    }
    var minH = aparam.outerR + aparam.padeyeR + aparam.baseH + (aparam.bodyExt || 0);
    if (aparam.lugH < minH) { aparam.lugH = minH; var e2 = document.getElementById('lugH'); if (e2) e2.value = aparam.lugH; }

    var geo = geoLugTest(aparam);

    var odxf = G('odxf_lug');
    if (odxf) {
      odxf.init();
      odxf.layer('lug_cent', 1, 'CENTER');
      odxf.layer('lug_hidden', 4, 'HIDDEN');
      odxf.layer('lug_solid', 4, 'CONTINUOUS');
      odxf.layer('padeye', 3, 'CONTINUOUS');
      if (typeof _emit_dxf_liftinglug === 'function') { try { _emit_dxf_liftinglug(geo); } catch (e) {} }
    }

    window._lug_drawData = { geo: geo, aparam: aparam, weld: u.weld, opt: u.opt };
    renderView();
  };

  window.lug_setview = function (view) { window._lugView = view; renderView(); };
  window._lugDrawView = drawLug;          // headless harness
  window._geoLugTest = geoLugTest;        // headless harness
  window._readLugTestParams = readLugTestParams;
})();
