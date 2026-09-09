/* The cards the Eiffel film is captioned with.

       node video/tools/mkcards_eiffel.js

   Five overlay lines and three full cards, and that is the whole script. The
   Golden Gate film had eleven captions because it had eleven things to explain;
   this one has a tower going up, and words on top of that are words in the way.

   Same two kinds as before: FULL is an opaque 1920x1080 card that IS a shot,
   OVER is a transparent PNG laid over the picture. The overlay sits on a dark
   plate rather than a shadow - learned on the Golden Gate, where white type
   with a soft shadow vanished the moment the film left the dark viewport. */
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const OUT = path.join(SP, 'cards_eif');
const FONT = fs.existsSync(path.join(SP, 'v_font.css'))
  ? '<link rel="stylesheet" href="v_font.css">' : '';
const FAMILY = "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif";
/* The tower's own orange, the light end of the grade the model is painted in,
   so the rule under the title is the same colour as the thing above it. */
const ORANGE = '#e0862e';

const BASE = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1920px; height: 1080px; }
  body { font-family: ${FAMILY}; -webkit-font-smoothing: antialiased; }
  .full { width: 1920px; height: 1080px; background: #0b0f14;
          display: flex; flex-direction: column; justify-content: center;
          align-items: center; text-align: center; }
  .full .by { font-size: 30px; font-weight: 700; letter-spacing: 0.34em;
              color: ${ORANGE}; margin-bottom: 34px; }
  .full h1 { font-size: 92px; font-weight: 700; letter-spacing: -0.02em;
             line-height: 1.12; color: #fff; }
  .full .rule { width: 220px; height: 6px; background: ${ORANGE};
                margin: 46px 0 40px; border-radius: 3px; }
  .full h2 { font-size: 40px; font-weight: 500; letter-spacing: 0.02em;
             line-height: 1.4; color: #9fb0c0; }
  .over { width: 1920px; height: 1080px; background: transparent;
          display: flex; align-items: flex-end; }
  .over .box { margin: 0 0 88px 100px; padding: 30px 46px 34px;
               background: rgba(9, 13, 18, 0.78); border-radius: 16px;
               box-shadow: 0 10px 44px rgba(0,0,0,.35); }
  .over .lead { font-size: 54px; font-weight: 700; letter-spacing: -0.01em;
                line-height: 1.2; color: #fff; }
  .over .sub { font-size: 38px; font-weight: 400; line-height: 1.35; color: #cfe0ee; }
  .over .bar { width: 84px; height: 5px; background: ${ORANGE};
               margin-bottom: 24px; border-radius: 3px; }
`;
const page = body =>
  `<!DOCTYPE html><html><head><meta charset="utf-8">${FONT}` +
  `<style>${BASE}</style></head><body>${body}</body></html>`;
const full = (h1, h2, by) => page(
  `<div class="full">` + (by ? `<div class="by">${by}</div>` : '') +
  `<h1>${h1}</h1><div class="rule"></div><h2>${h2}</h2></div>`);
const over = (lead, sub) => page(
  `<div class="over"><div class="box"><div class="bar"></div>` +
  (lead ? `<div class="lead">${lead}</div>` : '') +
  (sub ? `<div class="sub">${sub}</div>` : '') + `</div></div>`);

const CARDS = {
  open:   { kind: 'full', html: full('EIFFEL TOWER', 'Watch it go up.', 'BY PLATE3D') },
  /* No address on a card, and no card doing the downloading either. The film
     shows the panel and the button, which is the same instruction without
     anybody having to type anything. */
  dl:     { kind: 'over', html: over('Yours to download.', 'Example &rarr; Eiffel Tower') },
  end:    { kind: 'full', html: full('PLATE3D', 'by macroBIM') },

  mem:    { kind: 'over', html: over('', '709 rows.<br>1,528 members.') },
  arc:    { kind: 'over', html: over('', 'the arches') },
  pl1:    { kind: 'over', html: over('', 'the first platform') },
  one:    { kind: 'over', html: over('', 'and the four become one') },
  top:    { kind: 'over', html: over('300.65 m', 'in 1889') }
};

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const index = {};
Object.keys(CARDS).forEach(k => {
  fs.writeFileSync(path.join(OUT, 't_' + k + '.html'), CARDS[k].html);
  index[k] = CARDS[k].kind;
});
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 2));
console.log(Object.keys(CARDS).length + ' cards in ' + OUT +
            (FONT ? '  (Inter)' : '  (system font)'));
