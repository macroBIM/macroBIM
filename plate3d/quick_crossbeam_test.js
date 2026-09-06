/* QuickPlate3D — Crossbeam.

   판형교의 거더 사이. 가로보와 수직브레이싱, 그리고 그 위에 얹히는 슬래브와
   방호벽까지 — 한 장의 표준횡단면이 정하는 것들이다.

   입력 항목은 APlate 사용설명서를 따랐다. 스키마를 새로 짤 이유가 없다:

     §2.3.17 단면 타입 설정      → 1장 Girder types
     §2.4.10 가로보 상세         → 2장 Crossbeam types  (형강·제작·수직보강재연결)
     §2.4.11 수직브레이싱 상세   →   〃                  (V형·역V형)
     §2.4.10 단면배치            →   〃  (Section arrangement — 매뉴얼도 여기서 받는다)
     §2.4.9  이음판 접두사 u·d·s →   〃  (자리마다 이음 하나 — 세 칸)
     §2.4.9  볼트 이음 상세      → 3장 Bolted connection
     §2.4.13 수직보강재 상세     → 4장 Stiffener & scallop
     §2.4.2  스캘럽 상세         →   〃  (모재 t 16 을 경계로 두 벌)
     §2.3.4  횡단 구성          → 5장 Layout
     §2.3.13 가로보 및 수직브레이싱 위치 → 〃  (같은 칸이라 같은 표다)
     §2.3.20 슬래브 제원         → 6장 Deck slab
     §2.3.21 방호벽 제원         → 7장 Barrier

   장 순서는 「먼저 정의하고 나중에 배치한다」이다 — 타입(1~4)을 먼저 만들고,
   그 다음에 어느 거더가·어느 칸이 어느 타입인지(5장)를 고른다. 매뉴얼은
   배치부터 받지만, 폼에서는 고를 것이 없는 드롭다운이 먼저 나오면 안 된다.

   §2.3.4 와 §2.3.13 은 한 장이다. 매뉴얼은 두 화면으로 받지만 세는 것이 같다 —
   거더 사이의 「칸」. 칸을 두 장에서 두 번 세면 입력이 느는 게 아니라 어긋날
   자리가 는다. 간격을 적는 줄 바로 밑에 가로보 줄을 놓았고, 열도 맞춰 두었다.

   ── 매뉴얼과 일부러 다르게 한 것 ──────────────────────────────
   같은 값을 여러 번 적게 하지 않는다.

     · 배치는 「중심 이격(L1…Ln)」이 아니라 「사이 간격」으로 받는다.
       SL · Bay 1…n · SR 한 줄 — 시공자가 내는 것이 간격이고, 매뉴얼이 받는
       이격은 그 줄에서 계산되어 그림에 같이 그려진다 (§2.3.4 의 두 읽기)
     · 편경사는 퍼센트 둘이면 된다 — 거더 높이차는 우리가 계산한다
     · 보강재 좌우는 「대칭」이면 네 칸이다 (매뉴얼은 LW/RW…LH/RH 여덟 칸)
     · 스캘럽은 두 벌 받아 두고, 어느 줄을 쓸지는 플랜지 두께를 보고 고른다

   ── 한 번에 한 군데 ──────────────────────────────────────────
   매뉴얼은 다리 한 채를 통째로 세운다. 그래서 가로보를 위치별(§2.4.10 의
   양측단 A · 교각 P · 분배 C)로 나눠 받고, 지간·지점 각도·시종점까지 받는다.

   이 폼은 그렇지 않다. **한 군데의 표준횡단을 낸다.** 단부를 그릴 것이면
   단부 값을 적어서 한 번, 지점부를 그릴 것이면 지점부 값을 적어서 한 번
   돌린다. 그래서 「어느 위치냐」를 고르는 칸을 두지 않는다 — 두면 폼이 한
   군데를 내면서 여러 군데를 내는 척하게 되고, 그건 없는 것을 있는 척하는
   것이다. 교축방향으로 남긴 값은 Pitch 하나뿐이고, 그것은 위치를 고르는
   값이 아니라 이 한 군데가 몇 미터마다 되풀이되는지를 말하는 값이다.

   ── 타입은 라이브러리다 ──────────────────────────────────────
   주형도 가로보도 이음도 「한 줄이 한 타입」이고, 거더와 칸과 자리가 이름으로
   부른다. Simple connector 의 접합 라이브러리(C1~C6)와 같은 짜임이다. 다만
   줄 수를 묶지 않는다 — 폼은 HTML 이라 묶일 이유가 없고, 그게 FORMS.md 의
   규칙이다.

   가로보 한 대가 이음 하나를 부르지 않는다. 매뉴얼이 기호를 한 벌 정해 두고
   접두사로 여러 판에 붙이므로(§2.4.9 의 u 상부 · d 하부 · s 복부), 타입도
   자리마다 하나씩 세 개를 부른다. 세 칸이 형상마다 다르게 읽히는 것이 이
   짜임의 값이다 — 트러스는 상현재·하현재·사재가 거셋에 붙고, 형강은
   상부플랜지·하부플랜지·복부가 이음판으로 붙는다. 같은 세 자리, 같은 세 이름.
   「—」를 고르면 그 자리는 볼트로 안 붙는다: 어느 자리가 비는지는 코드가
   아니라 시트가 정한다.

   지금 이 파일이 하는 일은 「입력 → 그림」까지다. PLATE3D 로 모델을 보내는
   것과 워크북을 내보내는 것은 아직 없다. 없는 것을 있는 척하지 않는다.

   Entry point: fquick_crossbeam(mountId). Loaded on demand by layout_body. */
