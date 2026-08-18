/* The two sheets the promo video needs, and nothing else.

   PLATE3D_PORTAL.xlsx describes a 30 m shed with four numbers that have to move
   together: how many frames to copy, how many bays of purlins and cladding to
   copy after them, and where the two end braces and the two gable walls sit. Set
   one and leave the other three and the building comes apart - cladding stopping
   short of the last frame, a gable wall standing in the middle of the floor.

   So the other three are written as formulas on the first. PLATE3D reads the
   result Excel cached for a formula cell, not the formula, which means a sheet
   can carry its own arithmetic and the model still comes out of numbers. Type a
   9 into I106, save, load: ten frames, nine bays, and the cladding, bracing and
   gables all where they belong.

   Two files, same sheet, different number in that one cell - so the shoot can
   either type it live or cut between the two. */
const ExcelJS = require('./node_modules/exceljs');
const SRC = '/home/user/macroBIM/plate3d/PLATE3D_PORTAL.xlsx';
const DIR = '/home/user/macroBIM/plate3d/video/';
const BAY = 6000;

async function build(n, out) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SRC);
  const ws = wb.worksheets[0];
  const fx = (f, r) => ({ formula: f, result: r });

  ws.getCell('I106').value = n;                      // the one cell a human touches
  ws.getCell('I109').value = fx('I106-1',            n - 1);
  ws.getCell('F112').value = fx('6000*(I106-1)', BAY * (n - 1));
  ws.getCell('F115').value = fx('6000*I106',     BAY * n);

  // make the driver findable in a close-up, and the three that follow it
  // visibly not the ones to type in
  const drv = ws.getCell('I106');
  drv.font = { bold: true, size: 14, color: { argb: 'FF7C2D12' } };
  drv.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE68A' } };
  drv.alignment = { horizontal: 'center' };
  drv.border = ['top', 'left', 'bottom', 'right'].reduce(
    (b, s) => (b[s] = { style: 'medium', color: { argb: 'FFB45309' } }, b), {});
  ['I109', 'F112', 'F115'].forEach(a => {
    const c = ws.getCell(a);
    c.font = { italic: true, color: { argb: 'FF94A3B8' } };
    c.alignment = { horizontal: 'center' };
  });

  const note = (a, t) => {
    const c = ws.getCell(a);
    c.value = t;
    c.font = { italic: true, color: { argb: 'FF94A3B8' }, size: 10 };
  };
  note('A106', '▶ CHANGE THIS ONE NUMBER — the building follows');
  note('A109', 'purlins and cladding — formula on I106');
  note('A112', 'end bracing — formula on I106');
  note('A115', 'gable walls — formula on I106');
  ws.getCell('A1').value =
    'PLATE3D — portal frame. I106 is the bay count: ' + n + ' × 6 m = ' +
    (BAY * n / 1000) + ' m long. Everything else follows it.';

  await wb.xlsx.writeFile(DIR + out);
  console.log('wrote ' + out + '   I106 = ' + n + '  ->  ' + (BAY * n / 1000) + ' m');
}

(async () => {
  require('fs').mkdirSync(DIR, { recursive: true });
  await build(5, 'PLATE3D_VIDEO_30M.xlsx');
  await build(9, 'PLATE3D_VIDEO_54M.xlsx');
})();
