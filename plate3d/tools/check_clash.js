/* The clash report.

   The engine has found clashes for a long time and painted them red. It said
   nothing about them, so a clash buried inside a member was invisible and a
   visible one never gave the two names. Now it is reported on the panel,
   whether or not the checkbox is ticked.

   Invariants:
     · two members sharing steel are reported, by name, both of them
     · a bolt is not a clash. The shank is meant to be inside the plate - the
       engine draws it and does not punch the hole out of the solid - so
       counting it would bury the real ones
     · members that only touch are not a clash. Steel is meant to touch
     · notching the overlap away makes the report go away — which is the whole
       loop: the report says what to cut, and the cut answers the report

   Run: node tools/check_clash.js                                           */
const { chromium } = require('playwright-core');
const fs = require('fs');
const SP = __dirname;

const LIB = f => {
  let p = SP + '/node_modules/three/build/three.min.js';
  if (f.includes('OrbitControls')) p = SP + '/node_modules/three/examples/js/controls/OrbitControls.js';
  if (f.includes('polybool')) p = SP + '/node_modules/polybooljs/dist/polybool.min.js';
  if (f.includes('exceljs')) p = SP + '/node_modules/exceljs/dist/exceljs.min.js';
  return fs.readFileSync(p, 'utf-8');
};

/* A beam along Y, and a plate standing across it. `gap` slides the plate along
   the beam: 0 buries it in the steel, 1000 puts it clear off the end, and the
   beam's own half-length puts the two exactly face to face. */
function sheet(o) {
  o = o || {};
  const rows = [['COORD', 'ZUP'],
    ['SECT', 'sc.b', 'SS275', 2000, 'H', 'mc', 300, 300, 300, 10, 15, 15, 18],
    ['PLATE', 'pl.k', 'SS275', 20, 'RECT', 'mc', 200, 400]];
  if (o.bolt) rows.push(['BOLT', 'bo.x', 'F10T', 16, 200]);
  /* A second knife laid ALONG the beam instead of across it, so the two
     extrusion axes are parallel and the exact measure applies. This is the
     pair that can be notched clear; the crossing one cannot, and the report
     says which is which. */
  if (o.along) rows.push(['PLATE', 'pl.a', 'SS275', 400, 'RECT', 'mc', 200, 20],
                         ['HOLE', 'ho.n', 'RECT', 'mc', 200, 20]);
  if (o.alongCut) rows.push(['NOTCH', 'sc.b', 800, 1200, 0, 0, 'ho.n']);
  if (o.notch) rows.push(['NOTCH', 'sc.b', 'BY', 'pl.k']);
  rows.push(['MODULE', 'md.b', 'sc.b', '', 0, 0, 0, 'XZ', 0, 0, 0],
            ['MODULE', 'md.b', 'BASE', 'sc.b', 'mc'],
            ['MODULE', 'md.k', 'pl.k', 'mc', 0, 0, 0, 'XY', 0, 0, 0]);
  if (o.along) rows.push(['MODULE', 'md.a', 'pl.a', 'mc', 0, 0, 0, 'XZ', 0, 0, 0],
                         ['MODULE', 'md.a', 'BASE', 'pl.a', 'mc']);
  /* the bolt driven straight through the beam's web, head to the outside */
  if (o.bolt) rows.push(['MODULE', 'md.k', 'bo.x', '', 0, 0, 0, 'XZ', 0, 0, 0]);
  rows.push(['MODULE', 'md.k', 'BASE', 'pl.k', 'mc'],
            ['ASSY', 'as.a', 'md.k', 'ADD', 0, o.gap === undefined ? 0 : o.gap, 0]);
  if (o.along) rows.push(['ASSY', 'as.a', 'md.a', 'ADD', 0, 0, 0]);
  rows.push(['ASSY', 'as.a', 'md.b', 'ADD', 0, 1000, 0], ['END']);
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
  through: sheet(),                        // the plate stands inside the beam
  away:    sheet({ gap: 4000 }),           // nowhere near it
  bolt:    sheet({ gap: 4000, bolt: true }),
  notched: sheet({ notch: true }),        // crossing: a box answer, not cleared
  along:   sheet({ gap: 4000, along: true }),          // parallel, overlapping
  alongCut: sheet({ gap: 4000, along: true, alongCut: true })
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
  console.log('');
  console.log('  case       clashes        kg  panel says');
  for (const k of Object.keys(CASES)) {
    R[k] = await page.evaluate(async rows => {
      window.postMessage({ plate3d: 'rows', rows: rows, name: 'clash' }, '*');
      await new Promise(r => setTimeout(r, 2200));
      const p = ((document.getElementById('pb-result') || {}).innerText || '');
      const t = ((document.getElementById('pb-total') || {}).innerText || '')
                  .match(/([\d.]+) kg/);
      return { n: plateBuilder.clashes().length, kg: t ? +t[1] : -1,
               line: (p.match(/Clash:[^\n]*/) || [''])[0],
               panel: p.replace(/\n+/g, ' | ') };
    }, CASES[k]);
    console.log('  ' + k.padEnd(10) + String(R[k].n).padStart(6) +
                String(R[k].kg).padStart(10) + 'kg  ' +
                (R[k].line || '(nothing)').slice(0, 60));
  }
  console.log('');

  ok(R.through.n > 0, 'two members sharing steel are found', R.through.n + '');
  ok(/Clash:/.test(R.through.line), 'and the panel says so, without ticking anything');
  ok(/PL\.K/.test(R.through.line) && /SC\.B/.test(R.through.line),
     'and it names both of them', R.through.line.slice(0, 60));
  ok(/place/.test(R.through.line), 'and says how many places to go and look at');

  ok(R.away.n === 0, 'members nowhere near each other are not a clash');
  ok(!R.away.line, 'and nothing is said');

  ok(R.bolt.n === 0, 'a bolt driven through a plate is not a clash',
     R.bolt.line.slice(0, 60));
  ok(!R.bolt.line, 'and nothing is said about it either');

  /* The loop closes where the measure is exact: two members lying along each
     other are measured prism against prism, and notching the overlap away
     makes the report go away. */
  ok(R.along.n > 0, 'a knife lying along the beam clashes too', R.along.n + '');
  ok(!/\?/.test(R.along.line), 'and that one is measured exactly, not on boxes',
     R.along.line.slice(0, 70));
  ok(R.alongCut.n === 0, 'notching it away makes the clash go away',
     R.along.n + ' → ' + R.alongCut.n);
  ok(!R.alongCut.line, 'and the panel stops saying it');

  /* And where it is NOT exact, the report says so rather than letting a maybe
     read as a yes. A beam and a plate standing across it are perpendicular
     prisms: the boxes answer, and a box cannot see a notch. */
  ok(R.notched.n > 0 && /\?/.test(R.notched.line),
     'a crossing pair is marked as a box answer, notch or no notch',
     R.notched.line.slice(0, 70));
  ok(/box answer/.test(R.notched.line), 'and the panel explains what a `?` means');

  await b.close();
  console.log('');
  console.log(checks + ' checks · ' + (bad ? bad + ' FAILED' : 'all pass'));
  process.exit(bad ? 1 : 0);
})();
