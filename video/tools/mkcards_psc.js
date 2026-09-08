/* PSC 영상의 자막 카드. plate3d/video/tools/mkcards_splice.js 와 같은 방식 —
   진짜 Inter 로 페이지를 그려 알파 채널째 스크린샷한다.

   문구는 전부 video/SCRIPT_PSC.md 4장(자막 뼈대)에서 온다. 거기가 바뀌면
   여기서 바꾸고 다른 데서는 바꾸지 않는다.

   카드는 1920×1080 으로 짜고 촬영기가 2배(3840×2160)로 뜬다. 최종이
   2560×1440 이므로 확대가 아니라 축소로 들어간다.                        */
const fs = require('fs');
const FONTCSS = fs.readFileSync(__dirname + '/v_font.css', 'utf8');
const OUT = __dirname + '/psc';
fs.mkdirSync(OUT, { recursive: true });

const FONT = `<meta charset="utf-8">\n<style>${FONTCSS}</style>`;
const BASE = `*{margin:0;padding:0;box-sizing:border-box}
 html,body{width:1920px;height:1080px;overflow:hidden}
 body{font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}`;
const w = (id, html) => fs.writeFileSync(OUT + '/s_' + id + '.html', FONT + html);

/* ---- 자막 알약, 아래 가운데. 흰 도면 위에도 회색 표 위에도 읽혀야 하므로
   제 바탕을 갖고 다닌다. 기울임(em)은 스크립트에서 이탤릭으로 적힌 줄. */
function pill(id, lines, size, italic) {
  const body = lines.map(s => '<span>' + s + '</span>').join('');
  w(id, `<style>${BASE}
 body{background:transparent;display:flex;align-items:flex-end;justify-content:center;
      padding-bottom:84px}
 .pill{background:#0f172a;color:#fff;font-weight:${italic ? 500 : 600};
      font-style:${italic ? 'italic' : 'normal'};font-size:${size || 46}px;
      letter-spacing:-.015em;padding:${lines.length > 1 ? '24px 52px' : '26px 54px'};
      border-radius:${lines.length > 1 ? '34px' : '999px'};
      box-shadow:0 18px 50px rgba(15,23,42,.35);
      display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center}
 .pill span{display:block;line-height:1.24}
</style><div class="pill">${body}</div>`);
}

pill('c01', ['This section.'], 50);
pill('c03', ['Nothing to download.', 'It is already open.'], 46, true);
pill('c04', ['Every dimension twice.', 'Begin and end.'], 48);
pill('c05', ['One cell or two.', 'One click.'], 50);
pill('c06', ['Type the left.', 'The right follows —', 'until you say no.'], 46);
pill('c07', ['Each side', 'has its own slope.'], 48);
pill('c07b', ['The bottom slab, too.'], 46, true);
pill('c07c', ['Change the depth.', 'The deck stays put.'], 48);
pill('c08', ['A box takes arithmetic.'], 46, true);
pill('c09', ['A tapered girder —', 'two sections and the distance.'], 46);
pill('c10', ['Begin, end, type, length.', 'One line each.'], 48);
pill('c10b', ['One paste.', 'Every box.'], 50);
pill('c11', ['It writes itself back.'], 46, true);
pill('c12', ['Zoom in on any dimension.'], 46, true);
pill('c13', ['Both sections.', 'Both slab plans.'], 50);

/* ---- 타이틀 카드, 2번 컷. 두 줄 다 마침표로 끊는다. 색은 앱의 파랑(#2563eb)
   계열에서 한 칸 밝은 쪽.
   첫 판은 둘째 줄이 "SIXTY-FIVE BOXES." 였다 — 입력칸 65개를 뜻했는데 윗줄이
   BOX GIRDER 라서 "박스거더 65개" 로 읽혔다. 무엇이 들어가고 무엇이 나오는지로
   바꿨다. */
w('t02', `<style>${BASE}
 body{background:#0b1220;display:flex;flex-direction:column;align-items:center;
      justify-content:center;gap:10px}
 .l{font-weight:800;font-size:104px;letter-spacing:-.05em;color:#fff;line-height:1.08;text-align:center}
 .l.b{color:#38bdf8}
</style><div class="l">PSC BOX GIRDER.</div><div class="l b">DIMENSIONS IN. DXF OUT.</div>`);

/* ---- 아웃트로, 14번 컷 ---- */
w('o14', `<style>${BASE}
 body{background:#fff;display:flex;flex-direction:column;align-items:center;
      justify-content:center;gap:34px}
 .w{font-weight:800;font-size:126px;letter-spacing:-.045em;color:#0f172a}
 .w b{color:#1d4ed8}
 .u{font-weight:500;font-size:32px;color:#64748b;letter-spacing:.01em}
</style><div class="w">macro<b>BIM</b></div>
<div class="u">www.macroBIM.com</div>`);

console.log('wrote ' + fs.readdirSync(OUT).filter(f => f.endsWith('.html')).length + ' cards to video/tools/psc/');
