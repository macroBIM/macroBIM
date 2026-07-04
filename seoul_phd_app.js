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
    PAGES + 'konvaviewer.js', PAGES + 'bim_plotly_geo.js', PAGES + 'bim_dxf.js', PAGES + 'geomath.js',
    PAGES + 'bim_box1cell.js', PAGES + 'bim_ibeam.js', PAGES + 'bim_rect.js',
    PAGES + 'bim_circle.js', PAGES + 'bim_octagon.js', PAGES + 'bim_track.js'
  ];
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
      showNormals: false,
      _cur: null, _capturing: false, _lines: [], _circs: [], _arcs: [], _normLayer: null, _normGroup: null,

      select: function (kind) {
        var mount = document.getElementById('mount');
        if (!mount) return;
        mount.innerHTML = '';
        var tpl = document.getElementById('tpl-' + kind);
        if (tpl) mount.appendChild(tpl.content.cloneNode(true));
        var sel = document.getElementById('sectionSelect');
        if (sel && sel.value !== kind) sel.value = kind;
        this.redraw(kind);
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
        }
      },

      toggleNormals: function () {
        this.showNormals = !this.showNormals;
        var b = document.getElementById('btnToggleNormals');
        if (b) b.classList.toggle('active', this.showNormals);
        if (this._cur) this._frontOnly(this._cur);
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

    /* ─ style / form (raw 브랜치) 로드 후 실행 ─ */
    fetch(RAW + 'seoul_phd_style.css')
      .then(function (r) { if (!r.ok) throw new Error('CSS HTTP ' + r.status); return r.text(); })
      .then(function (css) { var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); })
      .catch(function (e) { console.error('[SeoulPhD] style load failed:', e); });

    fetch(RAW + 'seoul_phd_form.html')
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (html) { document.getElementById('app-root').innerHTML = html; SeoulPhD.init(); })
      .catch(function (e) {
        document.getElementById('app-root').innerHTML =
          '<div style="padding:30px;text-align:center;color:#dc2626;font-family:sans-serif;">폼 로드 실패: ' + e.message + '</div>';
        console.error('[SeoulPhD] form load failed:', e);
      });
  }
})();
