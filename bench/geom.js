/*  bench/geom.js — 순수 기하. solver 를 부르지 않는다.
 *
 *  판정기가 엔진의 buildShiftedWall / stackAt / insideConcrete 를 쓰면
 *  「피복을 지켰는가」가 정의상 참이 되어 순환논증이 된다. 그래서 여기 있는 것은
 *  전부 좌표만 받는 함수다. 같은 함수로 B1·B2·B3 도 판정할 수 있어야 한다.
 *
 *  V1~V4 는 결국 두 원시 연산으로 환원된다 — 선분–선분 최소거리, 점–다각형 포함.
 */
'use strict';

const EPS = 1e-9;

function dot(ax, ay, bx, by) { return ax * bx + ay * by; }

//  점 p 에서 선분 ab 까지의 최소거리
function ptSegDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const L2 = vx * vx + vy * vy;
  if (L2 < EPS) return Math.hypot(px - ax, py - ay);
  let t = dot(px - ax, py - ay, vx, vy) / L2;
  t = t < 0 ? 0 : (t > 1 ? 1 : t);
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
}

//  선분 두 개가 만나는가 (끝점 접촉 포함)
function segSegIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  if (((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0))) return true;
  //  공선 접촉
  const on = (px, py, qx, qy, rx, ry) =>
    Math.abs((qx - px) * (ry - py) - (qy - py) * (rx - px)) < 1e-7 &&
    Math.min(px, qx) - 1e-7 <= rx && rx <= Math.max(px, qx) + 1e-7 &&
    Math.min(py, qy) - 1e-7 <= ry && ry <= Math.max(py, qy) + 1e-7;
  return on(ax, ay, bx, by, cx, cy) || on(ax, ay, bx, by, dx, dy) ||
         on(cx, cy, dx, dy, ax, ay) || on(cx, cy, dx, dy, bx, by);
}

//  선분 ab 와 선분 cd 사이의 최소거리 (교차하면 0)
function segSegDist(ax, ay, bx, by, cx, cy, dx, dy) {
  if (segSegIntersect(ax, ay, bx, by, cx, cy, dx, dy)) return 0;
  return Math.min(
    ptSegDist(ax, ay, cx, cy, dx, dy), ptSegDist(bx, by, cx, cy, dx, dy),
    ptSegDist(cx, cy, ax, ay, bx, by), ptSegDist(dx, dy, ax, ay, bx, by));
}

//  점이 다각형 안인가 (ray casting)
function pointInPoly(x, y, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || EPS) + xi)) c = !c;
  }
  return c;
}

//  콘크리트 안인가 = 외곽 안 && 어떤 개구부에도 안 들어감
function inConcrete(x, y, outer, openings) {
  if (!pointInPoly(x, y, outer)) return false;
  for (const op of (openings || [])) if (pointInPoly(x, y, op)) return false;
  return true;
}

//  폴리곤을 선분 배열로
function polyEdges(poly) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 1e-6) out.push([a[0], a[1], b[0], b[1]]);
  }
  return out;
}

//  폴리라인(철근 중심선)을 선분 배열로
function lineEdges(pts) {
  const out = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 1e-6) out.push([a[0], a[1], b[0], b[1]]);
  }
  return out;
}

//  폴리라인에서 경계(여러 다각형)까지의 최소거리 — 어느 변에 가장 가까운지도 같이
function minDistToBoundary(pts, polys) {
  let best = Infinity, which = null;
  const ls = lineEdges(pts);
  polys.forEach((poly, pi) => {
    polyEdges(poly).forEach((e, ei) => {
      ls.forEach(s => {
        const d = segSegDist(s[0], s[1], s[2], s[3], e[0], e[1], e[2], e[3]);
        if (d < best) { best = d; which = { poly: pi, edge: ei, e }; }
      });
    });
  });
  return { dist: best, at: which };
}

//  폴리라인 두 개 사이의 최소거리
function minDistLines(a, b) {
  let best = Infinity;
  const A = lineEdges(a), B = lineEdges(b);
  A.forEach(s => B.forEach(t => {
    const d = segSegDist(s[0], s[1], s[2], s[3], t[0], t[1], t[2], t[3]);
    if (d < best) best = d;
  }));
  return best;
}

//  V1 — 자기교차 (인접하지 않은 변끼리)
function selfIntersects(pts) {
  const e = lineEdges(pts);
  for (let i = 0; i < e.length; i++)
    for (let j = i + 2; j < e.length; j++) {
      if (i === 0 && j === e.length - 1) continue;     // 닫힌 형상의 첫–끝은 이웃
      if (segSegIntersect(e[i][0], e[i][1], e[i][2], e[i][3],
                          e[j][0], e[j][1], e[j][2], e[j][3])) return [i, j];
    }
  return null;
}

//  V2 — 폴리라인이 콘크리트 밖으로 나간 길이 (표본이 아니라 변마다 분할 검사)
function outsideLength(pts, outer, openings, step = 5) {
  let out = 0, tot = 0;
  lineEdges(pts).forEach(([ax, ay, bx, by]) => {
    const L = Math.hypot(bx - ax, by - ay);
    const n = Math.max(2, Math.ceil(L / step));
    for (let k = 0; k < n; k++) {
      const t0 = (k + 0.5) / n;
      const x = ax + (bx - ax) * t0, y = ay + (by - ay) * t0;
      tot += L / n;
      if (!inConcrete(x, y, outer, openings)) out += L / n;
    }
  });
  return { outside: out, total: tot };
}

module.exports = {
  ptSegDist, segSegDist, segSegIntersect, pointInPoly, inConcrete,
  polyEdges, lineEdges, minDistToBoundary, minDistLines, selfIntersects, outsideLength
};
