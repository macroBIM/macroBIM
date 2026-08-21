/* The sheets the tower-crane film needs, all of them the shipped example with
   PARAM cells set and the formulas worked out again. The input tab is never
   touched - that it does not have to be is the claim of the whole film.

   Excel is what normally recalculates a workbook on open. It will not run here,
   so this does the same job: set the blue cells, resolve every formula, write
   the answers back as the cached results. PLATE3D reads those results, so a
   sheet through here loads exactly as if a person had typed the numbers.

     node make_crane_files.js                                                 */
const ExcelJS = require('./node_modules/exceljs');
const fs = require('fs');
const SRC = __dirname + '/../../PLATE3D_TOWER.xlsx';
const DIR = __dirname + '/..';

const RAD = d => d * Math.PI / 180;
const RND = (x, n) => { const p = Math.pow(10, n || 0); return Math.round(x * p) / p; };
const toJs = f => f.replace(/^=/, '')
  .replace(/\bROUND\(/g, 'RND(').replace(/\bMIN\(/g, 'Math.min(')
  .replace(/\bMAX\(/g, 'Math.max(').replace(/\bCOS\(/g, 'Math.cos(')
  .replace(/\bSIN\(/g, 'Math.sin(').replace(/\bRADIANS\(/g, 'RAD(')
  .replace(/\bABS\(/g, 'Math.abs(');

// the blue cells, by the name the script calls them
const CELL = { MB:'C6', NM:'D6', Z0:'E6', HEAD:'F6',
               JBAY:'C12', NJ:'D12', JX0:'E12', TIP:'F12',
               CBAY:'C13', NC:'D13', CX0:'E13',
               TRX:'C19', DROP:'D19', SLEW:'C25' };

async function build(set, out) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SRC);
  const ps = wb.getWorksheet('PARAM'), is = wb.getWorksheet('input');
  Object.keys(set).forEach(k => { ps.getCell(CELL[k]).value = set[k]; });

  const seen = {};
  function P(addr) {
    if (addr in seen) return seen[addr];
    const c = ps.getCell(addr);
    let v = c.value;
    if (v && typeof v === 'object' && v.formula !== undefined) {
      seen[addr] = 0;
      const src = v.formula;
      let js = toJs(src);
      if (/TEXT\(|IF\(|&/.test(js)) { seen[addr] = null; return null; }   // prose
      js = js.replace(/(?:PARAM!)?\$?([A-J])\$?(\d+)/g, (m, col, row) => '(' + P(col + row) + ')');
      v = eval(js);
      c.value = { formula: src, result: v };
    }
    if (v === null || v === undefined || v === '') v = 0;
    seen[addr] = typeof v === 'number' ? v : null;
    return seen[addr];
  }
  ps.eachRow({ includeEmpty: false }, row => row.eachCell({ includeEmpty: false }, c => {
    if (c.value && typeof c.value === 'object' && c.value.formula !== undefined)
      P(c.address.replace(/\$/g, ''));
  }));
  let n = 0;
  is.eachRow({ includeEmpty: false }, row => row.eachCell({ includeEmpty: false }, c => {
    const v = c.value;
    if (!v || typeof v !== 'object' || v.formula === undefined) return;
    const js = toJs(v.formula).replace(/PARAM!\$?([A-J])\$?(\d+)/g,
      (m, col, rw) => '(' + P(col + rw) + ')');
    c.value = { formula: v.formula, result: eval(js) };
    n++;
  }));
  fs.mkdirSync(require('path').dirname(out), { recursive: true });
  await wb.xlsx.writeFile(out);
  return { n: n, top: P('J6'), rad: P('I12'), hook: P('J19') };
}

(async () => {
  const CASES = [
    ['TOWER_0_BASE.xlsx', {}],
    ['TOWER_1_MAST.xlsx', { NM: 25 }],
    ['TOWER_2_JIB.xlsx',  { NJ: 22 }],
    ['TOWER_3_HOOK.xlsx', { DROP: 36000 }],
    ['TOWER_4_ALL.xlsx',  { NM: 25, NJ: 22, DROP: 36000, SLEW: 30 }]
  ];
  for (const [f, set] of CASES) {
    const r = await build(set, DIR + '/' + f);
    console.log(f.padEnd(20), r.n + ' formulas',
      ' top ' + (r.top / 1000).toFixed(1) + ' m',
      ' radius ' + (r.rad / 1000).toFixed(1) + ' m',
      ' ground clr ' + (r.hook / 1000).toFixed(1) + ' m');
  }
  // the slew turn: one file per step, played back as frames
  const STEPS = 60;
  for (let i = 0; i < STEPS; i++) {
    await build({ SLEW: i * 360 / STEPS },
                DIR + '/slew/TOWER_S' + String(i).padStart(2, '0') + '.xlsx');
  }
  console.log('slew/  ' + STEPS + ' files, ' + (360 / STEPS) + ' deg apart');
})();
