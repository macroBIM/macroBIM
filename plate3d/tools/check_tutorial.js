/* The tutorial, driven the way a reader drives it.

       node tools/check_tutorial.js

   A tutorial is a promise that if you do what it says, what it says will
   happen happens. Nothing about that can be checked by reading it, so nothing
   here reads it: every step is opened in the real app, loaded with its own
   button, saved with its own button, and the saved workbook is loaded back
   through the file picker like any other sheet.

   What has to hold:

     · every step builds, with no errors and at least one member placed
     · the members and the weight the step PRINTS are the ones it builds -
       the text quotes numbers, and quoted numbers go stale silently
     · the workbook the step saves builds the same model as the button did,
       which is the only thing that makes Save .xlsx worth having
     · the last step is the example workbook, row for row. The tutorial is
       supposed to arrive at PLATE3D_SPLICE.xlsx; if it arrives somewhere
       else, it has been teaching a sheet nobody ships.
     · the guide still works after the tutorial has been open, because the
       two now share one window and one Print button. */
const { chromium } = require('playwright-core');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const os = require('os');

const P3 = path.resolve(__dirname, '..');
const SP = __dirname;
const SAMPLE = path.join(P3, 'PLATE3D_SPLICE.xlsx');

const LIB = f => {
  let p = SP + '/node_modules/three/build/three.min.js';
  if (f.includes('OrbitControls')) p = SP + '/node_modules/three/examples/js/controls/OrbitControls.js';
  if (f.includes('polybool')) p = SP + '/node_modules/polybooljs/dist/polybool.min.js';
  if (f.includes('exceljs')) p = SP + '/node_modules/exceljs/dist/exceljs.min.js';
  return fs.readFileSync(p, 'utf-8');
};

let bad = 0, checks = 0;
function ok(cond, what, detail) {
  checks++;
  if (cond) return true;
  bad++;
  console.log('  FAIL  ' + what + (detail ? '\n        ' + detail : ''));
  return false;
}

/* A workbook's input tab as plain rows: formulas by the value they hold,
   trailing blanks off, comment rows out. The tutorial's files and the example
   have to be comparable, and the example carries its notes in column A. */
function rowsOf(wb, dropFirstCol) {
  const ws = wb.worksheets.filter(s => String(s.name).toLowerCase() === 'input')[0];
  if (!ws) throw new Error('no input sheet');
  const out = [];
  ws.eachRow({ includeEmpty: true }, r => {
    let v = (r.values || []).slice(1).map(c => {
      if (c === null || c === undefined) return null;
      if (typeof c === 'object') {
        if (c.result !== undefined) return c.result;
        if (c.richText) return c.richText.map(t => t.text).join('');
        if (c.text !== undefined) return c.text;
        throw new Error('cell with no value: ' + JSON.stringify(c).slice(0, 80));
      }
      return c;
    });
    if (dropFirstCol) v = v.slice(1);
    while (v.length && cell(v[v.length - 1]) === '') v.pop();
    if (!v.length) return;
    if (String(v[0]).charAt(0) === '#' || String(v[0]).charAt(0) === '!') return;
    out.push(v);
  });
  return out;
}
/* An empty cell reaches here three ways - null, '' and a hole in ExcelJS's
   sparse values array, which is undefined. All three are the same empty cell,
   and String(undefined) is the word "undefined", so this cannot be left to
   String() to sort out. */
