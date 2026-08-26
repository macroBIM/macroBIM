/* beam_formula_test.js — QuickFrame · Beam Formula (TEST build)

   단경간 보를 표준 처짐공식으로 푼다. 지점조건과 하중형태를 고르면 그 경우의
   교과서 식이 값과 함께 나오고, 하중도·SFD·BMD·처짐도를 한 장의 도면으로 그린다.

   계산은 전부 beam_engine.js 가 한다 — 이 파일은 폼과 도면뿐이다. 엔진은
   tools/check_beam.js 에서 직접강성법 기준해와 대조된다.

   단면은 두 갈래로 넣는다:
     User define — I 를 직접 적는다
     Database    — H-Section / Channel / Square Tube 목록에서 고른다
   H형강과 채널은 표에 Ix 가 있어 그대로 쓴다. 각형강관 표에는 Ix 가 없어
   A·B·t·r 에서 계산하는데, 같은 형상식으로 낸 단면적이 표의 단면적과
   152행 전부 일치한다 (tools/check_sections.js). 표의 단면적 자체가
   형상에서 계산된 값이므로, 같은 형상 위에서 낸 Ix 도 같은 근거를 갖는다.

   진입점: fbeam_formula(mountId). layout_body_test.js 가 필요할 때 로드한다.  */
