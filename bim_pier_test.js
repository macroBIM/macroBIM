/*
    bim_pier_test.js — Pier component drawings (macroBIM Drawings, LAYOUT TEST)
    Retaining-wall style: left live-SVG section + right dimension inputs (fields + CSV) + DXF-less test.
    Three self-contained entry points, one per pier component:
        fdraw_pier_coping(mountId)      두부보  — cap-beam front elevation
        fdraw_pier_column(mountId)      기둥    — column front elevation
        fdraw_pier_foundation(mountId)  기초    — footing + blinding front elevation
    Pure vanilla JS + inline SVG (no Konva / no external deps). Styles scoped to .pr-root.
    NOTE: numeric dims only for this test; enum/bool inputs (단면형상·중공형 …) are a later extension.
*/
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var _draws = [];                                   // live draw()s for resize
  var _rt = null;
  window.addEventListener("resize", function () {
    clearTimeout(_rt);
    _rt = setTimeout(function () { _draws.forEach(function (d) { try { d(); } catch (e) {} }); }, 120);
  });

  var CSS =
    ".pr-root{--dim:#2563eb;--found:#6e7e8c;--foundfill:#eef2f6;--cope:#1f8e9e;--col:#b4813a;" +
    "--ink:#182430;--muted:#64748b;--line:#cbd5e1;--hair:#e2e8f0;--panel:#fff;--chip:#f1f5f9;--concrete-ln:#aeb9c6;" +
    "font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:var(--ink);}" +
    ".pr-root *{box-sizing:border-box}" +
    ".pr-mono{font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-variant-numeric:tabular-nums}" +
    ".pr-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:20px;align-items:start}" +
    "@media(max-width:900px){.pr-grid{grid-template-columns:1fr}}" +
    ".pr-card{background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden}" +
    ".pr-hd{display:flex;justify-content:space-between;align-items:center;padding:9px 14px;border-bottom:1px solid var(--hair);background:var(--chip)}" +
    ".pr-ttl{font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;color:var(--muted)}" +
    ".pr-plot{display:block;width:100%;height:auto;cursor:grab;touch-action:none;-webkit-user-select:none;user-select:none;background:" +
    "linear-gradient(var(--hair) 1px,transparent 1px) 0 0/26px 26px," +
    "linear-gradient(90deg,var(--hair) 1px,transparent 1px) 0 0/26px 26px;background-color:var(--panel)}" +
    ".pr-plot:active{cursor:grabbing}" +
    ".pr-hd-r{display:flex;align-items:center;gap:10px}" +
    ".pr-inputs{padding:14px}" +
    ".pr-inrow{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px;padding:5px 0;border-bottom:1px dashed var(--hair)}" +
    ".pr-inrow:last-child{border-bottom:0}" +
    ".pr-inrow label{font-size:13px;display:flex;align-items:baseline;gap:8px}" +
    ".pr-inrow .var{font-weight:600;color:var(--dim);min-width:40px;display:inline-block;font-family:ui-monospace,Menlo,Consolas,monospace}" +
    ".pr-inrow .desc{color:var(--muted);font-size:12px}" +
    ".pr-inrow input{width:96px;text-align:right;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink);font-size:13px;font-variant-numeric:tabular-nums}" +
    ".pr-inrow input:focus{outline:2px solid var(--dim);outline-offset:1px;border-color:var(--dim)}" +
    ".pr-unit{color:var(--muted);font-size:11px;margin-left:6px}" +
    ".pr-btn{font:inherit;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#fff;" +
    "background:var(--dim);border:1px solid var(--dim);border-radius:6px;padding:5px 12px;cursor:pointer;min-width:104px;text-align:center;" +
    "box-shadow:0 1px 3px rgba(37,99,235,.35);transition:filter .12s,transform .06s}" +
    ".pr-btn:hover{filter:brightness(1.12)}.pr-btn:active{filter:brightness(.94);transform:translateY(1px)}" +
    ".pr-batch-wrap{padding:0 0 10px;margin-bottom:8px;border-bottom:1px dashed var(--hair)}" +
    ".pr-batch-lbl{font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin-bottom:5px}" +
    ".pr-batch-hint{font-weight:400;text-transform:none;letter-spacing:0;color:var(--dim);font-family:ui-monospace,Menlo,Consolas,monospace;font-size:10px}" +
    ".pr-batch{width:100%;resize:none;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1.5;padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink)}" +
    ".pr-batch:focus{outline:2px solid var(--dim);outline-offset:1px;border-color:var(--dim)}";

  // ── component configs: [name, default, description] (units mm unless noted) + geom() ─────────────
  //    geom(P) returns {polys, overlays, hd, vd}
  //      polys:    [{pts:[[x,y]…], cls}]         filled concrete (y-up model coords)
  //      overlays: [{pts:[[x,y]…], dash}]        stroke-only (grooves / context stubs)
  //      hd:       [[x1,x2, yAnchor, dyScreen, label, cls]]   horizontal dim
  //      vd:       [[y1,y2, xAnchor, dxScreen, label, cls]]   vertical  dim

  var COPING = {
    entry: "fdraw_pier_coping", aria: "Pier cap-beam (coping) front elevation",
    VARS: [
      ["TL",  20000, "두부보 길이(전장)"],
      ["THL",  1250, "내민보 헌치부 두께"],
      ["THU",  1250, "내민보 외측(선단) 두께"],
      ["HLL",  3250, "좌측 헌치길이"],
      ["HLR",  3250, "우측 헌치길이"],
      ["HW",   1200, "중앙 홈파기 폭"],
      ["HD",    250, "중앙 홈파기 깊이"]
    ],
    geom: function (P) {
      var TL = P.TL, THL = P.THL, THU = P.THU, HLL = P.HLL, HLR = P.HLR, HW = P.HW, HD = P.HD;
      var xc = TL / 2, soffU = THL - THU;                 // soffit level at tips
      // cap-beam outline (y-up, flat top at y=THL, soffit rises to tips)
      var body = [[0, THL], [TL, THL], [TL, soffU], [TL - HLR, 0], [HLL, 0], [0, soffU]];
      var polys = [{ pts: body, cls: "c" }];
      var overlays = [];
      if (HW > 0 && HD > 0)                               // central top groove (recess)
        overlays.push({ pts: [[xc - HW / 2, THL], [xc - HW / 2, THL - HD], [xc + HW / 2, THL - HD], [xc + HW / 2, THL]], dash: 0 });
      return {
        polys: polys, overlays: overlays,
        hd: [
          [0, TL, THL, -34, "TL = " + TL, "c"],
          [0, HLL, 0, 30, "HLL = " + HLL, "c"],
          [TL - HLR, TL, 0, 30, "HLR = " + HLR, "c"]
        ],
        vd: [
          [0, THL, HLL, 26, "THL = " + THL, "c"],
          [soffU, THL, TL, 30, "THU = " + THU, "c"]
        ]
      };
    }
  };

  var COLUMN = {
    entry: "fdraw_pier_column", aria: "Pier column front elevation",
    VARS: [
      ["CH",   8000, "기둥 높이"],
      ["D",    2500, "기둥 하부 폭(교축직각)"],
      ["DT",   2500, "기둥 상부 폭(테이퍼)"]
    ],
    geom: function (P) {
      var CH = P.CH, D = P.D, DT = P.DT;
      var body = [[-D / 2, 0], [D / 2, 0], [DT / 2, CH], [-DT / 2, CH]];
      return {
        polys: [{ pts: body, cls: "k" }], overlays: [],
        hd: [
          [-D / 2, D / 2, 0, 30, "D = " + D, "k"],
          [-DT / 2, DT / 2, CH, -30, "DT = " + DT, "k"]
        ],
        vd: [
          [0, CH, D / 2, 30, "CH = " + CH, "k"]
        ]
      };
    }
  };

  var FOUNDATION = {
    entry: "fdraw_pier_foundation", aria: "Pier footing + blinding front elevation",
    VARS: [
      ["BH",   2000, "기초부 높이"],
      ["BLF",  2750, "기초연단→기둥(좌)"],
      ["BRF",  2750, "기초연단→기둥(우)"],
      ["colW", 2500, "기둥 하부 폭"],
      ["SLW",   500, "좌 상단 경사부 폭"],
      ["SLH",   400, "좌 상단 경사부 높이"],
      ["SRW",   500, "우 상단 경사부 폭"],
      ["SRH",   400, "우 상단 경사부 높이"],
      ["EFL",   150, "버림 돌출길이"],
      ["EH",    100, "버림 높이"]
    ],
    geom: function (P) {
      var BH = P.BH, BLF = P.BLF, BRF = P.BRF, colW = P.colW,
        SLW = P.SLW, SLH = P.SLH, SRW = P.SRW, SRH = P.SRH, EFL = P.EFL, EH = P.EH;
      var Wf = BLF + colW + BRF, stub = 900;
      // footing (y-up, base at 0, top at BH) with top-edge chamfers
      var foot = [[0, 0], [Wf, 0], [Wf, BH - SRH], [Wf - SRW, BH], [SLW, BH], [0, BH - SLH]];
      var polys = [{ pts: foot, cls: "f" }];
      if (EFL > 0 || EH > 0)                              // blinding concrete below footing
        polys.push({ pts: [[-EFL, 0], [Wf + EFL, 0], [Wf + EFL, -EH], [-EFL, -EH]], cls: "fb" });
      var overlays = [                                    // column stub (context)
        { pts: [[BLF, BH], [BLF + colW, BH], [BLF + colW, BH + stub], [BLF, BH + stub]], dash: 5 }
      ];
      return {
        polys: polys, overlays: overlays,
        hd: [
          [0, BLF, BH, -34, "BLF = " + BLF, "f"],
          [BLF + colW, Wf, BH, -34, "BRF = " + BRF, "f"],
          [-EFL, 0, -EH, 26, "EFL = " + EFL, "f"]
        ],
        vd: [
          [0, BH, Wf, 32, "BH = " + BH, "f"],
          [-EH, 0, -EFL, -26, "EH = " + EH, "f"]
        ]
      };
    }
  };

  // ── generic shell (markup + input form + zoom/pan + render) ─────────────────────────────────────
  function buildModule(cfg) {
    window[cfg.entry] = function (mountId) {
      var root = document.getElementById(mountId);
      if (!root) return;
      root.innerHTML =
        "<style>" + CSS + "</style>" +
        "<div class='pr-root'><div class='pr-grid'>" +
        "  <div class='pr-card'>" +
        "    <div class='pr-hd'><span class='pr-ttl'>Layout</span>" +
        "      <span class='pr-hd-r'><button type='button' class='pr-btn' data-pr-fit>Reset view</button>" +
        "      <span class='pr-ttl pr-mono'>SCALE&nbsp;NTS</span></span></div>" +
        "    <svg class='pr-plot' viewBox='0 0 620 620' role='img' aria-label='" + cfg.aria + " (scroll to zoom, drag to pan)'></svg>" +
        "  </div>" +
        "  <div class='pr-card'>" +
        "    <div class='pr-hd'><span class='pr-ttl'>Dimension Input &mdash; live redraw on edit</span></div>" +
        "    <div class='pr-inputs'></div>" +
        "  </div>" +
        "</div></div>";

      var P = {}; cfg.VARS.forEach(function (v) { P[v[0]] = v[1]; });
      var order = cfg.VARS.map(function (v) { return v[0]; });
      function currentCSV() { return order.map(function (k) { return P[k]; }).join(","); }

      // input form
      var box = root.querySelector(".pr-inputs");
      var bwrap = document.createElement("div");
      bwrap.className = "pr-batch-wrap";
      bwrap.innerHTML =
        "<div class='pr-batch-lbl'>Batch Input (CSV) <span class='pr-batch-hint'>" + order.join(",") + "</span></div>" +
        "<textarea class='pr-batch' rows='2' spellcheck='false'></textarea>";
      box.appendChild(bwrap);
      var batchTa = bwrap.querySelector(".pr-batch");

      cfg.VARS.forEach(function (v) {
        var row = document.createElement("div");
        row.className = "pr-inrow";
        row.innerHTML =
          "<label><span class='var'>" + v[0] + "</span><span class='desc'>" + v[2] + "</span></label>" +
          "<span><input class='pr-mono' type='number' step='10' value='" + v[1] + "' data-k='" + v[0] + "'>" +
          "<span class='pr-unit'>mm</span></span>";
        box.appendChild(row);
      });
      box.addEventListener("input", function (e) {
        var t = e.target; if (!t.dataset || !t.dataset.k) return;
        var val = parseFloat(t.value); if (isNaN(val)) return;
        P[t.dataset.k] = val; batchTa.value = currentCSV(); draw();
      });
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

      // svg + zoom/pan
      var svg = root.querySelector(".pr-plot"), W = 620, H = 620;
      var baseVB = { w: 0, h: 0 }, curVB = { x: 0, y: 0, w: 0, h: 0 };
      function applyVB() { svg.setAttribute("viewBox", curVB.x + " " + curVB.y + " " + curVB.w + " " + curVB.h); }
      function resetView() { curVB.x = 0; curVB.y = 0; curVB.w = baseVB.w; curVB.h = baseVB.h; applyVB(); }
      svg.addEventListener("wheel", function (e) {
        if (!curVB.w) return; e.preventDefault();
        var r = svg.getBoundingClientRect(), mx = (e.clientX - r.left) / r.width, my = (e.clientY - r.top) / r.height;
        var nw = curVB.w * (e.deltaY < 0 ? 0.88 : 1 / 0.88);
        nw = Math.min(baseVB.w, Math.max(baseVB.w * 0.08, nw));
        var nh = nw * (baseVB.h / baseVB.w), wx = curVB.x + mx * curVB.w, wy = curVB.y + my * curVB.h;
        curVB.x = wx - mx * nw; curVB.y = wy - my * nh; curVB.w = nw; curVB.h = nh; applyVB();
      }, { passive: false });
      var drag = null;
      svg.addEventListener("pointerdown", function (e) {
        e.preventDefault(); drag = { x: e.clientX, y: e.clientY };
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
      var fitBtn = root.querySelector("[data-pr-fit]");
      if (fitBtn) fitBtn.addEventListener("click", resetView);

      function el(name, a) { var e = document.createElementNS(NS, name); for (var k in a) e.setAttribute(k, a[k]); return e; }
      function arrow(g, x, y, ux, uy, c) {
        var bx = x - 8 * ux, by = y - 8 * uy, px = -uy, py = ux;
        g.appendChild(el("polygon", { points: x + "," + y + " " + (bx + 2.8 * px) + "," + (by + 2.8 * py) + " " + (bx - 2.8 * px) + "," + (by - 2.8 * py), fill: c }));
      }
      function dimLine(g, x1, y1, x2, y2, c) {
        g.appendChild(el("line", { x1: x1, y1: y1, x2: x2, y2: y2, stroke: c, "stroke-width": 1 }));
        var dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
        arrow(g, x1, y1, -dx / L, -dy / L, c); arrow(g, x2, y2, dx / L, dy / L, c);
      }
      function ext(g, x1, y1, x2, y2) { g.appendChild(el("line", { x1: x1, y1: y1, x2: x2, y2: y2, stroke: "var(--hair)", "stroke-width": 1 })); }
      function txt(g, x, y, s, ang) {
        var t = el("text", { x: x, y: y, "text-anchor": "middle", "dominant-baseline": "middle", "font-size": 11.5, "font-family": "ui-monospace,Menlo,Consolas,monospace", fill: "var(--dim)" });
        if (ang) t.setAttribute("transform", "rotate(" + ang + " " + x + " " + y + ")");
        t.textContent = s; g.appendChild(t);
      }
      function clsFill(c) { return c === "fb" ? "var(--foundfill)" : "#f6f8fa"; }
      function clsStroke(c) { return c === "f" || c === "fb" ? "var(--found)" : c === "k" ? "var(--col)" : "var(--cope)"; }

      function draw() {
        if (!svg.isConnected) return;
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        var g = el("g", {}); svg.appendChild(g);
        var G = cfg.geom(P);

        // bounds from all geometry points
        var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        function acc(pts) { pts.forEach(function (p) { if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]; if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; }); }
        G.polys.forEach(function (o) { acc(o.pts); });
        G.overlays.forEach(function (o) { acc(o.pts); });
        if (!isFinite(minX)) return;

        var padL = 96, padR = 70, padT = 70, padB = 78;
        var s = Math.min((W - padL - padR) / ((maxX - minX) || 1), (H - padT - padB) / ((maxY - minY) || 1));
        var cW = (maxX - minX) * s + padL + padR, cH = (maxY - minY) * s + padT + padB;
        svg.setAttribute("viewBox", "0 0 " + cW.toFixed(1) + " " + cH.toFixed(1));
        baseVB.w = cW; baseVB.h = cH; curVB.x = 0; curVB.y = 0; curVB.w = cW; curVB.h = cH;
        var ox = padL - minX * s, oy = cH - padB + minY * s;
        function SX(mx) { return ox + mx * s; }
        function SY(my) { return oy - my * s; }
        function scr(pts) { return pts.map(function (p) { return SX(p[0]) + "," + SY(p[1]); }).join(" "); }

        // fit svg px to available card height
        var availW = (svg.parentNode && svg.parentNode.clientWidth) || W;
        var vpH = Math.max(300, (window.innerHeight || 800) - svg.getBoundingClientRect().top - 16);
        var fit = Math.min(availW / cW, vpH / cH);
        svg.style.width = Math.round(cW * fit) + "px";
        svg.style.height = Math.round(cH * fit) + "px";
        svg.style.margin = "0 auto";

        // filled concrete
        G.polys.forEach(function (o) {
          g.appendChild(el("polygon", { points: scr(o.pts), fill: clsFill(o.cls), stroke: clsStroke(o.cls), "stroke-width": 1.6, "stroke-linejoin": "round" }));
        });
        // overlays (grooves / context stubs)
        G.overlays.forEach(function (o) {
          var a = { points: scr(o.pts), fill: "none", stroke: "var(--concrete-ln)", "stroke-width": 1.2 };
          if (o.dash) a["stroke-dasharray"] = o.dash + " " + o.dash;
          g.appendChild(el("polyline", a));
        });

        // horizontal dims: [x1,x2, yAnchor, dyScreen, label]
        (G.hd || []).forEach(function (d) {
          var Y = SY(d[2]) + d[3], X1 = SX(d[0]), X2 = SX(d[1]);
          ext(g, X1, SY(d[2]), X1, Y); ext(g, X2, SY(d[2]), X2, Y);
          dimLine(g, X1, Y, X2, Y, "var(--dim)");
          txt(g, (X1 + X2) / 2, Y + (d[3] < 0 ? -9 : 11), d[4], 0);
        });
        // vertical dims: [y1,y2, xAnchor, dxScreen, label]
        (G.vd || []).forEach(function (d) {
          var X = SX(d[2]) + d[3], Y1 = SY(d[0]), Y2 = SY(d[1]);
          ext(g, SX(d[2]), Y1, X, Y1); ext(g, SX(d[2]), Y2, X, Y2);
          dimLine(g, X, Y1, X, Y2, "var(--dim)");
          txt(g, X + (d[3] < 0 ? -9 : 11), (Y1 + Y2) / 2, d[4], 90);
        });
      }

      _draws.push(draw);
      draw();
    };
  }

  buildModule(COPING);
  buildModule(COLUMN);
  buildModule(FOUNDATION);
})();
