/* TAPER, checked by what must be true of it rather than by numbers to match.

       node tools/check_taper.js

   A number copied out of a run and pinned in a test says only that today
   agrees with yesterday. These are statements that have to hold whatever the
   section is, so they keep meaning something after the geometry changes:

     · a taper between two sections of the SAME size is a straight member.
       Same weight, same drawing - there is nothing to vary.
     · a taper is the prismatoid of its own three sections. Measured against
       the ENGINE's own straight members - start, middle, end - so the check
       does not care how finely the engine draws a circle:
       (m0 + 4*mm + m1)/6, exact for a straight loft.
     · half the length is half the weight.
     · the alignment points move the axis, not the steel: bc bc, tc tc and
       mc mc all weigh the same. The taper point moves where it is gripped,
       not what it is.
     · which end is the start does not change the weight.
     · a hollow section keeps its wall. This is where it went wrong once: the
       bore was dropped and a tapered pipe came out solid, 916 kg reading as
       5145. And once more after that - the start ring was taken from the cut
       result, where PolyBool had re-laid it, so the loft joined corner to the
       WRONG corner and a tapered tube read 272 kg instead of 605.
     · the drawing follows: the outline is deep at one end and shallow at the
       other, measured off the DXF.

   Rows that cannot mean anything are refused, each with a message that names
   the row: two different shapes, two different corner counts, hollow into
   solid, no length, a name already taken, the same section twice, a section
   that was never defined, a point that is not on the section, and CUT or
   NOTCH aimed at a tapered member.
*/
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

const LEN = 12000;
/* Only h varies, so the middle section really is the one whose corners are the
   average of the two - which is what the prismatoid asks for. The fillet is the
   same on both, so it averages to itself. */
const Hs = h => ['SECT', 'sc.a', 'SM490', LEN, 'H', 'bc', h, 300, 300, 10, 15, 15, 18];
const sec = (id, row) => [row[0], id].concat(row.slice(2));
const DEEP = Hs(600), MID = Hs(450), THIN = Hs(300);

/* One member placed, whatever it is called. A taper row that is refused makes
   no member, so those sheets place the START section instead - the sheet still
   builds, the warning is on the panel, and what is drawn is the plain prism the
   taper would have started from. That is the second thing each refusal has to
   satisfy: it leaves everything else alone. */
const tail = m => [['MODULE', 'md.a', m, '', 0, 0, 0, 'YZ'],
                   ['MODULE', 'md.a', 'BASE', m, 'bc'],
                   ['ASSY', 'as.a', 'md.a', 'ADD', 0, 0, 0],
                   ['VIEW', 'as.a', 'FRONT', '', '', 40, 'T'], ['END']];
const prism = row => [['COORD', 'ZUP'], sec('sc.a', row)].concat(tail('sc.a'));
/* rows: extra definitions; t: the TAPER row's tail (pts and length) */
const taper = (a, b, t, place) => [['COORD', 'ZUP'], sec('sc.a', a), sec('sc.b', b),
  ['TAPER', 'tp.1', 'sc.a', 'sc.b'].concat(t || ['bc', 'bc', 'bc', LEN])]
  .concat(tail(place || 'tp.1'));

const P = (id, d, t) => ['SECT', id, 'SM490', LEN, 'P', 'bc', d, t];
const R = (id, h, b, t) => ['SECT', id, 'SM490', LEN, 'R', 'bc', h, b, t, 0];
const C = (id, h) => ['SECT', id, 'SM490', LEN, 'C', 'bc', h, 90, 9, 13, 13, 7];
const PL = (id, b, h) => ['PLATE', id, 'SM490', LEN, 'RECT', 'bc', b, h];

