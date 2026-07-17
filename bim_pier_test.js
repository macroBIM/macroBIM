/*
    bim_pier_test.js — Pier input system (macroBIM Drawings, LAYOUT TEST)
    Single-page, card-based input for MULTIPLE piers. Retaining-wall visual style.
    Entry point: fdraw_pier(mountId)   [default mount: 'mount-draw-pier']

    Page structure (top → bottom):
      1. Piers      — total pier count + per-pier name (P1, P2 …)
      2. Active pier selector (tabs)
      3. Live elevation preview (selected pier) | stacked input cards:
           Type · Coping(두부보) · Columns(기둥) · Foundation(기초)
    Columns pick a section shape (Rectangle / Circle / Track / Octagon — the shapes
    already shipped as bim_rect/circle/track/octagon). Foundation is either one
    combined footing or individual footings per column.
    Pure vanilla JS + inline SVG (no deps). Styles scoped to .pr-root.
    build: v27 (asymmetric cap: TLL/TLR half-widths from pier centre)
*/
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var TYPES  = [["T", "T-type"], ["MC", "Multi-column"], ["WALL", "Wall"], ["COL", "Single-column"], ["PORTAL", "Portal"], ["TORCH", "Torch"]];
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
    sc.src = "https://macrobim.github.io/macroBIM/bim_draw_test_core.js?v=5";
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
    ".pr-tbl input{width:100%;text-align:right;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink);font-size:13px;font-variant-numeric:tabular-nums}" +
    ".pr-tbl input:focus{outline:2px solid var(--dim);outline-offset:1px;border-color:var(--dim)}" +
    ".pr-cap{font-size:11px;color:var(--muted);margin:0 0 10px}" +
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
      name: name, type: "T",
      coping: {
        TLL: 10000, TLR: 10000, TB: 4000, THL: 1250, THU: 1250, HLL: 3250, HLR: 3250,
        HRL: 0, HRR: 0, HEL: 0, HER: 0, HLU: 0, HRU: 0, CR: 0, HD: 0, HW: 0, HS: 0,
        IHLA: 0, IHL: 0, IHH: 0, IHR: 0, IHSR: 0
      },
      colCount: 1, cols: [newCol()],
      fdnMode: "combined",
      fdn: { BH: 2000, BLF: 2750, BRF: 2750, FF: 2750, FB: 2750, EFL: 150, EH: 100 }
    };
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

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
      var hd = h("div", "pr-hd", "<span class='pr-ttl'>Piers <span class='pr-sub'>count &amp; names</span></span>");
      var stp = h("div", "pr-stepper");   // count stepper lives in the header (right)
      var minus = h("button", "pr-step", "−"), cnt = h("input", "pr-cnt"), plus = h("button", "pr-step", "+");
      cnt.type = "number"; cnt.value = S.piers.length; cnt.min = 1; cnt.max = 20;
      function setCount(n) {
        n = clamp(n | 0, 1, 20);
        while (S.piers.length < n) S.piers.push(newPier("P" + (S.piers.length + 1)));
        if (S.piers.length > n) S.piers.length = n;
        if (S.sel >= n) S.sel = n - 1;
        renderAll();
      }
      minus.onclick = function () { setCount(S.piers.length - 1); };
      plus.onclick = function () { setCount(S.piers.length + 1); };
      cnt.addEventListener("change", function () { setCount(parseInt(cnt.value, 10)); });
      stp.appendChild(minus); stp.appendChild(cnt); stp.appendChild(plus);
      hd.appendChild(stp); c.appendChild(hd);
      var b = h("div", "pr-body");

      // per-pier rows double as the active-pier selector (radio + highlight)
      var names = h("div", "pr-names");
      S.piers.forEach(function (p, i) {
        var nm = h("div", "pr-name" + (i === S.sel ? " on" : ""));
        var radio = h("button", "pr-radio" + (i === S.sel ? " on" : "")); radio.type = "button";
        var inp = h("input"); inp.type = "text"; inp.value = p.name;
        inp.addEventListener("input", function () { p.name = inp.value; draw(); });
        nm.onclick = function (e) { if (e.target === inp || i === S.sel) return; S.sel = i; renderAll(); };
        nm.appendChild(radio);
        nm.appendChild(h("span", "pr-pieridx", (i + 1) + "."));
        nm.appendChild(inp);
        names.appendChild(nm);
      });
      b.appendChild(names); c.appendChild(b); return c;
    }

    function cardCoping() {
      var p = P(), cp = p.coping;
      var c = h("div", "pr-card");
      c.appendChild(h("div", "pr-hd", "<span class='pr-ttl'>Coping <span class='pr-sub'>cap beam</span></span>"));
      var b = h("div", "pr-body pr-ingrid");
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
      c.appendChild(b); return c;
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
        row.appendChild(fld("CH", col.CH, function (v) { col.CH = v; }));
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
      b.appendChild(h("p", "pr-cap", "CH — column height · CL — transverse position from the pier centre (left −, right +) · Ang — section placement angle (°) · Hollow toggles the wall variables · Guide shows the section diagram."));
      c.appendChild(b); return c;
    }

    function cardFoundation() {
      var p = P(), f = p.fdn;
      var c = h("div", "pr-card");
      c.appendChild(h("div", "pr-hd", "<span class='pr-ttl'>Foundation <span class='pr-sub'>footing</span></span>"));
      var b = h("div", "pr-body");
      var modes = h("div", "pr-modes");
      [["combined", "Combined (single)"], ["individual", "Individual (per column)"]].forEach(function (m) {
        var btn = h("button", "pr-mode" + (p.fdnMode === m[0] ? " on" : ""), m[1]);
        btn.onclick = function () { p.fdnMode = m[0]; renderPerPier(); draw(); };
        modes.appendChild(btn);
      });
      b.appendChild(modes);
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
        "<button type='button' class='pr-btn' data-pr-regen>&#8635; Regen</button>");
      c.appendChild(hd);
      plotSub = hd.querySelector("[data-pr-sub]");
      hd.querySelector("[data-pr-regen]").addEventListener("click", function () { draw(); });
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
    function draw() {
      if (!plotHost || !plotHost.isConnected) return;
      if (typeof window.RWSVG === "undefined") { ensureCore(draw); return; }
      var rec = new window.RWSVG.MockViewer();
      rec.addLayer("c", "cyan", "solid", 1); rec.addLayer("h", "gray", "hidden", 1); rec.addLayer("g", "#c2ccd8", "faint", 1);
      buildFront(rec);
      var fbox = bboxOf(rec);
      var sRec = new window.RWSVG.MockViewer();
      sRec.addLayer("c", "cyan", "solid", 1); sRec.addLayer("h", "gray", "hidden", 1); sRec.addLayer("g", "#c2ccd8", "faint", 1);
      buildSide(sRec);
      var sbox = bboxOf(sRec);
      // place side to the right of front, uniform scale (both share this one drawing).
      // gap keyed to structure height so the two views sit well apart (fills the
      // horizontal room left when the drawing is height-fit).
      var gap = (fbox.maxY - fbox.minY) * 0.5;
      var ox = fbox.maxX + gap - sbox.minX;
      mergeOffset(rec, sRec, ox);
      var vspan = Math.max(fbox.maxY, sbox.maxY) - Math.min(fbox.minY, sbox.minY);
      var labY = Math.max(fbox.maxY, sbox.maxY) + vspan * 0.045;   // title sits just above the structure
      if (rec.addText) {
        rec.addText(0, (fbox.minX + fbox.maxX) / 2, labY, "FRONT");
        rec.addText(0, ox + (sbox.minX + sbox.maxX) / 2, labY, "SIDE");
      }
      // ── plan views: coping plan (top) + footing plan (bottom), stacked to the right,
      //    both aligned on the pier centre line (model x=0) ──
      var cRec = new window.RWSVG.MockViewer();
      cRec.addLayer("c", "cyan", "solid", 1); cRec.addLayer("h", "gray", "hidden", 1);
      buildCopingPlan(cRec); var cbox = bboxOf(cRec);
      var pRec = new window.RWSVG.MockViewer();
      pRec.addLayer("c", "cyan", "solid", 1); pRec.addLayer("h", "gray", "hidden", 1);
      buildFoundationPlan(pRec); var pbox = bboxOf(pRec);
      var elb = bboxOf(rec);                       // FRONT + SIDE so far
      var pgap = (elb.maxY - elb.minY) * 0.10;
      // one shared X offset → model x=0 (pier centre) lands at the same screen x in both plans
      var oxCommon = elb.maxX + gap - Math.min(cbox.minX, pbox.minX);
      var oyC = elb.maxY - cbox.maxY;                                        // coping plan: top-aligned
      mergeOffsetXY(rec, cRec, oxCommon, oyC);
      var oyF = (oyC + cbox.minY) - pgap * 2.4 - pbox.maxY;                  // footing plan: below coping
      mergeOffsetXY(rec, pRec, oxCommon, oyF);
      if (rec.addText) {
        rec.addText(0, oxCommon, oyC + cbox.maxY + pgap * 0.6, "COPING PLAN");
        rec.addText(0, oxCommon, oyF + pbox.maxY + pgap * 0.6, "FOOTING PLAN");
      }
      // fit to card width; height follows content so the card stays compact
      var full = bboxOf(rec), bw = Math.max(full.maxX - full.minX, 1), bh = Math.max(full.maxY - full.minY, 1);
      var W = plotHost.clientWidth || 1000, s = (W - 80) / bw;
      var Hpx = Math.max(260, Math.min(440, Math.round(bh * s) + 50));
      plotHost.innerHTML = window.RWSVG.renderSVG(rec, W, Hpx);
      var svg = plotHost.querySelector("svg");
      if (svg) window.RWSVG.attachZoomPan(svg);
      var pp = P();
      if (plotSub) plotSub.textContent = pp.name + " · " + pp.colCount + " col · " + (pp.fdnMode === "combined" ? "combined ftg" : "individual ftg");
    }

    function buildFront(rec) {
      var p = P(), cp = p.coping, f = p.fdn;
      var cs = colCenters(p);
      var maxCH = Math.max.apply(null, p.cols.map(function (c) { return c.CH; }).concat([1000]));
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
      // columns — silhouette + section edge-lines (chamfer/corner folds, hollow inner)
      p.cols.forEach(function (col, i) {
        var cx = cs[i], w = colW(col), cH = col.CH;
        rect(cx - w / 2, 0, cx + w / 2, cH);
        var fd = colFolds(col);
        curveGens(col).front.forEach(function (x) { rec.addLine(0, cx + x, 0, cx + x, cH, "g"); });
        fd.fx.forEach(function (x) { rec.addLine(0, cx + x, 0, cx + x, cH, "c"); });
        fd.ix.forEach(function (x) { rec.addLine(0, cx + x, 0, cx + x, cH, "h"); });
      });
      // coping outline (seated on columns), as a closed polyline (arcs tessellated)
      var geo = copingGeometry(cp), A = geo.A;
      var op = geo.points.map(function (q) { return [q[0], q[1] + maxCH]; });
      for (var i = 0; i < op.length; i++) { var a = op[i], b = op[(i + 1) % op.length]; rec.addLine(0, a[0], a[1], b[0], b[1], "c"); }

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
      var maxCH = Math.max.apply(null, p.cols.map(function (c) { return c.CH; }).concat([1000]));
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
      rect(-colDep / 2, 0, colDep / 2, maxCH);
      var rep = p.cols.reduce(function (a, c) { return colDepth(c) > colDepth(a) ? c : a; }, p.cols[0]);
      var fdS = colFolds(rep);
      curveGens(rep).side.forEach(function (y) { rec.addLine(0, y, 0, y, maxCH, "g"); });
      fdS.fy.forEach(function (y) { rec.addLine(0, y, 0, y, maxCH, "c"); });
      fdS.iy.forEach(function (y) { rec.addLine(0, y, 0, y, maxCH, "h"); });
      // coping: TB wide × copeH, seated on the columns, with the THU/THL split line
      rect(-TB / 2, maxCH, TB / 2, maxCH + copeH);
      if (THU > 0 && THL > 0) rec.addLine(0, -TB / 2, maxCH + THL, TB / 2, maxCH + THL, "c");   // lower THL / upper THU

      var footLo = bl ? footL - f.EFL : footL, footHi = bl ? footR + f.EFL : footR;
      var bnd = { minX: Math.min(-TB / 2, footLo), maxX: Math.max(TB / 2, footHi), minY: -f.BH - (f.EH > 0 ? f.EH : 0), maxY: maxCH + copeH };
      // all vertical dims share one left anchor → same-length witness lines, stacked on the left
      var xAnc = bnd.minX;
      var dims = [
        { side: "T", at: maxCH + copeH, lo: -TB / 2, hi: TB / 2, label: "TB" },
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
      rect(A.xLtip, -TB / 2, A.xRtip, TB / 2, "c");             // coping plan outline (visible)
      rec.addLine(0, A.xLH, -TB / 2, A.xLH, TB / 2, "h");       // central head-block edges (coping soffit)
      rec.addLine(0, A.xRH, -TB / 2, A.xRH, TB / 2, "h");
      p.cols.forEach(function (col, i) { var sp = sectionPts(col); polyOn(rec, sp.outer, cs[i], 0, "h"); if (sp.inner) polyOn(rec, sp.inner, cs[i], 0, "h"); });
      var b = { minX: A.xLtip, maxX: A.xRtip, minY: -TB / 2, maxY: TB / 2 };
      var dims = [
        { side: "R", at: A.xRtip, lo: -TB / 2, hi: TB / 2, label: "TB" },
        { side: "T", at: TB / 2, lo: A.xLtip, hi: A.xRtip, label: "L" }
      ];
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
      p.cols.forEach(function (col, i) { var sp = sectionPts(col); polyOn(rec, sp.outer, cs[i], 0, "c"); if (sp.inner) polyOn(rec, sp.inner, cs[i], 0, "h"); });
      var yLo = bl ? yB - EFL : yB, yHi = bl ? yT + EFL : yT;
      var b = { minX: minX, maxX: maxX, minY: yLo, maxY: yHi };
      var dims = [
        { side: "R", at: maxX, lo: yB, hi: yT, label: "FW" },
        { side: "T", at: yHi, lo: minX, hi: maxX, label: "L" }
      ];
      layoutDims(dims, b).forEach(function (d) { rec.addDimLinear(0, d.x1, d.y1, d.x2, d.y2, d.gap, d.label, { la: d.la, lp: d.lp }); });
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
