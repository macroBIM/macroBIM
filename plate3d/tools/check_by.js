/* NOTCH ... BY — the back grammar, where a member names the obstacle and the
   engine works out the shape it leaves.

   Invariants, not copied numbers. A number copied out of yesterday's run only
   says that today's run is yesterday's; it does not say the cut is right.
   These say what BY means:

     · a member cut by one the sheet placed EARLIER loses steel
     · the same sheet with the two ASSY rows swapped is REFUSED, names the row,
       and leaves the member whole — the rule the sheet already lives by, that
       a thing must be there before it is named
     · the mark is the target's OUTLINE and not its steel: a beam cannot run
       through the inside of a closed column either, so two tubes of the same
       outside size and different walls take the same steel away
     · a clearance is room all round — cutting by a target 2c bigger with no
       clearance takes exactly as much as cutting by the target with c
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
/* Sharp corners on purpose. A rounded corner is a polyline, and every one of
   its vertices is a station where the shape the target leaves changes - which
   BY refuses, correctly, because no one stretch then has a single profile. */
const col = (b, t) => ['SECT', 'sc.c', 'SS275', 1200, 'R', 'mc', b, b, t, 0];

/* Both members are placed with their START face at the module origin, so the
   ASSY rows carry them back by half their own length to cross at the middle. */
function sheet(o) {
  o = o || {};
  const notch = o.notch === null ? null
    : ['NOTCH', 'sc.b'].concat(o.notch || ['BY', 'sc.c']);
  const rows = [['COORD', 'ZUP'], BEAM, col(o.b || 200, o.t || 9)];
  if (notch) rows.push(notch);
  rows.push(['MODULE', 'md.b', 'sc.b', '', 0, 0, 0, 'XZ', 0, 0, 0],
            ['MODULE', 'md.b', 'BASE', 'sc.b', 'mc'],
            ['MODULE', 'md.c', 'sc.c', '', 0, 0, 0, 'XY', 0, 0, 0],
            ['MODULE', 'md.c', 'BASE', 'sc.c', 'mc']);
  const putCol = ['ASSY', 'as.a', 'md.c', 'ADD', 0, o.far ? 9000 : 0,
                o.aside ? 9000 : -600];
  const putBm = ['ASSY', 'as.a', 'md.b', 'ADD', 0, 1000, 0];
  rows.push.apply(rows, o.beamFirst ? [putBm, putCol] : [putCol, putBm]);
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
  thickWall: sheet({ t: 30 }),
  clear10:   sheet({ notch: ['BY', 'sc.c', 10] }),
  bigger20:  sheet({ b: 220 }),
  miss:      sheet({ far: true }),
  aside:     sheet({ aside: true }),
  badName:   sheet({ notch: ['BY', 'sc.zz'] }),
  itself:    sheet({ notch: ['BY', 'sc.b'] }),
  badClear:  sheet({ notch: ['BY', 'sc.c', -5] })
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

  ok(near(took('thickWall'), took('cut')),
     'the mark is the outline, not the steel: a thicker wall takes the same',
     took('cut') + ' vs ' + took('thickWall'));

  ok(took('clear10') > took('cut'), 'a clearance takes more',
     took('cut') + ' → ' + took('clear10'));
  /* Room all round: growing the target by 2c and asking for no clearance is
     the same cut. If the clearance only widened the mark and did not lengthen
     the stretch, this is the check that would fail. */
  ok(near(took('clear10'), took('bigger20')),
     'and it is room all round — c of clearance equals a target 2c bigger',
     took('clear10') + ' vs ' + took('bigger20'));

  ok(near(took('miss'), 0), 'a target that never reaches it changes nothing');
  ok(said('miss', /does not reach the member/), 'and it says so');
  ok(near(took('aside'), 0), 'nor one that reaches but touches nothing');
  ok(said('aside', /took nothing away/), 'and that says so too, in its own words');

  [['badName', /nothing of that name is defined/, 'a member that does not exist'],
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
