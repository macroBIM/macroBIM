/* ============================================================
   data_bracket.js — Support bracket example data
   Registers window.PLATE_DATA; plate_builder.js renders it
   automatically. Row structure matches the Excel sheets
   (PLATE/CUT/ASSY) — see DATA_SCHEMA.md.
   ============================================================ */

window.PLATE_DATA = {
  title: 'PLATE3D',
  subtitle: 'Support bracket · PLATE/CUT/ASSY data · unit: mm',
  note: 'This data is loaded from data_bracket.js. Replace it with any ' +
        'file that defines window.PLATE_DATA in the same structure.',

  PLATE: [
    ['#','PLATE','ID','B','H','THK','MAT'],          // rectangle block
    ['','','T2',260,240,10,'SS275'],
    ['','','S1',290,280,10,'SS275'],
    ['','','B1',240,280,10,'SS275'],
    ['','','T1',350,300,10,'SS275'],
    ['','','C1',100,300,10,'SS275'],
    ['','','C2',120,300,10,'SS275'],
    ['','','F1',240,170,10,'SS275'],
    ['','','F2',60,240,10,'SS275'],
    ['','','F3',240,100,10,'SS275'],
    ['','','SA',220,240,10,'SS275'],
    ['','','SB',290,220,10,'SS275'],
    ['#','PLATE','ID','D','THK','MAT'],              // circle block
    ['','','BOLT',20,135,'F10.8']
    // trapezoid block example:
    // ['#','PLATE','ID','WT','WB','H','OFF_T','OFF_B','THK','MAT'],
    // ['','','G1',100,200,150,50,0,10,'SS275']      // WT=0 makes a triangle
  ],

  CUT: [
    ['PLATE','TYPE','D','B','TW','H','OF','U','V','ANG','NX','PX','NY','PY'],
    ['T1','CIRC',22,'','','','',  90, 40,0, 2,220,2,220],   // leveling bolts, 4-D22
    ['T2','CIRC',24,'','','','',  30, 30,0, 2,200,2,180],   // anchors, 4-D24
    ['S1','TRAP','',50,50,110,0,   0,  0,0, '','','',''],   // bottom-left notch
    ['B1','CIRC',30,'','','','', 120,125,0, '','','',''],   // pin hole
    ['F1','CIRC',30,'','','','',  30, 30,0, '','','','']    // lug hole
  ],

  ASSY: [
    ['NO','PLATE','METHOD','PLANE','OFFSET','U','V','ANG','TO','MY_EDGE','TO_EDGE','FOLD','ALIGN','SLIDE','FLUSH','MIRROR','GROUP','REMARK'],
    ['T2-1','T2','PLANE','PLAN',   0,-125,-120,0, '','','','','','','','',      'BOX','Base plate'],
    ['S1-1','S1','EDGE','','','','','',           'T2-1','eb','eb',90,'S',-20,'IN','', 'BOX','Front side plate'],
    ['S1-2','S1','EDGE','','','','','',           'T2-1','eb','et',90,'S',-10,'IN','X','BOX','Rear side plate'],
    ['B1-1','B1','EDGE','','','','','',           'T2-1','eb','er',90,'S',  0,'OUT','','BOX','Right side plate'],
    ['T1-1','T1','PLANE','PLAN', 290,-175,-150,0, '','','','','','','','',      'BOX','Top plate'],
    ['C2-1','C2','PLANE','SIDE', -60, -60, 300,0, '','','','','','','','',      'COL','Column plate L'],
    ['C2-2','C2','PLANE','SIDE',  50, -60, 300,0, '','','','','','','','',      'COL','Column plate R'],
    ['C1-1','C1','PLANE','FRONT', 50, -50, 300,0, '','','','','','','','',      'COL','Column plate F'],
    ['C1-2','C1','PLANE','FRONT',-60, -50, 300,0, '','','','','','','','',      'COL','Column plate B'],
    ['F1-1','F1','PLANE','FRONT', -5,-265, 105,0, '','','','','','','','',      'ATT','Lug (assumed pos.)'],
    ['F2-1','F2','PLANE','PLAN', 110,-155,-120,0, '','','','','','','','',      'ATT','Shelf plate (assumed)'],
    ['F3-1','F3','PLANE','SIDE',-155,-120,  20,0, '','','','','','','','',      'ATT','Vertical lip (assumed)'],
    ['SA-1','SA','PLANE','PLAN', 240, -95,-120,0, '','','','','','','','',      'STF','Horiz. stiffener (assumed)'],
    ['SB-1','SB','PLANE','FRONT',110,-145,  10,0, '','','','','','','','',      'STF','Inner stiffener (assumed)'],
    ['BT-1','BOLT','PLANE','PLAN',282, -85,-110,0,'','','','','','','','',      'BLT','Leveling bolt'],
    ['BT-2','BOLT','PLANE','PLAN',282, -85, 110,0,'','','','','','','','',      'BLT','Leveling bolt'],
    ['BT-3','BOLT','PLANE','PLAN',282, 135,-110,0,'','','','','','','','',      'BLT','Leveling bolt'],
    ['BT-4','BOLT','PLANE','PLAN',282, 135, 110,0,'','','','','','','','',      'BLT','Leveling bolt']
  ],

  // optional colors — omitted IDs are assigned automatically
  colors: { T2:0x8d6e63, S1:0xc87137, B1:0x4caf50, T1:0x5c9bd1, C1:0xe0e0e0,
            C2:0xd4b13e, F1:0x7cb342, F2:0xba68c8, F3:0xf06292, SA:0x4dd0e1,
            SB:0x9575cd, BOLT:0xe8c84a }
};
