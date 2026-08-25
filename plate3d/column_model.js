/* PLATE3D COLUMN — the model, and only the model.

   Two things build this column: the generator that writes
   PLATE3D_COLUMN.xlsx, and the QuickPlate3D form that builds it in a browser
   with no workbook at all. They must agree exactly, and the only way to be
   sure of that is for there to be one copy of the arithmetic rather than two
   that look alike. This is that copy.

   What lives here: the defaults, everything derived from them, and the rows
   the engine reads. What does not: anything that knows about a file. The
   catalogues are handed in - Node reads them off disk, a browser fetches them
   - and the PARAM sheet's layout, styling and dropdowns stay in the
   generator, because only a workbook has those.

   Each row carries BOTH forms, because a cell in the input tab is a formula
   with its last result cached beside it:

       { f: 'IF(PARAM!$C$6="H",...)', v: 300 }

   The generator writes both, so the workbook stays live when you edit PARAM.
   The browser reads `v` and throws `f` away, because there is nothing to
   recalculate - the values were just computed here. One definition, two
   readers: a formula and the number it must produce cannot drift apart,
   because they are written on the same line.

   build(V, cat) -> { V, D, R, K, F, rows, ... }
     V    the inputs, as `defaults()` returns them, edited to taste
     cat  { HS, TB, findH, findT } - the H and tube catalogues
     rows [{ cells, comment }] in input-tab order

   `values(rows)` flattens those to the plain array of arrays the engine takes.
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.columnModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var USER = 'user define';              // the first entry of either catalogue

  /* The inputs, and everything that follows from them. `env` carries the same
     overrides the generator takes from the shell - CTYPE, COLSEC, CALPHA,
     UDEF, BMC, BML - so a browser can set them just as a command line can,
     and neither has a switch the other lacks. */
  function defaults(env, cat) {
    env = env || {};
    var process = { env: env };            // the generator's overrides, portable
    var findH = cat.findH, findT = cat.findT;
    /* UDEF=h,b,tw,tf,r writes the sheet the way a person leaves it after
       picking "user define" and typing over the five cells: the Section name
       is the list's own first entry, and the dimensions are literals rather
       than a VLOOKUP. It is the only honest way to test that path - editing a
       finished file cannot, because the input tab's IF formulas would need
       recalculating and only Excel does that. */
    var UDEF = process.env.UDEF ? process.env.UDEF.split(',').map(Number) : null;
    /* ---------- what the sheet opens with ---------- */
    const TYPE = process.env.CTYPE === 'R' ? 'R' : 'H';
    const V = {
      type: TYPE,
      sec: TYPE === 'R' ? (process.env.COLSEC || 'R-300x300x12 r30')
                        : (process.env.COLSEC || 'H-300x300x10x15 r18'),
      up: 700, mid: 1400, dn: 700,
      steel: 'SS275',
      /* the splice, written the way PLATE3D_SPLICE.xlsx writes one: plates by
         width/length/thickness, bolts by a count with a gap in the middle and an
         edge distance at the ends. A column splice is symmetric, so where the
         beam sheet has a Top flange row and a Bottom flange row this has one. */
      /* 0, because a column splice bears. The upper piece sits on the lower
         one - gravity does not offer the choice - so the ends are finished
         and butted, and the plates hold it in line and take tension and shear
         rather than the load. 10 came from PLATE3D_SPLICE.xlsx, where it is
         right: a BEAM splice has nothing underneath it and takes a root gap.
         Copying it here put the upper column 10mm in the air.
         Leave the field: a shim or a division plate between the pieces is a
         real detail, and then its thickness is what goes here. */
      gap: 0, cpL: 330,
      foW: 300, foT: 12,                       // flange plate, outer
      fiW: 110, fiT: 10,                       // flange plate, inner - two per flange
      wpW: 234, wpT: 10,                       // web plate - two
      fNL: 4, fIL: 70, fOL: 45,                // flange group: along the column
      fNT: 4, fIT: 100, fOT: 40,               //               across the flange
      wNL: 4, wIL: 60, wOL: 45,                // web group: along the column
      wNT: 3, wIT: 0,  wOT: 40,                //            through the web depth
      alpha: Number(process.env.CALPHA || 0),  // spin the whole column about Z
      epT: 20, epOV: 60,                       // end plate thickness and overhang
      eNX: 3, eOX: 30, eNY: 3, eOY: 30,        // its bolts, one ring round the wall
      dia: 16, grade: 'F10T',
      /* the beams. Four of them, named for the world direction they run in -
         X+ X- Y+ Y- - because a beam follows the building grid and the column is
         turned to suit it, not the other way round. Length 0 and that beam is not
         there, the same switch the column pieces use. Beams are H only: a tube
         beam would have no web to bolt through and nothing to weld a fin to. */
      bmSec: 'H-300x150x6.5x9 r13',
      bmL: (process.env.BML || "900,900,900,0").split(",").map(Number),                 // X+  X-  Y+  Y-
      /* Which connection each beam uses, by mark. A beam names one; the library
         below says what that mark is. */
      bmC: (process.env.BMC || 'C1,C3,C3,C3').split(','),   // X+  X-  Y+  Y-
      /* THE CONNECTION LIBRARY. Six marks, declared once and picked by name, the
         way a shop drawing calls up C1 rather than describing the detail again at
         every beam. The mark carries no meaning of its own - the Type cell beside
         it says whether it is a fin or an end plate, and the note says it in
         words - which is exactly why a mark survives being re-tuned: change C3
         from a fin to an end plate and "C3" is still true, where "FIN-A" would
         have become a lie.

         End plate bolts through the column; fin plate is welded to it and bolts
         through the BEAM'S web instead - the one that works on a tube, because
         nothing has to reach inside the wall.

         Every type takes the same seven numbers, which is what lets one row shape
         serve them all: how far the beam stops short, the plate's width and
         thickness, and a bolt group as a gauge, an edge distance, a pitch and a
         count. Width 230, not 300, on an end plate: one plate serves all four
         faces and a beam on the WEB face has to fit between the flanges -
         h - 2tf - 2r, which is 234 on the default column. */
      conn: [
        { m: 'C1', t: 'end plate', d: '3 rows, through the col',
          sb: 0,  w: 230, th: 20, g: 140, e: 45, p: 70, n: 3 },
        { m: 'C2', t: 'end plate', d: '4 rows, for a deep beam',
          sb: 0,  w: 230, th: 20, g: 140, e: 45, p: 70, n: 4 },
        { m: 'C3', t: 'fin plate', d: '3 bolts through the web',
          sb: 10, w: 140, th: 10, g: 60,  e: 45, p: 70, n: 3 },
        { m: 'C4', t: 'fin plate', d: '4 bolts through the web',
          sb: 10, w: 140, th: 10, g: 60,  e: 45, p: 70, n: 4 },
        { m: 'C5', t: 'fin plate', d: '2 bolts, a thinner fin',
          sb: 10, w: 120, th: 9,  g: 55,  e: 40, p: 60, n: 2 },
        { m: 'C6', t: '', d: 'spare — set a Type',
          sb: 0,  w: 0,   th: 0,  g: 0,   e: 0,  p: 0,  n: 0 }
      ]
    };
    /* Column D is 26 characters wide and its neighbour is never empty, so Excel
       CLIPS a longer note rather than spilling it. Catch that here: a truncated
       explanation is worse than none, and it is invisible in the generator. */
    V.conn.forEach(x => { if (x.d.length > 25)
      throw new Error('connection note clipped at 26: ' + x.m + ' ' + x.d.length); });

    return V;
  }

  /* Everything that follows from V. Split out of defaults() because a form
     edits V after the fact: leave the derivation where it stood and a sheet
     whose section had changed would keep the old section's bolt lengths and
     face offsets, and every one of those numbers would still look plausible.

     Called twice on purpose - once by defaults(), because the stiffener
     offsets it fills in are a beam's flange height and so need D, and again
     by build() against whatever V it is actually handed. */
  function derive(V, cat) {
    var findH = cat.findH, findT = cat.findT;
    var UDEF = V.udef || null;
    var CONNT = ['end plate', 'fin plate'];
    var up5 = function (x) { return Math.ceil(x / 5) * 5; };
    var rnd = function (x) { return +(+x).toFixed(4); };

    /* The engine reads what a formula LAST EVALUATED TO, not the formula, so the
       cached results below have to follow Type. A generator that always caches
       the H branch ships a tube that loads as an H, which is what happened the
       first time this was tested. */
    const H = V.type === 'H';
    const SEC = UDEF ? [USER].concat(UDEF).concat([0])
                     : (H ? findH(V.sec) : findT(V.sec));
    if (UDEF) V.sec = USER;
    V.udef = UDEF;
    const D = {};
    D.h = SEC[1]; D.b = SEC[2]; D.tw = SEC[3]; D.tf = SEC[4]; D.r = SEC[5]; D.kg = SEC[6];
    D.hole = V.dia + 2;
    D.nut = 0.9 * V.dia;
    /* Pitch the way the splice sheet works it out: a run that is halved about the
       joint - or about the web - gets pHalf, and the one run that goes straight
       through gets pFull. Same two lines, same meaning, so a reader of one sheet
       is a reader of both. */
    const pHalf = (W, N, I, O) => (N / 2 <= 1 ? 0 : (W / 2 - O - I / 2) / (N / 2 - 1));
    const pFull = (W, N, I, O) => (N <= 1 ? 0 : (W - 2 * O - I) / (N - 1));
    D.pFL = pHalf(V.cpL, V.fNL, V.fIL, V.fOL);      // flange, along the column
    D.pFT = pHalf(V.foW, V.fNT, V.fIT, V.fOT);      // flange, across
    D.pWL = pHalf(V.cpL, V.wNL, V.wIL, V.wOL);      // web, along
    D.pWT = pFull(V.wpW, V.wNT, V.wIT, V.wOT);      // web, through the depth
    D.fiY = V.fIT / 2 + D.pFT / 2;                  // inner plate, on its own two lines
    D.gripF = V.foT + D.tf + V.fiT;
    D.gripW = D.tw + 2 * V.wpT;
    // end plate
    D.epB = D.h + 2 * V.epOV;
    D.epH = D.b + 2 * V.epOV;
    D.gripE = 2 * V.epT;
    // one length per bolt kind
    D.lenF = up5(D.gripF + D.nut + 0.2 * V.dia);
    D.lenW = up5(D.gripW + D.nut + 0.2 * V.dia);
    D.lenE = up5(D.gripE + D.nut + 0.2 * V.dia);
    /* the end plate's bolts go round the wall, not on four corners: a line down
       each side of the plate, on the overhang the tube leaves clear */
    D.eX  = D.epB / 2 - V.eOX;                      // the two bolt lines across X
    D.eY  = D.epH / 2 - V.eOY;
    D.pEX = V.eNX <= 1 ? 0 : (D.epB - 2 * V.eOX) / (V.eNX - 1);
    D.pEY = V.eNY <= 1 ? 0 : (D.epH - 2 * V.eOY) / (V.eNY - 1);
    D.nE  = 2 * V.eNX + 2 * Math.max(0, V.eNY - 2);
    /* the beams */
    const BM = findH(V.bmSec);
    D.bmH = BM[1]; D.bmB = BM[2]; D.bmW = BM[3]; D.bmF = BM[4]; D.bmR = BM[5]; D.bmKg = BM[6];
    /* Which connection each beam ended up with, resolved once here so the cached
       results below can be read off it. A mark that is not in the library
       resolves to nothing - no type, no plate - which is what the sheet's own
       IFERROR does, so the cache and the formula agree even when a beam names a
       mark that does not exist. */
    const NOCONN = { m: '', t: '', d: '', sb: 0, w: 0, th: 0, g: 0, e: 0, p: 0, n: 0 };
    D.cn = V.bmC.map(m => V.conn.find(c => c.m === m) || NOCONN);
    // plate height, from its bolts. `|| 0` only so an empty row gives 0 and not -0
    const cnH = c => (c.p * (c.n - 1) + 2 * c.e) || 0;
    /* Which face a beam meets depends on Alpha, because the directions are the
       world's and the column turns inside them. At 0 the flanges face X; at ±90
       they face Y, and an X beam then lands on the web. A tube has four alike
       walls and does not care. */
    const SQ = V.alpha % 180 === 0;
    D.faceX = SQ ? D.h / 2 : (H ? D.tw / 2 : D.b / 2);
    D.faceY = SQ ? (H ? D.tw / 2 : D.b / 2) : D.h / 2;
    D.thruX = SQ ? D.tf : D.tw;
    D.thruY = SQ ? D.tw : D.tf;
    /* An H column is bolted through: the nut goes inside, between the flanges.
       A tube cannot be - nothing reaches in to hold it - so it takes a second
       plate welded to its wall and the two are bolted face to face, clear of the
       beam. That is the whole of the difference. */
    /* Per beam now, not per book: two beams can carry different marks, so the
       grip a bolt has to cross - and therefore its length - is a beam's own. */
    D.bGrip = D.cn.map((c, i) => {
      const thru = (i < 2 ? D.thruX : D.thruY);
      return c.t === 'end plate' ? (H ? thru + c.th : 2 * c.th) : c.th + D.bmW;
    });
    D.bLen = D.bGrip.map(g => up5(g + D.nut + 0.2 * V.dia));
    // beam start, out from the column face
    D.bOff = D.cn.map(c => c.t === 'end plate' ? (H ? c.th : 2 * c.th) : c.sb);
    const pick = (a, b) => (H ? a : b);
    /* The column stiffener. Horizontal plates welded inside the H - the COLUMN's
       steel, not any beam's - one sheet row per LEVEL, a signed height measured
       from the middle column's centre. That centre is where the beams sit, so a
       pair of levels usually brackets one beam; eight rows because four beams
       have eight flanges between them. A tube gets none: nothing reaches inside a
       closed wall to weld one in.
       Thickness 0 and that row is not there, the switch the whole book uses. */
    const NSTF = 8;
    V.stf = [];
    /* These read "upper" and "lower", not "beam top flange". The offset IS a beam
       flange height - that is what it is for - but naming the plate after the
       beam made it look like part of the beam, and it is not: it is welded inside
       the column and it is the column's steel. Where the height came from is
       still on the sheet, in the check row's "beam flange at ±". */
    [1, -1].forEach(s => V.stf.push({
      t: s > 0 ? 'upper stiffener' : 'lower stiffener',
      off: rnd(s * (D.bmH - D.bmF) / 2),      // the default beam's flange centre
      w: rnd((D.b - D.tw) / 2), d: rnd(D.h - 2 * D.tf), th: 12
    }));
    while (V.stf.length < NSTF) V.stf.push({ t: '', off: 0, w: 0, d: 0, th: 0 });
    // column D is 26 wide with a filled neighbour, so Excel clips rather than spills
    V.stf.forEach(x => { if (x.t.length > 25)
      throw new Error('stiffener note clipped at 26: ' + x.t.length); });
    D.stfN = H ? V.stf.filter(s => s.th > 0).length * 2 : 0;

    return { V: V, H: H, SEC: SEC, D: D, UDEF: UDEF, NSTF: NSTF, CONNT: CONNT };
  }

  /* Everything below is written against V and the catalogue. It is the same
     code the generator ran when it lived there - moved, not rewritten - so
     the workbook it produces is unchanged, which is what the geometry diff
     checks. */
  function build(V, cat) {
    /* Derive here, every time, from the V actually handed in. A caller does
       not get to pass stale derivations alongside fresh inputs — that is the
       one way this module could tell a plausible lie. */
    var prep = derive(V, cat);
    var findH = cat.findH, findT = cat.findT;
    var H = prep.H, SEC = prep.SEC, D = prep.D, UDEF = prep.UDEF;
    var NSTF = prep.NSTF, CONNT = prep.CONNT;
    var up5 = function (x) { return Math.ceil(x / 5) * 5; };
    var rnd = function (x) { return +(+x).toFixed(4); };
    var pick = function (a, b) { return H ? a : b; };
    var cnH = function (c) { return (c.p * (c.n - 1) + 2 * c.e) || 0; };
    var SQ = V.alpha % 180 === 0;
    var P = 'PARAM';
    const R = { title: 1, sub: 2,
                sHead: 4,  sCols: 5,  sec: 6,  len: 7,  steel: 8,
                sNote: 9,  aNote: 10, sChk: 11,
                tHead: 13, tCols: 14, stf0: 15, tNote: 23, tChk: 24,
                pHead: 26, pCols: 27, fo: 28, fi: 29, wp: 30, ep: 31, pNote: 32, pChk: 33,
                bHead: 35, bCols: 36, blt: 37, gCols: 38, gF: 39, gW: 40,
                eCols: 41, gE: 42, bNote: 43, bChk: 44,
                nHead: 46, nCols: 47, cn0: 48, nNote: 54, nChk: 55,
                mHead: 57, mCols: 58, bm0: 59, mNote: 63, mChk: 64 };
    /* All three follow R, none of them a literal. BMROW was written out as
       [35,36,37,38] and survived every earlier edit because the beams never
       moved; the moment they did it wrote four rows straight over the BOLTS
       chapter, and the header vanished under an X+. */
    const BMROW = V.bmC.map((_, i) => R.bm0 + i);    // X+  X-  Y+  Y-
    const CNROW = V.conn.map((_, i) => R.cn0 + i);
    const STFROW = Array.from({ length: NSTF }, (_, i) => R.stf0 + i);
    const c = (col, row) => `${P}!$${col}$${row}`;
    const K = {
      typ: c('C', R.sec), sec: c('D', R.sec),
      h: c('E', R.sec), b: c('F', R.sec), tw: c('G', R.sec), tf: c('H', R.sec),
      r: c('I', R.sec), alpha: c('J', R.sec), kg: c('K', R.sec),
      up: c('E', R.len), mid: c('G', R.len), dn: c('I', R.len),
      steel: c('C', R.steel),
      foW: c('E', R.fo), foL: c('F', R.fo), foT: c('G', R.fo), gap: c('J', R.fo),
      fiW: c('E', R.fi), fiL: c('F', R.fi), fiT: c('G', R.fi),
      wpW: c('E', R.wp), wpL: c('F', R.wp), wpT: c('G', R.wp),
      epW: c('E', R.ep), epL: c('F', R.ep), epT: c('G', R.ep),
      dia: c('E', R.blt), hole: c('F', R.blt), grade: c('G', R.blt),
      lenF: c('H', R.blt), lenW: c('I', R.blt), lenE: c('J', R.blt),
      fNL: c('E', R.gF), fIL: c('F', R.gF), fOL: c('G', R.gF),
      fNT: c('H', R.gF), fIT: c('I', R.gF), fOT: c('J', R.gF),
      wNL: c('E', R.gW), wIL: c('F', R.gW), wOL: c('G', R.gW),
      wNT: c('H', R.gW), wIT: c('I', R.gW), wOT: c('J', R.gW),
      eNX: c('E', R.gE), eOX: c('F', R.gE), eNY: c('H', R.gE), eOY: c('I', R.gE),
      epOV: c('J', R.ep)
    };
    // one beam's cells, by its row
    const BMK = i => ({ det: c('C', BMROW[i]), sec: c('D', BMROW[i]), h: c('E', BMROW[i]), b: c('F', BMROW[i]),
                       tw: c('G', BMROW[i]), tf: c('H', BMROW[i]), r: c('I', BMROW[i]),
                       len: c('J', BMROW[i]), kg: c('K', BMROW[i]) });
    // one stiffener level's cells, by its row
    const SK = i => ({ off: c('E', STFROW[i]), w: c('F', STFROW[i]),
                       d: c('G', STFROW[i]), th: c('H', STFROW[i]) });
    /* The connection library, looked up by the mark a beam names. IFERROR is not
       decoration: a mark that is not in the list would otherwise put #N/A through
       every formula downstream and the whole sheet would go red. Falling back to
       0 - and to "" for the type - makes an unknown mark behave as no connection
       at all, which is what a person who has just mistyped one wants to see. The
       check row says so in words. */
    const CNTAB = `${P}!$B$${R.cn0}:$K$${R.cn0 + V.conn.length - 1}`;
    const CNMARK = `${P}!$B$${R.cn0}:$B$${R.cn0 + V.conn.length - 1}`;
    const CNTYPE = `${P}!$C$${R.cn0}:$C$${R.cn0 + V.conn.length - 1}`;
    const CNW    = `${P}!$F$${R.cn0}:$F$${R.cn0 + V.conn.length - 1}`;
    /* Column numbers inside that table: B=1 mark, C=2 type, D=3 note, then the
       numbers. `h` is a shown-but-derived cell, so nothing looks it up - the
       input tab builds the height from p, n and e directly rather than reading a
       formula's cached result through a second formula. */
    const CC = { typ: 2, note: 3, sb: 4, w: 5, h: 6, th: 7, g: 8, e: 9, p: 10, n: 11 };
    const cv  = (i, n) => `IFERROR(VLOOKUP(${BMK(i).det},${CNTAB},${n},FALSE),0)`;
    const cvt = i => `IFERROR(VLOOKUP(${BMK(i).det},${CNTAB},${CC.typ},FALSE),"")`;
    // one beam's connection, as formulas and as the values they cache to
    const CNK = i => ({
      t: cvt(i), sb: cv(i, CC.sb), w: cv(i, CC.w), th: cv(i, CC.th),
      g: cv(i, CC.g), e: cv(i, CC.e), p: cv(i, CC.p), n: cv(i, CC.n),
      h: `(${cv(i, CC.p)}*(${cv(i, CC.n)}-1)+2*${cv(i, CC.e)})`
    });
    const isH = `${K.typ}="H"`;
    /* Where a beam meets the column, and how much steel its bolt has to cross.
       Both follow Alpha, because the four directions belong to the world and the
       column turns inside them: at 0 the flanges face X, at ±90 they face Y. */
    const SQf    = `MOD(${K.alpha},180)=0`;
    const faceXf = `IF(${SQf},${K.h}/2,IF(${isH},${K.tw}/2,${K.b}/2))`;
    const faceYf = `IF(${SQf},IF(${isH},${K.tw}/2,${K.b}/2),${K.h}/2)`;
    const thruXf = `IF(${SQf},${K.tf},${K.tw})`;
    const thruYf = `IF(${SQf},${K.tw},${K.tf})`;
    // the four pitches, as formulas, in the splice sheet's own two shapes
    const F = {
      pFL: `(${K.foL}/2-${K.fOL}-${K.fIL}/2)/(${K.fNL}/2-1)`,
      pFT: `(${K.foW}/2-${K.fOT}-${K.fIT}/2)/(${K.fNT}/2-1)`,
      pWL: `(${K.wpL}/2-${K.wOL}-${K.wIL}/2)/(${K.wNL}/2-1)`,
      pWT: `(${K.wpW}-2*${K.wOT}-${K.wIT})/(${K.wNT}-1)`
    };
    F.fiY = `(${K.fIT}/2+(${F.pFT})/2)`;
    /* row() and note2() collected into a worksheet when this code lived in the
       generator. They collect into an array now, and that one change is what
       makes the rest of it portable - nothing below this line knows whether it
       is being written to a file or posted to a frame. */
    var out = [];
    var ir = 0;
    function row(cells, comment) { ir++; out.push({ cells: cells, comment: comment || '' }); }
    function note2(t) { ir++; out.push({ cells: [], comment: t }); }
    var f = function (formula, value) { return { f: formula, v: value }; };

    note2('Written from PARAM. Nothing here needs editing — change the front sheet instead.');
    row(['COORD', 'ZUP']);

    const PIECES = [['c1', 'upper', K.up, V.up], ['c2', 'middle', K.mid, V.mid],
                    ['c3', 'lower', K.dn, V.dn]];
    note2('');
    note2('SECT  id  material  length  TYPE  base.pt  v1..v7        an H takes seven values, a tube four — the last three go blank by formula');
    note2('MAX(1,..) keeps the definition alive when its piece is switched off below: a SECT of length 0 is not defined at all, and the MODULE naming it then fails.');
    PIECES.forEach(([id, what, klen, vlen]) => {
      row(['SECT', 'sc.' + id, f(K.steel, V.steel),
           f(`MAX(1,${klen})`, Math.max(1, vlen)),
           f(`IF(${isH},"H","R")`, V.type), 'mc',
           f(K.h, D.h), f(K.b, D.b),
           f(`IF(${isH},${K.b},${K.tw})`, pick(D.b, D.tw)),
           f(`IF(${isH},${K.tw},${K.r})`, pick(D.tw, D.r)),
           f(`IF(${isH},${K.tf},"")`, pick(D.tf, '')),
           f(`IF(${isH},${K.tf},"")`, pick(D.tf, '')),
           f(`IF(${isH},${K.r},"")`, pick(D.r, ''))], what);
    });

    note2('');
    note2('PLATE / BOLT   —   pl.fo is the flange cover plate on an H and the end plate on a tube; the inner and web plates are switched off on a tube, and so are the bolts that hold them.');
    row(['PLATE', 'pl.fo', f(K.steel, V.steel),
         f(`IF(${isH},${K.foT},${K.epT})`, pick(V.foT, V.epT)), 'RECT', 'mc',
         f(`IF(${isH},${K.foW},${K.epW})`, pick(V.foW, D.epB)),
         f(`IF(${isH},${K.foL},${K.epL})`, pick(V.cpL, D.epH))], 'flange plate, or end plate');
    row(['PLATE', 'pl.fi', f(K.steel, V.steel), f(K.fiT, V.fiT), 'RECT', 'mc',
         f(K.fiW, V.fiW), f(K.fiL, V.cpL)], 'flange inner plate, x4 — H only');
    row(['PLATE', 'pl.wp', f(K.steel, V.steel), f(K.wpT, V.wpT), 'RECT', 'mc',
         f(K.wpW, V.wpW), f(K.wpL, V.cpL)], 'web plate, x2 — H only');
    row(['BOLT', 'bo.f', f(K.grade, V.grade), f(K.dia, V.dia),
         f(`IF(${isH},${K.lenF},${K.lenE})`, pick(D.lenF, D.lenE)), f(K.hole, D.hole),
         '', '', '', f(`0.9*${K.dia}`, D.nut),
         f(`IF(${isH},${K.lenF}-${K.foT}-${K.tf}-${K.fiT},${K.lenE}-2*${K.epT})-0.9*${K.dia}`,
           rnd(pick(D.lenF - D.gripF, D.lenE - D.gripE) - D.nut))], 'flange bolt, or end plate bolt');
    row(['BOLT', 'bo.w', f(K.grade, V.grade), f(K.dia, V.dia),
         f(`IF(${isH},${K.lenW},1)`, pick(D.lenW, 1)), f(K.hole, D.hole),
         '', '', '', f(`0.9*${K.dia}`, D.nut),
         f(`IF(${isH},${K.lenW}-${K.tw}-2*${K.wpT}-0.9*${K.dia},0)`,
           pick(rnd(D.lenW - D.gripW - D.nut), 0))],
        'web bolt — H only');

    note2('');
    note2('the stiffeners, one plate per level. RECT takes B then H: B runs along the column\'s h and is the DEPTH between the flanges, H runs along b and is the WIDTH out from the web.');
    note2('MAX(1,..) once more — a plate of zero size is not defined at all, and the MODULE naming it would then fail rather than quietly skip.');
    V.stf.forEach((s, i) => {
      const k = SK(i);
      row(['PLATE', 'pl.stf' + (i + 1), f(K.steel, V.steel),
           f(`MAX(1,${k.th})`, Math.max(1, s.th)), 'RECT', 'mc',
           f(`MAX(1,${k.d})`, Math.max(1, s.d)),
           f(`MAX(1,${k.w})`, Math.max(1, s.w))],
          i === 0 ? 'level 1 — every row of chapter 6 gets one of these' : '');
    });

    note2('');
    note2('MODULE  id  member  Ref.Pt  L.X  L.Y  L.Z  PLANE  [ROT.X ROT.Y ROT.Z]  [dx dy dz repeat]  [dx2 dy2 dz2 repeat2]');
    note2('ROT.Z 90 turns the section so its h runs along X. A square column cannot show that in a bounding box, so it is written down rather than looked for.');
    PIECES.forEach(([id, what, klen, vlen], i) => {
      const on = i === 1 ? `"sc.${id}"` : `IF(${klen}>0,"sc.${id}","")`;
      const onV = i === 1 ? 'sc.' + id : (vlen > 0 ? 'sc.' + id : '');
      row(['MODULE', 'md.' + id, f(on, onV), '', 0, 0, 0, 'XY', 0, 0, 90],
          i === 0 ? 'a blank member is simply not there — which is how a length of 0 removes a piece' : '');
      row(['MODULE', 'md.' + id, 'BASE', 'sc.' + id, 'mc']);
    });

    /* the splice. Its origin is the middle of the joint. */
    const fox = `(${K.h}/2+${K.foT}/2)`,            foxV = D.h / 2 + V.foT / 2;
    const fix = `(${K.h}/2-${K.tf}-${K.fiT}/2)`,    fixV = D.h / 2 - D.tf - V.fiT / 2;
    const bfx = `(${K.h}/2-${K.tf}-${K.fiT})`,      bfxV = D.h / 2 - D.tf - V.fiT;
    const wpy = `(${K.tw}/2+${K.wpT}/2)`,           wpyV = D.tw / 2 + V.wpT / 2;
    const bwy = `(${K.tw}/2+${K.wpT})`,             bwyV = D.tw / 2 + V.wpT;
    const wx0 = `(${K.wpW}/2-${K.wOT})`,            wx0V = V.wpW / 2 - V.wOT;
    const eX  = `(${K.epW}/2-${K.eOX})`,            eY  = `(${K.epL}/2-${K.eOY})`;
    const pEX = `((${K.epW}-2*${K.eOX})/(${K.eNX}-1))`;
    const pEY = `((${K.epL}-2*${K.eOY})/(${K.eNY}-1))`;
    const sgn = (sg, e) => (sg > 0 ? `(${e})` : `-(${e})`);
    note2('');
    note2('The splice, its origin the middle of the joint. Every quadrant of a bolt group is one row: the two repeat axes reach across the flange and along the column, and the four sign combinations are the four corners of the pattern.');
    [['u', K.up, V.up], ['d', K.dn, V.dn]].forEach(([sd, klen, vlen]) => {
      const both  = m => f(`IF(${klen}>0,"${m}","")`, vlen > 0 ? m : '');
      const hOnly = m => f(`IF(AND(${klen}>0,${isH}),"${m}","")`, (vlen > 0 && H) ? m : '');
      const first = sd === 'u';
      // flange plates - or the two end plates
      [1, -1].forEach(sg => {
        row(['MODULE', 'md.sp' + sd, both('pl.fo'), 'mc',
             f(`IF(${isH},${sgn(sg, fox)},0)`, pick(sg * foxV, 0)), 0,
             f(`IF(${isH},0,${sgn(sg, `${K.epT}/2`)})`, pick(0, sg * V.epT / 2)),
             f(`IF(${isH},"YZ","XY")`, pick('YZ', 'XY'))],
            first && sg > 0 ? 'flange plate on each flange — or, on a tube, the two end plates' : '');
      });
      // flange inner plates, two per flange
      [1, -1].forEach(sx => [1, -1].forEach(sy => {
        row(['MODULE', 'md.sp' + sd, hOnly('pl.fi'), 'mc',
             f(sgn(sx, fix), sx * fixV), f(sgn(sy, F.fiY), sy * D.fiY), 0, 'YZ'],
            first && sx > 0 && sy > 0 ? 'inner plates, each centred on its own two bolt lines' : '');
      }));
      // web plates
      [1, -1].forEach(sy => {
        row(['MODULE', 'md.sp' + sd, hOnly('pl.wp'), 'mc',
             0, f(sgn(sy, wpy), sy * wpyV), 0, 'XZ'],
            first && sy > 0 ? 'web plate, one each side' : '');
      });
      // flange bolts: one row per quadrant, per flange - H only
      [1, -1].forEach(sx => [1, -1].forEach(sz => [1, -1].forEach(sy => {
        row(['MODULE', 'md.sp' + sd, hOnly('bo.f'), '',
             f(sgn(sx, bfx), sx * bfxV),
             f(sgn(sy, `${K.fIT}/2`), sy * V.fIT / 2),
             f(sgn(sz, `${K.fIL}/2`), sz * V.fIL / 2), 'YZ',
             0, 0, sx > 0 ? 0 : 180,
             0, f(sgn(sy, F.pFT), sy * rnd(D.pFT)), 0, f(`${K.fNT}/2-1`, V.fNT / 2 - 1),
             0, 0, f(sgn(sz, F.pFL), sz * rnd(D.pFL)), f(`${K.fNL}/2-1`, V.fNL / 2 - 1)],
            first && sx > 0 && sz > 0 && sy > 0
              ? 'one quadrant of the flange group; eight rows make the two flanges' : '');
      })));
      /* the end plate's bolts - a ring round the wall, not four corners. Two rows
         run the full line down the X sides; two more fill in the Y sides between
         them, which is why those start one pitch in and count two fewer. */
      const rOn = m => f(`IF(AND(${klen}>0,NOT(${isH})),"${m}","")`, (vlen > 0 && !H) ? m : '');
      const rOn3 = m => f(`IF(AND(${klen}>0,NOT(${isH}),${K.eNY}>2),"${m}","")`,
                          (vlen > 0 && !H && V.eNY > 2) ? m : '');
      [1, -1].forEach(sy => {
        row(['MODULE', 'md.sp' + sd, rOn('bo.f'), '',
             f(`-${eX}`, -D.eX), f(sgn(sy, eY), sy * D.eY),
             f(`-${K.epT}/2`, -V.epT / 2), 'XY', 0, 0, 0,
             f(pEX, rnd(D.pEX)), 0, 0, f(`${K.eNX}-1`, V.eNX - 1)],
            first && sy > 0 ? 'end plate: a full line down each X side of the plate' : '');
      });
      [1, -1].forEach(sx => {
        row(['MODULE', 'md.sp' + sd, rOn3('bo.f'), '',
             f(sgn(sx, eX), sx * D.eX), f(`-${eY}+${pEY}`, -D.eY + rnd(D.pEY)),
             f(`-${K.epT}/2`, -V.epT / 2), 'XY', 0, 0, 0,
             /* the step goes to 0 with the count: a delta with nothing to repeat
                is a row the engine rightly asks about */
             0, f(`IF(${K.eNY}>3,${pEY},0)`, V.eNY > 3 ? rnd(D.pEY) : 0), 0,
                f(`MAX(0,${K.eNY}-3)`, Math.max(0, V.eNY - 3))],
            first && sx > 0 ? 'and the Y sides between them, corners already taken' : '');
      });
      // web bolts: one row per side of the joint, the depth in one run
      [1, -1].forEach(sz => {
        row(['MODULE', 'md.sp' + sd, hOnly('bo.w'), '',
             f(`-${wx0}`, -wx0V), f(bwy, bwyV), f(sgn(sz, `${K.wIL}/2`), sz * V.wIL / 2), 'XZ',
             0, 0, 0,
             f(F.pWT, rnd(D.pWT)), 0, 0, f(`${K.wNT}-1`, V.wNT - 1),
             0, 0, f(sgn(sz, F.pWL), sz * rnd(D.pWL)), f(`${K.wNL}/2-1`, V.wNL / 2 - 1)],
            first && sz > 0 ? 'the web: no gap at the middle of the depth, so it is one run across' : '');
      });
      row(['MODULE', 'md.sp' + sd, 'BASE', 'pl.fo_1', 'mc']);
    });

    /* The stiffeners ride INSIDE md.c2 rather than in a module of their own, and
       that one decision pays for the whole block: the ASSY row that places md.c2
       carries `spin`, so Alpha turns the stiffeners with the section and not one
       formula here has to know what Alpha is. md.c2's BASE is the centre of the
       section's START face, so local z runs 0 to `mid` and the centre - which is
       also where the beams sit - is at mid/2.
       Inside the module the section carries ROT.Z 90, so its h lies along X and
       its b along Y. The plates do not: each is laid flat in XY, which is why the
       PLATE row above puts the depth first. The repeat then drops the second
       plate on the far side of the web. */
    note2('');
    note2('the stiffeners, inside the middle column module so Alpha turns them with it. Local z 0 is the foot of that piece, so its centre — and the beams — are at mid/2.');
    note2('One row per level; the repeat puts the second plate the other side of the web, the web splitting the space between the flanges in two.');
    const stfHalf  = `(${K.b}+${K.tw})/4`;
    const stfHalfV = rnd((D.b + D.tw) / 4);
    V.stf.forEach((s, i) => {
      const k = SK(i), live = H && s.th > 0;
      row(['MODULE', 'md.c2',
           f(`IF(AND(${isH},${k.th}>0),"pl.stf${i + 1}","")`, live ? 'pl.stf' + (i + 1) : ''),
           'mc', 0, f(`-${stfHalf}`, -stfHalfV),
           f(`${K.mid}/2+${k.off}`, rnd(V.mid / 2 + s.off)), 'XY', 0, 0, 0,
           0, f(`2*${stfHalf}`, 2 * stfHalfV), 0, 1],
          i === 0 ? 'level 1, one plate each side of the web' : '');
    });

    /* BASE holds pl.fo_1, so a splice ASSY row names where THAT plate goes. */
    const jointU  = `(${K.mid}/2+IF(${isH},${K.gap}/2,${K.epT}))`;
    const jointUV = V.mid / 2 + pick(V.gap / 2, V.epT);
    const clearU  = `(${K.mid}/2+IF(${isH},${K.gap},2*${K.epT}))`;
    const clearUV = V.mid / 2 + pick(V.gap, 2 * V.epT);
    note2('');
    note2('ASSY  id  ref  cmd  p1 p2 p3        BASE holds pl.fo_1, so a splice row names where THAT plate sits, not where the joint is');
    /* ASSY ... ADD takes a three-axis rotation after its point, so the whole
       module turns as one piece - plates and bolts with the section, which is what
       makes Alpha safe. A column piece is placed ON the axis, so spinning it about
       its own base point is a spin in place. The splice is not: BASE holds
       pl.fo_1, which sits out on the flange, so its point has to be carried round
       the axis as well. Rotating a rigid body about P and then putting P where the
       rotation would have sent it is the same as rotating the lot about the
       origin. */
    const rotX = (e, v) => f(`ROUND((${e})*COS(RADIANS(${K.alpha})),6)`,
                             rnd(v * Math.cos(V.alpha * Math.PI / 180)));
    const rotY = (e, v) => f(`ROUND((${e})*SIN(RADIANS(${K.alpha})),6)`,
                             rnd(v * Math.sin(V.alpha * Math.PI / 180)));
    const spin = [0, 0, f(K.alpha, V.alpha)];
    row(['ASSY', 'as.col', 'md.c2', 'ADD', 0, 0, f(`-${K.mid}/2`, -V.mid / 2)].concat(spin),
        'middle');
    row(['ASSY', 'as.col', 'md.c1', 'ADD', 0, 0, f(clearU, clearUV)].concat(spin),
        'upper, clear of the joint');
    row(['ASSY', 'as.col', 'md.c3', 'ADD', 0, 0,
         f(`-(${clearU}+MAX(1,${K.dn}))`, -(clearUV + Math.max(1, V.dn)))].concat(spin), 'lower');
    const foxOn = `IF(${isH},${fox},0)`, foxOnV = pick(foxV, 0);
    row(['ASSY', 'as.col', 'md.spu', 'ADD',
         rotX(foxOn, foxOnV), rotY(foxOn, foxOnV),
         f(`${jointU}+IF(${isH},0,-${K.epT}/2)`, jointUV + pick(0, -V.epT / 2))].concat(spin),
        'the splice point goes round the axis with the rest of it');
    row(['ASSY', 'as.col', 'md.spd', 'ADD',
         rotX(foxOn, foxOnV), rotY(foxOn, foxOnV),
         f(`-${jointU}+IF(${isH},0,${K.epT}/2)`, -jointUV + pick(0, V.epT / 2))].concat(spin));
    /* ---- the beams ---- */
    /* Four of them, in the world's directions. They carry no `spin`: a beam
       follows the building grid and it is the column that turns inside it, which
       is why Alpha reaches these rows only through the face it presents. */
    const BDIR = [
      { k: 'a', d: 'X+', ax: 'X', sg:  1, plane: 'YZ', rot: 0   },
      { k: 'b', d: 'X-', ax: 'X', sg: -1, plane: 'YZ', rot: 180 },
      { k: 'c', d: 'Y+', ax: 'Y', sg:  1, plane: 'XZ', rot: 180 },
      { k: 'd', d: 'Y-', ax: 'Y', sg: -1, plane: 'XZ', rot: 0   }
    ];
    note2('');
    note2('SECT / PLATE / BOLT for the beams. One end plate serves all four; the bolt comes in two lengths because an X face and a Y face are not the same thickness of steel once Alpha has turned the column.');
    BDIR.forEach((B, i) => {
      const b = BMK(i);
      row(['SECT', 'sc.bm' + B.k, f(K.steel, V.steel),
           f(`MAX(1,${b.len})`, Math.max(1, V.bmL[i])), 'H', 'mc',
           f(b.h, D.bmH), f(b.b, D.bmB), f(b.b, D.bmB), f(b.tw, D.bmW),
           f(b.tf, D.bmF), f(b.tf, D.bmF), f(b.r, D.bmR)],
          i === 0 ? 'one per direction, so each can be its own section' : '');
    });
    /* One plate and one bolt PER BEAM, where there used to be one of each per
       book. Two beams can now name different marks, so neither the plate nor the
       bolt is a property of the column any more - it is a property of the beam
       that carries it. The two types share a row because they take the same
       numbers: width across or out, height from the bolt group, one thickness. */
    note2('');
    note2('One plate and one bolt for each beam, since each beam names its own connection. The plate is the end plate or the fin depending on that mark; MAX(1,..) keeps it defined when the mark is blank.');
    BDIR.forEach((B, i) => {
      const b = BMK(i), C = CNK(i), cn = D.cn[i], isX = B.ax === 'X';
      row(['PLATE', 'pl.cn' + B.k, f(K.steel, V.steel),
           f(`MAX(1,${C.th})`, Math.max(1, cn.th)), 'RECT', 'mc',
           f(`MAX(1,${C.w})`, Math.max(1, cn.w)),
           f(`MAX(1,${C.h})`, Math.max(1, cnH(cn)))],
          i === 0 ? 'the end plate or the fin, whichever this beam\'s mark names' : '');
    });
    BDIR.forEach((B, i) => {
      const b = BMK(i), C = CNK(i), cn = D.cn[i];
      const thru = i < 2 ? thruXf : thruYf;
      /* An end plate bolt crosses the column wall and the plate; on a tube it
         crosses two plates instead, nothing reaching inside to hold a nut. A fin
         bolt crosses the fin and the beam's own web, and never the column. */
      const gf = `IF(${C.t}="end plate",IF(${isH},${thru}+${C.th},2*${C.th}),${C.th}+${b.tw})`;
      const lf = `CEILING(${gf}+1.1*${K.dia},5)`;
      row(['BOLT', 'bo.cn' + B.k, f(K.grade, V.grade), f(K.dia, V.dia),
           f(`MAX(1,${lf})`, Math.max(1, D.bLen[i])), f(K.hole, D.hole),
           '', '', '', f(`0.9*${K.dia}`, D.nut),
           f(`MAX(0,(${lf})-(${gf})-0.9*${K.dia})`,
             Math.max(0, rnd(D.bLen[i] - D.bGrip[i] - D.nut)))],
          i === 0 ? 'its length follows the grip, and the grip follows the mark' : '');
    });

    note2('');
    note2('Each beam is one module, written for BOTH details at once. Its origin is the START FACE OF THE BEAM, which is the point BASE holds, so every other row is a distance measured back from there.');
    BDIR.forEach((B, i) => {
      const b = BMK(i), isX = B.ax === 'X';
      const thru = isX ? thruXf : thruYf;
      const thruV = isX ? D.thruX : D.thruY;
      const bolt = 'bo.cn' + B.k, plate = 'pl.cn' + B.k;
      /* The type no longer sits in the beam's own row - the beam names a mark and
         the mark carries the type - so every branch below asks the library. */
      const C = CNK(i), cn = D.cn[i];
      const ep = `${C.t}="end plate"`, fin = `${C.t}="fin plate"`;
      const isEP = cn.t === 'end plate', isFin = cn.t === 'fin plate';
      const live = V.bmL[i] > 0;
      const onEP  = m => f(`IF(AND(${b.len}>0,${ep}),"${m}","")`, (live && isEP) ? m : '');
      const onEPR = m => f(`IF(AND(${b.len}>0,${ep},NOT(${isH})),"${m}","")`, (live && isEP && !H) ? m : '');
      const onFin = m => f(`IF(AND(${b.len}>0,${fin}),"${m}","")`, (live && isFin) ? m : '');
      const on    = m => f(`IF(${b.len}>0,"${m}","")`, live ? m : '');
      /* ROT.Z 180 turns BOTH horizontal axes, so the across offset has to be
         signed exactly as the outward one is. Leaving it unsigned looked right on
         X+ and Y+ and put the X- fin bolt at Y 13.25..29.75 - past the web
         entirely, bolted to nothing. Y+ survived only because the two planes
         extrude opposite ways (YZ gives +X, XZ gives -Y) and the two errors
         cancelled. */
      const sgn = (e, v) => (B.sg > 0 ? [e, v] : [`-(${e})`, -v]);
      const out = sgn, acr = sgn;
      const XY = (o, a) => isX ? [o, a] : [a, o];
      const pair = (o, a) => { const q = XY(o, a); return [f(q[0][0], q[0][1]), f(q[1][0], q[1][1])]; };
      const zero = ['0', 0];
      const finPlane = B.plane === 'YZ' ? 'XZ' : 'YZ';
      note2('');
      note2('beam ' + B.d + '  —  ' + (live ? V.bmC[i] + ', ' + (cn.t || 'a mark with no type')
                                            : 'off, its Length being 0'));
      // end plate on the beam end
      row(['MODULE', 'md.bm' + B.k, onEP(plate), 'mc']
          .concat(pair(out(`-${C.th}/2`, -cn.th / 2), zero))
          .concat([0, B.plane, 0, 0, B.rot]),
          i === 0 ? 'end plate, on the beam end' : '');
      // and its twin on a tube wall, where the bolt cannot go through
      row(['MODULE', 'md.bm' + B.k, onEPR(plate), 'mc']
          .concat(pair(out(`-1.5*${C.th}`, -1.5 * cn.th), zero))
          .concat([0, B.plane, 0, 0, B.rot]),
          i === 0 ? 'on a tube column, a second one welded to the wall' : '');
      // fin plate, welded to the column and standing out beside the beam web
      row(['MODULE', 'md.bm' + B.k, onFin(plate), 'mc']
          .concat(pair(out(`${C.w}/2-${C.sb}`, cn.w / 2 - cn.sb),
                       acr(`${b.tw}/2+${C.th}/2`, rnd(D.bmW / 2 + cn.th / 2))))
          .concat([0, finPlane, 0, 0, B.rot]),
          i === 0 ? 'fin plate, reaching out from the column beside the web' : '');
      row(['MODULE', 'md.bm' + B.k, on('sc.bm' + B.k), '', 0, 0, 0, B.plane, 0, 0, B.rot],
          i === 0 ? 'the beam, at the module origin' : '');
      // the bolts. An end plate bolt runs along the beam, two across the web; a
      // fin plate bolt runs across it, in one line.
      row(['MODULE', 'md.bm' + B.k,
           f(`IF(OR(${b.len}<=0,AND(NOT(${ep}),NOT(${fin}))),"","${bolt}")`,
             (live && (isEP || isFin)) ? bolt : ''), '']
          .concat(pair(out(`IF(${ep},IF(${isH},-((${thru})+${C.th}),-2*${C.th}),${C.g}-${C.sb})`,
                           isEP ? (H ? -(thruV + cn.th) : -2 * cn.th) : cn.g - cn.sb),
                       acr(`IF(${ep},-${C.g}/2,${b.tw}/2+${C.th})`,
                           isEP ? -cn.g / 2 : rnd(D.bmW / 2 + cn.th))))
          .concat([f(`-${C.p}*(${C.n}-1)/2`, -cn.p * (cn.n - 1) / 2),
                   f(`IF(${ep},"${B.plane}","${finPlane}")`, isEP ? B.plane : finPlane),
                   0, 0, B.rot])
          .concat(pair(zero, acr(`IF(${ep},${C.g},0)`, isEP ? cn.g : 0)))
          .concat([0, f(`IF(${ep},1,0)`, isEP ? 1 : 0)])
          .concat([0, 0, f(C.p, cn.p), f(`${C.n}-1`, cn.n - 1)]),
          i === 0 ? 'two across the web on an end plate, one line on a fin' : '');
      row(['MODULE', 'md.bm' + B.k, 'BASE', 'sc.bm' + B.k, 'mc']);
    });

    note2('');
    note2('The beams go on last. No spin: they belong to the grid, not to the column.');
    BDIR.forEach((B, i) => {
      const b = BMK(i), isX = B.ax === 'X';
      const face = isX ? faceXf : faceYf, faceV = isX ? D.faceX : D.faceY;
      const C = CNK(i);
      const at = `(${face})+IF(${C.t}="end plate",IF(${isH},${C.th},2*${C.th}),${C.sb})`;
      const atV = faceV + D.bOff[i];
      const cell = f(B.sg > 0 ? at : `-(${at})`, B.sg * atV);
      row(['ASSY', 'as.col', 'md.bm' + B.k, 'ADD',
           isX ? cell : 0, isX ? 0 : cell, 0],
          i === 0 ? 'the beam start: the column face, plus the plate or plates in front of it' : '');
    });

    note2('');
    row(['END']);
    return { V: V, D: D, H: H, SEC: SEC, SQ: SQ, R: R, K: K, F: F, CC: CC,
             BMROW: BMROW, CNROW: CNROW, STFROW: STFROW, NSTF: NSTF,
             BMK: BMK, SK: SK, CNK: CNK, cv: cv, cvt: cvt,
             CNTAB: CNTAB, CNMARK: CNMARK, CNTYPE: CNTYPE, CNW: CNW,
             isH: isH, SQf: SQf, faceXf: faceXf, faceYf: faceYf,
             thruXf: thruXf, thruYf: thruYf, BDIR: BDIR, PIECES: PIECES,
             CONNT: CONNT, UDEF: UDEF, pick: pick, rnd: rnd, cnH: cnH, up5: up5,
             rows: out, count: ir };
  }

  /* The engine reads cell values, not formulas — so this is what a browser
     hands it. Column 1 of the input tab is the comment margin, which the
     parser ignores; the comment goes there, exactly as the workbook has it,
     so these arrays are the workbook's rows and not merely equivalent to
     them. That is the invariant worth holding: a cell-for-cell comparison
     against a generated file will catch a drift that "close enough" would
     hide. The keyword stays in column B either way. */
  function values(rows) {
    return rows.map(function (r) {
      return [r.comment || null].concat(r.cells.map(function (c) {
        if (c && typeof c === 'object') return c.v;
        return c === undefined ? null : c;
      }));
    });
  }

  return { defaults: defaults, derive: derive, build: build, values: values };
});
