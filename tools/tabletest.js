/*  physics 아래 표에 폐합철근 줄이 들어가는지 — 요소를 흉내 내 HTML 을 본다. */
const lib = require('./probe_lib.js');
const P = lib.P;
const hoops = lib.runHoops();
const cell = lib.mkEl('physTblBody');       // document.getElementById 가 이걸 돌려준다
P._hoops = hoops;
P._renderPhysicsTable();
const txt = cell.innerHTML || '';
const rows = (txt.match(/<tr/g) || []).length;
console.log('\n표 행 수 :', rows);
txt.split('</tr>').forEach(s => {
  if (!s.includes('<td')) return;
  console.log('   ' + s.replace(/<[^>]+>/g, ' | ').replace(/\s*\|\s*(\|\s*)+/g, ' | ').replace(/\s+/g, ' ').trim());
});
