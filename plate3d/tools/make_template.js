/* PLATE3D_TEMPLATE.xlsx — the blank sheet.

   Every other example is a model: it shows what the keywords do by doing
   something with them. This one shows only the keywords. Every row is a
   comment, so it loads and builds nothing, and what it leaves on screen is the
   grammar with room to type underneath it.

   The point is that nobody should need the guide open in another window to
   write a first sheet. So each form gets its own header rather than one
   generic "p1 p2 p3" line - a RECT plate and a TRAP plate do not take the same
   values, and a header that says p1 makes the reader go and look that up.

   Everything below END is ignored by the engine, which is where the nine
   points, the plane rule and the two MODULE forms live. That trick is the
   user's own: their first sheets parked spare header rows down there.

   Column positions are not remembered here, they are the ones read off
   PLATE3D_BASIC.xlsx - in particular the coordinate MODULE form, whose repeat
   block starts at column O and not M, which has been got wrong before.

     node tools/make_template.js                                             */
const ExcelJS = require('../video/tools/node_modules/exceljs');
const path = require('path');

const P3 = path.resolve(__dirname, '..');
const OUT = P3 + '/PLATE3D_TEMPLATE.xlsx';

const GREY = 'FF64748B', INK = 'FF0F172A', BLUE = 'FF1D4ED8', YELL = 'FFFFFF00';

const rows = [];
/* b = banner, h = a header of column names, n = a note, x = blank,
   k = a live keyword row, t = a note below END */
/* Everything above END carries the # itself. A row without one is a keyword
   row, and the first build of this file answered "39 errors" to someone whose
   first act was to open the blank template - which is the worst possible first
   sentence the app could say. */
const B = t => rows.push({ s: 'b', c: ['# ' + t] });
const H = c => rows.push({ s: 'h', c: c });
const N = t => rows.push({ s: 'n', c: [t === '' ? '#' : '#   ' + t] });
const X = (n) => { for (let i = 0; i < (n || 1); i++) rows.push({ s: 'x', c: [] }); };
/* label in B, text from E. Excel clips a string at the next non-empty cell, so
   a note whose text sat in C truncated its own label - "THE NINE POIN". Leaving
   C and D empty gives the label the width of three columns to overflow into. */
const T = (...c) => rows.push({ s: 't', c: [c[0], null, null].concat(c.slice(1)) });

B('PLATE3D  ·  blank input sheet');
N('Every row in this sheet is a comment - it starts with # and the engine skips it.');
N('So this file loads and builds nothing. That is what it is for.');
N('');
N('To use it:  type your own rows in the blank space under the header you want.');
N('            do NOT start your rows with #  -  that is what makes them real.');
N('            keep to the columns the header names. Blank cells are allowed');
N('            wherever the header shows a value in [brackets].');
N('');
N('Rows are read from the top down until END. Everything below END is ignored,');
N('which is where the notes at the bottom of this sheet live - keep them, they');
N('cost nothing.');
X();

B('1.  SHAPES  ·  what the parts are');
N('A PLATE is a flat outline with a thickness. A BAR is a round bar. A SECT is a');
N('steel section - you type its dimensions, there is no catalogue in the app.');
N('A HOLE is a 2D shape with no thickness and no material: it never becomes a');
N('solid, it is only something for a CUT row to use.');
X();
H(['# PLATE', 'id', 'mat', 'thk', 'RECT', 'base.pt', 'B', 'H']);
H(['# PLATE', 'id', 'mat', 'thk', 'TRAP', 'base.pt', 'WB', 'WT', 'H', 'OFF_T']);
H(['# PLATE', 'id', 'mat', 'thk', 'CIRC', 'base.pt', 'D']);
X(3);
H(['# BAR', 'id', 'mat', 'dia', 'length']);
X(3);
H(['# SECT', 'id', 'mat', 'length', 'H', 'base.pt', 'h', 'bb', 'bt', 'tw', 'tf1', 'tf2', 'r1']);
H(['# SECT', 'id', 'mat', 'length', 'C', 'base.pt', 'h', 'b', 'tw', 'tf', 'rw', 'rf']);
H(['# SECT', 'id', 'mat', 'length', 'L', 'base.pt', 'a', 'b', 't1', 't2', 'r1', 'r2']);
H(['# SECT', 'id', 'mat', 'length', 'P', 'base.pt', 'd', 't']);
H(['# SECT', 'id', 'mat', 'length', 'R', 'base.pt', 'h', 'b', 't', 'r']);
N('H = I-beam   C = channel   L = angle   P = round tube   R = rectangular tube');
N('A radius left blank comes out as a square corner. On an R, r is the OUTER');
N('corner - the inner one is r minus the wall and is not asked for.');
X(3);
H(['# HOLE', 'id', 'RECT', 'base.pt', 'B', 'H']);
H(['# HOLE', 'id', 'TRAP', 'base.pt', 'WB', 'WT', 'H', 'OFF_T']);
H(['# HOLE', 'id', 'CIRC', 'base.pt', 'D']);
X(3);

