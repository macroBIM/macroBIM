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

     LOOPED, when it is the other way round and the track runs out first. The
     Golden Gate film is 2:43 and its track is 2:08, so thirty-five seconds -
     the input sheet, the invitation, the download, the logo - would have
     played silent. A film that goes quiet for its whole ending sounds broken,
     not restrained.

       LOOP_AT   where to leave the track (default: its end)
       LOOP_TO   where to come back in
       XF        seconds of crossfade over the join (default 3)

     The two points are chosen by looking at the track, not by looping the
     whole thing from zero: leave BEFORE the track's own fade-out, and come
     back at a section start, ideally one preceded by a dip. Then the join
     reads as a transition the track might have had. Coming back at 0:00
     instead replays the intro, which nobody mistakes for anything but a
     loop.

     FADED at both ends. Most tracks start at full level from the first sample;
     under a title card that arrives as a slap. And the tail has to come down
     before the picture ends or the cut does it instead.

     LEVELLED to -15 LUFS. YouTube normalises to about -14, so a track mastered
     to -8 is turned down by the platform anyway - doing it here means hearing
     what the viewer hears rather than what the file says.

   The levelling is TWO PASS. Pass one measures the finished chain - looped,
   trimmed and faded, because loudness measured on the raw file is the loudness
   of a different piece of audio - and pass two normalises to those numbers
   with linear=true, which moves the whole track by ONE gain instead of riding
   it. On this track that is 4.9 -> 5.2 LU of loudness range kept: not much,
   and it is the difference between a track that breathes and one quietly
   compressed by a normaliser doing its best in the dark.

   It is NOT about the ceiling. One pass held -1.5 dBTP exactly, which is worth
   writing down because the first reading here said it produced +1.5 and that
   reading was wrong - see the note on measuring below.

   MEASURING THE RESULT, a trap worth an hour: ebur128 over a whole encoded
   mp4 reported +3.8 dBFS true peak on a chain whose own output measures
   -3.2. It is two samples, at 121.079 s and 145.079 s, and seek-decoding
   those exact moments gives -0.8 dB. A long linear decode of this AAC
   produces them; the audio does not contain them. So measure the FILTER
   OUTPUT when the question is whether the processing is right, and treat an
   isolated sample in a whole-file decode as the decoder's, not the file's. */
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
const XF = +(process.env.XF || 3);
const TP = +(process.env.TP || -1.5);   // true-peak ceiling, dBFS

