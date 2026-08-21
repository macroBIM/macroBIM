/* Rebuild the timeline for stills that survived a crash.

   shoot_tower.js wrote shots.json once, at the very end, so a browser that died
   in cut 10 left 562 good frames with no record of how long each is held. The
   capture is deterministic, though: every duration in it is a literal, so the
   timeline can be laid out again from the script and checked rather than
   guessed. Two things have to agree or this is wrong and says so - the frame
   count, and the cumulative time at every cut boundary the log printed. */
const fs = require('fs');
const SP = __dirname;
const FPS = 30, MO = 15;

let n = 0, T = 0;
const shots = [], caps = [];
const put = dur => { shots.push({ file: 's' + String(n++).padStart(4, '0') + '.jpg', dur: dur }); T += dur; };
const caption = (id, start, dur) => caps.push({ png: 't_' + id + '.png', start: start, dur: dur });
const move = dur => { const k = Math.max(1, Math.round(dur * MO));
  for (let i = 0; i < k; i++) put(dur / k); };
function beat(id, hold, swap, orbit) {
  caption('x' + id + '0', T + 0.25, hold - 0.30);
  put(hold);
  caption('x' + id + '1', T - 0.15, 0.75);
  caption('x' + id + '2', T + 0.30, swap + orbit - 0.45);
  put(swap);
  move(orbit);
}
/* what the log printed at each cut boundary - the thing being checked against */
const MARKS = [['1 intro orbit', 5.00], ['2 title', 9.00], ['3 Example', 14.28],
               ['4 download', 20.34], ['5 PARAM', 27.34], ['6 mast', 38.34],
               ['7 jib', 49.34], ['8 hoist', 61.94], ['9 slew', 74.94]];
const seen = [];
const mark = () => seen.push(T);

/* 1 */ caption('c01', 0.3, 4.2); move(5.0); mark();
/* 2 */ put(4.0); mark();
/* 3 */ caption('c03', T + 0.3, 4.6); put(1.6);
        for (let i = 0; i < 12; i++) put(1.5 / 12);
        put(0.4); put(0.28); put(0.5); put(1.0); mark();
/* 4 */ caption('c04', T + 0.3, 4.6); put(1.3);
        for (let i = 0; i < 14; i++) put(1.6 / 14);
        put(0.4); put(0.26); put(1.6); put(0.9); mark();
/* 5 */ put(1.6); caption('c05', T + 0.2, 5.2); put(5.4); mark();
/* 6 */ beat('m', 2.6, 2.0, 6.4); mark();
/* 7 */ beat('j', 2.6, 2.0, 6.4); mark();
/* 8 */ caption('xh0', T + 0.25, 2.3); put(2.6);
        caption('xh1', T - 0.15, 0.75);
        caption('xh2', T + 0.30, 3.6); put(1.8); move(2.4);
        caption('xh3', T - 0.15, 0.75);
        caption('xh4', T + 0.30, 4.6); put(1.8); move(4.0); mark();
/* 9  The slew beat put one frame per workbook and divided its 13 s among them.
       How many that was is taken from what is on disk rather than from the slew
       directory: the capture read that directory an hour ago, and the count it
       saw then is not recoverable now. Everything else is pinned - the eight
       boundaries before this one match the log, and this beat's own length
       (74.94 - 61.94 = 13.00 s) matches it too, so only the division among the
       frames is being filled in, which is what the code did. */
        caption('xs2', T + 0.3, 12.4);
        const onDisk = fs.readdirSync(SP + '/src').filter(f => /^s\d+\.jpg$/.test(f)).length;
        const STEP = onDisk - shots.length;
        for (let i = 0; i < STEP; i++) put(13.0 / STEP); mark();

let bad = 0;
MARKS.forEach((m, i) => {
  const d = Math.abs(seen[i] - m[1]);
  if (d > 0.005) { console.log('MISMATCH  ' + m[0] + '  rebuilt ' + seen[i].toFixed(2) +
                               '  log ' + m[1].toFixed(2)); bad++; }
});
const have = fs.readdirSync(SP + '/src').filter(f => /^s\d+\.jpg$/.test(f)).length;
if (have !== shots.length) { console.log('MISMATCH  frames: on disk ' + have +
                                         ', rebuilt ' + shots.length); bad++; }
console.log(bad ? '\n' + bad + ' mismatch(es) - not writing' :
  'all 9 cut boundaries and the frame count agree\n' +
  shots.length + ' stills · ' + caps.length + ' captions · ' + T.toFixed(2) + ' s');
if (!bad) fs.writeFileSync(SP + '/shots_recovered.json',
  JSON.stringify({ fps: FPS, shots: shots, caps: caps }, null, 1));
