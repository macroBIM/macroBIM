/* Cards for the tower-crane film. Real type - Inter, the face the app uses -
   drawn as pages and screenshotted with an alpha channel, so ffmpeg can lay
   them over the picture and fade them.

   Three kinds. A caption pill has to read over a near-black viewport and over a
   white spreadsheet in the same film, so it carries its own ground. A title card
   is the whole frame. A value chip sits top-right and says what one cell just
   did. */
const FONTCSS = require('fs').readFileSync(__dirname + '/v_font.css', 'utf8');
const fs = require('fs');
const OUT = __dirname;

const FONT = `<meta charset="utf-8">\n<style>${FONTCSS}</style>`;
const BASE = `*{margin:0;padding:0;box-sizing:border-box}
 html,body{width:1920px;height:1080px;overflow:hidden}
 body{font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}`;
const w = (id, html) => fs.writeFileSync(OUT + '/t_' + id + '.html', FONT + html);

/* ---- caption pill, bottom centre. Two lines when the copy is two sentences. */
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

pill('c01', ['What if you could transform a Tower Crane', 'with a Spreadsheet?'], 48);
pill('c03', ['Runs in the browser. Nothing to install.'], 44);
pill('c04', ['Download the example.', 'Now you have a crane.'], 48);
pill('c05', ['Change one number.', 'See the model respond.'], 50);
pill('c10', ['One spreadsheet. Any crane.'], 52);

/* ---- title card, cut 2. The whole frame, and both lines stop with a full
   stop - that is the rhythm of the line, not a typo. */
w('t02', `<style>${BASE}
 body{background:#0b1220;display:flex;flex-direction:column;align-items:center;
      justify-content:center;gap:10px}
 .l{font-weight:800;font-size:132px;letter-spacing:-.05em;color:#fff;line-height:1.06}
 .l.b{color:#38bdf8}
</style><div class="l">TOWER CRANE.</div><div class="l b">UNDER YOUR CONTROL.</div>`);

/* ---- value chip, top right: the cell, and what it did to the crane */
function chip(id, cell, from, to, label, was, now) {
  w(id, `<style>${BASE}
 body{background:transparent;display:flex;align-items:flex-start;justify-content:flex-end;
      padding:74px 92px 0 0}
 .box{background:rgba(15,23,42,.93);border-radius:22px;padding:28px 38px;color:#fff;
      font-variant-numeric:tabular-nums;min-width:430px}
 .cell{color:#94a3b8;font-size:23px;font-weight:500;letter-spacing:.02em}
 .num{font-size:52px;font-weight:800;letter-spacing:-.03em;margin:4px 0 14px;
      display:flex;align-items:baseline;gap:16px}
 .num .o{color:#64748b;text-decoration:line-through;font-size:38px;font-weight:600}
 .num .n{color:#38bdf8}
 .r{border-top:1px solid rgba(148,163,184,.28);padding-top:14px;
      display:flex;align-items:baseline;gap:14px}
 .r .k{color:#94a3b8;font-size:23px;font-weight:500}
 .r .v{font-size:30px;font-weight:700;margin-left:auto}
 .r .v i{color:#64748b;font-style:normal;font-weight:600}
</style><div class="box">
 <div class="cell">${cell}</div>
 <div class="num"><span class="o">${from}</span><span class="n">${to}</span></div>
 <div class="r"><span class="k">${label}</span>
   <span class="v"><i>${was}</i> &rarr; ${now}</span></div></div>`);
}
chip('v06', 'PARAM · Panels',    '15', '25',    'Height', '47.9 m', '71.9 m');
chip('v07', 'PARAM · Jib bays',  '15', '22',    'Reach',  '48.5 m', '69.5 m');
chip('v08', 'PARAM · Hook drop', '26020', '36000', 'Ground clearance', '12.1 m', '2.1 m');

/* the slew chip: the jib passes every angle in the beat, so it states the
   sweep rather than a number that would be wrong for all but one frame */
w('v09', `<style>${BASE}
 body{background:transparent;display:flex;align-items:flex-start;justify-content:flex-end;
      padding:74px 92px 0 0}
 .box{background:rgba(15,23,42,.93);border-radius:22px;padding:28px 38px;color:#fff;
      font-variant-numeric:tabular-nums;min-width:430px}
 .cell{color:#94a3b8;font-size:23px;font-weight:500;letter-spacing:.02em}
 .num{font-size:52px;font-weight:800;letter-spacing:-.03em;color:#38bdf8;margin:4px 0 14px}
 .r{border-top:1px solid rgba(148,163,184,.28);padding-top:14px;
      color:#94a3b8;font-size:23px;font-weight:500}
</style><div class="box">
 <div class="cell">PARAM · Jib angle</div>
 <div class="num">0 &rarr; 360&deg;</div>
 <div class="r">the mast stays put</div></div>`);

/* ---- outro, cut 11 ---- */
w('o11', `<style>${BASE}
 body{background:#fff;display:flex;flex-direction:column;align-items:center;
      justify-content:center;gap:34px}
 .w{font-weight:800;font-size:130px;letter-spacing:-.045em;color:#0f172a}
 .w b{color:#1d4ed8}
 .t{font-weight:600;font-size:40px;color:#1d4ed8;letter-spacing:-.015em}
 .u{font-weight:500;font-size:32px;color:#64748b;letter-spacing:.01em}
</style><div class="w">PLATE<b>3D</b></div>
<div class="t">by macroBIM</div>
<div class="u">www.macroBIM.com</div>`);

console.log('wrote 11 cards');
