/*
    bim_gravitywall.js — Gravity retaining wall, parametric section (macroBIM Drawings)
    Renders a self-contained SVG section + live dimension inputs into a mount element.
    Entry point: fdraw_gravitywall(mountId)   [mountId default: 'mount-draw-gravitywall']
    Pure vanilla JS + inline SVG (no Konva / no external deps). Styles are scoped to .gw-root.
*/
(function () {
  "use strict";

  var CSS =
    ".gw-root{--dim:#2563eb;--slope:#1f8e9e;--soil:#b4813a;--found:#6e7e8c;--foundfill:#eef2f6;" +
    "--ink:#182430;--muted:#64748b;--line:#cbd5e1;--hair:#e2e8f0;--panel:#fff;--chip:#f1f5f9;--concrete-ln:#aeb9c6;" +
    "font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:var(--ink);}" +
    ".gw-root *{box-sizing:border-box}" +
    ".gw-mono{font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-variant-numeric:tabular-nums}" +
    ".gw-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:20px;align-items:start}" +
    "@media(max-width:900px){.gw-grid{grid-template-columns:1fr}}" +
    ".gw-card{background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden}" +
    ".gw-hd{display:flex;justify-content:space-between;align-items:center;padding:9px 14px;border-bottom:1px solid var(--hair);background:var(--chip)}" +
    ".gw-ttl{font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;color:var(--muted)}" +
    ".gw-plot{display:block;width:100%;height:auto;background:" +
    "linear-gradient(var(--hair) 1px,transparent 1px) 0 0/26px 26px," +
    "linear-gradient(90deg,var(--hair) 1px,transparent 1px) 0 0/26px 26px;background-color:var(--panel)}" +
    ".gw-inputs{padding:14px}" +
    ".gw-inrow{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px;padding:5px 0;border-bottom:1px dashed var(--hair)}" +
    ".gw-inrow:last-child{border-bottom:0}" +
    ".gw-inrow label{font-size:13px;display:flex;align-items:baseline;gap:8px}" +
    ".gw-inrow .var{font-weight:600;color:var(--dim);min-width:34px;display:inline-block;font-family:ui-monospace,Menlo,Consolas,monospace}" +
    ".gw-inrow .desc{color:var(--muted);font-size:12px}" +
    ".gw-inrow input{width:96px;text-align:right;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink);font-size:13px;font-variant-numeric:tabular-nums}" +
    ".gw-inrow input:focus{outline:2px solid var(--dim);outline-offset:1px;border-color:var(--dim)}" +
    ".gw-unit{color:var(--muted);font-size:11px;margin-left:6px}";

  // [name, default, description, colour-tag]  (units mm unless noted)
  var VARS = [
    ["H1", 4000, "Stem (concrete) height",       "d"],
    ["bt",  400, "Stem top width",               "d"],
    ["N1",  3.5, "Stem front batter  1:N₁", "s"],
    ["B1", 1350, "Base left end → key front", "d"],
    ["B2", 1350, "Key front → base right end","d"],
    ["hk",  400, "Shear key height",             "d"],
    ["bk",  400, "Shear key bottom width",       "d"],
    ["ak",   60, "Key back angle (°, front vertical)","s"],
    ["tbl", 100, "Blinding concrete thickness",  "f"],
    ["ff",  150, "Foundation front projection",  "f"],
    ["fb",  150, "Foundation back projection",   "f"],
    ["H0", 1500, "Wall top → soil height",  "d"],
    ["N",   1.5, "Backfill slope  1:N",          "s"],
    ["q",   1.0, "Surcharge q (t/m²)",      "o"]
  ];

  function buildMarkup() {
    return "" +
      "<style>" + CSS + "</style>" +
      "<div class='gw-root'>" +
      "  <div class='gw-grid'>" +
      "    <div class='gw-card'>" +
      "      <div class='gw-hd'><span class='gw-ttl'>Section</span><span class='gw-ttl gw-mono'>SCALE&nbsp;NTS</span></div>" +
      "      <svg class='gw-plot' viewBox='0 0 620 724' role='img' aria-label='Gravity wall section'></svg>" +
      "    </div>" +
      "    <div class='gw-card'>" +
      "      <div class='gw-hd'><span class='gw-ttl'>Dimension Input &mdash; live redraw on edit</span></div>" +
      "      <div class='gw-inputs'></div>" +
      "    </div>" +
      "  </div>" +
      "</div>";
  }

  function initGW(root) {
    var P = {}; VARS.forEach(function (v) { P[v[0]] = v[1]; });

    // ---- input form ----
    var box = root.querySelector(".gw-inputs");
    VARS.forEach(function (v) {
      var k = v[0],
        unit = (k === "ak") ? "deg" : (k === "q") ? "t/m²" : (k === "N" || k === "N1") ? "ratio" : "mm",
        step = (k === "q") ? 0.1 : (k === "N" || k === "N1") ? 0.1 : 10;
      var row = document.createElement("div");
      row.className = "gw-inrow";
      row.innerHTML =
        "<label><span class='var'>" + k + "</span><span class='desc'>" + v[2] + "</span></label>" +
        "<span><input class='gw-mono' type='number' step='" + step + "' value='" + v[1] + "' data-k='" + k + "'>" +
        "<span class='gw-unit'>" + unit + "</span></span>";
      box.appendChild(row);
    });
    box.addEventListener("input", function (e) {
      var t = e.target; if (!t.dataset || !t.dataset.k) return;
      var val = parseFloat(t.value); if (isNaN(val)) return;
      P[t.dataset.k] = val; draw();
    });

    // ---- drawing ----
    var svg = root.querySelector(".gw-plot");
    var W = 620, H = 724, NS = "http://www.w3.org/2000/svg";

    function el(name, attrs) {
      var e = document.createElementNS(NS, name);
      for (var a in attrs) e.setAttribute(a, attrs[a]);
      return e;
    }
    function arrow(g, x, y, ux, uy, color) { // arrowhead, tip at (x,y), pointing (ux,uy)
      var bx = x - 8 * ux, by = y - 8 * uy, px = -uy, py = ux, c = color || "var(--dim)";
      g.appendChild(el("polygon", { points: x + "," + y + " " + (bx + 2.8 * px) + "," + (by + 2.8 * py) + " " + (bx - 2.8 * px) + "," + (by - 2.8 * py), fill: c }));
    }
    function dimLine(g, x1, y1, x2, y2, color) { // dim line with outward arrowheads at both ends
      var c = color || "var(--dim)";
      g.appendChild(el("line", { x1: x1, y1: y1, x2: x2, y2: y2, stroke: c, "stroke-width": 1 }));
      var dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      arrow(g, x1, y1, -ux, -uy, c); arrow(g, x2, y2, ux, uy, c);
    }
    function txt(g, x, y, s, cls, ang, anchor) {
      var t = el("text", {
        x: x, y: y, "text-anchor": anchor || "middle", "dominant-baseline": "middle",
        "font-size": 11.5, "font-family": "ui-monospace,Menlo,Consolas,monospace",
        fill: cls === "s" ? "var(--slope)" : cls === "o" ? "var(--soil)" : cls === "f" ? "var(--found)" : "var(--dim)",
        "font-style": cls === "s" ? "italic" : "normal"
      });
      if (ang) t.setAttribute("transform", "rotate(" + ang + " " + x + " " + y + ")");
      t.textContent = s; g.appendChild(t);
    }

    function draw() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var g = el("g", {}); svg.appendChild(g);

      // --- model coords (mm, x right, y up). y=0 = wall base; x=0 = key front (vertical) = B1/B2 split ---
      var H0 = P.H0, H1 = P.H1, bt = P.bt, N1 = P.N1, B1 = P.B1, B2 = P.B2,
        hk = P.hk, bk = P.bk, tbl = P.tbl, ff = P.ff, fb = P.fb, N = P.N;
      var akr = P.ak * Math.PI / 180;
      var B = B1 + B2;
      var ywt = H1;                            // wall top (no footing: key sits directly under stem)
      var frun = H1 / N1;                      // horizontal run of front batter 1:N1
      var topL = -B1 + frun, topR = topL + bt; // stem top (front face 1:N1 from base left end)
      var xc = (topL + topR) / 2;
      var hasKey = (hk > 0 && bk > 0);         // key height or width 0 → no shear key

      // [structure] stem: top width bt, front 1:N1 / back derived, base at y=0
      var stem = [[topL, ywt], [topR, ywt], [B2, 0], [-B1, 0]];
      // [structure] shear key: front (left) vertical, back (right) at ak, flat bottom width bk
      var kin = hasKey ? hk / Math.tan(akr) : 0;
      var key = [[0, 0], [bk + kin, 0], [bk, -hk], [0, -hk]];
      // [foundation] blinding concrete: split into toe/heel segments around the key; continuous if no key
      var blinds = hasKey
        ? [[[-B1 - ff, 0], [0, 0], [0, -tbl], [-B1 - ff, -tbl]],
           [[bk + kin, 0], [B2 + fb, 0], [B2 + fb, -tbl], [bk + kin, -tbl]]]
        : [[[-B1 - ff, 0], [B2 + fb, 0], [B2 + fb, -tbl], [-B1 - ff, -tbl]]];

      // backfill surface: rises 1:N (1 horizontal : N vertical, same sense as 1:N1 →
      // larger N = steeper) then goes horizontal under q.  N = 0 → level backfill:
      // no rise, a horizontal line at the wall-top level.
      var flat = (N <= 0);
      var gx0 = topR, gy0 = ywt;
      var ax = flat ? gx0 : gx0 + H0 / N;
      var ay = flat ? ywt : ywt + H0;
      var plat = Math.max(1500, B2 + 900);
      var bx = ax + plat, by = ay;

      // --- fit to viewport (viewBox trimmed to content to avoid slack margins) ---
      var kh = hasKey ? hk : 0;
      var minX = -B1 - ff - 40, maxX = bx + 40;
      var minY = -Math.max(kh, tbl) - 45, maxY = ay + 10;
      var padL = 120, padR = 24, padT = 40, padB = 74;
      var s = Math.min((W - padL - padR) / (maxX - minX), (H - padT - padB) / (maxY - minY));
      var cW = (maxX - minX) * s + padL + padR, cH = (maxY - minY) * s + padT + padB;
      svg.setAttribute("viewBox", "0 0 " + cW.toFixed(1) + " " + cH.toFixed(1));
      var ox = padL - minX * s, oy = cH - padB + minY * s;
      function SX(mx) { return ox + mx * s; }
      function SY(my) { return oy - my * s; }
      function pts(arr) { return arr.map(function (p) { return SX(p[0]) + "," + SY(p[1]); }).join(" "); }

      // --- hatch patterns: concrete / soil / blinding ---
      var defs = el("defs", {});
      defs.innerHTML =
        "<pattern id='gwConc' width='7' height='7' patternTransform='rotate(45)' patternUnits='userSpaceOnUse'>" +
        "<line x1='0' y1='0' x2='0' y2='7' stroke='var(--concrete-ln)' stroke-width='0.7'/></pattern>" +
        "<pattern id='gwBlind' width='6' height='6' patternTransform='rotate(-45)' patternUnits='userSpaceOnUse'>" +
        "<rect width='6' height='6' fill='var(--foundfill)'/>" +
        "<line x1='0' y1='0' x2='0' y2='6' stroke='var(--found)' stroke-width='0.6'/></pattern>" +
        "<pattern id='gwSoil' width='14' height='10' patternUnits='userSpaceOnUse'>" +
        "<circle cx='3' cy='3' r='0.9' fill='var(--soil)' opacity='0.5'/>" +
        "<circle cx='10' cy='8' r='0.9' fill='var(--soil)' opacity='0.5'/></pattern>";
      g.appendChild(defs);

      // --- soil wedge (behind stem, up the slope, under the surcharge platform) ---
      var soilPoly = [[gx0, gy0], [ax, ay], [bx, by], [bx, 0], [B2, 0]];
      g.appendChild(el("polygon", { points: pts(soilPoly), fill: "url(#gwSoil)", stroke: "none" }));

      // --- foundation: blinding concrete (distinct hatch + dashed outline) ---
      blinds.forEach(function (poly) {
        g.appendChild(el("polygon", { points: pts(poly), fill: "url(#gwBlind)", stroke: "var(--found)", "stroke-width": 1, "stroke-dasharray": "4 2" }));
      });

      // --- wall structure: stem + shear key (one monolithic concrete) ---
      (hasKey ? [stem, key] : [stem]).forEach(function (poly) {
        g.appendChild(el("polygon", { points: pts(poly), fill: "url(#gwConc)", stroke: "var(--ink)", "stroke-width": 1.8, "stroke-linejoin": "round" }));
      });

      // --- ground line: 1:N slope then horizontal ---
      g.appendChild(el("polyline", { points: pts([[gx0, gy0], [ax, ay], [bx, by]]), fill: "none", stroke: "var(--soil)", "stroke-width": 1.8 }));

      // --- surcharge q: vertical arrows on the horizontal surface ---
      var qN = 5, X0 = SX(ax), X1 = SX(bx), Ytop = SY(ay) - 20, Yb = SY(ay) - 4;
      g.appendChild(el("line", { x1: X0, y1: Ytop, x2: X1, y2: Ytop, stroke: "var(--soil)", "stroke-width": 1.3 }));
      for (var i = 0; i <= qN; i++) {
        var X = X0 + (X1 - X0) * (i / qN);
        g.appendChild(el("line", { x1: X, y1: Ytop, x2: X, y2: Yb, stroke: "var(--soil)", "stroke-width": 1.1 }));
        g.appendChild(el("polygon", { points: X + "," + (Yb + 3) + " " + (X - 2.6) + "," + (Yb - 2) + " " + (X + 2.6) + "," + (Yb - 2), fill: "var(--soil)" }));
      }
      txt(g, (X0 + X1) / 2, Ytop - 12, "q = " + (P.q).toFixed(1) + " t/m²", "o");

      // ---- dimension helpers (arrow style) ----
      function dimVs(Xs, my1, my2, label, cls, labRight) {
        var Y1 = SY(my1), Y2 = SY(my2);
        dimLine(g, Xs, Y1, Xs, Y2);
        txt(g, Xs + (labRight ? 9 : -9), (Y1 + Y2) / 2, label, cls || "d", -90);
      }
      function extS(mx, my, Xs) {
        g.appendChild(el("line", { x1: SX(mx), y1: SY(my), x2: Xs, y2: SY(my), stroke: "var(--line)", "stroke-width": 0.8, "stroke-dasharray": "2 2" }));
      }
      function dimHscreen(Yscr, mx1, mx2, label, cls) {
        var X1 = SX(mx1), X2 = SX(mx2);
        dimLine(g, X1, Yscr, X2, Yscr);
        txt(g, (X1 + X2) / 2, Yscr + 11, label, cls);
      }

      // left height stack: H0, H1, (hk only when a key exists)
      var col1 = 42, col2 = 84;
      extS(topL, ywt, col1);
      if (!flat) { extS(ax, ay, col1); dimVs(col1, ywt, ay, "H₀ = " + H0); }
      dimVs(col1, 0, ywt, "H₁ = " + H1);
      if (hasKey) { extS(-B1, 0, col2); dimVs(col2, -hk, 0, "hk = " + hk); }

      // right: blinding thickness tbl
      var colR = SX(B2 + fb) + 22;
      extS(B2 + fb, 0, colR); extS(B2 + fb, -tbl, colR);
      dimVs(colR, -tbl, 0, "tbl = " + tbl, "f", true);

      // top width bt — raised above the structure with extension lines
      var Ybt = SY(ywt) - 42;
      g.appendChild(el("line", { x1: SX(topL), y1: SY(ywt), x2: SX(topL), y2: Ybt, stroke: "var(--line)", "stroke-width": 0.8, "stroke-dasharray": "2 2" }));
      g.appendChild(el("line", { x1: SX(topR), y1: SY(ywt), x2: SX(topR), y2: Ybt, stroke: "var(--line)", "stroke-width": 0.8, "stroke-dasharray": "2 2" }));
      dimLine(g, SX(topL), Ybt, SX(topR), Ybt);
      txt(g, (SX(topL) + SX(topR)) / 2, Ybt - 9, "bt = " + bt, "d");

      // bottom dims: (bk only when a key exists), B1/B2, B
      var Y0 = SY(-kh), Yk = Y0 + 14, Yb1 = Y0 + 36, Yb2 = Y0 + 58;
      if (hasKey) {
        g.appendChild(el("line", { x1: SX(bk), y1: SY(-hk), x2: SX(bk), y2: Yk + 5, stroke: "var(--line)", "stroke-width": 0.8, "stroke-dasharray": "2 2" }));
        dimHscreen(Yk, 0, bk, "bk = " + bk);
      }
      g.appendChild(el("line", { x1: SX(-B1), y1: SY(0), x2: SX(-B1), y2: Yb2 + 6, stroke: "var(--line)", "stroke-width": 0.8, "stroke-dasharray": "2 2" }));
      g.appendChild(el("line", { x1: SX(0), y1: SY(-kh), x2: SX(0), y2: Yb1 + 6, stroke: "var(--line)", "stroke-width": 0.8, "stroke-dasharray": "2 2" }));
      g.appendChild(el("line", { x1: SX(B2), y1: SY(0), x2: SX(B2), y2: Yb2 + 6, stroke: "var(--line)", "stroke-width": 0.8, "stroke-dasharray": "2 2" }));
      dimHscreen(Yb1, -B1, 0, "B₁ = " + B1);
      dimHscreen(Yb1, 0, B2, "B₂ = " + B2);
      dimHscreen(Yb2, -B1, B2, "B = " + B);

      // foundation front/back projection ff, fb (same style/colour as other dims)
      var Yr = SY(0) - 30;
      g.appendChild(el("line", { x1: SX(-B1), y1: SY(0), x2: SX(-B1), y2: Yr, stroke: "var(--line)", "stroke-width": 0.8, "stroke-dasharray": "2 2" }));
      g.appendChild(el("line", { x1: SX(-B1 - ff), y1: SY(-tbl), x2: SX(-B1 - ff), y2: Yr, stroke: "var(--line)", "stroke-width": 0.8, "stroke-dasharray": "2 2" }));
      dimLine(g, SX(-B1 - ff), Yr, SX(-B1), Yr);
      txt(g, (SX(-B1 - ff) + SX(-B1)) / 2, Yr - 8, "ff = " + ff, "d");
      g.appendChild(el("line", { x1: SX(B2), y1: SY(0), x2: SX(B2), y2: Yr, stroke: "var(--line)", "stroke-width": 0.8, "stroke-dasharray": "2 2" }));
      g.appendChild(el("line", { x1: SX(B2 + fb), y1: SY(-tbl), x2: SX(B2 + fb), y2: Yr, stroke: "var(--line)", "stroke-width": 0.8, "stroke-dasharray": "2 2" }));
      dimLine(g, SX(B2), Yr, SX(B2 + fb), Yr);
      txt(g, (SX(B2) + SX(B2 + fb)) / 2, Yr - 8, "fb = " + fb, "d");

      // slope labels with values
      var lmx = (topL + (-B1)) / 2, lmy = ywt / 2;
      txt(g, SX(lmx) - 6, SY(lmy), "1:N₁ = 1:" + N1, "s", -(Math.atan(H1 / frun) * 180 / Math.PI), "middle");
      var gmx = flat ? gx0 + plat * 0.3 : (gx0 + ax) / 2, gmy = (gy0 + ay) / 2;
      txt(g, SX(gmx) - 6, SY(gmy) - 6, "1:N = 1:" + N, "s", flat ? 0 : -(Math.atan(N) * 180 / Math.PI), "middle");

      // key back angle ak — arc at the key bottom-right corner (bk,-hk); only when a key exists
      if (hasKey) {
        var vx = SX(bk), vy = SY(-hk), r = 26;
        g.appendChild(el("line", { x1: vx, y1: vy, x2: vx + r + 12, y2: vy, stroke: "var(--slope)", "stroke-width": 0.9, "stroke-dasharray": "3 2" }));
        g.appendChild(el("path", { d: "M " + (vx + r) + " " + vy + " A " + r + " " + r + " 0 0 0 " + (vx + r * Math.cos(akr)) + " " + (vy - r * Math.sin(akr)), fill: "none", stroke: "var(--slope)", "stroke-width": 1.1 }));
        txt(g, vx + r + 16, vy - (r + 2) * Math.sin(akr) / 1.6, "ak = " + P.ak + "°", "s", 0, "start");
      }

      // blinding-concrete callout (toe side)
      txt(g, SX(-B1 * 0.55), SY(-tbl) + 16, "Blinding conc.", "f");

      // centreline (chain line)
      g.appendChild(el("line", { x1: SX(xc), y1: SY(ywt) + 6, x2: SX(xc), y2: SY(-kh) - 2, stroke: "var(--muted)", "stroke-width": 0.7, "stroke-dasharray": "6 2 1 2", opacity: 0.55 }));
    }

    draw();
  }

  // ---- public entry point (matches macroBIM fdraw_* convention) ----
  window.fdraw_gravitywall = function (mountId) {
    mountId = mountId || "mount-draw-gravitywall";
    var mount = document.getElementById(mountId);
    if (!mount) return;
    if (mount.querySelector(".gw-root")) return; // already built — keep current state
    mount.innerHTML = buildMarkup();
    initGW(mount.querySelector(".gw-root"));
  };
})();
