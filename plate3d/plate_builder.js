/* ============================================================
   plate_builder.js — PLATE/CUT/PLACE 데이터 방식 플레이트 조립 3D 엔진
   (DATA_SCHEMA.md 구현 · macroBIM/plate3d)

   사용법 — HTML에서 링크만 걸고 데이터를 전달:

     <script src="https://unpkg.com/three@0.147.0/build/three.min.js"></script>
     <script src="https://unpkg.com/three@0.147.0/examples/js/controls/OrbitControls.js"></script>
     <script src="https://unpkg.com/polybooljs@1.1.0/dist/polybool.min.js"></script>
     <script src="(이 파일의 jsDelivr URL)"></script>
     <script>
       plateBuilder.run({
         title: '내 조립품',
         PLATE: [ ['ID','SHAPE','B','TW','H','OF','D','THK','MAT'], ...행들 ],
         CUT:   [ ['PLATE','TYPE','D','B','TW','H','OF','U','V','ANG','NX','PX','NY','PY'], ... ],
         PLACE: [ ['NO','PLATE','METHOD','PLANE','OFFSET','U','V','ANG','TO','MY_EDGE','TO_EDGE',
                   'FOLD','ALIGN','SLIDE','FLUSH','MIRROR','GROUP','REMARK'], ... ]
       });
     </script>

   · 판 정의: 로컬 XY평면, pbl=(0,0), 두께 +z (TRAP: B/TW/H/OF, CIRC: D)
   · CUT: polybool 차집합 — 구멍/노치/절단 통합, NX·PX/NY·PY 배열 복제
   · PLACE: PLANE(FRONT/SIDE/PLAN + OFFSET/U/V/ANG) 또는
            EDGE(TO 인스턴스의 et/eb/el/er 변에 FOLD/ALIGN/SLIDE/FLUSH로 붙임)
   · 점 9개: ptl ptc ptr / plm pcc prm / pbl pbc pbr (절단 전 외곽 기준)
   ============================================================ */

