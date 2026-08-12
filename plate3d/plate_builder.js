/* ============================================================
   plate_builder.js — Plate assembly 3D engine driven by
   PLATE / CUT / ASSY data rows (see DATA_SCHEMA.md · macroBIM/plate3d)

   Usage — link-only HTML:

     <script src="https://unpkg.com/three@0.147.0/build/three.min.js"></script>
     <script src="https://unpkg.com/three@0.147.0/examples/js/controls/OrbitControls.js"></script>
     <script src="https://unpkg.com/polybooljs@1.1.0/dist/polybool.min.js"></script>
     <script src="(optional data file defining window.PLATE_DATA)"></script>
     <script src="(jsDelivr URL of this file)"></script>

   On load the engine auto-runs: it renders window.PLATE_DATA if present,
   otherwise an empty default layout. plateBuilder.run({...}) can also be
   called directly (skips the auto-run).

   · Plate definition: local XY plane, thickness +z.
     The PLATE sheet uses block headers — a row starting with '#'
     declares the columns for the rows below it; blocks can be mixed:
       trapezoid: # PLATE | ID | WT | WB | H | OFF_T | OFF_B | THK | MAT
       rectangle: # PLATE | ID | B | H | THK | MAT
       circle:    # PLATE | ID | D | THK | MAT
     (WT/WB = top/bottom width, OFF_T/OFF_B = top/bottom left offsets;
      WT=0 makes a triangle. The legacy single-header format with a
      SHAPE column is still accepted.)
   · CUT: polygon subtraction via polybool — holes/notches/trims in one
     path, NX·PX / NY·PY array patterns
   · ASSY: PLANE (FRONT/SIDE/PLAN + OFFSET/U/V/ANG) or
            EDGE (attach to et/eb/el/er of a target instance with
            FOLD/ALIGN/SLIDE/FLUSH)
     (the legacy sheet key PLACE is still accepted as an alias of ASSY)
   · 9 points: ptl ptc ptr / plm pcc prm / pbl pbc pbr
     (based on the uncut outline)
   ============================================================ */

