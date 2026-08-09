/* global chrome, importScripts, Storage, ProAccess, LicenseClient, Tracking */

importScripts('storage.js');
importScripts('pro-access.js');
importScripts('license.js');
importScripts('tracking.js');

var PRO_RECONCILE_ALARM = "launchpad-pro-reconcile";
var PRO_RECONCILE_PERIOD_MINUTES = 360; // 6 hours, well above the 30s minimum

// [2.0 bug 1216759668591060] Periodic license RE-VALIDATION against Dodo.
// reconcileProState (above) is PASSIVE — it only time-decays an 'active' license
// to 'free' after the full 14-day grace and never asks Dodo anything, so a
// CANCELLED subscription kept Pro until the user manually clicked "Check license
// status now". The only automatic network validate was newtab.js init, gated by
// LicenseClient's 24h debounce, so a same-day cancellation stayed invisible. The
// fix adds two worker-side triggers that actually hit Dodo: a browser-startup
// call and a daily alarm, both throttled and both funnelled through the
// revalidateLicenseBg writer (enqueueBgData, per BUGS.md L1 / b72b0a6).
//
// THROTTLE: at most one network validate per REVALIDATE_THROTTLE_MS across all
// worker triggers, tracked by a SIBLING top-level key (LICENSE_REVALIDATE_KEY),
// NOT a data.pro field — so the throttle survives SW suspend and a browser
// restart (module vars and chrome.storage.session do not survive a restart) and
// never churns the `data` blob (a data write re-renders every open tab +
// rebuilds the context menu). onStartup fires once per real browser launch, so
// two rapid relaunches collapse to one validate; the daily alarm (1440 min) is
// the browser-left-open-for-days backstop and always clears the 6h throttle.
var LICENSE_VALIDATE_ALARM = "launchpad-license-validate";
var LICENSE_REVALIDATE_KEY = "license_revalidate";
var REVALIDATE_THROTTLE_MS = 6 * 60 * 60 * 1000; // 6h minimum interval between network validates

// [1.0.14] Recurring instance generation. A daily alarm (~03:00 local) + a
// catch-up run on install/startup materialize template occurrences into task
// instances. The handler is STATELESS (no module-level mutable state — the
// prototype lesson, commit 7ff8af8): it reads storage, runs the shared
// Storage.runRecurringSweep (which advances nextScheduledAt + creates instances
// in one saveAll, idempotent under double-fire), and writes back. The Tasks tab
// runs the same sweep opportunistically on open, so a Chrome-was-closed gap is
// caught up whichever path fires first.
var RECURRING_SWEEP_ALARM = "recurring-sweep";

// Next 03:00 in LOCAL time as an epoch. chrome.alarms has no cron; we anchor
// with `when` + a 1440-minute period so it re-fires daily near 03:00.
function nextRecurringSweepAt() {
  var d = new Date();
  d.setHours(3, 0, 0, 0);
  if (d.getTime() <= Date.now()) {
    d.setDate(d.getDate() + 1);
  }
  return d.getTime();
}

// [Bug 1216739924148350] Serial queue for every background mutation of the
// `data` blob. Each such task is its own getAll -> mutate -> saveAll cycle on an
// INDEPENDENT snapshot (getAll returns a fresh object per call), and saveAll
// writes the whole blob — so two cycles that interleave produce a last-write-
// wins clobber: the later saveAll silently overwrites the earlier task's fields.
//
// This bit the cold-start session anchor. onStartup fires the anchor, pro
// reconcile, recurring sweep and trash purge together, and a genuine cold start
// ALSO fires the missed daily-sweep alarm (nextRecurringSweepAt is the next
// 03:00, which elapsed while the PC was off) — a SIXTH writer from a separate
// entry point. The anchor set sessionAnchorAt := now, then a sweep that had read
// the pre-anchor snapshot wrote its blob back on top, reverting sessionAnchorAt
// to startedAt. Observed exactly that: identical startedAt/sessionAnchorAt and a
// surviving pre-shutdown idleMs the anchor's idleMs:=0 should have cleared.
//
// Funnelling every background data-writer through one FIFO queue makes each read
// see the previous write, so disjoint-field writers (anchor vs sweep) all land
// regardless of trigger or arrival order. The queue never rejects (a failing
// task is caught and logged), so one failure cannot stall the chain. Session
// snapshots (savedSessions key) are deliberately NOT enqueued — they touch a
// different key, cannot clobber `data`, and should persist promptly.
var _bgDataQueue = Promise.resolve();
function enqueueBgData(label, fn) {
  var run = function () {
    return Promise.resolve().then(fn).catch(function (err) {
      console.error("[LaunchPad] Background task failed (" + label + "):", err);
    });
  };
  _bgDataQueue = _bgDataQueue.then(run, run);
  return _bgDataQueue;
}

// [1.0.17 session anchor] One write per true browser launch: re-anchor the
// active task's ACTIVE counter to this sitting. Mirrors the recurring-sweep
// pattern (stateless: read storage, call the shared setter which saveAll's
// internally). onStartup ONLY — service-worker suspends inside a running
// browser must not reset the anchor, and onInstalled is a different event with
// different semantics (a fresh install/update has no sitting to carry over).
function anchorBrowserSessionBg() {
  // Enqueued so the anchor's saveAll cannot be clobbered by a concurrent sweep/
  // reconcile/purge (see enqueueBgData). onStartup calls this FIRST, so it heads
  // the queue and lands before any sibling writer reads.
  return enqueueBgData("session-anchor", async function () {
    var data = await Storage.getAll();
    await Storage.anchorBrowserSession(data); // no-op (no write) when no task is active
  });
}

function runRecurringSweepBg() {
  return enqueueBgData("recurring-sweep", async function () {
    var data = await Storage.getAll();
    var res = await Storage.runRecurringSweep(data); // saveAll's internally when it changes state
    if (res && res.instancesCreated) {
      console.log("[LaunchPad] Recurring sweep: created " + res.instancesCreated +
        " instance(s), advanced " + res.templatesAdvanced + " template(s), skipped " + res.skipped);
    }
  });
}

// [Trash] Daily 30-day trash auto-purge — mirrors the recurring-sweep pattern
// exactly: a stateless handler (reads storage, runs the shared
// Storage.purgeExpiredTrash which does all removals in one saveAll, no
// module-level mutable state), fired by a named daily alarm (~03:00 local, the
// same anchor as recurring-sweep) plus a catch-up on install/startup. The Tasks
// tab's opportunistic render-path call to the same function is unchanged.
var TRASH_PURGE_ALARM = "trash-purge";

function runTrashPurgeBg() {
  return enqueueBgData("trash-purge", async function () {
    var data = await Storage.getAll();
    await Storage.purgeExpiredTrash(data); // saveAll's + logs the count internally when it removes anything
  });
}

function runProReconcile() {
  return enqueueBgData("pro-reconcile", async function () {
    var data = await Storage.getAll();
    var changed = ProAccess.reconcileProState(data);
    if (changed) {
      await Storage.saveAll(data);
      console.log("[LaunchPad] Pro state reconciled:", data.pro.subscriptionStatus);
    }
  });
}

