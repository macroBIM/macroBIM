/*  tools/check_freeze.js — **J 엔진 동결 확인** (블라인드 검증 기간)
 *
 *  검증 단면(격벽 · I형 거더 …)을 돌리는 동안 `jfield.js` · `jlong.js` 는 동결 커밋과
 *  같아야 한다. 새 단면에서 결함이 나오면 그 자리에서 고치지 않고 **실패로 기록**한다
 *  (STATUS 「엔진 동결」). 고치는 것은 판을 다 돌린 뒤다.
 *
 *    node tools/check_freeze.js        같으면 0, 다르면 1
 */
'use strict';
const { execSync } = require('child_process');
const path = require('path');
const FROZEN = '012ae5c';
const FILES = ['jfield.js', 'jlong.js'];
const ROOT = path.join(__dirname, '..');
let bad = 0;
FILES.forEach(f => {
    const d = execSync(`git diff --stat ${FROZEN} -- ${f}`, { cwd: ROOT }).toString().trim();
    if (d) { bad++; console.log(`  ✗ ${f} 가 동결 커밋 ${FROZEN} 과 다르다\n${d}`); }
    else console.log(`  ✓ ${f} = ${FROZEN}`);
});
process.exit(bad ? 1 : 0);
