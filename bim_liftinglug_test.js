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
                 'ecc', 'bodyExt', 'bpW', 'bpT', 'bpL', 'weldLugSize', 'weldPadSize', 'weldBaseSize',
                 'spBotL', 'spTopL', 'spHL', 'spWL', 'spInsetL',
                 'spBotR', 'spTopR', 'spHR', 'spWR', 'spInsetR'];

  // ── params ────────────────────────────────────────────────────────────────
  function readLugTestParams() {
    function num(id) { var e = document.getElementById(id); return e ? Number(e.value) : 0; }
    function sel(id, def) { var e = document.getElementById(id); return (e && e.value) ? e.value : def; }
    function chk(id, def) { var e = document.getElementById(id); return e ? !!e.checked : def; }
    var aparam = {};
    NUMKEYS.forEach(function (k) { aparam[k] = num(k); });
    // each joint: weld only reflected when its checkbox is ticked (type='none' skips it)
    var weld = {
      pad:  { type: chk('weldPadOn',  true) ? sel('weldPadType',  'fillet') : 'none', size: aparam.weldPadSize },
      lug:  { type: chk('weldLugOn',  true) ? sel('weldLugType',  'fillet') : 'none', size: aparam.weldLugSize },
      base: { type: chk('weldBaseOn', true) ? sel('weldBaseType', 'fillet') : 'none', size: aparam.weldBaseSize }
    };
    var opt = { bpOn: chk('bpOn', true) ? 'plate' : 'none', bpMode: sel('bpMode', 'infinite'),
                padOn: chk('padOn', true), spOn: chk('spOn', false), eccOn: chk('eccOn', false),
                spOnL: chk('spOnL', true), spOnR: chk('spOnR', true) };
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
    rec.addLayer('sp', '#a855f7', 'solid');     // side plates (purple)
    rec.addLayer('hsp', '#a855f7', 'hidden');
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
    var A = { lug: 'lug', hlug: 'hlug', peye: 'peye', hpeye: 'hpeye', cent: 'cent', base: 'base', weld: 'weld', sp: 'sp', hsp: 'hsp' };
    var lugW = aparam.lugW, lugH = aparam.lugH, baseH = aparam.baseH, outerR = aparam.outerR,
        innerR = aparam.innerR, padeyeR = aparam.padeyeR, lugT = aparam.lugT, padeyeT = aparam.padeyeT;
    var Rcx = geo.Rcx, Rcy = geo.Rcy, Tlx = geo.Tlx, Tly = geo.Tly, Trx = geo.Trx, Try = geo.Try,
        arc_angb = geo.arc_angb, arc_ange = geo.arc_ange, sideH = geo.sideH;
    var g = Math.max(15, Math.max(lugW, lugH) * 0.05);
    var bpOn = opt && opt.bpOn === 'plate';
    var bpInf = opt && opt.bpMode === 'infinite';
    var pads = !opt || opt.padOn !== false;           // padeye ring / cheek plates
    var spOn = opt && opt.spOn === true;              // independent left / right side plates
    // per-side params (bot/top = full end-view widths, h height, w front width, inset from lug edge)
    var spL = { bot: aparam.spBotL || 0, top: aparam.spTopL || 0, h: aparam.spHL || 0, w: aparam.spWL || 0, inset: aparam.spInsetL || 0, on: !opt || opt.spOnL !== false };
    var spR = { bot: aparam.spBotR || 0, top: aparam.spTopR || 0, h: aparam.spHR || 0, w: aparam.spWR || 0, inset: aparam.spInsetR || 0, on: !opt || opt.spOnR !== false };
    // X bands: inner edge = lug edge + inset, extending outward by w
    spL.in = -(lugW / 2 + spL.inset); spL.out = spL.in - spL.w;   // left band  [out(≤), in]
    spR.in = lugW / 2 + spR.inset;    spR.out = spR.in + spR.w;   // right band [in, out(≥)]
    // slot height: a plate inside the lug is split around the lug body only up
    // to the lug outline; above that the two flanks merge into one solid piece
    function lugTopAt(x) {
      if (Math.abs(x) > lugW / 2) return 0;
      var dx = x - Rcx, t = sideH;
      if (Math.abs(dx) < outerR) t = Math.max(t, Rcy + Math.sqrt(outerR * outerR - dx * dx));
      return t;
    }
    [spL, spR].forEach(function (s) {
      var lo = Math.min(s.in, s.out), hi = Math.max(s.in, s.out);
      s.splitH = Math.min(s.h, lugTopAt(Math.max(lo, Math.min(hi, Rcx))));
    });
    var spHalf = spOn ? Math.max(spL.on ? Math.max(spL.bot, spL.top) : 0, spR.on ? Math.max(spR.bot, spR.top) : 0) / 2 : 0;
    var half = Math.max(pads ? padeyeT / 2 : lugT / 2, spHalf);   // outer half-thickness for side/top
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
      // padeye ring — shown when the padeye is enabled and larger than the hole
      if (pads && padeyeR > innerR) rec.addCircle(viewName, Rcx, Rcy, padeyeR, A.peye);
      // vertical centre line through the hole
      rec.addLine(viewName, Rcx, (bpOn ? -bpT - g : 0), Rcx, lugH + g * 0.6, A.cent);

      // side plates — independent left / right plates (face-on rectangles)
      if (spOn) {
        [spR, spL].forEach(function (s) {
          if (!s.on || !(s.w > 0) || !(s.h > 0)) return;
          var xa = Math.min(s.in, s.out), xb = Math.max(s.in, s.out);
          rec.addLine(viewName, xa, 0, xb, 0, A.sp);
          rec.addLine(viewName, xb, 0, xb, s.h, A.sp);
          rec.addLine(viewName, xb, s.h, xa, s.h, A.sp);
          rec.addLine(viewName, xa, s.h, xa, 0, A.sp);
        });
      }

      // base plate
      if (bpOn) drawBasePlateFront(rec, viewName, A, lugW, bpW, bpT, g, bpInf);

      // ── dimensions: verticals stacked on L/R, horizontals stacked at bottom ──
      var dg = g * 1.7;                                     // spacing between stacked dim lines
      var spLon = spOn && spL.on && spL.w > 0, spRon = spOn && spR.on && spR.w > 0;
      var featL = Math.min(-lugW / 2, spLon ? spL.out : 0); // leftmost lug/plate feature
      var featR = Math.max(lugW / 2, spRon ? spR.out : 0);  // rightmost lug/plate feature
      var yBot = bpOn ? -bpT : 0;                           // bottom of part
      // radii — leader callouts spread around the hole
      rec.addDimRadius(viewName, Rcx, Rcy, outerR, 150, 'R');
      rec.addDimRadius(viewName, Rcx, Rcy, innerR, 250, 'd');
      if (pads && padeyeR > innerR) rec.addDimRadius(viewName, Rcx, Rcy, padeyeR, 325, 'Rp');
      // left column (vertical): H
      rec.addDimLinear(viewName, -lugW / 2, 0, -lugW / 2, lugH, (-lugW / 2) - (featL - dg), 'H');
      // right column (vertical): sH, then spH (outer)
      rec.addDimLinear(viewName, lugW / 2, 0, lugW / 2, sideH, (lugW / 2) - (featR + dg), 'sH');
      if (spRon && spR.h > 0) rec.addDimLinear(viewName, lugW / 2, 0, lugW / 2, spR.h, (lugW / 2) - (featR + dg * 2.3), 'spH');
      // bottom rows (horizontal): spW / W chain, then B (outer)
      if (spLon) rec.addDimLinear(viewName, spL.out, 0, spL.in, 0, yBot - dg, 'spW');
      rec.addDimLinear(viewName, -lugW / 2, 0, lugW / 2, 0, yBot - dg, 'W');
      if (spRon) rec.addDimLinear(viewName, spR.in, 0, spR.out, 0, yBot - dg, 'spW');
      if (bpOn) rec.addDimLinear(viewName, -bpW / 2, -bpT, bpW / 2, -bpT, -dg * 2.3, bpInf ? 'B(∞)' : 'B');
      // eccentricity at the top
      if (Math.abs(aparam.ecc) > 1e-6) rec.addDimLinear(viewName, 0, lugH, Rcx, lugH, dg, 'off');

      // welds — pad→lug (at pad-eye edge), lug→base (bottom corner), base→shell
      if (pads) weldSymbol(rec, viewName, Rcx + padeyeR * 0.7, Rcy + padeyeR * 0.7, Rcx + outerR + g * 1.5, Rcy + outerR, +1,
                 weld.pad.type, weld.pad.size, g, A.weld);
      weldSymbol(rec, viewName, -lugW / 2, 0, -lugW / 2 - g * 2.2, -g * 1.4, -1,
                 weld.lug.type, weld.lug.size, g, A.weld);
      if (bpOn) weldSymbol(rec, viewName, bpW / 2 * 0.5, -bpT, bpW / 2 + g * 1.2, -bpT - g * 1.6, +1,
                           weld.base.type, weld.base.size, g, A.weld);

    } else if (viewName === 'left' || viewName === 'center' || viewName === 'right') {
      // side elevation (edge-on): centre lug plate + optional side pad plates
      rec.addLine(viewName, -lugT / 2, lugH, lugT / 2, lugH, A.lug);
      rec.addLine(viewName, -lugT / 2, 0, lugT / 2, 0, A.lug);
      rec.addLine(viewName, -lugT / 2, 0, -lugT / 2, lugH, A.lug);
      rec.addLine(viewName, lugT / 2, 0, lugT / 2, lugH, A.lug);
      rec.addLine(viewName, -lugT / 2, sideH, lugT / 2, sideH, A.lug);
      if (pads) {
        // side pad/cheek plates, both sides
        rec.addLine(viewName, -padeyeT / 2, Rcy + padeyeR, -lugT / 2, Rcy + padeyeR, A.peye);
        rec.addLine(viewName, lugT / 2, Rcy + padeyeR, padeyeT / 2, Rcy + padeyeR, A.peye);
        rec.addLine(viewName, -padeyeT / 2, Rcy - padeyeR, -lugT / 2, Rcy - padeyeR, A.peye);
        rec.addLine(viewName, lugT / 2, Rcy - padeyeR, padeyeT / 2, Rcy - padeyeR, A.peye);
        rec.addLine(viewName, -padeyeT / 2, Rcy - padeyeR, -padeyeT / 2, Rcy + padeyeR, A.peye);
        rec.addLine(viewName, padeyeT / 2, Rcy - padeyeR, padeyeT / 2, Rcy + padeyeR, A.peye);
      }
      // hidden hole edges (lug always; pad segments only with pads)
      rec.addLine(viewName, -lugT / 2, Rcy + innerR, lugT / 2, Rcy + innerR, A.hlug);
      rec.addLine(viewName, -lugT / 2, Rcy - innerR, lugT / 2, Rcy - innerR, A.hlug);
      if (pads) {
        rec.addLine(viewName, -padeyeT / 2, Rcy + innerR, -lugT / 2, Rcy + innerR, A.hpeye);
        rec.addLine(viewName, lugT / 2, Rcy + innerR, padeyeT / 2, Rcy + innerR, A.hpeye);
        rec.addLine(viewName, -padeyeT / 2, Rcy - innerR, -lugT / 2, Rcy - innerR, A.hpeye);
        rec.addLine(viewName, lugT / 2, Rcy - innerR, padeyeT / 2, Rcy - innerR, A.hpeye);
      }

      // trapezoidal side plate straddling the lug (bottom edge spBot, top edge
      // spTop, both centred on the lug). left view → left plate, right → right.
      if (spOn) {
        var spSides = ((viewName === 'left') ? [spL] : (viewName === 'right') ? [spR] : [spR, spL])
          .filter(function (s) { return s.on && (s.bot > 0 || s.top > 0) && s.h > 0; });
        spSides.forEach(function (s) {
          var zbo = s.bot / 2, zto = s.top / 2, sh = s.splitH;
          if (s.inset < 0 && zbo > lugT / 2 && sh > 0.01) {
            if (sh >= s.h - 0.01) {
              // fully inside the lug → two separate flanks
              [1, -1].forEach(function (sgn) {
                rec.addLine(viewName, sgn * lugT / 2, 0, sgn * zbo, 0, A.sp);
                rec.addLine(viewName, sgn * zbo, 0, sgn * zto, s.h, A.sp);
                rec.addLine(viewName, sgn * zto, s.h, sgn * lugT / 2, s.h, A.sp);
                rec.addLine(viewName, sgn * lugT / 2, s.h, sgn * lugT / 2, 0, A.sp);
              });
            } else {
              // slotted around the lug up to sh, solid above → one notched outline
              var pts = [[-zbo, 0], [-lugT / 2, 0], [-lugT / 2, sh], [lugT / 2, sh], [lugT / 2, 0],
                         [zbo, 0], [zto, s.h], [-zto, s.h], [-zbo, 0]];
              for (var i = 0; i < pts.length - 1; i++) rec.addLine(viewName, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], A.sp);
            }
          } else {
            rec.addLine(viewName, -zbo, 0, zbo, 0, A.sp);       // bottom edge (spBot)
            rec.addLine(viewName, zbo, 0, zto, s.h, A.sp);      // right slope
            rec.addLine(viewName, zto, s.h, -zto, s.h, A.sp);   // top edge (spTop)
            rec.addLine(viewName, -zto, s.h, -zbo, 0, A.sp);    // left slope
          }
        });
        var sd = spSides[0];
        if (sd) {
          rec.addDimLinear(viewName, -sd.bot / 2, 0, sd.bot / 2, 0, -g * 1.4, 'spBot');
          rec.addDimLinear(viewName, -sd.top / 2, sd.h, sd.top / 2, sd.h, g * 1.4, 'spTop');
        }
      }

      if (bpOn) drawBasePlateSide(rec, viewName, A, padeyeT, bpL, bpT, g, bpInf);

      rec.addDimLinear(viewName, -half, 0, -half, lugH, g * 2, 'H');
      rec.addDimLinear(viewName, half, 0, half, sideH, -g * 2, 'sH');
      if (pads) rec.addDimLinear(viewName, -half, Rcy - padeyeR, -half, Rcy + padeyeR, g, 'Dp');
      rec.addDimLinear(viewName, half, Rcy - innerR, half, Rcy + innerR, -g);
      rec.addDimLinear(viewName, -lugT / 2, lugH, lugT / 2, lugH, g * 1.2, 't');
      if (pads) rec.addDimLinear(viewName, -padeyeT / 2, Rcy + padeyeR, padeyeT / 2, Rcy + padeyeR, g * 1.6, 'tp');
      if (bpOn) rec.addDimLinear(viewName, -bpL / 2, -bpT, bpL / 2, -bpT, -g * 1.6, bpInf ? 'C(∞)' : 'C');

      // welds — pad→lug (only with pads), lug→base, base→shell
      if (pads) weldSymbol(rec, viewName, lugT / 2, Rcy + padeyeR, half + g * 1.4, Rcy + padeyeR + g, +1,
                 weld.pad.type, weld.pad.size, g, A.weld);
      weldSymbol(rec, viewName, lugT / 2, 0, half + g * 1.6, -g * 1.2, +1,
                 weld.lug.type, weld.lug.size, g, A.weld);
      if (bpOn) weldSymbol(rec, viewName, bpL / 2 * 0.5, -bpT, bpL / 2 + g * 1.2, -bpT - g * 1.6, +1,
                           weld.base.type, weld.base.size, g, A.weld);

    } else if (viewName === 'top' || viewName === 'bottom') {
      // plan looking down (top, solid) or up (bottom, occluded structure dashed)
      var hidden = (viewName === 'bottom');
      var Ll = hidden ? A.hlug : A.lug, Lp = hidden ? A.hpeye : A.peye;
      // supporting (base) plate footprint — drawn first, underneath
      if (bpOn) drawBasePlatePlan(rec, viewName, A, bpW, bpL, g, bpInf);
      // centre lug plate (lugW × lugT)
      rec.addLine(viewName, -lugW / 2, -lugT / 2, lugW / 2, -lugT / 2, Ll);
      rec.addLine(viewName, -lugW / 2, lugT / 2, lugW / 2, lugT / 2, Ll);
      rec.addLine(viewName, -lugW / 2, -lugT / 2, -lugW / 2, lugT / 2, Ll);
      rec.addLine(viewName, lugW / 2, -lugT / 2, lugW / 2, lugT / 2, Ll);
      if (pads) {
        rec.addLine(viewName, Rcx - padeyeR, -padeyeT / 2, Rcx + padeyeR, -padeyeT / 2, Lp);
        rec.addLine(viewName, Rcx - padeyeR, padeyeT / 2, Rcx + padeyeR, padeyeT / 2, Lp);
        rec.addLine(viewName, Rcx - padeyeR, -padeyeT / 2, Rcx - padeyeR, -lugT / 2, Lp);
        rec.addLine(viewName, Rcx - padeyeR, lugT / 2, Rcx - padeyeR, padeyeT / 2, Lp);
        rec.addLine(viewName, Rcx + padeyeR, -padeyeT / 2, Rcx + padeyeR, -lugT / 2, Lp);
        rec.addLine(viewName, Rcx + padeyeR, lugT / 2, Rcx + padeyeR, padeyeT / 2, Lp);
      }
      // side plates footprint — independent L/R; show bottom (spBot) & top
      // (spTop) widths so the taper reads in plan
      if (spOn) {
        var Lsp = hidden ? A.hsp : A.sp;
        [spR, spL].forEach(function (s) {
          if (!s.on || !(s.w > 0) || !(s.bot > 0)) return;
          var xa = Math.min(s.in, s.out), xb = Math.max(s.in, s.out), zbo = s.bot / 2, zto = s.top / 2;
          if (s.inset < 0 && zbo > lugT / 2 && s.splitH >= s.h - 0.01) {
            // fully inside the lug (no solid top) → two flank footprints
            [1, -1].forEach(function (sgn) {
              var zi = sgn * lugT / 2, zb = sgn * zbo, zt = sgn * zto;
              rec.addLine(viewName, xa, zi, xb, zi, Lsp);
              rec.addLine(viewName, xb, zi, xb, zb, Lsp);
              rec.addLine(viewName, xb, zb, xa, zb, Lsp);
              rec.addLine(viewName, xa, zb, xa, zi, Lsp);
              rec.addLine(viewName, xa, zt, xb, zt, Lsp);   // top-width edge
            });
          } else {
            rec.addLine(viewName, xa, -zbo, xb, -zbo, Lsp);
            rec.addLine(viewName, xb, -zbo, xb, zbo, Lsp);
            rec.addLine(viewName, xb, zbo, xa, zbo, Lsp);
            rec.addLine(viewName, xa, zbo, xa, -zbo, Lsp);
            rec.addLine(viewName, xa, -zto, xb, -zto, Lsp);
            rec.addLine(viewName, xa, zto, xb, zto, Lsp);
          }
        });
      }
      // hole projection (always hidden)
      rec.addLine(viewName, Rcx - innerR, -half, Rcx - innerR, half, A.hlug);
      rec.addLine(viewName, Rcx + innerR, -half, Rcx + innerR, half, A.hlug);

      rec.addDimLinear(viewName, -lugW / 2, -half, lugW / 2, -half, -g * 2, 'W');
      if (pads) rec.addDimLinear(viewName, Rcx - padeyeR, -half, Rcx + padeyeR, -half, -g, 'Rp2');
      rec.addDimLinear(viewName, Rcx - innerR, half, Rcx + innerR, half, g, 'd');
      if (pads) rec.addDimLinear(viewName, -lugW / 2, -padeyeT / 2, -lugW / 2, padeyeT / 2, g, 'tp');
      rec.addDimLinear(viewName, lugW / 2, -lugT / 2, lugW / 2, lugT / 2, -g, 't');
      if (bpOn) rec.addDimLinear(viewName, -bpW / 2, bpL / 2, bpW / 2, bpL / 2, g * 1.8, bpInf ? 'B(∞)' : 'B');
      if (bpOn) rec.addDimLinear(viewName, bpW / 2, -bpL / 2, bpW / 2, bpL / 2, -g * 1.4, bpInf ? 'C(∞)' : 'C');
      if (Math.abs(aparam.ecc) > 1e-6) rec.addDimLinear(viewName, 0, half, Rcx, half, g * 1.8, 'off');
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

  // base plate — PLAN view (bpW along lugW × bpL along thickness); infinite
  // supporting plate shown as a broken-out region (zig-zag on all four edges).
  function drawBasePlatePlan(rec, v, A, bpW, bpL, g, inf) {
    var hx = bpW / 2, hy = bpL / 2, amp = Math.min(bpW, bpL) * 0.03, k = 5;
    if (inf) {
      zigzag(rec, v, -hx, -hy, hx, -hy, k, amp, A.base);
      zigzag(rec, v, hx, -hy, hx, hy, k, amp, A.base);
      zigzag(rec, v, hx, hy, -hx, hy, k, amp, A.base);
      zigzag(rec, v, -hx, hy, -hx, -hy, k, amp, A.base);
    } else {
      rec.addLine(v, -hx, -hy, hx, -hy, A.base);
      rec.addLine(v, hx, -hy, hx, hy, A.base);
      rec.addLine(v, hx, hy, -hx, hy, A.base);
      rec.addLine(v, -hx, hy, -hx, -hy, A.base);
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
      aspect: 16 / 9,
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

    // show/hide each section's input rows to match its header checkbox
    function toggleRows(ids, on) {
      ids.forEach(function (id) { var r = document.getElementById(id); if (r) r.style.display = on ? '' : 'none'; });
    }
    toggleRows(['row_padeyeR', 'row_padeyeT'], u.opt.padOn);
    toggleRows(['sp_table'], u.opt.spOn);
    // disable a side's inputs when its Left/Right checkbox is off
    function setSide(ids, on) {
      ids.forEach(function (id) { var e = document.getElementById(id); if (e) { e.disabled = !on; e.style.opacity = on ? '1' : '0.35'; } });
    }
    setSide(['spBotL', 'spTopL', 'spHL', 'spWL', 'spInsetL'], u.opt.spOnL);
    setSide(['spBotR', 'spTopR', 'spHR', 'spWR', 'spInsetR'], u.opt.spOnR);
    toggleRows(['row_ecc', 'row_bodyExt'], u.opt.eccOn);
    toggleRows(['row_bpMode', 'row_bpW', 'row_bpT', 'row_bpL'], u.opt.bpOn === 'plate');
    // eccentricity / extension only apply when their section is enabled
    if (!u.opt.eccOn) { aparam.ecc = 0; aparam.bodyExt = 0; }

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
    geo.opt = u.opt;   // carry base-plate / pad toggle into the 3D renderer

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
