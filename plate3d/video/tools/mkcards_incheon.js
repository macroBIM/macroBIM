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
  /* THE HOOK IS THE SPREADSHEET, and it has to be in the first four seconds.
     A 1,480 m bridge is impressive and everyone has seen one; a 1,480 m bridge
     that came out of a spreadsheet is the thing that makes somebody stop
     scrolling. The span can wait - it arrives at 0:38, by which time they are
     watching anyway. */
  open:   { kind: 'full', html: full('INCHEON BRIDGE', 'Drawn in a spreadsheet.', 'BY PLATE3D') },
  end:    { kind: 'full', html: full('PLATE3D', 'by macroBIM') },

  /* THESE ARE FOR SOMEBODY WHO DOES NOT BUILD BRIDGES. The first draft of them
     was written for someone who does - "EL 13 to EL 238.5", "one segment and
     its ring", "nothing here is an approximation" - and every one of those is
     a sentence you have to already know the answer to. An elevation is not a
     height to most people, a row is a spreadsheet row only if you have been
     told, and "approximation" is a word about a thing the film never showed.

     So: short, concrete, and each one says what is happening on screen at that
     second. The surprising part of a cable-stayed bridge is that the middle is
     built out of nothing, held by wire - say that. */
  pyl:    { kind: 'over', html: over('First the tower.', '238 metres above the sea.') },
  side:   { kind: 'over', html: over('', 'The side span goes up on temporary supports.') },
  seg:    { kind: 'over', html: over('Then it builds into thin air.', 'One piece, two cables, over and over.') },
  fan:    { kind: 'over', html: over('The supports come away.', 'The cables have it now.') },
  /* The scale, once, where the fan is big enough on screen to count. */
  rows:   { kind: 'over', html: over('800 metres between the towers.', '208 cables hold it up.') },
  /* AND THE CLAIM, IN A FORM THAT IS BOTH TRUE AND INTERESTING. The old line
     said "nothing here is an approximation", which is a specialist's boast and
     also an overstatement - the walls of this model are a skin and its deck
     has no diaphragms in it. What IS exactly true is the cables: a stay is a
     straight line between two anchorages, so each of the 208 is one row of a
     spreadsheet and not one of them is chorded or sampled. Saying it that way
     is checkable, it lands the hook a second time, and nobody has to know what
     an approximation is. */
  exact:  { kind: 'over', html: over('', 'Every cable is one row in Excel.') },
  other:  { kind: 'over', html: over('', 'And the far tower did the same.') },

  /* The ending. "Download it and try it" is what you say when you have run out
     of things to say; "Open it in Excel" is a thing the viewer can picture
     themselves doing, which is the whole point of the shot. */
  nav:    { kind: 'over', html: over("It's on macroBIM.", 'PLATE3D &rarr; Example') },
  dl:     { kind: 'over', html: over('', 'Download it. Open it in Excel.') }
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
