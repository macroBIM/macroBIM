/* The two ways of naming a direction have to agree.

       node tools/check_view3d.js

   A view in the DXF export is three vectors - right, up and the direction the
   viewer stands in. Six of them are written out by name. A VIEW row can now
   also give two angles instead, and this asserts that the angles reproduce the
   six named vectors EXACTLY, component by component - not nearly, not to five
   places. If they only nearly agree then `VIEW M1 3D -90 0` and `VIEW M1 FRONT`
   draw two slightly different pictures of the same thing and nobody finds out
   until the two are laid on top of each other.

   The code under test is lifted out of plate_builder_test.js by text, not
   copied here. Copying it would mean this file keeps passing after the engine's
   own formula is changed, which is the one failure a check like this must not
   have. If the anchors ever stop matching, this exits non-zero rather than
   quietly testing nothing. */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'plate_builder_test.js');
const src = fs.readFileSync(SRC, 'utf8');

const OPEN = '  var DXF_VIEWS = [';
const CLOSE = "           Object.keys(DXF_ISO).join(' / ') + ' / 3D <AZ> <EL>';\n  }\n";
const a = src.indexOf(OPEN), b = src.indexOf(CLOSE);
if (a < 0 || b < 0) {
  console.error('check_view3d: could not find the view block in plate_builder_test.js.');
  console.error('  open anchor  ' + (a < 0 ? 'MISSING' : 'ok'));
  console.error('  close anchor ' + (b < 0 ? 'MISSING' : 'ok'));
  console.error('The engine moved; fix the anchors rather than deleting the check.');
  process.exit(2);
}
const block = src.slice(a, b + CLOSE.length);
// eslint-disable-next-line no-new-func
const M = new Function(block + '\n return {DXF_VIEWS, DXF_VIEW_KEY, DXF_ISO, ISO_EL,' +
                       ' viewFromAZEL, viewSpec, viewDirNames};')();

let bad = 0, checks = 0;
function ok(cond, what, got) {
  checks++;
  if (cond) return;
  bad++;
  console.log('  FAIL  ' + what + (got === undefined ? '' : '   got ' + JSON.stringify(got)));
}
const same = (p, q) => p.length === q.length && p.every((v, i) => v === q[i]);
const dot = (p, q) => p.reduce((s, v, i) => s + v * q[i], 0);
const len = p => Math.hypot.apply(Math, p);

/* ---- 1. the six named views, from angles, exactly ---- */
const TABLE = { FRONT: [-90, 0], RIGHT: [0, 0], BACK: [90, 0],
                LEFT: [180, 0], TOP: [0, 90], BOTTOM: [0, -90] };
console.log('the six named views, rebuilt from AZ / EL');
console.log('  key       AZ    EL    right          up             dir');
M.DXF_VIEWS.forEach(function (v) {
  const t = TABLE[v.key];
  ok(!!t, v.key + ' is missing from this check\'s table');
  if (!t) return;
  const w = M.viewFromAZEL(t[0], t[1]);
  const hit = same(w.right, v.right) && same(w.up, v.up) && same(w.dir, v.dir);
  ok(hit, v.key + ' from AZ ' + t[0] + ' EL ' + t[1],
     hit ? undefined : { right: w.right, up: w.up, dir: w.dir });
  console.log('  ' + v.key.padEnd(8) + String(t[0]).padStart(5) + String(t[1]).padStart(6) +
              '   ' + JSON.stringify(w.right).padEnd(14) + ' ' +
              JSON.stringify(w.up).padEnd(14) + ' ' + JSON.stringify(w.dir) +
              '   ' + (hit ? 'same' : 'DIFFERS'));
});

/* ---- 2. every direction is a proper picture frame ----
   Three unit vectors at right angles, with right = up x dir. Get this wrong
   and the drawing is mirrored or stretched, which reads as a real part. */
