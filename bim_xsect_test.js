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

  function ptsOf(V) { return V.map(function (q) { return { x: q[0], y: q[1] }; }); }
  // arc tessellation, inclusive of both endpoints (na+1 points)
  function arcPts(cx, cy, r, a1, a2, na) {
    var p = [];
    for (var i = 0; i <= na; i++) { var t = (a1 + (a2 - a1) * i / na) * Math.PI / 180; p.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) }); }
    return p;
  }
  function circlePts(cx, cy, r, n) {
    var p = [];
    for (var i = 0; i < n; i++) { var t = 2 * Math.PI * i / n; p.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) }); }
    return p;
  }
  // ordered CCW boundary of a rounded rectangle (fixed points per corner arc)
  function roundRectPts(x0, x1, y0, y1, r, na) {
    r = Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2));
    if (r <= 0) return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
    var p = [];
    Array.prototype.push.apply(p, arcPts(x1 - r, y0 + r, r, -90, 0, na));
    Array.prototype.push.apply(p, arcPts(x1 - r, y1 - r, r, 0, 90, na));
    Array.prototype.push.apply(p, arcPts(x0 + r, y1 - r, r, 90, 180, na));
    Array.prototype.push.apply(p, arcPts(x0 + r, y0 + r, r, 180, 270, na));
    return p;
  }

  // ── per-shape geometry → { outer, inner, dims, W, H, iW, iH, outerOutline, innerOutline } ──
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
      return { outer: outer, inner: inner, dims: dims, W: D, H: D, iW: inner ? D - 2 * tw : 0, iH: inner ? D - 2 * tw : 0,
        innerBox: inner ? { x0: -(R - tw), x1: R - tw, y0: cy - (R - tw), y1: cy + (R - tw) } : null,
        outerOutline: circlePts(0, cy, R, 48), innerOutline: inner ? circlePts(0, cy, R - tw, 48) : [] };
    }

    if (shape === "rect") {
      var H = num(p.H), B = num(p.B), twl = num(p.twl), twr = num(p.twr), tf1 = num(p.tf1), tf2 = num(p.tf2),
        ha = num(p.ha), hb = num(p.hb);
      off = Math.max(H, B) * 0.12;
      var xo0 = -B / 2, xo1 = B / 2;
      var outerV = [[xo0, 0], [xo1, 0], [xo1, H], [xo0, H]];
      var outer = { lines: polyLines(outerV), arcs: [] };
      var ix0 = xo0 + twl, ix1 = xo1 - twr, iy0 = tf2, iy1 = H - tf1, innerV = null;
      var inner = null;
      if (hollow && ix1 > ix0 && iy1 > iy0) {
        // inner void: chamfered corners (내부 헌치) with legs ha (horizontal) / hb (vertical)
        var cha = Math.max(0, Math.min(ha, (ix1 - ix0) / 2)), chb = Math.max(0, Math.min(hb, (iy1 - iy0) / 2));
        innerV = (cha > 0 && chb > 0)
          ? [[ix0 + cha, iy0], [ix1 - cha, iy0], [ix1, iy0 + chb], [ix1, iy1 - chb],
             [ix1 - cha, iy1], [ix0 + cha, iy1], [ix0, iy1 - chb], [ix0, iy0 + chb]]
          : [[ix0, iy0], [ix1, iy0], [ix1, iy1], [ix0, iy1]];
        inner = { lines: polyLines(innerV), arcs: [], cha: cha, chb: chb, box: [ix0, ix1, iy0, iy1] };
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
      return { outer: outer, inner: inner, dims: dims, W: B, H: H,
        iW: inner ? ix1 - ix0 : 0, iH: inner ? iy1 - iy0 : 0,
        innerBox: inner ? { x0: ix0, x1: ix1, y0: iy0, y1: iy1 } : null,
        outerOutline: ptsOf(outerV), innerOutline: innerV ? ptsOf(innerV) : [] };
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
      return { outer: outer, inner: inner, dims: dims, W: tB, H: tH,
        iW: inner ? tB - 2 * tt : 0, iH: inner ? tH - 2 * tt : 0,
        innerBox: inner ? { x0: -(tB / 2 - tt), x1: tB / 2 - tt, y0: tt, y1: tH - tt } : null,
        outerOutline: roundRectPts(-tB / 2, tB / 2, 0, tH, tR, 6),
        innerOutline: inner ? roundRectPts(-tB / 2 + tt, tB / 2 - tt, tt, tH - tt, tR - tt, 6) : [] };
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
      var inner = null, octIV = null;
      if (hollow) {
        var t = num(p.t);
        var IV = offsetPoly(V, t);
        var okInner = IV.every(function (q) { return isFinite(q[0]) && isFinite(q[1]); });
        if (okInner && t > 0) { inner = { lines: polyLines(IV), arcs: [] }; octIV = IV; }
      }
      dims.push({ x1: oB / 2, y1: 0, x2: oB / 2, y2: oH, gap: -off * 1.8, t: "H" });   // right vertical → right
      dims.push({ x1: -oB / 2, y1: oH, x2: oB / 2, y2: oH, gap: off * 1.8, t: "B" });   // top → up
      dims.push({ x1: oB / 2 - oa, y1: oH, x2: oB / 2, y2: oH, gap: off * 0.7, t: "a" });   // top → up
      dims.push({ x1: oB / 2, y1: oH - ob, x2: oB / 2, y2: oH, gap: -off * 0.7, t: "b" });  // right vertical → right
      if (inner) dims.push({ x1: -oB / 2, y1: oH / 2, x2: -oB / 2 + num(p.t), y2: oH / 2, gap: -off * 0.7, t: "t" });  // wall thickness, left
      return { outer: outer, inner: inner, dims: dims, W: oB, H: oH,
        iW: inner ? oB - 2 * num(p.t) : 0, iH: inner ? oH - 2 * num(p.t) : 0,
        innerBox: inner ? { x0: -oB / 2 + num(p.t), x1: oB / 2 - num(p.t), y0: num(p.t), y1: oH - num(p.t) } : null,
        outerOutline: ptsOf(V), innerOutline: octIV ? ptsOf(octIV) : [] };
    }

    return { outer: { lines: [], arcs: [] }, inner: null, dims: [], W: 1, H: 1, iW: 0, iH: 0, innerBox: null, outerOutline: [], innerOutline: [] };
  }

  // ── views (prism of length L) on the shared core ─────────────────────────
  var VIEW = {};   // per-shape current view

  function emitSection(rec, g) {
    function emit(part) {
      if (!part) return;
      part.lines.forEach(function (l) { rec.addLine(0, l.x1, l.y1, l.x2, l.y2, "c"); });
      part.arcs.forEach(function (a) { if (a.a2 - a.a1 >= 360 || (a.a1 === 0 && a.a2 === 360)) rec.addCircle(0, a.x, a.y, a.r, "c"); else rec.addArc(0, a.x, a.y, a.r, a.a1, a.a2, "c"); });
    }
    emit(g.outer); emit(g.inner);
    g.dims.forEach(function (d) {
      if (d.radiusDim) { rec.addDimRadius(0, d.x, d.y, d.r, d.ang, "R="); return; }
      rec.addDimLinear(0, d.x1, d.y1, d.x2, d.y2, d.gap, d.t);
    });
  }
  // plan (top/bottom): width W across x, length L along y (original orientation).
  // The two width-walls project as vertical lines → outer+inner = 4 vertical lines.
  function emitPlan(rec, g, L) {
    var w = g.W / 2, hl = L / 2, off = Math.max(g.W, L) * 0.1;
    rec.addLine(0, -w, -hl, w, -hl, "c"); rec.addLine(0, w, -hl, w, hl, "c");
    rec.addLine(0, w, hl, -w, hl, "c"); rec.addLine(0, -w, hl, -w, -hl, "c");
    if (g.innerBox) { rec.addLine(0, g.innerBox.x0, -hl, g.innerBox.x0, hl, "h"); rec.addLine(0, g.innerBox.x1, -hl, g.innerBox.x1, hl, "h"); }
    rec.addDimLinear(0, -w, hl, w, hl, off, "W");
    rec.addDimLinear(0, w, -hl, w, hl, -off, "L");
  }
  // extruded elevation (left/right/center): length L along x, height across y.
  // The two height-walls (flanges) project as horizontal lines → outer+inner = 4.
  function emitSide(rec, g, L) {
    var hl = L / 2, H = g.H, off = Math.max(g.H, L) * 0.1;
    rec.addLine(0, -hl, 0, hl, 0, "c"); rec.addLine(0, hl, 0, hl, H, "c");
    rec.addLine(0, hl, H, -hl, H, "c"); rec.addLine(0, -hl, H, -hl, 0, "c");
    if (g.innerBox) { rec.addLine(0, -hl, g.innerBox.y0, hl, g.innerBox.y0, "h"); rec.addLine(0, -hl, g.innerBox.y1, hl, g.innerBox.y1, "h"); }
    rec.addDimLinear(0, hl, 0, hl, H, -off, "H");
    rec.addDimLinear(0, -hl, H, hl, H, off, "L");
  }
  function buildView(rec, shape, view, g, L) {
    if (view === "front" || view === "back") emitSection(rec, g);
    else if (view === "top" || view === "bottom") emitPlan(rec, g, L);
    else emitSide(rec, g, L);   // left / right / center
  }

  function setActiveBar(shape, view) {
    var bar = document.getElementById(shape + "-viewbar"); if (!bar) return;
    Array.prototype.forEach.call(bar.querySelectorAll("[data-sview]"), function (b) {
      var on = b.getAttribute("data-sview") === view;
      b.style.background = on ? "#2563eb" : "#eef2f6";
      b.style.color = on ? "#fff" : "#475569";
      b.style.borderColor = on ? "#2563eb" : "#cbd5e1";
    });
  }

  function render2D(shape, view, g, L) {
    var host = document.getElementById("xs_" + shape + "_plot"); if (!host) return;
    if (typeof window.RWSVG === "undefined") return;
    var rec = new window.RWSVG.MockViewer();
    rec.addLayer("c", "#182430", "solid", 1);
    rec.addLayer("h", "#94a3b8", "hidden", 1);
    buildView(rec, shape, view, g, L);
    var W = host.clientWidth || 560, Hpx = Math.max(340, Math.min(560, Math.round(W * 0.72)));
    host.innerHTML = window.RWSVG.renderSVG(rec, W, Hpx);
    var svg = host.querySelector("svg");
    if (svg) window.RWSVG.attachZoomPan(svg);
  }

  // 3D via the existing bim_<sec>_3d.js modules (they loft outlines + expose STL)
  var MOD3D = { rect: "render_rect_3d", circle: "render_circle_3d", track: "render_track_3d", octagon: "render_octagon_3d" };
  var FILE3D = { rect: "bim_rect_3d.js", circle: "bim_circle_3d.js", track: "bim_track_3d.js", octagon: "bim_octagon_3d.js" };
  function G(n) { try { return (0, eval)(n); } catch (e) { return undefined; } }
  function render3d(shape, g, L) {
    var host = document.getElementById("xs_" + shape + "_plot"); if (!host) return;
    var W = host.clientWidth || 560, Hpx = Math.max(340, Math.min(560, Math.round(W * 0.72)));
    host.innerHTML = "";
    var d3 = document.createElement("div"); d3.id = "xs_" + shape + "_3d";
    d3.style.cssText = "width:100%;height:" + Hpx + "px;background:#1a1a2e;position:relative;";
    host.appendChild(d3);
    var geoB = { outerOutline: g.outerOutline, innerOutline: g.innerOutline };
    function go() { var fn = G(MOD3D[shape]); if (typeof fn === "function") fn(d3.id, geoB, geoB, L || Math.max(g.W, g.H)); }
    if (typeof G(MOD3D[shape]) === "function" && typeof THREE !== "undefined") { go(); return; }
    d3.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#889;font-size:14px;">3D loading…</div>';
    var urls = [];
    if (typeof THREE === "undefined") {
      urls.push("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js");
      urls.push("https://unpkg.com/three@0.128.0/examples/js/controls/OrbitControls.js");
    }
    if (typeof G(MOD3D[shape]) !== "function") urls.push("https://macrobim.github.io/macroBIM/" + FILE3D[shape]);
    (function next(i) {
      if (i >= urls.length) { go(); return; }
      var sc = document.createElement("script"); sc.src = urls[i];
      sc.onload = function () { next(i + 1); }; sc.onerror = function () { next(i + 1); };
      document.head.appendChild(sc);
    })(0);
  }

  function renderView(shape) {
    var view = VIEW[shape] || "front";
    setActiveBar(shape, view);
    var g = geo(shape, readParams(shape)), L = readL(shape);
    if (view === "3d") render3d(shape, g, L); else render2D(shape, view, g, L);
  }
  function setview(shape, v) { VIEW[shape] = v; renderView(shape); }

  // direct cross-section render to an arbitrary mount (headless / embedding)
  function draw(shape, mountId, params) {
    var host = document.getElementById(mountId);
    if (!host || typeof window.RWSVG === "undefined") return;
    var rec = new window.RWSVG.MockViewer();
    rec.addLayer("c", "#182430", "solid", 1); rec.addLayer("h", "#94a3b8", "hidden", 1);
    emitSection(rec, geo(shape, params));
    var W = host.clientWidth || 560, Hpx = Math.max(340, Math.min(560, Math.round(W * 0.72)));
    host.innerHTML = window.RWSVG.renderSVG(rec, W, Hpx);
    var svg = host.querySelector("svg");
    if (svg) window.RWSVG.attachZoomPan(svg);
  }

  // ── DOM-driven entry (layout test) ───────────────────────────────────────
  // Inputs by id  xs_<shape>_<var>  and checkbox  xs_<shape>_hollow;
  // preview mounts into  xs_<shape>_plot.
  function readParams(shape) {
    var cfg = SHAPES[shape]; if (!cfg) return {};
    var pfx = "xs_" + shape, params = {};
    cfg.vars.forEach(function (v) {
      var el = document.getElementById(pfx + "_" + v[0]);
      var val = el ? parseFloat(el.value) : v[2];
      params[v[0]] = isNaN(val) ? v[2] : val;
    });
    var hc = document.getElementById(pfx + "_hollow");
    params.hollow = hc ? hc.checked : true;
    return params;
  }
  function readL(shape) {
    var el = document.getElementById("xs_" + shape + "_L"), v = el ? parseFloat(el.value) : NaN;
    return isNaN(v) || v <= 0 ? 3000 : v;
  }
  function mount(shape) { if (SHAPES[shape]) renderView(shape); }
  function install(shape) {
    window["fdraw_" + shape] = function () { mount(shape); };
    window[shape + "_setview"] = function (v) { setview(shape, v); };
  }

  // Batch (CSV) → input fields, in variable order, optional trailing hollow flag.
  function applyBatch(shape) {
    var cfg = SHAPES[shape]; if (!cfg) return;
    var ta = document.getElementById("xs_" + shape + "_batch"); if (!ta) return;
    var vals = ta.value.split(/[,\s]+/).filter(function (s) { return s !== ""; });
    var pfx = "xs_" + shape;
    cfg.vars.forEach(function (v, i) {
      if (i < vals.length && !isNaN(parseFloat(vals[i]))) {
        var el = document.getElementById(pfx + "_" + v[0]); if (el) el.value = parseFloat(vals[i]);
      }
    });
    if (vals.length > cfg.vars.length) {
      var hc = document.getElementById(pfx + "_hollow"), f = vals[cfg.vars.length];
      if (hc) hc.checked = !(f === "0" || f.toLowerCase() === "false" || f.toLowerCase() === "n");
    }
    mount(shape);
  }

  // ── DXF export (minimal ASCII DXF; model coords are already y-up) ──────────
  // Lays out multiple views: cross-section (front) + plan (top, W×L) + elevation
  // (side, L×H), so the DXF matches the on-screen view set.
  function toDXF(shape, params, L) {
    var g = geo(shape, params), e = ["0", "SECTION", "2", "ENTITIES"];
    function n(v) { return String(Math.round(v * 1000) / 1000); }
    function line(x1, y1, x2, y2) { e.push("0", "LINE", "8", "0", "10", n(x1), "20", n(y1), "30", "0", "11", n(x2), "21", n(y2), "31", "0"); }
    function arc(x, y, r, a1, a2) { e.push("0", "ARC", "8", "0", "10", n(x), "20", n(y), "30", "0", "40", n(r), "50", n(a1), "51", n(a2)); }
    function circle(x, y, r) { e.push("0", "CIRCLE", "8", "0", "10", n(x), "20", n(y), "30", "0", "40", n(r)); }
    function rect(x0, y0, x1, y1) { line(x0, y0, x1, y0); line(x1, y0, x1, y1); line(x1, y1, x0, y1); line(x0, y1, x0, y0); }
    function emit(part, dx, dy) {
      if (!part) return;
      part.lines.forEach(function (l) { line(l.x1 + dx, l.y1 + dy, l.x2 + dx, l.y2 + dy); });
      part.arcs.forEach(function (a) { if (a.a2 - a.a1 >= 360) circle(a.x + dx, a.y + dy, a.r); else arc(a.x + dx, a.y + dy, a.r, a.a1, a.a2); });
    }
    L = L > 0 ? L : Math.max(g.W, g.H);
    var gap = Math.max(g.W, g.H, L) * 0.4, w = g.W / 2, hl = L / 2;
    // 1) cross-section (front) at origin
    emit(g.outer, 0, 0); emit(g.inner, 0, 0);
    // 2) plan (top): width W across x, length L along y — placed above; width-walls → vertical
    var pOy = g.H + gap;
    rect(-w, pOy, w, pOy + L);
    if (g.innerBox) { line(g.innerBox.x0, pOy, g.innerBox.x0, pOy + L); line(g.innerBox.x1, pOy, g.innerBox.x1, pOy + L); }
    // 3) elevation (side): length L across x, height H across y — placed to the right; height-walls → horizontal
    var sOx = w + gap;
    rect(sOx, 0, sOx + L, g.H);
    if (g.innerBox) { line(sOx, g.innerBox.y0, sOx + L, g.innerBox.y0); line(sOx, g.innerBox.y1, sOx + L, g.innerBox.y1); }
    e.push("0", "ENDSEC", "0", "EOF");
    return e.join("\n");
  }
  function dxf(shape) {
    var txt = toDXF(shape, readParams(shape), readL(shape));
    var name = shape.charAt(0).toUpperCase() + shape.slice(1) + ".dxf";
    var blob = new Blob([txt], { type: "application/dxf" });
    var url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    document.body.removeChild(a); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  window.XSECT = { shapes: SHAPES, geo: geo, draw: draw, offsetPoly: offsetPoly, mount: mount, install: install, dxf: dxf, toDXF: toDXF, applyBatch: applyBatch };
})();
