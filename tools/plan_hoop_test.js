/*  교축방향 폐합철근이 자기 자리를 찾아가는지 — 지금 엔진 그대로 시험한다.

    생각의 요지 : 물리는 "2D 평면 하나"만 안다. 그 평면이 단면(x-y)이어야 할
    이유는 없다. 격벽을 높이 y 에서 수평으로 자르면 또 하나의 평면이 나오고,
    그 평면의 콘크리트는 「그 높이의 단면 폭 x 격벽 두께」인 직사각형이다.
    그 네 면을 벽으로 주면, 엔진은 지금 쓰는 인력장 그대로 철근을 붙인다.
    좌표축의 뜻만 바뀐다 — 가로는 그대로 x, 세로는 교축 z 다.              */
const { P, Domain, sec } = require('./probe_lib.js');
const DIA_T = 2000, COVER = 40;

const outer = P._sectPoly.outer;
//  높이 y 에서 단면이 가로로 얼마나 넓은가 (바깥 두 교점 사이)
function widthAt(y) {
  const xs = [];
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i], b = outer[(i + 1) % outer.length];
    if ((a[1] > y) === (b[1] > y)) continue;
    xs.push(a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]));
  }
  xs.sort((p, q) => p - q);
  return xs.length ? { x0: xs[0], x1: xs[xs.length - 1] } : null;
}

//  평면 직사각형을 벽 네 장으로. 법선은 안쪽(중심)을 향하게 한다.
function planWalls(x0, x1, t) {
  const z0 = -t / 2, z1 = t / 2, cx = (x0 + x1) / 2, cz = 0;
  const corner = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const walls = [];
  for (let i = 0; i < 4; i++) {
    const p = corner[i], q = corner[(i + 1) % 4];
    const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy);
    let nx = -dy / L, ny = dx / L;
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    if ((cx - mx) * nx + (cz - my) * ny < 0) { nx = -nx; ny = -ny; }   // 안쪽으로
    walls.push({ id: 'P' + (i + 1), tag: 'outer', nx, ny,
                 x1: p[0], y1: p[1], x2: q[0], y2: q[1] });
  }
  return walls;
}

function tryHoop(label, y, expectW) {
  const w = widthAt(y);
  if (!w) return console.log(label + ' : 그 높이에 단면이 없다');
  const walls = planWalls(w.x0, w.x1, DIA_T);
  const W = w.x1 - w.x0;
  const section = { walls, displayPaths: [], covers: { top: COVER, outer: COVER, inner: COVER } };

  //  닫힌 고리가 엔진에 없으므로 code 41(다섯 조각 — 고리에 꼬리 둘)로 대신한다.
  //  치수는 대충 준다 — 벽을 찾아가는지 보는 것이 목적이다.
  const row = { type: 'trebar', id: label, code: 41, dia: 25,
                segs: { a: { len: W * 0.45, set: 'P1' }, b: { len: DIA_T * 0.8 },
                        c: { len: W * 0.9 }, d: { len: DIA_T * 0.8 }, e: { len: W * 0.45 } } };
  Domain.currentSection = section;
  Domain.trebarList = []; Domain.queue = []; Domain.activeQueueIndex = 0;
  Domain.isPaused = false; Domain.wallStack = {};
  Domain.USER_REBAR_DATA = [row];
  let rb; try { rb = Domain._createTrebarFromData(row); } catch (e) { return console.log(label, '생성 실패', e.message); }
  if (!rb) return console.log(label, '생성 실패');
  Domain.trebarList.push(rb); Domain.queue.push({ kind: 'trebar', obj: rb });
  for (let i = 0; i < 40000 && Domain.activeQueueIndex < Domain.queue.length; i++) Domain.stepPhysics();

  const pts = [[rb.segments[0].p1.x, rb.segments[0].p1.y]];
  rb.segments.forEach(s => pts.push([s.p2.x, s.p2.y]));
  const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
  const gotW = Math.max(...xs) - Math.min(...xs), gotT = Math.max(...zs) - Math.min(...zs);
  const per = pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
  console.log('\n' + label + '  (높이 y=' + y + ')');
  console.log('  콘크리트 평면 : 폭 ' + W.toFixed(0) + ' x 두께 ' + DIA_T +
              '   · 도면에서 기대한 폭 ' + expectW);
  console.log('  안착 : ' + rb.state +
              ' · 철근이 감싼 폭 ' + gotW.toFixed(0) + ' x ' + gotT.toFixed(0) +
              ' · 벽에서 ' + ((W - gotW) / 2).toFixed(0) + ' / ' + ((DIA_T - gotT) / 2).toFixed(0) + ' 띄움' +
              '  (피복 ' + COVER + ' + 지름반 12.5 = 52.5 이면 맞음)');
  console.log('  경로 : ' + pts.map(p => '(' + p[0].toFixed(0) + ',' + p[1].toFixed(0) + ')').join(' '));
  console.log('  둘레(꼬리 포함) ' + per.toFixed(0));
}

