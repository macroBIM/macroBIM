/* Cards for the splice film. Same machinery as the tower's - real Inter drawn
   as a page and screenshotted with an alpha channel - but written into
   tools/splice/ so the two films' cards cannot be mistaken for each other.

   The copy all comes from SCRIPT_SPLICE.md section 2. If that block changes,
   change it here and nowhere else.                                          */
const fs = require('fs');
const FONTCSS = fs.readFileSync(__dirname + '/v_font.css', 'utf8');
const OUT = __dirname + '/splice';
fs.mkdirSync(OUT, { recursive: true });

const FONT = `<meta charset="utf-8">\n<style>${FONTCSS}</style>`;
const BASE = `*{margin:0;padding:0;box-sizing:border-box}
 html,body{width:1920px;height:1080px;overflow:hidden}
 body{font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}`;
const w = (id, html) => fs.writeFileSync(OUT + '/s_' + id + '.html', FONT + html);

/* ---- caption pill, bottom centre. It has to read over a near-black viewport
   and over a white drawing in the same film, so it carries its own ground. */
function pill(id, lines, size) {
  const body = lines.map(s => '<span>' + s + '</span>').join('');
  w(id, `<style>${BASE}
 body{background:transparent;display:flex;align-items:flex-end;justify-content:center;
      padding-bottom:84px}
 .pill{background:#0f172a;color:#fff;font-weight:600;font-size:${size || 46}px;
      letter-spacing:-.015em;padding:${lines.length > 1 ? '24px 52px' : '26px 54px'};
      border-radius:${lines.length > 1 ? '34px' : '999px'};
      box-shadow:0 18px 50px rgba(15,23,42,.35);
      display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center}
 .pill span{display:block;line-height:1.24}
</style><div class="pill">${body}</div>`);
}

pill('c01', ['Type it in a spreadsheet.',
             'See it in 3D — right in your browser.'], 48);
pill('c03', ['No install. Just a browser.'], 46);
pill('c04', ['Download the example.', 'Now you have a splice.'], 48);
pill('c05', ['Pick a section.', 'The joint follows.'], 50);
pill('c09', ['The take-off comes with it.'], 48);
pill('c10', ['So does the shop drawing.'], 48);
pill('c12', ['The spreadsheet you already know.',
             'One joint, fully detailed.'], 48);

/* ---- title card, cut 2. The difficulty is named, not explained - anyone who
   details connections already knows why it is hard. Both lines stop with a
   full stop; that is the rhythm, not a typo. */
w('t02', `<style>${BASE}
 body{background:#0b1220;display:flex;flex-direction:column;align-items:center;
      justify-content:center;gap:10px}
 .l{font-weight:800;font-size:132px;letter-spacing:-.05em;color:#fff;line-height:1.06}
 .l.b{color:#38bdf8}
</style><div class="l">BOLTED CONNECTIONS.</div><div class="l b">MADE SIMPLE.</div>`);

/* ---- cut 12, the three deliverables side by side. The pill carries the copy;
   this is only the ground. The panels are filled by the capture pass with what
   it actually produced - the model off the canvas and the two pages as they
   stood in cuts 9 and 10 - so the three ids below are the contract with it. */
w('d12', `<style>${BASE}
 body{background:#0b1220;display:flex;align-items:center;justify-content:center;gap:44px;
      padding:118px 88px}
 .p{flex:1;height:100%;background:#fff;border-radius:20px;overflow:hidden;
    box-shadow:0 26px 70px rgba(2,6,23,.55);display:flex;flex-direction:column}
 .p .h{background:#0f172a;color:#fff;font:700 30px/1 Inter,sans-serif;padding:22px 26px;
       letter-spacing:.01em}
 .p .b{flex:1;background:#f8fafc no-repeat top center;background-size:cover}
</style><div class="p"><div class="h">MODEL</div><div class="b" id="b1"></div></div>
<div class="p"><div class="h">TAKE-OFF</div><div class="b" id="b2"></div></div>
<div class="p"><div class="h">SHOP DRAWING</div><div class="b" id="b3"></div></div>`);

/* ---- outro, cut 13 ---- */
w('o13', `<style>${BASE}
 body{background:#fff;display:flex;flex-direction:column;align-items:center;
      justify-content:center;gap:34px}
 .w{font-weight:800;font-size:130px;letter-spacing:-.045em;color:#0f172a}
 .w b{color:#1d4ed8}
 .t{font-weight:600;font-size:40px;color:#1d4ed8;letter-spacing:-.015em}
 .u{font-weight:500;font-size:32px;color:#64748b;letter-spacing:.01em}
</style><div class="w">PLATE<b>3D</b></div>
<div class="t">by macroBIM</div>
<div class="u">www.macroBIM.com</div>`);

console.log('wrote 10 cards to tools/splice/');
