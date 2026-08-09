// [1.2.0 PROBE] SCRATCH BRANCH ONLY — NEVER MERGE.
// Beacon the gate's real first paint (two rAFs = after the frame is presented).
requestAnimationFrame(function () {
  requestAnimationFrame(function () {
    fetch("http://127.0.0.1:8899/beacon?ev=gate-painted&t=" + Date.now(), { keepalive: true });
  });
});
