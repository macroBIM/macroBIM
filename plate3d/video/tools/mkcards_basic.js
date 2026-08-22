/* Cards for the teaching film. Same machinery and the same look as the splice
   film's - real Inter drawn as a page and screenshotted with an alpha channel -
   written into tools/basic/ so the three films' cards cannot be mixed up.

   The pill, the title card and the outro are copied from mkcards_splice.js
   unchanged. They are the look of the channel now; a teaching film is not a
   reason to redraw them.

   One card type is new, because the script asks for something the promos never
   needed: a section card that opens a chapter with a question, laid over a live
   frame rather than replacing it. It is the title card's typeface and accent at
   a smaller size, over a scrim dark enough to read against a bright viewport.

   The copy is SCRIPT_BASIC.md section 6, verbatim. If a caption changes, change
   it there first and then here - the two must not drift.                     */
const fs = require('fs');
const FONTCSS = fs.readFileSync(__dirname + '/v_font.css', 'utf8');
const OUT = __dirname + '/basic';
fs.mkdirSync(OUT, { recursive: true });

const FONT = `<meta charset="utf-8">\n<style>${FONTCSS}</style>`;
const BASE = `*{margin:0;padding:0;box-sizing:border-box}
 html,body{width:1920px;height:1080px;overflow:hidden}
 body{font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}`;
const w = (id, html) => fs.writeFileSync(OUT + '/b_' + id + '.html', FONT + html);

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
  ['c01', ['This is one spreadsheet.',
           'By the end you will be able to write it.'], 48],
  ['c03', ['The file this video uses.'], 46],
  ['c04', ['One PLATE row is one part.'], 50],
  ['c05', ['Three shapes. RECT, TRAP, CIRC.'], 48],
  ['c06', ['WT = WB is a rectangle. WT = 0 is a triangle.'], 42],
  ['c07', ['Nine points. t/m/b × l/c/r.'], 50],
  ['c08', ['On the real outline, not a bounding box.'], 46],
  ['c09', ['base.pt lands on the coordinate you type.'], 46],
  ['c11', ['HOLE is a shape, not a part.',
           'No steel — but it still has an origin.'], 46],
  ['c12', ['L.X L.Y is measured from the plate\'s origin —',
           'the nine-point you chose on the PLATE row.'], 44],
  ['c13', ['dx dy repeat — the first axis.'], 48],
  ['c14', ['dx2 dy2 repeat2 — the second.',
           'Two rows just became one.'], 48],
  ['c15', ['A shape can be another plate —',
           'and it lands by its own base.pt.'], 46],
  ['c17', ['PLATE defines. MODULE uses.'], 50],
  ['c18', ['PLANE is a column in the MODULE row.'], 44],
  ['c19', ['One plate. Three planes.',
           'XY lies flat. XZ and YZ stand it up.'], 46],
  ['c20', ['Tick local axes —',
           'the arrow points at the plus side.'], 46],
  ['c21', ['One coordinate typed.',
           'Three different faces landing on it.'], 46],
  ['c22', ['Tick + / − face to check which is which.'], 44],
  ['c23', ['The same eight columns, in MODULE.',
           'Four rows became one. The model did not move.'], 42],
  ['c24', ['BASE is the module\'s datum. Required.'], 46],
  ['c25', ['Read where it sits, and type that in ASSY.'], 46],
  ['c26', ['ASSY places a module in the world.'], 48],
  ['c27', ['MIR — mirrored about a plane you name.'], 46],
  ['c28', ['COPY — pushed along, repeat times.'], 46],
  ['c29', ['ROT — swung round an axis, repeat times.'], 46],
  ['c30', ['PLATE. CUT. MODULE. ASSY.',
           'That is the whole model.'], 48]
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
</style><div class="l">HOW TO USE</div><div class="l b">PLATE &amp; CUT</div>`);

/* ---- section cards, cuts 10 and 16.

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
section('s10', 'Every plate has holes.', 'Where do they come from?');
section('s16', 'The parts exist.', 'Now stand them up.');

/* ---- outro, cut 31. Same card the splice film closes on. ---- */
w('o31', `<style>${BASE}
 body{background:#fff;display:flex;flex-direction:column;align-items:center;
      justify-content:center;gap:34px}
 .w{font-weight:800;font-size:130px;letter-spacing:-.045em;color:#0f172a}
 .w b{color:#1d4ed8}
 .t{font-weight:600;font-size:40px;color:#1d4ed8;letter-spacing:-.015em}
 .u{font-weight:500;font-size:32px;color:#64748b;letter-spacing:.01em}
</style><div class="w">PLATE<b>3D</b></div>
<div class="t">by macroBIM</div>
<div class="u">www.macroBIM.com</div>`);

console.log('wrote ' + (CAPS.length + 4) + ' cards to tools/basic/  ·  ' +
            CAPS.length + ' captions, 1 title, 2 section, 1 outro');
