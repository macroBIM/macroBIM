/* The cards the Incheon film is captioned with.

       node video/tools/mkcards_incheon.js

   Two full cards and five overlay lines, which is one line fewer than the
   Eiffel had over a take six seconds shorter - because this film has one thing
   to say that the picture cannot say on its own, and the rest of it is a
   bridge being built.

   FULL is an opaque 1920x1080 card that IS a shot. OVER is a transparent PNG
   laid over the picture, on a dark plate rather than a shadow - learned on the
   Golden Gate, where white type with a soft shadow vanished the moment the
   film left the dark viewport.

   THE ACCENT IS THE CABLE'S WHITE, not a colour. Every other film in this set
   took its accent from the structure - the Golden Gate's orange, the Eiffel's
   brown - and this bridge's own colour is white cable against a grey pylon. A
   coloured rule under the title would be the one invented thing on screen. So
   the rule is the cable: white, and the type sits in the same steel grey the
   deck is painted.                                                          */
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const OUT = path.join(SP, 'cards_inc');
const FONT = fs.existsSync(path.join(SP, 'v_font.css'))
  ? '<link rel="stylesheet" href="v_font.css">' : '';
const FAMILY = "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif";
const CABLE = '#ffffff';
const STEEL = '#9fb4c6';

const BASE = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1920px; height: 1080px; }
  body { font-family: ${FAMILY}; -webkit-font-smoothing: antialiased; }
  .full { width: 1920px; height: 1080px; background: #0b0f14;
          display: flex; flex-direction: column; justify-content: center;
          align-items: center; text-align: center; }
  .full .by { font-size: 30px; font-weight: 700; letter-spacing: 0.34em;
              color: ${STEEL}; margin-bottom: 34px; }
  .full h1 { font-size: 92px; font-weight: 700; letter-spacing: -0.02em;
             line-height: 1.12; color: #fff; }
  .full .rule { width: 220px; height: 6px; background: ${CABLE};
                margin: 46px 0 40px; border-radius: 3px; }
  .full h2 { font-size: 40px; font-weight: 500; letter-spacing: 0.02em;
             line-height: 1.4; color: ${STEEL}; }
  .over { width: 1920px; height: 1080px; background: transparent;
          display: flex; align-items: flex-end; }
  .over .box { margin: 0 0 88px 100px; padding: 30px 46px 34px;
               background: rgba(9, 13, 18, 0.78); border-radius: 16px;
               box-shadow: 0 10px 44px rgba(0,0,0,.35); }
  .over .lead { font-size: 54px; font-weight: 700; letter-spacing: -0.01em;
                line-height: 1.2; color: #fff; }
  .over .sub { font-size: 38px; font-weight: 400; line-height: 1.35; color: #cfe0ee; }
  .over .bar { width: 84px; height: 5px; background: ${CABLE};
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
  open:   { kind: 'full', html: full('INCHEON BRIDGE', '800 m across.', 'BY PLATE3D') },
  end:    { kind: 'full', html: full('PLATE3D', 'by macroBIM') },

  /* The six over the take, and they are the erection sequence in words. The
     sequence is not the obvious one - a cable-stayed bridge does not simply
     cantilever out both ways - so the first three lines say what is happening
     while it is happening, and then the film can stop talking. */
  pyl:    { kind: 'over', html: over('', 'one pylon, EL 13 to EL 238.5') },
  side:   { kind: 'over', html: over('', 'the side span first &mdash; on falsework') },
  /* On the handover: the side span's stays go on and the bents come out. This
     is the line that explains what a stay cable is, without saying so. */
  fan:    { kind: 'over', html: over('its cables take the load', 'and the falsework comes out') },
  seg:    { kind: 'over', html: over('', 'now the main span goes out on its own') },
  /* The claim. The Golden Gate's main cable is a parabola sawn into 130
     straight pieces and that film said so; a stay IS a straight line, so this
     one gets to say the opposite. Two lines, twelve seconds apart, because
     the second is the one people will not believe on its own. */
  rows:   { kind: 'over', html: over('208 cables.', '208 rows.') },
  exact:  { kind: 'over', html: over('', 'nothing here is an approximation') },
  /* On the pull-out, when the pylon that was off-screen the whole time comes
     into frame already grown. The dash is doing work: it makes the line a
     reply to the picture rather than a label on it. */
  other:  { kind: 'over', html: over('', '&mdash; and the other pylon did the same') },

  /* The ending's two lines. The first is over the site, where there is room;
     the second is over the list, where there is not. */
  nav:    { kind: 'over', html: over('It is on macroBIM.', 'PLATE3D &rarr; Example') },
  dl:     { kind: 'over', html: over('', 'download it and try it') }
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
