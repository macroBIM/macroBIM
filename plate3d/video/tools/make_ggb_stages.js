/* The erection, as a run of workbooks.

       node video/tools/make_ggb_stages.js [outdir]     (default video/ggb/)

   Every frame of the build-up is a real model the engine built from a real
   sheet. Nothing is faked and nothing is hidden by hand: each file simply is
   the bridge at that moment, and the camera never moves between them.

   That is the same trick PLATE3D_TOWER.mp4 used for the slew - 60 workbooks
   played in a row - and for the same reason. Toggling members in the viewer
   would have been cheaper and would have made the sequence a lighting effect
   rather than a model.

   The order is the order a suspension bridge goes up:

     towers                          the two things that stand on their own
     + main cables                   spun over the saddles, into the anchorages
     + hanger ropes                  dropped from every node
     + stiffening truss              out from BOTH towers, meeting at mid-span
     + deck                          following the truss it sits on

   The last two grow. A bay only exists once the bays between it and a tower
   do, because that is the only way a suspended deck can be built - there is
   nothing to stand on until there is.

   Reads make_ggb.js through its two switches, so there is one model and one
   generator; this file only decides what to ask for.                        */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const GEN = path.resolve(HERE, '../../tools/make_ggb.js');
const OUT = process.argv[2] || path.resolve(HERE, '../ggb');

const NT = 24;          // truss frames, tower to mid-span
const ND = 24;          // deck frames, following it

const frames = [];
const at = (name, env) => frames.push({ name: name, env: env });

at('00_towers', { PARTS: 'twr' });
at('01_cables', { PARTS: 'twr,mcb' });
at('02_ropes', { PARTS: 'twr,mcb,hgr' });
for (let i = 1; i <= NT; i++) {
  at('03_truss_' + String(i).padStart(2, '0'),
     { PARTS: 'twr,mcb,hgr,trs', STAGE: (i / NT).toFixed(4) + ',0' });
}
for (let i = 1; i <= ND; i++) {
  at('04_deck_' + String(i).padStart(2, '0'),
     { PARTS: '', STAGE: '1,' + (i / ND).toFixed(4) });
}
at('05_done', {});

fs.mkdirSync(OUT, { recursive: true });
let n = 0;
for (const f of frames) {
  const file = path.join(OUT, 'GGB_' + f.name + '.xlsx');
  execFileSync(process.execPath, [GEN, file],
               { env: Object.assign({}, process.env, f.env), stdio: 'pipe' });
  n++;
  process.stdout.write('\r  ' + n + ' / ' + frames.length + '   ' + f.name + '        ');
}
console.log('\n' + n + ' workbooks in ' + OUT);
console.log('Play them in this order with the camera untouched. Do NOT press a');
console.log('View button between loads - the first file frames the shot and the');
console.log('rest have to arrive into that same frame, or the bridge will jump');
console.log('back to fit on every load and nothing will look like it is growing.');
