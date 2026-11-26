// Cinderwing — hud.js
// One job: the instruments. One SVG overlay, amber and phosphor-green on
// dark translucent bezels, built to be read at a glance when the frame is
// shrunk: airspeed left, altitude right, compass on top, artificial
// horizon in the middle, fuel and engine heat at the bottom, and the
// mission objective where the eye lands first. No text ever sits on the
// aircraft or on a ring: the horizon is centred, the tapes hug the edges.
(function () {
  'use strict';

  var P = window.Cinderwing.config.PALETTE;
  var phys = window.Cinderwing.physics;

  var svg = null;
  var el = {};

  function $(id) { return svg.querySelector('#' + id); }

  function build(root) {
    svg = root;
    svg.setAttribute('viewBox', '0 0 1280 720');
    svg.innerHTML =
      '<defs>' +
      '<clipPath id="horizonClip"><circle cx="640" cy="310" r="80"/></clipPath>' +
      '</defs>' +
      // Compass tape, top centre.
      '<g font-family="Consolas, monospace" text-anchor="middle">' +
      '<rect x="430" y="12" width="420" height="46" rx="8" fill="' + P.bezel + '"/>' +
      '<g id="compassTicks" fill="' + P.hudAmber + '" font-size="15"></g>' +
      '<text id="compassHeading" x="640" y="48" font-size="22" fill="' + P.hudGreen + '" font-weight="bold">180</text>' +
      '<path d="M640 12 l7 10 h-14 z" fill="' + P.hudGreen + '"/>' +
      '</g>' +
      // Mission line, top left.
      '<g font-family="Consolas, monospace">' +
      '<rect x="16" y="12" width="330" height="66" rx="8" fill="' + P.bezel + '"/>' +
      '<text id="missionName" x="30" y="38" font-size="19" fill="' + P.hudAmber + '" font-weight="bold">CALDERA RING RUN</text>' +
      '<text id="missionObjective" x="30" y="62" font-size="14" fill="#E8E2D2">Rings 0 / 12</text>' +
      '</g>' +
      // Waypoint, top right.
      '<g font-family="Consolas, monospace" text-anchor="end">' +
      '<rect x="934" y="12" width="330" height="66" rx="8" fill="' + P.bezel + '"/>' +
      '<text id="waypointLabel" x="1250" y="38" font-size="14" fill="#E8E2D2">NEXT RING</text>' +
      '<text id="waypointDist" x="1250" y="62" font-size="19" fill="' + P.hudCyan + '" font-weight="bold">0 m</text>' +
      '</g>' +
      // Artificial horizon, centre.
      '<g>' +
      '<circle cx="640" cy="310" r="90" fill="' + P.bezel + '"/>' +
      '<g clip-path="url(#horizonClip)"><g id="horizonMove">' +
      '<rect id="horizonSky" x="520" y="190" width="240" height="120" fill="#7FB8D8"/>' +
      '<rect id="horizonGround" x="520" y="310" width="240" height="120" fill="#7A5A38"/>' +
      '<g id="pitchLadder" stroke="#FFFFFF" stroke-width="2" font-family="Consolas, monospace" font-size="13" fill="#FFFFFF"></g>' +
      '</g></g>' +
      '<circle cx="640" cy="310" r="80" fill="none" stroke="' + P.hudAmber + '" stroke-width="2.5"/>' +
      '<g stroke="' + P.hudAmber + '" stroke-width="2.5"><line x1="640" y1="196" x2="640" y2="212"/><line x1="556" y1="310" x2="572" y2="310"/><line x1="708" y1="310" x2="724" y2="310"/></g>' +
      // Velocity-vector reticle: the dot the plane is actually going.
      '<g id="velocityVector" stroke="' + P.hudGreen + '" stroke-width="2" fill="none">' +
      '<circle cx="640" cy="310" r="10"/><line x1="640" y1="294" x2="640" y2="300"/><line x1="640" y1="320" x2="640" y2="326"/><line x1="624" y1="310" x2="630" y2="310"/><line x1="650" y1="310" x2="656" y2="310"/></g>' +
      '</g>' +
      // Airspeed tape, left.
      '<g font-family="Consolas, monospace">' +
      '<rect x="16" y="180" width="118" height="300" rx="8" fill="' + P.bezel + '"/>' +
      '<text x="30" y="206" font-size="13" fill="#E8E2D2">AIRSPEED</text>' +
      '<text id="airspeed" x="75" y="268" font-size="40" fill="' + P.hudGreen + '" font-weight="bold" text-anchor="middle">118</text>' +
      '<text x="75" y="292" font-size="13" fill="#E8E2D2" text-anchor="middle">KTS</text>' +
      '<g id="speedTicks" fill="' + P.hudAmber + '" font-size="12"></g>' +
      '<text id="stallWarn" x="75" y="452" font-size="15" fill="' + P.hudRed + '" font-weight="bold" text-anchor="middle"></text>' +
      '</g>' +
      // Altitude tape, right.
      '<g font-family="Consolas, monospace">' +
      '<rect x="1146" y="180" width="118" height="300" rx="8" fill="' + P.bezel + '"/>' +
      '<text x="1160" y="206" font-size="13" fill="#E8E2D2">ALTITUDE</text>' +
      '<text id="altitude" x="1205" y="268" font-size="40" fill="' + P.hudGreen + '" font-weight="bold" text-anchor="middle">820</text>' +
      '<text x="1205" y="292" font-size="13" fill="#E8E2D2" text-anchor="middle">FT</text>' +
      '<text id="vsi" x="1205" y="340" font-size="16" fill="' + P.hudAmber + '" text-anchor="middle">+0 FPM</text>' +
      '<g id="altTicks" fill="' + P.hudAmber + '" font-size="12"></g>' +
      '<text id="lowAltWarn" x="1205" y="452" font-size="15" fill="' + P.hudRed + '" font-weight="bold" text-anchor="middle"></text>' +
      '</g>' +
      // Fuel and engine heat, bottom left.
      '<g font-family="Consolas, monospace">' +
      '<rect x="16" y="560" width="250" height="140" rx="8" fill="' + P.bezel + '"/>' +
      '<text x="30" y="586" font-size="13" fill="#E8E2D2">FUEL</text>' +
      '<rect x="30" y="596" width="180" height="14" rx="4" fill="#26343C"/>' +
      '<rect id="fuelBar" x="30" y="596" width="140" height="14" rx="4" fill="' + P.hudGreen + '"/>' +
      '<text id="fuelText" x="216" y="608" font-size="14" fill="' + P.hudGreen + '">78</text>' +
      '<text x="30" y="640" font-size="13" fill="#E8E2D2">ENGINE HEAT</text>' +
      '<rect x="30" y="650" width="180" height="14" rx="4" fill="#26343C"/>' +
      '<rect id="heatBar" x="30" y="650" width="110" height="14" rx="4" fill="' + P.hudAmber + '"/>' +
      '<text id="heatText" x="216" y="662" font-size="14" fill="' + P.hudAmber + '">62%</text>' +
      '<text id="thermalNote" x="30" y="688" font-size="13" fill="' + P.hudCyan + '"></text>' +
      '</g>' +
      // Flaps, gear, throttle, bottom centre.
      '<g font-family="Consolas, monospace" text-anchor="middle">' +
      '<rect x="500" y="600" width="280" height="100" rx="8" fill="' + P.bezel + '"/>' +
      '<text x="640" y="626" font-size="13" fill="#E8E2D2">FLAPS</text>' +
      '<text id="flapsText" x="640" y="656" font-size="22" fill="' + P.hudAmber + '" font-weight="bold">TO</text>' +
      '<text id="gearText" x="640" y="682" font-size="14" fill="' + P.hudGreen + '">GEAR DOWN · THR 65%</text>' +
      '</g>' +
      // Hull and score, bottom right.
      '<g font-family="Consolas, monospace">' +
      '<rect x="1014" y="560" width="250" height="140" rx="8" fill="' + P.bezel + '"/>' +
      '<text x="1028" y="586" font-size="13" fill="#E8E2D2">HULL</text>' +
      '<g id="hullPlane" transform="translate(1080,636) scale(1.1)">' +
      '<path d="M0 -26 L6 -4 L34 4 L34 10 L6 8 L4 22 L-4 22 L-6 8 L-34 10 L-34 4 L-6 -4 Z" fill="' + P.hudGreen + '" stroke="#0A1218" stroke-width="1.5"/>' +
      '</g>' +
      '<text id="hullText" x="1140" y="612" font-size="14" fill="' + P.hudGreen + '">100%</text>' +
      '<text id="scoreText" x="1140" y="648" font-size="14" fill="' + P.hudAmber + '">SCORE 0</text>' +
      '<text id="timerText" x="1140" y="674" font-size="14" fill="#E8E2D2">TIME 4:00</text>' +
      '</g>' +
      // Centre banner for touchdowns, stalls, crashes and ring hits.
      '<g font-family="Consolas, monospace" text-anchor="middle">' +
      '<rect id="bannerBox" x="380" y="120" width="520" height="52" rx="8" fill="' + P.bezel + '" visibility="hidden"/>' +
      '<text id="bannerText" x="640" y="142" font-size="20" fill="' + P.hudGreen + '" font-weight="bold" visibility="hidden"></text>' +
      '<text id="bannerSub" x="640" y="162" font-size="14" fill="#E8E2D2" visibility="hidden"></text>' +
      '</g>';
    el = {
      compassTicks: $('compassTicks'),
      compassHeading: $('compassHeading'),
      missionName: $('missionName'),
      missionObjective: $('missionObjective'),
      waypointLabel: $('waypointLabel'),
      waypointDist: $('waypointDist'),
      horizonMove: $('horizonMove'),
      pitchLadder: $('pitchLadder'),
      velocityVector: $('velocityVector'),
      airspeed: $('airspeed'),
      speedTicks: $('speedTicks'),
      stallWarn: $('stallWarn'),
      altitude: $('altitude'),
      vsi: $('vsi'),
      altTicks: $('altTicks'),
      lowAltWarn: $('lowAltWarn'),
      fuelBar: $('fuelBar'),
      fuelText: $('fuelText'),
      heatBar: $('heatBar'),
      heatText: $('heatText'),
      thermalNote: $('thermalNote'),
      flapsText: $('flapsText'),
      gearText: $('gearText'),
      hullPlane: $('hullPlane'),
      hullText: $('hullText'),
      scoreText: $('scoreText'),
      timerText: $('timerText'),
      bannerBox: $('bannerBox'),
      bannerText: $('bannerText'),
      bannerSub: $('bannerSub')
    };
    buildLadder();
  }

  function buildLadder() {
    // Pitch ladder: rungs every 10 degrees, drawn once, moved as a group.
    var html = '';
    for (var deg = -30; deg <= 30; deg += 10) {
      if (deg === 0) continue;
      var y = 310 - deg * 3;
      var w = deg % 20 === 0 ? 46 : 28;
      html += '<line x1="' + (640 - w) + '" y1="' + y + '" x2="' + (640 + w) + '" y2="' + y + '"/>';
      html += '<text x="' + (640 + w + 8) + '" y="' + (y + 4) + '" text-anchor="start">' + Math.abs(deg) + '</text>';
    }
    html += '<line x1="594" y1="310" x2="686" y2="310" stroke-width="3"/>';
    el.pitchLadder.innerHTML = html;
  }

  function setText(node, value) {
    if (node && node.textContent !== String(value)) node.textContent = value;
  }

  function compassLabels(headingDeg) {
    // Ticks every 30 degrees around the current heading.
    var html = '';
    var names = { 0: 'N', 30: '030', 60: '060', 90: 'E', 120: '120', 150: '150', 180: 'S', 210: '210', 240: '240', 270: 'W', 300: '300', 330: '330' };
    for (var d = -60; d <= 60; d += 30) {
      if (d === 0) continue; // the big heading number is the centre label
      var deg = ((Math.round((headingDeg + d) / 30) * 30) % 360 + 360) % 360;
      var x = 640 + d * 3.2;
      var label = names[deg] || String(deg);
      html += '<text x="' + x.toFixed(0) + '" y="34" font-size="15">' + label + '</text>';
    }
    el.compassTicks.innerHTML = html;
  }

  var bannerUntil = 0;
  function showBanner(text, sub, color, seconds, now) {
    setText(el.bannerText, text);
    setText(el.bannerSub, sub || '');
    el.bannerText.setAttribute('fill', color || P.hudGreen);
    el.bannerBox.setAttribute('visibility', 'visible');
    el.bannerText.setAttribute('visibility', 'visible');
    el.bannerSub.setAttribute('visibility', sub ? 'visible' : 'hidden');
    bannerUntil = now + (seconds || 3);
  }

  function hideBannerIfDue(now) {
    if (bannerUntil && now > bannerUntil) {
      el.bannerBox.setAttribute('visibility', 'hidden');
      el.bannerText.setAttribute('visibility', 'hidden');
      el.bannerSub.setAttribute('visibility', 'hidden');
      bannerUntil = 0;
    }
  }

  function update(state, mission, waypoint, time) {
    if (!svg) return;
    var headingDeg = phys.headingDegrees(state.heading);
    setText(el.compassHeading, String(headingDeg).padStart(3, '0'));
    compassLabels(headingDeg);
    setText(el.missionName, mission.short);
    setText(el.airspeed, String(phys.toKnots(state.speed)));
    // Altitude is height above the ground under the plane, not above
    // the sea: on a 120 m cliff runway the pilot needs to know the
    // wheels are 4 ft up, not that the sea is 400 ft down.
    var ground = window.Cinderwing.world.terrainHeightAt(state.position.x, state.position.z);
    var altFt = Math.max(0, phys.toFeet(state.position.y - ground));
    setText(el.altitude, String(altFt));
    var vsi = phys.toFpm(state.verticalSpeed);
    setText(el.vsi, (vsi >= 0 ? '+' : '') + vsi + ' FPM');
    setText(el.stallWarn, state.stalled ? 'STALL' : '');
    setText(el.lowAltWarn, (!state.onGround && altFt < 60 && altFt > 0) ? 'LOW ALT' : '');

    // Horizon: rotate by roll, slide by pitch. 3 px per degree of pitch.
    var pitchDeg = -state.pitch * 180 / Math.PI;
    var rollDeg = state.roll * 180 / Math.PI;
    el.horizonMove.setAttribute('transform',
      'rotate(' + (-rollDeg).toFixed(1) + ' 640 310) translate(0 ' + (pitchDeg * 3).toFixed(1) + ')');

    // Fuel and heat bars, with colour that follows the state.
    var fuelW = Math.max(0, state.fuel / 100 * 180);
    el.fuelBar.setAttribute('width', fuelW.toFixed(0));
    el.fuelBar.setAttribute('fill', state.fuel < 20 ? P.hudRed : (state.fuel < 45 ? P.hudAmber : P.hudGreen));
    setText(el.fuelText, String(Math.round(state.fuel)));
    var heatW = Math.max(0, state.engineTemp / 100 * 180);
    el.heatBar.setAttribute('width', heatW.toFixed(0));
    el.heatBar.setAttribute('fill', state.engineTemp > 90 ? P.hudRed : P.hudAmber);
    setText(el.heatText, String(Math.round(state.engineTemp)) + '%');
    setText(el.thermalNote, state.inThermal ? 'RIDING THERMAL — FREE LIFT' : '');

    var flapNames = ['UP', 'TO', 'LDG'];
    setText(el.flapsText, flapNames[state.flaps] || 'UP');
    setText(el.gearText, (state.gearDown ? 'GEAR DOWN' : 'GEAR UP') + ' · THR ' + Math.round(state.throttle * 100) + '%');

    // Hull silhouette: green, amber, then red as damage grows.
    var hullColor = state.hull > 60 ? P.hudGreen : (state.hull > 35 ? P.hudAmber : P.hudRed);
    el.hullPlane.firstElementChild.setAttribute('fill', hullColor);
    setText(el.hullText, Math.round(state.hull) + '%');
    el.hullText.setAttribute('fill', hullColor);
    setText(el.scoreText, 'SCORE ' + state.score);
    if (state.timeLeft > 0) {
      var t = Math.max(0, state.timeLeft);
      var mm = Math.floor(t / 60);
      var ss = Math.floor(t % 60);
      setText(el.timerText, 'TIME ' + mm + ':' + String(ss).padStart(2, '0'));
    } else {
      setText(el.timerText, 'FREE FLIGHT');
    }

    if (waypoint) {
      setText(el.waypointLabel, waypoint.label);
      setText(el.waypointDist, Math.round(waypoint.distance) + ' m');
      setText(el.missionObjective, waypoint.objective);
    }
    hideBannerIfDue(time);
  }

  window.Cinderwing.hud = {
    build: build,
    update: update,
    showBanner: showBanner
  };
})();
