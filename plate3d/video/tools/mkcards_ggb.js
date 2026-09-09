/* The cards the Golden Gate film is captioned with.

       node video/tools/mkcards_ggb.js

   Two kinds, and the difference matters to the assembler:

     FULL   an opaque 1920x1080 card that IS a shot - the opening title and the
            outro. It goes into the frame sequence like any still.
     OVER   a transparent PNG laid over the picture for a few seconds. The
            model has to stay visible under it, so these sit low and left and
            never cover the middle of the frame.

   Cards are HTML because that is the only way to get typography that does not
   look drawn by a program: real leading, real letter-spacing, a real weight
   axis. rendercards_ggb.js turns them into images.

   v_font.css (Inter as a data URI) is used when it is there. It is not in the
   repository - a woff2 as a base64 string is not source - so the fallback is
   the system stack, and the difference is small enough that a card can be shot
   either way. Put the file next to this one when the real face matters. */
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const OUT = path.join(SP, 'cards_ggb');
const FONT = fs.existsSync(path.join(SP, 'v_font.css'))
  ? '<link rel="stylesheet" href="v_font.css">'
  : '';
const FAMILY = "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif";

/* International Orange, because the bridge is. The captions sit on a dark
   viewport, so the rule under a title is the orange and the words are white -
   the other way round and the words stop being readable over the deck. */
const ORANGE = '#f04a00';

const BASE = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1920px; height: 1080px; }
  body { font-family: ${FAMILY}; -webkit-font-smoothing: antialiased; }
  .full { width: 1920px; height: 1080px; background: #0b0f14;
          display: flex; flex-direction: column; justify-content: center;
          align-items: center; text-align: center; }
  .full h1 { font-size: 92px; font-weight: 700; letter-spacing: -0.02em;
             line-height: 1.12; color: #fff; }
  /* Whose tool built it, above the title rather than inside it: the film is
     about the bridge for two minutes and about PLATE3D for the whole of it. */
  .full .by { font-size: 30px; font-weight: 700; letter-spacing: 0.34em;
              color: ${ORANGE}; margin-bottom: 34px; }
  .full .rule { width: 220px; height: 6px; background: ${ORANGE};
                margin: 46px 0 40px; border-radius: 3px; }
  .full h2 { font-size: 40px; font-weight: 500; letter-spacing: 0.02em;
             color: #9fb0c0; }
  /* lower left, clear of the bridge which sits across the middle.

     ON A PLATE, not on a shadow. White type with a soft shadow reads over the
     dark viewport and DISAPPEARS over the drawing sheet and the input tab, both
     of which are white paper - and half this film is now white paper. The plate
     is dark enough to carry white type over anything and translucent enough
     that the model still runs under it. */
  .over { width: 1920px; height: 1080px; background: transparent;
          display: flex; align-items: flex-end; }
  .over .box { margin: 0 0 88px 100px; padding: 30px 46px 34px;
               background: rgba(9, 13, 18, 0.78); border-radius: 16px;
               box-shadow: 0 10px 44px rgba(0,0,0,.35); }
  .over .lead { font-size: 54px; font-weight: 700; letter-spacing: -0.01em;
                line-height: 1.2; color: #fff; }
  .over .sub { font-size: 38px; font-weight: 400; line-height: 1.35;
               color: #cfe0ee; }
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
  (sub ? `<div class="sub">${sub}</div>` : '') +
  `</div></div>`);

/* The captions, by the id the shoot calls them. Kept here rather than in the
   shoot so the words can be read as a set - they are the script, and a script
   read one line at a time is how a film ends up saying the same thing twice. */
const CARDS = {
  // full-screen, opaque: these ARE shots
  open:  { kind: 'full', html: full('MODELLING THE<br>GOLDEN GATE BRIDGE',
                                    'Simple and fast.', 'BY PLATE3D') },
  invite:{ kind: 'full', html: full('COME AND BUILD ONE',
                                    'PLATE3D &rarr; Example &rarr; Golden Gate Bridge.<br>' +
                                    'Open it, change a number, load it again.<br>' +
                                    'It really is this easy.') },
  end:   { kind: 'full', html: full('PLATE3D', 'by macroBIM') },

  // overlaid on the model
  aerial: { kind: 'over', html: over('', '1,280 m of main span.<br>2,219 members.') },
  sec1:   { kind: 'over', html: over('Three sections.', '① a tower lift — eight of them') },
  sec2:   { kind: 'over', html: over('', '② a truss bay — one row, 82 of them') },
  sec3:   { kind: 'over', html: over('', '③ a cable segment — 130 of them are the curve') },
  build:  { kind: 'over', html: over('Now it goes up', 'the way it was built.') },
  cables: { kind: 'over', html: over('', 'main cables') },
  ropes:  { kind: 'over', html: over('', 'hanger ropes') },
  truss:  { kind: 'over', html: over('Out from both towers.', 'Meeting at mid-span.') },
  deck:   { kind: 'over', html: over('', 'the deck follows') },
  dxf:    { kind: 'over', html: over('Nine drawings.', 'Two kilometres on one sheet.') },
  dxfrun: { kind: 'over', html: over('', 'the general arrangement,<br>end to end') },
  count:  { kind: 'over', html: over('', 'The app counts it:<br>2,219 members, 81,624 t.') },

  /* The ending. The film has spent two minutes on what came out; these are the
     forty seconds on what went in, and where to get it. */
  sheet:  { kind: 'over', html: over('This is the whole file.',
                                     'One tab. 414 rows.') },
  sheet2: { kind: 'over', html: over('', 'Sections and plates, then modules,<br>' +
                                        'then five assemblies.') }
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
            (FONT ? '  (Inter)' : '  (system font - v_font.css not found)'));
