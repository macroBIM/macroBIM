/*
    bim_psc_test.js — PSC (1/2-cell box girder) concrete section page for layout_body_test.js.

    Single entry: fdraw_psc(mountId).
    bim_pscbox_test.js 에서 철근(REBAR 표·Rebar Physics·엔진 글루)을 뺀 순수 콘크리트 단면판.
      · Dimension card — Batch Input(CSV) + Section Type 라디오 + RWSVG 가이드
                        + 치수 입력표(좌/우 대칭 미러)
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
    '.px-tbl th.px-be{font-size:10.5px;letter-spacing:.06em;}' +
    '.px-tbl.dim-tbl th{background:#1e293b;color:#fff;font-weight:600;text-align:center;border-bottom:1px solid #334155;border-right:1px solid #334155;}.px-tbl.dim-tbl th:last-child{border-right:none;}' +
    '@media(max-width:1000px){.px-split{flex-direction:column;}.px-tblwrap{max-height:320px;width:100%;height:auto !important;}}' +
    '.px-batch-wrap{padding:0 0 11px;margin-bottom:11px;border-bottom:1px dashed var(--hair);}' +
    '.px-batch-lbl{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#64748b;margin-bottom:5px;}' +
    '.px-batch-hint{font-weight:400;text-transform:none;letter-spacing:0;color:#94a3b8;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:10.5px;}' +
    '.px-batch-order{max-height:34px;overflow-y:auto;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:10px;line-height:1.5;color:#94a3b8;background:#f8fafc;border:1px solid var(--hair);border-radius:5px;padding:3px 7px;margin-bottom:5px;word-break:break-all;}' +
    '.px-batch{width:100%;resize:vertical;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11.5px;line-height:1.5;padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:#fff;color:var(--ink);white-space:pre;overflow-x:auto;}' +
    '.px-batch:focus{outline:2px solid var(--dim);outline-offset:1px;border-color:var(--dim);}';

  var PSC = {
    _mountId: 'mount-draw-psc',
    _lines: [], _arcs: [], _circs: [],
    _lastAp: null,

    // 대칭 미러 : 좌측 입력 시 (비대칭 체크가 없으면) 우측 칸에 같은 값 복사 — 시점·종점 양쪽
    onSymLeft: function (lk, rk) {
      var cb = document.getElementById('asym_' + rk);
      if (cb && cb.checked) return;
      ['_s', '_e'].forEach(function (sfx) {
        var li = document.getElementById(lk + sfx), ri = document.getElementById(rk + sfx);
        if (li && ri) ri.value = li.value;
      });
    },

    // 비대칭 체크박스 : 체크 → 우측 독립 입력, 해제 → 좌측값으로 되돌려 미러 재개
    onAsymToggle: function (lk, rk, on) {
      ['_s', '_e'].forEach(function (sfx) {
        var li = document.getElementById(lk + sfx), ri = document.getElementById(rk + sfx);
        if (ri) ri.disabled = !on;
        if (!on && li && ri) ri.value = li.value;
      });
      if (!on) this.redraw();
    },
    // ── BATCH INPUT (CSV) ────────────────────────────────────
    //  box1cell 과 같은 3줄 구성 —
    //   1줄 = 시작단면(Begin) 치수, 2줄 = 끝단면(End) 치수, 3줄(선택) = Section Type(1/2).
    //  칸을 고치면 redraw 가 이 창을 다시 채우고, 이 창을 고치면 칸이 채워진다.

    _dimKeys: function () { return adefs_box12cell.map(function (d) { return d[0]; }); },

    _csvLine: function (sfx) {
      return this._dimKeys().map(function (k) {
        var el = document.getElementById(k + sfx);
        return el ? String(el.value).trim() : '';
      }).join(',');
    },

    // 현재 입력칸 → CSV 문자열
    _currentCSV: function () {
      var oncell = document.querySelector('input[name="box12cell_ncell"]:checked');
      return this._csvLine('_s') + '\n' + this._csvLine('_e') + '\n' + (oncell ? oncell.value : '1');
    },

    // 입력칸이 바뀔 때마다 CSV 창을 최신으로 (편집 중에는 건드리지 않는다)
    _syncBatch: function () {
      var ta = document.getElementById('pscBatch');
      if (!ta || document.activeElement === ta) return;
      ta.value = this._currentCSV();
    },

    // CSV → 입력칸. 값이 모자라면 준 만큼만 채운다. 빈 칸은 건너뛴다.
    //  2줄째(End)가 통째로 비면 시작단면 값을 그대로 복사해 등단면으로 둔다.
    applyBatch: function () {
      var ta = document.getElementById('pscBatch');
      if (!ta) return;
      var lines = String(ta.value).split(/\r?\n/);
      var keys = this._dimKeys();
      var self = this, n = 0;

      var fill = function (line, sfx) {
        var vals = String(line || '').split(',').map(function (v) { return v.trim(); });
        keys.forEach(function (k, i) {
          if (i >= vals.length || vals[i] === '') return;
          var el = document.getElementById(k + sfx);
          if (el) { el.value = vals[i]; n++; }
        });
      };
      fill(lines[0], '_s');
      if (String(lines[1] || '').trim() === '') {          // End 줄 생략 → 등단면
        keys.forEach(function (k) {
          var a = document.getElementById(k + '_s'), b = document.getElementById(k + '_e');
          if (a && b) b.value = a.value;
        });
      } else {
        fill(lines[1], '_e');
      }

      // 좌/우 쌍 정리 : 시점·종점 어느 쪽이든 우측이 좌측과 다르면 비대칭으로 둔다
      DIM_LAYOUT.forEach(function (it) {
        if (it.t !== 'sym' || !it.r) return;
        var cb = document.getElementById('asym_' + it.r);
        if (!cb) return;
        var diff = ['_s', '_e'].some(function (sfx) {
          var li = document.getElementById(it.l + sfx), ri = document.getElementById(it.r + sfx);
          return li && ri && String(ri.value).trim() !== String(li.value).trim();
        });
        cb.checked = diff;
        ['_s', '_e'].forEach(function (sfx) {
          var li = document.getElementById(it.l + sfx), ri = document.getElementById(it.r + sfx);
          if (!ri) return;
          ri.disabled = !diff;
          if (!diff && li) ri.value = li.value;
        });
      });

      // 3줄째 = Section Type (선택)
      var nc = String(lines[2] || '').trim();
      if (nc === '1' || nc === '2') {
        var rb = document.querySelector('input[name="box12cell_ncell"][value="' + nc + '"]');
        if (rb) rb.checked = true;
      }
      console.log('[PSC] batch 입력: ' + n + '개 칸 반영' + ((nc === '1' || nc === '2') ? ', ' + nc + ' cell' : ''));
      this.redraw();
    },

    // 한 쪽 단면(_s = 시작, _e = 끝)의 입력칸을 읽어 파라미터 객체로
    _readAp: function (sfx) {
      var ap = {}, side = (sfx === '_e') ? '끝단면' : '시작단면';
      adefs_box12cell.forEach(function (d) {
        var el = document.getElementById(d[0] + sfx);
        var raw = el ? el.value : String(d[1]);
        ap[d[0]] = (typeof Calc !== 'undefined') ? Calc.num(raw, {}, Number(raw)) : Number(raw);
        // 숫자로 못 읽히면 형상이 조용히 깨지므로 어디가 문제인지 남긴다
        if (!isFinite(ap[d[0]])) console.error('[PSC] ' + side + ' "' + d[0] + '" 를 숫자로 읽을 수 없음: "' + raw + '"');
      });
      var oncell = document.querySelector('input[name="box12cell_ncell"]:checked');
      ap.NCELL = oncell ? (Number(oncell.value) || 2) : 2;
      return ap;
    },

    // 파라메트릭 재작도 : 가이드는 시작단면 기준. 끝단면은 DXF(평면도)에서 쓴다.
    redraw: function () {
      if (typeof adefs_box12cell === 'undefined') return;
      var ap = this._readAp('_s');
      this._lastAp = ap;
      this._lastApE = this._readAp('_e');
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
      this._syncBatch();
    },

    // ── DXF ──────────────────────────────────────────────────
    //  시작단면 / 끝단면 / 상부슬래브 평면도 / 하부슬래브 평면도. (측면도 없음)
    //  세그먼트 길이는 입력받지 않고 시작단면의 박스 전폭(WL+WR)을 기본값으로 쓴다.

    // 평면도에 나타낼 x 위치들 — 이름으로 뽑는다. (2cell 전용 점은 없으면 건너뜀)
    _PLAN: {
      top: {
        edge:   ['PTL', 'PTR'],                                    // 바닥판(데크) 좌우 끝 — 실선
        hidden: ['PTCL1', 'PTHL1', 'PTHL3', 'PTHCL3', 'PTHCL1',    // 복부면·헌치 끝 — 은선
                 'PTHCR1', 'PTHCR3', 'PTHR3', 'PTHR1', 'PTCR1']
      },
      bot: {
        edge:   ['PBL', 'PBR'],                                    // 하부슬래브 좌우 끝
        hidden: ['PBHL1', 'PBHL3', 'PBHCL3', 'PBHCL1',
                 'PBHCR1', 'PBHCR3', 'PBHR3', 'PBHR1']
      }
    },

    _ptx: function (geo, name) {
      var f = (geo.points || []).find(function (p) { return p.name === name; });
      return f ? f[name].x : null;
    },

    _bbox: function (geo) {
      var b = { x1: 1e18, y1: 1e18, x2: -1e18, y2: -1e18 };
      geo.lines.forEach(function (l) {
        b.x1 = Math.min(b.x1, l.x1, l.x2); b.x2 = Math.max(b.x2, l.x1, l.x2);
        b.y1 = Math.min(b.y1, l.y1, l.y2); b.y2 = Math.max(b.y2, l.y1, l.y2);
      });
      return b;
    },

    // 단면 하나를 (ox, oy) 로 옮겨 그린다
    _dxfSection: function (o, geo, ox, oy, lay) {
      geo.lines.forEach(function (l) { o.line(l.x1 + ox, l.y1 + oy, l.x2 + ox, l.y2 + oy, lay); });
      geo.arcs.forEach(function (a) { o.arc(a.x + ox, a.y + oy, a.r, a.angb, a.ange, lay); });
    },

    // 슬래브 평면도 : 시작단면의 x 와 끝단면의 x 를 종방향(±L/2)으로 이어 그린다.
    //  테이퍼가 있으면 그대로 사다리꼴로 나온다. 양 끝은 가로선으로 닫는다.
    _dxfPlan: function (o, gb, ge, spec, L, ox, oy, laySolid, layHidden) {
      var self = this, yb = -L / 2, ye = L / 2;
      var run = function (names, lay) {
        names.forEach(function (nm) {
          var xb = self._ptx(gb, nm), xe = self._ptx(ge, nm);
          if (xb == null || xe == null) return;           // 1cell 에서 빠지는 점은 건너뜀
          o.line(xb + ox, yb + oy, xe + ox, ye + oy, lay);
        });
      };
      run(spec.edge, laySolid);
      run(spec.hidden, layHidden);
      // 시작단/끝단 가로선 (슬래브 폭 전체)
      var eb = spec.edge.map(function (nm) { return self._ptx(gb, nm); }).filter(function (v) { return v != null; });
      var ee = spec.edge.map(function (nm) { return self._ptx(ge, nm); }).filter(function (v) { return v != null; });
      if (eb.length === 2) o.line(eb[0] + ox, yb + oy, eb[1] + ox, yb + oy, laySolid);
      if (ee.length === 2) o.line(ee[0] + ox, ye + oy, ee[1] + ox, ye + oy, laySolid);
    },

    sectionDXF: function () {
      if (!this._lastAp) return;
      var apB = this._lastAp, apE = this._lastApE || this._lastAp;
      var gb = geo_box12cell(apB), ge = geo_box12cell(apE);
      var bb = this._bbox(gb), be = this._bbox(ge);

      // 세그먼트 길이 = 시작단면 박스 전폭 (입력 없음)
      var L = Math.abs(Number(apB.WL) || 0) + Math.abs(Number(apB.WR) || 0);
      if (!isFinite(L) || L <= 0) L = Math.max(bb.x2 - bb.x1, 1000);

      var W = Math.max(bb.x2 - bb.x1, be.x2 - be.x1);
      var H = Math.max(bb.y2 - bb.y1, be.y2 - be.y1);
      var gap = Math.max(W, L) * 0.30;
      var dx = W + gap;                       // 열 간격 (좌: 시작/상부평면, 우: 끝/하부평면)
      var dy = H / 2 + L / 2 + gap;           // 단면 행 위로 평면도 행

      var o = dxf_generator();
      o.init();
      o.layer('psc', 4, 'CONTINUOUS');        // 실선
      o.layer('psc-hid', 4, 'HIDDEN');        // 은선 (복부·헌치 위치)
      o.layer('psc-txt', 2, 'CONTINUOUS');    // 뷰 제목

      this._dxfSection(o, gb, 0, 0, 'psc');            // 시작단면
      this._dxfSection(o, ge, dx, 0, 'psc');           // 끝단면
      this._dxfPlan(o, gb, ge, this._PLAN.top, L, 0, dy, 'psc', 'psc-hid');    // 상부슬래브 평면도
      this._dxfPlan(o, gb, ge, this._PLAN.bot, L, dx, dy, 'psc', 'psc-hid');   // 하부슬래브 평면도

      // 뷰 제목 (dxf_generator 가 text 를 지원할 때만)
      if (typeof o.text === 'function') {
        var th = Math.max(W, L) * 0.045;
        var put = function (t, x, y) { o.text(x, y, th, 0, t, 'psc-txt'); };
        put('BEGIN SECTION',     bb.x1,      bb.y1 - th * 2);
        put('END SECTION',       be.x1 + dx, bb.y1 - th * 2);
        put('TOP SLAB PLAN',     bb.x1,      dy - L / 2 - th * 2);
        put('BOTTOM SLAB PLAN',  bb.x1 + dx, dy - L / 2 - th * 2);
      }
      console.log('[PSC] DXF: 시작/끝 단면 + 상·하부 슬래브 평면도, 세그먼트 길이 ' + Math.round(L) + 'mm (박스 전폭)');
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
      // 칸 하나 : sfx '_s' = 시작단면, '_e' = 끝단면. val 로 초기값을 따로 줄 수 있다(우측 미러).
      function dimInput(key, sfx, opt) {
        opt = opt || {};
        return '<input type="text" spellcheck="false" class="form-input" id="' + key + sfx + '" ' +
               'value="' + (opt.val != null ? opt.val : dimDef(key)) + '"' +
               (opt.disabled ? ' disabled' : '') +
               (opt.mirror ? ' oninput="PSC.onSymLeft(\'' + opt.mirror[0] + '\',\'' + opt.mirror[1] + '\')"' : '') +
               ' onchange="PSC.redraw()">';
      }
      function pair(key, opt) {   // Begin / End 두 칸
        return '<td>' + dimInput(key, '_s', opt) + '</td><td>' + dimInput(key, '_e', opt) + '</td>';
      }
      var rows = layout.map(function (it) {
        if (it.t === 'group') return '<tr class="px-2cell-hdr"><td colspan="7">' + it.label + '</td></tr>';
        if (it.t === 'single') return '<tr><td class="px-dim">' + lblMap[it.l] + '</td>' + pair(it.l) +
                                      '<td class="px-symc"></td><td class="px-dim"></td><td></td><td></td></tr>';
        if (it.t === 'free')   return '<tr><td class="px-dim">' + lblMap[it.l] + '</td>' + pair(it.l) +
                                      '<td class="px-symc"></td>' +
                                      '<td class="px-dim">' + lblMap[it.r] + '</td>' + pair(it.r) + '</tr>';
        // sym : 좌측 입력 → 우측 미러. 체크박스 체크 시 우측 독립 입력(비대칭).
        return '<tr><td class="px-dim">' + lblMap[it.l] + '</td>' +
               pair(it.l, { mirror: [it.l, it.r] }) +
               '<td class="px-symc"><input type="checkbox" id="asym_' + it.r + '" title="Check to enter the right side independently (asymmetric)" ' +
                   'onchange="PSC.onAsymToggle(\'' + it.l + '\',\'' + it.r + '\',this.checked)"></td>' +
               '<td class="px-dim">' + lblMap[it.r] + '</td>' +
               pair(it.r, { val: dimDef(it.l), disabled: true }) + '</tr>';
      }).join('');
      var keyOrder = adefs_box12cell.map(function (d) { return d[0]; }).join(', ');

      root.innerHTML =
        '<style>' + CSS + '</style>' +
        '<div class="px-root">' +

        '  <div class="draw-card">' +
        '    <div class="draw-card-header"><div><span class="draw-card-title">Dimension (mm)</span> <span class="draw-card-desc">PSC box girder &mdash; 1 / 2 cell. Guide shows the BEGIN section; DXF adds the END section and both slab plans.</span></div>' +
        '      <button type="button" class="px-btn" onclick="PSC.sectionDXF()">&#8681; DXF</button></div>' +
        '    <div class="draw-card-body">' +
        '      <div class="px-batch-wrap">' +
        '        <div class="px-batch-lbl">Batch Input (CSV) <span class="px-batch-hint">1st line = BEGIN section &nbsp;/&nbsp; 2nd line = END section (blank = same as begin) &nbsp;/&nbsp; 3rd line = section type (1 or 2)</span></div>' +
        '        <div class="px-batch-order">' + keyOrder + '</div>' +
        '        <textarea class="px-batch" id="pscBatch" rows="3" spellcheck="false" onchange="PSC.applyBatch()"></textarea>' +
        '      </div>' +
        '      <div class="px-radio"><b>Section Type :</b>' +
        '        <label><input type="radio" name="box12cell_ncell" value="1" checked onchange="PSC.redraw()"> 1 Cell</label>' +
        '        <label><input type="radio" name="box12cell_ncell" value="2" onchange="PSC.redraw()"> 2 Cell</label>' +
        '      </div>' +
        '      <div class="px-split">' +
        '        <div class="px-guide" id="box12cell_guide"></div>' +
        '        <div class="px-tblwrap" id="box12cell_vartable">' +
        '          <table class="px-tbl dim-tbl"><thead><tr>' +
        '            <th>Dimension</th><th class="px-be">Begin</th><th class="px-be">End</th>' +
        '            <th class="px-symh" title="Check to enter the right side independently">&#8646;</th>' +
        '            <th>Dimension</th><th class="px-be">Begin</th><th class="px-be">End</th></tr></thead>' +
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
