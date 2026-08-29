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

  /* The dimension style drawings are annotated with. These are the numbers at
     scale 1: paper millimetres, the size a length reads on a printed sheet.
     A drawing at 1:50 asks for dimStyle(50) and every one of them is multiplied,
     so the annotation prints the same size whatever the drawing is plotted at -
     which is the whole point of holding them here rather than at each call site.

     The letters are the ones on the style dialog's preview:
       A  gap between the measured point and where its extension line starts
       B  measured edge to the first dimension line
       C  one dimension line to the next, stacked
       D  how far the extension line runs past the dimension line
       E  arrow (here dot) size
       F  gap between the text and the dimension line
     They are AutoCAD's DIMEXO, DIMDLI, DIMEXE, DIMASZ and DIMGAP under other
     names, so a DXF written from this needs no translation table.

     `pick` is not scaled: those are choices, not lengths. */
  var DIMSTYLE = {
    origin:  10,     // A  Offset From Origin
    base:    10,     // B  Distance From Base to Dim
    stack:   10,     // C  Offset From Dim to Dim
    /* D. The dialog said 0.5, and at 0.5 it is invisible: the dot is 1.1 across,
       so it covers 0.55 either side of the dimension line and swallows the whole
       overshoot. D has to clear E/2 or there is nothing to see. 1.25 is
       AutoCAD's own DIMEXE default and leaves 0.7mm showing. */
    extend:  1.25,   // D  Extend Beyond Dim
    arrow:   1.1,    // E  Arrow Size
    textGap: 0.5,    // F  Text Offset From Dim
    /* Not on the dialog. E is a *dot* diameter and reads at 1.1; a filled
       triangle 1.1 long is a speck. Leaders point with a triangle - a dot says
       "this is a measured end", an arrow says "this thing here" - so the
       arrowhead has its own length. 2.5 is AutoCAD's own DIMASZ default. */
    leadArrow: 2.5,
    // and how far a leader's diagonal leg runs before it turns for its shoulder
    leadRun:   6.7,
    /* A and B again, for a dimension drawn **inside** an outline - what a CUT
       took out of a plate. The registered 10 + 10 stands a dimension line 20mm
       clear on paper, which is right in the open margin round a part and is
       most of a small plate's interior. Inside, 4 + 4. */
    innerOrigin: 4,
    innerBase:   4,
    // rebar marking: the bubble and the length bar beside it
    markLen:    100,
    markSize:   2.5,
    markRadius: 4,
    /* Text heights, also in paper millimetres - CAD height is these times the
       scale denominator, the same multiplication everything above gets. Held by
       what the text is for rather than as raw numbers, because that is the part
       that survives a change of scale: a dimension is 2.5 on the sheet whether
       the drawing is 1:10 or 1:100.
       Where practice gives a band the middle of it is taken; DIMSTYLE.md has
       the bands and the Korean names for each. */
    text: {
      dim:     2.5,   // dimensions and dimension lines
      note:    2.5,   // general notes                    practice allows 2.5 - 3.5
      member:  2.5,   // member names, main callouts      practice gives 3.5
      section: 5.0,   // section and detail titles
      heading: 6.0,   // major headings                   5 - 7
      title:   8.0    // sheet title                      7 - 10 and up
    },
    pick: {
      arrowHead: 'dot',          // dot | arrow | circle | oblique
      unit:      'dot',          // comma | dot | none    - thousands separator
      angle:     'dms',          // dms 00°00'00" | d1 00.0° | d3 00.000°
      spec:      'comma',        // comma | dot | none
      specForm:  '1 - PL - W x T x L',
      specAt:    'X',
      simpleMarking: false
    }
  };
  var DIMSTYLE_SCALED = ['origin', 'base', 'stack', 'extend', 'arrow', 'textGap',
                         'leadArrow', 'leadRun', 'innerOrigin', 'innerBase',
                         'markLen', 'markSize', 'markRadius'];
  // scale = the drawing's scale denominator: 50 for 1:50. Everything that is a
  // length comes back multiplied by it; `pick` is choices and comes back as is.
  // Rounded at the sixth decimal because binary floats do not multiply cleanly -
  // 1.1 * 50 is 55.00000000000001, and that is a number nobody wants to find
  // written into a DXF.
  function dimScale(v, s) { return Math.round(v * s * 1e6) / 1e6; }
  function dimStyle(scale) {
    var s = Number(scale);
    if (!(s > 0)) s = 1;
    var out = { scale: s, pick: DIMSTYLE.pick, text: {} };
    DIMSTYLE_SCALED.forEach(function (k) { out[k] = dimScale(DIMSTYLE[k], s); });
    Object.keys(DIMSTYLE.text).forEach(function (k) {
      out.text[k] = dimScale(DIMSTYLE.text[k], s);
    });
    return out;
  }
  /* The same style with the inside offsets in place of A and B. Only those two
     move: D, E and F are the size of a mark, not the room round it, and a
     dimension inside a plate is drawn with the same dot and the same text as
     one outside it. */
  function dimStyleInner(s) {
    var o = {}, k;
    for (k in s) if (Object.prototype.hasOwnProperty.call(s, k)) o[k] = s[k];
    o.origin = s.innerOrigin;
    o.base = s.innerBase;
    return o;
  }

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
    /* The pane holding the view has to STRETCH. Centring the body's items looked
       like the way to line the two boxes up, and instead locked the view at
       whatever size it first happened to take: the pane then had no height of
       its own, fitRenderer read the pane to size the view, and the pane was
       being sized by the view. The list gets the view's height in fitRenderer
       instead, and both sit at the top.

       Top, not centred, because the leftover height cannot be removed - it is
       (body - view)/2 above and below whatever the padding is, since 16:9 in a
       pane wider than 16:9 is width-limited. Centred, that white is split into
       two bands you look straight at; anchored, the drawing starts right under
       the toolbar and the whole remainder falls below, where it reads as the
       end of the page rather than as a gap. */
    '#pb-body { display:flex; flex:1 1 auto; min-height:0; gap:12px;',
    '  padding:10px 12px 12px; align-items:flex-start; }',
    '#pb-viewwrap { align-self:stretch; }',
    /* 320, not 380. Every pixel off the list is a pixel of width for the view,
       and the view's height follows its width at 16:9 - so a narrower list is
       the only thing that actually shrinks the leftover band. 320 still clears
       the longest line the panel holds, the placed-members total. */
    '#pb-side { width:320px; min-width:320px; overflow-y:auto; background:#fff;',
    '  border:1px solid var(--line); border-radius:10px; padding:11px 12px; }',
    '#pb-side::-webkit-scrollbar { width:6px; }',
    '#pb-side::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:4px; }',
    // the view sits at the top of its pane, not floating in the middle of it
    '#pb-viewwrap { flex:1 1 auto; min-width:0; display:flex;',
    '  align-items:flex-start; justify-content:center; }',
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
    // the whole heading line is the fold target, so it has to look like one
    '#pb-side tr.ghead td.sechd { cursor:pointer; -webkit-user-select:none;',
    '  user-select:none; }',
    '#pb-side tr.ghead td.sechd:hover .sname { color:#1d4ed8; }',
    '#pb-side tr.ghead td.sechd:hover .fold { opacity:.72; }',
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

    /* ---- the two menu buttons: File and View, one size so they read as a pair
       and the bar starts with a block rather than a row of loose buttons ---- */
    '.fmenu { position:relative; display:inline-block; }',
    /* Matched to the Example button at the far end of the bar - same 102 wide,
       same 12px type, so the two ends of the row are the same size. Wider than
       the toggles between them, not taller. */
    '#pb-bar .fmenu > button { min-width:102px; font-size:12px; font-weight:600;',
    '  text-transform:none; letter-spacing:0; }',
    // the view being looked through, marked in the list the way the row of
    // buttons used to mark it
    '#pb-bar .fmenu .drop button.vw.active { color:var(--dim); font-weight:700;',
    '  background:#eff6ff; }',
    '.fmenu .car { font-size:9px; margin-left:3px; opacity:.85; }',
    '.fmenu .drop { display:none; position:absolute; left:0; top:calc(100% + 5px);',
    '  z-index:60; background:#fff; border:1px solid var(--line); border-radius:8px;',
    '  box-shadow:0 10px 28px rgba(15,23,42,.18); padding:6px; min-width:200px; }',
    '.fmenu.open .drop { display:block; }',
    // a menu you reach for on every save, so the rows are a comfortable target
    // rather than the tightest thing the text will fit in
    // #pb-bar button carries an id, so these have to as well or the bar's own
    // padding and 10.5px type win and the rows stay 24px tall
    '#pb-bar .fmenu .drop button { display:block; width:100%; text-align:left;',
    '  border:none; background:none; box-shadow:none; padding:11px 13px;',
    '  border-radius:6px; font-size:12.5px; font-weight:600; letter-spacing:.02em;',
    '  line-height:1.2; text-transform:none; color:#334155; }',
    '#pb-bar .fmenu .drop button:hover { background:#f1f5f9; color:#0f172a;',
    '  box-shadow:none; }',
    '#pb-bar .fmenu .drop button:active { transform:none; }',
    '.fmenu .drop i { display:block; height:1px; background:var(--hair); margin:5px 7px; }',

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
    /* A chapter number, and a rule under the title. The bar that used to stand
       beside a heading lost the page to the dark table head below it - the eye
       went to the table and the title stopped saying what was being read. */
    '#pb-help h2 { font-size:16.5px; font-weight:700; color:#0f172a; margin:34px 0 10px;',
    '  display:flex; align-items:center; padding-bottom:7px;',
    '  border-bottom:2px solid var(--line); }',
    '#pb-help h2 .n { display:inline-flex; align-items:center; justify-content:center;',
    '  min-width:25px; height:25px; padding:0 6px; margin-right:10px; flex-shrink:0;',
    '  background:var(--dim); color:#fff; border-radius:6px;',
    '  font-size:13px; font-weight:700; }',
    /* Every keyword is an h3, so this is the level a reader is actually inside
       while reading a table - and a bare bold line was losing to the dark table
       head under it. It gets a rule of its own and a badge, both lighter than a
       chapter's, so the two levels still read as two levels. */
    '#pb-help h3 { font-size:14.5px; font-weight:700; color:#0f172a; margin:26px 0 8px;',
    '  letter-spacing:.01em; display:flex; align-items:center;',
    '  padding-bottom:5px; border-bottom:1px solid var(--hair); }',
    '#pb-help h3 .n { display:inline-flex; align-items:center; justify-content:center;',
    '  min-width:34px; height:20px; padding:0 6px; margin-right:9px; flex-shrink:0;',
    '  background:#e0e7ff; color:var(--dim); border-radius:5px;',
    '  font-size:11.5px; font-weight:700; font-variant-numeric:tabular-nums; }',
    '#pb-help h3.warnhead { border-bottom-color:#fcd34d; }',
    '#pb-help h3.warnhead .n { background:#fef3c7; color:#b45309; }',
    // the contents, off the headings themselves
    '#pb-toc { margin:14px 0 6px; padding:12px 16px; background:#f8fafc;',
    '  border:1px solid var(--hair); border-radius:8px; }',
    '#pb-toc b { display:block; font-size:12px; font-weight:700; color:#0f172a;',
    '  margin-bottom:7px; letter-spacing:.04em; text-transform:uppercase; }',
    '#pb-toc ol { list-style:none; margin:0; padding:0;',
    '  columns:2; column-gap:26px; }',
    '#pb-toc li { margin:1px 0; break-inside:avoid; font-size:12px; }',
    '#pb-toc li.b { padding-left:15px; }',
    '#pb-toc a { color:#475569; text-decoration:none; white-space:pre; }',
    '#pb-toc li.a a { color:#0f172a; font-weight:600; }',
    '#pb-toc a:hover { color:var(--dim); text-decoration:underline; }',
    /* Pushed to the right end of the heading by the flex row it sits in. Quiet
       until the heading is under the pointer - it is a way out, not something
       to read on the way past. */
    '#pb-help h2 .up, #pb-help h3 .up { margin-left:auto; flex-shrink:0;',
    '  font-size:11px; font-weight:600; letter-spacing:.02em; text-decoration:none;',
    '  color:#cbd5e1; padding:2px 8px; border-radius:5px; border:1px solid transparent;',
    '  transition:color .12s,background .12s,border-color .12s; }',
    '#pb-help h2:hover .up, #pb-help h3:hover .up { color:#64748b; }',
    '#pb-help h2 .up:hover, #pb-help h3 .up:hover { color:var(--dim);',
    '  background:#eef2ff; border-color:#c7d2fe; }',
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
  function plateGeom(shape, thk, caps) {      // local plane = mid-thickness
    if (flatMode) return new THREE.ShapeGeometry(shape);
    var g = new THREE.ExtrudeGeometry(shape, { depth: thk, bevelEnabled: false, curveSegments: 24 });
    g.translate(0, 0, -thk / 2);
    return shearGeom(g, caps);
  }
  /* Lay the two end caps of an extrusion onto their planes. Every vertex an
     ExtrudeGeometry makes sits at exactly one of the two z levels, the side
     walls included, so moving each one to the plane of the end it belongs to
     leaves the triangulation alone - holes, fillets and cut outlines all come
     through as they were, and the result is still a closed solid, because a
     side wall is a plane that contains both of its edges however they lean.
     This is what makes an angled cut cost no solid modeller: the profile was
     never the problem, only where the extrusion was allowed to stop. */
  function shearGeom(g, caps) {
    if (!caps || (!caps.b && !caps.e)) return g;
    var pos = g.getAttribute('position');
    for (var i = 0; i < pos.count; i++) {
      var c = pos.getZ(i) >= 0 ? caps.e : caps.b;
      if (c) pos.setZ(i, c.a * pos.getX(i) + c.b * pos.getY(i) + c.c);
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }
  var scene, camera, renderer, controls;
  // Two main-view cameras, swapped by the ortho checkbox. Only one is ever the
  // live `camera`; the other keeps its last framing so the toggle round-trips.
  var camPersp = null, camOrtho = null, orthoView = false;
  var MAIN_FOV = 40, mainAspect = 1.6;
  var lastPlates = {}, lastCuts = [], lastColors = {}, lastParts = {};  // for preview modals
  var lastViews = [];                   // VIEW rows, read by Save DXF
  var lastPlots = [];                   // PLOT rows, read by Save DXF
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
                                              (steel section, TYPE = H / C / L / P / R.
                                               The values run straight on with no gaps
                                               and each type has its own list:
                                                 H : h bb bt tw tf1 tf2 r1 r2
                                                     tf1 = bottom flange, tf2 = top
                                                 C : h b tw tf rw rf
                                                     rw = web root, rf = flange toe
                                                 L : a b t1 t2 r1 r2
                                                     t1 = a leg, t2 = b leg
                                                 P : d t          round tube
                                                     d over the outside, t the wall
                                                 R : h b t r      rectangular tube
                                                     r = OUTER corner; the inner one
                                                     is r - t and is not asked for
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
                                               A bar has no Ref.Pt: it STARTS at the
                                               point given and runs its Length along that
                                               plane's thickness axis - XY +Z, XZ -Y,
                                               YZ +X. The signs are what keep each plane
                                               right-handed and are not a choice.
                                               The older "ID Dia Length" order is still
                                               read)
       BOLT  ID MAT Dia Length [Hole] [head_af] [head_h] [nut_af] [nut_h] [proj]
                                              (a BAR that knows it is a bolt. The point
                                               on the MODULE row is the UNDERSIDE OF THE
                                               HEAD - the steel face the bolt pulls
                                               against - so the head stands off behind
                                               it, the shank runs Length forward and the
                                               nut sits at the far end, inside the
                                               Length, with `proj` the thread left
                                               showing past it - 0.2d unless said, because
                                               a bolt run out flush with its nut has been
                                               cut short. So Length is grip + nut + proj.
                                               Turn one round
                                               with the ROT columns: 180 about the axis
                                               across it.
                                               Only the first four are needed. The rest
                                               come off the diameter, at the ISO hex
                                               ratios: across-flats 1.5d, head 0.625d,
                                               nut 0.9d, hole d+2. A high-strength bolt
                                               is bigger than that, which is why each
                                               one can be typed)
       CUT   plateID L.X L.Y shapeID dx dy repeat [dx2 dy2 repeat2]
                                              (put shapeID - a HOLE, or another PLATE's
                                               outline - on the plate at L.X/L.Y, both
                                               measured from the plate's own origin.
                                               The shape lands by its BASE.pt)
                                              (repeat = extra copies, each offset by
                                               dx,dy from the previous one; 0/blank = none)
                                              (dx2/dy2/repeat2 step that whole row
                                               sideways, so one line lays a grid. Blank
                                               = one row, as before. A bolt pattern is
                                               one CUT row however many bolts it holds,
                                               and both counts may be formulas)
                                              (the target plate must already be defined;
                                               the shape may be defined anywhere)
       -- older CUT rows, shape and its values last, are still read:
          CUT [plateID] [refPt] L.X L.Y dx dy repeat  RECT B H | CIRC D | PLATE ID
          (those place the shape by its centre)
       -- older still, shape first:
          CUT [plateID] [refPt] RECT B H L.X L.Y L.ROT dx dy repeat
          (those place RECT/PLATE by their lower-left corner)
       -- dx2/dy2/repeat2 may end any of the three, after that form's own
          last value
       -- legacy PLATE rows with no shape keyword are still read, the shape
          taken from the values:  PLATE ID WT WB H OFF_TOP [OFF_B] THK MAT
                                  PLATE ID B H THK MAT
       MODULE ID PLATE.ID REF.PT L.X L.Y L.Z PLANE [ROT.X ROT.Y ROT.Z]
              [dx dy dz repeat] [dx2 dy2 dz2 repeat2]
                                              (one row per member: the plate's
                                               REF.PT lands on module-local L.X/L.Y/L.Z,
                                               PLANE is the plane it lies on and ROT.X/Y/Z
                                               spin it about that point. Rows with the
                                               same module ID accumulate; PART = alias)
                                              (the two repeat axes work like a CUT
                                               row's: dx/dy/dz stepped `repeat` more
                                               times, and dx2/dy2/dz2 stepping that
                                               whole row sideways `repeat2` more. Left
                                               blank it is one member, as before. Copies
                                               take the same name and are numbered
                                               name_1, name_2 … - so BASE wants the
                                               number, not the bare name)
                                              (a blank member id is a row switched off,
                                               skipped without a word - which is what
                                               lets a count on a front sheet decide how
                                               many there are)
                                               Legacy order PLANE REF.PT L.X L.Y L.ROT
                                               OFFSET is still read - detected from
                                               whether column 3 is a plane name)
       MODULE ID BAR/SECT.ID REF.PT LX1 LY1 LZ1 LX2 LY2 LZ2 [OFF_B OFF_E ALPHA]
              [dx dy dz repeat] [dx2 dy2 dz2 repeat2]
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
                                              (the same two repeat axes, in the same
                                               eight columns after ALPHA: a copy moves
                                               both ends together, so it keeps the
                                               direction, the length and the trims)
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
       VIEW  ID FROM [title]                  (a drawing, for Save DXF. ID names a MODULE
                                               or an ASSY. FROM is one of
                                               FRONT / BACK / LEFT / RIGHT / TOP / BOTTOM,
                                               an isometric corner named for where the
                                               viewer stands - ISO / ISO-SE / ISO-SW /
                                               ISO-NW / ISO-NE, ISO being SE - or the word
                                               3D, which takes two more columns. The title
                                               is what is written over the drawing.
                                               No VIEW rows, no VIEWS block - the scale
                                               is asked for in the dialog like the others)
       VIEW  ID 3D AZ EL [title]              (the same drawing seen from any direction.
                                               AZ walks the viewer round the model in the
                                               ground plane, from +X (east) anticlockwise;
                                               EL lifts them off it, -90 to 90. World Z
                                               stays upright on the page, so a column
                                               draws vertical at every angle.
                                                 FRONT  -90   0     RIGHT    0   0
                                                 BACK    90   0     LEFT   180   0
                                                 TOP      0  90     BOTTOM   0 -90
                                                 ISO    -45  35.26)
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
    // a CUT row lays repeat x repeat2 copies and every one is a boolean
    // subtraction, so the two counts together have a ceiling of their own
    var MAX_CUT_REP = 2000;
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
    var counts = { plate: 0, hole: 0, bar: 0, sect: 0, bolt: 0, cut: 0, module: 0,
                   assy: 0, view: 0, plot: 0, fit: 0 };
    var views = [];                      // VIEW rows: drawings the sheet asked for
    var plots = [];                      // PLOT rows: the parts it asked to be drawn
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
    /* FIT <member> B|E <target> [GAP] - cut one end of a member to the face it
       runs into. The sheet names who it lands on; which face, and at what
       angle, is read off the model. Both spellings are taken, the same two the
       BASE row has: as a MODULE row, and on its own inside a block. */
    function addFit(part, v, r) {
      var fno = str(v[0]).toUpperCase(), fend = str(v[1]).toUpperCase().charAt(0);
      var fto = str(v[2]).toUpperCase();
      if (!fno || !fto) {
        warn('row ' + (r + 1) + ': FIT needs a member, an end (B or E) and the member ' +
             'to cut it against');
        return;
      }
      if (fend !== 'B' && fend !== 'E') {
        warn('row ' + (r + 1) + ': FIT ' + fno + ' — the end must be B (start) or E (end), ' +
             'found ' + (str(v[1]) || '(blank)'));
        return;
      }
      part.fits.push({ NO: fno, END: fend, TO: fto, GAP: num(v[3], 0), ROW: r + 1 });
      counts.fit++;
    }
    function resolvePlate(pid) {          // exact id, or instance suffix PL.C1_2 → PL.C1
      if (plates[pid]) return pid;
      var sfx = pid.match(/^(.+?)[_-]\d+$/);
      if (sfx && plates[sfx[1]]) return sfx[1];
      return null;
    }
    /* ---- the two repeat axes a MODULE row carries ----
       Both placement forms end in the same eight cells, so both read them the
       same way: dx dy dz repeat, then dx2 dy2 dz2 repeat2, starting at column
       k. What comes back is one offset per copy, the original included, so the
       caller only has to add it to whatever it calls a position.
       They exist for the reason the CUT row's do: a bolt pattern is one line of
       sheet whatever it holds, and its counts can be formulas. A formula cannot
       add a row, so without a repeat the number of members is fixed the moment
       the file is written and a front sheet cannot change it.
       Copies are numbered downstream, where a name used twice already becomes
       name_1, name_2 - so nothing else has to know. */
    function modSteps(v, k, tag, r) {
      var d1 = [num(v[k], 0), num(v[k + 1], 0), num(v[k + 2], 0)], n1 = num(v[k + 3], 0);
      var d2 = [num(v[k + 4], 0), num(v[k + 5], 0), num(v[k + 6], 0)], n2 = num(v[k + 7], 0);
      function say(m) { hint('row ' + (r + 1) + ': MODULE ' + tag + ' ' + m); }
      if ((d1[0] || d1[1] || d1[2]) && n1 < 1)
        say('has dx/dy/dz but repeat is 0/empty — no copy is made');
      if ((d2[0] || d2[1] || d2[2]) && n2 < 1)
        say('has dx2/dy2/dz2 but repeat2 is 0/empty — the second row is not laid');
      if (n1 >= 1 && !d1[0] && !d1[1] && !d1[2])
        say('has repeat but no dx/dy/dz — the copies land on top of each other');
      var made = (n1 + 1) * (n2 + 1);
      if (made > MAX_CUT_REP) {
        warn('row ' + (r + 1) + ': MODULE ' + tag + ' asks for ' + made +
             ' copies, past the ' + MAX_CUT_REP + ' limit — only the first are placed.');
        n1 = Math.min(n1, MAX_CUT_REP - 1);
        n2 = Math.min(n2, Math.floor(MAX_CUT_REP / (n1 + 1)) - 1);
      }
      var out = [];
      for (var j = 0; j <= n2; j++)
        for (var i = 0; i <= n1; i++)
          out.push([i * d1[0] + j * d2[0], i * d1[1] + j * d2[1], i * d1[2] + j * d2[2]]);
      return out;
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
      } else if (kw === 'BOLT') {
        /* BOLT ID MAT Dia Length [Hole] [head_af] [head_h] [nut_af] [nut_h]

           A BAR that knows it is a bolt. The engine can then do what a bar
           cannot: work out which members its axis passes through and put a
           hole on each of their part drawings, so the hole is written once -
           as the bolt - instead of twice.

           The point given on the MODULE row is the UNDERSIDE OF THE HEAD,
           which is the face of the steel the bolt is pulled against and the
           one number a detailer actually knows. The head stands off behind it,
           the shank runs Length forward, the nut sits at the far end. To turn
           a bolt round, rotate it 180 with the ROT columns the MODULE row
           already has - no extra column for something the sheet can say.

           Only the first four values are needed. The rest come off the
           diameter, and the ratios are the ISO hex ones rather than a table:
           across-flats 1.5d is 24 at M16 and 30 at M20, head height 0.625d is
           10 and 12.5, nut height 0.9d is 14.4 and 18. High-strength
           structural bolts are bigger than that - an M20 F10T head is 32
           across - which is exactly why every one of them can be typed. */
        var idb2 = str(v[0]).toUpperCase();
        if (!idb2) continue;
        var bd = num(v[2], 0), bl = num(v[3], 0);
        var bolt = { ID: idb2, SHAPE: 'CIRC', __bar: true, __bolt: true, BASEPT: 'mc',
                     MAT: str(v[1]), D: bd, THK: bl,
                     HOLE: num(v[4], 0) || bd + 2,
                     HAF:  num(v[5], 0) || bd * 1.5,
                     HH:   num(v[6], 0) || bd * 0.625,
                     NAF:  num(v[7], 0) || num(v[5], 0) || bd * 1.5,
                     NH:   num(v[8], 0) || bd * 0.9,
                     /* num(v, dflt) and not the `|| default` the others use,
                        because 0 is a real answer here: it means the nut's
                        outer face IS the shank's end. Blank means "the usual
                        bit of thread", typed 0 means none. */
                     PROJ: num(v[9], bd * 0.2) };
        var be = [];
        if (!(bd > 0)) be.push('Dia is blank or not a positive number');
        if (!(bl > 0)) be.push('Length is blank or not a positive number');
        if (bd > 0 && bolt.HOLE < bd) be.push('the hole (' + bolt.HOLE + ') is smaller than the bolt (' + bd + ')');
        if (bd > 0 && bolt.HAF <= bd) be.push('the head (' + bolt.HAF + ' across) is not bigger than the shank');
        if (be.length) {
          be.forEach(function (m) { warn('row ' + (r + 1) + ': BOLT ' + idb2 + ' — ' + m); });
          continue;
        }
        if (holes[idb2]) warn('row ' + (r + 1) + ': BOLT ' + idb2 + ' reuses a HOLE id');
        plates[idb2] = bolt;
        current = idb2;
        counts.bolt = (counts.bolt || 0) + 1;
      } else if (kw === 'SECT') {
        // SECT ID MAT Length TYPE BASE.pt <values>
        // The values run straight on with no gaps, and each type has its own
        // list - a C and an L happen to take the same count but not the same
        // meaning, so they are read per type rather than from one shared set:
        //   H : h bb bt tw tf1 tf2 r1 r2      (tf1 = bottom, tf2 = top)
        //   C : h b tw tf rw rf               (rw = web root, rf = flange toe)
        //   L : a b t1 t2 r1 r2               (t1 = a leg, t2 = b leg)
        //   P : d t                           round tube, d over the outside
        //   R : h b t r                       rectangular tube, r = OUTER corner
        // P and R are hollow. Their two extra rules are worth saying once:
        // the wall is uniform, so a rectangular tube's inner corner is r - t
        // and is not asked for; and r left blank is a square corner, exactly
        // as leaving an H's r1 blank gives a square root.
        var ids = str(v[0]).toUpperCase();
        if (!ids) continue;
        var st = str(v[3]).toUpperCase();
        if (st === 'I') st = 'H';
        // The names a fabricator would write. CHS/SHS/RHS are the standards'
        // own, PIPE and BOX are what people say.
        if (st === 'PIPE' || st === 'CHS' || st === 'O') st = 'P';
        if (st === 'BOX' || st === 'RHS' || st === 'SHS') st = 'R';
        if (!SECT_FIELDS[st]) {
          warn('row ' + (r + 1) + ': SECT ' + ids +
               ' — TYPE must be H, C, L, P or R, found ' +
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
        /* The second repeat axis, which every CUT grammar ends with: dx2 dy2
           repeat2, three more columns that step the whole first row sideways.
           One row lays a grid, so a bolt pattern is one line of sheet however
           many bolts it holds - and the count can be a formula, which is what
           lets a front sheet drive it. Left blank it is the 1D repeat as
           before, so no existing sheet changes. */
        function cutAxis2(c, w, k) {
          c.DX2 = num(w[k], 0); c.DY2 = num(w[k + 1], 0); c.REP2 = num(w[k + 2], 0);
        }
        /* Both axes warn the same way. Steps with no count make nothing, a
           count with no step stacks copies on the spot - either is a column
           out of line far more often than it is what was meant. */
        function cutRepHint(c, target, extra) {
          function say(m) {
            hint('row ' + (r + 1) + ': CUT on ' + target + ' ' + m +
                 (extra ? ' ' + extra : ''));
          }
          if ((num(c.DX, 0) || num(c.DY, 0)) && num(c.REP, 0) < 1)
            say('has dx/dy but repeat is 0/empty — no copy is made' +
                ' (repeat = how many extra copies)');
          if ((num(c.DX2, 0) || num(c.DY2, 0)) && num(c.REP2, 0) < 1)
            say('has dx2/dy2 but repeat2 is 0/empty — the second row is not laid');
          if (num(c.REP2, 0) >= 1 && !num(c.DX2, 0) && !num(c.DY2, 0))
            say('has repeat2 but no dx2/dy2 — the copies land on top of each other');
          /* Two counts multiply, and both can be formulas, so a slip on the
             front sheet is a grid of a million holes rather than a row of ten
             too many. Every instance is a boolean subtraction; the row is cut
             back to a size the shape engine can finish. */
          var made = (num(c.REP, 0) + 1) * (num(c.REP2, 0) + 1);
          if (made > MAX_CUT_REP) {
            warn('row ' + (r + 1) + ': CUT on ' + target + ' asks for ' + made +
                 ' copies, past the ' + MAX_CUT_REP + ' limit — only the first ' +
                 MAX_CUT_REP + ' are cut. Check repeat and repeat2.');
            c.REP = Math.min(num(c.REP, 0), MAX_CUT_REP - 1);
            c.REP2 = Math.min(num(c.REP2, 0),
                              Math.floor(MAX_CUT_REP / (num(c.REP, 0) + 1)) - 1);
          }
        }
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
        /* A row switched off from a front sheet. Every CUT has to name a shape -
           a keyword or an id - so a row with nothing but numbers left on it has
           had that name computed away, which is a formula sheet saying "not this
           one" rather than a mistake. It is skipped without a word: a workbook
           that lays out the most bolts anyone might ask for and turns the rest
           off would otherwise report its own spare capacity as errors. */
        if (!v.some(function (x) {
              var t = str(x);
              return t !== '' && !isNum(t);
            })) continue;
        var c = { PLATE: target, REFPT: refpt, __xlCut: true };
        // Current grammar: CUT <plate> L.X L.Y <shape id> dx dy repeat dx2 dy2 repeat2.
        // The shape is a HOLE (or another PLATE) defined elsewhere, so the row
        // is a fixed width. L.X/L.Y are measured from the plate's own origin -
        // its BASE.pt - and the shape is placed by its BASE.pt.
        if (!isCutType(sub) && str(v[2]) !== '' && !isNum(v[2])) {
          c.U = num(v[0], 0); c.V = num(v[1], 0);
          c.TYPE = 'REF'; c.REF = str(v[2]).toUpperCase();
          c.DX = num(v[3], 0); c.DY = num(v[4], 0); c.REP = num(v[5], 0);
          cutAxis2(c, v, 6);
          c.ANG = 0; c.__org = true;
          cutRepHint(c, target);
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
          // dx2/dy2/repeat2 follow the shape's own values, so where they start
          // depends on how many the shape took: two for RECT, one for the rest.
          if (ct === 'RECT') {
            c.TYPE = 'TRAP'; c.B = num(v[6], 0); c.TW = c.B; c.H = num(v[7], 0); c.OF = 0;
            cutAxis2(c, v, 8);
          } else if (ct === 'CIRC') {
            c.TYPE = 'CIRC'; c.D = num(v[6], 0);
            cutAxis2(c, v, 7);
          } else if (ct === 'PLATE') {
            c.TYPE = 'REF'; c.REF = str(v[6]).toUpperCase();
            cutAxis2(c, v, 7);
          } else {
            warn('row ' + (r + 1) + ': CUT on ' + target + ' — expected RECT / CIRC / PLATE' +
                 ' after L.X, L.Y, dx, dy, repeat, found ' + (str(v[5]) || '(blank)'));
            continue;
          }
          cutRepHint(c, target);
          cuts.push(c);
          counts.cut++;
          continue;
        }
        if (sub === 'RECT') {
          c.TYPE = 'TRAP'; c.B = num(v[1], 0); c.TW = c.B; c.H = num(v[2], 0); c.OF = 0;
          c.U = num(v[3], 0); c.V = num(v[4], 0); c.ANG = num(v[5], 0);
          c.DX = num(v[6], 0); c.DY = num(v[7], 0); c.REP = num(v[8], 0);
          cutAxis2(c, v, 9);
        } else if (sub === 'CIRC') {
          c.TYPE = 'CIRC'; c.D = num(v[1], 0);
          c.U = num(v[2], 0); c.V = num(v[3], 0); c.ANG = num(v[4], 0);
          c.DX = num(v[5], 0); c.DY = num(v[6], 0); c.REP = num(v[7], 0);
          cutAxis2(c, v, 8);
        } else if (sub === 'PLATE') {
          c.TYPE = 'REF'; c.REF = str(v[1]).toUpperCase();
          c.U = num(v[2], 0); c.V = num(v[3], 0); c.ANG = num(v[4], 0);
          c.DX = num(v[5], 0); c.DY = num(v[6], 0); c.REP = num(v[7], 0);
          cutAxis2(c, v, 8);
        } else { warn('row ' + (r + 1) + ': unknown CUT type ' + sub); continue; }
        cutRepHint(c, target, 'Check the column alignment (CIRC/PLATE rows have one ' +
          'parameter less than RECT, so dx/dy/repeat shift one column left)');
        cuts.push(c);
        counts.cut++;
      } else if (kw === 'VIEW') {         // VIEW <module> <direction> [title]
        /* A drawing the sheet asks for by name: which module, seen from where,
           and what to call it. All three are content - the person who knows
           them is whoever wrote the workbook, not whoever presses Save DXF.
           The scale is not among them. A scale is a property of the paper
           rather than of the model - but it is a property of THIS drawing's
           paper, so it sits on this drawing's row. Nothing is asked at export
           time any more. */
        var vmod = str(v[0]).toUpperCase();
        // ISO_NE and "ISO NE" mean ISO-NE. One column, three ways to type it.
        var vdir = str(v[1]).toUpperCase().replace(/[\s_]+/g, '-');
        /* The columns do not move. A named direction leaves AZ and EL empty
           rather than sliding the scale two cells left, because a column that
           means different things on different rows is how a sheet quietly
           reads a title as an angle. */
        var is3D = vdir === '3D';
        var vaz = num(v[2], 0), vel = num(v[3], 0);
        var vscl = num(v[4], 0), vttl = str(v[5]);
        if (!vmod) { warn('row ' + (r + 1) + ': VIEW without a module'); continue; }
        if (!viewSpec(vdir, vaz, vel)) {
          warn('row ' + (r + 1) + ': VIEW ' + vmod + ' — unknown direction "' +
               (str(v[1]) || '(blank)') + '" (use ' + viewDirNames() + ')');
          continue;
        }
        if (is3D && (!isFinite(vaz) || !isFinite(vel))) {
          warn('row ' + (r + 1) + ': VIEW ' + vmod + ' 3D — AZ and EL must be numbers ' +
               '(VIEW id dir AZ EL scale title)');
          continue;
        }
        /* A named direction with something in the angle cells is almost always
           a row written to the old shape, where the title followed the
           direction. Saying so beats drawing it at a scale read out of a
           sentence. */
        if (!is3D && (str(v[2]) !== '' || str(v[3]) !== '')) {
          warn('row ' + (r + 1) + ': VIEW ' + vmod + ' ' + vdir + ' — the AZ and EL ' +
               'cells belong to 3D only; leave them empty (VIEW id dir AZ EL scale title)');
          continue;
        }
        if (!(vscl > 0)) {
          warn('row ' + (r + 1) + ': VIEW ' + vmod + ' — needs a scale in the sixth ' +
               'cell, greater than 0 (VIEW id dir AZ EL scale title). 20 means 1:20');
          continue;
        }
        /* Past 90 the viewer has gone over the top and is coming down the far
           side, which is a direction already reachable below 90 with AZ turned
           round. Reading it as if it meant something new draws the model
           upside down and says nothing about why. */
        if (is3D && Math.abs(vel) > 90) {
          warn('row ' + (r + 1) + ': VIEW ' + vmod + ' 3D — EL is measured up from the ' +
               'ground plane, so it runs -90 to 90 (got ' + vel + ')');
          continue;
        }
        views.push({ MODULE: vmod, DIR: vdir, AZ: vaz, EL: vel, SCALE: vscl,
                     TITLE: vttl || (vmod + ' ' + (is3D ? '3D ' + vaz + ' ' + vel : vdir)),
                     ROW: r + 1 });
        counts.view++;
      } else if (kw === 'PLOT') {         // PLOT PART|SECT <id|ALL> <scale> [title]
        /* The other kind of drawing: not a thing in place seen from somewhere,
           but a part on its own at its standard section, with how many were
           placed. The subject is a definition rather than a position, which is
           why it is a different word - and ALL is allowed, because asking for
           forty parts by name is asking for the list to go stale.

           PART and SECT are split so each can carry its own scale. A gusset and
           a six-metre beam do not share a scale, and one block for both meant
           whichever mattered less decided it. */
        var pkind = str(v[0]).toUpperCase();
        var pid = str(v[1]).toUpperCase();
        var pscl = num(v[2], 0), pttl = str(v[3]);
        if (pkind !== 'PART' && pkind !== 'SECT') {
          warn('row ' + (r + 1) + ': PLOT — the second cell says what to draw, ' +
               'PART or SECT (got "' + (str(v[0]) || '(blank)') + '")');
          continue;
        }
        if (!pid) {
          warn('row ' + (r + 1) + ': PLOT ' + pkind + ' — needs an id, or ALL ' +
               '(PLOT PART|SECT id|ALL scale title)');
          continue;
        }
        if (!(pscl > 0)) {
          warn('row ' + (r + 1) + ': PLOT ' + pkind + ' ' + pid + ' — needs a scale ' +
               'in the fourth cell, greater than 0. 10 means 1:10');
          continue;
        }
        plots.push({ KIND: pkind, ID: pid, SCALE: pscl, ROW: r + 1,
                     TITLE: pttl || (pkind + ' ' + pid) });
        counts.plot++;
      } else if (kw === 'COORD') {        // COORD ZUP (default) | YUP — frame the sheet is written in
        yup = str(v[0]).toUpperCase() === 'YUP';
        palias = yup ? PLANE_ALIAS_YUP : PLANE_ALIAS;
      } else if (kw === 'MODULE' || kw === 'PART') {   // module row (PART = legacy alias)
        var partId = str(v[0]).toUpperCase();
        if (!partId) { warn('row ' + (r + 1) + ': MODULE without ID'); continue; }
        if (!parts[partId]) {
          parts[partId] = { ID: partId, pos: [], base: null, fits: [] };
          counts.module++;
        }
        currentPart = parts[partId];
        if (v.length <= 1) continue;      // block style: POS/BASE rows follow
        var msub = str(v[1]).toUpperCase();
        if (msub === 'BASE') {            // MODULE id BASE <instance> <point>
          currentPart.base = { inst: str(v[2]).toUpperCase(), pt: normPoint(v[3]),
                               face: faceOf(v[3]) };
          continue;
        }
        if (msub === 'FIT') {             // MODULE id FIT <member> <B|E> <target> [GAP]
          addFit(currentPart, v.slice(2), r);
          continue;
        }
        // the same switched-off row, on the placing side: no member, nothing to place
        if (msub === '') continue;
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
        //         [dx dy dz repeat] [dx2 dy2 dz2 repeat2]
        var mplane = str(v[6]).toUpperCase();
        if (palias[mplane]) {
          var mrow = { __xyz: true, NO: msub, PLATE: mplate, PLANE: palias[mplane],
                       PL_IN: mplane, __bar: !!plates[mplate].__bar,
                       REFPT: normPoint(v[2]), FACE: faceOf(v[2]),
                       LX: num(v[3], 0), LY: num(v[4], 0), LZ: num(v[5], 0),
                       RX: num(v[7], 0), RY: num(v[8], 0), RZ: num(v[9], 0) };
          var msteps = modSteps(v, 10, partId + ' ' + msub, r);
          for (var mi = 0; mi < msteps.length; mi++) {
            var cp = {};
            for (var mk in mrow) cp[mk] = mrow[mk];
            cp.LX = mrow.LX + msteps[mi][0];
            cp.LY = mrow.LY + msteps[mi][1];
            cp.LZ = mrow.LZ + msteps[mi][2];
            addMember(currentPart, cp);
          }
          continue;
        }
        // <bar/sect> Ref.Pt LX1 LY1 LZ1 LX2 LY2 LZ2 [OFF_B OFF_E Alpha]
        //            [dx dy dz repeat] [dx2 dy2 dz2 repeat2]
        // The PLANE cell holds a number instead of a plane name, so the member is
        // stretched between two module-local points. All three end coordinates
        // are tested: a column standing straight up leaves LX2 and LY2 blank.
        if (isNum(v[6]) || isNum(v[7]) || isNum(v[8])) {
          var axr = axialRow(msub, mplate, v, r);
          if (axr) {
            /* A copy moves both ends by the same offset, so it keeps the
               direction, the length and the two trims of the row it came from -
               a rail of identical braces, a row of studs. */
            var asteps = modSteps(v, 12, partId + ' ' + msub, r);
            for (var ai = 0; ai < asteps.length; ai++) {
              var acp = {}, as = asteps[ai];
              for (var ak in axr) acp[ak] = axr[ak];
              acp.X1 = axr.X1 + as[0]; acp.Y1 = axr.Y1 + as[1]; acp.Z1 = axr.Z1 + as[2];
              acp.X2 = axr.X2 + as[0]; acp.Y2 = axr.Y2 + as[1]; acp.Z2 = axr.Z2 + as[2];
              acp.AX = axr.AX + as[0]; acp.AY = axr.AY + as[1]; acp.AZ = axr.AZ + as[2];
              addMember(currentPart, acp);
            }
          }
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
      } else if (kw === 'FIT') {          // FIT MEMBER B|E TARGET [GAP]
        if (!currentPart) { warn('row ' + (r + 1) + ': FIT outside of a MODULE'); continue; }
        addFit(currentPart, v, r);
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
      /* A FIT row names two members, and it is read after the numbering for the
         same reason BASE is: what the sheet wrote is a part name, and by now a
         part used twice answers to pl.c1_1 and pl.c1_2 instead. Same rule as
         BASE - a name covering several means the first of them, and says so. */
      var live = {};
      part.pos.forEach(function (p) { live[p.NO] = true; });
      part.fits = (part.fits || []).filter(function (ft) {
        return ['NO', 'TO'].every(function (k) {
          var nm = ft[k];
          if (live[nm]) return true;
          if (firstOf[nm]) {
            hint('MODULE ' + id + ' row ' + ft.ROW + ': FIT ' + nm + ' names ' +
                 used[nm] + ' members — taking the first, ' + firstOf[nm] +
                 '. Name a copy directly to choose another.');
            ft[k] = firstOf[nm];
            return true;
          }
          warn('MODULE ' + id + ' row ' + ft.ROW + ': FIT names ' + nm +
               ', which this module does not place. A FIT row can only reach the ' +
               'members of its own module.');
          return false;
        });
      });
    });
    Object.keys(parts).forEach(function (id) {
      if (!parts[id].pos.length) hint('MODULE ' + id + ': has no POS rows');
      else if (!parts[id].base) warn('MODULE ' + id + ': BASE not defined — add "MODULE ' + id +
                                     ' BASE <member> <point>". Falling back to the local origin (0,0,0)');
      else if (!parts[id].pos.some(function (p) { return p.NO === parts[id].base.inst; }))
        warn('MODULE ' + id + ': BASE instance ' + parts[id].base.inst +
             ' not found among its members — falling back to the local origin (0,0,0)');
    });
    /* VIEW rows may sit above the rows they name, so the subject is looked for
       once the whole sheet has been read rather than as the row goes by. A
       MODULE or an ASSY will do: both are things a person points at and calls
       a thing, and a sheet that can draw one should be able to draw the other.
       A view of nothing is dropped: better no drawing than an empty frame with
       a title over it. */
    views = views.filter(function (vw) {
      if (parts[vw.MODULE] || assyIds[vw.MODULE]) return true;
      warn('row ' + vw.ROW + ': VIEW names ' + vw.MODULE +
           ', which the sheet defines neither as a MODULE nor as an ASSY — ' +
           'no drawing is made');
      counts.view--;
      return false;
    });
    return { plates: plates, holes: holes, parts: parts, cuts: cuts, assy: assy,
             views: views, plots: plots, log: log, counts: counts, yup: yup,
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
            (c.bolt ? ' &middot; bolts ' + c.bolt : '') +
            ' &middot; cuts ' + c.cut +
            ' &middot; modules ' + (c.module || 0) +
            ' &middot; assy ' + c.assy + ' &rarr; placed ' + placed +
            (c.fit ? ' &middot; fits ' + c.fit : '') +
            (c.view ? ' &middot; views ' + c.view : '');
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

  /* ------- the second way in: rows handed over by the embedding page -------

     A workbook reaches the model as `rows` - a plain array of arrays of
     numbers and strings - and everything downstream of that knows nothing
     about Excel. So a page that can produce those rows can drive this frame
     without a file at all, which is what QuickPlate3D does: you type into a
     form and the model under it redraws, with no save-and-load in between.

     The last four lines below are the same four the file path runs. That is
     deliberate: this is a second door into one room, not a second room.

     Who is allowed to knock. `e.source` is set by the browser and cannot be
     forged, and `window.parent` is whoever framed us - so this accepts the
     embedding page and nothing else. A hostile page that opens this embed in
     a popup is its `opener`, not its `parent`, and is turned away.

     There is deliberately NO origin string. Hardcoding a domain would put the
     site's address inside the engine, to be edited whenever the site moves or
     is tested from somewhere else, and it would buy very little: this frame
     holds nothing worth taking - no login, no stored files, no token - and
     anyone who framed it could already drive it through the file picker. If
     that ever stops being true, an origin check belongs here.

     What is actually checked is the message: its shape, and its size. Beyond
     that parseExcelRows is the guard, exactly as it is for a workbook - the
     rows have to survive the same parser either way. */
  var QUICK_MAX_ROWS = 5000;                     // a real sheet is a few hundred
  /* Under ui=quick the whole File menu is gone, exports included, because in
     that mode the toolbar belongs to the page around the frame - one owner,
     not two bars competing. So the exports have to be reachable from out
     there, and this is the same door the rows come through rather than a new
     one: one sender check, one place to look.

     A fixed list, not a name to call. `d.do` naming any function on the API
     would let the embedding page reach everything the viewer can do; these
     four only read the built scene and hand back a file. */
  var QUICK_CMD = { exportDXF: 1, exportBOQ: 1, exportSTL: 1, exportIFC: 1 };
  window.addEventListener('message', function (e) {
    if (e.source !== window.parent) return;      // only the page that framed us
    var d = e && e.data;
    if (d && d.plate3d === 'cmd') {
      // read the API at call time: it is assigned far below this listener, so
      // capturing it here would capture undefined
      var api = window.plateBuilder;
      if (!QUICK_CMD[d.do] || !api || typeof api[d.do] !== 'function') return;
      try { api[d.do](); } catch (err) {
        try { window.parent.postMessage({ plate3d: 'cmdFailed', do: d.do,
                                          why: String(err && err.message || err) }, '*'); } catch (e3) {}
      }
      return;
    }
    if (!d || d.plate3d !== 'rows') return;
    if (!Array.isArray(d.rows) || !d.rows.length || d.rows.length > QUICK_MAX_ROWS) return;
    var name = typeof d.name === 'string' && d.name ? d.name : 'Quick input';
    var parsed;
    try {
      parsed = parseExcelRows(d.rows, null);
    } catch (err) {
      fatalStop(name, ['Could not read the rows: ' + (err && err.message || err)]);
      return;
    }
    if (parsed.fatal) { fatalStop(name, parsed.fatal); return; }
    buildLog = [];
    run({ title: 'PLATE3D',
          subtitle: name + ' · PLATE/CUT/ASSY · unit: mm',
          note: 'Built from the form above — edit a value and the model follows.',
          __parsed: parsed });
    showResult(name, parsed);
    /* Tell the sender it landed, so the form can report without the reader
       having to look down at the panel. `items` is the built scene, so its
       length is the count the result panel shows - not a field on `parsed`,
       which does not carry one. Errors are counted the same way the panel
       counts them: the parser's log plus the build's. */
    var qlog = (parsed.log || []).concat(buildLog);
    try {
      window.parent.postMessage({
        plate3d: 'built', name: name,
        placed: items.length,
        errors: qlog.filter(function (x) { return x.s === 'e'; }).length
      }, '*');
    } catch (e2) {}
  });

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


  /* ---------------- steel sections: H / C / L / P / R ----------------
     H, C and L are rolled and solid; P and R are tubes and are the same
     machinery with a bore taken out of the middle - see sectInner. Nothing
     below is special-cased for hollowness: the ring is the outside, the bore
     is subtracted where a CUT would be, and the area falls out of the same
     outers-minus-holes sum.
     ---------------- rolled sections: H / C / L ----------------
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
  /* A rectangle w wide and h tall, standing on y = 0 and centred on x = 0, its
     corners rounded by r. CCW, like every other outline here, and with r left
     at 0 it is four corners and nothing else - the same thing leaving an H's
     r1 blank does. r is clamped rather than refused because sectErrors has
     already refused anything that does not fit; this is the drawing, not the
     gate. */
  function roundRect(w, h, r) {
    var seg = SECT_SEG, x = w / 2, g = [];
    r = Math.max(0, Math.min(num(r, 0), Math.min(w, h) / 2));
    if (!(r > 0)) return [[-x, 0], [x, 0], [x, h], [-x, h]];
    g.push([-x + r, 0], [x - r, 0]);
    arcInto(g, x - r, r, r, 270, 360, seg);
    g.push([x, h - r]);
    arcInto(g, x - r, h - r, r, 0, 90, seg);
    g.push([-x + r, h]);
    arcInto(g, -x + r, h - r, r, 90, 180, seg);
    g.push([-x, r]);
    arcInto(g, -x + r, r, r, 180, 270, seg);
    return cleanRing(g);
  }
  /* 48, which is what outlineOf already gives a BAR, and the match is the
     whole point: a solid Ø48.6 BAR and a P-48.6 tube have to be drawn on the
     same circle or the two disagree about a diameter they both call 48.6.
     A 48-gon is 0.29% under the true area - always under, never over, and the
     same 0.29% on the bore, so the wall it leaves is right to that figure. */
  var PIPE_SEG = 48;
  // P - a round tube. Origin bottom centre like an H, so it stands in
  // x -d/2..d/2, y 0..d. Only the outside is here; the bore comes out in
  // sectInner.
  function outlineP(d) { return circleOutline(d.d, 0, d.d / 2, PIPE_SEG); }
  // R - a rectangular tube, origin bottom centre. r is the OUTER corner.
  function outlineR(d) { return roundRect(d.b, d.h, d.r || 0); }
  /* The bore of a hollow section, in the same raw coordinates as sectRing.
     It is subtracted rather than carried alongside as a second ring, because
     subtraction is the path the area, the DXF and the 3D shape already take
     for a CUT. A hollow section is not a new kind of geometry here - it is a
     profile with a hole in it, which this file has always been able to hold.
     The inner corner of a rectangular tube is not asked for on the row. A
     formed tube keeps its wall thickness round the bend, so the inner radius
     is the outer less the wall, and square when the wall is the thicker of
     the two. One number in, and it stays physically true. */
  function sectInner(spec) {
    if (spec.SHAPE !== 'SECT') return null;
    if (spec.SECT === 'P') {
      var di = num(spec.d, 0) - 2 * num(spec.t, 0);
      return di > 0 ? circleOutline(di, 0, num(spec.d, 0) / 2, PIPE_SEG) : null;
    }
    if (spec.SECT === 'R') {
      var t = num(spec.t, 0),
          bi = num(spec.b, 0) - 2 * t, hi = num(spec.h, 0) - 2 * t;
      if (!(bi > 0 && hi > 0)) return null;
      return roundRect(bi, hi, Math.max(0, num(spec.r, 0) - t))
        .map(function (p) { return [p[0], p[1] + t]; });
    }
    return null;
  }
  function sectRing(spec) {                      // raw profile, before BASE.pt
    if (spec.__ring) return spec.__ring;
    spec.__ring = spec.SECT === 'C' ? outlineC(spec)
                : spec.SECT === 'L' ? outlineL(spec)
                : spec.SECT === 'P' ? outlineP(spec)
                : spec.SECT === 'R' ? outlineR(spec) : outlineH(spec);
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
    } else if (spec.SECT === 'R') {
      // the outer corner, convex, so the leader heads away from the steel.
      // Only one: all four are the same number, and add() refuses a repeat.
      add(spec.b / 2 - spec.r, spec.h - spec.r, spec.r, 45, 1);
    } else if (spec.SECT === 'P') {
      // nothing. A pipe's only curvature is its diameter and the label
      // already carries it - an R arrow on the barrel would say it twice.
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
                      L: ['a', 'b', 't1', 't2', 'r1', 'r2'],
                      P: ['d', 't'],
                      R: ['h', 'b', 't', 'r'] };
  var SECT_RADII = { H: 1, C: 2, L: 2, P: 0, R: 1 };  // trailing fields allowed to be 0
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
    } else if (t === 'P') {
      // a wall that meets itself in the middle is a solid bar, and one that
      // passes itself is nothing at all - both are refused rather than drawn
      if (2 * d.t >= d.d) e.push('wall too thick: 2 x t (' + 2 * d.t + ') >= d (' + d.d + ') — a pipe this thick is a solid bar');
    } else if (t === 'R') {
      if (2 * d.t >= d.h) e.push('wall too thick: 2 x t (' + 2 * d.t + ') >= h (' + d.h + ')');
      if (2 * d.t >= d.b) e.push('wall too thick: 2 x t (' + 2 * d.t + ') >= b (' + d.b + ')');
      if (d.r && d.r > Math.min(d.h, d.b) / 2) e.push('r ' + d.r + ' does not fit in the corner — max ' + (Math.min(d.h, d.b) / 2));
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
    if (spec.SECT === 'P') return 'P-' + n(spec.d) + X + n(spec.t);
    // h x b even when they are equal. A square tube is a rectangular one whose
    // two numbers match, and writing it once would make the reader work out
    // which of the two it was.
    if (spec.SECT === 'R') {
      return 'R-' + n(spec.h) + X + n(spec.b) + X + n(spec.t) + radLabel(spec.r, 0);
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
  /* A hexagon on its across-flats size, which is the number stamped on a
     spanner and the one a bolt table gives. Vertices start at 30 degrees so a
     flat, not a corner, faces along x - the way a head is drawn on a plan. */
  function hexOutline(af) {
    var R = af / Math.sqrt(3), pts = [];
    for (var i = 0; i < 6; i++) {
      var a = (30 + i * 60) * Math.PI / 180;
      pts.push([R * Math.cos(a), R * Math.sin(a)]);
    }
    return pts;
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
      // positions: the Excel repeat (dx/dy/repeat, and dx2/dy2/repeat2 stepping
      // that whole row sideways) or the CUT sheet's NX·PX/NY·PY grid
      var uvs = [];
      if (c.REP !== undefined) {              // repeat = extra copies (original excluded)
        var n1 = num(c.REP, 0), n2 = num(c.REP2, 0);
        var dx1 = num(c.DX, 0), dy1 = num(c.DY, 0);
        var dx2 = num(c.DX2, 0), dy2 = num(c.DY2, 0);
        for (var j = 0; j <= n2; j++)
          for (var i = 0; i <= n1; i++)
            uvs.push([anchor[0] + num(c.U, 0) + i * dx1 + j * dx2,
                      anchor[1] + num(c.V, 0) + i * dy1 + j * dy2]);
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
    /* The bore of a hollow section goes first, and deliberately not through
       `cutters`: those go back out to the caller as `cuts`, which is what
       draws a CUT's own shape on the part drawing. The wall of a tube is not
       something the sheet asked to be cut out - it is what the section is -
       and drawing it as a cut would put a CUT outline round every pipe. */
    var bore = sectInner(spec);
    if (bore) {
      var ob = baseOffset(spec);
      region = PolyBool.difference(region, {
        regions: [bore.map(function (q) { return [q[0] - ob[0], q[1] - ob[1]]; })],
        inverted: false });
    }
    cutters.forEach(function (cu) {
      region = PolyBool.difference(region, { regions: [cu], inverted: false });
    });

    var c = classifyRings(region.regions);
    var area = 0;
    c.outers.forEach(function (r) { area += ringAreaTrue(r); });
    c.holes.forEach(function (hs) {
      hs.forEach(function (r) { area -= ringAreaTrue(r); });
    });

    /* The cutters go out with the result. They are what the sheet asked for,
       placed and rotated but not yet subtracted, and that is the only place
       the shape of a CUT survives intact: once the boolean has run, one that
       reached an edge is indistinguishable from the outline it melted into. */
    return { outers: c.outers, holes: c.holes, feats: feats, area: area,
             cuts: cutters };
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
  function isBoltSpec(spec) { return !!(spec && spec.__bolt); }
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


  /* ---------------- FIT — cutting an end to the face it lands on ----------------
     A member placed between two points is a prism with square ends. Where it
     butts straight onto another member - a truss diagonal welded to its chord,
     a raking column onto a beam flange, nothing between them - that end has to
     be cut to the face it meets, and the cut is not square: the plane leans by
     whatever angle the two axes make.

     The sheet names who it lands on and stops there. Which face, and at what
     angle, is already in the model: extend the member's own axis and it runs
     into exactly one face first. That one is the cut plane. No solid modeller
     is needed for it - every face of a prism is a plane, the two caps and one
     per outline edge, so the whole question is a ray against a polygon and a z
     range.

     What comes back is written in the cut member's own frame, as the height of
     the end face over the section: z = a*x + b*y + c. A square end is the same
     shape with a = b = 0, which is why the rest of the engine only ever reads
     one thing. And because it is local it rides along with the member wherever
     the module is later placed, copied, mirrored or spun.

     This handles the end that is cut right across. An end where only part of
     the section lands on the other member is a different shape - the rest of it
     keeps its square end, or is sawn through on an extended plane, and which of
     those is wanted is a detailing decision the geometry cannot make. So the
     section is checked vertex by vertex, and a joint that does not come out as
     one plane is reported rather than cut on a guess. */

  var FIT_MIN_COS = 0.02;             // ~88.9 deg: past this the cut face runs away
  var FIT_SAME_TOL = 0.1;             // mm: two vertices are on one face within this

  // The nearest face a ray meets, in the prism's own frame: the outline lies in
  // xy and the solid runs from -h to h. Returns the hit distance and the face
  // normal, or null when the ray misses the solid entirely.
  function rayPrismFace(rings, h, o, d) {
    var best = null;
    function keep(t, nx, ny, nz) {
      if (t <= 1e-6) return;
      if (!best || t < best.t) best = { t: t, n: new THREE.Vector3(nx, ny, nz) };
    }
    function solid(p) {                        // inside the outline, outside its holes
      for (var i = 0; i < rings.outers.length; i++) {
        if (!pointInRing(p, rings.outers[i])) continue;
        var hs = rings.holes[i] || [];
        for (var j = 0; j < hs.length; j++) if (pointInRing(p, hs[j])) return false;
        return true;
      }
      return false;
    }
    if (Math.abs(d.z) > 1e-9) {                // the two caps
      [-h, h].forEach(function (z) {
        var t = (z - o.z) / d.z;
        if (t <= 1e-6) return;
        if (solid([o.x + d.x * t, o.y + d.y * t])) keep(t, 0, 0, z < 0 ? -1 : 1);
      });
    }
    var walls = [];                            // a hole's wall is a face like any other
    rings.outers.forEach(function (r, i) {
      walls.push(r);
      (rings.holes[i] || []).forEach(function (q) { walls.push(q); });
    });
    walls.forEach(function (ring) {
      for (var i = 0; i < ring.length; i++) {
        var a = ring[i], b = ring[(i + 1) % ring.length];
        var ex = b[0] - a[0], ey = b[1] - a[1];
        var len2 = ex * ex + ey * ey;
        if (len2 < 1e-12) continue;
        var den = d.x * ey - d.y * ex;
        if (Math.abs(den) < 1e-12) continue;   // running along the wall, never into it
        var t = ((a[0] - o.x) * ey - (a[1] - o.y) * ex) / den;
        if (t <= 1e-6) continue;
        var z = o.z + d.z * t;
        if (z < -h - 1e-6 || z > h + 1e-6) continue;
        var u = ((o.x + d.x * t - a[0]) * ex + (o.y + d.y * t - a[1]) * ey) / len2;
        if (u < -1e-6 || u > 1 + 1e-6) continue;
        keep(t, ey, -ex, 0);
      }
    });
    if (best) best.n.normalize();
    return best;
  }

  function rotOf(m) { return new THREE.Matrix4().extractRotation(m); }

  /* One end of one member, cut to the first face of another that its axis runs
     into. Both arrive positioned in module coordinates.

     The rays start in the middle of the member and leave through the end being
     cut. Starting at the end itself would be wrong the moment a member runs
     past its work point into the other one - a negative OFF, a brace lapping in
     - because the end is then already inside the target and the first face
     ahead of it is the far one. The middle is outside both targets in anything
     that is not already a clash, so it reads the same for either end. */
  function fitOneCap(A, B, end, gap, ringsOf, say) {
    var tag = 'FIT ' + A.row.NO + ' ' + end + ' ' + B.row.NO + ' — ';
    if (!A.row.__ax) {
      say(tag + A.row.NO + ' is not placed between two points, so it has no axis to cut ' +
          'across. FIT reads the end of a BAR or a SECT stretched from LX1/LY1/LZ1 to ' +
          'LX2/LY2/LZ2.');
      return null;
    }
    if (isBarSpec(B.spec)) {
      say(tag + B.row.NO + ' is a round bar. Its surface is curved, so there is no one ' +
          'plane to cut to — it is drawn as a 48-sided prism, and cutting to a facet of ' +
          'that would be an answer about the drawing rather than about the steel.');
      return null;
    }
    var sgn = end === 'E' ? 1 : -1;
    var Bi = B.mloc.clone().invert();
    var dB = new THREE.Vector3(0, 0, sgn).applyMatrix4(rotOf(A.mloc))
               .applyMatrix4(rotOf(Bi)).normalize();
    var tgt = ringsOf(B.spec), th = (B.spec.THK || 0) / 2;
    function shoot(x, y) {             // up the axis from one point of the section
      return rayPrismFace(tgt, th,
        new THREE.Vector3(x, y, 0).applyMatrix4(A.mloc).applyMatrix4(Bi), dB);
    }
    var pa = A.row.REFPT ? (A.pts[A.row.REFPT] || [0, 0]) : [0, 0];
    var hit = shoot(pa[0], pa[1]);
    if (!hit) {
      say(tag + 'the axis of ' + A.row.NO + ', run out past its ' +
          (end === 'E' ? 'end' : 'start') + ', never reaches ' + B.row.NO + '. Check that ' +
          'the two really do meet, and that the end named is the one facing it.');
      return null;
    }
    // the hit face, carried back into the cut member's own frame
    var P = new THREE.Vector3(pa[0], pa[1], 0).applyMatrix4(A.mloc).applyMatrix4(Bi)
              .addScaledVector(dB, hit.t).applyMatrix4(B.mloc);
    var N = hit.n.clone().applyMatrix4(rotOf(B.mloc)).normalize();
    var Ai = A.mloc.clone().invert();
    var n = N.clone().applyMatrix4(rotOf(Ai)).normalize();
    if (Math.abs(n.z) < FIT_MIN_COS) {
      say(tag + 'the face it lands on is all but parallel to the member — the cut would ' +
          'run off down the length instead of across it. This is a joint that wants a ' +
          'notch, not an end cut.');
      return null;
    }
    var q = P.clone().applyMatrix4(Ai);
    var cap = { a: -n.x / n.z, b: -n.y / n.z, c: n.dot(q) / n.z };

    /* Does that one plane account for the whole end? Every vertex of the
       section is shot down the same axis, and each has to land on the same
       face at the same depth. One that misses, or lands on another face, means
       the section is only partly caught - a real joint, but not one plane, and
       cutting it as if it were would quietly saw off steel the sheet never
       asked to lose. */
    var own = ringsOf(A.spec), bad = '';
    own.outers.forEach(function (ring) {
      ring.forEach(function (v) {
        if (bad) return;
        var h2 = shoot(v[0], v[1]);
        if (!h2) { bad = 'part of the section runs clear past ' + B.row.NO; return; }
        if (Math.abs(sgn * h2.t - (cap.a * v[0] + cap.b * v[1] + cap.c)) > FIT_SAME_TOL) {
          bad = 'different parts of the section land on different faces of ' + B.row.NO;
        }
      });
    });
    if (bad) {
      say(tag + bad + ', so this end is not cut right through by one plane. Only a cut ' +
          'that takes the whole section is read for now: the rest is a choice between ' +
          'sawing through on the extended plane and coping round the other member, and ' +
          'the model cannot make it for you.');
      return null;
    }
    // the gap is a root gap: measured square off the cut face, and it always
    // shortens - the same sign OFF uses, positive pulls the steel back
    if (gap) cap.c += -sgn * gap / Math.abs(n.z);
    cap.ang = Math.acos(Math.min(1, Math.abs(n.z))) * 180 / Math.PI;
    return cap;
  }

  // The two end faces of a member as z over its section. Nearly every member
  // has them flat at -thk/2 and +thk/2; a FIT row tilts one or both.
  function capZ(cap, dflt) {
    if (!cap) return function () { return dflt; };
    return function (x, y) { return cap.a * x + cap.b * y + cap.c; };
  }
  function capPlanes(thk, caps) {
    var h = (thk || 0) / 2;
    return { lo: capZ(caps && caps.b, -h), hi: capZ(caps && caps.e, h),
             tilted: !!(caps && (caps.b || caps.e)) };
  }
  // A capped member no longer runs -thk/2 .. thk/2. Its real z range, which is
  // what a bounding box has to cover.
  function capRange(rings, thk, caps) {
    var Z = capPlanes(thk, caps), h = (thk || 0) / 2;
    if (!Z.tilted) return { lo: -h, hi: h };
    var lo = Infinity, hi = -Infinity;
    rings.outers.forEach(function (r) {
      r.forEach(function (q) {
        lo = Math.min(lo, Z.lo(q[0], q[1]));
        hi = Math.max(hi, Z.hi(q[0], q[1]));
      });
    });
    return isFinite(lo) ? { lo: lo, hi: hi } : { lo: -h, hi: h };
  }
  // Area centroid of a finished section, holes taken out. The volume of a
  // member cut by planes is its area times the axial length at this one point:
  // the length varies linearly over the section, so its mean is its value at
  // the centroid, and the weight comes out exact rather than sampled.
  function ringsCentroid(rings) {
    var ax = 0, ay = 0, aa = 0;
    function add(ring, sign) {
      var a = Math.abs(ringArea(ring)) * sign, c = polyCentroid(ring);
      ax += c[0] * a; ay += c[1] * a; aa += a;
    }
    rings.outers.forEach(function (r, i) {
      add(r, 1);
      (rings.holes[i] || []).forEach(function (h) { add(h, -1); });
    });
    return Math.abs(aa) < 1e-9 ? [0, 0] : [ax / aa, ay / aa];
  }
  function capLength(rings, thk, caps) {
    var Z = capPlanes(thk, caps);
    if (!Z.tilted) return thk || 0;
    var c = ringsCentroid(rings);
    return Z.hi(c[0], c[1]) - Z.lo(c[0], c[1]);
  }
  // Mirroring an instance reflects its section in x (see flipRingsX), so an end
  // plane written over that section has to be read the same way round.
  function flipCaps(caps) {
    if (!caps) return caps;
    function f(c) { return c ? { a: -c.a, b: c.b, c: c.c, ang: c.ang } : null; }
    return { b: f(caps.b), e: f(caps.e) };
  }
  function capKey(caps) {                 // two ends cut differently are two parts
    if (!caps) return '';
    return [caps.b, caps.e].map(function (c) {
      return c ? [c.a, c.b, c.c].map(function (v) { return Math.round(v * 1e3) / 1e3; }).join(':')
               : '-';
    }).join('/');
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
    lastViews = (data.__parsed && data.__parsed.views) || [];
    lastPlots = (data.__parsed && data.__parsed.plots) || [];
    var inst = {};                       // NO → {matrix, pts, thk} for EDGE references
    var bbox = new THREE.Box3();

    function buildErr(m) { buildLog.push({ s: 'e', m: m }); console.error('[plateBuilder] ' + m); }
    function buildHint(m) { buildLog.push({ s: 'w', m: m }); console.warn('[plateBuilder] ' + m); }

    // create geometry for one plate instance with a final world matrix
    function buildInstance(spec, matrix, no, group, remark, mirror, moduleId, memberKey, flip, member, caps) {
      var world = yupFix(matrix);        // EDGE chaining keeps using the raw matrix
      var thk = spec.THK;
      var g2d = buildPlate2D(spec, cuts, plates);
      var outers = g2d.outers, holesArr = g2d.holes, cutRings = g2d.cuts || [];
      if (mirror) {
        outers = mirror2D(outers, spec);
        holesArr = holesArr.map(function (hs) { return mirror2D(hs, spec); });
        cutRings = mirror2D(cutRings, spec);
      }
      if (flip) {                        // reflected instance, see flipRingsX
        world = world.clone().multiply(new THREE.Matrix4().makeScale(-1, 1, 1));
        outers = flipRingsX(outers);
        holesArr = holesArr.map(flipRingsX);
        cutRings = flipRingsX(cutRings);
        caps = flipCaps(caps);
      }
      var groupObj = new THREE.Group();
      var mat = new THREE.MeshPhongMaterial({ color: colors[spec.ID], shininess: 28,
                        side: flatMode ? THREE.DoubleSide : THREE.FrontSide });
      var edgeMat = new THREE.LineBasicMaterial({ color: 0x0e1013 });
      outers.forEach(function (ring, i) {
        var shape = new THREE.Shape(ring.map(function (q) { return new THREE.Vector2(q[0], q[1]); }));
        holesArr[i].forEach(function (h) {
          /* A hole's wall has to face INTO the hole, and ExtrudeGeometry builds
             it from the winding it is handed. A hole wound the same way round
             as its outer therefore comes out inside-out: the wall is there but
             every one of its faces points away, so FrontSide culls the lot and
             a tube's bore renders as a window you can see the grid through.
             It cost nothing in weight or in the DXF - both read the 2D rings -
             which is why it stood so long. */
          var hh = ringArea(h) * ringArea(ring) > 0 ? h.slice().reverse() : h;
          shape.holes.push(new THREE.Path(hh.map(function (q) { return new THREE.Vector2(q[0], q[1]); })));
        });
        var geo = plateGeom(shape, thk, caps);
        var mesh = new THREE.Mesh(geo, mat);
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(world);
        mesh.userData = { shape: shape, thk: thk, caps: caps };
        groupObj.add(mesh);
        geo.computeBoundingBox();
        bbox.union(geo.boundingBox.clone().applyMatrix4(world));
        var edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), edgeMat);
        edge.matrixAutoUpdate = false;
        edge.matrix.copy(world);
        edge.userData = { shape: shape, thk: thk, caps: caps };
        groupObj.add(edge);
      });
      /* ---- a bolt's head and nut ----
         Drawn, not modelled: they are here so the picture reads as a bolted
         joint and nowhere else. Every number the drawings and the take-off use
         is the shank's - the hole is the shank's diameter plus the clearance,
         the pitch chains are between shank axes - so a head that is a little
         out changes nothing anyone is paid for.

         The head stands off BEHIND the placement point, because that point is
         its underside: the steel face the bolt is pulled against. The nut sits
         at the far end of the shank, so length is grip plus nut plus whatever
         thread is wanted showing - which is how a bolt length is chosen. Write
         it too long and the nut stands off the steel, visibly, which is the
         right way for that mistake to appear. */
      if (spec.__bolt) {
        /* Both sit at a given centre along the shank's own axis. The head is
           entirely behind the start, because the start is its underside. The
           nut is entirely INSIDE the length, its outer face at the shank end
           less `proj` - so `length` is grip plus nut plus whatever thread is
           to show, and `proj` is that thread. Written the other way round, with
           the nut hung off the end, `length` would have meant grip alone and
           the two numbers would have disagreed with the guide. */
        var pj = num(spec.PROJ, 0);
        [[num(spec.HAF, 0), num(spec.HH, 0), -thk / 2 - num(spec.HH, 0) / 2],
         [num(spec.NAF, 0), num(spec.NH, 0),  thk / 2 - pj - num(spec.NH, 0) / 2]]
        .forEach(function (h) {
          var af = h[0], ht = h[1], mid = h[2];
          if (!(af > 0) || !(ht > 0)) return;
          var hx = new THREE.Shape(hexOutline(af).map(function (q) {
            return new THREE.Vector2(q[0], q[1]);
          }));
          var hg = plateGeom(hx, ht, null);
          hg.translate(0, 0, mid);
          var hm = new THREE.Mesh(hg, mat);
          hm.matrixAutoUpdate = false;
          hm.matrix.copy(world);
          groupObj.add(hm);
          hg.computeBoundingBox();
          bbox.union(hg.boundingBox.clone().applyMatrix4(world));
          var he = new THREE.LineSegments(new THREE.EdgesGeometry(hg, 25), edgeMat);
          he.matrixAutoUpdate = false;
          he.matrix.copy(world);
          groupObj.add(he);
        });
      }
      scene.add(groupObj);
      var axLen = capLength({ outers: outers, holes: holesArr }, thk, caps);
      var dims = spec.SHAPE === 'SECT'
        ? sectLabel(spec) + ' L' + (caps ? rnd(axLen) + '\u2220' : thk)
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
                 groupObj: groupObj, mass: g2d.area * axLen * RHO,
                 dims: dims, remark: remark || '',
                 spec: spec, thk: thk, caps: caps || null, axLen: axLen,
                 matrix: world, mat: mat, edgeMat: edgeMat,
                 baseColor: colors[spec.ID],
                 rings: { outers: outers, holes: holesArr, cuts: cutRings } };
      items.push(it);
      styleItem(it);
      return { pts: namedPoints(spec, mirror), thk: thk };
    }

    /* The end planes a module's FIT rows ask for. Read once per module, for
       every module, placed or not: the members sit in module coordinates, and a
       plane written there is the same plane however the module is later placed,
       copied or mirrored. Reading it per ASSY row would repeat the work and,
       worse, repeat every warning it raised. A FIT row that cannot be honoured
       is a fault in the sheet whether or not an ASSY row happens to use it. */
    var fitRingCache = {};
    function fitRings(spec) {
      var k = spec.ID + '|' + spec.THK;
      if (!fitRingCache[k]) fitRingCache[k] = buildPlate2D(spec, cuts, plates);
      return fitRingCache[k];
    }
    function fitPart(part) {
      if (part.__caps || !part.fits || !part.fits.length) return;
      var locals;
      try {
        locals = part.pos.map(function (p) {
          var spec = specOf(p, plates);
          var pts = namedPoints(spec, false);
          return { row: p, spec: spec, pts: pts, mloc: memberMatrix(p, pts, spec.THK) };
        });
      } catch (err) {
        buildErr('MODULE ' + part.ID + ': ' + err.message +
                 ' — its FIT rows cannot be read until that is fixed.');
        part.__caps = {};
        return;
      }
      var by = {}, caps = {};
      locals.forEach(function (L) { by[L.row.NO] = L; });
      part.fits.forEach(function (ft) {
        var where = 'MODULE ' + part.ID + ' row ' + ft.ROW + ': ';
        var A = by[ft.NO], B = by[ft.TO];
        if (!A || !B) return;                      // already said so at parse time
        if (A === B) {
          buildErr(where + 'FIT ' + ft.NO + ' is cut against itself.');
          return;
        }
        var key = ft.END === 'B' ? 'b' : 'e';
        var got = caps[ft.NO] || (caps[ft.NO] = { b: null, e: null });
        if (got[key]) {
          buildErr(where + 'FIT ' + ft.NO + ' ' + ft.END + ' is cut twice. An end has ' +
                   'one face; delete one of the two rows.');
          return;
        }
        var cap = fitOneCap(A, B, ft.END, num(ft.GAP, 0), fitRings, function (m) {
          buildErr(where + m);
        });
        if (!cap) return;
        got[key] = cap;
        var off = num(ft.END === 'B' ? A.row.OFB : A.row.OFE, 0);
        if (off) {
          buildHint(where + 'FIT ' + ft.NO + ' ' + ft.END + ' also has ' +
                    (ft.END === 'B' ? 'OFF_B' : 'OFF_E') + ' = ' + off + '. The face ' +
                    'decides where this end stops, so that trim no longer does — clear ' +
                    'it, or use GAP to stand the member off the face.');
        }
      });
      /* A plane that has crossed the far end of the member has not cut it, it
         has consumed it. Better to draw the member square and say so than to
         hand back a solid folded through itself. */
      Object.keys(caps).forEach(function (no) {
        var A = by[no], c = caps[no];
        if (!A || (!c.b && !c.e)) return;
        var Z = capPlanes(A.spec.THK, c), worst = Infinity;
        fitRings(A.spec).outers.forEach(function (r) {
          r.forEach(function (q) {
            worst = Math.min(worst, Z.hi(q[0], q[1]) - Z.lo(q[0], q[1]));
          });
        });
        if (worst <= 0) {
          buildErr('MODULE ' + part.ID + ': FIT leaves ' + no + ' with no steel — the ' +
                   'two end faces cross inside the section. The member is drawn with ' +
                   'square ends instead.');
          caps[no] = { b: null, e: null };
        }
      });
      part.__caps = caps;
    }

    // part-local placements + base point (3D, part-local)
    function partLocals(part) {
      var locals = part.pos.map(function (p) {
        var spec = specOf(p, plates);
        var pts = namedPoints(spec, false);
        return { row: p, spec: spec, pts: pts, mloc: memberMatrix(p, pts, spec.THK),
                 caps: capsOfPart(part, p.NO) };
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

    Object.keys(parts).forEach(function (id) { fitPart(parts[id]); });

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
                   memberKey: row.REF + '/' + L.row.NO, flip: false, caps: L.caps || null,
                   mloc: toBase.clone().multiply(L.mloc) };
        });
      }
      if (assyDefs[row.REF]) {                           // an earlier ASSY: reference = its origin
        return assyDefs[row.REF].map(function (L) {
          return { spec: L.spec, no: L.no, moduleId: L.moduleId, memberKey: L.memberKey,
                   flip: L.flip, caps: L.caps || null, mloc: L.mloc.clone() };
        });
      }
      var sp = plates[row.REF];         // a single PLATE: reference = bc (a BAR: its start)
      if (!sp) throw new Error(row.NO + ': unknown MODULE/ASSY/PLATE ' + row.REF);
      var p0 = refAnchor(sp, 'bc', 0);
      return [{ spec: sp, no: sp.ID, moduleId: null, memberKey: null, flip: false, caps: null,
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
                   flip: flipAll ? !L.flip : L.flip, caps: L.caps || null, mloc: ml };
        });
        assyDefs[row.NO] = joins ? assyDefs[row.NO].concat(made) : made;
        if (!joins) assyAt[row.NO] = G;
        made.forEach(function (L) {
          buildInstance(L.spec, anchor.clone().multiply(L.mloc), instName(row.MEMBER || row.NO, L.no),
                        row.GROUP || row.NO, '', false, L.moduleId, L.memberKey, L.flip,
                        row.MEMBER, L.caps);
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
                        row.PART + '/' + L.row.NO, false, null, L.caps);
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
    var html = text, tdAttr = '';
    if (key) {
      if (sectFold[key] === undefined) sectFold[key] = true;
      var bit = String(text).split(' \u2014 ');
      html = '<span class="fold' + (sectFold[key] ? ' shut' : '') + '">' + ICON_FOLD +
             '</span>' +
             '<span class="sname">' + bit[0] + '</span>' +
             '<span class="scount">(' + (count || 0) + ')</span>' +
             (bit[1] ? '<span class="shint">\u2014 ' + bit[1] + '</span>' : '');
      // the whole heading folds, not just the caret: a 14px triangle is a small
      // thing to hit for something you do on every section, every load
      tdAttr = ' class="sechd" onclick="plateBuilder.toggleSection(\'' + key + '\')"' +
               ' title="show or hide this list"';
      tr.setAttribute('data-sect', key);
      tbl.className = sectFold[key] ? 'sect-shut' : '';
    }
    tr.innerHTML = '<td colspan="' + (span || 2) + '"' + tdAttr + '>' + html + '</td>';
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
      out = out.concat(snapPointsOf({ outers: g2.outers, holes: g2.holes }, spec.THK, m, spec,
                                    capsOfPart(part, row.NO)));
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
  // The end planes worked out for a module member, as fitPart left them. Every
  // reader - the placement, the preview, the exports - asks through here.
  function capsOfPart(part, no) {
    var c = part && part.__caps && part.__caps[no];
    return c && (c.b || c.e) ? c : null;
  }
  function snapPointsOf(rings, thk, matrix, spec, caps) {
    var out = [], flat = flatMode, half = flat ? 0 : (thk || 0) / 2;
    var Z = capPlanes(thk, flat ? null : caps);
    function hi(x, y) { return flat ? 0 : Z.hi(x, y); }
    function lo(x, y) { return flat ? 0 : Z.lo(x, y); }
    function push(x, y, z) { out.push(new THREE.Vector3(x, y, z).applyMatrix4(matrix)); }
    // A round bar's outline is a 48-gon. Those rim vertices are not measuring
    // points, and 96 of them per bar crowd out everything else within snapping
    // range of an end. The two end-face centres are what a bar is measured by.
    if (isBarSpec(spec)) {
      var c = (namedPoints(spec, false) || {}).mc || [0, 0];
      push(c[0], c[1], hi(c[0], c[1]));
      if (half) push(c[0], c[1], lo(c[0], c[1]));
      return out;
    }
    rings.outers.forEach(function (ring, i) {
      ring.forEach(function (q) {
        push(q[0], q[1], hi(q[0], q[1]));
        if (half) push(q[0], q[1], lo(q[0], q[1]));
      });
      (rings.holes[i] || []).forEach(function (h) {
        var c = polyCentroid(h);
        push(c[0], c[1], hi(c[0], c[1]));
        if (half) {
          push(c[0], c[1], (hi(c[0], c[1]) + lo(c[0], c[1])) / 2);
          push(c[0], c[1], lo(c[0], c[1]));
        }
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
        push(q[0], q[1], hi(q[0], q[1]));
        if (half) push(q[0], q[1], lo(q[0], q[1]));
      });
      if (half && p9.mc) push(p9.mc[0], p9.mc[1],
                              (hi(p9.mc[0], p9.mc[1]) + lo(p9.mc[0], p9.mc[1])) / 2);
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
  function faceTint(rings, thk, matrix, caps) {
    var g = new THREE.Group();
    var off = (flatMode ? 0 : (thk || 0) / 2) + 0.25;
    var Z = flatMode ? null : capPlanes(thk, caps);
    shapesFromRings(rings).forEach(function (shape) {
      [[off, TINT_PLUS], [-off, TINT_MINUS]].forEach(function (side) {
        var geo = new THREE.ShapeGeometry(shape);
        geo.translate(0, 0, side[0]);
        if (Z && Z.tilted) {                  // lay the skin on the cut face
          var pos = geo.getAttribute('position'), up = side[0] > 0;
          for (var i = 0; i < pos.count; i++) {
            var x = pos.getX(i), y = pos.getY(i);
            pos.setZ(i, up ? Z.hi(x, y) + 0.25 : Z.lo(x, y) - 0.25);
          }
          pos.needsUpdate = true;
        }
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
    var b = new THREE.Box3(), Z = capPlanes(it.thk, it.caps), v = new THREE.Vector3();
    it.rings.outers.forEach(function (r) {
      r.forEach(function (q) {
        b.expandByPoint(v.set(q[0], q[1], Z.lo(q[0], q[1])).applyMatrix4(it.matrix));
        b.expandByPoint(v.set(q[0], q[1], Z.hi(q[0], q[1])).applyMatrix4(it.matrix));
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
    // The exact path measures the overlap of two z ranges, which only means
    // anything while both ends are square. A member cut to a face goes to the
    // box test instead: it over-reports rather than reading a depth the member
    // does not have.
    if (a.caps || b.caps) return null;
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
    var zr = capRange(it.rings, it.thk, it.caps);
    var u = [new THREE.Vector3(m[0], m[1], m[2]).normalize(),
             new THREE.Vector3(m[4], m[5], m[6]).normalize(),
             new THREE.Vector3(m[8], m[9], m[10]).normalize()];
    it.__obb = { c: new THREE.Vector3((bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2,
                                      (zr.lo + zr.hi) / 2).applyMatrix4(it.matrix),
                 u: u,
                 e: [(bb.x1 - bb.x0) / 2, (bb.y1 - bb.y0) / 2, (zr.hi - zr.lo) / 2] };
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
      var mcaps = capsOfPart(part, row.NO);
      mass += g2d.area * capLength(g2d, spec.THK, mcaps) * RHO;
      var mkey = id + '/' + row.NO;
      var mg = new THREE.Group();            // one group per member, so it can be hidden
      mg.visible = !memberHidden[mkey];
      pvMemberObj[mkey] = mg;
      sc.add(mg);
      if (memberAxes[mkey]) axRows.push({ spec: spec, m: m, rp: memberRef(spec, row), g: mg });
      if (showIdsPv) idRows.push({ text: row.NO,
                                 pos: ringsCenter({ outers: g2d.outers }).applyMatrix4(m), g: mg });
      if (showFacesPv) mg.add(faceTint({ outers: g2d.outers, holes: g2d.holes }, spec.THK, m, mcaps));
      if (mg.visible) {
        pvSnaps = pvSnaps.concat(
          snapPointsOf({ outers: g2d.outers, holes: g2d.holes }, spec.THK, m, spec, mcaps));
        clashRows.push({ rings: { outers: g2d.outers, holes: g2d.holes },
                         thk: spec.THK, caps: mcaps, matrix: m });
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
        var geo = plateGeom(shape, spec.THK, mcaps);
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
      /* Bolts are counted, never weighed - see BOQ_KIND.BOLT - so they stay out
         of every figure that says kilograms, this panel included. Steel is
         bought by the tonne and bolts by the box; adding the two gives a number
         nobody can buy. */
      if (!BOQ_KIND[boqKind(it.spec)].count) total += it.mass;
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
        shearGeom(geo, it.caps);
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
      var cp = capsOfPart(part, row.NO), aL = capLength(g2, spec.THK, cp);
      out.push({ no: row.NO, spec: spec, thk: spec.THK, caps: cp, axLen: aL, matrix: m,
                 mass: g2.area * aL * RHO, dims: '',
                 rings: { outers: g2.outers, holes: g2.holes, cuts: g2.cuts } });
    });
    return out;
  }

  // An empty model still writes a syntactically valid STL and IFC - a file with
  // no solids in it - so the browser downloads something that looks fine and is
  // not. Say so instead.
  function nothing(list, what) {
    if (list.length) return false;
    alert('Nothing to export' + (what ? ' from ' + what : '') + '.\n\n' +
          LOAD_HINT + ', or tick at least one member back on.');
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

  /* ================= DXF export (AC1009 / R12) =================
     The drawings the sheet asked for, in the order it asked, each at the scale
     its own row gave it. A VIEW row draws one id - a MODULE or an ASSY - seen
     from a named direction or from two angles; a PLOT row draws parts on their
     own at their standard section. Nothing else is produced: six views of
     everything placed, and of every module, used to come out whether or not
     anyone wanted them, at whatever one scale the export dialog was carrying.

     The file is built to the shape of macroBIM/bim_dxf.js, which is what the
     site's other drawing tools already ship and what is known to open: AC1009,
     $ACADVER and nothing else in the header, the LTYPE and LAYER tables and
     nothing else in TABLES, then the entities. An earlier version of this
     exporter wrote R2000 with VPORT, STYLE, APPID, DIMSTYLE and BLOCKS tables
     filled in from memory, and AutoCAD refused the file outright. Anything
     added past what bim_dxf.js proves is a guess, and a DXF that is only nearly
     right does not open at all.

     That costs the dimensions their identity: they are drawn from lines, a dot
     at each end and a text, not DIMENSION entities, so the CAD cannot restyle
     them and DIMSCALE cannot be changed after the fact. The geometry is
     identical either way because dimStyle(scale) has already done the
     multiplying. Adding DIMENSION entities back means adding a DIMSTYLE table
     and a BLOCKS section - the two things most likely to have broken it - so it
     is worth doing only once this base is confirmed to open.

     Geometry is written 1:1 in millimetres, the way a CAD drawing is always
     built. The scale you give is never applied to the steel: dimStyle(scale)
     multiplies the registered annotation lengths instead, so a 2.5mm number
     comes out 2.5mm on paper whatever the block is plotted at. That is also
     what lets every drawing share one coordinate system - only their
     annotation differs in size, so a viewport plotted at a drawing's own
     scale is right for that drawing.

     Hidden lines are removed, in every VIEW drawing. An edge with steel in
     front of it is not drawn - see the pass above dxfMemberEdges for how, and
     for the one place it is not exact. */

  /* The text style the drawing writes with. A TrueType name in the STYLE
     table's font field is what gets Arial instead of the stick-figure txt.shx
     every CAD falls back to, and Arial is the face the rest of PLATE3D's output
     already uses - the take-off is set in it too. */
  var DXF_STYLE = 'PLATE3D', DXF_FONT = 'arial.ttf';
  // paper mm the part shelf wraps at when no other block was drawn to take a
  // width from - A0's long side, so the block fits the biggest ordinary sheet
  var DXF_SHEET_W = 1189;

  /* name, AutoCAD colour index, line type. The four line types the LTYPE table
     below registers are the ones bim_dxf.js writes, to the same dash lengths -
     CONTINUOUS, CENTER, HIDDEN, PHANTOM - so a PLATE3D drawing and a drawing
     from the rest of macroBIM open with the same pen set. Third value left off
     means CONTINUOUS.
     CENTER and HIDDEN are the two a shop drawing needs beyond the outline: a
     centre line through a bolt line, and whatever is behind the part you are
     looking at. */
  var DXF_LAYERS = [
    ['PL3D-OUTLINE', 7], ['PL3D-HOLE', 4], ['PL3D-DIM', 1],
    ['PL3D-TEXT', 7], ['PL3D-TITLE', 3],
    ['PL3D-CENTER', 6, 'CENTER'], ['PL3D-HIDDEN', 8, 'HIDDEN']
  ];
  // the six views, each as the axes of its picture plane. `dir` points from the
  // model towards the viewer, and is what decides which side of a member faces
  // us - the silhouette test needs it.
  var DXF_VIEWS = [
    { key: 'FRONT',  right: [1, 0, 0],  up: [0, 0, 1], dir: [0, -1, 0] },
    // (DXF_VIEW_KEY, below, is this list by key - VIEW rows are checked against it)
    { key: 'BACK',   right: [-1, 0, 0], up: [0, 0, 1], dir: [0, 1, 0] },
    { key: 'LEFT',   right: [0, -1, 0], up: [0, 0, 1], dir: [-1, 0, 0] },
    { key: 'RIGHT',  right: [0, 1, 0],  up: [0, 0, 1], dir: [1, 0, 0] },
    { key: 'TOP',    right: [1, 0, 0],  up: [0, 1, 0], dir: [0, 0, 1] },
    { key: 'BOTTOM', right: [-1, 0, 0], up: [0, 1, 0], dir: [0, 0, -1] }
  ];
  var DXF_VIEW_KEY = {};
  DXF_VIEWS.forEach(function (vw) { DXF_VIEW_KEY[vw.key] = vw; });

  /* A direction given as two angles rather than a name. AZ walks the viewer
     round the model in the ground plane, measured from +X (east) anticlockwise;
     EL lifts them off it. Two angles, not three Euler angles, for the reason
     every CAD settles on the same pair: three angles cannot be read without
     also knowing the order they are applied in, and the third of them only
     tilts the picture on the paper, which a drawing does not want.

     The page keeps world Z upright - up is world Z with the view direction
     taken out of it - so a column draws vertical at any angle and no third
     angle is needed to keep it that way. At EL +-90 world Z has no component
     left in the picture plane, and north takes over as the up of the page,
     which is exactly what TOP and BOTTOM already do.

     The six named views are the special cases of this: FRONT is (-90, 0),
     TOP is (0, 90). tools/check_view3d.js asserts that component by
     component, so the two ways of naming a direction cannot drift apart. */
  function viewFromAZEL(az, el, key) {
    var D = Math.PI / 180;
    var ca = Math.cos(az * D), sa = Math.sin(az * D);
    var ce = Math.cos(el * D), se = Math.sin(el * D);
    /* cos(90 deg) is 6.1e-17, not 0. Left in, that lands in every projected
       coordinate and dxfDedupe stops recognising two lines as the same line,
       so a view that should equal a named one becomes a near-miss of it. */
    var z0 = function (v) { return Math.abs(v) < 1e-12 ? 0 : v; };
    var dir = [z0(ce * ca), z0(ce * sa), z0(se)];
    // world Z with dir removed and normalised, which closes to this exactly
    var up = ce > 1e-12 ? [z0(-se * ca), z0(-se * sa), z0(ce)] : [0, 1, 0];
    var right = [z0(up[1] * dir[2] - up[2] * dir[1]),
                 z0(up[2] * dir[0] - up[0] * dir[2]),
                 z0(up[0] * dir[1] - up[1] * dir[0])];
    return { key: key || '3D', right: right, up: up, dir: dir, az: az, el: el };
  }

  // atan(1/sqrt 2) - the elevation at which the three axes foreshorten alike
  var ISO_EL = 35.26438968275465;
  /* The four isometric corners, named for where the viewer stands. ISO on its
     own is the south-east one because that is the corner that shows the same
     face FRONT does, plus the right side and the top - the view a drawing
     means by "isometric". Standing north-east instead is just as isometric
     and looks at the back of the thing. */
  var DXF_ISO = { 'ISO': -45, 'ISO-SE': -45, 'ISO-SW': -135,
                  'ISO-NW': 135, 'ISO-NE': 45 };

  /* One place that turns what a VIEW row says into a direction, so the parser
     checks exactly what the drawing will later be built from. Null means the
     row named something that is not a direction. */
  function viewSpec(dir, az, el) {
    if (DXF_VIEW_KEY[dir]) return DXF_VIEW_KEY[dir];
    if (DXF_ISO[dir] !== undefined) return viewFromAZEL(DXF_ISO[dir], ISO_EL, dir);
    if (dir === '3D') return viewFromAZEL(az, el, '3D');
    return null;
  }
  function viewDirNames() {
    return DXF_VIEWS.map(function (x) { return x.key; }).join(' / ') + ' / ' +
           Object.keys(DXF_ISO).join(' / ') + ' / 3D <AZ> <EL>';
  }

  // DXF is a code-page file, not UTF-8. Anything outside ASCII is transliterated
  // rather than escaped, so a label reads the same in every CAD.
  function dxfText(s) {
    return String(s == null ? '' : s)
      .replace(/[×]/g, 'x').replace(/[−–—]/g, '-')
      .replace(/[°]/g, 'deg').replace(/[α]/g, 'a')
      .replace(/[^\x20-\x7e]/g, '?');
  }
  function dxfNum(v) {
    var n = Math.round(Number(v) * 1e6) / 1e6;
    return isFinite(n) ? String(n) : '0';
  }

  /* One member, projected into one view, as the lines you would draw: both cap
     rings, plus the side edges that are either a real corner or the silhouette.
     Without the silhouette test a round bar seen from the side is two loose
     lines with nothing joining them; without the corner test a plate loses its
     four vertical edges. */
  function dxfMemberEdges(it, view, segs, arcs, holes, outlineOnly) {
    var m = it.matrix, half = (it.thk || 0) / 2, Z = capPlanes(it.thk, it.caps);
    var vd = new THREE.Vector3(view.dir[0], view.dir[1], view.dir[2]);
    var R = new THREE.Vector3(view.right[0], view.right[1], view.right[2]);
    var U = new THREE.Vector3(view.up[0], view.up[1], view.up[2]);
    /* Three components, not two: the third is how far along the line of sight
       the point is, which is what hidden-line removal reads. Everything that
       writes DXF takes [0] and [1] and never looks further. */
    function proj(x, y, z) {
      var p = new THREE.Vector3(x, y, z).applyMatrix4(m);
      return [p.dot(R), p.dot(U), p.dot(vd)];
    }
    // the extrusion direction in world space, for the side-face normals
    var e0 = new THREE.Vector3(0, 0, 0).applyMatrix4(m);
    var ez = new THREE.Vector3(0, 0, 1).applyMatrix4(m).sub(e0).normalize();

    /* A circle only stays a circle when we are looking straight down the
       extrusion. Turned edge on it is a line, which the polygon already draws;
       anywhere between it is an ellipse, and R12 has no ELLIPSE entity - so
       those keep their facets and say so rather than pretending. */
    var faceOn = arcs && Math.abs(ez.dot(vd)) > 0.999;
    var flat = [];
    if (faceOn) (it.rings.cuts || []).forEach(function (rg) {
      var k = ringCircle(rg);
      if (!k) return;
      var pc = proj(k.c[0], k.c[1], Z.lo(k.c[0], k.c[1]));
      flat.push({ c: pc, r: k.r });
      if (holes) holes.push(pc);            // for the pitch chain
    });

    function ring(pts) {
      var n = pts.length;
      if (n < 2) return;
      var faceFront = [];
      var lo = [], hi = [];
      for (var i = 0; i < n; i++) {
        var a = pts[i], b = pts[(i + 1) % n];
        lo.push(proj(a[0], a[1], Z.lo(a[0], a[1])));
        if (half) hi.push(proj(a[0], a[1], Z.hi(a[0], a[1])));
        // side face i is spanned by edge a->b and the extrusion direction
        var ea = new THREE.Vector3(b[0] - a[0], b[1] - a[1], 0)
                   .applyMatrix4(new THREE.Matrix4().extractRotation(m));
        var nrm = new THREE.Vector3().crossVectors(ea, ez);
        faceFront[i] = nrm.dot(vd) > 0;
      }
      [lo, hi].forEach(function (cap) {
        if (!cap.length) return;
        var d = ringDraw(cap, flat);
        d.lines.forEach(function (s) { segs.push(s); });
        if (arcs) d.arcs.forEach(function (a) { arcs.push(a); });
      });
      if (!half) return;
      for (var j = 0; j < n; j++) {
        var prev = pts[(j - 1 + n) % n], cur = pts[j], nxt = pts[(j + 1) % n];
        var d1x = cur[0] - prev[0], d1y = cur[1] - prev[1];
        var d2x = nxt[0] - cur[0], d2y = nxt[1] - cur[1];
        var l1 = Math.hypot(d1x, d1y), l2 = Math.hypot(d2x, d2y);
        var corner = false;
        if (l1 > 1e-9 && l2 > 1e-9) {
          var cosT = (d1x * d2x + d1y * d2y) / (l1 * l2);
          corner = cosT < Math.cos(25 * Math.PI / 180);   // same 25 deg the 3D view creases at
        }
        var sil = faceFront[(j - 1 + n) % n] !== faceFront[j];
        if (corner || sil) segs.push([proj(cur[0], cur[1], Z.lo(cur[0], cur[1])),
                                      proj(cur[0], cur[1], Z.hi(cur[0], cur[1]))]);
      }
    }
    it.rings.outers.forEach(function (o, i) {
      ring(o);
      if (!outlineOnly) (it.rings.holes[i] || []).forEach(ring);
    });
  }

  /* ================= hidden-line removal =================

     A VIEW row draws what you could see standing where it says, so an edge
     with steel in front of it is not drawn at all. The six-view grids are left
     as they were: those are for finding your way round a model rather than for
     working from, and every member's outline near and far is what that job
     wants.

     This is computed, not sampled. Every member here is a 2D profile extruded
     between two planes, so its surface is flat pieces: over any point of the
     page the depth of a piece is a linear function of where you are on the
     page, and an edge crossing one changes from in front to behind only where
     it crosses that piece's boundary. So the crossings are solved for and the
     stretches between them are decided once each, exactly, rather than by
     testing points along the edge and hoping the step was small enough.

     Two things follow from doing it this way and are worth knowing:

       - it runs before dxfDedupe, not after. Both caps of a plate seen face on
         land on the same lines, and the deduper keeps whichever came first. If
         that were the far cap, the near cap's own face would then hide it and
         the plate would vanish entirely.
       - a round hole is kept or dropped whole. An arc is an ARC in the file,
         and there is no such thing as most of one; a hole half behind a flange
         is drawn whole rather than turned into a polygon to be cut. Said here
         because it is the one place this is not exact. */

  var HLR_EPS = 0.02;                     // mm of depth. Steel that touches steel
                                          // is not steel in front of steel.

  /* The plane that gives a face's depth anywhere on the page: d = a*u + b*v + c.
     Null for a face seen edge on - it covers no area, so it hides nothing, and
     its own boundary is drawn by the edge pass anyway. */
  function facePlane(p) {
    var n = p.length, i0 = 0, i1 = -1, i2 = -1, best = 0;
    for (var i = 1; i < n; i++) {         // the far point, then the point off that line
      var d = Math.hypot(p[i][0] - p[0][0], p[i][1] - p[0][1]);
      if (d > best) { best = d; i1 = i; }
    }
    if (i1 < 0) return null;
    best = 0;
    for (i = 1; i < n; i++) {
      var det = (p[i1][0] - p[i0][0]) * (p[i][1] - p[i0][1]) -
                (p[i1][1] - p[i0][1]) * (p[i][0] - p[i0][0]);
      if (Math.abs(det) > Math.abs(best)) { best = det; i2 = i; }
    }
    if (i2 < 0 || Math.abs(best) < 1e-9) return null;
    var x1 = p[i0][0], y1 = p[i0][1], z1 = p[i0][2];
    var x2 = p[i1][0], y2 = p[i1][1], z2 = p[i1][2];
    var x3 = p[i2][0], y3 = p[i2][1], z3 = p[i2][2];
    var det2 = (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1);
    if (Math.abs(det2) < 1e-9) return null;
    var a = ((z2 - z1) * (y3 - y1) - (y2 - y1) * (z3 - z1)) / det2;
    var b = ((x2 - x1) * (z3 - z1) - (z2 - z1) * (x3 - x1)) / det2;
    return { a: a, b: b, c: z1 - a * x1 - b * y1 };
  }

  function faceBox(f) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, d0 = Infinity, d1 = -Infinity;
    f.poly.forEach(function (q) {
      if (q[0] < x0) x0 = q[0];
      if (q[0] > x1) x1 = q[0];
      if (q[1] < y0) y0 = q[1];
      if (q[1] > y1) y1 = q[1];
    });
    // the deepest and shallowest the plane reaches over that box
    [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].forEach(function (q) {
      var d = f.a * q[0] + f.b * q[1] + f.c;
      if (d < d0) d0 = d;
      if (d > d1) d1 = d;
    });
    f.x0 = x0; f.y0 = y0; f.x1 = x1; f.y1 = y1; f.d0 = d0; f.d1 = d1;
    return f;
  }

  /* Every flat piece of every member, as it lands on the page: the polygon it
     covers, the holes punched out of it, and its depth plane. */
  function viewFaces(members, view) {
    var R = new THREE.Vector3(view.right[0], view.right[1], view.right[2]);
    var U = new THREE.Vector3(view.up[0], view.up[1], view.up[2]);
    var Vd = new THREE.Vector3(view.dir[0], view.dir[1], view.dir[2]);
    var out = [];
    function push(poly, holes) {
      var pl = facePlane(poly);
      if (!pl) return;
      out.push(faceBox({ poly: poly, holes: holes || [],
                         a: pl.a, b: pl.b, c: pl.c }));
    }
    members.forEach(function (it) {
      var m = it.matrix, Z = capPlanes(it.thk, it.caps);
      var P = function (x, y, z) {
        var p = new THREE.Vector3(x, y, z).applyMatrix4(m);
        return [p.dot(R), p.dot(U), p.dot(Vd)];
      };
      (it.rings.outers || []).forEach(function (o, i) {
        var hs = it.rings.holes[i] || [];
        // the two caps, each with the ring's holes taken out of it
        ['lo', 'hi'].forEach(function (side) {
          var zf = Z[side];
          push(o.map(function (q) { return P(q[0], q[1], zf(q[0], q[1])); }),
               hs.map(function (h) {
                 return h.map(function (q) { return P(q[0], q[1], zf(q[0], q[1])); });
               }));
        });
        // one quad per edge, of the outline and of every hole through it
        [o].concat(hs).forEach(function (r) {
          for (var j = 0; j < r.length; j++) {
            var a = r[j], b = r[(j + 1) % r.length];
            push([P(a[0], a[1], Z.lo(a[0], a[1])), P(b[0], b[1], Z.lo(b[0], b[1])),
                  P(b[0], b[1], Z.hi(b[0], b[1])), P(a[0], a[1], Z.hi(a[0], a[1]))], []);
          }
        });
      });
    });
    return out;
  }

  // even-odd, on the page
  function inPoly(poly, x, y) {
    var inside = false, n = poly.length;
    for (var i = 0, j = n - 1; i < n; j = i++) {
      var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if ((yi > y) !== (yj > y) &&
          x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function onFace(f, x, y) {
    if (!inPoly(f.poly, x, y)) return false;
    for (var i = 0; i < f.holes.length; i++) if (inPoly(f.holes[i], x, y)) return false;
    return true;
  }
  // where along p->q the segment crosses a ring, as parameters in (0,1)
  function crossings(ring, px, py, dx, dy, out) {
    for (var i = 0, n = ring.length, j = n - 1; i < n; j = i++) {
      var ax = ring[j][0], ay = ring[j][1], bx = ring[i][0], by = ring[i][1];
      var ex = bx - ax, ey = by - ay;
      var den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-12) continue;
      var t = ((ax - px) * ey - (ay - py) * ex) / den;
      var u = ((ax - px) * dy - (ay - py) * dx) / den;
      if (t > 1e-9 && t < 1 - 1e-9 && u >= -1e-9 && u <= 1 + 1e-9) out.push(t);
    }
  }

  /* One segment against every face that could cover it. Returns the stretches
     of it that are still to be drawn, as [t0,t1] pairs of its own length. */
  function visibleRuns(seg, faces) {
    var px = seg[0][0], py = seg[0][1], pd = seg[0][2];
    var qx = seg[1][0], qy = seg[1][1], qd = seg[1][2];
    var dx = qx - px, dy = qy - py, dd = qd - pd;
    var sx0 = Math.min(px, qx), sx1 = Math.max(px, qx);
    var sy0 = Math.min(py, qy), sy1 = Math.max(py, qy);
    var sd0 = Math.min(pd, qd);
    var hid = [];
    for (var k = 0; k < faces.length; k++) {
      var f = faces[k];
      if (f.x1 < sx0 || f.x0 > sx1 || f.y1 < sy0 || f.y0 > sy1) continue;
      if (f.d1 <= sd0 + HLR_EPS) continue;      // the whole face is behind it
      var ts = [0, 1];
      crossings(f.poly, px, py, dx, dy, ts);
      for (var h = 0; h < f.holes.length; h++) crossings(f.holes[h], px, py, dx, dy, ts);
      ts.sort(function (a, b) { return a - b; });
      for (var i = 0; i + 1 < ts.length; i++) {
        var t0 = ts[i], t1 = ts[i + 1];
        if (t1 - t0 < 1e-9) continue;
        var tm = (t0 + t1) / 2, mx = px + dx * tm, my = py + dy * tm;
        if (!onFace(f, mx, my)) continue;
        // in front by more than a touch? then this stretch is behind steel
        if (f.a * mx + f.b * my + f.c > pd + dd * tm + HLR_EPS) hid.push([t0, t1]);
      }
    }
    if (!hid.length) return [[0, 1]];
    hid.sort(function (a, b) { return a[0] - b[0]; });
    var runs = [], at = 0;
    for (var j = 0; j < hid.length; j++) {
      if (hid[j][0] > at + 1e-9) runs.push([at, hid[j][0]]);
      if (hid[j][1] > at) at = hid[j][1];
      if (at >= 1 - 1e-9) break;
    }
    if (at < 1 - 1e-9) runs.push([at, 1]);
    return runs;
  }

  /* The whole pass. segs carry a third component - the depth of each end - put
     there by dxfMemberEdges; it is ignored by everything that writes DXF, which
     reads [0] and [1] only. */
  function hideSegs(segs, faces) {
    var out = [];
    segs.forEach(function (s) {
      if (s[0][2] === undefined) { out.push(s); return; }
      var runs = visibleRuns(s, faces);
      if (runs.length === 1 && runs[0][0] === 0 && runs[0][1] === 1) { out.push(s); return; }
      var dx = s[1][0] - s[0][0], dy = s[1][1] - s[0][1], dd = s[1][2] - s[0][2];
      runs.forEach(function (r) {
        if (r[1] - r[0] < 1e-6) return;
        out.push([[s[0][0] + dx * r[0], s[0][1] + dy * r[0], s[0][2] + dd * r[0]],
                  [s[0][0] + dx * r[1], s[0][1] + dy * r[1], s[0][2] + dd * r[1]]]);
      });
    });
    return out;
  }
  // is this point on the page, at this depth, in front of every face over it?
  function seenPoint(faces, x, y, d) {
    for (var k = 0; k < faces.length; k++) {
      var f = faces[k];
      if (f.x1 < x || f.x0 > x || f.y1 < y || f.y0 > y) continue;
      if (f.d1 <= d + HLR_EPS) continue;
      if (onFace(f, x, y) && f.a * x + f.b * y + f.c > d + HLR_EPS) return false;
    }
    return true;
  }
  /* An arc is kept unless the whole of it is behind steel. There is no partial
     ARC in R12, and a hole turned into a polygon so that half of it could be
     removed would cost more than the honesty is worth. */
  function hideArcs(arcs, faces) {
    return arcs.filter(function (ac) {
      if (ac.c[2] === undefined) return true;
      for (var i = 0; i < 16; i++) {
        var th = i / 16 * Math.PI * 2;
        if (seenPoint(faces, ac.c[0] + ac.r * Math.cos(th),
                      ac.c[1] + ac.r * Math.sin(th), ac.c[2])) return true;
      }
      return false;
    });
  }
  /* The hole centres the pitch chains are built from. A hole that was removed
     for being behind a flange must not leave its dimension behind. */
  function hidePoints(pts, faces) {
    return pts.filter(function (p) {
      return p[2] === undefined || seenPoint(faces, p[0], p[1], p[2]);
    });
  }

  // Two projections of the same plate land on the same line more often than not
  // - both caps of a plate seen face on, every copy of a repeated member. One
  // line each keeps the file a tenth of the size and the drawing readable.
  function dxfDedupe(segs) {
    var seen = {}, out = [];
    segs.forEach(function (s) {
      var a = s[0], b = s[1];
      if (Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6) return;
      var k1 = dxfNum(a[0]) + ',' + dxfNum(a[1]), k2 = dxfNum(b[0]) + ',' + dxfNum(b[1]);
      var k = k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1;
      if (seen[k]) return;
      seen[k] = 1;
      out.push(s);
    });
    return out;
  }

  function segsBox(segs, arcs) {
    var b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    function hit(p) {
      if (p[0] < b.x0) b.x0 = p[0];
      if (p[0] > b.x1) b.x1 = p[0];
      if (p[1] < b.y0) b.y0 = p[1];
      if (p[1] > b.y1) b.y1 = p[1];
    }
    segs.forEach(function (s) { s.forEach(hit); });
    /* An arc reaches past its own ends wherever it crosses an axis, so the four
       quadrant points count whenever the sweep passes through them. Measuring
       an arc by its endpoints alone is how a part comes out narrower than the
       hole that was cut in it. */
    (arcs || []).forEach(function (a) {
      if (a.full) {
        hit([a.c[0] - a.r, a.c[1] - a.r]); hit([a.c[0] + a.r, a.c[1] + a.r]);
        return;
      }
      var s = a.a0, e = a.a1 < a.a0 ? a.a1 + 360 : a.a1;
      hit([a.c[0] + a.r * Math.cos(s * Math.PI / 180),
           a.c[1] + a.r * Math.sin(s * Math.PI / 180)]);
      hit([a.c[0] + a.r * Math.cos(a.a1 * Math.PI / 180),
           a.c[1] + a.r * Math.sin(a.a1 * Math.PI / 180)]);
      [0, 90, 180, 270, 360, 450, 540, 630].forEach(function (q) {
        if (q >= s && q <= e)
          hit([a.c[0] + a.r * Math.cos(q * Math.PI / 180),
               a.c[1] + a.r * Math.sin(q * Math.PI / 180)]);
      });
    });
    if (!isFinite(b.x0)) return { x0: 0, y0: 0, x1: 0, y1: 0 };
    return b;
  }

  /* The distinct parts, one entry each, with how many were placed. Grouped by
     the part id together with its extruded length, because one SECT definition
     placed at three lengths is three things to fabricate, not one. */
  function dxfParts(list) {
    var by = {}, order = [];
    list.forEach(function (it) {
      var k = it.plateId + '|' + it.thk + '|' + capKey(it.caps);
      if (!by[k]) { by[k] = { it: it, n: 0, key: k }; order.push(k); }
      by[k].n++;
    });
    return order.map(function (k) { return by[k]; });
  }

  /* Every CUT the sheet made in this plate, as it was placed, grouped by the
     shape it is. Reading the cuts rather than the boolean result is the
     difference between knowing and guessing. Once the subtraction has run, a
     cut that reached an edge is indistinguishable from the outline it melted
     into, and the only way back was to hunt for it - an arc by fitting circles
     to runs of vertices, a notch by looking for square concave corners - which
     found the common cases, missed a trapezoidal notch entirely, and called an
     H section's root fillets holes. The sheet offers three shapes and says
     which one it meant; this reads that.

     Round cuts come back for a diameter, everything else for the linear rules
     the outline gets. One per distinct shape, the way one D22 stands for four
     identical holes: the round one taken is the furthest up and right, because
     its leader leaves that way, and the rest the furthest down and left,
     because their dimensions do. */
  function cutFeatures(p) {
    var raw = p.it.rings && p.it.rings.cuts;
    if (!raw) {                        // a ring set from before cuts were kept
      raw = [];
      p.it.rings.outers.forEach(function (o, i) {
        (p.it.rings.holes[i] || []).forEach(function (h) { raw.push(h); });
      });
    }
    var byR = {}, rOrder = [], byS = {}, sOrder = [];
    raw.forEach(function (ring) {
      if (!ring || ring.length < 3) return;
      var hc = ringCircle(ring);
      if (hc) {
        var rk = Math.round(hc.r * 100);
        if (!byR[rk]) { byR[rk] = hc; rOrder.push(rk); }
        else if (hc.c[0] + hc.c[1] > byR[rk].c[0] + byR[rk].c[1]) byR[rk] = hc;
        return;
      }
      var c = cutBox(ring);
      if (!c) return;
      var r2 = function (v) { return Math.round(v * 100); };
      var sk = [r2(c.x1 - c.x0), r2(c.y1 - c.y0),
                r2(c.botLen), r2(c.topLen)].join('|');
      if (!byS[sk]) { byS[sk] = c; sOrder.push(sk); }
      else if (c.x0 + c.y0 < byS[sk].x0 + byS[sk].y0) byS[sk] = c;
    });
    return { round: rOrder.map(function (k) { return byR[k]; }),
             poly:  sOrder.map(function (k) { return byS[k]; }) };
  }
  /* One cut, measured the way the outline is: the bottom edge as it is, the
     top edge when it is a different length, and the height.
     A cut turned by ANG is measured across its bounding box - the sides are
     no longer the bottom and the top of anything. */
  function cutBox(ring) {
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    ring.forEach(function (q) {
      if (q[0] < x0) x0 = q[0];
      if (q[0] > x1) x1 = q[0];
      if (q[1] < y0) y0 = q[1];
      if (q[1] > y1) y1 = q[1];
    });
    if (!(x1 - x0 > 1e-9) || !(y1 - y0 > 1e-9)) return null;
    var tol = Math.max(1e-6, (y1 - y0) * 1e-5);
    var bot = ringsSpanAt([ring], y0, tol), top = ringsSpanAt([ring], y1, tol);
    var len = function (e) { return e ? e[1] - e[0] : 0; };
    return { x0: x0, x1: x1, y0: y0, y1: y1, bot: bot, top: top,
             botLen: len(bot), topLen: len(top),
             showTop: !!top && Math.abs(len(top) - len(bot))
                              > Math.max(1e-6, (x1 - x0) * 1e-5) };
  }
  function partCircle(p) {
    return p.it.rings.outers.length === 1 && ringCircle(p.it.rings.outers[0]);
  }
  /* The horizontal run of the outline at one height - the top edge or the
     bottom edge as a length, rather than the bounding box that contains both.
     A trapezoid's two parallel sides are different lengths and both belong on
     the drawing; taking the box gave one number, and when the top was the
     longer of the two it wrote that number under the bottom edge.
     Read off the geometry, not off the shape keyword, so a side that a CUT has
     shortened is measured as it ended up. */
  function ringsSpanAt(rings, y, tol) {
    var lo = Infinity, hi = -Infinity;
    rings.forEach(function (o) {
      for (var i = 0; i < o.length; i++) {
        var a = o[i], b = o[(i + 1) % o.length];
        if (Math.abs(a[1] - y) > tol || Math.abs(b[1] - y) > tol) continue;
        lo = Math.min(lo, a[0], b[0]);
        hi = Math.max(hi, a[0], b[0]);
      }
    });
    return hi - lo > tol ? [lo, hi] : null;      // a corner is not an edge
  }
  function edgeSpan(p, y) {
    return ringsSpanAt(p.it.rings.outers, y,
                       Math.max(1e-6, (p.box.y1 - p.box.y0) * 1e-5));
  }

  // does this part want a dimension over the top? - the shelf has to leave room
  function partPadTop(p, D) {
    var pad = p.it.spec.SHAPE === 'SECT'
      ? sectPadTop(p.it.spec, p.box.x1 - p.box.x0, p.box.y1 - p.box.y0, D) : 0;
    if (topEdgeDim(p))
      pad = Math.max(pad, D.origin + D.base + D.textGap + D.text.dim * 1.2);
    /* A cut is measured as the sheet wrote it, and the sheet is allowed to
       hang one over an edge - only the overlap comes out of the steel. So the
       call-out can reach past the part it belongs to, by however far the cut
       does plus its own band. */
    var band = D.innerOrigin + D.innerBase + D.textGap + D.text.dim * 1.2;
    cutFeatures(p).poly.forEach(function (c) {
      var over = Math.max(0, c.y1 - p.box.y1);
      pad = Math.max(pad, over + (c.showTop ? band : 0));
    });
    return pad;
  }
  // and the room a cut hanging past the right-hand edge needs
  function cutPadRight(p) {
    var pad = 0;
    cutFeatures(p).poly.forEach(function (c) {
      pad = Math.max(pad, c.x1 - p.box.x1);
    });
    return pad;
  }
  /* Plates only. A rolled section is described by its own call-outs, and its
     top edge is not a side you would dimension: on an angle it is what is left
     of the leg tip after the toe radius has eaten it, so the rule offered a
     flat of 1mm on an L-90x75x9x7 as if it meant something. */
  function topEdgeDim(p) {
    if (partCircle(p) || p.it.spec.SHAPE === 'SECT') return null;
    var top = edgeSpan(p, p.box.y1);
    if (!top) return null;
    var bot = edgeSpan(p, p.box.y0);
    var tol = Math.max(1e-6, (p.box.x1 - p.box.x0) * 1e-5);
    if (bot && Math.abs((top[1] - top[0]) - (bot[1] - bot[0])) <= tol) return null;
    return top;                                  // a rectangle says it once
  }
  function leadCount(p) {
    var n = cutFeatures(p).round.length + (partCircle(p) ? 1 : 0);
    if (p.it.spec.SHAPE === 'SECT')
      n += sectCallouts(p.it.spec, p.box.x1 - p.box.x0,
                        p.box.y1 - p.box.y0).leads.length;
    return n;
  }

  /* Is this ring a circle? A hole is polygonised into 48 segments long before
     it reaches here, so "circle" has to be decided from the geometry: every
     vertex the same distance from the centroid, within a fraction of a percent.
     Returns the centre and radius, or null for anything else. */
  /* ---------------- polygon back to arcs ----------------
     A hole is a circle right up until the boolean runs, and after it the plate
     outline is one ring of points with nothing saying which of them came from
     where. The circle itself is not lost though - buildPlate2D keeps the CUT
     rings it was handed - so the question is only which points sit on it, and
     that is a membership test against a known centre and radius rather than a
     fit. Fitting is what went wrong before: with no candidate to check against
     it put enormous circles through nearly straight runs and read an H-section
     root fillet as a bolt hole. Nothing here can do that. A point that is on no
     known circle stays a line, which is the honest answer. */
  function arcTol(r) { return Math.max(r * 2e-3, 1e-6); }
  function onCircle(p, k) {
    return Math.abs(Math.hypot(p[0] - k.c[0], p[1] - k.c[1]) - k.r) <= arcTol(k.r);
  }
  function angAt(p, k) {
    var a = Math.atan2(p[1] - k.c[1], p[0] - k.c[0]) * 180 / Math.PI;
    return a < 0 ? a + 360 : a;
  }
  /* An edge counts as part of a circle only if both ends are on it AND its
     middle very nearly is too. Two points can sit on the same circle with a
     straight plate edge between them - a chord, not an arc - and the midpoint
     is what tells them apart: on one facet of a 32-gon it is 0.995r out, on a
     chord across the circle it is nowhere near. */
  function edgeOnCircle(p, q, k) {
    if (!onCircle(p, k) || !onCircle(q, k)) return false;
    var m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    return Math.hypot(m[0] - k.c[0], m[1] - k.c[1]) >= k.r * 0.866;   // 60 deg
  }
  /* The ring as things to draw: runs of edges on one circle become arcs, and a
     run that closes on itself becomes the circle. Everything else is a line. */
  function ringDraw(ring, circles) {
    var out = { lines: [], arcs: [] }, n = ring.length, i;
    if (n < 2) return out;
    var owner = new Array(n);                  // edge i -> which circle, or -1
    for (i = 0; i < n; i++) {
      var p = ring[i], q = ring[(i + 1) % n];
      owner[i] = -1;
      for (var k = 0; k < circles.length; k++)
        if (edgeOnCircle(p, q, circles[k])) { owner[i] = k; break; }
    }
    var any = false;
    for (i = 0; i < n; i++) if (owner[i] >= 0) any = true;
    if (!any) {
      for (i = 0; i < n; i++) out.lines.push([ring[i], ring[(i + 1) % n]]);
      return out;
    }
    // a whole ring on one circle is the circle
    var whole = owner.every(function (o) { return o === owner[0]; });
    if (whole && owner[0] >= 0) {
      out.arcs.push({ c: circles[owner[0]].c, r: circles[owner[0]].r, full: true });
      return out;
    }
    // otherwise walk from an edge that starts a run, so no run is split in two
    var start = 0;
    while (start < n && owner[start] === owner[(start - 1 + n) % n]) start++;
    if (start >= n) start = 0;
    i = 0;
    while (i < n) {
      var e = (start + i) % n, own = owner[e], len = 1;
      while (i + len < n && owner[(start + i + len) % n] === own) len++;
      if (own < 0) {
        for (var j = 0; j < len; j++) {
          var s = (start + i + j) % n;
          out.lines.push([ring[s], ring[(s + 1) % n]]);
        }
      } else {
        var K = circles[own];
        var p0 = ring[e], p1 = ring[(e + len) % n];
        var a0 = angAt(p0, K), a1 = angAt(p1, K);
        var d = angAt(ring[(e + 1) % n], K) - a0;      // which way the run runs
        if (d > 180) d -= 360; else if (d < -180) d += 360;
        out.arcs.push(d >= 0 ? { c: K.c, r: K.r, a0: a0, a1: a1 }
                             : { c: K.c, r: K.r, a0: a1, a1: a0 });
      }
      i += len;
    }
    return out;
  }
  /* ---------------- the pitch chain ----------------
     An outline and a hole pattern with only an overall size on them cannot be
     drilled from: nothing says where the holes go. Every number needed is
     already on the sheet - the CUT rows the drawing keeps - so the chain is
     read off the hole centres rather than asked for.
     Positions are pooled across all the CUT rows on the plate and then
     deduped, which is what turns four quadrant rows into one chain per axis
     instead of four drawn over each other. */
  function dimNum(v) {
    var n = Math.round(v * 10) / 10;
    return String(n);
  }
  function chainOps(pos, lo, hi) {
    var u = [];
    pos.slice().sort(function (a, b) { return a - b; }).forEach(function (v) {
      if (!u.length || Math.abs(v - u[u.length - 1]) > 1e-3) u.push(v);
    });
    if (u.length < 2) return [];                 // one line of holes says nothing
    var all = [lo].concat(u).concat([hi]), links = [], i;
    for (i = 0; i < all.length - 1; i++) {
      var d = all[i + 1] - all[i];
      if (d > 1e-3) links.push({ a: all[i], b: all[i + 1], v: d });
    }
    /* Two or more equal links in a row collapse to N@P=total, which is the
       usual shop-drawing form. A run of one is just its own number. */
    var out = [], k = 0;
    while (k < links.length) {
      var j = k + 1;
      while (j < links.length && Math.abs(links[j].v - links[k].v) < 1e-3) j++;
      var n = j - k;
      if (n >= 2) {
        out.push({ a: links[k].a, b: links[j - 1].b,
                   txt: n + '@' + dimNum(links[k].v) + '=' + dimNum(n * links[k].v) });
      } else {
        for (var m = k; m < j; m++)
          out.push({ a: links[m].a, b: links[m].b, txt: dimNum(links[m].v) });
      }
      k = j;
    }
    return out;
  }
  // every round CUT on a plate, in the plate's own 2D frame
  /* ---------------- which members does a bolt go through ----------------

     The hole is written once, as the bolt, and the members it crosses are
     worked out rather than typed. That is the whole reason BOLT exists as
     something separate from BAR: a bar is stock and knows nothing about what
     it lies next to, and asking the sheet to say "there is a bolt here" and
     then "there is a hole here" and "and here" and "and here" is asking it to
     say one fact four times, which is four chances to say it differently.

     The test is done in each member's OWN frame, which is the frame its
     profile and its part drawing are already in - so a hit comes back as an
     (x, y) that can be drawn without converting anything.

     A member is its profile swept over local z from -thk/2 to +thk/2. The
     bolt's shank is a segment. Clip the segment to that slab, take the middle
     of what is left, and ask whether that point is inside the profile. Perpen-
     dicular or skew, the same three lines answer it.

     What is deliberately NOT done here: the area is not touched. A drilled
     hole is not deducted from a steel take-off, and a bolt that quietly made
     every plate lighter would be a worse lie than no hole at all. */
  var DRILL_SKEW_COS = Math.cos(5 * Math.PI / 180);   // 5 deg off the face normal
  var DRILL_ALONG = Math.SQRT1_2;                    // 45 deg: through, or across
  var DRILL_SAMPLES = 41;
  var drillsFor = null;
  /* Sampled rather than clipped, and the first version was clipped. Clipping
     the shank to the member's z slab and taking the middle of what is left is
     right only while the slab is what bounds the member in the bolt's own
     direction. Through a plate it is. Across a section it is not - the slab is
     the whole 1600 of a column and the thing that bounds the bolt is the
     profile - so the midpoint of a bolt that only clips a flange landed in the
     cleat beyond it and the column came out undrilled.

     Walking the shank and keeping the points that are inside the member has no
     such case to get wrong, and 41 samples over a 50mm bolt is finer than any
     hole it could be reporting. */
  function assignDrills() {
    if (drillsFor === items) return;
    drillsFor = items;
    items.forEach(function (it) { it.drills = []; });
    var bolts = items.filter(function (it) { return it.spec && it.spec.__bolt; });
    if (!bolts.length || typeof THREE === 'undefined') return;
    var inv = new THREE.Matrix4(), A = new THREE.Vector3(), B = new THREE.Vector3(),
        P = new THREE.Vector3();
    bolts.forEach(function (b) {
      var dia = num(b.spec.HOLE, 0) || num(b.spec.D, 0) + 2;
      var half = num(b.thk, 0) / 2;
      items.forEach(function (m) {
        if (m === b || !m.spec || m.spec.__bolt) return;      // a bolt drills no bolt
        var mh = num(m.thk, 0) / 2;
        if (!(mh > 0)) return;
        inv.copy(m.matrix).invert();
        A.set(0, 0, -half).applyMatrix4(b.matrix).applyMatrix4(inv);
        B.set(0, 0,  half).applyMatrix4(b.matrix).applyMatrix4(inv);
        var n = 0, sx = 0, sy = 0, sz = 0;
        for (var i = 0; i < DRILL_SAMPLES; i++) {
          var t = i / (DRILL_SAMPLES - 1);
          P.copy(A).lerp(B, t);
          if (P.z < -mh || P.z > mh) continue;
          var pt = [P.x, P.y], inside = false;
          for (var k = 0; k < m.rings.outers.length && !inside; k++) {
            if (!pointInRing(pt, m.rings.outers[k])) continue;
            inside = !(m.rings.holes[k] || []).some(function (h) { return pointInRing(pt, h); });
          }
          if (!inside) continue;
          n++; sx += P.x; sy += P.y; sz += P.z;
        }
        if (!n) return;
        var dx = B.x - A.x, dy = B.y - A.y, dz = B.z - A.z;
        var len = Math.hypot(dx, dy, dz) || 1;
        var along = Math.abs(dz) / len;
        /* Through the thickness the hole belongs on the profile the part
           drawing already shows. Across the member it belongs on a side
           elevation, at how far along it is and how high up - which is a view
           that has to be drawn. AXIS says which way the bolt ran, because a
           section can be drilled through the web and through a flange and
           those are two different elevations. */
        m.drills.push(along >= DRILL_ALONG
          ? { view: 'face', x: sx / n, y: sy / n, d: dia,
              bolt: b.spec.ID, skew: along < DRILL_SKEW_COS }
          : { view: 'side', z: sz / n, x: sx / n, y: sy / n, d: dia,
              axis: Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y',
              bolt: b.spec.ID, skew: false });
      });
    });
  }
  function holeCentres(it) {
    var out = [];
    (it.rings && it.rings.cuts || []).forEach(function (rg) {
      var k = ringCircle(rg);
      if (k) out.push(k.c);
    });
    /* a drilled hole is a hole for the pitch chain as much as a CUT one is -
       the chain is what makes three holes readable as 40, 40 rather than as
       three numbers off an edge */
    (it.drills || []).forEach(function (h) {
      if (h.view === 'face') out.push([h.x, h.y]);
    });
    /* The side-elevation holes are deliberately left out of the pitch chain.
       The chain works across one view and these sit in another, so feeding it
       both would dimension from a hole in the section to a hole in the
       elevation - a number measured across a gap that is not a distance. */
    return out;
  }
  // both caps of a plate seen face on give the same circle; one is enough
  function arcDedupe(arcs) {
    var seen = {}, out = [];
    arcs.forEach(function (a) {
      var k = dxfNum(a.c[0]) + ',' + dxfNum(a.c[1]) + ',' + dxfNum(a.r) + ',' +
              (a.full ? 'F' : dxfNum(a.a0) + ',' + dxfNum(a.a1));
      if (seen[k]) return;
      seen[k] = 1;
      out.push(a);
    });
    return out;
  }
  function ringCircle(pts) {
    if (!pts || pts.length < 12) return null;
    var n = pts.length, cx = 0, cy = 0, i;
    for (i = 0; i < n; i++) { cx += pts[i][0]; cy += pts[i][1]; }
    cx /= n; cy /= n;
    var lo = Infinity, hi = 0;
    for (i = 0; i < n; i++) {
      var d = Math.hypot(pts[i][0] - cx, pts[i][1] - cy);
      if (d < lo) lo = d;
      if (d > hi) hi = d;
    }
    if (!(hi > 0) || (hi - lo) / hi > 0.02) return null;
    /* Every point at one radius is not enough, and the way it fails is quiet.
       A rounded rectangle carries vertices ONLY at its corners - the flats
       have none to give them away - so a near-square tube with a small corner
       passes this test outright. A 300x300x9 tube with an r18 corner has all
       36 of its points between 193.19 and 195.68: 1.27% apart, well inside
       the 2%. It was being weighed as a Ø391 disc, which came out NEGATIVE
       once the bore was subtracted, and drawn in the DXF as a circle.

       So ask the ring to have a circle's AREA as well as its radius. An
       n-gon inscribed in radius r encloses n/2 sin(2pi/n) r^2 exactly, and a
       ring that is not one is not close: the tube above sits at 66% of it. */
    var poly = Math.abs(ringArea(pts));
    var ngon = n / 2 * Math.sin(2 * Math.PI / n) * hi * hi;
    if (!(ngon > 0) || Math.abs(poly - ngon) / ngon > 0.01) return null;
    /* hi, the circumradius, not the mean of hi and lo.
       Every circle in this file is drawn by circleOutline, which puts its
       vertices ON the true circle and leaves the flats inside it. So hi IS the
       radius that was asked for, and the fitted mean sits 0.1% inside it - which
       is a Ø22 bolt hole exported at 21.95. */
    return { c: [cx, cy], r: hi };
  }
  /* The area of a ring, with a circle counted as a circle.

     Curves here are polygons: a circle is 48 straight edges inscribed in the
     true one, so it has always measured UNDER - 99.71% of the circle it stands
     for. That was defensible while the drawing was also 48 lines. It stopped
     being defensible when the DXF started going out as a real CIRCLE, because
     then one app hands a fabricator a Ø48.6 circle and prices something 0.29%
     smaller.

     So a ring the drawing would call a circle is weighed as one. Everything
     else - an H, a rounded rectangle, a plate - is the polygon it is, and its
     fillets are still eight segments a quarter. */
  function ringAreaTrue(r) {
    var k = ringCircle(r);
    return k ? Math.PI * k.r * k.r : Math.abs(ringArea(r));
  }
  // Arial has no fixed advance, so this is an estimate - deliberately generous,
  // because a rule that comes up short of its own text is the visible failure.
  function dxfTextWidth(s, h) { return String(s).length * h * 0.62; }

  /* What a rolled section needs called out beyond its overall height and width:
     the web, the flanges and the root radius. A reader given only H-700x300 has
     to go and look the rest up; the profile is drawn from those numbers, so the
     drawing may as well say them.

     A thickness is a measurement, not a note, so it comes back as a dimension
     and not as something on a leader. Flange thicknesses are dimensioned off
     the flange tip to a line on the **right** of the section, the way a section
     table draws t2; the web is too thin to letter between its own dots, so it
     is a narrow dimension whose number is carried out clear of the steel - the
     t1 of the same table. Only the root radius stays on a leader: it is a note
     about a shape, and there is no pair of faces to measure it between.

     Points come back in coordinates measured from the section's own bounding box
     - u right from its left edge, v up from its bottom - because that is what
     the part layout can place without knowing how the profile was parametrised.
     Each leader carries the direction it should run so it leaves the steel at
     once rather than crossing it.

     Field names are the sheet's own:
       H   h bb bt tw tf1 tf2 r1 r2      tf1 bottom flange, tf2 top
       C   h b tw tf rw rf               rw web root, rf flange toe
       L   a b t1 t2 r1 r2               t1 the a leg, t2 the b leg           */
  function sectCallouts(sp, w, h) {
    var dims = [], narrow = [], leads = [];
    var n = function (v) { return rnd(num(v, 0)); };
    // a flange thickness: measured up the flange tip, dimensioned to the right
    function vdim(x, y0, y1, t) {
      if (!isFinite(x) || !isFinite(y0) || !isFinite(y1)) return;
      if (Math.abs(y1 - y0) < 1e-9) return;
      dims.push({ x: x, y0: Math.min(y0, y1), y1: Math.max(y0, y1),
                  txt: String(n(t)) });
    }
    /* A web thickness: dots on the two faces, number carried out to the right.
       `up` lifts the whole thing above the section on extension lines instead
       of laying it across at height y - for a shape whose thin part is open at
       the top, which an angle's leg is and a web between two flanges is not. */
    function hnarrow(x0, x1, y, t, up) {
      if (!isFinite(x0) || !isFinite(x1) || Math.abs(x1 - x0) < 1e-9) return;
      narrow.push({ x0: x0, x1: x1, y: y, txt: String(n(t)), up: !!up });
    }
    /* Leaders carry the step they are to be drawn at, counted **per direction**.
       Two call-outs heading the same way have to land on different shoulders or
       the numbers sit on top of each other; two heading different ways never
       meet, and stepping the second one out is length spent for nothing. */
    var steps = {};
    function lead(u, v, txt, dx, dy) {
      if (u == null || !isFinite(u) || !isFinite(v)) return;
      var key = dx + ',' + dy;
      leads.push({ u: u, v: v, txt: txt, dx: dx, dy: dy, step: steps[key] || 0 });
      steps[key] = (steps[key] || 0) + 1;
    }
    // one leader per distinct radius: a section with the same root and toe
    // radius does not want the same number written on it twice
    var seenR = {};
    function radLead(u, v, r, dx, dy) {
      if (!(r > 0) || seenR[r]) return;
      seenR[r] = 1;
      lead(u, v, 'r ' + n(r), dx, dy);
    }
    /* A root fillet is concave: its centre of curvature sits in the open air
       off the corner, so the point of the arc nearest that air is centre minus
       r/sqrt2 each way - 0.293 r from the corner - and the leader runs on
       towards the centre. That is the one direction out of the corner that
       does not cut back through the steel.
       A toe is the other way round - convex, material behind it - so the arc
       point is 0.293 r back from the tip and the leader heads out. Same
       geometry the section preview has been drawing its R arrows from. */
    var K = 1 - Math.SQRT1_2;                     // 0.2929
    if (sp.SECT === 'H') {
      // h bb bt tw tf1 tf2 r1 - seven values, no toe rounding on an H
      var cx = w / 2, tw = num(sp.tw, 0), t1 = num(sp.tf1, 0), t2 = num(sp.tf2, 0);
      var r1 = num(sp.r1, 0);
      var bt = num(sp.bt, 0), bb = num(sp.bb, 0);
      vdim(bt > 0 ? cx + bt / 2 : w, h - t2, h, t2);
      vdim(bb > 0 ? cx + bb / 2 : w, 0, t1, t1);
      hnarrow(cx - tw / 2, cx + tw / 2, h / 2, tw);
      radLead(cx + tw / 2 + r1 * K, h - t2 - r1 * K, r1, 1, -1);        // web root
    } else if (sp.SECT === 'C') {
      // h b tw tf rw rf - the web root and the flange toe
      var ctw = num(sp.tw, 0), ctf = num(sp.tf, 0);
      var rw = num(sp.rw, 0), rf = num(sp.rf, 0);
      vdim(w, h - ctf, h, ctf);
      vdim(w, 0, ctf, ctf);
      hnarrow(0, ctw, h / 2, ctw);
      radLead(ctw + rw * K, ctf + rw * K, rw, 1, 1);                    // web root
      radLead(w - rf * K, h - ctf + rf * K, rf, 1, -1);                 // flange toe
    } else if (sp.SECT === 'L') {
      /* a b t1 t2 r1 r2 - and t1 belongs to the **a** leg, which is the
         horizontal one, t2 to the b leg standing up. Reading them the other way
         round dimensioned each leg with the other leg's thickness, and put the
         root fillet's arrow off the corner by the same swap. */
      var t1a = num(sp.t1, 0), t2b = num(sp.t2, 0);
      var lr1 = num(sp.r1, 0), lr2 = num(sp.r2, 0);
      vdim(w, 0, t1a, t1a);                  // the a leg, measured at its tip
      /* Lifted above the section, not laid across it. An angle's root leader
         is the only thing that can leave the corner, and it runs up and to the
         right through exactly the space a carried number would use - on a 90mm
         angle at 1:10 the leader's own text is a third of the section deep, so
         there is no band inside the steel that holds both. The leg is open at
         the top; the dimension goes there. */
      hnarrow(0, t2b, h, t2b, true);         // the b leg, over the top
      radLead(t2b + lr1 * K, t1a + lr1 * K, lr1, 1, 1);                 // heel root
      radLead(w - lr2 * K, t1a - lr2 * K, lr2, 1, 1);                   // a-leg toe
    } else if (sp.SECT === 'P') {
      /* d t - and d is on the label, so only the wall is dimensioned. It is
         measured at half height, where the barrel is vertical and the two
         faces are a clean t apart.

         The RIGHT wall, not the left, and that is the whole difference between
         a readable pipe and an unreadable one. dimNarrow carries its number
         out to x1 + leadRun: off the left wall that lands inside the bore, so
         the line crosses the entire section and the arrows - sized for the
         part, not for the wall - close over a 2.5mm gap into a solid blob. Off
         the right wall the number lands clear of the steel, which is the room
         sectPadRight was already reserving. */
      var pt = num(sp.t, 0);
      hnarrow(w - pt, w, h / 2, pt);
    } else if (sp.SECT === 'R') {
      // h b t r - the wall on the right face for the same reason as P, and the
      // corner once: all four carry the same r and radLead refuses the repeats
      var rt = num(sp.t, 0), rr = num(sp.r, 0);
      hnarrow(w - rt, w, h / 2, rt);
      radLead(w - rr * K, h - rr * K, rr, 1, 1);                        // outer corner
    }
    return { dims: dims, narrow: narrow, leads: leads };
  }
  /* How much room the section's right-hand annotation needs beyond its own
     width: the dimension line, one stack past it for the carried web number,
     and the number itself. */
  // the run of text a note sits on: as long as the number and no longer. The
  // old floor of D.base put a 10mm shoulder under a two-digit thickness and is
  // most of why the lines read long on a section drawn at 1:10.
  function noteRun(s, D) { return dxfTextWidth(s, D.text.dim) + D.textGap * 2; }
  function sectPadRight(sp, w, h, D) {
    var sc = sectCallouts(sp, w, h);
    if (!sc.dims.length && !sc.narrow.length) return 0;
    var pad = 0, base = D.origin + D.base, k = Math.SQRT1_2;
    sc.dims.forEach(function (dm) {                    // number beside the line
      pad = Math.max(pad, base + D.arrow / 2 + D.textGap * 2
                        + dxfTextWidth(dm.txt, D.text.dim));
    });
    sc.narrow.forEach(function (nd) {                  // number carried out on it
      pad = Math.max(pad, nd.x1 + D.leadRun + noteRun(nd.txt, D) - w);
    });
    // and the radius leaders, which also run out to the right
    sc.leads.forEach(function (c) {
      if (c.dx < 0) return;
      pad = Math.max(pad, c.u + D.leadRun * (1 + c.step * 0.9) * k
                        + noteRun(c.txt, D) - w);
    });
    return pad;
  }
  // and above it, for the shapes whose thin part is dimensioned over the top
  function sectPadTop(sp, w, h, D) {
    var lifted = sectCallouts(sp, w, h).narrow.some(function (nd) { return nd.up; });
    return lifted ? D.origin + D.base + D.textGap + D.text.dim * 1.2 : 0;
  }

  /* Every drawing on the sheet, in the order the rows ask for them. There is
     nothing to pass in: what to draw and at what scale is on the rows, which
     is the whole point of the change. Returns null when not one row produced
     a drawing, so the caller can say so instead of writing an empty file. */
  function buildDXF(list) {
    // D is the live style, reassigned as each block starts - every drawing
    // helper reads it at call time, so a block's scale reaches all of them
    var D = dimStyle(1);
    var R = [];
    function g(code, v) { R.push(String(code), String(v)); }
    function gs(arr) { for (var i = 0; i < arr.length; i += 2) g(arr[i], arr[i + 1]); }

    var ents = [];
    /* The entity forms are the ones bim_dxf.js already writes and the site
       already ships: layer, then the points, and no Z on a flat drawing. */
    function entHead(type, layer) { return ['0', type, '8', layer]; }
    function line(layer, a, b, buf) {
      (buf || ents).push(entHead('LINE', layer).concat(
        ['10', dxfNum(a[0]), '20', dxfNum(a[1]),
         '11', dxfNum(b[0]), '21', dxfNum(b[1])]));
    }
    // rot is degrees anticlockwise - DXF group 50, which is how a dimension
    // number comes to lie along its own dimension line instead of across it
    function text(layer, at, hgt, s, centre, rot, buf) {
      var body = ['10', dxfNum(at[0]), '20', dxfNum(at[1]),
                  '40', dxfNum(hgt), '1', dxfText(s), '7', DXF_STYLE];
      if (rot) body = body.concat(['50', dxfNum(rot)]);
      if (centre) body = body.concat(['72', '1',
                                      '11', dxfNum(at[0]), '21', dxfNum(at[1])]);
      (buf || ents).push(entHead('TEXT', layer).concat(body));
    }
    function circle(layer, c, r, buf) {
      (buf || ents).push(entHead('CIRCLE', layer).concat(
        ['10', dxfNum(c[0]), '20', dxfNum(c[1]), '40', dxfNum(r)]));
    }
    /* R12 has ARC, and it always sweeps anticlockwise from the first angle to
       the second - so a run of points read clockwise round the circle is the
       same arc written the other way about. Angles in degrees. */
    function arcEnt(layer, c, r, a0, a1, buf) {
      (buf || ents).push(entHead('ARC', layer).concat(
        ['10', dxfNum(c[0]), '20', dxfNum(c[1]), '40', dxfNum(r),
         '50', dxfNum(a0), '51', dxfNum(a1)]));
    }
    // one drawing op from ringDraw, placed by an offset
    function drawOps(layer, ops, dx, dy) {
      ops.lines.forEach(function (s) {
        line(layer, [s[0][0] + dx, s[0][1] + dy], [s[1][0] + dx, s[1][1] + dy]);
      });
      ops.arcs.forEach(function (a) {
        if (a.full) circle(layer, [a.c[0] + dx, a.c[1] + dy], a.r);
        else arcEnt(layer, [a.c[0] + dx, a.c[1] + dy], a.r, a.a0, a.a1);
      });
    }
    /* The arrowhead: a round filled dot. R12 has no filled circle, so it is a
       fan of SOLID triangles with a CIRCLE laid over the top to keep the rim
       clean at any zoom. A SOLID's corners go 1-2-4-3, not round the shape -
       repeating the third point is what makes it a triangle rather than a
       bowtie. Twelve segments is smooth at 1.1mm and costs 12 entities. */
    function dot(layer, c, r, buf) {
      var n = 12, prev = null, i, a, p;
      for (i = 0; i <= n; i++) {
        a = i * 2 * Math.PI / n;
        p = [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
        if (prev) (buf || ents).push(entHead('SOLID', layer).concat(
          ['10', dxfNum(c[0]), '20', dxfNum(c[1]),
           '11', dxfNum(prev[0]), '21', dxfNum(prev[1]),
           '12', dxfNum(p[0]), '22', dxfNum(p[1]),
           '13', dxfNum(p[0]), '23', dxfNum(p[1])]));
        prev = p;
      }
      circle(layer, c, r, buf);
    }
    /* A leader's arrowhead: a filled triangle whose tip is on the thing being
       pointed at and whose tail runs back up the leader. A dot is the right
       mark on a dimension - it says "the measurement ends here" - but a leader
       is pointing at something, and pointing wants a point. Length is the
       registered leadArrow; the base is a third of that, the usual 3:1.
       SOLID corners go 1-2-4-3, so repeating the third point makes a triangle
       and not a bowtie. */
    function arrowHead(layer, tip, ux, uy, buf) {
      var L = D.leadArrow, hw = L / 3 / 2;
      var bx = tip[0] - ux * L, by = tip[1] - uy * L;      // centre of the base
      var px = -uy * hw, py = ux * hw;                     // across the base
      (buf || ents).push(entHead('SOLID', layer).concat(
        ['10', dxfNum(tip[0]), '20', dxfNum(tip[1]),
         '11', dxfNum(bx + px), '21', dxfNum(by + py),
         '12', dxfNum(bx - px), '22', dxfNum(by - py),
         '13', dxfNum(bx - px), '23', dxfNum(by - py)]));
    }
    /* A note on a leader: the arrow sits on the thing, the leg leaves it at 45
       degrees, then it turns horizontal for a shoulder the text sits on - the
       shoulder is as long as the text needs, so the text never overhangs it.
       Every length here is the note's own size - leadRun and the text - and
       none of it is the part's. Running the leg out until the shoulder left the
       steel, which is what it used to do, made the leader as long as the plate
       was wide: a 900mm plate with a hole in the middle got half a metre of
       leader to say D130. A number sitting on blank steel beside its hole is
       normal drafting and reads better. */
    function leaderAt(p0, s, dirX, dirY, step) {
      var TH = D.text.dim, TG = D.textGap, k = Math.SQRT1_2;
      var sx = dirX < 0 ? -1 : 1, sy = dirY < 0 ? -1 : 1;
      // each further call in the same direction runs out a step longer, so two
      // call-outs land on their own shoulders instead of on each other
      var run = D.leadRun * (1 + (step || 0) * 0.9);
      var p1 = [p0[0] + run * k * sx, p0[1] + run * k * sy];
      var sh = noteRun(s, D);
      var p2 = [p1[0] + sh * sx, p1[1]];
      // the leg starts at the back of the arrowhead, not under it
      var a0 = [p0[0] + D.leadArrow * k * sx, p0[1] + D.leadArrow * k * sy];
      line('PL3D-DIM', a0, p1);
      line('PL3D-DIM', p1, p2);
      arrowHead('PL3D-DIM', p0, -k * sx, -k * sy);
      text('PL3D-DIM', [(p1[0] + p2[0]) / 2, p1[1] + TG], TH, s, true, 0);
    }
    /* A diameter, called out on a leader rather than measured across. A circle
       has no meaningful width and height, and two linear dimensions on one say
       nothing a single D does not.
       The dimension line runs through the centre and terminates on the rim at
       both ends, arrows pointing out - which is what makes it read as a
       diameter rather than as a note that happens to touch a circle. It then
       carries on past the near rim to a shoulder for the number, because the
       circles here are far too small to letter across.
       An arc gets exactly this: the arrow on the side a CUT took away lands in
       air, and that is still where that circle's rim would be. */
    function leaderDia(c, r, dia, dirX, dirY, step) {
      var k = Math.SQRT1_2, TH = D.text.dim, TG = D.textGap;
      var sx = dirX < 0 ? -1 : 1, sy = dirY < 0 ? -1 : 1;
      var far  = [c[0] - r * k * sx, c[1] - r * k * sy];
      var near = [c[0] + r * k * sx, c[1] + r * k * sy];
      var s = 'D' + rnd(dia * 2);
      var run = D.leadRun * (1 + (step || 0) * 0.9);
      var p1 = [near[0] + run * k * sx, near[1] + run * k * sy];
      var sh = noteRun(s, D);
      var p2 = [p1[0] + sh * sx, p1[1]];
      line('PL3D-DIM', far, p1);           // through the centre and on out
      line('PL3D-DIM', p1, p2);
      arrowHead('PL3D-DIM', far, -k * sx, -k * sy);
      arrowHead('PL3D-DIM', near, k * sx, k * sy);
      text('PL3D-DIM', [(p1[0] + p2[0]) / 2, p1[1] + TG], TH, s, true, 0);
    }

    /* A linear dimension, drawn: two extension lines, the dimension line, a dot
       at each end, and the measurement lying along the line. Not a DIMENSION
       entity - see the note at the top of this module.

       Every length is a registered DIMSTYLE value multiplied by the scale, and
       nothing here is a number of my own:

         D.base     how far off the measured edge the dimension line sits
         D.stack    the step when dimensions are stacked one past another
         D.origin   the gap the extension line leaves at the measured point
         D.extend   how far the extension line runs past the dimension line
         D.arrow    the dot
         D.textGap  text to dimension line
         D.text.dim the number's height

       The dimension line stands off by D.origin + D.base, not D.base alone.
       A and B are consecutive bands on the style dialog's preview, not two
       measurements of the same distance: A is the gap the extension line leaves
       at the measured point, B is the run of extension line past it. Both are
       10, so treating B as the distance from the object put the dimension line
       exactly where the extension line starts and the extension line came out
       0.5 long - the plate floating with nothing joining it to its dimension.

       `level` is which stacked line this is, counting from the object out:
       level 0 sits origin + base away, level 1 a further D.stack, and so on.
       `side` is which way that offset goes: -1 (the default) puts the line left
       of a vertical dimension and below a horizontal one, +1 the other way. */
    // extension line: starts D.origin clear of the measured point, finishes
    // D.extend past the dimension line
    function extLine(p, q) {
      var dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy);
      if (L < 1e-9) return;
      var ux = dx / L, uy = dy / L;
      line('PL3D-DIM', [p[0] + ux * D.origin, p[1] + uy * D.origin],
           [q[0] + ux * D.extend, q[1] + uy * D.extend]);
    }
    function dimLinear(p1, p2, at, vertical, level, side, txt) {
      var A = D.arrow, TG = D.textGap, TH = D.text.dim;
      var v = vertical, sd = side > 0 ? 1 : -1;
      var val = Math.abs(v ? p2[1] - p1[1] : p2[0] - p1[0]);
      if (!(val > 1e-9)) return;
      // `at` is the edge being dimensioned; the line stands off it by the style
      var off = at + sd * (D.origin + D.base + D.stack * (level || 0));
      var q1 = v ? [off, p1[1]] : [p1[0], off];
      var q2 = v ? [off, p2[1]] : [p2[0], off];
      extLine(p1, q1);
      extLine(p2, q2);
      line('PL3D-DIM', q1, q2);
      dot('PL3D-DIM', q1, A / 2);
      dot('PL3D-DIM', q2, A / 2);
      /* The number reads along its own dimension line: upright on a horizontal
         one, turned 90 degrees on a vertical one. Rotated text grows away from
         its baseline in the direction 90 degrees further round, so on a vertical
         dimension the baseline sits TG to the left of the line and the glyphs
         fill the space beyond it - the same clearance as the horizontal case. */
      var mid = [(q1[0] + q2[0]) / 2, (q1[1] + q2[1]) / 2];
      /* A number wider than the link it belongs to would sit on its own dots and
         on its neighbour's - which is what a chain of short pitches does. It
         steps one text height further out instead, into a lane of its own, and
         the ones that fit stay where they are. */
      var s = txt || String(Math.round(val));
      var out = dxfTextWidth(s, TH) + TG * 2 <= val ? 0 : sd * TH * 1.3;
      var tp = v ? [mid[0] - TG + out, mid[1]] : [mid[0], mid[1] + TG + out];
      text('PL3D-DIM', tp, TH, s, true, v ? 90 : 0);
    }
    /* One chain, drawn one stack out from whatever it sits beside. `at` is the
       edge it stands off, exactly as for a single dimension. */
    function dimChain(ops, at, vertical, level, side, fix) {
      ops.forEach(function (s) {
        var p1 = vertical ? [fix, s.a] : [s.a, fix];
        var p2 = vertical ? [fix, s.b] : [s.b, fix];
        dimLinear(p1, p2, at, vertical, level, side, s.txt);
      });
    }

    /* A thickness dimension where the thing measured is thinner than the
       number measuring it - a web, a flange, at any scale a section is drawn
       at. These stay dimensions and keep the dot: a thickness is measured, not
       noted, and only a note gets a leader's arrow. What changes is where the
       number goes, because it will not fit between its own two dots.

       Vertical - a flange. Extension lines out to the right as usual, the
       dimension line run a little past both dots, and the number stood beside
       it rather than laid along it. This is the t2 of a section table.
       Falls through to the ordinary dimension when the span is deep enough to
       hold the text, which it is at 1:1 and never is at 1:10. */
    function dimThinV(p1, p2, at, s) {
      var TH = D.text.dim, TG = D.textGap, A = D.arrow;
      var y0 = Math.min(p1[1], p2[1]), y1 = Math.max(p1[1], p2[1]);
      if (!(y1 - y0 > 1e-9)) return;
      if (y1 - y0 > TH * 1.8) { dimLinear(p1, p2, at, true, 0, 1); return; }
      var off = at + D.origin + D.base, tail = A * 2;
      extLine([p1[0], y0], [off, y0]);
      extLine([p1[0], y1], [off, y1]);
      line('PL3D-DIM', [off, y0 - tail], [off, y1 + tail]);
      dot('PL3D-DIM', [off, y0], A / 2);
      dot('PL3D-DIM', [off, y1], A / 2);
      // clear of the dot, not just of the line the dot sits on
      text('PL3D-DIM', [off + A / 2 + TG * 2, (y0 + y1) / 2 - TH / 2], TH, s, false, 0);
    }
    /* Horizontal - a web. There is nothing to run an extension line to, so the
       dimension line is the web's own centreline: dots on the two faces, and
       the number carried straight out of the section on the same line.
       `textFrom` is where that carried number starts. */
    function dimNarrow(x0, x1, y, textFrom, s, up) {
      var TH = D.text.dim, TG = D.textGap, A = D.arrow;
      var lo = Math.min(x0, x1), hi = Math.max(x0, x1);
      if (!(hi - lo > 1e-9)) return;
      var sh = noteRun(s, D);
      var ly = y;
      if (up) {                               // lifted clear on extension lines
        ly = y + D.origin + D.base;
        extLine([lo, y], [lo, ly]);
        extLine([hi, y], [hi, ly]);
      }
      var tail = A * 2;                       // the stub past the near dot
      line('PL3D-DIM', [lo - tail, ly], [textFrom + sh, ly]);
      dot('PL3D-DIM', [lo, ly], A / 2);
      dot('PL3D-DIM', [hi, ly], A / 2);
      text('PL3D-DIM', [textFrom + sh / 2, ly + TG], TH, s, true, 0);
    }

    /* ---- the drawings, one to a row ---- */
    /* Each block is drawn at its own scale, so a 63m assembly and a 300mm
       gusset can each be annotated at a size that reads. The steel stays 1:1 in
       millimetres throughout - only the annotation changes size - so the blocks
       sit in one coordinate system and a viewport plotted at each block's scale
       comes out right. */
    // cursorY walks down the sheet in model mm; sheetW is the widest block so
    // far measured **on paper**, which is the only width comparable between
    // blocks drawn at different scales
    var cursorY = 0, sheetW = 0;

    function gap() { return D.base * 2.5; }     // 25mm on the sheet, at this block's scale

    // six views of one set of members, laid out 3 x 2, drawn from (x0, yTop)
    // downward. Returns how much room it took.
    /* One projection of a set of members, ready to be put somewhere. */
    function viewOf(members, vw) {
      var segs = [], arcs = [], holes = [];
      members.forEach(function (it) { dxfMemberEdges(it, vw, segs, arcs, holes); });
      /* Hidden lines go before the deduper, not after. Both caps of a plate seen
         face on land on the same lines and the deduper keeps whichever came
         first; were that the far cap, the near cap's own face would then hide it
         and the plate would disappear entirely. */
      var faces = viewFaces(members, vw);
      segs = dxfDedupe(hideSegs(segs, faces));
      arcs = arcDedupe(hideArcs(arcs, faces));
      holes = hidePoints(holes, faces);
      /* The box has to see the arcs too, or a hole that reached the edge would
         be measured to its chord. segsBox gives what the sweep actually covers. */
      var box = segsBox(segs, arcs);
      /* No context. A VIEW row draws the id it names and nothing else - what
         used to be laid in behind it, as the outlines of whatever stood beside
         it, is gone. It was there to say where a part sat when the sheet drew
         parts on their own; now the sheet says what it wants drawn, and drawing
         more than it asked for is the engine having an opinion. */
      var ctx = [], outer = box;
      return { key: vw.key, segs: segs, arcs: arcs, holes: holes, ctx: ctx,
               box: box, outer: outer };
    }
    /* ...and drawn where it is put, with its title over it and its overall
       size under and beside it. The grid below places six; a VIEW row places
       one. Same picture either way, which is the point of it being one call. */
    /* chain = draw the pitch chains too. The six-view grids leave them off:
       the same holes would be chained in three of the six and the rows are
       tight enough already. A drawing the sheet asked for by name is the one
       meant to be worked from, so that is where they go. */
    function placeView(v, ox, oy, title, chain) {
      var w = v.box.x1 - v.box.x0, h = v.box.y1 - v.box.y0;
      var dx = ox - v.box.x0, dy = oy - v.box.y0;
      // what is behind it first, so the part draws over its own context
      (v.ctx || []).forEach(function (s) {
        line('PL3D-HIDDEN', [s[0][0] + dx, s[0][1] + dy],
             [s[1][0] + dx, s[1][1] + dy]);
      });
      drawOps('PL3D-OUTLINE', { lines: v.segs, arcs: v.arcs || [] }, dx, dy);
      var topY = (v.outer ? v.outer.y1 + dy : oy + h);
      text('PL3D-TITLE', [ox + w / 2, topY + D.base], D.text.section, title, true, 0);
      /* Detail nearest the steel, overall outside it - a chain read after the
         size it adds up to is a chain read twice. */
      var lv = 0;
      if (chain && v.holes && v.holes.length) {
        var dx = ox - v.box.x0, dy = oy - v.box.y0;
        var cx = chainOps(v.holes.map(function (c) { return c[0] + dx; }), ox, ox + w);
        var cy = chainOps(v.holes.map(function (c) { return c[1] + dy; }), oy, oy + h);
        dimChain(cx, oy, false, 0, 0, oy);
        dimChain(cy, ox, true, 0, 0, ox);
        if (cx.length || cy.length) lv = 1;
      }
      if (w > 0) dimLinear([ox, oy], [ox + w, oy], oy, false, lv);
      if (h > 0) dimLinear([ox, oy], [ox, oy + h], ox, true, lv);
      return { w: w, h: h };
    }

    /* The distinct parts, shelf-packed. A 9m section and a 100mm gusset in one
       grid would both get a 9m cell, so rows fill until the budget runs out and
       each row is as tall as its tallest part. A cell is as wide as the part OR
       its label rule, whichever is wider. */
    function partShelf(parts, x0, yTop, budget) {
      var G = gap();
      /* What hangs off a part, worked out before anything is placed. The
         leaders run up and to the right, so a shelf needs headroom above it or
         a D22 lands on the block title; the name, its rule and the count hang
         below, so it needs room under it too. Both are the same for every part
         at this scale, so they are bands, not per-part measurements. */
      var most = 0, lift = 0;
      parts.forEach(function (p) {
        most = Math.max(most, leadCount(p));
        lift = Math.max(lift, partPadTop(p, D));
      });
      var topBand = Math.max(lift, most > 0
        ? D.leadRun * (1 + (most - 1) * 0.9) * Math.SQRT1_2
          + D.textGap + D.text.dim * 1.2
        : 0);
      /* A pitch chain stands one stack outside the overall size, so where any
         part in the block carries one every part's name drops by the same
         amount - names at two heights in one row read as two rows. */
      var anyChain = parts.some(function (q) {
        var c = holeCentres(q.it);
        return chainOps(c.map(function (h) { return h[0]; }), -1e9, 1e9).length > 2 ||
               chainOps(c.map(function (h) { return h[1]; }), -1e9, 1e9).length > 2;
      });
      var chainRoom = anyChain ? D.stack + D.text.dim * 1.4 : 0;
      var lowBand = D.origin + D.base + D.text.dim + chainRoom
                  + D.text.member * 1.9 + D.text.note * 1.5;
      var px = x0 + G, py = yTop - topBand, shelf = 0, wide = 0;
      parts.forEach(function (p) {
        var w = p.box.x1 - p.box.x0, h = p.box.y1 - p.box.y0;
        var nameStr = p.it.plateId.toUpperCase() + ', ' + p.it.dims;
        var rule = Math.max(D.markLen, dxfTextWidth(nameStr, D.text.member));
        // a section's thickness dimensions stand off its right-hand side, so
        // its cell is wider than its steel or the next part sits on them
        var pad = Math.max(cutPadRight(p), p.it.spec.SHAPE === 'SECT'
          ? sectPadRight(p.it.spec, w, h, D) : 0);
        var cell = Math.max(w + pad, rule);
        if (px > x0 + G && px + cell > x0 + budget) {
          py -= shelf + lowBand + topBand + G * 1.5;
          px = x0 + G;
          shelf = 0;
        }
        // hangs down from the shelf line, never up: a tall part would otherwise
        // grow through whatever is above it. The pad is all on the right, so
        // the steel is centred in what is left.
        var ox = px + (cell - w - pad) / 2, oy = py - h;
        var mid = px + cell / 2;
        px += cell + G * 2.5;
        wide = Math.max(wide, px - x0);
        shelf = Math.max(shelf, h);
        drawOps('PL3D-OUTLINE', { lines: p.segs, arcs: p.arcs || [] },
                ox - p.box.x0, oy - p.box.y0);

        /* Where the holes are. The overall size says how big the plate is; this
           says where to put the drill, and a plate drawn without it cannot be
           made. It goes nearest the steel and pushes the overall size out one
           stack - a chain read after the number it adds up to is read twice. */
        var hcs = holeCentres(p.it), lv = 0;
        /* The face chain runs to the edge of the FACE, not of the part box. With
           an elevation beside it the box reaches past the section, and chaining
           to that edge would put a number on the white space between the two
           views. */
        var fb = p.faceBox || p.box;
        var fx0 = ox + fb.x0 - p.box.x0, fx1 = ox + fb.x1 - p.box.x0;
        var fy0 = oy + fb.y0 - p.box.y0, fy1 = oy + fb.y1 - p.box.y0;
        if (hcs.length) {
          var chX = chainOps(hcs.map(function (hh) { return hh[0] - p.box.x0 + ox; }),
                             fx0, fx1);
          var chY = chainOps(hcs.map(function (hh) { return hh[1] - p.box.y0 + oy; }),
                             fy0, fy1);
          dimChain(chX, oy, false, 0, 0, oy);
          dimChain(chY, ox, true, 0, 0, ox);
          if (chX.length || chY.length) lv = 1;
        }
        /* and the elevation's own chain: along its length under it, up its
           depth on its right, both bounded by the elevation and nothing else */
        (p.sides || []).forEach(function (sv) {
          var sx0 = ox + sv.x0 - p.box.x0, sx1 = ox + sv.x1 - p.box.x0;
          var sy0 = oy + sv.y0 - p.box.y0, sy1 = oy + sv.y1 - p.box.y0;
          var shX = sv.holes.map(function (hh) { return ox + hh[0] - p.box.x0; });
          var shY = sv.holes.map(function (hh) { return oy + hh[1] - p.box.y0; });
          dimChain(chainOps(shX, sx0, sx1), oy, false, 0, 0, oy);
          dimChain(chainOps(shY, sy0, sy1), sx1, true, 0, 0, sx1);
          lv = 1;
        });

        // a round part gets a diameter, not a width and a height
        var lead = 0;
        var outerC = partCircle(p);
        if (outerC) {
          leaderDia([ox + w / 2, oy + h / 2], outerC.r, outerC.r, 1, 1, lead++);
        } else {
          /* Width is the edge that is actually there, not the box round it. On
             a trapezoid the two parallel sides are different lengths and both
             are wanted; below the part goes the bottom edge, above it the top,
             and a rectangle - whose two agree - still says it once. */
          var top = topEdgeDim(p);
          var bot = p.it.spec.SHAPE === 'SECT' ? null : edgeSpan(p, p.box.y0);
          if (bot) dimLinear([ox + bot[0] - p.box.x0, oy],
                             [ox + bot[1] - p.box.x0, oy], oy, false, lv);
          else if (!top && w > 0) dimLinear([ox, oy], [ox + w, oy], oy, false, lv);
          if (top) dimLinear([ox + top[0] - p.box.x0, oy + h],
                             [ox + top[1] - p.box.x0, oy + h], oy + h, false, 0, 1);
          if (h > 0) dimLinear([ox, oy], [ox, oy + h], ox, true, lv);
        }

        var cf = cutFeatures(p);
        var CX = function (x) { return x - p.box.x0 + ox; };
        var CY = function (y) { return y - p.box.y0 + oy; };
        // one call-out per distinct round cut, from the one furthest up-right
        cf.round.forEach(function (hc) {
          leaderDia([CX(hc.c[0]), CY(hc.c[1])], hc.r, hc.r, 1, 1, lead++);
        });
        /* The rest of the CUTs, dimensioned by the same rules as the outline
           but with A and B at the inside offsets - a dimension line standing
           20mm clear on paper is right in the margin round a part and is most
           of a small plate's interior. D is swapped for the inside style and
           put back: every helper reads it when it is called, so the two kinds
           of dimension come out of one piece of code. */
        var Dout = D;
        D = dimStyleInner(D);
        cf.poly.forEach(function (c) {
          var b = c.bot || [c.x0, c.x1];
          dimLinear([CX(b[0]), CY(c.y0)], [CX(b[1]), CY(c.y0)], CY(c.y0), false, 0);
          if (c.showTop)
            dimLinear([CX(c.top[0]), CY(c.y1)], [CX(c.top[1]), CY(c.y1)],
                      CY(c.y1), false, 0, 1);
          dimLinear([CX(c.x0), CY(c.y0)], [CX(c.x0), CY(c.y1)], CX(c.x0), true, 0);
        });
        D = Dout;
        if (p.it.spec.SHAPE === 'SECT') {
          var sc = sectCallouts(p.it.spec, w, h);
          // flange thicknesses: dimensioned off the tip, line to the right
          sc.dims.forEach(function (dm) {
            dimThinV([ox + dm.x, oy + dm.y0], [ox + dm.x, oy + dm.y1],
                     ox + w, dm.txt);
          });
          /* The web: too thin to letter across, so its number is carried out on
             its own dimension line - out of the web, not out of the section.
             Measuring that from the section's right-hand edge is what made the
             line on an H-700 twice as long as the flange is wide. */
          sc.narrow.forEach(function (nd) {
            dimNarrow(ox + nd.x0, ox + nd.x1, oy + nd.y,
                      ox + nd.x1 + D.leadRun, nd.txt, nd.up);
          });
          // steps are counted per direction and come with the call-out
          sc.leads.forEach(function (c) {
            leaderAt([ox + c.u, oy + c.v], c.txt, c.dx, c.dy, c.step);
          });
        }

        var lblY = oy - D.origin - D.base - D.text.dim - chainRoom
                 - D.text.member * 1.4;
        text('PL3D-TEXT', [mid, lblY], D.text.member, nameStr, true, 0);
        var ruleY = lblY - D.text.member * 0.5;
        line('PL3D-DIM', [mid - rule / 2, ruleY], [mid + rule / 2, ruleY]);
        text('PL3D-TEXT', [mid, ruleY - D.text.note * 1.3], D.text.note,
             p.n + 'EA', true, 0);
      });
      return { w: wide, h: yTop - (py - shelf - lowBand - G) };
    }

    function blockTitle(s2, y) {
      text('PL3D-TITLE', [gap(), y], D.text.heading, s2, false, 0);
      return D.text.heading * 2.2;
    }

    /* ---- a PLOT row: parts on their own, at their standard section ----
       `pick` says which of them this row asked for. Everything else about the
       block is as it was when one tick box drew every part at one scale. */
    function partBlock(pick, title) {
      /* Round bars are left out. A bar is a length of stock, not a part to be
         cut to a shape, and a circle with a diameter beside it tells a
         fabricator nothing the take-off does not. Sections stay - they carry a
         profile worth drawing. */
      assignDrills();
      var picked = list.filter(function (it) {
        return !(it.spec.__bar && !it.spec.__sect) && pick(it);
      });
      if (!picked.length) return false;
      cursorY -= blockTitle(title, cursorY);
      var parts = dxfParts(picked).map(function (p) {
        /* Here the plate lies in its own plane, so every circle the sheet cut
           is a circle on the paper - this is where arcs pay best. */
        var segs = [], arcs = [], circles = [];
        (p.it.rings.cuts || []).forEach(function (rg) {
          var k = ringCircle(rg);
          if (k) circles.push(k);
        });
        /* A round part's own outline. The test used to run only on SHAPE
           'CIRC' - a round plate - which left a pipe out, because a SECT's
           SHAPE is 'SECT' whatever its profile. So a P came out as the
           forty-eight straight lines it is held as internally: measuring
           right, reading wrong, and impossible to snap a centre on or offset
           as a circle in the CAD it lands in.
           Widening the test costs nothing, because ringCircle refuses anything
           whose points are not one radius within 2%. An H is offered and
           declined; the arithmetic is a few dozen hypots per part. */
        p.it.rings.outers.forEach(function (o) {
          var k = ringCircle(o);
          if (k) circles.push(k);
        });
        /* And the holes, which were never offered at all. A hole cut by the
           sheet is already in `cuts` above and was found there, so nothing
           that draws today changes; what this reaches is the one ring that is
           in neither list - the bore of a hollow section, which is not a CUT
           the sheet asked for but the inside of the profile itself. */
        (p.it.rings.holes || []).forEach(function (hs) {
          (hs || []).forEach(function (o) {
            var k = ringCircle(o);
            if (k) circles.push(k);
          });
        });
        function take(rg) {
          var d = ringDraw(rg, circles);
          d.lines.forEach(function (s) { segs.push(s); });
          d.arcs.forEach(function (a) { arcs.push(a); });
        }
        p.it.rings.outers.forEach(function (o, i) {
          take(o);
          (p.it.rings.holes[i] || []).forEach(take);
        });
        /* the holes the bolts made. They go in as full arcs, which is what the
           writer turns into a CIRCLE, and they ride the same offset every
           other arc does when the part is placed on the sheet. */
        (p.it.drills || []).forEach(function (h) {
          if (h.view === 'face') arcs.push({ c: [h.x, h.y], r: h.d / 2, full: true });
        });
        /* ---- the side elevation ----
           A section's part drawing is its cross-section, and a bolt that goes
           ACROSS the member - through a web, through a flange - is not in that
           view at all. It is at some distance along the length, which the
           cross-section has no axis for. So where such a hole exists, the
           length view is drawn beside the section in the same coordinate
           space: segsBox then grows on its own and partShelf lays the wider
           box out with no change to the layout at all.

           Only members that carry one get it. Every section drawing that has
           ever been issued is a cross-section and stays exactly that. */
        /* ---- the side elevations ----
           A section's part drawing is its cross-section, and a bolt that goes
           ACROSS the member - through a web, through a flange - is not in that
           view at all: it sits some distance along the length, which a cross-
           section has no axis for. So the length view is drawn beside the
           section in the same coordinate space; segsBox then grows on its own
           and partShelf lays the wider box out with no layout change at all.

           ONE ELEVATION PER BOLT DIRECTION. A cleat is bolted to the column one
           way and to the beam the other, and putting both groups on a single
           elevation stacks two sets of holes that were never on one face and
           runs their two chains through each other - which is what the first
           version of this did.

           Only members with such a hole get one; every section drawing issued
           so far is a cross-section and stays exactly that. */
        var side = (p.it.drills || []).filter(function (h) { return h.view === 'side'; });
        if (side.length) {
          var pb = segsBox(segs, arcs);
          p.faceBox = pb;                        // the section alone, before any elevation
          var mh2 = num(p.it.thk, 0) / 2;
          var gapv = D.base * 3;
          var cur = pb.x1 + gapv + mh2;          // centre of the first elevation
          p.sides = [];
          ['x', 'y'].forEach(function (ax) {
            var grp = side.filter(function (h) { return h.axis === ax; });
            if (!grp.length) return;
            /* which way across the member the bolt ran decides which axis of
               the profile this elevation looks at: through a web you see the
               depth, through a flange the width */
            var vaxis = ax === 'x' ? 'y' : 'x';
            var lo = Infinity, hi = -Infinity;
            p.it.rings.outers.forEach(function (o) {
              o.forEach(function (q) {
                var v = vaxis === 'y' ? q[1] : q[0];
                if (v < lo) lo = v;
                if (v > hi) hi = v;
              });
            });
            var c0 = [cur - mh2, lo], c1 = [cur + mh2, lo],
                c2 = [cur + mh2, hi], c3 = [cur - mh2, hi];
            segs.push([c0, c1], [c1, c2], [c2, c3], [c3, c0]);
            var hs = grp.map(function (h) {
              return [cur + h.z, vaxis === 'y' ? h.y : h.x];
            });
            hs.forEach(function (q, i) {
              arcs.push({ c: q, r: grp[i].d / 2, full: true });
            });
            p.sides.push({ x0: cur - mh2, x1: cur + mh2, y0: lo, y1: hi, holes: hs });
            cur += 2 * mh2 + gapv;
          });
        }
        p.segs = segs;
        p.arcs = arcDedupe(arcs);
        p.box = segsBox(segs, p.arcs);
        return p;
      });
      /* The shelf wraps at the width of the widest block above it - but that
         width has to be compared on paper, not in the model. The blocks are at
         different scales, so 200m of tower at 1:100 is 2m of paper while the
         same 200m of parts at 1:10 is twenty. Taking the model width straight
         across put every part of the tower on one 200m row. */
      var budget = (sheetW > 0 ? sheetW : DXF_SHEET_W) * D.scale;
      var pr = partShelf(parts, 0, cursorY, budget);
      cursorY -= pr.h + gap() * 2;
      sheetW = Math.max(sheetW, pr.w / D.scale);
      return true;
    }

    /* ---- a VIEW row: the thing it names, from where it says ---- */
    function viewBlock(vr) {
      /* Taken from what the ASSY rows placed rather than from the definition,
         so the subject is drawn where it ended up. The id names a MODULE or an
         ASSY - it.group carries the ASSY row's own id - because both are things
         a person points at and calls a thing. */
      var mem = list.filter(function (it) {
        return it.moduleId === vr.MODULE || it.group === vr.MODULE;
      });
      if (!mem.length) return false;          // never placed, or every member hidden
      var vw = viewSpec(vr.DIR, vr.AZ, vr.EL);
      if (!vw) return false;                  // the parser already said so
      var v = viewOf(mem, vw);
      var band = D.base + D.text.section * 1.4;
      var chained = v.holes && v.holes.length ? D.stack : 0;
      var leftRoom = D.origin + D.base + chained;
      var oy = cursorY - band - (v.box.y1 - v.box.y0);
      placeView(v, gap() + leftRoom, oy, vr.TITLE + '   1:' + vr.SCALE, true);
      // below the steel hangs the pitch chain, then the overall dimension
      cursorY = oy - (D.origin + D.base + chained + D.text.dim * 1.4) - gap() * 2;
      sheetW = Math.max(sheetW, (gap() + leftRoom + (v.box.x1 - v.box.x0)) / D.scale);
      return true;
    }

    /* ---- the drawings, in the order the sheet asks for them ----
       Every drawing on this sheet was asked for by a row, and carries the scale
       that row gave it. Nothing is produced because the engine thought it might
       be wanted: the six-view grids of everything placed, and of every module,
       are gone. They answered a question - what is in this model - that the
       model tree on screen answers better, and they answered it at whatever one
       scale the dialog had been given, which is not how a sheet of drawings is
       put together.

       Order is the order of the rows. It is the only order the person writing
       the sheet can see and control, so it is the one the paper follows. */
    var sheet = lastViews.map(function (v) { return { r: v.ROW, draw: viewBlock, arg: v }; })
      .concat(lastPlots.map(function (p) {
        return { r: p.ROW, arg: p, draw: function (pr) {
          var wantSect = pr.KIND === 'SECT';
          return partBlock(function (it) {
            if (!it.spec.__sect !== !wantSect) return false;
            return pr.ID === 'ALL' || String(it.plateId).toUpperCase() === pr.ID;
          }, pr.TITLE + '   1:' + pr.SCALE);
        } };
      }))
      .sort(function (a, b) { return a.r - b.r; });

    var drawn = 0;
    sheet.forEach(function (e) {
      D = dimStyle(e.arg.SCALE);
      if (e.draw(e.arg)) drawn++;
    });
    if (!drawn) return null;                  // the caller says so; an empty file does not

    /* ---- assemble the file ---- */
    /* The file, in the shape bim_dxf.js writes and the site's other tools have
       been shipping: AC1009, one header variable, the LTYPE and LAYER tables,
       the entities. Nothing else. Everything I had added beyond that - VPORT,
       STYLE, VIEW, UCS, APPID, DIMSTYLE, BLOCKS - was written from memory and
       was what AutoCAD refused. */
    g(0, 'SECTION'); g(2, 'HEADER');
    g(9, '$ACADVER'); g(1, 'AC1009');
    g(0, 'ENDSEC');

    g(0, 'SECTION'); g(2, 'TABLES');
    g(0, 'TABLE'); g(2, 'LTYPE'); g(70, 4);
    gs([0, 'LTYPE', 2, 'CONTINUOUS', 70, '0', 3, 'Solid', 72, '65', 73, '0', 40, '0.0']);
    gs([0, 'LTYPE', 2, 'CENTER', 70, '0', 3, 'Center', 72, '65', 73, '2', 40, '2.0',
        49, '1.25', 49, '-0.25']);
    gs([0, 'LTYPE', 2, 'HIDDEN', 70, '0', 3, 'Hidden', 72, '65', 73, '2', 40, '1.0',
        49, '0.5', 49, '-0.5']);
    gs([0, 'LTYPE', 2, 'PHANTOM', 70, '0', 3, 'Phantom', 72, '65', 73, '2', 40, '2.5',
        49, '1.25', 49, '-0.25']);
    g(0, 'ENDTAB');

    g(0, 'TABLE'); g(2, 'LAYER'); g(70, DXF_LAYERS.length + 1);
    g(0, 'LAYER'); g(2, '0'); g(70, 0); g(62, 7); g(6, 'CONTINUOUS');
    DXF_LAYERS.forEach(function (L) {
      g(0, 'LAYER'); g(2, L[0]); g(70, 0); g(62, L[1]); g(6, L[2] || 'CONTINUOUS');
    });
    g(0, 'ENDTAB');

    /* One more table than bim_dxf.js writes, and the only one added back so far:
       without a STYLE record there is no way to name a font, and the default
       stick font is what the numbers were coming out in. Ten group codes, all
       of them documented - not the forty-odd of the VPORT record that helped
       sink the R2000 attempt. */
    g(0, 'TABLE'); g(2, 'STYLE'); g(70, 1);
    g(0, 'STYLE'); g(2, DXF_STYLE); g(70, 0);
    gs([40, '0.0',                      // fixed height, 0 = set per text entity
        41, '1.0',                      // width factor
        50, '0.0',                      // oblique angle
        71, '0',                        // generation flags: not mirrored
        42, dxfNum(D.text.dim),         // last height used
        3, DXF_FONT,                    // the font
        4, '']);                        // no bigfont
    g(0, 'ENDTAB');
    g(0, 'ENDSEC');

    g(0, 'SECTION'); g(2, 'ENTITIES');
    ents.forEach(function (e) { for (var i = 0; i < e.length; i += 2) g(e[i], e[i + 1]); });
    g(0, 'ENDSEC');
    g(0, 'EOF');

    return R.join('\n') + '\n';
  }

  /* The File menu closes on the next click anywhere - including the item you
     just picked, so a save does not leave the menu hanging open over the model.
     Bound once, on the document, rather than per open. */
  function toggleMenu(id, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    var el = document.getElementById(id);
    if (!el) return;
    var was = el.classList.contains('open');
    closeMenus();                       // only one of them open at a time
    if (!was) el.classList.add('open');
  }
  function closeMenus() {
    ['pb-fmenu', 'pb-vmenu'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.remove('open');
    });
  }
  function toggleFileMenu(ev) { toggleMenu('pb-fmenu', ev); }
  function toggleViewMenu(ev) { toggleMenu('pb-vmenu', ev); }
  function closeFileMenu() { closeMenus(); }

  function saveDXF() {
    var list = visibleItems();
    if (!list.length) {
      alert('Nothing to draw.\n\n' +
            'A drawing is made from what the ASSY rows placed, so ' +
            LOAD_HINT.charAt(0).toLowerCase() + LOAD_HINT.slice(1) +
            ' first — or tick at least one assembly back on.');
      return;
    }
    if (!lastViews.length && !lastPlots.length) {
      alert('The sheet does not ask for any drawing.\n\n' +
            'Add a row saying what to draw and at what scale:\n\n' +
            '    VIEW  <module or assy>  ISO   <scale>  <title>\n' +
            '    VIEW  <module or assy>  3D  <AZ> <EL>  <scale>  <title>\n' +
            '    PLOT  PART  <id or ALL>  <scale>\n' +
            '    PLOT  SECT  <id or ALL>  <scale>\n\n' +
            'A scale of 20 means 1:20. Nothing is drawn that was not asked for.');
      return;
    }
    var dxf = buildDXF(list);
    if (!dxf) {
      alert('Every row that asks for a drawing names something this model does ' +
            'not hold, so there is nothing to write.\n\n' +
            'The report above the model says which rows and why.');
      return;
    }
    download(dxf, 'plate_builder.dxf');
  }
  /* Nothing to ask. Every drawing on the sheet was asked for by a VIEW or a
     PLOT row and carries its own scale, so Save DXF writes the file. */
  function confirmScale() { saveDXF(); }        // kept: the guide links to it

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
                                 ['r1', 'r1'], ['r2', 'r2'], ['LENGTH', 'THK']] },
    /* The hollow pair. Both list only what was typed on the row - a P's inner
       diameter and an R's inner corner are worked out from the wall and are not
       columns, because a take-off has to be checkable against the row it came
       from, and a derived number sends the reader looking for a cell that is
       not there. */
    /* A bolt is bought, not cut, so what a take-off wants from it is the size,
       the length and how many - and the hole it needs, which is the number the
       shop drills to. It is still weighed, because a thousand M20s are not
       nothing, but the count is the column people read. */
    /* count: true - counted, never weighed. Steel is bought by the tonne and
       bolts by the box, so a take-off lists them by size and length and says
       how many; putting a kilogram against them invites someone to add it to
       the steel, which is not how either is priced. So the BOLT block carries
       no area, no kg/m and no weight column, and the bolts stay out of the
       weight totals. */
    BOLT:   { t: 'BOLT', count: true,
              f: [['DIA', 'D'], ['LENGTH', 'THK'], ['HOLE', 'HOLE']] },
    SECT_P: { t: 'SECT — P', f: [['d', 'd'], ['t', 't'], ['LENGTH', 'THK']] },
    SECT_R: { t: 'SECT — R', f: [['h', 'h'], ['b', 'b'], ['t', 't'], ['r', 'r'],
                                 ['LENGTH', 'THK']] }
  };
  var BOQ_ORDER = ['RECT', 'TRAP', 'CIRC', 'BAR', 'BOLT',
                   'SECT_H', 'SECT_C', 'SECT_L', 'SECT_P', 'SECT_R'];
  var BOQ_CAT = { RECT: 'PLATE', TRAP: 'PLATE', CIRC: 'PLATE', BAR: 'BAR', BOLT: 'BOLT',
                  SECT_H: 'SECT', SECT_C: 'SECT', SECT_L: 'SECT',
                  SECT_P: 'SECT', SECT_R: 'SECT' };
  function boqKind(spec) {
    if (isSectSpec(spec)) return 'SECT_' + spec.SECT;
    if (isBoltSpec(spec)) return 'BOLT';       // before BAR: a bolt is also a __bar
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
      /* A shape with no block in BOQ_KIND used to take the whole workbook down
         with "cannot read properties of undefined" - thrown inside a promise,
         so the only sign was a take-off that never arrived and no error
         anywhere. Adding a SECT type and forgetting this table is the easy
         mistake; losing the BOQ over it is not an acceptable price. */
      if (!def) {
        console.error('[plateBuilder] BOQ: no take-off block for ' + k +
                      ' (' + spec.ID + ') - the part is in the model, not on the list');
        return;
      }
      var vals = def.f.map(function (p) { return +num(spec[p[1]], 0).toFixed(4); });
      /* A counted item merges on WHAT IT IS, not on what the sheet called it.
         Two BOLT rows of the same size are the same bolt however they were
         named - you buy M16x50 by the box and nobody orders BO.A separately
         from BO.B - so the id is left out of the key and the line is named for
         the size instead. Everything fabricated keeps its id in the key,
         because PL.A and PL.B really are two parts even at the same size. */
      var key = def.count ? k + '|' + (spec.MAT || '') + '|' + vals.join(',')
                          : k + '|' + spec.ID + '|' + vals.join(',');
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
        e = map[key] = { kind: k,
                         id: def.count ? 'M' + rnd(num(spec.D, 0)) : spec.ID,
                         mat: spec.MAT || '—', vals: vals,
                         area: def.area ? aMM / 1e6 : null,
                         cuts: def.area ? cutCount(spec.ID) : null,
                         areaMM: def.area ? null : aMM,
                         kgm: def.area ? null : aMM * RHO * 1000,
                         unit: it.mass, qty: 0, wt: 0 };
        keys.push(key);
      }
      e.qty++;
      if (!def.count) total += it.mass;          // bolts are counted, not weighed
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
    if (def.count) {                               // a bolt: nothing but how many
      // no area, no kg/m, no unit weight - see BOQ_KIND
    } else if (def.area) {                         // a plate: face area, thickness
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
      if (!def.count)
        cols.push({ h: 'kg / UNIT', f: BQ_WT, sum: 1, k: function (r) { return r.unit * r.per; },
                   fm: function (rn, ix) {
                     return ref(ix, 'UNIT kg', rn) + '*' + ref(ix, 'QTY / UNIT', rn); } });
      cols.push({ h: 'TOTAL QTY', f: '#,##0', sum: 1, k: function (r) { return r.qty; } });
      if (!def.count)
        cols.push({ h: 'TOTAL kg', f: BQ_WT, sum: 1, k: function (r) { return r.wt; },
                   fm: function (rn, ix) {
                     return ref(ix, 'UNIT kg', rn) + '*' + ref(ix, 'TOTAL QTY', rn); } });
    } else {
      cols.push({ h: 'QTY', f: '#,##0', sum: 1, k: function (r) { return r.qty; } });
      if (!def.count)
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
      var counted = blocks.every(function (b) { return BOQ_KIND[b.kind].count; });
      blocks.forEach(function (b) {
        nItem += b.n;
        agg.rows.forEach(function (r) { if (r.kind === b.kind) { q += r.qty; w += r.wt; } });
      });
      if (counted) w = 0;                 // bolts are counted, never weighed
      var pre = function (a) { return "'PART LIST'!" + a; };
      var row = s1.addRow([cat, nItem, null, null, null]);
      row.getCell(3).value = fxSum(bqPick(blocks, 'QTY').map(pre), q);
      if (!counted) row.getCell(4).value = fxSum(bqPick(blocks, 'WEIGHT kg').map(pre), w);
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

    /* A member cut to a face is no longer a sweep - its ends lean, and
       IFCEXTRUDEDAREASOLID has one length and one direction to say it with. It
       goes out as an explicit boundary instead: the two end faces on their own
       planes, and one quad per outline edge joining them.

       The other way round would have been IFCBOOLEANCLIPPINGRESULT over a half
       space, which is shorter to write and is what a modeller would emit. It is
       not written that way here because it turns on IFCHALFSPACESOLID's
       AgreementFlag, and a boolean flag read the wrong way round produces a
       file that opens cleanly and shows the offcut instead of the member. A
       brep cannot be misread: the faces are the faces.

       Winding: outlines are turned CCW and holes CW first, so one rule serves
       every loop - a wall runs a.lo, b.lo, b.hi, a.hi and comes out facing away
       from the material, holes included. */
    function brepOf(rings, thk, caps) {
      var Z = capPlanes(thk, caps), faces = [];
      function loop(pts) { return nx('IFCPOLYLOOP((' + pts.join(',') + '))'); }
      function face(bounds) { return nx('IFCFACE((' + bounds.join(',') + '))'); }
      rings.outers.forEach(function (raw, i) {
        var loops = [ccw(raw)].concat((rings.holes[i] || []).map(cw));
        // one point per loop, vertex and end, shared by the cap and both walls
        var P = loops.map(function (ring) {
          return ring.map(function (q) {
            return { lo: pt3(q[0], q[1], Z.lo(q[0], q[1])),
                     hi: pt3(q[0], q[1], Z.hi(q[0], q[1])) };
          });
        });
        [['hi', false], ['lo', true]].forEach(function (cap) {   // outward +z, then -z
          faces.push(face(loops.map(function (ring, k) {
            var pts = P[k].map(function (p) { return p[cap[0]]; });
            if (cap[1]) pts = pts.slice().reverse();
            return nx((k ? 'IFCFACEBOUND(' : 'IFCFACEOUTERBOUND(') + loop(pts) + ',.T.)');
          })));
        });
        loops.forEach(function (ring, k) {
          for (var j = 0; j < ring.length; j++) {
            var a = P[k][j], b = P[k][(j + 1) % ring.length];
            faces.push(face([nx('IFCFACEOUTERBOUND(' +
              loop([a.lo, b.lo, b.hi, a.hi]) + ',.T.)')]));
          }
        });
      });
      if (!faces.length) return null;
      return nx('IFCFACETEDBREP(' + nx('IFCCLOSEDSHELL((' + faces.join(',') + '))') + ')');
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
    function emit(it, lp, solids, repType) {
      var shape = nx('IFCSHAPEREPRESENTATION(' + oCtx + ",'Body'," + sq(repType) + ',(' +
                     solids.join(',') + '))');
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
    }
    list.forEach(function (it) {
      var m = it.matrix.elements;                         // column-major, already Z-up
      var loc = pt3(m[12], m[13], m[14]);
      var axis = dir3(m[8], m[9], m[10]);
      var ref = dir3(m[0], m[1], m[2]);
      var a2p = nx('IFCAXIS2PLACEMENT3D(' + loc + ',' + axis + ',' + ref + ')');
      var lp = nx('IFCLOCALPLACEMENT(' + plSt + ',' + a2p + ')');
      if (it.caps) {                                    // an end cut to a face
        var brep = brepOf(it.rings, it.thk, it.caps);
        if (brep) { emit(it, lp, [brep], 'Brep'); return; }
      }
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
      emit(it, lp, solids, 'SweptSolid');
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
    closeMenus();
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

  /* The hollow pair get their own figure rather than a fourth and fifth panel
     beside H, C and L. They are not more rolled shapes - they are the two the
     bore is subtracted from, and every question a reader has about them (where
     is the wall measured, which corner is r) is about that bore. Both are drawn
     with fill-rule evenodd, so what shows through the middle really is a hole
     and not a white shape laid on top. */
  var GUIDE_SVG_TUBE =
    '<figure><svg class="gsvg" viewBox="0 0 520 180" role="img">' +
    // P - a round tube
    '<g fill="#dbeafe" stroke="#2563eb" stroke-width="1.4" fill-rule="evenodd">' +
    '<path d="M100 80 A50 50 0 1 0 200 80 A50 50 0 1 0 100 80 Z' +
    'M108 80 A42 42 0 1 0 192 80 A42 42 0 1 0 108 80 Z"/></g>' +
    '<g stroke="#94a3b8" stroke-width="0.8" fill="none">' +
    '<path d="M114 45 L186 115"/><path d="M205 47 L221 33"/></g>' +
    '<g font-size="10" fill="#64748b">' +
    '<text x="150" y="86" text-anchor="middle">d</text>' +
    '<text x="224" y="32">t</text></g>' +
    '<text x="150" y="168" font-size="12" font-weight="700" fill="#0f172a" text-anchor="middle">P</text>' +
    // R - a rectangular tube
    '<g fill="#dbeafe" stroke="#2563eb" stroke-width="1.4" fill-rule="evenodd">' +
    '<path d="M344 30 H456 A14 14 0 0 1 470 44 V116 A14 14 0 0 1 456 130 H344' +
    'A14 14 0 0 1 330 116 V44 A14 14 0 0 1 344 30 Z' +
    'M344 38 H456 A6 6 0 0 1 462 44 V116 A6 6 0 0 1 456 122 H344' +
    'A6 6 0 0 1 338 116 V44 A6 6 0 0 1 344 38 Z"/></g>' +
    '<g stroke="#94a3b8" stroke-width="0.8" fill="none">' +
    '<path d="M463 37 L479 23"/></g>' +
    '<g font-size="10" fill="#64748b">' +
    '<text x="400" y="24" text-anchor="middle">b</text>' +
    '<text x="318" y="84">h</text>' +
    '<text x="348" y="84">t</text>' +
    '<text x="482" y="22">r</text></g>' +
    '<text x="400" y="168" font-size="12" font-weight="700" fill="#0f172a" text-anchor="middle">R</text>' +
    '</svg>' +
    '<figcaption><b>d</b> and <b>h</b>/<b>b</b> are over the <b>outside</b>, and <b>t</b> is' +
    ' the wall. <b>r</b> is the <b>outer</b> corner; the inner one follows from it as' +
    ' <code>r - t</code> and is not written on the row. Leave <b>r</b> blank and the corner' +
    ' comes out square.</figcaption></figure>';

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
    '<table class="gt"><thead><tr><th>tier</th><th>what it is</th><th>keywords</th>',
    '<th>drawn by</th></tr></thead><tbody>',
    '<tr><td><b>PART</b></td><td>one piece of steel, defined once and used as often as you',
    ' like. A <b>PLATE</b> is a flat outline; a <b>SECT</b> is a steel section - a rolled',
    ' H, C or L, or a hollow P or R; a',
    ' <b>BAR</b> is a round bar. A <b>HOLE</b> is not a part at all - it is a shape you',
    ' subtract from a plate with <b>CUT</b>, which is how holes, notches and slots are made.</td>',
    '<td><code>PLATE</code> <code>HOLE</code> <code>CUT</code> <code>SECT</code> <code>BAR</code></td>',
    '<td><code>PLOT&nbsp;PART</code><br><code>PLOT&nbsp;SECT</code></td></tr>',
    '<tr><td><b>MODULE</b></td><td>parts placed relative to each other - a column, a bracket,',
    ' a diaphragm. Plates, sections and bars all go in the same way. The module carries its',
    ' own origin (its <b>BASE</b>) so it can be set down anywhere later.</td>',
    '<td><code>MODULE</code></td><td><code>VIEW</code></td></tr>',
    '<tr><td><b>ASSEMBLY</b></td><td>modules placed in the world, and assemblies of',
    ' assemblies. This is where mirroring, arraying and rotating happen, so one module can',
    ' become forty without another row of geometry.</td><td><code>ASSY</code></td>',
    '<td><code>VIEW</code></td></tr>',
    '</tbody></table>',
    '<p>The right-hand column is what puts a tier on paper, and the split follows the tiers',
    ' exactly: <b>PLOT</b> draws a <i>part</i> on its own at its standard section, so it takes',
    ' a <code>PLATE</code> or a <code>SECT</code> and nothing else. <b>VIEW</b> draws a thing',
    ' <i>as placed</i>, seen from somewhere, so it takes a <code>MODULE</code> or an',
    ' <code>ASSY</code>. Neither is produced unless a row asks for it &mdash; see',
    ' <b>Save DXF</b> below.</p>',
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
    '<tr><td><code>VIEW</code>, <code>PLOT</code></td><td><b>the DXF, and nowhere else.</b>',
    ' They put nothing in the main window - they say what the drawing is to hold</td></tr>',
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
    sheet([['CUT', 'plate.id', 'L.X', 'L.Y', 'shape.id', 'dx', 'dy', 'repeat',
            'dx2', 'dy2', 'repeat2']]),
    '<p>Reads as: <i>take this shape and subtract it from that plate, with the shape&rsquo;s own',
    ' BASE.pt landing at (L.X, L.Y) measured from the plate&rsquo;s origin.</i></p>',
    '<table class="gt"><thead><tr><th>field</th><th>meaning</th></tr></thead><tbody>',
    '<tr><td><code>plate.id</code></td><td>the part to cut. Must be defined further up the sheet</td></tr>',
    '<tr><td><code>L.X L.Y</code></td><td>where the shape goes, from the plate&rsquo;s BASE.pt</td></tr>',
    '<tr><td><code>shape.id</code></td><td>a HOLE, or another PLATE whose outline you want to borrow</td></tr>',
    '<tr><td><code>dx dy repeat</code></td><td>array copies. <code>repeat</code> is how many',
    ' <i>extra</i> - blank or 0 gives one hole, 1 gives two</td></tr>',
    '<tr><td><code>dx2 dy2 repeat2</code></td><td>optional second axis: it steps the whole',
    ' first row sideways, so one line lays a grid. Blank gives one row, exactly as before</td></tr>',
    '</tbody></table>',
    '<p>Inside the outline it is a hole; straddling the edge it is a notch. It may run off',
    ' the plate entirely - only the overlap is removed. Rows apply in order, so cuts can',
    ' overlap each other.</p>',
    sheet([['# HOLE', 'id', 'shape', 'base.pt', 'd'],
           ['HOLE', 'h.M22', 'CIRC', 'mc', 22],
           ['# CUT', 'plate', 'L.X', 'L.Y', 'shape', 'dx', 'dy', 'repeat'],
           ['CUT', 'pl.T1', -110, 90, 'h.M22', 0, 220, 1]],
          'Two &#216;22 holes, at (&#8722;110, 90) and (&#8722;110, 310).'),
    sheet([['# CUT', 'plate', 'L.X', 'L.Y', 'shape', 'dx', 'dy', 'repeat',
            'dx2', 'dy2', 'repeat2'],
           ['CUT', 'pl.T1', 35, 85, 'h.M22', 75, 0, 1, 0, -170, 1]],
          'Eight, in a 4 &#215; 2 grid: 75 apart along the plate, 170 across it. ' +
          'Both counts can be formulas, so a front sheet can drive the bolt count.'),
    '<p>A grid needs one row per quadrant when the two halves are split by a joint gap,',
    ' because the gap makes the spacing uneven across the middle - four rows lay any bolt',
    ' pattern of that kind, whatever the counts are.</p>',
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
    '<p>TYPE is <b>H</b>, <b>C</b>, <b>L</b>, <b>P</b> or <b>R</b>. The values follow from',
    ' column G in order with <b>no blank cells between them</b> - each type has its own list.',
    ' The first three are rolled open sections; <b>P</b> is a round tube and <b>R</b> a',
    ' rectangular one.</p>',
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
    '<tr><td><b>P</b></td><td><code>d t</code><br>' +
    '<b>outside</b> diameter &middot; wall thickness</td></tr>',
    '<tr><td><b>R</b></td><td><code>h b t r</code><br>' +
    'depth &middot; width &middot; wall thickness &middot; <b>outer</b> corner radius</td></tr>',
    '</tbody></table>',
    sheet([['# SECT', 'id', 'mat', 'length', 'TYPE', 'base.pt', 'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7'],
           ['SECT', 's.H', 'SM490', 6000, 'H', 'bc', 400, 200, 200, 8, 13, 13, 16],
           ['SECT', 's.C', 'SS275', 3000, 'C', 'bc', 300, 90, 12, 16, 19, 9],
           ['SECT', 's.L', 'SS275', 2400, 'L', 'bc', 90, 75, 9, 9, 8.5, 6],
           ['SECT', 's.P', 'SS275', 3500, 'P', 'mc', 48.6, 2.5],
           ['SECT', 's.R', 'SS275', 3500, 'R', 'mc', 100, 100, 6, 12]]),
    '<p>An H takes seven values, C and L six. C and L take the same <i>number</i> but they',
    ' mean different things, so the type decides how they are read. An equal angle still',
    ' writes all four: <code>100 100 10 10</code>.</p>',
    '<p><b>P and R are hollow, and the wall is uniform.</b> That is what lets each of them',
    ' be described by so few numbers. A P is the outside diameter and the wall - a',
    ' <code>48.6 2.5</code> scaffold tube is 2.83 kg/m, where the same 48.6 written as a',
    ' solid <code>BAR</code> would be 14.56 - and an R is the two outside faces, the wall,',
    ' and the radius of the <b>outer</b> corner. The inner corner is not asked for: a formed',
    ' tube keeps its wall round the bend, so it is <code>r - t</code>, and square whenever the',
    ' wall is the thicker of the two. A square tube is an R whose <code>h</code> and',
    ' <code>b</code> match - there is no separate type for it.</p>',
    GUIDE_SVG_TUBE,
    '<p>The names on the standards are taken too: <code>CHS</code>, <code>PIPE</code> and',
    ' <code>O</code> read as P; <code>RHS</code>, <code>SHS</code> and <code>BOX</code> read',
    ' as R - the same courtesy <code>I</code> has always had for H.</p>',
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

    '<h3>BOLT - a bar that knows it is a bolt</h3>',
    sheet([['# BOLT', 'id', 'mat', 'dia', 'length', 'hole', 'head_af', 'head_h', 'nut_af', 'nut_h', 'proj'],
           ['BOLT', 'bo.m16', 'F10T', 16, 50],
           ['BOLT', 'bo.m20', 'F10T', 20, 60, 24, 32, 13, 32, 19, 0]]),
    '<p>A <b>BAR</b> is a length of round stock and the engine treats it as one. A',
    ' <b>BOLT</b> is the same shape with a job: it can say which members its axis passes',
    ' through, so the hole is written <i>once</i> - as the bolt - instead of once as the',
    ' bolt and again as a hole in every part it goes through.</p>',
    '<p><b>The point on the MODULE row is the underside of the head.</b> That is the face',
    ' of the steel the bolt is pulled against, and the one number you already know from the',
    ' drawing - the outside of a flange, the face of a cleat. The head stands off behind it,',
    ' the shank runs <code>length</code> forward, the nut sits at the far end - inside the',
    ' length, not hung off it.</p>',
    '<p><code>proj</code> is the thread left showing past the nut. It is <b>0.2 &times; dia</b>',
    ' unless you say otherwise, because a bolt that finishes flush with its nut has been cut',
    ' short - a real one runs a little past. So <code>length</code> is <b>grip + nut +',
    ' proj</b>. Type <code>0</code> and you get the flush end; leave it blank and you get the',
    ' usual stub.</p>',
    '<p>That stub is also <b>how you tell which end is which</b> on screen. A head and a nut are',
    ' both hexagons of the same size across the flats - only the nut is taller, 0.9d against',
    ' 0.625d, which is real but not much to go on at a glance. The thread showing past the nut',
    ' is unmistakable, and it is there because bolts are like that, not because the picture',
    ' needed a hint.</p>',
    '<p>Write a length longer than grip + nut + proj and the nut stands off the steel -',
    ' visibly, which is the right way for a wrong length to show itself.</p>',
    '<p><b>The head and the nut are drawn and nothing more.</b> Every number the drawings and',
    ' the take-off use is the shank&rsquo;s: the hole is the shank plus the clearance, the pitch',
    ' chains run between shank axes, and the weight is the shank&rsquo;s. A head a millimetre out',
    ' changes nothing anyone is paid for.</p>',
    '<p>To turn one round, rotate it 180&deg; with the <b>ROT</b> columns the MODULE row',
    ' already has - about whichever axis lies across the bolt. There is no head-side column,',
    ' because the sheet can already say it.</p>',
    '<p><b>Only the first four values are needed.</b> The rest come off the diameter:</p>',
    '<table class="gt"><thead><tr><th>left blank</th><th>becomes</th><th>M16</th><th>M20</th></tr></thead><tbody>',
    '<tr><td><code>hole</code></td><td>dia + 2</td><td>18</td><td>22</td></tr>',
    '<tr><td><code>head_af</code></td><td>1.5 &times; dia &nbsp;(across the flats)</td><td>24</td><td>30</td></tr>',
    '<tr><td><code>head_h</code></td><td>0.625 &times; dia</td><td>10</td><td>12.5</td></tr>',
    '<tr><td><code>nut_af</code></td><td>same as the head</td><td>24</td><td>30</td></tr>',
    '<tr><td><code>nut_h</code></td><td>0.9 &times; dia</td><td>14.4</td><td>18</td></tr>',
    '<tr><td><code>proj</code></td><td>0.2 &times; dia &nbsp;(thread showing past the nut)</td><td>3.2</td><td>4</td></tr>',
    '</tbody></table>',
    '<p>Those are the ISO hex numbers, and they are ratios rather than a table because five',
    ' ratios are honest where a bolt catalogue would not be. <b>A high-strength structural',
    ' bolt is bigger</b> - an M20 F10T head is 32 across, not 30 - which is exactly why every',
    ' one of them can be typed instead.</p>',
    '<p class="warn">A BOLT row is refused if the diameter or the length is missing, if the',
    ' hole is smaller than the bolt, or if the head is no bigger than the shank.</p>',

    '<h3>MODULE - parts into a unit</h3>',
    sheet([['MODULE', 'id', 'member.id', 'Ref.Pt', 'L.X', 'L.Y', 'L.Z', 'PLANE',
            'ROT.X', 'ROT.Y', 'ROT.Z', 'dx', 'dy', 'dz', 'repeat',
            'dx2', 'dy2', 'dz2', 'repeat2'],
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
    '<h4>Repeating a member</h4>',
    '<p>The last two groups of columns are the same two repeat axes a <b>CUT</b> row has, and',
    ' they work the same way: <code>dx dy dz</code> stepped <code>repeat</code> more times, and',
    ' <code>dx2 dy2 dz2</code> stepping that whole row sideways <code>repeat2</code> more. Left',
    ' blank the row is one member, as it always was.</p>',
    sheet([['# MODULE', 'id', 'member', 'Ref.Pt', 'L.X', 'L.Y', 'L.Z', 'PLANE',
            'RX', 'RY', 'RZ', 'dx', 'dy', 'dz', 'rep', 'dx2', 'dy2', 'dz2', 'rep2'],
           ['MODULE', 'md.blt', 'bo.M22', '', 35, 50, 110, 'XY',
            0, 0, 0, 75, 0, 0, 3, 0, 55, 0, 2]],
          'One row, twelve bolts: four along at 75, three across at 55.'),
    '<p><b>Why this and not one row each.</b> A row cannot be conjured by a formula, so a sheet',
    ' that writes a member out one row at a time has its count fixed when the file is written -',
    ' a front sheet can change the spacing but never how many. Put the count in',
    ' <code>repeat</code> and it can be a formula like anything else.</p>',
    '<p>A <b>blank member id</b> is a row switched off, skipped without a word. That is the other',
    ' half of the same idea: lay out the most of something anyone might ask for, and let the',
    ' sheet turn the rest off with <code>=IF(...,"bo.M22","")</code>.</p>',
    '<p><b>Name the part; the engine numbers the copies.</b> A <b>PLATE</b> row is a shape and a',
    ' <b>MODULE</b> row is one use of it, so write <code>pl.C1</code> as many times as you use it.',
    ' The app gives each use an id of its own - <code>pl.C1_1</code>, <code>pl.C1_2</code>, ... -',
    ' because BASE, the module preview and the assembly list all address a member by name. A part',
    ' used once keeps its plain name. You can still write the suffix yourself when you want to',
    ' point <b>BASE</b> at a particular copy; a bare name there means the first one.</p>',

    '<h3>MODULE by coordinates - a bar or a section between two points</h3>',
    sheet([['MODULE', 'id', 'member.id', 'Ref.Pt', 'LX1', 'LY1', 'LZ1',
            'LX2', 'LY2', 'LZ2', 'OFF_B', 'OFF_E', 'Alpha',
            'dx', 'dy', 'dz', 'repeat', 'dx2', 'dy2', 'dz2', 'repeat2']]),
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
    '<h4>Repeating it</h4>',
    '<p>The last eight columns are the same two repeat axes the row above has, sitting after',
    ' <code>Alpha</code>. A copy <b>moves both ends by the same step</b>, so it keeps the direction,',
    ' the length and both trims of the row it came from - a rail of identical braces, a run of',
    ' studs, a line of anchor bolts. Left blank the row is one member, as it always was.</p>',
    sheet([['# MODULE', 'id', 'member', 'Ref.Pt', 'LX1', 'LY1', 'LZ1', 'LX2', 'LY2', 'LZ2',
            'OFF_B', 'OFF_E', 'Alpha', 'dx', 'dy', 'dz', 'rep', 'dx2', 'dy2', 'dz2', 'rep2'],
           ['MODULE', 'md.rail', 's.brc', '', 0, 0, 0, 0, 0, 900, 0, 0, 0,
            1500, 0, 0, 5, 0, 2400, 0, 1]],
          'One row, twelve posts: six along at 1500, on two lines 2400 apart.'),
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
    '<tr><td><b>File</b></td><td>everything that reads or writes a file, on one menu</td></tr>',
    '<tr><td><b>Save DXF</b></td><td>the drawings the sheet asked for. See below</td></tr>',
    '<tr><td><b>Save STL</b></td><td>the model as a triangle mesh</td></tr>',
    '<tr><td><b>Save IFC</b></td><td>the model as real BIM solids - each part its exact profile,',
    ' holes as voids, extruded by its thickness</td></tr>',
    '<tr><td><b>Save BOQ</b></td><td>the take-off, as a workbook. See below</td></tr>',
    '<tr><td><b>View</b></td><td>the standard views - <b>ISO / Front / Side / Top</b>. The one',
    ' you are looking through fills in</td></tr>',
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

    '<h3>Save DXF - the drawing</h3>',
    '<p><b>The sheet says what goes on paper, and nothing else does.</b> Save DXF asks',
    ' nothing and draws what the rows asked for, each at the scale its own row gives it.',
    ' A sheet with no drawing row exports nothing and says so.</p>',
    '<table class="gt"><thead><tr><th>row</th><th>what it draws</th></tr></thead><tbody>',
    '<tr><td><code>VIEW</code></td><td>one drawing of a <b>MODULE or an ASSY</b>, seen from',
    ' the direction the row names, titled as the row titles it. Only that id is drawn &mdash;',
    ' nothing standing beside it comes along.</td></tr>',
    '<tr><td><code>PLOT&nbsp;PART</code></td><td>plates on their own, each once at its',
    ' standard section with how many were placed. An id, or <code>ALL</code>.</td></tr>',
    '<tr><td><code>PLOT&nbsp;SECT</code></td><td>the same for rolled sections. Separate from',
    ' PART because a gusset and a six-metre beam do not share a scale. Round <b>bars are not',
    ' drawn</b> either way &mdash; a bar is a length of stock, and a circle with a diameter',
    ' beside it says nothing the take-off does not.</td></tr>',
    '</tbody></table>',
    '<p>The columns do not move. A named direction leaves AZ and EL empty rather than',
    ' sliding the scale two cells along, so the sixth cell is the scale wherever you look',
    ' down the block &mdash; and a named direction <i>with</i> something in those cells is',
    ' refused by name, because that is the shape of a row written to the older grammar.</p>',
    sheet([['# VIEW', 'id', 'dir', 'AZ', 'EL', 'scale', 'title'],
           ['VIEW', 'md.wpl', 'FRONT', '', '', 10, 'Web plate'],
           ['VIEW', 'md.bay', 'ISO', '', '', 25, 'Bay assembly'],
           ['VIEW', 'as.frame', '3D', -45, 35.26, 50, 'Frame, from the low side'],
           ['VIEW', 'as.frame', 'TOP', '', '', 50, 'Frame, from above']],
          'A named direction leaves <b>AZ</b> and <b>EL</b> empty rather than sliding the' +
          ' scale two cells left. Row 4 is the corner <code>ISO</code> names, written out;' +
          ' <code>3D -90 0</code> is likewise exactly <code>FRONT</code>, and that is' +
          ' asserted against the real export rather than assumed.'),
    sheet([['# PLOT', 'PART | SECT', 'id | ALL', 'scale', 'title'],
           ['PLOT', 'PART', 'ALL', 10, 'Plates'],
           ['PLOT', 'SECT', 'ALL', 20, 'Sections'],
           ['PLOT', 'PART', 'pl.gusset', 5]],
          'Plates and sections are asked for separately so each can carry its own scale -' +
          ' a gusset and a six-metre beam do not share one. <code>ALL</code> saves naming' +
          ' forty parts by hand and going stale the moment one is added.'),
    '<p><b>Hidden lines are removed.</b> An edge with steel in front of it is not drawn, in',
    ' every VIEW drawing &mdash; not only the angled ones, because tying it to how the',
    ' direction was spelled would make <code>3D -90 0</code> and <code>FRONT</code> two',
    ' different pictures of one direction. It is computed rather than sampled: every member',
    ' is a profile extruded between two planes, so the depth of a face over any point of the',
    ' page is a straight-line function and an edge changes from in front to behind only',
    ' where it crosses that face&rsquo;s boundary. One exception, which is worth knowing: a',
    ' round hole is kept or dropped <b>whole</b>. There is no partial arc in DXF R12, so a',
    ' hole half behind a flange draws whole.</p>',
    '<p><b>Why the sheet and not tick boxes.</b> Which face of a splice you want drawn, what',
    ' to call it and how big to plot it are known by whoever wrote the workbook &mdash; not',
    ' by whoever presses Save DXF, who would have to answer it again every time. The engine',
    ' used to draw six views of everything placed, six of each module and one of every part,',
    ' whether or not anyone wanted them, at whatever single scale the dialog was carrying.',
    ' That answered &ldquo;what is in this model&rdquo;, which the model tree on the left',
    ' answers better. Nothing in the engine knows what a splice is.</p>',

    '<p><b>The direction a VIEW is seen from.</b> Six of them have names &mdash;',
    ' <code>FRONT</code>, <code>BACK</code>, <code>LEFT</code>, <code>RIGHT</code>,',
    ' <code>TOP</code>, <code>BOTTOM</code>. Four more name an isometric corner by where the',
    ' viewer stands &mdash; <code>ISO-SE</code>, <code>ISO-SW</code>, <code>ISO-NW</code>,',
    ' <code>ISO-NE</code> &mdash; and <code>ISO</code> on its own is the south-east one, the',
    ' corner that shows the face FRONT shows plus the right side and the top.</p>',
    '<p>Any other direction is the word <code>3D</code> and two angles:</p>',
    '<table class="gt"><thead><tr><th>angle</th><th>what it does</th></tr></thead><tbody>',
    '<tr><td><b>AZ</b></td><td>walks the viewer round the model in the ground plane, measured',
    ' from +X (east) anticlockwise. On the page the model turns about its vertical</td></tr>',
    '<tr><td><b>EL</b></td><td>lifts the viewer off the ground, &minus;90 to 90. At 0 you',
    ' stand level with the model; at 90 you are directly overhead looking down. On the page',
    ' the model tips towards you and its top comes into view</td></tr>',
    '</tbody></table>',
    '<p>The page keeps world Z upright &mdash; up is world Z with the view direction taken',
    ' out of it &mdash; so <b>a column draws vertical whatever the angles are</b>. That is why',
    ' two angles are enough where a rotation would need three: a third angle would only tilt',
    ' the picture on the paper, which a drawing does not want. The named views are the special',
    ' cases of the same two numbers:</p>',
    '<table class="gt"><thead><tr><th>view</th><th>AZ</th><th>EL</th></tr></thead><tbody>',
    '<tr><td>FRONT</td><td>&minus;90</td><td>0</td></tr>',
    '<tr><td>RIGHT</td><td>0</td><td>0</td></tr>',
    '<tr><td>BACK</td><td>90</td><td>0</td></tr>',
    '<tr><td>LEFT</td><td>180</td><td>0</td></tr>',
    '<tr><td>TOP</td><td>0</td><td>90</td></tr>',
    '<tr><td>BOTTOM</td><td>0</td><td>&minus;90</td></tr>',
    '<tr><td>ISO</td><td>&minus;45</td><td>35.26</td></tr>',
    '</tbody></table>',
    '<p><code>VIEW md.bay ISO Bay assembly</code> and',
    ' <code>VIEW md.bay 3D -45 35.26 Bay assembly</code> draw the same picture. EL past 90',
    ' is refused rather than read: over the top is a direction already reachable below 90',
    ' with AZ turned round, and taking it at face value draws the model upside down.</p>',
    '<p><b>The steel is written 1:1 in millimetres throughout.</b> Only the annotation changes',
    ' size, so every drawing shares one coordinate system and a viewport plotted at its',
    ' own row&rsquo;s scale comes out right. The file is DXF R12 and the annotation is drawn -',
    ' lines, text and filled marks - rather than left to the CAD&rsquo;s dimension style, so it',
    ' reads the same wherever it is opened.</p>',
    '<p>What is dimensioned, at every scale:</p>',
    '<table class="gt"><thead><tr><th>on</th><th>what you get</th></tr></thead><tbody>',
    '<tr><td>a plate</td><td>the bottom edge and the top edge when they differ - a trapezoid',
    ' gives up both parallel sides - and the height</td></tr>',
    '<tr><td>a CUT</td><td>the same, one per distinct shape, at closer offsets so the inside',
    ' of a small plate does not fill up. A round cut gets a diameter instead: the line runs',
    ' through the centre with an arrow on each side of it</td></tr>',
    '<tr><td>a section</td><td>overall height and width, flange thicknesses off the flange tip,',
    ' the web carried out of the section, and the root and toe radii on leaders</td></tr>',
    '<tr><td>a hole pattern</td><td>a <b>pitch chain</b> along each axis - edge distance, every',
    ' pitch, and any gap left in the middle. It reads off the hole centres, so however many CUT',
    ' rows put them there you get one chain per axis, not one per row. Two or more equal pitches',
    ' in a row are written <code>3@75=225</code></td></tr>',
    '</tbody></table>',
    '<p>The chain goes <b>nearest the steel</b> and the overall size stands outside it: a chain',
    ' read after the number it adds up to is a chain read twice. A number too wide for its own',
    ' link steps one text height further out rather than sitting on its neighbour.</p>',
    '<p><b>Context on a named view.</b> The rest of the model is drawn on <code>PL3D-HIDDEN</code>',
    ' round the part, so a plate is seen on its beam rather than floating. It is trimmed three',
    ' ways, and each one is there for a reason: <b>across the page</b>, because an 1820&nbsp;mm',
    ' beam would otherwise set the size of a 300&nbsp;mm drawing; <b>in depth</b>, because an',
    ' orthographic view is flat and the bottom flange would come through the top one; and to',
    ' <b>outlines only, no bars</b>, because every hole and every bolt in the rest of the model',
    ' says nothing about where this part sits and buries the part that does.</p>',
    '<p>A cut is measured at the size the sheet wrote, even where it hangs over an edge -',
    ' only the overlap comes out of the steel, but the whole shape is what gets cut.</p>',
    '<p><b>Round cuts come out round.</b> A hole is a real <code>CIRCLE</code>, and one that',
    ' reaches an edge is the <code>ARC</code> that is left of it - so it stays smooth however',
    ' far you zoom, and centre, quadrant and tangent all snap. The engine knows which they are',
    ' because it keeps the CUT rows it was given, so it is checking against circles the sheet',
    ' actually asked for rather than guessing at one from the points.</p>',
    '<p class="warn">Two things stay as straight segments, and both are honest about it: a',
    ' circle seen at an angle is an ellipse, and R12 has no ELLIPSE entity; and a curve that was',
    ' never a CUT circle - a shape traced point by point - was never round to begin with.</p>',
    '<p>Layers, and the line type each one carries. They are the four line types the rest of',
    ' macroBIM writes, to the same dash lengths, so a PLATE3D drawing opens with the same pen',
    ' set as one from anywhere else in the suite:</p>',
    '<table class="gt"><thead><tr><th>layer</th><th>line type</th><th>what is on it</th></tr></thead><tbody>',
    '<tr><td><code>PL3D-OUTLINE</code></td><td>CONTINUOUS</td><td>the steel</td></tr>',
    '<tr><td><code>PL3D-HOLE</code></td><td>CONTINUOUS</td><td>what was cut out of it</td></tr>',
    '<tr><td><code>PL3D-DIM</code></td><td>CONTINUOUS</td><td>dimension lines, leaders, arrow marks</td></tr>',
    '<tr><td><code>PL3D-TEXT</code></td><td>CONTINUOUS</td><td>numbers, part names, quantities</td></tr>',
    '<tr><td><code>PL3D-TITLE</code></td><td>CONTINUOUS</td><td>block and view titles</td></tr>',
    '<tr><td><code>PL3D-CENTER</code></td><td>CENTER</td><td>centre and gauge lines</td></tr>',
    '<tr><td><code>PL3D-HIDDEN</code></td><td>HIDDEN</td><td>what lies behind the part in view</td></tr>',
    '</tbody></table>',
    '<p>The last two are registered and ready but nothing is drawn on them yet - they arrive',
    ' with the bolt pitch chains and the view context.</p>',

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
           ['# VIEW', 'id', 'dir', 'AZ', 'EL', 'scale', 'title'],
           ['VIEW', 'as.comb', 'ISO', '', '', 25, 'Tower - isometric'],
           ['VIEW', 'md.tower', 'FRONT', '', '', 10, 'Tower module'],
           ['# PLOT', 'PART | SECT', 'id | ALL', 'scale', 'title'],
           ['PLOT', 'PART', 'ALL', 10, 'Plates'],
           ['END']],
          'The last three rows are the drawings. Without them the sheet builds the model ' +
          'and exports nothing - a drawing is made because a row asked for it. ' +
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

  /* ?ui=quick — the viewer embedded under a form rather than standing alone.

     There are three ways a file can replace the model: Load Excel, Example,
     and dropping an .xlsx on the window. Under QuickPlate3D all three are
     wrong, and quietly so: the form above would still show the values it was
     left with while the model below came from somewhere else, and nothing on
     screen would say they had parted company. So the three are removed.

     Removed, not disabled - a greyed button invites a click and then explains
     itself, and there is nothing to explain here. The Save items stay: a model
     built from the form is exactly as worth exporting as one built from a
     file, and they cannot desynchronise anything because they only read.

     A flag in the URL rather than a message, because the bar is built once at
     load time and the mode has to be known before it is. */
  var QUICK_UI = /(^|[?&])ui=quick(&|$)/.test(location.search);
  // what to tell someone whose model is empty - and it depends which door in
  var LOAD_HINT = QUICK_UI ? 'Fill in the form above'
                           : 'Load a sheet with Load Excel';

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
      (QUICK_UI ? '' :
      '  <span class="fmenu" id="pb-fmenu">' +
      '    <button class="accent" onclick="plateBuilder.toggleFileMenu(event)">' +
      '      File <span class="car">&#9662;</span></button>' +
      '    <span class="drop">' +
      '      <button onclick="plateBuilder.pickExcel()">&#8682; Load Excel&hellip;</button>' +
      '      <i></i>' +
      '      <button onclick="plateBuilder.exportDXF()" title="the drawings the sheet' +
      ' asked for, each at its own row\'s scale">Save DXF&hellip;</button>' +
      '      <button onclick="plateBuilder.exportBOQ()" title="quantities and weights' +
      ' as a workbook">Save BOQ</button>' +
      '      <i></i>' +
      '      <button onclick="plateBuilder.exportSTL()" title="the model as a triangle' +
      ' mesh">Save STL</button>' +
      '      <button onclick="plateBuilder.exportIFC()" title="the model as BIM solids">' +
      'Save IFC</button>' +
      '    </span>' +
      '  </span>' +
      '  <input type="file" id="pb-file" accept=".xlsx,.xls" style="display:none">') +
      '  <span class="fmenu" id="pb-vmenu">' +
      '    <button onclick="plateBuilder.toggleViewMenu(event)">' +
      '      View <span class="car">&#9662;</span></button>' +
      '    <span class="drop">' +
      '      <button class="vw active" onclick="plateBuilder.setView(\'iso\')">ISO</button>' +
      '      <button class="vw" onclick="plateBuilder.setView(\'front\')">Front</button>' +
      '      <button class="vw" onclick="plateBuilder.setView(\'side\')">Side</button>' +
      '      <button class="vw" onclick="plateBuilder.setView(\'top\')">Top</button>' +
      '    </span>' +
      '  </span>' +
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
      (QUICK_UI ? '' :
      '  <button class="guide ex" onclick="plateBuilder.openSamples(event)"' +
      '    title="download a worked sheet to start from">' +
      ICON_DL + 'Example</button>') +
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
      // NOT the menus - see the click listener below. Shutting them on mousedown
      // hides the item before mouseup lands on it, and the click event then
      // never reaches the item at all: hold the button down for even a moment
      // and nothing happens.
    });
    /* A menu shuts on the next click anywhere, its own items included - on
       click, after the item's own handler has run, not on mousedown before it.
       The toggle buttons stop propagation and handle themselves. */
    window.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('#pb-fmenu > button, #pb-vmenu > button')) return;
      closeMenus();
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

    /* Excel loading: file picker + drag & drop anywhere on the app. Both are
       off under ?ui=quick - the third door, and the easy one to forget, since
       a drop needs no button to be visible to work. Left wired, a file dragged
       onto the viewer would replace a model the form above still claims to
       describe. */
    if (!QUICK_UI) {
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
    }

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
      /* The list panel matches the view. It is a flex item, so by default it
         stretched to the full body height while the 16:9 view sat centred and
         shorter - two boxes of different heights side by side, and the panel
         scrolling because it thought it had more room than it was showing. */
      var sd = document.getElementById('pb-side');
      if (sd) sd.style.height = ch + 'px';
      tellHost();
    }
    /* How tall this page needs to be, told to whoever framed it. In an iframe
       the height is a guess made outside - the macroBIM layout reserved a
       constant for whatever sits above the frame - and a guess that is a few
       pixels short scrolls the host page while one that is long leaves white
       under the drawing. Neither is reachable from inside a fixed-height frame.

       The number is worked out from the WIDTH alone and never from the height
       the view currently has. Asking for the current height looks equivalent
       and is not: fitRenderer floors the view's height, the frame comes back
       that little bit shorter, the next pass floors a slightly smaller number,
       and the frame walks itself down to nothing. It did exactly that. Width
       does not depend on the answer, so there is no loop to walk. */
    var toldHost = 0;
    function tellHost() {
      if (window.parent === window) return;
      var bar = document.getElementById('pb-bar');
      var bd = document.getElementById('pb-body');
      if (!bar || !bd) return;
      var bcs = getComputedStyle(bd);
      var availW = wrap.clientWidth - wpx;
      if (!(availW > 0)) return;
      var need = Math.ceil(bar.offsetTop + bar.offsetHeight +
                           parseFloat(bcs.paddingTop) + parseFloat(bcs.paddingBottom) +
                           availW * 9 / 16);
      if (!(need > 0) || Math.abs(need - toldHost) < 2) return;
      toldHost = need;
      try { window.parent.postMessage({ plate3d: 'height', h: need }, '*'); } catch (e) {}
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
      sceneFaces.add(faceTint(it.rings, it.thk, it.matrix, it.caps));
    });
    scene.add(sceneFaces);
  }
  // snap targets for the main scene, rebuilt whenever visibility changes
  function mainSnaps() {
    var out = [];
    items.forEach(function (it) {
      if (!it.groupObj.visible) return;
      out = out.concat(snapPointsOf(it.rings, it.thk, it.matrix, it.spec, it.caps));
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
        var geo = plateGeom(d.shape, d.thk, d.caps);
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
    /* First, and the only one that builds nothing. Every other example teaches
       the grammar by using it, which leaves the reader separating what is
       grammar from what is that particular structure. This one is only the
       grammar, commented out, with room to type between the lines. Basic keeps
       its "Start here": the two say different things - write your own, or watch
       one work. */
    { f: 'PLATE3D_TEMPLATE.xlsx', n: 'Template', s: '149 rows → 0 members, by design',
      d: 'Every keyword and form, commented out. Write your own.' },
    { f: 'PLATE3D_BASIC.xlsx', n: 'Basic', s: '76 rows → 90 members · 1.70 t',
      d: 'Every keyword once, in one real model. Start here.' },
    { f: 'PLATE3D_SAMPLE.xlsx', n: 'Sample', s: '38 rows → 48 members · 803 kg',
      d: 'ADD / MIR / COPY / ROT, one command per assembly.' },
    { f: 'PLATE3D_TOWER.xlsx', n: 'Tower crane', s: '347 rows → 575 members · 73.6 t',
      d: 'A front sheet sets the height, the reach, the hoist and the slew.' },
    { f: 'PLATE3D_PORTAL.xlsx', n: 'Portal frame', s: '116 rows → 297 members · 20.0 t',
      d: 'Half a frame, mirrored and copied into a 30 m shed.' },
    { f: 'PLATE3D_NODE.xlsx', n: 'Bolted node', s: '59 rows → 46 members · 168 kg',
      d: 'A four-way beam connection: one arm, turned four ways.' },
    { f: 'PLATE3D_SPLICE.xlsx', n: 'Beam splice', s: '106 rows → 66 members · 208 kg',
      d: 'A front sheet fills in the input tab, and names its own drawings.' },
    /* Sections, not plates, and that is the point of it. Before BOLT a
       connection had to be built from plates so the holes could be cut, which
       cost the fillets, the section names in the take-off and three times the
       rows. This sheet says CUT nowhere. */
    { f: 'PLATE3D_BCJOINT.xlsx', n: 'Beam to column', s: '36 rows → 13 members · 186 kg',
      d: 'A front sheet picks the sections. Nothing here says CUT.' },
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

  /* The contents list is read off the headings when the guide first opens, not
     written out beside them. A list typed by hand is a second copy of the
     structure, and the copy is what goes stale - a section renamed here and not
     there, or one added and never listed. This cannot drift: it IS the
     headings.

     Numbering does two jobs at once. It makes a heading carry more weight than
     the table under it - a dark table head was outweighing the title it sat
     beneath, so the eye landed on the table and the reader lost what section
     they were in - and it gives the list something to point at. */
  var guideIndexed = false;
  function guideIndex() {
    var doc = document.querySelector('#pb-help .doc');
    if (!doc || guideIndexed) return;
    guideIndexed = true;
    var heads = doc.querySelectorAll('h2, h3');
    var nav = ['<nav id="pb-toc"><b>Contents</b><ol>'];
    var ch = 0, sub2 = 0;
    for (var i = 0; i < heads.length; i++) {
      var h = heads[i], top = h.tagName === 'H2';
      if (top) { ch++; sub2 = 0; } else { sub2++; }
      /* A h3 before any h2 has no chapter to belong to - it is numbered as one
         rather than as 0.1, which would read as a mistake. */
      var no = top || !ch ? String(top ? ch : ++ch) : ch + '.' + sub2;
      h.id = 'g' + no.replace('.', '-');
      var badge = document.createElement('span');
      badge.className = 'n';
      badge.textContent = no;
      h.insertBefore(badge, h.firstChild);
      /* The way back. A heading is where a reader arrives and where they finish,
         so the return sits on it rather than at the foot of a section whose
         length they would have to reach first. */
      var up = document.createElement('a');
      up.className = 'up';
      up.href = '#';
      up.title = 'back to contents';
      up.innerHTML = '&#8593; contents';
      h.appendChild(up);
      nav.push('<li class="' + (top ? 'a' : 'b') + '"><a href="#" data-g="' + h.id + '">' +
               no + '  ' + h.textContent.slice(no.length).trim() + '</a></li>');
    }
    nav.push('</ol></nav>');
    var box = document.createElement('div');
    box.innerHTML = nav.join('');
    doc.insertBefore(box.firstChild, doc.firstChild);
    /* Scrolling is done here rather than by the href, because the document that
       scrolls is .doc and not the page - a real anchor jump would move the page
       behind the dialog and leave the guide where it was. */
    doc.querySelectorAll('#pb-toc a').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var t = document.getElementById(a.getAttribute('data-g'));
        if (t) doc.scrollTop += t.getBoundingClientRect().top -
                                doc.getBoundingClientRect().top - 8;
      });
    });
    // the contents are the first thing in the document, so going back is the top
    doc.querySelectorAll('h2 .up, h3 .up').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); doc.scrollTop = 0; });
    });
  }
  function openGuide() {
    var el = document.getElementById('pb-help');
    if (!el) return;
    el.style.display = 'flex';
    guideIndex();
    el.querySelector('.doc').scrollTop = 0;
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
    toggleMemberAxis: toggleMemberAxis,
    toggleFileMenu: toggleFileMenu, toggleViewMenu: toggleViewMenu,
    closeFileMenu: closeMenus,
    exportDXF: saveDXF, confirmScale: confirmScale,
    // the annotation style, at scale 1 and at any scale - see DIMSTYLE.md
    dimStyleBase: DIMSTYLE, dimStyle: dimStyle, buildDXF: buildDXF
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
