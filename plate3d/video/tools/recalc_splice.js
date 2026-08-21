/* Excel stands in here, for the splice workbook.

   Set the blue PARAM cells, work every formula out - PARAM first, then the 284
   in `input` that reference it - write the answers back as cached results and
   save. A workbook through here loads into PLATE3D as if a person had typed the
   numbers and Excel had recalculated on open.

   Run with no overrides to check it against the shipped file: every cached
   result should come back identical, and it says so if one does not.

     SECT="H-900x300x16x28 r18" WEB_H=760 LEN=1800 \
       node recalc_splice.js in.xlsx out.xlsx                                */
const ExcelJS = require('exceljs');
const IN = process.argv[2], OUT = process.argv[3];

/* the blue cells, by the name this script takes on the command line */
const SET = {
  SECT: 'C6', GAP: 'C7', LEN: 'J6',
  TOP_W: 'C14', TOP_L: 'D14', TOP_T: 'E14',
  TIN_W: 'C15', WEB_W: 'C16', WEB_H: 'D16', WEB_T: 'E16',
  BIN_W: 'C17', BOT_W: 'C18',
  BDIA: 'C24', BHOLE: 'D24',
  TOP_N: 'C27', WEB_N: 'C28', BOT_N: 'C29',
  TOP_TN: 'F27', WEB_TN: 'F28', BOT_TN: 'F29'
};

const RND = (x, n) => { const p = Math.pow(10, n || 0); return Math.round(x * p) / p; };

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(IN);
  const ps = wb.getWorksheet('PARAM'), is = wb.getWorksheet('input');
  const ss = wb.getWorksheet('SECT');

  /* the section table, so VLOOKUP has something to look into */
  const SECTROW = {};
  ss.eachRow((r, i) => { if (i > 1) {
    const k = r.getCell(1).value;
    if (k) SECTROW[String(k).trim()] = [null, k, r.getCell(2).value, r.getCell(3).value,
      r.getCell(4).value, r.getCell(5).value, r.getCell(6).value, r.getCell(7).value];
  }});

  let changed = 0;
  Object.keys(SET).forEach(function (k) {
    if (process.env[k] === undefined) return;
    const raw = process.env[k], n = Number(raw);
    ps.getCell(SET[k]).value = (raw !== '' && !isNaN(n)) ? n : raw;
    changed++;
    console.log('set  ' + SET[k].padEnd(4) + ' ' + k.padEnd(7) + ' = ' + raw);
  });

  /* a cell's current value, formula results included */
  const P = a => { const v = ps.getCell(a).value;
    return (v && typeof v === 'object' && v.formula !== undefined) ? v.result : v; };

  function evalFormula(src, sheet) {
    let f = String(src).replace(/^=+/, '');
    // VLOOKUP($C$6, SECT!$A:$G, n, FALSE) wrapped in IFERROR
    f = f.replace(/IFERROR\(\s*VLOOKUP\(\s*\$?([A-J])\$?(\d+)\s*,\s*SECT!\$A:\$G\s*,\s*(\d+)\s*,\s*FALSE\s*\)\s*,\s*""\s*\)/g,
      function (_, col, row, idx) {
        const key = String(P(col + row) || '').trim();
        const hit = SECTROW[key];
        return hit ? JSON.stringify(hit[+idx]) : '""';
      });
    f = f.replace(/\bROUND\(/g, 'RND(');
    f = f.replace(/&/g, '+');                       // "75" & " / " & "55"
    // PARAM!$D$6 and, inside `input`, a bare $D$6 would mean this sheet - there
    // are none, every input formula names PARAM, so only the qualified form.
    f = f.replace(/PARAM!\$?([A-J])\$?(\d+)/g, function (_, c, r) {
      const v = P(c + r);
      return typeof v === 'number' ? String(v) : JSON.stringify(v == null ? '' : v);
    });
    if (sheet === 'PARAM') {                        // its own unqualified refs
      f = f.replace(/(^|[^A-Z0-9_"])\$?([A-J])\$(\d+)/g, function (m, pre, c, r) {
        const v = P(c + r);
        return pre + (typeof v === 'number' ? String(v) : JSON.stringify(v == null ? '' : v));
      });
    }
    if (/[A-Z]!/.test(f) || /\b[A-J]\$?\d+\b/.test(f))
      throw new Error('unresolved reference: ' + f);
    // eslint-disable-next-line no-new-func
    return Function('RND', 'return (' + f + ')')(RND);
  }

  /* PARAM first. D20/D31/F31 read other PARAM cells, so run until it settles. */
  const cells = [];
  ps.eachRow(r => r.eachCell({ includeEmpty: false }, c => {
    const v = c.value;
    if (v && typeof v === 'object' && v.formula !== undefined) cells.push(c);
  }));
  for (let pass = 0; pass < 4; pass++)
    cells.forEach(c => { c.value = { formula: c.value.formula, result: evalFormula(c.value.formula, 'PARAM') }; });

  /* then everything in `input` that reads PARAM */
  let n = 0, diff = 0;
  is.eachRow(r => r.eachCell({ includeEmpty: false }, c => {
    const v = c.value;
    if (!(v && typeof v === 'object' && v.formula !== undefined)) return;
    const was = v.result, now = evalFormula(v.formula, 'input');
    if (!changed && String(was) !== String(now)) {
      if (diff < 6) console.log('MISMATCH ' + c.address + '  was ' + was + '  now ' + now);
      diff++;
    }
    c.value = { formula: v.formula, result: now };
    n++;
  }));
  console.log((changed ? 'recalculated ' : 'checked ') + n + ' input formulas' +
              (changed ? '' : diff ? '  — ' + diff + ' MISMATCH' : '  — all identical'));
  console.log('  section ' + P('C6') + '  H ' + P('D6') + ' B ' + P('E6') +
              ' t1 ' + P('F6') + ' t2 ' + P('G6') + '  ' + P('I6') + ' kg/m');
  console.log('  clear web depth ' + P('D10') + ' · member centre +-' + P('F10') +
              ' · plate steel ' + P('D20') + ' kg');
  console.log('  flange pitch ' + P('D31') + ' · web pitch ' + P('F31') + ' · bolts ' + P('H31'));
  if (OUT) { await wb.xlsx.writeFile(OUT); console.log('wrote ' + OUT); }
})();
