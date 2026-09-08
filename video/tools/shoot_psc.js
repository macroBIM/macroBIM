/* PSC 영상 — 촬영 패스.

   화면에 나오는 것은 전부 배포되는 그것입니다. 페이지는 design/layout_body.js
   (본페이지) 를 디스크에서 서빙한 것이고, 화면은 bim_psc_test.js 이며,
   모든 값은 진짜 입력칸에 타이핑됩니다 — focus, keystroke, change, blur.
   그래서 영상이 폼에 대해 주장하는 것은 폼이 실제로 한 것입니다.

   두 가지가 plate3d 촬영기와 다릅니다.

   1. 3D 가 없습니다. WebGL 캔버스도, 인셋 합성도 없습니다. 화면 하나가
      그대로 그림이므로 브라우저 창을 통째로 뜹니다.

   2. 마지막 컷의 도면은 앱이 만든 DXF 를 그대로 그립니다. 앱의 download 를
      가로채 파일을 받아 dxf2svg_psc.js 로 그리고, 그 SVG 를 찍습니다.
      다시 조판하지 않습니다 — plate3d/video/README.md 의 규칙입니다.

   창은 1600×900, deviceScaleFactor 2 로 3200×1800 스틸을 냅니다. 최종이
   2560×1440 이므로 조립에서 축소로 들어갑니다. 어디에서도 확대가 없습니다.

   shots_psc.json 은 컷마다 다시 씁니다 — 한 시간 뒤에 브라우저가 죽으면
   프레임만으로는 아무 쓸모가 없기 때문입니다.

     node shoot_psc.js                                                       */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const SP = __dirname;
const SRC = SP + '/src_psc';
const CARD = 'psc/';
const MB = path.resolve(SP + '/../..');               // .../macroBIM
const DZ = path.resolve(MB + '/../designclone');      // .../design
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const FPS = 30, MO = 15;
const VW = 1600, VH = 900;

fs.rmSync(SRC, { recursive: true, force: true });
fs.mkdirSync(SRC, { recursive: true });

let n = 0, T = 0;
const shots = [], caps = [];
function put(buf, dur) {
  const f = 's' + String(n++).padStart(4, '0') + '.png';
  fs.writeFileSync(SRC + '/' + f, buf);
  shots.push({ file: f, dur: dur });
  T += dur;
  return f;
}
const caption = (id, start, dur) => caps.push({ png: CARD + 's_' + id + '.png', start: start, dur: dur });
const save = () => fs.writeFileSync(SP + '/shots_psc.json',
  JSON.stringify({ fps: FPS, dir: 'src_psc', cards: CARD, w: 2560, h: 1440,
                   shots: shots, caps: caps }, null, 1));

/* ── 사이트를 디스크에서 서빙한다. 촬영 중 네트워크는 없다. ────────────── */
const FONTCSS = fs.readFileSync(SP + '/v_font.css', 'utf8');
const ICONCSS = fs.existsSync(SP + '/bi_font.css') ? fs.readFileSync(SP + '/bi_font.css', 'utf8') : '';
const HOST = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
  '<style>' + FONTCSS + ICONCSS + '</style>' +
  '<link rel="stylesheet" href="/design/layout_style.css"></head>' +
  '<body style="margin:0;display:flex;flex-direction:column;height:100vh">' +
  '<div id="app-root"></div>' +
  ['rebartable_claude', 'steelsection_claude', 'mod_concrete', 'mod_rebar',
   'mod_rebar_leng', 'layout_body'].map(f => '<script src="/design/' + f + '.js"></script>').join('') +
  '<script>window.addEventListener("DOMContentLoaded",function(){' +
  'initLayout({visits:1,totalVisits:2});});</script></body></html>';

const mime = f => f.endsWith('.css') ? 'text/css'
  : f.endsWith('.js') ? 'application/javascript'
  : f.endsWith('.html') ? 'text/html'
  : f.endsWith('.csv') ? 'text/csv' : 'application/octet-stream';

