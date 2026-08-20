/* The two pictures the crane PARAM sheet carries: an elevation with every cell
   on the sheet dimensioned where it actually acts, and a plan for the slew.
   Drawn from the same numbers the sheet holds, so the picture cannot say one
   thing while the cells say another. */
const E = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const f = n => Number(n).toFixed(1);

const V = { MB:2400, NM:15, Z0:1000, HEAD:9630, MH:800,
            JBAY:3000, NJ:15, JX0:1900, JTIPL:1600, JD:1500,
            CBAY:2600, NC:5, CX0:-1900, CD:1200,
            TRX:30000, DROP:26020 };
function derive(P) {
  const MTOP = P.Z0 + P.MB * P.NM, DKT = MTOP + 330, HEADZ = MTOP + 370;
  const APEX = HEADZ + P.HEAD, PIN = APEX + 520, TOP = APEX + 860;
  const JEND = P.JX0 + P.JBAY * P.NJ, JTIP = JEND + P.JTIPL;
  const CEND = P.CX0 - P.CBAY * P.NC;
  const JBC = MTOP + 1140, JTZ = JBC + P.JD, TRZ = JTZ + 380;
  const HOOK = TRZ - P.DROP;
  return { MTOP, DKT, HEADZ, APEX, PIN, TOP, JEND, JTIP, CEND, JBC, JTZ, TRZ, HOOK };
}

