/* beam_multi_test.js — MacroBEAM · MultiBEAM (TEST build)

   연속보를 푼다. 경간 1 ~ 5, 지점은 절점마다 Free / Roller / Fixed 이고,
   경간마다 길이 · 재료 · 단면 · 하중을 따로 준다. 하중도 · SFD · BMD · 처짐도를
   전 지간 하나로 그리고, 임의 위치의 값을 읽는다.

   입력은 경간이 단위다. 한 기둥 안에 그 경간의 L · E · I · S 가 차례로 들어가고,
   지점은 기둥과 기둥 사이 — 실제로 지점이 서는 자리 — 에 놓인다.

   계산은 전부 beam_engine.js 의 Cross(모멘트분배법)가 한다. 경간 곡선도 엔진이
   만든 것(solve().spans)을 그대로 받아 부호만 뒤집는다. 여기서 spanDiagram 을
   다시 부르면 절점이 제자리에 있다는 가정이 붙어서, 지점 없는 절점(안쪽 Free)과
   자유단(내민보 · 캔틸레버)의 처짐이 통째로 틀린다.

   안쪽 절점을 Free 로 둘 수 있다. 그 자리에 지점이 없을 뿐 보는 이어져 있고,
   절점이 회전하면서 아래로 내려앉는다 — 엔진의 측방변위 풀이가 그 자유도를
   맡는다. 8+6+8 에서 B 를 Free 로 두면 14+8 2경간과 반력 · 처짐이 같다.

   단면은 SimpleBEAM 과 같은 DB 를 쓴다 — H형강 · 채널 · 각형강관 · 파이프.
   스타일도 같은 벌이다(.bf-* 규칙이 두 파일에서 같다). 다만 <style> 의 id 는
   달라야 한다: 같으면 먼저 뜬 쪽이 심어 놓은 것을 보고 나중 쪽이 건너뛰어,
   이 파일에만 있는 .cb-* 규칙이 통째로 빠진다.

   검사: tools/check_beam_multi.js — 단순보 · 양단고정 · 2 ~ 5경간 · 부등경간 ·
   집중하중 · 캔틸레버 · 내민보 · 자유절점 등가성까지 36항목.

   진입점: fbeam_multi(mountId). layout_body_test.js 가 필요할 때 로드한다.  */