// [2.0 bug 1216759668591060] Ask Dodo whether the stored license is still valid,
// and persist the verdict — the missing periodic trigger. Enqueued because it is
// a background `data` writer (BUGS.md L1): a bare getAll -> ensureValidated ->
// saveAll cycle that would otherwise last-write-lose against a concurrent sweep/
// anchor/reconcile on startup.
//
// FAILURE SEMANTICS live entirely inside LicenseClient.ensureValidated and are
// deliberately NOT re-implemented here:
//   - FAIL-OPEN: network error / timeout / 5xx / unparseable 2xx -> data.pro is
//     left untouched (subscriptionStatus + lastVerifiedAt preserved), so an
//     offline or flaky-network user KEEPS Pro. getProAccessLevel's own 7-day
//     grace / 14-day expiry then rides the last SUCCESSFUL lastVerifiedAt.
//   - FAIL-CLOSED: an explicit invalid verdict (200 valid:false, or 4xx / Dodo
//     structured error) -> subscriptionStatus flips to 'invalid', which
//     getProAccessLevel maps straight to 'free' (the proven manual-button path).
//
// force:true bypasses the 24h per-newtab debounce so a relaunch shortly after a
// cancellation catches it; our own 6h throttle (sibling key) is what bounds the
// Dodo call rate. We persist ONLY when an entitlement field actually moved, so a
// fail-open no-op and a throttled skip write nothing to `data` (no churn, no
// re-render). ProAccess/LicenseClient stay pure; persistence is the caller's job.
function revalidateLicenseBg(reason) {
  return enqueueBgData("license-revalidate", async function () {
    var data = await Storage.getAll();
    // Free / trial / never-purchased: no key to validate. Nothing to do.
    if (!data.pro || !data.pro.licenseKey) return;

    // Throttle on the SIBLING key so rapid relaunches / a startup+missed-alarm
    // double-fire collapse to one network validate, without touching `data`.
    var throttle = await chrome.storage.local.get(LICENSE_REVALIDATE_KEY);
    var slot = throttle && throttle[LICENSE_REVALIDATE_KEY];
    var lastAttemptAt = (slot && slot.lastAttemptAt) || 0;
    if (Date.now() - lastAttemptAt < REVALIDATE_THROTTLE_MS) return;
    // Claim the window BEFORE the network call so a hang / SW death cannot spawn
    // a retry storm; the next attempt waits out the throttle regardless.
    var slotWrite = {};
    slotWrite[LICENSE_REVALIDATE_KEY] = { lastAttemptAt: Date.now(), reason: reason || "unknown" };
    await chrome.storage.local.set(slotWrite);

    var beforeStatus = data.pro.subscriptionStatus;
    var beforeVerified = data.pro.lastVerifiedAt || 0;
    try {
      await LicenseClient.ensureValidated(data, data.pro.licenseKey, { force: true });
    } catch (err) {
      // Unexpected throw is treated as FAIL-OPEN: leave entitlement untouched.
      console.error("[LaunchPad] License revalidation error (" + (reason || "unknown") + "):", err);
      return;
    }
    // Persist iff an entitlement field moved. Network/5xx fail-open leaves both
    // equal -> no write. A valid refresh advances lastVerifiedAt; an invalid
    // verdict flips subscriptionStatus. Both are genuine, at most once per 6h.
    var moved = data.pro.subscriptionStatus !== beforeStatus ||
                (data.pro.lastVerifiedAt || 0) !== beforeVerified;
    if (moved) {
      await Storage.saveAll(data);
      console.log("[LaunchPad] License revalidated (" + (reason || "unknown") +
        "):", data.pro.subscriptionStatus);
    }
  });
}

// [Bugfix] One-time retirement cleanup for the April tab-tracking prototype
// (tracking-prototype.js, deleted in this commit). Its disposable key
// accumulated full URLs since April — validation concluded, so the key goes
// (BUGS.md H3). Store users never received the prototype: it landed after the
// 1.0.4 submission, so this only ever fires on a dev profile.
//
// Read-first rather than an unconditional remove: once the key is gone this is
// a single cheap get that returns nothing, so no persisted "already cleaned"
// flag is needed and the steady-state path never writes.
var TRACKING_PROTOTYPE_KEY = "tracking_prototype";

async function cleanupTrackingPrototype() {
  try {
    var result = await chrome.storage.local.get(TRACKING_PROTOTYPE_KEY);
    if (result[TRACKING_PROTOTYPE_KEY] === undefined) return;
    await chrome.storage.local.remove(TRACKING_PROTOTYPE_KEY);
    console.log("[LaunchPad] Retired tracking prototype: removed disposable key " + TRACKING_PROTOTYPE_KEY);
  } catch (err) {
    console.error("[LaunchPad] Tracking prototype cleanup failed:", err);
  }
}

var DOMAIN_ALIASES = {
  'outlook.live.com': 'microsoft-mail',
  'outlook.cloud.microsoft': 'microsoft-mail',
  'outlook.office.com': 'microsoft-mail',
  'outlook.office365.com': 'microsoft-mail',
  'mail.google.com': 'google-mail',
  'gmail.com': 'google-mail',
  'facebook.com': 'meta',
  'www.facebook.com': 'meta',
  'adsmanager.facebook.com': 'meta-ads',
  'business.facebook.com': 'meta-ads',
  'ads.google.com': 'google-ads',
  'docs.google.com': 'google-docs',
  'sheets.google.com': 'google-docs',
  'slides.google.com': 'google-docs',
  'drive.google.com': 'google-docs'
};

function getMatchKeyBg(url) {
  try {
    var hostname = new URL(url).hostname;
    if (DOMAIN_ALIASES[hostname]) return DOMAIN_ALIASES[hostname];
    return hostname;
  } catch (e) { return null; }
}

// Debounced context menu rebuild.
//
// Rapid storage writes (e.g. during onboarding) used to fire many overlapping
// rebuilds, which raced inside chrome.contextMenus and surfaced as
// "Cannot create item with duplicate id". The wrapper collapses bursts into a
// single rebuild and reads storage fresh when the timer fires — the last
// caller's data always wins. setTimeout is ~75ms, well under the SW idle
// suspend threshold so it is safe per BUGS.md A2.
var CONTEXT_MENU_REBUILD_DELAY_MS = 75;
var contextMenuRebuildTimer = null;

function requestContextMenuRebuild() {
  if (contextMenuRebuildTimer) clearTimeout(contextMenuRebuildTimer);
  contextMenuRebuildTimer = setTimeout(function () {
    contextMenuRebuildTimer = null;
    rebuildContextMenuNow();
  }, CONTEXT_MENU_REBUILD_DELAY_MS);
}

async function rebuildContextMenuNow() {
  var data;
  try {
    data = await Storage.getAll();
  } catch (err) {
    console.error("[LaunchPad] Failed to load data for context menu:", err);
    return;
  }

  var ws = Storage.getActiveWorkspace(data);
  var groups = (ws && ws.groups) || [];
  var groupOrder = (ws && ws.groupOrder) || [];
  var groupMap = {};
  groups.forEach(function (g) { groupMap[g.id] = g; });

  var ordered = groupOrder
    .map(function (id) { return groupMap[id]; })
    .filter(Boolean);

  groups.forEach(function (g) {
    if (!ordered.find(function (o) { return o.id === g.id; })) {
      ordered.push(g);
    }
  });

  // Use the callback form of removeAll: creates run only after Chrome has
  // fully torn the previous menu down, eliminating the duplicate-id race.
  chrome.contextMenus.removeAll(function () {
    if (chrome.runtime.lastError) {
      console.error("[LaunchPad] contextMenus.removeAll failed:", chrome.runtime.lastError.message);
      return;
    }

    chrome.contextMenus.create({
      id: "add-to-launchpad",
      title: "Add to LaunchPad",
      contexts: ["page", "link"]
    });

    ordered.forEach(function (group) {
      chrome.contextMenus.create({
        id: "add-to-group_" + group.id,
        parentId: "add-to-launchpad",
        title: group.name,
        contexts: ["page", "link"]
      });
    });

    chrome.contextMenus.create({
      id: "add-to-group_separator",
      parentId: "add-to-launchpad",
      type: "separator",
      contexts: ["page", "link"]
    });

    chrome.contextMenus.create({
      id: "add-to-group_new",
      parentId: "add-to-launchpad",
      title: "+ New Group...",
      contexts: ["page", "link"]
    });

    if (chrome.runtime.lastError) {
      console.error("[LaunchPad] contextMenus.create failed:", chrome.runtime.lastError.message);
      return;
    }

    console.log("[LaunchPad] Context menu rebuilt with", ordered.length, "group(s)");
  });
}

