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
const ExcelJS = require('exceljs');
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
const sheetOf = (mid, sec) => [['COORD', 'ZUP'],
  ['SECT', 'sc.b', 'SS275', LEN, 'H', 'mc'].concat(sec || H),
  ['HOLE', 'ho.n', 'RECT', 'mc', 340, 40],
  /* a scallop, hung from whatever place the row names: wider than the web,
     because what goes through a web goes right through it */
  ['HOLE', 'ho.sc', 'RECT', 'tc', 70, 35]]
  .concat(mid)
  .concat([['MODULE', 'md.b', 'sc.b', '', -LEN / 2, 0, 0, 'YZ'],
           ['MODULE', 'md.b', 'BASE', 'sc.b', 'mc'],
           ['ASSY', 'as.a', 'md.b', 'ADD', -LEN / 2, 0, 0],
           ['VIEW', 'as.a', 'FRONT', '', '', 10, 'T'],
           ['END']]);
const sheet = mid => sheetOf(mid, null);
/* The same scallop on a bigger section. Named, it follows the section; typed as
   a number it cannot, and that difference is the whole reason for the names. */
const BIG = [400, 400, 400, 13, 21, 21, 22];

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
/* The part drawing, which is a different question from the assembly view: a
   cross-section has no axis along the member, so a notch cannot show on one. */
const part = mid => sheet(mid).map(function (r) {
  return String(r[0]).toUpperCase() === 'VIEW'
    ? ['PLOT', 'SECT', 'ALL', 10, 'SECTIONS'] : r;   // PART is plates; a section is SECT
});
/* ---- wt / wb: the two places a bounding box has not got ---- */
CASES.byNum  = sheet([['NOTCH', 'sc.b', 0, 35, 0, 135, 'ho.sc']]);
CASES.byName = sheet([['NOTCH', 'sc.b', 0, 35, 'wt', '', 'ho.sc']]);
CASES.wbName = sheet([['NOTCH', 'sc.b', 0, 35, 'wb', '', 'ho.sc']]);
CASES.bigNum  = sheetOf([['NOTCH', 'sc.b', 0, 35, 0, 135, 'ho.sc']], BIG);
CASES.bigName = sheetOf([['NOTCH', 'sc.b', 0, 35, 'wt', '', 'ho.sc']], BIG);
CASES.bigOnly = sheetOf([], BIG);
CASES.andLY  = sheet([['NOTCH', 'sc.b', 0, 35, 'wt', 10, 'ho.sc']]);
CASES.noPlace = sheet([['NOTCH', 'sc.b', 0, 35, 'zz', '', 'ho.sc']]);

CASES.partPlain = part([]);
CASES.partNotch = part([['NOTCH', 'sc.b', 0, 400, ON[0], ON[1], 'ho.n']]);
/* The lower flange is not a special case. The elevation and its dimensions are
   written per EDGE, not for the top one, and an H is symmetric about its
   mid-height - so the same cope taken off the bottom has to come out line for
   line the same, and both flanges coped has to be exactly twice the cope. */
