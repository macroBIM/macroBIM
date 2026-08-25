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

   Entry point: fquick_simpleconn(mountId). Loaded on demand by layout_body. */
(function () {
  'use strict';

  var BASE  = 'https://macrobim.github.io/macroBIM/';
  var DESIGN = 'https://macrobim.github.io/design/';
  /* ui=quick strips Load Excel, Example and the .xlsx drop. Under a form all
     three would leave the inputs above describing something the model below is
     not, with nothing on screen admitting it. */
  var FRAME = BASE + 'plate3d/embed_test.html?v=' + Date.now() + '&ui=quick';
  var MODEL = BASE + 'plate3d/column_model.js?v=' + Date.now();
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

    /* the frame reports the height it wants; the room it can have is measured.
       The form sits above it, so `room` shrinks as the form grows and the
       frame gives way rather than pushing the page into a scroll. */
    var want = 0;
    function sizeFrame() {
      var top = fr.getBoundingClientRect().top;
      var room = Math.floor(window.innerHeight - top - 12);
      fr.style.height = Math.max(420, want ? Math.min(want, room) : room) + 'px';
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
      n: 1, t: 'SECTION',
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
      n: 2, t: 'COLUMN STIFFENER',
      hint: 'horizontal plates inside an H — a tube cannot take one, nothing reaches inside the wall',
      note: 'Offset is signed, from the middle column’s centre — where the beams sit. Width runs out from the web, depth between the flanges. Thick 0 = off.',
      dim: function () { return V.type !== 'H'; },
      cols: ['', '', 'for', 'offset', 'width', 'depth', 'thick'],
      rows: function () {
        return V.stf.map(function (s, i) {
          return { label: String(i + 1), off: !(V.type === 'H' && s.th > 0), cells: [
            { skip: true },
            { v: s.t, text: true, left: true, on: function (x) { s.t = x; redraw(); } },
            { v: s.off, on: function (x) { s.off = num(x); redraw(true); } },
            { v: s.w,   on: function (x) { s.w   = num(x); redraw(true); } },
            { v: s.d,   on: function (x) { s.d   = num(x); redraw(true); } },
            { v: s.th,  on: function (x) { s.th  = num(x); redraw(true); } }
          ] };
        });
      },
      chk: function () {
        var live = V.type === 'H' ? V.stf.filter(function (s) { return s.th > 0; }).length : 0;
        var wmax = Math.max.apply(null, V.stf.map(function (s) { return s.w; }));
        var dmax = Math.max.apply(null, V.stf.map(function (s) { return s.d; }));
        var fits = V.type !== 'H' ? 'n/a'
                 : wmax > (D.b - D.tw) / 2 ? 'too wide'
                 : dmax > D.h - 2 * D.tf ? 'too deep' : 'ok';
        return [['plates', live * 2 + ' of ' + V.stf.length * 2], ['fits', fits],
                ['beam flange at ±', V.bmC.map(function (_, i) {
                   var b = cat.findH(V.bmSec);
                   return Math.round((b[1] - b[4]) / 2 * 10) / 10;
                 }).join(' / ')]];
      }
    });

    /* ---- 3. SPLICE PLATES ---- */
    CHAPTERS.push({
      n: 3, t: 'SPLICE PLATES',
      hint: 'cover plates on an H, an end plate on a tube — Type keeps whichever the section calls for',
      note: 'Width is across the flange or through the web; Length runs along the column. The end plate follows the section, plus its overhang all round.',
      cols: ['', '', '', 'Width', 'Length', 'Thick', 'Qty', 'Material', 'gap / over'],
      rows: function () {
        var Hs = V.type === 'H';
        return [
          { label: 'Flange plate', off: !Hs, dim: !Hs, cells: [
            { skip: true }, { skip: true },
            { v: V.foW, on: function (x) { V.foW = num(x); redraw(true); } },
            { v: V.cpL, on: function (x) { V.cpL = num(x); redraw(true); } },
            { v: V.foT, on: function (x) { V.foT = num(x); redraw(true); } },
            { out: 2 }, { v: V.steel, text: true, on: function (x) { V.steel = x; redraw(true); } },
            { v: V.gap, on: function (x) { V.gap = num(x); redraw(true); } } ] },
          { label: 'Flange inner plate', off: !Hs, dim: !Hs, cells: [
            { skip: true }, { skip: true },
            { v: V.fiW, on: function (x) { V.fiW = num(x); redraw(true); } },
            { out: V.cpL },
            { v: V.fiT, on: function (x) { V.fiT = num(x); redraw(true); } },
            { out: 4 }, { skip: true }, { skip: true } ] },
          { label: 'Web plate', off: !Hs, dim: !Hs, cells: [
            { skip: true }, { skip: true },
            { v: V.wpW, on: function (x) { V.wpW = num(x); redraw(true); } },
            { out: V.cpL },
            { v: V.wpT, on: function (x) { V.wpT = num(x); redraw(true); } },
            { out: 2 }, { skip: true }, { skip: true } ] },
          { label: 'End plate', off: Hs, dim: Hs, cells: [
            { skip: true }, { skip: true }, { out: D.epB }, { out: D.epH },
            { v: V.epT, on: function (x) { V.epT = num(x); redraw(true); } },
            { out: 2 }, { skip: true },
            { v: V.epOV, on: function (x) { V.epOV = num(x); redraw(true); } } ] }
        ];
      },
      chk: function () {
        var Hs = V.type === 'H';
        var kg = Hs ? (V.foW * V.cpL * V.foT * 2 + V.fiW * V.cpL * V.fiT * 4
                     + V.wpW * V.cpL * V.wpT * 2) * 7.85e-6
                    : D.epB * D.epH * V.epT * 2 * 7.85e-6;
        return [['in use', Hs ? 'cover plates' : 'end plate'],
                ['plate steel, kg', Math.round(kg * 10) / 10],
                ['plates fit', !Hs ? 'n/a'
                  : (V.foW > D.b ? 'flange plate too wide'
                  : V.wpW > D.h - 2 * D.tf - 2 * D.r ? 'web plate too deep' : 'ok')]];
      }
    });

    /* ---- 4. BOLTS ---- */
    CHAPTERS.push({
      n: 4, t: 'BOLTS',
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
      n: 5, t: 'CONNECTION',
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
      n: 6, t: 'BEAMS',
      hint: 'four world directions - X+ X- Y+ Y-. Length 0 and that beam is not there',
      note: 'Beams are H only: a tube has no web to bolt through. The direction is the world’s, so Alpha decides whether a beam lands on a flange or on the web.',
      cols: ['', 'Detail', 'Section', 'h', 'b', 'tw', 'tf', 'r', 'Length', 'kg/m'],
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
      var h = '<div class="qsc-ch' + (ch.dim && ch.dim() ? ' qsc-dim' : '') + '">' +
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
          h += '<tr><td></td><td class="rnote" colspan="' + (wide - 1) + '">' +
               esc(r.note) + '</td></tr>';
        }
      });
      h += '</table>';
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
      body.innerHTML = CHAPTERS.map(drawChapter).join('');
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
      CHAPTERS.forEach(function (ch, ci) {
        var tbl = body.children[ci].querySelector('table');
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

    wrap.querySelector('#qsc-update').addEventListener('click', function () { push(); });
    redraw(false);
    say('ready');
    // the frame needs to be up before it can be told anything
    fr.addEventListener('load', function () { setTimeout(push, 400); });
    setTimeout(push, 1200);
  }

  window.fquick_simpleconn = fquick_simpleconn;
})();