// ===== Session Saving System =====

function getTodayKey() {
  var d = new Date();
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, "0");
  var day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

async function saveCurrentSession() {
  try {
    var tabs = await chrome.tabs.query({});
    var windows = {};
    tabs.forEach(function (tab) {
      if (/^chrome:\/\/|^chrome-extension:\/\//.test(tab.url || "")) return;
      if (!windows[tab.windowId]) windows[tab.windowId] = [];
      var domain;
      try { domain = new URL(tab.url).hostname; } catch (e) { domain = ""; }
      var tabFavicon = (tab.favIconUrl && !tab.favIconUrl.startsWith("chrome://"))
        ? tab.favIconUrl
        : "https://www.google.com/s2/favicons?domain=" + domain + "&sz=128";
      windows[tab.windowId].push({
        url: tab.url,
        title: tab.title || "",
        favicon: tabFavicon
      });
    });
    var windowList = Object.keys(windows).map(function (wid) {
      return { tabs: windows[wid] };
    }).filter(function (w) { return w.tabs.length > 0; });
    if (!windowList.length) return;

    var result = await chrome.storage.local.get("savedSessions");
    var saved = result.savedSessions || {};
    var todayKey = getTodayKey();
    saved[todayKey] = { windows: windowList, timestamp: Date.now() };
    await chrome.storage.local.set({ savedSessions: saved });
    console.log("[LaunchPad] Session saved for", todayKey, ":", windowList.length, "window(s)");
  } catch (err) {
    console.error("[LaunchPad] Failed to save session:", err);
  }
}

async function pruneOldSessions() {
  try {
    var result = await chrome.storage.local.get("savedSessions");
    var saved = result.savedSessions || {};
    delete saved.current;
    delete saved.previous;
    var keys = Object.keys(saved).sort().reverse();
    if (keys.length > 7) {
      keys.slice(7).forEach(function (k) { delete saved[k]; });
      await chrome.storage.local.set({ savedSessions: saved });
      console.log("[LaunchPad] Pruned old sessions, keeping", Math.min(keys.length, 7), "days");
    }
  } catch (err) {
    console.error("[LaunchPad] Failed to prune sessions:", err);
  }
}

// ===== [1.0.18 B-1] Focus session notifications + SW scheduling authority =====
//
// The SW owns ONE 'pomodoro-phase' alarm as a PURE DERIVATION of storage: it exists
// iff (notificationsEnabled && a phase is running && not paused). Start/stop/pause/
// resume/switch/complete all flow through `data`, so re-deriving on every `data`
// change (+ on startup/install) keeps the alarm correct with no per-action alarm
// code in the page. The notifications toggle is the user's consent for the SW to
// advance phases in the BACKGROUND; with it OFF, behavior is exactly today's page-
// side-only model (graceful unattended expiry).
var POMODORO_PHASE_ALARM = "pomodoro-phase";
var POMODORO_NOTIF_ID = "launchpad-pomodoro";

// PURE (harnessed): the desired alarm fire time (ms epoch) for these derivation
// inputs, or null for "no alarm". A past `when` is intentional — chrome.alarms
// fires it ~immediately and reconcilePomodoro then computes the true phase from the
// stored phaseEndsAt (the missed-alarm pattern, BUGS.md A3), never from alarm timing.
function desiredPomodoroAlarmWhen(state) {
  if (!state || !state.notificationsEnabled) return null;      // the toggle IS the background-operation consent
  if (state.trackingPaused) return null;                       // a frozen phase cannot cross its boundary
  if (!state.phase || state.phaseEndsAt == null) return null;  // nothing running
  return state.phaseEndsAt;
}

// Collapse a `data` snapshot to the four derivation inputs above.
function pomodoroAlarmStateFromData(data) {
  var settings = Storage.getPomodoroSettings(data);
  var active = Storage.getActiveTask(data);
  var ps = active ? Storage.hydratePomodoroState(active.pomodoroState) : null;
  return {
    notificationsEnabled: !!settings.notificationsEnabled,
    trackingPaused: Storage.isTrackingPaused(data),
    phase: ps ? ps.phase : null,
    phaseEndsAt: ps ? ps.phaseEndsAt : null
  };
}

// Reconcile the single alarm to match storage. Idempotent: only touches the alarm
// when the desired time actually changes, so unrelated `data` writes don't thrash
// it. Writes NO `data`, so it cannot feed back through onChanged.
async function reconcilePomodoroAlarm() {
  var data;
  try { data = await Storage.getAll(); }
  catch (err) { console.error("[LaunchPad] Focus session: alarm reconcile read failed", err); return; }
  var when = desiredPomodoroAlarmWhen(pomodoroAlarmStateFromData(data));
  var existing = await chrome.alarms.get(POMODORO_PHASE_ALARM);
  if (when == null) {
    if (existing) await chrome.alarms.clear(POMODORO_PHASE_ALARM);
    return;
  }
  if (!existing || existing.scheduledTime !== when) {
    chrome.alarms.create(POMODORO_PHASE_ALARM, { when: when });
  }
}

// Does the extension actually HOLD the notifications permission right now? The
// stored flag is intent, not proof — the user may have revoked it via
// chrome://settings. Every notification post is guarded by this. (Also covers the
// case where the optional API object is absent before the first grant.)
function hasNotificationsPermission() {
  if (!chrome.notifications || !chrome.permissions) return Promise.resolve(false);
  return chrome.permissions.contains({ permissions: ["notifications"] }).catch(function () { return false; });
}

function clearPomodoroNotification() {
  return new Promise(function (resolve) {
    if (!chrome.notifications) return resolve();
    chrome.notifications.clear(POMODORO_NOTIF_ID, function () { resolve(); });
  });
}

// Post the boundary notification — ONLY when the permission is actually held. One
// visible at a time (id-keyed): clear the prior before posting. work->break carries
// no button; break-end (session complete) carries a single 'Start next session'.
async function firePomodoroNotification(kind, res) {
  if (!(await hasNotificationsPermission())) return;
  var opts;
  if (kind === "advanced") {
    var mins = Math.round((res.fromDurationMs || 0) / 60000);
    opts = { type: "basic", iconUrl: "icons/icon128.png", title: "Break time",
             message: "Nice — " + mins + " min focused." };
  } else { // "completed"
    opts = { type: "basic", iconUrl: "icons/icon128.png", title: "Session complete",
             message: "Ready for another?", buttons: [{ title: "Start next session" }] };
  }
  try {
    await clearPomodoroNotification();
    chrome.notifications.create(POMODORO_NOTIF_ID, opts);
  } catch (err) {
    console.error("[LaunchPad] Focus session: notification create failed", err);
  }
}

// ===== [1.0.18 B-2] Boundary chime playback from the worker =====
//
// A service worker has no DOM and cannot play audio, so a background boundary
// has two possible speakers: an open newtab page (messaged), or an offscreen
// document we create for the occasion. Storage.pomodoroSoundTarget picks; this
// section only executes the choice.
//
// ONE CUE PER BOUNDARY, still: only the context that actually performed the
// transition reaches here at all (reconcilePomodoro's fresh re-read guard hands
// exactly one caller 'advanced'/'completed'), so a page-side advance plays
// page-side and this code never runs for it.
var POMODORO_OFFSCREEN_URL = "offscreen.html";
var POMODORO_SOUND_TAB_TIMEOUT_MS = 1500;   // a page that cannot answer this fast is not going to play
var POMODORO_SOUND_OFFSCREEN_TIMEOUT_MS = 8000; // > offscreen.js's own 6s belt, so it answers first
var _soundOffscreenReady = null;            // single-flight creation promise

// The tab id of an open LaunchPad newtab page, or null. getContexts (Chrome 116+,
// our manifest minimum) is the only way a worker can ask "is one of my pages
// alive right now?" without waking anything.
async function newtabSoundTabId() {
  if (!chrome.runtime.getContexts) return null;
  try {
    var ctxs = await chrome.runtime.getContexts({ contextTypes: ["TAB"] });
    var wanted = chrome.runtime.getURL("newtab.html");
    for (var i = 0; i < (ctxs || []).length; i++) {
      var c = ctxs[i];
      // documentUrl can carry a #hash/query; match the page, not the exact string.
      if (c && c.documentUrl && c.documentUrl.indexOf(wanted) === 0 && c.tabId != null && c.tabId >= 0) {
        return c.tabId;
      }
    }
  } catch (err) {
    console.error("[LaunchPad] Focus session: tab context probe failed", err);
  }
  return null;
}

// Ask one open newtab to play the chime. Resolves TRUE only when that page
// confirms it actually played — a closed tab, a listener-less page, or Chrome's
// autoplay policy refusing playback in a background tab all resolve false so the
// caller can fall back to the offscreen document (which is gesture-exempt).
function sendSoundToTab(tabId, sound) {
  return new Promise(function (resolve) {
    var settled = false;
    var done = function (ok) { if (!settled) { settled = true; resolve(ok); } };
    var timer = setTimeout(function () { done(false); }, POMODORO_SOUND_TAB_TIMEOUT_MS);
    try {
      chrome.tabs.sendMessage(tabId, { type: "lp-pomodoro-sound", sound: sound }, function (resp) {
        clearTimeout(timer);
        if (chrome.runtime.lastError) return done(false);   // no receiver / tab gone
        done(!!(resp && resp.played));
      });
    } catch (err) {
      clearTimeout(timer);
      done(false);
    }
  });
}

// Create the offscreen document if it isn't already there. Creation is a GLOBAL
// singleton and inherently racy (two boundaries, or a retry, can overlap), so
// this is guarded three ways: a getContexts existence probe, a module-level
// single-flight promise, and — because neither closes the window between the
// probe and the create — swallowing the "single offscreen document" error as
// success. The in-flight promise is cleared on settle, since we CLOSE the
// document after each chime and the next boundary must probe afresh.
function ensureSoundOffscreen() {
  if (_soundOffscreenReady) return _soundOffscreenReady;
  var p = (async function () {
    if (!chrome.offscreen || !chrome.runtime.getContexts) return false;
    try {
      var existing = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
      if (existing && existing.length) return true;
    } catch (err) { /* fall through to create; the error below is the real signal */ }
    try {
      await chrome.offscreen.createDocument({
        url: POMODORO_OFFSCREEN_URL,
        reasons: ["AUDIO_PLAYBACK"],
        justification: "Play the Focus session chime when a work or break phase ends with no LaunchPad tab open."
      });
      return true;
    } catch (err) {
      if (/single offscreen document/i.test(String(err && err.message))) return true;  // lost the race; it exists
      console.error("[LaunchPad] Focus session: offscreen create failed", err);
      return false;
    }
  })();
  _soundOffscreenReady = p;
  p.catch(function () {}).then(function () { if (_soundOffscreenReady === p) _soundOffscreenReady = null; });
  return p;
}

async function closeSoundOffscreen() {
  if (!chrome.offscreen || !chrome.offscreen.closeDocument) return;
  try {
    await chrome.offscreen.closeDocument();
  } catch (err) {
    // Already closed (or never opened) — not worth surfacing.
  }
}

// Play through a freshly created offscreen document, then close it. Awaiting the
// response keeps the worker alive for the ~1.5s the chime lasts; the timeout is
// the backstop for a document that never answers, so we always reach the close.
async function playSoundViaOffscreen(sound) {
  var file = Storage.pomodoroSoundFile(sound);
  if (!file) return;
  if (!(await ensureSoundOffscreen())) return;
  var url = chrome.runtime.getURL(file);
  try {
    await new Promise(function (resolve) {
      var settled = false;
      var done = function () { if (!settled) { settled = true; resolve(); } };
      var timer = setTimeout(done, POMODORO_SOUND_OFFSCREEN_TIMEOUT_MS);
      try {
        chrome.runtime.sendMessage({ type: "lp-offscreen-play", url: url }, function () {
          clearTimeout(timer);
          void chrome.runtime.lastError;   // no receiver yet -> the timeout already covered us
          done();
        });
      } catch (err) {
        clearTimeout(timer);
        done();
      }
    });
  } finally {
    await closeSoundOffscreen();
  }
}

// Route + play one boundary's chime. Called OUTSIDE the `data` queue (see
// runPomodoroPhaseBg) so holding the worker alive for the audio never stalls
// unrelated background writers.
async function firePomodoroSound(action, sound) {
  // Cheap silence check before probing contexts: when the answer is 'none' it is
  // tab-INDEPENDENT (not a boundary, or no chime chosen), so passing tabOpen:false
  // here cannot mask a case that would otherwise have played.
  if (Storage.pomodoroSoundTarget({ context: "sw", action: action, sound: sound, tabOpen: false }) === "none") return;

  var tabId = await newtabSoundTabId();
  var target = Storage.pomodoroSoundTarget({
    context: "sw", action: action, sound: sound, tabOpen: tabId != null
  });
  if (target === "page-message" && await sendSoundToTab(tabId, sound)) return;   // the page played it
  await playSoundViaOffscreen(sound);   // no tab, or the tab declined to play
}

// Alarm fire (or startup/install catch-up): a boundary may be due, or the SW woke
// to one that already passed. Reconcile from the stored phaseEndsAt via the SHARED
// storage.js logic. Serialized through enqueueBgData so it cannot clobber a
// concurrent `data` writer (BUGS.md L1). reconcilePomodoro does its own fresh
// re-read guard + saveAll; that write re-triggers reconcilePomodoroAlarm via
// onChanged, scheduling the next boundary.
//
// Gated on notificationsEnabled: with the toggle OFF the SW must NEVER advance a
// phase in the background (B1 fork). The alarm should not exist then; this is the
// defensive belt against a toggle-off / alarm-fire race.
//
// GRACE UNIFORMITY (D3): reconcilePomodoro advances only within GRACE and expires
// QUIETLY beyond it — a late fire after sleep produces NO notification. Only
// 'advanced'/'completed' notify. 'none' means nothing was due OR an OPEN TAB's
// page-side tick already advanced this boundary and the re-read guard no-oped here
// — correct: the user watched it happen and saw the toast, so no notification.
//
// [B-2] The chime rides the same two actions as the notification, but is fired
// AFTER the queued section returns, not inside it: playback holds the worker
// alive for a second or two, and doing that inside enqueueBgData would stall
// every other background `data` writer behind it for no reason. The queued part
// still owns all the storage work; only the speaker call is handed outward.
function runPomodoroPhaseBg() {
  return enqueueBgData("pomodoro-phase", async function () {
    var data = await Storage.getAll();
    var settings = Storage.getPomodoroSettings(data);
    if (!settings.notificationsEnabled) return null;
    var res = await Storage.reconcilePomodoro(data);
    if (res.action === "advanced") {
      await firePomodoroNotification("advanced", res);
    } else if (res.action === "completed") {
      await firePomodoroNotification("completed", res);
    }
    return { action: res.action, sound: settings.sound };
  }).then(function (out) {
    if (!out) return;
    return firePomodoroSound(out.action, out.sound);
  });
}

// [B2] "Start next session" from the break-end notification. SW-initiated `data`
// write -> enqueueBgData (BUGS.md L1). Guard a STALE notification against a changed
// world: start only if the sessionComplete marker is still set AND a task is still
// active (the user may have switched tasks or acted since it posted). Clear the
// notification either way. startPomodoroPhase's write re-triggers scheduling via
// onChanged. Guarded registration: chrome.notifications may be absent until the
// optional permission is first granted, and referencing it unconditionally at SW
// registration would throw and kill the whole worker (BUGS.md H2). Whenever a
// notification CAN be shown the permission is held, so the SW startup that shows it
// also registers this handler.
if (chrome.notifications && chrome.notifications.onButtonClicked) {
  chrome.notifications.onButtonClicked.addListener(function (notifId, buttonIndex) {
    if (notifId !== POMODORO_NOTIF_ID || buttonIndex !== 0) return;
    enqueueBgData("pomodoro-notif-button", async function () {
      var data = await Storage.getAll();
      var active = Storage.getActiveTask(data);
      var ps = active ? Storage.hydratePomodoroState(active.pomodoroState) : null;
      if (active && ps && ps.sessionComplete) {
        await Storage.startPomodoroPhase(data);
      }
      await clearPomodoroNotification();
    });
  });
}

// Re-derive the alarm on every `data` change (start/stop/pause/resume/switch/
// complete/settings all land here). Idempotent + writes no `data`, so no loop.
chrome.storage.onChanged.addListener(function (changes, areaName) {
  if (areaName && areaName !== "local") return;
  if (!changes.data) return;
  reconcilePomodoroAlarm();
});

chrome.runtime.onInstalled.addListener(function () {
  requestContextMenuRebuild();
  chrome.alarms.create("save-session", { periodInMinutes: 5 });
  chrome.alarms.create(PRO_RECONCILE_ALARM, { periodInMinutes: PRO_RECONCILE_PERIOD_MINUTES });
  chrome.alarms.create(RECURRING_SWEEP_ALARM, { when: nextRecurringSweepAt(), periodInMinutes: 1440 });
  chrome.alarms.create(TRASH_PURGE_ALARM, { when: nextRecurringSweepAt(), periodInMinutes: 1440 });
  chrome.alarms.create(LICENSE_VALIDATE_ALARM, { when: nextRecurringSweepAt(), periodInMinutes: 1440 });
  saveCurrentSession();
  runProReconcile();
  runRecurringSweepBg();
  runTrashPurgeBg();
  cleanupTrackingPrototype();
  Tracking.start();
  // [1.0.18 B-1] Catch up a phase boundary crossed before this install/update (no-op
  // + no notify when notifications are OFF), then reconcile the alarm to match.
  runPomodoroPhaseBg();
  reconcilePomodoroAlarm();
});
chrome.runtime.onStartup.addListener(function () {
  requestContextMenuRebuild();
  chrome.alarms.create("save-session", { periodInMinutes: 5 });
  chrome.alarms.create(PRO_RECONCILE_ALARM, { periodInMinutes: PRO_RECONCILE_PERIOD_MINUTES });
  chrome.alarms.create(RECURRING_SWEEP_ALARM, { when: nextRecurringSweepAt(), periodInMinutes: 1440 });
  chrome.alarms.create(TRASH_PURGE_ALARM, { when: nextRecurringSweepAt(), periodInMinutes: 1440 });
  chrome.alarms.create(LICENSE_VALIDATE_ALARM, { when: nextRecurringSweepAt(), periodInMinutes: 1440 });
  saveCurrentSession();
  pruneOldSessions();
  anchorBrowserSessionBg();
  runProReconcile();
  runRecurringSweepBg();
  runTrashPurgeBg();
  // [2.0 bug 1216759668591060] Browser-launch license re-validation (throttled
  // to REVALIDATE_THROTTLE_MS via the sibling key). This is the trigger the
  // cancelled-subscription smoke test proved missing: a relaunch now re-checks
  // Dodo and downgrades a revoked license without the manual button.
  revalidateLicenseBg("startup");
  cleanupTrackingPrototype();
  Tracking.start();
  // [1.0.18 B-1] Missed-alarm catch-up (BUGS.md A3): a phase boundary may have
  // passed while the browser was closed. Reconcile from the stored phaseEndsAt
  // (advance within GRACE, quiet expiry beyond; gated on notifications ON), then
  // reschedule the alarm for a still-running phase.
  runPomodoroPhaseBg();
  reconcilePomodoroAlarm();
});

chrome.storage.onChanged.addListener(function (changes) {
  if (changes.data) {
    requestContextMenuRebuild();
  }
});

chrome.contextMenus.onClicked.addListener(async function (info, tab) {
  var menuId = info.menuItemId;
  if (typeof menuId !== "string" || !menuId.startsWith("add-to-group_")) return;

  try {
    var url = info.linkUrl || info.pageUrl || (tab && tab.url) || "";
    if (!url || url.startsWith("chrome://") || url.startsWith("chrome-extension://")) {
      console.warn("[LaunchPad] Skipping unsupported URL:", url);
      return;
    }

    var title = info.linkUrl
      ? (info.linkUrl.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] || info.linkUrl)
      : ((tab && tab.title) || url);

    var domain;
    try { domain = new URL(url).hostname; } catch (e) { domain = url; }

    var favicon;
    if (!info.linkUrl && tab && tab.favIconUrl && !tab.favIconUrl.startsWith("chrome://")) {
      favicon = tab.favIconUrl;
    } else {
      favicon = "https://www.google.com/s2/favicons?domain=" + domain + "&sz=128";
    }

    var shortcut = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      url: url,
      title: title,
      favicon: favicon,
      addedAt: Date.now(),
      deletedAt: null
    };

    await addShortcutFromContextMenuBg(shortcut, menuId);
  } catch (err) {
    console.error("[LaunchPad] Failed to add shortcut:", err);
  }
});

