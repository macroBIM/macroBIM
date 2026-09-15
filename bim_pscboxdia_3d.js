/*
    bim_pscboxdia_3d.js — PSCBOX 격벽 세그먼트의 3D 뷰 (three.js)

    집 안의 다른 3D 와 같은 방식이다 : bim_draw_test_core.js 의 render3d() 가
    three.js(cdnjs r128) 와 OrbitControls 를 받아 온 뒤 이 전역 함수를 부른다.
    bim_box1cell_3d.js 가 단면을 밀어내는 것과 같은 자리에 있고, 다른 점은
    개구부를 뚫고 철근을 함께 세운다는 것이다.

    물리는 2D 그대로다. 인력장은 단면 하나에서 돌고, 여기서는 그 결과 좌표를
    교축(z)으로 펼 뿐이다 — 격벽이 평면 구조물이라 단면 하나로 자리가 정해진다.
    그래서 이 파일은 엔진을 모른다. 페이지가 평범한 배열로 넘겨 준다.

      render_pscboxdia_3d(hostId, {
        outer   : [[x,y], …]          박스 외곽 (닫힌 고리, mm)
        cells   : [[[x,y], …], …]     셀 (1 Cell 하나 · 2 Cell 둘)
        openings: [[[x,y], …], …]     격벽 개구부
        segLen  : 18000               세그먼트 길이
        diaT    : 600                 격벽 두께
        trebar  : [{id, dia, pts:[[x,y],…]}]   안착이 끝난 가로철근 (2D 폴리라인)
        lrebar  : [{id, dia, x, y}]            안착이 끝난 세로철근 (점)
        treCtc  : 150                 가로철근을 z 로 복제할 간격
      })

    단위는 mm 로 받아 장면에서 0.001 을 곱한다(= m). 카메라 거리와 근·원거리
    평면이 사람 키 정도 숫자여야 OrbitControls 가 자연스럽다.
*/

var PSCBOXDIA3D_MM = 0.001;

function pscboxdia3d_shape(outer, holes) {
    var s = new THREE.Shape(outer.map(function (p) {
        return new THREE.Vector2(p[0] * PSCBOXDIA3D_MM, p[1] * PSCBOXDIA3D_MM);
    }));
    (holes || []).forEach(function (h) {
        s.holes.push(new THREE.Path(h.map(function (p) {
            return new THREE.Vector2(p[0] * PSCBOXDIA3D_MM, p[1] * PSCBOXDIA3D_MM);
        })));
    });
    return s;
}

/* 폴리라인 하나를 철근 한 가닥으로. 지름이 실제 값이라 멀리서는 화소보다 얇다 —
   튜브와 함께 가는 선을 하나 더 그어 어느 거리에서도 보이게 한다. */
function pscboxdia3d_bar(pts3, dia, matTube, colLine) {
    var g = new THREE.Group();
    var curve = new THREE.CatmullRomCurve3(pts3, false, 'catmullrom', 0);
    g.add(new THREE.Mesh(
        new THREE.TubeGeometry(curve, Math.max(6, pts3.length * 4), dia / 2 * PSCBOXDIA3D_MM, 6, false),
        matTube));
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts3),
        new THREE.LineBasicMaterial({ color: colLine })));
    return g;
}

