/*
    bim_invtwall_test.js — Inverted-T (cantilever) retaining wall, parametric section (TEST build)
    Loaded only by layout_body_test.js so drawing changes can be trialled without touching the
    production bim_invtwall.js. Promote by copying this file over bim_invtwall.js when approved.
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
    ".iw-hd{display:flex;justify-content:space-between;align-items:center;padding:11px 16px;border-bottom:1px solid var(--hair);background:var(--chip)}" +
    ".iw-ttl{font-size:15px;font-weight:600;color:#0f172a;display:inline-flex;align-items:center}" +
    ".iw-ttl::before{content:'';display:inline-block;width:4px;height:15px;border-radius:2px;background:#2563eb;margin-right:9px;flex-shrink:0}" +
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
    ["H0", 1500, "Backfill height",               "s"],
    ["Df", 1000, "Front soil depth",              "s"],
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
        tsf = P.tsf, tsb = P.tsb, hk = P.hk, bk = P.bk, kx = P.kx, tbl = P.tbl, ff = P.ff, fb = P.fb, N = P.N, bh = P.bh, H0 = P.H0, Df = P.Df;
      var sb = st + fo + bo;                           // stem base width (top width + front/back batter offsets)
      var hasKey = (hk > 0 && bk > 0);
      var frontOff = fo;                               // front face lean over the stem height
      var stemTF = frontOff, stemTB = frontOff + st;   // stem top corners (x)
      var baseFront = -toe, baseBack = sb + heel, B = toe + sb + heel;
      var tsfc = Math.max(0, Math.min(tsf, tb * 0.8)); // toe-top slope drop (clamped)
      var tsbc = Math.max(0, Math.min(tsb, tb * 0.8)); // heel-top slope drop (clamped)
      // tb is the base-slab thickness at the (toe) tip, EXCLUDING the top slope; the slab bottom
      // therefore sits at -(tb + tsfc) so the tip face reads exactly tb and tsf stacks above it.
      var bB = tb + tsfc;
      // Hs is the FULL wall height from the slab bottom (-bB, = blinding top) to the stem top,
      // so the stem top sits at Ht = Hs - bB above the base top.
      var Ht = Math.max(1, Hs - bB);
      var Nf = fo / Ht, Nb = bo / Ht;                  // batters over the stem height (1:Nf front, 1:Nb back)
      var hhc = Math.max(0, Math.min(hh, Ht * 0.9));   // haunch (clamped)
      var xbackHH = sb + (stemTB - sb) * (hhc / Ht);   // stem back-face x at haunch top

      // [structure] wall outline: stem + base slab (top slopes to toe/heel tips) + heel haunch
      var wall = [
        [stemTF, Ht], [stemTB, Ht],                    // stem top
        [xbackHH, hhc], [sb + hhc, 0],                 // stem back down to haunch, chamfer onto base top
        [baseBack, -tsbc], [baseBack, -bB],            // heel top slopes to tip → heel edge → down
        [baseFront, -bB], [baseFront, -tsfc],          // base bottom → toe edge up to sloped tip
        [0, 0]                                         // toe top slopes back up to stem front base
      ];
      // [structure] shear key below the base
      var kf = baseFront + kx;
      var key = [[kf, -bB], [kf + bk, -bB], [kf + bk, -bB - hk], [kf, -bB - hk]];
      // [foundation] blinding under the base, split around the key (continuous if no key)
      var blT = -bB, blB = -bB - tbl;
      var blinds = hasKey
        ? [[[baseFront - ff, blT], [kf, blT], [kf, blB], [baseFront - ff, blB]],
           [[kf + bk, blT], [baseBack + fb, blT], [baseBack + fb, blB], [kf + bk, blB]]]
        : [[[baseFront - ff, blT], [baseBack + fb, blT], [baseBack + fb, blB], [baseFront - ff, blB]]];

      // backfill on the heel: from stem back-top, level run bh, then slope 1:N rising by H0 (run H0/N), then horizontal under q
      var flat = (N <= 0 || H0 <= 0);
      var gx0 = stemTB, gy0 = Ht;
      var fx = gx0 + bh;                                // end of level (flat) rear-soil run
      var ax = flat ? fx : fx + H0 / N, ay = flat ? Ht : Ht + H0;
      var plat = Math.max(1200, heel + 700);
      var bx = ax + plat, by = ay;
      var soilPoly = [[gx0, gy0], [fx, Ht], [ax, ay], [bx, by], [bx, 0], [baseBack, -tsbc], [sb + hhc, 0], [xbackHH, hhc]];

      // front (passive-side) soil on the toe: surface height Df measured from the slab bottom (-bB), extending 2×toe in front
      var Dfy = Math.min(Df - bB, Ht * 0.95);          // front ground-surface y (Df is from the slab bottom, like Hs)
      var hasFront = (Dfy > 0);
      var xfDf = frontOff * Math.max(Dfy, 0) / Ht;     // stem front-face x at the ground surface
      var fgL = baseFront - toe;                        // front-soil left extent = 2×toe in front of the stem front
      var frontSoil = [[xfDf, Dfy], [fgL, Dfy], [fgL, 0], [baseFront, -tsfc], [0, 0]];

      // --- fit to viewport (viewBox trimmed to content to avoid slack margins) ---
      var keyD = hasKey ? hk : 0;
      var minX = Math.min(baseFront - ff, hasFront ? fgL : baseFront) - 40, maxX = bx + 40;
      var minY = -bB - Math.max(keyD, tbl) - 50, maxY = ay + 12;
      var padL = 128, padR = 30, padT = flat ? 58 : 50, padB = 66;
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

      // --- front (passive) soil on the toe ---
      if (hasFront) g.appendChild(el("polygon", { points: pts(frontSoil), fill: "url(#iwSoil)", stroke: "none" }));

      // --- foundation: blinding concrete (distinct hatch + dashed outline) ---
      blinds.forEach(function (poly) {
        g.appendChild(el("polygon", { points: pts(poly), fill: "url(#iwBlind)", stroke: "var(--found)", "stroke-width": 1, "stroke-dasharray": "4 2" }));
      });

      // --- wall structure: stem + base + haunch (+ shear key), one monolithic concrete ---
      (hasKey ? [wall, key] : [wall]).forEach(function (poly) {
        g.appendChild(el("polygon", { points: pts(poly), fill: "url(#iwConc)", stroke: "var(--ink)", "stroke-width": 1.8, "stroke-linejoin": "round" }));
      });

      // --- ground line: level run bh → 1:N slope → horizontal ---
      g.appendChild(el("polyline", { points: pts([[gx0, gy0], [fx, Ht], [ax, ay], [bx, by]]), fill: "none", stroke: "var(--soil)", "stroke-width": 1.8 }));

      // --- front ground surface line + natural-ground hachure symbol (toe side, extends 2×toe) ---
      if (hasFront) {
        var fgY = SY(Dfy), fgXr = SX(xfDf), fgXl = SX(fgL);
        g.appendChild(el("line", { x1: fgXl, y1: fgY, x2: fgXr, y2: fgY, stroke: "var(--soil)", "stroke-width": 1.8 }));
        for (var hi = 0; hi < 5; hi++) {                 // short 45° hachures hanging below the line
          var hx = fgXl + 7 + hi * 9;
          g.appendChild(el("line", { x1: hx, y1: fgY, x2: hx - 5, y2: fgY + 5, stroke: "var(--soil)", "stroke-width": 1 }));
        }
      }

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

      // left: full wall height Hs (slab bottom → stem top), backfill height H0 (above), tip thickness tb
      var col1 = 40, col2 = 82;
      extS(baseFront, -bB, col1); extS(stemTF, Ht, col1); dimVs(col1, -bB, Ht, "Hs = " + Hs);
      if (!flat) { extS(ax, ay, col1); dimVs(col1, Ht, ay, "H0 = " + H0); }
      // tb: base thickness at the TIP (base bottom → toe-tip top), excludes the tsf slope; sits INNER (swapped with Df)
      var colTb = SX(baseFront) - 30;
      extS(baseFront, -tsfc, colTb); extS(baseFront, -bB, colTb); dimVs(colTb, -bB, -tsfc, "tb = " + tb);

      // shear key: depth hk (left of key), width bk (below key)
      if (hasKey) {
        var kX = SX(kf) - 18;
        g.appendChild(el("line", { x1: SX(kf), y1: SY(-bB), x2: kX, y2: SY(-bB), stroke: "var(--dim)", "stroke-width": 0.7, "stroke-dasharray": "2 2", opacity: 0.5 }));
        g.appendChild(el("line", { x1: SX(kf), y1: SY(-bB - hk), x2: kX, y2: SY(-bB - hk), stroke: "var(--dim)", "stroke-width": 0.7, "stroke-dasharray": "2 2", opacity: 0.5 }));
        dimVs(kX, -bB - hk, -bB, "hk = " + hk);
      }

      // right: blinding thickness tbl
      var colR = SX(baseBack + fb) + 22;
      extS(baseBack + fb, -bB, colR); extS(baseBack + fb, -bB - tbl, colR);
      dimVs(colR, -bB - tbl, -bB, "tbl = " + tbl, "f", true);

      // top: stem-top thickness st ABOVE the dim line; front/back batter offsets fo | bo BELOW it (so nothing overlaps)
      var Yst = SY(Ht) - 40;
      function fwit(mx) { g.appendChild(el("line", { x1: SX(mx), y1: SY(0), x2: SX(mx), y2: Yst, stroke: "var(--dim)", "stroke-width": 0.6, "stroke-dasharray": "3 3", opacity: 0.33 })); }
      fwit(0); fwit(sb);                                // reference projections up from the base corners
      vwit(stemTF, Ht, Yst); vwit(stemTB, Ht, Yst);
      dimLine(g, SX(stemTF), Yst, SX(stemTB), Yst);    // st: dimensioned between the stem TOP corners (top width)
      if (fo > 0) dimLine(g, SX(0), Yst, SX(stemTF), Yst);        // fo: base-front → top-front batter offset
      if (bo > 0) dimLine(g, SX(stemTB), Yst, SX(sb), Yst);       // bo: top-back → base-back batter offset
      txt(g, (SX(stemTF) + SX(stemTB)) / 2, Yst - 9, "st = " + st, "d");                    // st: stem-TOP width, ABOVE
      if (fo > 0) txt(g, SX(stemTF) - 3, Yst + 13, "fo = " + fo, "d", 0, "end");            // fo: BELOW, left of the stem
      if (bo > 0) txt(g, SX(stemTB) + 3, Yst + 13, "bo = " + bo, "d", 0, "start");          // bo: BELOW, right of the stem
      if (frontOff > 0) txt(g, SX(stemTF / 2) - 8, SY(Ht / 2), "1:" + Nf.toFixed(3), "s", -(Math.atan(Ht / Math.max(frontOff, 1)) * 180 / Math.PI), "middle");
      if (bo > 0) txt(g, SX((stemTB + sb) / 2) + 8, SY(Ht * 0.55), "1:" + Nb.toFixed(3), "s", (Math.atan(Ht / Math.max(bo, 1)) * 180 / Math.PI), "middle");

      // ===== base plan dimensions, SPLIT above / below the slab =====
      // ABOVE the base — base-top subdivisions + stem base thickness: toe | sb | heel
      // labels sit ABOVE the dim line, spread to the segment ends so the narrow toe/sb never collide
      var Yabove = SY(0) - 46, Ylab = Yabove - 9;
      vwit(baseFront, 0, Yabove); vwit(0, 0, Yabove); vwit(sb, 0, Yabove); vwit(baseBack, 0, Yabove);
      dimLine(g, SX(baseFront), Yabove, SX(0), Yabove);
      dimLine(g, SX(0), Yabove, SX(sb), Yabove);
      dimLine(g, SX(sb), Yabove, SX(baseBack), Yabove);
      txt(g, (SX(baseFront) + SX(0)) / 2, Ylab, "toe = " + toe, "d");                   // toe: on the line
      txt(g, (SX(sb) + SX(baseBack)) / 2, Ylab, "heel = " + heel, "d");                 // heel: on the line (wide)
      txt(g, (SX(0) + SX(sb)) / 2, Yabove - 22, "sb = " + sb, "d");                     // sb raised (narrow, would hit toe); bracketed by its witness lines

      // BELOW the base — underside chain (blinding + shear-key horizontals) then total width B
      var yB0 = SY(-bB - Math.max(keyD, tbl));
      var Yseg = yB0 + 24, Ytot = yB0 + 46;
      vwit(baseFront - ff, -bB, Yseg); vwit(baseFront, -bB, Yseg); vwit(baseBack, -bB, Yseg); vwit(baseBack + fb, -bB, Yseg);
      dimHscreen(Yseg, baseFront - ff, baseFront, "ff = " + ff);
      dimHscreen(Yseg, baseBack, baseBack + fb, "fb = " + fb);
      if (hasKey) {
        vwit(kf, -bB - hk, Yseg); vwit(kf + bk, -bB - hk, Yseg);
        dimHscreen(Yseg, baseFront, kf, "kx = " + kx);                                  // base front → shear key
        dimHscreen(Yseg, kf, kf + bk, "bk = " + bk);                                    // key width
        dimHscreen(Yseg, kf + bk, baseBack, "" + Math.round(baseBack - kf - bk));       // key → base back (derived)
      }
      vwit(baseFront, -bB, Ytot); vwit(baseBack, -bB, Ytot);
      dimHscreen(Ytot, baseFront, baseBack, "B = " + B);

      // base-top slope: toe-tip drop tsf (front), heel-tip drop tsb (back)
      if (tsfc > 0) {
        var Xtt = SX(baseFront) - 13;                  // toe tip (left of tip)
        g.appendChild(el("line", { x1: SX(baseFront), y1: SY(0), x2: Xtt, y2: SY(0), stroke: "var(--dim)", "stroke-width": 0.7, "stroke-dasharray": "2 2", opacity: 0.5 }));
        g.appendChild(el("line", { x1: SX(baseFront), y1: SY(-tsfc), x2: Xtt, y2: SY(-tsfc), stroke: "var(--dim)", "stroke-width": 0.7, "stroke-dasharray": "2 2", opacity: 0.5 }));
        dimVs(Xtt, -tsfc, 0, "tsf = " + tsf);
      }
      // front soil depth Df (toe side): from the slab bottom up to the front ground surface; sits OUTER (swapped with tb)
      if (hasFront) {
        var dfCol = col2;
        g.appendChild(el("line", { x1: SX(baseFront), y1: SY(-bB), x2: dfCol, y2: SY(-bB), stroke: "var(--dim)", "stroke-width": 0.7, "stroke-dasharray": "2 2", opacity: 0.5 }));
        g.appendChild(el("line", { x1: SX(baseFront), y1: SY(Dfy), x2: dfCol, y2: SY(Dfy), stroke: "var(--dim)", "stroke-width": 0.7, "stroke-dasharray": "2 2", opacity: 0.5 }));
        dimVs(dfCol, -bB, Dfy, "Df = " + Df);
      }
      // heel tip: top slope tsb (at the tip) + rear base thickness tbr (own column past the blinding, excludes tsb)
      var Xht = SX(baseBack) + 13;                      // heel tip (right of tip)
      function hwit(my, Xto) { g.appendChild(el("line", { x1: SX(baseBack), y1: SY(my), x2: Xto, y2: SY(my), stroke: "var(--dim)", "stroke-width": 0.7, "stroke-dasharray": "2 2", opacity: 0.5 })); }
      if (tsbc > 0) { hwit(0, Xht); hwit(-tsbc, Xht); dimVs(Xht, -tsbc, 0, "tsb = " + tsb, "d", true); }
      var colRb = colR + 26;
      hwit(-bB, colRb); hwit(-tsbc, colRb);
      dimVs(colRb, -bB, -tsbc, "tbr = " + Math.round(bB - tsbc), "d", true);

      // rear soil level run bh (top); H0 (backfill height) is dimensioned on the left; 1:N slope label along the slope
      var Ybd = SY(ay) - 30;
      if (bh > 0) {
        vwit(gx0, gy0, Ybd); vwit(fx, Ht, Ybd);
        dimLine(g, SX(gx0), Ybd, SX(fx), Ybd);
        txt(g, (SX(gx0) + SX(fx)) / 2, Ybd - 9, "bh = " + bh, "d");
      }
      var gmx = flat ? fx + plat * 0.3 : (fx + ax) / 2, gmy = flat ? Ht : (Ht + ay) / 2;
      txt(g, SX(gmx) - 6, SY(gmy) - 6, "1:N = 1:" + N, "s", flat ? 0 : -(Math.atan(N) * 180 / Math.PI), "middle");

      // heel haunch callout (blue leader with arrowhead pointing at the haunch)
      if (hhc > 0) {
        var hmx = (xbackHH + sb + hhc) / 2, hmy = hhc / 2;
        var hpx = SX(hmx), hpy = SY(hmy), htx = hpx + 30;
        g.appendChild(el("line", { x1: hpx, y1: hpy, x2: htx, y2: hpy, stroke: "var(--dim)", "stroke-width": 1 }));
        arrow(g, hpx, hpy, -1, 0, "var(--dim)");
        txt(g, htx + 4, hpy, "haunch " + hh + " × " + hh, "d", 0, "start");
      }

      // blinding-concrete callout (toe side)
      txt(g, SX((baseFront - ff + Math.min(kf, baseBack)) / 2), SY(-bB - tbl) + 15, "Blinding conc.", "f");
    }

    // ---- DXF export (geometry + dimension lines, in model mm; R12 ASCII) ----
    function buildDXF() {
      var Hs = P.Hs, st = P.st, fo = P.fo, bo = P.bo, tb = P.tb, toe = P.toe, heel = P.heel, hh = P.hh,
        tsf = P.tsf, tsb = P.tsb, hk = P.hk, bk = P.bk, kx = P.kx, tbl = P.tbl, ff = P.ff, fb = P.fb, N = P.N, bh = P.bh, H0 = P.H0, Df = P.Df;
      var sb = st + fo + bo;
      var hasKey = (hk > 0 && bk > 0);
      var frontOff = fo;
      var stemTF = frontOff, stemTB = frontOff + st;
      var baseFront = -toe, baseBack = sb + heel, B = toe + sb + heel;
      var tsfc = Math.max(0, Math.min(tsf, tb * 0.8)), tsbc = Math.max(0, Math.min(tsb, tb * 0.8));
      var bB = tb + tsfc;                              // slab bottom: tb is the tip thickness, tsf stacks above it
      var Ht = Math.max(1, Hs - bB);                   // stem top y (Hs = full slab-bottom → stem-top height)
      var Nf = fo / Ht, Nb = bo / Ht;
      var Dfy = Math.min(Df - bB, Ht * 0.95), hasFront = (Dfy > 0), xfDf = frontOff * Math.max(Dfy, 0) / Ht;  // surface y (Df from slab bottom)
      var fgL = baseFront - toe;                        // front-soil extent = 2×toe in front of the stem
      var hhc = Math.max(0, Math.min(hh, Ht * 0.9));
      var xbackHH = sb + (stemTB - sb) * (hhc / Ht);
      var wall = [
        [stemTF, Ht], [stemTB, Ht], [xbackHH, hhc], [sb + hhc, 0],
        [baseBack, -tsbc], [baseBack, -bB], [baseFront, -bB], [baseFront, -tsfc], [0, 0]
      ];
      var kf = baseFront + kx;
      var key = [[kf, -bB], [kf + bk, -bB], [kf + bk, -bB - hk], [kf, -bB - hk]];
      var blT = -bB, blB = -bB - tbl;
      var blinds = hasKey
        ? [[[baseFront - ff, blT], [kf, blT], [kf, blB], [baseFront - ff, blB]],
           [[kf + bk, blT], [baseBack + fb, blT], [baseBack + fb, blB], [kf + bk, blB]]]
        : [[[baseFront - ff, blT], [baseBack + fb, blT], [baseBack + fb, blB], [baseFront - ff, blB]]];
      var flat = (N <= 0 || H0 <= 0);
      var gx0 = stemTB, gy0 = Ht;
      var fx = gx0 + bh;
      var ax = flat ? fx : fx + H0 / N, ay = flat ? Ht : Ht + H0;
      var plat = Math.max(1200, heel + 700), bx = ax + plat;
      var kh = hasKey ? hk : 0;

      var span = Math.max(B + ff + fb, Ht + (flat ? 0 : H0) + bB + Math.max(kh, tbl));
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
      L(gx0, gy0, fx, Ht, BROWN); L(fx, Ht, ax, ay, BROWN); L(ax, ay, bx, ay, BROWN);   // ground line: level bh, slope, platform
      if (hasFront) {                                                // front (passive) soil surface on the toe (2×toe) + hachures
        L(fgL, Dfy, xfDf, Dfy, BROWN);
        for (var fi = 0; fi < 5; fi++) { var fhx = fgL + asz * (1 + fi * 1.3); L(fhx, Dfy, fhx - asz * 0.7, Dfy - asz * 0.7, BROWN); }
      }
      var qy = ay + asz * 2.2; L(ax, qy, bx, qy, BROWN);              // surcharge q
      for (var i = 0; i <= 5; i++) { var qx = ax + (bx - ax) * (i / 5); L(qx, qy, qx, ay, BROWN); ARR(qx, ay, 0, -1, BROWN); }
      T((ax + bx) / 2, qy + th * 0.8, "q = " + P.q.toFixed(1) + " t/m2", 0, BROWN);

      // linear dimensions
      var colA = baseFront - ff - 3.4 * th, colB = baseFront - ff - 1.5 * th;
      W(baseFront, -bB, colA, -bB); W(stemTF, Ht, colA, Ht); DIMV(colA, -bB, Ht, "Hs = " + Hs);   // full height: slab bottom → stem top
      if (!flat) { W(ax, ay, colA, ay); DIMV(colA, Ht, ay, "H0 = " + H0); }               // backfill height, stacked above the stem top
      W(baseFront, -bB, colB, -bB); W(baseFront, -tsfc, colB, -tsfc); DIMV(colB, -bB, -tsfc, "tb = " + tb);   // tip thickness, excludes tsf
      if (hasKey) { var colK = kf - 1.6 * th; W(kf, -bB, colK, -bB); W(kf, -bB - hk, colK, -bB - hk); DIMV(colK, -bB - hk, -bB, "hk = " + hk); }
      var colR = baseBack + fb + 1.6 * th; W(baseBack + fb, -bB, colR, -bB); W(baseBack + fb, -bB - tbl, colR, -bB - tbl); DIMV(colR, -bB - tbl, -bB, "tbl = " + tbl);
      // top of stem: st thickness ABOVE the reference line; fo | bo offsets BELOW it
      var yst = Ht + 2.0 * th;
      W(0, 0, 0, yst); W(sb, 0, sb, yst); W(stemTF, Ht, stemTF, yst); W(stemTB, Ht, stemTB, yst);
      L(stemTF, yst, stemTB, yst, BLUE); ARR(stemTF, yst, -1, 0, BLUE); ARR(stemTB, yst, 1, 0, BLUE);   // st: between the stem TOP corners
      if (fo > 0) { L(0, yst, stemTF, yst, BLUE); ARR(0, yst, -1, 0, BLUE); ARR(stemTF, yst, 1, 0, BLUE); }   // fo offset
      if (bo > 0) { L(stemTB, yst, sb, yst, BLUE); ARR(stemTB, yst, -1, 0, BLUE); ARR(sb, yst, 1, 0, BLUE); }   // bo offset
      T((stemTF + stemTB) / 2, yst + th * 0.85, "st = " + st, 0, BLUE);                    // st: stem-TOP width, above
      if (fo > 0) T(stemTF - 2.6 * th, yst - th * 1.25, "fo = " + fo, 0, BLUE);            // fo below-left
      if (bo > 0) T(stemTB + 2.6 * th, yst - th * 1.25, "bo = " + bo, 0, BLUE);            // bo below-right
      // ABOVE the base — base-top subdivisions + stem base thickness: toe | sb | heel
      var yA = Math.max(hhc, tb) + 2.2 * th, yA2 = yA + 1.8 * th;   // sb raised a line so it clears the narrow toe segment
      W(baseFront, 0, baseFront, yA); W(0, 0, 0, yA2); W(sb, 0, sb, yA2); W(baseBack, 0, baseBack, yA);
      DIMH(baseFront, 0, yA, "toe = " + toe); DIMH(0, sb, yA2, "sb = " + sb); DIMH(sb, baseBack, yA, "heel = " + heel);
      // BELOW the base — ff | kx | bk | (rem) | fb, then total B
      var lowY = -bB - Math.max(kh, tbl);
      var yb1 = lowY - 2.4 * th, yb2 = lowY - 4.0 * th;
      W(baseFront - ff, -bB, baseFront - ff, yb1); W(baseFront, -bB, baseFront, yb2); W(baseBack, -bB, baseBack, yb2); W(baseBack + fb, -bB, baseBack + fb, yb1);
      DIMH(baseFront - ff, baseFront, yb1, "ff = " + ff);
      DIMH(baseBack, baseBack + fb, yb1, "fb = " + fb);
      if (hasKey) {
        W(kf, -bB - hk, kf, yb1); W(kf + bk, -bB - hk, kf + bk, yb1);
        DIMH(baseFront, kf, yb1, "kx = " + kx);
        DIMH(kf, kf + bk, yb1, "bk = " + bk);
        DIMH(kf + bk, baseBack, yb1, "" + Math.round(baseBack - kf - bk));
      }
      DIMH(baseFront, baseBack, yb2, "B = " + B);
      if (tsfc > 0) { var xtt = baseFront - 1.4 * th; W(baseFront, 0, xtt, 0); W(baseFront, -tsfc, xtt, -tsfc); DIMV(xtt, -tsfc, 0, "tsf = " + tsf); }
      if (hasFront) { var dcol = baseFront - 3.0 * th; W(baseFront, -bB, dcol, -bB); W(baseFront, Dfy, dcol, Dfy); DIMV(dcol, -bB, Dfy, "Df = " + Df); }
      var xht = baseBack + 1.4 * th;                                                     // heel tip: slope tsb
      if (tsbc > 0) { W(baseBack, 0, xht, 0); W(baseBack, -tsbc, xht, -tsbc); DIMV(xht, -tsbc, 0, "tsb = " + tsb); }
      var colRb = baseBack + fb + 1.6 * th + 2.6 * th;                                   // rear thickness tbr, past the blinding column
      W(baseBack, -bB, colRb, -bB); W(baseBack, -tsbc, colRb, -tsbc); DIMV(colRb, -bB, -tsbc, "tbr = " + Math.round(bB - tsbc));
      var ybd = ay + 1.8 * th;
      if (bh > 0) { W(gx0, gy0, gx0, ybd); W(fx, Ht, fx, ybd); DIMH(gx0, fx, ybd, "bh = " + bh); }

      // slope / batter / callout text (batters computed from offsets & height)
      if (frontOff > 0) T(stemTF / 2 - th * 0.5, Ht / 2, "1:" + Nf.toFixed(3), Math.atan2(Ht, Math.max(frontOff, 1)) * 180 / Math.PI, TEAL);
      if (bo > 0) T((stemTB + sb) / 2 + th * 0.5, Ht * 0.55, "1:" + Nb.toFixed(3), Math.atan2(Ht, -Math.max(bo, 1)) * 180 / Math.PI, TEAL);
      if (flat) T(fx + (bx - fx) * 0.25, ay + th * 0.7, "1:N = 1:" + N, 0, TEAL);
      else T((fx + ax) / 2 - th * 0.4, (Ht + ay) / 2 + th * 0.4, "1:N = 1:" + N, Math.atan2(ay - Ht, ax - fx) * 180 / Math.PI, TEAL);
      if (hhc > 0) T((xbackHH + sb + hhc) / 2 + th, hhc / 2, "haunch " + hh + " x " + hh, 0, BLUE);
      T((baseFront - ff + Math.min(kf, baseBack)) / 2, -bB - tbl - th * 0.9, "Blinding conc.", 0, GRAY);

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