(function () {
  'use strict';

  var DESIGN = 'https://macrobim.github.io/design/';
  var BASE   = 'https://macrobim.github.io/macroBIM/';

  /* 도면 색 — 저장소의 단면 도면과 같은 벌 */
  var INK = '#182430', DIM = '#2563eb', HID = '#94a3b8';
  var SFD = '#1d4ed8', BMD = '#b3261e', DEF = '#0f766e';

  /* ── 스타일 : hsection 도면 카드와 같은 어휘 ────────────────────── */
  var CSS_ID = 'bf-style';
  var CSS = [
    '.bf-root{--dim:#2563eb;--muted:#64748b;--line:#cbd5e1;--hair:#e2e8f0;--panel:#fff;--chip:#f1f5f9;--ink:#182430;',
      'color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}',
    '.bf-root *{box-sizing:border-box}',
    // display 를 가진 클래스가 [hidden] 을 이겨 버린다 — 여기서 한 번에 눌러 둔다
    '.bf-root [hidden]{display:none!important}',
    '.bf-grid{display:grid;grid-template-columns:360px minmax(0,1fr);gap:20px;align-items:start}',
    '@media(max-width:980px){.bf-grid{grid-template-columns:1fr}}',
    '.bf-col{display:flex;flex-direction:column;gap:20px}',
    '.bf-card{background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden}',
    '.bf-hd{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;',
      'padding:11px 16px;border-bottom:1px solid var(--hair);background:var(--chip)}',
    '.bf-ttl{font-size:15px;font-weight:600;color:#0f172a;display:inline-flex;align-items:center}',
    '.bf-ttl::before{content:"";display:inline-block;width:4px;height:15px;border-radius:2px;background:#2563eb;margin-right:9px;flex-shrink:0}',
    '.bf-body{padding:14px}',
    '.bf-inrow{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px;padding:5px 0;border-bottom:1px dashed var(--hair)}',
    '.bf-inrow:last-child{border-bottom:0}',
    '.bf-inrow label{font-size:13px;display:flex;align-items:baseline;gap:8px;margin:0}',
    '.bf-inrow .var{font-weight:600;color:var(--dim);min-width:40px;display:inline-block;font-family:ui-monospace,Menlo,Consolas,monospace}',
    '.bf-inrow .desc{color:var(--muted);font-size:12px}',
    '.bf-inrow input,.bf-inrow select{width:150px;text-align:right;padding:5px 8px;border:1px solid var(--line);',
      'border-radius:6px;background:var(--panel);color:var(--ink);font-size:13px;font-family:ui-monospace,Menlo,Consolas,monospace}',
    '.bf-inrow select{text-align:left}',
    '.bf-inrow input:focus,.bf-inrow select:focus{outline:2px solid var(--dim);outline-offset:1px;border-color:var(--dim)}',
    '.bf-inrow input[readonly]{background:#f8fafc;color:var(--muted)}',
    '.bf-unit{color:var(--muted);font-size:11px;margin-left:6px}',
    '.bf-wide{width:100%!important;text-align:left!important}',
    '.bf-btn{font:inherit;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#fff;',
      'background:var(--dim);border:1px solid var(--dim);border-radius:6px;padding:5px 12px;cursor:pointer}',
    '.bf-btn:hover{filter:brightness(1.1)}',
    '.bf-btn,.bf-vbtn{transition:transform .07s ease,filter .07s ease}',
    '.bf-btn:active,.bf-vbtn:active{transform:scale(.93);filter:brightness(.9)}',
    '.bf-vbtn{padding:5px 10px;border:1px solid #cbd5e1;background:#eef2f6;color:#475569;cursor:pointer;',
      'border-radius:6px;font-size:11px;font-weight:700}',
    '.bf-vbtn[aria-pressed="true"]{background:#2563eb;color:#fff;border-color:#2563eb}',
    '.bf-sups{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}',
    '.bf-sup{display:flex;flex-direction:column;align-items:center;gap:5px;padding:9px 6px 7px;border:1px solid var(--line);',
      'border-radius:8px;background:var(--panel);cursor:pointer;font-size:11.5px;color:#475569;font-weight:600;line-height:1.3;text-align:center}',
    '.bf-sup:hover{border-color:#94a3b8}',
    '.bf-sup[aria-pressed="true"]{border-color:var(--dim);background:#eff6ff;color:var(--dim)}',
    '.bf-seg{display:inline-flex;border:1px solid var(--line);border-radius:6px;overflow:hidden}',
    '.bf-seg button{font:inherit;font-size:11px;font-weight:700;padding:5px 11px;border:0;background:#eef2f6;color:#475569;cursor:pointer}',
    '.bf-seg button+button{border-left:1px solid var(--line)}',
    '.bf-seg button[aria-pressed="true"]{background:#2563eb;color:#fff}',
    '.bf-plot{padding:0}.bf-plot svg{display:block;width:100%;height:auto}',
    '.bf-tbl{width:100%;border-collapse:collapse;font-size:12.5px}',
    '.bf-tbl th,.bf-tbl td{padding:6px 12px;border-bottom:1px solid var(--hair);text-align:right;white-space:nowrap}',
    '.bf-tbl th{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:700;background:#f8fafc}',
    '.bf-tbl td{font-family:ui-monospace,Menlo,Consolas,monospace;font-variant-numeric:tabular-nums}',
    '.bf-tbl th:first-child,.bf-tbl td:first-child{text-align:left}',
    '.bf-tbl td.k{font-weight:600;color:var(--ink)}',
    '.bf-tbl td.tex{color:var(--dim);text-align:left}',
    '.bf-tbl td.at{color:var(--muted);font-size:11.5px}',
    '.bf-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:1px;background:var(--hair)}',
    '.bf-stat{background:var(--panel);padding:11px 13px}',
    '.bf-stat .k{font-size:10.5px;letter-spacing:.05em;color:var(--muted);font-weight:700}',
    '.bf-stat .v{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:18px;font-weight:600;margin-top:2px;font-variant-numeric:tabular-nums}',
    '.bf-stat .s{font-size:11px;color:var(--muted);font-family:ui-monospace,Menlo,Consolas,monospace;margin-top:1px}',
    '.bf-note{padding:10px 16px;border-top:1px solid var(--hair);font-size:12px;color:var(--muted);background:#f8fafc}',
    '.bf-note b{color:#0f172a}',
    '.bf-err{padding:12px 16px;color:#b91c1c;font-size:12.5px;font-family:ui-monospace,Menlo,Consolas,monospace}'
  ].join('');

  function css() {
    if (document.getElementById(CSS_ID)) return;
    var st = document.createElement('style'); st.id = CSS_ID; st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* ── 잡동사니 ────────────────────────────────────────────────── */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function num(v, d) {
    if (v == null || !isFinite(v)) return '—';
    if (Math.abs(v) < 5e-4) v = 0;
    var s = v.toFixed(d == null ? 2 : d);
    return (s === '-0.00' || s === '-0.0' || s === '-0') ? s.slice(1) : s;
  }
  function q(root, sel) { return root.querySelector(sel); }

  /* ── 단면 DB ─────────────────────────────────────────────────── */
  var SECT = {
    hsection: { label: 'H-Section', file: 'hsection.csv', name: '호칭치수',
      dims: ['H', 'B', 't1', 't2'], area: '단면적', wt: '단위무게', ix: 'Ix' },
    channel:  { label: 'Channel', file: 'channel.csv', name: '호칭치수',
      dims: ['H', 'B', 't1', 't2'], area: '단면적', wt: '단위무게', ix: 'Ix' },
    squaretube: { label: 'Square Tube', file: 'squaretube.csv', name: '호칭치수',
      dims: ['A', 'B', 't', 'r'], area: '단면적', wt: '단위무게', ix: null }
  };
  var DB = {};                                  // kind → [{name, ix, area, wt, dim}]

  function parseCsv(text) {
    var ln = text.replace(/^﻿/, '').split(/\r?\n/).filter(function (s) { return s.trim(); });
    var head = ln[0].split(',').map(function (s) { return s.trim(); });
    return ln.slice(1).map(function (l) {
      var f = l.split(','), o = {};
      head.forEach(function (h, i) { o[h] = (f[i] || '').trim(); });
      return o;
    });
  }

  /* 모서리가 둥근 직사각형의 면적과 도심축 단면2차모멘트.
     잘려나간 모서리 = (정사각 r×r) − (사분원 r). 그 둘의 ∫y²dA 를 빼면 된다. */
  function roundRect(B, H, r) {
    if (!(r > 0)) return { A: B * H, I: B * H * H * H / 12 };
    var A = B * H - (4 - Math.PI) * r * r;
    var ysq = H / 2 - r / 2, Isq = Math.pow(r, 4) / 12 + r * r * ysq * ysq;
    var Aq = Math.PI * r * r / 4, yq = H / 2 - r + 4 * r / (3 * Math.PI);
    var Iq = (Math.PI * Math.pow(r, 4) / 16 - 4 * Math.pow(r, 4) / (9 * Math.PI)) + Aq * yq * yq;
    return { A: A, I: B * H * H * H / 12 - 4 * (Isq - Iq) };
  }
  function tubeProps(H, B, t, r) {              // H 높이(강축), B 폭, t 두께, r 바깥 모서리
    var o = roundRect(B, H, r), i = roundRect(B - 2 * t, H - 2 * t, Math.max(r - t, 0));
    return { A: o.A - i.A, I: o.I - i.I };      // mm², mm⁴
  }

  function loadDb(kind, cb) {
    if (DB[kind]) { cb(null, DB[kind]); return; }
    var cfg = SECT[kind];
    // 표를 미리 넣어 둔 곳(오프라인 미리보기·번들)이 있으면 그걸 쓴다.
    var seed = (typeof window !== 'undefined' && window.BEAM_SECTION_CSV) ? window.BEAM_SECTION_CSV[cfg.file] : null;
    var get = seed ? Promise.resolve(seed)
                   : fetch(DESIGN + cfg.file + '?v=' + Date.now())
                       .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); });
    get
      .then(function (t) {
        var rows = parseCsv(t).map(function (r) {
          var name = r[cfg.name];
          if (!name) return null;
          var dim = cfg.dims.map(function (d) { return d + ' ' + r[d]; }).join(' · ');
          var ix, area = parseFloat(r[cfg.area]) || 0;
          if (cfg.ix) ix = parseFloat(r[cfg.ix]) || 0;                       // cm⁴, 표에 있는 값
          else {
            var p = tubeProps(+r.A, +r.B, +r.t, +r.r);                        // 각관은 형상에서 계산
            ix = p.I / 1e4; area = p.A / 100;
          }
          return ix > 0 ? { name: name, ix: ix, area: area, wt: parseFloat(r[cfg.wt]) || 0, dim: dim } : null;
        }).filter(Boolean);
        DB[kind] = rows; cb(null, rows);
      })
      .catch(function (e) { cb(e); });
  }

  /* ── SVG 도면 : 저장소 단면 도면과 같은 선·치수 어휘 ───────────── */
  function Sheet(w) {
    var e = [], H = 0;
    function f(n) { return Math.round(n * 100) / 100; }
    return {
      w: w,
      get h() { return H; },
      grow: function (dy) { H += dy; return H; },
      at: function () { return H; },
      line: function (x1, y1, x2, y2, col, wd, dash) {
        e.push('<line x1="' + f(x1) + '" y1="' + f(y1) + '" x2="' + f(x2) + '" y2="' + f(y2) +
          '" stroke="' + col + '" stroke-width="' + wd + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>');
      },
      path: function (d, stroke, wd, fill, op) {
        e.push('<path d="' + d + '" fill="' + (fill || 'none') + '"' + (op != null ? ' fill-opacity="' + op + '"' : '') +
          ' stroke="' + (stroke || 'none') + '" stroke-width="' + (wd || 0) + '" stroke-linejoin="round"/>');
      },
      arrow: function (x, y, ux, uy, col, a) {
        a = a || 7;
        var bx = x - a * ux, by = y - a * uy, px = -uy * a * 0.34, py = ux * a * 0.34;
        e.push('<polygon points="' + f(x) + ',' + f(y) + ' ' + f(bx + px) + ',' + f(by + py) + ' ' +
          f(bx - px) + ',' + f(by - py) + '" fill="' + col + '"/>');
      },
      text: function (x, y, s, col, opt) {
        opt = opt || {};
        e.push('<text x="' + f(x) + '" y="' + f(y) + '" fill="' + col + '" font-size="' + (opt.size || 11.5) +
          '" font-family="ui-monospace,Menlo,Consolas,monospace" text-anchor="' + (opt.anchor || 'middle') +
          '" dominant-baseline="middle"' + (opt.weight ? ' font-weight="' + opt.weight + '"' : '') +
          (opt.rot ? ' transform="rotate(' + f(opt.rot) + ' ' + f(x) + ' ' + f(y) + ')"' : '') + '>' + esc(s) + '</text>');
      },
      dot: function (x, y, r, col) { e.push('<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + r + '" fill="' + col + '"/>'); },
      out: function () {
        var bg = 'background:linear-gradient(#e2e8f0 1px,transparent 1px) 0 0/26px 26px,' +
                 'linear-gradient(90deg,#e2e8f0 1px,transparent 1px) 0 0/26px 26px,#fff;';
        return '<svg viewBox="0 0 ' + w + ' ' + H + '" preserveAspectRatio="xMidYMid meet" style="display:block;' + bg + '">' +
          e.join('') + '</svg>';
      }
    };
  }

  var PAD = 58;
  function SXf(w) { return function (x, L) { return PAD + x / L * (w - 2 * PAD); }; }

  /* 지점 기호 */
  // dir = +1 왼쪽 끝(재료가 왼쪽), −1 오른쪽 끝. 고정단 해칭이 보 위로 넘어오지 않게 한다.
  function drawSupport(s, x, y, kind, dir) {
    if (kind === 'free') return;
    dir = dir || 1;
    if (kind === 'fix') {
      s.line(x, y - 15, x, y + 15, INK, 1.8);
      for (var i = -14; i <= 10; i += 5) s.line(x, y + i, x - 7 * dir, y + i + 7, HID, 1);
      return;
    }
    s.path('M' + x + ' ' + y + ' L' + (x - 9) + ' ' + (y + 15) + ' L' + (x + 9) + ' ' + (y + 15) + ' Z', INK, 1.6);
    if (kind === 'roller') {
      s.path('M' + (x - 5) + ' ' + (y + 19) + ' m -3.4 0 a 3.4 3.4 0 1 0 6.8 0 a 3.4 3.4 0 1 0 -6.8 0', INK, 1.2);
      s.path('M' + (x + 5) + ' ' + (y + 19) + ' m -3.4 0 a 3.4 3.4 0 1 0 6.8 0 a 3.4 3.4 0 1 0 -6.8 0', INK, 1.2);
      s.line(x - 13, y + 23, x + 13, y + 23, INK, 1.4);
    } else {
      s.line(x - 13, y + 17, x + 13, y + 17, INK, 1.4);
      for (var k = -12; k <= 8; k += 5) s.line(x + k, y + 17, x + k - 5, y + 23, HID, 1);
    }
  }

  /* 치수선 — 단면 도면의 DL 과 같은 모양 */
  function drawDim(s, x1, x2, y, label) {
    s.line(x1, y, x2, y, DIM, 1);
    s.arrow(x1, y, -1, 0, DIM); s.arrow(x2, y, 1, 0, DIM);
    s.line(x1, y - 9, x1, y + 5, DIM, 0.6, '2 2');
    s.line(x2, y - 9, x2, y + 5, DIM, 0.6, '2 2');
    s.text((x1 + x2) / 2, y - 9, label, DIM);
  }

  /* 하중 기호 */
  function drawLoads(s, loads, L, SX, y0) {
    var HT = 30;
    loads.forEach(function (ld) {
      var o = window.BeamEngine.Load.norm(ld, L);
      if (o.type === 'w') {
        var a = SX(o.a, L), b = SX(o.b, L);
        var mx = Math.max(Math.abs(o.w1), Math.abs(o.w2)) || 1;
        var h1 = HT * Math.abs(o.w1) / mx, h2 = HT * Math.abs(o.w2) / mx;
        s.path('M' + a + ' ' + (y0 - h1) + ' L' + b + ' ' + (y0 - h2) + ' L' + b + ' ' + y0 + ' L' + a + ' ' + y0 + ' Z',
          DIM, 1, DIM, 0.09);
        var n = Math.max(2, Math.round((b - a) / 30));
        for (var i = 0; i <= n; i++) {
          var t = i / n, X = a + (b - a) * t, hh = h1 + (h2 - h1) * t;
          if (hh < 4) continue;
          s.line(X, y0 - hh, X, y0 - 2, DIM, 0.9);
          s.arrow(X, y0, 0, 1, DIM, 6);
        }
        var lab = (Math.abs(o.w1 - o.w2) < 1e-9) ? num(Math.abs(o.w1), 1)
                : num(Math.abs(o.w1), 1) + ' → ' + num(Math.abs(o.w2), 1);
        s.text((a + b) / 2, y0 - Math.max(h1, h2) - 9, 'w = ' + lab + ' kN/m', DIM);
      } else if (o.type === 'P') {
        var X2 = SX(o.a, L);
        s.line(X2, y0 - 38, X2, y0 - 2, DIM, 1.5);
        s.arrow(X2, y0, 0, 1, DIM, 8);
        s.text(X2, y0 - 45, 'P = ' + num(Math.abs(o.P), 1) + ' kN', DIM);
      } else {
        var X3 = SX(o.a, L), sgn = o.M >= 0 ? 1 : -1;
        s.path('M' + (X3 - 13) + ' ' + (y0 - 5) + ' A 13 13 0 1 ' + (sgn > 0 ? 1 : 0) + ' ' + (X3 + 11) + ' ' + (y0 - 12), DIM, 1.6);
        s.arrow(X3 + 11, y0 - 12, sgn * 0.5, -sgn * 0.86, DIM, 7);
        s.text(X3, y0 - 28, 'M = ' + num(Math.abs(o.M), 1) + ' kN·m', DIM);
      }
    });
  }

  /* 값 곡선 한 판 */
  function drawCurve(s, cfg) {
    var y0 = cfg.y0, amp = cfg.amp, SX = cfg.SX, L = cfg.L, flip = cfg.flip ? 1 : -1;
    var mx = 1e-12, lo = 0, hi = 0, i;
    for (i = 0; i < cfg.v.length; i++) {
      mx = Math.max(mx, Math.abs(cfg.v[i]));
      if (cfg.v[i] < cfg.v[lo]) lo = i;
      if (cfg.v[i] > cfg.v[hi]) hi = i;
    }
    var d = '';
    for (i = 0; i < cfg.v.length; i++) {
      d += (i ? 'L' : 'M') + SX(cfg.x[i], L).toFixed(2) + ' ' + (y0 + flip * amp * cfg.v[i] / mx).toFixed(2) + ' ';
    }
    s.path(d + 'L' + SX(L, L) + ' ' + y0 + ' L' + SX(0, L) + ' ' + y0 + ' Z', 'none', 0, cfg.col, 0.11);
    s.path(d, cfg.col, 1.8);
    s.line(SX(0, L), y0, SX(L, L), y0, HID, 1);
    [lo, hi].forEach(function (k) {
      if (Math.abs(cfg.v[k]) < mx * 0.02) return;
      var X = SX(cfg.x[k], L), Y = y0 + flip * amp * cfg.v[k] / mx;
      s.dot(X, Y, 2.8, cfg.col);
      var off = (Y > y0) ? 12 : -12;
      var t = cfg.absv ? (cfg.v[k] < 0 ? '↓ ' : '↑ ') + num(Math.abs(cfg.v[k]), cfg.dp) : num(cfg.v[k], cfg.dp);
      s.text(X, Y + off, t + ' ' + cfg.unit, cfg.col, { weight: 600 });
    });
    s.text(PAD - 12, y0, cfg.tag, HID, { anchor: 'end', size: 10.5, weight: 700 });
  }

  /* ── 상태 ───────────────────────────────────────────────────── */
  var ST = {
    sup: 'ss', caseId: 'ss-udl', flip: false, view: 'all',
    L: 8, w: 25, P: 60, M0: 40, a: 3,
    E: 205000, I: 23700, src: 'user', kind: 'hsection', pick: '', info: ''
  };

  var SUPICON = {
    ss:   'M8 22 H84 M18 22 l-7 10 h14z M74 22 l-7 10 h14z',
    cant: 'M10 8 V36 M10 22 H86',
    ff:   'M10 8 V36 M82 8 V36 M10 22 H82',
    pf:   'M10 8 V36 M10 22 H84 M74 22 l-7 10 h14z'
  };

  /* ── 화면 ───────────────────────────────────────────────────── */
  function build(root) {
    var BE = window.BeamEngine, F = BE.Formula;

    root.innerHTML =
      '<div class="bf-root"><div class="bf-grid">' +

      '<div class="bf-col">' +
      '  <div class="bf-card">' +
      '    <div class="bf-hd"><span class="bf-ttl">Support &amp; Load</span>' +
      '      <span class="bf-seg" id="bf-flipseg" hidden>' +
      '        <button type="button" data-flip="0" aria-pressed="true">Fixed left</button>' +
      '        <button type="button" data-flip="1" aria-pressed="false">Fixed right</button>' +
      '      </span></div>' +
      '    <div class="bf-body">' +
      '      <div class="bf-sups" id="bf-sups"></div>' +
      '      <div class="bf-inrow"><label><span class="var">Case</span><span class="desc">Pattern</span></label>' +
      '        <span><select id="bf-case" class="bf-wide"></select></span></div>' +
      '      <div class="bf-inrow"><label><span class="var">L</span><span class="desc">Span</span></label>' +
      '        <span><input type="number" id="bf-L" step="0.1" min="0.1"><span class="bf-unit">m</span></span></div>' +
      '      <div class="bf-inrow" id="bf-row-load"><label><span class="var" id="bf-loadvar">w</span>' +
      '        <span class="desc" id="bf-loaddesc">Uniform load</span></label>' +
      '        <span><input type="number" id="bf-load" step="0.5"><span class="bf-unit" id="bf-loadunit">kN/m</span></span></div>' +
      '      <div class="bf-inrow" id="bf-row-a"><label><span class="var">a</span>' +
      '        <span class="desc" id="bf-adesc">Load position</span></label>' +
      '        <span><input type="number" id="bf-a" step="0.1"><span class="bf-unit">m</span></span></div>' +
      '    </div>' +
      '  </div>' +

      '  <div class="bf-card">' +
      '    <div class="bf-hd"><span class="bf-ttl">Section</span>' +
      '      <span class="bf-seg" id="bf-srcseg">' +
      '        <button type="button" data-src="user" aria-pressed="true">User define</button>' +
      '        <button type="button" data-src="db" aria-pressed="false">Database</button>' +
      '      </span></div>' +
      '    <div class="bf-body">' +
      '      <div class="bf-inrow" id="bf-row-kind" hidden><label><span class="var">Type</span><span class="desc">Family</span></label>' +
      '        <span><select id="bf-kind" class="bf-wide"></select></span></div>' +
      '      <div class="bf-inrow" id="bf-row-pick" hidden><label><span class="var">Size</span><span class="desc">Size list</span></label>' +
      '        <span><select id="bf-pick" class="bf-wide"></select></span></div>' +
      '      <div class="bf-inrow"><label><span class="var">E</span><span class="desc">Elastic mod.</span></label>' +
      '        <span><input type="number" id="bf-E" step="1000"><span class="bf-unit">MPa</span></span></div>' +
      '      <div class="bf-inrow"><label><span class="var">I</span><span class="desc">2nd moment</span></label>' +
      '        <span><input type="number" id="bf-I" step="10"><span class="bf-unit">cm⁴</span></span></div>' +
      '    </div>' +
      '    <div class="bf-note" id="bf-secnote"></div>' +
      '  </div>' +
      '</div>' +

      '<div class="bf-col">' +
      '  <div class="bf-card">' +
      '    <div class="bf-hd"><span class="bf-ttl" id="bf-title">Beam Diagram</span>' +
      '      <span id="bf-viewbar" style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">' +
      '        <button type="button" class="bf-vbtn" data-view="all" aria-pressed="true">All</button>' +
      '        <button type="button" class="bf-vbtn" data-view="load" aria-pressed="false">Load</button>' +
      '        <button type="button" class="bf-vbtn" data-view="shear" aria-pressed="false">Shear</button>' +
      '        <button type="button" class="bf-vbtn" data-view="moment" aria-pressed="false">Moment</button>' +
      '        <button type="button" class="bf-vbtn" data-view="defl" aria-pressed="false">Deflection</button>' +
      '      </span></div>' +
      '    <div class="bf-stats" id="bf-stats"></div>' +
      '    <div class="bf-plot" id="bf-plot"></div>' +
      '  </div>' +
      '  <div class="bf-card">' +
      '    <div class="bf-hd"><span class="bf-ttl">Design Formulas</span></div>' +
      '    <table class="bf-tbl" id="bf-formula"></table>' +
      '    <div class="bf-note" id="bf-fnote"></div>' +
      '  </div>' +
      '</div>' +

      '</div></div>';

    /* 지점 칩 */
    var sups = q(root, '#bf-sups');
    sups.innerHTML = ['ss', 'cant', 'ff', 'pf'].map(function (k) {
      return '<button type="button" class="bf-sup" data-sup="' + k + '" aria-pressed="' + (k === ST.sup) + '">' +
        '<svg width="94" height="42" viewBox="0 0 94 42" aria-hidden="true"><path d="' + SUPICON[k] +
        '" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '<span>' + esc(F.SUPLABEL[k]) + '</span></button>';
    }).join('');

    q(root, '#bf-kind').innerHTML = Object.keys(SECT).map(function (k) {
      return '<option value="' + k + '">' + esc(SECT[k].label) + '</option>';
    }).join('');

    /* 값 되돌리기 */
    ['L', 'E', 'I', 'a'].forEach(function (f) { q(root, '#bf-' + f).value = ST[f]; });

    /* 이벤트 */
    sups.addEventListener('click', function (e) {
      var b = e.target.closest('.bf-sup'); if (!b) return;
      ST.sup = b.dataset.sup; ST.flip = false;
      fillCases(root); render(root);
    });
    q(root, '#bf-flipseg').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      ST.flip = b.dataset.flip === '1'; render(root);
    });
    q(root, '#bf-viewbar').addEventListener('click', function (e) {
      var b = e.target.closest('.bf-vbtn'); if (!b) return;
      ST.view = b.dataset.view; render(root);
    });
    q(root, '#bf-srcseg').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      ST.src = b.dataset.src;
      if (ST.src === 'db') pickKind(root); else { ST.info = ''; render(root); }
    });
    q(root, '#bf-kind').addEventListener('change', function () { ST.kind = this.value; pickKind(root); });
    q(root, '#bf-pick').addEventListener('change', function () { applyPick(root, this.value); });
    q(root, '#bf-case').addEventListener('change', function () { ST.caseId = this.value; render(root); });
    ['L', 'load', 'a', 'E', 'I'].forEach(function (f) {
      q(root, '#bf-' + f).addEventListener('input', function () {
        var v = parseFloat(this.value);
        if (f === 'load') {
          var c = F.get(ST.caseId);
          ST[c.needs.indexOf('P') >= 0 ? 'P' : (c.needs.indexOf('M0') >= 0 ? 'M0' : 'w')] = v;
        } else ST[f] = v;
        if (f === 'I' && ST.src === 'db') { ST.src = 'user'; syncSrc(root); }
        render(root);
      });
    });

    fillCases(root);
    render(root);
  }

  function fillCases(root) {
    var F = window.BeamEngine.Formula, list = F.list(ST.sup);
    q(root, '#bf-case').innerHTML = list.map(function (c) {
      return '<option value="' + c.id + '">' + esc(c.load) + '</option>';
    }).join('');
    if (!list.some(function (c) { return c.id === ST.caseId; })) ST.caseId = list[0].id;
    q(root, '#bf-case').value = ST.caseId;
  }

  function syncSrc(root) {
    Array.prototype.forEach.call(q(root, '#bf-srcseg').children, function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.src === ST.src));
    });
    q(root, '#bf-row-kind').hidden = (ST.src !== 'db');
    q(root, '#bf-row-pick').hidden = (ST.src !== 'db');
    q(root, '#bf-I').readOnly = (ST.src === 'db');
  }

  function pickKind(root) {
    syncSrc(root);
    var sel = q(root, '#bf-pick');
    sel.innerHTML = '<option>Loading…</option>';
    q(root, '#bf-secnote').textContent = 'Loading ' + SECT[ST.kind].label + ' table…';
    loadDb(ST.kind, function (err, rows) {
      if (err) {
        sel.innerHTML = '<option>—</option>';
        q(root, '#bf-secnote').innerHTML = '<b>Table not available.</b> ' + esc(SECT[ST.kind].file) +
          ' could not be loaded (' + esc(err.message) + '). Switch to User define and enter I directly.';
        return;
      }
      sel.innerHTML = rows.map(function (r) {
        return '<option value="' + esc(r.name) + '">' + esc(r.name) + '</option>';
      }).join('');
      var want = rows.some(function (r) { return r.name === ST.pick; }) ? ST.pick : rows[Math.min(6, rows.length - 1)].name;
      sel.value = want;
      applyPick(root, want);
    });
  }

  function applyPick(root, name) {
    var rows = DB[ST.kind] || [], r = null;
    rows.forEach(function (x) { if (x.name === name) r = x; });
    if (!r) return;
    ST.pick = name; ST.I = r.ix; ST.src = 'db';
    q(root, '#bf-I').value = (r.ix >= 1000 ? Math.round(r.ix) : r.ix);
    syncSrc(root);
    ST.info = SECT[ST.kind].label + ' ' + r.name + ' &nbsp;·&nbsp; ' + esc(r.dim) +
      ' &nbsp;·&nbsp; A = ' + num(r.area, 2) + ' cm² &nbsp;·&nbsp; ' + num(r.wt, 1) + ' kg/m' +
      (SECT[ST.kind].ix ? '' : ' &nbsp;·&nbsp; <b>Ix computed from A·B·t·r</b>');
    render(root);
  }

  /* ── 그리기 + 계산 ─────────────────────────────────────────── */
  function render(root) {
    var BE = window.BeamEngine, F = BE.Formula;
    var c = F.get(ST.caseId); if (!c) return;

    /* 폼 상태 */
    Array.prototype.forEach.call(q(root, '#bf-sups').children, function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.sup === ST.sup));
    });
    var canFlip = F.canFlip(ST.caseId);
    q(root, '#bf-flipseg').hidden = !canFlip;
    if (!canFlip) ST.flip = false;
    Array.prototype.forEach.call(q(root, '#bf-flipseg').children, function (b) {
      b.setAttribute('aria-pressed', String((b.dataset.flip === '1') === ST.flip));
    });
    Array.prototype.forEach.call(q(root, '#bf-viewbar').children, function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.view === ST.view));
    });

    var needA = c.needs.indexOf('a') >= 0;
    q(root, '#bf-row-a').hidden = !needA;
    var isP = c.needs.indexOf('P') >= 0, isM = c.needs.indexOf('M0') >= 0;
    q(root, '#bf-loadvar').textContent = isP ? 'P' : (isM ? 'M₀' : 'w');
    q(root, '#bf-loaddesc').textContent = isP ? 'Point load' : (isM ? 'Moment' : 'Intensity');
    q(root, '#bf-loadunit').textContent = isP ? 'kN' : (isM ? 'kN·m' : 'kN/m');
    q(root, '#bf-load').value = isP ? ST.P : (isM ? ST.M0 : ST.w);
    q(root, '#bf-adesc').textContent = (ST.sup === 'cant' || ST.sup === 'pf') ? 'from fixed end' : 'from A';
    q(root, '#bf-secnote').innerHTML = ST.info ||
      'Enter I directly, or switch to <b>Database</b> to pick an H-Section, Channel or Square Tube.';

    /* 계산 */
    var EI = ST.E * (ST.I * 1e4) * 1e-9;                 // MPa · mm⁴ → kN·m²
    var p = { L: ST.L, EI: EI, w: ST.w, P: ST.P, M0: ST.M0, a: ST.a, flip: ST.flip };
    var r;
    try { r = F.solve(ST.caseId, p); }
    catch (e) {
      q(root, '#bf-plot').innerHTML = '<div class="bf-err">' + esc(e.message) + '</div>';
      q(root, '#bf-stats').innerHTML = ''; q(root, '#bf-formula').innerHTML = '';
      return;
    }
    var d = r.diag, L = ST.L;

    q(root, '#bf-title').textContent = c.name + (ST.flip ? '  (fixed right)' : '');

    /* 요약 */
    var dmax = Math.abs(d.yx.abs.v), ratio = dmax > 1e-12 ? L / dmax : Infinity;
    var isCant = (ST.sup === 'cant');
    q(root, '#bf-stats').innerHTML = [
      // 캔틸레버는 고정단이 어느 쪽이든 그 쪽 값을 읽는다
      { k: isCant ? 'R fix' : 'R left', v: num(isCant && ST.flip ? d.Vj : d.Vi, 2), s: 'kN', c: SFD },
      { k: isCant ? 'M fix' : 'R right', v: isCant ? num(Math.abs(ST.flip ? r.Mj : r.Mi), 2) : num(d.Vj, 2), s: isCant ? 'kN·m' : 'kN', c: SFD },
      { k: 'M max', v: num(Math.abs(d.Mx.abs.v), 2), s: 'kN·m  @ ' + num(d.Mx.abs.x, 2) + ' m', c: BMD },
      { k: 'δ max', v: num(dmax * 1000, 2), s: 'mm  @ ' + num(d.yx.abs.x, 2) + ' m', c: DEF },
      { k: 'δ / L', v: '1/' + num(ratio, 0), s: 'span ratio', c: DEF },
      { k: 'EI', v: (EI >= 1e4 ? num(EI / 1000, 1) + 'e3' : num(EI, 1)), s: 'kN·m²', c: INK }
    ].map(function (o) {
      return '<div class="bf-stat"><div class="k">' + esc(o.k) + '</div><div class="v" style="color:' + o.c + '">' +
        o.v + '</div><div class="s">' + esc(o.s) + '</div></div>';
    }).join('');

    /* 도면 */
    var w = 900, SX = SXf(w), s = Sheet(w);
    var show = ST.view;
    function want(k) { return show === 'all' || show === k; }

    if (want('load')) {
      var y0 = s.grow(112);
      s.line(SX(0, L), y0, SX(L, L), y0, INK, 2.4);
      drawLoads(s, r.loads, L, SX, y0);
      drawSupport(s, SX(0, L), y0, r.supports[0], 1);
      drawSupport(s, SX(L, L), y0, r.supports[1], -1);
      s.text(SX(0, L) - 16, y0 + 4, 'A', INK, { weight: 700, size: 12 });
      s.text(SX(L, L) + 16, y0 + 4, 'B', INK, { weight: 700, size: 12 });
      drawDim(s, SX(0, L), SX(L, L), y0 + 48, 'L = ' + num(L, 2) + ' m');
      if (needA) drawDim(s, SX(0, L), SX(Math.min(ST.a, L), L), y0 + 74, 'a = ' + num(ST.a, 2) + ' m');
      s.grow(needA ? 92 : 66);
    }
    [['shear', d.S, SFD, 'SFD', 'kN', 1, false, false],
     ['moment', d.M, BMD, 'BMD', 'kN·m', 1, true, false],
     ['defl', d.y.map(function (v) { return v * 1000; }), DEF, 'δ', 'mm', 2, false, true]
    ].forEach(function (cf) {
      if (!want(cf[0])) return;
      var top = s.grow(18), y0 = s.grow(52);
      drawCurve(s, { x: d.x, v: cf[1], col: cf[2], tag: cf[3], unit: cf[4], dp: cf[5],
                     flip: cf[6], absv: cf[7], y0: y0, amp: 46, SX: SX, L: L });
      s.grow(74);          // 진폭 46 + 라벨 — 마지막 판이 잘리지 않게
    });
    if (s.h < 40) s.grow(80);
    q(root, '#bf-plot').innerHTML = s.out();

    /* 공식표 */
    q(root, '#bf-formula').innerHTML =
      '<thead><tr><th>Quantity</th><th>Formula</th><th>Value</th><th>At</th></tr></thead><tbody>' +
      r.closed.map(function (o) {
        var unit = o.kind === 'δ' ? 'mm' : (o.kind === 'θ' ? 'rad' : (o.kind === 'R' ? 'kN' : 'kN·m'));
        var val = o.kind === 'δ' ? num(o.value * 1000, 3) : num(o.value, o.kind === 'θ' ? 5 : 2);
        return '<tr><td class="k">' + esc(o.k) + '</td><td class="tex">' + esc(o.tex) + '</td><td>' +
          val + ' ' + unit + '</td><td class="at">' + esc(o.at || '') + '</td></tr>';
      }).join('') + '</tbody>';

    var fnote = (ST.sup === 'cant' || ST.sup === 'pf')
      ? 'x is measured from the fixed end, so the table reads the same whichever side is fixed.'
      : 'x is measured from support A.';
    q(root, '#bf-fnote').innerHTML = (c.note ? '<b>' + esc(c.note) + '</b> ' : '') + esc(fnote) +
      ' Sagging moment and downward deflection are positive; BMD is drawn on the tension side.';
  }

  /* ── 진입점 ─────────────────────────────────────────────────── */
  function start(mountId) {
    var root = document.getElementById(mountId || 'mount-beam-formula');
    if (!root) return;
    css();
    if (window.BeamEngine) { build(root); return; }
    root.innerHTML = '<div class="bf-root"><div class="bf-card"><div class="bf-note">Loading engine…</div></div></div>';
    var sc = document.createElement('script');
    sc.src = BASE + 'beam_engine.js?v=' + Date.now();
    sc.onload = function () { build(root); };
    sc.onerror = function () {
      root.innerHTML = '<div class="bf-root"><div class="bf-card"><div class="bf-err">beam_engine.js failed to load.</div></div></div>';
    };
    document.head.appendChild(sc);
  }

  if (typeof window !== 'undefined') window.fbeam_formula = start;
  // 각형강관 형상식은 node 에서도 확인한다 (tools/check_sections.js) — 검사가
  // 실제로 배포되는 코드를 보게 하려고 여기서 그대로 내보낸다.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { roundRect: roundRect, tubeProps: tubeProps, parseCsv: parseCsv, SECT: SECT };
  }
}());
