/*
    bim_circle_3d.js — Three.js 3D renderer for Circle section extrusion.
    Supports hollow (중공) and solid (충실) sections.
*/
function _exportSTL_circle(meshes, filename) {
    var output = 'solid exported\n';
    meshes.forEach(function(mesh) {
        var geo = mesh.geometry;
        var pos = geo.getAttribute('position');
        var idx = geo.getIndex();
        var triCount = idx ? idx.count / 3 : pos.count / 3;
        for (var i = 0; i < triCount; i++) {
            var a, b, c;
            if (idx) {
                a = idx.getX(i * 3); b = idx.getX(i * 3 + 1); c = idx.getX(i * 3 + 2);
            } else {
                a = i * 3; b = i * 3 + 1; c = i * 3 + 2;
            }
            var vA = new THREE.Vector3(pos.getX(a), pos.getY(a), pos.getZ(a));
            var vB = new THREE.Vector3(pos.getX(b), pos.getY(b), pos.getZ(b));
            var vC = new THREE.Vector3(pos.getX(c), pos.getY(c), pos.getZ(c));
            var edge1 = new THREE.Vector3().subVectors(vB, vA);
            var edge2 = new THREE.Vector3().subVectors(vC, vA);
            var normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();
            output += '  facet normal ' + normal.x + ' ' + normal.y + ' ' + normal.z + '\n';
            output += '    outer loop\n';
            output += '      vertex ' + vA.x + ' ' + vA.y + ' ' + vA.z + '\n';
            output += '      vertex ' + vB.x + ' ' + vB.y + ' ' + vB.z + '\n';
            output += '      vertex ' + vC.x + ' ' + vC.y + ' ' + vC.z + '\n';
            output += '    endloop\n';
            output += '  endfacet\n';
        }
    });
    output += 'endsolid exported\n';
    var blob = new Blob([output], { type: 'application/octet-stream' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

function render_circle_3d(containerId, geoBegin, geoEnd, segLength) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (container._animId) cancelAnimationFrame(container._animId);
    while (container.firstChild) container.removeChild(container.firstChild);

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    const halfLen = segLength / 2;

    const outerBegin = geoBegin.outerOutline;
    const outerEnd = geoEnd.outerOutline;
    if (!outerBegin || !outerEnd || outerBegin.length === 0) return;

    const hasHole = geoBegin.innerOutline && geoEnd.innerOutline &&
                    geoBegin.innerOutline.length > 0 && geoEnd.innerOutline.length > 0;

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    var material = new THREE.MeshPhongMaterial({
        color: 0x4488aa, side: THREE.DoubleSide, transparent: true, opacity: 0.7
    });
    var edgeMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff });
    var edgeGroup = new THREE.Group();
    var allMeshes = [];

    function _buildShell(beginPts, endPts) {
        var count = beginPts.length;
        var geometry = new THREE.BufferGeometry();
        var positions = [], indices = [];
        function pushVertex(x, y, z) { positions.push(x, y, z); return (positions.length / 3) - 1; }

        var beginIdx = [], endIdx = [];
        for (var i = 0; i < count; i++) beginIdx.push(pushVertex(beginPts[i].x, beginPts[i].y, halfLen));
        for (var i = 0; i < count; i++) endIdx.push(pushVertex(endPts[i].x, endPts[i].y, -halfLen));
        for (var i = 0; i < count; i++) {
            var next = (i + 1) % count;
            indices.push(beginIdx[i], beginIdx[next], endIdx[i]);
            indices.push(beginIdx[next], endIdx[next], endIdx[i]);
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        return geometry;
    }

    function _addEdges(pts, z) {
        var verts = pts.map(p => new THREE.Vector3(p.x, p.y, z));
        verts.push(verts[0].clone());
        edgeGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(verts), edgeMaterial));
    }

    function _addLongEdges(beginPts, endPts) {
        // For circles, use every 8th point (64/8 = 8 longitudinal lines)
        var step = Math.max(1, Math.floor(beginPts.length / 8));
        for (var i = 0; i < beginPts.length; i += step) {
            var ei = Math.min(i, endPts.length - 1);
            edgeGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(beginPts[i].x, beginPts[i].y, halfLen),
                new THREE.Vector3(endPts[ei].x, endPts[ei].y, -halfLen)
            ]), edgeMaterial));
        }
    }

    // Outer shell
    var outerShell = new THREE.Mesh(_buildShell(outerBegin, outerEnd), material);
    scene.add(outerShell);
    allMeshes.push(outerShell);
    _addEdges(outerBegin, halfLen);
    _addEdges(outerEnd, -halfLen);
    _addLongEdges(outerBegin, outerEnd);

    if (hasHole) {
        var innerBegin = geoBegin.innerOutline;
        var innerEnd = geoEnd.innerOutline;

        // Inner shell (hole wall)
        var innerShell = new THREE.Mesh(_buildShell(innerBegin, innerEnd), material);
        scene.add(innerShell);
        allMeshes.push(innerShell);
        _addEdges(innerBegin, halfLen);
        _addEdges(innerEnd, -halfLen);
        _addLongEdges(innerBegin, innerEnd);

        // Caps with hole (front and back)
        [{ outerPts: outerBegin, innerPts: innerBegin, z: halfLen },
         { outerPts: outerEnd, innerPts: innerEnd, z: -halfLen }].forEach(function(face) {
            var shape = new THREE.Shape();
            shape.moveTo(face.outerPts[0].x, face.outerPts[0].y);
            for (var i = 1; i < face.outerPts.length; i++) shape.lineTo(face.outerPts[i].x, face.outerPts[i].y);
            shape.closePath();
            var hole = new THREE.Path();
            hole.moveTo(face.innerPts[0].x, face.innerPts[0].y);
            for (var i = 1; i < face.innerPts.length; i++) hole.lineTo(face.innerPts[i].x, face.innerPts[i].y);
            hole.closePath();
            shape.holes.push(hole);
            var geo = new THREE.ShapeGeometry(shape);
            var pa = geo.getAttribute('position');
            for (var i = 0; i < pa.count; i++) pa.setZ(i, face.z);
            pa.needsUpdate = true;
            geo.computeVertexNormals();
            var mesh = new THREE.Mesh(geo, material);
            scene.add(mesh);
            allMeshes.push(mesh);
        });
    } else {
        // Solid caps (no hole)
        [{ pts: outerBegin, z: halfLen }, { pts: outerEnd, z: -halfLen }].forEach(function(face) {
            var shape = new THREE.Shape();
            shape.moveTo(face.pts[0].x, face.pts[0].y);
            for (var i = 1; i < face.pts.length; i++) shape.lineTo(face.pts[i].x, face.pts[i].y);
            shape.closePath();
            var geo = new THREE.ShapeGeometry(shape);
            var pa = geo.getAttribute('position');
            for (var i = 0; i < pa.count; i++) pa.setZ(i, face.z);
            pa.needsUpdate = true;
            geo.computeVertexNormals();
            var mesh = new THREE.Mesh(geo, material);
            scene.add(mesh);
            allMeshes.push(mesh);
        });
    }

    scene.add(edgeGroup);
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    var dl1 = new THREE.DirectionalLight(0xffffff, 0.6); dl1.position.set(1, 1, 1).normalize(); scene.add(dl1);
    var dl2 = new THREE.DirectionalLight(0xffffff, 0.3); dl2.position.set(-1, -0.5, -1).normalize(); scene.add(dl2);

    var camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000000);
    var renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    container.style.position = 'relative';
    container.appendChild(renderer.domElement);
    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.1;

    var btnSTL = document.createElement('button');
    btnSTL.textContent = 'STL';
    btnSTL.style.cssText = 'position:absolute;top:6px;left:6px;padding:3px 8px;background:#334155;color:#94a3b8;border:1px solid #475569;border-radius:4px;font-size:11px;font-weight:600;cursor:pointer;z-index:10;';
    btnSTL.onmouseenter = function() { btnSTL.style.background = '#2563eb'; btnSTL.style.color = '#fff'; };
    btnSTL.onmouseleave = function() { btnSTL.style.background = '#334155'; btnSTL.style.color = '#94a3b8'; };
    btnSTL.onclick = function() { _exportSTL_circle(allMeshes, 'circle_section.stl'); };
    container.appendChild(btnSTL);

    var bbox = new THREE.Box3();
    allMeshes.forEach(m => bbox.expandByObject(m));
    var center = new THREE.Vector3(); bbox.getCenter(center);
    var bsize = new THREE.Vector3(); bbox.getSize(bsize);
    var maxDim = Math.max(bsize.x, bsize.y, bsize.z);
    var fov = camera.fov * Math.PI / 180;
    var dist = maxDim / (2 * Math.tan(fov / 2)) * 1.5;
    camera.position.set(center.x + dist * 0.6, center.y + dist * 0.4, center.z + dist * 0.8);
    camera.lookAt(center); controls.target.copy(center); controls.update();

    new ResizeObserver(() => {
        var w = container.clientWidth, h = container.clientHeight;
        if (w === 0 || h === 0) return;
        camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
    }).observe(container);

    function animate() {
        container._animId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
}
