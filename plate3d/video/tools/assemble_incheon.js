/* Turn the captured stills into the Incheon film.

       node video/tools/assemble_incheon.js

   The same three passes the other assemblers use, pointed at shots_inc.json:

   1. Normalise. Frames arrive at two sizes - the WebGL canvas and the flat
      1920x1080 pages - so everything is scaled to fill and centre-cropped.

   2. Lay out time. Each still carries how long it is held. A five-second hold
      is 150 frames of one picture, so the duplicates are symlinks: the sequence
      is constant-rate and the disk only holds the distinct images.

   3. Burn in the captions. Each is a transparent PNG over the picture with a
      short alpha fade at both ends, and the whole chain is one filter_complex -
      one encode, no generation loss from stacking passes.                    */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const FF = require('ffmpeg-static');

const SP = __dirname;
const meta = JSON.parse(fs.readFileSync(path.join(SP, 'shots_inc.json'), 'utf8'));
const SRC = path.join(SP, meta.src);
const NORM = path.join(SP, 'inc_norm'), SEQ = path.join(SP, 'inc_seq');
const W = 1920, H = 1080, FPS = meta.fps;

/* ---- 1. normalise ---- */
fs.rmSync(NORM, { recursive: true, force: true });
fs.mkdirSync(NORM, { recursive: true });
console.log('normalising ' + meta.shots.length + ' stills to ' + W + 'x' + H + ' ...');
// -start_number applies to whichever file it precedes, so it is needed twice:
// without it on the output the sequence starts at s0001 and every shot shows
// the picture of the one after it.
cp.execFileSync(FF, ['-hide_banner', '-loglevel', 'error',
  '-start_number', '0', '-i', SRC + '/s%04d.jpg',
  '-vf', 'scale=' + W + ':' + H + ':force_original_aspect_ratio=increase,crop=' + W + ':' + H,
  '-q:v', '2', '-start_number', '0', NORM + '/s%04d.jpg']);
const got = fs.readdirSync(NORM).length;
if (got !== meta.shots.length)
  throw new Error('normalise produced ' + got + ' of ' + meta.shots.length + ' frames');

/* ---- 2. lay out time ---- */
fs.rmSync(SEQ, { recursive: true, force: true });
fs.mkdirSync(SEQ, { recursive: true });
let k = 0, acc = 0;
meta.shots.forEach(s => {
  acc += s.dur;
  const want = Math.round(acc * FPS);              // absorb rounding into the next hold
  const src = '../inc_norm/' + s.file;
  while (k < want) fs.symlinkSync(src, SEQ + '/f' + String(k++).padStart(5, '0') + '.jpg');
});
const DUR = k / FPS;
console.log(k + ' frames @ ' + FPS + ' fps = ' + DUR.toFixed(2) + ' s');

/* ---- 3. captions ---- */
const inputs = ['-framerate', String(FPS), '-i', SEQ + '/f%05d.jpg'];
const parts = [];
let last = '[0:v]';
meta.caps.forEach((c, i) => {
  inputs.push('-loop', '1', '-t', String(c.dur + 1), '-i', path.join(SP, c.png));
  const FD = 0.35;
  parts.push('[' + (i + 1) + ':v]format=rgba,' +
             'fade=t=in:st=0:d=' + FD + ':alpha=1,' +
             'fade=t=out:st=' + (c.dur - FD).toFixed(2) + ':d=' + FD + ':alpha=1,' +
             'setpts=PTS-STARTPTS+' + c.start.toFixed(3) + '/TB[ov' + i + ']');
  const out = (i === meta.caps.length - 1) ? '[vout]' : '[b' + i + ']';
  parts.push(last + '[ov' + i + ']overlay=0:0:enable=\'between(t,' + c.start.toFixed(3) +
             ',' + (c.start + c.dur).toFixed(3) + ')\':eof_action=pass' + out);
  last = out;
});
fs.writeFileSync(path.join(SP, 'filter_inc.txt'), parts.join(';'));

const OUT = path.resolve(SP, '..', meta.out);
console.log('encoding ' + meta.caps.length + ' captions over ' + DUR.toFixed(1) + ' s ...');
cp.execFileSync(FF, ['-hide_banner', '-loglevel', 'error', '-y',
  ...inputs,
  '-filter_complex_script', path.join(SP, 'filter_inc.txt'), '-map', '[vout]',
  '-t', DUR.toFixed(3),
  /* crf 25, the number the Eiffel film ended on and for the same reason: a
     take that orbits from the first frame to the last has no still pictures
     for x264 to spend nothing on, so every frame is a new frame. 21 put the
     Eiffel at 42 MB and 24 at 28.6 MB silent - which became 31.2 MB once it
     was scored, over the 30 MB these films have to travel in. MUSIC IS PART
     OF THE BUDGET, and it is a pass that happens after this one.

     This film is four seconds shorter and its subject is thinner - a fan of
     cables against black rather than a lattice - so 25 should land under the
     Eiffel's. If it does not, the budget is what moves, not the picture.

     CRF= overrides it. Raise it if the film ever gets longer; do not lower it
     below 21 - past there x264 is spending bits on the black. */
  '-c:v', 'libx264', '-preset', 'slow', '-crf', String(+(process.env.CRF || 25)),
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(FPS),
  OUT], { stdio: 'inherit' });

const sz = fs.statSync(OUT).size;
console.log('\n' + OUT);
console.log((sz / 1048576).toFixed(1) + ' MB  ·  ' + DUR.toFixed(1) + ' s  ·  ' +
            W + 'x' + H + ' @ ' + FPS);
