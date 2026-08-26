/* beam_formula.js — MacroBEAM · SimpleBEAM (PRODUCTION build)

   단경간 보를 표준 처짐공식으로 푼다. 지점조건과 하중형태를 고르면 그 경우의
   교과서 식이 값과 함께 나오고, 하중도·SFD·BMD·처짐도를 한 장의 도면으로 그린다.

   계산은 전부 beam_engine.js 가 한다 — 이 파일은 폼과 도면뿐이다. 엔진은
   tools/check_beam.js 에서 직접강성법 기준해와 대조된다.

   단면은 두 갈래로 넣는다:
     User define — I 를 직접 적는다
     Database    — H형강 · 채널 · 각형강관 · 파이프
   H형강과 채널은 표에 Ix 가 있어 그대로 쓴다. 각형강관과 파이프 표에는 Ix 가
   없어 치수에서 계산하는데, 같은 형상식으로 낸 단면적이 표의 단면적과 전부
   일치한다 (tools/check_sections.js). 표의 단면적 자체가 형상에서 계산된
   값이므로, 같은 형상 위에서 낸 Ix 도 같은 근거를 갖는다.

   단면계수는 Stop = Ix/y_top, Sbot = Ix/y_bot 이다. 넷 다 강축에 대칭이라
   둘이 같고, 표에 단면계수가 실린 H형강·채널은 그 값과 맞는지 검사에서 확인한다.

   진입점: fbeam_formula(mountId). layout_body.js 가 필요할 때 로드한다.

   테스트본(beam_formula_test.js)의 사본이다. 고치는 것은 언제나 테스트본이 먼저이고,
   확인이 끝나면 여기로 옮긴다 — 저장소의 다른 모듈과 같은 방식:
       cp beam_formula_test.js beam_formula.js
       # 머리주석 두 줄과 엔진 ?v= 를 운영값으로 되돌리고,
       # design/layout_body.js 의 ?v= 도 같이 올린다
   테스트본은 늘 최신을 봐야 하므로 엔진을 ?v=Date.now() 로 부르지만, 운영은
   반대로 고정 버전을 쓴다 — 방문자는 아는 빌드 위에 있어야 한다.            */
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
    /* 입력 : 그림 : 결과 = 3 : 4 : 3. 좁아지면 결과가 아래로 한 줄 내려가고,
       더 좁아지면 셋 다 쌓인다. */
    '.bf-grid{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,4fr) minmax(0,3fr);',
      'gap:18px;align-items:start}',
    '@media(max-width:1400px){.bf-grid{grid-template-columns:minmax(0,4fr) minmax(0,6fr)}',
      '.bf-grid>.bf-col:nth-child(3){grid-column:1/-1}}',
    '@media(max-width:900px){.bf-grid{grid-template-columns:1fr}',
      '.bf-grid>.bf-col:nth-child(3){grid-column:auto}}',
    '.bf-col{display:flex;flex-direction:column;gap:18px}',
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
    '.bf-lsel{font:inherit;font-size:11px;font-weight:700;padding:5px 8px;border:1px solid var(--line);',
      'border-radius:6px;background:#eef2f6;color:#475569;cursor:pointer;max-width:200px}',
    '.bf-lsel:focus{outline:2px solid var(--dim);outline-offset:1px}',
    '.bf-lsel.one{background:#eff6ff;border-color:#bfdbfe;color:var(--dim)}',
    /* 지점 — 보 하나에 양 끝 체크박스. 체크=고정, 해제=자유. */
    '.bf-cond{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;font-weight:700;color:var(--dim);',
      'background:#eff6ff;border:1px solid #bfdbfe;border-radius:5px;padding:3px 9px}',
    '.bf-cond.bad{color:#b3261e;background:#fef2f2;border-color:#fecaca}',
    '.bf-prev{border-bottom:1px solid var(--hair)}',
    '.bf-prev svg{display:block;width:100%;height:auto}',
    '.bf-ends{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--hair);border-bottom:1px solid var(--hair)}',
    '.bf-end{display:flex;flex-direction:column;gap:6px;padding:11px 14px;background:var(--panel);margin:0}',
    '.bf-end b{font-size:12px;font-weight:600;color:#0f172a}',
    '.bf-eseg{align-self:flex-start}',
    '.bf-eseg button{padding:5px 9px;font-size:11px}',
    '.bf-alert{padding:11px 14px;background:#fef2f2;border-bottom:1px solid #fecaca;color:#991b1b;font-size:12.5px;line-height:1.6}',
    '.bf-alert b{color:#7f1d1d}',
    /* 하중표 — 줄마다 종류·크기·자리. b 는 분포하중에만 있다. */
    '.bf-ltbl{width:100%;border-collapse:collapse;font-size:12.5px}',
    '.bf-ltbl th{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);',
      'font-weight:700;text-align:left;padding:0 5px 5px}',
    '.bf-ltbl td{padding:3px 4px;vertical-align:middle}',
    '.bf-ltbl td.no{color:var(--muted);font-family:ui-monospace,Menlo,Consolas,monospace;width:18px;text-align:center}',
    '.bf-ltbl input,.bf-ltbl select{width:100%;padding:5px 6px;border:1px solid var(--line);border-radius:6px;',
      'background:var(--panel);color:var(--ink);font-size:12.5px;text-align:right;',
      'font-family:ui-monospace,Menlo,Consolas,monospace}',
    '.bf-ltbl select{text-align:left}',
    '.bf-ltbl input:focus,.bf-ltbl select:focus{outline:2px solid var(--dim);outline-offset:1px;border-color:var(--dim)}',
    '.bf-ltbl td.dash{color:var(--muted);text-align:center;font-family:ui-monospace,Menlo,Consolas,monospace}',
    '.bf-units{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:10.5px;color:var(--muted);',
      'font-weight:400;margin-left:10px;letter-spacing:0}',
    '.bf-del{width:24px;height:24px;padding:0;border:1px solid var(--line);border-radius:6px;background:#f8fafc;',
      'color:var(--muted);cursor:pointer;font-size:15px;line-height:1;font-weight:700}',
    '.bf-del:hover{border-color:#fca5a5;color:#b3261e;background:#fef2f2}',
    '.bf-del[disabled]{opacity:.35;cursor:default}',
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
    '.bf-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));gap:1px;background:var(--hair)}',
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
  /* 표에서 온 값은 유효숫자 3~4자리다. 계산해서 낸 값도 같은 자리로 끊는다 —
     5.794603167007244 cm⁴ 는 정직해 보이지만 아무도 그렇게 읽지 않는다. */
  /* 휨응력. M[kN·m] = M·1e6 N·mm, S[cm³] = S·1e3 mm³ → σ[MPa] = 1000·M/S.
     하연인장이 양(sagging)이므로 그때 상연은 압축(−), 하연은 인장(+)이다.
     S 를 넣지 않았으면 나누지 않고 0 을 낸다 — 오류가 아니라 아직 모르는 값이다. */
  function stressTop(M, Stop) { return (Stop > 0) ? -1000 * M / Stop : 0; }
  function stressBot(M, Sbot) { return (Sbot > 0) ?  1000 * M / Sbot : 0; }
  function sgnTag(v) { return (v > 0) ? 'tension' : (v < 0 ? 'compression' : ''); }

  function sig(v, n) {
    if (!isFinite(v) || v === 0) return 0;
    return Number(v.toPrecision(n || 4));
  }

  /* ── 단면 DB ─────────────────────────────────────────────────── */
  /* 단면표. 강축(x) 휨 기준으로 도심에서 상·하 연단까지의 거리를 잡는다.
     여기 넷은 모두 강축에 대칭이라 y_top = y_bot 이고 따라서 Stop = Sbot 이다.
       sym  — 대칭 단면의 연단거리
       calc — 표에 Ix 가 없는 것(각관·파이프)은 치수에서 계산한다
     열 이름이 표마다 다르므로 여기서 흡수한다. 순서는 Steel Section Tables
     페이지와 같게 둔다. */
  var SECT = {
    hsection: { label: 'H-Section', file: 'hsection.csv', name: '호칭치수',
      dims: ['H', 'B', 't1', 't2'], area: '단면적', wt: '단위무게', ix: 'Ix', zx: 'Sx',
      sym: function (r) { return +r.H / 2; } },
    channel: { label: 'Channel', file: 'channel.csv', name: '호칭치수',
      dims: ['H', 'B', 't1', 't2'], area: '단면적', wt: '단위무게', ix: 'Ix', zx: 'Zx',
      sym: function (r) { return +r.H / 2; } },
    squaretube: { label: 'Square Tube', file: 'squaretube.csv', name: '호칭치수',
      dims: ['A', 'B', 't', 'r'], area: '단면적', wt: '단위무게',
      calc: function (r) { var p = tubeProps(+r.A, +r.B, +r.t, +r.r); return { I: p.I, A: p.A, y: +r.A / 2 }; } },
    pipe: { label: 'Pipe', file: 'pipe.csv', name: '호칭치수',
      dims: ['D', 't'], area: '단면적', wt: '단위무게',
      calc: function (r) { var D = +r.D, d = D - 2 * (+r.t);
        return { I: Math.PI * (Math.pow(D, 4) - Math.pow(d, 4)) / 64,
                 A: Math.PI * (D * D - d * d) / 4, y: D / 2 }; } }
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

  /* 표의 한 줄 → 화면이 쓰는 단면 물성. loadDb 안에 두면 node 에서 볼 수 없어
     tools/check_sections.js 가 배포되는 코드가 아니라 사본을 검사하게 된다. */
  function sectionRow(cfg, r) {
    var name = r[cfg.name];
    if (!name) return null;
    var ix, area = parseFloat(r[cfg.area]) || 0, ytop, ybot;
    if (cfg.calc) {
      var p = cfg.calc(r);
      ix = p.I / 1e4; area = p.A / 100; ytop = ybot = p.y;          // cm⁴, cm², mm
    } else {
      ix = parseFloat(r[cfg.ix]) || 0;
      ytop = ybot = cfg.sym(r);
    }
    if (!(ix > 0 && ytop > 0 && ybot > 0)) return null;
    return {
      name: name, ix: ix, area: area, wt: parseFloat(r[cfg.wt]) || 0,
      dim: cfg.dims.map(function (d) { return d + ' ' + r[d]; }).join(' · '),
      ytop: ytop, ybot: ybot,
      stop: ix / (ytop / 10), sbot: ix / (ybot / 10),               // cm⁴ / cm → cm³
      calc: !!cfg.calc
    };
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
        var rows = parseCsv(t).map(function (r) { return sectionRow(cfg, r); }).filter(Boolean);
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
        // halo: 글자 뒤에 흰 테두리를 깔아 지시선 위에서도 읽히게 한다
        var halo = opt.halo ? ' stroke="#fff" stroke-width="3.2" paint-order="stroke"' : '';
        e.push('<text x="' + f(x) + '" y="' + f(y) + '"' + halo + ' fill="' + col + '" font-size="' + (opt.size || 11.5) +
          '" font-family="ui-monospace,Menlo,Consolas,monospace" text-anchor="' + (opt.anchor || 'middle') +
          '" dominant-baseline="middle"' + (opt.weight ? ' font-weight="' + opt.weight + '"' : '') +
          (opt.rot ? ' transform="rotate(' + f(opt.rot) + ' ' + f(x) + ' ' + f(y) + ')"' : '') + '>' + esc(s) + '</text>');
      },
      raw: function (html) { e.push(html); },
      dot: function (x, y, r, col) { e.push('<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + r + '" fill="' + col + '"/>'); },
      out: function () {
        var bg = 'background:linear-gradient(#e2e8f0 1px,transparent 1px) 0 0/26px 26px,' +
                 'linear-gradient(90deg,#e2e8f0 1px,transparent 1px) 0 0/26px 26px,#fff;';
        return '<svg viewBox="0 0 ' + w + ' ' + H + '" preserveAspectRatio="xMidYMid meet" style="display:block;' + bg + '">' +
          e.join('') + '</svg>';
      }
    };
  }

  /* 도면의 좌표폭을 실제로 렌더되는 픽셀폭에 맞춘다. viewBox 를 고정해 두면
     열이 좁아질 때 글자까지 같이 줄어들어 읽을 수 없게 된다 — 폭을 따라가면
     글자는 늘 같은 크기로 나온다. */
  function padOf(w) { return Math.round(Math.max(38, Math.min(58, w * 0.075))); }
  function SXf(w, pad) { return function (x, L) { return pad + x / L * (w - 2 * pad); }; }
  function plotWidth(root, sel) {
    var el = q(root, sel);
    var w = el ? el.clientWidth : 0;
    return Math.round(Math.max(360, Math.min(1200, w || 560)));
  }

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

  /* 하중 기호.
     하중을 여러 개 넣을 수 있게 되면서 라벨이 서로 밟는다. 자리를 잡아 주는
     작은 배치기를 둔다 — 같은 높이에 이미 글자가 있으면 한 칸 위로 올린다.
     분포하중 띠를 먼저 깔고 집중하중을 그 위에 얹어야 화살표가 묻히지 않는다. */
  var LOAD_BAND = 30;                 // 분포하중 띠의 최대 높이
  function loadHeadroom(n) { return LOAD_BAND + 16 + 13 * Math.max(0, n - 1) + 26; }

  function drawLoads(s, loads, L, SX, y0) {
    var base = y0 - LOAD_BAND - 16, placed = [];
    function label(x, text, col) {
      var half = text.length * 2.9 + 5, lvl = 0, hit;
      do {
        hit = placed.some(function (p) { return p.lvl === lvl && Math.abs(p.x - x) < p.half + half; });
        if (hit) lvl++;
      } while (hit && lvl < 12);
      placed.push({ x: x, half: half, lvl: lvl });
      var y = base - lvl * 13;
      s.text(x, y, text, col, { halo: 1 });
      return y;
    }

    var norm = (loads || []).map(function (ld) { return window.BeamEngine.Load.norm(ld, L); });

    // ① 분포하중 띠
    norm.forEach(function (o) {
      if (o.type !== 'w') return;
      var x1 = SX(o.a, L), x2 = SX(o.b, L);
      var mx = Math.max(Math.abs(o.w1), Math.abs(o.w2)) || 1;
      var h1 = LOAD_BAND * Math.abs(o.w1) / mx, h2 = LOAD_BAND * Math.abs(o.w2) / mx;
      s.path('M' + x1 + ' ' + (y0 - h1) + ' L' + x2 + ' ' + (y0 - h2) + ' L' + x2 + ' ' + y0 + ' L' + x1 + ' ' + y0 + ' Z',
        DIM, 1, DIM, 0.09);
      var n = Math.max(2, Math.round((x2 - x1) / 30));
      for (var i = 0; i <= n; i++) {
        var t = i / n, X = x1 + (x2 - x1) * t, hh = h1 + (h2 - h1) * t;
        if (hh < 4) continue;
        s.line(X, y0 - hh, X, y0 - 2, DIM, 0.9);
        s.arrow(X, y0, 0, 1, DIM, 6);
      }
      var lab = (Math.abs(o.w1 - o.w2) < 1e-9) ? num(Math.abs(o.w1), 1)
              : num(Math.abs(o.w1), 1) + ' → ' + num(Math.abs(o.w2), 1);
      var ly = label((x1 + x2) / 2, 'w = ' + lab + ' kN/m', DIM);
      s.line((x1 + x2) / 2, ly + 6, (x1 + x2) / 2, y0 - Math.max(h1, h2) - 1, HID, 0.6, '2 2');
    });

    // ② 집중하중·모멘트 — 띠 위에 얹는다
    norm.forEach(function (o) {
      if (o.type === 'w') return;
      var X = SX(o.a, L);
      if (o.type === 'P') {
        var ly = label(X, 'P = ' + num(Math.abs(o.P), 1) + ' kN', DIM);
        s.line(X, ly + 7, X, y0 - 2, DIM, 1.6);
        s.arrow(X, y0, 0, 1, DIM, 8);
      } else {
        var sgn = o.M >= 0 ? 1 : -1;
        s.path('M' + (X - 13) + ' ' + (y0 - 5) + ' A 13 13 0 1 ' + (sgn > 0 ? 1 : 0) + ' ' + (X + 11) + ' ' + (y0 - 12), DIM, 1.6);
        s.arrow(X + 11, y0 - 12, sgn * 0.5, -sgn * 0.86, DIM, 7);
        label(X, 'M = ' + num(Math.abs(o.M), 1) + ' kN·m', DIM);
      }
    });
  }

  /* 값 곡선 한 판 */
  function drawCurve(s, cfg) {
    var y0 = cfg.y0, amp = cfg.amp, SX = cfg.SX, L = cfg.L, flip = cfg.flip ? 1 : -1;
    var pad = cfg.pad;
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
    s.text(pad - 12, y0, cfg.tag, HID, { anchor: 'end', size: 10.5, weight: 700 });
    return { y0: y0, amp: amp, mx: mx, sgn: flip, col: cfg.col, unit: cfg.unit,
             dp: cfg.dp, absv: !!cfg.absv, x: cfg.x, v: cfg.v };
  }

  /* 격자 위 임의 x 의 값 — 커서가 짚는 자리를 읽는다.
     집중하중 자리에서는 x 가 겹쳐 있으므로(계단) 그 구간을 건너뛰지 않게 한다. */
  function valueAt(xs, vs, x) {
    var lo = 0, hi = xs.length - 1;
    if (x <= xs[0]) return vs[0];
    if (x >= xs[hi]) return vs[hi];
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; }
    var dx = xs[hi] - xs[lo];
    return dx < 1e-12 ? vs[hi] : vs[lo] + (vs[hi] - vs[lo]) * (x - xs[lo]) / dx;
  }

  /* ── 그래프 위 커서 ───────────────────────────────────────────────
     마우스가 올라간 자리의 값을 그 자리에서 읽어 준다. 도면을 다시 그리지
     않고 오버레이의 좌표만 바꾼다 — 마우스 이동마다 SVG 를 새로 만들면
     끊긴다. 리스너는 컨테이너에 한 번만 걸고, 그릴 때마다 CUR 에 그 판의
     정보를 남겨 둔다. */
  var CUR = null;
  var MONO = 'ui-monospace,Menlo,Consolas,monospace';

  function cursorLayer(probes, H) {
    var g = '<g id="bf-cur" style="display:none" pointer-events="none">';
    g += '<line id="bf-curline" y1="2" y2="' + (H - 2) + '" stroke="' + INK +
         '" stroke-width="0.9" stroke-dasharray="3 3" opacity=".5"/>';
    g += '<rect id="bf-curbox" y="3" width="92" height="18" rx="4" fill="#fff" stroke="' + DIM + '" stroke-width="1"/>';
    g += '<text id="bf-curx" y="12.5" font-family="' + MONO + '" font-size="11" font-weight="600" fill="' + DIM +
         '" text-anchor="middle" dominant-baseline="middle"></text>';
    probes.forEach(function (p, i) {
      g += '<circle id="bf-cd' + i + '" r="3.4" fill="' + p.col + '" stroke="#fff" stroke-width="1.2"/>';
      g += '<text id="bf-ct' + i + '" font-family="' + MONO + '" font-size="11" font-weight="600" fill="' + p.col +
           '" text-anchor="middle" dominant-baseline="middle" stroke="#fff" stroke-width="3.2" paint-order="stroke"></text>';
    });
    return g + '</g>';
  }

  /* 화면 좌표 → 보의 x. 범위를 벗어나면 null. */
  function cursorX(ev) {
    if (!CUR) return null;
    var svg = q(CUR.root, '#bf-plot').querySelector('svg');
    if (!svg) return null;
    var box = svg.getBoundingClientRect();
    if (!box.width) return null;
    var px = (ev.clientX - box.left) / box.width * CUR.w;
    var x = (px - CUR.pad) / (CUR.w - 2 * CUR.pad) * CUR.L;
    if (x < -0.02 * CUR.L || x > 1.02 * CUR.L) return null;
    return Math.min(Math.max(x, 0), CUR.L);
  }

  function cursorMove(ev) {
    if (!CUR) return;
    var svg = q(CUR.root, '#bf-plot').querySelector('svg');
    var g = svg && svg.querySelector('#bf-cur');
    if (!g) return;
    var x = cursorX(ev);
    if (x == null) { g.style.display = 'none'; return; }
    var px = CUR.pad + x / CUR.L * (CUR.w - 2 * CUR.pad);
    g.style.display = '';

    var line = svg.querySelector('#bf-curline');
    line.setAttribute('x1', px.toFixed(1)); line.setAttribute('x2', px.toFixed(1));
    var bw = 92, bx = Math.min(Math.max(px - bw / 2, 2), CUR.w - bw - 2);
    svg.querySelector('#bf-curbox').setAttribute('x', bx.toFixed(1));
    var tx = svg.querySelector('#bf-curx');
    tx.setAttribute('x', (bx + bw / 2).toFixed(1));
    tx.textContent = 'x = ' + num(x, 3) + ' m';

    CUR.probes.forEach(function (p, i) {
      var v = valueAt(p.x, p.v, x);
      var y = p.y0 + p.sgn * p.amp * (v / p.mx);
      var dot = svg.querySelector('#bf-cd' + i), t = svg.querySelector('#bf-ct' + i);
      dot.setAttribute('cx', px.toFixed(1)); dot.setAttribute('cy', y.toFixed(1));
      var above = (y > p.y0);                       // 축 아래면 라벨을 위로
      t.setAttribute('x', Math.min(Math.max(px, 34), CUR.w - 34).toFixed(1));
      t.setAttribute('y', (y + (above ? -11 : 12)).toFixed(1));
      t.textContent = (p.absv ? (v < 0 ? '↓ ' : '↑ ') + num(Math.abs(v), p.dp) : num(v, p.dp)) + ' ' + p.unit;
    });
  }

  function cursorHide() {
    if (!CUR) return;
    var svg = q(CUR.root, '#bf-plot').querySelector('svg');
    var g = svg && svg.querySelector('#bf-cur');
    if (g) g.style.display = 'none';
  }

  /* ── 상태 ───────────────────────────────────────────────────── */
  var ST = {
    /* 지점은 양 끝을 각각 Free / Roller / Fixed 로 잡는다.
       한 끝에 있을 수 있는 상태가 그 셋이고, 조합이 곧 표준 경우가 된다. */
    endL: 'roller', endR: 'roller', view: 'all', showLoad: 'all',
    atX: null,      // null 이면 L/2 (손대기 전까지 지간을 따라간다)
    /* 하중은 목록이다. 종류는 둘뿐 —
         w : 등분포, a = 좌단에서 시작점, b = 재하길이
         P : 집중,   a = 좌단에서 작용점 */
    loads: [{ type: 'w', v: 25, a: 0, b: 8 }],
    L: 8,
    E: 205000, I: 23700, src: 'user', kind: 'hsection', pick: '', info: '',
    stop: 0, sbot: 0        // 0 이면 응력을 내지 않는다 (나누지 않는다)
  };

  /* 양 끝의 상태 조합이 곧 표준 경우 하나다. 아홉 칸 중 일곱이 풀리는 문제이고,
     나머지 둘은 구조가 성립하지 않는다:
       free + free   보가 떠 있다
       roller + free 지점 하나로는 그 점을 중심으로 돌아간다 (기구)
     롤러 두 개면 단순보다 — 여기 하중은 연직뿐이라 핀과 롤러를 나눌 이유가
     없고, 그림에서만 왼쪽을 핀으로 그린다(정정 보를 그리는 관례). */
  var END = { free: 'Free', roller: 'Roller', fix: 'Fixed' };
  var SUPSYM = { ff: ['fix', 'fix'], cant: ['fix', 'free'], ss: ['pin', 'roller'], pf: ['fix', 'roller'] };

  function derive() {
    var a = ST.endL, b = ST.endR;
    if (a === 'fix' && b === 'fix')       return { sup: 'ff',   flip: false, label: 'Fixed – Fixed' };
    if (a === 'fix' && b === 'free')      return { sup: 'cant', flip: false, label: 'Cantilever · fixed at A' };
    if (a === 'free' && b === 'fix')      return { sup: 'cant', flip: true,  label: 'Cantilever · fixed at B' };
    if (a === 'roller' && b === 'roller') return { sup: 'ss',   flip: false, label: 'Simply supported' };
    if (a === 'fix' && b === 'roller')    return { sup: 'pf',   flip: false, label: 'Fixed at A – Pinned at B' };
    if (a === 'roller' && b === 'fix')    return { sup: 'pf',   flip: true,  label: 'Pinned at A – Fixed at B' };
    if (a === 'free' && b === 'free')     return { bad: 'both' };
    return { bad: 'single' };
  }

  /* 그림에 쓸 기호. 성립하는 조합이면 그 경우의 관례대로, 아니면 고른 그대로. */
  function endSyms(dv) {
    if (dv.bad) {
      return [ST.endL === 'fix' ? 'fix' : (ST.endL === 'roller' ? 'pin' : 'free'),
              ST.endR === 'fix' ? 'fix' : (ST.endR === 'roller' ? 'roller' : 'free')];
    }
    var p = SUPSYM[dv.sup].slice();
    return dv.flip ? p.reverse() : p;
  }

  /* 지점 미리보기 — 본 도면과 같은 선·기호로 그린다 */
  function supportPreview(symL, symR, floating, w) {
    w = w || 420;
    var s = Sheet(w), pad = padOf(w), x1 = pad, x2 = w - pad;
    var y0 = s.grow(56);
    s.line(x1, y0, x2, y0, INK, 2.6);
    drawSupport(s, x1, y0, symL, 1);
    drawSupport(s, x2, y0, symR, -1);
    s.text(x1 - 20, y0 + 4, 'A', INK, { weight: 700, size: 12 });
    s.text(x2 + 20, y0 + 4, 'B', INK, { weight: 700, size: 12 });
    if (floating) {
      // 지탱되지 않는 보 — 어느 쪽으로 무너지는지 화살표로 그대로 보여 준다
      [x1 + 34, x2 - 34].forEach(function (X) {
        s.line(X, y0 + 8, X, y0 + 24, '#b3261e', 1.4, '3 3');
        s.arrow(X, y0 + 28, 0, 1, '#b3261e', 7);
      });
    }
    s.grow(floating ? 40 : 34);
    return s.out();
  }

  /* ── 화면 ───────────────────────────────────────────────────── */
  function build(root) {
    var BE = window.BeamEngine, F = BE.Formula;

    root.innerHTML =
      '<div class="bf-root"><div class="bf-grid">' +

      '<div class="bf-col">' +

      /* 1. SUPPORT */
      '  <div class="bf-card">' +
      '    <div class="bf-hd"><span class="bf-ttl">Support</span>' +
      '      <span class="bf-cond" id="bf-cond"></span></div>' +
      '    <div class="bf-prev" id="bf-prev"></div>' +
      '    <div class="bf-ends">' +
      ['L', 'R'].map(function (e) {
        return '<div class="bf-end"><b>' + (e === 'L' ? 'A — left end' : 'B — right end') + '</b>' +
          '<span class="bf-seg bf-eseg" id="bf-seg' + e + '">' +
          ['free', 'roller', 'fix'].map(function (v) {
            return '<button type="button" data-e="' + e + '" data-v="' + v + '">' + END[v] + '</button>';
          }).join('') + '</span></div>';
      }).join('') +
      '    </div>' +
      '    <div class="bf-alert" id="bf-alert" hidden></div>' +
      '    <div class="bf-body" style="padding-top:6px">' +
      '      <div class="bf-inrow"><label><span class="var">L</span><span class="desc">Span</span></label>' +
      '        <span><input type="number" id="bf-L" step="0.1" min="0.1"><span class="bf-unit">m</span></span></div>' +
      '    </div>' +
      '  </div>' +

      /* 2. PROPERTY */
      '  <div class="bf-card">' +
      '    <div class="bf-hd"><span class="bf-ttl">Property</span></div>' +
      '    <div class="bf-body">' +
      '      <div class="bf-inrow"><label><span class="var">E</span><span class="desc">Elastic modulus</span></label>' +
      '        <span><input type="number" id="bf-E" step="1000"><span class="bf-unit">MPa</span></span></div>' +
      '      <div class="bf-inrow"><label><span class="var">Sect</span><span class="desc">Source</span></label>' +
      '        <span class="bf-seg" id="bf-srcseg">' +
      '          <button type="button" data-src="user" aria-pressed="true">User define</button>' +
      '          <button type="button" data-src="db" aria-pressed="false">Database</button>' +
      '        </span></div>' +
      '      <div class="bf-inrow" id="bf-row-kind" hidden><label><span class="var">Type</span><span class="desc">Family</span></label>' +
      '        <span><select id="bf-kind" class="bf-wide"></select></span></div>' +
      '      <div class="bf-inrow" id="bf-row-pick" hidden><label><span class="var">Size</span><span class="desc">Size list</span></label>' +
      '        <span><select id="bf-pick" class="bf-wide"></select></span></div>' +
      '      <div class="bf-inrow"><label><span class="var">I</span><span class="desc">2nd moment</span></label>' +
      '        <span><input type="number" id="bf-I" step="10"><span class="bf-unit">cm⁴</span></span></div>' +
      '      <div class="bf-inrow"><label><span class="var">S top</span><span class="desc">to top fibre</span></label>' +
      '        <span><input type="number" id="bf-stop" step="1" min="0"><span class="bf-unit">cm³</span></span></div>' +
      '      <div class="bf-inrow"><label><span class="var">S bot</span><span class="desc">to bottom fibre</span></label>' +
      '        <span><input type="number" id="bf-sbot" step="1" min="0"><span class="bf-unit">cm³</span></span></div>' +
      '    </div>' +
      '    <div class="bf-note" id="bf-secnote"></div>' +
      '  </div>' +

      /* 3. LOAD — 줄을 더하고 뺄 수 있는 목록 */
      '  <div class="bf-card">' +
      '    <div class="bf-hd"><span class="bf-ttl">Load' +
      '        <span class="bf-units">w kN/m &nbsp;·&nbsp; P kN &nbsp;·&nbsp; a, b m</span></span>' +
      '      <span style="display:flex;gap:6px;align-items:center">' +
      '        <span class="bf-cond" id="bf-lcount"></span>' +
      '        <button type="button" class="bf-vbtn" id="bf-ladd" title="Add a load">+ Add</button>' +
      '      </span></div>' +
      '    <div class="bf-body" style="padding:12px 14px"><table class="bf-ltbl" id="bf-ltbl"></table></div>' +
      '    <div class="bf-alert" id="bf-lerr" hidden></div>' +
      '    <div class="bf-note">' +
      '      <b>a</b> is measured from the left end (A), whichever end is fixed. ' +
      '      <b>b</b> is the loaded length of a UDL. Loads act downward.</div>' +
      '  </div>' +
      '</div>' +

      '<div class="bf-col">' +
      '  <div class="bf-card">' +
      '    <div class="bf-hd"><span class="bf-ttl" id="bf-title">Beam Diagram</span>' +
      '      <span style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
      '        <select id="bf-lsel" class="bf-lsel"></select>' +
      '      <span id="bf-viewbar" style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">' +
      '        <button type="button" class="bf-vbtn" data-view="all" aria-pressed="true">All</button>' +
      '        <button type="button" class="bf-vbtn" data-view="load" aria-pressed="false">Load</button>' +
      '        <button type="button" class="bf-vbtn" data-view="shear" aria-pressed="false">SFD</button>' +
      '        <button type="button" class="bf-vbtn" data-view="moment" aria-pressed="false">BMD</button>' +
      '        <button type="button" class="bf-vbtn" data-view="defl" aria-pressed="false">δ</button>' +
      '      </span></span></div>' +
      '    <div class="bf-plot" id="bf-plot"></div>' +
      '  </div>' +
      '</div>' +

      '<div class="bf-col">' +
      '  <div class="bf-card">' +
      '    <div class="bf-hd"><span class="bf-ttl">Summary</span></div>' +
      '    <div class="bf-stats" id="bf-stats"></div>' +
      '  </div>' +
      '  <div class="bf-card" id="bf-fcard">' +
      '    <div class="bf-hd"><span class="bf-ttl" id="bf-fttl">Design Formulas</span></div>' +
      '    <table class="bf-tbl" id="bf-formula"></table>' +
      '    <div class="bf-note" id="bf-fnote"></div>' +
      '  </div>' +
      '  <div class="bf-card" id="bf-atcard">' +
      '    <div class="bf-hd"><span class="bf-ttl">Value at x</span>' +
      '      <span class="bf-cond" id="bf-atspan"></span></div>' +
      '    <div class="bf-body" style="padding:10px 14px">' +
      '      <div class="bf-inrow"><label><span class="var">x</span>' +
      '        <span class="desc">distance from A</span></label>' +
      '        <span><input type="number" id="bf-atx" step="0.1" min="0"><span class="bf-unit">m</span></span></div>' +
      '    </div>' +
      '    <table class="bf-tbl" id="bf-attbl"></table>' +
      '    <div class="bf-note">Click anywhere on the diagrams to bring that position here.</div>' +
      '  </div>' +
      '</div>' +

      '</div></div>';

    q(root, '#bf-kind').innerHTML = Object.keys(SECT).map(function (k) {
      return '<option value="' + k + '">' + esc(SECT[k].label) + '</option>';
    }).join('');
    ['L', 'E', 'I', 'stop', 'sbot'].forEach(function (f) { q(root, '#bf-' + f).value = ST[f]; });

    ['L', 'R'].forEach(function (e) {
      q(root, '#bf-seg' + e).addEventListener('click', function (ev) {
        var b = ev.target.closest('button'); if (!b) return;
        ST['end' + b.dataset.e] = b.dataset.v; render(root);
      });
    });
    q(root, '#bf-viewbar').addEventListener('click', function (e) {
      var b = e.target.closest('.bf-vbtn'); if (!b) return;
      ST.view = b.dataset.view; render(root);
    });
    q(root, '#bf-lsel').addEventListener('change', function () { ST.showLoad = this.value; render(root); });
    q(root, '#bf-srcseg').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      ST.src = b.dataset.src;
      // 직접 입력으로 돌아가면 표에서 온 단면계수는 더 이상 그 값이 아니다
      if (ST.src === 'db') pickKind(root); else { ST.info = ''; render(root); }
    });
    q(root, '#bf-kind').addEventListener('change', function () { ST.kind = this.value; pickKind(root); });
    q(root, '#bf-pick').addEventListener('change', function () { applyPick(root, this.value); });
    ['L', 'E', 'I', 'stop', 'sbot'].forEach(function (f) {
      q(root, '#bf-' + f).addEventListener('input', function () {
        var v = parseFloat(this.value);
        ST[f] = isFinite(v) ? v : ((f === 'stop' || f === 'sbot') ? 0 : ST[f]);
        if (f === 'stop' || f === 'sbot') ST.src = 'user';    // 손으로 고치면 표의 값이 아니다
        render(root);
      });
    });

    /* 하중 목록 — 줄을 더하고 빼는 것만 표를 다시 그린다. 값 타이핑에도 다시
       그리면 커서가 튄다. */
    q(root, '#bf-ladd').addEventListener('click', function () {
      if (ST.loads.length >= MAXLOAD) return;
      var last = ST.loads[ST.loads.length - 1];
      ST.loads.push(last && last.type === 'P'
        ? { type: 'P', v: 50, a: +(ST.L / 2).toFixed(3) }
        : { type: 'P', v: 50, a: +(ST.L / 2).toFixed(3) });
      renderLoads(root); render(root);
    });
    q(root, '#bf-ltbl').addEventListener('click', function (e) {
      var b = e.target.closest('.bf-del'); if (!b) return;
      if (ST.loads.length <= 1) return;              // 하나는 남긴다 — 하중 없는 보는 볼 것이 없다
      ST.loads.splice(+b.dataset.k, 1);
      ST.showLoad = 'all';
      renderLoads(root); render(root);
    });
    q(root, '#bf-ltbl').addEventListener('change', function (e) {
      var sel = e.target.closest('select[data-f="type"]'); if (!sel) return;
      var ld = ST.loads[+sel.dataset.k];
      ld.type = sel.value;
      if (ld.type === 'w' && !(ld.b > 0)) ld.b = +(Math.max(ST.L - (ld.a || 0), 0.1)).toFixed(3);
      renderLoads(root); render(root);
    });
    q(root, '#bf-ltbl').addEventListener('input', function (e) {
      var inp = e.target.closest('input[data-f]'); if (!inp) return;
      ST.loads[+inp.dataset.k][inp.dataset.f] = parseFloat(inp.value);
      render(root);
    });

    q(root, '#bf-atx').addEventListener('input', function () {
      var v = parseFloat(this.value);
      if (isFinite(v)) { ST.atX = v; render(root); }
    });

    var plot = q(root, '#bf-plot');
    plot.addEventListener('mousemove', cursorMove);
    plot.addEventListener('mouseleave', cursorHide);
    // 그래프를 짚으면 그 자리가 아래 칸으로 들어온다 — 눈으로 찾은 자리를
    // 손으로 다시 옮겨 적지 않아도 되게.
    plot.addEventListener('click', function (ev) {
      var x = cursorX(ev);
      if (x == null) return;
      ST.atX = Math.round(x * 1000) / 1000;
      render(root);
    });
    // 열 폭이 바뀌면 도면 좌표폭도 따라가야 한다 (글자 크기를 지키려고 폭을 잰다)
    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { if (document.body.contains(root)) render(root); }, 160);
    });

    renderLoads(root);
    render(root);
  }

  var MAXLOAD = 10;
  var LTYPE = { w: ['UDL', 'kN/m'], P: ['Point', 'kN'] };

  function loadLabel(ld, k) {
    return (k + 1) + '. ' + (ld.type === 'w'
      ? 'UDL ' + num(ld.v, 1) + ' kN/m  ' + num(ld.a, 2) + '–' + num((+ld.a || 0) + (+ld.b || 0), 2) + ' m'
      : 'Point ' + num(ld.v, 1) + ' kN @ ' + num(ld.a, 2) + ' m');
  }

  /* 하중표를 다시 그린다 (줄 추가·삭제·종류 변경 때만) */
  function renderLoads(root) {
    var h = '<thead><tr><th style="text-align:center">#</th><th>Type</th><th style="text-align:right">w / P</th>' +
            '<th style="text-align:right">a</th><th style="text-align:right">b</th><th></th></tr></thead><tbody>';
    ST.loads.forEach(function (ld, k) {
      var isW = ld.type === 'w';
      h += '<tr><td class="no">' + (k + 1) + '</td>' +
        '<td style="width:76px"><select data-k="' + k + '" data-f="type">' +
           '<option value="w"' + (isW ? ' selected' : '') + '>UDL</option>' +
           '<option value="P"' + (isW ? '' : ' selected') + '>Point</option></select></td>' +
        '<td style="min-width:66px"><input type="number" step="0.5" data-k="' + k + '" data-f="v" value="' + (ld.v == null ? '' : ld.v) + '"></td>' +
        '<td style="width:62px"><input type="number" step="0.1" data-k="' + k + '" data-f="a" value="' + (ld.a == null ? '' : ld.a) + '"></td>' +
        '<td style="width:62px">' + (isW
           ? '<input type="number" step="0.1" data-k="' + k + '" data-f="b" value="' + (ld.b == null ? '' : ld.b) + '">'
           : '<span class="dash" style="display:block;text-align:center">—</span>') + '</td>' +
        '<td style="width:26px"><button type="button" class="bf-del" data-k="' + k + '"' +
           (ST.loads.length <= 1 ? ' disabled' : '') + ' title="Remove">−</button></td></tr>';
    });
    q(root, '#bf-ltbl').innerHTML = h + '</tbody>';
    q(root, '#bf-ladd').disabled = ST.loads.length >= MAXLOAD;
    q(root, '#bf-lcount').textContent = ST.loads.length + (ST.loads.length > 1 ? ' loads' : ' load');
  }

  function syncSrc(root) {
    Array.prototype.forEach.call(q(root, '#bf-srcseg').children, function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.src === ST.src));
    });
    q(root, '#bf-row-kind').hidden = (ST.src !== 'db');
    q(root, '#bf-row-pick').hidden = (ST.src !== 'db');
    // Database 로 고른 I 는 표의 값이다. 손으로 고치고 싶으면 User define 으로
    // 돌아가면 되고, 그때 값은 그대로 남는다 — 고른 단면에서 출발해 다듬는 흐름.
    q(root, '#bf-I').readOnly = (ST.src === 'db');
    q(root, '#bf-stop').readOnly = (ST.src === 'db');
    q(root, '#bf-sbot').readOnly = (ST.src === 'db');
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
    // 보이는 값과 계산에 들어가는 값을 같게 둔다
    ST.pick = name; ST.src = 'db';
    ST.I = (r.ix >= 1000) ? Math.round(r.ix) : sig(r.ix, 4);
    ST.stop = sig(r.stop, 4); ST.sbot = sig(r.sbot, 4);
    q(root, '#bf-I').value = ST.I;
    ST.info = SECT[ST.kind].label + ' ' + r.name + ' &nbsp;·&nbsp; ' + esc(r.dim) +
      ' &nbsp;·&nbsp; A = ' + num(r.area, 2) + ' cm² &nbsp;·&nbsp; ' + num(r.wt, 1) + ' kg/m' +
      ' &nbsp;·&nbsp; y<sub>top</sub> ' + num(r.ytop, 1) + ' / y<sub>bot</sub> ' + num(r.ybot, 1) + ' mm' +
      (r.calc ? ' &nbsp;·&nbsp; <b>Ix computed from the listed dimensions</b>' : '');
    render(root);
  }

  /* ── 그리기 + 계산 ─────────────────────────────────────────── */
  function render(root) {
    var BE = window.BeamEngine, F = BE.Formula;
    var dv = derive();

    // 단면 입력부는 늘 ST.src 를 따라간다. 예전에는 경로마다 syncSrc 를 불렀는데,
    // Database → User define 로 돌아오는 길에서만 빠져 있어서 I 칸이 읽기전용으로
    // 잠긴 채 남았다 — 겉보기엔 전환됐는데 값을 못 고치는 상태. 여기 한 줄로 막는다.
    syncSrc(root);

    /* 지점 카드 */
    ['L', 'R'].forEach(function (e) {
      Array.prototype.forEach.call(q(root, '#bf-seg' + e).children, function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.v === ST['end' + e]));
      });
    });
    var sym = endSyms(dv);
    q(root, '#bf-prev').innerHTML = supportPreview(sym[0], sym[1], !!dv.bad, plotWidth(root, '#bf-prev'));
    q(root, '#bf-cond').textContent = dv.bad ? 'Not a structure' : dv.label;
    q(root, '#bf-cond').className = 'bf-cond' + (dv.bad ? ' bad' : '');

    var alert = q(root, '#bf-alert');
    alert.hidden = !dv.bad;
    if (dv.bad) {
      alert.innerHTML = (dv.bad === 'both')
        ? '<b>Both ends free.</b> The beam is unsupported — no reaction to carry the load and no unique ' +
          'deflected shape. Support both ends, or fix one.'
        : '<b>One simple support only.</b> The beam is free to rotate about it — a mechanism, not a ' +
          'structure. Make that end <b>Fixed</b>, or support the other end too.';
      q(root, '#bf-title').textContent = 'Beam Diagram';
      q(root, '#bf-stats').innerHTML = '';
      q(root, '#bf-plot').innerHTML = '<div class="bf-err">No solution: the beam is not supported.</div>';
      q(root, '#bf-fcard').hidden = true;
      q(root, '#bf-atcard').hidden = true;
      CUR = null;
      return;
    }
    q(root, '#bf-fcard').hidden = false;

    Array.prototype.forEach.call(q(root, '#bf-viewbar').children, function (bb) {
      bb.setAttribute('aria-pressed', String(bb.dataset.view === ST.view));
    });

    /* 단면 */
    ['stop', 'sbot'].forEach(function (f) {
      var el = q(root, '#bf-' + f);
      if (document.activeElement !== el) el.value = ST[f] || 0;
    });
    q(root, '#bf-secnote').innerHTML = ST.info ||
      'Enter I and S directly, or switch to <b>Database</b> to pick an H-Section, Channel, ' +
      'Square Tube or Pipe. Leave S at 0 and the stresses read 0 — nothing is divided.';

    /* 결과창의 하중 선택. 중첩이므로 한 줄만 떼어 그 하중의 기여를 볼 수 있다.
       하나만 남으면 표준 경우로 잡혀 교과서 식까지 함께 나온다. */
    var one = (ST.showLoad !== 'all') ? +ST.showLoad : -1;
    if (one >= ST.loads.length) { one = -1; ST.showLoad = 'all'; }
    var sel = q(root, '#bf-lsel');
    sel.innerHTML = '<option value="all">All loads (' + ST.loads.length + ')</option>' +
      ST.loads.map(function (ld, k) {
        return '<option value="' + k + '">' + esc(loadLabel(ld, k)) + '</option>';
      }).join('');
    sel.value = ST.showLoad;
    sel.className = 'bf-lsel' + (one >= 0 ? ' one' : '');

    /* 계산 */
    var EI = ST.E * (ST.I * 1e4) * 1e-9;                 // MPa · mm⁴ → kN·m²
    var use = (one >= 0) ? [ST.loads[one]] : ST.loads;
    var loads = use.map(function (ld) {
      return ld.type === 'w' ? { type: 'w', w: ld.v, a: ld.a, b: ld.b } : { type: 'P', P: ld.v, a: ld.a };
    });
    var r, lerr = q(root, '#bf-lerr');
    try { r = F.solveLoads({ sup: dv.sup, flip: dv.flip, L: ST.L, EI: EI, loads: loads }); }
    catch (e) {
      lerr.hidden = false;
      lerr.innerHTML = '<b>Load input.</b> ' + esc(e.message);
      q(root, '#bf-plot').innerHTML = '<div class="bf-err">' + esc(e.message) + '</div>';
      q(root, '#bf-stats').innerHTML = '';
      q(root, '#bf-fcard').hidden = true;
      return;
    }
    lerr.hidden = true;
    q(root, '#bf-fcard').hidden = false;
    q(root, '#bf-atcard').hidden = false;
    var d = r.diag, L = ST.L;
    var c = r.matched ? F.get(r.matched) : null;

    q(root, '#bf-title').textContent = dv.label + ' — ' +
      (one >= 0 ? 'load ' + (one + 1) + ' only'
                : (c ? c.load : ST.loads.length + (ST.loads.length > 1 ? ' loads' : ' load')));

    /* 요약 */
    var dmax = Math.abs(d.yx.abs.v), ratio = dmax > 1e-12 ? L / dmax : Infinity;
    var isCant = (dv.sup === 'cant');
    q(root, '#bf-stats').innerHTML = [
      { k: isCant ? 'R fix' : 'R left', v: num(isCant && dv.flip ? d.Vj : d.Vi, 2), s: 'kN', c: SFD },
      { k: isCant ? 'M fix' : 'R right', v: isCant ? num(Math.abs(dv.flip ? r.Mj : r.Mi), 2) : num(d.Vj, 2),
        s: isCant ? 'kN·m' : 'kN', c: SFD },
      { k: 'M max', v: num(Math.abs(d.Mx.abs.v), 2), s: 'kN·m  @ ' + num(d.Mx.abs.x, 2) + ' m', c: BMD },
      { k: 'δ max', v: num(dmax * 1000, 2), s: 'mm  @ ' + num(d.yx.abs.x, 2) + ' m', c: DEF },
      { k: 'δ / L', v: '1/' + num(ratio, 0), s: 'span ratio', c: DEF },
      { k: 'EI', v: (EI >= 1e4 ? num(EI / 1000, 1) + 'e3' : num(EI, 1)), s: 'kN·m²', c: INK },
      // σ 는 S 가 일정하므로 |M| 이 가장 큰 자리에서 가장 크다
      { k: 'σ max', v: num(Math.max(Math.abs(stressTop(d.Mx.abs.v, ST.stop)),
                                    Math.abs(stressBot(d.Mx.abs.v, ST.sbot))), 1),
        s: 'MPa  @ ' + num(d.Mx.abs.x, 2) + ' m', c: BMD }
    ].map(function (o) {
      return '<div class="bf-stat"><div class="k">' + esc(o.k) + '</div><div class="v" style="color:' + o.c + '">' +
        o.v + '</div><div class="s">' + esc(o.s) + '</div></div>';
    }).join('');
    // 마지막 줄의 빈 칸이 회색으로 남지 않게 채운다 (열 수는 폭에 따라 달라진다)
    (function () {
      var el = q(root, '#bf-stats');
      var cols = (getComputedStyle(el).gridTemplateColumns || '').split(' ').filter(Boolean).length || 1;
      var n = el.children.length, need = (cols - (n % cols)) % cols;
      for (var i = 0; i < need; i++) el.insertAdjacentHTML('beforeend', '<div class="bf-stat"></div>');
    }());

    /* 조회 위치 — 손대기 전에는 L/2 */
    var ax = (ST.atX == null) ? L / 2 : Math.min(Math.max(ST.atX, 0), L);
    var axIn = q(root, '#bf-atx');
    axIn.max = L;
    if (document.activeElement !== axIn) axIn.value = +ax.toFixed(3);
    q(root, '#bf-atspan').textContent = '0 – ' + num(L, 2) + ' m';

    var atM = valueAt(d.x, d.M, ax), atV = valueAt(d.x, d.S, ax);
    var atY = valueAt(d.x, d.y, ax), atT = valueAt(d.x, d.theta, ax);
    q(root, '#bf-attbl').innerHTML =
      '<thead><tr><th>Quantity</th><th>Value</th><th>Unit</th><th></th></tr></thead><tbody>' +
      [['M', num(atM, 2), 'kN·m', atM > 0 ? 'sagging' : (atM < 0 ? 'hogging' : '')],
       ['V', num(atV, 2), 'kN', ''],
       ['δ', (atY < 0 ? '↓ ' : (atY > 0 ? '↑ ' : '')) + num(Math.abs(atY) * 1000, 3), 'mm', ''],
       ['θ', num(atT, 6), 'rad', num(atT * 180 / Math.PI, 4) + '°'],
       ['σ top', num(stressTop(atM, ST.stop), 2), 'MPa', sgnTag(stressTop(atM, ST.stop))],
       ['σ bot', num(stressBot(atM, ST.sbot), 2), 'MPa', sgnTag(stressBot(atM, ST.sbot))]
      ].map(function (o) {
        return '<tr><td class="k">' + esc(o[0]) + '</td><td>' + o[1] + '</td><td class="at">' +
          esc(o[2]) + '</td><td class="at">' + esc(o[3]) + '</td></tr>';
      }).join('') + '</tbody>';

    /* 도면 */
    var w = plotWidth(root, '#bf-plot'), pad = padOf(w), SX = SXf(w, pad), s = Sheet(w);
    var show = ST.view, probes = [];
    function want(k) { return show === 'all' || show === k; }

    if (want('load')) {
      var y0 = s.grow(Math.max(112, loadHeadroom(r.loads.length)));
      s.line(SX(0, L), y0, SX(L, L), y0, INK, 2.4);
      drawLoads(s, r.loads, L, SX, y0);
      drawSupport(s, SX(0, L), y0, r.supports[0], 1);
      drawSupport(s, SX(L, L), y0, r.supports[1], -1);
      s.text(SX(0, L) - 16, y0 + 4, 'A', INK, { weight: 700, size: 12 });
      s.text(SX(L, L) + 16, y0 + 4, 'B', INK, { weight: 700, size: 12 });
      drawDim(s, SX(0, L), SX(L, L), y0 + 48, 'L = ' + num(L, 2) + ' m');
      s.grow(66);
    }
    [['shear', d.S, SFD, 'SFD', 'kN', 1, false, false],
     ['moment', d.M, BMD, 'BMD', 'kN·m', 1, true, false],
     ['defl', d.y.map(function (v) { return v * 1000; }), DEF, 'δ', 'mm', 2, false, true]
    ].forEach(function (cf) {
      if (!want(cf[0])) return;
      s.grow(18);
      var yy = s.grow(52);
      probes.push(drawCurve(s, { x: d.x, v: cf[1], col: cf[2], tag: cf[3], unit: cf[4], dp: cf[5],
                     flip: cf[6], absv: cf[7], y0: yy, amp: 46, SX: SX, L: L, pad: pad }));
      s.grow(74);          // 진폭 46 + 라벨 — 마지막 판이 잘리지 않게
    });
    /* 조회 위치 표식 — 아래 칸이 읽고 있는 자리를 도면에도 같이 찍는다 */
    if (probes.length && ax >= 0 && ax <= L) {
      s.grow(15);                       // 표식 글자가 놓일 자리
      var pxa = SX(ax, L);
      s.line(pxa, 8, pxa, s.h - 17, DIM, 1, '5 4');
      probes.forEach(function (pr) {
        var vv = valueAt(pr.x, pr.v, ax);
        s.dot(pxa, pr.y0 + pr.sgn * pr.amp * (vv / pr.mx), 3.2, pr.col);
      });
      s.text(Math.min(Math.max(pxa, 30), w - 30), s.h - 6, 'x = ' + num(ax, 3), DIM, { size: 10, halo: 1 });
    }
    if (s.h < 40) s.grow(80);
    s.raw(cursorLayer(probes, s.h));
    q(root, '#bf-plot').innerHTML = s.out();
    CUR = { w: w, pad: pad, L: L, probes: probes, root: root };

    /* 표준 경우와 딱 맞으면 그 경우의 교과서 식을, 아니면 계산 결과를 낸다.
       맞지도 않는 식을 띄우는 것보다 무엇으로 풀었는지 적는 편이 낫다. */
    var rowsHtml, note;
    if (c) {
      q(root, '#bf-fttl').textContent = 'Design Formulas';
      rowsHtml = r.closed.map(function (o) {
        var unit = o.kind === 'δ' ? 'mm' : (o.kind === 'θ' ? 'rad' : (o.kind === 'R' ? 'kN' : 'kN·m'));
        var val = o.kind === 'δ' ? num(o.value * 1000, 3) : num(o.value, o.kind === 'θ' ? 5 : 2);
        return '<tr><td class="k">' + esc(o.k) + '</td><td class="tex">' + esc(o.tex) + '</td><td>' +
          val + ' ' + unit + '</td><td class="at">' + esc(o.at || '') + '</td></tr>';
      }).join('');
      q(root, '#bf-formula').innerHTML =
        '<thead><tr><th>Quantity</th><th>Formula</th><th>Value</th><th>At</th></tr></thead><tbody>' +
        rowsHtml + '</tbody>';
      var fromFix = (dv.sup === 'cant' || dv.sup === 'pf');
      note = (c.note ? '<b>' + esc(c.note) + '</b> ' : '') + (fromFix
        ? 'x is measured from the fixed end, so the table reads the same whichever side is fixed.'
        : 'x is measured from support A.');
    } else {
      q(root, '#bf-fttl').textContent = 'Results';
      var rowsList = [
        ['R left', num(d.Vi, 2), 'kN', 'A'],
        ['R right', num(d.Vj, 2), 'kN', 'B'],
        ['M A end', num(-r.Mi, 2), 'kN·m', r.Mi > 0 ? 'hogging' : (r.Mi < 0 ? 'sagging' : '')],
        ['M B end', num(r.Mj, 2), 'kN·m', r.Mj < 0 ? 'hogging' : (r.Mj > 0 ? 'sagging' : '')],
        ['M max ⁺', num(d.Mx.max.v, 2), 'kN·m', 'x = ' + num(d.Mx.max.x, 3) + ' m'],
        ['M max ⁻', num(d.Mx.min.v, 2), 'kN·m', 'x = ' + num(d.Mx.min.x, 3) + ' m'],
        ['V max', num(d.Sx.abs.v, 2), 'kN', 'x = ' + num(d.Sx.abs.x, 3) + ' m'],
        ['δ max', num(-d.yx.abs.v * 1000, 3), 'mm', 'x = ' + num(d.yx.abs.x, 3) + ' m'],
        ['θ A', num(d.thetaI, 5), 'rad', ''],
        ['θ B', num(d.thetaJ, 5), 'rad', ''],
        ['σ top', num(stressTop(d.Mx.abs.v, ST.stop), 2), 'MPa', 'at M max, x = ' + num(d.Mx.abs.x, 3) + ' m'],
        ['σ bot', num(stressBot(d.Mx.abs.v, ST.sbot), 2), 'MPa', 'at M max, x = ' + num(d.Mx.abs.x, 3) + ' m']
      ];
      q(root, '#bf-formula').innerHTML =
        '<thead><tr><th>Quantity</th><th>Value</th><th>Unit</th><th>At</th></tr></thead><tbody>' +
        rowsList.map(function (o) {
          return '<tr><td class="k">' + esc(o[0]) + '</td><td>' + o[1] + '</td><td class="at">' +
            esc(o[2]) + '</td><td class="at">' + esc(o[3]) + '</td></tr>';
        }).join('') + '</tbody>';
      note = 'This load set is not one of the standard cases, so there is no single textbook formula. ' +
        'End moments come from the fixed-end moment integrals, the rest from statics and ∬M/EI — ' +
        'the same path the standard cases take.';
    }
    var pick = (one >= 0 && ST.loads.length > 1)
      ? '<b>Showing load ' + (one + 1) + ' only</b> — this is that load\u2019s own contribution, not the total. ' +
        'Pick <b>All loads</b> to see them combined. '
      : '';
    q(root, '#bf-fnote').innerHTML = pick + note +
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
    sc.src = BASE + 'beam_engine.js?v=1';       // 운영은 고정 버전
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
    module.exports = { roundRect: roundRect, tubeProps: tubeProps, parseCsv: parseCsv,
                       SECT: SECT, sectionRow: sectionRow };
  }
}());
