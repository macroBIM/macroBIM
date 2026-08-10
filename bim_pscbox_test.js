/*
    bim_pscbox_test.js — PSCBOX (1/2-cell box girder) page for layout_body_test.js.  v2

    Single entry: fdraw_pscbox(mountId). Full parametric stack ported from the
    Seoul PhD app, specialized to box12cell:
      · Variables card  — name/formula rows (calc.js scope, sequential refs)
      · Dimension card  — Section Type radio + live RWSVG guide + scrollable
                          variable-mapping table (inputs hold formulas)
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
    if (!hasGlobal('geo_fillet')) need.push(PAGES + 'geomath.js?v=2');
    if (!hasGlobal('dxf_generator')) need.push(PAGES + 'bim_dxf.js?v=2');
    if (typeof window.RWSVG === 'undefined') need.push(PAGES + 'bim_draw_test_core.js?v=2');
    if (!hasGlobal('geo_box12cell')) need.push(PAGES + 'bim_box12cell.js?v=3');
    if (typeof window.Calc === 'undefined') need.push(PAGES + 'calc.js?v=2');
    if (typeof window.ExcelJS === 'undefined') need.push('https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js');
    if (typeof window.loadSheetData === 'undefined') need.push(PAGES + 'excel_reader.js?v=2');
    if (!hasGlobal('EquationParser')) need.push(PAGES + 'equation.js?v=2');
    if (!hasGlobal('TrebarFactory')) need.push(PAGES + 'trebar.js?v=2');
    if (!hasGlobal('LRebarEngine')) need.push(PAGES + 'lrebar.js?v=2');
    if (!hasGlobal('Physics')) need.push(PAGES + 'physics.js?v=7');
    if (!hasGlobal('SectionBase')) need.push(PAGES + 'section.js?v=2');
    if (!hasGlobal('Domain')) need.push(PAGES + 'domain.js?v=2');
    if (!hasGlobal('UI')) need.push(PAGES + 'ui.js?v=2');
    (function next(i) {
      if (i >= need.length) { cb(); return; }
      var s = document.createElement('script');
      s.src = need[i];
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
    '.px-toast{position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;align-items:center;gap:9px;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;box-shadow:0 4px 14px rgba(0,0,0,.18);color:#fff;font-family:"Inter",system-ui,sans-serif;}' +
    '.px-toast.loading{background:#2563eb;}.px-toast.ok{background:#059669;}.px-toast.err{background:#dc2626;}' +
    '.px-toast .px-spin{width:14px;height:14px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:pxspin .8s linear infinite;flex-shrink:0;}' +
    '@keyframes pxspin{to{transform:rotate(360deg)}}';

  var PXBOX = {
    _mountId: 'mount-draw-pscbox',
    _vars: null, _excelData: null, _rebarData: null,
    _lines: [], _arcs: [], _circs: [],
    _uiInited: false, _settleTimer: null, _rebarSettled: false, _lastAp: null, _lastStuckMsg: null,
    _showEngNormals: false, _showEngNodes: false, _engNormGroup: null, _engNodeGroup: null,

      _renderRebarTables: function () {
        var body = document.getElementById('rebarBody');
        if (!body) return;

        // 2줄 표제목 = trebar / lrebar 입력체계
        var SCHEMA = [
          ['trebar', 'id', 'code', 'dia', 'init (x, y, rot)', 'set', 'segs (len)', 'angs', 'nors', 'barStart', 'barEnd', 'radius', 'z'],
          ['lrebar', 'id', 'dia', 'num', 'init', 'nors', 'range', 'path', 'ctc', 'ctcmax', 'ctcmin', '', 'z']
        ];
        var ncol = SCHEMA[0].length;

        // 엑셀 데이터 행 추출: 첫 셀이 trebar/lrebar 인 행(= 데이터). #trebar/#lrebar(헤더)·빈 행 무시
        var dataRows = this._excelData ? this._extractRebarDataRows(this._excelData) : [];

        function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

        var h = '<div class="rebar-table-wrap"><table class="rebar-table"><thead>';
        SCHEMA.forEach(function (row) {
          h += '<tr class="rebar-schema-row">';
          for (var i = 0; i < ncol; i++) h += '<th class="' + (i === 0 ? 'rs-type' : '') + '">' + esc(row[i]) + '</th>';
          h += '</tr>';
        });
        h += '</thead><tbody>';
        if (dataRows.length) {
          dataRows.forEach(function (r) { h += '<tr>'; for (var i = 0; i < ncol; i++) h += '<td>' + esc(r[i]) + '</td>'; h += '</tr>'; });
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

      _loadVariablesFromExcel: function (fullData) {
        if (!Array.isArray(fullData)) return;
        var vars = [];
        for (var r = 0; r < fullData.length; r++) {
          var row = fullData[r];
          if (this._rowIsEnd(row)) break;          // end → 종료
          if (this._rowIsComment(row)) continue;   // #variable/! 주석 무시
          var hc = -1;
          for (var c = 0; c < (row ? row.length : 0); c++) { if (String(row[c] == null ? '' : row[c]).trim().toLowerCase() === 'variable') { hc = c; break; } }
          if (hc < 0) continue;                 // 타 블록·빈 행은 무시(빈 줄이어도 계속)
          var name = String(row[hc + 1] == null ? '' : row[hc + 1]).trim();
          if (!name) continue;
          var expr = row[hc + 2];
          expr = (expr == null) ? '' : String(expr).trim();
          vars.push({ name: name, expr: expr });
        }
        if (!vars.length) return 0;
        this._vars = vars;                      // 엑셀 variable 블록으로 교체 (로딩 전 초기화됨)
        this._renderVarRows();                  // Variables 카드 입력창 갱신
        console.log('[PSCBOX] variable 로드: ' + vars.length + '개 → ' + vars.map(function (v) { return v.name + '=' + v.expr; }).join(', '));
        return vars.length;
      },

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
        var rows = this._extractRebarDataRows(fullData), out = [], self = this;
        rows.forEach(function (row) {
          var type = self._rbStr(row[0]).toLowerCase();
          out.push(type === 'lrebar' ? self._parseLrebarRow(row) : self._parseTrebarRow(row));
        });
        return out;
      },

      _parseTrebarRow: function (row) {
        var o = { type: 'trebar', id: this._rbStr(row[1]) };
        if (this._rbHas(row[2])) o.code = Number(row[2]);
        if (this._rbHas(row[3])) o.dia = Number(row[3]);
        var init = this._rbInit(row[4], ['x', 'y', 'rot']); if (init) o.init = init;
        var segs = this._rbSegs(row[6], row[5]); if (segs) o.segs = segs;
        var angs = this._rbAngs(row[7]); if (angs) o.angs = angs;
        var nors = this._rbNors(row[8]); if (nors) o.nors = nors;
        var be = {}, bs = this._rbEnd(row[9]), bee = this._rbEnd(row[10]);
        if (bs) be.start = bs; if (bee) be.end = bee;
        if (Object.keys(be).length) o.barEnds = be;
        if (this._rbHas(row[11])) o.radius = Number(row[11]);   // 굴짐반경(선택) — 없으면 dia 기본값
        o.z = this._rbHas(row[12]) ? Number(row[12]) : 0;       // z-order(층) — 미입력=0. 같은 z 끼리만 반발
        return o;
      },

      _parseLrebarRow: function (row) {
        var o = { type: 'lrebar', id: this._rbStr(row[1]), bar: {} };
        if (this._rbHas(row[2])) o.bar.dia = Number(row[2]);
        if (this._rbHas(row[3])) o.bar.num = Number(row[3]);
        if (this._rbHas(row[8])) o.bar.ctc = Number(row[8]);
        if (this._rbHas(row[9])) o.bar.max = Number(row[9]);
        if (this._rbHas(row[10])) o.bar.min = Number(row[10]);
        var init = this._rbInit(row[4], ['x', 'y', 'rot']); if (init) o.init = init;   // init 은 x,y,rot 만 (grav 분리)
        // nors(row[5]) = 종방향 철근 중력방향(-1/+1). init 에 섞지 않고 별도 칸에서 읽어 엔진이 쓰는 init.grav 로 전달
        if (this._rbHas(row[5])) { if (!o.init) o.init = {}; o.init.grav = Number(row[5]); }
        var range = this._rbRange(row[6]); if (range) o.range = range;
        var path = this._rbList(row[7]).map(function (s) { return s.toUpperCase(); });
        if (path.length) o.path = path;
        o.z = this._rbHas(row[12]) ? Number(row[12]) : 0;       // z-order(층) — 미입력=0
        return o;
      },

      _rbStr: function (v) { return String(v == null ? '' : v).trim(); },

      _rbHas: function (v) { return v != null && String(v).trim() !== ''; },

      _rbNum: function (v) { v = this._rbStr(v); if (v === '') return undefined; return isNaN(Number(v)) ? v : Number(v); },

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
              '<button type="button" class="engine-btn" onclick="PXBOX.exportDXF()"><i class="bi bi-download"></i> Export DXF</button>' +
              '<button type="button" class="engine-btn engine-btn-lite" id="btnToggleNormals" onclick="PXBOX.toggleNormals()"><i class="bi bi-arrows-angle-expand"></i> Toggle Normals</button>' +
              '<button type="button" class="engine-btn engine-btn-lite" id="btnToggleNodes" onclick="PXBOX.toggleNodes()"><i class="bi bi-123"></i> Toggle Nodes (#)</button>' +
            '</div>' +
            '<div class="draw-card-desc" id="stat-grid"></div>' +
          '</div>' +
          '<div class="draw-card-body" style="padding:0;">' +
            '<div id="renderContainer" style="width:100%;height:600px;background:#41699b;border-radius:0 0 10px 10px;overflow:hidden;cursor:grab;"></div>' +
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
        var w = rc.clientWidth || 800, h = rc.clientHeight || 600;
        UI.stage.width(w); UI.stage.height(h);

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

      toggleNormals: function () {
        this._showEngNormals = !this._showEngNormals;
        var b = document.getElementById('btnToggleNormals');
        if (b) b.classList.toggle('active', this._showEngNormals);
        this._drawEngineNormals();
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
        var dia = t.dia || 13;
        group.add(new Konva.Line({ points: pts, stroke: '#8A2BE2', strokeWidth: (dia > 0 ? dia : 5), lineCap: 'round', lineJoin: 'round', strokeScaleEnabled: true }));
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
            console.warn('[SeoulPhD] 철근 안착 실패 → 스킵:', id, '(' + kind + ') — num 미입력/0, init·range NaN, 또는 path 벽 id 불일치 확인');
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
        this._relaxRebar();                                                        // 통합 z-order 겹침 해소 (trebar 강체 + lrebar 점) — 그리기 전에
        var self = this, formed = 0;
        Domain.trebarList.forEach(function (t) {                                   // 이동된 위치로 작도
          if (t.state === 'FORMED') { self._drawFilletedTrebar(t, UI.trebarGroup); formed++; }
          else self._drawStraightTrebar(t, UI.trebarGroup);   // 미안착 바는 직선으로 남겨 사라지지 않게
        });
        this._drawLrebarTrue();                                                    // lrebar 실제 반경으로 재작도
        if (UI.mainLayer) UI.mainLayer.draw();
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
        (Domain.lrebarList || []).forEach(function (g) {
          if (!g || !g.particles) return;
          var r = (g.dia || 13) / 2;
          g.particles.forEach(function (p) {
            UI.lrebarGroup.add(new Konva.Circle({ x: p.x, y: p.y, radius: r, fill: '#FFD700', stroke: '#B8860B', strokeWidth: Math.max(r * 0.18, 0.8), strokeScaleEnabled: true }));
          });
        });
      },

      _drawStraightTrebar: function (t, group) {
        var segs = t.segments || [], dia = t.dia || 13;
        segs.forEach(function (s) {
          var pts = (s.state === 'SETTLED')
            ? [s.p1.x, s.p1.y, s.p2.x, s.p2.y]
            : [s.nodes[0].x, s.nodes[0].y, s.nodes[1].x, s.nodes[1].y];
          group.add(new Konva.Line({ points: pts, stroke: '#8A2BE2', strokeWidth: (dia > 0 ? dia : 5), lineCap: 'round', strokeScaleEnabled: true }));
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
        loops.forEach(function (loop) {
          if (!loop.length) return;
          var pts = [{ x: loop[0].x1, y: loop[0].y1 }];
          loop.forEach(function (seg) {
            var mx = (seg.x1 + seg.x2) / 2, my = (seg.y1 + seg.y2) / 2;
            var dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1, len = Math.hypot(dx, dy) || 1;
            var nx = -dy / len, ny = dx / len;
            if (!inside(mx + nx * eps, my + ny * eps)) {
              if (inside(mx - nx * eps, my - ny * eps)) { nx = -nx; ny = -ny; }
              else { var vx = cx - mx, vy = cy - my, vl = Math.hypot(vx, vy) || 1; nx = vx / vl; ny = vy / vl; }
            }
            eid++;
            walls.push({ id: 'E' + eid, tag: 'outer', nx: nx, ny: ny, x1: seg.x1, y1: seg.y1, x2: seg.x2, y2: seg.y2, src: seg.src || null });
            pts.push({ x: seg.x2, y: seg.y2 });
          });
          displayPaths.push(pts);
        });
        return { walls: walls, displayPaths: displayPaths, covers: { top: 50, outer: 50, inner: 50 } };
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

      _renderVarRows: function () {
        var body = document.getElementById('varBody');
        if (!body) return;
        if (!this._vars || !this._vars.length) this._vars = [{ name: '', expr: '' }];
        var self = this, h = '';
        function half(i) {
          var v = self._vars[i];
          if (!v) return '<td class="var-c-name"></td><td></td><td class="var-c-val"></td><td class="var-c-del"></td>';
          return '<td class="var-c-name"><input class="form-input var-name" placeholder="Name" value="' + self._esc(v.name) + '" oninput="PXBOX.onVarInput(' + i + ',\'name\',this.value)" onchange="PXBOX.onVarChange()"></td>' +
                 '<td><input class="form-input var-expr" placeholder="Value / Formula" value="' + self._esc(v.expr) + '" oninput="PXBOX.onVarInput(' + i + ',\'expr\',this.value)" onchange="PXBOX.onVarChange()"></td>' +
                 '<td class="var-c-val"><span class="var-val" id="varval-' + i + '"></span></td>' +
                 '<td class="var-c-del"><button type="button" class="var-del" title="Delete row" onclick="PXBOX.removeVarRow(' + i + ')">×</button></td>';
        }
        for (var i = 0; i < this._vars.length; i += 2) h += '<tr>' + half(i) + half(i + 1) + '</tr>';
        body.innerHTML = h;
        this._evalScope();   // 미리보기 갱신
      },

      onVarInput: function (i, key, val) {
        if (!this._vars || !this._vars[i]) return;
        this._vars[i][key] = val;
        this._evalScope();   // 계산값 미리보기만 (재작도는 onchange)
      },

      onVarChange: function () { this.redraw(); },

      addVarRow: function () { if (!this._vars) this._vars = []; this._vars.push({ name: '', expr: '' }); this._renderVarRows(); },

      removeVarRow: function (i) {
        if (!this._vars) return;
        this._vars.splice(i, 1);
        if (!this._vars.length) this._vars.push({ name: '', expr: '' });
        this._renderVarRows();
        this.onVarChange();
      },

      _evalScope: function () {
        var scope = {}, errors = [];
        if (typeof Calc !== 'undefined') { var b = Calc.buildScope(this._vars || []); scope = b.scope; errors = b.errors; }
        var errMap = {}; errors.forEach(function (e) { errMap[e.name] = e.msg; });
        (this._vars || []).forEach(function (v, i) {
          var span = document.getElementById('varval-' + i);
          if (!span) return;
          var nm = String(v.name || '').trim();
          if (!nm) { span.textContent = ''; span.className = 'var-val'; return; }
          if (errMap[nm] || !(nm in scope) || !isFinite(scope[nm])) { span.textContent = '⚠ ' + (errMap[nm] || 'error'); span.className = 'var-val err'; }
          else { span.textContent = '= ' + (Math.round(scope[nm] * 1000) / 1000); span.className = 'var-val ok'; }
        });
        return scope;
      },

      _esc: function (v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },

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
            self._resetInputs();                 // ① 기존 웹 입력값 전체 초기화 (Variables/Dimension/철근)
            self._excelData = data;
            var nv = self._loadVariablesFromExcel(data);  // ② 'variable' 블록 → Variables 카드 (교체)
            self._loadTypeFromExcel(data);       // ③ 'type' 블록 → Section Type (1c/2c)
            var nd = self._loadDimsFromExcel(data);       // ④ 'dim' 블록 → Dimension 표 (대칭/비대칭 자동)
            self._renderRebarTables();           // ⑤ 'trebar/lrebar' 블록 → REBAR 표
            self._rebarData = self._parseRebar(data);
            console.log('[PSCBOX] 철근 파싱:', self._rebarData);
            self.redraw();              // 재작도 (physics 포함)
            self._toast('Excel loaded \u2014 variables ' + (nv || 0) + ', dims ' + (nd || 0) + ', rebar ' + (self._rebarData ? self._rebarData.length : 0), 'ok');
          }).catch(function (e) { self._toast('Excel load failed: ' + e.message, 'err'); console.error('[PSCBOX] 엑셀 로드 오류:', e); });
        };
        fi.click();
      },

    // ── PSCBOX 전용 ────────────────────────────────────────────

    // Variables 카드 시딩 : adefs_box12cell 의 (이름, 기본값)
    _seedVars: function () {
      var vars = [];
      adefs_box12cell.forEach(function (d) { vars.push({ name: d[0], expr: String(d[1]) }); });
      this._vars = vars;
      this._renderVarRows();
    },

    // 웹페이지 입력값 전체 초기화 — 엑셀 로딩 직전에 호출.
    //   Variables 카드 완전 비움(엑셀 variable 블록만 남게), Dimension 은 숫자
    //   기본값으로(변수 참조가 남아 깨지지 않도록), 대칭 체크박스 해제,
    //   Section Type 1 Cell, trebar/lrebar 데이터 비움.
    _resetInputs: function () {
      this._vars = [{ name: '', expr: '' }];
      this._renderVarRows();
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

    // 파라메트릭 재작도 : Variables scope → 매핑 수식 평가 → 가이드 + 물리 뷰
    redraw: function () {
      if (typeof adefs_box12cell === 'undefined') return;
      var scope = this._evalScope();
      var ap = {};
      adefs_box12cell.forEach(function (d) {
        var el = document.getElementById(d[0] + '_s');
        var raw = el ? el.value : String(d[1]);
        ap[d[0]] = (typeof Calc !== 'undefined') ? Calc.num(raw, scope, Number(raw)) : Number(raw);
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
      try {
        var sec = this._buildSectionFromBim();
        if (sec && sec.walls.length) this._applyGenericSection(sec);
        else console.warn('[PSCBOX] no walls from outline');
        this._fitEngineStage();
        var self = this;
        setTimeout(function () { self._fitEngineStage(); }, 80);   // 레이아웃 확정 후 재보정
        this._watchSettle();
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
      function dimInput(key, extra) {
        return '<input type="text" spellcheck="false" class="form-input" id="' + key + '_s" value="' + key + '" onchange="PXBOX.redraw()"' + (extra || '') + '>';
      }
      var rows = layout.map(function (it) {
        if (it.t === 'group') return '<tr class="px-2cell-hdr"><td colspan="5">' + it.label + '</td></tr>';
        if (it.t === 'single') return '<tr><td class="px-dim">' + lblMap[it.l] + '</td><td>' + dimInput(it.l) + '</td><td class="px-symc"></td><td class="px-dim"></td><td></td></tr>';
        if (it.t === 'free')   return '<tr><td class="px-dim">' + lblMap[it.l] + '</td><td>' + dimInput(it.l) + '</td><td class="px-symc"></td>' +
                                      '<td class="px-dim">' + lblMap[it.r] + '</td><td>' + dimInput(it.r) + '</td></tr>';
        // sym : 좌측 입력 → 우측 미러. 체크박스 체크 시 우측 독립 입력(비대칭).
        return '<tr><td class="px-dim">' + lblMap[it.l] + '</td>' +
               '<td><input type="text" spellcheck="false" class="form-input" id="' + it.l + '_s" value="' + it.l + '" ' +
                   'oninput="PXBOX.onSymLeft(\'' + it.l + '\',\'' + it.r + '\')" onchange="PXBOX.redraw()"></td>' +
               '<td class="px-symc"><input type="checkbox" id="asym_' + it.r + '" title="Check to enter the right side independently (asymmetric)" ' +
                   'onchange="PXBOX.onAsymToggle(\'' + it.l + '\',\'' + it.r + '\',this.checked)"></td>' +
               '<td class="px-dim">' + lblMap[it.r] + '</td>' +
               '<td><input type="text" spellcheck="false" class="form-input" id="' + it.r + '_s" value="' + it.l + '" disabled ' +
                   'onchange="PXBOX.redraw()"></td></tr>';
      }).join('');

      root.innerHTML =
        '<style>' + CSS + '</style>' +
        '<div class="px-root">' +

        '  <div class="draw-card">' +
        '    <div class="draw-card-header"><div><span class="draw-card-title">Variables</span> <span class="draw-card-desc">(constants &amp; formulas &mdash; referenced by Dimension below. e.g. WL=6800, WR=WL/2)</span></div>' +
        '      <button type="button" class="px-btn" onclick="PXBOX.addVarRow()">+ Add</button></div>' +
        '    <div class="draw-card-body"><div class="var-tblwrap">' +
        '      <table class="px-tbl var-tbl"><thead><tr>' +
        '        <th>Variable</th><th>Value / Formula</th><th></th><th class="var-c-del"></th>' +
        '        <th>Variable</th><th>Value / Formula</th><th></th><th class="var-c-del"></th>' +
        '      </tr></thead><tbody id="varBody"></tbody></table>' +
        '    </div></div>' +
        '  </div>' +

        '  <div class="draw-card">' +
        '    <div class="draw-card-header"><div><span class="draw-card-title">Dimension (mm)</span> <span class="draw-card-desc">PSC box girder &mdash; 1 / 2 cell</span></div>' +
        '      <button type="button" class="px-btn" onclick="PXBOX.sectionDXF()">&#8681; DXF</button></div>' +
        '    <div class="draw-card-body">' +
        '      <div class="px-radio"><b>Section Type :</b>' +
        '        <label><input type="radio" name="box12cell_ncell" value="1" checked onchange="PXBOX.redraw()"> 1 Cell</label>' +
        '        <label><input type="radio" name="box12cell_ncell" value="2" onchange="PXBOX.redraw()"> 2 Cell</label>' +
        '      </div>' +
        '      <div class="px-split">' +
        '        <div class="px-guide" id="box12cell_guide"></div>' +
        '        <div class="px-tblwrap" id="box12cell_vartable">' +
        '          <table class="px-tbl"><thead><tr><th>Dimension</th><th>Value / Formula</th><th class="px-symh" title="Check to enter the right side independently">&#8646;</th><th>Dimension</th><th>Value / Formula</th></tr></thead>' +
        '          <tbody>' + rows + '</tbody></table>' +
        '        </div>' +
        '      </div>' +
        '    </div>' +
        '  </div>' +

        '  <div class="draw-card">' +
        '    <div class="draw-card-header"><div><span class="draw-card-title">REBAR</span> <span class="draw-card-desc">trebar / lrebar input data</span></div>' +
        '      <span id="pxRebarTools" style="display:inline-flex;gap:6px;align-items:center;"></span></div>' +
        '    <div class="draw-card-body"><div id="rebarBody"></div></div>' +
        '  </div>' +

        '</div>';

      // Excel controls (sheet name + Load Excel) live on the page headline; fall back to the REBAR header when no headline exists.
      var toolsHTML =
        '<span style="font-size:12.5px;font-weight:600;color:#475569;white-space:nowrap;">Sheet Name :</span>' +
        '<input type="text" id="sheetName" class="form-input" value="input" style="width:90px;" title="Excel sheet name">' +
        '<button type="button" class="px-btn" onclick="PXBOX.loadExcel()">&#8682; Load Excel</button>' +
        '<input type="file" id="excelFileInput" accept=".xlsx,.xls" style="display:none;">';
      var headTools = document.getElementById('pxHeadTools');
      if (!headTools) {
        var pageView = root.closest ? root.closest('.page-view') : null;
        var heading = pageView ? pageView.querySelector('.page-heading') : null;
        if (heading) {
          heading.style.display = 'flex';
          heading.style.alignItems = 'center';
          heading.style.justifyContent = 'space-between';
          heading.style.flexWrap = 'wrap';
          headTools = document.createElement('span');
          headTools.id = 'pxHeadTools';
          headTools.className = 'px-root';
          headTools.style.cssText = 'display:inline-flex;gap:6px;align-items:center;font-size:12px;font-weight:400;letter-spacing:normal;text-transform:none;';
          headTools.innerHTML = toolsHTML;
          heading.appendChild(headTools);
        } else {
          document.getElementById('pxRebarTools').innerHTML = toolsHTML;
        }
      }

      // ui.js 가 참조하는 숨김 DOM (sectionSelect / toggle 버튼)
      if (!document.getElementById('sectionSelect')) {
        var hid = document.createElement('div');
        hid.style.display = 'none';
        hid.innerHTML = '<select id="sectionSelect"><option value="PSCBOX" selected>PSCBOX</option></select>';
        root.appendChild(hid);
      }

      this._excelData = null; this._rebarData = null; this._uiInited = false;
      this._seedVars();
      this._renderRebarTables();
      this.redraw();          // 가이드 + (마운트되는) Rebar Physics 카드
    }
  };
  window.PXBOX = PXBOX;

  window.fdraw_pscbox = function (mountId) {
    ensureDeps(function () { PXBOX.mount(mountId); });
  };
})();
