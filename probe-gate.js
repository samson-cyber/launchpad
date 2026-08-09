// [1.2.0 PROBE] SCRATCH BRANCH ONLY — NEVER MERGE.
// Record the gate's REAL first paint (two rAFs = after the frame is presented).
// Written to chrome.storage.local, not beaconed: the shipped CSP
// (connect-src 'self' https:) blocks http from any extension context, and this
// probe must run on the production manifest.
requestAnimationFrame(function () {
  requestAnimationFrame(function () {
    var KEY = "__probe";
    chrome.storage.local.get(KEY).then(function (got) {
      var rows = (got && got[KEY]) || [];
      rows.push({ ev: "gate-painted", wall: Date.now() });
      var payload = {};
      payload[KEY] = rows;
      return chrome.storage.local.set(payload);
    }).catch(function () {});
  });
});
