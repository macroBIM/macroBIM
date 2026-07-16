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
*/
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var TYPES  = [["T", "T-type"], ["MC", "Multi-column"], ["WALL", "Wall"], ["COL", "Single-column"], ["PORTAL", "Portal"], ["TORCH", "Torch"]];
  var SHAPES = [["rect", "Rectangle"], ["circle", "Circle"], ["track", "Track"], ["octagon", "Octagon"]];

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
    sc.src = "https://macrobim.github.io/macroBIM/bim_draw_test_core.js?v=1";
    sc.onload = function () { window._rwCoreLoading = false; var q = window._rwCoreCbs || []; window._rwCoreCbs = []; q.forEach(function (f) { f(); }); };
    sc.onerror = function () { window._rwCoreLoading = false; window._rwCoreCbs = []; };
    document.head.appendChild(sc);
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
    ".pr-hd{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid var(--hair);background:var(--chip)}" +
    ".pr-ttl{font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:var(--muted)}" +
    ".pr-sub{font-size:11px;color:var(--muted);font-weight:400;text-transform:none;letter-spacing:0}" +
    ".pr-body{padding:12px 14px}" +
    ".pr-plot{display:block;width:100%;height:auto;cursor:grab;touch-action:none;-webkit-user-select:none;user-select:none;background:" +
    "linear-gradient(var(--hair) 1px,transparent 1px) 0 0/26px 26px,linear-gradient(90deg,var(--hair) 1px,transparent 1px) 0 0/26px 26px;background-color:var(--panel)}" +
    ".pr-plot:active{cursor:grabbing}" +
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
    ".pr-glyph{flex:0 0 auto}" +
    ".pr-modes{display:flex;gap:8px;margin-bottom:10px}" +
    ".pr-mode{flex:1;font:inherit;font-size:12px;font-weight:600;text-align:center;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--muted);cursor:pointer}" +
    ".pr-mode.on{background:var(--foundfill);border-color:var(--found);color:var(--found)}" +
    ".pr-stepper{display:flex;align-items:center;gap:6px}" +
    ".pr-step{width:28px;height:28px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink);font-size:15px;font-weight:700;cursor:pointer;line-height:1}" +
    ".pr-step:hover{border-color:var(--dim);color:var(--dim)}" +
    ".pr-cnt{width:52px;text-align:center;padding:5px;border:1px solid var(--line);border-radius:6px;font-size:13px;font-variant-numeric:tabular-nums}" +
    ".pr-names{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}" +
    ".pr-name{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)}" +
    ".pr-name input{width:76px;padding:4px 7px;border:1px solid var(--line);border-radius:6px;font-size:12px}" +
    ".pr-btn{font:inherit;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#fff;" +
    "background:var(--dim);border:1px solid var(--dim);border-radius:6px;padding:5px 12px;cursor:pointer;" +
    "box-shadow:0 1px 3px rgba(37,99,235,.35);transition:filter .12s,transform .06s}" +
    ".pr-btn:hover{filter:brightness(1.12)}.pr-btn:active{filter:brightness(.94);transform:translateY(1px)}";

  // ── data model ──────────────────────────────────────────────────────────────
  function newCol() { return { shape: "circle", D: 2500, H: 2500, CH: 8000 }; }
  function newPier(name) {
    return {
      name: name, type: "T",
      coping: {
        TL: 20000, TB: 4000, THL: 1250, THU: 1250, HLL: 3250, HLR: 3250,
        HRL: 0, HRR: 0, HEL: 0, HER: 0, HLU: 0, HRU: 0, CR: 0, HD: 0, HW: 0, HS: 0
      },
      colCount: 1, cols: [newCol()],
      fdnMode: "combined",
      fdn: { BH: 2000, BLF: 2750, BRF: 2750, FF: 2750, FB: 2750, EFL: 150, EH: 100 }
    };
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // Coping (두부보) geometry from the PDF variable set. Model coords, y-up, centred on x=0.
  //   THU = 외측(tip) thickness; THL = 헌치 높이(haunch rise). top surface y=THU+THL;
  //   central soffit y=0 (deepest, thickness THU+THL); tip soffit y=THL (tip thickness THU).
  //   Per side: HEL/HER add a horizontal soffit run at the tip; HLL/HLR = haunch (slope) length;
  //   HLU/HRU batter the tip end; HRL (outer)/HRR (inner-span) round the soffit corners into
  //   real circular arcs. Groove HD/HW/HS at the top-centre; CR rounds top-outer corners.
  // Returns { points[] (closed, arcs tessellated), radiusDims[] (HRL/HRR), A (dim anchors) }.
  function copingGeometry(cp) {
    var TL = +cp.TL, THL = +cp.THL, THU = +cp.THU, HLL = +cp.HLL, HLR = +cp.HLR,
      HEL = +cp.HEL || 0, HER = +cp.HER || 0, HLU = +cp.HLU || 0, HRU = +cp.HRU || 0,
      CR = +cp.CR || 0, HRL = +cp.HRL || 0, HRR = +cp.HRR || 0,
      HD = +cp.HD || 0, HW = +cp.HW || 0, HS = +cp.HS || 0;
    var xL = -TL / 2, xR = TL / 2, yTop = THU + THL, yTip = THL, yMid = 0;
    var xLtip = xL + HLU, xLe = xLtip + HEL, xLH = xLe + HLL;   // left: tip → flat-end → haunch root
    var xRtip = xR - HRU, xRe = xRtip - HER, xRH = xRe - HLR;   // right mirror
    if (xLH > 0) xLH = 0;
    if (xRH < 0) xRH = 0;
    var V = [], R = [], tag = [];
    function add(x, y, r, t) { V.push([x, y]); R.push(r || 0); tag.push(t || null); }
    add(xL, yTop, CR);                           // top-left
    if (HD > 0 && HW > 0) { add(-HW / 2 - HS, yTop, 0); add(-HW / 2, yTop - HD, 0); add(HW / 2, yTop - HD, 0); add(HW / 2 + HS, yTop, 0); }
    add(xR, yTop, CR);                           // top-right
    // right end → soffit: HER>0 gives a flat run (sharp tip corner + HRL at flat→slope),
    // otherwise the HRL round sits at the tip corner directly (no degenerate zero edge).
    if (HER > 0) { add(xRtip, yTip, 0); add(xRe, yTip, HRL, "hrl"); }
    else { add(xRtip, yTip, HRL, "hrl"); }
    add(xRH, yMid, HRR, "hrr");                  // right haunch root (HRR)
    add(xLH, yMid, HRR, "hrrL");                 // left haunch root (HRR)
    if (HEL > 0) { add(xLe, yTip, HRL, "hrlL"); add(xLtip, yTip, 0); }
    else { add(xLtip, yTip, HRL, "hrlL"); }

    var n = V.length, pts = [], rad = [];
    function U(ax, ay) { var L = Math.hypot(ax, ay) || 1; return [ax / L, ay / L]; }
    for (var i = 0; i < n; i++) {
      var p = V[i], pv = V[(i - 1 + n) % n], nx = V[(i + 1) % n], R0 = R[i];
      if (!R0) { pts.push(p); continue; }
      var din = U(p[0] - pv[0], p[1] - pv[1]), dou = U(nx[0] - p[0], nx[1] - p[1]);
      var lin = Math.hypot(p[0] - pv[0], p[1] - pv[1]), lou = Math.hypot(nx[0] - p[0], nx[1] - p[1]);
      var cosphi = Math.max(-1, Math.min(1, -(din[0] * dou[0] + din[1] * dou[1])));
      var half = Math.acos(cosphi) / 2, tanh = Math.tan(half) || 1e-6;
      var t = Math.min(R0 / tanh, lin * 0.49, lou * 0.49), Ract = t * tanh;
      var t1 = [p[0] - din[0] * t, p[1] - din[1] * t], t2 = [p[0] + dou[0] * t, p[1] + dou[1] * t];
      var bis = U(-din[0] + dou[0], -din[1] + dou[1]), sinh = Math.sin(half) || 1e-6;
      var c = [p[0] + bis[0] * (Ract / sinh), p[1] + bis[1] * (Ract / sinh)];   // arc centre
      var a1 = Math.atan2(t1[1] - c[1], t1[0] - c[0]), a2 = Math.atan2(t2[1] - c[1], t2[0] - c[0]);
      var dd = a2 - a1; while (dd <= -Math.PI) dd += 2 * Math.PI; while (dd > Math.PI) dd -= 2 * Math.PI;  // minor arc
      var K = 10;
      for (var k = 0; k <= K; k++) { var aa = a1 + dd * k / K; pts.push([c[0] + Ract * Math.cos(aa), c[1] + Ract * Math.sin(aa)]); }
      if (tag[i] === "hrlL" && HRL > 0) rad.push({ c: c, r: Ract, ang: Math.atan2(p[1] - c[1], p[0] - c[0]) * 180 / Math.PI, label: "HRL=" });
      if (tag[i] === "hrrL" && HRR > 0) rad.push({ c: c, r: Ract, ang: Math.atan2(p[1] - c[1], p[0] - c[0]) * 180 / Math.PI, label: "HRR=" });
    }
    return {
      points: pts, radiusDims: rad,
      A: { xL: xL, xR: xR, xLtip: xLtip, xRtip: xRtip, xLe: xLe, xRe: xRe, xLH: xLH, xRH: xRH,
        yTop: yTop, yTip: yTip, yMid: yMid, THU: THU, THL: THL, HLL: HLL, HLR: HLR, HEL: HEL, HER: HER }
    };
  }

  // Align linear dims to shared gutters outside the drawing: left/right verticals
  // to the left/right, top/bottom horizontals above/below; stack overlapping dims
  // into successive lanes. dims: [{side:'L'|'R'|'T'|'B', at, lo, hi, label}]
  //   V (L/R): measures y lo→hi at x=at.   H (T/B): measures x lo→hi at y=at.
  // Returns addDimLinear-ready specs {x1,y1,x2,y2,gap,label}.
  function layoutDims(dims, b) {
    var span = Math.max(b.maxX - b.minX, b.maxY - b.minY) || 1;
    var M = span * 0.05, STEP = span * 0.062, PAD = span * 0.05, out = [];   // PAD ≈ label clearance
    ["L", "R", "T", "B"].forEach(function (side) {
      var g = dims.filter(function (d) { return d.side === side; });
      g.sort(function (a, c) { return a.lo - c.lo; });
      var lanes = [];
      g.forEach(function (d) {
        var li = 0;
        for (; ;) {
          if (!lanes[li]) lanes[li] = [];
          var ok = true;   // reject if this dim's span (padded for the label) meets one already in the lane
          for (var j = 0; j < lanes[li].length; j++) { var iv = lanes[li][j]; if (!(d.hi + PAD <= iv[0] || d.lo - PAD >= iv[1])) { ok = false; break; } }
          if (ok) { lanes[li].push([d.lo, d.hi]); d._l = li; break; }
          li++;
        }
      });
      g.forEach(function (d) {
        var gut, gap;
        if (side === "L") { gut = b.minX - M - d._l * STEP; gap = d.at - gut; out.push({ x1: d.at, y1: d.lo, x2: d.at, y2: d.hi, gap: gap, label: d.label }); }
        else if (side === "R") { gut = b.maxX + M + d._l * STEP; gap = d.at - gut; out.push({ x1: d.at, y1: d.lo, x2: d.at, y2: d.hi, gap: gap, label: d.label }); }
        else if (side === "T") { gut = b.maxY + M + d._l * STEP; gap = gut - d.at; out.push({ x1: d.lo, y1: d.at, x2: d.hi, y2: d.at, gap: gap, label: d.label }); }
        else { gut = b.minY - M - d._l * STEP; gap = gut - d.at; out.push({ x1: d.lo, y1: d.at, x2: d.hi, y2: d.at, gap: gap, label: d.label }); }
      });
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
    function numRow(vari, desc, val, on) {
      var row = h("div", "pr-inrow");
      row.appendChild(h("label", null, "<span class='var'>" + vari + "</span><span class='desc'>" + desc + "</span>"));
      var wrap = h("span"); var inp = h("input"); inp.type = "number"; inp.step = "10"; inp.value = val; inp.className = "pr-mono";
      inp.addEventListener("input", function () { var v = parseFloat(inp.value); if (!isNaN(v)) { on(v); draw(); } });
      wrap.appendChild(inp); wrap.appendChild(h("span", "pr-unit", "mm")); row.appendChild(wrap);
      return row;
    }

    // ── card builders ──
    function cardPiers() {
      var c = h("div", "pr-card");
      c.appendChild(h("div", "pr-hd", "<span class='pr-ttl'>Piers <span class='pr-sub'>총 교각 개수 &amp; 이름</span></span>"));
      var b = h("div", "pr-body");
      var r = h("div", "pr-inrow");
      r.appendChild(h("label", null, "<span class='var'>N</span><span class='desc'>교각 개수</span>"));
      var stp = h("div", "pr-stepper");
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
      var rw = h("span"); rw.appendChild(stp); r.appendChild(rw); b.appendChild(r);

      var names = h("div", "pr-names");
      S.piers.forEach(function (p, i) {
        var nm = h("div", "pr-name", "<span>" + (i + 1) + ".</span>");
        var inp = h("input"); inp.type = "text"; inp.value = p.name;
        inp.addEventListener("input", function () { p.name = inp.value; renderSelector(); draw(); });
        nm.appendChild(inp); names.appendChild(nm);
      });
      b.appendChild(names); c.appendChild(b); return c;
    }

    var selWrap = h("div", "pr-card");
    function renderSelector() {
      selWrap.innerHTML = "";
      selWrap.appendChild(h("div", "pr-hd", "<span class='pr-ttl'>Active Pier <span class='pr-sub'>편집할 교각 선택</span></span>"));
      var b = h("div", "pr-body"); var tabs = h("div", "pr-tabs");
      S.piers.forEach(function (p, i) {
        var t = h("button", "pr-tab" + (i === S.sel ? " on" : ""), p.name || ("P" + (i + 1)));
        t.onclick = function () { S.sel = i; renderPerPier(); renderSelector(); draw(); };
        tabs.appendChild(t);
      });
      b.appendChild(tabs); selWrap.appendChild(b);
    }

    function cardType() {
      var c = h("div", "pr-card");
      c.appendChild(h("div", "pr-hd", "<span class='pr-ttl'>Type <span class='pr-sub'>교각 형식</span></span>"));
      var b = h("div", "pr-body"); var r = h("div", "pr-inrow");
      r.appendChild(h("label", null, "<span class='desc'>Pier type</span>"));
      var sel = h("select", "pr-sel");
      TYPES.forEach(function (t) { var o = h("option"); o.value = t[0]; o.textContent = t[1]; if (P().type === t[0]) o.selected = true; sel.appendChild(o); });
      sel.addEventListener("change", function () { P().type = sel.value; draw(); });
      var rw = h("span"); rw.appendChild(sel); r.appendChild(rw); b.appendChild(r); c.appendChild(b); return c;
    }

    function cardCoping() {
      var p = P(), cp = p.coping;
      var c = h("div", "pr-card");
      c.appendChild(h("div", "pr-hd", "<span class='pr-ttl'>Coping <span class='pr-sub'>두부보</span></span>"));
      var b = h("div", "pr-body");
      b.appendChild(numRow("TL", "두부보 길이(전장)", cp.TL, function (v) { cp.TL = v; }));
      b.appendChild(numRow("TB", "두부보 폭원", cp.TB, function (v) { cp.TB = v; }));
      b.appendChild(numRow("THL", "내민보 헌치부 두께", cp.THL, function (v) { cp.THL = v; }));
      b.appendChild(numRow("THU", "내민보 외측 두께", cp.THU, function (v) { cp.THU = v; }));
      b.appendChild(numRow("HLL", "좌측 헌치길이", cp.HLL, function (v) { cp.HLL = v; }));
      b.appendChild(numRow("HLR", "우측 헌치길이", cp.HLR, function (v) { cp.HLR = v; }));
      b.appendChild(numRow("HRL", "하단 곡선 R(외측)", cp.HRL, function (v) { cp.HRL = v; }));
      b.appendChild(numRow("HRR", "하단 곡선 R(내측지간)", cp.HRR, function (v) { cp.HRR = v; }));
      b.appendChild(numRow("HEL", "좌측 연단 수평처리", cp.HEL, function (v) { cp.HEL = v; }));
      b.appendChild(numRow("HER", "우측 연단 수평처리", cp.HER, function (v) { cp.HER = v; }));
      b.appendChild(numRow("HLU", "좌측 외측연단 경사", cp.HLU, function (v) { cp.HLU = v; }));
      b.appendChild(numRow("HRU", "우측 외측연단 경사", cp.HRU, function (v) { cp.HRU = v; }));
      b.appendChild(numRow("CR", "외측연단 라운드", cp.CR, function (v) { cp.CR = v; }));
      b.appendChild(numRow("HD", "중앙 홈파기 깊이", cp.HD, function (v) { cp.HD = v; }));
      b.appendChild(numRow("HW", "중앙 홈파기 폭", cp.HW, function (v) { cp.HW = v; }));
      b.appendChild(numRow("HS", "중앙 홈파기 상부확폭", cp.HS, function (v) { cp.HS = v; }));
      c.appendChild(b); return c;
    }

    function cardColumns() {
      var p = P();
      var c = h("div", "pr-card");
      var hd = h("div", "pr-hd", "<span class='pr-ttl'>Columns <span class='pr-sub'>기둥</span></span>");
      var stp = h("div", "pr-stepper");
      var minus = h("button", "pr-step", "−"), cnt = h("input", "pr-cnt"), plus = h("button", "pr-step", "+");
      cnt.type = "number"; cnt.value = p.colCount; cnt.min = 1; cnt.max = 8;
      function setCols(n) {
        n = clamp(n | 0, 1, 8);
        while (p.cols.length < n) p.cols.push(newCol());
        if (p.cols.length > n) p.cols.length = n;
        p.colCount = n; renderPerPier(); draw();
      }
      minus.onclick = function () { setCols(p.colCount - 1); };
      plus.onclick = function () { setCols(p.colCount + 1); };
      cnt.addEventListener("change", function () { setCols(parseInt(cnt.value, 10)); });
      stp.appendChild(minus); stp.appendChild(cnt); stp.appendChild(plus);
      hd.appendChild(stp); c.appendChild(hd);

      var b = h("div", "pr-body");
      p.cols.forEach(function (col, i) {
        var cc = h("div", "pr-colcard");
        var ch = h("div", "pr-colhd");
        ch.appendChild(glyph(col.shape));
        ch.appendChild(h("span", "cnm", "Column " + (i + 1)));
        var sel = h("select", "pr-sel");
        SHAPES.forEach(function (s) { var o = h("option"); o.value = s[0]; o.textContent = s[1]; if (col.shape === s[0]) o.selected = true; sel.appendChild(o); });
        sel.addEventListener("change", function () { col.shape = sel.value; renderPerPier(); draw(); });
        var selw = h("span"); selw.style.marginLeft = "auto"; selw.appendChild(sel); ch.appendChild(selw);
        cc.appendChild(ch);
        cc.appendChild(numRow("D", col.shape === "circle" ? "직경" : "폭(교축직각)", col.D, function (v) { col.D = v; }));
        if (col.shape !== "circle") cc.appendChild(numRow("H", "폭(교축방향)", col.H, function (v) { col.H = v; }));
        cc.appendChild(numRow("CH", "기둥 높이", col.CH, function (v) { col.CH = v; }));
        b.appendChild(cc);
      });
      c.appendChild(b); return c;
    }

    function cardFoundation() {
      var p = P(), f = p.fdn;
      var c = h("div", "pr-card");
      c.appendChild(h("div", "pr-hd", "<span class='pr-ttl'>Foundation <span class='pr-sub'>기초</span></span>"));
      var b = h("div", "pr-body");
      var modes = h("div", "pr-modes");
      [["combined", "Combined (통합 1개)"], ["individual", "Individual (기둥별)"]].forEach(function (m) {
        var btn = h("button", "pr-mode" + (p.fdnMode === m[0] ? " on" : ""), m[1]);
        btn.onclick = function () { p.fdnMode = m[0]; renderPerPier(); draw(); };
        modes.appendChild(btn);
      });
      b.appendChild(modes);
      b.appendChild(numRow("BH", "기초부 높이", f.BH, function (v) { f.BH = v; }));
      b.appendChild(numRow("BLF", "기초연단→기둥(좌,직각)", f.BLF, function (v) { f.BLF = v; }));
      b.appendChild(numRow("BRF", "기초연단→기둥(우,직각)", f.BRF, function (v) { f.BRF = v; }));
      b.appendChild(numRow("FF", "기초연단→기둥(좌,교축)", f.FF, function (v) { f.FF = v; }));
      b.appendChild(numRow("FB", "기초연단→기둥(우,교축)", f.FB, function (v) { f.FB = v; }));
      b.appendChild(numRow("EFL", "버림 돌출길이", f.EFL, function (v) { f.EFL = v; }));
      b.appendChild(numRow("EH", "버림 높이", f.EH, function (v) { f.EH = v; }));
      c.appendChild(b); return c;
    }

    // ── live elevation preview (selected pier) ──
    var plotHost = null, plotSub = null;
    function cardPreview() {
      var c = h("div", "pr-card");
      var hd = h("div", "pr-hd", "<span class='pr-ttl'>Elevation <span class='pr-sub' data-pr-sub>선택 교각 정면도</span></span>" +
        "<button type='button' class='pr-btn' data-pr-regen>&#8635; Regen</button>");
      c.appendChild(hd);
      plotSub = hd.querySelector("[data-pr-sub]");
      hd.querySelector("[data-pr-regen]").addEventListener("click", function () { draw(); });
      plotHost = h("div"); plotHost.style.cssText = "width:100%;overflow:hidden";
      c.appendChild(plotHost);
      return c;
    }

    function colCenters(p) {
      var N = p.colCount, TL = p.coping.TL, cs = [];
      if (N <= 1) return [0];
      var margin = Math.min(TL * 0.2, 3000), span = TL - 2 * margin;
      for (var i = 0; i < N; i++) cs.push(-span / 2 + span * i / (N - 1));
      return cs;
    }

    // Elevation preview, drawn through the shared core (window.RWSVG): geometry is
    // emitted as KonvaViewer-style primitives, so dims / fonts / zoom-pan match the
    // retaining-wall and section drawings exactly.
    function draw() {
      if (!plotHost || !plotHost.isConnected) return;
      if (typeof window.RWSVG === "undefined") { ensureCore(draw); return; }
      var p = P(), cp = p.coping, f = p.fdn;
      var cs = colCenters(p);
      var maxCH = Math.max.apply(null, p.cols.map(function (c) { return c.CH; }).concat([1000]));

      var rec = new window.RWSVG.MockViewer();
      rec.addLayer("c", "cyan", "solid", 1);              // cyan → ink outline
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
        var L = cs[0] - p.cols[0].D / 2 - f.BLF, R = cs[cs.length - 1] + p.cols[p.cols.length - 1].D / 2 + f.BRF;
        foot(L, R);
      } else {
        p.cols.forEach(function (col, i) { foot(cs[i] - col.D / 2 - f.BLF, cs[i] + col.D / 2 + f.BRF); });
      }
      // columns
      p.cols.forEach(function (col, i) { rect(cs[i] - col.D / 2, 0, cs[i] + col.D / 2, col.CH); });
      // coping outline (seated on columns), as a closed polyline (arcs tessellated)
      var geo = copingGeometry(cp), A = geo.A;
      var op = geo.points.map(function (q) { return [q[0], q[1] + maxCH]; });
      for (var i = 0; i < op.length; i++) { var a = op[i], b = op[(i + 1) % op.length]; rec.addLine(0, a[0], a[1], b[0], b[1], "c"); }

      // ---- dimensions, aligned to shared gutters (L/R verticals, T/B horizontals) ----
      var TL = cp.TL, x0f = cs[0] - p.cols[0].D / 2, xFL = cs[0] - p.cols[0].D / 2 - f.BLF;
      var bnd = {
        minX: Math.min(-TL / 2, footMinX), maxX: Math.max(TL / 2, footMaxX),
        minY: -f.BH - (f.EH > 0 ? f.EH : 0), maxY: maxCH + A.yTop
      };
      var dims = [
        { side: "T", at: maxCH + A.yTop, lo: -TL / 2, hi: TL / 2, label: "TL" },      // overall width (top)
        { side: "T", at: maxCH + A.yMid, lo: A.xLe, hi: A.xLH, label: "HLL" },        // left haunch length
        { side: "T", at: maxCH + A.yMid, lo: A.xRH, hi: A.xRe, label: "HLR" },        // right haunch length
        { side: "L", at: A.xLtip, lo: maxCH + A.yTip, hi: maxCH + A.yTop, label: "THU" },
        { side: "L", at: A.xLH, lo: maxCH + A.yMid, hi: maxCH + A.yTip, label: "THL" },
        { side: "L", at: x0f, lo: 0, hi: p.cols[0].CH, label: "CH" },                 // column height
        { side: "L", at: xFL, lo: -f.BH, hi: 0, label: "BH" },                        // footing height
        { side: "R", at: A.xRtip, lo: maxCH + A.yTip, hi: maxCH + A.yTop, label: "THU" },
        { side: "R", at: A.xRH, lo: maxCH + A.yMid, hi: maxCH + A.yTip, label: "THL" }
      ];
      if (A.HEL > 0) dims.push({ side: "T", at: maxCH + A.yTip, lo: A.xLtip, hi: A.xLe, label: "HEL" });
      if (A.HER > 0) dims.push({ side: "T", at: maxCH + A.yTip, lo: A.xRe, hi: A.xRtip, label: "HER" });
      layoutDims(dims, bnd).forEach(function (d) { rec.addDimLinear(0, d.x1, d.y1, d.x2, d.y2, d.gap, d.label); });
      // curved-soffit radius dims (HRL outer / HRR inner) when set
      geo.radiusDims.forEach(function (rd) { rec.addDimRadius(0, rd.c[0], rd.c[1] + maxCH, rd.r, rd.ang, rd.label); });

      var W = plotHost.clientWidth || 620, Hpx = Math.max(360, Math.min(560, Math.round(W * 0.62)));
      plotHost.innerHTML = window.RWSVG.renderSVG(rec, W, Hpx);
      var svg = plotHost.querySelector("svg");
      if (svg) window.RWSVG.attachZoomPan(svg);
      if (plotSub) plotSub.textContent = "선택 교각 정면도 — " + p.name + " · " +
        (TYPES.filter(function (t) { return t[0] === p.type; })[0] || [, p.type])[1] +
        " · " + p.colCount + " col · " + (p.fdnMode === "combined" ? "combined ftg" : "individual ftg");
    }
    _pierDraw = draw;

    // ── render orchestration ──
    var perWrap = h("div", "pr-col");        // right column: Type/Coping/Columns/Foundation
    function renderPerPier() {
      perWrap.innerHTML = "";
      perWrap.appendChild(cardType());
      perWrap.appendChild(cardCoping());
      perWrap.appendChild(cardColumns());
      perWrap.appendChild(cardFoundation());
    }
    function renderAll() {
      stack.innerHTML = "";
      stack.appendChild(cardPiers());
      renderSelector(); stack.appendChild(selWrap);
      var grid = h("div", "pr-grid");
      var left = h("div", "pr-col"); left.appendChild(cardPreview());
      grid.appendChild(left);
      renderPerPier(); grid.appendChild(perWrap);
      stack.appendChild(grid);
      draw();
    }
    renderAll();
  };
})();
