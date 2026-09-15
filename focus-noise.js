/* global AudioContext, Math, setTimeout, clearTimeout, window */

// ===== [WM.4 follow-up] THE FOCUS TEXTURE GENERATOR, SHARED =====
//
// ONE SYNTHESISER, TWO HOSTS, AND THE REASON IS THE WHOLE POINT OF THIS ROUND.
// The offscreen document plays a texture for a running session; the settings
// page plays a preview when you pick one. Those must be the SAME SOUND, and two
// copies of a noise generator is I28's shape - they drift, and the way you find
// out is a user choosing Rain in Settings, hearing one thing, and meeting a
// different thing twenty minutes later.
//
// WHY THE PAGE CAN HOST THIS AT ALL, since the offscreen document was created
// precisely because the worker could not: the page has a DOM and a real click is
// a real gesture, so autoplay is satisfied. The chime preview has always worked
// this way - satPlayPomodoroSound builds a `new Audio()` in the page - and the
// offscreen document exists for the WORKER, which has neither.
//
// NO STORAGE, NO chrome.*, NO POLICY. It is told what to play and how loud. Who
// decides is Storage.focusSoundShouldPlay for a session and the picker for a
// preview; this file cannot be the thing that plays at the wrong moment.
(function (root) {
  "use strict";

  // ONE AudioContext, REUSED. Creating one per start leaks them - an
  // AudioContext is not garbage collected while it has running nodes, and a
  // 25-minute session with a few pause/resumes would stack several.
  var audioCtx = null;
  var current = null;     // { texture, stop(), master }
  var autoStop = null;    // the preview's own timer

  function ctx() {
    if (!audioCtx) audioCtx = new AudioContext();
    return audioCtx;
  }

  // A few seconds of noise, looped. LONG ENOUGH NOT TO HEAR THE SEAM: at two
  // seconds a loop of white noise ticks audibly, because the ear finds the
  // repeat; at six it does not. Six seconds of mono float at 48k is ~1.1 MB of
  // heap, generated once per start and released on stop.
  var BUFFER_SECONDS = 6;

function fillWhite(out) {
  for (var i = 0; i < out.length; i++) out[i] = Math.random() * 2 - 1;
}

// Paul Kellet's economical pink filter. Six one-poles summed - the standard
// approximation, accurate to about +/-0.05 dB across the audible band, and far
// cheaper than an FFT.
function fillPink(out) {
  var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (var i = 0; i < out.length; i++) {
    var w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.96900 * b2 + w * 0.1538520;
    b3 = 0.86650 * b3 + w * 0.3104856;
    b4 = 0.55000 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.0168980;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
}

// Brown is integrated white with a leak, so it cannot wander off to DC and
// clip. Normalised by the same 3.5 the reference implementation uses.
function fillBrown(out) {
  var last = 0;
  for (var i = 0; i < out.length; i++) {
    var w = Math.random() * 2 - 1;
    last = (last + 0.02 * w) / 1.02;
    out[i] = last * 3.5;
  }
}

function noiseBuffer(kind, c) {
  c = c || ctx();
  var buf = c.createBuffer(1, c.sampleRate * BUFFER_SECONDS, c.sampleRate);
  var out = buf.getChannelData(0);
  if (kind === "pink") fillPink(out);
  else if (kind === "brown") fillBrown(out);
  else fillWhite(out);
  return buf;
}

function loopSource(kind, c) {
  c = c || ctx();
  var src = c.createBufferSource();
  src.buffer = noiseBuffer(kind, c);
  src.loop = true;
  return src;
}

// ---- rain ----------------------------------------------------------------
//
// THE ONE THAT COULD HAVE BEEN STATIC, and decision F says leave it out rather
// than ship a fourth option that sounds worse than the third. What separates
// rain from filtered noise is not the filter, it is the TRANSIENTS: rain is a
// broadband bed with thousands of individual impacts on top, and a bandpass
// alone gives a steady hiss that the ear reads as radio static.
//
// So this is a bed PLUS scheduled droplets. The bed is pink through a gentle
// bandpass with a slow, shallow gain drift, which is the "shhh" and its
// breathing. The droplets are very short filtered bursts at randomised
// intervals, each with its own pitch - which is what makes it read as many
// small events rather than one continuous one.
//
// I CANNOT HEAR IT, and that is stated rather than worked around. The spectrum
// and the transient rate are measured in this round's report; whether it
// CONVINCES is in HUMAN CHECKS, and removing it is one entry in
// Storage.FOCUS_SOUNDS.
function startRain(master, c) {
  c = c || ctx();
  var bed = loopSource("pink");
  var bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1400;
  bp.Q.value = 0.4;                     // wide: a narrow Q whistles
  var bedGain = c.createGain();
  bedGain.gain.value = 0.55;
  bed.connect(bp); bp.connect(bedGain); bedGain.connect(master);
  bed.start();

  // A slow, shallow swell. 0.07 Hz is roughly one breath every fourteen
  // seconds; deeper than +/-15% starts to sound like a fault.
  var lfo = c.createOscillator();
  lfo.frequency.value = 0.07;
  var lfoGain = c.createGain();
  lfoGain.gain.value = 0.15;
  lfo.connect(lfoGain); lfoGain.connect(bedGain.gain);
  lfo.start();

  // Droplets. A 40 ms burst of white through a resonant bandpass, pitched
  // randomly between 900 and 4500 Hz, on a short exponential decay. Scheduled
  // in BATCHES of one second so the timer fires once a second rather than once
  // a droplet - the difference between a background hum and a busy event loop.
  var dropTimer = null;
  var stopped = false;
  function scheduleSecond() {
    if (stopped) return;
    var now = c.currentTime;
    var n = 14 + Math.floor(Math.random() * 10);   // 14-23 drops a second
    for (var i = 0; i < n; i++) {
      var at = now + Math.random();
      var burst = c.createBufferSource();
      var b = c.createBuffer(1, Math.floor(c.sampleRate * 0.04), c.sampleRate);
      fillWhite(b.getChannelData(0));
      burst.buffer = b;
      var f = c.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 900 + Math.random() * 3600;
      f.Q.value = 6 + Math.random() * 6;
      var g = c.createGain();
      var peak = 0.05 + Math.random() * 0.09;
      g.gain.setValueAtTime(peak, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
      burst.connect(f); f.connect(g); g.connect(master);
      burst.start(at);
      burst.stop(at + 0.06);
    }
    dropTimer = setTimeout(scheduleSecond, 950);
  }
  scheduleSecond();

  return function stop() {
    stopped = true;
    if (dropTimer) { clearTimeout(dropTimer); dropTimer = null; }
    try { bed.stop(); } catch (e) {}
    try { lfo.stop(); } catch (e) {}
    try { bed.disconnect(); bp.disconnect(); bedGain.disconnect(); lfoGain.disconnect(); } catch (e) {}
  };
}


  function stopTexture(fade) {
    if (autoStop) { clearTimeout(autoStop); autoStop = null; }
    if (!current) return;
    var c = audioCtx;
    var stopFn = current.stop;
    var master = current.master;
    current = null;
    // FADE, NOT CUT. A gain that drops to zero in one sample clicks, which is
    // the same defect the 120 ms ramp on start already avoids - it would be odd
    // to be careful at one end and not the other.
    if (fade && c && master) {
      try {
        master.gain.cancelScheduledValues(c.currentTime);
        master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), c.currentTime);
        master.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.18);
      } catch (e) { /* fall through to the hard stop */ }
      setTimeout(function () { try { stopFn(); } catch (e) {} }, 220);
      return;
    }
    try { stopFn(); } catch (e) {}
  }

  function startTexture(texture, volume, holdMs) {
    stopTexture(false);
    var c = ctx();
    // A suspended context stays suspended across a resume unless told otherwise.
    if (c.state === "suspended" && c.resume) { try { c.resume(); } catch (e) {} }
    var master = c.createGain();
    // RAMPED, NOT SET. A gain that jumps from 0 to 0.4 clicks; 120 ms is below
    // the threshold at which a fade reads as a fade and above the one at which a
    // step reads as a click.
    master.gain.setValueAtTime(0.0001, c.currentTime);
    master.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), c.currentTime + 0.12);
    master.connect(c.destination);

    var stopFn;
    if (texture === "rain") {
      var stopRain = startRain(master, c);
      stopFn = function () { stopRain(); try { master.disconnect(); } catch (e) {} };
    } else {
      var src = loopSource(texture, c);
      src.connect(master);
      src.start();
      stopFn = function () {
        try { src.stop(); } catch (e) {}
        try { src.disconnect(); master.disconnect(); } catch (e) {}
      };
    }
    current = { texture: texture, stop: stopFn, master: master };
    // A PREVIEW STOPS ITSELF. A session passes no hold and runs until it is told
    // to stop; a preview is the same code with an end.
    if (holdMs > 0) {
      autoStop = setTimeout(function () { autoStop = null; stopTexture(true); }, holdMs);
    }
    return true;
  }

  function setVolume(v) {
    if (!current || !audioCtx) return false;
    var vol = Math.max(0.0001, Math.min(1, v));
    try {
      // Ramped for the same reason a start is: a slider dragged across its range
      // would otherwise be a series of steps.
      current.master.gain.cancelScheduledValues(audioCtx.currentTime);
      current.master.gain.setValueAtTime(Math.max(0.0001, current.master.gain.value), audioCtx.currentTime);
      current.master.gain.linearRampToValueAtTime(vol, audioCtx.currentTime + 0.08);
    } catch (e) { return false; }
    return true;
  }

  function state() {
    return {
      context: audioCtx ? audioCtx.state : "none",
      sampleRate: audioCtx ? audioCtx.sampleRate : 0,
      playing: !!current,
      texture: current ? current.texture : null,
      previewing: !!autoStop
    };
  }

  root.FocusNoise = {
    start: startTexture,
    stop: function () { stopTexture(true); },
    stopNow: function () { stopTexture(false); },
    setVolume: setVolume,
    state: state
  };
})(typeof window !== "undefined" ? window : self);