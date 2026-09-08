/* 찍은 스틸을 PSC 영상으로 만든다. plate3d 조립기와 같은 세 패스.

   1. 정규화. 스틸은 3200×1800(창 1600×900 을 2배로), 카드는 3840×2160 이다.
      이미지 시퀀스는 한 크기여야 하므로 전부 2560×1440 으로 맞춘다 —
      둘 다 축소이고, 어디에서도 확대가 없다. PNG 로 남긴다: 여기서 JPEG 로
      바꾸면 이미 한 번 지난 그림에 손실을 한 세대 더 굽는 셈이고 디스크만 번다.

   2. 시간 배치. 스틸마다 얼마나 머무는지가 적혀 있다. 4초 홀드는 같은 그림
      120 프레임이므로 중복은 심링크로 둔다 — 시퀀스는 고정 프레임률이고
      디스크에는 서로 다른 그림만 남는다.

   3. 자막 번인. 카드는 투명 PNG 이고 양 끝에 짧은 알파 페이드를 준다.
      체인 전체가 하나의 filter_complex 로 들어간다 — 한 번만 인코딩하므로
      패스를 쌓아 생기는 세대 손실이 없다.

   CRF 16, preset veryslow. 평평한 흰 판은 거의 공짜로 압축되고 비트는 가는
   치수선과 작은 숫자로 간다. 1440p 는 유튜브가 VP9 로 바꾸는 층이라
   1080p 로 보는 사람에게도 더 나은 스트림이 간다.

     node assemble_psc.js                                                    */
const fs = require('fs');
const cp = require('child_process');
const FF = require('ffmpeg-static');
const SP = __dirname;
const meta = JSON.parse(fs.readFileSync(SP + '/shots_psc.json', 'utf8'));
const SRC = SP + '/' + (meta.dir || 'src_psc');
const NORM = SP + '/norm_psc', SEQ = SP + '/seq_psc';
const W = meta.w || 2560, H = meta.h || 1440;
const FPS = meta.fps;

/* ---- 1. 정규화 ---- */
fs.rmSync(NORM, { recursive: true, force: true });
fs.mkdirSync(NORM, { recursive: true });
console.log('normalising ' + meta.shots.length + ' stills to ' + W + 'x' + H + ' ...');
// -start_number 는 바로 뒤 파일에만 걸리므로 입력·출력 양쪽에 필요하다.
// 출력에 안 주면 s0001 부터 쓰여 모든 컷이 한 칸씩 밀린 그림을 보여준다.
cp.execFileSync(FF, ['-hide_banner', '-loglevel', 'error',
  '-start_number', '0', '-i', SRC + '/s%04d.png',
  '-vf', 'scale=' + W + ':' + H + ':force_original_aspect_ratio=increase:flags=lanczos,' +
         'crop=' + W + ':' + H,
  '-start_number', '0', NORM + '/s%04d.png'], { stdio: 'inherit' });
const got = fs.readdirSync(NORM).length;
if (got !== meta.shots.length || !fs.existsSync(NORM + '/' + meta.shots[0].file))
  throw new Error('normalise produced ' + got + ' of ' + meta.shots.length + ' frames');

/* ---- 2. 시간 배치 ---- */
fs.rmSync(SEQ, { recursive: true, force: true });
fs.mkdirSync(SEQ, { recursive: true });
let k = 0, acc = 0;
meta.shots.forEach(s => {
  acc += s.dur;
  const want = Math.round(acc * FPS);            // 반올림 오차는 다음 홀드가 흡수한다
  const src = '../norm_psc/' + s.file;
  while (k < want) fs.symlinkSync(src, SEQ + '/f' + String(k++).padStart(5, '0') + '.png');
});
const DUR = k / FPS;
console.log(k + ' frames @ ' + FPS + ' fps = ' + DUR.toFixed(2) + ' s');

/* ---- 3. 자막 ---- */
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
fs.writeFileSync(SP + '/filter_psc.txt', parts.join(';'));

const OUT = SP + '/../PSC.mp4';
console.log('encoding ' + meta.caps.length + ' captions over ' + DUR.toFixed(1) + ' s ...');
cp.execFileSync(FF, ['-hide_banner', '-loglevel', 'error', '-y',
  ...inputs,
  '-filter_complex_script', SP + '/filter_psc.txt', '-map', '[vout]',
  '-t', DUR.toFixed(3),
  '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '16',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(FPS),
  OUT], { stdio: 'inherit' });

const sz = fs.statSync(OUT).size;
console.log('\n' + OUT);
console.log((sz / 1048576).toFixed(1) + ' MB  ·  ' + DUR.toFixed(1) + ' s  ·  ' +
            W + 'x' + H + ' @ ' + FPS + '  ·  CRF 16');
