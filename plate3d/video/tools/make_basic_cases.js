/* The four workbooks the teaching film types its way through.

   Every one is PLATE3D_BASIC.xlsx with a handful of cells changed - never a
   purpose-built model. The film's claim is "this is the example you can
   download", and a model that only exists inside the film would make that a
   lie.

   Two of the four MUST produce the identical model to the one they came from.
   That is the whole point of those beats: rows collapse, nothing moves. If a
   collapse changes the model then the collapse is wrong, and showing it anyway
   would teach a mistake. So each case declares what it expects and the script
   checks it against the real engine rather than against my arithmetic. The
   other two are cut 13's before and after, where the holes are meant to differ
   because that is the beat.

   Checking is not a formality here. It threw out a fifth case - see the note
   above CASES - and it caught a column mistake that had laid 1,872 members
   under a green tick.

     node make_basic_cases.js            build, then verify against the engine
     node make_basic_cases.js --build    build only                           */
const ExcelJS = require('./node_modules/exceljs');
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const V = path.resolve(SP, '..');
const OUT = SP + '/basic';
const SRC = path.resolve(V, '..') + '/PLATE3D_BASIC.xlsx';
fs.mkdirSync(OUT, { recursive: true });

/* Column letters, so a change reads like the sheet rather than like an index.
   The input sheet keeps column A for the note beside each row, so every block
   starts at B. */
const C = { B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9, J: 10, K: 11, L: 12,
            M: 13, N: 14, O: 15, P: 16, Q: 17, R: 18, S: 19, T: 20, U: 21, V: 22 };

/* Rows of PLATE3D_BASIC.xlsx that these cases touch. Read off the file, not
   remembered - if the example is ever re-cut these have to be re-read, and the
   verify pass is what will say so. */
const R = {
  plBase:   2,        // PLATE pl.base SS275 25 RECT mc 400 400
  hoSlot:  11,        // HOLE ho.slot RECT mc 40 22   - base.pt is in E, not G:
                      //   a HOLE row has no mat and no thk, so its columns are
                      //   id shape base.pt p1 p2 and everything shifts left two
  assy:   [65, 75],   // the ASSY block, as.stf 65-68 then as.bent 70-75
  cutClt1: 27,        // CUT pl.clt -50 -50 ho.m26 0 50 2
  cutClt2: 28,        // CUT pl.clt  50 -50 ho.m26 0 50 2
  anch1:   42, anch4: 45   // MODULE md.col bar.anch_1..4, coordinate form
};

/* Delete every ASSY row except the ones named, bottom-up so the earlier row
   numbers stay valid while the later ones are removed.

   This is how the four ASSY commands get a cut each. BASIC's assembly block
   builds the whole three-bent frame in ten rows, and running the finished model
   under all four captions is what the first pass did - the same picture turning
   four times while the words changed underneath. Stripping the block back to
   one command at a time is the only way MIR, COPY and ROT show what they do. */
function keepAssy(ws, keep) {
  for (let r = R.assy[1]; r >= R.assy[0]; r--) {
    if (keep.indexOf(r) >= 0) continue;
    if (String(ws.getCell(r, C.B).value || '').trim().toUpperCase() !== 'ASSY') continue;
    ws.spliceRows(r, 1);
  }
}

/* Strip the sheet back to one plate and write a MODULE block that places it a
   few times over, for the two beats that are about placement itself.

   These two are not BASIC with cells changed - they are one row of BASIC and a
   demonstration built round it, and that is deliberate. "How does a plate stand
   up in XY, XZ and YZ" cannot be shown on a model that has a column, four
   anchors and a beam in the way; the answer is one plate, three times, with
   nothing else on screen.

   The demonstration plate is a 300 x 300 slab 80 thick, and the proportions are
   the whole reason it works. At BASIC's 400 x 400 x 25 the step between mc-, mc
   and mc+ is 12.5mm against a 400mm plate - three percent, invisible at any
   framing that also shows the plate. At 80 on 300 the thickness is better than
   a quarter of the width, the three sit a clear 40mm apart, and the rule being
   demonstrated is identical. */
