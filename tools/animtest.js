/*  폐합철근이 한 번에 앉지 않고 걸음마다 자라는지 — 걸음 수별로 재 본다.
    (Konva 는 없으니 좌표만 본다. 화면에서 보이는 것이 이 숫자다.)          */
const lib = require('./probe_lib.js');
const P = lib.P;
P._loadCrebarFromExcel(lib.EL && null || require('fs').existsSync('s15_input.json')
  ? JSON.parse(require('fs').readFileSync('s15_input.json','utf8')) : []);
lib.mkEl('diaThk_s').value = '2000';
const n = P._settleHoops();
console.log('\n만들어진 작업 ' + n + ' 개 (아직 아무도 안 걸었다)');
let TICK = 0;
function snap(tag) {
  const h = P._syncHoops();
  const formed = h.filter(o => o.state === 'FORMED').length;
  console.log('  ' + tag.padEnd(12) + '보이는 가닥 ' + String(h.length).padStart(3) +
    ' · 그중 FORMED ' + String(formed).padStart(3) + '/' + (P._hoopJobs||[]).length);
}
snap('0 프레임');
[5, 20, 50, 80, 110, 140].forEach(function (upto) {
  while (TICK < upto) { P._stepHoopJobs(6, TICK); TICK++; }
  snap(upto + ' 프레임');
});
console.log('\n  (16 ms 프레임이므로 ' + TICK + ' 프레임 = 약 ' + (TICK*16/1000).toFixed(1) + ' 초)');