(function () {
  'use strict';

  /* ---------------- style ---------------- */
  var CSS_ID = 'qcb-style';
  var CSS = [
    '#qcb-wrap{display:flex;flex-direction:column;gap:12px}',
    '#qcb-form{border:1px solid #e3e6ea;border-radius:8px;background:#fff;overflow:visible}',
    '#qcb-bar{display:flex;gap:8px;align-items:center;padding:10px 12px;',
      'border-bottom:1px solid #eef0f3;background:#f8fafc;border-radius:8px 8px 0 0}',
    '#qcb-bar .sp{flex:1}',
    '.qcb-btn{font:600 12px/1 Arial,sans-serif;padding:8px 12px;border-radius:6px;cursor:pointer;',
      'border:1px solid #cbd5e1;background:#fff;color:#0f172a}',
    '.qcb-btn:hover{background:#f1f5f9}',
    '.qcb-btn.primary{background:#1d4ed8;border-color:#1d4ed8;color:#fff}',
    '.qcb-btn.primary:hover{background:#1e40af}',
    '#qcb-status{font:600 11px/1 Arial,sans-serif;color:#64748b}',
    '#qcb-status.bad{color:#b91c1c}',
    '#qcb-body{padding:0 12px 14px}',
    /* a chapter: the dark bar, the column headings, the rows, a note, a check line */
    '.qcb-ch{margin-top:14px}',
    '.qcb-ch>h3{margin:0;font:700 12px/1 Arial,sans-serif;color:#fff;background:#0f172a;',
      'padding:8px 10px;border-radius:5px 5px 0 0;display:flex;align-items:baseline;gap:10px}',
    '.qcb-ch>h3 em{font:400 10.5px/1.4 Arial,sans-serif;color:#cbd5e1;font-style:normal}',
    '.qcb-ch>h3 span.src{margin-left:auto;font:600 10px/1 Arial,sans-serif;color:#7dd3fc;',
      'letter-spacing:.03em}',
    '.qcb-tbl{width:100%;border-collapse:collapse;table-layout:fixed}',
    '.qcb-tbl th{font:700 10px/1 Arial,sans-serif;color:#64748b;text-align:center;',
      'padding:7px 3px;white-space:nowrap}',
    '.qcb-tbl td{padding:2px 3px}',
    '.qcb-tbl td.rl{font:700 11px/1 Arial,sans-serif;color:#0f172a;padding-left:2px;white-space:nowrap}',
    '.qcb-tbl td.rl.sub{font-weight:400;color:#64748b;padding-left:12px}',
    '.qcb-tbl td.rl.mk{color:#7c3aed}',
    '.qcb-tbl input,.qcb-tbl select{width:100%;box-sizing:border-box;',
      'font:700 11px/1 Arial,sans-serif;color:#1d4ed8;background:#eff6ff;border:1px solid #cbd5e1;',
      'border-radius:4px;padding:5px 4px;text-align:center}',
    '.qcb-tbl select{text-align:left;padding:5px 2px 5px 5px}',
    '.qcb-tbl input:focus,.qcb-tbl select:focus{outline:2px solid #93c5fd;outline-offset:-1px}',
    /* a mark cell — the name a girder or a bay calls a type by */
    '.qcb-tbl select.mk{color:#7c3aed;background:#f5f3ff;border-color:#ddd6fe}',
    '.qcb-tbl .out{font:600 11px/1 Arial,sans-serif;color:#64748b;text-align:center;',
      'padding:6px 4px;background:#f8fafc;border:1px solid #eef0f3;border-radius:4px;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.qcb-tbl .out b{color:#0f172a}',
    '.qcb-tbl .hd{font:700 10px/1 Arial,sans-serif;color:#64748b;text-align:center;padding:5px 2px}',
    /* dimmed = this cell cannot apply to the form you picked */
    '.qcb-tbl .dim{color:#b9c2ce;background:#f9fafb;border-color:#e5e7eb}',
    '.qcb-note{font:italic 10.5px/1.6 Arial,sans-serif;color:#64748b;padding:5px 2px 0}',
    '.qcb-chk{font:600 10.5px/1.6 Arial,sans-serif;color:#b45309;padding:3px 2px 0;',
      'display:flex;flex-wrap:wrap;gap:4px 18px}',
    '.qcb-chk .k{color:#64748b;font-weight:400}',
    /* 줄을 더하고 빼는 버튼. 사이트에 이미 있는 모양을 그대로 쓴다 —
       beam_multi.js 의 .cb-ladd (「+ Add load」), PIER 의 「+ Add pier」.
       같은 일을 하는 버튼이 화면마다 다르게 생길 이유가 없다. */
    /* 표 밑 한 줄 — 격자 밖의 값. 열이 칸을 뜻하는 표 안에 「전체에 하나」인
       값을 끼워 넣으면 그 값도 칸마다인 것처럼 읽힌다. 한 번 그렇게 나왔다. */
    '.qcb-span{display:flex;flex-wrap:wrap;align-items:center;gap:6px 20px;',
      'border-top:1px solid #eef0f3;margin-top:8px;padding:9px 2px 2px}',
    '.qcb-span label{display:inline-flex;align-items:center;gap:7px;',
      'font:700 11px/1 Arial,sans-serif;color:#0f172a}',
    '.qcb-span input,.qcb-span select{width:104px;box-sizing:border-box;',
      'font:700 11px/1 Arial,sans-serif;color:#1d4ed8;background:#eff6ff;',
      'border:1px solid #cbd5e1;border-radius:4px;padding:5px 4px;text-align:center}',
    '.qcb-span select{text-align:left;padding:5px 2px 5px 5px}',
    '.qcb-span select.mk{color:#7c3aed;background:#f5f3ff;border-color:#ddd6fe}',
    '.qcb-span input:focus,.qcb-span select:focus{outline:2px solid #93c5fd;outline-offset:-1px}',
    '.qcb-span em{font:400 10.5px/1.5 Arial,sans-serif;color:#64748b}',
    '.qcb-addrow{display:flex;justify-content:center;gap:8px;',
      'border-top:1px solid #eef0f3;padding:9px 0 2px;margin-top:6px}',
    '.qcb-add{border:1px solid #cbd5e1;background:#fff;color:#2563eb;border-radius:6px;',
      'padding:3px 11px;font:600 11px/1.6 Arial,sans-serif;cursor:pointer}',
    '.qcb-add:hover{border-color:#2563eb}',
    '.qcb-add.del{color:#64748b}',
    '.qcb-add.del:hover{border-color:#64748b}',
    /* 장 안의 그림. Simple connector 의 .qsc-guide 와 같은 자리다 —
       표 바로 아래, 가운데. 값을 적은 곳과 그 값이 무엇인지가 붙어 있어야
       읽힌다. 맨 밑에 모아 두면 눈이 표와 그림 사이를 오간다. */
    '.qcb-guide{padding:10px 0 2px;max-width:660px;margin:0 auto}',
    '.qcb-guide.wide{max-width:100%}',
    /* 그림은 제 크기로 선다. width:100% 로 두면 660px 짜리 상세가 되어
       표보다 커진다 — 상세는 표를 설명하는 것이지 표를 밀어내는 게 아니다. */
    '.qcb-guide svg{display:block;height:auto;max-width:100%;margin:0 auto}',
    '.qcb-cap{font:600 10.5px/1.5 Arial,sans-serif;color:#64748b;padding:6px 2px 0;',
      'text-align:center}',
    /* 지금 그려지고 있는 줄. 그림이 어느 줄 것인지 눈으로 잇는다 */
    '.qcb-tbl tr.on td{background:#faf5ff}',
    '.qcb-tbl tr.on td.rl{color:#7c3aed}',
    /* the drawing sits under the form, as wide as it */
    '#qcb-views{display:flex;gap:12px;align-items:flex-start}',
    '.qcb-view{border:1px solid #e3e6ea;border-radius:8px;background:#15181c;padding:10px}',
    '.qcb-view h4{font:700 11px/1 Arial,sans-serif;color:#94a3b8;letter-spacing:.06em;',
      'margin:0 0 6px}',
    '.qcb-view svg{display:block;width:100%;height:auto}',
    '.qcb-cap{font:600 10.5px/1.5 Arial,sans-serif;color:#64748b;padding:6px 2px 0}'
  ].join('');

  function style() {
    if (document.getElementById(CSS_ID)) return;
    var s = document.createElement('style');
    s.id = CSS_ID; s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ---------------- little helpers ---------------- */
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  };
  function el(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }
  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d || 0); }
  function rnd(x, n) { var p = Math.pow(10, n || 0); return Math.round(x * p) / p; }

  /* Crossbeam forms. The first three are the manual's 가로보 (§2.4.10) and are
     one solid member; the last two are its 수직브레이싱 (§2.4.11) and are a
     truss of angles. They share one library because a bay picks exactly one. */
  var FORMS = ['Rolled beam', 'Built-up plate', 'Stiffener-connected',
               'V frame', 'Inverted V frame'];
  var isTruss = function (f) { return f === 'V frame' || f === 'Inverted V frame'; };

  /* 규격 이름이 곧 치수다. 「H-500x200x10x16」 에서 H·B·tw·tf 를 꺼낸다 —
     형강을 골랐으면 단면을 또 적게 할 이유가 없다. 네 숫자가 안 나오면 null 이고,
     그때 그림은 아는 척하지 않는다. 앵글(L-130x130x12)은 셋뿐이라 여기서 걸린다. */
  function sect(name) {
    var n = String(name || '').split(/[^0-9.]+/)
      .filter(function (s) { return s !== ''; }).map(Number);
    return n.length >= 4 ? { h: n[0], b: n[1], tw: n[2], tf: n[3] } : null;
  }

  var ANGLES = ['L-100x100x10', 'L-130x130x12', 'L-150x150x15', 'L-175x175x15'];
  var BEAMS  = ['H-400x200x8x13', 'H-500x200x10x16', 'H-600x200x11x17'];
  var BOLTS  = ['M20', 'M22', 'M24'];
  var NONE   = '\u2014';                 // 「—」 = 이 자리는 볼트로 안 붙는다
  var STEELS = ['SS275', 'SM355', 'SM420'];
  var CONCS  = ['C24', 'C27', 'C30', 'C35'];

  /* ---------------- the values ----------------
     Defaults are the manual's own 권고안 for a 판형교 (§2.3.4): five girders,
     2.5 m apart, 1.2 m of overhang each side — which is 12.4 m out to out. */
  function defaults() {
    return {
      ng: 5, sp: 2500, sl: 1200, sr: 1200,
      /* 칸마다의 간격. 등간격이라는 상태는 따로 두지 않는다 — 같은 숫자가
         적혀 있으면 그게 등간격이다. sp 는 칸을 새로 더할 때의 씨앗으로만 남는다. */
      spl: [2500, 2500, 2500, 2500],
      gt: [                                   // girder type library
        { m: 'GT1', hw: 1800, tw: 12, bt: 400, ttf: 22, bb: 500, tbf: 28 },
        { m: 'GT2', hw: 1800, tw: 14, bt: 500, ttf: 28, bb: 600, tbf: 36 }
      ],
      gAsg: ['GT2', 'GT1', 'GT1', 'GT1', 'GT2'],
      stW: 130, stT: 12, stG: 60, stH: 25, stSide: 'Both sides', stPitch: 2500,
      scA: [25, 25, 35], scB: [35, 35, 50],   // scallop: t <= 16 / t > 16
      /* 가로보 타입. u·l·d 는 부재(상현재·하현재·사재)이고, cu·cd·cs 는 그
         부재가 부르는 이음이다 — 매뉴얼 §2.4.9 의 접두사 u(상부)·d(하부)·
         s(복부) 그대로다. 부재의 d(사재)와 이음의 cd(하부)가 글자를 나눠
         쓰는 것이 어색하지만, 부재 이름은 이미 쓰던 것이고 접두사는 매뉴얼
         것이라 둘 다 못 바꾼다. c 접두어가 「이음」이라는 표시다. */
      ct: [                                   // crossbeam type library
        { m: 'CT1', f: 'V frame', s: 'H-500x200x10x16', u: 'L-130x130x12',
          l: 'L-130x130x12', d: 'L-130x130x12', cu: 'BC1', cd: 'BC1', cs: 'BC2' },
        { m: 'CT2', f: 'Inverted V frame', s: 'H-500x200x10x16', u: 'L-150x150x15',
          l: 'L-150x150x15', d: 'L-150x150x15', cu: 'BC2', cd: 'BC2', cs: 'BC2' },
        { m: 'CT3', f: 'Rolled beam', s: 'H-500x200x10x16', u: '', l: '', d: '',
          cu: 'BC1', cd: 'BC1', cs: 'BC2' }
      ],
      /* Bolted connection library — 매뉴얼 §2.4.9 의 기호를 글자도 뜻도 그대로.
         A 최외단거리, B 종방향 볼트 「칸」 갯수, C 종방향 간격, C1 중앙부 간격,
         E 횡방향 「칸」 갯수, F 횡방향 간격, T·W 이음판, L 볼트 길이.

         B 와 E 는 칸 수이지 볼트 수가 아니다. 매뉴얼 도면이 사슬을
         「sA · sB@sC · sC1」로 적는다 — B칸 @ C간격. 그러니 볼트는 B+1 개다.
         전에는 이 둘을 볼트 수로 읽으면서 「매뉴얼의 기호」라고 적어 두었다:
         기호를 빌려 썼으면 뜻도 같아야 한다.

         C1 은 이음 중심의 틈이다. 0 이면 한 줄로 죽 이어지고, 넣으면 중심을
         두고 양쪽으로 갈린다 — 그때 한 줄의 볼트는 2(B+1) 개다.

         타입과 따로 두는 까닭은 현장이음(§2.4.9)도 같은 열 숫자로 적히기
         때문이다. 매뉴얼 NOTE 가 그렇게 말한다: "모든 이음판의 제원 심볼이
         통일되어 있습니다.(현장이음, 가로보)" — 한 벌의 설명, 두 쓰임. */
      bc: [
        { m: 'BC1', T: 12, W: 300, dia: 'M22', len: 55, B: 1, C: 90, C1: 0, E: 1, F: 90, A: 40 },
        { m: 'BC2', T: 14, W: 340, dia: 'M24', len: 60, B: 2, C: 90, C1: 0, E: 1, F: 90, A: 45 }
      ],
      cAsg: ['CT1', 'CT1', 'CT1', 'CT1'],
      cPitch: 5000, cSeat: 'Sloped',
      slopeL: 2.0, slopeR: 2.0, crown: 'Road centre', soffit: 'Level',
      T: 240, T1: 240, T2: 240, hh: 100, pav: 80, ovh: 300,
      bh1: 300, bh2: 500, bh3: 250, bwt: 250, bwb: 450, bSym: 1,
      matS: 'SM355', matC: 'C27'
    };
  }

  /* Everything that follows from V. Kept apart from defaults() so the form can
     edit V and ask again without the derivation drifting. */
  function derive(V) {
    var D = {};
    /* 칸의 간격. 칸마다 제 값이고, 비어 있으면 씨앗값을 쓴다. */
    D.bay = [];
    for (var i = 0; i < V.ng - 1; i++) D.bay.push(num(V.spl[i], V.sp));
    D.gw = D.bay.reduce(function (a2, b2) { return a2 + b2; }, 0);
    D.W = D.gw + V.sl + V.sr;                        // out to out
    D.half = D.W / 2;
    D.gx = [-D.gw / 2];
    for (i = 0; i < D.bay.length; i++) D.gx.push(D.gx[i] + D.bay[i]);
    /* The soffit rule, and the whole reason the slab chapter has that cell. A roof
       (both sides falling away from the crown) is normally built with a LEVEL
       soffit: the girders all sit at one height and the slab thickens toward
       the crown. Slope the soffit instead and the girders step. */
    D.level = V.soffit === 'Level';
    D.dropL = V.slopeL / 100 * (D.half);             // fall from crown to edge
    D.dropR = V.slopeR / 100 * (D.half);
    D.crownT = V.T1 + Math.max(D.dropL, D.dropR);    // thickness at the crown
    D.gz = D.gx.map(function (x) {
      return D.level ? 0 : -(x < 0 ? (-x) * V.slopeL / 100 : x * V.slopeR / 100);
    });
    D.gtOf = function (i) {
      var m = V.gAsg[i];
      for (var k = 0; k < V.gt.length; k++) if (V.gt[k].m === m) return V.gt[k];
      return V.gt[0];
    };
    D.ctOf = function (i) {
      var m = V.cAsg[i];
      for (var k = 0; k < V.ct.length; k++) if (V.ct[k].m === m) return V.ct[k];
      return V.ct[0];
    };
    /* 이름이 「—」면 그 자리는 볼트로 안 붙는다. 없는 것을 첫 줄로 갈음하지
       않는다 — 그러면 안 그려야 할 판이 그려진다. */
    D.bcOf = function (m) {
      if (!m || m === NONE) return null;
      for (var k = 0; k < V.bc.length; k++) if (V.bc[k].m === m) return V.bc[k];
      return V.bc[0];
    };
    /* 기하 검사 — 내력이 아니라 「들어가느냐」. 볼트 지름의 1.5배가 연단거리의
       흔한 최소값이고, 판 폭이 볼트군을 담는지도 여기서 잰다. */
    D.bcChk = function (b) {
      var d = num(String(b.dia).replace(/[^0-9.]/g, ''), 22);
      var need = Math.ceil(d * 1.5);
      /* 칸 수 → 볼트 수. C1 이 있으면 중심을 두고 두 무리가 된다. */
      var nB = b.C1 > 0 ? 2 * (b.B + 1) : b.B + 1;
      var nE = b.E + 1;
      var run = 2 * b.A + (b.C1 > 0 ? 2 * b.B * b.C + b.C1 : b.B * b.C);
      var across = b.E * b.F;                       // 횡방향 볼트군 폭
      var edgeW = (b.W - across) / 2;               // 판 폭에서 남는 연단거리
      return { d: d, need: need, nB: nB, nE: nE, n: nB * nE,
               run: run, across: across, edgeW: edgeW,
               edgeOK: b.A >= need, fitOK: edgeW >= need };
    };
    D.kgm = function (t) {
      return (t.hw * t.tw + t.bt * t.ttf + t.bb * t.tbf) * 7.85e-6 * 1000;
    };
    D.depth = function (t) { return t.hw + t.ttf + t.tbf; };
    /* Slab area, cut across. Level soffit: a trapezoid whose top is the two
       falls and whose bottom is flat. Sloped soffit: a constant thickness. */
    D.slabA = D.level
      ? (V.T1 * D.W + (D.dropL * D.half / 2) + (D.dropR * D.half / 2)) / 1e6
      : (V.T1 * D.W) / 1e6;
    D.barA = ((V.bwt + V.bwb) / 2 * (V.bh1 + V.bh2 + V.bh3)) / 1e6;
    return D;
  }

  /* ---------------- the page ---------------- */
  function fquick_crossbeam(mountId) {
    var mount = document.getElementById(mountId);
    if (!mount || mount.firstElementChild) return;
    style();

    var V = defaults(), D = derive(V);
    /* 어느 줄을 그리고 있나. 라이브러리마다 하나씩. */
    var ACT = { gt: 0, ct: 0, bc: 0 };

    var wrap = el(
      '<div id="qcb-wrap">' +
      '  <div id="qcb-form">' +
      '    <div id="qcb-bar">' +
      '      <button class="qcb-btn primary" id="qcb-reset" type="button">Reset to defaults</button>' +
      '      <span id="qcb-status"></span>' +
      '      <span class="sp"></span>' +
      '    </div>' +
      '    <div id="qcb-body"></div>' +
      '  </div>' +
      '</div>');
    mount.appendChild(wrap);

    var body = wrap.querySelector('#qcb-body');
    var status = wrap.querySelector('#qcb-status');

    /* ---- cell builders. Each carries the path it writes back to, so one
       delegated listener can serve the whole form. ---- */
    function inp(path, val, dim) {
      return '<input type="text" data-p="' + path + '" value="' + esc(val) + '"' +
             (dim ? ' class="dim" disabled' : '') + '>';
    }
    function sel(path, val, list, cls) {
      return '<select data-p="' + path + '"' + (cls ? ' class="' + cls + '"' : '') + '>' +
        list.map(function (o) {
          return '<option' + (String(o) === String(val) ? ' selected' : '') + '>' + esc(o) + '</option>';
        }).join('') + '</select>';
    }
    var out = function (h) { return '<div class="out">' + h + '</div>'; };
    var hd  = function (h) { return '<div class="hd">' + h + '</div>'; };

    /* extra: 표 바로 밑에 붙는 한 줄. 열이 무엇인가를 뜻하는 표(칸마다·거더마다)
       안에 「전체에 하나」인 값을 끼워 넣으면 그 값도 열마다인 것처럼 읽힌다.
       한 번만 적는 값은 격자 밖에 둔다. */
    function chapter(n, title, sub, src, cols, rows, note, chk, guide, extra) {
      return '<div class="qcb-ch"><h3>%N%. ' + title +
        (sub ? '<em>' + sub + '</em>' : '') +
        '<span class="src">' + src + '</span></h3>' +
        '<table class="qcb-tbl"><colgroup>' +
        cols.w.map(function (x) { return '<col style="width:' + x + '">'; }).join('') +
        '</colgroup><tr>' + cols.h.map(function (h) { return '<th>' + h + '</th>'; }).join('') +
        '</tr>' + rows + '</table>' + (extra || '') +
        (guide ? '<div class="qcb-guide' + (guide.wide ? ' wide' : '') + '">' +
                 '<div id="qcb-d' + guide.n + '"></div>' +
                 '<div class="qcb-cap" id="qcb-cap' + guide.n + '"></div></div>' : '') +
        (note ? '<div class="qcb-note">' + note + '</div>' : '') +
        (chk ? '<div class="qcb-chk">' + chk + '</div>' : '') + '</div>';
    }
    /* pick = 'gt:0' 같은 이름표. 그 줄을 누르면 켜지고, 장 안의 그림이
       그 줄을 그린다. 라이브러리의 줄은 서로 대안이라 「어느 것을 그리나」를
       정해야 하는데, 새 버튼을 두는 대신 만지는 줄이 곧 보는 줄이 되게 했다. */
    function row(label, cells, kind, pick) {
      var on = pick && ACT[pick.split(':')[0]] === +pick.split(':')[1];
      return '<tr' + (pick ? ' data-pick="' + pick + '"' : '') + (on ? ' class="on"' : '') + '>' +
        '<td class="rl' + (kind === 1 ? ' sub' : '') + (kind === 2 ? ' mk' : '') + '">' +
        label + '</td>' + cells.map(function (c) {
          return '<td>' + (c == null ? '' : c) + '</td>';
        }).join('') + '</tr>';
    }

    var W9 = ['13%', '9.5%', '9.5%', '9.5%', '9.5%', '9.5%', '9.5%', '9.5%', '21%'];
    var W8 = ['14%', '11%', '11%', '11%', '11%', '11%', '11%', '20%'];
    /* 가로보 타입은 이음 셋이 붙어 열이 여덟이다. W9 로는 안 들어간다. */
    var WCT = ['9.5%', '11%', '11.5%', '9.5%', '9.5%', '9.5%', '8.5%', '8.5%', '8.5%', '12.5%'];

    /* ---------------- draw the form ---------------- */
    function build() {
      D = derive(V);
      var C = {}, i;

      /* 1 — girder layout. 두 줄이다: 간격 한 줄, 타입 한 줄.
         간격은 왼쪽 내민 길이로 시작해서 칸을 지나 오른쪽 내민 길이로 끝난다 —
         단면을 왼쪽에서 오른쪽으로 훑는 순서 그대로다. 「등간격이냐 칸마다냐」를
         고르게 하던 것은 없앴다: 등간격이면 같은 숫자를 그냥 적으면 되고,
         고르는 칸 하나가 나머지 칸을 열었다 닫았다 하는 것이 더 헷갈렸다.

         칸 수는 거더 수를 따라간다. 거더 수를 숫자로 받지 않고 버튼으로 받는
         까닭은, 이 폼의 다른 라이브러리(거더·가로보·이음)가 이미 그렇게 늘고
         줄기 때문이다 — 같은 일을 하는 자리가 화면마다 다르게 생길 이유가 없다. */
      var nSp = V.ng + 1;                                  // SL · bay 1…n-1 · SR
      var spH = [], spR = [], gH = [], gR = [], cH = [], cR = [];
      spH.push(hd('SL'));
      spR.push(inp('sl', V.sl));
      for (i = 0; i < V.ng - 1; i++) {
        spH.push(hd('Bay ' + (i + 1)));
        spR.push(inp('spl.' + i, D.bay[i]));
      }
      /* 가로보 줄은 한 칸 밀어 놓는다. 그러면 Bay k 가 간격 줄의 Bay k 와
         같은 열에 선다 — 머리글이 있으니 안 밀어도 읽히기는 하지만, 같은 칸을
         가리키는 두 줄이 다른 열에 있으면 눈이 한 번 더 헤맨다. */
      cH.push(''); cR.push('');
      for (i = 0; i < V.ng - 1; i++) {
        cH.push(hd('Bay ' + (i + 1)));
        cR.push(sel('cAsg.' + i, V.cAsg[i], V.ct.map(function (t) { return t.m; }), 'mk'));
      }
      spH.push(hd('SR'));
      spR.push(inp('sr', V.sr));
      for (i = 0; i < V.ng; i++) {
        gH.push(hd('G' + (i + 1)));
        gR.push(sel('gAsg.' + i, V.gAsg[i], V.gt.map(function (t) { return t.m; }), 'mk'));
      }
      /* 열 너비는 거더 수에서 나온다. 아홉 칸에 맞춰 자르면 거더 여덟 개짜리
         다리를 못 적는다 — 폼은 HTML 이라 묶일 이유가 없다 (FORMS.md). */
      var lw = ['15%'], lh = [''], free = 68 / nSp;
      for (i = 0; i < nSp; i++) { lw.push(free.toFixed(2) + '%'); lh.push(''); }
      lw.push('17%'); lh.push('');
      var pad = function (a, n) {
        var b = a.slice(0, n);
        while (b.length < n) b.push('');
        return b;
      };
      C.glayout = chapter(1, 'Layout',
        'girders across the deck, crossbeams between them, and how often along the span',
        'APlate §2.3.4 · §2.3.13',
        { w: lw, h: lh },
        row('', pad(spH, nSp), 1) +
        row('Spacing', pad(spR, nSp).concat([out('Out to out <b>' + D.W + '</b>')]), 2) +
        row('', pad(gH, nSp), 1) +
        row('Girder type', pad(gR, nSp).concat([out('Girder to girder <b>' + D.gw + '</b>')]), 2) +
        row('', pad(cH, nSp), 1) +
        row('Crossbeam', pad(cR, nSp).concat([out('<b>' + (V.ng - 1) + '</b> bay' +
          (V.ng === 2 ? '' : 's') + ' &middot; <b>' + V.ct.length + '</b> types')]), 2),
        'The manual (§2.3.4) asks for SL · L1…L' + V.ng + ' · SR — offsets from the road ' +
        'centre. Here the same line is entered as the gaps between them, left to right, ' +
        'because a gap is what a fabricator sets out; <b>the offsets are drawn below</b> so ' +
        'both readings are on one page. The bays are the same bays twice over — once to be ' +
        'measured, once to be filled — so §2.3.13 (crossbeam position) is <b>the same table, ' +
        'not another one</b>: one more row on the bays that already exist. <b>Pitch</b> is ' +
        'the manual\'s base placing interval (§2.3.13), one number the whole span repeats, ' +
        'from which it places every station. The manual also keeps crossbeams apart <b>by ' +
        'station</b> (§2.4.10: A at the abutments, P over a pier, C for the distributing ' +
        'beams between) — but that is for a whole bridge. <b>This form draws one station.</b> ' +
        'Which one it is, is what you typed above; run it again for the next one.',
        '<span class="k">Girder levels</span> ' +
        (D.level ? '<b>all equal</b> — the soffit is level, so the cross slope is carried by slab thickness'
                 : D.gz.map(function (z, k) { return 'G' + (k + 1) + ' ' + rnd(z, 0); }).join(' / ')),
        { n: 1, wide: 1 },
        /* Pitch 는 칸마다가 아니라 다리마다 하나다. 표 안에 두었더니 열이
           칸을 뜻하는 격자 위에 얹혀서 「칸마다 다른 pitch」처럼 읽혔다 —
           한 번만 적는 값은 격자 밖 한 줄에 둔다.

           「End & pier」 칸은 뺐다. 매뉴얼은 가로보를 위치별(§2.4.10 의 양측단
           A · 교각 P · 분배 C)로 받지만, 그건 다리 한 채를 통째로 모델링하기
           때문이다. 이 폼이 내는 것은 한 군데다 — 단부를 그릴 것이면 단부를
           적어서 한 번, 지점부를 그릴 것이면 지점부를 적어서 한 번. 위치를
           고르는 칸을 두면 폼은 한 군데를 내면서 여러 군데를 내는 척하게 된다.
           있는 것만 있는 채로 둔다. */
        '<div class="qcb-span">' +
          '<label>Crossbeam pitch ' + inp('cPitch', V.cPitch) + '</label>' +
          '<em>one pitch for the whole bridge, not one per bay</em>' +
        '</div>');
      C.glayout += '<div class="qcb-addrow">' +
        '<button type="button" class="qcb-add" data-add="g">+ Add girder</button>' +
        (V.ng > 2 ? '<button type="button" class="qcb-add del" data-del="g"'
          + ' title="Remove the last girder">− Remove last</button>' : '') + '</div>';

      /* 2 — girder type library */
      var gtRows = V.gt.map(function (t, k) {
        return row(t.m, [inp('gt.' + k + '.hw', t.hw), inp('gt.' + k + '.tw', t.tw),
                         inp('gt.' + k + '.bt', t.bt), inp('gt.' + k + '.ttf', t.ttf),
                         inp('gt.' + k + '.bb', t.bb), inp('gt.' + k + '.tbf', t.tbf), null,
                         out('Depth <b>' + D.depth(t) + '</b> &middot; <b>' +
                             rnd(D.kgm(t), 1) + ' kg/m</b>')], 2, 'gt:' + k);
      }).join('');
      C.gtypes = chapter(2, 'Girder types', 'one row is one type — declared here, called by name in Layout',
        /* 기호는 도면이 쓰는 그대로. tw 복부, ttf 상부플랜지, tbf 하부플랜지 —
           「Top t」처럼 자리로 부르면 그림에 적을 이름이 없다. */
        'APlate §2.3.17',
        { w: W9, h: ['', 'Web H', 'tw', 'Top B', 'ttf', 'Btm B', 'tbf', '', ''] },
        gtRows,
        'The same shape as Simple connector\'s connection library: <b>the mark carries no ' +
        'meaning of its own</b>, this row says what it is. So GT1 can be made heavier and ' +
        'every girder that named it is still right. Variable-depth girders — a flange that ' +
        'changes along the span — are a later step; one section runs the whole span here.',
        '', { n: 3 });
      C.gtypes += '<div class="qcb-addrow">' +
        '<button type="button" class="qcb-add" data-add="gt">+ Add girder type</button>' +
        (V.gt.length > 1 ? '<button type="button" class="qcb-add del" data-del="gt"'
          + ' title="Remove the last row">− Remove last</button>' : '') + '</div>';

      /* 3 — stiffener and scallop */
      var thick = V.gt.reduce(function (a, t) { return Math.max(a, t.tbf); }, 0);
      var sc = thick > 16 ? V.scB : V.scA;
      C.stiff = chapter(3, 'Stiffener &amp; scallop', 'left and right, and how the end is cut away',
        'APlate §2.4.13 · §2.4.2',
        { w: W8, h: ['', 'Width W', 'Thk T', 'End cut G', 'Flange gap H', 'Side', 'Pitch', ''] },
        row('Stiffener', [inp('stW', V.stW), inp('stT', V.stT), inp('stG', V.stG), inp('stH', V.stH),
                          sel('stSide', V.stSide, ['Both sides', 'Left only', 'Right only']),
                          inp('stPitch', V.stPitch),
                          out('Slenderness <b>' + rnd(V.stW / V.stT, 1) + '</b>')]) +
        row('Scallop t &le; 16', [inp('scA.0', V.scA[0]), inp('scA.1', V.scA[1]), inp('scA.2', V.scA[2]),
                                  null, null, null, out('a &middot; b &middot; c')], 1) +
        row('Scallop t &gt; 16', [inp('scB.0', V.scB[0]), inp('scB.1', V.scB[1]), inp('scB.2', V.scB[2]),
                                  null, null, null, out('a &middot; b &middot; c')], 1),
        'The manual takes left and right apart — <b>LW/RW · LT/RT · LG/RG · LH/RH</b>, eight ' +
        'cells. <b>Both sides</b> makes that four. The scallop is two sets, split at a parent ' +
        'plate of 16 mm as the manual has it; <b>which set applies is read off the flange, ' +
        'not asked.</b>',
        '<span class="k">In use</span> flange t' + thick + ' &rarr; <b>' +
        (thick > 16 ? 't &gt; 16' : 't &le; 16') + '</b> set (' + sc.join(' · ') + ')', { n: 2 });

      /* 4 — crossbeam type library */
      /* 이음은 자리마다 하나씩 — 세 칸이다. 매뉴얼은 기호를 한 벌 정해 두고
         접두사로 여러 판에 붙인다 (§2.4.9: u 상부 · d 하부 · s 복부). 세 칸이
         형상마다 다르게 읽히는 것이 이 짜임의 값이다:

           트러스 — 상현재 · 하현재 · 사재가 각각 거셋에 붙는다
           형강   — 상부플랜지 · 하부플랜지 · 복부가 각각 이음판으로 붙는다

         같은 세 자리, 같은 세 이름. 그래서 라이브러리 하나가 둘 다 섬긴다.
         「—」를 고르면 그 자리는 볼트로 안 붙는다 — 수직보강재연결처럼 복부
         하나만 붙는 형상이 있는데, 그걸 코드가 정하지 않고 시트가 정한다. */
      var bcMarks = [NONE].concat(V.bc.map(function (q) { return q.m; }));
      var ctRows = V.ct.map(function (t, k) {
        var tr = isTruss(t.f), n = 0;
        ['cu', 'cd', 'cs'].forEach(function (q) { if (D.bcOf(t[q])) n++; });
        return row(t.m, [sel('ct.' + k + '.f', t.f, FORMS),
                         tr ? inp('ct.' + k + '.s', NONE, true) : sel('ct.' + k + '.s', t.s, BEAMS),
                         tr ? sel('ct.' + k + '.u', t.u, ANGLES) : inp('ct.' + k + '.u', NONE, true),
                         tr ? sel('ct.' + k + '.l', t.l, ANGLES) : inp('ct.' + k + '.l', NONE, true),
                         tr ? sel('ct.' + k + '.d', t.d, ANGLES) : inp('ct.' + k + '.d', NONE, true),
                         sel('ct.' + k + '.cu', t.cu, bcMarks, 'mk'),
                         sel('ct.' + k + '.cd', t.cd, bcMarks, 'mk'),
                         sel('ct.' + k + '.cs', t.cs, bcMarks, 'mk'),
                         out((tr ? 'truss' : 'solid') + ' &middot; <b>' + n + '</b> ' +
                             (tr ? (n === 1 ? 'set' : 'sets') : (n === 1 ? 'plate' : 'plates')))],
                   2, 'ct:' + k);
      }).join('');
      C.ctypes = chapter(4, 'Crossbeam types',
        'one row is one type — and each of its three positions names a connection',
        'APlate §2.4.10 · §2.4.11 · §2.4.9',
        { w: WCT, h: ['', 'Form', 'Section', 'Top chord', 'Btm chord', 'Diagonal',
                      'Conn <b>u</b>&middot;top', 'Conn <b>d</b>&middot;btm',
                      'Conn <b>s</b>&middot;web', ''] },
        ctRows +
        /* 매뉴얼의 「단면배치」다 (§2.4.10). 배치 장이 아니라 가로보 상세 장에
           있는 항목이라 여기 둔다 — 매뉴얼이 어디서 받는지가 그 값이 무엇에
           딸린 것인지를 말해 준다. 원문: "편경사에 의해서 좌우의 단차가 발생할
           경우 가로보의 배치 형상에 따른 설정 옵션을 선택하는 곳입니다.
           수평을 선택할 경우 낮은쪽에 맞춰서 자동으로 변경됩니다." */
        row('Section arrangement', [sel('cSeat', V.cSeat, ['Sloped', 'Level']),
          null, null, null, null, null, null, null,
          out(D.level ? 'No step &mdash; soffit level'
                      : (V.cSeat === 'Level' ? 'Set to the lower girder' : 'Follows the step'))], 1),
        'The manual keeps these on two screens: <b>§2.4.10, the crossbeam</b> is one solid member — ' +
        'rolled beam, built-up plate, or connected straight to the stiffener — and ' +
        '<b>§2.4.11, the vertical bracing</b> is a truss of angles, V or inverted V. A bay picks exactly ' +
        'one of the five, so they share one library. <b>Pick a solid form and the chord cells ' +
        'go quiet; pick a truss and the section cell does.</b> ' +
        '<b>One connection became three.</b> The manual gives the nine symbols once and then ' +
        'applies them with a <b>prefix</b> (&sect;2.4.9): <b>u</b> the upper splice plate, ' +
        '<b>d</b> the lower, <b>s</b> the web plate. The three columns read differently by ' +
        'form and that is the point &mdash; a truss bolts its top chord, bottom chord and ' +
        'diagonal to a gusset; a solid beam splices its top flange, bottom flange and web. ' +
        '<b>Same three positions, same three names</b>, so one library serves both. Set a ' +
        'position to <b>&mdash;</b> and nothing is bolted there. <b>Section arrangement</b> is the ' +
        'manual\'s own cell on this same screen (&sect;2.4.10, "section arrangement"): when the ' +
        'cross slope leaves the two girders at different heights, sit the crossbeam ' +
        '<b>sloped</b>, or <b>level</b> &mdash; which the manual says it then sets automatically ' +
        'to the lower girder. <b>It belongs to the type, not to the layout</b>, and that is ' +
        'where the manual keeps it.',
        '', { n: 4 });
      C.ctypes += '<div class="qcb-addrow">' +
        '<button type="button" class="qcb-add" data-add="ct">+ Add crossbeam type</button>' +
        (V.ct.length > 1 ? '<button type="button" class="qcb-add del" data-del="ct"'
          + ' title="Remove the last row">− Remove last</button>' : '') + '</div>';

      /* the bolted connection — what makes it a shop drawing rather than a
         stick model. Ten cells, one row; the manual's own symbols. */
      var W11 = ['7%', '7.5%', '7.5%', '8%', '7.5%', '7.5%', '7%', '7.5%', '7.5%', '7%', '7%',
                 '19%'];
      var bcRows = V.bc.map(function (b, k) {
        var q = D.bcChk(b);
        return row(b.m, [inp('bc.' + k + '.T', b.T), inp('bc.' + k + '.W', b.W),
                         sel('bc.' + k + '.dia', b.dia, BOLTS), inp('bc.' + k + '.len', b.len),
                         inp('bc.' + k + '.B', b.B), inp('bc.' + k + '.C', b.C),
                         inp('bc.' + k + '.C1', b.C1),
                         inp('bc.' + k + '.E', b.E), inp('bc.' + k + '.F', b.F),
                         inp('bc.' + k + '.A', b.A),
                         out('<b>' + q.nB + '</b>&times;<b>' + q.nE + '</b> = <b>' + q.n +
                             '</b> bolts &middot; ' +
                             (q.edgeOK && q.fitOK ? 'fits' : 'check below'))], 2, 'bc:' + k);
      }).join('');
      C.conn = chapter(0, 'Bolted connection', 'the bolt group a crossbeam position calls by name',
        'APlate §2.4.9',
        { w: W11, h: ['', 'Plate T', 'Plate W', 'Bolt', 'Length L', 'Spaces B', 'Pitch C',
                      'Centre C1', 'Spaces E', 'Gauge F', 'Edge A', ''] },
        bcRows,
        'The symbols are the manual\'s own (§2.4.9), <b>and so is what they mean</b>: <b>A</b> ' +
        'the distance from the outermost bolt to the edge, <b>B</b> and <b>C</b> the ' +
        'number of bolt <b>spaces</b> and their pitch one way, <b>C1</b> the wider gap at the ' +
        'joint centre, <b>E</b> and <b>F</b> the spaces and gauge the other way, <b>T</b> and ' +
        '<b>W</b> the plate, <b>L</b> the bolt. <b>B and E count spaces, not bolts</b> — the ' +
        'manual dimensions the run as <b>sA · sB@sC · sC1</b>, <i>B spaces at C</i>, so ' +
        '<b>B = 1</b> is two bolts. The out cell shows what it works out to. Leave <b>C1</b> at ' +
        '<b>0</b> for one plain run; set it and the run splits either side of the joint, ' +
        'giving 2(B+1) a line. It is a library of its own because a field splice is described ' +
        'by exactly these ten numbers too, and the manual says so itself — <i>every splice ' +
        'plate shares one symbol set, field splice and crossbeam alike</i>. <b>One ' +
        'description, two users.</b> A crossbeam position names one of these, and ' +
        '<b>the drawing below counts and spaces the bolts from here</b>, so a wrong number ' +
        'shows rather than hides.',
        V.bc.map(function (b) {
          var q = D.bcChk(b);
          return '<span class="k">' + esc(b.m) + '</span> ' + q.n + '&times;' +
                 esc(b.dia) + ' &middot; run ' + q.run + ' &middot; edge A ' + b.A +
                 (q.edgeOK ? ' &ge; ' + q.need + ' OK' : ' &lt; ' + q.need + ' SHORT') +
                 ' &middot; across ' + q.across + ' in W ' + b.W + ' leaves ' + rnd(q.edgeW, 0) +
                 (q.fitOK ? ' OK' : ' TOO NARROW');
        }).join(''), { n: 5 });
      C.conn += '<div class="qcb-addrow">' +
        '<button type="button" class="qcb-add" data-add="bc">+ Add connection</button>' +
        (V.bc.length > 1 ? '<button type="button" class="qcb-add del" data-del="bc"'
          + ' title="Remove the last row">− Remove last</button>' : '') + '</div>';

      /* 「Crossbeam layout」 장은 없앴다. 받던 넷이 다 다른 데로 갔다:
         칸마다의 타입과 Pitch 는 1장 Layout 으로 — 칸은 이미 거기 있고, 같은
         칸을 두 장에서 두 번 세는 것은 입력을 늘리는 게 아니라 어긋날 자리를
         늘리는 것이다. 「단면배치(Seating)」는 4장 Crossbeam types 로 —
         매뉴얼이 §2.4.10 가로보 상세에서 받는 값이다. 「End & pier」는 어디로도
         안 갔다: 이 폼은 한 군데를 내므로 위치를 고를 일이 없다. */

      /* 5 — deck slab */
      C.slab = chapter(6, 'Deck slab', 'left and right slopes — and whether the soffit stays level',
        'APlate §2.3.20',
        { w: W9, h: ['', 'Slope left', 'Slope right', 'Soffit', 'Base t', 'Edge T1', 'Edge T2', 'Haunch', ''] },
        row('Slab', [inp('slopeL', V.slopeL), inp('slopeR', V.slopeR),
                     sel('soffit', V.soffit, ['Level', 'Follows slope']),
                     inp('T', V.T), inp('T1', V.T1), inp('T2', V.T2), inp('hh', V.hh),
                     out('Area <b>' + rnd(D.slabA, 2) + ' m&sup2;</b>')]) +
        row('And', [sel('crown', V.crown, ['Road centre', 'From left edge']), null, null,
                    hd('Pavement'), inp('pav', V.pav), hd('Overhang'), inp('ovh', V.ovh),
                    out('Crown t <b>' + rnd(D.crownT, 0) + '</b>')], 1),
        'Both slopes are taken, so <b>−2 / −2 is a roof</b> about the crown and a sign change ' +
        'makes it fall one way. <b>Soffit</b> is the cell that matters: on a roof the soffit is ' +
        'normally <b>level</b>, so every girder sits at one height and the slab thickens toward ' +
        'the crown; let it <b>follow the slope</b> and the girders step down instead. The manual ' +
        'calls this "level applied from the road centre" and says it is what makes the girder elevations differ. ' +
        '<b>Concrete is drawn as a section only</b> — it is reported by area, never weighed as steel.',
        '<span class="k">Slab</span> crown ' + rnd(D.crownT, 0) + ' / edges ' + V.T1 + ' &middot; ' + V.T2 +
        ' &nbsp; <span class="k">Fall</span> ' + rnd(D.dropL, 0) + ' left / ' + rnd(D.dropR, 0) + ' right', { n: 6 });

      /* 7 — barrier */
      C.barrier = chapter(7, 'Barrier', 'a section only, like the slab', 'APlate §2.3.21',
        { w: W8, h: ['', 'H1', 'H2', 'H3', 'Top width', 'Btm width', 'Sides', ''] },
        row('Barrier', [inp('bh1', V.bh1), inp('bh2', V.bh2), inp('bh3', V.bh3),
                        inp('bwt', V.bwt), inp('bwb', V.bwb),
                        sel('bSym', V.bSym ? 'Symmetric' : 'Each side', ['Symmetric', 'Each side']),
                        out('Area <b>' + rnd(D.barA, 2) + ' m&sup2;</b>')]),
        'Unlock <b>Each side</b> when the two are not the same.', '', { n: 7 });

      /* 8 — material */
      C.material = chapter(8, 'Material', '', 'engine change pending',
        { w: W8, h: ['', 'Steel', 'Concrete', '', '', '', '', ''] },
        row('Material', [sel('matS', V.matS, STEELS), sel('matC', V.matC, CONCS),
                         null, null, null, null,
                         out('Concrete <b>' + rnd((D.slabA + D.barA * 2), 2) + ' m&sup2;</b> section')]),
        'The engine has one density — <code>RHO = 7.85e-6</code> — and <code>MAT</code> is a ' +
        'label beside it. <b>So concrete cannot be weighed yet</b>, and this form reports it by ' +
        'area rather than pretending. Teaching the engine a second density is a change to the ' +
        'engine, and that is asked for separately.', '');

      /* 순서는 시트의 순서다 — 정의가 먼저 오고, 그것을 이름으로 부르는
         배치가 뒤에 온다. 타입을 안 만들어 두고 거더에 붙이라고 하면 고를
         것이 없다. 번호는 %N% 가 이 배열 순서대로 채운다. */
      var n = 0;
      var H = [C.gtypes, C.ctypes, C.conn, C.stiff,
               C.glayout,
               C.slab, C.barrier, C.material].join('')
              .replace(/%N%/g, function () { return ++n; });
      body.innerHTML = H;
      draw();
      say(V.ng + ' girders · ' + (V.ng - 1) + (V.ng === 2 ? ' bay' : ' bays') +
          ' · out to out ' + D.W);
    }

    function say(t, bad) { status.textContent = t; status.className = bad ? 'bad' : ''; }

    /* ---------------- the drawing ----------------
       The section is drawn from the same V the form holds, so there is no second
       description of the bridge to fall out of step. */
    function draw() {
      /* 작아지는 것은 「그림」이지 「글씨」가 아니다. SVG 를 1:1 로 세워 두었으므로
         (width 속성 = viewBox 폭) 좌표를 줄이면 도형만 줄고 font-size 는 그대로
         픽셀이다. 화면을 덜 먹으면서 읽히는 자리가 여기다 — 통째로 축소하면
         글씨까지 같이 작아져서 결국 못 읽는다. */
      /* 이 장이 받는 것은 「거더가 어디에 있느냐」뿐이다 — 매뉴얼 §2.3.4 도
         도로중심에서 잰 SL · L1…Ln · SR 만 받는다. 슬래브 두께·포장·마루·
         방호벽은 7·8장 것이고 거기에 제 그림이 따로 있다. 여기까지 같이
         그리면 이 장이 정하지 않는 것을 이 장이 정하는 것처럼 보인다.
         남긴 것은 거더가 매달리는 슬래브 밑면 한 줄 — 높이를 어디서 재는지는
         보여야 하고, 그 줄은 여기서 정하는 게 아니라 7장에서 따라온다. */
      var w = 900, SC, i;
      var span = D.W * 1.06;
      SC = (w - 56) / span;
      var sL = V.slopeL / 100, sR = V.slopeR / 100;
      var top = function (m) { return m < 0 ? -(-m) * sL : -m * sR; };  // slab top, crown at 0
      var botZ = D.level ? (top(-D.half) - V.T1) : null;
      var sof = function (m) { return D.level ? botZ : (top(m) - V.T1); };
      /* 위쪽 여백은 세는 것이 아니라 재는 것이다 — 편경사가 커지면 밑면이
         기울고, 그만큼 원점이 따라 움직인다. */
      var mTop = Math.max(sof(-D.half), sof(0), sof(D.half));
      var x0 = w / 2, y0 = rnd(30 + mTop * SC, 1);
      var X = function (m) { return rnd(x0 + m * SC, 1); };
      var Y = function (m) { return rnd(y0 - m * SC, 1); };
      var g = [];

      /* 슬래브 밑면 — 거더가 매달리는 줄. 파선으로 긋는다: 이 장의 입력이
         아니라는 뜻이다. */
      g.push('<path d="M ' + X(-D.half) + ' ' + Y(sof(-D.half)) + ' L ' + X(0) + ' ' +
             Y(sof(0)) + ' L ' + X(D.half) + ' ' + Y(sof(D.half)) +
             '" stroke="#38bdf8" stroke-width="1.4" stroke-dasharray="9 4" fill="none"/>');
      g.push('<text x="' + X(-D.half) + '" y="' + (Y(sof(-D.half)) - 8) + '" fill="#7dd3fc"' +
             ' font-size="10">slab soffit &middot; ' + esc(V.soffit).toLowerCase() +
             ' &middot; haunch ' + V.hh + '</text>');

      /* girders, each drawn as the type it was given */
      var yTop = [], yBot = [];
      D.gx.forEach(function (gx, k) {
        var t = D.gtOf(k);
        var yT = sof(gx) - V.hh;
        yTop.push(yT);
        g.push('<line x1="' + X(gx) + '" y1="' + Y(sof(gx)) + '" x2="' + X(gx) + '" y2="' +
               Y(yT) + '" stroke="#64748b" stroke-width="1" stroke-dasharray="2 2"/>');
        var yB = yT - t.ttf - t.hw - t.tbf;
        var P = function (x, y) { return X(x) + ' ' + Y(y); };
        var col = V.gAsg[k] === V.gt[0].m ? '#cbd5e1' : '#fbbf24';
        g.push('<path d="M ' + P(gx - t.bt / 2, yT) + ' L ' + P(gx + t.bt / 2, yT) +
          ' L ' + P(gx + t.bt / 2, yT - t.ttf) + ' L ' + P(gx + t.tw / 2, yT - t.ttf) +
          ' L ' + P(gx + t.tw / 2, yB + t.tbf) + ' L ' + P(gx + t.bb / 2, yB + t.tbf) +
          ' L ' + P(gx + t.bb / 2, yB) + ' L ' + P(gx - t.bb / 2, yB) +
          ' L ' + P(gx - t.bb / 2, yB + t.tbf) + ' L ' + P(gx - t.tw / 2, yB + t.tbf) +
          ' L ' + P(gx - t.tw / 2, yT - t.ttf) + ' L ' + P(gx - t.bt / 2, yT - t.ttf) +
          ' Z" fill="' + col + '" stroke="#e2e8f0" stroke-width="1"/>');
        g.push('<text x="' + X(gx) + '" y="' + (Y(yB) + 20) + '" fill="#f59e0b" font-size="12"' +
               ' font-weight="700" text-anchor="middle">G' + (k + 1) + '</text>');
        g.push('<text x="' + X(gx) + '" y="' + (Y(yB) + 34) + '" fill="#94a3b8" font-size="10"' +
               ' text-anchor="middle">' + esc(V.gAsg[k]) + '</text>');
        yBot.push(Y(yB));
      });

      /* crossbeams, each drawn as the form its bay was given */
      for (i = 0; i < V.ng - 1; i++) {
        var ta = D.gtOf(i), tb2 = D.gtOf(i + 1);
        var a = D.gx[i], b2 = D.gx[i + 1], mid = (a + b2) / 2;
        var yA = yTop[i] - ta.ttf, yB2 = yTop[i + 1] - tb2.ttf;
        var baA = yA - ta.hw, baB = yB2 - tb2.hw;
        var ct = D.ctOf(i);
        var ln = function (x1, y1, x2, y2, c, wd) {
          g.push('<line x1="' + X(x1) + '" y1="' + Y(y1) + '" x2="' + X(x2) + '" y2="' + Y(y2) +
                 '" stroke="' + c + '" stroke-width="' + wd + '" stroke-linecap="round"/>');
        };
        if (!isTruss(ct.f)) {
          ln(a + 70, (yA + baA) / 2, b2 - 70, (yB2 + baB) / 2, '#22d3ee', 10);
        } else {
          var tcA = yA - 160, tcB = yB2 - 160, bcA = baA + 160, bcB = baB + 160;
          ln(a + 70, tcA, b2 - 70, tcB, '#22d3ee', 3.2);
          ln(a + 70, bcA, b2 - 70, bcB, '#0e7490', 3.2);
          if (ct.f === 'V frame') {
            var ap = (bcA + bcB) / 2;
            ln(a + 70, tcA, mid, ap, '#22d3ee', 3.2); ln(b2 - 70, tcB, mid, ap, '#22d3ee', 3.2);
            g.push('<circle cx="' + X(mid) + '" cy="' + Y(ap) + '" r="3.5" fill="#a78bfa"/>');
          } else {
            var tp = (tcA + tcB) / 2;
            ln(a + 70, bcA, mid, tp, '#22d3ee', 3.2); ln(b2 - 70, bcB, mid, tp, '#22d3ee', 3.2);
            g.push('<circle cx="' + X(mid) + '" cy="' + Y(tp) + '" r="3.5" fill="#a78bfa"/>');
          }
        }
        g.push('<text x="' + X(mid) + '" y="' + (Y((baA + baB) / 2) + 26) + '" fill="#a78bfa"' +
               ' font-size="10" text-anchor="middle">' + esc(V.cAsg[i]) + '</text>');
      }

      /* Dimension string. Placed in SCREEN space, not model space: the girders
         are 1.8 m deep and the deck 12.4 m wide, so a line put a fixed number of
         millimetres under the steel lands outside the picture as soon as the
         scale changes. Two rows under the marks, always visible.
         자리는 강재가 어디까지 내려왔는지를 보고 잡는다 — 402 처럼 박아 두면
         거더가 깊어지는 날 치수선이 거더 위에 얹힌다. */
      var deep = Math.max.apply(null, yBot);
      var dimY1 = rnd(deep + 52, 0), dimY2 = dimY1 + 20;
      var dim = function (x1, x2, sy, t) {
        g.push('<line x1="' + X(x1) + '" y1="' + sy + '" x2="' + X(x2) + '" y2="' + sy +
          '" stroke="#ef4444" stroke-width="1"/><line x1="' + X(x1) + '" y1="' + (sy - 5) +
          '" x2="' + X(x1) + '" y2="' + (sy + 5) + '" stroke="#ef4444"/><line x1="' + X(x2) +
          '" y1="' + (sy - 5) + '" x2="' + X(x2) + '" y2="' + (sy + 5) + '" stroke="#ef4444"/>' +
          '<text x="' + ((X(x1) + X(x2)) / 2) + '" y="' + (sy - 6) + '" fill="#fca5a5"' +
          ' font-size="11" text-anchor="middle">' + t + '</text>');
      };
      dim(-D.half, D.gx[0], dimY1, V.sl);
      for (i = 0; i < V.ng - 1; i++) dim(D.gx[i], D.gx[i + 1], dimY1, D.bay[i]);
      dim(D.gx[V.ng - 1], D.half, dimY1, V.sr);
      dim(-D.half, D.half, dimY2, 'out to out ' + D.W);

      /* 매뉴얼 §2.3.4 의 방식 — 도로중심에서 각 거더 중심까지의 이격을
         계단으로 쌓아 보인다. 「−」가 왼쪽, 「+」가 오른쪽이라는 것까지 매뉴얼
         그대로다. 표는 「사이 간격」으로 받고 그림은 「중심 이격」으로도 보인다 —
         같은 한 줄을 두 가지로 읽는 것이고, 매뉴얼을 든 사람이 제 숫자를
         여기서 찾을 수 있어야 한다. */
      var oy = dimY2 + 22, step = 12, h = rnd(oy + step * (V.ng + 1) + 12, 0);
      g.push('<line x1="' + X(0) + '" y1="' + (Y(0) + 6) + '" x2="' + X(0) + '" y2="' +
        (oy + step * (V.ng + 1)) + '" stroke="#fbbf24" stroke-width="1" stroke-dasharray="3 3"/>');
      var offs = [{ x: -D.half, t: 'SL' }];
      D.gx.forEach(function (gx, k) { offs.push({ x: gx, t: 'L' + (k + 1) }); });
      offs.push({ x: D.half, t: 'SR' });
      offs.sort(function (a2, b2) { return Math.abs(a2.x) - Math.abs(b2.x); });
      offs.forEach(function (o, k) {
        var sy = oy + k * step;
        g.push('<line x1="' + X(0) + '" y1="' + sy + '" x2="' + X(o.x) + '" y2="' + sy +
          '" stroke="#a78bfa" stroke-width="1"/><line x1="' + X(o.x) + '" y1="' + (sy - 4) +
          '" x2="' + X(o.x) + '" y2="' + (sy + 4) + '" stroke="#a78bfa"/>');
        g.push('<text x="' + (X(o.x) + (o.x < 0 ? -6 : 6)) + '" y="' + (sy + 4) +
          '" fill="#c4b5fd" font-size="10" text-anchor="' + (o.x < 0 ? 'end' : 'start') + '">' +
          o.t + ' ' + (o.x < 0 ? '&minus;' : (o.x > 0 ? '+' : '')) + rnd(Math.abs(o.x), 0) +
          '</text>');
      });
      g.push('<text x="' + X(0) + '" y="' + (oy - 8) + '" fill="#fbbf24" font-size="10"' +
        ' font-weight="700" text-anchor="middle">road centre</text>');

      wrap.querySelector('#qcb-d1').innerHTML =
        '<svg width="' + w + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet">' +
        g.join('') + '</svg>';
      wrap.querySelector('#qcb-cap1').innerHTML =
        V.ng + ' girders &middot; ' + V.sl + ' / ' + D.bay.join(' / ') + ' / ' + V.sr +
        ' &middot; out to out <b>' + D.W + '</b> &middot; girder to girder <b>' + D.gw +
        '</b>. Slab, pavement and barrier have chapters of their own &mdash; only the soffit ' +
        'they set is drawn here, as the line the girders hang from.';

      drawGirder();
      drawCross();
      drawBolt();
      drawStiff();
      drawSlab();
      drawBarrier();
    }

    /* ---- 기호 붙이기. 표의 머리글에 적은 글자를 그림에 그대로 쓴다.
       칸과 그림을 잇는 것은 그 글자 하나뿐이므로, 다르게 쓰면 안 이어진다. ---- */
    function sym(g, x, y, t, col) {
      g.push('<text x="' + x + '" y="' + y + '" fill="' + (col || '#fbbf24') +
        '" font-size="11" font-weight="700">' + t + '</text>');
    }

    /* ---- 치수 사슬. 마디마다 tick 을 긋고 마디 가운데에 글자를 놓는다.
       좌표는 화면 좌표로 받는다 — 축척이 바뀌어도 자리가 안 무너진다.
       좁은 마디는 글자를 생략한다: 겹쳐 적은 치수는 안 적은 것보다 나쁘고,
       생략해도 전체 치수에서 되읽힌다. ---- */
    function chainH(g, sy, px, labs) {
      g.push('<line x1="' + px[0] + '" y1="' + sy + '" x2="' + px[px.length - 1] +
        '" y2="' + sy + '" stroke="#ef4444" stroke-width="1"/>');
      px.forEach(function (x) {
        g.push('<line x1="' + x + '" y1="' + (sy - 4) + '" x2="' + x + '" y2="' +
          (sy + 4) + '" stroke="#ef4444"/>');
      });
      labs.forEach(function (t, i) {
        if (t == null || Math.abs(px[i + 1] - px[i]) < 22) return;
        g.push('<text x="' + ((px[i] + px[i + 1]) / 2) + '" y="' + (sy - 5) +
          '" fill="#fca5a5" font-size="10" text-anchor="middle">' + t + '</text>');
      });
    }
    function chainV(g, sx, py, labs) {
      g.push('<line x1="' + sx + '" y1="' + py[0] + '" x2="' + sx + '" y2="' +
        py[py.length - 1] + '" stroke="#ef4444" stroke-width="1"/>');
      py.forEach(function (y) {
        g.push('<line x1="' + (sx - 4) + '" y1="' + y + '" x2="' + (sx + 4) + '" y2="' + y +
          '" stroke="#ef4444"/>');
      });
      labs.forEach(function (t, i) {
        if (t == null || Math.abs(py[i + 1] - py[i]) < 13) return;
        g.push('<text x="' + (sx + 5) + '" y="' + ((py[i] + py[i + 1]) / 2 + 4) +
          '" fill="#fca5a5" font-size="10">' + t + '</text>');
      });
    }

    /* ---- 주거더 형상. 1장에서 적은 여섯 숫자가 무엇을 정하는지 한 장으로. ---- */
    function drawGirder() {
      var t = V.gt[Math.min(ACT.gt, V.gt.length - 1)], w = 250, h = 268;
      var SC = 196 / Math.max(D.depth(t), 1);
      var x0 = 78, y0 = 232;
      var X = function (m) { return rnd(x0 + m * SC, 1); };
      var Y = function (m) { return rnd(y0 - m * SC, 1); };
      var P = function (x, y) { return X(x) + ' ' + Y(y); };
      var yB = 0, yT = t.tbf + t.hw + t.ttf, g = [];
      g.push('<path d="M ' + P(-t.bt / 2, yT) + ' L ' + P(t.bt / 2, yT) +
        ' L ' + P(t.bt / 2, yT - t.ttf) + ' L ' + P(t.tw / 2, yT - t.ttf) +
        ' L ' + P(t.tw / 2, yB + t.tbf) + ' L ' + P(t.bb / 2, yB + t.tbf) +
        ' L ' + P(t.bb / 2, yB) + ' L ' + P(-t.bb / 2, yB) +
        ' L ' + P(-t.bb / 2, yB + t.tbf) + ' L ' + P(-t.tw / 2, yB + t.tbf) +
        ' L ' + P(-t.tw / 2, yT - t.ttf) + ' L ' + P(-t.bt / 2, yT - t.ttf) +
        ' Z" fill="#cbd5e1" stroke="#e2e8f0" stroke-width="1.2"/>');
      /* 치수선의 x 는 화면 좌표로 잡는다. 모델 단위로 밀어 두면 단면이 바뀔
         때마다 두 줄이 서로 붙거나 그림 밖으로 나간다 — 한 번 겪었다. */
      var dv = function (sx, y1, y2, s) {
        g.push('<line x1="' + sx + '" y1="' + Y(y1) + '" x2="' + sx + '" y2="' + Y(y2) +
          '" stroke="#ef4444" stroke-width="1"/><line x1="' + (sx - 4) + '" y1="' + Y(y1) +
          '" x2="' + (sx + 4) + '" y2="' + Y(y1) + '" stroke="#ef4444"/><line x1="' + (sx - 4) +
          '" y1="' + Y(y2) + '" x2="' + (sx + 4) + '" y2="' + Y(y2) + '" stroke="#ef4444"/>' +
          '<text x="' + (sx + 6) + '" y="' + ((Y(y1) + Y(y2)) / 2 + 4) +
          '" fill="#fca5a5" font-size="10">' + s + '</text>');
      };
      var dh = function (x1, x2, y, s) {
        g.push('<line x1="' + X(x1) + '" y1="' + y + '" x2="' + X(x2) + '" y2="' + y +
          '" stroke="#ef4444" stroke-width="1"/><text x="' + ((X(x1) + X(x2)) / 2) + '" y="' +
          (y - 5) + '" fill="#fca5a5" font-size="10" text-anchor="middle">' + s + '</text>');
      };
      var edge = X(Math.max(t.bt, t.bb) / 2);
      dv(edge + 22, yB + t.tbf, yT - t.ttf, 'H ' + t.hw);
      dv(edge + 72, yB, yT, 'depth ' + D.depth(t));
      dh(-t.bt / 2, t.bt / 2, Y(yT) - 14, 'B ' + t.bt);
      dh(-t.bb / 2, t.bb / 2, Y(yB) + 26, 'B ' + t.bb);
      g.push('<text x="' + X(t.tw / 2 + 60) + '" y="' + Y(yT / 2) +
        '" fill="#94a3b8" font-size="10">tw ' + t.tw + '</text>');
      /* 플랜지 두께는 왼쪽에 적는다. 오른쪽은 H·depth 치수선 자리라, 거기
         같이 두면 글자가 치수선을 타고 넘는다. */
      g.push('<text x="' + X(-t.bt / 2 - 10) + '" y="' + (Y(yT - t.ttf / 2) + 4) +
        '" fill="#94a3b8" font-size="10" text-anchor="end">ttf ' + t.ttf + '</text>');
      g.push('<text x="' + X(-t.bb / 2 - 10) + '" y="' + (Y(yB + t.tbf / 2) + 4) +
        '" fill="#94a3b8" font-size="10" text-anchor="end">tbf ' + t.tbf + '</text>');
      wrap.querySelector('#qcb-d3').innerHTML =
        '<svg width="' + w + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet">' +
        g.join('') + '</svg>';
      var used = [];
      V.gAsg.forEach(function (m, k) { if (m === t.m) used.push('G' + (k + 1)); });
      wrap.querySelector('#qcb-cap3').innerHTML =
        '<b>' + esc(t.m) + '</b> &middot; ' + rnd(D.kgm(t), 1) + ' kg/m &middot; used by ' +
        (used.length ? used.join(', ') : '&mdash; nothing yet');
    }

    /* ---- 3장 볼트 연결. 연결판 한 장에 볼트를 「배치 그대로」 찍고, 그 위아래로
       주요 치수를 사슬로 건다. 매뉴얼 §2.4.9 의 기호를 그림에 그대로 얹는다 —
       표에 A·B·C·E·F·T·W 라고 적어 두고 그림에 안 적으면 아무도 못 잇는다.

       치수 두 벌을 건다. 안쪽 사슬은 「어떻게 나뉘는가」(연단 · F · 연단 /
       A · C · A), 바깥 한 줄은 「전부 얼마인가」(W, 판 높이). 도면이 하는 방식이고,
       하나만 적으면 나머지를 손으로 빼야 한다. ---- */
    function drawBolt() {
      var b = V.bc[Math.min(ACT.bc, V.bc.length - 1)], q = D.bcChk(b);
      var pw = b.W, ph = q.run;                 // 판 폭 · 판 길이(사슬이 정한다)
      /* 판이 들어갈 상자를 픽셀로 먼저 정하고 축척은 거기서 나온다. 상자를
         줄이면 그림만 줄고 글씨는 그대로다. */
      var SC = Math.min(150 / Math.max(pw, 1), 170 / Math.max(ph, 1));
      var pxW = pw * SC, pxH = ph * SC;
      var x0 = 30, yT = 70, w = 300, h = rnd(yT + pxH + 40, 0);
      var X = function (m) { return rnd(x0 + m * SC, 1); };
      var Y = function (m) { return rnd(yT + pxH - m * SC, 1); };
      var g = [], i;
      /* 판 */
      g.push('<rect x="' + X(0) + '" y="' + rnd(yT, 1) + '" width="' + rnd(pxW, 1) +
        '" height="' + rnd(pxH, 1) + '" fill="#a78bfa" fill-opacity="0.26"' +
        ' stroke="#c4b5fd" stroke-width="1.2"/>');
      /* 볼트 자리. 세로는 A 에서 시작해 B 칸을 C 로 걷고, C1 이 있으면 그
         틈을 넘어 다시 B 칸을 걷는다 — 매뉴얼의 sA · sB@sC · sC1 그대로다.
         가로는 E 칸을 F 로 걷고, 그 군을 판 폭 가운데에 놓는다. */
      var cy = [], m = b.A;
      for (i = 0; i <= b.B; i++) cy.push(b.A + i * b.C);
      if (b.C1 > 0) {
        m = b.A + b.B * b.C + b.C1;
        for (i = 0; i <= b.B; i++) cy.push(m + i * b.C);
      }
      var gx0 = (pw - q.across) / 2, cx = [];
      for (i = 0; i <= b.E; i++) cx.push(gx0 + i * b.F);
      var r = Math.max(2.2, q.d / 2 * SC);
      /* 중심선 먼저. 배치가 보이려면 중심선이 있어야 한다 — 구멍만 찍어 두면
         어디를 기준으로 잰 치수인지가 그림에 없다. */
      cx.forEach(function (v) {
        g.push('<line x1="' + X(v) + '" y1="' + rnd(yT - 8, 1) + '" x2="' + X(v) + '" y2="' +
          rnd(yT + pxH + 8, 1) + '" stroke="#8b5cf6" stroke-width="0.7"' +
          ' stroke-dasharray="7 2 1.5 2"/>');
      });
      cy.forEach(function (v) {
        g.push('<line x1="' + (X(0) - 8) + '" y1="' + Y(v) + '" x2="' + (X(pw) + 8) +
          '" y2="' + Y(v) + '" stroke="#8b5cf6" stroke-width="0.7"' +
          ' stroke-dasharray="7 2 1.5 2"/>');
      });
      /* 이음 중심 — C1 이 있을 때만. 어디가 「중앙부」인지가 보여야 한다. */
      if (b.C1 > 0) {
        var mid = b.A + b.B * b.C + b.C1 / 2;
        g.push('<line x1="' + (X(0) - 12) + '" y1="' + Y(mid) + '" x2="' + (X(pw) + 12) +
          '" y2="' + Y(mid) + '" stroke="#fbbf24" stroke-width="1" stroke-dasharray="4 3"/>');
      }
      cx.forEach(function (mx) {
        cy.forEach(function (my) {
          g.push('<circle cx="' + X(mx) + '" cy="' + Y(my) + '" r="' + rnd(r, 1) +
            '" fill="#1e1b4b" stroke="#ddd6fe" stroke-width="1.3"/>');
        });
      });
      /* 사슬은 매뉴얼의 표기를 그대로 쓴다 — 「B@C」, 즉 B칸 @ C간격. 같은
         치수를 칸마다 되풀이해 적으면 글자가 서로 밀어내고, 그러면 좁은 마디는
         생략되어 결국 아무 숫자도 안 남는다. 한 번 적으면 다 읽힌다. */
      var px = [X(0), X(gx0), X(gx0 + q.across), X(pw)];
      chainH(g, yT - 11, px,
        [rnd(q.edgeW, 0), 'E ' + b.E + ' @ F ' + b.F, rnd(q.edgeW, 0)]);
      chainH(g, yT - 31, [X(0), X(pw)], ['W ' + pw]);
      /* 세로 사슬 — A · B@C · (C1 · B@C) · A. 화면은 위가 큰 쪽이므로 뒤집는다. */
      var ym = [0, b.A, b.A + b.B * b.C];
      if (b.C1 > 0) {
        ym.push(b.A + b.B * b.C + b.C1);
        ym.push(b.A + 2 * b.B * b.C + b.C1);
      }
      ym.push(ph);
      var lv = ['A ' + b.A, 'B ' + b.B + ' @ C ' + b.C];
      if (b.C1 > 0) lv.push('C1 ' + b.C1, 'B ' + b.B + ' @ C ' + b.C);
      lv.push('A ' + b.A);
      chainV(g, X(pw) + 14, ym.slice().reverse().map(Y), lv.slice().reverse());
      /* 판 길이는 받는 값이 아니라 A·B·C·C1 이 정하는 값이다 — 합계로 둔다. */
      chainV(g, X(pw) + 66, [Y(ph), Y(0)], ['plate ' + rnd(ph, 0)]);
      sym(g, X(0) - 4, 20, 'T ' + b.T + '  ·  ' + esc(b.dia) + ' L' + b.len, '#94a3b8');
      /* 「B 칸 → 볼트 몇 개」를 글로 잇는다. 표에 적은 것은 칸 수이고 그림에
         찍힌 것은 볼트라, 둘을 잇는 문장이 없으면 세어 보게 된다. */
      sym(g, X(0) - 4, rnd(yT + pxH + 26, 1),
        'B ' + b.B + '  &rarr;  ' + q.nB + '  &times;  E ' + b.E + '  &rarr;  ' + q.nE +
        '  =  ' + q.n + (q.n > 1 ? ' bolts' : ' bolt'), '#7dd3fc');
      wrap.querySelector('#qcb-d5').innerHTML =
        '<svg width="' + w + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet">' +
        g.join('') + '</svg>';
      wrap.querySelector('#qcb-cap5').innerHTML =
        '<b>' + esc(b.m) + '</b> &middot; edge <b>A</b> ' + b.A +
        (q.edgeOK ? ' &ge; ' + q.need + ' OK' : ' &lt; ' + q.need + ' <b>SHORT</b>') +
        ' &middot; across ' + q.across + ' in <b>W</b> ' + b.W + ' leaves ' + rnd(q.edgeW, 0) +
        (q.fitOK ? ' OK' : ' <b>too narrow</b>');
    }

    /* ---- 6장 슬래브. 한쪽 끝에서 마루까지 잘라, T·T1·H·A·W1 을 얹는다. ---- */
    function drawSlab() {
      var w = 350, h = 168, half = D.half, SC = Math.min(262 / half, 0.7);
      var x0 = 26, y0 = 62;
      var X = function (m) { return rnd(x0 + (m + half) * SC, 1); };
      var Y = function (m) { return rnd(y0 - m * SC * 3.2, 1); };   // 두께 방향은 과장
      var top = function (m) { return -(-m) * V.slopeL / 100; };
      var g = [], botZ = D.level ? (top(-half) - V.T1) : null;
      var xs = [-half, D.gx[0], 0];
      g.push('<path d="M ' + X(-half) + ' ' + Y(top(-half) + V.pav) + ' L ' + X(0) + ' ' +
        Y(V.pav) + '" stroke="#64748b" stroke-dasharray="5 3" fill="none"/>');
      var p = 'M ' + X(-half) + ' ' + Y(top(-half)) + ' L ' + X(0) + ' ' + Y(0);
      if (D.level) {
        var hb = D.gtOf(0).bt + 120, gx = D.gx[0];
        p += ' L ' + X(0) + ' ' + Y(botZ) +
             ' L ' + X(gx + hb / 2) + ' ' + Y(botZ) +
             ' L ' + X(gx + hb / 2 - 70) + ' ' + Y(botZ - V.hh) +
             ' L ' + X(gx - hb / 2 + 70) + ' ' + Y(botZ - V.hh) +
             ' L ' + X(gx - hb / 2) + ' ' + Y(botZ) + ' L ' + X(-half) + ' ' + Y(botZ) + ' Z';
      } else {
        p += ' L ' + X(0) + ' ' + Y(-V.T1) + ' L ' + X(-half) + ' ' + Y(top(-half) - V.T1) + ' Z';
      }
      g.push('<path d="' + p + '" fill="url(#qcbHz2)" stroke="#38bdf8" stroke-width="1.4"/>');
      /* 얇은 켜(포장 A, 헌치 H)는 글자를 가운데 놓으면 켜의 선 위에 얹힌다.
         20px 아래면 켜 위로 올려 적는다 — 재는 자리와 적는 자리는 달라도 된다. */
      var dvS = function (sx, z1, z2, lab) {
        var ya = Y(z1), yb2 = Y(z2);
        g.push('<line x1="' + sx + '" y1="' + ya + '" x2="' + sx + '" y2="' + yb2 +
          '" stroke="#ef4444" stroke-width="1"/>');
        sym(g, sx + 5, Math.abs(ya - yb2) < 20 ? Math.min(ya, yb2) - 5 : (ya + yb2) / 2 + 4, lab);
      };
      dvS(X(-half) - 16, top(-half), (D.level ? botZ : top(-half) - V.T1), 'T1 ' + V.T1);
      dvS(X(0) - 66, 0, (D.level ? botZ : -V.T1), 'T ' + rnd(D.crownT, 0));
      dvS(X(-half) + 30, top(-half), top(-half) + V.pav, 'A ' + V.pav);
      if (D.level) dvS(X(D.gx[0]) - 6, botZ, botZ - V.hh, 'H ' + V.hh);
      /* 내민 길이는 슬래브 밑을 지나 맨 아래에 둔다. 화면 좌표다 — 헌치가
         깊어지면 모델 좌표로 잡은 자리는 슬래브 안으로 들어간다. */
      g.push('<line x1="' + X(-half) + '" y1="' + (h - 26) + '" x2="' +
        X(-half + V.ovh) + '" y2="' + (h - 26) + '" stroke="#ef4444"/>');
      sym(g, X(-half) + 2, h - 12, 'W1 ' + V.ovh);
      sym(g, X(-half * 0.45), Y(top(-half * 0.45)) - 21, '&minus;' + V.slopeL.toFixed(1) + ' %');
      sym(g, X(0) - 40, Y(0) - 26, 'crown', '#94a3b8');
      wrap.querySelector('#qcb-d6').innerHTML =
        '<svg width="' + w + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet">' +
        '<defs><pattern id="qcbHz2" width="7" height="7" patternTransform="rotate(45)"' +
        ' patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="7" stroke="#334155"' +
        ' stroke-width="1.6"/></pattern></defs>' + g.join('') + '</svg>';
      wrap.querySelector('#qcb-cap6').innerHTML =
        'Left half, crown at the right. Thickness exaggerated 3.2&times; so <b>T</b> and ' +
        '<b>H</b> can be read. Soffit <b>' + esc(V.soffit).toLowerCase() + '</b>.';
    }

    /* ---- 7장 방호벽. H1·H2·H3 과 위아래 폭. ---- */
    function drawBarrier() {
      var w = 244, h = 258, H3 = V.bh1 + V.bh2 + V.bh3;
      var SC = Math.min(120 / Math.max(V.bwb, 1), 176 / Math.max(H3, 1));
      var x0 = 42, y0 = 214;
      var X = function (m) { return rnd(x0 + m * SC, 1); };
      var Y = function (m) { return rnd(y0 - m * SC, 1); };
      var g = [];
      g.push('<path d="M ' + X(0) + ' ' + Y(0) + ' L ' + X(V.bwb) + ' ' + Y(0) +
        ' L ' + X(V.bwt) + ' ' + Y(H3) + ' L ' + X(0) + ' ' + Y(H3) +
        ' Z" fill="url(#qcbHz3)" stroke="#38bdf8" stroke-width="1.4"/>');
      [[0, V.bh1, 'H1 ' + V.bh1], [V.bh1, V.bh1 + V.bh2, 'H2 ' + V.bh2],
       [V.bh1 + V.bh2, H3, 'H3 ' + V.bh3]].forEach(function (d, i) {
        var sx = X(V.bwb) + 16;
        g.push('<line x1="' + sx + '" y1="' + Y(d[0]) + '" x2="' + sx + '" y2="' + Y(d[1]) +
          '" stroke="#ef4444" stroke-width="1"/><line x1="' + (sx - 4) + '" y1="' + Y(d[0]) +
          '" x2="' + (sx + 4) + '" y2="' + Y(d[0]) + '" stroke="#ef4444"/><line x1="' + (sx - 4) +
          '" y1="' + Y(d[1]) + '" x2="' + (sx + 4) + '" y2="' + Y(d[1]) + '" stroke="#ef4444"/>');
        sym(g, sx + 5, (Y(d[0]) + Y(d[1])) / 2 + 4, d[2]);
      });
      g.push('<line x1="' + X(0) + '" y1="' + (Y(H3) - 14) + '" x2="' + X(V.bwt) + '" y2="' +
        (Y(H3) - 14) + '" stroke="#ef4444"/>');
      sym(g, X(0), Y(H3) - 20, 'top ' + V.bwt);
      g.push('<line x1="' + X(0) + '" y1="' + (Y(0) + 22) + '" x2="' + X(V.bwb) + '" y2="' +
        (Y(0) + 22) + '" stroke="#ef4444"/>');
      sym(g, X(0), Y(0) + 38, 'btm ' + V.bwb);
      wrap.querySelector('#qcb-d7').innerHTML =
        '<svg width="' + w + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet">' +
        '<defs><pattern id="qcbHz3" width="7" height="7" patternTransform="rotate(45)"' +
        ' patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="7" stroke="#334155"' +
        ' stroke-width="1.6"/></pattern></defs>' + g.join('') + '</svg>';
      wrap.querySelector('#qcb-cap7').innerHTML =
        'Height ' + H3 + ' &middot; area ' + rnd(D.barA, 2) + ' m&sup2; &middot; ' +
        (V.bSym ? 'both sides the same' : 'each side entered on its own');
    }

    /* ---- 가로보 형상. 한 칸을 정면에서 — 현재·사재·연결판·볼트가 어디 붙는지.

       형강 타입(Rolled beam·Built-up plate·Stiffener-connected)은 선 하나가
       아니라 「측면도」로 그린다. 굵은 선 한 줄은 그것이 형강이라는 것도, 얼마나
       깊은지도 말해 주지 않는다. 규격 이름에 이미 H·B·tw·tf 가 들어 있으므로
       sect() 로 꺼내 외곽선과 플랜지 두 줄을 긋는다 — 이름이 곧 단면이다.
       이름을 못 읽으면 깊이를 지어내지 않고 밋밋한 판으로 그린다.

       화면 창은 형상마다 다르게 잡는다. 트러스는 거더 사이 높이를 다 쓰고,
       형강은 제 깊이 둘레만 쓴다 — 한 창에 맞추면 형강 그림 위아래로 빈
       칸만 남는다. ---- */
    function drawCross() {
      var t = V.ct[Math.min(ACT.ct, V.ct.length - 1)], gt = D.gtOf(0);
      var w = 380, bay = D.bay[0] || V.sp, dep = gt.hw - 320;
      var s = isTruss(t.f) ? null : sect(t.s);
      var bh = s ? s.h : Math.round(dep * 0.42), tf = s ? s.tf : 0;
      /* 이음 셋. 자리마다 제 판이고, 「—」인 자리는 판이 없다. */
      var CU = D.bcOf(t.cu), CD = D.bcOf(t.cd), CS = D.bcOf(t.cs);
      var run = function (c) { return c ? D.bcChk(c).run : 0; };
      /* 연결판이 형강보다 깊을 수도 있다 — 창은 제일 큰 것을 담는다. */
      var pmax = Math.max(run(CU), run(CD), run(CS), 1);
      var vh = isTruss(t.f) ? dep : Math.max(bh, pmax) * 1.15;
      var base = isTruss(t.f) ? 0 : (dep - vh) / 2;
      /* 폭은 128 을 남긴다 — 오른쪽에 깊이 치수가 서야 하고, 재 놓고 글자가
         그림 밖으로 나가면 「H 5」 가 된다. 한 번 그렇게 나왔다. */
      var SC = Math.min((w - 128) / bay, 190 / Math.max(vh, 1));
      /* 위는 이름표가, 아래는 bay 치수가 설 만큼만 띄운다. 트러스는 아래
         현재 이름이 한 줄 더 붙으므로 그만큼 더 든다. */
      var padT = isTruss(t.f) ? 26 : 30, padB = isTruss(t.f) ? 46 : 30;
      var x0 = w / 2, y0 = rnd(padT + vh * SC, 1), h = rnd(y0 + padB + 12, 0);
      var X = function (m) { return rnd(x0 + m * SC, 1); };
      var Y = function (m) { return rnd(y0 - (m - base) * SC, 1); };
      var g = [], L = -bay / 2, R = bay / 2, ins = 90;
      /* 양옆 거더의 웨브 — 가로보가 무엇에 붙는지 보이라고. 위아래로는 그림
         밖까지 뻗는다: 거더는 이 창에서 끝나지 않으니 끝나는 것처럼 그리지 않는다. */
      [L, R].forEach(function (gx) {
        g.push('<rect x="' + X(gx - gt.tw / 2) + '" y="-10" width="' +
          Math.max(2, rnd(gt.tw * SC, 1)) + '" height="' + (h + 20) +
          '" fill="#475569" stroke="#64748b"/>');
      });
      var ln = function (x1, y1, x2, y2, c, wd) {
        g.push('<line x1="' + X(x1) + '" y1="' + Y(y1) + '" x2="' + X(x2) + '" y2="' + Y(y2) +
          '" stroke="' + c + '" stroke-width="' + wd + '" stroke-linecap="round"/>');
      };
      /* 판 한 장과 그 위의 볼트. 크기도 개수도 간격도 그 자리가 부르는 BC 가
         정한다 — 그리는 것이 적은 값을 따라가지 않으면 그림이 거짓말을 한다.

         판은 부재를 따라 「눕는다」. 매뉴얼의 A·B·C·C1 사슬은 종방향, 즉 부재가
         뻗는 쪽이고 W 는 그것을 가로지르는 폭이다. 세워 그리면 길이와 폭이
         뒤바뀌어, 이음이 부재보다 깊은 괴상한 그림이 된다. 한 번 그렇게 나왔다.

         보이는 모양도 자리마다 다르다. 복부판·거셋은 정면으로 보이니 판 전체와
         볼트 격자가 보이고, 플랜지 이음판은 옆에서 보므로 두께만 한 줄로 보인다
         — 폭 W 는 지면 속으로 들어간다. 안 보이는 것을 그리지 않는다.

         자리 이름(u·d·s)을 판 옆에 찍어 둔다: 세 자리가 어느 판인지 보이라고. */
      var plate = function (c, tag, mx, my, sx, face) {
        if (!c) return;
        var qc = D.bcChk(c);
        var pl = Math.min(qc.run, bay * 0.42);       // 두 끝이 서로 넘지 않게
        var ox = sx > 0 ? mx : mx - pl;              // 부재 안쪽으로 뻗는다
        var xs = [], ys = [], i2;
        for (i2 = 0; i2 <= c.B; i2++) xs.push(c.A + i2 * c.C);
        if (c.C1 > 0) {
          var m2 = c.A + c.B * c.C + c.C1;
          for (i2 = 0; i2 <= c.B; i2++) xs.push(m2 + i2 * c.C);
        }
        xs = xs.filter(function (v) { return v <= pl; });
        if (face) {
          var pwv = c.W, gy0 = -qc.across / 2;
          for (i2 = 0; i2 <= c.E; i2++) ys.push(gy0 + i2 * c.F);
          g.push('<rect x="' + X(ox) + '" y="' + Y(my + pwv / 2) + '" width="' + rnd(pl * SC, 1) +
            '" height="' + rnd(pwv * SC, 1) + '" fill="#a78bfa" fill-opacity="0.35"' +
            ' stroke="#c4b5fd"/>');
        } else {
          /* 옆에서 본 이음판 — 두께만 보인다. 몇 픽셀은 남겨 둔다. */
          var th = Math.max(2.2, c.T * SC);
          g.push('<rect x="' + X(ox) + '" y="' + (Y(my) - th / 2) + '" width="' +
            rnd(pl * SC, 1) + '" height="' + rnd(th, 1) + '" fill="#a78bfa"' +
            ' fill-opacity="0.55" stroke="#c4b5fd"/>');
          ys.push(0);
        }
        xs.forEach(function (vx) {
          ys.forEach(function (vy) {
            g.push('<circle cx="' + X(ox + vx) + '" cy="' + Y(my + vy) +
              '" r="1.8" fill="#4c1d95"/>');
          });
        });
        g.push('<text x="' + X(ox + pl / 2) + '" y="' +
          (Y(my) + (face ? 4 : -6)) + '" fill="#4c1d95" font-size="10"' +
          ' font-weight="700" text-anchor="middle">' + tag + '</text>');
      };
      if (!isTruss(t.f)) {
        var cyM = dep / 2, yt = cyM + bh / 2, yb = cyM - bh / 2;
        g.push('<rect x="' + X(L) + '" y="' + Y(yt) + '" width="' + rnd(bay * SC, 1) +
          '" height="' + rnd(bh * SC, 1) + '" fill="#0e7490" fill-opacity="0.45"' +
          ' stroke="#22d3ee" stroke-width="1.4"/>');
        if (tf) {                       // 플랜지가 보이는 두 줄 — 이것이 측면도다
          [yt - tf, yb + tf].forEach(function (yy) {
            g.push('<line x1="' + X(L) + '" y1="' + Y(yy) + '" x2="' + X(R) + '" y2="' +
              Y(yy) + '" stroke="#67e8f9" stroke-width="1.1"/>');
          });
        }
        /* u 상부플랜지 · d 하부플랜지 · s 복부 — 양쪽 끝에 같은 셋이 선다.
           플랜지 이음판은 옆모습(두께 한 줄), 복부 이음판은 정면(판과 격자). */
        [[L + gt.tw / 2, 1], [R - gt.tw / 2, -1]].forEach(function (e) {
          plate(CU, 'u', e[0], yt - tf / 2, e[1], 0);
          plate(CD, 'd', e[0], yb + tf / 2, e[1], 0);
          plate(CS, 's', e[0], cyM, e[1], 1);
        });
        /* 깊이는 재서 보인다. 형강이 무엇인지는 이름이, 얼마나 깊은지는 이 줄이. */
        chainV(g, X(R) + 16, [Y(yt), Y(yb)], ['H ' + bh]);
        g.push('<text x="' + X(0) + '" y="' + (Y(yt) - 10) + '" fill="#7dd3fc"' +
          ' font-size="10" text-anchor="middle">' + esc(t.s) +
          (tf ? ' &middot; tf ' + tf + ' &middot; tw ' + s.tw : '') + '</text>');
      } else {
        ln(L + ins, dep, R - ins, dep, '#22d3ee', 4);
        ln(L + ins, 0, R - ins, 0, '#0e7490', 4);
        var apex = t.f === 'V frame' ? 0 : dep;
        if (t.f === 'V frame') {
          ln(L + ins, dep, 0, 0, '#22d3ee', 4); ln(R - ins, dep, 0, 0, '#22d3ee', 4);
        } else {
          ln(L + ins, 0, 0, dep, '#22d3ee', 4); ln(R - ins, 0, 0, dep, '#22d3ee', 4);
        }
        g.push('<circle cx="' + X(0) + '" cy="' + Y(apex) + '" r="4" fill="#a78bfa"/>');
        /* u 상현재 · d 하현재 — 양 끝. s 사재 — 두 사재가 만나는 마루.
           같은 세 이름이 형강에서는 플랜지와 복부였다. 그것이 이 짜임의 값이다. */
        plate(CU, 'u', L + ins, dep, 1, 1); plate(CU, 'u', R - ins, dep, -1, 1);
        plate(CD, 'd', L + ins, 0, 1, 1);   plate(CD, 'd', R - ins, 0, -1, 1);
        /* 사재 거셋은 두 사재가 만나는 마루에. 사재 방향으로 눕히지 않고
           수평으로 그린다 — 거셋은 이음판이 아니라 판이고, 그 모양을 A·B·C 가
           정하지 않는다. 여기서 말하는 것은 「여기에 볼트로 붙는다」까지다. */
        plate(CS, 's', -run(CS) / 2, apex, 1, 1);
        g.push('<text x="' + X(0) + '" y="' + (Y(dep) - 12) + '" fill="#7dd3fc"' +
          ' font-size="10" text-anchor="middle">top ' + esc(t.u) + '</text>');
        g.push('<text x="' + X(0) + '" y="' + (Y(0) + 20) + '" fill="#7dd3fc"' +
          ' font-size="10" text-anchor="middle">btm ' + esc(t.l) + ' &middot; diag ' + esc(t.d) + '</text>');
      }
      g.push('<line x1="' + X(L) + '" y1="' + (h - 12) + '" x2="' + X(R) + '" y2="' +
        (h - 12) + '" stroke="#ef4444" stroke-width="1"/><text x="' + X(0) + '" y="' +
        (h - 17) + '" fill="#fca5a5" font-size="10" text-anchor="middle">bay ' + bay + '</text>');
      wrap.querySelector('#qcb-d4').innerHTML =
        '<svg width="' + w + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet">' +
        g.join('') + '</svg>';
      /* 세 자리를 다 적는다. 하나만 적어 두면 나머지 둘은 화면 어디에도
         없는 것이 되고, 「—」로 비워 둔 자리도 비운 것인지 잊은 것인지 모른다. */
      var say3 = [['u', t.cu, CU], ['d', t.cd, CD], ['s', t.cs, CS]].map(function (e) {
        if (!e[2]) return '<b>' + e[0] + '</b> none';
        var qq = D.bcChk(e[2]);
        return '<b>' + e[0] + '</b> ' + esc(e[2].m) + ' ' + qq.n + '&times;' + esc(e[2].dia) +
               (qq.edgeOK && qq.fitOK ? '' : ' <b>check</b>');
      }).join(' &middot; ');
      wrap.querySelector('#qcb-cap4').innerHTML =
        '<b>' + esc(t.m) + '</b> &middot; ' + esc(t.f) + ' &middot; between G1 and G2' +
        (isTruss(t.f) ? '' : ' &middot; ' + esc(t.s)) + ' &middot; ' + say3;
    }

    /* The stiffener end, drawn large. A whole section puts 1800 mm in one panel
       and squeezes the two things this chapter actually sets — the gap off the
       flange and the scallop — into a few pixels. Drawings zoom; so does this. */
    function drawStiff() {
      var t = D.gtOf(0), w = 258, h = 206, SC = 0.34, x0 = 110, y0 = 150;
      var X = function (m) { return rnd(x0 + m * SC, 1); };
      var Y = function (m) { return rnd(y0 - m * SC, 1); };
      var P = function (x, y) { return X(x) + ' ' + Y(y); };
      var thick = V.gt.reduce(function (a, q) { return Math.max(a, q.tbf); }, 0);
      var sc = thick > 16 ? V.scB : V.scA, a = sc[0], c = sc[2], g = [];
      g.push('<path d="M ' + P(-t.bb / 2, -t.tbf) + ' L ' + P(t.bb / 2, -t.tbf) + ' L ' +
             P(t.bb / 2, 0) + ' L ' + P(-t.bb / 2, 0) +
             ' Z" fill="#cbd5e1" stroke="#e2e8f0" stroke-width="1.2"/>');
      g.push('<path d="M ' + P(-t.tw / 2, 0) + ' L ' + P(t.tw / 2, 0) + ' L ' + P(t.tw / 2, 330) +
             ' L ' + P(-t.tw / 2, 330) + ' Z" fill="#cbd5e1" stroke="#e2e8f0" stroke-width="1.2"/>');
      var sides = V.stSide === 'Both sides' ? [1, -1] : (V.stSide === 'Left only' ? [-1] : [1]);
      sides.forEach(function (d) {
        var x1 = d * t.tw / 2, x2 = d * (t.tw / 2 + V.stW), yb = V.stH;
        g.push('<path d="M ' + P(x1, yb + c) + ' L ' + P(x1 + d * a, yb) + ' L ' + P(x2, yb) +
               ' L ' + P(x2, 330) + ' L ' + P(x1, 330) +
               ' Z" fill="#a78bfa" stroke="#ddd6fe" stroke-width="1.2"/>');
      });
      /* H 는 몇 픽셀짜리 틈이다. 글자를 틈 한가운데 놓으면 플랜지 위에 얹히므로
         틈 위에 적는다 — 재는 자리와 적는 자리는 달라도 된다. */
      g.push('<line x1="' + X(t.tw / 2 + V.stW + 20) + '" y1="' + Y(0) + '" x2="' +
             X(t.tw / 2 + V.stW + 20) + '" y2="' + Y(V.stH) + '" stroke="#ef4444"/>' +
             '<text x="' + (X(t.tw / 2 + V.stW + 26)) + '" y="' + (Y(V.stH) - 5) +
             '" fill="#fca5a5" font-size="11">H ' + V.stH + '</text>');
      g.push('<line x1="' + X(t.tw / 2) + '" y1="' + Y(365) + '" x2="' + X(t.tw / 2 + V.stW) +
             '" y2="' + Y(365) + '" stroke="#ef4444"/><text x="' +
             ((X(t.tw / 2) + X(t.tw / 2 + V.stW)) / 2) + '" y="' + (Y(365) - 6) +
             '" fill="#fca5a5" font-size="11" text-anchor="middle">W ' + V.stW + '</text>');
      g.push('<text x="' + X(t.tw / 2 + a + 96) + '" y="' + Y(V.stH + 106) +
             '" fill="#c4b5fd" font-size="11">scallop a' + a + ' &middot; c' + c + '</text>' +
             '<line x1="' + X(t.tw / 2 + a) + '" y1="' + Y(V.stH) + '" x2="' + X(t.tw / 2 + a + 90) +
             '" y2="' + Y(V.stH + 110) + '" stroke="#a78bfa"/>');
      g.push('<text x="' + X(-t.bb / 2 + 10) + '" y="' + Y(-t.tbf - 60) +
             '" fill="#94a3b8" font-size="11">' + esc(V.gAsg[0]) + ' bottom flange ' +
             t.bb + '&times;' + t.tbf + '</text>');
      /* T 와 G 는 교축방향이라 이 단면에 안 나타난다. 그림에 없다고 표에만
         남겨 두면 그 두 칸은 끝까지 뜻을 모른 채로 남는다 — 글로 잇는다.
         자리는 왼쪽 아래, 플랜지 설명 밑: 위에 놓으면 W 치수와 부딪힌다. */
      sym(g, 6, h - 6, 'T ' + V.stT + ' &middot; G ' + V.stG + ' &mdash; along the bridge',
        '#c4b5fd');
      wrap.querySelector('#qcb-d2').innerHTML =
        '<svg width="' + w + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet">' +
        g.join('') + '</svg>';
      wrap.querySelector('#qcb-cap2').innerHTML =
        '<b>W</b> ' + V.stW + ' &middot; <b>T</b> ' + V.stT + ' &middot; <b>G</b> ' + V.stG +
        ' &middot; <b>H</b> ' + V.stH + ' &middot; scallop a' + a + '&middot;c' + c +
        '. <b>T</b> and <b>G</b> run along the bridge, so they do not show in this section. ' +
        'Flange t' + thick + ' &rarr; the <b>' + (thick > 16 ? 't &gt; 16' : 't &le; 16') +
        '</b> set.';
    }

    /* ---------------- writing a value back ----------------
       One listener for the whole form. The path on the cell says where it goes,
       so adding a chapter needs no wiring of its own. */
    function put(path, raw) {
      var seg = path.split('.'), o = V, k;
      for (k = 0; k < seg.length - 1; k++) o = o[seg[k]];
      var last = seg[seg.length - 1], was = o[last];
      if (path === 'bSym') { V.bSym = raw === 'Symmetric' ? 1 : 0; return; }
      o[last] = (typeof was === 'number') ? num(raw, was) : raw;
    }

    /* 거더 수가 바뀌면 거더를 세는 배열도 같이 바뀐다 — 타입 배정, 칸의
       간격, 칸의 가로보 배정. 한 곳에 모아 둔다: 세 군데에 흩어 두면 하나를
       빼먹은 날 배열 길이가 어긋나고, 그건 화면이 아니라 값이 깨진 것이다. */
    function resize(ng) {
      V.ng = Math.max(2, Math.min(24, Math.round(ng)));
      /* 새 칸의 간격은 마지막 칸을 따라간다 — 등간격 다리를 늘리는 것이
         보통이니까. 새 거더·새 칸의 「타입」은 라이브러리의 첫 줄을 쓴다:
         마지막 줄을 베끼면 바깥 거더가 무거운 다리에서 거더를 하나 늘릴
         때마다 무거운 거더가 하나씩 는다. 치수는 이어지는 것이 맞고,
         타입은 이어지는 것이 아니다. */
      var seed = V.spl.length ? num(V.spl[V.spl.length - 1], V.sp) : V.sp;
      while (V.gAsg.length < V.ng) V.gAsg.push(V.gt[0].m);
      V.gAsg.length = V.ng;
      while (V.cAsg.length < V.ng - 1) V.cAsg.push(V.ct[0].m);
      V.cAsg.length = V.ng - 1;
      while (V.spl.length < V.ng - 1) V.spl.push(seed);
      V.spl.length = V.ng - 1;
    }

    body.addEventListener('change', function (e) {
      var t = e.target, p = t && t.getAttribute && t.getAttribute('data-p');
      if (!p) return;
      put(p, t.value);
      build();
    });
    body.addEventListener('click', function (e) {
      var tr = e.target && e.target.closest ? e.target.closest('tr[data-pick]') : null;
      if (tr) {
        var sp = tr.getAttribute('data-pick').split(':');
        if (ACT[sp[0]] !== +sp[1]) { ACT[sp[0]] = +sp[1]; build(); return; }
      }
      var t = e.target;
      var add = t.getAttribute && t.getAttribute('data-add');
      var del = t.getAttribute && t.getAttribute('data-del');
      /* The library grows and shrinks. Nothing here is fixed at six — the sheet
         that gets written later is sized to what is here, not the other way
         round. FORMS.md holds the reasoning. */
      if (add === 'g') {
        resize(V.ng + 1); build();
      } else if (del === 'g' && V.ng > 2) {
        resize(V.ng - 1); build();
      } else if (add === 'gt') {
        var g0 = V.gt[V.gt.length - 1];
        V.gt.push({ m: 'GT' + (V.gt.length + 1), hw: g0.hw, tw: g0.tw, bt: g0.bt,
                    ttf: g0.ttf, bb: g0.bb, tbf: g0.tbf });
        build();
      } else if (del === 'gt' && V.gt.length > 1) {
        var gone = V.gt.pop().m;
        V.gAsg = V.gAsg.map(function (m) { return m === gone ? V.gt[0].m : m; });
        build();
      } else if (add === 'bc') {
        var b0 = V.bc[V.bc.length - 1];
        V.bc.push({ m: 'BC' + (V.bc.length + 1), T: b0.T, W: b0.W, dia: b0.dia, len: b0.len,
                    B: b0.B, C: b0.C, C1: b0.C1, E: b0.E, F: b0.F, A: b0.A });
        build();
      } else if (del === 'bc' && V.bc.length > 1) {
        /* 지운 이음을 부르던 자리는 「—」로 떨어뜨린다. 첫 줄로 갈음하면
           사용자가 고른 적 없는 판이 조용히 그려진다. */
        var goneB = V.bc.pop().m;
        V.ct.forEach(function (t) {
          ['cu', 'cd', 'cs'].forEach(function (q) { if (t[q] === goneB) t[q] = NONE; });
        });
        build();
      } else if (add === 'ct') {
        var c0 = V.ct[V.ct.length - 1];
        V.ct.push({ m: 'CT' + (V.ct.length + 1), f: c0.f, s: c0.s, u: c0.u,
                    l: c0.l, d: c0.d, cu: c0.cu, cd: c0.cd, cs: c0.cs });
        build();
      } else if (del === 'ct' && V.ct.length > 1) {
        var goneC = V.ct.pop().m;
        V.cAsg = V.cAsg.map(function (m) { return m === goneC ? V.ct[0].m : m; });
        build();
      }
    });
    wrap.querySelector('#qcb-reset').addEventListener('click', function () {
      V = defaults(); build();
    });

    build();
  }

  window.fquick_crossbeam = fquick_crossbeam;
})();
