/*
    bim_pscbox_test.js — PSCBOX (1/2-cell box girder) page for layout_body_test.js.

    Single entry: fdraw_pscbox(mountId). Reuses the parametric box12cell module:
      geo_box12cell / draw_box12cell_guide / adefs_box12cell /
      getParams_box12cell / toggleCenterVars_box12cell   (bim_box12cell.js)
    rendered through the shared RWSVG core (bim_draw_test_core.js).

    Layout mirrors the Seoul PhD Dimension card: Section Type radio,
    live dimension guide on the left (zoom/pan/REGEN), scrollable
    variable table on the right (height synced to the guide), DXF export.

    Dependencies (loaded on demand, in order): geomath.js, bim_dxf.js,
    bim_draw_test_core.js, bim_box12cell.js.
*/
(function () {
  "use strict";

  var PAGES = 'https://macrobim.github.io/macroBIM/';

  function ensureDeps(cb) {
    var need = [];
    if (typeof window.geo_fillet === 'undefined') need.push(PAGES + 'geomath.js?v=1');
    if (typeof window.dxf_generator === 'undefined') need.push(PAGES + 'bim_dxf.js?v=1');
    if (typeof window.RWSVG === 'undefined') need.push(PAGES + 'bim_draw_test_core.js?v=1');
    if (typeof window.geo_box12cell === 'undefined') need.push(PAGES + 'bim_box12cell.js?v=1');
    (function next(i) {
      if (i >= need.length) { cb(); return; }
      var s = document.createElement('script');
      s.src = need[i];
      s.onload = function () { next(i + 1); };
      s.onerror = function () { console.error('[pscbox] failed to load', need[i]); next(i + 1); };
      document.head.appendChild(s);
    })(0);
  }

  var CSS =
    '.px-root{--dim:#2563eb;--line:#cbd5e1;--hair:#e2e8f0;--ink:#182430;color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;}' +
    '.px-card{background:#fff;border:1px solid var(--line);border-radius:10px;overflow:hidden;margin-bottom:18px;}' +
    '.px-hd{display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:#f8fafc;border-bottom:1px solid var(--hair);}' +
    '.px-ttl{font-weight:700;font-size:14px;}' +
    '.px-sub{font-weight:400;color:#94a3b8;font-size:12px;margin-left:8px;}' +
    '.px-btn{font:inherit;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#fff;background:var(--dim);border:1px solid var(--dim);border-radius:6px;padding:5px 12px;cursor:pointer;}' +
    '.px-body{padding:14px 16px;}' +
    '.px-radio{display:flex;gap:18px;align-items:center;margin:0 0 12px 2px;font-size:13px;color:#334155;}' +
    '.px-radio b{font-weight:600;}' +
    '.px-radio label{display:flex;gap:6px;align-items:center;cursor:pointer;margin:0;}' +
    '.px-split{display:flex;gap:16px;align-items:flex-start;}' +
    '.px-guide{flex:1.6 1 0;min-width:0;}' +
    '.px-guide svg{width:100%;height:auto;border:1px solid var(--hair);border-radius:6px;background:#fff;}' +
    '.px-tblwrap{flex:1 1 0;min-width:260px;overflow-y:auto;border:1px solid var(--hair);border-radius:8px;background:#fff;}' +
    '.px-tbl{width:100%;border-collapse:collapse;font-size:12.5px;}' +
    '.px-tbl th{position:sticky;top:0;background:#f1f5f9;color:#334155;text-align:left;padding:6px 10px;font-size:12px;z-index:1;border-bottom:1px solid var(--hair);}' +
    '.px-tbl td{padding:3px 10px;border-bottom:1px solid #f1f5f9;}' +
    '.px-tbl td:first-child{font-weight:600;color:#334155;white-space:nowrap;}' +
    '.px-tbl small{color:#94a3b8;font-size:10px;font-weight:400;}' +
    '.px-tbl input{width:100%;padding:3px 8px;font-size:12px;font-family:ui-monospace,Menlo,Consolas,monospace;border:1px solid var(--hair);border-radius:5px;color:var(--ink);}' +
    '.px-tbl input:focus{outline:2px solid var(--dim);outline-offset:1px;border-color:var(--dim);}' +
    '@media(max-width:1000px){.px-split{flex-direction:column;}.px-tblwrap{max-height:320px;width:100%;height:auto !important;}}';

  function redraw() {
    if (typeof getParams_box12cell !== 'function' || typeof draw_box12cell_guide !== 'function') return;
    var ap = getParams_box12cell().aparam_b;
    if (typeof toggleCenterVars_box12cell === 'function') toggleCenterVars_box12cell(ap.NCELL);
    try { draw_box12cell_guide('box12cell_guide', ap); }
    catch (e) { console.error('[pscbox] guide error:', e); }
  }
  window.fdraw_pscbox_redraw = redraw;

  function downloadDXF() {
    if (typeof getParams_box12cell !== 'function' || typeof geo_box12cell !== 'function' || typeof dxf_generator !== 'function') return;
    var ap = getParams_box12cell().aparam_b;
    var g = geo_box12cell(ap);
    var o = dxf_generator();
    o.init();
    o.layer('pscbox', 4, 'CONTINUOUS');
    g.lines.forEach(function (l) { o.line(l.x1, l.y1, l.x2, l.y2, 'pscbox'); });
    g.arcs.forEach(function (a) { o.arc(a.x, a.y, a.r, a.angb, a.ange, 'pscbox'); });
    o.download('PSCBox.dxf');
  }
  window.fdraw_pscbox_dxf = downloadDXF;

  window.fdraw_pscbox = function (mountId) {
    ensureDeps(function () {
      var root = document.getElementById(mountId || 'mount-draw-pscbox');
      if (!root) return;
      if (typeof adefs_box12cell === 'undefined') {
        root.innerHTML = '<p style="color:#b91c1c;padding:16px;">bim_box12cell.js failed to load.</p>';
        return;
      }

      var rows = adefs_box12cell.map(function (adef) {
        var key = adef[0], val = adef[1];
        var label = (adef.length > 2) ? adef[2] : key;
        label = label.replace('(0, if not necessary)', '<small>(0=X)</small>');
        return '<tr><td>' + label + '</td><td><input type="number" id="' + key + '_s" value="' + val + '" ' +
               'onchange="fdraw_pscbox_redraw()"></td></tr>';
      }).join('');

      root.innerHTML =
        '<style>' + CSS + '</style>' +
        '<div class="px-root">' +
        '  <div class="px-card">' +
        '    <div class="px-hd"><span class="px-ttl">Dimension (mm)<span class="px-sub">PSC box girder &mdash; 1 / 2 cell</span></span>' +
        '      <button type="button" class="px-btn" onclick="fdraw_pscbox_dxf()">&#8681; DXF</button></div>' +
        '    <div class="px-body">' +
        '      <div class="px-radio"><b>Section Type :</b>' +
        '        <label><input type="radio" name="box12cell_ncell" value="1" checked onchange="fdraw_pscbox_redraw()"> 1 Cell</label>' +
        '        <label><input type="radio" name="box12cell_ncell" value="2" onchange="fdraw_pscbox_redraw()"> 2 Cell</label>' +
        '      </div>' +
        '      <div class="px-split">' +
        '        <div class="px-guide" id="box12cell_guide"></div>' +
        '        <div class="px-tblwrap" id="box12cell_vartable">' +
        '          <table class="px-tbl">' +
        '            <thead><tr><th>Variable</th><th>Value</th></tr></thead>' +
        '            <tbody>' + rows + '</tbody>' +
        '          </table>' +
        '        </div>' +
        '      </div>' +
        '    </div>' +
        '  </div>' +
        '</div>';

      redraw();
    });
  };
})();
