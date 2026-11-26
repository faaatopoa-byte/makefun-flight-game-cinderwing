// Cinderwing — main.js
// One job: run the game. Boot, input, the fixed-timestep loop, the
// mission state machine, the title and game-over screens, and the
// deterministic screenshot mode (?shot=hero|cockpit|rescue|landing).
// The game is played with keyboard and mouse; the mouse is a virtual
// yoke when held, the wheel is the throttle.
(function () {
  'use strict';

  var cfg = window.Cinderwing.config;
  var phys = window.Cinderwing.physics;
  var world = window.Cinderwing.world;
  var aircraftMod = window.Cinderwing.aircraft;
  var camMod = window.Cinderwing.camera;
  var hud = window.Cinderwing.hud;
  var audio = window.Cinderwing.audio;
  var cockpitMod = window.Cinderwing.cockpit;

  var STEP = 1 / 60;
  var MAX_FRAME = 0.25;

  var params = new URLSearchParams(window.location.search);
  var shotName = params.get('shot');
  var seedParam = Number.parseInt(params.get('seed') || '', 10);
  var seed = Number.isInteger(seedParam) ? seedParam : 7;

  var canvas = document.getElementById('scene');
  var hudSvg = document.getElementById('hud');
  var titleEl = document.getElementById('title');
  var overEl = document.getElementById('gameover');
  var helpEl = document.getElementById('help');
  var statusEl = document.getElementById('status');

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false });
  renderer.setPixelRatio(1);
  renderer.setSize(1280, 720);
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(62, 1280 / 720, 0.5, 7000);

  world.build(scene);
  var plane = aircraftMod.buildAircraft(scene);
  var cameraCtl = camMod.createCamera(camera);
  // The camera carries the cockpit interior as a child, so it must be
  // part of the scene graph for the dash to render.
  scene.add(camera);
  cockpitMod.build(camera);
  hud.build(hudSvg);

  var missionIndex = 0;
  var mission = cfg.MISSIONS[missionIndex];
  var state = null;
  var screen = 'title'; // title | play | paused | over
  var time = 0;
  var keys = {};
  var mouse = { down: false, x: 0, y: 0 };
  var nextRing = 0;
  var impactFreezeUntil = 0;
  var lastStallBeep = 0;

  function newFlight(index) {
    missionIndex = index;
    mission = cfg.MISSIONS[index];
    state = phys.createState(mission);
    state.missionId = mission.id;
    nextRing = 0;
    for (var i = 0; i < world.rings.length; i += 1) {
      world.rings[i].passed = false;
      world.rings[i].mesh.material.color.setHex(0x37e0ff);
    }
    for (var j = 0; j < world.buoys.length; j += 1) world.buoys[j].done = false;
    plane.trailPoints.length = 0;
    cameraCtl.snapBehind(state);
    cameraCtl.setMode(camMod.MODE_CHASE);
  }

  function waypointFor() {
    if (!state) return null;
    if (mission.id === 1) {
      if (nextRing >= world.rings.length) return { label: 'COURSE CLEAR', distance: 0, objective: 'Rings 12 / 12 — land on the strip to finish' };
      var ring = world.rings[nextRing];
      var dx = ring.position.x - state.position.x;
      var dy = ring.position.y - state.position.y;
      var dz = ring.position.z - state.position.z;
      return {
        label: 'NEXT RING ' + (nextRing + 1) + ' / 12',
        distance: Math.sqrt(dx * dx + dy * dy + dz * dz),
        objective: 'Rings ' + state.ringsPassed + ' / 12' + (state.combo > 1 ? ' · COMBO x' + state.combo : '')
      };
    }
    if (mission.id === 2) {
      if (state.buoysDone >= 3) {
        var rx = cfg.WORLD.runway.x - state.position.x;
        var rz = cfg.WORLD.runway.z - state.position.z;
        return { label: 'RETURN TO STRIP', distance: Math.sqrt(rx * rx + rz * rz), objective: 'All buoys lit — land on the strip' };
      }
      var buoy = null;
      for (var i = 0; i < world.buoys.length; i += 1) {
        if (!world.buoys[i].done) { buoy = world.buoys[i]; break; }
      }
      var bx = buoy.position.x - state.position.x;
      var bz = buoy.position.z - state.position.z;
      return {
        label: 'BUOY ' + (buoy.index + 1) + ' / 3',
        distance: Math.sqrt(bx * bx + bz * bz),
        objective: 'Flares ' + state.flaresDropped + ' dropped · Buoys lit ' + state.buoysDone + ' / 3'
      };
    }
    var deck = cfg.WORLD.stackDeck;
    var ddx = deck.x - state.position.x;
    var ddz = deck.z - state.position.z;
    if (state.onGround && phys.isOnDeck(state.position)) {
      return { label: 'STACK DECK', distance: 0, objective: 'Cargo ' + Math.round(state.cargo) + '% INTACT · Delivered' };
    }
    return {
      label: 'STACK DECK',
      distance: Math.sqrt(ddx * ddx + ddz * ddz),
      objective: 'Cargo ' + Math.round(state.cargo) + '% · Land under 3.5 m/s'
    };
  }

  function announce(message) {
    statusEl.textContent = message;
  }

  function startMission(index) {
    newFlight(index);
    screen = 'play';
    titleEl.style.display = 'none';
    overEl.style.display = 'none';
    helpEl.style.display = 'block';
    audio.start();
    announce(mission.name + '. ' + mission.brief);
    hud.showBanner(mission.name.toUpperCase(), mission.brief, '#4DFF9E', 4, time);
  }

  function endFlight(title, sub) {
    screen = 'over';
    document.getElementById('overTitle').textContent = title;
    document.getElementById('overScore').textContent = 'Score ' + state.score + ' · Rings ' + state.ringsPassed + ' / 12 · Hull ' + Math.round(state.hull) + '%';
    document.getElementById('overSub').textContent = sub;
    overEl.style.display = 'block';
    helpEl.style.display = 'none';
    announce(title + '. ' + sub);
  }

  function readInput() {
    var input = {
      pitch: 0, roll: 0, yaw: 0,
      throttle: state ? state.throttle : 0,
      brake: !!keys['KeyB']
    };
    if (keys['KeyW'] || keys['ArrowUp']) input.pitch -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) input.pitch += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) input.roll -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) input.roll += 1;
    if (keys['KeyQ']) input.yaw -= 1;
    if (keys['KeyE']) input.yaw += 1;
    if (keys['ShiftLeft'] || keys['ShiftRight']) input.throttle = Math.min(1, (state ? state.throttle : 0) + 0.35);
    if (keys['ControlLeft'] || keys['ControlRight']) input.throttle = Math.max(0, (state ? state.throttle : 0) - 0.35);
    // Mouse yoke: hold the button and steer from the centre, with a
    // dead zone in the middle so small moves do nothing.
    if (mouse.down) {
      var dx = (mouse.x - 640) / 640;
      var dy = (mouse.y - 360) / 360;
      if (Math.abs(dx) > 0.12) input.roll += dx * 1.4;
      if (Math.abs(dy) > 0.12) input.pitch += dy * 1.2;
    }
    input.roll = Math.max(-1, Math.min(1, input.roll));
    input.pitch = Math.max(-1, Math.min(1, input.pitch));
    return input;
  }

  function missionStep(dt) {
    if (mission.id === 1) {
      if (nextRing < world.rings.length) {
        var ring = world.rings[nextRing];
        var dist = phys.ringDistance(state, ring);
        if (dist < 18) {
          ring.passed = true;
          ring.mesh.material.color.setHex(0x4dff9e);
          state.ringsPassed += 1;
          state.combo += 1;
          var gained = 200 + (state.combo - 1) * 50;
          state.score += gained;
          audio.ringChime();
          hud.showBanner('RING ' + state.ringsPassed + ' / 12  +' + gained,
            state.combo > 1 ? 'Combo x' + state.combo + ' — tailwind surge' : 'Tailwind surge — keep the line', '#4DFF9E', 2.5, time);
          nextRing += 1;
          if (nextRing >= world.rings.length) {
            state.score += 1000;
            hud.showBanner('COURSE CLEAR  +1000', 'Land on the strip to bank the run', '#FFB84D', 4, time);
          }
        } else {
          // Missed when the ring is behind the plane and getting farther.
          var fx = Math.sin(state.heading);
          var fz = Math.cos(state.heading);
          var toRingX = ring.position.x - state.position.x;
          var toRingZ = ring.position.z - state.position.z;
          var ahead = toRingX * fx + toRingZ * fz;
          if (ahead < -40 && dist > 60) {
            nextRing += 1;
            state.combo = 0;
            state.timeLeft = Math.max(0, state.timeLeft - 5);
            hud.showBanner('RING MISSED  +5s', 'The gate is behind you — fly the next one', '#FF5A4D', 2.5, time);
          }
        }
      } else if (state.onGround && phys.isRunway(state.position) && state.speed < 2) {
        endFlight('RING RUN COMPLETE', 'Course clear and back on the strip. Score ' + state.score + '.');
      }
    }
    if (mission.id === 2) {
      if (state.buoysDone >= 3 && state.onGround && phys.isRunway(state.position) && state.speed < 2) {
        endFlight('RESCUE COMPLETE', 'All three buoys lit and home safe. Score ' + state.score + '.');
      }
      if (state.timeLeft <= 0 && screen === 'play') {
        endFlight('BATTERY FLAT', 'The rescue battery ran out. Score ' + state.score + '. Press R to fly again.');
      }
    }
    if (mission.id === 3) {
      if (state.maxG > 3.5 && state.cargo === 100) {
        state.cargo = 55;
        hud.showBanner('CARGO STRESSED', 'A hard turn over 3.5G — the cores took a knock', '#FF5A4D', 3, time);
      }
      if (state.onGround && phys.isOnDeck(state.position) && state.speed < 2) {
        var ok = state.cargo > 70 && state.lastTouchdown && state.lastTouchdown.fpm <= 690;
        endFlight(ok ? 'DELIVERY COMPLETE' : 'DELIVERY — CARGO DAMAGED',
          ok ? 'Cores intact on the stack deck. Score ' + state.score + '.' : 'The cores fractured on a hard landing. Score ' + state.score + '.');
      }
    }
  }

  function handleEvents(events) {
    if (events & phys.EVENT_STALL) {
      if (time - lastStallBeep > 2) {
        audio.stallTone();
        lastStallBeep = time;
        hud.showBanner('STALL', 'Nose down, add throttle', '#FF5A4D', 2, time);
      }
    }
    if (events & phys.EVENT_OUT_OF_FUEL) {
      hud.showBanner('FUEL EMPTY — DEAD-STICK GLIDE', 'Find a thermal or a strip. The engine is windmilling.', '#FFB84D', 4, time);
    }
    if (events & phys.EVENT_TOUCHDOWN) {
      var grade = state.lastTouchdown;
      audio.tireScreech();
      cameraCtl.addShake(0.5);
      world.spawnSmoke(state.position);
      var color = grade.label === 'HARD TOUCHDOWN' ? '#FF5A4D' : '#4DFF9E';
      hud.showBanner('TOUCHDOWN: ' + grade.fpm + ' FPM — ' + grade.label,
        '+' + grade.points + ' points', color, 3, time);
      if (grade.label === 'HARD TOUCHDOWN') {
        hud.showBanner('HARD IMPACT — GEAR STRAINED', 'Touchdown ' + grade.fpm + ' FPM. Hull ' + Math.round(state.hull) + '%', '#FF5A4D', 3, time);
      }
    }
    if (events & phys.EVENT_CRASH) {
      audio.crashThud();
      impactFreezeUntil = time + 0.8;
      var why = state.hull <= 0 ? 'HULL FAILURE' : (state.lastTouchdown ? 'HARD IMPACT — GEAR COLLAPSED' : 'TERRAIN STRIKE');
      hud.showBanner(why, 'The flight is over. Press R to fly again.', '#FF5A4D', 6, time);
      window.setTimeout(function () {
        if (screen === 'play') endFlight('CRASHED — ' + why, 'Score ' + state.score + '. Press R to fly again.');
      }, 900);
    }
  }

  function dropFlare() {
    if (!state || screen !== 'play' || mission.id !== 2) return;
    if (state.onGround) return;
    state.flaresDropped += 1;
    audio.flarePop();
    var pos = { x: state.position.x, y: state.position.y - 2, z: state.position.z };
    world.spawnFlare(pos);
    // Score the drop where the canister lands, not where it leaves.
    window.setTimeout(function () {
      if (!state) return;
      for (var i = 0; i < world.buoys.length; i += 1) {
        var b = world.buoys[i];
        if (b.done) continue;
        var dx = pos.x - b.position.x;
        var dz = pos.z - b.position.z;
        if (Math.sqrt(dx * dx + dz * dz) < 30) {
          b.done = true;
          state.buoysDone += 1;
          state.score += 400;
          hud.showBanner('BUOY ' + (i + 1) + ' LIT  +400', 'Flare in the ring. ' + state.buoysDone + ' of 3 done.', '#4DFF9E', 3, time);
          return;
        }
      }
      hud.showBanner('FLARE MISSED', 'Outside the 30 m ring — line up lower and slower', '#FFB84D', 2.5, time);
    }, 2600);
  }

  function step(dt) {
    time += dt;
    if (screen !== 'play') return;
    if (time < impactFreezeUntil) return; // impact freeze: the frame holds
    var input = readInput();
    var events = phys.step(state, input, dt, world);
    handleEvents(events);
    missionStep(dt);
    audio.update(state);
  }

  // One place decides cockpit vs chase for the HUD and the interior:
  // the live loop and the screenshot staging both call it before they
  // render, so a shot can never show the wrong horizon or a missing dash.
  function syncCockpitView() {
    var inCockpit = cameraCtl.getMode() === 'cockpit' || cameraCtl.getPreset() === 2;
    cockpitMod.setVisible(inCockpit);
    cockpitMod.pose(state);
    hud.setView(inCockpit ? 'cockpit' : 'chase');
  }

  function renderFrame() {
    if (!state) return;
    plane.setBladesVisible(!(cameraCtl.getMode() === 'cockpit' || cameraCtl.getPreset() === 2));
    plane.pose(state, time);
    if (screen === 'play' && !state.onGround) plane.pushTrail(state);
    cameraCtl.update(state, STEP, time);
    world.update(time);
    syncCockpitView();
    hud.update(state, mission, waypointFor(), time);
    renderer.render(scene, camera);
  }

  var accumulator = 0;
  var last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    while (accumulator >= STEP && screen === 'play') {
      step(STEP);
      accumulator -= STEP;
    }
    if (screen !== 'play') accumulator = 0;
    if (state) renderFrame();
  }

  // ---- Input wiring -------------------------------------------------
  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space') e.preventDefault();
    keys[e.code] = true;
    if (screen === 'title') {
      if (e.code === 'Digit1') missionIndex = 0;
      if (e.code === 'Digit2') missionIndex = 1;
      if (e.code === 'Digit3') missionIndex = 2;
      if (e.code === 'Enter' || e.code === 'Space') startMission(missionIndex);
      updateTitleSelection();
      return;
    }
    if (screen === 'play') {
      if (e.code === 'KeyP') {
        screen = 'paused';
        document.getElementById('paused').style.display = 'block';
        announce('Paused.');
      } else if (e.code === 'KeyC') {
        var mode = cameraCtl.toggleMode();
        hud.showBanner(mode === 'cockpit' ? 'COCKPIT CAMERA' : 'CHASE CAMERA', '', '#FFB84D', 1.5, time);
      } else if (e.code === 'Digit1') cameraCtl.setPreset(1);
      else if (e.code === 'Digit2') cameraCtl.setPreset(2);
      else if (e.code === 'Digit3') cameraCtl.setPreset(3);
      else if (e.code === 'Digit4') cameraCtl.setPreset(4);
      else if (e.code === 'Digit0') cameraCtl.clearPreset();
      else if (e.code === 'KeyG') {
        state.flaps = (state.flaps + 1) % 3;
        hud.showBanner('FLAPS ' + ['UP', 'TO', 'LDG'][state.flaps], '', '#FFB84D', 1.2, time);
      } else if (e.code === 'Space') dropFlare();
      else if (e.code === 'KeyM') {
        screen = 'title';
        titleEl.style.display = 'block';
        helpEl.style.display = 'none';
      }
    } else if (screen === 'paused') {
      if (e.code === 'KeyP' || e.code === 'Enter') {
        screen = 'play';
        document.getElementById('paused').style.display = 'none';
        announce('Flying.');
      }
    } else if (screen === 'over') {
      if (e.code === 'KeyR') startMission(missionIndex);
      if (e.code === 'KeyM') {
        screen = 'title';
        overEl.style.display = 'none';
        titleEl.style.display = 'block';
      }
    }
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });
  canvas.addEventListener('mousedown', function (e) {
    mouse.down = true;
    mouse.x = e.clientX * (1280 / window.innerWidth);
    mouse.y = e.clientY * (720 / window.innerHeight);
    audio.start();
  });
  window.addEventListener('mousemove', function (e) {
    mouse.x = e.clientX * (1280 / window.innerWidth);
    mouse.y = e.clientY * (720 / window.innerHeight);
  });
  window.addEventListener('mouseup', function () { mouse.down = false; });
  window.addEventListener('wheel', function (e) {
    if (!state || screen !== 'play') return;
    state.throttle = Math.max(0, Math.min(1, state.throttle - Math.sign(e.deltaY) * 0.06));
  }, { passive: true });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && screen === 'play') {
      screen = 'paused';
      document.getElementById('paused').style.display = 'block';
    }
  });
  document.getElementById('startBtn').addEventListener('click', function () {
    audio.start();
    startMission(missionIndex);
  });
  document.getElementById('retryBtn').addEventListener('click', function () { startMission(missionIndex); });
  document.getElementById('menuBtn').addEventListener('click', function () {
    screen = 'title';
    overEl.style.display = 'none';
    titleEl.style.display = 'block';
  });

  function updateTitleSelection() {
    var cards = document.querySelectorAll('.mission-card');
    for (var i = 0; i < cards.length; i += 1) {
      cards[i].classList.toggle('selected', i === missionIndex);
    }
  }
  var titleCards = document.querySelectorAll('.mission-card');
  for (var ci = 0; ci < titleCards.length; ci += 1) {
    (function (idx) {
      titleCards[idx].addEventListener('click', function () {
        missionIndex = idx;
        updateTitleSelection();
        audio.start();
        startMission(idx);
      });
    })(ci);
  }

  // ---- Screenshot mode ----------------------------------------------
  // ?shot=hero|cockpit|rescue|landing stages one real frame of the live
  // game: the world is built, the plane is placed, the HUD is drawn from
  // the staged state, and the frame is rendered by the same code that
  // renders play. Nothing is composited or edited after the fact.
  function stageShot(name) {
    var idx = name === 'rescue' ? 1 : (name === 'landing' ? 2 : 0);
    newFlight(idx);
    screen = 'play';
    titleEl.style.display = 'none';
    state.onGround = false;
    state.gearDown = name === 'landing';
    if (name === 'hero') {
      // Ring 5 at the stone arch, volcano behind it: the plane banks
      // left toward the gate with the peak framed beyond the ring.
      // The heading sits a touch right of the gate, so the ring rides
      // left of the horizon instrument instead of behind it.
      // v2: the frame shows the ring pass itself — rings 1-4 already
      // green behind the plane, the combo banner up, the VSI climbing.
      state.position = { x: -250, y: 185, z: -580 };
      state.heading = -2.45;
      state.pitch = -0.05;
      state.roll = 0.44;
      state.speed = 60.7;
      state.verticalSpeed = 2.0;
      state.throttle = 0.65;
      state.flaps = 0;
      state.fuel = 78;
      state.engineTemp = 62;
      state.timeLeft = 198;
      state.ringsPassed = 4;
      state.combo = 3;
      state.score = 1450;
      nextRing = 4;
      for (var r = 0; r < 4; r += 1) {
        world.rings[r].passed = true;
        world.rings[r].mesh.material.color.setHex(0x4dff9e);
      }
      cameraCtl.setPreset(1);
      hud.showBanner('RING 4 / 12  +200', 'Combo x3 — tailwind surge', '#4DFF9E', 30, 0);
    } else if (name === 'cockpit') {
      // Threading the canyon gate from above the ring: the gate sits
      // below the horizon instrument, the nose is a slim wedge at the
      // bottom, and the basalt walls frame the shot.
      // v2: the stress frame — hull 70%, heat 92% and blinking red,
      // fuel 12% with the LOW FUEL line, climbing on a thermal-less
      // 295 FPM. The dash, yoke and canopy frame are real geometry now.
      state.position = { x: -210, y: 170, z: -380 };
      state.heading = Math.PI;
      state.pitch = -0.03;
      state.roll = 0.06;
      state.speed = 55;
      state.verticalSpeed = 1.5;
      state.throttle = 0.65;
      state.flaps = 0;
      state.fuel = 12;
      state.engineTemp = 92;
      state.hull = 70;
      state.timeLeft = 143;
      state.ringsPassed = 3;
      state.combo = 2;
      state.score = 820;
      nextRing = 3;
      cameraCtl.setPreset(2);
    } else if (name === 'rescue') {
      // Banking past the first buoy: the flight path passes 20 m to the
      // side of it, so the ring reads ahead-right instead of swallowing
      // the frame, and the flare hangs between plane and buoy.
      // v2: the job is half done — one flare dropped, buoy 1 lit green,
      // the chute still falling toward the ring, VSI descending.
      state.position = { x: 310, y: 14, z: 30 };
      state.heading = -2.4;
      state.pitch = -0.02;
      state.roll = 0.3;
      state.speed = 45;
      state.verticalSpeed = -0.8;
      state.throttle = 0.6;
      state.flaps = 1;
      state.fuel = 66;
      state.engineTemp = 71;
      state.timeLeft = 232;
      state.score = 400;
      state.flaresDropped = 1;
      state.buoysDone = 1;
      world.lightBuoy(0);
      world.spawnFlare({ x: 285, y: 12, z: -25 });
      cameraCtl.setPreset(3);
    } else {
      // landing: wheels just touched on the stack deck, cargo intact.
      // The touchdown banner grades the landing that just happened, so
      // the objective, the waypoint and the timer all agree the
      // delivery is done — no more "STACK DECK 732 m" next to a
      // touchdown banner. The plane is big in the frame, on the marked
      // pad, with small smoke at the wheels only.
      state.position = { x: 520, y: 121.05, z: -412 };
      state.heading = Math.PI;
      state.pitch = -0.06;
      state.roll = 0.02;
      state.speed = 12;
      state.verticalSpeed = 0;
      state.throttle = 0.25;
      state.flaps = 2;
      state.fuel = 38;
      state.engineTemp = 55;
      state.timeLeft = 0;
      state.score = 2400;
      state.onGround = true;
      state.lastTouchdown = { label: 'SMOOTH TOUCHDOWN', points: 300, fpm: 110 };
      world.spawnSmoke({ x: 518.7, y: 120.5, z: -412 });
      world.spawnSmoke({ x: 521.3, y: 120.5, z: -412 });
      cameraCtl.setPreset(4);
      hud.showBanner('TOUCHDOWN: 110 FPM — SMOOTH TOUCHDOWN', '+300 points', '#4DFF9E', 30, 0);
    }
    cameraCtl.snapBehind(state);
    plane.setBladesVisible(name !== 'cockpit');
    plane.pose(state, 0);
    world.update(12.5); // fixed time, so the ocean and clouds never move between runs
    cameraCtl.update(state, STEP, 0);
    syncCockpitView();
    hud.update(state, mission, waypointFor(), 0);
    renderer.render(scene, camera);
    renderer.render(scene, camera);
    window.__shotReady = true;
  }

  if (shotName) {
    stageShot(shotName === 'play' || shotName === 'end' || shotName === 'start' ? 'hero' : shotName);
  } else {
    newFlight(0);
    updateTitleSelection();
    announce('Cinderwing. Choose a mission and press Enter to fly.');
    requestAnimationFrame(frame);
  }
})();