const CASES = {
  /* the three straight members the prismatoid is built from */
  mDeep: prism(DEEP),
  mMid:  prism(MID),
  mThin: prism(THIN),

  full:    taper(DEEP, THIN),
  same:    taper(DEEP, sec('sc.b', DEEP)),          // two ids, one size
  half:    taper(DEEP, THIN, ['bc', 'bc', 'bc', LEN / 2]),
  flipped: taper(THIN, DEEP),                        // the other way round
  topFlat: taper(DEEP, THIN, ['tc', 'tc', 'tc', LEN]),
  midFlat: taper(DEEP, THIN, ['mc', 'mc', 'mc', LEN]),
  gripTop: taper(DEEP, THIN, ['bc', 'bc', 'tc', LEN]),   // same shape, other grip

  /* hollow: the wall has to survive the taper */
  pipe:   [['COORD', 'ZUP'], P('sc.a', 400, 12), P('sc.b', 200, 8),
           ['TAPER', 'tp.1', 'sc.a', 'sc.b', 'bc', 'bc', 'bc', LEN]].concat(tail('tp.1')),
  pipe0:  [['COORD', 'ZUP'], P('sc.a', 400, 12)].concat(tail('sc.a')),
  pipeM:  [['COORD', 'ZUP'], P('sc.a', 300, 10)].concat(tail('sc.a')),
  pipe1:  [['COORD', 'ZUP'], P('sc.a', 200, 8)].concat(tail('sc.a')),
  box:    [['COORD', 'ZUP'], R('sc.a', 300, 200, 9), R('sc.b', 150, 100, 9),
           ['TAPER', 'tp.1', 'sc.a', 'sc.b', 'bc', 'bc', 'bc', LEN]].concat(tail('tp.1')),
  box0:   [['COORD', 'ZUP'], R('sc.a', 300, 200, 9)].concat(tail('sc.a')),
  boxM:   [['COORD', 'ZUP'], R('sc.a', 225, 150, 9)].concat(tail('sc.a')),
  box1:   [['COORD', 'ZUP'], R('sc.a', 150, 100, 9)].concat(tail('sc.a')),

  /* refused - each one places sc.a, so the sheet still builds */
  badFamily: [['COORD', 'ZUP'], sec('sc.a', DEEP), C('sc.b', 300),
              ['TAPER', 'tp.1', 'sc.a', 'sc.b', 'bc', 'bc', 'bc', LEN]].concat(tail('sc.a')),
  badCorner: [['COORD', 'ZUP'], sec('sc.a', DEEP), sec('sc.b', Hs(300).slice(0, 12).concat(0)),
              ['TAPER', 'tp.1', 'sc.a', 'sc.b', 'bc', 'bc', 'bc', LEN]].concat(tail('sc.a')),
  badBore:   [['COORD', 'ZUP'], R('sc.a', 300, 200, 9), PL('sc.b', 200, 300),
              ['TAPER', 'tp.1', 'sc.a', 'sc.b', 'bc', 'bc', 'bc', LEN]].concat(tail('sc.a')),
  badLen:    [['COORD', 'ZUP'], sec('sc.a', DEEP), sec('sc.b', THIN),
              ['TAPER', 'tp.1', 'sc.a', 'sc.b', 'bc', 'bc', 'bc', 0]].concat(tail('sc.a')),
  badName:   [['COORD', 'ZUP'], sec('sc.a', DEEP), sec('sc.b', THIN),
              ['TAPER', 'sc.a', 'sc.a', 'sc.b', 'bc', 'bc', 'bc', LEN]].concat(tail('sc.a')),
  badTwice:  [['COORD', 'ZUP'], sec('sc.a', DEEP),
              ['TAPER', 'tp.1', 'sc.a', 'sc.a', 'bc', 'bc', 'bc', LEN]].concat(tail('sc.a')),
  badMissing:[['COORD', 'ZUP'], sec('sc.a', DEEP),
              ['TAPER', 'tp.1', 'sc.a', 'sc.zz', 'bc', 'bc', 'bc', LEN]].concat(tail('sc.a')),
  badPoint:  [['COORD', 'ZUP'], sec('sc.a', DEEP), sec('sc.b', THIN),
              ['TAPER', 'tp.1', 'sc.a', 'sc.b', 'zz', 'bc', 'bc', LEN]].concat(tail('sc.a')),

  /* a taper is not something to cut, and not a knife */
  cutTaper:  [['COORD', 'ZUP'], sec('sc.a', DEEP), sec('sc.b', THIN),
              ['HOLE', 'ho.a', 'CIRC', 'mc', 60],
              ['TAPER', 'tp.1', 'sc.a', 'sc.b', 'bc', 'bc', 'bc', LEN],
              ['CUT', 'tp.1', 0, 300, 'ho.a']].concat(tail('tp.1')),
  notchTaper:[['COORD', 'ZUP'], sec('sc.a', DEEP), sec('sc.b', THIN),
              ['HOLE', 'ho.a', 'CIRC', 'mc', 60],
              ['TAPER', 'tp.1', 'sc.a', 'sc.b', 'bc', 'bc', 'bc', LEN],
              ['NOTCH', 'tp.1', 0, 3000, 0, 300, 'ho.a']].concat(tail('tp.1'))
};

