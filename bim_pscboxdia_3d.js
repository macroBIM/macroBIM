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
                         up: oc.up ? oc.up.clone() : null,
                         zoom: oc.zoom, proj: host._pscdia3d.proj, view: host._pscdia3d.view };
    }
    while (host.firstChild) host.removeChild(host.firstChild);

    var W = host.clientWidth || 800;
    var H = host.clientHeight || Math.round(W * 9 / 16);
    var MM = PSCBOXDIA3D_MM;
    var segLen = cfg.segLen || 18000;   // 지금은 안 쓴다 — 격벽 한 장만 그린다
    var diaT = cfg.diaT || 600;

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x41699b);       // 카드의 기존 2D 배경색과 같게

    var FOV = 42, ASP = W / H;
    var camera = null;                       // setProjection() 이 정한다 (투시 / 정사)
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

    /* 시점 : 방향만 정하고 거리는 구조물이 화면에 꽉 차도록 계산한다.
       x 는 교축 직각(단면 폭), y 는 위, z 는 교축이다. 그래서 FRONT 가
       격벽면(단면)을 정면으로 보는 시점이고, TOP 은 상판을 내려다본다. */
    var VIEWS = {
        iso:    { d: [0.55, 0.42, 0.85], up: [0, 1, 0] },
        front:  { d: [0, 0, 1],  up: [0, 1, 0]  },
        back:   { d: [0, 0, -1], up: [0, 1, 0]  },
        top:    { d: [0, 1, 0],  up: [0, 0, -1] },
        bottom: { d: [0, -1, 0], up: [0, 0, 1]  },
        left:   { d: [-1, 0, 0], up: [0, 1, 0]  },
        right:  { d: [1, 0, 0],  up: [0, 1, 0]  }
    };

    /* 화면축 : 보는 방향 dir, 화면 오른쪽 right, 화면 위 up. */
    function frame(dirA, upA) {
        var dir = new THREE.Vector3(dirA[0], dirA[1], dirA[2]).normalize();
        var up0 = new THREE.Vector3(upA[0], upA[1], upA[2]);
        var right = new THREE.Vector3().crossVectors(dir, up0).normalize();
        var upv = new THREE.Vector3().crossVectors(right, dir).normalize();
        return { dir: dir, right: right, up: upv };
    }

    //  바운딩 박스의 여덟 꼭짓점 (원점 기준)
    var CORNERS = (function () {
        var hx = size.x / 2, hy = size.y / 2, hz = size.z / 2, out = [];
        [-1, 1].forEach(function (sx) { [-1, 1].forEach(function (sy) { [-1, 1].forEach(function (sz) {
            out.push(new THREE.Vector3(sx * hx, sy * hy, sz * hz));
        }); }); });
        return out;
    })();

    var PAD = 1.03;                  // 가장자리 여백 3 % — 거의 꽉 채운다

    /* 투시에서 카메라를 얼마나 물려야 여덟 꼭짓점이 모두 화면에 들어오는가.
       꼭짓점 p 가 화면에 들어올 조건은 |p·up| <= (D - p·dir)·t 이고 가로도 같다.
       이것을 D 로 풀어 꼭짓점마다 최댓값을 취하면 정확한 최소 거리다.

       예전에는 "가장 큰 반높이 / t + 가장 큰 반두께" 로 어림했다. 두 최댓값이
       서로 다른 꼭짓점에서 나오는데 그걸 같은 점인 양 더해서 카메라가 필요
       이상으로 물러났고 — ISO 에서 특히 심했다 — 구조물이 작게 보였다. */
    function fitPersp(f) {
        var t = Math.tan(FOV * Math.PI / 360), D = 0;
        CORNERS.forEach(function (p) {
            var pd = p.dot(f.dir), pu = Math.abs(p.dot(f.up)) * PAD, pr = Math.abs(p.dot(f.right)) * PAD;
            D = Math.max(D, pd + pu / t, pd + pr / (t * ASP));
        });
        return D;
    }
    //  정사는 거리와 크기가 무관하다 — 틀의 반높이만 구하면 된다
    function fitOrtho(f) {
        var hw = 0, hh = 0;
        CORNERS.forEach(function (p) {
            hw = Math.max(hw, Math.abs(p.dot(f.right)));
            hh = Math.max(hh, Math.abs(p.dot(f.up)));
        });
        return Math.max(hh, hw / ASP) * PAD;
    }
    //  이 방향으로 가장 먼 꼭짓점까지 — 근·원거리 평면을 정하는 데 쓴다
    function depth(f) {
        var d = 0;
        CORNERS.forEach(function (p) { d = Math.max(d, Math.abs(p.dot(f.dir))); });
        return d;
    }
    //  keep 이 있으면 그것이 이긴다 — 다시 그린 것뿐이므로 보던 상태를 잇는다.
    //  버튼은 장면이 서 있으면 setView/setProjection 으로 직접 가므로 여기로 오지 않는다.
    var proj = (keep && keep.proj) || cfg.proj || 'persp';   // 'persp' 투시 · 'ortho' 정사
    var view = (keep && keep.view) || cfg.view || 'iso';
    var controls = null;

    function makeControls() {
        if (typeof THREE.OrbitControls !== 'function') return;
        if (controls && controls.dispose) controls.dispose();
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
    }

    /* 투영법을 바꾼다. 정사(ortho)는 거리에 따라 작아지지 않으므로 정면도에서
       앞뒤 면이 같은 크기로 겹친다 — 도면과 같은 그림이 된다. 투시(persp)는
       눈으로 보는 그림이라 뒷면이 작다.
       카메라 객체 자체가 바뀌므로 OrbitControls 도 다시 만든다. */
    function setProjection(kind, keepAngle) {
        var v = VIEWS[view] || VIEWS.iso, f = frame(v.d, v.up), old = camera;
        var far = span * 8 + depth(f) * 4;
        proj = (kind === 'ortho') ? 'ortho' : 'persp';
        if (proj === 'ortho') {
            var hh = fitOrtho(f);
            camera = new THREE.OrthographicCamera(-hh * ASP, hh * ASP, hh, -hh, 0.01, far);
        } else {
            camera = new THREE.PerspectiveCamera(FOV, ASP, 0.05, far);
        }
        if (keepAngle && old) {                  // 보던 각도는 그대로 두고 투영만 바꾼다
            camera.position.copy(old.position);
            camera.up.copy(old.up);
            var tg = controls ? controls.target.clone() : new THREE.Vector3();
            camera.lookAt(tg);
            makeControls();
            if (controls) { controls.target.copy(tg); controls.update(); }
        } else {
            makeControls();
            setView(view);
        }
    }

    function setView(name) {
        if (VIEWS[name]) view = name;
        var v = VIEWS[view] || VIEWS.iso, f = frame(v.d, v.up);
        camera.up.set(v.up[0], v.up[1], v.up[2]);
        if (camera.isOrthographicCamera) {
            var hh = fitOrtho(f);
            camera.top = hh; camera.bottom = -hh;
            camera.left = -hh * ASP; camera.right = hh * ASP;
            camera.zoom = 1;
            camera.position.copy(f.dir.clone().multiplyScalar(depth(f) + span * 1.5));
        } else {
            camera.position.copy(f.dir.clone().multiplyScalar(fitPersp(f)));
        }
        camera.updateProjectionMatrix();
        camera.lookAt(0, 0, 0);
        if (controls) { controls.target.set(0, 0, 0); controls.update(); }
    }

    setProjection(proj, false);

    if (keep) {                                  // 다시 그린 것뿐 — 보던 각도를 그대로
        camera.position.copy(keep.p);
        if (keep.up) camera.up.copy(keep.up);
        if (keep.zoom) { camera.zoom = keep.zoom; camera.updateProjectionMatrix(); }
        camera.lookAt(keep.t);
        if (controls) { controls.target.copy(keep.t); controls.update(); }
    }

    function onResize() {
        var w = host.clientWidth || W, h = host.clientHeight || H;
        ASP = w / h;
        if (camera.isOrthographicCamera) {
            var hh = (camera.top - camera.bottom) / 2;
            camera.left = -hh * ASP; camera.right = hh * ASP;
        } else camera.aspect = ASP;
        camera.updateProjectionMatrix(); renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    /* camera 와 controls 는 투영법을 바꿀 때 새로 만들어진다 — 바깥에서 붙잡고
       있으면 옛 것을 보게 되므로 읽을 때마다 지금 것을 돌려 준다. */
    var state = {
        animId: 0, scene: scene, world: world, gT: gT, gL: gL,
        setView: setView,                       // 페이지의 시점 버튼 (다시 세우지 않고 카메라만)
        setProjection: function (k) { setProjection(k, true); },
        get camera() { return camera; },
        get target() { return controls ? controls.target : new THREE.Vector3(); },
        get view() { return view; },
        get proj() { return proj; }
    };
    host._pscdia3d = state;
    (function loop() {
        state.animId = requestAnimationFrame(loop);
        if (controls) controls.update();
        renderer.render(scene, camera);
    })();
    return state;
}
