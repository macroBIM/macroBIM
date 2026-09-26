/*  bench/engine.js — 엔진을 브라우저 없이, 실행마다 새 컨텍스트로 돌린다.
 *
 *  probe_lib.js 와 하는 일은 같지만 두 가지가 다르다.
 *    ① 실행마다 vm 컨텍스트를 새로 만든다. Domain 이 싱글턴이라 wallStack·_stackSeq·
 *       페이지의 _sectPoly 가 전역에 남고, 반복 실행하면 앞 실행이 뒤 실행을 오염시킨다.
 *       성공률이 실행 순서에 따라 달라지면 논문 수치가 못 된다.
 *    ② 결과를 화면이 아니라 데이터로 돌려준다 — 단면 폴리곤·피복·철근 폴리라인.
 *       판정기(judge)가 solver 를 전혀 호출하지 않고 판정할 수 있도록.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SRC = ['geomath.js', 'equation.js', 'bim_box12cell.js', 'trebar.js', 'physics.js', 'domain.js'];
const PAGE = 'bim_pscbox_diaphragm_test.js';

//  소스는 한 번만 읽어 둔다 (컨텍스트만 새로 만든다)
const CODE = {};
[...SRC, PAGE].forEach(f => { CODE[f] = fs.readFileSync(path.join(ROOT, f), 'utf8'); });

function makeContext() {
  const EL = {};
  const mk = id => (EL[id] = {
    id, value: '', checked: false, disabled: false, textContent: '',
    style: {}, classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
    querySelectorAll: () => [], appendChild() {}, setAttribute() {}, getAttribute: () => null
  });
  const ctx = vm.createContext({
    console: { log: () => {}, warn: () => {}, error: () => {} },
    Math, JSON, Number, String, Array, Object, Boolean, RegExp, Map, Set,
    isFinite, isNaN, parseFloat, parseInt, Date, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    dxf_generator: () => '',
    RWSVG: { render3d: () => {}, mountView: () => {} },
    navigator: { userAgent: 'node' }
  });
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.document = {
    getElementById: id => EL[id] || mk(id),          //  없으면 만들어 준다 (페이지가 값을 직접 쓴다)
    querySelector: () => null, querySelectorAll: () => [],
    createElement: () => ({ style: {}, appendChild() {}, classList: { toggle() {} } }),
    addEventListener: () => {}, head: { appendChild() {} }, body: { appendChild() {} }
  };
  [...SRC, PAGE].forEach(f => {
    try { vm.runInContext(CODE[f], ctx, { filename: f }); }
    catch (e) { throw new Error('load ' + f + ' : ' + e.message); }
  });
  return { ctx, EL, mk };
}

/*  한 번 돌린다.
 *    sheet   : 엑셀 input 시트를 배열의 배열로 (bench/fixture/s15.json)
 *    patch   : { dims:{TCAL:280,...}, covers:{deck,ext,int}, rows:fn(rows)->rows }
 *    budget  : 물리 스텝 예산
 *  돌려주는 것은 전부 순수 데이터다. 엔진 객체를 내보내지 않는다.
 */
