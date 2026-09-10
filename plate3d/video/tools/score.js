/* Put music under a finished film.

       node video/tools/score.js PLATE3D_EIFFEL.mp4 <track.mp3>

   The assembler makes a silent master; this is a separate step because the
   picture and the music are decided at different times and by different people.
   The silent cut is kept beside the scored one as `*_mute.mp4`, so re-running
   the assembler and re-scoring cannot lose either.

   THE VIDEO IS NOT RE-ENCODED. It is copied through, so scoring a film costs
   seconds and costs no quality - and the same film can be scored twice with
   two different tracks without either one being a generation down.

   Three things are done to the track and every one of them is because a track
   is written to be listened to, not to be laid under something:

     TRIMMED to the picture. A track that runs on past the last frame is not
     heard - it is CUT OFF, mid-phrase, which is worse than not having it.

     FADED at both ends. Most tracks start at full level from the first sample;
     under a title card that arrives as a slap. And the tail has to come down
     before the picture ends or the cut does it instead.

     LEVELLED to -15 LUFS. YouTube normalises to about -14, so a track mastered
     to -8 is turned down by the platform anyway - doing it here means hearing
     what the viewer hears rather than what the file says.                    */
const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const FF = require('ffmpeg-static');

const VID = process.argv[2];
const MUS = process.argv[3];
if (!VID || !MUS) { console.log('usage: node score.js <film.mp4> <track.mp3>'); process.exit(1); }
const FADE_IN = +(process.env.FADE_IN || 2.5);
const FADE_OUT = +(process.env.FADE_OUT || 4);
const LUFS = +(process.env.LUFS || -15);

const probe = f => {
  let out = '';
  try { cp.execFileSync(FF, ['-hide_banner', '-i', f], { stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { out = String(e.stderr || ''); }
  const m = out.match(/Duration: (\d+):(\d+):([\d.]+)/);
  return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : 0;
};
const VD = probe(VID), MD = probe(MUS);
console.log('picture ' + VD.toFixed(1) + ' s   ·   track ' + MD.toFixed(1) + ' s');
if (MD < VD - 0.5) console.log('  the track is SHORTER than the film - it will run out; loop it first');

const mute = VID.replace(/\.mp4$/, '_mute.mp4');
if (!fs.existsSync(mute)) { fs.copyFileSync(VID, mute); console.log('  silent master kept: ' + path.basename(mute)); }

const af = [
  'atrim=0:' + VD.toFixed(3),
  'afade=t=in:st=0:d=' + FADE_IN,
  'afade=t=out:st=' + (VD - FADE_OUT).toFixed(3) + ':d=' + FADE_OUT,
  'loudnorm=I=' + LUFS + ':TP=-1.5:LRA=11',
  'aresample=48000'
].join(',');

const tmp = VID.replace(/\.mp4$/, '.tmp.mp4');
cp.execFileSync(FF, ['-hide_banner', '-loglevel', 'error', '-y',
  '-i', mute, '-i', MUS,
  '-filter_complex', '[1:a]' + af + '[a]',
  '-map', '0:v', '-map', '[a]',
  '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
  '-shortest', '-movflags', '+faststart', tmp], { stdio: 'inherit' });
fs.renameSync(tmp, VID);
const sz = fs.statSync(VID).size;
console.log('\n' + VID);
console.log((sz / 1048576).toFixed(1) + ' MB  ·  ' + VD.toFixed(1) + ' s  ·  music at ' +
            LUFS + ' LUFS, ' + FADE_IN + ' s in, ' + FADE_OUT + ' s out');
