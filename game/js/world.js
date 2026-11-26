// Cinderwing — world.js
// One job: build the whole archipelago and keep it alive. Sky dome, sun,
// faceted ocean, stepped volcanic islands, the home runway, the canyon,
// the sea stacks, the rings, the buoys and the thermals. Everything is
// placed by hand from config so a screenshot frames the same way twice.
(function () {
  'use strict';

  var cfg = window.Cinderwing.config;
  var P = cfg.PALETTE;
  var W = cfg.WORLD;

  var scene = null;
  var rng = cfg.mulberry32(W.seed);
  var ocean = null;
  var oceanBase = null;
  var rings = [];
  var buoys = [];
  var clouds = [];
  var flareMeshes = [];
  var smokePuffs = [];

  function lambert(color, opts) {
    var o = { color: color, flatShading: true };
    if (opts) for (var k in opts) o[k] = opts[k];
    return new THREE.MeshLambertMaterial(o);
  }

  function jitterGeometry(geo, amount) {
    var pos = geo.attributes.position;
    for (var i = 0; i < pos.count; i += 1) {
      pos.setXYZ(i,
        pos.getX(i) + (rng() - 0.5) * amount,
        pos.getY(i) + (rng() - 0.5) * amount,
        pos.getZ(i) + (rng() - 0.5) * amount);
    }
    geo.computeVertexNormals();
    return geo;
  }

  function paintVertices(geo, colorA, colorB, byHeight) {
    var pos = geo.attributes.position;
    var colors = new Float32Array(pos.count * 3);
    var ca = new THREE.Color(colorA);
    var cb = new THREE.Color(colorB);
    var tmp = new THREE.Color();
    for (var i = 0; i < pos.count; i += 1) {
      var t = byHeight ? (pos.getY(i) + 10) / 40 : rng();
      t = Math.max(0, Math.min(1, t));
      tmp.copy(ca).lerp(cb, t);
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }

  function buildSky() {
    var geo = new THREE.SphereGeometry(3200, 16, 10);
    var pos = geo.attributes.position;
    var colors = new Float32Array(pos.count * 3);
    var top = new THREE.Color(P.skyTop);
    var horizon = new THREE.Color(P.skyHorizon);
    var tmp = new THREE.Color();
    for (var i = 0; i < pos.count; i += 1) {
      var t = Math.max(0, Math.min(1, (pos.getY(i) / 3200 + 0.15) * 1.4));
      tmp.copy(horizon).lerp(top, t);
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    var mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false });
    var dome = new THREE.Mesh(geo, mat);
    scene.add(dome);

    // The sun itself, a pale disc low over the water: without it the
    // sky is a flat gradient with no source for the golden-hour light.
    var sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(110, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff6d8, fog: false }));
    sunDisc.position.set(-2160, 1680, 1440);
    sunDisc.lookAt(0, 0, 0);
    scene.add(sunDisc);

    // Low golden-hour sun, the one light the whole scene is lit by.
    var sun = new THREE.DirectionalLight(P.sun, 1.15);
    sun.position.set(-900, 700, 600);
    scene.add(sun);
    // Cool fill from the opposite side: basalt faces away from the sun
    // would otherwise read as flat black slabs from the sea.
    var fill = new THREE.DirectionalLight(0xbfd9e8, 0.55);
    fill.position.set(900, 300, -800);
    scene.add(fill);
    var hemi = new THREE.HemisphereLight(0xbfd9e8, 0x3a2f26, 0.75);
    scene.add(hemi);
    scene.fog = new THREE.Fog(P.fog, 700, 2900);
  }

  function buildOcean() {
    var geo = new THREE.PlaneGeometry(W.oceanSize, W.oceanSize, W.oceanSegments, W.oceanSegments);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position;
    var colors = new Float32Array(pos.count * 3);
    var deep = new THREE.Color(P.oceanDeep);
    var shallow = new THREE.Color(P.oceanShallow);
    var tmp = new THREE.Color();
    for (var i = 0; i < pos.count; i += 1) {
      var x = pos.getX(i);
      var z = pos.getZ(i);
      var d = Math.sqrt(x * x + z * z);
      // Deep water far from land, shallow turquoise near it, plus slow
      // depth bands so the sea never reads as one flat cyan sheet.
      var t = Math.max(0, Math.min(1, (900 - d) / 900));
      t += 0.10 * Math.sin(d * 0.045) + 0.06 * Math.sin(x * 0.02 + z * 0.017);
      t = Math.max(0, Math.min(1, t));
      tmp.copy(deep).lerp(shallow, t * 0.7 + rng() * 0.12);
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    var mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    ocean = new THREE.Mesh(geo, mat);
    ocean.position.y = 0;
    scene.add(ocean);
    oceanBase = pos.array.slice();
    buildFoam();
  }

  // Foam where water meets rock, and bright streaks across the channel:
  // the low rescue skim needs the sea to feel fast underneath it.
  // Kept narrow and dim: a wide bright ring around the delivery stack
  // reads as a green halo in the landing frame instead of foam.
  function buildFoam() {
    var foamMat = new THREE.MeshBasicMaterial({ color: P.oceanFoam, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
    function ring(cx, cz, rIn, rOut) {
      var m = new THREE.Mesh(new THREE.RingGeometry(rIn, rOut, 28), foamMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(cx, 0.35, cz);
      scene.add(m);
    }
    ring(0, 220, 304, 312); // mesa shore
    ring(W.volcano.x, W.volcano.z, W.volcano.radius + 2, W.volcano.radius + 8);
    for (var i = 0; i < W.stacks.length; i += 1) {
      ring(W.stacks[i].x, W.stacks[i].z, W.stacks[i].radius + 2, W.stacks[i].radius + 6);
    }
    // Streaks: long thin foam lines scattered through the rescue
    // channel, so 46 ft up still reads as speed.
    var streakMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
    for (var j = 0; j < 26; j += 1) {
      var streak = new THREE.Mesh(new THREE.PlaneGeometry(10 + rng() * 18, 1 + rng() * 1.5), streakMat);
      streak.rotation.x = -Math.PI / 2;
      streak.rotation.z = rng() * Math.PI;
      streak.position.set(120 + rng() * 420, 0.4, -340 + rng() * 420);
      scene.add(streak);
    }
    // Sun glint: a loose trail of bright flecks on the water toward
    // the low sun, on the side the rescue camera looks across.
    var glintMat = new THREE.MeshBasicMaterial({ color: 0xfff2d6, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
    for (var k = 0; k < 14; k += 1) {
      var glint = new THREE.Mesh(new THREE.PlaneGeometry(6 + rng() * 14, 1.5 + rng() * 2), glintMat);
      glint.rotation.x = -Math.PI / 2;
      glint.rotation.z = 0.5 + rng() * 0.4;
      glint.position.set(-500 - rng() * 400, 0.45, 150 + rng() * 350);
      scene.add(glint);
    }
  }

  // A stepped mesa: three stacked slabs, grass on top, terracotta and
  // basalt below. The home runway sits on its flat top.
  function buildMesa() {
    var group = new THREE.Group();
    var slabs = [
      { r: 300, h: 40, y: 20, c: P.basalt },
      { r: 230, h: 42, y: 60, c: P.terracotta },
      { r: 170, h: 40, y: 100, c: P.grass }
    ];
    for (var i = 0; i < slabs.length; i += 1) {
      var s = slabs[i];
      var geo = new THREE.CylinderGeometry(s.r, s.r + 26, s.h, 9);
      jitterGeometry(geo, 4);
      paintVertices(geo, s.c, P.basaltLight, false);
      var mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
      mesh.position.set(0, s.y, 220);
      group.add(mesh);
    }
    scene.add(group);
  }

  function buildVolcano() {
    var v = W.volcano;
    var geo = new THREE.ConeGeometry(v.radius, v.height, 11, 3);
    jitterGeometry(geo, 14);
    paintVertices(geo, P.terracotta, P.basalt, true);
    var cone = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    cone.position.set(v.x, v.height / 2, v.z);
    scene.add(cone);
    // Crater rim and a dark glowing mouth.
    var rim = new THREE.Mesh(
      new THREE.TorusGeometry(52, 14, 6, 10),
      lambert(P.basaltLight));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(v.x, v.height - 4, v.z);
    scene.add(rim);
    var mouth = new THREE.Mesh(
      new THREE.CircleGeometry(44, 10),
      new THREE.MeshBasicMaterial({ color: 0xff6a1a }));
    mouth.rotation.x = -Math.PI / 2;
    mouth.position.set(v.x, v.height - 6, v.z);
    scene.add(mouth);
    // Heat smoke rising from the crater.
    for (var i = 0; i < 5; i += 1) {
      var puff = new THREE.Mesh(
        new THREE.IcosahedronGeometry(14 + i * 5, 0),
        new THREE.MeshLambertMaterial({ color: 0xd8d2c4, transparent: true, opacity: 0.5, flatShading: true }));
      puff.position.set(v.x + (rng() - 0.5) * 30, v.height + 18 + i * 22, v.z + (rng() - 0.5) * 30);
      scene.add(puff);
      smokePuffs.push(puff);
    }
  }

  // Two long basalt walls with a flyable gap between them: the canyon.
  // The walls are painted in horizontal strata (basalt and terracotta
  // bands every 18 m), so they read as layered cliff, not grey slabs.
  function buildCanyon() {
    var c = W.canyon;
    function strataPaint(geo) {
      var pos = geo.attributes.position;
      var colors = new Float32Array(pos.count * 3);
      var dark = new THREE.Color(P.basalt);
      var light = new THREE.Color(P.basaltLight);
      var rust = new THREE.Color(P.terracotta);
      var tmp = new THREE.Color();
      for (var i = 0; i < pos.count; i += 1) {
        var band = Math.floor((pos.getY(i) + c.wallHeight / 2) / 18) % 3;
        tmp.copy(band === 2 ? rust : (band === 1 ? light : dark));
        var shade = 0.9 + rng() * 0.2;
        colors[i * 3] = tmp.r * shade; colors[i * 3 + 1] = tmp.g * shade; colors[i * 3 + 2] = tmp.b * shade;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      return geo;
    }
    var wallGeo = new THREE.BoxGeometry(60, c.wallHeight, c.length);
    jitterGeometry(wallGeo, 8);
    strataPaint(wallGeo);
    var mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    var left = new THREE.Mesh(wallGeo, mat);
    left.position.set(c.x - c.gapWidth / 2 - 30, c.wallHeight / 2, c.z);
    scene.add(left);
    var right = new THREE.Mesh(wallGeo.clone(), mat);
    right.position.set(c.x + c.gapWidth / 2 + 30, c.wallHeight / 2, c.z);
    scene.add(right);
    // Grassy caps on the wall tops: the cliffs read as vegetated
    // headland from above instead of bare grey slabs.
    var capGeo = new THREE.BoxGeometry(58, 2.5, c.length - 8);
    var capMat = lambert(P.grass);
    var capL = new THREE.Mesh(capGeo, capMat);
    capL.position.set(c.x - c.gapWidth / 2 - 30, c.wallHeight + 1, c.z);
    scene.add(capL);
    var capR = new THREE.Mesh(capGeo, capMat);
    capR.position.set(c.x + c.gapWidth / 2 + 30, c.wallHeight + 1, c.z);
    scene.add(capR);
    // Boulders on the wall tops break up the flat slabs from above.
    // They stay clear of the ring-run approach (z -700 to -460), where
    // the plane and the gates fly, so no rock ever crowds a wingtip.
    for (var i = 0; i < 10; i += 1) {
      var rock = new THREE.Mesh(
        jitterGeometry(new THREE.DodecahedronGeometry(5 + rng() * 6, 0), 2),
        lambert(i % 2 ? P.basaltLight : P.terracotta));
      var side = i % 2 ? -1 : 1;
      var rockZ = rng() < 0.5
        ? (c.z - c.length / 2 + rng() * 30)
        : (c.z + 60 + rng() * 150);
      rock.position.set(
        c.x + side * (c.gapWidth / 2 + 52) + (rng() - 0.5) * 20,
        c.wallHeight + 3,
        rockZ);
      scene.add(rock);
    }
  }

  // A stone arch: two pillars and a beam, standing in the sea.
  function buildArch(x, z, rotY, scale) {
    var group = new THREE.Group();
    var mat = lambert(P.basalt);
    var mat2 = lambert(P.terracottaLight);
    var pillarGeo = new THREE.BoxGeometry(10, 70, 14);
    jitterGeometry(pillarGeo, 3);
    var a = new THREE.Mesh(pillarGeo, mat);
    a.position.set(-16, 35, 0);
    var b = new THREE.Mesh(pillarGeo.clone(), mat);
    b.position.set(16, 35, 0);
    var beamGeo = new THREE.BoxGeometry(46, 12, 16);
    jitterGeometry(beamGeo, 3);
    var beam = new THREE.Mesh(beamGeo, mat2);
    beam.position.set(0, 74, 0);
    group.add(a); group.add(b); group.add(beam);
    group.position.set(x, 0, z);
    group.rotation.y = rotY;
    group.scale.setScalar(scale);
    scene.add(group);
  }

  function buildStacks() {
    for (var i = 0; i < W.stacks.length; i += 1) {
      var s = W.stacks[i];
      var geo = new THREE.CylinderGeometry(s.radius * 0.55, s.radius, s.height, 8);
      jitterGeometry(geo, 6);
      paintVertices(geo, P.terracotta, P.basalt, true);
      var mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
      mesh.position.set(s.x, s.height / 2, s.z);
      scene.add(mesh);
    }
    // The delivery deck: a flat pad on the first stack with a painted H.
    // The pad top sits at the stack top (y 120), which is also the
    // physics ground there: a plane landing on it must sit on the pad,
    // not sink three metres into it.
    var deck = W.stackDeck;
    var pad = new THREE.Mesh(
      new THREE.CylinderGeometry(deck.radius, deck.radius + 4, 4, 12),
      lambert(P.runway));
    pad.position.set(deck.x, deck.y - 4, deck.z);
    scene.add(pad);
    var target = new THREE.Mesh(
      new THREE.RingGeometry(deck.radius - 18, deck.radius - 16, 24),
      new THREE.MeshBasicMaterial({ color: P.ringDone, side: THREE.DoubleSide }));
    target.rotation.x = -Math.PI / 2;
    target.position.set(deck.x, deck.y - 1.8, deck.z);
    scene.add(target);
    // Threshold bars across the approach edge of the pad, and green
    // edge lights around the rim: the deck must read as a landing pad,
    // not a bare rock top.
    var deckLineMat = new THREE.MeshBasicMaterial({ color: P.runwayLine });
    for (var b = 0; b < 3; b += 1) {
      var dbar = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.6), deckLineMat);
      dbar.rotation.x = -Math.PI / 2;
      dbar.position.set(deck.x - 6 + b * 6, deck.y - 1.8, deck.z + deck.radius - 4);
      scene.add(dbar);
    }
    for (var e = 0; e < 8; e += 1) {
      var ang = (e / 8) * Math.PI * 2;
      var elight = new THREE.Mesh(
        new THREE.SphereGeometry(1.2, 6, 5),
        new THREE.MeshBasicMaterial({ color: P.ringDone }));
      elight.position.set(deck.x + Math.cos(ang) * (deck.radius + 1), deck.y - 1.5, deck.z + Math.sin(ang) * (deck.radius + 1));
      scene.add(elight);
    }
  }

  function buildRunway() {
    var r = W.runway;
    var strip = new THREE.Mesh(
      new THREE.PlaneGeometry(r.width, r.length),
      lambert(P.runway));
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(r.x, r.y + 0.4, r.z);
    scene.add(strip);
    // Centreline dashes and threshold bars, painted on the strip.
    var lineMat = new THREE.MeshBasicMaterial({ color: P.runwayLine });
    for (var i = 0; i < 9; i += 1) {
      var dash = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 12), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(r.x, r.y + 0.6, r.z - r.length / 2 + 22 + i * 27);
      scene.add(dash);
    }
    // Glideslope lights: four green lamps beside the threshold.
    for (var j = 0; j < 4; j += 1) {
      var lamp = new THREE.Mesh(
        new THREE.SphereGeometry(1.6, 6, 5),
        new THREE.MeshBasicMaterial({ color: P.ringDone }));
      lamp.position.set(r.x + r.width / 2 + 6 + j * 4, r.y + 2, r.z - r.length / 2 + 26);
      scene.add(lamp);
    }
    // Edge lights down both sides of the strip, so the runway reads
    // as a runway from the air instead of a dark slab.
    var edgeMat = new THREE.MeshBasicMaterial({ color: 0xfff2d6 });
    for (var k = 0; k < 9; k += 1) {
      var ez = r.z - r.length / 2 + 14 + k * 29;
      var eL = new THREE.Mesh(new THREE.SphereGeometry(1.1, 6, 5), edgeMat);
      eL.position.set(r.x - r.width / 2 - 2, r.y + 1.5, ez);
      scene.add(eL);
      var eR = new THREE.Mesh(new THREE.SphereGeometry(1.1, 6, 5), edgeMat);
      eR.position.set(r.x + r.width / 2 + 2, r.y + 1.5, ez);
      scene.add(eR);
    }
    // Threshold bars at both ends of the strip.
    for (var m = 0; m < 3; m += 1) {
      var barN = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.6), lineMat);
      barN.rotation.x = -Math.PI / 2;
      barN.position.set(r.x - 5 + m * 5, r.y + 0.6, r.z - r.length / 2 + 8);
      scene.add(barN);
      var barS = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.6), lineMat);
      barS.rotation.x = -Math.PI / 2;
      barS.position.set(r.x - 5 + m * 5, r.y + 0.6, r.z + r.length / 2 - 8);
      scene.add(barS);
    }
    // Windsock on a pole at the far end.
    var pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 12, 6),
      lambert(0x8a8f96));
    pole.position.set(r.x - r.width / 2 - 8, r.y + 6, r.z + r.length / 2 - 20);
    scene.add(pole);
    var sock = new THREE.Mesh(
      new THREE.ConeGeometry(2.2, 9, 6),
      lambert(0xff7a1a));
    sock.rotation.z = Math.PI / 2.4;
    sock.position.set(r.x - r.width / 2 - 5, r.y + 11, r.z + r.length / 2 - 20);
    scene.add(sock);
  }

  // The ring-run course: 12 glowing gates from the strip, through the
  // canyon and the arches, around the volcano and home.
  var RING_PATH = [
    { x: -40, y: 150, z: 120 }, { x: -120, y: 155, z: -80 },
    { x: -180, y: 150, z: -300 }, { x: -210, y: 140, z: -520 },
    { x: -300, y: 165, z: -640 }, { x: -460, y: 185, z: -720 },
    { x: -620, y: 210, z: -700 }, { x: -700, y: 190, z: -540 },
    { x: -560, y: 170, z: -380 }, { x: -380, y: 160, z: -260 },
    { x: -200, y: 150, z: -120 }, { x: -60, y: 145, z: 40 }
  ];

  function buildRings() {
    for (var i = 0; i < RING_PATH.length; i += 1) {
      var p = RING_PATH[i];
      var mesh = new THREE.Mesh(
        new THREE.TorusGeometry(16, 1.6, 8, 24),
        new THREE.MeshBasicMaterial({ color: P.ring }));
      mesh.position.set(p.x, p.y, p.z);
      mesh.rotation.y = Math.atan2(p.x - (RING_PATH[Math.max(0, i - 1)].x), p.z - (RING_PATH[Math.max(0, i - 1)].z)) + Math.PI;
      scene.add(mesh);
      rings.push({ index: i, position: new THREE.Vector3(p.x, p.y, p.z), mesh: mesh, passed: false });
    }
  }

  function buildBuoys() {
    for (var i = 0; i < W.buoys.length; i += 1) {
      var b = W.buoys[i];
      var group = new THREE.Group();
      var hull = new THREE.Mesh(
        new THREE.CylinderGeometry(4, 5, 3, 8),
        lambert(P.buoy));
      hull.position.y = 1;
      var mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.4, 7, 5),
        lambert(0xdddddd));
      mast.position.y = 6;
      var light = new THREE.Mesh(
        new THREE.SphereGeometry(1.1, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0xffd23c }));
      light.position.y = 10;
      group.add(hull); group.add(mast); group.add(light);
      // The drop target: a flat ring floating on the water.
      var target = new THREE.Mesh(
        new THREE.RingGeometry(26, 30, 28),
        new THREE.MeshBasicMaterial({ color: P.buoy, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
      target.rotation.x = -Math.PI / 2;
      target.position.y = 0.4;
      group.add(target);
      group.position.set(b.x, 0, b.z);
      scene.add(group);
      buoys.push({ index: i, position: new THREE.Vector3(b.x, 0, b.z), group: group, target: target, light: light, done: false });
    }
  }

  // A lit buoy: its drop ring turns green and its mast lamp goes
  // green, so the rescue frame can show the job half done.
  function lightBuoy(index) {
    var b = buoys[index];
    if (!b || b.done) return;
    b.done = true;
    b.target.material.color.setHex(P.ringDone);
    b.light.material.color.setHex(P.ringDone);
  }

  function buildThermals() {
    for (var i = 0; i < W.thermals.length; i += 1) {
      var t = W.thermals[i];
      var column = new THREE.Mesh(
        new THREE.CylinderGeometry(t.radius, t.radius * 0.7, 130, 10, 1, true),
        new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, side: THREE.DoubleSide, flatShading: true }));
      column.position.set(t.x, 65, t.z);
      scene.add(column);
      for (var j = 0; j < 3; j += 1) {
        var puff = new THREE.Mesh(
          new THREE.IcosahedronGeometry(9 + j * 4, 0),
          new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, flatShading: true }));
        puff.position.set(t.x + (rng() - 0.5) * 20, 130 + j * 16, t.z + (rng() - 0.5) * 20);
        scene.add(puff);
        smokePuffs.push(puff);
      }
    }
  }

  function buildScenery() {
    // A few low-poly trees on the mesa top and the volcano foot.
    var trunkMat = lambert(0x6b4a2a);
    var leafMat = lambert(P.grass);
    var spots = [];
    for (var i = 0; i < 26; i += 1) {
      var a = rng() * Math.PI * 2;
      var r = 60 + rng() * 90;
      var sx = Math.cos(a) * r;
      var sz = 220 + Math.sin(a) * r;
      // Keep the runway corridor clear: no tree on the strip itself.
      if (Math.abs(sx) < 25 && sz > 80 && sz < 360) continue;
      spots.push({ x: sx, z: sz, y: 120 });
    }
    for (var j = 0; j < 10; j += 1) {
      var b = rng() * Math.PI * 2;
      spots.push({ x: W.volcano.x + Math.cos(b) * (W.volcano.radius + 40 + rng() * 120), z: W.volcano.z + Math.sin(b) * (W.volcano.radius + 40 + rng() * 120), y: 0 });
    }
    for (var k = 0; k < spots.length; k += 1) {
      var s = spots[k];
      var g = new THREE.Group();
      var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 7, 5), trunkMat);
      trunk.position.y = 3.5;
      var crown = new THREE.Mesh(new THREE.ConeGeometry(5, 13, 6), leafMat);
      crown.position.y = 12;
      g.add(trunk); g.add(crown);
      g.position.set(s.x, s.y, s.z);
      scene.add(g);
    }
    // Scattered boulders in the channel, kept off the runway corridor.
    for (var m = 0; m < 18; m += 1) {
      var rock = new THREE.Mesh(
        jitterGeometry(new THREE.DodecahedronGeometry(4 + rng() * 7, 0), 2),
        lambert(P.basaltLight));
      var ang = rng() * Math.PI * 2;
      var dist = 260 + rng() * 700;
      var rx = Math.cos(ang) * dist;
      var rz = Math.sin(ang) * dist - 200;
      if (Math.abs(rx) < 40 && rz > 60 && rz < 380) continue;
      rock.position.set(rx, 1, rz);
      scene.add(rock);
    }
    // Slow clouds: flat white blobs high up.
    for (var n = 0; n < 9; n += 1) {
      var cloud = new THREE.Group();
      for (var q = 0; q < 3; q += 1) {
        var blob = new THREE.Mesh(
          new THREE.IcosahedronGeometry(22 + rng() * 18, 0),
          new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, flatShading: true }));
        blob.position.set(q * 26 - 26, (rng() - 0.5) * 8, (rng() - 0.5) * 14);
        blob.scale.y = 0.45;
        cloud.add(blob);
      }
      cloud.position.set((rng() - 0.5) * 1800, 300 + rng() * 120, (rng() - 0.5) * 1800);
      scene.add(cloud);
      clouds.push(cloud);
    }
  }

  // Ground height under a point: mesa top, volcano slope, stack tops,
  // otherwise the sea at zero. The physics and the blob shadow use it.
  function terrainHeightAt(x, z) {
    var dx = x - 0;
    var dz = z - 220;
    if (Math.sqrt(dx * dx + dz * dz) < 165) return 120;
    var vx = x - W.volcano.x;
    var vz = z - W.volcano.z;
    var vd = Math.sqrt(vx * vx + vz * vz);
    if (vd < W.volcano.radius) return W.volcano.height * (1 - vd / W.volcano.radius) * 0.92;
    for (var i = 0; i < W.stacks.length; i += 1) {
      var s = W.stacks[i];
      var sx = x - s.x;
      var sz = z - s.z;
      if (Math.sqrt(sx * sx + sz * sz) < s.radius * 0.6) return s.height;
    }
    var c = W.canyon;
    if (Math.abs(z - c.z) < c.length / 2) {
      if (Math.abs(x - (c.x - c.gapWidth / 2 - 30)) < 32) return c.wallHeight;
      if (Math.abs(x - (c.x + c.gapWidth / 2 + 30)) < 32) return c.wallHeight;
    }
    return 0;
  }

  // A flare canister: orange body, white chute disc, falls slowly.
  function spawnFlare(position) {
    var group = new THREE.Group();
    var body = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.1, 3.2, 8),
      lambert(P.flare));
    body.position.y = -2;
    var chute = new THREE.Mesh(
      new THREE.CircleGeometry(4.5, 10),
      new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
    chute.rotation.x = -Math.PI / 2;
    chute.position.y = 2.5;
    var glow = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xffc23c }));
    glow.position.y = -3.8;
    group.add(body); group.add(chute); group.add(glow);
    group.position.copy(position);
    scene.add(group);
    flareMeshes.push({ group: group, velocity: -2.5, life: 14 });
    return group;
  }

  // A white tire-smoke puff at a touchdown point. Unlit and soft, so
  // it reads as smoke instead of a grey rock on the runway.
  function spawnSmoke(position) {
    var puff = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.0, 0),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, flatShading: true }));
    puff.scale.y = 0.6;
    puff.position.copy(position);
    puff.position.y += 1;
    scene.add(puff);
    smokePuffs.push(puff);
    return puff;
  }

  function update(time) {
    // Ocean swell: a slow deterministic sine over the stored base heights.
    if (ocean) {
      var pos = ocean.geometry.attributes.position;
      for (var i = 0; i < pos.count; i += 1) {
        var bx = oceanBase[i * 3];
        var bz = oceanBase[i * 3 + 2];
        pos.setY(i, Math.sin(bx * 0.012 + time * 0.7) * 0.7 + Math.cos(bz * 0.014 + time * 0.5) * 0.7);
      }
      pos.needsUpdate = true;
      ocean.geometry.computeVertexNormals();
    }
    for (var b = 0; b < buoys.length; b += 1) {
      buoys[b].group.position.y = Math.sin(time * 0.9 + b * 2.1) * 0.5;
      buoys[b].group.rotation.z = Math.sin(time * 0.7 + b) * 0.03;
    }
    for (var c = 0; c < clouds.length; c += 1) {
      clouds[c].position.x += 0.35;
      if (clouds[c].position.x > 1000) clouds[c].position.x = -1000;
    }
    for (var f = flareMeshes.length - 1; f >= 0; f -= 1) {
      var fl = flareMeshes[f];
      fl.group.position.y += fl.velocity * 0.016;
      fl.life -= 0.016;
      if (fl.group.position.y <= 1.5 || fl.life <= 0) {
        scene.remove(fl.group);
        flareMeshes.splice(f, 1);
      }
    }
  }

  function build(s) {
    scene = s;
    buildSky();
    buildOcean();
    buildMesa();
    buildVolcano();
    buildCanyon();
    buildArch(-300, -640, 0.5, 1.1);
    buildArch(-700, -540, -0.4, 0.9);
    buildStacks();
    buildRunway();
    buildRings();
    buildBuoys();
    buildThermals();
    buildScenery();
  }

  window.Cinderwing.world = {
    build: build,
    update: update,
    terrainHeightAt: terrainHeightAt,
    spawnFlare: spawnFlare,
    spawnSmoke: spawnSmoke,
    lightBuoy: lightBuoy,
    rings: rings,
    buoys: buoys
  };
})();
