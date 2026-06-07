/*
    bim_box1cell_3d.js — Three.js 3D renderer for 1-Cell Box Girder
*/

function getPoint(geo, name) {
    var found = geo.points.find(function(p) { return p.name === name; });
    if (found && found[name]) return { x: found[name].x, y: found[name].y };
    return { x: 0, y: 0 };
}

function render_box1cell_3d(containerId, geoBegin, geoEnd, segLength) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (container._animId) cancelAnimationFrame(container._animId);

    while (container.firstChild) container.removeChild(container.firstChild);

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    const halfLen = segLength / 2;

    const outerNames = [
        'ptl', 'ptc', 'ptr', 'pcr', 'pcmr', 'pwtr', 'pbr', 'pbl', 'pwtl', 'pcml', 'pcl'
    ];
    const innerNames = [
        'ptsl', 'ptsc', 'ptsr', 'pwtrin', 'pwbrin', 'pbhr', 'pbsr', 'pbsl', 'pbhl', 'pwblin', 'pwtlin'
    ];

    var outerBegin = outerNames.map(function(n) { return getPoint(geoBegin, n); });
    var outerEnd = outerNames.map(function(n) { return getPoint(geoEnd, n); });
    var innerBegin = innerNames.map(function(n) { return getPoint(geoBegin, n); });
    var innerEnd = innerNames.map(function(n) { return getPoint(geoEnd, n); });

    var outerCountVal = outerBegin.length;
    var innerCountVal = innerBegin.length;

    var geometry = new THREE.BufferGeometry();
    var positions = [];
    var indices = [];

    function pushVertex(x, y, z) {
        positions.push(x, y, z);
        return (positions.length / 3) - 1;
    }

    var outerBeginIdx = [];
    var outerEndIdx = [];
    var innerBeginIdx = [];
    var innerEndIdx = [];

    for (var i = 0; i < outerCountVal; i++) {
        outerBeginIdx.push(pushVertex(outerBegin[i].x, outerBegin[i].y, halfLen));
    }
    for (var i = 0; i < outerCountVal; i++) {
        outerEndIdx.push(pushVertex(outerEnd[i].x, outerEnd[i].y, -halfLen));
    }
    for (var i = 0; i < innerCountVal; i++) {
        innerBeginIdx.push(pushVertex(innerBegin[i].x, innerBegin[i].y, halfLen));
    }
    for (var i = 0; i < innerCountVal; i++) {
        innerEndIdx.push(pushVertex(innerEnd[i].x, innerEnd[i].y, -halfLen));
    }

    for (var i = 0; i < outerCountVal; i++) {
        var next = (i + 1) % outerCountVal;
        var a = outerBeginIdx[i];
        var b = outerBeginIdx[next];
        var c = outerEndIdx[next];
        var d = outerEndIdx[i];
        indices.push(a, b, d);
        indices.push(b, c, d);
    }

    for (var i = 0; i < innerCountVal; i++) {
        var next = (i + 1) % innerCountVal;
        var a = innerBeginIdx[i];
        var b = innerBeginIdx[next];
        var c = innerEndIdx[next];
        var d = innerEndIdx[i];
        indices.push(a, d, b);
        indices.push(b, d, c);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    var capBeginGeo = buildCapGeometry(outerBegin, innerBegin, halfLen);
    var capEndGeo = buildCapGeometry(outerEnd, innerEnd, -halfLen);

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

    var outerBeginLineVerts = [];
    for (var i = 0; i < outerCountVal; i++) {
        outerBeginLineVerts.push(new THREE.Vector3(outerBegin[i].x, outerBegin[i].y, halfLen));
    }
    outerBeginLineVerts.push(outerBeginLineVerts[0].clone());
    var obLineGeo = new THREE.BufferGeometry().setFromPoints(outerBeginLineVerts);
    edgeGroup.add(new THREE.Line(obLineGeo, edgeMaterial));

    var outerEndLineVerts = [];
    for (var i = 0; i < outerCountVal; i++) {
        outerEndLineVerts.push(new THREE.Vector3(outerEnd[i].x, outerEnd[i].y, -halfLen));
    }
    outerEndLineVerts.push(outerEndLineVerts[0].clone());
    var oeLineGeo = new THREE.BufferGeometry().setFromPoints(outerEndLineVerts);
    edgeGroup.add(new THREE.Line(oeLineGeo, edgeMaterial));

    var innerBeginLineVerts = [];
    for (var i = 0; i < innerCountVal; i++) {
        innerBeginLineVerts.push(new THREE.Vector3(innerBegin[i].x, innerBegin[i].y, halfLen));
    }
    innerBeginLineVerts.push(innerBeginLineVerts[0].clone());
    var ibLineGeo = new THREE.BufferGeometry().setFromPoints(innerBeginLineVerts);
    edgeGroup.add(new THREE.Line(ibLineGeo, edgeMaterial));

    var innerEndLineVerts = [];
    for (var i = 0; i < innerCountVal; i++) {
        innerEndLineVerts.push(new THREE.Vector3(innerEnd[i].x, innerEnd[i].y, -halfLen));
    }
    innerEndLineVerts.push(innerEndLineVerts[0].clone());
    var ieLineGeo = new THREE.BufferGeometry().setFromPoints(innerEndLineVerts);
    edgeGroup.add(new THREE.Line(ieLineGeo, edgeMaterial));

    for (var i = 0; i < outerCountVal; i++) {
        var longGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(outerBegin[i].x, outerBegin[i].y, halfLen),
            new THREE.Vector3(outerEnd[i].x, outerEnd[i].y, -halfLen)
        ]);
        edgeGroup.add(new THREE.Line(longGeo, edgeMaterial));
    }
    for (var i = 0; i < innerCountVal; i++) {
        var longGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(innerBegin[i].x, innerBegin[i].y, halfLen),
            new THREE.Vector3(innerEnd[i].x, innerEnd[i].y, -halfLen)
        ]);
        edgeGroup.add(new THREE.Line(longGeo, edgeMaterial));
    }

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    scene.add(shellMesh);
    scene.add(capBeginMesh);
    scene.add(capEndMesh);
    scene.add(edgeGroup);

    var ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

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

function buildCapGeometry(outerPts, innerPts, z) {
    var outerShape = new THREE.Shape();
    outerShape.moveTo(outerPts[0].x, outerPts[0].y);
    for (var i = 1; i < outerPts.length; i++) {
        outerShape.lineTo(outerPts[i].x, outerPts[i].y);
    }
    outerShape.closePath();

    var holePath = new THREE.Path();
    holePath.moveTo(innerPts[0].x, innerPts[0].y);
    for (var i = 1; i < innerPts.length; i++) {
        holePath.lineTo(innerPts[i].x, innerPts[i].y);
    }
    holePath.closePath();
    outerShape.holes.push(holePath);

    var shapeGeo = new THREE.ShapeGeometry(outerShape);

    var posAttr = shapeGeo.getAttribute('position');
    for (var i = 0; i < posAttr.count; i++) {
        posAttr.setZ(i, z);
    }
    posAttr.needsUpdate = true;
    shapeGeo.computeVertexNormals();

    return shapeGeo;
}
