// PLATE3D_BASIC.xlsx - one small model that uses every keyword in the guide.
//
// A pipe-support bent: two H columns on stiffened base plates, an H beam across
// the top, an X-braced bay, and a bolted pipe shoe. Three bents in a row.
//
// What each feature is shown by:
//   PLATE RECT   base plate, cap plate, cleat, sleeve plate
//   PLATE TRAP   the base stiffener (WT 0 -> a right triangle)
//   PLATE CIRC   the pipe flange
//   BAR          anchor bolts
//   SECT H       column and beam        SECT L  braces      SECT C  strut
//   HOLE + CUT   bolt holes, a slotted plate, a bored flange, dx/dy arrays,
//                and one CUT that borrows another PLATE's outline
//   MODULE       both grammars - PLANE + ROT for the plates, start/end
//                coordinates for the bars, braces and strut
//   ASSY         ADD, MIR, COPY, ROT, and an ASSY used as the source of another
const ExcelJS = require('/tmp/claude-0/-home-user/2c32e469-0690-5fe7-bd2b-b7fdc61d0d9a/scratchpad/node_modules/exceljs');
const OUT = process.argv[2] ||
  '/tmp/claude-0/-home-user/2c32e469-0690-5fe7-bd2b-b7fdc61d0d9a/scratchpad/PLATE3D_BASIC.xlsx';

/* ---- levels, all in mm from the underside of the base plate ---- */
const BP = 25;                   // base plate thickness  -> column starts at 25
const COL_H = 3000;              // column length         -> top at 3025
const Z_COL = BP, Z_CAP = BP + COL_H, CAP_T = 12;
const Z_BM = Z_CAP + CAP_T;      // beam seats on the cap  3037
const BM_H = 250;
const Z_SLV = Z_BM + BM_H;       // sleeve on the beam top 3287
const SLV_T = 12;
const Z_FLG = Z_SLV + SLV_T;     // flange on the sleeve   3299

const SPAN = 2400;               // column centre to column centre
const BAY = 3000;                // bent spacing

const R = [];
const push = (...r) => R.push(r);
const blank = () => R.push([]);

/* ================= shapes ================= */
push('# PLATE', 'id', 'mat', 'thk', 'shape', 'base.pt', 'p1', 'p2', 'p3', 'p4');
push('PLATE', 'pl.base', 'SS275', BP, 'RECT', 'mc', 400, 400);
push('PLATE', 'pl.cap', 'SS275', CAP_T, 'RECT', 'mc', 260, 260);
push('PLATE', 'pl.stf', 'SS275', 12, 'TRAP', 'bl', 100, 0, 180, 0);
push('PLATE', 'pl.clt', 'SS275', 10, 'RECT', 'mc', 200, 160);
push('PLATE', 'pl.slv', 'SS275', SLV_T, 'RECT', 'mc', 400, 360);
push('PLATE', 'pl.flg', 'SS275', 16, 'CIRC', 'mc', 320);
blank();

push('# HOLE', 'id', 'shape', 'base.pt', 'p1', 'p2');
push('HOLE', 'ho.m26', 'CIRC', 'mc', 26);
push('HOLE', 'ho.slot', 'RECT', 'mc', 40, 22);
push('HOLE', 'ho.pen', 'CIRC', 'mc', 180);
blank();

push('# BAR', 'id', 'mat', 'dia', 'length');
push('BAR', 'bar.anch', 'SS400', 24, 6000);
blank();

push('# SECT', 'id', 'mat', 'length', 'TYPE', 'base.pt',
     'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7');
push('SECT', 'sc.col', 'SM490', COL_H, 'H', 'mc', 200, 200, 200, 8, 12, 12, 16);
push('SECT', 'sc.bm', 'SM490', SPAN, 'H', 'bc', BM_H, 125, 125, 6, 9, 9, 12);
push('SECT', 'sc.brc', 'SS275', 6000, 'L', 'bc', 65, 65, 6, 6, 8, 4);
push('SECT', 'sc.str', 'SS275', 6000, 'C', 'mc', 150, 75, 6.5, 10, 10, 5);
blank();

