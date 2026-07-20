/*
    bim_pier_test.js — Pier input system (macroBIM Drawings, LAYOUT TEST)
    Single-page, card-based input for MULTIPLE piers. Retaining-wall visual style.
    Entry point: fdraw_pier(mountId)   [default mount: 'mount-draw-pier']

    Page structure (top → bottom):
      1. Piers      — total pier count + per-pier name (P1, P2 …)
      2. Active pier selector (tabs)
      3. Live elevation preview (selected pier) | stacked input cards:
           Coping(두부보) · Columns(기둥) · Foundation(기초)
    Columns pick a section shape (Rectangle / Circle / Track / Octagon — the shapes
    already shipped as bim_rect/circle/track/octagon). Foundation is either one
    combined footing or individual footings per column.
    Pure vanilla JS + inline SVG (no deps). Styles scoped to .pr-root.
    build: v27 (asymmetric cap: TLL/TLR half-widths from pier centre)
*/
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var SHAPES = [["rect", "Rectangle"], ["circle", "Circle"], ["track", "Track"], ["octagon", "Octagon"]];
  // section variables per shape (names match bim_xsect_test.js; column-scale defaults).
  // For non-circle: B = transverse width (front), H = longitudinal depth (side).
  // [name, default, hollowOnly?] — hollowOnly vars only appear when Hollow is checked
  var SECT_VARS = {
    circle: [["D", 2500], ["tw", 250, 1]],
    rect: [["B", 2500], ["H", 2500], ["twl", 300, 1], ["twr", 300, 1], ["tf1", 300, 1], ["tf2", 300, 1], ["ha", 0, 1], ["hb", 0, 1]],
    track: [["B", 4000], ["H", 2500], ["t", 250, 1]],
    octagon: [["B", 2500], ["H", 2500], ["a", 500], ["b", 500], ["t", 250, 1]]
  };
  function sectDefaults(shape) { var o = {}; (SECT_VARS[shape] || []).forEach(function (v) { o[v[0]] = v[1]; }); return o; }
  // transverse width (front view) / longitudinal depth (side view) from the section,
  // accounting for the placement angle Ang (axis-aligned bounding box of the rotated section)
  function colW(col) {
    var s = col.sect || {};
    if (col.shape === "circle") return +s.D || 2500;
    var w = +s.B || 2500, d = +s.H || w, a = (+col.ang || 0) * Math.PI / 180;
    return Math.abs(w * Math.cos(a)) + Math.abs(d * Math.sin(a));
  }
  function colDepth(col) {
    var s = col.sect || {};
    if (col.shape === "circle") return +s.D || 2500;
    var w = +s.B || 2500, d = +s.H || w, a = (+col.ang || 0) * Math.PI / 180;
    return Math.abs(w * Math.sin(a)) + Math.abs(d * Math.cos(a));
  }
  // chamfered-rectangle (octagon) vertices, centred at origin
  function octPts(B, H, a, b) {
    return [[-B / 2 + a, -H / 2], [B / 2 - a, -H / 2], [B / 2, -H / 2 + b], [B / 2, H / 2 - b],
      [B / 2 - a, H / 2], [-B / 2 + a, H / 2], [-B / 2, H / 2 - b], [-B / 2, -H / 2 + b]];
  }
  function rotPts(pts, deg) {
    var a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return pts.map(function (p) { return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; });
  }
  function distinctLevels(vals) { var seen = {}; vals.forEach(function (v) { seen[Math.round(v * 100) / 100] = 1; }); return Object.keys(seen).map(Number); }
  // ── plan-view section outline (x transverse, y longitudinal), centred, rotated by ang ──
  function circPts(R, n) { var p = []; for (var i = 0; i < n; i++) { var a = 2 * Math.PI * i / n; p.push([R * Math.cos(a), R * Math.sin(a)]); } return p; }
  function obroundPts2(sx, r, n) {   // horizontal obround: caps ±sx radius r, centred
    var p = [], i, a;
    for (i = 0; i <= n; i++) { a = (-90 + 180 * i / n) * Math.PI / 180; p.push([sx + r * Math.cos(a), r * Math.sin(a)]); }
    for (i = 0; i <= n; i++) { a = (90 + 180 * i / n) * Math.PI / 180; p.push([-sx + r * Math.cos(a), r * Math.sin(a)]); }
    return p;
  }
  function sectionPts(col) {
    var s = col.sect || {}, shape = col.shape, ang = col.ang || 0, hollow = !!col.hollow;
    var B = +s.B || 2500, H = +s.H || 2500, D = +s.D || 2500, outer, inner = null;
    if (shape === "circle") {
      var R = D / 2, tw = +s.tw || 0; outer = circPts(R, 48);
      if (hollow && tw > 0 && tw < R) inner = circPts(R - tw, 48);
    } else if (shape === "track") {
      var rr = H / 2, sx = Math.max(0, B / 2 - rr), t = +s.t || 0; outer = obroundPts2(sx, rr, 12);
      if (hollow && t > 0 && t < rr) inner = obroundPts2(sx, rr - t, 12);
    } else if (shape === "octagon") {
      var oa = +s.a || 0, ob = +s.b || 0, ot = +s.t || 0; outer = octPts(B, H, oa, ob);
      if (hollow && ot > 0) { var B2 = B - 2 * ot, H2 = H - 2 * ot; if (B2 > 0 && H2 > 0) inner = octPts(B2, H2, Math.min(oa, B2 / 2), Math.min(ob, H2 / 2)); }
    } else {   // rect
      outer = [[-B / 2, -H / 2], [B / 2, -H / 2], [B / 2, H / 2], [-B / 2, H / 2]];
      if (hollow) {
        var twl = +s.twl || 0, twr = +s.twr || 0, tf1 = +s.tf1 || 0, tf2 = +s.tf2 || 0, ha = +s.ha || 0, hb = +s.hb || 0;
        var ix0 = -B / 2 + twl, ix1 = B / 2 - twr, iy0 = -H / 2 + tf2, iy1 = H / 2 - tf1;
        if (ix1 > ix0 && iy1 > iy0) {
          var cha = Math.min(ha, (ix1 - ix0) / 2), chb = Math.min(hb, (iy1 - iy0) / 2);
          inner = (cha > 0 && chb > 0)
            ? [[ix0 + cha, iy0], [ix1 - cha, iy0], [ix1, iy0 + chb], [ix1, iy1 - chb], [ix1 - cha, iy1], [ix0 + cha, iy1], [ix0, iy1 - chb], [ix0, iy0 + chb]]
            : [[ix0, iy0], [ix1, iy0], [ix1, iy1], [ix0, iy1]];
        }
      }
    }
    return { outer: rotPts(outer, ang), inner: inner ? rotPts(inner, ang) : null };
  }
  // draw a closed polyline (points relative to cx,cy) onto rec on the given layer
  function polyOn(rec, pts, cx, cy, lay) {
    for (var i = 0; i < pts.length; i++) { var a = pts[i], b = pts[(i + 1) % pts.length]; rec.addLine(0, cx + a[0], cy + a[1], cx + b[0], cy + b[1], lay); }
  }
  // draw a column section outline at (cx,cy) using true primitives — circle → CIRCLE,
  // (un-rotated) track → LINE+ARC, others → polyline — so exports keep real entities.
  function sectionOn(rec, col, cx, cy, outerLay, innerLay) {
    var s = col.sect || {}, shape = col.shape, hollow = !!col.hollow;
    if (shape === "circle") {
      var R = (+s.D || 2500) / 2, tw = +s.tw || 0;
      rec.addCircle(0, cx, cy, R, outerLay);
      if (hollow && tw > 0 && tw < R) rec.addCircle(0, cx, cy, R - tw, innerLay);
      return;
    }
    if (shape === "track" && !(col.ang || 0)) {
      var B = +s.B || 2500, H = +s.H || 2500, rr = H / 2, sx = Math.max(0, B / 2 - rr), t = +s.t || 0;
      function ob(rad, lay) {
        rec.addLine(0, cx - sx, cy - rad, cx + sx, cy - rad, lay);
        rec.addLine(0, cx + sx, cy + rad, cx - sx, cy + rad, lay);
        rec.addArc(0, cx + sx, cy, rad, -90, 90, lay);
        rec.addArc(0, cx - sx, cy, rad, 90, 270, lay);
      }
      ob(rr, outerLay);
      if (hollow && t > 0 && t < rr) ob(rr - t, innerLay);
      return;
    }
    var sp = sectionPts(col);   // rect / octagon / rotated track
    polyOn(rec, sp.outer, cx, cy, outerLay);
    if (sp.inner) polyOn(rec, sp.inner, cx, cy, innerLay);
  }
  // rounded-rectangle outline drawn on rec (lines + corner arcs), radius r on all corners
  function roundRectOn(rec, x0, x1, y0, y1, r, lay) {
    r = Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2));
    if (r <= 0) { rec.addLine(0, x0, y0, x1, y0, lay); rec.addLine(0, x1, y0, x1, y1, lay); rec.addLine(0, x1, y1, x0, y1, lay); rec.addLine(0, x0, y1, x0, y0, lay); return; }
    rec.addLine(0, x0 + r, y0, x1 - r, y0, lay); rec.addArc(0, x1 - r, y0 + r, r, -90, 0, lay);
    rec.addLine(0, x1, y0 + r, x1, y1 - r, lay); rec.addArc(0, x1 - r, y1 - r, r, 0, 90, lay);
    rec.addLine(0, x1 - r, y1, x0 + r, y1, lay); rec.addArc(0, x0 + r, y1 - r, r, 90, 180, lay);
    rec.addLine(0, x0, y1 - r, x0, y0 + r, lay); rec.addArc(0, x0 + r, y0 + r, r, 180, 270, lay);
  }
  // edge-biased offsets (0..r) for rounded-edge hatch, dense near the silhouette (offset 0)
  function tipHatch(r) {
    var N = 6, G = 1.9, a = [];
    for (var i = 1; i < N; i++) a.push(r * (1 - Math.cos(Math.PI / 2 * Math.pow(i / N, G))));
    return a;
  }

  // ── 3D solid mesh helpers (flat triangle list; x transverse, y longitudinal, z up) ──
  function _tri(T, a, b, c) { T.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); }
  function _quad(T, a, b, c, d) { _tri(T, a, b, c); _tri(T, a, c, d); }
  function _box(T, x0, x1, y0, y1, z0, z1) {
    var v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    _quad(T, v[0], v[3], v[2], v[1]); _quad(T, v[4], v[5], v[6], v[7]);   // bottom, top
    _quad(T, v[0], v[1], v[5], v[4]); _quad(T, v[3], v[7], v[6], v[2]);   // -y, +y
    _quad(T, v[0], v[4], v[7], v[3]); _quad(T, v[1], v[2], v[6], v[5]);   // -x, +x
  }
  // extrude a closed polygon (pts in local x,y, placed at cx,cy) vertically z0..z1
  function _extrudeZ(T, pts, cx, cy, z0, z1) {
    var n = pts.length, sx = 0, sy = 0, i;
    for (i = 0; i < n; i++) { sx += pts[i][0]; sy += pts[i][1]; }
    var gx = cx + sx / n, gy = cy + sy / n;
    for (i = 0; i < n; i++) {
      var a = [cx + pts[i][0], cy + pts[i][1]], b = [cx + pts[(i + 1) % n][0], cy + pts[(i + 1) % n][1]];
      _quad(T, [a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]);   // wall
      _tri(T, [gx, gy, z1], [a[0], a[1], z1], [b[0], b[1], z1]);                          // top cap
      _tri(T, [gx, gy, z0], [b[0], b[1], z0], [a[0], a[1], z0]);                          // bottom cap
    }
  }
  // coping solid: swept along x with y half-width w(x) (CR-rounded tips) and soffit zbot(x).
  // Bearing steps → the coping is built as ONE continuous base at the LOWEST step level,
  // then rectangular step blocks are stacked on top for the higher steps (transverse Δt and
  // per-step longitudinal Δl about the centreline). uniform-THU drops the tip soffit by the
  // base drop so the outer thickness of the base stays constant.
  function _copingMesh(T, cp, maxCH, bstep) {
    var A = copingGeometry(cp).A, TB = +cp.TB || 4000, CR = Math.min(+cp.CR || 0, TB / 2);
    var zTop0 = maxCH + A.yTop;
    var bstOn = !!(bstep && bstep.on && bstep.steps && bstep.steps.length);
    var N = bstOn ? bstep.steps.length : 0, bw = N ? (A.xRtip - A.xLtip) / N : 0, i, j;
    var uni = bstOn && bstep.uniformTHU;
    // per-step top levels (relative to zTop0): front = cumulative Δt, back = front + Δl (+Δl raises back)
    var backLev = [], frontLev = [], minLev = 0, cc = 0;
    for (i = 0; i < N; i++) { cc += (+bstep.steps[i][0] || 0); var dl = +bstep.steps[i][1] || 0; backLev.push(cc + dl); frontLev.push(cc); minLev = Math.min(minLev, cc, cc + dl); }   // +Δl raises the back (−y) half
    var zBase = zTop0 + minLev;                                                              // flat base-coping top
    function wAt(x) {
      if (CR <= 0) return TB / 2;
      var dL = x - A.xLtip, dR = A.xRtip - x, d = Math.min(dL, dR);
      if (d < CR) return TB / 2 - CR + Math.sqrt(Math.max(0, CR * CR - (CR - d) * (CR - d)));
      return TB / 2;
    }
    // soffit control points; uniform-THU drops the tip-level nodes by the base drop (minLev)
    // so the base outer thickness (THU) stays = input; else the soffit is the plain geometry.
    var soff = [[A.xLtip, A.yTip], [A.xLe, A.yTip], [A.xLH, A.yMid], [A.xRH, A.yMid], [A.xRe, A.yTip], [A.xRtip, A.yTip]];
    if (uni) soff = soff.map(function (q) { return Math.abs(q[1] - A.yTip) < 1 ? [q[0], q[1] + minLev] : q; });
    function zbotAt(x) {
      x = Math.max(soff[0][0], Math.min(soff[soff.length - 1][0], x));
      for (var k = 0; k < soff.length - 1; k++) { var a = soff[k], b = soff[k + 1]; if (x <= b[0] + 1e-6) { var t = (b[0] - a[0]) ? (x - a[0]) / (b[0] - a[0]) : 0; return maxCH + a[1] + (b[1] - a[1]) * t; } }
      return maxCH + soff[soff.length - 1][1];
    }
    // x-stations inside [lo,hi]: endpoints + soffit control edges + CR tip sampling
    function stationsIn(lo, hi) {
      var s = [lo, hi], k;
      [A.xLe, A.xLH, A.xRH, A.xRe].forEach(function (x) { if (x > lo + 1 && x < hi - 1) s.push(x); });
      if (CR > 0) for (k = 0; k <= 6; k++) { var xl = A.xLtip + CR * k / 6, xr = A.xRtip - CR * k / 6; if (xl > lo + 1 && xl < hi - 1) s.push(xl); if (xr > lo + 1 && xr < hi - 1) s.push(xr); }
      s = s.filter(function (x) { return x >= lo - 1 && x <= hi + 1; }).sort(function (a, b) { return a - b; });
      var u = []; s.forEach(function (x) { if (!u.length || x - u[u.length - 1] > 1) u.push(x); }); return u;
    }
    // ── base coping: continuous solid, flat top at zBase ──
    var xs = stationsIn(A.xLtip, A.xRtip);
    for (i = 0; i < xs.length - 1; i++) {
      var x0 = xs[i], x1 = xs[i + 1], w0 = wAt(x0), w1 = wAt(x1), b0 = zbotAt(x0), b1 = zbotAt(x1);
      _quad(T, [x0, -w0, zBase], [x0, w0, zBase], [x1, w1, zBase], [x1, -w1, zBase]);        // top (flat)
      _quad(T, [x0, -w0, b0], [x1, -w1, b1], [x1, w1, b1], [x0, w0, b0]);                    // bottom
      _quad(T, [x0, w0, b0], [x0, w0, zBase], [x1, w1, zBase], [x1, w1, b1]);                // +y wall
      _quad(T, [x0, -w0, b0], [x1, -w1, b1], [x1, -w1, zBase], [x0, -w0, zBase]);            // -y wall
    }
    var xa = xs[0], wa = wAt(xa), ba = zbotAt(xa);
    _quad(T, [xa, -wa, ba], [xa, -wa, zBase], [xa, wa, zBase], [xa, wa, ba]);                // left cap
    var xe = xs[xs.length - 1], we = wAt(xe), be = zbotAt(xe);
    _quad(T, [xe, -we, be], [xe, we, be], [xe, we, zBase], [xe, -we, zBase]);                // right cap
    // ── step blocks: stacked on the base top, one per raised segment ──
    if (bstOn) for (i = 0; i < N; i++) {
      var bt = zTop0 + backLev[i], ft = zTop0 + frontLev[i], rb = bt > zBase + 1, rf = ft > zBase + 1;
      if (!rb && !rf) continue;                                                              // segment sits at the base
      var bx0 = A.xLtip + i * bw, bx1 = A.xLtip + (i + 1) * bw, bxs = stationsIn(bx0, bx1);
      for (j = 0; j < bxs.length - 1; j++) {
        var a = bxs[j], b = bxs[j + 1], wa2 = wAt(a), wb2 = wAt(b);
        if (rb) { _quad(T, [a, -wa2, bt], [a, 0, bt], [b, 0, bt], [b, -wb2, bt]); _quad(T, [a, -wa2, zBase], [b, -wb2, zBase], [b, -wb2, bt], [a, -wa2, bt]); }   // back top + −y wall
        if (rf) { _quad(T, [a, 0, ft], [a, wa2, ft], [b, wb2, ft], [b, 0, ft]); _quad(T, [a, wa2, zBase], [a, wa2, ft], [b, wb2, ft], [b, wb2, zBase]); }         // front top + +y wall
        if (Math.abs(ft - bt) > 1e-6) _quad(T, [a, 0, bt], [b, 0, bt], [b, 0, ft], [a, 0, ft]);   // longitudinal riser @ y=0
      }
      var la = bxs[0], lw = wAt(la), ra = bxs[bxs.length - 1], rw = wAt(ra);                 // x-end faces (step risers / tips)
      if (rb) { _quad(T, [la, -lw, zBase], [la, -lw, bt], [la, 0, bt], [la, 0, zBase]); _quad(T, [ra, -rw, zBase], [ra, 0, zBase], [ra, 0, bt], [ra, -rw, bt]); }
      if (rf) { _quad(T, [la, 0, zBase], [la, 0, ft], [la, lw, ft], [la, lw, zBase]); _quad(T, [ra, 0, zBase], [ra, rw, zBase], [ra, rw, ft], [ra, 0, ft]); }
    }
  }
  // triangle list → binary STL ArrayBuffer
  function _stl(T) {
    var n = T.length / 9, buf = new ArrayBuffer(84 + n * 50), dv = new DataView(buf), off = 84, i;
    dv.setUint32(80, n, true);
    for (i = 0; i < n; i++) {
      var o = i * 9, ax = T[o], ay = T[o + 1], az = T[o + 2], bx = T[o + 3], by = T[o + 4], bz = T[o + 5], cx = T[o + 6], cy = T[o + 7], cz = T[o + 8];
      var ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
      var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, L = Math.hypot(nx, ny, nz) || 1;
      dv.setFloat32(off, nx / L, true); dv.setFloat32(off + 4, ny / L, true); dv.setFloat32(off + 8, nz / L, true);
      for (var k = 0; k < 9; k++) dv.setFloat32(off + 12 + k * 4, T[o + k], true);
      dv.setUint16(off + 48, 0, true); off += 50;
    }
    return buf;
  }
  // section edge-lines projected for the elevation. Returns fold levels (visible outer
  // corners) and inner levels (hollow/haunch, hidden), for transverse (x) and longitudinal (y).
  function colFolds(col) {
    var s = col.sect || {}, shape = col.shape, hollow = !!col.hollow, ang = col.ang || 0;
    var B = +s.B || 2500, H = +s.H || 2500, D = +s.D || 2500;
    if (shape === "circle") {
      var R = D / 2, tw = +s.tw || 0, ir = (hollow && tw > 0 && tw < R) ? R - tw : 0;
      return { fx: [], fy: [], ix: ir ? [-ir, ir] : [], iy: ir ? [-ir, ir] : [] };
    }
    if (shape === "track") {
      // obround: caps on L/R (radius H/2), straight top/bottom. Visible outer
      // folds are the straight/arc junctions at x = ±(B/2 - H/2). Hollow inner
      // void silhouette: transverse ±(B/2 - t) (front), longitudinal ±(H/2 - t)
      // (side) — drawn hidden. (These sit inside the outer creases, so they show.)
      var t = +s.t || 0, rr = H / 2, sx = Math.max(0, B / 2 - rr);
      var hollowOK = hollow && t > 0 && t < rr;
      var ixw = B / 2 - t, iyh = H / 2 - t;
      return { fx: sx > 0 ? [-sx, sx] : [], fy: [],
        ix: hollowOK ? [-ixw, ixw] : [], iy: hollowOK ? [-iyh, iyh] : [] };
    }
    var outer, inner = null;
    if (shape === "octagon") {
      var oa = +s.a || 0, ob = +s.b || 0, ot = +s.t || 0; outer = octPts(B, H, oa, ob);
      if (hollow && ot > 0) { var B2 = B - 2 * ot, H2 = H - 2 * ot; if (B2 > 0 && H2 > 0) inner = octPts(B2, H2, Math.min(oa, B2 / 2), Math.min(ob, H2 / 2)); }
    } else { // rect
      outer = [[-B / 2, -H / 2], [B / 2, -H / 2], [B / 2, H / 2], [-B / 2, H / 2]];
      if (hollow) {
        var twl = +s.twl || 0, twr = +s.twr || 0, tf1 = +s.tf1 || 0, tf2 = +s.tf2 || 0, ha = +s.ha || 0, hb = +s.hb || 0;
        var ix0 = -B / 2 + twl, ix1 = B / 2 - twr, iy0 = -H / 2 + tf2, iy1 = H / 2 - tf1;
        if (ix1 > ix0 && iy1 > iy0) {
          var cha = Math.min(ha, (ix1 - ix0) / 2), chb = Math.min(hb, (iy1 - iy0) / 2);
          inner = (cha > 0 && chb > 0)
            ? [[ix0 + cha, iy0], [ix1 - cha, iy0], [ix1, iy0 + chb], [ix1, iy1 - chb], [ix1 - cha, iy1], [ix0 + cha, iy1], [ix0, iy1 - chb], [ix0, iy0 + chb]]
            : [[ix0, iy0], [ix1, iy0], [ix1, iy1], [ix0, iy1]];
        }
      }
    }
    var ro = rotPts(outer, ang), ri = inner ? rotPts(inner, ang) : null;
    var hw = colW(col) / 2, hd = colDepth(col) / 2;
    function inner_(levels, half) { return levels.filter(function (v) { return Math.abs(Math.abs(v) - half) > half * 0.02 + 1; }); }
    return {
      fx: inner_(distinctLevels(ro.map(function (p) { return p[0]; })), hw),
      fy: inner_(distinctLevels(ro.map(function (p) { return p[1]; })), hd),
      ix: ri ? distinctLevels(ri.map(function (p) { return p[0]; })) : [],
      iy: ri ? distinctLevels(ri.map(function (p) { return p[1]; })) : []
    };
  }

  // curved-surface representation lines (모선/generatrix) for the elevation.
  // Returns transverse (front) and longitudinal (side) offsets where a round
  // surface projects, bunched toward the silhouette. Empty for flat sections.
  function curveGens(col) {
    var s = col.sect || {}, shape = col.shape, N = 7, G = 1.9;   // G>1: edge-bias strength (all curved surfaces)
    // full round: lines across (−R..R), bunched toward BOTH ±R silhouettes
    function bRound(R) {
      var a = [];
      for (var i = 1; i < N; i++) {
        var u = i / N, w = 0.5 + 0.5 * Math.sign(u - 0.5) * Math.pow(Math.abs(2 * u - 1), 1 / G);
        a.push(R * Math.cos(Math.PI * w));
      }
      return a;
    }
    if (shape === "circle") { var R = (+s.D || 2500) / 2, g = bRound(R); return { front: g, side: g }; }
    if (shape === "track") {
      // front: two end caps, angle edge-biased toward the ±B/2 silhouette.
      // side: the caps seen end-on = a full round of radius H/2 (same bias).
      var B = +s.B || 2500, H = +s.H || 2500, rr = H / 2, sx = Math.max(0, B / 2 - rr), fg = [];
      for (var i = 1; i < N; i++) { var x = sx + rr * Math.cos(Math.PI / 2 * Math.pow(i / N, G)); fg.push(x); fg.push(-x); }
      return { front: fg, side: bRound(rr) };
    }
    return { front: [], side: [] };
  }

  // latest instance's elevation draw() — for window resize redraw
  var _pierDraw = null, _pierRT = null;
  window.addEventListener("resize", function () { clearTimeout(_pierRT); _pierRT = setTimeout(function () { if (_pierDraw) _pierDraw(); }, 140); });

  // Ensure the shared drawing core (window.RWSVG) is loaded, then run cb.
  // Reuses the same _rwCore* flag/queue as layout_body_test.js (safe to share).
  function ensureCore(cb) {
    if (typeof window.RWSVG !== "undefined") { cb(); return; }
    if (window._rwCoreLoading) { (window._rwCoreCbs = window._rwCoreCbs || []).push(cb); return; }
    window._rwCoreLoading = true; window._rwCoreCbs = [cb];
    var sc = document.createElement("script");
    sc.src = "https://macrobim.github.io/macroBIM/bim_draw_test_core.js?v=6";
    sc.onload = function () { window._rwCoreLoading = false; var q = window._rwCoreCbs || []; window._rwCoreCbs = []; q.forEach(function (f) { f(); }); };
    sc.onerror = function () { window._rwCoreLoading = false; window._rwCoreCbs = []; };
    document.head.appendChild(sc);
  }
  // section-diagram module (bim_xsect_test.js — window.XSECT) for the Guide button
  function ensureXsectMod(cb) {
    ensureCore(function () {
      if (window.XSECT && window.XSECT.draw) { cb(); return; }
      if (window._pierXsLoading) { (window._pierXsCbs = window._pierXsCbs || []).push(cb); return; }
      window._pierXsLoading = true; window._pierXsCbs = [cb];
      var sc = document.createElement("script");
      sc.src = "https://macrobim.github.io/macroBIM/bim_xsect_test.js?v=10";
      sc.onload = function () { window._pierXsLoading = false; var q = window._pierXsCbs || []; window._pierXsCbs = []; q.forEach(function (f) { f(); }); };
      sc.onerror = function () { window._pierXsLoading = false; window._pierXsCbs = []; };
      document.head.appendChild(sc);
    });
  }

  var CSS =
    ".pr-root{--dim:#2563eb;--found:#6e7e8c;--foundfill:#eef2f6;--cope:#1f8e9e;--col:#b4813a;" +
    "--ink:#182430;--muted:#64748b;--line:#cbd5e1;--hair:#e2e8f0;--panel:#fff;--chip:#f1f5f9;--concrete-ln:#aeb9c6;" +
    "font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:var(--ink)}" +
    ".pr-root *{box-sizing:border-box}" +
    ".pr-mono{font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-variant-numeric:tabular-nums}" +
    ".pr-stack{display:flex;flex-direction:column;gap:16px}" +
    ".pr-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:16px;align-items:start}" +
    "@media(max-width:900px){.pr-grid{grid-template-columns:1fr}}" +
    ".pr-col{display:flex;flex-direction:column;gap:16px}" +
    ".pr-card{background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden}" +
    ".pr-hd{display:flex;justify-content:space-between;align-items:center;gap:10px;min-height:43px;padding:9px 14px;border-bottom:1px solid var(--hair);background:var(--chip)}" +
    ".pr-ttl{font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:var(--muted)}" +
    ".pr-sub{font-size:11px;color:var(--muted);font-weight:400;text-transform:none;letter-spacing:0}" +
    ".pr-body{padding:12px 14px}" +
    ".pr-plot{display:block;width:100%;height:auto;cursor:grab;touch-action:none;-webkit-user-select:none;user-select:none;background:" +
    "linear-gradient(var(--hair) 1px,transparent 1px) 0 0/26px 26px,linear-gradient(90deg,var(--hair) 1px,transparent 1px) 0 0/26px 26px;background-color:var(--panel)}" +
    ".pr-plot:active{cursor:grabbing}" +
    ".pr-elev{display:grid;grid-template-columns:1.55fr 1fr;gap:18px;align-items:start}" +
    "@media(max-width:820px){.pr-elev{grid-template-columns:1fr}}" +
    ".pr-elhd{font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);padding:0 0 6px;text-align:center}" +
    ".pr-ingrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:0 28px;align-items:start}" +
    ".pr-crow{display:flex;flex-wrap:wrap;align-items:center;gap:9px 14px;padding:10px 2px;border-bottom:1px dashed var(--hair)}" +
    ".pr-crow .cnm{font-weight:700;font-size:12px;color:var(--col);min-width:78px}" +
    ".pr-fld{display:inline-flex;align-items:center;gap:5px}" +
    ".pr-fld > span{font-size:11px;font-weight:600;color:var(--dim);font-family:ui-monospace,Menlo,Consolas,monospace}" +
    ".pr-fld input{width:78px;text-align:right;padding:4px 7px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink);font-size:12.5px;font-variant-numeric:tabular-nums}" +
    ".pr-fld input:focus{outline:2px solid var(--dim);outline-offset:1px;border-color:var(--dim)}" +
    ".pr-gbtn{font:inherit;font-size:11px;font-weight:600;color:var(--dim);background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:4px 9px;cursor:pointer}" +
    ".pr-gbtn:hover{background:var(--chip)}" +
    ".pr-guide{flex-basis:100%;width:100%;max-width:340px;margin:2px 0 6px;border:1px solid var(--hair);border-radius:8px;overflow:hidden;background:var(--panel)}" +
    ".pr-inrow{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px;padding:5px 0;border-bottom:1px dashed var(--hair)}" +
    ".pr-inrow:last-child{border-bottom:0}" +
    ".pr-inrow label{font-size:13px;display:flex;align-items:baseline;gap:8px}" +
    ".pr-inrow .var{font-weight:600;color:var(--dim);min-width:40px;display:inline-block;font-family:ui-monospace,Menlo,Consolas,monospace}" +
    ".pr-inrow .desc{color:var(--muted);font-size:12px}" +
    ".pr-inrow input[type=number]{width:104px;text-align:right;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink);font-size:13px;font-variant-numeric:tabular-nums}" +
    ".pr-inrow input[type=text]{width:120px;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink);font-size:13px}" +
    ".pr-inrow input:focus,.pr-sel:focus{outline:2px solid var(--dim);outline-offset:1px;border-color:var(--dim)}" +
    ".pr-unit{color:var(--muted);font-size:11px;margin-left:6px}" +
    ".pr-sel{padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink);font-size:13px}" +
    ".pr-tabs{display:flex;flex-wrap:wrap;gap:6px}" +
    ".pr-tab{font:inherit;font-size:12px;font-weight:600;padding:6px 14px;border:1px solid var(--line);border-radius:999px;background:var(--panel);color:var(--muted);cursor:pointer}" +
    ".pr-tab.on{background:var(--dim);border-color:var(--dim);color:#fff;box-shadow:0 1px 3px rgba(37,99,235,.35)}" +
    ".pr-colcard{border:1px solid var(--hair);border-radius:8px;padding:10px 12px;margin-bottom:10px}" +
    ".pr-colcard:last-child{margin-bottom:0}" +
    ".pr-colhd{display:flex;align-items:center;gap:10px;margin-bottom:6px}" +
    ".pr-colhd .cnm{font-weight:700;font-size:12px;color:var(--col)}" +
    ".pr-tbl{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:8px}" +
    ".pr-tbl th{font-size:11px;font-weight:600;color:var(--muted);text-align:right;padding:6px 8px;border-bottom:1px solid var(--line);white-space:nowrap}" +
    ".pr-tbl th:first-child{text-align:left}" +
    ".pr-tbl td{padding:4px 6px;border-bottom:1px dashed var(--hair)}" +
    ".pr-tbl tr:last-child td{border-bottom:0}" +
    ".pr-tbl .rlbl{font-weight:700;font-size:12px;color:var(--col);white-space:nowrap}" +
    ".pr-tbl input{width:118px;text-align:right;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink);font-size:13px;font-variant-numeric:tabular-nums}" +
    ".pr-tbl input[type=text]{text-align:left}" +
    ".pr-tbl input:focus{outline:2px solid var(--dim);outline-offset:1px;border-color:var(--dim)}" +
    ".pr-cap{font-size:11px;color:var(--muted);margin:0 0 10px}" +
    ".pr-subhd{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:16px 0 10px;padding-bottom:5px;border-bottom:1px solid var(--hair)}" +
    ".pr-subhd:first-child{margin-top:0}" +
    ".pr-bapply{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;color:var(--ink);cursor:pointer;margin-bottom:6px}" +
    ".pr-bhd{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:12px 0 8px;font-size:11.5px;font-weight:600;color:var(--dim)}" +
    ".pr-btbl{border-collapse:collapse;margin:2px 0 4px}" +
    ".pr-btbl th{font-size:11px;font-weight:700;color:var(--muted);padding:4px 10px 4px 0;text-align:center}" +
    ".pr-btbl tr>th:first-child{text-align:right;color:var(--dim);min-width:30px}" +
    ".pr-btbl td{padding:3px 5px}" +
    ".pr-btbl input{width:82px;padding:4px 6px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink);font-size:12px;text-align:right;font-variant-numeric:tabular-nums;font-family:ui-monospace,Menlo,Consolas,monospace}" +
    ".pr-btbl input:focus{outline:2px solid var(--dim);outline-offset:1px;border-color:var(--dim)}" +
    ".pr-wcell{display:inline-block;width:82px;text-align:right;padding:4px 6px;color:var(--muted);font-size:12px;font-family:ui-monospace,Menlo,Consolas,monospace;font-variant-numeric:tabular-nums}" +
    ".pr-tbl{width:100%;border-collapse:collapse}" +
    ".pr-tbl th{font-size:10px;font-weight:700;letter-spacing:.03em;color:var(--muted);text-transform:uppercase;padding:6px 8px;text-align:left;border-bottom:1px solid var(--line);white-space:nowrap}" +
    ".pr-tbl td{padding:5px 8px;border-bottom:1px solid var(--hair);vertical-align:middle}" +
    ".pr-tbl tr.on{background:#eff5ff}" +
    ".pr-tin{width:118px;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink);font-size:12px;text-align:right}" +
    ".pr-tin[type=text]{text-align:left}" +
    ".pr-tin:focus{outline:2px solid var(--dim);outline-offset:1px;border-color:var(--dim)}" +
    ".pr-ch{font-family:ui-monospace,Menlo,Consolas,monospace;color:var(--muted);text-align:right;font-variant-numeric:tabular-nums;font-size:12px}" +
    ".pr-tgl{width:118px;font:inherit;font-size:11px;font-weight:700;color:var(--dim);background:var(--chip);border:1px solid var(--line);border-radius:6px;padding:5px 8px;cursor:pointer;white-space:nowrap;text-align:center}" +
    ".pr-del{font:inherit;font-size:15px;color:#b91c1c;background:none;border:none;cursor:pointer;padding:0 4px;line-height:1}" +
    ".pr-glyph{flex:0 0 auto}" +
    ".pr-modes{display:flex;gap:8px;margin-bottom:10px}" +
    ".pr-mode{flex:1;font:inherit;font-size:12px;font-weight:600;text-align:center;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--muted);cursor:pointer}" +
    ".pr-mode.on{background:var(--foundfill);border-color:var(--found);color:var(--found)}" +
    ".pr-stepper{display:flex;align-items:center;gap:6px}" +
    ".pr-step{width:24px;height:24px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink);font-size:14px;font-weight:700;cursor:pointer;line-height:1}" +
    ".pr-step:hover{border-color:var(--dim);color:var(--dim)}" +
    ".pr-cnt{width:48px;text-align:center;padding:3px 5px;border:1px solid var(--line);border-radius:6px;font-size:13px;font-variant-numeric:tabular-nums}" +
    ".pr-names{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}" +
    ".pr-name{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--muted);padding:4px 9px;border:1px solid var(--line);border-radius:8px;cursor:pointer}" +
    ".pr-name.on{border-color:var(--dim);background:rgba(37,99,235,.06)}" +
    ".pr-name .pr-pieridx{min-width:16px;text-align:right}" +
    ".pr-name input{width:76px;padding:4px 7px;border:1px solid var(--line);border-radius:6px;font-size:12px}" +
    ".pr-radio{width:15px;height:15px;border-radius:50%;border:2px solid var(--line);background:var(--panel);cursor:pointer;padding:0;flex:0 0 auto}" +
    ".pr-radio.on{border-color:var(--dim);background:var(--dim);box-shadow:inset 0 0 0 2.5px var(--panel)}" +
    ".pr-btn{font:inherit;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#fff;" +
    "min-width:88px;text-align:center;display:inline-flex;align-items:center;justify-content:center;" +
    "background:var(--dim);border:1px solid var(--dim);border-radius:6px;padding:5px 12px;cursor:pointer;" +
    "box-shadow:0 1px 3px rgba(37,99,235,.35);transition:filter .12s,transform .06s}" +
    ".pr-btn:hover{filter:brightness(1.12)}.pr-btn:active{filter:brightness(.94);transform:translateY(1px)}";

  // ── data model ──────────────────────────────────────────────────────────────
  function newCol() { return { shape: "circle", CH: 8000, CL: 0, ang: 0, hollow: false, sect: sectDefaults("circle") }; }
  function setColShape(col, shape) {
    var d = sectDefaults(shape);
    if (col.sect) for (var k in d) { if (col.sect[k] != null) d[k] = col.sect[k]; }   // keep shared vars
    col.shape = shape; col.sect = d;
  }
  function newPier(name) {
    return {
      name: name,
      // vertical datum by elevation (m): alignment centre / coping top / footing top.
      // Column height is derived: CH = (topEL − copeH) − fdnEL.
      el: { ctr: 100.000, top: 98.500, fdn: 88.000 },
      coping: {
        TLL: 10000, TLR: 10000, TB: 4000, THL: 1250, THU: 1250, HLL: 3250, HLR: 3250,
        HRL: 0, HRR: 0, HEL: 0, HER: 0, HLU: 0, HRU: 0, CR: 0, HD: 0, HW: 0, HS: 0,
        IHLA: 0, IHL: 0, IHH: 0, IHR: 0, IHSR: 0
      },
      colCount: 1, cols: [newCol()],
      fdnMode: "combined",   // combined | individual
      fdnType: "spread",     // spread (직접) | pile (말뚝)
      fdn: { BH: 2000, BLF: 2750, BRF: 2750, FF: 2750, FB: 2750, EFL: 150, EH: 100 },
      // bearing steps on the cap top. One column per step (default 4), laid from the
      // LEFT cap end. Each = [dt, dl]: dt = transverse level step (교축직각, Δt),
      // dl = longitudinal step (교축방향, Δl, front/back). Segment width w is derived
      // = (TLL+TLR)/count (equal division). dt cumulates left→right.
      bstep: {
        on: false,
        steps: [[0, 0], [-160, 0], [-160, 0], [-160, 0]]
      }
    };
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  // coping total height (mm) and derived column height (mm) from the elevation datum
  function copeHmm(p) { return (+p.coping.THU || 0) + (+p.coping.THL || 0); }
  function pierCH(p) { var e = p.el || {}; return Math.max(0, Math.round(((+e.top || 0) - (+e.fdn || 0)) * 1000 - copeHmm(p))); }
  function syncCH(p) { var ch = pierCH(p); p.cols.forEach(function (c) { c.CH = ch; }); }

  // One cantilever haunch as a single circular arc whose CHORD is the straight
  // diagonal A→B (A = tip-flat end, B = haunch root, both fixed by HLL/HLR). Radius R
  // bows the diagonal into a concave soffit (arc bulges up, toward the coping interior).
  // R is clamped to ≥ chord/2. Returns the A→B arc points, centre, and label angle.
  function haunchArcChord(A, B, R) {
    var dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1;
    R = Math.max(R, L / 2 + 1e-6);
    var M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
    var n = [dy / L, -dx / L]; if (n[1] < 0) { n = [-n[0], -n[1]]; }   // perpendicular, pointing up
    var d = Math.sqrt(Math.max(0, R * R - L * L / 4)), C = [M[0] - n[0] * d, M[1] - n[1] * d];  // centre below → arc bulges up
    var a1 = Math.atan2(A[1] - C[1], A[0] - C[0]), a2 = Math.atan2(B[1] - C[1], B[0] - C[0]);
    var dd = a2 - a1; while (dd <= -Math.PI) dd += 2 * Math.PI; while (dd > Math.PI) dd -= 2 * Math.PI;
    var K = 16, pts = [];
    for (var i = 0; i <= K; i++) { var aa = a1 + dd * i / K; pts.push([C[0] + R * Math.cos(aa), C[1] + R * Math.sin(aa)]); }
    return { pts: pts, c: C, ang: (a1 + dd / 2) * 180 / Math.PI };
  }

  // Coping (두부보) geometry from the PDF variable set. Model coords, y-up, centred on x=0.
  //   THU = 외측(tip) thickness; THL = 헌치 높이(haunch rise). top surface y=THU+THL;
  //   central soffit y=0 (deepest, thickness THU+THL); tip soffit y=THL (tip thickness THU).
  //   HEL/HER add a horizontal soffit run at the tip; HLU/HRU batter the tip end.
  //   Haunch soffit: straight diagonal of length HLL/HLR by default; when BOTH HRL (outer)
  //   and HRR (inner-span) are set the diagonal is REPLACED by the reverse arc (haunchArc).
  //   Groove HD/HW/HS at the top-centre.
  // Returns { points[] (closed outline), radiusDims[] (HRL/HRR), A (dim anchors) }.
  function copingGeometry(cp) {
    var TLL = +cp.TLL, TLR = +cp.TLR, THL = +cp.THL, THU = +cp.THU, HLL = +cp.HLL, HLR = +cp.HLR,
      HEL = +cp.HEL || 0, HER = +cp.HER || 0, HLU = +cp.HLU || 0, HRU = +cp.HRU || 0,
      HRL = +cp.HRL || 0, HRR = +cp.HRR || 0, HD = +cp.HD || 0, HW = +cp.HW || 0, HS = +cp.HS || 0;
    // cap half-widths measured from the pier centre (x=0): may be asymmetric (TLL≠TLR)
    var xL = -TLL, xR = TLR, yTop = THU + THL, yTip = THL, yMid = 0;
    // HLU/HRU inset the TOP edge inward (bottom tips stay at the full extent xL/xR)
    var xLtop = xL + HLU, xLtip = xL, xLe = xLtip + HEL, xRtop = xR - HRU, xRtip = xR, xRe = xRtip - HER;
    // one radius per cantilever: HRL → left, HRR → right. The haunch root (xLH/xRH)
    // stays fixed by HLL/HLR; R only bows the diagonal (its chord) into an arc.
    var xLH = xLe + HLL, xRH = xRe - HLR;
    if (xLH > 0) xLH = 0; if (xRH < 0) xRH = 0;
    var leftCurved = (HRL > 0 && THL > 0), rightCurved = (HRR > 0 && THL > 0);
    var pts = [], rad = [], aR = null, aL = null;
    function P(x, y) { pts.push([x, y]); }
    if (rightCurved) { aR = haunchArcChord([xRe, yTip], [xRH, yMid], HRR); rad.push({ c: aR.c, r: HRR, ang: aR.ang, label: "HRR=" }); }
    if (leftCurved) { aL = haunchArcChord([xLe, yTip], [xLH, yMid], HRL); rad.push({ c: aL.c, r: HRL, ang: aL.ang, label: "HRL=" }); }

    P(xLtop, yTop);                                           // top-left (inset by HLU)
    // groove: bottom width HW at depth HD, sides sloped 1:HS → top widens by HD*HS each side
    if (HD > 0 && HW > 0) { var gho = HD * HS; P(-HW / 2 - gho, yTop); P(-HW / 2, yTop - HD); P(HW / 2, yTop - HD); P(HW / 2 + gho, yTop); }
    P(xRtop, yTop);                                           // top-right (inset by HRU)
    P(xRtip, yTip);                                           // right tip bottom (end face height THU)
    if (HER > 0) P(xRe, yTip);                                // right tip flat
    if (rightCurved) { aR.pts.forEach(function (q) { P(q[0], q[1]); }); }   // arc xRe → right root
    else { P(xRH, yMid); }                                    // straight diagonal
    P(xLH, yMid);                                             // central flat → left root
    if (leftCurved) { var rev = aL.pts.slice().reverse(); for (var i = 1; i < rev.length; i++) P(rev[i][0], rev[i][1]); }  // arc left root → xLe
    else { if (HEL > 0) P(xLe, yTip); }
    P(xLtip, yTip);                                           // left tip bottom (close to top-left = end face)

    return {
      points: pts, radiusDims: rad,
      A: { xL: xL, xR: xR, xLtip: xLtip, xRtip: xRtip, xLtop: xLtop, xRtop: xRtop, xLe: xLe, xRe: xRe, xLH: xLH, xRH: xRH,
        yTop: yTop, yTip: yTip, yMid: yMid, THU: THU, THL: THL, HLL: HLL, HLR: HLR, HEL: HEL, HER: HER, HLU: HLU, HRU: HRU }
    };
  }

  // Place linear dims on a single shared gutter per side (left/right verticals to
  // the left/right edge, top horizontals above); no lane splitting. A dim may set an
  // explicit `gutter` (model coord of its dim line) — used to drop HLL/HLR below the
  // coping. Label collisions are handled by the caller via la/lp (label offsets, px).
  // dims: [{side:'L'|'R'|'T'|'B', at, lo, hi, label, gutter?, la?, lp?}]
  //   V (L/R): measures y lo→hi at x=at.   H (T/B): measures x lo→hi at y=at.
  function layoutDims(dims, b) {
    var span = Math.max(b.maxX - b.minX, b.maxY - b.minY) || 1, M = span * 0.05, out = [];
    dims.forEach(function (d) {
      var gut, spec;
      if (d.side === "L") { gut = d.gutter != null ? d.gutter : b.minX - M; spec = { x1: d.at, y1: d.lo, x2: d.at, y2: d.hi, gap: d.at - gut }; }
      else if (d.side === "R") { gut = d.gutter != null ? d.gutter : b.maxX + M; spec = { x1: d.at, y1: d.lo, x2: d.at, y2: d.hi, gap: d.at - gut }; }
      else if (d.side === "T") { gut = d.gutter != null ? d.gutter : b.maxY + M; spec = { x1: d.lo, y1: d.at, x2: d.hi, y2: d.at, gap: gut - d.at }; }
      else { gut = d.gutter != null ? d.gutter : b.minY - M; spec = { x1: d.lo, y1: d.at, x2: d.hi, y2: d.at, gap: gut - d.at }; }
      spec.label = d.label; spec.la = d.la || 0; spec.lp = d.lp || 0;
      out.push(spec);
    });
    return out;
  }

  window.fdraw_pier = function (mountId) {
    var root = document.getElementById(mountId || "mount-draw-pier");
    if (!root) return;

    var S = { piers: [newPier("P1")], sel: 0 };

    root.innerHTML = "<style>" + CSS + "</style><div class='pr-root'><div class='pr-stack' id='pr-stack'></div></div>";
    var stack = root.querySelector("#pr-stack");

    function P() { return S.piers[S.sel]; }
    function el(t, a) { var e = document.createElementNS(NS, t); for (var k in a) e.setAttribute(k, a[k]); return e; }
    function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

    // ── section glyph (mini SVG of the chosen column shape) ──
    function glyph(shape) {
      var s = document.createElementNS(NS, "svg");
      s.setAttribute("width", 30); s.setAttribute("height", 30); s.setAttribute("viewBox", "0 0 30 30"); s.className.baseVal = "pr-glyph";
      var f = "#f6f8fa", st = "var(--col)", n;
      if (shape === "circle") n = el("circle", { cx: 15, cy: 15, r: 11, fill: f, stroke: st, "stroke-width": 1.6 });
      else if (shape === "track") n = el("rect", { x: 3, y: 8, width: 24, height: 14, rx: 7, fill: f, stroke: st, "stroke-width": 1.6 });
      else if (shape === "octagon") n = el("polygon", { points: "10,4 20,4 26,10 26,20 20,26 10,26 4,20 4,10", fill: f, stroke: st, "stroke-width": 1.6 });
      else n = el("rect", { x: 5, y: 6, width: 20, height: 18, fill: f, stroke: st, "stroke-width": 1.6 });
      s.appendChild(n); return s;
    }

    // ── small input helpers ──
    function numRow(vari, desc, val, on, unit, step) {
      var row = h("div", "pr-inrow");
      row.appendChild(h("label", null, "<span class='var'>" + vari + "</span><span class='desc'>" + desc + "</span>"));
      var wrap = h("span"); var inp = h("input"); inp.type = "number"; inp.step = step || "10"; inp.value = val; inp.className = "pr-mono";
      inp.addEventListener("input", function () { var v = parseFloat(inp.value); if (!isNaN(v)) { on(v); draw(); } });
      wrap.appendChild(inp); wrap.appendChild(h("span", "pr-unit", unit || "mm")); row.appendChild(wrap);
      return row;
    }

    // ── card builders ──
    function cardPiers() {
      var c = h("div", "pr-card");
      var hd = h("div", "pr-hd", "<span class='pr-ttl'>Piers <span class='pr-sub'>schedule (EL in m)</span></span>");
      var add = h("button", "pr-btn", "+ Add pier"); add.type = "button"; add.style.minWidth = "auto";
      add.onclick = function () { if (S.piers.length >= 20) return; S.piers.push(newPier("P" + (S.piers.length + 1))); S.sel = S.piers.length - 1; renderAll(); };
      hd.appendChild(add); c.appendChild(hd);
      var b = h("div", "pr-body");
      var tbl = h("table", "pr-tbl");
      tbl.innerHTML = "<thead><tr><th></th><th>Pier</th><th>Alignment EL</th><th>Cap Top EL</th><th>Footing EL</th><th>CH(m)</th><th>Cols</th><th>Footing</th><th></th></tr></thead>";
      var tb = h("tbody");
      S.piers.forEach(function (p, i) {
        var tr = h("tr", i === S.sel ? "on" : "");
        var tdR = h("td"); var rb = h("button", "pr-radio" + (i === S.sel ? " on" : "")); rb.type = "button";
        rb.onclick = function () { S.sel = i; renderAll(); }; tdR.appendChild(rb); tr.appendChild(tdR);
        var tdN = h("td"); var nin = h("input", "pr-tin"); nin.type = "text"; nin.value = p.name;
        nin.oninput = function () { p.name = nin.value; draw(); }; tdN.appendChild(nin); tr.appendChild(tdN);
        var tdCH = h("td", "pr-ch"); tdCH.textContent = (pierCH(p) / 1000).toFixed(3);
        function elCell(key) {
          var td = h("td"); var inp = h("input", "pr-tin pr-mono"); inp.type = "number"; inp.step = "0.001"; inp.value = (+p.el[key]).toFixed(3);
          inp.oninput = function () { var v = parseFloat(inp.value); if (!isNaN(v)) { p.el[key] = v; tdCH.textContent = (pierCH(p) / 1000).toFixed(3); draw(); } };
          td.appendChild(inp); return td;
        }
        tr.appendChild(elCell("ctr")); tr.appendChild(elCell("top")); tr.appendChild(elCell("fdn"));
        tr.appendChild(tdCH);
        var tdC = h("td"); var cin = h("input", "pr-tin pr-mono"); cin.type = "number"; cin.min = 1; cin.max = 8; cin.value = p.colCount;
        cin.onchange = function () { var n = clamp(parseInt(cin.value, 10) || 1, 1, 8); while (p.cols.length < n) p.cols.push(newCol()); if (p.cols.length > n) p.cols.length = n; p.colCount = n; spaceCols(p); renderAll(); };
        tdC.appendChild(cin); tr.appendChild(tdC);
        var tdF = h("td"); var fb = h("button", "pr-tgl"); fb.type = "button"; fb.textContent = p.fdnMode === "combined" ? "Combined" : "Individual";
        fb.onclick = function () { p.fdnMode = p.fdnMode === "combined" ? "individual" : "combined"; fb.textContent = p.fdnMode === "combined" ? "Combined" : "Individual"; if (i === S.sel) renderPerPier(); draw(); };
        tdF.appendChild(fb); tr.appendChild(tdF);
        var tdX = h("td"); if (S.piers.length > 1) { var xb = h("button", "pr-del", "×"); xb.type = "button"; xb.onclick = function () { S.piers.splice(i, 1); if (S.sel >= S.piers.length) S.sel = S.piers.length - 1; renderAll(); }; tdX.appendChild(xb); } tr.appendChild(tdX);
        tb.appendChild(tr);
      });
      tbl.appendChild(tb); b.appendChild(tbl);
      b.appendChild(h("p", "pr-cap", "CH (column height) = Cap Top EL − cap depth (THU+THL) − Footing EL, computed automatically. Click a row to select the active pier; toggle footing mode (combined / individual)."));
      c.appendChild(b); return c;
    }

    function cardCoping() {
      var p = P(), cp = p.coping;
      var c = h("div", "pr-card");
      c.appendChild(h("div", "pr-hd", "<span class='pr-ttl'>Coping <span class='pr-sub'>cap beam</span></span>"));
      var body = h("div", "pr-body");
      body.appendChild(h("div", "pr-subhd", "Geometry"));
      var b = h("div", "pr-ingrid");
      b.appendChild(numRow("TLL", "Cap half-length left (from centre)", cp.TLL, function (v) { cp.TLL = v; }));
      b.appendChild(numRow("TLR", "Cap half-length right (from centre)", cp.TLR, function (v) { cp.TLR = v; }));
      b.appendChild(numRow("TB", "Cap width (longitudinal)", cp.TB, function (v) { cp.TB = v; }));
      b.appendChild(numRow("THL", "Cantilever haunch thickness", cp.THL, function (v) { cp.THL = v; }));
      b.appendChild(numRow("THU", "Cantilever tip thickness", cp.THU, function (v) { cp.THU = v; }));
      b.appendChild(numRow("HLL", "Left cantilever haunch length", cp.HLL, function (v) { cp.HLL = v; }));
      b.appendChild(numRow("HLR", "Right cantilever haunch length", cp.HLR, function (v) { cp.HLR = v; }));
      b.appendChild(numRow("HRL", "Left cantilever haunch arc R", cp.HRL, function (v) { cp.HRL = v; }));
      b.appendChild(numRow("HRR", "Right cantilever haunch arc R", cp.HRR, function (v) { cp.HRR = v; }));
      b.appendChild(numRow("HEL", "Left tip flat length", cp.HEL, function (v) { cp.HEL = v; }));
      b.appendChild(numRow("HER", "Right tip flat length", cp.HER, function (v) { cp.HER = v; }));
      b.appendChild(numRow("HLU", "Left top flat length", cp.HLU, function (v) { cp.HLU = v; }));
      b.appendChild(numRow("HRU", "Right top flat length", cp.HRU, function (v) { cp.HRU = v; }));
      b.appendChild(numRow("CR", "Tip edge round", cp.CR, function (v) { cp.CR = v; }));
      b.appendChild(numRow("HD", "Center groove depth", cp.HD, function (v) { cp.HD = v; }));
      b.appendChild(numRow("HW", "Center groove width", cp.HW, function (v) { cp.HW = v; }));
      b.appendChild(numRow("HS", "Center groove slope", cp.HS, function (v) { cp.HS = v; }, "1:s", "0.1"));
      b.appendChild(numRow("IHLA", "Inner haunch left offset", cp.IHLA, function (v) { cp.IHLA = v; }));
      b.appendChild(numRow("IHL", "Inner haunch left length", cp.IHL, function (v) { cp.IHL = v; }));
      b.appendChild(numRow("IHH", "Inner haunch height", cp.IHH, function (v) { cp.IHH = v; }));
      b.appendChild(numRow("IHR", "Inner haunch radius R", cp.IHR, function (v) { cp.IHR = v; }));
      b.appendChild(numRow("IHSR", "Inner haunch corner R", cp.IHSR, function (v) { cp.IHSR = v; }));
      body.appendChild(b);

      // ── Bearing step ── (checkbox sits in front of the section title)
      var bs = p.bstep || (p.bstep = { on: false, steps: [[0, 0]] });
      if (!bs.steps) bs.steps = [[0, 0], [-160, 0], [-160, 0], [-160, 0]];
      var subhd = h("label", "pr-subhd"); subhd.style.cssText = "display:flex;align-items:center;gap:8px;cursor:pointer";
      var ck = h("input"); ck.type = "checkbox"; ck.checked = !!bs.on; ck.style.cssText = "width:15px;height:15px;accent-color:var(--dim);cursor:pointer";
      ck.addEventListener("change", function () { bs.on = ck.checked; renderPerPier(); draw(); });
      subhd.appendChild(ck); subhd.appendChild(h("span", null, "Bearing step")); body.appendChild(subhd);
      if (bs.on) {
        var ap2 = h("label", "pr-bapply"); ap2.style.marginLeft = "18px";
        var ck2 = h("input"); ck2.type = "checkbox"; ck2.checked = !!bs.uniformTHU; ck2.style.cssText = "width:16px;height:16px;accent-color:var(--dim);cursor:pointer";
        ck2.addEventListener("change", function () { bs.uniformTHU = ck2.checked; draw(); });
        ap2.appendChild(ck2); ap2.appendChild(h("span", null, "Uniform outer thickness (THU fixed → THL adjusts)")); body.appendChild(ap2);
        var wSeg = Math.round(((+cp.TLL || 0) + (+cp.TLR || 0)) / Math.max(1, bs.steps.length));
        var hdr = h("div", "pr-bhd"); hdr.appendChild(h("span", null, ""));   // (label removed; empty span keeps the stepper right-aligned)
        var stp = h("div", "pr-stepper"); var mn = h("button", "pr-step", "−"), cn = h("input", "pr-cnt"), pl = h("button", "pr-step", "+");
        cn.type = "number"; cn.value = bs.steps.length; cn.min = 1; cn.max = 12;
        function setN(n) { n = clamp(n | 0, 1, 12); while (bs.steps.length < n) bs.steps.push([-160, 0]); if (bs.steps.length > n) bs.steps.length = n; renderPerPier(); draw(); }
        mn.onclick = function () { setN(bs.steps.length - 1); }; pl.onclick = function () { setN(bs.steps.length + 1); };
        cn.addEventListener("change", function () { setN(parseInt(cn.value, 10)); });
        stp.appendChild(mn); stp.appendChild(cn); stp.appendChild(pl); hdr.appendChild(stp); body.appendChild(hdr);
        var tbl = h("table", "pr-btbl");
        var hr = h("tr"); hr.appendChild(h("th", null, "")); bs.steps.forEach(function (_, i) { hr.appendChild(h("th", null, String(i + 1))); }); tbl.appendChild(hr);
        // w row (derived, read-only) = (TLL+TLR)/count
        var wr = h("tr"); wr.appendChild(h("th", null, "w")); bs.steps.forEach(function () { var td = h("td"); var s = h("span", "pr-wcell", String(wSeg)); td.appendChild(s); wr.appendChild(td); }); tbl.appendChild(wr);
        bs.steps[0][0] = 0;   // first step is the reference level — Δt fixed at 0 (no input)
        [["Δt", 0], ["Δl", 1]].forEach(function (rd) {
          var tr = h("tr"); tr.appendChild(h("th", null, rd[0]));
          bs.steps.forEach(function (s, i) {
            var td = h("td");
            if (rd[1] === 0 && i === 0) { td.appendChild(h("span", "pr-wcell", "0")); tr.appendChild(td); return; }   // reference Δt, read-only
            var inp = h("input"); inp.type = "number"; inp.step = "10"; inp.value = s[rd[1]];
            inp.oninput = function () { var v = parseFloat(inp.value); if (!isNaN(v)) { s[rd[1]] = v; draw(); } };
            td.appendChild(inp); tr.appendChild(td);
          });
          tbl.appendChild(tr);
        });
        body.appendChild(tbl);
        body.appendChild(h("p", "pr-cap", "w: segment width = (TLL+TLR)/steps (auto) · Δt: transverse level step (step 1 is the reference = 0) · Δl: longitudinal step (front/back, +Δl raises the back). Δt cumulates from the left cap end; + up / − down."));
      }
      c.appendChild(body); return c;
    }

    function cardColumns() {
      var p = P();
      var c = h("div", "pr-card");
      var hd = h("div", "pr-hd", "<span class='pr-ttl'>Columns <span class='pr-sub'>sections</span></span>");
      var stp = h("div", "pr-stepper");
      var minus = h("button", "pr-step", "−"), cnt = h("input", "pr-cnt"), plus = h("button", "pr-step", "+");
      cnt.type = "number"; cnt.value = p.colCount; cnt.min = 1; cnt.max = 8;
      function setCols(n) {
        n = clamp(n | 0, 1, 8);
        while (p.cols.length < n) p.cols.push(newCol());
        if (p.cols.length > n) p.cols.length = n;
        p.colCount = n; spaceCols(p); renderPerPier(); draw();
      }
      minus.onclick = function () { setCols(p.colCount - 1); };
      plus.onclick = function () { setCols(p.colCount + 1); };
      cnt.addEventListener("change", function () { setCols(parseInt(cnt.value, 10)); });
      stp.appendChild(minus); stp.appendChild(cnt); stp.appendChild(plus);
      hd.appendChild(stp); c.appendChild(hd);

      var b = h("div", "pr-body");

      // compact labelled field
      function fld(label, val, on, step) {
        var w = h("span", "pr-fld"); w.appendChild(h("span", null, label));
        var inp = h("input"); inp.type = "number"; inp.step = step || "10"; inp.value = val; inp.className = "pr-mono";
        inp.addEventListener("input", function () { var v = parseFloat(inp.value); if (!isNaN(v)) { on(v); draw(); } });
        w.appendChild(inp); return w;
      }
      function chk(label, val, on) {
        var w = h("span", "pr-fld"); w.appendChild(h("span", null, label));
        var inp = h("input"); inp.type = "checkbox"; inp.checked = !!val;
        inp.style.cssText = "width:16px;height:16px;accent-color:var(--dim);cursor:pointer";
        inp.addEventListener("change", function () { on(inp.checked); draw(); });
        w.appendChild(inp); return w;
      }
      // one row per column: CH · CL · Ang · Section(shape + vars) · Hollow · Guide
      p.cols.forEach(function (col, i) {
        col.sect = col.sect || sectDefaults(col.shape);
        var row = h("div", "pr-crow");
        row.appendChild(h("span", "cnm", "Column " + (i + 1)));
        row.appendChild(fld("CL", col.CL, function (v) { col.CL = v; }, "50"));
        row.appendChild(fld("Ang", col.ang || 0, function (v) { col.ang = v; }, "5"));
        var sel = h("select", "pr-sel");
        SHAPES.forEach(function (s) { var o = h("option"); o.value = s[0]; o.textContent = s[1]; if (col.shape === s[0]) o.selected = true; sel.appendChild(o); });
        sel.addEventListener("change", function () { setColShape(col, sel.value); renderPerPier(); draw(); });
        row.appendChild(sel);
        // section vars — hollow-only vars appear only when Hollow is checked
        (SECT_VARS[col.shape] || []).forEach(function (v) {
          if (v[2] && !col.hollow) return;
          var name = v[0];
          row.appendChild(fld(name, (col.sect[name] != null ? col.sect[name] : v[1]), function (val) { col.sect[name] = val; }));
        });
        row.appendChild(chk("Hollow", col.hollow, function (v) { col.hollow = v; renderPerPier(); }));
        var gbtn = h("button", "pr-gbtn", "&#9635; Guide");
        var guide = h("div", "pr-guide"); guide.style.display = "none"; guide.id = "pr-guide-" + i;
        gbtn.onclick = function () {
          if (guide.style.display !== "none") { guide.style.display = "none"; return; }
          guide.style.display = "block";
          ensureXsectMod(function () {
            if (window.XSECT && window.XSECT.draw) window.XSECT.draw(col.shape, guide.id, Object.assign({ hollow: !!col.hollow }, col.sect));
          });
        };
        row.appendChild(gbtn);
        b.appendChild(row); b.appendChild(guide);
      });
      b.appendChild(h("p", "pr-cap", "Column height (CH) is auto-computed from the schedule EL · CL — transverse position from the pier centre (left −, right +) · Ang — section placement angle (°) · Hollow toggles the wall variables · Guide shows the section diagram."));
      c.appendChild(b); return c;
    }

    function cardFoundation() {
      var p = P(), f = p.fdn;
      var c = h("div", "pr-card");
      c.appendChild(h("div", "pr-hd", "<span class='pr-ttl'>Foundation <span class='pr-sub'>footing</span></span>"));
      var b = h("div", "pr-body");
      p.fdnType = "spread";   // only spread (direct) footing is supported; combined/individual is set in the pier schedule
      var ig = h("div", "pr-ingrid");
      ig.appendChild(numRow("BH", "Footing height", f.BH, function (v) { f.BH = v; }));
      ig.appendChild(numRow("BLF", "Edge to col, left (transv.)", f.BLF, function (v) { f.BLF = v; }));
      ig.appendChild(numRow("BRF", "Edge to col, right (transv.)", f.BRF, function (v) { f.BRF = v; }));
      ig.appendChild(numRow("FF", "Edge to col, left (longit.)", f.FF, function (v) { f.FF = v; }));
      ig.appendChild(numRow("FB", "Edge to col, right (longit.)", f.FB, function (v) { f.FB = v; }));
      ig.appendChild(numRow("EFL", "Blinding projection", f.EFL, function (v) { f.EFL = v; }));
      ig.appendChild(numRow("EH", "Blinding height", f.EH, function (v) { f.EH = v; }));
      b.appendChild(ig);
      c.appendChild(b); return c;
    }

    // ── live elevation preview (selected pier) — front + side in ONE drawing
    // so both share a single scale (same structure height) ──
    var plotHost = null, plotSub = null;
    function cardPreview() {
      var c = h("div", "pr-card");
      var hd = h("div", "pr-hd", "<span class='pr-ttl'>Elevation <span class='pr-sub' data-pr-sub>front + side</span></span>" +
        "<span style='display:inline-flex;gap:6px;flex-wrap:wrap'>" +
        "<button type='button' class='pr-btn' data-pr-3d>3D</button>" +
        "<button type='button' class='pr-btn' data-pr-stl>&#8681; STL</button>" +
        "<button type='button' class='pr-btn' data-pr-dxf>&#8681; DXF</button>" +
        "<button type='button' class='pr-btn' data-pr-regen>&#8635; Regen</button></span>");
      c.appendChild(hd);
      plotSub = hd.querySelector("[data-pr-sub]");
      hd.querySelector("[data-pr-regen]").addEventListener("click", function () { draw(); });
      hd.querySelector("[data-pr-3d]").addEventListener("click", function () { show3D(); });
      hd.querySelector("[data-pr-stl]").addEventListener("click", function () { downloadSTL(); });
      hd.querySelector("[data-pr-dxf]").addEventListener("click", function () { downloadDXF(); });
      var body = h("div", "pr-body");
      plotHost = h("div"); plotHost.style.cssText = "width:100%;overflow:hidden";
      body.appendChild(plotHost); c.appendChild(body);
      return c;
    }

    // model-space bounding box of a MockViewer (mirrors renderSVG's accumulation)
    function bboxOf(rec) {
      var mnX = Infinity, mnY = Infinity, mxX = -Infinity, mxY = -Infinity;
      function acc(x, y) { if (x < mnX) mnX = x; if (x > mxX) mxX = x; if (y < mnY) mnY = y; if (y > mxY) mxY = y; }
      (rec.L || []).forEach(function (l) { acc(l.x1, l.y1); acc(l.x2, l.y2); });
      (rec.A || []).forEach(function (a) { acc(a.x - a.r, a.y - a.r); acc(a.x + a.r, a.y + a.r); });
      (rec.DL || []).forEach(function (d) {
        var len = Math.hypot(d.x2 - d.x1, d.y2 - d.y1) || 1, nx = -(d.y2 - d.y1) / len, ny = (d.x2 - d.x1) / len;
        acc(d.x1, d.y1); acc(d.x2, d.y2); acc(d.x1 + nx * d.gap, d.y1 + ny * d.gap); acc(d.x2 + nx * d.gap, d.y2 + ny * d.gap);
      });
      (rec.DR || []).forEach(function (d) { var rr = d.ang * Math.PI / 180; acc(d.x, d.y); acc(d.x + d.r * Math.cos(rr), d.y + d.r * Math.sin(rr)); });
      (rec.TX || []).forEach(function (t) { acc(t.x, t.y); });
      if (!isFinite(mnX)) { mnX = 0; mxX = 1; mnY = 0; mxY = 1; }
      return { minX: mnX, minY: mnY, maxX: mxX, maxY: mxY };
    }
    // append src's primitives into dst, shifted by (ox,0)
    function mergeOffset(dst, src, ox) { mergeOffsetXY(dst, src, ox, 0); }
    // append src's primitives into dst, shifted by (ox,oy)
    function mergeOffsetXY(dst, src, ox, oy) {
      (src.L || []).forEach(function (l) { dst.L.push({ x1: l.x1 + ox, y1: l.y1 + oy, x2: l.x2 + ox, y2: l.y2 + oy, lay: l.lay, col: l.col }); });
      (src.A || []).forEach(function (a) { dst.A.push({ x: a.x + ox, y: a.y + oy, r: a.r, a1: a.a1, a2: a.a2, lay: a.lay, col: a.col }); });
      (src.DL || []).forEach(function (d) { dst.DL.push({ x1: d.x1 + ox, y1: d.y1 + oy, x2: d.x2 + ox, y2: d.y2 + oy, gap: d.gap, t: d.t, la: d.la, lp: d.lp }); });
      (src.DR || []).forEach(function (d) { dst.DR.push({ x: d.x + ox, y: d.y + oy, r: d.r, ang: d.ang, t: d.t }); });
      (src.TX || []).forEach(function (t) { dst.TX.push({ x: t.x + ox, y: t.y + oy, t: t.t, rot: t.rot }); });
    }

    // Column transverse positions (교축직각방향), measured from the PIER CENTRE (x=0);
    // left is negative, right positive. Values are the per-column CL inputs.
    function colCenters(p) {
      return p.cols.map(function (c) { return +c.CL || 0; });
    }
    // Even-spaced default CLs about the centre; used when the column count changes.
    function spaceCols(p) {
      var N = p.colCount, xLc = -(+p.coping.TLL || 0), xRc = (+p.coping.TLR || 0), pos;
      if (N <= 1) pos = [Math.round((xLc + xRc) / 2 * 10) / 10];
      else {
        var margin = Math.min((xRc - xLc) * 0.2, 3000), lo = xLc + margin, hi = xRc - margin;
        pos = [];
        for (var i = 0; i < N; i++) pos.push(Math.round((lo + (hi - lo) * i / (N - 1)) * 10) / 10);
      }
      p.cols.forEach(function (c, i) { c.CL = pos[i]; });
    }

    // Elevation preview, drawn through the shared core (window.RWSVG): geometry is
    // emitted as KonvaViewer-style primitives, so dims / fonts / zoom-pan match the
    // retaining-wall and section drawings exactly.
    // Compose the full drawing (FRONT + SIDE + coping/footing plans) for the SELECTED
    // pier into one MockViewer. Returns { rec, box }. Reused by draw() and DXF export.
    function composeRec() {
      syncCH(P());   // column heights follow the elevation datum
      var rec = new window.RWSVG.MockViewer();
      rec.addLayer("c", "cyan", "solid", 1); rec.addLayer("h", "gray", "hidden", 1); rec.addLayer("g", "#c2ccd8", "faint", 1);
      buildFront(rec);
      var fbox = bboxOf(rec);
      var sRec = new window.RWSVG.MockViewer();
      sRec.addLayer("c", "cyan", "solid", 1); sRec.addLayer("h", "gray", "hidden", 1); sRec.addLayer("g", "#c2ccd8", "faint", 1);
      buildSide(sRec);
      var sbox = bboxOf(sRec);
      var gap = (fbox.maxY - fbox.minY) * 0.5;
      var ox = fbox.maxX + gap - sbox.minX;
      mergeOffset(rec, sRec, ox);
      var vspan = Math.max(fbox.maxY, sbox.maxY) - Math.min(fbox.minY, sbox.minY);
      var labY = Math.max(fbox.maxY, sbox.maxY) + vspan * 0.11;   // clear the raised coping-top dims (TLL/TLR, TB)
      rec.addText(0, (fbox.minX + fbox.maxX) / 2, labY, "FRONT");
      rec.addText(0, ox + (sbox.minX + sbox.maxX) / 2, labY, "SIDE");
      // plan views: coping plan (top) + footing plan (bottom), aligned on the pier centre line
      var cRec = new window.RWSVG.MockViewer();
      cRec.addLayer("c", "cyan", "solid", 1); cRec.addLayer("h", "gray", "hidden", 1);
      buildCopingPlan(cRec); var cbox = bboxOf(cRec);
      var pRec = new window.RWSVG.MockViewer();
      pRec.addLayer("c", "cyan", "solid", 1); pRec.addLayer("h", "gray", "hidden", 1);
      buildFoundationPlan(pRec); var pbox = bboxOf(pRec);
      var elb = bboxOf(rec);
      var pgap = (elb.maxY - elb.minY) * 0.10;
      var oxCommon = elb.maxX + gap - Math.min(cbox.minX, pbox.minX);
      var oyC = elb.maxY - cbox.maxY;
      mergeOffsetXY(rec, cRec, oxCommon, oyC);
      var oyF = (oyC + cbox.minY) - pgap * 2.4 - pbox.maxY;
      mergeOffsetXY(rec, pRec, oxCommon, oyF);
      rec.addText(0, oxCommon, oyC + cbox.maxY + vspan * 0.11, "COPING PLAN");   // same title gap as FRONT/SIDE
      rec.addText(0, oxCommon, oyF + pbox.maxY + vspan * 0.11, "FOOTING PLAN");
      return { rec: rec, box: bboxOf(rec) };
    }
    function draw() {
      if (!plotHost || !plotHost.isConnected) return;
      if (typeof window.RWSVG === "undefined") { ensureCore(draw); return; }
      var comp = composeRec(), full = comp.box;
      var bw = Math.max(full.maxX - full.minX, 1), bh = Math.max(full.maxY - full.minY, 1);
      var W = plotHost.clientWidth || 1000, s = (W - 80) / bw;
      var Hpx = Math.max(260, Math.min(440, Math.round(bh * s) + 50));
      plotHost.innerHTML = window.RWSVG.renderSVG(comp.rec, W, Hpx);
      var svg = plotHost.querySelector("svg");
      if (svg) window.RWSVG.attachZoomPan(svg);
      var pp = P();
      if (plotSub) plotSub.textContent = pp.name + " · " + pp.colCount + " col · " + (pp.fdnMode === "combined" ? "combined" : "individual") + " · " + (pp.fdnType === "pile" ? "pile" : "spread") + " ftg · EL " + (+pp.el.top).toFixed(3) + "/" + (+pp.el.fdn).toFixed(3) + " (CH " + (pierCH(pp) / 1000).toFixed(3) + "m)";
    }

    var _copingGutY = 0;   // absolute Y of the coping-top dim gutter (set by buildFront, reused by buildSide)
    function buildFront(rec) {
      var p = P(), cp = p.coping, f = p.fdn;
      var cs = colCenters(p);
      var maxCH = Math.max.apply(null, p.cols.map(function (c) { return +c.CH || 0; }).concat([0]));
      function rect(x1, y1, x2, y2) {
        rec.addLine(0, x1, y1, x2, y1, "c"); rec.addLine(0, x2, y1, x2, y2, "c");
        rec.addLine(0, x2, y2, x1, y2, "c"); rec.addLine(0, x1, y2, x1, y1, "c");
      }
      var footMinX = 1e9, footMaxX = -1e9;
      function foot(L, R) {
        rect(L, 0, R, -f.BH);
        var bl = (f.EFL > 0 || f.EH > 0);
        if (bl) rect(L - f.EFL, -f.BH, R + f.EFL, -f.BH - f.EH);
        var lo = bl ? L - f.EFL : L, hi = bl ? R + f.EFL : R;
        if (lo < footMinX) footMinX = lo; if (hi > footMaxX) footMaxX = hi;
      }

      // foundation (combined single footing, or one per column)
      if (p.fdnMode === "combined") {
        var L = cs[0] - colW(p.cols[0]) / 2 - f.BLF, R = cs[cs.length - 1] + colW(p.cols[p.cols.length - 1]) / 2 + f.BRF;
        foot(L, R);
      } else {
        p.cols.forEach(function (col, i) { foot(cs[i] - colW(col) / 2 - f.BLF, cs[i] + colW(col) / 2 + f.BRF); });
      }
      // columns — hung from the coping soffit (z=maxCH) DOWN by CH, so tops always
      // meet the coping. CH<=0 → no column. Silhouette + section edge-lines.
      p.cols.forEach(function (col, i) {
        var cx = cs[i], w = colW(col), cH = +col.CH || 0;
        if (cH <= 0) return;
        var cB = maxCH - cH;
        rect(cx - w / 2, cB, cx + w / 2, maxCH);
        var fd = colFolds(col);
        curveGens(col).front.forEach(function (x) { rec.addLine(0, cx + x, cB, cx + x, maxCH, "g"); });
        fd.fx.forEach(function (x) { rec.addLine(0, cx + x, cB, cx + x, maxCH, "c"); });
        fd.ix.forEach(function (x) { rec.addLine(0, cx + x, cB, cx + x, maxCH, "h"); });
      });
      // coping outline. Built from geometry first; if bearing steps are on, the FLAT
      // top edge is replaced by the stepped top (Δt cumulates from the LEFT cap end,
      // so a run of − / + steps lowers / raises the right end). The soffit/tips are
      // untouched, so the cap itself is re-shaped — no separate block is stuck on top.
      var geo = copingGeometry(cp), A = geo.A;
      var bstOn = p.bstep && p.bstep.on && p.bstep.steps && p.bstep.steps.length, outline = geo.points;
      var frontDl = [];   // Δl front/back top edges. +Δl raises the BACK (far) half. The outline
                          // follows the higher edge; the lower edge shows as an interior line — solid
                          // when it's the near/front face (+Δl), dashed when the hidden back (−Δl).
      if (bstOn) {
        var N = p.bstep.steps.length, bw = ((+cp.TLL || 0) + (+cp.TLR || 0)) / N, cum = 0, top = [], bi;
        var cumDt = function (x) { var i = Math.max(0, Math.min(N - 1, Math.floor((x - A.xLtip) / bw + 1e-6))), c = 0, k; for (k = 0; k <= i; k++) c += (+p.bstep.steps[k][0] || 0); return c; };
        for (bi = 0; bi < N; bi++) {
          cum += (+p.bstep.steps[bi][0] || 0);
          var lb = A.yTop + cum, dl = +p.bstep.steps[bi][1] || 0;         // front-top (reference) / longitudinal offset (back = lb+Δl)
          var he = lb + Math.max(0, dl), lo = lb + Math.min(0, dl);       // envelope (outline) / other edge
          var x0 = A.xLtip + bi * bw, x1 = A.xLtip + (bi + 1) * bw;
          top.push([x0, he], [x1, he]);
          if (Math.abs(dl) > 1) frontDl.push({ x0: x0, x1: x1, z: lo, lay: dl > 0 ? "c" : "h" });   // +Δl: back higher → near/front edge is visible (solid); −Δl: back lower → hidden (dashed)
        }
        var lastTop = 0; for (bi = 0; bi < geo.points.length; bi++) { if (Math.abs(geo.points[bi][1] - A.yTop) < 1) lastTop = bi; }
        var bloop = geo.points.slice(lastTop + 1);
        // uniform-THU: keep the tip thickness constant by dropping the tip-soffit (yTip
        // level) by the same step as the top; the haunch to the fixed central block
        // absorbs it (THL varies). Off → soffit stays, THU varies.
        if (p.bstep.uniformTHU) bloop = bloop.map(function (q) { return Math.abs(q[1] - A.yTip) < 1 ? [q[0], q[1] + cumDt(q[0])] : q; });
        outline = top.concat(bloop);
      }
      var op = outline.map(function (q) { return [q[0], q[1] + maxCH]; });
      for (var i = 0; i < op.length; i++) { var a = op[i], b = op[(i + 1) % op.length]; rec.addLine(0, a[0], a[1], b[0], b[1], "c"); }
      frontDl.forEach(function (e) { rec.addLine(0, e.x0, e.z + maxCH, e.x1, e.z + maxCH, e.lay); });   // Δl front/back edge
      // CR rounds the tip vertical edges → curved-surface hatch on the tip end faces
      var CRf = Math.min(+cp.CR || 0, (+cp.TB || 4000) / 2);
      if (CRf > 0) {
        tipHatch(CRf).forEach(function (o) {
          rec.addLine(0, A.xLtip + o, maxCH + A.yTip, A.xLtip + o, maxCH + A.yTop, "g");
          rec.addLine(0, A.xRtip - o, maxCH + A.yTip, A.xRtip - o, maxCH + A.yTop, "g");
        });
      }

      // ---- dimensions, aligned to shared gutters (L/R verticals, T/B horizontals) ----
      var TLL = +cp.TLL || 0, TLR = +cp.TLR || 0, x0f = cs[0] - colW(p.cols[0]) / 2, xFL = cs[0] - colW(p.cols[0]) / 2 - f.BLF;
      var bnd = {
        minX: Math.min(-TLL, footMinX), maxX: Math.max(TLR, footMaxX),
        minY: -f.BH - (f.EH > 0 ? f.EH : 0), maxY: maxCH + A.yTop
      };
      // coping-bottom dim line (HLL/HLR/HEL/HER) sits just below the cantilever soffit
      var cbY = maxCH - Math.max(700, maxCH * 0.14);
      // top gutters: HLU/HRU on an inner lane, TLL/TLR raised to an outer lane above it
      var spanT = Math.max(bnd.maxX - bnd.minX, bnd.maxY - bnd.minY);
      var topGut = bnd.maxY + spanT * 0.03, tlGut = bnd.maxY + spanT * 0.09;
      _copingGutY = tlGut;   // SIDE reuses this so TB sits on the same coping-top gutter
      // all vertical dims measure at the outer tip x (xLtip/xRtip) so their witness lines
      // stay outside the structure (never cross into it)
      var dims = [
        // half-widths from the pier centre (asymmetric-aware), split at x=0
        { side: "T", at: maxCH + A.yTop, gutter: tlGut, lo: -TLL, hi: 0, label: "TLL" },
        { side: "T", at: maxCH + A.yTop, gutter: tlGut, lo: 0, hi: TLR, label: "TLR" },
        // verticals — single left gutter; THL label flipped to the other side of the line
        { side: "L", at: A.xLtip, lo: maxCH + A.yTip, hi: maxCH + A.yTop, label: "THU" },
        { side: "L", at: A.xLtip, lo: maxCH + A.yMid, hi: maxCH + A.yTip, label: "THL", lp: -24 },
        { side: "L", at: A.xLtip, lo: 0, hi: p.cols[0].CH, label: "CH" },             // column height
        { side: "L", at: A.xLtip, lo: -f.BH, hi: 0, label: "BH" },                    // footing height
        { side: "R", at: A.xRtip, lo: maxCH + A.yTip, hi: maxCH + A.yTop, label: "THU" },
        { side: "R", at: A.xRtip, lo: maxCH + A.yMid, hi: maxCH + A.yTip, label: "THL", lp: -24 },
        // haunch lengths — below the coping (gutter at cbY), labels below the line
        { side: "B", at: maxCH + A.yMid, gutter: cbY, lo: A.xLe, hi: A.xLH, label: "HLL" },
        { side: "B", at: maxCH + A.yMid, gutter: cbY, lo: A.xRH, hi: A.xRe, label: "HLR" }
      ];
      // HEL/HER: tip (연단) horizontal soffit length — dimensioned below the coping (labels flipped up)
      if (A.HEL > 0) dims.push({ side: "B", at: maxCH + A.yTip, gutter: cbY, lo: A.xLtip, hi: A.xLe, label: "HEL", lp: -22 });
      if (A.HER > 0) dims.push({ side: "B", at: maxCH + A.yTip, gutter: cbY, lo: A.xRe, hi: A.xRtip, label: "HER", lp: -22 });
      // HLU/HRU: top-edge inset horizontal length — dimensioned at the top (inner lane, below TLL/TLR)
      if (A.HLU > 0) dims.push({ side: "T", at: maxCH + A.yTop, gutter: topGut, lo: A.xLtip, hi: A.xLtop, label: "HLU" });
      if (A.HRU > 0) dims.push({ side: "T", at: maxCH + A.yTop, gutter: topGut, lo: A.xRtop, hi: A.xRtip, label: "HRU" });
      // central groove dims: HD (left vertical), HW (bottom horizontal), 1:s slope text on the face
      if (cp.HD > 0 && cp.HW > 0) {
        var gT = maxCH + A.yTop, gB = gT - cp.HD, gO = cp.HW / 2 + cp.HD * cp.HS, goff = spanT * 0.03;
        dims.push({ side: "L", at: -gO, gutter: -gO - goff, lo: gB, hi: gT, label: "HD" });
        dims.push({ side: "B", at: gB, gutter: gB - goff, lo: -cp.HW / 2, hi: cp.HW / 2, label: "HW" });
        if (cp.HS > 0 && rec.addText) {
          var srot = Math.atan2(-cp.HD, cp.HD * cp.HS) * 180 / Math.PI;
          var sL = Math.hypot(cp.HD * cp.HS, cp.HD) || 1, sOff = Math.max(260, cp.HD * 0.5);
          var spx = cp.HD / sL, spy = -cp.HD * cp.HS / sL;   // perpendicular, outward/below the slope face
          rec.addText(0, cp.HW / 2 + cp.HD * cp.HS / 2 + spx * sOff, gT - cp.HD / 2 + spy * sOff, "1:" + cp.HS, srot);
        }
      }
      layoutDims(dims, bnd).forEach(function (d) { rec.addDimLinear(0, d.x1, d.y1, d.x2, d.y2, d.gap, d.label, { la: d.la, lp: d.lp }); });
      // curved-soffit radius dims (HRL outer / HRR inner) when set
      geo.radiusDims.forEach(function (rd) { rec.addDimRadius(0, rd.c[0], rd.c[1] + maxCH, rd.r, rd.ang, rd.label); });
    }

    // Side elevation (측면도) — longitudinal (교축방향) view: cap TB wide, columns
    // superimposed at the longitudinal centre, footing spanning FF/FB about the columns.
    function buildSide(rec) {
      var p = P(), cp = p.coping, f = p.fdn;
      var maxCH = Math.max.apply(null, p.cols.map(function (c) { return +c.CH || 0; }).concat([0]));
      var TB = +cp.TB || 4000, THU = +cp.THU || 0, THL = +cp.THL || 0, copeH = THU + THL;   // upper + lower
      var colDep = Math.max.apply(null, p.cols.map(function (c) { return colDepth(c); }).concat([500]));

      function rect(x1, y1, x2, y2) {
        rec.addLine(0, x1, y1, x2, y1, "c"); rec.addLine(0, x2, y1, x2, y2, "c");
        rec.addLine(0, x2, y2, x1, y2, "c"); rec.addLine(0, x1, y2, x1, y1, "c");
      }
      // footing (longitudinal): colDep + FF (front) + FB (back)
      var footL = -(colDep / 2 + (+f.FF || 0)), footR = colDep / 2 + (+f.FB || 0);
      rect(footL, -f.BH, footR, 0);
      var bl = (f.EFL > 0 || f.EH > 0);
      if (bl) rect(footL - f.EFL, -f.BH - f.EH, footR + f.EFL, -f.BH);
      // columns superimpose to one shaft at the longitudinal centre; section edge-lines
      // from the deepest column (longitudinal projection)
      // columns superimpose to one shaft (foundation → coping soffit); skip if no column
      if (maxCH > 0) {
        rect(-colDep / 2, 0, colDep / 2, maxCH);
        var rep = p.cols.reduce(function (a, c) { return colDepth(c) > colDepth(a) ? c : a; }, p.cols[0]);
        var fdS = colFolds(rep);
        curveGens(rep).side.forEach(function (y) { rec.addLine(0, y, 0, y, maxCH, "g"); });
        fdS.fy.forEach(function (y) { rec.addLine(0, y, 0, y, maxCH, "c"); });
        fdS.iy.forEach(function (y) { rec.addLine(0, y, 0, y, maxCH, "h"); });
      }
      // coping: TB wide × copeH. Each transverse step projects here as a horizontal
      // top line at its own level (back half from cumulative Δt, front half += Δl), so
      // the side view reads every step height. No steps → a single flat top.
      var base = maxCH + copeH, topMax = base;
      var bstS = (p.bstep && p.bstep.on && p.bstep.steps && p.bstep.steps.length) ? p.bstep.steps : null;
      function _uniq(a) { var r = []; a.forEach(function (v) { if (!r.some(function (u) { return Math.abs(u - v) < 1; })) r.push(v); }); return r.sort(function (x, y) { return x - y; }); }
      if (bstS) {
        var cumT = 0, backL = [], frontL = [], hasDl = false;
        for (var si = 0; si < bstS.length; si++) { cumT += (+bstS[si][0] || 0); var lb = base + cumT, dl = +bstS[si][1] || 0; backL.push(lb + dl); frontL.push(lb); if (Math.abs(dl) > 1) hasDl = true; }   // +Δl raises the back (−y) half
        backL = _uniq(backL); frontL = _uniq(frontL);
        var maxB = backL[backL.length - 1], maxF = frontL[frontL.length - 1];
        var minTop = Math.min(backL[0], frontL[0]); topMax = Math.max(maxB, maxF);
        rec.addLine(0, -TB / 2, maxCH, -TB / 2, maxB, "c");                                  // back wall
        rec.addLine(0, TB / 2, maxCH, TB / 2, maxF, "c");                                    // front wall
        backL.forEach(function (z) { rec.addLine(0, -TB / 2, z, 0, z, "c"); });              // back-half step tops
        frontL.forEach(function (z) { rec.addLine(0, 0, z, TB / 2, z, "c"); });              // front-half step tops (+Δl)
        if (hasDl) rec.addLine(0, 0, minTop, 0, topMax, "c");                                // longitudinal riser @ centre
      } else {
        rec.addLine(0, -TB / 2, maxCH, -TB / 2, base, "c");                                  // back wall
        rec.addLine(0, -TB / 2, base, TB / 2, base, "c");                                    // flat top
        rec.addLine(0, TB / 2, base, TB / 2, maxCH, "c");                                    // front wall
      }
      rec.addLine(0, TB / 2, maxCH, -TB / 2, maxCH, "c");                                    // bottom
      if (THU > 0 && THL > 0) rec.addLine(0, -TB / 2, maxCH + THL, TB / 2, maxCH + THL, "c");   // THU/THL split
      // CR rounds the tip vertical edges → seen end-on here as curved-surface hatch
      // near the coping's ±TB/2 edges
      var CRs = Math.min(+cp.CR || 0, TB / 2);
      if (CRs > 0) {
        tipHatch(CRs).forEach(function (o) {
          rec.addLine(0, TB / 2 - o, maxCH, TB / 2 - o, maxCH + copeH, "g");
          rec.addLine(0, -TB / 2 + o, maxCH, -TB / 2 + o, maxCH + copeH, "g");
        });
      }

      var footLo = bl ? footL - f.EFL : footL, footHi = bl ? footR + f.EFL : footR;
      var bnd = { minX: Math.min(-TB / 2, footLo), maxX: Math.max(TB / 2, footHi), minY: -f.BH - (f.EH > 0 ? f.EH : 0), maxY: Math.max(maxCH + copeH, topMax) };
      // all vertical dims share one left anchor → same-length witness lines, stacked on the left
      var xAnc = bnd.minX;
      var dims = [
        { side: "T", at: maxCH + copeH, gutter: _copingGutY || undefined, lo: -TB / 2, hi: TB / 2, label: "TB" },
        { side: "L", at: xAnc, lo: maxCH + THL, hi: maxCH + copeH, label: "THU" },
        { side: "L", at: xAnc, lo: maxCH, hi: maxCH + THL, label: "THL", lp: -26 },
        { side: "L", at: xAnc, lo: 0, hi: maxCH, label: "CH" },
        { side: "L", at: xAnc, lo: -f.BH, hi: 0, label: "BH" },
        { side: "B", at: -f.BH, lo: footL, hi: footR, label: "FW" }
      ];
      layoutDims(dims, bnd).forEach(function (d) { rec.addDimLinear(0, d.x1, d.y1, d.x2, d.y2, d.gap, d.label, { la: d.la, lp: d.lp }); });
    }

    // Plan @ coping (top-down): coping footprint (cap length × TB) + central head
    // block edges (xLH..xRH) + column sections where the column tops seat.
    function buildCopingPlan(rec) {
      var p = P(), cp = p.coping, cs = colCenters(p);
      var geo = copingGeometry(cp), A = geo.A, TB = +cp.TB || 4000;
      function rect(x1, y1, x2, y2, lay) { rec.addLine(0, x1, y1, x2, y1, lay); rec.addLine(0, x2, y1, x2, y2, lay); rec.addLine(0, x2, y2, x1, y2, lay); rec.addLine(0, x1, y2, x1, y1, lay); }
      // outer outline is the visible top silhouette → solid; everything under it
      // (head-block soffit edges, column tops) is concealed → hidden (dashed).
      var CRp = Math.min(+cp.CR || 0, TB / 2, (A.xRtip - A.xLtip) / 2);
      if (CRp > 0) roundRectOn(rec, A.xLtip, A.xRtip, -TB / 2, TB / 2, CRp, "c");   // CR rounds the cantilever tips
      else rect(A.xLtip, -TB / 2, A.xRtip, TB / 2, "c");        // coping plan outline (visible)
      // soffit fold edges (hidden): tip-flat/haunch junctions (xLe/xRe, moved by
      // HEL/HER) and the central head-block edges (xLH/xRH).
      if (A.HEL > 0) rec.addLine(0, A.xLe, -TB / 2, A.xLe, TB / 2, "h");
      if (A.HER > 0) rec.addLine(0, A.xRe, -TB / 2, A.xRe, TB / 2, "h");
      rec.addLine(0, A.xLH, -TB / 2, A.xLH, TB / 2, "h");       // central head-block edges (coping soffit)
      rec.addLine(0, A.xRH, -TB / 2, A.xRH, TB / 2, "h");
      // bearing-step edges (visible top-surface risers) — solid
      if (p.bstep && p.bstep.on && p.bstep.steps && p.bstep.steps.length) {
        var Nb = p.bstep.steps.length, bwb = (A.xRtip - A.xLtip) / Nb;
        // transverse (Δt) step boundaries — interior vertical lines
        for (var si = 1; si < Nb; si++) { var xb = A.xLtip + si * bwb; rec.addLine(0, xb, -TB / 2, xb, TB / 2, "c"); }
        // longitudinal (Δl) step riser — horizontal line at the centreline (y=0) over each stepped segment
        for (var sj = 0; sj < Nb; sj++) {
          if (Math.abs(+p.bstep.steps[sj][1] || 0) > 1) { var xa = A.xLtip + sj * bwb, xc = A.xLtip + (sj + 1) * bwb; rec.addLine(0, xa, 0, xc, 0, "c"); }
        }
      }
      p.cols.forEach(function (col, i) { if ((+col.CH || 0) > 0) sectionOn(rec, col, cs[i], 0, "h", "h"); });
      var b = { minX: A.xLtip, maxX: A.xRtip, minY: -TB / 2, maxY: TB / 2 };
      var dims = [
        { side: "R", at: A.xRtip, lo: -TB / 2, hi: TB / 2, label: "TB" },
        { side: "T", at: TB / 2, lo: A.xLtip, hi: A.xRtip, label: "L" }
      ];
      // cantilever soffit lengths along the bottom (same segments as the elevation)
      if (A.HEL > 0) dims.push({ side: "B", at: -TB / 2, lo: A.xLtip, hi: A.xLe, label: "HEL", lp: 16 });
      if (A.HLL > 0) dims.push({ side: "B", at: -TB / 2, lo: A.xLe, hi: A.xLH, label: "HLL" });
      if (A.HLR > 0) dims.push({ side: "B", at: -TB / 2, lo: A.xRH, hi: A.xRe, label: "HLR" });
      if (A.HER > 0) dims.push({ side: "B", at: -TB / 2, lo: A.xRe, hi: A.xRtip, label: "HER", lp: 16 });
      layoutDims(dims, b).forEach(function (d) { rec.addDimLinear(0, d.x1, d.y1, d.x2, d.y2, d.gap, d.label, { la: d.la, lp: d.lp }); });
    }

    // Plan @ footing (top-down): footing footprint (with the lower base slab, ±EFL)
    // + column sections where the column bottoms seat.
    function buildFoundationPlan(rec) {
      var p = P(), f = p.fdn, cs = colCenters(p);
      var colDep = Math.max.apply(null, p.cols.map(function (c) { return colDepth(c); }).concat([500]));
      var yB = -(colDep / 2 + (+f.FF || 0)), yT = colDep / 2 + (+f.FB || 0);
      var bl = (f.EFL > 0 || f.EH > 0), EFL = +f.EFL || 0;
      function rect(x1, y1, x2, y2, lay) { rec.addLine(0, x1, y1, x2, y1, lay); rec.addLine(0, x2, y1, x2, y2, lay); rec.addLine(0, x2, y2, x1, y2, lay); rec.addLine(0, x1, y2, x1, y1, lay); }
      var minX = 1e9, maxX = -1e9;
      function foot(L, R) { rect(L, yB, R, yT, "c"); if (bl) rect(L - EFL, yB - EFL, R + EFL, yT + EFL, "c"); if (L - EFL < minX) minX = L - EFL; if (R + EFL > maxX) maxX = R + EFL; }
      if (p.fdnMode === "combined") {
        foot(cs[0] - colW(p.cols[0]) / 2 - (+f.BLF || 0), cs[cs.length - 1] + colW(p.cols[p.cols.length - 1]) / 2 + (+f.BRF || 0));
      } else {
        p.cols.forEach(function (col, i) { foot(cs[i] - colW(col) / 2 - (+f.BLF || 0), cs[i] + colW(col) / 2 + (+f.BRF || 0)); });
      }
      p.cols.forEach(function (col, i) { if ((+col.CH || 0) > 0) sectionOn(rec, col, cs[i], 0, "c", "h"); });
      var yLo = bl ? yB - EFL : yB, yHi = bl ? yT + EFL : yT;
      var b = { minX: minX, maxX: maxX, minY: yLo, maxY: yHi };
      var dims = [
        { side: "R", at: maxX, lo: yB, hi: yT, label: "FW" },
        { side: "T", at: yHi, lo: minX, hi: maxX, label: "L" }
      ];
      layoutDims(dims, b).forEach(function (d) { rec.addDimLinear(0, d.x1, d.y1, d.x2, d.y2, d.gap, d.label, { la: d.la, lp: d.lp }); });
    }

    // Whole-pier 3D solid mesh (coping + columns + foundation), one triangle list.
    function buildPierMesh() {
      var p = P(), cp = p.coping, f = p.fdn, cs = colCenters(p), T = [];
      syncCH(p);
      var maxCH = Math.max.apply(null, p.cols.map(function (c) { return +c.CH || 0; }).concat([0]));
      p.cols.forEach(function (col, i) { var cH = +col.CH || 0; if (cH <= 0) return; _extrudeZ(T, sectionPts(col).outer, cs[i], 0, maxCH - cH, maxCH); });
      _copingMesh(T, cp, maxCH, p.bstep);
      var colDep = Math.max.apply(null, p.cols.map(function (c) { return colDepth(c); }).concat([500]));
      var yB = -(colDep / 2 + (+f.FF || 0)), yT = colDep / 2 + (+f.FB || 0), EFL = +f.EFL || 0, EH = +f.EH || 0, BH = +f.BH || 0;
      function foot(Lx, Rx) { _box(T, Lx, Rx, yB, yT, -BH, 0); if (EFL > 0 || EH > 0) _box(T, Lx - EFL, Rx + EFL, yB - EFL, yT + EFL, -BH - EH, -BH); }
      if (p.fdnMode === "combined") foot(cs[0] - colW(p.cols[0]) / 2 - (+f.BLF || 0), cs[cs.length - 1] + colW(p.cols[p.cols.length - 1]) / 2 + (+f.BRF || 0));
      else p.cols.forEach(function (col, i) { foot(cs[i] - colW(col) / 2 - (+f.BLF || 0), cs[i] + colW(col) / 2 + (+f.BRF || 0)); });
      return T;
    }
    function downloadSTL() {
      var blob = new Blob([_stl(buildPierMesh())], { type: "application/octet-stream" });
      var url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = (P().name || "pier") + ".stl"; document.body.appendChild(a); a.click();
      document.body.removeChild(a); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }
    function show3D() {
      if (!plotHost) return;
      var Hpx = 460;
      plotHost.innerHTML = "";
      var d3 = h("div"); d3.id = "pr-3d-host"; d3.style.cssText = "width:100%;height:" + Hpx + "px;background:#1a1a2e;border-radius:8px;overflow:hidden";
      plotHost.appendChild(d3);
      window.RWSVG.render3d("pr-3d-host", "render_pier_3d", "https://macrobim.github.io/macroBIM/bim_pier_3d.js?v=1", [buildPierMesh()]);
      if (plotSub) plotSub.textContent = P().name + " · 3D solid (drag to orbit)";
    }

    // DXF of ALL piers laid out left→right in one drawing, spaced apart. Each pier's
    // composed drawing (front + side + plans) is emitted with a per-pier x-offset.
    function pierDXF() {
      var e = ["0", "SECTION", "2", "ENTITIES"], TH = 220;
      function num(v) { return String(Math.round(v * 1000) / 1000); }
      function line(x1, y1, x2, y2, lay) { e.push("0", "LINE", "8", lay, "10", num(x1), "20", num(y1), "30", "0", "11", num(x2), "21", num(y2), "31", "0"); }
      function arc(x, y, r, a1, a2, lay) { e.push("0", "ARC", "8", lay, "10", num(x), "20", num(y), "30", "0", "40", num(r), "50", num(a1), "51", num(a2)); }
      function circ(x, y, r, lay) { e.push("0", "CIRCLE", "8", lay, "10", num(x), "20", num(y), "30", "0", "40", num(r)); }
      function txt(x, y, s, hgt, rot, lay) { e.push("0", "TEXT", "8", lay, "10", num(x), "20", num(y), "30", "0", "40", num(hgt), "1", String(s), "50", num(rot || 0)); }
      function emit(rec, dx, dy) {
        (rec.L || []).forEach(function (l) { line(l.x1 + dx, l.y1 + dy, l.x2 + dx, l.y2 + dy, l.lay === "hidden" ? "HIDDEN" : (l.lay === "faint" ? "HATCH" : "PIER")); });
        (rec.A || []).forEach(function (a) { var lay = a.lay === "hidden" ? "HIDDEN" : "PIER", a2 = a.a2 <= a.a1 ? a.a2 + 360 : a.a2; if (a2 - a.a1 >= 360) circ(a.x + dx, a.y + dy, a.r, lay); else arc(a.x + dx, a.y + dy, a.r, a.a1, a.a2, lay); });
        (rec.TX || []).forEach(function (t) { txt(t.x + dx, t.y + dy, t.t, TH, t.rot, "TEXT"); });
        (rec.DL || []).forEach(function (d) {
          var len = Math.hypot(d.x2 - d.x1, d.y2 - d.y1); if (!len) return;
          var nx = -(d.y2 - d.y1) / len, ny = (d.x2 - d.x1) / len;
          var p1x = d.x1 + nx * d.gap, p1y = d.y1 + ny * d.gap, p2x = d.x2 + nx * d.gap, p2y = d.y2 + ny * d.gap;
          line(p1x + dx, p1y + dy, p2x + dx, p2y + dy, "DIM");
          line(d.x1 + dx, d.y1 + dy, p1x + dx, p1y + dy, "DIM"); line(d.x2 + dx, d.y2 + dy, p2x + dx, p2y + dy, "DIM");
          var ang = Math.atan2(p2y - p1y, p2x - p1x) * 180 / Math.PI; if (ang > 90 || ang < -90) ang += 180;
          txt((p1x + p2x) / 2 + dx, (p1y + p2y) / 2 + dy, (d.t ? d.t + "=" : "") + Math.round(len), TH * 0.9, ang, "DIM");
        });
        (rec.DR || []).forEach(function (d) {
          var rx = d.x + d.r * Math.cos(d.ang * Math.PI / 180), ry = d.y + d.r * Math.sin(d.ang * Math.PI / 180);
          line(d.x + dx, d.y + dy, rx + dx, ry + dy, "DIM");
          txt((d.x + rx) / 2 + dx, (d.y + ry) / 2 + dy, (d.t || "R") + Math.round(d.r), TH * 0.9, 0, "DIM");
        });
      }
      var saved = S.sel, ox = 0;
      for (var i = 0; i < S.piers.length; i++) {
        S.sel = i;
        var comp = composeRec(), b = comp.box, w = b.maxX - b.minX, ht = b.maxY - b.minY;
        emit(comp.rec, ox - b.minX, -b.minY);                              // left→ox, bottom→0
        txt(ox + w / 2, -TH * 3, S.piers[i].name, TH * 1.4, 0, "TITLE");   // pier name below
        ox += w + Math.max(6000, ht * 0.45);                              // gap between piers
      }
      S.sel = saved;
      e.push("0", "ENDSEC", "0", "EOF");
      return e.join("\n");
    }
    function downloadDXF() {
      var blob = new Blob([pierDXF()], { type: "application/dxf" });
      var url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = "piers.dxf"; document.body.appendChild(a); a.click();
      document.body.removeChild(a); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }
    _pierDraw = draw;

    // ── render orchestration ──
    var perWrap = h("div", "pr-col");        // right column: Coping/Columns/Foundation
    function renderPerPier() {
      perWrap.innerHTML = "";
      perWrap.appendChild(cardCoping());
      perWrap.appendChild(cardColumns());
      perWrap.appendChild(cardFoundation());
    }
    function renderAll() {
      stack.innerHTML = "";
      stack.appendChild(cardPiers());        // full-width
      stack.appendChild(cardPreview());      // full-width Elevation (front + side)
      renderPerPier();                       // Coping / Columns / Foundation
      stack.appendChild(perWrap);            // each full-width, stacked
      draw();
    }
    renderAll();
  };
})();
