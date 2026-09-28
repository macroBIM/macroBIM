/*
    bim_pscbox_test.js — PSCBOX (1/2-cell box girder) page for layout_body_test.js.  v2

    Single entry: fdraw_pscbox(mountId). Full parametric stack ported from the
    Seoul PhD app, specialized to box12cell:
      · Dimension card  — Section Type radio + live RWSVG guide + scrollable
                          variable-mapping table (inputs hold numbers or
                          plain arithmetic, e.g. 6800/2 — no named variables)
      · REBAR card      — trebar/lrebar schema table + Excel loader
      · Rebar Physics   — engine render (ui.js/physics.js) via the generic
                          section adapter; bend-arc post-processing included.
    Engine glue (_buildSectionFromBim/_applyGenericSection/_watchSettle/...)
    is extracted verbatim from seoul_phd_app.js.

    Dependencies (loaded on demand, in order): geomath, bim_dxf,
    bim_draw_test_core, bim_box12cell, calc, exceljs(CDN), excel_reader,
    equation, trebar, lrebar, physics, section, domain, ui.
*/
(function () {
  "use strict";

  // 좌/우 대칭 쌍 레이아웃 — mount() 표 생성과 엑셀 dim 로더가 공용으로 사용
  var DIM_LAYOUT = [
        { t: 'single', l: 'TH' },
        { t: 'free',   l: 'SLL',     r: 'SLR' },
        { t: 'single', l: 'SLB' },
        { t: 'single', l: 'TTS' },
        { t: 'single', l: 'TBS' },
        { t: 'sym', l: 'WL',      r: 'WR' },
        { t: 'sym', l: 'WTL',     r: 'WTR' },
        { t: 'sym', l: 'WBL',     r: 'WBR' },
        { t: 'sym', l: 'WCAL1',   r: 'WCAR1' },
        { t: 'sym', l: 'WCAL2',   r: 'WCAR2' },
        { t: 'sym', l: 'WTHUL1',  r: 'WTHUR1' },
        { t: 'sym', l: 'WTHUL2',  r: 'WTHUR2' },
        { t: 'sym', l: 'WBHUL1',  r: 'WBHUR1' },
        { t: 'sym', l: 'WBHUL2',  r: 'WBHUR2' },
        { t: 'sym', l: 'TCAL',    r: 'TCAR' },
        { t: 'sym', l: 'TCAL1',   r: 'TCAR1' },
        { t: 'sym', l: 'TCAL2',   r: 'TCAR2' },
        { t: 'sym', l: 'TTHL1',   r: 'TTHR1' },
        { t: 'sym', l: 'TTHL2',   r: 'TTHR2' },
        { t: 'sym', l: 'TBHL1',   r: 'TBHR1' },
        { t: 'sym', l: 'TBHL2',   r: 'TBHR2' },
        { t: 'sym', l: 'TBEL',    r: 'TBER' },
        { t: 'sym', l: 'TWEBL',   r: 'TWEBR' },
        { t: 'sym', l: 'R_WTL',   r: 'R_WTR' },
        { t: 'sym', l: 'R_WTIL',  r: 'R_WTIR' },
        { t: 'sym', l: 'R_WBL',   r: 'R_WBR' },
        { t: 'group', label: '2 Cell only' },
        { t: 'sym', l: 'WTCHUL1', r: 'WTCHUR1' },
        { t: 'sym', l: 'WTCHUL2', r: 'WTCHUR2' },
        { t: 'sym', l: 'WBCHUL1', r: 'WBCHUR1' },
        { t: 'sym', l: 'WBCHUL2', r: 'WBCHUR2' },
        { t: 'sym', l: 'TTHCL1',  r: 'TTHCR1' },
        { t: 'sym', l: 'TTHCL2',  r: 'TTHCR2' },
        { t: 'sym', l: 'TBHCL1',  r: 'TBHCR1' },
        { t: 'sym', l: 'TBHCL2',  r: 'TBHCR2' },
        { t: 'single', l: 'TWEBC' }
  ];

  var PAGES = 'https://macrobim.github.io/macroBIM/';

  // const/class 로 선언된 전역도 감지 (window 프로퍼티가 아니므로 bare typeof 필요)
  function hasGlobal(name) { try { return (0, eval)('typeof ' + name) !== 'undefined'; } catch (e) { return false; } }

  function ensureDeps(cb) {
    var need = [];
    if (!hasGlobal('geo_fillet')) need.push(PAGES + 'geomath.js');
    if (!hasGlobal('dxf_generator')) need.push(PAGES + 'bim_dxf.js');
    if (typeof window.RWSVG === 'undefined') need.push(PAGES + 'bim_draw_test_core.js');
    if (!hasGlobal('geo_box12cell')) need.push(PAGES + 'bim_box12cell.js');
    if (typeof window.Calc === 'undefined') need.push(PAGES + 'calc.js');
    if (typeof window.ExcelJS === 'undefined') need.push('https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js');
    if (typeof window.loadSheetData === 'undefined') need.push(PAGES + 'excel_reader.js');
    if (!hasGlobal('EquationParser')) need.push(PAGES + 'equation.js');
    if (!hasGlobal('DuctBlock')) need.push(PAGES + 'bim_duct.js');
    if (!hasGlobal('TrebarFactory')) need.push(PAGES + 'trebar.js');
    if (!hasGlobal('LRebarEngine')) need.push(PAGES + 'lrebar.js');
    if (!hasGlobal('Physics')) need.push(PAGES + 'physics.js');
    if (!hasGlobal('JField')) need.push(PAGES + 'jfield.js');     // 두 번째 엔진 (J 최소화)
    if (!hasGlobal('JLong')) need.push(PAGES + 'jlong.js');       // 그 점(點) 판 — 종방향 철근
    if (!hasGlobal('SectionBase')) need.push(PAGES + 'section.js');
    if (!hasGlobal('Domain')) need.push(PAGES + 'domain.js');
    if (!hasGlobal('UI')) need.push(PAGES + 'ui.js');
    // 개발 중 엔진 파일이 캐시에 물려 옛 동작이 남는 것을 막는다 (레이아웃의 pscbox 로더와 동일 방식)
    var bust = 'v=' + Date.now();
    need = need.map(function (u) {
      if (u.indexOf('cdnjs') >= 0 || u.indexOf('cdn.jsdelivr') >= 0) return u;   // 외부 CDN 은 그대로
      return u + (u.indexOf('?') >= 0 ? '&' : '?') + bust;
    });
    (function next(i) {
      if (i >= need.length) { cb(); return; }
      var s = document.createElement('script');
      s.src = need[i].indexOf(PAGES) === 0 ? need[i] + '?v=' + Date.now() : need[i];   // 리포 파일은 항상 최신 (CDN 은 그대로 캐시)
      s.onload = function () { next(i + 1); };
      s.onerror = function () { console.error('[pscbox] failed to load', need[i]); next(i + 1); };
      document.head.appendChild(s);
    })(0);
  }

  var BEND_RADIUS_BY_DIA = {   // KS 공칭직경(D) → 중심선 곡선반경(mm), EN 최소기준
      10: 25, 13: 32.5, 16: 40, 19: 76, 22: 88, 25: 100, 29: 116, 32: 128, 35: 140, 38: 152, 41: 164, 51: 204
    };
    function bendRadiusForDia(dia) {
      if (dia == null || !(dia > 0)) return 0;
      if (BEND_RADIUS_BY_DIA[dia] != null) return BEND_RADIUS_BY_DIA[dia];
      var inside = (dia <= 16) ? 2 * dia : 3.5 * dia;   // EN 맨드럴/2 = 내면반경
      return inside + dia / 2;                            // 중심선 반경
    }

  var CSS =
    '.px-root{--dim:#2563eb;--line:#cbd5e1;--hair:#e2e8f0;--ink:#182430;color:var(--ink);font-family:"Inter",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;}' +
    '.px-root .draw-card{background:#fff;border:1px solid var(--line);border-radius:10px;overflow:hidden;margin-bottom:16px;}' +
    '.px-root .draw-card-header{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 16px;border-bottom:1px solid var(--hair);background:#f1f5f9;flex-wrap:wrap;}' +
    '.px-root .draw-card-title{font-size:15px;font-weight:600;color:#0f172a;display:flex;align-items:center;}' +
    '.px-root .draw-card-title::before{content:"";display:inline-block;width:4px;height:15px;border-radius:2px;background:#2563eb;margin-right:9px;flex-shrink:0;}' +
    '.px-root .draw-card-desc{display:block;font-size:12.5px;color:#94a3b8;font-weight:400;margin:2px 0 0 13px;}' +
    '.px-root .draw-card-body{padding:12px 14px;}' +
    '.px-root .phys-id{cursor:pointer;font-weight:700;color:#1d4ed8;text-decoration:underline dotted;text-underline-offset:2px;}' +
    '.px-root .phys-id:hover{background:#eff6ff;color:#1e40af;}' +
    '.px-root tr.phys-focus td{background:#fff1ee !important;}' +
    '.px-root tr.phys-focus .phys-id{color:#c2410c;background:#ffe4dc;}' +
    '.px-btn{font:inherit;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#fff;background:var(--dim);border:1px solid var(--dim);border-radius:6px;padding:5px 12px;cursor:pointer;transition:background .12s,border-color .12s,box-shadow .12s,transform .06s;}' +
    '.px-btn:hover{background:#1d4ed8;border-color:#1d4ed8;box-shadow:0 2px 8px rgba(37,99,235,.35);}' +
    '.px-btn:active{transform:translateY(1px) scale(.97);box-shadow:none;}' +
    '.px-root .form-input{font:inherit;font-size:12px;padding:3px 8px;border:1px solid var(--hair);border-radius:5px;color:var(--ink);}' +
    '.px-radio{display:flex;gap:18px;align-items:center;margin:0 0 12px 2px;font-size:13px;color:#334155;}' +
    '.px-radio label{display:flex;gap:6px;align-items:center;cursor:pointer;margin:0;}' +
    '.px-split{display:flex;gap:16px;align-items:flex-start;}' +
    '.px-guide{flex:1 1 0;min-width:0;}' +
    '.px-guide svg{width:100%;height:auto;border:1px solid var(--hair);border-radius:6px;background:#fff;}' +
    '.px-tblwrap{flex:1 1 0;min-width:0;overflow-y:auto;border:1px solid var(--hair);border-radius:8px;background:#fff;}' +
    '.px-tbl{width:100%;border-collapse:collapse;font-size:12.5px;}' +
    '.px-tbl th{position:sticky;top:0;background:#f1f5f9;color:#334155;text-align:left;padding:6px 10px;font-size:12px;z-index:1;border-bottom:1px solid var(--hair);}' +
    '.px-tbl td{padding:3px 10px;border-bottom:1px solid #f1f5f9;}' +
    '.px-tbl td.px-dim{font-weight:600;color:#334155;white-space:nowrap;}' +
    '.px-tbl th.px-symh,.px-tbl td.px-symc{width:26px;text-align:center;padding-left:4px;padding-right:4px;}' +
    '.px-tbl td.px-symc input[type=checkbox]{width:auto;cursor:pointer;}' +
    '.px-tbl input:disabled{background:#f8fafc;color:#94a3b8;}' +
    '.px-tbl tr.px-2cell-hdr td{background:#eef2ff;color:#4338ca;font-weight:700;font-size:11px;letter-spacing:.08em;text-transform:uppercase;text-align:center;padding:5px 10px;}' +
    '.px-tbl small{color:#94a3b8;font-size:10px;font-weight:400;}' +
    '.px-tbl input{width:100%;font-family:inherit;}' +
    '@media(max-width:1000px){.px-split{flex-direction:column;}.px-tblwrap{max-height:320px;width:100%;height:auto !important;}}' +
    '.var-tblwrap{height:224px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px;background:#fff;}.var-tbl .var-c-name{width:12%;}.var-tbl .var-c-val{width:8%;white-space:nowrap;}.var-tbl th.var-c-del,.var-tbl td.var-c-del{width:30px;padding-left:2px;padding-right:6px;}.var-del{padding:2px 6px;cursor:pointer;border-radius:5px;transition:background .12s,color .12s,transform .06s;}.var-del:hover{background:#fee2e2;color:#dc2626;}.var-del:active{transform:scale(.92);}.var-name{font-weight:600;}.var-expr{font-family:inherit;}.var-val{font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.var-val.ok{color:#059669;}.var-val.err{color:#dc2626;font-weight:500;}.rebar-table-wrap{overflow-x:auto;}.rebar-table{width:100%;border-collapse:collapse;font-size:12px;margin:2px 0;}.rebar-table th{background:#1e293b;color:#fff;font-weight:600;padding:6px 9px;text-align:left;white-space:nowrap;border:1px solid #334155;}.rebar-table th.rs-type{color:#FFC107;background:#0f172a;text-align:center;font-weight:700;}.rebar-table td{padding:5px 9px;border:1px solid #e2e8f0;color:#334155;white-space:nowrap;}.rebar-table td:first-child,.rebar-table th:first-child{text-align:center;}.rebar-table tbody tr:nth-child(even) td{background:#f8fafc;}.rebar-table tbody tr:hover td{background:#eff6ff;}.engine-btn{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border:1px solid #2563eb;border-radius:6px;background:#2563eb;color:#fff;font-weight:700;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;font-family:inherit;cursor:pointer;transition:background .12s,border-color .12s,box-shadow .12s,transform .06s;}.engine-btn:hover{background:#1d4ed8;box-shadow:0 2px 8px rgba(37,99,235,.35);}.engine-btn:active{transform:translateY(1px) scale(.97);box-shadow:none;}.engine-ctrls{display:flex;align-items:center;gap:8px;}.var-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px 20px;}@media(max-width:1500px){.var-grid{grid-template-columns:repeat(3,1fr);}}@media(max-width:1100px){.var-grid{grid-template-columns:repeat(2,1fr);}}@media(max-width:680px){.var-grid{grid-template-columns:1fr;}}' +
    '.engine-btn-lite{background:#fff;border-color:#cbd5e1;color:#334155;}.engine-btn-lite:hover{background:#f1f5f9;box-shadow:0 2px 6px rgba(15,23,42,.12);}.engine-btn-lite.active{background:#2563eb;border-color:#2563eb;color:#fff;}' +
    '.phys-split{display:flex;align-items:flex-start;}' +
    '.phys-tblwrap{flex:1 1 0;min-width:0;height:480px;overflow:auto;background:#fff;border-left:1px solid var(--hair);border-radius:0 0 10px 0;}' +
    '.phys-tbl{font-size:11.5px;}.phys-tbl th,.phys-tbl td{white-space:nowrap;padding:4px 8px;}' +
    '.px-tbl.var-tbl th{background:#1e293b;color:#fff;font-weight:600;text-align:center;border-bottom:1px solid #334155;border-right:1px solid #334155;}.px-tbl.var-tbl th:last-child{border-right:none;}' +
    '.px-tbl.dim-tbl th{background:#1e293b;color:#fff;font-weight:600;text-align:center;border-bottom:1px solid #334155;border-right:1px solid #334155;}.px-tbl.dim-tbl th:last-child{border-right:none;}' +
    '.px-cover{width:64px;text-align:right;}' +
    '.px-menubar{display:flex;align-items:center;justify-content:flex-start;gap:8px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px;margin-bottom:14px;}' +
    '.px-mb-label{font-size:12.5px;font-weight:600;color:#475569;white-space:nowrap;}' +
    '.px-btn-lite{background:#fff;color:#334155;border-color:#cbd5e1;}.px-btn-lite:hover{background:#f1f5f9;border-color:#cbd5e1;box-shadow:0 2px 6px rgba(15,23,42,.12);}.px-btn-lite.active{background:#2563eb;border-color:#2563eb;color:#fff;}' +
    '.px-logpanel{background:#0f172a;color:#e2e8f0;border-radius:10px;padding:12px 16px;margin-bottom:14px;font-size:12px;font-family:ui-monospace,Menlo,Consolas,monospace;line-height:1.7;}' +
    '.px-logpanel .log-time{color:#94a3b8;margin-bottom:4px;}.px-logpanel .log-ok{color:#34d399;}.px-logpanel .log-err{color:#f87171;}' +
    '.px-optrow{gap:16px;margin-left:0;}.px-opthalf{flex:1 1 0;min-width:0;display:flex;gap:14px;align-items:center;flex-wrap:wrap;}' +
    '.px-tbl.phys-tbl th{background:#1e293b;color:#fff;font-weight:600;text-align:center;border-bottom:1px solid #334155;border-right:1px solid #334155;}.px-tbl.phys-tbl th:last-child{border-right:none;}' +
    '.phys-tbl td.phys-moving{color:#d97706 !important;}' +
    '.phys-tbl td{text-align:right;color:#334155;}.phys-tbl td:first-child{text-align:left;font-weight:700;color:#0f172a;}' +
    '.phys-tbl td.phys-na{color:#cbd5e1;text-align:center;}' +
    '.phys-rsp{padding:2px 8px;font-size:9.5px;}' +
    '@media(max-width:1100px){.phys-split{flex-direction:column;}.phys-tblwrap{border-left:none;border-top:1px solid var(--hair);height:300px;border-radius:0 0 10px 10px;}}' +
    '.shape-grid{display:flex;flex-wrap:wrap;gap:12px;padding:4px 0 14px;margin-bottom:12px;border-bottom:1px dashed var(--hair);}' +
    '.shape-tile{border:1px solid var(--hair);border-radius:8px;background:#f8fafc;padding:8px 10px 6px;text-align:center;}' +
    '.shape-tile svg{display:block;background:#fff;border:1px solid #eef2f7;border-radius:6px;}' +
    '.shape-tile .shape-code{font-size:11px;font-weight:700;color:#334155;margin-top:5px;letter-spacing:.04em;}' +
    '.px-toast{position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;align-items:center;gap:9px;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;box-shadow:0 4px 14px rgba(0,0,0,.18);color:#fff;font-family:"Inter",system-ui,sans-serif;}' +
    '.px-toast.loading{background:#2563eb;}.px-toast.ok{background:#059669;}.px-toast.err{background:#dc2626;}' +
    '.px-toast .px-spin{width:14px;height:14px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:pxspin .8s linear infinite;flex-shrink:0;}' +
    '@keyframes pxspin{to{transform:rotate(360deg)}}';

  var PXBOX = {
    _mountId: 'mount-draw-pscbox',
    _excelData: null, _rebarData: null, _focusId: null,
    _lines: [], _arcs: [], _circs: [], _ducts: [], _ductSpec: [], _sectOuter: [],
    _uiInited: false, _settleTimer: null, _rebarSettled: false, _lastAp: null, _lastStuckMsg: null,
    _showEngNormals: false, _showEngNodes: false, _engNormGroup: null, _engNodeGroup: null,
    _loadLog: null,

      _renderRebarTables: function () {
        var body = document.getElementById('rebarBody');
        if (!body) return;

        // 표제목 = trebar / lrebar 입력체계 + duct(매입물)
        var SCHEMA = [
          ['trebar', 'id', 'code', 'dia', 'init (x, y, rot)', 'set', 'segs (len)', 'angs', 'nors', 'barStart', 'barEnd', 'radius', 'z'],
          ['lrebar', 'id', 'dia', 'num', 'init (x, y, rot)', 'range (-, +)', 'nors', 'ctc', 'ctcmax', 'ctcmin', 'gap', 'path', 'z'],
          //  매입물 — 철근이 아니라 콘크리트에 뚫린 구멍이다. 문법은 bim_duct.js 에 있다.
          //  ref : deck(상면에서 아래 · 기본) · soffit(밑면에서 위로) · abs(절대 y)
          DuctBlock.SCHEMA_ROW
        ];
        var ncol = SCHEMA[0].length;

        // 엑셀 데이터 행 추출: 첫 셀이 trebar/lrebar 인 행(= 데이터). #trebar/#lrebar(헤더)·빈 행 무시
        var dataRows = this._excelData ? this._extractRebarDataRows(this._excelData) : [];

        function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

        // 셀 안의 산술식을 계산해 표시 (예: a=6800/2 → a=3400). 평가 실패 토큰은 원문 유지.
        function evalTok(t) {
          t = String(t).trim(); if (t === '') return t;
          if (!isNaN(Number(t))) return t;                       // 순수 숫자는 그대로
          if (typeof Calc === 'undefined') return t;
          var r = Calc.eval(t, {});
          if (r.error == null && isFinite(r.value)) return String(Math.round(r.value * 1000) / 1000);
          return t;                                              // 벽id(e5)·fit·ray 등 비수식은 원문
        }
        function evalCell(cell) {
          var raw = String(cell == null ? '' : cell); if (raw.trim() === '') return { txt: raw, changed: false };
          var out = raw.split(',').map(function (part) {
            var m = part.split('=');
            if (m.length === 2) return m[0].trim() + '=' + evalTok(m[1]);
            return part.trim() === '' ? part : part.replace(part.trim(), evalTok(part.trim()));
          }).join(', ');
          return { txt: out, changed: out.replace(/\s/g, '') !== raw.replace(/\s/g, '') };
        }

        var h = '<div class="rebar-table-wrap"><table class="rebar-table"><thead>';
        SCHEMA.forEach(function (row) {
          h += '<tr class="rebar-schema-row">';
          for (var i = 0; i < ncol; i++) h += '<th class="' + (i === 0 ? 'rs-type' : '') + '">' + esc(row[i]) + '</th>';
          h += '</tr>';
        });
        h += '</thead><tbody>';
        if (dataRows.length) {
          dataRows.forEach(function (r) {
            h += '<tr>';
            for (var i = 0; i < ncol; i++) {
              /*  평가에서 빼는 칸 —
                    0 type · 1 id  는 이름이다.
                    2 는 trebar 의 **형상 code** 다. `23a` 처럼 가지가 붙는데,
                      수식으로 보면 23 − 1 = **22** 가 되어 버린다. 실제로 그렇게
                      찍혔다 — 코드는 23a(옛 표기 23-1)로 잘 들어가 있는데 표만 22 로 보였다.
                      code 는 식이 아니라 이름이므로 계산하지 않는다.                */
              var isTre = String(r[0] == null ? '' : r[0]).trim().toLowerCase() === 'trebar';
              if (i < 2 || (i === 2 && isTre)) { h += '<td>' + esc(r[i]) + '</td>'; continue; }
              var ec = evalCell(r[i]);
              h += ec.changed
                ? '<td title="' + esc(r[i]) + '">' + esc(ec.txt) + '</td>'      // 툴팁 = 원본 수식
                : '<td>' + esc(r[i]) + '</td>';
            }
            h += '</tr>';
          });
        } else {
          h += '<tr><td colspan="' + ncol + '" style="text-align:center;color:#94a3b8;padding:14px;">Load rebar data with [Load Excel].</td></tr>';
        }
        body.innerHTML = h + '</tbody></table></div>';
      },

      _sectionDiag: function (walls) {
        var minx = 1e18, miny = 1e18, maxx = -1e18, maxy = -1e18;
        walls.forEach(function (w) { minx = Math.min(minx, w.x1, w.x2); maxx = Math.max(maxx, w.x1, w.x2); miny = Math.min(miny, w.y1, w.y2); maxy = Math.max(maxy, w.y1, w.y2); });
        return Math.hypot(maxx - minx, maxy - miny) || 1000;
      },

      _rowFirstToken: function (row) {
        if (!Array.isArray(row)) return '';
        for (var c = 0; c < row.length; c++) { var v = String(row[c] == null ? '' : row[c]).trim(); if (v !== '') return v; }
        return '';
      },

      _rowIsEnd: function (row) { return this._rowFirstToken(row).toLowerCase() === 'end'; },

      _rowIsComment: function (row) { var f = this._rowFirstToken(row); var ch = f.charAt(0); return ch === '#' || ch === '!'; },

      _extractRebarDataRows: function (fullData) {
        if (!Array.isArray(fullData)) return [];
        var out = [];
        for (var r = 0; r < fullData.length; r++) {
          var row = fullData[r];
          if (this._rowIsEnd(row)) break;          // end → 종료
          if (this._rowIsComment(row)) continue;   // 주석 행 무시
          var hc = -1;
          for (var c = 0; c < (row ? row.length : 0); c++) {
            var t = String(row[c] == null ? '' : row[c]).trim().toLowerCase();
            if (t === 'trebar' || t === 'lrebar') { hc = c; break; }
          }
          if (hc >= 0) out.push(row.slice(hc));    // [type, id, code, ...] (빈 행은 자연히 스킵)
        }
        return out;
      },

      _parseRebar: function (fullData) {
        this._evalErrs = [];                    // 수식 평가 실패 수집 → 있으면 로딩 중단
        var rows = this._extractRebarDataRows(fullData), out = [], self = this;
        rows.forEach(function (row) {
          var type = self._rbStr(row[0]).toLowerCase();
          out.push(type === 'lrebar' ? self._parseLrebarRow(row) : self._parseTrebarRow(row));
        });
        // id 중복 검사 — 중복이면 철근 로딩 중단 (결과는 로딩 토스트가 표시. 빈 id 는 검사 제외)
        var seen = {}, dups = [];
        out.forEach(function (o) {
          var k = String(o.id == null ? '' : o.id).trim().toLowerCase();
          if (!k) return;
          if (seen[k] && dups.indexOf(seen[k]) < 0) dups.push(seen[k]);
          seen[k] = seen[k] || o.id;
        });
        this._dupIds = dups;
        if (this._evalErrs.length) {
          console.error('[PSCBOX] 철근 수식 오류 — 철근 로딩 중단: ' + this._evalErrs.join(' / '));
          return [];
        }
        if (dups.length) {
          console.error('[PSCBOX] 철근 id 중복: ' + dups.join(', ') + ' — 철근 로딩 중단');
          return [];
        }
        return out;
      },

      _parseTrebarRow: function (row) {
        var o = { type: 'trebar', id: this._rbStr(row[1]) };
        this._rbCurId = o.id;
        if (this._rbHas(row[2])) o.code = TrebarFactory.normCode(row[2]);   // '23a' → 23.1
        if (this._rbHas(row[3])) o.dia = this._rbNum(row[3]);
        var init = this._rbInit(row[4], ['x', 'y', 'rot']); if (init) o.init = init;
        var segs = this._rbSegs(row[6], row[5]); if (segs) o.segs = segs;
        var angs = this._rbAngs(row[7]); if (angs) o.angs = angs;
        var nors = this._rbNors(row[8]); if (nors) o.nors = nors;
        var be = {}, bs = this._rbEnd(row[9]), bee = this._rbEnd(row[10]);
        if (bs) be.start = bs; if (bee) be.end = bee;
        if (Object.keys(be).length) o.barEnds = be;
        if (this._rbHas(row[11])) o.radius = this._rbNum(row[11]);   // 굴짐반경(선택) — 없으면 dia 기본값
        o.z = this._rbHas(row[12]) ? Number(row[12]) : 0;       // z-order(층) — 미입력=0. 같은 z 끼리만 반발
        return o;
      },

      _parseLrebarRow: function (row) {
        var o = { type: 'lrebar', id: this._rbStr(row[1]), bar: {} };
        this._rbCurId = o.id;
        if (this._rbHas(row[2])) o.bar.dia = this._rbNum(row[2]);
        if (this._rbHas(row[3])) o.bar.num = this._rbNum(row[3]);
        /*  칸 차례 :  4 init(x,y,rot) · 5 range(−,+) · 6 nors · 7 ctc · 8 ctcmax ·
            9 ctcmin · 11 path · 12 z.  배치 직선을 정하는 것(init·range·nors)을 붙여
            앞에 두고, 간격 셋을 그다음에, **쓰는 일이 드문 path 는 맨 뒤**에 둔다.    */
        if (this._rbHas(row[7])) o.bar.ctc = this._rbNum(row[7]);
        if (this._rbHas(row[8])) o.bar.max = this._rbNum(row[8]);
        if (this._rbHas(row[9])) o.bar.min = this._rbNum(row[9]);
        /*  gap — 상·하 한 쌍으로 놓을 때 **둘 사이 간격**. 주면 한 줄이 철근 두 줄을
            만든다(위쪽 nors, 아래쪽 −nors). 태어날 때 이만큼 벌려 놓고 각자 제 면으로
            끌려가며, 다 풀고 나서 **간격이 이 값을 넘으면 그 짝은 버린다** — 그 자리엔
            한쪽 면이 없다는 뜻이다(복부에서는 아래쪽 철근이 하부슬래브 하면까지
            6.7 m 를 내려간다. 정상 구간은 최대 509 mm 다).                        */
        if (this._rbHas(row[10])) o.bar.gap = this._rbNum(row[10]);
        var init = this._rbInit(row[4], ['x', 'y', 'rot']); if (init) o.init = init;   // init 은 x,y,rot 만 (grav 분리)
        var range = this._rbRange(row[5]); if (range) o.range = range;
        // nors(row[6]) = 종방향 철근이 끌려갈 쪽(-1/+1). init 에 섞지 않고 별도 칸에서 읽어 엔진이 쓰는 init.grav 로 전달
        if (this._rbHas(row[6])) { if (!o.init) o.init = {}; o.init.grav = Number(row[6]); }
        var path = this._rbList(row[11]).map(function (s) { return s.toUpperCase(); });
        if (path.length) o.path = path;
        o.z = this._rbHas(row[12]) ? Number(row[12]) : 0;       // z-order(층) — 미입력=0
        return o;
      },

      _rbStr: function (v) { return String(v == null ? '' : v).trim(); },

      _rbHas: function (v) { return v != null && String(v).trim() !== ''; },

      _rbNum: function (v) {
        v = this._rbStr(v); if (v === '') return undefined;
        var n = Number(v); if (!isNaN(n)) return n;
        if (typeof Calc !== 'undefined') {                          // 산술식 (예: 6800/2) 평가. 숫자로 못 읽히면 오류
          var r = Calc.eval(v, {});
          if (r.error == null && isFinite(r.value)) return r.value;
          var where = (this._rbCurId ? this._rbCurId + '의 ' : '') + '"' + v + '"';
          if (this._evalErrs) this._evalErrs.push(where + ' (' + r.error + ')');
          console.error('[PSCBOX] 수식 평가 실패:', where, '—', r.error);
        }
        return v;
      },

      _rbList: function (v) { return this._rbStr(v).split(',').map(function (s) { return s.trim(); }).filter(function (s) { return s !== ''; }); },

      _rbKV: function (v) {
        var o = {}, self = this;
        this._rbStr(v).split(',').forEach(function (pair) {
          var m = pair.split(/[:=]/);
          if (m.length >= 2) { var k = self._rbStr(m[0]).toLowerCase(); if (k) o[k] = self._rbStr(m.slice(1).join('=')); }
        });
        return o;
      },

      _rbInit: function (cell, keys) {
        var toks = this._rbList(cell); if (!toks.length) return null;
        var o = {}, self = this;
        keys.forEach(function (k, i) { if (self._rbHas(toks[i])) o[k] = self._rbNum(toks[i]); });
        return Object.keys(o).length ? o : null;
      },

      _rbSegs: function (segsCell, setCell) {
        var kv = this._rbKV(segsCell), segs = {}, self = this;
        Object.keys(kv).forEach(function (k) { segs[k] = { len: self._rbNum(kv[k]) }; });
        var setKV = this._rbKV(setCell);
        Object.keys(setKV).forEach(function (k) { if (!segs[k]) segs[k] = {}; segs[k].set = self._rbStr(setKV[k]).toUpperCase(); });
        return Object.keys(segs).length ? segs : null;
      },

      _rbAngs: function (cell) {
        var kv = this._rbKV(cell), angs = {}, self = this;
        Object.keys(kv).forEach(function (k) { angs['r' + k] = self._rbNum(kv[k]); });
        return Object.keys(angs).length ? angs : null;
      },

      _rbNors: function (cell) {
        var kv = this._rbKV(cell), nors = {}, self = this;
        Object.keys(kv).forEach(function (k) { nors[k] = self._rbNum(kv[k]); });
        return Object.keys(nors).length ? nors : null;
      },

      _rbRange: function (cell) {
        var toks = this._rbList(cell); if (!toks.length) return null;
        var o = {};
        if (this._rbHas(toks[0])) o.min = this._rbNum(toks[0]);
        if (this._rbHas(toks[1])) o.max = this._rbNum(toks[1]);
        return Object.keys(o).length ? o : null;
      },

      _rbEnd: function (cell) {
        var toks = this._rbList(cell); if (!toks.length) return null;
        var mode = this._rbStr(toks[0]).toLowerCase(); if (!mode) return null;
        var o = {}; o[mode] = toks.length > 1 ? (Number(toks[1]) || 0) : 0; return o;
      },

      _rebarHostHTML:
        '<div class="draw-card" id="rebarRenderCard">' +
          '<div class="draw-card-header">' +
            '<div class="draw-card-title">Rebar Physics</div>' +
            '<div class="engine-ctrls">' +
              '<button type="button" class="engine-btn" onclick="PXBOX.rebarRespawn()"><i class="bi bi-arrow-counterclockwise"></i> Respawn</button>' +
              '<button type="button" class="engine-btn" id="btnPause" onclick="PXBOX.rebarPause()"><i class="bi bi-pause-fill"></i> Pause</button>' +
              '<button type="button" class="engine-btn" id="btnEngineSel" onclick="PXBOX.toggleEngine()"><i class="bi bi-cpu"></i> Solver: J-field</button>' +
              '<button type="button" class="engine-btn" onclick="PXBOX.exportDXF()"><i class="bi bi-download"></i> Export DXF</button>' +
              '<button type="button" class="engine-btn engine-btn-lite" id="btnToggleNormals" onclick="PXBOX.toggleNormals()"><i class="bi bi-arrows-angle-expand"></i> Toggle Normals</button>' +
              '<button type="button" class="engine-btn engine-btn-lite active" id="btnToggleSpawn" onclick="PXBOX.toggleSpawn()"><i class="bi bi-crosshair"></i> Toggle Spawn</button>' +
              '<button type="button" class="engine-btn engine-btn-lite" id="btnToggleNodes" onclick="PXBOX.toggleNodes()"><i class="bi bi-123"></i> Toggle Nodes (#)</button>' +
            '</div>' +
            '<div class="draw-card-desc" id="stat-grid"></div>' +
          '</div>' +
          '<div class="draw-card-body" style="padding:0;">' +
            '<div class="phys-split">' +
              '<div id="renderContainer" style="flex:1 1 0;min-width:0;aspect-ratio:16/9;height:auto;background:#41699b;border-radius:0 0 0 10px;overflow:hidden;cursor:grab;"></div>' +
              '<div class="phys-tblwrap">' +
                '<table class="px-tbl phys-tbl"><thead><tr>' +
                  '<th>ID</th><th>Code</th><th>Total</th><th>Dia</th>' +
                  '<th>a</th><th>b</th><th>c</th><th>d</th><th>e</th><th>f</th><th>ra</th><th>rb</th><th>rc</th><th>rd</th><th>re</th>' +
                  '<th></th>' +
                '</tr></thead><tbody id="physTblBody"></tbody></table>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>',

      _ensureRebarHost: function () {
        var host = document.getElementById('renderContainer');
        if (host) return host;
        var mount = document.getElementById(PXBOX._mountId);
        if (!mount) return null;
        var parent = mount.querySelector('.px-root') || mount;   // 카드 스타일(.px-root .draw-card) 적용 위치
        var wrap = document.createElement('div');
        wrap.innerHTML = this._rebarHostHTML;
        parent.appendChild(wrap.firstChild);
        return document.getElementById('renderContainer');
      },

      _fitEngineStage: function () {
        if (typeof UI === 'undefined' || !UI.stage || !UI.mainLayer) return;
        var rc = document.getElementById('renderContainer');
        if (!rc) return;
        var w = rc.clientWidth || 800, h = rc.clientHeight || Math.round((rc.clientWidth || 800) * 9 / 16);
        UI.stage.width(w); UI.stage.height(h);
        var tw = document.querySelector('.phys-tblwrap');
        if (tw) tw.style.height = h + 'px';                 // 우측 표 높이를 16:9 뷰와 동기화

        var minx = 1e18, miny = 1e18, maxx = -1e18, maxy = -1e18;
        var paths = (typeof Domain !== 'undefined' && Domain.currentSection && Domain.currentSection.displayPaths) || [];
        paths.forEach(function (p) { p.forEach(function (pt) { minx = Math.min(minx, pt.x); maxx = Math.max(maxx, pt.x); miny = Math.min(miny, pt.y); maxy = Math.max(maxy, pt.y); }); });

        UI.mainLayer.scale({ x: 1, y: -1 });          // Y 반전 (ui.js init 과 동일)
        UI.stage.position({ x: 0, y: 0 });
        if (minx > maxx) { UI.stage.scale({ x: 0.1, y: 0.1 }); UI.mainLayer.position({ x: w / 2, y: h / 2 }); }
        else {
          var bw = (maxx - minx) || 1, bh = (maxy - miny) || 1, cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
          var s = Math.min(w / bw, h / bh) * 0.85;
          UI.stage.scale({ x: s, y: s });
          UI.mainLayer.position({ x: w / (2 * s) - cx, y: h / (2 * s) + cy });
        }
        if (typeof UI.drawGrid === 'function') UI.drawGrid();
        UI.mainLayer.draw();
      },

      rebarRespawn: function () {
        var b = document.getElementById('btnPause');
        if (b) b.innerHTML = '<i class="bi bi-pause-fill"></i> Pause';
        this._drawRebar();
      },

      rebarPause: function () {
        if (typeof Domain !== 'undefined' && typeof Domain.togglePause === 'function') Domain.togglePause();
      },

      /*  ── 엔진 둘 ────────────────────────────────────────────────────────
          'jfield'   jfield.js — 목적함수 J 를 최소화한다. 한 번에 푼다(애니메이션 없음).
          'physics'  physics.js — 예전 것. 광선으로 벽을 고르고 용수철로 끌어다 붙인다.
          기본값은 J 다. 예전 것은 비교용으로 남긴다 — 버튼으로 오간다.            */
      _engine: 'jfield',

      _syncEngineBtn: function () {
        var b = document.getElementById('btnEngineSel');
        if (!b) return;
        b.innerHTML = '<i class="bi bi-cpu"></i> Solver: ' +
          (this._engine === 'jfield' ? 'J-field' : 'Physics');
      },

      toggleEngine: function () {
        this._engine = (this._engine === 'jfield') ? 'physics' : 'jfield';
        this._syncEngineBtn();
        this.rebarRespawn();
      },

      /*  ── J 들여다보기 ────────────────────────────────────────────────
          표의 철근번호를 누르면 그 철근의 **J 가 어떻게 정해지고 어떻게 내려갔는지**
          를 창으로 보여 준다. 논문 그림이 그대로 나오도록 만든 자리다.
          푸는 것은 건드리지 않는다 — 그 철근만 다시 풀어(나머지는 놓인 그대로
          척력으로만) 과정을 받아 적고, 화면의 형상은 그대로 둔다.               */
      _jAnalyze: function (id) {
        if (typeof JField === 'undefined' || typeof Domain === 'undefined') return null;
        var sec = Domain.currentSection;
        if (!sec || !sec.walls || !sec.walls.length) return null;
        var rd = null;
        (this._rebarData || []).forEach(function (d) { if (String(d.id) === String(id)) rd = d; });
        if (!rd || String(rd.type || 'trebar').toLowerCase() !== 'trebar') return null;
        var nb = null;
        try { nb = Domain._createTrebarFromData(rd); } catch (e) { return null; }
        if (!nb || !nb.segments || !nb.segments.length) return null;

        /*  척력으로 넘길 철근은 **이 철근보다 먼저 놓인 것들만**이다.
            「나머지 전부」를 넘기면 창에 뜨는 J 가 화면의 형상을 만든 J 와 **다른
            문제**가 된다 — 뒤에 놓인 철근까지 밀고 있으니 최소점이 딴 데 생기고,
            창의 숫자와 그림이 어긋난다(①-1 이 피복선에서 19 mm 밖인데 J 는 안쪽
            10 mm 가 더 낮다고 나왔다). 엔진이 푼 순서를 그대로 되짚는다.        */
        var placed = [], hit = false;
        Domain.trebarList.forEach(function (t) {
          if (String(t.id) === String(id)) { hit = true; return; }
          if (hit) return;                       // 이 철근보다 뒤에 놓인 것은 안 본다
          (t.segments || []).forEach(function (sg) {
            placed.push({ p1: { x: sg.p1.x, y: sg.p1.y }, p2: { x: sg.p2.x, y: sg.p2.y }, dia: t.dia || 13 });
          });
        });

        var dia = nb.dia || 13;
        var bar = { id: String(nb.id), dia: dia, segs: nb.segments.map(function (sg) {
          return { label: sg.label, p1: { x: sg.p1.x, y: sg.p1.y }, p2: { x: sg.p2.x, y: sg.p2.y },
                   normal: { x: sg.normal.x, y: sg.normal.y } };
        }) };

        var r = null, trace = [];
        JField.TRACE = [];
        try { r = JField.form(bar, sec.walls, sec, this._ducts || [], placed); }
        catch (e) { console.error('[PSCBOX] J 분석:', e); }
        trace = JField.TRACE || []; JField.TRACE = null;
        if (!r) return null;

        var ducts = this._ducts || [];
        //  태어난 자리 판정 — `bar` 는 방금 입력에서 다시 만든 것이라 **스폰 상태**다
        var diag = this._seatDiag(bar, sec);
        var out = { id: String(id), dia: dia, pts: r.pts, pass: r.pass, placed: placed, ducts: ducts, segs: [] };
        r.segs.forEach(function (rs, i) {
          var p = r.pts[i], q = r.pts[i + 1];
          var th = Math.atan2(q.y - p.y, q.x - p.x);
          var mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
          var seg = { label: rs.label, len: Math.hypot(q.x - p.x, q.y - p.y) || 1, dia: dia,
                      n0: bar.segs[i].normal, p1: p, p2: q, mid: mid, c0: mid, th0: th };
          var cons = JField.targets(seg, sec.walls, sec, dia);
          var pose = { cx: mid.x, cy: mid.y, th: th };
          var assign = cons.length ? JField.assignOf(pose, seg, cons) : null;
          var ip = bar.segs[i];
          out.segs.push({
            label: rs.label, seg: seg, cons: cons, pose: pose, assign: assign,
            init: { p1: ip.p1, p2: ip.p2, mid: { x: (ip.p1.x + ip.p2.x) / 2, y: (ip.p1.y + ip.p2.y) / 2 } },
            parts: cons.length ? JField.energyParts(pose, seg, cons, ducts, placed, assign) : null,
            contacts: rs.contacts || [], rest: rs.rest || [], len: rs.len, len0: rs.len0,
            iter: rs.iter, stopped: rs.stopped || null, diag: diag[i] || null,
            trace: trace.filter(function (t) { return t.seg === rs.label; })
          });
        });
        return out;
      },

      //  ── J 창 ────────────────────────────────────────────────────────
      _jSeg: 0,

      openJ: function (id) {
        this.focusRebar(id);                       // 형상도 같이 강조
        this._jId = String(id); this._jSeg = 0;
        this._jData = this._jAnalyze(id);
        this._jRender();
      },

      closeJ: function () {
        var m = document.getElementById('pxJModal');
        if (m) m.style.display = 'none';
      },

      pickJSeg: function (i) { this._jSeg = Number(i) || 0; this._jRender(); },

      _jHost: function () {
        var m = document.getElementById('pxJModal');
        if (m) return m;
        m = document.createElement('div');
        m.id = 'pxJModal';
        m.style.cssText = 'position:fixed;inset:0;z-index:9999;display:none;' +
          'background:rgba(15,23,42,.45);align-items:center;justify-content:center;padding:24px;';
        m.addEventListener('click', function (e) { if (e.target === m) m.style.display = 'none'; });
        var st = document.createElement('style');
        st.textContent =
          '#pxJModal .jbox{background:#fff;border-radius:12px;max-width:720px;width:100%;max-height:90vh;' +
          'overflow:auto;box-shadow:0 20px 50px rgba(15,23,42,.35);}' +
          '#pxJModal .jhd{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #e2e8f0;' +
          'position:sticky;top:0;background:#fff;border-radius:12px 12px 0 0;}' +
          '#pxJModal .jttl{font-weight:800;font-size:15px;color:#0f172a;}' +
          '#pxJModal .jtab{border:1px solid #cbd5e1;background:#f8fafc;border-radius:6px;padding:3px 10px;' +
          'font-size:12px;font-weight:700;color:#475569;cursor:pointer;}' +
          '#pxJModal .jtab.on{background:#1d4ed8;border-color:#1d4ed8;color:#fff;}' +
          '#pxJModal .jx{margin-left:auto;border:0;background:#f1f5f9;border-radius:6px;padding:4px 10px;cursor:pointer;font-weight:700;color:#475569;}' +
          '#pxJModal .jbody{padding:14px 16px 18px;}' +
          '#pxJModal .jrow{display:flex;gap:14px;flex-wrap:wrap;}' +
          '#pxJModal .jcap{font-size:11px;font-weight:700;color:#64748b;margin:0 0 4px;}' +
          '#pxJModal .jsvg{border:1px solid #e2e8f0;border-radius:8px;background:#fff;display:block;}' +
          '#pxJModal .jnote{font-size:12px;color:#b45309;padding:10px;background:#fffbeb;border-radius:8px;}' +
          '#pxJModal table.jt{border-collapse:collapse;font-size:12px;margin-top:12px;width:100%;}' +
          '#pxJModal table.jt th,#pxJModal table.jt td{border:1px solid #e2e8f0;padding:4px 8px;text-align:right;}' +
          '#pxJModal table.jt th{background:#f8fafc;color:#475569;font-weight:700;}' +
          '#pxJModal table.jt td:first-child,#pxJModal table.jt th:first-child{text-align:left;}' +
          '#pxJModal .jsw{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:-1px;}';
        m.appendChild(st);
        var box = document.createElement('div');
        box.className = 'jbox'; box.id = 'pxJBox';
        m.appendChild(box);
        document.body.appendChild(m);
        return m;
      },

      _jRender: function () {
        var m = this._jHost(); if (!m) return;
        var box = document.getElementById('pxJBox'); if (!box) return;
        var d = this._jData, self = this;
        m.style.display = 'flex';
        if (!d) {
          box.innerHTML = '<div class="jhd"><span class="jttl">J</span>' +
            '<button class="jx" onclick="PXBOX.closeJ()">닫기</button></div>' +
            '<div class="jbody"><div class="jnote">이 철근의 J 를 볼 수 없습니다. ' +
            'Solver 가 J-field 인지, trebar 행인지 확인하세요.</div></div>';
          return;
        }
        var i = Math.max(0, Math.min(this._jSeg, d.segs.length - 1));
        var sd = d.segs[i], hue = this._J_HUE;
        var f2 = function (v) { return (v == null || !isFinite(v)) ? '—' : (Math.round(v * 100) / 100).toString(); };

        var h = '<div class="jhd"><span class="jttl">' + this._esc(d.id) + ' · D' + d.dia + '</span>';
        d.segs.forEach(function (sg, k) {
          h += '<button class="jtab' + (k === i ? ' on' : '') + '" onclick="PXBOX.pickJSeg(' + k + ')">조각 ' + self._esc(sg.label) + '</button>';
        });
        h += '<button class="jx" onclick="PXBOX.closeJ()">닫기</button></div><div class="jbody">';

        h += '<div class="jrow">' +
          '<div><div class="jcap">① J 의 지형 — 바탕색 = 그 자리에서 가장 가까운 면, 진할수록 J 가 낮다</div>' +
          this._jFieldSvg(sd, d.ducts, d.placed) + '</div>' +
          '<div><div class="jcap">② 수렴 이력 — 세로는 log, 판이 바뀌는 자리는 세로 점선</div>' +
          this._jTraceSvg(sd.trace) + '</div></div>';

        /*  ── 태어난 자리 ────────────────────────────────────────────────────
            **입력을 고치는 자리**다. 결과 J 는 「어디에 앉았나」를 말하지만, 왜 그
            면을 골랐는지는 태어난 자리에서 무엇이 보였는지에 달려 있다. 버린 면까지
            거리와 이유를 같이 적는다 — **가장 가까운 면이 후보에 못 들어왔으면**
            그 조각은 입력이 모자란 것이다(⑧-1 의 400 mm 다리 : E18 72 mm 가 50 mm
            차이로 빠지고 5,781 mm 위의 E1 이 쓰였다).                            */
        var dg = sd.diag;
        if (dg) {
          h += '<div class="jcap">③ 태어난 자리 — 입력이 놓은 자리와, 그 자리에서 마주보던 면들</div>';
          h += '<table class="jt"><thead><tr><th>태어난 자리</th><th>p1</th><th>p2</th>' +
               '<th>길이</th><th>법선</th><th>가장 가까운 후보</th></tr></thead><tbody><tr>' +
               '<td>조각 ' + this._esc(dg.label) + '</td>' +
               '<td>' + Math.round(dg.p1.x) + ', ' + Math.round(dg.p1.y) + '</td>' +
               '<td>' + Math.round(dg.p2.x) + ', ' + Math.round(dg.p2.y) + '</td>' +
               '<td>' + Math.round(dg.len) + '</td>' +
               '<td>' + f2(dg.n.x) + ', ' + f2(dg.n.y) + '</td>' +
               '<td>' + (dg.reach == null ? '<span style="color:#b45309;">없음</span>' : Math.round(dg.reach) + ' mm') + '</td>' +
               '</tr></tbody></table>';
          if (dg.none) {
            h += '<div class="jnote" style="color:#b45309;">이 조각의 법선 방향에 <b>마주보는 콘크리트 면이 없습니다.</b> ' +
                 '법선(nors)이나 태어난 자리를 보세요 — 엔진은 자리를 지어내지 않고 태어난 자리에 그대로 둡니다.</div>';
          } else if (dg.miss) {
            h += '<div class="jnote" style="color:#b45309;"><b>가장 가까운 면이 후보에 못 들어왔습니다.</b> ' +
                 this._esc(dg.miss.near.id) + ' 가 ' + Math.round(dg.miss.near.d) + ' mm 로 가장 가깝지만 ' +
                 '조각의 축 범위에서 ' + Math.round(dg.miss.near.gap) + ' mm 벗어나 있어 빠졌고, ' +
                 this._esc(dg.miss.seat.id) + ' (' + Math.round(dg.miss.seat.d) + ' mm) 가 쓰였습니다. ' +
                 '엔진은 규칙대로 움직입니다 — <b>입력 길이(segs)나 태어난 자리를 고쳐야 하는 자리입니다.</b></div>';
          }
          h += '<table class="jt"><thead><tr><th>태어난 자리에서 마주보던 면</th><th>tag</th>' +
               '<th>참거리 (mm)</th><th>조각이 면 위에</th><th>띠 모자람 (mm)</th><th>후보로 씀</th></tr></thead><tbody>';
          if (!dg.seats.length) {
            h += '<tr><td colspan="6" style="text-align:center;color:#b45309;">마주보는 면이 하나도 없습니다</td></tr>';
          } else {
            dg.seats.forEach(function (c) {
              h += '<tr' + (c.used ? '' : ' style="opacity:.55;"') + '>' +
                   '<td>' + self._esc(c.id) + '</td><td>' + self._esc(c.tag || '') + '</td>' +
                   '<td>' + Math.round(c.d) + '</td><td>' + (c.band ? '●' : '') + '</td>' +
                   '<td>' + (c.gap > 0 ? Math.round(c.gap) : '') + '</td>' +
                   '<td>' + (c.used ? '●' : '<span style="color:#94a3b8;">버림</span>') + '</td></tr>';
            });
          }
          h += '</tbody></table>';
        }

        //  후보 면 표 — 「고른 것」이 아니라 「결과로 읽은 것」
        h += '<table class="jt"><thead><tr><th>후보 면</th><th>tag</th><th>요구 피복+D/2</th>' +
             '<th>여유 g (mm)</th><th>접촉</th><th>승수 λ</th></tr></thead><tbody>';
        if (!sd.cons.length) {
          h += '<tr><td colspan="6" style="text-align:center;color:#b45309;">붙을 면 없음 — 이 조각은 안착하지 못했습니다</td></tr>';
        } else {
          var half = sd.seg.len / 2;
          var dx = Math.cos(sd.pose.th) * half, dy = Math.sin(sd.pose.th) * half;
          var ep = [{ x: sd.pose.cx - dx, y: sd.pose.cy - dy }, { x: sd.pose.cx + dx, y: sd.pose.cy + dy }];
          sd.cons.forEach(function (c, k) {
            var g = Math.min(JField.slack(ep[0].x, ep[0].y, c), JField.slack(ep[1].x, ep[1].y, c));
            var ct = (sd.contacts || []).filter(function (x) { return x.id === c.w.id; })[0];
            h += '<tr><td><span class="jsw" style="background:hsl(' + hue[k % hue.length] + ',62%,55%)"></span>' +
                 self._esc(c.w.id) + '</td><td>' + self._esc(c.w.tag || '') + '</td><td>' + f2(c.need) + '</td>' +
                 '<td>' + f2(g) + '</td><td>' + (ct ? '●' : '') + '</td><td>' + (ct ? f2(ct.lam) : '') + '</td></tr>';
          });
        }
        h += '</tbody></table>';

        //  항별 분해
        var p = sd.parts;
        h += '<table class="jt"><thead><tr><th>J 의 항</th><th>피복</th><th>덕트</th><th>기존 철근</th>' +
             '<th>제자리 고정</th><th>합</th></tr></thead><tbody><tr><td>최종 자세에서</td>' +
             '<td>' + f2(p && p.cover) + '</td><td>' + f2(p && p.duct) + '</td><td>' + f2(p && p.bar) + '</td>' +
             '<td>' + f2(p && p.anchor) + '</td><td><b>' + f2(p && p.total) + '</b></td></tr></tbody></table>';

        h += '<table class="jt"><thead><tr><th>조각 ' + this._esc(sd.label) + '</th><th>입력 길이</th><th>출력 길이</th>' +
             '<th>안착 면</th><th>반복</th><th>판</th></tr></thead><tbody><tr><td>결과</td>' +
             '<td>' + f2(sd.len0) + '</td><td>' + f2(sd.len) + '</td><td>' + this._esc((sd.rest[0] || '없음')) + '</td>' +
             '<td>' + sd.iter + '</td><td>' + d.pass + '</td></tr></tbody></table>';

        h += '</div>';
        box.innerHTML = h;
      },

      //  후보 면마다 색 하나 — 지형 그림과 범례가 같은 색을 쓴다
      _J_HUE: [210, 28, 140, 275, 45, 320, 170, 0],

      /*  ① J 의 지형 — 자세를 (cx, cy) 격자로 훑어 J 를 뜬다.
          바탕색 = **그 자리에서 어느 면이 가장 가까운가**(min 이 고른 면).
          진하기 = J 의 크기(log). 그래서 「마주보는 벽이 여럿인데 왜 이것인가」가
          규칙 설명 없이 그림으로 끝난다. init 에서 최종까지 화살표도 같이 그린다. */
      _jFieldSvg: function (sd, ducts, placed) {
        if (!sd.cons.length) return '<div class="jnote">붙을 면을 찾지 못해 지형을 그릴 수 없습니다.</div>';
        var S = sd.seg, cons = sd.cons, pose = sd.pose, hue = this._J_HUE;
        var i0 = sd.init.mid;
        var travel = Math.hypot(pose.cx - i0.x, pose.cy - i0.y);
        var half = Math.max(240, travel * 0.72 + 200);
        var cx0 = (pose.cx + i0.x) / 2, cy0 = (pose.cy + i0.y) / 2;
        var W = 300, H = 230, NX = 40, NY = 31;
        var ratio = H / W, hy = half * ratio;
        var sx = function (x) { return (x - (cx0 - half)) / (2 * half) * W; };
        var sy = function (y) { return H - (y - (cy0 - hy)) / (2 * hy) * H; };   // 엔진 y-up → svg y-down

        //  격자 훑기
        var cell = [], lo = 1e18, hi = -1e18;
        for (var iy = 0; iy < NY; iy++) {
          for (var ix = 0; ix < NX; ix++) {
            var gx = cx0 - half + (2 * half) * (ix + 0.5) / NX;
            var gy = cy0 - hy + (2 * hy) * (iy + 0.5) / NY;
            var pp = { cx: gx, cy: gy, th: pose.th };
            var as = JField.assignOf(pp, S, cons);
            var Jv = JField.energy(pp, S, cons, ducts, placed, as);
            var lg = Math.log10(1 + Math.max(0, Jv));
            if (lg < lo) lo = lg; if (lg > hi) hi = lg;
            cell.push({ ix: ix, iy: iy, w: as[0], J: lg });
          }
        }
        var span = (hi - lo) || 1;
        var g = '';
        var cw = W / NX + 0.6, ch = H / NY + 0.6;
        cell.forEach(function (c) {
          var t = (c.J - lo) / span;                       // 0 = 바닥, 1 = 멀다
          var h = hue[c.w % hue.length];
          var L = 42 + 50 * t, Sa = 62 - 34 * t;
          g += '<rect x="' + (c.ix * W / NX).toFixed(1) + '" y="' + (H - (c.iy + 1) * H / NY).toFixed(1) +
               '" width="' + cw.toFixed(1) + '" height="' + ch.toFixed(1) +
               '" fill="hsl(' + h + ',' + Sa.toFixed(0) + '%,' + L.toFixed(0) + '%)"/>';
        });

        //  후보 면의 피복선 (점선)
        cons.forEach(function (c, i) {
          var w = c.w, n = c.need;
          var x1 = w.x1 + w.nx * n, y1 = w.y1 + w.ny * n, x2 = w.x2 + w.nx * n, y2 = w.y2 + w.ny * n;
          g += '<line x1="' + sx(x1).toFixed(1) + '" y1="' + sy(y1).toFixed(1) +
               '" x2="' + sx(x2).toFixed(1) + '" y2="' + sy(y2).toFixed(1) +
               '" stroke="hsl(' + hue[i % hue.length] + ',80%,25%)" stroke-width="1.6" stroke-dasharray="5 3"/>';
        });

        //  init 조각(회색) → 최종 조각(파랑)
        function segLine(a, b, col, wd, op) {
          return '<line x1="' + sx(a.x).toFixed(1) + '" y1="' + sy(a.y).toFixed(1) +
                 '" x2="' + sx(b.x).toFixed(1) + '" y2="' + sy(b.y).toFixed(1) +
                 '" stroke="' + col + '" stroke-width="' + wd + '" stroke-linecap="round" opacity="' + op + '"/>';
        }
        g += segLine(sd.init.p1, sd.init.p2, '#e2e8f0', 3, 0.95);
        g += segLine(S.p1, S.p2, '#0f172a', 3.4, 1);
        g += '<circle cx="' + sx(i0.x).toFixed(1) + '" cy="' + sy(i0.y).toFixed(1) + '" r="3.6" fill="#e2e8f0" stroke="#475569" stroke-width="1"/>';
        g += '<circle cx="' + sx(pose.cx).toFixed(1) + '" cy="' + sy(pose.cy).toFixed(1) + '" r="4.2" fill="#f8fafc" stroke="#0f172a" stroke-width="2"/>';
        if (travel > 30) {
          g += '<line x1="' + sx(i0.x).toFixed(1) + '" y1="' + sy(i0.y).toFixed(1) +
               '" x2="' + sx(pose.cx).toFixed(1) + '" y2="' + sy(pose.cy).toFixed(1) +
               '" stroke="#0f172a" stroke-width="1.2" stroke-dasharray="3 3" opacity="0.8"/>';
        }
        return '<svg class="jsvg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' + g + '</svg>';
      },

      /*  ② 수렴 이력 — 반복마다의 J (세로는 log). 1단계(콘크리트만)와
          2단계(덕트·철근까지)를 색으로 나눈다. 판이 바뀌는 자리는 세로선.      */
      _jTraceSvg: function (tr) {
        var pts = (tr || []).filter(function (r) { return r.ok; });
        if (pts.length < 2) return '<div class="jnote">기록된 반복이 없습니다.</div>';
        var W = 300, H = 230, PL = 34, PB = 20, PT = 10, PR = 8;
        var lo = 1e18, hi = -1e18;
        pts.forEach(function (r) { var v = Math.log10(1 + Math.max(0, r.J)); if (v < lo) lo = v; if (v > hi) hi = v; });
        if (hi - lo < 1e-9) { hi = lo + 1; }
        var n = pts.length;
        var X = function (i) { return PL + (W - PL - PR) * (n < 2 ? 0 : i / (n - 1)); };
        var Y = function (v) { return PT + (H - PT - PB) * (1 - (Math.log10(1 + Math.max(0, v)) - lo) / (hi - lo)); };
        var g = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#fbfdff"/>';
        //  가로 눈금 (10 의 거듭제곱)
        for (var e = Math.ceil(lo); e <= Math.floor(hi); e++) {
          var yy = PT + (H - PT - PB) * (1 - (e - lo) / (hi - lo));
          g += '<line x1="' + PL + '" y1="' + yy.toFixed(1) + '" x2="' + (W - PR) + '" y2="' + yy.toFixed(1) + '" stroke="#e2e8f0" stroke-width="1"/>';
          g += '<text x="' + (PL - 4) + '" y="' + (yy + 3).toFixed(1) + '" font-size="9" fill="#94a3b8" text-anchor="end">1e' + e + '</text>';
        }
        //  판이 바뀌는 자리
        var prevPass = pts[0].pass;
        pts.forEach(function (r, i) {
          if (r.pass !== prevPass) {
            g += '<line x1="' + X(i).toFixed(1) + '" y1="' + PT + '" x2="' + X(i).toFixed(1) + '" y2="' + (H - PB) + '" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="2 3"/>';
            prevPass = r.pass;
          }
        });
        //  선 (단계별 색)
        var seg1 = '', seg2 = '';
        pts.forEach(function (r, i) {
          var cmd = (i === 0 ? 'M' : 'L') + X(i).toFixed(1) + ' ' + Y(r.J).toFixed(1);
          if (r.stage === 1) seg1 += cmd; else seg2 += cmd;
        });
        pts.forEach(function (r, i) {
          if (i === 0) return;
          var col = r.stage === 1 ? '#2563eb' : '#f59e0b';
          g += '<line x1="' + X(i - 1).toFixed(1) + '" y1="' + Y(pts[i - 1].J).toFixed(1) +
               '" x2="' + X(i).toFixed(1) + '" y2="' + Y(r.J).toFixed(1) +
               '" stroke="' + col + '" stroke-width="1.8" stroke-linecap="round"/>';
        });
        g += '<text x="' + (W - PR) + '" y="' + (H - 6) + '" font-size="9" fill="#94a3b8" text-anchor="end">반복 ' + n + ' 회</text>';
        g += '<text x="' + PL + '" y="' + (H - 6) + '" font-size="9" fill="#2563eb">■ 1단계(콘크리트)</text>';
        g += '<text x="' + (PL + 96) + '" y="' + (H - 6) + '" font-size="9" fill="#d97706">■ 2단계(덕트·철근)</text>';
        return '<svg class="jsvg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' + g + '</svg>';
      },

      /*  철근 하나만 다시 푼다 — 입력 행을 다시 읽어 그 자리에서 스폰하고,
          나머지 철근은 **놓인 그대로** 척력으로 본다.
          입력을 고친 뒤 그 철근만 확인할 때 쓴다.                                */
      _resolveOneWithJField: function (id) {
        if (typeof JField === 'undefined') return;
        var sec = Domain.currentSection;
        if (!sec || !sec.walls || !sec.walls.length) return;
        var rd = null;
        (this._rebarData || []).forEach(function (d) { if (String(d.id) === String(id)) rd = d; });
        if (!rd) return;
        /*  종방향 철근은 **무리**가 한 덩어리라 하나만 다시 풀 수 없다(간격이 이웃을
            묶는다). 그래서 lrebar 를 누르면 종방향 전체를 다시 푼다 — 횡방향은 놓인
            자리에 그대로 두고 그 장애물 위에서 다시 배치하는 것이라 뜻이 분명하다.  */
        if (String(rd.type || 'trebar').toLowerCase() === 'lrebar') {
          var lw = this._solveLrebarWithJ(sec);
          this._finalizeArcs();
          this._toast(lw.length ? lw.join(' · ') : ('다시 배치했습니다: ' + id),
                      lw.length ? 'err' : 'ok');
          return;
        }

        var nb;
        try { nb = Domain._createTrebarFromData(rd); }
        catch (e) { console.error('[PSCBOX] respawn:', id, e); return; }
        if (!nb) { this._toast('철근을 다시 만들지 못했습니다: ' + id, 'err'); return; }

        var bar = { id: String(nb.id), dia: nb.dia || 13,
          segs: (nb.segments || []).map(function (s) {
            return { label: s.label, p1: { x: s.p1.x, y: s.p1.y }, p2: { x: s.p2.x, y: s.p2.y },
                     normal: { x: s.normal.x, y: s.normal.y } };
          }) };

        //  태어난 자리 진단도 이 철근만 다시 잡는다 (표의 ⚠ 와 J 창이 읽는다)
        this._diag = this._diag || {};
        this._diag[String(bar.id)] = this._seatDiag(bar, sec);

        /*  ── 태어난 자리를 **먼저 보여 준다** ───────────────────────────────
            Respawn 을 누르는 이유가 대개 「init 을 어디에 놓았나」를 보려는 것이다.
            그런데 J 는 한 번에 풀어 버려서, 곧장 답으로 건너뛰면 그 자리가 화면에
            한 번도 안 나온다. 전체 풀이(_drawRebar)는 이미 SPAWN_HOLD 만큼 스폰
            상태를 그려 두는데, **철근 하나만 다시 풀 때는 그 대기가 없었다.**
            그래서 여기서도 같은 차례로 한다 :
              ㉠ 스폰 상태의 철근을 목록에 꽂고 그대로 한 번 그린다 (직선 토막들)
              ㉡ 태어난 자리 유령(점선)도 이 철근 것만 새로 잡는다
              ㉢ SPAWN_HOLD 뒤에 풀어서 최종 형상으로 바꾼다                     */
        for (var i = 0; i < Domain.trebarList.length; i++)
          if (String(Domain.trebarList[i].id) === String(id)) { Domain.trebarList[i] = nb; break; }
        if (i >= Domain.trebarList.length) Domain.trebarList.push(nb);

        var spts = [];
        (nb.segments || []).forEach(function (sg, k) {
          if (k === 0) spts.push({ x: sg.p1.x, y: sg.p1.y });
          spts.push({ x: sg.p2.x, y: sg.p2.y });
        });
        this._spawn = (this._spawn || []).filter(function (sp) { return String(sp.id) !== String(id); });
        this._spawn.push({ id: String(nb.id), dia: nb.dia || 13, pts: spts });

        //  어느 것을 다시 푸는지 눈에 띄게 — 유령도 진해진다.
        //  focusRebar() 는 **토글**이라 안 쓴다 (이미 고른 것을 누르면 풀려 버린다).
        this._focusId = String(id);
        this._finalizeArcs();         // ㉠㉡ 스폰 상태로 한 번 그린다
        this._toast('태어난 자리: ' + id, 'ok');

        var self = this;
        setTimeout(function () { self._formOneWithJField(id, nb, bar, sec); }, this.SPAWN_HOLD);
      },

      /*  ㉢ 실제로 푸는 자리. _resolveOneWithJField 가 SPAWN_HOLD 뒤에 부른다.
          `bar`(태어난 자리의 조각들)는 거기서 만든 것을 그대로 받는다 — 두 군데서
          따로 만들면 언젠가 조용히 달라진다.                                    */
      _formOneWithJField: function (id, nb, bar, sec) {
        //  나머지 철근을 척력으로 넘긴다 (이 철근은 뺀다)
        var placed = [];
        Domain.trebarList.forEach(function (t) {
          if (String(t.id) === String(id)) return;
          (t.segments || []).forEach(function (s) {
            placed.push({ p1: { x: s.p1.x, y: s.p1.y }, p2: { x: s.p2.x, y: s.p2.y }, dia: t.dia || 13 });
          });
        });

        var r;
        try { r = JField.form(bar, sec.walls, sec, this._ducts || [], placed); }
        catch (e) { console.error('[PSCBOX] J-field form:', e); return; }

        this._writeBack(nb, r, sec);
        this._finalizeArcs();
        var wm = this._diagWarn(id);
        this._toast('다시 풀었습니다: ' + id + ' — 길이 ' + Math.round(r.len) + ' mm' +
                    (wm ? ' · ⚠ ' + wm.split('\n')[0] : ''), wm ? 'err' : 'ok');
      },

      //  J 결과를 trebar 객체에 써 넣는다 (표·DXF·굴짐 아크가 읽는 자리 그대로)
      _writeBack: function (t, r, sec) {
        var NP = (typeof CONFIG !== 'undefined' && CONFIG.PHYSICS && CONFIG.PHYSICS.NODE_POS) || [0.4, 0.6];
        var wallById = {};
        (sec.walls || []).forEach(function (w) { wallById[w.id] = w; });
        r.segs.forEach(function (rs, i) {
          var seg = t.segments[i];
          if (!seg) return;
          var a = r.pts[i], b = r.pts[i + 1];
          seg.p1 = { x: a.x, y: a.y };
          seg.p2 = { x: b.x, y: b.y };
          var dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
          seg.uDir = { x: dx / L, y: dy / L };
          seg.nodes = NP.map(function (k) { return { x: a.x + dx * k, y: a.y + dy * k, vx: 0, vy: 0 }; });
          seg.fitWall = wallById[(rs.rest && rs.rest[0]) || ''] || null;
          seg.contactWall = seg.fitWall;
          seg.state = rs.stopped === 'no-target' ? 'FITTING' : 'SETTLED';
        });
        t.state = r.segs.every(function (s) { return s.stopped !== 'no-target'; }) ? 'FORMED' : 'ASSEMBLING';
        console.log('[JFIELD] ' + r.id + ' 길이 ' + Math.round(r.len) + '  세그[' +
          r.segs.map(function (s) {
            return s.label + '=' + ((s.rest && s.rest[0]) || '없음') + '(' + Math.round(s.len) + ')';
          }).join(', ') + ']');
      },

      /*  ── 태어난 자리를 **읽을 수 있게** 만든다 ─────────────────────────────
          J 는 한 번에 풀어 버린다. 그래서 화면에는 **결과만** 남고, 그 결과가
          「입력이 이상해서 그렇게 된 것」인지 「엔진이 이상해서 그렇게 된 것」인지가
          구별되지 않는다. 실제로 ⑧-1 의 다리가 캔틸레버 선단에 붙은 일이 있었는데,
          원인은 **기본값 400 mm 다리가 복부 밑에서 끝나서 제 면(하부슬래브 상면) 위로
          나오지 못한 것**이었다 — 띠가 50 mm 모자랐다. 그것을 보려면 태어난 자리에서
          **무엇이 보였는지**를 봐야 한다. 그래서 여기서 그 판정을 그대로 꺼낸다.

          `JField.seats()` 는 버린 면까지 다 돌려준다. 조각마다 :
            seats  { id, tag, d(참거리), band(조각이 그 면 위에 있나), gap(띠가 모자란
                     거리), used(후보로 살아남았나), need }
            none   후보가 하나도 없다 — 이 조각은 안착하지 못한다
            miss   **가장 가까운 면이 후보에 못 들어왔다.** { near, seat } 로 둘을 같이
                   준다 — 그 면이 왜 빠졌는지는 `gap`(띠가 모자란 거리)이 말한다.
                   이것이 ⑧-1 을 잡아내는 값이다 : 기본값 400 mm 다리에서
                   E18 이 72 mm 로 가장 가까운데 띠가 50 mm 모자라 빠지고,
                   5,781 mm 위의 E1 이 쓰였다.
            reach  쓰인 후보까지의 참거리 (mm). **크다고 잘못된 것이 아니다** —
                   ㄷ자 스터럽의 다리는 길이를 안 주면 3.2 m 를 가서 하면에 앉는다.
                   그래서 거리로 경고하지 않는다. 경고는 `none` 과 `miss` 뿐이다.    */
      _seatDiag: function (bar, sec) {
        if (typeof JField === 'undefined' || !bar || !sec || !sec.walls) return [];
        var dia = bar.dia || 13;
        return (bar.segs || []).map(function (s) {
          var vx = s.p2.x - s.p1.x, vy = s.p2.y - s.p1.y;
          var len = Math.hypot(vx, vy) || 1;
          var mid = { x: (s.p1.x + s.p2.x) / 2, y: (s.p1.y + s.p2.y) / 2 };
          var seg = { label: s.label, len: len, dia: dia, n0: s.normal,
                      p1: s.p1, p2: s.p2, mid: mid, c0: mid, th0: Math.atan2(vy, vx) };
          var st = JField.seats(seg, sec.walls, sec, dia).map(function (c) {
            return { id: c.w.id, tag: c.w.tag, d: c.d, band: c.band, gap: c.gap,
                     used: c.used, need: c.need };
          }).sort(function (a, b) { return a.d - b.d; });
          var use = st.filter(function (c) { return c.used; });
          //  st 는 참거리 오름차순이므로 st[0] 가 가장 가까운 면, use[0] 가 쓰인 면
          var miss = (use.length && st.length && st[0].id !== use[0].id) ?
                     { near: st[0], seat: use[0] } : null;
          return { label: s.label, p1: s.p1, p2: s.p2, mid: mid, len: len, n: s.normal,
                   seats: st, none: use.length === 0, miss: miss,
                   reach: use.length ? use[0].d : null };
        });
      },

      //  표에 띄울 한 줄 경고. 없으면 null — 있을 때만 ⚠ 를 붙인다.
      _diagWarn: function (id) {
        var ds = (this._diag || {})[String(id)];
        if (!ds || !ds.length) return null;
        var msg = [];
        ds.forEach(function (d) {
          if (d.none) msg.push('조각 ' + d.label + ' : 마주보는 면이 없다 — 법선 방향에 콘크리트 면이 없습니다');
          else if (d.miss) msg.push('조각 ' + d.label + ' : 가장 가까운 ' + d.miss.near.id + ' (' +
                                    Math.round(d.miss.near.d) + ' mm) 가 조각 밖이라 빠지고, ' +
                                    d.miss.seat.id + ' (' + Math.round(d.miss.seat.d) + ' mm) 가 쓰였습니다 — ' +
                                    '조각이 ' + Math.round(d.miss.near.gap) + ' mm 모자랍니다');
        });
        return msg.length ? msg.join('\n') : null;
      },

      /*  J 엔진으로 한 번에 푼다.
          스폰된 철근(Domain.trebarList)의 조각을 그대로 넘기고, 돌아온 폴리라인을
          같은 객체에 써 넣는다 — 표·DXF·굴짐 아크는 전부 그대로 쓴다.
          trebar 는 큐에서 뺀다(이미 풀렸다). lrebar 는 아직 예전 엔진이 맡는다.    */
      _solveWithJField: function () {
        if (typeof JField === 'undefined' || typeof Domain === 'undefined') return false;
        var sec = Domain.currentSection;
        if (!sec || !sec.walls || !sec.walls.length) return false;

        var bars = Domain.trebarList.map(function (t) {
          return {
            id: String(t.id), dia: t.dia || 13,
            segs: (t.segments || []).map(function (s) {
              return { label: s.label,
                       p1: { x: s.p1.x, y: s.p1.y }, p2: { x: s.p2.x, y: s.p2.y },
                       normal: { x: s.normal.x, y: s.normal.y } };
            })
          };
        });

        /*  **태어난 자리를 먼저 진단해 둔다.** 푸는 것과 무관하다 — 결과가 왜
            그렇게 나왔는지 표에서 바로 읽으려고 남긴다 (_seatDiag 참조).         */
        var selfD = this; this._diag = {};
        bars.forEach(function (b) { selfD._diag[String(b.id)] = selfD._seatDiag(b, sec); });

        var out;
        try { out = JField.solve(bars, sec.walls, sec, this._ducts || []); }
        catch (e) { console.error('[PSCBOX] J-field solve:', e); return false; }

        /*  **스폰 형상을 먼저 잡아 둔다.** J 는 한 번에 풀어 버려서 애니메이션이
            없다 — 그냥 두면 태어난 자리가 화면에 한 번도 안 나온다. init 을 고쳐
            가며 맞추는 일이라 그 자리가 안 보이면 눈이 없는 것과 같다.
            여기 담아 두고 _finalizeArcs 가 흐린 점선으로 같이 그린다.            */
        this._spawn = Domain.trebarList.map(function (t) {
          var pts = [];
          (t.segments || []).forEach(function (sg, i) {
            if (i === 0) pts.push({ x: sg.p1.x, y: sg.p1.y });
            pts.push({ x: sg.p2.x, y: sg.p2.y });
          });
          return { id: String(t.id), dia: t.dia || 13, pts: pts };
        });

        var self = this, byId = {};
        Domain.trebarList.forEach(function (t) { byId[String(t.id)] = t; });
        out.forEach(function (r) {
          var t = byId[String(r.id)];
          if (t && t.segments) self._writeBack(t, r, sec);
        });

        //  ── 종방향 철근 (lrebar) 도 J 로 푼다 ────────────────────────────
        var lwarn = this._solveLrebarWithJ(sec);

        //  풀린 것은 큐에서 뺀다 — 예전 엔진이 다시 건드리지 않게
        Domain.queue = Domain.queue.filter(function (q) {
          return q.kind !== 'trebar' && q.kind !== 'lrebar';
        });
        Domain.activeQueueIndex = 0;

        /*  경고는 **한 번에 한 줄**로 낸다 — 토스트가 하나라서 두 번 부르면 앞의 것이
            지워진다. 가장 가까운 면이 후보에 못 들어온 조각을 같이 알린다 : 그것이
            「입력을 고쳐야 하는 자리」다 (⑧-1 의 400 mm 다리가 그랬다).           */
        var warn = [];
        var miss = Domain.trebarList.filter(function (t) { return t.state !== 'FORMED'; });
        if (miss.length) {
          warn.push('붙을 면을 못 찾은 철근 ' + miss.map(function (t) { return t.id; }).join(', ') +
                    ' (init 이 콘크리트 안, 붙을 면 쪽에 있는지 보세요)');
        }
        var offs = [];
        Object.keys(this._diag).forEach(function (k) {
          selfD._diag[k].forEach(function (d) {
            if (d.miss) offs.push(k + '[' + d.label + '] ' + d.miss.near.id + ' ' +
                                  Math.round(d.miss.near.d) + ' mm 대신 ' + d.miss.seat.id + ' ' +
                                  Math.round(d.miss.seat.d) + ' mm');
          });
        });
        if (offs.length) warn.push('가장 가까운 면이 후보에 못 들어온 조각 ' + offs.join(', ') +
                                   ' (입력 길이나 자리를 고치세요)');
        lwarn.forEach(function (w) { warn.push(w); });
        if (warn.length) this._toast(warn.join(' · '), 'err');
        return true;
      },

      /*  ── 종방향 철근을 J 로 배치한다 (`jlong.js`) ───────────────────────
          横방향이 먼저 풀려 있어야 한다 — 그 **굴짐 아크까지 포함한 조각들**이
          종방향 철근을 밀어내는 장애물이기 때문이다(`_trebarPrimitives`).
          결과는 `group.particles` 에 써 넣는다 — 그림·표는 그대로 그것을 읽는다.
          돌려주는 것은 **경고 줄**이다 (간격·배치한계·붙을 면).                 */
      _solveLrebarWithJ: function (sec) {
        var warn = [];
        if (typeof JLong === 'undefined' || !Domain.lrebarList || !Domain.lrebarList.length) return warn;

        //  절곡철근 — 선분과 굴짐 아크를 화면이 그리는 그대로 꺼낸다
        var prims = [], self = this;
        Domain.trebarList.forEach(function (t) {
          (self._trebarPrimitives(t) || []).forEach(function (pr) {
            prims.push({ t: pr.t, p: pr.p, dia: t.dia || 13 });
          });
        });

        var rdById = {};
        (this._rebarData || []).forEach(function (d) {
          if (String(d.type || '').toLowerCase() === 'lrebar') rdById[String(d.id)] = d;
        });

        this._ldiag = {};
        Domain.lrebarList.forEach(function (grp) {
          var rd = rdById[String(grp.id)];
          if (!rd) return;
          /*  init·range·dia·num 은 **그룹**에서 읽는다 — 거기 값은 수식이 이미
              계산된 것이다(`Domain._createLrebarFromData` 가 EquationParser 를 태운다).
              ctc·ctcmax 는 그룹이 안 들고 있으므로(옛 엔진이 ctc 를 range/num 으로
              계산해 버리고 ctcmax 는 아예 안 쓴다) 입력 행에서 그대로 읽는다.      */
          var bar = rd.bar || {}, init = grp.initData || {};
          var g = {
            id: String(grp.id), dia: grp.dia || 13, num: grp.num || 0,
            init: { x: init.x || 0, y: init.y || 0, rot: init.rot || 0 },
            nors: (init.grav === -1) ? -1 : 1,
            range: { min: (grp.rangeData && grp.rangeData.min) || 0,
                     max: (grp.rangeData && grp.rangeData.max) || 0 },
            ctc: bar.ctc, ctcmin: bar.min, ctcmax: bar.max, gap: bar.gap, path: rd.path || []
          };
          if (!g.num || !g.ctc) {
            warn.push(g.id + ' : num 과 ctc 가 있어야 배치합니다');
            return;
          }
          /*  ── gap 을 주면 **한 줄이 상·하 두 줄**이 된다 ──────────────────
              위쪽(nors)과 아래쪽(−nors)을 gap 만큼 벌려 놓고 각자 제 면으로 보낸다.
              위쪽을 먼저 풀고 그 결과를 **점 장애물**로 넘겨 아래쪽이 피하게 한다
              (같은 무리 안이 아니면 서로를 못 보므로).
              다 풀고 나서 **짝의 간격이 gap 을 넘으면 그 짝을 버린다** — 그 자리엔
              한쪽 면이 없다는 뜻이다. 버릴 쪽은 **init 에서 더 멀리 간 쪽**이다.
              gap 이 없으면 예전대로 한 줄이다.                                  */
          var res, pairRes = null, dropped = 0;
          try {
            if (g.gap > 0) {
              var ax = JLong.axes(g), h = g.gap / 2;
              var gT = Object.assign({}, g, { init: { x: g.init.x + ax.n.x * h,
                                                      y: g.init.y + ax.n.y * h, rot: g.init.rot } });
              var gB = Object.assign({}, g, { nors: -g.nors,
                                              init: { x: g.init.x - ax.n.x * h,
                                                      y: g.init.y - ax.n.y * h, rot: g.init.rot } });
              res = JLong.solve(gT, sec.walls, sec, self._ducts || [], prims);
              var prims2 = prims.concat(res.bars.map(function (b) {
                return { t: 'line', p: [b.x, b.y, b.x, b.y], dia: g.dia };   // 점 장애물
              }));
              pairRes = JLong.solve(gB, sec.walls, sec, self._ducts || [], prims2);
            } else {
              res = JLong.solve(g, sec.walls, sec, self._ducts || [], prims);
            }
          }
          catch (e) { console.error('[PSCBOX] JLong:', g.id, e); warn.push(g.id + ' : 배치 실패'); return; }

          var pts = res.bars.map(function (b) { return { x: b.x, y: b.y, t: b.t, rest: b.rest }; });
          if (pairRes) {
            pairRes.bars.forEach(function (b, i) {
              var a = res.bars[i];
              if (!a) return;
              var sep = Math.hypot(b.x - a.x, b.y - a.y);
              if (sep > g.gap) {                       // 그 자리엔 한쪽 면이 없다
                dropped++;
                return;                                //  아래쪽을 버린다 (더 멀리 간 쪽)
              }
              pts.push({ x: b.x, y: b.y, t: b.t, rest: b.rest });
            });
            if (dropped) warn.push(g.id + ' : 짝 ' + dropped + '개를 버렸습니다 ' +
                                   '(간격이 gap ' + g.gap + ' mm 를 넘습니다 — 그 자리엔 한쪽 면이 없습니다)');
          }
          self._ldiag[g.id] = { g: g, res: res, pair: pairRes, dropped: dropped };

          //  particles 에 써 넣는다 (그림이 읽는 자리)
          grp.particles = pts.map(function (b) {
            return { x: b.x, y: b.y, vx: 0, vy: 0, t: b.t, target: null, state: 'SETTLED' };
          });
          grp.num = res.bars.length;
          grp.state = 'SETTLED';

          //  보고 — 고칠 수 있는 것은 입력뿐이니 숫자를 그대로 낸다
          var cap = JLong.capacity(g), span = (g.num - 1) * g.ctc;
          if (g.num > cap)
            warn.push(g.id + ' : ' + g.num + '개 × ctc ' + g.ctc + ' = ' + span +
                      ' mm 가 배치한계(' + (g.range.max - g.range.min) + ' mm · ' + cap + '개)보다 깁니다');
          var noSeat = res.bars.filter(function (b) { return !b.rest; });
          if (noSeat.length)
            warn.push(g.id + ' : ' + noSeat.length + '개가 붙을 면을 못 찾았습니다 ' +
                      '(법선 방향에 마주보는 면이 있는지, init 이 콘크리트 안인지 보세요)');
          if (res.gaps.length) {
            var lo = Math.min.apply(null, res.gaps), hi = Math.max.apply(null, res.gaps);
            if (g.ctcmin != null && lo < g.ctcmin - 0.5)
              warn.push(g.id + ' : 최소간격 ' + Math.round(lo) + ' mm (한계 ' + g.ctcmin + ')');
            if (g.ctcmax != null && hi > g.ctcmax + 0.5)
              warn.push(g.id + ' : 최대간격 ' + Math.round(hi) + ' mm (한계 ' + g.ctcmax + ')');
          }
          console.log('[JLONG] ' + g.id + ' ' + res.bars.length + '개 · J ' +
                      (res.J == null ? '-' : Math.round(res.J)) + ' · 반복 ' + res.iter +
                      ' · 간격 ' + res.gaps.map(function (x) { return Math.round(x); }).join(','));
        });
        return warn;
      },

      // ── Rebar Physics 결과 표 : id / 총길이 / 직경 / 조각 a~f / 꺽임 ra~re ──
      _renderPhysicsTable: function () {
        var body = document.getElementById('physTblBody');
        if (!body || typeof Domain === 'undefined') return;
        var rcv = document.getElementById('renderContainer');
        var twp = document.querySelector('.phys-tblwrap');
        if (rcv && twp && rcv.clientHeight) twp.style.height = rcv.clientHeight + 'px';
        var self = this, h = '';
        var codeById = {};
        (this._rebarData || []).forEach(function (rd) { if (rd && rd.id != null && rd.code != null) codeById[String(rd.id)] = rd.code; });
        function fmt(n) { return (n == null || !isFinite(n)) ? '' : String(Math.round(n)); }
        /*  형상 code 는 엔진 안에서 숫자 하나다 ('23a' → 23.1 · '11a' → 11.1).
            표에는 **도면대로 되돌려** 적는다 — fmt 는 반올림이라 23.1 을 23 으로
            찍어서, 23 과 23a 가 표에서 구별되지 않았다. 소수 첫째자리가 가지다 :
            .1 → a, .2 → b …                                                    */
        function codeText(c) {
          var n = Number(c);
          if (!isFinite(n)) return String(c == null ? '' : c);
          var b = Math.floor(n + 1e-9), f = Math.round((n - b) * 10);
          return f ? (b + String.fromCharCode(96 + f)) : String(b);
        }
        function codeCell(id) {
          var c = codeById[String(id)];
          return (c == null) ? '<td class="phys-na">&mdash;</td>' : '<td>' + self._esc(codeText(c)) + '</td>';
        }
        function cells(vals, n) {
          var s = '';
          for (var i = 0; i < n; i++) s += (vals[i] == null) ? '<td class="phys-na">&mdash;</td>' : '<td>' + fmt(vals[i]) + '</td>';
          return s;
        }
        /*  태어난 자리가 수상한 철근에는 **⚠ 를 붙인다.** 결과만 보면 「엔진이
            이상하다」로 보이는 것이 대개 여기서 갈린다 — 조각이 제 면 위에 없거나,
            법선 방향에 면이 아예 없는 경우다 (_seatDiag · _diagWarn 참조).       */
        function idCell(id, settled) {
          var cls = 'phys-id' + (settled ? '' : ' phys-moving');
          var wm = self._diagWarn(id);
          var tip = wm ? ('태어난 자리 경고 —\n' + wm + '\n\n클릭하면 J 창에서 태어난 자리와 후보 면을 봅니다')
                       : '클릭하면 이 철근의 J 를 봅니다 (지형 · 수렴 · 항별 분해)';
          return '<td class="' + cls + '" title="' + self._esc(tip) + '" onclick="PXBOX.openJ(&quot;' + self._esc(String(id)) + '&quot;)">' +
                 self._esc(String(id)) +
                 (wm ? '<span style="color:#b45309;font-weight:700;margin-left:4px;">&#9888;</span>' : '') + '</td>';
        }
        function rspBtn(id) {
          return '<td><button type="button" class="px-btn phys-rsp" title="Respawn this rebar" onclick="PXBOX.respawnOne(&quot;' + self._esc(String(id)) + '&quot;)">&#8635;</button></td>';
        }
        (Domain.trebarList || []).forEach(function (t) {
          var segs = [], arcs = [], total = 0;
          if (t.state === 'FORMED') {
            self._trebarPrimitives(t).forEach(function (pr) {
              if (pr.t === 'line') {
                var L = Math.hypot(pr.p[2] - pr.p[0], pr.p[3] - pr.p[1]);
                segs.push(L); total += L;
              } else {
                var sweep = ((pr.p[4] - pr.p[3]) % 360 + 360) % 360;
                var al = pr.p[2] * sweep * Math.PI / 180;
                arcs.push(al); total += al;
              }
            });
          } else {
            (t.segments || []).forEach(function (s) {
              var L = Math.hypot(s.p2.x - s.p1.x, s.p2.y - s.p1.y);
              segs.push(L); total += L;
            });
          }
          // 조각 a~f 먼저, 그 다음 꺽임 ra~re
          var inter = [], i;
          for (i = 0; i < 6; i++) inter.push(segs[i] != null ? segs[i] : null);
          for (i = 0; i < 5; i++) inter.push(arcs[i] != null ? arcs[i] : null);
          h += '<tr class="' + (String(self._focusId) === String(t.id) ? 'phys-focus' : '') + '">' +
               idCell(t.id, t.state === 'FORMED') + codeCell(t.id) +
               '<td><b>' + fmt(total) + '</b></td><td>' + fmt(t.dia) + '</td>' + cells(inter, 11) + rspBtn(t.id) + '</tr>';
        });
        (Domain.lrebarList || []).forEach(function (g) {
          h += '<tr class="' + (String(self._focusId) === String(g.id) ? 'phys-focus' : '') + '">' +
               idCell(g.id, g.state === 'SETTLED') + codeCell(g.id) +
               '<td class="phys-na">&mdash;</td><td>' + fmt(g.dia) + '</td>' + cells([], 11) + rspBtn(g.id) + '</tr>';
        });
        if (!h) h = '<tr><td colspan="16" style="text-align:center;color:#94a3b8;padding:14px;">No rebar loaded.</td></tr>';
        body.innerHTML = h;
      },

      // 개별 철근 재스폰 : 해당 id 만 초기 상태로 되돌려 안착 과정을 다시 관찰
      respawnOne: function (id) {
        if (typeof Domain === 'undefined' || typeof UI === 'undefined') return;
        /*  J 엔진에서는 **그 철근 하나만 다시 푼다.** 나머지는 놓인 자리에 그대로 두고
            척력으로만 본다 — 「다른 것은 고정하고 하나를 다시 최소화한다」는 것이
            J 로는 뜻이 분명한 연산이다.
            전체를 다시 푸는 것(rebarRespawn)으로 두면 화면이 하나도 안 변한다.
            J 는 결정적이라 같은 입력이면 같은 답이 나오기 때문이다 — 「눌러도
            아무 일도 안 일어난다」로 보이던 것이 그것이었다.                      */
        if (this._engine === 'jfield') { this._resolveOneWithJField(id); return; }
        var rd = null, i;
        for (i = 0; i < (this._rebarData || []).length; i++) {
          if (String(this._rebarData[i].id) === String(id)) { rd = this._rebarData[i]; break; }
        }
        if (!rd) { console.warn('[PSCBOX] respawnOne: 데이터 없음', id); return; }
        var kind = String(rd.type || 'trebar').toLowerCase();
        try {
          if (kind === 'trebar') {
            var nb = Domain._createTrebarFromData(rd);
            if (!nb) return;
            for (i = 0; i < Domain.trebarList.length; i++) if (String(Domain.trebarList[i].id) === String(id)) break;
            if (i < Domain.trebarList.length) Domain.trebarList[i] = nb; else Domain.trebarList.push(nb);
            Domain.queue.push({ kind: 'trebar', obj: nb });
          } else {
            if (typeof LRebarEngine === 'undefined') return;
            var ng = Domain._createLrebarFromData(rd);
            if (!ng) return;
            for (i = 0; i < Domain.lrebarList.length; i++) if (String(Domain.lrebarList[i].id) === String(id)) break;
            if (i < Domain.lrebarList.length) Domain.lrebarList[i] = ng; else Domain.lrebarList.push(ng);
            Domain.queue.push({ kind: 'lrebar', obj: ng });
          }
        } catch (e) { console.error('[PSCBOX] respawnOne:', id, e); return; }
        // 벽 적층(wallStack) 재구성 — 재스폰 대상의 이전 기여분을 제거하지 않으면
        // 누를 때마다 한 겹씩 안쪽으로 밀린다. 나머지 안착 철근 기여만 다시 누적.
        Domain.wallStack = {};
        Domain.trebarList.forEach(function (t) {
          if (String(t.id) !== String(id) && t.state === 'FORMED') Domain._accumulateStack(t.dia || 0, Domain._collectTrebarWalls(t));
        });
        Domain.lrebarList.forEach(function (g) {
          if (String(g.id) !== String(id) && g.state === 'SETTLED') Domain._accumulateStack(g.dia || 0, Domain._collectLrebarWalls(g));
        });
        Domain.isPaused = false;
        var b = document.getElementById('btnPause');
        if (b) b.innerHTML = '<i class="bi bi-pause-fill"></i> Pause';
        this._rebarSettled = false;
        if (this._settleTimer) { clearInterval(this._settleTimer); this._settleTimer = null; }
        if (UI.anim && UI.anim.start) UI.anim.start();
        this._watchSettle();
        this._renderPhysicsTable();
      },

      toggleNormals: function () {
        this._showEngNormals = !this._showEngNormals;
        var b = document.getElementById('btnToggleNormals');
        if (b) b.classList.toggle('active', this._showEngNormals);
        this._drawEngineNormals();
      },
      /*  태어난 자리(init 로 놓인 조각들)를 보여 줄지. 기본은 켬 —
          J 는 한 번에 풀어서 그 자리가 지나가 버리기 때문이다.                  */
      _showSpawn: true,
      _spawn: null,
      SPAWN_HOLD: 420,        // 태어난 자리를 이만큼(ms) 보여 주고 푼다

      toggleSpawn: function () {
        this._showSpawn = !this._showSpawn;
        var b = document.getElementById('btnToggleSpawn');
        if (b) b.classList.toggle('active', this._showSpawn);
        if (this._rebarSettled) this._finalizeArcs();
      },

      toggleNodes: function () {
        this._showEngNodes = !this._showEngNodes;
        var b = document.getElementById('btnToggleNodes');
        if (b) b.classList.toggle('active', this._showEngNodes);
        this._drawEngineNodes();
      },

      // Domain.currentSection.walls 의 bbox → 대각선 길이 (스케일 기준)
      _sectionDiag: function (walls) {
        var minx = 1e18, miny = 1e18, maxx = -1e18, maxy = -1e18;
        walls.forEach(function (w) { minx = Math.min(minx, w.x1, w.x2); maxx = Math.max(maxx, w.x1, w.x2); miny = Math.min(miny, w.y1, w.y2); maxy = Math.max(maxy, w.y1, w.y2); });
        return Math.hypot(maxx - minx, maxy - miny) || 1000;
      },

      // 안쪽 법선 화살표 — 화면 픽셀 기준 고정 크기 (스테이지 줌 배율 보정)
      _drawEngineNormals: function () {
        if (typeof UI === 'undefined' || !UI.mainLayer) return;
        if (this._engNormGroup) { this._engNormGroup.destroy(); this._engNormGroup = null; }
        var walls = (typeof Domain !== 'undefined' && Domain.currentSection && Domain.currentSection.walls) || [];
        if (!this._showEngNormals || !walls.length) { UI.mainLayer.draw(); return; }
        var scale = (UI.stage && UI.stage.scaleX && UI.stage.scaleX()) || 1;
        var arrowL = 26 / scale, dotR = 6 / scale;
        var g = new Konva.Group({ name: 'eng_normals' });
        // 직선 벽은 전부, 아크(필렛·원) 테셀레이션 구간은 중앙 1개만 화살표 표시
        var picks = [], ni = 0;
        while (ni < walls.length) {
          var n0 = walls[ni];
          if (!n0.src) { picks.push(n0); ni++; continue; }
          var nj = ni;
          while (nj + 1 < walls.length && walls[nj + 1].src === n0.src) nj++;
          picks.push(walls[(ni + nj) >> 1]);
          ni = nj + 1;
        }
        picks.forEach(function (w) {
          var mx = (w.x1 + w.x2) / 2, my = (w.y1 + w.y2) / 2;
          var L = arrowL;
          g.add(new Konva.Arrow({ points: [mx, my, mx + w.nx * L, my + w.ny * L], stroke: '#FFC107', fill: '#FFC107', strokeWidth: 2, pointerLength: L * 0.34, pointerWidth: L * 0.3, strokeScaleEnabled: false }));
          g.add(new Konva.Circle({ x: mx, y: my, radius: dotR, fill: '#FF5722', strokeScaleEnabled: false }));
        });
        UI.mainLayer.add(g); this._engNormGroup = g; UI.mainLayer.draw();
      },

      // 벽 id(E1,E2…) 라벨 + 끝점 — 아크 테셀레이션 구간은 중앙 1개에 범위(Ea~Eb)로 표기
      _drawEngineNodes: function () {
        if (typeof UI === 'undefined' || !UI.mainLayer) return;
        if (this._engNodeGroup) { this._engNodeGroup.destroy(); this._engNodeGroup = null; }
        var walls = (typeof Domain !== 'undefined' && Domain.currentSection && Domain.currentSection.walls) || [];
        if (!this._showEngNodes || !walls.length) { UI.mainLayer.draw(); return; }
        var scale = (UI.stage && UI.stage.scaleX && UI.stage.scaleX()) || 1;
        var fs = 13 / scale, dotR = 6 / scale;
        var g = new Konva.Group({ name: 'eng_nodes' });
        var items = [], wi = 0;
        while (wi < walls.length) {
          var w0 = walls[wi];
          if (!w0.src) { items.push({ w: w0, text: String(w0.id || '') }); wi++; continue; }
          var wj = wi;
          while (wj + 1 < walls.length && walls[wj + 1].src === w0.src) wj++;
          var wm = walls[(wi + wj) >> 1];
          items.push({ w: wm, text: (wi === wj) ? String(wm.id || '') : String(w0.id || '') + '~' + String(walls[wj].id || '') });
          wi = wj + 1;
        }
        items.forEach(function (it) {
          var w = it.w, mx = (w.x1 + w.x2) / 2, my = (w.y1 + w.y2) / 2;
          g.add(new Konva.Circle({ x: mx, y: my, radius: dotR, fill: '#FF5722', strokeScaleEnabled: false }));
          var lbl = new Konva.Label({ x: mx + w.nx * fs * 0.6, y: my + w.ny * fs * 0.6, scaleY: -1 });
          lbl.add(new Konva.Tag({ fill: 'rgba(0,0,0,0.78)', cornerRadius: fs * 0.2 }));
          lbl.add(new Konva.Text({ text: it.text, fontSize: fs, fontStyle: 'bold', fontFamily: 'Arial', fill: '#00E5FF', padding: fs * 0.18 }));
          lbl.offsetX(lbl.width() / 2); lbl.offsetY(lbl.height() / 2);
          g.add(lbl);
        });
        UI.mainLayer.add(g); this._engNodeGroup = g; UI.mainLayer.draw();
      },

      _trebarPrimitives: function (t) {
        var segs = t.segments || [], n = segs.length;
        if (!n) return [];
        var dia = t.dia || 13;
        var rBase = (t.radius && t.radius > 0) ? t.radius : bendRadiusForDia(dia);   // 철근별 입력 > 직경별 맵 > EN 규칙
        var hasFillet = (typeof geo_fillet === 'function' && typeof get_inner_angle === 'function');
        var prims = [], cur = { x: segs[0].p1.x, y: segs[0].p1.y };
        for (var i = 0; i < n; i++) {
          var V = { x: segs[i].p2.x, y: segs[i].p2.y };
          var filletDone = false;
          if (i < n - 1 && hasFillet) {
            var P1 = { x: segs[i].p1.x, y: segs[i].p1.y };
            var P3 = { x: segs[i + 1].p2.x, y: segs[i + 1].p2.y };
            var inner = get_inner_angle(P1, V, P3);   // 내각(도) 0..180
            if (isFinite(inner) && inner <= 178 && inner >= 2) {
              var half = (inner / 2) * Math.PI / 180, tanH = Math.tan(half) || 1e-6;
              var availIn = Math.hypot(V.x - cur.x, V.y - cur.y), lenOut = Math.hypot(P3.x - V.x, P3.y - V.y);
              var maxTL = Math.min(availIn * 0.95, lenOut * 0.45), r = rBase;
              if (r / tanH > maxTL) r = maxTL * tanH;
              if (r >= 1e-3) {
                var f = geo_fillet(P1, V, P3, r);
                if (f && isFinite(f.ox) && isFinite(f.r) && f.r > 0) {
                  prims.push({ t: 'line', p: [cur.x, cur.y, f.xb, f.yb] });
                  prims.push({ t: 'arc', p: [f.ox, f.oy, f.r, f.angb, f.ange] });
                  cur = { x: f.xe, y: f.ye };
                  filletDone = true;
                }
              }
            }
          }
          if (!filletDone) { prims.push({ t: 'line', p: [cur.x, cur.y, V.x, V.y] }); cur = V; }
        }
        return prims;
      },

      _arcTess: function (cx, cy, r, a0, a1) {
        var span = a1 - a0; while (span < 0) span += 360; while (span > 360) span -= 360;
        var m = Math.max(2, Math.ceil(span / 6)), pts = [];
        for (var i = 0; i <= m; i++) { var a = (a0 + span * i / m) * Math.PI / 180; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
        return pts;
      },

      _drawFilletedTrebar: function (t, group) {
        var prims = this._trebarPrimitives(t);
        if (!prims.length) return;
        var self = this, pts = [];
        function pushPt(x, y) { var L = pts.length; if (L >= 2 && Math.abs(pts[L - 2] - x) < 1e-6 && Math.abs(pts[L - 1] - y) < 1e-6) return; pts.push(x, y); }
        prims.forEach(function (pr) {
          if (pr.t === 'line') { pushPt(pr.p[0], pr.p[1]); pushPt(pr.p[2], pr.p[3]); }
          else {
            var arr = self._arcTess(pr.p[0], pr.p[1], pr.p[2], pr.p[3], pr.p[4]);
            var lx = pts.length ? pts[pts.length - 2] : arr[0][0], ly = pts.length ? pts[pts.length - 1] : arr[0][1];
            if (Math.hypot(arr[arr.length - 1][0] - lx, arr[arr.length - 1][1] - ly) < Math.hypot(arr[0][0] - lx, arr[0][1] - ly)) arr = arr.slice().reverse();
            arr.forEach(function (p) { pushPt(p[0], p[1]); });
          }
        });
        var dia = t.dia || 13, st = this._focusStyle(t.id);
        group.add(new Konva.Line({ points: pts, stroke: st.color, strokeWidth: (dia > 0 ? dia : 5), lineCap: 'round', lineJoin: 'round', strokeScaleEnabled: true, opacity: st.opacity }));
        if (st.focused) {   // 강조 외곽선(글로우) — 두껍게 한 겹 덧그림
          group.add(new Konva.Line({ points: pts, stroke: '#FF3D00', strokeWidth: (dia > 0 ? dia : 5) * 2.1, lineCap: 'round', lineJoin: 'round', strokeScaleEnabled: true, opacity: 0.22 }));
        }
      },

      // 표에서 클릭한 철근(_focusId) 강조 스타일 — 없으면 전체 기본
      _focusStyle: function (id) {
        if (!this._focusId) return { color: '#8A2BE2', opacity: 1, focused: false };
        var on = String(id) === String(this._focusId);
        // 비선택 철근은 흐리되 형상은 남긴다 (0.13 은 사실상 안 보였음)
        return on ? { color: '#FF3D00', opacity: 1, focused: true }
                  : { color: '#8A2BE2', opacity: 0.4, focused: false };
      },

      // 표 ID 클릭 → 해당 철근만 강조 (같은 id 재클릭이면 해제)
      focusRebar: function (id) {
        this._focusId = (String(this._focusId) === String(id)) ? null : String(id);
        if (this._rebarSettled) this._finalizeArcs(); else if (typeof UI !== 'undefined' && UI.mainLayer) UI.mainLayer.draw();
        this._renderPhysicsTable();
      },

      _watchSettle: function () {
        var self = this;
        if (this._settleTimer) { clearInterval(this._settleTimer); this._settleTimer = null; }
        if (typeof Domain === 'undefined' || !Domain.queue || Domain.queue.length === 0) return;
        var lastIndex = -1, stallTicks = 0, totalTicks = 0, stuck = [];
        var STALL_LIMIT = 60;     // 진행 없이 정체(약 9초) → 현재 철근 강제 스킵 (느린 정상 안착은 통과)
        var HARD_LIMIT = 4000;    // 타이머 영구화 방지 안전 상한 (약 10분)
        this._settleTimer = setInterval(function () {
          totalTicks++;
          var idx = Domain.activeQueueIndex;
          if (idx !== lastIndex) { lastIndex = idx; stallTicks = 0; }   // 진행 중이면 계속 대기
          else stallTicks++;
          // 정체 지속 → 현재 철근 강제 안착 처리 후 다음으로 (전체 정지 방지)
          if (stallTicks > STALL_LIMIT && idx < Domain.queue.length) {
            var it = Domain.queue[idx], id = (it && it.obj && it.obj.id) || ('#' + idx), kind = it && it.kind;
            // 왜 멈췄는지 세그먼트별 진단 — 상태 / 타깃 벽 유무 / 잔여 오차
            var why = '';
            if (kind === 'trebar' && it.obj && it.obj.segments) {
              why = it.obj.segments.map(function (sg) {
                var d = sg.label + ':' + sg.state;
                if (sg.state === 'FITTING' && sg.nodes && sg.nodes.length) {
                  var miss = 0, maxErr = 0;
                  sg.nodes.forEach(function (nd) {
                    var tg = Physics.getGravityTarget(nd.x, nd.y, sg.normal, Domain.currentSection.walls, Domain.wallStack, it.obj.dia || 0);
                    if (!tg) miss++;
                    else maxErr = Math.max(maxErr, Math.hypot(tg.x - nd.x, tg.y - nd.y));
                  });
                  d += (miss ? '(타깃없음 ' + miss + '/' + sg.nodes.length + ' — nors/rot 로 법선이 벽 바깥을 향함)'
                             : '(오차 ' + maxErr.toFixed(1) + 'mm — 수렴 실패)');
                }
                return d;
              }).join(', ');
              why = ' 세그[' + why + ']';
            }
            console.warn('[PSCBOX] 철근 안착 실패 → 스킵:', id, '(' + kind + ')' + why);
            stuck.push(id + '(' + kind + ')');
            if (it && it.obj) {
              if (kind === 'trebar') {
                // 강제 스킵이라도 barEnds(fit/ray)는 적용 — 안 하면 기본길이 바가 그대로 남음
                try {
                  if (it.obj.finalize) it.obj.finalize();
                  Physics.applyTrebarEnds(it.obj, Domain.currentSection.walls, Domain.wallStack);
                } catch (e) { console.warn('[SeoulPhD] 스킵 바 barEnds 적용 실패:', e); }
                it.obj.state = 'FORMED';
              } else {
                it.obj.state = 'SETTLED';
              }
            }
            Domain.activeQueueIndex++; stallTicks = 0; lastIndex = Domain.activeQueueIndex;
            return;
          }
          var done = Domain.activeQueueIndex >= Domain.queue.length;
          var allFormed = Domain.trebarList.every(function (t) { return t.state === 'FORMED'; });
          if ((done && allFormed) || totalTicks > HARD_LIMIT) {
            clearInterval(self._settleTimer); self._settleTimer = null;
            self._finalizeArcs();     // FORMED 된 것만 아크, 미안착은 직선 유지
            if (stuck.length) {
              self._toast('안착 실패로 건너뜀: ' + stuck.join(', ') + ' — 콘솔(F12)에 세그먼트별 원인', 'err');
              var msg = '철근 ' + stuck.length + '개가 안착 실패로 건너뛰어졌습니다: ' + stuck.join(', ') +
                '\n\n확인: 해당 행의 num(개수)이 비었거나 0인지, init/range 값이 올바른지, path 벽 id 가 단면에 있는지(Toggle Nodes). 콘솔(F12)에 상세 로그가 있습니다.';
              if (self._lastStuckMsg !== msg) { self._lastStuckMsg = msg; try { alert(msg); } catch (e) {} }
            }
          }
        }, 150);
      },

      _finalizeArcs: function () {
        if (typeof UI === 'undefined') return;
        this._rebarSettled = true;
        try { if (typeof UI.updateVisuals === 'function') UI.updateVisuals(); } catch (e) {}  // 최종 프레임 반영
        if (UI.anim && UI.anim.stop) UI.anim.stop();      // 정지 → 굴짐 아크가 직선으로 덮이지 않음
        if (!UI.trebarGroup) return;
        UI.trebarGroup.destroyChildren();
        /*  겹침 해소는 **예전 엔진에만** 건다. J 엔진은 순간격을 제약으로 이미 풀었고,
            여기서 또 밀면 J 가 찾은 자리를 손으로 흐트러뜨리는 것이 된다.          */
        if (this._engine !== 'jfield') this._relaxRebar();                         // 통합 z-order 겹침 해소 (trebar 강체 + lrebar 점) — 그리기 전에
        var self = this, formed = 0;
        //  태어난 자리 — 흐린 점선으로 밑에 깔아 둔다 (Toggle Spawn 으로 끈다)
        if (this._engine === 'jfield' && this._showSpawn && this._spawn) {
          this._spawn.forEach(function (sp) {
            var st = self._focusStyle(sp.id), flat = [];
            sp.pts.forEach(function (p) { flat.push(p.x, p.y); });
            if (flat.length < 4) return;
            UI.trebarGroup.add(new Konva.Line({
              points: flat, stroke: '#94a3b8', strokeWidth: Math.max(sp.dia * 0.6, 4),
              lineCap: 'round', lineJoin: 'round', strokeScaleEnabled: true,
              dash: [60, 45], opacity: st.focused ? 0.95 : 0.35
            }));
          });
        }
        Domain.trebarList.forEach(function (t) {                                   // 이동된 위치로 작도
          if (t.state === 'FORMED') { self._drawFilletedTrebar(t, UI.trebarGroup); formed++; }
          else self._drawStraightTrebar(t, UI.trebarGroup);   // 미안착 바는 직선으로 남겨 사라지지 않게
        });
        this._drawLrebarTrue();                                                    // lrebar 실제 반경으로 재작도
        if (UI.mainLayer) UI.mainLayer.draw();
        this._renderPhysicsTable();                                                // 결과 표 갱신 (안착 후 길이 확정)
        console.log('[SeoulPhD] 굴짐 아크 적용 — FORMED ' + formed + '/' + Domain.trebarList.length);
      },

      _relaxRebar: function () {
        if (typeof Domain === 'undefined') return;
        var GSTEP = 2.0, ITERS = 320, MAXMOVE = 250;   // GSTEP: 벽방향 인력 스텝(mm/iter), MAXMOVE: 안전 이동 상한
        var zmap = {};
        (this._rebarData || []).forEach(function (d) { if (d && d.id != null) zmap[d.id] = Number(d.z) || 0; });
        function zOf(o) { return (o && o.id != null && zmap[o.id] != null) ? zmap[o.id] : 0; }
        var sec = Domain.currentSection, walls = (sec && sec.walls) || [], covers = (sec && sec.covers) || {};
        function coverOf(w) { var c = (w && w.tag) ? String(w.tag).toLowerCase() : 'outer'; return covers[c] || 50; }
        function distSeg(px, py, ax, ay, bx, by) {
          var dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
          var t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; t = t < 0 ? 0 : (t > 1 ? 1 : t);
          var cx = ax + t * dx, cy = ay + t * dy; return { cx: cx, cy: cy, d: Math.hypot(px - cx, py - cy) };
        }
        // 고정 장애물: FORMED trebar 세그먼트 (z 태그)
        var tsegs = [];
        (Domain.trebarList || []).forEach(function (t) {
          if (t.state !== 'FORMED' || !t.segments) return;
          var z = zOf(t), r = (t.dia || 0) / 2;
          t.segments.forEach(function (s) { tsegs.push({ z: z, r: r, ax: s.p1.x, ay: s.p1.y, bx: s.p2.x, by: s.p2.y }); });
        });
        // 이동 대상: lrebar 파티클 (z, 벽방향 인력 gd, 배리어 벽, anchor)
        var parts = [];
        (Domain.lrebarList || []).forEach(function (g) {
          if (!g || !g.particles) return;
          var r = (g.dia || 13) / 2, z = zOf(g), gd = g.gravDir || { x: 0, y: 0 };
          var pw = walls.filter(function (w) { return g.path && g.path.indexOf(w.id) >= 0; });
          g.particles.forEach(function (p) { parts.push({ p: p, r: r, z: z, gd: gd, walls: pw, ax: p.x, ay: p.y }); });
        });
        if (!parts.length) return;
        for (var it = 0; it < ITERS; it++) {
          for (var i = 0; i < parts.length; i++) {
            var a = parts[i], P = a.p;
            P.x += a.gd.x * GSTEP; P.y += a.gd.y * GSTEP;                       // 1) 벽 방향 인력
            for (var k = 0; k < tsegs.length; k++) {                            // 2) 같은 z trebar 겹침 → tangent 복원
              var s = tsegs[k]; if (s.z !== a.z) continue;
              var q = distSeg(P.x, P.y, s.ax, s.ay, s.bx, s.by), need = s.r + a.r;
              if (q.d < need && q.d > 1e-6) { var cf = (need - q.d) / q.d; P.x += (P.x - q.cx) * cf; P.y += (P.y - q.cy) * cf; }
            }
            // 3) 벽 배리어 — 가장 가까운 path 벽 1개에만 적용(콘크리트 안쪽 반공간).
            //    오목한 내측면(헌치)에서 여러 벽을 동시에 반공간 투영하면 코너 래칫으로 철근이 밀려나므로
            //    최근접 벽 하나로만 억제한다.
            var nw = null, nq = null, nd = 1e18;
            for (var wi = 0; wi < a.walls.length; wi++) {
              var q2 = distSeg(P.x, P.y, a.walls[wi].x1, a.walls[wi].y1, a.walls[wi].x2, a.walls[wi].y2);
              if (q2.d < nd) { nd = q2.d; nw = a.walls[wi]; nq = q2; }
            }
            if (nw) {
              var sd = (P.x - nq.cx) * nw.nx + (P.y - nq.cy) * nw.ny, need2 = coverOf(nw) + a.r;   // 안쪽 법선 부호거리
              if (sd < need2) { var push = need2 - sd; P.x += nw.nx * push; P.y += nw.ny * push; }   // 콘크리트 안쪽으로만 복원
            }
            for (var j = 0; j < parts.length; j++) {                           // 4) 같은 z lrebar 끼리 반발
              if (j === i) continue; var b = parts[j]; if (b.z !== a.z) continue;
              var ex = P.x - b.p.x, ey = P.y - b.p.y, d = Math.hypot(ex, ey) || 1e-6, need3 = a.r + b.r;
              if (d < need3) { var cf3 = (need3 - d) / d * 0.5; P.x += ex * cf3; P.y += ey * cf3; b.p.x -= ex * cf3; b.p.y -= ey * cf3; }
            }
            var mmx = P.x - a.ax, mmy = P.y - a.ay, mm = Math.hypot(mmx, mmy);  // 5) 안전 이동 상한
            if (mm > MAXMOVE) { P.x = a.ax + mmx / mm * MAXMOVE; P.y = a.ay + mmy / mm * MAXMOVE; }
          }
        }
        console.log('[SeoulPhD] 철근 인력+반발 정렬(z-order) — lrebar ' + parts.length + ', trebar seg ' + tsegs.length);
      },

      _drawLrebarTrue: function () {
        if (typeof UI === 'undefined' || !UI.lrebarGroup || typeof Konva === 'undefined') return;
        UI.lrebarGroup.destroyChildren();
        var self = this;
        (Domain.lrebarList || []).forEach(function (g) {
          if (!g || !g.particles) return;
          var r = (g.dia || 13) / 2, st = self._focusStyle(g.id);
          g.particles.forEach(function (p) {
            UI.lrebarGroup.add(new Konva.Circle({
              x: p.x, y: p.y, radius: st.focused ? r * 1.15 : r,
              fill: st.focused ? '#FF3D00' : '#FFD700',
              stroke: st.focused ? '#7F1D1D' : '#B8860B',
              strokeWidth: Math.max(r * 0.18, 0.8), strokeScaleEnabled: true, opacity: st.opacity
            }));
          });
        });
      },

      _drawStraightTrebar: function (t, group) {
        var segs = t.segments || [], dia = t.dia || 13, st = this._focusStyle(t.id);
        segs.forEach(function (s) {
          var pts = (s.state === 'SETTLED')
            ? [s.p1.x, s.p1.y, s.p2.x, s.p2.y]
            : [s.nodes[0].x, s.nodes[0].y, s.nodes[1].x, s.nodes[1].y];
          group.add(new Konva.Line({ points: pts, stroke: st.color, strokeWidth: (dia > 0 ? dia : 5), lineCap: 'round', strokeScaleEnabled: true, opacity: st.opacity }));
        });
      },

      exportDXF: function () {
        if (typeof dxf_generator !== 'function') { alert('DXF 생성기가 로드되지 않았습니다.'); return; }
        if (typeof Domain === 'undefined' || !Domain.currentSection) { alert('먼저 단면을 렌더링하세요.'); return; }
        var dxf = dxf_generator();
        dxf.init();
        dxf.layer('SECTION', 7, 'CONTINUOUS');   // white
        dxf.layer('TREBAR', 3, 'CONTINUOUS');    // green
        dxf.layer('LREBAR', 1, 'CONTINUOUS');    // red
        (Domain.currentSection.displayPaths || []).forEach(function (path) {
          for (var i = 0; i < path.length - 1; i++) dxf.line(path[i].x, path[i].y, path[i + 1].x, path[i + 1].y, 'SECTION');
          if (path.length > 2) { var a = path[path.length - 1], b = path[0]; if (Math.hypot(a.x - b.x, a.y - b.y) > 1e-6) dxf.line(a.x, a.y, b.x, b.y, 'SECTION'); }
        });
        var self = this;
        (Domain.trebarList || []).forEach(function (t) {
          self._trebarPrimitives(t).forEach(function (pr) {
            if (pr.t === 'line') dxf.line(pr.p[0], pr.p[1], pr.p[2], pr.p[3], 'TREBAR');
            else dxf.arc(pr.p[0], pr.p[1], pr.p[2], pr.p[3], pr.p[4], 'TREBAR');
          });
        });
        (Domain.lrebarList || []).forEach(function (g) {
          var r = (g.dia || 13) / 2;
          (g.particles || []).forEach(function (p) { dxf.circle(p.x, p.y, r, 'LREBAR'); });
        });
        dxf.download('seoul_phd_' + (this._cur || 'section') + '.dxf');
      },

      _buildSectionFromBim: function () {
        var lines = this._lines || [], arcs = this._arcs || [], circs = this._circs || [];
        var raw = [];
        lines.forEach(function (s) { raw.push([s[0], s[1], s[2], s[3], null]); });
        arcs.forEach(function (c, ai) {
          var x = c[0], y = c[1], r = c[2], sp = c[4] - c[3]; if (sp <= 0) sp += 360;
          var n = Math.max(2, Math.ceil(sp / 10)), ppx, ppy;
          for (var i = 0; i <= n; i++) { var a = (c[3] + sp * i / n) * Math.PI / 180, px = x + r * Math.cos(a), py = y + r * Math.sin(a); if (i > 0) raw.push([ppx, ppy, px, py, 'arc' + ai]); ppx = px; ppy = py; }
        });
        if (raw.length === 0 && circs.length === 0) return null;

        var bnd = raw.slice();
        circs.forEach(function (c) {
          var N = 64, ppx, ppy;
          for (var i = 0; i <= N; i++) { var a = i / N * 2 * Math.PI, px = c[0] + c[2] * Math.cos(a), py = c[1] + c[2] * Math.sin(a); if (i > 0) bnd.push([ppx, ppy, px, py]); ppx = px; ppy = py; }
        });
        var minx = 1e18, miny = 1e18, maxx = -1e18, maxy = -1e18;
        bnd.forEach(function (s) { minx = Math.min(minx, s[0], s[2]); maxx = Math.max(maxx, s[0], s[2]); miny = Math.min(miny, s[1], s[3]); maxy = Math.max(maxy, s[1], s[3]); });
        var diag = Math.hypot(maxx - minx, maxy - miny) || 100;
        var cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
        var tol = Math.max(1, diag * 0.005), eps = diag * 0.006;
        function inside(px, py) {
          var c = false;
          for (var i = 0; i < bnd.length; i++) { var x1 = bnd[i][0], y1 = bnd[i][1], x2 = bnd[i][2], y2 = bnd[i][3]; if (((y1 > py) !== (y2 > py)) && (px < (x2 - x1) * (py - y1) / ((y2 - y1) || 1e-9) + x1)) c = !c; }
          return c;
        }
        function near(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by) <= tol; }

        // 직선/아크 세그먼트를 끝점 이어 닫힌 loop 로 체이닝
        var segs = raw.map(function (s) { return { x1: s[0], y1: s[1], x2: s[2], y2: s[3], src: s[4] || null, used: false }; });
        var loops = [];
        for (var s0 = 0; s0 < segs.length; s0++) {
          if (segs[s0].used) continue;
          segs[s0].used = true;
          var sx = segs[s0].x1, sy = segs[s0].y1, ex = segs[s0].x2, ey = segs[s0].y2;
          var loop = [{ x1: sx, y1: sy, x2: ex, y2: ey, src: segs[s0].src }], guard = 0;
          while (guard++ < segs.length + 2) {
            if (near(ex, ey, sx, sy)) break;
            var found = null, rev = false;
            for (var j = 0; j < segs.length; j++) {
              if (segs[j].used) continue;
              if (near(segs[j].x1, segs[j].y1, ex, ey)) { found = segs[j]; rev = false; break; }
              if (near(segs[j].x2, segs[j].y2, ex, ey)) { found = segs[j]; rev = true; break; }
            }
            if (!found) break;
            found.used = true;
            var nX = rev ? found.x1 : found.x2, nY = rev ? found.y1 : found.y2;
            loop.push({ x1: ex, y1: ey, x2: nX, y2: nY, src: found.src });
            ex = nX; ey = nY;
          }
          if (near(ex, ey, sx, sy)) { loop[loop.length - 1].x2 = sx; loop[loop.length - 1].y2 = sy; }
          loops.push(loop);
        }
        // 원은 각각 독립 loop
        circs.forEach(function (c, ci) {
          var N = 48, loop = [], ppx, ppy;
          for (var i = 0; i <= N; i++) { var a = i / N * 2 * Math.PI, px = c[0] + c[2] * Math.cos(a), py = c[1] + c[2] * Math.sin(a); if (i > 0) loop.push({ x1: ppx, y1: ppy, x2: px, y2: py, src: 'circ' + ci }); ppx = px; ppy = py; }
          if (loop.length) { loop[loop.length - 1].x2 = loop[0].x1; loop[loop.length - 1].y2 = loop[0].y1; loops.push(loop); }
        });

        var walls = [], displayPaths = [], eid = 0;
        // 외곽 루프(가장 큰 bbox) 판별 — 외곽 상면은 top(데크), 나머지 외곽은 outer, 내부 셀 루프는 inner
        var outerIdx = -1, outerArea = -1;
        loops.forEach(function (lp, li) {
          var mnx = 1e18, mny = 1e18, mxx = -1e18, mxy = -1e18;
          lp.forEach(function (s) { mnx = Math.min(mnx, s.x1, s.x2); mxx = Math.max(mxx, s.x1, s.x2); mny = Math.min(mny, s.y1, s.y2); mxy = Math.max(mxy, s.y1, s.y2); });
          var a = (mxx - mnx) * (mxy - mny);
          if (a > outerArea) { outerArea = a; outerIdx = li; }
        });
        loops.forEach(function (loop, li) {
          if (!loop.length) return;
          var pts = [{ x: loop[0].x1, y: loop[0].y1 }];
          loop.forEach(function (seg) {
            // 길이 0 세그먼트(입력 안 함/0 입력 치수) → 벽 생성 생략 (경로 점만 유지)
            if (Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1) < 0.5) { pts.push({ x: seg.x2, y: seg.y2 }); return; }
            var mx = (seg.x1 + seg.x2) / 2, my = (seg.y1 + seg.y2) / 2;
            var dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1, len = Math.hypot(dx, dy) || 1;
            var nx = -dy / len, ny = dx / len;
            if (!inside(mx + nx * eps, my + ny * eps)) {
              if (inside(mx - nx * eps, my - ny * eps)) { nx = -nx; ny = -ny; }
              else { var vx = cx - mx, vy = cy - my, vl = Math.hypot(vx, vy) || 1; nx = vx / vl; ny = vy / vl; }
            }
            eid++;
            var tag = (li === outerIdx) ? (ny <= -0.5 ? 'top' : 'outer') : 'inner';
            walls.push({ id: 'E' + eid, tag: tag, nx: nx, ny: ny, x1: seg.x1, y1: seg.y1, x2: seg.x2, y2: seg.y2, src: seg.src || null });
            pts.push({ x: seg.x2, y: seg.y2 });
          });
          displayPaths.push(pts);
        });
        /*  덕트 — 콘크리트에 뚫린 구멍이라 개구부와 같은 길로 벽이 된다.
            ref:deck 이 경사면을 따라가려면 바깥 윤곽이 필요해서, 여기서 한 번 남겨 둔다.
            (위 loops 는 세그먼트 배열이라 점 배열로 바꿔 둔다)                        */
        var ol = loops[outerIdx] || [];
        this._sectOuter = ol.length ? [[ol[0].x1, ol[0].y1]].concat(ol.map(function (sg) { return [sg.x2, sg.y2]; })) : [];
        this._buildDucts();
        /*  덕트 벽은 walls 에 **넣지 않는다.**
            물리는 walls 를 인력장의 후보로 쓴다. 덕트를 거기 섞으면 철근이 피복을 찾기도
            전에 덕트에 끌려간다 — 순서가 뒤집힌다.
              1단계  콘크리트 피복을 찾아 앉는다        (walls = 콘크리트만)
              2단계  그 자리가 덕트와 겹치면 비켜난다   (ductWalls — 척력, 아직 미구현)
            덕트는 구멍이지 목표가 아니다. 지금은 그리기와 판정에만 쓴다.              */
        var dw = DuctBlock.walls(this._ducts, eid);
        dw.paths.forEach(function (p) { displayPaths.push(p); });
        eid = dw.eid;

        function cval(id, def) { var el = document.getElementById(id); var n = el ? Number(el.value) : NaN; return isFinite(n) && n > 0 ? n : def; }
        return { walls: walls, displayPaths: displayPaths, ductWalls: dw.walls, ducts: this._ducts || [],
                 covers: { top: cval('cover_deck_s', 50), outer: cval('cover_ext_s', 40), inner: cval('cover_int_s', 30) } };
      },

      /*  'duct' 블록 — 문법과 구현은 bim_duct.js 에 있다 (격벽 페이지와 공용).      */
      _loadDuctFromExcel: function (fullData) {
        var self = this;
        this._ductSpec = DuctBlock.parse(fullData,
          function (r) { return self._rowIsEnd(r); },
          function (r) { return self._rowIsComment(r); });
        var n = this._ductSpec.length;
        if (n) console.log('[PSCBOX] duct 로드: ' + n + '개');
        return n;
      },

      _surfaceAt: function (x, which) {
        return DuctBlock.surfaceOf(this._sectOuter || [])(x, which);
      },

      _buildDucts: function () {
        var self = this;
        this._ducts = DuctBlock.build(this._ductSpec || [],
          function (x, w) { return self._surfaceAt(x, w); });
        return this._ducts;
      },

      _applyGenericSection: function (sec) {
        Domain.currentSection = sec;
        Domain.trebarList = []; Domain.lrebarList = []; Domain.queue = [];
        Domain.activeQueueIndex = 0; Domain.isPaused = false; Domain.wallStack = {};
        Domain.USER_REBAR_DATA = this._rebarData || []; Domain.USER_TREBAR_DATA = null; Domain.USER_LREBAR_DATA = null;
        (this._rebarData || []).forEach(function (rd) {
          var t = String(rd.type || 'trebar').toLowerCase();
          try {
            if (t === 'trebar') {
              var rb = Domain._createTrebarFromData(rd);
              if (rb) { Domain.trebarList.push(rb); Domain.queue.push({ kind: 'trebar', obj: rb }); }
            } else if (t === 'lrebar' && typeof LRebarEngine !== 'undefined') {
              var g = Domain._createLrebarFromData(rd);
              if (g) { Domain.lrebarList.push(g); Domain.queue.push({ kind: 'lrebar', obj: g }); }
            }
          } catch (e) { console.error('[SeoulPhD] 철근 생성 오류:', rd.id, e); }
        });
        // 섹션 폴리라인 (엔진 UI 그룹/렌더 함수 사용)
        UI.sectionGroup.destroyChildren();
        UI.normalGroup.destroyChildren();
        UI.trebarGroup.destroyChildren();
        UI.lrebarGroup.destroyChildren();
        UI.debugGroup.destroyChildren();
        // 표시용 외곽선 — 물리 벽(walls)은 직선 분할을 유지하되, 그래픽은 캡처된
        // bim 원시도형(직선+아크+원)을 그대로 그린다 → 필렛이 폴리라인이 아닌 실제 아크로 렌더링
        //  덕트 — 콘크리트와 구별되게 다른 색으로.
        //  원은 **원 그대로** 그린다. 24 각형은 벽(선분+법선)으로 판별하기 위한 것이지
        //  덕트가 각진 구멍이라는 뜻이 아니다 — 외곽선을 아크로 그리는 것과 같은 규칙이다.
        (this._ducts || []).forEach(function (dk) {
          if (!dk) return;
          if (dk.shape === 'circ' && isFinite(dk.D) && dk.D > 0) {
            UI.sectionGroup.add(new Konva.Circle({ x: dk.x, y: dk.y, radius: dk.D / 2,
              stroke: '#FF61E6', strokeWidth: 1.5, strokeScaleEnabled: false }));
            return;
          }
          if (!dk.pts || dk.pts.length < 3) return;
          var flatD = [];
          dk.pts.forEach(function (p) { flatD.push(p[0], p[1]); });
          UI.sectionGroup.add(new Konva.Line({ points: flatD, stroke: '#FF61E6', strokeWidth: 1.5,
            closed: true, lineJoin: 'round', strokeScaleEnabled: false }));
        });
        var _ln = this._lines || [], _ar = this._arcs || [], _ci = this._circs || [];
        if (_ln.length || _ar.length || _ci.length) {
          _ln.forEach(function (s) {
            UI.sectionGroup.add(new Konva.Line({ points: [s[0], s[1], s[2], s[3]], stroke: '#ffffff', strokeWidth: 2, lineCap: 'round', strokeScaleEnabled: false }));
          });
          _ar.forEach(function (c) {
            var a0 = c[3], a1 = c[4]; if (a1 <= a0) a1 += 360;
            UI.sectionGroup.add(new Konva.Shape({
              sceneFunc: function (ctx, shape) {
                ctx.beginPath();
                ctx.arc(c[0], c[1], c[2], a0 * Math.PI / 180, a1 * Math.PI / 180, false);
                ctx.fillStrokeShape(shape);
              },
              stroke: '#ffffff', strokeWidth: 2, strokeScaleEnabled: false
            }));
          });
          _ci.forEach(function (c) {
            UI.sectionGroup.add(new Konva.Circle({ x: c[0], y: c[1], radius: c[2], stroke: '#ffffff', strokeWidth: 2, strokeScaleEnabled: false }));
          });
        } else {
          sec.displayPaths.forEach(function (path) {   // 캡처 데이터가 없을 때의 예비 경로
            var flat = []; path.forEach(function (p) { flat.push(p.x, p.y); });
            UI.sectionGroup.add(new Konva.Line({ points: flat, stroke: '#ffffff', strokeWidth: 2, closed: true, lineJoin: 'round', strokeScaleEnabled: false }));
          });
        }
        if (typeof UI.drawGrid === 'function') UI.drawGrid();
        if (typeof UI.drawNormals === 'function') UI.drawNormals();
        if (typeof UI.drawDebugNodes === 'function') UI.drawDebugNodes();
        UI.mainLayer.draw();
        this._drawEngineNormals();   // 토글 상태 유지 — 새 단면에 맞춰 재작도(꺼져 있으면 지움)
        this._drawEngineNodes();
      },

      _esc: function (v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },

      // ── 로딩 로그 패널 : 마지막 엑셀 로딩 결과 다시 보기 ──
      toggleLoadLog: function () {
        var pan = document.getElementById('pxLoadLog');
        var btn = document.getElementById('btnViewLog');
        if (!pan) return;
        var show = pan.style.display === 'none';
        if (show) {
          if (!this._loadLog) {
            pan.innerHTML = '<div class="log-time">No Excel load yet.</div>';
          } else {
            var lg = this._loadLog, h = '<div class="log-time">' + this._esc(lg.time) + ' \u2014 ' +
              (lg.ok ? '<span class="log-ok">SUCCESS</span>' : '<span class="log-err">FAILED</span>') + '</div>';
            lg.lines.forEach(function (ln) { h += '<div>' + PXBOX._esc(ln) + '</div>'; });
            pan.innerHTML = h;
          }
        }
        pan.style.display = show ? '' : 'none';
        if (btn) btn.classList.toggle('active', show);
      },

      // ── 철근 형상 코드 안내 패널 ──────────────────────────
      toggleRebarInfo: function () {
        var pan = document.getElementById('pxShapeInfo');
        var btn = document.getElementById('btnShapeInfo');
        if (!pan) return;
        var show = pan.style.display === 'none';
        if (show && !pan.innerHTML) pan.innerHTML = this._buildShapeInfo();
        pan.style.display = show ? '' : 'none';
        if (btn) btn.classList.toggle('active', show);
      },

      // TrebarFactory 로 각 코드 형상을 기본 치수로 생성해 미니 SVG 로 작도 (엔진과 항상 일치)
      _buildShapeInfo: function () {
        if (typeof TrebarFactory === 'undefined') return '<p style="color:#94a3b8;">Rebar engine not loaded yet.</p>';
        var CODES = [
          { c: 1,  lbl: 'Code 1'  }, { c: 11, lbl: 'Code 11' }, { c: 11.1, lbl: 'Code 11a' },
          { c: 14, lbl: 'Code 14' }, { c: 15, lbl: 'Code 15' }, { c: 21, lbl: 'Code 21' },
          { c: 23, lbl: 'Code 23' }, { c: 23.1, lbl: 'Code 23a' },
          { c: 41, lbl: 'Code 41' }
        ];
        var h = '<div class="shape-grid">';
        CODES.forEach(function (cd) {
          var t = null;
          try { t = TrebarFactory.create(cd.c, { x: 0, y: 0 }, {}, 0); } catch (e) {}
          if (!t || !t.segments || !t.segments.length) return;
          var minx = 1e18, miny = 1e18, maxx = -1e18, maxy = -1e18;
          t.segments.forEach(function (s) {
            [s.p1, s.p2].forEach(function (pt) {
              minx = Math.min(minx, pt.x); maxx = Math.max(maxx, pt.x);
              miny = Math.min(miny, -pt.y); maxy = Math.max(maxy, -pt.y);   // y 반전 (엔진 y-up)
            });
          });
          var span = Math.max(maxx - minx, maxy - miny, 100);
          var pad = span * 0.45 + 60;
          var vbW = (maxx - minx) + 2 * pad, vbH = (maxy - miny) + 2 * pad;
          var vb = (minx - pad) + ' ' + (miny - pad) + ' ' + vbW + ' ' + vbH;
          // 모든 타일에서 글자/화살표의 "화면 px" 크기 통일 — px(v) = 화면 v px 에 해당하는 도면 단위
          var k = Math.min(176 / vbW, 122 / vbH);
          var px = function (v) { return v / k; };
          var svg = '<svg width="176" height="122" viewBox="' + vb + '" preserveAspectRatio="xMidYMid meet">';
          t.segments.forEach(function (s, i) {
            svg += '<line x1="' + s.p1.x + '" y1="' + (-s.p1.y) + '" x2="' + s.p2.x + '" y2="' + (-s.p2.y) + '" stroke="#1d4ed8" stroke-width="' + px(3) + '" stroke-linecap="round"/>';
            var mx = (s.p1.x + s.p2.x) / 2, my = (-s.p1.y - s.p2.y) / 2;
            var ux = s.p2.x - s.p1.x, uy = -(s.p2.y - s.p1.y), L = Math.hypot(ux, uy) || 1;
            // nor +1(기본) 방향 화살표 (주황) — -1 입력 시 반대방향
            var nx = s.normal.x, ny = -s.normal.y;   // 엔진 y-up → svg y-down
            /*  크랭크(23 · 23a)는 **글자를 법선 쪽에, 화살표를 그 너머에** 둔다.
                기본 배치는 글자를 화살표 반대쪽에 두는데, 크랭크는 그 반대쪽이
                바로 몸통과 코너가 있는 자리라 글자가 형상에 겹쳤다.
                이렇게 두면 a 는 제 세그먼트의 왼쪽, c 는 오른쪽에 놓인다.        */
            var outLbl = (cd.c === 23 || cd.c === 23.1);
            var d0 = outLbl ? 18 : 5, d1 = outLbl ? 30 : 22, dT = outLbl ? 8 : 8;
            var ax0 = mx + nx * px(d0), ay0 = my + ny * px(d0);
            var ax1 = mx + nx * px(d1), ay1 = my + ny * px(d1);
            svg += '<line x1="' + ax0 + '" y1="' + ay0 + '" x2="' + ax1 + '" y2="' + ay1 + '" stroke="#f59e0b" stroke-width="' + px(2) + '" stroke-linecap="round"/>';
            svg += '<line x1="' + ax1 + '" y1="' + ay1 + '" x2="' + (ax1 - nx * px(6) - ny * px(3.5)) + '" y2="' + (ay1 - ny * px(6) + nx * px(3.5)) + '" stroke="#f59e0b" stroke-width="' + px(2) + '" stroke-linecap="round"/>';
            svg += '<line x1="' + ax1 + '" y1="' + ay1 + '" x2="' + (ax1 - nx * px(6) + ny * px(3.5)) + '" y2="' + (ay1 - ny * px(6) - nx * px(3.5)) + '" stroke="#f59e0b" stroke-width="' + px(2) + '" stroke-linecap="round"/>';
            svg += '<text x="' + (ax1 + nx * px(dT)) + '" y="' + (ay1 + ny * px(dT)) + '" font-size="' + px(9) + '" fill="#d97706" text-anchor="middle" dominant-baseline="middle" font-weight="700">+1</text>';
            // 조각 라벨(기호만) — 기본: 화살표 반대쪽. 23·23a: 법선 쪽(화살표 앞) / 14: 다리 상단 끝쪽 / 41: a·e 위, b 위쪽, d 아래쪽
            var lx = outLbl ? (mx + nx * px(9)) : (mx - nx * px(13));
            var ly = outLbl ? (my + ny * px(9)) : (my - ny * px(13));
            if (cd.c === 14) {
              if (i === 0) { lx = s.p1.x - ux / L * px(10); ly = (-s.p1.y) - uy / L * px(10); }   // a: 자유단(상단) 너머
              else { lx = s.p2.x + ux / L * px(10); ly = (-s.p2.y) + uy / L * px(10); }           // b: 자유단(상단) 너머
            } else if (cd.c === 41) {
              if (i === 0) { lx = s.p1.x + (s.p2.x - s.p1.x) * 0.15; ly = my - px(11); }         // a: 날개 위, 좌측(자유단 쪽)
              else if (i === 4) { lx = s.p1.x + (s.p2.x - s.p1.x) * 0.85; ly = my - px(11); }      // e: 날개 위, 우측(자유단 쪽)
              else if (i === 1) { lx = s.p1.x + (s.p2.x - s.p1.x) * 0.25 - px(11); ly = -(s.p1.y + (s.p2.y - s.p1.y) * 0.25); }   // b: 위쪽 1/4, 바깥(좌)
              else if (i === 3) { lx = s.p1.x + (s.p2.x - s.p1.x) * 0.25 + px(11); ly = -(s.p1.y + (s.p2.y - s.p1.y) * 0.25); }   // d: 아래쪽 1/4, 바깥(우)
            }
            svg += '<text x="' + lx + '" y="' + ly + '" font-size="' + px(11) + '" fill="#475569" text-anchor="middle" dominant-baseline="middle" font-weight="700">' + String.fromCharCode(97 + i) + '</text>';
          });
          // 꺾임점 사이각 표기 — 인접 조각 방향으로부터 계산 (엔진 형상과 항상 일치)
          for (var ci = 0; ci < t.segments.length - 1; ci++) {
            var s1 = t.segments[ci], s2 = t.segments[ci + 1];
            var cxp = s1.p2.x, cyp = -s1.p2.y;
            var v1x = s1.p2.x - s1.p1.x, v1y = -(s1.p2.y - s1.p1.y), L1 = Math.hypot(v1x, v1y) || 1;
            var v2x = s2.p2.x - s2.p1.x, v2y = -(s2.p2.y - s2.p1.y), L2 = Math.hypot(v2x, v2y) || 1;
            v1x /= L1; v1y /= L1; v2x /= L2; v2y /= L2;
            var dot = Math.max(-1, Math.min(1, (-v1x) * v2x + (-v1y) * v2y));
            var adeg = Math.round(Math.acos(dot) * 180 / Math.PI);   // 사이각(내각)
            var bx = (-v1x + v2x), by = (-v1y + v2y), bl = Math.hypot(bx, by);
            if (bl < 1e-6) continue;
            bx /= bl; by /= bl;                                      // 코너 내각 이등분(안쪽) 방향
            var spread = ((maxx + minx) / 2 < cxp ? 1 : ((maxx + minx) / 2 > cxp ? -1 : 0)) * px(11);
            svg += '<text x="' + (cxp - bx * px(19) + spread) + '" y="' + (cyp - by * px(19)) + '" font-size="' + px(10) + '" fill="#b45309" text-anchor="middle" dominant-baseline="middle" font-weight="700">' + adeg + '&#176;</text>';
          }
          svg += '</svg>';
          h += '<div class="shape-tile">' + svg + '<div class="shape-code">' + cd.lbl + '</div></div>';
        });
        h += '</div>';
        h += '<div style="font-size:12px;color:#64748b;margin:-6px 0 12px;line-height:1.6;">' +
          '<b>rot</b> 은 <b>반시계(CCW)가 +</b> 입니다 — 화면에서도 반시계로 돕니다. 코드 11 은 rot 0 에서 <b>다리 위 · 몸통 오른쪽</b>이고, 회전만으로는 거울상(다리 아래 · 몸통 오른쪽)을 만들 수 없습니다. 다리가 콘크리트 밖을 향하면 엔진이 안쪽으로 되돌립니다(<code>Physics.keepEndsInsideConcrete</code>). ' +
          '<span style="color:#d97706;font-weight:700;">주황 화살표</span> = 각 조각의 <b>nor 방향 (+1, 미입력 기본값)</b> — 물리가 이 방향의 벽을 찾아 안착합니다. ' +
          '반대방향으로 붙이려면 해당 조각에 <b>-1</b> 을 입력하세요 (예: nors b=-1). rot 입력 시 화살표도 형상과 함께 회전합니다. 조각 <b>기본 길이는 400</b> (code 41 의 b·d 는 1000, segs 미입력 시)입니다.</div>';
        return h;
      },

      // 상단 중앙 토스트 — kind: 'loading'(스피너, 유지) / 'ok'(2.5s 후 자동 숨김) / 'err'(6s)
      _toast: function (msg, kind) {
        var t = document.getElementById('pxToast');
        if (!t) { t = document.createElement('div'); t.id = 'pxToast'; document.body.appendChild(t); }
        t.className = 'px-toast ' + kind;
        t.innerHTML = (kind === 'loading' ? '<span class="px-spin"></span>' : (kind === 'ok' ? '&#10003;' : '&#9888;')) + '<span>' + this._esc(msg) + '</span>';
        t.style.display = 'flex';
        if (this._toastTimer) { clearTimeout(this._toastTimer); this._toastTimer = null; }
        if (kind !== 'loading') {
          this._toastTimer = setTimeout(function () { t.style.display = 'none'; }, kind === 'ok' ? 2500 : 6000);
        }
      },

      loadExcel: function () {
        var fi = document.getElementById('excelFileInput');
        if (!fi) return;
        var self = this;
        fi.value = '';
        fi.onchange = function () {
          var file = fi.files[0]; if (!file) return;
          var sheet = String((document.getElementById('sheetName') || {}).value || 'input').trim();
          if (typeof window.loadSheetData !== 'function') { self._toast('Excel reader is still loading. Please try again.', 'err'); return; }
          self._toast('Loading Excel\u2026', 'loading');
          window.loadSheetData(file, sheet).then(function (data) {
            console.log('[PSCBOX] 엑셀 로드 완료:', sheet, data.length + '행', data);
            self._resetInputs();                 // ① 기존 웹 입력값 전체 초기화 (Dimension/철근)
            self._excelData = data;
            self._loadTypeFromExcel(data);       // ② 'type' 블록 → Section Type (1c/2c)
            var nd = self._loadDimsFromExcel(data);       // ③ 'dim' 블록 → Dimension 표 (대칭/비대칭 자동)
            self._loadCoverFromExcel(data);      // ③-1 'cover' 블록 → 피복 3칸 (deck/exterior/interior)
            self._renderRebarTables();           // ④ 'trebar/lrebar' 블록 → REBAR 표
            var ndu = self._loadDuctFromExcel(data);    // 'duct' 블록 → 매입물 (줄마다 하나)
            self._rebarData = self._parseRebar(data);
            console.log('[PSCBOX] 철근 파싱:', self._rebarData);
            self.redraw();              // 재작도 (physics 포함)
            var nre = self._rebarData ? self._rebarData.length : 0;
            var ntre = 0, nlre = 0;
            (self._rebarData || []).forEach(function (rd) { if (String(rd.type).toLowerCase() === 'lrebar') nlre++; else ntre++; });
            var oncell = document.querySelector('input[name="box12cell_ncell"]:checked');
            var cd = function (id) { var el = document.getElementById(id); return el ? el.value : '?'; };
            self._loadLog = { time: new Date().toLocaleString(), ok: true, lines: [
              'File      : ' + file.name,
              'Sheet     : ' + sheet + '  (' + data.length + ' rows)',
              'Section   : ' + (oncell ? oncell.value : '?') + ' cell',
              'Dims      : ' + (nd || 0),
              'Cover     : deck ' + cd('cover_deck_s') + ' / exterior ' + cd('cover_ext_s') + ' / interior ' + cd('cover_int_s'),
              'Duct      : ' + (ndu ? ndu + ' from file' : 'none'),
              'Rebar     : ' + nre + '  (trebar ' + ntre + ', lrebar ' + nlre + ')'
            ] };
            // 최종 결과 토스트 — 철근 id 중복이면 오류 상태로 (성공 토스트가 덮지 않게)
            if (self._evalErrs && self._evalErrs.length) {
              self._loadLog.ok = false;
              self._loadLog.lines.push('ERROR     : bad number ' + self._evalErrs.join(' / ') + ' — rebar loading skipped');
              self._toast('철근 수치 오류 — 숫자로 읽을 수 없음: ' + self._evalErrs.join(' / ') + ' — 철근 로딩 중단', 'err');
            } else if (self._dupIds && self._dupIds.length) {
              self._loadLog.ok = false;
              self._loadLog.lines.push('ERROR     : duplicate rebar id ' + self._dupIds.join(', ') + ' \u2014 rebar loading skipped');
              self._toast('Duplicate rebar id: ' + self._dupIds.join(', ') + ' \u2014 rebar loading skipped (dims loaded)', 'err');
            } else {
              self._toast('Excel loaded \u2014 dims ' + (nd || 0) + ', rebar ' + nre, 'ok');
            }
          }).catch(function (e) {
            self._loadLog = { time: new Date().toLocaleString(), ok: false, lines: [
              'File      : ' + file.name,
              'Sheet     : ' + sheet,
              'ERROR     : ' + e.message
            ] };
            self._toast('Excel load failed: ' + e.message, 'err');
            console.error('[PSCBOX] 엑셀 로드 오류:', e);
          });
        };
        fi.click();
      },

    // ── PSCBOX 전용 ────────────────────────────────────────────

    // 웹페이지 입력값 전체 초기화 — 엑셀 로딩 직전에 호출.
    //   Dimension 은 숫자 기본값으로, 대칭 체크박스 해제,
    //   Section Type 1 Cell, trebar/lrebar 데이터 비움.
    _resetInputs: function () {
      this._excelData = null;
      this._rebarData = null;
      if (typeof Domain !== 'undefined') {
        Domain.trebarList = []; Domain.lrebarList = []; Domain.queue = [];
        Domain.USER_REBAR_DATA = []; Domain.USER_TREBAR_DATA = null; Domain.USER_LREBAR_DATA = null;
      }
      var defByKey = {};
      adefs_box12cell.forEach(function (d) { defByKey[d[0]] = String(d[1]); });
      DIM_LAYOUT.forEach(function (it) {
        if (it.t === 'group') return;
        var li = document.getElementById(it.l + '_s');
        if (li) li.value = defByKey[it.l];
        if (!it.r) return;
        var ri = document.getElementById(it.r + '_s');
        if (!ri) return;
        if (it.t === 'sym') {
          var cb = document.getElementById('asym_' + it.r);
          if (cb) cb.checked = false;
          ri.disabled = true;
          ri.value = defByKey[it.l];             // 우측은 좌측 미러 기본값
        } else {                                 // free (SLL/SLR) — 각자 기본값
          ri.value = defByKey[it.r];
        }
      });
      var r1 = document.querySelector('input[name="box12cell_ncell"][value="1"]');
      if (r1) r1.checked = true;
      var covDef = { cover_deck_s: '50', cover_ext_s: '40', cover_int_s: '30' };
      Object.keys(covDef).forEach(function (cid) {
        var el = document.getElementById(cid); if (el) el.value = covDef[cid];
      });
    },

    // 'type' 블록 : type | 1c/2c → Section Type 라디오
    _loadTypeFromExcel: function (fullData) {
      if (!Array.isArray(fullData)) return;
      for (var r = 0; r < fullData.length; r++) {
        var row = fullData[r];
        if (this._rowIsEnd(row)) break;
        if (this._rowIsComment(row)) continue;
        for (var c = 0; c < (row ? row.length : 0); c++) {
          if (String(row[c] == null ? '' : row[c]).trim().toLowerCase() !== 'type') continue;
          var v = String(row[c + 1] == null ? '' : row[c + 1]).trim().toLowerCase();
          var n = (v === '2c' || v === '2') ? 2 : ((v === '1c' || v === '1') ? 1 : 0);
          if (!n) { console.warn('[PSCBOX] type 값을 해석할 수 없음: ' + v); return; }
          var rb = document.querySelector('input[name="box12cell_ncell"][value="' + n + '"]');
          if (rb) rb.checked = true;
          console.log('[PSCBOX] type 로드: ' + v + ' → ' + n + ' cell');
          return;
        }
      }
    },

    // 'cover' 블록 : cover | deck | exterior | interior (3칸 순서 고정) → 피복 입력칸
    _loadCoverFromExcel: function (fullData) {
      if (!Array.isArray(fullData)) return;
      for (var r = 0; r < fullData.length; r++) {
        var row = fullData[r];
        if (this._rowIsEnd(row)) break;
        if (this._rowIsComment(row)) continue;
        for (var c = 0; c < (row ? row.length : 0); c++) {
          if (String(row[c] == null ? '' : row[c]).trim().toLowerCase() !== 'cover') continue;
          var ids = ['cover_deck_s', 'cover_ext_s', 'cover_int_s'], n = 0;
          for (var k = 0; k < 3; k++) {
            var v = Number(row[c + 1 + k]);
            if (isFinite(v) && v > 0) { var el = document.getElementById(ids[k]); if (el) { el.value = String(v); n++; } }
          }
          if (n) console.log('[PSCBOX] cover 로드: ' + n + '개 (deck/exterior/interior)');
          return;
        }
      }
    },

    // 'dim' 블록 : dim | 이름 | 값 → Dimension 입력칸.
    //   좌측 변수만 주어지면 우측은 대칭 미러, 우측이 좌측과 다른 값으로 주어지면
    //   비대칭 체크박스를 켜고 독립 입력. '-'(회계서식 0 표시)·빈 값은 0으로 처리.
    _loadDimsFromExcel: function (fullData) {
      if (!Array.isArray(fullData)) return;
      var map = {}, count = 0, keyByLower = {};
      adefs_box12cell.forEach(function (d) { keyByLower[d[0].toLowerCase()] = d[0]; });
      for (var r = 0; r < fullData.length; r++) {
        var row = fullData[r];
        if (this._rowIsEnd(row)) break;
        if (this._rowIsComment(row)) continue;
        var hc = -1;
        for (var c = 0; c < (row ? row.length : 0); c++) { if (String(row[c] == null ? '' : row[c]).trim().toLowerCase() === 'dim') { hc = c; break; } }
        if (hc < 0) continue;
        var name = String(row[hc + 1] == null ? '' : row[hc + 1]).trim();
        var key = keyByLower[name.toLowerCase()];
        if (!key) { if (name) console.warn('[PSCBOX] 알 수 없는 dim 이름: ' + name); continue; }
        var raw = row[hc + 2];
        raw = (raw == null) ? '' : String(raw).trim();
        if (raw === '' || raw === '-' || raw === '\u2013' || raw === '\u2014') raw = '0';
        map[key] = raw; count++;
      }
      if (!count) return 0;
      DIM_LAYOUT.forEach(function (it) {
        if (it.t === 'group') return;
        var li = document.getElementById(it.l + '_s');
        var ri = it.r ? document.getElementById(it.r + '_s') : null;
        if ((it.l in map) && li) li.value = map[it.l];
        if (it.t === 'sym' && ri) {
          var cb = document.getElementById('asym_' + it.r);
          if (it.r in map) {                     // 우측 변수가 엑셀에 명시됨 → 비대칭 체크 + 그 값 입력
            if (cb) cb.checked = true;
            ri.disabled = false;
            ri.value = map[it.r];
          } else {                               // 좌측만 주어짐 → 대칭 미러
            if (cb) cb.checked = false;
            ri.disabled = true;
            ri.value = li ? li.value : '';
          }
        } else if (it.t === 'free' && ri && (it.r in map)) {
          ri.value = map[it.r];
        }
      });
      console.log('[PSCBOX] dim 로드: ' + count + '개');
      return count;
    },

    // 대칭 미러 : 좌측 입력 시 (비대칭 체크가 없으면) 우측 입력칸에 같은 값 복사
    onSymLeft: function (lk, rk) {
      var cb = document.getElementById('asym_' + rk);
      if (cb && cb.checked) return;
      var li = document.getElementById(lk + '_s'), ri = document.getElementById(rk + '_s');
      if (li && ri) ri.value = li.value;
    },

    // 비대칭 체크박스 : 체크 → 우측 독립 입력, 해제 → 좌측값으로 되돌려 미러 재개
    onAsymToggle: function (lk, rk, on) {
      var ri = document.getElementById(rk + '_s');
      if (ri) ri.disabled = !on;
      if (!on) {
        var li = document.getElementById(lk + '_s');
        if (li && ri) ri.value = li.value;
        this.redraw();
      }
    },

    // 파라메트릭 재작도 : Dimension 입력칸(숫자 또는 산술식) 평가 → 가이드 + 물리 뷰
    redraw: function () {
      if (typeof adefs_box12cell === 'undefined') return;
      var ap = {};
      adefs_box12cell.forEach(function (d) {
        var el = document.getElementById(d[0] + '_s');
        var raw = el ? el.value : String(d[1]);
        ap[d[0]] = (typeof Calc !== 'undefined') ? Calc.num(raw, {}, Number(raw)) : Number(raw);
        // 숫자로 못 읽히면 형상이 조용히 깨지므로 어디가 문제인지 남긴다 (변수명은 더 이상 못 씀)
        if (!isFinite(ap[d[0]])) console.error('[PSCBOX] Dimension "' + d[0] + '" 를 숫자로 읽을 수 없음: "' + raw + '"');
      });
      var oncell = document.querySelector('input[name="box12cell_ncell"]:checked');
      ap.NCELL = oncell ? (Number(oncell.value) || 2) : 2;
      this._lastAp = ap;
      if (typeof toggleCenterVars_box12cell === 'function') toggleCenterVars_box12cell(ap.NCELL);
      var ghdr = document.querySelector('#box12cell_vartable .px-2cell-hdr');
      if (ghdr) ghdr.style.display = (ap.NCELL === 1) ? 'none' : '';
      try { draw_box12cell_guide('box12cell_guide', ap); }
      catch (e) { console.error('[PSCBOX] guide:', e); }
      // 물리 뷰용 외곽 캡처 (geo 출력을 직접 사용)
      try {
        var g = geo_box12cell(ap);
        this._lines = g.lines.map(function (l) { return [l.x1, l.y1, l.x2, l.y2]; });
        this._arcs = g.arcs.map(function (a) { return [a.x, a.y, a.r, a.angb, a.ange]; });
        this._circs = [];
        this._drawRebar();
      } catch (e) { console.error('[PSCBOX] section:', e); }
    },

    // 단면 DXF (가이드 기준 형상)
    sectionDXF: function () {
      if (!this._lastAp) return;
      var g = geo_box12cell(this._lastAp);
      var o = dxf_generator();
      o.init();
      o.layer('pscbox', 4, 'CONTINUOUS');
      g.lines.forEach(function (l) { o.line(l.x1, l.y1, l.x2, l.y2, 'pscbox'); });
      g.arcs.forEach(function (a) { o.arc(a.x, a.y, a.r, a.angb, a.ange, 'pscbox'); });
      o.download('PSCBox.dxf');
    },

    // 물리 뷰 (generic 어댑터 경로만)
    _drawRebar: function () {
      if (typeof UI === 'undefined' || typeof Domain === 'undefined') return;
      if (!this._ensureRebarHost()) return;
      if (!this._uiInited) {
        try { UI.init(); this._uiInited = true; } catch (e) { console.error('[PSCBOX] UI.init:', e); return; }
      }
      this._rebarSettled = false;
      if (this._settleTimer) { clearInterval(this._settleTimer); this._settleTimer = null; }
      if (UI.anim && UI.anim.start) UI.anim.start();
      this._renderPhysicsTable();          // 스폰 직후 표 갱신 (안착 전 — 길이는 settle 후 확정)
      try {
        var sec = this._buildSectionFromBim();
        if (sec && sec.walls.length) this._applyGenericSection(sec);
        else console.warn('[PSCBOX] no walls from outline');
        this._fitEngineStage();
        var self = this;
        setTimeout(function () { self._fitEngineStage(); }, 80);   // 레이아웃 확정 후 재보정
        this._syncEngineBtn();
        /*  J 엔진은 한 번에 푼다. 그래도 **태어난 자리를 먼저 한 번 보여 준다** —
            Respawn 을 누르는 이유가 대개 「init 을 어디에 놓았나」를 보려는 것이라,
            곧장 답으로 건너뛰면 그 자리가 화면에 한 번도 안 나온다.
            잠깐 스폰 상태를 그려 두고, 그 다음 프레임에 풀어서 최종 형상으로 바꾼다.
            예전 엔진은 프레임마다 조금씩 움직이므로 _watchSettle 이 지켜본다.     */
        if (this._engine === 'jfield') {
          try { if (typeof UI.updateVisuals === 'function') UI.updateVisuals(); } catch (e) {}
          if (UI.mainLayer) UI.mainLayer.draw();
          var selfJ = this;
          setTimeout(function () {
            if (selfJ._solveWithJField()) selfJ._finalizeArcs();
          }, selfJ.SPAWN_HOLD);
        } else this._watchSettle();
      } catch (e) { console.error('[PSCBOX] rebar render:', e); }
    },

    // 페이지 구성
    mount: function (mountId) {
      this._mountId = mountId || 'mount-draw-pscbox';
      var root = document.getElementById(this._mountId);
      if (!root) return;
      if (typeof adefs_box12cell === 'undefined') {
        root.innerHTML = '<p style="color:#b91c1c;padding:16px;">bim_box12cell.js failed to load.</p>';
        return;
      }

      // 좌/우 대칭 쌍 레이아웃 — sym: 우측은 좌측을 미러(체크박스로 비대칭 입력), free: 좌우 독립(부호가 다른 슬로프), single: 단독
      var lblMap = {};
      adefs_box12cell.forEach(function (d) { lblMap[d[0]] = ((d.length > 2) ? d[2] : d[0]).replace('(0, if not necessary)', '<small>(0=X)</small>'); });
      var layout = DIM_LAYOUT;
      // 초기값 : adefs_box12cell 의 기본 수치. (Variables 카드가 있던 때는 변수명을 넣어
      //          같은 이름의 변수를 참조했지만, 이제 칸에 숫자가 직접 들어간다.)
      var defByKey = {};
      adefs_box12cell.forEach(function (d) { defByKey[d[0]] = String(d[1]); });
      function dimDef(key) { return defByKey[key] == null ? '' : defByKey[key]; }
      function dimInput(key, extra) {
        return '<input type="text" spellcheck="false" class="form-input" id="' + key + '_s" value="' + dimDef(key) + '" onchange="PXBOX.redraw()"' + (extra || '') + '>';
      }
      var rows = layout.map(function (it) {
        if (it.t === 'group') return '<tr class="px-2cell-hdr"><td colspan="5">' + it.label + '</td></tr>';
        if (it.t === 'single') return '<tr><td class="px-dim">' + lblMap[it.l] + '</td><td>' + dimInput(it.l) + '</td><td class="px-symc"></td><td class="px-dim"></td><td></td></tr>';
        if (it.t === 'free')   return '<tr><td class="px-dim">' + lblMap[it.l] + '</td><td>' + dimInput(it.l) + '</td><td class="px-symc"></td>' +
                                      '<td class="px-dim">' + lblMap[it.r] + '</td><td>' + dimInput(it.r) + '</td></tr>';
        // sym : 좌측 입력 → 우측 미러. 체크박스 체크 시 우측 독립 입력(비대칭).
        return '<tr><td class="px-dim">' + lblMap[it.l] + '</td>' +
               '<td><input type="text" spellcheck="false" class="form-input" id="' + it.l + '_s" value="' + dimDef(it.l) + '" ' +
                   'oninput="PXBOX.onSymLeft(\'' + it.l + '\',\'' + it.r + '\')" onchange="PXBOX.redraw()"></td>' +
               '<td class="px-symc"><input type="checkbox" id="asym_' + it.r + '" title="Check to enter the right side independently (asymmetric)" ' +
                   'onchange="PXBOX.onAsymToggle(\'' + it.l + '\',\'' + it.r + '\',this.checked)"></td>' +
               '<td class="px-dim">' + lblMap[it.r] + '</td>' +
               '<td><input type="text" spellcheck="false" class="form-input" id="' + it.r + '_s" value="' + dimDef(it.l) + '" disabled ' +
                   'onchange="PXBOX.redraw()"></td></tr>';
      }).join('');

      root.innerHTML =
        '<style>' + CSS + '</style>' +
        '<div class="px-root">' +

        '  <div class="px-menubar">' +
        '    <span class="px-mb-label">Sheet Name :</span>' +
        '    <input type="text" spellcheck="false" id="sheetName" class="form-input" value="input" style="width:90px;" title="Excel sheet name">' +
        '    <button type="button" class="px-btn" onclick="PXBOX.loadExcel()">&#8682; Load Excel</button>' +
        '    <button type="button" class="px-btn px-btn-lite" id="btnViewLog" onclick="PXBOX.toggleLoadLog()">&#128220; View Log</button>' +
        '    <input type="file" id="excelFileInput" accept=".xlsx,.xls" style="display:none;">' +
        '  </div>' +
        '  <div id="pxLoadLog" class="px-logpanel" style="display:none;"></div>' +

        '  <div class="draw-card">' +
        '    <div class="draw-card-header"><div><span class="draw-card-title">Dimension (mm)</span> <span class="draw-card-desc">PSC box girder &mdash; 1 / 2 cell</span></div>' +
        '      <button type="button" class="px-btn" onclick="PXBOX.sectionDXF()">&#8681; DXF</button></div>' +
        '    <div class="draw-card-body">' +
        '      <div class="px-radio px-optrow">' +
        '        <div class="px-opthalf"><b>Section Type :</b>' +
        '          <label><input type="radio" name="box12cell_ncell" value="1" checked onchange="PXBOX.redraw()"> 1 Cell</label>' +
        '          <label><input type="radio" name="box12cell_ncell" value="2" onchange="PXBOX.redraw()"> 2 Cell</label>' +
        '        </div>' +
        '        <div class="px-opthalf"><b>Cover Depth (mm) :</b>' +
        '          <label>Deck <input type="text" spellcheck="false" class="form-input px-cover" id="cover_deck_s" value="50" onchange="PXBOX.redraw()" title="Top slab (deck) cover"></label>' +
        '          <label>Exterior <input type="text" spellcheck="false" class="form-input px-cover" id="cover_ext_s" value="40" onchange="PXBOX.redraw()" title="Outer surface cover"></label>' +
        '          <label>Interior <input type="text" spellcheck="false" class="form-input px-cover" id="cover_int_s" value="30" onchange="PXBOX.redraw()" title="Cell (void) surface cover"></label>' +
        '        </div>' +
        '      </div>' +
        '      <div class="px-split">' +
        '        <div class="px-guide" id="box12cell_guide"></div>' +
        '        <div class="px-tblwrap" id="box12cell_vartable">' +
        '          <table class="px-tbl dim-tbl"><thead><tr><th>Dimension</th><th>Value / Formula</th><th class="px-symh" title="Check to enter the right side independently">&#8646;</th><th>Dimension</th><th>Value / Formula</th></tr></thead>' +
        '          <tbody>' + rows + '</tbody></table>' +
        '        </div>' +
        '      </div>' +
        '    </div>' +
        '  </div>' +

        '  <div class="draw-card">' +
        '    <div class="draw-card-header"><div><span class="draw-card-title">REBAR</span> <span class="draw-card-desc">trebar / lrebar input data</span></div>' +
        '      <span style="display:inline-flex;gap:6px;align-items:center;">' +
        '        <span id="pxRebarTools" style="display:inline-flex;gap:6px;align-items:center;"></span>' +
        '        <button type="button" class="engine-btn engine-btn-lite" id="btnShapeInfo" onclick="PXBOX.toggleRebarInfo()" title="Rebar shape codes"><i class="bi bi-info-circle"></i> Shape Codes</button>' +
        '      </span></div>' +
        '    <div class="draw-card-body"><div id="pxShapeInfo" style="display:none;"></div><div id="rebarBody"></div></div>' +
        '  </div>' +

        '</div>';

      // ui.js 가 참조하는 숨김 DOM (sectionSelect / toggle 버튼)
      if (!document.getElementById('sectionSelect')) {
        var hid = document.createElement('div');
        hid.style.display = 'none';
        hid.innerHTML = '<select id="sectionSelect"><option value="PSCBOX" selected>PSCBOX</option></select>';
        root.appendChild(hid);
      }

      this._excelData = null; this._rebarData = null; this._uiInited = false;
      this._renderRebarTables();
      this.redraw();          // 가이드 + (마운트되는) Rebar Physics 카드
    }
  };
  window.PXBOX = PXBOX;

  window.fdraw_pscbox = function (mountId) {
    ensureDeps(function () { PXBOX.mount(mountId); });
  };
})();
