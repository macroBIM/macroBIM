/* QuickPlate3D — Crossbeam.

   판형교의 거더 사이. 가로보와 수직브레이싱, 그리고 그 위에 얹히는 슬래브와
   방호벽까지 — 한 장의 표준횡단면이 정하는 것들이다.

   입력 항목은 APlate 사용설명서를 따랐다. 스키마를 새로 짤 이유가 없다:

     §2.3.4  횡단 구성          → 1장 Girder layout
     §2.3.17 단면 타입 설정      → 2장 Girder types
     §2.4.13 수직보강재 상세     → 3장 Stiffener
     §2.4.2  스캘럽 상세         →   〃  (모재 t 16 을 경계로 두 벌)
     §2.4.10 가로보 상세         → 4장 Crossbeam types  (형강·제작·수직보강재연결)
     §2.4.11 수직브레이싱 상세   →   〃                  (V형·역V형)
     §2.3.13 가로보 위치         → 5장 Crossbeam layout
     §2.3.20 슬래브 제원         → 6장 Deck slab
     §2.3.21 방호벽 제원         → 7장 Barrier

   ── 매뉴얼과 일부러 다르게 한 것 ──────────────────────────────
   같은 값을 여러 번 적게 하지 않는다.

     · 간격을 하나만 적으면 등간격이다 (매뉴얼은 L1…Ln 을 다 받는다)
     · 편경사는 퍼센트 둘이면 된다 — 거더 높이차는 우리가 계산한다
     · 보강재 좌우는 「대칭」이면 네 칸이다 (매뉴얼은 LW/RW…LH/RH 여덟 칸)
     · 스캘럽은 두 벌 받아 두고, 어느 줄을 쓸지는 플랜지 두께를 보고 고른다

   ── 타입은 라이브러리다 ──────────────────────────────────────
   주형도 가로보도 「한 줄이 한 타입」이고, 거더와 칸이 이름으로 부른다.
   Simple connector 의 접합 라이브러리(C1~C6)와 같은 짜임이다. 다만 줄 수를
   묶지 않는다 — 폼은 HTML 이라 묶일 이유가 없고, 그게 FORMS.md 의 규칙이다.

   지금 이 파일이 하는 일은 「입력 → 그림」까지다. PLATE3D 로 모델을 보내는
   것과 워크북을 내보내는 것은 아직 없다. 없는 것을 있는 척하지 않는다.

   Entry point: fquick_crossbeam(mountId). Loaded on demand by layout_body. */
