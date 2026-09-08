/* PSC 썸네일. 대본 3장에 적은 문구 그대로 — PSC BOX GIRDER / SECTION & SLAB PLANS.

   그림은 앱이 만든 도면(PSC.svg)을 그대로 씁니다. 네 장이 다 들어가야 합니다 —
   확대해서 뷰 제목이 잘리면 도면이 잘못 나온 것처럼 보입니다.

     node mkthumb_psc.js                                                     */
const { chromium } = require('playwright-core');
const fs = require('fs');
const SP = __dirname;
const FONTCSS = fs.readFileSync(SP + '/v_font.css', 'utf8');
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const HTML = `<!doctype html><meta charset="utf-8"><style>${FONTCSS}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1280px;height:720px;overflow:hidden}
body{font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;
     background:#0b1220;display:flex;align-items:stretch}
.l{width:512px;flex:none;padding:64px 44px;display:flex;flex-direction:column;justify-content:center;gap:18px}
.k{font-weight:800;font-size:74px;line-height:1.02;letter-spacing:-.045em;color:#fff}
.k b{color:#38bdf8;display:block}
.s{font-weight:600;font-size:27px;letter-spacing:-.01em;color:#94a3b8;line-height:1.3}
.r{flex:1;background:#fff;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;padding:26px 30px 30px}
.r img{width:100%;height:100%;object-fit:contain}
.tag{position:absolute;left:0;bottom:0;background:#1d4ed8;color:#fff;font-weight:700;
     font-size:22px;letter-spacing:.10em;padding:12px 22px}
</style>
<div class="l"><div class="k">PSC BOX<b>GIRDER</b></div>
<div class="s">Section &amp; slab plans,<br>straight to DXF</div></div>
<div class="r"><img src="PSC.svg"><div class="tag">macroBIM</div></div>`;

(async () => {
  fs.writeFileSync(SP + '/thumb_psc.html', HTML);
  const b = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  await p.goto('file://' + SP + '/thumb_psc.html', { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.load('800 74px Inter').then(() => document.fonts.ready)).catch(() => {});
  await p.waitForTimeout(400);
  await p.screenshot({ path: SP + '/../PSC_thumb.jpg', type: 'jpeg', quality: 94 });
  const sz = fs.statSync(SP + '/../PSC_thumb.jpg').size;
  console.log('PSC_thumb.jpg — 2560x1440 · ' + (sz / 1024).toFixed(0) + ' KB');
  await b.close();
})();
