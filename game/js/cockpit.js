// Cinderwing — cockpit.js
// One job: the cockpit the pilot sees. A camera-attached interior: dash
// with lit dials, glare shield, canopy frame struts, a yoke that moves
// with the stick, and wing-root fairings at the windscreen sides. It is
// only visible in cockpit view (C key, or screenshot preset 2); the chase
// views never see it. The v1 cockpit frame had none of this, just
// floating gauges and a sliver of nose, so the shot read as a chase
// view with the plane missing.
//
// Screen layout (camera space: the camera looks down -z, near plane 0.5,
// 62-degree field of view; at 1.25 m ahead the frame is about 1.5 m tall
// and 2.67 m wide). The dash fills the bottom of the frame, its four
// dials sit at screen y ~523 — above the HUD bottom panels, so the
// instruments never hide each other — and the yoke handle sits in the
// gap between the middle dials.
(function () {
  'use strict';

  var group = null;
  var yoke = null;

  function lambert(color) {
    return new THREE.MeshLambertMaterial({ color: color, flatShading: true });
  }

  function basic(color) {
    return new THREE.MeshBasicMaterial({ color: color });
  }

  function box(w, h, d, mat) {
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  }

  function build(camera) {
    group = new THREE.Group();
    var dashMat = lambert(0x1c262c);
    var frameMat = basic(0x3a4148);
    var wingMat = lambert(0xe8ddc2);

    // Dash panel, low across the bottom of the frame.
    var dash = box(2.0, 0.5, 0.12, dashMat);
    dash.position.set(0, -0.48, -1.25);
    group.add(dash);
    // Glare shield: a shallow lip along the top of the dash.
    var shield = box(2.0, 0.06, 0.3, dashMat);
    shield.position.set(0, -0.20, -1.15);
    shield.rotation.x = -0.3;
    group.add(shield);
    // Four lit dials on the dash face, with a gap in the middle for
    // the yoke: amber ring, dark face, green dot.
    var dialX = [-0.55, -0.28, 0.28, 0.55];
    for (var i = 0; i < dialX.length; i += 1) {
      var ring = new THREE.Mesh(new THREE.CircleGeometry(0.07, 16), basic(0xffb84d));
      ring.position.set(dialX[i], -0.30, -1.18);
      group.add(ring);
      var face = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), basic(0x0a1218));
      face.position.set(dialX[i], -0.30, -1.175);
      group.add(face);
      var dot = new THREE.Mesh(new THREE.CircleGeometry(0.011, 8), basic(0x4dff9e));
      dot.position.set(dialX[i] + 0.018, -0.282, -1.17);
      group.add(dot);
    }

    // Canopy frame: two thin A-pillars leaning out and a top crossbar.
    // Flat grey-blue, so they read as structure instead of black voids.
    var pillarL = box(0.05, 1.15, 0.05, frameMat);
    pillarL.position.set(-1.02, 0.02, -1.45);
    pillarL.rotation.z = 0.18;
    group.add(pillarL);
    var pillarR = box(0.05, 1.15, 0.05, frameMat);
    pillarR.position.set(1.02, 0.02, -1.45);
    pillarR.rotation.z = -0.18;
    group.add(pillarR);
    var topBar = box(2.1, 0.05, 0.05, frameMat);
    topBar.position.set(0, 0.55, -1.5);
    group.add(topBar);

    // Wing-root fairings where the wing meets the canopy frame: small
    // wedges sloping down from the pillar tops, so they read as
    // structure continuing from the frame instead of floating slabs.
    var rootL = box(0.5, 0.04, 0.5, wingMat);
    rootL.position.set(-1.0, 0.45, -1.45);
    rootL.rotation.z = 0.35;
    group.add(rootL);
    var rootR = box(0.5, 0.04, 0.5, wingMat);
    rootR.position.set(1.0, 0.45, -1.45);
    rootR.rotation.z = -0.35;
    group.add(rootR);

    // Yoke: a column and a handle bar in the gap between the middle
    // dials, pivoting with the stick. The column runs down behind the
    // HUD flaps panel; the handle stays visible above it.
    yoke = new THREE.Group();
    var column = box(0.05, 0.4, 0.05, dashMat);
    column.position.set(0, -0.18, 0);
    column.rotation.x = 0.35;
    yoke.add(column);
    var handle = box(0.42, 0.05, 0.05, frameMat);
    handle.position.set(0, 0.0, 0.06);
    yoke.add(handle);
    // Grips at the ends of the handle, so the bar reads as a yoke.
    var gripL = box(0.05, 0.13, 0.05, frameMat);
    gripL.position.set(-0.19, 0.05, 0.06);
    gripL.rotation.z = 0.25;
    yoke.add(gripL);
    var gripR = box(0.05, 0.13, 0.05, frameMat);
    gripR.position.set(0.19, 0.05, 0.06);
    gripR.rotation.z = -0.25;
    yoke.add(gripR);
    yoke.position.set(0, -0.30, -0.90);
    group.add(yoke);

    group.visible = false;
    camera.add(group);
  }

  function setVisible(visible) {
    if (group) group.visible = visible;
  }

  function pose(state) {
    if (!yoke || !state) return;
    yoke.rotation.x = (state.pitchInput || 0) * 0.25;
    yoke.rotation.z = -(state.rollInput || 0) * 0.35;
  }

  window.Cinderwing.cockpit = {
    build: build,
    setVisible: setVisible,
    pose: pose
  };
})();
