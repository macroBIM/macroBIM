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

  // ── trebar 굴짐반경(중심선) 기본값 ─────────────────────────────
  //  · EN 1992-1-1 Table 8.1N 최소 맨드럴: ϕ≤16 → 4ϕ, ϕ>16 → 7ϕ (내면 지름)
  //    내면반경 = 맨드럴/2, 세그먼트는 철근 중심선이므로 중심선반경 = 내면반경 + ϕ/2
  //    → ϕ≤16 : 2.5ϕ,  ϕ>16 : 4ϕ  (모두 중심선 기준, 단위 mm)
  //  · KS 규격 철근 직경별 값은 아래 맵에 미리 채워둠 — 특정 직경을 바꾸려면 여기서 mm 수정
  //  · 우선순위: 철근별 radius 입력 > 직경별 맵 > EN 규칙
  var BEND_RADIUS_BY_DIA = {   // KS 공칭직경(D) → 중심선 곡선반경(mm), EN 최소기준
    10: 25, 13: 32.5, 16: 40, 19: 76, 22: 88, 25: 100, 29: 116, 32: 128, 35: 140, 38: 152, 41: 164, 51: 204
  };
  function bendRadiusForDia(dia) {
    if (dia == null || !(dia > 0)) return 0;
    if (BEND_RADIUS_BY_DIA[dia] != null) return BEND_RADIUS_BY_DIA[dia];
    var inside = (dia <= 16) ? 2 * dia : 3.5 * dia;   // EN 맨드럴/2 = 내면반경
    return inside + dia / 2;                            // 중심선 반경
  }
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
      _cur: null, _capturing: false, _lines: [], _circs: [], _arcs: [], _normLayer: null, _normGroup: null, _nodeGroup: null, _uiInited: false, _settleTimer: null, _rebarSettled: false, _vars: null, _showEngNormals: false, _showEngNodes: false, _engNormGroup: null, _engNodeGroup: null,

      select: function (kind) {
        var mount = document.getElementById('mount');
        if (!mount) return;
        this._excelData = null; this._rebarData = null;  // 섹션 변경 시 로딩된 rebar 데이터 초기화
        if (this._settleTimer) { clearInterval(this._settleTimer); this._settleTimer = null; }
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
        this.redraw(kind);          // redraw 가 끝에서 _drawRebar 로 엔진 뷰까지 그린다
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
          ['trebar', 'id', 'code', 'dia', 'init (x, y, rot)', 'set', 'segs (len)', 'angs', 'nors', 'barStart', 'barEnd', 'radius', 'z'],
          ['lrebar', 'id', 'dia', 'num', 'init', 'nors', 'range', 'path', 'ctc', 'ctcmax', 'ctcmin', '', 'z']
        ];
        var ncol = SCHEMA[0].length;

        // 엑셀 로드됐으면 'type' 블록의 데이터 행 추출 (엑셀 자체 헤더 행은 제외)
        var dataRows = [];
        if (this._excelData && typeof window.extractBlockFromData === 'function') {
          var block = window.extractBlockFromData(this._excelData, 'type');
          if (block && block.length > 1) dataRows = block.slice(1);
          dataRows = dataRows.filter(function (r) { var t = String((r && r[0]) == null ? '' : r[0]).trim(); return t && t.charAt(0) !== '#'; });   // # 주석 행 제외
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
        // VAR 카드 → 변수 scope. Dimension 입력이 수식이면 계산값으로 임시 치환 후 작도, 이후 원 수식 복원.
        var scope = this._evalScope();
        var restores = [];
        if (mount) {
          mount.querySelectorAll('input[id$="_s"]').forEach(function (inp) {
            var raw = inp.value;
            var num = (typeof Calc !== 'undefined') ? Calc.num(raw, scope, raw) : raw;
            restores.push([inp, raw]);
            inp.value = num;                       // bim 모듈이 읽을 계산값
            var eid = inp.id.slice(0, -2) + '_e';
            var e = document.getElementById(eid);
            if (!e) { e = document.createElement('input'); e.type = 'hidden'; e.id = eid; mount.appendChild(e); }
            e.value = num;
          });
        }
        var fn = window['fdraw_' + kind];
        if (typeof fn === 'function') {
          try { fn(); this._frontOnly(kind); }
          catch (e) { console.error('[SeoulPhD] fdraw_' + kind + ' 오류:', e); }
        } else {
          console.warn('[SeoulPhD] fdraw_' + kind + ' 미로드');
        }
        restores.forEach(function (p) { p[0].value = p[1]; });   // 화면 입력엔 원래 수식 복원
        this._drawRebar();   // 형상 변경(치수·중공 등)마다 엔진 뷰도 재작도 (bim 캡처 반영)
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

      // 법선/노드 토글 — 엔진 뷰에 단면 치수 비례 스케일로 앞단이 직접 그림 (엔진 UI.drawNormals 는 고정크기라 미사용)
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

      // 광선-세그먼트 교차 (n 단위벡터, 반환 t = 거리; 미교차 -1)
      _rayHit: function (px, py, dx, dy, ax, ay, bx, by) {
        var ex = bx - ax, ey = by - ay, den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-9) return -1;
        var t = ((ax - px) * ey - (ay - py) * ex) / den;
        var s = ((ax - px) * dy - (ay - py) * dx) / den;
        return (t > 1e-6 && s >= -0.02 && s <= 1.02) ? t : -1;
      },

      // 안쪽 법선 화살표 — 길이 = diag×0.05, 단 반대편 벽까지 거리의 42%로 제한(얇은 웹·환형 겹침 방지)
      _drawEngineNormals: function () {
        if (typeof UI === 'undefined' || !UI.mainLayer) return;
        if (this._engNormGroup) { this._engNormGroup.destroy(); this._engNormGroup = null; }
        var walls = (typeof Domain !== 'undefined' && Domain.currentSection && Domain.currentSection.walls) || [];
        if (!this._showEngNormals || !walls.length) { UI.mainLayer.draw(); return; }
        var diag = this._sectionDiag(walls);
        var scale = (UI.stage && UI.stage.scaleX && UI.stage.scaleX()) || 1;   // 스테이지 줌 배율(annotation scale)
        var arrowL = 26 / scale, minGap = diag * 0.09, dotR = 6 / scale;   // 화면 픽셀 기준 고정 → 도형 크기 무관하게 일정
        var thin = walls.length > 40;   // 곡선 등 조밀 단면만 솎기; 박스 등 벽 적은 단면은 전부 표시
        var g = new Konva.Group({ name: 'eng_normals' });
        var lastx = null, lasty = null;
        walls.forEach(function (w) {
          var mx = (w.x1 + w.x2) / 2, my = (w.y1 + w.y2) / 2;
          if (thin && lastx !== null && Math.hypot(mx - lastx, my - lasty) < minGap) return;   // 조밀 단면만 간격 솎기
          lastx = mx; lasty = my;
          var L = arrowL;   // 반대편 벽 거리로 깎지 않고 고정 길이 → 일정한 크기
          g.add(new Konva.Arrow({ points: [mx, my, mx + w.nx * L, my + w.ny * L], stroke: '#FFC107', fill: '#FFC107', strokeWidth: 2, pointerLength: L * 0.34, pointerWidth: L * 0.3, strokeScaleEnabled: false }));
          g.add(new Konva.Circle({ x: mx, y: my, radius: dotR, fill: '#FF5722', strokeScaleEnabled: false }));
        });
        UI.mainLayer.add(g); this._engNormGroup = g; UI.mainLayer.draw();
      },

      // 벽 id(E1,E2…) 라벨 + 끝점 — 폰트/점 크기도 diag 비례, 간격 솎음
      _drawEngineNodes: function () {
        if (typeof UI === 'undefined' || !UI.mainLayer) return;
        if (this._engNodeGroup) { this._engNodeGroup.destroy(); this._engNodeGroup = null; }
        var walls = (typeof Domain !== 'undefined' && Domain.currentSection && Domain.currentSection.walls) || [];
        if (!this._showEngNodes || !walls.length) { UI.mainLayer.draw(); return; }
        var diag = this._sectionDiag(walls);
        var scale = (UI.stage && UI.stage.scaleX && UI.stage.scaleX()) || 1;   // 스테이지 줌 배율(annotation scale)
        var fs = 13 / scale, dotR = 6 / scale, minGap = diag * 0.09;   // 화면 픽셀 기준 고정 → 도형 크기 무관하게 일정
        var thin = walls.length > 40;   // 곡선 등 조밀 단면만 라벨 솎기; 박스 등 벽 적은 단면은 모든 벽 id 표시
        var g = new Konva.Group({ name: 'eng_nodes' });
        var lastx = null, lasty = null;
        walls.forEach(function (w) {
          var mx = (w.x1 + w.x2) / 2, my = (w.y1 + w.y2) / 2;
          if (thin && lastx !== null && Math.hypot(mx - lastx, my - lasty) < minGap) return;   // 조밀 단면만 라벨 솎기
          lastx = mx; lasty = my;
          g.add(new Konva.Circle({ x: mx, y: my, radius: dotR, fill: '#FF5722', strokeScaleEnabled: false }));
          var lbl = new Konva.Label({ x: mx + w.nx * fs * 0.6, y: my + w.ny * fs * 0.6, scaleY: -1 });   // 라벨은 안쪽으로 약간
          lbl.add(new Konva.Tag({ fill: 'rgba(0,0,0,0.78)', cornerRadius: fs * 0.2 }));
          lbl.add(new Konva.Text({ text: String(w.id || ''), fontSize: fs, fontStyle: 'bold', fontFamily: 'Arial', fill: '#00E5FF', padding: fs * 0.18 }));
          lbl.offsetX(lbl.width() / 2); lbl.offsetY(lbl.height() / 2);
          g.add(lbl);
        });
        UI.mainLayer.add(g); this._engNodeGroup = g; UI.mainLayer.draw();
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
            self._loadBox1cellFromExcel(data);   // 'box1cell' 블록 추출 → 단면 입력칸 채우고 재작도
            self._renderRebarTables();      // 'type' 블록 추출 → REBAR 카드에 표 출력
            self._rebarData = self._parseRebar(data);   // 표 → trebar/lrebar 객체 배열
            console.log('[SeoulPhD] 철근 파싱:', self._rebarData);
            self._drawRebar();              // physics 로 철근 작도
          }).catch(function (e) { alert('엑셀 로드 오류: ' + e.message); });
        };
        fi.click();
      },

      // ─────────────────────────────────────────────────────────
      //  엑셀 'box1cell' 블록 → box1cell 단면 입력칸 채우기 + 재작도
      //    헤더 이름(h,bt,bb,...)을 폼 input id 로 매핑해 value 설정.
      //    데이터 행은 헤더 바로 아래 첫 행을 사용.
      // ─────────────────────────────────────────────────────────
      _box1cellMap: {
        h: 'dh_s', bt: 'dbt_s', bb: 'dbb_s', btsh: 'dbth_s', bcanh: 'dbch_s', bcan: 'dbc_s',
        t1: 'dt1_s', t2: 'dt2_s', t3: 'dt3_s', t4: 'dt4_s', t5: 'dt5_s', tb: 'dtb_s', tw: 'dtw_s',
        bh: 'dbbh_s', vh1: 'dbh1_s', vh2: 'dbh2_s', rwt: 'drwt_s', rwtin: 'drwtin_s', rb: 'drb_s',
        sl_tl: 'dsltl_s', sl_tr: 'dsltr_s', sl_b: 'dslb_s'
      },
      _loadBox1cellFromExcel: function (fullData) {
        if (typeof window.extractBlockFromData !== 'function') return;
        var block = window.extractBlockFromData(fullData, 'box1cell');
        if (!block || block.length < 2) return;   // 헤더 + 데이터 최소 1행 필요
        var header = block[0];      // ['box1cell', 'h', 'bt', ...]
        var row = block[1];         // ['<id>', 6600, 12000, ...]
        var map = this._box1cellMap;
        var n = 0;
        for (var c = 1; c < header.length; c++) {
          var name = String(header[c] == null ? '' : header[c]).trim();
          var id = map[name];
          if (!id) continue;
          var v = row[c];
          if (v == null || v === '') continue;
          var el = document.getElementById(id);
          if (el) { el.value = v; n++; }
        }
        console.log('[SeoulPhD] box1cell 단면 로드: ' + n + '개 변수 적용');
        if (n > 0 && this._cur === 'box1cell') this.redraw('box1cell');
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
          if (!type || type.charAt(0) === '#') continue;   // 첫 셀이 # 로 시작하면 주석 → 건너뜀
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
              '<button type="button" class="engine-btn" onclick="SeoulPhD.exportDXF()"><i class="bi bi-download"></i> Export DXF</button>' +
            '</div>' +
            '<div class="draw-card-desc" id="stat-grid">철근이 설계 위치를 찾아갑니다…</div>' +
          '</div>' +
          '<div class="draw-card-body" style="padding:0;">' +
            '<div id="renderContainer" style="width:100%;height:600px;background:#41699b;border-radius:0 0 10px 10px;overflow:hidden;cursor:grab;"></div>' +
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

      // ─────────────────────────────────────────────────────────
      //  굴짐(bend) 후처리 — 안착된 trebar 세그먼트 모서리에 곡선반경 아크 적용
      //  · geo_fillet(geomath.js) 재사용 → 직선-아크-직선-아크 경로 (line/arc primitive)
      //  · 반경 = 철근별 radius, 없으면 DEFAULT_BEND_MULT × dia. 인접 직선 안에 들어오게 클램프
      //  · 렌더(아크 테셀레이션 폴리라인) 와 DXF(line+arc) 가 같은 primitive 사용
      // ─────────────────────────────────────────────────────────
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

      // 굴짐 아크 trebar 를 하나의 폴리라인(아크 테셀레이션)으로 그린다 (엔진 색상 #8A2BE2)
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

      // 안착 완료 감시 → 완료되면 애니메이션 정지 후 trebar 를 굴짐 아크로 대체
      //  · 시간이 아니라 "큐 진행"으로 판정: 진행되는 한 계속 대기(느린 안착에도 fillet 유지).
      //  · 한 철근이 안착 못해 큐가 정체되면 그 철근을 강제 스킵하고 다음으로 → 불량 입력 1개가
      //    전체를 멈추지 않게. 스킵된 id 는 로그+알림.
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
            if (it && it.obj) it.obj.state = (kind === 'trebar') ? 'FORMED' : 'SETTLED';
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

      // 통합 정렬 — 벽 방향 "인력"으로 당겨 붙이고, 겹치면 "반발"로 밀어냄 (z-order 게이팅).
      //  · trebar = 엔진이 이미 벽에 밀착시킨 고정 cage(장애물). lrebar = 인력으로 cage/벽에 붙임.
      //  · 같은 z 끼리만 상호작용(다른 z = 다른 층 → 무시, 2D상 겹쳐 지나감).
      //  · PBD: 매 스텝 인력으로 당긴 뒤 겹침을 tangent 까지 완전 복원 → gap 없이 딱 접. 벽(cover)로 관통 방지.
      //  · z 는 입력 미입력 시 0. (trebar-trebar 강체 반발은 별도 — 엔진 적층이 이미 분리)
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
            for (var wi = 0; wi < a.walls.length; wi++) {                       // 3) 벽 배리어 — 콘크리트 안쪽(법선) 반공간: 박스 밖으로 못 나감
              var w = a.walls[wi], q2 = distSeg(P.x, P.y, w.x1, w.y1, w.x2, w.y2);
              var sd = (P.x - q2.cx) * w.nx + (P.y - q2.cy) * w.ny, need2 = coverOf(w) + a.r;   // 안쪽 법선 기준 부호거리(안쪽 +)
              if (sd < need2) { var push = need2 - sd; P.x += w.nx * push; P.y += w.ny * push; }   // 항상 콘크리트 안쪽으로만 복원
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

      // lrebar 를 실제 반경(dia/2)으로 그림 — 엔진 drawLrebar 은 박스에서 반경을 최소 30(model)으로 과대하게 그려
      //  물리적으로 이격돼도 화면상 trebar 와 겹쳐 보인다. 완화 후 실제 크기로 재작도해 계산과 표현을 일치시킨다.
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

      // 미안착(부분 적용 시) trebar 를 직선으로 그림 — updateVisuals 와 동일 좌표 규칙
      _drawStraightTrebar: function (t, group) {
        var segs = t.segments || [], dia = t.dia || 13;
        segs.forEach(function (s) {
          var pts = (s.state === 'SETTLED')
            ? [s.p1.x, s.p1.y, s.p2.x, s.p2.y]
            : [s.nodes[0].x, s.nodes[0].y, s.nodes[1].x, s.nodes[1].y];
          group.add(new Konva.Line({ points: pts, stroke: '#8A2BE2', strokeWidth: (dia > 0 ? dia : 5), lineCap: 'round', strokeScaleEnabled: true }));
        });
      },

      // ── DXF 출력: 단면(SECTION) + trebar(굴짐 line+arc) + lrebar(원) ──
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

      // 철근 렌더 실행: USER_BOX_DATA + 입력데이터 전달 후 원본 UI 로 작도/애니메이션
      _drawRebar: function () {
        // 엔진/렌더러 준비 대기 (철근 데이터가 없어도 단면+그리드는 렌더 → 디폴트 화면)
        if (typeof UI === 'undefined' || typeof Domain === 'undefined' || typeof Konva === 'undefined') {
          var self = this; setTimeout(function () { self._drawRebar(); }, 300); return;
        }
        if (!this._ensureRebarHost()) return;
        // rebar physics 를 쓸 땐 bim "Drawing View" 카드는 숨긴다 (그림 하나만)
        var _plot = document.getElementById(this._cur + 'plot');
        var _bimCard = _plot && _plot.closest ? _plot.closest('.draw-card') : null;
        if (_bimCard) _bimCard.style.display = 'none';

        // 스테이지/그룹/애니메이션 1회 생성 (엔진 UI.init — box branch 는 아래서 다시 reset)
        if (!this._uiInited) {
          try { UI.init(); this._uiInited = true; } catch (e) { console.error('[SeoulPhD] UI.init 오류:', e); return; }
        }
        // 재작도마다: 직선 애니메이션 재개 + 안착 감시 리셋 (안착 후 굴짐 아크로 대체)
        this._rebarSettled = false;
        if (this._settleTimer) { clearInterval(this._settleTimer); this._settleTimer = null; }
        if (UI.anim && UI.anim.start) UI.anim.start();

        var isBox = (this._cur === 'box1cell');   // box1cell 만 엔진 BoxGirder(당신 데이터와 정확히 일치)
        var sel = null, prev = null;
        try {
          if (isBox) {
            Domain.USER_BOX_DATA = REBAR_BOX_DATA;
            Domain.USER_REBAR_DATA = this._rebarData || [];
            Domain.USER_TREBAR_DATA = null; Domain.USER_LREBAR_DATA = null;
            // buildModel 은 sectionSelect.value==="BOXGIRDER" 일 때만 큐를 만든다 → 빌드 순간만 주입 후 복원
            sel = document.getElementById('sectionSelect'); prev = sel ? sel.value : null;
            if (sel) {
              var has = Array.prototype.some.call(sel.options, function (o) { return o.value === 'BOXGIRDER'; });
              if (!has) { var op = document.createElement('option'); op.value = 'BOXGIRDER'; op.text = 'BOXGIRDER'; op.hidden = true; sel.appendChild(op); }
              sel.value = 'BOXGIRDER';
            }
            UI.reset();
            if (sel && prev != null) sel.value = prev;
          } else {
            // ── 범용 어댑터: bim 외곽선 → 엔진 단면(walls/displayPaths/covers) → 그리기 ──
            var sec = this._buildSectionFromBim();
            if (sec && sec.walls.length) this._applyGenericSection(sec);
            else console.warn('[SeoulPhD] ' + this._cur + ' 외곽선을 벽체로 변환하지 못했습니다.');
          }
          this._fitEngineStage();
          this._watchSettle();     // 안착 완료되면 trebar 모서리를 굴짐 아크로 대체
          if (this._showEngNormals) this._drawEngineNormals();   // 켜져 있으면 새 단면에 맞춰 재작도
          if (this._showEngNodes) this._drawEngineNodes();
          var rc = document.getElementById('renderContainer');
          if (rc && this._rebarData && this._rebarData.length) rc.scrollIntoView({ behavior: 'smooth', block: 'center' });
          console.log('[SeoulPhD] 철근 렌더 — ' + this._cur + ' | T:' + Domain.trebarList.length + ' / L:' + Domain.lrebarList.length + ' | walls:' + (Domain.currentSection ? Domain.currentSection.walls.length : 0));
        } catch (e) { console.error('[SeoulPhD] 렌더 오류:', e); }
        finally { if (sel && prev != null) sel.value = prev; }
      },

      // ─────────────────────────────────────────────────────────
      //  범용 어댑터 — 캡처된 bim 외곽선(_lines/_arcs/_circs) → 엔진 단면
      //  · 끝점을 이어 닫힌 loop 로 정렬 (physics.splitWallLoops 요건)
      //  · 각 벽면 안쪽(콘크리트 쪽) 법선 + E1,E2… id + displayPaths
      //  · 좌표는 bim 논리좌표(y-up) 그대로 — UI.mainLayer(scaleY:-1)가 bim 뷰와 동일 방향으로 반전
      // ─────────────────────────────────────────────────────────
      _buildSectionFromBim: function () {
        var lines = this._lines || [], arcs = this._arcs || [], circs = this._circs || [];
        var raw = [];
        lines.forEach(function (s) { raw.push([s[0], s[1], s[2], s[3]]); });
        arcs.forEach(function (c) {
          var x = c[0], y = c[1], r = c[2], sp = c[4] - c[3]; if (sp <= 0) sp += 360;
          var n = Math.max(2, Math.ceil(sp / 10)), ppx, ppy;
          for (var i = 0; i <= n; i++) { var a = (c[3] + sp * i / n) * Math.PI / 180, px = x + r * Math.cos(a), py = y + r * Math.sin(a); if (i > 0) raw.push([ppx, ppy, px, py]); ppx = px; ppy = py; }
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
        var segs = raw.map(function (s) { return { x1: s[0], y1: s[1], x2: s[2], y2: s[3], used: false }; });
        var loops = [];
        for (var s0 = 0; s0 < segs.length; s0++) {
          if (segs[s0].used) continue;
          segs[s0].used = true;
          var sx = segs[s0].x1, sy = segs[s0].y1, ex = segs[s0].x2, ey = segs[s0].y2;
          var loop = [{ x1: sx, y1: sy, x2: ex, y2: ey }], guard = 0;
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
            loop.push({ x1: ex, y1: ey, x2: nX, y2: nY });
            ex = nX; ey = nY;
          }
          if (near(ex, ey, sx, sy)) { loop[loop.length - 1].x2 = sx; loop[loop.length - 1].y2 = sy; }
          loops.push(loop);
        }
        // 원은 각각 독립 loop
        circs.forEach(function (c) {
          var N = 48, loop = [], ppx, ppy;
          for (var i = 0; i <= N; i++) { var a = i / N * 2 * Math.PI, px = c[0] + c[2] * Math.cos(a), py = c[1] + c[2] * Math.sin(a); if (i > 0) loop.push({ x1: ppx, y1: ppy, x2: px, y2: py }); ppx = px; ppy = py; }
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
            walls.push({ id: 'E' + eid, tag: 'outer', nx: nx, ny: ny, x1: seg.x1, y1: seg.y1, x2: seg.x2, y2: seg.y2 });
            pts.push({ x: seg.x2, y: seg.y2 });
          });
          displayPaths.push(pts);
        });
        return { walls: walls, displayPaths: displayPaths, covers: { top: 50, outer: 50, inner: 50 } };
      },

      // 어댑터 단면을 엔진에 적용 + 큐 생성 + 단면 그리기 (UI.reset 의 섹션 파트 재현, 엔진 렌더 함수 사용)
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
        sec.displayPaths.forEach(function (path) {
          var flat = []; path.forEach(function (p) { flat.push(p.x, p.y); });
          UI.sectionGroup.add(new Konva.Line({ points: flat, stroke: '#ffffff', strokeWidth: 2, closed: true, lineJoin: 'round', strokeScaleEnabled: false }));
        });
        if (typeof UI.drawGrid === 'function') UI.drawGrid();
        if (typeof UI.drawNormals === 'function') UI.drawNormals();
        if (typeof UI.drawDebugNodes === 'function') UI.drawDebugNodes();
        UI.mainLayer.draw();
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

      // ─────────────────────────────────────────────────────────
      //  VAR 카드 — 상수·수식 변수를 정의(순차 참조) → Dimension 에서 사용
      // ─────────────────────────────────────────────────────────
      _ensureVarCard: function () {
        if (document.getElementById('varCard')) return;
        var stage = document.getElementById('stage'), mount = document.getElementById('mount');
        if (!stage || !mount) return;
        var card = document.createElement('div');
        card.className = 'draw-card'; card.id = 'varCard';
        card.innerHTML =
          '<div class="draw-card-header">' +
            '<div><div class="draw-card-title">Variables <span style="font-weight:400;color:#94a3b8;font-size:12px;">(상수·수식 정의 — 아래 Dimension 에서 참조. 예: W=12000, H=W/2, t=sqrt(W))</span></div></div>' +
            '<button type="button" class="engine-btn" onclick="SeoulPhD.addVarRow()"><i class="bi bi-plus-lg"></i> Add</button>' +
          '</div>' +
          '<div class="draw-card-body"><div id="varBody" class="var-grid"></div></div>';
        stage.insertBefore(card, mount);
        if (!this._vars) this._vars = [{ name: '', expr: '' }];
        this._renderVarRows();
      },

      _esc: function (v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },

      _renderVarRows: function () {
        var body = document.getElementById('varBody');
        if (!body) return;
        if (!this._vars || !this._vars.length) this._vars = [{ name: '', expr: '' }];
        var self = this, h = '';
        this._vars.forEach(function (v, i) {
          h += '<div class="var-row">' +
            '<input class="form-input var-name" placeholder="이름 (예: W)" value="' + self._esc(v.name) + '" oninput="SeoulPhD.onVarInput(' + i + ',\'name\',this.value)" onchange="SeoulPhD.onVarChange()">' +
            '<input class="form-input var-expr" placeholder="값 또는 수식 (예: 12000, W/2, sqrt(W)*2)" value="' + self._esc(v.expr) + '" oninput="SeoulPhD.onVarInput(' + i + ',\'expr\',this.value)" onchange="SeoulPhD.onVarChange()">' +
            '<span class="var-val" id="varval-' + i + '"></span>' +
            '<button type="button" class="var-del" title="행 삭제" onclick="SeoulPhD.removeVarRow(' + i + ')">×</button>' +
          '</div>';
        });
        body.innerHTML = h;
        this._evalScope();   // 미리보기 갱신
      },

      onVarInput: function (i, key, val) {
        if (!this._vars || !this._vars[i]) return;
        this._vars[i][key] = val;
        this._evalScope();   // 계산값 미리보기만 (재작도는 onchange)
      },
      onVarChange: function () { if (this._cur) this.redraw(this._cur); },
      addVarRow: function () { if (!this._vars) this._vars = []; this._vars.push({ name: '', expr: '' }); this._renderVarRows(); },
      removeVarRow: function (i) {
        if (!this._vars) return;
        this._vars.splice(i, 1);
        if (!this._vars.length) this._vars.push({ name: '', expr: '' });
        this._renderVarRows();
        this.onVarChange();
      },

      // VAR 행 → scope. 각 행 미리보기(계산값/오류)도 갱신.
      _evalScope: function () {
        var scope = {}, errors = [];
        if (typeof Calc !== 'undefined') { var b = Calc.buildScope(this._vars || []); scope = b.scope; errors = b.errors; }
        var errMap = {}; errors.forEach(function (e) { errMap[e.name] = e.msg; });
        (this._vars || []).forEach(function (v, i) {
          var span = document.getElementById('varval-' + i);
          if (!span) return;
          var nm = String(v.name || '').trim();
          if (!nm) { span.textContent = ''; span.className = 'var-val'; return; }
          if (errMap[nm] || !(nm in scope) || !isFinite(scope[nm])) { span.textContent = '⚠ ' + (errMap[nm] || '오류'); span.className = 'var-val err'; }
          else { span.textContent = '= ' + (Math.round(scope[nm] * 1000) / 1000); span.className = 'var-val ok'; }
        });
        return scope;
      },

      init: function () {
        this._ensureVarCard();
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

    /* ─ Rectangle: 내부 헌치(챔퍼) 단면 override ─
       메인 앱(design/layout_body_test.js → bim_xsect_test.js, window.XSECT)의 rect
       지오메트리와 동일: 외곽 사각형 + 내부 보이드(twl/twr 좌/우 벽두께, tf1/tf2
       상/하 플랜지, ha/hb 안쪽 모서리 헌치). Pages 의 구버전 bim_rect.js(H/B/h/b)를
       대체하여, redraw('rect') 캡처 경로가 헌치 외곽선을 그대로 벽체로 변환한다. */
    (function () {
      function _rv(id, d) { var e = document.getElementById(id); var n = e ? parseFloat(e.value) : NaN; return isNaN(n) ? d : n; }
      function rectParams() {
        var hc = document.getElementById('drect_hollow');
        return {
          H: _rv('drect_H_s', 800), B: _rv('drect_B_s', 600),
          twl: _rv('drect_twl_s', 120), twr: _rv('drect_twr_s', 120),
          tf1: _rv('drect_tf1_s', 120), tf2: _rv('drect_tf2_s', 120),
          ha: _rv('drect_ha_s', 150), hb: _rv('drect_hb_s', 150),
          hollow: hc ? hc.checked : true
        };
      }
      // 외곽(CCW) + 내부 보이드(챔퍼 8각) → 각 loop = 닫힌 [x1,y1,x2,y2] 배열
      // (bim_xsect_test.js 의 XSECT.geo('rect', …) 공식과 동일)
      function rectLoops(p) {
        var H = +p.H || 0, B = +p.B || 0, twl = +p.twl || 0, twr = +p.twr || 0,
            tf1 = +p.tf1 || 0, tf2 = +p.tf2 || 0, ha = +p.ha || 0, hb = +p.hb || 0;
        function edges(V) { var L = []; for (var i = 0; i < V.length; i++) { var a = V[i], b = V[(i + 1) % V.length]; L.push([a[0], a[1], b[0], b[1]]); } return L; }
        var xo0 = -B / 2, xo1 = B / 2;
        var loops = [edges([[xo0, 0], [xo1, 0], [xo1, H], [xo0, H]])];
        if (p.hollow !== false) {
          var ix0 = xo0 + twl, ix1 = xo1 - twr, iy0 = tf2, iy1 = H - tf1;
          if (ix1 > ix0 && iy1 > iy0) {
            var cha = Math.max(0, Math.min(ha, (ix1 - ix0) / 2)), chb = Math.max(0, Math.min(hb, (iy1 - iy0) / 2));
            var IV = (cha > 0 && chb > 0)
              ? [[ix0 + cha, iy0], [ix1 - cha, iy0], [ix1, iy0 + chb], [ix1, iy1 - chb], [ix1 - cha, iy1], [ix0 + cha, iy1], [ix0, iy1 - chb], [ix0, iy0 + chb]]
              : [[ix0, iy0], [ix1, iy0], [ix1, iy1], [ix0, iy1]];
            loops.push(edges(IV));
          }
        }
        return loops;
      }
      // fdraw_rect_2d('front') 를 대체 — KonvaViewer 로 그려 캡처 훅(_lines)에 실린다
      window.fdraw_rect_2d = function () {
        var plot = document.getElementById('rectplot');
        var host = document.getElementById('rect_2dview');
        if (!host && plot) {
          host = document.createElement('div'); host.id = 'rect_2dview';
          host.style.cssText = 'width:100%;height:526px;background:#000;';
          plot.innerHTML = ''; plot.appendChild(host);
        }
        if (!host || typeof KonvaViewer === 'undefined') return;
        var ocvs = new KonvaViewer('rect_2dview', { gridCols: 1, layout: [{ views: ['front'], span: 1 }] });
        ocvs.addLayer('rect_solid', 'cyan', 'solid', 1.5);
        rectLoops(rectParams()).forEach(function (loop) {
          loop.forEach(function (s) { ocvs.addLine('front', s[0], s[1], s[2], s[3], 'rect_solid'); });
        });
        ocvs.render();
      };
      window.fdraw_rect = function () { try { window.fdraw_rect_2d('front'); } catch (e) { console.error('[SeoulPhD] fdraw_rect 오류:', e); } };
      // DXF: 외곽+내부 폴리라인 (모델좌표 y-up). form 의 DXF 버튼이 호출.
      SeoulPhD.rectDxf = function (name) {
        try {
          var e = ['0', 'SECTION', '2', 'ENTITIES'];
          function nn(v) { return String(Math.round(v * 1000) / 1000); }
          rectLoops(rectParams()).forEach(function (loop) {
            loop.forEach(function (s) { e.push('0', 'LINE', '8', '0', '10', nn(s[0]), '20', nn(s[1]), '30', '0', '11', nn(s[2]), '21', nn(s[3]), '31', '0'); });
          });
          e.push('0', 'ENDSEC', '0', 'EOF');
          var blob = new Blob([e.join('\n')], { type: 'application/dxf' }), url = URL.createObjectURL(blob), a = document.createElement('a');
          a.href = url; a.download = name || 'Rect.dxf'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        } catch (err) { console.error('[SeoulPhD] rect DXF 오류:', err); }
      };
    })();

    /* ─ style / form (raw 브랜치) 로드 후 실행 (캐시 무효화 ?v=) ─ */
    /* (excel_reader.js 는 ENGINE 목록에서 Pages 로 이미 로드됨) */
    var _bust = '?v=' + Date.now();
    fetch(RAW + 'seoul_phd_style.css' + _bust)
      .then(function (r) { if (!r.ok) throw new Error('CSS HTTP ' + r.status); return r.text(); })
      .then(function (css) { var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); })
      .catch(function (e) { console.error('[SeoulPhD] style load failed:', e); });

    // calc.js(프런트 수식 평가기) 먼저 주입 → 그다음 form + init (init 의 첫 redraw 전에 Calc 준비)
    fetch(RAW + 'calc.js' + _bust)
      .then(function (r) { if (!r.ok) throw new Error('calc HTTP ' + r.status); return r.text(); })
      .then(function (code) { var s = document.createElement('script'); s.textContent = code; document.head.appendChild(s); })
      .catch(function (e) { console.error('[SeoulPhD] calc.js load failed:', e); })
      .then(function () {
        return fetch(RAW + 'seoul_phd_form.html' + _bust)
          .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
          .then(function (html) { document.getElementById('app-root').innerHTML = html; SeoulPhD.init(); });
      })
      .catch(function (e) {
        document.getElementById('app-root').innerHTML =
          '<div style="padding:30px;text-align:center;color:#dc2626;font-family:sans-serif;">폼 로드 실패: ' + e.message + '</div>';
        console.error('[SeoulPhD] form load failed:', e);
      });
  }
})();
