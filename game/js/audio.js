// Cinderwing — audio.js
// One job: every sound the game makes, built from raw Web Audio nodes.
// No audio files, no network, nothing plays before the player touches a
// control. In screenshot mode this module is never started.
(function () {
  'use strict';

  var ctx = null;
  var master = null;
  var propOscA = null;
  var propOscB = null;
  var propGain = null;
  var windSource = null;
  var windGain = null;
  var windFilter = null;
  var started = false;

  // Build the graph once, on the first real input. Browsers block audio
  // before a gesture, so creating it earlier would only fail silently.
  function ensureContext() {
    if (ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);

    // Propeller hum: two detuned saws through a low-pass, pitch follows
    // throttle. It sits under everything else and never shouts.
    propOscA = ctx.createOscillator();
    propOscA.type = 'sawtooth';
    propOscA.frequency.value = 55;
    propOscB = ctx.createOscillator();
    propOscB.type = 'sawtooth';
    propOscB.frequency.value = 55.7;
    var propFilter = ctx.createBiquadFilter();
    propFilter.type = 'lowpass';
    propFilter.frequency.value = 320;
    propGain = ctx.createGain();
    propGain.gain.value = 0.0;
    propOscA.connect(propFilter);
    propOscB.connect(propFilter);
    propFilter.connect(propGain);
    propGain.connect(master);
    propOscA.start();
    propOscB.start();

    // Wind: looped noise through a band-pass, louder and brighter as the
    // airspeed rises.
    var length = ctx.sampleRate * 2;
    var buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    windSource = ctx.createBufferSource();
    windSource.buffer = buffer;
    windSource.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 500;
    windFilter.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = 0.0;
    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    windSource.start();
    return true;
  }

  function start() {
    if (started) return;
    if (!ensureContext()) return;
    started = true;
    if (ctx.state === 'suspended') ctx.resume();
  }

  // Called every frame with the live flight state. Levels are kept low on
  // purpose: the prop and the wind stay under any voice or chime.
  function update(state) {
    if (!started || !ctx) return;
    var throttle = state.throttle || 0;
    var speed = state.speed || 0;
    var now = ctx.currentTime;
    var propFreq = 42 + throttle * 68 + speed * 0.35;
    propOscA.frequency.setTargetAtTime(propFreq, now, 0.08);
    propOscB.frequency.setTargetAtTime(propFreq * 1.012, now, 0.08);
    propGain.gain.setTargetAtTime(0.02 + throttle * 0.05, now, 0.1);
    windFilter.frequency.setTargetAtTime(380 + speed * 22, now, 0.1);
    windGain.gain.setTargetAtTime(Math.min(0.09, speed * 0.0016), now, 0.12);
  }

  function blip(freq, seconds, type, volume) {
    if (!started || !ctx) return;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume || 0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + seconds);
  }

  // Ring chime: two notes, bright, short. One chime per ring, never stacked.
  function ringChime() {
    blip(880, 0.28, 'sine', 0.14);
    window.setTimeout(function () { blip(1318, 0.34, 'sine', 0.1); }, 90);
  }

  // Stall warning: a low square pulse, three beats, then quiet.
  function stallTone() {
    blip(196, 0.16, 'square', 0.06);
    window.setTimeout(function () { blip(196, 0.16, 'square', 0.06); }, 180);
    window.setTimeout(function () { blip(196, 0.16, 'square', 0.06); }, 360);
  }

  // Flare pop: a soft thump as the canister leaves the rail.
  function flarePop() {
    blip(140, 0.2, 'triangle', 0.16);
  }

  // Tire screech: filtered noise burst, one short burst per touchdown.
  function tireScreech() {
    if (!started || !ctx) return;
    var length = Math.floor(ctx.sampleRate * 0.35);
    var buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    var src = ctx.createBufferSource();
    src.buffer = buffer;
    var filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1400;
    filter.Q.value = 2.5;
    var gain = ctx.createGain();
    gain.gain.value = 0.14;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  // Crash thud: a low sine drop, once.
  function crashThud() {
    if (!started || !ctx) return;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(32, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  }

  window.Cinderwing.audio = {
    start: start,
    update: update,
    ringChime: ringChime,
    stallTone: stallTone,
    flarePop: flarePop,
    tireScreech: tireScreech,
    crashThud: crashThud
  };
})();
