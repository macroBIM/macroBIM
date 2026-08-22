/* Turn the captured stills into Basics 03, BAR & SECT. Same three passes as the
   other two assemblers, pointed at this capture and at a bigger frame.

   1. Normalise. Frames arrive at three sizes - the WebGL canvas, the flat
      pages, and the whole browser window for the shots that show the app. An
      image sequence has to be one size, so everything is scaled to fill and
      centre-cropped. The target is 2560x1440, and the stills were captured at
      2x for it, so this is a fit, not an upscale.

      They stay PNG here. The promos re-encoded to JPEG at this step - baking a
      second generation of loss into a picture that was already JPEG - and the
      only thing it bought was disk, which there is plenty of.

   2. Lay out time. Each still carries how long it is held. A four-second hold
      is 120 frames of the same picture, so the duplicates are symlinks: the
      sequence is constant-rate and honest about it, and the disk only holds the
      distinct images.

   3. Burn in the captions. Each is a transparent PNG laid over the picture with
      a short alpha fade at each end, and the whole chain goes into one
      filter_complex - one encode, no generation loss from stacking passes.

      The cards were drawn 1920x1080 and the film is 2560x1440, so they are
      scaled up here. That is fine for what they are - flat colour, big type,
      and Inter's curves survive a 1.33x lift far better than a screenshot of
      thin drawing lines would.

   CRF 16 rather than the promos' 21. Screen content is where a mid CRF shows:
   flat panels compress to nothing and every bit saved there is spent on the
   thin lines and small type that are the whole point of this film.

   Directory names come out of the capture's own json rather than being written
   here twice, so the three films cannot read each other's frames.           */
const fs = require('fs');
const cp = require('child_process');
const FF = require('ffmpeg-static');
const SP = __dirname;
const meta = JSON.parse(fs.readFileSync(SP + '/shots_barsect.json', 'utf8'));
const SRC = SP + '/' + (meta.dir || 'src_barsect');
const NORM = SP + '/norm_barsect', SEQ = SP + '/seq_barsect';
const W = meta.w || 2560, H = meta.h || 1440;
const FPS = meta.fps;

/* ---- 1. normalise ---- */
fs.rmSync(NORM, { recursive: true, force: true });
fs.mkdirSync(NORM, { recursive: true });
console.log('normalising ' + meta.shots.length + ' stills to ' + W + 'x' + H + ' ...');
// -start_number applies to whichever file it precedes, so it is needed twice:
// without it on the output the sequence is written from s0000 and every shot
// ends up showing the picture of the one after it.
cp.execFileSync(FF, ['-hide_banner', '-loglevel', 'error',
  '-start_number', '0', '-i', SRC + '/s%04d.png',
  '-vf', 'scale=' + W + ':' + H + ':force_original_aspect_ratio=increase:flags=lanczos,' +
         'crop=' + W + ':' + H,
  '-start_number', '0', NORM + '/s%04d.png'], { stdio: 'inherit' });
const got = fs.readdirSync(NORM).length;
if (got !== meta.shots.length || !fs.existsSync(NORM + '/' + meta.shots[0].file))
  throw new Error('normalise produced ' + got + ' of ' + meta.shots.length + ' frames');

/* ---- 2. lay out time ---- */
fs.rmSync(SEQ, { recursive: true, force: true });
fs.mkdirSync(SEQ, { recursive: true });
let k = 0, acc = 0;
meta.shots.forEach(s => {
  acc += s.dur;
  const want = Math.round(acc * FPS);            // absorb rounding into the next hold
  const src = '../norm_barsect/' + s.file;
  while (k < want) fs.symlinkSync(src, SEQ + '/f' + String(k++).padStart(5, '0') + '.png');
});
const DUR = k / FPS;
console.log(k + ' frames @ ' + FPS + ' fps = ' + DUR.toFixed(2) + ' s');

/* ---- 3. captions ---- */
const inputs = ['-framerate', String(FPS), '-i', SEQ + '/f%05d.png'];
const parts = [];
let last = '[0:v]';
meta.caps.forEach((c, i) => {
  const png = SP + '/' + c.png;
  if (!fs.existsSync(png)) throw new Error('missing caption card: ' + c.png);
  inputs.push('-loop', '1', '-t', String(c.dur + 1), '-i', png);
  const FD = 0.35;
  parts.push('[' + (i + 1) + ':v]format=rgba,scale=' + W + ':' + H + ':flags=lanczos,' +
             'fade=t=in:st=0:d=' + FD + ':alpha=1,' +
             'fade=t=out:st=' + (c.dur - FD).toFixed(2) + ':d=' + FD + ':alpha=1,' +
             'setpts=PTS-STARTPTS+' + c.start.toFixed(3) + '/TB[ov' + i + ']');
  const out = (i === meta.caps.length - 1) ? '[vout]' : '[b' + i + ']';
  parts.push(last + '[ov' + i + ']overlay=0:0:enable=\'between(t,' + c.start.toFixed(3) +
             ',' + (c.start + c.dur).toFixed(3) + ')\':eof_action=pass' + out);
  last = out;
});
fs.writeFileSync(SP + '/filter_barsect.txt', parts.join(';'));

const OUT = SP + '/../PLATE3D_BARSECT.mp4';
console.log('encoding ' + meta.caps.length + ' captions over ' + DUR.toFixed(1) + ' s ...');
cp.execFileSync(FF, ['-hide_banner', '-loglevel', 'error', '-y',
  ...inputs,
  '-filter_complex_script', SP + '/filter_barsect.txt', '-map', '[vout]',
  '-t', DUR.toFixed(3),
  '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '16',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(FPS),
  OUT], { stdio: 'inherit' });

const sz = fs.statSync(OUT).size;
console.log('\n' + OUT);
console.log((sz / 1048576).toFixed(1) + ' MB  ·  ' + DUR.toFixed(1) + ' s  ·  ' +
            W + 'x' + H + ' @ ' + FPS + '  ·  CRF 16');
