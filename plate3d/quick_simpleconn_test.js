/* QuickPlate3D — Simple connector.

   The same model PLATE3D_COLUMN.xlsx builds, typed on the page instead of
   loaded from a workbook. The point is to remove the round trip: edit the
   sheet, save it, open PLATE3D, pick the file, look, edit again.

   How it works, and why it needs almost nothing from the engine:

     a workbook   File -> ExcelJS -> rows -> parseExcelRows -> run -> model
     this page                      rows -> parseExcelRows -> run -> model

   Excel's part ends at `rows` - a plain array of arrays of numbers and
   strings. Everything downstream of that is ordinary JavaScript and does not
   know or care where the rows came from. So this module's whole job is to
   produce the same rows the generator writes into the input tab, and hand
   them to the frame.

   The frame is the existing PLATE3D embed, cross-origin on github.io, so the
   rows travel by postMessage. It sits under the form on the same page: change
   a number, the model below redraws. No second window - a popup would put the
   round trip straight back.

   Entry point: fquick_simpleconn(mountId). Loaded on demand by layout_body.

   STEP 1 of 4 - the shell. The menu, the page, the two panes and the frame,
   with the form still to come. Committed on its own so the layout can be
   looked at before anything is built into it. */
(function () {
  'use strict';

  /* ui=quick strips the three ways a file can replace the model — Load Excel,
     Example, and dropping an .xlsx on the viewer. Under a form all three would
     leave the inputs above describing something the model below is not, with
     nothing on screen admitting it. The Save items stay. */
  var FRAME = 'https://macrobim.github.io/macroBIM/plate3d/embed_test.html'
            + '?v=' + Date.now() + '&ui=quick';
  var CSS_ID = 'qsc-style';

  var CSS =
    '#qsc-wrap{display:flex;flex-direction:column;gap:14px}' +
    '#qsc-form{border:1px solid #e3e6ea;border-radius:8px;background:#fff;padding:0;overflow:hidden}' +
    '#qsc-bar{display:flex;gap:8px;align-items:center;padding:10px 12px;border-bottom:1px solid #eef0f3;background:#f8fafc}' +
    '#qsc-bar .sp{flex:1}' +
    '.qsc-btn{font:600 12px/1 Arial,sans-serif;padding:8px 12px;border-radius:6px;cursor:pointer;' +
      'border:1px solid #cbd5e1;background:#fff;color:#0f172a}' +
    '.qsc-btn:hover{background:#f1f5f9}' +
    '.qsc-btn.primary{background:#1d4ed8;border-color:#1d4ed8;color:#fff}' +
    '.qsc-btn.primary:hover{background:#1e40af}' +
    '.qsc-menu{position:relative;display:inline-block}' +
    '.qsc-menu>.d{position:absolute;right:0;top:calc(100% + 4px);z-index:20;display:none;' +
      'min-width:150px;background:#fff;border:1px solid #cbd5e1;border-radius:6px;' +
      'box-shadow:0 6px 18px rgba(15,23,42,.12);padding:4px}' +
    '.qsc-menu.open>.d{display:block}' +
    '.qsc-menu>.d button{display:block;width:100%;text-align:left;border:0;background:none;' +
      'font:500 12px/1 Arial,sans-serif;color:#0f172a;padding:9px 10px;border-radius:4px;cursor:pointer}' +
    '.qsc-menu>.d button:hover{background:#f1f5f9}' +
    '#qsc-body{padding:14px}' +
    '#qsc-note{font:italic 12px/1.6 Arial,sans-serif;color:#64748b;margin:0}' +
    '#qsc-frame{width:100%;height:520px;min-height:520px;border:1px solid #e3e6ea;' +
      'border-radius:8px;display:block;background:#15181c}';

  function style() {
    if (document.getElementById(CSS_ID)) return;
    var s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function fquick_simpleconn(mountId) {
    var mount = document.getElementById(mountId);
    if (!mount) return;
    if (mount.firstElementChild) return;         // already up
    style();

    var wrap = document.createElement('div');
    wrap.id = 'qsc-wrap';
    wrap.innerHTML =
      '<div id="qsc-form">' +
      '  <div id="qsc-bar">' +
      '    <button class="qsc-btn primary" id="qsc-update" type="button">Update model</button>' +
      '    <span class="sp"></span>' +
      '    <button class="qsc-btn" id="qsc-import" type="button">Import .xlsx</button>' +
      '    <button class="qsc-btn" id="qsc-export" type="button">Export .xlsx</button>' +
      /* The frame's File menu is gone under ui=quick — in this mode the toolbar
         belongs to this page, and two bars offering file actions is one owner
         too many. The four Save items live here instead and reach the viewer
         by the same postMessage door the rows go through. */
      '    <span class="qsc-menu" id="qsc-savemenu">' +
      '      <button class="qsc-btn" id="qsc-save" type="button">Save &#9662;</button>' +
      '      <span class="d">' +
      '        <button type="button" data-cmd="exportDXF">Save DXF&hellip;</button>' +
      '        <button type="button" data-cmd="exportBOQ">Save BOQ</button>' +
      '        <button type="button" data-cmd="exportSTL">Save STL</button>' +
      '        <button type="button" data-cmd="exportIFC">Save IFC</button>' +
      '      </span>' +
      '    </span>' +
      '  </div>' +
      '  <div id="qsc-body">' +
      '    <p id="qsc-note">The input sheet goes here — the six chapters of PARAM, ' +
      'the same cells in the same order. Step 1 of 4 is the shell you are looking at.</p>' +
      '  </div>' +
      '</div>';

    var fr = document.createElement('iframe');
    fr.id = 'qsc-frame';
    fr.src = FRAME;
    fr.title = 'PLATE3D — Simple connector';
    fr.allow = 'fullscreen';
    wrap.appendChild(fr);
    mount.appendChild(wrap);

    /* The frame reports the height it actually wants; the room it can have is
       measured, not guessed. Same two-value rule the PLATE3D page uses, and for
       the same reason: guess high and the page scrolls, guess low and the view
       is letterboxed. Here the form sits above it, so `room` shrinks as the
       form grows and the frame gives way rather than pushing the page down. */
    var want = 0;
    function sizeFrame() {
      var top = fr.getBoundingClientRect().top;
      var room = Math.floor(window.innerHeight - top - 12);
      var h = want ? Math.min(want, room) : room;
      fr.style.height = Math.max(420, h) + 'px';
    }
    window.addEventListener('message', function (e) {
      var d = e && e.data;
      if (!d || e.source !== fr.contentWindow) return;   // only our own frame
      if (d.plate3d === 'height' && d.h > 0) { want = d.h; sizeFrame(); return; }
      if (d.plate3d === 'cmdFailed') alert('PLATE3D could not do that: ' + d.why);
    });
    window.addEventListener('resize', sizeFrame);
    sizeFrame();

    /* Save — the viewer's own exports, driven from this bar. The frame holds
       the built scene, so the work happens there; this only asks. */
    var menu = document.getElementById('qsc-savemenu');
    document.getElementById('qsc-save').addEventListener('click', function (ev) {
      ev.stopPropagation();
      menu.classList.toggle('open');
    });
    menu.querySelectorAll('.d button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        menu.classList.remove('open');
        fr.contentWindow.postMessage({ plate3d: 'cmd', do: btn.getAttribute('data-cmd') }, '*');
      });
    });
    // click anywhere else closes it, including inside the frame — a menu left
    // hanging over the model while you drag it is worse than one that shuts
    document.addEventListener('click', function () { menu.classList.remove('open'); });
    fr.addEventListener('mouseenter', function () { menu.classList.remove('open'); });
  }

  window.fquick_simpleconn = fquick_simpleconn;
})();
