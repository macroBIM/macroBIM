/* PLATE3D_HINGE.xlsx - DEVICE (HINGE), built up one drawing at a time.
 *
 * STEP 1 - PL HDEVBS and PL HCAW, off their own dimensioned sheet.
 *
 * HDEVBS is not a rectangle. Two dimension chains give the outline and they
 * close on each other, so the shape is read rather than guessed:
 *
 *   830 = 195 + 440 + 195   across, and the chain is the outline: the MIDDLE
 *                           440 stands 30 proud, the outer 195 each side are
 *                           30 lower. Not one step at 635 - two, at 195 and
 *                           at 635, and the raised part is between them.
 *   220 = 30 + 40 + 80 + 70 down the left, measured to the raised top. The 30
 *                           is that rise. The two interior ticks, 70 and 150
 *                           from that top, are the bolt holes - 80 apart.
 *   140 x 40                a tab hanging BELOW the bottom edge, centred:
 *                           345 + 140 + 345 = 830 puts it on the centreline,
 *                           and inside the raised 440.
 *   40                      dimensioned from each end to the bolt holes, which
 *                           therefore sit in the two low outer bays.
 *
 * So it is 220 tall through the middle 440, 190 tall on the outer 195 either
 * side, and 260 on the 140 the tab hangs from. Entered as its bounding
 * rectangle, 830 x 260, with four cuts - two shoulders and two bays - each run
 * out past the edge it opens, since a cut that lands exactly on the outline is
 * the one case the 2D booleans do not like.
 *
 * HCAW is a plain 285 x 194. The blue outline on the sheet is the plate; the
 * white lines above it are the dimension's extension lines, not an edge.
 *
 * WHERE HCAW GOES IS HALF ESTABLISHED. The sheet draws CAMERA WALL against the
 * plate rather than off on its own, and its underside lands on the low top
 * edge - that level is a datum and is used. Its position along the plate is
 * NOT dimensioned anywhere; CAW_X is scaled off the drawing and is good to
 * about +/-5.
 */
const ExcelJS = require('/tmp/claude-0/-home-user/6cdc702a-24df-51eb-b9d9-9f399d189def/scratchpad/node_modules/exceljs');
const OUT = process.argv[2] ||
  '/tmp/claude-0/-home-user/6cdc702a-24df-51eb-b9d9-9f399d189def/scratchpad/PLATE3D_HINGE.xlsx';

/* ===================== from the sheet - exact ===================== */
const DEVBS = { w: 830, h: 220, t: 15 };     // main body, 1 EA/SET
const STEP = { x: 195, w: 440, h: 30 };      // the middle 440 stands 30 proud
const TAB = { w: 140, h: 40 };               // hangs below the bottom edge
const BOLT = { d: 22, x: 40, z1: 70, z2: 150 };   // 4-D22, from the ends / top
const CAW = { w: 285, h: 194, t: 10 };       // camera wall plate, 1 EA/SET
const MAT = 'SM490';                         // not on the sheet - assumed

/* ===================== derived - the outline ===================== */
const BB = DEVBS.h + TAB.h;                  // 260 - the bounding rectangle
const BAY = (DEVBS.w - TAB.w) / 2;           // 345 either side of the tab
const O = 10;                                // how far a cut runs out past an edge

/* ===================== the camera wall ===================== */
const Z_CAW = DEVBS.h - STEP.h;     // 190 - its underside on the low top edge
const X_CAW = 325;                  // SCALED off the drawing - not dimensioned

const R = [];
const push = (...r) => R.push(r);
const blank = () => R.push([]);
const rd = v => Math.round(v * 10000) / 10000;

push('# PLATE', 'id', 'mat', 'thk', 'shape', 'base.pt', 'p1', 'p2');
/* entered as the bounding rectangle; the three cuts below make the outline */
push('PLATE', 'pl.devbs', MAT, DEVBS.t, 'RECT', 'bl', DEVBS.w, BB);
push('PLATE', 'pl.caw', MAT, CAW.t, 'RECT', 'bl', CAW.w, CAW.h);
blank();

