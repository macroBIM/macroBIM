/* The Incheon Bridge as it stood, once per step of the erection.

       node video/tools/make_incheon_stages.js

   62 workbooks. The steps are not chosen here - `STAGES=1 node
   tools/make_incheon.js` prints them, because they belong to the model: the
   pylon's eight lifts, then a ring of stays and a segment either side of the
   pylon, twenty-six times, then closure. Asking keeps this file from drifting
   when the model is re-staged.

   Each book is the WHOLE sheet written up to that step: sections, tapers,
   modules, assemblies. Nothing is hidden and nothing is faded - the steel that
   is not there yet was simply not written, which is the only way a frame of
   the film is a model rather than a lighting state.

   THE PYLON IS CUT BY AN ELEVATION, NOT BY MEMBERS, so a part-built lift ends
   on a section that is not in the drawing: the two ends of its taper,
   interpolated at that height. Those books carry a taper of their own. That is
   why this is 62 workbooks and not 62 views of one.                          */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SP = __dirname;
const GEN = path.resolve(SP, '../../tools/make_incheon.js');
const OUT = path.resolve(SP, '../incheon');

const F = execFileSync(process.execPath, [GEN], { env: { ...process.env, STAGES: '1' } })
  .toString().trim().split('\n').map(l => l.trim().split(/\s+/).map(Number));

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
console.log(F.length + ' stages · pylon to ' + F[F.length - 1][0] + ' mm · ' +
            'last frame ' + F[F.length - 1][1] + ' to ' + F[F.length - 1][2]);

F.forEach((_, i) => {
  const f = path.join(OUT, 'INC_' + String(i).padStart(2, '0') + '.xlsx');
  execFileSync(process.execPath, [GEN, f], { env: { ...process.env, STAGE: String(i) } });
  process.stdout.write(i % 10 === 9 ? '' + (i + 1) : '.');
});

/* The frames go beside the books, so the shoot tool reads one file rather than
   running the generator again - and so the two can never disagree about which
   stage a frame belongs to. */
fs.writeFileSync(path.join(OUT, 'frames.json'),
  JSON.stringify(F.map(r => ({ ztop: r[0], xlo: r[1], xhi: r[2] })), null, 1));

const n = fs.readdirSync(OUT).filter(f => /\.xlsx$/.test(f)).length;
if (n !== F.length) throw new Error(n + ' workbooks for ' + F.length + ' stages');
console.log('\n' + n + ' workbooks in ' + OUT);
