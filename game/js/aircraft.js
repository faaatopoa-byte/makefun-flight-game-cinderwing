// Cinderwing — aircraft.js
// One job: the Cinderwing herself. A twin-boom, solar-assisted bush plane,
// built from flat-shaded parts so she reads as assembled, not primitive:
// tapered fuselage pod, tinted canopy, braced gull wing, twin tail booms,
// twin rudders, fixed tricycle gear and a spinning prop disc. Moving
// surfaces (ailerons, flaps, rudders, prop) are separate meshes so the
// flight model can drive them.
(function () {
  'use strict';

  var P = window.Cinderwing.config.PALETTE;

  function lambert(color, opts) {
    var o = { color: color, flatShading: true };
    if (opts) for (var k in opts) o[k] = opts[k];
    return new THREE.MeshLambertMaterial(o);
  }

  function box(w, h, d, color) {
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lambert(color));
  }

  function buildAircraft(scene) {
    var group = new THREE.Group();
    var bodyMat = lambert(P.planeBody);
    var accentMat = lambert(P.planeAccent);
    var wingMat = lambert(P.planeWing);
    var darkMat = lambert(0x2e3138);

    // Fuselage pod: tapered nose to tail, cream with a red cheatline.
    var fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 5.4, 8), bodyMat);
    fuselage.rotation.x = Math.PI / 2;
    fuselage.position.z = 0.4;
    group.add(fuselage);
    var nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.4, 8), accentMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = 3.8;
    group.add(nose);
    var cheatline = box(1.72, 0.22, 4.6, P.planeAccent);
    cheatline.position.set(0, -0.15, 0.4);
    group.add(cheatline);

    // Tinted canopy, low and long.
    var canopy = new THREE.Mesh(new THREE.SphereGeometry(0.72, 8, 6), lambert(P.canopy, { transparent: true, opacity: 0.28 }));
    canopy.scale.set(0.9, 0.75, 1.9);
    canopy.position.set(0, 0.72, 1.5);
    group.add(canopy);

    // High braced gull wing: centre section flat, outer panels drooping.
    var wingCentre = box(4.6, 0.22, 1.7, wingMat);
    wingCentre.position.set(0, 0.95, 0.9);
    group.add(wingCentre);
    var leftWing = box(4.4, 0.18, 1.6, wingMat);
    leftWing.position.set(-4.3, 0.62, 0.9);
    leftWing.rotation.z = 0.16;
    group.add(leftWing);
    var rightWing = box(4.4, 0.18, 1.6, wingMat);
    rightWing.position.set(4.3, 0.62, 0.9);
    rightWing.rotation.z = -0.16;
    group.add(rightWing);
    // Red wingtips with navigation strobes.
    var tipL = box(0.5, 0.2, 1.6, P.planeAccent);
    tipL.position.set(-6.4, 0.3, 0.9);
    tipL.rotation.z = 0.16;
    group.add(tipL);
    var tipR = box(0.5, 0.2, 1.6, P.planeAccent);
    tipR.position.set(6.4, 0.3, 0.9);
    tipR.rotation.z = -0.16;
    group.add(tipR);
    var strobeL = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
    strobeL.position.set(-6.7, 0.3, 0.9);
    group.add(strobeL);
    var strobeR = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), new THREE.MeshBasicMaterial({ color: 0x2aff5a }));
    strobeR.position.set(6.7, 0.3, 0.9);
    group.add(strobeR);

    // Ailerons and flaps: thin panels on the wing trailing edge.
    var aileronL = box(1.9, 0.1, 0.55, accentMat);
    aileronL.position.set(-3.4, 0.62, 0.05);
    group.add(aileronL);
    var aileronR = box(1.9, 0.1, 0.55, accentMat);
    aileronR.position.set(3.4, 0.62, 0.05);
    group.add(aileronR);
    var flapL = box(1.7, 0.1, 0.6, darkMat);
    flapL.position.set(-1.5, 0.9, 0.02);
    group.add(flapL);
    var flapR = box(1.7, 0.1, 0.6, darkMat);
    flapR.position.set(1.5, 0.9, 0.02);
    group.add(flapR);

    // Twin tail booms with twin rudders and a shared stabiliser.
    var boomL = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 4.6, 6), bodyMat);
    boomL.rotation.x = Math.PI / 2;
    boomL.position.set(-1.5, 0.55, -2.6);
    group.add(boomL);
    var boomR = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 4.6, 6), bodyMat);
    boomR.rotation.x = Math.PI / 2;
    boomR.position.set(1.5, 0.55, -2.6);
    group.add(boomR);
    var finL = box(0.16, 1.5, 1.1, accentMat);
    finL.position.set(-1.5, 1.35, -4.6);
    group.add(finL);
    var finR = box(0.16, 1.5, 1.1, accentMat);
    finR.position.set(1.5, 1.35, -4.6);
    group.add(finR);
    var rudderL = box(0.12, 1.1, 0.5, darkMat);
    rudderL.position.set(-1.5, 1.25, -5.3);
    group.add(rudderL);
    var rudderR = box(0.12, 1.1, 0.5, darkMat);
    rudderR.position.set(1.5, 1.25, -5.3);
    group.add(rudderR);
    var stabiliser = box(3.6, 0.16, 1.0, wingMat);
    stabiliser.position.set(0, 1.15, -4.7);
    group.add(stabiliser);

    // Propeller: hub, three blades and a translucent spinning disc.
    var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.7, 8), darkMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = 4.6;
    group.add(hub);
    var prop = new THREE.Group();
    for (var i = 0; i < 3; i += 1) {
      var blade = box(0.28, 2.1, 0.08, darkMat);
      blade.position.y = 1.05;
      var holder = new THREE.Group();
      holder.rotation.z = (i / 3) * Math.PI * 2;
      holder.add(blade);
      prop.add(holder);
    }
    prop.position.z = 4.95;
    group.add(prop);
    var disc = new THREE.Mesh(
      new THREE.CircleGeometry(2.2, 20),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, side: THREE.DoubleSide }));
    disc.position.z = 4.95;
    group.add(disc);

    // Fixed tricycle gear: nose wheel and two mains, with struts.
    var wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
    wheelGeo.rotateZ(Math.PI / 2);
    var noseWheel = new THREE.Mesh(wheelGeo, darkMat);
    noseWheel.position.set(0, -1.05, 2.6);
    group.add(noseWheel);
    var mainL = new THREE.Mesh(wheelGeo, darkMat);
    mainL.position.set(-1.3, -1.05, -0.4);
    group.add(mainL);
    var mainR = new THREE.Mesh(wheelGeo, darkMat);
    mainR.position.set(1.3, -1.05, -0.4);
    group.add(mainR);
    var strutL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.0, 5), darkMat);
    strutL.position.set(-1.3, -0.55, -0.4);
    group.add(strutL);
    var strutR = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.0, 5), darkMat);
    strutR.position.set(1.3, -0.55, -0.4);
    group.add(strutR);

    // Solar panels on the wing centre section: the "solar-assisted" bit.
    var solar = box(3.6, 0.06, 1.2, 0x1a3a5c);
    solar.position.set(0, 1.09, 0.9);
    group.add(solar);

    scene.add(group);

    // Blob shadow: a dark disc that follows the plane over the ground.
    // No shadow maps on this machine, and a blob reads just as clearly.
    var shadow = new THREE.Mesh(
      new THREE.CircleGeometry(4.2, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(1, 1.6, 1);
    scene.add(shadow);

    // Wingtip trails: two fading ribbons that show the last seconds of
    // the flight path. Built from a line strip, updated by the loop.
    var trailGeo = new THREE.BufferGeometry();
    var trailPos = new Float32Array(60 * 3);
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    var trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
    trail.frustumCulled = false;
    scene.add(trail);
    var trailPoints = [];

    return {
      group: group,
      prop: prop,
      disc: disc,
      aileronL: aileronL,
      aileronR: aileronR,
      flapL: flapL,
      flapR: flapR,
      rudderL: rudderL,
      rudderR: rudderR,
      strobeL: strobeL,
      strobeR: strobeR,
      shadow: shadow,
      trail: trail,
      trailPoints: trailPoints,
      // In the cockpit the individual blades read as a bar across the
      // view, so the cockpit shows only the translucent blur disc: that
      // is what a spinning prop looks like from the pilot's seat.
      setBladesVisible: function (visible) { prop.visible = visible; },
      // Drive the moving parts from the flight state, once per frame.
      pose: function (state, time) {
        group.position.copy(state.position);
        group.rotation.set(state.pitch, state.heading, state.roll, 'YXZ');
        prop.rotation.z += 0.35 + state.throttle * 0.9 + state.speed * 0.02;
        disc.material.opacity = 0.05 + state.throttle * 0.08;
        var rollIn = state.rollInput || 0;
        aileronL.rotation.x = rollIn * 0.5;
        aileronR.rotation.x = -rollIn * 0.5;
        var flapAngle = state.flaps * 0.35;
        flapL.rotation.x = flapAngle;
        flapR.rotation.x = flapAngle;
        var yawIn = state.yawInput || 0;
        rudderL.rotation.y = yawIn * 0.4;
        rudderR.rotation.y = yawIn * 0.4;
        var blink = (Math.floor(time * 1.4) % 2) === 0;
        strobeL.visible = blink;
        strobeR.visible = blink;
        // Blob shadow: sits on the ground under the plane, fading with height.
        var ground = window.Cinderwing.world.terrainHeightAt(state.position.x, state.position.z);
        var height = Math.max(0, state.position.y - ground);
        shadow.position.set(state.position.x, ground + 0.3, state.position.z);
        shadow.material.opacity = Math.max(0.04, 0.28 - height * 0.004);
        var s = Math.max(0.7, 1 - height * 0.002);
        shadow.scale.set(s, s * 1.6, 1);
      },
      // Record a trail point each frame; keep the last 60.
      pushTrail: function (state) {
        trailPoints.push(state.position.x, state.position.y, state.position.z);
        if (trailPoints.length > 60 * 3) trailPoints.splice(0, 3);
        var attr = trail.geometry.attributes.position;
        for (var i = 0; i < 60; i += 1) {
          var base = i * 3;
          if (base < trailPoints.length) {
            attr.setXYZ(i, trailPoints[base], trailPoints[base + 1], trailPoints[base + 2]);
          } else {
            attr.setXYZ(i, state.position.x, state.position.y, state.position.z);
          }
        }
        attr.needsUpdate = true;
      }
    };
  }

  window.Cinderwing.aircraft = { buildAircraft: buildAircraft };
})();