// [L1] The getAll -> mutate -> saveAll tail of the right-click add, serialized —
// same shape as every other queued background writer in this file
// (anchorBrowserSessionBg / runRecurringSweepBg / runTrashPurgeBg). Only the
// storage cycle is in here: URL parsing, title/favicon derivation and the
// shortcut record are all built by the caller before queueing, since none of
// them need `data`. Menu and context handling are untouched.
//
// The fresh read is INSIDE the job by construction — the caller has no snapshot
// to hand over, which is the point (reusing a pre-queue snapshot is the L1
// clobber). Keeps its own try/catch so the original failure log is preserved
// verbatim rather than being absorbed by the queue's generic handler.
function addShortcutFromContextMenuBg(shortcut, menuId) {
  return enqueueBgData("context-menu-add", async function () {
    try {
      var data = await Storage.getAll();
      var ws = Storage.getActiveWorkspace(data);
      if (!ws) {
        console.warn("[LaunchPad] No active workspace; cannot add shortcut");
        return;
      }

      var url = shortcut.url;
      var targetGroupId = menuId.replace("add-to-group_", "");
      var targetGroup;

      if (targetGroupId === "new") {
        var newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        targetGroup = { id: newId, name: "New Group", shortcuts: [], deletedAt: null };
        ws.groups.push(targetGroup);
        ws.groupOrder.push(newId);
      } else {
        targetGroup = ws.groups.find(function (g) { return g.id === targetGroupId; });
        if (!targetGroup) {
          targetGroup = ws.groups.find(function (g) { return g.id === "ungrouped"; });
          if (!targetGroup) {
            targetGroup = { id: "ungrouped", name: "Ungrouped", shortcuts: [], deletedAt: null };
            ws.groups.push(targetGroup);
            ws.groupOrder.push("ungrouped");
          }
        }
      }

      var matchKey = getMatchKeyBg(url);
      var existingMatch = null;
      targetGroup.shortcuts.forEach(function (s) {
        if (!existingMatch) {
          var sKey = getMatchKeyBg(s.url);
          if (sKey && matchKey && sKey === matchKey) existingMatch = s;
        }
      });

      if (existingMatch) {
        if (!existingMatch.variants) existingMatch.variants = [];
        var variantTitle = shortcut.title;
        try {
          var variantPath = new URL(url).pathname;
          var accountMatch = variantPath.match(/\/u\/(\d+)/);
          if (accountMatch) variantTitle = "Account " + (parseInt(accountMatch[1]) + 1);
        } catch (e) {}
        existingMatch.variants.push({
          id: shortcut.id,
          url: shortcut.url,
          title: variantTitle,
          favicon: shortcut.favicon,
          deletedAt: null
        });
        console.log("[LaunchPad] Auto-nested under", existingMatch.title, ":", shortcut.title);
      } else {
        targetGroup.shortcuts.push(shortcut);
        console.log("[LaunchPad] Shortcut added to", targetGroup.name, ":", shortcut.title);
      }

      // [R3] Getting-Started ticks ride THIS existing write (no new messaging
      // infra). A right-click add is always step 1 (added a shortcut) + step 2
      // (the right-click path itself); step 3 if it auto-nested; step 4 if the
      // user chose "New Group". Idempotent + permanent; a right-click add is never
      // demo content, so no exclusion guard is needed here.
      if (Storage.recordChecklistStep) {
        Storage.recordChecklistStep(data, Storage.GS_STEPS.SHORTCUT);
        Storage.recordChecklistStep(data, Storage.GS_STEPS.RIGHTCLICK);
        if (existingMatch) Storage.recordChecklistStep(data, Storage.GS_STEPS.NEST);
        if (targetGroupId === "new") Storage.recordChecklistStep(data, Storage.GS_STEPS.GROUP);
      }

      await Storage.saveAll(data);
    } catch (err) {
      console.error("[LaunchPad] Failed to add shortcut:", err);
    }
  });
}

