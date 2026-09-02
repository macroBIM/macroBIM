/* NOTCH ... BY — the back grammar, where a member names the obstacle and the
   engine works out the shape it leaves.

   Invariants, not copied numbers. A number copied out of yesterday's run only
   says that today's run is yesterday's; it does not say the cut is right.
   These say what BY means:

     · a member cut by one the sheet placed EARLIER loses steel
     · the same sheet with the two ASSY rows swapped is REFUSED, names the row,
       and leaves the member whole — the rule the sheet already lives by, that
       a thing must be there before it is named
     · the knife is a PLATE. A section is refused by name: what a section
       leaves changes as you go into it - a flange is 300 wide and the web
       behind it is 10 - so it is not one notch
     · the mark is the target's OUTLINE and not its steel: a hole cut through
       the knife does not show up in what the knife takes away
     · a clearance is room at the knife's EDGES — cutting by a target 2c wider
       and 2c longer with no clearance takes exactly as much as cutting by the
       target with c. And it stops there: a knife 2c THICKER takes more, because
       a clearance is not allowed to reach through the thickness. What is on the
       far side of a plate is the member's own steel - on a coped beam, its web.
     · a target that never reaches the member changes nothing, and says so
     · malformed rows are refused by name and leave the member alone

   Run: node tools/check_by.js                                              */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const SP = __dirname;

const LIB = f => {
  let p = SP + '/node_modules/three/build/three.min.js';
  if (f.includes('OrbitControls')) p = SP + '/node_modules/three/examples/js/controls/OrbitControls.js';
  if (f.includes('polybool')) p = SP + '/node_modules/polybooljs/dist/polybool.min.js';
  if (f.includes('exceljs')) p = SP + '/node_modules/exceljs/dist/exceljs.min.js';
  return fs.readFileSync(p, 'utf-8');
};

const BEAM = ['SECT', 'sc.b', 'SS275', 2000, 'H', 'mc', 300, 300, 300, 10, 15, 15, 18];
/* The knife: a plate standing square across the beam, 400 tall so it covers the
   beam's whole depth and the mark is decided by its width alone. */
const knife = (w, t, h) => ['PLATE', 'pl.k', 'SS275', t || 20, 'RECT', 'mc',
                            w || 200, h || 400];
const SECTION = ['SECT', 'sc.c', 'SS275', 1200, 'R', 'mc', 200, 200, 9, 0];

/* The beam is placed with its START face at the module origin, so its ASSY row
   carries it back by half its own length to meet the knife at the middle. */
function sheet(o) {
  o = o || {};
  const notch = o.notch === null ? null
    : ['NOTCH', 'sc.b'].concat(o.notch || ['BY', 'pl.k']);
  const rows = [['COORD', 'ZUP'], BEAM, knife(o.w, o.t, o.h)];
  if (o.section) rows.push(SECTION);
  if (o.hole) rows.push(['HOLE', 'ho.x', 'CIRC', 'mc', 60], ['CUT', 'pl.k', 0, 0, 'ho.x']);
  if (notch) rows.push(notch);
  rows.push(['MODULE', 'md.b', 'sc.b', '', 0, 0, 0, 'XZ', 0, 0, 0],
            ['MODULE', 'md.b', 'BASE', 'sc.b', 'mc'],
            ['MODULE', 'md.k', 'pl.k', 'mc', 0, 0, 0, 'XY', 0, 0, 0],
            ['MODULE', 'md.k', 'BASE', 'pl.k', 'mc']);
  const putK = ['ASSY', 'as.a', 'md.k', 'ADD', 0, o.far ? 9000 : 0, o.aside ? 9000 : 0];
  const putBm = ['ASSY', 'as.a', 'md.b', 'ADD', 0, 1000, 0];
  rows.push.apply(rows, o.beamFirst ? [putBm, putK] : [putK, putBm]);
  rows.push(['END']);
  return rows;
}

let bad = 0, checks = 0;
const ok = (c, what, d) => {
  checks++;
  if (c) { console.log('  ok    ' + what); return; }
  bad++;
  console.log('  FAIL  ' + what + (d ? '  [' + d + ']' : ''));
};