push('# HOLE', 'id', 'shape', 'base.pt', 'p1', 'p2');
push('HOLE', 'ho.d22', 'CIRC', 'mc', BOLT.d);
push('HOLE', 'ho.bay', 'RECT', 'bl', BAY + O, TAB.h + O);      // beside the tab
push('HOLE', 'ho.shld', 'RECT', 'bl', STEP.x + O, STEP.h + O); // beside the rise
blank();

push('# CUT', 'plate', 'L.X', 'L.Y', 'shape', 'dx', 'dy', 'repeat',
     'dx2', 'dy2', 'repeat2');
/* the two bays either side of the tab - one row, the pair 495 apart */
push('CUT', 'pl.devbs', -O, -O, 'ho.bay', BAY + TAB.w + O, 0, 1);
/* the two low shoulders either side of the raised 440 - one row, the pair
   645 apart, each run out past its own end and past the top */
push('CUT', 'pl.devbs', -O, BB - STEP.h, 'ho.shld', STEP.x + STEP.w + O, 0, 1);
/* 4-D22: 40 in from each end, 70 and 150 down from the top */
push('CUT', 'pl.devbs', BOLT.x, BB - BOLT.z2, 'ho.d22',
     DEVBS.w - 2 * BOLT.x, 0, 1, 0, BOLT.z2 - BOLT.z1, 1);
blank();

/* ===================== the frame =====================
   x 0 on the plate's centreline, z 0 on its main bottom edge (so the tab
   hangs to -40 and the top is 220), y 0 on its front face. */
push('# MODULE', 'id', 'member', 'Ref.Pt', 'L.X', 'L.Y', 'L.Z', 'PLANE',
     'ROT.X', 'ROT.Y', 'ROT.Z');
push('MODULE', 'md.hinge', 'pl.devbs', 'bl', -DEVBS.w / 2, -DEVBS.t / 2, -TAB.h, 'XZ');
push('MODULE', 'md.hinge', 'pl.caw', 'bl', rd(X_CAW), rd(-DEVBS.t / 2), Z_CAW, 'XZ');
blank();

push('# MODULE', 'id', 'BASE', 'member', 'pt');
push('MODULE', 'md.hinge', 'BASE', 'pl.devbs', 'bl');
blank();
push('# ASSY', 'id', 'ref', 'cmd', 'G.X', 'G.Y', 'G.Z');
push('ASSY', 'as.hinge', 'md.hinge', 'ADD', -DEVBS.w / 2, rd(-DEVBS.t / 2), -TAB.h);
push('END');

/* ===================== write ===================== */
(async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('input');
  const at = (kw, id) => R.findIndex(r => r[0] === kw && (id === undefined || r[1] === id));
  const notes = {};
  const put = (i, t) => { if (i >= 0) notes[i] = t; };
  put(0, 'DEVICE (HINGE) - step 1: the back plate and the camera wall plate');
  put(at('PLATE', 'pl.devbs'), 'PL HDEVBS 15T 1 EA/SET - bounding 830x260; cuts make the outline');
  put(at('PLATE', 'pl.caw'), 'PL HCAW   10T 1 EA/SET - 285x194');
  put(at('# CUT'), 'two bays beside the tab, the 30 step in the top, and 4-D22');
  put(at('# ASSY'), 'one set, on the frame it was set out in');
  R.forEach((r, i) => ws.addRow(r.length ? [notes[i] || ''].concat(r) : []));
  ws.getColumn(1).width = 64;
  ws.getColumn(2).width = 11;
  ws.getColumn(3).width = 12;
  ws.getColumn(4).width = 11;
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
  console.log('HDEVBS 220 tall through the middle ' + STEP.w + ', 190 on the ' +
              'outer ' + STEP.x + ' each side, tab ' + TAB.w + 'x' + TAB.h);
  console.log('bays ' + BAY + ' + tab ' + TAB.w + ' + bay ' + BAY + ' = ' +
              (2 * BAY + TAB.w));
})();
