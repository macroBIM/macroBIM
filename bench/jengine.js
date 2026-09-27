/*  bench/jengine.js — 단면과 **아직 안 내려온** 철근을 데이터로 꺼낸다.
 *
 *  bench/engine.js 는 단면을 만든 뒤 곧바로 물리를 돌린다. J 엔진은 그 물리를
 *  안 쓰므로, 여기서는 ⑤ 스텝을 하지 않고 **초기 자세의 조각**을 그대로 돌려준다.
 *  engine.js 는 손대지 않는다 — makeContext 만 빌려 쓴다.
 */
'use strict';
const vm = require('vm');
const { makeContext } = require('./engine.js');

const PAGE_GLOBAL = { dia: 'PXDIA', box: 'PXBOX' };

/*  돌려주는 것 :
 *    walls   원본 콘크리트 벽 (피복 오프셋 전 — J 가 need 를 스스로 더한다)
 *    covers  { top, outer, inner }
 *    ducts   { id, x, y, D, clr }
 *    bars    [{ id, dia, code, segs:[{label, p1, p2, normal}] }]   ← 초기 자세
 */
function prepare(sheet, patch = {}, pageKey = 'dia') {
  const { ctx, EL, mk } = makeContext(pageKey);
  const P = ctx[PAGE_GLOBAL[pageKey]];
  const adefs = vm.runInContext('adefs_box12cell', ctx);
  const geo_box12cell = vm.runInContext('geo_box12cell', ctx);
  const Domain = vm.runInContext('Domain', ctx);

  //  ① 치수 · 피복
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

  //  ② 단면
  const g = geo_box12cell(ap);
  P._lines = g.lines.map(l => [l.x1, l.y1, l.x2, l.y2]);
  P._arcs = g.arcs.map(a => [a.x, a.y, a.r, a.angb, a.ange]);
  P._circs = [];

  //  ③ 개구부 · 덕트
  P._openings = [];
  if (typeof P._loadOpenFromExcel === 'function') {
    try { P._loadOpenFromExcel(sheet); P._syncOpenings(ap, g); } catch (e) { /* 없으면 없이 */ }
  }
  P._ducts = []; P._ductSpec = [];
  try { P._loadDuctFromExcel(sheet); } catch (e) { /* 없으면 없이 */ }

  const sec = P._buildSectionFromBim();

  //  ④ 철근 — 만들기만 한다. stepPhysics 를 부르지 않는다.
  let rows = P._parseRebar(sheet) || [];
  if (typeof patch.rows === 'function') rows = patch.rows(JSON.parse(JSON.stringify(rows)));

  Domain.currentSection = sec;
  Domain.trebarList = []; Domain.lrebarList = []; Domain.queue = [];
  Domain.activeQueueIndex = 0; Domain.wallStack = {};
  Domain.USER_REBAR_DATA = rows;

  const bad = [], bars = [];
  rows.forEach(rd => {
    try {
      const rb = Domain._createTrebarFromData(rd);
      if (!rb) { bad.push(String(rd.id)); return; }
      bars.push({
        id: String(rb.id), dia: rb.dia || 13, code: rd.code,
        segs: (rb.segments || []).map(s => ({
          label: s.label,
          p1: { x: s.p1.x, y: s.p1.y }, p2: { x: s.p2.x, y: s.p2.y },
          normal: { x: s.normal.x, y: s.normal.y }
        }))
      });
    } catch (e) { bad.push(String(rd.id) + ':' + e.message); }
  });

  return {
    ap, badRows: bad,
    covers: sec.covers,
    outer: (P._sectPoly && P._sectPoly.outer) || P._sectOuter || [],
    walls: sec.walls.map(w => ({ id: w.id, tag: w.tag, src: w.src,
                                 x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, nx: w.nx, ny: w.ny })),
    ducts: (P._ducts || []).map(d => ({ id: d.id, x: d.x, y: d.y, D: d.D, clr: d.clr })),
    bars
  };
}

module.exports = { prepare };
