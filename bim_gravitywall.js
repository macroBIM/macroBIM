/*
    bim_gravitywall.js — Gravity retaining wall, parametric section (macroBIM Drawings)
    Renders a self-contained SVG section + live dimension inputs into a mount element.
    Entry point: fdraw_gravitywall(mountId)   [mountId default: 'mount-draw-gravitywall']
    Pure vanilla JS + inline SVG (no Konva / no external deps). Styles are scoped to .gw-root.
*/
(function () {
  "use strict";

  var _gwDraw = null, _gwRT = null;   // current instance's draw() + debounce timer
  window.addEventListener("resize", function () {
    clearTimeout(_gwRT);
    _gwRT = setTimeout(function () { if (_gwDraw) _gwDraw(); }, 120);
  });

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
    ".gw-unit{color:var(--muted);font-size:11px;margin-left:6px}" +
    ".gw-plot{cursor:grab;touch-action:none;-webkit-user-select:none;user-select:none}.gw-plot:active{cursor:grabbing}" +
    ".gw-hd-r{display:flex;align-items:center;gap:10px}" +
    ".gw-btn{font:inherit;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#fff;" +
    "background:var(--dim);border:1px solid var(--dim);border-radius:6px;padding:5px 12px;cursor:pointer;" +
    "box-shadow:0 1px 3px rgba(37,99,235,.35);transition:filter .12s,transform .06s}" +
    ".gw-btn:hover{filter:brightness(1.12)}.gw-btn:active{filter:brightness(.94);transform:translateY(1px)}" +
    ".gw-btn.gw-btn-dxf{background:var(--slope);border-color:var(--slope);box-shadow:0 1px 3px rgba(31,142,158,.35)}" +
    ".gw-batch-wrap{padding:0 0 10px;margin-bottom:8px;border-bottom:1px dashed var(--hair)}" +
    ".gw-batch-lbl{font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin-bottom:5px}" +
    ".gw-batch-hint{font-weight:400;text-transform:none;letter-spacing:0;color:var(--dim);font-family:ui-monospace,Menlo,Consolas,monospace;font-size:10px}" +
    ".gw-batch{width:100%;resize:none;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1.5;padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink)}" +
    ".gw-batch:focus{outline:2px solid var(--dim);outline-offset:1px;border-color:var(--dim)}";

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
      "      <div class='gw-hd'><span class='gw-ttl'>Layout</span>" +
      "        <span class='gw-hd-r'><button type='button' class='gw-btn' data-gw-fit>Reset view</button>" +
      "        <span class='gw-ttl gw-mono'>SCALE&nbsp;NTS</span></span></div>" +
      "      <svg class='gw-plot' viewBox='0 0 620 724' role='img' aria-label='Gravity wall section (scroll to zoom, drag to pan)'></svg>" +
      "    </div>" +
      "    <div class='gw-card'>" +
      "      <div class='gw-hd'><span class='gw-ttl'>Dimension Input &mdash; live redraw on edit</span>" +
      "        <button type='button' class='gw-btn gw-btn-dxf' data-gw-dxf>DXF out</button></div>" +
      "      <div class='gw-inputs'></div>" +
      "    </div>" +
      "  </div>" +
      "</div>";
  }

  function initGW(root) {
    var P = {}; VARS.forEach(function (v) { P[v[0]] = v[1]; });

    // ---- input form ----
    var box = root.querySelector(".gw-inputs");
    var order = VARS.map(function (v) { return v[0]; });
    function currentCSV() { return order.map(function (k) { return P[k]; }).join(","); }

    // batch input (CSV) — one line, values in VARS order
    var bwrap = document.createElement("div");
    bwrap.className = "gw-batch-wrap";
    bwrap.innerHTML =
      "<div class='gw-batch-lbl'>Batch Input (CSV) <span class='gw-batch-hint'>" + order.join(",") + "</span></div>" +
      "<textarea class='gw-batch' rows='2' spellcheck='false'></textarea>";
    box.appendChild(bwrap);
    var batchTa = bwrap.querySelector(".gw-batch");

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

    // individual field edit → update model, keep the CSV in sync, redraw
    box.addEventListener("input", function (e) {
      var t = e.target; if (!t.dataset || !t.dataset.k) return;
      var val = parseFloat(t.value); if (isNaN(val)) return;
      P[t.dataset.k] = val; batchTa.value = currentCSV(); draw();
    });
    // CSV edit → fan out to model + fields, redraw
    batchTa.addEventListener("input", function () {
      var parts = batchTa.value.split(/[,\s]+/).filter(function (s) { return s !== ""; });
      order.forEach(function (k, i) {
        if (i >= parts.length) return;
        var val = parseFloat(parts[i]); if (isNaN(val)) return;
        P[k] = val;
        var inp = box.querySelector("input[data-k='" + k + "']");
        if (inp) inp.value = val;
      });
      draw();
    });
    batchTa.value = currentCSV();

    // ---- drawing ----
    var svg = root.querySelector(".gw-plot");
    var W = 620, H = 724, NS = "http://www.w3.org/2000/svg";

    // ---- zoom / pan (viewBox based; base is the auto-fit view set each draw) ----
    var baseVB = { x: 0, y: 0, w: 0, h: 0 }, curVB = { x: 0, y: 0, w: 0, h: 0 };
    function applyVB() { svg.setAttribute("viewBox", curVB.x + " " + curVB.y + " " + curVB.w + " " + curVB.h); }
    function resetView() { curVB.x = baseVB.x; curVB.y = baseVB.y; curVB.w = baseVB.w; curVB.h = baseVB.h; applyVB(); }
    svg.addEventListener("wheel", function (e) {
      if (!curVB.w) return;
      e.preventDefault();
      var r = svg.getBoundingClientRect();
      var mx = (e.clientX - r.left) / r.width, my = (e.clientY - r.top) / r.height;
      var nw = curVB.w * (e.deltaY < 0 ? 0.88 : 1 / 0.88);
      nw = Math.min(baseVB.w, Math.max(baseVB.w * 0.08, nw));           // clamp: fit-out … 12.5× in
      var nh = nw * (baseVB.h / baseVB.w);
      var wx = curVB.x + mx * curVB.w, wy = curVB.y + my * curVB.h;     // keep point under cursor fixed
      curVB.x = wx - mx * nw; curVB.y = wy - my * nh; curVB.w = nw; curVB.h = nh;
      applyVB();
    }, { passive: false });
    var drag = null;
    svg.addEventListener("pointerdown", function (e) {
      e.preventDefault();                       // no text selection while panning
      drag = { x: e.clientX, y: e.clientY };
      if (svg.setPointerCapture) try { svg.setPointerCapture(e.pointerId); } catch (x) {}
    });
    svg.addEventListener("pointermove", function (e) {
      if (!drag || !curVB.w) return;
      var r = svg.getBoundingClientRect();
      curVB.x -= (e.clientX - drag.x) * (curVB.w / r.width);
      curVB.y -= (e.clientY - drag.y) * (curVB.h / r.height);
      drag.x = e.clientX; drag.y = e.clientY; applyVB();
    });
    function endDrag() { drag = null; }
    svg.addEventListener("pointerup", endDrag);
    svg.addEventListener("pointercancel", endDrag);
    svg.addEventListener("dblclick", resetView);
    var fitBtn = root.querySelector("[data-gw-fit]");
    if (fitBtn) fitBtn.addEventListener("click", resetView);

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
      if (!svg.isConnected) return;            // stale (mount cleared) → ignore
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
      var flat = (N <= 0 || H0 <= 0);          // level backfill: no rise
      var gx0 = topR, gy0 = ywt;
      var ax = flat ? gx0 : gx0 + H0 / N;
      var ay = flat ? ywt : ywt + H0;
      var plat = Math.max(1500, B2 + 900);
      var bx = ax + plat, by = ay;

      // --- fit to viewport (viewBox trimmed to content to avoid slack margins) ---
      var kh = hasKey ? hk : 0;
      var minX = -B1 - ff - 40, maxX = bx + 40;
      var minY = -Math.max(kh, tbl) - 45, maxY = ay + 10;
      // level backfill has no H0 band above the wall, so reserve more top room for the bt dim
      var padL = 120, padR = 24, padT = flat ? 58 : 40, padB = 74;
      var s = Math.min((W - padL - padR) / (maxX - minX), (H - padT - padB) / (maxY - minY));
      var cW = (maxX - minX) * s + padL + padR, cH = (maxY - minY) * s + padT + padB;
      svg.setAttribute("viewBox", "0 0 " + cW.toFixed(1) + " " + cH.toFixed(1));
      baseVB.x = 0; baseVB.y = 0; baseVB.w = cW; baseVB.h = cH;   // auto-fit view
      curVB.x = 0; curVB.y = 0; curVB.w = cW; curVB.h = cH;       // input change / resize refits
      var ox = padL - minX * s, oy = cH - padB + minY * s;

      // size the SVG element in px to fit the available box (matches the Dimension card height,
      // and never overflows the viewport)
      var availW = (svg.parentNode && svg.parentNode.clientWidth) || W;
      var vpH = Math.max(300, (window.innerHeight || 800) - svg.getBoundingClientRect().top - 16);
      var availH = vpH;
      var cards = root.querySelectorAll(".gw-card");
      var secHd = svg.parentNode && svg.parentNode.querySelector(".gw-hd");
      if (cards.length > 1 && secHd) {                          // = Dimension Input card height − Layout header
        var matchH = cards[1].getBoundingClientRect().height - secHd.getBoundingClientRect().height - 2;
        if (matchH > 160) availH = Math.min(vpH, matchH);
      }
      var fit = Math.min(availW / cW, availH / cH);
      svg.style.width = Math.round(cW * fit) + "px";
      svg.style.height = Math.round(cH * fit) + "px";
      svg.style.margin = "0 auto";
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
        g.appendChild(el("line", { x1: SX(mx), y1: SY(my), x2: Xs, y2: SY(my), stroke: "var(--dim)", "stroke-width": 0.7, "stroke-dasharray": "2 2", opacity: 0.5 }));
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
      g.appendChild(el("line", { x1: SX(topL), y1: SY(ywt), x2: SX(topL), y2: Ybt, stroke: "var(--dim)", "stroke-width": 0.7, "stroke-dasharray": "2 2", opacity: 0.5 }));
      g.appendChild(el("line", { x1: SX(topR), y1: SY(ywt), x2: SX(topR), y2: Ybt, stroke: "var(--dim)", "stroke-width": 0.7, "stroke-dasharray": "2 2", opacity: 0.5 }));
      dimLine(g, SX(topL), Ybt, SX(topR), Ybt);
      txt(g, (SX(topL) + SX(topR)) / 2, Ybt - 9, "bt = " + bt, "d");

      // bottom dims: (bk only when a key exists), B1/B2, B
      var Y0 = SY(-kh), Yk = Y0 + 14, Yb1 = Y0 + 36, Yb2 = Y0 + 58;
      if (hasKey) {
        g.appendChild(el("line", { x1: SX(bk), y1: SY(-hk), x2: SX(bk), y2: Yk + 5, stroke: "var(--dim)", "stroke-width": 0.7, "stroke-dasharray": "2 2", opacity: 0.5 }));
        dimHscreen(Yk, 0, bk, "bk = " + bk);
      }
      g.appendChild(el("line", { x1: SX(-B1), y1: SY(0), x2: SX(-B1), y2: Yb2 + 6, stroke: "var(--dim)", "stroke-width": 0.7, "stroke-dasharray": "2 2", opacity: 0.5 }));
      g.appendChild(el("line", { x1: SX(0), y1: SY(-kh), x2: SX(0), y2: Yb1 + 6, stroke: "var(--dim)", "stroke-width": 0.7, "stroke-dasharray": "2 2", opacity: 0.5 }));
      g.appendChild(el("line", { x1: SX(B2), y1: SY(0), x2: SX(B2), y2: Yb2 + 6, stroke: "var(--dim)", "stroke-width": 0.7, "stroke-dasharray": "2 2", opacity: 0.5 }));
      dimHscreen(Yb1, -B1, 0, "B₁ = " + B1);
      dimHscreen(Yb1, 0, B2, "B₂ = " + B2);
      dimHscreen(Yb2, -B1, B2, "B = " + B);

      // foundation front/back projection ff, fb (same style/colour as other dims)
      var Yr = SY(0) - 30;
      g.appendChild(el("line", { x1: SX(-B1), y1: SY(0), x2: SX(-B1), y2: Yr, stroke: "var(--dim)", "stroke-width": 0.7, "stroke-dasharray": "2 2", opacity: 0.5 }));
      g.appendChild(el("line", { x1: SX(-B1 - ff), y1: SY(-tbl), x2: SX(-B1 - ff), y2: Yr, stroke: "var(--dim)", "stroke-width": 0.7, "stroke-dasharray": "2 2", opacity: 0.5 }));
      dimLine(g, SX(-B1 - ff), Yr, SX(-B1), Yr);
      txt(g, (SX(-B1 - ff) + SX(-B1)) / 2, Yr - 8, "ff = " + ff, "d");
      g.appendChild(el("line", { x1: SX(B2), y1: SY(0), x2: SX(B2), y2: Yr, stroke: "var(--dim)", "stroke-width": 0.7, "stroke-dasharray": "2 2", opacity: 0.5 }));
      g.appendChild(el("line", { x1: SX(B2 + fb), y1: SY(-tbl), x2: SX(B2 + fb), y2: Yr, stroke: "var(--dim)", "stroke-width": 0.7, "stroke-dasharray": "2 2", opacity: 0.5 }));
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

    // ---- DXF export (geometry + dimension lines, in model mm; R12 ASCII) ----
    function buildDXF() {
      var H0 = P.H0, H1 = P.H1, bt = P.bt, N1 = P.N1, B1 = P.B1, B2 = P.B2,
        hk = P.hk, bk = P.bk, tbl = P.tbl, ff = P.ff, fb = P.fb, N = P.N;
      var akr = P.ak * Math.PI / 180, B = B1 + B2, ywt = H1;
      var frun = H1 / N1, topL = -B1 + frun, topR = topL + bt;
      var hasKey = (hk > 0 && bk > 0), kin = hasKey ? hk / Math.tan(akr) : 0;
      var flat = (N <= 0 || H0 <= 0);
      var gx0 = topR, ax = flat ? gx0 : gx0 + H0 / N, ay = flat ? ywt : ywt + H0;
      var plat = Math.max(1500, B2 + 900), bx = ax + plat, kh = hasKey ? hk : 0;
      var stem = [[topL, ywt], [topR, ywt], [B2, 0], [-B1, 0]];
      var key = [[0, 0], [bk + kin, 0], [bk, -hk], [0, -hk]];
      var blinds = hasKey
        ? [[[-B1 - ff, 0], [0, 0], [0, -tbl], [-B1 - ff, -tbl]], [[bk + kin, 0], [B2 + fb, 0], [B2 + fb, -tbl], [bk + kin, -tbl]]]
        : [[[-B1 - ff, 0], [B2 + fb, 0], [B2 + fb, -tbl], [-B1 - ff, -tbl]]];

      var span = Math.max(B + ff + fb, H1 + (flat ? 0 : H0) + kh + tbl);
      var th = span * 0.022, asz = th * 0.95;        // text height / arrow length
      var BLACK = 7, GRAY = 8, BLUE = 5, TEAL = 4, BROWN = 42;
      var e = [];
      function f(n) { return Math.round(n * 1000) / 1000; }
      function L(x1, y1, x2, y2, c) { e.push("0\nLINE\n8\n0\n62\n" + c + "\n10\n" + f(x1) + "\n20\n" + f(y1) + "\n30\n0\n11\n" + f(x2) + "\n21\n" + f(y2) + "\n31\n0\n"); }
      function POLY(p, c) { for (var i = 0; i < p.length; i++) { var a = p[i], b = p[(i + 1) % p.length]; L(a[0], a[1], b[0], b[1], c); } }
      function SOL(x1, y1, x2, y2, x3, y3, c) { e.push("0\nSOLID\n8\n0\n62\n" + c + "\n10\n" + f(x1) + "\n20\n" + f(y1) + "\n30\n0\n11\n" + f(x2) + "\n21\n" + f(y2) + "\n31\n0\n12\n" + f(x3) + "\n22\n" + f(y3) + "\n32\n0\n13\n" + f(x3) + "\n23\n" + f(y3) + "\n33\n0\n"); }
      function ARR(x, y, ux, uy, c) { var bxx = x - asz * ux, byy = y - asz * uy, px = -uy * asz * 0.33, py = ux * asz * 0.33; SOL(x, y, bxx + px, byy + py, bxx - px, byy - py, c); }
      function T(x, y, s, rot, c) { e.push("0\nTEXT\n8\n0\n62\n" + c + "\n10\n0\n20\n0\n30\n0\n40\n" + f(th) + "\n1\n" + s + "\n50\n" + f(rot || 0) + "\n72\n1\n73\n2\n11\n" + f(x) + "\n21\n" + f(y) + "\n31\n0\n"); }
      function DIMH(x1, x2, Y, s) { L(x1, Y, x2, Y, BLUE); ARR(x1, Y, -1, 0, BLUE); ARR(x2, Y, 1, 0, BLUE); T((x1 + x2) / 2, Y + th * 0.85, s, 0, BLUE); }
      function DIMV(X, y1, y2, s) { L(X, y1, X, y2, BLUE); ARR(X, y1, 0, -1, BLUE); ARR(X, y2, 0, 1, BLUE); T(X - th * 0.85, (y1 + y2) / 2, s, 90, BLUE); }
      function W(x1, y1, x2, y2) { L(x1, y1, x2, y2, BLUE); }

      // geometry
      POLY(stem, BLACK); if (hasKey) POLY(key, BLACK);
      blinds.forEach(function (b) { POLY(b, GRAY); });
      L(gx0, ywt, ax, ay, BROWN); L(ax, ay, bx, ay, BROWN);           // ground line
      var qy = ay + asz * 2.2; L(ax, qy, bx, qy, BROWN);              // surcharge q
      for (var i = 0; i <= 5; i++) { var qx = ax + (bx - ax) * (i / 5); L(qx, qy, qx, ay, BROWN); ARR(qx, ay, 0, -1, BROWN); }
      T((ax + bx) / 2, qy + th * 0.8, "q = " + P.q.toFixed(1) + " t/m2", 0, BROWN);

      // linear dimensions
      var colA = -B1 - ff - 3.2 * th, colB = -B1 - ff - 1.4 * th;
      W(-B1, 0, colA, 0); W(topL, ywt, colA, ywt); DIMV(colA, 0, ywt, "H1 = " + H1);
      if (!flat) { W(ax, ay, colA, ay); DIMV(colA, ywt, ay, "H0 = " + H0); }
      if (hasKey) { W(-B1, -hk, colB, -hk); W(-B1, 0, colB, 0); DIMV(colB, -hk, 0, "hk = " + hk); }
      var colR = B2 + fb + 1.6 * th; W(B2 + fb, 0, colR, 0); W(B2 + fb, -tbl, colR, -tbl); DIMV(colR, -tbl, 0, "tbl = " + tbl);
      var ybt = ywt + 1.8 * th; W(topL, ywt, topL, ybt); W(topR, ywt, topR, ybt); DIMH(topL, topR, ybt, "bt = " + bt);
      var lowY = -Math.max(kh, tbl);
      if (hasKey) { W(0, -hk, 0, -hk - 1.4 * th); W(bk, -hk, bk, -hk - 1.4 * th); DIMH(0, bk, -hk - 1.4 * th, "bk = " + bk); }
      var yb1 = lowY - 2.4 * th, yb2 = lowY - 4.0 * th;
      W(-B1, 0, -B1, yb2); W(0, 0, 0, yb1); W(B2, 0, B2, yb2);
      DIMH(-B1, 0, yb1, "B1 = " + B1); DIMH(0, B2, yb1, "B2 = " + B2); DIMH(-B1, B2, yb2, "B = " + B);
      var yff = 1.4 * th; W(-B1, 0, -B1, yff); W(-B1 - ff, 0, -B1 - ff, yff); DIMH(-B1 - ff, -B1, yff, "ff = " + ff);
      W(B2, 0, B2, yff); W(B2 + fb, 0, B2 + fb, yff); DIMH(B2, B2 + fb, yff, "fb = " + fb);

      // slope / angle / callout text
      T((topL + (-B1)) / 2 - th * 0.5, ywt / 2, "1:N1 = 1:" + N1, Math.atan2(ywt, frun) * 180 / Math.PI, TEAL);
      if (flat) T(gx0 + (bx - gx0) * 0.25, ay + th * 0.7, "1:N = 1:" + N, 0, TEAL);
      else T((gx0 + ax) / 2 - th * 0.4, (ywt + ay) / 2 + th * 0.4, "1:N = 1:" + N, Math.atan2(ay - ywt, ax - gx0) * 180 / Math.PI, TEAL);
      if (hasKey) T(bk + kin * 0.5 + th, -hk * 0.45, "ak = " + P.ak + " deg", 0, TEAL);
      T(-B1 * 0.5, -tbl - th * 0.9, "Blinding conc.", 0, GRAY);

      return "0\nSECTION\n2\nENTITIES\n" + e.join("") + "0\nENDSEC\n0\nEOF\n";
    }
    function downloadDXF() {
      var blob = new Blob([buildDXF()], { type: "application/dxf" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = "GravityWall.dxf";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    }
    var dxfBtn = root.querySelector("[data-gw-dxf]");
    if (dxfBtn) dxfBtn.addEventListener("click", downloadDXF);

    _gwDraw = draw;   // latest instance; a single module-level resize listener refits it
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
