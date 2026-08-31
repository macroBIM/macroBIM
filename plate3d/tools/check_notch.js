/* NOTCH, checked by what must be true of it rather than by numbers to match.

       node tools/check_notch.js

   A number copied out of a run and pinned in a test says only that today
   agrees with yesterday. These are statements that have to hold whatever the
   geometry is, so they keep meaning something after the model changes:

     · a NOTCH over the WHOLE member is a CUT. Same drawing, same weight -
       a CUT on a section has always cut the whole length, and a notch that
       covers everything asks for exactly that.
     · two NOTCHes meeting end to end, of the same shape, are ONE notch over
       the pair of them. This is the seam question: if the boundary between
       them were drawn, the two would not match, and the difference would be
       that line.
     · a NOTCH that reaches nothing changes nothing - same weight, same
       drawing, not one line more - and says so.
     · a member with no NOTCH is untouched.

   Malformed rows are checked too: a stretch that runs backwards, a member
   that does not exist, a row with no shape. Each has to be refused with a
   message that names the row.
*/
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const SP = __dirname;

const LIB = f => {
  let p = SP + '/node_modules/three/build/three.min.js';
  if (f.includes('OrbitControls')) p = SP + '/node_modules/three/examples/js/controls/OrbitControls.js';
  if (f.includes('polybool')) p = SP + '/node_modules/polybooljs/dist/polybool.min.js';
  if (f.includes('exceljs')) p = SP + '/node_modules/exceljs/dist/exceljs.min.js';
  return fs.readFileSync(p, 'utf-8');
};

const LEN = 1000;
const H = [300, 300, 300, 10, 15, 15, 18];      // h bb bt tw tf1 tf2 r
/* A cope: the cutter is WIDER than the flange, so the flange comes away whole
   and the web is left standing. A shape that stops inside the flange would
   leave a strip of it hanging off each edge, which is not a thing anyone cuts
   - and a test that shows an impossible detail teaches one. */
const sheet = mid => [['COORD', 'ZUP'],
  ['SECT', 'sc.b', 'SS275', LEN, 'H', 'mc'].concat(H),
  ['HOLE', 'ho.n', 'RECT', 'mc', 340, 40]]
  .concat(mid)
  .concat([['MODULE', 'md.b', 'sc.b', '', -LEN / 2, 0, 0, 'YZ'],
           ['MODULE', 'md.b', 'BASE', 'sc.b', 'mc'],
           ['ASSY', 'as.a', 'md.b', 'ADD', -LEN / 2, 0, 0],
           ['VIEW', 'as.a', 'FRONT', '', '', 10, 'T'],
           ['END']]);

/* At (0, 142.5) the cutter sits on the top flange and takes all of it; at
   (900, 0) it is off the section altogether and reaches nothing. */
const ON = [0, 142.5], OFF = [900, 0];
const CASES = {
  plain:      sheet([]),
  cutAll:     sheet([['CUT',   'sc.b', ON[0], ON[1], 'ho.n']]),
  notchAll:   sheet([['NOTCH', 'sc.b', 0, LEN, ON[0], ON[1], 'ho.n']]),
  notchOpen:  sheet([['NOTCH', 'sc.b', 0, '',  ON[0], ON[1], 'ho.n']]),
  notchHalf:  sheet([['NOTCH', 'sc.b', 0, 400, ON[0], ON[1], 'ho.n']]),
  notchSplit: sheet([['NOTCH', 'sc.b', 0, 150, ON[0], ON[1], 'ho.n'],
                     ['NOTCH', 'sc.b', 150, 400, ON[0], ON[1], 'ho.n']]),
  notchMiss:  sheet([['NOTCH', 'sc.b', 0, 400, OFF[0], OFF[1], 'ho.n']]),
  badRange:   sheet([['NOTCH', 'sc.b', 400, 100, ON[0], ON[1], 'ho.n']]),
  badMember:  sheet([['NOTCH', 'sc.zz', 0, 400, ON[0], ON[1], 'ho.n']]),
  badShape:   sheet([['NOTCH', 'sc.b', 0, 400, ON[0], ON[1], '']])
};

let bad = 0, checks = 0;
const ok = (c, what, d) => {
  checks++;
  if (c) { console.log('  ok    ' + what); return; }
  bad++;
  console.log('  FAIL  ' + what + (d ? '  [' + d + ']' : ''));
};
const countOf = (dxf, k) =>
  !dxf ? 0 : (dxf.match(new RegExp('^\\s*' + k + '\\s*$', 'gm')) || []).length;
