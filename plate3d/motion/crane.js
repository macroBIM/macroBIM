/* PLATE3D_TOWER.xlsx as a kinematic tree, written the way MOTION.md proposes
   and then spelled out by hand because the engine cannot read those rows yet.
   Every number here was read off the model with measure.

       BODY   b.turn   AS.TURN AS.JIB AS.CJIB AS.TIE
       BODY   b.trly   MD.TRLY
       BODY   b.hook   MD.HOOK
       JOINT  j.slew   REV  b.turn          0     0  37035  Z
       JOINT  j.trly   PRI  b.trly  b.turn  30000 0  39800  X
       JOINT  j.hoist  PRI  b.hook  b.trly  30000 0  15020  Z
       FIT    bar.rope_1..4   b.hook  b.trly

   The rope is the interesting one. The sheet already draws four falls as
   coordinate-placed bars from the hook sheave up to the trolley, so the whole
   of FIT here is a scale along the bar's own axis about the trolley sheave
   plane - exact for a round bar, and it keeps the top end pinned. */
exports.ZTOP = 39960;                 // trolley sheave, world Z at rest
exports.ZSHV = 14820;                 // hook sheave, world Z at rest
exports.L0   = exports.ZTOP - exports.ZSHV;

exports.install = page => page.evaluate(a => {
  const [ZTOP, L0] = a;
  const rope   = it => /ROPE/.test(it.plateId);
  const turn   = it => /AS\.(TURN|JIB|CJIB|TIE|HOIST)/.test(it.group);
  /* slew   deg, + is counter-clockwise seen from above
     trolley mm, + runs out toward the jib tip
     hoist   mm, + lowers the hook                        all zero = the sheet's own pose */
  window.__pose = (slew, trolley, hoist) => window.__motion([
    { test: it => it.group === 'AS.HOIST',                    mat: () => window.__move(trolley, 0, 0) },
    { test: it => it.moduleId === 'MD.HOOK' && !rope(it),     mat: () => window.__move(0, 0, -hoist) },
    { test: rope,                                             mat: () => window.__stretchZ(ZTOP, (L0 + hoist) / L0) },
    { test: turn,                                             mat: () => window.__spin(0, 0, slew) },
  ]);
}, [exports.ZTOP, exports.L0]);
