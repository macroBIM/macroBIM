/*
    bim_xsect_test.js — Column cross-section preview (LAYOUT TEST).
    Self-contained hollow cross-sections drawn on the shared draw core (window.RWSVG),
    matching the retaining-wall / pier visual style. Production section modules
    (bim_rect/circle/track/octagon) are NOT touched.

    Shapes & variables (all mm; hollow toggled per shape):
      rect    : H, B, twl, twr, tf1, tf2, ha, hb   (box; asymmetric walls, top/bottom
                                                    flanges, chamfered inner haunch ha/hb)
      circle  : D, tw                         (pipe)
      track   : H, B, R, t                    (rounded rectangle, corner radius R)
      octagon : H, B, a, b, t                 (chamfered rectangle; a horiz / b vert chamfer)

    Model coords: y-up, section sits on y=0 (bottom), centred on x=0.
    Entry: window.XSECT.draw(shape, mountId, params) and window.XSECT.geo(shape, params).
*/
(function () {
  "use strict";

  // ── shape metadata: input rows [id, label, default] ──────────────────────
  var SHAPES = {
    rect: { label: "Rectangle", vars: [
      ["H", "Outer height", 800], ["B", "Outer width", 600],
      ["twl", "Wall thickness left", 120], ["twr", "Wall thickness right", 120],
      ["tf1", "Top flange thickness", 120], ["tf2", "Bottom flange thickness", 120],
      ["ha", "Inner haunch (horizontal)", 150], ["hb", "Inner haunch (vertical)", 150] ] },
    circle: { label: "Circle", vars: [
      ["D", "Outer diameter", 800], ["tw", "Wall thickness", 120] ] },
    track: { label: "Track", vars: [
      ["H", "Outer height", 800], ["B", "Outer width", 1400],
      ["R", "Corner radius", 400], ["t", "Wall thickness", 120] ] },
    octagon: { label: "Octagon", vars: [
      ["H", "Outer height", 800], ["B", "Outer width", 1000],
      ["a", "Chamfer width (horiz)", 200], ["b", "Chamfer height (vert)", 200],
      ["t", "Wall thickness", 120] ] }
  };

  // ── geometry helpers ──────────────────────────────────────────────────────
  // Inward parallel offset of a CCW polygon: each edge shifted by its own
  // distance along the inward normal; inner vertices = intersections of the
  // shifted adjacent edge lines. Robust for convex outlines (octagon).
  function offsetPoly(V, dist) {
    var n = V.length, lines = [];
    for (var i = 0; i < n; i++) {
      var a = V[i], b = V[(i + 1) % n];
      var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
      var nx = -dy / len, ny = dx / len;              // inward normal (CCW → left)
      var d = (typeof dist === "function") ? dist(dx, dy, i) : dist;
      lines.push({ px: a[0] + nx * d, py: a[1] + ny * d, dx: dx, dy: dy });
    }
    function inter(L1, L2) {
      var den = L1.dx * L2.dy - L1.dy * L2.dx;
      if (Math.abs(den) < 1e-9) return [L2.px, L2.py];
      var t = ((L2.px - L1.px) * L2.dy - (L2.py - L1.py) * L2.dx) / den;
      return [L1.px + L1.dx * t, L1.py + L1.dy * t];
    }
    var out = [];
    for (var j = 0; j < n; j++) out.push(inter(lines[(j - 1 + n) % n], lines[j]));
    return out;
  }
  function polyLines(V) {
    var L = [];
    for (var i = 0; i < V.length; i++) { var a = V[i], b = V[(i + 1) % V.length]; L.push({ x1: a[0], y1: a[1], x2: b[0], y2: b[1] }); }
    return L;
  }

  // rounded-rectangle outline (bottom on y=0, centred on x). radius r on all corners.
  function roundRect(x0, x1, y0, y1, r) {
    r = Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2));
    var L = [], A = [];
    if (r <= 0) { return { lines: polyLines([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]), arcs: [] }; }
    L.push({ x1: x0 + r, y1: y0, x2: x1 - r, y2: y0 });          // bottom
    A.push({ x: x1 - r, y: y0 + r, r: r, a1: -90, a2: 0 });      // BR
    L.push({ x1: x1, y1: y0 + r, x2: x1, y2: y1 - r });          // right
    A.push({ x: x1 - r, y: y1 - r, r: r, a1: 0, a2: 90 });       // TR
    L.push({ x1: x1 - r, y1: y1, x2: x0 + r, y2: y1 });          // top
    A.push({ x: x0 + r, y: y1 - r, r: r, a1: 90, a2: 180 });     // TL
    L.push({ x1: x0, y1: y1 - r, x2: x0, y2: y0 + r });          // left
    A.push({ x: x0 + r, y: y0 + r, r: r, a1: 180, a2: 270 });    // BL
    return { lines: L, arcs: A };
  }

  // ── per-shape geometry → { outer:{lines,arcs}, inner:{lines,arcs}|null, dims:[], W, H } ──
  function geo(shape, p) {
    p = p || {};
    var hollow = p.hollow !== false;   // default hollow on
    var off, ext, dims = [];
    function num(v) { return +v || 0; }

    if (shape === "circle") {
      var D = num(p.D), tw = num(p.tw), R = D / 2, cy = D / 2;
      off = D * 0.14;
      var outer = { lines: [], arcs: [{ x: 0, y: cy, r: R, a1: 0, a2: 360 }] };
      var inner = (hollow && tw > 0 && tw < R) ? { lines: [], arcs: [{ x: 0, y: cy, r: R - tw, a1: 0, a2: 360 }] } : null;
      dims.push({ x1: R, y1: 0, x2: R, y2: D, gap: -off, t: "D" });   // right vertical → right
      if (inner) dims.push({ x1: R - tw, y1: cy, x2: R, y2: cy, gap: off * 0.5, t: "tw" });
      return { outer: outer, inner: inner, dims: dims, W: D, H: D, cx: 0, cy: cy, R: R, tw: tw };
    }

    if (shape === "rect") {
      var H = num(p.H), B = num(p.B), twl = num(p.twl), twr = num(p.twr), tf1 = num(p.tf1), tf2 = num(p.tf2),
        ha = num(p.ha), hb = num(p.hb);
      off = Math.max(H, B) * 0.12;
      var xo0 = -B / 2, xo1 = B / 2;
      var outer = { lines: polyLines([[xo0, 0], [xo1, 0], [xo1, H], [xo0, H]]), arcs: [] };
      var ix0 = xo0 + twl, ix1 = xo1 - twr, iy0 = tf2, iy1 = H - tf1;
      var inner = null;
      if (hollow && ix1 > ix0 && iy1 > iy0) {
        // inner void: chamfered corners (내부 헌치) with legs ha (horizontal) / hb (vertical)
        var cha = Math.max(0, Math.min(ha, (ix1 - ix0) / 2)), chb = Math.max(0, Math.min(hb, (iy1 - iy0) / 2));
        var IV = (cha > 0 && chb > 0)
          ? [[ix0 + cha, iy0], [ix1 - cha, iy0], [ix1, iy0 + chb], [ix1, iy1 - chb],
             [ix1 - cha, iy1], [ix0 + cha, iy1], [ix0, iy1 - chb], [ix0, iy0 + chb]]
          : [[ix0, iy0], [ix1, iy0], [ix1, iy1], [ix0, iy1]];
        inner = { lines: polyLines(IV), arcs: [], cha: cha, chb: chb, box: [ix0, ix1, iy0, iy1] };
      }
      dims.push({ x1: xo1, y1: 0, x2: xo1, y2: H, gap: -off * 1.5, t: "H" });   // right vertical → right
      dims.push({ x1: xo0, y1: H, x2: xo1, y2: H, gap: off * 1.5, t: "B" });     // top → up
      if (inner) {
        var ymid = (iy0 + iy1) / 2;
        dims.push({ x1: xo0, y1: ymid, x2: ix0, y2: ymid, gap: -off * 0.5, t: "twl" });   // left wall, mid-height
        dims.push({ x1: ix1, y1: ymid, x2: xo1, y2: ymid, gap: off * 0.5, t: "twr" });    // right wall, mid-height
        dims.push({ x1: xo0, y1: iy1, x2: xo0, y2: H, gap: off * 0.9, t: "tf1" });         // left vertical → left
        dims.push({ x1: xo0, y1: 0, x2: xo0, y2: iy0, gap: off * 0.9, t: "tf2" });         // left vertical → left
        if (inner.cha > 0 && inner.chb > 0) {
          dims.push({ x1: ix1 - inner.cha, y1: iy1, x2: ix1, y2: iy1, gap: off * 0.5, t: "ha" });
          dims.push({ x1: ix1, y1: iy1 - inner.chb, x2: ix1, y2: iy1, gap: -off * 0.5, t: "hb" });  // right vertical → right
        }
      }
      return { outer: outer, inner: inner, dims: dims, W: B, H: H };
    }

    if (shape === "track") {
      var tH = num(p.H), tB = num(p.B), tR = num(p.R), tt = num(p.t);
      off = Math.max(tH, tB) * 0.12;
      var outer = roundRect(-tB / 2, tB / 2, 0, tH, tR);
      var inner = (hollow && tt > 0 && tt < tH / 2 && tt < tB / 2)
        ? roundRect(-tB / 2 + tt, tB / 2 - tt, tt, tH - tt, tR - tt) : null;
      dims.push({ x1: tB / 2, y1: 0, x2: tB / 2, y2: tH, gap: -off * 1.6, t: "H" });   // right vertical → right
      dims.push({ x1: -tB / 2, y1: tH, x2: tB / 2, y2: tH, gap: off * 1.6, t: "B" });   // top → up
      dims.push({ radiusDim: true, x: tB / 2 - tR, y: tH - tR, r: tR, ang: 45 });        // TR arc: centre → arc (up-right)
      if (inner) dims.push({ x1: -tB / 2, y1: tH / 2, x2: -tB / 2 + tt, y2: tH / 2, gap: -off * 0.7, t: "t" });
      return { outer: outer, inner: inner, dims: dims, W: tB, H: tH };
    }

    if (shape === "octagon") {
      var oH = num(p.H), oB = num(p.B), oa = num(p.a), ob = num(p.b);
      off = Math.max(oH, oB) * 0.12;
      // CCW from bottom-left corner of the bottom edge
      var V = [
        [-oB / 2 + oa, 0], [oB / 2 - oa, 0], [oB / 2, ob], [oB / 2, oH - ob],
        [oB / 2 - oa, oH], [-oB / 2 + oa, oH], [-oB / 2, oH - ob], [-oB / 2, ob]
      ];
      var outer = { lines: polyLines(V), arcs: [] };
      var inner = null;
      if (hollow) {
        var t = num(p.t);
        var IV = offsetPoly(V, t);
        var okInner = IV.every(function (q) { return isFinite(q[0]) && isFinite(q[1]); });
        if (okInner && t > 0) inner = { lines: polyLines(IV), arcs: [] };
      }
      dims.push({ x1: oB / 2, y1: 0, x2: oB / 2, y2: oH, gap: -off * 1.8, t: "H" });   // right vertical → right
      dims.push({ x1: -oB / 2, y1: oH, x2: oB / 2, y2: oH, gap: off * 1.8, t: "B" });   // top → up
      dims.push({ x1: oB / 2 - oa, y1: oH, x2: oB / 2, y2: oH, gap: off * 0.7, t: "a" });   // top → up
      dims.push({ x1: oB / 2, y1: oH - ob, x2: oB / 2, y2: oH, gap: -off * 0.7, t: "b" });  // right vertical → right
      return { outer: outer, inner: inner, dims: dims, W: oB, H: oH };
    }

    return { outer: { lines: [], arcs: [] }, inner: null, dims: [], W: 1, H: 1 };
  }

  // ── draw onto a mount via the shared core ────────────────────────────────
  function draw(shape, mountId, params) {
    var host = document.getElementById(mountId);
    if (!host) return;
    if (typeof window.RWSVG === "undefined") return;
    var g = geo(shape, params);
    var rec = new window.RWSVG.MockViewer();
    rec.addLayer("c", "#182430", "solid", 1);
    function emit(part) {
      if (!part) return;
      part.lines.forEach(function (l) { rec.addLine(0, l.x1, l.y1, l.x2, l.y2, "c"); });
      part.arcs.forEach(function (a) { if (a.a2 - a.a1 >= 360 || a.a1 === 0 && a.a2 === 360) rec.addCircle(0, a.x, a.y, a.r, "c"); else rec.addArc(0, a.x, a.y, a.r, a.a1, a.a2, "c"); });
    }
    emit(g.outer); emit(g.inner);
    g.dims.forEach(function (d) {
      if (d.radiusDim) { rec.addDimRadius(0, d.x, d.y, d.r, d.ang, "R="); return; }
      rec.addDimLinear(0, d.x1, d.y1, d.x2, d.y2, d.gap, d.t);
    });
    var W = host.clientWidth || 560, Hpx = Math.max(340, Math.min(560, Math.round(W * 0.75)));
    host.innerHTML = window.RWSVG.renderSVG(rec, W, Hpx);
    var svg = host.querySelector("svg");
    if (svg) window.RWSVG.attachZoomPan(svg);
  }

  window.XSECT = { shapes: SHAPES, geo: geo, draw: draw, offsetPoly: offsetPoly };
})();