const shot = r => r.lines + '/' + r.arcs + ' lines/arcs · ' + r.kg + ' kg';
const same = (a, b) => a.lines === b.lines && a.arcs === b.arcs &&
                       Math.abs(a.kg - b.kg) < 5e-4;

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
           '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.route('**/{unpkg.com,cdnjs.cloudflare.com}/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: LIB(r.request().url()) }));
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  page.on('dialog', async d => { page.__alert = d.message(); await d.dismiss(); });
  await page.goto('file://' + SP + '/host_test.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const R = {};
  console.log('case          placed  err          kg   lines  arcs');
  for (const k of Object.keys(CASES)) {
    const b = await page.evaluate(async rows => {
      window.__b = null;
      const on = e => { if (e.data && e.data.plate3d === 'built') window.__b = e.data; };
      window.addEventListener('message', on);
      window.postMessage({ plate3d: 'rows', rows: rows, name: 'notch' }, '*');
      await new Promise(r => setTimeout(r, 2500));
      window.removeEventListener('message', on);
      const t = ((document.getElementById('pb-total') || {}).innerText || '').match(/([\d.]+) kg/);
      return { built: window.__b, kg: t ? +t[1] : -1,
               panel: ((document.getElementById('pb-result') || {}).innerText || '')
                        .replace(/\n/g, ' | ') };
    }, CASES[k]);
    await page.evaluate(() => { const o = URL.createObjectURL.bind(URL);
      URL.createObjectURL = bl => { window.__f = bl; return o(bl); }; window.__f = null; });
    await page.evaluate(() => plateBuilder.exportDXF());
    let dxf = null;
    try { await page.waitForFunction(() => !!window.__f, null, { timeout: 30000 });
          dxf = await page.evaluate(() => window.__f.text()); } catch (e) {}
    R[k] = { kg: b.kg, panel: b.panel, placed: b.built ? b.built.placed : -1,
             errors: b.built ? b.built.errors : -1,
             lines: countOf(dxf, 'LINE'), arcs: countOf(dxf, 'ARC') + countOf(dxf, 'CIRCLE') };
    console.log('  ' + k.padEnd(12) + String(R[k].placed).padStart(5) +
      String(R[k].errors).padStart(5) + String(R[k].kg).padStart(12) +
      String(R[k].lines).padStart(8) + String(R[k].arcs).padStart(6));
  }
  console.log('');

  ok(R.plain.errors === 0 && R.plain.placed === 1 && R.plain.lines > 0,
     'a member with no NOTCH builds', shot(R.plain));
  ok(same(R.notchAll, R.cutAll),
     'a NOTCH over the whole member IS a CUT',
     'notch ' + shot(R.notchAll) + '   cut ' + shot(R.cutAll));
  ok(same(R.notchOpen, R.notchAll),
     'leaving `to` blank reaches the far end',
     'open ' + shot(R.notchOpen) + '   0..' + LEN + ' ' + shot(R.notchAll));
  ok(same(R.notchSplit, R.notchHalf),
     'two NOTCHes meeting end to end are one — no line between them',
     'split ' + shot(R.notchSplit) + '   whole ' + shot(R.notchHalf));
  ok(same(R.notchMiss, R.plain),
     'a NOTCH that reaches nothing changes nothing',
     'missed ' + shot(R.notchMiss) + '   plain ' + shot(R.plain));
  ok(/NOTCH on SC\.B takes nothing away/.test(R.notchMiss.panel),
     'and it says so', R.notchMiss.panel.slice(0, 150));
  ok(R.notchHalf.kg < R.plain.kg && R.notchHalf.kg > R.notchAll.kg,
     'a notch over part of the member takes part of the steel',
     R.plain.kg + ' → ' + R.notchHalf.kg + ' → ' + R.notchAll.kg + ' kg');
  ok(R.notchHalf.lines > R.plain.lines,
     'the step it leaves is drawn',
     R.plain.lines + ' → ' + R.notchHalf.lines + ' lines');

  [['badRange', /NOTCH on SC\.B runs from/, 'a stretch that runs backwards'],
   ['badMember', /NOTCH names/, 'a member that does not exist'],
   ['badShape', /NOTCH on SC\.B names no shape/, 'a row with no shape']
  ].forEach(([k, re, what]) => {
    ok(re.test(R[k].panel), 'refused, and named: ' + what, R[k].panel.slice(0, 150));
    ok(same(R[k], R.plain), 'refused rows leave the member alone: ' + what,
       shot(R[k]) + ' vs ' + shot(R.plain));
  });

  if (errs.length) { bad++; console.log('\npage errors:\n  ' + errs.join('\n  ')); }
  console.log('\n' + checks + ' checks · ' + (bad ? bad + ' FAILED' : 'all pass'));
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
