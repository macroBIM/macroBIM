/*
    bim_section_test.js — TEST build for the tapered Begin/End sections
    (rect / circle / track / octagon) in the retaining-wall SVG style.

    A single shared factory renders every view (Front / Back / Left / Center /
    Right / Top / Bottom) as a self-contained SVG (white grid, ink outline, blue
    dims with variable-prefixed values), sized to match the Dimension Input card.
    Front / Back draw the begin / end cross-section; Top/Bottom and Left/Right draw
    the tapered plan / side views. 3D stays on three.js.

    Each section's loader calls window.makeSectionTest('rect' | 'circle' |
    'track' | 'octagon'); that installs window.fdraw_<sec> + window.<sec>_setview,
    overriding the production entry point. Reuses the production geo_<sec> /
    getParams_<sec> / odxf_<sec> / render_<sec>_3d helpers. Loaded on demand by
    layout_body_test.js only — the production modules are unaffected.
*/
(function () {
  "use strict";

  var INK = '#182430', DIM = '#2563eb', HID = '#94a3b8';

  // resolve a global binding by name — reaches top-level const/let/class
  // (global lexical bindings, which are NOT properties of window)
  function G(n) { try { return (0, eval)(n); } catch (e) { return undefined; } }

  // helper: fetch a named point from a geo
  function gpOf(geo) {
    return function (n) {
      var f = geo.points.find(function (p) { return p.name === n; });
      return f ? Object.assign({}, f[n]) : { x: 0, y: 0 };
    };
  }

  // ── per-section configuration ────────────────────────────────────────────
  var SECT = {
    rect: {
      scvs: 'rectplot', v3d: 'rect3d', bar: 'rect-viewbar',
      ddVar: '_rect_drawData', getParams: 'getParams_rect', geo: 'geo_rect',
      odxf: 'odxf_rect', render3d: 'render_rect_3d', mod3d: 'bim_rect_3d.js',
      layers: ['rect_solid', 'rect_hidden', 'rect_center'],
      wLabel: 'B', hLabel: 'H', wLabelIn: 'b', hLabelIn: 'h',
      W: function (a) { return a.drect_B; }, H: function (a) { return a.drect_H; },
      iW: function (a) { return a.drect_b; }, iH: function (a) { return a.drect_h; },
      hollow: function (a) { return a.hollow && a.drect_h > 0 && a.drect_b > 0 && a.drect_h < a.drect_H && a.drect_b < a.drect_B; },
      frontDims: function (a, gp, off, ext) {
        var DL = [], H = a.drect_H, B = a.drect_B;
        DL.push({ x1: B / 2 + off, y1: 0, x2: B / 2 + off, y2: H, gap: ext * -6, t: 'H' });
        DL.push({ x1: -B / 2, y1: -off, x2: B / 2, y2: -off, gap: ext * -6, t: 'B' });
        if (this.hollow(a)) {
          var h = a.drect_h, b = a.drect_b, cy = H / 2;
          DL.push({ x1: B / 2 + off, y1: cy - h / 2, x2: B / 2 + off, y2: cy + h / 2, gap: ext * -3, t: 'h' });
          DL.push({ x1: -b / 2, y1: -off, x2: b / 2, y2: -off, gap: ext * -3, t: 'b' });
        }
        return { DL: DL, DR: [] };
      }
    },
    circle: {
      scvs: 'circleplot', v3d: 'circle3d', bar: 'circle-viewbar',
      ddVar: '_circle_drawData', getParams: 'getParams_circle', geo: 'geo_circle',
      odxf: 'odxf_circle', render3d: 'render_circle_3d', mod3d: 'bim_circle_3d.js',
      layers: ['circle_solid', 'circle_hidden', 'circle_center'],
      wLabel: 'D', hLabel: 'D', wLabelIn: 'd', hLabelIn: 'd',
      W: function (a) { return a.dcircle_D; }, H: function (a) { return a.dcircle_D; },
      iW: function (a) { return a.dcircle_d; }, iH: function (a) { return a.dcircle_d; },
      hollow: function (a) { return a.hollow && a.dcircle_d > 0 && a.dcircle_d < a.dcircle_D; },
      frontDims: function (a, gp, off, ext) {
        var DL = [], D = a.dcircle_D, R = D / 2, cy = D / 2;
        DL.push({ x1: R + off, y1: 0, x2: R + off, y2: D, gap: ext * -6, t: 'D' });
        if (this.hollow(a)) {
          var d = a.dcircle_d;
          DL.push({ x1: R + off, y1: cy - d / 2, x2: R + off, y2: cy + d / 2, gap: ext * -3, t: 'd' });
        }
        return { DL: DL, DR: [] };
      }
    },
    track: {
      scvs: 'trackplot', v3d: 'track3d', bar: 'track-viewbar',
      ddVar: '_track_drawData', getParams: 'getParams_track', geo: 'geo_track',
      odxf: 'odxf_track', render3d: 'render_track_3d', mod3d: 'bim_track_3d.js',
      layers: ['track_solid', 'track_hidden', 'track_center'],
      wLabel: 'B', hLabel: 'D', wLabelIn: 'b', hLabelIn: 'd',
      W: function (a) { return a.dtrack_B; }, H: function (a) { return a.dtrack_D; },
      iW: function (a) { return a.dtrack_B - (a.dtrack_D - a.dtrack_d); }, iH: function (a) { return a.dtrack_d; },
      hollow: function (a) { return a.hollow && a.dtrack_d > 0 && a.dtrack_d < a.dtrack_D && (a.dtrack_B - (a.dtrack_D - a.dtrack_d)) > 0; },
      frontDims: function (a, gp, off, ext) {
        var DL = [], B = a.dtrack_B, D = a.dtrack_D, cy = D / 2;
        DL.push({ x1: B / 2 + off, y1: 0, x2: B / 2 + off, y2: D, gap: ext * -6, t: 'D' });
        DL.push({ x1: -B / 2, y1: -off, x2: B / 2, y2: -off, gap: ext * -6, t: 'B' });
        if (this.hollow(a)) {
          var d = a.dtrack_d;
          DL.push({ x1: B / 2 + off, y1: cy - d / 2, x2: B / 2 + off, y2: cy + d / 2, gap: ext * -3, t: 'd' });
        }
        return { DL: DL, DR: [] };
      }
    },
    octagon: {
      scvs: 'octagonplot', v3d: 'oct3d', bar: 'octagon-viewbar',
      ddVar: '_octagon_drawData', getParams: 'getParams_octagon', geo: 'geo_octagon',
      odxf: 'odxf_octagon', render3d: 'render_octagon_3d', mod3d: 'bim_octagon_3d.js',
      layers: ['oct_solid', 'oct_hidden', 'oct_center'],
      wLabel: 'B', hLabel: 'H', wLabelIn: 'b', hLabelIn: 'h',
      W: function (a) { return a.doct_B1 + 2 * a.doct_B2; }, H: function (a) { return a.doct_H1 + 2 * a.doct_H2; },
      iW: function (a) { return a.doct_b1 + 2 * a.doct_b2; }, iH: function (a) { return a.doct_h1 + 2 * a.doct_h2; },
      hollow: function (a) {
        var iTH = a.doct_h1 + 2 * a.doct_h2, iW = a.doct_b1 + 2 * a.doct_b2;
        var TH = a.doct_H1 + 2 * a.doct_H2, W = a.doct_B1 + 2 * a.doct_B2;
        return a.hollow && a.doct_h1 > 0 && a.doct_b1 > 0 && iTH < TH && iW < W;
      },
      frontDims: function (a, gp, off, ext) {
        var DL = [];
        var p1 = gp('p1'), p2 = gp('p2'), p3 = gp('p3'), p4 = gp('p4'), p5 = gp('p5'), p8 = gp('p8');
        var dimX = p3.x + off * 4, dimY = -off * 4;
        // right side: H2, H1, H2 (bottom→top)
        DL.push({ x1: dimX, y1: p2.y, x2: dimX, y2: p3.y, gap: ext * -6, t: 'H2' });
        DL.push({ x1: dimX, y1: p3.y, x2: dimX, y2: p4.y, gap: ext * -6, t: 'H1' });
        DL.push({ x1: dimX, y1: p4.y, x2: dimX, y2: p5.y, gap: ext * -6, t: 'H2' });
        // bottom: B2, B1, B2 (left→right)
        DL.push({ x1: p8.x, y1: dimY, x2: p1.x, y2: dimY, gap: ext * -6, t: 'B2' });
        DL.push({ x1: p1.x, y1: dimY, x2: p2.x, y2: dimY, gap: ext * -6, t: 'B1' });
        DL.push({ x1: p2.x, y1: dimY, x2: p3.x, y2: dimY, gap: ext * -6, t: 'B2' });
        if (this.hollow(a)) {
          var i1 = gp('i1'), i2 = gp('i2'), i3 = gp('i3'), i4 = gp('i4'), i5 = gp('i5'), i8 = gp('i8');
          var idimX = p3.x + off, idimY = -off;
          DL.push({ x1: idimX, y1: i2.y, x2: idimX, y2: i3.y, gap: ext * -3, t: 'h2' });
          DL.push({ x1: idimX, y1: i3.y, x2: idimX, y2: i4.y, gap: ext * -3, t: 'h1' });
          DL.push({ x1: idimX, y1: i4.y, x2: idimX, y2: i5.y, gap: ext * -3, t: 'h2' });
          DL.push({ x1: i8.x, y1: idimY, x2: i1.x, y2: idimY, gap: ext * -3, t: 'b2' });
          DL.push({ x1: i1.x, y1: idimY, x2: i2.x, y2: idimY, gap: ext * -3, t: 'b1' });
          DL.push({ x1: i2.x, y1: idimY, x2: i3.x, y2: idimY, gap: ext * -3, t: 'b2' });
        }
        return { DL: DL, DR: [] };
      },
      // extra chamfer fold lines for the tapered plan / side views
      planFolds: function (ab, ae, half) {
        return [
          { x1: -ab.doct_B1 / 2, y1: -half, x2: -ae.doct_B1 / 2, y2: half, lay: 'solid' },
          { x1: ab.doct_B1 / 2, y1: -half, x2: ae.doct_B1 / 2, y2: half, lay: 'solid' }
        ];
      },
      sideFolds: function (ab, ae, half) {
        return [
          { x1: -half, y1: ab.doct_H2, x2: half, y2: ae.doct_H2, lay: 'solid' },
          { x1: -half, y1: ab.doct_H2 + ab.doct_H1, x2: half, y2: ae.doct_H2 + ae.doct_H1, lay: 'solid' }
        ];
      }
    }
  };

  // ── per-view geometry builder (returns {L, A, DL, DR}) ────────────────────
  function buildView(cfg, view, dd) {
    var L = [], A = [], DL = [], DR = [];
    var ab = dd.aparam_b, ae = dd.aparam_e, dseg = dd.dseg_leng;
    var half = dseg / 2, off = Math.max(cfg.H(ab), cfg.W(ab), 1) * 0.04, ext = off;
    var S = 'solid', H = 'hidden';

    if (view === 'front' || view === 'back') {
      var geo = view === 'front' ? dd.geoBegin : dd.geoEnd;
      var ap = view === 'front' ? ab : ae;
      geo.lines.forEach(function (l) { L.push({ x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2, lay: S }); });
      geo.arcs.forEach(function (a) { A.push({ x: a.x, y: a.y, r: a.r, a1: a.angb, a2: a.ange }); });
      var fd = cfg.frontDims(ap, gpOf(geo), off, ext);
      DL = fd.DL; DR = fd.DR;
    } else if (view === 'top' || view === 'bottom') {
      var Wb = cfg.W(ab), We = cfg.W(ae), Wmax = Math.max(Wb, We);
      L.push({ x1: -Wb / 2, y1: -half, x2: -We / 2, y2: half, lay: S });
      L.push({ x1: -We / 2, y1: half, x2: We / 2, y2: half, lay: S });
      L.push({ x1: We / 2, y1: half, x2: Wb / 2, y2: -half, lay: S });
      L.push({ x1: Wb / 2, y1: -half, x2: -Wb / 2, y2: -half, lay: S });
      if (cfg.planFolds) cfg.planFolds(ab, ae, half).forEach(function (f) { L.push(f); });
      if (cfg.hollow(ab) && cfg.hollow(ae)) {
        var iWb = cfg.iW(ab), iWe = cfg.iW(ae);
        L.push({ x1: -iWb / 2, y1: -half, x2: -iWe / 2, y2: half, lay: H });
        L.push({ x1: iWb / 2, y1: -half, x2: iWe / 2, y2: half, lay: H });
      }
      DL.push({ x1: -Wmax / 2 - off, y1: -half, x2: -Wmax / 2 - off, y2: half, gap: ext * 6, t: 'L' });
      DL.push({ x1: -Wb / 2, y1: -half - off, x2: Wb / 2, y2: -half - off, gap: ext * -6, t: cfg.wLabel });
      DL.push({ x1: -We / 2, y1: half + off, x2: We / 2, y2: half + off, gap: ext * 6, t: cfg.wLabel });
      if (cfg.hollow(ab) && cfg.hollow(ae)) {
        var iWbd = cfg.iW(ab), iWed = cfg.iW(ae);
        DL.push({ x1: -iWbd / 2, y1: -half - off, x2: iWbd / 2, y2: -half - off, gap: ext * -3, t: cfg.wLabelIn });
        DL.push({ x1: -iWed / 2, y1: half + off, x2: iWed / 2, y2: half + off, gap: ext * 3, t: cfg.wLabelIn });
      }
    } else { // left / right / center
      var Hb = cfg.H(ab), He = cfg.H(ae), Hmax = Math.max(Hb, He);
      L.push({ x1: -half, y1: 0, x2: half, y2: 0, lay: S });
      L.push({ x1: half, y1: 0, x2: half, y2: He, lay: S });
      L.push({ x1: half, y1: He, x2: -half, y2: Hb, lay: S });
      L.push({ x1: -half, y1: Hb, x2: -half, y2: 0, lay: S });
      if (cfg.sideFolds) cfg.sideFolds(ab, ae, half).forEach(function (f) { L.push(f); });
      if (cfg.hollow(ab) && cfg.hollow(ae)) {
        var hb = cfg.iH(ab), he = cfg.iH(ae), cyb = Hb / 2, cye = He / 2;
        L.push({ x1: -half, y1: cyb - hb / 2, x2: half, y2: cye - he / 2, lay: H });
        L.push({ x1: -half, y1: cyb + hb / 2, x2: half, y2: cye + he / 2, lay: H });
      }
      DL.push({ x1: -half - off, y1: 0, x2: -half - off, y2: Hb, gap: ext * 6, t: cfg.hLabel });
      DL.push({ x1: half + off, y1: 0, x2: half + off, y2: He, gap: ext * -6, t: cfg.hLabel });
      DL.push({ x1: -half, y1: Hmax + off, x2: half, y2: Hmax + off, gap: ext * 6, t: 'L' });
      if (cfg.hollow(ab) && cfg.hollow(ae)) {
        var hbd = cfg.iH(ab), hed = cfg.iH(ae), cybd = Hb / 2, cyed = He / 2;
        DL.push({ x1: -half - off, y1: cybd - hbd / 2, x2: -half - off, y2: cybd + hbd / 2, gap: ext * 3, t: cfg.hLabelIn });
        DL.push({ x1: half + off, y1: cyed - hed / 2, x2: half + off, y2: cyed + hed / 2, gap: ext * -3, t: cfg.hLabelIn });
      }
    }
    return { L: L, A: A, DL: DL, DR: DR };
  }

  // ── SVG rendering (retaining-wall look) ───────────────────────────────────
  function renderSVG(vd, W, Hpx) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    function acc(x, y) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    function arcSpan(a) { var a2 = a.a2; if (a2 <= a.a1) a2 += 360; return a2; }
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
    var ox = (cW - bw * s) / 2 - minX * s;
    var oy = (cH - bh * s) / 2 + maxY * s;
    function SX(x) { return ox + x * s; }
    function SY(y) { return oy - y * s; }
    function f(n) { return Math.round(n * 100) / 100; }

    var e = [];
    function line(x1, y1, x2, y2, col, w, dash) { e.push('<line x1="' + f(x1) + '" y1="' + f(y1) + '" x2="' + f(x2) + '" y2="' + f(y2) + '" stroke="' + col + '" stroke-width="' + w + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>'); }
    function poly(pts, col, w) { e.push('<polyline points="' + pts + '" fill="none" stroke="' + col + '" stroke-width="' + w + '"/>'); }
    function arrow(x, y, ux, uy, col) { var a = 7, bx = x - a * ux, by = y - a * uy, px = -uy * a * 0.34, py = ux * a * 0.34; e.push('<polygon points="' + f(x) + ',' + f(y) + ' ' + f(bx + px) + ',' + f(by + py) + ' ' + f(bx - px) + ',' + f(by - py) + '" fill="' + col + '"/>'); }
    function text(x, y, str, col, rot) { e.push('<text x="' + f(x) + '" y="' + f(y) + '" fill="' + col + '" font-size="11.5" font-family="ui-monospace,Menlo,Consolas,monospace" text-anchor="middle" dominant-baseline="middle"' + (rot ? ' transform="rotate(' + f(rot) + ' ' + f(x) + ' ' + f(y) + ')"' : '') + '>' + str + '</text>'); }
    function num(v) { return String(Math.round(v)); }

    vd.L.forEach(function (l) {
      if (l.lay === 'hidden') line(SX(l.x1), SY(l.y1), SX(l.x2), SY(l.y2), HID, 1, '6 3');
      else line(SX(l.x1), SY(l.y1), SX(l.x2), SY(l.y2), INK, 1.8);
    });
    vd.A.forEach(function (a) {
      var pts = [], a1 = a.a1, a2 = arcSpan(a), span = a2 - a1, n = Math.max(14, Math.ceil(span / 6));
      for (var i = 0; i <= n; i++) { var t = (a1 + (a2 - a1) * i / n) * Math.PI / 180; pts.push(f(SX(a.x + a.r * Math.cos(t))) + ',' + f(SY(a.y + a.r * Math.sin(t)))); }
      poly(pts.join(' '), INK, 1.8);
    });
    vd.DL.forEach(function (d) {
      var len = Math.hypot(d.x2 - d.x1, d.y2 - d.y1); if (len === 0) return;
      var nx = -(d.y2 - d.y1) / len, ny = (d.x2 - d.x1) / len;
      var p1x = d.x1 + nx * d.gap, p1y = d.y1 + ny * d.gap, p2x = d.x2 + nx * d.gap, p2y = d.y2 + ny * d.gap;
      var s1x = SX(p1x), s1y = SY(p1y), s2x = SX(p2x), s2y = SY(p2y);
      var dl = Math.hypot(s2x - s1x, s2y - s1y) || 1, ux = (s2x - s1x) / dl, uy = (s2y - s1y) / dl;
      line(s1x, s1y, s2x, s2y, DIM, 1);
      arrow(s1x, s1y, -ux, -uy, DIM); arrow(s2x, s2y, ux, uy, DIM);
      line(SX(d.x1), SY(d.y1), s1x, s1y, DIM, 0.6, '2 2');
      line(SX(d.x2), SY(d.y2), s2x, s2y, DIM, 0.6, '2 2');
      var ang = Math.atan2(s2y - s1y, s2x - s1x) * 180 / Math.PI; if (ang > 90 || ang < -90) ang += 180;
      var sgn = d.gap >= 0 ? 1 : -1, gdx = nx * sgn, gdy = -ny * sgn, gm = Math.hypot(gdx, gdy) || 1;
      var mx = (s1x + s2x) / 2 + gdx / gm * 12, my = (s1y + s2y) / 2 + gdy / gm * 12;
      text(mx, my, (d.t ? d.t + '=' : '') + num(len), DIM, ang);
    });
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

  function setActive(cfg, view) {
    var bar = document.getElementById(cfg.bar);
    if (!bar) return;
    Array.prototype.forEach.call(bar.querySelectorAll('[data-sview]'), function (b) {
      var on = b.getAttribute('data-sview') === view;
      b.style.background = on ? '#2563eb' : '#eef2f6';
      b.style.color = on ? '#fff' : '#475569';
      b.style.borderColor = on ? '#2563eb' : '#cbd5e1';
    });
  }

  function render3d(cfg, dd) {
    function go() { var fn = G(cfg.render3d); if (typeof fn === 'function') fn(cfg.v3d, dd.geoBegin, dd.geoEnd, dd.dseg_leng); }
    if (typeof G(cfg.render3d) === 'function' && typeof THREE !== 'undefined') { go(); return; }
    var host = document.getElementById(cfg.v3d);
    if (host) host.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;font-size:14px;">3D Loading...</div>';
    var urls = [];
    if (typeof THREE === 'undefined') {
      urls.push('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
      urls.push('https://unpkg.com/three@0.128.0/examples/js/controls/OrbitControls.js');
    }
    if (typeof G(cfg.render3d) !== 'function') urls.push('https://macrobim.github.io/macroBIM/' + cfg.mod3d);
    (function next(i) {
      if (i >= urls.length) { go(); return; }
      var sc = document.createElement('script'); sc.src = urls[i];
      sc.onload = function () { next(i + 1); }; sc.onerror = function () { next(i + 1); };
      document.head.appendChild(sc);
    })(0);
  }

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

  function renderView(cfg) {
    var host = document.getElementById(cfg.scvs);
    var dd = window[cfg.ddVar];
    if (!host || !dd) return;
    var view = cfg._view || 'front';
    host.innerHTML = '';
    setActive(cfg, view);
    var Hpx = matchHeight();
    host.style.cssText = 'width:100%;height:' + Hpx + 'px;';
    if (view === '3d') {
      var d3 = document.createElement('div');
      d3.id = cfg.v3d;
      d3.style.cssText = 'width:100%;height:' + Hpx + 'px;background:#1a1a2e;';
      host.appendChild(d3);
      render3d(cfg, dd);
    } else {
      var W = host.clientWidth || 600;
      host.innerHTML = renderSVG(buildView(cfg, view, dd), W, Hpx);
      var svg = host.querySelector('svg');
      if (svg) attachZoomPan(svg);
    }
  }

  // rebuild DXF (front + back cross-sections, tapered plan + side) then render
  function rebuild(cfg) {
    var host = document.getElementById(cfg.scvs);
    if (!host) return;
    var odxf = G(cfg.odxf), geoFn = G(cfg.geo), getP = G(cfg.getParams);
    if (!odxf || !geoFn || !getP) return;
    var alayer = cfg.layers;
    odxf.init();
    odxf.layer(alayer[0], 4, "CONTINUOUS");
    odxf.layer(alayer[1], 4, "HIDDEN");
    odxf.layer(alayer[2], 1, "CENTER");

    var u = getP();
    var ab = u.aparam_b, ae = u.aparam_e, dseg = u.dseg_leng;
    var ta = document.getElementById('sUserText');
    if (ta) ta.value = u.combText + "\n" + dseg;

    var geoBegin = geoFn(ab), geoEnd = geoFn(ae);
    var half = dseg / 2;
    var Wb = cfg.W(ab), We = cfg.W(ae), Hb = cfg.H(ab), He = cfg.H(ae);
    var Wmax = Math.max(Wb, We), Hmax = Math.max(Hb, He);
    var gap = Math.max(Hmax, Wmax) * 0.4;
    var _col = Math.max(Wmax, dseg) * 1.5;

    geoBegin.lines.forEach(function (l) { odxf.line(l.x1, l.y1, l.x2, l.y2, alayer[0]); });
    geoBegin.arcs.forEach(function (a) { odxf.arc(a.x, a.y, a.r, a.angb, a.ange, alayer[0]); });
    geoEnd.lines.forEach(function (l) { odxf.line(l.x1 + _col, l.y1, l.x2 + _col, l.y2, alayer[0]); });
    geoEnd.arcs.forEach(function (a) { odxf.arc(a.x + _col, a.y, a.r, a.angb, a.ange, alayer[0]); });

    // tapered plan (top) view
    var oyT = Hmax + gap + half;
    odxf.line(-Wb / 2, oyT - half, -We / 2, oyT + half, alayer[0]);
    odxf.line(-We / 2, oyT + half, We / 2, oyT + half, alayer[0]);
    odxf.line(We / 2, oyT + half, Wb / 2, oyT - half, alayer[0]);
    odxf.line(Wb / 2, oyT - half, -Wb / 2, oyT - half, alayer[0]);
    if (cfg.hollow(ab) && cfg.hollow(ae)) {
      var iWb = cfg.iW(ab), iWe = cfg.iW(ae);
      odxf.line(-iWb / 2, oyT - half, -iWe / 2, oyT + half, alayer[1]);
      odxf.line(iWb / 2, oyT - half, iWe / 2, oyT + half, alayer[1]);
    }
    // tapered side view
    var oyS = oyT + half + gap;
    odxf.line(-half, oyS, half, oyS, alayer[0]);
    odxf.line(half, oyS, half, oyS + He, alayer[0]);
    odxf.line(half, oyS + He, -half, oyS + Hb, alayer[0]);
    odxf.line(-half, oyS + Hb, -half, oyS, alayer[0]);
    if (cfg.hollow(ab) && cfg.hollow(ae)) {
      var hb = cfg.iH(ab), he = cfg.iH(ae), cyb = Hb / 2, cye = He / 2;
      odxf.line(-half, oyS + cyb - hb / 2, half, oyS + cye - he / 2, alayer[1]);
      odxf.line(-half, oyS + cyb + hb / 2, half, oyS + cye + he / 2, alayer[1]);
    }

    window[cfg.ddVar] = { geoBegin: geoBegin, geoEnd: geoEnd, aparam_b: ab, aparam_e: ae, dseg_leng: dseg, alayer: alayer };
    renderView(cfg);
  }

  // install the overrides for one section
  window.makeSectionTest = function (name) {
    var cfg = SECT[name];
    if (!cfg) return;
    cfg._view = cfg._view || 'front';
    window['fdraw_' + name] = function () { rebuild(cfg); };
    window[name + '_setview'] = function (v) { cfg._view = v; renderView(cfg); };
  };

  // expose pure renderers for the headless harness
  window._sectBuildView = function (name, view, dd) { return buildView(SECT[name], view, dd); };
  window._sectRenderSVG = renderSVG;
  window._sectCfg = SECT;
})();
