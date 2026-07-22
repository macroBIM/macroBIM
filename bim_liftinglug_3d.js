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
    const spOn = opt.spOn === true;                   // side plates on both L/R edges, wrapping both faces
    const spBot = geo.aparam.spBot || 0, spTop = geo.aparam.spTop || 0, spH = geo.aparam.spH || 0,
          spW = geo.aparam.spW || 0, spIn = geo.aparam.spInset || 0;

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

    // === Trapezoidal side plates: two L/R bands, each wrapping both faces ===
    const spMeshes = [];
    if (spOn && (spBot > 0 || spTop > 0) && spH > 0 && spW > 0) {
        const spMat = new THREE.MeshPhongMaterial({
            color: 0xa855f7, side: THREE.DoubleSide, transparent: true, opacity: 0.7
        });
        // one plate per band, full depth (lug passes through the slot); trapezoid
        // cross-section in (Z, height y) centred on Z = 0, stood on the base (y = 0)
        const zbo = spBot / 2, zto = spTop / 2;   // spBot/spTop are full widths, centred on the lug
        const trap = new THREE.Shape();
        trap.moveTo(-zbo, 0); trap.lineTo(zbo, 0); trap.lineTo(zto, spH); trap.lineTo(-zto, spH); trap.closePath();
        const spRi = lugW / 2 + spIn, spRo = spRi + spW;   // right band [spRi, spRo]
        const spLi = -(lugW / 2 + spIn), spLo = spLi - spW; // left band  [spLo, spLi]
        [[spRi, spRo], [spLo, spLi]].forEach(function (band) {
            const gsp = new THREE.ExtrudeGeometry(trap, { depth: spW, bevelEnabled: false });
            gsp.rotateY(-Math.PI / 2); gsp.translate(band[1], 0, 0);  // local x→Z, extrude→X ending at band[1]
            spMeshes.push(new THREE.Mesh(gsp, spMat));
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
    container.appendChild(renderer.domElement);
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.1;

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
