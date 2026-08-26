/* =========================================================================
   beam_engine.js — 보·라멘 해석 엔진 (v01)

   한 파일에 두 가지 방법이 들어 있다. 둘은 같은 부재 원시연산(고정단모멘트,
   구간 정역학, 처짐 적분)을 쓰지만 미지수를 푸는 방식이 다르다.

     Formula (처짐공식법)  — 단경간. 지점조건이 정해 주는 단부모멘트를 닫힌
                             식으로 바로 쓴다. 교과서 표의 R·Mmax·δmax 를
                             식 그대로 들고 있다가 함께 보여 준다.
     Cross   (모멘트분배법) — 연속보·라멘. 절점을 번갈아 풀어(Hardy Cross)
                             단부모멘트를 수렴시킨다. 분배표를 그대로 남긴다.

   부호규약 — 이것 하나만 붙잡으면 나머지는 따라온다.
     · 부재 국부축: x = i→j, y = x 를 반시계로 90° 돌린 방향.
     · 단부모멘트 M_i, M_j : 절점이 부재에 주는 모멘트, **반시계(CCW)가 양**.
       슬로프-디플렉션과 같은 규약이라  M = (2EI/L)(2θ_near + θ_far − 3ψ) + FEM.
     · ψ = (v_j − v_i)/L, 현(chord)의 반시계 회전이 양.
     · 내부 휨모멘트 M(x) 는 **하연인장(sagging)이 양**. 단부와의 관계는
         M(0) = −M_i ,  M(L) = +M_j
       이다. 즉 CCW 단부모멘트와 sagging 내부모멘트는 왼쪽 끝에서 부호가 뒤집힌다.
     · 하중 w, P 는 국부 +y 성분으로 저장한다. 수평부재에 중력하중이면 음수.
       모델 입력에서는 dir:'grav'(연직 아래) / 'gx'(전역 +x) / 'local' 로 준다.

   단위 — 엔진은 단위를 모른다. 한 벌로 맞춰서 넣으면 그 벌로 나온다.
   화면은 kN, m, kN·m, EI[kN·m²] 로 넣고 처짐만 mm 로 바꿔 쓴다.
     EI[kN·m²] = E[MPa] × I[mm⁴] × 1e-9
   ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.BeamEngine = api;
  if (typeof root !== 'undefined' && root) root.BeamEngine = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var EPS = 1e-10;

  /* ====================================================================
     PART 1 — 작은 수치 도구 (선형해, 최소자승, 영공간)
     외부 라이브러리를 쓰지 않는다. 여기 필요한 크기의 행렬은 손으로 푸는
     편이 의존성 하나보다 싸고, 무엇보다 브라우저에서 그대로 돈다.
     ==================================================================== */
  var Num = {
    // A x = b, 부분 피벗 가우스 소거. 특이하면 null.
    solve: function (A, b) {
      var n = b.length, i, j, k, M = A.map(function (r, ri) { return r.slice().concat([b[ri]]); });
      for (i = 0; i < n; i++) {
        var p = i;
        for (k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
        if (Math.abs(M[p][i]) < 1e-12) return null;
        if (p !== i) { var t = M[p]; M[p] = M[i]; M[i] = t; }
        for (k = i + 1; k < n; k++) {
          var f = M[k][i] / M[i][i];
          if (f === 0) continue;
          for (j = i; j <= n; j++) M[k][j] -= f * M[i][j];
        }
      }
      var x = new Array(n);
      for (i = n - 1; i >= 0; i--) {
        var s = M[i][n];
        for (j = i + 1; j < n; j++) s -= M[i][j] * x[j];
        x[i] = s / M[i][i];
      }
      return x;
    },

    // 과결정계를 정규방정식으로 — 절점 정역학에서 축력·반력을 되찾을 때 쓴다.
    lstsq: function (A, b) {
      var m = A.length, n = A[0].length, i, j, k;
      var N = [], r = [];
      for (i = 0; i < n; i++) {
        N.push(new Array(n).fill(0)); r.push(0);
        for (j = 0; j < n; j++) { var s = 0; for (k = 0; k < m; k++) s += A[k][i] * A[k][j]; N[i][j] = s; }
        var s2 = 0; for (k = 0; k < m; k++) s2 += A[k][i] * b[k]; r[i] = s2;
      }
      for (i = 0; i < n; i++) N[i][i] += 1e-12;   // 특이해도 죽지 않도록 아주 얇은 정규화
      return Num.solve(N, r);
    },

    // A(m×n) 의 영공간 기저. RREF 로 자유열을 찾아 하나씩 세운다.
    nullspace: function (A, n) {
      var m = A.length, i, j, k;
      var M = A.map(function (r) { return r.slice(); });
      var piv = [], row = 0;
      for (var col = 0; col < n && row < m; col++) {
        var p = -1, best = 1e-9;
        for (k = row; k < m; k++) if (Math.abs(M[k][col]) > best) { best = Math.abs(M[k][col]); p = k; }
        if (p < 0) continue;
        var t = M[p]; M[p] = M[row]; M[row] = t;
        var d = M[row][col];
        for (j = 0; j < n; j++) M[row][j] /= d;
        for (k = 0; k < m; k++) {
          if (k === row) continue;
          var f = M[k][col];
          if (Math.abs(f) < 1e-14) continue;
          for (j = 0; j < n; j++) M[k][j] -= f * M[row][j];
        }
        piv.push(col); row++;
      }
      var isPiv = {}; piv.forEach(function (c) { isPiv[c] = true; });
      var basis = [];
      for (var free = 0; free < n; free++) {
        if (isPiv[free]) continue;
        var v = new Array(n).fill(0);
        v[free] = 1;
        for (i = 0; i < piv.length; i++) v[piv[i]] = -M[i][free];
        basis.push(v);
      }
      return basis;
    }
  };

  /* ====================================================================
     PART 2 — 부재하중 원시연산
     하중은 세 가지뿐이고 나머지는 이 셋의 합이다.
       {type:'w', w1, w2, a, b}  a→b 사이 선형변화 분포하중 (국부 +y)
       {type:'P', P, a}          집중하중 (국부 +y)
       {type:'M', M, a}          집중모멘트 (CCW 양)
     고정단모멘트는 에르미트 형상함수의 등가절점하중을 뒤집은 것이다:
       f^F = −Q,  Q_k = ∫ q N_k dx  (모멘트하중이면 Q_k = C·N'_k)
     그래서 표를 외워 넣지 않는다 — 부분등분포도 삼각형도 같은 적분 하나로 나온다.
     ==================================================================== */
  var Load = {
    norm: function (ld, L) {
      var o = Object.assign({}, ld);
      if (o.type === 'w') {
        o.a = (o.a == null) ? 0 : o.a;
        o.b = (o.b == null) ? L : o.b;
        if (o.w2 == null) o.w2 = o.w1;
      } else {
        o.a = (o.a == null) ? L / 2 : o.a;
      }
      return o;
    },

    // ∫_a^b (c0 + c1·(x−a)) · x^n dx  를 위한 단항 적분
    _mono: function (a, b, n) { return (Math.pow(b, n + 1) - Math.pow(a, n + 1)) / (n + 1); },

    // 분포하중 q(x)=w1+s(x−a) 를 x^0..x^3 계수로 본 뒤 필요한 적분을 정확히 낸다.
    // poly = [p0,p1,p2,p3] 에 대해 ∫ q(x)·(p0+p1x+p2x²+p3x³) dx
    _iq: function (ld, poly) {
      var a = ld.a, b = ld.b, w1 = ld.w1, w2 = ld.w2;
      if (b - a < EPS) return 0;
      var s = (w2 - w1) / (b - a);
      // q(x) = (w1 - s·a) + s·x
      var q0 = w1 - s * a, q1 = s, sum = 0;
      for (var i = 0; i < poly.length; i++) {
        if (!poly[i]) continue;
        sum += poly[i] * (q0 * Load._mono(a, b, i) + q1 * Load._mono(a, b, i + 1));
      }
      return sum;
    },

    // 하중 하나의 (합력, i에 대한 모멘트, FEM_i, FEM_j)
    parts: function (ld, L) {
      var o = Load.norm(ld, L), r = { R: 0, Mi: 0, femI: 0, femJ: 0 };
      if (o.type === 'w') {
        r.R = Load._iq(o, [1]);
        r.Mi = Load._iq(o, [0, 1]);
        // FEM_i = −(1/L²)∫ q·x(L−x)² dx  = −(1/L²)∫ q·(L²x − 2Lx² + x³)
        r.femI = -Load._iq(o, [0, L * L, -2 * L, 1]) / (L * L);
        // FEM_j = +(1/L²)∫ q·x²(L−x) dx  = (1/L²)∫ q·(Lx² − x³)
        r.femJ = Load._iq(o, [0, 0, L, -1]) / (L * L);
      } else if (o.type === 'P') {
        var a = o.a, b = L - a;
        r.R = o.P; r.Mi = o.P * a;
        r.femI = -o.P * a * b * b / (L * L);
        r.femJ = o.P * a * a * b / (L * L);
      } else if (o.type === 'M') {
        var s = o.a / L;
        r.R = 0; r.Mi = o.M;
        r.femI = -o.M * (1 - 4 * s + 3 * s * s);
        r.femJ = o.M * (2 * s - 3 * s * s);
      }
      return r;
    },

    // 부재 전체 — 합력 Sq, i에 대한 모멘트 Sm, 고정단모멘트 FEM
    sum: function (loads, L) {
      var t = { Sq: 0, Sm: 0, femI: 0, femJ: 0 };
      (loads || []).forEach(function (ld) {
        var p = Load.parts(ld, L);
        t.Sq += p.R; t.Sm += p.Mi; t.femI += p.femI; t.femJ += p.femJ;
      });
      return t;
    },

    // x 왼쪽의 하중이 만드는 것들 — 구간 다이어그램용
    //   shear  = Σ(합력),  bend = Σ(합력·(x−위치)),  couple = Σ(집중모멘트)
    // xseg 는 x 가 속한 구간의 시작점이다. 집중하중·집중모멘트는 늘 구간
    // 경계에 있으므로, "지나왔는가"는 x 가 아니라 구간으로 판정해야 한다 —
    // x 로 판정하면 구간 첫 점에서 방금 지나온 하중을 빠뜨리고, 그 한 점이
    // 뒤따르는 적분 전체를 어긋나게 한다.
    leftOf: function (loads, L, x, xseg) {
      var sh = 0, bm = 0, cp = 0, tol = 1e-9 * (L || 1);
      if (xseg == null) xseg = x;
      (loads || []).forEach(function (ld0) {
        var o = Load.norm(ld0, L);
        if (o.type === 'P') {
          if (o.a <= xseg + tol) { sh += o.P; bm += o.P * (x - o.a); }
        } else if (o.type === 'M') {
          if (o.a <= xseg + tol) cp += o.M;
        } else {
          var b = Math.min(o.b, x);
          if (b > o.a + EPS) {
            var s = (o.w2 - o.w1) / (o.b - o.a);
            var cut = { type: 'w', a: o.a, b: b, w1: o.w1, w2: o.w1 + s * (b - o.a) };
            sh += Load._iq(cut, [1]);
            bm += Load._iq(cut, [x, -1]);          // ∫ q·(x − ξ) dξ
          }
        }
      });
      return { sh: sh, bm: bm, cp: cp };
    },

    // 하중이 꺾이는 x 좌표 — 격자를 여기서 끊어야 그림도 적분도 정확하다.
    breaks: function (loads, L) {
      var xs = [0, L];
      (loads || []).forEach(function (ld0) {
        var o = Load.norm(ld0, L);
        if (o.type === 'w') { xs.push(o.a); xs.push(o.b); }
        else xs.push(o.a);
      });
      xs = xs.filter(function (v) { return v > -EPS && v < L + EPS; })
             .map(function (v) { return Math.min(L, Math.max(0, v)); })
             .sort(function (p, q) { return p - q; });
      var out = [];
      xs.forEach(function (v) { if (!out.length || v - out[out.length - 1] > 1e-9) out.push(v); });
      return out;
    }
  };

  /* ====================================================================
     PART 3 — 한 경간의 다이어그램
     단부모멘트가 정해지면 나머지는 전부 정역학과 두 번의 적분이다.
       V_j = −(M_i + M_j + Sm)/L,  V_i = −Sq − V_j
       S(x) = V_i + (왼쪽 하중 합)
       M(x) = −M_i + V_i·x + (왼쪽 하중의 모멘트) − (왼쪽 집중모멘트)
       y''  = M/EI  →  경계조건 두 개로 적분상수를 잡는다
     bc:'yy' 는 양단 처짐을 알 때(연속보 경간), 'yt' 는 i단 처짐·회전을 알 때
     (캔틸레버)다.
     ==================================================================== */
  var NSEG = 100;  // 하중구간 하나당 격자수(짝수). 아래 누적적분이 O(h⁵)라 이 정도면 남는다

  function endShears(L, loads, Mi, Mj) {
    var t = Load.sum(loads, L);
    var Vj = -(Mi + Mj + t.Sm) / L;
    var Vi = -t.Sq - Vj;
    return { Vi: Vi, Vj: Vj, sum: t };
  }

  // 균등격자 f 의 누적적분. 4점 애덤스-몰턴(=O(h⁵))이라 3차식까지 정확하다 —
  // M(x) 가 3차, 그 적분이 4차이므로 두 번 적분해도 격자 때문에 값이 흔들리지 않는다.
  function cumInt(f, h) {
    var n = f.length, I = new Array(n).fill(0), k;
    if (n === 1) return I;
    if (n === 2) { I[1] = h * (f[0] + f[1]) / 2; return I; }
    if (n === 3) {
      I[1] = I[0] + h * (5 * f[0] + 8 * f[1] - f[2]) / 12;
      I[2] = I[1] + h * (-f[0] + 8 * f[1] + 5 * f[2]) / 12;
      return I;
    }
    for (k = 0; k < n - 1; k++) {
      if (k + 3 <= n - 1) I[k + 1] = I[k] + h * (9 * f[k] + 19 * f[k + 1] - 5 * f[k + 2] + f[k + 3]) / 24;
      else                I[k + 1] = I[k] + h * (f[k - 2] - 5 * f[k - 1] + 19 * f[k] + 9 * f[k + 1]) / 24;
    }
    return I;
  }

  function spanDiagram(sp) {
    var L = sp.L, EI = sp.EI, loads = sp.loads || [], Mi = sp.Mi, Mj = sp.Mj;
    var es = endShears(L, loads, Mi, Mj);
    var brk = Load.breaks(loads, L);

    var xs = [], S = [], M = [];
    var i, k;
    for (i = 0; i < brk.length - 1; i++) {
      var x0 = brk[i], x1 = brk[i + 1], h = (x1 - x0) / NSEG;
      for (k = 0; k <= NSEG; k++) {
        // 구간 경계는 양쪽에서 한 번씩 찍는다 — 집중하중의 전단 계단이 그대로 보인다
        var x = x0 + k * h;
        var lf = Load.leftOf(loads, L, x, x0);
        xs.push(x);
        S.push(es.Vi + lf.sh);
        M.push(-Mi + es.Vi * x + lf.bm - lf.cp);
      }
    }

    // y'' = M/EI 두 번 적분. 구간별로 누적해 이어 붙인다(꺾임을 넘어가지 않는다).
    var phi = new Array(xs.length).fill(0), Y = new Array(xs.length).fill(0);
    var base = 0, ybase = 0, p = 0;
    for (i = 0; i < brk.length - 1; i++) {
      var seg = [], n0 = p;
      for (k = 0; k <= NSEG; k++) seg.push(M[p + k] / EI);
      var hh = (brk[i + 1] - brk[i]) / NSEG;
      var c1 = cumInt(seg, hh);
      for (k = 0; k <= NSEG; k++) phi[n0 + k] = base + c1[k];
      var c2 = cumInt(c1, hh);
      for (k = 0; k <= NSEG; k++) Y[n0 + k] = ybase + base * (k * hh) + c2[k];
      base = phi[n0 + NSEG]; ybase = Y[n0 + NSEG];
      p += NSEG + 1;
    }

    var C0, C1;
    if (sp.bc === 'yt') { C0 = sp.vi || 0; C1 = sp.ti || 0; }
    else { C0 = sp.vi || 0; C1 = ((sp.vj || 0) - C0 - Y[Y.length - 1]) / L; }

    var y = [], th = [];
    for (i = 0; i < xs.length; i++) { y.push(Y[i] + C1 * xs[i] + C0); th.push(phi[i] + C1); }

    // 격자 최대값은 늘 참값보다 조금 모자란다 — 꼭짓점 근처 세 점에 포물선을
    // 맞춰 보정한다. 집중하중 자리처럼 꺾이는 곳에서는 보정하지 않는다.
    function refine(arr, q) {
      var here = { v: arr[q], x: xs[q] };
      if (q <= 0 || q >= arr.length - 1) return here;
      var h1 = xs[q] - xs[q - 1], h2 = xs[q + 1] - xs[q];
      if (h1 < 1e-9 || h2 < 1e-9 || Math.abs(h1 - h2) > 1e-6 * (h1 + h2)) return here;
      var d = arr[q - 1] - 2 * arr[q] + arr[q + 1];
      if (Math.abs(d) < 1e-14) return here;
      var t = 0.5 * (arr[q - 1] - arr[q + 1]) / d;      // 꼭짓점의 격자 상대위치
      if (!(t > -0.5 && t < 0.5)) return here;
      return { v: arr[q] - 0.25 * (arr[q - 1] - arr[q + 1]) * t, x: xs[q] + t * h1 };
    }
    function ext(arr) {
      var qlo = 0, qhi = 0;
      for (var q = 0; q < arr.length; q++) {
        if (arr[q] < arr[qlo]) qlo = q;
        if (arr[q] > arr[qhi]) qhi = q;
      }
      var lo = refine(arr, qlo), hi = refine(arr, qhi);
      return { min: lo, max: hi, abs: (Math.abs(lo.v) > Math.abs(hi.v)) ? lo : hi };
    }

    return {
      L: L, EI: EI, Mi: Mi, Mj: Mj, Vi: es.Vi, Vj: es.Vj, sum: es.sum,
      x: xs, S: S, M: M, y: y, theta: th,
      Sx: ext(S), Mx: ext(M), yx: ext(y),
      thetaI: th[0], thetaJ: th[th.length - 1]
    };
  }

  /* ====================================================================
     PART 4 — 처짐공식법 (Formula)

     단경간 표준 경우. 지점조건이 단부모멘트를 바로 준다:
       단순보     M_i = M_j = 0
       캔틸레버   M_j = 0,  M_i = −Sm            (자유단이라 정정)
       양단고정   M_i = FEM_i, M_j = FEM_j
       1단고정    M_i = FEM_i − FEM_j/2, M_j = 0 (핀단 해방 = 수정 고정단모멘트)

     닫힌식 표(closed)는 그 위에 얹혀 있다. 표의 값은 위 경로로 계산한 곡선과
     tools/check_beam.js 에서 매번 대조한다 — 식 문자열을 잘못 옮겨 적으면
     그 자리에서 걸린다.
     ==================================================================== */
  var R3 = Math.sqrt(3);

  function mkCase(o) { return o; }

  var FCASES = [
    /* ── 단순보 ─────────────────────────────────────────────────── */
    mkCase({
      id: 'ss-udl', sup: 'ss', name: '단순보 · 등분포하중', needs: ['w'],
      mk: function (p) { return [{ type: 'w', w1: -p.w, w2: -p.w }]; },
      closed: [
        { k: 'R_A', tex: 'wL/2', f: function (p) { return p.w * p.L / 2; } },
        { k: 'R_B', tex: 'wL/2', f: function (p) { return p.w * p.L / 2; } },
        { k: 'M_max', tex: 'wL²/8', at: 'x = L/2', f: function (p) { return p.w * p.L * p.L / 8; } },
        { k: 'δ_max', tex: '5wL⁴/384EI', at: 'x = L/2', d: 1, f: function (p) { return 5 * p.w * Math.pow(p.L, 4) / (384 * p.EI); } },
        { k: 'θ_A', tex: 'wL³/24EI', r: 1, f: function (p) { return p.w * Math.pow(p.L, 3) / (24 * p.EI); } }
      ]
    }),
    mkCase({
      id: 'ss-pmid', sup: 'ss', name: '단순보 · 중앙 집중하중', needs: ['P'],
      mk: function (p) { return [{ type: 'P', P: -p.P, a: p.L / 2 }]; },
      closed: [
        { k: 'R_A', tex: 'P/2', f: function (p) { return p.P / 2; } },
        { k: 'R_B', tex: 'P/2', f: function (p) { return p.P / 2; } },
        { k: 'M_max', tex: 'PL/4', at: 'x = L/2', f: function (p) { return p.P * p.L / 4; } },
        { k: 'δ_max', tex: 'PL³/48EI', at: 'x = L/2', d: 1, f: function (p) { return p.P * Math.pow(p.L, 3) / (48 * p.EI); } },
        { k: 'θ_A', tex: 'PL²/16EI', r: 1, f: function (p) { return p.P * p.L * p.L / (16 * p.EI); } }
      ]
    }),
    mkCase({
      id: 'ss-pa', sup: 'ss', name: '단순보 · 임의점 집중하중', needs: ['P', 'a'],
      mk: function (p) { return [{ type: 'P', P: -p.P, a: p.a }]; },
      closed: [
        { k: 'R_A', tex: 'Pb/L', f: function (p) { return p.P * (p.L - p.a) / p.L; } },
        { k: 'R_B', tex: 'Pa/L', f: function (p) { return p.P * p.a / p.L; } },
        { k: 'M_max', tex: 'Pab/L', at: 'x = a', f: function (p) { return p.P * p.a * (p.L - p.a) / p.L; } },
        { k: 'δ_max', tex: 'Pb(L²−b²)^1.5 / (9√3·LEI)', at: 'x = √((L²−b²)/3)', d: 1,
          f: function (p) { var a = Math.max(p.a, p.L - p.a), b = p.L - a;
            return p.P * b * Math.pow(p.L * p.L - b * b, 1.5) / (9 * R3 * p.L * p.EI); } },
        { k: 'θ_A', tex: 'Pab(L+b)/6LEI', r: 1, f: function (p) { var a = p.a, b = p.L - p.a;
            return p.P * a * b * (p.L + b) / (6 * p.L * p.EI); } }
      ]
    }),
    mkCase({
      id: 'ss-tri', sup: 'ss', name: '단순보 · 삼각분포(우측 최대)', needs: ['w'],
      mk: function (p) { return [{ type: 'w', w1: 0, w2: -p.w }]; },
      closed: [
        { k: 'R_A', tex: 'wL/6', f: function (p) { return p.w * p.L / 6; } },
        { k: 'R_B', tex: 'wL/3', f: function (p) { return p.w * p.L / 3; } },
        { k: 'M_max', tex: 'wL²/(9√3)', at: 'x = L/√3', f: function (p) { return p.w * p.L * p.L / (9 * R3); } },
        { k: 'δ_max', tex: '0.00652 wL⁴/EI', at: 'x = 0.5193L', d: 1, tol: 1e-3,
          f: function (p) { return 0.00652 * p.w * Math.pow(p.L, 4) / p.EI; } },
        { k: 'θ_A', tex: '7wL³/360EI', r: 1, f: function (p) { return 7 * p.w * Math.pow(p.L, 3) / (360 * p.EI); } }
      ]
    }),
    mkCase({
      id: 'ss-mend', sup: 'ss', name: '단순보 · 단부 모멘트(A단)', needs: ['M0'],
      note: '양지점의 반력은 크기가 같고 방향이 반대인 짝힘이다 (A단 하향, B단 상향).',
      mk: function (p) { return [{ type: 'M', M: -p.M0, a: 0 }]; },
      closed: [
        { k: 'R_A', tex: '−M₀/L (하향)', f: function (p) { return -p.M0 / p.L; } },
        { k: 'R_B', tex: 'M₀/L (상향)', f: function (p) { return p.M0 / p.L; } },
        { k: 'M_max', tex: 'M₀', at: 'x = 0', f: function (p) { return p.M0; } },
        { k: 'δ_max', tex: 'M₀L²/(9√3·EI)', at: 'x = L(1−1/√3)', d: 1,
          f: function (p) { return p.M0 * p.L * p.L / (9 * R3 * p.EI); } },
        { k: 'θ_A', tex: 'M₀L/3EI', r: 1, f: function (p) { return p.M0 * p.L / (3 * p.EI); } }
      ]
    }),

    /* ── 캔틸레버 (좌측 고정) ───────────────────────────────────── */
    mkCase({
      id: 'cant-udl', sup: 'cant', name: '캔틸레버 · 등분포하중', needs: ['w'],
      mk: function (p) { return [{ type: 'w', w1: -p.w, w2: -p.w }]; },
      closed: [
        { k: 'R_A', tex: 'wL', f: function (p) { return p.w * p.L; } },
        { k: 'M_A', tex: 'wL²/2', at: '고정단', f: function (p) { return p.w * p.L * p.L / 2; } },
        { k: 'δ_max', tex: 'wL⁴/8EI', at: 'x = L', d: 1, f: function (p) { return p.w * Math.pow(p.L, 4) / (8 * p.EI); } },
        { k: 'θ_B', tex: 'wL³/6EI', r: 1, e: 'j', f: function (p) { return p.w * Math.pow(p.L, 3) / (6 * p.EI); } }
      ]
    }),
    mkCase({
      id: 'cant-pend', sup: 'cant', name: '캔틸레버 · 자유단 집중하중', needs: ['P'],
      mk: function (p) { return [{ type: 'P', P: -p.P, a: p.L }]; },
      closed: [
        { k: 'R_A', tex: 'P', f: function (p) { return p.P; } },
        { k: 'M_A', tex: 'PL', at: '고정단', f: function (p) { return p.P * p.L; } },
        { k: 'δ_max', tex: 'PL³/3EI', at: 'x = L', d: 1, f: function (p) { return p.P * Math.pow(p.L, 3) / (3 * p.EI); } },
        { k: 'θ_B', tex: 'PL²/2EI', r: 1, e: 'j', f: function (p) { return p.P * p.L * p.L / (2 * p.EI); } }
      ]
    }),
    mkCase({
      id: 'cant-pa', sup: 'cant', name: '캔틸레버 · 임의점 집중하중', needs: ['P', 'a'],
      mk: function (p) { return [{ type: 'P', P: -p.P, a: p.a }]; },
      closed: [
        { k: 'R_A', tex: 'P', f: function (p) { return p.P; } },
        { k: 'M_A', tex: 'Pa', at: '고정단', f: function (p) { return p.P * p.a; } },
        { k: 'δ_max', tex: 'Pa²(3L−a)/6EI', at: 'x = L', d: 1,
          f: function (p) { return p.P * p.a * p.a * (3 * p.L - p.a) / (6 * p.EI); } },
        { k: 'θ_B', tex: 'Pa²/2EI', r: 1, e: 'j', f: function (p) { return p.P * p.a * p.a / (2 * p.EI); } }
      ]
    }),
    mkCase({
      id: 'cant-tri-a', sup: 'cant', name: '캔틸레버 · 삼각분포(고정단 최대)', needs: ['w'],
      mk: function (p) { return [{ type: 'w', w1: -p.w, w2: 0 }]; },
      closed: [
        { k: 'R_A', tex: 'wL/2', f: function (p) { return p.w * p.L / 2; } },
        { k: 'M_A', tex: 'wL²/6', at: '고정단', f: function (p) { return p.w * p.L * p.L / 6; } },
        { k: 'δ_max', tex: 'wL⁴/30EI', at: 'x = L', d: 1, f: function (p) { return p.w * Math.pow(p.L, 4) / (30 * p.EI); } },
        { k: 'θ_B', tex: 'wL³/24EI', r: 1, e: 'j', f: function (p) { return p.w * Math.pow(p.L, 3) / (24 * p.EI); } }
      ]
    }),
    mkCase({
      id: 'cant-tri-b', sup: 'cant', name: '캔틸레버 · 삼각분포(자유단 최대)', needs: ['w'],
      mk: function (p) { return [{ type: 'w', w1: 0, w2: -p.w }]; },
      closed: [
        { k: 'R_A', tex: 'wL/2', f: function (p) { return p.w * p.L / 2; } },
        { k: 'M_A', tex: 'wL²/3', at: '고정단', f: function (p) { return p.w * p.L * p.L / 3; } },
        { k: 'δ_max', tex: '11wL⁴/120EI', at: 'x = L', d: 1, f: function (p) { return 11 * p.w * Math.pow(p.L, 4) / (120 * p.EI); } },
        { k: 'θ_B', tex: 'wL³/8EI', r: 1, e: 'j', f: function (p) { return p.w * Math.pow(p.L, 3) / (8 * p.EI); } }
      ]
    }),
    mkCase({
      id: 'cant-mend', sup: 'cant', name: '캔틸레버 · 자유단 모멘트', needs: ['M0'],
      mk: function (p) { return [{ type: 'M', M: -p.M0, a: p.L }]; },
      closed: [
        { k: 'M_A', tex: 'M₀', at: '고정단', f: function (p) { return p.M0; } },
        { k: 'δ_max', tex: 'M₀L²/2EI', at: 'x = L', d: 1, f: function (p) { return p.M0 * p.L * p.L / (2 * p.EI); } },
        { k: 'θ_B', tex: 'M₀L/EI', r: 1, e: 'j', f: function (p) { return p.M0 * p.L / p.EI; } }
      ]
    }),

    /* ── 양단고정 ───────────────────────────────────────────────── */
    mkCase({
      id: 'ff-udl', sup: 'ff', name: '양단고정 · 등분포하중', needs: ['w'],
      mk: function (p) { return [{ type: 'w', w1: -p.w, w2: -p.w }]; },
      closed: [
        { k: 'R_A', tex: 'wL/2', f: function (p) { return p.w * p.L / 2; } },
        { k: 'M_A', tex: 'wL²/12', at: '단부(부모멘트)', f: function (p) { return p.w * p.L * p.L / 12; } },
        { k: 'M_C', tex: 'wL²/24', at: 'x = L/2', s: 1, f: function (p) { return p.w * p.L * p.L / 24; } },
        { k: 'δ_max', tex: 'wL⁴/384EI', at: 'x = L/2', d: 1, f: function (p) { return p.w * Math.pow(p.L, 4) / (384 * p.EI); } }
      ]
    }),
    mkCase({
      id: 'ff-pmid', sup: 'ff', name: '양단고정 · 중앙 집중하중', needs: ['P'],
      mk: function (p) { return [{ type: 'P', P: -p.P, a: p.L / 2 }]; },
      closed: [
        { k: 'R_A', tex: 'P/2', f: function (p) { return p.P / 2; } },
        { k: 'M_A', tex: 'PL/8', at: '단부(부모멘트)', f: function (p) { return p.P * p.L / 8; } },
        { k: 'M_C', tex: 'PL/8', at: 'x = L/2', s: 1, f: function (p) { return p.P * p.L / 8; } },
        { k: 'δ_max', tex: 'PL³/192EI', at: 'x = L/2', d: 1, f: function (p) { return p.P * Math.pow(p.L, 3) / (192 * p.EI); } }
      ]
    }),
    mkCase({
      id: 'ff-pa', sup: 'ff', name: '양단고정 · 임의점 집중하중', needs: ['P', 'a'],
      mk: function (p) { return [{ type: 'P', P: -p.P, a: p.a }]; },
      closed: [
        { k: 'R_A', tex: 'Pb²(L+2a)/L³', f: function (p) { var a = p.a, b = p.L - a;
            return p.P * b * b * (p.L + 2 * a) / Math.pow(p.L, 3); } },
        { k: 'M_A', tex: 'Pab²/L²', at: 'A단(부모멘트)', f: function (p) { var a = p.a, b = p.L - a;
            return p.P * a * b * b / (p.L * p.L); } },
        { k: 'M_B', tex: 'Pa²b/L²', at: 'B단(부모멘트)', f: function (p) { var a = p.a, b = p.L - a;
            return p.P * a * a * b / (p.L * p.L); } },
        { k: 'δ_P', tex: 'Pa³b³/3EIL³', at: 'x = a', d: 1, dat: 'a', f: function (p) { var a = p.a, b = p.L - a;
            return p.P * Math.pow(a, 3) * Math.pow(b, 3) / (3 * p.EI * Math.pow(p.L, 3)); } }
      ]
    }),
    mkCase({
      id: 'ff-tri', sup: 'ff', name: '양단고정 · 삼각분포(우측 최대)', needs: ['w'],
      mk: function (p) { return [{ type: 'w', w1: 0, w2: -p.w }]; },
      closed: [
        { k: 'R_A', tex: '3wL/20', f: function (p) { return 3 * p.w * p.L / 20; } },
        { k: 'R_B', tex: '7wL/20', f: function (p) { return 7 * p.w * p.L / 20; } },
        { k: 'M_A', tex: 'wL²/30', at: 'A단(부모멘트)', f: function (p) { return p.w * p.L * p.L / 30; } },
        { k: 'M_B', tex: 'wL²/20', at: 'B단(부모멘트)', f: function (p) { return p.w * p.L * p.L / 20; } },
        { k: 'δ_max', tex: '0.001309 wL⁴/EI', at: 'x ≈ 0.525L', d: 1, tol: 1e-3,
          f: function (p) { return 0.001309 * p.w * Math.pow(p.L, 4) / p.EI; } }
      ]
    }),

    /* ── 1단고정 타단힌지 (A단 고정, B단 힌지) ─────────────────── */
    mkCase({
      id: 'pf-udl', sup: 'pf', name: '1단고정 타단힌지 · 등분포하중', needs: ['w'],
      mk: function (p) { return [{ type: 'w', w1: -p.w, w2: -p.w }]; },
      closed: [
        { k: 'R_A', tex: '5wL/8', f: function (p) { return 5 * p.w * p.L / 8; } },
        { k: 'R_B', tex: '3wL/8', f: function (p) { return 3 * p.w * p.L / 8; } },
        { k: 'M_A', tex: 'wL²/8', at: '고정단(부모멘트)', f: function (p) { return p.w * p.L * p.L / 8; } },
        { k: 'M_max⁺', tex: '9wL²/128', at: 'x = 5L/8', s: 1, f: function (p) { return 9 * p.w * p.L * p.L / 128; } },
        { k: 'δ_max', tex: '0.0054168 wL⁴/EI ≈ wL⁴/185EI', at: 'x ≈ 0.5785L', d: 1, tol: 3e-4,
          f: function (p) { return 0.0054168 * p.w * Math.pow(p.L, 4) / p.EI; } }
      ]
    }),
    mkCase({
      id: 'pf-pmid', sup: 'pf', name: '1단고정 타단힌지 · 중앙 집중하중', needs: ['P'],
      mk: function (p) { return [{ type: 'P', P: -p.P, a: p.L / 2 }]; },
      closed: [
        { k: 'R_A', tex: '11P/16', f: function (p) { return 11 * p.P / 16; } },
        { k: 'R_B', tex: '5P/16', f: function (p) { return 5 * p.P / 16; } },
        { k: 'M_A', tex: '3PL/16', at: '고정단(부모멘트)', f: function (p) { return 3 * p.P * p.L / 16; } },
        { k: 'M_max⁺', tex: '5PL/32', at: 'x = L/2', s: 1, f: function (p) { return 5 * p.P * p.L / 32; } },
        { k: 'δ_max', tex: 'PL³/(48√5·EI) ≈ PL³/107EI', at: 'x = L(1−1/√5)', d: 1, tol: 3e-4,
          f: function (p) { return p.P * Math.pow(p.L, 3) / (48 * Math.sqrt(5) * p.EI); } }
      ]
    }),
    mkCase({
      id: 'pf-pa', sup: 'pf', name: '1단고정 타단힌지 · 임의점 집중하중', needs: ['P', 'a'],
      mk: function (p) { return [{ type: 'P', P: -p.P, a: p.a }]; },
      closed: [
        { k: 'R_B', tex: 'Pa²(3L−a)/2L³', f: function (p) { return p.P * p.a * p.a * (3 * p.L - p.a) / (2 * Math.pow(p.L, 3)); } },
        { k: 'M_A', tex: 'Pb(L²−b²)/2L²', at: '고정단(부모멘트)', f: function (p) { var b = p.L - p.a;
            return p.P * b * (p.L * p.L - b * b) / (2 * p.L * p.L); } }
      ]
    }),
    mkCase({
      id: 'pf-tri', sup: 'pf', name: '1단고정 타단힌지 · 삼각분포(고정단 최대)', needs: ['w'],
      mk: function (p) { return [{ type: 'w', w1: -p.w, w2: 0 }]; },
      closed: [
        { k: 'M_A', tex: 'wL²/15', at: '고정단(부모멘트)', f: function (p) { return p.w * p.L * p.L / 15; } }
      ]
    })
  ];

  var SUPNAME = { ss: '단순보', cant: '캔틸레버', ff: '양단고정', pf: '1단고정 타단힌지' };

  var Formula = {
    cases: FCASES,
    SUPNAME: SUPNAME,
    get: function (id) { for (var i = 0; i < FCASES.length; i++) if (FCASES[i].id === id) return FCASES[i]; return null; },
    list: function (sup) { return FCASES.filter(function (c) { return !sup || c.sup === sup; }); },

    /* p = {L, EI, w?, P?, M0?, a?} — 하중은 아래쪽(중력)을 양으로 넣는다. */
    solve: function (id, p) {
      var c = Formula.get(id);
      if (!c) throw new Error('unknown case: ' + id);
      var L = p.L, EI = p.EI;
      if (!(L > 0)) throw new Error('L must be > 0');
      if (!(EI > 0)) throw new Error('EI must be > 0');
      if (c.needs.indexOf('a') >= 0 && !(p.a > 0 && p.a < L)) throw new Error('a must be 0 < a < L');

      var loads = c.mk(p);
      var t = Load.sum(loads, L);
      var Mi, Mj, bc = 'yy';
      if (c.sup === 'ss') { Mi = 0; Mj = 0; }
      else if (c.sup === 'cant') { Mj = 0; Mi = -t.Sm; bc = 'yt'; }
      else if (c.sup === 'ff') { Mi = t.femI; Mj = t.femJ; }
      else if (c.sup === 'pf') { Mi = t.femI - t.femJ / 2; Mj = 0; }

      var d = spanDiagram({ L: L, EI: EI, loads: loads, Mi: Mi, Mj: Mj, bc: bc, vi: 0, vj: 0, ti: 0 });

      // 닫힌식 표를 그대로 평가 — 화면에는 식과 값을 함께 낸다.
      var q = Object.assign({}, p, { EI: EI });
      var closed = (c.closed || []).map(function (r) {
        return { k: r.k, tex: r.tex, at: r.at || '', value: r.f(q), kind: r.d ? 'δ' : (r.r ? 'θ' : (r.k.charAt(0) === 'R' ? 'R' : 'M')) };
      });

      return {
        caseDef: c, params: q, loads: loads,
        Mi: Mi, Mj: Mj, RA: d.Vi, RB: d.Vj,
        diag: d, closed: closed,
        // 부호를 화면 관습(아래로 처짐 = 양, 부모멘트 = 음)으로 뒤집어 둔 요약
        summary: {
          R_A: d.Vi, R_B: d.Vj,
          M_A: -Mi, M_B: Mj,
          M_pos: d.Mx.max.v, M_pos_x: d.Mx.max.x,
          M_neg: d.Mx.min.v, M_neg_x: d.Mx.min.x,
          d_max: -d.yx.abs.v, d_max_x: d.yx.abs.x,
          th_A: d.thetaI, th_B: d.thetaJ
        }
      };
    }
  };

  /* ====================================================================
     PART 5 — 모멘트 분배법 (Cross / Hardy Cross)

     모델
       nodes   : [{id, x, y, sup:'fix|pin|roller|rollerh|guide|free', load:{fx,fy,mz}}]
       members : [{id, i, j, EI, loads:[{type:'w|P|M', ..., dir:'grav|gx|local'}]}]

     절차
       ① 부재별 고정단모멘트(FEM) — PART 2 의 적분 하나로 전부 나온다
       ② 단부 해방 정리
            · 캔틸레버 내민단(far end 가 자유·부재 1개)  → k = 0, M 은 정역학
            · 끝단 힌지(far end 가 회전자유·부재 1개)     → k = 3EI/L, 전달 없음,
              수정 FEM  FEM'ᵢ = FEMᵢ − (FEMⱼ − M_ext)/2
            · 그 외                                        → k = 4EI/L, 전달 1/2
       ③ 절점을 번갈아 균형 → 분배 · 전달 을 표에 그대로 남긴다
       ④ 측방변위(sidesway) — 부재를 축방향 비신장으로 보고 절점 병진의 영공간을
          구해 독립 sway 모드를 찾는다. 모드마다 ψ 를 넣어 한 번씩 더 분배하고,
          가상일 식  Σ(Mᵢ+Mⱼ)ψ = −W  로 배율 α 를 푼다.
       ⑤ 최종 단부모멘트 → 정역학으로 전단·반력, M/EI 두 번 적분으로 처짐
     ==================================================================== */

  var SUPDEF = {
    fix:     [1, 1, 1], pin:     [1, 1, 0], roller:  [0, 1, 0],
    rollerh: [1, 0, 0], guide:   [0, 1, 1], free:    [0, 0, 0]
  };

  function supOf(n) {
    if (n.fix) return n.fix.slice();
    var s = SUPDEF[n.sup || 'free'];
    if (!s) throw new Error('알 수 없는 지점조건: ' + n.sup + ' (절점 ' + n.id + ')');
    return s.slice();
  }

  function prepare(model) {
    var P = { nodes: [], members: [], byId: {}, mById: {} };
    (model.nodes || []).forEach(function (n, k) {
      if (P.byId[n.id] != null) throw new Error('절점 id 중복: ' + n.id);
      var s = supOf(n);
      var o = {
        idx: k, id: n.id, x: +n.x || 0, y: +n.y || 0, sup: n.sup || 'free',
        fx: (n.load && +n.load.fx) || 0, fy: (n.load && +n.load.fy) || 0, mz: (n.load && +n.load.mz) || 0,
        cx: !!s[0], cy: !!s[1], crz: !!s[2], ends: []
      };
      o.isFree = !o.cx && !o.cy && !o.crz;
      P.nodes.push(o); P.byId[n.id] = o;
    });
    if (P.nodes.length < 2) throw new Error('절점이 두 개 이상 필요합니다.');

    (model.members || []).forEach(function (m, k) {
      var a = P.byId[m.i], b = P.byId[m.j];
      if (!a) throw new Error('부재 ' + m.id + ' 의 i절점(' + m.i + ')이 없습니다.');
      if (!b) throw new Error('부재 ' + m.id + ' 의 j절점(' + m.j + ')이 없습니다.');
      var dx = b.x - a.x, dy = b.y - a.y, L = Math.sqrt(dx * dx + dy * dy);
      if (!(L > 0)) throw new Error('부재 ' + m.id + ' 의 길이가 0입니다.');
      var EI = +m.EI;
      if (!(EI > 0)) throw new Error('부재 ' + m.id + ' 의 EI 가 0보다 커야 합니다.');
      var ex = dx / L, ey = dy / L, nx = -ey, ny = ex;   // n = e 를 반시계 90°
      var loads = (m.loads || []).map(function (ld) {
        var o = Object.assign({}, ld), d = o.dir || 'grav';
        var f = (d === 'local') ? 1 : (d === 'gx' ? nx : -ny);   // 'grav' = 전역 −y
        if (o.type === 'w') { o.w1 = (+o.w1 || 0) * f; o.w2 = (o.w2 == null ? o.w1 : (+o.w2 || 0) * f); }
        else if (o.type === 'P') { o.P = (+o.P || 0) * f; }
        delete o.dir;
        return o;
      });
      var t = Load.sum(loads, L);
      var mm = {
        idx: k, id: m.id, i: a, j: b, L: L, EI: EI, ex: ex, ey: ey, nx: nx, ny: ny,
        loads: loads, Sq: t.Sq, Sm: t.Sm, femI: t.femI, femJ: t.femJ
      };
      P.members.push(mm); P.mById[m.id] = mm;
      a.ends.push({ m: mm, e: 'i' }); b.ends.push({ m: mm, e: 'j' });
    });
    if (!P.members.length) throw new Error('부재가 없습니다.');

    // ── 단부 해방 정리 ────────────────────────────────────────────────
    P.nodes.forEach(function (n) {
      n.isTip     = n.isFree && n.ends.length === 1;              // 내민단 끝
      n.isRelease = !n.isFree && !n.crz && n.ends.length === 1;   // 끝단 힌지·이동단
    });
    // m.iFar / m.jFar 는 **그 단에서 본 반대쪽**이 무엇인가를 적는다.
    //   'tip'  반대쪽이 내민단 자유단  → 이 부재는 회전강성이 없다
    //   'pin'  반대쪽이 끝단 힌지      → k = 3EI/L, 전달 없음
    //   'full' 그 외                   → k = 4EI/L, 전달 1/2
    P.members.forEach(function (m) {
      ['i', 'j'].forEach(function (e) {
        var far = m[e === 'i' ? 'j' : 'i'];
        m[e + 'Far'] = far.isTip ? 'tip' : (far.isRelease ? 'pin' : 'full');
      });
      // iFar==='tip' 은 j 쪽이 자유단이라는 뜻이다 — 헷갈리기 쉬운 자리라 한 번 뒤집어 적어 둔다.
      m.overhangAt = (m.iFar === 'tip') ? 'j' : (m.jFar === 'tip' ? 'i' : null);
      m.bothPin = (m.i.isRelease && m.j.isRelease);
    });
    return P;
  }

  function stiffOf(m, e) {
    if (m.overhangAt) return { k: 0, co: 0 };
    if (m.bothPin) return { k: 0, co: 0 };
    if (m[e + 'Far'] === 'pin') return { k: 3 * m.EI / m.L, co: 0 };
    return { k: 4 * m.EI / m.L, co: 0.5 };
  }

  // 분배할 절점과 분배율
  function buildDF(P) {
    P.nodes.forEach(function (n) {
      n.balance = false; n.df = {};
      if (n.crz || n.isTip || n.isRelease) return;
      var sum = 0;
      n.ends.forEach(function (en) { sum += stiffOf(en.m, en.e).k; });
      if (sum <= EPS) return;
      n.ends.forEach(function (en) { n.df[en.m.id] = stiffOf(en.m, en.e).k / sum; });
      n.balance = true;
    });
  }

  /* 한 벌의 분배 — femPick(m,'i'|'j') 이 그 해석의 출발 FEM 을 준다.
     extMz(node) 는 그 해석에서 절점에 걸린 외부모멘트.
     tipShear(m) 는 내민단 끝에 걸린 절점하중의 횡방향 성분. */
  function distribute(P, femPick, extMz, tipShear, opt) {
    opt = opt || {};
    var M = {}, cols = [], colOf = {};
    P.members.forEach(function (m) { M[m.id] = { i: 0, j: 0 }; });
    P.nodes.forEach(function (n) {
      n.ends.forEach(function (en) {
        var key = n.id + '/' + en.m.id;
        colOf[en.m.id + en.e] = key;
        cols.push({ key: key, node: n.id, member: en.m.id, end: en.e, balance: n.balance });
      });
    });

    var rows = [], scale = 0;

    // ① 출발값: FEM (해방된 단부는 미리 정리해 둔다)
    P.members.forEach(function (m) {
      var fi = femPick(m, 'i'), fj = femPick(m, 'j');
      if (m.overhangAt) {
        // 내민보: 자유단 모멘트는 절점 외부모멘트 그대로, 지점쪽은 정역학으로 결정.
        // ΣF(y): Vi + Vj + Sq = 0 ,  ΣM(i점): Mi + Mj + Vj·L + Sm = 0
        var tip = m.overhangAt, Mtip = extMz(m[tip]), Vtip = tipShear(m);
        if (tip === 'j') { M[m.id].j = Mtip; M[m.id].i = -Mtip - Vtip * m.L - m.Sm; }
        else             { M[m.id].i = Mtip; M[m.id].j = -Mtip + (m.Sq + Vtip) * m.L - m.Sm; }
      } else if (m.bothPin) {
        M[m.id].i = extMz(m.i); M[m.id].j = extMz(m.j);
      } else if (m.jFar === 'pin') {
        // j 에서 본 반대쪽(=i)이 해방단 → 해방되는 것은 i 단이다.
        M[m.id].i = extMz(m.i); M[m.id].j = fj - (fi - extMz(m.i)) / 2;
      } else if (m.iFar === 'pin') {
        M[m.id].j = extMz(m.j); M[m.id].i = fi - (fj - extMz(m.j)) / 2;
      } else {
        M[m.id].i = fi; M[m.id].j = fj;
      }
      scale = Math.max(scale, Math.abs(fi), Math.abs(fj), Math.abs(M[m.id].i), Math.abs(M[m.id].j));
    });
    if (scale < EPS) scale = 1;

    function snap(label, kind, get) {
      var v = {};
      cols.forEach(function (c) { v[c.key] = get(c); });
      rows.push({ label: label, kind: kind, vals: v });
    }
    snap('DF', 'df', function (c) {
      var n = P.byId[c.node];
      return n.balance ? (n.df[c.member] || 0) : 0;
    });
    snap('FEM', 'fem', function (c) { return M[c.member][c.end]; });

    // ② 절점을 번갈아 균형
    var tol = 1e-11 * scale, cyc = 0, maxCyc = opt.maxCycles || 400, worst = 0;
    var order = P.nodes.filter(function (n) { return n.balance; });
    for (cyc = 0; cyc < maxCyc; cyc++) {
      var dist = {}, co = {}, moved = 0;
      cols.forEach(function (c) { dist[c.key] = 0; co[c.key] = 0; });
      worst = 0;
      order.forEach(function (n) {
        var U = -extMz(n);
        n.ends.forEach(function (en) { U += M[en.m.id][en.e]; });
        worst = Math.max(worst, Math.abs(U));
        if (Math.abs(U) < tol) return;
        moved++;
        n.ends.forEach(function (en) {
          var df = n.df[en.m.id] || 0;
          if (!df) return;
          var d = -U * df;
          M[en.m.id][en.e] += d;
          dist[colOf[en.m.id + en.e]] += d;
          var st = stiffOf(en.m, en.e);
          if (st.co) {
            var fe = en.e === 'i' ? 'j' : 'i';
            M[en.m.id][fe] += st.co * d;
            co[colOf[en.m.id + fe]] += st.co * d;
          }
        });
      });
      if (!moved) break;
      rows.push({ label: '분배 ' + (cyc + 1), kind: 'dist', vals: dist });
      rows.push({ label: '전달 ' + (cyc + 1), kind: 'co', vals: co });
    }
    snap('합계', 'sum', function (c) { return M[c.member][c.end]; });

    return { M: M, cols: cols, rows: rows, cycles: cyc, unbalance: worst, converged: worst < 1e-6 * scale };
  }

  /* ── 측방변위(sidesway) 모드 ────────────────────────────────────────
     부재를 축방향으로 늘어나지 않는 막대로 보면, 절점 병진 (ux,uy) 에 걸리는
     구속은 ① 지점 ② 부재별 (u_j − u_i)·e = 0 뿐이다. 그 영공간이 곧 독립
     sway 모드다. 내민단 끝은 정역학으로 이미 풀렸으므로 계에서 뺀다. */
  function swayModes(P) {
    var N = P.nodes.length, rows = [];
    function row() { return new Array(2 * N).fill(0); }
    P.members.forEach(function (m) {
      if (m.overhangAt) return;
      var r = row();
      r[2 * m.j.idx] += m.ex; r[2 * m.j.idx + 1] += m.ey;
      r[2 * m.i.idx] -= m.ex; r[2 * m.i.idx + 1] -= m.ey;
      rows.push(r);
    });
    P.nodes.forEach(function (n) {
      if (n.cx || n.isTip) { var a = row(); a[2 * n.idx] = 1; rows.push(a); }
      if (n.cy || n.isTip) { var b = row(); b[2 * n.idx + 1] = 1; rows.push(b); }
    });
    if (!rows.length) rows.push(row());
    var basis = Num.nullspace(rows, 2 * N);

    return basis.map(function (v) {
      var u = {}, psi = {}, big = 0;
      P.nodes.forEach(function (n) { u[n.id] = { x: v[2 * n.idx], y: v[2 * n.idx + 1] }; big = Math.max(big, Math.abs(v[2 * n.idx]), Math.abs(v[2 * n.idx + 1])); });
      if (big > EPS) P.nodes.forEach(function (n) { u[n.id].x /= big; u[n.id].y /= big; });
      var any = 0;
      P.members.forEach(function (m) {
        var vi = u[m.i.id].x * m.nx + u[m.i.id].y * m.ny;
        var vj = u[m.j.id].x * m.nx + u[m.j.id].y * m.ny;
        psi[m.id] = m.overhangAt ? 0 : (vj - vi) / m.L;
        any = Math.max(any, Math.abs(psi[m.id]));
      });
      return { u: u, psi: psi, active: any > 1e-9 };
    }).filter(function (s) { return s.active; });
  }

  // 최종 단부모멘트 → 축력·반력 (절점 정역학의 최소자승해)
  function reactions(P, M, spans) {
    var mi = {}, cols = [], k;
    P.members.forEach(function (m, q) { mi[m.id] = q; });
    var nUnk = P.members.length;
    P.nodes.forEach(function (n) {
      if (n.cx) { cols.push({ n: n, d: 'x', c: nUnk++ }); }
      if (n.cy) { cols.push({ n: n, d: 'y', c: nUnk++ }); }
    });
    var A = [], b = [];
    P.nodes.forEach(function (n) {
      ['x', 'y'].forEach(function (d) {
        var r = new Array(nUnk).fill(0), rhs = (d === 'x' ? n.fx : n.fy);
        n.ends.forEach(function (en) {
          var m = en.m, sp = spans[m.id];
          var V = (en.e === 'i') ? sp.Vi : sp.Vj;
          var nd = (d === 'x') ? m.nx : m.ny, ed = (d === 'x') ? m.ex : m.ey;
          rhs -= V * nd;
          r[mi[m.id]] += (en.e === 'i' ? -1 : 1) * ed;
        });
        cols.forEach(function (c) { if (c.n === n && c.d === d) r[c.c] = -1; });
        A.push(r); b.push(rhs);
      });
    });
    var x = Num.lstsq(A, b) || new Array(nUnk).fill(0);
    var R = {};
    P.nodes.forEach(function (n) {
      if (!n.cx && !n.cy && !n.crz) return;
      var o = { fx: 0, fy: 0, mz: 0 };
      cols.forEach(function (c) { if (c.n === n) o[c.d === 'x' ? 'fx' : 'fy'] = x[c.c]; });
      if (n.crz) { var s = -n.mz; n.ends.forEach(function (en) { s += M[en.m.id][en.e]; }); o.mz = s; }
      R[n.id] = o;
    });
    var axial = {};
    P.members.forEach(function (m) { axial[m.id] = x[mi[m.id]]; });
    return { R: R, axial: axial };
  }

  var Cross = {
    prepare: prepare,

    solve: function (model, opt) {
      opt = opt || {};
      var P = prepare(model);
      buildDF(P);

      var zero = function () { return 0; };
      var extMz = function (n) { return n.mz; };
      // 내민단 끝에 걸린 절점하중은 그대로 부재 끝 전단이 된다
      var tipShear = function (m) {
        if (!m.overhangAt) return 0;
        var t = m[m.overhangAt];
        return t.fx * m.nx + t.fy * m.ny;
      };

      var runs = [];
      var base = distribute(P, function (m, e) { return e === 'i' ? m.femI : m.femJ; }, extMz, tipShear, opt);
      base.title = '하중에 의한 해석' + (0 ? '' : '');
      runs.push(base);

      var modes = swayModes(P);
      var alpha = [];
      if (modes.length) {
        modes.forEach(function (s, t) {
          var femS = function (m, e) { return m.overhangAt ? 0 : -6 * m.EI * s.psi[m.id] / m.L; };
          var r = distribute(P, femS, zero, zero, opt);
          r.title = '측방변위 모드 ' + (t + 1);
          runs.push(r);
        });
        // Σ(Mi+Mj)ψ⁽ˢ⁾ = −W_s
        var A = [], b = [];
        modes.forEach(function (s, si) {
          var row = [], W = 0;
          P.nodes.forEach(function (n) { W += n.fx * s.u[n.id].x + n.fy * s.u[n.id].y; });
          P.members.forEach(function (m) {
            var vi = s.u[m.i.id].x * m.nx + s.u[m.i.id].y * m.ny;
            W += m.Sq * vi + m.Sm * s.psi[m.id];
          });
          var b0 = 0;
          P.members.forEach(function (m) { b0 += (base.M[m.id].i + base.M[m.id].j) * s.psi[m.id]; });
          modes.forEach(function (t, ti) {
            var Mt = runs[ti + 1].M, a = 0;
            P.members.forEach(function (m) { a += (Mt[m.id].i + Mt[m.id].j) * s.psi[m.id]; });
            row.push(a);
          });
          A.push(row); b.push(-W - b0);
        });
        alpha = Num.solve(A, b);
        if (!alpha) throw new Error('측방변위 방정식이 특이합니다 — 구조가 불안정하거나 지점이 모자랍니다.');
      }

      // 최종 단부모멘트와 절점 병진
      var M = {}, disp = {};
      P.nodes.forEach(function (n) { disp[n.id] = { x: 0, y: 0 }; });
      P.members.forEach(function (m) { M[m.id] = { i: base.M[m.id].i, j: base.M[m.id].j }; });
      modes.forEach(function (s, t) {
        var a = alpha[t];
        P.members.forEach(function (m) { M[m.id].i += a * runs[t + 1].M[m.id].i; M[m.id].j += a * runs[t + 1].M[m.id].j; });
        P.nodes.forEach(function (n) { disp[n.id].x += a * s.u[n.id].x; disp[n.id].y += a * s.u[n.id].y; });
      });

      // 절점회전 — 내민보의 처짐 곡선에 필요하다 (슬로프-디플렉션 역산)
      var theta = {}, seen = {};
      P.members.forEach(function (m) {
        if (m.overhangAt) return;
        var vi = disp[m.i.id].x * m.nx + disp[m.i.id].y * m.ny;
        var vj = disp[m.j.id].x * m.nx + disp[m.j.id].y * m.ny;
        var psi = (vj - vi) / m.L;
        var s = (M[m.id].i + M[m.id].j - m.femI - m.femJ) * m.L / (6 * m.EI) + 2 * psi;
        var d = (M[m.id].i - M[m.id].j - m.femI + m.femJ) * m.L / (2 * m.EI);
        var ti = (s + d) / 2, tj = (s - d) / 2;
        if (!seen[m.i.id]) { theta[m.i.id] = ti; seen[m.i.id] = 1; }
        if (!seen[m.j.id]) { theta[m.j.id] = tj; seen[m.j.id] = 1; }
      });

      // 경간별 다이어그램
      var spans = {};
      P.members.forEach(function (m) {
        var vi = disp[m.i.id].x * m.nx + disp[m.i.id].y * m.ny;
        var vj = disp[m.j.id].x * m.nx + disp[m.j.id].y * m.ny;
        var sp;
        if (m.overhangAt === 'j') {
          sp = spanDiagram({ L: m.L, EI: m.EI, loads: m.loads, Mi: M[m.id].i, Mj: M[m.id].j,
                             bc: 'yt', vi: vi, ti: theta[m.i.id] || 0 });
        } else if (m.overhangAt === 'i') {
          // 자유단이 i 쪽이면 적분을 j 단에서 시작해야 한다 — 부재를 뒤집어 풀고 되돌린다.
          // 뒤집으면 국부축이 (e,n) → (−e,−n), 즉 z 둘레 180° 회전이다. 그래서
          //   단부모멘트·회전각은 그대로 (M′ᵢ = Mⱼ),  전단도 그대로 (S′(x′) = S(L−x′)),
          //   내부 휨모멘트와 처짐은 부호가 뒤집힌다 (+y 가 반대쪽을 가리키므로).
          var rl = m.loads.map(function (ld) {
            var o = Load.norm(ld, m.L), r = Object.assign({}, o);
            if (o.type === 'w') { r.a = m.L - o.b; r.b = m.L - o.a; r.w1 = -o.w2; r.w2 = -o.w1; }
            else if (o.type === 'P') { r.a = m.L - o.a; r.P = -o.P; }
            else { r.a = m.L - o.a; r.M = o.M; }
            return r;
          });
          var rv = spanDiagram({ L: m.L, EI: m.EI, loads: rl, Mi: M[m.id].j, Mj: M[m.id].i,
                                 bc: 'yt', vi: -vj, ti: theta[m.j.id] || 0 });
          sp = { L: m.L, EI: m.EI, Mi: M[m.id].i, Mj: M[m.id].j, Vi: -rv.Vj, Vj: -rv.Vi, sum: rv.sum,
                 x: [], S: [], M: [], y: [], theta: [] };
          for (var q = rv.x.length - 1; q >= 0; q--) {
            sp.x.push(m.L - rv.x[q]); sp.S.push(rv.S[q]); sp.M.push(-rv.M[q]);
            sp.y.push(-rv.y[q]); sp.theta.push(rv.theta[q]);
          }
          var mk = function (arr) {
            var lo = 0, hi = 0;
            for (var w = 0; w < arr.length; w++) { if (arr[w] < arr[lo]) lo = w; if (arr[w] > arr[hi]) hi = w; }
            var a = { v: arr[lo], x: sp.x[lo] }, b2 = { v: arr[hi], x: sp.x[hi] };
            return { min: a, max: b2, abs: Math.abs(a.v) > Math.abs(b2.v) ? a : b2 };
          };
          sp.Sx = mk(sp.S); sp.Mx = mk(sp.M); sp.yx = mk(sp.y);
          sp.thetaI = sp.theta[0]; sp.thetaJ = sp.theta[sp.theta.length - 1];
        } else {
          sp = spanDiagram({ L: m.L, EI: m.EI, loads: m.loads, Mi: M[m.id].i, Mj: M[m.id].j,
                             bc: 'yy', vi: vi, vj: vj });
        }
        sp.id = m.id; sp.iNode = m.i.id; sp.jNode = m.j.id;
        spans[m.id] = sp;
      });

      var rr = reactions(P, M, spans);

      return {
        prep: P, model: model,
        moments: M, spans: spans, disp: disp, theta: theta,
        reactions: rr.R, axial: rr.axial,
        runs: runs, modes: modes, alpha: alpha,
        sway: modes.length,
        cycles: base.cycles, converged: runs.every(function (r) { return r.converged; }),
        df: (function () { var o = {}; P.nodes.forEach(function (n) { if (n.balance) o[n.id] = Object.assign({}, n.df); }); return o; })()
      };
    },

    /* 연속보를 짧게 적기 위한 도우미.
       spans = [{L, EI, loads:[...]}, ...],  sup = ['fix','roller',...] (경간+1 개)
       왼쪽 끝을 x=0 으로 두고 A,B,C… 로 이름 붙인다. */
    beam: function (spans, sup, opt) {
      opt = opt || {};
      var names = opt.names || null, nodes = [], members = [], x = 0;
      function nm(k) { return names ? names[k] : String.fromCharCode(65 + k); }
      for (var k = 0; k <= spans.length; k++) {
        nodes.push({ id: nm(k), x: x, y: 0, sup: sup[k] || 'roller', load: (opt.nodeLoads || {})[nm(k)] });
        if (k < spans.length) x += spans[k].L;
      }
      spans.forEach(function (s, k) {
        members.push({ id: nm(k) + nm(k + 1), i: nm(k), j: nm(k + 1), EI: s.EI, loads: s.loads || [] });
      });
      return { nodes: nodes, members: members };
    }
  };

  return { VERSION: '01', Num: Num, Load: Load, spanDiagram: spanDiagram, endShears: endShears,
           Formula: Formula, Cross: Cross, SUPDEF: SUPDEF };
}));
