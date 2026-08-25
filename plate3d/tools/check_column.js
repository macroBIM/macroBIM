/* Does the shipped workbook still match the model?

   PLATE3D_COLUMN.xlsx and the QuickPlate3D form are built by the same module,
   so in principle they cannot disagree. This checks it anyway, because "in
   principle" is exactly what stops being true when someone edits the
   generator's write loop, or regenerates the workbook from an older module, or
   hand-fixes a cell in Excel and saves.

   It reads the input tab out of the .xlsx the way the ENGINE reads it - the
   same sheet-by-name, the same cellVal - and compares it against what the
   module produces from the same inputs, cell by cell.

   Two normalisations, both honest:
     - ExcelJS's reader drops a falsy cached result, so a 0 or an empty string
       in the file comes back as undefined. Both sides are flattened to null.
     - The parser ignores anything past the last filled cell in a row, so rows
       of different length agree if the shared part does.

     node tools/check_column.js               the shipped workbook
     CTYPE=R node tools/check_column.js       any variant, same overrides

   Exits non-zero on a mismatch, so it can gate a commit. */
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const P3 = path.resolve(__dirname, '..');
const DESIGN = '/home/user/design';
const CM = require('../column_model.js');
const FILE = P3 + '/' + (process.env.OUT || 'PLATE3D_COLUMN.xlsx');

function csv(file) {
  const ln = fs.readFileSync(DESIGN + '/' + file, 'utf8')
    .replace(/^﻿/, '').split(/\r?\n/).filter(s => s.trim());
  const head = ln[0].split(',').map(s => s.trim());
  return ln.slice(1).map(l => { const f = l.split(','), o = {};
    head.forEach((h, i) => { o[h] = (f[i] || '').trim(); }); return o; });
}
const USER = 'user define';
const HS = [[USER, '', '', '', '', '', '']].concat(
  csv('hsection.csv').filter(r => r['KS규격여부'] === 'O')
    .map(r => [`H-${r.H}x${r.B}x${r.t1}x${r.t2} r${r.r}`,
               +r.H, +r.B, +r.t1, +r.t2, +r.r, +r['단위무게']]));
const TB = [[USER, '', '', '', '', '', '']].concat(
  csv('squaretube.csv').map(r => [`R-${r['호칭치수']} r${r.r}`,
               +r.A, +r.B, +r.t, +r.t, +r.r, +r['단위무게']]));
const cat = { HS, TB, findH: k => HS.find(s => s[0] === k) || HS[1],
                      findT: k => TB.find(s => s[0] === k) || TB[1] };

// the engine's own cell reader, so this compares what the engine would see
const cellVal = c => {
  if (c && typeof c === 'object') {
    if (c.result !== undefined) return c.result;
    if (c.text !== undefined) return c.text;
    if (c.richText) return c.richText.map(t => t.text).join('');
    return '';
  }
  return c;
};
/* Zero and blank collapse together, and that is the right strictness rather
   than a convenience. ExcelJS writes a cached 0 correctly - <v>0</v> is in the
   XML - but its READER hands back an empty string for it. The engine reads
   through that same reader, so a 0 in the file and a blank in the file are the
   same thing to the model being built. Failing on a distinction the engine
   cannot see would make this check cry wolf on every run; failing on 5-vs-0,
   which it still does, is what it is for. */
const norm = v => (v === undefined || v === null || v === '' || v === 0) ? null
                : (typeof v === 'number' ? +v.toFixed(6) : String(v));

(async () => {
  const want = CM.values(CM.build(CM.defaults(process.env, cat), cat).rows);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);
  const ws = wb.worksheets.filter(s =>
    String(s.name || '').trim().toLowerCase() === 'input')[0] || wb.worksheets[0];
  const got = [];
  ws.eachRow({ includeEmpty: true }, r => got.push((r.values || []).slice(1).map(cellVal)));

  const name = FILE.split('/').pop();
  let bad = 0;
  const n = Math.max(want.length, got.length);
  for (let i = 0; i < n; i++) {
    const a = got[i] || [], b = want[i] || [];
    for (let j = 0; j < Math.max(a.length, b.length); j++) {
      if (norm(a[j]) !== norm(b[j])) {
        if (bad < 12) {
          console.log(`  row ${i + 1} col ${String.fromCharCode(65 + j)}: ` +
                      `file=${JSON.stringify(a[j])}  model=${JSON.stringify(b[j])}`);
        }
        bad++;
      }
    }
  }
  if (bad) {
    console.log(`\n✗ ${name}: ${bad} cell${bad > 1 ? 's' : ''} differ from the model.`);
    console.log('  Regenerate it — node tools/make_column.js — or find out why they parted.');
    process.exit(1);
  }
  console.log(`✓ ${name}: ${want.length} rows, every cell matches column_model.js`);
})().catch(e => { console.error(e); process.exit(1); });
