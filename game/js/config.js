// Cinderwing — config.js
// One job: every number the game tunes lives here. Aero constants, limits,
// palette, the three mission layouts and the deterministic seed.
// No code in this file reads the network, the DOM or the clock.
(function () {
  'use strict';

  // Seeded random: the same seed always builds the same islands, so a
  // screenshot taken today matches one taken tomorrow.
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var PALETTE = {
    skyTop: 0x6fb7d9,
    skyHorizon: 0xfff2d6,
    fog: 0x9ad4e8,
    sun: 0xfff2d6,
    oceanDeep: 0x0e6f8f,
    oceanShallow: 0x2fb3a6,
    oceanFoam: 0xbfeee6,
    basalt: 0x3a3632,
    basaltLight: 0x5c564e,
    terracotta: 0xb45a32,
    terracottaLight: 0xd07a4a,
    sand: 0xd9c08a,
    grass: 0x6f9e4f,
    grassDry: 0xa8a05a,
    runway: 0x2e3138,
    runwayLine: 0xf2ead8,
    ring: 0x37e0ff,
    ringDone: 0x4dff9e,
    buoy: 0xff7a1a,
    flare: 0xff8c1a,
    planeBody: 0xf2ead8,
    planeAccent: 0xd23c28,
    planeWing: 0xe8ddc2,
    canopy: 0x2a6f8f,
    hudAmber: '#FFB84D',
    hudGreen: '#4DFF9E',
    hudRed: '#FF5A4D',
    hudCyan: '#37E0FF',
    // Bezels at 0.88: opaque enough that rocks and smoke never show
    // through a panel (a v1 frame had canyon rock bleeding through the
    // compass), still translucent enough to feel like glass.
    bezel: 'rgba(10,18,24,0.88)'
  };

  // Flight model numbers, tuned for a forgiving arcade feel: the plane
  // should answer at every speed and never feel dead on the flare.
  var AERO = {
    maxSpeed: 72,        // m/s, level flight at full throttle
    cruiseSpeed: 38,     // m/s, the speed the missions are built around
    stallSpeedClean: 24, // m/s, flaps up
    stallSpeedFlaps: 17, // m/s, flaps landing
    rotateSpeed: 28,     // m/s, rotate on take-off
    climbRate: 9,        // m/s at full throttle, clean
    sinkRate: 3.2,       // m/s gliding at idle
    rollRate: 1.9,       // rad/s at full aileron
    pitchRate: 1.1,      // rad/s at full elevator
    yawRate: 0.45,       // rad/s rudder
    turnBleed: 0.55,     // speed lost per second in a hard bank
    groundEffect: 1.6,   // extra lift cushion, metres above ground
    maxBank: 1.1,        // rad, soft-capped
    gravity: 9.81
  };

  // Fuel and damage: the numbers that turn a sortie into decisions.
  var SYSTEMS = {
    fuelMax: 100,
    fuelClimb: 2.6,      // units per second at full throttle in a climb
    fuelCruise: 1.0,     // units per second at cruise throttle
    fuelGlide: 0.15,     // units per second riding a thermal
    heatPerSecond: 7.5,  // engine temp gain above 90 percent throttle
    coolPerSecond: 9.0,  // engine temp loss below 70 percent throttle
    heatRedline: 90,     // percent: above this, thrust drops 25 percent
    heatDamage: 96,      // percent: above this, hull takes damage
    hullMax: 100,
    hardTouchdown: 4.0,  // m/s vertical speed that bends the gear
    crashVertical: 6.0,  // m/s vertical speed that ends the flight
    cargoMaxG: 3.5,      // turns harder than this fracture the cryo cores
    cargoMaxSink: 3.5    // m/s touchdown sink that fractures the cargo
  };

  // The three missions. Each one is a different job, not a reskin:
  // rings reward speed and line, the rescue rewards low flying and timing,
  // the delivery rewards gentleness above all.
  var MISSIONS = [
    {
      id: 1,
      name: 'Caldera Ring Run',
      short: 'RING RUN',
      brief: 'Thread 12 wind rings through the arches. A ring is a tailwind surge. A miss costs 5 seconds.',
      start: { x: 0, y: 122, z: 330, heading: Math.PI, speed: 0 },
      rings: 12,
      timeLimit: 240
    },
    {
      id: 2,
      name: 'Buoy Flare Rescue',
      short: 'FLARE RESCUE',
      brief: 'Skim low at 30 to 60 feet. Drop a flare into each buoy ring, then race the battery home.',
      start: { x: 0, y: 122, z: 330, heading: Math.PI, speed: 0 },
      buoys: 3,
      batterySeconds: 300
    },
    {
      id: 3,
      name: 'Sea-Stack Cryo Delivery',
      short: 'CRYO DELIVERY',
      brief: 'Carry fragile medical cores across the gusty channel. Land soft on the stack deck or the cargo fractures.',
      start: { x: 0, y: 122, z: 330, heading: Math.PI, speed: 0 },
      fuelStart: 55
    }
  ];

  // Fixed landmarks, placed by hand so every screenshot frames the same way.
  var WORLD = {
    seed: 7,
    oceanSize: 4200,
    oceanSegments: 48,
    // Observatory ridge strip: the home runway, on a mesa top.
    runway: { x: 0, y: 120, z: 220, length: 260, width: 18, heading: Math.PI },
    // Volcanic cone with the caldera.
    volcano: { x: -620, y: 0, z: -820, radius: 340, height: 265 },
    // Canyon gate the cockpit shot threads.
    canyon: { x: -210, z: -520, gapWidth: 90, wallHeight: 150, length: 420 },
    // Sea stacks and the delivery deck.
    stacks: [
      { x: 520, z: -420, radius: 46, height: 120 },
      { x: 640, z: -560, radius: 34, height: 88 },
      { x: 430, z: -620, radius: 26, height: 64 }
    ],
    stackDeck: { x: 520, y: 122, z: -420, radius: 26 },
    // Rescue buoys, drifting in the channel.
    buoys: [
      { x: 260, z: -60 },
      { x: 330, z: -190 },
      { x: 210, z: -300 }
    ],
    // Thermal columns: free altitude and free cooling.
    thermals: [
      { x: -380, z: -380, radius: 42, lift: 5.5 },
      { x: 180, z: -480, radius: 38, lift: 5.0 },
      { x: -120, z: 60, radius: 34, lift: 4.5 }
    ]
  };

  // Camera presets for screenshots (keys 1 to 4) and the chase defaults.
  var CAMERA = {
    chaseDistance: 14,
    chaseHeight: 4.5,
    chaseLag: 4.2,
    // The eye sits above the canopy, looking over the nose: low enough
    // to feel seated, high enough that the fuselage top stays below
    // the frame instead of wedging white across the dash.
    cockpitOffset: { x: 0, y: 1.6, z: 1.6 }
  };

  window.Cinderwing = window.Cinderwing || {};
  window.Cinderwing.config = {
    mulberry32: mulberry32,
    PALETTE: PALETTE,
    AERO: AERO,
    SYSTEMS: SYSTEMS,
    MISSIONS: MISSIONS,
    WORLD: WORLD,
    CAMERA: CAMERA
  };
})();
