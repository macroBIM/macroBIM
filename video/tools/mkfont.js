/* Inter, inlined. 촬영·카드 페이지는 네트워크 없이 뜨므로 폰트를 파일 안에 넣는다.
   plate3d/video/tools/v_font.css 와 같은 역할이고, 만드는 법을 남겨 둔 것뿐이다.
   latin 서브셋만 받는다 — 카드와 앱 화면에 쓰는 글자가 그것뿐이다.       */
const https = require('https');
const fs = require('fs');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const get = (url, bin) => new Promise((ok, no) => {
  https.get(url, { headers: { 'User-Agent': UA } }, r => {
    if (r.statusCode !== 200) return no(new Error(r.statusCode + ' ' + url));
    const c = []; r.on('data', d => c.push(d));
    r.on('end', () => ok(bin ? Buffer.concat(c) : Buffer.concat(c).toString('utf8')));
  }).on('error', no);
});
(async () => {
  const css = await get('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  const blocks = css.split('@font-face').slice(1);
  let out = '', n = 0;
  for (const b of blocks) {
    if (!/unicode-range:[^;]*U\+0000/.test(b) && !/latin/.test(b)) { /* latin 블록만 */ }
    const url = (b.match(/url\((https:[^)]+\.woff2)\)/) || [])[1];
    const wt = (b.match(/font-weight:\s*(\d+)/) || [])[1];
    const ur = (b.match(/unicode-range:\s*([^;]+);/) || [])[1] || '';
    if (!url || !ur.includes('U+0000')) continue;          // latin 기본 서브셋만
    const buf = await get(url, true);
    out += "@font-face{font-family:'Inter';font-style:normal;font-weight:" + wt +
           ";font-display:swap;src:url(data:font/woff2;base64," + buf.toString('base64') +
           ") format('woff2');}\n";
    n++;
  }
  fs.writeFileSync(__dirname + '/v_font.css', out);
  console.log('v_font.css — Inter ' + n + ' weights, ' + (out.length / 1024).toFixed(0) + ' KB');
})();
