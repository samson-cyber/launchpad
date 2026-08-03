/* global chrome, Audio, setTimeout */

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

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || msg.type !== "lp-offscreen-play") return;
  playSound(msg.url).then(function (played) { sendResponse({ played: played }); });
  return true;  // keep the channel open — the response lands when playback ends
});