/* ---------------- 1. elevation ---------------- */
function elevArt(P) {
  const D = derive(P), o = [];
  const s = 0.0126, LM = 168, RM = 132, TM = 54, BM = 108;
  const W = LM + (D.JTIP - D.CEND) * s + RM, H = TM + D.TOP * s + BM;
  const X = v => LM + (v - D.CEND) * s, Y = v => TM + (D.TOP - v) * s;
  const ln = (a, b, c, d, cl) => o.push(`<line class="${cl || 'aln'}" x1="${f(a)}" y1="${f(b)}" x2="${f(c)}" y2="${f(d)}"/>`);
  const L = (x1, z1, x2, z2, cl) => ln(X(x1), Y(z1), X(x2), Y(z2), cl);
  const rc = (x, z, w, h, cl) => o.push(`<rect class="${cl || 'stl'}" x="${f(X(x))}" y="${f(Y(z + h))}" width="${f(w * s)}" height="${f(h * s)}"/>`);
  const t = (x, y, str, cl, a) => o.push(`<text class="${cl || 'al'}" x="${f(x)}" y="${f(y)}" text-anchor="${a || 'start'}">${E(str)}</text>`);
  const hd = (x, y, ux, uy) => { const l = 7, w = 2.6;
    o.push(`<polygon class="ahd" points="${f(x)},${f(y)} ${f(x - ux * l - uy * w)},${f(y - uy * l + ux * w)} ${f(x - ux * l + uy * w)},${f(y - uy * l - ux * w)}"/>`); };
  // a dimension with arrowheads, horizontal or vertical, in screen space
  function dimH(x1, x2, y, txt, key, side) {
    ln(x1, y, x2, y, key ? 'adimk' : 'adim'); hd(x1, y, -1, 0); hd(x2, y, 1, 0);
    // side: the label sits beyond the right-hand arrow instead of over the line,
    // for a dimension short enough that its text would land on the steel
    if (side) t(x2 + 8, y + 4, txt, key ? 'ak' : 'al', 'start');
    else t((x1 + x2) / 2, y - 6, txt, key ? 'ak' : 'al', 'middle');
  }
  function dimV(y1, y2, x, txt, key) {
    ln(x, y1, x, y2, key ? 'adimk' : 'adim'); hd(x, y1, 0, -1); hd(x, y2, 0, 1);
    o.push(`<text class="${key ? 'ak' : 'al'}" x="${f(x - 5)}" y="${f((y1 + y2) / 2)}" text-anchor="middle" transform="rotate(-90 ${f(x - 5)} ${f((y1 + y2) / 2)})">${E(txt)}</text>`);
  }
  const ext = (z, x1, x2) => ln(X(x1), Y(z), X(x2), Y(z), 'aext');

  /* ground */
  const g0 = X(D.CEND) - 40, g1 = X(D.JTIP) + 30;
  ln(g0, Y(0), g1, Y(0), 'aln');
  for (let x = g0; x < g1; x += 13) ln(x, Y(0), x - 7, Y(0) + 7, 'aext');

  /* base and mast */
  rc(-2600, -700, 5200, 700, 'stl');
  L(-2600, 0, -P.MH, P.Z0); L(2600, 0, P.MH, P.Z0);
  for (let i = 0; i < P.NM; i++) {
    const z = P.Z0 + i * P.MB;
    L(-P.MH, z, P.MH, z); L(-P.MH, z, P.MH, z + P.MB); L(P.MH, z, -P.MH, z + P.MB);
  }
  L(-P.MH, P.Z0, -P.MH, D.MTOP); L(P.MH, P.Z0, P.MH, D.MTOP);
  L(-P.MH, D.MTOP, P.MH, D.MTOP);

  /* slew bearing and deck */
  rc(-1200, D.MTOP + 60, 2400, 240, 'spl');
  rc(-2300, D.DKT, 4600, 700, 'stl');

  /* tower head */
  L(-P.MH, D.HEADZ, -250, D.APEX); L(P.MH, D.HEADZ, 250, D.APEX);
  L(-250, D.APEX, 250, D.APEX);
  [0.28, 0.55, 0.80].forEach(k => {
    const z = D.HEADZ + (D.APEX - D.HEADZ) * k, w = P.MH + (250 - P.MH) * k;
    L(-w, z, w, z);
  });
  rc(-450, D.APEX, 900, 100, 'stl');

  /* jib */
  L(P.JX0, D.JBC, D.JEND, D.JBC); L(P.JX0, D.JTZ, D.JEND, D.JTZ);
  for (let i = 0; i <= P.NJ; i++) { const x = P.JX0 + i * P.JBAY;
    L(x, D.JBC, x, D.JTZ);
    if (i < P.NJ) { L(x, D.JBC, x + P.JBAY, D.JTZ); } }
  L(D.JEND, D.JBC, D.JTIP, D.JTZ); L(D.JEND, D.JTZ, D.JTIP, D.JTZ);

  /* counter-jib and counterweight */
  L(P.CX0, D.JBC, D.CEND, D.JBC); L(P.CX0, D.JBC + P.CD, D.CEND, D.JBC + P.CD);
  for (let i = 0; i <= P.NC; i++) { const x = P.CX0 - i * P.CBAY;
    L(x, D.JBC, x, D.JBC + P.CD);
    if (i < P.NC) L(x, D.JBC, x - P.CBAY, D.JBC + P.CD); }
  rc(D.CEND + 200, D.JBC - 2400, 2100, 1500, 'spl');
  L(D.CEND + 1250, D.JBC - 900, D.CEND + 1250, D.JBC);
  rc(-8900, D.JBC + P.CD, 5200, 220, 'stl');

  /* pendants */
  const PJ1 = P.JX0 + P.JBAY * Math.round((P.NJ - 2) / 2), PJ2 = D.JEND - 1500;
  const PZ = D.JTZ + 560;
  L(0, D.PIN, PJ1, PZ, 'aln'); L(PJ1, PZ, PJ2, PZ, 'aln');
  L(0, D.PIN, D.CEND + 1200, D.JBC + P.CD + 350, 'aln');
  o.push(`<circle class="abolt" cx="${f(X(0))}" cy="${f(Y(D.PIN))}" r="4"/>`);

  /* trolley, rope, hook */
  rc(P.TRX - 700, D.TRZ - 200, 1400, 500, 'spl');
  L(P.TRX, D.TRZ - 200, P.TRX, D.HOOK, 'aln');
  rc(P.TRX - 600, D.HOOK - 500, 1200, 500, 'spl');
  L(P.TRX, D.HOOK - 500, P.TRX, D.HOOK - 1910, 'aln');
  o.push(`<circle class="abolt" cx="${f(X(P.TRX))}" cy="${f(Y(D.HOOK - 1910))}" r="5"/>`);

  /* ---- dimensions: the blue cells ---- */
  const DXL = X(D.CEND) - 118, DXL2 = X(D.CEND) - 62;
  ext(0, D.CEND, D.CEND - 9000); ext(P.Z0, -P.MH, D.CEND - 9000);
  ext(D.MTOP, -P.MH, D.CEND - 9000); ext(D.APEX, -250, D.CEND - 9000);
  ext(D.TOP, -450, D.CEND - 9000); ext(D.DKT, -2300, D.CEND - 9000);
  dimV(Y(P.Z0), Y(0), DXL2, 'Foot lvl', 1);
  ext(P.Z0 + P.MB, P.MH, 4200); ext(P.Z0, P.MH, 4200);
  dimV(Y(P.Z0 + P.MB), Y(P.Z0), X(P.MH) + 34, 'Panel ht', 1);
  dimV(Y(D.MTOP), Y(P.Z0), DXL, 'Panel ht x Panels', 1);
  dimV(Y(D.APEX), Y(D.DKT), DXL2, 'A-frame ht', 1);
  dimV(Y(D.TOP), Y(0), DXL - 56, 'Overall', 0);

  /* levels on the right */
  const RX = X(D.JTIP) + 16;
  [[D.MTOP, 'Mast top', D.JEND], [D.APEX, 'Apex', 250], [D.TOP, 'Overall top', 450],
   [D.JBC, 'Bottom chord', D.JTIP]].forEach(q => {
    ln(X(q[2]), Y(q[0]), RX - 6, Y(q[0]), 'ald');
    t(RX, Y(q[0]) + 4, q[1], 'am');
  });

  /* radii along the bottom */
  const BY = Y(0) + 40, BY2 = Y(0) + 74;
  [[D.CEND, 'x'], [0, 'x'], [P.TRX, 'x'], [D.JEND, 'x'], [D.JTIP, 'x']].forEach(q =>
    ln(X(q[0]), Y(0), X(q[0]), BY2 + 6, 'aext'));
  dimH(X(D.CEND), X(0), BY, 'Tail radius', 0);
  dimH(X(0), X(P.TRX), BY, 'Trolley R', 1);
  dimH(X(0), X(D.JTIP), BY2, 'Radius  =  Root + Bay x Bays + Tip', 0);

  /* jib bay call-outs */
  ln(X(P.JX0), Y(D.JTZ), X(P.JX0), Y(D.JTZ) - 34, 'aext');
  ln(X(P.JX0 + P.JBAY), Y(D.JTZ), X(P.JX0 + P.JBAY), Y(D.JTZ) - 34, 'aext');
  dimH(X(P.JX0), X(P.JX0 + P.JBAY), Y(D.JTZ) - 26, 'Bay', 1);
  t(X(P.JX0 + P.JBAY * 4), Y(D.JTZ) - 30, 'x  Bays', 'ak');
  ln(X(D.JEND), Y(D.JTZ), X(D.JEND), Y(D.JTZ) - 34, 'aext');
  ln(X(D.JTIP), Y(D.JTZ), X(D.JTIP), Y(D.JTZ) - 34, 'aext');
  dimH(X(D.JEND), X(D.JTIP), Y(D.JTZ) - 26, 'Tip', 1);
  ln(X(0), Y(D.JBC), X(0), Y(D.JBC) + 30, 'aext');
  ln(X(P.JX0), Y(D.JBC), X(P.JX0), Y(D.JBC) + 30, 'aext');
  dimH(X(0), X(P.JX0), Y(D.JBC) + 22, 'Root', 1, 1);

  /* hoist */
  const HX = X(P.TRX) + 40;
  ln(X(P.TRX), Y(D.TRZ), HX + 6, Y(D.TRZ), 'aext');
  ln(X(P.TRX), Y(D.HOOK), HX + 6, Y(D.HOOK), 'aext');
  dimV(Y(D.TRZ), Y(D.HOOK), HX, 'Hook drop', 1);
  dimV(Y(D.HOOK - 1910), Y(0), HX, 'Ground clr', 0);

  t(LM - 150, TM - 22, 'ELEVATION  —  where each blue cell acts', 'atit');
  t(LM - 150, H - 22, 'Head ht is measured from the deck to the apex, not from the ground: ' +
    'the A-frame keeps its shape at any tower height.', 'anote');
  return { svg: o.join(''), w: W, h: H };
}

