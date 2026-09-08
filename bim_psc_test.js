/*
    bim_psc_test.js — PSC (1/2-cell box girder) concrete section page for layout_body_test.js.

    Single entry: fdraw_psc(mountId).
    bim_pscbox_test.js 에서 철근(REBAR 표·Rebar Physics·엔진 글루)을 뺀 순수 콘크리트 단면판.
      · Dimension card — Section Type 라디오 + RWSVG 가이드 + 치수 입력표(좌/우 대칭 미러)
      · Excel 로더    — 'type' / 'dim' / 'cover' 블록만 읽는다 (trebar/lrebar 블록은 무시)
      · 단면 DXF 출력

    엔진(physics/trebar/domain/ui/konva)을 전혀 로드하지 않는다 — 철근이 없으므로.
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
    if (typeof window.ExcelJS === 'undefined') need.push('https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js');
    if (typeof window.loadSheetData === 'undefined') need.push(PAGES + 'excel_reader.js');
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
    '.px-btn-lite{background:#fff;color:#334155;border-color:#cbd5e1;}.px-btn-lite:hover{background:#f1f5f9;border-color:#cbd5e1;box-shadow:0 2px 6px rgba(15,23,42,.12);}.px-btn-lite.active{background:#2563eb;border-color:#2563eb;color:#fff;}' +
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
    '@media(max-width:1000px){.px-split{flex-direction:column;}.px-tblwrap{max-height:320px;width:100%;height:auto !important;}}' +
    '.px-cover{width:64px;text-align:right;}' +
    '.px-menubar{display:flex;align-items:center;justify-content:flex-start;gap:8px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px;margin-bottom:14px;}' +
    '.px-mb-label{font-size:12.5px;font-weight:600;color:#475569;white-space:nowrap;}' +
    '.px-logpanel{background:#0f172a;color:#e2e8f0;border-radius:10px;padding:12px 16px;margin-bottom:14px;font-size:12px;font-family:ui-monospace,Menlo,Consolas,monospace;line-height:1.7;}' +
    '.px-logpanel .log-time{color:#94a3b8;margin-bottom:4px;}.px-logpanel .log-ok{color:#34d399;}.px-logpanel .log-err{color:#f87171;}' +
    '.px-optrow{gap:16px;margin-left:0;}.px-opthalf{flex:1 1 0;min-width:0;display:flex;gap:14px;align-items:center;flex-wrap:wrap;}' +
    '.px-toast{position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;align-items:center;gap:9px;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;box-shadow:0 4px 14px rgba(0,0,0,.18);color:#fff;font-family:"Inter",system-ui,sans-serif;}' +
    '.px-toast.loading{background:#2563eb;}.px-toast.ok{background:#059669;}.px-toast.err{background:#dc2626;}' +
    '.px-toast .px-spin{width:14px;height:14px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:pxspin .8s linear infinite;flex-shrink:0;}' +
    '@keyframes pxspin{to{transform:rotate(360deg)}}';

  var PSC = {
    _mountId: 'mount-draw-psc',
    _excelData: null,
    _lines: [], _arcs: [], _circs: [],
    _lastAp: null, _loadLog: null, _toastTimer: null,

    _rowFirstToken: function (row) {
      if (!Array.isArray(row)) return '';
      for (var c = 0; c < row.length; c++) { var v = String(row[c] == null ? '' : row[c]).trim(); if (v !== '') return v; }
      return '';
    },

    _rowIsEnd: function (row) { return this._rowFirstToken(row).toLowerCase() === 'end'; },

    _rowIsComment: function (row) { var f = this._rowFirstToken(row); var ch = f.charAt(0); return ch === '#' || ch === '!'; },

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
          var self = this;
            lg.lines.forEach(function (ln) { h += '<div>' + self._esc(ln) + '</div>'; });
          pan.innerHTML = h;
        }
      }
      pan.style.display = show ? '' : 'none';
      if (btn) btn.classList.toggle('active', show);
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
          console.log('[PSC] 엑셀 로드 완료:', sheet, data.length + '행', data);
          self._resetInputs();                 // ① 기존 웹 입력값 전체 초기화 (Dimension/철근)
          self._excelData = data;
          self._loadTypeFromExcel(data);       // ② 'type' 블록 → Section Type (1c/2c)
          var nd = self._loadDimsFromExcel(data);       // ③ 'dim' 블록 → Dimension 표 (대칭/비대칭 자동)
          self._loadCoverFromExcel(data);      // ③-1 'cover' 블록 → 피복 3칸 (deck/exterior/interior)
          self.redraw();                       // 재작도 (가이드 + 외곽)
          var oncell = document.querySelector('input[name="box12cell_ncell"]:checked');
          var cd = function (id) { var el = document.getElementById(id); return el ? el.value : '?'; };
          self._loadLog = { time: new Date().toLocaleString(), ok: true, lines: [
            'File      : ' + file.name,
            'Sheet     : ' + sheet + '  (' + data.length + ' rows)',
            'Section   : ' + (oncell ? oncell.value : '?') + ' cell',
            'Dims      : ' + (nd || 0),
            'Cover     : deck ' + cd('cover_deck_s') + ' / exterior ' + cd('cover_ext_s') + ' / interior ' + cd('cover_int_s')
          ] };
          self._toast('Excel loaded \u2014 dims ' + (nd || 0), 'ok');
        }).catch(function (e) {
          self._loadLog = { time: new Date().toLocaleString(), ok: false, lines: [
            'File      : ' + file.name,
            'Sheet     : ' + sheet,
            'ERROR     : ' + e.message
          ] };
          self._toast('Excel load failed: ' + e.message, 'err');
          console.error('[PSC] 엑셀 로드 오류:', e);
        });
      };
      fi.click();
    },
    // 웹페이지 입력값 전체 초기화 — 엑셀 로딩 직전에 호출.
    //   Dimension 은 숫자 기본값으로, 대칭 체크박스 해제,
    //   Section Type 1 Cell.
    _resetInputs: function () {
      this._excelData = null;
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
          if (!n) { console.warn('[PSC] type 값을 해석할 수 없음: ' + v); return; }
          var rb = document.querySelector('input[name="box12cell_ncell"][value="' + n + '"]');
          if (rb) rb.checked = true;
          console.log('[PSC] type 로드: ' + v + ' → ' + n + ' cell');
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
          if (n) console.log('[PSC] cover 로드: ' + n + '개 (deck/exterior/interior)');
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
        if (!key) { if (name) console.warn('[PSC] 알 수 없는 dim 이름: ' + name); continue; }
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
      console.log('[PSC] dim 로드: ' + count + '개');
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

        '  <div class="px-menubar">' +
        '    <span class="px-mb-label">Sheet Name :</span>' +
        '    <input type="text" spellcheck="false" id="sheetName" class="form-input" value="input" style="width:90px;" title="Excel sheet name">' +
        '    <button type="button" class="px-btn" onclick="PSC.loadExcel()">&#8682; Load Excel</button>' +
        '    <button type="button" class="px-btn px-btn-lite" id="btnViewLog" onclick="PSC.toggleLoadLog()">&#128220; View Log</button>' +
        '    <input type="file" id="excelFileInput" accept=".xlsx,.xls" style="display:none;">' +
        '  </div>' +
        '  <div id="pxLoadLog" class="px-logpanel" style="display:none;"></div>' +

        '  <div class="draw-card">' +
        '    <div class="draw-card-header"><div><span class="draw-card-title">Dimension (mm)</span> <span class="draw-card-desc">PSC box girder &mdash; 1 / 2 cell (concrete section only)</span></div>' +
        '      <button type="button" class="px-btn" onclick="PSC.sectionDXF()">&#8681; DXF</button></div>' +
        '    <div class="draw-card-body">' +
        '      <div class="px-radio px-optrow">' +
        '        <div class="px-opthalf"><b>Section Type :</b>' +
        '          <label><input type="radio" name="box12cell_ncell" value="1" checked onchange="PSC.redraw()"> 1 Cell</label>' +
        '          <label><input type="radio" name="box12cell_ncell" value="2" onchange="PSC.redraw()"> 2 Cell</label>' +
        '        </div>' +
        '        <div class="px-opthalf"><b>Cover Depth (mm) :</b>' +
        '          <label>Deck <input type="text" spellcheck="false" class="form-input px-cover" id="cover_deck_s" value="50" onchange="PSC.redraw()" title="Top slab (deck) cover"></label>' +
        '          <label>Exterior <input type="text" spellcheck="false" class="form-input px-cover" id="cover_ext_s" value="40" onchange="PSC.redraw()" title="Outer surface cover"></label>' +
        '          <label>Interior <input type="text" spellcheck="false" class="form-input px-cover" id="cover_int_s" value="30" onchange="PSC.redraw()" title="Cell (void) surface cover"></label>' +
        '        </div>' +
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

      this._excelData = null;
      this.redraw();
    }
  };
  window.PSC = PSC;

  window.fdraw_psc = function (mountId) {
    ensureDeps(function () { PSC.mount(mountId); });
  };
})();
