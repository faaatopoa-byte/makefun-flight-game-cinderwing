// Cinderwing — hud.js
// One job: the instruments. One SVG overlay, amber and phosphor-green on
// dark translucent bezels, built to be read at a glance when the frame is
// shrunk: airspeed left, altitude right, compass on top, artificial
// horizon in the middle, fuel and engine heat at the bottom, and the
// mission objective where the eye lands first.
//
// v2 (Claude review of the v1 frames): the horizon disc no longer sits
// big in the middle of a chase view, where it covered the plane and the
// rings. In chase it docks small at bottom centre, above the flaps
// panel. v2 light fix (26 Nov, shot 2): the cockpit view docked the disc
// the same way, in the dial row at (640, 500) — the chase dock (640, 548)
// would hide the middle of the yoke handle bar. The full-size centre
// disc is gone from both views.
// is a true linear tape (degrees spaced by degrees, not by label), the
// mission line is 20 px and wraps inside its panel, the side tapes are
// cut to their content, LOW ALT stays quiet when the gear is down and
// the flaps are at LDG, heat over 85% blinks red, and the altitude tape
// carries a sink-rate bar for the landing. No text ever sits on the
// aircraft or on a ring.
(function () {
  'use strict';

  var P = window.Cinderwing.config.PALETTE;
  var phys = window.Cinderwing.physics;

  var svg = null;
  var el = {};
  var view = 'chase'; // chase | cockpit

  function $(id) { return svg.querySelector('#' + id); }

  function build(root) {
    svg = root;
    svg.setAttribute('viewBox', '0 0 1280 720');
    svg.innerHTML =
      '<defs>' +
      '<clipPath id="horizonClip"><circle cx="640" cy="310" r="80"/></clipPath>' +
      '</defs>' +
      // Compass tape, top centre: a true linear scale, 2.6 px per
      // degree, labels every 30 degrees, small ticks every 10.
      '<g font-family="Consolas, monospace" text-anchor="middle">' +
      '<rect x="430" y="12" width="420" height="46" rx="8" fill="' + P.bezel + '"/>' +
      '<g id="compassTicks" fill="' + P.hudAmber + '" font-size="15" stroke="' + P.hudAmber + '"></g>' +
      '<text id="compassHeading" x="640" y="48" font-size="22" fill="' + P.hudGreen + '" font-weight="bold">180</text>' +
      '<path d="M640 12 l7 10 h-14 z" fill="' + P.hudGreen + '"/>' +
      '</g>' +
      // Mission line, top left. 20 px text, wrapped to two lines, so
      // the objective never runs past the edge of its own panel.
      '<g font-family="Consolas, monospace">' +
      '<rect x="16" y="12" width="330" height="96" rx="8" fill="' + P.bezel + '"/>' +
      '<text id="missionName" x="30" y="40" font-size="20" fill="' + P.hudAmber + '" font-weight="bold">CALDERA RING RUN</text>' +
      '<text id="missionObjective1" x="30" y="66" font-size="20" fill="#E8E2D2">Rings 0 / 12</text>' +
      '<text id="missionObjective2" x="30" y="90" font-size="20" fill="#E8E2D2"></text>' +
      '</g>' +
      // Waypoint, top right.
      '<g font-family="Consolas, monospace" text-anchor="end">' +
      '<rect x="934" y="12" width="330" height="66" rx="8" fill="' + P.bezel + '"/>' +
      '<text id="waypointLabel" x="1250" y="38" font-size="14" fill="#E8E2D2">NEXT RING</text>' +
      '<text id="waypointDist" x="1250" y="62" font-size="22" fill="' + P.hudCyan + '" font-weight="bold">0 m</text>' +
      '</g>' +
      // Artificial horizon. The disc is docked small at bottom centre in
      // BOTH views, so it can never cover the plane, a ring, or the
      // forward view through the windshield: chase docks it at (640, 548)
      // above the flaps panel; cockpit docks it at (640, 500) in the dial
      // row, between the two inner dials — (640, 548) would hide the
      // middle of the yoke handle bar (Faa 26 Nov 16:56, shot 2 defect).
      '<g id="horizonGroup">' +
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
      // Airspeed tape, left: cut to its content, no dead space below.
      '<g font-family="Consolas, monospace">' +
      '<rect x="16" y="180" width="118" height="170" rx="8" fill="' + P.bezel + '"/>' +
      '<text x="30" y="204" font-size="13" fill="#E8E2D2">AIRSPEED</text>' +
      '<text id="airspeed" x="75" y="262" font-size="40" fill="' + P.hudGreen + '" font-weight="bold" text-anchor="middle">118</text>' +
      '<text x="75" y="286" font-size="13" fill="#E8E2D2" text-anchor="middle">KTS</text>' +
      '<g id="speedTicks" fill="' + P.hudAmber + '" font-size="12"></g>' +
      '<text id="stallWarn" x="75" y="330" font-size="15" fill="' + P.hudRed + '" font-weight="bold" text-anchor="middle"></text>' +
      '</g>' +
      // Altitude tape, right, with a sink-rate bar under the VSI so a
      // landing approach reads at a glance.
      '<g font-family="Consolas, monospace">' +
      '<rect x="1146" y="180" width="118" height="190" rx="8" fill="' + P.bezel + '"/>' +
      '<text x="1160" y="204" font-size="13" fill="#E8E2D2">ALTITUDE</text>' +
      '<text id="altitude" x="1205" y="262" font-size="40" fill="' + P.hudGreen + '" font-weight="bold" text-anchor="middle">820</text>' +
      '<text x="1205" y="286" font-size="13" fill="#E8E2D2" text-anchor="middle">FT</text>' +
      '<text id="vsi" x="1205" y="318" font-size="16" fill="' + P.hudAmber + '" text-anchor="middle">+0 FPM</text>' +
      '<rect x="1158" y="330" width="94" height="8" rx="3" fill="#26343C"/>' +
      '<rect id="sinkBar" x="1158" y="330" width="0" height="8" rx="3" fill="' + P.hudGreen + '"/>' +
      '<text id="lowAltWarn" x="1205" y="362" font-size="15" fill="' + P.hudRed + '" font-weight="bold" text-anchor="middle"></text>' +
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
      missionObjective1: $('missionObjective1'),
      missionObjective2: $('missionObjective2'),
      waypointLabel: $('waypointLabel'),
      waypointDist: $('waypointDist'),
      horizonGroup: $('horizonGroup'),
      horizonMove: $('horizonMove'),
      pitchLadder: $('pitchLadder'),
      velocityVector: $('velocityVector'),
      airspeed: $('airspeed'),
      speedTicks: $('speedTicks'),
      stallWarn: $('stallWarn'),
      altitude: $('altitude'),
      vsi: $('vsi'),
      sinkBar: $('sinkBar'),
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
    applyView();
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

  // Both views dock the disc small at bottom centre (scale 0.475,
  // radius 38): chase at (640, 548), just above the flaps panel;
  // cockpit at (640, 500), in the dial row between the two inner dials.
  // The full-size disc at dead centre used to cover the plane (chase)
  // and the forward view through the windshield (cockpit) — Faa 26 Nov
  // 16:18, 16:56, shot 2 defect. Cockpit cannot use the chase dock:
  // (640, 548) hides the middle of the yoke handle bar.
  function applyView() {
    if (!el.horizonGroup) return;
    if (view === 'cockpit') {
      el.horizonGroup.setAttribute('transform',
        'translate(640 500) scale(0.475) translate(-640 -310)');
    } else {
      el.horizonGroup.setAttribute('transform',
        'translate(640 548) scale(0.475) translate(-640 -310)');
    }
  }

  function setView(mode) {
    if (mode !== 'cockpit' && mode !== 'chase') return;
    if (mode === view) return;
    view = mode;
    applyView();
  }

  function setText(node, value) {
    if (node && node.textContent !== String(value)) node.textContent = value;
  }

  // Word-wrap the objective into at most two lines that fit the panel:
  // 20 px Consolas is about 12 px per character, the panel fits 25.
  function wrapObjective(text) {
    var words = String(text).split(' ');
    var lines = [''];
    for (var i = 0; i < words.length; i += 1) {
      var trial = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + words[i] : words[i];
      if (trial.length <= 25 || !lines[lines.length - 1]) {
        lines[lines.length - 1] = trial;
      } else if (lines.length < 2) {
        lines.push(words[i]);
      } else {
        lines[1] = trial;
      }
    }
    return [lines[0] || '', lines[1] || ''];
  }

  function compassLabels(headingDeg) {
    // A linear tape: every tick sits at its true degree offset from the
    // heading, 2.6 px per degree, so 30 degrees always spans 78 px.
    var html = '';
    var names = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
    var start = Math.floor((headingDeg - 75) / 10) * 10;
    for (var deg = start; deg <= headingDeg + 75; deg += 10) {
      var norm = ((deg % 360) + 360) % 360;
      var delta = ((deg - headingDeg + 540) % 360) - 180;
      var x = 640 + delta * 2.6;
      // Labels stay inside the bezel with room to spare, and never
      // crowd the big centre number: only |delta| 20..60 gets a label.
      if (norm % 30 === 0 && Math.abs(delta) >= 20 && Math.abs(delta) <= 60) {
        var label = names[norm] || String(norm).padStart(3, '0');
        html += '<text x="' + x.toFixed(0) + '" y="34" font-size="15">' + label + '</text>';
      } else if (norm % 30 !== 0) {
        html += '<line x1="' + x.toFixed(0) + '" y1="28" x2="' + x.toFixed(0) + '" y2="34" stroke-width="1.5"/>';
      }
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
    // Sink-rate bar: full width at 1000 FPM. Climbing is always green;
    // a descent is green under 220, amber under 350, red past it — the
    // landing grades use those same cuts.
    var sinkAbs = Math.abs(vsi);
    el.sinkBar.setAttribute('width', Math.min(94, sinkAbs / 1000 * 94).toFixed(0));
    el.sinkBar.setAttribute('fill', vsi >= 0 ? P.hudGreen : (sinkAbs <= 220 ? P.hudGreen : (sinkAbs <= 350 ? P.hudAmber : P.hudRed)));
    setText(el.stallWarn, state.stalled ? 'STALL' : '');
    // LOW ALT stays quiet on final: gear down and flaps at LDG means
    // the pilot is meant to be this low.
    var onFinal = state.gearDown && state.flaps === 2;
    setText(el.lowAltWarn, (!state.onGround && !onFinal && altFt < 60 && altFt > 0) ? 'LOW ALT' : '');

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
    el.fuelText.setAttribute('fill', state.fuel < 20 ? P.hudRed : P.hudGreen);
    var heatW = Math.max(0, state.engineTemp / 100 * 180);
    el.heatBar.setAttribute('width', heatW.toFixed(0));
    var hot = state.engineTemp > 85;
    el.heatBar.setAttribute('fill', hot ? P.hudRed : P.hudAmber);
    // Past 85% the heat bar blinks: colour alone never carries a warning.
    el.heatBar.setAttribute('opacity', hot ? (Math.floor(time * 3) % 2 === 0 ? '1' : '0.35') : '1');
    setText(el.heatText, String(Math.round(state.engineTemp)) + '%');
    el.heatText.setAttribute('fill', hot ? P.hudRed : P.hudAmber);
    if (state.fuel < 20) {
      setText(el.thermalNote, 'LOW FUEL — FIND A STRIP');
      el.thermalNote.setAttribute('fill', P.hudRed);
    } else {
      setText(el.thermalNote, state.inThermal ? 'RIDING THERMAL — FREE LIFT' : '');
      el.thermalNote.setAttribute('fill', P.hudCyan);
    }

    var flapNames = ['UP', 'TO', 'LDG'];
    setText(el.flapsText, flapNames[state.flaps] || 'UP');
    setText(el.gearText, (state.gearDown ? 'GEAR DOWN' : 'GEAR UP') + ' · THR ' + Math.round(state.throttle * 100) + '%');

    // Hull silhouette: green, amber, then red as damage grows.
    var hullColor = state.hull > 75 ? P.hudGreen : (state.hull > 40 ? P.hudAmber : P.hudRed);
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
      var lines = wrapObjective(waypoint.objective);
      setText(el.missionObjective1, lines[0]);
      setText(el.missionObjective2, lines[1]);
    }
    hideBannerIfDue(time);
  }

  window.Cinderwing.hud = {
    build: build,
    update: update,
    showBanner: showBanner,
    setView: setView
  };
})();
