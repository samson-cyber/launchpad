/* global chrome, Audio, setTimeout, FocusNoise */

// [1.0.18 B-2] Offscreen audio host — the service worker's speakers.
//
// Deliberately dumb: it knows nothing about phases, settings or storage. It
// plays ONE url on request and reports when playback finished. All the routing
// ("should a sound play at all, and in which context?") is decided upstream by
// Storage.pomodoroSoundTarget, so this file cannot be the thing that
// double-plays or that sounds on an expiry.
//
// Lifecycle is the worker's: it creates this document on demand and closes it
// once the response below arrives. We never self-close — the worker owns the
// document, and closing underneath an in-flight sendResponse would drop it.

var MAX_PLAY_MS = 6000;  // belt: never leave the worker awaiting a stalled decode

function playSound(url) {
  return new Promise(function (resolve) {
    // Only ever play our own packaged assets. The message channel is
    // extension-internal (external senders land on onMessageExternal, which we
    // do not implement), so this is defence in depth rather than a live threat.
    if (typeof url !== "string" || url.indexOf(chrome.runtime.getURL("")) !== 0) {
      return resolve(false);
    }
    var settled = false;
    var done = function (ok) { if (!settled) { settled = true; resolve(ok); } };
    var audio;
    try {
      audio = new Audio(url);
    } catch (err) {
      console.error("[LaunchPad] Focus session: offscreen audio construct failed", err);
      return done(false);
    }
    audio.addEventListener("ended", function () { done(true); });
    audio.addEventListener("error", function () { done(false); });
    setTimeout(function () { done(false); }, MAX_PLAY_MS);
    // An offscreen document created with reason AUDIO_PLAYBACK is exempt from
    // the autoplay gesture requirement, so this should not reject — but a
    // rejection must still settle the promise or the worker waits out its timeout.
    var p = audio.play();
    if (p && p.catch) {
      p.catch(function (err) {
        console.error("[LaunchPad] Focus session: offscreen play rejected", err);
        done(false);
      });
    }
  });
}

// ===== [WM.4 follow-up] THE TEXTURES MOVED TO focus-noise.js =====
//
// The generator that stood here now lives in focus-noise.js, loaded by this
// document AND by the settings page. The reason is this round's whole subject:
// selecting a texture in Settings must play THE SAME SOUND the session will,
// and two copies of a noise generator drift - which the user discovers by
// picking Rain, hearing one thing, and meeting another twenty minutes later.
//
// What stays here is the plumbing: this document is the WORKER's speaker, and
// it still knows nothing about phases, settings or storage.
//
// THE DOCUMENT STILL HAS TWO LIVES. The chime path above creates it, plays once
// and is closed by the worker. A texture OUTLIVES the message that started it,
// so the worker keeps the document open while one is playing. A PREVIEW is
// neither: it happens in the page, where the click that asked for it is, and
// this document is not involved at all.
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg) return;
  if (msg.type === "lp-offscreen-play") {
    playSound(msg.url).then(function (played) { sendResponse({ played: played }); });
    return true;  // keep the channel open — the response lands when playback ends
  }
  // The texture channel. Answers SYNCHRONOUSLY and with the resulting state, so
  // the caller - and the harness - reads what happened rather than assuming it.
  if (msg.type === "lp-offscreen-noise") {
    try {
      if (msg.action === "start" && msg.texture) {
        // NO HOLD: a session's texture runs until it is told to stop.
        FocusNoise.start(msg.texture, typeof msg.volume === "number" ? msg.volume : 0.4, 0);
      } else if (msg.action === "volume") {
        FocusNoise.setVolume(typeof msg.volume === "number" ? msg.volume : 0.4);
      } else {
        FocusNoise.stopNow();
      }
      sendResponse(FocusNoise.state());
    } catch (err) {
      console.error("[LaunchPad] Focus sounds: offscreen noise failed", err);
      sendResponse({ error: String(err && err.message), playing: false });
    }
    return true;
  }
  if (msg.type === "lp-offscreen-noise-state") {
    sendResponse(FocusNoise.state());
    return true;
  }
});