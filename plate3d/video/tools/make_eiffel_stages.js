/* The tower as it stood, once per panel.

       node video/tools/make_eiffel_stages.js

   31 workbooks, one for every joint the structure actually has. The heights are
   not chosen here - `STAGES=1 node tools/make_eiffel.js` prints them, because
   they are the panel tops and the panel tops are the model's. Asking keeps this
   file from drifting when the model is re-panelled.

   Each book is the WHOLE sheet written down to that height: sections, plates,
   modules, assemblies. Nothing is hidden - the members above simply were not
   written, which is the only way a frame of the film is a model rather than a
   lighting state.                                                            */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const GEN = path.resolve(SP, '../../tools/make_eiffel.js');
const OUT = path.resolve(SP, '../eiffel');

const Z = execFileSync(process.execPath, [GEN], { env: { ...process.env, STAGES: '1' } })
  .toString().trim().split('\n').map(Number);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
console.log(Z.length + ' stages, ' + Z[0] + ' mm to ' + Z[Z.length - 1] + ' mm');
Z.forEach((z, i) => {
  const f = path.join(OUT, 'EIF_' + String(i).padStart(2, '0') + '.xlsx');
  execFileSync(process.execPath, [GEN, f], { env: { ...process.env, TOPZ: String(z) } });
  process.stdout.write('.');
});
const n = fs.readdirSync(OUT).filter(f => /\.xlsx$/.test(f)).length;
const seen = new Set(fs.readdirSync(OUT).map(f =>
  require('crypto').createHash('md5').update(fs.readFileSync(path.join(OUT, f))).digest('hex')));
console.log('\n' + n + ' workbooks in ' + OUT);
