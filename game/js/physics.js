// Cinderwing — physics.js
// One job: the flight model and the systems that turn flying into
// decisions. Lift, drag, thrust, stall, ground effect, crosswind, fuel
// burn, engine heat, hull damage, cargo integrity and landing grading.
// Pure numbers in, pure numbers out: no THREE calls, no DOM, so the
// model can be stepped by the game loop or staged for a screenshot.
(function () {
  'use strict';

  var cfg = window.Cinderwing.config;
  var AERO = cfg.AERO;
  var SYS = cfg.SYSTEMS;
  var WORLD = cfg.WORLD;

  var KNOTS = 1.94384;   // m/s to knots
  var FEET = 3.28084;    // metres to feet
  var MS_TO_FPM = 196.85;

  function createState(mission) {
    var start = mission.start;
    return {
      position: { x: start.x, y: start.y, z: start.z },
      heading: start.heading,
      pitch: 0,
      roll: 0,
      speed: start.speed,
      verticalSpeed: 0,
      throttle: 0,
      flaps: 0,
      gearDown: true,
      onGround: true,
      fuel: mission.fuelStart || SYS.fuelMax,
      hull: SYS.hullMax,
      engineTemp: 22,
      cargo: 100,
      stalled: false,
      crashed: false,
      landed: false,
      score: 0,
      combo: 0,
      ringsPassed: 0,
      flaresDropped: 0,
      buoysDone: 0,
      timeLeft: mission.timeLimit || mission.batterySeconds || 0,
      elapsed: 0,
      lastTouchdown: null,
      message: '',
      messageUntil: 0,
      rollInput: 0,
      pitchInput: 0,
      yawInput: 0,
      maxG: 0,
      inThermal: false
    };
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  // One fixed step of flight. `input` carries pitch/roll/yaw/throttle
  // in -1..1 plus flaps and brake flags. `world` gives ground height
  // and thermal columns. Returns event flags for the game loop.
  var EVENT_NONE = 0;
  var EVENT_STALL = 1;
  var EVENT_TOUCHDOWN = 2;
  var EVENT_CRASH = 4;
  var EVENT_RING = 8;
  var EVENT_FLARE_HIT = 16;
  var EVENT_OUT_OF_FUEL = 32;

  function step(state, input, dt, world) {
    if (state.crashed) return EVENT_NONE;
    var events = EVENT_NONE;
    state.elapsed += dt;
    if (state.timeLeft > 0) state.timeLeft -= dt;

    state.rollInput = input.roll;
    state.pitchInput = input.pitch;
    state.yawInput = input.yaw;

    // Throttle moves toward the target; Shift/Ctrl in the input layer
    // set the target, here we just ease it.
    state.throttle = clamp(state.throttle + (input.throttle - state.throttle) * Math.min(1, dt * 2.5), 0, 1);

    // Engine heat: above 90 percent throttle the engine cooks; below 70
    // it cools. Past the redline, thrust drops a quarter until it cools.
    var hot = state.throttle > 0.9;
    if (hot) state.engineTemp += SYS.heatPerSecond * dt;
    else if (state.throttle < 0.7) state.engineTemp -= SYS.coolPerSecond * dt;
    state.engineTemp = clamp(state.engineTemp, 15, 110);
    var thrustFactor = state.engineTemp > SYS.heatRedline ? 0.75 : 1;
    if (state.engineTemp > SYS.heatDamage) state.hull -= 2 * dt;

    // Thermals: inside a column the air lifts the plane and cools the
    // engine, so riding one is free altitude.
    state.inThermal = false;
    for (var i = 0; i < WORLD.thermals.length; i += 1) {
      var t = WORLD.thermals[i];
      var dx = state.position.x - t.x;
      var dz = state.position.z - t.z;
      if (dx * dx + dz * dz < t.radius * t.radius && state.position.y > 20 && state.position.y < 320) {
        state.inThermal = true;
        state.engineTemp -= 6 * dt;
        break;
      }
    }

    // Fuel: climb drinks, cruise sips, a thermal glide barely touches it.
    var burn = state.inThermal ? SYS.fuelGlide
      : (state.throttle > 0.85 ? SYS.fuelClimb : SYS.fuelCruise * (0.4 + state.throttle));
    if (state.speed > 1) state.fuel -= burn * dt;
    if (state.fuel <= 0) {
      state.fuel = 0;
      if (state.throttle > 0) {
        state.throttle = 0;
        events |= EVENT_OUT_OF_FUEL;
      }
    }

    // Attitude: bank, pitch and yaw follow the stick, with a soft cap.
    var rollAuthority = state.onGround ? 0 : 1;
    state.roll = clamp(state.roll + input.roll * AERO.rollRate * rollAuthority * dt, -AERO.maxBank, AERO.maxBank);
    state.roll *= Math.pow(0.4, dt); // the wing levels itself when the stick centres
    state.pitch = clamp(state.pitch + input.pitch * AERO.pitchRate * dt * (state.onGround ? 0.4 : 1), -0.6, 0.5);
    // A bank turns the nose: coordinated, so the turn rate follows the bank.
    state.heading += -Math.sin(state.roll) * 0.9 * dt * (state.speed / AERO.cruiseSpeed);
    state.heading += input.yaw * AERO.yawRate * dt * 0.5;

    // Speed: thrust pushes forward, drag and hard banks bleed it off.
    var targetSpeed = state.throttle * AERO.maxSpeed * thrustFactor;
    var accel = (targetSpeed - state.speed) * 0.35;
    accel -= Math.abs(Math.sin(state.roll)) * AERO.turnBleed * (state.speed / AERO.cruiseSpeed);
    accel -= Math.max(0, -state.pitch) * 6; // climbing costs speed, diving gives it back
    state.speed = clamp(state.speed + accel * dt, 0, AERO.maxSpeed + 8);

    // Stall: below the stall speed the wing quits and the nose drops.
    var stallSpeed = state.flaps === 2 ? AERO.stallSpeedFlaps : (state.flaps === 1 ? 20 : AERO.stallSpeedClean);
    var wasStalled = state.stalled;
    state.stalled = !state.onGround && state.speed < stallSpeed;
    if (state.stalled && !wasStalled) events |= EVENT_STALL;

    // Vertical speed: pitch and throttle set the climb, gravity sets the
    // sink when slow, thermals and ground effect cushion the bottom.
    var climb = -Math.sin(state.pitch) * state.speed * 0.9;
    climb += (state.throttle - 0.45) * AERO.climbRate * 0.4;
    if (state.stalled) climb -= 6;
    if (state.inThermal) climb += WORLD.thermals[0].lift * 0.6;
    var ground = world.terrainHeightAt(state.position.x, state.position.z);
    var heightAbove = state.position.y - ground;
    if (heightAbove < AERO.groundEffect * 2 && !state.onGround) climb += 1.2; // ground-effect cushion
    if (state.onGround) climb = 0;
    state.verticalSpeed = climb;

    // Move: forward along the heading, up by the climb.
    var fx = Math.sin(state.heading);
    var fz = Math.cos(state.heading);
    state.position.x += fx * state.speed * dt;
    state.position.z += fz * state.speed * dt;
    state.position.y += state.verticalSpeed * dt;

    // G load, for the cargo: a hard bank at speed is what fractures it.
    var gLoad = 1 + Math.abs(Math.sin(state.roll)) * (state.speed / AERO.cruiseSpeed) * 2.2;
    if (gLoad > state.maxG) state.maxG = gLoad;

    // Ground contact: landing, hard touchdown or crash.
    ground = world.terrainHeightAt(state.position.x, state.position.z);
    var gearHeight = 1.05;
    if (state.position.y <= ground + gearHeight && !state.onGround) {
      var sink = -state.verticalSpeed;
      state.position.y = ground + gearHeight;
      if (sink > SYS.crashVertical || (state.speed > 30 && ground > 2 && !isRunway(state.position))) {
        state.crashed = true;
        events |= EVENT_CRASH;
      } else {
        state.onGround = true;
        state.landed = true;
        state.verticalSpeed = 0;
        var grade = gradeTouchdown(sink, state);
        state.lastTouchdown = grade;
        state.score += grade.points;
        events |= EVENT_TOUCHDOWN;
        if (sink > SYS.hardTouchdown) state.hull -= (sink - SYS.hardTouchdown) * 12;
        if (sink > SYS.cargoMaxSink && state.missionId === 3) {
          state.cargo = Math.max(0, state.cargo - 45);
        }
      }
    }
    // Take-off: fast enough and pitched up, the wheels leave the ground.
    if (state.onGround && state.speed > AERO.rotateSpeed && state.pitch < -0.08) {
      state.onGround = false;
    }
    // Rolling on the ground: brakes and drag slow the plane.
    if (state.onGround) {
      state.speed = Math.max(0, state.speed - (input.brake ? 14 : 2) * dt);
      state.position.y = ground + gearHeight;
    }
    // Hitting a cliff face or a stack side-on, above the ground, is a crash.
    if (!state.onGround && !state.crashed) {
      var groundNow = world.terrainHeightAt(state.position.x, state.position.z);
      if (state.position.y < groundNow + 0.5) {
        state.crashed = true;
        events |= EVENT_CRASH;
      }
    }
    if (state.hull <= 0) {
      state.hull = 0;
      state.crashed = true;
      events |= EVENT_CRASH;
    }
    return events;
  }

  function isRunway(pos) {
    var r = WORLD.runway;
    return Math.abs(pos.x - r.x) < r.width / 2 + 6 && Math.abs(pos.z - r.z) < r.length / 2 + 6;
  }

  function isOnDeck(pos) {
    var d = WORLD.stackDeck;
    var dx = pos.x - d.x;
    var dz = pos.z - d.z;
    return Math.sqrt(dx * dx + dz * dz) < d.radius;
  }

  // Landing grades, by sink rate: the number the pilot remembers.
  function gradeTouchdown(sinkFpm, state) {
    var fpm = sinkFpm * MS_TO_FPM;
    if (fpm <= 120) return { label: 'GREASED', points: 500, fpm: Math.round(fpm) };
    if (fpm <= 220) return { label: 'SMOOTH TOUCHDOWN', points: 300, fpm: Math.round(fpm) };
    if (fpm <= 350) return { label: 'FIRM TOUCHDOWN', points: 150, fpm: Math.round(fpm) };
    return { label: 'HARD TOUCHDOWN', points: 25, fpm: Math.round(fpm) };
  }

  // Ring check: the plane is through the gate when it is close to the
  // ring centre and roughly facing along the course.
  function ringDistance(state, ring) {
    var dx = state.position.x - ring.position.x;
    var dy = state.position.y - ring.position.y;
    var dz = state.position.z - ring.position.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  function toKnots(ms) { return Math.round(ms * KNOTS); }
  function toFeet(m) { return Math.round(m * FEET); }
  function toFpm(ms) { return Math.round(ms * MS_TO_FPM); }
  function headingDegrees(heading) {
    var deg = ((-heading * 180 / Math.PI) % 360 + 360) % 360;
    return Math.round(deg);
  }

  window.Cinderwing.physics = {
    createState: createState,
    step: step,
    gradeTouchdown: gradeTouchdown,
    ringDistance: ringDistance,
    isRunway: isRunway,
    isOnDeck: isOnDeck,
    toKnots: toKnots,
    toFeet: toFeet,
    toFpm: toFpm,
    headingDegrees: headingDegrees,
    EVENT_NONE: EVENT_NONE,
    EVENT_STALL: EVENT_STALL,
    EVENT_TOUCHDOWN: EVENT_TOUCHDOWN,
    EVENT_CRASH: EVENT_CRASH,
    EVENT_RING: EVENT_RING,
    EVENT_FLARE_HIT: EVENT_FLARE_HIT,
    EVENT_OUT_OF_FUEL: EVENT_OUT_OF_FUEL
  };
})();
