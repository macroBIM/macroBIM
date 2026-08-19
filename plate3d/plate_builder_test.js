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

  // Palette and controls follow the PSCBOX page so the viewer reads as part of
  // the macroBIM site rather than a black box dropped into it: Inter, slate ink
  // on white cards, #2563eb for anything primary, #cbd5e1 / #e2e8f0 for rules.
  // The two canvases stay dark - they are the graphics area, and a dark
  // viewport framed in a light shell is the point, not an oversight.
  var CSS = [
    '#pb-app * { margin:0; padding:0; box-sizing:border-box; }',
    'body { background:#f8fafc; overflow:hidden; }',
    '#pb-app { --dim:#2563eb; --line:#cbd5e1; --hair:#e2e8f0; --ink:#182430;',
    '  display:flex; flex-direction:column; width:100vw; height:100vh; color:var(--ink);',
    '  background:#f8fafc; font-size:13px;',
    "  font-family:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif; }",

    /* ---- menu bar: the views, the exports and every toggle. Wraps to a second
       row on a narrow window - a control the user cannot see is worse than a
       bar one row taller. ---- */
    '#pb-bar { display:flex; flex-wrap:wrap; align-items:center; gap:8px; flex:0 0 auto;',
    '  background:#fff; border:1px solid var(--hair); border-radius:10px;',
    '  padding:8px 12px; margin:12px 12px 0; }',
    '#pb-bar .sep { width:1px; height:20px; background:var(--hair); margin:0 2px; flex:0 0 auto; }',
    '#pb-bar button { font:inherit; font-size:10.5px; font-weight:700; letter-spacing:.06em;',
    '  text-transform:uppercase; color:#334155; background:#fff; border:1px solid var(--line);',
    '  border-radius:6px; padding:5px 12px; cursor:pointer; flex:0 0 auto;',
    '  transition:background .12s,border-color .12s,box-shadow .12s,transform .06s; }',
    '#pb-bar button:hover { background:#f1f5f9; box-shadow:0 2px 6px rgba(15,23,42,.12); }',
    '#pb-bar button:active { transform:translateY(1px) scale(.97); box-shadow:none; }',
    '#pb-bar button.accent { background:var(--dim); border-color:var(--dim); color:#fff; }',
    '#pb-bar button.accent:hover { background:#1d4ed8; border-color:#1d4ed8;',
    '  box-shadow:0 2px 8px rgba(37,99,235,.35); }',
    // the view buttons behave as a radio set: the one you are looking through fills in
    '#pb-bar button.vw.active { background:var(--dim); border-color:var(--dim); color:#fff; }',
    '#pb-bar button.vw.active:hover { background:#1d4ed8; border-color:#1d4ed8; }',
    '#pb-bar button.guide { margin-left:auto; display:inline-flex; align-items:center;',
    '  gap:5px; text-transform:none; letter-spacing:0; font-size:12px; font-weight:600;',
    '  color:#1d4ed8; border-color:#bfdbfe; background:#eff6ff; }',
    '#pb-bar button.guide svg { flex:0 0 auto; }',
    '#pb-bar button.guide:hover { background:#dbeafe; border-color:#93c5fd; }',
    // Guide takes the auto margin that pushes the pair right; Example follows it
    '#pb-bar button.guide.ex { margin-left:0; color:#047857; border-color:#a7f3d0;',
    '  background:#ecfdf5; }',
    '#pb-bar button.guide.ex:hover { background:#d1fae5; border-color:#6ee7b7; }',
    '#pb-bar .chk { display:inline-flex; align-items:center; gap:5px; font-size:12px;',
    '  color:#475569; cursor:pointer; padding:5px 9px; border:1px solid var(--line);',
    '  border-radius:6px; background:#fff; flex:0 0 auto; transition:background .12s; }',
    '#pb-bar .chk:hover { background:#f1f5f9; }',
    '#pb-bar input[type=checkbox] { accent-color:var(--dim); cursor:pointer; margin:0; }',

    /* ---- body: list panel + 16:9 graphics pane ---- */
    '#pb-body { display:flex; flex:1 1 auto; min-height:0; gap:12px; padding:12px; }',
    '#pb-side { width:380px; min-width:380px; overflow-y:auto; background:#fff;',
    '  border:1px solid var(--line); border-radius:10px; padding:12px 14px; }',
    '#pb-side::-webkit-scrollbar { width:6px; }',
    '#pb-side::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:4px; }',
    '#pb-viewwrap { flex:1 1 auto; min-width:0; display:flex;',
    '  align-items:center; justify-content:center; }',
    // outline, not border: it draws the frame without eating into the box, so
    // the canvas fills the 16:9 pane exactly instead of losing a pixel each side
    '#pb-view { flex:0 0 auto; position:relative; background:#15181c;',
    '  outline:1px solid var(--line); border-radius:10px; overflow:hidden; }',
    '#pb-view canvas { display:block; }',
    '#pb-hud { position:absolute; left:12px; bottom:10px; color:#64748b; font-size:11px;',
    '  pointer-events:none; }',
    '#pb-meas-out { position:absolute; left:12px; top:10px; font-size:12px; color:#334155;',
    '  background:rgba(255,255,255,.92); border:1px solid var(--line); border-radius:6px;',
    '  padding:5px 10px; pointer-events:none; display:none; }',

    /* ---- list panel ---- */
    '#pb-side table { width:100%; border-collapse:collapse; margin-bottom:10px; }',
    '#pb-side td { padding:5px 4px; border-bottom:1px solid #f1f5f9;',
    '  vertical-align:middle; color:#334155; }',
    // section title (PLATES / MODULES / ASSEMBLY), styled like a PSCBOX card title
    '#pb-side tr.ghead td { color:#0f172a; font-size:12px; font-weight:600;',
    '  padding:14px 0 6px; border-bottom:1px solid var(--hair); }',
    '#pb-side tr.ghead td::before { content:""; display:inline-block; width:4px; height:12px;',
    '  border-radius:2px; background:var(--dim); margin-right:8px; vertical-align:-1px; }',
    '#pb-side tr.ghead:first-child td { padding-top:2px; }',
    // a foldable section: the caret replaces the bar, and the whole list under
    // the heading goes away by class - so a row already put away by its own
    // group fold stays put away when the section is opened again
    '#pb-side tr.ghead[data-sect] td::before { display:none; }',
    '#pb-side table.sect-shut tr:not(.ghead) { display:none; }',
    '#pb-side .sname { color:#0f172a; }',
    '#pb-side .scount { color:var(--dim); font-weight:500; margin-left:5px; }',
    '#pb-side .shint { color:var(--dim); font-weight:400; font-size:11px; margin-left:7px; }',
    // group header inside the assembly list
    '#pb-side tr.gsub td { color:#334155; font-size:12px; padding-top:9px;',
    '  border-bottom:1px solid var(--hair); }',
    '#pb-side .gname { color:#0f172a; font-size:13px; font-weight:600; cursor:pointer; }',
    '#pb-side .gname:hover { color:#1d4ed8; }',
    '#pb-side .gcount { color:#94a3b8; font-size:11px; font-weight:400; margin-left:6px; }',
    // the row picked in the list, shown against the same cyan as its outline
    // in the 3D view so the two read as one selection
    '#pb-side tr.sel td { background:#ecfeff; }',
    '#pb-side tr.sel .plname { color:#0e7490; font-weight:600; }',
    // the fold control leads the assembly id and carries that assembly's colour,
    // so it doubles as the group chip. Sized to the id next to it, not to a
    // caret - a 6px triangle was there to be hunted for.
    '#pb-side .fold { display:inline-block; margin-right:7px; vertical-align:-4px;',
    '  cursor:pointer; transition:transform .13s; }',
    '#pb-side .fold svg { display:block; }',
    '#pb-side .fold:hover { opacity:.72; }',
    '#pb-side .fold.shut { transform:rotate(-90deg); }',
    '#pb-side .plname { color:#1d4ed8; cursor:pointer; }',
    '#pb-side .plname:hover { color:#1e40af; text-decoration:underline; }',
    '#pb-side .plname.subname { color:#475569; font-size:11px; }',
    '#pb-side .plname.nolink { cursor:default; color:#334155; }',
    '#pb-side .plname.nolink:hover { color:#334155; text-decoration:none; }',
    '#pb-side tr.none td { color:#94a3b8; font-size:11px; font-style:italic; }',
    '#pb-side .chip { display:inline-block; width:11px; height:11px; border-radius:2px;',
    '  margin-right:5px; vertical-align:-1px; }',
    '#pb-side .sw { display:inline-block; width:17px; height:17px; border:1px solid var(--line);',
    '  border-radius:4px; cursor:pointer; vertical-align:middle; }',
    '#pb-side .sw:hover { border-color:#94a3b8; }',
    '#pb-side input[type=range] { width:42px; height:12px; vertical-align:middle;',
    '  margin-left:4px; accent-color:var(--dim); cursor:pointer; }',
    '#pb-side input[type=checkbox] { accent-color:var(--dim); cursor:pointer; }',
    '#pb-side td.sty { white-space:nowrap; width:70px; }',
    '#pb-side .caret { color:#94a3b8; cursor:pointer; font-size:10px; }',
    '#pb-side .caret:hover { color:#334155; }',
    '#pb-side .dims { color:#94a3b8; font-size:11px; }',
    // PLATES / BARS / SECTIONS are data tables: one member per row, every value
    // in its own cell, so the columns line up down the panel
    '#pb-plates td, #pb-bars td, #pb-sects td { padding:4px 8px 4px 4px; font-size:12px; }',
    '#pb-plates td.sty { width:26px; padding-right:2px; }',
    '#pb-sects td.sect { color:#475569; font-size:11px; white-space:nowrap; }',
    '#pb-side tr.chead td { color:#64748b; font-size:10px; letter-spacing:.06em;',
    '  text-transform:uppercase; background:#f1f5f9; padding:5px 8px 5px 4px;',
    '  border-bottom:1px solid var(--hair); }',
    '#pb-side td.num { text-align:right; white-space:nowrap; color:#334155; }',
    '#pb-side td.bid { color:#0f172a; font-weight:600; }',
    '#pb-side td.mat { color:#94a3b8; font-size:11px; white-space:nowrap; }',
    '#pb-total { color:#0f172a; font-size:12px; font-weight:600; margin:6px 0 12px; }',
    '#pb-prog { display:none; margin:0 0 10px; }',
    '#pb-prog-label { font-size:11px; color:#64748b; margin-bottom:4px; }',
    '.pb-track { height:8px; background:#e2e8f0; border-radius:4px; overflow:hidden; }',
    '#pb-prog-bar { height:100%; width:0; background:var(--dim); transition:width .15s; }',
    '#pb-result { display:none; border:1px solid; border-radius:8px; padding:9px 11px;',
    '  font-size:11px; line-height:1.55; margin-bottom:10px; word-break:break-all; }',
    '#pb-result.ok { border-color:#a7f3d0; background:#ecfdf5; color:#047857; }',
    '#pb-result.err { border-color:#fecaca; background:#fef2f2; color:#b91c1c; }',
    '#pb-result ul { margin:6px 0 0 16px; }',
    '#pb-result li.n { color:#b45309; }',       /* an aside, in either panel */
    '.rf { color:#94a3b8; font-size:9px; margin-left:4px; letter-spacing:.02em; }',
    '#pb-note { background:#f8fafc; border:1px solid var(--hair); border-radius:8px;',
    '  padding:9px 11px; font-size:11px; color:#64748b; line-height:1.6; }',

    /* ---- the sheet cannot be built at all: covers everything until dismissed ---- */
    '#pb-fatal { position:fixed; top:0; right:0; bottom:0; left:0; z-index:99999;',
    '  background:rgba(15,23,42,.55); display:flex; align-items:center;',
    '  justify-content:center; padding:24px; }',
    '#pb-fatal .box { background:#fff; border-radius:12px; max-width:560px; width:100%;',
    '  padding:20px 22px; box-shadow:0 18px 50px rgba(15,23,42,.35); font-size:13px;',
    '  color:#334155; line-height:1.6; }',
    '#pb-fatal h4 { margin:0 0 6px; font-size:15px; color:#b91c1c; }',
    '#pb-fatal .f { margin:0 0 10px; font-weight:600; color:#0f172a; }',
    '#pb-fatal ul { margin:0 0 12px 18px; padding:0; }',
    '#pb-fatal li { margin:0 0 7px; }',
    '#pb-fatal .n { margin:0 0 14px; color:#64748b; font-size:12px; }',
    '#pb-fatal button { border:0; border-radius:7px; background:#b91c1c; color:#fff;',
    '  padding:7px 20px; font-family:inherit; font-size:13px; font-weight:600;',
    '  cursor:pointer; float:right; }',
    '#pb-fatal:after { content:""; display:block; clear:both; }',

    /* ---- example workbook picker: a window, like the plate preview ---- */
    '#pb-ex { display:none; position:fixed; left:0; top:0; right:0; bottom:0; z-index:55;',
    '  background:rgba(15,23,42,.35); align-items:center; justify-content:center;',
    '  padding:20px; }',
    '#pb-ex .box { background:#fff; border:1px solid var(--line); border-radius:10px;',
    '  width:880px; max-width:96vw; max-height:92vh; overflow:auto; padding:14px;',
    '  box-shadow:0 12px 40px rgba(15,23,42,.24); }',
    '#pb-ex h2 { font-size:15px; font-weight:600; color:#0f172a; margin:0 0 7px; }',
    '#pb-ex .close { float:right; cursor:pointer; color:#94a3b8; padding:0 4px; }',
    '#pb-ex .close:hover { color:#0f172a; }',
    '#pb-ex .exi { margin:0 0 11px; font-size:11.5px; color:#64748b; line-height:1.6; }',
    /* a table, one row per example: five of them compare at a glance */
    '#pb-ex .ext { width:100%; border-collapse:collapse; table-layout:fixed; }',
    '#pb-ex .ext th { font-size:10px; font-weight:600; letter-spacing:.06em;',
    '  text-transform:uppercase; color:#94a3b8; text-align:left; padding:0 10px 6px;',
    '  border-bottom:1px solid var(--line); }',
    '#pb-ex .ext th.sz { text-align:right; }',
    '#pb-ex .ext td { padding:9px 10px; border-bottom:1px solid var(--hair);',
    '  vertical-align:middle; overflow:hidden; text-overflow:ellipsis;',
    '  white-space:nowrap; }',
    '#pb-ex .ext tbody tr { cursor:pointer; transition:background .12s; }',
    '#pb-ex .ext tbody tr:hover { background:#f0fdf4; }',
    '#pb-ex .ext tbody tr:last-child td { border-bottom:none; }',
    '#pb-ex .ext col.cn { width:170px; }  #pb-ex .ext col.cs { width:214px; }',
'#pb-ex .ext col.cb { width:96px; }',
'#pb-ex .exn { font-size:13px; font-weight:600; color:#0f172a; }',
    '#pb-ex .exn i { display:block; font-style:normal; font-weight:400; font-size:10px;',
    '  color:#94a3b8; margin-top:2px; }',
    '#pb-ex .exd { font-size:11.5px; color:#475569; }',
    '#pb-ex .exs { font-size:10.5px; color:#94a3b8; text-align:right; }',
    '#pb-ex .exbc { text-align:right; }',
    '#pb-ex .exb { display:inline-block; font-size:10px; font-weight:700;',
    '  letter-spacing:.06em; text-transform:uppercase; color:#047857;',
    '  border:1px solid #a7f3d0; background:#ecfdf5; border-radius:6px;',
    '  padding:5px 9px; min-width:62px; text-align:center; }',
    '#pb-ex .ext tbody tr:hover .exb { background:#047857; color:#fff;',
    '  border-color:#047857; }',
    '#pb-ex .exb.ok, #pb-ex .ext tbody tr:hover .exb.ok { background:#047857;',
    '  color:#fff; border-color:#047857; }',
    '#pb-ex .exb.bad, #pb-ex .ext tbody tr:hover .exb.bad { background:#fef2f2;',
    '  color:#b91c1c; border-color:#fecaca; }',
    '@media (max-width:640px) { #pb-ex .exd, #pb-ex .exs { display:none; } }',

    /* ---- colour palette popover ---- */
    '#pb-pal { display:none; position:fixed; z-index:60; grid-template-columns:repeat(4,20px);',
    '  gap:4px; padding:8px; background:#fff; border:1px solid var(--line); border-radius:8px;',
    '  box-shadow:0 8px 24px rgba(15,23,42,.16); }',
    '#pb-pal i { width:20px; height:20px; border-radius:4px; cursor:pointer;',
    '  border:1px solid rgba(15,23,42,.12); display:block; }',
    '#pb-pal i:hover { outline:2px solid var(--dim); }',

    /* ---- preview modal ---- */
    '#pb-modal { position:fixed; left:0; top:0; right:0; bottom:0; background:rgba(15,23,42,.35);',
    '  display:none; z-index:50; align-items:center; justify-content:center;',
    '  pointer-events:none; }',
    '#pb-modal .box { pointer-events:auto; background:#fff; border:1px solid var(--line);',
    '  border-radius:10px; max-width:97vw; max-height:96vh; overflow:auto;',
    '  padding:14px; box-shadow:0 12px 40px rgba(15,23,42,.24); }',
    '#pb-modal h2 { font-size:15px; font-weight:600; color:#0f172a; margin:0 0 10px; }',
    '#pb-modal .close { float:right; cursor:pointer; color:#94a3b8; padding:0 4px; }',
    '#pb-modal .close:hover { color:#0f172a; }',
    '#pb-modal .pvchk { float:right; font-size:11px; font-weight:normal; color:#475569;',
    '  cursor:pointer; margin-right:10px; display:flex; align-items:center; gap:5px;',
    '  padding:3px 8px; border:1px solid var(--line); border-radius:6px; }',
    '#pb-modal .pvchk:hover { background:#f1f5f9; }',
    '#pb-modal .pvchk input[type=checkbox] { accent-color:var(--dim); cursor:pointer; margin:0; }',
    '#pb-modal .pvbtn { float:right; margin-right:8px; font:inherit; font-size:10px;',
    '  font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#334155;',
    '  background:#fff; border:1px solid var(--line); border-radius:6px; padding:4px 10px;',
    '  cursor:pointer; transition:background .12s,box-shadow .12s; }',
    '#pb-modal .pvbtn:hover { background:#f1f5f9; box-shadow:0 2px 6px rgba(15,23,42,.12); }',
    '#pb-modal canvas { background:#15181c; border:1px solid var(--line); border-radius:8px;',
    '  display:block; cursor:crosshair; }',
    '#pb-modal .meta { color:#64748b; font-size:11px; margin-top:9px; }',
    '#pb-modal .pvbody { display:flex; gap:10px; align-items:flex-start; }',
    '#pb-pv3d { border:1px solid var(--line); border-radius:8px; }',
    /* The member panel is a table, and the table does not wrap - see PV_COLS.
       Its width is set from the table's own width when the preview opens, so
       these rules only have to lay it out: a caption that stays put, and one
       scrolling area under it holding the rows. */
    /* width and height are set when the preview opens - see pvModuleLayout */
    '#pb-pv-tree { display:none; flex-direction:column; overflow:hidden;',
    '  background:#fff; border:1px solid var(--line); border-radius:8px; }',
    '#pb-pv-tree .pvcap { flex:0 0 auto; color:#0f172a; font-size:10px; font-weight:700;',
    '  letter-spacing:.06em; text-transform:uppercase; padding:7px 9px 6px;',
    '  border-bottom:1px solid var(--hair); white-space:nowrap; overflow:hidden;',
    '  text-overflow:ellipsis; }',
    '#pb-pv-tree .pvcap span { color:var(--dim); font-weight:500; }',
    '#pb-pv-tree .pvscroll { flex:1 1 auto; min-height:0; overflow:auto; }',
    '#pb-pv-tree table { border-collapse:collapse; }',
    '#pb-pv-tree td, #pb-pv-tree th { padding:4px 9px 4px 0; white-space:nowrap;',
    '  vertical-align:middle; color:#334155; font-size:11px;',
    '  border-bottom:1px solid #f1f5f9; }',
    '#pb-pv-tree td:first-child, #pb-pv-tree th:first-child { padding-left:9px; }',
    /* sticky, so the column names survive scrolling a 60-member module */
    '#pb-pv-tree th { position:sticky; top:0; z-index:1; background:#fff;',
    '  color:#64748b; font-size:9px; font-weight:700; letter-spacing:.06em;',
    '  text-transform:uppercase; text-align:left;',
    '  border-bottom:1px solid var(--hair); }',
    '#pb-pv-tree th.num { text-align:right; }',
    /* ... and the controls and the name stay put when the table slides sideways,
       or you scroll to a coordinate with no way of telling whose it is */
    '#pb-pv-tree .who { position:sticky; left:0; z-index:2; background:#fff;',
    '  box-shadow:1px 0 0 var(--hair); }',
    '#pb-pv-tree th.who { z-index:3; }',
    '#pb-pv-tree tr.off td { opacity:.45; }',
    '#pb-pv-tree .nm { font-size:11px; color:#0f172a; font-weight:600; }',
    '#pb-pv-tree .num { text-align:right; font-variant-numeric:tabular-nums; }',
    '#pb-pv-tree .note { color:#b45309; font-size:9.5px; font-weight:700;',
    '  letter-spacing:.05em; }',
    '#pb-pv-tree input[type=range] { width:38px; height:11px; vertical-align:middle;',
    '  accent-color:var(--dim); cursor:pointer; }',
    '#pb-pv-tree input[type=checkbox] { margin:0 3px 0 0; vertical-align:middle;',
    '  accent-color:var(--dim); }',
    '#pb-pv-tree .sw { display:inline-block; width:12px; height:12px; border:1px solid var(--line);',
    '  border-radius:3px; cursor:pointer; vertical-align:middle; margin-right:3px; }',

    /* ---- user guide ---- */
    '#pb-help { position:fixed; left:0; top:0; right:0; bottom:0; background:rgba(15,23,42,.45);',
    '  display:none; z-index:70; align-items:center; justify-content:center; }',
    '#pb-help .box { background:#fff; border:1px solid var(--line); border-radius:10px;',
    '  width:min(1000px,94vw); max-height:92vh; display:flex; flex-direction:column;',
    '  box-shadow:0 12px 40px rgba(15,23,42,.24); overflow:hidden; }',
    '#pb-help header { display:flex; align-items:center; justify-content:space-between;',
    '  padding:12px 18px; border-bottom:1px solid var(--hair); background:#f1f5f9; }',
    '#pb-help header b { font-size:15px; font-weight:600; color:#0f172a; }',
    '#pb-help header span { cursor:pointer; color:#94a3b8; font-size:16px; padding:0 4px; }',
    '#pb-help header span:hover { color:#0f172a; }',
    '#pb-help .doc { overflow-y:auto; padding:4px 22px 26px; line-height:1.65; color:#334155; }',
    '#pb-help .doc::-webkit-scrollbar { width:8px; }',
    '#pb-help .doc::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:4px; }',
    '#pb-help h2 { font-size:15px; font-weight:600; color:#0f172a; margin:26px 0 8px;',
    '  display:flex; align-items:center; }',
    '#pb-help h2::before { content:""; display:inline-block; width:4px; height:15px;',
    '  border-radius:2px; background:var(--dim); margin-right:9px; flex-shrink:0; }',
    '#pb-help h3 { font-size:13px; font-weight:700; color:#0f172a; margin:20px 0 6px;',
    '  letter-spacing:.02em; }',
    '#pb-help p { margin:7px 0; font-size:12.5px; }',
    '#pb-help ul { margin:7px 0 7px 18px; font-size:12.5px; }',
    '#pb-help li { margin:3px 0; }',
    '#pb-help code { font-family:ui-monospace,Menlo,Consolas,monospace; font-size:11.5px;',
    '  background:#f1f5f9; border-radius:4px; padding:1px 5px; color:#0f172a; }',
    // examples are spreadsheet rows, so they are drawn as a spreadsheet
    '#pb-help .xlswrap { overflow-x:auto; margin:10px 0 4px; border:1px solid #b7c0cb;',
    '  border-radius:6px; }',
    '#pb-help table.xls { border-collapse:collapse; background:#fff; min-width:100%;',
    '  font-family:ui-monospace,Menlo,Consolas,monospace; font-size:11.5px; }',
    '#pb-help table.xls th { background:#eef1f5; color:#7c8899; font-weight:600;',
    '  text-align:center; padding:3px 9px; border:1px solid #cbd5e1; font-size:10.5px; }',
    '#pb-help table.xls td { padding:4px 9px; border:1px solid #dde3ea; color:#0f172a;',
    '  white-space:nowrap; }',
    '#pb-help table.xls .rn { background:#eef1f5; color:#94a3b8; text-align:center;',
    '  width:26px; font-weight:600; font-size:10.5px; border-color:#cbd5e1; }',
    '#pb-help table.xls td.kw { color:#1d4ed8; font-weight:700; }',
    '#pb-help table.xls td.n { text-align:right; }',
    '#pb-help table.xls tr.cmt td { color:#94a3b8; font-style:italic; background:#f8fafc; }',
    '#pb-help .xlsnote { font-size:11.5px; color:#94a3b8; margin:0 0 10px; }',
    '#pb-help table.gt { width:100%; border-collapse:collapse; font-size:12px; margin:9px 0; }',
    '#pb-help table.gt th { background:#1e293b; color:#fff; font-weight:600; text-align:left;',
    '  padding:6px 10px; border-right:1px solid #334155; }',
    '#pb-help table.gt th:last-child { border-right:none; }',
    '#pb-help table.gt td { padding:5px 10px; border-bottom:1px solid var(--hair);',
    '  vertical-align:top; }',
    '#pb-help table.gt tbody tr:nth-child(even) td { background:#f8fafc; }',
    '#pb-help .warn { background:#fffbeb; border:1px solid #fde68a; border-radius:8px;',
    '  padding:8px 12px; color:#b45309; }',
    '#pb-help figure { margin:12px 0; }',
    '#pb-help .gsvg { display:block; width:100%; max-width:560px; height:auto;',
    '  margin:0 auto; background:#f8fafc; border:1px solid var(--hair); border-radius:8px; }',
    '#pb-help figcaption { font-size:11.5px; color:#94a3b8; margin-top:5px; }',
    '#pb-help .flow { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin:12px 0; }',
    '#pb-help .flow span { display:flex; flex-direction:column; background:#eff6ff;',
    '  border:1px solid #bfdbfe; border-radius:8px; padding:7px 12px; font-size:12px;',
    '  font-weight:700; color:#1d4ed8; }',
    '#pb-help .flow small { font-weight:400; font-size:10.5px; color:#64748b; }',
    '#pb-help .flow i { color:#94a3b8; font-style:normal; font-size:13px; }',
    '#pb-help .lede { font-size:15px; font-weight:600; color:#0f172a; margin:10px 0 6px; }',
    '#pb-help .props { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:14px 0 4px; }',
    '@media(max-width:720px){ #pb-help .props { grid-template-columns:1fr; } }',
    '#pb-help .props div { background:#f8fafc; border:1px solid var(--hair); border-radius:8px;',
    '  padding:10px 13px; font-size:12px; line-height:1.6; }',
    '#pb-help .props b { display:block; color:#1d4ed8; font-size:12.5px; margin-bottom:2px; }',
    '#pb-help h3.warnhead { color:#b45309; }'
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
  /* The measure colours were picked for the viewport, which is nearly black, and
     there they are right: the picked dots, the line between them and its label
     all read at a glance. The readout is a white box, and on white that yellow
     is not a colour but a rumour - dist came out at about 1.1 : 1 against its own
     background, which is to say invisible.

     So the box gets darker settings of the same hues. X stays red, Y green, Z
     blue - still the gizmo's colours, just legible - and dist stays the amber
     one, so it still names the yellow line drawn in the view. The canvas keeps
     the bright set; only the text moved. */
  var MEAS_X = '#c2352a', MEAS_Y = '#1f7a33', MEAS_Z = '#2a6ca8',
      MEAS_D = '#b45309', MEAS_P = '#a16207';
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
  // The floor grid sits on z = 0, so its centre cross is the coordinate origin
  // and every line crossing reads a round X/Y. A plate lying on that same plane
  // is coplanar with it, which used to z-fight, so the grid is drawn first and
  // writes no depth: solids simply paint over it instead of arguing about it.
  function backdrop(o) {
    o.renderOrder = -1;
    [].concat(o.material).forEach(function (m) { m.depthWrite = false; });
    return o;
  }
  function plateGeom(shape, thk) {      // local plane = mid-thickness
    if (flatMode) return new THREE.ShapeGeometry(shape);
    var g = new THREE.ExtrudeGeometry(shape, { depth: thk, bevelEnabled: false, curveSegments: 24 });
    g.translate(0, 0, -thk / 2);
    return g;
  }
  var scene, camera, renderer, controls;
  // Two main-view cameras, swapped by the ortho checkbox. Only one is ever the
  // live `camera`; the other keeps its last framing so the toggle round-trips.
  var camPersp = null, camOrtho = null, orthoView = false;
  var MAIN_FOV = 40, mainAspect = 1.6;
  var lastPlates = {}, lastCuts = [], lastColors = {}, lastParts = {};  // for preview modals
  var shapeLib = {};        // HOLE definitions - cut shapes, never members
  /* ---- the example workbook ----
     It sits next to this file, so the button works from wherever the engine was
     loaded - the macroBIM server, GitHub Pages, jsDelivr - without any of them
     being written down here. document.currentScript is only readable while the
     script is running, so it is taken now rather than at click time. */
  var SAMPLE_XLSX = 'PLATE3D_SAMPLE.xlsx';
  var engineSrc = (document.currentScript && document.currentScript.src) || '';
  var pvToken = 0, pvRenderer = null, pvModuleId = null;   // 3D preview lifecycle
  var pvCtrl = null, pvScene = null, pvHome = null;   // pvHome = the preview's opening view
  var pvCamP = null, pvCamO = null, pvCam = null;     // the preview's two cameras
  var orthoPv = false, pvAspect = 16 / 9, pvBackDist = 1000;
  var pvX = null, pvPts = [], pvBase = null, pv = null;   // 2D preview state
  var pvMeas = [];                                       // 2D measure picks
  var pvRszWired = false;
  var CENTER = null, VDIST = 1200, sceneBox = null, sceneCloud = null;  // set in run()
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
       SECT  ID MAT Length TYPE BASE.pt <values>
                                              (rolled section, TYPE = H / C / L. The
                                               values run straight on with no gaps and
                                               each type has its own list:
                                                 H : h bb bt tw tf1 tf2 r1 r2
                                                     tf1 = bottom flange, tf2 = top
                                                 C : h b tw tf rw rf
                                                     rw = web root, rf = flange toe
                                                 L : a b t1 t2 r1 r2
                                                     t1 = a leg, t2 = b leg
                                               A radius of 0 or blank is fine - the
                                               corner just comes out square. Fillets are -
                                               both drawn, not approximated; dropping
                                               them costs ~2.6% of the area. A row that
                                               fails its checks is reported and skipped,
                                               never repaired. Placed like a BAR: no
                                               Ref.Pt, held by its starting face)
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
       MODULE ID BAR/SECT.ID REF.PT LX1 LY1 LZ1 LX2 LY2 LZ2 [OFF_B OFF_E ALPHA]
                                              (the same row with a number where the
                                               plane name would be: a bar or a section
                                               stretched from (LX1,LY1,LZ1) to
                                               (LX2,LY2,LZ2), its length taken from that
                                               distance - the Length on the BAR/SECT row
                                               becomes a reference value. OFF_B/OFF_E
                                               trim each end, negative to run past it;
                                               ALPHA rolls the section about its own
                                               axis; REF.PT names the point that rides
                                               the axis line, blank = the BASE.pt.
                                               BAR/SECT only - a plate has no axis)
       MODULE ID BASE INSTANCE POINT          (module reference point = one of the
                                               9 points of a member plate;
                                               missing BASE -> warning + local origin)
       -- name the same part as many times as you use it. The engine numbers
          the repeats itself - pl.c1 twice becomes pl.c1_1 and pl.c1_2 - so the
          sheet says what a thing is and never has to invent an instance name
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
                                               the MODULE, PLATE, BAR or earlier ASSY it
                                               is built from. Its reference point - a
                                               module's BASE, a plate's bc, a bar's start,
                                               an assembly's own origin - lands on global
                                               G.X/G.Y/G.Z, then ROT.X/Y/Z about it)
                                              (ADD rows sharing an ID build one assembly
                                               together, the way MODULE rows do. The first
                                               row anchors it; the rest still take absolute
                                               G.X/G.Y/G.Z, and the whole assembly moves as
                                               one when a later row places it again)
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
  /* One module member, broken into the cells of the preview panel's table.
     It used to be one run-on line - "A\u2192B \u00b7 (-2400, -2400, -400) \u2192 (2400, -2400,
     -400) \u00b7 L4800 \u00b7 off 140/140" - which in a 196px panel wrapped to four lines
     per member and stopped being readable at all. A fact per column reads, and
     coordinates in a column line up down the list.
     A key is left out when the member has nothing to say there, and the panel
     drops any column no member fills: a module of plates carries no empty
     TO / LENGTH columns for the sake of a module of bars. */
  var PV_COLS = [
    { k: 'plane', h: 'plane' },
    { k: 'ref',   h: 'ref.pt' },
    { k: 'at',    h: 'at' },
    { k: 'to',    h: 'to' },
    { k: 'len',   h: 'length', num: true },
    { k: 'rot',   h: 'rot',    num: true },
    { k: 'off',   h: 'offset', num: true },
    { k: 'ends',  h: 'end off', num: true },
    { k: 'note',  h: '' }
  ];
  function pvCells(row, part) {
    var c = {};
    if (row.__ax) {                             // start/end placement
      c.plane = 'A\u2192B';
      c.at = '(' + row.X1 + ', ' + row.Y1 + ', ' + row.Z1 + ')';
      c.to = '(' + row.X2 + ', ' + row.Y2 + ', ' + row.Z2 + ')';
      c.len = String(rnd(row.LEN));
      if (row.OFB || row.OFE) c.ends = row.OFB + ' / ' + row.OFE;
      if (row.ALPHA) c.rot = '\u03b1 ' + row.ALPHA;
    } else {
      c.plane = row.PL_IN || planeLabel(row.PLANE);
      c.ref = row.__bar ? 'start' : row.REFPT + faceMark(row.FACE);
      if (row.__xyz) c.at = '(' + row.LX + ', ' + row.LY + ', ' + row.LZ + ')';
      else c.off = String(row.OFFSET);
      var rot = row.__xyz ? [row.RX, row.RY, row.RZ] : [0, 0, row.ROT];
      if (rot[0] || rot[1] || rot[2]) c.rot = rot.join(' / ');
    }
    if (part && part.base && part.base.inst === row.NO) c.note = 'BASE';
    return c;
  }
  function rnd(x) { return Math.round(x * 100) / 100; }

  // fellBack = the name of the sheet read when the workbook had no "input" tab
  function parseExcelRows(rows, fellBack) {
    var plates = {}, holes = {}, parts = {}, cuts = [], assy = [], log = [];
    var assyIds = {};                    // ASSY ids already defined (can be referenced again)
    /* ---- naming inside an assembly ----
       The ID column is taken exactly as written and never suffixed: every row
       carrying that id builds the one assembly, so the list shows one group per
       id. What gets a new name is the thing being put in - the source id plus
       the command that placed it:
           ADD  -> MD.TOWER.A       MIR  -> MD.TOWER.M
           COPY -> MD.TOWER.C001    ROT  -> MD.TOWER.R001   (up to 999)
       ADD and MIR place one each, so they stay unnumbered until a second row
       of the same command on the same source forces the issue. */
    var CMD_SFX = { ADD: 'A', MIR: 'M', COPY: 'C', ROT: 'R' };
    var MAX_REP = 999;                   // .c001 ... .c999
    var memSeq = {};                     // assembly + source + command -> made so far
    function memberId(aid, ref, cmd) {
      var sfx = CMD_SFX[cmd] || 'a';
      var k = aid + ' ' + ref + ' ' + sfx;
      var n = memSeq[k] = (memSeq[k] || 0) + 1;
      var numbered = cmd === 'COPY' || cmd === 'ROT' || n > 1;
      return ref + '.' + sfx +
             (numbered ? (n < 1000 ? ('000' + n).slice(-3) : String(n)) : '');
    }
    var palias = PLANE_ALIAS, yup = false;   // switched by a COORD row
    var counts = { plate: 0, hole: 0, bar: 0, sect: 0, cut: 0, module: 0, assy: 0 };
    var current = null, currentPart = null, counter = {};
    // Two severities. warn() is a row the parser could not honour - skipped, or
    // a name that did not resolve - so what lands on screen is not what the
    // sheet asked for. hint() is a row that built exactly as written but reads
    // like a slip. Only warn() turns the result panel red.
    function warn(m) { log.push({ s: 'e', m: m }); console.error('[plateBuilder] ' + m); }
    function hint(m) { log.push({ s: 'w', m: m }); console.warn('[plateBuilder] ' + m); }
    // A fault the sheet cannot be built around at all. Everything else skips the
    // offending row and carries on; a fatal stops the load before anything is
    // drawn, because a model built from it would be quietly wrong rather than
    // visibly short.
    var fatals = [];
    function fatal(m) { fatals.push(m); log.push({ s: 'e', m: m }); console.error('[plateBuilder] ' + m); }
    // A member is addressed by "md.frame/pl.web" - by hiding, by BASE, by the
    // preview - so the ids have to come out unique. They are made unique in
    // numberMembers, after the sheet has been read, rather than demanded of
    // whoever writes it.
    /* A MODULE row that names a shape nothing defines cannot be drawn, and
       skipping it quietly is the worst of the options: the sheet looks like it
       loaded, the model is short a member, and the count in the panel is the
       only place it shows. The definition rows are read top to bottom, so a
       PLATE written below the MODULE that uses it has not been seen yet -
       which is the usual cause after a plain typo. */
    function noSuchMember(r, kw, id) {
      fatal('row ' + (r + 1) + ': ' + kw + ' names ' + (id || '(blank)') +
            ', which no PLATE, BAR or SECT row defines. Check the spelling, and ' +
            'check it is defined above this row — the sheet is read from the top.');
    }
    /* A MODULE row names the shape it places, and naming the same shape twice
       is the ordinary case - two identical plates, four identical bolts. The
       instance ids that keep them apart are the engine's bookkeeping and are
       given out after the sheet has been read, in numberMembers below. */
    function addMember(part, row) {
      part.pos.push(row);
    }
    function resolvePlate(pid) {          // exact id, or instance suffix PL.C1_2 → PL.C1
      if (plates[pid]) return pid;
      var sfx = pid.match(/^(.+?)[_-]\d+$/);
      if (sfx && plates[sfx[1]]) return sfx[1];
      return null;
    }
    /* ---- a bar or a section stretched between two points ----
       The two end points are module-local and constant, so the member's real
       length is known here, at parse time. The Length on the BAR/SECT row is
       left as the reference value it was written as; what gets built is the
       distance between the points, trimmed by OFF_B at the start and OFF_E at
       the end. Those two are signed: positive pulls the member back from the
       point (clearance at a joint), negative runs it past (a brace lapping into
       a gusset, a column embedded in its base). */
    function axialRow(no, pid, v, r) {
      var sp = plates[pid];
      if (!sp.__bar) {
        warn('row ' + (r + 1) + ': ' + no + ' — start/end coordinates place a BAR or a SECT only. ' +
             'A plate is placed with Ref.Pt, L.X, L.Y, L.Z and a PLANE, because stretching it ' +
             'would stretch its thickness.');
        return null;
      }
      var x1 = num(v[3], 0), y1 = num(v[4], 0), z1 = num(v[5], 0);
      var x2 = num(v[6], 0), y2 = num(v[7], 0), z2 = num(v[8], 0);
      var dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
      var L0 = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (L0 < 1e-9) {
        warn('row ' + (r + 1) + ': ' + no + ' — start and end are the same point (' +
             x1 + ', ' + y1 + ', ' + z1 + '), so the member has no length and no direction');
        return null;
      }
      var ob = num(v[9], 0), oe = num(v[10], 0);
      var len = L0 - ob - oe;
      if (len <= 1e-9) {
        warn('row ' + (r + 1) + ': ' + no + ' — OFF_B ' + ob + ' and OFF_E ' + oe +
             ' cut away all ' + rnd(L0) + ' of the member. Positive offsets trim, ' +
             'negative offsets extend; their sum has to stay under the end-to-end length.');
        return null;
      }
      var ux = dx / L0, uy = dy / L0, uz = dz / L0;
      sp.__axused = true;                 // its Length row is a reference value now
      var rp = str(v[2]);                 // blank = the section's own BASE.pt rides the axis
      return { __ax: true, __bar: true, NO: no, PLATE: pid, __spec: axSpec(sp, len),
               REFPT: rp ? normPoint(rp) : '', FACE: 0,
               X1: x1, Y1: y1, Z1: z1, X2: x2, Y2: y2, Z2: z2,
               AX: x1 + ux * ob, AY: y1 + uy * ob, AZ: z1 + uz * ob,
               UX: ux, UY: uy, UZ: uz,
               LEN: len, L0: L0, OFB: ob, OFE: oe, ALPHA: num(v[11], 0) };
    }
    /* ---- where the block sits ----
       The keyword column does not have to be A. When the sheet has an END row,
       the column END sits in is taken as the keyword column for the whole sheet
       and every column left of it is left alone - headings, notes, a working
       calculation - so the input can live beside the arithmetic that produced
       it. A row with that column empty is skipped rather than misread. Without
       an END row each row falls back to its own first filled cell. */
    var kcol = -1;
    for (var q = 0; q < rows.length && kcol < 0; q++) {
      var qrow = rows[q] || [];
      for (var qc = 0; qc < qrow.length; qc++) {
        if (str(qrow[qc]) === '') continue;
        if (str(qrow[qc]).toUpperCase() === 'END') kcol = qc;
        break;                            // only the first filled cell counts
      }
    }
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r] || [];
      var k = kcol >= 0 ? kcol : 0;
      if (kcol < 0) while (k < row.length && str(row[k]) === '') k++;
      if (k >= row.length || str(row[k]) === '') continue;
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
      } else if (kw === 'SECT') {
        // SECT ID MAT Length TYPE BASE.pt <values>
        // The values run straight on with no gaps, and each type has its own
        // list - a C and an L happen to take the same count but not the same
        // meaning, so they are read per type rather than from one shared set:
        //   H : h bb bt tw tf1 tf2 r1 r2      (tf1 = bottom, tf2 = top)
        //   C : h b tw tf rw rf               (rw = web root, rf = flange toe)
        //   L : a b t1 t2 r1 r2               (t1 = a leg, t2 = b leg)
        var ids = str(v[0]).toUpperCase();
        if (!ids) continue;
        var st = str(v[3]).toUpperCase();
        if (st === 'I') st = 'H';
        if (!SECT_FIELDS[st]) {
          warn('row ' + (r + 1) + ': SECT ' + ids + ' — TYPE must be H, C or L, found ' +
               (str(v[3]) || '(blank)'));
          continue;
        }
        var sp = { ID: ids, SHAPE: 'SECT', SECT: st, __bar: true, __sect: true,
                   MAT: str(v[1]), THK: num(v[2], 0) };
        SECT_FIELDS[st].forEach(function (k, i2) { sp[k] = num(v[5 + i2], 0); });
        var serr = sectErrors(sp);
        if (serr.length) {
          serr.forEach(function (m) { warn('row ' + (r + 1) + ': SECT ' + ids + ' — ' + m); });
          continue;                                    // refused, not repaired
        }
        var sbp = str(v[4]);
        if (sbp && !knownPoint(sbp)) {
          warn('row ' + (r + 1) + ': SECT ' + ids + ' — unknown BASE.pt "' + sbp +
               '" (use tl/tc/tr, ml/mc/mr, bl/bc/br)');
          continue;
        }
        sp.BASEPT = sbp ? normPoint(sbp) : 'bc';
        if (holes[ids]) warn('row ' + (r + 1) + ': SECT ' + ids + ' reuses a HOLE id');
        plates[ids] = sp;
        current = ids;
        counts.sect++;
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
            hint('row ' + (r + 1) + ': CUT on ' + target + ' has dx/dy but repeat is 0/empty' +
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
            hint('row ' + (r + 1) + ': CUT on ' + target + ' has dx/dy but repeat is 0/empty' +
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
          hint('row ' + (r + 1) + ': CUT on ' + target + ' has dx/dy but repeat is 0/empty' +
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
        if (!mplate) { noSuchMember(r, 'MODULE', msub); continue; }
        if (palias[str(v[2]).toUpperCase()]) {   // legacy: <plate> PLANE Ref.Pt L.X L.Y L.ROT OFFSET
          addMember(currentPart, { NO: msub, PLATE: mplate, PLANE: palias[str(v[2]).toUpperCase()],
                                   PL_IN: str(v[2]).toUpperCase(), __bar: !!plates[mplate].__bar,
                                   REFPT: normPoint(v[3]), FACE: faceOf(v[3]),
                                   LX: num(v[4], 0), LY: num(v[5], 0),
                                   ROT: num(v[6], 0), OFFSET: num(v[7], 0) });
          continue;
        }
        // <plate> Ref.Pt L.X L.Y L.Z PLANE [ROT.X ROT.Y ROT.Z]
        var mplane = str(v[6]).toUpperCase();
        if (palias[mplane]) {
          addMember(currentPart, { __xyz: true, NO: msub, PLATE: mplate, PLANE: palias[mplane],
                                   PL_IN: mplane, __bar: !!plates[mplate].__bar,
                                   REFPT: normPoint(v[2]), FACE: faceOf(v[2]),
                                   LX: num(v[3], 0), LY: num(v[4], 0), LZ: num(v[5], 0),
                                   RX: num(v[7], 0), RY: num(v[8], 0), RZ: num(v[9], 0) });
          continue;
        }
        // <bar/sect> Ref.Pt LX1 LY1 LZ1 LX2 LY2 LZ2 [OFF_B OFF_E Alpha]
        // The PLANE cell holds a number instead of a plane name, so the member is
        // stretched between two module-local points. All three end coordinates
        // are tested: a column standing straight up leaves LX2 and LY2 blank.
        if (isNum(v[6]) || isNum(v[7]) || isNum(v[8])) {
          var axr = axialRow(msub, mplate, v, r);
          if (axr) addMember(currentPart, axr);
          continue;
        }
        warn('row ' + (r + 1) + ': unknown PLANE ' + (str(v[6]) || '(blank)') +
             ' (use XY/YZ/XZ — column order is member, Ref.Pt, L.X, L.Y, L.Z, PLANE;' +
             ' for a bar or a section stretched between two points, put LX2 there instead)');
      } else if (kw === 'POS') {          // place a plate inside the current part
        if (!currentPart) { warn('row ' + (r + 1) + ': POS outside of a MODULE'); continue; }
        var ppid = str(v[0]).toUpperCase();
        var pplate = resolvePlate(ppid);
        if (!pplate) { noSuchMember(r, 'POS', ppid); continue; }
        var pplane = str(v[1]).toUpperCase();
        if (!palias[pplane]) { warn('row ' + (r + 1) + ': unknown PLANE ' + pplane + ' (use XY/YZ/XZ)'); continue; }
        addMember(currentPart, { NO: ppid, PLATE: pplate, PLANE: palias[pplane],
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
          //  ASSY <id> <MODULE/ASSY/PLATE> MIR  G.X G.Y G.Z  PLANE
          //  ASSY <id> <MODULE/ASSY/PLATE> COPY d.X d.Y d.Z  repeat
          //  ASSY <id> <MODULE/ASSY/PLATE> ROT  C.X C.Y C.Z  AXIS angle repeat
          //  (the ID column names the assembly and is used as written on all
          //   four; the source picks up .a / .m / .c001 / .r001 - see memberId)
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
          var arow = { __xl: true, __g: true, CMD: acmd, REF: aref, SEQ: r,
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
            arow.NO = arow.GROUP = aid;
            arow.MEMBER = memberId(aid, aref, 'MIR');
            if (!assyIds[aid]) counts.assy++;
            assyIds[aid] = true;
            assy.push(arow);
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
              hint('row ' + (r + 1) + ': ASSY ROT has Angle 0 — the copies land on the original');
            }
            if (rrep > MAX_REP) {
              warn('row ' + (r + 1) + ': ASSY ROT repeat ' + rrep + ' is past the ' + MAX_REP +
                   ' limit — only ' + MAX_REP + ' are made');
              rrep = MAX_REP;
            }
            for (var ri = 1; ri <= rrep; ri++) {
              if (!assyIds[aid]) counts.assy++;
              assyIds[aid] = true;
              assy.push({ __xl: true, __g: true, CMD: 'ROT', REF: aref, NO: aid, GROUP: aid,
                          SEQ: r, MEMBER: memberId(aid, aref, 'ROT'),
                          GX: arow.GX, GY: arow.GY, GZ: arow.GZ,
                          AXIS: rax, ANG: rang * ri, REMARK: '', MIRROR: '' });
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
              hint('row ' + (r + 1) + ': ASSY COPY has d.X/d.Y/d.Z all 0 — the copies land on the original');
            }
            if (rep > MAX_REP) {
              warn('row ' + (r + 1) + ': ASSY COPY repeat ' + rep + ' is past the ' + MAX_REP +
                   ' limit — only ' + MAX_REP + ' are made');
              rep = MAX_REP;
            }
            for (var ci = 1; ci <= rep; ci++) {
              if (!assyIds[aid]) counts.assy++;
              assyIds[aid] = true;
              assy.push({ __xl: true, __g: true, CMD: 'COPY', REF: aref, NO: aid, GROUP: aid,
                          SEQ: r, MEMBER: memberId(aid, aref, 'COPY'),
                          GX: arow.GX * ci, GY: arow.GY * ci, GZ: arow.GZ * ci,
                          REMARK: '', MIRROR: '' });
            }
            continue;
          }
          arow.RX = num(v[w + 3], 0); arow.RY = num(v[w + 4], 0); arow.RZ = num(v[w + 5], 0);
          // ADD rows that repeat an ID build one assembly together, the way
          // MODULE rows accumulate - and so do MIR / COPY / ROT rows on that id.
          arow.NO = arow.GROUP = aid;
          arow.MEMBER = memberId(aid, aref, 'ADD');
          if (!assyIds[aid]) counts.assy++;
          assyIds[aid] = true;
          assy.push(arow);
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
    if (fellBack) {
      hint('no sheet named "input" — read the first sheet, "' + fellBack + '", instead');
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
        hint('HOLE ' + id + ': defined but never used in a CUT row');
    });
    // A MODULE no ASSY row picks up is not reported: a sheet is a library as
    // much as a model, and keeping spare modules around is normal practice.
    // An unresolved BASE is an error, not an aside: the module's reference point
    // is what every ASSY row places it by, so without one the module lands
    // wherever its members happen to have been drawn rather than where the sheet
    // asked. The fallback keeps the model on screen to look at; it does not make
    // the sheet right.
    /* Hand out the instance ids.

       A PLATE row is a shape; a MODULE row is one use of that shape. Using it
       twice is the ordinary case - two identical plates, four identical bolts -
       and the sheet should be able to say so by writing the same id twice. What
       it must not have to do is invent pl.c1_1 and pl.c1_2 to get past a
       uniqueness check: that numbering is bookkeeping, and bookkeeping is ours.

       So it happens here, after the sheet is read. A name used once keeps it, so
       nothing any existing sheet wrote moves. A name used more than once has
       every one of its uses numbered from _1, skipping any number the sheet
       spelled out itself, so a mixture of both styles cannot collide.

       Two copies in the same place are still wrong, of course - but that is a
       geometry mistake and the clash check is what finds it, not a rule about
       spelling. */
    Object.keys(parts).forEach(function (id) {
      var part = parts[id], used = {}, taken = {};
      part.pos.forEach(function (p) {
        used[p.NO] = (used[p.NO] || 0) + 1;
        taken[p.NO] = true;
      });
      var seq = {}, firstOf = {};
      part.pos.forEach(function (p) {
        var base = p.NO;
        if (used[base] < 2) return;
        var k = (seq[base] || 0) + 1, cand = base + '_' + k;
        while (taken[cand]) { k++; cand = base + '_' + k; }
        seq[base] = k;
        taken[cand] = true;
        if (!firstOf[base]) firstOf[base] = cand;
        p.WROTE = base;                       // what the sheet called it
        p.NO = cand;
      });
      /* BASE names a member. If the name it gives now covers several, it means
         the first of them - the one the sheet listed first - and says so rather
         than picking quietly. */
      var b = part.base;
      if (b && firstOf[b.inst]) {
        hint('MODULE ' + id + ': BASE ' + b.inst + ' names ' + used[b.inst] +
             ' members — taking the first, ' + firstOf[b.inst] +
             '. Name a copy directly to choose another.');
        b.inst = firstOf[b.inst];
      }
    });
    Object.keys(parts).forEach(function (id) {
      if (!parts[id].pos.length) hint('MODULE ' + id + ': has no POS rows');
      else if (!parts[id].base) warn('MODULE ' + id + ': BASE not defined — add "MODULE ' + id +
                                     ' BASE <member> <point>". Falling back to the local origin (0,0,0)');
      else if (!parts[id].pos.some(function (p) { return p.NO === parts[id].base.inst; }))
        warn('MODULE ' + id + ': BASE instance ' + parts[id].base.inst +
             ' not found among its members — falling back to the local origin (0,0,0)');
    });
    return { plates: plates, holes: holes, parts: parts, cuts: cuts, assy: assy,
             log: log, counts: counts, yup: yup,
             fatal: fatals.length ? fatals : null };
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

  var buildLog = [];                      // scene-build messages, shown in the result panel
  var lastFile = 'PLATE3D';               // the sheet the model came from
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
    lastFile = fname || lastFile;         // the BOQ names itself after the sheet
    var el = document.getElementById('pb-result');
    if (!el) return;
    if (fatal) {
      el.className = 'err';
      el.innerHTML = '<b>&#9888; Failed</b> &middot; ' + esc(fname) + '<br>' + esc(fatal);
      el.style.display = 'block';
      return;
    }
    var log = (parsed.log || []).concat(buildLog);
    var bad = log.filter(function (e) { return e.s === 'e'; });
    var c = parsed.counts;
    var placed = items.length;
    // Only a real error reddens the panel. An aside means the model on screen
    // is what the sheet asked for, so the headline still reads Succeed and the
    // asides ride along underneath it.
    el.className = bad.length ? 'err' : 'ok';
    var h = '<b>' + (bad.length ? '&#9888; ' + bad.length + (bad.length > 1 ? ' errors' : ' error')
                                : '&#10003; Succeed') +
            '</b> &middot; ' + esc(fname) + '<br>' +
            'plates ' + c.plate +
            (c.hole ? ' &middot; holes ' + c.hole : '') +
            (c.bar ? ' &middot; bars ' + c.bar : '') +
            (c.sect ? ' &middot; sections ' + c.sect : '') +
            ' &middot; cuts ' + c.cut +
            ' &middot; modules ' + (c.module || 0) +
            ' &middot; assy ' + c.assy + ' &rarr; placed ' + placed;
    if (log.length) {
      var ranked = bad.concat(log.filter(function (e) { return e.s !== 'e'; }));
      h += '<ul>' + ranked.slice(0, 10).map(function (e) {
             return '<li class="' + (e.s === 'e' ? 'e' : 'n') + '">' + esc(e.m) + '</li>';
           }).join('') +
           (log.length > 10 ? '<li>... ' + (log.length - 10) + ' more (see console)</li>' : '') + '</ul>';
    }
    el.innerHTML = h;
    el.style.display = 'block';
  }

  /* A fatal is not a row the parser skipped — it is a sheet no correct model can
     come out of, so the load stops rather than drawing something that merely
     looks finished. The scene is emptied, the dialog states what is wrong, and
     the app sits on the failure until another sheet is loaded. */
  function fatalStop(fname, msgs) {
    pbProgress(null);
    buildLog = [];
    run({});                                     // clear the scene, rebuild the panel DOM
    showResult(fname, null, msgs.join('  |  '));
    var old = document.getElementById('pb-fatal');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var wrap = document.createElement('div');
    wrap.id = 'pb-fatal';
    wrap.innerHTML =
      '<div class="box" role="alertdialog" aria-modal="true">' +
      '<h4>&#9888; Cannot build this sheet</h4>' +
      '<p class="f">' + esc(fname) + '</p>' +
      '<ul>' + msgs.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' +
      '<p class="n">Nothing was drawn. Correct the sheet and load it again.</p>' +
      '<button type="button">OK</button></div>';
    document.body.appendChild(wrap);
    var btn = wrap.querySelector('button');
    btn.onclick = function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); };
    btn.focus();
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
          // The model is read from the sheet named "input". A workbook usually
          // grows other tabs - working calculations, a drawing list, a copy of
          // an older revision - and picking the first tab would quietly read
          // whichever one happened to be leftmost.
          var ws = wb2.worksheets.filter(function (s) {
            return String(s.name || '').trim().toLowerCase() === 'input';
          })[0];
          var named = !!ws;
          if (!ws) ws = wb2.worksheets[0];
          if (!ws) {
            pbProgress(null);
            showResult(file.name, null, 'The workbook has no worksheet.');
            return;
          }
          var rows = [];
          ws.eachRow({ includeEmpty: true }, function (r) {
            rows.push((r.values || []).slice(1).map(cellVal));
          });
          var parsed = parseExcelRows(rows, named ? null : ws.name);
          if (parsed.fatal) { fatalStop(file.name, parsed.fatal); return; }
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


  /* ---------------- rolled sections: H / C / L ----------------
     One field set for all three - h b tw tf r r2 (+ b2 tf2 for an
     asymmetric H). Anything a shape does not need mirrors another value, so
     an equal angle needs no extra columns and an unequal one just fills them
     in. A fillet is an arc tessellated into the ring: the root fillet is
     concave and adds material, a toe radius is convex and takes it away.
     Dropping the fillets costs about 2.6% of the area on an H-400x200x8x13,
     so they are drawn, not approximated. */
  var SECT_SEG = 8;                 // arc segments per 90 deg: area within 0.06%
  function arcInto(ring, cx, cy, r, a0, a1, seg) {
    for (var i = 0; i <= seg; i++) {
      var a = (a0 + (a1 - a0) * i / seg) * Math.PI / 180;
      ring.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  function cleanRing(ring) {                     // drop points repeated in a row
    var out = [];
    ring.forEach(function (q) {
      var p = out[out.length - 1];
      if (!p || Math.abs(q[0] - p[0]) > 1e-9 || Math.abs(q[1] - p[1]) > 1e-9) out.push(q);
    });
    while (out.length > 1) {
      var a = out[0], b = out[out.length - 1];
      if (Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9) out.pop(); else break;
    }
    return out;
  }
  // H / I - origin bottom centre, y up, CCW.  h bb bt tw tf1 tf2 r1 r2
  function outlineH(d) {
    var seg = SECT_SEG, h = d.h, bb = d.bb, bt = d.bt, tw = d.tw,
        tf1 = d.tf1, tf2 = d.tf2, r1 = d.r1 || 0,
        yT = h - tf2, yB = tf1, xw = tw / 2, g = [];
    g.push([-bb / 2, 0], [bb / 2, 0], [bb / 2, yB]);
    if (r1 > 0) { g.push([xw + r1, yB]); arcInto(g, xw + r1, yB + r1, r1, 270, 180, seg);
                  arcInto(g, xw + r1, yT - r1, r1, 180, 90, seg); }
    else g.push([xw, yB], [xw, yT]);
    g.push([bt / 2, yT], [bt / 2, h], [-bt / 2, h], [-bt / 2, yT]);
    if (r1 > 0) { g.push([-xw - r1, yT]); arcInto(g, -xw - r1, yT - r1, r1, 90, 0, seg);
                  arcInto(g, -xw - r1, yB + r1, r1, 0, -90, seg); }
    else g.push([-xw, yT], [-xw, yB]);
    g.push([-bb / 2, yB]);
    return cleanRing(g);
  }
  // C - origin bottom left (web outer face), flanges to +x, CCW.  h b tw tf rw rf
  function outlineC(d) {
    var seg = SECT_SEG, h = d.h, b = d.b, tw = d.tw, tf = d.tf,
        rw = d.rw || 0, rf = d.rf || 0, g = [];
    g.push([0, 0], [b, 0]);
    if (rf > 0) { g.push([b, tf - rf]); arcInto(g, b - rf, tf - rf, rf, 0, 90, seg); }
    else g.push([b, tf]);
    if (rw > 0) { g.push([tw + rw, tf]); arcInto(g, tw + rw, tf + rw, rw, 270, 180, seg);
                  arcInto(g, tw + rw, h - tf - rw, rw, 180, 90, seg); }
    else g.push([tw, tf], [tw, h - tf]);
    if (rf > 0) { g.push([b - rf, h - tf]); arcInto(g, b - rf, h - tf + rf, rf, 270, 360, seg); }
    else g.push([b, h - tf]);
    g.push([b, h], [0, h]);
    return cleanRing(g);
  }
  // L - origin at the heel, legs along +x (a) and +y (b), CCW.  a b t1 t2 r1 r2
  // t1 belongs to the a leg, t2 to the b leg
  function outlineL(d) {
    var seg = SECT_SEG, a = d.a, b = d.b, t1 = d.t1, t2 = d.t2,
        r1 = d.r1 || 0, r2 = d.r2 || 0, g = [];
    g.push([0, 0], [a, 0]);
    if (r2 > 0) { g.push([a, t1 - r2]); arcInto(g, a - r2, t1 - r2, r2, 0, 90, seg); }
    else g.push([a, t1]);
    if (r1 > 0) { g.push([t2 + r1, t1]); arcInto(g, t2 + r1, t1 + r1, r1, 270, 180, seg); }
    else g.push([t2, t1]);
    if (r2 > 0) { g.push([t2, b - r2]); arcInto(g, t2 - r2, b - r2, r2, 0, 90, seg); }
    else g.push([t2, b]);
    g.push([0, b]);
    return cleanRing(g);
  }
  function sectRing(spec) {                      // raw profile, before BASE.pt
    if (spec.__ring) return spec.__ring;
    spec.__ring = spec.SECT === 'C' ? outlineC(spec)
                : spec.SECT === 'L' ? outlineL(spec) : outlineH(spec);
    return spec.__ring;
  }
  // Where to hang an R dimension. One leader per distinct radius - an H section
  // has four identical root fillets and four identical toes, and eight arrows
  // saying the same number is not a drawing. Each entry is the point on the arc
  // the arrow touches plus the direction the leader leaves in: a root fillet is
  // concave, so its open side is towards the arc centre and the leader heads
  // that way; a toe is convex and the leader heads out.
  function sectFillets(spec) {
    var o = baseOffset(spec), out = [], seen = {};
    function add(cx, cy, r, deg, dir) {
      if (!(r > 0) || seen[r]) return;
      seen[r] = 1;
      var a = deg * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
      out.push({ x: cx + r * cs - o[0], y: cy + r * sn - o[1], r: r,
                 ux: dir * cs, uy: dir * sn });
    }
    if (spec.SECT === 'C') {
      add(spec.tw + spec.rw, spec.tf + spec.rw, spec.rw, 225, -1);          // web root
      add(spec.b - spec.rf, spec.h - spec.tf + spec.rf, spec.rf, 315, 1);   // flange toe
    } else if (spec.SECT === 'L') {
      add(spec.t2 + spec.r1, spec.t1 + spec.r1, spec.r1, 225, -1);          // heel root
      add(spec.a - spec.r2, spec.t1 - spec.r2, spec.r2, 45, 1);             // a-leg toe
    } else {
      var xw = spec.tw / 2;
      add(-xw - spec.r1, spec.tf1 + spec.r1, spec.r1, -45, -1);             // web root
    }
    return out;
  }
  // Every value the sheet has to get right. The row is refused, not repaired -
  // a fillet that does not fit still draws a plausible profile with the wrong
  // area, which is worse than no section at all.
  var SECT_FIELDS = { H: ['h', 'bb', 'bt', 'tw', 'tf1', 'tf2', 'r1'],
                      C: ['h', 'b', 'tw', 'tf', 'rw', 'rf'],
                      L: ['a', 'b', 't1', 't2', 'r1', 'r2'] };
  var SECT_RADII = { H: 1, C: 2, L: 2 };       // trailing fields allowed to be 0
  function sectErrors(d) {
    var e = [], t = d.SECT, f = SECT_FIELDS[t], nr = SECT_RADII[t];
    f.slice(0, f.length - nr).forEach(function (k) {         // the radii may be 0
      if (!(num(d[k], 0) > 0)) e.push(k + ' is blank or not a positive number');
    });
    if (!(num(d.THK, 0) > 0)) e.push('Length must be greater than 0');
    f.slice(f.length - nr).forEach(function (k) {
      if (num(d[k], 0) < 0) e.push(k + ' cannot be negative');
    });
    if (e.length) return e;
    if (t === 'H') {
      var h = d.h, bb = d.bb, bt = d.bt, tw = d.tw, tf1 = d.tf1, tf2 = d.tf2,
          r1 = d.r1, bmin = Math.min(bb, bt);
      if (tf1 + tf2 >= h) e.push('flanges do not fit: tf1 + tf2 (' + (tf1 + tf2) + ') >= h (' + h + ')');
      if (tw >= bmin) e.push('web is wider than the flange: tw (' + tw + ') >= ' + bmin);
      if (r1 && r1 > (h - tf1 - tf2) / 2) e.push('r1 ' + r1 + ' too big for the clear web depth — max ' + ((h - tf1 - tf2) / 2).toFixed(1));
      if (r1 && r1 > (bmin - tw) / 2) e.push('r1 ' + r1 + ' does not fit under the flange — max ' + ((bmin - tw) / 2).toFixed(1));
    } else if (t === 'C') {
      if (2 * d.tf >= d.h) e.push('flanges do not fit: 2 x tf (' + 2 * d.tf + ') >= h (' + d.h + ')');
      if (d.tw >= d.b) e.push('web is wider than the flange: tw (' + d.tw + ') >= b (' + d.b + ')');
      if (d.rw && d.rw > (d.h - 2 * d.tf) / 2) e.push('rw ' + d.rw + ' too big for the clear web depth — max ' + ((d.h - 2 * d.tf) / 2).toFixed(1));
      if (d.rw && d.rw > d.b - d.tw) e.push('rw ' + d.rw + ' does not fit along the flange — max ' + (d.b - d.tw));
      if (d.rf && d.rf > d.tf) e.push('rf ' + d.rf + ' is bigger than the flange thickness — max ' + d.tf);
    } else {
      if (d.t2 >= d.a) e.push('leg too short: t2 (' + d.t2 + ') >= a (' + d.a + ')');
      if (d.t1 >= d.b) e.push('leg too short: t1 (' + d.t1 + ') >= b (' + d.b + ')');
      if (d.r1 && d.r1 > Math.min(d.a - d.t2, d.b - d.t1)) e.push('r1 ' + d.r1 + ' does not fit in the corner — max ' + Math.min(d.a - d.t2, d.b - d.t1));
      if (d.r2 && d.r2 > Math.min(d.t1, d.t2)) e.push('r2 ' + d.r2 + ' is bigger than the leg thickness — max ' + Math.min(d.t1, d.t2));
    }
    return e;
  }
  function radLabel(a, b) {                        // r16 / r16/9 / nothing at all
    var n = function (v) { return String(+num(v, 0).toFixed(3)); };
    if (!num(a, 0) && !num(b, 0)) return '';
    if (!num(b, 0)) return ' r' + n(a);
    if (!num(a, 0)) return ' r0/' + n(b);
    return ' r' + n(a) + '/' + n(b);
  }
  function sectLabel(spec) {
    var n = function (v) { return String(+num(v, 0).toFixed(3)); }, X = '\u00d7';
    if (spec.SECT === 'C') {
      return 'C-' + n(spec.h) + X + n(spec.b) + X + n(spec.tw) + X + n(spec.tf) +
             radLabel(spec.rw, spec.rf);
    }
    if (spec.SECT === 'L') {
      return 'L-' + n(spec.a) + X + n(spec.b) + X + n(spec.t1) +
             (spec.t2 !== spec.t1 ? X + n(spec.t2) : '') +
             radLabel(spec.r1, spec.r2);
    }
    var t = 'H-' + n(spec.h) + X + n(spec.bb) + X + n(spec.tw) + X + n(spec.tf1);
    if (spec.bt !== spec.bb || spec.tf2 !== spec.tf1) t += ' / ' + n(spec.bt) + X + n(spec.tf2);
    return t + radLabel(spec.r1, 0);
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
  function bboxCorners(ring) {
    var x0 = 1e18, y0 = 1e18, x1 = -1e18, y1 = -1e18;
    ring.forEach(function (q) {
      if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0];
      if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1];
    });
    return { bl: [x0, y0], br: [x1, y0], tr: [x1, y1], tl: [x0, y1] };
  }
  function rawPoints(spec) {
    if (spec.SHAPE === 'SECT') return nineFrom(bboxCorners(sectRing(spec)));
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
    if (spec.SHAPE === 'SECT') {                 // bbox, so EDGE refs still work
      var q = bboxCorners(sectRing(spec)), ob = baseOffset(spec);
      function t(v) { return [v[0] - ob[0], v[1] - ob[1]]; }
      return { bl: t(q.bl), br: t(q.br), tr: t(q.tr), tl: t(q.tl) };
    }
    var c = rawCorners(spec), o = baseOffset(spec);
    function s(q) { return [q[0] - o[0], q[1] - o[1]]; }
    return { bl: s(c.bl), br: s(c.br), tr: s(c.tr), tl: s(c.tl) };
  }
  function outlineOf(spec) {                       // CCW
    var o = baseOffset(spec);
    if (spec.SHAPE === 'SECT') {
      return sectRing(spec).map(function (q) { return [q[0] - o[0], q[1] - o[1]]; });
    }
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
    if (spec.SHAPE === 'SECT') {
      var q = bboxCorners(sectRing(spec));
      return q.bl[0] + q.br[0] - 2 * o[0];
    }
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

    var c = classifyRings(region.regions);
    var area = 0;
    c.outers.forEach(function (r) { area += Math.abs(ringArea(r)); });
    c.holes.forEach(function (hs) {
      hs.forEach(function (r) { area -= Math.abs(ringArea(r)); });
    });

    return { outers: c.outers, holes: c.holes, feats: feats, area: area };
  }
  // even containment depth = outer ring, odd = hole; each hole filed under the
  // outer that contains it
  function classifyRings(regions) {
    var rings = regions.filter(function (r) { return r.length >= 3; });
    var outers = [], holes = [];
    rings.forEach(function (r) {
      var depth = 0;
      rings.forEach(function (s) { if (s !== r && pointInRing(r[0], s)) depth++; });
      (depth % 2 ? holes : outers).push(r);
    });
    return { outers: outers,
             holes: outers.map(function (o) {
               return holes.filter(function (h) { return pointInRing(h[0], o); });
             }) };
  }

  /* ------- named points/edges (uncut outline, MIRROR applied) ------- */
  function namedPoints(spec, mirror) {
    if (spec.SHAPE === 'SECT') return nineFrom(cornersOf(spec));
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
  /* `row` is passed only when this anchor is a module's BASE datum, and only
     then does OFF_B come into it. A member placed by coordinates is anchored on
     the work point the sheet wrote - LX1/LY1/LZ1 - not on the end OFF_B left
     behind. OFF trims steel; it does not move the member. Anchoring on the
     trimmed end drags the whole module along the member's own axis, which draws
     a model that looks right and is not: PLATE3D_BASIC's braced bay sat 106 mm
     out in x and 108 in z that way, and only the clash check ever said so.
     The offset is subtracted in member-local coords so the caller's matrix -
     yupFix included - still carries it into the right frame. */
  function refAnchor(spec, pt, face, row) {
    var thk = num(spec.THK, 0);
    if (spec.__bar) return [0, 0, -thk / 2 - (row && row.__ax ? num(row.OFB, 0) : 0)];
    var p = namedPoints(spec, false), a = p[pt] || p.bl;
    return [a[0], a[1], (face || 0) * thk / 2];
  }
  function isBarSpec(spec) { return !!(spec && spec.__bar && !spec.__sect); }
  function isSectSpec(spec) { return !!(spec && spec.__sect); }
  // A stretched member is the same section at a different length, so it gets its
  // own copy of the definition with the length written in. Everything downstream
  // reads the length off the spec - the extrusion, the mass, the list entry, the
  // exports - so nothing else has to know the member was placed by coordinates.
  // The id is kept, which is what keeps its colour and its CUT rows.
  function axSpec(spec, len) {
    var c = {};
    for (var k in spec) if (Object.prototype.hasOwnProperty.call(spec, k)) c[k] = spec[k];
    c.THK = len;
    return c;
  }
  function specOf(row, lib) { return row.__spec || lib[row.PLATE]; }

  /* Frame of a member placed by its two end points. ez runs from start to end;
     ey is world up projected onto the section plane, so the section stands the
     same way it would on a PLANE - checked against all three:
         along +Z  ->  x→X, y→Y   = XY      along −Y  ->  x→X, y→Z  = XZ
         along +X  ->  x→Y, y→Z   = YZ
     which means an existing PLANE row rewritten with coordinates comes out
     identical at Alpha 0. A member parallel to up has no such projection, so it
     falls back to the same pair XY uses. */
  function axisBasis(ux, uy, uz) {
    var ez = new THREE.Vector3(ux, uy, uz).normalize();
    var up = yupSheet ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
    var ey = up.clone().sub(ez.clone().multiplyScalar(up.dot(ez)));
    if (ey.lengthSq() < 1e-12) ey = yupSheet ? new THREE.Vector3(0, 0, -1)
                                             : new THREE.Vector3(0, 1, 0);
    ey.normalize();
    return { ex: ey.clone().cross(ez), ey: ey, ez: ez };
  }
  // Ref.Pt names the point of the section that rides the axis line; left blank
  // it is the section's own BASE.pt. Alpha then rolls the section about that
  // line, so the roll never moves the member off the two points it was given.
  function axialMatrix(row, pts, thk) {
    var b = axisBasis(row.UX, row.UY, row.UZ);
    var m = new THREE.Matrix4().makeTranslation(row.AX, row.AY, row.AZ);
    m.multiply(new THREE.Matrix4().makeBasis(b.ex, b.ey, b.ez));
    if (row.ALPHA) m.multiply(new THREE.Matrix4().makeRotationZ(row.ALPHA * Math.PI / 180));
    var a = row.REFPT ? pts[row.REFPT] : null;
    if (a) m.multiply(new THREE.Matrix4().makeTranslation(-a[0], -a[1], 0));
    m.multiply(new THREE.Matrix4().makeTranslation(0, 0, (thk || 0) / 2));
    return m;
  }

  function memberMatrix(row, pts, thk) {
    if (row.__ax) return axialMatrix(row, pts, thk);
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

    function buildErr(m) { buildLog.push({ s: 'e', m: m }); console.error('[plateBuilder] ' + m); }

    // create geometry for one plate instance with a final world matrix
    function buildInstance(spec, matrix, no, group, remark, mirror, moduleId, memberKey, flip, member) {
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
                        side: flatMode ? THREE.DoubleSide : THREE.FrontSide });
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
      var dims = spec.SHAPE === 'SECT'
        ? sectLabel(spec) + ' L' + thk
        : spec.SHAPE === 'CIRC'
        ? 'D' + spec.D + '×' + thk
        : (spec.WT === spec.WB && spec.OFF_T === spec.OFF_B
            ? spec.WB + '×' + spec.H + '×' + thk + 'T'
            : spec.WT + '/' + spec.WB + '×' + spec.H + '×' + thk + 'T');
      var gname = group || '-';
      // One list row per member of the assembly - the id the ASSY row minted for
      // what it placed (md.tower.c001). A legacy row names no member, so it
      // falls back to the module, keeping one row per module in the group.
      var mem = member || null;
      var it = { no: no, plateId: spec.ID, group: gname, member: mem,
                 moduleId: moduleId || null,
                 memberKey: memberKey || null,
                 instKey: gname + '/' + (mem || moduleId || '#' + spec.ID),
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
        var spec = specOf(p, plates);
        var pts = namedPoints(spec, false);
        return { row: p, spec: spec, pts: pts, mloc: memberMatrix(p, pts, spec.THK) };
      });
      var base = new THREE.Vector3(0, 0, 0);
      if (part.base) {
        for (var i = 0; i < locals.length; i++) {
          if (locals[i].row.NO === part.base.inst) {
            var a = refAnchor(locals[i].spec, part.base.pt, part.base.face, locals[i].row);
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
        buildErr('part ref point ' + s + ' not found — falling back to BASE');
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
    var srcSnap = {};                  // sheet row -> the source it started from
    var usedNo = {};                   // instance names taken, so two copies of one
    function instName(aid, no) {       // source inside one assembly stay apart
      var k = aid + '/' + no;
      usedNo[k] = (usedNo[k] || 0) + 1;
      return usedNo[k] > 1 ? k + '#' + usedNo[k] : k;
    }

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
      if (row.__g) {                     // ADD / MIR / COPY / ROT
        // Every copy the one sheet row makes works from the same source. A
        // self-referencing row - ASSY as.a as.a COPY, the "mirror me to finish
        // me" idiom - grows the definition as its copies land, so re-reading it
        // per copy would double the work each time round the loop.
        var src;
        try {
          src = row.SEQ !== undefined && srcSnap[row.SEQ] ? srcSnap[row.SEQ] : assySource(row);
        } catch (err) { buildErr(err.message); return; }
        if (row.SEQ !== undefined) srcSnap[row.SEQ] = src;
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
        // ASSY row that reuses this id places it by the same G.X/G.Y/G.Z rule.
        // Every row after the first for one id joins it, whatever the command:
        // the first row anchors the assembly, and since the later rows' G values
        // are still absolute, their parts are stored relative to that anchor so
        // the whole assembly - copies and mirrors included - re-places as one.
        var joins = !!assyDefs[row.NO];
        var anchor = joins ? assyAt[row.NO] : G;
        var rel = joins ? new THREE.Matrix4().copy(anchor).invert().multiply(G) : null;
        var made = src.map(function (L) {
          var ml = pre ? pre.clone().multiply(L.mloc) : L.mloc.clone();
          if (rel) ml = rel.clone().multiply(ml);
          return { spec: L.spec, no: L.no, moduleId: L.moduleId, memberKey: L.memberKey,
                   flip: flipAll ? !L.flip : L.flip, mloc: ml };
        });
        assyDefs[row.NO] = joins ? assyDefs[row.NO].concat(made) : made;
        if (!joins) assyAt[row.NO] = G;
        made.forEach(function (L) {
          buildInstance(L.spec, anchor.clone().multiply(L.mloc), instName(row.MEMBER || row.NO, L.no),
                        row.GROUP || row.NO, '', false, L.moduleId, L.memberKey, L.flip, row.MEMBER);
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
  /* Every list starts folded. Six of them stacked open is a hundred rows to
     scroll past before the model, and what a sheet is usually opened to check
     is the count - so the count sits on the heading and the rows are one click
     away.

     `key` makes a heading foldable; the state lives in sectFold and is read
     back here on every rebuild, so a list redrawn after a colour change comes
     back the way it was left. */
  var sectFold = {};
  function sectionRow(tbl, cls, text, span, key, count) {
    var tr = document.createElement('tr');
    tr.className = cls;
    var html = text;
    if (key) {
      if (sectFold[key] === undefined) sectFold[key] = true;
      var bit = String(text).split(' \u2014 ');
      html = '<span class="fold' + (sectFold[key] ? ' shut' : '') + '"' +
             ' onclick="plateBuilder.toggleSection(\'' + key + '\')"' +
             ' title="show or hide this list">' + ICON_FOLD + '</span>' +
             '<span class="sname">' + bit[0] + '</span>' +
             '<span class="scount">(' + (count || 0) + ')</span>' +
             (bit[1] ? '<span class="shint">\u2014 ' + bit[1] + '</span>' : '');
      tr.setAttribute('data-sect', key);
      tbl.className = sectFold[key] ? 'sect-shut' : '';
    }
    tr.innerHTML = '<td colspan="' + (span || 2) + '">' + html + '</td>';
    tbl.appendChild(tr);
    return tr;
  }
  function toggleSection(key) {
    var head = document.querySelector('#pb-side tr[data-sect="' + key + '"]');
    if (!head) return;
    var shut = sectFold[key] = !sectFold[key];
    var t = head.parentNode;
    while (t && t.tagName !== 'TABLE') t = t.parentNode;
    if (t) t.className = shut ? 'sect-shut' : '';
    var f = head.querySelector('.fold');
    if (f) f.className = 'fold' + (shut ? ' shut' : '');
  }

  // Cut shapes. They are never members, so they carry no colour and no weight -
  // what you want to know is the size and whether any CUT row actually used it.
  function buildHoleList() {
    var tbl = document.getElementById('pb-holes');
    if (!tbl) return;
    tbl.innerHTML = '';
    var ids = Object.keys(shapeLib);
    sectionRow(tbl, 'ghead', 'HOLES — click to preview', 3, 'hole', ids.length);
    if (!ids.length) { sectionRow(tbl, 'none', 'no HOLE row', 3); return; }
    var hr = document.createElement('tr');
    hr.className = 'chead';
    hr.innerHTML = '<td>ID</td><td class="num">SIZE</td><td class="num">USED</td>';
    tbl.appendChild(hr);
    ids.forEach(function (id) {
      var used = lastCuts.filter(function (c) { return c.REF === id; }).length;
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="bid"><span class="plname" onclick="plateBuilder.preview(\'' + id + '\')">' +
        esc(id) + '</span></td>' +
        '<td class="num">' + specSize(shapeLib[id]) + '</td>' +
        '<td class="num">' + (used || '—') + '</td>';
      tbl.appendChild(tr);
    });
  }

  function specSize(spec) {
    if (!spec) return '—';
    if (spec.SHAPE === 'CIRC') return 'Ø' + trim(spec.D);
    return spec.WT === spec.WB && spec.OFF_T === spec.OFF_B
      ? trim(spec.WB) + '×' + trim(spec.H)
      : trim(spec.WT) + '/' + trim(spec.WB) + '×' + trim(spec.H);
  }

  /* -------- plate definition list + 2D preview modal -------- */
  function buildPlateList(colors) {
    var tbl = document.getElementById('pb-plates');
    if (!tbl) return;
    tbl.innerHTML = '';
    var ids = Object.keys(lastPlates).filter(function (id) { return !lastPlates[id].__bar; });
    sectionRow(tbl, 'ghead', 'PLATES — click to preview', 6, 'plate', ids.length);
    if (!ids.length) { sectionRow(tbl, 'none', 'no PLATE row', 6); return; }
    var hr = document.createElement('tr');
    hr.className = 'chead';
    hr.innerHTML = '<td></td><td>ID</td><td class="num">SIZE</td><td class="num">THK</td>' +
                   '<td class="num">CUTS</td><td>MAT</td>';
    tbl.appendChild(hr);
    ids.forEach(function (id) {
      var spec = lastPlates[id];
      var size = specSize(spec);
      var ncut = lastCuts.filter(function (c) { return c.PLATE === id; }).length;
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="sty"><span class="sw" style="background:' +
        int2hex(resolveColor({ plateId: id }, colors[id] || 0x999999)) +
        '" onclick="plateBuilder.openPalette(event,\'plate\',\'' + id + '\',this)"></span></td>' +
        '<td class="bid"><span class="plname" onclick="plateBuilder.preview(\'' + id + '\')">' +
        esc(id) + '</span></td>' +
        '<td class="num">' + size + '</td>' +
        '<td class="num">' + trim(spec.THK) + '</td>' +
        '<td class="num">' + (ncut || '—') + '</td>' +
        '<td class="mat">' + esc(spec.MAT || '—') + '</td>';
      tbl.appendChild(tr);
    });
  }

  // Straight round bars, listed rather than drawn: a bar has nothing to preview
  // that the four numbers do not already say.
  function buildBarList() {
    var tbl = document.getElementById('pb-bars');
    if (!tbl) return;
    tbl.innerHTML = '';
    var ids = Object.keys(lastPlates).filter(function (id) { return isBarSpec(lastPlates[id]); });
    sectionRow(tbl, 'ghead', 'BARS', 4, 'bar', ids.length);
    if (!ids.length) { sectionRow(tbl, 'none', 'no BAR row', 4); return; }
    var hr = document.createElement('tr');
    hr.className = 'chead';
    hr.innerHTML = '<td>ID</td><td class="num">DIA</td><td class="num">LENGTH</td><td>MAT</td>';
    tbl.appendChild(hr);
    ids.forEach(function (id) {
      var spec = lastPlates[id];
      var tr = document.createElement('tr');
      tr.innerHTML = '<td class="bid">' + esc(id) + '</td>' +
                     '<td class="num">&#216;' + trim(spec.D) + '</td>' +
                     '<td class="num">' + trim(spec.THK) + refMark(spec) + '</td>' +
                     '<td class="mat">' + esc(spec.MAT || '\u2014') + '</td>';
      tbl.appendChild(tr);
    });
  }
  function trim(v) { return String(+num(v, 0).toFixed(3)); }
  // Once a section is placed between two points its own Length column stops
  // deciding anything, so the table says so rather than quietly disagreeing
  // with the member list.
  function refMark(spec) { return spec.__axused ? '<span class="rf">ref</span>' : ''; }

  // Rolled sections. Unlike a bar these do have something to look at, so the id
  // opens the same 2D drawing a plate does - profile, grid, measure.
  function buildSectList() {
    var tbl = document.getElementById('pb-sects');
    if (!tbl) return;
    tbl.innerHTML = '';
    var ids = Object.keys(lastPlates).filter(function (id) { return isSectSpec(lastPlates[id]); });
    sectionRow(tbl, 'ghead', 'SECTIONS — click to preview', 4, 'sect', ids.length);
    if (!ids.length) { sectionRow(tbl, 'none', 'no SECT row', 4); return; }
    var hr = document.createElement('tr');
    hr.className = 'chead';
    hr.innerHTML = '<td>ID</td><td>SECTION</td><td class="num">LENGTH</td><td>MAT</td>';
    tbl.appendChild(hr);
    ids.forEach(function (id) {
      var spec = lastPlates[id];
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="bid"><span class="plname" onclick="plateBuilder.preview(\'' + id + '\')">' +
        esc(id) + '</span></td>' +
        '<td class="sect">' + esc(sectLabel(spec)) + '</td>' +
        '<td class="num">' + trim(spec.THK) + refMark(spec) + '</td>' +
        '<td class="mat">' + esc(spec.MAT || '\u2014') + '</td>';
      tbl.appendChild(tr);
    });
  }

  function preview(id) {
    var spec = lastPlates[id] || shapeLib[id];   // a HOLE draws like any outline
    if (!spec) return;
    var modal = document.getElementById('pb-modal');
    var cv = document.getElementById('pb-pv-canvas');
    if (!modal || !cv) return;
    stopPreview3D();
    pvModuleId = null;
    document.getElementById('pb-pv-tree').style.display = 'none';
    ['pb-pv-flat', 'pb-pv-ids', 'pb-pv-faces', 'pb-pv-ortho', 'pb-pv-clash'].forEach(function (q) {
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

    // Snap points: the drawing origin, the 9 reference points, the centre of
    // every cut, and every vertex of the finished outline - which is what a
    // notch corner or a hole edge becomes once the cut has been subtracted.
    // Named points are pushed early, so where a corner coincides with one the
    // name still wins. The origin goes first: BASE.pt always lands on it, and
    // reading "origin" there is more use than reading the point's own name -
    // both end up on the drawing anyway, the marker label joins them.
    pvPts = [{ name: 'origin', x: 0, y: 0 }];
    POINT_KEYS.forEach(function (k) {
      var a = pts[k];
      if (a) pvPts.push({ name: k, x: a[0], y: a[1] });
    });
    var nk = {};
    (g.feats || []).forEach(function (f) {
      nk[f.kind] = (nk[f.kind] || 0) + 1;
      pvPts.push({ name: f.kind + nk[f.kind], x: f.x, y: f.y, cut: true, dia: f.dia || 0 });
    });
    g.outers.forEach(function (ring, i) {
      ring.forEach(function (q) { pvPts.push({ name: 'edge', x: q[0], y: q[1], edge: true }); });
      (g.holes[i] || []).forEach(function (h) {
        h.forEach(function (q) { pvPts.push({ name: 'hole edge', x: q[0], y: q[1], edge: true }); });
      });
    });

    var vs = pvViewSize();
    cv.width = vs.W; cv.height = vs.H;
    var W = vs.W, H = vs.H, PAD = Math.round(54 * vs.H / 540);
    var fit = Math.min((W - PAD * 2) / Math.max(maxx - minx, 1e-6),
                       (H - PAD * 2) / Math.max(maxy - miny, 1e-6));
    pv = { id: id, spec: spec, g: g, pts: pts, W: W, H: H,
           rads: spec.SHAPE === 'SECT' ? sectFillets(spec) : [],
           minx: minx, miny: miny, maxx: maxx, maxy: maxy, fit: fit,
           sc: fit, ox: (W - (maxx - minx) * fit) / 2, oy: (H - (maxy - miny) * fit) / 2 };
    drawPreview();
    pvReport(null);
    modal.style.display = 'flex';
  }

  // Bottom line of the 2D preview - the running report the 3D box already
  // shows, so a finished measurement stays readable after the cursor leaves.
  function pvReport(snap, cx, cy) {
    var el = document.getElementById('pb-pv-pos');
    if (!el) return;
    if (!pv) { el.innerHTML = '&nbsp;'; return; }
    var f = function (n) { return (Math.round(n * 100) / 100).toString(); };
    var at = function (q) { return '(' + f(q.x) + ', ' + f(q.y) + ')'; };
    var where = snap
      ? '<span style="color:#f0c674">snap ' + esc(snap.p.name) + '</span> ' + at(snap.p)
      : (cx === undefined ? ''
         : '<span style="color:#8a93a0">cursor ' + at({ x: cx, y: cy }) + '</span>');
    if (!measurePv) { el.innerHTML = where || '&nbsp;'; return; }
    var tail = ' &nbsp; <span style="color:#5b6472">right click to clear</span>';
    if (!pvMeas.length) {
      el.innerHTML = '<span style="color:#6fb3e8">measure</span> \u2014 click a corner, ' +
                     'an edge or a hole centre' + (where ? ' &nbsp;&nbsp; ' + where : '');
    } else if (pvMeas.length === 1) {
      el.innerHTML = '<span style="color:' + MEAS_P + '">P1</span> ' + at(pvMeas[0]) +
                     ' &nbsp; \u2014 click the second point' +
                     (where ? ' &nbsp;&nbsp; ' + where : '') + tail;
    } else {
      var a = pvMeas[0], b = pvMeas[1];
      el.innerHTML =
        '<span style="color:' + MEAS_X + '">\u0394X ' + f(b.x - a.x) + '</span> &nbsp; ' +
        '<span style="color:' + MEAS_Y + '">\u0394Y ' + f(b.y - a.y) + '</span> &nbsp;&nbsp; ' +
        '<span style="color:' + MEAS_D + ';font-weight:700">dist ' +
        f(Math.hypot(b.x - a.x, b.y - a.y)) + '</span>' + tail;
    }
  }

  // The window changed shape - refit the open preview and keep what is on
  // screen: the 3D box keeps its camera, the drawing keeps its zoom and the
  // model point that was in the middle.
  function pvResize() {
    if (pvModuleId) { refreshPreview(); return; }
    if (!pv) return;
    var cv = document.getElementById('pb-pv-canvas');
    if (!cv) return;
    var vs = pvViewSize();
    if (vs.W === pv.W && vs.H === pv.H) return;
    var cxm = pv.minx + (pv.W / 2 - pv.ox) / pv.sc;
    var cym = pv.miny + (pv.H / 2 - pv.oy) / pv.sc;
    var PAD = Math.round(54 * vs.H / 540);
    cv.width = vs.W; cv.height = vs.H;
    pv.W = vs.W; pv.H = vs.H;
    pv.fit = Math.min((pv.W - PAD * 2) / Math.max(pv.maxx - pv.minx, 1e-6),
                      (pv.H - PAD * 2) / Math.max(pv.maxy - pv.miny, 1e-6));
    pv.ox = pv.W / 2 - (cxm - pv.minx) * pv.sc;
    pv.oy = pv.H / 2 - (cym - pv.miny) * pv.sc;
    drawPreview();
    pvReport(null);
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
      if (p.edge) return;                          // too many to mark; the hover ring finds them
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

    // \u00d8 on every round hole, R on the section fillets. Arrowhead on the curve,
    // one elbow out along (ux,uy), then a horizontal shoulder carrying the text.
    ctx.strokeStyle = '#9fb4cc';
    ctx.fillStyle = '#9fb4cc';
    ctx.font = '11px sans-serif';
    ctx.lineWidth = 1;
    function leader(ax, ay, ux, uy, text) {
      var kx = ax + ux * 16, ky = ay + uy * 16;
      var right = ux >= 0, sx2 = kx + (right ? 16 : -16);
      ctx.beginPath();
      ctx.moveTo(ax, ay); ctx.lineTo(kx, ky); ctx.lineTo(sx2, ky);
      ctx.stroke();
      var ah = 5, aw = 2.2;                               // arrowhead, back at the curve
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax + ux * ah - uy * aw, ay + uy * ah + ux * aw);
      ctx.lineTo(ax + ux * ah + uy * aw, ay + uy * ah - ux * aw);
      ctx.closePath();
      ctx.fill();
      ctx.textAlign = right ? 'left' : 'right';
      ctx.fillText(text, sx2 + (right ? 3 : -3), ky - 3);
      ctx.textAlign = 'left';
    }
    pvPts.forEach(function (p) {
      if (!p.dia) return;
      var u = Math.SQRT1_2, r = p.dia / 2 * sc;           // 45 deg, up-right on screen
      leader(mx(p.x) + u * r, my(p.y) - u * r, u, -u, '\u00d8' + p.dia);
    });
    (pv.rads || []).forEach(function (f) {                 // model +y is screen -y
      leader(mx(f.x), my(f.y), f.ux, -f.uy, 'R' + f.r);
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

    // a HOLE is an outline, not a part: no thickness, so no weight and no cuts
    // of its own - saying "0T / 0.000 kg" would only read as a mistake
    var isHole = !lastPlates[pv.id] && !!shapeLib[pv.id];
    var dims = spec.SHAPE === 'SECT'
      ? sectLabel(spec) + '  ·  L ' + spec.THK
      : spec.SHAPE === 'CIRC'
      ? 'D' + spec.D + (isHole ? '' : ' × THK ' + spec.THK)
      : (spec.WT === spec.WB && spec.OFF_T === spec.OFF_B
          ? spec.WB + ' × ' + spec.H + (isHole ? '' : ' × ' + spec.THK + 'T')
          : 'WT ' + spec.WT + ' / WB ' + spec.WB + ' × H ' + spec.H +
            (isHole ? '' : ' × ' + spec.THK + 'T'));
    var ncut = lastCuts.filter(function (c) { return c.PLATE === pv.id; }).length;
    var used = lastCuts.filter(function (c) { return c.REF === pv.id; }).length;
    document.getElementById('pb-pv-title').textContent = pv.id + (isHole ? '  (hole)' : '');
    document.getElementById('pb-pv-meta').innerHTML =
      esc(dims) +
      (isHole ? ' &middot; used by ' + used + (used === 1 ? ' cut' : ' cuts')
              : ' &middot; cuts ' + ncut +
                (spec.MAT ? ' &middot; ' + esc(spec.MAT) : '') +
                ' &middot; ' + (g.area * spec.THK * RHO).toFixed(3) + ' kg') +
      ' &nbsp;&nbsp;<span style="color:#5b6472">grid ' + step + 'mm &middot; ' +
      Math.round(sc / pv.fit * 100) + '% &middot; wheel: zoom, drag: pan, dbl-click: fit</span>';

    if (!pvBase) pvBase = document.createElement('canvas');
    pvBase.width = W; pvBase.height = H;
    pvBase.getContext('2d').drawImage(cv, 0, 0);   // snapshot for cheap hover redraws
  }
  function regenPreview() {                     // undo zoom/pan, back to the opening view
    if (pvModuleId) {
      if (!pvCtrl || !pvHome) return;
      pvCtrl.target.copy(pvHome.tgt);
      frameCam(pvCtrl.object, pvHome.tgt, pvHome.pos, pvBackDist);
      fitCam(pvCtrl.object, pvAspect);
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
    sectionRow(tbl, 'ghead', 'MODULES — click to preview', 2, 'module', ids.length);
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
        ' onclick="plateBuilder.openPalette(event,\'module\',\'' + id + '\',this)"></span></td>' +
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
  // The panel's own size is fixed and set by the caller, so this only fills it.
  function buildPvTree(id, force) {
    var host = document.getElementById('pb-pv-tree');
    if (!host) return;
    var part = lastParts[id];
    if (!part) { host.style.display = 'none'; host.innerHTML = ''; pvTreeId = null; return; }
    host.style.display = 'flex';
    // the preview rebuilds on every slider step - leave the panel's DOM alone
    // then, or the control being dragged is destroyed under the pointer
    if (force || pvTreeId !== id) {
      pvTreeId = id;
      var cells = part.pos.map(function (row) { return pvCells(row, part); });
      var cols = PV_COLS.filter(function (c) {
        return cells.some(function (x) { return x[c.k]; });
      });
      var html = '<tr><th class="who">member</th>';
      cols.forEach(function (c) {
        html += '<th' + (c.num ? ' class="num"' : '') + '>' + esc(c.h) + '</th>';
      });
      html += '</tr>';
      part.pos.forEach(function (row, i) {
        var key = id + '/' + row.NO;
        var on = !memberHidden[key];
        html += '<tr data-key="' + esc(key) + '"' + (on ? '' : ' class="off"') + '>' +
          '<td class="who">' +
          '<input type="checkbox" title="show / hide this plate"' + (on ? ' checked' : '') +
          ' onchange="plateBuilder.togglePvMember(\'' + id + '\',\'' + row.NO + '\',this.checked)">' +
          '<span class="sw" title="colour of this plate" style="background:' +
          int2hex(resolveColor({ plateId: row.PLATE }, (lastColors && lastColors[row.PLATE]) || 0x999999)) +
          '" onclick="plateBuilder.openPalette(event,\'plate\',\'' + row.PLATE + '\',this)"></span>' +
          '<input type="range" min="10" max="100" step="5" value="' +
          Math.round((ovOpac.member[key] !== undefined ? ovOpac.member[key] : 1) * 100) +
          '" title="opacity of this plate" ' +
          'oninput="plateBuilder.setOpacity(\'member\',\'' + key + '\',this.value)">' +
          '<label class="nm" title="show local axes at its Ref.Pt">' +
          '<input type="checkbox"' + (memberAxes[key] ? ' checked' : '') +
          ' onchange="plateBuilder.toggleMemberAxis(\'' + id + '\',\'' + row.NO + '\',this.checked)"> ' +
          esc(row.NO) + '</label></td>';
        cols.forEach(function (c) {
          html += '<td class="' + (c.num ? 'num' : '') + (c.k === 'note' ? ' note' : '') +
                  '">' + esc(cells[i][c.k] || '') + '</td>';
        });
        html += '</tr>';
      });
      host.innerHTML =
        '<div class="pvcap">members in ' + esc(id) +
        ' <span>(' + part.pos.length + ')</span></div>' +
        '<div class="pvscroll"><table>' + html + '</table></div>';
    }
  }

  // Where the module's BASE point ends up in preview coordinates. Recomputed
  // rather than cached, so hiding a member cannot take the datum away with it.
  function pvBasePoint(id) {
    var part = lastParts[id];
    if (!part || !part.base) return null;
    for (var i = 0; i < part.pos.length; i++) {
      var row = part.pos[i];
      if (row.NO !== part.base.inst) continue;
      var spec = specOf(row, lastPlates);
      if (!spec) return null;
      try {
        var m = yupFix(memberMatrix(row, namedPoints(spec, false), spec.THK));
        var a = refAnchor(spec, part.base.pt, part.base.face, row);
        return new THREE.Vector3(a[0], a[1], a[2]).applyMatrix4(m);
      } catch (e) { return null; }
    }
    return null;
  }

  function pvSnapsOf(id) {
    var part = lastParts[id], out = [];
    if (!part) return out;
    part.pos.forEach(function (row) {
      if (memberHidden[id + '/' + row.NO]) return;
      var spec = specOf(row, lastPlates);
      if (!spec) return;
      var m;
      try { m = yupFix(memberMatrix(row, namedPoints(spec, false), spec.THK)); } catch (e) { return; }
      var g2 = buildPlate2D(spec, lastCuts, lastPlates);
      out = out.concat(snapPointsOf({ outers: g2.outers, holes: g2.holes }, spec.THK, m, spec));
    });
    var bp = pvBasePoint(id);
    if (bp) out.push(bp);
    out.push(new THREE.Vector3(0, 0, 0));          // the module-local origin, where the triad is
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
  // Snap targets: every vertex of a plate's cut outline on both faces, the
  // centre of every hole (both faces and mid-thickness), and the nine named
  // points the sheet is written with.
  function snapPointsOf(rings, thk, matrix, spec) {
    var out = [], half = flatMode ? 0 : thk / 2;
    function push(x, y, z) { out.push(new THREE.Vector3(x, y, z).applyMatrix4(matrix)); }
    // A round bar's outline is a 48-gon. Those rim vertices are not measuring
    // points, and 96 of them per bar crowd out everything else within snapping
    // range of an end. The two end-face centres are what a bar is measured by.
    if (isBarSpec(spec)) {
      var c = (namedPoints(spec, false) || {}).mc || [0, 0];
      push(c[0], c[1], half);
      if (half) push(c[0], c[1], -half);
      return out;
    }
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
    /* The nine points the sheet places parts by - bl bc br / ml mc mr / tl tc
       tr - so a placement can be checked against the model using the same names
       it was written with. The corners usually land on outline vertices that
       were already here; what was missing was the four edge midpoints and mc,
       which left the middle of a plate as the one obvious place you could not
       measure from. mc also goes in at mid-thickness: the centre of the solid,
       not of a face. */
    var p9 = namedPoints(spec, false);
    if (p9) {
      POINT_KEYS.forEach(function (k) {
        var q = p9[k];
        if (!q) return;
        push(q[0], q[1], half);
        if (half) push(q[0], q[1], -half);
      });
      if (half && p9.mc) push(p9.mc[0], p9.mc[1], 0);
    }
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
      var g = pxGroup(p);
      var m = new THREE.Sprite(new THREE.SpriteMaterial({
        map: ringTexture(), color: color, depthTest: false, transparent: true }));
      m.scale.set(d, d, 1);
      g.add(m);
      return g;
    }
    function seg(a, b, color, r) {
      var g = new THREE.BufferGeometry().setFromPoints([a, b]);
      return new THREE.Line(g, new THREE.LineBasicMaterial({ color: color, depthTest: false }));
    }
    function fmt(n) { return (Math.round(n * 100) / 100).toString(); }

    function redraw() {
      clear();
      if (!M.on) { report(); return; }
      var g = new THREE.Group(), r = 13;             // px
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
        var lg = pxGroup(mid);
        lg.add(makeLabel(fmt(a.distanceTo(b)), '#ffe81f', 15));
        g.add(lg);
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
        el.innerHTML = '<span style="color:' + MEAS_P + '">P1</span> ' + xyz(M.picks[0]) +
          ' &nbsp; — click the second point' +
          ' &nbsp; <span style="color:#5b6472">right click to clear</span>';
        return;
      }
      var a = M.picks[0], b = M.picks[1];
      el.innerHTML =
        '<span style="color:' + MEAS_X + '">\u0394X ' + fmt(b.x - a.x) + '</span> &nbsp; ' +
        '<span style="color:' + MEAS_Y + '">\u0394Y ' + fmt(b.y - a.y) + '</span> &nbsp; ' +
        '<span style="color:' + MEAS_Z + '">\u0394Z ' + fmt(b.z - a.z) + '</span> &nbsp;&nbsp; ' +
        '<span style="color:' + MEAS_D + ';font-weight:700">dist ' +
        fmt(a.distanceTo(b)) + '</span>' +
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
      setCamera: function (c) { cfg.camera = c; },   // the view can swap projection
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

  // Screen-sized annotations. Children are laid out in pixels and the group is
  // rescaled every frame from the camera, so a marker or a label keeps its size
  // however far in you zoom. Works for either camera type.
  var _pxV = new THREE.Vector3();
  function pxGroup(pos) {
    var g = new THREE.Group();
    g.userData.px = true;
    if (pos) g.position.copy(pos);
    return g;
  }
  function worldPerPixel(cam, viewH, pos) {
    var h = Math.max(viewH || 0, 1);
    if (cam.isOrthographicCamera) return (cam.top - cam.bottom) / (cam.zoom || 1) / h;
    return 2 * cam.position.distanceTo(pos) * Math.tan(cam.fov * Math.PI / 360) / h;
  }
  function tickPx(root, cam, viewH) {
    if (!root || !cam) return;
    root.traverse(function (o) {
      if (!o.userData || !o.userData.px) return;
      o.getWorldPosition(_pxV);
      o.scale.setScalar(worldPerPixel(cam, viewH, _pxV));
    });
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
    var outer = new THREE.Group();
    var c = org;
    if (!c) {
      var pc = (namedPoints(spec, false).mc) || [0, 0];
      c = new THREE.Vector3(pc[0], pc[1], 0);
    }
    outer.matrixAutoUpdate = false;
    outer.matrix.copy(matrix.clone().multiply(
      new THREE.Matrix4().makeTranslation(c.x, c.y, c.z)));
    var g = pxGroup();                           // len is in pixels
    outer.add(g);
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
    return outer;
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

  // One WebGL context for the preview, reused across opens. Building a new
  // renderer per open exhausts the browser's context budget - the opacity and
  // axis controls reopen the preview on every input step - and once the budget
  // is gone the preview stays blank until the page is reloaded.
  /* The module preview is a fixed size. It used to be fitted - the panel took
     the width its table wanted and the view took the rest - so every module
     opened at a different size, and a module that looked bigger than the last
     one might only have had a shorter member list. Two constants now, the same
     on every module: you can tell one model from another by looking at it.

     16:9 at 1200 wide is exactly 675, so the view is 1200 x 675 with nothing to
     round. The panel keeps the proportion it had at 1100 - 355/1100 - which
     puts it at 387.

     The panel is the one that scrolls. It cannot hold MD.HEAD's table (775 wide,
     942 tall) and is not meant to: the controls and the member name are frozen
     at its left edge, and the columns past them slide under them. */
  var PV_VIEW_W = 1200, PV_VIEW_H = 675;   // the 3D view
  var PV_TREE_W = 387;                     // the member panel beside it
  var PV_GAP = 10;                         // .pvbody's gap between the two
  function pvRoom() {              // width inside the box, which is capped at 97vw
    return Math.floor(window.innerWidth * 0.97) - 36;
  }
  function pvAvailH() {            // ... and at 96vh, less the title and meta rows
    return Math.floor(window.innerHeight * 0.96) - 100;
  }
  /* Fixed means fixed on any screen that can hold it - 1684 x 808 of viewport,
     which on the site means a browser 2052 wide and 930 tall (the frame loses
     270 to the sidebar plus 98 of page gutter, and is 100vh - 120 less 2 for
     its border). Below that the whole body scales together rather than the
     modal growing a scrollbar, so the panel and the view keep their proportions
     to each other. */
  function pvModuleLayout() {
    var s = Math.min(1, pvRoom() / (PV_TREE_W + PV_GAP + PV_VIEW_W),
                     pvAvailH() / PV_VIEW_H);
    if (!(s > 0.3)) s = 0.3;                     // also catches NaN on odd hosts
    return { tree: Math.round(PV_TREE_W * s),
             W: Math.round(PV_VIEW_W * s), H: Math.round(PV_VIEW_H * s) };
  }
  /* The 2D plate drawing is its own thing and keeps the 960 cap: its dimension
     text is set in fixed pixels, so a bigger canvas would leave the numbers
     small against a larger drawing rather than simply showing more. */
  function pvViewSize() {
    var s = Math.min(1, pvRoom() / 960, pvAvailH() / 540);
    if (!(s > 0.3)) s = 0.3;
    return { W: Math.round(960 * s), H: Math.round(540 * s) };
  }

  /* The clip planes have to follow the model. They used to be a fixed 1 .. 50000
     mm, which is fine for a bracket and deletes a tower crane: the camera backs
     off to size * 1.5, so anything past about 33 m across sat beyond the far
     plane and the screen came up empty with no error to explain it. */
  function setClip(cams, size, dist) {
    var far = Math.max(50000, (dist || size * 1.5) * 4 + size);
    var near = Math.max(0.5, size / 5000);
    cams.forEach(function (c) {
      if (!c) return;
      c.near = near; c.far = far;
      c.updateProjectionMatrix();
    });
  }

  // The key light aims at the model rather than at the world origin, so a part
  // parked far off centre is lit from the same angle as one sitting on 0,0,0.
  function placeSun(sun, sc, bbox, size) {
    var rr = Math.max(size, 1);
    var c = bbox.isEmpty() ? new THREE.Vector3() : bbox.getCenter(new THREE.Vector3());
    sun.target.position.copy(c);
    sc.add(sun.target);
    sun.position.copy(c).add(new THREE.Vector3(0.45, -0.6, 0.9).multiplyScalar(rr));
  }
  /* ---- floor grid ----
     The cell used to be a flat 50 mm in the preview, so a 6 m member drew 240
     of them across: a moire that cost hundreds of lines and read as nothing.
     The step now comes off the 1/2/5 ladder, sized from the model, so the cell
     count stays near GRID_CELLS whether the part is a 200 mm bracket or a 60 m
     truss - and because the step is a round number, every crossing reads a
     round X/Y off the origin the centre cross sits on. */
  var GRID_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000,
                    5000, 10000, 20000, 50000, 100000];
  var GRID_CELLS = 32;
  function niceStep(want) {
    for (var i = 0; i < GRID_STEPS.length; i++) if (GRID_STEPS[i] >= want) return GRID_STEPS[i];
    return GRID_STEPS[GRID_STEPS.length - 1];
  }
  // The count has to be even. GridHelper tints the centre pair at index
  // divisions/2, so an odd count has no line on the axes at all - no cross on
  // the origin, and nothing for it to colour.
  function makeGrid(sc, span, c1, c2) {
    var step = niceStep(Math.max(span, 1) / GRID_CELLS);
    var n = Math.min(40, Math.max(6, Math.round(span / step / 2) * 2));
    var g = new THREE.GridHelper(step * n, n, c1, c2);
    g.rotation.x = Math.PI / 2;                 // GridHelper is XZ by default, lay it on XY
    backdrop(g);                                // on z = 0, drawn behind the solids
    sc.add(g);
    return g;
  }

  /* ---------------- interference ----------------
     Steel members are meant to touch: a butt joint shares a face, a box column
     is four plates meeting along their edges. So a clash is not "they touch",
     it is "one bit into the other by more than CLASH_TOL".

     Every member is a prism - a polygon pushed through its thickness. When two
     prisms have parallel extrusion axes, which is most of a plate assembly, the
     overlap is exact and cheap: intersect the outlines in the shared plane and
     multiply by the overlap of the two thickness ranges. Skewed pairs fall back
     to their oriented boxes, so a deeply notched plate crossing another at an
     angle can report a clash the solids do not really have. */
  var showClash = false, showClashPv = false;
  var CLASH_TOL = 0.5;                          // mm of bite before it counts
  var CLASH_COL = 0xff3b30;

  function itemBox3(it) {                       // world AABB, for the broad phase
    if (it.__cbox) return it.__cbox;
    var b = new THREE.Box3(), h = (it.thk || 0) / 2, v = new THREE.Vector3();
    it.rings.outers.forEach(function (r) {
      r.forEach(function (q) {
        b.expandByPoint(v.set(q[0], q[1], -h).applyMatrix4(it.matrix));
        b.expandByPoint(v.set(q[0], q[1], h).applyMatrix4(it.matrix));
      });
    });
    it.__cbox = b;
    return b;
  }
  function ringsRegion(rings, map) {            // polybool region, outers and holes alike
    var rs = [];
    rings.outers.forEach(function (r, i) {
      rs.push(map ? r.map(map) : r);
      (rings.holes[i] || []).forEach(function (h) { rs.push(map ? h.map(map) : h); });
    });
    return { regions: rs, inverted: false };
  }
  function localBox2(rings) {
    var b = { x0: 1e30, y0: 1e30, x1: -1e30, y1: -1e30 };
    rings.outers.forEach(function (r) {
      r.forEach(function (q) {
        if (q[0] < b.x0) b.x0 = q[0]; if (q[0] > b.x1) b.x1 = q[0];
        if (q[1] < b.y0) b.y0 = q[1]; if (q[1] > b.y1) b.y1 = q[1];
      });
    });
    return b;
  }

  // Exact path. Returns geometry in a's local frame, or null when the axes are
  // not parallel or the two do not bite deep enough into each other.
  /* Two answers, not one. null means "these two are not both prisms on a shared
     axis, so I cannot judge them" and the caller falls back to bounding boxes.
     false means "I looked, and they do not touch" - which the caller must take
     as final. Returning null for both is why a bolt sitting happily in its own
     clearance hole came back red: the exact test cleared it, and then the box
     test, which knows nothing about holes, condemned it. */
  function prismClash(a, b) {
    var M = new THREE.Matrix4().copy(a.matrix).invert().multiply(b.matrix);
    var e = M.elements;
    if (Math.abs(e[8]) > 1e-4 || Math.abs(e[9]) > 1e-4 || Math.abs(e[10]) < 0.9999) return null;
    var ha = (a.thk || 0) / 2, hb = (b.thk || 0) / 2, cz = e[14];
    var lo = Math.max(-ha, cz - hb), hi = Math.min(ha, cz + hb);
    if (hi - lo <= CLASH_TOL) return false;
    var v = new THREE.Vector3();
    var flat = PolyBool.intersect(ringsRegion(a.rings),
      ringsRegion(b.rings, function (q) {
        v.set(q[0], q[1], 0).applyMatrix4(M);     // z drops out, the axes align
        return [v.x, v.y];
      }));
    var c = classifyRings(flat.regions);
    if (!c.outers.length) return false;
    var area = 0;
    c.outers.forEach(function (r) { area += Math.abs(ringArea(r)); });
    if (area <= CLASH_TOL * CLASH_TOL) return false;
    var geos = [];
    c.outers.forEach(function (ring, i) {
      var sh = new THREE.Shape(ring.map(function (q) { return new THREE.Vector2(q[0], q[1]); }));
      (c.holes[i] || []).forEach(function (h) {
        sh.holes.push(new THREE.Path(h.map(function (q) { return new THREE.Vector2(q[0], q[1]); })));
      });
      var g = new THREE.ExtrudeGeometry(sh, { depth: hi - lo, bevelEnabled: false });
      g.translate(0, 0, lo);
      geos.push(g);
    });
    return geos;
  }

  /* ---- oriented boxes, for the pairs the exact path cannot take ---- */
  function obbOf(it) {
    if (it.__obb) return it.__obb;
    var bb = localBox2(it.rings), m = it.matrix.elements;
    var u = [new THREE.Vector3(m[0], m[1], m[2]).normalize(),
             new THREE.Vector3(m[4], m[5], m[6]).normalize(),
             new THREE.Vector3(m[8], m[9], m[10]).normalize()];
    it.__obb = { c: new THREE.Vector3((bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2, 0)
                        .applyMatrix4(it.matrix),
                 u: u,
                 e: [(bb.x1 - bb.x0) / 2, (bb.y1 - bb.y0) / 2, (it.thk || 0) / 2] };
    return it.__obb;
  }
  // smallest overlap over the 15 separating axes; <= 0 means they are apart
  function obbBite(A, B) {
    var axes = [], i, j;
    for (i = 0; i < 3; i++) axes.push(A.u[i], B.u[i]);
    for (i = 0; i < 3; i++) for (j = 0; j < 3; j++) {
      var x = new THREE.Vector3().crossVectors(A.u[i], B.u[j]);
      if (x.lengthSq() > 1e-8) axes.push(x.normalize());
    }
    var d = new THREE.Vector3().subVectors(B.c, A.c), best = Infinity;
    for (i = 0; i < axes.length; i++) {
      var n = axes[i], ra = 0, rb = 0;
      for (j = 0; j < 3; j++) {
        ra += A.e[j] * Math.abs(A.u[j].dot(n));
        rb += B.e[j] * Math.abs(B.u[j].dot(n));
      }
      var gap = ra + rb - Math.abs(d.dot(n));
      if (gap <= 0) return 0;
      if (gap < best) best = gap;
    }
    return best;
  }
  function obbFaces(O) {                        // six world-space quads
    var out = [];
    [0, 1, 2].forEach(function (i) {
      var j = (i + 1) % 3, k = (i + 2) % 3;
      [1, -1].forEach(function (s) {
        var mid = O.c.clone().addScaledVector(O.u[i], s * O.e[i]);
        out.push([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(function (t) {
          return mid.clone().addScaledVector(O.u[j], t[0] * O.e[j])
                            .addScaledVector(O.u[k], t[1] * O.e[k]);
        }));
      });
    });
    return out;
  }
  function clipPoly(poly, pt, n) {              // keep the side the normal points away from
    var out = [];
    for (var i = 0; i < poly.length; i++) {
      var p = poly[i], q = poly[(i + 1) % poly.length];
      var dp = p.clone().sub(pt).dot(n), dq = q.clone().sub(pt).dot(n);
      if (dp <= 0) out.push(p);
      if ((dp < 0) !== (dq < 0)) out.push(p.clone().lerp(q, dp / (dp - dq)));
    }
    return out;
  }
  function clipToObb(poly, O) {
    for (var i = 0; i < 3 && poly.length > 2; i++) {
      poly = clipPoly(poly, O.c.clone().addScaledVector(O.u[i], O.e[i]), O.u[i]);
      if (poly.length > 2)
        poly = clipPoly(poly, O.c.clone().addScaledVector(O.u[i], -O.e[i]), O.u[i].clone().negate());
    }
    return poly;
  }
  // The boundary of two intersecting convex boxes is exactly the part of each
  // one's faces that lies inside the other - so no hull is needed.
  function obbClash(a, b) {
    var A = obbOf(a), B = obbOf(b);
    if (obbBite(A, B) <= CLASH_TOL) return null;
    var tris = [];
    function add(faces, other) {
      faces.forEach(function (f) {
        var p = clipToObb(f, other);
        for (var i = 1; i + 1 < p.length; i++) tris.push(p[0], p[i], p[i + 1]);
      });
    }
    add(obbFaces(A), B);
    add(obbFaces(B), A);
    if (tris.length < 3) return null;
    var pos = [];
    tris.forEach(function (p) { pos.push(p.x, p.y, p.z); });
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return [g];                                  // already world space
  }

  // Red solids marking where members share volume. Drawn without depth testing
  // so a clash buried inside a member still shows.
  function buildClash(sc, list) {
    var mat = new THREE.MeshBasicMaterial({ color: CLASH_COL, transparent: true,
      opacity: 0.72, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
    var grp = new THREE.Group();
    grp.renderOrder = 3;
    var n = 0;
    for (var i = 0; i < list.length; i++) {
      for (var j = i + 1; j < list.length; j++) {
        var a = list[i], b = list[j];
        if (!itemBox3(a).intersectsBox(itemBox3(b))) continue;
        var geos, world = false;
        try {
          geos = prismClash(a, b);
          if (geos === null) { geos = obbClash(a, b); world = true; }
        } catch (err) { geos = null; }
        if (!geos) continue;
        n++;
        geos.forEach(function (g) {
          var mesh = new THREE.Mesh(g, mat);
          if (!world) { mesh.matrixAutoUpdate = false; mesh.matrix.copy(a.matrix); }
          mesh.renderOrder = 3;
          grp.add(mesh);
        });
      }
    }
    if (!n) { grp.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
              mat.dispose(); return null; }
    sc.add(grp);
    return grp;
  }

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
      pvRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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
    pvCam = pvCamP = pvCamO = null;
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
    ['pb-pv-flat', 'pb-pv-meas', 'pb-pv-ids', 'pb-pv-faces', 'pb-pv-ortho', 'pb-pv-clash'].forEach(function (q) {
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

    // not forced: an opacity slider reopens the preview on every step, and a
    // rebuild would destroy the control under the pointer
    buildPvTree(id);
    var tree = document.getElementById('pb-pv-tree');
    var vs = pvModuleLayout();
    var W = vs.W, H = vs.H;                      // the fixed 1000 x 563, or scaled
    host.style.width = W + 'px'; host.style.height = H + 'px';
    // + the panel's two borders, so its outer edge lines up with the view's
    if (tree) { tree.style.width = vs.tree + 'px'; tree.style.height = (H + 2) + 'px'; }
    var sc = new THREE.Scene();
    pvScene = sc;
    sc.background = new THREE.Color(0x15181c);
    pvAspect = W / H;
    pvCamP = new THREE.PerspectiveCamera(MAIN_FOV, pvAspect, 1, 50000);
    pvCamO = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 50000);
    pvCamP.up.set(0, 0, 1);                      // Z-up world
    pvCamO.up.set(0, 0, 1);
    var cam = pvCam = orthoPv ? pvCamO : pvCamP;
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
        idRows = [], clashRows = [];
    pvMemberObj = {};
    part.pos.forEach(function (row) {
     try {
      var spec = specOf(row, lastPlates);
      if (!spec) { bad.push(row.NO); return; }
      var pts = namedPoints(spec, false);
      var m;
      try { m = yupFix(memberMatrix(row, pts, spec.THK)); } catch (e) { return; }
      if (part.base && row.NO === part.base.inst) {
        var a = refAnchor(spec, part.base.pt, part.base.face, row);
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
        pvSnaps = pvSnaps.concat(
          snapPointsOf({ outers: g2d.outers, holes: g2d.holes }, spec.THK, m, spec));
        clashRows.push({ rings: { outers: g2d.outers, holes: g2d.holes },
                         thk: spec.THK, matrix: m });
      }
      var pop = resolveOpac({ plateId: row.PLATE, moduleId: id, memberKey: id + '/' + row.NO });
      var mat = new THREE.MeshPhongMaterial({
        color: resolveColor({ plateId: row.PLATE }, lastColors[row.PLATE] || 0x999999),
        shininess: 28, side: flatMode ? THREE.DoubleSide : THREE.FrontSide,
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
    setClip([pvCamP, pvCamO], size);
    var mn = bbox.min, mx3 = bbox.max;
    axRows.forEach(function (a) {
      a.g.add(plateTriad(a.spec, a.m, 34, a.rp.p, a.rp.name));   // 34 px arms
    });
    idRows.forEach(function (d) {
      var lg = pxGroup(d.pos);
      lg.add(makeLabel(d.text, '#dfe6f0', 14));
      d.g.add(lg);
    });

    // Module base point. Everything in here is laid out in pixels and the whole
    // group is rescaled each frame from the camera distance, so the marker stays
    // the same size on screen however far in you zoom.
    var baseGrp = null;
    if (basePt) {
      baseGrp = pxGroup(basePt);
      var bmat = new THREE.MeshBasicMaterial({ color: 0xf0c674, depthTest: false });
      var mk = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 12), bmat);
      baseGrp.add(mk);
      var cmat = new THREE.LineBasicMaterial({ color: 0xf0c674, depthTest: false });
      [[18, 0, 0], [0, 18, 0], [0, 0, 18]].forEach(function (v) {
        var a = new THREE.Vector3(v[0], v[1], v[2]);
        baseGrp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(
          [a.clone().negate(), a]), cmat));
      });
      var bl = makeLabel('BASE', '#f0c674', 15);
      var lpos = new THREE.Vector3(-42, -30, -16);
      bl.position.copy(lpos);
      baseGrp.add(bl);
      baseGrp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(
        [new THREE.Vector3(0, 0, 0), lpos.clone()]), cmat));
      sc.add(baseGrp);
    }

    // Floor grid, on z = 0 so its centre cross is the coordinate origin.
    var reach = bbox.isEmpty() ? 500 : Math.max(
      Math.abs(mn.x), Math.abs(mx3.x), Math.abs(mn.y), Math.abs(mx3.y), size * 0.3);
    if (showClashPv) buildClash(sc, clashRows);
    var gspan = Math.ceil(reach * 2 / 100) * 100;
    makeGrid(sc, gspan, 0x7d8796, 0x39414c);
    placeSun(sun, sc, bbox, size);

    // module-local origin: the point L.X/L.Y/L.Z are measured from. Just the
    // axis triad - a label here collides with the BASE one whenever the two
    // points are close, which is most of the time.
    var org = pxGroup();                         // 30 px arms, whatever the zoom
    [[new THREE.Vector3(30, 0, 0), 0xe05c4f],
     [new THREE.Vector3(0, 30, 0), 0x6fc36f],
     [new THREE.Vector3(0, 0, 30), 0x5c9bd1]].forEach(function (a) {
      org.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(
        [new THREE.Vector3(0, 0, 0), a[0]]),
        new THREE.LineBasicMaterial({ color: a[1], depthTest: false })));
    });
    sc.add(org);

    var ctr = new THREE.OrbitControls(cam, rn.domElement);
    pvCtrl = ctr;
    ctr.enableDamping = true;
    ctr.dampingFactor = 0.1;
    var home = new THREE.Vector3(center.x + size * 1.05, center.y - size * 1.2,
                                 center.z + size * 0.85);
    pvBackDist = home.distanceTo(center) || size || 1000;
    ctr.target.copy(center);
    frameCam(cam, center, home, pvBackDist);
    fitCam(cam, pvAspect);
    ctr.update();
    pvHome = { pos: home.clone(), tgt: center.clone() };

    pvMeta.innerHTML =
      'members ' + part.pos.length + ' &middot; ' + mass.toFixed(3) + ' kg &middot; ' +
      (part.base ? 'base ' + esc(part.base.inst) + '.' + part.base.pt +
                   faceMark(part.base.face) + ' <span style="color:#f0c674">(&#9679;)</span>'
                 : '<span style="color:#f0c674">no BASE — local origin</span>') +
      (bad.length ? ' &middot; <span style="color:#f09a9a">not drawn: ' +
                    esc(bad.join(', ')) + '</span>' : '') +
      /* The view's own size, because you cannot read it off the screen. It is
         PV_VIEW_W x PV_VIEW_H whenever the window can hold that, and smaller
         when it cannot - and telling those two apart by eye is impossible,
         which turns "did the update land?" into a question nobody can answer.
         A window too narrow says so rather than looking like a stale build. */
      ' &nbsp;&nbsp;<span style="color:#5b6472">' + W + '&times;' + H +
      (W < PV_VIEW_W ? ' <span style="color:#8a7a45">(window too small for ' +
                       PV_VIEW_W + '&times;' + PV_VIEW_H + ')</span>' : '') +
      ' &nbsp; drag to rotate</span>';

    if (measPv) measPv.dispose();
    measPv = createMeasure({ scene: sc, camera: cam, dom: rn.domElement,
                             out: 'pb-pv-pos', size: function () { return size; } });
    if (basePt) pvSnaps.push(basePt.clone());    // the datum snaps too
    pvSnaps.push(new THREE.Vector3(0, 0, 0));    // and so does the local origin
    measPv.setSnaps(pvSnaps);
    document.getElementById('pb-pv-meas').checked = measurePv;
    document.getElementById('pb-pv-ids').checked = showIdsPv;
    document.getElementById('pb-pv-faces').checked = showFacesPv;
    document.getElementById('pb-pv-ortho').checked = orthoPv;
    document.getElementById('pb-pv-clash').checked = showClashPv;
    measPv.enable(measurePv);

    var pgz = buildGizmo();
    pvToken++;
    var token = pvToken;
    (function loop() {                            // reads pvCam/pvCtrl: ortho can swap them
      if (token !== pvToken) return;
      requestAnimationFrame(loop);
      pvCtrl.update();
      tickPx(sc, pvCam, H);
      rn.render(sc, pvCam);
      drawGizmo(rn, pgz, pvCam, pvCtrl.target, W, H, 74);
    })();
  }

  /* ---------------- sidebar list ---------------- */
  // The assembly list stops at ASSY and MODULE level: an assembly row, then one
  // row per module placed in it (a plate placed on its own gets its own row).
  // Individual plates live in the MODULE list and its preview.
  var listRows = [], listGroups = [];   // display order, for checkbox syncing
  // Identity colours for the assembly list. They say which rows belong to which
  // ASSY id and nothing else - the 3D keeps using the module and plate colours,
  // so these are deliberately darker and more saturated than the part palette
  // and cannot be mistaken for a member swatch.
  var ASSY_TINT = ['#2563eb', '#e11d48', '#059669', '#d97706', '#7c3aed',
                   '#0891b2', '#be185d', '#4d7c0f', '#c2410c', '#4338ca'];
  /* ---- folding ----
     Keyed by assembly id rather than by row, so recolouring a module - which
     rebuilds the list - does not throw open everything the user had put away.
     An id not in here yet starts folded: the list opens as a table of contents,
     one line per assembly, and you open the one you are actually after. A fresh
     sheet clears the map, so a load always starts from that state. */
  var folded = {};                      // ASSY id -> members collapsed
  /* ---- picking a member from the list ----
     Clicking a member says "show me this one in the model" - it does not open
     the module drawing, which is what the MODULES list above is for. The item
     glows, its edges turn cyan and a box is thrown round it so it can be found
     among a hundred others; clicking the same row again drops the selection. */
  var SEL_COL = 0x0891b2, SEL_GLOW = 0x06262f;   // enough to pick out, not to bleach
  var selKey = null;                    // instKey of the picked row
  var selGroup = null;                  // ... or the name of a picked assembly
  // One picked thing at a time, but it is either a row or a whole assembly, so
  // every place that asked "is this the picked row" has to ask this instead.
  function itemPicked(it) {
    if (selGroup !== null) return it.group === selGroup;
    return !!selKey && it.instKey === selKey;
  }
  var selBox = null;                    // its outline in the main scene
  function clearSelBox() {
    if (!selBox) return;
    if (selBox.parent) selBox.parent.remove(selBox);
    if (selBox.geometry) selBox.geometry.dispose();
    if (selBox.material) selBox.material.dispose();
    selBox = null;
  }
  function drawSelBox() {
    clearSelBox();
    if ((!selKey && selGroup === null) || !scene) return;
    var box = new THREE.Box3();
    items.forEach(function (it) {
      if (itemPicked(it) && it.groupObj.visible) box.expandByObject(it.groupObj);
    });
    if (box.isEmpty()) return;
    var pad = Math.max(6, box.getSize(new THREE.Vector3()).length() * 0.02);
    box.expandByScalar(pad);
    selBox = new THREE.Box3Helper(box, new THREE.Color(SEL_COL));
    selBox.material.depthTest = false;     // readable even when buried in the model
    selBox.material.transparent = true;
    selBox.renderOrder = 997;
    scene.add(selBox);
  }
  function markPicked() {
    var tbl = document.getElementById('pb-list');
    if (!tbl) return;
    [].forEach.call(tbl.querySelectorAll('tr[data-row]'), function (tr) {
      tr.className = tr.getAttribute('data-key') === selKey ? 'sel' : '';
    });
    [].forEach.call(tbl.querySelectorAll('tr[data-gh]'), function (tr) {
      var n = tr.getAttribute('data-gname');
      tr.className = 'gsub' + (selGroup !== null && n === selGroup ? ' sel' : '');
    });
  }
  function selectRow(ri) {
    var r = listRows[ri];
    if (!r) return;
    selKey = selKey === r.key ? null : r.key;    // the same row again clears it
    selGroup = null;
    restyleAll();
    drawSelBox();
    markPicked();
  }
  // Clicking an assembly's name picks every member under it at once - the box
  // in the view is drawn round the lot, so it says where the assembly is
  // rather than where one of its plates is.
  function selectGroup(gi) {
    var g = listGroups[gi];
    if (!g) return;
    selGroup = selGroup === g.name ? null : g.name;
    selKey = null;
    restyleAll();
    drawSelBox();
    markPicked();
  }
  // a chevron in a ring, drawn rather than fetched - the viewer runs in its own
  // document and one circle plus one polyline costs less than an icon font
  var ICON_FOLD =
    '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden="true">' +
    '<circle cx="8" cy="8" r="6.9" stroke="currentColor" stroke-width="1.25"/>' +
    '<path d="M5.1 6.7 8 9.6l2.9-2.9" stroke="currentColor" stroke-width="1.75"' +
    ' stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function toggleFold(gi) {
    var g = listGroups[gi], tbl = document.getElementById('pb-list');
    if (!g || !tbl) return;
    var shut = folded[g.name] = !folded[g.name];
    [].forEach.call(tbl.querySelectorAll('tr[data-gi="' + gi + '"]'), function (tr) {
      tr.style.display = shut ? 'none' : '';
    });
    var head = tbl.querySelector('tr[data-gh="' + gi + '"] .fold');
    if (head) head.className = 'fold' + (shut ? ' shut' : '');
  }
  function buildList(colors) {
    var tbl = document.getElementById('pb-list');
    var total = 0;
    tbl.innerHTML = '';
    listRows = [];
    listGroups = [];
    var groups = [], gmap = {};
    items.forEach(function (it) {
      total += it.mass;
      var g = gmap[it.group];
      if (!g) { g = gmap[it.group] = { name: it.group, rows: [], rmap: {} }; groups.push(g); }
      var r = g.rmap[it.instKey];
      if (!r) {
        r = g.rmap[it.instKey] = { key: it.instKey, group: it.group, moduleId: it.moduleId,
                                   plateId: it.plateId, member: it.member,
                                   mods: {}, n: 0, mass: 0, items: [] };
        g.rows.push(r);
      }
      r.n++; r.mass += it.mass; r.items.push(it);
      if (it.moduleId) r.mods[it.moduleId] = 1;
    });

    sectionRow(tbl, 'ghead', 'ASSEMBLY — placed modules', 2, 'assy', groups.length);
    if (!items.length) sectionRow(tbl, 'none', 'no ASSY row — nothing placed');

    groups.forEach(function (g) {
      var gi = listGroups.length;
      listGroups.push(g);
      var band = ASSY_TINT[gi % ASSY_TINT.length];
      if (folded[g.name] === undefined) folded[g.name] = true;   // new: start put away
      var shut = folded[g.name];
      var gtr = document.createElement('tr');
      gtr.className = 'gsub';
      gtr.setAttribute('data-gh', gi);
      gtr.setAttribute('data-gname', g.name);
      var gOn = g.rows.some(function (r) {
        return r.items.some(function (it) { return it.groupObj.visible; });
      });
      gtr.innerHTML = '<td class="sty">' +
        '<input type="checkbox" id="pb-gb' + gi + '"' +
        (gOn ? ' checked' : '') + ' ' +
        'onchange="plateBuilder.toggleGroup(\'' + g.name + '\',this.checked)">' +
        '<input type="range" min="10" max="100" step="5" value="' +
        Math.round((ovOpac.group[g.name] !== undefined ? ovOpac.group[g.name] : 1) * 100) +
        '" title="opacity of this assembly" ' +
        'oninput="plateBuilder.setOpacity(\'group\',\'' + g.name + '\',this.value)"></td>' +
        '<td><span class="fold' + (shut ? ' shut' : '') + '" style="color:' + band + '"' +
        ' onclick="plateBuilder.toggleFold(' + gi + ')"' +
        ' title="show or hide the members of this assembly">' + ICON_FOLD + '</span>' +
        '<span class="gname" onclick="plateBuilder.selectGroup(' + gi + ')"' +
        ' title="pick every member of this assembly">' +
        (g.name === '-' ? 'single plates' : esc(g.name)) + '</span>' +
        '<span class="gcount">' + g.rows.length +
        (g.rows.length > 1 ? ' members' : ' member') + '</span></td>';
      tbl.appendChild(gtr);

      g.rows.forEach(function (r) {
        var ri = listRows.length;
        listRows.push(r);
        // A row that holds exactly one module - or one lone plate - can carry
        // that thing's colour. A row standing for a whole assembly put inside
        // this one is a mixture, so it just counts.
        var mods = Object.keys(r.mods);
        var nmod = mods.length;
        var nloose = r.items.filter(function (it) { return !it.moduleId; }).length;
        var made = [];
        if (nmod) made.push(nmod + (nmod > 1 ? ' modules' : ' module'));
        if (nloose) made.push(nloose + (nloose > 1 ? ' parts' : ' part'));
        var soleMod = nmod === 1 && !nloose ? mods[0] : null;
        var solePlate = !nmod && nloose === 1 ? r.plateId : null;
        var col = soleMod ? moduleColor(soleMod)
                : solePlate ? resolveColor({ plateId: solePlate }, r.items[0].baseColor) : 0;
        var cscope = soleMod ? 'module' : 'plate';
        var ckey = soleMod || solePlate;
        var tr = document.createElement('tr');
        tr.setAttribute('data-gi', gi);
        tr.setAttribute('data-row', ri);
        tr.setAttribute('data-key', r.key);
        if (r.key === selKey) tr.className = 'sel';
        if (shut) tr.style.display = 'none';
        tr.innerHTML =
          '<td class="sty">' +
          '<input type="checkbox" id="pb-ib' + ri + '"' +
          (r.items.some(function (it) { return it.groupObj.visible; }) ? ' checked' : '') + ' ' +
          'data-grp="' + esc(r.group) + '" ' +
          'onchange="plateBuilder.toggleInst(' + ri + ',this.checked)">' +
          (ckey
            ? '<span class="sw" style="margin-left:5px;background:' + int2hex(col) +
              '" title="colour of this ' + cscope +
              '" onclick="plateBuilder.openPalette(event,\'' + cscope + '\',\'' + ckey + '\',this)">' +
              '</span>'
            : '') +
          '<input type="range" min="10" max="100" step="5" value="' +
          Math.round(resolveOpac(r.items[0]) * 100) +
          '" title="opacity of this placement" ' +
          'oninput="plateBuilder.setOpacity(\'inst\',\'' + r.key + '\',this.value)"></td>' +
          '<td><span class="plname subname" title="highlight this one in the model"' +
          ' onclick="plateBuilder.selectRow(' + ri + ')">' +
          esc(r.member || r.moduleId || r.plateId) + '</span>' +
          '<div class="dims">' +
          (soleMod ? 'members ' + r.n
                   : solePlate ? r.items[0].dims
                   : (made.join(' + ') || r.n + ' members')) +
          ' · ' + r.mass.toFixed(3) + 'kg</div></td>';
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
    updateSceneClash();
    syncMeasureSnaps();
    drawSelBox();                                 // a hidden member loses its box
  }
  function toggleItem(i, on) {
    items[i].groupObj.visible = on;
    updateSceneAxes(); updateSceneFaces(); updateSceneIds(); updateSceneClash();
    syncMeasureSnaps();
    drawSelBox();
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
    updateSceneClash();
    syncMeasureSnaps();
    drawSelBox();
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
    downloadBlob(new Blob([text], { type: 'application/octet-stream' }), filename);
  }
  function downloadBlob(blob, filename) {
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 8000);
  }

  // plates of a module, in module-local coordinates (for preview exports)
  function moduleItems(id) {
    var part = lastParts[id];
    if (!part) return [];
    var out = [];
    part.pos.forEach(function (row) {
      if (memberHidden[id + '/' + row.NO]) return;      // export what the preview shows
      var spec = specOf(row, lastPlates);
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

  // An empty model still writes a syntactically valid STL and IFC - a file with
  // no solids in it - so the browser downloads something that looks fine and is
  // not. Say so instead.
  function nothing(list, what) {
    if (list.length) return false;
    alert('Nothing to export' + (what ? ' from ' + what : '') + '.\n\n' +
          'Load a sheet with Load Excel, or tick at least one member back on.');
    return true;
  }
  function visibleItems() {
    return items.filter(function (it) { return it.groupObj.visible; });
  }
  function exportSTL() {
    var list = visibleItems();
    if (nothing(list)) return;
    download(buildSTL(list, 'plate_builder'), 'plate_builder.stl');
  }
  function exportModuleSTL() {
    if (!pvModuleId) return;
    var list = moduleItems(pvModuleId);
    if (nothing(list, pvModuleId)) return;
    download(buildSTL(list, pvModuleId), pvModuleId + '.stl');
  }
  function exportModuleIFC() {
    if (!pvModuleId) return;
    var list = moduleItems(pvModuleId);
    if (nothing(list, pvModuleId)) return;
    download(buildIFC(list, pvModuleId), pvModuleId + '.ifc');
  }

  /* -------- IFC export (IFC2X3, parametric extrusions) --------
     Each visible part becomes an IfcPlate (IfcMember for bars) whose
     geometry is the exact 2D profile (with hole voids) extruded by the
     thickness — real BIM solids, not triangle meshes. */
  function exportIFC() {
    var list = visibleItems();
    if (nothing(list)) return;
    download(buildIFC(list, 'plate_builder'), 'plate_builder.ifc');
  }

  /* ================= BOQ: the take-off, as a workbook =================
     Four sheets, reading outward from the steel:
       SUMMARY    what the model weighs, by category
       PART LIST  every distinct part with the fields it was written with
       MODULES    each module once - what it holds, what one weighs, how many
       ASSEMBLY   each assembly as modules only, then the grand total

     Parts are grouped by their **input fields**, not by id alone: a section
     placed by coordinates arrives in as many lengths from one definition, and
     two lengths of one profile are two lines on a take-off. Field sets differ by
     shape, so each shape gets its own block with its own header - a TRAP column
     called WT is not a RECT column called B, and calling both "p2" is how
     take-offs get misread.

     Detail stops at the module. An assembly line wants the module, how many of
     it, and what it weighs - not the plate thicknesses inside, which the MODULES
     sheet already carries once instead of once per copy. */
  var BOQ_KIND = {
    RECT:   { t: 'PLATE — RECT', f: [['THK', 'THK'], ['B', 'WB'], ['H', 'H']], area: true },
    TRAP:   { t: 'PLATE — TRAP', f: [['THK', 'THK'], ['WB', 'WB'], ['WT', 'WT'],
                                     ['H', 'H'], ['OFF_T', 'OFF_T']], area: true },
    CIRC:   { t: 'PLATE — CIRC', f: [['THK', 'THK'], ['D', 'D']], area: true },
    BAR:    { t: 'BAR', f: [['DIA', 'D'], ['LENGTH', 'THK']] },
    SECT_H: { t: 'SECT — H', f: [['h', 'h'], ['bb', 'bb'], ['bt', 'bt'], ['tw', 'tw'],
                                 ['tf1', 'tf1'], ['tf2', 'tf2'], ['r1', 'r1'],
                                 ['LENGTH', 'THK']] },
    SECT_C: { t: 'SECT — C', f: [['h', 'h'], ['b', 'b'], ['tw', 'tw'], ['tf', 'tf'],
                                 ['rw', 'rw'], ['rf', 'rf'], ['LENGTH', 'THK']] },
    SECT_L: { t: 'SECT — L', f: [['a', 'a'], ['b', 'b'], ['t1', 't1'], ['t2', 't2'],
                                 ['r1', 'r1'], ['r2', 'r2'], ['LENGTH', 'THK']] }
  };
  var BOQ_ORDER = ['RECT', 'TRAP', 'CIRC', 'BAR', 'SECT_H', 'SECT_C', 'SECT_L'];
  var BOQ_CAT = { RECT: 'PLATE', TRAP: 'PLATE', CIRC: 'PLATE', BAR: 'BAR',
                  SECT_H: 'SECT', SECT_C: 'SECT', SECT_L: 'SECT' };
  function boqKind(spec) {
    if (isSectSpec(spec)) return 'SECT_' + spec.SECT;
    if (isBarSpec(spec)) return 'BAR';
    if (spec.SHAPE === 'CIRC') return 'CIRC';
    return (spec.WT === spec.WB && spec.OFF_T === spec.OFF_B) ? 'RECT' : 'TRAP';
  }
  function cutCount(id) {
    return lastCuts.filter(function (c) { return c.PLATE === id; }).length;
  }
  // One line per distinct part. Mirrored and reflected copies weigh the same as
  // the original, so they land on the same line and only lift the count.
  function boqAgg(list) {
    var map = {}, keys = [], total = 0;
    list.forEach(function (it) {
      var spec = it.spec, k = boqKind(spec), def = BOQ_KIND[k];
      var vals = def.f.map(function (p) { return +num(spec[p[1]], 0).toFixed(4); });
      var key = k + '|' + spec.ID + '|' + vals.join(',');
      var e = map[key];
      if (!e) {
        // The engine's own area, back out of the mass it already computed, so a
        // sheet formula built on it lands on the same figure. A plate's is its
        // face in m² (what you paint and what you buy); a bar's or a section's is
        // the profile in mm², which is also where its kg/m comes from. Neither is
        // the textbook number: circles are polygons here and fillets are eight
        // segments a quarter, so the take-off matches the solid, not a handbook.
        var thk = num(spec.THK, 0);
        var aMM = thk ? it.mass / (thk * RHO) : 0;
        e = map[key] = { kind: k, id: spec.ID, mat: spec.MAT || '—', vals: vals,
                         area: def.area ? aMM / 1e6 : null,
                         cuts: def.area ? cutCount(spec.ID) : null,
                         areaMM: def.area ? null : aMM,
                         kgm: def.area ? null : aMM * RHO * 1000,
                         unit: it.mass, qty: 0, wt: 0 };
        keys.push(key);
      }
      e.qty++;
      total += it.mass;
    });
    var rows = keys.map(function (k) { var e = map[k]; e.wt = e.unit * e.qty; return e; });
    rows.sort(function (a, b) {
      if (a.kind !== b.kind) return BOQ_ORDER.indexOf(a.kind) - BOQ_ORDER.indexOf(b.kind);
      if (a.id !== b.id) return a.id < b.id ? -1 : 1;
      for (var i = 0; i < a.vals.length; i++) if (a.vals[i] !== b.vals[i]) return a.vals[i] - b.vals[i];
      return 0;
    });
    return { rows: rows, total: total };
  }
  /* How many of a module are in a list, without trusting the sheet: every
     instance places every one of its members, so the member row that appears
     most often appears exactly once per instance. Counting that way survives a
     member row the parser had to skip. */
  function boqInstances(keyCounts) {
    var n = 0;
    Object.keys(keyCounts).forEach(function (k) { if (keyCounts[k] > n) n = keyCounts[k]; });
    return n || 1;
  }
  function memKeyOf(it) { return it.memberKey || (it.moduleId + '/' + it.plateId); }
  function boqModules(list) {
    var mods = {}, order = [];
    list.forEach(function (it) {
      if (!it.moduleId) return;
      var m = mods[it.moduleId];
      if (!m) { m = mods[it.moduleId] = { id: it.moduleId, items: [], keys: {} };
                order.push(it.moduleId); }
      m.items.push(it);
      var mk = memKeyOf(it);
      m.keys[mk] = (m.keys[mk] || 0) + 1;
    });
    order.sort();
    order.forEach(function (id) {
      var m = mods[id];
      m.count = boqInstances(m.keys);
      m.agg = boqAgg(m.items);
      m.agg.rows.forEach(function (r) { r.per = r.qty / m.count; });
      m.members = m.items.length / m.count;
      m.unitWt = m.agg.total / m.count;
      m.totalWt = m.agg.total;
    });
    return { order: order, mods: mods,
             loose: list.filter(function (it) { return !it.moduleId; }) };
  }
  function boqAssemblies(list) {
    var gs = {}, order = [];
    list.forEach(function (it) {
      var g = it.group || '—';
      if (!gs[g]) { gs[g] = { id: g, mods: {}, modOrder: [], loose: [], wt: 0, n: 0 };
                    order.push(g); }
      var a = gs[g];
      a.wt += it.mass; a.n++;
      if (!it.moduleId) { a.loose.push(it); return; }
      var m = a.mods[it.moduleId];
      if (!m) { m = a.mods[it.moduleId] = { id: it.moduleId, keys: {}, wt: 0, n: 0 };
                a.modOrder.push(it.moduleId); }
      m.wt += it.mass; m.n++;
      var mk = memKeyOf(it);
      m.keys[mk] = (m.keys[mk] || 0) + 1;
    });
    order.forEach(function (g) {
      var a = gs[g];
      a.modOrder.sort();
      a.modOrder.forEach(function (mid) {
        var m = a.mods[mid];
        m.count = boqInstances(m.keys);
        m.unitWt = m.wt / m.count;
        m.members = m.n / m.count;
      });
      a.looseWt = a.loose.reduce(function (s, it) { return s + it.mass; }, 0);
    });
    return { order: order, gs: gs };
  }

  /* ---- workbook writing ---- */
  var BQ_INK = 'FF0F172A', BQ_DIM = 'FF64748B', BQ_HAIR = 'FFCBD5E1',
      BQ_RULE = 'FFE2E8F0', BQ_KEY = 'FF1D4ED8';
  var BQ_FONT = 'Arial';                  // see bqFont, at the end of buildBOQ
  var BQ_WT = '#,##0.000', BQ_DIM_FMT = '#,##0.###', BQ_QTY = '#,##0.###',
      BQ_AREA = '#,##0.0000';
  /* A take-off is read down a column, so the book is set like a table and not
     like a spreadsheet: no grid behind it, one hairline under each line, and
     enough room between lines to follow one across. The column headings carry a
     rule rather than a filled band - a dark band draws the eye to the labels,
     which are the part of the page nobody needs to read twice. */
  function bqStyle(row, opt) {
    row.height = opt.h || 19;
    row.eachCell({ includeEmpty: true }, function (c) {
      if (opt.fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opt.fill } };
      c.font = { bold: !!opt.bold, size: opt.size || 10,
                 color: { argb: opt.color || BQ_INK }, italic: !!opt.italic };
      c.alignment = { vertical: 'middle',
                      horizontal: (c.alignment || {}).horizontal || undefined };
      var b = null;
      if (opt.top) (b = b || {}).top = { style: opt.top, color: { argb: BQ_HAIR } };
      if (opt.bottom) (b = b || {}).bottom =
        { style: opt.bottom, color: { argb: opt.rule || BQ_RULE } };
      if (b) c.border = b;
    });
    return row;
  }
  // Frozen heading rows, and the grid turned off - it is the single thing that
  // separates a page you read from a page you edit.
  function bqView(ws, split) {
    ws.views = [{ state: 'frozen', ySplit: split, showGridLines: false }];
  }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  function colL(i) {                             // 1 -> A, 27 -> AA
    var s = '';
    while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = (i - m - 1) / 26; }
    return s;
  }
  /* Every weight in the book is a formula, not a number: the cached result is
     written alongside so a reader that does not recalculate still shows a figure,
     but open it in Excel and the chain is live all the way down -
        UNIT kg   = area x thickness x density   (or kg/m x length for a section)
        WEIGHT kg = UNIT kg x QTY
        subtotal  = SUM of the lines above it
        module    = SUM of its block subtotals, x how many units
        assembly  = SUM of its module lines
        grand     = SUM of the assemblies
     Change a thickness in the sheet and everything above it moves, which is what
     a take-off is for. Nothing is a dead value except the dimensions themselves
     and the counts the model measured. */
  function fx(formula, result) { return { formula: formula, result: result }; }
  function fxSum(cells, result) {
    return cells.length ? fx(cells.join('+'), result) : result;
  }
  /* A block is a title, its own header naming the input fields it was written
     with, its lines, and a subtotal. Columns are described rather than counted,
     so a shape with five fields and a shape with eight both format correctly
     without anyone tracking offsets.
     On the MODULES sheet the per-unit and the model-wide figures both appear:
     QTY / UNIT and kg / UNIT add up to what one module weighs, TOTAL QTY and
     TOTAL kg to what all of them weigh. One column without the other is the
     take-off mistake this sheet exists to prevent. */
  function bqBlock(ws, kind, rows, mode) {
    var def = BOQ_KIND[kind];
    function ref(ix, name, rn) { return colL(ix[name]) + rn; }
    var cols = [{ h: 'ID', k: function (r) { return r.id; } },
                { h: 'MAT', k: function (r) { return r.mat; } }];
    def.f.forEach(function (p, i) {
      cols.push({ h: p[0], f: BQ_DIM_FMT, k: function (r) { return r.vals[i]; } });
    });
    if (def.area) {                                // a plate: face area, thickness
      cols.push({ h: 'AREA m²', f: BQ_AREA, k: function (r) { return r.area; } });
      cols.push({ h: 'CUTS', f: '#,##0', k: function (r) { return r.cuts; } });
      cols.push({ h: 'UNIT kg', f: BQ_WT, k: function (r) { return r.unit; },
                 fm: function (rn, ix) {
                   return ref(ix, 'AREA m²', rn) + '*' + ref(ix, 'THK', rn) + '*7.85'; } });
    } else {                                       // a bar or a section: profile, kg/m
      cols.push({ h: 'AREA mm²', f: '#,##0.0', k: function (r) { return r.areaMM; } });
      cols.push({ h: 'kg/m', f: '#,##0.000', k: function (r) { return r.kgm; },
                 fm: function (rn, ix) { return ref(ix, 'AREA mm²', rn) + '*0.00785'; } });
      cols.push({ h: 'UNIT kg', f: BQ_WT, k: function (r) { return r.unit; },
                 fm: function (rn, ix) {
                   return ref(ix, 'kg/m', rn) + '*' + ref(ix, 'LENGTH', rn) + '/1000'; } });
    }
    if (mode === 'module') {
      cols.push({ h: 'QTY / UNIT', f: BQ_QTY, sum: 1, k: function (r) { return r.per; } });
      cols.push({ h: 'kg / UNIT', f: BQ_WT, sum: 1, k: function (r) { return r.unit * r.per; },
                 fm: function (rn, ix) {
                   return ref(ix, 'UNIT kg', rn) + '*' + ref(ix, 'QTY / UNIT', rn); } });
      cols.push({ h: 'TOTAL QTY', f: '#,##0', sum: 1, k: function (r) { return r.qty; } });
      cols.push({ h: 'TOTAL kg', f: BQ_WT, sum: 1, k: function (r) { return r.wt; },
                 fm: function (rn, ix) {
                   return ref(ix, 'UNIT kg', rn) + '*' + ref(ix, 'TOTAL QTY', rn); } });
    } else {
      cols.push({ h: 'QTY', f: '#,##0', sum: 1, k: function (r) { return r.qty; } });
      cols.push({ h: 'WEIGHT kg', f: BQ_WT, sum: 1, k: function (r) { return r.wt; },
                 fm: function (rn, ix) {
                   return ref(ix, 'UNIT kg', rn) + '*' + ref(ix, 'QTY', rn); } });
    }
    var ix = {};
    cols.forEach(function (c, i) { ix[c.h] = i + 1; });

    bqStyle(ws.addRow([def.t]), { bold: true, size: 11, color: BQ_KEY, h: 24 });
    bqStyle(ws.addRow(cols.map(function (c) { return c.h; })),
            { bold: true, size: 9, color: BQ_KEY, bottom: 'medium', rule: BQ_KEY, h: 21 });
    var sums = cols.map(function () { return 0; });
    var first = null, last = null;
    rows.forEach(function (r) {
      var row = ws.addRow(cols.map(function (c) { return c.k(r); }));
      if (first === null) first = row.number;
      last = row.number;
      bqStyle(row, { bottom: 'thin' });
      cols.forEach(function (c, i) {
        var cell = row.getCell(i + 1);
        if (c.fm) cell.value = fx(c.fm(row.number, ix), num(c.k(r), 0));
        if (!c.f) return;
        cell.numFmt = c.f;
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (c.sum) sums[i] += num(c.k(r), 0);
      });
    });
    var sub = ws.addRow(cols.map(function (c, i) {
      return i === 0 ? 'subtotal — ' + plural(rows.length, 'item') : null;
    }));
    bqStyle(sub, { bold: true, top: 'thin' });
    var at = {};
    cols.forEach(function (c, i) {
      if (!c.sum) return;
      var L = colL(i + 1);
      sub.getCell(i + 1).value = fx('SUM(' + L + first + ':' + L + last + ')', sums[i]);
      sub.getCell(i + 1).numFmt = c.f;
      sub.getCell(i + 1).alignment = { horizontal: 'right', vertical: 'middle' };
      at[c.h] = L + sub.number;
    });
    ws.addRow([]);
    return { kind: kind, n: rows.length, sums: sums, at: at };
  }
  // Each block reports where its subtotals landed, so the sheet total can add
  // those cells up instead of restating a number nobody can trace.
  function bqBlocks(ws, agg, mode) {
    var out = [];
    BOQ_ORDER.forEach(function (k) {
      var rows = agg.rows.filter(function (r) { return r.kind === k; });
      if (rows.length) out.push(bqBlock(ws, k, rows, mode));
    });
    if (!out.length) bqStyle(ws.addRow(['no members']), { italic: true, color: BQ_DIM });
    return out;
  }
  function bqPick(blocks, name) {                  // subtotal cells for one column
    return blocks.map(function (b) { return b.at[name]; })
                 .filter(function (a) { return !!a; });
  }
  function bqWidths(ws, list) {
    list.forEach(function (w, i) { ws.getColumn(i + 1).width = w; });
  }
  // Blocks are different widths, so a total that tried to line up under one of
  // them would sit under blank cells on the others. Label each figure instead,
  // and add the block subtotals by cell so the arithmetic stays visible.
  function bqTotal(ws, label, qtyCells, n, wtCells, wt) {
    var row = ws.addRow([label, 'members', null, 'weight kg', null]);
    row.getCell(3).value = fxSum(qtyCells, n);
    row.getCell(5).value = fxSum(wtCells, wt);
    bqStyle(row, { bold: true, size: 11, top: 'medium' });
    row.getCell(3).numFmt = '#,##0';
    row.getCell(5).numFmt = BQ_WT;
    row.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
  }

  function buildBOQ(list, fname) {
    var wb = new ExcelJS.Workbook();
    wb.creator = 'PLATE3D';
    wb.calcProperties = { fullCalcOnLoad: true };   // recalculate the chain on open
    var agg = boqAgg(list), mods = boqModules(list), asm = boqAssemblies(list);
    var hidden = items.length - list.length;
    var stamp = new Date();
    var when = stamp.getFullYear() + '-' + ('0' + (stamp.getMonth() + 1)).slice(-2) + '-' +
               ('0' + stamp.getDate()).slice(-2) + ' ' +
               ('0' + stamp.getHours()).slice(-2) + ':' + ('0' + stamp.getMinutes()).slice(-2);
    // SUMMARY is added first so it opens first, but its figures point at cells on
    // the other three sheets, so its tables are appended once those exist.
    var s1 = wb.addWorksheet('SUMMARY');
    bqWidths(s1, [26, 16, 14, 16, 16]);
    bqStyle(s1.addRow(['PLATE3D — BILL OF QUANTITIES']), { bold: true, size: 14 });
    bqStyle(s1.addRow(['source', fname]), { color: BQ_DIM });
    bqStyle(s1.addRow(['generated', when]), { color: BQ_DIM });
    bqStyle(s1.addRow(['units', 'mm · kg — steel at 7.85 t/m³']), { color: BQ_DIM });
    if (hidden) bqStyle(s1.addRow(['scope', 'visible members only — ' +
                       plural(hidden, 'hidden member') + ' excluded']), { color: 'FFB45309' });
    else bqStyle(s1.addRow(['scope', 'every placed member']), { color: BQ_DIM });
    bqStyle(s1.addRow(['weights', 'live formulas — area × thickness × density, up through ' +
                       'every subtotal. Edit a dimension and the book follows.']),
            { color: BQ_DIM });
    s1.addRow([]);

    /* ---- PART LIST ---- */
    var s2 = wb.addWorksheet('PART LIST');
    bqWidths(s2, [17, 10, 9, 9, 9, 9, 9, 9, 9, 11, 9, 11, 9, 13]);
    bqStyle(s2.addRow(['PART LIST — every distinct part in the model']),
            { bold: true, size: 12 });
    bqStyle(s2.addRow(['Grouped by the input fields it was written with, so one section ' +
                       'definition cut to several lengths gives one line per length. ' +
                       'UNIT kg is a formula on the dimensions to its left.']),
            { italic: true, color: BQ_DIM });
    s2.addRow([]);
    var pb = bqBlocks(s2, agg, 'part');
    bqTotal(s2, 'PART TOTAL', bqPick(pb, 'QTY'), list.length,
            bqPick(pb, 'WEIGHT kg'), agg.total);
    bqView(s2, 3);

    /* ---- MODULES ---- */
    var s3 = wb.addWorksheet('MODULES');
    bqWidths(s3, [17, 13, 9, 13, 9, 10, 11, 10, 11, 9, 11, 11, 11, 11, 11]);
    bqStyle(s3.addRow(['MODULES — one block per module type']), { bold: true, size: 12 });
    bqStyle(s3.addRow(['QTY / UNIT is how many of that part go into one module; kg / UNIT and ' +
                       'TOTAL kg are formulas on it. The banner adds its blocks up and ' +
                       'multiplies by how many units the model holds.']),
            { italic: true, color: BQ_DIM });
    s3.addRow([]);
    var modTotCells = [];
    mods.order.forEach(function (id) {
      var m = mods.mods[id];
      var h = s3.addRow(['MODULE  ' + id, 'members / unit', m.members, 'units in model',
                         m.count, 'kg / unit', null, 'TOTAL kg', null]);
      bqStyle(h, { bold: true, size: 11, fill: 'FFEFF6FF' });
      [3, 5].forEach(function (c) { h.getCell(c).numFmt = BQ_QTY; });
      [7, 9].forEach(function (c) { h.getCell(c).numFmt = BQ_WT; });
      var blocks = bqBlocks(s3, m.agg, 'module');
      h.getCell(7).value = fxSum(bqPick(blocks, 'kg / UNIT'), m.unitWt);
      h.getCell(9).value = fx('G' + h.number + '*E' + h.number, m.totalWt);
      modTotCells.push('I' + h.number);
    });
    if (mods.loose.length) {
      bqStyle(s3.addRow(['NOT IN A MODULE', plural(mods.loose.length, 'member') +
                         ' placed straight by an ASSY row']),
              { bold: true, size: 11, fill: 'FFFEF3C7' });
      var lb = bqBlocks(s3, boqAgg(mods.loose), 'part');
      modTotCells = modTotCells.concat(bqPick(lb, 'WEIGHT kg'));
    }
    bqTotal(s3, 'MODULE TOTAL', [], list.length, modTotCells, agg.total);
    bqView(s3, 3);

    /* ---- ASSEMBLY ---- */
    var s4 = wb.addWorksheet('ASSEMBLY');
    bqWidths(s4, [24, 16, 10, 11, 14, 15]);
    bqStyle(s4.addRow(['ASSEMBLY — modules only, no part detail']), { bold: true, size: 12 });
    bqStyle(s4.addRow(['Part detail lives on MODULES. Here a module is one line: how many of ' +
                       'it this assembly holds, what one weighs, what they come to.']),
            { italic: true, color: BQ_DIM });
    s4.addRow([]);
    var grand = 0, subCells = [], nCells = [];
    asm.order.forEach(function (g) {
      var a = asm.gs[g];
      var h = s4.addRow(['ASSEMBLY  ' + g, plural(a.n, 'member'), null, null, null, null]);
      bqStyle(h, { bold: true, size: 11, fill: 'FFEFF6FF' });
      h.getCell(6).numFmt = BQ_WT;
      bqStyle(s4.addRow(['MODULE', 'MEMBERS / UNIT', 'QTY', 'MEMBERS', 'UNIT kg', 'WEIGHT kg']),
              { bold: true, size: 9, color: BQ_KEY, bottom: 'medium', rule: BQ_KEY, h: 21 });
      var first = null, last = null;
      a.modOrder.forEach(function (mid) {
        var m = a.mods[mid];
        var row = s4.addRow([mid, m.members, m.count, null, m.unitWt, null]);
        var rn = row.number;
        if (first === null) first = rn;
        last = rn;
        row.getCell(4).value = fx('B' + rn + '*C' + rn, m.n);
        row.getCell(6).value = fx('E' + rn + '*C' + rn, m.wt);
        bqStyle(row, { bottom: 'thin' });
        row.getCell(2).numFmt = BQ_QTY; row.getCell(3).numFmt = '#,##0';
        row.getCell(4).numFmt = '#,##0';
        row.getCell(5).numFmt = BQ_WT; row.getCell(6).numFmt = BQ_WT;
        for (var c = 2; c <= 6; c++) row.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
      });
      if (a.loose.length) {
        var lr = s4.addRow(['(parts placed directly)', null, a.loose.length, a.loose.length,
                            null, a.looseWt]);
        if (first === null) first = lr.number;
        last = lr.number;
        bqStyle(lr, { italic: true });
        lr.getCell(3).numFmt = '#,##0'; lr.getCell(4).numFmt = '#,##0';
        lr.getCell(6).numFmt = BQ_WT;
      }
      var sub = s4.addRow(['subtotal  ' + g, null, null, null, null, null]);
      if (first !== null) {
        sub.getCell(4).value = fx('SUM(D' + first + ':D' + last + ')', a.n);
        sub.getCell(6).value = fx('SUM(F' + first + ':F' + last + ')', a.wt);
      }
      bqStyle(sub, { bold: true, top: 'thin' });
      sub.getCell(4).numFmt = '#,##0'; sub.getCell(6).numFmt = BQ_WT;
      sub.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
      sub.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
      h.getCell(6).value = fx('F' + sub.number, a.wt);
      subCells.push('F' + sub.number);
      nCells.push('D' + sub.number);
      s4.addRow([]);
      grand += a.wt;
    });
    var gr = s4.addRow(['GRAND TOTAL — all assemblies', null, asm.order.length, null, null, null]);
    gr.getCell(4).value = fxSum(nCells, list.length);
    gr.getCell(6).value = fxSum(subCells, grand);
    bqStyle(gr, { bold: true, size: 12, top: 'medium' });
    gr.getCell(3).numFmt = '#,##0'; gr.getCell(4).numFmt = '#,##0';
    gr.getCell(6).numFmt = BQ_WT;
    for (var c2 = 3; c2 <= 6; c2++) gr.getCell(c2).alignment = { horizontal: 'right', vertical: 'middle' };
    bqView(s4, 3);

    /* ---- back to SUMMARY, now that there is something to point at ---- */
    bqStyle(s1.addRow(['BY CATEGORY', 'ITEMS', 'QTY', 'WEIGHT kg', 'SHARE']),
            { bold: true, size: 9, color: BQ_KEY, bottom: 'medium', rule: BQ_KEY, h: 21 });
    var catRows = [];
    ['PLATE', 'BAR', 'SECT'].forEach(function (cat) {
      var blocks = pb.filter(function (b) { return BOQ_CAT[b.kind] === cat; });
      if (!blocks.length) return;
      var q = 0, w = 0, nItem = 0;
      blocks.forEach(function (b) {
        nItem += b.n;
        agg.rows.forEach(function (r) { if (r.kind === b.kind) { q += r.qty; w += r.wt; } });
      });
      var pre = function (a) { return "'PART LIST'!" + a; };
      var row = s1.addRow([cat, nItem, null, null, null]);
      row.getCell(3).value = fxSum(bqPick(blocks, 'QTY').map(pre), q);
      row.getCell(4).value = fxSum(bqPick(blocks, 'WEIGHT kg').map(pre), w);
      bqStyle(row, { bottom: 'thin' });
      catRows.push({ n: row.number, w: w });
      row.getCell(2).numFmt = '#,##0'; row.getCell(3).numFmt = '#,##0';
      row.getCell(4).numFmt = BQ_WT; row.getCell(5).numFmt = '0.0%';
      for (var c = 2; c <= 5; c++) row.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
    });
    var tot = s1.addRow(['TOTAL', agg.rows.length, null, null, null]);
    if (catRows.length) {
      var lo = catRows[0].n, hi = catRows[catRows.length - 1].n;
      tot.getCell(3).value = fx('SUM(C' + lo + ':C' + hi + ')', list.length);
      tot.getCell(4).value = fx('SUM(D' + lo + ':D' + hi + ')', agg.total);
    }
    tot.getCell(5).value = fx('D' + tot.number + '/D' + tot.number, 1);
    catRows.forEach(function (cr) {
      s1.getRow(cr.n).getCell(5).value = fx('D' + cr.n + '/D' + tot.number,
        agg.total ? cr.w / agg.total : 0);
    });
    bqStyle(tot, { bold: true, top: 'thin' });
    tot.getCell(2).numFmt = '#,##0'; tot.getCell(3).numFmt = '#,##0';
    tot.getCell(4).numFmt = BQ_WT; tot.getCell(5).numFmt = '0.0%';
    for (var c1 = 2; c1 <= 5; c1++) tot.getCell(c1).alignment = { horizontal: 'right', vertical: 'middle' };
    s1.addRow([]);

    bqStyle(s1.addRow(['MODEL', 'COUNT']), { bold: true, size: 9, color: BQ_KEY, bottom: 'medium', rule: BQ_KEY, h: 21 });
    [['assemblies', asm.order.length], ['module types', mods.order.length],
     ['distinct parts', agg.rows.length], ['placed members', list.length]
    ].forEach(function (p) {
      var row = s1.addRow(p);
      bqStyle(row, { bottom: 'thin' });
      row.getCell(2).numFmt = '#,##0';
      row.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
    });
    bqView(s1, 1);
    bqFont(wb);
    return wb;
  }
  /* Name the face on every cell, last thing before the book is handed over.

     A cell that names no font gets the theme font, and the theme font is not
     the same everywhere: Microsoft 365 draws it in Aptos, an older Excel in
     Calibri. The same take-off then looks different on the fabricator's desk
     than it did on the desk it was written at, which for a document that gets
     emailed out is not a small thing.

     Arial, and not the face the app itself is set in: Inter gives its digits
     different widths - a 1 is a third narrower than a 0 - and Excel has no way
     to ask for tabular figures. At 11pt that walks the decimal point 7.65 px
     up and down a column of weights. Arial holds it to 1 px, and there is no
     machine it has to be installed on. */
  function bqFont(wb) {
    wb.eachSheet(function (ws) {
      ws.eachRow({ includeEmpty: true }, function (row) {
        row.eachCell({ includeEmpty: true }, function (c) {
          c.font = Object.assign({ size: 10, color: { argb: BQ_INK } },
                                 c.font || {}, { name: BQ_FONT });
        });
      });
    });
  }

  function exportBOQ() {
    if (typeof ExcelJS === 'undefined') {
      alert('ExcelJS is missing, and the BOQ is written as a workbook.\n\n' +
            'Add this line before plate_builder.js:\n' +
            '<script src="https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/' +
            'exceljs.min.js"><\/script>');
      return;
    }
    var list = visibleItems();
    if (nothing(list)) return;
    var base = String(lastFile || 'PLATE3D').replace(/\.[^.]*$/, '').replace(/[^\w.\-]+/g, '_');
    try {
      buildBOQ(list, lastFile || 'PLATE3D').xlsx.writeBuffer().then(function (buf) {
        downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-' +
                     'officedocument.spreadsheetml.sheet' }), base + '_BOQ.xlsx');
      }).catch(function (e) {
        alert('Could not write the BOQ workbook.\n\n' + e.message);
      });
    } catch (e) {
      alert('Could not build the BOQ.\n\n' + e.message);
    }
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
  // Both 3D views (main window and module preview) keep a perspective and an
  // orthographic camera and swap between them. An ortho camera has no aspect of
  // its own, so its frustum is rebuilt from the height it should cover
  // (userData.viewH) and the pane's aspect. Zoom is left alone - OrbitControls
  // dollies an ortho camera by changing camera.zoom, not by moving it.
  function fovHeight(d) { return 2 * d * Math.tan(MAIN_FOV * Math.PI / 360); }
  // Unit offset from the model to the camera, per view button. Z-up: front
  // looks north, top looks down (with a hair of Y so the up vector still works).
  var VIEWDIR = { front: [0, -1, 0], side: [1, 0, 0], top: [0, -0.0001, 1],
                  iso: [0.58, -0.65, 0.5] };
  /* Where a view should aim and how far back it should stand.
     Two things were wrong with one and a half box diagonals. It is generous on
     a compact part and far too generous on a long thin one. And the box itself
     lies: the corner that drives the fit is usually empty air. A tower crane's
     box has a corner 47 m up at the far end of the jib, where there is nothing
     but sky, and the view backs off far enough to keep that nothing in frame.
     So fit the members, not the box - the eight corners of each member's own
     extent - and aim at the middle of what actually lands on screen rather than
     the middle of the box. Two passes over a few thousand points, once per view
     change, which costs nothing and is the difference between a model that
     fills the frame and one adrift in the middle of it. */
  function fitView(pts, dir, up, fov, aspect, fallback) {
    var ez = dir.clone().normalize();                    // camera -> model
    var ex = new THREE.Vector3().crossVectors(ez, up);
    if (ex.lengthSq() < 1e-9) ex.set(1, 0, 0);
    ex.normalize();
    var ey = new THREE.Vector3().crossVectors(ex, ez).normalize();
    if (!pts || !pts.length) return { target: fallback.clone(), dist: VDIST };
    var xlo = 1e30, xhi = -1e30, ylo = 1e30, yhi = -1e30, zlo = 1e30, zhi = -1e30;
    var i, p, x, y, z;
    for (i = 0; i < pts.length; i++) {
      p = pts[i]; x = p.dot(ex); y = p.dot(ey); z = p.dot(ez);
      if (x < xlo) xlo = x; if (x > xhi) xhi = x;
      if (y < ylo) ylo = y; if (y > yhi) yhi = y;
      if (z < zlo) zlo = z; if (z > zhi) zhi = z;
    }
    var cx = (xlo + xhi) / 2, cy = (ylo + yhi) / 2, cz = (zlo + zhi) / 2;
    var target = new THREE.Vector3().addScaledVector(ex, cx)
                                    .addScaledVector(ey, cy).addScaledVector(ez, cz);
    var tv = Math.tan((fov || MAIN_FOV) * Math.PI / 360), th = tv * (aspect || 1), d = 0;
    for (i = 0; i < pts.length; i++) {
      p = pts[i]; z = p.dot(ez) - cz;
      d = Math.max(d, Math.abs(p.dot(ex) - cx) / th - z, Math.abs(p.dot(ey) - cy) / tv - z);
    }
    d = d + 1;
    /* That distance is safe but not tight, and the aim is off, because a point
       far from the camera projects nearer the middle than its distance from the
       axis says. So settle it in the picture instead of in space: project, shift
       the aim to the middle of what came out, scale the distance by how much of
       the frame is filled, repeat. Four passes is well past converged. */
    var cam = new THREE.Vector3(), q = new THREE.Vector3(), k, w, nx, ny;
    for (k = 0; k < 4; k++) {
      cam.copy(target).addScaledVector(ez, -d);
      var nx0 = 1e30, nx1 = -1e30, ny0 = 1e30, ny1 = -1e30, ok = true;
      for (i = 0; i < pts.length; i++) {
        q.copy(pts[i]).sub(cam);
        w = q.dot(ez);
        if (!(w > 1e-6)) { ok = false; break; }       // behind the eye - back off
        nx = q.dot(ex) / (th * w); ny = q.dot(ey) / (tv * w);
        if (nx < nx0) nx0 = nx; if (nx > nx1) nx1 = nx;
        if (ny < ny0) ny0 = ny; if (ny > ny1) ny1 = ny;
      }
      if (!ok) { d *= 1.6; continue; }
      target.addScaledVector(ex, (nx0 + nx1) / 2 * th * d)
            .addScaledVector(ey, (ny0 + ny1) / 2 * tv * d);
      d *= Math.max((nx1 - nx0) / 2, (ny1 - ny0) / 2) * 1.05;
      if (!(d > 0) || !isFinite(d)) return { target: fallback.clone(), dist: VDIST };
    }
    return { target: target, dist: d };
  }
  function viewOffset(v) {
    var o = VIEWDIR[v] || VIEWDIR.iso;
    return new THREE.Vector3(o[0], o[1], o[2]).normalize();
  }
  function fitCam(cam, aspect) {
    if (!cam) return;
    if (cam.isOrthographicCamera) {
      var half = (cam.userData.viewH || 1000) / 2;
      cam.left = -half * aspect; cam.right = half * aspect;
      cam.top = half; cam.bottom = -half;
    } else cam.aspect = aspect;
    cam.updateProjectionMatrix();
  }
  function applyMainCam() { fitCam(camera, mainAspect); }

  // Look at target from the direction of pos, framing what a perspective camera
  // would cover from there. An ortho camera is also set back to at least backOff:
  // distance does not change a parallel image, but it keeps the model clear of
  // the near plane however far the user zooms in.
  function frameCam(cam, target, pos, backOff) {
    var dir = pos.clone().sub(target);
    var d = dir.length() || backOff;
    dir.divideScalar(d);
    if (cam.isOrthographicCamera) {
      cam.zoom = 1;
      cam.userData.viewH = fovHeight(d);
      cam.position.copy(target).addScaledVector(dir, Math.max(d, backOff));
    } else cam.position.copy(target).addScaledVector(dir, d);
  }
  // Hand the image from one projection to the other without moving it. Going
  // back to perspective, the ortho zoom is what sets the camera distance.
  function swapProjection(from, to, target, backOff) {
    if (to.isOrthographicCamera) { frameCam(to, target, from.position, backOff); return; }
    var dir = from.position.clone().sub(target);
    var d = dir.length() || backOff;
    var vh = (from.userData.viewH || fovHeight(backOff)) / (from.zoom || 1);
    to.position.copy(target).addScaledVector(dir.divideScalar(d), vh / fovHeight(1));
  }
  function rebindOrbit(cam, dom, target) {         // OrbitControls binds one camera
    var c = new THREE.OrbitControls(cam, dom);
    c.enableDamping = true;
    c.dampingFactor = 0.1;
    c.target.copy(target);
    c.update();
    return c;
  }

  var VIEWS = ['iso', 'front', 'side', 'top'];
  function setView(v) {
    var btns = document.querySelectorAll('#pb-bar button.vw');
    for (var i = 0; i < btns.length; i++) {      // mark the one being looked through
      btns[i].className = 'vw' + (VIEWS[i] === v ? ' active' : '');
    }
    // each view gets its own distance - the same model is not the same size
    // seen down its length as it is across it
    var off = viewOffset(v);
    var f = fitView(sceneCloud, off.clone().negate(), camera.up, MAIN_FOV, mainAspect, CENTER);
    camera.position.copy(f.target).addScaledVector(off, f.dist);
    controls.target.copy(f.target);
    frameCam(camera, f.target, camera.position.clone(), f.dist);
    applyMainCam();
    controls.update();
  }

  function setOrtho(on) {
    orthoView = !!on;
    var cb = document.getElementById('pb-ortho');
    if (cb) cb.checked = orthoView;
    if (!camPersp || !camOrtho || !controls) return;
    var to = orthoView ? camOrtho : camPersp;
    if (camera === to) return;
    swapProjection(camera, to, controls.target, VDIST);
    camera = to;
    applyMainCam();
    var tgt = controls.target.clone();
    controls.dispose();
    controls = rebindOrbit(camera, renderer.domElement, tgt);
    if (measMain) measMain.setCamera(camera);
  }

  function setOrthoPv(on) {
    orthoPv = !!on;
    var cb = document.getElementById('pb-pv-ortho');
    if (cb) cb.checked = orthoPv;
    if (!pvModuleId || !pvCamP || !pvCamO || !pvCtrl || !pvRenderer) return;
    var to = orthoPv ? pvCamO : pvCamP;
    if (pvCam === to) return;
    swapProjection(pvCam, to, pvCtrl.target, pvBackDist);
    pvCam = to;
    fitCam(pvCam, pvAspect);
    var tgt = pvCtrl.target.clone();
    pvCtrl.dispose();
    pvCtrl = rebindOrbit(pvCam, pvRenderer.domElement, tgt);
    if (measPv) measPv.setCamera(pvCam);
  }

  /* ---------------- DOM + init ---------------- */
  /* Diagrams for the guide. Plain inline SVG - no library, no fetch, and they
     scale with the panel. Ink and rule colours match the page. */
  var GUIDE_SVG_9PT =
    '<figure><svg class="gsvg" viewBox="0 0 520 200" role="img">' +
    '<g fill="none" stroke="#334155" stroke-width="1.6">' +
    '<path d="M150 30 L370 30 L410 150 L110 150 Z"/></g>' +
    '<g fill="#2563eb">' +
    '<circle cx="150" cy="30" r="4"/><circle cx="260" cy="30" r="4"/><circle cx="370" cy="30" r="4"/>' +
    '<circle cx="130" cy="90" r="4"/><circle cx="260" cy="94" r="4"/><circle cx="390" cy="90" r="4"/>' +
    '<circle cx="110" cy="150" r="4"/><circle cx="260" cy="150" r="4"/><circle cx="410" cy="150" r="4"/>' +
    '</g>' +
    '<g font-size="12" font-weight="600" fill="#1d4ed8" text-anchor="middle">' +
    '<text x="150" y="20">tl</text><text x="260" y="20">tc</text><text x="370" y="20">tr</text>' +
    '<text x="112" y="86">ml</text><text x="260" y="86">mc</text><text x="408" y="86">mr</text>' +
    '<text x="110" y="170">bl</text><text x="260" y="170">bc</text><text x="410" y="170">br</text>' +
    '</g>' +
    '<g font-size="11" fill="#94a3b8">' +
    '<text x="262" y="46" text-anchor="middle">et</text>' +
    '<text x="262" y="142" text-anchor="middle">eb</text>' +
    '<text x="128" y="112">el</text><text x="378" y="112">er</text>' +
    '<text x="20" y="96">edges</text><text x="20" y="112">carry an</text><text x="20" y="128">e prefix</text>' +
    '</g></svg>' +
    '<figcaption>Nine points on a trapezoid. On a rectangle they sit where you expect;' +
    ' <code>ml</code> and <code>mr</code> always follow the real sloping side.</figcaption></figure>';

  var GUIDE_SVG_TRAP =
    '<figure><svg class="gsvg" viewBox="0 0 520 200" role="img">' +
    '<g fill="none" stroke="#334155" stroke-width="1.6">' +
    '<path d="M170 40 L390 40 L430 140 L90 140 Z"/></g>' +
    '<g stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 3">' +
    '<path d="M90 140 L90 175 M430 140 L430 175 M170 40 L170 20 M390 40 L390 20"/>' +
    '<path d="M90 40 L90 20 M60 40 L60 140"/></g>' +
    '<g stroke="#2563eb" stroke-width="1.2" marker-start="url(#ga)" marker-end="url(#ga)">' +
    '<path d="M92 168 L428 168"/><path d="M172 28 L388 28"/>' +
    '<path d="M92 28 L168 28"/><path d="M62 42 L62 138"/></g>' +
    '<defs><marker id="ga" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="6" markerHeight="6"' +
    ' orient="auto"><path d="M0 4 L8 1.6 L8 6.4 Z" fill="#2563eb"/></marker></defs>' +
    '<g font-size="12" font-weight="600" fill="#1d4ed8">' +
    '<text x="252" y="184" text-anchor="middle">WB</text>' +
    '<text x="276" y="20" text-anchor="middle">WT</text>' +
    '<text x="118" y="20" text-anchor="middle">OFF_T</text>' +
    '<text x="44" y="94" text-anchor="middle">H</text></g>' +
    '</svg>' +
    '<figcaption>One shape covers all three: <code>WT = WB</code> is a rectangle,' +
    ' <code>WT = 0</code> a triangle, <code>OFF_T</code> shifts the top edge sideways.' +
    ' Thickness <code>THK</code> is added either side of the plane you see here.</figcaption></figure>';

  var GUIDE_SVG_FACE =
    '<figure><svg class="gsvg" viewBox="0 0 520 150" role="img">' +
    '<g stroke="#cbd5e1" stroke-width="1" stroke-dasharray="4 3">' +
    '<path d="M60 20 L60 130 M250 20 L250 130 M440 20 L440 130"/></g>' +
    '<g fill="#dbeafe" stroke="#2563eb" stroke-width="1.4">' +
    '<rect x="44" y="46" width="32" height="58"/>' +
    '<rect x="218" y="46" width="32" height="58"/>' +
    '<rect x="440" y="46" width="32" height="58"/></g>' +
    '<g font-size="12" font-weight="600" fill="#1d4ed8" text-anchor="middle">' +
    '<text x="60" y="126">bc</text><text x="250" y="126">bc+</text><text x="440" y="126">bc-</text></g>' +
    '<g font-size="11" fill="#64748b" text-anchor="middle">' +
    '<text x="60" y="36">straddles</text><text x="250" y="36">+ face lands here</text>' +
    '<text x="440" y="36">&#8722; face lands here</text></g>' +
    '</svg>' +
    '<figcaption>Seen edge on, local +Z to the right. The dashed line is the coordinate you' +
    ' typed; adding <code>+</code> or <code>&#8722;</code> puts a face on it instead of the' +
    ' mid-plane, so you can enter the dimension the drawing gives.</figcaption></figure>';

  var GUIDE_SVG_SECT =
    '<figure><svg class="gsvg" viewBox="0 0 520 180" role="img">' +
    // H
    '<g fill="#dbeafe" stroke="#2563eb" stroke-width="1.4">' +
    '<path d="M40 30 H140 V44 H98 V116 H140 V130 H40 V116 H82 V44 H40 Z"/></g>' +
    '<g font-size="10" fill="#64748b">' +
    '<text x="86" y="26" text-anchor="middle">bt</text>' +
    '<text x="86" y="146" text-anchor="middle">bb</text>' +
    '<text x="146" y="40">tf2</text><text x="146" y="128">tf1</text>' +
    '<text x="60" y="84">tw</text><text x="103" y="60">r1</text></g>' +
    '<text x="90" y="168" font-size="12" font-weight="700" fill="#0f172a" text-anchor="middle">H</text>' +
    // C
    '<g fill="#dbeafe" stroke="#2563eb" stroke-width="1.4">' +
    '<path d="M215 30 H300 V44 H229 V116 H300 V130 H215 Z"/></g>' +
    '<g font-size="10" fill="#64748b">' +
    '<text x="258" y="26" text-anchor="middle">b</text>' +
    '<text x="306" y="40">tf</text><text x="222" y="84">tw</text>' +
    '<text x="234" y="60">rw</text><text x="288" y="56">rf</text></g>' +
    '<text x="258" y="168" font-size="12" font-weight="700" fill="#0f172a" text-anchor="middle">C</text>' +
    // L
    '<g fill="#dbeafe" stroke="#2563eb" stroke-width="1.4">' +
    '<path d="M390 30 V130 H480 V116 H404 V30 Z"/></g>' +
    '<g font-size="10" fill="#64748b">' +
    '<text x="436" y="146" text-anchor="middle">a</text>' +
    '<text x="378" y="84">b</text><text x="490" y="128">t1</text>' +
    '<text x="396" y="24" text-anchor="middle">t2</text>' +
    '<text x="412" y="110">r1</text><text x="466" y="110">r2</text>' +
    '<text x="418" y="42">r2</text></g>' +
    '<g stroke="#94a3b8" stroke-width="0.8" fill="none">' +
    '<path d="M420 106 L406 114"/><path d="M470 106 L478 114"/>' +
    '<path d="M416 38 L406 32"/></g>' +
    '<text x="436" y="168" font-size="12" font-weight="700" fill="#0f172a" text-anchor="middle">L</text>' +
    '</svg>' +
    '<figcaption>Height is <code>h</code> on H and C; on L the legs are <code>a</code>' +
    ' (along x) and <code>b</code> (along y), each with its own thickness.' +
    ' <b>r1</b> is always the fillet in the corner, <b>r2</b> the rounding at the' +
    ' free ends.</figcaption></figure>';

  // Every example here is spreadsheet rows, so it is drawn as a spreadsheet -
  // column letters, row numbers, cell borders. A black code block made the
  // input look like a text file being piped somewhere, which is the wrong idea.
  // kw = the column holding the keyword, so an example can show a block that
  // does not start at A
  function sheet(rows, note, kw) {
    var cols = 0, i, k = kw || 0;
    rows.forEach(function (r) { if (r.length > cols) cols = r.length; });
    var h = '<div class="xlswrap"><table class="xls"><thead><tr><th class="rn"></th>';
    for (i = 0; i < cols; i++) h += '<th>' + String.fromCharCode(65 + i) + '</th>';
    h += '</tr></thead><tbody>';
    rows.forEach(function (r, n) {
      var cmt = String(r[k] === undefined ? '' : r[k]).charAt(0) === '#';
      h += '<tr' + (cmt ? ' class="cmt"' : '') + '><td class="rn">' + (n + 1) + '</td>';
      for (i = 0; i < cols; i++) {
        var v = (r[i] === undefined || r[i] === null) ? '' : String(r[i]);
        var cls = cmt ? '' : (i === k && v !== '' ? ' class="kw"'
                : (/^-?[\d.]+$/.test(v) ? ' class="n"' : ''));
        h += '<td' + cls + '>' + esc(v) + '</td>';
      }
      h += '</tr>';
    });
    h += '</tbody></table></div>';
    return note ? h + '<p class="xlsnote">' + note + '</p>' : h;
  }

  var GUIDE_SVG_TIERS =
    '<figure><svg class="gsvg" viewBox="0 0 520 250" role="img">' +
    '<g font-size="11" font-weight="700" fill="#1d4ed8">' +
    '<text x="14" y="40">PART</text><text x="14" y="120">MODULE</text>' +
    '<text x="14" y="208">ASSEMBLY</text></g>' +
    '<g stroke="#e2e8f0" stroke-width="1"><path d="M14 62 H506 M14 150 H506"/></g>' +
    // --- part tier
    '<g fill="#dbeafe" stroke="#2563eb" stroke-width="1.2">' +
    '<rect x="96" y="18" width="66" height="28" rx="5"/>' +
    '<rect x="188" y="18" width="66" height="28" rx="5" fill="#fff" stroke-dasharray="4 3"/>' +
    '<rect x="308" y="18" width="66" height="28" rx="5"/>' +
    '<rect x="392" y="18" width="66" height="28" rx="5"/></g>' +
    '<g font-size="11" font-weight="600" fill="#1d4ed8" text-anchor="middle">' +
    '<text x="129" y="37">PLATE</text><text x="221" y="37">HOLE</text>' +
    '<text x="341" y="37">SECT</text><text x="425" y="37">BAR</text></g>' +
    '<g stroke="#94a3b8" stroke-width="1.2" fill="none" marker-end="url(#tarr)">' +
    '<path d="M186 32 H168"/></g>' +
    '<text x="177" y="14" font-size="9.5" fill="#94a3b8" text-anchor="middle">cut</text>' +
    '<defs><marker id="tarr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6"' +
    ' orient="auto"><path d="M0 1 L7 4 L0 7 Z" fill="#94a3b8"/></marker></defs>' +
    // --- module tier
    '<g fill="none" stroke="#2563eb" stroke-width="1.4" stroke-dasharray="5 3">' +
    '<rect x="96" y="76" width="150" height="58" rx="7"/></g>' +
    '<g fill="#93c5fd" stroke="#2563eb" stroke-width="1">' +
    '<rect x="112" y="90" width="42" height="10"/><rect x="112" y="106" width="10" height="20"/>' +
    '<rect x="168" y="90" width="10" height="36"/><rect x="196" y="92" width="34" height="8"/>' +
    '<rect x="208" y="100" width="10" height="26"/></g>' +
    '<text x="171" y="150" font-size="10" fill="#94a3b8" text-anchor="middle">md.tower</text>' +
    '<text x="270" y="100" font-size="11" fill="#64748b">parts placed together,</text>' +
    '<text x="270" y="116" font-size="11" fill="#64748b">on the module&#8217;s own origin</text>' +
    // --- assembly tier
    '<g fill="none" stroke="#93c5fd" stroke-width="1.2" stroke-dasharray="4 3">' +
    '<rect x="96" y="166" width="74" height="42" rx="6"/>' +
    '<rect x="182" y="166" width="74" height="42" rx="6"/>' +
    '<rect x="268" y="166" width="74" height="42" rx="6"/></g>' +
    '<g fill="#93c5fd" stroke="#2563eb" stroke-width="0.9">' +
    '<rect x="108" y="176" width="30" height="7"/><rect x="108" y="188" width="7" height="14"/>' +
    '<rect x="194" y="176" width="30" height="7"/><rect x="194" y="188" width="7" height="14"/>' +
    '<rect x="280" y="176" width="30" height="7"/><rect x="280" y="188" width="7" height="14"/></g>' +
    '<g stroke="#cbd5e1" stroke-width="1"><path d="M96 222 H342"/></g>' +
    '<text x="219" y="236" font-size="10" fill="#94a3b8" text-anchor="middle">world origin</text>' +
    '<text x="360" y="184" font-size="11" font-weight="600" fill="#1d4ed8">the main window</text>' +
    '<text x="360" y="200" font-size="11" fill="#64748b">shows this, and only this</text>' +
    '</svg>' +
    '<figcaption>Three tiers. A part is a shape; a module is parts placed together; an' +
    ' assembly is modules placed in the world.</figcaption></figure>';

  // Bootstrap Icons "question-circle", MIT, inlined. The macroBIM pages use that
  // set, but the viewer runs in its own document where the icon font is absent -
  // and one path pair costs less than a font file either way.
  // Bootstrap Icons "download", MIT, inlined for the same reason as the help one.
  var ICON_DL =
    '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">' +
    '<path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5' +
    'a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>' +
    '<path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0' +
    'v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg>';
  var ICON_HELP =
    '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">' +
    '<path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>' +
    '<path d="M5.255 5.786a.237.237 0 0 0 .241.247h.825c.138 0 .248-.113.266-.25.09-.656.54-1.134' +
    ' 1.342-1.134.686 0 1.314.343 1.314 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168' +
    ' 1.987l.003.217a.25.25 0 0 0 .25.246h.811a.25.25 0 0 0 .25-.25v-.105c0-.718.273-.927' +
    ' 1.01-1.486.609-.463 1.244-.977 1.244-2.056 0-1.511-1.276-2.241-2.673-2.241-1.267' +
    ' 0-2.655.59-2.75 2.286zm1.557 5.763c0 .533.425.927 1.01.927.609 0 1.028-.394' +
    ' 1.028-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94z"/></svg>';

  /* ---------------- user guide ----------------
     Draft. Kept in the engine rather than a side file so a link-only embed
     still has its manual. English only, like the rest of the interface. */
  var GUIDE = [
    '<h2>What PLATE3D is</h2>',
    '<p class="lede">A spreadsheet that builds a steel structure.</p>',
    '<p>You type the parts and where they go. PLATE3D cuts them, stands them up,',
    ' weighs them and writes <b>STL</b> and <b>IFC</b>. There is nothing to draw, nothing',
    ' to drag into place, and no modelling licence between you and a solid you can',
    ' hand to a fabricator or a renderer.</p>',
    '<div class="props">',
    '<div><b>Fast to try</b>A dozen rows is a structure you can orbit. Roughing out a',
    ' bracket or a pier cap takes minutes, not an afternoon of picking geometry.</div>',
    '<div><b>Built for revision</b>Change a cell, load the file again, and the whole model',
    ' rebuilds. This is where a spreadsheet beats a drawing: a thickness or a hole pitch',
    ' that appears in twenty places is one cell, and every copy follows it.</div>',
    '<div><b>The file is the model</b>Your .xlsx <i>is</i> the source. Keep it, mail it,',
    ' diff it, put it under version control. Find it again in two years and the model comes',
    ' straight back - and the parts in it are worth lifting into the next job.</div>',
    '<div><b>Nothing to install</b>It runs in the browser. The sheet and this page are the',
    ' whole toolchain.</div>',
    '</div>',

    '<h2>Part, module, assembly</h2>',
    '<p>Everything is built in three tiers, the way a shop actually works: cut the parts,',
    ' weld them into units, then set the units out on site.</p>',
    GUIDE_SVG_TIERS,
    '<table class="gt"><thead><tr><th>tier</th><th>what it is</th><th>keywords</th></tr></thead><tbody>',
    '<tr><td><b>PART</b></td><td>one piece of steel, defined once and used as often as you',
    ' like. A <b>PLATE</b> is a flat outline; a <b>SECT</b> is a rolled H, C or L; a',
    ' <b>BAR</b> is a round bar. A <b>HOLE</b> is not a part at all - it is a shape you',
    ' subtract from a plate with <b>CUT</b>, which is how holes, notches and slots are made.</td>',
    '<td><code>PLATE</code> <code>HOLE</code> <code>CUT</code> <code>SECT</code> <code>BAR</code></td></tr>',
    '<tr><td><b>MODULE</b></td><td>parts placed relative to each other - a column, a bracket,',
    ' a diaphragm. Plates, sections and bars all go in the same way. The module carries its',
    ' own origin (its <b>BASE</b>) so it can be set down anywhere later.</td>',
    '<td><code>MODULE</code></td></tr>',
    '<tr><td><b>ASSEMBLY</b></td><td>modules placed in the world, and assemblies of',
    ' assemblies. This is where mirroring, arraying and rotating happen, so one module can',
    ' become forty without another row of geometry.</td><td><code>ASSY</code></td></tr>',
    '</tbody></table>',
    '<p>The point of the middle tier is leverage. Define a column once; place it eight times.',
    ' Change its plate thickness and all eight change with it.</p>',

    '<h3 class="warnhead">Nothing appears until you assemble it</h3>',
    '<p class="warn">A part or a module that no <b>ASSY</b> row places is defined but not',
    ' built - it will not be in the main window, the weight or the exported files. This is',
    ' deliberate: the library and the structure are separate things.</p>',
    '<table class="gt"><thead><tr><th>you wrote</th><th>where you see it</th></tr></thead><tbody>',
    '<tr><td><code>PLATE</code>, <code>SECT</code></td><td>the list on the left. <b>Click the',
    ' id</b> for a 2D drawing of that part - it never appears in the main window on its own</td></tr>',
    '<tr><td><code>BAR</code></td><td>the list only. Four numbers say everything a drawing would</td></tr>',
    '<tr><td><code>MODULE</code></td><td>the list. <b>Click the id</b> for a 3D preview of that',
    ' module by itself</td></tr>',
    '<tr><td><code>ASSY</code></td><td><b>the main window.</b> Only assembled members are drawn,',
    ' weighed and exported</td></tr>',
    '</tbody></table>',

    '<h2>The sheet</h2>',
    '<p><b>Name the tab <code>input</code>.</b> That is the tab the model is read from,',
    ' and it is the one thing you have to get right - a workbook grows other tabs',
    ' (a working calculation, a drawing list, last month&rsquo;s revision) and only',
    ' <code>input</code> is read. Any others are left alone.</p>',
    '<p>The tab is read top to bottom. One column holds the keyword; the columns after',
    ' it are that keyword&rsquo;s fields, in order.</p>',
    sheet([['# PLATE', 'id', 'mat', 'thk', 'shape', 'base.pt', '...'],
           ['PLATE', 'pl.T1', 'SM400', 10, 'RECT', 'bc', 350, 300]],
          'Row 1 starts with <code>#</code>, so it is a comment - use those for your' +
          ' column headings. Row 2 is the data the viewer reads.'),

    '<h3>The block does not have to start at column A</h3>',
    '<p>Close the block with an <b>END</b> row, and the column <b>END</b> sits in becomes',
    ' the keyword column for the whole tab. Everything to the left of it is yours:',
    ' headings, notes, the arithmetic that produced the numbers, or just white space to',
    ' let the block breathe. A row whose keyword cell is empty is skipped, so those',
    ' columns can hold whatever you like without disturbing the model.</p>',
    sheet([['tower frame', '', '# PLATE', 'id', 'mat', 'thk', 'shape', 'base.pt', '...'],
           ['deck to soffit', '=B4-B3', 'PLATE', 'pl.T1', 'SM400', 10, 'RECT', 'bc', 350],
           ['', '', 'PLATE', 'pl.C1', 'SM400', 10, 'RECT', 'bc', 100],
           ['', '', 'END']],
          'The keyword column is <b>C</b>, because that is where <b>END</b> is. Columns' +
          ' <b>A</b> and <b>B</b> are ignored entirely - a heading and a live formula here,' +
          ' and neither reaches the model.', 2),
    '<p>Without an END row each line falls back to its own first filled cell, so a block',
    ' that starts at A still reads - but then a note in column A <i>would</i> be taken for',
    ' a keyword. Write the END row and the question does not come up.</p>',
    '<ul>',
    '<li>A row starting with <code>#</code> or <code>!</code> is ignored.</li>',
    '<li>Case does not matter: <code>plate</code>, <code>PLATE</code> and <code>Plate</code> are the same.</li>',
    '<li>Blank cells fall back to the default listed for that field - they do not shift the columns.</li>',
    '<li>A target must be defined <i>above</i> the row that uses it. CUT needs its plate first;',
    '    ASSY needs its module first.</li>',
    '<li>Keep the columns <i>right</i> of a keyword for that keyword&rsquo;s fields. Notes',
    '    belong left of the block, or on their own <code>#</code> row.</li>',
    '</ul>',
    '<p>Load it with <b>Load Excel</b>, or drop the .xlsx anywhere on the window.',
    ' Edit the file and load it again to update.</p>',
    '<p>The viewer opens on a <b>tower crane</b> that is built into it, so there is something',
    ' to turn around before you have written anything. Load a sheet and it is replaced.</p>',
    '<p><b>Example</b> in the menu bar lists the worked sheets - the crane you are looking at,',
    ' a small annotated one with every keyword in it, and two drawn from real drawing sets.',
    ' Pick one and it downloads: the tab, the END row and every keyword below, already filled',
    ' in. Quicker to start from than a blank page.</p>',

    '<h2>Coordinates</h2>',
    '<p><b>Z is up.</b> X east, Y north, Z height - the same right-handed frame as IFC,',
    ' AutoCAD, Revit and Tekla. The screen, the STL and the IFC all use it, with no',
    ' conversion anywhere.</p>',
    '<p>A part is always drawn flat on its own local XY, then laid onto one of three',
    ' world planes:</p>',
    '<table class="gt"><thead><tr><th>PLANE</th><th>local x goes to</th><th>local y goes to</th>',
    '<th>thickness (+ face)</th><th>reads as</th></tr></thead><tbody>',
    '<tr><td><code>XY</code></td><td>X</td><td>Y</td><td>+Z (up)</td><td>plan</td></tr>',
    '<tr><td><code>XZ</code></td><td>X</td><td>Z</td><td>&#8722;Y</td><td>front elevation</td></tr>',
    '<tr><td><code>YZ</code></td><td>Y</td><td>Z</td><td>+X</td><td>side elevation</td></tr>',
    '</tbody></table>',

    '<h2>The nine points</h2>',
    '<p>Every shape carries nine named points, <b>t/m/b</b> (top, middle, bottom) crossed',
    ' with <b>l/c/r</b> (left, centre, right). You use them to say where a shape&rsquo;s origin',
    ' is and where it sits.</p>',
    GUIDE_SVG_9PT,
    '<table class="gt"><thead><tr><th>point</th><th>where</th></tr></thead><tbody>',
    '<tr><td><code>tl tr bl br</code></td><td>the real corners of the outline</td></tr>',
    '<tr><td><code>tc bc ml mr</code></td><td>edge midpoints. On a trapezoid <code>ml</code> and',
    ' <code>mr</code> are the midpoints of the sloping sides, not of a bounding box</td></tr>',
    '<tr><td><code>mc</code></td><td>the centroid</td></tr>',
    '</tbody></table>',
    '<ul>',
    '<li><b>A circle has five</b>: <code>mc</code> plus the quadrant points',
    '    <code>tc ml mr bc</code>. A corner name falls back to <code>tc</code> or <code>bc</code>.</li>',
    '<li>Points are taken from the <b>uncut</b> outline, so a notch cannot move',
    '    <code>bl</code> out from under an assembly that was built on it.</li>',
    '<li>Old spellings still read: <code>pbl pcc plm prm</code> and <code>lm cc rm</code>.</li>',
    '</ul>',

    '<h3>BASE.pt - a shape&rsquo;s own origin</h3>',
    '<p>Pick one of the nine and that point becomes <code>(0,0)</code> for the shape. Every',
    ' later number - a CUT position, a MODULE placement - is measured from it. Leave it',
    ' blank and a plate uses <code>bc</code>, a circle or a HOLE uses <code>mc</code>.</p>',

    '<h3>Ref.Pt and the &plusmn; faces</h3>',
    '<p>Thickness normally straddles the point: half each side. Add <code>+</code> or',
    ' <code>&#8722;</code> to the point name and a <i>face</i> lands on the coordinate instead,',
    ' so you can type the dimension the drawing gives you.</p>',
    GUIDE_SVG_FACE,
    '<table class="gt"><thead><tr><th>written</th><th>what lands on the coordinate</th>',
    '<th>the part occupies</th></tr></thead><tbody>',
    '<tr><td><code>bc</code></td><td>mid-thickness</td><td>C &#8722; T/2 &hellip; C + T/2</td></tr>',
    '<tr><td><code>bc+</code></td><td>the + face (local +Z side)</td><td>C &#8722; T &hellip; C</td></tr>',
    '<tr><td><code>bc-</code></td><td>the &#8722; face</td><td>C &hellip; C + T</td></tr>',
    '</tbody></table>',
    '<p>Not sure which side is +? Tick <b>local axes</b> or <b>+/&#8722; face</b> in the menu bar.</p>',

    '<h2>Keywords</h2>',

    '<h3>PLATE - a real part</h3>',
    '<p>Mass, colour, STL and IFC all come from these rows.</p>',
    sheet([['PLATE', 'id', 'mat', 'thk', 'TRAP', 'base.pt', 'WB', 'WT', 'H', 'OFF_T'],
           ['PLATE', 'id', 'mat', 'thk', 'RECT', 'base.pt', 'B', 'H'],
           ['PLATE', 'id', 'mat', 'thk', 'CIRC', 'base.pt', 'D']],
          'The shape keyword sits in a <b>fixed column</b> (E), so the columns before it' +
          ' never shift even though TRAP takes four numbers and CIRC takes one. A material' +
          ' called <code>400</code> will not be mistaken for a dimension.'),
    GUIDE_SVG_TRAP,
    '<table class="gt"><thead><tr><th>field</th><th>meaning</th><th>blank means</th></tr></thead><tbody>',
    '<tr><td><code>id</code></td><td>your name for the part. Same outline, different holes = different id</td><td>required</td></tr>',
    '<tr><td><code>mat</code></td><td>material, shown in the list</td><td>&mdash;</td></tr>',
    '<tr><td><code>thk</code></td><td>thickness</td><td>10</td></tr>',
    '<tr><td><code>base.pt</code></td><td>which of the nine points is the origin</td><td><code>bc</code>, or <code>mc</code> for CIRC</td></tr>',
    '<tr><td><code>WB</code></td><td>bottom width</td><td>0</td></tr>',
    '<tr><td><code>WT</code></td><td>top width. <code>WT = WB</code> is a rectangle, <code>WT = 0</code> a triangle</td><td>0</td></tr>',
    '<tr><td><code>H</code></td><td>height</td><td>0</td></tr>',
    '<tr><td><code>OFF_T</code></td><td>how far the top edge is shifted right</td><td>0 (symmetric)</td></tr>',
    '<tr><td><code>B</code></td><td>width (RECT)</td><td>0</td></tr>',
    '<tr><td><code>D</code></td><td>diameter (CIRC)</td><td>0</td></tr>',
    '</tbody></table>',

    '<h3>HOLE - a shape to remove</h3>',
    sheet([['HOLE', 'id', 'TRAP', 'base.pt', 'WB', 'WT', 'H', 'OFF_T'],
           ['HOLE', 'id', 'RECT', 'base.pt', 'B', 'H'],
           ['HOLE', 'id', 'CIRC', 'base.pt', 'D']]),
    '<p>The same fields as PLATE minus <b>thickness and material</b>, and that is the whole',
    ' point: a HOLE cannot become a real part by accident, and placing one in a MODULE is',
    ' refused. Depth is not a property of the shape - the same &#216;22 is a through hole in',
    ' one plate and a counterbore in another - so it belongs to the CUT, not here.</p>',
    '<p>PLATE and HOLE share one namespace, because a CUT may point at either. A duplicate',
    ' id is warned about.</p>',

    '<h3>CUT - remove it</h3>',
    sheet([['CUT', 'plate.id', 'L.X', 'L.Y', 'shape.id', 'dx', 'dy', 'repeat']]),
    '<p>Reads as: <i>take this shape and subtract it from that plate, with the shape&rsquo;s own',
    ' BASE.pt landing at (L.X, L.Y) measured from the plate&rsquo;s origin.</i></p>',
    '<table class="gt"><thead><tr><th>field</th><th>meaning</th></tr></thead><tbody>',
    '<tr><td><code>plate.id</code></td><td>the part to cut. Must be defined further up the sheet</td></tr>',
    '<tr><td><code>L.X L.Y</code></td><td>where the shape goes, from the plate&rsquo;s BASE.pt</td></tr>',
    '<tr><td><code>shape.id</code></td><td>a HOLE, or another PLATE whose outline you want to borrow</td></tr>',
    '<tr><td><code>dx dy repeat</code></td><td>array copies. <code>repeat</code> is how many',
    ' <i>extra</i> - blank or 0 gives one hole, 1 gives two</td></tr>',
    '</tbody></table>',
    '<p>Inside the outline it is a hole; straddling the edge it is a notch. It may run off',
    ' the plate entirely - only the overlap is removed. Rows apply in order, so cuts can',
    ' overlap each other.</p>',
    sheet([['# HOLE', 'id', 'shape', 'base.pt', 'd'],
           ['HOLE', 'h.M22', 'CIRC', 'mc', 22],
           ['# CUT', 'plate', 'L.X', 'L.Y', 'shape', 'dx', 'dy', 'repeat'],
           ['CUT', 'pl.T1', -110, 90, 'h.M22', 0, 220, 1]],
          'Two &#216;22 holes, at (&#8722;110, 90) and (&#8722;110, 310).'),
    '<p class="warn">A CUT on a SECT cuts the whole length, not a hole in the web.</p>',

    '<h3>BAR - a round bar</h3>',
    sheet([['BAR', 'id', 'mat', 'dia', 'length']]),
    '<p>Listed, not drawn - four numbers say everything a preview would. Placed in a MODULE',
    ' or an ASSY like any part, except that <b>Ref.Pt is left blank</b>: a bar is always',
    ' anchored at the centre of its starting face and runs the length along the plane&rsquo;s',
    ' thickness axis (XY&rarr;+Z, XZ&rarr;&#8722;Y, YZ&rarr;+X).</p>',
    sheet([['# BAR', 'id', 'mat', 'dia', 'length'],
           ['BAR', 'bar.pt3m', 'SAS1030', 28, 3000],
           ['# MODULE', 'id', 'member', 'Ref.Pt', 'L.X', 'L.Y', 'L.Z', 'PLANE'],
           ['MODULE', 'md.tower', 'bar.pt3m', '', 0, 0, 0, 'XY']],
          'Column D is left empty on purpose - the bar stands 3000 up from the origin.'),
    '<p>That is one of <b>two</b> ways to place it. The other gives the bar its two end points',
    ' instead of a plane and a length - see <b>MODULE by coordinates</b> below. Written that way',
    ' the <code>length</code> above becomes a reference value and the two points decide it, so',
    ' one <code>BAR</code> row covers every anchor bolt in the model whatever its length.</p>',

    '<h3>SECT - a rolled section</h3>',
    sheet([['SECT', 'id', 'mat', 'length', 'TYPE', 'base.pt', 'v1', 'v2', 'v3', '...']]),
    '<p>TYPE is <b>H</b>, <b>C</b> or <b>L</b>. The values follow from column G in order with',
    ' <b>no blank cells between them</b> - each type has its own list.</p>',
    GUIDE_SVG_SECT,
    '<table class="gt"><thead><tr><th>TYPE</th><th>values, in order</th></tr></thead><tbody>',
    '<tr><td><b>H</b></td><td><code>h bb bt tw tf1 tf2 r1</code><br>' +
    'overall depth &middot; bottom flange width &middot; top flange width &middot; web thickness &middot;',
    ' <b>bottom</b> flange thickness &middot; <b>top</b> flange thickness &middot; root fillet</td></tr>',
    '<tr><td><b>C</b></td><td><code>h b tw tf rw rf</code><br>' +
    'depth &middot; flange width &middot; web thickness &middot; flange thickness &middot;',
    ' web/flange root fillet &middot; flange toe radius</td></tr>',
    '<tr><td><b>L</b></td><td><code>a b t1 t2 r1 r2</code><br>' +
    'leg along x &middot; leg along y &middot; <b>thickness of the a leg</b> &middot;',
    ' <b>thickness of the b leg</b> &middot; root fillet &middot; toe radius</td></tr>',
    '</tbody></table>',
    sheet([['# SECT', 'id', 'mat', 'length', 'TYPE', 'base.pt', 'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7'],
           ['SECT', 's.H', 'SM490', 6000, 'H', 'bc', 400, 200, 200, 8, 13, 13, 16],
           ['SECT', 's.C', 'SS275', 3000, 'C', 'bc', 300, 90, 12, 16, 19, 9],
           ['SECT', 's.L', 'SS275', 2400, 'L', 'bc', 90, 75, 9, 9, 8.5, 6]]),
    '<p>An H takes seven values, C and L six. C and L take the same <i>number</i> but they',
    ' mean different things, so the type decides how they are read. An equal angle still',
    ' writes all four: <code>100 100 10 10</code>.</p>',
    '<p>Fillets are drawn as real arcs (eight segments per quarter, area within 0.06%).',
    ' Leaving them out of an H-400&times;200&times;8&times;13 loses about 2.6% of the area. Put',
    ' <b>0</b> or leave the cell blank and that corner comes out square - no error.</p>',
    '<p class="warn">A SECT row is <b>refused, not repaired</b>. If a dimension is missing or',
    ' zero, a flange is deeper than the section, the web is thicker than the flange, a fillet',
    ' does not fit, or a radius is negative, the row is skipped with a warning. A plausible',
    ' profile with the wrong area is worse than none.</p>',
    '<p>Placed exactly like a bar - blank Ref.Pt, laid on a plane, running its length along that',
    ' plane&rsquo;s thickness axis. And like a bar it has the second option: <b>MODULE by',
    ' coordinates</b> below stretches it between two points, takes the length from the distance,',
    ' and rolls the profile about its own axis with <code>Alpha</code>. That is the one to reach',
    ' for on bracing - <code>length</code> becomes the stock length and a single SECT row serves',
    ' every member cut from it.</p>',

    '<h3>MODULE - parts into a unit</h3>',
    sheet([['MODULE', 'id', 'member.id', 'Ref.Pt', 'L.X', 'L.Y', 'L.Z', 'PLANE', 'ROT.X', 'ROT.Y', 'ROT.Z'],
           ['MODULE', 'id', 'BASE', 'member.no', 'point']]),
    '<p>Reads as: <i>put this member&rsquo;s Ref.Pt at (L.X, L.Y, L.Z) in module coordinates, lay',
    ' it on PLANE, then spin it about that point by ROT.X, ROT.Y, ROT.Z degrees</i> (applied',
    ' X, then Y, then Z).</p>',
    '<p>One row per member; repeat the module id on every row and they accumulate into one',
    ' module. The <b>BASE</b> row names the module&rsquo;s own origin - one of the nine points of',
    ' one of its members, <code>+</code>/<code>&#8722;</code> allowed. <b>It is not optional</b>:',
    ' it is the point every ASSY row places the module by, so leaving it out is an error.',
    ' The model still draws, off the module&rsquo;s local origin, so you can see what you have -',
    ' but where it landed is an accident rather than something the sheet asked for.</p>',
    '<p class="warn"><b>The BASE point is a datum, not the origin.</b> Read where it actually',
    ' sits in module coordinates, then write that same place in the ASSY row. Name a member',
    ' whose point is at (0, 0, 0) and the ASSY row reads as the position of the module; name',
    ' one sitting 150 off the centre line and the ASSY row has to say 150 too, or everything',
    ' shifts by the difference. On a member placed by coordinates the datum is the',
    ' <b>work point</b> - <code>LX1</code>, <code>LY1</code>, <code>LZ1</code> - not wherever',
    ' <code>OFF_B</code> cut the steel back to. OFF trims the member; it never moves it.</p>',
    sheet([['# MODULE', 'id', 'member', 'Ref.Pt', 'L.X', 'L.Y', 'L.Z', 'PLANE'],
           ['MODULE', 'md.tower', 'pl.T1', 'bc+', 140, 0, 0, 'XZ'],
           ['MODULE', 'md.tower', 'pl.C1', 'bc+', 0, 0, 0, 'XY'],
           ['MODULE', 'md.tower', 'pl.C1', 'bc-', 0, 200, 0, 'XY'],
           ['MODULE', 'md.tower', 'pl.C2', 'bc', -60, 0, 60, 'YZ'],
           ['MODULE', 'md.tower', 'BASE', 'pl.T1', 'bc-']],
          'pl.C1 twice is two members - the app calls them pl.C1_1 and pl.C1_2. ' +
          'pl.T1 and pl.C2 are used once and keep their plain names.'),
    '<p><b>Name the part; the engine numbers the copies.</b> A <b>PLATE</b> row is a shape and a',
    ' <b>MODULE</b> row is one use of it, so write <code>pl.C1</code> as many times as you use it.',
    ' The app gives each use an id of its own - <code>pl.C1_1</code>, <code>pl.C1_2</code>, ... -',
    ' because BASE, the module preview and the assembly list all address a member by name. A part',
    ' used once keeps its plain name. You can still write the suffix yourself when you want to',
    ' point <b>BASE</b> at a particular copy; a bare name there means the first one.</p>',

    '<h3>MODULE by coordinates - a bar or a section between two points</h3>',
    sheet([['MODULE', 'id', 'member.id', 'Ref.Pt', 'LX1', 'LY1', 'LZ1',
            'LX2', 'LY2', 'LZ2', 'OFF_B', 'OFF_E', 'Alpha']]),
    '<p>Same keyword, same first four columns. What tells the two apart is the <b>PLANE cell</b>:',
    ' a plane name there means the row above, a <b>number</b> means this one. The member is then',
    ' stretched from <b>(LX1, LY1, LZ1)</b> to <b>(LX2, LY2, LZ2)</b> in module coordinates and',
    ' takes its length from the distance between them.</p>',
    '<p>Which means <b>the Length on the BAR or SECT row stops deciding anything</b>. It stays as',
    ' the reference value it was written as - the SECTIONS table marks it <span class="rf">ref',
    '</span> - and what gets built is the distance between the two points. So one',
    ' <code>sect.L65x6</code> definition can serve every brace in the model, each at its own',
    ' length. Draw the work lines, read off the node coordinates, and the steel follows.</p>',
    '<table class="gt"><thead><tr><th>column</th><th>what it does</th></tr></thead><tbody>',
    '<tr><td><b>OFF_B</b><br><b>OFF_E</b></td><td>Trim at the start and at the end, along the',
    ' member&rsquo;s own axis. <b>Signed:</b> positive pulls the end back from the point',
    ' (clearance at a joint), <b>negative runs it past</b> - a brace lapping into a gusset, a',
    ' column embedded in its base plate, a spigot standing proud. Blank is 0.<br>' +
    'Real length = <code>|B&minus;A| &minus; OFF_B &minus; OFF_E</code>, and it has to stay',
    ' above zero.</td></tr>',
    '<tr><td><b>Alpha</b></td><td>Roll, in degrees, about the member&rsquo;s own axis - which way',
    ' the web faces, which way a channel opens. The roll turns the section about the axis line,',
    ' so it never moves the member off the two points it was given. Blank is 0.</td></tr>',
    '<tr><td><b>Ref.Pt</b></td><td>Which of the nine points of the section rides the axis line.',
    ' <b>Leave it blank</b> and that is the section&rsquo;s own BASE.pt, which is what you want',
    ' almost always. <code>mc</code> puts the centroid on the line instead.</td></tr>',
    '</tbody></table>',
    '<p><b>Which way up?</b> Two points give a direction but not a roll, so the section stands',
    ' with its local <i>y</i> as near to world up as it can - the same way the planes already do.',
    ' A member laid along an axis therefore comes out <i>exactly</i> as the matching PLANE would',
    ' have placed it, and an existing row rewritten with coordinates does not move:</p>',
    '<table class="gt"><thead><tr><th>the member runs</th><th>it stands as if laid on',
    '</th></tr></thead><tbody>',
    '<tr><td>+Z (straight up)</td><td><code>XY</code></td></tr>',
    '<tr><td>&#8722;Y</td><td><code>XZ</code></td></tr>',
    '<tr><td>+X</td><td><code>YZ</code></td></tr>',
    '</tbody></table>',
    sheet([['# SECT', 'id', 'mat', 'length', 'TYPE', 'base.pt', 'v1', 'v2', 'v3', 'v4', 'v5', 'v6'],
           ['SECT', 's.brc', 'SS275', 6000, 'L', 'bc', 65, 65, 6, 6, 8, 4],
           ['# MODULE', 'id', 'member', 'Ref.Pt', 'LX1', 'LY1', 'LZ1', 'LX2', 'LY2', 'LZ2',
            'OFF_B', 'OFF_E', 'Alpha'],
           ['MODULE', 'md.bay', 's.brc_1', '', 0, 0, 0, 1200, 0, 1800, -40, -40],
           ['MODULE', 'md.bay', 's.brc_2', '', 1200, 0, 0, 0, 0, 1800, -40, -40],
           ['MODULE', 'md.bay', 's.brc_3', '', 0, 0, 1800, 1200, 0, 1800, 30, 30, 90],
           ['MODULE', 'md.bay', 'BASE', 's.brc_1', 'bc']],
          'One L-65&times;65&times;6 definition, three members. The diagonals cross a ' +
          '1200&times;1800 bay - 2163 node to node, built 2243 so each end laps 40 past its ' +
          'node. The top strut is held 30 clear at both ends and rolled 90&deg;. The Length ' +
          'cell says 6000 because that is the stock length - nothing reads it.'),
    '<p class="warn">Coordinates place a <b>BAR or a SECT only</b>. A plate is placed with Ref.Pt,',
    ' L.X, L.Y, L.Z and a PLANE, because stretching a plate would stretch its thickness. Two',
    ' identical points, or offsets that eat the whole member, are reported and the row is skipped.</p>',

    '<h3>ASSY - units into the model</h3>',
    '<p>Four commands. Column D picks which.</p>',
    sheet([['ASSY', 'id', 'ref', 'ADD', 'G.X', 'G.Y', 'G.Z', 'ROT.X', 'ROT.Y', 'ROT.Z'],
           ['ASSY', 'id', 'ref', 'MIR', 'G.X', 'G.Y', 'G.Z', 'PLANE'],
           ['ASSY', 'id', 'ref', 'COPY', 'd.X', 'd.Y', 'd.Z', 'repeat'],
           ['ASSY', 'id', 'ref', 'ROT', 'C.X', 'C.Y', 'C.Z', 'AXIS', 'angle', 'repeat']],
          '<code>ref</code> is a MODULE, another ASSY, or a lone PLATE / BAR / SECT.' +
          ' Leave column D blank and it reads as ADD.'),
    '<table class="gt"><thead><tr><th>command</th><th>what it does</th><th>coordinates</th>',
    '<th>member id</th></tr></thead><tbody>',
    '<tr><td><b>ADD</b></td><td>place it, ref&rsquo;s base point landing on G</td>',
    '<td><b>absolute</b></td><td><code>ref.A</code></td></tr>',
    '<tr><td><b>MIR</b></td><td>mirror it where it stands, about the XY / YZ / XZ plane through G</td>',
    '<td><b>absolute</b> - a point on the mirror plane</td><td><code>ref.M</code></td></tr>',
    '<tr><td><b>COPY</b></td><td>shift copies off where it stands</td>',
    '<td><b>relative</b> - the step</td>',
    '<td><code>ref.C001</code>, <code>ref.C002</code> &hellip;</td></tr>',
    '<tr><td><b>ROT</b></td><td>rotate copies about the world X, Y or Z axis through C, angle',
    ' accumulating</td><td><b>absolute</b> - a point on the axis</td>',
    '<td><code>ref.R001</code>, <code>ref.R002</code> &hellip;</td></tr>',
    '</tbody></table>',

    '<h3>What gets named</h3>',
    '<p><b>The id you write in column B is the assembly, and it is used exactly as written</b>',
    ' - no command ever changes it. One id, one assembly, one group in the list on the left.</p>',
    '<p>What picks up a new name is the thing being put in: <code>ref</code> plus the command',
    ' that placed it. ADD and MIR place one each so they stay unnumbered; COPY and ROT number',
    ' theirs from <code>001</code> up to <code>999</code>.</p>',
    sheet([['# ASSY', 'id', 'ref', 'cmd', 'G / d / C', '', '', 'extra'],
           ['ASSY', 'as.comb', 'md.tower', 'ADD', 0, 0, 0],
           ['ASSY', 'as.comb', 'bar.pt3m', 'ADD', 0, 0, 0],
           ['ASSY', 'as.comb.cp', 'md.tower', 'COPY', 0, 800, 0, 4],
           ['ASSY', 'as.comb.rot', 'md.tower', 'ROT', -2000, 0, 0, 'Z', 30, 3],
           ['', '', '', '', '', '', '', ''],
           ['END']],
          'Three groups come out of this: <b>AS.COMB</b> holding <code>MD.TOWER.A</code> and' +
          ' <code>BAR.PT3M.A</code>, <b>AS.COMB.CP</b> holding <code>MD.TOWER.C001</code> to' +
          ' <code>C004</code>, and <b>AS.COMB.ROT</b> holding <code>MD.TOWER.R001</code> to' +
          ' <code>R003</code>.'),
    '<p><b>Rows sharing an id accumulate</b>, the same way MODULE rows do - and that goes for',
    ' all four commands, not just ADD. So a module and a bar join one assembly, and',
    ' <code>ASSY as.a as.a MIR &hellip;</code> mirrors an assembly into itself to finish it.',
    ' Every G is still absolute; move the assembly later and the whole thing travels.</p>',
    sheet([['# ASSY', 'id', 'ref', 'cmd', 'G.X', 'G.Y', 'G.Z', 'PLANE'],
           ['ASSY', 'as.half', 'md.tower', 'ADD', 0, 0, 0],
           ['ASSY', 'as.half', 'as.half', 'MIR', 900, 0, 0, 'YZ'],
           ['ASSY', 'as.big', 'as.half', 'ADD', 0, 0, 900]],
          'Row 3 mirrors <b>AS.HALF</b> about a plane at x = 900 and keeps the result in it,' +
          ' so row 4 places both halves - the assembly as it now stands.'),
    '<p>Which point of <code>ref</code> lands on G: a MODULE uses its <b>BASE</b> point, a lone',
    ' plate uses <code>bc</code>, another ASSY uses its own origin. A MODULE can be overridden -',
    ' a bare point name (<code>bc</code>) uses the module&rsquo;s bounding box, and',
    ' <code>member.point</code> (<code>pl.C2_1.tc+</code>) picks a point on one of its parts.</p>',
    '<p><code>repeat</code> counts <b>extra</b> copies, not including the original.</p>',
    '<p>In the list on the left the assembly id is the group header and each member id is a',
    ' row under it. <b>A sheet opens with every assembly folded</b> - a contents page, one',
    ' line and a member count each - so a model with forty copies in it still fits on screen.',
    ' The ring in front of an id opens that one; click it again to put it back. Each assembly',
    ' gets its own colour for that ring, so the groups stay apart at a glance; it is a list',
    ' label only and never reaches the 3D, where a colour still means the module or the',
    ' plate.</p>',
    '<p><b>Clicking a member name highlights that one in the model</b> - it glows, its edges',
    ' turn cyan and a box is drawn round it, so you can tell which of forty identical copies',
    ' the row stands for. Click it again to let go. It does not open a drawing: to look at a',
    ' module on its own, click it in the <b>MODULES</b> list above.</p>',
    '<p>Ticking the header hides the whole assembly; each row still hides its own member, and',
    ' carries the colour of the module or plate it holds.</p>',

    '<h2>Reading the screen</h2>',
    '<h3>Moving around</h3>',
    '<table class="gt"><thead><tr><th>where</th><th>mouse</th><th>what happens</th></tr></thead><tbody>',
    '<tr><td rowspan="4">3D views<br><small>main window and module preview</small></td>',
    '<td><b>drag</b></td><td>orbit around the point you are looking at</td></tr>',
    '<tr><td><b>wheel</b></td><td>zoom in and out</td></tr>',
    '<tr><td><b>right-drag</b></td><td>pan - slide the model sideways without turning it</td></tr>',
    '<tr><td><b>regen</b> / a view button</td><td>back to a known framing</td></tr>',
    '<tr><td rowspan="3">2D drawings<br><small>a plate or a section</small></td>',
    '<td><b>drag</b></td><td>pan</td></tr>',
    '<tr><td><b>wheel</b></td><td>zoom about the cursor</td></tr>',
    '<tr><td><b>double-click</b></td><td>fit the drawing to the window</td></tr>',
    '</tbody></table>',
    '<p>With <b>measure</b> on, dragging still orbits and pans - only a click without a drag',
    ' picks a point, and a right-click clears the picks.</p>',

    '<h3>The menu bar</h3>',
    '<table class="gt"><thead><tr><th>control</th><th>what it does</th></tr></thead><tbody>',
    '<tr><td><b>Save STL</b></td><td>the model as a triangle mesh</td></tr>',
    '<tr><td><b>Save IFC</b></td><td>the model as real BIM solids - each part its exact profile,',
    ' holes as voids, extruded by its thickness</td></tr>',
    '<tr><td><b>Save BOQ</b></td><td>the take-off, as a workbook. See below</td></tr>',
    '<tr><td><b>ISO / Front / Side / Top</b></td><td>standard views. The one you are looking',
    ' through fills in</td></tr>',
    '<tr><td><b>ortho</b></td><td>parallel projection - Front, Side and Top become true',
    ' elevations and plans. The framing is kept across the switch</td></tr>',
    '<tr><td><b>clash</b></td><td>draws the volume two members share, in red. Faces touching',
    ' - a butt joint, a box column - are not a clash; biting in by more than 0.5&nbsp;mm is</td></tr>',
    '<tr><td><b>surface only</b></td><td>drop the thickness and draw parts as surfaces</td></tr>',
    '<tr><td><b>local axes</b></td><td>the local frame at each part&rsquo;s Ref.Pt, with the',
    ' + and &#8722; thickness directions labelled</td></tr>',
    '<tr><td><b>+ / &#8722; face</b></td><td>tint the two faces so you can see which way the',
    ' thickness went</td></tr>',
    '<tr><td><b>id</b></td><td>name every placed member</td></tr>',
    '<tr><td><b>measure</b></td><td>click two points for &#916;X, &#916;Y, &#916;Z and the distance.',
    ' Snaps to the origin, every corner of a cut outline, hole centres, and the nine points',
    ' each part was placed by &mdash; <b>mc</b>, the centre, on both faces and at mid-thickness.',
    ' A bar snaps at its two end centres only</td></tr>',
    '</tbody></table>',
    '<p>Click a <b>HOLE</b>, <b>PLATE</b> or <b>SECTION</b> id for its 2D drawing - grid, named points,',
    ' &#216; on holes, R on fillets, and measure. Click a <b>MODULE</b> for a 3D preview with a',
    ' per-member hide / colour / opacity panel. <b>regen</b> puts either back to the view it',
    ' opened with. A row in <b>ASSEMBLY</b> is a placement rather than a definition, so it',
    ' highlights in the model instead of opening a drawing.</p>',
    '<p>The floor grid lies on z = 0 and its centre cross is the origin, so a grid crossing',
    ' reads a round coordinate straight off.</p>',

    '<h3>Save BOQ - the take-off</h3>',
    '<p>A workbook of four sheets, written from the model on screen. Weights are computed',
    ' from the real cut area, so every hole and notch is already out of them.</p>',
    '<p><b>Every weight in the book is a formula, not a number.</b> Open it in Excel and the',
    ' chain is live the whole way down:</p>',
    '<table class="gt"><thead><tr><th>cell</th><th>formula</th></tr></thead><tbody>',
    '<tr><td>UNIT kg, a plate</td><td><code>= AREA m&sup2; &times; THK &times; 7.85</code></td></tr>',
    '<tr><td>kg/m, a bar or section</td><td><code>= AREA mm&sup2; &times; 0.00785</code></td></tr>',
    '<tr><td>UNIT kg, a bar or section</td><td><code>= kg/m &times; LENGTH / 1000</code></td></tr>',
    '<tr><td>WEIGHT kg</td><td><code>= UNIT kg &times; QTY</code></td></tr>',
    '<tr><td>kg / UNIT, TOTAL kg</td><td><code>= UNIT kg &times; QTY / UNIT</code>,',
    ' <code>&times; TOTAL QTY</code></td></tr>',
    '<tr><td>every subtotal</td><td><code>= SUM(</code>the lines above it<code>)</code></td></tr>',
    '<tr><td>a module banner</td><td>its block subtotals added, then <code>&times;</code> how many',
    ' units the model holds</td></tr>',
    '<tr><td>an assembly subtotal</td><td><code>= SUM(</code>its module lines<code>)</code></td></tr>',
    '<tr><td>GRAND TOTAL, SUMMARY</td><td>the assembly subtotals added; the category lines point',
    ' straight at the PART LIST cells</td></tr>',
    '</tbody></table>',
    '<p>So a thickness typed over in the sheet moves the part, its module, its assembly and the',
    ' grand total with it - which is the point of a take-off rather than a printout. The only',
    ' dead values are the ones nothing can derive: the dimensions themselves, the counts the',
    ' model measured, and <b>AREA</b> - a cut outline is not something a cell can integrate,',
    ' so the engine hands over the area it already used for the solid. Edit an area and the',
    ' weights follow it; edit a dimension and the area does not, so re-export instead.</p>',
    '<table class="gt"><thead><tr><th>sheet</th><th>what is on it</th></tr></thead><tbody>',
    '<tr><td><b>SUMMARY</b></td><td>weight by category with each one&rsquo;s share, and the counts',
    ' - assemblies, module types, distinct parts, placed members</td></tr>',
    '<tr><td><b>PART LIST</b></td><td>every distinct part once, with <b>unit weight, quantity and',
    ' total</b>. Grouped by the fields it was written with: <code>PLATE — RECT</code> and',
    ' <code>PLATE — TRAP</code> are separate blocks with separate headers, because a TRAP',
    ' <code>WT</code> is not a RECT <code>B</code>. Plates also carry area and how many CUT rows',
    ' hit them</td></tr>',
    '<tr><td><b>MODULES</b></td><td>each module type once: what one holds, <b>QTY / UNIT</b> and',
    ' <b>kg / UNIT</b> per part, then <b>TOTAL QTY</b> and <b>TOTAL kg</b> across the model. The',
    ' banner gives its members per unit, how many units exist, and both weights</td></tr>',
    '<tr><td><b>ASSEMBLY</b></td><td>each assembly as <b>modules only</b> - the module, how many,',
    ' unit weight, total - then the grand total of every assembly. No part detail here: it is on',
    ' MODULES, once, instead of repeated per copy</td></tr>',
    '</tbody></table>',
    '<p>A <b>section placed by coordinates comes in several lengths from one definition</b>, and',
    ' each length is its own line - two lengths of one profile are two items to order. Parts a',
    ' sheet places straight from an ASSY row, with no module around them, are collected under',
    ' <b>NOT IN A MODULE</b> and shown on the assembly line as <i>parts placed directly</i>.</p>',
    '<p class="warn">The BOQ covers <b>what is visible</b>, exactly like Save STL and Save IFC.',
    ' Untick members and they leave the take-off; the SUMMARY sheet says so and gives the number',
    ' excluded, so a partial take-off cannot be mistaken for the whole model.</p>',

    '<h2>A whole sheet</h2>',
    '<p>On a tab named <code>input</code>, closed with <b>END</b>.</p>',
    sheet([['# PLATE', 'id', 'mat', 'thk', 'shape', 'base.pt', 'p1', 'p2'],
           ['PLATE', 'pl.T1', 'SM400', 10, 'RECT', 'bc', 350, 300],
           ['PLATE', 'pl.C1', 'SM400', 10, 'RECT', 'bc', 100, 300],
           ['# HOLE', 'id', 'shape', 'base.pt', 'd'],
           ['HOLE', 'h.M22', 'CIRC', 'mc', 22],
           ['# CUT', 'plate', 'L.X', 'L.Y', 'shape', 'dx', 'dy', 'repeat'],
           ['CUT', 'pl.T1', -110, 90, 'h.M22', 220, 0, 1],
           ['# BAR', 'id', 'mat', 'dia', 'length'],
           ['BAR', 'bar.pt3m', 'SAS1030', 28, 3000],
           ['# SECT', 'id', 'mat', 'length', 'TYPE', 'base.pt', 'v1', 'v2', 'v3', 'v4', 'v5', 'v6'],
           ['SECT', 'sc.brc', 'SS275', 6000, 'L', 'bc', 65, 65, 6, 6, 8, 4],
           ['# MODULE', 'id', 'member', 'Ref.Pt', 'L.X', 'L.Y', 'L.Z', 'PLANE'],
           ['MODULE', 'md.tower', 'pl.T1', 'bc+', 140, 0, 0, 'XZ'],
           ['MODULE', 'md.tower', 'pl.C1', 'bc', 0, 0, 0, 'XY'],
           ['MODULE', 'md.tower', 'bar.pt3m', '', 0, 0, 0, 'XY'],
           ['# MODULE', 'id', 'member', 'Ref.Pt', 'LX1', 'LY1', 'LZ1',
            'LX2', 'LY2', 'LZ2', 'OFF_B', 'OFF_E'],
           ['MODULE', 'md.tower', 'sc.brc_1', '', 300, 0, 0, 0, 0, 2600, 60, 60],
           ['MODULE', 'md.tower', 'BASE', 'pl.T1', 'bc-'],
           ['# ASSY', 'id', 'ref', 'cmd', 'G.X', 'G.Y', 'G.Z', 'repeat'],
           ['ASSY', 'as.comb', 'md.tower', 'ADD', 0, 0, 0],
           ['ASSY', 'as.comb', 'md.tower', 'COPY', 2000, 0, 0, 2],
           ['END']],
          'Both MODULE grammars in one block: three members on a plane, then a brace ' +
          'stretched from (300, 0, 0) to (0, 0, 2600) - 2617 between the points, built 2497 ' +
          'because each end is held 60 clear. The result is one group, <b>AS.COMB</b>, ' +
          'holding <code>MD.TOWER.A</code> and the two copies <code>MD.TOWER.C001</code>, ' +
          '<code>MD.TOWER.C002</code>.'),

    '<h2>When something does not appear</h2>',
    '<ul>',
    '<li>Read the panel at the top of the list. Green with a &#10003; means it built;',
    '    red lists every refused row with its row number.</li>',
    '<li>Nothing at all loaded? Check the tab is named <code>input</code> - the panel says',
    '    so if it had to fall back to another tab.</li>',
    '<li>A member with no ASSY row is defined but never placed. Nothing is drawn until an ASSY row places it.</li>',
    '<li>A CUT above its plate, or an ASSY above its module, cannot find its target.</li>',
    '<li>A SECT row with a dimension that does not fit is skipped on purpose - the warning says which.</li>',
    '<li>Placed the part but it is somewhere unexpected? Tick <b>local axes</b> and check the',
    '    Ref.Pt, then <b>+ / &#8722; face</b> to check which way the thickness went.</li>',
    '</ul>'
  ].join('\n');

  // title/subtitle are no longer painted - the bar starts with Load Excel, and
  // the page around the viewer already says what it is - but the data file may
  // still carry them, so the signature stays put.
  function buildDOM(title, subtitle, note) {
    // The stylesheet asks for Inter, the face the macroBIM pages use. The host
    // page may already carry it, but a link-only embed - or this viewer in its
    // own frame - would silently fall back to the system UI face and look like
    // a different application, so fetch it here when nobody else has.
    if (!document.getElementById('pb-font') &&
        !document.querySelector('link[href*="family=Inter"]')) {
      var lk = document.createElement('link');
      lk.id = 'pb-font';
      lk.rel = 'stylesheet';
      lk.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
      document.head.appendChild(lk);
    }
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
      '<div id="pb-bar">' +
      '  <button class="accent" onclick="plateBuilder.pickExcel()">&#8682; Load Excel</button>' +
      '  <button onclick="plateBuilder.exportSTL()">Save STL</button>' +
      '  <button onclick="plateBuilder.exportIFC()">Save IFC</button>' +
      '  <button onclick="plateBuilder.exportBOQ()" title="quantities and weights' +
      ' as a workbook">Save BOQ</button>' +
      '  <input type="file" id="pb-file" accept=".xlsx,.xls" style="display:none">' +
      '  <span class="sep"></span>' +
      '  <button class="vw active" onclick="plateBuilder.setView(\'iso\')">ISO</button>' +
      '  <button class="vw" onclick="plateBuilder.setView(\'front\')">Front</button>' +
      '  <button class="vw" onclick="plateBuilder.setView(\'side\')">Side</button>' +
      '  <button class="vw" onclick="plateBuilder.setView(\'top\')">Top</button>' +
      '  <span class="sep"></span>' +
      '  <label class="chk"><input type="checkbox" id="pb-ortho"' +
      '    onchange="plateBuilder.setOrtho(this.checked)"> ortho</label>' +
      '  <label class="chk"><input type="checkbox" id="pb-clash"' +
      '    onchange="plateBuilder.setClash(this.checked)">' +
      '    <span style="color:#dc2626">clash</span></label>' +
      '  <label class="chk"><input type="checkbox" id="pb-flat"' +
      '    onchange="plateBuilder.setFlat(this.checked)"> surface only</label>' +
      '  <label class="chk"><input type="checkbox" id="pb-axes"' +
      '    onchange="plateBuilder.setAxes(this.checked)"> local axes</label>' +
      '  <label class="chk"><input type="checkbox" id="pb-faces"' +
      '    onchange="plateBuilder.setFaces(this.checked)">' +
      '    <span style="color:#c2410c">+</span>/<span style="color:#1d4ed8">&#8722;</span>' +
      '    face</label>' +
      '  <label class="chk"><input type="checkbox" id="pb-ids"' +
      '    onchange="plateBuilder.setIds(this.checked)"> id</label>' +
      '  <label class="chk"><input type="checkbox" id="pb-meas"' +
      '    onchange="plateBuilder.setMeasure(this.checked)"> measure</label>' +
      '  <button class="guide" onclick="plateBuilder.openGuide()"' +
      '    title="how to write the spreadsheet">' + ICON_HELP + 'Guide</button>' +
      '  <button class="guide ex" onclick="plateBuilder.openSamples(event)"' +
      '    title="download a worked sheet to start from">' +
      ICON_DL + 'Example</button>' +
      '</div>' +
      '<div id="pb-body">' +
      '<div id="pb-side">' +
      '  <div id="pb-prog"><div id="pb-prog-label"></div>' +
      '    <div class="pb-track"><div id="pb-prog-bar"></div></div></div>' +
      '  <div id="pb-result"></div>' +
      '  <table id="pb-holes"></table>' +
      '  <table id="pb-plates"></table>' +
      '  <table id="pb-bars"></table>' +
      '  <table id="pb-sects"></table>' +
      '  <table id="pb-modules"></table>' +
      '  <table id="pb-list"></table>' +
      '  <div id="pb-total"></div>' +
      '  <div id="pb-note"></div>' +
      '</div>' +
      '<div id="pb-viewwrap">' +
      '  <div id="pb-view"><div id="pb-hud">Drag: rotate · Wheel: zoom · Right-drag: pan</div>' +
      '    <div id="pb-meas-out">&nbsp;</div></div>' +
      '</div>' +
      '</div>' +
      '<div id="pb-pal"></div>' +
      '<div id="pb-ex" onclick="if(event.target===this)plateBuilder.closeSamples()">' +
      '  <div class="box">' +
      '    <h2><span class="close" onclick="plateBuilder.closeSamples()"' +
      '      title="close">&#10005;</span>Example workbooks</h2>' +
      '    <p class="exi">Pick one to save it. Open it in Excel, edit the sheet named' +
      '      <b>input</b>, then <b>Load Excel</b> to see the change. Every row is' +
      '      annotated in the column left of the keywords.</p>' +
      '    <div id="pb-exlist"></div>' +
      '  </div></div>' +
      '<div id="pb-help" onclick="if(event.target===this)plateBuilder.closeGuide()">' +
      '  <div class="box"><header><b>PLATE3D &mdash; how to use</b>' +
      '    <span onclick="plateBuilder.closeGuide()" title="close">&#10005;</span></header>' +
      '    <div class="doc">' + GUIDE + '</div>' +
      '  </div></div>' +
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
      '        <span style="color:#c2410c">+</span>/<span style="color:#1d4ed8">&#8722;</span>' +
      '        surface</label>' +
      '      <label class="pvchk"><input type="checkbox" id="pb-pv-flat"' +
      '        onchange="plateBuilder.setFlat(this.checked)"> surface only</label>' +
      '      <label class="pvchk"><input type="checkbox" id="pb-pv-ortho"' +
      '        onchange="plateBuilder.setOrthoPv(this.checked)"> ortho</label>' +
      '      <label class="pvchk"><input type="checkbox" id="pb-pv-clash"' +
      '        onchange="plateBuilder.setClashPv(this.checked)">' +
      '        <span style="color:#dc2626">clash</span></label>' +
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
    document.getElementById('pb-exlist').innerHTML =
      '<table class="ext">' +
      '<colgroup><col class="cn"><col class="cd"><col class="cs"><col class="cb"></colgroup>' +
      '<thead><tr><th>example</th><th>what it shows</th>' +
      '<th class="sz">size</th><th></th></tr></thead><tbody>' +
      SAMPLES.map(function (s, i) {
        return '<tr onclick="plateBuilder.getSample(' + i + ')" title="' + esc(s.f) + '">' +
               '<td class="exn">' + esc(s.n) + '<i>' + esc(s.f) + '</i></td>' +
               '<td class="exd">' + esc(s.d) + '</td>' +
               '<td class="exs">' + esc(s.s || '') + '</td>' +
               '<td class="exbc"><span class="exb" id="pb-exb' + i + '">download</span></td>' +
               '</tr>';
      }).join('') + '</tbody></table>';
    var pal = document.getElementById('pb-pal');
    pal.innerHTML = SWATCHES.map(function (c) {
      return '<i style="background:' + c + '" onclick="plateBuilder.pickColor(\'' + c + '\')"></i>';
    }).join('');
    if (!pvRszWired) {                             // one listener, not one per run
      pvRszWired = true;
      var t = null;
      window.addEventListener('resize', function () {
        if (t) clearTimeout(t);
        t = setTimeout(pvResize, 150);
      });
    }
    window.addEventListener('mousedown', function (e) {
      if (palPending && !document.getElementById('pb-pal').contains(e.target)) closePalette();
    });
    // The example window covers the viewport, so its own backdrop click closes
    // it; Escape is the other way out people reach for.
    window.addEventListener('keydown', function (e) {
      if (exOpen && (e.key === 'Escape' || e.keyCode === 27)) closeSamples();
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
        pvReport(null);
        return;
      }
      if (d.btn !== 0) return;
      var snap = pvSnapAt(e);
      if (!snap) return;
      if (pvMeas.length >= 2) pvMeas = [];
      pvMeas.push({ x: snap.p.x, y: snap.p.y });
      drawPreview();
      pvReport(snap);
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
      pvReport(snap, x, y);
    });
    pvCv.addEventListener('mouseleave', function () {
      pvReport(null);                              // a finished span stays on screen
      if (pvBase && pvX) {
        var c2 = pvCv.getContext('2d');
        c2.clearRect(0, 0, pvX.W, pvX.H);
        c2.drawImage(pvBase, 0, 0);
      }
    });
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
    selKey = null; selGroup = null;      // a new model, so nothing is picked yet
    selBox = null;                       // the old scene took the helper with it
    folded = {};                         // and every assembly starts folded again

    var empty = data.__parsed ? !data.__parsed.assy.length : data.ASSY.length <= 1;
    buildDOM(data.title || 'PLATE3D',
             data.subtitle || '',
             data.note || (empty
               ? 'No data. Define PLATE/CUT/ASSY arrays as window.PLATE_DATA ' +
                 'or pass them to plateBuilder.run({...}) to display a model.'
               : null));

    var container = document.getElementById('pb-view');
    var w = container.clientWidth || 800, h = container.clientHeight || 600;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x15181c);
    mainAspect = w / h;
    camPersp = new THREE.PerspectiveCamera(MAIN_FOV, mainAspect, 1, 50000);
    camOrtho = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 50000);
    camPersp.up.set(0, 0, 1);                    // Z-up world
    camOrtho.up.set(0, 0, 1);
    camera = orthoView ? camOrtho : camPersp;
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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
    sceneBox = bbox.isEmpty() ? null : bbox.clone();
    // the corners of every member's own extent - what the views are fitted to
    sceneCloud = [];
    items.forEach(function (it) {
      var b;
      try { b = itemBox3(it); } catch (e) { return; }
      if (!b || b.isEmpty()) return;
      for (var i = 0; i < 8; i++)
        sceneCloud.push(new THREE.Vector3(i & 1 ? b.max.x : b.min.x,
                                          i & 2 ? b.max.y : b.min.y,
                                          i & 4 ? b.max.z : b.min.z));
    });
    if (!sceneCloud.length) sceneCloud = null;
    // VDIST is the fallback distance and what the clip planes are cut for, so
    // it has to cover the farthest of the four views, not just the one on show
    VDIST = size * 1.5 + 200;
    if (sceneCloud) {
      VDIST = 0;
      Object.keys(VIEWDIR).forEach(function (k) {
        VDIST = Math.max(VDIST, fitView(sceneCloud, viewOffset(k).negate(),
                                        camPersp.up, MAIN_FOV, mainAspect, CENTER).dist);
      });
    }
    setClip([camPersp, camOrtho], size, VDIST);

    var gspanMain = Math.ceil(size / 400) * 800;
    makeGrid(scene, gspanMain, 0x5e6875, 0x333b45);
    placeSun(sun, scene, bbox, size);

    var gz = buildGizmo();
    var axesScene = gz.scene, axesCamera = gz.camera;

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    setView('iso');

    // the sidebar must never be able to take the 3D view down with it
    try { buildHoleList(); } catch (e) { console.error('[plateBuilder] hole list: ' + e.message); }
    try { buildPlateList(colors); } catch (e) { console.error('[plateBuilder] plate list: ' + e.message); }
    try { buildBarList(); } catch (e) { console.error('[plateBuilder] bar list: ' + e.message); }
    try { buildSectList(); } catch (e) { console.error('[plateBuilder] section list: ' + e.message); }
    try { buildList(colors); } catch (e) { console.error('[plateBuilder] placed list: ' + e.message); }
    try { buildModuleList(); } catch (e) { console.error('[plateBuilder] module list: ' + e.message); }
    if (flatMode) document.getElementById('pb-flat').checked = true;
    document.getElementById('pb-ortho').checked = orthoView;
    document.getElementById('pb-clash').checked = showClash;
    if (showAxes) { document.getElementById('pb-axes').checked = true; updateSceneAxes(); }
    if (showFaces) { document.getElementById('pb-faces').checked = true; updateSceneFaces(); }
    if (showIds) { document.getElementById('pb-ids').checked = true; updateSceneIds(); }
    if (showClash) updateSceneClash();

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

    // The view is held at 16:9 and centred in the space the menu bar and the
    // list panel leave, so the framing is the same shape as the module preview
    // and does not shift when the window does.
    var wrap = document.getElementById('pb-viewwrap');
    var wcs = getComputedStyle(wrap);             // clientWidth counts the padding in
    var wpx = parseFloat(wcs.paddingLeft) + parseFloat(wcs.paddingRight);
    var wpy = parseFloat(wcs.paddingTop) + parseFloat(wcs.paddingBottom);
    var fitW = 0, fitH = 0;
    function fitRenderer() {                      // no-op while the pane has no size yet
      var aw = wrap.clientWidth - wpx, ah = wrap.clientHeight - wpy;
      if (!(aw > 0) || !(ah > 0)) return;
      var cw = Math.floor(Math.min(aw, ah * 16 / 9));
      var ch = Math.floor(cw * 9 / 16);
      if (cw < 2 || ch < 2 || (cw === fitW && ch === fitH)) return;
      fitW = cw; fitH = ch;
      container.style.width = cw + 'px';
      container.style.height = ch + 'px';
      mainAspect = cw / ch;
      applyMainCam();
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
      tickPx(scene, camera, fitH);                 // keep labels/axes a fixed pixel size
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
    var on = itemPicked(it);
    it.mat.color.setHex(col);
    it.mat.emissive.setHex(on ? SEL_GLOW : 0x000000);
    it.mat.opacity = op;
    it.mat.transparent = op < 1;
    it.mat.depthWrite = op >= 1;
    it.mat.needsUpdate = true;
    it.edgeMat.color.setHex(on ? SEL_COL : 0x0e1013);
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
      out = out.concat(snapPointsOf(it.rings, it.thk, it.matrix, it.spec));
    });
    out.push(new THREE.Vector3(0, 0, 0));          // the global origin measures too
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
    pvReport(null);
  }

  var sceneClash = null;
  function updateSceneClash() {
    if (sceneClash) { disposeScene(sceneClash); scene.remove(sceneClash); sceneClash = null; }
    if (!showClash) return;
    sceneClash = buildClash(scene, items.filter(function (it) { return it.groupObj.visible; }));
  }
  function setClash(on) {
    showClash = !!on;
    var cb = document.getElementById('pb-clash');
    if (cb) cb.checked = showClash;
    updateSceneClash();
  }
  function setClashPv(on) {
    showClashPv = !!on;
    var cb = document.getElementById('pb-pv-clash');
    if (cb) cb.checked = showClashPv;
    refreshPreview();
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
      var lg = pxGroup(ringsCenter(it.rings).applyMatrix4(it.matrix));
      lg.add(makeLabel(it.no, '#dfe6f0', 13));
      sceneIds.add(lg);
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
      sceneAxes.add(plateTriad(it.spec, it.matrix, 34, rp && rp.p, rp && rp.name));
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
    var keep = pvCtrl ? { pos: pvCtrl.object.position.clone(), tgt: pvCtrl.target.clone(),
                          zoom: pvCtrl.object.zoom,
                          viewH: pvCtrl.object.userData.viewH } : null;
    var home = pvHome;
    previewModule(pvModuleId);
    if (home) pvHome = home;
    if (keep && pvCtrl) {
      pvCtrl.object.position.copy(keep.pos);
      pvCtrl.target.copy(keep.tgt);
      pvCtrl.object.zoom = keep.zoom;             // ortho dollies by zoom, not distance
      if (keep.viewH) pvCtrl.object.userData.viewH = keep.viewH;
      fitCam(pvCtrl.object, pvAspect);
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
        if (obj.isMesh) {                          // a flat sheet has no inside
          obj.material.side = flatMode ? THREE.DoubleSide : THREE.FrontSide;
          obj.material.needsUpdate = true;
        }
      });
    });
    updateSceneFaces();
    refreshPreview();      // keep an open preview in sync
  }

  function sampleUrl(file) {
    var cut = engineSrc.lastIndexOf('/');
    return cut > 0 ? engineSrc.slice(0, cut + 1) + file : file;
  }
  // Example workbooks, all sitting next to this file. Add a row to put another
  // one on the menu; nothing else needs touching.
  /* One row each. `d` is a single line and is not allowed to wrap - the point of
     the list is to compare the examples at a glance and pick one, not to read a
     paragraph about each. The long version is the model itself. */
  var SAMPLES = [
    { f: 'PLATE3D_BASIC.xlsx', n: 'Basic', s: '76 rows → 90 members · 1.70 t',
      d: 'Every keyword once, in one real model. Start here.' },
    { f: 'PLATE3D_SAMPLE.xlsx', n: 'Sample', s: '38 rows → 48 members · 803 kg',
      d: 'ADD / MIR / COPY / ROT, one command per assembly.' },
    { f: 'PLATE3D_TOWER.xlsx', n: 'Tower crane', s: '347 rows → 575 members · 73.6 t',
      d: 'One mast panel and one jib bay become a whole crane.' },
    { f: 'PLATE3D_PORTAL.xlsx', n: 'Portal frame', s: '116 rows → 297 members · 20.0 t',
      d: 'Half a frame, mirrored and copied into a 30 m shed.' },
    { f: 'PLATE3D_NODE.xlsx', n: 'Bolted node', s: '59 rows → 46 members · 168 kg',
      d: 'A four-way beam connection: one arm, turned four ways.' },
    { f: 'PLATE3D_SPLICE.xlsx', n: 'Beam splice', s: '85 rows → 46 members · 376 kg',
      d: 'A bolted splice: an H made of plates, so CUT can drill it.' },
    { f: 'PLATE3D_TANK.xlsx', n: 'Tank', s: '54 rows → 16 members · 4.9 kg',
      d: 'Reverse-engineered from a five-sheet A4 drawing set.' },
    { f: 'PLATE3D_TURRET.xlsx', n: 'Turret', s: '56 rows → 12 members · 0.65 kg',
      d: 'A machined part: octagons, and a channel rolled on its axis.' }
  ];
  var exOpen = false;
  /* The picker is a window rather than a dropdown, so each example has room for
     what it actually demonstrates and how big it is - which is the thing that
     decides which one you want. It stays open after a download: reading the
     list, people usually take two. */
  function closeSamples() {
    var el = document.getElementById('pb-ex');
    if (el) el.style.display = 'none';
    exOpen = false;
  }
  function openSamples(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    var el = document.getElementById('pb-ex');
    if (!el) return;
    if (exOpen) { closeSamples(); return; }
    el.style.display = 'flex';
    el.querySelector('.box').scrollTop = 0;
    exOpen = true;
  }
  function exState(i, txt, cls) {
    var b = document.getElementById('pb-exb' + i);
    if (!b) return;
    b.textContent = txt;
    b.className = 'exb' + (cls ? ' ' + cls : '');
  }
  // Fetched into a blob rather than linked: a plain <a download> across origins
  // has its filename ignored and can open the sheet in the browser instead of
  // saving it. GitHub Pages, jsDelivr and same-origin all allow the fetch.
  function getSample(i) {
    var s = SAMPLES[i];
    if (!s) return;
    var url = sampleUrl(s.f);
    exState(i, '…');
    fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.blob();
    }).then(function (b) {
      var href = URL.createObjectURL(b);
      var a = document.createElement('a');
      a.href = href;
      a.download = s.f;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(href); }, 8000);
      exState(i, 'saved', 'ok');
      setTimeout(function () { exState(i, 'download'); }, 2600);
    }).catch(function (e) {
      exState(i, 'failed', 'bad');
      alert('Could not download ' + s.f + '.\n\n' + url + '\n' + e.message +
            '\n\nOpen that address directly to save it.');
    });
  }

  function openGuide() {
    var el = document.getElementById('pb-help');
    if (el) { el.style.display = 'flex'; el.querySelector('.doc').scrollTop = 0; }
  }
  function closeGuide() {
    var el = document.getElementById('pb-help');
    if (el) el.style.display = 'none';
  }
  function pickExcel() {
    var el = document.getElementById('pb-file');
    if (el) el.click();
  }

  window.plateBuilder = {
    run: run, setView: setView, exportSTL: exportSTL, exportIFC: exportIFC,
    exportBOQ: exportBOQ,
    toggleSection: toggleSection,
    selectGroup: selectGroup,
    toggleItem: toggleItem, toggleGroup: toggleGroup, toggleInst: toggleInst,
    toggleFold: toggleFold, selectRow: selectRow,
    pickExcel: pickExcel, loadExcelFile: loadExcelFile,
    preview: preview, previewModule: previewModule, closePreview: closePreview,
    setFlat: setFlat, setColor: setColor, setOpacity: setOpacity, fitPreview: pvFit,
    setMeasure: setMeasure, setMeasurePv: setMeasurePv, togglePvMember: togglePvMember,
    setIds: setIds, setIdsPv: setIdsPv, setFacesPv: setFacesPv,
    openPalette: openPalette, pickColor: pickColor, regenPreview: regenPreview,
    exportModuleSTL: exportModuleSTL, exportModuleIFC: exportModuleIFC,
    setAxes: setAxes, setFaces: setFaces,
    setOrtho: setOrtho, setOrthoPv: setOrthoPv,
    setClash: setClash, setClashPv: setClashPv,
    openGuide: openGuide, closeGuide: closeGuide,
    openSamples: openSamples, closeSamples: closeSamples, getSample: getSample,
    toggleMemberAxis: toggleMemberAxis
  };

  /* ---- auto-run: use window.PLATE_DATA if present, else empty default.
     Skipped when plateBuilder.run() was already called directly. ---- */
  /* ---- the model the viewer opens with ----
     PLATE3D_TOWER.xlsx as plain rows, so it takes the identical parse path an
     .xlsx does - no second grammar to keep in step. The rows are read back out
     of the shipped workbook rather than typed again, so the model a visitor
     opens with and the file they download cannot drift apart. A host page that
     sets window.PLATE_DATA still wins, and loading a sheet replaces it. */
  var DEMO_ROWS = [
    ["SECT","sc.mch","SM490",2400,"L","bl",150,150,14,14,14,7],
    ["SECT","sc.jch","SM490",3000,"L","bl",120,120,12,12,12,6],
    ["SECT","sc.cch","SM490",2600,"L","bl",110,110,10,10,10,5],
    ["SECT","sc.hlg","SM490",9500,"L","bl",130,130,12,12,12,6],
    ["SECT","sc.main","SM490",4600,"H","mc",700,300,300,14,22,22,24],
    ["SECT","sc.bfr","SM490",4800,"H","mc",600,250,250,12,19,19,22],
    ["SECT","sc.bcr","SM490",1400,"H","mc",400,200,200,9,14,14,16],
    ["BAR","bar.mh","SM490",70,1600],
    ["BAR","bar.md","SM490",60,2885],
    ["BAR","bar.lst","SS275",34,2400],
    ["BAR","bar.lrg","SS275",22,400],
    ["BAR","bar.strut","SM490",130,4300],
    ["BAR","bar.anb","SS400",48,180],
    ["BAR","bar.jbc","SM490",100,3000],
    ["BAR","bar.jth","SM490",70,1300],
    ["BAR","bar.jw","SM490",60,2200],
    ["BAR","bar.jpl","SM490",55,3300],
    ["BAR","bar.cbc","SM490",110,2600],
    ["BAR","bar.ch","SM490",65,1300],
    ["BAR","bar.cw","SM490",60,2000],
    ["BAR","bar.ht","SM490",70,1600],
    ["BAR","bar.hd","SM490",60,2400],
    ["BAR","bar.pen","SS540",70,26000],
    ["BAR","bar.hang","SM490",80,800],
    ["BAR","bar.rope","SS275",26,26000],
    ["BAR","bar.rail","SS275",34,4800],
    ["BAR","bar.post","SS275",40,1050],
    ["BAR","bar.shk","SM490",150,700],
    ["BAR","bar.axle","SM490",90,900],
    ["BAR","bar.barrel","SM490",420,1300],
    ["PLATE","pl.bped","SM490",50,"RECT","mc",1900,1900],
    ["PLATE","pl.fpl","SM490",60,"RECT","mc",900,900],
    ["PLATE","pl.ring","SM490",120,"CIRC","mc",2400],
    ["PLATE","pl.rinn","SM490",120,"CIRC","mc",1900],
    ["PLATE","pl.dk","SM490",30,"RECT","mc",3800,2600],
    ["PLATE","pl.gbx","SM490",350,"RECT","mc",650,500],
    ["PLATE","pl.hcap","SM490",40,"RECT","mc",900,900],
    ["PLATE","pl.hear","SM490",30,"TRAP","bl",1000,320,760,340],
    ["PLATE","pl.pap","SM490",40,"RECT","mc",900,500],
    ["PLATE","pl.jrt","SM490",25,"TRAP","bl",2050,900,1450,0],
    ["PLATE","pl.crt","SM490",25,"TRAP","bl",1750,800,1250,0],
    ["PLATE","pl.cwt","SM490",150,"RECT","mc",2100,1500],
    ["PLATE","pl.cwh","SM490",30,"RECT","mc",1300,900],
    ["PLATE","pl.mdk","SM490",10,"RECT","mc",5200,2000],
    ["PLATE","pl.dfl","SM490",50,"CIRC","mc",900],
    ["PLATE","pl.mot","SM490",380,"RECT","mc",650,550],
    ["PLATE","pl.cabf","SS275",6,"RECT","mc",1900,2080],
    ["PLATE","pl.cabs","SS275",6,"RECT","mc",1900,2180],
    ["PLATE","pl.cabg","GLASS",8,"RECT","mc",2080,2180],
    ["PLATE","pl.tfr","SM490",25,"RECT","mc",1400,1600],
    ["PLATE","pl.twh","SM490",90,"CIRC","mc",320],
    ["PLATE","pl.hbk","SM490",30,"TRAP","bl",1200,700,1000,250],
    ["PLATE","pl.shv","SM490",50,"CIRC","mc",620],
    ["PLATE","pl.hk","SM490",90,"TRAP","bl",900,250,1200,325],
    ["HOLE","ho.race","CIRC","mc",1700],
    ["HOLE","ho.bore","CIRC","mc",1500],
    ["HOLE","ho.anb","CIRC","mc",52],
    ["HOLE","ho.axle","CIRC","mc",95],
    ["HOLE","ho.pin","CIRC","mc",130],
    ["CUT","pl.ring",0,0,"ho.race"],
    ["CUT","pl.rinn",0,0,"ho.bore"],
    ["CUT","pl.fpl",-280,-280,"ho.anb",560,0,1],
    ["CUT","pl.fpl",-280,280,"ho.anb",560,0,1],
    ["CUT","pl.twh",0,0,"ho.axle"],
    ["CUT","pl.shv",0,0,"ho.axle"],
    ["CUT","pl.hear",760,420,"ho.pin"],
    ["CUT","pl.pap",0,0,"ho.pin"],
    ["MODULE","md.mast","sc.mch_1","",-800,-800,0,-800,-800,2400],
    ["MODULE","md.mast","sc.mch_2","",800,-800,0,800,-800,2400,"","",90],
    ["MODULE","md.mast","sc.mch_3","",800,800,0,800,800,2400,"","",180],
    ["MODULE","md.mast","sc.mch_4","",-800,800,0,-800,800,2400,"","",270],
    ["MODULE","md.mast","bar.mh_1","",-800,-850,2400,800,-850,2400],
    ["MODULE","md.mast","bar.mh_2","",850,-800,2400,850,800,2400],
    ["MODULE","md.mast","bar.mh_3","",800,850,2400,-800,850,2400],
    ["MODULE","md.mast","bar.mh_4","",-850,800,2400,-850,-800,2400],
    ["MODULE","md.mast","bar.md_1","",-800,-850,0,800,-850,2400,95,95],
    ["MODULE","md.mast","bar.md_2","",850,-800,0,850,800,2400,95,95],
    ["MODULE","md.mast","bar.md_3","",800,850,0,-800,850,2400,95,95],
    ["MODULE","md.mast","bar.md_4","",-850,800,0,-850,-800,2400,95,95],
    ["MODULE","md.mast","bar.lst_1","",520,-220,0,520,-220,2400],
    ["MODULE","md.mast","bar.lst_2","",520,220,0,520,220,2400],
    ["MODULE","md.mast","bar.lrg_1","",520,-220,400,520,220,400,25,25],
    ["MODULE","md.mast","bar.lrg_2","",520,-220,1200,520,220,1200,25,25],
    ["MODULE","md.mast","bar.lrg_3","",520,-220,2000,520,220,2000,25,25],
    ["MODULE","md.mast","BASE","sc.mch_1","bl"],
    ["MODULE","md.base","pl.bped","mc+",0,0,0,"XY"],
    ["MODULE","md.base","sc.bfr_1","",-2400,-2400,-400,2400,-2400,-400],
    ["MODULE","md.base","sc.bfr_3","",-2400,2400,-400,2400,2400,-400],
    ["MODULE","md.base","sc.bfr_2","",2400,-2400,-400,2400,2400,-400,140,140],
    ["MODULE","md.base","sc.bfr_4","",-2400,-2400,-400,-2400,2400,-400,140,140],
    ["MODULE","md.base","sc.bcr_1","",1000,0,-400,2400,0,-400,"",140],
    ["MODULE","md.base","sc.bcr_2","",0,1000,-400,0,2400,-400,"",140],
    ["MODULE","md.base","sc.bcr_3","",-1000,0,-400,-2400,0,-400,"",140],
    ["MODULE","md.base","sc.bcr_4","",0,-1000,-400,0,-2400,-400,"",140],
    ["MODULE","md.base","bar.strut_1","",-2400,-2400,0,-800,-800,3240,"",350],
    ["MODULE","md.base","bar.strut_2","",2400,-2400,0,800,-800,3240,"",350],
    ["MODULE","md.base","bar.strut_3","",2400,2400,0,800,800,3240,"",350],
    ["MODULE","md.base","bar.strut_4","",-2400,2400,0,-800,800,3240,"",350],
    ["MODULE","md.base","pl.fpl_1","mc+",-2400,-2400,-700,"XY"],
    ["MODULE","md.base","pl.fpl_2","mc+",2400,-2400,-700,"XY"],
    ["MODULE","md.base","pl.fpl_3","mc+",2400,2400,-700,"XY"],
    ["MODULE","md.base","pl.fpl_4","mc+",-2400,2400,-700,"XY"],
    ["MODULE","md.base","bar.anb_1","",-2680,-2680,-790,-2680,-2680,-670],
    ["MODULE","md.base","bar.anb_2","",-2120,-2680,-790,-2120,-2680,-670],
    ["MODULE","md.base","bar.anb_3","",-2680,-2120,-790,-2680,-2120,-670],
    ["MODULE","md.base","bar.anb_4","",-2120,-2120,-790,-2120,-2120,-670],
    ["MODULE","md.base","bar.anb_5","",2120,-2680,-790,2120,-2680,-670],
    ["MODULE","md.base","bar.anb_6","",2680,-2680,-790,2680,-2680,-670],
    ["MODULE","md.base","bar.anb_7","",2120,-2120,-790,2120,-2120,-670],
    ["MODULE","md.base","bar.anb_8","",2680,-2120,-790,2680,-2120,-670],
    ["MODULE","md.base","bar.anb_9","",2120,2120,-790,2120,2120,-670],
    ["MODULE","md.base","bar.anb_10","",2680,2120,-790,2680,2120,-670],
    ["MODULE","md.base","bar.anb_11","",2120,2680,-790,2120,2680,-670],
    ["MODULE","md.base","bar.anb_12","",2680,2680,-790,2680,2680,-670],
    ["MODULE","md.base","bar.anb_13","",-2680,2120,-790,-2680,2120,-670],
    ["MODULE","md.base","bar.anb_14","",-2120,2120,-790,-2120,2120,-670],
    ["MODULE","md.base","bar.anb_15","",-2680,2680,-790,-2680,2680,-670],
    ["MODULE","md.base","bar.anb_16","",-2120,2680,-790,-2120,2680,-670],
    ["MODULE","md.base","BASE","pl.bped","mc+"],
    ["MODULE","md.slew","pl.ring","mc-",0,0,0,"XY"],
    ["MODULE","md.slew","pl.rinn","mc-",0,0,120,"XY"],
    ["MODULE","md.slew","pl.dk","mc-",0,0,240,"XY"],
    ["MODULE","md.slew","sc.main_1","",-2300,-1150,620,2300,-1150,620],
    ["MODULE","md.slew","sc.main_2","",-2300,1150,620,2300,1150,620],
    ["MODULE","md.slew","pl.gbx","mc",-1500,0,590,"XY"],
    ["MODULE","md.slew","BASE","pl.ring","mc-"],
    ["MODULE","md.head","sc.hlg_1","",-800,-800,0,-250,-250,9630,"","",225],
    ["MODULE","md.head","sc.hlg_2","",800,-800,0,250,-250,9630,"","",225],
    ["MODULE","md.head","sc.hlg_3","",800,800,0,250,250,9630,"","",225],
    ["MODULE","md.head","sc.hlg_4","",-800,800,0,-250,250,9630,"","",225],
    ["MODULE","md.head","bar.ht_1","",-646,-796,2696.4,646,-796,2696.4,80,80],
    ["MODULE","md.head","bar.ht_2","",796,-646,2696.4,796,646,2696.4,80,80],
    ["MODULE","md.head","bar.ht_3","",646,796,2696.4,-646,796,2696.4,80,80],
    ["MODULE","md.head","bar.ht_4","",-796,646,2696.4,-796,-646,2696.4,80,80],
    ["MODULE","md.head","bar.ht_5","",-497.5,-647.5,5296.5,497.5,-647.5,5296.5,80,80],
    ["MODULE","md.head","bar.ht_6","",647.5,-497.5,5296.5,647.5,497.5,5296.5,80,80],
    ["MODULE","md.head","bar.ht_7","",497.5,647.5,5296.5,-497.5,647.5,5296.5,80,80],
    ["MODULE","md.head","bar.ht_8","",-647.5,497.5,5296.5,-647.5,-497.5,5296.5,80,80],
    ["MODULE","md.head","bar.ht_9","",-360,-510,7704,360,-510,7704,80,80],
    ["MODULE","md.head","bar.ht_10","",510,-360,7704,510,360,7704,80,80],
    ["MODULE","md.head","bar.ht_11","",360,510,7704,-360,510,7704,80,80],
    ["MODULE","md.head","bar.ht_12","",-510,360,7704,-510,-360,7704,80,80],
    ["MODULE","md.head","bar.hd_1","",-800,-950,0,646,-796,2696.4,90,110],
    ["MODULE","md.head","bar.hd_2","",950,-800,0,796,646,2696.4,90,110],
    ["MODULE","md.head","bar.hd_3","",800,950,0,-646,796,2696.4,90,110],
    ["MODULE","md.head","bar.hd_4","",-950,800,0,-796,-646,2696.4,90,110],
    ["MODULE","md.head","bar.hd_5","",-646,-796,2696.4,497.5,-647.5,5296.5,110,110],
    ["MODULE","md.head","bar.hd_6","",796,-646,2696.4,647.5,497.5,5296.5,110,110],
    ["MODULE","md.head","bar.hd_7","",646,796,2696.4,-497.5,647.5,5296.5,110,110],
    ["MODULE","md.head","bar.hd_8","",-796,646,2696.4,-647.5,-497.5,5296.5,110,110],
    ["MODULE","md.head","bar.hd_9","",-497.5,-647.5,5296.5,360,-510,7704,110,110],
    ["MODULE","md.head","bar.hd_10","",647.5,-497.5,5296.5,510,360,7704,110,110],
    ["MODULE","md.head","bar.hd_11","",497.5,647.5,5296.5,-360,510,7704,110,110],
    ["MODULE","md.head","bar.hd_12","",-647.5,497.5,5296.5,-510,-360,7704,110,110],
    ["MODULE","md.head","bar.hd_13","",-360,-510,7704,250,-400,9630,110,90],
    ["MODULE","md.head","bar.hd_14","",510,-360,7704,400,250,9630,110,90],
    ["MODULE","md.head","bar.hd_15","",360,510,7704,-250,400,9630,110,90],
    ["MODULE","md.head","bar.hd_16","",-510,360,7704,-400,-250,9630,110,90],
    ["MODULE","md.head","pl.hcap","mc-",0,0,9690,"XY"],
    ["MODULE","md.head","pl.hear_1","bl",-500,-220,9730,"XZ"],
    ["MODULE","md.head","pl.hear_2","bl",-500,220,9730,"XZ"],
    ["MODULE","md.head","pl.jrt_1","bl",150,-480,820,"XZ"],
    ["MODULE","md.head","pl.jrt_2","bl",150,480,820,"XZ"],
    ["MODULE","md.head","pl.crt_1","bl",-150,-480,820,"XZ",0,0,180],
    ["MODULE","md.head","pl.crt_2","bl",-150,480,820,"XZ",0,0,180],
    ["MODULE","md.head","bar.axle_1","",1750,-410,890,1750,410,890],
    ["MODULE","md.head","bar.axle_2","",-1600,-410,890,-1600,410,890],
    ["MODULE","md.head","BASE","sc.hlg_1","bl"],
    ["MODULE","md.jib","sc.jch_1","",0,650,1380,3000,650,1380,"","",90],
    ["MODULE","md.jib","sc.jch_2","",0,-650,1380,3000,-650,1380],
    ["MODULE","md.jib","bar.jbc","",0,0,0,3000,0,0],
    ["MODULE","md.jib","bar.jth","",3000,-650,1555,3000,650,1555],
    ["MODULE","md.jib","bar.jw_1","",0,650,1380,3000,0,0,90,200],
    ["MODULE","md.jib","bar.jw_2","",0,-650,1380,3000,0,0,90,200],
    ["MODULE","md.jib","bar.jw_3","",3000,650,1380,3000,0,0,60,110],
    ["MODULE","md.jib","bar.jw_4","",3000,-650,1380,3000,0,0,60,110],
    ["MODULE","md.jib","bar.jpl","",0,650,1555,3000,-650,1555,130,130],
    ["MODULE","md.jib","BASE","bar.jbc","mc"],
    ["MODULE","md.jtip","sc.jch_1","",0,650,1380,1600,160,1380,90,40,90],
    ["MODULE","md.jtip","sc.jch_2","",0,-650,1380,1600,-160,1380,90,40],
    ["MODULE","md.jtip","bar.jbc","",0,0,0,1600,0,1310,"",150],
    ["MODULE","md.jtip","bar.jw_1","",0,650,1380,880,0,720.5,90,190],
    ["MODULE","md.jtip","bar.jw_2","",0,-650,1380,880,0,720.5,90,190],
    ["MODULE","md.jtip","BASE","bar.jbc","mc"],
    ["MODULE","md.cjib","sc.cch_1","",0,650,1090,2600,650,1090,"","",90],
    ["MODULE","md.cjib","sc.cch_2","",0,-650,1090,2600,-650,1090],
    ["MODULE","md.cjib","bar.cbc","",0,0,0,2600,0,0],
    ["MODULE","md.cjib","bar.ch","",2600,-650,1250,2600,650,1250],
    ["MODULE","md.cjib","bar.cw_1","",0,650,1090,2600,0,0,90,280],
    ["MODULE","md.cjib","bar.cw_2","",0,-650,1090,2600,0,0,90,280],
    ["MODULE","md.cjib","bar.cw_3","",2600,650,1090,2600,0,0,60,110],
    ["MODULE","md.cjib","bar.cw_4","",2600,-650,1090,2600,0,0,60,110],
    ["MODULE","md.cjib","BASE","bar.cbc","mc"],
    ["MODULE","md.mach","pl.mdk","mc+",0,0,0,"XY"],
    ["MODULE","md.mach","bar.barrel","",-1370,0,620,-130,0,620],
    ["MODULE","md.mach","pl.dfl_1","mc",-1400,0,620,"YZ"],
    ["MODULE","md.mach","pl.dfl_2","mc",-100,0,620,"YZ"],
    ["MODULE","md.mach","pl.mot","mc",900,0,360,"YZ"],
    ["MODULE","md.mach","bar.post_1","",-2400,-950,0,-2400,-950,1050],
    ["MODULE","md.mach","bar.post_2","",-900,-950,0,-900,-950,1050],
    ["MODULE","md.mach","bar.post_3","",700,-950,0,700,-950,1050],
    ["MODULE","md.mach","bar.post_4","",2200,-950,0,2200,-950,1050],
    ["MODULE","md.mach","bar.rail_1","",-2400,-995,1020,2200,-995,1020],
    ["MODULE","md.mach","bar.rail_2","",-2400,-995,560,2200,-995,560],
    ["MODULE","md.mach","bar.post_5","",-2400,950,0,-2400,950,1050],
    ["MODULE","md.mach","bar.post_6","",-900,950,0,-900,950,1050],
    ["MODULE","md.mach","bar.post_7","",700,950,0,700,950,1050],
    ["MODULE","md.mach","bar.post_8","",2200,950,0,2200,950,1050],
    ["MODULE","md.mach","bar.rail_3","",-2400,995,1020,2200,995,1020],
    ["MODULE","md.mach","bar.rail_4","",-2400,995,560,2200,995,560],
    ["MODULE","md.mach","BASE","pl.mdk","mc+"],
    ["MODULE","md.cwt","pl.cwt_1","mc",0,0,0,"YZ"],
    ["MODULE","md.cwt","pl.cwt_2","mc",180,0,0,"YZ"],
    ["MODULE","md.cwt","pl.cwt_3","mc",360,0,0,"YZ"],
    ["MODULE","md.cwt","pl.cwt_4","mc",540,0,0,"YZ"],
    ["MODULE","md.cwt","pl.cwt_5","mc",720,0,0,"YZ"],
    ["MODULE","md.cwt","pl.cwh_1","mc",360,-790,1240,"XZ"],
    ["MODULE","md.cwt","pl.cwh_2","mc",360,790,1240,"XZ"],
    ["MODULE","md.cwt","bar.hang_1","",-40,-880,790,-40,-880,1600],
    ["MODULE","md.cwt","bar.hang_2","",760,-880,790,760,-880,1600],
    ["MODULE","md.cwt","bar.hang_3","",-40,880,790,-40,880,1600],
    ["MODULE","md.cwt","bar.hang_4","",760,880,790,760,880,1600],
    ["MODULE","md.cwt","BASE","pl.cwt_1","mc"],
    ["MODULE","md.cab","pl.cabf_1","mc",0,0,0,"XY"],
    ["MODULE","md.cab","pl.cabf_2","mc",0,0,2200,"XY"],
    ["MODULE","md.cab","pl.cabs_1","mc",0,-1050,1100,"XZ"],
    ["MODULE","md.cab","pl.cabs_2","mc",0,1050,1100,"XZ"],
    ["MODULE","md.cab","pl.cabg_1","mc",950,0,1100,"YZ"],
    ["MODULE","md.cab","pl.cabg_2","mc",-950,0,1100,"YZ"],
    ["MODULE","md.cab","BASE","pl.cabf_1","mc"],
    ["MODULE","md.trly","pl.tfr","mc",0,0,0,"XY"],
    ["MODULE","md.trly","pl.twh_1","mc",-480,-720,-200,"XZ"],
    ["MODULE","md.trly","pl.twh_2","mc",-480,720,-200,"XZ"],
    ["MODULE","md.trly","pl.twh_3","mc",480,-720,-200,"XZ"],
    ["MODULE","md.trly","pl.twh_4","mc",480,720,-200,"XZ"],
    ["MODULE","md.trly","bar.axle_1","",-480,-800,-200,-480,800,-200],
    ["MODULE","md.trly","bar.axle_2","",480,-800,-200,480,800,-200],
    ["MODULE","md.trly","BASE","pl.tfr","mc"],
    ["MODULE","md.hook","bar.shk","",0,0,0,0,0,-700],
    ["MODULE","md.hook","pl.hbk_1","bl",-600,-230,20,"XZ"],
    ["MODULE","md.hook","pl.hbk_2","bl",-600,230,20,"XZ"],
    ["MODULE","md.hook","pl.shv_1","mc",0,-150,520,"XZ"],
    ["MODULE","md.hook","pl.shv_2","mc",0,0,520,"XZ"],
    ["MODULE","md.hook","pl.shv_3","mc",0,150,520,"XZ"],
    ["MODULE","md.hook","bar.axle","",0,-205,520,0,205,520],
    ["MODULE","md.hook","pl.hk","bl",-450,0,-1910,"XZ"],
    ["MODULE","md.hook","bar.rope_1","",-380,-75,520,-380,-75,26020,300,60],
    ["MODULE","md.hook","bar.rope_2","",380,-75,520,380,-75,26020,300,60],
    ["MODULE","md.hook","bar.rope_3","",-380,75,520,-380,75,26020,300,60],
    ["MODULE","md.hook","bar.rope_4","",380,75,520,380,75,26020,300,60],
    ["MODULE","md.hook","BASE","bar.shk","mc"],
    ["MODULE","md.pend","pl.pap","mc",0,0,0,"XZ"],
    ["MODULE","md.pend","bar.pen_1","",0,-130,0,21400,-650,-7320,150,70],
    ["MODULE","md.pend","bar.pen_2","",0,130,0,21400,650,-7320,150,70],
    ["MODULE","md.pend","bar.pen_3","",21400,-650,-7320,45400,-650,-7320],
    ["MODULE","md.pend","bar.pen_4","",21400,650,-7320,45400,650,-7320],
    ["MODULE","md.pend","bar.pen_5","",0,-130,0,-13700,-650,-7830,150],
    ["MODULE","md.pend","bar.pen_6","",0,130,0,-13700,650,-7830,150],
    ["MODULE","md.pend","BASE","pl.pap","mc"],
    ["ASSY","as.base","md.base","ADD",0,0,1000],
    ["ASSY","as.mast","md.mast","ADD",-800,-800,1000],
    ["ASSY","as.mast","as.mast","COPY",0,0,2400,14],
    ["ASSY","as.turn","md.slew","ADD",0,0,37060],
    ["ASSY","as.turn","md.head","ADD",-800,-800,37370],
    ["ASSY","as.turn","md.cab","ADD",2400,0,35060],
    ["ASSY","as.jib","md.jib","ADD",1900,0,38140],
    ["ASSY","as.jib","as.jib","COPY",3000,0,0,14],
    ["ASSY","as.jib","md.jtip","ADD",46990,0,38140],
    ["ASSY","as.cjib","md.cjib","ADD",-1900,0,38140,0,0,180],
    ["ASSY","as.cjib","as.cjib","COPY",-2600,0,0,4],
    ["ASSY","as.cjib","md.mach","ADD",-7800,0,39470],
    ["ASSY","as.cjib","md.cwt","ADD",-13900,0,36540],
    ["ASSY","as.tie","md.pend","ADD",0,0,47520],
    ["ASSY","as.hoist","md.trly","ADD",30000,0,40020],
    ["ASSY","as.hoist","md.hook","ADD",30000,0,14000],
    ["END"]
  ];

  function autorun() {
    if (runToken) return;
    if (window.PLATE_DATA) { run(window.PLATE_DATA); return; }
    var parsed;
    try { parsed = parseExcelRows(DEMO_ROWS); }
    catch (e) { run({}); return; }              // never let the demo cost a viewer
    if (parsed.fatal) { run({}); return; }
    buildLog = [];
    run({ title: 'PLATE3D',
          subtitle: 'PLATE3D_TOWER · PLATE/CUT/ASSY · unit: mm',
          note: 'Built-in example. Load Excel opens your own sheet; ' +
                'Example downloads this one and the others to start from.',
          __parsed: parsed });
    showResult('PLATE3D_TOWER (built in)', parsed);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autorun);
  } else {
    setTimeout(autorun, 0);
  }
})();
