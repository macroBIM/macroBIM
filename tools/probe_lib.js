/*  엔진을 브라우저 없이 돌려 안착된 철근 좌표를 그대로 본다.
    physics.js · trebar.js 는 브라우저 의존이 없고, domain.js 도 거의 없다.
    Konva 가 필요한 것은 UI 뿐이라 UI 는 건너뛰고 Domain.stepPhysics() 를 직접 돈다. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = path.join(__dirname, '..');
const L = f => fs.readFileSync(path.join(DIR, f), 'utf8');

const EL = {};                       // id → {value}
const ctx = vm.createContext({
  console: { log: console.log, warn: () => {}, error: () => {} },
  Math: Math, JSON: JSON, Number: Number, String: String, Array: Array,
  Object: Object, isFinite: isFinite, isNaN: isNaN, parseFloat: parseFloat,
  parseInt: parseInt, Date: Date, setTimeout: () => 0, clearTimeout: () => {},
  setInterval: () => 0, clearInterval: () => {}, Error: Error,
  dxf_generator: function () { return ''; },
  RWSVG: { render3d: () => {}, mountView: () => {} },
  navigator: { userAgent: 'node' }
});
ctx.window = ctx; ctx.globalThis = ctx;
//  치수 입력칸은 페이지가 직접 값을 쓴다 — 없으면 만들어 준다 (대칭 처리까지 태우려고)
const mkEl = id => (EL[id] = { id: id, value: '', checked: false, disabled: false,
  style: {}, classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
  querySelectorAll: () => [], appendChild() {}, setAttribute() {}, getAttribute: () => null });
ctx.document = {
  getElementById: id => EL[id] || (/(_s|_deck_s|_ext_s|_int_s)$/.test(id) ? mkEl(id) : null),
  querySelector: () => null, querySelectorAll: () => [],
  createElement: () => ({ style: {}, appendChild() {}, classList: { toggle() {} } }),
  addEventListener: () => {}, head: { appendChild() {} }, body: { appendChild() {} }
};
const run = (code, name) => { try { vm.runInContext(code, ctx, { filename: name }); }
                              catch (e) { console.log('로드 실패', name, e.message); } };

['geomath.js', 'equation.js', 'bim_box12cell.js', 'trebar.js', 'physics.js', 'domain.js'].forEach(f => run(L(f), f));
console.log('엔진 :', ['geo_box12cell', 'Domain', 'Physics', 'TrebarFactory', 'adefs_box12cell']
  .map(n => n + '=' + vm.runInContext('typeof ' + n + ' !== "undefined"', ctx)).join(' '));

//  피복 입력칸 (page 의 cval 이 읽는다)
[['cover_deck_s', 50], ['cover_ext_s', 40], ['cover_int_s', 30]].forEach(([k, v]) => EL[k] = { value: String(v) });

run(L('bim_pscbox_diaphragm_test.js'), 'page');
const P = ctx.PXDIA;
const adefs_box12cell = vm.runInContext('adefs_box12cell', ctx);
const geo_box12cell = vm.runInContext('geo_box12cell', ctx);
const Domain = vm.runInContext('Domain', ctx);

//  입력 파일을 페이지의 로더에 그대로 먹인다 — 대칭/비대칭 처리까지 같은 길을 탄다
const sheet0 = JSON.parse(fs.readFileSync(path.join(__dirname, 's15_input.json'), 'utf8'));
adefs_box12cell.forEach(d => mkEl(d[0] + '_s').value = String(d[1]));   // 먼저 기본값
mkEl('cover_deck_s').value = '50'; mkEl('cover_ext_s').value = '40'; mkEl('cover_int_s').value = '30';
try { P._loadDimsFromExcel(sheet0); } catch (e) { console.log('dim 로드', e.message); }
try { P._loadCoverFromExcel(sheet0); } catch (e) { console.log('cover 로드', e.message); }

const ap = {};
adefs_box12cell.forEach(d => { ap[d[0]] = Number(EL[d[0] + '_s'].value); });
ap.NCELL = 1;
sheet0.forEach(r => { if (String(r[0] || '').trim().toLowerCase() === 'type')
  ap.NCELL = (String(r[1]).trim().toLowerCase() === '2c') ? 2 : 1; });
console.log('단면 : NCELL', ap.NCELL, '· TH', ap.TH, '· WL', ap.WL,
  '· 캔틸레버 좌/우', ap.TCAL1, '/', ap.TCAR1,
  '· 피복', EL.cover_deck_s.value + '/' + EL.cover_ext_s.value + '/' + EL.cover_int_s.value);

const g = geo_box12cell(ap);
P._lines = g.lines.map(l => [l.x1, l.y1, l.x2, l.y2]);
P._arcs  = g.arcs.map(a => [a.x, a.y, a.r, a.angb, a.ange]);
P._circs = []; P._openings = [];
const sec = P._buildSectionFromBim();
console.log('벽', sec.walls.length, '개 · 피복', JSON.stringify(sec.covers));


const outer = (P._sectPoly && P._sectPoly.outer) || [];
function inPoly(x, y) {
  let c = false;
  for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
    const [xi, yi] = outer[i], [xj, yj] = outer[j];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi)) c = !c;
  }
  return c;
}
const baseRows = P._parseRebar(sheet0) || [];

//  한 철근의 행을 고쳐 다시 돌린다. patch 는 그 행에 그대로 얹는다.
function runCase(id, patch) {
  const rows = JSON.parse(JSON.stringify(baseRows));
  const row = rows.find(r => String(r.id) === id);
  if (!row) return null;
  Object.keys(patch || {}).forEach(k => {
    if (k === 'angs' || k === 'nors') { row[k] = row[k] || {};
      Object.keys(patch[k]).forEach(kk => row[k][kk] = patch[k][kk]); }
    else row[k] = patch[k];
  });
  Domain.currentSection = sec;
  Domain.trebarList = []; Domain.lrebarList = []; Domain.queue = [];
  Domain.activeQueueIndex = 0; Domain.isPaused = false; Domain.wallStack = {};
  Domain.USER_REBAR_DATA = rows;
  rows.forEach(rd => { try {
    const rb = Domain._createTrebarFromData(rd);
    if (rb) { Domain.trebarList.push(rb); Domain.queue.push({ kind: 'trebar', obj: rb }); }
  } catch (e) {} });
  for (let i = 0; i < 20000 && Domain.activeQueueIndex < Domain.queue.length; i++) Domain.stepPhysics();
  const t = Domain.trebarList.find(x => String(x.id) === id);
  if (!t || !t.segments || !t.segments.length) return null;
  const pts = [[t.segments[0].p1.x, t.segments[0].p1.y]];
  t.segments.forEach(sg => pts.push([sg.p2.x, sg.p2.y]));
  let out = 0, tot = 0;
  for (let i = 0; i + 1 < pts.length; i++)
    for (let k = 0; k <= 20; k++) {
      const x = pts[i][0] + (pts[i+1][0] - pts[i][0]) * k / 20;
      const y = pts[i][1] + (pts[i+1][1] - pts[i][1]) * k / 20;
      tot++; if (!inPoly(x, y)) out++;
    }
  const len = pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
  const xs = pts.map(p => p[0]);
  const legSeg = t.segments.find(sg => Math.hypot(sg.p2.x - sg.p1.x, sg.p2.y - sg.p1.y) < 400);
  return { out, tot, len, pts, state: t.state,
           x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs),
           legX: legSeg ? legSeg.p1.x : NaN,
           legY: legSeg ? [legSeg.p1.y, legSeg.p2.y] : null };
}
module.exports = { EL, mkEl, runCase, sec, outer, inPoly, P, Domain };

//  ── crebar : 페이지의 새 경로를 그대로 태워 본다 ────────────────────
module.exports.runHoops = function () {
  P._loadCrebarFromExcel(sheet0);
  mkEl('diaThk_s').value = '2000';
  P._settleHoops();
  return P._hoops || [];
};
