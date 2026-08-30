/* Writes the tutorial's row data - the TUT_SPLICE block in plate_builder*.js -
   out of PLATE3D_SPLICE.xlsx itself.

       node tools/gen_tutorial.js            print it
       node tools/gen_tutorial.js -o FILE    write it

   Typing the numbers into the engine by hand would make the tutorial a second
   copy of the example, and the copy is what goes stale while nobody notices.
   So they are lifted, every formula replaced by the value it already holds,
   and every range checked against the keyword and the id it is supposed to be
   - a re-ordered example stops this script rather than shipping a tutorial
   that teaches the wrong rows.

   Paste the output over the TUT_SPLICE block, then run
   tools/check_tutorial.js, which builds all eight steps in the real app and
   compares the last one back against the workbook. */
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const BOOK = path.resolve(__dirname, '..', 'PLATE3D_SPLICE.xlsx');
const OUT = (process.argv.indexOf('-o') >= 0)
  ? process.argv[process.argv.indexOf('-o') + 1] : null;

function read(cb) {
  const wb = new ExcelJS.Workbook();
  wb.xlsx.readFile(BOOK).then(() => {
    const ws = wb.worksheets.filter(s => String(s.name).toLowerCase() === 'input')[0];
    if (!ws) throw new Error('no input sheet in ' + BOOK);
    const out = [];
    ws.eachRow({ includeEmpty: true }, r => {
      const v = (r.values || []).slice(1).map(c => {
        if (c === null || c === undefined) return null;
        if (typeof c === 'object') {
          if (c.result !== undefined) return c.result;
          if (c.formula !== undefined)
            throw new Error('formula with no cached value: ' + c.formula +
                            ' - open the workbook in Excel and save it');
          if (c.richText) return c.richText.map(t => t.text).join('');
          if (c.text !== undefined) return c.text;
          throw new Error('cell with no value');
        }
        return c;
      });
      while (v.length && (v[v.length - 1] === null || v[v.length - 1] === '')) v.pop();
      out.push(v);
    });
    // column A is the example's annotation column; the tutorial has prose instead
    cb(out.map(r => r.slice(1)).filter(r => r.length));
  }).catch(e => { console.error(String(e.message || e)); process.exit(2); });
}
read(function (ALL) {

const kw = r => String(r[0]).toUpperCase();
const at = n => { const r = ALL[n]; if (!r) throw new Error('no row ' + n); return r; };

/* Name every row of the finished sheet. The index ranges are checked against
   the keyword and the id, so a re-ordered sample breaks the build here rather
   than shipping a tutorial that teaches the wrong rows. */
function grab(a, b, k, id) {
  const out = [];
  for (let i = a; i <= b; i++) {
    const r = at(i);
    if (kw(r) !== k) throw new Error('row ' + i + ': expected ' + k + ', got ' + kw(r));
    if (id && String(r[1]).toUpperCase() !== id.toUpperCase())
      throw new Error('row ' + i + ': expected id ' + id + ', got ' + r[1]);
    out.push(r);
  }
  return out;
}
if (kw(ALL[0]) !== 'COORD') throw new Error('row 0 is not COORD');

const K = {};
K.coord  = [at(0)];
K.hoB    = grab(1, 1, 'HOLE', 'ho.b');
K.hoFil  = grab(2, 2, 'HOLE', 'ho.fil');
K.plTf   = grab(3, 3, 'PLATE', 'pl.tf');
K.plBf   = grab(4, 4, 'PLATE', 'pl.bf');
K.plWb   = grab(5, 5, 'PLATE', 'pl.wb');
K.plFil  = grab(6, 6, 'PLATE', 'pl.fil');
K.plTp   = grab(7, 7, 'PLATE', 'pl.tp');
K.plTi   = grab(8, 8, 'PLATE', 'pl.ti');
K.plWp   = grab(9, 9, 'PLATE', 'pl.wp');
K.plBi   = grab(10, 10, 'PLATE', 'pl.bi');
K.plBp   = grab(11, 11, 'PLATE', 'pl.bp');
K.boF    = grab(12, 12, 'BAR', 'bo.f');
K.boW    = grab(13, 13, 'BAR', 'bo.w');
K.cutTp  = grab(14, 17, 'CUT', 'pl.tp');
K.cutBp  = grab(18, 21, 'CUT', 'pl.bp');
K.cutTi  = grab(22, 23, 'CUT', 'pl.ti');
K.cutBi  = grab(24, 25, 'CUT', 'pl.bi');
K.cutTf  = grab(26, 27, 'CUT', 'pl.tf');
K.cutBf  = grab(28, 29, 'CUT', 'pl.bf');
K.cutWp  = grab(30, 31, 'CUT', 'pl.wp');
K.cutFil = grab(32, 32, 'CUT', 'pl.fil');
K.cutWb  = grab(33, 33, 'CUT', 'pl.wb');
K.mdBeamL= grab(34, 41, 'MODULE', 'md.beaml');
K.mdBeamR= grab(42, 49, 'MODULE', 'md.beamr');
K.mdTpo  = grab(50, 51, 'MODULE', 'md.tpo');
K.mdTpi  = grab(52, 54, 'MODULE', 'md.tpi');
K.mdBpo  = grab(55, 56, 'MODULE', 'md.bpo');
K.mdBpi  = grab(57, 59, 'MODULE', 'md.bpi');
K.mdWpl  = grab(60, 62, 'MODULE', 'md.wpl');
K.mdBlt  = grab(63, 73, 'MODULE', 'md.blt');
const asy = grab(74, 81, 'ASSY', 'as.splice');
const byMod = m => { const r = asy.filter(x => String(x[2]).toUpperCase() === m.toUpperCase());
  if (r.length !== 1) throw new Error('ASSY ' + m + ': ' + r.length); return r; };
K.asBeamL = byMod('md.beaml'); K.asBeamR = byMod('md.beamr');
K.asTpo = byMod('md.tpo');     K.asTpi   = byMod('md.tpi');
K.asBpo = byMod('md.bpo');     K.asBpi   = byMod('md.bpi');
K.asWpl = byMod('md.wpl');     K.asBlt   = byMod('md.blt');
K.views = grab(82, 86, 'VIEW');
K.plot  = grab(87, 87, 'PLOT');
K.end   = grab(88, 88, 'END');
if (ALL.length !== 89) throw new Error('sample is ' + ALL.length + ' rows, expected 89');

/* Step 1 places the outer plate on its own, before there is any module to hold
   it. Its coordinates are the ones md.tpo is placed at, read off that row -
   the step is the same plate in the same place, one tier lower. */
K.asPlTp = [['ASSY', 'as.splice', 'pl.tp', 'ADD', K.asTpo[0][4], K.asTpo[0][5], K.asTpo[0][6]]];

/* Sheet order: the order the sample is written in, so the last step's rows are
   the sample's rows and nothing else. */
const ORDER = ['coord','hoB','hoFil','plTf','plBf','plWb','plFil','plTp','plTi','plWp',
  'plBi','plBp','boF','boW','cutTp','cutBp','cutTi','cutBi','cutTf','cutBf','cutWp',
  'cutFil','cutWb','mdBeamL','mdBeamR','mdTpo','mdTpi','mdBpo','mdBpi','mdWpl','mdBlt',
  'asPlTp','asBeamL','asBeamR','asTpo','asTpi','asBpo','asBpi','asWpl','asBlt',
  'views','plot','end'];
Object.keys(K).forEach(k => { if (ORDER.indexOf(k) < 0) throw new Error('unordered key ' + k); });

const STEPS = [
  ['coord','plTp','asPlTp'],
  ['+','hoB','cutTp'],
  ['+','plTi','cutTi','mdTpo','mdTpi','-asPlTp','asTpo','asTpi'],
  ['+','plBi','plBp','cutBp','cutBi','mdBpo','mdBpi','asBpo','asBpi'],
  ['+','plWp','cutWp','mdWpl','asWpl'],
  ['+','hoFil','plTf','plBf','plWb','plFil','cutTf','cutBf','cutFil','cutWb',
       'mdBeamL','mdBeamR','asBeamL','asBeamR'],
  ['+','boF','boW','mdBlt','asBlt'],
  ['+','views','plot','end']
];
let have = [];
const KEYS = STEPS.map(s => {
  if (s[0] === '+') { s = s.slice(1); } else { have = []; }
  s.forEach(k => {
    if (k.charAt(0) === '-') { const i = have.indexOf(k.slice(1));
      if (i < 0) throw new Error('cannot drop ' + k); have.splice(i, 1); }
    else { if (have.indexOf(k) >= 0) throw new Error('duplicate ' + k); have.push(k); }
  });
  return ORDER.filter(k => have.indexOf(k) >= 0);
});
/* The last step has to be the sample, key for key. */
const last = KEYS[KEYS.length - 1];
const want = ORDER.filter(k => k !== 'asPlTp');
if (last.join(',') !== want.join(','))
  throw new Error('last step is not the sample:\n  ' + last.join(',') + '\n  ' + want.join(','));

const q = v => v === null || v === undefined || v === '' ? "''"
  : (typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "\\'") + "'");
/* Array.from, not map: ExcelJS hands back a SPARSE array for a row with a
   blank cell in the middle, and map skips holes - which emits [ , ] and puts
   an elision back into the engine instead of an empty cell. */
const rowJs = r => '[' + Array.from(r, q).join(',') + ']';

let out = '';
out += '  /* Every row of the finished sheet, named once. A step lists the names it\n';
out += '     has by then, so no row is written twice and no two steps can disagree\n';
out += '     about what a row says. Generated from PLATE3D_SPLICE.xlsx -\n';
out += '     tools/check_tutorial.js proves the last step still equals it. */\n';
out += '  var TUT_SPLICE = {\n';
ORDER.forEach(k => {
  const rows = K[k];
  out += '    ' + k + ': [' + rows.map(rowJs).join(',\n' + ' '.repeat(6 + k.length)) + '],\n';
});
out += '  };\n';
out += '  var TUT_SPLICE_ORDER = [' + ORDER.map(k => "'" + k + "'").join(',') + '];\n';
out += '  var TUT_SPLICE_STEPS = [\n';
KEYS.forEach(ks => { out += '    [' + ks.map(k => "'" + k + "'").join(',') + '],\n'; });
out += '  ];\n';
if (OUT) fs.writeFileSync(OUT, out); else process.stdout.write(out);
console.error('steps: ' + KEYS.map((k,i) => (i+1) + ':' + k.reduce((a,x)=>a+K[x].length,0) + 'r').join('  '));
console.error('bytes ' + out.length);
});