B('2.  CUT  ·  take a shape out of a plate or a section');
N('L.X / L.Y are measured from the TARGET’s own origin, and the shape lands by');
N('its OWN base.pt. Both nine-point rules are in play at once.');
N('dx/dy/repeat lay a row of copies; dx2/dy2/repeat2 step that whole row');
N('sideways, so one line can be a whole bolt grid.');
X();
H(['# CUT', 'target', 'L.X', 'L.Y', 'shape', '[dx]', '[dy]', '[repeat]', '[dx2]', '[dy2]', '[repeat2]']);
X(3);

B('3.  MODULE  ·  where each member sits inside one module');
N('Rows with the same module id build one module together.');
N('THE EIGHTH COLUMN DECIDES WHICH FORM YOU ARE WRITING - see the note below END.');
X();
N('plate form - the 8th column holds a PLANE name');
H(['# MODULE', 'id', 'member', 'Ref.Pt', 'L.X', 'L.Y', 'L.Z', 'PLANE',
   '[ROT.X]', '[ROT.Y]', '[ROT.Z]', '[dx]', '[dy]', '[dz]', '[repeat]']);
X(3);
N('coordinate form - the 8th column holds a NUMBER. BAR and SECT only.');
N('The member is stretched between the two points and its Length becomes a');
N('reference. Note the repeat block starts in column O, after Alpha.');
H(['# MODULE', 'id', 'member', 'Ref.Pt', 'LX1', 'LY1', 'LZ1', 'LX2', 'LY2', 'LZ2',
   '[OFF_B]', '[OFF_E]', '[Alpha]', '[dx]', '[dy]', '[dz]', '[repeat]']);
X(3);
N('the module’s own reference point - one of the nine points of a member');
H(['# MODULE', 'id', 'BASE', 'instance', 'point']);
X(2);
N('cut one end of a member to the face it runs into. B = start, E = end.');
H(['# MODULE', 'id', 'FIT', 'member', 'B / E', 'target', '[GAP]']);
X(3);

B('4.  ASSY  ·  modules, plates and bars into the world');
N('source = a MODULE, a PLATE, a BAR, a SECT or an earlier ASSY.');
N('ADD rows sharing an id build one assembly together.');
X();
H(['# ASSY', 'id', 'source', 'ADD', 'G.X', 'G.Y', 'G.Z', '[ROT.X]', '[ROT.Y]', '[ROT.Z]']);
H(['# ASSY', 'id', 'source', 'MIR', 'G.X', 'G.Y', 'G.Z', 'PLANE']);
H(['# ASSY', 'id', 'source', 'COPY', 'd.X', 'd.Y', 'd.Z', 'repeat']);
H(['# ASSY', 'id', 'source', 'ROT', 'C.X', 'C.Y', 'C.Z', 'AXIS', 'angle', 'repeat']);
N('repeat = EXTRA copies. repeat 4 leaves five in total.');
X(4);

B('5.  VIEW  ·  named drawings for Save DXF   (optional)');
N('No VIEW rows means no VIEWS block in the DXF. Nothing else changes.');
X();
H(['# VIEW', 'module', 'FROM', '[title]']);
N('FROM = FRONT / BACK / LEFT / RIGHT / TOP / BOTTOM');
X(3);

rows.push({ s: 'end', c: ['END'] });
X(2);

