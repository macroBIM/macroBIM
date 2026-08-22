/* The blocks of PLATE3D_BASIC.xlsx the BAR & SECT film shows.

   Same machinery as episode 01's mksheets_basic.js: mkparampage.js draws the
   real workbook cell by cell, and this only says which rows belong to which
   beat, which cell gets the ring, and - where the beat is about a change -
   which case book to draw from.

   Cut 14 is the one this list exists for. It puts BASIC's two MODULE blocks on
   screen together, rows 36-45, because the whole episode turns on the eighth
   column reading one way when it holds a plane name and another when it holds a
   number. Split across two pages that comparison does not happen.

     node mksheets_barsect.js                                                 */
const { execFileSync } = require('child_process');
const ExcelJS = require('./node_modules/exceljs');
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const OUT = 'barsect';
const BOOK = '../../PLATE3D_BASIC.xlsx';
fs.mkdirSync(SP + '/' + OUT, { recursive: true });

/* cut, name, first row, last row, columns, rings, and the book if not BASIC */
const PAGES = [
  { cut:  4, id: 'three',  first:  1, last: 21, nc: 14, ring: '',
    head: 'PLATE',  note: 'PLATE, BAR and SECT blocks in one view' },
  { cut:  5, id: 'bar',    first: 14, last: 15, nc: 11, ring: 'F15',
    head: 'BAR',    note: 'one row: mat, dia, length' },
  { cut:  7, id: 'sect',   first: 17, last: 21, nc: 14, ring: 'F18',
    head: 'SECT',   note: 'TYPE - the skeleton' },
  { cut:  9, id: 'secth',  first: 17, last: 18, nc: 14, ring: 'H18,I18,J18,K18,L18,M18,N18',
    head: 'SECT',   note: 'the seven values of an H' },
  { cut: 11, id: 'sectr',  first: 17, last: 21, nc: 14, ring: 'M20',
    head: 'SECT',   note: 'the r that may be left blank' },
  { cut: 12, id: 'girder', first: 17, last: 21, nc: 14, ring: 'H18,I18,J18,K18,L18,M18,N18',
    book: 'barsect/PLATE3D_C12.xlsx',
    head: 'SECT',   note: 'the same row, a 1200-deep girder' },
  { cut: 14, id: 'two',    first: 36, last: 45, nc: 14, ring: 'I38,I42',
    head: 'MODULE', note: 'the eighth column, both ways' },
  { cut: 15, id: 'plane',  first: 36, last: 40, nc: 14, ring: 'I38',
    head: 'MODULE', note: 'a plane name' },
  { cut: 16, id: 'coord',  first: 58, last: 62, nc: 14, ring: 'I59,J59,K59',
    head: 'MODULE', note: 'two points' },
  { cut: 19, id: 'off',    first: 58, last: 62, nc: 14, ring: 'L59,M59',
    head: 'MODULE', note: 'OFF_B and OFF_E' },
  { cut: 21, id: 'anchor', first: 41, last: 46, nc: 14, ring: 'L42',
    head: 'MODULE', note: 'the negative one' },
  { cut: 23, id: 'alpha',  first: 58, last: 62, nc: 14, ring: 'N61',
    head: 'MODULE', note: 'Alpha' },
  { cut: 26, id: 'assy',   first: 64, last: 76, nc: 11, ring: '',
    head: 'ASSY',   note: 'ADD, MIR, COPY, ROT' },
  { cut: 31, id: 'cutsect', first: 23, last: 36, nc: 11, ring: '',
    book: 'barsect/PLATE3D_C31.xlsx',
    head: 'CUT',    note: 'two CUT rows on a section' }
];

(async () => {
  /* Check the rows still hold what they are named for before drawing anything.
     A page that quietly shows the wrong block would be found in the edit, with
     the shoot already done. */
  const sheets = {};
  for (const f of [...new Set(PAGES.map(p => p.book || BOOK))]) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.resolve(SP, f));
    sheets[f] = wb.getWorksheet('input');
  }
  let bad = 0;
  PAGES.forEach(p => {
    const ws = sheets[p.book || BOOK];
    let found = '';
    for (let r = p.first; r <= p.last && !found; r++) {
      const v = String(ws.getCell(r, 2).value || '').replace('#', '').trim().toUpperCase();
      if (v === p.head) found = v;
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
        BOOK: p.book || BOOK, SHEET: 'input', ACTIVE: 'input', TABS: '',
        FIRST: String(p.first), LAST: String(p.last), NC: String(p.nc),
        RING: p.ring, VALIGN: 'center',
        OUT: OUT + '/s3_sh_' + p.id
      })
    });
  });
  console.log('\n' + PAGES.length + ' sheet pages  ·  rows checked against the workbooks');
})();
