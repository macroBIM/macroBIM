/* bim_pier_3d.js — Three.js viewer for the pier solid (window.render_pier_3d).
   Loaded on demand by bim_pier_test.js via RWSVG.render3d (THREE + OrbitControls
   are ensured first). Input: a flat triangle list [x,y,z ×3 per triangle],
   model units mm, with x=transverse, y=longitudinal, z=up. Test-only. */
(function () {
  window.render_pier_3d = function (hostId, T) {
    var host = document.getElementById(hostId);
    if (!host || typeof THREE === "undefined" || !T || !T.length) {
      if (host) host.innerHTML = "<div style='color:#889;display:flex;height:100%;align-items:center;justify-content:center'>3D unavailable</div>";
      return;
    }
    host.innerHTML = "";
    var W = host.clientWidth || 600, H = host.clientHeight || 460;

    var scene = new THREE.Scene(); scene.background = new THREE.Color(0x1a1a2e);
    var cam = new THREE.PerspectiveCamera(45, W / H, 1, 5e6); cam.up.set(0, 0, 1);
    var renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H); renderer.setPixelRatio(window.devicePixelRatio || 1);
    host.appendChild(renderer.domElement);

    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(T), 3));
    geo.computeVertexNormals(); geo.computeBoundingBox();
    var bb = geo.boundingBox, ctr = new THREE.Vector3(); bb.getCenter(ctr);
    geo.translate(-ctr.x, -ctr.y, -ctr.z);
    var size = bb.getSize(new THREE.Vector3()), maxd = Math.max(size.x, size.y, size.z) || 1000;

    var mat = new THREE.MeshPhongMaterial({ color: 0x9fb6cc, specular: 0x20303f, shininess: 18, side: THREE.DoubleSide });
    scene.add(new THREE.Mesh(geo, mat));
    try {
      var edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), new THREE.LineBasicMaterial({ color: 0x2b3856 }));
      scene.add(edges);
    } catch (e) { }

    scene.add(new THREE.AmbientLight(0xffffff, 0.58));
    var d1 = new THREE.DirectionalLight(0xffffff, 0.85); d1.position.set(1, -1.2, 2); scene.add(d1);
    var d2 = new THREE.DirectionalLight(0xffffff, 0.35); d2.position.set(-1, 0.6, -1); scene.add(d2);

    cam.position.set(maxd * 0.85, -maxd * 1.5, maxd * 0.85); cam.lookAt(0, 0, 0);
    var controls = THREE.OrbitControls ? new THREE.OrbitControls(cam, renderer.domElement) : null;
    if (controls) { controls.enableDamping = true; controls.dampingFactor = 0.12; controls.target.set(0, 0, 0); }

    var stopped = false;
    (function loop() {
      if (stopped || !host.isConnected) { stopped = true; renderer.dispose && renderer.dispose(); return; }
      requestAnimationFrame(loop); if (controls) controls.update(); renderer.render(scene, cam);
    })();
    window.addEventListener("resize", function () {
      if (!host.isConnected) return;
      var w = host.clientWidth || W; renderer.setSize(w, H); cam.aspect = w / H; cam.updateProjectionMatrix();
    });
  };
})();