/* ================= cuts ================= */
push('# CUT', 'plate', 'L.X', 'L.Y', 'shape', 'dx', 'dy', 'repeat');
push('CUT', 'pl.base', -150, -150, 'ho.m26', 300, 0, 1);      // 4 anchor holes
push('CUT', 'pl.base', -150, 150, 'ho.m26', 300, 0, 1);
push('CUT', 'pl.cap', -130, -130, 'pl.stf');                  // clipped by a PLATE outline
push('CUT', 'pl.clt', -50, -50, 'ho.m26', 0, 50, 2);          // 3 up, twice -> 6 bolts
push('CUT', 'pl.clt', 50, -50, 'ho.m26', 0, 50, 2);
push('CUT', 'pl.slv', 0, 0, 'ho.pen');                        // pipe penetration
push('CUT', 'pl.slv', -170, -150, 'ho.slot', 340, 0, 1);
push('CUT', 'pl.slv', -170, 150, 'ho.slot', 340, 0, 1);
push('CUT', 'pl.flg', 0, 0, 'ho.pen');                        // bore -> a ring
push('CUT', 'pl.flg', -88, -88, 'ho.m26', 176, 0, 1);
push('CUT', 'pl.flg', -88, 88, 'ho.m26', 176, 0, 1);
blank();

/* ================= modules, PLANE grammar ================= */
push('# MODULE', 'id', 'member', 'Ref.Pt', 'L.X', 'L.Y', 'L.Z', 'PLANE', 'ROT.X', 'ROT.Y', 'ROT.Z');
push('MODULE', 'md.col', 'pl.base', 'mc-', 0, 0, 0, 'XY');
push('MODULE', 'md.col', 'sc.col', '', 0, 0, Z_COL, 'XY');
push('MODULE', 'md.col', 'pl.cap', 'mc-', 0, 0, Z_CAP, 'XY');
push('MODULE', 'md.col', 'pl.clt', 'mc+', -100, 0, 2600, 'YZ');

/* ---- the same module, start/end coordinates for the four anchor bolts ----
   Each runs from the hole in the base plate down to z = -250. OFF_B is -50, so
   the bolt starts 50 before its first point: 50 of thread standing proud. */
push('# MODULE', 'id', 'member', 'Ref.Pt', 'LX1', 'LY1', 'LZ1', 'LX2', 'LY2', 'LZ2',
     'OFF_B', 'OFF_E', 'Alpha');
[[-150, -150], [150, -150], [-150, 150], [150, 150]].forEach(([x, y], i) => {
  push('MODULE', 'md.col', 'bar.anch_' + (i + 1), '', x, y, BP, x, y, -250, -50, 0);
});
push('MODULE', 'md.col', 'BASE', 'pl.base', 'mc-');
blank();

push('MODULE', 'md.stf', 'pl.stf', 'bl', 100, 0, BP, 'XZ');
push('MODULE', 'md.stf', 'BASE', 'pl.stf', 'bl');
blank();

push('MODULE', 'md.bm', 'sc.bm', '', 0, 0, Z_BM, 'YZ');
push('MODULE', 'md.bm', 'BASE', 'sc.bm', 'bc');
blank();

push('MODULE', 'md.shoe', 'pl.slv', 'mc-', 0, 0, Z_SLV, 'XY');
push('MODULE', 'md.shoe', 'pl.flg', 'mc-', 0, 0, Z_FLG, 'XY');
push('MODULE', 'md.shoe', 'BASE', 'pl.slv', 'mc-');
blank();

/* ---- the braced bay: one L definition, two lengths; one C, rolled ----
   Local z 0 is the top of the base plate. Every offset here is set by what it
   has to miss, which is the whole point of writing them:
     the diagonals sit 150 either side of the frame line: the column is 200 deep,
       so 100, and base.pt bc centres the 65 leg on the line, so another 32.5 -
       150 leaves the pair clear of the column and clear of the 150-deep strut
       they cross;
     they are held 170 back along their own axis, which is 106 in x - just past
       the 100 half-flange, so the end stops at the column face;
     the strut is held 110, the same 100 plus a little, and rolled 90 so the
       channel opens upward.
   Tick clash with any of them shortened and the red says so.
   The BASE row names sc.brc_1, whose work line starts at y -150 - so the ASSY
   row that places this bay says -150 too. A module's BASE is a datum: read
   where it sits, then place it there. */
push('# MODULE', 'id', 'member', 'Ref.Pt', 'LX1', 'LY1', 'LZ1', 'LX2', 'LY2', 'LZ2',
     'OFF_B', 'OFF_E', 'Alpha');