chrome.alarms.onAlarm.addListener(function (alarm) {
  if (alarm.name === "save-session") {
    saveCurrentSession();
  } else if (alarm.name === PRO_RECONCILE_ALARM) {
    runProReconcile();
  } else if (alarm.name === RECURRING_SWEEP_ALARM) {
    runRecurringSweepBg();
  } else if (alarm.name === TRASH_PURGE_ALARM) {
    runTrashPurgeBg();
  } else if (alarm.name === LICENSE_VALIDATE_ALARM) {
    revalidateLicenseBg("alarm");
  } else if (alarm.name === POMODORO_PHASE_ALARM) {
    runPomodoroPhaseBg();
  }
});

chrome.windows.onRemoved.addListener(function () {
  saveCurrentSession();
});

// [1.0.5.3] Dodo checkout return URL handler. Dodo redirects to
// https://mylaunchpad.me/checkout-return.html?license_key=...&email=...
// after a successful purchase (one-time and subscription products both
// land here; product-type-specific fields like payment_id / subscription_id
// are ignored — entitlement state comes from LicenseClient.ensureValidated).
//
// Cloudflare Pages 307-redirects /checkout-return.html -> /checkout-return
// (clean-URL convention), so the committed tab URL has NO .html. Match both
// the clean and .html paths, host-scoped, tolerating a trailing slash.
function isCheckoutReturnUrl(rawUrl) {
  if (!rawUrl) return false;
  var u;
  try { u = new URL(rawUrl); } catch (e) { return false; }
  if (u.hostname !== 'mylaunchpad.me') return false;
  var path = u.pathname.replace(/\/+$/, '');   // tolerate trailing slash
  return path === '/checkout-return' || path === '/checkout-return.html';
}