function demo(ws, thk, rows) {
  ws.spliceRows(3, 5);                                  // keep pl.base's row
  ws.spliceRows(4, ws.rowCount);                        // and nothing after it
  const b = ws.getRow(2);
  b.getCell(C.C).value = 'pl.demo';
  b.getCell(C.E).value = thk;
  b.getCell(C.G).value = 'mc';
  b.getCell(C.H).value = 300;
  b.getCell(C.I).value = 300;
  let r = 4;
  const put = a => { const row = ws.getRow(r++);
    a.forEach((v, i) => { if (v !== null) row.getCell(i + 2).value = v; }); };
  put(['# MODULE', 'id', 'member', 'Ref.Pt', 'L.X', 'L.Y', 'L.Z', 'PLANE']);
  rows.forEach(put);
  put(['MODULE', 'md.d', 'BASE', 'pl.demo', 'mc']);
  put(['# ASSY', 'id', 'ref', 'cmd', 'p1', 'p2', 'p3']);
  put(['ASSY', 'as.d', 'md.d', 'ADD', 0, 0, 0]);
  put(['END']);
}

/* Each case is a function handed the input worksheet. `same: true` means the
   model it produces has to match BASIC exactly - same members, same weight.
   `members` is an exact count instead, for the cases that are meant to differ
   and whose whole point is how many of something there now are. */
const CASES = [
  /* There is no case here for "move the origin and watch the cuts move", and
     the absence was measured rather than assumed. It was going to be cut 13.

       pl.base base.pt  mc -> bl     1702.75 kg   +1.87 vs BASIC
       ho.slot base.pt  mc -> bl     1701.00 kg   +0.12 vs BASIC

     Heavier means less steel was removed, which means cuts stopped cutting.
     pl.base is 400x400 about mc with its holes at +-150, and every other
     nine-point is 200mm away, so any change walks the holes clean off the
     outline - the shot would show them vanish, not move. Moving the shape's
     origin instead is gentler but not clean either: ho.slot steps by (20,11)
     and the two +x slots then run 10mm past the edge of pl.slv and get clipped,
     which reads on screen as a mistake in the example.

     So the beat is gone. Cut 12 states the rule with the origin marked and a
     dimension line drawn to the hole, and cut 16 proves it with a row already
     in the workbook - pl.cap's mc is where -130 -130 is measured from and
     pl.stf's bl is what lands there, which is why the corner comes off exactly.
     A third pass at the same idea was mine to add and it could not be filmed
     honestly, so it is not filmed at all.                                    */
  {
    id: 'b13a', same: false,
    what: 'one hole on pl.clt',
    why: 'cut 13 before - repeat columns cleared, second CUT row gone',
    edit: ws => {
      [C.G, C.H, C.I].forEach(c => { ws.getCell(R.cutClt1, c).value = null; });
      ws.spliceRows(R.cutClt2, 1);
    }
  },
  {
    id: 'b13b', same: false,
    what: 'three holes, one axis',
    why: 'cut 13 after - dx dy repeat back on, still one CUT row',
    edit: ws => { ws.spliceRows(R.cutClt2, 1); }
  },
  {
    id: 'b14', same: true,
    what: 'one CUT row, two axes',
    why: 'cut 14 - two rows become one and the six holes stay put',
    edit: ws => {
      ws.getCell(R.cutClt1, C.J).value = 100;      // dx2
      ws.getCell(R.cutClt1, C.K).value = 0;        // dy2
      ws.getCell(R.cutClt1, C.L).value = 1;        // repeat2
      ws.spliceRows(R.cutClt2, 1);
    }
  },
  /* 19-22: placement itself, on one plate with nothing else in the way. */
  { id: 'bplane', members: 3, what: 'one plate in XY, XZ, YZ',
    why: 'cut 19 - the same plate lying flat, standing, standing crossways',
    edit: ws => demo(ws, 80, [
      ['MODULE', 'md.d', 'pl.demo', 'mc', 0,    0, 0, 'XY'],
      ['MODULE', 'md.d', 'pl.demo', 'mc', 520,  0, 0, 'XZ'],
      ['MODULE', 'md.d', 'pl.demo', 'mc', 1040, 0, 0, 'YZ']]) },
  { id: 'bface', members: 3, what: 'mc- / mc / mc+ on the same z',
    why: 'cut 21 - one coordinate typed, three faces landing on it',
    /* Spread by 360 - a fraction over the plate width - so the three read as
       three and not as one solid. Every one is placed at z 0, so the grid line
       through them is the coordinate that was typed and the only thing that
       differs is which face of the steel sits on it. */
    edit: ws => demo(ws, 80, [
      ['MODULE', 'md.d', 'pl.demo', 'mc-', 0,   0, 0, 'XY'],
      ['MODULE', 'md.d', 'pl.demo', 'mc',  360, 0, 0, 'XY'],
      ['MODULE', 'md.d', 'pl.demo', 'mc+', 720, 0, 0, 'XY']]) },

  /* 26-28: one ASSY command at a time. md.col is 8 members and md.stf is 1, so
     the counts say outright whether the command did what the caption claims. */
  { id: 'b26a', members: 8,  what: 'ADD only - one column',
    why: 'cut 26 before', edit: ws => keepAssy(ws, [70]) },
  { id: 'b26b', members: 16, what: 'ADD + MIR - two columns',
    why: 'cut 26 after - mirrored about x=1200', edit: ws => keepAssy(ws, [70, 71]) },
  { id: 'b27',  members: 48, what: 'and COPY - three bents of two',
    why: 'cut 27 after - the pair pushed along y, twice', edit: ws => keepAssy(ws, [70, 71, 75]) },
  { id: 'b28a', members: 1,  what: 'one stiffener',
    why: 'cut 28 before', edit: ws => keepAssy(ws, [65]) },
  { id: 'b28b', members: 4,  what: 'and ROT - four round the column',
    why: 'cut 28 after - swung 90 degrees about Z, three times',
    edit: ws => keepAssy(ws, [65, 66]) },
  {
    id: 'b22', same: true,
    what: 'one MODULE row, two axes',
    why: 'cut 22 - four anchor rows become one and the bolts stay put',
    edit: ws => {
      /* The eight repeat columns hang off the END of the coordinate form, and
         the coordinate form does not stop at OFF_B. It runs OFF_B, OFF_E,
         Alpha - L, M, N - so the repeat block starts at O.

         Getting this wrong is quiet and expensive: starting at M put 300 into
         OFF_E, 0 into Alpha, and then read dx dy dz repeat as 0 1 0 300. The
         sheet loaded, reported "Succeed", and laid 1,872 members. Nothing
         complained except the count, which is exactly why the count is checked.

         The four anchors sit on a 300 x 300 square, so one bar plus one step on
         each axis is the same four bars. */
      const r = ws.getRow(R.anch1);
      r.getCell(C.D).value = 'bar.anch';           // no longer numbered
      [[C.O, 300], [C.P, 0], [C.Q, 0], [C.R, 1],
       [C.S, 0], [C.T, 300], [C.U, 0], [C.V, 1]].forEach(p => {
        r.getCell(p[0]).value = p[1];
      });
      ws.spliceRows(R.anch1 + 1, 3);               // the other three anchors
    }
  }
];

