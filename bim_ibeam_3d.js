/*
    bim_ibeam_3d.js — Three.js 3D renderer for tapered I-beam (plate girder)

    Inputs:
      containerId: DOM element id where the canvas is mounted
      geoBegin, geoEnd: results of geo_ibeam(aparam_b/e), each having .outline
      segLength: beam length along Z axis (centered around z=0)
*/

function render_ibeam_3d(containerId, geoBegin, geoEnd, segLength) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (container._animId) cancelAnimationFrame(container._animId);
    while (container.firstChild) container.removeChild(container.firstChild);

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    const halfLen = segLength / 2;

    const beginPts = geoBegin.outline;
    const endPts = geoEnd.outline;

    if (!beginPts || !endPts || beginPts.length === 0 || endPts.length === 0) return;
    if (beginPts.length !== endPts.length) return;

    const count = beginPts.length;

    var geometry = new THREE.BufferGeometry();
    var positions = [];
    var indices = [];

    function pushVertex(x, y, z) {
        positions.push(x, y, z);
        return (positions.length / 3) - 1;
    }

    var beginIdx = [];
    var endIdx = [];
    for (var i = 0; i < count; i++) {
        beginIdx.push(pushVertex(beginPts[i].x, beginPts[i].y, halfLen));
    }
    for (var i = 0; i < count; i++) {
        endIdx.push(pushVertex(endPts[i].x, endPts[i].y, -halfLen));
    }

    // Side (longitudinal) faces between begin and end
    for (var i = 0; i < count; i++) {
        var next = (i + 1) % count;
        var a = beginIdx[i];
        var b = beginIdx[next];
        var c = endIdx[next];
        var d = endIdx[i];
        indices.push(a, b, d);
        indices.push(b, c, d);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    var capBeginGeo = _buildIbeamCap(beginPts, halfLen);
    var capEndGeo = _buildIbeamCap(endPts, -halfLen);

    var material = new THREE.MeshPhongMaterial({
        color: 0x4488aa,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7
    });

    var shellMesh = new THREE.Mesh(geometry, material);
    var capBeginMesh = new THREE.Mesh(capBeginGeo, material);
    var capEndMesh = new THREE.Mesh(capEndGeo, material);

    var edgeMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff });
    var edgeGroup = new THREE.Group();

    // Outline loops at begin and end
    [{ pts: beginPts, z: halfLen }, { pts: endPts, z: -halfLen }].forEach(face => {
        var verts = face.pts.map(p => new THREE.Vector3(p.x, p.y, face.z));
        verts.push(verts[0].clone());
        var lg = new THREE.BufferGeometry().setFromPoints(verts);
        edgeGroup.add(new THREE.Line(lg, edgeMaterial));
    });

    // Longitudinal edges connecting begin → end
    for (var i = 0; i < count; i++) {
        var lg = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(beginPts[i].x, beginPts[i].y, halfLen),
            new THREE.Vector3(endPts[i].x, endPts[i].y, -halfLen)
        ]);
        edgeGroup.add(new THREE.Line(lg, edgeMaterial));
    }

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    scene.add(shellMesh);
    scene.add(capBeginMesh);
    scene.add(capEndMesh);
    scene.add(edgeGroup);

    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    var dirLight1 = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight1.position.set(1, 1, 1).normalize();
    scene.add(dirLight1);
    var dirLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    dirLight2.position.set(-1, -0.5, -1).normalize();
    scene.add(dirLight2);

    var camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000000);
    var renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;

    var bbox = new THREE.Box3();
    bbox.expandByObject(shellMesh);
    bbox.expandByObject(capBeginMesh);
    bbox.expandByObject(capEndMesh);

    var center = new THREE.Vector3();
    bbox.getCenter(center);
    var bsize = new THREE.Vector3();
    bbox.getSize(bsize);
    var maxDim = Math.max(bsize.x, bsize.y, bsize.z);
    var fov = camera.fov * (Math.PI / 180);
    var dist = maxDim / (2 * Math.tan(fov / 2)) * 1.5;

    camera.position.set(center.x + dist * 0.6, center.y + dist * 0.4, center.z + dist * 0.8);
    camera.lookAt(center);
    controls.target.copy(center);
    controls.update();

    var resizeObserver = new ResizeObserver(function() {
        var w = container.clientWidth;
        var h = container.clientHeight;
        if (w === 0 || h === 0) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    function animate() {
        container._animId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
}

function _buildIbeamCap(pts, z) {
    var shape = new THREE.Shape();
    shape.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) {
        shape.lineTo(pts[i].x, pts[i].y);
    }
    shape.closePath();

    var geo = new THREE.ShapeGeometry(shape);
    var posAttr = geo.getAttribute('position');
    for (var i = 0; i < posAttr.count; i++) {
        posAttr.setZ(i, z);
    }
    posAttr.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
}