T('NOTES  -  everything below END is ignored by the engine. Nothing here affects the model.');
T('');
T('THE NINE POINTS', 'base.pt and Ref.Pt are one of these, on the shape’s own outline:');
T('', 'tl', 'tc', 'tr');
T('', 'ml', 'mc', 'mr', '<- mc is the middle');
T('', 'bl', 'bc', 'br');
T('', 'left blank:  bc for a PLATE and a SECT,  mc for a CIRC, a HOLE and a BAR');
T('');
T('FACE SUFFIX', 'bc = mid-thickness (the default).  bc+ / bc- = the plus / minus face.');
T('', 'So an offset can be typed off a drawing without adding half the thickness.');
T('');
T('PLANES', 'the plane a plate lies on, and the way a bar grows out of it:');
T('', 'XY  ->  +Z        a plan, growing up');
T('', 'XZ  ->  -Y        a front elevation');
T('', 'YZ  ->  +X        a side elevation');
T('', 'The signs are what keep each plane right-handed. They are not a choice.');
T('');
T('THE TWO MODULE FORMS', 'read off the eighth column, and nothing else:');
T('', 'a PLANE name there  ->  angle form. Length comes from the BAR / SECT row.');
T('', 'a NUMBER there      ->  two points. Length is the distance between them,');
T('', '                        and the row’s own Length is only a reference.');
T('', 'Both forms work on plates, bars and sections.');
T('');
T('OFF_B / OFF_E', 'trim a member back from its node.');
T('', 'positive  ->  pulled back, which is the usual case at a connection');
T('', 'negative  ->  run past the node, embedded');
T('');
T('Alpha', 'rolls a section about its own axis. The two ends do not move.');
T('');
T('IDS', 'anything you like. They are uppercased, so pl.Web and PL.WEB are one part.');
T('', 'Name the same part as often as you use it - the engine numbers the repeats');
T('', 'itself, pl.stf twice becoming pl.stf_1 and pl.stf_2. A BASE or a FIT row');
T('', 'wants the numbered name.');
T('');
T('MATERIAL', 'a label, and it groups the take-off. Everything weighs as steel,');
T('', '7.85 t/m3, whatever the label says.');
T('');
T('UNITS', 'millimetres and kilograms throughout. No unit conversion anywhere.');
T('');
T('A BLANK MEMBER ID', 'is a row switched off - skipped without a word. That is what lets a');
T('', 'count on a front sheet decide how many of something there are.');
T('');
T('COORD', 'COORD ZUP is the default and needs no row. COORD YUP reads the sheet in');
T('', 'the old Y-up frame, and goes above the MODULE rows.');

(async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('input');
  const W = [11, 12, 10, 10, 10, 10, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9];
  W.forEach((w, i) => { ws.getColumn(i + 2).width = w; });

  rows.forEach(function (r, i) {
    const row = ws.getRow(i + 1);
    r.c.forEach(function (v, j) { if (v !== null && v !== '') row.getCell(j + 2).value = v; });
    if (r.s === 'b') {
      row.getCell(2).font = { bold: true, size: 11, color: { argb: INK } };
    } else if (r.s === 'h') {
      row.eachCell(function (c) {
        c.font = { italic: true, size: 10, color: { argb: GREY } };
      });
      row.getCell(2).font = { bold: true, italic: true, size: 10, color: { argb: BLUE } };
    } else if (r.s === 'n') {
      row.getCell(2).font = { italic: true, size: 9, color: { argb: GREY } };
    } else if (r.s === 'end') {
      const c = row.getCell(2);
      c.font = { bold: true, color: { argb: INK } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELL } };
    } else if (r.s === 't') {
      row.eachCell(function (c) { c.font = { size: 9, color: { argb: GREY } }; });
      row.getCell(2).font = { bold: true, size: 9, color: { argb: INK } };
    }
  });

  /* Notes and banners run past their own column, and Excel clips a string at
     the next non-empty cell. Nothing sits to their right, so letting them
     overflow is what the reader sees anyway - this only stops the wrap. */
  ws.getRow(1).height = 18;
  await wb.xlsx.writeFile(OUT);
  console.log('  PLATE3D_TEMPLATE.xlsx  ' + rows.length + ' rows  ·  ' +
              rows.filter(r => r.s === 'h').length + ' keyword forms');
})();