const LIB = f => {
  let p = SP + '/node_modules/three/build/three.min.js';
  if (f.includes('OrbitControls')) p = SP + '/node_modules/three/examples/js/controls/OrbitControls.js';
  if (f.includes('polybool')) p = SP + '/node_modules/polybooljs/dist/polybool.min.js';
  if (f.includes('exceljs')) p = SP + '/node_modules/exceljs/dist/exceljs.min.js';
  return fs.readFileSync(p, 'utf-8');
};

async function build() {
  for (const c of CASES) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(SRC);
    c.edit(wb.getWorksheet('input'));
    await wb.xlsx.writeFile(OUT + '/PLATE3D_' + c.id.toUpperCase() + '.xlsx');
    console.log('  ' + c.id.padEnd(6) + c.what);
  }
}

/* ---- verify against the engine, not against my arithmetic ----

   Member count alone would pass every one of these: a hole is a subtraction,
   not a part, so moving or duplicating holes never changes the count. Weight
   does change - six 26mm holes out of a 200x160x10 cleat is real steel - so
   the two together are what says a collapse was clean.

   Weight has to come out of the take-off, because the viewer's own summary line
   counts rows and members and stops there. That is slower - one workbook export
   per case - and it is the only number that actually watches the holes.

   It also answers a question the eye is bad at: whether a hole that changed
   place is still cutting. Same weight means every hole still lands on steel;
   heavier means one is now outside the outline, or clipped by an edge, and is
   removing less than it looks like it is. That is what retired the fifth
   case. */
