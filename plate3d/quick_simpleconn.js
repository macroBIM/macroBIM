/* QuickPlate3D — Simple connector.

   The model PLATE3D_COLUMN.xlsx builds, typed on the page instead of loaded
   from a workbook. The point is to remove the round trip: edit the sheet, save
   it, open PLATE3D, pick the file, look, edit again.

   It does no arithmetic of its own. column_model.js holds the defaults, the
   derivations and the rows the engine reads, and the generator that writes the
   .xlsx calls the same module - so the two cannot disagree about what a column
   is. This file is a form over that module's inputs, and a postMessage:

     form  ->  V  ->  columnModel.build(V, cat)  ->  values()  ->  frame

   The frame is the existing PLATE3D embed with ?ui=quick, which strips the
   three ways a file could replace the model underneath the form.

   The six blocks below are PARAM's six chapters in PARAM's order, with the
   same columns and the same words, because you already read that sheet. What
   is NOT here is the formulas: on the sheet a cell like the plate height is
   live, and here it is simply recomputed and redrawn.

   Entry point: fquick_simpleconn(mountId). Loaded on demand by layout_body.

   The LIVE twin of quick_simpleconn_test.js. Identical but for the three URLs
   below: this one pins a version, the test one recomputes it every load. A
   visitor should sit on a known build; whoever is changing it should never be
   able to look at a stale one. Promote by copying the test file over this one
   and putting the pinned ?v= back - see design/SYNC.md. */
