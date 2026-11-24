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
    Input codes are macroBIM's own (C = cap, F = footing, K = piles, B = pedestals, R = portal frame, P = flared column);
    the data model keeps its internal keys (sent to the server as is).
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
    sc.src = "https://macrobim.github.io/macroBIM/bim_draw_test_core.js?v=7";
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
    ".pr-wnav{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0 0 12px}" +
    ".pr-wact{margin-left:auto;display:inline-flex;gap:8px}" +
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
    ".pr-whint{margin-left:12px;font-size:12.5px;font-weight:600;color:var(--dim);background:#eff6ff;border:1px solid #bfdbfe;border-radius:999px;padding:2px 10px;white-space:normal}" +
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
    ".pr-mwait .pr-busy{height:3px;max-width:240px;margin:0 auto 12px}" +
    ".pr-rbtbl{width:100%;border-collapse:collapse;font-size:13px;table-layout:fixed}" +
    ".pr-rbtbl th{font-size:10.5px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:var(--muted);text-align:left;padding:5px 8px;border-bottom:1px solid var(--line)}" +
    ".pr-rbtbl td{padding:5px 8px;border-bottom:1px dashed var(--hair);white-space:nowrap}" +
    ".pr-rbtbl td:first-child{white-space:normal}" +
    ".pr-rbtbl .ko{color:var(--muted);font-size:11.5px;margin-left:4px}" +
    ".pr-rbtbl tr.off td:first-child{color:#94a3b8}" +
    ".pr-rbtbl input{width:78px;text-align:right;padding:5px 7px;margin-left:6px;border:1px solid var(--line);border-radius:6px;font-size:13px}" +
    ".pr-rbtbl .pr-q{padding:5px 4px}" +
    ".pr-lens{border-collapse:collapse;font-size:12.5px;margin:10px 0 6px}" +
    ".pr-lens th{font-size:11px;font-weight:600;color:var(--muted);padding:4px 10px;text-align:right;border-bottom:1px solid var(--line)}" +
    ".pr-lens th:first-child,.pr-lens td.b{text-align:left;font-weight:700;color:var(--dim)}" +
    ".pr-lens td{padding:3px 10px;text-align:right;border-bottom:1px dashed var(--hair);font-variant-numeric:tabular-nums}" +
    ".pr-lens input{width:76px;text-align:right;padding:3px 6px;border:1px solid var(--line);border-radius:5px;font-size:12px}" +
    ".pr-lens input.ed{background:#fff7ed;border-color:#fb923c}" +
    ".pr-lenstools{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0 0}.pr-lenstools .pr-gbtn:disabled{opacity:.5;cursor:default}" +
    ".pr-lenshint{font-size:12px;color:var(--muted)}.pr-lens input::placeholder{color:#c2410c}" +
    ".pr-lens th.u,.pr-lens td.u{text-align:center;color:var(--dim);font-weight:700}" +
    ".pr-rbdet{margin:4px 0 2px;font-size:12.5px}" +
    ".pr-rbdet summary{cursor:pointer;color:var(--dim);font-weight:600;font-size:12px;margin-bottom:6px}" +
    ".pr-rbtot{font-size:13px;margin-bottom:6px}.pr-rbtot b{font-size:15px}" +
    ".pr-rbdia{display:block;color:var(--muted);font-size:12px;margin-top:3px}" +
    ".pr-rbwarn{color:#b45309;font-size:12.5px;margin:3px 0}" +
    ".pr-rbnote{color:var(--muted);font-size:12px;margin:3px 0}" +
    ".pr-rbact{display:flex;gap:8px;margin-top:10px}" +
    ".pr-rbch{display:flex;align-items:center;gap:9px;font-size:14px;font-weight:700;color:#0f172a;margin:22px 0 8px;padding-bottom:7px;border-bottom:2px solid var(--line)}" +
    ".pr-rbch .n{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 6px;border-radius:6px;background:var(--dim);color:#fff;font-size:12px;font-variant-numeric:tabular-nums}" +
    ".pr-rbtbl td .no{display:inline-block;min-width:34px;color:var(--dim);font-weight:700;font-size:12px;font-family:ui-monospace,Menlo,Consolas,monospace}" +
    ".pr-rbsub{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#334155;margin:14px 0 6px}" +
    ".pr-rbsub .no{color:var(--dim);font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;min-width:34px}" +
    ".pr-rbsubk{font-weight:400;color:var(--muted);font-size:12px}" +
    ".pr-rbt2 td{padding:4px 8px}.pr-rbt2 .no{color:var(--dim);font-weight:700;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px}" +
    ".pr-rbin{width:78px;text-align:right;padding:5px 7px;margin:0 4px;border:1px solid var(--line);border-radius:6px;font-size:13px}" +
    ".pr-rbgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:2px 24px;margin:0 0 4px 8px}" +
    ".pr-rbf.pr-rbf0{justify-content:flex-start}" +
    ".pr-rbf{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px dashed var(--hair);font-size:13px}" +
    ".pr-rbf .l{color:var(--muted);font-size:12.5px}.pr-rbf .v{display:inline-flex;align-items:center;gap:2px}" +
    ".pr-rbchk{display:inline-flex;align-items:center;gap:7px;font-size:13px;cursor:pointer}" +
    ".pr-rbnone{color:var(--muted);font-size:12.5px;margin:2px 0 6px 8px}" +
    ".pr-rbsub + .pr-rbtbl, .pr-rbsub ~ .pr-gbtn{margin-left:0}" +
    ".pr-rblm{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:10px 0 2px}.pr-rblml{font-size:12px;font-weight:600;color:var(--muted);margin-right:6px}" +
    ".pr-rbdfl{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 4px}.pr-rbdfl .pr-cap{margin:0}" +
    ".pr-sched{border-collapse:collapse;font-size:12.5px;margin:0 0 16px;min-width:100%}" +
    ".pr-sched th{position:sticky;top:-12px;background:#f1f5f9;font-size:11px;font-weight:700;color:var(--muted);text-align:left;padding:6px 10px;border-bottom:1px solid var(--line)}" +
    ".pr-sched td{padding:4px 10px;border-bottom:1px solid var(--hair);white-space:nowrap}" +
    ".pr-sched .n{text-align:right;font-variant-numeric:tabular-nums}" +
    ".pr-sched .mk{font-weight:700;color:var(--dim)}" +
    ".pr-sum{min-width:0;width:auto}.pr-sched tr.tot td{font-weight:700;border-top:1px solid var(--line)}";

  // ── data model ──────────────────────────────────────────────────────────────
  function newCol() { return { shape: "circle", CH: 8000, CL: 0, ang: 0, hollow: false, sect: sectDefaults("circle") }; }
  function setColShape(col, shape) {
    var d = sectDefaults(shape);
    if (col.sect) for (var k in d) { if (col.sect[k] != null) d[k] = col.sect[k]; }   // keep shared vars
    col.shape = shape; col.sect = d;
  }
  // ── rebar (배근) ── bar tables match design/mod_rebar.js (the anchorage / lap sheet): [name, nominal dia mm]
  var BARS = {
    KS: [["D10", 9.53], ["D13", 12.7], ["D16", 15.9], ["D19", 19.1], ["D22", 22.2], ["D25", 25.4], ["D29", 28.6], ["D32", 31.8], ["D35", 34.9], ["D38", 38.1], ["D41", 41.3], ["D51", 50.8]],
    ASTM: [["#3", 9.53], ["#4", 12.7], ["#5", 15.9], ["#6", 19.1], ["#7", 22.2], ["#8", 25.4], ["#9", 28.7], ["#10", 32.3], ["#11", 35.8], ["#14", 43.0], ["#18", 57.3]],
    BS: [["10", 10], ["12", 12], ["16", 16], ["20", 20], ["25", 25], ["32", 32], ["40", 40], ["50", 50]]
  };
  function barDia(sys, bar) { var L = BARS[sys] || BARS.KS; for (var i = 0; i < L.length; i++) if (L[i][0] === bar) return L[i][1]; return 0; }
  function nearestBar(sys, db) { var L = BARS[sys] || BARS.KS, b = L[0][0], e = 1e9; L.forEach(function (x) { var d = Math.abs(x[1] - db); if (d < e) { e = d; b = x[0]; } }); return b; }
  // roles per member: [code, label, Korean (for us — not shown), has layers]
  var RB_ROLES = {
    cap: [["top", "Top main bars", "상면 주철근", 1], ["bot", "Bottom main bars", "하면 주철근", 1], ["stir", "Stirrups", "스터럽", 0], ["side", "Side bars", "측면 철근", 0]],
    col: [["start", "Starter bars", "스타터(기초 정착)", 0], ["main", "Main bars", "주철근", 0], ["tie", "Ties", "띠철근", 0], ["spiral", "Spiral", "나선철근", 0],
      ["tie2", "Ties (inner layers)", "안쪽 단 띠철근", 0], ["cross", "Crossties", "크로스타이", 0]],   // names only — chapter 4 has its own inputs
    fdn: [["bx", "Bottom, transverse", "하면 교축직각", 0], ["by", "Bottom, longitudinal", "하면 교축", 0], ["tx", "Top, transverse", "상면 교축직각", 0], ["ty", "Top, longitudinal", "상면 교축", 0],
      ["fside", "Side bars", "측면 철근", 0], ["shear", "Shear bars", "전단철근", 0]]   // names only — chapter 5 has its own inputs
  };
  // default values (the "Default values" button and a new pier) — common starting values only, not a design;
  // KS names, other standards take the nearest diameter.
  var RB_DEFAULT = { cap: { top: ["D29", 150, 1], bot: ["D29", 150, 1], stir: ["D16", 150], side: ["D16", 250] } };
  function kb(sys, b) { return sys === "KS" ? b : nearestBar(sys, barDia("KS", b)); }
  function defaultRows(sys) {
    var rows = [];
    ["cap"].forEach(function (m) { RB_ROLES[m].forEach(function (r) {
      var v = RB_DEFAULT[m][r[0]]; rows.push({ m: m, r: r[0], bar: kb(sys, v[0]), q: "s", v: v[1], ly: v[2] || 1 });
    }); });
    return rows;
  }
  // columns (chapter 4): main-bar layers · starter bars · splices along the height · ties (zones) · crossties.
  // Zone length L: -1 = L0 auto (max(section, height/6, 450)), 0 = the rest, else mm. 0 elsewhere = auto.
  function defaultCol(sys) {
    return { layers: [{ bar: kb(sys, "D32"), q: "s", v: 150, nb: 8, nh: 8, bundle: 1, d: 0 }],
      starter: { on: true, hook: "out", hl: 0, proj: 0, splice: "lap", stag: true, soff: 0, straightIn: true },
      splices: [],
      ties: { bar: kb(sys, "D16"), type: "hoop", zones: [{ L: -1, s: 100 }, { L: 0, s: 150 }, { L: -1, s: 100 }], inner: 2 },
      cross: { on: true, bar: kb(sys, "D16"), sup: "alt", every: 1 } };
  }
  // footing (chapter 5): main bars per face and direction (x = transverse, y = longitudinal), 2nd-cycle bars in between,
  // which direction lies outside, bar ends, side bars, shear bars
  function defaultFdn(sys) {
    return { bot: [{ dir: "x", bar: kb(sys, "D25"), s: 150, ly: 1, bar2: "" }, { dir: "y", bar: kb(sys, "D25"), s: 150, ly: 1, bar2: "" }],
      top: [{ dir: "x", bar: kb(sys, "D19"), s: 250, ly: 1, bar2: "" }, { dir: "y", bar: kb(sys, "D19"), s: 250, ly: 1, bar2: "" }],
      outer: "x", endB: { t: "hook", L: 0 }, endT: { t: "hook", L: 0 },
      side: { on: true, bar: kb(sys, "D16"), s: 300 }, shear: { on: false, bar: kb(sys, "D16"), type: "closed", sx: 600, sy: 600, zig: false } };
  }
  function fdnBars(F) {
    if (!F) return []; var o = [];
    ["bot", "top"].forEach(function (k) { F[k].forEach(function (r) { if (r.bar) o.push(r.bar); if (r.bar2) o.push(r.bar2); }); });
    if (F.side.on && F.side.bar) o.push(F.side.bar); if (F.shear.on && F.shear.bar) o.push(F.shear.bar);
    return o;
  }
  function colBars(C) {
    if (!C) return []; var o = [];
    C.layers.forEach(function (x) { if (x.bar) o.push(x.bar); }); C.splices.forEach(function (x) { if (x.bar) o.push(x.bar); });
    if (C.ties && C.ties.bar) o.push(C.ties.bar); if (C.cross && C.cross.on && C.cross.bar) o.push(C.cross.bar);
    return o;
  }
  function newRebar() {
    return { on: false, line: "double", cover: { cap: 60, col: 75, fdn: 100 }, stock: 12000,
      lap: { sys: "KS", std: "gujo", fck: 30, fy: 400, mode: "auto", grade: "B",
        calc: { cover: 50, ctc: 125, ktr: 0, lam: 1, way: "equ", phic: 0.65, eta1: 1, K: 0, lamTr: 0, p: 0, a1: 1, a6: 1, asreq: 1, asprov: 1 }, table: {} },
      rows: defaultRows("KS"), col: defaultCol("KS"), fdn: defaultFdn("KS") };
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
      // bearing pedestals (받침 콘크리트) on the cap top — the bearings themselves come later.
      // x: centre of each pedestal from the pier centre (transverse); rows 1 (on the cap centre line) or 2 (±e)
      ped: { on: false, x: [], rows: 1, e: 600, B: 800, L: 800, H: 300 },
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
      },
      rebar: newRebar()      // 배근 — the server places the bars (pier_rebar.php); off until switched on
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
        (S.wiz.done ? "the inputs below follow this choice" : "step " + (S.wiz.step + 1) + " of " + steps.length +
          "</span><span class='pr-whint'>Rebar details can be entered after the wizard has set the shape (dimensions too).") + "</span></span>");
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
      // Back / Next sit on the step row (right side) — no footer row, so the card stays short
      var foot = h("span", "pr-wact");
      if (S.wiz.step > 0) { var bk = h("button", "pr-gbtn", "‹ Back"); bk.type = "button"; bk.onclick = function () { S.wiz.step--; renderAll(); }; foot.appendChild(bk); }
      var sk = h("button", "pr-gbtn", S.wiz.step + 1 >= steps.length ? "Done ›" : "Keep & next ›"); sk.type = "button"; sk.onclick = next; foot.appendChild(sk);
      nav.appendChild(foot);
      c.appendChild(body); return c;
    }

    // Bearing pedestals (받침 콘크리트) — own card, shown for every type with a cap (incl. Portal)
    function cardPedestal() {
      // ── Bearing pedestals (받침 콘크리트) ── checkbox in front of the title, like Bearing step
      var p = P(), cp = p.coping;
      var c = h("div", "pr-card"), body = h("div", "pr-body");
      var pd = p.ped || (p.ped = { on: false, x: [], rows: 1, e: 600, B: 800, L: 800, H: 300 });
      function pedEqual(n) {   // equal spacing: centres of n equal cells across the cap (= bearing-step cells)
        var half = p.type === "portal" ? (p.portal.n * p.portal.B + (p.portal.n - 1) * p.portal.W) / 2 : null;   // portal beam = legs + openings
        var a = half != null ? -half : -(+cp.TLL || 0), len = half != null ? 2 * half : (+cp.TLL || 0) + (+cp.TLR || 0), w = len / n; pd.x = [];
        for (var i = 0; i < n; i++) pd.x.push(Math.round(a + w * (i + 0.5)));
      }
      var hd = h("div", "pr-hd");
      var phd = h("label", "pr-ttl"); phd.style.cssText = "cursor:pointer;gap:8px";
      var pck = h("input"); pck.type = "checkbox"; pck.checked = !!pd.on; pck.style.cssText = "width:15px;height:15px;accent-color:var(--dim);cursor:pointer";
      pck.addEventListener("change", function () {
        pd.on = pck.checked;
        if (pd.on && !pd.x.length) pedEqual(p.bstep && p.bstep.on && p.bstep.steps ? p.bstep.steps.length : 4);
        renderPerPier(); draw();
      });
      phd.appendChild(pck); phd.appendChild(h("span", null, "Bearing pedestals <span class='pr-sub'>on the cap top</span>"));
      hd.appendChild(phd); c.appendChild(hd);
      if (!pd.on) body.appendChild(h("p", "pr-cap", "Tick to place bearing pedestals on the cap. Bearings themselves are not drawn yet."));
      if (pd.on) {
        var prow = h("div", "pr-bhd");
        var rws = h("div", "pr-modes"); rws.style.margin = "0";
        [[1, "1 row"], [2, "2 rows"]].forEach(function (m) {
          var b = h("button", "pr-mode" + (pd.rows === m[0] ? " on" : ""), m[1]); b.type = "button"; b.style.flex = "0 0 auto"; b.style.padding = "5px 14px";
          b.onclick = function () { pd.rows = m[0]; renderPerPier(); draw(); }; rws.appendChild(b);
        });
        prow.appendChild(rws);
        var pst = h("div", "pr-stepper"), pmn = h("button", "pr-step", "−"), pcn = h("input", "pr-cnt"), ppl = h("button", "pr-step", "+"), peq = h("button", "pr-gbtn", "Equal spacing");
        pmn.type = ppl.type = peq.type = "button"; pcn.type = "number"; pcn.min = 1; pcn.max = 16; pcn.value = pd.x.length;
        function pedN(n) { n = clamp(n | 0, 1, 16); pedEqual(n); renderPerPier(); draw(); }
        pmn.onclick = function () { pedN(pd.x.length - 1); }; ppl.onclick = function () { pedN(pd.x.length + 1); };
        pcn.addEventListener("change", function () { pedN(parseInt(pcn.value, 10)); });
        peq.onclick = function () { pedN(pd.x.length); };
        pst.appendChild(h("span", null, "Count")); pst.appendChild(pmn); pst.appendChild(pcn); pst.appendChild(ppl); pst.appendChild(peq);
        prow.appendChild(pst); body.appendChild(prow);
        var pg = h("div", "pr-ingrid");
        pg.appendChild(numRow("B1", "Pedestal width (transverse)", pd.B, function (v) { pd.B = v; }));
        pg.appendChild(numRow("B2", "Pedestal length (longitudinal)", pd.L, function (v) { pd.L = v; }));
        pg.appendChild(numRow("B3", "Pedestal height", pd.H, function (v) { pd.H = v; }));
        if (pd.rows === 2) pg.appendChild(numRow("B4", "Row offset from cap centre (each side)", pd.e, function (v) { pd.e = v; }));
        body.appendChild(pg);
        var pt = h("table", "pr-btbl"), ph = h("tr"), pr = h("tr");
        ph.appendChild(h("th", null, "")); pr.appendChild(h("th", null, "x"));
        pd.x.forEach(function (x, i) {
          ph.appendChild(h("th", null, String(i + 1)));
          var td = h("td"), inp = h("input"); inp.type = "number"; inp.step = "50"; inp.value = x;
          inp.oninput = function () { var v = parseFloat(inp.value); if (!isNaN(v)) { pd.x[i] = v; draw(); } };
          td.appendChild(inp); pr.appendChild(td);
        });
        pt.appendChild(ph); pt.appendChild(pr); body.appendChild(pt);
        body.appendChild(h("p", "pr-cap", "x: centre of each pedestal from the pier centre (left −, right +). Equal spacing puts them at the centres of equal cells across the cap — the same cells as Bearing step. Each pedestal sits on the cap top of its own step. Bearings themselves are not drawn yet."));
      }
      c.appendChild(body); return c;
    }

    // Portal frame: legs + beam (the engine places the legs and ends the beam at their outer faces)
    function cardFrame() {
      var p = P(), pt = p.portal, cp = p.coping;
      var c = h("div", "pr-card");
      c.appendChild(h("div", "pr-hd", "<span class='pr-ttl'>Frame <span class='pr-sub'>" + pt.n + " legs · " + (pt.n - 1) + (pt.n > 2 ? " openings" : " opening") + "</span></span>"));
      var b = h("div", "pr-body"), g = h("div", "pr-ingrid");
      function sync() { allCols(p, "rect", { B: pt.B, H: pt.H }); }
      g.appendChild(numRow("R1", "Leg width (transverse)", pt.B, function (v) { pt.B = v; sync(); }));
      g.appendChild(numRow("R2", "Leg thickness (longitudinal)", pt.H, function (v) { pt.H = v; sync(); }));
      g.appendChild(numRow("R3", "Clear opening width", pt.W, function (v) { pt.W = v; }));
      g.appendChild(numRow("C4", "Beam depth", cp.THU, function (v) { cp.THU = v; }));
      g.appendChild(numRow("C3", "Beam width (longitudinal)", cp.TB, function (v) { cp.TB = v; }));
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
      b.appendChild(h("p", "pr-cap", p.noCope ? "Hc (column height) = Column top EL − Footing EL, computed automatically."
        : "Hc (column height) = Cap top EL − cap depth (C4 + C5) − Footing EL, computed automatically."));
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
      b.appendChild(numRow("C1", "Cap half-length left (from centre)", cp.TLL, function (v) { cp.TLL = v; }));
      b.appendChild(numRow("C2", "Cap half-length right (from centre)", cp.TLR, function (v) { cp.TLR = v; }));
      b.appendChild(numRow("C3", "Cap width (longitudinal)", cp.TB, function (v) { cp.TB = v; }));
      b.appendChild(numRow("C4", isRect ? "Cap depth" : "Cantilever tip thickness", cp.THU, function (v) { cp.THU = v; }));
      if (!isRect) {
        b.appendChild(numRow("C5", "Haunch depth (tip soffit → centre soffit)", cp.THL, function (v) { cp.THL = v; }));
        b.appendChild(numRow("C6", "Left cantilever haunch length", cp.HLL, function (v) { cp.HLL = v; }));
        b.appendChild(numRow("C7", "Right cantilever haunch length", cp.HLR, function (v) { cp.HLR = v; }));
      }
      if (p.copeType === "arc") {
        b.appendChild(numRow("C8", "Left haunch arc radius R", cp.HRL, function (v) { cp.HRL = v; }));
        b.appendChild(numRow("C9", "Right haunch arc radius R", cp.HRR, function (v) { cp.HRR = v; }));
      }
      body.appendChild(b);
      // optional details — off by default; each switch shows its own inputs
      // input codes are macroBIM's own (member letter + number); the engine keeps its internal keys
      var OPT_CODE = { HEL: "C10", HER: "C11", HLU: "C12", HRU: "C13", CR: "C14", HD: "C15", HW: "C16", HS: "C17" };
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
          og.appendChild(numRow(OPT_CODE[k] || k, meta[0], cp[k], function (v) { cp[k] = v; }, meta[1], meta[2]));
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
        ap2.appendChild(ck2); ap2.appendChild(h("span", null, "Uniform outer thickness (C4 fixed → C5 adjusts)")); body.appendChild(ap2);
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
        body.appendChild(h("p", "pr-cap", "w: segment width = (C1+C2)/steps (auto) · Δt: transverse level step (step 1 is the reference = 0) · Δl: longitudinal step (front/back, +Δl raises the back). Δt cumulates from the left cap end; + up / − down."));
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
          row.appendChild(fld("x", col.CL, function (v) { col.CL = v; }, "50"));
          row.appendChild(fld("θ", col.ang || 0, function (v) { col.ang = v; }, "5"));
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
          row.appendChild(fld("P3", p.flare.FH, function (v) { p.flare.FH = v; }));
          row.appendChild(fld("P4", p.flare.BT, function (v) { p.flare.BT = v; }));
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
      if (p.type === "flare") b.appendChild(h("p", "pr-cap", "Flared column: B is the width at the bottom, P4 the width at the top (front view only — the side stays H thick). P3 is the flare height measured down from the column top; the flare is one arc tangent to the column face."));
      else b.appendChild(h("p", "pr-cap", "Column height (Hc) is auto-computed from the Levels card · x — transverse position from the pier centre (left −, right +) · θ — section placement angle (°) · Hollow toggles the wall variables · Guide shows the section diagram."));
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
      ig.appendChild(numRow("F1", "Footing height", f.BH, function (v) { f.BH = v; }));
      ig.appendChild(numRow("F2", "Edge to col, left (transv.)", f.BLF, function (v) { f.BLF = v; }));
      ig.appendChild(numRow("F3", "Edge to col, right (transv.)", f.BRF, function (v) { f.BRF = v; }));
      ig.appendChild(numRow("F4", "Edge to col, left (longit.)", f.FF, function (v) { f.FF = v; }));
      ig.appendChild(numRow("F5", "Edge to col, right (longit.)", f.FB, function (v) { f.FB = v; }));
      ig.appendChild(numRow("F6", "Blinding projection", f.EFL, function (v) { f.EFL = v; }));
      ig.appendChild(numRow("F7", "Blinding height", f.EH, function (v) { f.EH = v; }));
      b.appendChild(ig);
      if (p.fdnType === "pile") {
        var pl = p.pile;
        b.appendChild(h("div", "pr-subhd", "Piles"));
        var pg = h("div", "pr-ingrid");
        pg.appendChild(numRow("K1", "Pile diameter", pl.D, function (v) { pl.D = v; }));
        pg.appendChild(numRow("K2", "Pile length (below footing)", pl.L, function (v) { pl.L = v; }));
        pg.appendChild(numRow("K3", "Piles across (transverse), per footing", pl.NX, function (v) { pl.NX = Math.max(1, Math.round(v)); }, "pcs", "1"));
        pg.appendChild(numRow("K4", "Piles along (longitudinal), per footing", pl.NY, function (v) { pl.NY = Math.max(1, Math.round(v)); }, "pcs", "1"));
        pg.appendChild(numRow("K5", "Pile spacing, transverse", pl.SX, function (v) { pl.SX = v; }));
        pg.appendChild(numRow("K6", "Pile spacing, longitudinal", pl.SY, function (v) { pl.SY = v; }));
        b.appendChild(pg);
        b.appendChild(h("p", "pr-cap", "The pile group is centred under each footing."));
      }
      c.appendChild(b); return c;
    }

    // ── Rebar 배근 ── the user's own arrangement (bar · spacing or count · layers) per member and role; the server
    // places every bar on the geometry, adds anchorage and laps, and returns the schedule. No design check (no
    // required-steel calculation) — the presets are starting values only.
    var rbSum = null, rbLens = null, _rbT = null, _rbSeq = 0;
    function rbChanged() { clearTimeout(_rbT); _rbT = setTimeout(function () { refreshRebar(); draw(true); }, 250); }
    function refreshRebar() {
      var p = P(); if (!p.rebar || !p.rebar.on || !rbSum || !rbSum.isConnected) return;
      var seq = ++_rbSeq;
      getServer("rebar", function (rb) { if (seq === _rbSeq) paintRebar(rb); }, function () {
        if (seq === _rbSeq && rbSum) rbSum.innerHTML = "<span class='pr-rbwarn'>The engine is not reachable right now.</span>";
      });
    }
    function paintRebar(rb) {
      if (!rbSum || !rbSum.isConnected) return;
      var t = "<div class='pr-rbtot'><b>" + fmtKg(rb.total) + "</b> · " + rb.bars.length + " bars · " + rb.marks.length + " marks";
      t += "<span class='pr-rbdia'>" + rb.sum.map(function (s2) { return s2.bar + " " + fmtKg(s2.wt); }).join(" · ") + "</span></div>";
      if (rb.couplers && rb.couplers.length) t += "<div class='pr-rbnote'>Couplers: " + rb.couplers.map(function (c) { return c.bar + " × " + c.n; }).join(" · ") + "</div>";
      (rb.warn || []).forEach(function (w) { t += "<div class='pr-rbwarn'>&#9888; " + w + "</div>"; });
      (rb.info || []).forEach(function (w) { t += "<div class='pr-rbnote'>" + w + "</div>"; });
      (rb.note || []).forEach(function (w) { t += "<div class='pr-rbnote'>" + w + "</div>"; });
      rbSum.innerHTML = t;
      paintLens(rb);
    }
    // anchorage / lap table: the values in use per bar size. Auto = from the calculation sheet's formulas (read only);
    // Manual / Auto + edit = type over a cell — mm, or a multiple of the bar diameter such as 40d.
    // anchorage / lap table: the values in use per bar size. Auto = from the calculation sheet's formulas (read only).
    // Edit = the same values in input cells; a cell the user changes overrides the calculation (orange), an emptied cell
    // goes back to the calculated value. Values in mm, or as a multiple of the bar diameter (40d).
    // A block copied from Excel (tab / new-line separated) can be pasted into any cell: it fills from that cell right and
    // down; a row that starts with a bar name (D25, #8 …) goes to that bar's row whatever the order.
    var LENS_COLS = [["ld", "Tension l<sub>d</sub>", "Tension ld"], ["ldh", "Hook l<sub>dh</sub>", "Hook ldh"], ["ldc", "Compr. l<sub>dc</sub>", "Compr. ldc"], ["lap", "Lap", "Lap"]];
    function lensSet(L, bar, key, v) {
      v = String(v == null ? "" : v).replace(/,/g, "").trim();
      L.table[bar] = L.table[bar] || {};
      if (v === "" || !/^\d+(\.\d+)?\s*(d|db)?$/i.test(v)) delete L.table[bar][key]; else L.table[bar][key] = v;
      if (!Object.keys(L.table[bar]).length) delete L.table[bar];
    }
    function lensPaste(L, rb, bar0, col0, text) {
      var names = (rb.lens || []).map(function (u) { return u.bar; }), rows = text.replace(/\r/g, "").split("\n").filter(function (r) { return r.trim() !== ""; });
      var start = names.indexOf(bar0), n = 0;
      rows.forEach(function (line, i) {
        var cells = line.split("\t").map(function (x) { return x.trim(); }), bar = names[start + i], c0 = col0;
        // a row that carries its bar name: D25 / #8 always; a plain number (BS 25) only when the row has 5 cells
        if (names.indexOf(cells[0]) >= 0 && (/[^0-9.]/.test(cells[0]) || cells.length === 5)) { bar = cells[0]; cells = cells.slice(1); c0 = 0; }
        if (cells.length > 4 && names.indexOf(cells[0]) < 0 && !/\d/.test(cells[0])) { cells = cells.slice(1); }                              // a label column
        if (!bar || !cells.some(function (x) { return /\d/.test(x); })) return;                                                               // header / empty row
        cells.forEach(function (v, j) { var k = c0 + j; if (k < 4 && v !== "") { lensSet(L, bar, LENS_COLS[k][0], v); n++; } });
      });
      return n;
    }
    function lensTSV(rb) {
      var o = ["Bar\t" + LENS_COLS.map(function (c) { return c[2]; }).join("\t")];
      (rb.lens || []).forEach(function (u) { o.push(u.bar + "\t" + LENS_COLS.map(function (c) { return u[c[0]]; }).join("\t")); });
      return o.join("\n");
    }
    function copyText(t, done) {
      function fb() { var ta = document.createElement("textarea"); ta.value = t; ta.style.cssText = "position:fixed;left:-9999px"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e) { } document.body.removeChild(ta); done(); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, fb); else fb();
    }
    function paintLens(rb) {
      if (!rbLens || !rbLens.isConnected) return;
      var R = P().rebar, L = R.lap, ed = L.mode !== "auto";
      var used = {}; R.rows.forEach(function (r) { if (r.bar) used[r.bar] = 1; });
      colBars(R.col).concat(fdnBars(R.fdn)).forEach(function (b) { used[b] = 1; });
      var cols = LENS_COLS;
      rbLens.innerHTML = "";
      // tools above the table: copy (for Excel) · back to the calculation
      var tools = h("div", "pr-lenstools");
      var cp = h("button", "pr-gbtn", "Copy table"); cp.type = "button"; cp.title = "Copy the values as tab-separated text — paste into Excel";
      cp.onclick = function () { copyText(lensTSV(rb), function () { cp.textContent = "Copied ✓"; setTimeout(function () { cp.textContent = "Copy table"; }, 1500); }); };
      tools.appendChild(cp);
      if (ed) {
        var nEd = 0; for (var k in L.table) nEd += Object.keys(L.table[k]).length;
        var rs = h("button", "pr-gbtn", "Reset to calculated" + (nEd ? " (" + nEd + ")" : "")); rs.type = "button"; rs.disabled = !nEd;
        rs.onclick = function () { L.table = {}; rbChanged(); };
        tools.appendChild(rs);
        tools.appendChild(h("span", "pr-lenshint", "Type over a cell (mm or 40d), or paste a block copied from Excel into any cell."));
      }
      rbLens.appendChild(tools);
      var tb = h("table", "pr-lens");
      var hr = "<tr><th>Bar</th><th class='u'>Used</th>" + cols.map(function (c) { return "<th>" + c[1] + "</th>"; }).join("") + "</tr>";
      tb.innerHTML = "<thead>" + hr + "</thead>";
      var body = h("tbody");
      (rb.lens || []).forEach(function (u) {
        var tr = h("tr"); tr.appendChild(h("td", "b", u.bar));   // every size of the standard
        tr.appendChild(h("td", "u", used[u.bar] ? "&#10003;" : ""));   // used by a rebar row below
        cols.forEach(function (c, ci) {
          var td = h("td"), mine = L.table[u.bar] && L.table[u.bar][c[0]];
          if (!ed) { td.textContent = fmtN(u[c[0]]); if (c[0] === "lap" && u.lapBan) td.innerHTML = "<span class='pr-rbwarn' title='Tension lap not allowed above D35 — use a mechanical splice'>coupler</span>"; }
          else {
            var ban = c[0] === "lap" && u.lapBan && !mine;   // tension lap not allowed (above D35): empty, "coupler" — a typed value overrides
            var inp = h("input"); inp.type = "text"; inp.value = mine || (ban ? "" : String(u[c[0]])); if (ban) inp.placeholder = "coupler";
            inp.title = "mm, or a multiple of the bar diameter (e.g. 40d). Empty = back to the calculated value.";
            if (mine) inp.className = "ed";
            inp.addEventListener("focus", function () { inp.select(); });
            inp.addEventListener("change", function () {
              var v = inp.value.trim();
              if (v !== "" && String(Number(v.replace(/,/g, ""))) === String(u[c[0]]) && !mine) return;   // unchanged
              lensSet(L, u.bar, c[0], v); rbChanged();
            });
            inp.addEventListener("paste", function (e) {
              var t = (e.clipboardData || window.clipboardData).getData("text");
              if (!/[\t\n]/.test(t.replace(/\n$/, ""))) return;            // a single value: ordinary paste
              e.preventDefault();
              if (lensPaste(L, rb, u.bar, ci, t)) rbChanged();
            });
            td.appendChild(inp);
          }
          tr.appendChild(td);
        });
        body.appendChild(tr);
      });
      tb.appendChild(body);
      rbLens.appendChild(tb);
    }
    function cardRebar() {
      var p = P(), R = p.rebar, L = R.lap;
      var c = h("div", "pr-card");
      var hd = h("div", "pr-hd", "<span class='pr-ttl'>Rebar</span>");
      var tg = h("label", "pr-bapply"); var ck = h("input"); ck.type = "checkbox"; ck.checked = !!R.on;
      tg.appendChild(ck); tg.appendChild(document.createTextNode("Place rebar")); tg.style.margin = "0"; hd.appendChild(tg);
      ck.addEventListener("change", function () { R.on = ck.checked; renderPerPier(); draw(); });
      c.appendChild(hd);
      var b = h("div", "pr-body");
      if (!R.on) { b.appendChild(h("p", "pr-cap", "Switch on to place bars in the cap, columns and footing — shown in the 3D preview, in the IFC and in a bar schedule. Anchorage and lap lengths come from the calculation sheet or from your own values.")); c.appendChild(b); return c; }
      // one button back to the default values (rows, covers, stock length) — then the user edits
      var dfl = h("div", "pr-rbdfl");
      var db0 = h("button", "pr-btn pr-ghost", "&#8634; Default values"); db0.type = "button";
      db0.onclick = function () {
        if (!confirm("Replace every rebar row, the covers and the stock length with the default values?")) return;
        R.rows = defaultRows(L.sys); R.col = defaultCol(L.sys); R.fdn = defaultFdn(L.sys); R.cover = { cap: 60, col: 75, fdn: 100 }; R.stock = 12000; renderPerPier();
      };
      dfl.appendChild(db0);
      dfl.appendChild(h("span", "pr-cap", "The rows start from common values — change them to your design. Nothing here checks the required steel."));
      b.appendChild(dfl);
      // bars on the drawing: double line (bar diameter wide) or single line (centre line) — as in the store's wall / culvert
      var lm = h("div", "pr-rblm"); lm.appendChild(h("span", "pr-rblml", "Bars on the drawing"));
      if (R.line !== "single") R.line = "double";
      [["double", "Double line"], ["single", "Single line"]].forEach(function (o) {
        var t = h("button", "pr-tab" + ((R.line || "double") === o[0] ? " on" : ""), o[1]); t.type = "button";
        t.onclick = function () { R.line = o[0]; lm.querySelectorAll(".pr-tab").forEach(function (x) { x.classList.toggle("on", x === t); }); draw(true); };
        lm.appendChild(t);
      });
      b.appendChild(lm);
      // common
      var chN = 0;   // chapter numbers: 1 Common · 2 Anchorage & laps · 3… members · last Result (rows inside a member are 3.1, 3.2 …)
      function chapter(t) { chN++; b.appendChild(h("div", "pr-rbch", "<span class='n'>" + chN + "</span>" + t)); return chN; }
      chapter("Common");
      var g = h("div", "pr-ingrid");
      var sr = h("div", "pr-inrow"); sr.appendChild(h("label", null, "<span class='var'>Std</span><span class='desc'>Bar standard</span>"));
      var ss = h("select", "pr-sel"); [["KS", "KS D 3504 (D13…)"], ["ASTM", "ASTM A615 (#4…)"], ["BS", "BS 4449 (12…)"]].forEach(function (o) { var op = h("option", null, o[1]); op.value = o[0]; if (L.sys === o[0]) op.selected = true; ss.appendChild(op); });
      ss.addEventListener("change", function () {
        var from = L.sys; L.sys = ss.value; L.table = {};
        R.rows.forEach(function (r) { if (r.bar) r.bar = nearestBar(L.sys, barDia(from, r.bar)); });
        var cv = function (b) { return b ? nearestBar(L.sys, barDia(from, b)) : b; }, C = R.col;
        C.layers.forEach(function (x) { x.bar = cv(x.bar); }); C.splices.forEach(function (x) { x.bar = cv(x.bar); }); C.ties.bar = cv(C.ties.bar); C.cross.bar = cv(C.cross.bar);
        var F = R.fdn; ["bot", "top"].forEach(function (k) { F[k].forEach(function (r) { r.bar = cv(r.bar); r.bar2 = cv(r.bar2); }); }); F.side.bar = cv(F.side.bar); F.shear.bar = cv(F.shear.bar);
        renderPerPier();
      });
      sr.appendChild(ss); g.appendChild(sr);
      function rbNum(code, desc, val, on, unit, step) { return numRow(code, desc, val, function (v) { on(v); rbChanged(); }, unit, step); }
      g.appendChild(rbNum("fck", "Concrete strength", L.fck, function (v) { L.fck = v; }, "MPa", "1"));
      g.appendChild(rbNum("fy", L.std === "doro" ? "Steel design stress σsd" : "Steel yield strength", L.fy, function (v) { L.fy = v; }, "MPa", "10"));
      g.appendChild(rbNum("Ls", "Stock bar length (laps beyond this)", R.stock, function (v) { R.stock = v; }, "mm", "500"));
      if (!p.noCope) g.appendChild(rbNum("c₁", "Cover — " + (p.type === "portal" ? "beam" : "cap"), R.cover.cap, function (v) { R.cover.cap = v; }));
      g.appendChild(rbNum("c₂", "Cover — " + (p.type === "portal" ? "legs" : "columns"), R.cover.col, function (v) { R.cover.col = v; }));
      g.appendChild(rbNum("c₃", "Cover — footing", R.cover.fdn, function (v) { R.cover.fdn = v; }));
      b.appendChild(g);
      // anchorage / laps
      chapter("Anchorage &amp; laps");
      var md = h("div", "pr-modes");
      if (L.mode === "manual") L.mode = "edit";   // Manual was folded into Edit (start from the calculation, change any cell)
      [["auto", "Auto (calculation sheet)"], ["edit", "Edit"]].forEach(function (o) {
        var t = h("button", "pr-mode" + (L.mode === o[0] ? " on" : ""), o[1]); t.type = "button";
        t.onclick = function () { L.mode = o[0]; renderPerPier(); }; md.appendChild(t);
      });
      b.appendChild(md);
      {
        var g2 = h("div", "pr-ingrid");
        var cr = h("div", "pr-inrow"); cr.appendChild(h("label", null, "<span class='var'>Code</span><span class='desc'>Design code</span>"));
        var cs = h("select", "pr-sel"); [["gujo", "Concrete structural 2012 · 2021"], ["doro", "Road bridge 2016 (LSD)"]].forEach(function (o) { var op = h("option", null, o[1]); op.value = o[0]; if (L.std === o[0]) op.selected = true; cs.appendChild(op); });
        cs.addEventListener("change", function () { L.std = cs.value; renderPerPier(); });
        cr.appendChild(cs); g2.appendChild(cr);
        if (L.std === "gujo") {
          var gr = h("div", "pr-inrow"); gr.appendChild(h("label", null, "<span class='var'>Lap</span><span class='desc'>Tension lap class</span>"));
          var gs = h("select", "pr-sel"); [["B", "Class B (1.3 ld)"], ["A", "Class A (1.0 ld)"]].forEach(function (o) { var op = h("option", null, o[1]); op.value = o[0]; if (L.grade === o[0]) op.selected = true; gs.appendChild(op); });
          gs.addEventListener("change", function () { L.grade = gs.value; rbChanged(); });
          gr.appendChild(gs); g2.appendChild(gr);
        }
        b.appendChild(g2);
        // the sheet's own factors, folded away (defaults = the sheet's defaults)
        var det = h("details", "pr-rbdet"); det.appendChild(h("summary", null, "Sheet factors"));
        var g3 = h("div", "pr-ingrid"), C = L.calc;
        g3.appendChild(rbNum("c", "Cover used in the formula", C.cover, function (v) { C.cover = v; }));
        g3.appendChild(rbNum("ctc", "Bar spacing used in the formula", C.ctc, function (v) { C.ctc = v; }));
        if (L.std === "gujo") {
          g3.appendChild(rbNum("Ktr", "Transverse reinforcement index", C.ktr, function (v) { C.ktr = v; }, "", "1"));
          g3.appendChild(rbNum("λ", "Lightweight factor", C.lam, function (v) { C.lam = v; }, "", "0.05"));
          var wr = h("div", "pr-inrow"); wr.appendChild(h("label", null, "<span class='var'>ld</span><span class='desc'>Development length method</span>"));
          var ws = h("select", "pr-sel"); [["equ", "Formula (detailed)"], ["fac", "Factors (simplified)"]].forEach(function (o) { var op = h("option", null, o[1]); op.value = o[0]; if (C.way === o[0]) op.selected = true; ws.appendChild(op); });
          ws.addEventListener("change", function () { C.way = ws.value; rbChanged(); }); wr.appendChild(ws); g3.appendChild(wr);
        } else {
          g3.appendChild(rbNum("φc", "Concrete material factor", C.phic, function (v) { C.phic = v; }, "", "0.05"));
          [["eta1", "η₁", "Bond condition", [[1, "Good (1.0)"], [0.7, "Other / slip form (0.7)"]]],
           ["K", "K", "Transverse confinement α₃", [[0.1, "0.1"], [0.05, "0.05"], [0, "0.0"]]],
           ["a1", "α₁", "Anchorage shape (other)", [[1, "Straight 1.0"], [0.7, "Hook / bend 0.7"], [0.5, "0.5"], [0.4, "0.4"]]],
           ["a6", "α₆", "Lapped proportion", [[1, "1.0 (<25%)"], [1.15, "1.15 (33%)"], [1.4, "1.4 (50%)"], [1.5, "1.5 (>50%)"]]]].forEach(function (f) {
            var rr = h("div", "pr-inrow"); rr.appendChild(h("label", null, "<span class='var'>" + f[1] + "</span><span class='desc'>" + f[2] + "</span>"));
            var se = h("select", "pr-sel"); f[3].forEach(function (o) { var op = h("option", null, o[1]); op.value = o[0]; if (+C[f[0]] === o[0]) op.selected = true; se.appendChild(op); });
            se.addEventListener("change", function () { C[f[0]] = +se.value; rbChanged(); }); rr.appendChild(se); g3.appendChild(rr);
          });
          g3.appendChild(rbNum("λ", "(ΣAst − ΣAst,min) / As", C.lamTr, function (v) { C.lamTr = v; }, "", "0.1"));
          g3.appendChild(rbNum("p", "Transverse pressure", C.p, function (v) { C.p = v; }, "MPa", "0.5"));
          g3.appendChild(rbNum("As,req", "Required steel", C.asreq, function (v) { C.asreq = v; }, "mm²", "1"));
          g3.appendChild(rbNum("As,prov", "Provided steel", C.asprov, function (v) { C.asprov = v; }, "mm²", "1"));
        }
        det.appendChild(g3); b.appendChild(det);
      }
      rbLens = h("div", "pr-rblens"); rbLens.innerHTML = "<p class='pr-cap'>…</p>"; b.appendChild(rbLens);
      // members
      var bars = (BARS[L.sys] || BARS.KS).map(function (x) { return x[0]; });
      function memberRows(m, title) {
        var no = chapter(title), k = 0;
        var tb = h("table", "pr-rbtbl"); tb.innerHTML = "<colgroup><col style='width:30%'><col style='width:12%'><col style='width:40%'><col style='width:18%'></colgroup><thead><tr><th></th><th>Bar</th><th>Spacing / count</th><th>" + (m === "cap" ? "Layers" : (m === "col" ? "End zone L0" : "")) + "</th></tr></thead>";
        var body = h("tbody");
        RB_ROLES[m].forEach(function (role) {
          var row = null; R.rows.forEach(function (r) { if (r.m === m && r.r === role[0]) row = r; });
          if (!row) { row = { m: m, r: role[0], bar: "", q: "s", v: 200, ly: 1 }; R.rows.push(row); }
          k++; var tr = h("tr"); tr.appendChild(h("td", null, "<span class='no'>" + no + "." + k + "</span>" + role[1]));
          var td = h("td"), bs = h("select", "pr-sel"); var o0 = h("option", null, "—"); o0.value = ""; bs.appendChild(o0);
          bars.forEach(function (bn) { var op = h("option", null, bn); op.value = bn; if (row.bar === bn) op.selected = true; bs.appendChild(op); });
          td.appendChild(bs); tr.appendChild(td);
          var td2 = h("td"), qs = h("select", "pr-sel pr-q"); [["s", "@"], ["n", "EA"]].forEach(function (o) { var op = h("option", null, o[1]); op.value = o[0]; if (row.q === o[0]) op.selected = true; qs.appendChild(op); });
          var vi = h("input"); vi.type = "number"; vi.value = row.v; vi.step = row.q === "n" ? "1" : "25"; vi.className = "pr-mono";
          var un = h("span", "pr-unit", row.q === "n" ? (m === "col" ? "per column" : "") : "mm");
          td2.appendChild(qs); td2.appendChild(vi); td2.appendChild(un); tr.appendChild(td2);
          var td3 = h("td");
          if (m === "col" && role[0] === "tie") {
            // ties: dense at the top and bottom ends (L0), wider in the middle
            if (row.ve == null) row.ve = row.v; if (row.le == null) row.le = 0;
            var ve = h("input"); ve.type = "number"; ve.step = "25"; ve.value = row.ve; ve.className = "pr-mono"; ve.title = "Spacing at the top and bottom ends";
            vi.title = "Spacing in the middle";
            var tz = function () { var on = row.q === "s"; ve.style.display = on ? "" : "none"; lbE.style.display = on ? "" : "none"; lbM.style.display = on ? "" : "none"; td3.style.visibility = on ? "" : "hidden"; };
            var lbE = h("span", "pr-unit", "ends ·"), lbM = h("span", "pr-unit", "middle");
            td2.insertBefore(ve, vi); td2.insertBefore(lbE, vi); td2.insertBefore(lbM, vi);
            un.textContent = row.q === "n" ? "per column" : "mm";
            ve.addEventListener("input", function () { var v = parseFloat(ve.value); if (!isNaN(v) && v > 0) { row.ve = v; custom(); } });
            var le = h("input"); le.type = "number"; le.step = "50"; le.placeholder = "auto"; le.value = row.le > 0 ? row.le : ""; le.className = "pr-mono";
            le.title = "Length of each end zone. Empty = auto: max(largest section size, column height / 6, 450)";
            le.addEventListener("input", function () { var v = parseFloat(le.value); row.le = !isNaN(v) && v > 0 ? v : 0; custom(); });
            td3.appendChild(le); td3.appendChild(h("span", "pr-unit", "mm"));
            qs.addEventListener("change", tz); tz();
          }
          if (role[3]) { var ls = h("select", "pr-sel"); [1, 2].forEach(function (n) { var op = h("option", null, String(n)); op.value = n; if (row.ly === n) op.selected = true; ls.appendChild(op); }); ls.addEventListener("change", function () { row.ly = +ls.value; custom(); }); td3.appendChild(ls); }
          tr.appendChild(td3);
          function custom() { rbChanged(); }
          bs.addEventListener("change", function () { row.bar = bs.value; custom(); tr.classList.toggle("off", !row.bar); paintLensSoon(); });
          qs.addEventListener("change", function () { row.q = qs.value; row.v = row.q === "n" ? (m === "col" ? 24 : 12) : 150; vi.value = row.v; un.textContent = row.q === "n" ? (m === "col" ? "per column" : "") : "mm"; custom(); });
          vi.addEventListener("input", function () { var v = parseFloat(vi.value); if (!isNaN(v) && v > 0) { row.v = v; custom(); } });
          if (!row.bar) tr.className = "off";
          body.appendChild(tr);
        });
        tb.appendChild(body); b.appendChild(tb);
      }
      // ── small input helpers for chapters 4 and 5 ──
      function ch() { rbChanged(); }
      function num(val, on, ph, step, w) {
        var i = h("input"); i.type = "number"; i.className = "pr-mono pr-rbin"; i.step = step || "10"; if (w) i.style.width = w + "px";
        i.value = val > 0 ? val : ""; if (ph) i.placeholder = ph;
        i.addEventListener("input", function () { var v = parseFloat(i.value); on(isNaN(v) ? 0 : v); ch(); }); return i;
      }
      function sel(opts, val, on, cls) {
        var e = h("select", "pr-sel" + (cls ? " " + cls : "")); opts.forEach(function (o) { var op = h("option", null, o[1]); op.value = o[0]; if (String(val) === String(o[0])) op.selected = true; e.appendChild(op); });
        e.addEventListener("change", function () { on(e.value); }); return e;
      }
      function barSel(val, on, blank) { var o = (blank ? [["", blank]] : []).concat(bars.map(function (x) { return [x, x]; })); return sel(o, val, on); }
      function chk(label, val, on) { var w = h("label", "pr-rbchk"); var c2 = h("input"); c2.type = "checkbox"; c2.checked = !!val; c2.addEventListener("change", function () { on(c2.checked); }); w.appendChild(c2); w.appendChild(document.createTextNode(label)); return w; }
      function field(label, el, unit) { var w = h("div", "pr-rbf" + (label ? "" : " pr-rbf0")); w.appendChild(h("span", "l", label)); var v = h("span", "v"); [].concat(el).forEach(function (x) { v.appendChild(typeof x === "string" ? h("span", "pr-unit", x) : x); }); if (unit) v.appendChild(h("span", "pr-unit", unit)); w.appendChild(v); return w; }
      function del(on) { var x = h("button", "pr-del", "&times;"); x.type = "button"; x.title = "Remove"; x.onclick = on; return x; }
      function add(label, on) { var x = h("button", "pr-gbtn", "+ " + label); x.type = "button"; x.onclick = on; return x; }

      // ── chapter 4: columns ──
      function colChapter(title) {
        var p2 = P(), C = R.col || (R.col = defaultCol(L.sys)), no = chapter(title), sub = 0;
        var anyCircle = p2.cols.some(function (c2) { return c2.shape === "circle"; }), allCircle = p2.cols.every(function (c2) { return c2.shape === "circle"; });
        var anyRect = p2.cols.some(function (c2) { return c2.shape === "rect"; });
        function sh(t) { sub++; b.appendChild(h("div", "pr-rbsub", "<span class='no'>" + no + "." + sub + "</span>" + t)); }
        // 4.1 main bars — layers 1 to 3
        sh("Main bars");
        var t1 = h("table", "pr-rbtbl pr-rbt2");
        t1.innerHTML = "<colgroup><col style='width:9%'><col style='width:12%'><col style='width:47%'><col style='width:12%'><col style='width:16%'><col style='width:4%'></colgroup>" +
          "<thead><tr><th>Layer</th><th>Bar</th><th>Arrangement</th><th>Bundle</th><th>Face → bar</th><th></th></tr></thead>";
        var tb1 = h("tbody");
        C.layers.forEach(function (Ly, k) {
          var tr = h("tr"); tr.appendChild(h("td", null, "<span class='no'>" + (k + 1) + "</span>"));
          var td = h("td"); td.appendChild(barSel(Ly.bar, function (v) { Ly.bar = v; ch(); })); tr.appendChild(td);
          var ta = h("td"), qOpts = [["s", "@ spacing"], ["n", "EA total"]]; if (anyRect) qOpts.push(["f", "per face"]);
          ta.appendChild(sel(qOpts, Ly.q, function (v) { Ly.q = v; if (v === "n" && Ly.v < 4) Ly.v = 24; if (v === "s" && Ly.v < 50) Ly.v = 150; renderPerPier(); }, "pr-q"));
          if (Ly.q === "f") { ta.appendChild(h("span", "pr-unit", "B face")); ta.appendChild(num(Ly.nb, function (v) { Ly.nb = Math.round(v); }, "", "1", 56)); ta.appendChild(h("span", "pr-unit", "H face")); ta.appendChild(num(Ly.nh, function (v) { Ly.nh = Math.round(v); }, "", "1", 56)); ta.appendChild(h("span", "pr-unit", "incl. corners")); }
          else { ta.appendChild(num(Ly.v, function (v) { Ly.v = v; }, "", Ly.q === "n" ? "1" : "25")); ta.appendChild(h("span", "pr-unit", Ly.q === "n" ? "per column" : "mm")); }
          tr.appendChild(ta);
          var tbd = h("td"); tbd.appendChild(sel([[1, "1"], [2, "2"], [3, "3"], [4, "4"]], Ly.bundle || 1, function (v) { Ly.bundle = +v; ch(); })); tr.appendChild(tbd);
          var tdd = h("td"); tdd.appendChild(num(Ly.d, function (v) { Ly.d = v; }, "auto", "5", 70)); tdd.appendChild(h("span", "pr-unit", "mm")); tr.appendChild(tdd);
          var tx = h("td"); if (k > 0 && k === C.layers.length - 1) tx.appendChild(del(function () { C.layers.pop(); renderPerPier(); ch(); })); tr.appendChild(tx);
          tb1.appendChild(tr);
        });
        t1.appendChild(tb1); b.appendChild(t1);
        if (C.layers.length < 3) b.appendChild(add("Add layer", function () { var lst = C.layers[C.layers.length - 1]; C.layers.push({ bar: lst.bar, q: lst.q, v: lst.v, nb: lst.nb, nh: lst.nh, bundle: 1, d: 0 }); renderPerPier(); ch(); }));

        // 4.2 starter bars
        sh("Starter bars <span class='pr-rbsubk'>into the footing</span>");
        var S0 = C.starter, g2 = h("div", "pr-rbgrid");
        g2.appendChild(field("", chk("Use starter bars", S0.on, function (v) { S0.on = v; renderPerPier(); ch(); })));
        g2.appendChild(field("Hook direction", sel([["out", "Outward"], ["in", "Inward"]], S0.hook, function (v) { S0.hook = v; ch(); })));
        g2.appendChild(field("Hook length", num(S0.hl, function (v) { S0.hl = v; }, "auto 12db", "10", 104), "mm"));
        if (S0.on) {
          g2.appendChild(field("Splice", sel([["lap", "Lap splice"], ["coupler", "Coupler"]], S0.splice, function (v) { S0.splice = v; ch(); })));
          g2.appendChild(field("Projection above footing", num(S0.proj, function (v) { S0.proj = v; }, "auto", "50", 90), "mm"));
          g2.appendChild(field("", chk("Stagger 50%", S0.stag, function (v) { S0.stag = v; renderPerPier(); ch(); })));
          if (S0.stag) g2.appendChild(field("Stagger offset", num(S0.soff, function (v) { S0.soff = v; }, "auto", "50", 90), "mm"));
        }
        if (C.layers.length > 1) g2.appendChild(field("", chk("Inner layers: straight end (no hook)", S0.straightIn, function (v) { S0.straightIn = v; ch(); })));
        b.appendChild(g2);

        // 4.3 splices along the height (bar size may change there)
        sh("Splices along the height");
        if (C.splices.length) {
          var t3 = h("table", "pr-rbtbl pr-rbt2");
          t3.innerHTML = "<colgroup><col style='width:9%'><col style='width:30%'><col style='width:57%'><col style='width:4%'></colgroup><thead><tr><th>#</th><th>Height from footing top</th><th>Bar above</th><th></th></tr></thead>";
          var tb3 = h("tbody");
          C.splices.forEach(function (sp, i) {
            var tr = h("tr"); tr.appendChild(h("td", null, "<span class='no'>" + (i + 1) + "</span>"));
            var tz = h("td"); tz.appendChild(num(sp.z, function (v) { sp.z = v; }, "", "100", 90)); tz.appendChild(h("span", "pr-unit", "mm")); tr.appendChild(tz);
            var tbb = h("td"); tbb.appendChild(barSel(sp.bar, function (v) { sp.bar = v; ch(); }, "same")); tr.appendChild(tbb);
            var tx = h("td"); tx.appendChild(del(function () { C.splices.splice(i, 1); renderPerPier(); ch(); })); tr.appendChild(tx);
            tb3.appendChild(tr);
          });
          t3.appendChild(tb3); b.appendChild(t3);
        } else b.appendChild(h("div", "pr-rbnone", "None — the main bars are spliced only where they exceed the stock length."));
        if (C.splices.length < 4) b.appendChild(add("Add splice", function () { var last = C.splices.length ? C.splices[C.splices.length - 1].z : 0; C.splices.push({ z: Math.round((last + Math.max(3000, pierCH(p2) / 2)) / 100) * 100, bar: "" }); renderPerPier(); ch(); }));

        // 4.4 ties — zones from the bottom
        sh("Ties");
        var T = C.ties, g4 = h("div", "pr-rbgrid");
        g4.appendChild(field("Bar", barSel(T.bar, function (v) { T.bar = v; ch(); })));
        if (anyCircle) g4.appendChild(field("Type", sel([["hoop", "Closed hoops"], ["spiral", "Spiral" + (allCircle ? "" : " (circular columns)")]], T.type, function (v) { T.type = v; ch(); })));
        if (C.layers.length > 1) g4.appendChild(field("Inner-layer ties", [h("span", "pr-unit", "every"), sel([[1, "1st"], [2, "2nd"], [3, "3rd"], [4, "4th"]], T.inner, function (v) { T.inner = +v; ch(); })], "tie"));
        b.appendChild(g4);
        var t4 = h("table", "pr-rbtbl pr-rbt2");
        t4.innerHTML = "<colgroup><col style='width:9%'><col style='width:42%'><col style='width:45%'><col style='width:4%'></colgroup><thead><tr><th>Zone</th><th>Length (from the bottom)</th><th>Spacing</th><th></th></tr></thead>";
        var tb4 = h("tbody");
        T.zones.forEach(function (zn, i) {
          var tr = h("tr"); tr.appendChild(h("td", null, "<span class='no'>" + (i + 1) + "</span>"));
          var tl = h("td"), kind = zn.L < 0 ? "L0" : (zn.L === 0 ? "rest" : "mm");
          tl.appendChild(sel([["L0", "L0 (auto)"], ["rest", "Rest"], ["mm", "mm"]], kind, function (v) { zn.L = v === "L0" ? -1 : (v === "rest" ? 0 : 2000); renderPerPier(); ch(); }));
          if (kind === "mm") { tl.appendChild(num(zn.L, function (v) { zn.L = v > 0 ? v : 2000; }, "", "100", 80)); tl.appendChild(h("span", "pr-unit", "mm")); }
          tr.appendChild(tl);
          var ts = h("td"); ts.appendChild(h("span", "pr-unit", "@")); ts.appendChild(num(zn.s, function (v) { zn.s = v > 0 ? v : 150; }, "", "25", 80)); ts.appendChild(h("span", "pr-unit", "mm")); tr.appendChild(ts);
          var tx = h("td"); if (T.zones.length > 1) tx.appendChild(del(function () { T.zones.splice(i, 1); renderPerPier(); ch(); })); tr.appendChild(tx);
          tb4.appendChild(tr);
        });
        t4.appendChild(tb4); b.appendChild(t4);
        if (T.zones.length < 6) b.appendChild(add("Add zone", function () { T.zones.splice(T.zones.length - 1, 0, { L: 2000, s: 150 }); renderPerPier(); ch(); }));

        // 4.5 crossties — rectangular / track / octagon columns
        if (!allCircle) {
          sh("Crossties");
          var X = C.cross, g5 = h("div", "pr-rbgrid");
          g5.appendChild(field("", chk("Use crossties", X.on, function (v) { X.on = v; renderPerPier(); ch(); })));
          if (X.on) {
            g5.appendChild(field("Bar", barSel(X.bar, function (v) { X.bar = v; ch(); })));
            g5.appendChild(field("Bars held", sel([["alt", "Every other bar"], ["all", "Every bar"]], X.sup, function (v) { X.sup = v; ch(); })));
            g5.appendChild(field("At", sel([[1, "every tie"], [2, "every 2nd tie"], [3, "every 3rd tie"]], X.every, function (v) { X.every = +v; ch(); })));
          }
          b.appendChild(g5);
        }
      }
      // ── chapter 5: footing ──
      function fdnChapter(title) {
        var F = R.fdn || (R.fdn = defaultFdn(L.sys)), no = chapter(title), sub = 0;
        function sh(t) { sub++; b.appendChild(h("div", "pr-rbsub", "<span class='no'>" + no + "." + sub + "</span>" + t)); }
        // 5.1 main bars — bottom and top, each direction
        sh("Main bars");
        var t1 = h("table", "pr-rbtbl pr-rbt2");
        t1.innerHTML = "<colgroup><col style='width:24%'><col style='width:12%'><col style='width:22%'><col style='width:12%'><col style='width:30%'></colgroup>" +
          "<thead><tr><th></th><th>Bar</th><th>Spacing</th><th>Layers</th><th>2nd cycle (in between)</th></tr></thead>";
        var tb1 = h("tbody"), k = 0;
        [["bot", "Bottom"], ["top", "Top"]].forEach(function (fc) {
          F[fc[0]].forEach(function (r) {
            k++; var tr = h("tr");
            tr.appendChild(h("td", null, "<span class='no'>" + k + "</span>" + fc[1] + ", " + (r.dir === "x" ? "transverse" : "longitudinal")));
            var td = h("td"); td.appendChild(barSel(r.bar, function (v) { r.bar = v; ch(); })); tr.appendChild(td);
            var ts = h("td"); ts.appendChild(h("span", "pr-unit", "@")); ts.appendChild(num(r.s, function (v) { r.s = v > 0 ? v : 150; }, "", "25", 80)); ts.appendChild(h("span", "pr-unit", "mm")); tr.appendChild(ts);
            var tl = h("td"); tl.appendChild(sel([[1, "1"], [2, "2"]], r.ly, function (v) { r.ly = +v; ch(); })); tr.appendChild(tl);
            var t2 = h("td"); t2.appendChild(barSel(r.bar2, function (v) { r.bar2 = v; ch(); }, "—")); tr.appendChild(t2);
            tb1.appendChild(tr);
          });
        });
        t1.appendChild(tb1); b.appendChild(t1);
        var g1 = h("div", "pr-rbgrid");
        g1.appendChild(field("Outer bars (top and bottom)", sel([["x", "Transverse"], ["y", "Longitudinal"]], F.outer, function (v) { F.outer = v; ch(); })));
        b.appendChild(g1);
        // 5.2 bar ends
        sh("Bar ends");
        var g2 = h("div", "pr-rbgrid");
        [["endB", "Bottom bars", "up", "Up to the top mat"], ["endT", "Top bars", "down", "Down to the bottom mat"]].forEach(function (e) {
          var E = F[e[0]], parts = [sel([["hook", "Hook " + e[2] + " 12db"], ["full", e[3]], ["mm", "Length"], ["none", "Straight"]], E.t, function (v) { E.t = v; if (v === "mm" && !E.L) E.L = 500; renderPerPier(); ch(); })];
          if (E.t === "mm") { parts.push(num(E.L, function (v) { E.L = v; }, "", "50", 80)); parts.push("mm"); }
          g2.appendChild(field(e[1], parts));
        });
        b.appendChild(g2);
        // 5.3 side bars
        sh("Side bars");
        var g3 = h("div", "pr-rbgrid"), SD = F.side;
        g3.appendChild(field("", chk("Use side bars", SD.on, function (v) { SD.on = v; renderPerPier(); ch(); })));
        if (SD.on) {
          g3.appendChild(field("Bar", barSel(SD.bar, function (v) { SD.bar = v; ch(); })));
          g3.appendChild(field("Vertical spacing", [h("span", "pr-unit", "@"), num(SD.s, function (v) { SD.s = v > 0 ? v : 300; }, "", "25", 80)], "mm"));
        }
        b.appendChild(g3);
        // 5.4 shear bars
        sh("Shear bars");
        var g4 = h("div", "pr-rbgrid"), H = F.shear;
        g4.appendChild(field("", chk("Use shear bars", H.on, function (v) { H.on = v; renderPerPier(); ch(); })));
        if (H.on) {
          g4.appendChild(field("Bar", barSel(H.bar, function (v) { H.bar = v; ch(); })));
          g4.appendChild(field("Type", sel([["closed", "Closed stirrup"], ["single", "Single leg (hooked)"]], H.type, function (v) { H.type = v; ch(); })));
          g4.appendChild(field("Spacing, transverse", [h("span", "pr-unit", "@"), num(H.sx, function (v) { H.sx = v > 0 ? v : 600; }, "", "50", 80)], "mm"));
          g4.appendChild(field("Spacing, longitudinal", [h("span", "pr-unit", "@"), num(H.sy, function (v) { H.sy = v > 0 ? v : 600; }, "", "50", 80)], "mm"));
          g4.appendChild(field("", chk("Zig-zag rows", H.zig, function (v) { H.zig = v; ch(); })));
        }
        b.appendChild(g4);
      }
      function paintLensSoon() { var key = inputKey("rebar"), hit = memoGet("rebar", key); if (hit) paintLens(hit); }
      if (!p.noCope) memberRows("cap", p.type === "portal" ? "Beam" : "Cap");
      colChapter(p.type === "portal" ? "Legs" : "Columns");
      fdnChapter("Footing");
      // result
      chapter("Result");
      rbSum = h("div", "pr-rbsum", "<span class='pr-cap'>Placing bars…</span>"); b.appendChild(rbSum);
      var act = h("div", "pr-rbact");
      var b3 = h("button", "pr-btn", "3D preview"); b3.type = "button"; b3.onclick = show3D;
      var bs2 = h("button", "pr-btn pr-ghost", "Bar schedule"); bs2.type = "button"; bs2.onclick = showSchedule;
      act.appendChild(b3); act.appendChild(bs2); b.appendChild(act);
      c.appendChild(b);
      setTimeout(refreshRebar, 0);
      return c;
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
    // the rebar input matters for the elevation (bars drawn), the 3D (mesh + bars), IFC and the bar schedule — the
    // A3 sheet doesn't use it yet, so it neither sends it nor refetches when only the rebar changes
    function usesRebar(kind) { return kind === "draw" || kind === "mesh" || kind === "ifc" || kind === "rebar"; }   // the elevation shows the bars too
    function pierFor(kind) {
      var p = P(); if (usesRebar(kind) && p.rebar && p.rebar.on) return p;
      var o = {}; for (var k in p) if (k !== "rebar") o[k] = p[k]; return o;
    }
    function inputKey(kind) { return JSON.stringify(pierFor(kind || "draw")); }
    function fetchCompute(want, body) {
      return fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: body || JSON.stringify({ pier: pierFor(want[0]), want: want, labels: "own" }) })
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
    function draw(fromRebar) {
      if (!fromRebar && P().rebar && P().rebar.on) { clearTimeout(_rbT); _rbT = setTimeout(refreshRebar, 250); }   // geometry changed → the schedule follows
      if (!plotHost || !plotHost.isConnected) return;
      if (typeof window.RWSVG === "undefined") { ensureCore(draw); return; }
      var seq = ++_reqSeq;
      clearTimeout(_drawT);
      var hit = memoGet("draw", inputKey());
      if (hit) { paint(hit); return; }                  // same input as before → no server trip
      _drawT = setTimeout(function () {
        var key = inputKey(), body = JSON.stringify({ pier: pierFor("draw"), want: ["draw"], labels: "own" });   // labels: macroBIM's own codes on dims
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

    // 3D: the solid, plus the bars when rebar is on (one request) → cb(mesh, rebar|null)
    function getMesh(cb) {
      var key = inputKey("mesh"), hit = memoGet("mesh", key);
      if (hit) { cb(hit.mesh, hit.rebar); return; }
      busy(true);
      var rbOn = P().rebar && P().rebar.on;
      fetchCompute(rbOn ? ["mesh", "rebar"] : ["mesh"]).then(function (j) {
        busy(false); var v = { mesh: j.mesh, rebar: rbOn ? j.rebar : null }; memoPut("mesh", key, v);
        if (rbOn) memoPut("rebar", inputKey("rebar"), j.rebar);
        cb(v.mesh, v.rebar);
      }).catch(function () {
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
      var key = inputKey(kind), hit = memoGet(kind, key);
      if (hit) { cb(hit); return; }
      fetchCompute([kind]).then(function (j) { var v = j[kind]; memoPut(kind, key, v); cb(v); }).catch(fail);
    }
    _memo.sheet = { k: [], v: {} }; _memo.dxf = { k: [], v: {} }; _memo.ifc = { k: [], v: {} }; _memo.rebar = { k: [], v: {} };

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

    function downloadIFC() {
      busy(true);
      getServer("ifc", function (ifc) { busy(false); saveFile(ifc, fileBase() + ".ifc", "application/x-step"); },
        function () { busy(false); alert("The drawing engine is not reachable right now."); });
    }
    function show3D() {
      var rbOn = P().rebar && P().rebar.on, acts = [
        { label: "&#8681; Download IFC", on: downloadIFC },
        { label: "&#8681; Download STL", ghost: true, on: function () { getMesh(function (mesh) { saveFile(_stl(mesh), fileBase() + ".stl", "application/octet-stream"); }); } }
      ];
      if (rbOn) acts.unshift({ label: "Bar schedule", ghost: true, on: showSchedule });
      var m = openModal("3D preview", acts);
      getMesh(function (mesh, rb) {
        if (!_modal) return;
        m.body.innerHTML = "";
        var d3 = h("div"); d3.id = "pr-3d-host"; d3.style.cssText = "width:100%;height:min(70vh,640px);background:#1a1a2e;border-radius:8px;overflow:hidden;position:relative";
        m.body.appendChild(d3);
        // 3rd argument: the bars (centre lines) — older viewers ignore it
        window.RWSVG.render3d("pr-3d-host", "render_pier_3d", "https://macrobim.github.io/macroBIM/bim_pier_3d.js?v=2", rb ? [mesh, rb] : [mesh]);
        m.foot.textContent = "Drag to orbit, wheel to zoom. IFC4: one element per member (IfcColumn · IfcBeam · IfcFooting · IfcPile · pedestals" +
          (rb ? ", and every bar as IfcReinforcingBar" : "") + "), mm, real elevations. STL: the concrete solid as one mesh." +
          (rb ? " Rebar: " + rb.bars.length + " bars · " + fmtKg(rb.total) + " — see Bar schedule." : "");
      });
    }

    // ── bar schedule (재료표) — the server's marks: one row per mark; lengths vary along haunches → min ~ max ──
    function fmtN(v) { return Math.round(v).toLocaleString("en-US"); }
    function fmtKg(v) { return (v >= 1000 ? (v / 1000).toFixed(2) + " t" : v.toFixed(1) + " kg"); }
    var MEMBER = { cap: "Cap", col: "Column", fdn: "Footing" };
    function roleName(m, r) { var L = RB_ROLES[m] || []; for (var i = 0; i < L.length; i++) if (L[i][0] === r) return L[i][1]; return r; }
    function memberName(m) { return m === "cap" && P().type === "portal" ? "Beam" : (m === "col" && P().type === "portal" ? "Leg" : MEMBER[m]); }
    var SHAPE_NM = { I: "straight", L: "L (1 bend)", U: "U (2 bends)", P: "bent (follows soffit)", O: "closed hoop", C: "crosstie (hooked ends)", S: "spiral" };
    function scheduleCSV(rb) {
      var L = ["Mark,Member,Role,Bar,Dia (mm),Shape,Length min (mm),Length max (mm),Length avg (mm),No.,Unit wt (kg/m),Weight (kg)"];
      rb.marks.forEach(function (k) { L.push([k.mark, memberName(k.m), roleName(k.m, k.r), k.bar, k.db, SHAPE_NM[k.shape] || k.shape, k.lmin, k.lmax, k.len, k.n, k.w1, k.wt].join(",")); });
      L.push(""); L.push("Bar,Total length (m),Weight (kg)"); rb.sum.forEach(function (s2) { L.push([s2.bar, s2.len, s2.wt].join(",")); }); L.push("Total,," + rb.total);
      if (rb.couplers && rb.couplers.length) { L.push(""); L.push("Coupler,No."); rb.couplers.forEach(function (c) { L.push(c.bar + "," + c.n); }); }
      L.push(""); L.push('"' + rb.basis + '"');
      return "\ufeff" + L.join("\r\n");
    }
    function showSchedule() {
      var rbx = null;
      var m = openModal("Bar schedule", [{ label: "&#8681; Download CSV", on: function () { if (rbx) saveFile(scheduleCSV(rbx), fileBase() + "_rebar.csv", "text/csv"); } }]);
      getServer("rebar", function (rb) {
        if (!_modal) return; rbx = rb;
        m.body.style.overflow = "auto"; m.body.style.background = "#fff";
        var t = "<table class='pr-sched'><thead><tr><th>Mark</th><th>Member</th><th>Role</th><th>Bar</th><th>Shape</th><th class='n'>Length (mm)</th><th class='n'>No.</th><th class='n'>kg/m</th><th class='n'>Weight (kg)</th></tr></thead><tbody>";
        rb.marks.forEach(function (k) {
          t += "<tr><td class='mk'>" + k.mark + "</td><td>" + memberName(k.m) + "</td><td>" + roleName(k.m, k.r) + "</td><td>" + k.bar + "</td><td>" + (SHAPE_NM[k.shape] || k.shape) + "</td><td class='n'>" +
            (k.lmin !== k.lmax ? fmtN(k.lmin) + " ~ " + fmtN(k.lmax) : fmtN(k.len)) + "</td><td class='n'>" + k.n + "</td><td class='n'>" + k.w1.toFixed(3) + "</td><td class='n'>" + k.wt.toFixed(1) + "</td></tr>";
        });
        t += "</tbody></table><table class='pr-sched pr-sum'><thead><tr><th>Bar</th><th class='n'>Total length (m)</th><th class='n'>Weight (kg)</th></tr></thead><tbody>";
        rb.sum.forEach(function (s2) { t += "<tr><td>" + s2.bar + "</td><td class='n'>" + s2.len.toFixed(1) + "</td><td class='n'>" + s2.wt.toFixed(1) + "</td></tr>"; });
        t += "<tr class='tot'><td>Total</td><td></td><td class='n'>" + rb.total.toFixed(1) + "</td></tr></tbody></table>";
        if (rb.couplers && rb.couplers.length) t += "<table class='pr-sched pr-sum'><thead><tr><th>Coupler</th><th class='n'>No.</th></tr></thead><tbody>" + rb.couplers.map(function (c) { return "<tr><td>" + c.bar + "</td><td class='n'>" + c.n + "</td></tr>"; }).join("") + "</tbody></table>";
        m.body.innerHTML = t;
        m.foot.textContent = rb.basis + " · Lengths are bar centre lines; closed hoops include two 135° hooks. Where lengths vary (haunch, rounded tips, steps) one mark covers the range — weights add the real length of every bar.";
      }, function () { m.body.innerHTML = "<div class='pr-mwait'>The drawing engine is not reachable right now.</div>"; });
    }

    _pierDraw = draw;

    // ── render orchestration ──
    var perWrap = h("div", "pr-col");        // right column: Coping/Columns/Foundation
    function renderPerPier() {
      perWrap.innerHTML = "";
      if (!S.wiz.done) return;               // details appear once the type is chosen
      perWrap.appendChild(cardElevation());
      if (P().type === "portal") { perWrap.appendChild(cardFrame()); perWrap.appendChild(cardPedestal()); }
      else {
        if (!P().noCope) { perWrap.appendChild(cardCoping()); perWrap.appendChild(cardPedestal()); }
        perWrap.appendChild(cardColumns());
      }
      perWrap.appendChild(cardFoundation());
      perWrap.appendChild(cardRebar());
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