CASES.partBot  = part([['NOTCH', 'sc.b', 0, 400, ON[0], -ON[1], 'ho.n']]);
CASES.partBoth = part([['NOTCH', 'sc.b', 0, 400, ON[0],  ON[1], 'ho.n'],
                       ['NOTCH', 'sc.b', 0, 400, ON[0], -ON[1], 'ho.n']]);

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

  /* ---- wt / wb ----
     The names are not a shorthand for a number. They are the number the SHEET
     knows, and the difference only shows when the section changes: on an H-300
     the web meets the flange at 135 and a person can type it, on an H-400 it is
     179 and the same typed 135 is quietly in the wrong place. */
  console.log('');
  ok(same(R.byName, R.byNum),
     'a place named is the place typed — same steel, same drawing',
     shot(R.byName) + ' vs ' + shot(R.byNum));
  ok(!same(R.wbName, R.byName), 'wb is not wt',
     shot(R.wbName) + ' vs ' + shot(R.byName));
  ok(R.byName.kg < R.plain.kg, 'and it took something away', shot(R.byName));
  ok(!same(R.bigName, R.bigNum),
     'on a bigger section the name follows and the number does not',
     shot(R.bigName) + ' vs ' + shot(R.bigNum));
  ok(R.bigName.kg < R.bigOnly.kg && R.bigNum.kg < R.bigOnly.kg,
     'both still cut something, which is why the wrong one is dangerous',
     shot(R.bigName) + ' / ' + shot(R.bigNum) + ' of ' + shot(R.bigOnly));

  [['andLY', /leave L\.Y empty/, 'a named place with L.Y filled in as well'],
   ['noPlace', /is not a place on this section/, 'a place the section has not got']
  ].forEach(([k, re, what]) => {
    ok(re.test(R[k].panel), 'refused, and named: ' + what, R[k].panel.slice(0, 150));
    ok(same(R[k], R.plain), 'refused rows leave the member alone: ' + what);
  });

  /* ---- the part drawing ----
     A NOTCH sits at a distance ALONG the member, and a cross-section has no
     axis for that. So it goes on the side elevation the drawing already grows
     for a bolt that crosses the member - a member that is notched has to get
     one even with nothing bolted through it, or its part drawing shows a full
     section and says nothing about the piece missing from the end. */
  console.log('');
  ok(R.partPlain.lines > 0 && R.partNotch.lines > 0, 'both part drawings come out',
     R.partPlain.lines + ' / ' + R.partNotch.lines + ' lines');
  ok(R.partNotch.lines > R.partPlain.lines,
     'a notched member gains the side elevation',
     R.partPlain.lines + ' → ' + R.partNotch.lines + ' lines');
  /* Four sides of a plain elevation would be 4; a stepped one has the two
     risers as well, and the run is broken in two. */
  ok(R.partNotch.lines - R.partPlain.lines >= 6,
     'and it is stepped, not a plain rectangle',
     'gained ' + (R.partNotch.lines - R.partPlain.lines) + ' lines');
  ok(same(R.partBot, R.partNotch),
     'a cope on the bottom flange draws the same as one on the top',
     shot(R.partNotch) + '  vs  ' + shot(R.partBot));
  /* 3e-3, not 5e-4: these weights are read off the screen total, which is
     rounded to 3 places, and three of them go into this sum. */
  ok(R.partBoth.lines > R.partNotch.lines &&
     Math.abs((R.partPlain.kg - R.partBoth.kg)
              - 2 * (R.partPlain.kg - R.partNotch.kg)) < 3e-3,
     'both flanges coped steps twice and weighs twice the cope less',
     shot(R.partBoth));

  /* ---- the take-off ----
     A notched member's weight is right either way, because the area is backed
     out of the weight. What is NOT right is the kg/m that falls out of that:
     it matches no steel table, and a take-off line nobody can check against the
     table is a line nobody trusts. So the section it was cut FROM is reported,
     and what came away is its own column. */
  console.log('');
  async function boq(rows) {
    await page.evaluate(async rows => {
      window.postMessage({ plate3d: 'rows', rows: rows, name: 'notch' }, '*');
      await new Promise(r => setTimeout(r, 2500));
    }, rows);
    await page.evaluate(() => { const o = URL.createObjectURL.bind(URL);
      URL.createObjectURL = bl => { window.__f = bl; return o(bl); }; window.__f = null; });
    await page.evaluate(() => plateBuilder.exportBOQ());
    await page.waitForFunction(() => !!window.__f, null, { timeout: 45000 });
    const b64 = await page.evaluate(async () => {
      const u = new Uint8Array(await window.__f.arrayBuffer());
      let s = '';
      for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
      return btoa(s);
    });
    const f = path.join(SP, 'node_modules', '.notch-boq.xlsx');
    fs.writeFileSync(f, Buffer.from(b64, 'base64'));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(f);
    fs.unlinkSync(f);
    const ws = wb.worksheets.filter(w => /PART/i.test(w.name))[0];
    const out = { head: null, line: null };
    ws.eachRow({ includeEmpty: false }, r => {
      const v = (r.values || []).slice(1).map(c =>
        (c && typeof c === 'object') ? (c.result !== undefined ? c.result : '={' + c.formula + '}')
                                     : c);
      const t = v.map(x => String(x === undefined || x === null ? '' : x));
      if (t.indexOf('kg/m') >= 0) out.head = t;
      if (out.head && !out.line && String(t[0]).toUpperCase() === 'SC.B')
        // the cells as ExcelJS hands them over, so a formula can be read as a
        // formula: a cell with a cached answer reports the answer otherwise
        out.line = { cells: t, cell: (r.values || []).slice(1) };
    });
    return out;
  }

  const bPlain = await boq(CASES.plain);
  ok(bPlain.head && bPlain.head.indexOf('NOTCH kg') < 0,
     'a take-off with nothing notched has no deduction column',
     (bPlain.head || []).join(' | '));

  const bNotch = await boq(CASES.notchHalf);
  const ix = bNotch.head ? bNotch.head.indexOf('NOTCH kg') : -1;
  ok(ix > 0, 'a notched member brings the deduction column',
     (bNotch.head || []).join(' | '));
  if (ix > 0) {
    const kgm = +bNotch.line.cells[bNotch.head.indexOf('kg/m')];
    const ded = +bNotch.line.cells[ix];
    const unit = +bNotch.line.cells[bNotch.head.indexOf('UNIT kg')];
    /* 94.0 kg/m is what the steel table says for H-300x300x10x15. The engine
       draws its fillets as segments, so it lands near but not on it - what
       matters is that it is the SECTION's figure and not an average of the
       stretches, which would be far lower. */
    ok(Math.abs(kgm - 94.0) < 1.0, 'kg/m is the section it was cut from', 'kg/m ' + kgm);
    ok(Math.abs(ded - (R.plain.kg - R.notchHalf.kg)) < 5e-3,
       'the deduction is what came away',
       ded + ' vs ' + (R.plain.kg - R.notchHalf.kg));
    ok(Math.abs(unit - R.notchHalf.kg) < 5e-3, 'and the weight still lands right',
       unit + ' vs ' + R.notchHalf.kg);
    const c = bNotch.line.cell[bNotch.head.indexOf('UNIT kg')];
    const fm = (c && typeof c === 'object' && c.formula) ? c.formula : '(not a formula)';
    ok(/\*.*\/1000-/.test(fm),
       'the weight stays a live formula, with the deduction in it', fm);
  }

  if (errs.length) { bad++; console.log('\npage errors:\n  ' + errs.join('\n  ')); }
  console.log('\n' + checks + ' checks · ' + (bad ? bad + ' FAILED' : 'all pass'));
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
