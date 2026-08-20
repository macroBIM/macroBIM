/* Redraw the two pictures the PARAM sheet carries. Needs playwright-core only
   to turn the SVG into a PNG; the drawing itself is plain string building.
     node mkcart.js        ->  cart_elev.png, cart_plan.png, cart_size.json    */
const fs = require('fs'); const { elevArt, planArt, V, ART_CSS } = require('./crane_art.js');
const EXTRA = `.ahid{stroke:#999;stroke-width:.9;stroke-dasharray:7 4}`;
const A = { elev: elevArt(V), plan: planArt(V, 40 * Math.PI / 180) };
const SC = 2;                                 // 2x, so it stays sharp in Excel
Object.keys(A).forEach(k => { const a = A[k];
  fs.writeFileSync(__dirname + '/cart_' + k + '.svg',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(a.w*SC)}" height="${Math.ceil(a.h*SC)}" viewBox="0 0 ${a.w} ${a.h}"><style>${ART_CSS}${EXTRA}</style><rect width="100%" height="100%" fill="#fff"/>${a.svg}</svg>`);
  console.log(k, Math.round(a.w), Math.round(a.h)); });
fs.writeFileSync(__dirname + '/cart_size.json', JSON.stringify(
  Object.fromEntries(Object.keys(A).map(k => [k, { w: A[k].w, h: A[k].h }]))));
