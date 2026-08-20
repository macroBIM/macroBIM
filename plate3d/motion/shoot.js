/* The film: the crane picks up, slews 130 degrees, draws the load in, lifts.
   Four moves - the same four DRIVE rows MOTION.md section 4 writes as cells.

   Run: node patch.js && node shoot.js
   Then assemble with assemble.sh, which knows the quirks of the ffmpeg
   Playwright ships: VP8 only, no image2 demuxer, and it will not read a
   pattern - the frames have to arrive as one concatenated mjpeg stream. */
const fs = require('fs');
const boot = require('./boot');
const crane = require('./crane');
const seg = boot.seg;
const OUT = __dirname + '/frames';
const FPS = 24, N = 216;                       // 9 s

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const { browser, page } = await boot.open(1600, 900);
  await crane.install(page);

  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const hoist   = 11000 * seg(t, 0.04, 0.26) - 9000 * seg(t, 0.34, 0.52) + 9500 * seg(t, 0.78, 0.97);
    const slew    = 130 * seg(t, 0.36, 0.74);
    const trolley = -9000 * seg(t, 0.44, 0.70);          // draws the load in toward the mast
    await page.evaluate(a => window.__pose(a[0], a[1], a[2]), [slew, trolley, hoist]);
    await page.evaluate(a => window.__aim(4000, 4000, 21000, 118000, -46 + a * 10, 13 - a * 2), t);
    const d = await page.evaluate(() => window.__grab(0.9));
    fs.writeFileSync(`${OUT}/f${String(i).padStart(4, '0')}.jpg`, Buffer.from(d.split(',')[1], 'base64'));
    if (i % 36 === 0) console.log(`  ${i}/${N}  slew ${slew.toFixed(0)}  trolley ${trolley.toFixed(0)}  hoist ${hoist.toFixed(0)}`);
  }
  console.log(`  ${N} frames at ${FPS} fps in ${((Date.now()-t0)/1000).toFixed(0)} s -> ${OUT}`);
  await browser.close();
})();