const probe = f => {
  let out = '';
  try { cp.execFileSync(FF, ['-hide_banner', '-i', f], { stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { out = String(e.stderr || ''); }
  const m = out.match(/Duration: (\d+):(\d+):([\d.]+)/);
  return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : 0;
};
const VD = probe(VID), MD = probe(MUS);
console.log('picture ' + VD.toFixed(1) + ' s   ·   track ' + MD.toFixed(1) + ' s');

/* Where to cut the track and where to come back. Given, or worked out: leave
   at the end and come back at the top, which is the loop that always works and
   never sounds like anything else. */
const LOOP_AT = process.env.LOOP_AT ? +process.env.LOOP_AT : MD;
const LOOP_TO = process.env.LOOP_TO ? +process.env.LOOP_TO : 0;
const short = MD < VD - 0.5;
if (short && !process.env.LOOP_AT)
  console.log('  the track is ' + (VD - MD).toFixed(1) + ' s SHORT - looping it end to top.\n' +
              '  LOOP_AT= / LOOP_TO= put the join somewhere the track allows');

const mute = VID.replace(/\.mp4$/, '_mute.mp4');
if (!fs.existsSync(mute)) { fs.copyFileSync(VID, mute); console.log('  silent master kept: ' + path.basename(mute)); }

/* The music, as one filter chain.

   Short track: the same file is opened twice, cut to the two halves of the
   join, and `acrossfade` welds them. acrossfade wants both sides to be at
   least as long as the fade, and it consumes XF seconds of each - so the run
   comes out at (LOOP_AT - LOOP_TO... ) shorter than the two pieces added up,
   which is why the second piece is taken all the way to the end of the file
   and the whole thing is trimmed afterwards rather than measured out first. */
const tail = MD - LOOP_TO;
const joined = LOOP_AT - XF + tail;
if (short && joined < VD - 0.5)
  console.log('  even joined it is ' + (VD - joined).toFixed(1) +
              ' s short - the end of the film will be quiet');

const pre = short
  ? '[1:a]atrim=0:' + LOOP_AT.toFixed(3) + ',asetpts=N/SR/TB[la];' +
    '[2:a]atrim=' + LOOP_TO.toFixed(3) + ',asetpts=N/SR/TB[lb];' +
    '[la][lb]acrossfade=d=' + XF + ':c1=tri:c2=tri[m];[m]'
  : '[1:a]';

const shaped = [
  'atrim=0:' + VD.toFixed(3),
  'afade=t=in:st=0:d=' + FADE_IN,
  'afade=t=out:st=' + (VD - FADE_OUT).toFixed(3) + ':d=' + FADE_OUT
].join(',');
const LN = 'loudnorm=I=' + LUFS + ':TP=' + TP + ':LRA=11';
const src = () => short ? ['-i', MUS, '-i', MUS] : ['-i', MUS];
/* The measure pass reads the chain as it will actually be heard - looped,
   trimmed and faded - because loudness measured on the raw file is the
   loudness of a different piece of audio. Input 0 is dropped here so the
   picture is not decoded to measure the music. */
const measurePre = pre.replace(/\[1:a\]/g, '[0:a]').replace(/\[2:a\]/g, '[1:a]');
const m = cp.spawnSync(FF, ['-hide_banner', '-nostats', ...src(),
  '-filter_complex', measurePre + shaped + ',' + LN + ':print_format=json[a]',
  '-map', '[a]', '-f', 'null', '-'], { encoding: 'utf8' });
let J = null;
try { J = JSON.parse((m.stderr.match(/\{[^{}]*"input_i"[\s\S]*?\}/) || [])[0]); } catch (e) {}
if (!J) { console.log(m.stderr.slice(-800)); throw new Error('loudnorm would not measure'); }
console.log('  measured ' + (+J.input_i).toFixed(1) + ' LUFS, true peak ' +
            (+J.input_tp).toFixed(1) + ' dBFS  ->  ' + LUFS + ' / ' + TP);

const af = [shaped,
  LN + ':measured_I=' + J.input_i + ':measured_TP=' + J.input_tp +
       ':measured_LRA=' + J.input_lra + ':measured_thresh=' + J.input_thresh +
       ':offset=' + J.target_offset + ':linear=true',
  /* A backstop. linear=true already keeps the peak under the ceiling on
     everything tried so far, so this normally passes the signal through
     untouched; it is here for the track that turns up with a transient the
     measure pass under-reads.

     `level=0` is not optional. alimiter AUTO-LEVELS its output up to the
     limit by default, so written as a ceiling it RAISES the signal into one:
     -15 LUFS came out -13.5. A limiter that makes things louder is not a
     limiter, and it is the default. */
  'alimiter=limit=' + Math.pow(10, TP / 20).toFixed(4) +
    ':level=0:attack=5:release=60',
  'aresample=48000'
].join(',');

const tmp = VID.replace(/\.mp4$/, '.tmp.mp4');
cp.execFileSync(FF, ['-hide_banner', '-loglevel', 'error', '-y',
  '-i', mute, ...src(),
  '-filter_complex', pre + af + '[a]',
  '-map', '0:v', '-map', '[a]',
  '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
  '-shortest', '-movflags', '+faststart', tmp], { stdio: 'inherit' });
fs.renameSync(tmp, VID);
const sz = fs.statSync(VID).size;
console.log('\n' + VID);
console.log((sz / 1048576).toFixed(1) + ' MB  ·  ' + VD.toFixed(1) + ' s  ·  music at ' +
            LUFS + ' LUFS / ' + TP + ' dBTP, ' + FADE_IN + ' s in, ' + FADE_OUT + ' s out' +
            (short ? '\n' + ' '.repeat(8) + 'looped: ' + LOOP_AT.toFixed(1) +
                     ' s -> ' + LOOP_TO.toFixed(1) + ' s over a ' + XF +
                     ' s crossfade, joining at ' + (LOOP_AT - XF).toFixed(1) +
                     ' s of picture' : ''));
