/*
    bim_pier_dev.js — Pier input, /dev/ ONLY (www.macrobim.com/dev/ → design dev 브랜치 layout_body_test.js).
    bim_pier_test.js 의 사본에서 출발했다. 운영 · index_claude 는 여전히 bim_pier_test.js 를 부른다 —
    이 파일을 고쳐도 운영은 그대로다.

    ★ 계산은 여기에 없다. 형상 · 도면 조립 · 3D 메쉬는 서버(POST /pier/api.php, 비공개 macroPIER)가 하고,
      이 파일은 입력을 보내고 돌아온 표준 포맷(L 선 · A 아크 · DL 치수 · DR 반지름 치수 · TX 글자, =
      RWSVG.MockViewer)을 그리기만 한다. 엔진을 고치거나 새 형상을 넣을 때는 macroPIER 에서 한다 —
      이 파일에 계산을 다시 넣지 않는다.
    Entry point: fdraw_pier(mountId)   [default mount: 'mount-draw-pier']

    ONE pier per page (no "+ Add pier"). The page starts with a type wizard so a first-time
    user picks the big picture before any number:
      1. Pier type   — structure (T-type · Multi-column · Wall · Column) → coping shape
                       (Rectangular · Straight haunch · Curved haunch) → column section → footing.
                       Each choice applies presets; afterwards it collapses to a summary + "Change type".
      2. Elevation   — name + alignment / cap-top / footing EL (CH derived)
      3. Live drawing (front + side + plans) — shown from the first step
      4. Detail cards — Coping · Columns · Foundation, showing ONLY the inputs the chosen
         type uses (e.g. HRL/HRR only for a curved haunch; no coping card for Column type).
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
    ".pr-hd{display:flex;justify-content:space-between;align-items:center;gap:10px;min-height:43px;padding:11px 16px;border-bottom:1px solid var(--hair);background:var(--chip)}" +
    ".pr-ttl{font-size:15px;font-weight:600;color:#0f172a;display:inline-flex;align-items:center}" +
    ".pr-ttl::before{content:'';display:inline-block;width:4px;height:15px;border-radius:2px;background:#2563eb;margin-right:9px;flex-shrink:0}" +
    ".pr-sub{font-size:12.5px;color:#94a3b8;font-weight:400;text-transform:none;letter-spacing:0;margin-left:7px}" +
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
    ".pr-btn:hover{filter:brightness(1.12)}.pr-btn:active{filter:brightness(.94);transform:translateY(1px)}" +
    ".pr-wnav{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:2px 0 14px}" +
    ".pr-wpill{font:inherit;font-size:12px;font-weight:600;padding:5px 12px;border:1px solid var(--line);border-radius:999px;background:var(--panel);color:var(--muted);cursor:pointer}" +
    ".pr-wpill b{display:inline-block;min-width:16px;font-weight:700}" +
    ".pr-wpill.on{background:var(--dim);border-color:var(--dim);color:#fff}" +
    ".pr-wpill.done{color:var(--dim);border-color:var(--dim)}" +
    ".pr-wpill:disabled{opacity:.55;cursor:default}" +
    ".pr-warr{color:#94a3b8;font-size:14px}" +
    ".pr-wopts{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}" +
    ".pr-wopt{font:inherit;display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px 10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--panel);cursor:pointer;text-align:center;transition:border-color .12s,box-shadow .12s}" +
    ".pr-wopt:hover{border-color:var(--dim);box-shadow:0 2px 8px rgba(37,99,235,.12)}" +
    ".pr-wopt.on{border-color:var(--dim);background:#f5f8ff;box-shadow:inset 0 0 0 1px var(--dim)}" +
    ".pr-wopt .nm{font-size:13.5px;font-weight:700;color:var(--ink)}" +
    ".pr-wopt .ds{font-size:11.5px;color:var(--muted);line-height:1.4}" +
    ".pr-wcount{display:flex;align-items:center;gap:12px;font-size:13px;font-weight:600;margin:0 0 12px}" +
    ".pr-wfoot{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}" +
    ".pr-wsum{display:flex;flex-wrap:wrap;align-items:center;gap:8px}" +
    ".pr-wchip{font-size:12.5px;font-weight:600;color:var(--ink);background:var(--chip);border:1px solid var(--hair);border-radius:999px;padding:5px 12px}" +
    ".pr-elin{display:flex;flex-wrap:wrap;gap:12px 22px;align-items:flex-end}" +
    ".pr-elc{display:flex;flex-direction:column;gap:5px}" +
    ".pr-elc > span:first-child{font-size:10.5px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:var(--muted)}" +
    ".pr-elc .pr-ch{display:inline-block;min-width:80px;padding:5px 0}" +
    ".pr-plotwrap{position:relative}" +
    ".pr-busy{position:absolute;left:0;right:0;top:0;height:3px;overflow:hidden;opacity:0;transition:opacity .15s;pointer-events:none}" +
    ".pr-busy::before{content:'';position:absolute;top:0;bottom:0;left:-35%;width:35%;background:var(--dim);border-radius:2px;animation:pr-slide 1s ease-in-out infinite}" +
    ".pr-plotwrap.busy .pr-busy{opacity:1}" +
    ".pr-plotwrap.busy > div:last-child{opacity:.55;transition:opacity .15s}" +
    ".pr-plotwrap.busy{cursor:progress}" +
    "@keyframes pr-slide{0%{left:-35%}100%{left:100%}}" +
    "@media (prefers-reduced-motion:reduce){.pr-busy::before{animation:none;left:0;width:100%;opacity:.6}}" +
    ".pr-modal{position:fixed;inset:0;z-index:1000;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:24px}" +
    ".pr-mbox{background:#fff;border-radius:12px;width:min(1240px,100%);max-height:100%;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.3)}" +
    ".pr-mhd{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid var(--hair)}" +
    ".pr-mttl{font-size:16px;font-weight:700;color:#0f172a}" +
    ".pr-mact{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap}" +
    ".pr-ghost{background:#fff;color:var(--dim);box-shadow:none}" +
    ".pr-mx{font:inherit;font-size:22px;line-height:1;color:#64748b;background:none;border:none;cursor:pointer;padding:2px 6px}" +
    ".pr-mx:hover{color:#0f172a}" +
    ".pr-mbody{height:min(76vh,860px);overflow:hidden;background:#e5e7eb;padding:12px;position:relative}" +
    ".pr-mbody > svg{filter:drop-shadow(0 2px 6px rgba(0,0,0,.18))}" +
    ".pr-mfoot{padding:10px 16px;font-size:12px;color:#64748b;border-top:1px solid var(--hair)}" +
    ".pr-mwait{padding:60px 16px;text-align:center;color:#64748b;font-size:13px}" +
    ".pr-mwait .pr-busy{height:3px;max-width:240px;margin:0 auto 12px}";

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
      // type wizard state (dev). type: T | multi | wall | column. copeType: rect | haunch | arc.
      // noCope (Column type) drops the coping entirely: CH runs up to the cap-top EL.
      type: "T", copeType: "haunch", noCope: false,
      portal: { n: 2, B: 2000, H: 2000, W: 6000 },    // Portal (문형 · 라멘): legs B×H, clear opening W
      flare: { FH: 3000, BT: 5000 },                  // Flared (횃불형): flare height from the column top, top width (front)
      fdnType: "spread",                              // spread | pile
      pile: { D: 1000, L: 12000, NX: 3, NY: 2, SX: 2500, SY: 2500 },
      opt: { tip: false, round: false, groove: false }, _stash: {},
      fdnMode: "combined",   // combined | individual
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
  function copeHmm(p) { return p.noCope ? 0 : (+p.coping.THU || 0) + (+p.coping.THL || 0); }
  function pierCH(p) { var e = p.el || {}; return Math.max(0, Math.round(((+e.top || 0) - (+e.fdn || 0)) * 1000 - copeHmm(p))); }

  window.fdraw_pier = function (mountId) {
    var root = document.getElementById(mountId || "mount-draw-pier");
    if (!root) return;

    // one pier per page (S.piers stays a 1-element list so the drawing/DXF code is unchanged)
    var S = { piers: [newPier("P1")], sel: 0, wiz: { step: 0, done: false } };

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
    // ── type wizard (dev) ─────────────────────────────────────────────────────
    // Presets: choosing a type / coping shape writes the values that type needs. EL and
    // footing values are kept. Values switched off by an option are stashed and come back.
    var TYPES = [
      ["T", "T-type", "One column under a cantilever cap"],
      ["multi", "Multi-column", "Two or more columns under one cap"],
      ["wall", "Wall", "Wide wall shaft under a cap"],
      ["column", "Column", "Columns only, no cap beam"],
      ["portal", "Portal", "Rigid frame — legs straight to the footing"],
      ["flare", "Flared", "Column widening toward the top"]
    ];

    var COPES = [
      ["rect", "Rectangular", "Flat soffit, no haunch"],
      ["haunch", "Straight haunch", "Tapered cantilever soffit"],
      ["arc", "Curved haunch", "Arc soffit with radius R"]
    ];
    var FDNS = [["combined", "Combined footing", "One footing under all columns"], ["individual", "Individual footings", "One footing per column"]];
    var FTYPES = [["spread", "Spread footing", "Footing directly on the ground"], ["pile", "Pile footing", "Footing on a pile group"]];
    var LEGS = [["2", "One opening", "Two legs"], ["3", "Two openings", "Three legs"]];
    var COPE_NONE = ["none", "No cap", "The flared head is the top"];
    var OPTS = [
      ["tip", "Tip details", [["HEL", 500], ["HER", 500], ["HLU", 300], ["HRU", 300]]],
      ["round", "Rounded tips", [["CR", 1000]]],
      ["groove", "Centre groove", [["HD", 300], ["HW", 1000], ["HS", 1]]]
    ];
    function typeName(t) { for (var i = 0; i < TYPES.length; i++) if (TYPES[i][0] === t) return TYPES[i][1]; return t; }
    function copeName(t) { for (var i = 0; i < COPES.length; i++) if (COPES[i][0] === t) return COPES[i][1]; return t; }
    function copeKey(p) { return p.noCope ? "none" : p.copeType; }
    function shapeName(t) { for (var i = 0; i < SHAPES.length; i++) if (SHAPES[i][0] === t) return SHAPES[i][1]; return t; }
    function setCount(p, n) {
      n = clamp(n | 0, 1, 8);
      while (p.cols.length < n) { var c = newCol(); var r = p.cols[0]; if (r) { setColShape(c, r.shape); for (var k in r.sect) c.sect[k] = r.sect[k]; c.hollow = r.hollow; } p.cols.push(c); }
      if (p.cols.length > n) p.cols.length = n;
      p.colCount = n;
      if (n === 1) { p.fdnMode = "combined"; restoreEdges(p); }
    }
    // the individual-footing preset narrows BLF/BRF; going back to one footing restores them
    function restoreEdges(p) { if (p._fdnEdge) { p.fdn.BLF = p._fdnEdge[0]; p.fdn.BRF = p._fdnEdge[1]; p._fdnEdge = null; } }
    function allCols(p, shape, vals) { p.cols.forEach(function (c) { setColShape(c, shape); c.hollow = false; c.ang = 0; for (var k in vals) c.sect[k] = vals[k]; }); }
    function applyType(p, t) {
      var cp = p.coping;
      p.type = t; p.noCope = (t === "column");
      if (t === "portal") {
        setCount(p, p.portal.n); allCols(p, "rect", { B: p.portal.B, H: p.portal.H });
        applyCope(p, "rect"); cp.THU = 2000; cp.TB = p.portal.H; p.bstep.on = false; p.fdnMode = "combined";
        p.fdn.BLF = p.fdn.BRF = 1500;
        return;
      }
      if (t === "flare") {
        setCount(p, 1); allCols(p, "rect", { B: 2500, H: 2000 }); p.flare.BT = Math.max(p.flare.BT, 4000);
        cp.TLL = cp.TLR = 4500; cp.TB = 2500; cp.HLL = cp.HLR = 1500;
        if (p.copeType === "rect") { cp.HLL = cp.HLR = 0; }
        spaceCols(p); return;
      }
      if (t === "T") { setCount(p, 1); allCols(p, "circle", { D: 2500 }); cp.TLL = cp.TLR = 5000; cp.TB = 3000; cp.HLL = cp.HLR = 3000; }
      else if (t === "multi") { setCount(p, Math.max(2, p.colCount)); allCols(p, "circle", { D: 2500 }); cp.TLL = cp.TLR = 7000; cp.TB = 3000; cp.HLL = cp.HLR = 1500; }
      else if (t === "wall") { setCount(p, 1); allCols(p, "rect", { B: 7000, H: 2000 }); cp.TLL = cp.TLR = 5500; cp.TB = 3000; cp.HLL = cp.HLR = 1500; }
      else { setCount(p, Math.max(2, p.colCount)); allCols(p, "circle", { D: 1800 }); cp.TLL = cp.TLR = 4000; p.bstep.on = false; }
      if (t !== "column" && p.copeType === "rect") { cp.HLL = cp.HLR = 0; }
      spaceCols(p);
    }
    function stashOff(p, key) { if (+p.coping[key]) p._stash[key] = p.coping[key]; p.coping[key] = 0; }
    function stashOn(p, key, dflt) { if (!+p.coping[key]) p.coping[key] = p._stash[key] || dflt; }
    function applyCope(p, ct) {
      var cp = p.coping;
      if (ct === "rect") {
        // keep the total cap depth: the haunch thickness folds into THU
        if (+cp.THL) { p._stash.THL = cp.THL; cp.THU = (+cp.THU || 0) + (+cp.THL); cp.THL = 0; }
        stashOff(p, "HLL"); stashOff(p, "HLR"); stashOff(p, "HRL"); stashOff(p, "HRR"); stashOff(p, "HEL"); stashOff(p, "HER");
      } else {
        if (p.opt.tip) { stashOn(p, "HEL", 500); stashOn(p, "HER", 500); }
        if (!+cp.THL) { var thl = p._stash.THL || 1250; cp.THL = thl; cp.THU = Math.max(400, (+cp.THU || 0) - thl); }
        var hl = p.type === "T" ? 3000 : 1500;
        stashOn(p, "HLL", hl); stashOn(p, "HLR", hl);
        if (ct === "arc") { stashOn(p, "HRL", 5000); stashOn(p, "HRR", 5000); }
        else { stashOff(p, "HRL"); stashOff(p, "HRR"); }
      }
      p.copeType = ct;
    }
    function setOpt(p, key, on) {
      p.opt[key] = on;
      OPTS.forEach(function (o) {
        if (o[0] !== key) return;
        o[2].forEach(function (kv) {
          if (on && p.copeType === "rect" && (kv[0] === "HEL" || kv[0] === "HER")) return;
          if (on) stashOn(p, kv[0], kv[1]); else stashOff(p, kv[0]);
        });
      });
    }
    function wizSteps(p) {
      var st = [["type", "Structure"]];
      if (p.type === "portal") st.push(["legs", "Openings"]);
      else if (p.type !== "column") st.push(["cope", "Coping"]);
      if (p.type !== "portal") st.push(["col", p.type === "wall" ? "Wall section" : "Column"]);
      st.push(["fdn", "Footing"]);
      if (p.colCount > 1 && p.type !== "portal") st.push(["layout", "Footing layout"]);
      return st;
    }

    // ── wizard icons: our own front-elevation glyphs (viewBox 120×84) ──
    var IC_F = "#eef2f6", IC_S = "#182430", IC_A = "#2563eb";
    function icoSvg(inner, on) {
      return "<svg viewBox='0 0 120 84' width='120' height='84' aria-hidden='true' style='display:block'>" + inner.replace(/__S__/g, on ? IC_A : IC_S) + "</svg>";
    }
    function icoPoly(pts) { return "<polygon points='" + pts + "' fill='" + IC_F + "' stroke='__S__' stroke-width='1.6' stroke-linejoin='round'/>"; }
    function icoRect(x, y, w, h2) { return "<rect x='" + x + "' y='" + y + "' width='" + w + "' height='" + h2 + "' fill='" + IC_F + "' stroke='__S__' stroke-width='1.6'/>"; }
    var IC_CAP_H = "10,14 110,14 110,22 84,30 36,30 10,22";    // straight-haunch cap
    var IC_CAP_R = "10,14 110,14 110,30 10,30";                  // rectangular cap
    function icoType(t) {
      var g = icoRect(18, 68, 84, 9);                             // footing
      if (t === "T") g += icoRect(50, 30, 20, 38) + icoPoly(IC_CAP_H);
      else if (t === "multi") g += icoRect(28, 30, 14, 38) + icoRect(78, 30, 14, 38) + icoPoly("10,14 110,14 110,24 102,30 18,30 10,24");
      else if (t === "wall") g += icoRect(30, 30, 60, 38) + icoPoly("14,14 106,14 106,22 94,30 26,30 14,22");
      else if (t === "portal") g += icoRect(24, 30, 16, 38) + icoRect(80, 30, 16, 38) + icoRect(24, 16, 72, 14);
      else if (t === "flare") g += "<path d='M51,68 L51,46 Q51,32 36,30 L84,30 Q69,32 69,46 L69,68 Z' fill='" + IC_F + "' stroke='__S__' stroke-width='1.6' stroke-linejoin='round'/>" + icoRect(28, 16, 64, 14);
      else g = icoRect(14, 68, 92, 9) + icoRect(30, 22, 14, 46) + icoRect(76, 22, 14, 46);
      return g;
    }
    function icoLegs(n) {
      n = +n; var g = icoRect(14, 66, 92, 10), x0 = 18, w = 14, top = 16;
      var gap = (84 - n * w) / (n - 1);
      for (var i = 0; i < n; i++) g += icoRect(x0 + i * (w + gap), top + 14, w, 36);
      return g + icoRect(x0, top, 84, 14);
    }
    function icoFtype(t) {
      var g = icoRect(50, 12, 20, 30) + icoRect(18, 42, 84, 14);
      if (t === "pile") g += icoRect(26, 56, 8, 22) + icoRect(56, 56, 8, 22) + icoRect(86, 56, 8, 22);
      return g;
    }
    function icoCope(t) {
      var col = icoRect(50, 34, 20, 40);
      if (t === "none") return "<path d='M51,74 L51,52 Q51,38 34,34 L86,34 Q69,38 69,52 L69,74 Z' fill='" + IC_F + "' stroke='__S__' stroke-width='1.6' stroke-linejoin='round'/>";
      if (t === "rect") return col + icoPoly("8,16 112,16 112,34 8,34");
      if (t === "haunch") return col + icoPoly("8,16 112,16 112,24 76,34 44,34 8,24");
      return col + "<path d='M8,16 L112,16 L112,24 Q86,26 76,34 L44,34 Q34,26 8,24 Z' fill='" + IC_F + "' stroke='__S__' stroke-width='1.6' stroke-linejoin='round'/>";
    }
    function icoShape(t) {
      if (t === "circle") return "<circle cx='60' cy='42' r='26' fill='" + IC_F + "' stroke='__S__' stroke-width='1.6'/>";
      if (t === "track") return "<rect x='22' y='24' width='76' height='36' rx='18' fill='" + IC_F + "' stroke='__S__' stroke-width='1.6'/>";
      if (t === "octagon") return icoPoly("46,16 74,16 88,30 88,54 74,68 46,68 32,54 32,30");
      return icoRect(32, 16, 56, 52);
    }
    function icoFdn(t) {
      var g = icoRect(30, 18, 14, 44) + icoRect(76, 18, 14, 44);
      return t === "combined" ? g + icoRect(14, 62, 92, 10) : g + icoRect(18, 62, 38, 10) + icoRect(64, 62, 38, 10);
    }

    function cardWizard() {
      var p = P(), steps = wizSteps(p);
      if (S.wiz.step >= steps.length) S.wiz.step = steps.length - 1;
      var c = h("div", "pr-card pr-wiz");
      var hd = h("div", "pr-hd", "<span class='pr-ttl'>Pier type <span class='pr-sub'>" +
        (S.wiz.done ? "the inputs below follow this choice" : "step " + (S.wiz.step + 1) + " of " + steps.length) + "</span></span>");
      c.appendChild(hd);
      var body = h("div", "pr-body");
      if (S.wiz.done) {
        var sum = h("div", "pr-wsum");
        var bits = [typeName(p.type)];
        if (p.type === "portal") bits.push(p.portal.n + " legs · " + (p.portal.n - 1) + (p.portal.n > 2 ? " openings" : " opening"));
        else {
          if (!p.noCope) bits.push(copeName(p.copeType) + " cap"); else if (p.type === "flare") bits.push("no cap");
          bits.push((p.colCount > 1 ? p.colCount + " × " : "") + shapeName(p.cols[0].shape) + (p.type === "wall" ? " wall" : " column"));
        }
        bits.push((p.fdnType === "pile" ? "pile" : "spread") + (p.colCount > 1 && p.type !== "portal" ? (p.fdnMode === "combined" ? " · combined" : " · individual") : "") + " footing");
        bits.forEach(function (b, i) { sum.appendChild(h("span", "pr-wchip", b)); });
        var chg = h("button", "pr-btn", "Change type"); chg.type = "button"; chg.style.marginLeft = "auto";
        chg.onclick = function () { S.wiz.done = false; S.wiz.step = 0; renderAll(); };
        sum.appendChild(chg);
        body.appendChild(sum);
        c.appendChild(body); return c;
      }
      // step pills (click a finished step to go back)
      var nav = h("div", "pr-wnav");
      steps.forEach(function (st, i) {
        var b = h("button", "pr-wpill" + (i === S.wiz.step ? " on" : (i < S.wiz.step ? " done" : "")), "<b>" + (i + 1) + "</b> " + st[1]);
        b.type = "button"; b.disabled = i > S.wiz.step;
        b.onclick = function () { S.wiz.step = i; renderAll(); };
        nav.appendChild(b);
        if (i < steps.length - 1) nav.appendChild(h("span", "pr-warr", "›"));
      });
      body.appendChild(nav);
      var cur = steps[S.wiz.step][0];
      function next() { var st2 = wizSteps(p); if (S.wiz.step + 1 >= st2.length) S.wiz.done = true; else S.wiz.step++; renderAll(); }
      function opts(list, icon, isOn, pick) {
        var g = h("div", "pr-wopts");
        list.forEach(function (o) {
          var on = isOn(o[0]);
          var b = h("button", "pr-wopt" + (on ? " on" : ""), icoSvg(icon(o[0]), on) + "<span class='nm'>" + o[1] + "</span><span class='ds'>" + o[2] + "</span>");
          b.type = "button";
          b.onclick = function () { pick(o[0]); next(); };
          g.appendChild(b);
        });
        return g;
      }
      if (cur === "type") {
        body.appendChild(opts(TYPES, icoType, function (k) { return p.type === k; }, function (k) { applyType(p, k); }));
      } else if (cur === "legs") {
        body.appendChild(opts(LEGS, icoLegs, function (k) { return p.portal.n === +k; }, function (k) { p.portal.n = +k; applyType(p, "portal"); }));
      } else if (cur === "cope") {
        var cl = p.type === "flare" ? COPES.concat([COPE_NONE]) : COPES;
        body.appendChild(opts(cl, icoCope, function (k) { return copeKey(p) === k; }, function (k) {
          if (k === "none") { p.noCope = true; p.bstep.on = false; } else { p.noCope = false; applyCope(p, k); }
        }));
      } else if (cur === "col") {
        if (p.type === "multi" || p.type === "column") {
          var row = h("div", "pr-wcount"); row.appendChild(h("span", null, "Number of columns"));
          var stp = h("div", "pr-stepper"), mn = h("button", "pr-step", "−"), cn = h("input", "pr-cnt"), pl = h("button", "pr-step", "+");
          var lo = p.type === "multi" ? 2 : 1;
          cn.type = "number"; cn.value = p.colCount; cn.min = lo; cn.max = 8;
          function setN(n) { setCount(p, Math.max(lo, n)); spaceCols(p); renderAll(); }
          mn.type = pl.type = "button";
          mn.onclick = function () { setN(p.colCount - 1); }; pl.onclick = function () { setN(p.colCount + 1); };
          cn.addEventListener("change", function () { setN(parseInt(cn.value, 10) || lo); });
          stp.appendChild(mn); stp.appendChild(cn); stp.appendChild(pl); row.appendChild(stp);
          body.appendChild(row);
        }
        var shp = SHAPES.filter(function (s2) { return (p.type !== "wall" && p.type !== "flare") || s2[0] === "rect" || s2[0] === "track"; })
          .map(function (s2) { return [s2[0], s2[1], { rect: "B × H", circle: "Diameter D", track: "Rounded ends", octagon: "Chamfered corners" }[s2[0]]]; });
        body.appendChild(opts(shp, icoShape, function (k) { return p.cols[0].shape === k; }, function (k) {
          var keep = {}; if (p.type === "wall" || p.type === "flare") { keep.B = +p.cols[0].sect.B || 7000; keep.H = +p.cols[0].sect.H || 2000; }
          p.cols.forEach(function (col) { setColShape(col, k); for (var kk in keep) col.sect[kk] = keep[kk]; });
          spaceCols(p);
        }));
      } else if (cur === "fdn") {
        body.appendChild(opts(FTYPES, icoFtype, function (k) { return p.fdnType === k; }, function (k) { p.fdnType = k; }));
      } else {
        body.appendChild(opts(FDNS, icoFdn, function (k) { return p.fdnMode === k; }, function (k) {
          p.fdnMode = k;
          if (k === "individual") {   // preset only: keep neighbouring footings from overlapping
            var cs2 = colCenters(p), gapMin = Infinity;
            for (var i2 = 1; i2 < cs2.length; i2++) gapMin = Math.min(gapMin, cs2[i2] - cs2[i2 - 1] - (colW(p.cols[i2]) + colW(p.cols[i2 - 1])) / 2);
            var edge = Math.max(300, Math.floor((gapMin / 2 - 250) / 50) * 50);
            if (isFinite(edge)) {
              if (p._fdnEdge == null) p._fdnEdge = [p.fdn.BLF, p.fdn.BRF];
              p.fdn.BLF = Math.min(+p.fdn.BLF || 0, edge); p.fdn.BRF = Math.min(+p.fdn.BRF || 0, edge);
            }
          } else restoreEdges(p);
        }));
      }
      var foot = h("div", "pr-wfoot");
      if (S.wiz.step > 0) { var bk = h("button", "pr-gbtn", "‹ Back"); bk.type = "button"; bk.onclick = function () { S.wiz.step--; renderAll(); }; foot.appendChild(bk); }
      var sk = h("button", "pr-gbtn", S.wiz.step + 1 >= steps.length ? "Done ›" : "Keep & next ›"); sk.type = "button"; sk.onclick = next; foot.appendChild(sk);
      body.appendChild(foot);
      c.appendChild(body); return c;
    }

    // Portal frame: legs + beam (the engine places the legs and ends the beam at their outer faces)
    function cardFrame() {
      var p = P(), pt = p.portal, cp = p.coping;
      var c = h("div", "pr-card");
      c.appendChild(h("div", "pr-hd", "<span class='pr-ttl'>Frame <span class='pr-sub'>" + pt.n + " legs · " + (pt.n - 1) + (pt.n > 2 ? " openings" : " opening") + "</span></span>"));
      var b = h("div", "pr-body"), g = h("div", "pr-ingrid");
      function sync() { allCols(p, "rect", { B: pt.B, H: pt.H }); }
      g.appendChild(numRow("B", "Leg width (transverse)", pt.B, function (v) { pt.B = v; sync(); }));
      g.appendChild(numRow("H", "Leg thickness (longitudinal)", pt.H, function (v) { pt.H = v; sync(); }));
      g.appendChild(numRow("W", "Clear opening width", pt.W, function (v) { pt.W = v; }));
      g.appendChild(numRow("THU", "Beam depth", cp.THU, function (v) { cp.THU = v; }));
      g.appendChild(numRow("TB", "Beam width (longitudinal)", cp.TB, function (v) { cp.TB = v; }));
      b.appendChild(g);
      b.appendChild(h("p", "pr-cap", "Beam length L = legs × B + openings × W. The beam ends at the outer leg faces (no cantilever). Change the number of legs with Change type."));
      c.appendChild(b); return c;
    }

    // single pier: name + elevation datum (replaces the multi-pier schedule)
    function cardElevation() {
      var p = P();
      var c = h("div", "pr-card");
      c.appendChild(h("div", "pr-hd", "<span class='pr-ttl'>Levels <span class='pr-sub'>EL in m</span></span>"));
      var b = h("div", "pr-body");
      var g = h("div", "pr-elin");
      function cell(lbl, inp) { var w = h("label", "pr-elc"); w.appendChild(h("span", null, lbl)); w.appendChild(inp); g.appendChild(w); return w; }
      var nin = h("input", "pr-tin"); nin.type = "text"; nin.value = p.name; nin.oninput = function () { p.name = nin.value; draw(); };
      cell("Pier", nin);
      var chOut = h("span", "pr-ch");
      function elIn(key) {
        var inp = h("input", "pr-tin pr-mono"); inp.type = "number"; inp.step = "0.001"; inp.value = (+p.el[key]).toFixed(3);
        inp.oninput = function () { var v = parseFloat(inp.value); if (!isNaN(v)) { p.el[key] = v; chOut.textContent = (pierCH(p) / 1000).toFixed(3); draw(); } };
        return inp;
      }
      cell("Alignment EL", elIn("ctr"));
      cell(p.noCope ? "Column top EL" : "Cap top EL", elIn("top"));
      cell("Footing EL", elIn("fdn"));
      chOut.textContent = (pierCH(p) / 1000).toFixed(3); cell("CH (m)", chOut);
      b.appendChild(g);
      b.appendChild(h("p", "pr-cap", p.noCope ? "CH (column height) = Column top EL − Footing EL, computed automatically."
        : "CH (column height) = Cap top EL − cap depth (THU+THL) − Footing EL, computed automatically."));
      c.appendChild(b); return c;
    }

    function cardCoping() {
      var p = P(), cp = p.coping;
      var c = h("div", "pr-card");
      c.appendChild(h("div", "pr-hd", "<span class='pr-ttl'>Coping <span class='pr-sub'>cap beam</span></span>"));
      var body = h("div", "pr-body");
      var isRect = p.copeType === "rect";
      body.appendChild(h("div", "pr-subhd", copeName(p.copeType) + " cap"));
      var b = h("div", "pr-ingrid");
      b.appendChild(numRow("TLL", "Cap half-length left (from centre)", cp.TLL, function (v) { cp.TLL = v; }));
      b.appendChild(numRow("TLR", "Cap half-length right (from centre)", cp.TLR, function (v) { cp.TLR = v; }));
      b.appendChild(numRow("TB", "Cap width (longitudinal)", cp.TB, function (v) { cp.TB = v; }));
      b.appendChild(numRow("THU", isRect ? "Cap depth" : "Cantilever tip thickness", cp.THU, function (v) { cp.THU = v; }));
      if (!isRect) {
        b.appendChild(numRow("THL", "Haunch depth (tip soffit → centre soffit)", cp.THL, function (v) { cp.THL = v; }));
        b.appendChild(numRow("HLL", "Left cantilever haunch length", cp.HLL, function (v) { cp.HLL = v; }));
        b.appendChild(numRow("HLR", "Right cantilever haunch length", cp.HLR, function (v) { cp.HLR = v; }));
      }
      if (p.copeType === "arc") {
        b.appendChild(numRow("HRL", "Left haunch arc radius R", cp.HRL, function (v) { cp.HRL = v; }));
        b.appendChild(numRow("HRR", "Right haunch arc radius R", cp.HRR, function (v) { cp.HRR = v; }));
      }
      body.appendChild(b);
      // optional details — off by default; each switch shows its own inputs
      var OPT_ROWS = {
        HEL: ["Left tip flat length"], HER: ["Right tip flat length"], HLU: ["Left top flat length"], HRU: ["Right top flat length"],
        CR: ["Tip edge round"], HD: ["Centre groove depth"], HW: ["Centre groove width"], HS: ["Centre groove slope", "1:s", "0.1"]
      };
      body.appendChild(h("div", "pr-subhd", "Options"));
      var ob = h("div", "pr-wsum");
      OPTS.forEach(function (o) {
        var lb = h("label", "pr-bapply"); lb.style.marginRight = "14px";
        var ck = h("input"); ck.type = "checkbox"; ck.checked = !!p.opt[o[0]]; ck.style.cssText = "width:15px;height:15px;accent-color:var(--dim);cursor:pointer";
        ck.addEventListener("change", function () { setOpt(p, o[0], ck.checked); renderPerPier(); draw(); });
        lb.appendChild(ck); lb.appendChild(h("span", null, o[1])); ob.appendChild(lb);
      });
      body.appendChild(ob);
      var og = h("div", "pr-ingrid"), any = false;
      OPTS.forEach(function (o) {
        if (!p.opt[o[0]]) return;
        o[2].forEach(function (kv) {
          var k = kv[0], meta = OPT_ROWS[k];
          if (isRect && (k === "HEL" || k === "HER")) return;   // tip flats belong to a haunched soffit
          any = true;
          og.appendChild(numRow(k, meta[0], cp[k], function (v) { cp[k] = v; }, meta[1], meta[2]));
        });
      });
      if (any) body.appendChild(og);

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
      var isWall = p.type === "wall", canCount = (p.type === "multi" || p.type === "column"), loN = p.type === "multi" ? 2 : 1;
      var hd = h("div", "pr-hd", "<span class='pr-ttl'>" + (isWall ? "Wall" : (p.colCount > 1 ? "Columns" : "Column")) + " <span class='pr-sub'>section</span></span>");
      var stp = h("div", "pr-stepper");
      var minus = h("button", "pr-step", "−"), cnt = h("input", "pr-cnt"), plus = h("button", "pr-step", "+");
      cnt.type = "number"; cnt.value = p.colCount; cnt.min = 1; cnt.max = 8;
      function setCols(n) { setCount(p, Math.max(loN, n | 0)); spaceCols(p); renderAll(); }
      minus.onclick = function () { setCols(p.colCount - 1); };
      plus.onclick = function () { setCols(p.colCount + 1); };
      cnt.addEventListener("change", function () { setCols(parseInt(cnt.value, 10)); });
      stp.appendChild(minus); stp.appendChild(cnt); stp.appendChild(plus);
      if (canCount) hd.appendChild(stp);
      c.appendChild(hd);

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
        row.appendChild(h("span", "cnm", isWall ? "Wall" : (p.cols.length > 1 ? "Column " + (i + 1) : "Column")));
        var isFlare = p.type === "flare";
        if (!isFlare) {
          row.appendChild(fld("CL", col.CL, function (v) { col.CL = v; }, "50"));
          row.appendChild(fld("Ang", col.ang || 0, function (v) { col.ang = v; }, "5"));
        }
        var sel = h("select", "pr-sel");
        SHAPES.filter(function (s) { return !(isWall || p.type === "flare") || s[0] === "rect" || s[0] === "track"; }).forEach(function (s) { var o = h("option"); o.value = s[0]; o.textContent = s[1]; if (col.shape === s[0]) o.selected = true; sel.appendChild(o); });
        sel.addEventListener("change", function () { setColShape(col, sel.value); renderPerPier(); draw(); });
        row.appendChild(sel);
        // section vars — hollow-only vars appear only when Hollow is checked
        (SECT_VARS[col.shape] || []).forEach(function (v) {
          if (v[2] && !col.hollow) return;
          var name = v[0];
          row.appendChild(fld(name, (col.sect[name] != null ? col.sect[name] : v[1]), function (val) { col.sect[name] = val; }));
        });
        if (!isFlare) row.appendChild(chk("Hollow", col.hollow, function (v) { col.hollow = v; renderPerPier(); }));
        else {
          row.appendChild(fld("FH", p.flare.FH, function (v) { p.flare.FH = v; }));
          row.appendChild(fld("BT", p.flare.BT, function (v) { p.flare.BT = v; }));
        }
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
      if (p.type === "flare") b.appendChild(h("p", "pr-cap", "Flared column: B is the width at the bottom, BT the width at the top (front view only — the side stays H thick). FH is the flare height measured down from the column top; the flare is one arc tangent to the column face."));
      else b.appendChild(h("p", "pr-cap", "Column height (CH) is auto-computed from the Levels card · CL — transverse position from the pier centre (left −, right +) · Ang — section placement angle (°) · Hollow toggles the wall variables · Guide shows the section diagram."));
      c.appendChild(b); return c;
    }

    function cardFoundation() {
      var p = P(), f = p.fdn;
      var c = h("div", "pr-card");
      c.appendChild(h("div", "pr-hd", "<span class='pr-ttl'>Foundation <span class='pr-sub'>footing</span></span>"));
      var b = h("div", "pr-body");
      var tk = h("div", "pr-modes");
      FTYPES.forEach(function (m) {
        var mb = h("button", "pr-mode" + (p.fdnType === m[0] ? " on" : ""), m[1]); mb.type = "button";
        mb.onclick = function () { p.fdnType = m[0]; renderAll(); };
        tk.appendChild(mb);
      });
      b.appendChild(tk);
      if (p.colCount > 1 && p.type !== "portal") {
        var md = h("div", "pr-modes");
        [["combined", "Combined"], ["individual", "Individual"]].forEach(function (m) {
          var mb = h("button", "pr-mode" + (p.fdnMode === m[0] ? " on" : ""), m[1]); mb.type = "button";
          mb.onclick = function () { p.fdnMode = m[0]; renderAll(); };
          md.appendChild(mb);
        });
        b.appendChild(md);
      }
      var ig = h("div", "pr-ingrid");
      ig.appendChild(numRow("BH", "Footing height", f.BH, function (v) { f.BH = v; }));
      ig.appendChild(numRow("BLF", "Edge to col, left (transv.)", f.BLF, function (v) { f.BLF = v; }));
      ig.appendChild(numRow("BRF", "Edge to col, right (transv.)", f.BRF, function (v) { f.BRF = v; }));
      ig.appendChild(numRow("FF", "Edge to col, left (longit.)", f.FF, function (v) { f.FF = v; }));
      ig.appendChild(numRow("FB", "Edge to col, right (longit.)", f.FB, function (v) { f.FB = v; }));
      ig.appendChild(numRow("EFL", "Blinding projection", f.EFL, function (v) { f.EFL = v; }));
      ig.appendChild(numRow("EH", "Blinding height", f.EH, function (v) { f.EH = v; }));
      b.appendChild(ig);
      if (p.fdnType === "pile") {
        var pl = p.pile;
        b.appendChild(h("div", "pr-subhd", "Piles"));
        var pg = h("div", "pr-ingrid");
        pg.appendChild(numRow("PD", "Pile diameter", pl.D, function (v) { pl.D = v; }));
        pg.appendChild(numRow("PL", "Pile length (below footing)", pl.L, function (v) { pl.L = v; }));
        pg.appendChild(numRow("NX", "Piles across (transverse), per footing", pl.NX, function (v) { pl.NX = Math.max(1, Math.round(v)); }, "pcs", "1"));
        pg.appendChild(numRow("NY", "Piles along (longitudinal), per footing", pl.NY, function (v) { pl.NY = Math.max(1, Math.round(v)); }, "pcs", "1"));
        pg.appendChild(numRow("SX", "Pile spacing, transverse", pl.SX, function (v) { pl.SX = v; }));
        pg.appendChild(numRow("SY", "Pile spacing, longitudinal", pl.SY, function (v) { pl.SY = v; }));
        b.appendChild(pg);
        b.appendChild(h("p", "pr-cap", "The pile group is centred under each footing."));
      }
      c.appendChild(b); return c;
    }

    // ── live elevation preview (selected pier) — front + side in ONE drawing
    // so both share a single scale (same structure height) ──
    var plotHost = null, plotSub = null, busyBar = null;
    function cardPreview() {
      var c = h("div", "pr-card");
      var hd = h("div", "pr-hd", "<span class='pr-ttl'>Elevation <span class='pr-sub' data-pr-sub>front + side</span></span>" +
        "<span style='display:inline-flex;gap:6px;flex-wrap:wrap'>" +
        "<button type='button' class='pr-btn' data-pr-sheet>Drawing preview</button>" +
        "<button type='button' class='pr-btn' data-pr-3d>3D preview</button>" +
        "<button type='button' class='pr-btn' data-pr-regen>&#8635; Reset</button></span>");
      c.appendChild(hd);
      plotSub = hd.querySelector("[data-pr-sub]");
      hd.querySelector("[data-pr-regen]").addEventListener("click", function () { draw(); });
      hd.querySelector("[data-pr-sheet]").addEventListener("click", function () { showSheet(); });
      hd.querySelector("[data-pr-3d]").addEventListener("click", function () { show3D(); });
      var body = h("div", "pr-body pr-plotwrap");
      busyBar = h("div", "pr-busy"); busyBar.setAttribute("role", "progressbar"); busyBar.setAttribute("aria-label", "Drawing");
      plotHost = h("div"); plotHost.style.cssText = "width:100%;overflow:hidden";
      body.appendChild(busyBar); body.appendChild(plotHost); c.appendChild(body);
      return c;
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

    // ── server engine (macroPIER, /pier/api.php) ──
    // All geometry is computed on the server (private). It returns the drawing in the standard record
    // format (L · A · DL · DR · TX, = RWSVG.MockViewer) and the 3D mesh; this page only draws them.
    var API = "/pier/api.php", _reqSeq = 0, _drawT = null, _lastComp = null, _srv = "unknown";
    // progress: a thin sliding bar over the drawing + dimmed drawing, only when the server takes
    // longer than BUSY_MS (fast answers never flicker). Counted so overlapping requests stack.
    var BUSY_MS = 150, _busyN = 0, _busyT = null;
    function busy(on) {
      _busyN = Math.max(0, _busyN + (on ? 1 : -1));
      var wrap = busyBar && busyBar.parentNode;
      if (!wrap) return;
      if (_busyN > 0) {
        if (!_busyT && !wrap.classList.contains("busy")) _busyT = setTimeout(function () { _busyT = null; if (_busyN > 0) wrap.classList.add("busy"); }, BUSY_MS);
      } else { clearTimeout(_busyT); _busyT = null; wrap.classList.remove("busy"); }
    }
    // results already received, keyed by the exact input — the same input never goes to the server twice
    // (Regen, wizard back-and-forth, undoing a value). Small LRU per kind (draw / mesh).
    var _memo = { draw: { k: [], v: {} }, mesh: { k: [], v: {} } }, MEMO_MAX = 40;
    function memoGet(kind, key) { return _memo[kind].v[key]; }
    function memoPut(kind, key, val) {
      var m = _memo[kind];
      if (!(key in m.v)) { m.k.push(key); if (m.k.length > MEMO_MAX) delete m.v[m.k.shift()]; }
      m.v[key] = val;
    }
    function inputKey() { return JSON.stringify(P()); }
    function fetchCompute(want, body) {
      return fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: body || JSON.stringify({ pier: P(), want: want }) })
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(function (j) { if (!j || !j.ok) throw new Error((j && j.error) || "engine"); return j; });
    }
    function compFromServer(j) {
      var rec = new window.RWSVG.MockViewer();
      rec.L = j.rec.L || []; rec.A = j.rec.A || []; rec.DL = j.rec.DL || []; rec.DR = j.rec.DR || []; rec.TX = j.rec.TX || [];
      return { rec: rec, box: j.box };
    }
    function paintMsg(msg) {
      _lastComp = null;
      plotHost.innerHTML = "<div style='padding:48px 16px;text-align:center;color:#64748b;font-size:13px;line-height:1.6'>" + msg + "</div>";
    }
    function draw() {
      if (!plotHost || !plotHost.isConnected) return;
      if (typeof window.RWSVG === "undefined") { ensureCore(draw); return; }
      var seq = ++_reqSeq;
      clearTimeout(_drawT);
      var hit = memoGet("draw", inputKey());
      if (hit) { paint(hit); return; }                  // same input as before → no server trip
      _drawT = setTimeout(function () {
        var key = inputKey(), body = JSON.stringify({ pier: P(), want: ["draw"] });
        busy(true);
        fetchCompute(["draw"], body).then(function (j) {
          busy(false);
          var comp = compFromServer(j); memoPut("draw", key, comp);
          if (seq !== _reqSeq) return; _srv = "up"; paint(comp);
        }).catch(function () {
          busy(false);
          if (seq !== _reqSeq) return; _srv = "down";
          paintMsg("The drawing engine is not reachable right now. Please try again in a moment.");
        });
      }, 120);
    }
    function paint(comp) {
      if (!plotHost || !plotHost.isConnected) return;
      _lastComp = comp;
      var full = comp.box;
      var bw = Math.max(full.maxX - full.minX, 1), bh = Math.max(full.maxY - full.minY, 1);
      var W = plotHost.clientWidth || 1000, s = (W - 80) / bw;
      var Hpx = Math.max(260, Math.min(440, Math.round(bh * s) + 50));
      plotHost.innerHTML = window.RWSVG.renderSVG(comp.rec, W, Hpx);
      var svg = plotHost.querySelector("svg");
      if (svg) window.RWSVG.attachZoomPan(svg);
      var pp = P();
      if (plotSub) plotSub.textContent = pp.name + (_srv === "up" ? " · server" : "") + " · " + pp.colCount + " col · " + (pp.fdnMode === "combined" ? "combined" : "individual") + " · " + (pp.fdnType === "pile" ? "pile" : "spread") + " ftg · EL " + (+pp.el.top).toFixed(3) + "/" + (+pp.el.fdn).toFixed(3) + " (CH " + (pierCH(pp) / 1000).toFixed(3) + "m)";
    }

    function getMesh(cb) {
      var key = inputKey(), hit = memoGet("mesh", key);
      if (hit) { cb(hit); return; }
      busy(true);
      fetchCompute(["mesh"]).then(function (j) { busy(false); memoPut("mesh", key, j.mesh); cb(j.mesh); }).catch(function () {
        busy(false);
        if (_modal) { var mb = _modal.querySelector(".pr-mbody"); if (mb) mb.innerHTML = "<div class='pr-mwait'>The drawing engine is not reachable right now.</div>"; }
      });
    }
    // ── preview windows (A3 drawing / 3D). Downloads live inside them, so the drawing is seen first ──
    function openModal(title, actions) {
      closeModal();
      var ov = h("div", "pr-modal"); ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true");
      var box = h("div", "pr-mbox"), hd = h("div", "pr-mhd"), body = h("div", "pr-mbody"), foot = h("div", "pr-mfoot");
      hd.appendChild(h("span", "pr-mttl", title));
      var act = h("span", "pr-mact");
      (actions || []).forEach(function (a) { var b = h("button", "pr-btn" + (a.ghost ? " pr-ghost" : ""), a.label); b.type = "button"; b.onclick = a.on; act.appendChild(b); });
      var x = h("button", "pr-mx", "&times;"); x.type = "button"; x.setAttribute("aria-label", "Close"); x.onclick = closeModal; act.appendChild(x);
      hd.appendChild(act); box.appendChild(hd); box.appendChild(body); box.appendChild(foot); ov.appendChild(box);
      ov.addEventListener("click", function (e) { if (e.target === ov) closeModal(); });
      (root.querySelector(".pr-root") || root).appendChild(ov); _modal = ov;   // inside .pr-root → same fonts / colours
      body.innerHTML = "<div class='pr-mwait'><div class='pr-busy' style='opacity:1;position:relative'></div>Preparing…</div>";
      return { body: body, foot: foot };
    }
    var _modal = null;
    function closeModal() { if (_modal && _modal.parentNode) _modal.parentNode.removeChild(_modal); _modal = null; }
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });
    function saveFile(data, name, type) {
      var blob = new Blob([data], { type: type });
      var url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = name; document.body.appendChild(a); a.click();
      document.body.removeChild(a); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }
    function fileBase() { return (P().name || "pier").replace(/[^A-Za-z0-9_.-]+/g, "_"); }
    // server results that are not the live drawing: sheet SVG / DXF (memoised like the drawing)
    function getServer(kind, cb, fail) {
      var key = inputKey(), hit = memoGet(kind, key);
      if (hit) { cb(hit); return; }
      fetchCompute([kind]).then(function (j) { var v = kind === "dxf" ? j.dxf : j.sheet; memoPut(kind, key, v); cb(v); }).catch(fail);
    }
    _memo.sheet = { k: [], v: {} }; _memo.dxf = { k: [], v: {} };

    // A3 drawing sheet: front · side · plan · section A-A · ISO, title block. DXF has live DIMENSIONs.
    function showSheet() {
      var m = openModal("Drawing preview", [
        { label: "&#8681; Download DXF", on: downloadSheetDXF },
        { label: "Reset", ghost: true, on: function () { if (_sheetSvg) mountSvg(_sheetSvg); } }
      ]);
      var _sheetSvg = null;
      function mountSvg(svg) {
        m.body.innerHTML = svg;
        var el = m.body.querySelector("svg");
        if (el) { el.setAttribute("width", "100%"); el.setAttribute("height", "100%"); el.style.display = "block"; window.RWSVG && window.RWSVG.attachZoomPan(el); }
      }
      getServer("sheet", function (sh) {
        if (!_modal) return;
        _sheetSvg = sh.svg; mountSvg(sh.svg);
        m.foot.textContent = "A3 · S = 1:" + sh.scale + (sh.scaleSection !== sh.scale ? " (section A-A 1:" + sh.scaleSection + ")" : "") +
          " · wheel to zoom, drag to pan. The DXF keeps the same layout; its dimensions are live CAD dimensions — move a point in CAD and the value follows.";
      }, function () { m.body.innerHTML = "<div class='pr-mwait'>The drawing engine is not reachable right now.</div>"; });
    }
    function downloadSheetDXF() {
      busy(true);
      getServer("dxf", function (dxf) { busy(false); saveFile(dxf, fileBase() + "_A3.dxf", "application/dxf"); },
        function () { busy(false); alert("The drawing engine is not reachable right now."); });
    }

    function show3D() {
      var m = openModal("3D preview", [{ label: "&#8681; Download STL", on: function () { getMesh(function (mesh) { saveFile(_stl(mesh), fileBase() + ".stl", "application/octet-stream"); }); } }]);
      getMesh(function (mesh) {
        if (!_modal) return;
        m.body.innerHTML = "";
        var d3 = h("div"); d3.id = "pr-3d-host"; d3.style.cssText = "width:100%;height:min(70vh,640px);background:#1a1a2e;border-radius:8px;overflow:hidden";
        m.body.appendChild(d3);
        window.RWSVG.render3d("pr-3d-host", "render_pier_3d", "https://macrobim.github.io/macroBIM/bim_pier_3d.js?v=1", [mesh]);
        m.foot.textContent = "Drag to orbit, wheel to zoom. STL is the same solid (mm).";
      });
    }

    _pierDraw = draw;

    // ── render orchestration ──
    var perWrap = h("div", "pr-col");        // right column: Coping/Columns/Foundation
    function renderPerPier() {
      perWrap.innerHTML = "";
      if (!S.wiz.done) return;               // details appear once the type is chosen
      perWrap.appendChild(cardElevation());
      if (P().type === "portal") perWrap.appendChild(cardFrame());
      else {
        if (!P().noCope) perWrap.appendChild(cardCoping());
        perWrap.appendChild(cardColumns());
      }
      perWrap.appendChild(cardFoundation());
    }
    function renderAll() {
      stack.innerHTML = "";
      stack.appendChild(cardWizard());       // type wizard → summary once done
      stack.appendChild(cardPreview());      // live drawing from the first click
      renderPerPier();                       // Elevation / Coping / Columns / Foundation (only what the type uses)
      stack.appendChild(perWrap);
      draw();
    }
    applyType(P(), "T"); applyCope(P(), "haunch");   // the page opens on the T-type preset it highlights
    renderAll();
  };
})();
