/* Captions and outro cards, drawn as pages so the type is real type - Inter,
   the face the app itself uses - and then screenshotted with an alpha channel
   so ffmpeg can lay them over the picture and fade them.

   A caption has to read over a near-black viewport and over a white spreadsheet
   in the same film, so it carries its own ground: a navy pill, not bare text. */
const FONTCSS = require("fs").readFileSync(__dirname + "/v_font.css", "utf8");
const fs = require('fs');
const CAPS = [
  ['c01', 'Design 3D with the power of a spreadsheet'],
  ['c02', 'A spreadsheet you already know'],
  ['c03', 'Your rows become a structure'],
  ['c04', 'One number sets the length'],
  ['c05', 'Change it'],
  ['c06', 'The whole building follows'],
  ['c07', '347 rows. One tower crane.'],
  ['c08', '575 members. Every one of them real.'],
  ['c09', 'Down to the last hole'],
  ['c10', 'From model to BOM in one pass'],
  ['c11', '3D structural modelling. Nothing to install.']
];
const FONT = `<meta charset="utf-8">
<style>${FONTCSS}</style>`;
const BASE = `*{margin:0;padding:0;box-sizing:border-box}
 html,body{width:1920px;height:1080px;overflow:hidden}
 body{font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}`;

CAPS.forEach(([id, text]) => {
  fs.writeFileSync('v_' + id + '.html', FONT + `<style>${BASE}
 body{background:transparent;display:flex;align-items:flex-end;justify-content:center;
      padding-bottom:88px}
 .pill{background:#0f172a;color:#fff;font-weight:600;font-size:46px;letter-spacing:-.015em;
      padding:26px 54px;border-radius:999px;box-shadow:0 18px 50px rgba(15,23,42,.35);
      display:flex;align-items:center;gap:26px}
 .dot{width:14px;height:14px;border-radius:50%;background:#38bdf8;flex:none}
</style><div class="pill"><span class="dot"></span>${text}</div>`);
});

// running counters for the growth beat - the number is the argument
const stat = (id, a, b, c) => fs.writeFileSync('v_' + id + '.html', FONT + `<style>${BASE}
 body{background:transparent;display:flex;align-items:flex-start;justify-content:flex-end;
      padding:78px 96px 0 0}
 .box{background:rgba(15,23,42,.92);border-radius:22px;padding:30px 40px;color:#fff;
      display:grid;grid-template-columns:auto auto;gap:14px 34px;font-variant-numeric:tabular-nums}
 .k{color:#94a3b8;font-size:26px;font-weight:500;align-self:center}
 .v{font-size:40px;font-weight:700;letter-spacing:-.02em;text-align:right}
 .up{color:#38bdf8}
</style><div class="box">
 <span class="k">members</span><span class="v ${c}">${a}</span>
 <span class="k">weight</span><span class="v ${c}">${b}</span>
 <span class="k">length</span><span class="v ${c}">${arguments}</span></div>`);

const statCard = (id, m, w, l, hot) => fs.writeFileSync('v_' + id + '.html', FONT + `<style>${BASE}
 body{background:transparent;display:flex;align-items:flex-start;justify-content:flex-end;
      padding:78px 96px 0 0}
 .box{background:rgba(15,23,42,.92);border-radius:22px;padding:30px 42px;color:#fff;
      display:grid;grid-template-columns:auto auto;gap:16px 40px;font-variant-numeric:tabular-nums}
 .k{color:#94a3b8;font-size:25px;font-weight:500;align-self:center}
 .v{font-size:40px;font-weight:700;letter-spacing:-.02em;text-align:right;
    color:${hot ? '#38bdf8' : '#fff'}}
</style><div class="box">
 <span class="k">members</span><span class="v">${m}</span>
 <span class="k">weight</span><span class="v">${w}</span>
 <span class="k">length</span><span class="v">${l}</span></div>`);
statCard('s30', '297', '20.0 t', '30 m', false);
statCard('s54', '497', '33.1 t', '54 m', true);

// outro
fs.writeFileSync('v_o1.html', FONT + `<style>${BASE}
 body{background:#fff;display:flex;align-items:center;justify-content:center}
 .w{font-weight:800;font-size:150px;letter-spacing:-.045em;color:#0f172a}
 .w b{color:#1d4ed8;font-weight:800}
</style><div class="w">PLATE<b>3D</b></div>`);

fs.writeFileSync('v_o2.html', FONT + `<style>${BASE}
 body{background:#fff;display:flex;flex-direction:column;align-items:center;
      justify-content:center;gap:40px}
 .w{font-weight:800;font-size:112px;letter-spacing:-.045em;color:#0f172a}
 .w b{color:#1d4ed8}
 .t{font-weight:600;font-size:44px;color:#1d4ed8;letter-spacing:-.015em}
 .u{font-weight:500;font-size:34px;color:#64748b;letter-spacing:.01em}
</style><div class="w">PLATE<b>3D</b></div>
<div class="t">Change the way you design.</div>
<div class="u">www.macroBIM.com</div>`);

console.log('wrote ' + (CAPS.length + 4) + ' cards');
