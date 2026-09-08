/* PSC 카드를 알파 채널째 스크린샷한다. 알약 자막은 배경을 빼고(omitBackground),
   타이틀·아웃트로처럼 바탕이 있어야 하는 카드는 그대로 둔다.

   deviceScaleFactor 2 — 1920×1080 페이지를 3840×2160 으로 뜬다. 최종이
   2560×1440 이라 조립 때 축소로 들어간다. 1배로 뜨면 거기서 확대가 되고,
   글자 가장자리가 뭉개진다.

   Inter 는 data: URL 이고 font-display:swap 이라 늦게 붙는다. 먼저 부르고
   fonts.ready 를 기다린 뒤에 찍는다 — 안 그러면 폴백 글꼴로 나간다.       */
const { chromium } = require('playwright-core');
const fs = require('fs');
const SP = __dirname + '/psc';
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

(async () => {
  const b = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  await p.route('**/fonts.{googleapis,gstatic}.com/**', r => r.abort());
  const files = fs.readdirSync(SP).filter(f => /^s_.*\.html$/.test(f)).sort();
  for (const f of files) {
    await p.goto('file://' + SP + '/' + f, { waitUntil: 'load', timeout: 20000 }).catch(() => {});
    await p.evaluate(() => document.fonts.load('600 46px Inter')
      .then(() => document.fonts.load('800 124px Inter'))
      .then(() => document.fonts.ready)).catch(() => {});
    await p.waitForTimeout(300);
    const solid = /^s_(t|o)\d/.test(f);                 // 타이틀·아웃트로만 바탕 유지
    await p.screenshot({ path: SP + '/' + f.replace('.html', '.png'), omitBackground: !solid });
  }
  console.log('rendered ' + files.length + ' cards @2x; Inter: ' +
    await p.evaluate(() => document.fonts.check('600 46px Inter')));
  await b.close();
})();
