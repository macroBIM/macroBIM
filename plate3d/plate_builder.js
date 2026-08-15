/* ============================================================
   plate_builder.js — PLATE3D, a plate assembly 3D engine driven by
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

   · World is Z-up (X east, Y north, Z up), matching IFC/AutoCAD/Revit/Tekla.
     Plane names say which world axes a plate's local x,y run along:
       XY -> horizontal, thickness +Z   XZ -> front elevation, thickness -Y
       YZ -> side elevation, thickness +X
     A sheet written for the old Y-up engine keeps working with a "COORD YUP"
     row before its MODULE/ASSY rows - it is laid out in the old frame and the
     finished model is turned upright once.
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
   · 9 points: tl tc tr / ml mc mr / bl bc br
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
    '#pb-side td { padding:4px 2px; border-bottom:1px solid #23272e;',
    '  vertical-align:middle; color:#d8dce2; }',
    // section title (PLATES / MODULES / ASSEMBLY) - always visible
    '#pb-side tr.ghead td { color:#f0c674; font-size:11px; font-weight:600;',
    '  letter-spacing:.4px; padding-top:12px; border-bottom:1px solid #3a424d; }',
    // group header inside the assembly list
    '#pb-side tr.gsub td { color:#cdd6e2; font-size:12px; padding-top:9px;',
    '  border-bottom:1px solid #2c323b; }',
    '#pb-side .gname { color:#eef1f6; font-size:13px; }',
    '#pb-side .plname.subname { color:#aab4c2; font-size:11px; }',
    '#pb-side tr.none td { color:#6b7480; font-size:11px; font-style:italic; }',
    '#pb-side .chip { display:inline-block; width:11px; height:11px; border-radius:2px;',
    '  margin-right:5px; vertical-align:-1px; }',
    '#pb-side .sw { display:inline-block; width:17px; height:17px; border:1px solid #3a424d;',
    '  border-radius:3px; cursor:pointer; vertical-align:middle; }',
    '#pb-side .sw:hover { border-color:#8a93a0; }',
    '#pb-pal { display:none; position:fixed; z-index:60; grid-template-columns:repeat(4,20px);',
    '  gap:4px; padding:7px; background:#22262d; border:1px solid #3a424d; border-radius:6px;',
    '  box-shadow:0 6px 20px rgba(0,0,0,.5); }',
    '#pb-pal i { width:20px; height:20px; border-radius:3px; cursor:pointer;',
    '  border:1px solid rgba(255,255,255,.15); display:block; }',
    '#pb-pal i:hover { outline:2px solid #6fb3e8; }',
    '#pb-side input[type=range] { width:42px; height:12px; vertical-align:middle;',
    '  margin-left:4px; accent-color:#3a76ad; cursor:pointer; }',
    '#pb-side td.sty { white-space:nowrap; width:70px; }',
    '#pb-side .caret { color:#8a93a0; cursor:pointer; font-size:10px; }',
    '#pb-side .caret:hover { color:#d8dce2; }',
    '#pb-side .dims { color:#8a93a0; font-size:11px; }',
    // BARS: a plain read-only table, so its rows are tighter than the click lists
    '#pb-bars { display:none; }',
    '#pb-side tr.chead td { color:#6b7480; font-size:10px; letter-spacing:.5px;',
    '  padding:3px 6px 3px 2px; border-bottom:1px solid #2c323b; }',
    '#pb-bars td { padding:3px 6px 3px 2px; font-size:12px; }',
    '#pb-side td.num { text-align:right; white-space:nowrap; color:#cdd6e2; }',
    '#pb-side td.bid { color:#eef1f6; }',
    '#pb-side td.mat { color:#8a93a0; font-size:11px; white-space:nowrap; }',
    '#pb-side .chk { display:flex; align-items:center; gap:4px; font-size:12px;',
    '  color:#8a93a0; cursor:pointer; padding:5px 6px; border:1px solid #3a424d;',
    '  border-radius:4px; }',
    '#pb-side .chk:hover { color:#d8dce2; }',
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
    '#pb-meas-out { position:absolute; left:10px; top:8px; font-size:12px; color:#8a93a0;',
    '  background:rgba(21,24,28,.82); border:1px solid #2c323b; border-radius:4px;',
    '  padding:5px 9px; pointer-events:none; display:none; }',
    '#pb-side .plname { color:#eef1f6; cursor:pointer; }',
    '#pb-side .plname:hover { color:#6fb3e8; text-decoration:underline; }',
    '#pb-modal { position:fixed; left:0; top:0; right:0; bottom:0; background:rgba(0,0,0,.35);',
    '  display:none; z-index:50; align-items:center; justify-content:center;',
    '  pointer-events:none; }',
    '#pb-modal .box { pointer-events:auto; background:#1c2026; border:1px solid #3a424d;',
    '  border-radius:8px; max-width:97vw; max-height:96vh; overflow:auto;',
    '  padding:14px; box-shadow:0 8px 30px rgba(0,0,0,.5); }',
    '#pb-modal h2 { font-size:14px; color:#fff; margin:0 0 8px; }',
    '#pb-modal .close { float:right; cursor:pointer; color:#8a93a0; padding:0 4px; }',
    '#pb-modal .pvchk { float:right; font-size:11px; font-weight:normal; color:#8a93a0;',
    '  cursor:pointer; margin-right:12px; display:flex; align-items:center; gap:4px; }',
    '#pb-modal .pvchk:hover { color:#d8dce2; }',
    '#pb-modal .pvbtn { float:right; margin-right:8px; background:#2a3038; color:#d8dce2;',
    '  border:1px solid #3a424d; border-radius:4px; padding:2px 9px; font-size:11px;',
    '  cursor:pointer; }',
    '#pb-modal .pvbtn:hover { background:#39424d; }',
    '#pb-modal .close:hover { color:#fff; }',
    '#pb-modal canvas { background:#15181c; border:1px solid #2c323b; border-radius:4px;',
    '  display:block; cursor:crosshair; }',
    '#pb-modal .meta { color:#8a93a0; font-size:11px; margin-top:8px; }',
    '#pb-modal .pvbody { display:flex; gap:10px; align-items:flex-start; }',
    '#pb-pv-tree { display:none; width:196px; max-height:542px; overflow-y:auto;',
    '  background:#191d23; border:1px solid #2c323b; border-radius:4px; padding:6px 4px; }',
    '#pb-pv-tree table { width:100%; border-collapse:collapse; }',
    '#pb-pv-tree td { padding:3px 2px; vertical-align:middle; color:#d8dce2;',
    '  border-bottom:1px solid #22262d; }',
    '#pb-pv-tree tr.thead td { color:#f0c674; font-size:10px; font-weight:600;',
    '  letter-spacing:.4px; padding-bottom:5px; border-bottom:1px solid #3a424d; }',
    '#pb-pv-tree tr.off td { opacity:.4; }',
    '#pb-pv-tree .nm { font-size:11px; color:#eef1f6; }',
    '#pb-pv-tree .dims { color:#8a93a0; font-size:10px; }',
    '#pb-pv-tree input[type=range] { width:38px; height:11px; vertical-align:middle;',
    '  accent-color:#3a76ad; cursor:pointer; }',
    '#pb-pv-tree input[type=checkbox] { margin:0 3px 0 0; vertical-align:middle; }',
    '#pb-pv-tree .sw { display:inline-block; width:12px; height:12px; border:1px solid #3a424d;',
    '  border-radius:2px; cursor:pointer; vertical-align:middle; margin-right:3px; }'
  ].join('\n');

  var onResize = null;                  // the one live window-resize handler
  var flatMode = false;                 // draw plates as surfaces (no thickness)
  var showAxes = false;                 // local axes on every placed plate
  var showFaces = false;                // +/- face tint, main view
  var showIds = false;                  // plate id labels, main view
  var showFacesPv = false, showIdsPv = false;   // the same two, module preview
  var measMain = null, measPv = null;     // measure tools, one per view
  var showMeasure = false, measurePv = false;
  var sceneSize = 900;                   // model size, for scaling helpers                // tint the +/- faces of every plate
  var memberAxes = {};                  // 'MODULE/POS' -> show local axes in the preview
  var memberHidden = {};                // 'MODULE/POS' -> hidden in the module preview
  var pvTreeId = null;                  // module the preview panel is currently listing
  var pvMemberObj = {};                 // 'MODULE/POS' -> its group in the open preview
  // appearance overrides, kept across reloads: instance > module > plate
  var ovColor = { plate: {}, module: {}, item: {} };
  var modColors = {};                   // auto colour per MODULE (the assembly view uses it)
  // opacity scopes, most specific first: item > member > group > module > plate
  var ovOpac = { plate: {}, module: {}, group: {}, inst: {}, member: {}, item: {} };
  var SWATCHES = ['#e05c4f', '#ef8b3c', '#f0c674', '#d4b13e',
                  '#8ec96b', '#4caf50', '#2f9e8f', '#4dd0e1',
                  '#5c9bd1', '#3f6fb5', '#9575cd', '#c47ad0',
                  '#f06292', '#8d6e63', '#c9cdd3', '#6b7480'];
  var palPending = null;
  function openPalette(ev, scope, key, el) {
    ev.stopPropagation();
    var pal = document.getElementById('pb-pal');
    if (!pal) return;
    palPending = { scope: scope, key: key, el: el };
    pal.style.display = 'grid';
    var w = 4 * 24 + 14, h = 4 * 24 + 14;
    pal.style.left = Math.min(window.innerWidth - w - 8, ev.clientX - 10) + 'px';
    pal.style.top = Math.min(window.innerHeight - h - 8, ev.clientY + 14) + 'px';
  }
  function pickColor(hex) {
    if (!palPending) return;
    setColor(palPending.scope, palPending.key, hex);
    if (palPending.el) palPending.el.style.background = hex;
    closePalette();
  }
  function closePalette() {
    palPending = null;
    var pal = document.getElementById('pb-pal');
    if (pal) pal.style.display = 'none';
  }
  function hex2int(h) { return parseInt(String(h).replace('#', ''), 16); }
  function int2hex(v) { return '#' + ('000000' + (v >>> 0).toString(16)).slice(-6); }
  // A module is one colour in the assembly view - its plates' own colours only
  // show inside the module preview, where the module colour is not applied.
  function moduleColor(id) {
    if (ovColor.module[id] !== undefined) return ovColor.module[id];
    return modColors[id] !== undefined ? modColors[id] : 0x9aa3b0;
  }
  function resolveColor(o, base) {
    if (o.no && ovColor.item[o.no] !== undefined) return ovColor.item[o.no];
    if (o.moduleId) return moduleColor(o.moduleId);
    if (o.plateId && ovColor.plate[o.plateId] !== undefined) return ovColor.plate[o.plateId];
    return base;
  }
  function resolveOpac(o) {
    if (o.no && ovOpac.item[o.no] !== undefined) return ovOpac.item[o.no];
    if (o.memberKey && ovOpac.member[o.memberKey] !== undefined) return ovOpac.member[o.memberKey];
    if (o.instKey && ovOpac.inst[o.instKey] !== undefined) return ovOpac.inst[o.instKey];
    if (o.group && ovOpac.group[o.group] !== undefined) return ovOpac.group[o.group];
    if (o.moduleId && ovOpac.module[o.moduleId] !== undefined) return ovOpac.module[o.moduleId];
    if (o.plateId && ovOpac.plate[o.plateId] !== undefined) return ovOpac.plate[o.plateId];
    return 1;
  }
  function plateGeom(shape, thk) {      // local plane = mid-thickness
    if (flatMode) return new THREE.ShapeGeometry(shape);
    var g = new THREE.ExtrudeGeometry(shape, { depth: thk, bevelEnabled: false, curveSegments: 24 });
    g.translate(0, 0, -thk / 2);
    return g;
  }
  var scene, camera, renderer, controls;
  var lastPlates = {}, lastCuts = [], lastColors = {}, lastParts = {};  // for preview modals
  var shapeLib = {};        // HOLE definitions - cut shapes, never members
  var pvToken = 0, pvRenderer = null, pvModuleId = null;   // 3D preview lifecycle
  var pvCtrl = null, pvScene = null, pvHome = null;   // pvHome = the preview's opening view
  var pvX = null, pvPts = [], pvBase = null, pv = null;   // 2D preview state
  var pvMeas = [];                                       // 2D measure picks
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
  function isNum(v) { return str(v) !== '' && isFinite(Number(v)); }

  /* ================================================================
     Excel loader — single-sheet keyword grammar (ExcelJS required):
       · first char '#' or '!'  → comment row (ignored)
       · rows are read until an END keyword row
       · keywords/IDs/planes/points are case-insensitive (uppercased)
       PLATE ID MAT THK TRAP BASE.pt WB WT H OFF_T
       PLATE ID MAT THK RECT BASE.pt B H
       PLATE ID MAT THK CIRC BASE.pt D
                                              (a physical member: mass, colour, IFC
                                               and STL all come from these rows)
       HOLE  ID TRAP BASE.pt WB WT H OFF_T
       HOLE  ID RECT BASE.pt B H
       HOLE  ID CIRC BASE.pt D
                                              (a reusable 2D cut shape - no thickness,
                                               no material, never becomes a solid.
                                               Referenced by CUT rows)
                                              (the shape keyword sits in a fixed column,
                                               so the values after it can differ in
                                               count without moving anything)
                                              (BASE.pt = which of the 9 named points is
                                               the shape's own origin (0,0). Blank -> bc
                                               for a plate, mc for a circle or a HOLE)
       BAR   ID MAT Dia Length                (straight round bar. Listed in its own
                                               BARS table on the left - id, diameter,
                                               length, material - and placed by MODULE
                                               and ASSY rows like any other member.
                                               The older "ID Dia Length" order is still
                                               read)
       CUT   plateID L.X L.Y shapeID dx dy repeat
                                              (put shapeID - a HOLE, or another PLATE's
                                               outline - on the plate at L.X/L.Y, both
                                               measured from the plate's own origin.
                                               The shape lands by its BASE.pt)
                                              (repeat = extra copies, each offset by
                                               dx,dy from the previous one; 0/blank = none)
                                              (the target plate must already be defined;
                                               the shape may be defined anywhere)
       -- older CUT rows, shape and its values last, are still read:
          CUT [plateID] [refPt] L.X L.Y dx dy repeat  RECT B H | CIRC D | PLATE ID
          (those place the shape by its centre)
       -- older still, shape first:
          CUT [plateID] [refPt] RECT B H L.X L.Y L.ROT dx dy repeat
          (those place RECT/PLATE by their lower-left corner)
       -- legacy PLATE rows with no shape keyword are still read, the shape
          taken from the values:  PLATE ID WT WB H OFF_TOP [OFF_B] THK MAT
                                  PLATE ID B H THK MAT
       MODULE ID PLATE.ID REF.PT L.X L.Y L.Z PLANE [ROT.X ROT.Y ROT.Z]
                                              (one row per member: the plate's
                                               REF.PT lands on module-local L.X/L.Y/L.Z,
                                               PLANE is the plane it lies on and ROT.X/Y/Z
                                               spin it about that point. Rows with the
                                               same module ID accumulate; PART = alias.
                                               Legacy order PLANE REF.PT L.X L.Y L.ROT
                                               OFFSET is still read - detected from
                                               whether column 3 is a plane name)
       MODULE ID BASE INSTANCE POINT          (module reference point = one of the
                                               9 points of a member plate;
                                               missing BASE -> warning + local origin)
       -- a BAR member leaves REF.PT blank: a bar is always held by the centre of
          its starting face and grows along the plane's thickness axis, so a bar
          on XY at 0,0,0 runs from z=0 up to z=Length
       -- REF.PT face suffix: bc = mid-thickness (default), bc+ / bc- = the plus /
          minus face of the plate. OFFSET is then measured to that face, so drawing
          dimensions can be typed as-is instead of adding +/-THK/2. Works on MODULE
          member rows, MODULE BASE, POS, BASE and ASSY rows.
       -- block style also accepted: a bare "MODULE ID" row followed by
          POS ID PLANE REF.PT L.X L.Y L.ROT OFFSET  and  BASE INSTANCE POINT rows
       COORD ZUP | YUP                       (default ZUP; YUP reads the sheet in the
                                               old Y-up frame - put it above MODULE/ASSY)
       ASSY  ID SOURCE ADD  G.X G.Y G.Z [ROT.X ROT.Y ROT.Z]
                                              (ID = the assembly being created, SOURCE =
                                               the MODULE, PLATE or earlier ASSY it is
                                               built from. Its reference point - a
                                               module's BASE, a plate's bc, an assembly's
                                               own origin - lands on global G.X/G.Y/G.Z,
                                               then ROT.X/Y/Z about that point)
       ASSY  ID SOURCE MIR  G.X G.Y G.Z PLANE (reflect SOURCE where it stands, about the
                                               XY / YZ / XZ plane through G.X/G.Y/G.Z.
                                               One result, so it takes ID as it is)
       ASSY  ID SOURCE COPY d.X d.Y d.Z repeat
                                              (repeat extra copies of SOURCE, each one
                                               d.X/d.Y/d.Z further on, named ID.001,
                                               ID.002, ... in the order they are made)
       ASSY  ID SOURCE ROT  C.X C.Y C.Z AXIS angle repeat
                                              (radial array: repeat extra copies of
                                               SOURCE, each turned another `angle` degrees
                                               about the world X/Y/Z axis through the
                                               absolute centre C.X/C.Y/C.Z. Named
                                               ID.001, ID.002, ...)
                                              (the command column may be left out, in
                                               which case the row is read as ADD)
       ASSY  ID PLANE REF.PT L.X L.Y L.ROT OFFSET    (legacy order, still read: assemble a
                                               MODULE or a PLATE. REF.PT for modules:
                                               blank/O = BASE point, 9-point name =
                                               module bbox point, INSTANCE.POINT =
                                               explicit plate point)
       END
     ================================================================ */
  // World is Z-up (X east, Y north, Z up) like IFC/AutoCAD/Revit/Tekla, so the
  // plane name says which two world axes the plate's local x,y run along.
  var PLANE_ALIAS = { XY: 'PLAN', XZ: 'FRONT', YZ: 'SIDE',
                      PLAN: 'PLAN', FRONT: 'FRONT', SIDE: 'SIDE' };
  // sheets written for the old Y-up engine, where XY was the vertical front
  // plane and XZ the horizontal one - reachable with a "COORD YUP" row
  var PLANE_ALIAS_YUP = { XY: 'FRONT', YZ: 'SIDE', XZ: 'PLAN',
                          PLAN: 'PLAN', FRONT: 'FRONT', SIDE: 'SIDE' };
  // 9 named points, t/m/b (top/middle/bottom) x l/c/r (left/centre/right):
  //     tl tc tr
  //     ml mc mr
  //     bl bc br
  // On a trapezoid ml/mr are the midpoints of the sloped sides. A circle has
  // only five - tc ml mc mr bc - and its corner names fall back to tc / bc.
  var POINT_ALIAS = { TL: 'tl', TC: 'tc', TR: 'tr',
                      ML: 'ml', MC: 'mc', MR: 'mr',
                      BL: 'bl', BC: 'bc', BR: 'br',
                      LM: 'ml', CC: 'mc', RM: 'mr' };   // pre-rename spellings
  var POINT_KEYS = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'];
  function knownPoint(s) {
    var up = str(s).toUpperCase().replace(/[+\-]$/, '').trim();
    if (up.length === 3 && up.charAt(0) === 'P') up = up.slice(1);
    return !!POINT_ALIAS[up];
  }
  function normPoint(s) {
    var up = str(s).toUpperCase().replace(/[+\-]$/, '').trim();
    if (up.length === 3 && up.charAt(0) === 'P') up = up.slice(1);   // legacy pbl, pcc, ...
    return POINT_ALIAS[up] || 'bl';
  }
  function isShapeKw(x) {
    var u = str(x).toUpperCase();
    return u === 'TRAP' || u === 'RECT' || u === 'CIRC';
  }
  // a trailing + / - on a ref-point name measures from that face of the plate
  // instead of from mid-thickness:  bc = centre, bc+ = plus face, bc- = minus face
  function faceOf(s) {
    var c = str(s).slice(-1);
    return c === '+' ? 1 : c === '-' ? -1 : 0;
  }
  function faceMark(f) { return f > 0 ? '+' : f < 0 ? '\u2212' : ''; }
  // the plane name as the sheet wrote it (XY / XZ / YZ), not the internal role
  function planeLabel(role) {
    var map = yupSheet ? PLANE_ALIAS_YUP : PLANE_ALIAS, k = ['XY', 'XZ', 'YZ'];
    for (var i = 0; i < k.length; i++) if (map[k[i]] === role) return k[i];
    return role;
  }
  function memberDesc(row) {                    // one module member, for the preview panel
    var t = (row.PL_IN || planeLabel(row.PLANE)) + ' \u00b7 ' +
            (row.__bar ? 'start' : row.REFPT + faceMark(row.FACE)) + ' \u00b7 ';
    t += row.__xyz ? '(' + row.LX + ', ' + row.LY + ', ' + row.LZ + ')'
                   : 'off ' + row.OFFSET;
    var rot = row.__xyz ? [row.RX, row.RY, row.RZ] : [0, 0, row.ROT];
    if (rot[0] || rot[1] || rot[2]) t += ' \u00b7 rot ' + rot.join('/');
    return t;
  }

  function parseExcelRows(rows) {
    var plates = {}, holes = {}, parts = {}, cuts = [], assy = [], log = [];
    var assyIds = {};                    // ASSY ids already defined (can be referenced again)
    function uniqueAssyId(id) {          // a repeated id gets -2, -3, ...
      counter[id] = (counter[id] || 0) + 1;
      return counter[id] > 1 ? id + '-' + counter[id] : id;
    }
    var assySeq = {};                    // ID given to COPY/ROT -> results numbered so far
    function seqAssyId(base) {           // ID.001, ID.002, ... in the order they are made
      assySeq[base] = (assySeq[base] || 0) + 1;
      return uniqueAssyId(base + '.' + ('000' + assySeq[base]).slice(-3));
    }
    var palias = PLANE_ALIAS, yup = false;   // switched by a COORD row
    var counts = { plate: 0, hole: 0, bar: 0, cut: 0, module: 0, assy: 0 };
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

      if (kw === 'PLATE' || kw === 'HOLE') {
        var id = str(v[0]).toUpperCase();
        if (!id) continue;
        var isHole = kw === 'HOLE';
        var spec;
        // Current grammar - the shape keyword sits in a fixed column, so the
        // parameters after it can differ in count without moving anything:
        //   PLATE ID MAT THK <shape> BASE.pt <params>
        //   HOLE  ID         <shape> BASE.pt <params>
        var si = isHole ? 1 : 3;              // column holding TRAP/RECT/CIRC
        if (isShapeKw(v[si])) {
          var sk = str(v[si]).toUpperCase(), w = v.slice(si + 2);
          spec = { ID: id, MAT: isHole ? '' : str(v[1]),
                   THK: isHole ? 0 : num(v[2], 10), __hole: isHole };
          if (sk === 'TRAP') {                // WB WT H OFF_T
            spec.SHAPE = 'TRAP'; spec.WB = num(w[0], 0); spec.WT = num(w[1], 0);
            spec.H = num(w[2], 0); spec.OFF_T = num(w[3], 0); spec.OFF_B = 0;
          } else if (sk === 'RECT') {         // B H
            var rb = num(w[0], 0);
            spec.SHAPE = 'TRAP'; spec.WB = rb; spec.WT = rb;
            spec.H = num(w[1], 0); spec.OFF_T = 0; spec.OFF_B = 0;
          } else {                            // CIRC D
            spec.SHAPE = 'CIRC'; spec.D = num(w[0], 0);
          }
          var bp = str(v[si + 1]);
          if (bp && !knownPoint(bp)) {
            warn('row ' + (r + 1) + ': ' + kw + ' ' + id + ' — unknown BASE.pt "' + bp +
                 '" (use tl/tc/tr, ml/mc/mr, bl/bc/br' +
                 (spec.SHAPE === 'CIRC' ? '; a circle has only tc ml mc mr bc' : '') + ')');
          }
          spec.BASEPT = bp ? normPoint(bp) : defaultBase(spec);
          if (isHole) {
            if (plates[id]) warn('row ' + (r + 1) + ': HOLE ' + id + ' reuses a PLATE id');
            holes[id] = spec;
            counts.hole++;
            continue;
          }
          if (holes[id]) warn('row ' + (r + 1) + ': PLATE ' + id + ' reuses a HOLE id');
          plates[id] = spec;
          current = id;
          counts.plate++;
          continue;
        }
        if (isHole) {
          warn('row ' + (r + 1) + ': HOLE ' + id + ' — expected TRAP / RECT / CIRC in ' +
               'column 3, found ' + (str(v[1]) || '(blank)'));
          continue;
        }
        // legacy PLATE rows: no shape keyword, so it is read from the values
        // (a rectangle has MAT (text) where a trapezoid has OFF_TOP (number))
        if (isNum(v[4])) {
          if (isNum(v[6])) {              // ID WT WB H OFF_T OFF_B THK MAT
            spec = { ID: id, SHAPE: 'TRAP', WT: num(v[1], 0), WB: num(v[2], 0),
                     H: num(v[3], 0), OFF_T: num(v[4], 0), OFF_B: num(v[5], 0),
                     THK: num(v[6], 10), MAT: str(v[7]) };
          } else {                        // ID WT WB H OFF_TOP THK MAT
            spec = { ID: id, SHAPE: 'TRAP', WT: num(v[1], 0), WB: num(v[2], 0),
                     H: num(v[3], 0), OFF_T: num(v[4], 0), OFF_B: 0,
                     THK: num(v[5], 10), MAT: str(v[6]) };
          }
        } else {                          // ID B H THK MAT
          var b = num(v[1], 0);
          spec = { ID: id, SHAPE: 'TRAP', WT: b, WB: b, H: num(v[2], 0),
                   OFF_T: 0, OFF_B: 0, THK: num(v[3], 10), MAT: str(v[4]) };
        }
        plates[id] = spec;
        current = id;
        counts.plate++;
      } else if (kw === 'BAR') {          // ID MAT Dia Length → round bar
        var idb = str(v[0]).toUpperCase();
        if (!idb) continue;
        // MAT sits in column 3 like it does on a PLATE row; the older
        // "ID Dia Length" order has Dia - a number - there instead. A blank
        // cell is a bar with no material, not a bar with no diameter.
        var bNew = !isNum(v[1]);
        plates[idb] = { ID: idb, SHAPE: 'CIRC', __bar: true, BASEPT: 'mc',
                        MAT: bNew ? str(v[1]) : str(v[3]),
                        D:   num(bNew ? v[2] : v[1], 0),
                        THK: num(bNew ? v[3] : v[2], 0) };
        if (holes[idb]) warn('row ' + (r + 1) + ': BAR ' + idb + ' reuses a HOLE id');
        current = idb;
        counts.bar++;
      } else if (kw === 'CUT') {          // CUT [plateID] [refPt] TYPE ...
        function isCutType(x) { return x === 'RECT' || x === 'CIRC' || x === 'PLATE'; }
        var sub = str(v[0]).toUpperCase();
        var target = current, refpt = 'bc';    // default = plate local origin
        if (!isCutType(sub)) {
          var tp = resolvePlate(sub);     // 2nd cell = target plate
          if (tp) { target = tp; v = v.slice(1); sub = str(v[0]).toUpperCase(); }
        }
        if (!isCutType(sub) && !isNum(sub)) {   // 3rd cell = reference point
          refpt = normPoint(sub);
          v = v.slice(1);
          sub = str(v[0]).toUpperCase();
        }
        if (!target) { warn('row ' + (r + 1) + ': CUT before any PLATE'); continue; }
        var c = { PLATE: target, REFPT: refpt, __xlCut: true };
        // Current grammar: CUT <plate> L.X L.Y <shape id> dx dy repeat.
        // The shape is a HOLE (or another PLATE) defined elsewhere, so the row
        // is a fixed width. L.X/L.Y are measured from the plate's own origin -
        // its BASE.pt - and the shape is placed by its BASE.pt.
        if (!isCutType(sub) && str(v[2]) !== '' && !isNum(v[2])) {
          c.U = num(v[0], 0); c.V = num(v[1], 0);
          c.TYPE = 'REF'; c.REF = str(v[2]).toUpperCase();
          c.DX = num(v[3], 0); c.DY = num(v[4], 0); c.REP = num(v[5], 0);
          c.ANG = 0; c.__org = true;
          if ((c.DX || c.DY) && c.REP < 1) {
            warn('row ' + (r + 1) + ': CUT on ' + target + ' has dx/dy but repeat is 0/empty' +
                 ' — no copy is made (repeat = how many extra copies)');
          }
          cuts.push(c);
          counts.cut++;
          continue;
        }
        if (!isCutType(sub)) {
          // L.X L.Y dx dy repeat come first, so the shape values that follow can
          // vary in count without moving anything. Shapes sit on their centre.
          c.U = num(v[0], 0); c.V = num(v[1], 0);
          c.DX = num(v[2], 0); c.DY = num(v[3], 0); c.REP = num(v[4], 0);
          c.__ctr = true;
          var ct = str(v[5]).toUpperCase();
          c.ANG = 0;                          // no rotation column for now
          if (ct === 'RECT') {
            c.TYPE = 'TRAP'; c.B = num(v[6], 0); c.TW = c.B; c.H = num(v[7], 0); c.OF = 0;
          } else if (ct === 'CIRC') {
            c.TYPE = 'CIRC'; c.D = num(v[6], 0);
          } else if (ct === 'PLATE') {
            c.TYPE = 'REF'; c.REF = str(v[6]).toUpperCase();
          } else {
            warn('row ' + (r + 1) + ': CUT on ' + target + ' — expected RECT / CIRC / PLATE' +
                 ' after L.X, L.Y, dx, dy, repeat, found ' + (str(v[5]) || '(blank)'));
            continue;
          }
          if ((c.DX || c.DY) && c.REP < 1) {
            warn('row ' + (r + 1) + ': CUT on ' + target + ' has dx/dy but repeat is 0/empty' +
                 ' — no copy is made (repeat = how many extra copies)');
          }
          cuts.push(c);
          counts.cut++;
          continue;
        }
        if (sub === 'RECT') {
          c.TYPE = 'TRAP'; c.B = num(v[1], 0); c.TW = c.B; c.H = num(v[2], 0); c.OF = 0;
          c.U = num(v[3], 0); c.V = num(v[4], 0); c.ANG = num(v[5], 0);
          c.DX = num(v[6], 0); c.DY = num(v[7], 0); c.REP = num(v[8], 0);
        } else if (sub === 'CIRC') {
          c.TYPE = 'CIRC'; c.D = num(v[1], 0);
          c.U = num(v[2], 0); c.V = num(v[3], 0); c.ANG = num(v[4], 0);
          c.DX = num(v[5], 0); c.DY = num(v[6], 0); c.REP = num(v[7], 0);
        } else if (sub === 'PLATE') {
          c.TYPE = 'REF'; c.REF = str(v[1]).toUpperCase();
          c.U = num(v[2], 0); c.V = num(v[3], 0); c.ANG = num(v[4], 0);
          c.DX = num(v[5], 0); c.DY = num(v[6], 0); c.REP = num(v[7], 0);
        } else { warn('row ' + (r + 1) + ': unknown CUT type ' + sub); continue; }
        if ((num(c.DX, 0) || num(c.DY, 0)) && num(c.REP, 0) < 1) {
          warn('row ' + (r + 1) + ': CUT on ' + target + ' has dx/dy but repeat is 0/empty' +
               ' — no copy is made. Check the column alignment (CIRC/PLATE rows have one ' +
               'parameter less than RECT, so dx/dy/repeat shift one column left)');
        }
        cuts.push(c);
        counts.cut++;
      } else if (kw === 'COORD') {        // COORD ZUP (default) | YUP — frame the sheet is written in
        yup = str(v[0]).toUpperCase() === 'YUP';
        palias = yup ? PLANE_ALIAS_YUP : PLANE_ALIAS;
      } else if (kw === 'MODULE' || kw === 'PART') {   // module row (PART = legacy alias)
        var partId = str(v[0]).toUpperCase();
        if (!partId) { warn('row ' + (r + 1) + ': MODULE without ID'); continue; }
        if (!parts[partId]) { parts[partId] = { ID: partId, pos: [], base: null }; counts.module++; }
        currentPart = parts[partId];
        if (v.length <= 1) continue;      // block style: POS/BASE rows follow
        var msub = str(v[1]).toUpperCase();
        if (msub === 'BASE') {            // MODULE id BASE <instance> <point>
          currentPart.base = { inst: str(v[2]).toUpperCase(), pt: normPoint(v[3]),
                               face: faceOf(v[3]) };
          continue;
        }
        var mplate = resolvePlate(msub);
        if (!mplate) { warn('row ' + (r + 1) + ': MODULE row with undefined plate ' + msub); continue; }
        if (palias[str(v[2]).toUpperCase()]) {   // legacy: <plate> PLANE Ref.Pt L.X L.Y L.ROT OFFSET
          currentPart.pos.push({ NO: msub, PLATE: mplate, PLANE: palias[str(v[2]).toUpperCase()],
                                 PL_IN: str(v[2]).toUpperCase(), __bar: !!plates[mplate].__bar,
                                 REFPT: normPoint(v[3]), FACE: faceOf(v[3]),
                                 LX: num(v[4], 0), LY: num(v[5], 0),
                                 ROT: num(v[6], 0), OFFSET: num(v[7], 0) });
          continue;
        }
        // <plate> Ref.Pt L.X L.Y L.Z PLANE [ROT.X ROT.Y ROT.Z]
        var mplane = str(v[6]).toUpperCase();
        if (!palias[mplane]) {
          warn('row ' + (r + 1) + ': unknown PLANE ' + (str(v[6]) || '(blank)') +
               ' (use XY/YZ/XZ — column order is plate, Ref.Pt, L.X, L.Y, L.Z, PLANE)');
          continue;
        }
        currentPart.pos.push({ __xyz: true, NO: msub, PLATE: mplate, PLANE: palias[mplane],
                               PL_IN: mplane, __bar: !!plates[mplate].__bar,
                               REFPT: normPoint(v[2]), FACE: faceOf(v[2]),
                               LX: num(v[3], 0), LY: num(v[4], 0), LZ: num(v[5], 0),
                               RX: num(v[7], 0), RY: num(v[8], 0), RZ: num(v[9], 0) });
      } else if (kw === 'POS') {          // place a plate inside the current part
        if (!currentPart) { warn('row ' + (r + 1) + ': POS outside of a MODULE'); continue; }
        var ppid = str(v[0]).toUpperCase();
        var pplate = resolvePlate(ppid);
        if (!pplate) { warn('row ' + (r + 1) + ': POS of undefined plate ' + ppid); continue; }
        var pplane = str(v[1]).toUpperCase();
        if (!palias[pplane]) { warn('row ' + (r + 1) + ': unknown PLANE ' + pplane + ' (use XY/YZ/XZ)'); continue; }
        currentPart.pos.push({ NO: ppid, PLATE: pplate, PLANE: palias[pplane],
                               PL_IN: pplane, __bar: !!plates[pplate].__bar,
                               REFPT: normPoint(v[2]), FACE: faceOf(v[2]),
                               LX: num(v[3], 0), LY: num(v[4], 0),
                               ROT: num(v[5], 0), OFFSET: num(v[6], 0) });
      } else if (kw === 'BASE') {         // BASE INSTANCE POINT — part reference point
        if (!currentPart) { warn('row ' + (r + 1) + ': BASE outside of a MODULE'); continue; }
        currentPart.base = { inst: str(v[0]).toUpperCase(), pt: normPoint(v[1]),
                             face: faceOf(v[1]) };
      } else if (kw === 'ASSY') {
        var acmd = str(v[2]).toUpperCase();
        if (acmd === 'MIRROR') acmd = 'MIR';
        var hasCmd = acmd === 'ADD' || acmd === 'MIR' || acmd === 'COPY' || acmd === 'ROT';
        if (hasCmd || !palias[str(v[1]).toUpperCase()]) {
          //  ASSY <id> <MODULE/ASSY/PLATE> ADD  G.X G.Y G.Z [ROT.X ROT.Y ROT.Z]
          //  ASSY <id> <MODULE/ASSY/PLATE> MIR  G.X G.Y G.Z  PLANE      -> <id>
          //  ASSY <id> <MODULE/ASSY/PLATE> COPY d.X d.Y d.Z  repeat     -> <id>001, <id>002...
          //  ASSY <id> <MODULE/ASSY/PLATE> ROT  C.X C.Y C.Z  AXIS angle repeat
          //                                                             -> <id>001, <id>002...
          //  (the ID column names the result; COPY and ROT number theirs in the
          //   order they are generated, MIR makes only one so it takes the ID as is)
          var aid = str(v[0]).toUpperCase();
          var asrc = str(v[1]).toUpperCase();
          if (!aid) { warn('row ' + (r + 1) + ': ASSY without ID'); continue; }
          var aref = (parts[asrc] || assyIds[asrc]) ? asrc : resolvePlate(asrc);
          if (!aref) {
            warn('row ' + (r + 1) + ': ASSY of undefined MODULE/ASSY/PLATE ' + (asrc || '(blank)'));
            continue;
          }
          if (!hasCmd) acmd = 'ADD';                     // pre-command sheets
          var w = hasCmd ? 3 : 2;                        // first coordinate column
          var arow = { __xl: true, __g: true, CMD: acmd, REF: aref,
                       GX: num(v[w], 0), GY: num(v[w + 1], 0), GZ: num(v[w + 2], 0),
                       REMARK: '', MIRROR: '' };
          if (acmd === 'MIR') {
            var mp = str(v[w + 3]).toUpperCase().replace(/[^XYZ]/g, '');
            mp = { XY: 'XY', YX: 'XY', YZ: 'YZ', ZY: 'YZ', XZ: 'XZ', ZX: 'XZ' }[mp];
            if (!mp) {
              warn('row ' + (r + 1) + ': ASSY MIR needs a mirror plane (XY / YZ / XZ) after G.X/G.Y/G.Z');
              continue;
            }
            arow.MPLANE = mp;
            arow.NO = uniqueAssyId(aid);
            assyIds[arow.NO] = true;
            arow.GROUP = arow.NO;
            assy.push(arow);
            counts.assy++;
            continue;
          }
          if (acmd === 'ROT') {
            var rax = str(v[w + 3]).toUpperCase().replace(/[^XYZ]/g, '');
            if (rax.length !== 1) {
              warn('row ' + (r + 1) + ': ASSY ROT needs a rotation axis (X / Y / Z) after C.X/C.Y/C.Z');
              continue;
            }
            var rang = num(v[w + 4], 0);
            var rrep = Math.max(0, Math.round(num(v[w + 5], 0)));
            if (!rrep) {
              warn('row ' + (r + 1) + ': ASSY ROT with repeat 0/empty — no copy is made' +
                   ' (repeat = how many extra copies)');
              continue;
            }
            if (!rang) {
              warn('row ' + (r + 1) + ': ASSY ROT has Angle 0 — the copies land on the original');
            }
            for (var ri = 1; ri <= rrep; ri++) {
              var rno = seqAssyId(aid);
              assyIds[rno] = true;
              assy.push({ __xl: true, __g: true, CMD: 'ROT', REF: aref, NO: rno, GROUP: rno,
                          GX: arow.GX, GY: arow.GY, GZ: arow.GZ,
                          AXIS: rax, ANG: rang * ri, REMARK: '', MIRROR: '' });
              counts.assy++;
            }
            continue;
          }
          if (acmd === 'COPY') {
            var rep = Math.max(0, Math.round(num(v[w + 3], 0)));
            if (!rep) {
              warn('row ' + (r + 1) + ': ASSY COPY with repeat 0/empty — no copy is made' +
                   ' (repeat = how many extra copies)');
              continue;
            }
            if (!num(v[w], 0) && !num(v[w + 1], 0) && !num(v[w + 2], 0)) {
              warn('row ' + (r + 1) + ': ASSY COPY has d.X/d.Y/d.Z all 0 — the copies land on the original');
            }
            for (var ci = 1; ci <= rep; ci++) {
              var cno = seqAssyId(aid);
              assyIds[cno] = true;
              assy.push({ __xl: true, __g: true, CMD: 'COPY', REF: aref, NO: cno, GROUP: cno,
                          GX: arow.GX * ci, GY: arow.GY * ci, GZ: arow.GZ * ci,
                          REMARK: '', MIRROR: '' });
              counts.assy++;
            }
            continue;
          }
          arow.RX = num(v[w + 3], 0); arow.RY = num(v[w + 4], 0); arow.RZ = num(v[w + 5], 0);
          arow.NO = uniqueAssyId(aid);
          assyIds[arow.NO] = true;
          arow.GROUP = arow.NO;
          assy.push(arow);
          counts.assy++;
          continue;
        }
        // legacy: ASSY <module/plate id> PLANE Ref.Pt L.X L.Y L.ROT OFFSET
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
        if (!palias[plkey]) { warn('row ' + (r + 1) + ': unknown PLANE ' + plkey + ' (use XY/YZ/XZ)'); continue; }
        assy.push({ __xl: true,
                    NO: pid !== key ? pid : key + '-' + counter[key],
                    PLATE: plateId, PART: partRef,
                    PLANE: palias[plkey],
                    REFPT: partRef ? str(v[2]) : normPoint(v[2]),   // parts: raw, resolved at build
                    FACE: faceOf(v[2]),
                    LX: num(v[3], 0), LY: num(v[4], 0), ROT: num(v[5], 0),
                    OFFSET: num(v[6], 0), GROUP: '-', REMARK: '', MIRROR: '' });
        counts.assy++;
      } else {
        warn('row ' + (r + 1) + ': unknown keyword ' + kw);
      }
    }
    if (!assy.length && (Object.keys(plates).length || Object.keys(parts).length)) {
      warn('no ASSY row — nothing is placed. Add e.g. "ASSY <assy id> <module or plate id> 0 0 0"');
    }
    cuts.forEach(function (c) {
      if (c.TYPE === 'REF' && !holes[c.REF] && !plates[c.REF])
        warn('CUT on ' + c.PLATE + ': shape ' + (c.REF || '(blank)') +
             ' is not a defined HOLE or PLATE');
    });
    Object.keys(holes).forEach(function (id) {
      if (!cuts.some(function (c) { return c.REF === id; }))
        warn('HOLE ' + id + ': defined but never used in a CUT row');
    });
    Object.keys(parts).forEach(function (id) {
      if (!parts[id].pos.length) warn('MODULE ' + id + ': has no POS rows');
      else if (!parts[id].base) warn('MODULE ' + id + ': BASE not defined — using local origin (0,0)');
      else if (!parts[id].pos.some(function (p) { return p.NO === parts[id].base.inst; }))
        warn('MODULE ' + id + ': BASE instance ' + parts[id].base.inst + ' not found among POS rows — using local origin');
      if (assy.length && !assy.some(function (a) { return a.PART === id || a.REF === id; }))
        warn('MODULE ' + id + ': defined but never used in an ASSY row');
    });
    return { plates: plates, holes: holes, parts: parts, cuts: cuts, assy: assy,
             log: log, counts: counts, yup: yup };
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
            'plates ' + c.plate +
            (c.hole ? ' &middot; holes ' + c.hole : '') +
            (c.bar ? ' &middot; bars ' + c.bar : '') +
            ' &middot; cuts ' + c.cut +
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
            run({ title: 'PLATE3D',
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

  // A shape is first laid out with its bottom edge centred on the origin, then
  // slid so that its BASE.pt sits at (0,0). BASE.pt defaults to bc for a
  // plate, mc for a circle, mc for a HOLE (cut shapes read from their centre).
  function xShift(spec) {
    return spec.SHAPE === 'CIRC' ? 0 : num(spec.OFF_B, 0) + num(spec.WB, 0) / 2;
  }
  function midPt(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
  function nineFrom(c) {                           // 4 corners -> the 9 points
    var p = { bl: c.bl, br: c.br, tr: c.tr, tl: c.tl };
    p.bc = midPt(p.bl, p.br); p.tc = midPt(p.tl, p.tr);
    p.ml = midPt(p.bl, p.tl); p.mr = midPt(p.br, p.tr);
    p.mc = [(p.bl[0] + p.br[0] + p.tr[0] + p.tl[0]) / 4,
            (p.bl[1] + p.br[1] + p.tr[1] + p.tl[1]) / 4];
    return p;
  }
  function rawCorners(spec) {                      // before BASE.pt is applied
    var d = xShift(spec);
    return { bl: [spec.OFF_B - d, 0], br: [spec.OFF_B + spec.WB - d, 0],
             tr: [spec.OFF_T + spec.WT - d, spec.H], tl: [spec.OFF_T - d, spec.H] };
  }
  function rawPoints(spec) {
    if (spec.SHAPE === 'CIRC') {
      var r = num(spec.D, 0) / 2;
      var p = { mc: [0, 0], tc: [0, r], bc: [0, -r], ml: [-r, 0], mr: [r, 0] };
      p.tl = p.tr = p.tc; p.bl = p.br = p.bc;      // only 5 points on a circle
      return p;
    }
    return nineFrom(rawCorners(spec));
  }
  function defaultBase(spec) {
    return spec.SHAPE === 'CIRC' || spec.__hole ? 'mc' : 'bc';
  }
  function baseOffset(spec) {                      // raw origin -> BASE.pt
    if (spec.__bo) return spec.__bo;
    var raw = rawPoints(spec), d = defaultBase(spec);
    spec.__bo = raw[spec.BASEPT || d] || raw[d] || [0, 0];
    return spec.__bo;
  }
  function cornersOf(spec) {
    var c = rawCorners(spec), o = baseOffset(spec);
    function s(q) { return [q[0] - o[0], q[1] - o[1]]; }
    return { bl: s(c.bl), br: s(c.br), tr: s(c.tr), tl: s(c.tl) };
  }
  function outlineOf(spec) {                       // CCW
    var o = baseOffset(spec);
    if (spec.SHAPE === 'CIRC') return circleOutline(spec.D, -o[0], -o[1], 48);
    var c = cornersOf(spec);
    if (spec.WT <= 0) return [c.bl, c.br, c.tl];
    return [c.bl, c.br, c.tr, c.tl];
  }
  // Reflection about a coordinate plane through (px, py, pz)
  function mirrorMatrix(plane, px, py, pz) {
    if (plane === 'YZ') return new THREE.Matrix4().makeScale(-1, 1, 1).setPosition(2 * px, 0, 0);
    if (plane === 'XZ') return new THREE.Matrix4().makeScale(1, -1, 1).setPosition(0, 2 * py, 0);
    return new THREE.Matrix4().makeScale(1, 1, -1).setPosition(0, 0, 2 * pz);   // XY
  }
  // x -> -x in the plate's own plane, winding kept CCW. A reflected placement has
  // a left-handed frame, which THREE lights wrong, STL winds inside out and IFC
  // cannot express at all; folding the flip into the profile and squaring the
  // matrix up again (world * diag(-1,1,1)) gives the same model, properly framed.
  function flipRingsX(ringList) {
    return ringList.map(function (ring) {
      return ring.map(function (q) { return [-q[0], q[1]]; }).reverse();
    });
  }
  function mirrorAxisOf(spec) {                    // bbox center ×2 (for x → m − x)
    var o = baseOffset(spec);
    if (spec.SHAPE === 'CIRC') return -2 * o[0];   // symmetric about its own centre
    var d = xShift(spec) + o[0];
    var lo = Math.min(spec.OFF_B, spec.OFF_T) - d;
    var hi = Math.max(spec.OFF_B + spec.WB, spec.OFF_T + spec.WT) - d;
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
  function recenter(ring) {                         // area centroid -> (0,0)
    var c = polyCentroid(ring);
    return ring.map(function (p) { return [p[0] - c[0], p[1] - c[1]]; });
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
  function polyCentroid(ring) {          // area-weighted centroid (circle -> centre)
    var a = 0, cx = 0, cy = 0;
    for (var i = 0; i < ring.length; i++) {
      var p = ring[i], q = ring[(i + 1) % ring.length];
      var f = p[0] * q[1] - q[0] * p[1];
      a += f; cx += (p[0] + q[0]) * f; cy += (p[1] + q[1]) * f;
    }
    if (Math.abs(a) < 1e-9) {            // degenerate -> average of vertices
      var sx = 0, sy = 0;
      ring.forEach(function (p) { sx += p[0]; sy += p[1]; });
      return [sx / ring.length, sy / ring.length];
    }
    return [cx / (3 * a), cy / (3 * a)];
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

    var cutters = [], feats = [];               // feats: centre of every cut instance
    var basePts = namedPoints(spec, false);       // cut coords are measured from REFPT
    cuts.filter(function (c) { return c.PLATE === spec.ID; }).forEach(function (c) {
      var anchor = c.__org ? [0, 0]
                   : (basePts[c.REFPT || (c.__xlCut ? 'bc' : 'bl')] || [0, 0]);
      // positions: 1D repeat (N/DX/DY, Excel grammar) or NX·PX/NY·PY grid
      var uvs = [];
      if (c.REP !== undefined) {              // repeat = extra copies (original excluded)
        for (var i = 0; i <= num(c.REP, 0); i++)
          uvs.push([anchor[0] + num(c.U, 0) + i * num(c.DX, 0),
                    anchor[1] + num(c.V, 0) + i * num(c.DY, 0)]);
      } else {
        var nx = num(c.NX, 1), px = num(c.PX, 0), ny = num(c.NY, 1), py = num(c.PY, 0);
        for (var ix = 0; ix < nx; ix++) for (var iy = 0; iy < ny; iy++)
          uvs.push([anchor[0] + num(c.U, 0) + ix * px, anchor[1] + num(c.V, 0) + iy * py]);
      }
      uvs.forEach(function (uv) {
        var u = uv[0], v = uv[1], ring = null, kind = 'cut', dia = 0;
        if (c.TYPE === 'CIRC') {
          ring = circleOutline(num(c.D, 0), u, v, 32); kind = 'hole'; dia = num(c.D, 0);
        } else if (c.TYPE === 'TRAP') {
          var tw = num(c.TW, num(c.B, 0));
          var tr = trapOutline(num(c.B, 0), tw, num(c.H, 0), num(c.OF, (num(c.B, 0) - tw) / 2));
          ring = rotTrans(c.__ctr ? recenter(tr) : tr, num(c.ANG, 0), u, v);
        } else if (c.TYPE === 'REF') {          // a HOLE, or another plate's outline
          var src = shapeLib[c.REF] || plates[c.REF];
          if (!src) return;
          // a shape defined with HOLE/PLATE already carries its BASE.pt at the
          // origin; the older "CUT ... PLATE id" rows sit on their centroid
          var ro = outlineOf(src);
          ring = rotTrans(c.__ctr ? recenter(ro) : ro, num(c.ANG, 0), u, v);
          if (src.SHAPE === 'CIRC') { kind = 'hole'; dia = num(src.D, 0); }
        }
        if (!ring) return;
        cutters.push(ring);
        var ct = polyCentroid(ring);
        feats.push({ x: ct[0], y: ct[1], kind: kind, dia: dia });
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
             feats: feats,
             area: area };
  }

  /* ------- named points/edges (uncut outline, MIRROR applied) ------- */
  function namedPoints(spec, mirror) {
    if (spec.SHAPE === 'CIRC') {
      var o = baseOffset(spec), raw = rawPoints(spec), p = {};
      POINT_KEYS.forEach(function (k) { p[k] = [raw[k][0] - o[0], raw[k][1] - o[1]]; });
      return p;
    }
    var c = cornersOf(spec);
    if (mirror) {                                  // mirror about bbox center, then rename
      var m = mirrorAxisOf(spec);
      var M = function (q) { return [m - q[0], q[1]]; };
      c = { bl: M(c.br), br: M(c.bl), tl: M(c.tr), tr: M(c.tl) };
    }
    return nineFrom(c);
  }
  // edges in CCW order (interior on the left of travel direction)
  function edgeOf(pts, name) {
    return { eb: [pts.bl, pts.br], er: [pts.br, pts.tr],
             et: [pts.tr, pts.tl], el: [pts.tl, pts.bl] }[name];
  }
  function mirror2D(ringList, spec) {
    var m = mirrorAxisOf(spec);
    return ringList.map(function (ring) {
      return ring.map(function (q) { return [m - q[0], q[1]]; }).reverse();
    });
  }

  /* ---------------- placement matrices ---------------- */
  var PLANE_BASIS = {
    PLAN:  { ex: [1, 0, 0], ey: [0, 1, 0], ez: [0, 0, 1] },     // XY: x→X, y→Y, thickness→+Z (up)
    FRONT: { ex: [1, 0, 0], ey: [0, 0, 1], ez: [0, -1, 0] },    // XZ: x→X, y→Z (up), thickness→−Y
    SIDE:  { ex: [0, 1, 0], ey: [0, 0, 1], ez: [1, 0, 0] }      // YZ: x→Y, y→Z (up), thickness→+X
  };
  // A "COORD YUP" sheet is laid out entirely in the old Y-up frame - same bases
  // the engine used to have - and the finished model is turned upright once, so
  // chained EDGE placements and module bases keep working as they did.
  var PLANE_BASIS_YUP = {
    FRONT: { ex: [1, 0, 0],  ey: [0, 1, 0],  ez: [0, 0, 1] },
    SIDE:  { ex: [0, 0, -1], ey: [0, 1, 0],  ez: [1, 0, 0] },
    PLAN:  { ex: [1, 0, 0],  ey: [0, 0, -1], ez: [0, 1, 0] }
  };
  var yupSheet = false;                         // set per build from the COORD row
  function planeBasis(role) { return (yupSheet ? PLANE_BASIS_YUP : PLANE_BASIS)[role]; }
  function yupFix(m) {                          // Y-up layout -> Z-up world, applied once
    return yupSheet ? new THREE.Matrix4().makeRotationX(Math.PI / 2).multiply(m) : m;
  }
  function v3(a) { return new THREE.Vector3(a[0], a[1], a[2]); }

  function planeMatrix(row) {
    var b = planeBasis(row.PLANE);
    if (!b) throw new Error(row.NO + ': PLANE=' + row.PLANE + ' (use FRONT/SIDE/PLAN)');
    var m = new THREE.Matrix4().makeBasis(v3(b.ex), v3(b.ey), v3(b.ez));
    m.multiply(new THREE.Matrix4().makeTranslation(num(row.U, 0), num(row.V, 0), num(row.OFFSET, 0)));
    m.multiply(new THREE.Matrix4().makeRotationZ(num(row.ANG, 0) * Math.PI / 180));
    return m;
  }

  // Excel grammar placement: the plate's REF.PT lands at (L.X, L.Y) on the
  // plane, rotated by L.ROT about that point, at OFFSET along the normal
  function planeMatrixAnchor(row, pts, thk) {
    var b = planeBasis(row.PLANE);
    if (!b) throw new Error(row.NO + ': PLANE=' + row.PLANE + ' (use XY/YZ/XZ)');
    var a = pts[row.REFPT] || pts.bl;
    // FACE 0 -> mid-thickness (default), +1/-1 -> that face lands on the plane
    var az = (row.FACE || 0) * (thk || 0) / 2;
    var m = new THREE.Matrix4().makeBasis(v3(b.ex), v3(b.ey), v3(b.ez));
    m.multiply(new THREE.Matrix4().makeTranslation(row.LX, row.LY, row.OFFSET));
    m.multiply(new THREE.Matrix4().makeRotationZ(row.ROT * Math.PI / 180));
    m.multiply(new THREE.Matrix4().makeTranslation(-a[0], -a[1], -az));
    return m;
  }

  function rotXYZ(rx, ry, rz) {                 // extrinsic X -> Y -> Z about the parent axes
    var m = new THREE.Matrix4();
    if (rz) m.multiply(new THREE.Matrix4().makeRotationZ(rz * Math.PI / 180));
    if (ry) m.multiply(new THREE.Matrix4().makeRotationY(ry * Math.PI / 180));
    if (rx) m.multiply(new THREE.Matrix4().makeRotationX(rx * Math.PI / 180));
    return m;
  }

  // MODULE row, XYZ grammar: the plate's Ref.Pt lands on the module-local point
  // (L.X, L.Y, L.Z), PLANE says which way the plate faces and ROT X/Y/Z spin it
  // about that same point. Legacy rows fall back to the plane-anchored form.
  // Where a member's reference point sits in its own xyz. A bar is always held
  // by the centre of its starting face - the circle it grows from - so its
  // Ref.Pt cell is not read at all; a plate uses its named point and the +/-
  // face suffix.
  function refAnchor(spec, pt, face) {
    var thk = num(spec.THK, 0);
    if (spec.__bar) return [0, 0, -thk / 2];
    var p = namedPoints(spec, false), a = p[pt] || p.bl;
    return [a[0], a[1], (face || 0) * thk / 2];
  }
  function isBarSpec(spec) { return !!(spec && spec.__bar); }

  function memberMatrix(row, pts, thk) {
    if (!row.__xyz) return planeMatrixAnchor(row, pts, thk);
    var b = planeBasis(row.PLANE);
    if (!b) throw new Error(row.NO + ': PLANE=' + row.PLANE + ' (use XY/YZ/XZ)');
    var a = row.__bar ? [0, 0] : (pts[row.REFPT] || pts.bl);
    var az = row.__bar ? -(thk || 0) / 2 : (row.FACE || 0) * (thk || 0) / 2;
    var m = new THREE.Matrix4().makeTranslation(row.LX, row.LY, row.LZ);
    m.multiply(rotXYZ(row.RX, row.RY, row.RZ));
    m.multiply(new THREE.Matrix4().makeBasis(v3(b.ex), v3(b.ey), v3(b.ez)));
    m.multiply(new THREE.Matrix4().makeTranslation(-a[0], -a[1], -az));
    return m;
  }

  function edgeMatrix(row, inst, myPts, myTHK) {
    var tgt = inst[row.TO];
    if (!tgt) throw new Error(row.NO + ': TO=' + row.TO + ' undefined (only earlier rows can be referenced)');
    var te = edgeOf(tgt.pts, row.TO_EDGE);
    if (!te) throw new Error(row.NO + ': TO_EDGE=' + row.TO_EDGE);
    var A = v3([te[0][0], te[0][1], tgt.thk / 2]).applyMatrix4(tgt.matrix);   // hinge = target front face
    var Bp = v3([te[1][0], te[1][1], tgt.thk / 2]).applyMatrix4(tgt.matrix);
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
    var flush = { OUT: -myTHK / 2, C: 0, IN: myTHK / 2 }[row.FLUSH || 'C'];
    var origin = A.clone().add(d.clone().multiplyScalar(align)).add(ez.clone().multiplyScalar(flush));

    return new THREE.Matrix4().makeBasis(ex, ey, ez).setPosition(origin).multiply(r0);
  }

  /* ---------------- scene build ---------------- */
  function buildAll(data, colors) {
    var plates = {}, parts = {}, cuts, assyRows;
    var colorSeq = 0;
    yupSheet = !!(data.__parsed && data.__parsed.yup);
    shapeLib = (data.__parsed && data.__parsed.holes) || {};
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
    modColors = {};
    Object.keys(parts).forEach(function (id) {
      modColors[id] = PALETTE[colorSeq++ % PALETTE.length];
    });
    lastPlates = plates;
    lastCuts = cuts;
    lastColors = colors;
    lastParts = parts;
    var inst = {};                       // NO → {matrix, pts, thk} for EDGE references
    var bbox = new THREE.Box3();

    function buildErr(m) { buildLog.push(m); console.error('[plateBuilder] ' + m); }

    // create geometry for one plate instance with a final world matrix
    function buildInstance(spec, matrix, no, group, remark, mirror, moduleId, memberKey, flip) {
      var world = yupFix(matrix);        // EDGE chaining keeps using the raw matrix
      var thk = spec.THK;
      var g2d = buildPlate2D(spec, cuts, plates);
      var outers = g2d.outers, holesArr = g2d.holes;
      if (mirror) {
        outers = mirror2D(outers, spec);
        holesArr = holesArr.map(function (hs) { return mirror2D(hs, spec); });
      }
      if (flip) {                        // reflected instance, see flipRingsX
        world = world.clone().multiply(new THREE.Matrix4().makeScale(-1, 1, 1));
        outers = flipRingsX(outers);
        holesArr = holesArr.map(flipRingsX);
      }
      var groupObj = new THREE.Group();
      var mat = new THREE.MeshPhongMaterial({ color: colors[spec.ID], shininess: 28,
                                              side: THREE.DoubleSide });
      var edgeMat = new THREE.LineBasicMaterial({ color: 0x0e1013 });
      outers.forEach(function (ring, i) {
        var shape = new THREE.Shape(ring.map(function (q) { return new THREE.Vector2(q[0], q[1]); }));
        holesArr[i].forEach(function (h) {
          shape.holes.push(new THREE.Path(h.map(function (q) { return new THREE.Vector2(q[0], q[1]); })));
        });
        var geo = plateGeom(shape, thk);
        var mesh = new THREE.Mesh(geo, mat);
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(world);
        mesh.userData = { shape: shape, thk: thk };
        groupObj.add(mesh);
        geo.computeBoundingBox();
        bbox.union(geo.boundingBox.clone().applyMatrix4(world));
        var edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), edgeMat);
        edge.matrixAutoUpdate = false;
        edge.matrix.copy(world);
        edge.userData = { shape: shape, thk: thk };
        groupObj.add(edge);
      });
      scene.add(groupObj);
      var dims = spec.SHAPE === 'CIRC'
        ? 'D' + spec.D + '×' + thk
        : (spec.WT === spec.WB && spec.OFF_T === spec.OFF_B
            ? spec.WB + '×' + spec.H + '×' + thk + 'T'
            : spec.WT + '/' + spec.WB + '×' + spec.H + '×' + thk + 'T');
      var gname = group || '-';
      var it = { no: no, plateId: spec.ID, group: gname, moduleId: moduleId || null,
                 memberKey: memberKey || null,
                 instKey: gname + '/' + (moduleId || '#' + spec.ID),
                 groupObj: groupObj, mass: g2d.area * thk * RHO,
                 dims: dims, remark: remark || '',
                 spec: spec, thk: thk, matrix: world, mat: mat, edgeMat: edgeMat,
                 baseColor: colors[spec.ID],
                 rings: { outers: outers, holes: holesArr } };
      items.push(it);
      styleItem(it);
      return { pts: namedPoints(spec, mirror), thk: thk };
    }

    // part-local placements + base point (3D, part-local)
    function partLocals(part) {
      var locals = part.pos.map(function (p) {
        var spec = plates[p.PLATE];
        var pts = namedPoints(spec, false);
        return { row: p, spec: spec, pts: pts, mloc: memberMatrix(p, pts, spec.THK) };
      });
      var base = new THREE.Vector3(0, 0, 0);
      if (part.base) {
        for (var i = 0; i < locals.length; i++) {
          if (locals[i].row.NO === part.base.inst) {
            var a = refAnchor(locals[i].spec, part.base.pt, part.base.face);
            base = new THREE.Vector3(a[0], a[1], a[2]).applyMatrix4(locals[i].mloc);
            break;
          }
        }
      }
      return { locals: locals, base: base };
    }

    // part reference point in part-local 3D coords, per ASSY REFPT syntax
    function partRefPoint(pl, refpt) {
      var f = faceOf(refpt);                                         // trailing + / -
      var s = str(refpt).toUpperCase().replace(/[+\-]$/, '').trim();
      if (s === '' || s === 'O') return pl.base;                     // BASE (or origin)
      var dot = s.indexOf('.');
      if (dot > 0 && s.lastIndexOf('.') !== 0) {                     // INSTANCE.POINT
        var pt = s.slice(s.lastIndexOf('.') + 1);
        var instName = s.slice(0, s.lastIndexOf('.'));
        for (var i = 0; i < pl.locals.length; i++) {
          if (pl.locals[i].row.NO === instName) {
            var a = pl.locals[i].pts[normPoint(pt)] || pl.locals[i].pts.bl;
            return new THREE.Vector3(a[0], a[1], f * pl.locals[i].spec.THK / 2)
                     .applyMatrix4(pl.locals[i].mloc);
          }
        }
        buildErr('part ref point ' + s + ' not found — using BASE');
        return pl.base;
      }
      // plain 9-point name → part bbox (X/Y per name, Z centered)
      var bb = new THREE.Box3();
      pl.locals.forEach(function (L) {
        var c = L.spec.SHAPE === 'CIRC'
          ? { bl: [-L.spec.D / 2, -L.spec.D / 2], tr: [L.spec.D / 2, L.spec.D / 2] }
          : cornersOf(L.spec);
        var xs = [], ys = [];
        Object.keys(c).forEach(function (k) { xs.push(c[k][0]); ys.push(c[k][1]); });
        [[Math.min.apply(null, xs), Math.min.apply(null, ys), 0],
         [Math.max.apply(null, xs), Math.max.apply(null, ys), L.spec.THK]].forEach(function (q) {
          bb.expandByPoint(new THREE.Vector3(q[0], q[1], q[2]).applyMatrix4(L.mloc));
        });
      });
      var p9 = normPoint(refpt);
      // b/t run along the module's up axis, +/- along its depth axis
      var up = yupSheet ? 'y' : 'z', dp = yupSheet ? 'z' : 'y';
      var q = { x: (bb.min.x + bb.max.x) / 2 };
      q.x = p9.charAt(2) === 'l' ? bb.min.x : p9.charAt(2) === 'r' ? bb.max.x : q.x;
      q[up] = p9.charAt(1) === 'b' ? bb.min[up] : p9.charAt(1) === 't' ? bb.max[up]
                                                : (bb.min[up] + bb.max[up]) / 2;
      q[dp] = f > 0 ? bb.max[dp] : f < 0 ? bb.min[dp] : (bb.min[dp] + bb.max[dp]) / 2;
      return new THREE.Vector3(q.x, q.y, q.z);
    }

    var assyDefs = {};                 // ASSY id -> members in that assembly's own frame
    var assyAt = {};                   // ASSY id -> where that assembly was placed

    // members of an ASSY source, positioned so its reference point is at the origin
    function assySource(row) {
      if (parts[row.REF]) {                              // a MODULE: reference = its BASE point
        var pl = partLocals(parts[row.REF]);
        var B = pl.base;
        var toBase = new THREE.Matrix4().makeTranslation(-B.x, -B.y, -B.z);
        return pl.locals.map(function (L) {
          return { spec: L.spec, no: L.row.NO, moduleId: row.REF,
                   memberKey: row.REF + '/' + L.row.NO, flip: false,
                   mloc: toBase.clone().multiply(L.mloc) };
        });
      }
      if (assyDefs[row.REF]) {                           // an earlier ASSY: reference = its origin
        return assyDefs[row.REF].map(function (L) {
          return { spec: L.spec, no: L.no, moduleId: L.moduleId, memberKey: L.memberKey,
                   flip: L.flip, mloc: L.mloc.clone() };
        });
      }
      var sp = plates[row.REF];         // a single PLATE: reference = bc (a BAR: its start)
      if (!sp) throw new Error(row.NO + ': unknown MODULE/ASSY/PLATE ' + row.REF);
      var p0 = refAnchor(sp, 'bc', 0);
      return [{ spec: sp, no: sp.ID, moduleId: null, memberKey: null, flip: false,
                mloc: new THREE.Matrix4().makeTranslation(-p0[0], -p0[1], -p0[2]) }];
    }

    assyRows.forEach(function (row) {
      if (row.__g) {                     // ADD / MIR / COPY
        var src;
        try { src = assySource(row); } catch (err) { buildErr(err.message); return; }
        var at = assyAt[row.REF] || new THREE.Matrix4();
        var G, pre = null, flipAll = false;
        if (row.CMD === 'MIR') {         // reflect the source where it already stands
          // fold the reflection into the definition, so the result can be
          // re-placed later like any other assembly
          pre = new THREE.Matrix4().copy(at).invert()
                  .multiply(mirrorMatrix(row.MPLANE, row.GX, row.GY, row.GZ))
                  .multiply(at);
          G = at.clone();
          flipAll = true;
        } else if (row.CMD === 'ROT') {   // spin the source about an absolute axis
          var rad = row.ANG * Math.PI / 180;
          var R = row.AXIS === 'X' ? new THREE.Matrix4().makeRotationX(rad)
                : row.AXIS === 'Y' ? new THREE.Matrix4().makeRotationY(rad)
                                   : new THREE.Matrix4().makeRotationZ(rad);
          var W = new THREE.Matrix4().makeTranslation(row.GX, row.GY, row.GZ)
                    .multiply(R)
                    .multiply(new THREE.Matrix4().makeTranslation(-row.GX, -row.GY, -row.GZ));
          pre = new THREE.Matrix4().copy(at).invert().multiply(W).multiply(at);
          G = at.clone();
        } else if (row.CMD === 'COPY') { // shift the source from where it already stands
          G = new THREE.Matrix4().makeTranslation(row.GX, row.GY, row.GZ).multiply(at);
        } else {                         // ADD: reference point lands on G.X/G.Y/G.Z
          G = new THREE.Matrix4().makeTranslation(row.GX, row.GY, row.GZ)
                .multiply(rotXYZ(row.RX, row.RY, row.RZ));
        }
        // the definition keeps its own reference point at the origin, so a later
        // ASSY row that reuses this id places it by the same G.X/G.Y/G.Z rule
        assyDefs[row.NO] = src.map(function (L) {
          var ml = pre ? pre.clone().multiply(L.mloc) : L.mloc.clone();
          return { spec: L.spec, no: L.no, moduleId: L.moduleId, memberKey: L.memberKey,
                   flip: flipAll ? !L.flip : L.flip, mloc: ml };
        });
        assyAt[row.NO] = G;
        assyDefs[row.NO].forEach(function (L) {
          buildInstance(L.spec, G.clone().multiply(L.mloc), row.NO + '/' + L.no,
                        row.NO, '', false, L.moduleId, L.memberKey, L.flip);
        });
        return;
      }
      if (row.PART) {                    // part instance: place every member plate
        var part = parts[row.PART];
        if (!part) { buildErr(row.NO + ': unknown MODULE=' + row.PART); return; }
        var pl;
        try { pl = partLocals(part); } catch (err) { buildErr(row.NO + ': ' + err.message); return; }
        var B = partRefPoint(pl, row.REFPT);
        var b = planeBasis(row.PLANE);
        var M = new THREE.Matrix4().makeBasis(v3(b.ex), v3(b.ey), v3(b.ez));
        M.multiply(new THREE.Matrix4().makeTranslation(row.LX, row.LY, row.OFFSET));
        M.multiply(new THREE.Matrix4().makeRotationZ(row.ROT * Math.PI / 180));
        M.multiply(new THREE.Matrix4().makeTranslation(-B.x, -B.y, -B.z));
        pl.locals.forEach(function (L) {
          var world = M.clone().multiply(L.mloc);
          buildInstance(L.spec, world, row.NO + '/' + L.row.NO, row.NO, '', false, row.PART,
                        row.PART + '/' + L.row.NO);
        });
        return;
      }
      var spec = plates[row.PLATE];
      if (!spec) { buildErr(row.NO + ': unknown PLATE=' + row.PLATE); return; }
      var mirror = row.MIRROR === 'X';
      var pts = namedPoints(spec, mirror);
      var matrix;
      try {
        matrix = row.__xl ? planeMatrixAnchor(row, pts, spec.THK)
               : row.METHOD === 'EDGE' ? edgeMatrix(row, inst, pts, spec.THK)
               : planeMatrix(row);
      } catch (err) { buildErr(err.message); return; }
      var r2 = buildInstance(spec, matrix, row.NO, row.GROUP, row.REMARK, mirror);
      inst[row.NO] = { matrix: matrix, pts: r2.pts, thk: r2.thk };
    });
    return bbox;
  }

  // section title / placeholder rows - same look in every list
  function sectionRow(tbl, cls, text, span) {
    var tr = document.createElement('tr');
    tr.className = cls;
    tr.innerHTML = '<td colspan="' + (span || 2) + '">' + text + '</td>';
    tbl.appendChild(tr);
    return tr;
  }

  /* -------- plate definition list + 2D preview modal -------- */
  function buildPlateList(colors) {
    var tbl = document.getElementById('pb-plates');
    if (!tbl) return;
    tbl.innerHTML = '';
    var ids = Object.keys(lastPlates).filter(function (id) { return !lastPlates[id].__bar; });
    sectionRow(tbl, 'ghead', 'PLATES — click to preview');
    if (!ids.length) { sectionRow(tbl, 'none', 'no PLATE row'); return; }
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
        '<td class="sty"><span class="sw" style="background:' +
        int2hex(resolveColor({ plateId: id }, colors[id] || 0x999999)) +
        '" onclick="plateBuilder.openPalette(event,\'plate\',\'' + id + '\',this)"></span></td>' +
        '<td><span class="plname" onclick="plateBuilder.preview(\'' + id + '\')">' + esc(id) + '</span>' +
        '<div class="dims">' + dims + (ncut ? ' · cuts ' + ncut : '') +
        (spec.MAT ? ' · ' + esc(spec.MAT) : '') + '</div></td>';
      tbl.appendChild(tr);
    });
  }

  // Straight round bars, listed rather than drawn: a bar has nothing to preview
  // that the four numbers do not already say.
  function buildBarList() {
    var tbl = document.getElementById('pb-bars');
    if (!tbl) return;
    tbl.innerHTML = '';
    var ids = Object.keys(lastPlates).filter(function (id) { return lastPlates[id].__bar; });
    if (!ids.length) { tbl.style.display = 'none'; return; }
    tbl.style.display = 'table';
    sectionRow(tbl, 'ghead', 'BARS', 4);
    var hr = document.createElement('tr');
    hr.className = 'chead';
    hr.innerHTML = '<td>ID</td><td class="num">DIA</td><td class="num">LENGTH</td><td>MAT</td>';
    tbl.appendChild(hr);
    ids.forEach(function (id) {
      var spec = lastPlates[id];
      var tr = document.createElement('tr');
      tr.innerHTML = '<td class="bid">' + esc(id) + '</td>' +
                     '<td class="num">&#216;' + trim(spec.D) + '</td>' +
                     '<td class="num">' + trim(spec.THK) + '</td>' +
                     '<td class="mat">' + esc(spec.MAT || '\u2014') + '</td>';
      tbl.appendChild(tr);
    });
  }
  function trim(v) { return String(+num(v, 0).toFixed(3)); }

  function preview(id) {
    var spec = lastPlates[id];
    if (!spec) return;
    var modal = document.getElementById('pb-modal');
    var cv = document.getElementById('pb-pv-canvas');
    if (!modal || !cv) return;
    stopPreview3D();
    pvModuleId = null;
    document.getElementById('pb-pv-tree').style.display = 'none';
    ['pb-pv-flat', 'pb-pv-ids', 'pb-pv-faces'].forEach(function (q) {
      document.getElementById(q).parentNode.style.display = 'none';
    });
    document.getElementById('pb-pv-meas').parentNode.style.display = 'flex';
    document.getElementById('pb-pv-meas').checked = measurePv;
    pvMeas = [];
    document.getElementById('pb-pv-stl').style.display = 'none';
    document.getElementById('pb-pv-ifc').style.display = 'none';
    cv.style.display = 'block';
    document.getElementById('pb-pv3d').style.display = 'none';

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

    // snap points: 9 reference points + the centre of every cut
    pvPts = [];
    POINT_KEYS.forEach(function (k) {
      var a = pts[k];
      if (a) pvPts.push({ name: k, x: a[0], y: a[1] });
    });
    var nk = {};
    (g.feats || []).forEach(function (f) {
      nk[f.kind] = (nk[f.kind] || 0) + 1;
      pvPts.push({ name: f.kind + nk[f.kind], x: f.x, y: f.y, cut: true, dia: f.dia || 0 });
    });

    var W = cv.width, H = cv.height, PAD = 54;
    var fit = Math.min((W - PAD * 2) / Math.max(maxx - minx, 1e-6),
                       (H - PAD * 2) / Math.max(maxy - miny, 1e-6));
    pv = { id: id, spec: spec, g: g, pts: pts, W: W, H: H,
           minx: minx, miny: miny, maxx: maxx, maxy: maxy, fit: fit,
           sc: fit, ox: (W - (maxx - minx) * fit) / 2, oy: (H - (maxy - miny) * fit) / 2 };
    drawPreview();
    document.getElementById('pb-pv-pos').innerHTML = '&nbsp;';
    modal.style.display = 'flex';
  }

  function pvFit() {                                  // reset zoom/pan to fit
    if (!pv) return;
    pv.sc = pv.fit;
    pv.ox = (pv.W - (pv.maxx - pv.minx) * pv.fit) / 2;
    pv.oy = (pv.H - (pv.maxy - pv.miny) * pv.fit) / 2;
    drawPreview();
  }

  function drawPreview() {
    if (!pv) return;
    var cv = document.getElementById('pb-pv-canvas');
    var ctx = cv.getContext('2d');
    var W = pv.W, H = pv.H, sc = pv.sc, ox = pv.ox, oy = pv.oy;
    var minx = pv.minx, miny = pv.miny, g = pv.g, pts = pv.pts, spec = pv.spec;
    function mx(x) { return ox + (x - minx) * sc; }
    function my(y) { return H - oy - (y - miny) * sc; }
    pvX = { minx: minx, miny: miny, sc: sc, ox: ox, oy: oy, H: H, W: W };

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#15181c';
    ctx.fillRect(0, 0, W, H);

    // grid + rulers (spacing picked so one cell is ~20-90 px)
    var STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
    var step = STEPS[STEPS.length - 1];
    for (var si = 0; si < STEPS.length; si++) {
      if (STEPS[si] * sc >= 20) { step = STEPS[si]; break; }
    }
    var gx0 = minx - ox / sc, gx1 = minx + (W - ox) / sc;
    var gy0 = miny - oy / sc, gy1 = miny + (H - oy) / sc;
    ctx.lineWidth = 1;
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    for (var gx = Math.ceil(gx0 / step) * step; gx <= gx1; gx += step) {
      var px = mx(gx);
      ctx.strokeStyle = Math.abs(gx) < 1e-6 ? '#4a5666' : '#242a31';
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke();
      ctx.fillStyle = '#5b6472';
      ctx.fillText(String(Math.round(gx)), px, H - 4);
    }
    ctx.textAlign = 'left';
    for (var gy = Math.ceil(gy0 / step) * step; gy <= gy1; gy += step) {
      var py = my(gy);
      ctx.strokeStyle = Math.abs(gy) < 1e-6 ? '#4a5666' : '#242a31';
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(W, py); ctx.stroke();
      ctx.fillStyle = '#5b6472';
      ctx.fillText(String(Math.round(gy)), 3, py - 3);
    }

    // plate outline with holes
    ctx.beginPath();
    g.outers.forEach(function (ring, i) {
      ring.forEach(function (q, j) { j ? ctx.lineTo(mx(q[0]), my(q[1])) : ctx.moveTo(mx(q[0]), my(q[1])); });
      ctx.closePath();
      (g.holes[i] || []).forEach(function (h) {
        h.forEach(function (q, j) { j ? ctx.lineTo(mx(q[0]), my(q[1])) : ctx.moveTo(mx(q[0]), my(q[1])); });
        ctx.closePath();
      });
    });
    var col = resolveColor({ plateId: pv.id }, (lastColors && lastColors[pv.id]) || 0x5c9bd1);
    var hexc = '#' + ('000000' + col.toString(16)).slice(-6);
    ctx.fillStyle = hexc;
    ctx.globalAlpha = 0.35;
    ctx.fill('evenodd');
    ctx.globalAlpha = 1;
    ctx.strokeStyle = hexc;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // reference points and cut centres
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    var seen = {};
    pvPts.forEach(function (p) {
      var x = mx(p.x), y = my(p.y);
      ctx.strokeStyle = p.cut ? '#7f8b9c' : '#f0c674';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y);
      ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4);
      ctx.stroke();
      if (p.cut) return;
      var key = p.x.toFixed(3) + ',' + p.y.toFixed(3);
      if (seen[key]) { seen[key].n.push(p.name); return; }
      seen[key] = { x: x, y: y, n: [p.name] };
    });
    ctx.fillStyle = '#f0c674';
    Object.keys(seen).forEach(function (k) {
      ctx.fillText(seen[k].n.join('/'), seen[k].x + 5, seen[k].y - 5);
    });

    // round holes carry their diameter on a leader, arrow touching the circle
    ctx.strokeStyle = '#9fb4cc';
    ctx.fillStyle = '#9fb4cc';
    ctx.font = '11px sans-serif';
    ctx.lineWidth = 1;
    pvPts.forEach(function (p) {
      if (!p.dia) return;
      var cxp = mx(p.x), cyp = my(p.y), r = p.dia / 2 * sc;
      var ux = Math.SQRT1_2, uy = -Math.SQRT1_2;         // 45 deg, up-right on screen
      var ax = cxp + ux * r, ay = cyp + uy * r;          // on the circle
      var kx = cxp + ux * (r + 16), ky = cyp + uy * (r + 16);
      var sx2 = kx + 16;                                  // horizontal shoulder
      ctx.beginPath();
      ctx.moveTo(ax, ay); ctx.lineTo(kx, ky); ctx.lineTo(sx2, ky);
      ctx.stroke();
      var ah = 5, aw = 2.2;                               // arrowhead pointing at the circle
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax + ux * ah - uy * aw, ay + uy * ah + ux * aw);
      ctx.lineTo(ax + ux * ah + uy * aw, ay + uy * ah - ux * aw);
      ctx.closePath();
      ctx.fill();
      ctx.fillText('\u00d8' + p.dia, sx2 + 3, ky - 3);
    });

    if (pvMeas.length) {                           // measurement in progress / done
      var A = { x: mx(pvMeas[0].x), y: my(pvMeas[0].y) };
      ctx.strokeStyle = '#ffe81f';
      ctx.fillStyle = '#ffe81f';
      ctx.lineWidth = 1.4;
      [A].concat(pvMeas.length > 1 ? [{ x: mx(pvMeas[1].x), y: my(pvMeas[1].y) }] : [])
        .forEach(function (q) {
          ctx.beginPath(); ctx.arc(q.x, q.y, 5, 0, Math.PI * 2); ctx.stroke();
        });
      if (pvMeas.length > 1) {
        var B = { x: mx(pvMeas[1].x), y: my(pvMeas[1].y) };
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
        var dx = pvMeas[1].x - pvMeas[0].x, dy = pvMeas[1].y - pvMeas[0].y;
        var r2 = function (n) { return (Math.round(n * 100) / 100).toString(); };
        ctx.textAlign = 'center';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(r2(Math.hypot(dx, dy)), (A.x + B.x) / 2, (A.y + B.y) / 2 - 10);
        ctx.font = '11px sans-serif';
        ctx.fillText('\u0394X ' + r2(dx) + '   \u0394Y ' + r2(dy),
                     (A.x + B.x) / 2, (A.y + B.y) / 2 + 8);
        ctx.textAlign = 'left';
      }
    }

    var dims = spec.SHAPE === 'CIRC'
      ? 'D' + spec.D + ' × THK ' + spec.THK
      : (spec.WT === spec.WB && spec.OFF_T === spec.OFF_B
          ? spec.WB + ' × ' + spec.H + ' × ' + spec.THK + 'T'
          : 'WT ' + spec.WT + ' / WB ' + spec.WB + ' × H ' + spec.H + ' × ' + spec.THK + 'T');
    var ncut = lastCuts.filter(function (c) { return c.PLATE === pv.id; }).length;
    document.getElementById('pb-pv-title').textContent = pv.id;
    document.getElementById('pb-pv-meta').innerHTML =
      esc(dims) + ' &middot; cuts ' + ncut +
      (spec.MAT ? ' &middot; ' + esc(spec.MAT) : '') +
      ' &middot; ' + (g.area * spec.THK * RHO).toFixed(3) + ' kg' +
      ' &nbsp;&nbsp;<span style="color:#5b6472">grid ' + step + 'mm &middot; ' +
      Math.round(sc / pv.fit * 100) + '% &middot; wheel: zoom, drag: pan, dbl-click: fit</span>';

    if (!pvBase) pvBase = document.createElement('canvas');
    pvBase.width = W; pvBase.height = H;
    pvBase.getContext('2d').drawImage(cv, 0, 0);   // snapshot for cheap hover redraws
  }
  function regenPreview() {                     // undo zoom/pan, back to the opening view
    if (pvModuleId) {
      if (!pvCtrl || !pvHome) return;
      pvCtrl.object.position.copy(pvHome.pos);
      pvCtrl.target.copy(pvHome.tgt);
      pvCtrl.update();
      return;
    }
    pvFit();
  }

  function closePreview() {
    pvModuleId = null;
    pv = null;
    stopPreview3D();
    var modal = document.getElementById('pb-modal');
    if (modal) modal.style.display = 'none';
  }

  /* -------- module list + 3D preview -------- */
  function buildModuleList() {
    var tbl = document.getElementById('pb-modules');
    if (!tbl) return;
    tbl.innerHTML = '';
    var ids = Object.keys(lastParts);
    sectionRow(tbl, 'ghead', 'MODULES — click to preview');
    if (!ids.length) { sectionRow(tbl, 'none', 'no MODULE row'); return; }
    ids.forEach(function (id) {
      var part = lastParts[id];
      var used = items.some(function (it) {
        return it.moduleId === id || it.group === id || it.no.indexOf(id) === 0;
      });
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="sty"><span class="sw" style="background:' + int2hex(moduleColor(id)) +
        '" title="colour of this module in the assembly view"' +
        ' onclick="plateBuilder.openPalette(event,\'module\',\'' + id + '\',this)"></span>' +
        '<input type="range" min="10" max="100" step="5" value="' +
        Math.round((ovOpac.module[id] !== undefined ? ovOpac.module[id] : 1) * 100) +
        '" title="opacity of the whole module" ' +
        'oninput="plateBuilder.setOpacity(\'module\',\'' + id + '\',this.value)"></td>' +
        '<td><span class="plname" onclick="plateBuilder.previewModule(\'' + id + '\')">' +
        esc(id) + '</span>' +
        '<div class="dims">members ' + part.pos.length +
        (part.base ? ' · base ' + esc(part.base.inst) + '.' + part.base.pt : ' · no base') +
        (used ? '' : ' · not assembled') + '</div></td>';
      tbl.appendChild(tr);

    });
  }

  // The module's member plates, listed beside its preview: hide/show, local
  // axes and per-plate opacity for the module currently open.
  function buildPvTree(id, force) {
    var host = document.getElementById('pb-pv-tree');
    if (!host) return;
    var part = lastParts[id];
    if (!part) { host.style.display = 'none'; host.innerHTML = ''; pvTreeId = null; return; }
    host.style.display = 'block';
    // the preview rebuilds on every slider step - leave the panel's DOM alone
    // then, or the control being dragged is destroyed under the pointer
    if (!force && pvTreeId === id) return;
    pvTreeId = id;
    var t = document.createElement('table');
    var hr = document.createElement('tr');
    hr.className = 'thead';
    hr.innerHTML = '<td colspan="2">MEMBERS IN ' + esc(id) + '</td>';
    t.appendChild(hr);
    part.pos.forEach(function (row) {
      var key = id + '/' + row.NO;
      var on = !memberHidden[key];
      var tr = document.createElement('tr');
      tr.setAttribute('data-key', key);
      if (!on) tr.className = 'off';
      tr.innerHTML =
        '<td style="width:74px;white-space:nowrap">' +
        '<input type="checkbox" title="show / hide this plate"' + (on ? ' checked' : '') +
        ' onchange="plateBuilder.togglePvMember(\'' + id + '\',\'' + row.NO + '\',this.checked)">' +
        '<span class="sw" title="colour of this plate" style="background:' +
        int2hex(resolveColor({ plateId: row.PLATE }, (lastColors && lastColors[row.PLATE]) || 0x999999)) +
        '" onclick="plateBuilder.openPalette(event,\'plate\',\'' + row.PLATE + '\',this)"></span>' +
        '<input type="range" min="10" max="100" step="5" value="' +
        Math.round((ovOpac.member[key] !== undefined ? ovOpac.member[key] : 1) * 100) +
        '" title="opacity of this plate" ' +
        'oninput="plateBuilder.setOpacity(\'member\',\'' + key + '\',this.value)"></td>' +
        '<td><label class="nm" title="show local axes at its Ref.Pt">' +
        '<input type="checkbox"' + (memberAxes[key] ? ' checked' : '') +
        ' onchange="plateBuilder.toggleMemberAxis(\'' + id + '\',\'' + row.NO + '\',this.checked)"> ' +
        esc(row.NO) + '</label>' +
        '<div class="dims">' + esc(memberDesc(row)) +
        (part.base && part.base.inst === row.NO ? ' · BASE' : '') + '</div></td>';
      t.appendChild(tr);
    });
    host.innerHTML = '';
    host.appendChild(t);
  }

  function pvSnapsOf(id) {
    var part = lastParts[id], out = [];
    if (!part) return out;
    part.pos.forEach(function (row) {
      if (memberHidden[id + '/' + row.NO]) return;
      var spec = lastPlates[row.PLATE];
      if (!spec) return;
      var m;
      try { m = yupFix(memberMatrix(row, namedPoints(spec, false), spec.THK)); } catch (e) { return; }
      var g2 = buildPlate2D(spec, lastCuts, lastPlates);
      out = out.concat(snapPointsOf({ outers: g2.outers, holes: g2.holes }, spec.THK, m));
    });
    return out;
  }

  function togglePvMember(id, no, on) {
    var key = id + '/' + no;
    if (on) delete memberHidden[key]; else memberHidden[key] = true;
    var g = pvMemberObj[key];
    if (g) g.visible = !!on;
    if (measPv && measurePv) measPv.setSnaps(pvSnapsOf(id));
    var host = document.getElementById('pb-pv-tree');
    var tr = host && host.querySelector('tr[data-key="' + key + '"]');
    if (tr) tr.className = on ? '' : 'off';
  }


  /* ---------------- measure tool ---------------- */
  // Snap targets: every vertex of a plate's cut outline on both faces, plus the
  // centre of every hole (both faces and mid-thickness).
  function snapPointsOf(rings, thk, matrix) {
    var out = [], half = flatMode ? 0 : thk / 2;
    function push(x, y, z) { out.push(new THREE.Vector3(x, y, z).applyMatrix4(matrix)); }
    rings.outers.forEach(function (ring, i) {
      ring.forEach(function (q) {
        push(q[0], q[1], half);
        if (half) push(q[0], q[1], -half);
      });
      (rings.holes[i] || []).forEach(function (h) {
        var c = polyCentroid(h);
        push(c[0], c[1], half);
        if (half) { push(c[0], c[1], 0); push(c[0], c[1], -half); }
      });
    });
    return out;
  }

  var ringTex = null;
  function ringTexture() {                       // shared, never disposed
    if (ringTex) return ringTex;
    var cv = document.createElement('canvas');
    cv.width = cv.height = 96;
    var c = cv.getContext('2d');
    c.strokeStyle = '#ffffff';
    c.lineWidth = 12;
    c.beginPath();
    c.arc(48, 48, 36, 0, Math.PI * 2);
    c.stroke();
    ringTex = new THREE.CanvasTexture(cv);
    ringTex.userData.keep = true;
    return ringTex;
  }

  // One measuring session over a scene: hover snaps to the nearest point, two
  // clicks fix a span, a third starts over. Attached per view (main + preview).
  function createMeasure(cfg) {          // {scene, camera, dom, out, size}
    var M = { on: false, snaps: [], picks: [], hover: null, grp: null,
              down: null, moved: false };
    var v = new THREE.Vector3();

    function clear() {
      if (M.grp) { disposeScene(M.grp); cfg.scene.remove(M.grp); M.grp = null; }
    }
    // hollow ring, drawn as a camera-facing sprite so it reads as a circle
    // from any angle and never hides the point it marks
    function dot(p, color, d) {
      var m = new THREE.Sprite(new THREE.SpriteMaterial({
        map: ringTexture(), color: color, depthTest: false, transparent: true }));
      m.position.copy(p);
      m.scale.set(d, d, 1);
      return m;
    }
    function seg(a, b, color, r) {
      var g = new THREE.BufferGeometry().setFromPoints([a, b]);
      return new THREE.Line(g, new THREE.LineBasicMaterial({ color: color, depthTest: false }));
    }
    function fmt(n) { return (Math.round(n * 100) / 100).toString(); }

    function redraw() {
      clear();
      if (!M.on) { report(); return; }
      var g = new THREE.Group(), r = cfg.size() * 0.016;
      if (M.hover && M.picks.length < 2) g.add(dot(M.hover, 0xffff7a, r * 1.3));
      M.picks.forEach(function (p) { g.add(dot(p, 0xffe81f, r)); });
      if (M.picks.length === 2) {
        var a = M.picks[0], b = M.picks[1];
        g.add(seg(a, b, 0xffe81f));
        var c1 = new THREE.Vector3(b.x, a.y, a.z);      // X-Y-Z staircase
        var c2 = new THREE.Vector3(b.x, b.y, a.z);
        g.add(seg(a, c1, 0xe05c4f));
        g.add(seg(c1, c2, 0x6fc36f));
        g.add(seg(c2, b, 0x5c9bd1));
        var mid = a.clone().add(b).multiplyScalar(0.5);
        var lb = makeLabel(fmt(a.distanceTo(b)), '#ffe81f', cfg.size() * 0.045);
        lb.position.copy(mid);
        g.add(lb);
      }
      M.grp = g;
      cfg.scene.add(g);
      report();
    }

    function report() {
      var el = document.getElementById(cfg.out);
      if (!el) return;
      if (!M.on) { el.innerHTML = '&nbsp;'; return; }
      if (M.picks.length === 0) {
        el.innerHTML = '<span style="color:#6fb3e8">measure</span> — click a corner or a hole centre' +
          (M.hover ? ' &nbsp; <span style="color:#8a93a0">' + xyz(M.hover) + '</span>' : '');
        return;
      }
      if (M.picks.length === 1) {
        el.innerHTML = '<span style="color:#ffe81f">P1</span> ' + xyz(M.picks[0]) +
          ' &nbsp; — click the second point' +
          ' &nbsp; <span style="color:#5b6472">right click to clear</span>';
        return;
      }
      var a = M.picks[0], b = M.picks[1];
      el.innerHTML =
        '<span style="color:#e05c4f">\u0394X ' + fmt(b.x - a.x) + '</span> &nbsp; ' +
        '<span style="color:#6fc36f">\u0394Y ' + fmt(b.y - a.y) + '</span> &nbsp; ' +
        '<span style="color:#5c9bd1">\u0394Z ' + fmt(b.z - a.z) + '</span> &nbsp;&nbsp; ' +
        '<span style="color:#ffe81f">dist ' + fmt(a.distanceTo(b)) + '</span>' +
        ' &nbsp; <span style="color:#5b6472">right click to clear</span>';
    }
    function xyz(p) { return '(' + fmt(p.x) + ', ' + fmt(p.y) + ', ' + fmt(p.z) + ')'; }

    function nearest(ev) {
      var rect = cfg.dom.getBoundingClientRect();
      var mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
      var best = null, bd = 24 * 24;
      for (var i = 0; i < M.snaps.length; i++) {
        v.copy(M.snaps[i]).project(cfg.camera);
        if (v.z > 1) continue;
        var sx = (v.x + 1) / 2 * rect.width, sy = (1 - v.y) / 2 * rect.height;
        var d = (sx - mx) * (sx - mx) + (sy - my) * (sy - my);
        if (d < bd) { bd = d; best = M.snaps[i]; }
      }
      return best;
    }

    function onMove(ev) {
      if (!M.on) return;
      if (M.down) M.moved = M.moved ||
        Math.abs(ev.clientX - M.down[0]) + Math.abs(ev.clientY - M.down[1]) > 4;
      var h = nearest(ev);
      if (h === M.hover) return;
      M.hover = h;
      redraw();
    }
    function onDown(ev) { M.down = [ev.clientX, ev.clientY]; M.moved = false; }
    function onUp(ev) {
      var wasDrag = M.moved;
      M.down = null; M.moved = false;
      if (!M.on || wasDrag) return;
      if (ev.button === 2) {                      // right click clears the picks
        if (M.picks.length) { M.picks = []; redraw(); }
        return;
      }
      if (ev.button !== 0) return;
      var h = nearest(ev);
      if (!h) return;
      if (M.picks.length >= 2) M.picks = [];
      M.picks.push(h.clone());
      redraw();
    }
    function onCtx(ev) { if (M.on) ev.preventDefault(); }
    cfg.dom.addEventListener('mousemove', onMove);
    cfg.dom.addEventListener('mousedown', onDown);
    cfg.dom.addEventListener('mouseup', onUp);
    cfg.dom.addEventListener('contextmenu', onCtx);

    return {
      setSnaps: function (list) { M.snaps = list; M.picks = []; M.hover = null; redraw(); },
      enable: function (on) { M.on = !!on; M.picks = []; M.hover = null; redraw(); },
      isOn: function () { return M.on; },
      refresh: redraw,
      dispose: function () {
        clear();
        cfg.dom.removeEventListener('mousemove', onMove);
        cfg.dom.removeEventListener('mousedown', onDown);
        cfg.dom.removeEventListener('mouseup', onUp);
        cfg.dom.removeEventListener('contextmenu', onCtx);
      }
    };
  }

  function buildGizmo() {                       // small axis indicator (camera-synced)
    var scn = new THREE.Scene();
    var cam = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    [{ v: [1, 0, 0], c: 0xe05c4f, label: 'X' },
     { v: [0, 1, 0], c: 0x6fc36f, label: 'Y' },
     { v: [0, 0, 1], c: 0x5c9bd1, label: 'Z' }].forEach(function (d) {
      scn.add(new THREE.ArrowHelper(v3(d.v), new THREE.Vector3(0, 0, 0), 1.6, d.c, 0.35, 0.18));
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
      scn.add(spr);
    });
    return { scene: scn, camera: cam };
  }

  // draw the gizmo into the top-right corner of a renderer's canvas
  function drawGizmo(rn, gz, mainCam, target, w, h, gs) {
    var m = 8;
    gz.camera.position.copy(mainCam.position).sub(target).normalize().multiplyScalar(8.4);
    gz.camera.up.copy(mainCam.up);
    gz.camera.lookAt(0, 0, 0);
    rn.autoClear = false;
    rn.setScissorTest(true);
    rn.setViewport(w - gs - m, h - gs - m, gs, gs);
    rn.setScissor(w - gs - m, h - gs - m, gs, gs);
    rn.clearDepth();
    rn.render(gz.scene, gz.camera);
    rn.setScissorTest(false);
    rn.setViewport(0, 0, w, h);
    rn.autoClear = true;
  }

  function makeLabel(text, color, h) {          // canvas text as a camera-facing sprite
    var pad = 6, fs = 42;
    var cv = document.createElement('canvas');
    var c = cv.getContext('2d');
    c.font = 'bold ' + fs + 'px sans-serif';
    cv.width = Math.ceil(c.measureText(text).width) + pad * 2;
    cv.height = fs + pad * 2;
    c = cv.getContext('2d');
    c.font = 'bold ' + fs + 'px sans-serif';
    c.textBaseline = 'middle';
    c.fillStyle = 'rgba(21,24,28,0.8)';
    c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = color;
    c.fillText(text, pad, cv.height / 2);
    var spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true }));
    spr.scale.set(h * cv.width / cv.height, h, 1);
    return spr;
  }

  function shapesFromRings(rings) {
    return rings.outers.map(function (ring, i) {
      var shape = new THREE.Shape(ring.map(function (q) { return new THREE.Vector2(q[0], q[1]); }));
      (rings.holes[i] || []).forEach(function (h) {
        shape.holes.push(new THREE.Path(h.map(function (q) { return new THREE.Vector2(q[0], q[1]); })));
      });
      return shape;
    });
  }

  // thin coloured skins on both faces: warm = +side (thickness direction), cool = -side
  var TINT_PLUS = 0xffb45a, TINT_MINUS = 0x5aa0ff;
  function faceTint(rings, thk, matrix) {
    var g = new THREE.Group();
    var off = (flatMode ? 0 : thk / 2) + 0.25;
    shapesFromRings(rings).forEach(function (shape) {
      [[off, TINT_PLUS], [-off, TINT_MINUS]].forEach(function (side) {
        var geo = new THREE.ShapeGeometry(shape);
        geo.translate(0, 0, side[0]);
        var mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
          color: side[1], transparent: true, opacity: 0.5, side: THREE.DoubleSide,
          depthWrite: false }));
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(matrix);
        g.add(mesh);
      });
    });
    return g;
  }

  // local axis triad at a plate's centre: +Z is the thickness / offset direction
  // Plate-local Ref.Pt of a module member, in the plate's own coordinates
  function memberRef(spec, row) {
    var a = refAnchor(spec, row.REFPT, row.FACE);
    return { p: new THREE.Vector3(a[0], a[1], flatMode ? 0 : a[2]),
             name: isBarSpec(spec) ? 'start' : row.REFPT + faceMark(row.FACE) };
  }
  // Local axes of one plate. Drawn on the member's Ref.Pt when there is one -
  // that is the point its L.X/L.Y/L.Z were measured to - otherwise on the
  // outline centroid. The thickness axis is drawn both ways and labelled, so
  // which side is +Z can be read straight off the model.
  function plateTriad(spec, matrix, len, org, name) {
    var g = new THREE.Group();
    var c = org;
    if (!c) {
      var pc = (namedPoints(spec, false).mc) || [0, 0];
      c = new THREE.Vector3(pc[0], pc[1], 0);
    }
    g.matrixAutoUpdate = false;
    g.matrix.copy(matrix.clone().multiply(
      new THREE.Matrix4().makeTranslation(c.x, c.y, c.z)));
    var o = new THREE.Vector3();
    g.add(new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), o, len, 0xe05c4f, len * 0.26, len * 0.15));
    g.add(new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), o, len, 0x6fc36f, len * 0.26, len * 0.15));
    g.add(new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), o, len * 1.3, 0x5c9bd1, len * 0.3, len * 0.17));
    g.add(new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), o, len * 0.75, 0x7f8b9c, len * 0.22, len * 0.13));
    var plus = makeLabel('+Z', '#5c9bd1', len * 0.5);
    plus.position.set(0, 0, len * 1.62);
    g.add(plus);
    var minus = makeLabel('\u2212Z', '#9aa3b0', len * 0.5);
    minus.position.set(0, 0, -len * 1.05);
    g.add(minus);
    if (name) {                                  // the reference point itself
      var mk = new THREE.Sprite(new THREE.SpriteMaterial({
        map: ringTexture(), color: 0xf0c674, depthTest: false, transparent: true }));
      mk.scale.set(len * 0.36, len * 0.36, 1);
      g.add(mk);
      var lb = makeLabel(name, '#f0c674', len * 0.44);
      lb.position.set(-len * 0.52, -len * 0.36, 0);
      g.add(lb);
    }
    return g;
  }
  // sized off the plate, but never so small it is unreadable in a big model
  function ringsCenter(rings) {
    var bb = new THREE.Box2();
    rings.outers.forEach(function (ring) {
      ring.forEach(function (q) { bb.expandByPoint(new THREE.Vector2(q[0], q[1])); });
    });
    var c = bb.getCenter(new THREE.Vector2());
    return new THREE.Vector3(c.x, c.y, 0);
  }
  function triadLen(spec, min) {
    var w = spec.SHAPE === 'CIRC' ? num(spec.D, 100) : Math.max(num(spec.WB, 0), num(spec.WT, 0));
    return Math.max(20, min || 0, Math.min(w, num(spec.H, 100)) * 0.3);
  }

  // One WebGL context for the preview, reused across opens. Building a new
  // renderer per open exhausts the browser's context budget - the opacity and
  // axis controls reopen the preview on every input step - and once the budget
  // is gone the preview stays blank until the page is reloaded.
  function pvGetRenderer(host, W, H) {
    if (pvRenderer) {
      var gl = pvRenderer.getContext();
      if (gl && gl.isContextLost && gl.isContextLost()) pvRenderer = null;
    }
    if (!pvRenderer) {
      try {
        pvRenderer = new THREE.WebGLRenderer({ antialias: true });
      } catch (e) {
        console.error('[plateBuilder] preview renderer: ' + e.message);
        return null;
      }
      pvRenderer.setPixelRatio(window.devicePixelRatio || 1);
    }
    pvRenderer.setSize(W, H);
    if (pvRenderer.domElement.parentNode !== host) host.appendChild(pvRenderer.domElement);
    return pvRenderer;
  }
  function disposeScene(sc) {
    sc.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        [].concat(o.material).forEach(function (m) {
          if (m.map && !(m.map.userData && m.map.userData.keep)) m.map.dispose();
          m.dispose();
        });
      }
    });
  }
  function stopPreview3D() {
    pvToken++;                                   // stops the render loop
    if (pvCtrl) { pvCtrl.dispose(); pvCtrl = null; }
    if (pvScene) { disposeScene(pvScene); pvScene = null; }
  }

  function previewModule(id) {
    var part = lastParts[id];
    if (!part) return;
    var modal = document.getElementById('pb-modal');
    var host = document.getElementById('pb-pv3d');
    if (!modal || !host) return;
    stopPreview3D();
    pvModuleId = id;
    document.getElementById('pb-pv-flat').checked = flatMode;
    ['pb-pv-flat', 'pb-pv-meas', 'pb-pv-ids', 'pb-pv-faces'].forEach(function (q) {
      document.getElementById(q).parentNode.style.display = 'flex';
    });
    document.getElementById('pb-pv-stl').style.display = 'block';
    document.getElementById('pb-pv-ifc').style.display = 'block';
    document.getElementById('pb-pv-canvas').style.display = 'none';
    host.style.display = 'block';
    modal.style.display = 'flex';

    var pvTitle = document.getElementById('pb-pv-title');
    var pvMeta = document.getElementById('pb-pv-meta');
    pvTitle.textContent = id + '  (module)';     // set first, so the box is never blank
    pvMeta.textContent = '';

    var W = 960, H = 540;                        // 16:9
    var sc = new THREE.Scene();
    pvScene = sc;
    sc.background = new THREE.Color(0x15181c);
    var cam = new THREE.PerspectiveCamera(40, W / H, 1, 50000);
    cam.up.set(0, 0, 1);                         // Z-up world
    var rn = pvGetRenderer(host, W, H);
    if (!rn) {
      pvMeta.innerHTML = '<span style="color:#f09a9a">3D preview unavailable — ' +
                         'the browser gave no WebGL context. Reload the page.</span>';
      return;
    }

    var hemi = new THREE.HemisphereLight(0xf4f6fa, 0x2a2d33, 0.95);
    hemi.position.set(0, 0, 1);
    sc.add(hemi);
    var sun = new THREE.DirectionalLight(0xffffff, 0.75);
    sun.position.set(500, -650, 900);
    sc.add(sun);

    var bbox = new THREE.Box3(), mass = 0, basePt = null, bad = [], pvSnaps = [], axRows = [],
        idRows = [];
    pvMemberObj = {};
    part.pos.forEach(function (row) {
     try {
      var spec = lastPlates[row.PLATE];
      if (!spec) { bad.push(row.NO); return; }
      var pts = namedPoints(spec, false);
      var m;
      try { m = yupFix(memberMatrix(row, pts, spec.THK)); } catch (e) { return; }
      if (part.base && row.NO === part.base.inst) {
        var a = refAnchor(spec, part.base.pt, part.base.face);
        basePt = new THREE.Vector3(a[0], a[1], a[2]).applyMatrix4(m);
      }
      var g2d = buildPlate2D(spec, lastCuts, lastPlates);
      mass += g2d.area * spec.THK * RHO;
      var mkey = id + '/' + row.NO;
      var mg = new THREE.Group();            // one group per member, so it can be hidden
      mg.visible = !memberHidden[mkey];
      pvMemberObj[mkey] = mg;
      sc.add(mg);
      if (memberAxes[mkey]) axRows.push({ spec: spec, m: m, rp: memberRef(spec, row), g: mg });
      if (showIdsPv) idRows.push({ text: row.NO,
                                 pos: ringsCenter({ outers: g2d.outers }).applyMatrix4(m), g: mg });
      if (showFacesPv) mg.add(faceTint({ outers: g2d.outers, holes: g2d.holes }, spec.THK, m));
      if (mg.visible) {
        pvSnaps = pvSnaps.concat(snapPointsOf({ outers: g2d.outers, holes: g2d.holes }, spec.THK, m));
      }
      var pop = resolveOpac({ plateId: row.PLATE, moduleId: id, memberKey: id + '/' + row.NO });
      var mat = new THREE.MeshPhongMaterial({
        color: resolveColor({ plateId: row.PLATE }, lastColors[row.PLATE] || 0x999999),
        shininess: 28, side: THREE.DoubleSide,
        transparent: pop < 1, opacity: pop, depthWrite: pop >= 1 });
      g2d.outers.forEach(function (ring, i) {
        var shape = new THREE.Shape(ring.map(function (q) { return new THREE.Vector2(q[0], q[1]); }));
        (g2d.holes[i] || []).forEach(function (h) {
          shape.holes.push(new THREE.Path(h.map(function (q) { return new THREE.Vector2(q[0], q[1]); })));
        });
        var geo = plateGeom(shape, spec.THK);
        var mesh = new THREE.Mesh(geo, mat);
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(m);
        mg.add(mesh);
        geo.computeBoundingBox();
        bbox.union(geo.boundingBox.clone().applyMatrix4(m));   // frame stays put when hiding
        var eg = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25),
                                        new THREE.LineBasicMaterial({ color: 0x0e1013 }));
        eg.matrixAutoUpdate = false;
        eg.matrix.copy(m);
        mg.add(eg);
      });
     } catch (e) {                               // one bad plate must not blank the box
      bad.push(row.NO);
      console.error('[plateBuilder] ' + id + '/' + row.NO + ': ' + e.message);
     }
    });

    var center = bbox.isEmpty() ? new THREE.Vector3() : bbox.getCenter(new THREE.Vector3());
    var size = bbox.isEmpty() ? 500 : bbox.getSize(new THREE.Vector3()).length();
    var mn = bbox.min, mx3 = bbox.max;
    axRows.forEach(function (a) {
      a.g.add(plateTriad(a.spec, a.m, triadLen(a.spec, size * 0.1), a.rp.p, a.rp.name));
    });
    idRows.forEach(function (d) {
      var lb = makeLabel(d.text, '#dfe6f0', size * 0.045);
      lb.position.copy(d.pos);
      d.g.add(lb);
    });

    if (basePt) {                              // module base point
      var mk = new THREE.Mesh(new THREE.SphereGeometry(size * 0.022, 20, 14),
                              new THREE.MeshBasicMaterial({ color: 0xf0c674, depthTest: false }));
      mk.position.copy(basePt);
      sc.add(mk);
      var cr = size * 0.09, cmat = new THREE.LineBasicMaterial({ color: 0xf0c674, depthTest: false });
      [[new THREE.Vector3(cr, 0, 0)], [new THREE.Vector3(0, cr, 0)], [new THREE.Vector3(0, 0, cr)]]
        .forEach(function (v) {
          sc.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(
            [basePt.clone().sub(v[0]), basePt.clone().add(v[0])]), cmat));
        });
      var bl = makeLabel('BASE (' + Math.round(basePt.x) + ', ' + Math.round(basePt.y) + ', ' +
                         Math.round(basePt.z) + ')', '#f0c674', size * 0.05);
      bl.position.copy(basePt.clone().add(new THREE.Vector3(-size * 0.13, -size * 0.13, -size * 0.06)));
      sc.add(bl);
      sc.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([basePt, bl.position.clone()]),
                            new THREE.LineBasicMaterial({ color: 0xf0c674, depthTest: false })));
    }
    // Floor grid. Its centre lines still mark X=0 / Z=0, but it hangs below the
    // model instead of sitting on the Y=0 plane - a plate lying on that plane is
    // coplanar with it and the grid bleeds through the plate.
    var reach = bbox.isEmpty() ? 500 : Math.max(
      Math.abs(mn.x), Math.abs(mx3.x), Math.abs(mn.y), Math.abs(mx3.y), size * 0.3);
    var gspan = Math.ceil(reach * 2 / 100) * 100;
    var gz = (bbox.isEmpty() ? 0 : Math.min(0, mn.z)) - Math.max(1, size * 0.02);
    var grid = new THREE.GridHelper(gspan, Math.max(4, Math.round(gspan / 50)), 0x5b6472, 0x242a31);
    grid.rotation.x = Math.PI / 2;               // GridHelper is XZ by default, lay it on XY
    grid.position.set(0, 0, gz);
    sc.add(grid);

    // module-local origin: the point L.X/L.Y/L.Z are measured from. Drawn on top
    // of the plates so it stays readable, with a drop line onto the grid centre.
    var oLen = size * 0.13;
    [[new THREE.Vector3(oLen, 0, 0), 0xe05c4f],
     [new THREE.Vector3(0, oLen, 0), 0x6fc36f],
     [new THREE.Vector3(0, 0, oLen), 0x5c9bd1]].forEach(function (a) {
      sc.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(
        [new THREE.Vector3(0, 0, 0), a[0]]),
        new THREE.LineBasicMaterial({ color: a[1], depthTest: false })));
    });
    sc.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(
      [new THREE.Vector3(0, 0, gz), new THREE.Vector3(0, 0, 0)]),
      new THREE.LineBasicMaterial({ color: 0x6b7480, depthTest: false })));
    var ol = makeLabel('0, 0, 0', '#9aa3b0', size * 0.042);
    ol.position.set(-oLen * 0.75, -oLen * 0.4, -oLen * 0.3);
    sc.add(ol);

    var ctr = new THREE.OrbitControls(cam, rn.domElement);
    pvCtrl = ctr;
    ctr.enableDamping = true;
    ctr.dampingFactor = 0.1;
    cam.position.set(center.x + size * 1.05, center.y - size * 1.2, center.z + size * 0.85);
    ctr.target.copy(center);
    ctr.update();
    pvHome = { pos: cam.position.clone(), tgt: ctr.target.clone() };

    pvMeta.innerHTML =
      'members ' + part.pos.length + ' &middot; ' + mass.toFixed(3) + ' kg &middot; ' +
      (part.base ? 'base ' + esc(part.base.inst) + '.' + part.base.pt +
                   faceMark(part.base.face) + ' <span style="color:#f0c674">(&#9679;)</span>'
                 : '<span style="color:#f0c674">no BASE — local origin</span>') +
      (bad.length ? ' &middot; <span style="color:#f09a9a">not drawn: ' +
                    esc(bad.join(', ')) + '</span>' : '') +
      ' &nbsp;&nbsp;<span style="color:#5b6472">drag to rotate</span>';

    if (measPv) measPv.dispose();
    measPv = createMeasure({ scene: sc, camera: cam, dom: rn.domElement,
                             out: 'pb-pv-pos', size: function () { return size; } });
    buildPvTree(id);
    measPv.setSnaps(pvSnaps);
    document.getElementById('pb-pv-meas').checked = measurePv;
    document.getElementById('pb-pv-ids').checked = showIdsPv;
    document.getElementById('pb-pv-faces').checked = showFacesPv;
    measPv.enable(measurePv);

    var pgz = buildGizmo();
    pvToken++;
    var token = pvToken;
    (function loop() {
      if (token !== pvToken) return;
      requestAnimationFrame(loop);
      ctr.update();
      rn.render(sc, cam);
      drawGizmo(rn, pgz, cam, ctr.target, W, H, 74);
    })();
  }

  /* ---------------- sidebar list ---------------- */
  // The assembly list stops at ASSY and MODULE level: an assembly row, then one
  // row per module placed in it (a plate placed on its own gets its own row).
  // Individual plates live in the MODULE list and its preview.
  var listRows = [], listGroups = [];   // display order, for checkbox syncing
  function buildList(colors) {
    var tbl = document.getElementById('pb-list');
    var total = 0;
    tbl.innerHTML = '';
    listRows = [];
    listGroups = [];
    sectionRow(tbl, 'ghead', 'ASSEMBLY — placed modules');
    if (!items.length) sectionRow(tbl, 'none', 'no ASSY row — nothing placed');

    var groups = [], gmap = {};
    items.forEach(function (it) {
      total += it.mass;
      var g = gmap[it.group];
      if (!g) { g = gmap[it.group] = { name: it.group, rows: [], rmap: {} }; groups.push(g); }
      var r = g.rmap[it.instKey];
      if (!r) {
        r = g.rmap[it.instKey] = { key: it.instKey, group: it.group, moduleId: it.moduleId,
                                   plateId: it.plateId, n: 0, mass: 0, items: [] };
        g.rows.push(r);
      }
      r.n++; r.mass += it.mass; r.items.push(it);
    });

    groups.forEach(function (g) {
      var gi = listGroups.length;
      listGroups.push(g);
      var gtr = document.createElement('tr');
      gtr.className = 'gsub';
      var gOn = g.rows.some(function (r) {
        return r.items.some(function (it) { return it.groupObj.visible; });
      });
      gtr.innerHTML = '<td class="sty"><input type="checkbox" id="pb-gb' + gi + '"' +
        (gOn ? ' checked' : '') + ' ' +
        'onchange="plateBuilder.toggleGroup(\'' + g.name + '\',this.checked)">' +
        '<input type="range" min="10" max="100" step="5" value="' +
        Math.round((ovOpac.group[g.name] !== undefined ? ovOpac.group[g.name] : 1) * 100) +
        '" title="opacity of this assembly" ' +
        'oninput="plateBuilder.setOpacity(\'group\',\'' + g.name + '\',this.value)"></td>' +
        '<td>\u25be <span class="gname">' +
        (g.name === '-' ? 'single plates' : esc(g.name)) + '</span></td>';
      tbl.appendChild(gtr);

      g.rows.forEach(function (r) {
        var ri = listRows.length;
        listRows.push(r);
        var col = r.moduleId ? moduleColor(r.moduleId)
                             : resolveColor({ plateId: r.plateId }, r.items[0].baseColor);
        var cscope = r.moduleId ? 'module' : 'plate';
        var ckey = r.moduleId || r.plateId;
        var open = r.moduleId
          ? 'plateBuilder.previewModule(\'' + r.moduleId + '\')'
          : 'plateBuilder.preview(\'' + r.plateId + '\')';
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td class="sty"><input type="checkbox" id="pb-ib' + ri + '"' +
          (r.items.some(function (it) { return it.groupObj.visible; }) ? ' checked' : '') + ' ' +
          'data-grp="' + esc(r.group) + '" ' +
          'onchange="plateBuilder.toggleInst(' + ri + ',this.checked)">' +
          '<span class="sw" style="margin-left:5px;background:' + int2hex(col) +
          '" title="colour of this ' + cscope +
          '" onclick="plateBuilder.openPalette(event,\'' + cscope + '\',\'' + ckey + '\',this)">' +
          '</span></td>' +
          '<td><span class="plname subname" onclick="' + open + '">' +
          esc(r.moduleId || r.plateId) + '</span>' +
          '<div class="dims">' + (r.moduleId ? 'members ' + r.n : r.items[0].dims) +
          ' · ' + r.mass.toFixed(3) + 'kg' +
          '<input type="range" min="10" max="100" step="5" value="' +
          Math.round(resolveOpac(r.items[0]) * 100) +
          '" title="opacity of this placement" ' +
          'oninput="plateBuilder.setOpacity(\'inst\',\'' + r.key + '\',this.value)">' +
          '</div></td>';
        tbl.appendChild(tr);
      });
    });
    document.getElementById('pb-total').textContent =
      'Placed members: ' + items.length + ' · Total weight: ' + total.toFixed(3) + ' kg';
  }
  function toggleInst(i, on) {
    var r = listRows[i];
    if (!r) return;
    r.items.forEach(function (it) { it.groupObj.visible = on; });
    listGroups.forEach(function (g, gi) {         // header follows its rows
      if (g.name !== r.group) return;
      var cb = document.getElementById('pb-gb' + gi);
      if (cb) cb.checked = g.rows.some(function (q) {
        return q.items.some(function (it) { return it.groupObj.visible; });
      });
    });
    updateSceneAxes();
    updateSceneFaces();
    updateSceneIds();
    syncMeasureSnaps();
  }
  function toggleItem(i, on) {
    items[i].groupObj.visible = on;
    updateSceneAxes(); updateSceneFaces(); updateSceneIds(); syncMeasureSnaps();
  }
  function toggleGroup(g, on) {
    items.forEach(function (it) { if (it.group === g) it.groupObj.visible = on; });
    listRows.forEach(function (r, i) {
      if (r.group !== g) return;
      var cb = document.getElementById('pb-ib' + i);
      if (cb) cb.checked = on;
    });
    updateSceneAxes();
    updateSceneFaces();
    updateSceneIds();
    syncMeasureSnaps();
  }
  function syncMeasureSnaps() {
    if (measMain && showMeasure) measMain.setSnaps(mainSnaps());
  }

  /* -------- STL export (world transforms applied) -------- */
  // triangles come from the stored rings, so the flat view and the module
  // preview (which has no scene meshes) export identical solids
  // The scene is already Z-up, so STL/IFC take the world matrices as they are.
  function buildSTL(list, name) {
    var out = 'solid ' + name + '\n';
    list.forEach(function (it) {
      it.rings.outers.forEach(function (ring, i) {
        var shape = new THREE.Shape(ring.map(function (q) { return new THREE.Vector2(q[0], q[1]); }));
        (it.rings.holes[i] || []).forEach(function (h) {
          shape.holes.push(new THREE.Path(h.map(function (q) { return new THREE.Vector2(q[0], q[1]); })));
        });
        var geo = new THREE.ExtrudeGeometry(shape, { depth: it.thk, bevelEnabled: false, curveSegments: 24 });
        geo.translate(0, 0, -it.thk / 2);
        var pos = geo.getAttribute('position');
        var idx = geo.getIndex();
        var n = idx ? idx.count / 3 : pos.count / 3;
        for (var k = 0; k < n; k++) {
          var a = idx ? idx.getX(k * 3) : k * 3;
          var b = idx ? idx.getX(k * 3 + 1) : k * 3 + 1;
          var c = idx ? idx.getX(k * 3 + 2) : k * 3 + 2;
          var vA = new THREE.Vector3().fromBufferAttribute(pos, a).applyMatrix4(it.matrix);
          var vB = new THREE.Vector3().fromBufferAttribute(pos, b).applyMatrix4(it.matrix);
          var vC = new THREE.Vector3().fromBufferAttribute(pos, c).applyMatrix4(it.matrix);
          var nr = new THREE.Vector3().crossVectors(
            new THREE.Vector3().subVectors(vB, vA),
            new THREE.Vector3().subVectors(vC, vA)).normalize();
          out += ' facet normal ' + nr.x + ' ' + nr.y + ' ' + nr.z + '\n  outer loop\n' +
                 '   vertex ' + vA.x + ' ' + vA.y + ' ' + vA.z + '\n' +
                 '   vertex ' + vB.x + ' ' + vB.y + ' ' + vB.z + '\n' +
                 '   vertex ' + vC.x + ' ' + vC.y + ' ' + vC.z + '\n  endloop\n endfacet\n';
        }
        geo.dispose();
      });
    });
    return out + 'endsolid ' + name + '\n';
  }

  function download(text, filename) {
    var link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([text], { type: 'application/octet-stream' }));
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  // plates of a module, in module-local coordinates (for preview exports)
  function moduleItems(id) {
    var part = lastParts[id];
    if (!part) return [];
    var out = [];
    part.pos.forEach(function (row) {
      if (memberHidden[id + '/' + row.NO]) return;      // export what the preview shows
      var spec = lastPlates[row.PLATE];
      if (!spec) return;
      var m;
      try { m = yupFix(memberMatrix(row, namedPoints(spec, false), spec.THK)); } catch (e) { return; }
      var g2 = buildPlate2D(spec, lastCuts, lastPlates);
      out.push({ no: row.NO, spec: spec, thk: spec.THK, matrix: m,
                 mass: g2.area * spec.THK * RHO, dims: '',
                 rings: { outers: g2.outers, holes: g2.holes } });
    });
    return out;
  }

  function exportSTL() {
    download(buildSTL(items.filter(function (it) { return it.groupObj.visible; }), 'plate_builder'),
             'plate_builder.stl');
  }
  function exportModuleSTL() {
    if (!pvModuleId) return;
    download(buildSTL(moduleItems(pvModuleId), pvModuleId), pvModuleId + '.stl');
  }
  function exportModuleIFC() {
    if (!pvModuleId) return;
    download(buildIFC(moduleItems(pvModuleId), pvModuleId), pvModuleId + '.ifc');
  }

  /* -------- IFC export (IFC2X3, parametric extrusions) --------
     Each visible part becomes an IfcPlate (IfcMember for bars) whose
     geometry is the exact 2D profile (with hole voids) extruded by the
     thickness — real BIM solids, not triangle meshes. */
  function exportIFC() {
    download(buildIFC(items.filter(function (it) { return it.groupObj.visible; }), 'plate_builder'),
             'plate_builder.ifc');
  }

  function buildIFC(list, projName) {
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
    var oProj = nx('IFCPROJECT(' + guid() + ',' + oOH + ',' + sq(projName) + ',$,$,$,$,(' +
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
    var solidPos = {};   // one placement per thickness (extrusion starts at -t/2)

    var elements = [];
    list.forEach(function (it) {
      var m = it.matrix.elements;                         // column-major, already Z-up
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
        if (!solidPos[it.thk]) {
          solidPos[it.thk] = nx('IFCAXIS2PLACEMENT3D(' + pt3(0, 0, -it.thk / 2) + ',$,$)');
        }
        return nx('IFCEXTRUDEDAREASOLID(' + profile + ',' + solidPos[it.thk] + ',' + oZ + ',' + f(it.thk) + ')');
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
      "FILE_NAME('" + projName + ".ifc','" + new Date().toISOString().slice(0, 19) +
      "',(''),('macroBIM'),'plate_builder.js','plate_builder','');\n" +
      "FILE_SCHEMA(('IFC2X3'));\nENDSEC;\nDATA;\n" +
      L.join('\n') + '\nENDSEC;\nEND-ISO-10303-21;\n';
    return out;
  }

  /* ---------------- views ---------------- */
  function setView(v) {
    var d = VDIST;                               // Z-up: front looks north, top looks down
    if (v === 'front') camera.position.set(CENTER.x, CENTER.y - d, CENTER.z);
    if (v === 'side')  camera.position.set(CENTER.x + d, CENTER.y, CENTER.z);
    if (v === 'top')   camera.position.set(CENTER.x, CENTER.y - 0.01, CENTER.z + d);
    if (v === 'iso')   camera.position.set(CENTER.x + d * 0.58, CENTER.y - d * 0.65, CENTER.z + d * 0.5);
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
      '    <label class="chk"><input type="checkbox" id="pb-flat"' +
      '      onchange="plateBuilder.setFlat(this.checked)"> surface only</label>' +
      '    <label class="chk"><input type="checkbox" id="pb-axes"' +
      '      onchange="plateBuilder.setAxes(this.checked)"> local axes</label>' +
      '    <label class="chk"><input type="checkbox" id="pb-faces"' +
      '      onchange="plateBuilder.setFaces(this.checked)">' +
      '      <span style="color:#ffb45a">+</span>/<span style="color:#5aa0ff">&#8722;</span>' +
      '      face</label>' +
      '    <label class="chk"><input type="checkbox" id="pb-ids"' +
      '      onchange="plateBuilder.setIds(this.checked)"> id</label>' +
      '    <label class="chk"><input type="checkbox" id="pb-meas"' +
      '      onchange="plateBuilder.setMeasure(this.checked)"> measure</label>' +
      '  </div>' +
      '  <div id="pb-prog"><div id="pb-prog-label"></div>' +
      '    <div class="pb-track"><div id="pb-prog-bar"></div></div></div>' +
      '  <div id="pb-result"></div>' +
      '  <table id="pb-plates"></table>' +
      '  <table id="pb-bars"></table>' +
      '  <table id="pb-modules"></table>' +
      '  <table id="pb-list"></table>' +
      '  <div id="pb-total"></div>' +
      '  <div id="pb-note"></div>' +
      '</div>' +
      '<div id="pb-view"><div id="pb-hud">Drag: rotate · Wheel: zoom · Right-drag: pan</div>' +
      '  <div id="pb-meas-out">&nbsp;</div></div>' +
      '<div id="pb-pal"></div>' +
      '<div id="pb-modal"><div class="box">' +
      '  <h2><span class="close" onclick="plateBuilder.closePreview()">&#10005;</span>' +
      '      <button class="pvbtn" onclick="plateBuilder.regenPreview()"' +
      '        title="back to the opening view">regen</button>' +
      '      <button class="pvbtn" id="pb-pv-ifc" onclick="plateBuilder.exportModuleIFC()">IFC</button>' +
      '      <button class="pvbtn" id="pb-pv-stl" onclick="plateBuilder.exportModuleSTL()">STL</button>' +
      '      <label class="pvchk"><input type="checkbox" id="pb-pv-meas"' +
      '        onchange="plateBuilder.setMeasurePv(this.checked)"> measure</label>' +
      '      <label class="pvchk"><input type="checkbox" id="pb-pv-ids"' +
      '        onchange="plateBuilder.setIdsPv(this.checked)"> id</label>' +
      '      <label class="pvchk"><input type="checkbox" id="pb-pv-faces"' +
      '        onchange="plateBuilder.setFacesPv(this.checked)">' +
      '        <span style="color:#ffb45a">+</span>/<span style="color:#5aa0ff">&#8722;</span>' +
      '        surface</label>' +
      '      <label class="pvchk"><input type="checkbox" id="pb-pv-flat"' +
      '        onchange="plateBuilder.setFlat(this.checked)"> surface only</label>' +
      '      <span id="pb-pv-title"></span></h2>' +
      '  <div class="pvbody">' +
      '    <div id="pb-pv-tree"></div>' +
      '    <div>' +
      '      <canvas id="pb-pv-canvas" width="960" height="540"></canvas>' +
      '      <div id="pb-pv3d" style="width:960px;height:540px;display:none;' +
      '           border:1px solid #2c323b;border-radius:4px;overflow:hidden;"></div>' +
      '    </div>' +
      '  </div>' +
      '  <div class="meta" id="pb-pv-meta"></div>' +
      '  <div class="meta" id="pb-pv-pos">&nbsp;</div>' +
      '</div></div>';
    document.body.appendChild(app);
    var pal = document.getElementById('pb-pal');
    pal.innerHTML = SWATCHES.map(function (c) {
      return '<i style="background:' + c + '" onclick="plateBuilder.pickColor(\'' + c + '\')"></i>';
    }).join('');
    window.addEventListener('mousedown', function (e) {
      if (palPending && !document.getElementById('pb-pal').contains(e.target)) closePalette();
    });
    var modal = document.getElementById('pb-modal');
    var pvCv = document.getElementById('pb-pv-canvas');
    function pvPix(e) {                       // event -> canvas pixel coords
      var r = pvCv.getBoundingClientRect();
      return { x: (e.clientX - r.left) * pvCv.width / r.width,
               y: (e.clientY - r.top) * pvCv.height / r.height };
    }
    pvCv.addEventListener('wheel', function (e) {
      if (!pv) return;
      e.preventDefault();
      var s = pvPix(e);
      var xm = pv.minx + (s.x - pv.ox) / pv.sc;         // model point under the cursor
      var ym = pv.miny + (pv.H - pv.oy - s.y) / pv.sc;
      var f = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      pv.sc = Math.max(pv.fit * 0.2, Math.min(pv.fit * 40, pv.sc * f));
      pv.ox = s.x - (xm - pv.minx) * pv.sc;             // keep that point under the cursor
      pv.oy = pv.H - s.y - (ym - pv.miny) * pv.sc;
      drawPreview();
    }, { passive: false });
    var pvDrag = null, pvDown = null;
    function pvSnapAt(e) {
      if (!pvX) return null;
      var sp = pvPix(e), sx = sp.x, sy = sp.y;
      var snap = null, best = 13 * 13;             // snap radius in pixels
      pvPts.forEach(function (p) {
        var px = pvX.ox + (p.x - pvX.minx) * pvX.sc;
        var py = pvX.H - pvX.oy - (p.y - pvX.miny) * pvX.sc;
        var d2 = (px - sx) * (px - sx) + (py - sy) * (py - sy);
        if (d2 < best) { best = d2; snap = { p: p, px: px, py: py }; }
      });
      return snap;
    }
    pvCv.addEventListener('mousedown', function (e) {
      if (!pv) return;
      pvDown = { x: e.clientX, y: e.clientY, btn: e.button, moved: false };
      if (e.button !== 0) return;
      pvDrag = { x: e.clientX, y: e.clientY, ox: pv.ox, oy: pv.oy };
      pvCv.style.cursor = 'grabbing';
    });
    pvCv.addEventListener('contextmenu', function (e) { if (measurePv && pv) e.preventDefault(); });
    window.addEventListener('mouseup', function (e) {
      pvDrag = null;
      pvCv.style.cursor = 'crosshair';
      var d = pvDown;
      pvDown = null;
      if (!d || d.moved || !pv || pvModuleId || !measurePv) return;
      if (d.btn === 2) {                           // right click clears the span
        if (pvMeas.length) { pvMeas = []; drawPreview(); }
        return;
      }
      if (d.btn !== 0) return;
      var snap = pvSnapAt(e);
      if (!snap) return;
      if (pvMeas.length >= 2) pvMeas = [];
      pvMeas.push({ x: snap.p.x, y: snap.p.y });
      drawPreview();
    });
    pvCv.addEventListener('dblclick', function () { pvFit(); });
    pvCv.addEventListener('mousemove', function (e) {
      if (pvDown && (Math.abs(e.clientX - pvDown.x) + Math.abs(e.clientY - pvDown.y) > 4)) {
        pvDown.moved = true;
      }
      if (pvDrag && pv) {                                // pan
        var r = pvCv.getBoundingClientRect();
        pv.ox = pvDrag.ox + (e.clientX - pvDrag.x) * pvCv.width / r.width;
        pv.oy = pvDrag.oy - (e.clientY - pvDrag.y) * pvCv.height / r.height;
        drawPreview();
        return;
      }
      if (!pvX) return;
      var sp = pvPix(e), sx = sp.x, sy = sp.y;
      var x = pvX.minx + (sx - pvX.ox) / pvX.sc;
      var y = pvX.miny + (pvX.H - pvX.oy - sy) / pvX.sc;
      var snap = pvSnapAt(e);

      var ctx2 = pvCv.getContext('2d');
      if (pvBase) { ctx2.clearRect(0, 0, pvX.W, pvX.H); ctx2.drawImage(pvBase, 0, 0); }
      if (snap) {                                   // highlight the snapped point
        ctx2.strokeStyle = '#f0c674';
        ctx2.lineWidth = 1.5;
        ctx2.beginPath();
        ctx2.arc(snap.px, snap.py, 7, 0, Math.PI * 2);
        ctx2.stroke();
        ctx2.fillStyle = '#f0c674';
        ctx2.beginPath();
        ctx2.arc(snap.px, snap.py, 2.5, 0, Math.PI * 2);
        ctx2.fill();
      }
      var el = document.getElementById('pb-pv-pos');
      el.innerHTML = (snap
        ? '<span style="color:#f0c674">snap ' + snap.p.name + '</span> &nbsp;X <b style="color:#f0c674">' +
          snap.p.x.toFixed(1) + '</b> &nbsp; Y <b style="color:#f0c674">' + snap.p.y.toFixed(1) + '</b> mm'
        : 'cursor &nbsp;X <b style="color:#d8dce2">' + x.toFixed(1) +
          '</b> &nbsp; Y <b style="color:#d8dce2">' + y.toFixed(1) + '</b> mm') +
        (measurePv
          ? ' &nbsp;&nbsp;<span style="color:#5b6472">measure: ' +
            (pvMeas.length === 1 ? 'click the second point'
             : pvMeas.length ? 'right click to clear' : 'click a snap point') + '</span>'
          : '');
    });
    pvCv.addEventListener('mouseleave', function () {
      var el = document.getElementById('pb-pv-pos');
      if (el) el.innerHTML = '&nbsp;';
      if (pvBase && pvX) {
        var c2 = pvCv.getContext('2d');
        c2.clearRect(0, 0, pvX.W, pvX.H);
        c2.drawImage(pvBase, 0, 0);
      }
    });
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
    buildDOM(data.title || 'PLATE3D',
             data.subtitle || 'PLATE / CUT / ASSY data · unit: mm',
             data.note || (empty
               ? 'No data. Define PLATE/CUT/ASSY arrays as window.PLATE_DATA ' +
                 'or pass them to plateBuilder.run({...}) to display a model.'
               : null));

    var container = document.getElementById('pb-view');
    var w = container.clientWidth || 800, h = container.clientHeight || 600;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x15181c);
    camera = new THREE.PerspectiveCamera(40, w / h, 1, 50000);
    camera.up.set(0, 0, 1);                      // Z-up world
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    container.appendChild(renderer.domElement);

    var hemi = new THREE.HemisphereLight(0xf4f6fa, 0x2a2d33, 0.95);
    hemi.position.set(0, 0, 1);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xffffff, 0.75);
    sun.position.set(500, -650, 900);
    scene.add(sun);
    var back = new THREE.DirectionalLight(0x8899bb, 0.3);
    back.position.set(-600, 500, 300);
    scene.add(back);

    var colors = data.colors || {};
    pvModuleId = null;
    pvTreeId = null;
    var bbox = buildAll(data, colors);

    CENTER = bbox.isEmpty() ? new THREE.Vector3(0, 0, 150) : bbox.getCenter(new THREE.Vector3());
    var size = bbox.isEmpty() ? 900 : bbox.getSize(new THREE.Vector3()).length();
    if (!isFinite(size) || size <= 0) size = 900;
    sceneSize = size;
    VDIST = size * 1.5 + 200;

    var grid = new THREE.GridHelper(Math.ceil(size / 400) * 800, 32, 0x39424d, 0x242a31);
    grid.rotation.x = Math.PI / 2;               // GridHelper is XZ by default, lay it on XY
    grid.position.z = Math.min(-1, bbox.isEmpty() ? -1
                                 : bbox.min.z - Math.max(1, size * 0.004));
    scene.add(grid);

    var gz = buildGizmo();
    var axesScene = gz.scene, axesCamera = gz.camera;

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    setView('iso');

    // the sidebar must never be able to take the 3D view down with it
    try { buildPlateList(colors); } catch (e) { console.error('[plateBuilder] plate list: ' + e.message); }
    try { buildBarList(); } catch (e) { console.error('[plateBuilder] bar list: ' + e.message); }
    try { buildList(colors); } catch (e) { console.error('[plateBuilder] placed list: ' + e.message); }
    try { buildModuleList(); } catch (e) { console.error('[plateBuilder] module list: ' + e.message); }
    if (flatMode) document.getElementById('pb-flat').checked = true;
    if (showAxes) { document.getElementById('pb-axes').checked = true; updateSceneAxes(); }
    if (showFaces) { document.getElementById('pb-faces').checked = true; updateSceneFaces(); }
    if (showIds) { document.getElementById('pb-ids').checked = true; updateSceneIds(); }

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

    if (measMain) measMain.dispose();
    measMain = createMeasure({ scene: scene, camera: camera, dom: renderer.domElement,
                               out: 'pb-meas-out', size: function () { return size; } });
    if (showMeasure) { document.getElementById('pb-meas').checked = true; }
    setMeasure(showMeasure);

    var fitW = 0, fitH = 0;
    function fitRenderer() {                      // no-op while the pane has no size yet
      var cw = container.clientWidth, ch = container.clientHeight;
      if (!cw || !ch || (cw === fitW && ch === fitH)) return;
      fitW = cw; fitH = ch;
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
    }
    fitRenderer();
    if (onResize) window.removeEventListener('resize', onResize);
    onResize = fitRenderer;
    window.addEventListener('resize', onResize);

    (function animate() {
      if (token !== runToken) return;             // stop old loop after a re-run
      requestAnimationFrame(animate);
      fitRenderer();                              // panes can be resized without a window event
      controls.update();
      renderer.render(scene, camera);

      if (fitW && fitH) {
        drawGizmo(renderer, { scene: axesScene, camera: axesCamera }, camera, controls.target,
                  fitW, fitH, 110);
      }
    })();
  }

  function styleItem(it) {
    var col = resolveColor(it, it.baseColor);
    var op = resolveOpac(it);
    it.mat.color.setHex(col);
    it.mat.opacity = op;
    it.mat.transparent = op < 1;
    it.mat.depthWrite = op >= 1;
    it.mat.needsUpdate = true;
    it.edgeMat.transparent = op < 1;
    it.edgeMat.opacity = Math.min(1, op + 0.15);
  }
  function restyleAll() { items.forEach(styleItem); }

  function setColor(scope, key, hex) {
    ovColor[scope][key] = hex2int(hex);
    restyleAll();
    if (scope === 'plate') buildPlateList(lastColors);
    if (scope === 'module') buildModuleList();
    buildList(lastColors);
    refreshPreview();
    if (pvModuleId) buildPvTree(pvModuleId, true);
  }
  function setOpacity(scope, key, pct) {
    ovOpac[scope][key] = Math.max(0.05, Number(pct) / 100);
    restyleAll();
    refreshPreview();
  }

  var sceneFaces = null;
  function updateSceneFaces() {
    if (sceneFaces) { scene.remove(sceneFaces); sceneFaces = null; }
    if (!showFaces) return;
    sceneFaces = new THREE.Group();
    items.forEach(function (it) {
      if (!it.groupObj.visible) return;
      sceneFaces.add(faceTint(it.rings, it.thk, it.matrix));
    });
    scene.add(sceneFaces);
  }
  // snap targets for the main scene, rebuilt whenever visibility changes
  function mainSnaps() {
    var out = [];
    items.forEach(function (it) {
      if (!it.groupObj.visible) return;
      out = out.concat(snapPointsOf(it.rings, it.thk, it.matrix));
    });
    return out;
  }
  function setMeasure(on) {
    showMeasure = !!on;
    var cb = document.getElementById('pb-meas');
    if (cb) cb.checked = showMeasure;
    var out = document.getElementById('pb-meas-out');
    if (out) out.style.display = showMeasure ? 'block' : 'none';
    if (!measMain) return;
    measMain.setSnaps(showMeasure ? mainSnaps() : []);
    measMain.enable(showMeasure);
  }
  function setMeasurePv(on) {                   // one switch, whichever preview is open
    measurePv = !!on;
    var cb = document.getElementById('pb-pv-meas');
    if (cb) cb.checked = measurePv;
    if (pvModuleId) { if (measPv) measPv.enable(measurePv); return; }
    pvMeas = [];
    drawPreview();
  }

  function setFaces(on) {
    showFaces = !!on;
    var cb = document.getElementById('pb-faces');
    if (cb) cb.checked = showFaces;
    updateSceneFaces();
  }
  function setFacesPv(on) {
    showFacesPv = !!on;
    var cb = document.getElementById('pb-pv-faces');
    if (cb) cb.checked = showFacesPv;
    refreshPreview();
  }

  var sceneIds = null;
  function updateSceneIds() {
    if (sceneIds) { disposeScene(sceneIds); scene.remove(sceneIds); sceneIds = null; }
    if (!showIds) return;
    sceneIds = new THREE.Group();
    items.forEach(function (it) {
      if (!it.groupObj.visible) return;
      var lb = makeLabel(it.no, '#dfe6f0', sceneSize * 0.02);
      lb.position.copy(ringsCenter(it.rings).applyMatrix4(it.matrix));
      sceneIds.add(lb);
    });
    scene.add(sceneIds);
  }
  function setIds(on) {
    showIds = !!on;
    var cb = document.getElementById('pb-ids');
    if (cb) cb.checked = showIds;
    updateSceneIds();
  }
  function setIdsPv(on) {
    showIdsPv = !!on;
    var cb = document.getElementById('pb-pv-ids');
    if (cb) cb.checked = showIdsPv;
    refreshPreview();
  }

  var sceneAxes = null;
  function updateSceneAxes() {
    if (sceneAxes) { scene.remove(sceneAxes); sceneAxes = null; }
    if (!showAxes) return;
    sceneAxes = new THREE.Group();
    items.forEach(function (it) {
      if (!it.groupObj.visible) return;
      var rp = null;
      if (it.memberKey) {                        // module members know their Ref.Pt
        var part = lastParts[it.moduleId];
        var no = it.memberKey.slice(it.memberKey.indexOf('/') + 1);
        var row = part && part.pos.filter(function (q) { return q.NO === no; })[0];
        if (row) rp = memberRef(it.spec, row);
      }
      sceneAxes.add(plateTriad(it.spec, it.matrix, triadLen(it.spec, sceneSize * 0.045),
                               rp && rp.p, rp && rp.name));
    });
    scene.add(sceneAxes);
  }
  function setAxes(on) {
    showAxes = !!on;
    var cb = document.getElementById('pb-axes');
    if (cb) cb.checked = showAxes;
    updateSceneAxes();
  }
  // rebuild the open preview in place - the camera and its opening view survive,
  // so dragging a slider or ticking a box does not throw the view back
  function refreshPreview() {
    if (!pvModuleId) return;
    var keep = pvCtrl ? { pos: pvCtrl.object.position.clone(), tgt: pvCtrl.target.clone() } : null;
    var home = pvHome;
    previewModule(pvModuleId);
    if (home) pvHome = home;
    if (keep && pvCtrl) {
      pvCtrl.object.position.copy(keep.pos);
      pvCtrl.target.copy(keep.tgt);
      pvCtrl.update();
    }
  }
  function toggleMemberAxis(mod, pos, on) {
    memberAxes[mod + '/' + pos] = !!on;
    if (pvModuleId === mod) refreshPreview(); else previewModule(mod);
  }

  function setFlat(on) {
    flatMode = !!on;
    ['pb-flat', 'pb-pv-flat'].forEach(function (id) {
      var cb = document.getElementById(id);
      if (cb) cb.checked = flatMode;
    });
    items.forEach(function (it) {
      it.groupObj.children.forEach(function (obj) {
        var d = obj.userData;
        if (!d || !d.shape) return;
        var geo = plateGeom(d.shape, d.thk);
        obj.geometry.dispose();
        obj.geometry = obj.isMesh ? geo : new THREE.EdgesGeometry(geo, 25);
      });
    });
    updateSceneFaces();
    refreshPreview();      // keep an open preview in sync
  }

  function pickExcel() {
    var el = document.getElementById('pb-file');
    if (el) el.click();
  }

  window.plateBuilder = {
    run: run, setView: setView, exportSTL: exportSTL, exportIFC: exportIFC,
    toggleItem: toggleItem, toggleGroup: toggleGroup, toggleInst: toggleInst,
    pickExcel: pickExcel, loadExcelFile: loadExcelFile,
    preview: preview, previewModule: previewModule, closePreview: closePreview,
    setFlat: setFlat, setColor: setColor, setOpacity: setOpacity, fitPreview: pvFit,
    setMeasure: setMeasure, setMeasurePv: setMeasurePv, togglePvMember: togglePvMember,
    setIds: setIds, setIdsPv: setIdsPv, setFacesPv: setFacesPv,
    openPalette: openPalette, pickColor: pickColor, regenPreview: regenPreview,
    exportModuleSTL: exportModuleSTL, exportModuleIFC: exportModuleIFC,
    setAxes: setAxes, setFaces: setFaces,
    toggleMemberAxis: toggleMemberAxis
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