const CASES = {
  plain:     sheet({ notch: null }),
  cut:       sheet(),
  swapped:   sheet({ beamFirst: true }),
  thicker:   sheet({ t: 40 }),
  holed:     sheet({ hole: true }),
  clear10:   sheet({ notch: ['BY', 'pl.k', 10] }),
  bigger20:  sheet({ w: 220, h: 420 }),          // 2c at the edges, same thickness
  fatter20:  sheet({ w: 220, t: 40, h: 420 }),   // and 2c through the thickness too
  bySect:    sheet({ section: true, notch: ['BY', 'sc.c'] }),
  miss:      sheet({ far: true }),
  aside:     sheet({ aside: true }),
  badName:   sheet({ notch: ['BY', 'pl.zz'] }),
  itself:    sheet({ notch: ['BY', 'sc.b'] }),
  badClear:  sheet({ notch: ['BY', 'pl.k', -5] })
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
           '--enable-unsafe-swiftshader'] });
  const page = await b.newPage({ viewport: { width: 1200, height: 800 } });
  await page.route('**/{unpkg.com,cdnjs.cloudflare.com}/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: LIB(r.request().url()) }));
  await page.goto('file://' + SP + '/host_test.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const R = {};
  const run = rows => page.evaluate(async rows => {
      window.postMessage({ plate3d: 'rows', rows: rows, name: 'by' }, '*');
      await new Promise(r => setTimeout(r, 2200));
      const t = ((document.getElementById('pb-total') || {}).innerText || '')
                  .match(/([\d.]+) kg/);
      const p = ((document.getElementById('pb-result') || {}).innerText || '');
      return { kg: t ? +t[1] : -1, panel: p.replace(/\n+/g, ' | ') };
    }, rows);
  console.log('');
  console.log('  case            uncut         cut       took   errors');
  for (const k of Object.keys(CASES)) {
    const rows = CASES[k];
    R[k] = await run(rows);
    /* Measured against the SAME sheet with the NOTCH row taken out, so the
       target's own weight - which changes when the target does - never lands
       in the difference. */
    R[k].was = (await run(rows.filter(r => String(r[0]).toUpperCase() !== 'NOTCH'))).kg;
    R[k].took = +(R[k].was - R[k].kg).toFixed(3);
    const errs = (R[k].panel.match(/row \d+:/g) || []).length;
    console.log('  ' + k.padEnd(12) + String(R[k].was).padStart(9) +
                String(R[k].kg).padStart(12) + String(R[k].took).padStart(11) +
                String(errs).padStart(9));
  }
  const took = k => R[k].took;
  const said = (k, re) => re.test(R[k].panel);
  const near = (a, c) => Math.abs(a - c) < 2e-3;
  console.log('');

  ok(took('cut') > 0, 'a member cut by one already placed loses steel',
     took('cut') + ' kg');
  ok(near(took('swapped'), 0),
     'the same sheet the other way round leaves it whole', R.swapped.kg + ' kg');
  ok(said('swapped', /is not on the model yet/) && said('swapped', /^.*row \d+:/),
     'and says so, by row, naming the ASSY row to move', R.swapped.panel.slice(0, 90));

  ok(took('thicker') > took('cut'),
     'a thicker knife takes more — the mark is as deep as the knife is',
     took('cut') + ' → ' + took('thicker'));
  ok(near(took('holed'), took('cut')),
     'the mark is the outline, not the steel: a hole through the knife changes nothing',
     took('cut') + ' vs ' + took('holed'));

  ok(took('clear10') > took('cut'), 'a clearance takes more',
     took('cut') + ' → ' + took('clear10'));
  /* Room at the EDGES, in the two directions a plate is put in past: across
     the mark and along the member. A knife grown by 2c on those and asked for
     no clearance is the same cut. Grow only the width and this is the check
     that catches it - which is how the missing stretch was found. */
  ok(near(took('clear10'), took('bigger20')),
     'and it is room at the edges — c of clearance equals a knife 2c wider and longer',
     took('clear10') + ' vs ' + took('bigger20'));
  /* The other side of the same statement. Through the thickness the member has
     already given up everything the plate occupies; more comes off the far side
     of it, which on a coped beam is the web. So a knife that is also 2c thicker
     has to take MORE than the clearance does - if the two agree, the clearance
     is eating web nobody asked it to. */
  ok(took('fatter20') > took('clear10') + 1e-3,
     'and it does not reach through the thickness — a knife 2c thicker takes more',
     took('clear10') + ' vs ' + took('fatter20'));

  ok(near(took('miss'), 0), 'a target that never reaches it changes nothing');
  ok(said('miss', /does not reach the member/), 'and it says so');
  ok(near(took('aside'), 0), 'nor one that reaches but touches nothing');
  ok(said('aside', /took nothing away/), 'and that says so too, in its own words');

  [['bySect', /BY takes a PLATE/, 'a section named as the knife'],
   ['badName', /nothing of that name is defined/, 'a member that does not exist'],
   ['itself', /cannot be cut by itself/, 'a member named as its own knife'],
   ['badClear', /clearance/, 'a clearance below zero']
  ].forEach(([k, re, what]) => {
    ok(said(k, re), 'refused, and named: ' + what, R[k].panel.slice(0, 90));
    ok(near(took(k), 0), 'refused rows leave the member alone: ' + what);
  });

  await b.close();
  console.log('');
  console.log(checks + ' checks · ' + (bad ? bad + ' FAILED' : 'all pass'));
  process.exit(bad ? 1 : 0);
})();
