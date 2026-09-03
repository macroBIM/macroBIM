/* Cards for the Simple connector film. Same machinery as the splice film's -
   real Inter drawn as a page and screenshotted with an alpha channel - written
   into tools/simpleconn/ so no two films' cards can be mistaken for each other.

   The copy all comes from SCRIPT_SIMPLECONN.md sections 2 and 4. If that block
   changes, change it here and nowhere else.

   One thing is new. This film is a guided tour, and its script writes two kinds
   of line: the claims, set bold, and the asides that name what is on screen,
   set italic. Fifteen identical pills would flatten that back out, so the aside
   gets a lighter pill - the same shape, the same ground, a lighter weight and a
   smaller size. Nothing new is introduced; the loud one is simply turned down. */
const fs = require('fs');
const FONTCSS = fs.readFileSync(__dirname + '/v_font.css', 'utf8');
const OUT = __dirname + '/simpleconn';
fs.mkdirSync(OUT, { recursive: true });

const FONT = `<meta charset="utf-8">\n<style>${FONTCSS}</style>`;
const BASE = `*{margin:0;padding:0;box-sizing:border-box}
 html,body{width:1920px;height:1080px;overflow:hidden}
 body{font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}`;
const w = (id, html) => fs.writeFileSync(OUT + '/s_' + id + '.html', FONT + html);

/* ---- caption pill, bottom centre. It has to read over a near-black viewport
   and over a white form in the same film, so it carries its own ground. */
function pill(id, lines, size, quiet) {
  const body = lines.map(s => '<span>' + s + '</span>').join('');
  w(id, `<style>${BASE}
 body{background:transparent;display:flex;align-items:flex-end;justify-content:center;
      padding-bottom:84px}
 .pill{background:#0f172a;color:${quiet ? '#e2e8f0' : '#fff'};
      font-weight:${quiet ? 500 : 600};font-size:${size || 46}px;
      letter-spacing:-.015em;padding:${lines.length > 1 ? '24px 52px' : '26px 54px'};
      border-radius:${lines.length > 1 ? '34px' : '999px'};
      box-shadow:0 18px 50px rgba(15,23,42,.35);
      display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center}
 .pill span{display:block;line-height:1.24}
</style><div class="pill">${body}</div>`);
}
const quiet = (id, lines, size) => pill(id, lines, size || 40, true);

/* The tour, one line per cut. Cut 2 and cut 16 are whole cards, below. */
pill('c01',  ['This joint.'], 52);
quiet('c03', ['Nothing to download. It is already open.'], 42);
pill('c04',  ['Everything it takes', 'is in six blocks.'], 48);
pill('c05',  ['Three pieces.', 'Put 0 in one and it goes.'], 48);
pill('c06',  ['Name the section.', 'Five boxes fill themselves.'], 48);
pill('c07',  ['Or a tube.', 'The detail follows.'], 48);
quiet('c08', ['Cover plates on an H. An end plate on a tube.'], 40);
quiet('c09', ['Every grip gets its own length.'], 42);
pill('c10',  ['Up to four.', 'Type a length, get a beam.'], 48);
pill('c11',  ['Declare a connection.', 'Name it against a beam.'], 48);
pill('c12',  ['Where they meet,', 'the flange comes off.'], 48);
quiet('c13', ['You set the room it leaves.'], 42);
quiet('c14', ['The drawings and the take-off come with it.'], 42);
pill('c15',  ['The spreadsheet', 'was there all along.'], 50);

/* ---- title card, cut 2. The first three films opened by claiming a
   spreadsheet could do this. This one opens by taking the spreadsheet away,
   because the whole film is about the threshold. Both lines stop with a full
   stop; that is the rhythm, not a typo. */
w('t02', `<style>${BASE}
 body{background:#0b1220;display:flex;flex-direction:column;align-items:center;
      justify-content:center;gap:10px}
 .l{font-weight:800;font-size:118px;letter-spacing:-.05em;color:#fff;line-height:1.06}
 .l.b{color:#38bdf8}
</style><div class="l">COLUMN-BEAM JOINTS.</div><div class="l b">NO SPREADSHEET.</div>`);

/* ---- outro, cut 16 ---- */
w('o16', `<style>${BASE}
 body{background:#fff;display:flex;flex-direction:column;align-items:center;
      justify-content:center;gap:34px}
 .w{font-weight:800;font-size:130px;letter-spacing:-.045em;color:#0f172a}
 .w b{color:#1d4ed8}
 .t{font-weight:600;font-size:40px;color:#1d4ed8;letter-spacing:-.015em}
 .u{font-weight:500;font-size:32px;color:#64748b;letter-spacing:.01em}
</style><div class="w">PLATE<b>3D</b></div>
<div class="t">by macroBIM</div>
<div class="u">www.macroBIM.com</div>`);

console.log('wrote ' + fs.readdirSync(OUT).filter(f => /\.html$/.test(f)).length +
            ' cards to tools/simpleconn/');
