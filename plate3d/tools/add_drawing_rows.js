/* Give every sample workbook the drawing rows it now needs.

       node tools/add_drawing_rows.js            say what would change
       node tools/add_drawing_rows.js --write    change it

   Drawings used to be produced whether or not a sheet asked: six views of
   everything placed, six of each module, one of each part, at whatever scales
   the dialog was carrying. None of that happens now — a sheet says what goes
   on paper and nothing else does. Which means every sample that never had a
   VIEW row exports an empty nothing until it gets one, and a sample that
   exports nothing is a sample teaching the wrong lesson.

   So each book gets, ahead of its END:

       VIEW  <its assembly>  ISO  _  _  <scale>  <name>
       PLOT  PART  ALL  <scale>
       PLOT  SECT  ALL  <scale>          only where the book has sections

   VIEW rows already in the book are converted rather than thrown away. The old
   shape put the title immediately after the direction, where AZ now sits, so
   the title moves along and a scale goes in the cell it left. Those rows name
   drawings somebody chose - the flange from above, the web from the side - and
   clearing them to make room for a generic isometric would be losing the part
   of the sample that was worth reading.

   The generators under tools/ are the real source of these books and are
   edited alongside. This exists because most of them cannot be run here —
   they want artwork and size files that are not in the repository — and a
   sample that only comes right after someone regenerates it is not right. */
const ExcelJS = require('./node_modules/exceljs');
const fs = require('fs');
const path = require('path');

const P3 = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');

// what the dialog used to default to, which is the ladder these books expect
const SCALE = { assembly: 50, part: 10, sect: 20 };

function cellText(c) {
  const v = c && c.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return String(v.result !== undefined ? v.result
                                         : v.text !== undefined ? v.text : '');
  return String(v);
}

async function fix(file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.getWorksheet('input');
  if (!ws) return { file: path.basename(file), skip: 'no input tab' };

  /* The keyword column is wherever END is, the same rule the engine uses to
     read these books - so a sheet laid out one column over is still read. */
  let keyCol = null, endRow = null;
  for (let r = 1; r <= ws.rowCount && !endRow; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= 12; c++) {
      const t = cellText(row.getCell(c)).trim();
      if (!t) continue;
      if (t.toUpperCase() === 'END') { keyCol = c; endRow = r; }
      break;                            // only the first filled cell counts
    }
  }
  if (!endRow) return { file: path.basename(file), skip: 'no END row' };

  const kw = r => cellText(ws.getRow(r).getCell(keyCol)).trim().toUpperCase();
  let cleared = 0, assy = null, hasSect = false, hasDrawing = false;
  for (let r = 1; r < endRow; r++) {
    const k = kw(r);
    if (k === 'SECT') hasSect = true;
    if (k === 'ASSY' && !assy) assy = cellText(ws.getRow(r).getCell(keyCol + 1)).trim();
    if (k === 'PLOT') hasDrawing = true;
    if (k === 'VIEW') {
      /* A row already in the new shape has a number in the sixth cell; one in
         the old shape has the title there, or nothing. */
      const row = ws.getRow(r);
      if (Number(cellText(row.getCell(keyCol + 5)).trim()) > 0) { hasDrawing = true; continue; }
      const dir = cellText(row.getCell(keyCol + 2)).trim();
      const title = cellText(row.getCell(keyCol + 3)).trim();
      if (WRITE) {
        row.getCell(keyCol + 3).value = null;              // AZ, empty for a named view
        row.getCell(keyCol + 4).value = null;              // EL
        row.getCell(keyCol + 5).value = SCALE.part;
        row.getCell(keyCol + 6).value = title || null;
        row.commit();
      }
      cleared++;
      hasDrawing = true;
      if (!dir) console.log('    (row ' + r + ' has no direction — left as it was)');
    }
  }
  if (hasDrawing && !cleared)
    return { file: path.basename(file), skip: 'already asks for drawings' };
  if (!assy) return { file: path.basename(file), skip: 'no ASSY row to draw' };
  // a book whose own rows were converted keeps them, and gains the parts list
  const wantIso = !cleared;

  const add = [];
  if (wantIso) add.push(['VIEW', assy, 'ISO', null, null, SCALE.assembly,
                path.basename(file, '.xlsx').replace(/^PLATE3D_/, '') + ' - ISOMETRIC']);
  add.push(['PLOT', 'PART', 'ALL', SCALE.part, 'PLATES']);
  if (hasSect) add.push(['PLOT', 'SECT', 'ALL', SCALE.sect, 'SECTIONS']);

  if (WRITE) {
    add.forEach(function (vals, i) {
      const row = ws.insertRow(endRow + i, []);
      vals.forEach(function (v, j) {
        if (v !== null) row.getCell(keyCol + j).value = v;
      });
      row.commit();
    });
    await wb.xlsx.writeFile(file);
  }
  return { file: path.basename(file), cleared: cleared, assy: assy,
           sect: hasSect, added: add.length };
}

(async () => {
  const books = fs.readdirSync(P3).filter(f => /^PLATE3D_.*\.xlsx$/.test(f)).sort();
  let done = 0;
  for (const b of books) {
    const r = await fix(path.join(P3, b));
    if (r.skip) { console.log('  ' + r.file.padEnd(24) + '-  ' + r.skip); continue; }
    done++;
    console.log('  ' + r.file.padEnd(24) + 'assy ' + r.assy.padEnd(12) +
                ' +' + r.added + ' rows' + (r.sect ? ' (with SECT)' : '') +
                (r.cleared ? '  converted ' + r.cleared + ' VIEW' : ''));
  }
  console.log('\n' + done + ' of ' + books.length + ' books ' +
              (WRITE ? 'changed' : 'would change — run with --write'));
})();
