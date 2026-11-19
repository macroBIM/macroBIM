/* bim_pier_3d.js — Three.js viewer for the pier solid (window.render_pier_3d).
   Loaded on demand by bim_pier_test.js via RWSVG.render3d (THREE + OrbitControls
   are ensured first). Input: a flat triangle list [x,y,z ×3 per triangle],
   model units mm, with x=transverse, y=longitudinal, z=up.
   Optional 3rd argument rb = the server's rebar result {marks, bars:[{k, p:[x,y,z,…]}]}: the bars are drawn as
   centre lines coloured by member, the concrete turns see-through, and two buttons show / hide concrete and bars. */
(function () {
  window.render_pier_3d = function (hostId, T, rb) {
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

    var hasRb = rb && rb.bars && rb.bars.length;
    var mat = new THREE.MeshPhongMaterial({ color: 0x9fb6cc, specular: 0x20303f, shininess: 18, side: THREE.DoubleSide,
      transparent: !!hasRb, opacity: hasRb ? 0.22 : 1, depthWrite: !hasRb });
    var solid = new THREE.Mesh(geo, mat); scene.add(solid);
    var edges = null;
    try {
      edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), new THREE.LineBasicMaterial({ color: hasRb ? 0x6b7a99 : 0x2b3856 }));
      scene.add(edges);
    } catch (e) { }
    var bars = null;
    if (hasRb) {
      // one LineSegments per member colour: cap / beam · column / leg · footing
      var COL = { cap: 0xff6b3d, col: 0x4dabf7, fdn: 0x69db7c }, segs = { cap: [], col: [], fdn: [] };
      rb.bars.forEach(function (b) {
        var m = rb.marks[b.k] ? rb.marks[b.k].m : "col", q = b.p, a = segs[m] || segs.col;
        for (var i = 3; i < q.length; i += 3) a.push(q[i - 3] - ctr.x, q[i - 2] - ctr.y, q[i - 1] - ctr.z, q[i] - ctr.x, q[i + 1] - ctr.y, q[i + 2] - ctr.z);
      });
      bars = new THREE.Group();
      Object.keys(segs).forEach(function (m) {
        if (!segs[m].length) return;
        var g2 = new THREE.BufferGeometry(); g2.setAttribute("position", new THREE.BufferAttribute(new Float32Array(segs[m]), 3));
        bars.add(new THREE.LineSegments(g2, new THREE.LineBasicMaterial({ color: COL[m] })));
      });
      scene.add(bars);
      var ui = document.createElement("div");
      ui.style.cssText = "position:absolute;top:10px;left:10px;display:flex;gap:6px;z-index:2";
      var concMode = 1;   // 0 hidden · 1 see-through · 2 solid
      function btn(label, on) {
        var b = document.createElement("button"); b.type = "button"; b.textContent = label;
        b.style.cssText = "font:600 11px system-ui,sans-serif;padding:5px 10px;border-radius:6px;border:1px solid #4b5677;background:#232a45;color:#e5e9f5;cursor:pointer";
        b.onclick = on; ui.appendChild(b); return b;
      }
      var bc = btn("Concrete: see-through", function () {
        concMode = (concMode + 1) % 3;
        solid.visible = concMode > 0; if (edges) edges.visible = concMode > 0;
        mat.opacity = concMode === 2 ? 1 : 0.22; mat.transparent = concMode !== 2; mat.depthWrite = concMode === 2; mat.needsUpdate = true;
        bc.textContent = "Concrete: " + ["hidden", "see-through", "solid"][concMode];
      });
      var bb = btn("Rebar: on", function () { bars.visible = !bars.visible; bb.textContent = "Rebar: " + (bars.visible ? "on" : "off"); });
      host.style.position = host.style.position || "relative"; host.appendChild(ui);
    }

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