console.log('\nthe frame is orthonormal and right-handed, swept over the sphere');
for (let az = -180; az <= 180; az += 15) {
  for (let el = -90; el <= 90; el += 15) {
    const w = M.viewFromAZEL(az, el);
    const at = az + '/' + el;
    ok(Math.abs(len(w.dir) - 1) < 1e-12, 'dir is a unit vector at ' + at, len(w.dir));
    ok(Math.abs(len(w.up) - 1) < 1e-12, 'up is a unit vector at ' + at, len(w.up));
    ok(Math.abs(len(w.right) - 1) < 1e-12, 'right is a unit vector at ' + at, len(w.right));
    ok(Math.abs(dot(w.up, w.dir)) < 1e-12, 'up is square to dir at ' + at, dot(w.up, w.dir));
    ok(Math.abs(dot(w.right, w.dir)) < 1e-12, 'right is square to dir at ' + at);
    ok(Math.abs(dot(w.right, w.up)) < 1e-12, 'right is square to up at ' + at);
    const cx = [w.up[1] * w.dir[2] - w.up[2] * w.dir[1],
                w.up[2] * w.dir[0] - w.up[0] * w.dir[2],
                w.up[0] * w.dir[1] - w.up[1] * w.dir[0]];
    ok(cx.every((v, i) => Math.abs(v - w.right[i]) < 1e-12), 'right = up x dir at ' + at);
  }
}

/* ---- 3. the page stays upright ----
   The whole reason two angles are enough instead of three: up is world Z with
   the view direction taken out, so a column never leans on the paper. Above
   the pole Z has nothing left in the picture plane and north takes over. */
console.log('\nworld Z projects onto page up, so verticals stay vertical');
for (let az = -180; az <= 180; az += 15) {
  for (let el = -75; el <= 75; el += 15) {
    const w = M.viewFromAZEL(az, el);
    // world Z seen on the page: its right-component must be zero, up positive
    ok(Math.abs(dot([0, 0, 1], w.right)) < 1e-12,
       'world Z has no sideways component at ' + az + '/' + el, dot([0, 0, 1], w.right));
    ok(dot([0, 0, 1], w.up) > 0, 'world Z points up the page at ' + az + '/' + el);
  }
}
[[0, 90, 'TOP'], [0, -90, 'BOTTOM']].forEach(function (c) {
  const w = M.viewFromAZEL(c[0], c[1]);
  ok(same(w.up, [0, 1, 0]), 'at EL ' + c[1] + ' north is the up of the page (' + c[2] + ')', w.up);
});

/* ---- 4. the isometrics ---- */
console.log('\nthe isometric corners');
const R3 = 1 / Math.sqrt(3);
Object.keys(M.DXF_ISO).forEach(function (k) {
  const w = M.viewSpec(k, 0, 0);
  ok(!!w, k + ' resolves');
  if (!w) return;
  const equal = w.dir.every(v => Math.abs(Math.abs(v) - R3) < 1e-12);
  ok(equal, k + ' foreshortens all three axes alike', w.dir);
  console.log('  ' + k.padEnd(8) + ' AZ ' + String(M.DXF_ISO[k]).padStart(4) +
              '   dir ' + w.dir.map(v => v.toFixed(6)).join(', ') +
              '   ' + (equal ? 'isometric' : 'NOT ISOMETRIC'));
});
// ISO on its own must show the face FRONT shows: the viewer stands south of it
ok(M.viewSpec('ISO', 0, 0).dir[1] < 0,
   'plain ISO looks at the front, not the back', M.viewSpec('ISO', 0, 0).dir);
ok(M.viewSpec('ISO', 0, 0).dir[2] > 0, 'plain ISO looks down from above');
ok(same(M.viewSpec('ISO', 0, 0).dir, M.viewSpec('ISO-SE', 0, 0).dir),
   'ISO and ISO-SE are the same corner');

/* ---- 5. what the parser leans on ---- */
console.log('\nname resolution');
ok(M.viewSpec('FRONT', 0, 0) === M.DXF_VIEW_KEY.FRONT, 'a named view resolves to the named object');
ok(M.viewSpec('3D', -90, 0) !== null, '3D resolves');
ok(same(M.viewSpec('3D', -90, 0).dir, M.DXF_VIEW_KEY.FRONT.dir), '3D -90 0 is FRONT');
ok(M.viewSpec('SIDEWAYS', 0, 0) === null, 'a direction that is not one resolves to null');
ok(M.viewSpec('', 0, 0) === null, 'a blank direction resolves to null');
ok(M.viewDirNames().indexOf('3D <AZ> <EL>') >= 0, 'the warning text offers 3D');
ok(M.viewDirNames().indexOf('ISO-NE') >= 0, 'the warning text offers the isometrics');

console.log('\n' + checks + ' checks, ' + (bad ? bad + ' FAILED' : 'all passed'));
process.exit(bad ? 1 : 0);