const cell = v => (v === null || v === undefined) ? '' : v;
const same = (a, b) => a.length === b.length && a.every((r, i) =>
  r.length === b[i].length && r.every((c, j) => {
    var x = cell(c), y = cell(b[i][j]);
    return (typeof x === 'number' && typeof y === 'number')
      ? Math.abs(x - y) < 1e-9 : String(x) === String(y);
  }));

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
           '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.route('**/{unpkg.com,cdnjs.cloudflare.com}/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: LIB(r.request().url()) }));
  await page.route('**/fonts.{googleapis,gstatic}.com/**', r => r.abort());
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto('file://' + SP + '/host_test.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  /* ---- the button is where it was agreed to be ---- */
  const bar = await page.evaluate(() =>
    Array.prototype.map.call(document.querySelectorAll('#pb-bar button.guide'),
      b => b.textContent.trim()));
  ok(bar.join(' / ') === 'Guide / Tutorial / Example',
     'Tutorial sits between Guide and Example', 'bar reads: ' + bar.join(' / '));

  await page.evaluate(() => plateBuilder.openTutorial());
  await page.waitForTimeout(400);
  const shape = await page.evaluate(() => ({
    open: getComputedStyle(document.getElementById('pb-help')).display,
    guideHidden: document.getElementById('pb-doc-guide').hidden,
    title: document.getElementById('pb-doc-title').textContent.trim(),
    steps: document.querySelectorAll('#pb-doc-tut h2 .n').length,
    loads: document.querySelectorAll('#pb-doc-tut button.tutgo').length,
    saves: document.querySelectorAll('#pb-doc-tut button.tutdl').length,
    notes: Array.prototype.map.call(document.querySelectorAll('#pb-doc-tut p.xlsnote'),
      p => p.textContent)
  }));
  ok(shape.open === 'flex', 'Tutorial opens the document window');
  ok(shape.guideHidden === true, 'the guide is put away while the tutorial is up');
  ok(/tutorial/i.test(shape.title), 'the window is retitled', shape.title);
  const N = shape.steps;
  ok(N >= 8, 'the tutorial has its steps', N + ' steps');
  ok(shape.loads === N && shape.saves === N,
     'every step has a Load and a Save', N + ' steps, ' + shape.loads + ' load, ' +
     shape.saves + ' save');
  ok(shape.notes.length === N, 'every step states what it builds');

  /* ---- what each step SAYS, against what it DOES ---- */
  const said = shape.notes.map(t => {
    const m = t.match(/sheet is (?:then )?(\d+) rows and builds (\d+) members? · ([\d.]+) kg/);
    if (!m) throw new Error('cannot read the step note: ' + t);
    return { rows: +m[1], placed: +m[2], kg: +m[3] };
  });

  async function panel() {
    return await page.evaluate(() => {
      const r = document.getElementById('pb-result');
      const tot = document.getElementById('pb-total');
      const txt = (tot ? tot.innerText : '');
      const m = txt.match(/Placed members:\s*(\d+).*?Total weight:\s*([\d.]+)/s);
      return { report: r ? r.innerText : '', placed: m ? +m[1] : -1, kg: m ? +m[2] : -1 };
    });
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p3tut-'));
  console.log('\nstep   rows   button        workbook       says');
  let lastFile = null;
  for (let i = 0; i < N; i++) {
    /* --- the Load button --- */
    await page.evaluate(() => plateBuilder.openTutorial());
    await page.waitForTimeout(200);
    await page.evaluate(i => document.querySelectorAll('#pb-doc-tut button.tutgo')[i].click(), i);
    await page.waitForTimeout(2200);
    const byBtn = await panel();

    /* --- the Save button, and the file it writes --- */
    await page.evaluate(() => plateBuilder.openTutorial());
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const o = URL.createObjectURL.bind(URL);
      URL.createObjectURL = bl => { window.__b = bl; return o(bl); };
      window.__b = null;
    });
    await page.evaluate(i => document.querySelectorAll('#pb-doc-tut button.tutdl')[i].click(), i);
    let b64 = null;
    try {
      await page.waitForFunction(() => !!window.__b, null, { timeout: 30000 });
      b64 = await page.evaluate(async () => {
        const u = new Uint8Array(await window.__b.arrayBuffer());
        let s = '';
        for (let k = 0; k < u.length; k++) s += String.fromCharCode(u[k]);
        return btoa(s);
      });
    } catch (e) { /* reported below */ }
    let byFile = { placed: -1, kg: -1, report: 'no file' };
    let file = null;
    if (b64) {
      file = path.join(tmp, 'step' + (i + 1) + '.xlsx');
      fs.writeFileSync(file, Buffer.from(b64, 'base64'));
      await page.evaluate(() => plateBuilder.closeGuide());
      await page.setInputFiles('#pb-file', file);
      try {
        await page.waitForFunction(() => {
          const r = document.getElementById('pb-result');
          return r && /Succeed|Failed|error/i.test(r.innerText);
        }, null, { timeout: 120000 });
      } catch (e) { /* reported below */ }
      await page.waitForTimeout(900);
      byFile = await panel();
      lastFile = file;
    }

    const s = said[i];
    console.log('  ' + String(i + 1).padStart(2) + '   ' + String(s.rows).padStart(4) +
      '   ' + String(byBtn.placed).padStart(3) + ' · ' + byBtn.kg.toFixed(3).padStart(8) +
      '   ' + String(byFile.placed).padStart(3) + ' · ' + byFile.kg.toFixed(3).padStart(8) +
      '   ' + String(s.placed).padStart(3) + ' · ' + s.kg.toFixed(3).padStart(8));

    ok(/✓|Succeed/.test(byBtn.report) && byBtn.placed > 0,
       'step ' + (i + 1) + ' builds when its Load button is pressed',
       byBtn.report.split('\n').slice(0, 4).join(' | '));
    ok(byBtn.placed === s.placed && Math.abs(byBtn.kg - s.kg) < 5e-4,
       'step ' + (i + 1) + ' builds what it says it builds',
       'says ' + s.placed + ' · ' + s.kg + ' kg, builds ' + byBtn.placed + ' · ' + byBtn.kg);
    ok(!!b64, 'step ' + (i + 1) + ' saves a workbook');
    ok(byFile.placed === byBtn.placed && Math.abs(byFile.kg - byBtn.kg) < 5e-4,
       'step ' + (i + 1) + ' saved workbook builds what the button built',
       'button ' + byBtn.placed + ' · ' + byBtn.kg + ', file ' + byFile.placed + ' · ' + byFile.kg);
    if (file) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(file);
      const rows = rowsOf(wb, false);
      ok(rows.length > 0, 'step ' + (i + 1) + ' workbook has keyword rows');
    }
  }

  /* ---- the last step IS the example ---- */
  if (lastFile) {
    const a = new ExcelJS.Workbook(); await a.xlsx.readFile(lastFile);
    const b = new ExcelJS.Workbook(); await b.xlsx.readFile(SAMPLE);
    const mine = rowsOf(a, false), theirs = rowsOf(b, true);
    let why = 'tutorial ' + mine.length + ' rows, example ' + theirs.length + ' rows';
    for (let i = 0; i < Math.max(mine.length, theirs.length); i++) {
      if (same([mine[i] || []], [theirs[i] || []])) continue;
      why += '\n        row ' + (i + 1) +
             '\n          tutorial: ' + JSON.stringify(mine[i] || null) +
             '\n          example : ' + JSON.stringify(theirs[i] || null);
      break;
    }
    ok(same(mine, theirs), 'the last step is PLATE3D_SPLICE.xlsx, row for row', why);
  }

  /* ---- Print follows whichever document is open ----
     The sheet it writes is inspected before print() is reached: what changed
     is which pane gets copied and what the copy is called, and that is all
     built by then. */
  await page.evaluate(() => plateBuilder.openTutorial());
  await page.waitForTimeout(300);
  await page.evaluate(() => plateBuilder.printGuide());
  await page.waitForTimeout(160);
  const pr = await page.evaluate(() => {
    const fr = document.querySelector('iframe[aria-hidden="true"]');
    if (!fr || !fr.contentDocument) return null;
    const d = fr.contentDocument;
    return { title: d.title,
             header: (d.querySelector('#pb-help header b') || {}).textContent || '',
             steps: d.querySelectorAll('.doc h2 .n').length,
             guide: d.querySelectorAll('#pb-toc').length };
  });
  ok(!!pr, 'Print builds a sheet with the tutorial open');
  if (pr) {
    ok(/tutorial/i.test(pr.title) && /tutorial/i.test(pr.header),
       'the printed sheet is titled for the tutorial', pr.title + ' / ' + pr.header);
    ok(pr.steps >= 8, 'the printed sheet holds the steps', pr.steps + ' steps');
    ok(pr.guide === 0, 'the guide did not come along with it');
  }
  await page.waitForTimeout(2400);            // the iframe removes itself

  /* ---- the guide survives sharing a window ---- */
  await page.evaluate(() => plateBuilder.openGuide());
  await page.waitForTimeout(400);
  const g = await page.evaluate(() => ({
    tutHidden: document.getElementById('pb-doc-tut').hidden,
    title: document.getElementById('pb-doc-title').textContent.trim(),
    toc: document.querySelectorAll('#pb-toc a').length,
    badges: document.querySelectorAll('#pb-doc-guide h2 .n').length,
    stray: document.querySelectorAll('#pb-doc-tut h2 .up').length
  }));
  ok(g.tutHidden === true, 'the tutorial is put away when the guide comes back');
  ok(/how to use/.test(g.title), 'the window is retitled back', g.title);
  ok(g.toc > 20, 'the guide still builds its contents', g.toc + ' entries');
  ok(g.badges > 5, 'the guide still numbers its chapters', g.badges + ' badges');
  ok(g.stray === 0, 'the contents did not reach into the tutorial',
     g.stray + ' back-links added to tutorial headings');

  if (errs.length) { bad++; console.log('\npage errors:\n  ' + errs.join('\n  ')); }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('\n' + checks + ' checks · ' + (bad ? bad + ' FAILED' : 'all pass'));
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