(function () {
  'use strict';

  /* Pages 배포가 08-28 00:14 UTC 에 되살아났다 — 이 파일은 처음부터 제 주소를 본다. */
  var DESIGN = 'https://macrobim.github.io/design/';
  var BASE   = 'https://macrobim.github.io/macroBIM/';

  /* 도면 색 — 저장소의 단면 도면과 같은 벌 */
  var INK = '#182430', DIM = '#2563eb', HID = '#94a3b8';
  var SFD = '#1d4ed8', BMD = '#b3261e', DEF = '#0f766e';

  /* ── 스타일 : hsection 도면 카드와 같은 어휘 ────────────────────── */
  var CSS_ID = 'cb-style';   // SimpleBEAM 과 달라야 한다 — 머리주석 참고
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
    /* 행마다 그리드가 따로라, 단위 글자폭이 다르면 입력 상자의 좌우가 행끼리
       어긋난다. 최소 폭을 줘서 자리를 고르고, select 뒤에는 빈 단위칸을 둔다 —
       그래야 상자의 왼쪽 끝과 오른쪽 끝이 위아래로 한 줄에 선다. */
    '.bf-unit{color:var(--muted);font-size:11px;margin-left:6px;display:inline-block;min-width:24px}',
    /* select 은 뒤에 단위가 붙지 않는다. 100% 로 두면 입력칸이 아니라 단위칸까지
       먹어서 저 혼자 오른쪽으로 튀어나가고, 이름이 짧으면 그만큼이 빈칸으로 남는다.
       입력칸과 같은 폭으로 두어 상자의 오른쪽 끝을 맞춘다. */
    '.bf-wide{text-align:left!important}',
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
    '.bf-err{padding:12px 16px;color:#b91c1c;font-size:12.5px;font-family:ui-monospace,Menlo,Consolas,monospace}',

    /* ── 연속보 : 입력이 보의 모양을 따른다 ─────────────────────────
       경간이 기둥 하나씩 서고, 지점은 기둥과 기둥 사이에 선다. 기둥 폭은
       모두 같게 둔다 — 짧은 경간이 좁아져 읽기 어려워지는 것보다, 입력이
       고르게 놓이는 편이 낫다. 실제 경간장 비율은 아래 도면이 보여 준다. */
    '.cb-stack{display:flex;flex-direction:column;gap:18px}',
    '.cb-headbits{display:flex;align-items:center;gap:14px}',
    '.cb-maxnote{font-size:11px;color:var(--muted);font-family:ui-monospace,Menlo,Consolas,monospace}',
    '.cb-model{padding:0 0 2px}',
    '.cb-supstrip{position:relative;height:98px;margin:0 18px}',
    '.cb-beamline{position:absolute;left:0;right:0;bottom:25px;height:3px;background:var(--ink);border-radius:2px}',
    '.cb-supg{position:absolute;bottom:0;transform:translateX(-50%);line-height:0}',
    // 30 높이 상자의 한가운데(=bottom 12+15=27)가 보선 위에 오게
    '.cb-supg-fix{bottom:12px}',
    '.cb-sup{position:absolute;bottom:48px;text-align:center;white-space:nowrap}',
    '.cb-supname{font-size:11px;font-weight:700;color:var(--ink);margin-bottom:3px;',
      'font-family:ui-monospace,Menlo,Consolas,monospace}',
    '.cb-sup .bf-seg button{padding:3px 7px;font-size:10.5px}',
    '.cb-cols{display:grid;border-top:1px solid var(--line)}',
    '.cb-col{padding:12px 14px 14px;border-right:1px dashed var(--hair);display:flex;flex-direction:column;gap:7px}',
    '.cb-col:last-child{border-right:0}',
    '.cb-colhead{display:flex;justify-content:space-between;align-items:center;font-size:12.5px;font-weight:700;color:var(--ink)}',
    '.cb-colhead::before{content:"";display:inline-block;width:3px;height:13px;border-radius:2px;background:var(--dim);',
      'margin-right:7px;flex-shrink:0}',
    '.cb-colhead>b{margin-right:auto}',
    '.cb-colhead span{font-size:10.5px;font-weight:400;color:var(--muted);font-family:ui-monospace,Menlo,Consolas,monospace}',
    '.cb-sub{display:flex;justify-content:space-between;align-items:center;margin-top:5px;padding-top:7px;',
      'border-top:1px dashed var(--hair);font-size:10.5px;font-weight:700;letter-spacing:.05em;color:var(--muted)}',
    '.cb-sub button{border:1px solid var(--line);background:var(--panel);color:var(--dim);border-radius:6px;',
      'padding:1px 7px;font-size:10.5px;cursor:pointer;font-family:inherit}',
    '.cb-sub button:hover{border-color:var(--dim)}',
    '.cb-f{display:grid;grid-template-columns:46px minmax(0,1fr) 26px;gap:6px;align-items:center;font-size:12px}',
    '.cb-f>label{color:var(--dim);font-weight:600;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11.5px}',
    '.cb-f input,.cb-f select{width:100%;text-align:right;padding:4px 7px;border:1px solid var(--line);',
      'border-radius:6px;background:var(--panel);color:var(--ink);font-size:12.5px;',
      'font-family:ui-monospace,Menlo,Consolas,monospace}',
    '.cb-f select{text-align:left}',
    '.cb-f input[readonly]{background:#f8fafc;color:var(--muted)}',
    '.cb-f input:focus,.cb-f select:focus{outline:2px solid var(--dim);outline-offset:1px;border-color:var(--dim)}',
    '.cb-f .bf-unit{margin-left:0;font-size:10px}',
    '.cb-srcseg{justify-self:start}',
    '.cb-srcseg button{padding:3px 20px;font-size:10.5px}',
    '.cb-secnote{font-size:10.5px;color:var(--muted);line-height:1.5;',
      'font-family:ui-monospace,Menlo,Consolas,monospace}',
    '.cb-ltbl th{font-size:9.5px;text-align:center}',
    '.cb-ltbl thead tr:first-child th:first-child,.cb-ltbl thead tr:first-child th:nth-child(2){text-align:left}',
    /* 단위는 대문자로 세우지 않는다 — kN/m 은 KN/M 이 아니다 */
    '.cb-ltbl th i{text-transform:none;letter-spacing:0;font-style:normal;margin-left:4px;font-weight:400}',
    '.cb-ltbl td{padding:2px 3px}',
    '.cb-ltbl input,.cb-ltbl select{font-size:12px;padding:3px 5px}',
    '.cb-noload{font-size:11px;color:var(--muted);font-style:italic;padding:2px 0}',
    /* 나란히 선 두 카드는 키를 맞춘다 — 한 쪽만 길면 줄이 어긋나 보인다.
       카드 안에서는 표·타일이 위에 붙고 남는 자리는 아래로 간다. */
    '.cb-out{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;align-items:stretch}',
    '.cb-out>.bf-card{display:flex;flex-direction:column}',
    '.cb-out>.bf-card>.bf-body,.cb-out>.bf-card>.cb-at{flex:1 1 auto}',
    '@media(max-width:1100px){.cb-out{grid-template-columns:1fr}}',
    '#cb-stats{grid-template-columns:repeat(3,minmax(0,1fr))}',

    /* 하중 — UDL 과 CON 을 좌우로 */
    '.cb-loadpanes{padding:8px 16px 14px}',
    '.cb-ladd{border:1px solid var(--line);background:var(--panel);color:var(--dim);',
      'border-radius:6px;padding:3px 11px;font-size:11px;cursor:pointer;font-family:inherit;font-weight:600}',
    '.cb-ladd:hover{border-color:var(--dim)}',
    /* 하중칸은 카드 폭을 고르게 나눠 쓴다 — 숫자칸이 좁아 잘리던 것 */
    '.cb-ltbl{table-layout:fixed;width:100%}',
    '.cb-ltbl input,.cb-ltbl select{font-size:13px;padding:5px 8px}',
    '.bf-stat .s2{font-size:10.5px;color:var(--muted);font-family:ui-monospace,Menlo,Consolas,monospace}',
    /* UDL 과 CON 을 세로선 하나로 가른다 — 어느 값이 어느 쪽 것인지 */
    '.cb-grp{text-align:center!important;color:var(--ink);letter-spacing:.05em}',
    '.cb-grp span{font-weight:400;color:var(--muted);text-transform:none}',
    /* 등분포와 집중을 가르는 세로선. 머리부터 마지막 줄까지 한 줄로 이어져야
       "여기까지가 UDL" 이 눈에 들어온다 — 머리에만 있으면 값을 볼 때 사라진다. */
    '.cb-grpl{border-left:2px solid var(--line)}',
    '.cb-ltbl tbody td.cb-grpl{border-left:2px solid var(--line)}',
    '.cb-no{color:var(--muted);font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px}',
    '.cb-na{color:var(--muted);text-align:center}',

    /* 임의 위치 조회 */
    '.cb-at{display:grid;grid-template-columns:minmax(0,260px) minmax(0,1fr);gap:18px;',
      'align-items:start;padding:12px 16px 14px}',
    '.cb-atin{display:flex;flex-direction:column;gap:7px}',
    '@media(max-width:820px){.cb-at{grid-template-columns:1fr}}'
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
  /* 해석해서 낸 값은 어디에 적히든 소수 셋째 자리다 — 값마다 자릿수가 다르면
     같은 표 안에서 자릿수를 세어 가며 읽어야 한다. 0 도 0.000 으로 적는다:
     자리를 비우면 열이 어긋나고, "아직 없는 값"처럼 보인다.
     입력을 되비추는 것(지간·하중 위치·단면표 값)은 그대로 둔다 — 적은 대로
     보이는 편이 맞고, 8 을 8.000 으로 되돌려 주면 고쳐 쓰기가 번거롭다. */
  var RDP = 3;
  function rnum(v) { return num(v, RDP); }
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
  /* 호칭은 표마다 적는 법이 다르다 — H형강·채널은 '350 x 175', 각관은 '125x125x3.2'.
     읽는 사람에게는 치수를 x 로 이어 붙인 한 덩어리가 단면 이름이므로, 공백을
     걷어내 '350x175' 로 맞춘 뒤 웨브·플랜지 두께를 같은 x 로 이어 붙인다.
     두께 7.0 은 7 로 적는다 — 표의 숫자 표기를 그대로 옮기면 자릿수가 들쭉날쭉해진다. */
  function xnum(v) { var n = parseFloat(v); return isFinite(n) ? String(n) : String(v == null ? '' : v); }
  function xdim(n) { return String(n).replace(/\s*[xX×]\s*/g, 'x').trim(); }

  var SECT = {
    hsection: { label: 'H-Section', file: 'hsection.csv', name: '호칭치수',
      dims: ['H', 'B', 't1', 't2'], area: '단면적', wt: '단위무게', ix: 'Ix', zx: 'Sx', ks: 'KS규격여부',
      sym: function (r) { return +r.H / 2; },
      lab: function (n, r) { return xdim(n) + 'x' + xnum(r.t1) + 'x' + xnum(r.t2); } },
    channel: { label: 'Channel', file: 'channel.csv', name: '호칭치수',
      dims: ['H', 'B', 't1', 't2'], area: '단면적', wt: '단위무게', ix: 'Ix', zx: 'Zx', ks: 'KS규격여부',
      sym: function (r) { return +r.H / 2; },
      lab: function (n, r) { return xdim(n) + 'x' + xnum(r.t1) + 'x' + xnum(r.t2); } },
    squaretube: { label: 'Square Tube', file: 'squaretube.csv', name: '호칭치수',
      dims: ['A', 'B', 't', 'r'], area: '단면적', wt: '단위무게', std: '규격',
      calc: function (r) { var p = tubeProps(+r.A, +r.B, +r.t, +r.r); return { I: p.I, A: p.A, y: +r.A / 2 }; },
      lab: function (n) { return n; } },                          // 규격(SPSR·ROLL…)은 아래 안내줄에 나온다
    pipe: { label: 'Pipe', file: 'pipe.csv', name: '호칭치수',
      dims: ['D', 't'], area: '단면적', wt: '단위무게', std: '규격', ks: 'KS규격여부',
      calc: function (r) { var D = +r.D, d = D - 2 * (+r.t);
        return { I: Math.PI * (Math.pow(D, 4) - Math.pow(d, 4)) / 64,
                 A: Math.PI * (D * D - d * d) / 4, y: D / 2 }; },
      lab: function (n) { return n; } }                           // 규격(STK)은 아래 안내줄에 나온다
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
    var label = cfg.lab ? String(cfg.lab(name, r) || name).trim() : name;
    return {
      name: name, label: label, key: '',                            // key 는 uniquify 가 채운다
      ix: ix, area: area, wt: parseFloat(r[cfg.wt]) || 0,
      dim: cfg.dims.map(function (d) { return d + ' ' + r[d]; }).join(' · '),
      std: cfg.std ? (r[cfg.std] || '') : '',
      ks: cfg.ks ? (r[cfg.ks] || '') : '',
      ytop: ytop, ybot: ybot,
      stop: ix / (ytop / 10), sbot: ix / (ybot / 10),               // cm⁴ / cm → cm³
      calc: !!cfg.calc
    };
  }

  /* 표는 호칭이 겹친다. H형강 76행이 이름은 29종뿐이고, 각관은 SPSR 과 ROLL 에
     같은 호칭이 열 쌍 있다. 두께까지 붙여도 갈리지 않는 줄이 남는다 —
     450x300x11x18 두 줄은 모서리 반지름만 다르고, 200x200x6 두 줄도 그렇다.

     그렇다고 이름에 무게나 규격을 덧붙이지는 않는다. 목록에서 읽고 싶은 것은
     치수뿐이고, 무엇이 다른지는 고른 뒤 아래 안내줄이 말해 준다(규격 · 단위무게 ·
     KS 여부). 대신 **고르는 키는 이름과 분리해** 줄 번호로 유일하게 만든다.
     그래야 같은 글자가 두 줄이어도 각자 제 값을 준다 — 이름으로 찾으면 늘 첫
     줄이 잡히던 것이 예전의 버그였다. */
  function uniquify(rows) {
    rows.forEach(function (r, i) { r.key = r.label + '#' + i; });
    return rows;
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
        var rows = uniquify(parseCsv(t).map(function (r) { return sectionRow(cfg, r); }).filter(Boolean));
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
        /* 폭을 명시하고 가운데 세운다. viewBox 만 두면 SVG 가 칸 폭까지 늘어나
           배율이 1 을 넘고, 그러면 선도 글자도 같이 커진다 — 폭을 재는 뜻이 없어진다.
           좁은 화면에서는 max-width 가 칸 폭으로 잡아 준다(그때는 줄어든다). */
        return '<svg viewBox="0 0 ' + w + ' ' + H + '" preserveAspectRatio="xMidYMid meet"' +
          ' style="display:block;width:' + w + 'px;max-width:100%;margin:0 auto;' + bg + '">' +
          e.join('') + '</svg>';
      }
    };
  }

  /* 도면의 좌표폭을 실제로 렌더되는 픽셀폭에 맞춘다. viewBox 를 고정해 두면
     열이 좁아질 때 글자까지 같이 줄어들어 읽을 수 없게 된다 — 폭을 따라가면
     글자는 늘 같은 크기로 나온다. */
  function padOf(w) { return Math.round(Math.max(38, Math.min(58, w * 0.075))); }
  function SXf(w, pad) { return function (x, L) { return pad + x / L * (w - 2 * pad); }; }
  /* 그리는 좌표폭을 실제 렌더 폭에 맞춘다 — 배율이 늘 1 이어야 글자가 도면과
     같이 커지거나 작아지지 않는다. SimpleBEAM 은 그림 열이 좁아(≈540px) 1200
     이라는 상한에 닿을 일이 없었지만, 여기는 카드가 전폭이라 1392px 에서
     상한에 걸려 도면 전체가 1.16 배로 늘어나고 있었다. 글자까지 같이 늘어나
     그림이 커 보이던 것이 이것이다. */
  function plotWidth(root, sel) {
    var el = q(root, sel);
    var w = el ? el.clientWidth : 0;
    return Math.round(Math.max(360, Math.min(2000, w || 560)));
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
  // extTo 를 주면 연장선을 그 높이까지 내린다 — 보 위쪽 치수는 어디를 잰
  // 것인지 보에 닿아야 읽힌다.
  function drawDim(s, x1, x2, y, label, extTo) {
    s.line(x1, y, x2, y, DIM, 1);
    s.arrow(x1, y, -1, 0, DIM); s.arrow(x2, y, 1, 0, DIM);
    if (extTo == null) {
      s.line(x1, y - 9, x1, y + 5, DIM, 0.6, '2 2');
      s.line(x2, y - 9, x2, y + 5, DIM, 0.6, '2 2');
    } else {
      s.line(x1, y - 5, x1, extTo, HID, 0.6, '2 3');
      s.line(x2, y - 5, x2, extTo, HID, 0.6, '2 3');
    }
    s.text((x1 + x2) / 2, y - 9, label, DIM, { halo: 1 });
  }

  /* 판의 세로 크기. 전폭 카드에서는 가로가 넉넉하므로 세로를 그만큼 쓸 이유가
     없다 — 한 화면에 하중도부터 처짐도까지 들어오는 편이 읽기 낫다.
     여기 숫자만 고치면 세 판이 함께 움직인다. */
  var PLOT = { gap: 16, band: 44, amp: 38, tail: 66, load: 96, loadStep: 11, dim: 56, mark: 13 };

  /* 하중 기호.
     하중을 여러 개 넣을 수 있게 되면서 라벨이 서로 밟는다. 자리를 잡아 주는
     작은 배치기를 둔다 — 같은 높이에 이미 글자가 있으면 한 칸 위로 올린다.
     분포하중 띠를 먼저 깔고 집중하중을 그 위에 얹어야 화살표가 묻히지 않는다. */
  var LOAD_BAND = 30;                 // 분포하중 띠의 최대 높이

  /* 하중이 어디에 있는지는 그림 맨 위에 치수로 적는다. 아래에는 전체 지간이
     있으므로, 위에는 그 안에서 어디인지만 있으면 된다.
       CON  a — 좌단에서 작용점
       UDL  a — 좌단에서 시작점,  b — 재하길이 (전지간이면 생략) */
  function loadDims(loads, L) {
    var out = [], seen = {};
    function add(x1, x2, t) {
      var k = x1.toFixed(4) + '|' + x2.toFixed(4) + '|' + t;
      if (seen[k] || x2 - x1 < 1e-9) return;
      seen[k] = 1; out.push({ x1: x1, x2: x2, t: t });
    }
    (loads || []).forEach(function (ld) {
      var o = window.BeamEngine.Load.norm(ld, L);
      if (o.a > 1e-9) add(0, o.a, 'a = ' + num(o.a, 2) + ' m');
      if (o.type === 'w' && (o.a > 1e-9 || o.b < L - 1e-9)) add(o.a, o.b, 'b = ' + num(o.b - o.a, 2) + ' m');
    });
    return out;
  }

  /* 치수를 줄에 채워 넣는다.
     하나씩 새 줄에 쌓으면 a 와 b 처럼 나란한 치수가 계단이 된다 — 같은 것을
     재는데 높이가 다르면 눈이 먼저 그 차이를 읽는다. 가로로 겹치지 않으면
     한 줄에 둔다. 겹침은 치수선뿐 아니라 글자 폭까지 보고 판단한다. */
  function packDims(dims, SX, L) {
    var rows = [];
    dims.forEach(function (d) {
      var x1 = SX(d.x1, L), x2 = SX(d.x2, L);
      var mid = (x1 + x2) / 2, half = d.t.length * 2.9 + 6;
      var lo = Math.min(x1, mid - half), hi = Math.max(x2, mid + half);
      var r = 0;
      while (rows[r] && rows[r].some(function (p) { return lo < p.hi - 0.5 && p.lo < hi - 0.5; })) r++;
      (rows[r] = rows[r] || []).push({ lo: lo, hi: hi });
      d.row = r;
    });
    return rows.length;
  }

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

  /* ── 상태 ───────────────────────────────────────────────────────
     경간 하나가 입력의 단위다. 길이 · 단면 · 하중이 한 기둥에 모여 있고,
     지점은 기둥과 기둥 사이(= 실제로 지점이 서는 자리)에 놓인다.        */
  var MAXSPAN = 5;
  var SUPKIND = [['free', 'Free'], ['roller', 'Roller'], ['fix', 'Fixed']];
  /* 하중 한 줄 = 하중경우 하나. 한 경간 위에 등분포와 집중을 따로 또는 함께
     걸 수 있다. 값이 0 이면 그 항은 걸지 않은 것으로 본다 — 0 인 하중과 없는
     하중은 결과가 같으므로, 비었는지 따로 표시할 이유가 없다. */
  function newLoad(k, L) {
    return { s: k, w: { v: 25, a: 0, b: L }, p: { v: 0, a: +(L / 2).toFixed(3) } };
  }
  function loadFits(ld, L) {                 // 경간이 바뀌면 그 안으로 들여놓는다
    var wa = +ld.w.a || 0;
    if (wa > L) { ld.w.a = 0; wa = 0; }
    ld.w.b = Math.min(+ld.w.b || 0, +(L - wa).toFixed(3));
    if (!(ld.p.a >= 0 && ld.p.a <= L)) ld.p.a = +(L / 2).toFixed(3);
    return ld;
  }

  var E0 = 205000;                    // 강재 — 새 경간의 기본값일 뿐, 경간마다 고친다

  function newSpan(L) {
    return { L: L, E: E0, I: 20400, stop: 1360, sbot: 1360,
             src: 'user', kind: 'hsection', pick: '', info: '' };
  }

  var ST = {
    spans: [newSpan(8), newSpan(6), newSpan(8)],
    sup: ['roller', 'roller', 'roller', 'roller'],
    atX: null,          // 보 왼쪽 끝에서 잰 조회 위치. null 이면 전 지간의 한가운데

    loads: [newLoad(0, 8)]
  };

  function nSpan() { return ST.spans.length; }
  /* 조회 위치는 보 전체 좌표 하나로만 들고 있는다 — 경간이 늘거나 지간이
     바뀌어도 자리가 어긋나지 않는다. 화면에 쓸 때만 경간과 국부 x 로 쪼갠다. */
  function atGlobal() {
    var T = totalL();
    var X = (ST.atX == null) ? T / 2 : ST.atX;
    return Math.min(Math.max(X, 0), T);
  }
  /* 보 전체 좌표를 (몇 번째 경간, 그 경간 왼쪽 끝에서 얼마) 로 쪼갠다.
     결과의 최대값이 "18.64 m" 라고만 하면 어느 경간인지 세어 봐야 한다. */
  function splitX(X) {
    var k = 0;
    while (k < nSpan() - 1 && X > nodeX(k + 1) + 1e-9) k++;
    return { k: k, x: X - nodeX(k) };
  }
  function atLocal() { return splitX(atGlobal()); }
  function whereTxt(X) {
    var o = splitX(X);
    return 'span ' + (o.k + 1) + ' · x ' + rnum(o.x) + ' m';
  }
  function totalL() { return ST.spans.reduce(function (a, s) { return a + s.L; }, 0); }
  function nodeX(k) { var x = 0; for (var i = 0; i < k; i++) x += ST.spans[i].L; return x; }
  function nodeName(k) { return String.fromCharCode(65 + k); }
  /* 탄성계수도 경간마다 다르다 — 강재 위에 콘크리트 경간이 얹히는 식의 모델을
     그대로 받는다. E 는 MPa, I 는 cm⁴ 이므로 EI 는 kN·m² 로 떨어진다. */
  function spanEI(k) { return ST.spans[k].E * (ST.spans[k].I * 1e4) * 1e-9; }

  /* 수평은 아무 데도 잡히지 않으면 계가 뜬다 — 제일 왼쪽의 구속된 지점 하나를
     pin 으로 둔다. 수평하중이 없으므로 연직 반력과 모멘트는 달라지지 않는다. */
  function supNames() {
    var pinned = false;
    return ST.sup.slice(0, nSpan() + 1).map(function (s) {
      if (s === 'fix') { pinned = true; return 'fix'; }
      if (s === 'roller') { if (!pinned) { pinned = true; return 'pin'; } return 'roller'; }
      return 'free';
    });
  }

  /* 안쪽 절점을 Free 로 두어도 보는 끊기지 않는다 — 그 자리에 지점이 없을 뿐
     부재는 이어져 있고, 절점은 회전과 함께 아래로도 내려간다. 엔진의 측방변위
     (sway) 풀이가 그 자유도를 맡는다. 확인함: 8+6+8 에서 B 를 Free 로 두면
     14+8 2경간과 반력·모멘트가 1e-10 까지 같다. 그래서 막지 않는다.
     막아야 하는 것은 계 전체가 기구가 되는 경우뿐이다. */
  function checkModel() {
    var sup = ST.sup.slice(0, nSpan() + 1);
    var nFix = sup.filter(function (s) { return s === 'fix'; }).length;
    var nHeld = sup.filter(function (s) { return s !== 'free'; }).length;
    if (nFix === 0 && nHeld < 2) return 'Not a structure — needs two supports, or one fixed end.';
    return '';
  }

  function localLoads(k) {
    var L = ST.spans[k].L, out = [];
    ST.loads.forEach(function (ld, i) {
      if (ld.s !== k) return;
      var no = 'Load ' + (i + 1) + ' (span ' + (k + 1) + ')';
      if (+ld.w.v) {                                  // 등분포
        var a = +ld.w.a || 0, b = +ld.w.b;
        if (!(b > 0)) throw new Error(no + ': the loaded length b must be greater than 0.');
        if (a < -1e-9 || a + b > L + 1e-9) throw new Error(no + ': a + b must be ≤ L (' + num(L, 3) + ' m).');
        out.push({ type: 'w', w1: -ld.w.v, w2: -ld.w.v, a: a, b: Math.min(a + b, L) });
      }
      if (+ld.p.v) {                                  // 집중
        var x = +ld.p.a;
        if (!(x >= -1e-9 && x <= L + 1e-9)) throw new Error(no + ': the point load must sit between 0 and L (' + num(L, 3) + ' m).');
        out.push({ type: 'P', P: -ld.p.v, a: Math.min(Math.max(x, 0), L) });
      }
    });
    return out;
  }

  /* ── 화면 ───────────────────────────────────────────────────── */
  function build(root) {
    root.innerHTML =
      '<div class="bf-root"><div class="cb-stack">' +

      '  <div class="bf-card"><div class="bf-hd"><span class="bf-ttl">Model</span>' +
      '    <span class="cb-headbits">' +
      '      <span class="bf-seg" id="cb-nseg">' +
      '        <button type="button" data-d="-1" title="Remove the last span">−</button>' +
      '        <button type="button" class="cb-n" disabled></button>' +
      '        <button type="button" data-d="1" title="Add a span">+</button></span>' +
      '      <span class="cb-maxnote">Max ' + MAXSPAN + ' spans</span>' +
      '    </span></div>' +
      '    <div class="cb-model">' +
      '      <div class="cb-supstrip" id="cb-supstrip"></div>' +
      '      <div class="cb-cols" id="cb-cols"></div>' +
      '    </div>' +
      '    <div class="bf-err" id="cb-serr" hidden></div></div>' +

      '  <div class="bf-card"><div class="bf-hd"><span class="bf-ttl">Load</span>' +
      '    <button type="button" class="cb-ladd" id="cb-ladd">+ Add load</button>' +
      '    <span class="cb-maxnote">One row may carry a UDL and a point load together · a and b are measured from the left end of that span · a value of 0 means the load is not applied</span></div>' +
      '    <div class="cb-loadpanes" id="cb-loadpanes"><div id="cb-ltbl"></div></div>' +
      '    <div class="bf-err" id="cb-lerr" hidden></div></div>' +

      '  <div class="bf-card"><div class="bf-hd"><span class="bf-ttl" id="cb-title">Continuous beam</span></div>' +
      '    <div class="bf-plot" id="bf-plot"></div></div>' +

      '  <div class="cb-out">' +
      '    <div class="bf-card"><div class="bf-hd"><span class="bf-ttl">Results</span></div>' +
      '      <div class="bf-body"><div class="bf-stats" id="cb-stats"></div></div></div>' +

      '    <div class="bf-card"><div class="bf-hd"><span class="bf-ttl">Value at a point</span>' +
      '    <span class="cb-maxnote" id="cb-atwhere"></span></div>' +
      '    <div class="cb-at">' +
      '      <div class="cb-atin">' +
      '        <div class="cb-f"><label>Span</label><select id="cb-ats"></select><span></span></div>' +
      '        <div class="cb-f"><label>x</label>' +
      '          <input type="number" id="cb-atx" step="0.1" min="0"><span class="bf-unit">m</span></div>' +
      '      </div>' +
      '      <table class="bf-tbl" id="cb-attbl"></table>' +
      '    </div>' +
      '      <div class="bf-note">Hover the diagrams to read a value anywhere; click to bring that position into this table. ' +
      'x is measured from the left end of the span you pick.</div></div>' +
      '  </div>' +

      '  <div class="cb-out">' +
      '    <div class="bf-card"><div class="bf-hd"><span class="bf-ttl">Support reactions</span></div>' +
      '      <div class="bf-body"><table class="bf-tbl" id="cb-rtbl"></table></div></div>' +
      '    <div class="bf-card"><div class="bf-hd"><span class="bf-ttl">Moments at span ends</span></div>' +
      '      <div class="bf-body"><table class="bf-tbl" id="cb-mtbl"></table>' +
      '        <div class="bf-note">Read off the BMD — sagging positive, hogging negative. Neighbouring spans agree at the support.</div></div></div>' +
      '  </div>' +

      '</div></div>';

    q(root, '#cb-nseg').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-d]'); if (!b) return;
      setNSpan(nSpan() + (+b.dataset.d)); renderAll(root);
    });

    q(root, '#cb-supstrip').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-k]'); if (!b) return;
      ST.sup[+b.dataset.k] = b.dataset.v; renderAll(root);
    });

    var cols = q(root, '#cb-cols');
    cols.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var k = +b.dataset.k;
      if (b.dataset.src != null) {                       // User define / Database
        var sp = ST.spans[k]; sp.src = b.dataset.src;
        if (sp.src === 'db') pickKind(root, k); else { sp.info = ''; renderAll(root); }
      } else if (b.classList.contains('cb-all')) {       // 이 경간의 단면을 전부에
        var src = ST.spans[k];
        ST.spans.forEach(function (t) {
          t.E = src.E; t.I = src.I; t.stop = src.stop; t.sbot = src.sbot;
          t.src = src.src; t.kind = src.kind; t.pick = src.pick; t.info = src.info;
        });
        renderAll(root);
      }
    });

    function onField(e) {
      var el = e.target.closest('select,input'); if (!el) return;
      var k = +el.dataset.k, f = el.dataset.f, v = parseFloat(el.value);
      if (f === 'kind') { ST.spans[k].kind = el.value; pickKind(root, k); return; }
      if (f === 'pick') { applyPick(root, k, el.value); return; }
      if (f === 'L') {
        if (!(isFinite(v) && v > 0)) return;
        /* 지간을 고치면 "그 경간을 다 덮던" 등분포는 따라 늘고 준다. 일부만
           덮던 하중은 사용자가 정한 길이이므로 건드리지 않는다 — 넘치면
           푸는 자리에서 걸러 말해 준다.
           손대지 않는 것이 중요한 이유: 12.5 를 치려면 1 · 12 · 12. 를 거치는데,
           지나가는 값마다 b 를 깎으면 다 치고 났을 때 8 m 짜리 하중이 1 m 로
           줄어 있다. 실제로 그렇게 망가졌다. */
        var Lold = ST.spans[k].L;
        ST.spans[k].L = v;
        ST.loads.forEach(function (ld) {
          if (ld.s !== k) return;
          if (Math.abs((+ld.w.a || 0) + (+ld.w.b || 0) - Lold) < 1e-6)
            ld.w.b = +(v - (+ld.w.a || 0)).toFixed(3);
          // 집중하중이 경간 한가운데였으면 가운데를 지킨다
          if (Math.abs((+ld.p.a || 0) - Lold / 2) < 1e-6) ld.p.a = +(v / 2).toFixed(3);
        });
      } else if (f === 'E' || f === 'I' || f === 'stop' || f === 'sbot') {
        if (!isFinite(v) || (f === 'E' && !(v > 0))) return;
        ST.spans[k][f] = v;
      } else return;
      renderAll(root, true);
      syncLoadInputs(root, k);
    }
    cols.addEventListener('input', onField);
    cols.addEventListener('change', onField);

    /* ── 하중 카드 ─────────────────────────────────────────────── */
    var lp = q(root, '#cb-loadpanes');
    q(root, '#cb-ladd').addEventListener('click', function () {
      ST.loads.push(newLoad(0, ST.spans[0].L)); renderAll(root);
    });
    lp.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.classList.contains('bf-del')) {
        ST.loads.splice(+b.dataset.i, 1);
      } else return;
      renderAll(root);
    });

    function onLoad(e) {
      var el = e.target.closest('select,input'); if (!el) return;
      var ld = ST.loads[+el.dataset.i]; if (!ld) return;
      var f = el.dataset.f, v = parseFloat(el.value), waOld = +ld.w.a || 0;

      if (f === 's') {
        ld.s = Math.min(Math.max(parseInt(el.value, 10) || 0, 0), nSpan() - 1);
        loadFits(ld, ST.spans[ld.s].L);
        renderAll(root);                     // 표의 값이 바뀌었으니 다시 그린다
        return;
      }
      if (!isFinite(v)) return;
      if (f.charAt(0) === 'w') ld.w[f.slice(1)] = v; else ld.p[f.slice(1)] = v;

      /* 시작점을 옮기면, 남은 길이를 다 덮던 등분포만 남은 길이를 따라간다.
         일부만 덮던 것은 사용자가 정한 길이이므로 건드리지 않는다. */
      if (f === 'wa' && Math.abs(waOld + (+ld.w.b || 0) - ST.spans[ld.s].L) < 1e-6) {
        var rest = Math.max(0, +(ST.spans[ld.s].L - (ld.w.a || 0)).toFixed(3));
        ld.w.b = rest;
        var bi = lp.querySelector('input[data-i="' + el.dataset.i + '"][data-f="wb"]');
        if (bi && document.activeElement !== bi) bi.value = rest;
      }
      renderAll(root, true);
      syncLoadInputs(root, ld.s);
    }
    lp.addEventListener('input', onLoad);
    lp.addEventListener('change', onLoad);

    /* 조회 위치 — 경간과 그 안에서의 x 로 받아 보 전체 좌표로 바꾼다 */
    function setAt(k, xl) {
      k = Math.min(Math.max(k, 0), nSpan() - 1);
      ST.atX = nodeX(k) + Math.min(Math.max(xl, 0), ST.spans[k].L);
      renderAll(root, true);
    }
    q(root, '#cb-ats').addEventListener('change', function () {
      setAt(parseInt(this.value, 10) || 0, atLocal().x);
    });
    q(root, '#cb-atx').addEventListener('input', function () {
      var v = parseFloat(this.value);
      if (isFinite(v)) setAt(atLocal().k, v);
    });

    var plot = q(root, '#bf-plot');
    plot.addEventListener('mousemove', cursorMove);
    plot.addEventListener('mouseleave', cursorHide);
    /* 눈으로 찾은 자리를 손으로 옮겨 적지 않아도 되게 — 짚으면 표로 들어온다 */
    plot.addEventListener('click', function (ev) {
      var x = cursorX(ev);
      if (x == null) return;
      ST.atX = Math.round(x * 1000) / 1000;
      renderAll(root, true);
    });

    window.addEventListener('resize', function () { renderAll(root); });
    renderAll(root);
  }

  function setNSpan(n) {
    n = Math.max(1, Math.min(MAXSPAN, n));
    while (ST.spans.length < n) {
      var j = ST.spans.length - 1, last = ST.spans[j];
      var sp = newSpan(last ? last.L : 6);
      if (last) { sp.E = last.E; sp.I = last.I; sp.stop = last.stop; sp.sbot = last.sbot;
                  sp.src = last.src; sp.kind = last.kind; sp.pick = last.pick; sp.info = last.info; }
      ST.spans.push(sp);
      /* 하중은 따라 늘리지 않는다. 새 경간에 무엇을 얹을지는 정하는 사람의
         몫이다 — 앞 경간을 베껴 두면 실어 놓은 적 없는 하중이 결과에 들어간다.
         빈 경간이면 그 끝 반력이 음수(들림)로 나오는데, 그것도 사실이다. */
    }
    while (ST.spans.length > n) ST.spans.pop();
    while (ST.sup.length < n + 1) ST.sup.push('roller');
    ST.sup.length = n + 1;
    ST.loads = ST.loads.filter(function (ld) { return ld.s < n; });
    if (!ST.loads.length) ST.loads.push(newLoad(0, ST.spans[0].L));
  }

  /* 고른 지점조건을 그대로 그려 보인다. 도면의 drawSupport 와 같은 모양을
     작게 줄인 것이라, 위에서 누른 것과 아래 도면이 어긋날 수 없다.
     kind 는 supNames() 가 푼 뒤의 이름이다 — 굴림으로 눌렀어도 수평을 잡는
     지점 하나는 핀이 되므로, 실제로 푼 조건을 보여 준다. */
  function supGlyph(kind, dir) {
    var g = '';
    if (kind === 'fix') {
      /* 벽은 절점 자리에 서고 빗금은 바깥으로 나간다 — 도면의 drawSupport 와
         같다. 보는 벽의 한가운데를 지나므로(위아래로 똑같이 물린다) 상자를
         30 높이로 잡고 CSS 로 보선 위에 걸쳐 놓는다. */
      var wx = 17;
      g = '<line x1="' + wx + '" y1="1" x2="' + wx + '" y2="29" stroke="' + INK + '" stroke-width="2"/>';
      for (var i = 0; i <= 23; i += 5)
        g += '<line x1="' + wx + '" y1="' + i + '" x2="' + (wx - 7 * dir) + '" y2="' + (i + 7) +
             '" stroke="' + HID + '" stroke-width="1"/>';
      return '<svg class="cb-glyph" width="34" height="30" viewBox="0 0 34 30" aria-hidden="true">' + g + '</svg>';
    }
    if (kind !== 'free') {
      g = '<path d="M17 0 L9.5 15 L24.5 15 Z" fill="none" stroke="' + INK + '" stroke-width="1.6"/>';
      if (kind === 'roller') {
        g += '<circle cx="12.8" cy="18.4" r="3.2" fill="none" stroke="' + INK + '" stroke-width="1.2"/>' +
             '<circle cx="21.2" cy="18.4" r="3.2" fill="none" stroke="' + INK + '" stroke-width="1.2"/>' +
             '<line x1="4" y1="23" x2="30" y2="23" stroke="' + INK + '" stroke-width="1.4"/>';
      } else {                                   // pin — 수평까지 잡힌 지점
        g += '<line x1="4" y1="16" x2="30" y2="16" stroke="' + INK + '" stroke-width="1.4"/>';
        for (var k = -11; k <= 9; k += 5)
          g += '<line x1="' + (17 + k) + '" y1="16" x2="' + (17 + k - 5) + '" y2="22" stroke="' +
               HID + '" stroke-width="1"/>';
      }
    }
    return '<svg class="cb-glyph" width="34" height="26" viewBox="0 0 34 26" aria-hidden="true">' + g + '</svg>';
  }

  var GLYPHTIP = { fix: 'Fixed — holds against translation and rotation',
                   pin: 'Pin — holds vertically and horizontally (this is the one support taking horizontal)',
                   roller: 'Roller — holds vertically only',
                   free: 'Free — holds nothing; the beam runs through' };

  /* 지점 띠 — 절점은 기둥과 기둥 사이에 선다. 자리는 경간 수로만 정하고
     (기둥은 폭이 같다) 실제 경간장 비율은 아래 도면이 보여 준다. */
  function renderSups(root) {
    var n = nSpan(), solved = supNames();
    /* 칸이 5경간 폭으로 고정되었으므로 절점 k 는 폭의 k/5 자리에 선다.
       보 선도 마지막 절점까지만 긋는다 — 칸이 없는 데까지 보가 있으면 안 된다. */
    var span = 100 / MAXSPAN;
    q(root, '#cb-supstrip').innerHTML =
      '<div class="cb-beamline" style="right:' + (100 - n * span) + '%"></div>' +
      /* 기호는 절점 자리에 정확히 걸쳐 둔다 — 버튼 묶음은 폭이 있어 양 끝에서
         안쪽으로 밀어야 하지만, 기호는 밀 이유가 없다. */
      solved.map(function (v, k) {
        /* 고정은 보가 벽 가운데를 지나야 하므로 반 칸 끌어올린다. 핀·굴림은
           보선에 얹히는 것이 맞으므로 그대로 둔다. */
        return '<span class="cb-supg' + (v === 'fix' ? ' cb-supg-fix' : '') +
          '" style="left:' + (k * span) + '%" title="' +
          esc(GLYPHTIP[v] || v) + '">' + supGlyph(v, k === 0 ? 1 : -1) + '</span>';
      }).join('') +
      ST.sup.slice(0, n + 1).map(function (s, k) {
        var pos = k * span;
        var shift = k === 0 ? 'translateX(0)' : (k === n ? 'translateX(-100%)' : 'translateX(-50%)');
        return '<div class="cb-sup" style="left:' + pos + '%;transform:' + shift + '">' +
          '<div class="cb-supname">' + nodeName(k) + '</div>' +
          '<span class="bf-seg">' + SUPKIND.map(function (p) {
            return '<button type="button" data-k="' + k + '" data-v="' + p[0] + '"' +
              ' aria-pressed="' + (s === p[0] ? 'true' : 'false') + '">' + p[1] + '</button>';
          }).join('') + '</span></div>';
      }).join('');
  }

  /* 다시 지어야 하는 경우에도, 손대고 있던 칸으로 커서를 돌려놓는다. */
  function keepFocus(root, fn) {
    var a = document.activeElement, sel = null;
    if (a && a.dataset && a.dataset.f != null)
      sel = 'input' + (a.dataset.k != null ? '[data-k="' + a.dataset.k + '"]' : '') +
            '[data-f="' + a.dataset.f + '"]' +
            (a.dataset.i != null ? '[data-i="' + a.dataset.i + '"]' : '');
    fn();
    if (!sel) return;
    var el = root.querySelector(sel);
    if (!el) return;
    try { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    catch (e) { /* number 칸은 selectionRange 를 안 준다 — 포커스만으로 충분하다 */ }
  }

  function renderCols(root) {
    var n = nSpan();
    /* 칸의 폭은 늘 5경간 기준이다. 경간 수를 따라가면 1경간일 때 입력칸 하나가
       카드 폭을 다 먹어 숫자가 저 멀리 붙고, 경간을 늘리고 줄일 때마다 칸이
       출렁인다. 남는 자리는 비워 둔다 — 어디까지 채울 수 있는지도 같이 보인다. */
    q(root, '#cb-cols').style.gridTemplateColumns = 'repeat(' + MAXSPAN + ',minmax(0,1fr))';
    q(root, '#cb-nseg').querySelector('.cb-n').textContent = n + (n === 1 ? ' span' : ' spans');
    [].forEach.call(q(root, '#cb-nseg').querySelectorAll('button[data-d]'), function (b) {
      b.disabled = (+b.dataset.d < 0 && n <= 1) || (+b.dataset.d > 0 && n >= MAXSPAN);
    });

    q(root, '#cb-cols').innerHTML = ST.spans.map(function (sp, k) {
      return '<div class="cb-col">' +
        '<div class="cb-colhead"><b>Span ' + (k + 1) + '</b><span>' + num(nodeX(k), 2) + ' – ' + num(nodeX(k + 1), 2) + ' m</span></div>' +

        '<div class="cb-f"><label>L</label>' +
        '  <input type="number" step="0.5" min="0.1" data-k="' + k + '" data-f="L" value="' + sp.L + '">' +
        '  <span class="bf-unit">m</span></div>' +

        '<div class="cb-sub">Property' +
        (n > 1 ? '<button type="button" class="cb-all" data-k="' + k + '" title="Copy the E and section of this span to every span">→ all</button>' : '') +
        '</div>' +
        '<div class="cb-f"><label>E</label>' +
        '  <input type="number" step="1000" min="1" data-k="' + k + '" data-f="E" value="' + sp.E + '">' +
        '  <span class="bf-unit">MPa</span></div>' +

        '<div class="cb-f"><label>I</label>' +
        '  <input type="number" step="10" data-k="' + k + '" data-f="I" value="' + sp.I + '"' + (sp.src === 'db' ? ' readonly' : '') + '>' +
        '  <span class="bf-unit">cm⁴</span></div>' +
        /* 단면을 어디서 가져올지 고르는 자리는 I 와 S 사이다 — 위에서 재료와
           단면2차모멘트를 정하고, 출처를 고르면 그에 딸린 단면계수가 따라온다. */
        '<div class="cb-f"><label>Sect</label><span class="bf-seg cb-srcseg">' +
        '  <button type="button" data-k="' + k + '" data-src="user" aria-pressed="' + (sp.src !== 'db') + '">User</button>' +
        '  <button type="button" data-k="' + k + '" data-src="db" aria-pressed="' + (sp.src === 'db') + '">DB</button>' +
        '</span><span></span></div>' +
        (sp.src === 'db' ?
          '<div class="cb-f"><label>Type</label><select data-k="' + k + '" data-f="kind">' +
            Object.keys(SECT).map(function (t) {
              return '<option value="' + t + '"' + (t === sp.kind ? ' selected' : '') + '>' + esc(SECT[t].label) + '</option>';
            }).join('') + '</select><span></span></div>' +
          '<div class="cb-f"><label>Size</label><select data-k="' + k + '" data-f="pick" id="cb-pick-' + k + '">' +
            '<option>Loading…</option></select><span></span></div>' : '') +
        '<div class="cb-f"><label>S top</label>' +
        '  <input type="number" step="1" min="0" data-k="' + k + '" data-f="stop" value="' + sp.stop + '"' + (sp.src === 'db' ? ' readonly' : '') + '>' +
        '  <span class="bf-unit">cm³</span></div>' +
        '<div class="cb-f"><label>S bot</label>' +
        '  <input type="number" step="1" min="0" data-k="' + k + '" data-f="sbot" value="' + sp.sbot + '"' + (sp.src === 'db' ? ' readonly' : '') + '>' +
        '  <span class="bf-unit">cm³</span></div>' +
        (sp.info ? '<div class="cb-secnote">' + sp.info + '</div>' : '') +
        '</div>';
    }).join('');

    // DB 로 놓인 경간은 목록을 채운다
    ST.spans.forEach(function (sp, k) { if (sp.src === 'db') fillPick(root, k); });
  }

  /* ── 단면 DB (경간마다) ────────────────────────────────────────── */
  /* 하중은 모델과 따로 둔다 — 경간을 손보는 일과 하중을 얹는 일은 서로
     다른 작업이라, 한 카드에 섞여 있으면 둘 다 답답해진다.
     UDL 과 CON 을 좌우로 나눠 놓으면 어느 쪽을 몇 개 걸었는지 한눈에 읽힌다. */
  function spanSel(i, k) {
    return '<select data-i="' + i + '" data-f="s" title="Span this load sits on">' +
      ST.spans.map(function (sp, j) {
        return '<option value="' + j + '"' + (j === k ? ' selected' : '') + '>' + (j + 1) + '</option>';
      }).join('') + '</select>';
  }

  function numCell(i, f, v, step) {
    return '<td><input type="number" step="' + step + '" data-i="' + i + '" data-f="' + f +
           '" value="' + v + '"></td>';
  }

  /* 하중번호 · 경간 · 등분포(w a b) · 집중(P a) 이 한 줄이다. 종류를 고르는
     드롭다운을 없앤 셈인데, 실제로 한 경간에 등분포와 집중이 같이 걸리는
     일이 흔하고 그때 두 줄로 나뉘면 같은 하중경우라는 것이 보이지 않는다. */
  function renderLoads(root) {
    var nDel = ST.loads.length > 1;
    q(root, '#cb-ltbl').innerHTML =
      '<table class="bf-ltbl cb-ltbl"><thead>' +
      /* 폭은 백분율로 — 카드가 넓어지면 숫자칸도 같이 넓어진다 */
      '<tr><th rowspan="2" style="width:4%">#</th><th rowspan="2" style="width:9%">Span</th>' +
      '  <th colspan="3" class="cb-grp cb-grpl">UDL</th>' +
      '  <th colspan="3" class="cb-grp cb-grpl">CON</th>' +
      '  <th rowspan="2" style="width:5%"></th></tr>' +
      /* 단위는 칸 이름에 붙인다 — 묶음 이름에 한 번 적으면 a·b 가 무슨 단위인지
         말해 주지 못한다. 가운데 정렬은 값이 오른쪽에 붙는 숫자칸 위에서
         이름이 어느 칸 것인지 더 잘 읽히기 때문이다. */
      '<tr><th style="width:16%" class="cb-grpl">W<i>(kN/m)</i></th><th style="width:13%">A<i>(m)</i></th><th style="width:13%">B<i>(m)</i></th>' +
      '  <th style="width:16%" class="cb-grpl">P<i>(kN)</i></th><th style="width:13%">A<i>(m)</i></th><th style="width:11%">B<i>(m)</i></th></tr>' +
      '</thead><tbody>' +
      ST.loads.map(function (ld, i) {
        return '<tr><td class="cb-no">' + (i + 1) + '</td><td>' + spanSel(i, ld.s) + '</td>' +
          numCell(i, 'wv', ld.w.v, '0.5').replace('<td>', '<td class="cb-grpl">') +
          numCell(i, 'wa', ld.w.a, '0.1') + numCell(i, 'wb', ld.w.b, '0.1') +
          '<td class="cb-grpl">' + numCell(i, 'pv', ld.p.v, '0.5').replace(/^<td>|<\/td>$/g, '') + '</td>' +
          numCell(i, 'pa', ld.p.a, '0.1') +
          /* 집중하중은 자리가 하나다 — 재하길이가 없으니 넣을 칸도 두지 않는다 */
          '<td class="cb-na" title="A point load acts at one place — it has no loaded length">—</td>' +
          '<td><button type="button" class="bf-del" data-i="' + i + '"' +
            (nDel ? '' : ' disabled') + ' title="Remove this load">−</button></td></tr>';
      }).join('') + '</tbody></table>';
  }

  function fillPick(root, k) {
    var sp = ST.spans[k], sel = q(root, '#cb-pick-' + k);
    if (!sel) return;
    loadDb(sp.kind, function (err, rows) {
      if (err) { sel.innerHTML = '<option>—</option>'; return; }
      sel.innerHTML = rows.map(function (r) {
        return '<option value="' + esc(r.key) + '">' + esc(r.label) + '</option>';
      }).join('');
      sel.value = rows.some(function (r) { return r.key === sp.pick; }) ? sp.pick : sel.value;
    });
  }

  function pickKind(root, k) {
    var sp = ST.spans[k];
    loadDb(sp.kind, function (err, rows) {
      if (err || !rows.length) { sp.info = ''; renderAll(root); return; }
      var want = rows.some(function (r) { return r.key === sp.pick; })
        ? sp.pick : rows[Math.min(6, rows.length - 1)].key;
      applyPick(root, k, want);
    });
  }

  function applyPick(root, k, key) {
    var sp = ST.spans[k], rows = DB[sp.kind] || [], r = null;
    rows.forEach(function (x) { if (x.key === key) r = x; });   // 이름이 아니라 키로
    if (!r) return;
    sp.pick = key; sp.src = 'db';
    sp.I = (r.ix >= 1000) ? Math.round(r.ix) : sig(r.ix, 4);
    sp.stop = sig(r.stop, 4); sp.sbot = sig(r.sbot, 4);
    sp.info = esc(r.label) + (r.std ? ' · ' + esc(r.std) : '') +
      (r.ks === 'X' ? ' · <b>not a KS size</b>' : '') +
      ' · A ' + num(r.area, 2) + ' cm² · ' + num(r.wt, 1) + ' kg/m' +
      (r.calc ? ' · <b>Ix computed</b>' : '');
    renderAll(root);
  }

  /* ── 계산 + 그리기 ──────────────────────────────────────────── */
  /* 경간 곡선은 엔진이 스스로 만든 것(r.spans)을 쓴다.

     전에는 여기서 spanDiagram 을 다시 불렀다. 그러면 절점이 제자리에 있다는
     가정이 붙는다 — 양 끝 처짐을 0 으로 놓고 푸는 셈이라, 지점이 없어 절점이
     내려앉는 경우(안쪽 Free)와 자유단(내민보·캔틸레버)에서 처짐이 통째로
     틀렸다. 캔틸레버 끝 처짐이 0 으로 나오고 있었다.

     엔진은 측방변위와 내민단을 이미 갈라 풀어 두었으므로 그 결과를 그대로
     받는 편이 옳다. 부호만 뒤집으면 된다: 엔진은 절점에서 본 부호(CCW 양,
     y 아래 양)이고 이 화면은 부재에서 본 부호를 쓴다. 네 값 모두 정확히
     −1 배임을 확인했다 (S · M · y · θ, 오차 0). */
  function negSpan(e) {
    var neg = function (v) { return -v; };
    return { x: e.x, S: e.S.map(neg), M: e.M.map(neg), y: e.y.map(neg),
             theta: (e.theta || []).map(neg) };
  }

  function solveBeam() {
    var spans = ST.spans.map(function (sp, k) {
      return { L: sp.L, EI: spanEI(k), loads: localLoads(k) };
    });
    var model = window.BeamEngine.Cross.beam(spans, supNames());
    var r = window.BeamEngine.Cross.solve(model);
    var out = { spans: [], R: [], M: [], nodes: [] };
    var X0 = 0;
    spans.forEach(function (sp, k) {
      var id = nodeName(k) + nodeName(k + 1);
      var d = negSpan(r.spans[id]);
      out.spans.push({ k: k, X0: X0, L: sp.L, d: d, loads: sp.loads });
      /* 표에 적는 값은 BMD 에서 읽는 값과 같아야 한다. 부재단 모멘트(절점에서
         본 CCW 양)는 이웃한 두 부재가 서로 반대 부호로 적히므로, 같은 지점을
         두 줄이 +133 과 -133 으로 말하게 된다 — 그림과 어긋나 보인다.
         그래서 곡선의 양 끝값을 그대로 쓴다(처짐 아래로 볼록이 양). */
      out.M.push({ id: id, i: d.M[0], j: d.M[d.M.length - 1] });
      X0 += sp.L;
    });
    for (var k = 0; k <= nSpan(); k++) {
      var R = r.reactions[nodeName(k)] || { fy: 0, mz: 0 };
      out.R.push({ name: nodeName(k), x: nodeX(k), fy: -R.fy, mz: -R.mz, sup: ST.sup[k] });
    }
    out.cycles = r.cycles; out.converged = r.converged;
    return out;
  }

  /* 경간별 곡선을 전체 보 하나로 잇는다. 지점에서 전단은 계단이 지므로
     경계값을 양쪽에서 한 번씩 찍는다 — 그래야 반력만큼의 도약이 보인다. */
  function stitch(res, key) {
    var xs = [], vs = [];
    res.spans.forEach(function (s) {
      var d = s.d, n = d.x.length;
      for (var i = 0; i < n; i++) { xs.push(s.X0 + d.x[i]); vs.push(d[key][i]); }
    });
    return { x: xs, v: vs };
  }

  function extreme(xs, vs) {
    var iMax = 0, iMin = 0;
    for (var i = 1; i < vs.length; i++) { if (vs[i] > vs[iMax]) iMax = i; if (vs[i] < vs[iMin]) iMin = i; }
    var big = Math.abs(vs[iMax]) >= Math.abs(vs[iMin]) ? iMax : iMin;
    return { max: vs[iMax], xmax: xs[iMax], min: vs[iMin], xmin: xs[iMin], abs: vs[big], xabs: xs[big] };
  }

  /* 경간 머리의 "0.00 – 8.00 m" 는 L 을 고치면 따라가야 한다 — 칸을 다시 짓지
     않는 경로에서는 이것만 따로 고쳐 준다. */
  function refreshHeads(root) {
    var heads = q(root, '#cb-cols').querySelectorAll('.cb-colhead span');
    [].forEach.call(heads, function (el, k) {
      el.textContent = num(nodeX(k), 2) + ' – ' + num(nodeX(k + 1), 2) + ' m';
    });
  }

  /* 상태가 조용히 바뀐 하중칸(L 을 줄여 b 가 잘린 경우 등)을 화면에 되쓴다.
     지금 손대고 있는 칸은 건드리지 않는다 — 커서가 튀면 못 친다. */
  function syncLoadInputs(root, k) {
    var lp = q(root, '#cb-loadpanes');
    ST.loads.forEach(function (ld, i) {
      if (ld.s !== k) return;
      ['wv', 'wa', 'wb', 'pv', 'pa'].forEach(function (f) {
        var el = lp.querySelector('input[data-i="' + i + '"][data-f="' + f + '"]');
        var want = f.charAt(0) === 'w' ? ld.w[f.slice(1)] : ld.p[f.slice(1)];
        if (el && el !== document.activeElement && el.value !== String(want)) el.value = want;
      });
    });
  }

  /* keep 이면 입력칸의 DOM 을 그대로 둔다 — 값만 바뀐 경우다.
     칸의 구성(경간 수 · 하중 개수 · 단면 출처)이 바뀔 때만 다시 짓는다. */
  function renderAll(root, keep) {
    if (keep) { refreshHeads(root); }
    else {
      renderSups(root);
      keepFocus(root, function () { renderCols(root); renderLoads(root); });
    }

    var bad = checkModel();
    var serr = q(root, '#cb-serr');
    serr.hidden = !bad; serr.innerHTML = bad ? '<b>Support.</b> ' + esc(bad) : '';
    if (bad) { q(root, '#bf-plot').innerHTML = ''; q(root, '#cb-stats').innerHTML = '';
               q(root, '#cb-attbl').innerHTML = '';
               q(root, '#cb-rtbl').innerHTML = ''; q(root, '#cb-mtbl').innerHTML = ''; CUR = null; return; }

    var res, lerr = q(root, '#cb-lerr');
    try { res = solveBeam(); lerr.hidden = true; }
    catch (e) {
      lerr.hidden = false; lerr.innerHTML = '<b>Load input.</b> ' + esc(e.message);
      q(root, '#bf-plot').innerHTML = ''; return;
    }

    var Lt = totalL();
    /* 판의 높이는 하중 줄 수와 판 구성이 정한다 — 폭과는 무관하다. 그래서 한 번
       그려 높이를 알아낸 뒤, 그 높이에서 16:9 가 되는 폭으로 다시 그린다.
       두 번 그리는 것은 높이가 폭에 딸린 계산으로 바뀌더라도(라벨이 겹쳐 줄이
       늘어나는 식) 비율이 크게 어긋나지 않게 하려는 것이다.
       칸보다 넓어질 수는 없다 — 좁은 화면에서는 칸 폭이 그대로 상한이다. */
    var wMax = plotWidth(root, '#bf-plot') || 720;
    /* 한 판을 그린다. 폭만 받으면 되고, 높이는 그리면서 정해진다. */
    function paint(w) {
        var pad = padOf(w);
        var SXg = function (x) { return pad + (Lt > 0 ? x / Lt : 0) * (w - 2 * pad); };
        var s = Sheet(w), probes = [];

      /* ① 보 · 지점 · 하중 · 경간 치수

         하중이 어디서 시작해 얼마나 걸리는지는 숫자칸에만 있고 그림에는 없었다.
         a(경간 왼쪽 끝에서 시작점)와 재하길이를 도면 위쪽에 치수로 적는다.
         경간마다 따로 재고(입력이 그 기준이다) 전체 좌표로 옮겨 한 번에 배치한다 —
         가로로 겹치지 않는 치수는 같은 높이에 두어야 a 와 b 가 계단이 되지 않는다. */
      var ld = [];
      res.spans.forEach(function (sp) {
        loadDims(sp.loads, sp.L).forEach(function (d) {
          ld.push({ x1: sp.X0 + d.x1, x2: sp.X0 + d.x2, t: d.t });
        });
      });
      var rows = packDims(ld, function (x) { return SXg(x); }, Lt);

      var y0 = s.grow(Math.max(PLOT.load,
        PLOT.load - 16 + 17 * rows + PLOT.loadStep * Math.max(0, ST.loads.length - 1)));
      s.line(SXg(0), y0, SXg(Lt), y0, INK, 2.4);
      ld.forEach(function (d) {
        drawDim(s, SXg(d.x1), SXg(d.x2), 20 + 17 * d.row, d.t, y0);
      });
      res.spans.forEach(function (sp) {
        var SXs = function (x) { return SXg(sp.X0 + x); };
        // drawLoads 는 엔진 국부형(w1·w2·a·b, b 는 끝좌표)을 받는다
        drawLoads(s, sp.loads, sp.L, function (x) { return SXs(x); }, y0);
      });
      var solvedSup = supNames();
      for (var k = 0; k <= nSpan(); k++) {
        /* 누른 것이 아니라 푼 것을 그린다 — 굴림만 늘어놓으면 수평이 뜨므로
           supNames() 가 왼쪽 하나를 핀으로 바꾼다. 그 사실이 그림에 나와야 한다. */
        var kind = solvedSup[k];
        if (kind !== 'free') drawSupport(s, SXg(nodeX(k)), y0, kind, k === 0 ? 1 : -1);
        s.text(SXg(nodeX(k)), y0 - 12, nodeName(k), INK, { weight: 700, size: 12, halo: 1 });
      }
      ST.spans.forEach(function (sp, k) {
        drawDim(s, SXg(nodeX(k)), SXg(nodeX(k + 1)), y0 + 48, 'L' + (k + 1) + ' = ' + num(sp.L, 2) + ' m');
      });
      s.grow(PLOT.dim);    // 아래 치수줄이 첫 판을 밟지 않게

      /* ② SFD · BMD · δ */
      [['SFD', 'S', SFD, 'kN', RDP, false, false],
       ['BMD', 'M', BMD, 'kN·m', RDP, true, false],
       ['δ',   'y', DEF, 'mm', RDP, false, true]].forEach(function (cf) {
        var st = stitch(res, cf[1]);
        var vs = cf[1] === 'y' ? st.v.map(function (v) { return v * 1000; }) : st.v;
        s.grow(PLOT.gap);
        var yy = s.grow(PLOT.band);
        probes.push(drawCurve(s, { x: st.x, v: vs, col: cf[2], tag: cf[0], unit: cf[3], dp: cf[4],
                                   flip: cf[5], absv: cf[6], y0: yy, amp: PLOT.amp,
                                   SX: function (x) { return SXg(x); }, L: Lt, pad: pad }));
        s.grow(PLOT.tail);   // 진폭 + 라벨
      });

      /* 조회 위치 표식 — 아래 표가 읽고 있는 자리를 도면에도 찍는다.
         마우스를 뗀 뒤에도 어디를 보고 있었는지 남아 있어야 한다. */
      var markX = atGlobal();
      if (probes.length && markX >= 0 && markX <= Lt) {
        s.grow(PLOT.mark);
        var pxa = SXg(markX);
        s.line(pxa, 8, pxa, s.h - 17, DIM, 1, '5 4');
        probes.forEach(function (pr) {
          s.dot(pxa, pr.y0 + pr.sgn * pr.amp * (valueAt(pr.x, pr.v, markX) / pr.mx), 3.2, pr.col);
        });
        s.text(Math.min(Math.max(pxa, 30), w - 30), s.h - 6, 'x = ' + num(markX, 3), DIM, { size: 10, halo: 1 });
      }

      return { s: s, probes: probes, pad: pad, w: w };
    }

    /* ① 높이를 알아내고 ② 그 높이에서 16:9 가 되는 폭으로 다시 그린다 */
    var P0 = paint(wMax);
    var w16 = Math.max(360, Math.min(wMax, Math.round(P0.s.h * 16 / 9)));
    var P = (w16 === wMax) ? P0 : paint(w16);
    var s = P.s, probes = P.probes, pad = P.pad, w = P.w;

    s.raw(cursorLayer(probes, s.h));
    q(root, '#bf-plot').innerHTML = s.out();
    /* 커서가 읽을 좌표계를 넘겨 둔다 — 이게 없으면 마우스를 올려도 조용하다 */
    CUR = { w: w, pad: pad, L: Lt, probes: probes, root: root };

    /* ③ 결과 */
    var Sst = stitch(res, 'S'), Mst = stitch(res, 'M'), Yst = stitch(res, 'y');
    var eS = extreme(Sst.x, Sst.v), eM = extreme(Mst.x, Mst.v), eY = extreme(Yst.x, Yst.v);
    // 응력은 그 모멘트가 난 경간의 단면계수로 낸다 — 경간마다 단면이 다를 수 있다
    // 응력은 |M| 이 가장 큰 자리의 단면으로 — 그 자리가 어느 경간인지 splitX 가 안다
    var kAbs = splitX(eM.xabs).k;
    var top = stressTop(eM.abs, ST.spans[kAbs].stop), bot = stressBot(eM.abs, ST.spans[kAbs].sbot);
    /* 각 값이 어느 경간의 어디에서 났는지 함께 적는다. 경간 안의 거리를
       먼저 쓰고, 보 왼쪽 끝에서 잰 거리를 괄호로 덧붙인다 — 도면의 가로축은
       후자라서, 둘 다 없으면 표와 그림을 눈으로 잇기 어렵다. */
    q(root, '#cb-stats').innerHTML = [
      ['M sag', rnum(eM.max), 'kN·m', eM.xmax, BMD],
      ['M hog', rnum(eM.min), 'kN·m', eM.xmin, BMD],
      ['V max', rnum(eS.abs), 'kN', eS.xabs, SFD],
      ['δ max', (eY.abs < 0 ? '↓ ' : '↑ ') + rnum(Math.abs(eY.abs) * 1000), 'mm', eY.xabs, DEF],
      ['σ top', rnum(top), 'MPa', eM.xabs, BMD, sgnTag(top)],
      ['σ bot', rnum(bot), 'MPa', eM.xabs, BMD, sgnTag(bot)]
    ].map(function (r) {
      return '<div class="bf-stat"><div class="k">' + esc(r[0]) + '</div>' +
             '<div class="v" style="color:' + r[4] + '">' + r[1] + '</div>' +
             '<div class="s">' + esc(r[2] + (r[5] ? '  ' + r[5] : '')) + '</div>' +
             '<div class="s2">' + esc(whereTxt(r[3]) + '  (' + rnum(r[3]) + ' m)') + '</div></div>';
    }).join('');
    (function () {
      var el = q(root, '#cb-stats');
      var cols = (getComputedStyle(el).gridTemplateColumns || '').split(' ').filter(Boolean).length || 1;
      var n = el.children.length, need = (cols - (n % cols)) % cols;
      for (var i = 0; i < need; i++) el.insertAdjacentHTML('beforeend', '<div class="bf-stat"></div>');
    }());

    /* 임의 위치 조회 — 곡선을 이어 붙인 뒤 그 위에서 읽는다.
       θ 는 그림에 없지만 처짐이 어디서 돌아서는지 볼 때 쓰인다. */
    var at = atLocal(), aX = atGlobal(), Tst = stitch(res, 'theta');
    var asel = q(root, '#cb-ats');
    if (asel.children.length !== nSpan() || +asel.value !== at.k)
      asel.innerHTML = ST.spans.map(function (sp, j) {
        return '<option value="' + j + '"' + (j === at.k ? ' selected' : '') + '>' + (j + 1) + '</option>';
      }).join('');
    var axIn = q(root, '#cb-atx');
    axIn.max = ST.spans[at.k].L;
    if (document.activeElement !== axIn) axIn.value = +at.x.toFixed(3);
    q(root, '#cb-atwhere').textContent =
      'Span ' + (at.k + 1) + ' · x = ' + num(at.x, 3) + ' m · ' + num(aX, 3) + ' m from the left end';

    var aM = valueAt(Mst.x, Mst.v, aX), aV = valueAt(Sst.x, Sst.v, aX);
    var aY = valueAt(Yst.x, Yst.v, aX), aT = valueAt(Tst.x, Tst.v, aX);
    var spAt = ST.spans[at.k];
    q(root, '#cb-attbl').innerHTML =
      '<thead><tr><th style="width:72px">Quantity</th><th style="width:110px;text-align:right">Value</th>' +
      '<th style="width:64px">Unit</th><th></th></tr></thead><tbody>' +
      [['M', rnum(aM), 'kN·m', aM > 0 ? 'sagging' : (aM < 0 ? 'hogging' : '')],
       ['V', rnum(aV), 'kN', ''],
       ['δ', rnum(aY * 1000), 'mm', aY < 0 ? 'downward' : (aY > 0 ? 'upward' : '')],
       ['θ', rnum(aT * 1000), 'mrad', ''],
       ['σ top', rnum(stressTop(aM, spAt.stop)), 'MPa', sgnTag(stressTop(aM, spAt.stop))],
       ['σ bot', rnum(stressBot(aM, spAt.sbot)), 'MPa', sgnTag(stressBot(aM, spAt.sbot))]
      ].map(function (r) {
        return '<tr><td>' + r[0] + '</td><td class="n">' + r[1] + '</td><td>' + r[2] + '</td>' +
               '<td class="cb-na">' + r[3] + '</td></tr>';
      }).join('') + '</tbody>';

    q(root, '#cb-rtbl').innerHTML =
      '<thead><tr><th>Node</th><th style="text-align:right">x</th>' +
      '<th style="text-align:right">R</th><th style="text-align:right">M</th></tr></thead><tbody>' +
      res.R.map(function (r) {
        if (r.sup === 'free') return '';
        return '<tr><td>' + r.name + '</td><td class="n">' + num(r.x, 2) + ' m</td>' +
               '<td class="n">' + rnum(r.fy) + ' kN</td>' +
               '<td class="n">' + (r.sup === 'fix' ? rnum(r.mz) + ' kN·m' : '—') + '</td></tr>';
      }).join('') + '</tbody>';

    q(root, '#cb-mtbl').innerHTML =
      '<thead><tr><th>Span</th><th style="text-align:right">M i</th>' +
      '<th style="text-align:right">M j</th></tr></thead><tbody>' +
      res.M.map(function (m, k) {
        return '<tr><td>' + m.id + '</td><td class="n">' + rnum(m.i) + '</td>' +
               '<td class="n">' + rnum(m.j) + '</td></tr>';
      }).join('') + '</tbody>';

    q(root, '#cb-title').textContent = nSpan() === 1 ? 'Single span'
      : nSpan() + '-span continuous beam — ' + ST.spans.map(function (sp) { return num(sp.L, 1); }).join(' + ') + ' m';
  }

  /* ── 진입점 ─────────────────────────────────────────────────── */
  function start(mountId) {
    var root = document.getElementById(mountId || 'mount-beam-multi');
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

  if (typeof window !== 'undefined') window.fbeam_multi = start;
}());
