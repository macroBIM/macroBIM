/* Turn the captured stills into the splice film. Same three passes as the tower
   assembler, pointed at the other capture.

   1. Normalise. Frames arrive at three different sizes - the WebGL canvas, the
      1920x1080 flat pages, and the full browser window for the shots that show
      the app chrome. An image sequence has to be one size, so everything is
      scaled to fill 1920x1080 and centre-cropped.

   2. Lay out time. Each still carries how long it is held. A four-second hold
      is 120 frames of the same picture, so the duplicates are symlinks: the
      sequence is constant-rate and honest about it, and the disk only holds the
      distinct images.

   3. Burn in the captions. Each is a transparent PNG laid over the picture with
      a short alpha fade at each end, and the whole chain goes into one
      filter_complex - one encode, no generation loss from stacking passes.

   Directory names come out of the capture's own json rather than being written
   here twice, so the two films cannot end up reading each other's frames.

   Second pass, to 2560x1440. The stills were captured at 2x for it, so this is
   a fit and not an upscale, and they stay PNG through normalise - the first
   pass re-encoded to JPEG here, baking a second generation of loss into a
   picture that was already JPEG, and bought nothing but disk. CRF 16 rather
   than 21: flat panels compress to almost nothing and the bits go to the thin
   lines and small type a bolted joint is made of. 1440p is also the tier where
   YouTube switches to VP9, so a viewer watching at 1080p gets the better
   stream too.                                                                */
const fs = require('fs');
const cp = require('child_process');
const FF = require('ffmpeg-static');
const SP = __dirname;
const meta = JSON.parse(fs.readFileSync(SP + '/shots_splice.json', 'utf8'));
const SRC = SP + '/' + (meta.dir || 'src_splice');
const NORM = SP + '/norm_splice', SEQ = SP + '/seq_splice';
const W = meta.w || 1920, H = meta.h || 1080;
const FPS = meta.fps;

/* ---- 1. normalise ---- */
fs.rmSync(NORM, { recursive: true, force: true });
fs.mkdirSync(NORM, { recursive: true });
console.log('normalising ' + meta.shots.length + ' stills to ' + W + 'x' + H + ' ...');
// -start_number applies to whichever file it precedes, so it is needed twice:
// without it on the output the sequence is written from s0001 and every shot
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
  const src = '../norm_splice/' + s.file;
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
fs.writeFileSync(SP + '/filter_splice.txt', parts.join(';'));

const OUT = SP + '/../PLATE3D_SPLICE.mp4';
console.log('encoding ' + meta.caps.length + ' captions over ' + DUR.toFixed(1) + ' s ...');
cp.execFileSync(FF, ['-hide_banner', '-loglevel', 'error', '-y',
  ...inputs,
  '-filter_complex_script', SP + '/filter_splice.txt', '-map', '[vout]',
  '-t', DUR.toFixed(3),
  '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '16',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(FPS),
  OUT], { stdio: 'inherit' });

const sz = fs.statSync(OUT).size;
console.log('\n' + OUT);
console.log((sz / 1048576).toFixed(1) + ' MB  ·  ' + DUR.toFixed(1) + ' s  ·  ' +
            W + 'x' + H + ' @ ' + FPS + '  ·  CRF 16');