// Top-level listener (registered on every SW wake; same listener function
// reference each time so Chrome dedups). Filters on changeInfo.url so it
// only does work for matching URLs. Closes the tab unconditionally — the
// license key is persisted regardless of the validate outcome so the user
// has a path to retry validation from Pro Settings later if the network
// call failed.
chrome.tabs.onUpdated.addListener(async function (tabId, changeInfo, tab) {
  if (!changeInfo.url) return;
  if (!isCheckoutReturnUrl(changeInfo.url)) return;
  await handleCheckoutReturn(tabId, changeInfo.url);
});

async function handleCheckoutReturn(tabId, url) {
  try {
    var parsed;
    try { parsed = new URL(url); } catch (e) {
      console.warn("[LaunchPad] Checkout return: invalid URL", url);
      return;
    }
    var rawKey = parsed.searchParams.get('license_key');
    if (!rawKey) {
      console.warn("[LaunchPad] Checkout return: missing license_key");
      return;
    }
    // Some Dodo flows comma-separate multi-key responses. Take the first.
    var firstKey = rawKey.split(',')[0].trim();
    if (!firstKey) {
      console.warn("[LaunchPad] Checkout return: empty license_key after split");
      return;
    }
    var email = parsed.searchParams.get('email');

    // [L1] Both writes go through the serial queue, inside ONE job, on ONE fresh
    // in-queue snapshot. Three things about this shape are deliberate:
    //
    // 1. THE TWO-WRITE SHAPE IS LOAD-BEARING — kept, not collapsed. The first
    //    save persists the license key BEFORE the Dodo round-trip, which is what
    //    makes the tab-close-unconditionally contract above safe: if the network
    //    call fails, hangs, or the worker dies mid-flight, the key is already on
    //    disk and the user still has the Pro Settings retry path. Collapsing to a
    //    single trailing write would silently delete that guarantee on exactly
    //    the failure it protects against.
    // 2. THE NETWORK CALL STAYS INSIDE THE JOB. This mirrors revalidateLicenseBg
    //    (above), the existing precedent for this same ensureValidated call,
    //    which already holds the queue across the Dodo request — and does so on
    //    startup, where queue contention is at its worst. The alternative (queue
    //    the two writes separately and run the network call between them on a
    //    scratch snapshot) would require merging ensureValidated's mutations back
    //    into a fresh object field by field. ensureValidated mutates five
    //    data.pro fields today; an enumerated merge would silently drop any field
    //    added later, on the license-activation path. A briefly-held queue is the
    //    cheaper failure mode than a merge that rots, especially for a one-shot
    //    post-purchase event.
    // 3. NO MERGE, SO NO DRIFT. One snapshot in, both writes out, byte-identical
    //    ordering and payloads to the pre-fix code — only the serialization is new.
    //
    // Known pre-existing property, unchanged here and NOT introduced by this fix:
    // LicenseClient's fetch carries no timeout, so a hung Dodo request holds the
    // queue until the worker is torn down. That is equally true of
    // revalidateLicenseBg today; worth its own task, out of scope for an L1 fix.
    await enqueueBgData("checkout-return", async function () {
      var data = await Storage.getAll();
      if (!data.pro || typeof data.pro !== 'object') data.pro = {};
      data.pro.licenseKey = firstKey;
      if (email) data.pro.email = email;
      await Storage.saveAll(data);

      var result = await LicenseClient.ensureValidated(data, firstKey);
      await Storage.saveAll(data);

      if (result && result.ok) {
        console.log("[LaunchPad] Checkout return: license activated/validated", result.status || "(cached)");
      } else {
        console.warn("[LaunchPad] Checkout return: ensureValidated failed", result && result.stage, result && result.error, result && result.message);
      }
    });
  } catch (err) {
    console.error("[LaunchPad] Checkout return handler failed:", err);
  } finally {
    try {
      await chrome.tabs.remove(tabId);
    } catch (closeErr) {
      console.warn("[LaunchPad] Checkout return: tab close failed", closeErr && closeErr.message);
    }
  }
}

