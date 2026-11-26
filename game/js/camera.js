// Cinderwing — camera.js
// One job: where the eye sits. A spring-damped chase camera that never
// fights the pilot, a cockpit camera behind the dash, four fixed presets
// for screenshots, and a short shake on touchdown. The camera reads the
// flight state and writes the THREE camera; nothing else.
(function () {
  'use strict';

  var CAM = window.Cinderwing.config.CAMERA;

  var MODE_CHASE = 'chase';
  var MODE_COCKPIT = 'cockpit';

  function createCamera(camera) {
    var mode = MODE_CHASE;
    var preset = 0; // 0 = follow, 1-4 = fixed screenshot angles
    var smoothed = { x: 0, y: 130, z: 360 };
    var shake = 0;

    function forwardVector(heading, pitch) {
      return {
        x: Math.sin(heading) * Math.cos(pitch),
        y: -Math.sin(pitch),
        z: Math.cos(heading) * Math.cos(pitch)
      };
    }

    // The chase camera trails the plane on a spring: it lags a little in
    // a turn, so the picture feels like flying instead of sliding.
    function chase(state, dt) {
      var f = forwardVector(state.heading, state.pitch);
      var tx = state.position.x - f.x * CAM.chaseDistance;
      var ty = state.position.y + CAM.chaseHeight - f.y * CAM.chaseDistance * 0.4;
      var tz = state.position.z - f.z * CAM.chaseDistance;
      var k = 1 - Math.exp(-CAM.chaseLag * dt);
      smoothed.x += (tx - smoothed.x) * k;
      smoothed.y += (ty - smoothed.y) * k;
      smoothed.z += (tz - smoothed.z) * k;
      camera.position.set(smoothed.x, smoothed.y, smoothed.z);
      var lookX = state.position.x + f.x * 18;
      var lookY = state.position.y + f.y * 18;
      var lookZ = state.position.z + f.z * 18;
      camera.lookAt(lookX, lookY, lookZ);
      camera.rotation.z += state.roll * 0.35; // a hint of bank in the frame
    }

    function cockpit(state) {
      var f = forwardVector(state.heading, state.pitch);
      var o = CAM.cockpitOffset;
      // The eye sits just behind the canopy, looking along the nose.
      var right = { x: Math.cos(state.heading), y: 0, z: -Math.sin(state.heading) };
      var up = { x: 0, y: 1, z: 0 };
      var ex = state.position.x + right.x * o.x + up.x * o.y + f.x * o.z;
      var ey = state.position.y + right.y * o.x + up.y * o.y + f.y * o.z;
      var ez = state.position.z + right.z * o.x + up.z * o.y + f.z * o.z;
      camera.position.set(ex, ey, ez);
      camera.lookAt(
        state.position.x + f.x * 60,
        state.position.y + f.y * 60 - 4, // the pilot's eye sits a touch
        state.position.z + f.z * 60);   // low: gates below read in frame
      camera.rotation.z += state.roll * 0.5;
    }

    // Fixed angles for the four screenshots. Each one frames the plane,
    // the terrain ahead and the ring or target the shot is about.
    function applyPreset(n, state) {
      var p = state.position;
      var f = forwardVector(state.heading, state.pitch);
      // Right of the flight path, for shifting the view centre sideways.
      var right = { x: -Math.cos(state.heading), z: Math.sin(state.heading) };
      if (n === 1) {
        // Hero chase: behind, above and to the side, ring ahead. The
        // look point sits right of the flight path, so the plane rides
        // in the left third and the ring ahead sits below the horizon
        // instrument instead of behind it.
        camera.position.set(p.x - f.x * 18 - f.z * 7, p.y + 4, p.z - f.z * 18 + f.x * 7);
        camera.lookAt(p.x + f.x * 50 + right.x * 15, p.y - 3, p.z + f.z * 50 + right.z * 15);
      } else if (n === 2) {
        // Cockpit: the dash view, low over the nose.
        cockpit(state);
      } else if (n === 3) {
        // Low side chase: the rescue skim, buoy and flare in frame.
        // Far enough back that the whole 13 m span fits, and the side
        // offset is small so the wingtip stays inside the frame. The
        // camera rides higher and looks down a touch, so the plane and
        // the buoy ring sit below the horizon instrument.
        camera.position.set(p.x - f.x * 18 + 4, p.y + 9, p.z - f.z * 18 - 2);
        camera.lookAt(p.x + f.x * 30, p.y - 10, p.z + f.z * 30);
      } else if (n === 4) {
        // Deck landing: front-right three-quarter, high enough that
        // the painted target ring reads as a ring around the plane
        // instead of a green band across the frame — never dead astern,
        // where the plane is a white blob, and never so close that the
        // ring passes through the camera.
        camera.position.set(p.x + f.x * 22 + right.x * 13, p.y + 8, p.z + f.z * 22 + right.z * 13);
        camera.lookAt(p.x + f.x * 4, p.y - 1, p.z + f.z * 4);
      }
      // No roll on presets: a level camera keeps the bank readable.
    }

    function update(state, dt, time) {
      if (shake > 0) shake = Math.max(0, shake - dt * 2.2);
      if (preset > 0) {
        applyPreset(preset, state);
      } else if (mode === MODE_COCKPIT) {
        cockpit(state);
      } else {
        chase(state, dt);
      }
      if (shake > 0) {
        camera.position.x += (Math.random() - 0.5) * shake * 0.7;
        camera.position.y += (Math.random() - 0.5) * shake * 0.7;
      }
    }

    return {
      update: update,
      setMode: function (m) { mode = m; preset = 0; },
      getMode: function () { return preset > 0 ? 'preset' : mode; },
      getPreset: function () { return preset; },
      toggleMode: function () {
        mode = mode === MODE_CHASE ? MODE_COCKPIT : MODE_CHASE;
        preset = 0;
        return mode;
      },
      setPreset: function (n) { preset = n; },
      clearPreset: function () { preset = 0; },
      addShake: function (amount) { shake = Math.max(shake, amount); },
      snapBehind: function (state) {
        var f = forwardVector(state.heading, state.pitch);
        smoothed.x = state.position.x - f.x * CAM.chaseDistance;
        smoothed.y = state.position.y + CAM.chaseHeight;
        smoothed.z = state.position.z - f.z * CAM.chaseDistance;
      }
    };
  }

  window.Cinderwing.camera = { createCamera: createCamera, MODE_CHASE: MODE_CHASE, MODE_COCKPIT: MODE_COCKPIT };
})();