push('MODULE', 'md.bay', 'sc.brc_1', '', 0, -150, 0, SPAN, -150, COL_H, 170, 170);
push('MODULE', 'md.bay', 'sc.brc_2', '', SPAN, 150, 0, 0, 150, COL_H, 170, 170);
push('MODULE', 'md.bay', 'sc.str', '', 0, 0, 1500, SPAN, 0, 1500, 110, 110, 90);
push('MODULE', 'md.bay', 'BASE', 'sc.brc_1', 'bc');
blank();

/* ================= assembly ================= */
/* An ASSY row always places what it makes, so an assembly cannot be used as a
   private sub-group: referencing as.stf from as.bent would leave the original
   four stiffeners standing as well. So as.stf grows into the full set on its
   own - ROT round one column, COPY across to the other, COPY along the bents. */
push('# ASSY', 'id', 'ref', 'cmd', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6');
push('ASSY', 'as.stf', 'md.stf', 'ADD', 100, 0, BP);
push('ASSY', 'as.stf', 'as.stf', 'ROT', 0, 0, BP, 'Z', 90, 3);
push('ASSY', 'as.stf', 'as.stf', 'COPY', SPAN, 0, 0, 1);
push('ASSY', 'as.stf', 'as.stf', 'COPY', 0, BAY, 0, 2);
blank();
push('ASSY', 'as.bent', 'md.col', 'ADD', 0, 0, 0);
push('ASSY', 'as.bent', 'md.col', 'MIR', SPAN / 2, 0, 0, 'YZ');
push('ASSY', 'as.bent', 'md.bm', 'ADD', 0, 0, Z_BM);
push('ASSY', 'as.bent', 'md.bay', 'ADD', 0, -150, BP);
push('ASSY', 'as.bent', 'md.shoe', 'ADD', SPAN / 2, 0, Z_SLV);
push('ASSY', 'as.bent', 'as.bent', 'COPY', 0, BAY, 0, 2);
push('END');

/* ================= write ================= */
(async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('input');
  const at = (kw, id) => R.findIndex(r => r[0] === kw && (id === undefined || r[1] === id));
  const notes = {};
  const put = (i, t) => { if (i >= 0) notes[i] = t; };
  put(0, 'BASIC example - every keyword, one small model');
  put(at('PLATE', 'pl.stf'), 'WT 0 -> a right triangle');
  put(at('PLATE', 'pl.flg'), 'CIRC takes one value: the diameter');
  put(at('BAR', 'bar.anch'), '6000 = stock length. Reference only: md.col cuts it');
  put(at('SECT', 'sc.brc'), 'stock length. One definition, every brace');
  put(at('CUT', 'pl.cap'), "borrows pl.stf's outline to clip the corner");
  put(at('MODULE', 'md.col'), 'PLANE grammar: Ref.Pt on a point, laid on a plane');
  put(at('MODULE', 'md.bay'), 'coordinate grammar: stretched point to point');
  put(at('ASSY', 'as.bent') + 3, 'BASE sits on brc_1, whose line starts at y -150');
  put(at('ASSY', 'as.stf'), 'ROT round the column, then COPY twice -> 24');
  put(at('ASSY', 'as.bent'), 'ADD / MIR / COPY. 22 members, copied to 3 bents');
  R.forEach((r, i) => ws.addRow(r.length ? [notes[i] || ''].concat(r) : []));
  ws.getColumn(1).width = 42;
  ws.getColumn(2).width = 11;
  ws.getColumn(3).width = 12;
  ws.getColumn(4).width = 10;
  for (let c = 5; c <= 15; c++) ws.getColumn(c).width = 9;
  ws.eachRow(row => row.eachCell({ includeEmpty: false }, cell => {
    const v = String(cell.value == null ? '' : cell.value);
    if (cell.col === 1) { cell.font = { italic: true, color: { argb: 'FF94A3B8' }, size: 10 }; return; }
    if (v.charAt(0) === '#') cell.font = { italic: true, color: { argb: 'FF64748B' }, size: 10 };
    else if (cell.col === 2) cell.font = { bold: true, color: { argb: 'FF1D4ED8' } };
  }));
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  await wb.xlsx.writeFile(OUT);
  console.log('wrote ' + OUT + '  (' + R.length + ' rows)');
})();