function render_pscboxdia_3d(hostId, cfg) {
    var host = document.getElementById(hostId);
    if (!host || typeof THREE === 'undefined') return;

    /* 입력을 고칠 때마다 이 함수가 다시 불린다. 그때 카메라가 처음 자리로
       돌아가 버리면 돌려 보던 사람이 매번 다시 돌려야 한다 — 보던 각도를
       기억했다가 되돌려 준다. */
    var keep = null;
    if (host._pscdia3d) {
        if (host._pscdia3d.animId) cancelAnimationFrame(host._pscdia3d.animId);
        var oc = host._pscdia3d.camera, ot = host._pscdia3d.target;
        if (oc) keep = { p: oc.position.clone(), t: ot ? ot.clone() : new THREE.Vector3(),
                         up: oc.up ? oc.up.clone() : null };
    }
    while (host.firstChild) host.removeChild(host.firstChild);

    var W = host.clientWidth || 800;
    var H = host.clientHeight || Math.round(W * 9 / 16);
    var MM = PSCBOXDIA3D_MM;
    var segLen = cfg.segLen || 18000;   // 지금은 안 쓴다 — 격벽 한 장만 그린다
    var diaT = cfg.diaT || 600;

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x41699b);       // 카드의 기존 2D 배경색과 같게

    var camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 500);
    var renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H);
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.0));
    var key = new THREE.DirectionalLight(0xffffff, 0.6); key.position.set(12, 20, 14); scene.add(key);

    var world = new THREE.Group();
    scene.add(world);

    /* ── 콘크리트 : 격벽 한 장 ────────────────────────────────────────
       이 화면은 격벽이다. 격벽에서는 셀이 콘크리트로 차 있으므로 셀을 뚫지
       않는다 — 외곽을 통째로 격벽 두께만큼 밀고 개구부만 구멍으로 남긴다.
       (처음엔 셀을 뚫고 세그먼트 길이 18,000 으로 밀어 일반구간까지 나왔다.
        입력한 것은 격벽 두께인데 일반구간이 같이 나오는 게 맞지 않았다.)      */
    var conMat = new THREE.MeshStandardMaterial({
        color: 0xdbeafe, transparent: true, opacity: 0.22, roughness: 0.9,
        side: THREE.DoubleSide, depthWrite: false
    });
    var slab = new THREE.Mesh(
        new THREE.ExtrudeGeometry(pscboxdia3d_shape(cfg.outer, cfg.openings || []),
            { depth: diaT * MM, bevelEnabled: false }), conMat);
    slab.position.z = -diaT * MM / 2;
    world.add(slab);
    world.add((function () {
        var e = new THREE.LineSegments(new THREE.EdgesGeometry(slab.geometry, 20),
            new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
        e.position.copy(slab.position);
        return e;
    })());

    /* 셀(박스의 중공) 자리를 앞뒤 면에 얇은 선으로만 남긴다 — 격벽이 어디를
       채우고 있는지 보이게. 콘크리트를 뚫지는 않는다. */
    var cellLineMat = new THREE.LineBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.55 });
    (cfg.cells || []).forEach(function (cell) {
        [-diaT / 2, diaT / 2].forEach(function (z) {
            var v = cell.concat([cell[0]]).map(function (p) {
                return new THREE.Vector3(p[0] * MM, p[1] * MM, z * MM);
            });
            world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(v), cellLineMat));
        });
    });

    /* ── 철근 ────────────────────────────────────────────────────────
       가로철근은 2D 에서 안착한 폴리라인을 z 로 ctc 간격 복제한다.
       세로철근은 안착한 점을 z 로 늘인다.                              */
    var matT = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.45, metalness: 0.25 });
    var matL = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.45, metalness: 0.25 });
    var gT = new THREE.Group(), gL = new THREE.Group();

    //  철근도 격벽 두께 안에서만 선다 — 이 화면이 보여 주는 것이 격벽 한 장이다
    var ctc = cfg.treCtc || 150;
    var n = Math.max(1, Math.round(diaT / ctc));
    var zs = [];
    for (var i = 0; i < n; i++) zs.push(-diaT / 2 + (diaT - (n - 1) * ctc) / 2 + i * ctc);

    (cfg.trebar || []).forEach(function (rb) {
        if (!rb.pts || rb.pts.length < 2) return;
        zs.forEach(function (z) {
            gT.add(pscboxdia3d_bar(rb.pts.map(function (p) {
                return new THREE.Vector3(p[0] * MM, p[1] * MM, z * MM);
            }), rb.dia || 13, matT, 0xfb923c));
        });
    });
    (cfg.lrebar || []).forEach(function (rb) {
        gL.add(pscboxdia3d_bar([
            new THREE.Vector3(rb.x * MM, rb.y * MM, -diaT / 2 * MM),
            new THREE.Vector3(rb.x * MM, rb.y * MM, diaT / 2 * MM)
        ], rb.dia || 13, matL, 0x4ade80));
    });
    world.add(gT, gL);

    /* ── 카메라 : 단면 전체가 들어오게 맞춘다 ─────────────────────────── */
    var bb = new THREE.Box3().setFromObject(world);
    var ctr = bb.getCenter(new THREE.Vector3());
    var size = bb.getSize(new THREE.Vector3());
    world.position.sub(ctr);                             // 원점으로 끌어온다
    var span = Math.max(size.x, size.y, size.z);

    var controls = null;
    if (typeof THREE.OrbitControls === 'function') {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
    }

    /* 시점 : 방향만 정하고 거리는 단면이 화면에 꽉 차도록 계산한다.
       x 는 교축 직각(단면 폭), y 는 위, z 는 교축이다. 그래서 FRONT 가
       격벽면(단면)을 정면으로 보는 시점이고, TOP 은 상판을 내려다본다. */
    //  d 보는 방향 · up 화면의 위 · w/h 그 시점에서 화면 가로·세로에 놓이는 치수
    var VIEWS = {
        iso:    { d: [0.55, 0.42, 0.85], up: [0, 1, 0], w: span,   h: span },
        front:  { d: [0, 0, 1],  up: [0, 1, 0],  w: size.x, h: size.y },
        back:   { d: [0, 0, -1], up: [0, 1, 0],  w: size.x, h: size.y },
        top:    { d: [0, 1, 0],  up: [0, 0, -1], w: size.x, h: size.z },
        bottom: { d: [0, -1, 0], up: [0, 0, 1],  w: size.x, h: size.z },
        left:   { d: [-1, 0, 0], up: [0, 1, 0],  w: size.z, h: size.y },
        right:  { d: [1, 0, 0],  up: [0, 1, 0],  w: size.z, h: size.y }
    };
    function setView(name) {
        var v = VIEWS[name] || VIEWS.iso;
        //  화각에 맞춰 거리를 정한다 — 가로·세로 중 빠듯한 쪽이 이긴다 (여유 12 %).
        //  마지막 항은 두께의 절반 — 가까운 면이 근거리 평면에 잘리지 않게.
        var t = Math.tan(camera.fov * Math.PI / 360);
        var dist = Math.max(v.h / 2 / t, v.w / 2 / (t * Math.max(camera.aspect, 0.2))) * 1.12
                 + span * 0.25;
        camera.up.set(v.up[0], v.up[1], v.up[2]);
        camera.position.copy(new THREE.Vector3(v.d[0], v.d[1], v.d[2]).normalize().multiplyScalar(dist));
        camera.lookAt(0, 0, 0);
        if (controls) { controls.target.set(0, 0, 0); controls.update(); }
    }

    if (keep && !cfg.view) {                     // 다시 그린 것뿐 — 보던 각도를 그대로
        camera.position.copy(keep.p);
        if (keep.up) camera.up.copy(keep.up);
        camera.lookAt(keep.t);
        if (controls) { controls.target.copy(keep.t); controls.update(); }
    } else {
        setView(cfg.view || 'iso');
    }

    function onResize() {
        var w = host.clientWidth || W, h = host.clientHeight || H;
        camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    var state = { animId: 0, scene: scene, world: world, gT: gT, gL: gL, camera: camera,
                  target: controls ? controls.target : new THREE.Vector3(),
                  setView: setView };       // 페이지의 시점 버튼이 부른다 (다시 세우지 않고 카메라만)
    host._pscdia3d = state;
    (function loop() {
        state.animId = requestAnimationFrame(loop);
        if (controls) controls.update();
        renderer.render(scene, camera);
    })();
    return state;
}