async function wire(page) {
  await page.route('**/*', route => {
    const raw = route.request().url();
    if (raw.startsWith('file:') || raw.startsWith('data:')) return route.continue();
    const u = new URL(raw), p = u.pathname;
    if (u.hostname === 'shoot.test' && p === '/host.html')
      return route.fulfill({ contentType: 'text/html', body: HOST });
    if (p.startsWith('/design/')) {                       // design 저장소
      const f = DZ + '/' + p.slice(8);
      if (fs.existsSync(f)) return route.fulfill({ contentType: mime(f), body: fs.readFileSync(f) });
    }
    if (u.hostname === 'macrobim.github.io') {            // 앱이 받아 오는 엔진 파일
      const rel = p.replace(/^\/(macroBIM|design)\//, '');
      for (const base of [MB, DZ]) {
        const f = base + '/' + rel;
        if (fs.existsSync(f)) return route.fulfill({ contentType: mime(f), body: fs.readFileSync(f) });
      }
    }
    if (u.hostname.includes('fonts.') || u.hostname.includes('cdnjs') || u.hostname.includes('unpkg'))
      return route.abort();                               // 폰트·아이콘은 위에서 인라인했다
    return route.abort();
  });
}

/* ── 커서. 연출은 이것뿐이고, 눌리는 것은 앱 자신의 핸들러다. ──────────── */
let app;
async function pointer() {
  await app.evaluate(() => {
    if (document.getElementById('__cur')) return;
    const d = document.createElement('div');
    d.id = '__cur';
    d.style.cssText = 'position:fixed;z-index:99999;pointer-events:none;left:-99px;top:-99px;' +
      'filter:drop-shadow(0 3px 7px rgba(0,0,0,.55))';
    d.innerHTML = '<svg viewBox="0 0 24 32" width="26" height="35">' +
      '<path d="M2 1 L2 25 L8 19.6 L12.2 29 L16.4 27 L12.2 17.8 L20 17.8 Z"' +
      ' fill="#fff" stroke="#0f172a" stroke-width="1.7" stroke-linejoin="round"/></svg>';
    document.body.appendChild(d);
  });
}
const curTo = (x, y) => app.evaluate(p => {
  const d = document.getElementById('__cur');
  if (d) { d.style.left = p.x + 'px'; d.style.top = p.y + 'px'; }
}, { x: Math.round(x), y: Math.round(y) });
const hideCur = () => app.evaluate(() => {
  const d = document.getElementById('__cur'); if (d) d.style.left = '-99px';
});
const boxOf = sel => app.evaluate(q => {
  const e = document.querySelector(q); if (!e) return null;
  const r = e.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
}, sel);

const shot = dur => app.screenshot({ type: 'png' }).then(b => put(b, dur));
const ease = u => u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
const mix = (a, b, u) => a + (b - a) * u;
async function move(dur, fn) {
  const k = Math.max(1, Math.round(dur * MO));
  for (let i = 0; i < k; i++) { await fn(k === 1 ? 0 : i / (k - 1), i, k); await shot(dur / k); }
}
async function glide(dur, from, to) {                     // 커서를 옮기며 찍는다
  await move(dur, async u => { const e = ease(u); await curTo(mix(from.x, to.x, e), mix(from.y, to.y, e)); });
}
async function clickAt(sel) {                             // 커서를 올리고 진짜로 누른다
  const b = await boxOf(sel);
  await curTo(b.cx, b.cy);
  await app.click(sel);
  return b;
}

/* 값은 진짜로 친다 — 포커스, 키 입력, change, blur */
async function typeInto(sel, val, dur) {
  const b = await boxOf(sel);
  await curTo(b.cx, b.cy);
  await app.click(sel);
  await app.fill(sel, '');
  const s = String(val);
  const per = Math.max(1, Math.round((dur * MO) / (s.length + 2)));
  for (let i = 0; i < s.length; i++) {
    await app.type(sel, s[i], { delay: 0 });
    for (let k = 0; k < per; k++) await shot(1 / MO);
  }
  await app.dispatchEvent(sel, 'change');
  await app.evaluate(q => document.querySelector(q).blur(), sel);
  await app.waitForTimeout(120);
}

(async () => {
  const br = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--force-device-scale-factor=1'] });
  const ctx = await br.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 });
  app = await ctx.newPage();
  await wire(app);

  await app.goto('http://shoot.test/host.html', { waitUntil: 'load', timeout: 60000 });
  await app.evaluate(() => document.fonts.load('600 15px Inter').then(() => document.fonts.ready)).catch(() => {});
  await app.waitForTimeout(600);
  await pointer();

  /* ── 3번 컷을 위해 홈에서 시작한다. 먼저 Drawings 를 펴고 PSC 를 누른다. ── */

  /* 1 — 형상. 가이드가 그려진 화면에서 천천히 밀고 들어간다. */
  await app.evaluate(() => { showPage('draw-psc'); });
  await app.waitForFunction(() => window.PSC && document.querySelector('#box12cell_guide svg'), null, { timeout: 60000 });
  await app.waitForTimeout(900);
  await hideCur();
  const gb = await boxOf('#box12cell_guide');
  await move(3.0, async u => {
    await app.mouse.move(gb.cx, gb.cy);
    if (u > 0) await app.mouse.wheel(0, -55);             // 앱 자신의 휠 줌
  });
  await shot(2.0);
  caption('c01', 0, 5);

  /* 2 — 타이틀 카드. 카드가 화면을 다 덮으므로 바탕 프레임은 아무거나. */
  await shot(4);
  caption('t02', T - 4, 4);

  /* 3 — 문턱 없음. 홈으로 돌아가 진짜 클릭 두 번으로 들어온다. */
  await app.evaluate(() => { showPage('home'); });
  await app.waitForTimeout(500);
  await curTo(VW * 0.42, VH * 0.55);
  const c3 = T;
  await glide(1.6, { x: VW * 0.42, y: VH * 0.55 }, await boxOf('#drawingsToggle').then(b => ({ x: b.cx, y: b.cy })));
  await clickAt('#drawingsToggle'); await app.waitForTimeout(280); await shot(0.7);
  const pscA = await boxOf('#drawings-sub a[data-page="draw-psc"]');
  await glide(1.1, await boxOf('#drawingsToggle').then(b => ({ x: b.cx, y: b.cy })), { x: pscA.cx, y: pscA.cy });
  await clickAt('#drawings-sub a[data-page="draw-psc"]');
  await app.waitForFunction(() => window.PSC && document.querySelector('#box12cell_guide svg'), null, { timeout: 60000 });
  await app.waitForTimeout(700);
  await hideCur(); await shot(2.2);
  caption('c03', c3, T - c3);

  /* 4 — 표를 위에서 아래로 훑는다. 36행·Begin/End 두 열·입력칸 130개. */
  const c4 = T;
  await shot(1.2);
  await move(3.4, async u => { await app.evaluate(v => {
    const e = document.getElementById('box12cell_vartable');
    e.scrollTop = v * (e.scrollHeight - e.clientHeight);
  }, ease(u)); });
  await app.evaluate(() => { document.getElementById('box12cell_vartable').scrollTop = 0; });
  await shot(1.4);
  caption('c04', c4, T - c4);

  /* 5 — 셀. 라디오 한 번에 중앙 복부가 서고 2 Cell 그룹행이 나타난다. */
  const c5 = T;
  await clickAt('input[name="box12cell_ncell"][value="2"]'); await app.waitForTimeout(450);
  await hideCur(); await shot(4.2);
  await clickAt('input[name="box12cell_ncell"][value="1"]'); await app.waitForTimeout(450);
  await hideCur(); await shot(2.4);
  caption('c05', c5, T - c5);

  /* 6 — 대칭. 왼쪽을 치면 오른쪽이 따라오고, 체크하면 풀린다. */
  const c6 = T;
  await typeInto('#WL_s', '8000', 1.6); await shot(2.0);
  await clickAt('#asym_WR'); await app.waitForTimeout(250); await shot(1.0);
  await typeInto('#WR_s', '5000', 1.6); await hideCur(); await shot(2.6);
  await app.evaluate(() => {
    document.getElementById('asym_WR').checked = false;
    PSC.onAsymToggle('WL', 'WR', false);
    document.getElementById('WL_s').value = '6800'; PSC.onSymLeft('WL', 'WR'); PSC.redraw();
  });
  await app.waitForTimeout(300);
  caption('c06', c6, T - c6);

  /* 7 — 편경사. 한쪽씩 데크가 기운다. 바꾸고 되돌린다. */
  const c7 = T;
  await typeInto('#SLL_s', '6', 0.9);  await hideCur(); await shot(1.6);
  await typeInto('#SLL_s', '2', 0.7);  await shot(0.5);
  await typeInto('#SLR_s', '-6', 1.0); await hideCur(); await shot(1.6);
  await typeInto('#SLR_s', '-2', 0.8); await shot(0.6);
  caption('c07', c7, T - c7);

  /* 7b — 하부 슬래브. 좌가 내려가고 우가 올라간다. */
  const c7b = T;
  await typeInto('#SLB_s', '3', 0.8); await hideCur(); await shot(2.2);
  await typeInto('#SLB_s', '0', 0.8); await shot(0.6);
  caption('c07b', c7b, T - c7b);

  /* 7c — 형고. 깊어지되 데크는 제자리. */
  const c7c = T;
  await typeInto('#TH_s', '4200', 1.3); await hideCur(); await shot(3.0);
  await typeInto('#TH_s', '3000', 1.3); await shot(0.8);
  caption('c07c', c7c, T - c7c);

  /* 8 — 산술. 칸이 식을 받는다. */
  const c8 = T;
  await typeInto('#WL_s', '13600/2', 2.0);
  await hideCur(); await shot(4.0);
  caption('c08', c8, T - c8);

  /* 9 — 끝단면만 다르게. 가이드는 시작단면이라 그대로다. */
  const c9 = T;
  await typeInto('#TH_e', '2200', 1.3);
  await typeInto('#WL_e', '5200', 1.3);
  await app.evaluate(() => { document.getElementById('asym_WR').checked = true; PSC.onAsymToggle('WL','WR',true);
                             document.getElementById('WR_e').value = '5200'; });
  await typeInto('#WBL_e', '3000', 1.3);
  await app.evaluate(() => { document.getElementById('WBR_e').value = '3000'; PSC.redraw(); });
  await hideCur(); await shot(5.0);
  caption('c09', c9, T - c9);

  /* 10 — 배치입력. 3줄을 붙여넣으면 130칸이 한 번에 바뀐다. */
  const c10 = T;
  const tb = await boxOf('#pscBatch');
  await curTo(tb.cx, tb.cy); await shot(0.8);
  await app.evaluate(() => {
    const keys = adefs_box12cell.map(d => d[0]);
    const b = keys.map(k => document.getElementById(k + '_s').value);
    const e = b.slice();
    const set = (k, v) => { e[keys.indexOf(k)] = v; };
    set('TH', '2200'); set('WL', '5200'); set('WR', '5200'); set('WBL', '3000'); set('WBR', '3000');
    window.__csv = b.join(',') + '\n' + e.join(',') + '\n2';
  });
  const csv = await app.evaluate(() => window.__csv);
  const lines = csv.split('\n');
  for (let li = 0; li < lines.length; li++) {           // 붙여넣기를 줄 단위로 보여준다
    await app.evaluate(t => { document.getElementById('pscBatch').value = t; },
      lines.slice(0, li + 1).join('\n'));
    await shot(0.5);
  }
  await app.evaluate(() => { document.getElementById('pscBatch').dispatchEvent(new Event('change')); });
  await app.waitForTimeout(400);
  await hideCur(); await shot(5.5);
  caption('c10', c10, T - c10);

  /* 11 — 되받아쓰기. 칸을 고치면 CSV 가 따라 바뀐다. */
  const c11 = T;
  await typeInto('#TTS_s', '350', 1.2);
  await hideCur(); await shot(4.0);
  caption('c11', c11, T - c11);

  /* 12 — 가이드 줌·팬, 그리고 REGEN 으로 복귀. */
  const c12 = T;
  const g2 = await boxOf('#box12cell_guide');
  await app.mouse.move(g2.cx - g2.w * 0.22, g2.cy + g2.h * 0.18);
  await move(2.2, async u => { if (u > 0) await app.mouse.wheel(0, -60); });
  await shot(1.6);
  await clickAt('#box12cell_guide [data-guide-regen]'); await app.waitForTimeout(400);
  await hideCur(); await shot(2.4);
  caption('c12', c12, T - c12);

  /* 13 — DXF. 앱이 만든 파일을 받아 그대로 그린다. */
  const dxf = await app.evaluate(() => {
    let cap = null;
    const orig = window.dxf_generator;
    window.dxf_generator = function () { const o = orig(); o.download = function () { cap = o.print(); }; return o; };
    PSC.sectionDXF();
    window.dxf_generator = orig;
    return cap;
  });
  fs.writeFileSync(SP + '/PSC.dxf', dxf);
  cp.execFileSync('node', [SP + '/dxf2svg_psc.js', SP + '/PSC.dxf', SP + '/PSC.svg'], { stdio: 'inherit' });
  fs.writeFileSync(SP + '/psc_dxf.html',
    '<!doctype html><meta charset="utf-8"><style>' + FONTCSS +
    'html,body{margin:0;background:#fff;height:100%}' +
    'body{display:flex;align-items:center;justify-content:center;padding:26px}' +
    'img{width:100%;height:100%;object-fit:contain}</style>' +
    '<img src="PSC.svg">');

  const c13 = T;
  const doc = await ctx.newPage();
  await doc.setViewportSize({ width: VW, height: VH });
  await doc.goto('file://' + SP + '/psc_dxf.html', { waitUntil: 'load' });
  await doc.waitForTimeout(700);
  const dshot = dur => doc.screenshot({ type: 'png' }).then(b => put(b, dur));
  await dshot(6.0);
  await doc.evaluate(() => {                            // 평면도 쪽으로 천천히 밀고 들어간다
    const i = document.querySelector('img');
    i.style.transition = 'none'; i.style.transformOrigin = '50% 22%';
  });
  for (let s = 1; s <= 12; s++) {
    await doc.evaluate(k => { document.querySelector('img').style.transform = 'scale(' + (1 + k * 0.055) + ')'; }, s);
    await dshot(0.16);
  }
  await dshot(4.0);
  caption('c13', c13, T - c13);

  /* 14 — 로고. */
  await doc.evaluate(() => { document.querySelector('img').style.display = 'none'; });
  await dshot(5);
  caption('o14', T - 5, 5);

  save();
  console.log('\n' + n + ' stills · ' + caps.length + ' captions · ' + T.toFixed(2) + ' s');
  console.log('shots_psc.json 기록 완료');
  await br.close();
})();