/* ---------------- 2. plan, for the slew ---------------- */
function planArt(P, ang) {
  const D = derive(P), o = [];
  const R = D.JTIP, s = 0.0044, C = R * s + 74, W = C * 2, H = C * 2 + 44;
  const X = (x, y) => C + (x * Math.cos(ang) - y * Math.sin(ang)) * s;
  const Y = (x, y) => C + 30 - (x * Math.sin(ang) + y * Math.cos(ang)) * s;
  const ln = (a, b, c, d, cl) => o.push(`<line class="${cl || 'aln'}" x1="${f(a)}" y1="${f(b)}" x2="${f(c)}" y2="${f(d)}"/>`);
  const L = (x1, y1, x2, y2, cl) => ln(X(x1, y1), Y(x1, y1), X(x2, y2), Y(x2, y2), cl);
  const t = (x, y, str, cl, a) => o.push(`<text class="${cl || 'al'}" x="${f(x)}" y="${f(y)}" text-anchor="${a || 'middle'}">${E(str)}</text>`);

  o.push(`<circle class="aext" style="fill:none" cx="${f(C)}" cy="${f(C + 30)}" r="${f(R * s)}"/>`);
  // world axes, which do not turn
  ln(C, C + 30, C + R * s + 26, C + 30, 'acent');
  ln(C, C + 30, C, C + 30 - (R * s + 26), 'acent');
  t(C + R * s + 34, C + 34, '+X', 'acl'); t(C + 12, C + 30 - R * s - 30, '+Y', 'acl');

  // the jib, and everything that turns with it
  L(P.JX0, -650, D.JEND, -650); L(P.JX0, 650, D.JEND, 650);
  L(D.JEND, -650, D.JTIP, -160); L(D.JEND, 650, D.JTIP, 160);
  L(D.JTIP, -160, D.JTIP, 160);
  for (let i = 0; i <= P.NJ; i++) { const x = P.JX0 + i * P.JBAY; L(x, -650, x, 650); }
  L(P.CX0, -650, D.CEND, -650); L(P.CX0, 650, D.CEND, 650);
  L(D.CEND, -650, D.CEND, 650);
  for (let i = 0; i <= P.NC; i++) { const x = P.CX0 - i * P.CBAY; L(x, -650, x, 650); }
  L(D.CEND + 200, -750, D.CEND + 200, 750); L(D.CEND + 1100, -750, D.CEND + 1100, 750);
  L(D.CEND + 200, -750, D.CEND + 1100, -750); L(D.CEND + 200, 750, D.CEND + 1100, 750);
  // mast, which does not
  const m = P.MH * 1.0;
  o.push(`<rect class="stl" x="${f(C - m * s)}" y="${f(C + 30 - m * s)}" width="${f(2 * m * s)}" height="${f(2 * m * s)}"/>`);
  // trolley
  o.push(`<circle class="abolt" cx="${f(X(P.TRX, 0))}" cy="${f(Y(P.TRX, 0))}" r="4.5"/>`);
  // clear of the jib it sits on: step off perpendicular to the jib axis
  t(X(P.TRX, 3400), Y(P.TRX, 3400), 'trolley', 'am');

  // the angle itself
  const r0 = R * s * 0.42;
  const sweep = ang > Math.PI ? 1 : 0;
  o.push(`<path class="adimk" style="fill:none" d="M ${f(C + r0)} ${f(C + 30)} A ${f(r0)} ${f(r0)} 0 ${sweep} 0 ${f(C + r0 * Math.cos(ang))} ${f(C + 30 - r0 * Math.sin(ang))}"/>`);
  const ha = ang / 2;
  t(C + (r0 + 34) * Math.cos(ha), C + 34 - (r0 + 34) * Math.sin(ha), 'Jib angle', 'ak');
  ln(C, C + 30, C + (r0 + 12) * Math.cos(ang), C + 30 - (r0 + 12) * Math.sin(ang), 'ald');

  t(C, 20, 'PLAN  —  the jib turns, the mast stays put', 'atit');
  t(C, H - 8, '0 deg is the jib along +X.  The base and the mast never move.', 'anote');
  return { svg: o.join(''), w: W, h: H };
}

