/*  bim_duct.js — 'duct' 블록. 매입물(덕트·시스관)을 단면에 뚫는다.
 *
 *    duct | id | shape | D | H | x | y | ref | clr
 *
 *      shape  circ  원형 — D 가 **외경**. H 는 비운다
 *             rect  직사각 — D 가 폭 B, H 가 높이
 *      x      단면 좌표. 중심선 기준, 오른쪽이 +
 *      y      ref 에서 잰 깊이
 *      ref    deck    데크 상면에서 **아래로** (기본).  상면이 경사져 있으므로
 *                     같은 y 라도 x 에 따라 절대 높이가 달라진다 — 도면이 덕트를
 *                     상면에서 재는 그 방식 그대로다.
 *             soffit  바닥 밑면에서 위로
 *             abs     절대 y (단면 좌표 그대로)
 *      clr    철근과의 최소 순간격. 비우면 페이지 기본값(내측 피복)
 *
 *  덕트는 결국 **콘크리트에 뚫린 구멍**이라, 벽을 만드는 길이 격벽 개구부와 같다 —
 *  반시계 고리 + 구멍 바깥(콘크리트 쪽) 법선. 다른 것은 개수뿐이다.
 *
 *  격벽 페이지(bim_pscbox_diaphragm_test.js)와 일반 박스 페이지(bim_pscbox_test.js)가
 *  같이 쓴다. 두 벌로 두면 반드시 갈라진다.
 */