(function () {
  'use strict';

  var RHO = 7.85e-6;   // 강재 밀도 kg/mm^3
  var PALETTE = [0xc87137, 0x4caf50, 0x5c9bd1, 0xd4b13e, 0xe0e0e0, 0x8d6e63,
                 0x7cb342, 0xba68c8, 0xf06292, 0x4dd0e1, 0x9575cd, 0xe8c84a,
                 0x81c784, 0x64b5f6, 0xffb74d, 0xa1887f];

  var CSS = [
    '#pb-app * { margin:0; padding:0; box-sizing:border-box; }',
    'body { background:#15181c; overflow:hidden; }',
    '#pb-app { display:flex; width:100vw; height:100vh; color:#d8dce2;',
    "  font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif; font-size:13px; }",
    '#pb-side { width:300px; min-width:300px; height:100%; overflow-y:auto; background:#1c2026;',
    '  border-right:1px solid #2c323b; padding:14px; }',
    '#pb-view { flex:1; height:100%; position:relative; }',
    '#pb-view canvas { display:block; }',
    '#pb-side h1 { font-size:15px; color:#fff; margin-bottom:2px; }',
    '#pb-side .sub { color:#8a93a0; font-size:11px; margin-bottom:12px; }',
    '#pb-side .btnrow { display:flex; gap:5px; flex-wrap:wrap; margin-bottom:12px; }',
    '#pb-side button { background:#2a3038; color:#d8dce2; border:1px solid #3a424d;',
    '  border-radius:4px; padding:5px 10px; cursor:pointer; font-size:12px; }',
    '#pb-side button:hover { background:#39424d; }',
    '#pb-side button.accent { background:#2b5c8a; border-color:#3a76ad; color:#fff; }',
    '#pb-side table { width:100%; border-collapse:collapse; margin-bottom:10px; }',
    '#pb-side td { padding:4px 2px; border-bottom:1px solid #23272e; vertical-align:middle; }',
    '#pb-side tr.ghead td { color:#f0c674; font-size:11px; padding-top:10px;',
    '  border-bottom:1px solid #2c323b; }',
    '#pb-side .chip { display:inline-block; width:11px; height:11px; border-radius:2px;',
    '  margin-right:5px; vertical-align:-1px; }',
    '#pb-side .dims { color:#8a93a0; font-size:11px; }',
    '#pb-total { color:#fff; font-size:12px; margin:6px 0 12px; }',
    '#pb-note { background:#22262d; border:1px solid #2c323b; border-radius:5px; padding:8px;',
    '  font-size:11px; color:#9aa3b0; line-height:1.55; }',
    '#pb-hud { position:absolute; left:10px; bottom:8px; color:#5b6472; font-size:11px;',
    '  pointer-events:none; }'
  ].join('\n');

  var scene, camera, renderer, controls;
  var CENTER = null, VDIST = 1200;                // run()에서 모델 크기로 설정
  var items = [];
  var runToken = 0;                               // 재실행(re-run) 구분용

  /* ---------------- 시트 파서 ---------------- */
  function sheetToObjects(sheet) {
    var head = sheet[0];
    return sheet.slice(1).map(function (row) {
      var o = {};
      head.forEach(function (h, i) { o[h] = row[i]; });
      return o;
    });
  }
  function num(v, dflt) { return (v === '' || v === undefined || v === null) ? dflt : Number(v); }

  /* ---------------- 2D 기하 ---------------- */
  function trapOutline(B, TW, H, OF) {              // CCW
    if (TW <= 0) return [[0, 0], [B, 0], [OF, H]];
    return [[0, 0], [B, 0], [OF + TW, H], [OF, H]];
  }
  function circleOutline(D, cx, cy, seg) {
    var pts = [];
    for (var i = 0; i < seg; i++) {
      var a = i / seg * Math.PI * 2;
      pts.push([cx + D / 2 * Math.cos(a), cy + D / 2 * Math.sin(a)]);
    }
    return pts;
  }
  function rotTrans(pts, ang, dx, dy) {
    var c = Math.cos(ang * Math.PI / 180), s = Math.sin(ang * Math.PI / 180);
    return pts.map(function (p) { return [p[0] * c - p[1] * s + dx, p[0] * s + p[1] * c + dy]; });
  }
  function ringArea(r) {
    var a = 0;
    for (var i = 0; i < r.length; i++) {
      var p = r[i], q = r[(i + 1) % r.length];
      a += p[0] * q[1] - q[0] * p[1];
    }
    return a / 2;
  }
  function pointInRing(pt, ring) {
    var x = pt[0], y = pt[1], inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  /* ---------------- 부재 형상: 외곽 − CUT들 ---------------- */
  function buildPlate2D(plate, cuts, plates) {
    var outline = plate.SHAPE === 'CIRC'
      ? circleOutline(num(plate.D, 0), 0, 0, 48)                       // CIRC: pcc=(0,0)
      : trapOutline(num(plate.B, 0), num(plate.TW, num(plate.B, 0)), num(plate.H, 0),
                    num(plate.OF, (num(plate.B, 0) - num(plate.TW, num(plate.B, 0))) / 2));

    var cutters = [];
    cuts.filter(function (c) { return c.PLATE === plate.ID; }).forEach(function (c) {
      var nx = num(c.NX, 1), px = num(c.PX, 0), ny = num(c.NY, 1), py = num(c.PY, 0);
      for (var ix = 0; ix < nx; ix++) for (var iy = 0; iy < ny; iy++) {
        var u = num(c.U, 0) + ix * px, v = num(c.V, 0) + iy * py;
        if (c.TYPE === 'CIRC') cutters.push(circleOutline(num(c.D, 0), u, v, 32));
        else if (c.TYPE === 'TRAP') {
          var tw = num(c.TW, num(c.B, 0));
          cutters.push(rotTrans(trapOutline(num(c.B, 0), tw, num(c.H, 0), num(c.OF, (num(c.B, 0) - tw) / 2)),
                                num(c.ANG, 0), u, v));
        } else if (c.TYPE === 'REF' && plates[c.REF]) {                // 다른 PLATE 외곽 차용
          var rp = plates[c.REF];
          var ro = rp.SHAPE === 'CIRC'
            ? circleOutline(num(rp.D, 0), 0, 0, 32)
            : trapOutline(num(rp.B, 0), num(rp.TW, num(rp.B, 0)), num(rp.H, 0),
                          num(rp.OF, (num(rp.B, 0) - num(rp.TW, num(rp.B, 0))) / 2));
          cutters.push(rotTrans(ro, num(c.ANG, 0), u, v));
        }
      }
    });

    var region = { regions: [outline], inverted: false };
    cutters.forEach(function (cu) {
      region = PolyBool.difference(region, { regions: [cu], inverted: false });
    });

    var rings = region.regions.filter(function (r) { return r.length >= 3; });
    var outers = [], holes = [];
    rings.forEach(function (r) {
      var depth = 0;
      rings.forEach(function (s) { if (s !== r && pointInRing(r[0], s)) depth++; });
      (depth % 2 ? holes : outers).push(r);
    });
    var area = 0;
    outers.forEach(function (r) { area += Math.abs(ringArea(r)); });
    holes.forEach(function (r) { area -= Math.abs(ringArea(r)); });

    return { outers: outers,
             holes: outers.map(function (o) {
               return holes.filter(function (h) { return pointInRing(h[0], o); });
             }),
             area: area };
  }

  /* ---------------- 점·변 (절단 전 외곽, MIRROR 반영) ---------------- */
  function namedPoints(plate, mirror) {
    var p;
    function mid(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
    if (plate.SHAPE === 'CIRC') {
      var r = num(plate.D, 0) / 2;
      p = { pcc: [0, 0], ptc: [0, r], pbc: [0, -r], plm: [-r, 0], prm: [r, 0] };
      p.ptl = p.ptr = p.ptc; p.pbl = p.pbr = p.pbc;
      return p;
    }
    var B = num(plate.B, 0), TW = num(plate.TW, B), H = num(plate.H, 0),
        OF = num(plate.OF, (B - TW) / 2);
    p = { pbl: [0, 0], pbr: [B, 0], ptr: [OF + TW, H], ptl: [OF, H] };
    if (mirror) {
      var lo = Math.min(0, OF), hi = Math.max(B, OF + TW), m = lo + hi;
      var M = function (q) { return [m - q[0], q[1]]; };
      p = { pbl: M(p.pbr), pbr: M(p.pbl), ptl: M(p.ptr), ptr: M(p.ptl) };
    }
    p.pbc = mid(p.pbl, p.pbr); p.ptc = mid(p.ptl, p.ptr);
    p.plm = mid(p.pbl, p.ptl); p.prm = mid(p.pbr, p.ptr);
    p.pcc = [(p.pbl[0] + p.pbr[0] + p.ptr[0] + p.ptl[0]) / 4,
             (p.pbl[1] + p.pbr[1] + p.ptr[1] + p.ptl[1]) / 4];
    return p;
  }
  function edgeOf(pts, name) {                       // CCW: 내부가 진행방향 왼쪽
    return { eb: [pts.pbl, pts.pbr], er: [pts.pbr, pts.ptr],
             et: [pts.ptr, pts.ptl], el: [pts.ptl, pts.pbl] }[name];
  }
  function mirror2D(ringList, plate) {
    var B = num(plate.B, 0), TW = num(plate.TW, B), OF = num(plate.OF, (B - TW) / 2);
    var lo = Math.min(0, OF), hi = Math.max(B, OF + TW), m = lo + hi;
    return ringList.map(function (ring) {
      return ring.map(function (q) { return [m - q[0], q[1]]; }).reverse();
    });
  }

  /* ---------------- 배치 행렬 ---------------- */
  var PLANE_BASIS = {
    FRONT: { ex: [1, 0, 0],  ey: [0, 1, 0],  ez: [0, 0, 1] },   // x→X, y→Y, 두께→+Z
    SIDE:  { ex: [0, 0, -1], ey: [0, 1, 0],  ez: [1, 0, 0] },   // x→−Z, y→Y, 두께→+X
    PLAN:  { ex: [1, 0, 0],  ey: [0, 0, -1], ez: [0, 1, 0] }    // x→X, y→−Z, 두께→+Y
  };
  function v3(a) { return new THREE.Vector3(a[0], a[1], a[2]); }

  function planeMatrix(row) {
    var b = PLANE_BASIS[row.PLANE];
    if (!b) throw new Error(row.NO + ': PLANE=' + row.PLANE + ' (FRONT/SIDE/PLAN 중 하나)');
    var m = new THREE.Matrix4().makeBasis(v3(b.ex), v3(b.ey), v3(b.ez));
    m.multiply(new THREE.Matrix4().makeTranslation(num(row.U, 0), num(row.V, 0), num(row.OFFSET, 0)));
    m.multiply(new THREE.Matrix4().makeRotationZ(num(row.ANG, 0) * Math.PI / 180));
    return m;
  }

  function edgeMatrix(row, inst, myPts, myTHK) {
    var tgt = inst[row.TO];
    if (!tgt) throw new Error(row.NO + ': TO=' + row.TO + ' 미정의 (앞선 행만 참조 가능)');
    var te = edgeOf(tgt.pts, row.TO_EDGE);
    if (!te) throw new Error(row.NO + ': TO_EDGE=' + row.TO_EDGE);
    var A = v3([te[0][0], te[0][1], tgt.thk]).applyMatrix4(tgt.matrix);   // 힌지 = 대상 앞면의 변
    var Bp = v3([te[1][0], te[1][1], tgt.thk]).applyMatrix4(tgt.matrix);
    var n = new THREE.Vector3().setFromMatrixColumn(tgt.matrix, 2).normalize();
    var d = Bp.clone().sub(A), Lt = d.length(); d.normalize();
    var out = d.clone().cross(n);                                          // 바깥쪽

    var th = (180 - num(row.FOLD, 90)) * Math.PI / 180;                    // 180=이어붙임, 90=직각
    var ex = d.clone();
    var ey = out.clone().multiplyScalar(Math.cos(th))
                .add(n.clone().multiplyScalar(Math.sin(th))).normalize();
    var ez = ex.clone().cross(ey);

    var me = edgeOf(myPts, row.MY_EDGE);
    if (!me) throw new Error(row.NO + ': MY_EDGE=' + row.MY_EDGE);
    var s = me[0], e = me[1];
    var Lm = Math.hypot(e[0] - s[0], e[1] - s[1]);
    if (Lm < 1e-9) throw new Error(row.NO + ': ' + row.MY_EDGE + ' 변이 퇴화 (삼각형 꼭짓점)');
    var phi = Math.atan2(e[1] - s[1], e[0] - s[0]);
    var r0 = new THREE.Matrix4().makeRotationZ(-phi)
               .multiply(new THREE.Matrix4().makeTranslation(-s[0], -s[1], 0));

    var align = { S: 0, C: (Lt - Lm) / 2, E: Lt - Lm }[row.ALIGN || 'S'] + num(row.SLIDE, 0);
    var flush = { OUT: -myTHK, C: -myTHK / 2, IN: 0 }[row.FLUSH || 'C'];
    var origin = A.clone().add(d.clone().multiplyScalar(align)).add(ez.clone().multiplyScalar(flush));

    return new THREE.Matrix4().makeBasis(ex, ey, ez).setPosition(origin).multiply(r0);
  }

  /* ---------------- 씬 구성 ---------------- */
  function buildAll(data, colors) {
    var plates = {}, cuts = sheetToObjects(data.CUT || [[]]);
    var colorSeq = 0;
    sheetToObjects(data.PLATE).forEach(function (p) {
      plates[p.ID] = p;
      if (!(p.ID in colors)) colors[p.ID] = PALETTE[colorSeq++ % PALETTE.length];
    });
    var inst = {};
    var bbox = new THREE.Box3();

    sheetToObjects(data.PLACE).forEach(function (row) {
      var plate = plates[row.PLATE];
      if (!plate) { console.error(row.NO + ': PLATE=' + row.PLATE + ' 없음'); return; }
      var thk = num(plate.THK, 10);
      var mirror = row.MIRROR === 'X';
      var g2d = buildPlate2D(plate, cuts, plates);
      var outers = g2d.outers, holesArr = g2d.holes;
      if (mirror) {
        outers = mirror2D(outers, plate);
        holesArr = holesArr.map(function (hs) { return mirror2D(hs, plate); });
      }
      var pts = namedPoints(plate, mirror);

      var matrix;
      try {
        matrix = row.METHOD === 'EDGE' ? edgeMatrix(row, inst, pts, thk) : planeMatrix(row);
      } catch (err) { console.error(err.message); return; }
      inst[row.NO] = { matrix: matrix, pts: pts, thk: thk };

      var groupObj = new THREE.Group();
      var mat = new THREE.MeshPhongMaterial({ color: colors[row.PLATE], shininess: 28 });
      outers.forEach(function (ring, i) {
        var shape = new THREE.Shape(ring.map(function (q) { return new THREE.Vector2(q[0], q[1]); }));
        holesArr[i].forEach(function (h) {
          shape.holes.push(new THREE.Path(h.map(function (q) { return new THREE.Vector2(q[0], q[1]); })));
        });
        var geo = new THREE.ExtrudeGeometry(shape, { depth: thk, bevelEnabled: false, curveSegments: 24 });
        var mesh = new THREE.Mesh(geo, mat);
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(matrix);
        groupObj.add(mesh);
        geo.computeBoundingBox();
        bbox.union(geo.boundingBox.clone().applyMatrix4(matrix));
        var edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25),
                                          new THREE.LineBasicMaterial({ color: 0x0e1013 }));
        edge.matrixAutoUpdate = false;
        edge.matrix.copy(matrix);
        groupObj.add(edge);
      });
      scene.add(groupObj);

      var dims = plate.SHAPE === 'CIRC'
        ? 'Ø' + plate.D + '×' + thk
        : plate.B + '×' + plate.H + '×' + thk + 'T';
      items.push({ no: row.NO, plateId: row.PLATE, group: row.GROUP || '-',
                   groupObj: groupObj, mass: g2d.area * thk * RHO,
                   dims: dims, remark: row.REMARK || '' });
    });
    return bbox;
  }

  /* ---------------- 좌측 리스트 ---------------- */
  function buildList(colors) {
    var tbl = document.getElementById('pb-list');
    var total = 0, lastGroup = null;
    items.forEach(function (it, i) {
      total += it.mass;
      if (it.group !== lastGroup) {
        lastGroup = it.group;
        var gtr = document.createElement('tr');
        gtr.className = 'ghead';
        gtr.innerHTML = '<td><input type="checkbox" checked ' +
          'onchange="plateBuilder.toggleGroup(\'' + it.group + '\',this.checked)"></td>' +
          '<td colspan="2">▾ ' + it.group + '</td>';
        tbl.appendChild(gtr);
      }
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><input type="checkbox" checked id="pb-cb' + i + '" ' +
        'onchange="plateBuilder.toggleItem(' + i + ',this.checked)"></td>' +
        '<td><span class="chip" style="background:#' +
        ('000000' + colors[it.plateId].toString(16)).slice(-6) + '"></span>' +
        it.no + '<div class="dims">' + it.dims + (it.remark ? ' · ' + it.remark : '') + '</div></td>' +
        '<td class="dims">' + it.mass.toFixed(1) + 'kg</td>';
      tbl.appendChild(tr);
    });
    document.getElementById('pb-total').textContent =
      '부재 ' + items.length + '개 · 총 중량 ' + total.toFixed(1) + ' kg';
  }
  function toggleItem(i, on) { items[i].groupObj.visible = on; }
  function toggleGroup(g, on) {
    items.forEach(function (it, i) {
      if (it.group === g) {
        it.groupObj.visible = on;
        document.getElementById('pb-cb' + i).checked = on;
      }
    });
  }

  /* ---------------- STL ---------------- */
  function exportSTL() {
    var out = 'solid plate_builder\n';
    scene.updateMatrixWorld(true);
    items.forEach(function (it) {
      if (!it.groupObj.visible) return;
      it.groupObj.traverse(function (obj) {
        if (!obj.isMesh) return;
        var pos = obj.geometry.getAttribute('position');
        if (!pos) return;
        var idx = obj.geometry.getIndex();
        var n = idx ? idx.count / 3 : pos.count / 3;
        for (var i = 0; i < n; i++) {
          var a = idx ? idx.getX(i * 3) : i * 3;
          var b = idx ? idx.getX(i * 3 + 1) : i * 3 + 1;
          var c = idx ? idx.getX(i * 3 + 2) : i * 3 + 2;
          var vA = new THREE.Vector3().fromBufferAttribute(pos, a).applyMatrix4(obj.matrixWorld);
          var vB = new THREE.Vector3().fromBufferAttribute(pos, b).applyMatrix4(obj.matrixWorld);
          var vC = new THREE.Vector3().fromBufferAttribute(pos, c).applyMatrix4(obj.matrixWorld);
          var nr = new THREE.Vector3().crossVectors(
            new THREE.Vector3().subVectors(vB, vA),
            new THREE.Vector3().subVectors(vC, vA)).normalize();
          out += ' facet normal ' + nr.x + ' ' + nr.y + ' ' + nr.z + '\n  outer loop\n' +
                 '   vertex ' + vA.x + ' ' + vA.y + ' ' + vA.z + '\n' +
                 '   vertex ' + vB.x + ' ' + vB.y + ' ' + vB.z + '\n' +
                 '   vertex ' + vC.x + ' ' + vC.y + ' ' + vC.z + '\n  endloop\n endfacet\n';
        }
      });
    });
    out += 'endsolid plate_builder\n';
    var link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([out], { type: 'application/octet-stream' }));
    link.download = 'plate_builder.stl';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  /* ---------------- 뷰 ---------------- */
  function setView(v) {
    var d = VDIST;
    if (v === 'front') camera.position.set(CENTER.x, CENTER.y, CENTER.z + d);
    if (v === 'side')  camera.position.set(CENTER.x + d, CENTER.y, CENTER.z);
    if (v === 'top')   camera.position.set(CENTER.x, CENTER.y + d, CENTER.z + 0.01);
    if (v === 'iso')   camera.position.set(CENTER.x + d * 0.58, CENTER.y + d * 0.5, CENTER.z + d * 0.65);
    controls.target.copy(CENTER);
    controls.update();
  }

  /* ---------------- DOM 생성 + 초기화 ---------------- */
  function buildDOM(title, subtitle, note) {
    if (!document.getElementById('pb-style')) {
      var style = document.createElement('style');
      style.id = 'pb-style';
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    var old = document.getElementById('pb-app');
    if (old) old.parentNode.removeChild(old);
    var app = document.createElement('div');
    app.id = 'pb-app';
    app.innerHTML =
      '<div id="pb-side">' +
      '  <h1></h1><div class="sub"></div>' +
      '  <div class="btnrow">' +
      '    <button class="accent" onclick="plateBuilder.setView(\'iso\')">ISO</button>' +
      '    <button onclick="plateBuilder.setView(\'front\')">정면</button>' +
      '    <button onclick="plateBuilder.setView(\'side\')">측면</button>' +
      '    <button onclick="plateBuilder.setView(\'top\')">평면</button>' +
      '    <button onclick="plateBuilder.exportSTL()">STL 저장</button>' +
      '  </div>' +
      '  <table id="pb-list"></table>' +
      '  <div id="pb-total"></div>' +
      '  <div id="pb-note"></div>' +
      '</div>' +
      '<div id="pb-view"><div id="pb-hud">드래그: 회전 · 휠: 줌 · 우클릭 드래그: 이동</div></div>';
    document.body.appendChild(app);
    app.querySelector('h1').textContent = title;
    app.querySelector('.sub').textContent = subtitle;
    var noteEl = document.getElementById('pb-note');
    if (note) noteEl.textContent = note; else noteEl.style.display = 'none';
  }

  function run(data) {
    if (typeof THREE === 'undefined' || typeof PolyBool === 'undefined') {
      alert('three.js / polybooljs 라이브러리를 먼저 로드하세요.');
      return;
    }
    data = data || {};
    data.PLATE = data.PLATE || [[]];
    data.CUT = data.CUT || [[]];
    data.PLACE = data.PLACE || [[]];
    runToken++;
    var token = runToken;
    items = [];

    var empty = data.PLACE.length <= 1;
    buildDOM(data.title || '플레이트 빌더',
             data.subtitle || 'PLATE / CUT / PLACE 데이터 방식 · 단위 mm',
             data.note || (empty
               ? '데이터가 비어 있습니다. PLATE/CUT/PLACE 배열을 window.PLATE_DATA 로 ' +
                 '정의하거나 plateBuilder.run({...})으로 전달하면 모델이 표시됩니다.'
               : null));

    var container = document.getElementById('pb-view');
    var w = container.clientWidth, h = container.clientHeight;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x15181c);
    camera = new THREE.PerspectiveCamera(40, w / h, 1, 50000);
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xf4f6fa, 0x2a2d33, 0.95));
    var sun = new THREE.DirectionalLight(0xffffff, 0.75);
    sun.position.set(500, 900, 650);
    scene.add(sun);
    var back = new THREE.DirectionalLight(0x8899bb, 0.3);
    back.position.set(-600, 300, -500);
    scene.add(back);

    var colors = data.colors || {};
    var bbox = buildAll(data, colors);
    buildList(colors);

    CENTER = bbox.isEmpty() ? new THREE.Vector3(0, 150, 0) : bbox.getCenter(new THREE.Vector3());
    var size = bbox.isEmpty() ? 900 : bbox.getSize(new THREE.Vector3()).length();
    VDIST = size * 1.5 + 200;

    var grid = new THREE.GridHelper(Math.ceil(size / 400) * 800, 32, 0x39424d, 0x242a31);
    grid.position.y = -1;
    scene.add(grid);

    /* ---- 우상단 좌표축 표시 (카메라 회전을 따라 도는 미니 gizmo) ---- */
    var axesScene = new THREE.Scene();
    var axesCamera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    [{ v: [1, 0, 0], c: 0xe05c4f, label: 'X' },
     { v: [0, 1, 0], c: 0x6fc36f, label: 'Y' },
     { v: [0, 0, 1], c: 0x5c9bd1, label: 'Z' }].forEach(function (d) {
      axesScene.add(new THREE.ArrowHelper(v3(d.v), new THREE.Vector3(0, 0, 0), 1.6, d.c, 0.35, 0.18));
      var cv = document.createElement('canvas');
      cv.width = cv.height = 128;
      var ctx = cv.getContext('2d');
      ctx.font = 'bold 84px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#' + ('000000' + d.c.toString(16)).slice(-6);
      ctx.fillText(d.label, 64, 68);
      var spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true }));
      spr.position.copy(v3(d.v).multiplyScalar(2.1));
      spr.scale.set(0.9, 0.9, 1);
      axesScene.add(spr);
    });

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    setView('iso');

    window.addEventListener('resize', function () {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    });

    (function animate() {
      if (token !== runToken) return;             // 재실행되면 이전 루프 종료
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);

      // 우상단 gizmo: 메인 카메라의 방향만 복사해 작은 뷰포트에 렌더
      var gs = 110, gm = 8;
      var cw = container.clientWidth, ch = container.clientHeight;
      axesCamera.position.copy(camera.position).sub(controls.target).normalize().multiplyScalar(8.4);
      axesCamera.up.copy(camera.up);
      axesCamera.lookAt(0, 0, 0);
      renderer.autoClear = false;
      renderer.setScissorTest(true);
      renderer.setViewport(cw - gs - gm, ch - gs - gm, gs, gs);
      renderer.setScissor(cw - gs - gm, ch - gs - gm, gs, gs);
      renderer.clearDepth();
      renderer.render(axesScene, axesCamera);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, cw, ch);
      renderer.autoClear = true;
    })();
  }

  window.plateBuilder = {
    run: run, setView: setView, exportSTL: exportSTL,
    toggleItem: toggleItem, toggleGroup: toggleGroup
  };

  /* ---- 자동 실행: window.PLATE_DATA 가 있으면 그 데이터로, 없으면 빈 화면 ----
     (HTML에 링크만 있어도 기본 포맷이 뜨도록. plateBuilder.run()을 직접
      호출한 경우에는 자동 실행하지 않음) */
  function autorun() { if (!runToken) run(window.PLATE_DATA || {}); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autorun);
  } else {
    setTimeout(autorun, 0);
  }
})();
