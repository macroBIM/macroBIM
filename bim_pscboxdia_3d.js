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

    if (host._pscdia3d && host._pscdia3d.animId) cancelAnimationFrame(host._pscdia3d.animId);
    while (host.firstChild) host.removeChild(host.firstChild);

    var W = host.clientWidth || 800;
    var H = host.clientHeight || Math.round(W * 9 / 16);
    var MM = PSCBOXDIA3D_MM;
    var segLen = cfg.segLen || 18000;
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

    /* ── 콘크리트 : 외곽에서 셀을 뚫고 세그먼트 길이만큼 밀어낸다 ───────── */
    var conMat = new THREE.MeshStandardMaterial({
        color: 0xdbeafe, transparent: true, opacity: 0.18, roughness: 0.9,
        side: THREE.DoubleSide, depthWrite: false
    });
    var box = new THREE.Mesh(
        new THREE.ExtrudeGeometry(pscboxdia3d_shape(cfg.outer, cfg.cells || []),
            { depth: segLen * MM, bevelEnabled: false }), conMat);
    box.position.z = -segLen * MM / 2;
    world.add(box);
    world.add((function () {
        var e = new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry, 20),
            new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 }));
        e.position.copy(box.position);
        return e;
    })());

    /* ── 격벽 : 셀을 채우고 개구부를 뚫는다 ──────────────────────────── */
    var diaMat = new THREE.MeshStandardMaterial({
        color: 0x93c5fd, transparent: true, opacity: 0.30, roughness: 0.9,
        side: THREE.DoubleSide, depthWrite: false
    });
    (cfg.cells || []).forEach(function (cell) {
        //  이 셀 안에 들어가는 개구부만 그 셀의 구멍으로 준다
        var holes = (cfg.openings || []).filter(function (op) {
            var cx = op.reduce(function (s, p) { return s + p[0]; }, 0) / op.length;
            var xs = cell.map(function (p) { return p[0]; });
            return cx > Math.min.apply(null, xs) && cx < Math.max.apply(null, xs);
        });
        var d = new THREE.Mesh(
            new THREE.ExtrudeGeometry(pscboxdia3d_shape(cell, holes),
                { depth: diaT * MM, bevelEnabled: false }), diaMat);
        d.position.z = -diaT * MM / 2;
        world.add(d);
        var de = new THREE.LineSegments(new THREE.EdgesGeometry(d.geometry, 20),
            new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
        de.position.copy(d.position);
        world.add(de);
    });

    /* ── 철근 ────────────────────────────────────────────────────────
       가로철근은 2D 에서 안착한 폴리라인을 z 로 ctc 간격 복제한다.
       세로철근은 안착한 점을 z 로 늘인다.                              */
    var matT = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.45, metalness: 0.25 });
    var matL = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.45, metalness: 0.25 });
    var gT = new THREE.Group(), gL = new THREE.Group();

    var ctc = cfg.treCtc || 150;
    var n = Math.max(1, Math.floor(segLen / ctc));
    var zs = [];
    for (var i = 0; i < n; i++) zs.push(-segLen / 2 + ctc / 2 + i * ctc);

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
            new THREE.Vector3(rb.x * MM, rb.y * MM, -segLen / 2 * MM),
            new THREE.Vector3(rb.x * MM, rb.y * MM, segLen / 2 * MM)
        ], rb.dia || 13, matL, 0x4ade80));
    });
    world.add(gT, gL);

    /* ── 카메라 : 단면 전체가 들어오게 맞춘다 ─────────────────────────── */
    var bb = new THREE.Box3().setFromObject(world);
    var ctr = bb.getCenter(new THREE.Vector3());
    var size = bb.getSize(new THREE.Vector3());
    world.position.sub(ctr);                             // 원점으로 끌어온다
    var span = Math.max(size.x, size.y, size.z);
    camera.position.set(span * 0.55, span * 0.42, span * 0.85);
    camera.lookAt(0, 0, 0);

    var controls = null;
    if (typeof THREE.OrbitControls === 'function') {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
    }

    function onResize() {
        var w = host.clientWidth || W, h = host.clientHeight || H;
        camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    var state = { animId: 0, scene: scene, world: world, gT: gT, gL: gL, camera: camera };
    host._pscdia3d = state;
    (function loop() {
        state.animId = requestAnimationFrame(loop);
        if (controls) controls.update();
        renderer.render(scene, camera);
    })();
    return state;
}