(function (root) {
  'use strict';

  var DuctBlock = {

    SEG: 24,          // 원을 몇 각형으로 볼 것인가

    /*  엑셀 시트에서 duct 행을 모은다.
        isEnd / isComment 는 페이지의 판정 함수를 그대로 받는다 (블록 문법이 같다).  */
    parse: function (fullData, isEnd, isComment) {
      if (!Array.isArray(fullData)) return [];
      var list = [];
      for (var r = 0; r < fullData.length; r++) {
        var row = fullData[r];
        if (isEnd && isEnd(row)) break;
        if (isComment && isComment(row)) continue;
        var hc = -1;
        for (var c = 0; c < (row ? row.length : 0); c++) {
          if (String(row[c] == null ? '' : row[c]).trim().toLowerCase() === 'duct') { hc = c; break; }
        }
        if (hc < 0) continue;

        var g = function (k) { var v = row[hc + k]; return (v == null) ? '' : String(v).trim(); };
        var num = function (k) { var v = Number(g(k)); return isFinite(v) ? v : NaN; };

        var id = g(1);
        var shape = g(2).toLowerCase() || 'circ';
        if (shape === 'circle' || shape === 'c' || shape === 'o') shape = 'circ';
        if (shape === 'rectangle' || shape === 'r') shape = 'rect';

        var D = num(3), H = num(4), x = num(5), y = num(6);
        var ref = (g(7) || 'deck').toLowerCase();
        var clr = num(8);

        if (!isFinite(D) || D <= 0 || !isFinite(x) || !isFinite(y)) {
          if (root.console) console.warn('[duct] ' + id + ' : D · x · y 가 숫자가 아니다 — 건너뛴다');
          continue;
        }
        if (shape === 'rect' && !(isFinite(H) && H > 0)) H = D;

        list.push({ id: id || String(list.length + 1), shape: shape, D: D,
                    H: (shape === 'rect' ? H : D), x: x, y: y, ref: ref,
                    clr: (isFinite(clr) && clr > 0) ? clr : null });
      }
      return list;
    },

    /*  사양 → 실제 폴리곤.
        surfaceAt(x, 'deck'|'soffit') 는 페이지가 준다 — 페이지마다 단면을 아는 길이 다르다.
        ref:deck / ref:soffit 이 경사면을 따라가려면 이 함수가 필요하다.               */
    build: function (spec, surfaceAt) {
      var SEG = this.SEG, out = [];
      (spec || []).forEach(function (d) {
        var cy;
        if (d.ref === 'abs') cy = d.y;
        else if (d.ref === 'soffit') cy = surfaceAt(d.x, 'soffit') + d.y;
        else cy = surfaceAt(d.x, 'deck') - d.y;
        if (!isFinite(cy)) {
          if (root.console) console.warn('[duct] ' + d.id + ' : x=' + d.x + ' 에 단면이 없다');
          return;
        }
        var pts = [];
        if (d.shape === 'rect') {
          var b = d.D / 2, h = d.H / 2;
          pts = [[d.x - b, cy - h], [d.x + b, cy - h], [d.x + b, cy + h], [d.x - b, cy + h]];
        } else {
          /*  **외접** 다각형으로 만든다. 내접이면 변의 가운데가 원보다 안쪽으로 들어와
              구멍이 실제보다 작아지고, 철근이 덕트에 더 붙을 수 있게 된다.
              구멍은 크게 잡는 쪽이 안전하다 — 24각형에서 여유는 반지름의 0.9% 다.     */
          var R = (d.D / 2) / Math.cos(Math.PI / SEG);
          for (var k = 0; k < SEG; k++) {
            var t = 2 * Math.PI * (k + 0.5) / SEG;
            pts.push([d.x + R * Math.cos(t), cy + R * Math.sin(t)]);
          }
        }
        out.push({ id: d.id, shape: d.shape, D: d.D, H: d.H, x: d.x, y: cy, clr: d.clr, pts: pts });
      });
      return out;
    },

    /*  폴리곤 → 벽. 반시계로 통일하고 법선은 구멍 바깥(= 콘크리트 쪽)으로 모은다.
        인력장은 벽 고리를 피복만큼 통째로 오프셋해서 만들기 때문에(Physics.buildShiftedWall /
        splitWallLoops) 한 덩어리로 연달아 넣고 마지막이 첫 점으로 돌아와야 한다.       */
    walls: function (ducts, eid, tag) {
      var walls = [], paths = [];
      (ducts || []).forEach(function (dk, di) {
        var pts = (dk && dk.pts) || [];
        if (pts.length < 3) return;
        var area = 0;
        for (var i = 0; i < pts.length; i++) {
          var a = pts[i], b = pts[(i + 1) % pts.length];
          area += a[0] * b[1] - b[0] * a[1];
        }
        var seq = (area < 0) ? pts.slice().reverse() : pts;   // 반시계로 통일
        var path = [], made = 0;
        for (var k = 0; k < seq.length; k++) {
          var p = seq[k], q = seq[(k + 1) % seq.length];
          var dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy);
          path.push({ x: p[0], y: p[1] });
          if (len < 0.5) continue;
          eid++;
          walls.push({ id: 'E' + eid, tag: tag || 'inner',
                       nx: dy / len, ny: -dx / len,          // 반시계 → 구멍 바깥쪽 법선
                       x1: p[0], y1: p[1], x2: q[0], y2: q[1],
                       duct: dk.id, clr: dk.clr,
                       src: 'duct' + (dk.id || (di + 1)) + '.' + k });
          made++;
        }
        path.push({ x: seq[0][0], y: seq[0][1] });
        if (made) paths.push(path);
      });
      return { walls: walls, paths: paths, eid: eid };
    },

    /*  바깥 윤곽(점 배열)에서 x 위치의 상면 / 밑면 높이.
        페이지가 자기 외곽 폴리곤을 넘겨 쓰라고 두는 기본 구현이다.                   */
    surfaceOf: function (outer) {
      return function (x, which) {
        if (!outer || outer.length < 3) return NaN;
        var hit = [];
        for (var i = 0; i < outer.length; i++) {
          var a = outer[i], b = outer[(i + 1) % outer.length];
          if ((a[0] > x) === (b[0] > x)) continue;
          hit.push(a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]));
        }
        if (!hit.length) return NaN;
        return (which === 'soffit') ? Math.min.apply(null, hit) : Math.max.apply(null, hit);
      };
    },

    //  REBAR 표의 문법 줄 (두 페이지가 같은 줄을 쓴다)
    SCHEMA_ROW: ['duct', 'id', 'shape (circ/rect)', 'D', 'H', 'x', 'y', 'ref', 'clr', '', '', '', '']
  };

  root.DuctBlock = DuctBlock;
  if (typeof module !== 'undefined' && module.exports) module.exports = DuctBlock;

})(typeof window !== 'undefined' ? window : globalThis);