// ===== [1.0.25] Focus-time tracking engine =====
//
// Listener inventory (BUGS.md I1) — what this section adds to background.js:
// four Chrome event listeners plus one storage watcher, and NO alarms. The
// write-per-event architecture (7ff8af8) makes an alarm flush both unnecessary
// and unviable (30s minimum interval), so the alarm dispatch above is untouched
// and 'save-session' / pro-reconcile / 'recurring-sweep' / 'trash-purge' cannot
// collide with anything here.
//
// This file now has three chrome.tabs.onUpdated listeners — checkout-return,
// favicon refresh, and the tracking one below. Each filters on its own
// changeInfo condition and they do not interact; Chrome fans the event out to
// all three.
//
// Every listener funnels into the single stateless Tracking.sync(), which
// re-derives the focused tab and the gates from scratch. Nothing is threaded
// through from the event payload, so no handler carries state the SW could lose
// to a suspend. The engine logic lives in tracking.js — this is only wiring.

chrome.tabs.onActivated.addListener(function () {
  Tracking.sync("tab-switch");
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  // URL commits on the active tab only. sync() re-reads the tab itself, so a
  // same-domain commit resolves to the same session and merely refreshes the
  // last-known-event stamp; only a cross-domain commit is a real boundary.
  if (!changeInfo.url) return;
  if (!tab || tab.active !== true) return;
  Tracking.sync("domain-change");
});

chrome.windows.onFocusChanged.addListener(function () {
  // Includes WINDOW_ID_NONE (every Chrome window blurred), which resolves to
  // "no focused window" inside sync and closes the open session (D2).
  Tracking.sync("window-focus");
});

chrome.idle.onStateChanged.addListener(function (newState) {
  // Passed as a hint so sync skips a redundant queryState. Idle NEVER writes
  // the manual-pause flag — returning to the keyboard does not resume a
  // manually paused user (spec).
  Tracking.sync("idle", newState);
  // [1.0.17 idle deduct] Additionally maintain the ACTIVE counter's idle
  // accounting. Deliberately AFTER Tracking.sync and deliberately not awaited
  // by it: the engine's behaviour on this event must be bit-for-bit what it was
  // before. The two are independent — sync closes/opens the engine session,
  // this only accrues display-only fields the engine never reads.
  idleStateBg(newState);
});

// [1.0.17 idle deduct] Stateless handler, mirroring anchorBrowserSessionBg:
// read storage, call the shared setter (which no-op guards and saveAll's
// internally), done. "locked" counts as idle — a locked screen is the strongest
// possible evidence the user is not present.
function idleStateBg(newState) {
  // Enqueued for the same reason as the anchor: setIdleState is a getAll ->
  // mutate -> saveAll cycle on the `data` blob, and an idle transition landing
  // alongside a startup anchor/sweep would otherwise clobber or be clobbered.
  return enqueueBgData("idle-state", async function () {
    const data = await Storage.getAll();
    await Storage.setIdleState(data, newState !== "active");
  });
}

chrome.storage.onChanged.addListener(function (changes, areaName) {
  // D3: workspace switches, per-workspace trackingEnabled toggles, the manual
  // pause flag and the active task all live in `data` and are all written by
  // the newtab UI rather than the SW. Watching `data` is how the engine sees
  // them without polling.
  //
  // Scoped to `data` deliberately: the engine's own writes land in
  // tracking_sessions, so ignoring every other key is exactly what stops this
  // from feeding back on itself.
  if (areaName !== "local") return;
  if (!changes.data) return;
  Tracking.sync("state-change");
});

// Refresh stored favicon when user visits a bookmarked site.
//
// [L1] Enqueued. This is the highest-frequency background `data` writer in the
// file — it rides chrome.tabs.onUpdated, so it fires on every completed
// navigation — and it is the one the [1.2.0] Focus Blocking intercept will share
// a fan-out with. Two independent getAll -> mutate -> saveAll cycles from a
// single browser event is the exact clobber shape b72b0a6 fixed for onStartup.
//
// Everything that does NOT need `data` is computed BEFORE the queue (the cheap
// URL parse); the read/mutate/write cycle is the only thing inside it. There is
// no network work to hoist out here — contrary to how this handler reads at a
// glance, it never fetches or decodes an icon. `tab.favIconUrl` arrives on the
// event already, and the whole body is string comparison over the bookmark tree.
//
// The `updated` guard is evaluated against the FRESH in-queue snapshot, never a
// pre-queue one: reusing a snapshot read before the queue would reintroduce the
// clobber this fix exists to remove (BUGS.md L1).
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (changeInfo.status !== "complete" || !tab.favIconUrl || !tab.url) return;
  if (tab.favIconUrl.startsWith("chrome://")) return;

  // From the event payload, not from storage — safe to capture before queueing.
  var favIconUrl = tab.favIconUrl;
  var tabDomain;
  try { tabDomain = new URL(tab.url).hostname; } catch (e) { return; }

  return enqueueBgData("favicon-refresh", async function () {
  try {
    var data = await Storage.getAll();
    if (!data || !Array.isArray(data.workspaces)) return;

    var updated = false;
    data.workspaces.forEach(function (ws) {
      (ws.groups || []).forEach(function (group) {
        (group.shortcuts || []).forEach(function (shortcut) {
          try {
            if (new URL(shortcut.url).hostname === tabDomain) {
              if (favIconUrl !== shortcut.favicon && !(shortcut.favicon && shortcut.favicon.startsWith("data:"))) {
                shortcut.favicon = favIconUrl;
                updated = true;
              }
            }
          } catch (e) {}
          if (shortcut.variants) {
            shortcut.variants.forEach(function (v) {
              try {
                if (new URL(v.url).hostname === tabDomain) {
                  if (favIconUrl !== v.favicon && !(v.favicon && v.favicon.startsWith("data:"))) {
                    v.favicon = favIconUrl;
                    updated = true;
                  }
                }
              } catch (e) {}
            });
          }
        });
      });
    });

    if (updated) {
      await Storage.saveAll(data);
    }
  } catch (err) {
    console.error("[LaunchPad] Failed to refresh favicon from tab:", err);
  }
  });
});

