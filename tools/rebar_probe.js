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

//  실제 입력 파일(PSCBOX_DIAPHRAGM_S15.xlsx) 의 input 시트를 그대로 쓴다
const sheet = JSON.parse(fs.readFileSync(path.join(__dirname, 's15_input.json'), 'utf8'));
const rows = P._parseRebar(sheet) || [];
console.log('엑셀에서 읽은 철근', rows.length, '개 :', rows.map(r => r.id).join(' '));

P._rebarData = rows;
Domain.currentSection = sec;
Domain.trebarList = []; Domain.lrebarList = []; Domain.queue = [];
Domain.activeQueueIndex = 0; Domain.isPaused = false; Domain.wallStack = {};
Domain.USER_REBAR_DATA = rows;
rows.forEach(rd => { try {
  const rb = Domain._createTrebarFromData(rd);
  if (rb) { Domain.trebarList.push(rb); Domain.queue.push({ kind: 'trebar', obj: rb }); }
} catch (e) { console.log('생성 실패', rd.id, e.message); } });
console.log('생성된 trebar', Domain.trebarList.length, '개');

for (let i = 0; i < 20000 && Domain.activeQueueIndex < Domain.queue.length; i++) Domain.stepPhysics();
console.log('안착 상태 :', Domain.trebarList.map(t => t.id + ':' + t.state).join(' '));

//  ── 3D 가 넘겨받는 폴리라인을 그대로 재현해 살펴본다 ──────────────
function polyOf(t) {
  const pts = [[t.segments[0].p1.x, t.segments[0].p1.y]];
  t.segments.forEach(sg => pts.push([sg.p2.x, sg.p2.y]));
  return pts;
}
console.log('\n=== 3D 로 넘어가는 폴리라인 ===');
Domain.trebarList.forEach(t => {
  if (!t.segments || !t.segments.length) return console.log(t.id, '세그먼트 없음');
  const pts = polyOf(t);
  //  이음 끊김 : 세그먼트 i 의 끝과 i+1 의 시작이 떨어져 있나
  let gap = 0;
  for (let i = 0; i + 1 < t.segments.length; i++)
    gap = Math.max(gap, Math.hypot(t.segments[i+1].p1.x - t.segments[i].p2.x,
                                   t.segments[i+1].p1.y - t.segments[i].p2.y));
  //  겹친 점 (TubeGeometry 가 NaN 을 내는 원인)
  let dup = 0;
  for (let i = 0; i + 1 < pts.length; i++)
    if (Math.hypot(pts[i+1][0]-pts[i][0], pts[i+1][1]-pts[i][1]) < 1e-6) dup++;
  const len = pts.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-pts[i][0],p[1]-pts[i][1]),0);
  console.log(t.id.padEnd(4), t.state.padEnd(7), '점', String(pts.length).padStart(2),
    '| 이음끊김', gap.toFixed(1).padStart(7), '| 겹친점', dup,
    '| 길이', len.toFixed(0).padStart(6),
    '\n     ', pts.map(p => '(' + p[0].toFixed(0) + ',' + p[1].toFixed(0) + ')').join(' '));
});

console.log('\n=== 벽 번호가 실제로 어디인가 (엑셀이 지목한 것만) ===');
const want = { E1:1, E2:1, E3:1, E4:1, E5:1, E12:1, E13:1, E22:1 };
sec.walls.forEach(w => {
  if (!want[w.id]) return;
  console.log(' ', w.id.padEnd(4), w.tag.padEnd(6),
    '(' + w.x1.toFixed(0) + ',' + w.y1.toFixed(0) + ') → (' + w.x2.toFixed(0) + ',' + w.y2.toFixed(0) + ')',
    '· 길이', Math.hypot(w.x2-w.x1, w.y2-w.y1).toFixed(0).padStart(5),
    '· 법선(' + w.nx.toFixed(2) + ',' + w.ny.toFixed(2) + ')');
});

/* ── 철근이 콘크리트 안에 있나 ────────────────────────────────────────
   3D 가 넘겨받는 외곽(_sectPoly.outer)으로 점-내부 판정을 한다.       */
const outer = (P._sectPoly && P._sectPoly.outer) || [];
function inPoly(x, y) {
  let c = false;
  for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
    const [xi, yi] = outer[i], [xj, yj] = outer[j];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi)) c = !c;
  }
  return c;
}
console.log('\n=== 철근이 콘크리트 안에 있나 (외곽 ' + outer.length + '점) ===');
Domain.trebarList.forEach(t => {
  const pts = [[t.segments[0].p1.x, t.segments[0].p1.y]];
  t.segments.forEach(sg => pts.push([sg.p2.x, sg.p2.y]));
  //  꼭짓점만 보면 놓친다 — 각 변을 20 등분해 본다
  let out = 0, tot = 0, worst = null;
  for (let i = 0; i + 1 < pts.length; i++)
    for (let k = 0; k <= 20; k++) {
      const x = pts[i][0] + (pts[i+1][0] - pts[i][0]) * k / 20;
      const y = pts[i][1] + (pts[i+1][1] - pts[i][1]) * k / 20;
      tot++; if (!inPoly(x, y)) { out++; if (!worst) worst = [x, y]; }
    }
  console.log(' ', t.id.padEnd(4), out ? '밖으로 나감 ' + out + '/' + tot +
    ' (예: ' + worst[0].toFixed(0) + ',' + worst[1].toFixed(0) + ')' : '전부 안쪽 ' + tot + '점');
});
