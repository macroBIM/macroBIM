/*
    bim_liftinglug_3d.js — Three.js 3D renderer for a lifting lug.
    Geometry:
      - Main lug body: front outline (base rectangle + tangent lines +
        top arc) with an inner hole (radius innerR), extruded by lugT
        centered on Z = 0.
      - Two padeye reinforcement plates: annulus (outer padeyeR, inner
        innerR) centered on the arc center, extruded by
        (padeyeT - lugT)/2 on each side of the lug plate.

    All Y coordinates are flipped so "up" in the CAD input (positive Y)
    matches Three.js' +Y-up convention.

    Caller passes the geo object produced by geo_liftinglug() —
    geo.Rcx, Rcy, Tlx/Tly/Trx/Try, arc_angb/arc_ange (degrees),
    geo.aparam (lugW, lugH, baseH, outerR, innerR, padeyeR, lugT, padeyeT).
*/
function _exportSTL_lug(meshes, filename) {
    var output = 'solid liftinglug\n';
    meshes.forEach(function (mesh) {
        var geo = mesh.geometry;
        var pos = geo.getAttribute('position');
        if (!pos) return;
        var idx = geo.getIndex();
        var triCount = idx ? idx.count / 3 : pos.count / 3;
        for (var i = 0; i < triCount; i++) {
            var a, b, c;
            if (idx) { a = idx.getX(i * 3); b = idx.getX(i * 3 + 1); c = idx.getX(i * 3 + 2); }
            else { a = i * 3; b = i * 3 + 1; c = i * 3 + 2; }
            var vA = new THREE.Vector3(pos.getX(a), pos.getY(a), pos.getZ(a));
            var vB = new THREE.Vector3(pos.getX(b), pos.getY(b), pos.getZ(b));
            var vC = new THREE.Vector3(pos.getX(c), pos.getY(c), pos.getZ(c));
            var n = new THREE.Vector3().crossVectors(
                new THREE.Vector3().subVectors(vB, vA),
                new THREE.Vector3().subVectors(vC, vA)).normalize();
            output += '  facet normal ' + n.x + ' ' + n.y + ' ' + n.z + '\n    outer loop\n';
            output += '      vertex ' + vA.x + ' ' + vA.y + ' ' + vA.z + '\n';
            output += '      vertex ' + vB.x + ' ' + vB.y + ' ' + vB.z + '\n';
            output += '      vertex ' + vC.x + ' ' + vC.y + ' ' + vC.z + '\n';
            output += '    endloop\n  endfacet\n';
        }
    });
    output += 'endsolid liftinglug\n';
    var link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([output], { type: 'application/octet-stream' }));
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