(function () {
  'use strict';

  /* ---------------- style ---------------- */
  var CSS_ID = 'qcb-style';
  var CSS = [
    '#qcb-wrap{display:flex;flex-direction:column;gap:12px}',
    '#qcb-form{border:1px solid #e3e6ea;border-radius:8px;background:#fff;overflow:visible}',
    '#qcb-bar{display:flex;gap:8px;align-items:center;padding:10px 12px;',
      'border-bottom:1px solid #eef0f3;background:#f8fafc;border-radius:8px 8px 0 0}',
    '#qcb-bar .sp{flex:1}',
    '.qcb-btn{font:600 12px/1 Arial,sans-serif;padding:8px 12px;border-radius:6px;cursor:pointer;',
      'border:1px solid #cbd5e1;background:#fff;color:#0f172a}',
    '.qcb-btn:hover{background:#f1f5f9}',
    '.qcb-btn.primary{background:#1d4ed8;border-color:#1d4ed8;color:#fff}',
    '.qcb-btn.primary:hover{background:#1e40af}',
    '#qcb-status{font:600 11px/1 Arial,sans-serif;color:#64748b}',
    '#qcb-status.bad{color:#b91c1c}',
    '#qcb-body{padding:0 12px 14px}',
    /* a chapter: the dark bar, the column headings, the rows, a note, a check line */
    '.qcb-ch{margin-top:14px}',
    '.qcb-ch>h3{margin:0;font:700 12px/1 Arial,sans-serif;color:#fff;background:#0f172a;',
      'padding:8px 10px;border-radius:5px 5px 0 0;display:flex;align-items:baseline;gap:10px}',
    '.qcb-ch>h3 em{font:400 10.5px/1.4 Arial,sans-serif;color:#cbd5e1;font-style:normal}',
    '.qcb-ch>h3 span.src{margin-left:auto;font:600 10px/1 Arial,sans-serif;color:#7dd3fc;',
      'letter-spacing:.03em}',
    '.qcb-tbl{width:100%;border-collapse:collapse;table-layout:fixed}',
    '.qcb-tbl th{font:700 10px/1 Arial,sans-serif;color:#64748b;text-align:center;',
      'padding:7px 3px;white-space:nowrap}',
    '.qcb-tbl td{padding:2px 3px}',
    '.qcb-tbl td.rl{font:700 11px/1 Arial,sans-serif;color:#0f172a;padding-left:2px;white-space:nowrap}',
    '.qcb-tbl td.rl.sub{font-weight:400;color:#64748b;padding-left:12px}',
    '.qcb-tbl td.rl.mk{color:#7c3aed}',
    '.qcb-tbl input,.qcb-tbl select{width:100%;box-sizing:border-box;',
      'font:700 11px/1 Arial,sans-serif;color:#1d4ed8;background:#eff6ff;border:1px solid #cbd5e1;',
      'border-radius:4px;padding:5px 4px;text-align:center}',
    '.qcb-tbl select{text-align:left;padding:5px 2px 5px 5px}',
    '.qcb-tbl input:focus,.qcb-tbl select:focus{outline:2px solid #93c5fd;outline-offset:-1px}',
    /* a mark cell — the name a girder or a bay calls a type by */
    '.qcb-tbl select.mk{color:#7c3aed;background:#f5f3ff;border-color:#ddd6fe}',
    '.qcb-tbl .out{font:600 11px/1 Arial,sans-serif;color:#64748b;text-align:center;',
      'padding:6px 4px;background:#f8fafc;border:1px solid #eef0f3;border-radius:4px;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.qcb-tbl .out b{color:#0f172a}',
    '.qcb-tbl .hd{font:700 10px/1 Arial,sans-serif;color:#64748b;text-align:center;padding:5px 2px}',
    /* dimmed = this cell cannot apply to the form you picked */
    '.qcb-tbl .dim{color:#b9c2ce;background:#f9fafb;border-color:#e5e7eb}',
    '.qcb-note{font:italic 10.5px/1.6 Arial,sans-serif;color:#64748b;padding:5px 2px 0}',
    '.qcb-chk{font:600 10.5px/1.6 Arial,sans-serif;color:#b45309;padding:3px 2px 0;',
      'display:flex;flex-wrap:wrap;gap:4px 18px}',
    '.qcb-chk .k{color:#64748b;font-weight:400}',
    '.qcb-add{font:600 10.5px/1 Arial,sans-serif;color:#1d4ed8;background:none;border:0;',
      'cursor:pointer;padding:6px 2px 0}',
    '.qcb-add:hover{text-decoration:underline}',
    '.qcb-add.del{color:#94a3b8;margin-left:10px}',
    /* the drawing sits under the form, as wide as it */
    '#qcb-views{display:flex;gap:12px;align-items:flex-start}',
    '.qcb-view{border:1px solid #e3e6ea;border-radius:8px;background:#15181c;padding:10px}',
    '.qcb-view h4{font:700 11px/1 Arial,sans-serif;color:#94a3b8;letter-spacing:.06em;',
      'margin:0 0 6px}',
    '.qcb-view svg{display:block;width:100%;height:auto}',
    '.qcb-cap{font:600 10.5px/1.5 Arial,sans-serif;color:#64748b;padding:6px 2px 0}'
  ].join('');

  function style() {
    if (document.getElementById(CSS_ID)) return;
    var s = document.createElement('style');
    s.id = CSS_ID; s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ---------------- little helpers ---------------- */
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  };
  function el(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }
  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d || 0); }
  function rnd(x, n) { var p = Math.pow(10, n || 0); return Math.round(x * p) / p; }

  /* Crossbeam forms. The first three are the manual's 가로보 (§2.4.10) and are
     one solid member; the last two are its 수직브레이싱 (§2.4.11) and are a
     truss of angles. They share one library because a bay picks exactly one. */
  var FORMS = ['Rolled beam', 'Built-up plate', 'Stiffener-connected',
               'V frame', 'Inverted V frame'];
  var isTruss = function (f) { return f === 'V frame' || f === 'Inverted V frame'; };

  var ANGLES = ['L-100x100x10', 'L-130x130x12', 'L-150x150x15', 'L-175x175x15'];
  var BEAMS  = ['H-400x200x8x13', 'H-500x200x10x16', 'H-600x200x11x17'];
  var BOLTS  = ['M20', 'M22', 'M24'];
  var STEELS = ['SS275', 'SM355', 'SM420'];
  var CONCS  = ['C24', 'C27', 'C30', 'C35'];

  /* ---------------- the values ----------------
     Defaults are the manual's own 권고안 for a 판형교 (§2.3.4): five girders,
     2.5 m apart, 1.2 m of overhang each side — which is 12.4 m out to out. */
  function defaults() {
    return {
      ng: 5, sp: 2500, even: 1, sl: 1200, sr: 1200,
      gt: [                                   // girder type library
        { m: 'GT1', hw: 1800, tw: 12, bt: 400, tt: 22, bb: 500, tb: 28 },
        { m: 'GT2', hw: 1800, tw: 14, bt: 500, tt: 28, bb: 600, tb: 36 }
      ],
      gAsg: ['GT2', 'GT1', 'GT1', 'GT1', 'GT2'],
      stW: 130, stT: 12, stG: 60, stH: 25, stSide: 'Both sides', stPitch: 2500,
      scA: [25, 25, 35], scB: [35, 35, 50],   // scallop: t <= 16 / t > 16
      ct: [                                   // crossbeam type library
        { m: 'CT1', f: 'V frame', s: 'H-500x200x10x16', u: 'L-130x130x12',
          l: 'L-130x130x12', d: 'L-130x130x12', p: 12, b: 'M22' },
        { m: 'CT2', f: 'Inverted V frame', s: 'H-500x200x10x16', u: 'L-150x150x15',
          l: 'L-150x150x15', d: 'L-150x150x15', p: 14, b: 'M22' },
        { m: 'CT3', f: 'Rolled beam', s: 'H-500x200x10x16', u: '', l: '', d: '',
          p: 12, b: 'M22' }
      ],
      cAsg: ['CT1', 'CT1', 'CT1', 'CT1'],
      cEnd: 'CT2', cPitch: 5000, cSeat: 'Sloped',
      slopeL: 2.0, slopeR: 2.0, crown: 'Road centre', soffit: 'Level',
      T: 240, T1: 240, T2: 240, hh: 100, pav: 80, ovh: 300,
      bh1: 300, bh2: 500, bh3: 250, bwt: 250, bwb: 450, bSym: 1,
      matS: 'SM355', matC: 'C27'
    };
  }

  /* Everything that follows from V. Kept apart from defaults() so the form can
     edit V and ask again without the derivation drifting. */
  function derive(V) {
    var D = {};
    D.W = V.sp * (V.ng - 1) + V.sl + V.sr;          // out to out
    D.half = D.W / 2;
    D.gw = V.sp * (V.ng - 1);                        // first girder to last
    D.gx = [];
    for (var i = 0; i < V.ng; i++) D.gx.push(-D.gw / 2 + i * V.sp);
    /* The soffit rule, and the whole reason chapter 6 has that cell. A roof
       (both sides falling away from the crown) is normally built with a LEVEL
       soffit: the girders all sit at one height and the slab thickens toward
       the crown. Slope the soffit instead and the girders step. */
    D.level = V.soffit === 'Level';
    D.dropL = V.slopeL / 100 * (D.half);             // fall from crown to edge
    D.dropR = V.slopeR / 100 * (D.half);
    D.crownT = V.T1 + Math.max(D.dropL, D.dropR);    // thickness at the crown
    D.gz = D.gx.map(function (x) {
      return D.level ? 0 : -(x < 0 ? (-x) * V.slopeL / 100 : x * V.slopeR / 100);
    });
    D.gtOf = function (i) {
      var m = V.gAsg[i];
      for (var k = 0; k < V.gt.length; k++) if (V.gt[k].m === m) return V.gt[k];
      return V.gt[0];
    };
    D.ctOf = function (i) {
      var m = V.cAsg[i];
      for (var k = 0; k < V.ct.length; k++) if (V.ct[k].m === m) return V.ct[k];
      return V.ct[0];
    };
    D.kgm = function (t) {
      return (t.hw * t.tw + t.bt * t.tt + t.bb * t.tb) * 7.85e-6 * 1000;
    };
    D.depth = function (t) { return t.hw + t.tt + t.tb; };
    /* Slab area, cut across. Level soffit: a trapezoid whose top is the two
       falls and whose bottom is flat. Sloped soffit: a constant thickness. */
    D.slabA = D.level
      ? (V.T1 * D.W + (D.dropL * D.half / 2) + (D.dropR * D.half / 2)) / 1e6
      : (V.T1 * D.W) / 1e6;
    D.barA = ((V.bwt + V.bwb) / 2 * (V.bh1 + V.bh2 + V.bh3)) / 1e6;
    return D;
  }

  /* ---------------- the page ---------------- */
  function fquick_crossbeam(mountId) {
    var mount = document.getElementById(mountId);
    if (!mount || mount.firstElementChild) return;
    style();

    var V = defaults(), D = derive(V);

    var wrap = el(
      '<div id="qcb-wrap">' +
      '  <div id="qcb-form">' +
      '    <div id="qcb-bar">' +
      '      <button class="qcb-btn primary" id="qcb-reset" type="button">Reset to defaults</button>' +
      '      <span id="qcb-status"></span>' +
      '      <span class="sp"></span>' +
      '    </div>' +
      '    <div id="qcb-body"></div>' +
      '  </div>' +
      '  <div id="qcb-views">' +
      '    <div class="qcb-view" style="flex:1">' +
      '      <h4>TYPICAL CROSS SECTION</h4><div id="qcb-d1"></div>' +
      '      <div class="qcb-cap" id="qcb-cap1"></div>' +
      '    </div>' +
      '    <div class="qcb-view" style="width:360px;flex:0 0 360px">' +
      '      <h4>STIFFENER &amp; SCALLOP</h4><div id="qcb-d2"></div>' +
      '      <div class="qcb-cap" id="qcb-cap2"></div>' +
      '    </div>' +
      '  </div>' +
      '</div>');
    mount.appendChild(wrap);

    var body = wrap.querySelector('#qcb-body');
    var status = wrap.querySelector('#qcb-status');

    /* ---- cell builders. Each carries the path it writes back to, so one
       delegated listener can serve the whole form. ---- */
    function inp(path, val, dim) {
      return '<input type="text" data-p="' + path + '" value="' + esc(val) + '"' +
             (dim ? ' class="dim" disabled' : '') + '>';
    }
    function sel(path, val, list, cls) {
      return '<select data-p="' + path + '"' + (cls ? ' class="' + cls + '"' : '') + '>' +
        list.map(function (o) {
          return '<option' + (String(o) === String(val) ? ' selected' : '') + '>' + esc(o) + '</option>';
        }).join('') + '</select>';
    }
    var out = function (h) { return '<div class="out">' + h + '</div>'; };
    var hd  = function (h) { return '<div class="hd">' + h + '</div>'; };

    function chapter(n, title, sub, src, cols, rows, note, chk) {
      return '<div class="qcb-ch"><h3>' + n + '. ' + title +
        (sub ? '<em>' + sub + '</em>' : '') +
        '<span class="src">' + src + '</span></h3>' +
        '<table class="qcb-tbl"><colgroup>' +
        cols.w.map(function (x) { return '<col style="width:' + x + '">'; }).join('') +
        '</colgroup><tr>' + cols.h.map(function (h) { return '<th>' + h + '</th>'; }).join('') +
        '</tr>' + rows + '</table>' +
        (note ? '<div class="qcb-note">' + note + '</div>' : '') +
        (chk ? '<div class="qcb-chk">' + chk + '</div>' : '') + '</div>';
    }
    function row(label, cells, kind) {
      return '<tr><td class="rl' + (kind === 1 ? ' sub' : '') + (kind === 2 ? ' mk' : '') + '">' +
        label + '</td>' + cells.map(function (c) {
          return '<td>' + (c == null ? '' : c) + '</td>';
        }).join('') + '</tr>';
    }

    var W9 = ['13%', '9.5%', '9.5%', '9.5%', '9.5%', '9.5%', '9.5%', '9.5%', '21%'];
    var W8 = ['14%', '11%', '11%', '11%', '11%', '11%', '11%', '20%'];

    /* ---------------- draw the form ---------------- */
    function build() {
      D = derive(V);
      var H = '', i;

      /* 1 — girder layout, and which girder is which type */
      var head = [''], asg = [''];
      for (i = 0; i < V.ng; i++) {
        head.push(hd('G' + (i + 1)));
        asg.push(sel('gAsg.' + i, V.gAsg[i], V.gt.map(function (t) { return t.m; }), 'mk'));
      }
      while (head.length < 8) { head.push(''); asg.push(''); }
      head.length = 8; asg.length = 8;
      head.push(''); asg.push(out('<b>' + V.gt.length + '</b> types'));
      H += chapter(1, 'Girder layout',
        'how many, how far apart — and which type each one is', 'APlate §2.3.4',
        { w: W9, h: ['', 'Girders', 'Spacing L', 'Overhang SL', 'Overhang SR', '', '', '', ''] },
        row('Layout', [inp('ng', V.ng), inp('sp', V.sp, !V.even), inp('sl', V.sl), inp('sr', V.sr),
                       null, null, null, out('Out to out <b>' + D.W + '</b>')]) +
        row('Spacing', [sel('even', V.even ? 'Equal' : 'Per bay', ['Equal', 'Per bay']),
                        null, null, null, null, null, null,
                        out('Girder to girder <b>' + D.gw + '</b>')], 1) +
        row('', head.slice(1), 1) +
        row('Girder type', asg.slice(1), 2),
        'Type one spacing and every bay takes it. The manual asks for SL · L1…L' +
        (V.ng - 1) + ' · SR one by one; <b>the same number is not worth typing five times.</b> ' +
        'Each girder then picks a type by name from chapter 2 — making only the outer ' +
        'girders heavier is two cells, not two girders.',
        '<span class="k">Girder levels</span> ' +
        (D.level ? '<b>all equal</b> — the soffit is level, so the cross slope is carried by slab thickness'
                 : D.gz.map(function (z, k) { return 'G' + (k + 1) + ' ' + rnd(z, 0); }).join(' / ')));

      /* 2 — girder type library */
      var gtRows = V.gt.map(function (t, k) {
        return row(t.m, [inp('gt.' + k + '.hw', t.hw), inp('gt.' + k + '.tw', t.tw),
                         inp('gt.' + k + '.bt', t.bt), inp('gt.' + k + '.tt', t.tt),
                         inp('gt.' + k + '.bb', t.bb), inp('gt.' + k + '.tb', t.tb), null,
                         out('Depth <b>' + D.depth(t) + '</b> &middot; <b>' +
                             rnd(D.kgm(t), 1) + ' kg/m</b>')], 2);
      }).join('');
      H += chapter(2, 'Girder types', 'one row is one type — declared here, called by name above',
        'APlate §2.3.17', { w: W9, h: ['', 'Web H', 'Web t', 'Top B', 'Top t', 'Btm B', 'Btm t', '', ''] },
        gtRows,
        'The same shape as Simple connector\'s connection library: <b>the mark carries no ' +
        'meaning of its own</b>, this row says what it is. So GT1 can be made heavier and ' +
        'every girder that named it is still right. Variable-depth girders — a flange that ' +
        'changes along the span — are a later step; one section runs the whole span here.',
        '');
      H += '<button class="qcb-add" data-add="gt">+ Add girder type</button>' +
           (V.gt.length > 1 ? '<button class="qcb-add del" data-del="gt">− Remove last</button>' : '');

      /* 3 — stiffener and scallop */
      var thick = V.gt.reduce(function (a, t) { return Math.max(a, t.tb); }, 0);
      var sc = thick > 16 ? V.scB : V.scA;
      H += chapter(3, 'Stiffener &amp; scallop', 'left and right, and how the end is cut away',
        'APlate §2.4.13 · §2.4.2',
        { w: W8, h: ['', 'Width W', 'Thk T', 'End cut G', 'Flange gap H', 'Side', 'Pitch', ''] },
        row('Stiffener', [inp('stW', V.stW), inp('stT', V.stT), inp('stG', V.stG), inp('stH', V.stH),
                          sel('stSide', V.stSide, ['Both sides', 'Left only', 'Right only']),
                          inp('stPitch', V.stPitch),
                          out('Slenderness <b>' + rnd(V.stW / V.stT, 1) + '</b>')]) +
        row('Scallop t &le; 16', [inp('scA.0', V.scA[0]), inp('scA.1', V.scA[1]), inp('scA.2', V.scA[2]),
                                  null, null, null, out('a &middot; b &middot; c')], 1) +
        row('Scallop t &gt; 16', [inp('scB.0', V.scB[0]), inp('scB.1', V.scB[1]), inp('scB.2', V.scB[2]),
                                  null, null, null, out('a &middot; b &middot; c')], 1),
        'The manual takes left and right apart — <b>LW/RW · LT/RT · LG/RG · LH/RH</b>, eight ' +
        'cells. <b>Both sides</b> makes that four. The scallop is two sets, split at a parent ' +
        'plate of 16 mm as the manual has it; <b>which set applies is read off the flange, ' +
        'not asked.</b>',
        '<span class="k">In use</span> flange t' + thick + ' &rarr; <b>' +
        (thick > 16 ? 't &gt; 16' : 't &le; 16') + '</b> set (' + sc.join(' · ') + ')');

      /* 4 — crossbeam type library */
      var ctRows = V.ct.map(function (t, k) {
        var tr = isTruss(t.f);
        return row(t.m, [sel('ct.' + k + '.f', t.f, FORMS),
                         tr ? inp('ct.' + k + '.s', '—', true) : sel('ct.' + k + '.s', t.s, BEAMS),
                         tr ? sel('ct.' + k + '.u', t.u, ANGLES) : inp('ct.' + k + '.u', '—', true),
                         tr ? sel('ct.' + k + '.l', t.l, ANGLES) : inp('ct.' + k + '.l', '—', true),
                         tr ? sel('ct.' + k + '.d', t.d, ANGLES) : inp('ct.' + k + '.d', '—', true),
                         inp('ct.' + k + '.p', t.p), sel('ct.' + k + '.b', t.b, BOLTS),
                         out(isTruss(t.f) ? 'truss of angles' : 'one solid member')], 2);
      }).join('');
      H += chapter(4, 'Crossbeam types', 'one row is one type — five forms', 'APlate §2.4.10 · §2.4.11',
        { w: W9, h: ['', 'Form', 'Section', 'Top chord', 'Btm chord', 'Diagonal', 'Plate t', 'Bolt', ''] },
        ctRows,
        'The manual keeps these on two screens: <b>§2.4.10, the crossbeam</b> is one solid member — ' +
        'rolled beam, built-up plate, or connected straight to the stiffener — and ' +
        '<b>§2.4.11, the vertical bracing</b> is a truss of angles, V or inverted V. A bay picks exactly ' +
        'one of the five, so they share one library. <b>Pick a solid form and the chord cells ' +
        'go quiet; pick a truss and the section cell does.</b>',
        '');
      H += '<button class="qcb-add" data-add="ct">+ Add crossbeam type</button>' +
           (V.ct.length > 1 ? '<button class="qcb-add del" data-del="ct">− Remove last</button>' : '');

      /* 5 — crossbeam layout */
      var bays = V.ng - 1, bh = [''], ba = [''];
      for (i = 0; i < bays; i++) {
        bh.push(hd('G' + (i + 1) + '–G' + (i + 2)));
        ba.push(sel('cAsg.' + i, V.cAsg[i], V.ct.map(function (t) { return t.m; }), 'mk'));
      }
      while (bh.length < 6) { bh.push(''); ba.push(''); }
      bh.length = 6; ba.length = 6;
      bh.push(hd('Pitch')); ba.push(inp('cPitch', V.cPitch));
      bh.push(hd('End &amp; pier'));
      ba.push(sel('cEnd', V.cEnd, V.ct.map(function (t) { return t.m; }), 'mk'));
      bh.push(''); ba.push(out('<b>' + bays + '</b> bays'));
      H += chapter(5, 'Crossbeam layout', 'a type on every bay between two girders', 'APlate §2.3.13',
        { w: W9, h: ['', '', '', '', '', '', '', '', ''] },
        row('', bh.slice(1), 1) +
        row('Type', ba.slice(1), 2) +
        row('Seating', [sel('cSeat', V.cSeat, ['Sloped', 'Level']), null, null, null, null, null,
                        null, out(D.level ? 'No step — soffit is level' : 'Step across a bay')], 1),
        'Five girders make <b>four bays</b>, and each can take a different type — a solid beam ' +
        'under the median, a truss elsewhere. Along the span one pitch repeats, and the ends ' +
        'and piers are named separately. <b>Seating</b> is what to do when the cross slope ' +
        'leaves the two girders at different heights: sit the crossbeam <b>sloped</b>, or ' +
        '<b>level</b> against the lower one (§2.4.10, "section arrangement").',
        '');

      /* 6 — deck slab */
      H += chapter(6, 'Deck slab', 'left and right slopes — and whether the soffit stays level',
        'APlate §2.3.20',
        { w: W9, h: ['', 'Slope left', 'Slope right', 'Soffit', 'Base t', 'Edge T1', 'Edge T2', 'Haunch', ''] },
        row('Slab', [inp('slopeL', V.slopeL), inp('slopeR', V.slopeR),
                     sel('soffit', V.soffit, ['Level', 'Follows slope']),
                     inp('T', V.T), inp('T1', V.T1), inp('T2', V.T2), inp('hh', V.hh),
                     out('Area <b>' + rnd(D.slabA, 2) + ' m&sup2;</b>')]) +
        row('And', [sel('crown', V.crown, ['Road centre', 'From left edge']), null, null,
                    hd('Pavement'), inp('pav', V.pav), hd('Overhang'), inp('ovh', V.ovh),
                    out('Crown t <b>' + rnd(D.crownT, 0) + '</b>')], 1),
        'Both slopes are taken, so <b>−2 / −2 is a roof</b> about the crown and a sign change ' +
        'makes it fall one way. <b>Soffit</b> is the cell that matters: on a roof the soffit is ' +
        'normally <b>level</b>, so every girder sits at one height and the slab thickens toward ' +
        'the crown; let it <b>follow the slope</b> and the girders step down instead. The manual ' +
        'calls this "level applied from the road centre" and says it is what makes the girder elevations differ. ' +
        '<b>Concrete is drawn as a section only</b> — it is reported by area, never weighed as steel.',
        '<span class="k">Slab</span> crown ' + rnd(D.crownT, 0) + ' / edges ' + V.T1 + ' &middot; ' + V.T2 +
        ' &nbsp; <span class="k">Fall</span> ' + rnd(D.dropL, 0) + ' left / ' + rnd(D.dropR, 0) + ' right');

      /* 7 — barrier */
      H += chapter(7, 'Barrier', 'a section only, like the slab', 'APlate §2.3.21',
        { w: W8, h: ['', 'H1', 'H2', 'H3', 'Top width', 'Btm width', 'Sides', ''] },
        row('Barrier', [inp('bh1', V.bh1), inp('bh2', V.bh2), inp('bh3', V.bh3),
                        inp('bwt', V.bwt), inp('bwb', V.bwb),
                        sel('bSym', V.bSym ? 'Symmetric' : 'Each side', ['Symmetric', 'Each side']),
                        out('Area <b>' + rnd(D.barA, 2) + ' m&sup2;</b>')]),
        'Unlock <b>Each side</b> when the two are not the same.', '');

      /* 8 — material */
      H += chapter(8, 'Material', '', 'engine change pending',
        { w: W8, h: ['', 'Steel', 'Concrete', '', '', '', '', ''] },
        row('Material', [sel('matS', V.matS, STEELS), sel('matC', V.matC, CONCS),
                         null, null, null, null,
                         out('Concrete <b>' + rnd((D.slabA + D.barA * 2), 2) + ' m&sup2;</b> section')]),
        'The engine has one density — <code>RHO = 7.85e-6</code> — and <code>MAT</code> is a ' +
        'label beside it. <b>So concrete cannot be weighed yet</b>, and this form reports it by ' +
        'area rather than pretending. Teaching the engine a second density is a change to the ' +
        'engine, and that is asked for separately.', '');

      body.innerHTML = H;
      draw();
      say(V.ng + ' girders · ' + (V.ng - 1) + ' bays · out to out ' + D.W);
    }

    function say(t, bad) { status.textContent = t; status.className = bad ? 'bad' : ''; }

    /* ---------------- the drawing ----------------
       The section is drawn from the same V the form holds, so there is no second
       description of the bridge to fall out of step. */
    function draw() {
      var w = 1180, h = 445, SC, i;
      var span = D.W * 1.06;
      SC = (w - 60) / span;
      var x0 = w / 2, y0 = 168;
      var X = function (m) { return rnd(x0 + m * SC, 1); };
      var Y = function (m) { return rnd(y0 - m * SC, 1); };
      var sL = V.slopeL / 100, sR = V.slopeR / 100;
      var top = function (m) { return m < 0 ? -(-m) * sL : -m * sR; };  // slab top, crown at 0
      var g = [];

      /* pavement line */
      g.push('<path d="M ' + X(-D.half) + ' ' + Y(top(-D.half) + V.pav) + ' L ' + X(0) + ' ' +
             Y(V.pav) + ' L ' + X(D.half) + ' ' + Y(top(D.half) + V.pav) +
             '" stroke="#64748b" stroke-dasharray="5 3" fill="none"/>');

      /* the slab. Level soffit: the underside is one flat line with a haunch
         dropped at each girder. Sloped: it simply follows the top. */
      var botZ = D.level ? (top(-D.half) - V.T1) : null;
      var p = 'M ' + X(-D.half) + ' ' + Y(top(-D.half)) + ' L ' + X(0) + ' ' + Y(0) +
              ' L ' + X(D.half) + ' ' + Y(top(D.half));
      if (D.level) {
        p += ' L ' + X(D.half) + ' ' + Y(botZ);
        for (i = V.ng - 1; i >= 0; i--) {
          var hb = D.gtOf(i).bt + 120, gx = D.gx[i];
          p += ' L ' + X(gx + hb / 2) + ' ' + Y(botZ) +
               ' L ' + X(gx + hb / 2 - 70) + ' ' + Y(botZ - V.hh) +
               ' L ' + X(gx - hb / 2 + 70) + ' ' + Y(botZ - V.hh) +
               ' L ' + X(gx - hb / 2) + ' ' + Y(botZ);
        }
        p += ' L ' + X(-D.half) + ' ' + Y(botZ) + ' Z';
      } else {
        p += ' L ' + X(D.half) + ' ' + Y(top(D.half) - V.T1) +
             ' L ' + X(0) + ' ' + Y(-V.T1) +
             ' L ' + X(-D.half) + ' ' + Y(top(-D.half) - V.T1) + ' Z';
      }
      g.push('<path d="' + p + '" fill="url(#qcbHz)" stroke="#38bdf8" stroke-width="1.4"/>');

      /* barriers */
      [[-D.half, 1], [D.half, -1]].forEach(function (b) {
        var bx = b[0], s = b[1], t = top(bx), H3 = V.bh1 + V.bh2 + V.bh3;
        g.push('<path d="M ' + X(bx) + ' ' + Y(t) + ' L ' + X(bx + s * V.bwb) + ' ' + Y(t) +
               ' L ' + X(bx + s * V.bwt) + ' ' + Y(t + H3) + ' L ' + X(bx) + ' ' + Y(t + H3) +
               ' Z" fill="url(#qcbHz)" stroke="#38bdf8" stroke-width="1.4"/>');
      });

      /* crown mark and the two falls */
      g.push('<line x1="' + X(0) + '" y1="' + (Y(V.pav) - 16) + '" x2="' + X(0) + '" y2="' +
             (Y(0) + 6) + '" stroke="#fbbf24" stroke-dasharray="3 2"/>' +
             '<text x="' + X(0) + '" y="' + (Y(V.pav) - 21) + '" fill="#fbbf24" font-size="11"' +
             ' font-weight="700" text-anchor="middle">crown &middot; ' + esc(V.crown) + '</text>');
      g.push('<text x="' + X(-D.half * 0.55) + '" y="' + (Y(top(-D.half * 0.55)) - 13) +
             '" fill="#fbbf24" font-size="11" font-weight="700" text-anchor="middle">&minus;' +
             V.slopeL.toFixed(1) + ' %</text>');
      g.push('<text x="' + X(D.half * 0.55) + '" y="' + (Y(top(D.half * 0.55)) - 13) +
             '" fill="#fbbf24" font-size="11" font-weight="700" text-anchor="middle">&minus;' +
             V.slopeR.toFixed(1) + ' %</text>');

      /* girders, each drawn as the type it was given */
      var yTop = [];
      D.gx.forEach(function (gx, k) {
        var t = D.gtOf(k);
        var yT = (D.level ? botZ : (top(gx) - V.T1)) - V.hh;
        yTop.push(yT);
        var yB = yT - t.tt - t.hw - t.tb;
        var P = function (x, y) { return X(x) + ' ' + Y(y); };
        var col = V.gAsg[k] === V.gt[0].m ? '#cbd5e1' : '#fbbf24';
        g.push('<path d="M ' + P(gx - t.bt / 2, yT) + ' L ' + P(gx + t.bt / 2, yT) +
          ' L ' + P(gx + t.bt / 2, yT - t.tt) + ' L ' + P(gx + t.tw / 2, yT - t.tt) +
          ' L ' + P(gx + t.tw / 2, yB + t.tb) + ' L ' + P(gx + t.bb / 2, yB + t.tb) +
          ' L ' + P(gx + t.bb / 2, yB) + ' L ' + P(gx - t.bb / 2, yB) +
          ' L ' + P(gx - t.bb / 2, yB + t.tb) + ' L ' + P(gx - t.tw / 2, yB + t.tb) +
          ' L ' + P(gx - t.tw / 2, yT - t.tt) + ' L ' + P(gx - t.bt / 2, yT - t.tt) +
          ' Z" fill="' + col + '" stroke="#e2e8f0" stroke-width="1"/>');
        g.push('<text x="' + X(gx) + '" y="' + (Y(yB) + 20) + '" fill="#f59e0b" font-size="12"' +
               ' font-weight="700" text-anchor="middle">G' + (k + 1) + '</text>');
        g.push('<text x="' + X(gx) + '" y="' + (Y(yB) + 34) + '" fill="#94a3b8" font-size="10"' +
               ' text-anchor="middle">' + esc(V.gAsg[k]) + '</text>');
      });

      /* crossbeams, each drawn as the form its bay was given */
      for (i = 0; i < V.ng - 1; i++) {
        var ta = D.gtOf(i), tb2 = D.gtOf(i + 1);
        var a = D.gx[i], b2 = D.gx[i + 1], mid = (a + b2) / 2;
        var yA = yTop[i] - ta.tt, yB2 = yTop[i + 1] - tb2.tt;
        var baA = yA - ta.hw, baB = yB2 - tb2.hw;
        var ct = D.ctOf(i);
        var ln = function (x1, y1, x2, y2, c, wd) {
          g.push('<line x1="' + X(x1) + '" y1="' + Y(y1) + '" x2="' + X(x2) + '" y2="' + Y(y2) +
                 '" stroke="' + c + '" stroke-width="' + wd + '" stroke-linecap="round"/>');
        };
        if (!isTruss(ct.f)) {
          ln(a + 70, (yA + baA) / 2, b2 - 70, (yB2 + baB) / 2, '#22d3ee', 10);
        } else {
          var tcA = yA - 160, tcB = yB2 - 160, bcA = baA + 160, bcB = baB + 160;
          ln(a + 70, tcA, b2 - 70, tcB, '#22d3ee', 3.2);
          ln(a + 70, bcA, b2 - 70, bcB, '#0e7490', 3.2);
          if (ct.f === 'V frame') {
            var ap = (bcA + bcB) / 2;
            ln(a + 70, tcA, mid, ap, '#22d3ee', 3.2); ln(b2 - 70, tcB, mid, ap, '#22d3ee', 3.2);
            g.push('<circle cx="' + X(mid) + '" cy="' + Y(ap) + '" r="3.5" fill="#a78bfa"/>');
          } else {
            var tp = (tcA + tcB) / 2;
            ln(a + 70, bcA, mid, tp, '#22d3ee', 3.2); ln(b2 - 70, bcB, mid, tp, '#22d3ee', 3.2);
            g.push('<circle cx="' + X(mid) + '" cy="' + Y(tp) + '" r="3.5" fill="#a78bfa"/>');
          }
        }
        g.push('<text x="' + X(mid) + '" y="' + (Y((baA + baB) / 2) + 26) + '" fill="#a78bfa"' +
               ' font-size="10" text-anchor="middle">' + esc(V.cAsg[i]) + '</text>');
      }

      /* Dimension string. Placed in SCREEN space, not model space: the girders
         are 1.8 m deep and the deck 12.4 m wide, so a line put a fixed number of
         millimetres under the steel lands outside the picture as soon as the
         scale changes. Two rows under the marks, always visible. */
      var dimY1 = 402, dimY2 = 424;
      var dim = function (x1, x2, sy, t) {
        g.push('<line x1="' + X(x1) + '" y1="' + sy + '" x2="' + X(x2) + '" y2="' + sy +
          '" stroke="#ef4444" stroke-width="1"/><line x1="' + X(x1) + '" y1="' + (sy - 5) +
          '" x2="' + X(x1) + '" y2="' + (sy + 5) + '" stroke="#ef4444"/><line x1="' + X(x2) +
          '" y1="' + (sy - 5) + '" x2="' + X(x2) + '" y2="' + (sy + 5) + '" stroke="#ef4444"/>' +
          '<text x="' + ((X(x1) + X(x2)) / 2) + '" y="' + (sy - 6) + '" fill="#fca5a5"' +
          ' font-size="11" text-anchor="middle">' + t + '</text>');
      };
      dim(-D.half, D.gx[0], dimY1, V.sl);
      for (i = 0; i < V.ng - 1; i++) dim(D.gx[i], D.gx[i + 1], dimY1, V.sp);
      dim(D.gx[V.ng - 1], D.half, dimY1, V.sr);
      dim(-D.half, D.half, dimY2, 'out to out ' + D.W);

      wrap.querySelector('#qcb-d1').innerHTML =
        '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet">' +
        '<defs><pattern id="qcbHz" width="7" height="7" patternTransform="rotate(45)"' +
        ' patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="7" stroke="#334155"' +
        ' stroke-width="1.6"/></pattern></defs>' + g.join('') + '</svg>';
      wrap.querySelector('#qcb-cap1').innerHTML =
        V.ng + ' girders @ ' + V.sp + ' &middot; overhang ' + V.sl + ' / ' + V.sr +
        ' &middot; out to out ' + D.W + ' &middot; slopes &minus;' + V.slopeL.toFixed(1) +
        ' / &minus;' + V.slopeR.toFixed(1) + ' %, soffit ' + esc(V.soffit).toLowerCase();

      drawStiff();
    }

    /* The stiffener end, drawn large. A whole section puts 1800 mm in one panel
       and squeezes the two things this chapter actually sets — the gap off the
       flange and the scallop — into a few pixels. Drawings zoom; so does this. */
    function drawStiff() {
      var t = D.gtOf(0), w = 340, h = 420, SC = 0.50, x0 = 150, y0 = 340;
      var X = function (m) { return rnd(x0 + m * SC, 1); };
      var Y = function (m) { return rnd(y0 - m * SC, 1); };
      var P = function (x, y) { return X(x) + ' ' + Y(y); };
      var thick = V.gt.reduce(function (a, q) { return Math.max(a, q.tb); }, 0);
      var sc = thick > 16 ? V.scB : V.scA, a = sc[0], c = sc[2], g = [];
      g.push('<path d="M ' + P(-t.bb / 2, -t.tb) + ' L ' + P(t.bb / 2, -t.tb) + ' L ' +
             P(t.bb / 2, 0) + ' L ' + P(-t.bb / 2, 0) +
             ' Z" fill="#cbd5e1" stroke="#e2e8f0" stroke-width="1.2"/>');
      g.push('<path d="M ' + P(-t.tw / 2, 0) + ' L ' + P(t.tw / 2, 0) + ' L ' + P(t.tw / 2, 330) +
             ' L ' + P(-t.tw / 2, 330) + ' Z" fill="#cbd5e1" stroke="#e2e8f0" stroke-width="1.2"/>');
      var sides = V.stSide === 'Both sides' ? [1, -1] : (V.stSide === 'Left only' ? [-1] : [1]);
      sides.forEach(function (d) {
        var x1 = d * t.tw / 2, x2 = d * (t.tw / 2 + V.stW), yb = V.stH;
        g.push('<path d="M ' + P(x1, yb + c) + ' L ' + P(x1 + d * a, yb) + ' L ' + P(x2, yb) +
               ' L ' + P(x2, 330) + ' L ' + P(x1, 330) +
               ' Z" fill="#a78bfa" stroke="#ddd6fe" stroke-width="1.2"/>');
      });
      g.push('<line x1="' + X(t.tw / 2 + V.stW + 20) + '" y1="' + Y(0) + '" x2="' +
             X(t.tw / 2 + V.stW + 20) + '" y2="' + Y(V.stH) + '" stroke="#ef4444"/>' +
             '<text x="' + (X(t.tw / 2 + V.stW + 26)) + '" y="' + (Y(V.stH / 2) + 4) +
             '" fill="#fca5a5" font-size="11">H ' + V.stH + '</text>');
      g.push('<line x1="' + X(t.tw / 2) + '" y1="' + Y(365) + '" x2="' + X(t.tw / 2 + V.stW) +
             '" y2="' + Y(365) + '" stroke="#ef4444"/><text x="' +
             ((X(t.tw / 2) + X(t.tw / 2 + V.stW)) / 2) + '" y="' + (Y(365) - 6) +
             '" fill="#fca5a5" font-size="11" text-anchor="middle">W ' + V.stW + '</text>');
      g.push('<text x="' + X(t.tw / 2 + a + 96) + '" y="' + Y(V.stH + 106) +
             '" fill="#c4b5fd" font-size="11">scallop a' + a + ' &middot; c' + c + '</text>' +
             '<line x1="' + X(t.tw / 2 + a) + '" y1="' + Y(V.stH) + '" x2="' + X(t.tw / 2 + a + 90) +
             '" y2="' + Y(V.stH + 110) + '" stroke="#a78bfa"/>');
      g.push('<text x="' + X(-t.bb / 2 + 10) + '" y="' + Y(-t.tb - 60) +
             '" fill="#94a3b8" font-size="11">' + esc(V.gAsg[0]) + ' bottom flange ' +
             t.bb + '&times;' + t.tb + '</text>');
      wrap.querySelector('#qcb-d2').innerHTML =
        '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet">' +
        g.join('') + '</svg>';
      wrap.querySelector('#qcb-cap2').innerHTML =
        'Enlarged at the bottom. Flange t' + thick + ' &rarr; the <b>' +
        (thick > 16 ? 't &gt; 16' : 't &le; 16') + '</b> scallop set.';
    }

    /* ---------------- writing a value back ----------------
       One listener for the whole form. The path on the cell says where it goes,
       so adding a chapter needs no wiring of its own. */
    function put(path, raw) {
      var seg = path.split('.'), o = V, k;
      for (k = 0; k < seg.length - 1; k++) o = o[seg[k]];
      var last = seg[seg.length - 1], was = o[last];
      if (path === 'even') { V.even = raw === 'Equal' ? 1 : 0; return; }
      if (path === 'bSym') { V.bSym = raw === 'Symmetric' ? 1 : 0; return; }
      o[last] = (typeof was === 'number') ? num(raw, was) : raw;
      if (path === 'ng') {
        V.ng = Math.max(2, Math.min(12, Math.round(V.ng)));
        while (V.gAsg.length < V.ng) V.gAsg.push(V.gt[0].m);
        V.gAsg.length = V.ng;
        while (V.cAsg.length < V.ng - 1) V.cAsg.push(V.ct[0].m);
        V.cAsg.length = V.ng - 1;
      }
    }

    body.addEventListener('change', function (e) {
      var t = e.target, p = t && t.getAttribute && t.getAttribute('data-p');
      if (!p) return;
      put(p, t.value);
      build();
    });
    body.addEventListener('click', function (e) {
      var t = e.target;
      var add = t.getAttribute && t.getAttribute('data-add');
      var del = t.getAttribute && t.getAttribute('data-del');
      /* The library grows and shrinks. Nothing here is fixed at six — the sheet
         that gets written later is sized to what is here, not the other way
         round. FORMS.md holds the reasoning. */
      if (add === 'gt') {
        var g0 = V.gt[V.gt.length - 1];
        V.gt.push({ m: 'GT' + (V.gt.length + 1), hw: g0.hw, tw: g0.tw, bt: g0.bt,
                    tt: g0.tt, bb: g0.bb, tb: g0.tb });
        build();
      } else if (del === 'gt' && V.gt.length > 1) {
        var gone = V.gt.pop().m;
        V.gAsg = V.gAsg.map(function (m) { return m === gone ? V.gt[0].m : m; });
        build();
      } else if (add === 'ct') {
        var c0 = V.ct[V.ct.length - 1];
        V.ct.push({ m: 'CT' + (V.ct.length + 1), f: c0.f, s: c0.s, u: c0.u,
                    l: c0.l, d: c0.d, p: c0.p, b: c0.b });
        build();
      } else if (del === 'ct' && V.ct.length > 1) {
        var goneC = V.ct.pop().m;
        V.cAsg = V.cAsg.map(function (m) { return m === goneC ? V.ct[0].m : m; });
        if (V.cEnd === goneC) V.cEnd = V.ct[0].m;
        build();
      }
    });
    wrap.querySelector('#qcb-reset').addEventListener('click', function () {
      V = defaults(); build();
    });

    build();
  }

  window.fquick_crossbeam = fquick_crossbeam;
})();