//  대조군 : 같은 평면에 "닫히지 않은" 평범한 철근을 떨어뜨린다.
//  이것이 붙으면 평면(=교축방향)은 문제가 없다는 뜻이고,
//  안 붙으면 평면을 세우는 내 방식이 틀린 것이다.
function tryOpen(label, y, code, segs) {
  const w = widthAt(y); if (!w) return;
  const walls = planWalls(w.x0, w.x1, DIA_T);
  const section = { walls, displayPaths: [], covers: { top: COVER, outer: COVER, inner: COVER } };
  const row = { type: 'trebar', id: label, code, dia: 25, segs };
  Domain.currentSection = section;
  Domain.trebarList = []; Domain.queue = []; Domain.activeQueueIndex = 0;
  Domain.isPaused = false; Domain.wallStack = {};
  Domain.USER_REBAR_DATA = [row];
  let rb; try { rb = Domain._createTrebarFromData(row); } catch (e) { return console.log(label, '생성 실패', e.message); }
  if (!rb) return console.log(label, '생성 실패');
  Domain.trebarList.push(rb); Domain.queue.push({ kind: 'trebar', obj: rb });
  for (let i = 0; i < 40000 && Domain.activeQueueIndex < Domain.queue.length; i++) Domain.stepPhysics();
  const pts = [[rb.segments[0].p1.x, rb.segments[0].p1.y]];
  rb.segments.forEach(s => pts.push([s.p2.x, s.p2.y]));
  const zs = pts.map(p => p[1]);
  console.log('  ' + label.padEnd(22) + ' → ' + rb.state.padEnd(11) +
    ' z ' + Math.min(...zs).toFixed(0).padStart(6) + '~' + Math.max(...zs).toFixed(0).padStart(6) +
    '  (벽은 z −1000~1000) · ' +
    pts.map(p => '(' + p[0].toFixed(0) + ',' + p[1].toFixed(0) + ')').join(' '));
}

console.log('=== 교축방향 폐합철근을 평면 인력장에 떨어뜨린다 ===');
tryHoop('10-2', -250, 11562);

console.log('\n=== 대조군 : 같은 평면 · 닫히지 않은 철근 ===');
tryOpen('직선 code 1 (P1 면)', -250, 1,  { a: { len: 3000, set: 'P1' } });
tryOpen('직선 code 1 (P2 면)', -250, 1,  { a: { len: 1500, set: 'P2' } });
tryOpen('ㄱ자 code 11 (P1)',   -250, 11, { a: { len: 3000, set: 'P1' }, b: { len: 400 } });
tryOpen('U자 code 21 (P1)',    -250, 21, { a: { len: 400 }, b: { len: 3000, set: 'P1' }, c: { len: 400 } });
tryOpen('U자 code 21 — 두께 감기', -250, 21,
        { a: { len: 1900 }, b: { len: 3000, set: 'P1' }, c: { len: 1900 } });

console.log('\n=== code 41 (다섯 조각) — 치수를 평면에 맞춰 다시 ===');
//  앞서 실패한 것은 조각 길이를 평면보다 크게 줬기 때문일 수도 있다.
//  두께(2,000)를 감는 크기로 제대로 주고 다시 본다.
tryOpen('41 · 두께에 맞춘 치수', -250, 41,
        { a: { len: 1500, set: 'P1' }, b: { len: 1900 }, c: { len: 3000 },
          d: { len: 1900 }, e: { len: 1500 } });
tryOpen('41 · set 없이',        -250, 41,
        { a: { len: 1500 }, b: { len: 1900 }, c: { len: 3000 },
          d: { len: 1900 }, e: { len: 1500 } });
