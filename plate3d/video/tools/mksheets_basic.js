/* The blocks of PLATE3D_BASIC.xlsx's input sheet, each drawn as its own page.

   The film is about the sheet, so the sheet is on screen more than the model
   is, and it has to be the real one - read back out of the workbook the viewer
   downloads, cell by cell, with its own row numbers and its own notes in column
   A. mkparampage.js already does that; this only says which rows belong to
   which beat and which cell gets the ring.

   The row numbers are the workbook's, not an index. If BASIC is ever re-cut
   these move, and the way you find out is that a page comes out showing the
   wrong block - so they are named after what they should contain and the
   generator prints the first row of each so a mismatch is visible at a glance.

     node mksheets_basic.js                                                   */
const { execFileSync } = require('child_process');
const ExcelJS = require('./node_modules/exceljs');
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const OUT = 'basic';
const BOOK = '../../PLATE3D_BASIC.xlsx';
fs.mkdirSync(SP + '/' + OUT, { recursive: true });

/* cut, name, first row, last row, columns to draw, cells to ring */
const PAGES = [
  { cut:  4, id: 'plate',  first:  1, last:  7, nc: 11, ring: '',
    head: 'PLATE',  note: 'six rows, six parts' },
  { cut:  6, id: 'trap',   first:  1, last:  7, nc: 11, ring: 'I4',
    head: 'PLATE',  note: 'WT is the second number - 0 makes it a triangle' },
  { cut:  9, id: 'basept', first:  1, last:  7, nc: 11, ring: 'G2',
    head: 'PLATE',  note: 'base.pt, the column the nine points live in' },
  { cut: 11, id: 'hole',   first:  9, last: 12, nc: 11, ring: 'E10',
    head: 'HOLE',   note: 'no mat, no thk - but base.pt is there' },
  { cut: 12, id: 'cut1',   first: 23, last: 26, nc: 11, ring: 'C24',
    head: 'CUT',    note: 'which plate the L.X L.Y are measured on' },
  { cut: 13, id: 'cutrep', first: 23, last: 28, nc: 12, ring: 'I27',
    head: 'CUT',    note: 'dx dy repeat, the first axis' },
  { cut: 15, id: 'cutpl',  first: 23, last: 28, nc: 11, ring: 'F26',
    head: 'CUT',    note: 'the shape is another plate' },
  { cut: 17, id: 'module', first: 36, last: 40, nc: 12, ring: 'D37',
    head: 'MODULE', note: 'PLATE defines it, MODULE places it' },
  { cut: 18, id: 'plane',  first: 36, last: 40, nc: 12, ring: 'I40',
    head: 'MODULE', note: 'PLANE - XY, XZ, YZ' },
  { cut: 21, id: 'thick',  first: 36, last: 40, nc: 12, ring: 'E37',
    head: 'MODULE', note: 'mc- and mc+, the two faces' },
  { cut: 22, id: 'anchor', first: 41, last: 46, nc: 13, ring: '',
    head: 'MODULE', note: 'four anchor rows, before they collapse' },
  { cut: 23, id: 'base',   first: 44, last: 49, nc: 11, ring: 'D46',
    head: 'MODULE', note: 'BASE - the module datum row' },
  { cut: 26, id: 'assy',   first: 64, last: 76, nc: 11, ring: '',
    head: 'ASSY',   note: 'ADD, MIR, COPY, ROT' }
];

(async () => {
  /* Check the rows still hold what they are named for before drawing anything.
     A page that quietly shows the wrong block would be discovered in the edit,
     with the shoot already done. */
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.resolve(SP, BOOK));
  const ws = wb.getWorksheet('input');
  let bad = 0;
  PAGES.forEach(p => {
    let found = '';
    for (let r = p.first; r <= p.last && !found; r++) {
      const v = String(ws.getCell(r, 2).value || '').replace('#', '').trim().toUpperCase();
      if (v === p.head || v === 'PART') found = v;
    }
    if (!found) {
      console.log('  ROWS MOVED  cut ' + p.cut + ' (' + p.id + ') rows ' +
                  p.first + '-' + p.last + ' hold no ' + p.head + ' row');
      bad++;
    }
  });
  if (bad) {
    console.log('\n' + bad + ' page(s) point at the wrong rows - fix PAGES before shooting');
    process.exitCode = 1;
    return;
  }

  PAGES.forEach(p => {
    execFileSync(process.execPath, [SP + '/mkparampage.js'], {
      cwd: SP, stdio: 'inherit',
      env: Object.assign({}, process.env, {
        BOOK: BOOK, SHEET: 'input', ACTIVE: 'input', TABS: '',
        FIRST: String(p.first), LAST: String(p.last), NC: String(p.nc),
        RING: p.ring, VALIGN: 'center',
        OUT: OUT + '/b_sh_' + p.id
      })
    });
  });
  console.log('\n' + PAGES.length + ' sheet pages  ·  rows checked against the workbook');
})();
