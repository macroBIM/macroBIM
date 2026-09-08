/*
    bim_psc_test.js — PSC (1/2-cell box girder) concrete section page for layout_body_test.js.

    Single entry: fdraw_psc(mountId).
    bim_pscbox_test.js 에서 철근(REBAR 표·Rebar Physics·엔진 글루)을 뺀 순수 콘크리트 단면판.
      · Dimension card — Section Type 라디오 + RWSVG 가이드 + 치수 입력표(좌/우 대칭 미러)
      · 단면 DXF 출력

    엔진(physics/trebar/domain/ui/konva)을 로드하지 않는다 — 철근이 없으므로.
    엑셀 로더와 피복(cover) 입력도 없다 — 치수는 표에 직접 넣는다.
*/
(function () {

  // 치수표 레이아웃 : sym(좌 입력 → 우 미러) / free(좌우 독립) / single(단독) / group(구분행)
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

  // 콘크리트 단면만 그리므로 철근 엔진(trebar/lrebar/physics/section/domain/ui)은 받지 않는다.
  function ensureDeps(cb) {
    var need = [];
    if (!hasGlobal('geo_fillet')) need.push(PAGES + 'geomath.js');
    if (!hasGlobal('dxf_generator')) need.push(PAGES + 'bim_dxf.js');
    if (typeof window.RWSVG === 'undefined') need.push(PAGES + 'bim_draw_test_core.js');
    if (!hasGlobal('geo_box12cell')) need.push(PAGES + 'bim_box12cell.js');
    if (typeof window.Calc === 'undefined') need.push(PAGES + 'calc.js');
    (function next(i) {
      if (i >= need.length) { cb(); return; }
      var s = document.createElement('script');
      s.src = need[i].indexOf(PAGES) === 0 ? need[i] + '?v=' + Date.now() : need[i];   // 리포 파일은 항상 최신 (CDN 은 캐시 그대로)
      s.onload = function () { next(i + 1); };
      s.onerror = function () { console.error('[psc] failed to load', need[i]); next(i + 1); };
      document.head.appendChild(s);
    })(0);
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
    '.px-tbl.dim-tbl th{background:#1e293b;color:#fff;font-weight:600;text-align:center;border-bottom:1px solid #334155;border-right:1px solid #334155;}.px-tbl.dim-tbl th:last-child{border-right:none;}' +
    '@media(max-width:1000px){.px-split{flex-direction:column;}.px-tblwrap{max-height:320px;width:100%;height:auto !important;}}';

  var PSC = {
    _mountId: 'mount-draw-psc',
    _lines: [], _arcs: [], _circs: [],
    _lastAp: null,

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
        if (!isFinite(ap[d[0]])) console.error('[PSC] Dimension "' + d[0] + '" 를 숫자로 읽을 수 없음: "' + raw + '"');
      });
      var oncell = document.querySelector('input[name="box12cell_ncell"]:checked');
      ap.NCELL = oncell ? (Number(oncell.value) || 2) : 2;
      this._lastAp = ap;
      if (typeof toggleCenterVars_box12cell === 'function') toggleCenterVars_box12cell(ap.NCELL);
      var ghdr = document.querySelector('#box12cell_vartable .px-2cell-hdr');
      if (ghdr) ghdr.style.display = (ap.NCELL === 1) ? 'none' : '';
      try { draw_box12cell_guide('box12cell_guide', ap); }
      catch (e) { console.error('[PSC] guide:', e); }
      // 외곽 캡처 (geo 출력을 직접 사용) — DXF/후속 용도
      try {
        var g = geo_box12cell(ap);
        this._lines = g.lines.map(function (l) { return [l.x1, l.y1, l.x2, l.y2]; });
        this._arcs = g.arcs.map(function (a) { return [a.x, a.y, a.r, a.angb, a.ange]; });
        this._circs = [];
      } catch (e) { console.error('[PSC] section:', e); }
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
      o.download('PSC.dxf');
    },

    // 페이지 구성 — Dimension 카드 하나. (REBAR / Rebar Physics 카드는 없다)
    mount: function (mountId) {
      this._mountId = mountId || 'mount-draw-psc';
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
      var defByKey = {};
      adefs_box12cell.forEach(function (d) { defByKey[d[0]] = String(d[1]); });
      function dimDef(key) { return defByKey[key] == null ? '' : defByKey[key]; }
      function dimInput(key, extra) {
        return '<input type="text" spellcheck="false" class="form-input" id="' + key + '_s" value="' + dimDef(key) + '" onchange="PSC.redraw()"' + (extra || '') + '>';
      }
      var rows = layout.map(function (it) {
        if (it.t === 'group') return '<tr class="px-2cell-hdr"><td colspan="5">' + it.label + '</td></tr>';
        if (it.t === 'single') return '<tr><td class="px-dim">' + lblMap[it.l] + '</td><td>' + dimInput(it.l) + '</td><td class="px-symc"></td><td class="px-dim"></td><td></td></tr>';
        if (it.t === 'free')   return '<tr><td class="px-dim">' + lblMap[it.l] + '</td><td>' + dimInput(it.l) + '</td><td class="px-symc"></td>' +
                                      '<td class="px-dim">' + lblMap[it.r] + '</td><td>' + dimInput(it.r) + '</td></tr>';
        // sym : 좌측 입력 → 우측 미러. 체크박스 체크 시 우측 독립 입력(비대칭).
        return '<tr><td class="px-dim">' + lblMap[it.l] + '</td>' +
               '<td><input type="text" spellcheck="false" class="form-input" id="' + it.l + '_s" value="' + dimDef(it.l) + '" ' +
                   'oninput="PSC.onSymLeft(\'' + it.l + '\',\'' + it.r + '\')" onchange="PSC.redraw()"></td>' +
               '<td class="px-symc"><input type="checkbox" id="asym_' + it.r + '" title="Check to enter the right side independently (asymmetric)" ' +
                   'onchange="PSC.onAsymToggle(\'' + it.l + '\',\'' + it.r + '\',this.checked)"></td>' +
               '<td class="px-dim">' + lblMap[it.r] + '</td>' +
               '<td><input type="text" spellcheck="false" class="form-input" id="' + it.r + '_s" value="' + dimDef(it.l) + '" disabled ' +
                   'onchange="PSC.redraw()"></td></tr>';
      }).join('');

      root.innerHTML =
        '<style>' + CSS + '</style>' +
        '<div class="px-root">' +

        '  <div class="draw-card">' +
        '    <div class="draw-card-header"><div><span class="draw-card-title">Dimension (mm)</span> <span class="draw-card-desc">PSC box girder &mdash; 1 / 2 cell (concrete section only)</span></div>' +
        '      <button type="button" class="px-btn" onclick="PSC.sectionDXF()">&#8681; DXF</button></div>' +
        '    <div class="draw-card-body">' +
        '      <div class="px-radio"><b>Section Type :</b>' +
        '        <label><input type="radio" name="box12cell_ncell" value="1" checked onchange="PSC.redraw()"> 1 Cell</label>' +
        '        <label><input type="radio" name="box12cell_ncell" value="2" onchange="PSC.redraw()"> 2 Cell</label>' +
        '      </div>' +
        '      <div class="px-split">' +
        '        <div class="px-guide" id="box12cell_guide"></div>' +
        '        <div class="px-tblwrap" id="box12cell_vartable">' +
        '          <table class="px-tbl dim-tbl"><thead><tr><th>Dimension</th><th>Value</th><th class="px-symh" title="Check to enter the right side independently">&#8646;</th><th>Dimension</th><th>Value</th></tr></thead>' +
        '          <tbody>' + rows + '</tbody></table>' +
        '        </div>' +
        '      </div>' +
        '    </div>' +
        '  </div>' +

        '</div>';

      this.redraw();
    }
  };
  window.PSC = PSC;

  window.fdraw_psc = function (mountId) {
    ensureDeps(function () { PSC.mount(mountId); });
  };
})();
