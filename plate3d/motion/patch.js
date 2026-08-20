/* The harness needs one thing the engine does not hand out: the list of part
   instances it built. Rather than keep a forked copy of a 370 KB engine that
   would drift the moment plate_builder_test.js changes, derive it here - one
   line inserted, every time, from whatever the engine currently is. */
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, '..', 'plate_builder_test.js');
const OUT = path.join(__dirname, '_engine.js');
const ANCHOR = '  window.plateBuilder = {\n';
const LINE = '  window.__pbItems = function () { return items; };   // motion harness\n';

const s = fs.readFileSync(SRC, 'utf-8');
const n = s.split(ANCHOR).length - 1;
if (n !== 1) {
  console.error(`patch.js: expected exactly one "${ANCHOR.trim()}" in the engine, found ${n}.`);
  console.error('The engine moved. Fix ANCHOR here rather than forking the engine.');
  process.exit(1);
}
fs.writeFileSync(OUT, s.replace(ANCHOR, LINE + ANCHOR));
console.log(`_engine.js written from plate_builder_test.js (+1 line, ${(s.length/1024).toFixed(0)} KB)`);