/* the same pen as the splice book's drawings, so the two sheets look alike */
const ART_CSS=`
.stl{fill:#d7dde3;stroke:#333;stroke-width:1.1}
.spl{fill:#e3eefb;stroke:#1d4ed8;stroke-width:1.4}
.aln{stroke:#333;stroke-width:1}.adim{stroke:#333;stroke-width:1}.adimk{stroke:#b45309;stroke-width:1.5}
.aext{stroke:#aaa;stroke-width:.9}.alead{stroke:#b45309;stroke-width:1}.ahd{fill:#333}
.ald{stroke:#888;stroke-width:.9}.adot{fill:#888}
.acent{stroke:#d33;stroke-width:1;stroke-dasharray:12 4 3 4}
.abolt{fill:#fff;stroke:#333;stroke-width:1.2}
.al{font-size:12px;fill:#333}.ak{font-size:12px;fill:#b45309;font-weight:700}
.am{font-size:11px;fill:#666}.acl{font-size:10.5px;fill:#d33}
.asym{font-size:10.5px;fill:#aaa;font-style:italic}.anote{font-size:11.5px;fill:#777;font-style:italic}
.atit{font-size:14px;fill:#0f172a;font-weight:700}
text{font-family:Arial,Helvetica,sans-serif}`;
module.exports = { elevArt, planArt, V, derive, ART_CSS };