function render_liftinglug_3d(containerId, geo) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (container._animId) cancelAnimationFrame(container._animId);
    while (container.firstChild) container.removeChild(container.firstChild);

    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;

    const { lugW, lugH, baseH, outerR, innerR, padeyeR, lugT, padeyeT } = geo.aparam;
    const { Rcx, Rcy, Tlx, Tly, Trx, Try, arc_angb, arc_ange } = geo;
    const sideH = geo.sideH || baseH;                 // straight-side height (with lower-body extension)
    const opt = geo.opt || {};
    const pads = opt.padOn !== false;                 // padeye ring / cheek plates
    const hasBase = opt.bpOn === 'plate';
    const bpW = geo.aparam.bpW || lugW * 1.6, bpT = geo.aparam.bpT || 20, bpL = geo.aparam.bpL || padeyeT * 2.2;
    const spOn = opt.spOn === true;                   // independent left / right side plates
    const a = geo.aparam;
    const spL = { bot: a.spBotL || 0, top: a.spTopL || 0, h: a.spHL || 0, w: a.spWL || 0, inset: a.spInsetL || 0, on: opt.spOnL !== false };
    const spR = { bot: a.spBotR || 0, top: a.spTopR || 0, h: a.spHR || 0, w: a.spWR || 0, inset: a.spInsetR || 0, on: opt.spOnR !== false };

    // === Build the front outline as a THREE.Shape ===
    // (base rectangle + tangent lines + top arc, with a circular hole for innerR)
    const shape = new THREE.Shape();
    shape.moveTo(-lugW / 2, 0);
    shape.lineTo(lugW / 2, 0);
    shape.lineTo(lugW / 2, sideH);
    shape.lineTo(Trx, Try);
    // arc from Trx,Try around (Rcx, Rcy) to Tlx, Tly
    const angb = arc_angb * Math.PI / 180;
    const ange = arc_ange * Math.PI / 180;
    shape.absarc(Rcx, Rcy, outerR, angb, ange, false);
    shape.lineTo(-lugW / 2, sideH);
    shape.lineTo(-lugW / 2, 0);

    // Hole
    const holePath = new THREE.Path();
    holePath.absarc(Rcx, Rcy, innerR, 0, Math.PI * 2, false);
    shape.holes.push(holePath);

    const lugGeo = new THREE.ExtrudeGeometry(shape, {
        depth: lugT,
        bevelEnabled: false,
        curveSegments: 48,
    });
    // ExtrudeGeometry extrudes from z=0 → z=depth. Shift so it's centered on z=0.
    lugGeo.translate(0, 0, -lugT / 2);

    // === Padeye annulus (outer padeyeR, inner innerR) ===
    const peShape = new THREE.Shape();
    peShape.absarc(Rcx, Rcy, padeyeR, 0, Math.PI * 2, false);
    const peHole = new THREE.Path();
    peHole.absarc(Rcx, Rcy, innerR, 0, Math.PI * 2, false);
    peShape.holes.push(peHole);

    const peDepth = Math.max((padeyeT - lugT) / 2, 0);
    const peGeoRight = new THREE.ExtrudeGeometry(peShape, {
        depth: peDepth,
        bevelEnabled: false,
        curveSegments: 48,
    });
    peGeoRight.translate(0, 0, lugT / 2);

    const peGeoLeft = new THREE.ExtrudeGeometry(peShape, {
        depth: peDepth,
        bevelEnabled: false,
        curveSegments: 48,
    });
    peGeoLeft.translate(0, 0, -lugT / 2 - peDepth);

    // === Base (supporting) plate — sits just below the lug base (y = 0) ===
    let baseMesh = null;
    if (hasBase) {
        const baseGeo = new THREE.BoxGeometry(bpW, bpT, bpL);
        baseGeo.translate(0, -bpT / 2, 0);
        const baseMat = new THREE.MeshPhongMaterial({
            color: 0xf59e0b, side: THREE.DoubleSide, transparent: true, opacity: 0.72
        });
        baseMesh = new THREE.Mesh(baseGeo, baseMat);
    }

    // === Trapezoidal side plates: independent left / right, straddling the lug ===
    const spMeshes = [];
    if (spOn) {
        const spMat = new THREE.MeshPhongMaterial({
            color: 0xa855f7, side: THREE.DoubleSide, transparent: true, opacity: 0.7
        });
        // right band [in, out]; left band mirrored
        spR.in = lugW / 2 + spR.inset; spR.out = spR.in + spR.w;
        spL.in = -(lugW / 2 + spL.inset); spL.out = spL.in - spL.w;
        const lugTopAt = function (x) {
            if (Math.abs(x) > lugW / 2) return 0;
            const dx = x - Rcx; let t = sideH;
            if (Math.abs(dx) < outerR) t = Math.max(t, Rcy + Math.sqrt(outerR * outerR - dx * dx));
            return t;
        };
        [spR, spL].forEach(function (s) {
            if (!s.on || !((s.bot > 0 || s.top > 0) && s.h > 0 && s.w > 0)) return;
            const zbo = s.bot / 2, zto = s.top / 2, xEnd = Math.max(s.in, s.out);
            const lo = Math.min(s.in, s.out), hi = Math.max(s.in, s.out);
            const splitH = Math.min(s.h, lugTopAt(Math.max(lo, Math.min(hi, Rcx))));
            const shapes = [];
            if (s.inset < 0 && zbo > lugT / 2 && splitH > 0.01) {
                const zSp = zbo + (zto - zbo) * (Math.min(splitH, s.h) / s.h);   // outer z at splitH
                // two flanks up to splitH
                [1, -1].forEach(function (sgn) {
                    const sh = new THREE.Shape();
                    sh.moveTo(sgn * lugT / 2, 0); sh.lineTo(sgn * zbo, 0); sh.lineTo(sgn * zSp, splitH); sh.lineTo(sgn * lugT / 2, splitH); sh.closePath();
                    shapes.push(sh);
                });
                // solid piece above splitH (merged)
                if (splitH < s.h - 0.01) {
                    const sh = new THREE.Shape();
                    sh.moveTo(-zSp, splitH); sh.lineTo(zSp, splitH); sh.lineTo(zto, s.h); sh.lineTo(-zto, s.h); sh.closePath();
                    shapes.push(sh);
                }
            } else {
                const sh = new THREE.Shape();
                sh.moveTo(-zbo, 0); sh.lineTo(zbo, 0); sh.lineTo(zto, s.h); sh.lineTo(-zto, s.h); sh.closePath();
                shapes.push(sh);
            }
            shapes.forEach(function (sh) {
                const gsp = new THREE.ExtrudeGeometry(sh, { depth: s.w, bevelEnabled: false });
                gsp.rotateY(-Math.PI / 2);                   // local x→Z, extrude→−X
                gsp.translate(xEnd, 0, 0);
                spMeshes.push(new THREE.Mesh(gsp, spMat));
            });
        });
    }

    // === Materials & meshes ===
    const lugMat = new THREE.MeshPhongMaterial({
        color: 0x4488aa, side: THREE.DoubleSide, transparent: true, opacity: 0.75
    });
    const peMat = new THREE.MeshPhongMaterial({
        color: 0x22aa66, side: THREE.DoubleSide, transparent: true, opacity: 0.8
    });

    const lugMesh = new THREE.Mesh(lugGeo, lugMat);
    const peRightMesh = new THREE.Mesh(peGeoRight, peMat);
    const peLeftMesh = new THREE.Mesh(peGeoLeft, peMat);

    // Edge lines
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x00ffff });
    const peEdgeMat = new THREE.LineBasicMaterial({ color: 0x00ff88 });
    const baseEdgeMat = new THREE.LineBasicMaterial({ color: 0xffcc66 });
    const edgeGroup = new THREE.Group();
    edgeGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(lugGeo, 30), edgeMat));
    if (pads && peDepth > 0) {
        edgeGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(peGeoRight, 30), peEdgeMat));
        edgeGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(peGeoLeft, 30), peEdgeMat));
    }
    if (baseMesh) edgeGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(baseMesh.geometry, 30), baseEdgeMat));
    const spEdgeMat = new THREE.LineBasicMaterial({ color: 0xc084fc });
    spMeshes.forEach(function (m) { edgeGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 30), spEdgeMat)); });

    // === Scene ===
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    scene.add(lugMesh);
    if (pads && peDepth > 0) {
        scene.add(peRightMesh);
        scene.add(peLeftMesh);
    }
    if (baseMesh) scene.add(baseMesh);
    spMeshes.forEach(function (m) { scene.add(m); });
    scene.add(edgeGroup);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dl1 = new THREE.DirectionalLight(0xffffff, 0.6);
    dl1.position.set(1, 1, 1).normalize();
    scene.add(dl1);
    const dl2 = new THREE.DirectionalLight(0xffffff, 0.3);
    dl2.position.set(-1, -0.5, -1).normalize();
    scene.add(dl2);

    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 1000000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    container.style.position = 'relative';
    container.appendChild(renderer.domElement);
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.1;

    // STL download button (top-left)
    const solidMeshes = [lugMesh];
    if (pads && peDepth > 0) { solidMeshes.push(peRightMesh, peLeftMesh); }
    if (baseMesh) solidMeshes.push(baseMesh);
    spMeshes.forEach(function (m) { solidMeshes.push(m); });
    const btnSTL = document.createElement('button');
    btnSTL.textContent = 'STL';
    btnSTL.style.cssText = 'position:absolute;top:6px;left:6px;padding:3px 8px;background:#334155;color:#94a3b8;border:1px solid #475569;border-radius:4px;font-size:11px;font-weight:600;cursor:pointer;z-index:10;transition:transform .07s ease,background .07s ease;';
    btnSTL.onmouseenter = function () { btnSTL.style.background = '#2563eb'; btnSTL.style.color = '#fff'; };
    btnSTL.onmouseleave = function () { btnSTL.style.background = '#334155'; btnSTL.style.color = '#94a3b8'; btnSTL.style.transform = ''; };
    btnSTL.onmousedown = function () { btnSTL.style.transform = 'scale(0.9)'; };
    btnSTL.onmouseup = function () { btnSTL.style.transform = ''; };
    btnSTL.onclick = function () { _exportSTL_lug(solidMeshes, 'LiftingLug.stl'); };
    container.appendChild(btnSTL);

    const bbox = new THREE.Box3();
    bbox.expandByObject(lugMesh);
    if (pads && peDepth > 0) {
        bbox.expandByObject(peRightMesh);
        bbox.expandByObject(peLeftMesh);
    }
    if (baseMesh) bbox.expandByObject(baseMesh);
    spMeshes.forEach(function (m) { bbox.expandByObject(m); });
    const center = new THREE.Vector3(); bbox.getCenter(center);
    const bsize = new THREE.Vector3(); bbox.getSize(bsize);
    const maxDim = Math.max(bsize.x, bsize.y, bsize.z);
    const fov = camera.fov * Math.PI / 180;
    const dist = maxDim / (2 * Math.tan(fov / 2)) * 1.8;

    camera.position.set(center.x + dist * 0.7, center.y + dist * 0.4, center.z + dist * 0.9);
    camera.lookAt(center);
    controls.target.copy(center); controls.update();

    new ResizeObserver(() => {
        const nw = container.clientWidth, nh = container.clientHeight;
        if (nw === 0 || nh === 0) return;
        camera.aspect = nw / nh; camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
    }).observe(container);

    function animate() {
        container._animId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
}