// ===========================================================================
// [1.2.0 R2] Focus blocking — the intercept (PLAN C1/C7-consume/C8-writes/C10)
//
// FOURTH chrome.tabs.onUpdated listener, top-level with a stable reference like
// its three siblings (checkout-return, tracking, favicon refresh), so Chrome
// dedupes it across service-worker wakes.
//
// HOT-PATH BUDGET IS THE DESIGN CONSTRAINT. MEASUREMENTS put the headroom to
// first-flash at ~20-120ms: commit-to-redirect measured ~232ms worst case
// against a first observed flash at ~250-350ms. Everything here is arranged to
// spend as little as possible before tabs.update:
//   - every bail that does NOT need storage happens first, synchronously
//   - exactly ONE chrome.storage.local.get, then a pure decision chain
//   - the decision writes NOTHING; the counter is queued AFTER the redirect
// Do not add awaits to this path.
// ===========================================================================
var FOCUS_GATE_PAGE = "gate.html";

// Hosts that must never be intercepted whatever the block list says.
// mylaunchpad.me carries the checkout-return flow (the cross-repo coupling in
// CLAUDE.md — it broke once already, 07f979e); live.dodopayments.com is the
// billing origin. Subdomains included.
var FOCUS_NEVER_HOSTS = ["mylaunchpad.me", "live.dodopayments.com"];

// Mirrors newtab.js's isProAccessibleLevel. Duplicated deliberately: that
// helper lives in the page and is not exported from pro-access.js, and a
// one-line predicate is a better trade than widening ProAccess's surface for
// the hot path. Keep the two in step.
function focusProActive(data) {
  var level = ProAccess.getProAccessLevel(data);
  return level === "active" || level === "trialing" || level === "grace";
}

// SCHEME ALLOWLIST, not a blocklist. Only http(s) is ever intercepted, which
// covers every entry the audit enumerated — chrome-extension:// (any id,
// including our own gate page and newtab), chrome://, chrome-untrusted://,
// about:*, devtools://, view-source:, file:// — in ONE comparison, and fails
// closed for any scheme invented later. Cheaper and strictly safer than
// enumerating the exclusions.
function focusInterceptCandidateHost(rawUrl) {
  if (!rawUrl) return null;
  if (rawUrl.lastIndexOf("http://", 0) !== 0 && rawUrl.lastIndexOf("https://", 0) !== 0) return null;
  var host;
  try { host = new URL(rawUrl).hostname; } catch (e) { return null; }
  if (!host) return null;
  for (var i = 0; i < FOCUS_NEVER_HOSTS.length; i++) {
    var h = FOCUS_NEVER_HOSTS[i];
    if (host === h) return null;
    if (host.length > h.length && host.slice(-(h.length + 1)) === "." + h) return null;
  }
  return host;
}

// PURE decision over one snapshot. Exposed on self for the harness; the
// listener below is only wiring. Returns the matched block-list entry when the
// navigation should be gated, or null.
function focusInterceptDecision(data, host) {
  if (!data || !host) return null;
  if (!focusProActive(data)) return null;                                     // C10
  if (!Storage.focusBlockingActive(data)) return null;                        // C2
  var entry = Storage.matchesBlockedDomain(host, Storage.getBlockList(data)); // C3
  if (!entry) return null;
  if (Storage.getActiveFocusSnooze(data, entry)) return null;                 // C7
  return entry;
}
self.focusInterceptDecision = focusInterceptDecision;
self.focusInterceptCandidateHost = focusInterceptCandidateHost;

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (!changeInfo.url) return;
  var host = focusInterceptCandidateHost(changeInfo.url);
  if (!host) return;

  chrome.storage.local.get("data").then(function (got) {
    var data = got && got.data;
    var entry = focusInterceptDecision(data, host);
    if (!entry) return;

    // STATELESS AGAINST STORAGE, which is what makes the SPA case correct: a
    // same-document route change re-fires changeInfo.url (proven in the
    // MEASUREMENTS probe-3), re-runs this same decision, and a live snooze
    // keeps returning null until it expires. Nothing remembers "already allowed
    // this one", so nothing can get out of step.
    var gate = chrome.runtime.getURL(FOCUS_GATE_PAGE) +
      "?to=" + encodeURIComponent(changeInfo.url) +
      "&entry=" + encodeURIComponent(entry);
    chrome.tabs.update(tabId, { url: gate });

    // C8: counted AFTER the redirect is issued. Queued per BUGS.md L1 (this is
    // an SW-context `data` writer) and deliberately not awaited — the user is
    // already on their way to the gate and a counter must never sit in front of
    // the navigation.
    enqueueBgData("focus-blocked-count", async function () {
      var fresh = await Storage.getAll();
      await Storage.incrementFocusStat(fresh, "blocked");
    });
  }).catch(function (err) {
    console.error("[LaunchPad] Focus blocking: intercept failed", err);
  });
});

// ===== [1.2.0 R2] Gate page <-> worker channel =====
//
// gate.js runs in a PAGE context, so its writes would race the intercept's own
// counter writes. Rather than invent a second queue, the page asks the worker to
// perform them and they land in the SAME enqueueBgData FIFO as every other
// background `data` writer (BUGS.md L1). The page awaits the reply, so the write
// is durable before it navigates — which is what stops the intercept from
// immediately re-gating the arrival.
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || typeof msg.type !== "string" || msg.type.indexOf("focus-gate-") !== 0) return;

  if (msg.type === "focus-gate-state") {
    // Read-only: everything the gate needs to render, computed where storage.js
    // already lives so the gate page does not have to load it.
    Storage.getAll().then(function (data) {
      var active = Storage.getActiveTask(data);
      var ps = active ? Storage.hydratePomodoroState(active.pomodoroState) : null;
      var running = !!(ps && ps.phase === "work" && !Storage.isTrackingPaused(data));
      var elapsedMs = 0;
      if (running && ps.phaseDurationMs != null && ps.phaseEndsAt != null) {
        elapsedMs = Math.max(0, ps.phaseDurationMs - (ps.phaseEndsAt - Date.now()));
      }
      var task = null;
      var resolved = Storage.resolveActiveTask(data);
      if (resolved && !resolved.stale && resolved.task) task = resolved.task.name;
      sendResponse({
        ok: true,
        phaseRunning: running,
        manualArmed: Storage.isFocusManuallyArmed(data),
        elapsedMs: elapsedMs,
        taskName: task
      });
    }).catch(function () { sendResponse({ ok: false }); });
    return true;
  }

  if (msg.type === "focus-gate-snooze") {
    enqueueBgData("focus-gate-snooze", async function () {
      var data = await Storage.getAll();
      // Both mutate the SAME in-job snapshot and each owns its saveAll, so the
      // trailing write persists both. Two storage writes rather than one is the
      // price of reusing the setters; hand-rolling a single write here would
      // duplicate their guards, which is the worse trade. Not on the hot path.
      await Storage.setFocusSnooze(data, msg.entry, Date.now() + Storage.FOCUS_SNOOZE_MS);
      await Storage.incrementFocusStat(data, "snoozed");
    }).then(function () { sendResponse({ ok: true }); });
    return true;
  }

  if (msg.type === "focus-gate-end") {
    enqueueBgData("focus-gate-end", async function () {
      var data = await Storage.getAll();
      // C6: decided from FRESH state, not from what the page rendered. Another
      // tab may have ended the session since the gate loaded; then there is
      // nothing to end and navigating back is already correct.
      var active = Storage.getActiveTask(data);
      var ps = active ? Storage.hydratePomodoroState(active.pomodoroState) : null;
      if (ps && ps.phase) { await Storage.stopPomodoro(data); return "session"; }
      if (Storage.isFocusManuallyArmed(data)) { await Storage.setFocusArmed(data, false); return "manual"; }
      return "none";
    }).then(function (what) { sendResponse({ ok: true, ended: what }); });
    return true;
  }
});
