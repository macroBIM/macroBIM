/* bi_font.css - Bootstrap Icons, the way v_font.css holds Inter.

   The site's sidebar draws its icons with <i class="bi bi-...">, off
   cdnjs at 1.11.3. A capture pass has no network, and serving the wrong
   file there is worse than serving nothing: the first cut of the Simple
   connector film had every icon missing from the left menu and shipped a
   sidebar no visitor has ever seen.

   So the exact version the site pins is fetched from npm once and the woff2
   is inlined, giving one self-contained stylesheet the shoot can serve for
   the cdnjs URL. Same version, same glyphs, no network at capture time.

   Output is a build product and is gitignored, like v_font.css. This file is
   what is kept.

     node mkbicons.js                                                        */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SP = __dirname;
const VER = '1.11.3';                     // what design/test_sections.html pins
const OUT = SP + '/bi_font.css';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bicons-'));
const tgz = execFileSync('npm', ['pack', 'bootstrap-icons@' + VER, '--silent'],
                         { cwd: tmp, encoding: 'utf8' }).trim().split('\n').pop();
execFileSync('tar', ['xzf', tgz], { cwd: tmp });

const dir = path.join(tmp, 'package', 'font');
const css = fs.readFileSync(path.join(dir, 'bootstrap-icons.min.css'), 'utf8');
const woff2 = fs.readFileSync(path.join(dir, 'fonts', 'bootstrap-icons.woff2'));

/* The stylesheet asks for two files by relative URL. Only woff2 is inlined -
   every browser this is captured in reads it - and the woff line is dropped
   rather than left pointing at a file that will not be served. */
const src = 'url("data:font/woff2;base64,' + woff2.toString('base64') + '") format("woff2")';
const out = css.replace(/src:[^;}]*/, 'src:' + src);
if (out === css) throw new Error('bootstrap-icons css changed shape - no src to replace');
fs.writeFileSync(OUT, out);
fs.rmSync(tmp, { recursive: true, force: true });

const n = (css.match(/\.bi-/g) || []).length;
console.log('bi_font.css  ' + (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB  · ' +
            'bootstrap-icons ' + VER + ' · ' + n + ' glyph rules');