async function weigh(page, file) {
  await page.setInputFiles('#pb-file', file);
  await page.waitForFunction(b => {
    const r = document.getElementById('pb-result');
    return r && r.innerText.indexOf(b) >= 0 && /Succeed/.test(r.innerText);
  }, path.basename(file), { timeout: 300000 });
  await page.waitForTimeout(900);
  /* The count is read out of the whole panel rather than its last line: a
     sheet that also has something to say adds a line after the summary, and
     taking the last one then finds no "placed N" at all. */
  const txt = (await page.evaluate(() =>
    document.getElementById('pb-result').innerText)).trim();
  const line = txt.split('\n').filter(l => /placed \d+/.test(l)).pop() ||
               txt.split('\n').pop();

  const tmp = SP + '/.case_boq.xlsx';
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }),
                                  page.evaluate(() => plateBuilder.exportBOQ())]);
  await dl.saveAs(tmp);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(tmp);
  fs.unlinkSync(tmp);

  /* SUMMARY's TOTAL row reads  TOTAL | 11 | 90 | 1700.88 | 1  - items, qty,
     weight, share. Taking "the last number on the row" lands on SHARE, which is
     1.00 for every model ever built and reports every case as identical. So the
     column is found by its heading instead, and a sheet that grows a column
     cannot quietly move the answer. */
  const ws = wb.getWorksheet('SUMMARY');
  /* The heading is "WEIGHT kg" and the unit is part of the match on purpose:
     SUMMARY's own preamble carries a line that begins "weights | live formulas",
     and a bare /weight/ finds that first, pins the column to A, and then reads
     the word TOTAL as the number. */
  let col = null, kg = null;
  ws.eachRow(r => {
    for (let c = 1; c <= 14 && col === null; c++)
      if (/weight\s*\(?kg/i.test(String(r.getCell(c).value || ''))) col = c;
    if (col === null) return;
    if (!/^total/i.test(String(r.getCell(1).value || '').trim())) return;
    let v = r.getCell(col).value;
    if (v && typeof v === 'object' && v.formula !== undefined) v = v.result;
    if (typeof v === 'number') kg = v;
  });
  return { line: line, members: Number((line.match(/placed (\d+)/) || [])[1]),
           kg: kg === null ? null : Math.round(kg * 100) / 100 };
}

(async () => {
  await build();
  if (process.argv.includes('--build')) return;

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
           '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 860 },
                                       acceptDownloads: true });
  await page.route('**/{unpkg.com,cdnjs.cloudflare.com}/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: LIB(r.request().url()) }));
  await page.route('**/fonts.{googleapis,gstatic}.com/**', r => r.abort());
  await page.goto('file://' + SP + '/video_page.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const base = await weigh(page, SRC);
  console.log('\n  BASIC   ' + String(base.members).padStart(3) + ' members  ' +
              String(base.kg).padStart(9) + ' kg   (the yardstick)');
  console.log('          ' + base.line + '\n');

  let bad = 0;
  for (const c of CASES) {
    const g = await weigh(page, OUT + '/PLATE3D_' + c.id.toUpperCase() + '.xlsx');
    const identical = g.members === base.members && g.kg === base.kg;
    let verdict;
    if (c.members !== undefined)
      verdict = g.members === c.members ? c.members + ' members  OK'
                                        : 'want ' + c.members + ' members, got ' + g.members;
    else if (c.same) verdict = identical ? 'same as BASIC  OK' : 'CHANGED - must not';
    else if (c.moves) verdict = identical ? 'UNCHANGED - must move'
                                          : (g.kg > base.kg ? 'holes LOST off the plate'
                                                            : 'moved, all still cutting  OK');
    else verdict = String(Math.round((g.kg - base.kg) * 100) / 100) + ' kg vs BASIC';
    if (/must|LOST|want/.test(verdict)) bad++;
    console.log('  ' + c.id.padEnd(6) + String(g.members).padStart(3) + ' members  ' +
                String(g.kg).padStart(9) + ' kg   ' + verdict);
    if (/must|LOST|want/.test(verdict)) console.log('         ' + c.why);
  }
  await browser.close();
  console.log('\n' + (bad ? bad + ' case(s) wrong - do not shoot these'
                          : 'all ' + CASES.length + ' cases behave as the script says'));
  process.exitCode = bad ? 1 : 0;
})();