(function () {
  'use strict';

  var RHO = 7.85e-6;   // steel density, kg/mm^3
  var PALETTE = [0xc87137, 0x4caf50, 0x5c9bd1, 0xd4b13e, 0xe0e0e0, 0x8d6e63,
                 0x7cb342, 0xba68c8, 0xf06292, 0x4dd0e1, 0x9575cd, 0xe8c84a,
                 0x81c784, 0x64b5f6, 0xffb74d, 0xa1887f];

  var CSS = [
    '#pb-app * { margin:0; padding:0; box-sizing:border-box; }',
    'body { background:#15181c; overflow:hidden; }',
    '#pb-app { display:flex; width:100vw; height:100vh; color:#d8dce2;',
    "  font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif; font-size:13px; }",
    '#pb-side { width:300px; min-width:300px; height:100%; overflow-y:auto; background:#1c2026;',
    '  border-right:1px solid #2c323b; padding:14px; }',
    '#pb-view { flex:1; height:100%; position:relative; }',
    '#pb-view canvas { display:block; }',
    '#pb-side h1 { font-size:15px; color:#fff; margin-bottom:2px; }',
    '#pb-side .sub { color:#8a93a0; font-size:11px; margin-bottom:12px; }',
    '#pb-side .btnrow { display:flex; gap:5px; flex-wrap:wrap; margin-bottom:12px; }',
    '#pb-side button { background:#2a3038; color:#d8dce2; border:1px solid #3a424d;',
    '  border-radius:4px; padding:5px 10px; cursor:pointer; font-size:12px; }',
    '#pb-side button:hover { background:#39424d; }',
    '#pb-side button.accent { background:#2b5c8a; border-color:#3a76ad; color:#fff; }',
    '#pb-side table { width:100%; border-collapse:collapse; margin-bottom:10px; }',
    '#pb-side td { padding:4px 2px; border-bottom:1px solid #23272e; vertical-align:middle; }',
    '#pb-side tr.ghead td { color:#f0c674; font-size:11px; padding-top:10px;',
    '  border-bottom:1px solid #2c323b; }',
    '#pb-side .chip { display:inline-block; width:11px; height:11px; border-radius:2px;',
    '  margin-right:5px; vertical-align:-1px; }',
    '#pb-side .dims { color:#8a93a0; font-size:11px; }',
    '#pb-total { color:#fff; font-size:12px; margin:6px 0 12px; }',
    '#pb-prog { display:none; margin:0 0 10px; }',
    '#pb-prog-label { font-size:11px; color:#8a93a0; margin-bottom:4px; }',
    '.pb-track { height:8px; background:#242a31; border-radius:4px; overflow:hidden; }',
    '#pb-prog-bar { height:100%; width:0; background:#3a76ad; transition:width .15s; }',
    '#pb-result { display:none; border:1px solid; border-radius:5px; padding:8px;',
    '  font-size:11px; line-height:1.5; margin-bottom:10px; word-break:break-all; }',
    '#pb-result.ok { border-color:#2e6b3a; background:#12281a; color:#8ec99a; }',
    '#pb-result.warn { border-color:#8a6d1a; background:#2a2312; color:#f0c674; }',
    '#pb-result.err { border-color:#a03a3a; background:#2a1414; color:#f09a9a; }',
    '#pb-result ul { margin:6px 0 0 16px; }',
    '#pb-note { background:#22262d; border:1px solid #2c323b; border-radius:5px; padding:8px;',
    '  font-size:11px; color:#9aa3b0; line-height:1.55; }',
    '#pb-hud { position:absolute; left:10px; bottom:8px; color:#5b6472; font-size:11px;',
    '  pointer-events:none; }',
    '#pb-side .plname { cursor:pointer; }',
    '#pb-side .plname:hover { color:#6fb3e8; text-decoration:underline; }',
    '#pb-modal { position:fixed; left:0; top:0; right:0; bottom:0; background:rgba(0,0,0,.55);',
    '  display:none; z-index:50; align-items:center; justify-content:center; }',
    '#pb-modal .box { background:#1c2026; border:1px solid #3a424d; border-radius:8px;',
    '  padding:14px; box-shadow:0 8px 30px rgba(0,0,0,.5); }',
    '#pb-modal h2 { font-size:14px; color:#fff; margin:0 0 8px; }',
    '#pb-modal .close { float:right; cursor:pointer; color:#8a93a0; padding:0 4px; }',
    '#pb-modal .close:hover { color:#fff; }',
    '#pb-modal canvas { background:#15181c; border:1px solid #2c323b; border-radius:4px;',
    '  display:block; }',
    '#pb-modal .meta { color:#8a93a0; font-size:11px; margin-top:8px; }'
  ].join('\n');

  var scene, camera, renderer, controls;
  var lastPlates = {}, lastCuts = [], lastColors = {};   // for the plate preview modal
  var CENTER = null, VDIST = 1200;                // set from model bbox in run()
  var items = [];
  var runToken = 0;                               // distinguishes re-runs

  /* ---------------- sheet parser ---------------- */
  function sheetToObjects(sheet) {
    var head = sheet[0];
    return sheet.slice(1).map(function (row) {
      var o = {};
      head.forEach(function (h, i) { o[h] = row[i]; });
      return o;
    });
  }
  function num(v, dflt) { return (v === '' || v === undefined || v === null) ? dflt : Number(v); }
  function str(v) { return String(v === undefined || v === null ? '' : v).trim(); }

  /* ================================================================
     Excel loader — single-sheet keyword grammar (ExcelJS required):
       · first char '#' or '!'  → comment row (ignored)
       · rows are read until an END keyword row
       · keywords/IDs/planes/points are case-insensitive (uppercased)
       PLATE ID WT WB H OFF_T OFF_B THK MAT   (trapezoid, 7+ values)
       PLATE ID B H THK MAT                   (rectangle)
       BAR   ID DIA LENGTH                    (cylinder)
       CUT   [plateID] RECT  B H  L.X L.Y L.ROT dx dy repeat
       CUT   [plateID] CIRC  D    L.X L.Y L.ROT dx dy repeat
       CUT   [plateID] PLATE ID   L.X L.Y L.ROT dx dy repeat
                                              (plateID optional; without it the cut
                                               applies to the last PLATE/BAR row)
       MODULE ID PLATE.ID PLANE REF.PT L.X L.Y L.ROT OFFSET
                                              (one row per member plate, module-local
                                               coords; rows with the same module ID
                                               accumulate; PART = legacy alias)
       MODULE ID BASE INSTANCE POINT          (module reference point = one of the
                                               9 points of a member plate;
                                               missing BASE -> warning + local origin)
       -- block style also accepted: a bare "MODULE ID" row followed by
          POS ID PLANE REF.PT L.X L.Y L.ROT OFFSET  and  BASE INSTANCE POINT rows
       ASSY  ID PLANE REF.PT L.X L.Y L.ROT OFFSET    (assemble a MODULE or a PLATE.
                                               REF.PT for modules: blank/O = BASE point,
                                               9-point name = module bbox point,
                                               INSTANCE.POINT = explicit plate point)
       END
     ================================================================ */
  var PLANE_ALIAS = { XY: 'FRONT', YZ: 'SIDE', XZ: 'PLAN',
                      FRONT: 'FRONT', SIDE: 'SIDE', PLAN: 'PLAN' };
  var POINT_ALIAS = { TL: 'ptl', TC: 'ptc', TR: 'ptr', LM: 'plm', CC: 'pcc',
                      RM: 'prm', BL: 'pbl', BC: 'pbc', BR: 'pbr' };
  function normPoint(s) {
    var up = str(s).toUpperCase();
    if (up.length === 3 && up.charAt(0) === 'P') up = up.slice(1);
    return POINT_ALIAS[up] || 'pbl';
  }

  function parseExcelRows(rows) {
    var plates = {}, parts = {}, cuts = [], assy = [], log = [];
    var counts = { plate: 0, bar: 0, cut: 0, module: 0, assy: 0 };
    var current = null, currentPart = null, counter = {};
    function warn(m) { log.push(m); console.error('[plateBuilder] ' + m); }
    function resolvePlate(pid) {          // exact id, or instance suffix PL.C1_2 → PL.C1
      if (plates[pid]) return pid;
      var sfx = pid.match(/^(.+?)[_-]\d+$/);
      if (sfx && plates[sfx[1]]) return sfx[1];
      return null;
    }
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r] || [];
      var k = 0;
      while (k < row.length && str(row[k]) === '') k++;
      if (k >= row.length) continue;
      var kw = str(row[k]).toUpperCase();
      if (kw.charAt(0) === '#' || kw.charAt(0) === '!') continue;
      var v = row.slice(k + 1);
      while (v.length && str(v[v.length - 1]) === '') v.pop();
      if (kw === 'END') break;

      if (kw === 'PLATE') {
        var id = str(v[0]).toUpperCase();
        if (!id) continue;
        var spec;
        if (v.length >= 7) {              // trapezoid
          spec = { ID: id, SHAPE: 'TRAP', WT: num(v[1], 0), WB: num(v[2], 0),
                   H: num(v[3], 0), OFF_T: num(v[4], 0), OFF_B: num(v[5], 0),
                   THK: num(v[6], 10), MAT: str(v[7]) };
        } else {                          // rectangle
          var b = num(v[1], 0);
          spec = { ID: id, SHAPE: 'TRAP', WT: b, WB: b, H: num(v[2], 0),
                   OFF_T: 0, OFF_B: 0, THK: num(v[3], 10), MAT: str(v[4]) };
        }
        plates[id] = spec;
        current = id;
        counts.plate++;
      } else if (kw === 'BAR') {          // ID DIA LENGTH → cylinder
        var idb = str(v[0]).toUpperCase();
        if (!idb) continue;
        plates[idb] = { ID: idb, SHAPE: 'CIRC', D: num(v[1], 0),
                        THK: num(v[2], 0), MAT: str(v[3]) };
        current = idb;
        counts.bar++;
      } else if (kw === 'CUT') {          // CUT [plateID] TYPE ... — plate ID optional
        var sub = str(v[0]).toUpperCase();
        var target = current;
        if (sub !== 'RECT' && sub !== 'CIRC' && sub !== 'PLATE') {
          var tp = resolvePlate(sub);     // row style: CUT <plateID> <TYPE> ...
          if (tp) { target = tp; v = v.slice(1); sub = str(v[0]).toUpperCase(); }
        }
        if (!target) { warn('row ' + (r + 1) + ': CUT before any PLATE'); continue; }
        var c = { PLATE: target };
        if (sub === 'RECT') {
          c.TYPE = 'TRAP'; c.B = num(v[1], 0); c.TW = c.B; c.H = num(v[2], 0); c.OF = 0;
          c.U = num(v[3], 0); c.V = num(v[4], 0); c.ANG = num(v[5], 0);
          c.DX = num(v[6], 0); c.DY = num(v[7], 0); c.N = num(v[8], 1);
        } else if (sub === 'CIRC') {
          c.TYPE = 'CIRC'; c.D = num(v[1], 0);
          c.U = num(v[2], 0); c.V = num(v[3], 0); c.ANG = num(v[4], 0);
          c.DX = num(v[5], 0); c.DY = num(v[6], 0); c.N = num(v[7], 1);
        } else if (sub === 'PLATE') {
          c.TYPE = 'REF'; c.REF = str(v[1]).toUpperCase();
          c.U = num(v[2], 0); c.V = num(v[3], 0); c.ANG = num(v[4], 0);
          c.DX = num(v[5], 0); c.DY = num(v[6], 0); c.N = num(v[7], 1);
        } else { warn('row ' + (r + 1) + ': unknown CUT type ' + sub); continue; }
        cuts.push(c);
        counts.cut++;
      } else if (kw === 'MODULE' || kw === 'PART') {   // module row (PART = legacy alias)
        var partId = str(v[0]).toUpperCase();
        if (!partId) { warn('row ' + (r + 1) + ': MODULE without ID'); continue; }
        if (!parts[partId]) { parts[partId] = { ID: partId, pos: [], base: null }; counts.module++; }
        currentPart = parts[partId];
        if (v.length <= 1) continue;      // block style: POS/BASE rows follow
        var msub = str(v[1]).toUpperCase();
        if (msub === 'BASE') {            // MODULE id BASE <instance> <point>
          currentPart.base = { inst: str(v[2]).toUpperCase(), pt: normPoint(v[3]) };
          continue;
        }
        var mplate = resolvePlate(msub);  // MODULE id <plate> <PLANE> <Ref.Pt> <L.X> <L.Y> <L.ROT> <OFFSET>
        if (!mplate) { warn('row ' + (r + 1) + ': MODULE row with undefined plate ' + msub); continue; }
        var mplane = str(v[2]).toUpperCase();
        if (!PLANE_ALIAS[mplane]) { warn('row ' + (r + 1) + ': unknown PLANE ' + mplane + ' (use XY/YZ/XZ)'); continue; }
        currentPart.pos.push({ NO: msub, PLATE: mplate, PLANE: PLANE_ALIAS[mplane],
                               REFPT: normPoint(v[3]), LX: num(v[4], 0), LY: num(v[5], 0),
                               ROT: num(v[6], 0), OFFSET: num(v[7], 0) });
      } else if (kw === 'POS') {          // place a plate inside the current part
        if (!currentPart) { warn('row ' + (r + 1) + ': POS outside of a MODULE'); continue; }
        var ppid = str(v[0]).toUpperCase();
        var pplate = resolvePlate(ppid);
        if (!pplate) { warn('row ' + (r + 1) + ': POS of undefined plate ' + ppid); continue; }
        var pplane = str(v[1]).toUpperCase();
        if (!PLANE_ALIAS[pplane]) { warn('row ' + (r + 1) + ': unknown PLANE ' + pplane + ' (use XY/YZ/XZ)'); continue; }
        currentPart.pos.push({ NO: ppid, PLATE: pplate, PLANE: PLANE_ALIAS[pplane],
                               REFPT: normPoint(v[2]), LX: num(v[3], 0), LY: num(v[4], 0),
                               ROT: num(v[5], 0), OFFSET: num(v[6], 0) });
      } else if (kw === 'BASE') {         // BASE INSTANCE POINT — part reference point
        if (!currentPart) { warn('row ' + (r + 1) + ': BASE outside of a MODULE'); continue; }
        currentPart.base = { inst: str(v[0]).toUpperCase(), pt: normPoint(v[1]) };
      } else if (kw === 'ASSY') {         // ID PLANE REF.PT L.X L.Y L.ROT OFFSET
        var pid = str(v[0]).toUpperCase();
        var partRef = parts[pid] ? pid : null;
        if (!partRef) {                   // instance-suffix on parts too: PC.COL_2 → PC.COL
          var psfx = pid.match(/^(.+?)[_-]\d+$/);
          if (psfx && parts[psfx[1]]) partRef = psfx[1];
        }
        var plateId = partRef ? null : resolvePlate(pid);
        if (!partRef && !plateId) { warn('row ' + (r + 1) + ': ASSY of undefined ID ' + pid); continue; }
        var key = partRef || plateId;
        counter[key] = (counter[key] || 0) + 1;
        var plkey = str(v[1]).toUpperCase();
        if (!PLANE_ALIAS[plkey]) { warn('row ' + (r + 1) + ': unknown PLANE ' + plkey + ' (use XY/YZ/XZ)'); continue; }
        assy.push({ __xl: true,
                    NO: pid !== key ? pid : key + '-' + counter[key],
                    PLATE: plateId, PART: partRef,
                    PLANE: PLANE_ALIAS[plkey],
                    REFPT: partRef ? str(v[2]) : normPoint(v[2]),   // parts: raw, resolved at build
                    LX: num(v[3], 0), LY: num(v[4], 0), ROT: num(v[5], 0),
                    OFFSET: num(v[6], 0), GROUP: '-', REMARK: '', MIRROR: '' });
        counts.assy++;
      } else {
        warn('row ' + (r + 1) + ': unknown keyword ' + kw);
      }
    }
    Object.keys(parts).forEach(function (id) {
      if (!parts[id].pos.length) warn('MODULE ' + id + ': has no POS rows');
      else if (!parts[id].base) warn('MODULE ' + id + ': BASE not defined — using local origin (0,0)');
      else if (!parts[id].pos.some(function (p) { return p.NO === parts[id].base.inst; }))
        warn('MODULE ' + id + ': BASE instance ' + parts[id].base.inst + ' not found among POS rows — using local origin');
    });
    return { plates: plates, parts: parts, cuts: cuts, assy: assy, log: log, counts: counts };
  }

  function cellVal(c) {
    if (c && typeof c === 'object') {
      if (c.result !== undefined) return c.result;
      if (c.text !== undefined) return c.text;
      if (c.richText) return c.richText.map(function (t) { return t.text; }).join('');
      return '';
    }
    return c;
  }

  var buildLog = [];                      // scene-build errors, shown in the result panel
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function pbProgress(pct, label) {
    var wrap = document.getElementById('pb-prog');
    if (!wrap) return;
    if (pct === null) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    document.getElementById('pb-prog-bar').style.width = Math.round(pct) + '%';
    document.getElementById('pb-prog-label').textContent = label + ' — ' + Math.round(pct) + '%';
  }
  function showResult(fname, parsed, fatal) {
    var el = document.getElementById('pb-result');
    if (!el) return;
    if (fatal) {
      el.className = 'err';
      el.innerHTML = '<b>&#9888; ' + esc(fname) + '</b><br>' + esc(fatal);
      el.style.display = 'block';
      return;
    }
    var log = (parsed.log || []).concat(buildLog);
    var c = parsed.counts;
    var placed = items.length;
    el.className = log.length ? 'warn' : 'ok';
    var h = '<b>' + (log.length ? '&#9888; ' : '&#10003; ') + esc(fname) + '</b><br>' +
            'plates ' + c.plate + ' &middot; bars ' + c.bar + ' &middot; cuts ' + c.cut +
            ' &middot; modules ' + (c.module || 0) +
            ' &middot; assy ' + c.assy + ' &rarr; placed ' + placed;
    if (log.length) {
      h += '<ul>' + log.slice(0, 10).map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') +
           (log.length > 10 ? '<li>... ' + (log.length - 10) + ' more (see console)</li>' : '') + '</ul>';
    }
    el.innerHTML = h;
    el.style.display = 'block';
  }

  function loadExcelFile(file) {
    if (typeof ExcelJS === 'undefined') {
      alert('ExcelJS library is missing. Add this line before plate_builder.js:\n' +
            '<script src="https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js"><\/script>');
      return;
    }
    var reader = new FileReader();
    pbProgress(3, 'Reading ' + file.name);
    reader.onprogress = function (e) {
      if (e.lengthComputable) pbProgress(3 + 37 * e.loaded / e.total, 'Reading ' + file.name);
    };
    reader.onerror = function () {
      pbProgress(null);
      showResult(file.name, null, 'Failed to read the file.');
    };
    reader.onload = function () {
      pbProgress(45, 'Opening workbook');
      setTimeout(function () {                       // let the bar repaint
        var wb = new ExcelJS.Workbook();
        wb.xlsx.load(reader.result).then(function (wb2) {
          pbProgress(70, 'Parsing data');
          var ws = wb2.worksheets[0];
          var rows = [];
          ws.eachRow({ includeEmpty: true }, function (r) {
            rows.push((r.values || []).slice(1).map(cellVal));
          });
          var parsed = parseExcelRows(rows);
          pbProgress(90, 'Building model');
          setTimeout(function () {
            buildLog = [];
            run({ title: 'Plate Builder',
                  subtitle: file.name + ' · PLATE/CUT/ASSY · unit: mm',
                  note: 'Loaded from ' + file.name +
                        ' — edit the Excel file and load it again to update.',
                  __parsed: parsed });                 // rebuilds the DOM
            showResult(file.name, parsed);             // result panel in the new DOM
          }, 30);
        }).catch(function (err) {
          pbProgress(null);
          showResult(file.name, null, 'Failed to open the workbook: ' + err.message);
        });
      }, 30);
    };
    reader.readAsArrayBuffer(file);
  }

  /* ------- PLATE sheet parser: '#'-prefixed block headers ------- */
  function parsePlateSheet(sheet) {
    var out = [], colmap = null;
    (sheet || []).forEach(function (row) {
      if (!row || !row.length) return;
      var first = String(row[0] === undefined || row[0] === null ? '' : row[0]).trim();
      var isMarker = first.charAt(0) === '#';
      var isLegacyHeader = first === 'ID';
      if (isMarker || isLegacyHeader) {            // header row: build index → column-name map
        colmap = [];
        row.forEach(function (cell, i) {
          var name = String(cell === undefined || cell === null ? '' : cell).trim();
          if (name && name.charAt(0) !== '#' && name !== 'PLATE') colmap.push([i, name]);
        });
        return;
      }
      if (!colmap) return;                         // data before any header — ignore
      var o = {};
      colmap.forEach(function (m) { o[m[1]] = row[m[0]]; });
      if (o.ID === undefined || o.ID === '' || o.ID === null) return;
      out.push(normalizePlate(o));
    });
    return out;
  }

  // normalize any accepted row format into {ID, SHAPE, WB, WT, H, OFF_T, OFF_B, D, THK, MAT}
  function normalizePlate(o) {
    var spec = { ID: o.ID, THK: num(o.THK, 10), MAT: o.MAT || '' };
    if (o.SHAPE !== undefined) {                   // legacy single-header format
      if (o.SHAPE === 'CIRC') { spec.SHAPE = 'CIRC'; spec.D = num(o.D, 0); return spec; }
      var B = num(o.B, 0), TW = num(o.TW, B);
      spec.SHAPE = 'TRAP'; spec.WB = B; spec.WT = TW; spec.H = num(o.H, 0);
      spec.OFF_B = 0; spec.OFF_T = num(o.OF, (B - TW) / 2);
      return spec;
    }
    if (o.D !== undefined && o.WB === undefined && o.B === undefined) {   // circle block
      spec.SHAPE = 'CIRC'; spec.D = num(o.D, 0);
      return spec;
    }
    if (o.WB !== undefined || o.WT !== undefined) {                       // trapezoid block
      spec.SHAPE = 'TRAP'; spec.WB = num(o.WB, 0); spec.WT = num(o.WT, 0);
      spec.H = num(o.H, 0); spec.OFF_T = num(o.OFF_T, 0); spec.OFF_B = num(o.OFF_B, 0);
      return spec;
    }
    var b = num(o.B, 0);                                                  // rectangle block
    spec.SHAPE = 'TRAP'; spec.WB = b; spec.WT = b; spec.H = num(o.H, 0);
    spec.OFF_T = 0; spec.OFF_B = 0;
    return spec;
  }

  function cornersOf(spec) {
    return { pbl: [spec.OFF_B, 0], pbr: [spec.OFF_B + spec.WB, 0],
             ptr: [spec.OFF_T + spec.WT, spec.H], ptl: [spec.OFF_T, spec.H] };
  }
  function outlineOf(spec) {                       // CCW
    if (spec.SHAPE === 'CIRC') return circleOutline(spec.D, 0, 0, 48);   // CIRC: pcc=(0,0)
    var c = cornersOf(spec);
    if (spec.WT <= 0) return [c.pbl, c.pbr, c.ptl];
    return [c.pbl, c.pbr, c.ptr, c.ptl];
  }
  function mirrorAxisOf(spec) {                    // bbox center ×2 (for x → m − x)
    var lo = Math.min(spec.OFF_B, spec.OFF_T);
    var hi = Math.max(spec.OFF_B + spec.WB, spec.OFF_T + spec.WT);
    return lo + hi;
  }

  /* ---------------- 2D geometry ---------------- */
  function trapOutline(B, TW, H, OF) {              // CCW
    if (TW <= 0) return [[0, 0], [B, 0], [OF, H]];
    return [[0, 0], [B, 0], [OF + TW, H], [OF, H]];
  }
  function circleOutline(D, cx, cy, seg) {
    var pts = [];
    for (var i = 0; i < seg; i++) {
      var a = i / seg * Math.PI * 2;
      pts.push([cx + D / 2 * Math.cos(a), cy + D / 2 * Math.sin(a)]);
    }
    return pts;
  }
  function rotTrans(pts, ang, dx, dy) {             // rotate about (0,0), then translate
    var c = Math.cos(ang * Math.PI / 180), s = Math.sin(ang * Math.PI / 180);
    return pts.map(function (p) { return [p[0] * c - p[1] * s + dx, p[0] * s + p[1] * c + dy]; });
  }
  function ringArea(r) {
    var a = 0;
    for (var i = 0; i < r.length; i++) {
      var p = r[i], q = r[(i + 1) % r.length];
      a += p[0] * q[1] - q[0] * p[1];
    }
    return a / 2;
  }
  function pointInRing(pt, ring) {
    var x = pt[0], y = pt[1], inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  /* ---------------- plate shape: outline minus cuts ---------------- */
  function buildPlate2D(spec, cuts, plates) {
    var outline = outlineOf(spec);

    var cutters = [];
    cuts.filter(function (c) { return c.PLATE === spec.ID; }).forEach(function (c) {
      // positions: 1D repeat (N/DX/DY, Excel grammar) or NX·PX/NY·PY grid
      var uvs = [];
      if (c.N !== undefined) {
        for (var i = 0; i < num(c.N, 1); i++)
          uvs.push([num(c.U, 0) + i * num(c.DX, 0), num(c.V, 0) + i * num(c.DY, 0)]);
      } else {
        var nx = num(c.NX, 1), px = num(c.PX, 0), ny = num(c.NY, 1), py = num(c.PY, 0);
        for (var ix = 0; ix < nx; ix++) for (var iy = 0; iy < ny; iy++)
          uvs.push([num(c.U, 0) + ix * px, num(c.V, 0) + iy * py]);
      }
      uvs.forEach(function (uv) {
        var u = uv[0], v = uv[1];
        if (c.TYPE === 'CIRC') cutters.push(circleOutline(num(c.D, 0), u, v, 32));
        else if (c.TYPE === 'TRAP') {
          var tw = num(c.TW, num(c.B, 0));
          cutters.push(rotTrans(trapOutline(num(c.B, 0), tw, num(c.H, 0), num(c.OF, (num(c.B, 0) - tw) / 2)),
                                num(c.ANG, 0), u, v));
        } else if (c.TYPE === 'REF' && plates[c.REF]) {                // borrow another plate outline
          cutters.push(rotTrans(outlineOf(plates[c.REF]), num(c.ANG, 0), u, v));
        }
      });
    });

    var region = { regions: [outline], inverted: false };
    cutters.forEach(function (cu) {
      region = PolyBool.difference(region, { regions: [cu], inverted: false });
    });

    // classify rings: even containment depth = outer, odd = hole
    var rings = region.regions.filter(function (r) { return r.length >= 3; });
    var outers = [], holes = [];
    rings.forEach(function (r) {
      var depth = 0;
      rings.forEach(function (s) { if (s !== r && pointInRing(r[0], s)) depth++; });
      (depth % 2 ? holes : outers).push(r);
    });
    var area = 0;
    outers.forEach(function (r) { area += Math.abs(ringArea(r)); });
    holes.forEach(function (r) { area -= Math.abs(ringArea(r)); });

    return { outers: outers,
             holes: outers.map(function (o) {
               return holes.filter(function (h) { return pointInRing(h[0], o); });
             }),
             area: area };
  }

  /* ------- named points/edges (uncut outline, MIRROR applied) ------- */
  function namedPoints(spec, mirror) {
    var p;
    function mid(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
    if (spec.SHAPE === 'CIRC') {
      var r = num(spec.D, 0) / 2;
      p = { pcc: [0, 0], ptc: [0, r], pbc: [0, -r], plm: [-r, 0], prm: [r, 0] };
      p.ptl = p.ptr = p.ptc; p.pbl = p.pbr = p.pbc;
      return p;
    }
    p = cornersOf(spec);
    if (mirror) {                                  // mirror about bbox center, then rename
      var m = mirrorAxisOf(spec);
      var M = function (q) { return [m - q[0], q[1]]; };
      p = { pbl: M(p.pbr), pbr: M(p.pbl), ptl: M(p.ptr), ptr: M(p.ptl) };
    }
    p.pbc = mid(p.pbl, p.pbr); p.ptc = mid(p.ptl, p.ptr);
    p.plm = mid(p.pbl, p.ptl); p.prm = mid(p.pbr, p.ptr);
    p.pcc = [(p.pbl[0] + p.pbr[0] + p.ptr[0] + p.ptl[0]) / 4,
             (p.pbl[1] + p.pbr[1] + p.ptr[1] + p.ptl[1]) / 4];
    return p;
  }
  // edges in CCW order (interior on the left of travel direction)
  function edgeOf(pts, name) {
    return { eb: [pts.pbl, pts.pbr], er: [pts.pbr, pts.ptr],
             et: [pts.ptr, pts.ptl], el: [pts.ptl, pts.pbl] }[name];
  }
  function mirror2D(ringList, spec) {
    var m = mirrorAxisOf(spec);
    return ringList.map(function (ring) {
      return ring.map(function (q) { return [m - q[0], q[1]]; }).reverse();
    });
  }

  /* ---------------- placement matrices ---------------- */
  var PLANE_BASIS = {
    FRONT: { ex: [1, 0, 0],  ey: [0, 1, 0],  ez: [0, 0, 1] },   // x→X, y→Y, thickness→+Z
    SIDE:  { ex: [0, 0, -1], ey: [0, 1, 0],  ez: [1, 0, 0] },   // x→−Z, y→Y, thickness→+X
    PLAN:  { ex: [1, 0, 0],  ey: [0, 0, -1], ez: [0, 1, 0] }    // x→X, y→−Z, thickness→+Y
  };
  function v3(a) { return new THREE.Vector3(a[0], a[1], a[2]); }

  function planeMatrix(row) {
    var b = PLANE_BASIS[row.PLANE];
    if (!b) throw new Error(row.NO + ': PLANE=' + row.PLANE + ' (use FRONT/SIDE/PLAN)');
    var m = new THREE.Matrix4().makeBasis(v3(b.ex), v3(b.ey), v3(b.ez));
    m.multiply(new THREE.Matrix4().makeTranslation(num(row.U, 0), num(row.V, 0), num(row.OFFSET, 0)));
    m.multiply(new THREE.Matrix4().makeRotationZ(num(row.ANG, 0) * Math.PI / 180));
    return m;
  }

  // Excel grammar placement: the plate's REF.PT lands at (L.X, L.Y) on the
  // plane, rotated by L.ROT about that point, at OFFSET along the normal
  function planeMatrixAnchor(row, pts) {
    var b = PLANE_BASIS[row.PLANE];
    if (!b) throw new Error(row.NO + ': PLANE=' + row.PLANE + ' (use XY/YZ/XZ)');
    var a = pts[row.REFPT] || pts.pbl;
    var m = new THREE.Matrix4().makeBasis(v3(b.ex), v3(b.ey), v3(b.ez));
    m.multiply(new THREE.Matrix4().makeTranslation(row.LX, row.LY, row.OFFSET));
    m.multiply(new THREE.Matrix4().makeRotationZ(row.ROT * Math.PI / 180));
    m.multiply(new THREE.Matrix4().makeTranslation(-a[0], -a[1], 0));
    return m;
  }

  function edgeMatrix(row, inst, myPts, myTHK) {
    var tgt = inst[row.TO];
    if (!tgt) throw new Error(row.NO + ': TO=' + row.TO + ' undefined (only earlier rows can be referenced)');
    var te = edgeOf(tgt.pts, row.TO_EDGE);
    if (!te) throw new Error(row.NO + ': TO_EDGE=' + row.TO_EDGE);
    var A = v3([te[0][0], te[0][1], tgt.thk]).applyMatrix4(tgt.matrix);   // hinge = edge on target front face
    var Bp = v3([te[1][0], te[1][1], tgt.thk]).applyMatrix4(tgt.matrix);
    var n = new THREE.Vector3().setFromMatrixColumn(tgt.matrix, 2).normalize();  // target thickness dir
    var d = Bp.clone().sub(A), Lt = d.length(); d.normalize();
    var out = d.clone().cross(n);                                          // outward direction

    var th = (180 - num(row.FOLD, 90)) * Math.PI / 180;                    // FOLD 180=coplanar, 90=perpendicular
    var ex = d.clone();
    var ey = out.clone().multiplyScalar(Math.cos(th))
                .add(n.clone().multiplyScalar(Math.sin(th))).normalize();
    var ez = ex.clone().cross(ey);

    var me = edgeOf(myPts, row.MY_EDGE);
    if (!me) throw new Error(row.NO + ': MY_EDGE=' + row.MY_EDGE);
    var s = me[0], e = me[1];
    var Lm = Math.hypot(e[0] - s[0], e[1] - s[1]);
    if (Lm < 1e-9) throw new Error(row.NO + ': edge ' + row.MY_EDGE + ' is degenerate (triangle apex)');
    var phi = Math.atan2(e[1] - s[1], e[0] - s[0]);
    var r0 = new THREE.Matrix4().makeRotationZ(-phi)
               .multiply(new THREE.Matrix4().makeTranslation(-s[0], -s[1], 0));

    var align = { S: 0, C: (Lt - Lm) / 2, E: Lt - Lm }[row.ALIGN || 'S'] + num(row.SLIDE, 0);
    var flush = { OUT: -myTHK, C: -myTHK / 2, IN: 0 }[row.FLUSH || 'C'];
    var origin = A.clone().add(d.clone().multiplyScalar(align)).add(ez.clone().multiplyScalar(flush));

    return new THREE.Matrix4().makeBasis(ex, ey, ez).setPosition(origin).multiply(r0);
  }

  /* ---------------- scene build ---------------- */
  function buildAll(data, colors) {
    var plates = {}, parts = {}, cuts, assyRows;
    var colorSeq = 0;
    if (data.__parsed) {                 // Excel keyword-grammar path
      plates = data.__parsed.plates;
      parts = data.__parsed.parts || {};
      cuts = data.__parsed.cuts;
      assyRows = data.__parsed.assy;
    } else {                             // JS sheet-array path
      cuts = sheetToObjects(data.CUT);
      assyRows = sheetToObjects(data.ASSY);
      parsePlateSheet(data.PLATE).forEach(function (p) { plates[p.ID] = p; });
    }
    Object.keys(plates).forEach(function (id) {
      if (!(id in colors)) colors[id] = PALETTE[colorSeq++ % PALETTE.length];
    });
    lastPlates = plates;
    lastCuts = cuts;
    lastColors = colors;
    var inst = {};                       // NO → {matrix, pts, thk} for EDGE references
    var bbox = new THREE.Box3();

    function buildErr(m) { buildLog.push(m); console.error('[plateBuilder] ' + m); }

    // create geometry for one plate instance with a final world matrix
    function buildInstance(spec, matrix, no, group, remark, mirror) {
      var thk = spec.THK;
      var g2d = buildPlate2D(spec, cuts, plates);
      var outers = g2d.outers, holesArr = g2d.holes;
      if (mirror) {
        outers = mirror2D(outers, spec);
        holesArr = holesArr.map(function (hs) { return mirror2D(hs, spec); });
      }
      var groupObj = new THREE.Group();
      var mat = new THREE.MeshPhongMaterial({ color: colors[spec.ID], shininess: 28 });
      outers.forEach(function (ring, i) {
        var shape = new THREE.Shape(ring.map(function (q) { return new THREE.Vector2(q[0], q[1]); }));
        holesArr[i].forEach(function (h) {
          shape.holes.push(new THREE.Path(h.map(function (q) { return new THREE.Vector2(q[0], q[1]); })));
        });
        var geo = new THREE.ExtrudeGeometry(shape, { depth: thk, bevelEnabled: false, curveSegments: 24 });
        var mesh = new THREE.Mesh(geo, mat);
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(matrix);
        groupObj.add(mesh);
        geo.computeBoundingBox();
        bbox.union(geo.boundingBox.clone().applyMatrix4(matrix));
        var edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25),
                                          new THREE.LineBasicMaterial({ color: 0x0e1013 }));
        edge.matrixAutoUpdate = false;
        edge.matrix.copy(matrix);
        groupObj.add(edge);
      });
      scene.add(groupObj);
      var dims = spec.SHAPE === 'CIRC'
        ? 'D' + spec.D + '×' + thk
        : (spec.WT === spec.WB && spec.OFF_T === spec.OFF_B
            ? spec.WB + '×' + spec.H + '×' + thk + 'T'
            : spec.WT + '/' + spec.WB + '×' + spec.H + '×' + thk + 'T');
      items.push({ no: no, plateId: spec.ID, group: group || '-',
                   groupObj: groupObj, mass: g2d.area * thk * RHO,
                   dims: dims, remark: remark || '',
                   spec: spec, thk: thk, matrix: matrix,
                   rings: { outers: outers, holes: holesArr } });
      return { pts: namedPoints(spec, mirror), thk: thk };
    }

    // part-local placements + base point (3D, part-local)
    function partLocals(part) {
      var locals = part.pos.map(function (p) {
        var spec = plates[p.PLATE];
        var pts = namedPoints(spec, false);
        return { row: p, spec: spec, pts: pts, mloc: planeMatrixAnchor(p, pts) };
      });
      var base = new THREE.Vector3(0, 0, 0);
      if (part.base) {
        for (var i = 0; i < locals.length; i++) {
          if (locals[i].row.NO === part.base.inst) {
            var a = locals[i].pts[part.base.pt] || locals[i].pts.pbl;
            base = new THREE.Vector3(a[0], a[1], 0).applyMatrix4(locals[i].mloc);
            break;
          }
        }
      }
      return { locals: locals, base: base };
    }

    // part reference point in part-local 3D coords, per ASSY REFPT syntax
    function partRefPoint(pl, refpt) {
      var s = str(refpt).toUpperCase();
      if (s === '' || s === 'O') return pl.base;                     // BASE (or origin)
      var dot = s.indexOf('.');
      if (dot > 0 && s.lastIndexOf('.') !== 0) {                     // INSTANCE.POINT
        var pt = s.slice(s.lastIndexOf('.') + 1);
        var instName = s.slice(0, s.lastIndexOf('.'));
        for (var i = 0; i < pl.locals.length; i++) {
          if (pl.locals[i].row.NO === instName) {
            var a = pl.locals[i].pts[normPoint(pt)] || pl.locals[i].pts.pbl;
            return new THREE.Vector3(a[0], a[1], 0).applyMatrix4(pl.locals[i].mloc);
          }
        }
        buildErr('part ref point ' + s + ' not found — using BASE');
        return pl.base;
      }
      // plain 9-point name → part bbox (X/Y per name, Z centered)
      var bb = new THREE.Box3();
      pl.locals.forEach(function (L) {
        var c = L.spec.SHAPE === 'CIRC'
          ? { pbl: [-L.spec.D / 2, -L.spec.D / 2], ptr: [L.spec.D / 2, L.spec.D / 2] }
          : cornersOf(L.spec);
        var xs = [], ys = [];
        Object.keys(c).forEach(function (k) { xs.push(c[k][0]); ys.push(c[k][1]); });
        [[Math.min.apply(null, xs), Math.min.apply(null, ys), 0],
         [Math.max.apply(null, xs), Math.max.apply(null, ys), L.spec.THK]].forEach(function (q) {
          bb.expandByPoint(new THREE.Vector3(q[0], q[1], q[2]).applyMatrix4(L.mloc));
        });
      });
      var p9 = normPoint(refpt);
      var x = p9.charAt(2) === 'l' ? bb.min.x : p9.charAt(2) === 'r' ? bb.max.x : (bb.min.x + bb.max.x) / 2;
      var y = p9.charAt(1) === 'b' ? bb.min.y : p9.charAt(1) === 't' ? bb.max.y : (bb.min.y + bb.max.y) / 2;
      return new THREE.Vector3(x, y, (bb.min.z + bb.max.z) / 2);
    }

    assyRows.forEach(function (row) {
      if (row.PART) {                    // part instance: place every member plate
        var part = parts[row.PART];
        if (!part) { buildErr(row.NO + ': unknown MODULE=' + row.PART); return; }
        var pl;
        try { pl = partLocals(part); } catch (err) { buildErr(row.NO + ': ' + err.message); return; }
        var B = partRefPoint(pl, row.REFPT);
        var b = PLANE_BASIS[row.PLANE];
        var M = new THREE.Matrix4().makeBasis(v3(b.ex), v3(b.ey), v3(b.ez));
        M.multiply(new THREE.Matrix4().makeTranslation(row.LX, row.LY, row.OFFSET));
        M.multiply(new THREE.Matrix4().makeRotationZ(row.ROT * Math.PI / 180));
        M.multiply(new THREE.Matrix4().makeTranslation(-B.x, -B.y, -B.z));
        pl.locals.forEach(function (L) {
          var world = M.clone().multiply(L.mloc);
          buildInstance(L.spec, world, row.NO + '/' + L.row.NO, row.NO, '', false);
        });
        return;
      }
      var spec = plates[row.PLATE];
      if (!spec) { buildErr(row.NO + ': unknown PLATE=' + row.PLATE); return; }
      var mirror = row.MIRROR === 'X';
      var pts = namedPoints(spec, mirror);
      var matrix;
      try {
        matrix = row.__xl ? planeMatrixAnchor(row, pts)
               : row.METHOD === 'EDGE' ? edgeMatrix(row, inst, pts, spec.THK)
               : planeMatrix(row);
      } catch (err) { buildErr(err.message); return; }
      var r2 = buildInstance(spec, matrix, row.NO, row.GROUP, row.REMARK, mirror);
      inst[row.NO] = { matrix: matrix, pts: r2.pts, thk: r2.thk };
    });
    return bbox;
  }

  /* -------- plate definition list + 2D preview modal -------- */
  function buildPlateList(colors) {
    var tbl = document.getElementById('pb-plates');
    if (!tbl) return;
    tbl.innerHTML = '';
    var ids = Object.keys(lastPlates);
    if (!ids.length) return;
    var gtr = document.createElement('tr');
    gtr.className = 'ghead';
    gtr.innerHTML = '<td colspan="3">PLATES — click to preview</td>';
    tbl.appendChild(gtr);
    ids.forEach(function (id) {
      var spec = lastPlates[id];
      var dims = spec.SHAPE === 'CIRC'
        ? 'D' + spec.D + '×' + spec.THK
        : (spec.WT === spec.WB && spec.OFF_T === spec.OFF_B
            ? spec.WB + '×' + spec.H + '×' + spec.THK + 'T'
            : spec.WT + '/' + spec.WB + '×' + spec.H + '×' + spec.THK + 'T');
      var ncut = lastCuts.filter(function (c) { return c.PLATE === id; }).length;
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td></td>' +
        '<td><span class="chip" style="background:#' +
        ('000000' + (colors[id] || 0x999999).toString(16)).slice(-6) + '"></span>' +
        '<span class="plname" onclick="plateBuilder.preview(\'' + id + '\')">' + esc(id) + '</span>' +
        '<div class="dims">' + dims + (ncut ? ' · cuts ' + ncut : '') +
        (spec.MAT ? ' · ' + esc(spec.MAT) : '') + '</div></td>' +
        '<td></td>';
      tbl.appendChild(tr);
    });
  }

  function preview(id) {
    var spec = lastPlates[id];
    if (!spec) return;
    var modal = document.getElementById('pb-modal');
    var cv = document.getElementById('pb-pv-canvas');
    if (!modal || !cv) return;
    var g = buildPlate2D(spec, lastCuts, lastPlates);
    var pts = namedPoints(spec, false);

    var minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    g.outers.forEach(function (ring) {
      ring.forEach(function (q) {
        if (q[0] < minx) minx = q[0]; if (q[0] > maxx) maxx = q[0];
        if (q[1] < miny) miny = q[1]; if (q[1] > maxy) maxy = q[1];
      });
    });
    if (minx > maxx) { minx = miny = 0; maxx = maxy = 1; }
    var W = cv.width, H = cv.height, PAD = 46;
    var sc = Math.min((W - PAD * 2) / Math.max(maxx - minx, 1e-6),
                      (H - PAD * 2) / Math.max(maxy - miny, 1e-6));
    var ox = (W - (maxx - minx) * sc) / 2, oy = (H - (maxy - miny) * sc) / 2;
    function mx(x) { return ox + (x - minx) * sc; }
    function my(y) { return H - oy - (y - miny) * sc; }

    var ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#15181c';
    ctx.fillRect(0, 0, W, H);

    ctx.beginPath();
    g.outers.forEach(function (ring, i) {
      ring.forEach(function (q, j) { j ? ctx.lineTo(mx(q[0]), my(q[1])) : ctx.moveTo(mx(q[0]), my(q[1])); });
      ctx.closePath();
      (g.holes[i] || []).forEach(function (h) {
        h.forEach(function (q, j) { j ? ctx.lineTo(mx(q[0]), my(q[1])) : ctx.moveTo(mx(q[0]), my(q[1])); });
        ctx.closePath();
      });
    });
    var col = (lastColors && lastColors[id]) || 0x5c9bd1;
    ctx.fillStyle = '#' + ('000000' + col.toString(16)).slice(-6);
    ctx.globalAlpha = 0.35;
    ctx.fill('evenodd');
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#' + ('000000' + col.toString(16)).slice(-6);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 9 reference points with labels
    ctx.font = '10px sans-serif';
    var seen = {};
    ['pbl', 'pbc', 'pbr', 'plm', 'pcc', 'prm', 'ptl', 'ptc', 'ptr'].forEach(function (k) {
      var a = pts[k];
      if (!a) return;
      var key = a[0].toFixed(3) + ',' + a[1].toFixed(3);
      var x = mx(a[0]), y = my(a[1]);
      ctx.strokeStyle = '#f0c674';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y);
      ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4);
      ctx.stroke();
      if (!seen[key]) {
        seen[key] = [];
        ctx.fillStyle = '#f0c674';
      }
      seen[key].push(k.slice(1));
    });
    Object.keys(seen).length && ['pbl', 'pbc', 'pbr', 'plm', 'pcc', 'prm', 'ptl', 'ptc', 'ptr'].forEach(function (k) {
      var a = pts[k];
      if (!a) return;
      var key = a[0].toFixed(3) + ',' + a[1].toFixed(3);
      if (!seen[key]) return;
      var label = seen[key].join('/');
      delete seen[key];
      var x = mx(a[0]), y = my(a[1]);
      ctx.fillStyle = '#f0c674';
      ctx.fillText(label, x + 5, y - 5);
    });

    var dims = spec.SHAPE === 'CIRC'
      ? 'D' + spec.D + ' × THK ' + spec.THK
      : (spec.WT === spec.WB && spec.OFF_T === spec.OFF_B
          ? spec.WB + ' × ' + spec.H + ' × ' + spec.THK + 'T'
          : 'WT ' + spec.WT + ' / WB ' + spec.WB + ' × H ' + spec.H + ' × ' + spec.THK + 'T');
    var ncut = lastCuts.filter(function (c) { return c.PLATE === id; }).length;
    document.getElementById('pb-pv-title').textContent = id;
    document.getElementById('pb-pv-meta').innerHTML =
      esc(dims) + ' &middot; cuts ' + ncut +
      (spec.MAT ? ' &middot; ' + esc(spec.MAT) : '') +
      ' &middot; ' + (g.area * spec.THK * RHO).toFixed(3) + ' kg' +
      ' &nbsp;&nbsp;<span style="color:#5b6472">(+ = 9 reference points)</span>';
    modal.style.display = 'flex';
  }
  function closePreview() {
    var modal = document.getElementById('pb-modal');
    if (modal) modal.style.display = 'none';
  }

  /* ---------------- sidebar list ---------------- */
  function buildList(colors) {
    var tbl = document.getElementById('pb-list');
    var total = 0, lastGroup = null;
    items.forEach(function (it, i) {
      total += it.mass;
      if (it.group !== lastGroup) {
        lastGroup = it.group;
        var gtr = document.createElement('tr');
        gtr.className = 'ghead';
        gtr.innerHTML = '<td><input type="checkbox" checked ' +
          'onchange="plateBuilder.toggleGroup(\'' + it.group + '\',this.checked)"></td>' +
          '<td colspan="2">▾ ' + it.group + '</td>';
        tbl.appendChild(gtr);
      }
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><input type="checkbox" checked id="pb-cb' + i + '" ' +
        'onchange="plateBuilder.toggleItem(' + i + ',this.checked)"></td>' +
        '<td><span class="chip" style="background:#' +
        ('000000' + colors[it.plateId].toString(16)).slice(-6) + '"></span>' +
        '<span class="plname" onclick="plateBuilder.preview(\'' + it.plateId + '\')">' + it.no + '</span>' +
        '<div class="dims">' + it.dims + (it.remark ? ' · ' + it.remark : '') + '</div></td>' +
        '<td class="dims">' + it.mass.toFixed(3) + 'kg</td>';
      tbl.appendChild(tr);
    });
    document.getElementById('pb-total').textContent =
      'Parts: ' + items.length + ' · Total weight: ' + total.toFixed(1) + ' kg';
  }
  function toggleItem(i, on) { items[i].groupObj.visible = on; }
  function toggleGroup(g, on) {
    items.forEach(function (it, i) {
      if (it.group === g) {
        it.groupObj.visible = on;
        document.getElementById('pb-cb' + i).checked = on;
      }
    });
  }

  /* -------- STL export (world transforms applied) -------- */
  function exportSTL() {
    var out = 'solid plate_builder\n';
    scene.updateMatrixWorld(true);
    items.forEach(function (it) {
      if (!it.groupObj.visible) return;
      it.groupObj.traverse(function (obj) {
        if (!obj.isMesh) return;
        var pos = obj.geometry.getAttribute('position');
        if (!pos) return;
        var idx = obj.geometry.getIndex();
        var n = idx ? idx.count / 3 : pos.count / 3;
        for (var i = 0; i < n; i++) {
          var a = idx ? idx.getX(i * 3) : i * 3;
          var b = idx ? idx.getX(i * 3 + 1) : i * 3 + 1;
          var c = idx ? idx.getX(i * 3 + 2) : i * 3 + 2;
          var vA = new THREE.Vector3().fromBufferAttribute(pos, a).applyMatrix4(obj.matrixWorld);
          var vB = new THREE.Vector3().fromBufferAttribute(pos, b).applyMatrix4(obj.matrixWorld);
          var vC = new THREE.Vector3().fromBufferAttribute(pos, c).applyMatrix4(obj.matrixWorld);
          var nr = new THREE.Vector3().crossVectors(
            new THREE.Vector3().subVectors(vB, vA),
            new THREE.Vector3().subVectors(vC, vA)).normalize();
          out += ' facet normal ' + nr.x + ' ' + nr.y + ' ' + nr.z + '\n  outer loop\n' +
                 '   vertex ' + vA.x + ' ' + vA.y + ' ' + vA.z + '\n' +
                 '   vertex ' + vB.x + ' ' + vB.y + ' ' + vB.z + '\n' +
                 '   vertex ' + vC.x + ' ' + vC.y + ' ' + vC.z + '\n  endloop\n endfacet\n';
        }
      });
    });
    out += 'endsolid plate_builder\n';
    var link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([out], { type: 'application/octet-stream' }));
    link.download = 'plate_builder.stl';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  /* -------- IFC export (IFC2X3, parametric extrusions) --------
     Each visible part becomes an IfcPlate (IfcMember for bars) whose
     geometry is the exact 2D profile (with hole voids) extruded by the
     thickness — real BIM solids, not triangle meshes. */
  function exportIFC() {
    var L = [], id = 0;
    function nx(s) { id++; L.push('#' + id + '=' + s + ';'); return '#' + id; }
    function f(v) {
      v = Math.round((Number(v) || 0) * 1e6) / 1e6;
      var s = String(v);
      if (s.indexOf('.') < 0 && s.indexOf('e') < 0 && s.indexOf('E') < 0) s += '.';
      return s;
    }
    function sq(s) {                                     // SPF string with \X2\ non-ASCII encoding
      s = String(s);
      var out = '';
      for (var i = 0; i < s.length; i++) {
        var c = s.charCodeAt(i);
        if (c === 39) out += "''";
        else if (c === 92) out += '\\\\';
        else if (c >= 32 && c <= 126) out += s.charAt(i);
        else out += '\\X2\\' + ('0000' + c.toString(16).toUpperCase()).slice(-4) + '\\X0\\';
      }
      return "'" + out + "'";
    }
    var B64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
    function guid() {
      var bits = '';
      for (var i = 0; i < 16; i++) {
        var b = Math.floor(Math.random() * 256);
        bits += ('0000000' + b.toString(2)).slice(-8);
      }
      var s = B64.charAt(parseInt(bits.slice(0, 2), 2));
      for (var j = 2; j < 128; j += 6) s += B64.charAt(parseInt(bits.slice(j, j + 6), 2));
      return "'" + s + "'";
    }
    function pt2(x, y) { return nx('IFCCARTESIANPOINT((' + f(x) + ',' + f(y) + '))'); }
    function pt3(x, y, z) { return nx('IFCCARTESIANPOINT((' + f(x) + ',' + f(y) + ',' + f(z) + '))'); }
    function dir3(x, y, z) { return nx('IFCDIRECTION((' + f(x) + ',' + f(y) + ',' + f(z) + '))'); }
    function ccw(ring) { return ringArea(ring) >= 0 ? ring : ring.slice().reverse(); }
    function cw(ring) { return ringArea(ring) < 0 ? ring : ring.slice().reverse(); }
    function polyline(ring) {
      var ids = ring.map(function (p) { return pt2(p[0], p[1]); });
      ids.push(ids[0]);                                   // closed
      return nx('IFCPOLYLINE((' + ids.join(',') + '))');
    }

    var oPerson = nx("IFCPERSON($,$,'',$,$,$,$,$)");
    var oOrg = nx("IFCORGANIZATION($,'macroBIM',$,$,$)");
    var oPO = nx('IFCPERSONANDORGANIZATION(' + oPerson + ',' + oOrg + ',$)');
    var oApp = nx('IFCAPPLICATION(' + oOrg + ",'1.0','plate_builder','plate_builder')");
    var oOH = nx('IFCOWNERHISTORY(' + oPO + ',' + oApp + ',$,.NOCHANGE.,$,$,$,' +
                 Math.floor(Date.now() / 1000) + ')');
    var o0 = pt3(0, 0, 0);
    var oZ = dir3(0, 0, 1), oX = dir3(1, 0, 0);
    var oWCS = nx('IFCAXIS2PLACEMENT3D(' + o0 + ',' + oZ + ',' + oX + ')');
    var oCtx = nx("IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.0E-5," + oWCS + ',$)');
    var uLen = nx('IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.)');
    var uArea = nx('IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)');
    var uVol = nx('IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)');
    var uAng = nx('IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)');
    var oUnits = nx('IFCUNITASSIGNMENT((' + [uLen, uArea, uVol, uAng].join(',') + '))');
    var oProj = nx('IFCPROJECT(' + guid() + ',' + oOH + ",'Plate Builder',$,$,$,$,(" +
                   oCtx + '),' + oUnits + ')');
    var plSite = nx('IFCLOCALPLACEMENT($,' + oWCS + ')');
    var oSite = nx('IFCSITE(' + guid() + ',' + oOH + ",'Site',$,$," + plSite +
                   ',$,$,.ELEMENT.,$,$,$,$,$)');
    var plBld = nx('IFCLOCALPLACEMENT(' + plSite + ',' + oWCS + ')');
    var oBld = nx('IFCBUILDING(' + guid() + ',' + oOH + ",'Building',$,$," + plBld +
                  ',$,$,.ELEMENT.,$,$,$)');
    var plSt = nx('IFCLOCALPLACEMENT(' + plBld + ',' + oWCS + ')');
    var oSt = nx('IFCBUILDINGSTOREY(' + guid() + ',' + oOH + ",'Storey',$,$," + plSt +
                 ',$,$,.ELEMENT.,0.)');
    nx('IFCRELAGGREGATES(' + guid() + ',' + oOH + ',$,$,' + oProj + ',(' + oSite + '))');
    nx('IFCRELAGGREGATES(' + guid() + ',' + oOH + ',$,$,' + oSite + ',(' + oBld + '))');
    nx('IFCRELAGGREGATES(' + guid() + ',' + oOH + ',$,$,' + oBld + ',(' + oSt + '))');
    var oSolidPos = nx('IFCAXIS2PLACEMENT3D(' + o0 + ',$,$)');

    var elements = [];
    items.forEach(function (it) {
      if (!it.groupObj.visible) return;
      var m = it.matrix.elements;                         // column-major
      var loc = pt3(m[12], m[13], m[14]);
      var axis = dir3(m[8], m[9], m[10]);
      var ref = dir3(m[0], m[1], m[2]);
      var a2p = nx('IFCAXIS2PLACEMENT3D(' + loc + ',' + axis + ',' + ref + ')');
      var lp = nx('IFCLOCALPLACEMENT(' + plSt + ',' + a2p + ')');
      var solids = it.rings.outers.map(function (ring, i) {
        var holes = it.rings.holes[i] || [];
        var profile;
        if (it.spec.SHAPE === 'CIRC' && !holes.length && it.rings.outers.length === 1) {
          var p2 = nx('IFCAXIS2PLACEMENT2D(' + pt2(0, 0) + ',$)');
          profile = nx('IFCCIRCLEPROFILEDEF(.AREA.,$,' + p2 + ',' + f(num(it.spec.D, 0) / 2) + ')');
        } else {
          var outerPl = polyline(ccw(ring));
          profile = holes.length
            ? nx('IFCARBITRARYPROFILEDEFWITHVOIDS(.AREA.,$,' + outerPl + ',(' +
                 holes.map(function (h) { return polyline(cw(h)); }).join(',') + '))')
            : nx('IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,' + outerPl + ')');
        }
        return nx('IFCEXTRUDEDAREASOLID(' + profile + ',' + oSolidPos + ',' + oZ + ',' + f(it.thk) + ')');
      });
      if (!solids.length) return;
      var shape = nx('IFCSHAPEREPRESENTATION(' + oCtx + ",'Body','SweptSolid',(" + solids.join(',') + '))');
      var pds = nx('IFCPRODUCTDEFINITIONSHAPE($,$,(' + shape + '))');
      var ent = it.spec.SHAPE === 'CIRC'
        ? nx('IFCMEMBER(' + guid() + ',' + oOH + ',' + sq(it.no) + ',$,$,' + lp + ',' + pds + ',$)')
        : nx('IFCPLATE(' + guid() + ',' + oOH + ',' + sq(it.no) + ',$,$,' + lp + ',' + pds + ',$)');
      elements.push(ent);
      var pv1 = nx("IFCPROPERTYSINGLEVALUE('Material',$,IFCTEXT(" + sq(it.spec.MAT || '') + '),$)');
      var pv2 = nx("IFCPROPERTYSINGLEVALUE('Weight_kg',$,IFCREAL(" + f(it.mass) + '),$)');
      var pv3 = nx("IFCPROPERTYSINGLEVALUE('Dims',$,IFCTEXT(" + sq(it.dims) + '),$)');
      var ps = nx('IFCPROPERTYSET(' + guid() + ',' + oOH + ",'Pset_PlateBuilder',$,(" +
                  [pv1, pv2, pv3].join(',') + '))');
      nx('IFCRELDEFINESBYPROPERTIES(' + guid() + ',' + oOH + ',$,$,(' + ent + '),' + ps + ')');
    });
    if (elements.length) {
      nx('IFCRELCONTAINEDINSPATIALSTRUCTURE(' + guid() + ',' + oOH + ',$,$,(' +
         elements.join(',') + '),' + oSt + ')');
    }

    var out = 'ISO-10303-21;\nHEADER;\n' +
      "FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');\n" +
      "FILE_NAME('plate_builder.ifc','" + new Date().toISOString().slice(0, 19) +
      "',(''),('macroBIM'),'plate_builder.js','plate_builder','');\n" +
      "FILE_SCHEMA(('IFC2X3'));\nENDSEC;\nDATA;\n" +
      L.join('\n') + '\nENDSEC;\nEND-ISO-10303-21;\n';
    var link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([out], { type: 'application/octet-stream' }));
    link.download = 'plate_builder.ifc';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  /* ---------------- views ---------------- */
  function setView(v) {
    var d = VDIST;
    if (v === 'front') camera.position.set(CENTER.x, CENTER.y, CENTER.z + d);
    if (v === 'side')  camera.position.set(CENTER.x + d, CENTER.y, CENTER.z);
    if (v === 'top')   camera.position.set(CENTER.x, CENTER.y + d, CENTER.z + 0.01);
    if (v === 'iso')   camera.position.set(CENTER.x + d * 0.58, CENTER.y + d * 0.5, CENTER.z + d * 0.65);
    controls.target.copy(CENTER);
    controls.update();
  }

  /* ---------------- DOM + init ---------------- */
  function buildDOM(title, subtitle, note) {
    if (!document.getElementById('pb-style')) {
      var style = document.createElement('style');
      style.id = 'pb-style';
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    var old = document.getElementById('pb-app');
    if (old) old.parentNode.removeChild(old);
    var app = document.createElement('div');
    app.id = 'pb-app';
    app.innerHTML =
      '<div id="pb-side">' +
      '  <h1></h1><div class="sub"></div>' +
      '  <div class="btnrow">' +
      '    <button class="accent" onclick="plateBuilder.setView(\'iso\')">ISO</button>' +
      '    <button onclick="plateBuilder.setView(\'front\')">Front</button>' +
      '    <button onclick="plateBuilder.setView(\'side\')">Side</button>' +
      '    <button onclick="plateBuilder.setView(\'top\')">Top</button>' +
      '    <button onclick="plateBuilder.exportSTL()">Save STL</button>' +
      '    <button onclick="plateBuilder.exportIFC()">Save IFC</button>' +
      '    <button class="accent" onclick="plateBuilder.pickExcel()">&#8682; Load Excel</button>' +
      '    <input type="file" id="pb-file" accept=".xlsx,.xls" style="display:none">' +
      '  </div>' +
      '  <div id="pb-prog"><div id="pb-prog-label"></div>' +
      '    <div class="pb-track"><div id="pb-prog-bar"></div></div></div>' +
      '  <div id="pb-result"></div>' +
      '  <table id="pb-plates"></table>' +
      '  <table id="pb-list"></table>' +
      '  <div id="pb-total"></div>' +
      '  <div id="pb-note"></div>' +
      '</div>' +
      '<div id="pb-view"><div id="pb-hud">Drag: rotate · Wheel: zoom · Right-drag: pan</div></div>' +
      '<div id="pb-modal"><div class="box">' +
      '  <h2><span class="close" onclick="plateBuilder.closePreview()">&#10005;</span>' +
      '      <span id="pb-pv-title"></span></h2>' +
      '  <canvas id="pb-pv-canvas" width="560" height="420"></canvas>' +
      '  <div class="meta" id="pb-pv-meta"></div>' +
      '</div></div>';
    document.body.appendChild(app);
    var modal = document.getElementById('pb-modal');
    modal.addEventListener('click', function (e) { if (e.target === modal) closePreview(); });
    app.querySelector('h1').textContent = title;
    app.querySelector('.sub').textContent = subtitle;
    var noteEl = document.getElementById('pb-note');
    if (note) noteEl.textContent = note; else noteEl.style.display = 'none';
  }

  function run(data) {
    if (typeof THREE === 'undefined' || typeof PolyBool === 'undefined') {
      alert('Load the three.js and polybooljs libraries first.');
      return;
    }
    data = data || {};
    data.PLATE = data.PLATE || [[]];
    data.CUT = data.CUT || [[]];
    data.ASSY = data.ASSY || data.PLACE || [[]];   // PLACE = legacy alias
    runToken++;
    var token = runToken;
    items = [];

    var empty = data.__parsed ? !data.__parsed.assy.length : data.ASSY.length <= 1;
    buildDOM(data.title || 'Plate Builder',
             data.subtitle || 'PLATE / CUT / ASSY data · unit: mm',
             data.note || (empty
               ? 'No data. Define PLATE/CUT/ASSY arrays as window.PLATE_DATA ' +
                 'or pass them to plateBuilder.run({...}) to display a model.'
               : null));

    var container = document.getElementById('pb-view');
    var w = container.clientWidth, h = container.clientHeight;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x15181c);
    camera = new THREE.PerspectiveCamera(40, w / h, 1, 50000);
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xf4f6fa, 0x2a2d33, 0.95));
    var sun = new THREE.DirectionalLight(0xffffff, 0.75);
    sun.position.set(500, 900, 650);
    scene.add(sun);
    var back = new THREE.DirectionalLight(0x8899bb, 0.3);
    back.position.set(-600, 300, -500);
    scene.add(back);

    var colors = data.colors || {};
    var bbox = buildAll(data, colors);
    buildPlateList(colors);
    buildList(colors);

    CENTER = bbox.isEmpty() ? new THREE.Vector3(0, 150, 0) : bbox.getCenter(new THREE.Vector3());
    var size = bbox.isEmpty() ? 900 : bbox.getSize(new THREE.Vector3()).length();
    VDIST = size * 1.5 + 200;

    var grid = new THREE.GridHelper(Math.ceil(size / 400) * 800, 32, 0x39424d, 0x242a31);
    grid.position.y = -1;
    scene.add(grid);

    /* ---- mini axis gizmo, top-right corner (follows camera rotation) ---- */
    var axesScene = new THREE.Scene();
    var axesCamera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    [{ v: [1, 0, 0], c: 0xe05c4f, label: 'X' },
     { v: [0, 1, 0], c: 0x6fc36f, label: 'Y' },
     { v: [0, 0, 1], c: 0x5c9bd1, label: 'Z' }].forEach(function (d) {
      axesScene.add(new THREE.ArrowHelper(v3(d.v), new THREE.Vector3(0, 0, 0), 1.6, d.c, 0.35, 0.18));
      var cv = document.createElement('canvas');
      cv.width = cv.height = 128;
      var ctx = cv.getContext('2d');
      ctx.font = 'bold 84px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#' + ('000000' + d.c.toString(16)).slice(-6);
      ctx.fillText(d.label, 64, 68);
      var spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true }));
      spr.position.copy(v3(d.v).multiplyScalar(2.1));
      spr.scale.set(0.9, 0.9, 1);
      axesScene.add(spr);
    });

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    setView('iso');

    // Excel loading: file picker + drag & drop anywhere on the app
    var fileInput = document.getElementById('pb-file');
    fileInput.addEventListener('change', function () {
      if (fileInput.files.length) loadExcelFile(fileInput.files[0]);
    });
    var app = document.getElementById('pb-app');
    app.addEventListener('dragover', function (e) { e.preventDefault(); });
    app.addEventListener('drop', function (e) {
      e.preventDefault();
      if (e.dataTransfer.files.length) loadExcelFile(e.dataTransfer.files[0]);
    });

    window.addEventListener('resize', function () {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    });

    (function animate() {
      if (token !== runToken) return;             // stop old loop after a re-run
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);

      // gizmo: copy only the main camera orientation into a small viewport
      var gs = 110, gm = 8;
      var cw = container.clientWidth, ch = container.clientHeight;
      axesCamera.position.copy(camera.position).sub(controls.target).normalize().multiplyScalar(8.4);
      axesCamera.up.copy(camera.up);
      axesCamera.lookAt(0, 0, 0);
      renderer.autoClear = false;
      renderer.setScissorTest(true);
      renderer.setViewport(cw - gs - gm, ch - gs - gm, gs, gs);
      renderer.setScissor(cw - gs - gm, ch - gs - gm, gs, gs);
      renderer.clearDepth();
      renderer.render(axesScene, axesCamera);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, cw, ch);
      renderer.autoClear = true;
    })();
  }

  function pickExcel() {
    var el = document.getElementById('pb-file');
    if (el) el.click();
  }

  window.plateBuilder = {
    run: run, setView: setView, exportSTL: exportSTL, exportIFC: exportIFC,
    toggleItem: toggleItem, toggleGroup: toggleGroup,
    pickExcel: pickExcel, loadExcelFile: loadExcelFile,
    preview: preview, closePreview: closePreview
  };

  /* ---- auto-run: use window.PLATE_DATA if present, else empty default.
     Skipped when plateBuilder.run() was already called directly. ---- */
  function autorun() { if (!runToken) run(window.PLATE_DATA || {}); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autorun);
  } else {
    setTimeout(autorun, 0);
  }
})();
