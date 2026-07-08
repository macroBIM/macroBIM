/*
    seoul_phd_app.js — Seoul PhD (CodePen) 앱 전체 로직
    · CodePen 은 이 파일만 fetch → <script> 로 주입하면 됨 (HTML 패널 최소화)
    · 여기서 엔진 스크립트(konva/bim_*)를 순차 로드 → 3D·치수선 무력화 →
      SeoulPhD 정의 → style/form(raw) fetch → 실행
    · 단면: box1cell / ibeam / rect / circle / octagon / track (2D front only)
    · Toggle Normals: 벽면 중앙에 콘크리트 안쪽 법선 벡터 표시
*/
(function () {
  var BRANCH = 'claude/rebar-solver-v5-t3wst2';
  var RAW = 'https://raw.githubusercontent.com/macroBIM/macroBIM/' + BRANCH + '/';
  var PAGES = 'https://macrobim.github.io/macroBIM/';

  // ── 폰트 / 아이콘 ──
  ['https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
   'https://cdnjs.cloudflare.com/ajax/libs/bootstrap-icons/1.11.3/font/bootstrap-icons.min.css'
  ].forEach(function (href) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l); });

  // ── 엔진 스크립트 (3D 모듈은 로드하지 않음) ──
  var ENGINE = [
    'https://unpkg.com/konva@9/konva.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js',   // 엑셀 읽기용 (excel_reader 보다 먼저)
    PAGES + 'excel_reader.js',                                                // 엑셀 리더 (main/Pages)
    PAGES + 'konvaviewer.js', PAGES + 'bim_plotly_geo.js', PAGES + 'bim_dxf.js', PAGES + 'geomath.js',
    PAGES + 'bim_box1cell.js', PAGES + 'bim_ibeam.js', PAGES + 'bim_rect.js',
    PAGES + 'bim_circle.js', PAGES + 'bim_octagon.js', PAGES + 'bim_track.js',
    // ── 철근 물리 엔진 + 렌더러 (원본 그대로 재사용) ──
    //    equation → trebar → lrebar → physics → section → domain → ui
    PAGES + 'equation.js', PAGES + 'trebar.js', PAGES + 'lrebar.js',
    PAGES + 'physics.js', PAGES + 'section.js', PAGES + 'domain.js', PAGES + 'ui.js'
  ];

  // 철근 데이터가 겨냥해 만들어진 단면(엔진 BoxGirder) — 원본과 동일 결과를 위해 그대로 전달
  var REBAR_BOX_DATA = '{PSCBOX,1,{BOX,2400,5150,5150,2250,2250,5,-5},{WP,-3000,3000},{CS,L,0,400,1250,225},{CS,R,0,400,1250,225},{TS,{1,{0,400,1200,225},{0,400,1200,225}}},{BS,{1,{0,400,150,250},{0,400,150,250}}},{WB,800,800},{COVER, 50, 50, 40}}';
  (function load(i) {
    if (i >= ENGINE.length) { start(); return; }
    var s = document.createElement('script');
    s.src = ENGINE[i];
    s.onload = function () { load(i + 1); };
    s.onerror = function () { console.error('[SeoulPhD] 엔진 로드 실패:', ENGINE[i]); load(i + 1); };
    document.head.appendChild(s);
  })(0);

  function start() {
    /* ─ 3D·치수선 무력화 + 외곽선 캡처 ─ */
    window.THREE = window.THREE || {};
    ['box1cell', 'ibeam', 'rect', 'circle', 'octagon', 'track'].forEach(function (k) {
      window['render_' + k + '_3d'] = function () {};
    });

    /* ─ SeoulPhD (드롭다운 디스패처 + 법선) ─ */
    var SeoulPhD = {
      sections: ['box1cell', 'ibeam', 'rect', 'circle', 'octagon', 'track'],
      domPfx: { box1cell: 'box1cell', ibeam: 'ibeam', rect: 'rect', circle: 'circle', octagon: 'oct', track: 'track' },
      showNormals: false, showNodes: false, _excelData: null, _rebarData: null,
      _cur: null, _capturing: false, _lines: [], _circs: [], _arcs: [], _normLayer: null, _normGroup: null, _nodeGroup: null, _uiInited: false,

      select: function (kind) {
        var mount = document.getElementById('mount');
        if (!mount) return;
        this._excelData = null; this._rebarData = null;  // 섹션 변경 시 로딩된 rebar 데이터 초기화
        if (typeof UI !== 'undefined' && this._uiInited) {   // 이전 엔진 렌더 정지 (컨테이너가 곧 제거됨)
          if (UI.anim && UI.anim.stop) UI.anim.stop();
          this._uiInited = false;
        }
        mount.innerHTML = '';
        var tpl = document.getElementById('tpl-' + kind);
        if (tpl) mount.appendChild(tpl.content.cloneNode(true));
        this._insertRebarCards(mount);          // Dimension 과 Drawing View 사이에 TRebar/LRebar 삽입
        var sel = document.getElementById('sectionSelect');
        if (sel && sel.value !== kind) sel.value = kind;
        this.redraw(kind);
      },

      // TRebar/LRebar 카드를 마운트된 섹션의 Drawing View 카드 바로 앞에 삽입
      _insertRebarCards: function (mount) {
        var tpl = document.getElementById('tpl-rebar');
        if (!tpl) return;
        var cards = mount.querySelectorAll('.draw-card');
        var drawingCard = cards.length ? cards[cards.length - 1] : null;   // 마지막 카드 = Drawing View
        if (drawingCard && drawingCard.parentNode) {
          drawingCard.parentNode.insertBefore(tpl.content.cloneNode(true), drawingCard);
        } else {
          mount.appendChild(tpl.content.cloneNode(true));
        }
        this._renderRebarTables();          // 카드 재생성 시 엑셀 데이터 다시 채우기
      },

      // 입력데이터 표: 표제목(헤더)이 trebar/lrebar 2줄(입력체계), 그 아래 엑셀 데이터 행
      _renderRebarTables: function () {
        var body = document.getElementById('rebarBody');
        if (!body) return;

        // 2줄 표제목 = trebar / lrebar 입력체계
        var SCHEMA = [
          ['trebar', 'id', 'code', 'dia', 'init (x, y, rot)', 'set', 'segs (len)', 'angs', 'nors', 'barStart', 'barEnd'],
          ['lrebar', 'id', 'dia', 'num', 'init', 'nors', 'range', 'path', 'ctc', 'ctcmax', 'ctcmin']
        ];
        var ncol = SCHEMA[0].length;

        // 엑셀 로드됐으면 'type' 블록의 데이터 행 추출 (엑셀 자체 헤더 행은 제외)
        var dataRows = [];
        if (this._excelData && typeof window.extractBlockFromData === 'function') {
          var block = window.extractBlockFromData(this._excelData, 'type');
          if (block && block.length > 1) dataRows = block.slice(1);
        }

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
          h += '<tr><td colspan="' + ncol + '" style="text-align:center;color:#94a3b8;padding:14px;">[엑셀불러오기]로 데이터를 로드하세요.</td></tr>';
        }
        body.innerHTML = h + '</tbody></table></div>';
      },

      // 값 입력(_s)을 숨은 _e 로 미러링(begin=end) 후 front 2D 작도
      redraw: function (kind) {
        this._cur = kind;
        var mount = document.getElementById('mount');
        if (mount) {
          mount.querySelectorAll('input[id$="_s"]').forEach(function (inp) {
            var eid = inp.id.slice(0, -2) + '_e';
            var e = document.getElementById(eid);
            if (!e) { e = document.createElement('input'); e.type = 'hidden'; e.id = eid; mount.appendChild(e); }
            e.value = inp.value;
          });
        }
        var fn = window['fdraw_' + kind];
        if (typeof fn === 'function') {
          try { fn(); this._frontOnly(kind); }
          catch (e) { console.error('[SeoulPhD] fdraw_' + kind + ' 오류:', e); }
        } else {
          console.warn('[SeoulPhD] fdraw_' + kind + ' 미로드');
        }
      },

      // 3D 패널·뷰 탭 제거 후 front 2D 를 전폭 재작도 (+ 법선)
      _frontOnly: function (kind) {
        var pfx = this.domPfx[kind];
        var plot = document.getElementById(kind + 'plot');
        if (!plot) return;
        var pane3d = document.getElementById(pfx + '3d');
        if (pane3d) pane3d.style.display = 'none';
        Array.prototype.forEach.call(plot.children, function (c) {
          if (c !== pane3d) { c.style.width = '100%'; c.style.flex = '1 1 100%'; }
        });
        var frontTab = document.getElementById(pfx + '_tab_front');
        if (frontTab && frontTab.parentElement) frontTab.parentElement.style.display = 'none';

        var f2 = window['fdraw_' + kind + '_2d'];
        if (typeof f2 === 'function') {
          this._lines = []; this._circs = []; this._arcs = []; this._normLayer = null; this._normGroup = null; this._capturing = true;
          try { f2('front'); } catch (e) { console.error('[SeoulPhD] fdraw_' + kind + '_2d 오류:', e); }
          this._capturing = false;
          if (this.showNormals) this._drawNormals();
          if (this.showNodes) this._drawNodes();
        }
      },

      toggleNormals: function () {
        this.showNormals = !this.showNormals;
        var b = document.getElementById('btnToggleNormals');
        if (b) b.classList.toggle('active', this.showNormals);
        if (this._cur) this._frontOnly(this._cur);
      },

      toggleNodes: function () {
        this.showNodes = !this.showNodes;
        var b = document.getElementById('btnToggleNodes');
        if (b) b.classList.toggle('active', this.showNodes);
        if (this._cur) this._frontOnly(this._cur);
      },

      // 엑셀불러오기: 파일 선택 → '시트명' 칸의 시트를 읽어 _excelData 에 저장
      loadExcel: function () {
        var fi = document.getElementById('excelFileInput');
        if (!fi) return;
        var self = this;
        fi.value = '';
        fi.onchange = function () {
          var file = fi.files[0]; if (!file) return;
          var sheet = String((document.getElementById('sheetName') || {}).value || 'input').trim();
          if (typeof window.loadSheetData !== 'function') { alert('엑셀 리더 로딩 중입니다. 잠시 후 다시 시도해주세요.'); return; }
          window.loadSheetData(file, sheet).then(function (data) {
            self._excelData = data;
            console.log('[SeoulPhD] 엑셀 로드 완료:', sheet, data.length + '행', data);
            self._renderRebarTables();      // 'type' 블록 추출 → REBAR 카드에 표 출력
            self._rebarData = self._parseRebar(data);   // 표 → trebar/lrebar 객체 배열
            console.log('[SeoulPhD] 철근 파싱:', self._rebarData);
            self._drawRebar();              // physics 로 철근 작도
          }).catch(function (e) { alert('엑셀 로드 오류: ' + e.message); });
        };
        fi.click();
      },

      // ─────────────────────────────────────────────────────────
      //  엑셀 'type' 블록 → trebar/lrebar 객체 배열 (rebar_excel.js 이식)
      //  trebar: type|id|code|dia|init(x,y,rot)|set|segs(len)|angs|nors|barStart|barEnd
      //  lrebar: type|id|dia |num|init         |nors|range   |path|ctc|ctcmax  |ctcmin
      // ─────────────────────────────────────────────────────────
      _parseRebar: function (fullData) {
        if (typeof window.extractBlockFromData !== 'function') return [];
        var block = window.extractBlockFromData(fullData, 'type');
        if (!block || block.length < 2) return [];
        var out = [], self = this;
        for (var r = 1; r < block.length; r++) {
          var row = block[r], type = self._rbStr(row[0]).toLowerCase();
          if (!type) continue;
          out.push(type === 'lrebar' ? self._parseLrebarRow(row) : self._parseTrebarRow(row));
        }
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
        return o;
      },
      _parseLrebarRow: function (row) {
        var o = { type: 'lrebar', id: this._rbStr(row[1]), bar: {} };
        if (this._rbHas(row[2])) o.bar.dia = Number(row[2]);
        if (this._rbHas(row[3])) o.bar.num = Number(row[3]);
        if (this._rbHas(row[8])) o.bar.ctc = Number(row[8]);
        if (this._rbHas(row[9])) o.bar.max = Number(row[9]);
        if (this._rbHas(row[10])) o.bar.min = Number(row[10]);
        var init = this._rbInit(row[4], ['x', 'y', 'rot', 'grav']); if (init) o.init = init;
        var range = this._rbRange(row[6]); if (range) o.range = range;
        var path = this._rbList(row[7]).map(function (s) { return s.toUpperCase(); });
        if (path.length) o.path = path;
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

      // ─────────────────────────────────────────────────────────
      //  철근 작도 = 원본 렌더러(ui.js) 그대로 재사용
      //  · 단면형상(엔진 BoxGirder) + 입력데이터만 전달 → 스타일·애니메이션 원본 동일
      //  · seoul_phd 는 렌더 컨테이너/스탯 DOM 을 마련하고 UI.init/reset 만 호출
      // ─────────────────────────────────────────────────────────
      _rebarHostHTML:
        '<div class="draw-card" id="rebarRenderCard">' +
          '<div class="draw-card-header">' +
            '<div class="draw-card-title">Rebar Physics <span style="color:#8A2BE2;">(engine)</span></div>' +
            '<div class="engine-ctrls">' +
              '<button type="button" class="engine-btn" onclick="SeoulPhD.rebarRespawn()"><i class="bi bi-arrow-counterclockwise"></i> Respawn</button>' +
              '<button type="button" class="engine-btn" id="btnPause" onclick="SeoulPhD.rebarPause()"><i class="bi bi-pause-fill"></i> Pause</button>' +
            '</div>' +
            '<div class="draw-card-desc" id="stat-grid">철근이 설계 위치를 찾아갑니다…</div>' +
          '</div>' +
          '<div class="draw-card-body" style="padding:0;">' +
            '<div id="renderContainer" style="width:100%;height:600px;background:#0b1220;border-radius:0 0 10px 10px;overflow:hidden;cursor:grab;"></div>' +
          '</div>' +
        '</div>',

      // 렌더 호스트(카드) 보장 — mount 안, Drawing View 카드 뒤에 1회 삽입
      _ensureRebarHost: function () {
        var host = document.getElementById('renderContainer');
        if (host) return host;
        var mount = document.getElementById('mount');
        if (!mount) return null;
        var wrap = document.createElement('div');
        wrap.innerHTML = this._rebarHostHTML;
        mount.appendChild(wrap.firstChild);
        return document.getElementById('renderContainer');
      },

      // 엔진 스테이지를 카드 크기·단면 bbox 에 맞춰 배치
      //  · ui.js 변환 구조 유지: stage=줌 스케일, mainLayer=Y반전(scale 1,-1)
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

      // Respawn — 물리 재시작 (엔진 UI.reset 재실행)
      rebarRespawn: function () {
        var b = document.getElementById('btnPause');
        if (b) b.innerHTML = '<i class="bi bi-pause-fill"></i> Pause';
        this._drawRebar();
      },

      // Pause/Start — 엔진 Domain.togglePause() 그대로 호출 (btnPause 라벨 토글은 엔진이 처리)
      rebarPause: function () {
        if (typeof Domain !== 'undefined' && typeof Domain.togglePause === 'function') Domain.togglePause();
      },

      // 철근 렌더 실행: USER_BOX_DATA + 입력데이터 전달 후 원본 UI 로 작도/애니메이션
      _drawRebar: function () {
        if (!this._rebarData || !this._rebarData.length) return;
        // 엔진/렌더러 준비 대기
        if (typeof UI === 'undefined' || typeof Domain === 'undefined' || typeof Konva === 'undefined') {
          var self = this; setTimeout(function () { self._drawRebar(); }, 300); return;
        }
        if (!this._ensureRebarHost()) return;

        // 단면형상 + 입력데이터만 전달 (엔진/렌더러는 손대지 않음)
        Domain.USER_BOX_DATA = REBAR_BOX_DATA;
        Domain.USER_REBAR_DATA = this._rebarData;
        Domain.USER_TREBAR_DATA = null; Domain.USER_LREBAR_DATA = null;

        // domain.buildModel 은 sectionSelect.value==="BOXGIRDER" 일 때만 철근 큐를 만든다.
        // seoul_phd 드롭다운(box1cell…)엔 없는 값이므로, 빌드 순간에만 임시로 넣었다 복원.
        var sel = document.getElementById('sectionSelect');
        var prev = sel ? sel.value : null;
        if (sel) {
          var has = Array.prototype.some.call(sel.options, function (o) { return o.value === 'BOXGIRDER'; });
          if (!has) { var op = document.createElement('option'); op.value = 'BOXGIRDER'; op.text = 'BOXGIRDER'; op.hidden = true; sel.appendChild(op); }
          sel.value = 'BOXGIRDER';
        }
        try {
          if (!this._uiInited) { UI.init(); this._uiInited = true; }
          else { UI.reset(); }
          if (sel && prev != null) sel.value = prev;   // 복원 (updateVisuals 는 box 로 계속 동작)
          this._fitEngineStage();
          var rc = document.getElementById('renderContainer');
          if (rc) rc.scrollIntoView({ behavior: 'smooth', block: 'center' });
          console.log('[SeoulPhD] 철근 렌더(ui.js) — T:' + Domain.trebarList.length + ' / L:' + Domain.lrebarList.length);
        } catch (e) { console.error('[SeoulPhD] UI 렌더 오류:', e); }
        finally { if (sel && prev != null) sel.value = prev; }
      },

      // 각 세그먼트 중앙에 번호. 라벨은 비-콘크리트 쪽(외곽→바깥, 내부홀→안쪽)으로 오프셋
      _drawNodes: function () {
        var layer = this._normLayer;
        if (!layer || typeof Konva === 'undefined') return;
        if (this._nodeGroup) { this._nodeGroup.destroy(); this._nodeGroup = null; }

        var lines = this._lines || [], circs = this._circs || [], arcs = this._arcs || [];
        // 내부/외부 판정용 경계(원·아크 테셀레이션)
        var bnd = lines.slice();
        circs.forEach(function (c) {
          var N = 64, ppx, ppy;
          for (var i = 0; i <= N; i++) { var a = i / N * 2 * Math.PI, px = c[0] + c[2] * Math.cos(a), py = c[1] + c[2] * Math.sin(a); if (i > 0) bnd.push([ppx, ppy, px, py]); ppx = px; ppy = py; }
        });
        arcs.forEach(function (c) {
          var x = c[0], y = c[1], r = c[2], sp = c[4] - c[3]; if (sp <= 0) sp += 360;
          var n = Math.max(2, Math.ceil(sp / 5)), ppx, ppy;
          for (var i = 0; i <= n; i++) { var a = (c[3] + sp * i / n) * Math.PI / 180, px = x + r * Math.cos(a), py = y + r * Math.sin(a); if (i > 0) bnd.push([ppx, ppy, px, py]); ppx = px; ppy = py; }
        });
        if (bnd.length === 0) return;

        var minx = 1e18, miny = 1e18, maxx = -1e18, maxy = -1e18;
        bnd.forEach(function (s) { minx = Math.min(minx, s[0], s[2]); maxx = Math.max(maxx, s[0], s[2]); miny = Math.min(miny, s[1], s[3]); maxy = Math.max(maxy, s[1], s[3]); });
        var diag = Math.hypot(maxx - minx, maxy - miny) || 100;
        var fs = diag * 0.016, dotR = diag * 0.005, off = diag * 0.028, eps = diag * 0.006;   // 글씨 축소 + 라벨 오프셋
        var cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
        function inside(px, py) {
          var c = false;
          for (var i = 0; i < bnd.length; i++) { var x1 = bnd[i][0], y1 = bnd[i][1], x2 = bnd[i][2], y2 = bnd[i][3]; if (((y1 > py) !== (y2 > py)) && (px < (x2 - x1) * (py - y1) / ((y2 - y1) || 1e-9) + x1)) c = !c; }
          return c;
        }
        var ty = function (y) { return -y; };

        // 세그먼트: [mx, my, nx, ny] (중앙점 + 단위 법선)
        var segs = [];
        lines.forEach(function (s) { var mx = (s[0] + s[2]) / 2, my = (s[1] + s[3]) / 2, dx = s[2] - s[0], dy = s[3] - s[1], len = Math.hypot(dx, dy) || 1; segs.push([mx, my, -dy / len, dx / len]); });
        arcs.forEach(function (c) { var sp = c[4] - c[3]; if (sp <= 0) sp += 360; var a = (c[3] + sp / 2) * Math.PI / 180; segs.push([c[0] + c[2] * Math.cos(a), c[1] + c[2] * Math.sin(a), Math.cos(a), Math.sin(a)]); });
        circs.forEach(function (c) { segs.push([c[0], c[1] + c[2], 0, 1]); });

        var g = new Konva.Group({ name: 'seoul_nodes' });
        segs.forEach(function (sg, i) {
          var mx = sg[0], my = sg[1], nx = sg[2], ny = sg[3];
          // 라벨 방향 = 콘크리트 반대쪽(구조물선 바깥)
          var ox, oy;
          if (inside(mx + nx * eps, my + ny * eps)) { ox = -nx; oy = -ny; }
          else if (inside(mx - nx * eps, my - ny * eps)) { ox = nx; oy = ny; }
          else { var vx = mx - cx, vy = my - cy, vl = Math.hypot(vx, vy) || 1; ox = vx / vl; oy = vy / vl; }

          var lbl = new Konva.Label({ x: mx + ox * off, y: ty(my + oy * off) });
          lbl.add(new Konva.Tag({ fill: 'rgba(0,0,0,0.78)', cornerRadius: fs * 0.2 }));
          lbl.add(new Konva.Text({ text: String(i + 1), fontSize: fs, fontStyle: 'bold', fontFamily: 'Arial', fill: '#00E5FF', padding: fs * 0.2 }));
          lbl.offsetX(lbl.width() / 2); lbl.offsetY(lbl.height() / 2);
          g.add(lbl);
          g.add(new Konva.Circle({ x: mx, y: ty(my), radius: dotR, fill: '#FF5722', strokeScaleEnabled: false }));
        });
        layer.add(g); this._nodeGroup = g; layer.draw();
      },

      // 캡처된 외곽선(선분+원+아크)에서 벽면 중앙 법선 벡터 (콘크리트 안쪽)
      _drawNormals: function () {
        var layer = this._normLayer;
        if (!layer || typeof Konva === 'undefined') return;
        if (this._normGroup) { this._normGroup.destroy(); this._normGroup = null; }

        var lines = this._lines || [], circs = this._circs || [], arcs = this._arcs || [];
        var bnd = lines.slice();
        circs.forEach(function (c) {
          var N = 64, ppx, ppy;
          for (var i = 0; i <= N; i++) {
            var a = i / N * 2 * Math.PI, px = c[0] + c[2] * Math.cos(a), py = c[1] + c[2] * Math.sin(a);
            if (i > 0) bnd.push([ppx, ppy, px, py]); ppx = px; ppy = py;
          }
        });
        arcs.forEach(function (c) {
          var x = c[0], y = c[1], r = c[2], span = c[4] - c[3];
          if (span <= 0) span += 360;                 // DXF 아크는 CCW(angb→ange)
          var n = Math.max(2, Math.ceil(span / 5)), ppx, ppy;
          for (var i = 0; i <= n; i++) {
            var a = (c[3] + span * i / n) * Math.PI / 180, px = x + r * Math.cos(a), py = y + r * Math.sin(a);
            if (i > 0) bnd.push([ppx, ppy, px, py]); ppx = px; ppy = py;
          }
        });
        if (bnd.length === 0) return;

        var minx = 1e18, miny = 1e18, maxx = -1e18, maxy = -1e18;
        bnd.forEach(function (s) {
          minx = Math.min(minx, s[0], s[2]); maxx = Math.max(maxx, s[0], s[2]);
          miny = Math.min(miny, s[1], s[3]); maxy = Math.max(maxy, s[1], s[3]);
        });
        var diag = Math.hypot(maxx - minx, maxy - miny) || 100;
        var L = diag * 0.035, eps = diag * 0.006;
        var cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;

        function inside(px, py) {
          var c = false;
          for (var i = 0; i < bnd.length; i++) {
            var x1 = bnd[i][0], y1 = bnd[i][1], x2 = bnd[i][2], y2 = bnd[i][3];
            if (((y1 > py) !== (y2 > py)) && (px < (x2 - x1) * (py - y1) / ((y2 - y1) || 1e-9) + x1)) c = !c;
          }
          return c;
        }
        var ty = function (y) { return -y; };
        var g = new Konva.Group({ name: 'seoul_normals' });

        function arrow(mx, my, ux, uy) {
          var dir;
          if (inside(mx + ux * eps, my + uy * eps)) dir = [ux, uy];
          else if (inside(mx - ux * eps, my - uy * eps)) dir = [-ux, -uy];
          else { var vx = cx - mx, vy = cy - my, vl = Math.hypot(vx, vy) || 1; dir = [vx / vl, vy / vl]; }
          var ex = mx + dir[0] * L, ey = my + dir[1] * L;
          g.add(new Konva.Arrow({
            points: [mx, ty(my), ex, ty(ey)],
            stroke: '#FFC107', fill: '#FFC107', strokeWidth: 1.5,
            pointerLength: L * 0.35, pointerWidth: L * 0.28, strokeScaleEnabled: false
          }));
          g.add(new Konva.Circle({ x: mx, y: ty(my), radius: L * 0.12, fill: '#FF5722', strokeScaleEnabled: false }));
        }

        lines.forEach(function (s) {
          var mx = (s[0] + s[2]) / 2, my = (s[1] + s[3]) / 2;
          var dx = s[2] - s[0], dy = s[3] - s[1], len = Math.hypot(dx, dy) || 1;
          arrow(mx, my, -dy / len, dx / len);
        });
        circs.forEach(function (c) {
          for (var i = 0; i < 16; i++) { var a = i / 16 * 2 * Math.PI; arrow(c[0] + c[2] * Math.cos(a), c[1] + c[2] * Math.sin(a), Math.cos(a), Math.sin(a)); }
        });
        arcs.forEach(function (c) {
          var x = c[0], y = c[1], r = c[2], span = c[4] - c[3];
          if (r < diag * 0.03) return;                // 작은 필렛은 법선 생략 (경계엔 포함)
          if (span <= 0) span += 360;
          var m = Math.max(1, Math.round(span / 30));
          for (var k = 0; k < m; k++) { var a = (c[3] + span * (k + 0.5) / m) * Math.PI / 180; arrow(x + r * Math.cos(a), y + r * Math.sin(a), Math.cos(a), Math.sin(a)); }
        });

        layer.add(g); this._normGroup = g; layer.draw();
      },

      init: function () {
        var sel = document.getElementById('sectionSelect');
        this.select(sel ? sel.value : this.sections[0]);
      }
    };
    window.SeoulPhD = SeoulPhD;

    /* ─ KonvaViewer 패치: 치수선 off + 외곽선 캡처 ─ */
    if (typeof KonvaViewer !== 'undefined' && KonvaViewer.prototype) {
      Object.getOwnPropertyNames(KonvaViewer.prototype).forEach(function (m) {
        if (/^addDim/.test(m)) KonvaViewer.prototype[m] = function () { return this; };
      });
      var _oL = KonvaViewer.prototype.addLine;
      KonvaViewer.prototype.addLine = function (v, x1, y1, x2, y2, l) {
        if (SeoulPhD._capturing) { SeoulPhD._lines.push([x1, y1, x2, y2]); SeoulPhD._normLayer = this.layers[v]; }
        return _oL.call(this, v, x1, y1, x2, y2, l);
      };
      var _oC = KonvaViewer.prototype.addCircle;
      KonvaViewer.prototype.addCircle = function (v, x, y, r, l) {
        if (SeoulPhD._capturing) { SeoulPhD._circs.push([x, y, r]); SeoulPhD._normLayer = this.layers[v]; }
        return _oC.call(this, v, x, y, r, l);
      };
      var _oA = KonvaViewer.prototype.addArc;
      KonvaViewer.prototype.addArc = function (v, x, y, r, a0, a1, l) {
        if (SeoulPhD._capturing) { SeoulPhD._arcs.push([x, y, r, a0, a1]); SeoulPhD._normLayer = this.layers[v]; }
        return _oA.call(this, v, x, y, r, a0, a1, l);
      };
    }

    /* ─ style / form (raw 브랜치) 로드 후 실행 (캐시 무효화 ?v=) ─ */
    /* (excel_reader.js 는 ENGINE 목록에서 Pages 로 이미 로드됨) */
    var _bust = '?v=' + Date.now();
    fetch(RAW + 'seoul_phd_style.css' + _bust)
      .then(function (r) { if (!r.ok) throw new Error('CSS HTTP ' + r.status); return r.text(); })
      .then(function (css) { var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); })
      .catch(function (e) { console.error('[SeoulPhD] style load failed:', e); });

    fetch(RAW + 'seoul_phd_form.html' + _bust)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (html) { document.getElementById('app-root').innerHTML = html; SeoulPhD.init(); })
      .catch(function (e) {
        document.getElementById('app-root').innerHTML =
          '<div style="padding:30px;text-align:center;color:#dc2626;font-family:sans-serif;">폼 로드 실패: ' + e.message + '</div>';
        console.error('[SeoulPhD] form load failed:', e);
      });
  }
})();
