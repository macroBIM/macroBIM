/* Does posing the scene keep the crane a crane?

   Four invariants must hold at EVERY pose, or the motion model is wrong:
     - the part count never changes            (no geometry is rebuilt)
     - the mast never moves                    (what is not driven stays put)
     - the rope's top end stays in the trolley (a joint's child follows its parent)
     - the rope's foot stays on the hook sheave
   and the slew must be an exact rotation, not something that merely looks like one.

   Run: node patch.js && node verify.js        Exits non-zero on any failure. */
const boot = require('./boot');
const crane = require('./crane');

const C  = b => [(b.min[0]+b.max[0])/2, (b.min[1]+b.max[1])/2, (b.min[2]+b.max[2])/2];
const d3 = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);
const fail = [];
const check = (name, got, want, tol) => {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) fail.push(`${name}: ${got} (want ${want} +/- ${tol})`);
  return ok;
};

(async () => {
  const { browser, page } = await boot.open(900, 520);
  await crane.install(page);

  const read = () => page.evaluate(() => ({
    n:    window.__count(),
    mast: window.__bboxOf("/MAST/.test(it.moduleId||'')"),
    rope: window.__bboxOf("/ROPE/.test(it.plateId||'')"),
    trly: window.__bboxOf("it.moduleId==='MD.TRLY'"),
    shv:  window.__bboxOf("/SHV/.test(it.plateId||'')"),      // the hook block's sheaves
    tip:  window.__anchorOf("it.moduleId==='MD.JTIP'"),      // an exact point, not a box
  }));

  await page.evaluate(() => window.__pose(0, 0, 0));
  const rest = await read();
  const restMast = C(rest.mast), restTip = rest.tip;
  const restFoot = d3([ (rest.rope.min[0]+rest.rope.max[0])/2,
                        (rest.rope.min[1]+rest.rope.max[1])/2, rest.rope.min[2] ], C(rest.shv));
  console.log(`rest: ${rest.n} parts, jib tip at (${restTip.map(Math.round)}), ` +
              `rope foot to sheave ${restFoot.toFixed(3)} mm\n`);

  const poses = [];
  for (let s = 0; s <= 180; s += 30) for (const tr of [0, -9000, 9000]) for (const h of [0, 5000, 11000])
    poses.push([s, tr, h]);
  console.log(`checking ${poses.length} poses ...`);

  const worst = { top: 0, foot: 0, mast: 0, tip: 0 };
  for (const [s, tr, h] of poses) {
    await page.evaluate(a => window.__pose(a[0], a[1], a[2]), [s, tr, h]);
    const r = await read();
    const rx = (r.rope.min[0]+r.rope.max[0])/2, ry = (r.rope.min[1]+r.rope.max[1])/2;
    const tc = C(r.trly);
    worst.top  = Math.max(worst.top,  Math.hypot(rx - tc[0], ry - tc[1]));
    worst.foot = Math.max(worst.foot, Math.abs(d3([rx, ry, r.rope.min[2]], C(r.shv)) - restFoot));
    worst.mast = Math.max(worst.mast, d3(C(r.mast), restMast));
    // the slew must land the jib tip exactly where a rotation about the mast would
    const a = s * Math.PI / 180, t = r.tip;
    const wx = restTip[0]*Math.cos(a) - restTip[1]*Math.sin(a);
    const wy = restTip[0]*Math.sin(a) + restTip[1]*Math.cos(a);
    worst.tip = Math.max(worst.tip, Math.hypot(t[0]-wx, t[1]-wy));
    if (r.n !== rest.n) fail.push(`part count changed at (${s},${tr},${h}): ${r.n} != ${rest.n}`);
  }

  console.log('\nworst over all poses (mm)');
  check('  rope top  <-> trolley centre ', worst.top,  0, 0.01);
  check('  rope foot <-> hook sheave    ', worst.foot, 0, 0.01);
  check('  mast drift from rest         ', worst.mast, 0, 1e-6);
  check('  jib tip vs exact rotation    ', worst.tip,  0, 0.01);
  for (const [k, v] of Object.entries(worst)) console.log(`  ${k.padEnd(6)} ${v.toFixed(6)}`);
  console.log(`  parts  ${rest.n} (unchanged)`);

  const ms = await page.evaluate(() => window.__benchPose(200));
  console.log(`\n  one re-pose of ${rest.n} instances: ${ms.toFixed(2)} ms  (${Math.round(1000/ms)} poses/s)`);

  await browser.close();
  if (fail.length) { console.error('\nFAIL\n  ' + fail.join('\n  ')); process.exit(1); }
  console.log('\nPASS');
})();