(function () {
  'use strict';

  var BASE  = 'https://macrobim.github.io/macroBIM/';
  var DESIGN = 'https://macrobim.github.io/design/';
  /* ui=quick strips Load Excel, Example and the .xlsx drop. Under a form all
     three would leave the inputs above describing something the model below is
     not, with nothing on screen admitting it. */
  var FRAME = BASE + 'plate3d/embed.html?v=91&ui=quick';
  var MODEL = BASE + 'plate3d/column_model.js?v=91';
  /* Export patches the shipped workbook rather than building one. Everything
     that makes that sheet a sheet - the dropdowns, the two defined names the
     Section list depends on, seven conditional formats, the catalogue tabs,
     every width and merge - is already in it. Rebuilding all of that in a
     browser would be a second definition of the same layout, and the first one
     to be edited would be the one nobody noticed. */
  var TEMPLATE = BASE + 'plate3d/PLATE3D_COLUMN.xlsx?v=91';
  var EXCELJS  = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js';
  var USER  = 'user define';

  /* ---------------- style ---------------- */
  var CSS_ID = 'qsc-style';
  var CSS = [
    '#qsc-wrap{display:flex;flex-direction:column;gap:12px}',
    '#qsc-form{border:1px solid #e3e6ea;border-radius:8px;background:#fff;overflow:visible}',
    '#qsc-bar{display:flex;gap:8px;align-items:center;padding:10px 12px;',
      'border-bottom:1px solid #eef0f3;background:#f8fafc;border-radius:8px 8px 0 0}',
    '#qsc-bar .sp{flex:1}',
    '.qsc-btn{font:600 12px/1 Arial,sans-serif;padding:8px 12px;border-radius:6px;cursor:pointer;',
      'border:1px solid #cbd5e1;background:#fff;color:#0f172a}',
    '.qsc-btn:hover{background:#f1f5f9}',
    '.qsc-btn.primary{background:#1d4ed8;border-color:#1d4ed8;color:#fff}',
    '.qsc-btn.primary:hover{background:#1e40af}',
    '.qsc-menu{position:relative;display:inline-block}',
    '.qsc-menu>.d{position:absolute;right:0;top:calc(100% + 4px);z-index:20;display:none;',
      'min-width:150px;background:#fff;border:1px solid #cbd5e1;border-radius:6px;',
      'box-shadow:0 6px 18px rgba(15,23,42,.12);padding:4px}',
    '.qsc-menu.open>.d{display:block}',
    '.qsc-menu>.d button{display:block;width:100%;text-align:left;border:0;background:none;',
      'font:500 12px/1 Arial,sans-serif;color:#0f172a;padding:9px 10px;border-radius:4px;cursor:pointer}',
    '.qsc-menu>.d button:hover{background:#f1f5f9}',
    '#qsc-body{padding:0 12px 12px}',
    /* a chapter: the dark bar, the column headings, the rows, a note, a check line */
    '.qsc-part{margin:22px 0 2px;display:flex;align-items:baseline;gap:12px;',
      'border-bottom:2px solid #0f172a;padding-bottom:6px}',
    '.qsc-part span{font:800 15px/1 Arial,sans-serif;color:#0f172a;letter-spacing:.06em}',
    '.qsc-part i{font:400 11px/1.4 Arial,sans-serif;color:#64748b;font-style:normal}',
    '.qsc-part:first-child{margin-top:8px}',
    '.qsc-guide{padding:10px 0 2px;max-width:640px;margin:0 auto}',
    '.qsc-svg{display:block}',
    '.qsc-ch{margin-top:14px}',
    '.qsc-ch>h3{margin:0;font:700 12px/1 Arial,sans-serif;color:#fff;background:#0f172a;',
      'padding:8px 10px;border-radius:5px 5px 0 0;display:flex;align-items:baseline;gap:10px}',
    '.qsc-ch>h3 em{font:400 10.5px/1.4 Arial,sans-serif;color:#cbd5e1;font-style:normal}',
    '.qsc-tbl{width:100%;border-collapse:collapse;table-layout:fixed}',
    '.qsc-tbl th{font:700 10px/1 Arial,sans-serif;color:#64748b;text-align:center;',
      'padding:7px 3px;white-space:nowrap}',
    '.qsc-tbl th.l,.qsc-tbl td.l{text-align:left}',
    '.qsc-tbl td{padding:2px 3px}',
    '.qsc-tbl td.rl{font:700 11px/1 Arial,sans-serif;color:#0f172a;padding-left:2px;white-space:nowrap}',
    '.qsc-tbl td.rl.off{color:#94a3b8}',
    '.qsc-tbl td.tag{font:700 10px/1 Arial,sans-serif;color:#64748b;text-align:right;padding-right:6px}',
    '.qsc-tbl input,.qsc-tbl select{width:100%;box-sizing:border-box;font:700 11px/1 Arial,sans-serif;',
      'color:#1d4ed8;background:#eff6ff;border:1px solid #cbd5e1;border-radius:4px;',
      'padding:5px 4px;text-align:center}',
    '.qsc-tbl input.l{text-align:left}',
    '.qsc-tbl input:focus,.qsc-tbl select:focus{outline:2px solid #93c5fd;outline-offset:-1px}',
    '.qsc-tbl .out{font:600 11px/1 Arial,sans-serif;color:#64748b;text-align:center;',
      'padding:6px 4px;background:#f8fafc;border:1px solid #eef0f3;border-radius:4px}',
    /* dimmed = this section cannot apply to the section you picked */
    '.qsc-dim input,.qsc-dim select{color:#b9c2ce;background:#f9fafb;border-color:#e5e7eb}',
    '.qsc-dim td.rl{color:#b9c2ce}',
    '.qsc-note{font:italic 10.5px/1.6 Arial,sans-serif;color:#64748b;padding:5px 2px 0}',
    '.qsc-tbl td.rnote{font:700 10px/1.5 Arial,sans-serif;color:#b45309;padding:3px 4px}',
    '.qsc-chk{font:600 10.5px/1.6 Arial,sans-serif;color:#b45309;padding:2px 2px 0;',
      'display:flex;flex-wrap:wrap;gap:4px 18px}',
    '.qsc-chk .k{color:#64748b;font-weight:400}',
    '#qsc-status{font:600 11px/1 Arial,sans-serif;color:#64748b}',
    '#qsc-status.bad{color:#b91c1c}',
    '#qsc-frame{width:100%;height:520px;min-height:420px;border:1px solid #e3e6ea;',
      'border-radius:8px;display:block;background:#15181c}'
  ].join('');

  function style() {
    if (document.getElementById(CSS_ID)) return;
    var s = document.createElement('style');
    s.id = CSS_ID; s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ---------------- loading what the module needs ---------------- */
  function loadScript(src) {
    return new Promise(function (ok, no) {
      var s = document.createElement('script');
      s.src = src; s.async = false;
      s.onload = ok;
      s.onerror = function () { no(new Error('could not load ' + src)); };
      document.head.appendChild(s);
    });
  }
  /* The same two CSVs the generator reads off disk, in the same shape: name,
     h, b, tw, tf, r, kg/m, led by "user define". A tube has no flange, so its
     wall goes in the tw and tf column alike - which is what lets one pair of
     lookups serve either list. */
  function csv(text) {
    var ln = text.replace(/^﻿/, '').split(/\r?\n/).filter(function (s) { return s.trim(); });
    var head = ln[0].split(',').map(function (s) { return s.trim(); });
    return ln.slice(1).map(function (l) {
      var f = l.split(','), o = {};
      head.forEach(function (h, i) { o[h] = (f[i] || '').trim(); });
      return o;
    });
  }
  function catalogues() {
    return Promise.all([
      fetch(DESIGN + 'hsection.csv').then(function (r) { return r.text(); }),
      fetch(DESIGN + 'squaretube.csv').then(function (r) { return r.text(); })
    ]).then(function (t) {
      var HS = [[USER, '', '', '', '', '', '']].concat(
        csv(t[0]).filter(function (r) { return r['KS규격여부'] === 'O'; })
          .map(function (r) {
            return ['H-' + r.H + 'x' + r.B + 'x' + r.t1 + 'x' + r.t2 + ' r' + r.r,
                    +r.H, +r.B, +r.t1, +r.t2, +r.r, +r['단위무게']];
          }));
      var TB = [[USER, '', '', '', '', '', '']].concat(
        csv(t[1]).map(function (r) {
          return ['R-' + r['호칭치수'] + ' r' + r.r,
                  +r.A, +r.B, +r.t, +r.t, +r.r, +r['단위무게']];
        }));
      return { HS: HS, TB: TB,
               findH: function (k) { return HS.filter(function (s) { return s[0] === k; })[0] || HS[1]; },
               findT: function (k) { return TB.filter(function (s) { return s[0] === k; })[0] || TB[1]; } };
    });
  }

  /* ---------------- little builders ---------------- */
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  };
  function el(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }
  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d || 0); }

  /* ---------------- the page ---------------- */
  function fquick_simpleconn(mountId) {
    var mount = document.getElementById(mountId);
    if (!mount || mount.firstElementChild) return;
    style();

    var wrap = el(
      '<div id="qsc-wrap">' +
      '  <div id="qsc-form">' +
      '    <div id="qsc-bar">' +
      '      <button class="qsc-btn primary" id="qsc-update" type="button">Update model</button>' +
      '      <span id="qsc-status">loading…</span>' +
      '      <span class="sp"></span>' +
      '      <button class="qsc-btn" id="qsc-import" type="button">Import .xlsx</button>' +
      '      <button class="qsc-btn" id="qsc-export" type="button">Export .xlsx</button>' +
      '      <span class="qsc-menu" id="qsc-savemenu">' +
      '        <button class="qsc-btn" id="qsc-save" type="button">Save &#9662;</button>' +
      '        <span class="d">' +
      '          <button type="button" data-cmd="exportDXF">Save DXF&hellip;</button>' +
      '          <button type="button" data-cmd="exportBOQ">Save BOQ</button>' +
      '          <button type="button" data-cmd="exportSTL">Save STL</button>' +
      '          <button type="button" data-cmd="exportIFC">Save IFC</button>' +
      '        </span>' +
      '      </span>' +
      '    </div>' +
      '    <div id="qsc-body"></div>' +
      '  </div>' +
      '</div>');

    var fr = document.createElement('iframe');
    fr.id = 'qsc-frame'; fr.src = FRAME;
    fr.title = 'PLATE3D — Simple connector'; fr.allow = 'fullscreen';
    wrap.appendChild(fr);
    mount.appendChild(wrap);

    var status = wrap.querySelector('#qsc-status');
    var say = function (t, bad) { status.textContent = t; status.className = bad ? 'bad' : ''; };

    /* The view is sized by the frame's own request and by nothing else.

       It used to take whatever the viewport had left after the form - which
       was right when the frame was the only thing on the page, and wrong the
       moment a six-chapter form sat above it: the model shrank every time the
       form grew, so adding a row of inputs quietly cost you the drawing. The
       size of the thing you are looking at should not depend on the length of
       the thing you are typing into.

       What the embed asks for is its toolbar plus a 16:9 view of its own
       width, so it follows the window's WIDTH and holds still otherwise. */
    var want = 0;
    function sizeFrame() {
      fr.style.height = Math.max(460, want || 560) + 'px';
    }
    window.addEventListener('resize', sizeFrame);
    window.addEventListener('message', function (e) {
      var d = e && e.data;
      if (!d || e.source !== fr.contentWindow) return;      // only our own frame
      if (d.plate3d === 'height' && d.h > 0) { want = d.h; sizeFrame(); return; }
      if (d.plate3d === 'built') {
        say(d.errors ? (d.placed + ' placed · ' + d.errors + ' error' + (d.errors > 1 ? 's' : ''))
                     : (d.placed + ' placed'), !!d.errors);
        return;
      }
      if (d.plate3d === 'cmdFailed') say('could not ' + d.do + ': ' + d.why, true);
    });
    sizeFrame();

    var menu = wrap.querySelector('#qsc-savemenu');
    wrap.querySelector('#qsc-save').addEventListener('click', function (ev) {
      ev.stopPropagation(); menu.classList.toggle('open');
    });
    Array.prototype.forEach.call(menu.querySelectorAll('.d button'), function (b) {
      b.addEventListener('click', function () {
        menu.classList.remove('open');
        fr.contentWindow.postMessage({ plate3d: 'cmd', do: b.getAttribute('data-cmd') }, '*');
      });
    });
    document.addEventListener('click', function () { menu.classList.remove('open'); });
    fr.addEventListener('mouseenter', function () { menu.classList.remove('open'); });

    say('loading the section tables…');
    Promise.all([loadScript(MODEL), catalogues()])
      .then(function (r) { start(wrap, fr, say, window.columnModel, r[1]); })
      .catch(function (e) { say(e.message, true); });
  }

  /* ---------------- the form, once the module and tables are in ------------- */
  function start(wrap, fr, say, CM, cat) {
    var body = wrap.querySelector('#qsc-body');
    var V = CM.defaults({}, cat);          // the same defaults the workbook opens with
    var D = CM.derive(V, cat).D;

    /* Rows are described, not written out by hand, so a chapter reads as its
       shape rather than as markup. Each field says where it lives on V. */
    function field(get, set, opt) {
      return { get: get, set: set, opt: opt || {} };
    }
    var CHAPTERS = [];

    /* ---- 1. SECTION ---- */
    CHAPTERS.push({
      n: 1, t: 'SECTION', part: 'COLUMN',
      note: 'Type decides which list the Section cell offers — H sections, or square tubes. Alpha turns the whole column, plates and bolts with it.',
      cols: ['', 'Type', 'Section', 'h', 'b', 'tw / t', 'tf', 'r', 'Alpha', 'kg/m'],
      rows: function () {
        var list = V.type === 'H' ? cat.HS : cat.TB;
        var ud = V.sec === USER;
        var udCell = function (i, shown) {
          if (!ud) return { out: shown };
          return { v: V.udef ? V.udef[i] : shown,
                   on: function (x) {
                     if (!V.udef) V.udef = [D.h, D.b, D.tw, D.tf, D.r];
                     V.udef[i] = num(x, 0);
                     redraw(true);
                   } };
        };
        return [{
          label: 'Column',
          cells: [
            { sel: ['H', 'R'], v: V.type, on: function (x) {
                V.type = x;
                /* The two lists do not overlap, so a Type change needs a new
                   Section. Ask the module which one it opens that type with,
                   rather than grabbing the list's first entry - that is
                   R-20x20x1.2, a section nobody frames a building from. */
                V.sec = CM.defaults({ CTYPE: x }, cat).sec;
                V.udef = null;
                redraw(true);
              } },
            { sel: list.map(function (s) { return s[0]; }), v: V.sec, wide: true,
              on: function (x) {
                V.sec = x;
                // a named section owns its dimensions; user-define ones would
                // otherwise sit behind it and win the next time it was picked
                V.udef = (x === USER) ? [D.h, D.b, D.tw, D.tf, D.r] : null;
                redraw(true);
              } },
            /* the five dimensions come from the catalogue, and go editable only
               on "user define" — the same behaviour as the sheet, where picking
               it blanks the cells for you to type over */
            /* On "user define" the five dimensions become yours to type, and
               the module reads them off V.udef — the same array its UDEF=
               override fills. Off it, they are the catalogue's and read-only. */
            udCell(0, D.h), udCell(1, D.b), udCell(2, D.tw),
            udCell(3, D.tf), udCell(4, D.r),
            { sel: ['0', '90', '-90'], v: String(V.alpha),
              on: function (x) { V.alpha = num(x, 0); redraw(true); } },
            { out: D.kg }
          ]
        }, {
          /* the three pieces read as the sheet writes them - the word, then
             its length - rather than under the section's own headings, which
             this row has nothing to do with */
          label: 'Length',
          cells: [
            { skip: true }, { skip: true },
            { tag: 'upper' },
            { v: V.up,  on: function (x) { V.up  = num(x); redraw(true); } },
            { tag: 'middle' },
            { v: V.mid, on: function (x) { V.mid = num(x); redraw(true); } },
            { tag: 'lower' },
            { v: V.dn,  on: function (x) { V.dn  = num(x); redraw(true); } }
          ],
          note: 'put 0 in upper or lower if you do not want that piece — its splice goes with it'
        }, {
          label: 'Steel',
          cells: [{ v: V.steel, text: true, on: function (x) { V.steel = x; redraw(true); } }]
        }];
      },
      chk: function () {
        return [['splices', ((V.up > 0 ? 1 : 0) + (V.dn > 0 ? 1 : 0)) + ' of 2'],
                ['flanges face', V.type === 'H' ? (V.alpha % 180 === 0 ? 'X' : 'Y') : 'all four alike']];
      }
    });

    /* ---- 2. COLUMN STIFFENER ---- */
    CHAPTERS.push({
      n: 2, t: 'COLUMN STIFFENER', part: 'COLUMN',
      hint: 'horizontal plates inside an H — a tube cannot take one, nothing reaches inside the wall',
      note: 'Offset is signed from the column’s centre, where the beams sit. Width and depth stand the fillet clear of the web and both flanges. Thick 0 = off.',
      dim: function () { return V.type !== 'H'; },
      cols: ['', '', 'for', 'offset', 'width', 'depth', 'thick', 'clearance'],
      rows: function () {
        return V.stf.map(function (s, i) {
          return { label: String(i + 1), off: !(V.type === 'H' && s.th > 0), cells: [
            { skip: true },
            { v: s.t, text: true, left: true, on: function (x) { s.t = x; redraw(); } },
            { v: s.off, on: function (x) { s.off = num(x); redraw(true); } },
            { v: s.w,   on: function (x) { s.w   = num(x); redraw(true); } },
            { v: s.d,   on: function (x) { s.d   = num(x); redraw(true); } },
            { v: s.th,  on: function (x) { s.th  = num(x); redraw(true); } },
            /* one a level: the levels can carry different beams, so they can
               want different room */
            { v: s.clr, on: function (x) { s.clr = num(x); redraw(true); } }
          ] };
        });
      },
      chk: function () {
        var live = V.type === 'H' ? V.stf.filter(function (s) { return s.th > 0; }).length : 0;
        var wmax = Math.max.apply(null, V.stf.map(function (s) { return s.w; }));
        var dmax = Math.max.apply(null, V.stf.map(function (s) { return s.d; }));
        /* Depth may use the whole clear span - it lands on the flanges. Width
           has to stop short of the fillet. */
        var fits = V.type !== 'H' ? 'n/a'
                 : wmax > (D.b - D.tw) / 2 - 2 * D.r ? 'too wide'
                 : dmax > D.h - 2 * D.tf ? 'too deep' : 'ok';
        return [['plates', live * 2 + ' of ' + V.stf.length * 2], ['fits', fits],
                /* Every height a stiffener would have to stand at to meet a
                   beam flange, listed once each. It used to print one figure
                   four times over - the beams could only be at one level, so
                   there was only ever one answer. Now that each beam carries
                   its own, this is the list to copy offsets from. */
                ['beam flanges at', (function () {
                   var s = cat.findH(V.bmSec), half = (s[1] - s[4]) / 2, seen = {};
                   V.bmL.forEach(function (L, i) {
                     if (!(L > 0)) return;
                     seen[Math.round((V.bmZ[i] + half) * 10) / 10] = 1;
                     seen[Math.round((V.bmZ[i] - half) * 10) / 10] = 1;
                   });
                   var all = Object.keys(seen).map(Number).sort(function (x, y) { return y - x; });
                   return all.length ? all.join(' / ') : '—';
                 })()]];
      }
    });

    /* ---- 3. SPLICE PLATES ---- */
    CHAPTERS.push({
      n: 3, t: 'COLUMN SPLICE PLATES', part: 'COLUMN', guide: function () { return svgSplice(); },
      hint: 'cover plates on an H, an end plate on a tube — Type keeps whichever the section calls for',
      note: 'Set the upper or lower column length to 0 in chapter 1 and that splice goes away. The end plate follows the section, plus its overhang all round.',
      cols: ['', '', '', 'Width', 'Length', 'Thick', 'over'],
      rows: function () {
        var Hs = V.type === 'H';
        return [
          { label: 'Flange plate', off: !Hs, dim: !Hs, cells: [
            { skip: true }, { skip: true },
            { v: V.foW, on: function (x) { V.foW = num(x); redraw(true); } },
            { v: V.cpL, on: function (x) { V.cpL = num(x); redraw(true); } },
            { v: V.foT, on: function (x) { V.foT = num(x); redraw(true); } },
            { skip: true } ] },
          { label: 'Flange inner plate', off: !Hs, dim: !Hs, cells: [
            { skip: true }, { skip: true },
            { v: V.fiW, on: function (x) { V.fiW = num(x); redraw(true); } },
            { out: V.cpL },
            { v: V.fiT, on: function (x) { V.fiT = num(x); redraw(true); } },
            { skip: true } ] },
          { label: 'Web plate', off: !Hs, dim: !Hs, cells: [
            { skip: true }, { skip: true },
            { v: V.wpW, on: function (x) { V.wpW = num(x); redraw(true); } },
            { out: V.cpL },
            { v: V.wpT, on: function (x) { V.wpT = num(x); redraw(true); } },
            { skip: true } ] },
          { label: 'End plate', off: Hs, dim: Hs, cells: [
            { skip: true }, { skip: true }, { out: D.epB }, { out: D.epH },
            { v: V.epT, on: function (x) { V.epT = num(x); redraw(true); } },
            { v: V.epOV, on: function (x) { V.epOV = num(x); redraw(true); } } ] }
        ];
      },
      chk: function () {
        var Hs = V.type === 'H';
        var kg = Hs ? (V.foW * V.cpL * V.foT * 2 + V.fiW * V.cpL * V.fiT * 4
                     + V.wpW * V.cpL * V.wpT * 2) * 7.85e-6
                    : D.epB * D.epH * V.epT * 2 * 7.85e-6;
        return [['in use', Hs ? 'cover plates' : 'end plate'],
                /* An H splice bears - the ends meet and there is nothing to
                   say about a gap. A tube's two end plates really are in
                   there, so its pieces really are 2t apart. */
                ['joint', Hs ? 'bearing — the ends meet'
                             : 'two end plates, ' + 2 * V.epT + ' thick'],
                ['plate steel, kg', Math.round(kg * 10) / 10],
                /* The inner plate is judged against the FILLET: it sits on
                   its own bolt lines under the flange, and what it can run
                   into is the corner where the web meets it. */
                ['plates fit', !Hs ? 'n/a'
                  : (V.foW > D.b ? 'flange plate too wide'
                  : V.wpW > D.h - 2 * D.tf - 2 * D.r ? 'web plate too deep'
                  : V.fiW / 2 > D.fiY - (D.tw / 2 + D.r) ? 'inner plate hits the fillet'
                  : 'ok')]];
      }
    });

    /* ---- 4. BOLTS ---- */
    CHAPTERS.push({
      n: 4, t: 'BOLTS', part: 'COLUMN',
      hint: 'the shank and the hole are different sizes, and each grip gets its own length',
      note: 'Flange and Web: Long is along the column, Trans across it. End plate: how many bolts down each side of the plate, and Out from its edge.',
      cols: ['', '', '', 'dia', 'hole', 'grade', 'flange L', 'web L', 'end L'],
      rows: function () {
        var Hs = V.type === 'H';
        return [
          { label: 'Bolt', cells: [
            { skip: true }, { skip: true },
            { v: V.dia, on: function (x) { V.dia = num(x); redraw(true); } },
            { out: D.hole },
            { v: V.grade, text: true, on: function (x) { V.grade = x; redraw(true); } },
            { out: Hs ? D.lenF : '—' }, { out: Hs ? D.lenW : '—' }, { out: Hs ? '—' : D.lenE } ] },
          { head: ['', '', '', 'Long N', 'In', 'Out', 'Trans N', 'In', 'Out'] },
          { label: 'Flange', off: !Hs, dim: !Hs, cells: [
            { skip: true }, { skip: true },
            { v: V.fNL, on: function (x) { V.fNL = num(x); redraw(true); } },
            { v: V.fIL, on: function (x) { V.fIL = num(x); redraw(true); } },
            { v: V.fOL, on: function (x) { V.fOL = num(x); redraw(true); } },
            { v: V.fNT, on: function (x) { V.fNT = num(x); redraw(true); } },
            { v: V.fIT, on: function (x) { V.fIT = num(x); redraw(true); } },
            { v: V.fOT, on: function (x) { V.fOT = num(x); redraw(true); } } ] },
          { label: 'Web', off: !Hs, dim: !Hs, cells: [
            { skip: true }, { skip: true },
            { v: V.wNL, on: function (x) { V.wNL = num(x); redraw(true); } },
            { v: V.wIL, on: function (x) { V.wIL = num(x); redraw(true); } },
            { v: V.wOL, on: function (x) { V.wOL = num(x); redraw(true); } },
            { v: V.wNT, on: function (x) { V.wNT = num(x); redraw(true); } },
            { v: V.wIT, on: function (x) { V.wIT = num(x); redraw(true); } },
            { v: V.wOT, on: function (x) { V.wOT = num(x); redraw(true); } } ] },
          { head: ['', '', '', 'Width N', 'Out', '', 'Length N', 'Out'] },
          { label: 'End plate', off: V.type === 'H', dim: V.type === 'H', cells: [
            { skip: true }, { skip: true },
            { v: V.eNX, on: function (x) { V.eNX = num(x); redraw(true); } },
            { v: V.eOX, on: function (x) { V.eOX = num(x); redraw(true); } },
            { skip: true },
            { v: V.eNY, on: function (x) { V.eNY = num(x); redraw(true); } },
            { v: V.eOY, on: function (x) { V.eOY = num(x); redraw(true); } } ] }
        ];
      },
      chk: function () {
        var Hs = V.type === 'H';
        return Hs
          ? [['flange pitch', Math.round(D.pFL) + ' / ' + Math.round(D.pFT)],
             ['web pitch', Math.round(D.pWL) + ' / ' + Math.round(D.pWT)],
             ['bolts', (V.fNL * V.fNT + V.wNL * V.wNT) * 2 + ' per splice']]
          : [['bolt ring', D.nE + ' bolts'],
             ['pitch', Math.round(D.pEX) + ' / ' + Math.round(D.pEY)]];
      }
    });

    /* ---- 5. CONNECTION ---- */
    CHAPTERS.push({
      n: 5, t: 'CONNECTION', part: 'BEAM',
      hint: 'declare them here, then name one against each beam below',
      note: 'The mark is just a mark — Type says what it is. End plate gauge is across the beam web, fin plate gauge out from the column face.',
      cols: ['', 'Type', 'what it is', 'setback', 'width', 'height', 'thick', 'gauge', 'edge', 'pitch', 'count'],
      rows: function () {
        return V.conn.map(function (c) {
          return { label: c.m, off: !c.t, cells: [
            { sel: ['', 'end plate', 'fin plate'], v: c.t, on: function (x) { c.t = x; redraw(true); } },
            { v: c.d, text: true, left: true, on: function (x) { c.d = x; redraw(); } },
            { v: c.sb, on: function (x) { c.sb = num(x); redraw(true); } },
            { v: c.w,  on: function (x) { c.w  = num(x); redraw(true); } },
            { out: c.p * (c.n - 1) + 2 * c.e || 0 },
            { v: c.th, on: function (x) { c.th = num(x); redraw(true); } },
            { v: c.g,  on: function (x) { c.g  = num(x); redraw(true); } },
            { v: c.e,  on: function (x) { c.e  = num(x); redraw(true); } },
            { v: c.p,  on: function (x) { c.p  = num(x); redraw(true); } },
            { v: c.n,  on: function (x) { c.n  = num(x); redraw(true); } }
          ] };
        });
      },
      chk: function () {
        var marks = V.conn.map(function (c) { return c.m; });
        var found = V.bmC.every(function (m) { return marks.indexOf(m) >= 0; });
        var eps = V.conn.filter(function (c) { return c.t === 'end plate'; })
                        .map(function (c) { return c.w; }).concat([0]);
        var widest = Math.max.apply(null, eps);
        return [['marks', found ? 'all 4 beams found theirs'
                                : 'a beam names a mark that is not in the list'],
                ['widest end plate', V.type !== 'H' ? 'n/a'
                  : widest <= D.h - 2 * D.tf - 2 * D.r ? 'fits between the flanges'
                  : 'hits the flanges on a web face']];
      }
    });

    /* ---- 6. BEAMS ---- */
    CHAPTERS.push({
      n: 6, t: 'BEAMS', part: 'BEAM',
      hint: 'four world directions - X+ X- Y+ Y-. Length 0 and that beam is not there',
      note: 'Beams are H only: a tube has no web to bolt through. The direction is the world’s, so Alpha decides whether a beam lands on a flange or on the web. Level is how high the beam sits, signed from the column’s centre — the same datum chapter 2 uses. The stiffeners do not follow it.',
      cols: ['', 'Detail', 'Section', 'h', 'b', 'tw', 'tf', 'r', 'Length', 'level', 'kg/m'],
      rows: function () {
        var DIRS = ['X+', 'X-', 'Y+', 'Y-'];
        var b = cat.findH(V.bmSec);
        return DIRS.map(function (d, i) {
          return { label: d, off: !(V.bmL[i] > 0), cells: [
            { sel: V.conn.map(function (c) { return c.m; }), v: V.bmC[i],
              on: function (x) { V.bmC[i] = x; redraw(true); } },
            { sel: cat.HS.map(function (s) { return s[0]; }), v: V.bmSec, wide: true,
              on: function (x) { V.bmSec = x; redraw(true); } },
            { out: b[1] }, { out: b[2] }, { out: b[3] }, { out: b[4] }, { out: b[5] },
            { v: V.bmL[i], on: function (x) { V.bmL[i] = num(x); redraw(true); } },
            { v: V.bmZ[i], on: function (x) { V.bmZ[i] = num(x); redraw(true); } },
            { out: b[6] }
          ] };
        });
      },
      chk: function () {
        var sq = V.alpha % 180 === 0;
        return [['X faces', V.type !== 'H' ? 'tube wall' : (sq ? 'flange' : 'web')],
                ['Y faces', V.type !== 'H' ? 'tube wall' : (sq ? 'web' : 'flange')],
                ['beams', V.bmL.filter(function (x) { return x > 0; }).length + ' of 4']];
      }
    });


    /* ---------------- the splice guide ----------------
       The splice block is the one place where the words alone do not carry
       it: Long and Trans, In and Out, and a gap that is measured from the
       joint rather than from an edge. Reading four numbers and picturing where
       the bolts land is exactly the work a drawing should be doing.

       So it draws the sheet's own numbers rather than a stock illustration -
       the bolt count you typed, in the pattern you typed it. Set Long N to 6
       and six rows appear. A picture that cannot be wrong about the input is
       worth more than a prettier one that is fixed. */
    function svgSplice() {
      var Hs = V.type === 'H';
      /* The viewBox. 232 is the H drawing: a 300x150 plate at PAD, and the
         last dimension 34 under it. The end plate is SQUARE and as wide as it
         is tall, so it needs more room below - the tube branch works its own
         height out from the plate it just drew rather than sharing a number
         that only ever fitted the other drawing. */
      var W = 560, HT = 232, PAD = 46;          // viewBox, and room for dimensions
      var g = [];
      var line = function (x1, y1, x2, y2, o) {
        g.push('<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 +
               '" stroke="' + ((o && o.c) || '#94a3b8') + '" stroke-width="' + ((o && o.w) || 1) +
               '"' + ((o && o.d) ? ' stroke-dasharray="' + o.d + '"' : '') + '/>');
      };
      var txt = function (x, y, t, o) {
        g.push('<text x="' + x + '" y="' + y + '" font-family="Arial" font-size="' +
               ((o && o.s) || 9) + '" fill="' + ((o && o.c) || '#64748b') +
               '" text-anchor="' + ((o && o.a) || 'middle') + '">' + esc(t) + '</text>');
      };
      var bolt = function (x, y) {
        g.push('<circle cx="' + x + '" cy="' + y + '" r="3.1" fill="none" stroke="#b45309" stroke-width="1.3"/>');
      };
      // a dimension: a line with ticks and a number sitting on it
      var dimH = function (x1, x2, y, t) {
        line(x1, y, x2, y, { c: '#cbd5e1' });
        line(x1, y - 3, x1, y + 3, { c: '#cbd5e1' });
        line(x2, y - 3, x2, y + 3, { c: '#cbd5e1' });
        txt((x1 + x2) / 2, y - 4, t);
      };
      var dimV = function (y1, y2, x, t) {
        line(x, y1, x, y2, { c: '#cbd5e1' });
        line(x - 3, y1, x + 3, y1, { c: '#cbd5e1' });
        line(x - 3, y2, x + 3, y2, { c: '#cbd5e1' });
        g.push('<text x="' + (x - 4) + '" y="' + ((y1 + y2) / 2 + 3) +
               '" font-family="Arial" font-size="9" fill="#64748b" text-anchor="end">' + esc(t) + '</text>');
      };

      if (Hs) {
        /* Looking at a flange, the column running up the page. The plate spans
           the joint; the bolts sit in four groups, half above and half below,
           half each side of the web. */
        var pw = 300, ph = 150;                       // the plate, on screen
        var x0 = (W - pw) / 2, y0 = PAD, x1 = x0 + pw, y1 = y0 + ph;
        var yc = (y0 + y1) / 2, xc = (x0 + x1) / 2;
        /* The two column pieces, drawn first so the plate lies over them, and
           the same width as the plate - the flange IS the plate's width here,
           and drawing it narrower read as the plate being wider than the
           steel it covers. They run past the plate top and bottom, which is
           the whole point: the column continues, the plate does not. */
        var over = 30;
        g.push('<rect x="' + x0 + '" y="' + (y0 - over) + '" width="' + pw +
               '" height="' + (ph / 2 + over) + '" fill="#eef2f7" stroke="#cbd5e1"/>');
        g.push('<rect x="' + x0 + '" y="' + yc + '" width="' + pw +
               '" height="' + (ph / 2 + over) + '" fill="#eef2f7" stroke="#cbd5e1"/>');
        // the cover plate
        g.push('<rect x="' + x0 + '" y="' + y0 + '" width="' + pw + '" height="' + ph +
               '" fill="rgba(29,78,216,.07)" stroke="#1d4ed8" stroke-width="1.3"/>');
        // the bolts: N/2 each side on both axes, at the pitches the sheet works out
        var nL = Math.max(2, V.fNL), nT = Math.max(2, V.fNT);
        var sx = (pw / V.foW), sy = (ph / V.cpL);      // mm -> screen
        var px = D.pFT * sx, py = D.pFL * sy;
        for (var i = 0; i < nT / 2; i++) {
          for (var j = 0; j < nL / 2; j++) {
            var dx = V.fIT / 2 * sx + i * px, dy = V.fIL / 2 * sy + j * py;
            bolt(xc - dx, yc - dy); bolt(xc + dx, yc - dy);
            bolt(xc - dx, yc + dy); bolt(xc + dx, yc + dy);
          }
        }
        // the joint: the two pieces meet on this line and there is no gap
        line(x0, yc, x1, yc, { c: '#b45309', d: '3 3' });
        dimH(x0, x1, y0 - 12, 'Width ' + V.foW);
        dimV(y0, y1, x0 - 14, 'Length ' + V.cpL);
        dimV(yc - V.fIL / 2 * sy, yc + V.fIL / 2 * sy, x1 + 40, 'In ' + V.fIL);
        dimV(y0, y0 + V.fOL * sy, x1 + 40, 'Out ' + V.fOL);
        dimH(xc - V.fIT / 2 * sx, xc + V.fIT / 2 * sx, y1 + 18, 'In ' + V.fIT);
        dimH(x0, x0 + V.fOT * sx, y1 + 34, 'Out ' + V.fOT);
        txt(x1 + 40, y1 + 34, 'Long ' + V.fNL + ' × Trans ' + V.fNT, { c: '#b45309', s: 10 });
      } else {
        /* A tube takes an end plate on each piece, bolted face to face outside
           the wall — so the bolts run round the plate, clear of the section. */
        var s2 = 150, o2 = 34;                      // the wall, and its overhang
        var ax = (W - s2 - 2 * o2) / 2, ay = PAD;
        var bx = ax + s2 + 2 * o2, by = ay + s2 + 2 * o2;
        HT = by + 40;                  // the plate, its Out dimension, and the count
        g.push('<rect x="' + ax + '" y="' + ay + '" width="' + (s2 + 2 * o2) +
               '" height="' + (s2 + 2 * o2) +
               '" fill="rgba(29,78,216,.07)" stroke="#1d4ed8" stroke-width="1.3"/>');
        g.push('<rect x="' + (ax + o2) + '" y="' + (ay + o2) + '" width="' + s2 +
               '" height="' + s2 + '" fill="#eef2f7" stroke="#cbd5e1"/>');
        /* The bolt lines sit Out from each edge, on the overhang the tube
           leaves clear. Corners belong to both runs, so the Y sides skip them
           - which is exactly why the count is 2·NX + 2·(NY−2) and not 2·NX+2·NY. */
        var nX = Math.max(2, V.eNX), nY = Math.max(2, V.eNY);
        var mm = (s2 + 2 * o2) / Math.max(1, D.epB);    // mm -> screen
        var rx0 = ax + V.eOX * mm, rx1 = bx - V.eOX * mm;
        var ry0 = ay + V.eOY * mm, ry1 = by - V.eOY * mm;
        for (var a = 0; a < nX; a++) {
          var t2 = nX === 1 ? 0.5 : a / (nX - 1);
          bolt(rx0 + t2 * (rx1 - rx0), ry0);
          bolt(rx0 + t2 * (rx1 - rx0), ry1);
        }
        for (var c2 = 1; c2 < nY - 1; c2++) {
          var t3 = c2 / (nY - 1);
          bolt(rx0, ry0 + t3 * (ry1 - ry0));
          bolt(rx1, ry0 + t3 * (ry1 - ry0));
        }
        dimH(ax, bx, ay - 12, 'plate ' + Math.round(D.epB) + ' (section + ' + V.epOV + ' all round)');
        dimH(ax, rx0, by + 18, 'Out ' + V.eOX);
        dimV(ay, ry0, ax - 14, 'Out ' + V.eOY);
        txt(W / 2, by + 34, V.eNX + ' down each X side, ' + V.eNY + ' each Y  —  ' + D.nE + ' bolts',
            { c: '#b45309', s: 10 });
      }
      return '<svg class="qsc-svg" viewBox="0 0 ' + W + ' ' + HT + '" width="100%" ' +
             'preserveAspectRatio="xMidYMid meet">' + g.join('') + '</svg>';
    }

    /* ---------------- drawing ---------------- */
    function cell(c) {
      if (c.skip) return '<td></td>';
      if (c.tag !== undefined) return '<td class="tag">' + esc(c.tag) + '</td>';
      if (c.out !== undefined) return '<td><div class="out">' + esc(c.out) + '</div></td>';
      if (c.sel) {
        return '<td><select>' + c.sel.map(function (o) {
          return '<option' + (o === c.v ? ' selected' : '') + '>' + esc(o) + '</option>';
        }).join('') + '</select></td>';
      }
      return '<td><input' + (c.left ? ' class="l"' : '') +
             ' value="' + esc(c.v) + '"></td>';
    }

    function drawChapter(ch) {
      var wide = ch.cols.length;
      var h = '<div class="qsc-ch' + (ch.dim && ch.dim() ? ' qsc-dim' : '') +
              '" data-ch="' + ch.n + '">' +
              '<h3>' + ch.n + '. ' + esc(ch.t) +
              (ch.hint ? '<em>' + esc(ch.hint) + '</em>' : '') + '</h3>' +
              '<table class="qsc-tbl"><colgroup>' +
              '<col style="width:120px">' +
              ch.cols.slice(1).map(function (_, i) {
                return '<col' + (i === 1 ? ' style="width:150px"' : '') + '>';
              }).join('') + '</colgroup>' +
              '<tr>' + ch.cols.map(function (t, i) {
                return '<th' + (i === 0 ? ' class="l"' : '') + '>' + esc(t) + '</th>';
              }).join('') + '</tr>';
      /* Every row is padded out to the heading width, and a row that overruns
         it is shouted about. Column drift is the failure that looks fine: a
         row one cell short slides every value after it under the wrong
         heading, and all of them are still plausible numbers. Making the
         renderer responsible for the width means a row can be written as
         short as it likes and still cannot lie. */
      function pad(cells, want) {
        var out = cells.slice();
        if (out.length > want) {
          console.error('[qsc] ' + ch.t + ': a row has ' + out.length +
                        ' cells for ' + want + ' columns');
          out.length = want;
        }
        while (out.length < want) out.push({ skip: true });
        return out;
      }
      ch.rows().forEach(function (r) {
        if (r.head) {
          h += '<tr>' + pad(r.head.map(function (t) { return { th: t }; }), wide)
                 .map(function (c, i) {
                   return '<th' + (i === 0 ? ' class="l"' : '') + '>' +
                          esc(c.th || '') + '</th>';
                 }).join('') + '</tr>';
          return;
        }
        h += '<tr' + (r.dim ? ' class="qsc-dim"' : '') + '>' +
             '<td class="rl' + (r.off ? ' off' : '') + '">' + esc(r.label) + '</td>' +
             pad(r.cells, wide - 1).map(cell).join('') + '</tr>';
        if (r.note) {
          /* Start the note under the row's first real cell, not at the left
             edge of the table. The Length row's values sit three columns in,
             and a note beginning under "Type" was describing boxes it did not
             appear to point at. One rule, so every row's note lands right. */
          var lead = 1;
          for (var q = 0; q < r.cells.length; q++) {
            if (!r.cells[q].skip) break;
            lead++;
          }
          h += '<tr><td colspan="' + lead + '"></td>' +
               '<td class="rnote" colspan="' + (wide - lead) + '">' +
               esc(r.note) + '</td></tr>';
        }
      });
      h += '</table>';
      if (ch.guide) h += '<div class="qsc-guide">' + ch.guide() + '</div>';
      if (ch.note) h += '<div class="qsc-note">' + esc(ch.note) + '</div>';
      if (ch.chk) {
        h += '<div class="qsc-chk">' + ch.chk().map(function (p) {
          return '<span><span class="k">' + esc(p[0]) + '</span> ' + esc(p[1]) + '</span>';
        }).join('') + '</div>';
      }
      return h + '</div>';
    }

    /* Redrawn wholesale on every edit. A column change can move any other cell
       on the page - a section swaps five dimensions, a Type swaps a whole
       chapter's meaning - so patching individual cells would be a second model
       of what depends on what, and the one that would go wrong. The form is
       small; redrawing it is cheaper than being clever. */
    var focusKey = null;
    function redraw(send) {
      D = CM.derive(V, cat).D;
      var scroll = body.scrollTop;
      /* The six chapters are two things, and the sheet never said so: four of
         them describe a column that stands whether or not anything hangs off
         it, and two describe what does. Banding them says which question you
         are answering before you read a single field. */
      var part = null;
      body.innerHTML = CHAPTERS.map(function (ch) {
        var lead = '';
        if (ch.part !== part) {
          part = ch.part;
          lead = '<div class="qsc-part"><span>' + esc(part) + '</span><i>' +
                 esc(part === 'COLUMN' ? 'the column itself — section, stiffener, splice, bolts'
                                       : 'what hangs off it — the connection library, then the beams') +
                 '</i></div>';
        }
        return lead + drawChapter(ch);
      }).join('');
      body.scrollTop = scroll;
      bind();
      if (focusKey) {
        var again = body.querySelector('[data-k="' + focusKey + '"]');
        if (again) { again.focus(); if (again.select) again.select(); }
      }
      if (send) push();
    }

    function bind() {
      var k = 0;
      /* Find each chapter by its own number, not by counting children. The
         part banners are children too, and an index that quietly meant
         "chapter" until something was inserted between them is the kind of
         coupling that breaks the moment the layout changes - which it just did. */
      CHAPTERS.forEach(function (ch, ci) {
        var host = body.querySelector('[data-ch="' + ch.n + '"]');
        var tbl = host && host.querySelector('table');
        if (!tbl) return;
        var ri = 0;
        ch.rows().forEach(function (r) {
          if (r.head) { ri++; return; }
          ri++;
          var tr = tbl.rows[ri];
          if (!tr) return;
          r.cells.forEach(function (c, i) {
            if (!c.on) return;
            var td = tr.cells[i + 1];
            var inp = td && td.firstElementChild;
            if (!inp) return;
            var key = 'c' + ci + 'r' + ri + 'i' + i;
            inp.setAttribute('data-k', key);
            inp.addEventListener('focus', function () { focusKey = key; });
            var ev = inp.tagName === 'SELECT' ? 'change' : 'change';
            inp.addEventListener(ev, function () { c.on(inp.value); });
          });
        });
      });
    }

    /* The whole point: V in, rows out, straight to the frame. No arithmetic
       happens here — build() is the same call the .xlsx generator makes. */
    function push() {
      /* The frame can be off the page before a timer gets here. Leaving the
         menu item empties the mount, and so does clicking Simple connector
         again to start over - and both of the calls below are on a timer,
         400 ms and 1200 ms. A frame that is no longer in the document has a
         null contentWindow and nothing left to receive rows: this instance
         is finished, and the page has built a new one to take its place. */
      if (!fr.isConnected || !fr.contentWindow) return;
      var rows;
      try {
        rows = CM.values(CM.build(V, cat).rows);
      } catch (e) {
        say(e.message, true);
        return;
      }
      fr.contentWindow.postMessage(
        { plate3d: 'rows', rows: rows, name: 'Simple connector' }, '*');
    }


    /* ---------------- Export / Import ----------------

       Export takes the shipped workbook and writes this form's values into it:
       the PARAM inputs through the shared map, and the input tab's cached
       results from the model. Both, because the sheet is live for a person and
       cached for the engine - Excel recalculates from the formulas when you
       open it, and PLATE3D reads the cache without opening anything. Writing
       only PARAM would hand back a file that draws the OLD model until Excel
       had touched it, which is the quiet kind of wrong.

       The formulas themselves are never written. Only their cached value is
       replaced, exactly as the generator does it. */
    var xlsxReady = null;
    function needExcelJS() {
      if (window.ExcelJS) return Promise.resolve();
      if (!xlsxReady) xlsxReady = loadScript(EXCELJS);
      return xlsxReady;
    }

    function download(blob, name) {
      var u = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = u; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
    }

    function doExport() {
      say('building the workbook…');
      Promise.all([needExcelJS(), fetch(TEMPLATE).then(function (r) {
        if (!r.ok) throw new Error('template ' + r.status);
        return r.arrayBuffer();
      })]).then(function (r) {
        var wb = new window.ExcelJS.Workbook();
        return wb.xlsx.load(r[1]).then(function () {
          var M = CM.build(V, cat);
          var ps = wb.getWorksheet('PARAM');
          CM.paramCells(V, M).forEach(function (c) {
            var v = c.get();
            if (v === null || v === undefined) return;   // a lookup cell, left alone
            ps.getCell(c.a).value = v;
          });
          /* the input tab: same formulas, refreshed cache */
          var is = wb.worksheets.filter(function (w) {
            return String(w.name || '').trim().toLowerCase() === 'input';
          })[0];
          M.rows.forEach(function (r2, i) {
            /* Column 1 is the comment margin. The parser ignores it, so the
               model was right without this - but a reader is not the parser,
               and the template's comment still named the connection the
               TEMPLATE used. An exported sheet that says C1 beside a beam
               bolted with C2 is the quiet kind of wrong. */
            is.getCell(i + 1, 1).value = r2.comment || null;
            r2.cells.forEach(function (cell, j) {
              if (!cell || typeof cell !== 'object') return;
              var t = is.getCell(i + 1, j + 2);
              if (t.value && t.value.formula !== undefined) {
                t.value = { formula: t.value.formula, result: cell.v };
              }
            });
          });
          return wb.xlsx.writeBuffer();
        });
      }).then(function (buf) {
        download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
                 'PLATE3D_COLUMN.xlsx');
        say('exported');
      }).catch(function (e) { say('export failed: ' + e.message, true); });
    }

    /* Import is the same map read the other way. Only the input cells are
       touched, so a sheet someone has restyled still comes in. */
    function doImport(file) {
      say('reading ' + file.name + '…');
      needExcelJS().then(function () {
        return file.arrayBuffer();
      }).then(function (buf) {
        var wb = new window.ExcelJS.Workbook();
        return wb.xlsx.load(buf).then(function () {
          var ps = wb.getWorksheet('PARAM');
          if (!ps) throw new Error('no PARAM sheet in that file');
          var M = CM.build(V, cat);
          var read = function (c) {
            var x = ps.getCell(c.a).value;
            if (x && typeof x === 'object') {
              if (x.result !== undefined) return x.result;
              if (x.text !== undefined) return x.text;
              if (x.richText) return x.richText.map(function (t) { return t.text; }).join('');
              return '';
            }
            return x;
          };
          /* Type and Section first and on their own: every other cell is read
             against the section they choose, and V.udef has to be set up before
             the five dimension cells are read into it. */
          var cells = CM.paramCells(V, M);
          cells.slice(0, 2).forEach(function (c) { c.set(read(c)); });
          V.udef = (V.sec === USER) ? (V.udef || [0, 0, 0, 0, 0]) : null;
          cells.slice(2).forEach(function (c) {
            var x = read(c);
            if (x !== null && x !== undefined) c.set(x);
          });
          redraw(true);
          say('imported ' + file.name);
        });
      }).catch(function (e) { say('import failed: ' + e.message, true); });
    }

    wrap.querySelector('#qsc-export').addEventListener('click', doExport);
    var picker = document.createElement('input');
    picker.type = 'file'; picker.accept = '.xlsx'; picker.style.display = 'none';
    wrap.appendChild(picker);
    picker.addEventListener('change', function () {
      if (picker.files.length) doImport(picker.files[0]);
      picker.value = '';                       // so the same file can be picked twice
    });
    wrap.querySelector('#qsc-import').addEventListener('click', function () { picker.click(); });

    wrap.querySelector('#qsc-update').addEventListener('click', function () { push(); });
    redraw(false);
    say('ready');
    // the frame needs to be up before it can be told anything
    fr.addEventListener('load', function () { setTimeout(push, 400); });
    setTimeout(push, 1200);
  }

  window.fquick_simpleconn = fquick_simpleconn;
})();