function run(sheet, patch = {}, budget = 40000) {
  const { ctx, EL, mk } = makeContext();
  const P = ctx.PXDIA;
  const adefs = vm.runInContext('adefs_box12cell', ctx);
  const geo_box12cell = vm.runInContext('geo_box12cell', ctx);
  const Domain = vm.runInContext('Domain', ctx);

  //  ① 기본 치수 → 엑셀 dim/cover → 호출자 patch  순으로 덮는다
  adefs.forEach(d => mk(d[0] + '_s').value = String(d[1]));
  mk('cover_deck_s').value = '50'; mk('cover_ext_s').value = '40'; mk('cover_int_s').value = '30';
  P._loadDimsFromExcel(sheet);
  P._loadCoverFromExcel(sheet);
  Object.entries(patch.dims || {}).forEach(([k, v]) => mk(k + '_s').value = String(v));
  const cv = patch.covers || {};
  if (cv.deck != null) mk('cover_deck_s').value = String(cv.deck);
  if (cv.ext != null) mk('cover_ext_s').value = String(cv.ext);
  if (cv.int != null) mk('cover_int_s').value = String(cv.int);

  const ap = {};
  adefs.forEach(d => { ap[d[0]] = Number(EL[d[0] + '_s'].value); });
  ap.NCELL = 1;
  sheet.forEach(r => {
    if (String(r[0] || '').trim().toLowerCase() === 'type')
      ap.NCELL = (String(r[1]).trim().toLowerCase() === '2c') ? 2 : 1;
  });

  //  ② 단면 — 원시도형 → 벽
  const g = geo_box12cell(ap);
  P._lines = g.lines.map(l => [l.x1, l.y1, l.x2, l.y2]);
  P._arcs = g.arcs.map(a => [a.x, a.y, a.r, a.angb, a.ange]);
  P._circs = [];

  //  ③ 개구부 — 'open' 블록 → op1_* 칸 → _syncOpenings
  P._openings = [];
  try {
    P._loadOpenFromExcel(sheet);
    P._syncOpenings(ap, g);
  } catch (e) { /* open 줄이 없으면 개구부 없이 간다 */ }

  const sec = P._buildSectionFromBim();

  //  ④ 철근
  let rows = P._parseRebar(sheet) || [];
  if (typeof patch.rows === 'function') rows = patch.rows(JSON.parse(JSON.stringify(rows)));

  Domain.currentSection = sec;
  Domain.trebarList = []; Domain.lrebarList = []; Domain.queue = [];
  Domain.activeQueueIndex = 0; Domain.isPaused = false; Domain.wallStack = {};
  Domain.USER_REBAR_DATA = rows;

  const bad = [];
  rows.forEach(rd => {
    try {
      const rb = Domain._createTrebarFromData(rd);
      if (rb) { Domain.trebarList.push(rb); Domain.queue.push({ kind: 'trebar', obj: rb }); }
      else bad.push(String(rd.id));
    } catch (e) { bad.push(String(rd.id) + ':' + e.message); }
  });

  //  ⑤ 스텝 — 바깥에서 종료를 분류한다 (엔진은 손대지 않는다)
  let steps = 0, lastIdx = -1, sameIdxFor = 0, stuckAt = null;
  for (; steps < budget && Domain.activeQueueIndex < Domain.queue.length; steps++) {
    if (Domain.activeQueueIndex === lastIdx) sameIdxFor++;
    else { lastIdx = Domain.activeQueueIndex; sameIdxFor = 0; }
    try { Domain.stepPhysics(); } catch (e) { stuckAt = 'CRASHED:' + e.message; break; }
  }
  const finished = Domain.activeQueueIndex >= Domain.queue.length;
  const outcome = stuckAt ? stuckAt : (finished ? 'CONVERGED' : 'STALLED');

  //  ⑥ 결과를 순수 데이터로
  const bars = Domain.trebarList.map(t => {
    const segs = t.segments || [];
    const pts = [];
    if (segs.length) {
      pts.push([segs[0].p1.x, segs[0].p1.y]);
      segs.forEach(s => pts.push([s.p2.x, s.p2.y]));
    }
    const finite = pts.every(p => isFinite(p[0]) && isFinite(p[1]));
    return {
      id: String(t.id), dia: t.dia || 0, state: t.state, pts, finite,
      segStates: segs.map(s => s.state),
      len: pts.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0)
    };
  });

  return {
    outcome, steps, finished, badRows: bad,
    queued: Domain.queue.length, done: Domain.activeQueueIndex,
    ap,
    covers: sec.covers,
    outer: (P._sectPoly && P._sectPoly.outer) || [],
    openings: (P._openings || []).map(o => o.pts),
    walls: sec.walls.map(w => ({ id: w.id, x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, nx: w.nx, ny: w.ny, tag: w.tag, src: w.src })),
    bars
  };
}

module.exports = { run, makeContext, ROOT };
