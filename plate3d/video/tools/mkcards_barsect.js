/* Cards for Basics 03, BAR & SECT. Same machinery and the same look as the splice
   film's - real Inter drawn as a page and screenshotted with an alpha channel -
   written into tools/basic/ so the three films' cards cannot be mixed up.

   The pill, the title card and the outro are copied from mkcards_splice.js
   unchanged. They are the look of the channel now; a teaching film is not a
   reason to redraw them.

   One card type is new, because the script asks for something the promos never
   needed: a section card that opens a chapter with a question, laid over a live
   frame rather than replacing it. It is the title card's typeface and accent at
   a smaller size, over a scrim dark enough to read against a bright viewport.

   The copy is SCRIPT_BARSECT.md section 5, verbatim. If a caption changes, change
   it there first and then here - the two must not drift.                     */
const fs = require('fs');
const FONTCSS = fs.readFileSync(__dirname + '/v_font.css', 'utf8');
const OUT = __dirname + '/barsect';
fs.mkdirSync(OUT, { recursive: true });

const FONT = `<meta charset="utf-8">\n<style>${FONTCSS}</style>`;
const BASE = `*{margin:0;padding:0;box-sizing:border-box}
 html,body{width:1920px;height:1080px;overflow:hidden}
 body{font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}`;
const w = (id, html) => fs.writeFileSync(OUT + '/s3_' + id + '.html', FONT + html);

/* ---- caption pill, bottom centre. Identical to the splice film's: it has to
   read over a near-black viewport and over a white sheet in the same film, so
   it carries its own ground. */
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

/* One entry per cut that carries a caption. The number is the cut number in
   SCRIPT_BASIC.md, so a caption can be found from the script and the other way
   round without counting. Two-line captions are set a touch smaller. */
const CAPS = [
  ['c01', ['Not every part is a plate.',
           'Some are a profile with a length.'], 46],
  ['c03', ['The app keeps them in three tables.',
           'They are made differently.'], 46],
  ['c04', ['A plate is a shape.',
           'A bar is round. A section is a profile you dimension.'], 42],
  ['c05', ['BAR is a round bar. Nothing else.',
           'Material, diameter, length.'], 46],
  ['c06', ['One number decides the shape: the diameter.'], 42],
  ['c07', ['SECT is a section — H, C or L.',
           'That is the skeleton. The numbers after it are the shape.'], 42],
  ['c08', ['There is no section table in here.',
           'You type the dimensions — and it draws them.'], 42],
  ['c09', ['H takes seven.',
           'Top and bottom flange are separate — width and thickness.'], 42],
  ['c10', ['C and L take six each — and the six mean different things.'], 42],
  ['c11', ['Leave r blank and that corner comes out square.'], 42],
  ['c12', ['Standard or custom, it is the same row.',
           'Nothing in here is looking anything up.'], 44],
  ['c14', ['One keyword, two grammars.',
           'The eighth column decides.'], 48],
  ['c15', ['A plane name: stand it here, run it the plane\'s way.',
           'XY is +Z. XZ is −Y. YZ is +X.'], 42],
  ['c16', ['Two points instead.',
           'Stretch it from here, to there.'], 46],
  ['c17', ['Then the Length in the SECT row is only a reference.',
           'The app says so.'], 42],
  ['c19', ['Type the node. Then trim the steel.'], 46],
  ['c20', ['Positive pulls back from the node.'], 46],
  ['c21', ['Negative runs past it —',
           'into a gusset, into a base plate.'], 46],
  ['c22', ['Real length is the distance, less both ends.'], 42],
  ['c23', ['Alpha turns it about its own axis.',
           'The two points do not move.'], 46],
  ['c25', ['dx dy dz repeat, twice over.',
           'On both grammars.'], 48],
  ['c26', ['ASSY places what a MODULE built.'], 46],
  ['c27', ['MIR — mirrored about a plane you name.'], 44],
  ['c28', ['COPY — pushed along, repeat times.'], 46],
  ['c29', ['ROT — swung round an axis, repeat times.'], 44],
  ['c30', ['A bar can skip the module',
           'and go straight into the assembly.'], 46],
  ['c31', ['CUT edits the profile.',
           'On a section the profile is the end view — so it runs the length.'], 42],
  ['c32', ['PLATE. BAR. SECT.',
           'One sheet.'], 50]
];
CAPS.forEach(c => pill(c[0], c[1], c[2]));

/* ---- title card, cut 2.

   "use" earns its place: in English, plate and cut are both verbs - to plate is
   to face something in metal, to cut is to cut. "How to plate & cut" reads as a
   fabrication process, not as software. With "use" in front, the two are
   plainly the sheet's keywords. */
w('t02', `<style>${BASE}
 body{background:#0b1220;display:flex;flex-direction:column;align-items:center;
      justify-content:center;gap:10px}
 .l{font-weight:800;font-size:132px;letter-spacing:-.05em;color:#fff;line-height:1.06}
 .l.b{color:#38bdf8}
</style><div class="l">HOW TO USE</div><div class="l b">BAR &amp; SECT</div>`);

/* ---- section cards, cuts 13, 18, 24.

   These open a chapter by asking rather than announcing, so the next stretch of
   film is an answer and nobody arrives at HOLE or MODULE wondering why it
   turned up. They sit over a live frame - a plate still on screen at 10, the
   parts lying flat at 17 - so the scrim is part of the card, not the page
   behind it. Small enough to read as a chapter heading, not the film's title.

   YouTube's chapter boundaries are set to these two, so jumping in from the
   contents lands on the question. */
function section(id, a, b) {
  w(id, `<style>${BASE}
 body{background:rgba(11,18,32,.86);display:flex;flex-direction:column;
      align-items:center;justify-content:center;gap:14px}
 .l{font-weight:800;font-size:82px;letter-spacing:-.04em;line-height:1.1;color:#fff}
 .l.b{color:#38bdf8}
</style><div class="l">${a}</div><div class="l b">${b}</div>`);
}
section('s13', 'A profile needs a length.', 'Where does it come from?');
section('s18', 'The two points are work lines.', 'The steel is not.');
section('s24', 'One row is one member.', 'How do you get a hundred?');

/* ---- outro, cut 33. Same card the splice film closes on. ---- */
w('o33', `<style>${BASE}
 body{background:#fff;display:flex;flex-direction:column;align-items:center;
      justify-content:center;gap:34px}
 .w{font-weight:800;font-size:130px;letter-spacing:-.045em;color:#0f172a}
 .w b{color:#1d4ed8}
 .t{font-weight:600;font-size:40px;color:#1d4ed8;letter-spacing:-.015em}
 .u{font-weight:500;font-size:32px;color:#64748b;letter-spacing:.01em}
</style><div class="w">PLATE<b>3D</b></div>
<div class="t">by macroBIM</div>
<div class="u">www.macroBIM.com</div>`);

console.log('wrote ' + (CAPS.length + 5) + ' cards to tools/barsect/  ·  ' +
            CAPS.length + ' captions, 1 title, 3 section, 1 outro');
