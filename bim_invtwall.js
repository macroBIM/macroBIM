/*
    bim_invtwall.js — Inverted-T (cantilever) retaining wall, parametric section (macroBIM Drawings)
    Renders a self-contained SVG section + live dimension inputs into a mount element.
    Entry point: fdraw_invtwall(mountId)   [mountId default: 'mount-draw-invtwall']
    Pure vanilla JS + inline SVG (no Konva / no external deps). Styles are scoped to .iw-root.
*/
(function () {
  "use strict";

  var _iwDraw = null, _iwRT = null;   // current instance's draw() + debounce timer
  window.addEventListener("resize", function () {
    clearTimeout(_iwRT);
    _iwRT = setTimeout(function () { if (_iwDraw) _iwDraw(); }, 120);
  });

  var CSS =
    ".iw-root{--dim:#2563eb;--slope:#1f8e9e;--soil:#b4813a;--found:#6e7e8c;--foundfill:#eef2f6;" +
    "--ink:#182430;--muted:#64748b;--line:#cbd5e1;--hair:#e2e8f0;--panel:#fff;--chip:#f1f5f9;--concrete-ln:#aeb9c6;" +
    "font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:var(--ink);}" +
    ".iw-root *{box-sizing:border-box}" +
    ".iw-mono{font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-variant-numeric:tabular-nums}" +
    ".iw-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:20px;align-items:start}" +
    "@media(max-width:900px){.iw-grid{grid-template-columns:1fr}}" +
    ".iw-card{background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden}" +
    ".iw-hd{display:flex;justify-content:space-between;align-items:center;padding:9px 14px;border-bottom:1px solid var(--hair);background:var(--chip)}" +
    ".iw-ttl{font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;color:var(--muted)}" +
    ".iw-plot{display:block;width:100%;height:auto;background:" +
    "linear-gradient(var(--hair) 1px,transparent 1px) 0 0/26px 26px," +
    "linear-gradient(90deg,var(--hair) 1px,transparent 1px) 0 0/26px 26px;background-color:var(--panel)}" +
    ".iw-inputs{padding:14px}" +
    ".iw-inrow{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px;padding:5px 0;border-bottom:1px dashed var(--hair)}" +
    ".iw-inrow:last-child{border-bottom:0}" +
    ".iw-inrow label{font-size:13px;display:flex;align-items:baseline;gap:8px}" +
    ".iw-inrow .var{font-weight:600;color:var(--dim);min-width:34px;display:inline-block;font-family:ui-monospace,Menlo,Consolas,monospace}" +
    ".iw-inrow .desc{color:var(--muted);font-size:12px}" +
    ".iw-inrow input{width:96px;text-align:right;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink);font-size:13px;font-variant-numeric:tabular-nums}" +
    ".iw-inrow input:focus{outline:2px solid var(--dim);outline-offset:1px;border-color:var(--dim)}" +
    ".iw-unit{color:var(--muted);font-size:11px;margin-left:6px}" +
    ".iw-plot{cursor:grab;touch-action:none;-webkit-user-select:none;user-select:none}.iw-plot:active{cursor:grabbing}" +
    ".iw-hd-r{display:flex;align-items:center;gap:10px}" +
    ".iw-btn{font:inherit;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#fff;" +
    "background:var(--dim);border:1px solid var(--dim);border-radius:6px;padding:5px 12px;cursor:pointer;" +
    "min-width:104px;text-align:center;box-shadow:0 1px 3px rgba(37,99,235,.35);transition:filter .12s,transform .06s}" +
    ".iw-btn:hover{filter:brightness(1.12)}.iw-btn:active{filter:brightness(.94);transform:translateY(1px)}" +
    ".iw-batch-wrap{padding:0 0 10px;margin-bottom:8px;border-bottom:1px dashed var(--hair)}" +
    ".iw-batch-lbl{font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin-bottom:5px}" +
    ".iw-batch-hint{font-weight:400;text-transform:none;letter-spacing:0;color:var(--dim);font-family:ui-monospace,Menlo,Consolas,monospace;font-size:10px}" +
    ".iw-batch{width:100%;resize:none;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1.5;padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink)}" +
    ".iw-batch:focus{outline:2px solid var(--dim);outline-offset:1px;border-color:var(--dim)}";

  // [name, default, description, colour-tag]  (units mm unless noted)
  var VARS = [
    ["Hs", 4050, "Stem height",                  "d"],
    ["st",  300, "Stem top width",               "d"],
    ["fo",   81, "Stem front batter offset",     "s"],
    ["bo",   69, "Stem back batter offset",      "s"],
    ["tb",  400, "Base slab thickness",          "d"],
    ["toe", 450, "Toe length",                   "d"],
    ["heel",2100,"Heel length",                  "d"],
    ["hh",  300, "Heel haunch",                  "d"],
    ["tsf",  50, "Toe top slope (front)",        "d"],
    ["tsb",  50, "Heel top slope (back)",        "d"],
    ["hk",  400, "Shear key depth",              "d"],
    ["bk",  400, "Shear key width",              "d"],
    ["kx", 1950, "Key pos. from base front",     "d"],
    ["tbl", 100, "Blinding thickness",           "f"],
    ["ff",  100, "Blinding front projection",    "f"],
    ["fb",  100, "Blinding back projection",     "f"],
    ["N",   1.5, "Backfill slope  1:N",          "s"],
    ["bh",  300, "Rear soil level run",           "s"],
    ["bd", 1130, "Backfill horizontal distance", "s"],
    ["q",   1.0, "Surcharge q (t/m²)",      "o"]
  ];

  function buildMarkup() {
    return "" +
      "<style>" + CSS + "</style>" +
      "<div class='iw-root'>" +
      "  <div class='iw-grid'>" +
      "    <div class='iw-card'>" +
      "      <div class='iw-hd'><span class='iw-ttl'>Layout</span>" +
      "        <span class='iw-hd-r'><button type='button' class='iw-btn' data-iw-fit>Reset view</button>" +
      "        <span class='iw-ttl iw-mono'>SCALE&nbsp;NTS</span></span></div>" +
      "      <svg class='iw-plot' viewBox='0 0 620 724' role='img' aria-label='Inverted-T wall section (scroll to zoom, drag to pan)'></svg>" +
      "    </div>" +
      "    <div class='iw-card'>" +
      "      <div class='iw-hd'><span class='iw-ttl'>Dimension Input &mdash; live redraw on edit</span>" +
      "        <button type='button' class='iw-btn' data-iw-dxf>DXF out</button></div>" +
      "      <div class='iw-inputs'></div>" +
      "    </div>" +
      "  </div>" +
      "</div>";
  }

  function initGW(root) {
    var P = {}; VARS.forEach(function (v) { P[v[0]] = v[1]; });

    // ---- input form ----
    var box = root.querySelector(".iw-inputs");
    var order = VARS.map(function (v) { return v[0]; });
    function currentCSV() { return order.map(function (k) { return P[k]; }).join(","); }

    // batch input (CSV) — one line, values in VARS order
    var bwrap = document.createElement("div");
    bwrap.className = "iw-batch-wrap";
    bwrap.innerHTML =
      "<div class='iw-batch-lbl'>Batch Input (CSV) <span class='iw-batch-hint'>" + order.join(",") + "</span></div>" +
      "<textarea class='iw-batch' rows='2' spellcheck='false'></textarea>";
    box.appendChild(bwrap);
    var batchTa = bwrap.querySelector(".iw-batch");

    VARS.forEach(function (v) {
      var k = v[0],
        unit = (k === "ak") ? "deg" : (k === "q") ? "t/m²" : (k === "N" || k === "N1") ? "ratio" : "mm",
        step = (k === "q") ? 0.1 : (k === "N" || k === "N1") ? 0.1 : 10;
      var row = document.createElement("div");
      row.className = "iw-inrow";
      row.innerHTML =
        "<label><span class='var'>" + k + "</span><span class='desc'>" + v[2] + "</span></label>" +
        "<span><input class='iw-mono' type='number' step='" + step + "' value='" + v[1] + "' data-k='" + k + "'>" +
        "<span class='iw-unit'>" + unit + "</span></span>";
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
    var svg = root.querySelector(".iw-plot");
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
    var fitBtn = root.querySelector("[data-iw-fit]");
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

      // --- model coords (mm). y=0 = base slab top; x=0 = stem front face at the base ---
      var Hs = P.Hs, st = P.st, fo = P.fo, bo = P.bo, tb = P.tb, toe = P.toe, heel = P.heel, hh = P.hh,
        tsf = P.tsf, tsb = P.tsb, hk = P.hk, bk = P.bk, kx = P.kx, tbl = P.tbl, ff = P.ff, fb = P.fb, N = P.N, bh = P.bh, bd = P.bd;
      var sb = st + fo + bo;                           // stem base width (top width + front/back batter offsets)
      var Nf = Hs > 0 ? fo / Hs : 0, Nb = Hs > 0 ? bo / Hs : 0;   // batters computed from offsets & height (1:Nf front, 1:Nb back)
      var hasKey = (hk > 0 && bk > 0);
      var frontOff = fo;                               // front face lean over the stem height
      var stemTF = frontOff, stemTB = frontOff + st;   // stem top corners (x)
      var baseFront = -toe, baseBack = sb + heel, B = toe + sb + heel;
      var hhc = Math.max(0, Math.min(hh, Hs * 0.9));   // haunch (clamped)
      var xbackHH = sb + (stemTB - sb) * (hhc / Hs);   // stem back-face x at haunch top
      var tsfc = Math.max(0, Math.min(tsf, tb * 0.8)); // toe-top slope drop (clamped)
      var tsbc = Math.max(0, Math.min(tsb, tb * 0.8)); // heel-top slope drop (clamped)

      // [structure] wall outline: stem + base slab (top slopes to toe/heel tips) + heel haunch
      var wall = [
        [stemTF, Hs], [stemTB, Hs],                    // stem top
        [xbackHH, hhc], [sb + hhc, 0],                 // stem back down to haunch, chamfer onto base top
        [baseBack, -tsbc], [baseBack, -tb],            // heel top slopes to tip → heel edge → down
        [baseFront, -tb], [baseFront, -tsfc],          // base bottom → toe edge up to sloped tip
        [0, 0]                                         // toe top slopes back up to stem front base
      ];
      // [structure] shear key below the base
      var kf = baseFront + kx;
      var key = [[kf, -tb], [kf + bk, -tb], [kf + bk, -tb - hk], [kf, -tb - hk]];
      // [foundation] blinding under the base, split around the key (continuous if no key)
      var blT = -tb, blB = -tb - tbl;
      var blinds = hasKey
        ? [[[baseFront - ff, blT], [kf, blT], [kf, blB], [baseFront - ff, blB]],
           [[kf + bk, blT], [baseBack + fb, blT], [baseBack + fb, blB], [kf + bk, blB]]]
        : [[[baseFront - ff, blT], [baseBack + fb, blT], [baseBack + fb, blB], [baseFront - ff, blB]]];

      // backfill on the heel: from stem back-top, level run bh, then slope 1:N over run bd, then horizontal under q
      var flat = (N <= 0 || bd <= 0);
      var gx0 = stemTB, gy0 = Hs;
      var fx = gx0 + bh;                                // end of level (flat) rear-soil run
      var ax = flat ? fx : fx + bd, ay = flat ? Hs : Hs + bd * N;
      var plat = Math.max(1200, heel + 700);
      var bx = ax + plat, by = ay;
      var soilPoly = [[gx0, gy0], [fx, Hs], [ax, ay], [bx, by], [bx, 0], [baseBack, -tsbc], [sb + hhc, 0], [xbackHH, hhc]];

      // --- fit to viewport (viewBox trimmed to content to avoid slack margins) ---
      var keyD = hasKey ? hk : 0;
      var minX = baseFront - ff - 40, maxX = bx + 40;
      var minY = -tb - Math.max(keyD, tbl) - 50, maxY = ay + 12;
      var padL = 128, padR = 30, padT = flat ? 54 : 40, padB = 96;
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
      var cards = root.querySelectorAll(".iw-card");
      var secHd = svg.parentNode && svg.parentNode.querySelector(".iw-hd");
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
        "<pattern id='iwConc' width='7' height='7' patternTransform='rotate(45)' patternUnits='userSpaceOnUse'>" +
        "<line x1='0' y1='0' x2='0' y2='7' stroke='var(--concrete-ln)' stroke-width='0.7'/></pattern>" +
        "<pattern id='iwBlind' width='6' height='6' patternTransform='rotate(-45)' patternUnits='userSpaceOnUse'>" +
        "<rect width='6' height='6' fill='var(--foundfill)'/>" +
        "<line x1='0' y1='0' x2='0' y2='6' stroke='var(--found)' stroke-width='0.6'/></pattern>" +
        "<pattern id='iwSoil' width='14' height='10' patternUnits='userSpaceOnUse'>" +
        "<circle cx='3' cy='3' r='0.9' fill='var(--soil)' opacity='0.5'/>" +
        "<circle cx='10' cy='8' r='0.9' fill='var(--soil)' opacity='0.5'/></pattern>";
      g.appendChild(defs);

      // --- soil on the heel (behind the stem, up the slope, under the surcharge) ---
      g.appendChild(el("polygon", { points: pts(soilPoly), fill: "url(#iwSoil)", stroke: "none" }));

      // --- foundation: blinding concrete (distinct hatch + dashed outline) ---
      blinds.forEach(function (poly) {
        g.appendChild(el("polygon", { points: pts(poly), fill: "url(#iwBlind)", stroke: "var(--found)", "stroke-width": 1, "stroke-dasharray": "4 2" }));
      });

      // --- wall structure: stem + base + haunch (+ shear key), one monolithic concrete ---
      (hasKey ? [wall, key] : [wall]).forEach(function (poly) {
        g.appendChild(el("polygon", { points: pts(poly), fill: "url(#iwConc)", stroke: "var(--ink)", "stroke-width": 1.8, "stroke-linejoin": "round" }));
      });

      // --- ground line: level run bh → 1:N slope → horizontal ---
      g.appendChild(el("polyline", { points: pts([[gx0, gy0], [fx, Hs], [ax, ay], [bx, by]]), fill: "none", stroke: "var(--soil)", "stroke-width": 1.8 }));

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

      // vertical witness helper (dashed blue)
      function vwit(mx, my, Yscr) { g.appendChild(el("line", { x1: SX(mx), y1: SY(my), x2: SX(mx), y2: Yscr, stroke: "var(--dim)", "stroke-width": 0.7, "stroke-dasharray": "2 2", opacity: 0.5 })); }

      // left: stem height Hs, base thickness tb
      var col1 = 40, col2 = 82;
      extS(baseFront, 0, col1); extS(stemTF, Hs, col1); dimVs(col1, 0, Hs, "Hs = " + Hs);
      extS(baseFront, 0, col2); extS(baseFront, -tb, col2); dimVs(col2, -tb, 0, "tb = " + tb);

      // shear key: depth hk (left of key), width bk (below key)
      if (hasKey) {
        var kX = SX(kf) - 18;
        g.appendChild(el("line", { x1: SX(kf), y1: SY(-tb), x2: kX, y2: SY(-tb), stroke: "var(--dim)", "stroke-width": 0.7, "stroke-dasharray": "2 2", opacity: 0.5 }));
        g.appendChild(el("line", { x1: SX(kf), y1: SY(-tb - hk), x2: kX, y2: SY(-tb - hk), stroke: "var(--dim)", "stroke-width": 0.7, "stroke-dasharray": "2 2", opacity: 0.5 }));
        dimVs(kX, -tb - hk, -tb, "hk = " + hk);
      }

      // right: blinding thickness tbl
      var colR = SX(baseBack + fb) + 22;
      extS(baseBack + fb, -tb, colR); extS(baseBack + fb, -tb - tbl, colR);
      dimVs(colR, -tb - tbl, -tb, "tbl = " + tbl, "f", true);

      // top: batter offsets fo | st | bo on one chained dim line (labels spread out, stem is thin) + computed batters on the faces
      var Yst = SY(Hs) - 42;
      function fwit(mx) { g.appendChild(el("line", { x1: SX(mx), y1: SY(0), x2: SX(mx), y2: Yst, stroke: "var(--dim)", "stroke-width": 0.6, "stroke-dasharray": "3 3", opacity: 0.33 })); }
      fwit(0); fwit(sb);                                // reference projections up from the base corners
      vwit(stemTF, Hs, Yst); vwit(stemTB, Hs, Yst);
      dimLine(g, SX(0), Yst, SX(sb), Yst);             // one line across the base width
      [stemTF, stemTB].forEach(function (mx) { g.appendChild(el("line", { x1: SX(mx), y1: Yst - 3, x2: SX(mx), y2: Yst + 3, stroke: "var(--dim)", "stroke-width": 1 })); });
      txt(g, (SX(stemTF) + SX(stemTB)) / 2, Yst - 9, "st = " + st, "d");   // middle segment (widest)
      if (fo > 0) {                                    // fo pulled out left with a leader (segment is thin)
        var foMid = (SX(0) + SX(stemTF)) / 2, foLX = SX(0) - 16;
        g.appendChild(el("line", { x1: foMid, y1: Yst, x2: foLX, y2: Yst - 20, stroke: "var(--dim)", "stroke-width": 0.6, opacity: 0.6 }));
        txt(g, foLX - 2, Yst - 22, "fo = " + fo, "d", 0, "end");
      }
      if (bo > 0) {                                    // bo pulled out right with a leader
        var boMid = (SX(stemTB) + SX(sb)) / 2, boRX = SX(sb) + 16;
        g.appendChild(el("line", { x1: boMid, y1: Yst, x2: boRX, y2: Yst - 20, stroke: "var(--dim)", "stroke-width": 0.6, opacity: 0.6 }));
        txt(g, boRX + 2, Yst - 22, "bo = " + bo, "d", 0, "start");
      }
      if (frontOff > 0) txt(g, SX(stemTF / 2) - 8, SY(Hs / 2), "1:" + Nf.toFixed(3), "s", -(Math.atan(Hs / Math.max(frontOff, 1)) * 180 / Math.PI), "middle");
      if (bo > 0) txt(g, SX((stemTB + sb) / 2) + 8, SY(Hs * 0.55), "1:" + Nb.toFixed(3), "s", (Math.atan(Hs / Math.max(bo, 1)) * 180 / Math.PI), "middle");

      // shear-key width bk (below the key)
      if (hasKey) {
        var Ybk = SY(-tb - hk) + 16;
        vwit(kf, -tb - hk, Ybk); vwit(kf + bk, -tb - hk, Ybk);
        dimHscreen(Ybk, kf, kf + bk, "bk = " + bk);
      }

      // bottom stack: toe / sb / heel + ff / fb (upper row), B (lower row)
      var yB0 = SY(-tb - Math.max(keyD, tbl));
      var Yseg = yB0 + 24, Ytot = yB0 + 46;
      vwit(baseFront, 0, Ytot); vwit(baseBack, 0, Ytot); vwit(0, 0, Yseg); vwit(sb, 0, Yseg);
      dimHscreen(Yseg, baseFront, 0, "toe = " + toe);
      dimHscreen(Yseg, 0, sb, "sb = " + sb);
      dimHscreen(Yseg, sb, baseBack, "heel = " + heel);
      dimHscreen(Ytot, baseFront, baseBack, "B = " + B);
      vwit(baseFront - ff, -tb, Yseg); vwit(baseBack + fb, -tb, Yseg);
      dimHscreen(Yseg, baseFront - ff, baseFront, "ff = " + ff);
      dimHscreen(Yseg, baseBack, baseBack + fb, "fb = " + fb);

      // base-top slope: toe-tip drop tsf (front), heel-tip drop tsb (back)
      if (tsfc > 0) {
        var Xtt = SX(baseFront) - 13;                  // toe tip (left of tip)
        g.appendChild(el("line", { x1: SX(baseFront), y1: SY(0), x2: Xtt, y2: SY(0), stroke: "var(--dim)", "stroke-width": 0.7, "stroke-dasharray": "2 2", opacity: 0.5 }));
        g.appendChild(el("line", { x1: SX(baseFront), y1: SY(-tsfc), x2: Xtt, y2: SY(-tsfc), stroke: "var(--dim)", "stroke-width": 0.7, "stroke-dasharray": "2 2", opacity: 0.5 }));
        dimVs(Xtt, -tsfc, 0, "tsf = " + tsf);
      }
      if (tsbc > 0) {
        var Xht = SX(baseBack) + 13;                   // heel tip (right of tip)
        g.appendChild(el("line", { x1: SX(baseBack), y1: SY(0), x2: Xht, y2: SY(0), stroke: "var(--dim)", "stroke-width": 0.7, "stroke-dasharray": "2 2", opacity: 0.5 }));
        g.appendChild(el("line", { x1: SX(baseBack), y1: SY(-tsbc), x2: Xht, y2: SY(-tsbc), stroke: "var(--dim)", "stroke-width": 0.7, "stroke-dasharray": "2 2", opacity: 0.5 }));
        dimVs(Xht, -tsbc, 0, "tsb = " + tsb, "d", true);
      }

      // rear soil level run bh + backfill slope run bd (top) + 1:N slope label
      var Ybd = SY(ay) - 30;
      if (bh > 0) {
        vwit(gx0, gy0, Ybd); vwit(fx, Hs, Ybd);
        dimLine(g, SX(gx0), Ybd, SX(fx), Ybd);
        txt(g, (SX(gx0) + SX(fx)) / 2, Ybd - 9, "bh = " + bh, "d");
      }
      if (!flat) {
        vwit(fx, Hs, Ybd); vwit(ax, ay, Ybd);
        dimLine(g, SX(fx), Ybd, SX(ax), Ybd);
        txt(g, (SX(fx) + SX(ax)) / 2, Ybd - 9, "bd = " + bd, "d");
      }
      var gmx = flat ? fx + plat * 0.3 : (fx + ax) / 2, gmy = flat ? Hs : (Hs + ay) / 2;
      txt(g, SX(gmx) - 6, SY(gmy) - 6, "1:N = 1:" + N, "s", flat ? 0 : -(Math.atan(N) * 180 / Math.PI), "middle");

      // heel haunch callout
      if (hhc > 0) {
        var hmx = (xbackHH + sb + hhc) / 2, hmy = hhc / 2;
        g.appendChild(el("line", { x1: SX(hmx), y1: SY(hmy), x2: SX(hmx) + 26, y2: SY(hmy), stroke: "var(--muted)", "stroke-width": 0.7 }));
        txt(g, SX(hmx) + 30, SY(hmy), "haunch " + hh, "d", 0, "start");
      }

      // blinding-concrete callout (toe side)
      txt(g, SX((baseFront - ff + Math.min(kf, baseBack)) / 2), SY(-tb - tbl) + 15, "Blinding conc.", "f");
    }

    // ---- DXF export (geometry + dimension lines, in model mm; R12 ASCII) ----
    function buildDXF() {
      var Hs = P.Hs, st = P.st, fo = P.fo, bo = P.bo, tb = P.tb, toe = P.toe, heel = P.heel, hh = P.hh,
        tsf = P.tsf, tsb = P.tsb, hk = P.hk, bk = P.bk, kx = P.kx, tbl = P.tbl, ff = P.ff, fb = P.fb, N = P.N, bh = P.bh, bd = P.bd;
      var sb = st + fo + bo;
      var Nf = Hs > 0 ? fo / Hs : 0, Nb = Hs > 0 ? bo / Hs : 0;
      var hasKey = (hk > 0 && bk > 0);
      var frontOff = fo;
      var stemTF = frontOff, stemTB = frontOff + st;
      var baseFront = -toe, baseBack = sb + heel, B = toe + sb + heel;
      var hhc = Math.max(0, Math.min(hh, Hs * 0.9));
      var xbackHH = sb + (stemTB - sb) * (hhc / Hs);
      var tsfc = Math.max(0, Math.min(tsf, tb * 0.8)), tsbc = Math.max(0, Math.min(tsb, tb * 0.8));
      var wall = [
        [stemTF, Hs], [stemTB, Hs], [xbackHH, hhc], [sb + hhc, 0],
        [baseBack, -tsbc], [baseBack, -tb], [baseFront, -tb], [baseFront, -tsfc], [0, 0]
      ];
      var kf = baseFront + kx;
      var key = [[kf, -tb], [kf + bk, -tb], [kf + bk, -tb - hk], [kf, -tb - hk]];
      var blT = -tb, blB = -tb - tbl;
      var blinds = hasKey
        ? [[[baseFront - ff, blT], [kf, blT], [kf, blB], [baseFront - ff, blB]],
           [[kf + bk, blT], [baseBack + fb, blT], [baseBack + fb, blB], [kf + bk, blB]]]
        : [[[baseFront - ff, blT], [baseBack + fb, blT], [baseBack + fb, blB], [baseFront - ff, blB]]];
      var flat = (N <= 0 || bd <= 0);
      var gx0 = stemTB, gy0 = Hs;
      var fx = gx0 + bh;
      var ax = flat ? fx : fx + bd, ay = flat ? Hs : Hs + bd * N;
      var plat = Math.max(1200, heel + 700), bx = ax + plat;
      var kh = hasKey ? hk : 0;

      var span = Math.max(B + ff + fb, Hs + (flat ? 0 : bd * N) + tb + Math.max(kh, tbl));
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
      POLY(wall, BLACK); if (hasKey) POLY(key, BLACK);
      blinds.forEach(function (b) { POLY(b, GRAY); });
      L(gx0, gy0, fx, Hs, BROWN); L(fx, Hs, ax, ay, BROWN); L(ax, ay, bx, ay, BROWN);   // ground line: level bh, slope, platform
      var qy = ay + asz * 2.2; L(ax, qy, bx, qy, BROWN);              // surcharge q
      for (var i = 0; i <= 5; i++) { var qx = ax + (bx - ax) * (i / 5); L(qx, qy, qx, ay, BROWN); ARR(qx, ay, 0, -1, BROWN); }
      T((ax + bx) / 2, qy + th * 0.8, "q = " + P.q.toFixed(1) + " t/m2", 0, BROWN);

      // linear dimensions
      var colA = baseFront - ff - 3.4 * th, colB = baseFront - ff - 1.5 * th;
      W(baseFront, 0, colA, 0); W(stemTF, Hs, colA, Hs); DIMV(colA, 0, Hs, "Hs = " + Hs);
      W(baseFront, -tb, colB, -tb); W(baseFront, 0, colB, 0); DIMV(colB, -tb, 0, "tb = " + tb);
      if (hasKey) { var colK = kf - 1.6 * th; W(kf, -tb, colK, -tb); W(kf, -tb - hk, colK, -tb - hk); DIMV(colK, -tb - hk, -tb, "hk = " + hk); }
      var colR = baseBack + fb + 1.6 * th; W(baseBack + fb, -tb, colR, -tb); W(baseBack + fb, -tb - tbl, colR, -tb - tbl); DIMV(colR, -tb - tbl, -tb, "tbl = " + tbl);
      var yst = Hs + 1.8 * th;
      W(0, 0, 0, yst); W(sb, 0, sb, yst); W(stemTF, Hs, stemTF, yst); W(stemTB, Hs, stemTB, yst);
      L(0, yst, sb, yst, BLUE); ARR(0, yst, -1, 0, BLUE); ARR(sb, yst, 1, 0, BLUE);   // one chained dim line
      L(stemTF, yst - th * 0.3, stemTF, yst + th * 0.3, BLUE); L(stemTB, yst - th * 0.3, stemTB, yst + th * 0.3, BLUE);   // interior ticks
      if (fo > 0) T(0 - 3.5 * th, yst + th * 0.85, "fo = " + fo, 0, BLUE);
      T((stemTF + stemTB) / 2, yst + th * 0.85, "st = " + st, 0, BLUE);
      if (bo > 0) T(sb + 3.5 * th, yst + th * 0.85, "bo = " + bo, 0, BLUE);
      if (hasKey) { W(kf, -tb - hk, kf, -tb - hk - 1.4 * th); W(kf + bk, -tb - hk, kf + bk, -tb - hk - 1.4 * th); DIMH(kf, kf + bk, -tb - hk - 1.4 * th, "bk = " + bk); }
      var lowY = -tb - Math.max(kh, tbl);
      var yb1 = lowY - 2.4 * th, yb2 = lowY - 4.0 * th;
      W(baseFront, -tb, baseFront, yb2); W(0, -tb, 0, yb1); W(sb, -tb, sb, yb1); W(baseBack, -tb, baseBack, yb2);
      DIMH(baseFront, 0, yb1, "toe = " + toe); DIMH(0, sb, yb1, "sb = " + sb); DIMH(sb, baseBack, yb1, "heel = " + heel); DIMH(baseFront, baseBack, yb2, "B = " + B);
      W(baseFront - ff, -tb, baseFront - ff, yb1); DIMH(baseFront - ff, baseFront, yb1, "ff = " + ff);
      W(baseBack + fb, -tb, baseBack + fb, yb1); DIMH(baseBack, baseBack + fb, yb1, "fb = " + fb);
      if (tsfc > 0) { var xtt = baseFront - 1.4 * th; W(baseFront, 0, xtt, 0); W(baseFront, -tsfc, xtt, -tsfc); DIMV(xtt, -tsfc, 0, "tsf = " + tsf); }
      if (tsbc > 0) { var xht = baseBack + 1.4 * th; W(baseBack, 0, xht, 0); W(baseBack, -tsbc, xht, -tsbc); DIMV(xht, -tsbc, 0, "tsb = " + tsb); }
      var ybd = ay + 1.8 * th;
      if (bh > 0) { W(gx0, gy0, gx0, ybd); W(fx, Hs, fx, ybd); DIMH(gx0, fx, ybd, "bh = " + bh); }
      if (!flat) { W(fx, Hs, fx, ybd); W(ax, ay, ax, ybd); DIMH(fx, ax, ybd, "bd = " + bd); }

      // slope / batter / callout text (batters computed from offsets & height)
      if (frontOff > 0) T(stemTF / 2 - th * 0.5, Hs / 2, "1:" + Nf.toFixed(3), Math.atan2(Hs, Math.max(frontOff, 1)) * 180 / Math.PI, TEAL);
      if (bo > 0) T((stemTB + sb) / 2 + th * 0.5, Hs * 0.55, "1:" + Nb.toFixed(3), Math.atan2(Hs, -Math.max(bo, 1)) * 180 / Math.PI, TEAL);
      if (flat) T(fx + (bx - fx) * 0.25, ay + th * 0.7, "1:N = 1:" + N, 0, TEAL);
      else T((fx + ax) / 2 - th * 0.4, (Hs + ay) / 2 + th * 0.4, "1:N = 1:" + N, Math.atan2(ay - Hs, ax - fx) * 180 / Math.PI, TEAL);
      if (hhc > 0) T((xbackHH + sb + hhc) / 2 + th, hhc / 2, "haunch " + hh, 0, GRAY);
      T((baseFront - ff + Math.min(kf, baseBack)) / 2, -tb - tbl - th * 0.9, "Blinding conc.", 0, GRAY);

      return "0\nSECTION\n2\nENTITIES\n" + e.join("") + "0\nENDSEC\n0\nEOF\n";
    }
    function downloadDXF() {
      var blob = new Blob([buildDXF()], { type: "application/dxf" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = "InvtWall.dxf";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    }
    var dxfBtn = root.querySelector("[data-iw-dxf]");
    if (dxfBtn) dxfBtn.addEventListener("click", downloadDXF);

    _iwDraw = draw;   // latest instance; a single module-level resize listener refits it
    draw();
  }

  // ---- public entry point (matches macroBIM fdraw_* convention) ----
  window.fdraw_invtwall = function (mountId) {
    mountId = mountId || "mount-draw-invtwall";
    var mount = document.getElementById(mountId);
    if (!mount) return;
    if (mount.querySelector(".iw-root")) return; // already built — keep current state
    mount.innerHTML = buildMarkup();
    initGW(mount.querySelector(".iw-root"));
  };
})();