let bad = 0, checks = 0;
const ok = (c, what, d) => {
  checks++;
  if (c) { console.log('  ok    ' + what); return; }
  bad++;
  console.log('  FAIL  ' + what + (d ? '  [' + d + ']' : ''));
};
const near = (a, b, t) => Math.abs(a - b) <= (t === undefined ? 0.02 : t);
/* The outline's depth close to each end of the member, off the DXF itself.
   A prism reads the same at both ends; a taper cannot. */
function depths(dxf) {
  if (!dxf) return null;
  const T = dxf.split('\n').map(s => s.trim()), pts = [];
  for (let i = 0; i < T.length; i++) {
    if (T[i] !== '0' || T[i + 1] !== 'LINE') continue;
    let lay = '?', x1, y1, x2, y2;
    for (let j = i + 2; j < Math.min(i + 60, T.length); j += 2) {
      if (T[j] === '0') break;
      if (T[j] === '8') lay = T[j + 1];
      if (T[j] === '10') x1 = +T[j + 1]; if (T[j] === '20') y1 = +T[j + 1];
      if (T[j] === '11') x2 = +T[j + 1]; if (T[j] === '21') y2 = +T[j + 1];
    }
    if (lay !== 'PL3D-OUTLINE') continue;
    pts.push([x1, y1], [x2, y2]);
  }
  if (pts.length < 4) return null;
  const xs = pts.map(q => q[0]);
  const x0 = Math.min.apply(null, xs), x1m = Math.max.apply(null, xs), w = (x1m - x0) * 0.04;
  const band = (lo, hi) => {
    const g = pts.filter(q => q[0] >= lo && q[0] <= hi).map(q => q[1]);
    return g.length ? Math.max.apply(null, g) - Math.min.apply(null, g) : 0;
  };
  return { lo: band(x0, x0 + w), hi: band(x1m - w, x1m), span: x1m - x0 };
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
           '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.route('**/{unpkg.com,cdnjs.cloudflare.com}/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: LIB(r.request().url()) }));
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  page.on('dialog', async d => { await d.dismiss(); });
  await page.goto('file://' + SP + '/host_test.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const Rz = {};
  console.log('case         placed  err            kg   depth lo/hi');
  for (const k of Object.keys(CASES)) {
    const b = await page.evaluate(async rows => {
      window.__b = null;
      const on = e => { if (e.data && e.data.plate3d === 'built') window.__b = e.data; };
      window.addEventListener('message', on);
      window.postMessage({ plate3d: 'rows', rows: rows, name: 'taper' }, '*');
      await new Promise(r => setTimeout(r, 2200));
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
    const d = depths(dxf);
    Rz[k] = { kg: b.kg, panel: b.panel, d: d,
              placed: b.built ? b.built.placed : -1,
              errors: b.built ? b.built.errors : -1 };
    console.log('  ' + k.padEnd(11) + String(Rz[k].placed).padStart(5) +
      String(Rz[k].errors).padStart(5) + String(Rz[k].kg).padStart(14) + '   ' +
      (d ? d.lo.toFixed(0) + ' / ' + d.hi.toFixed(0) : '-'));
  }
  console.log('');

  /* ---- what a taper is ---- */
  ok(Rz.full.errors === 0 && Rz.full.placed === 1, 'a taper builds one member',
     Rz.full.panel.slice(0, 120));
  ok(near(Rz.same.kg, Rz.mDeep.kg),
     'a taper between two sections of the same size IS a straight member',
     Rz.same.kg + ' vs ' + Rz.mDeep.kg + ' kg');
  const pris = (a, m, b) => (a + 4 * m + b) / 6;
  ok(near(Rz.full.kg, pris(Rz.mDeep.kg, Rz.mMid.kg, Rz.mThin.kg)),
     'the weight is the prismatoid of its own three sections',
     Rz.full.kg + ' vs ' + pris(Rz.mDeep.kg, Rz.mMid.kg, Rz.mThin.kg).toFixed(3));
  ok(near(Rz.half.kg, Rz.full.kg / 2),
     'half the length is half the weight', Rz.half.kg + ' vs ' + (Rz.full.kg / 2));
  ok(near(Rz.flipped.kg, Rz.full.kg),
     'which end is the start does not change the weight',
     Rz.flipped.kg + ' vs ' + Rz.full.kg);
  ok(near(Rz.topFlat.kg, Rz.full.kg) && near(Rz.midFlat.kg, Rz.full.kg),
     'the alignment points move the axis, not the steel',
     [Rz.full.kg, Rz.topFlat.kg, Rz.midFlat.kg].join(' / '));
  ok(near(Rz.gripTop.kg, Rz.full.kg) && Rz.gripTop.d && Rz.full.d &&
     near(Rz.gripTop.d.lo, Rz.full.d.lo, 1) && near(Rz.gripTop.d.hi, Rz.full.d.hi, 1),
     'the taper point moves where it is gripped, not what it is',
     Rz.gripTop.kg + ' kg');
  ok(Rz.full.kg < Rz.mDeep.kg && Rz.full.kg > Rz.mThin.kg,
     'it weighs between its two ends',
     Rz.mThin.kg + ' < ' + Rz.full.kg + ' < ' + Rz.mDeep.kg);

  /* ---- hollow sections keep their wall ---- */
  ok(near(Rz.pipe.kg, pris(Rz.pipe0.kg, Rz.pipeM.kg, Rz.pipe1.kg)),
     'a tapered pipe is the prismatoid of three pipes - the bore flows too',
     Rz.pipe.kg + ' vs ' + pris(Rz.pipe0.kg, Rz.pipeM.kg, Rz.pipe1.kg).toFixed(3));
  ok(near(Rz.box.kg, pris(Rz.box0.kg, Rz.boxM.kg, Rz.box1.kg)),
     'a tapered box is the prismatoid of three boxes - corners join in order',
     Rz.box.kg + ' vs ' + pris(Rz.box0.kg, Rz.boxM.kg, Rz.box1.kg).toFixed(3));

  /* ---- the drawing ---- */
  ok(Rz.mDeep.d && near(Rz.mDeep.d.lo, Rz.mDeep.d.hi, 1),
     'a straight member draws the same depth at both ends',
     Rz.mDeep.d && (Rz.mDeep.d.lo + ' / ' + Rz.mDeep.d.hi));
  ok(Rz.full.d && Rz.full.d.lo - Rz.full.d.hi > 100,
     'a taper draws deep at one end and shallow at the other',
     Rz.full.d && (Rz.full.d.lo + ' / ' + Rz.full.d.hi));
  ok(Rz.flipped.d && Rz.flipped.d.hi - Rz.flipped.d.lo > 100,
     'and the other way round when the ends are swapped',
     Rz.flipped.d && (Rz.flipped.d.lo + ' / ' + Rz.flipped.d.hi));

  /* ---- rows that cannot mean anything ---- */
  /* A tube into a solid is caught as two different SHAPES, not by the bore
     check - which cannot fire today, because a section whose wall eats its own
     bore is refused as a solid bar long before it gets here. The message the
     person actually reads is the one this asserts. */
  [['badFamily', /is an H section and .* is a C section/, 'two different shapes'],
   ['badCorner', /do not have the same number of corners/, 'two different corner counts'],
   ['badBore', /is an R section and .* is a plate outline/, 'a tube into a solid'],
   ['badLen', /Length must be greater than 0/, 'no length'],
   ['badName', /reuses a PLATE, BAR or SECT id/, 'a name already taken'],
   ['badTwice', /the two ends are the same section/, 'the same section twice'],
   ['badMissing', /is not a PLATE or SECT that has been defined/, 'a section never defined'],
   ['badPoint', /is not one of/, 'a point that is not on the section']
  ].forEach(function (e) {
    const k = e[0], re = e[1], what = e[2];
    ok(re.test(Rz[k].panel), 'refused, and named: ' + what, Rz[k].panel.slice(0, 170));
    ok(near(Rz[k].kg, Rz[k === 'badBore' ? 'box0' : 'mDeep'].kg),
       'refused rows leave the rest of the sheet alone: ' + what, String(Rz[k].kg));
  });
  ok(/What a cut takes out of a section that changes/.test(Rz.cutTaper.panel),
     'refused, and named: a CUT aimed at a tapered member',
     Rz.cutTaper.panel.slice(0, 170));
  ok(near(Rz.cutTaper.kg, Rz.full.kg),
     'and the taper is left as it was', Rz.cutTaper.kg + ' vs ' + Rz.full.kg);
  ok(/a notch cuts the member into stretches/.test(Rz.notchTaper.panel),
     'refused, and named: a NOTCH aimed at a tapered member',
     Rz.notchTaper.panel.slice(0, 170));
  ok(near(Rz.notchTaper.kg, Rz.full.kg),
     'and the taper is left as it was', Rz.notchTaper.kg + ' vs ' + Rz.full.kg);

  ok(!errs.length, 'no page errors', errs.join(' | '));
  console.log('\n' + checks + ' checks · ' + (bad ? bad + ' FAILED' : 'all pass'));
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
