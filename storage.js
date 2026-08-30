/* global chrome, ProAccess */

var Storage = (function () {
  "use strict";

  // [1.0.11.2] Write-provenance: same-page storage writes tag themselves so the
  // newtab onChanged listener can skip its full render() for our OWN writes
  // (the user action that triggered the write already updated the DOM
  // optimistically; re-rendering wipes DOM-only state like sidebar expansion).
  // TAB_INSTANCE_ID identifies this page; _pendingWriteIds holds writeIds we
  // emitted but the listener has not yet acknowledged. Listener compares both,
  // and only writes that match THIS tab AND a known writeId are suppressed.
  // See newtab.js chrome.storage.onChanged for the gate.
  var TAB_INSTANCE_ID = (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  var _pendingWriteIds = new Set();

  function genWriteId() {
    return (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  }

  // [1.0.25] Per-workspace tracking state. Shipped as an unused `{}` placeholder;
  // repurposed here to carry the trackingEnabled flag (PLAN AMENDMENT A2).
  // Default ON for every workspace including Main, per the spec's Workspace
  // Scoping section. Session RECORDS do not live here — they live in the flat
  // top-level `tracking_sessions` key, outside `data`, so that write-per-event
  // capture never triggers the newtab re-render / context-menu rebuild that any
  // `data` write fires. See tracking.js.
  function emptyTrackingState() {
    return { enabled: true };
  }

  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function getDefaultData() {
    return {
      workspaces: [{
        id: "main",
        name: "Main",
        createdAt: Date.now(),
        isReadOnly: false,
        groupOrder: ["ungrouped"],
        groups: [{ id: "ungrouped", name: "Ungrouped", shortcuts: [], deletedAt: null }],
        goals: [],
        tasks: [],
        tags: [],
        notes: [],
        namedSessions: [],
        tracking: emptyTrackingState()
      }],
      workspaceOrder: ["main"],
      activeWorkspaceId: "main",
      // [1.0.25] Global manual-pause gate for tracking. Flag ships now, UI in
      // [1.0.17] — the data model is complete from day one even where the
      // surface lands later (same discipline as the task stub fields below).
      trackingPaused: false,
      // [1.0.20] endOfDayMinutes — minutes since LOCAL midnight at which the
      // Dashboard flips from the Start-of-Day card to the evening card. 1020 =
      // 17:00. The key ships now, its picker UI later ([1.0.3] Pro Settings did
      // not ship a time control) — same ship-the-data-model-first discipline as
      // trackingPaused above. It governs CARD SELECTION ONLY; every figure the
      // Dashboard reports stays local-midnight-based, because the tracking
      // engine's day aggregates are pre-split at local midnight (D4).
      settings: { columns: 6, collapsedGroups: {}, combinedAnalyticsEnabled: false, endOfDayMinutes: 1020, pomodoro: { workMin: 25, shortBreakMin: 5, longBreakMin: 15, cyclesBeforeLongBreak: 4, notificationsEnabled: false, sound: "none" }, focus: { autoArmDuringWork: true } },
      // [1.2.0 C2/C4/C7/C8] Focus blocking. All four ship in the default shape
      // even though only the settings + list have UI this round — the same
      // ship-the-data-model-first discipline as trackingPaused and
      // endOfDayMinutes above. focusArmed is the MANUAL arm (top-level so it
      // survives a task switch); the derivation lives in focusBlockingActive.
      focusArmed: false,
      blockList: [],
      focusSnoozes: {},
      focusStats: emptyFocusStats(),
      pro: {
        licenseKey: null,
        instanceId: null,
        instanceName: null,
        email: null,
        trialStartedAt: null,
        trialEndedAt: null,
        subscriptionStatus: "free",
        lastVerifiedAt: null
      },
      // [1.0.23] Achievements record. Ships in the default shape (seeded:false)
      // so a fresh install's first Pro day-opened runs the retro pass over an
      // empty world (seeds 0, earns nothing). EXISTING installs never see this
      // default — migrate() is a no-op for workspace-shaped data — so the real
      // backfill is ensureAchievements at read (the getEndOfDayMinutes lesson).
      achievements: emptyAchievements(),
      gettingStarted: emptyGettingStarted()   // [R3] free-tier checklist
    };
  }

  function ensureDeletedAtFields(data) {
    var changed = false;
    (data.workspaces || []).forEach(function (ws) {
      (ws.groups || []).forEach(function (g) {
        if (!Object.prototype.hasOwnProperty.call(g, "deletedAt")) { g.deletedAt = null; changed = true; }
        (g.shortcuts || []).forEach(function (s) {
          if (!Object.prototype.hasOwnProperty.call(s, "deletedAt")) { s.deletedAt = null; changed = true; }
          if (s.variants) {
            s.variants.forEach(function (v) {
              if (!Object.prototype.hasOwnProperty.call(v, "deletedAt")) { v.deletedAt = null; changed = true; }
            });
          }
        });
      });
    });
    return changed;
  }

  // [1.0.25] Seed tracking state onto workspaces that predate it, and onto the
  // ones carrying the old empty-object placeholder. Runs on the already-migrated
  // path of getAll alongside ensureDeletedAtFields — same defensive-backfill
  // shape. Absent or malformed state defaults to ON, matching getDefaultData.
  function ensureTrackingState(data) {
    var changed = false;
    (data.workspaces || []).forEach(function (ws) {
      if (!ws.tracking || typeof ws.tracking !== "object") {
        ws.tracking = emptyTrackingState();
        changed = true;
      } else if (typeof ws.tracking.enabled !== "boolean") {
        ws.tracking.enabled = true;
        changed = true;
      }
    });
    if (typeof data.trackingPaused !== "boolean") {
      data.trackingPaused = false;
      changed = true;
    }
    return changed;
  }

  // [1.1.0] Seed the notes array onto workspaces that predate it. Runs on the
  // already-migrated path of getAll alongside ensureDeletedAtFields and
  // ensureTrackingState, in the same defensive-backfill shape: report whether
  // anything changed, let getAll do the single write.
  //
  // IDEMPOTENT BY CONSTRUCTION, which is the property this task is really about:
  // it only assigns when the field is not already an array, so a workspace that
  // already carries notes is untouched and re-running can neither wipe existing
  // notes nor append a second array. That is also why it does NOT normalise the
  // contents - touching live note objects on every load would be a write loop
  // against the service worker's storage.onChanged watcher.
  // [1.4.0] Same shape as ensureNotesArrays below: assign ONLY when the field is
  // not already an array, so re-running can neither wipe nor duplicate, and never
  // normalise the sessions themselves (touching live objects on every load would
  // be a write loop against the service worker's storage watcher).
  function ensureNamedSessionsArrays(data) {
    var changed = false;
    (data.workspaces || []).forEach(function (ws) {
      if (!Array.isArray(ws.namedSessions)) {
        ws.namedSessions = [];
        changed = true;
      }
    });
    return changed;
  }

  function ensureNotesArrays(data) {
    var changed = false;
    (data.workspaces || []).forEach(function (ws) {
      if (!Array.isArray(ws.notes)) {
        ws.notes = [];
        changed = true;
      }
    });
    return changed;
  }

  // [1.0.25] Read-side gate helper. Defaults to ON when state is missing so a
  // workspace that somehow escaped the seed still captures.
  function isTrackingEnabled(workspace) {
    if (!workspace) return false;
    if (!workspace.tracking || typeof workspace.tracking !== "object") return true;
    return workspace.tracking.enabled !== false;
  }

  // [1.0.25] Mutate-only, per the established convention: the caller owns the
  // saveAll (see BUGS.md J5 — Storage is stateless-by-argument).
  function setTrackingEnabled(data, workspaceId, enabled) {
    if (!data || !Array.isArray(data.workspaces)) return false;
    var ws = data.workspaces.find(function (w) { return w.id === workspaceId; });
    if (!ws) return false;
    if (!ws.tracking || typeof ws.tracking !== "object") ws.tracking = emptyTrackingState();
    ws.tracking.enabled = !!enabled;
    return true;
  }

  // [1.0.25] Global manual-pause flag — top-level, NOT per-workspace (PLAN
  // AMENDMENT A2). Idle transitions must never write this: the spec is explicit
  // that a user who manually paused stays paused even after returning to the
  // keyboard.
  function isTrackingPaused(data) {
    return !!(data && data.trackingPaused === true);
  }

  // [1.0.20] The Dashboard's end-of-day boundary, minutes since LOCAL midnight.
  //
  // Defaults at READ time rather than relying on the migration alone. migrate()
  // only runs for pre-workspaces data, so every already-migrated install has a
  // settings bag with no endOfDayMinutes in it — exactly the population that
  // must not get NaN. Same defaulting-reader shape as isTrackingEnabled, and
  // for the same reason: absence means "never configured", not "zero".
  //
  // Range is clamped to a real clock day. 1440 is admitted (means "never flip
  // to evening"); a value at or below the 04:00 floor is admitted too and
  // simply yields an all-evening day, which is coherent.
  var DEFAULT_END_OF_DAY_MINUTES = 1020; // 17:00

  function getEndOfDayMinutes(data) {
    var v = data && data.settings && data.settings.endOfDayMinutes;
    if (typeof v !== "number" || !isFinite(v)) return DEFAULT_END_OF_DAY_MINUTES;
    if (v < 0 || v > 1440) return DEFAULT_END_OF_DAY_MINUTES;
    return Math.floor(v);
  }

  // ===== [2.0] Text size =====
  //
  // A FREE accessibility setting — never Pro-gated, in any branch. Three tiers,
  // applied page-side as a root class exactly the way Icon Size is.
  //
  // Reader/setter live HERE rather than as a bare `data.settings.textSize ||
  // "medium"` at each call site (which is what Icon Size does) for one reason:
  // coercion has to be provable. A page-side `||` is unreachable from a Node VM,
  // and this setting's whole contract is that an install which has never touched
  // it reads "medium" and a corrupted value never reaches the DOM as a class
  // name. Icon Size's own idiom is left exactly as it shipped — this round does
  // not refactor working free-tier code on the way to the store.
  //
  // MIGRATION IS THE DEFAULT. Absence means "never configured", so every
  // existing install reads "medium" and gets the bump. That IS the intended
  // product change; a user who wants today's density picks Small.
  var TEXT_SIZES = ["small", "medium", "large"];
  var DEFAULT_TEXT_SIZE = "medium";

  function getTextSize(data) {
    var v = data && data.settings && data.settings.textSize;
    return TEXT_SIZES.indexOf(v) === -1 ? DEFAULT_TEXT_SIZE : v;
  }

  async function setTextSize(data, val) {
    if (!data || !data.settings) return false;
    // An unrecognised value is NOT written. The alternative — storing it and
    // letting the reader coerce — leaves a junk value in the user's backup that
    // reads as a setting they chose.
    if (TEXT_SIZES.indexOf(val) === -1) return false;
    if (getTextSize(data) === val && data.settings.textSize === val) return false;
    data.settings.textSize = val;
    await saveAll(data);
    return true;
  }

  // ===== Pomodoro settings ([1.0.18]) =====
  //
  // Four durations under data.settings.pomodoro, following the endOfDayMinutes
  // discipline: DEFAULT AT READ TIME (getPomodoroSettings), so an already-
  // migrated install with no pomodoro bag reads defaults rather than NaN, and a
  // legacy/partial object hydrates field-by-field. Per-field setters only (no
  // partial-object merge) — each clamps + coerces to its range, no-op guards,
  // and flows through saveAll like the other per-field settings writers.
  var POMODORO_DEFAULTS = { workMin: 25, shortBreakMin: 5, longBreakMin: 15, cyclesBeforeLongBreak: 4 };
  var POMODORO_RANGES = { workMin: [5, 60], shortBreakMin: [1, 30], longBreakMin: [5, 60], cyclesBeforeLongBreak: [2, 10] };

  // Coerce to an integer and clamp to the field's range; any non-finite input
  // (missing, null, "", "abc") degrades to the field default. The single clamp
  // used by BOTH the reader and every setter, so a stored value and a freshly-
  // typed value are validated identically (999 -> 60, "" -> default).
  function clampPomodoroField(field, val) {
    var def = POMODORO_DEFAULTS[field];
    var rng = POMODORO_RANGES[field];
    var n = Math.floor(Number(val));
    if (!isFinite(n)) return def;
    if (n < rng[0]) return rng[0];
    if (n > rng[1]) return rng[1];
    return n;
  }

  // [1.0.18 B-2] Boundary chime ids. An ENUM, so neither the numeric clamp nor
  // the boolean coercion above fits: whitelist-coerce to a known id and degrade
  // EVERYTHING else — missing, null, 3, "chime9", an object — to 'none'. 'none'
  // being both the default and the failure mode is deliberate: an unrecognised
  // stored value must never leave a user hearing a chime they cannot see
  // selected in settings (and never a 404'd <audio> src).
  var POMODORO_SOUND_IDS = ["none", "chime1", "chime2", "chime3"];

  function coercePomodoroSound(val) {
    return POMODORO_SOUND_IDS.indexOf(val) === -1 ? "none" : val;
  }

  // Resolve a chime id to its packaged asset path, or null for 'none'/invalid.
  // Extension-relative (callers wrap it in chrome.runtime.getURL) so the page,
  // the offscreen document and the service worker all name the file one way.
  function pomodoroSoundFile(sound) {
    var id = coercePomodoroSound(sound);
    return id === "none" ? null : "sounds/" + id + ".wav";
  }

  // [1.0.18 B-2] PURE (harnessed): WHICH context should play the boundary chime.
  //
  // The one-cue principle from B-1's notifications, applied to audio: exactly one
  // context plays per boundary, never two. That falls out of reconcilePomodoro's
  // fresh re-read guard — only the caller that actually PERFORMED the transition
  // ever sees 'advanced'/'completed'; a losing tab gets {action:'none', raced}.
  // So "who plays" is simply "who transitioned", and this function only routes
  // that winner's playback to a context that can actually produce sound:
  //
  //   page transition            -> 'page'          (play right here)
  //   SW transition, tab open    -> 'page-message'  (borrow an open newtab)
  //   SW transition, no tab      -> 'offscreen'     (a worker cannot play audio)
  //
  // Returns 'none' for every non-boundary action — crucially 'expired', which
  // stays SILENT by D3/B1 design (an unattended timeout is not an achievement),
  // and 'none'/raced, where another context already cued the user.
  function pomodoroSoundTarget(input) {
    var i = input || {};
    if (i.action !== "advanced" && i.action !== "completed") return "none";
    if (coercePomodoroSound(i.sound) === "none") return "none";
    if (i.context === "page") return "page";
    if (i.context === "sw") return i.tabOpen ? "page-message" : "offscreen";
    return "none";
  }

  // Defaulting reader: always returns a complete, in-range object regardless of
  // what (if anything) is stored. Pure — no mutation, no saveAll.
  function getPomodoroSettings(data) {
    var p = (data && data.settings && data.settings.pomodoro) || {};
    return {
      workMin: clampPomodoroField("workMin", p.workMin),
      shortBreakMin: clampPomodoroField("shortBreakMin", p.shortBreakMin),
      longBreakMin: clampPomodoroField("longBreakMin", p.longBreakMin),
      cyclesBeforeLongBreak: clampPomodoroField("cyclesBeforeLongBreak", p.cyclesBeforeLongBreak),
      // [1.0.18 B-1] Desktop-notifications opt-in. Boolean (not a clamped numeric),
      // so it defaults at read time to false and coerces strictly — anything but a
      // literal `true` reads false. This is the fork that authorizes the SW to
      // advance phases in the background (background.js).
      notificationsEnabled: (p.notificationsEnabled === true),
      // [1.0.18 B-2] Boundary chime selection. Read-time default 'none' — silence
      // is opt-OUT-by-default, matching notifications.
      sound: coercePomodoroSound(p.sound)
    };
  }

  // Private per-field writer: clamp, ensure the bag exists, no-op guard, saveAll.
  // Exposed ONLY through the four named wrappers below, so each public updater
  // touches exactly one field (no generic partial-object update surface).
  async function setPomodoroField(data, field, val) {
    if (!data || !data.settings) return false;
    var next = clampPomodoroField(field, val);
    if (!data.settings.pomodoro || typeof data.settings.pomodoro !== "object") data.settings.pomodoro = {};
    if (data.settings.pomodoro[field] === next) return false;
    data.settings.pomodoro[field] = next;
    await saveAll(data);
    return true;
  }

  function setPomodoroWorkMin(data, val) { return setPomodoroField(data, "workMin", val); }
  function setPomodoroShortBreakMin(data, val) { return setPomodoroField(data, "shortBreakMin", val); }
  function setPomodoroLongBreakMin(data, val) { return setPomodoroField(data, "longBreakMin", val); }
  function setPomodoroCyclesBeforeLongBreak(data, val) { return setPomodoroField(data, "cyclesBeforeLongBreak", val); }

  // [1.0.18 B-1] Boolean sibling of the numeric per-field writers — separate path
  // because clampPomodoroField coerces to an integer range. Strict-coerce to a
  // boolean, ensure the bag, no-op guard, saveAll. Read-time default is false
  // (getPomodoroSettings). The permission itself is requested/held separately in
  // the page (B5); this flag is only the user's intent.
  async function setPomodoroNotificationsEnabled(data, val) {
    if (!data || !data.settings) return false;
    var next = (val === true);
    if (!data.settings.pomodoro || typeof data.settings.pomodoro !== "object") data.settings.pomodoro = {};
    if (data.settings.pomodoro.notificationsEnabled === next) return false;
    data.settings.pomodoro.notificationsEnabled = next;
    await saveAll(data);
    return true;
  }

  // [1.0.18 B-2] Enum sibling of the writers above — third coercion shape (not a
  // clamped integer, not a strict boolean), so it gets its own path for the same
  // reason the boolean did. Whitelist-coerce, ensure the bag, no-op guard,
  // saveAll. Unlike notifications this needs NO permission: the chime is played
  // from a page or an offscreen document we already own.
  async function setPomodoroSound(data, val) {
    if (!data || !data.settings) return false;
    var next = coercePomodoroSound(val);
    if (!data.settings.pomodoro || typeof data.settings.pomodoro !== "object") data.settings.pomodoro = {};
    if (data.settings.pomodoro.sound === next) return false;
    data.settings.pomodoro.sound = next;
    await saveAll(data);
    return true;
  }

  // ===== [1.2.0] Focus blocking — R1 storage foundations =====
  //
  // PLAN C2/C3/C4/C7/C8 (task 1216776953648220, 2026-08-09). Page-side storage
  // only this round: no intercept, no service-worker code, no gate page (R2).
  //
  // NAMING, deliberately disambiguated from the PLAN's prose: the PLAN used
  // "isFocusArmed" for BOTH the stored flag and the derivation. They are split
  // here because they answer different questions and R2 needs both —
  //   isFocusManuallyArmed(data)  reads the raw data.focusArmed flag
  //   focusBlockingActive(data)   the pure derivation the intercept evaluates

  // C2 — manual arm. Top-level flag, the data.trackingPaused idiom exactly
  // (default in getDefaultData, backfill in ensureFocusBlockingState, defaulting
  // reader here). Top-level rather than on activeTask.pomodoroState BECAUSE it
  // must survive a task switch: pomodoroState is deliberately dropped by every
  // clear path (switch / complete / cancel / self-heal), which is right for a
  // phase and wrong for an arm the user set by hand.
  function isFocusManuallyArmed(data) {
    return !!(data && data.focusArmed === true);
  }

  async function setFocusArmed(data, armed) {
    if (!data) return false;
    var next = !!armed;
    if (data.focusArmed === next) return false;   // no-op guard: no redundant write
    data.focusArmed = next;
    await saveAll(data);
    return true;
  }

  // C2 — auto-arm preference. Pomodoro-settings idiom: read-time defaulting, so
  // an already-migrated install with no focus bag reads the default rather than
  // undefined (the getEndOfDayMinutes lesson). DEFAULT TRUE — F1=b's promise is
  // that a focus session arms blocking, so that is the out-of-box behaviour.
  var FOCUS_DEFAULTS = { autoArmDuringWork: true };

  function getFocusSettings(data) {
    var f = (data && data.settings && data.settings.focus) || {};
    return {
      autoArmDuringWork: (typeof f.autoArmDuringWork === "boolean")
        ? f.autoArmDuringWork
        : FOCUS_DEFAULTS.autoArmDuringWork
    };
  }

  async function setFocusAutoArm(data, val) {
    if (!data) return false;
    var next = !!val;
    if (!data.settings || typeof data.settings !== "object") data.settings = {};
    if (!data.settings.focus || typeof data.settings.focus !== "object") data.settings.focus = {};
    if (data.settings.focus.autoArmDuringWork === next) return false;
    data.settings.focus.autoArmDuringWork = next;
    await saveAll(data);
    return true;
  }

  // C2 — THE DERIVATION. Pure, in the desiredPomodoroAlarmWhen mould: no arming
  // events, no stored "armed because a phase is running" flag to keep in sync.
  // R2's intercept evaluates this inside the single storage read it already does.
  //
  //   active = manualArm OR (autoArmPref AND a WORK phase is running AND not paused)
  //
  // The phase term is 'work' ONLY — a break must never block, which is the whole
  // point of E1's asymmetry. trackingPaused gates it for the same reason
  // desiredPomodoroAlarmWhen returns null while paused: a frozen phase is not a
  // running one. Consent is inherited rather than re-checked: E1 guarantees every
  // work phase starts from an explicit user gesture, so auto-arm can never engage
  // without one.
  function focusBlockingActive(data) {
    if (!data) return false;
    if (isFocusManuallyArmed(data)) return true;
    if (!getFocusSettings(data).autoArmDuringWork) return false;
    if (isTrackingPaused(data)) return false;
    var active = getActiveTask(data);
    if (!active) return false;
    return hydratePomodoroState(active.pomodoroState).phase === "work";
  }

  // [1.2.0 R3 / C9] Which ROUTE has blocking on, for the pill's state label.
  // Three readings, and the distinction between the last two is the whole point:
  //   "off"    nothing is arming it
  //   "manual" the user armed it by hand (survives the session ending)
  //   "auto"   armed only by a running work phase (ends when the phase does)
  //
  // Derived from focusBlockingActive rather than from the phase directly, which
  // is what keeps it honest: a PAUSED work phase reads "off", because
  // focusBlockingActive is false and nothing is actually being blocked. A naive
  // "a phase is running, so it must be auto" reading would say "auto" while the
  // intercept lets everything through — a label that lies about the feature's
  // current behaviour. Lives here rather than in the page so it is harnessable
  // next to the derivation it wraps; the page owns the wording, storage owns the
  // state.
  function focusArmState(data) {
    if (isFocusManuallyArmed(data)) return "manual";
    return focusBlockingActive(data) ? "auto" : "off";
  }

  // C3 — normalize a user-typed entry to a bare lowercase host. Returns null for
  // anything unusable, so the caller never stores garbage. Accepts a full URL
  // paste, a host:port, a "www." prefix, or a bare host.
  //
  // IDN/PUNYCODE PASSTHROUGH AS TYPED (PLAN C3): no encoding or decoding happens
  // here. "münchen.de" stores as "münchen.de" and "xn--mnchen-3ya.de" stores as
  // itself; a user who types one form matches the form the browser reports. Doing
  // the conversion would need a punycode implementation this file has no business
  // carrying, and getting it half-right is worse than being predictable.
  function normalizeBlockEntry(raw) {
    if (typeof raw !== "string") return null;
    var s = raw.trim().toLowerCase();
    if (!s) return null;
    s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");        // scheme
    s = s.split("/")[0].split("?")[0].split("#")[0];      // path / query / fragment
    var at = s.lastIndexOf("@");
    if (at !== -1) s = s.slice(at + 1);                   // credentials
    s = s.split(":")[0];                                  // port
    if (s.indexOf("www.") === 0) s = s.slice(4);
    if (!s) return null;
    // A usable host: no whitespace, and at least two non-empty labels (so
    // "localhost" and prose are rejected). Hyphen rules are checked PER LABEL,
    // not on the whole string — "bad-.com" is invalid because a LABEL ends in a
    // hyphen, which a whole-string check misses entirely (caught by the harness).
    if (/\s/.test(s)) return null;
    var labels = s.split(".");
    if (labels.length < 2) return null;
    for (var i = 0; i < labels.length; i++) {
      var label = labels[i];
      if (!label) return null;                                    // empty label
      if (label.charAt(0) === "-" || label.charAt(label.length - 1) === "-") return null;
    }
    return s;
  }

  // C3 — suffix match. SUBDOMAINS YES, ALIASES NO: "youtube.com" matches
  // m./www.youtube.com; "docs.google.com" does NOT match sheets.google.com unless
  // listed. No DOMAIN_ALIASES involvement — that table is already duplicated in
  // two files and a third consumer would make it worse.
  //
  // The length check is what stops the lookalike class: "notyoutube.com" does not
  // end with ".youtube.com", and requiring host longer than entry keeps the
  // endsWith test from ever being satisfied by an equal-length string.
  //
  // RETURNS THE MATCHED ENTRY (a string) or null — not a boolean. R2's gate needs
  // to name the blocked domain, and the snooze key is the matched ENTRY rather
  // than the visited host, so returning it here avoids a second pass.
  function matchesBlockedDomain(host, entries) {
    if (typeof host !== "string" || !Array.isArray(entries) || !entries.length) return null;
    var h = host.trim().toLowerCase().split(":")[0];
    if (!h) return null;
    if (h.indexOf("www.") === 0) h = h.slice(4);
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (typeof e !== "string" || !e) continue;
      if (h === e) return e;
      if (h.length > e.length && h.slice(-(e.length + 1)) === "." + e) return e;
    }
    return null;
  }

  // C4 — the block list. Top-level array of normalized hosts (the workspaceOrder
  // precedent: global things take `data` and nothing else, no workspace argument
  // anywhere in the chain). NO SOFT-DELETE, deliberately: this is settings-shaped,
  // not tag-shaped. Removal is final, re-adding is one field, and the list stays
  // outside the trash/purge machinery entirely.
  function ensureBlockList(data) {
    if (!data) return [];
    if (!Array.isArray(data.blockList)) data.blockList = [];
    return data.blockList;
  }

  // Defaulting reader. Returns a COPY so a caller cannot mutate stored state by
  // accident (the list is small; the intercept's cost is the storage read, not this).
  function getBlockList(data) {
    return (data && Array.isArray(data.blockList)) ? data.blockList.slice() : [];
  }

  // Normalize-then-guard. Returns {ok:true, entry} or {ok:false, err, message} —
  // the {err, message} shape the tag CRUD already uses, so the UI can surface the
  // reason inline next to the input rather than as a toast.
  async function addBlockedDomain(data, raw) {
    if (!data) return { ok: false, err: "invalid", message: "Enter a site to block." };
    var entry = normalizeBlockEntry(raw);
    if (!entry) {
      return { ok: false, err: "invalid", message: "That doesn't look like a site — try youtube.com" };
    }
    var list = ensureBlockList(data);
    if (list.indexOf(entry) !== -1) {
      return { ok: false, err: "duplicate", message: entry + " is already on the list" };
    }
    list.push(entry);
    await saveAll(data);
    return { ok: true, entry: entry };
  }

  // Accepts either a raw user string or an already-stored entry. No-op guarded:
  // removing something absent writes nothing.
  async function removeBlockedDomain(data, raw) {
    if (!data) return false;
    var list = ensureBlockList(data);
    var entry = normalizeBlockEntry(raw);
    var i = entry !== null ? list.indexOf(entry) : -1;
    if (i === -1 && typeof raw === "string") i = list.indexOf(raw);   // defensive
    if (i === -1) return false;
    list.splice(i, 1);
    await saveAll(data);
    return true;
  }

  // C7 — per-site snooze. { normalizedEntry: untilTimestamp }. No alarm: expiry
  // only matters at the next navigation, which wakes the worker anyway (measured
  // in this task's MEASUREMENTS comment).
  var FOCUS_SNOOZE_MS = 5 * 60 * 1000;

  function ensureFocusSnoozes(data) {
    if (!data) return {};
    if (!data.focusSnoozes || typeof data.focusSnoozes !== "object" || Array.isArray(data.focusSnoozes)) {
      data.focusSnoozes = {};
    }
    return data.focusSnoozes;
  }

  // Mutate-only; the caller owns the write. Drops expired AND malformed values.
  function pruneExpiredFocusSnoozes(data, nowMs) {
    var now = (typeof nowMs === "number" && isFinite(nowMs)) ? nowMs : Date.now();
    var map = ensureFocusSnoozes(data);
    var removed = 0;
    Object.keys(map).forEach(function (k) {
      var v = map[k];
      if (typeof v !== "number" || !isFinite(v) || v <= now) { delete map[k]; removed++; }
    });
    return removed;
  }

  async function setFocusSnooze(data, domain, untilTs) {
    if (!data) return false;
    var entry = normalizeBlockEntry(domain);
    if (!entry) return false;
    var until = (typeof untilTs === "number" && isFinite(untilTs))
      ? Math.floor(untilTs)
      : (Date.now() + FOCUS_SNOOZE_MS);
    var map = ensureFocusSnoozes(data);
    // Opportunistic prune (C7): stale keys are cleared on the write path, so the
    // hot read path never has to.
    var pruned = pruneExpiredFocusSnoozes(data);
    if (map[entry] === until && !pruned) return false;   // no-op guard
    map[entry] = until;
    await saveAll(data);
    return true;
  }

  // PURE — no prune, no write. R2 calls this on the intercept's hot path, where a
  // write would be indefensible. An expired entry simply reads as null and gets
  // cleared by the next setFocusSnooze.
  //
  // Lookup is EXACT-KEY, not suffix: R2 passes the entry matchesBlockedDomain
  // returned, so snoozing m.youtube.com against a "youtube.com" rule snoozes the
  // rule (all of youtube.com), which is what the gate's copy promises.
  function getActiveFocusSnooze(data, domain, nowMs) {
    if (!data) return null;
    var entry = normalizeBlockEntry(domain);
    if (!entry) return null;
    var map = (data.focusSnoozes && typeof data.focusSnoozes === "object" && !Array.isArray(data.focusSnoozes))
      ? data.focusSnoozes : {};
    var v = map[entry];
    if (typeof v !== "number" || !isFinite(v)) return null;
    var now = (typeof nowMs === "number" && isFinite(nowMs)) ? nowMs : Date.now();
    return v > now ? v : null;
  }

  // C8 — capture-first counters. Versioned record, the ensureAchievements idiom
  // (defaulting AND normalizing at read, because migrate() never runs for an
  // already-migrated install).
  //
  // DELIBERATELY NOT IN THE TRACKING ENGINE (PLAN C8, answering audit A4): the
  // sibling store is workspace-keyed and 30-day-pruned, and this is a global,
  // longer-lived counter. Leaving tracking.js untouched also avoids its
  // ripgrep-invisibility (BUGS.md M1) and CRLF costs for zero benefit.
  //
  // DAY KEY: reuses achDayKey below rather than adding a helper. PLAN C8 allowed a
  // small local one "if none exists"; one does — achDayKey is already a pure local
  // calendar-day key in this file — so the accepted 3-line duplication is not
  // needed and is not taken. There is no coupling to tracking.js either way.
  var FOCUS_STATS_VERSION = 1;
  var FOCUS_STATS_MAX_DAYS = 60;

  function emptyFocusStats() {
    return { version: FOCUS_STATS_VERSION, byDay: {} };
  }

  function ensureFocusStats(data) {
    if (!data) return emptyFocusStats();
    if (!data.focusStats || typeof data.focusStats !== "object" || Array.isArray(data.focusStats)) {
      data.focusStats = emptyFocusStats();
      return data.focusStats;
    }
    var f = data.focusStats;
    if (typeof f.version !== "number" || !isFinite(f.version)) f.version = FOCUS_STATS_VERSION;
    if (!f.byDay || typeof f.byDay !== "object" || Array.isArray(f.byDay)) f.byDay = {};
    Object.keys(f.byDay).forEach(function (k) {
      var b = f.byDay[k];
      if (!b || typeof b !== "object" || Array.isArray(b)) { f.byDay[k] = { blocked: 0, snoozed: 0 }; return; }
      b.blocked = (typeof b.blocked === "number" && isFinite(b.blocked) && b.blocked >= 0) ? Math.floor(b.blocked) : 0;
      b.snoozed = (typeof b.snoozed === "number" && isFinite(b.snoozed) && b.snoozed >= 0) ? Math.floor(b.snoozed) : 0;
    });
    return f;
  }

  // Keep the newest FOCUS_STATS_MAX_DAYS keys. YYYY-MM-DD sorts lexicographically
  // in chronological order, so a plain sort is the chronological one.
  function pruneFocusStatDays(stats) {
    var keys = Object.keys(stats.byDay).sort();
    if (keys.length <= FOCUS_STATS_MAX_DAYS) return 0;
    var drop = keys.slice(0, keys.length - FOCUS_STATS_MAX_DAYS);
    drop.forEach(function (k) { delete stats.byDay[k]; });
    return drop.length;
  }

  // R2 calls this from the SW, inside enqueueBgData (BUGS.md L1) — which is why
  // R0 is a prerequisite for R2, not for this round.
  async function incrementFocusStat(data, kind, nowMs) {
    if (!data) return false;
    if (kind !== "blocked" && kind !== "snoozed") return false;
    var stats = ensureFocusStats(data);
    var key = achDayKey(nowMs);
    if (!stats.byDay[key]) stats.byDay[key] = { blocked: 0, snoozed: 0 };
    stats.byDay[key][kind] += 1;
    pruneFocusStatDays(stats);
    await saveAll(data);
    return true;
  }

  // Backfill for installs that predate this feature — the ensureTrackingState
  // shape, called from the same getAll pass. Every reader above already defaults
  // at read time, so this is belt-and-braces rather than load-bearing: it makes
  // the stored shape self-describing (and therefore visible in an export) at the
  // cost of ONE write on the first load after update, exactly as trackingPaused
  // paid when it shipped.
  function ensureFocusBlockingState(data) {
    var changed = false;
    if (typeof data.focusArmed !== "boolean") { data.focusArmed = false; changed = true; }
    if (!Array.isArray(data.blockList)) { data.blockList = []; changed = true; }
    if (!data.focusSnoozes || typeof data.focusSnoozes !== "object" || Array.isArray(data.focusSnoozes)) {
      data.focusSnoozes = {}; changed = true;
    }
    if (!data.settings || typeof data.settings !== "object") { data.settings = {}; changed = true; }
    if (!data.settings.focus || typeof data.settings.focus !== "object") {
      data.settings.focus = { autoArmDuringWork: FOCUS_DEFAULTS.autoArmDuringWork };
      changed = true;
    } else if (typeof data.settings.focus.autoArmDuringWork !== "boolean") {
      data.settings.focus.autoArmDuringWork = FOCUS_DEFAULTS.autoArmDuringWork;
      changed = true;
    }
    return changed;
  }

  // [1.2.2] The Insights date-range preset. Round 1 ships three presets, stored
  // as the DAY COUNT the board already parameterizes on (lastNLocalDayKeys(n))
  // rather than a label like "week": the number is what every reader consumes,
  // so storing it keeps one representation instead of a label plus a lookup that
  // could drift. Round 2's custom range is deliberately NOT persisted (a pinned
  // calendar range would go stale, then empty, as the 30-day retention rolls
  // past it), so this field stays a preset field.
  //
  // Defaulting reader rather than a skeleton field + migration, the
  // isTrackingEnabled shape: an absent value means "never chosen", which is
  // exactly the 30-day default the Insights-is-the-last-30-days doctrine wants.
  // No migration writes, and an existing user's first visit reads the same
  // default a fresh profile does.
  var INSIGHTS_RANGE_DAYS = [1, 7, 30];

  function getInsightsRangeDays(data) {
    var v = data && data.settings ? data.settings.insightsRangeDays : null;
    return INSIGHTS_RANGE_DAYS.indexOf(v) === -1 ? 30 : v;
  }

  // The CONTROL's setter, setCombinedAnalyticsEnabled's shape verbatim: a
  // per-field settings write with a no-op guard, flowing through saveAll itself
  // so the board's own click persists without the caller batching a write. The
  // no-op guard keeps re-picking the active preset from emitting a redundant
  // storage event that every other open tab would re-render on.
  async function setInsightsRangeDays(data, days) {
    if (!data || !data.settings) return false;
    var next = INSIGHTS_RANGE_DAYS.indexOf(days) === -1 ? 30 : days;
    if (getInsightsRangeDays(data) === next) return false;
    data.settings.insightsRangeDays = next;
    await saveAll(data);
    return true;
  }

  // [1.0.20 F2] The combined-analytics CONTROL's setter. Same shape as
  // setTrackingPaused: a per-field settings write with a no-op guard, flowing
  // through saveAll itself. The flag shipped in the data model in [1.0.3] with
  // its checkbox disabled ("Coming with Dashboard") because nothing consumed it;
  // bd95cf8 built the consumer (the Dashboard's focused-today line), and this is
  // the write half that finally makes the checkbox live. The no-op guard keeps
  // an unchanged toggle from emitting a redundant storage event.
  async function setCombinedAnalyticsEnabled(data, enabled) {
    if (!data) return false;
    if (!data.settings) return false;
    var next = !!enabled;
    if (!!data.settings.combinedAnalyticsEnabled === next) return false;
    data.settings.combinedAnalyticsEnabled = next;
    await saveAll(data);
    return true;
  }

  // [1.0.17] The pause CONTROL's setter. Unlike setTrackingEnabled (mutate-only,
  // caller batches the saveAll), this flows through saveAll itself with a no-op
  // guard — the same shape as the active-task setters, and for the same reasons:
  // it is fired standalone from the docked card, an unchanged write must not emit
  // a spurious storage event the engine would treat as a boundary, and the write
  // must reach the engine's data watcher (session close/reopen) and other tabs'
  // renders (cross-tab paused state) on its own. The engine needs no change —
  // evaluateGates already reads this flag; the watcher already fires on `data`.
  async function setTrackingPaused(data, paused) {
    if (!data) return false;
    var next = !!paused;
    if (isTrackingPaused(data) === next) return false;
    data.trackingPaused = next;

    // [1.0.17 dual counters] maintain the active task's ACTIVE-counter accounting
    // so it freezes on pause and resumes exactly where it left off. Display-only:
    // computeDesired never reads pausedAt/pausedMs. Guarded by the no-op check
    // above, so pausedAt is stamped once per pause and pausedMs accrues once per
    // resume. Global pause with no active task simply has nothing to stamp.
    var active = getActiveTask(data);
    if (active) {
      var pnow = Date.now();
      if (next) {
        // [1.0.17 idle deduct] Fold any PENDING idle span before stamping the
        // pause, in this same write — otherwise the wall-clock from idleAt
        // onwards would be deducted twice, once by the idle term and once by
        // the pause term, and ACTIVE would run backwards on resume.
        // Defensive by nature: pausing is a click, which implies input, which
        // means the idle listener has normally already folded. But the ordering
        // must be safe regardless of which event lands first.
        if (active.idleAt != null) {
          active.idleMs = (active.idleMs || 0) + (pnow - active.idleAt);
          active.idleAt = null;
        }
        active.pausedAt = pnow;
      } else if (active.pausedAt != null) {
        var pausedSpan = pnow - active.pausedAt;
        active.pausedMs = (active.pausedMs || 0) + pausedSpan;
        // [2.0] The SAME span into the activation-lifetime accumulator. See its
        // note on the record shape: pausedMs is per-SITTING (anchorBrowserSession
        // zeroes it), and the stopwatch counts from startedAt across restarts, so
        // it needs a paused total that the anchor does not reset.
        active.activePausedMs = (active.activePausedMs || 0) + pausedSpan;
        active.pausedAt = null;
        // [1.0.18 A2 D4] A running focus phase's endpoint slides forward by the
        // paused span, so the countdown resumes exactly where it froze (the pill
        // freezes the display at phaseEndsAt - pausedAt while paused). Correct
        // across repeated pause/resume cycles: each resume shifts by that span.
        var pps = active.pomodoroState;
        if (pps && pps.phase && typeof pps.phaseEndsAt === "number") {
          pps.phaseEndsAt += pausedSpan;
        }
      }
    }

    await saveAll(data);
    return true;
  }

  // [1.0.17 idle deduct] Maintain the active task's IDLE accounting so ACTIVE
  // means "this sitting, WHILE PRESENT" rather than raw wall-clock. The engine
  // already closes its session on idle (FOCUSED stops); ACTIVE is pure
  // arithmetic and used to keep climbing while the user was away, which is the
  // gap this closes.
  //
  // Deliberately SEPARATE fields from pausedAt/pausedMs rather than reusing
  // them: manual-pause semantics, Rule 4 (activation clears pause) and the
  // born-paused shape all key off the pause fields, and folding idle into them
  // would entangle a silent, automatic state with a loud, user-owned one.
  //
  // Gated on an active task AND !trackingPaused. The pause gate is the other
  // half of the no-double-deduct rule (see setTrackingPaused): while manually
  // paused the pause term already covers the whole span, so idle must not also
  // accrue. It also means a manually-paused user returning to the keyboard
  // still does not resume — idle never writes the pause flag, per spec.
  //
  // No-op guarded in BOTH directions (already-stamped idle, or an active
  // transition with nothing pending) so a redundant transition performs no
  // write and emits no storage event the engine would treat as a boundary.
  //
  // Display-only and engine-inert: computeDesired reads activeTask.taskId and
  // never these fields.
  //
  // @returns {Promise<boolean>} whether a real transition was written.
  async function setIdleState(data, isIdle) {
    if (!data) return false;
    var active = getActiveTask(data);
    if (!active) return false;              // nothing to account against
    if (isTrackingPaused(data)) return false; // pause owns the deduction

    var now = Date.now();
    if (isIdle) {
      if (active.idleAt != null) return false; // already stamped
      active.idleAt = now;
    } else {
      if (active.idleAt == null) return false; // nothing pending to fold
      active.idleMs = (active.idleMs || 0) + (now - active.idleAt);
      active.idleAt = null;
    }

    await saveAll(data);
    return true;
  }

  // [1.0.17 session anchor] Stamp a browser-session anchor on the active task.
  // Fired ONCE per true browser launch (chrome.runtime.onStartup) — SW suspends
  // inside a running browser must NOT reset it, which is exactly why this hangs
  // off onStartup and nothing else.
  //
  // Why: the ACTIVE counter is wall-clock since startedAt, so it counted through
  // closed Chrome (observed 46:21:09 across two nights). Anchoring makes ACTIVE
  // mean "this sitting": closed time is structurally uncountable, and morning
  // greets the still-active task at 0:00 climbing. startedAt is PRESERVED —
  // other readers (and any future "since activation" surface) still need it.
  //
  // The per-anchor pause accounting resets with the anchor so a pre-shutdown
  // pause cannot bleed a frozen offset into the new sitting. Note the pausedAt
  // reset is anchor-valued, NOT null, when the global flag is still true: that
  // is the born-paused shape setActiveTask already uses, and it is what actually
  // holds the card at a frozen 0:00 until resume. Nulling it while paused would
  // leave the counter CLIMBING behind a "PAUSED" label. The global
  // trackingPaused flag itself is untouched here — it persists per its own
  // semantics, and resuming accrues (now - pausedAt) so ACTIVE resumes from 0.
  //
  // Display-only, like the rest of this accounting: computeDesired reads
  // activeTask.taskId and never these fields, so this is engine-inert.
  async function anchorBrowserSession(data) {
    if (!data) return false;
    var active = getActiveTask(data);
    if (!active) return false; // nothing to anchor; no spurious write

    var now = Date.now();
    // [2.0] Fold any span still open into the ACTIVATION-LIFETIME total BEFORE the
    // per-sitting fields are reset below, or a pause held across a shutdown would
    // vanish from the stopwatch's accounting entirely. This is the one place the
    // two accumulators must be handled differently: pausedMs is about to be
    // zeroed by design, activePausedMs must not be.
    if (active.pausedAt != null) {
      active.activePausedMs = (active.activePausedMs || 0) + Math.max(0, now - active.pausedAt);
    }
    active.sessionAnchorAt = now;
    active.pausedMs = 0;
    active.pausedAt = isTrackingPaused(data) ? now : null;
    // [1.0.17 idle deduct] Idle accounting is per-anchor too: a pending idleAt
    // from before the shutdown would otherwise deduct the entire closed-browser
    // span from the new sitting the moment the user returned. Unlike pausedAt
    // there is no "born-idle" case to preserve — idle is not a persisted user
    // intent, and the listener re-stamps on the next real transition.
    active.idleMs = 0;
    active.idleAt = null;

    await saveAll(data);
    return true;
  }

  // ===== [2.0] BROWSER-CLOSED TIME IS PAUSED TIME =====
  //
  // AMENDS the continuity-across-restarts decision (2026-08-12). The stopwatch
  // measures ACTIVE time WHILE THE BROWSER EXISTS. A closed browser is not a
  // long pause somebody forgot to take; it is definitionally not-working time.
  // The evidence that overturned the old decision: an overnight task greeted
  // its owner at 18:14:35.
  //
  // Two pieces. A liveness HEARTBEAT, stamped about once a minute by a service
  // worker alarm while a task is active and unpaused; and a COLD-START FOLD on
  // onStartup that adds (now - the last beat) to the activation-lifetime paused
  // total and pauses the task. The error per shutdown is therefore at most one
  // beat period, and it is always in the safe direction: a span slightly
  // shorter than the true closure is folded, never longer.
  //
  // WHY THE HEARTBEAT GETS ITS OWN KEY AND NOT A FIELD ON `data`.
  // Every `data` write fans out: the engine re-syncs (`Tracking.sync`), the
  // context menu rebuilds, the pomodoro alarm re-derives, and EVERY other open
  // new-tab page runs a full render(). A service worker cannot even opt out of
  // that last one — the `__lastWrite` provenance suppression is keyed by TAB
  // instance, so an SW write can never claim it. A once-a-minute beat in the
  // blob would pay that whole fan-out forever, for one timestamp. This is the
  // tracking_sessions precedent exactly: the high-frequency writer gets a key
  // nobody watches. It also means the beat needs no enqueueBgData — it is a
  // single-key set, not a getAll -> mutate -> saveAll cycle, so it has nothing
  // to clobber and nothing can clobber it. The FOLD does touch `data` and does
  // ride the queue.
  var HEARTBEAT_KEY = "launchpad_heartbeat";

  async function readHeartbeat() {
    try {
      var result = await chrome.storage.local.get(HEARTBEAT_KEY);
      return result[HEARTBEAT_KEY] || null;
    } catch (err) {
      console.error("[LaunchPad] Heartbeat read failed:", err);
      return null;
    }
  }

  // Stamped with the task it belongs to, not just a bare time. A beat left by a
  // DIFFERENT activation must never be folded into this one — see the taskId
  // guard in closedBrowserFoldMs.
  async function writeHeartbeat(taskId, now) {
    try {
      await chrome.storage.local.set({
        launchpad_heartbeat: { at: now || Date.now(), taskId: taskId || null }
      });
    } catch (err) {
      console.error("[LaunchPad] Heartbeat write failed:", err);
    }
  }

  async function clearHeartbeat() {
    try {
      await chrome.storage.local.remove(HEARTBEAT_KEY);
    } catch (err) {
      console.error("[LaunchPad] Heartbeat clear failed:", err);
    }
  }

  // PURE (harnessed): how much closed-browser time to fold, in ms. 0 means
  // "no usable evidence" — and 0 is also the signal not to pause at all.
  //
  // THE EPOCH-FOLD CATASTROPHE is what most of this function is for. An absent
  // or zero `at` is the shape a legacy profile has on its first launch after
  // this update, and `now - 0` is fifty-six years. Folded into activePausedMs
  // that pins the stopwatch at 0:00 forever, with no user-reachable way back.
  // Every rejection below therefore returns 0 rather than trying to guess:
  //   - no heartbeat at all, or a non-numeric / zero / negative `at`
  //   - a beat belonging to a different task (an activation switch that
  //     happened without an intervening beat)
  //   - a beat older than the activation itself (corrupt or clock-shifted;
  //     folding it could exceed the elapsed time and pin the count at zero)
  //   - a beat in the FUTURE (the clock moved back) — Math.max clamps to 0
  function closedBrowserFoldMs(active, heartbeat, now) {
    if (!active || typeof active.startedAt !== "number" || !active.startedAt) return 0;
    if (!heartbeat || typeof heartbeat.at !== "number") return 0;
    if (!isFinite(heartbeat.at) || heartbeat.at <= 0) return 0;
    if (heartbeat.taskId !== active.taskId) return 0;
    if (heartbeat.at < active.startedAt) return 0;
    return Math.max(0, now - heartbeat.at);
  }

  // The cold-start fold. Called from onStartup ONLY, and AFTER
  // anchorBrowserSession — see the ordering note in background.js.
  //
  // NO EVIDENCE MEANS NO FOLD **AND NO PAUSE**, deliberately. Pausing without
  // folding would freeze a number that already contains the closed hours: the
  // user gets a wrong count that is now also stuck, and must click Resume to
  // get back to a state we could have just left alone. Not pausing preserves
  // exactly the old behavior for ONE more cycle, and the heartbeat starts on
  // this very launch, so the next shutdown is covered.
  //
  // Reuses setTrackingPaused rather than writing the flag directly. That is the
  // canonical pause path: it stamps pausedAt, folds any pending idle span in
  // the same write, and slides a running pomodoro phase — and it means Resume
  // needs no new code, because this pause is not a special kind of pause. It IS
  // a pause; the browser took it on the user's behalf.
  async function foldClosedBrowserSpan(data, heartbeat) {
    if (!data) return false;
    var active = getActiveTask(data);
    if (!active) return false;                  // nothing active; no spurious write
    if (isTrackingPaused(data)) return false;   // already paused: the pause term owns the span

    var now = Date.now();
    var fold = closedBrowserFoldMs(active, heartbeat, now);
    if (fold <= 0) return false;                // no usable evidence -> leave it alone

    active.activePausedMs = (active.activePausedMs || 0) + fold;
    // The one-time reopen notice. It lives ON THE ACTIVATION RECORD rather than
    // in settings (the hint/latch convention) because it is not a preference or
    // a permanent latch — it describes THIS activation and should die with it.
    // "End for now" clears the record, and the notice evaporates with it, which
    // is the correct behavior for a message about a task you no longer have.
    active.closedPauseNoticeAt = now;

    var wrote = await setTrackingPaused(data, true);   // saveAll's internally
    if (!wrote) await saveAll(data);                    // defensive: guarded above
    return true;
  }

  // Consume-on-show: clears the notice and reports whether there was one.
  // MUTATE-ONLY — the caller saves — so the page can fold this into the write
  // it was already making. Clearing BEFORE painting is the D8 contract: a toast
  // that paints first and clears second shows twice if two tabs open together.
  function consumeClosedPauseNotice(data) {
    if (!data) return false;
    var active = getActiveTask(data);
    if (!active || active.closedPauseNoticeAt == null) return false;
    active.closedPauseNoticeAt = null;
    return true;
  }

  function migrate(data) {
    if (data && Array.isArray(data.workspaces)) return data;

    var oldData = data || {};
    // [1.0.20] endOfDayMinutes sits in the DEFAULTS object, not the override
    // one: it is a user preference, so a value already present in oldData.settings
    // must survive. combinedAnalyticsEnabled stays in the override object
    // deliberately — it is reset on migration.
    var migratedSettings = Object.assign(
      { columns: 6, collapsedGroups: {}, endOfDayMinutes: 1020 },
      oldData.settings || {},
      { combinedAnalyticsEnabled: false }
    );
    var newData = {
      workspaces: [{
        id: "main",
        name: "Main",
        createdAt: Date.now(),
        isReadOnly: false,
        groupOrder: oldData.groupOrder || [],
        groups: oldData.groups || [],
        goals: [],
        tasks: [],
        tags: [],
        notes: [],
        namedSessions: [],
        tracking: emptyTrackingState()
      }],
      workspaceOrder: ["main"],
      activeWorkspaceId: "main",
      trackingPaused: false,
      settings: migratedSettings,
      pro: {
        licenseKey: null,
        instanceId: null,
        instanceName: null,
        email: null,
        trialStartedAt: null,
        trialEndedAt: null,
        subscriptionStatus: "free",
        lastVerifiedAt: null
      },
      achievements: emptyAchievements(),   // [1.0.23] — see getDefaultData
      gettingStarted: emptyGettingStarted()
    };

    ensureDeletedAtFields(newData);
    return newData;
  }

  function getActiveWorkspaceIndex(data) {
    if (!data || !Array.isArray(data.workspaces) || data.workspaces.length === 0) return 0;
    var idx = data.workspaces.findIndex(function (ws) { return ws.id === data.activeWorkspaceId; });
    if (idx === -1) {
      console.warn("[LaunchPad] Active workspace id not found:", data.activeWorkspaceId, "— falling back to workspace[0]");
      return 0;
    }
    return idx;
  }

  function getActiveWorkspace(data) {
    if (!data || !Array.isArray(data.workspaces) || data.workspaces.length === 0) return null;
    var idx = getActiveWorkspaceIndex(data);
    return data.workspaces[idx] || data.workspaces[0];
  }

  async function getAll() {
    try {
      var result = await chrome.storage.local.get("data");
      var existing = result.data;

      if (!existing) {
        // Fresh install: write default new-shape, no backup created.
        var fresh = getDefaultData();
        await chrome.storage.local.set({ data: fresh });
        console.log("[LaunchPad] Initialized fresh-install data (workspace-aware shape)");
        return fresh;
      }

      if (Array.isArray(existing.workspaces)) {
        // Already migrated. Defensive backfill of deletedAt fields, plus the
        // [1.0.25] tracking-state seed (both are idempotent — they write once,
        // then never again, so this cannot loop against the SW's storage
        // onChanged watcher).
        var patched = ensureDeletedAtFields(existing);
        var trackingSeeded = ensureTrackingState(existing);
        var focusSeeded = ensureFocusBlockingState(existing);
        var notesSeeded = ensureNotesArrays(existing);
        var sessionsSeeded = ensureNamedSessionsArrays(existing);
        if (patched || trackingSeeded || focusSeeded || notesSeeded || sessionsSeeded) {
          await chrome.storage.local.set({ data: existing });
          if (patched) console.log("[LaunchPad] Backfilled missing deletedAt fields");
          if (trackingSeeded) console.log("[LaunchPad] Seeded per-workspace tracking state (default ON)");
          if (focusSeeded) console.log("[LaunchPad] Seeded focus-blocking state (auto-arm default ON)");
          if (notesSeeded) console.log("[LaunchPad] Seeded per-workspace notes array");
          if (sessionsSeeded) console.log("[LaunchPad] Seeded per-workspace named-sessions array");
        }
        return existing;
      }

      // Old shape: backup, migrate, persist.
      console.log("[LaunchPad] Migrating storage to workspace-aware shape...");
      await chrome.storage.local.set({ data_pre_migration_backup: existing });
      var migrated = migrate(existing);
      await chrome.storage.local.set({ data: migrated });
      console.log("[LaunchPad] Migration complete. Backup saved as data_pre_migration_backup.");
      return migrated;
    } catch (err) {
      console.error("[LaunchPad] Storage read failed:", err);
      return getDefaultData();
    }
  }

  async function saveAll(data) {
    try {
      // [1.0.11.2] Tag this write so the newtab's onChanged listener can
      // distinguish OWN writes from foreign ones (other tab, service worker).
      // Both keys land in the same chrome.storage.local.set call so they
      // arrive atomically in a single onChanged event.
      var writeId = genWriteId();
      _pendingWriteIds.add(writeId);
      await chrome.storage.local.set({
        data: data,
        __lastWrite: { tab: TAB_INSTANCE_ID, writeId: writeId, ts: Date.now() }
      });
    } catch (err) {
      console.error("[LaunchPad] Storage write failed:", err);
    }
  }

  async function addShortcut(groupId, shortcut) {
    var data = await getAll();
    var ws = getActiveWorkspace(data);
    if (!ws) return;
    var group = ws.groups.find(function (g) { return g.id === groupId; });
    if (!group) {
      console.warn("[LaunchPad] addShortcut: group not found:", groupId);
      return;
    }
    shortcut.id = shortcut.id || genId();
    shortcut.addedAt = shortcut.addedAt || Date.now();
    if (!Object.prototype.hasOwnProperty.call(shortcut, "deletedAt")) shortcut.deletedAt = null;

    // [1.0.9.2] Q3/Q5: group-inherit hook. New bookmark added to a tagged group
    // inherits the group's tagIds, merged with any tagIds the bookmark already
    // carries (union, dedup, preserving order: bookmark's own first, then
    // group's). Add-time only — drag-between-groups (handled in
    // syncShortcutsFromDOM) intentionally does not trigger inheritance, and
    // tagging a group later does not retroactively apply to existing
    // bookmarks. See storage.js shortcut-tag inheritance reasoning.
    var groupTagIds = ensureTagIdsArray(group);
    if (groupTagIds.length) {
      var existingTagIds = ensureTagIdsArray(shortcut);
      var merged = existingTagIds.slice();
      groupTagIds.forEach(function (tid) {
        if (merged.indexOf(tid) === -1) merged.push(tid);
      });
      shortcut.tagIds = merged;
    }

    group.shortcuts.push(shortcut);
    // [R3] Checklist step 1 rides this write. Demo content never ticks (belt-and-
    // suspenders — the demo seed builds shortcuts directly, not via addShortcut).
    if (!isDemoShortcut(shortcut)) recordChecklistStep(data, GS_STEP_SHORTCUT);
    await saveAll(data);
    console.log("[LaunchPad] Shortcut added to", groupId, ":", shortcut.title || shortcut.url);
    return shortcut;
  }

  async function removeShortcut(groupId, shortcutId) {
    var data = await getAll();
    var ws = getActiveWorkspace(data);
    if (!ws) return;
    var group = ws.groups.find(function (g) { return g.id === groupId; });
    if (!group) return;
    group.shortcuts = group.shortcuts.filter(function (s) { return s.id !== shortcutId; });
    await saveAll(data);
    console.log("[LaunchPad] Shortcut removed:", shortcutId, "from", groupId);
  }

  async function addGroup(name) {
    var data = await getAll();
    var ws = getActiveWorkspace(data);
    if (!ws) return;
    var id = genId();
    var group = { id: id, name: name, shortcuts: [], deletedAt: null };
    ws.groups.push(group);
    ws.groupOrder.push(id);
    // [R3] Checklist step 4 rides this write (a user-created, non-demo group).
    if (!isDemoGroup(group)) recordChecklistStep(data, GS_STEP_GROUP);
    await saveAll(data);
    console.log("[LaunchPad] Group added:", name, "(" + id + ")");
    return group;
  }

  async function removeGroup(groupId) {
    if (groupId === "ungrouped") return;
    var data = await getAll();
    var ws = getActiveWorkspace(data);
    if (!ws) return;
    ws.groups = ws.groups.filter(function (g) { return g.id !== groupId; });
    ws.groupOrder = ws.groupOrder.filter(function (id) { return id !== groupId; });
    await saveAll(data);
    console.log("[LaunchPad] Group removed:", groupId);
  }

  async function reorderShortcuts(groupId, orderedIds) {
    var data = await getAll();
    var ws = getActiveWorkspace(data);
    if (!ws) return;
    var group = ws.groups.find(function (g) { return g.id === groupId; });
    if (!group) return;
    var byId = new Map(group.shortcuts.map(function (s) { return [s.id, s]; }));
    group.shortcuts = orderedIds.map(function (id) { return byId.get(id); }).filter(Boolean);
    await saveAll(data);
  }

  async function reorderGroups(orderedGroupIds) {
    var data = await getAll();
    var ws = getActiveWorkspace(data);
    if (!ws) return;
    ws.groupOrder = orderedGroupIds;
    await saveAll(data);
  }

  async function getBackground() {
    try {
      var result = await chrome.storage.local.get("launchpad_background");
      return result.launchpad_background || null;
    } catch (err) {
      console.error("[LaunchPad] Background read failed:", err);
      return null;
    }
  }

  async function saveBackground(bgData) {
    try {
      if (bgData) {
        await chrome.storage.local.set({ launchpad_background: bgData });
      } else {
        await chrome.storage.local.remove("launchpad_background");
      }
    } catch (err) {
      console.error("[LaunchPad] Background write failed:", err);
    }
  }

  async function getProAccessLevel() {
    if (typeof ProAccess === "undefined") {
      console.warn("[LaunchPad] ProAccess module not loaded");
      return "free";
    }
    var data = await getAll();
    return ProAccess.getProAccessLevel(data);
  }

  async function getOnboardingComplete() {
    try {
      var result = await chrome.storage.local.get("launchpad_onboarding");
      return !!result.launchpad_onboarding;
    } catch (err) {
      return false;
    }
  }

  // [1.0.19] The key name "launchpad_onboarding" is KEPT deliberately even
  // though the wizard it was named for is gone. Its semantics are repurposed
  // from "wizard completed" to "first-run setup done", and that continuity is
  // the whole point: every existing install already has it true, so none of
  // them can ever be seeded with example content. Renaming it would re-seed
  // the entire installed base on their next new tab.
  async function setOnboardingComplete() {
    try {
      await chrome.storage.local.set({ launchpad_onboarding: true });
    } catch (err) {
      console.error("[LaunchPad] Failed to save onboarding flag:", err);
    }
  }

  // ===== [1.0.19] First-run example content =====
  //
  // The grid teaches itself: a fresh install is seeded with obviously-example
  // content that demonstrates the interaction model and begs to be replaced.
  // Everything seeded here is DEMO-MARKED so it can be identified and removed
  // as an exact set later — groups by a reserved "demo_" id prefix, shortcuts
  // by demo: true. Nothing else in the codebase writes either marker, so the
  // marked set is precisely what this module created.
  //
  // Records are fully inert: url, title, timestamps. No analytics, no tracking
  // seeds, nothing that could be mistaken for user behaviour (the April plan's
  // privacy note, still binding).
  var DEMO_GROUP_PREFIX = "demo_";
  var DEMO_INTRO_GROUP_ID = "demo_intro";

  // The three teaching tiles ride in the grid as records rather than as
  // hard-coded markup, so clearDemoContent removes them in the SAME write as
  // everything else and no second source of truth exists for "are examples
  // present". demoTile is what the renderer branches on.
  // [1.0.19 D12] "background" is the fourth tile. It needed no change to
  // seed / clear / restore beyond this array entry — precisely because the
  // tiles are DATA rather than hard-coded markup, so the whole demo lifecycle
  // carries it for free.
  var DEMO_TILES = ["welcome", "teaching", "import", "background"];

  var DEMO_SEED_GROUPS = [
    {
      id: "demo_daily",
      name: "✨ Examples — Daily",
      shortcuts: [
        { title: "Google", url: "https://www.google.com" },
        { title: "YouTube", url: "https://www.youtube.com" },
        { title: "Gmail", url: "https://mail.google.com" },
        { title: "Maps", url: "https://www.google.com/maps" },
        { title: "Wikipedia", url: "https://www.wikipedia.org" }
      ]
    },
    {
      id: "demo_work",
      name: "✨ Examples — Work",
      shortcuts: [
        { title: "Docs", url: "https://docs.google.com" },
        { title: "Calendar", url: "https://calendar.google.com" },
        { title: "GitHub", url: "https://github.com" },
        { title: "LinkedIn", url: "https://www.linkedin.com" }
      ]
    }
  ];

  function isDemoGroup(group) {
    return !!(group && typeof group.id === "string" &&
      group.id.indexOf(DEMO_GROUP_PREFIX) === 0);
  }

  function isDemoShortcut(s) {
    return !!(s && s.demo === true);
  }

  /**
   * Is any example content currently present? Used to keep seeding and restore
   * idempotent — neither may ever produce a second copy.
   */
  function hasDemoContent(data) {
    var ws = getActiveWorkspace(data);
    if (!ws || !Array.isArray(ws.groups)) return false;
    return ws.groups.some(function (g) {
      if (isDemoGroup(g)) return true;
      return (g.shortcuts || []).some(isDemoShortcut);
    });
  }

  /**
   * [1.0.19 D4 gate] Does the user own at least one REAL shortcut — anywhere in
   * the workspace, in any group, demo or not?
   *
   * Deliberately a pure reader over stored state rather than an event the add
   * paths fire: the UI computes it at render time, so EVERY add path (add tile,
   * right-click context menu, bookmark import, top-sites import, drag) flips
   * the gate without being special-cased. A path that forgot to announce itself
   * is not possible, because no path announces itself.
   *
   * Soft-deleted shortcuts do not count — a trashed shortcut is not content the
   * user still has.
   */
  function hasRealShortcut(data) {
    var ws = getActiveWorkspace(data);
    if (!ws || !Array.isArray(ws.groups)) return false;
    return ws.groups.some(function (g) {
      return (g.shortcuts || []).some(function (s) {
        return s && !s.demo && !s.deletedAt && !s.demoTile;
      });
    });
  }

  function makeDemoShortcut(seed, now, i) {
    return {
      id: "demo_s_" + now.toString(36) + "_" + i.toString(36),
      url: seed.url,
      title: seed.title,
      addedAt: now,
      deletedAt: null,
      demo: true
    };
  }

  /**
   * Seed the example content. Used both for the first-run latch (D2) and for
   * "Restore examples" (D7) — one implementation, so the restored grid is
   * byte-shaped like a fresh install's.
   *
   * No-op (returns false, writes nothing) when example content is already
   * present, which is what makes Restore idempotent.
   *
   * Does NOT write a background. loadBackground already substitutes and
   * PERSISTS DEFAULT_BG when no record exists, and it runs before this at init
   * — so writing one here would be a redundant second write of a value that is
   * already on disk (P8 verdict, ratified into D2).
   */
  async function seedDemoContent(data) {
    if (!data) return false;
    var ws = getActiveWorkspace(data);
    if (!ws) return false;
    if (hasDemoContent(data)) return false;

    ensureGroupsArray(ws);
    var now = Date.now();
    var i = 0;

    // Intro strip first — it carries the welcome/teaching/import tiles and,
    // with them, the Clear Examples control.
    var intro = {
      id: DEMO_INTRO_GROUP_ID,
      name: "Getting started",
      deletedAt: null,
      shortcuts: DEMO_TILES.map(function (kind) {
        i++;
        return {
          id: "demo_t_" + now.toString(36) + "_" + kind,
          demoTile: kind,
          demo: true,
          addedAt: now,
          deletedAt: null
        };
      })
    };

    var seeded = [intro].concat(DEMO_SEED_GROUPS.map(function (g) {
      return {
        id: g.id,
        name: g.name,
        deletedAt: null,
        shortcuts: g.shortcuts.map(function (s) { i++; return makeDemoShortcut(s, now, i); })
      };
    }));

    // Examples lead; the user's own groups keep their existing relative order
    // behind them. After a Clear the user's groups are simply all that is left.
    seeded.forEach(function (g) { ws.groups.push(g); });
    ws.groupOrder = seeded.map(function (g) { return g.id; })
      .concat((ws.groupOrder || []).filter(function (id) {
        return seeded.every(function (g) { return g.id !== id; });
      }));

    await saveAll(data);
    return true;
  }

  /**
   * Remove EXACTLY the demo-marked set — the intro tiles, the demo_ groups and
   * any demo: true shortcut that has since been dragged into a user group — in
   * ONE write. Anything the user owns is untouched, including a real shortcut
   * dragged INTO a demo group (it is re-homed rather than destroyed).
   */
  async function clearDemoContent(data) {
    if (!data) return false;
    var ws = getActiveWorkspace(data);
    if (!ws || !Array.isArray(ws.groups)) return false;
    if (!hasDemoContent(data)) return false;

    // A real shortcut sitting inside a demo group would otherwise be collateral
    // damage when the group goes. Re-home those into the first surviving group.
    var rescued = [];
    ws.groups.forEach(function (g) {
      if (!isDemoGroup(g)) return;
      (g.shortcuts || []).forEach(function (s) {
        if (!isDemoShortcut(s)) rescued.push(s);
      });
    });

    ws.groups = ws.groups.filter(function (g) { return !isDemoGroup(g); });
    ws.groupOrder = (ws.groupOrder || []).filter(function (id) {
      return id.indexOf(DEMO_GROUP_PREFIX) !== 0;
    });

    // Demo shortcuts that were dragged out of their demo group into a user
    // group still carry demo: true, so they clear with the rest.
    ws.groups.forEach(function (g) {
      g.shortcuts = (g.shortcuts || []).filter(function (s) { return !isDemoShortcut(s); });
    });

    if (rescued.length) {
      ensureGroupsArray(ws);
      var host = ws.groups[0];
      if (host) {
        host.shortcuts = (host.shortcuts || []).concat(rescued);
      }
    }

    await saveAll(data);
    return true;
  }

  // ===== Goals =====
  //
  // Goal CRUD on the Storage namespace, per docs/SPECS/tasks-and-goals.md.
  // No UI surface in [1.0.7]; the Tasks tab UI ([1.0.10]) hooks these later.
  // Verification path: console-callable via Storage.* (matches the
  // ProAccess.applyLicenseKey console pattern).
  //
  // Mutating helpers take the full `data` storage object plus an optional
  // workspaceId override (defaults to the active workspace). They persist
  // via saveAll before resolving. Read helpers take a workspace directly so
  // callers can iterate across workspaces without re-resolving.
  //
  // Soft-delete via deletedAt from day one — the Trash Bin UI lands later
  // and immediately has things to display. Goals with deletedAt !== null are
  // filtered out of every read function.
  //
  // Cascade hooks present but no-op until [1.0.8] / [1.0.9] populate the
  // tasks and tags slots. deleteGoal already iterates workspace.tasks and
  // workspace.tags looking for child records to soft-delete with the same
  // timestamp; once those data types exist, cascade activates without
  // touching this file.

  function genGoalId() {
    return "goal_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function resolveWorkspaceFromData(data, workspaceId) {
    if (!data || !Array.isArray(data.workspaces)) return null;
    if (workspaceId) {
      return data.workspaces.find(function (w) { return w.id === workspaceId; }) || null;
    }
    return getActiveWorkspace(data);
  }

  // ===== Workspace-shape array helpers =====
  //
  // Centralized lazy-init for workspace-shape arrays. Older workspace records
  // pre-date a given field and may have it missing or non-array. Each helper
  // guarantees the target field exists as an array on the passed object and
  // returns the array reference, so callers can read/iterate without the
  // scattered `(ws.foo || []).forEach(...)` defensive pattern that the
  // 2026-05-08 audit replaced.
  //
  // Shape mirrors ensureGoalsArray (the [1.0.7] pattern source): null-safe on
  // a missing object, lazy-init when the field is absent or non-array, return
  // the array reference. Same return semantics across all helpers — no
  // behavioral divergence beyond the target field name.

  function ensureGroupsArray(workspace) {
    if (!workspace) return null;
    if (!Array.isArray(workspace.groups)) workspace.groups = [];
    return workspace.groups;
  }

  function ensureWorkspaceOrderArray(data) {
    if (!data) return null;
    if (!Array.isArray(data.workspaceOrder)) data.workspaceOrder = [];
    return data.workspaceOrder;
  }

  // Forward-looking stub for [1.0.14] (recurring task templates per
  // docs/SPECS/tasks-and-goals.md). Field landed early so the helper exists
  // before the feature does — saves a follow-up touch when [1.0.14] wires
  // template generation.
  function ensureRecurringTemplatesArray(workspace) {
    if (!workspace) return null;
    if (!Array.isArray(workspace.recurringTemplates)) workspace.recurringTemplates = [];
    return workspace.recurringTemplates;
  }

  // [1.0.15] Goal templates live in workspace.goalTemplates (per the PLAN +
  // tasks-and-goals.md). The [1.0.10.1] forward-looking stub mis-targeted
  // `taskTemplates` (a SEPARATE, not-yet-built concept — task templates) despite
  // its name; it had no CRUD and no consumers, so retargeting to goalTemplates
  // aligns the helper with its name and leaves `taskTemplates` free for the
  // future task-template feature.
  function ensureGoalTemplatesArray(workspace) {
    if (!workspace) return null;
    if (!Array.isArray(workspace.goalTemplates)) workspace.goalTemplates = [];
    return workspace.goalTemplates;
  }

  // Item-level helper: bookmarks (shortcuts) and groups both carry a tagIds
  // array under the [1.0.9.2] tag-on-item model. Distinct from the
  // workspace-level helpers above — this normalizes a single record, not a
  // workspace-scoped collection. Lazy-init so legacy records (pre-[1.0.9.2])
  // that never had tagIds set continue to work without a migration sweep.
  function ensureTagIdsArray(item) {
    if (!item) return null;
    if (!Array.isArray(item.tagIds)) item.tagIds = [];
    return item.tagIds;
  }

  function ensureGoalsArray(workspace) {
    if (!workspace) return null;
    if (!Array.isArray(workspace.goals)) workspace.goals = [];
    return workspace.goals;
  }

  function findLiveGoal(workspace, goalId) {
    var goals = ensureGoalsArray(workspace);
    if (!goals) return null;
    var goal = goals.find(function (g) { return g.id === goalId; });
    if (!goal) return null;
    if (goal.deletedAt) return null;
    return goal;
  }

  function nextDisplayOrder(goals) {
    var max = 0;
    goals.forEach(function (g) {
      if (typeof g.displayOrder === "number" && g.displayOrder > max) max = g.displayOrder;
    });
    return max + 1;
  }

  /**
   * Create a goal in the (optionally specified) workspace.
   *
   * Auto-tag creation (extended in [1.0.9]):
   *   When `autoCreateTag` is true (default), an auto-tag is created inline
   *   with name = kebabCase(goal.name), color = `tagColor` if provided else
   *   the next palette rotation, and `autoGeneratedFromGoalId` set to the
   *   goal. `goal.autoTagId` is populated atomically with the goal in a
   *   single saveAll. If `tagColor` is provided but invalid, no goal is
   *   created (atomicity matches the rest of createGoal validation).
   *
   *   [1.0.9.2] round 7: when `autoCreateTag` is true and an ACTIVE tag
   *   already exists whose name kebab-cases to the same form as the goal
   *   name, that tag is REUSED instead of creating a duplicate. The reused
   *   tag's `autoGeneratedFromGoalId` is cleared if it was tied to a
   *   different goal (the tag becomes shared, no longer 1:1-tied to any
   *   single goal). Soft-deleted tags are skipped — same active-only policy
   *   as round 6 manual-tag dedup. `tagColor` is silently ignored on reuse;
   *   the existing tag's color stands.
   *
   *   When `autoCreateTag` is false, `tagColor` is ignored entirely. Any
   *   `autoTagId` passed in `fields` is preserved as-is — useful for callers
   *   who already created a tag elsewhere. When `autoCreateTag` is true,
   *   the auto-creation overrides any provided `autoTagId`.
   *
   * @param {object} data — full storage object
   * @param {object} fields — { name (required, trimmed, non-empty), description?, deadlineAt?, autoTagId?, autoCreateTag? (default true), tagColor? (default null) }
   * @param {string} [workspaceId] — defaults to the active workspace
   * @returns {Promise<object|null>} the created goal, or null on validation failure
   */
  async function createGoal(data, fields, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    if (!ws) {
      console.warn("[LaunchPad] createGoal: workspace not found");
      return null;
    }
    var f = fields || {};
    var name = typeof f.name === "string" ? f.name.trim() : "";
    if (!name) {
      console.warn("[LaunchPad] createGoal: name is required and must be non-empty after trim");
      return null;
    }
    var deadlineAt = (f.deadlineAt === null || f.deadlineAt === undefined) ? null : f.deadlineAt;
    if (deadlineAt !== null && typeof deadlineAt !== "number") {
      console.warn("[LaunchPad] createGoal: deadlineAt must be a number or null");
      return null;
    }
    var autoTagId = (f.autoTagId === undefined) ? null : f.autoTagId;
    if (autoTagId !== null && typeof autoTagId !== "string") {
      console.warn("[LaunchPad] createGoal: autoTagId must be a string or null");
      return null;
    }
    var description = (f.description === undefined || f.description === null) ? "" : String(f.description);

    var autoCreateTag = (f.autoCreateTag === undefined) ? true : !!f.autoCreateTag;
    var tagColor = (f.tagColor === undefined || f.tagColor === null) ? null : f.tagColor;

    // Atomicity: validate tagColor before any mutation. Invalid color → no goal,
    // no tag. tagColor is silently ignored when autoCreateTag is false.
    if (autoCreateTag && tagColor !== null) {
      if (typeof tagColor !== "string" || !isValidHexColor(tagColor)) {
        console.warn("[LaunchPad] createGoal: tagColor must match /^#[0-9A-Fa-f]{6}$/");
        return null;
      }
    }

    var goals = ensureGoalsArray(ws);
    var now = Date.now();
    var goal = {
      id: genGoalId(),
      name: name,
      description: description,
      deadlineAt: deadlineAt,
      status: "active",
      autoTagId: autoTagId,
      isCollapsed: false,
      createdAt: now,
      completedAt: null,
      deletedAt: null,
      displayOrder: nextDisplayOrder(goals)
    };

    // Auto-tag is created inline (shared saveAll). nextAutoTagColor counts both
    // live and soft-deleted auto-tags so deletions during the 30-day trash
    // window don't perturb the rotation index. tag name is derived from goal
    // name once at creation; subsequent renameGoal does NOT auto-rename the tag.
    //
    // [1.0.9.2] round 7: auto-tag dedup. Before pushing a new auto-tag, scan
    // ACTIVE tags for a kebab-form collision so manual tags whose
    // case/whitespace happens to render to the same kebab as the candidate
    // auto-tag are reused (manual "Work Tasks" → kebab "work-tasks" matches
    // auto for goal "Work Tasks"). Soft-deleted tags are skipped — same
    // active-only policy as round 6 manual-tag dedup. On reuse, if the
    // existing tag was tied to another goal (autoGeneratedFromGoalId is a
    // string), clear it so the tag becomes shared-not-owned and the
    // originating goal's deletion no longer cascades a tag this new goal
    // depends on. The deleteGoal cascade below was tightened in the same
    // round to require autoGeneratedFromGoalId === goal.id, so cleared ties
    // mean the reused tag survives both goals' deletions.
    //
    // renameGoal intentionally does NOT participate in this dedup — the
    // 2026-04-27 tag-name decoupling rule keeps the auto-tag name fixed at
    // goal-creation time. See DECISIONS.md 2026-05-09 (round 7) for why.
    if (autoCreateTag) {
      attachAutoTagToGoal(ws, goal, tagColor, now);
    }

    goals.push(goal);
    await saveAll(data);
    return goal;
  }

  // [1.0.15] Auto-tag attach, extracted from createGoal verbatim so goal-template
  // instantiation reuses the exact dedup/reuse rules in a SINGLE saveAll rather
  // than duplicating them. Mutates goal.autoTagId and (on a fresh tag) pushes to
  // ws.tags. No saveAll — the caller batches. See createGoal's [1.0.9.2] round-7
  // comment for the dedup rationale.
  function attachAutoTagToGoal(ws, goal, tagColor, now) {
    var tags = ensureTagsArray(ws);
    var candidateKebab = kebabCase(goal.name);
    var existing = null;
    for (var ti = 0; ti < tags.length; ti++) {
      var t = tags[ti];
      if (!t || t.deletedAt) continue;
      if (typeof t.name !== "string") continue;
      if (kebabCase(t.name) === candidateKebab) {
        existing = t;
        break;
      }
    }
    if (existing) {
      if (typeof existing.autoGeneratedFromGoalId === "string" && existing.autoGeneratedFromGoalId !== goal.id) {
        existing.autoGeneratedFromGoalId = null;
      }
      goal.autoTagId = existing.id;
    } else {
      var tag = {
        id: genTagId(),
        name: candidateKebab,
        color: tagColor !== null ? tagColor : nextAutoTagColor(ws),
        autoGeneratedFromGoalId: goal.id,
        createdAt: now,
        deletedAt: null
      };
      tags.push(tag);
      goal.autoTagId = tag.id;
    }
  }

  /**
   * Rename a goal. No-op + null return on empty / missing.
   * @returns {Promise<object|null>}
   */
  async function renameGoal(data, goalId, newName, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var goal = findLiveGoal(ws, goalId);
    if (!goal) return null;
    var name = typeof newName === "string" ? newName.trim() : "";
    if (!name) {
      console.warn("[LaunchPad] renameGoal: newName must be non-empty after trim");
      return null;
    }
    if (goal.name === name) return goal;
    goal.name = name;
    await saveAll(data);
    return goal;
  }

  /**
   * Update a goal's description. Coerces to string. Empty string allowed.
   * @returns {Promise<object|null>}
   */
  async function updateGoalDescription(data, goalId, newDescription, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var goal = findLiveGoal(ws, goalId);
    if (!goal) return null;
    var desc = (newDescription === undefined || newDescription === null) ? "" : String(newDescription);
    if (goal.description === desc) return goal;
    goal.description = desc;
    await saveAll(data);
    return goal;
  }

  /**
   * Toggle the goal's collapse state. Used by the [1.0.11] Tasks tab goal
   * card chevron — when true, the UI hides the goal's child task list and
   * the "+ Add task" affordance, leaving the header (name, auto-tag pill,
   * deadline + overdue badge, progress bar) visible. Persisted to storage
   * so the state survives reloads and syncs across tabs via storage.onChanged.
   * Existing goals (pre-[1.0.11]) without the field render as expanded via
   * the render-time `goal.isCollapsed === true` strict check — no migration.
   * @returns {Promise<object|null>}
   */
  async function updateGoalCollapsed(data, goalId, isCollapsed, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var goal = findLiveGoal(ws, goalId);
    if (!goal) return null;
    var v = !!isCollapsed;
    if (goal.isCollapsed === v) return goal;
    goal.isCollapsed = v;
    await saveAll(data);
    return goal;
  }

  /**
   * Renumber active goals' displayOrder values to match the order of the
   * provided id list. Used by the [1.0.11.1] Tasks tab goal drag-to-reorder
   * — Sortable's onUpdate handler reads the new DOM order, then this method
   * persists by mapping each id to its index (0, 1, 2, ...). Single saveAll
   * for the whole batch.
   *
   * Validation rejects the call (returns null without writing) if:
   *   - orderedGoalIds is not an array of strings,
   *   - any id is missing from the workspace's goals,
   *   - any id refers to a soft-deleted goal (deletedAt set), or
   *   - any id refers to a non-active goal (status !== "active").
   *
   * Goals NOT in orderedGoalIds keep their existing displayOrder. Callers
   * are expected to pass the full active set so the resulting indexes are
   * dense; otherwise the omitted goals will collide with the new indexes.
   * @returns {Promise<object[]|null>} the workspace's goals array on success
   */
  async function reorderGoals(data, orderedGoalIds, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    if (!ws) return null;
    if (!Array.isArray(orderedGoalIds)) {
      console.warn("[LaunchPad] reorderGoals: orderedGoalIds must be an array");
      return null;
    }
    var goals = ensureGoalsArray(ws);
    var goalById = {};
    goals.forEach(function (g) { goalById[g.id] = g; });
    for (var i = 0; i < orderedGoalIds.length; i++) {
      var id = orderedGoalIds[i];
      if (typeof id !== "string") {
        console.warn("[LaunchPad] reorderGoals: every id must be a string");
        return null;
      }
      var g = goalById[id];
      if (!g) {
        console.warn("[LaunchPad] reorderGoals: id not found in workspace: " + id);
        return null;
      }
      if (g.deletedAt) {
        console.warn("[LaunchPad] reorderGoals: id refers to a soft-deleted goal: " + id);
        return null;
      }
      if (g.status !== "active") {
        console.warn("[LaunchPad] reorderGoals: id refers to a non-active goal: " + id);
        return null;
      }
    }
    for (var j = 0; j < orderedGoalIds.length; j++) {
      goalById[orderedGoalIds[j]].displayOrder = j;
    }
    await saveAll(data);
    return goals;
  }

  /**
   * Update a goal's deadline. Pass null to clear.
   * @returns {Promise<object|null>}
   */
  async function updateGoalDeadline(data, goalId, newDeadlineAt, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var goal = findLiveGoal(ws, goalId);
    if (!goal) return null;
    if (newDeadlineAt !== null && newDeadlineAt !== undefined && typeof newDeadlineAt !== "number") {
      console.warn("[LaunchPad] updateGoalDeadline: newDeadlineAt must be a number or null");
      return null;
    }
    var v = (newDeadlineAt === undefined) ? null : newDeadlineAt;
    if (goal.deadlineAt === v) return goal;
    goal.deadlineAt = v;
    await saveAll(data);
    return goal;
  }

  /**
   * Mark a goal complete. Idempotent if already completed.
   * Called from [1.0.8]'s task-completion handler (when last incomplete child
   * finishes) or directly for manual "Mark complete" actions.
   * @returns {Promise<object|null>}
   */
  async function completeGoal(data, goalId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var goal = findLiveGoal(ws, goalId);
    if (!goal) return null;
    if (goal.status === "completed") return goal;
    goal.status = "completed";
    var goalNow = Date.now();
    goal.completedAt = goalNow;
    // [1.0.23] Achievements — manual goal completion, riding this write.
    achievementsOnCompletion(data, "goal-completed", { goal: goal }, goalNow);
    await saveAll(data);
    return goal;
  }

  /**
   * Reactivate a completed goal. Idempotent if already active.
   * @returns {Promise<object|null>}
   */
  async function reactivateGoal(data, goalId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var goal = findLiveGoal(ws, goalId);
    if (!goal) return null;
    if (goal.status === "active") return goal;
    goal.status = "active";
    goal.completedAt = null;
    await saveAll(data);
    return goal;
  }

  /**
   * Soft-delete a goal via deletedAt. Returns metadata about cascaded child
   * records so callers can show "X tasks moved to trash" toasts in [1.0.10].
   *
   * Cascade hooks present but no-op in [1.0.7]: workspace.tasks and
   * workspace.tags don't have records yet. When [1.0.8] / [1.0.9] populate
   * those types, the same timestamp soft-deletes child tasks (goalId match)
   * and the auto-tag (autoGeneratedFromGoalId match) without further code
   * changes here.
   *
   * @returns {Promise<{ goal: object, cascadedTaskIds: string[], cascadedTagId: string|null }|null>}
   */
  async function deleteGoal(data, goalId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var goal = findLiveGoal(ws, goalId);
    if (!goal) return null;
    var result = softDeleteGoalInPlace(ws, goal, Date.now());
    await saveAll(data);
    return result;
  }

  // [Tasks] Goal soft-delete + cascade, extracted from deleteGoal verbatim so
  // batched callers (the Completed box's "Clear") reuse the exact cascade rules
  // in a SINGLE saveAll instead of duplicating them. Mutates in place; no
  // saveAll — the caller batches.
  function softDeleteGoalInPlace(ws, goal, now) {
    goal.deletedAt = now;

    var cascadedTaskIds = [];
    if (Array.isArray(ws.tasks)) {
      ws.tasks.forEach(function (t) {
        if (t && t.goalId === goal.id && !t.deletedAt) {
          t.deletedAt = now;
          cascadedTaskIds.push(t.id);
        }
      });
    }

    // [1.0.9.2] round 7: cascade tightened. Only soft-delete the tag if it's
    // still tied to THIS goal (autoGeneratedFromGoalId === goalId). Reused
    // tags have autoGeneratedFromGoalId cleared in createGoal's dedup block
    // so they survive the originating goal's deletion when other goals
    // depend on them. Manual tags (autoGeneratedFromGoalId === null) are
    // also preserved — never cascade-delete a tag the user created by hand,
    // even if some goal happens to reference it via autoTagId.
    var cascadedTagId = null;
    if (goal.autoTagId && Array.isArray(ws.tags)) {
      var tag = ws.tags.find(function (t) { return t && t.id === goal.autoTagId; });
      if (tag && !tag.deletedAt && tag.autoGeneratedFromGoalId === goal.id) {
        tag.deletedAt = now;
        cascadedTagId = tag.id;
      }
    }

    return { goal: goal, cascadedTaskIds: cascadedTaskIds, cascadedTagId: cascadedTagId };
  }

  /**
   * Active goals: deletedAt === null && status === 'active'.
   * Order preserved as stored (caller sorts by displayOrder if it cares).
   */
  function getActiveGoals(workspace) {
    var goals = ensureGoalsArray(workspace);
    if (!goals) return [];
    return goals.filter(function (g) { return !g.deletedAt && g.status === "active"; });
  }

  /**
   * Completed goals: deletedAt === null && status === 'completed'.
   */
  function getCompletedGoals(workspace) {
    var goals = ensureGoalsArray(workspace);
    if (!goals) return [];
    return goals.filter(function (g) { return !g.deletedAt && g.status === "completed"; });
  }

  /**
   * All non-deleted goals (active + completed).
   */
  function getAllGoals(workspace) {
    var goals = ensureGoalsArray(workspace);
    if (!goals) return [];
    return goals.filter(function (g) { return !g.deletedAt; });
  }

  /**
   * Soft-deleted (trashed) goals: deletedAt !== null. Powers the Tasks-tab
   * Deleted box. Not sorted here — the caller orders by deletedAt.
   */
  function getDeletedGoals(workspace) {
    var goals = ensureGoalsArray(workspace);
    if (!goals) return [];
    return goals.filter(function (g) { return g.deletedAt != null; });
  }

  /**
   * Restore a soft-deleted goal (deletedAt -> null). Per trash-bin.md the goal
   * returns to the goals list; its separately-trashed child tasks stay trashed
   * (they carry their own deletedAt and are restored individually). Finds the
   * goal regardless of deleted state (findLiveGoal would skip it). Idempotent on
   * an already-live goal. @returns {Promise<object|null>}
   */
  async function restoreGoal(data, goalId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var goals = ws && ws.goals;
    if (!Array.isArray(goals)) return null;
    var goal = goals.find(function (g) { return g && g.id === goalId; });
    if (!goal) return null;
    if (goal.deletedAt == null) return goal;
    goal.deletedAt = null;
    await saveAll(data);
    return goal;
  }

  /**
   * Permanently delete a goal — hard splice from ws.goals, no recovery. The
   * ONLY delete that is irreversible (per trash-bin.md, permanent delete is the
   * only action that confirms; the caller shows the modal). Removes just the
   * goal record; any cascade-trashed child tasks keep their own deletedAt and
   * remain as their own Deleted-box rows / purge on their own schedule.
   * @returns {Promise<boolean>} true if a goal was removed.
   */
  async function deleteGoalPermanent(data, goalId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var goals = ws && ws.goals;
    if (!Array.isArray(goals)) return false;
    var idx = goals.findIndex(function (g) { return g && g.id === goalId; });
    if (idx === -1) return false;
    goals.splice(idx, 1);
    await saveAll(data);
    return true;
  }

  /**
   * Lookup by id. Returns null if the goal is missing OR soft-deleted.
   * Returns the goal even if completed.
   */
  function getGoalById(workspace, goalId) {
    var goals = ensureGoalsArray(workspace);
    if (!goals) return null;
    var goal = goals.find(function (g) { return g.id === goalId; });
    if (!goal || goal.deletedAt) return null;
    return goal;
  }

  /**
   * [1.0.11.14] Auto-tag resolution for a goal in the active workspace.
   * Pure function over `data`. Returns the goal's autoTagId string or
   * null if the goal is missing, soft-deleted, or has no auto-tag bound.
   * Used by reassignTaskToGoal's auto-tag swap math. Defensive: returns
   * null on any missing input rather than throwing, so callers can
   * treat "source goal deleted mid-drag" as "no source auto-tag to
   * remove" without branching.
   */
  function getGoalAutoTagId(data, goalId) {
    if (goalId === null || goalId === undefined) return null;
    var ws = resolveWorkspaceFromData(data);
    if (!ws) return null;
    var goal = getGoalById(ws, goalId);
    if (!goal) return null;
    return goal.autoTagId || null;
  }

  // ===== Tasks =====
  //
  // Task CRUD on the Storage namespace, mirroring the [1.0.7] goal CRUD shape.
  // No UI surface in [1.0.8]; the Tasks tab UI ([1.0.10]) hooks these later.
  // Verification path: console-callable via Storage.* (matches the
  // ProAccess.applyLicenseKey console pattern).
  //
  // Soft-delete via deletedAt from day one — every read filters out tombstoned
  // tasks. Cascade activation: [1.0.7]'s deleteGoal already iterates
  // workspace.tasks looking for matching goalId records; with tasks now
  // populated, that cascade activates organically without touching deleteGoal.
  //
  // Auto-completion: completeTask flips the parent goal to 'completed' inline
  // when the last incomplete sibling task in the same goal completes
  // (avoiding a double saveAll vs calling Storage.completeGoal). Symmetric
  // auto-reactivation: reactivateTask flips a 'completed' parent goal back
  // to 'active' so the system never sits in the awkward
  // "goal completed but has an incomplete child" state. completeTask and
  // reactivateTask return rich shapes (task + goal-flip metadata) so
  // [1.0.10]'s UI can fire goal-completion celebration animations without
  // re-querying state.
  //
  // Stub-but-stored fields: priority (no visual treatment until [1.0.12]),
  // tagIds (no auto-tag inheritance until [1.0.9]), isRecurringInstance +
  // recurringTemplateId (defaults; [1.0.14] populates). Data model is
  // complete from day one even though enforcement / UI lands later.
  //
  // Active task selection (data.activeTask top-level) lives in its own section
  // below — see "Active task ([1.0.16])" for setActiveTask / clearActiveTask /
  // resolveActiveTask. Deliberately NOT wired into completeTask or deleteTask:
  // resolveActiveTask self-heals a stale record on read, so no mutation path
  // has to remember to clear it (and none could cover the other-tab case).

  var VALID_PRIORITIES = ["low", "medium", "high", "urgent"];

  function genTaskId() {
    return "task_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function ensureTasksArray(workspace) {
    if (!workspace) return null;
    if (!Array.isArray(workspace.tasks)) workspace.tasks = [];
    return workspace.tasks;
  }

  function findLiveTask(workspace, taskId) {
    var tasks = ensureTasksArray(workspace);
    if (!tasks) return null;
    var task = tasks.find(function (t) { return t.id === taskId; });
    if (!task || task.deletedAt) return null;
    return task;
  }

  function nextTaskDisplayOrder(tasks) {
    var max = 0;
    tasks.forEach(function (t) {
      if (typeof t.displayOrder === "number" && t.displayOrder > max) max = t.displayOrder;
    });
    return max + 1;
  }

  function isValidPriority(p) {
    return p === null || VALID_PRIORITIES.indexOf(p) !== -1;
  }

  // [1.0.14] Shared task-record builder. Constructs (does NOT persist) a task
  // object from already-validated fields, so createTask and the recurring sweep
  // produce an identical shape from one place. displayOrder is read at build
  // time, so callers that build several in a row must push each before building
  // the next (the sweep does). Persistence + validation stay with the caller.
  function newTaskObject(ws, o) {
    o = o || {};
    return {
      id: genTaskId(),
      name: o.name,
      description: (o.description === undefined || o.description === null) ? "" : String(o.description),
      goalId: (o.goalId === undefined) ? null : o.goalId,
      dueAt: (o.dueAt === undefined) ? null : o.dueAt,
      priority: (o.priority === undefined) ? null : o.priority,
      tagIds: Array.isArray(o.tagIds) ? o.tagIds.slice() : [],
      completed: false,
      completedAt: null,
      createdAt: Date.now(),
      deletedAt: null,
      displayOrder: nextTaskDisplayOrder(ensureTasksArray(ws)),
      isRecurringInstance: !!o.isRecurringInstance,
      recurringTemplateId: (o.recurringTemplateId === undefined) ? null : o.recurringTemplateId
    };
  }

  /**
   * Create a task in the (optionally specified) workspace.
   *
   * Tag inheritance (extended in [1.0.9]):
   *   When `tagIds` is omitted (undefined or null) AND `goalId` references a
   *   live goal AND that goal's `autoTagId` points to a live (non-deleted)
   *   tag, the new task's `tagIds` defaults to `[goal.autoTagId]`.
   *   Explicit `tagIds` (including `[]` for "no tags") is respected verbatim
   *   — empty array is "explicitly no tags", not "default". If the parent
   *   goal's `autoTagId` is null or points to a soft-deleted tag, tagIds
   *   defaults to `[]`.
   *
   * @param {object} data
   * @param {object} fields — { name (required), description?, goalId?, dueAt?, priority?, tagIds? }
   * @param {string} [workspaceId]
   * @returns {Promise<object|null>}
   */
  async function createTask(data, fields, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    if (!ws) {
      console.warn("[LaunchPad] createTask: workspace not found");
      return null;
    }
    var f = fields || {};
    var name = typeof f.name === "string" ? f.name.trim() : "";
    if (!name) {
      console.warn("[LaunchPad] createTask: name is required and must be non-empty after trim");
      return null;
    }

    var goalId = (f.goalId === undefined) ? null : f.goalId;
    if (goalId !== null) {
      if (typeof goalId !== "string") {
        console.warn("[LaunchPad] createTask: goalId must be a string or null");
        return null;
      }
      if (!findLiveGoal(ws, goalId)) {
        console.warn("[LaunchPad] createTask: goalId does not reference a live goal:", goalId);
        return null;
      }
    }

    var dueAt = (f.dueAt === undefined) ? null : f.dueAt;
    if (dueAt !== null && typeof dueAt !== "number") {
      console.warn("[LaunchPad] createTask: dueAt must be a number or null");
      return null;
    }

    var priority = (f.priority === undefined) ? null : f.priority;
    if (!isValidPriority(priority)) {
      console.warn("[LaunchPad] createTask: priority must be one of 'low'|'medium'|'high'|'urgent'|null");
      return null;
    }

    // Inheritance: undefined / null tagIds + live parent goal with live
    // autoTagId → default to [autoTagId]. Explicit tagIds (including [])
    // respected as-is — empty array means "explicitly no tags", not "default".
    var tagIds;
    if (f.tagIds === undefined || f.tagIds === null) {
      tagIds = [];
      if (goalId !== null) {
        var parentGoal = findLiveGoal(ws, goalId);
        if (parentGoal && parentGoal.autoTagId && findLiveTag(ws, parentGoal.autoTagId)) {
          tagIds = [parentGoal.autoTagId];
        }
      }
    } else if (!Array.isArray(f.tagIds)) {
      console.warn("[LaunchPad] createTask: tagIds must be an array of strings");
      return null;
    } else if (!f.tagIds.every(function (t) { return typeof t === "string"; })) {
      console.warn("[LaunchPad] createTask: tagIds must contain only strings");
      return null;
    } else {
      tagIds = f.tagIds.slice();
    }

    var description = (f.description === undefined || f.description === null) ? "" : String(f.description);

    // [1.0.14] P2 — createTask now accepts the recurring-instance markers so the
    // generic create path can also mint instances; default false/null preserves
    // every existing caller's behavior byte-for-byte.
    var isRecurringInstance = (f.isRecurringInstance === undefined) ? false : !!f.isRecurringInstance;
    var recurringTemplateId = (f.recurringTemplateId === undefined || f.recurringTemplateId === null)
      ? null : String(f.recurringTemplateId);

    var tasks = ensureTasksArray(ws);
    var task = newTaskObject(ws, {
      name: name,
      description: description,
      goalId: goalId,
      dueAt: dueAt,
      priority: priority,
      tagIds: tagIds,
      isRecurringInstance: isRecurringInstance,
      recurringTemplateId: recurringTemplateId
    });
    tasks.push(task);
    await saveAll(data);
    return task;
  }

  /**
   * Rename a task. Returns null if missing / soft-deleted / empty name.
   * @returns {Promise<object|null>}
   */
  async function renameTask(data, taskId, newName, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var task = findLiveTask(ws, taskId);
    if (!task) return null;
    var name = typeof newName === "string" ? newName.trim() : "";
    if (!name) {
      console.warn("[LaunchPad] renameTask: newName must be non-empty after trim");
      return null;
    }
    if (task.name === name) return task;
    task.name = name;
    await saveAll(data);
    return task;
  }

  /**
   * Update a task's description. Coerces to string. Empty allowed.
   * @returns {Promise<object|null>}
   */
  async function updateTaskDescription(data, taskId, newDescription, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var task = findLiveTask(ws, taskId);
    if (!task) return null;
    var desc = (newDescription === undefined || newDescription === null) ? "" : String(newDescription);
    if (task.description === desc) return task;
    task.description = desc;
    await saveAll(data);
    return task;
  }

  /**
   * Update a task's due date. Pass null to clear.
   * @returns {Promise<object|null>}
   */
  async function updateTaskDueAt(data, taskId, newDueAt, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var task = findLiveTask(ws, taskId);
    if (!task) return null;
    if (newDueAt !== null && newDueAt !== undefined && typeof newDueAt !== "number") {
      console.warn("[LaunchPad] updateTaskDueAt: newDueAt must be a number or null");
      return null;
    }
    var v = (newDueAt === undefined) ? null : newDueAt;
    if (task.dueAt === v) return task;
    task.dueAt = v;
    await saveAll(data);
    return task;
  }

  /**
   * Update a task's priority. Accepts 'low'|'medium'|'high'|'urgent'|null.
   * @returns {Promise<object|null>}
   */
  async function updateTaskPriority(data, taskId, newPriority, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var task = findLiveTask(ws, taskId);
    if (!task) return null;
    if (!isValidPriority(newPriority)) {
      console.warn("[LaunchPad] updateTaskPriority: newPriority must be one of 'low'|'medium'|'high'|'urgent'|null");
      return null;
    }
    if (task.priority === newPriority) return task;
    task.priority = newPriority;
    await saveAll(data);
    return task;
  }

  /**
   * Complete a task. If this completes the last incomplete sibling under an
   * active parent goal, the goal flips to 'completed' inline (same timestamp,
   * single saveAll). Idempotent: re-calling on a completed task returns the
   * task with goalAutoCompleted=false.
   *
   * @returns {Promise<{ task: object, goalAutoCompleted: boolean, autoCompletedGoal: object|null }|null>}
   */
  async function completeTask(data, taskId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var task = findLiveTask(ws, taskId);
    if (!task) return null;
    if (task.completed) {
      return { task: task, goalAutoCompleted: false, autoCompletedGoal: null };
    }
    var now = Date.now();
    task.completed = true;
    task.completedAt = now;

    var goalAutoCompleted = false;
    var autoCompletedGoal = null;
    if (task.goalId) {
      var goal = findLiveGoal(ws, task.goalId);
      if (goal && goal.status === "active") {
        var siblings = (ws.tasks || []).filter(function (t) {
          return t.goalId === task.goalId && !t.deletedAt;
        });
        var allComplete = siblings.length > 0 && siblings.every(function (t) { return t.completed; });
        if (allComplete) {
          goal.status = "completed";
          goal.completedAt = now;
          goalAutoCompleted = true;
          autoCompletedGoal = goal;
        }
      }
    }

    // [1.0.23] Achievements — evaluate on the completion transition, riding this
    // same write (mutate-only, no extra saveAll). task-completed always; the
    // auto-goal branch ALSO emits goal-completed, so a goal finished by its last
    // task increments the lifetime counter — the two-path trap from the audit.
    achievementsOnCompletion(data, "task-completed", { task: task }, now);
    if (goalAutoCompleted) achievementsOnCompletion(data, "goal-completed", { goal: autoCompletedGoal }, now);

    await saveAll(data);
    return { task: task, goalAutoCompleted: goalAutoCompleted, autoCompletedGoal: autoCompletedGoal };
  }

  /**
   * Reactivate a completed task. If the parent goal is currently 'completed',
   * the goal flips back to 'active' inline (single saveAll). Symmetric
   * inverse of auto-completion. Idempotent on already-active tasks.
   *
   * @returns {Promise<{ task: object, goalAutoReactivated: boolean, autoReactivatedGoal: object|null }|null>}
   */
  async function reactivateTask(data, taskId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var task = findLiveTask(ws, taskId);
    if (!task) return null;
    if (!task.completed) {
      return { task: task, goalAutoReactivated: false, autoReactivatedGoal: null };
    }
    task.completed = false;
    task.completedAt = null;

    var goalAutoReactivated = false;
    var autoReactivatedGoal = null;
    if (task.goalId) {
      var goal = findLiveGoal(ws, task.goalId);
      if (goal && goal.status === "completed") {
        goal.status = "active";
        goal.completedAt = null;
        goalAutoReactivated = true;
        autoReactivatedGoal = goal;
      }
    }

    await saveAll(data);
    return { task: task, goalAutoReactivated: goalAutoReactivated, autoReactivatedGoal: autoReactivatedGoal };
  }

  /**
   * Duplicate a task as a "(copy)" variant. Preserves description, goalId,
   * dueAt, priority, tagIds. Resets completion state, timestamps, and
   * recurring-instance fields. Returns the new task.
   *
   * @returns {Promise<object|null>}
   */
  async function duplicateTask(data, taskId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var orig = findLiveTask(ws, taskId);
    if (!orig) return null;
    var tasks = ensureTasksArray(ws);
    var copy = {
      id: genTaskId(),
      name: orig.name + " (copy)",
      description: orig.description,
      goalId: orig.goalId,
      dueAt: orig.dueAt,
      priority: orig.priority,
      tagIds: Array.isArray(orig.tagIds) ? orig.tagIds.slice() : [],
      completed: false,
      completedAt: null,
      createdAt: Date.now(),
      deletedAt: null,
      displayOrder: nextTaskDisplayOrder(tasks),
      isRecurringInstance: false,
      recurringTemplateId: null
    };
    tasks.push(copy);
    await saveAll(data);
    return copy;
  }

  /**
   * Soft-delete a task via deletedAt. No cascade — tasks don't have children.
   * @returns {Promise<object|null>}
   */
  async function deleteTask(data, taskId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var task = findLiveTask(ws, taskId);
    if (!task) return null;
    task.deletedAt = Date.now();
    await saveAll(data);
    return task;
  }

  /**
   * Restore a soft-deleted task (deletedAt -> null). Counterpart to deleteTask;
   * used by the 5-second Undo toast on direct delete and the Tasks-tab Deleted
   * box. Finds the task regardless of deleted state (findLiveTask would skip it).
   * Idempotent on an already-live task.
   *
   * Restore homing (trash-bin.md): task -> parent goal if that goal is still
   * live; if the parent goal is trashed or purged, the task becomes standalone
   * (goalId -> null) so it lands in the Standalone section rather than dangling
   * under a goal that no longer renders. The Undo path is unaffected in practice
   * (the parent goal is virtually always still live moments after deletion).
   * @returns {Promise<object|null>}
   */
  async function restoreTask(data, taskId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var tasks = ws && ws.tasks;
    if (!Array.isArray(tasks)) return null;
    var task = tasks.find(function (t) { return t && t.id === taskId; });
    if (!task) return null;
    if (task.deletedAt == null) return task;
    task.deletedAt = null;
    // Re-home to standalone if the parent goal is no longer live.
    if (task.goalId != null && !findLiveGoal(ws, task.goalId)) {
      task.goalId = null;
    }
    await saveAll(data);
    return task;
  }

  /**
   * Soft-deleted (trashed) tasks: deletedAt !== null. Powers the Tasks-tab
   * Deleted box. Not sorted here — the caller orders by deletedAt.
   */
  function getDeletedTasks(workspace) {
    var tasks = ensureTasksArray(workspace);
    if (!tasks) return [];
    return tasks.filter(function (t) { return t.deletedAt != null; });
  }

  /**
   * Permanently delete a task — hard splice from ws.tasks, no recovery. The
   * only irreversible delete (the caller confirms via modal per trash-bin.md).
   * @returns {Promise<boolean>} true if a task was removed.
   */
  async function deleteTaskPermanent(data, taskId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var tasks = ws && ws.tasks;
    if (!Array.isArray(tasks)) return false;
    var idx = tasks.findIndex(function (t) { return t && t.id === taskId; });
    if (idx === -1) return false;
    tasks.splice(idx, 1);
    // [1.4.2] PATH 2 of 3. Before the write, so the splice and the nulling land
    // in the same saveAll and no reader can observe a session pointing at a task
    // that is already gone.
    detachSessionsFromTasks(ws, [taskId]);
    await saveAll(data);
    // [2.1] The OTHER exit for a task. Same announcement, same reason.
    announceTasksPurged([taskId]);
    return true;
  }

  // ===== [Tasks] Bottom-box bulk actions =====
  //
  // Batched counterparts of the per-item Deleted/Completed box actions. Each
  // mutates in memory and persists in ONE saveAll (the per-item functions each
  // saveAll, so looping them would fan out N writes). Scoped to a single
  // workspace — the boxes only ever show the active one.

  /**
   * Empty the trash: hard-remove EVERY soft-deleted goal and task in the
   * workspace (same splice the per-item deleteGoalPermanent/deleteTaskPermanent
   * do). Irreversible — the caller confirms. @returns {Promise<number>} removed.
   */
  async function emptyTrash(data, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    if (!ws) return 0;
    var removed = 0;
    if (Array.isArray(ws.goals)) {
      for (var gi = ws.goals.length - 1; gi >= 0; gi--) {
        if (ws.goals[gi] && ws.goals[gi].deletedAt != null) { ws.goals.splice(gi, 1); removed++; }
      }
    }
    // [1.4.2] PATH 3 of 3, and the one that was missing from BOTH registrations.
    // This function hard-splices tasks exactly as deleteTaskPermanent does, but it
    // announced nothing and nulled nothing - the [2.1] comment on announceTasksPurged
    // still says "both exits fire it", which was true when it was written and stopped
    // being true the moment this bulk action existed. So emptying the trash leaked a
    // lifetime-accumulator entry per task, and would have left a session pointing at a
    // ghost. The ids are collected here for both duties.
    var purgedTaskIds = [];
    if (Array.isArray(ws.tasks)) {
      for (var ti = ws.tasks.length - 1; ti >= 0; ti--) {
        if (ws.tasks[ti] && ws.tasks[ti].deletedAt != null) {
          if (ws.tasks[ti].id) purgedTaskIds.push(ws.tasks[ti].id);
          ws.tasks.splice(ti, 1); removed++;
        }
      }
    }
    detachSessionsFromTasks(ws, purgedTaskIds);
    if (removed > 0) await saveAll(data);
    announceTasksPurged(purgedTaskIds);
    return removed;
  }

  /**
   * Restore every soft-deleted goal and task in the workspace. Non-destructive.
   * Goals are restored FIRST so a task whose parent goal was trashed alongside it
   * finds that parent live and stays under it; only a task whose parent is still
   * gone (or purged) re-homes to standalone — same per-item restore semantics
   * (restoreGoal / restoreTask), just resolved in the right order.
   * @returns {Promise<number>} restored.
   */
  async function restoreAllTrash(data, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    if (!ws) return 0;
    var restored = 0;
    (ws.goals || []).forEach(function (g) {
      if (g && g.deletedAt != null) { g.deletedAt = null; restored++; }
    });
    (ws.tasks || []).forEach(function (t) {
      if (t && t.deletedAt != null) {
        t.deletedAt = null;
        if (t.goalId != null && !findLiveGoal(ws, t.goalId)) t.goalId = null;
        restored++;
      }
    });
    if (restored > 0) await saveAll(data);
    return restored;
  }

  /**
   * Clear the Completed box: SOFT-delete (deletedAt = now, NOT permanent) every
   * item the box shows — completed goals (via the shared softDeleteGoalInPlace
   * cascade, so their child tasks + owned auto-tag follow, exactly as a per-item
   * goal delete does) and completed STANDALONE tasks. Cleared items land in the
   * Deleted box with fresh 30-day countdowns (complete -> clear -> Deleted ->
   * purge). Completed children of an ACTIVE goal are not box items and are left
   * alone. @returns {Promise<number>} count of BOX ITEMS cleared (cascaded
   * children are not counted — they aren't box rows).
   */
  async function clearCompletedItems(data, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    if (!ws) return 0;
    var now = Date.now();
    var cleared = 0;
    (ws.goals || []).forEach(function (g) {
      if (g && !g.deletedAt && g.status === "completed") {
        softDeleteGoalInPlace(ws, g, now);
        cleared++;
      }
    });
    (ws.tasks || []).forEach(function (t) {
      if (t && !t.deletedAt && t.completed && t.goalId === null) {
        t.deletedAt = now;
        cleared++;
      }
    });
    if (cleared > 0) await saveAll(data);
    return cleared;
  }

  // 30-day trash retention (trash-bin.md Auto-Purge).
  var TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

  /**
   * [Trash] Full trash auto-purge (trash-bin.md Auto-Purge). Hard-removes every
   * soft-deleted item whose deletedAt is older than 30 days, across ALL
   * workspaces and ALL collections: groups (+ their groupOrder entry), bookmarks
   * (shortcuts inside surviving groups, and their variants), goals, tasks,
   * recurring templates, goal templates, and tags. When a tag purges, its id is
   * cleaned out of every item's tagIds array (groups, shortcuts, tasks,
   * recurring templates) and any goal.autoTagId pointing at it, in the same
   * batch — matching the spec's "remove the tag's ID from all items' tagIds
   * arrays" step.
   *
   * Runs from two places (D2/render + the daily 'trash-purge' alarm). All array
   * splices execute SYNCHRONOUSLY before the single awaited saveAll, so the
   * un-awaited opportunistic render-path caller still reads purged arrays on the
   * next line. saveAll only runs when something was removed — no write
   * amplification on the common no-op render. @returns {Promise<number>} count
   * of purged items (tagIds cleanup is not counted).
   */
  // [2.1] Permanently-removed tasks are ANNOUNCED, not chased.
  //
  // The engine keeps a lifetime accumulator keyed by task id and has to drop an
  // entry when its task leaves for good. It cannot be called from here without
  // inverting the module dependency - storage.js knows nothing about tracking.js
  // and the reverse is what holds today - so the exit points announce and the
  // engine registers itself as a listener.
  //
  // Both exits fire it: this sweep, and deleteTaskPermanent.
  var taskPurgeListeners = [];
  function onTasksPurged(fn) {
    if (typeof fn === "function") taskPurgeListeners.push(fn);
  }
  function announceTasksPurged(taskIds) {
    if (!taskIds || !taskIds.length) return;
    taskPurgeListeners.forEach(function (fn) {
      try { fn(taskIds.slice()); }
      catch (e) { console.error("[LaunchPad] task-purge listener failed:", e); }
    });
  }

  // ===== [1.3.0 R2] THE BACKUP ENVELOPE BUILDER =====
  //
  // ONE builder, and it lives in storage.js because this is the only file both
  // contexts load: newtab.html scripts it and background.js importScripts it.
  // The manual export and the weekly alarm therefore serialize the same bytes
  // by construction rather than by two functions agreeing to.
  var BACKUP_SCHEMA = 2;
  var BACKUP_STORE_KEYS = ["data", "launchpad_background", "tracking_sessions", "tracking_days"];

  function backupFilename(now) {
    return "launchpad-backup-" + new Date(now || Date.now()).toISOString().slice(0, 10) + ".json";
  }

  async function buildBackupEnvelope() {
    // ONE get for every key. The tracking pair is written by persist() in a
    // single set(), which chrome.storage makes atomic across the keys in that
    // call, so a read issued while the engine is mid-write sees either both-old
    // or both-new and never a torn pair. A mid-write export is HARMLESS rather
    // than prevented, which is why this needs no lock in either context.
    var raw = await chrome.storage.local.get(BACKUP_STORE_KEYS);
    return {
      launchpadBackup: true,
      version: BACKUP_SCHEMA,
      exportedAt: new Date().toISOString(),
      appVersion: chrome.runtime.getManifest().version,
      stores: {
        // Read raw rather than through getAll so real-but-unusual data is not
        // masked by the default skeleton - but a fresh install has no data key
        // at all, which would stringify to null and produce an unrestorable file.
        data: raw.data || getDefaultData(),
        launchpad_background: raw.launchpad_background || null,
        tracking_sessions: raw.tracking_sessions || null,
        tracking_days: raw.tracking_days || null
      }
    };
  }

  // A data: URL, because the SERVICE WORKER CANNOT MAKE A BLOB URL. Measured, not
  // assumed: in ServiceWorkerGlobalScope, URL exists but URL.createObjectURL is
  // undefined, so the page trick of createObjectURL(new Blob(...)) is simply not
  // available to the scheduled path. btoa is available, and
  // chrome.downloads.download accepts a data: URL from the worker (verified: it
  // returned a download id and the file landed).
  //
  // BASE64 IS CHUNKED AND UTF-8 FIRST. btoa is Latin-1 only, so a note with an
  // accent or an emoji throws outright; and String.fromCharCode.apply over a
  // whole backup would blow the argument limit on a real profile. Encode to
  // UTF-8 bytes, then base64 in fixed slices.
  function backupDataUrl(envelope) {
    var json = JSON.stringify(envelope, null, 2);
    var bytes = new TextEncoder().encode(json);
    var CHUNK = 0x8000;
    var binary = "";
    for (var i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return "data:application/json;base64," + btoa(binary);
  }

  // ===== [1.3.0 R2] Automatic backup settings =====
  //
  // Same reader/writer shape as getTextSize: coercion is provable from a Node VM
  // and a junk value is never written.
  function getAutoBackupEnabled(data) {
    return !!(data && data.settings && data.settings.autoBackupEnabled === true);
  }

  async function setAutoBackupEnabled(data, on) {
    if (!data || !data.settings) return false;
    var next = !!on;
    if (getAutoBackupEnabled(data) === next) return false;
    if (next) data.settings.autoBackupEnabled = true;
    else delete data.settings.autoBackupEnabled;
    await saveAll(data);
    return true;
  }

  // Written ONLY from the downloads callback, so the surface can never claim a
  // backup that did not land.
  function getLastBackupAt(data) {
    var v = data && data.settings && data.settings.lastBackupAt;
    return typeof v === "number" ? v : null;
  }

  async function setLastBackupAt(data, ts) {
    if (!data || !data.settings) return false;
    if (typeof ts !== "number") return false;
    data.settings.lastBackupAt = ts;
    await saveAll(data);
    return true;
  }

  async function purgeExpiredTrash(data) {
    if (!data || !Array.isArray(data.workspaces)) return 0;
    var cutoff = Date.now() - TRASH_TTL_MS;
    var removed = 0;
    var purgedTaskIds = [];
    var expired = function (item) {
      return item && item.deletedAt != null && item.deletedAt < cutoff;
    };

    data.workspaces.forEach(function (ws) {
      if (!ws) return;
      var purgedTagIds = {};
      var wsPurgedTaskIds = [];

      // Groups (+ groupOrder), then bookmarks/variants inside surviving groups.
      if (Array.isArray(ws.groups)) {
        for (var gi = ws.groups.length - 1; gi >= 0; gi--) {
          var group = ws.groups[gi];
          if (expired(group)) {
            if (Array.isArray(ws.groupOrder)) {
              var oi = ws.groupOrder.indexOf(group.id);
              if (oi !== -1) ws.groupOrder.splice(oi, 1);
            }
            ws.groups.splice(gi, 1);
            removed++;
            continue;
          }
          if (Array.isArray(group.shortcuts)) {
            for (var si = group.shortcuts.length - 1; si >= 0; si--) {
              var sc = group.shortcuts[si];
              if (expired(sc)) { group.shortcuts.splice(si, 1); removed++; continue; }
              if (Array.isArray(sc.variants)) {
                for (var vi = sc.variants.length - 1; vi >= 0; vi--) {
                  if (expired(sc.variants[vi])) { sc.variants.splice(vi, 1); removed++; }
                }
              }
            }
          }
        }
      }

      // Simple per-workspace collections.
      // [1.1.3] "notes" registered here. This list is a hardcoded literal, not a
      // registry, so a new entity is invisible to the sweep until its key is added
      // - notes were soft-deleting correctly and simply never purging. The
      // expired() predicate needed no change: [1.1.0] gave notes the shared
      // epoch-ms deletedAt, so the arithmetic already worked.
      // [1.4.0] "namedSessions" registered here IN THE SAME COMMIT that introduces
      // the entity, per the rule notes paid for: this list is a hardcoded literal,
      // not a registry, so an unregistered entity soft-deletes correctly and then
      // never purges. Named sessions carry no tagIds, so they need no entry in the
      // tag-cascade batch below.
      ["goals", "tasks", "recurringTemplates", "goalTemplates", "notes", "namedSessions"].forEach(function (key) {
        var arr = ws[key];
        if (!Array.isArray(arr)) return;
        for (var i = arr.length - 1; i >= 0; i--) {
          if (expired(arr[i])) {
            // [2.1] Registered IN the enumeration: a task leaving here is a task
            // whose lifetime-accumulator entry must go with it.
            if (key === "tasks" && arr[i].id) {
              purgedTaskIds.push(arr[i].id);
              // [1.4.2] PATH 1 of 3. Collected per WORKSPACE as well, because
              // sessions are workspace-scoped and the outer list spans them all.
              wsPurgedTaskIds.push(arr[i].id);
            }
            arr.splice(i, 1); removed++;
          }
        }
      });

      // Tags — purge + record ids so their references can be cleaned.
      if (Array.isArray(ws.tags)) {
        for (var tgi = ws.tags.length - 1; tgi >= 0; tgi--) {
          var tag = ws.tags[tgi];
          if (expired(tag)) { purgedTagIds[tag.id] = true; ws.tags.splice(tgi, 1); removed++; }
        }
      }

      // Batch-clean purged tag ids out of every tagIds array + goal auto-tags.
      if (Object.keys(purgedTagIds).length) {
        var cleanTagIds = function (arr) {
          if (!Array.isArray(arr)) return;
          for (var k = arr.length - 1; k >= 0; k--) {
            if (purgedTagIds[arr[k]]) arr.splice(k, 1);
          }
        };
        (ws.groups || []).forEach(function (g) {
          cleanTagIds(g.tagIds);
          (g.shortcuts || []).forEach(function (s) { cleanTagIds(s.tagIds); });
        });
        (ws.tasks || []).forEach(function (t) { cleanTagIds(t.tagIds); });
        (ws.recurringTemplates || []).forEach(function (t) { cleanTagIds(t.tagIds); });
        // [1.1.3] Notes carry tagIds like tasks do, so they belong in the same
        // batch: trash-bin.md requires a purged tag id to be "cleaned up from all
        // items' tagIds arrays at that moment as part of the same batch sweep".
        (ws.notes || []).forEach(function (n) { cleanTagIds(n.tagIds); });
        (ws.goals || []).forEach(function (g) {
          if (g.autoTagId && purgedTagIds[g.autoTagId]) g.autoTagId = null;
        });
      }

      // [1.4.2] Sessions in THIS workspace lose any pointer to a task this sweep
      // just removed. Inside the workspace loop and before the single saveAll below.
      detachSessionsFromTasks(ws, wsPurgedTaskIds);
    });

    if (removed > 0) {
      await saveAll(data);
      console.log("[LaunchPad] Trash purge removed " + removed + " expired item(s)");
      // AFTER the sweep's own commit. This is a SEPARATE write, in a different
      // key owned by a different module; chrome.storage cannot make the two one
      // atom. A crash between them leaves a stale entry, never a wrong one.
      announceTasksPurged(purgedTaskIds);
    }
    return removed;
  }

  /**
   * Move a task to a different goal, or to standalone (newGoalIdOrNull = null).
   * Validates the target goal is live when non-null.
   *
   * @returns {Promise<object|null>}
   */
  async function moveTaskToGoal(data, taskId, newGoalIdOrNull, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var task = findLiveTask(ws, taskId);
    if (!task) return null;
    var target = (newGoalIdOrNull === undefined) ? null : newGoalIdOrNull;
    if (target !== null) {
      if (typeof target !== "string") {
        console.warn("[LaunchPad] moveTaskToGoal: newGoalId must be a string or null");
        return null;
      }
      if (!findLiveGoal(ws, target)) {
        console.warn("[LaunchPad] moveTaskToGoal: target goal not found or soft-deleted:", target);
        return null;
      }
    }
    if (task.goalId === target) return task;
    task.goalId = target;
    await saveAll(data);
    return task;
  }

  // [1.0.11.14] Cross-goal drag support for Tasks tab. The storage layer
  // for [1.0.11.2] Commit 1 — the SortableJS wiring and the name-collision
  // modal land in Commit 2. Three functions here:
  //   - hasTaskNameCollision: pure predicate, used by the modal to decide
  //     whether to prompt and used by reassignTaskToGoal to validate any
  //     resolved name still doesn't collide.
  //   - generateUniqueTaskName: pure, "name", "name (2)", "name (3)" walk;
  //     bumps an existing trailing " (N)" rather than appending a fresh
  //     " (2)". Used by callers that want auto-resolve without prompting.
  //   - reassignTaskToGoal: atomic mutation — goalId, tagIds (auto-tag
  //     swap), optional rename — followed by a single saveAll(). Throws
  //     on invalid input (rather than the warn+null pattern moveTaskToGoal
  //     uses) so the drag-end handler in Commit 2 surfaces problems
  //     loudly instead of silently no-op'ing on a typo.
  //
  // moveTaskToGoal stays as-is for callers that only need goalId
  // mutation without the auto-tag swap.

  /**
   * Trim-and-compare-case-sensitive collision check.
   * targetGoalId === null scopes to standalone tasks (task.goalId === null).
   * excludeTaskId is omitted from the search (so the dragged task does
   * not collide with itself).
   * Returns false when the active workspace has no tasks array.
   */
  function hasTaskNameCollision(data, name, targetGoalId, excludeTaskId) {
    if (typeof name !== "string") return false;
    var trimmed = name.trim();
    if (!trimmed) return false;
    var ws = resolveWorkspaceFromData(data);
    if (!ws) return false;
    var tasks = ensureTasksArray(ws);
    if (!tasks) return false;
    var scope = (targetGoalId === undefined) ? null : targetGoalId;
    return tasks.some(function (t) {
      if (!t || t.deletedAt) return false;
      if (excludeTaskId && t.id === excludeTaskId) return false;
      if (t.goalId !== scope) return false;
      return (typeof t.name === "string") && t.name.trim() === trimmed;
    });
  }

  /**
   * "name", "name (2)", "name (3)" suffix walk. Returns baseName
   * unchanged when no collision. If baseName already ends in " (N)",
   * increments N rather than appending a fresh " (2)".
   * Bounded by the finite number of tasks in the workspace.
   */
  function generateUniqueTaskName(data, baseName, targetGoalId, excludeTaskId) {
    if (typeof baseName !== "string") return baseName;
    var trimmed = baseName.trim();
    if (!trimmed) return baseName;
    if (!hasTaskNameCollision(data, trimmed, targetGoalId, excludeTaskId)) return trimmed;
    var match = trimmed.match(/^(.*?) \((\d+)\)$/);
    var root, n;
    if (match) {
      root = match[1];
      n = parseInt(match[2], 10) + 1;
    } else {
      root = trimmed;
      n = 2;
    }
    while (true) {
      var candidate = root + " (" + n + ")";
      if (!hasTaskNameCollision(data, candidate, targetGoalId, excludeTaskId)) return candidate;
      n++;
    }
  }

  /**
   * Atomic cross-goal task reassignment.
   *
   * - newGoalId === null moves the task to the standalone bucket.
   * - opts.newName, when present, renames the task in the same write.
   *
   * Auto-tag swap: removes the source goal's autoTagId (if any) and
   * adds the destination goal's autoTagId (if any). Set semantics
   * handle the edge cases:
   *   - source and target share the same auto-tag → delete-then-add
   *     leaves the tag present (only goalId changes).
   *   - task already carries the target auto-tag → Set.add is idempotent.
   *   - source goal soft-deleted mid-drag → getGoalAutoTagId returns
   *     null, delete is a no-op.
   *
   * Single Storage.saveAll() at the end — the [1.0.11.2] own-write
   * provenance gate handles the resulting onChanged correctly.
   *
   * Throws (rather than returning null) on invalid input so the
   * Commit 2 drag-end handler surfaces problems loudly:
   *   - taskId not found / soft-deleted in the active workspace
   *   - newGoalId non-null but not a string OR not a live goal
   *   - opts.newName present but not a non-empty trimmed string
   *
   * @returns {Promise<object>} the updated task
   */
  async function reassignTaskToGoal(data, taskId, newGoalId, opts) {
    var options = opts || {};
    var ws = resolveWorkspaceFromData(data);
    if (!ws) throw new Error("reassignTaskToGoal: active workspace not found");
    var task = findLiveTask(ws, taskId);
    if (!task) throw new Error("reassignTaskToGoal: task not found: " + taskId);
    if (newGoalId !== null) {
      if (typeof newGoalId !== "string") {
        throw new Error("reassignTaskToGoal: newGoalId must be a string or null");
      }
      if (!findLiveGoal(ws, newGoalId)) {
        throw new Error("reassignTaskToGoal: target goal not found or soft-deleted: " + newGoalId);
      }
    }
    if (options.newName !== undefined) {
      if (typeof options.newName !== "string" || options.newName.trim().length === 0) {
        throw new Error("reassignTaskToGoal: opts.newName must be a non-empty string");
      }
    }

    var sourceAutoTagId = getGoalAutoTagId(data, task.goalId);
    var targetAutoTagId = getGoalAutoTagId(data, newGoalId);

    var newTags = new Set(Array.isArray(task.tagIds) ? task.tagIds : []);
    if (sourceAutoTagId) newTags.delete(sourceAutoTagId);
    if (targetAutoTagId) newTags.add(targetAutoTagId);

    task.goalId = newGoalId;
    task.tagIds = Array.from(newTags);
    if (options.newName !== undefined) task.name = options.newName.trim();

    await saveAll(data);
    return task;
  }

  /**
   * Active tasks: !deletedAt && !completed.
   */
  function getActiveTasks(workspace) {
    var tasks = ensureTasksArray(workspace);
    if (!tasks) return [];
    return tasks.filter(function (t) { return !t.deletedAt && !t.completed; });
  }

  /**
   * Completed tasks: !deletedAt && completed.
   */
  function getCompletedTasks(workspace) {
    var tasks = ensureTasksArray(workspace);
    if (!tasks) return [];
    return tasks.filter(function (t) { return !t.deletedAt && t.completed; });
  }

  /**
   * All non-deleted tasks (active + completed).
   */
  function getAllTasks(workspace) {
    var tasks = ensureTasksArray(workspace);
    if (!tasks) return [];
    return tasks.filter(function (t) { return !t.deletedAt; });
  }

  /**
   * Lookup by id. Returns null if missing OR soft-deleted.
   */
  function getTaskById(workspace, taskId) {
    var tasks = ensureTasksArray(workspace);
    if (!tasks) return null;
    var task = tasks.find(function (t) { return t.id === taskId; });
    if (!task || task.deletedAt) return null;
    return task;
  }

  // ===== Active task ([1.0.16]) =====
  //
  // Top-level `data.activeTask`, GLOBAL across workspaces (one at a time) —
  // shape per docs/SPECS/tasks-and-goals.md:
  //
  //   { taskId, workspaceId, startedAt, isPaused, pomodoroState }
  //
  // workspaceId is stored even though taskId would resolve on its own: the
  // active task can belong to a workspace the user is not currently in (the
  // widget's cross-workspace state), and resolving it must not depend on which
  // workspace happens to be active.
  //
  // Two shapes, one name — do not confuse them. `data.activeTask` is this
  // OBJECT; a tracking session's `activeTaskId` is the BARE id string. The
  // engine reads `data.activeTask.taskId` to bridge them (tracking.js
  // computeDesired). Widening this object is safe; renaming `taskId` is not.
  //
  // isPaused is written but never read here (the pause control is [1.0.17],
  // global via data.trackingPaused). pomodoroState now carries the [1.0.18]
  // phase shape { cycleCount, phase, phaseEndsAt, phaseDurationMs,
  // sessionComplete } — emptyPomodoroState() on a fresh activation, read back
  // through hydratePomodoroState. It rides the
  // activeTask object precisely so every clear path (switch / complete / cancel /
  // self-heal) drops the pomodoro with it, no separate cleanup to wire.
  //
  // These write through saveAll rather than mutate-only (the setTrackingEnabled
  // convention): an active-task change is a tracking session boundary, and the
  // engine only learns about it from the storage watcher firing on `data`. A
  // mutate-only setter would make every caller responsible for the boundary.

  function getActiveTask(data) {
    var active = data && data.activeTask;
    if (!active || typeof active !== "object" || !active.taskId) return null;
    return active;
  }

  /**
   * Make `taskId` the active task. Resolves the task first: a missing or
   * trashed task never becomes active.
   *
   * Idempotent on the already-active task — it returns the existing record
   * WITHOUT rewriting startedAt or touching storage. That matters beyond
   * tidiness: re-activating the current task must not look like a boundary to
   * the engine, or clicking an already-active row would split the session and
   * reset the user's visible focused time. (opts.clearPause is the one thing
   * that can still make that branch write — see below.)
   *
   * [Polish Rule 4] opts.clearPause — an EXPLICIT activation gesture clears the
   * global pause in this same write. Pause means "stepped away"; choosing a task
   * to work on is the opposite declaration, so start means start rather than
   * landing on an amber PAUSED 0:00 card that needs a second click. One atomic
   * saveAll, so the engine sees the activation and the unpause together and
   * opens a session on the next boundary. Callers that are NOT an explicit user
   * gesture omit it and keep the defensive born-paused shape.
   *
   * @param {object} [opts] - {clearPause: boolean}
   * @returns {Promise<object|null>} the stored activeTask record, or null.
   */
  async function setActiveTask(data, taskId, workspaceId, opts) {
    if (!data || !taskId) return null;
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var task = findLiveTask(ws, taskId);
    if (!task) return null;

    var clearPause = !!(opts && opts.clearPause);
    var now = Date.now();
    var current = getActiveTask(data);
    if (current && current.taskId === taskId) {
      // Re-picking the ALREADY-active task (only reachable from the Switch
      // dropdown — the active row's own glyph is a pause/resume control now).
      // Still an explicit "start", so it must clear a pause; otherwise the one
      // gesture that means start would be the one gesture that leaves you
      // paused. The record is KEPT rather than replaced here, so the pending
      // paused span has to be folded into pausedMs by hand — the fresh-object
      // reset that makes this moot for a real switch does not apply. Folding
      // (rather than zeroing) makes this behave exactly like Resume: ACTIVE
      // continues from where it froze instead of restarting.
      if (clearPause && isTrackingPaused(data)) {
        if (current.pausedAt != null) {
          var repickSpan = now - current.pausedAt;
          current.pausedMs = (current.pausedMs || 0) + repickSpan;
          current.activePausedMs = (current.activePausedMs || 0) + repickSpan;
          current.pausedAt = null;
        }
        // [1.0.17 idle deduct] Fold pending idle the same way, defensively.
        // While paused the idle listener is gated off, so a pending idleAt here
        // can only be one that setTrackingPaused should already have folded —
        // but folding again costs nothing and guarantees the re-pick cannot
        // leave a stale stamp that would deduct the whole paused span twice.
        if (current.idleAt != null) {
          current.idleMs = (current.idleMs || 0) + (now - current.idleAt);
          current.idleAt = null;
        }
        data.trackingPaused = false;
        await saveAll(data);
      }
      return current;
    }

    // [2.0 worked clock] SWITCHING BANKS THE OUTGOING TASK. This is the second
    // (and last) write in the codebase that ends an activation — the record
    // below replaces the old one, and with it the only evidence of the span
    // just worked. Banked BEFORE the replacement, mutate-only, so it rides the
    // saveAll at the bottom of this function.
    //
    // Note the re-pick branch above does NOT bank, and must not: re-picking the
    // already-active task KEEPS the record, so the activation continues rather
    // than ending. Banking there would credit the span twice — once now and
    // again when the activation really ends.
    bankWorkedTime(data, now);

    // [1.0.17 dual counters] pausedAt/pausedMs back the display-only ACTIVE
    // counter (wall-clock since startedAt, minus paused spans). Fresh per task —
    // switching resets the accounting, which is also why no span needs folding
    // on this branch: the new record starts at pausedMs 0 regardless.
    //
    // The born-paused shape (pausedAt = startedAt, so ACTIVE reads a frozen 0
    // rather than counting a span never worked) now only applies WITHOUT
    // clearPause — i.e. never from a UI gesture, but still reachable from
    // console/direct callers, which is why it stays.
    data.activeTask = {
      taskId: taskId,
      workspaceId: ws.id,
      startedAt: now,
      isPaused: false,
      pomodoroState: emptyPomodoroState(),
      pausedAt: (!clearPause && isTrackingPaused(data)) ? now : null,
      pausedMs: 0,
      // [2.0] ACTIVATION-LIFETIME paused total, in ms, and the one field the
      // stopwatch needs that nothing else could supply.
      //
      // pausedMs sits directly above it and looks like the same thing. It is not:
      // anchorBrowserSession ZEROES pausedMs on every browser launch, because it
      // backed the retired ACTIVE counter, whose whole meaning was "this
      // sitting". The [2.0] stopwatch counts from startedAt and deliberately
      // CONTINUES across restarts, so a per-sitting paused total would silently
      // stop deducting every pause taken before the last launch — the number
      // would drift upward, exactly the kind of quiet wrongness the pill's
      // honesty standard exists to prevent.
      //
      // Kept as a SEPARATE field rather than by removing the anchor's reset:
      // that reset is deliberate and documented, and adding a parallel
      // accumulator leaves every existing behaviour byte-identical. Display-only
      // like the rest of this accounting — computeDesired never reads it.
      activePausedMs: 0,
      // [1.0.17 idle deduct] Fresh per task, like the pause accounting. No
      // born-idle counterpart: activating is an input event, so the user is by
      // definition present at this instant.
      idleAt: null,
      idleMs: 0,
      // [1.0.17 session anchor] ACTIVE counts from max(startedAt, sessionAnchorAt).
      // Activating IS the start of a sitting, so they coincide here; onStartup
      // moves the anchor forward on each later browser launch.
      sessionAnchorAt: now
    };
    if (clearPause) data.trackingPaused = false;
    await saveAll(data);
    return data.activeTask;
  }

  /**
   * Deactivate (D7: the task itself is untouched — not completed, not
   * cancelled, merely no longer active). No-op write when nothing was active,
   * so callers can fire it unconditionally without producing a spurious
   * storage event the engine would treat as a boundary.
   *
   * [2.0 worked clock] BANKS the finished activation before dropping the
   * record. This is one of exactly TWO places in the codebase where an
   * activation ends — see bankWorkedTime for why the fold lives here and not at
   * the call sites.
   *
   * @returns {Promise<boolean>} whether anything was cleared.
   */
  async function clearActiveTask(data) {
    if (!data || data.activeTask == null) return false;
    bankWorkedTime(data, Date.now());
    data.activeTask = null;
    await saveAll(data);
    return true;
  }

  // ===== [2.0] THE PER-TASK WORKED CLOCK =====
  //
  // Every task accumulates WORKED time — wall-clock active time with pauses
  // excluded — across all of its activations, for as long as the task exists.
  // Resume counts, pause freezes, switching away banks the span.
  //
  // VOCABULARY IS LOAD-BEARING. "Worked" belongs to the wall-clock family (the
  // stopwatch, this total). "Focused" is reserved for the ENGINE — time it
  // actually observed on a trackable site — and the two are never blended,
  // summed or shown as one figure. That is the standing law the pill's honesty
  // standard rests on, and this feature adds a second wall-clock surface rather
  // than a second meaning for an existing word.
  //
  // task.workedMs is ABSENT on every task that predates this feature, and
  // absent reads as 0. Their history was never captured and is NOT invented: a
  // task that has been worked on for months starts counting from now, which is
  // honest, where a back-filled guess would not be.

  /**
   * PURE (harnessed): the worked span of ONE activation record, in ms.
   *
   * This is the same derivation the pill's stopwatch paints
   * (newtab.js satActiveElapsedMs): now - startedAt - (activation-lifetime
   * paused total + any span still open). It lives here as well because the
   * BANKING path needs it in the service-worker/storage layer, and because the
   * two must agree exactly — the live row shows banked + THIS, so a divergence
   * would make the number jump at the moment of banking. The gate asserts the
   * two are numerically identical across a matrix of records rather than
   * trusting the comment.
   */
  function activationWorkedMs(active, now) {
    if (!active || typeof active.startedAt !== "number" || !active.startedAt) return 0;
    var pausedTotal = (active.activePausedMs || 0) +
      (active.pausedAt != null ? Math.max(0, now - active.pausedAt) : 0);
    return Math.max(0, now - active.startedAt - pausedTotal);
  }

  /**
   * Fold the CURRENT activation's worked span into its task's lifetime total.
   * MUTATE-ONLY — the caller persists it in the same write it was already
   * making, so banking never costs an extra storage round trip.
   *
   * WHY THIS LIVES IN THE TWO PRIMITIVES AND NOT AT THE CALL SITES.
   * A missed deactivation path is a silently leaking span: the user works for
   * an hour, the total does not move, and nothing anywhere reports an error.
   * There are EIGHT ways an activation can end (End for now, Complete from the
   * card, Complete from a row or the context menu, switching tasks, the pill's
   * self-heal, a task deleted while active, a recurring instance completing, a
   * hard purge) — but only TWO writes actually end one: this function's callers
   * `clearActiveTask` and `setActiveTask`'s replace branch. Every one of the
   * eight terminates at one of those two. Folding here covers all of them by
   * construction, including any path added later; folding at call sites would
   * cover the ones somebody remembered.
   *
   * The task is looked up RAW rather than through getTaskById/findLiveTask,
   * both of which skip a trashed task. A task soft-deleted while active must
   * still be credited: deletion is reversible, and restoring a task that had
   * lost its worked history would be a silent data loss. Only a HARD purge
   * loses the span, and there the task itself is gone with it.
   *
   * @returns {number} the span banked, in ms (0 when there was nothing to bank).
   */
  function bankWorkedTime(data, now) {
    if (!data) return 0;
    var active = getActiveTask(data);
    if (!active) return 0;
    var span = activationWorkedMs(active, now);
    if (!(span > 0)) return 0;
    var ws = resolveWorkspaceFromData(data, active.workspaceId);
    var tasks = ws && ws.tasks;
    if (!Array.isArray(tasks)) return 0;
    var task = null;
    for (var i = 0; i < tasks.length; i++) {
      if (tasks[i] && tasks[i].id === active.taskId) { task = tasks[i]; break; }
    }
    if (!task) return 0;              // hard-purged mid-activation: nothing to credit
    task.workedMs = (task.workedMs || 0) + span;
    return span;
  }

  /**
   * The number the UI shows for a task: everything banked, PLUS the current
   * activation if this is the task running right now.
   *
   * One definition for both surfaces (the Tasks row and the pill card), so the
   * live row and the card cannot disagree, and so the figure cannot jump when a
   * running activation is banked — banked + live is exactly what the fold turns
   * into banked.
   */
  function taskWorkedMs(data, task, now) {
    if (!task) return 0;
    var total = task.workedMs || 0;
    var active = getActiveTask(data);
    if (active && active.taskId === task.id) {
      total += activationWorkedMs(active, typeof now === "number" ? now : Date.now());
    }
    return total;
  }

  // ===== Pomodoro phase state ([1.0.18]) =====
  //
  // Phase state rides data.activeTask.pomodoroState — the slot reserved on the
  // activeTask shape and, until [1.0.18], written null and never read. Shape
  // ([1.0.18 A2] D1-AMEND widened with phaseDurationMs; [E1] sessionComplete):
  //   { cycleCount: number, phase: 'work'|'shortBreak'|'longBreak'|null,
  //     phaseEndsAt: number|null, phaseDurationMs: number|null,
  //     sessionComplete: boolean }
  // phase === null means "not running" (cycleCount may still be > 0 after a Stop).
  // phaseDurationMs is stamped at every phase START and is the source of truth for
  // the ring fraction and long-break arithmetic, so a mid-phase settings edit no
  // longer skews the running phase (A1 self-flag #2). [E1] sessionComplete is the
  // transient marker distinguishing "break finished — session complete" from a
  // user Stop or an expiry (all three land on phase:null): set ONLY by the
  // break-end reconcile, cleared by start/Stop, defaulted by hydration. Stored
  // (not in-memory) so it survives re-render AND reload — work must never restart
  // without an explicit click — and so the multi-tab loser adopts the same card.
  // Because the state lives ON the activeTask object, every clear path — switch
  // (fresh object), complete / cancel (clearActiveTask), the pill's self-heal —
  // drops it for free.
  function emptyPomodoroState() {
    return { cycleCount: 0, phase: null, phaseEndsAt: null, phaseDurationMs: null, sessionComplete: false };
  }

  // Defaulting reader for the phase state: null / legacy / malformed hydrates to
  // the empty shape, each field validated independently. Pure. phaseEndsAt and
  // phaseDurationMs are forced null whenever phase is null, so a stale endpoint
  // can never read as a running phase. A legacy A1 running phase (no
  // phaseDurationMs) hydrates it to null; the display falls back to current
  // settings for that one phase (see the pill's satRunningPomo), so nothing breaks.
  function hydratePomodoroState(ps) {
    if (!ps || typeof ps !== "object") return emptyPomodoroState();
    var phase = (ps.phase === "work" || ps.phase === "shortBreak" || ps.phase === "longBreak") ? ps.phase : null;
    var cycleCount = (typeof ps.cycleCount === "number" && isFinite(ps.cycleCount) && ps.cycleCount >= 0) ? Math.floor(ps.cycleCount) : 0;
    return {
      cycleCount: cycleCount,
      phase: phase,
      phaseEndsAt: (phase && typeof ps.phaseEndsAt === "number" && isFinite(ps.phaseEndsAt)) ? ps.phaseEndsAt : null,
      phaseDurationMs: (phase && typeof ps.phaseDurationMs === "number" && isFinite(ps.phaseDurationMs) && ps.phaseDurationMs > 0) ? Math.floor(ps.phaseDurationMs) : null,
      // [E1] Only meaningful on phase:null with at least one completed work phase
      // (the addendum's encoding); forced false otherwise so a malformed blob can
      // never paint the session-complete card over a running phase.
      sessionComplete: (phase === null && cycleCount > 0 && ps.sessionComplete === true)
    };
  }

  // Advance within this window past phaseEndsAt; expire (D3) beyond it. The grace
  // covers a backgrounded tab's ~1/min interval throttling so a normally-open
  // browser advances rather than expiring.
  var POMODORO_GRACE_MS = 90000;

  // Duration (ms) of a phase kind from the given settings. The single place the
  // work/short/long mapping lives.
  function pomodoroPhaseDurationMs(phase, settings) {
    if (phase === "work") return settings.workMin * 60000;
    if (phase === "shortBreak") return settings.shortBreakMin * 60000;
    if (phase === "longBreak") return settings.longBreakMin * 60000;
    return 0;
  }

  // Start a WORK phase on the active task: phaseDurationMs = workMin, phaseEndsAt
  // = now + duration. No-op (no write) when nothing is active. cycleCount is
  // PRESERVED untouched. Writes through saveAll — a phase boundary is a `data`
  // write like the active-task setters, and the engine no-ops on it
  // (computeDesired reads only activeTask.taskId, never pomodoroState).
  async function startPomodoroPhase(data) {
    var active = getActiveTask(data);
    if (!active) return false;
    var ps = hydratePomodoroState(active.pomodoroState);
    var durMs = getPomodoroSettings(data).workMin * 60000;
    ps.phase = "work";
    ps.phaseDurationMs = durMs;
    ps.phaseEndsAt = Date.now() + durMs;
    ps.sessionComplete = false;   // [E1] "Start next session" is this same path
    active.pomodoroState = ps;
    await saveAll(data);
    return true;
  }

  // Stop the running phase: phase / phaseEndsAt / phaseDurationMs cleared,
  // cycleCount PRESERVED, the task stays active. [E1] Also clears the
  // sessionComplete marker — a user Stop always lands on the plain elapsed
  // display, never the session-complete card. No-op guard when nothing is
  // running AND no marker is set, so a stray Stop emits no spurious write.
  async function stopPomodoro(data) {
    var active = getActiveTask(data);
    if (!active) return false;
    var ps = hydratePomodoroState(active.pomodoroState);
    if (ps.phase === null && ps.phaseEndsAt === null && !ps.sessionComplete) return false;
    ps.phase = null;
    ps.phaseEndsAt = null;
    ps.phaseDurationMs = null;
    ps.sessionComplete = false;
    active.pomodoroState = ps;
    await saveAll(data);
    return true;
  }

  // [1.0.18 A2] Compute the NEXT state from a running phase ([E1] supersedes
  // P3's endless loop — a session is something you start and FINISH):
  //   work  -> break: cycleCount++, and every cyclesBeforeLongBreak-th COMPLETED
  //            work phase yields a longBreak (else shortBreak). Automatic —
  //            resting needs no decision.
  //   break -> the session COMPLETES: phase cleared, cycleCount KEPT (it counts
  //            completed work phases), sessionComplete marker set. Work NEVER
  //            begins without explicit user action — when [1.2.0] auto-arms site
  //            blocking during work phases, blocking therefore never re-arms
  //            without consent.
  // A started break stamps fresh phaseEndsAt = now + duration, phaseDurationMs
  // from settings at that moment. Pure — no storage. Exported for the harness.
  function nextPomodoroPhase(ps, settings, now) {
    var next = { cycleCount: ps.cycleCount, phase: null, phaseEndsAt: null, phaseDurationMs: null, sessionComplete: false };
    if (ps.phase === "work") {
      var completed = ps.cycleCount + 1;
      next.cycleCount = completed;
      var isLong = (completed % settings.cyclesBeforeLongBreak) === 0;
      next.phase = isLong ? "longBreak" : "shortBreak";
      next.phaseDurationMs = pomodoroPhaseDurationMs(next.phase, settings);
      next.phaseEndsAt = now + next.phaseDurationMs;
    } else {
      next.sessionComplete = true;   // [E1] break end -> session complete, no auto work
    }
    return next;
  }

  // [1.0.18 A2] Reconcile the running phase against the clock — called from the
  // pill on tick / render / visibilitychange. Returns
  //   { action: 'none' | 'advanced' | 'completed' | 'expired', ... }.
  // 'advanced' now only ever means work -> break and carries fromDurationMs (the
  // COMPLETED phase's stamp, for the E2 toast); [E1] a break crossing its
  // boundary within grace returns 'completed' (session over, marker set — see
  // nextPomodoroPhase). NEVER fires while paused (a frozen phase cannot cross
  // its boundary — pause slides phaseEndsAt forward on resume instead, see
  // setTrackingPaused). D3 graceful expiry: past phaseEndsAt + grace, clear the
  // phase but KEEP cycleCount and set NO marker (an unattended boundary is an
  // expiry, not a completion). Within grace, auto-advance.
  //
  // Multi-tab safe: the write re-reads fresh storage and commits ONLY if the
  // boundary it decided on is still current (the setActiveTask-style no-op guard),
  // so two open tabs crossing the same boundary produce exactly one advance. A
  // losing tab adopts the winner's phase into its in-memory copy and skips.
  async function reconcilePomodoro(data, graceMs) {
    if (!data || isTrackingPaused(data)) return { action: "none" };
    var active = getActiveTask(data);
    if (!active) return { action: "none" };
    var ps = hydratePomodoroState(active.pomodoroState);
    if (!ps.phase || ps.phaseEndsAt == null) return { action: "none" };
    var now = Date.now();
    if (now <= ps.phaseEndsAt) return { action: "none" };  // still running

    var grace = (typeof graceMs === "number") ? graceMs : POMODORO_GRACE_MS;
    var decidedPhase = ps.phase, decidedEndsAt = ps.phaseEndsAt;
    var nextPs, result;
    if (now > ps.phaseEndsAt + grace) {
      nextPs = { cycleCount: ps.cycleCount, phase: null, phaseEndsAt: null, phaseDurationMs: null, sessionComplete: false };
      result = { action: "expired" };
    } else {
      nextPs = nextPomodoroPhase(ps, getPomodoroSettings(data), now);
      result = nextPs.phase
        ? { action: "advanced", from: decidedPhase, to: nextPs.phase, cycleCount: nextPs.cycleCount, fromDurationMs: ps.phaseDurationMs }
        : { action: "completed", cycleCount: nextPs.cycleCount };
    }

    // Guard: re-read fresh; if another tab already moved this exact boundary,
    // adopt its state into the caller's copy and skip the write (no double-count).
    var fresh = await getAll();
    var freshActive = getActiveTask(fresh);
    var freshPs = freshActive ? hydratePomodoroState(freshActive.pomodoroState) : null;
    if (!freshPs || freshPs.phase !== decidedPhase || freshPs.phaseEndsAt !== decidedEndsAt) {
      if (freshPs) active.pomodoroState = freshPs;   // catch this tab up
      return { action: "none", raced: true };
    }

    active.pomodoroState = nextPs;
    await saveAll(data);
    return result;
  }

  // [1.0.18 A2] Reset the running cycle count on the active task's focus state.
  // Zeroes cycleCount, leaves any running phase untouched. No-op when nothing is
  // active or the count is already 0.
  async function resetPomodoroCycleCount(data) {
    var active = getActiveTask(data);
    if (!active) return false;
    var ps = hydratePomodoroState(active.pomodoroState);
    if (ps.cycleCount === 0) return false;
    ps.cycleCount = 0;
    active.pomodoroState = ps;
    await saveAll(data);
    return true;
  }

  /**
   * Resolve `data.activeTask` into everything a renderer needs — or report it
   * stale. PURE: no mutation, no saveAll, safe to call on every render and from
   * a harness.
   *
   * Self-healing is the caller's, by construction: a stale record resolves to
   * `{ stale: true }` and the widget draws its empty state. The alternative —
   * hooking completeTask/deleteTask to clear the flag — would need every
   * present and future mutation path to remember, and would still miss the
   * other tab. Resolution can't forget.
   *
   * Stale means: workspace gone, task missing or trashed (getTaskById returns
   * null for a soft-deleted row), or the task completed elsewhere. Note tasks
   * carry a boolean `completed`, while goals carry `status` — deliberately
   * asymmetric in the model, so check the right one.
   *
   * @returns {null|{stale:true,reason:string,activeTask:object}
   *          |{stale:false,activeTask,task,workspace,goal,isForeign}}
   */
  function resolveActiveTask(data) {
    var active = getActiveTask(data);
    if (!active) return null;

    var ws = resolveWorkspaceFromData(data, active.workspaceId);
    if (!ws) return { stale: true, reason: "workspace-missing", activeTask: active };

    var task = getTaskById(ws, active.taskId);
    if (!task) return { stale: true, reason: "task-missing", activeTask: active };
    if (task.completed) return { stale: true, reason: "task-completed", activeTask: active };

    var activeWs = getActiveWorkspace(data);
    return {
      stale: false,
      activeTask: active,
      task: task,
      workspace: ws,
      goal: task.goalId ? getGoalById(ws, task.goalId) : null,
      isForeign: !!(activeWs && activeWs.id !== ws.id)
    };
  }

  // Active-task CARD minimize preference ([1.0.16] DIRECTION v3). A pure UI
  // preference at the top level of `data`; DEFAULT false = the card is expanded.
  //
  // Deliberately a plain `data` field, NOT part of the activeTask object: the
  // engine's computeDesired derives a session only from activeTask.taskId,
  // workspace, enabled and paused, so flipping this flag re-fires the storage
  // watcher but yields the SAME desired session — no boundary, no thrash. (It
  // rides `data` precisely so a foreign tab's onChanged repaints the widget and
  // the minimize/restore syncs cross-tab, same as every other data change.)
  // No-op when unchanged so an unconditional call cannot emit a spurious event.
  function isActiveTaskCardMinimized(data) {
    return !!(data && data.activeTaskCardMinimized);
  }

  async function setActiveTaskCardMinimized(data, minimized) {
    if (!data) return false;
    var next = !!minimized;
    if (!!data.activeTaskCardMinimized === next) return false;
    data.activeTaskCardMinimized = next;
    await saveAll(data);
    return true;
  }

  // ===== Due-date hierarchy checks ([1.0.13]) =====
  //
  // Pure, read-only conflict checks that sit IN FRONT OF updateTaskDueAt /
  // updateGoalDeadline. No mutation, no saveAll — callers branch on the
  // returned descriptor, then call the existing updater with the resolved
  // value. checkTaskDueConflict also serves 1.0.14's recurring drag-into-goal
  // check (it ships here unwired to a UI commit point; the task-side 3-button
  // modal lands in 1.0.13.1 against a real call site).
  //
  // Day-comparison basis: dueAt and deadlineAt are both stored as UTC-midnight
  // epoch ms (newtab.js parseDateInputToTs -> Date.UTC). Normalize BOTH sides
  // to their UTC calendar day; only a strictly-later UTC day is a conflict,
  // the same UTC day is not. Do NOT floor to local midnight — that shifts the
  // day by one for users behind UTC (a UTC-midnight stamp reads as the prior
  // local day).
  function utcDay(ts) {
    var d = new Date(ts);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }

  /**
   * Would setting task.dueAt to candidateDueAt push it past its parent goal's
   * deadline (strictly-later UTC day)? Fires regardless of the task's own
   * completed state. Pure read — no mutation, no saveAll.
   *
   * No-conflict when: task missing, standalone (goalId == null), candidate
   * null, parent goal missing or deadline-less, or candidate day on/before the
   * goal-deadline day.
   *
   * @returns {{ conflict: boolean, goalId: string|null, goalName: string|null,
   *   goalDeadlineAt: number|null, candidateDueAt: number|null }}
   */
  function checkTaskDueConflict(data, taskId, candidateDueAt, workspaceId) {
    var noConflict = {
      conflict: false, goalId: null, goalName: null,
      goalDeadlineAt: null, candidateDueAt: candidateDueAt
    };
    var ws = resolveWorkspaceFromData(data, workspaceId);
    if (!ws) return noConflict;
    var task = getTaskById(ws, taskId);
    if (!task || task.goalId == null || candidateDueAt == null) return noConflict;
    var goal = getGoalById(ws, task.goalId);
    if (!goal || goal.deadlineAt == null) return noConflict;
    if (utcDay(candidateDueAt) <= utcDay(goal.deadlineAt)) return noConflict;
    return {
      conflict: true, goalId: goal.id, goalName: goal.name,
      goalDeadlineAt: goal.deadlineAt, candidateDueAt: candidateDueAt
    };
  }

  /**
   * Would setting goal.deadlineAt to candidateDeadlineAt land before the latest
   * due date among the goal's constraining children? Constraining children =
   * live (getAllTasks already excludes deletedAt), incomplete, goalId match,
   * dueAt != null. Completed / soft-deleted / null-due children are ignored.
   * Pure read — no mutation, no saveAll.
   *
   * Not blocked when the candidate is null or no constraining child's due day
   * is strictly after the candidate day.
   *
   * @returns {{ blocked: boolean, blockingTaskId: string|null,
   *   blockingTaskName: string|null, blockingDueAt: number|null,
   *   candidateDeadlineAt: number|null }}
   */
  function checkGoalDeadlineConflict(data, goalId, candidateDeadlineAt, workspaceId) {
    var notBlocked = {
      blocked: false, blockingTaskId: null, blockingTaskName: null,
      blockingDueAt: null, candidateDeadlineAt: candidateDeadlineAt
    };
    if (candidateDeadlineAt == null) return notBlocked;
    var ws = resolveWorkspaceFromData(data, workspaceId);
    if (!ws) return notBlocked;
    var children = getAllTasks(ws).filter(function (t) {
      return t.goalId === goalId && !t.completed && t.dueAt != null;
    });
    if (!children.length) return notBlocked;
    var latest = children.reduce(function (a, b) { return b.dueAt > a.dueAt ? b : a; });
    if (utcDay(latest.dueAt) > utcDay(candidateDeadlineAt)) {
      return {
        blocked: true, blockingTaskId: latest.id, blockingTaskName: latest.name,
        blockingDueAt: latest.dueAt, candidateDeadlineAt: candidateDeadlineAt
      };
    }
    return notBlocked;
  }

  // ===== Tags =====
  //
  // Tag CRUD on the Storage namespace, mirroring the [1.0.7] goal CRUD and
  // [1.0.8] task CRUD shape. No UI surface in [1.0.9] — Pro Settings tags
  // section, right-click attach to bookmarks/groups, and pill rendering on
  // bookmarks/groups land in [1.0.9.1]; tag picker UX in task detail panel
  // lands in [1.0.10]; tag-based filtering in [1.0.12]. Verification path:
  // console-callable via Storage.* (matches the ProAccess.applyLicenseKey
  // console pattern).
  //
  // Soft-delete via deletedAt from day one — every read except getAllTags
  // filters out tombstoned tags. deleteTag does NOT cascade-clear tagIds
  // from items: per spec (`tasks-and-goals.md` Tag deletion section), items
  // retain tag IDs with a dimmed "archived tag" badge until the 30-day
  // trash auto-purge sweeps them. deleteTag here is a pure soft-delete.
  //
  // Cross-cutting wiring:
  //  - createGoal (Goals section) auto-creates a tag inline by default
  //    (autoCreateTag flag), with kebab-case name + rotating palette color.
  //  - createTask (Tasks section) inherits parent goal's autoTagId when
  //    tagIds is omitted; explicit tagIds (including []) respected verbatim.
  //  - deleteGoal's existing iteration over workspace.tags now activates
  //    organically: any tag where autoGeneratedFromGoalId === goal.id is
  //    soft-deleted with the same timestamp, populating cascadedTagId.
  //
  // Tag name decoupling: tag name is derived from goal name once at goal
  // creation. Subsequent renameGoal does NOT auto-rename the tag. User can
  // rename the tag via Pro Settings ([1.0.9.1]) if they want them to match.
  // See DECISIONS.md 2026-04-27 entry for the tradeoff vs auto-rename.

  // 8-color palette for auto-tag rotation. Picked to match the spec example
  // (#4A90E2 first) and provide enough perceptual separation across the
  // wheel for adjacent goals to be distinguishable. Indexed via
  // nextAutoTagColor; user override at goal creation bypasses but does not
  // halt the rotation counter (every auto-tag creation advances the index).
  var TAG_PALETTE = [
    "#4A90E2", // blue
    "#7ED321", // green
    "#F5A623", // orange
    "#D0021B", // red
    "#9013FE", // purple
    "#50E3C2", // teal
    "#F8E71C", // yellow
    "#BD10E0"  // magenta
  ];

  var HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

  function genTagId() {
    return "tag_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function ensureTagsArray(workspace) {
    if (!workspace) return null;
    if (!Array.isArray(workspace.tags)) workspace.tags = [];
    return workspace.tags;
  }

  function findLiveTag(workspace, tagId) {
    var tags = ensureTagsArray(workspace);
    if (!tags) return null;
    var tag = tags.find(function (t) { return t.id === tagId; });
    if (!tag || tag.deletedAt) return null;
    return tag;
  }

  function isValidHexColor(color) {
    return typeof color === "string" && HEX_COLOR_REGEX.test(color);
  }

  // [1.0.9.2] round 6: case-insensitive trim-equal duplicate-name check across
  // ACTIVE tags only. Soft-deleted tags don't block reuse — they're awaiting
  // the day-30 trash auto-purge and the user's intent is to rebind the name.
  // excludeTagId lets renameTag skip the tag being renamed (so a no-op rename
  // and case-only changes on the same tag don't trip the check). Auto-tag
  // creation in createGoal pushes directly to workspace.tags and bypasses this
  // check intentionally — auto-tag uniqueness is a separate concern (kebab
  // collisions across goals) and out of scope here.
  function isDuplicateTagName(workspace, name, excludeTagId) {
    var tags = ensureTagsArray(workspace);
    if (!tags) return false;
    var normalized = name.trim().toLowerCase();
    for (var i = 0; i < tags.length; i++) {
      var t = tags[i];
      if (!t || t.deletedAt) continue;
      if (excludeTagId && t.id === excludeTagId) continue;
      if (typeof t.name === "string" && t.name.trim().toLowerCase() === normalized) {
        return true;
      }
    }
    return false;
  }

  function duplicateTagError(name) {
    return { err: "duplicate", message: "A tag named '" + name + "' already exists in this workspace." };
  }

  // Lowercase, alphanumerics joined by single dash, leading/trailing dashes
  // trimmed, runs of non-alphanumerics collapsed. "Ship LaunchPad Pro v1"
  // → "ship-launchpad-pro-v1". Used for auto-tag name derivation at goal
  // creation; not exported.
  function kebabCase(str) {
    if (typeof str !== "string") return "";
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // Counts both live and soft-deleted auto-tags so deletions during the
  // 30-day trash window don't perturb the rotation index. Only auto-tags
  // (autoGeneratedFromGoalId is a string) advance the counter — manual tags
  // share the rotation as a default but don't shift it for future autos.
  function nextAutoTagColor(workspace) {
    var tags = ensureTagsArray(workspace);
    if (!tags) return TAG_PALETTE[0];
    var autoCount = tags.filter(function (t) {
      return t && typeof t.autoGeneratedFromGoalId === "string";
    }).length;
    return TAG_PALETTE[autoCount % TAG_PALETTE.length];
  }

  /**
   * Create a tag in the (optionally specified) workspace. Used internally by
   * createGoal's auto-tag flow and externally for manual tag CRUD.
   *
   * [1.0.9.2] round 6: rejects case-insensitive trim-equal duplicate names
   * within the workspace's ACTIVE tags. Returns { err: "duplicate", message }
   * on conflict; null on other validation failures (empty name, bad color);
   * the tag on success.
   *
   * @param {object} data
   * @param {object} fields — { name (required, trimmed, non-empty), color? (default = next palette rotation), autoGeneratedFromGoalId? (default null) }
   * @param {string} [workspaceId]
   * @returns {Promise<object|{err:string,message:string}|null>}
   */
  async function createTag(data, fields, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    if (!ws) {
      console.warn("[LaunchPad] createTag: workspace not found");
      return null;
    }
    var f = fields || {};
    var name = typeof f.name === "string" ? f.name.trim() : "";
    if (!name) {
      console.warn("[LaunchPad] createTag: name is required and must be non-empty after trim");
      return null;
    }
    if (isDuplicateTagName(ws, name, null)) {
      return duplicateTagError(name);
    }

    var color;
    if (f.color === undefined || f.color === null) {
      color = nextAutoTagColor(ws);
    } else if (!isValidHexColor(f.color)) {
      console.warn("[LaunchPad] createTag: color must match /^#[0-9A-Fa-f]{6}$/");
      return null;
    } else {
      color = f.color;
    }

    var autoGeneratedFromGoalId = (f.autoGeneratedFromGoalId === undefined) ? null : f.autoGeneratedFromGoalId;
    if (autoGeneratedFromGoalId !== null && typeof autoGeneratedFromGoalId !== "string") {
      console.warn("[LaunchPad] createTag: autoGeneratedFromGoalId must be a string or null");
      return null;
    }

    var tags = ensureTagsArray(ws);
    var tag = {
      id: genTagId(),
      name: name,
      color: color,
      autoGeneratedFromGoalId: autoGeneratedFromGoalId,
      createdAt: Date.now(),
      deletedAt: null
    };
    tags.push(tag);
    await saveAll(data);
    return tag;
  }

  /**
   * Rename a tag. No-op + null on missing / soft-deleted / empty name.
   * [1.0.9.2] round 6: tightened to reject case-insensitive trim-equal
   * duplicates against active tags (excluding self). Returns
   * { err: "duplicate", message } on conflict; returns the tag on success
   * (including no-op rename to the same name and case-only changes on the
   * same tag).
   * @returns {Promise<object|{err:string,message:string}|null>}
   */
  async function renameTag(data, tagId, newName, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var tag = findLiveTag(ws, tagId);
    if (!tag) return null;
    var name = typeof newName === "string" ? newName.trim() : "";
    if (!name) {
      console.warn("[LaunchPad] renameTag: newName must be non-empty after trim");
      return null;
    }
    if (tag.name === name) return tag;
    if (isDuplicateTagName(ws, name, tagId)) {
      return duplicateTagError(name);
    }
    tag.name = name;
    await saveAll(data);
    return tag;
  }

  /**
   * Update a tag's color. Validates against /^#[0-9A-Fa-f]{6}$/.
   * @returns {Promise<object|null>}
   */
  async function updateTagColor(data, tagId, newColor, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var tag = findLiveTag(ws, tagId);
    if (!tag) return null;
    if (!isValidHexColor(newColor)) {
      console.warn("[LaunchPad] updateTagColor: newColor must match /^#[0-9A-Fa-f]{6}$/");
      return null;
    }
    if (tag.color === newColor) return tag;
    tag.color = newColor;
    await saveAll(data);
    return tag;
  }

  /**
   * Soft-delete a tag via deletedAt. Pure soft-delete: items retaining the
   * tag ID get a dimmed "archived tag" badge per spec; the 30-day trash
   * auto-purge eventually clears tag IDs from items. No cascade here.
   * @returns {Promise<object|null>}
   */
  async function deleteTag(data, tagId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var tag = findLiveTag(ws, tagId);
    if (!tag) return null;
    tag.deletedAt = Date.now();
    await saveAll(data);
    return tag;
  }

  /**
   * [Trash] Restore a soft-deleted tag by clearing deletedAt — the mirror of
   * deleteTag, and the ONLY writer that un-deletes a tag. Workspace-threaded
   * and single-field, like every other tag writer; no partial-object merge.
   *
   * COLLISION IS REAL, not theoretical: isDuplicateTagName ignores trashed tags
   * on purpose, so the name was free to be taken while this one sat in the bin.
   * Restoring blindly would leave two LIVE tags sharing a name, which createTag
   * and renameTag both refuse. So this refuses too, returning the same
   * {err,message} shape those two use. No auto-rename, no silent duplicate —
   * the user renames the active one first.
   *
   * ITEM ASSOCIATIONS NEED NO WORK HERE: deleteTag is a pure soft-delete that
   * leaves every tagIds array intact, and purgeExpiredTrash is the only thing
   * that strips them (at day 30, in the same sweep that hard-removes the tag).
   * So a restore inside the window turns every dimmed "archived tag" badge back
   * into a normal one with no cascade — trash-bin.md's "everything snaps back".
   *
   * @returns {Promise<object|{err:string,message:string}|null>}
   */
  async function restoreTag(data, tagId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    if (!ws) return null;
    var tags = ensureTagsArray(ws);
    if (!tags) return null;
    var tag = tags.find(function (t) { return t.id === tagId; });
    if (!tag) return null;              // unknown id
    if (!tag.deletedAt) return tag;     // already active — no-op, no write
    if (isDuplicateTagName(ws, tag.name, tagId)) {
      return { err: "duplicate", message: "An active tag already has this name — rename it first." };
    }
    tag.deletedAt = null;
    await saveAll(data);
    return tag;
  }

  /**
   * Active (non-deleted) tags.
   */
  function getActiveTags(workspace) {
    var tags = ensureTagsArray(workspace);
    if (!tags) return [];
    return tags.filter(function (t) { return !t.deletedAt; });
  }

  /**
   * Every tag including soft-deleted ones. Caller filters as needed.
   */
  function getAllTags(workspace) {
    var tags = ensureTagsArray(workspace);
    if (!tags) return [];
    return tags.slice();
  }

  /**
   * Lookup by id. Returns null if missing OR soft-deleted.
   */
  function getTagById(workspace, tagId) {
    var tags = ensureTagsArray(workspace);
    if (!tags) return null;
    var tag = tags.find(function (t) { return t.id === tagId; });
    if (!tag || tag.deletedAt) return null;
    return tag;
  }

  /**
   * First live tag with the given name. Returns null if no live tag matches
   * (or input isn't a string). Tag names are not unique — duplicates return
   * the first match in storage order.
   */
  function getTagByName(workspace, name) {
    if (typeof name !== "string") return null;
    var tags = ensureTagsArray(workspace);
    if (!tags) return null;
    var found = tags.find(function (t) { return !t.deletedAt && t.name === name; });
    return found || null;
  }

  // ===== Notes ([1.1.0]) =====
  //
  // Workspace-scoped sibling to goals / tasks / tags, and deliberately built to
  // the same shape as those rather than to anything note-specific.
  //
  // TIMESTAMPS ARE EPOCH MILLISECONDS, not ISO strings. docs/SPECS/notes.md
  // describes createdAt/updatedAt/deletedAt as "ISO timestamp", but trash-bin.md
  // is explicit that deletedAt is Date.now() and every sibling entity already
  // stores epoch ms. An ISO island here would break the trash sweep, which does
  // arithmetic on deletedAt, and would make notes the only entity a shared
  // helper could not read. Alignment with the siblings wins; notes.md is the
  // doc that needs the correction.
  //
  // TAG REFERENCES ARE `tagIds`, matching tasks and the trash-bin cascade rule
  // that cleans tag ids out of every item's tagIds array on purge. A `tags`
  // field would simply be invisible to that sweep.
  //
  // These are PURE MUTATIONS: they change the passed-in data object and return,
  // and the CALLER pairs them with Storage.saveAll. That is the setTrackingEnabled
  // shape rather than createTask's self-saving shape, per the [1.1.0] addendum.
  // Notes have no background writer, so none of this is a serial-queue citizen;
  // if a background path ever writes notes, it becomes one by definition (L1).
  function genNoteId() {
    return "note_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // Palette TOKEN NAMES, never hex. [1.1.1] owns the final palette and its
  // values; storing the token means a palette restyle is a CSS change and never
  // a data migration. First entry is the default.
  var NOTE_COLORS = ["cream", "butter-yellow", "soft-pink", "mint", "sky-blue", "peach", "lavender"];

  // Every note used to be born cream: newNoteObject fell back to NOTE_COLORS[0]
  // and nothing ever passed a colour, so the seven-colour palette was defined,
  // rendered and never actually used. Notes now CYCLE through it.
  //
  // Cycled rather than randomised on purpose. Random repeats — roughly one new
  // note in seven would be born the same colour as the one above it, which is
  // the single case the change exists to avoid.
  //
  // KEYED ON THE NOTE COUNT, deliberately, and not on "find the most recently
  // created note and take the next colour after it". That reading looks more
  // natural and fails two ways, both observed while building this:
  //
  //   - createdAt is Date.now(), so notes made in the same millisecond TIE.
  //     Seeding seven notes in a loop produced cream then butter-yellow six
  //     times, because no later note ever compared as strictly newer.
  //   - Array position cannot break that tie either. createNote pushes to the
  //     END, but the panel then moves the new note to index 0 ([1.1.2] newest
  //     at top), so "newest" is the lowest index through the UI and the highest
  //     through a direct call. There is no consistent side to look at.
  //
  // The count has neither problem: monotonic, order-independent, unaffected by
  // the unshift. It relies on notes being SOFT-deleted (deletedAt is set, the
  // entry stays in the array), which is what deleteNote does — so a deletion
  // does not rewind the cycle and hand back the colour just discarded. If a hard
  // purge is ever added the worst outcome is a repeated colour: cosmetic, and no
  // note data depends on it.
  // [1.1.4] Default paper colour for NEW notes, on the getTextSize precedent:
  // reader and writer live here so coercion is provable from a Node VM, and an
  // unrecognised value is never written rather than being stored and coerced at
  // read time (which would leave junk in the user backup reading as a choice).
  //
  // ABSENCE IS MEANINGFUL and is the default: null means "never configured", and
  // that is what keeps [1.1.3] palette cycling as the out-of-the-box behaviour.
  // Picking a colour opts OUT of the cycle; there is no separate "cycle" swatch
  // because the unset state already is one.
  function getDefaultNoteColor(data) {
    var v = data && data.settings && data.settings.defaultNoteColor;
    return NOTE_COLORS.indexOf(v) === -1 ? null : v;
  }

  // Pass null to clear and return to cycling.
  async function setDefaultNoteColor(data, val) {
    if (!data || !data.settings) return false;
    if (val !== null && NOTE_COLORS.indexOf(val) === -1) return false;
    if (getDefaultNoteColor(data) === val) return false;
    if (val === null) delete data.settings.defaultNoteColor;
    else data.settings.defaultNoteColor = val;
    await saveAll(data);
    return true;
  }

  function nextNoteColor(ws) {
    var notes = (ws && Array.isArray(ws.notes)) ? ws.notes : [];
    return NOTE_COLORS[notes.length % NOTE_COLORS.length];
  }

  // Fixed per-note tilt for the paper aesthetic. Rolled ONCE at creation and
  // stored, so a note never re-rolls its angle on render or reload.
  var NOTE_ROTATION_MIN = -2;
  var NOTE_ROTATION_MAX = 2;

  function randomNoteRotation() {
    var span = NOTE_ROTATION_MAX - NOTE_ROTATION_MIN;
    return Math.round((NOTE_ROTATION_MIN + Math.random() * span) * 100) / 100;
  }

  // ===== [1.4.0] Named sessions =====
  //
  // A user-named saved set of tabs, launchable as a unit. Workspace-scoped
  // sibling entity, ARRAY ORDER CANONICAL per the notes precedent, position-free.
  //
  // THE FIELD IS namedSessions, NOT sessions, AND THAT IS DELIBERATE. "Session"
  // already means four things in this codebase: the tracking engine's focus records
  // (tracking_sessions, genSessionId, rollupSessionInto), the 5-minute auto-restore's
  // saved tabs (the savedSessions key, saveCurrentSession, restoreSessions), the
  // Pomodoro focus session (user-visible copy), and the browser-restart anchor
  // (anchorBrowserSession). The second is the dangerous neighbour: it ALSO saves sets
  // of tabs, shares no storage and no lifecycle with this, and will share only its
  // capture-eligibility rules at [1.4.1]. "named" is exactly what distinguishes these
  // from that ambient unnamed autosave, so every identifier here carries it.
  //
  // NO tagIds IN v1, so no cascade obligations. taskId is a FORWARD REFERENCE ONLY,
  // not a join: it is stored unvalidated (a task may be deleted, or may not exist yet
  // when a session is restored from a backup), exactly as notes store notebookId.
  // What a purged task should do to a dangling taskId is [1.4.2]'s decision, and
  // nothing here touches the task-purge path.

  // NOT "sess_": tracking.js genSessionId already owns that prefix. The two live in
  // different stores so a literal collision is impossible, but a grep for one must
  // not surface the other.
  function genNamedSessionId() {
    return "nsession_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function ensureNamedSessionsArray(workspace) {
    if (!workspace) return null;
    if (!Array.isArray(workspace.namedSessions)) workspace.namedSessions = [];
    return workspace.namedSessions;
  }

  function findLiveNamedSession(workspace, sessionId) {
    var sessions = ensureNamedSessionsArray(workspace);
    if (!sessions) return null;
    var s = sessions.find(function (x) { return x.id === sessionId; });
    return (s && !s.deletedAt) ? s : null;
  }

  // Minimal validation, by construction: a fresh object per tab carrying exactly url,
  // title and favicon, so UNKNOWN FIELDS ARE DROPPED rather than filtered. url is the
  // only required field and a tab without a usable one is discarded, because a saved
  // tab that cannot be launched is not worth keeping.
  //
  // [1.4.1] favicon ADDED, and the reason is a privacy one rather than a visual one.
  // [1.4.0] deliberately stored no favicon on the theory that the surface could derive
  // one from the url. It cannot, cleanly: getFaviconUrl's fallback is Google's S2
  // service, so deriving would have sent every domain of every saved session to a
  // third party on every render - the exact thing [1.2.1] Time-by-Site refused to do
  // for the same category of data. Capturing the PAGE'S OWN favIconUrl at save time
  // instead keeps icons local to sites the user already chose to save. null means "no
  // icon", which the UI renders as the bundled placeholder, never as a lookup.
  function normalizeNamedSessionTabs(input) {
    if (!Array.isArray(input)) return [];
    var out = [];
    input.forEach(function (t) {
      if (!t || typeof t !== "object") return;
      if (typeof t.url !== "string" || !t.url) return;
      out.push({
        url: t.url,
        title: (typeof t.title === "string") ? t.title : "",
        favicon: (typeof t.favicon === "string" && t.favicon) ? t.favicon : null
      });
    });
    return out;
  }

  function newNamedSessionObject(o) {
    o = o || {};
    var now = Date.now();
    return {
      id: genNamedSessionId(),
      // Empty names are ALLOWED at this layer. Whether to demand one is a UI
      // question ([1.4.1]), and a storage layer that refuses would make restoring a
      // backup fail on data the user already has.
      name: (o.name === undefined || o.name === null) ? "" : String(o.name),
      tabs: normalizeNamedSessionTabs(o.tabs),
      taskId: (o.taskId === undefined) ? null : o.taskId,
      createdAt: now,
      updatedAt: now,
      lastLaunchedAt: null,
      deletedAt: null
    };
  }

  /**
   * Create a named session in the (optionally specified) workspace. Pure mutation:
   * the caller pairs it with saveAll. Returns the new session, or null if the
   * workspace cannot be resolved.
   */
  function createNamedSession(data, fields, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    if (!ws) {
      console.warn("[LaunchPad] createNamedSession: workspace not found");
      return null;
    }
    var sessions = ensureNamedSessionsArray(ws);
    var session = newNamedSessionObject(fields);
    sessions.push(session);
    return session;
  }

  /**
   * Patch a named session. Only the fields present in `partial` move; id, createdAt
   * and lastLaunchedAt never do - the last of those has its own narrow updater, so a
   * partial-object write can never fake a launch. Returns null if the session is
   * missing or soft-deleted.
   */
  function updateNamedSession(data, sessionId, partial, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var session = findLiveNamedSession(ws, sessionId);
    if (!session) return null;
    var f = partial || {};

    if (f.name !== undefined) session.name = (f.name === null) ? "" : String(f.name);
    if (Array.isArray(f.tabs)) session.tabs = normalizeNamedSessionTabs(f.tabs);
    if (f.taskId !== undefined) session.taskId = f.taskId;

    session.updatedAt = Date.now();
    return session;
  }

  /**
   * Stamp a launch. Moves lastLaunchedAt and NOTHING else - launching is not
   * editing, so updatedAt stays where it was, the same reasoning that keeps
   * restoreNote from touching it.
   */
  function touchNamedSessionLaunched(data, sessionId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var session = findLiveNamedSession(ws, sessionId);
    if (!session) return null;
    session.lastLaunchedAt = Date.now();
    return session;
  }

  function deleteNamedSession(data, sessionId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var session = findLiveNamedSession(ws, sessionId);
    if (!session) return null;
    session.deletedAt = Date.now();
    return session;
  }

  function restoreNamedSession(data, sessionId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var sessions = ensureNamedSessionsArray(ws);
    if (!sessions) return null;
    var session = sessions.find(function (x) { return x.id === sessionId; });
    if (!session || !session.deletedAt) return null;
    session.deletedAt = null;
    return session;
  }

  // Defensive copy at the SIBLING'S DEPTH, which is one level: filter returns a new
  // array, and the session objects (and therefore their tabs arrays) are shared by
  // reference. Mutating the returned array cannot disturb stored state; mutating a
  // returned session does write through. tabs is copied at CREATION instead, which
  // is exactly where notes copy tagIds.
  function getAllNamedSessions(workspace) {
    var sessions = ensureNamedSessionsArray(workspace);
    if (!sessions) return [];
    return sessions.filter(function (s) { return !s.deletedAt; });
  }

  function getDeletedNamedSessions(workspace) {
    var sessions = ensureNamedSessionsArray(workspace);
    if (!sessions) return [];
    return sessions.filter(function (s) { return !!s.deletedAt; });
  }

  function getNamedSessionById(workspace, sessionId) {
    return findLiveNamedSession(workspace, sessionId);
  }

  /**
   * Reorder live sessions. Matches reorderNotes exactly, including the
   * every-live-exactly-once length check and the ID-based commit: the visible list
   * holds only live sessions while the array also holds soft-deleted ones, so a raw
   * index addresses the wrong element. Live sessions are permuted into the slots live
   * sessions already occupy, leaving deleted ones at their exact array positions.
   *
   * Like its siblings this one SAVES ITSELF rather than leaving it to the caller.
   */
  async function reorderNamedSessions(data, orderedSessionIds, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    if (!ws) return null;
    if (!Array.isArray(orderedSessionIds)) {
      console.warn("[LaunchPad] reorderNamedSessions: orderedSessionIds must be an array");
      return null;
    }
    var sessions = ensureNamedSessionsArray(ws);
    if (!sessions) return null;

    var byId = {};
    sessions.forEach(function (s) { byId[s.id] = s; });
    var liveSlots = [];
    sessions.forEach(function (s, i) { if (!s.deletedAt) liveSlots.push(i); });

    if (orderedSessionIds.length !== liveSlots.length) {
      console.warn("[LaunchPad] reorderNamedSessions: order must account for every live session exactly once");
      return null;
    }
    for (var i = 0; i < orderedSessionIds.length; i++) {
      var id = orderedSessionIds[i];
      if (typeof id !== "string") {
        console.warn("[LaunchPad] reorderNamedSessions: every id must be a string");
        return null;
      }
      var s = byId[id];
      if (!s) {
        console.warn("[LaunchPad] reorderNamedSessions: id not found in workspace: " + id);
        return null;
      }
      if (s.deletedAt) {
        console.warn("[LaunchPad] reorderNamedSessions: id refers to a soft-deleted session: " + id);
        return null;
      }
    }

    for (var j = 0; j < orderedSessionIds.length; j++) {
      sessions[liveSlots[j]] = byId[orderedSessionIds[j]];
    }
    await saveAll(data);
    return sessions;
  }

  // ===== [1.4.2] Session-to-task attachment =====
  //
  // The reference lives on the SESSION and is never mirrored on the task, so there
  // is exactly one place to write and one place to read. Both directions of the
  // invariant are enforced HERE rather than in the UI: at most one session per
  // task, at most one task per session.
  //
  // These are per-field updaters. taskId is deliberately NOT written through
  // updateNamedSession's partial, because a generic partial cannot see the other
  // sessions and so cannot keep the one-session-per-task half of the invariant.

  function getNamedSessionForTask(workspace, taskId) {
    if (!workspace || !taskId) return null;
    var sessions = ensureNamedSessionsArray(workspace);
    if (!sessions) return null;
    return sessions.find(function (s) { return !s.deletedAt && s.taskId === taskId; }) || null;
  }

  /**
   * Attach a session to a task. MOVES it if the session was attached elsewhere,
   * and displaces whatever session was previously on the target task, because both
   * halves of the invariant are one-to-one. Pure mutation: the caller pairs saveAll.
   * @returns {{session, displaced}|null} displaced is the session bumped off the
   *   target task, or null. The caller needs it to describe what happened.
   */
  function attachNamedSessionToTask(data, sessionId, taskId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var session = findLiveNamedSession(ws, sessionId);
    if (!session || !taskId) return null;
    // The task must be LIVE in this workspace. A soft-deleted task is still a
    // real task and keeps its attachment, but it cannot be chosen as a new target.
    if (!findLiveTask(ws, taskId)) return null;

    var displaced = null;
    var existing = getNamedSessionForTask(ws, taskId);
    if (existing && existing.id !== session.id) {
      existing.taskId = null;
      displaced = existing;
    }
    session.taskId = taskId;
    return { session: session, displaced: displaced };
  }

  /** Detach a session from whatever task it was on. Pure mutation. */
  function detachNamedSession(data, sessionId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var session = findLiveNamedSession(ws, sessionId);
    if (!session) return null;
    session.taskId = null;
    return session;
  }

  // THE DANGLING-REFERENCE GUARD, called from every path that removes a task for
  // good. A saved tab set is the user's own work and outlives the task it was
  // attached to; what must not outlive the task is the POINTER. Soft-delete
  // deliberately does not come through here: a trashed task is restorable, and
  // restoreTask only clears deletedAt, so an attachment that survived the trash
  // is still correct when the task comes back.
  function detachSessionsFromTasks(ws, taskIds) {
    if (!ws || !taskIds || !taskIds.length) return 0;
    var sessions = ws.namedSessions;
    if (!Array.isArray(sessions)) return 0;
    var gone = {};
    taskIds.forEach(function (id) { if (id) gone[id] = true; });
    var n = 0;
    sessions.forEach(function (s) {
      if (s && s.taskId && gone[s.taskId]) { s.taskId = null; n++; }
    });
    return n;
  }

  function ensureNotesArray(workspace) {
    if (!workspace) return null;
    if (!Array.isArray(workspace.notes)) workspace.notes = [];
    return workspace.notes;
  }

  function findLiveNote(workspace, noteId) {
    var notes = ensureNotesArray(workspace);
    if (!notes) return null;
    var note = notes.find(function (n) { return n.id === noteId; });
    return (note && !note.deletedAt) ? note : null;
  }

  function newNoteObject(o) {
    o = o || {};
    var now = Date.now();
    var color = (typeof o.color === "string" && NOTE_COLORS.indexOf(o.color) !== -1)
      ? o.color
      : NOTE_COLORS[0];
    var pos = (o.position && typeof o.position === "object") ? o.position : {};
    return {
      id: genNoteId(),
      content: (o.content === undefined || o.content === null) ? "" : String(o.content),
      color: color,
      // [1.1.2] RESERVED AND DORMANT. Nothing reads or writes these: the notes
      // panel is a vertical stack whose ARRAY ORDER is canonical. Kept for a
      // future free-positioning surface; no semantics, no migration.
      position: {
        x: typeof pos.x === "number" ? pos.x : 0,
        y: typeof pos.y === "number" ? pos.y : 0
      },
      rotation: typeof o.rotation === "number" ? o.rotation : randomNoteRotation(),
      // v1.1 notes are always standalone; [1.2.x] introduces the association.
      notebookId: (o.notebookId === undefined) ? null : o.notebookId,
      tagIds: Array.isArray(o.tagIds) ? o.tagIds.slice() : [],
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
  }

  /**
   * Create a note in the (optionally specified) workspace. Pure mutation: the
   * caller pairs it with saveAll. Returns the new note, or null if the workspace
   * cannot be resolved.
   */
  function createNote(data, fields, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    if (!ws) {
      console.warn("[LaunchPad] createNote: workspace not found");
      return null;
    }
    var notes = ensureNotesArray(ws);

    // Colour precedence, most specific first:
    //   1. an EXPLICIT colour  - the swatch picker, a restore from backup
    //   2. the DEFAULT SETTING - the user chose one colour for every new note
    //   3. the CYCLE           - unset, which is the shipped [1.1.3] behaviour
    // newNoteObject validates whichever wins, so a corrupt setting cannot reach
    // a note.
    var f = fields || {};
    if (f.color === undefined) {
      var preferred = getDefaultNoteColor(data);
      f = Object.assign({}, f, { color: preferred || nextNoteColor(ws) });
    }

    var note = newNoteObject(f);
    notes.push(note);
    return note;
  }

  /**
   * Patch a note. Only the fields present in `partial` move; createdAt and id
   * never do. Returns null if the note is missing or soft-deleted (findLiveNote),
   * which is the same refusal tasks and goals give.
   */
  function updateNote(data, noteId, partial, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var note = findLiveNote(ws, noteId);
    if (!note) return null;
    var f = partial || {};

    if (f.content !== undefined) note.content = (f.content === null) ? "" : String(f.content);
    if (f.color !== undefined && NOTE_COLORS.indexOf(f.color) !== -1) note.color = f.color;
    if (f.position && typeof f.position === "object") {
      if (typeof f.position.x === "number") note.position.x = f.position.x;
      if (typeof f.position.y === "number") note.position.y = f.position.y;
    }
    if (typeof f.rotation === "number") note.rotation = f.rotation;
    if (f.notebookId !== undefined) note.notebookId = f.notebookId;
    if (Array.isArray(f.tagIds)) note.tagIds = f.tagIds.slice();

    note.updatedAt = Date.now();
    return note;
  }

  /**
   * Soft-delete, per docs/SPECS/trash-bin.md: deletedAt = Date.now(), the note
   * stays in its own workspace array so restore never has to re-home it, and the
   * 30-day auto-purge sweep removes it later by the same rule as every sibling.
   */
  function deleteNote(data, noteId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var note = findLiveNote(ws, noteId);
    if (!note) return null;
    note.deletedAt = Date.now();
    return note;
  }

  /**
   * The un-delete half: deletedAt = null, exactly reversing deleteNote. Unlike
   * restoreTag there is no name-collision to block on, and unlike restoreTask
   * there is no parent to re-home to in v1.1 - a standalone note simply returns.
   * updatedAt is deliberately NOT touched: restoring is not editing.
   */
  function restoreNote(data, noteId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var notes = ensureNotesArray(ws);
    if (!notes) return null;
    var note = notes.find(function (n) { return n.id === noteId; });
    if (!note || !note.deletedAt) return null;
    note.deletedAt = null;
    return note;
  }

  /**
   * [1.1.3] Reorder the workspace's live notes. Shaped on reorderGoals: same
   * (data, orderedIds, workspaceId) signature, same validation ladder, same
   * saveAll-then-return-the-collection tail.
   *
   * The BODY necessarily differs, and that is not drift. reorderGoals writes a
   * displayOrder field and leaves the array alone; [1.1.2] made ARRAY ORDER
   * canonical for notes, so ordering here is a permutation of the array itself.
   * This is the [1.1.2] caller-side permute moved intact - live notes are
   * permuted into the slots live notes already occupy, so soft-deleted notes keep
   * their exact array positions and the trash is undisturbed.
   *
   * Works on IDS, never on indices: the panel renders only live notes while the
   * array also holds deleted ones, so a raw index addresses the wrong element.
   *
   * The length check has no reorderGoals counterpart and is deliberate: a partial
   * order is meaningless against slot-permutation, and refusing it is what the
   * [1.1.2] assertions pin.
   *
   * @returns {Promise<Array|null>} the notes array, or null if nothing was applied.
   */
  async function reorderNotes(data, orderedNoteIds, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    if (!ws) return null;
    if (!Array.isArray(orderedNoteIds)) {
      console.warn("[LaunchPad] reorderNotes: orderedNoteIds must be an array");
      return null;
    }
    var notes = ensureNotesArray(ws);
    if (!notes) return null;

    var noteById = {};
    notes.forEach(function (n) { noteById[n.id] = n; });
    var liveSlots = [];
    notes.forEach(function (n, i) { if (!n.deletedAt) liveSlots.push(i); });

    if (orderedNoteIds.length !== liveSlots.length) {
      console.warn("[LaunchPad] reorderNotes: order must account for every live note exactly once");
      return null;
    }
    for (var i = 0; i < orderedNoteIds.length; i++) {
      var id = orderedNoteIds[i];
      if (typeof id !== "string") {
        console.warn("[LaunchPad] reorderNotes: every id must be a string");
        return null;
      }
      var n = noteById[id];
      if (!n) {
        console.warn("[LaunchPad] reorderNotes: id not found in workspace: " + id);
        return null;
      }
      if (n.deletedAt) {
        console.warn("[LaunchPad] reorderNotes: id refers to a soft-deleted note: " + id);
        return null;
      }
    }

    for (var j = 0; j < orderedNoteIds.length; j++) {
      notes[liveSlots[j]] = noteById[orderedNoteIds[j]];
    }
    await saveAll(data);
    return notes;
  }

  /**
   * [1.1.3] Hard-remove one note. Mirrors deleteGoalPermanent: splice by id,
   * saveAll, boolean. Unlike deleteNote this is irreversible, which is why the
   * trash view is the only caller and confirms first (trash-bin.md: confirmation
   * modals appear only for permanent deletion from the trash).
   *
   * No cascade. trash-bin.md gives notes none - they own no children, and their
   * tagIds are references TO tags, so removing a note cannot orphan a tag. The
   * reverse direction (a purged tag cleaned out of note.tagIds) is handled in
   * purgeExpiredTrash.
   */
  async function deleteNotePermanent(data, noteId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var notes = ws && ws.notes;
    if (!Array.isArray(notes)) return false;
    var idx = notes.findIndex(function (n) { return n && n.id === noteId; });
    if (idx === -1) return false;
    notes.splice(idx, 1);
    await saveAll(data);
    return true;
  }

  /**
   * [1.1.3] Hard-remove every TRASHED note in the workspace, live notes
   * untouched. Workspace-scoped, matching the trash surface that calls it.
   * Iterates backwards so the splices cannot skip an element.
   * @returns {Promise<number>} how many were purged; 0 writes nothing.
   */
  async function emptyNotesTrash(data, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var notes = ws && ws.notes;
    if (!Array.isArray(notes)) return 0;
    var removed = 0;
    for (var i = notes.length - 1; i >= 0; i--) {
      if (notes[i] && notes[i].deletedAt) { notes.splice(i, 1); removed++; }
    }
    if (removed > 0) await saveAll(data);
    return removed;
  }

  /**
   * Active (non-deleted) notes for the workspace. Defensive copy is the SIBLING
   * pattern and therefore SHALLOW: filter returns a fresh array, so pushing or
   * splicing the result cannot disturb stored order, but the note objects are
   * shared by reference exactly as getAllTasks and getAllGoals share theirs.
   * Callers that need to mutate a note do so through updateNote.
   */
  function getAllNotes(workspace) {
    var notes = ensureNotesArray(workspace);
    if (!notes) return [];
    return notes.filter(function (n) { return !n.deletedAt; });
  }

  /**
   * Soft-deleted notes, for the [1.1.3] trash surface. Mirrors getDeletedGoals.
   */
  function getDeletedNotes(workspace) {
    var notes = ensureNotesArray(workspace);
    if (!notes) return [];
    return notes.filter(function (n) { return !!n.deletedAt; });
  }

  /**
   * Lookup by id. Returns null if missing OR soft-deleted, matching getTaskById.
   */
  function getNoteById(workspace, noteId) {
    return findLiveNote(workspace, noteId);
  }

  // ===== Recurring Task Templates =====
  //
  // Schema-only landing in [1.0.10] per the PLAN (D2). The Tasks tab in
  // [1.0.10] consumes getAllRecurringTemplates / getActiveRecurringTemplates
  // for read-only rendering of the Recurring section. The chrome.alarms
  // sweep that materializes instances into workspace.tasks lands in [1.0.14]
  // and reads nextScheduledAt; nothing here touches alarms.
  //
  // Per-workspace, mirroring goals / tasks / tags. ensureRecurringTemplatesArray
  // already exists upstream as a forward-looking stub; this section gives it
  // its first real consumer. Soft-delete via deletedAt from day one — same
  // pattern as Goal/Task CRUD, ready for the Trash Bin UI.
  //
  // Schema follows the PLAN's recurring template definition: name, frequency
  // ('daily'|'weekly'|'monthly'), daysOfWeek (only for weekly), dayOfMonth
  // (only for monthly), timeOfDay (HH:mm 24-hour), nextScheduledAt
  // (populated by [1.0.14]), isActive, tagIds, plus the standard
  // createdAt / updatedAt / deletedAt fields. workspaceId is implicit via the
  // workspace.recurringTemplates collection — no FK field needed.

  var VALID_RECURRING_FREQUENCIES = ["daily", "weekly", "monthly"];
  var TIME_OF_DAY_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

  function genRecurringTemplateId() {
    return "rtmpl_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function findLiveRecurringTemplate(workspace, templateId) {
    var arr = ensureRecurringTemplatesArray(workspace);
    if (!arr) return null;
    var t = arr.find(function (x) { return x.id === templateId; });
    if (!t || t.deletedAt) return null;
    return t;
  }

  function isValidTimeOfDay(s) {
    return typeof s === "string" && TIME_OF_DAY_REGEX.test(s);
  }

  // Validates the frequency-specific fields together so the caller can't end
  // up with a 'weekly' template missing daysOfWeek or a 'monthly' template
  // missing dayOfMonth. Returns null on success, an { err, message } shape
  // on failure (matching the createTag duplicate-name return pattern).
  function validateRecurringPattern(frequency, daysOfWeek, dayOfMonth) {
    if (VALID_RECURRING_FREQUENCIES.indexOf(frequency) === -1) {
      return { err: "invalid_frequency", message: "frequency must be 'daily', 'weekly', or 'monthly'." };
    }
    if (frequency === "weekly") {
      if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
        return { err: "weekly_requires_days", message: "Weekly templates require at least one day-of-week." };
      }
      for (var i = 0; i < daysOfWeek.length; i++) {
        var d = daysOfWeek[i];
        if (typeof d !== "number" || d < 0 || d > 6 || (d | 0) !== d) {
          return { err: "invalid_day_of_week", message: "daysOfWeek values must be integers 0-6." };
        }
      }
    } else if (frequency === "monthly") {
      if (typeof dayOfMonth !== "number" || dayOfMonth < 1 || dayOfMonth > 31 || (dayOfMonth | 0) !== dayOfMonth) {
        return { err: "invalid_day_of_month", message: "Monthly templates require dayOfMonth as an integer 1-31." };
      }
    }
    return null;
  }

  /**
   * Create a recurring template in the (optionally specified) workspace.
   *
   * @param {object} data — full storage object
   * @param {object} fields — { name (required), frequency (required), daysOfWeek?, dayOfMonth?, timeOfDay? (default "09:00"), isActive? (default true), tagIds? (default []), nextScheduledAt? (default null) }
   * @param {string} [workspaceId] — defaults to active workspace
   * @returns {Promise<object|{err:string,message:string}|null>}
   */
  async function createRecurringTemplate(data, fields, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    if (!ws) {
      console.warn("[LaunchPad] createRecurringTemplate: workspace not found");
      return null;
    }
    var f = fields || {};
    var name = typeof f.name === "string" ? f.name.trim() : "";
    if (!name) {
      console.warn("[LaunchPad] createRecurringTemplate: name is required and must be non-empty after trim");
      return null;
    }

    var frequency = f.frequency;
    var daysOfWeek = (f.daysOfWeek === undefined) ? null : f.daysOfWeek;
    var dayOfMonth = (f.dayOfMonth === undefined) ? null : f.dayOfMonth;
    var patternErr = validateRecurringPattern(frequency, daysOfWeek, dayOfMonth);
    if (patternErr) {
      console.warn("[LaunchPad] createRecurringTemplate:", patternErr.message);
      return patternErr;
    }

    // timeOfDay defaults to 09:00. [1.0.14]'s alarm sweep needs a time-of-day
    // anchor to compute the next scheduled occurrence; null would force every
    // caller to default it themselves.
    var timeOfDay = (f.timeOfDay === undefined || f.timeOfDay === null) ? "09:00" : f.timeOfDay;
    if (!isValidTimeOfDay(timeOfDay)) {
      console.warn("[LaunchPad] createRecurringTemplate: timeOfDay must match HH:mm 24-hour");
      return null;
    }

    var isActive = (f.isActive === undefined) ? true : !!f.isActive;

    var tagIds;
    if (f.tagIds === undefined || f.tagIds === null) {
      tagIds = [];
    } else if (!Array.isArray(f.tagIds) || !f.tagIds.every(function (t) { return typeof t === "string"; })) {
      console.warn("[LaunchPad] createRecurringTemplate: tagIds must be an array of strings");
      return null;
    } else {
      tagIds = f.tagIds.slice();
    }

    var nextScheduledAt = (f.nextScheduledAt === undefined) ? null : f.nextScheduledAt;
    if (nextScheduledAt !== null && typeof nextScheduledAt !== "number") {
      console.warn("[LaunchPad] createRecurringTemplate: nextScheduledAt must be a number or null");
      return null;
    }

    // [1.0.14] goalId + priority extend the [1.0.10] schema so generated
    // instances can inherit a parent goal (also settable via the drag
    // "move template into goal" flow) and a priority. Both default null; goalId
    // is validated only for type here (a goal deleted later is handled at
    // generation time, which falls back to standalone).
    var tplGoalId = (f.goalId === undefined || f.goalId === null) ? null : f.goalId;
    if (tplGoalId !== null && typeof tplGoalId !== "string") {
      console.warn("[LaunchPad] createRecurringTemplate: goalId must be a string or null");
      return null;
    }
    var tplPriority = (f.priority === undefined) ? null : f.priority;
    if (!isValidPriority(tplPriority)) {
      console.warn("[LaunchPad] createRecurringTemplate: priority must be 'low'|'medium'|'high'|'urgent'|null");
      return null;
    }

    var arr = ensureRecurringTemplatesArray(ws);
    var now = Date.now();

    // [1.0.14] Seed nextScheduledAt from the pattern when the caller didn't
    // supply it, so a freshly-created template is immediately schedulable by the
    // sweep (the [1.0.10] modal never set it, which would leave templates
    // dormant forever). First occurrence on/after today (UTC calendar day).
    if (f.nextScheduledAt === undefined) {
      var normalizedForSeed = {
        frequency: frequency,
        daysOfWeek: frequency === "weekly" ? daysOfWeek : null,
        dayOfMonth: frequency === "monthly" ? dayOfMonth : null
      };
      nextScheduledAt = nextRecurrenceUTC(normalizedForSeed, now, true);
    }
    // Normalize the off-frequency fields so a 'daily' template doesn't carry
    // a stale daysOfWeek and a 'weekly' template doesn't carry a stale
    // dayOfMonth. Keeps the stored shape stable for downstream code in
    // [1.0.14] reading these fields without a frequency check.
    var template = {
      id: genRecurringTemplateId(),
      name: name,
      description: (f.description === undefined || f.description === null) ? "" : String(f.description),
      frequency: frequency,
      daysOfWeek: frequency === "weekly" ? daysOfWeek.slice() : null,
      dayOfMonth: frequency === "monthly" ? dayOfMonth : null,
      timeOfDay: timeOfDay,
      goalId: tplGoalId,
      priority: tplPriority,
      nextScheduledAt: nextScheduledAt,
      lastInstanceId: null,
      isActive: isActive,
      tagIds: tagIds,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    arr.push(template);
    await saveAll(data);
    return template;
  }

  /**
   * Patch an existing recurring template. Only the fields present on the
   * `updates` object are applied; everything else preserved. Frequency-related
   * fields validated together when frequency is touched.
   *
   * @returns {Promise<object|{err:string,message:string}|null>}
   */
  async function updateRecurringTemplate(data, templateId, updates, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var template = findLiveRecurringTemplate(ws, templateId);
    if (!template) return null;
    var u = updates || {};

    if (Object.prototype.hasOwnProperty.call(u, "name")) {
      var name = typeof u.name === "string" ? u.name.trim() : "";
      if (!name) {
        console.warn("[LaunchPad] updateRecurringTemplate: name must be non-empty after trim");
        return null;
      }
      template.name = name;
    }

    // Frequency / daysOfWeek / dayOfMonth re-validate together: re-resolve
    // each field from the update or fall back to the stored value, then run
    // the joint pattern validator. Caller can change frequency without
    // re-supplying the off-frequency fields (we just clear them).
    var touchedPattern =
      Object.prototype.hasOwnProperty.call(u, "frequency") ||
      Object.prototype.hasOwnProperty.call(u, "daysOfWeek") ||
      Object.prototype.hasOwnProperty.call(u, "dayOfMonth");
    if (touchedPattern) {
      var freq = Object.prototype.hasOwnProperty.call(u, "frequency") ? u.frequency : template.frequency;
      var dow = Object.prototype.hasOwnProperty.call(u, "daysOfWeek")
        ? u.daysOfWeek
        : template.daysOfWeek;
      var dom = Object.prototype.hasOwnProperty.call(u, "dayOfMonth")
        ? u.dayOfMonth
        : template.dayOfMonth;
      var patternErr = validateRecurringPattern(freq, dow, dom);
      if (patternErr) {
        console.warn("[LaunchPad] updateRecurringTemplate:", patternErr.message);
        return patternErr;
      }
      template.frequency = freq;
      template.daysOfWeek = freq === "weekly" ? dow.slice() : null;
      template.dayOfMonth = freq === "monthly" ? dom : null;
    }

    if (Object.prototype.hasOwnProperty.call(u, "timeOfDay")) {
      if (!isValidTimeOfDay(u.timeOfDay)) {
        console.warn("[LaunchPad] updateRecurringTemplate: timeOfDay must match HH:mm 24-hour");
        return null;
      }
      template.timeOfDay = u.timeOfDay;
    }

    if (Object.prototype.hasOwnProperty.call(u, "isActive")) {
      template.isActive = !!u.isActive;
    }

    if (Object.prototype.hasOwnProperty.call(u, "tagIds")) {
      if (u.tagIds === null) {
        template.tagIds = [];
      } else if (!Array.isArray(u.tagIds) || !u.tagIds.every(function (t) { return typeof t === "string"; })) {
        console.warn("[LaunchPad] updateRecurringTemplate: tagIds must be an array of strings");
        return null;
      } else {
        template.tagIds = u.tagIds.slice();
      }
    }

    if (Object.prototype.hasOwnProperty.call(u, "nextScheduledAt")) {
      if (u.nextScheduledAt !== null && typeof u.nextScheduledAt !== "number") {
        console.warn("[LaunchPad] updateRecurringTemplate: nextScheduledAt must be a number or null");
        return null;
      }
      template.nextScheduledAt = u.nextScheduledAt;
    }

    // [1.0.14] goalId (nullable) — the drag "move template into this goal" flow
    // sets this so future instances bind to the goal; null returns it to
    // standalone. priority (nullable) inherited by future instances.
    if (Object.prototype.hasOwnProperty.call(u, "goalId")) {
      if (u.goalId !== null && typeof u.goalId !== "string") {
        console.warn("[LaunchPad] updateRecurringTemplate: goalId must be a string or null");
        return null;
      }
      template.goalId = u.goalId;
    }
    if (Object.prototype.hasOwnProperty.call(u, "priority")) {
      if (!isValidPriority(u.priority)) {
        console.warn("[LaunchPad] updateRecurringTemplate: priority must be 'low'|'medium'|'high'|'urgent'|null");
        return null;
      }
      template.priority = u.priority;
    }
    if (Object.prototype.hasOwnProperty.call(u, "description")) {
      template.description = (u.description === undefined || u.description === null) ? "" : String(u.description);
    }

    template.updatedAt = Date.now();
    await saveAll(data);
    return template;
  }

  /**
   * Soft-delete a recurring template. Existing instances already materialized
   * into workspace.tasks remain untouched (per spec: "Deleting template
   * trashes the template. Existing instances remain as individual tasks.").
   *
   * @returns {Promise<object|null>}
   */
  async function deleteRecurringTemplate(data, templateId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var template = findLiveRecurringTemplate(ws, templateId);
    if (!template) return null;
    template.deletedAt = Date.now();
    await saveAll(data);
    return template;
  }

  /**
   * Active recurring templates: !deletedAt && isActive.
   */
  function getActiveRecurringTemplates(workspace) {
    var arr = ensureRecurringTemplatesArray(workspace);
    if (!arr) return [];
    return arr.filter(function (t) { return !t.deletedAt && t.isActive; });
  }

  /**
   * All non-deleted recurring templates (active + paused).
   */
  function getAllRecurringTemplates(workspace) {
    var arr = ensureRecurringTemplatesArray(workspace);
    if (!arr) return [];
    return arr.filter(function (t) { return !t.deletedAt; });
  }

  /**
   * Lookup by id. Returns null if missing OR soft-deleted.
   */
  function getRecurringTemplateById(workspace, templateId) {
    var arr = ensureRecurringTemplatesArray(workspace);
    if (!arr) return null;
    var t = arr.find(function (x) { return x.id === templateId; });
    if (!t || t.deletedAt) return null;
    return t;
  }

  // ===== [1.0.14] Recurring instance generation (chrome.alarms sweep) =====
  //
  // The [1.0.10] schema + CRUD landed the template shape; this section
  // materializes template occurrences into ordinary task instances. Occurrence
  // math is UTC-calendar-day based to match the [1.0.13] dueAt convention
  // (dueAt = UTC-midnight epoch of the calendar day). timeOfDay is stored on the
  // template but has NO v1 behavior (D4) — scheduling is day-granular.

  var RECUR_DAY_MS = 24 * 60 * 60 * 1000;
  var RECUR_OVERDUE_CEILING = 7; // D3: keep at most 7 (newest); older skipped.

  function recurUtcMidnight(epoch) {
    var d = new Date(epoch);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }

  function recurDaysInUtcMonth(year, monthIdx) {
    // Day 0 of month+1 == last day of month, in UTC.
    return new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
  }

  /**
   * Next occurrence day for a template as a UTC-midnight epoch, relative to
   * fromEpoch. inclusive=true → first occurrence on/after fromEpoch's day;
   * inclusive=false → first occurrence strictly after it. Monthly clamps a
   * dayOfMonth beyond the month length to that month's last day (a "31st"
   * template fires on Feb 28/29). Returns null for a malformed pattern.
   */
  function nextRecurrenceUTC(template, fromEpoch, inclusive) {
    var startDay = recurUtcMidnight(fromEpoch);
    var probe = inclusive ? startDay : startDay + RECUR_DAY_MS;
    if (template.frequency === "daily") {
      return probe;
    }
    if (template.frequency === "weekly") {
      var days = Array.isArray(template.daysOfWeek) ? template.daysOfWeek : [];
      if (!days.length) return null;
      for (var i = 0; i < 7; i++) {
        var cand = probe + i * RECUR_DAY_MS;
        if (days.indexOf(new Date(cand).getUTCDay()) !== -1) return cand;
      }
      return null;
    }
    if (template.frequency === "monthly") {
      var dom = template.dayOfMonth;
      if (typeof dom !== "number") return null;
      var d = new Date(probe);
      var y = d.getUTCFullYear(), m = d.getUTCMonth();
      for (var g = 0; g < 60; g++) {
        var target = Math.min(dom, recurDaysInUtcMonth(y, m));
        var occ = Date.UTC(y, m, target);
        if (occ >= probe) return occ;
        m++; if (m > 11) { m = 0; y++; }
      }
      return null;
    }
    return null;
  }

  /**
   * [1.0.14] Recurring sweep. Iterates ALL workspaces (D8); for each active,
   * non-deleted template whose nextScheduledAt <= now, generates the due/overdue
   * occurrences as ordinary task instances (isRecurringInstance:true), advances
   * nextScheduledAt to the first future occurrence, and persists everything in a
   * SINGLE saveAll (D2 — atomic, so a double-fire alarm + opportunistic run the
   * same morning is idempotent: the second pass sees nextScheduledAt > now and
   * no-ops). All array mutations run synchronously BEFORE the awaited saveAll, so
   * an un-awaited caller (the opportunistic path) still reads the fresh instances
   * on the next line. Instances bypass the hierarchy modal entirely (D5) — a
   * goal-bound template may generate an instance past the goal deadline.
   *
   * Overdue = option B (D3): missed occurrences are generated with their past
   * calendar day as dueAt (so they render overdue via the existing dueAt-based
   * derivation) alongside the current one; a soft ceiling of 7 keeps only the
   * newest per sweep, older are silently skipped (nextScheduledAt still advances
   * past them). A null nextScheduledAt (e.g. a pre-[1.0.14] template) is seeded
   * to the first occurrence on/after now before processing.
   *
   * @returns {Promise<{instancesCreated:number, templatesAdvanced:number, skipped:number}>}
   */
  async function runRecurringSweep(data, nowTs) {
    var summary = { instancesCreated: 0, templatesAdvanced: 0, skipped: 0 };
    if (!data || !Array.isArray(data.workspaces)) return summary;
    var now = (typeof nowTs === "number") ? nowTs : Date.now();
    var changed = false;

    data.workspaces.forEach(function (ws) {
      var templates = ensureRecurringTemplatesArray(ws);
      if (!templates) return;
      templates.forEach(function (tpl) {
        if (tpl.deletedAt || !tpl.isActive) return;

        if (tpl.nextScheduledAt == null) {
          var seed = nextRecurrenceUTC(tpl, now, true);
          if (seed == null) return; // malformed pattern — leave untouched
          tpl.nextScheduledAt = seed;
          changed = true;
        }
        if (tpl.nextScheduledAt > now) return; // nothing due yet

        // Collect every due/overdue occurrence day (<= now), ascending.
        var occ = [];
        var cursor = tpl.nextScheduledAt;
        var guard = 0;
        while (cursor != null && cursor <= now && guard < 20000) {
          occ.push(cursor);
          var nxt = nextRecurrenceUTC(tpl, cursor, false);
          if (nxt == null || nxt <= cursor) { cursor = null; break; } // defensive
          cursor = nxt;
          guard++;
        }
        if (!occ.length) return;

        var toCreate = occ;
        if (occ.length > RECUR_OVERDUE_CEILING) {
          summary.skipped += occ.length - RECUR_OVERDUE_CEILING;
          toCreate = occ.slice(occ.length - RECUR_OVERDUE_CEILING);
        }

        // Goal binding: inherit the template's goalId only if that goal is still
        // live; otherwise the instance is standalone (D6 — never dangle under a
        // dead goal).
        var goalId = (tpl.goalId != null && findLiveGoal(ws, tpl.goalId)) ? tpl.goalId : null;
        var lastId = null;
        toCreate.forEach(function (dayEpoch) {
          var inst = newTaskObject(ws, {
            name: tpl.name,
            description: "",
            goalId: goalId,
            dueAt: dayEpoch, // UTC-midnight of the occurrence day (D4)
            priority: (tpl.priority !== undefined) ? tpl.priority : null,
            tagIds: Array.isArray(tpl.tagIds) ? tpl.tagIds : [],
            isRecurringInstance: true,
            recurringTemplateId: tpl.id
          });
          ws.tasks.push(inst);
          lastId = inst.id;
          summary.instancesCreated++;
        });
        if (lastId) tpl.lastInstanceId = lastId;
        // cursor is the first future occurrence (> now), or null if the guard/
        // defensive break tripped — in which case fall back to the last created
        // day + one step so nextScheduledAt still moves forward.
        tpl.nextScheduledAt = (cursor != null) ? cursor : nextRecurrenceUTC(tpl, occ[occ.length - 1], false);
        summary.templatesAdvanced++;
        changed = true;
      });
    });

    if (changed) await saveAll(data);
    return summary;
  }

  // ===== [1.0.15] Goal Templates =====
  //
  // A saved goal structure (name, description, deadline offset, ordered task
  // specs) reusable to spin up new goals. Per-workspace (workspace.goalTemplates,
  // soft-deleted via deletedAt). Task templates are a SEPARATE, unbuilt concept
  // (workspace.taskTemplates) and are NOT touched here.

  function genGoalTemplateId() {
    return "gtmpl_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function findLiveGoalTemplate(workspace, templateId) {
    var arr = ensureGoalTemplatesArray(workspace);
    if (!arr) return null;
    var t = arr.find(function (x) { return x.id === templateId; });
    if (!t || t.deletedAt) return null;
    return t;
  }

  // Normalize an incoming taskList to ordered [{name, priority}]. Entries with a
  // blank name are dropped; priority coerces to a valid value or null. Returns a
  // fresh array (never shares the caller's references).
  function normalizeTemplateTaskList(taskList) {
    if (!Array.isArray(taskList)) return [];
    var out = [];
    taskList.forEach(function (entry) {
      if (!entry) return;
      var name = typeof entry.name === "string" ? entry.name.trim() : "";
      if (!name) return;
      var priority = isValidPriority(entry.priority) ? entry.priority : null;
      out.push({ name: name, priority: priority });
    });
    return out;
  }

  // offsetDays: null (no deadline) or a non-negative integer.
  function isValidOffsetDays(v) {
    return v === null || (typeof v === "number" && v >= 0 && (v | 0) === v);
  }

  /**
   * Create a goal template. fields: { name (required), description?,
   * deadlineOffsetDays? (null|int>=0), taskList? ([{name, priority}]) }.
   * @returns {Promise<object|null>}
   */
  async function createGoalTemplate(data, fields, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    if (!ws) { console.warn("[LaunchPad] createGoalTemplate: workspace not found"); return null; }
    var f = fields || {};
    var name = typeof f.name === "string" ? f.name.trim() : "";
    if (!name) { console.warn("[LaunchPad] createGoalTemplate: name is required"); return null; }
    var offset = (f.deadlineOffsetDays === undefined) ? null : f.deadlineOffsetDays;
    if (!isValidOffsetDays(offset)) {
      console.warn("[LaunchPad] createGoalTemplate: deadlineOffsetDays must be null or a non-negative integer");
      return null;
    }
    var arr = ensureGoalTemplatesArray(ws);
    var now = Date.now();
    var template = {
      id: genGoalTemplateId(),
      name: name,
      description: (f.description === undefined || f.description === null) ? "" : String(f.description),
      deadlineOffsetDays: offset,
      taskList: normalizeTemplateTaskList(f.taskList),
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    arr.push(template);
    await saveAll(data);
    return template;
  }

  async function renameGoalTemplate(data, templateId, newName, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var tpl = findLiveGoalTemplate(ws, templateId);
    if (!tpl) return null;
    var name = typeof newName === "string" ? newName.trim() : "";
    if (!name) { console.warn("[LaunchPad] renameGoalTemplate: newName must be non-empty"); return null; }
    tpl.name = name;
    tpl.updatedAt = Date.now();
    await saveAll(data);
    return tpl;
  }

  async function updateGoalTemplateDescription(data, templateId, description, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var tpl = findLiveGoalTemplate(ws, templateId);
    if (!tpl) return null;
    tpl.description = (description === undefined || description === null) ? "" : String(description);
    tpl.updatedAt = Date.now();
    await saveAll(data);
    return tpl;
  }

  async function updateGoalTemplateOffset(data, templateId, offsetDays, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var tpl = findLiveGoalTemplate(ws, templateId);
    if (!tpl) return null;
    if (!isValidOffsetDays(offsetDays)) {
      console.warn("[LaunchPad] updateGoalTemplateOffset: must be null or a non-negative integer");
      return null;
    }
    tpl.deadlineOffsetDays = offsetDays;
    tpl.updatedAt = Date.now();
    await saveAll(data);
    return tpl;
  }

  async function updateGoalTemplateTaskList(data, templateId, taskList, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var tpl = findLiveGoalTemplate(ws, templateId);
    if (!tpl) return null;
    tpl.taskList = normalizeTemplateTaskList(taskList);
    tpl.updatedAt = Date.now();
    await saveAll(data);
    return tpl;
  }

  // "(copy)" suffix, mirroring duplicateTask. Deep-copies the taskList.
  async function duplicateGoalTemplate(data, templateId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var tpl = findLiveGoalTemplate(ws, templateId);
    if (!tpl) return null;
    var arr = ensureGoalTemplatesArray(ws);
    var now = Date.now();
    var copy = {
      id: genGoalTemplateId(),
      name: tpl.name + " (copy)",
      description: tpl.description,
      deadlineOffsetDays: tpl.deadlineOffsetDays,
      taskList: normalizeTemplateTaskList(tpl.taskList),
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    arr.push(copy);
    await saveAll(data);
    return copy;
  }

  // Soft-delete (deletedAt). Templates are not surfaced in the Deleted box in
  // v1; they purge via the daily sweep.
  async function deleteGoalTemplate(data, templateId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var tpl = findLiveGoalTemplate(ws, templateId);
    if (!tpl) return null;
    tpl.deletedAt = Date.now();
    await saveAll(data);
    return tpl;
  }

  function getActiveGoalTemplates(workspace) {
    var arr = ensureGoalTemplatesArray(workspace);
    if (!arr) return [];
    return arr.filter(function (t) { return !t.deletedAt; });
  }

  function getGoalTemplateById(workspace, templateId) {
    var arr = ensureGoalTemplatesArray(workspace);
    if (!arr) return null;
    var t = arr.find(function (x) { return x.id === templateId; });
    if (!t || t.deletedAt) return null;
    return t;
  }

  /**
   * [1.0.15] D2 — save a live goal as a template. Captures name, description,
   * deadlineOffsetDays (whole UTC calendar days from today to the goal's
   * deadline day, clamped >= 0; null when the goal has no deadline), and ALL
   * live child tasks as {name, priority} ordered by displayOrder. Completion
   * state is intentionally excluded — templates capture STRUCTURE.
   * @returns {Promise<object|null>} the created template.
   */
  async function saveGoalAsTemplate(data, goalId, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    var goal = findLiveGoal(ws, goalId);
    if (!goal) return null;
    var offset = null;
    if (typeof goal.deadlineAt === "number") {
      var days = Math.round((recurUtcMidnight(goal.deadlineAt) - recurUtcMidnight(Date.now())) / RECUR_DAY_MS);
      offset = Math.max(0, days);
    }
    var children = (ws.tasks || []).filter(function (t) {
      return t && t.goalId === goalId && !t.deletedAt;
    }).slice().sort(function (a, b) {
      return (a.displayOrder || 0) - (b.displayOrder || 0);
    });
    var taskList = children.map(function (t) {
      return { name: t.name, priority: isValidPriority(t.priority) ? t.priority : null };
    });
    return createGoalTemplate(data, {
      name: goal.name,
      description: goal.description || "",
      deadlineOffsetDays: offset,
      taskList: taskList
    }, workspaceId);
  }

  /**
   * [1.0.15] D3 — instantiate a template into a real goal in ONE saveAll. Creates
   * the goal (deadlineAt = UTC-midnight of today + offsetDays when the template
   * has an offset, else null), attaches the auto-tag via the shared createGoal
   * path (default on), and creates each template task under the goal inheriting
   * the auto-tag with the template's priority. The template is untouched, so it
   * can be instantiated repeatedly. opts: { name? (override), autoCreateTag?
   * (default true), tagColor? }.
   * @returns {Promise<{goal:object, tasks:object[]}|null>}
   */
  async function instantiateGoalTemplate(data, templateId, opts, workspaceId) {
    var ws = resolveWorkspaceFromData(data, workspaceId);
    if (!ws) return null;
    var tpl = findLiveGoalTemplate(ws, templateId);
    if (!tpl) return null;
    var o = opts || {};
    var name = (typeof o.name === "string" && o.name.trim()) ? o.name.trim() : tpl.name;
    var autoCreateTag = (o.autoCreateTag === undefined) ? true : !!o.autoCreateTag;
    var tagColor = (o.tagColor === undefined || o.tagColor === null) ? null : o.tagColor;
    if (autoCreateTag && tagColor !== null && !isValidHexColor(tagColor)) {
      console.warn("[LaunchPad] instantiateGoalTemplate: tagColor must match /^#[0-9A-Fa-f]{6}$/");
      return null;
    }

    // Deadline: the template's offset ALWAYS wins when present (UTC-midnight of
    // today + offset). Only when the template has NO offset does an explicit
    // opts.deadlineAt apply (the new-goal modal keeps its editable date field in
    // that case) — expected to already be a UTC-midnight epoch or null.
    if (o.deadlineAt !== undefined && o.deadlineAt !== null && typeof o.deadlineAt !== "number") {
      console.warn("[LaunchPad] instantiateGoalTemplate: deadlineAt must be a number or null");
      return null;
    }
    var now = Date.now();
    var deadlineAt = null;
    if (isValidOffsetDays(tpl.deadlineOffsetDays) && tpl.deadlineOffsetDays !== null) {
      deadlineAt = recurUtcMidnight(now) + tpl.deadlineOffsetDays * RECUR_DAY_MS;
    } else if (typeof o.deadlineAt === "number") {
      deadlineAt = o.deadlineAt;
    }

    var goals = ensureGoalsArray(ws);
    var goal = {
      id: genGoalId(),
      name: name,
      description: tpl.description || "",
      deadlineAt: deadlineAt,
      status: "active",
      autoTagId: null,
      isCollapsed: false,
      createdAt: now,
      completedAt: null,
      deletedAt: null,
      displayOrder: nextDisplayOrder(goals)
    };
    if (autoCreateTag) {
      attachAutoTagToGoal(ws, goal, tagColor, now);
    }
    goals.push(goal);

    var inheritedTags = goal.autoTagId ? [goal.autoTagId] : [];
    var createdTasks = [];
    normalizeTemplateTaskList(tpl.taskList).forEach(function (spec) {
      var task = newTaskObject(ws, {
        name: spec.name,
        goalId: goal.id,
        priority: spec.priority,
        tagIds: inheritedTags,
        isRecurringInstance: false
      });
      ensureTasksArray(ws).push(task);
      createdTasks.push(task);
    });

    await saveAll(data);
    return { goal: goal, tasks: createdTasks };
  }

  // ============================================================
  // [1.0.23] Achievements foundation (R1 — pure logic, no UI)
  // ============================================================
  //
  // Data model + a plain check-on-event engine + the five v1 badge conditions.
  // Display and celebrations land in [1.0.24] (R2); this round only WRITES
  // earned state and QUEUES pendingCelebrations — nothing consumes them yet.
  //
  // DESIGN (per the 2026-07-20 Arc C PLAN, D5/D6/D7):
  //  - Home is data.achievements (survives export/restore — earned state is
  //    precious). Existing installs have no record: migrate() is a no-op for
  //    already-workspace-shaped data, so this record is defaulted AT READ
  //    (getAchievements / ensureAchievements) exactly like getEndOfDayMinutes.
  //  - No event-bus (the Arc B registry lesson): a thin evaluator runs at the
  //    audited choke points only — completeTask (task-completed; its auto-goal
  //    branch ALSO emits goal-completed — the two-path trap), completeGoal
  //    (goal-completed), and a day-opened hook wired in newtab init.
  //  - Conditions are PURE functions over (data, achievements, one injected
  //    tracking read) — DOM-free, clock-injectable, fully harnessable.
  //  - Earned is idempotent and permanent: a badge earns once, is never
  //    re-earned and never un-earned; earning also pushes one pendingCelebration.
  //  - Scope is GLOBAL for all five (D4): counters/streaks/reads span every
  //    workspace regardless of combinedAnalyticsEnabled.

  var ACHIEVEMENTS_VERSION = 1;

  var BADGE_FIRST_WEEK   = "first-week";
  var BADGE_GOAL_CRUSHER = "goal-crusher";
  var BADGE_DEEP_DIVER   = "deep-diver";
  var BADGE_VARIETY      = "variety";
  var BADGE_CONSISTENCY  = "consistency";
  var BADGE_CURATOR      = "curator";        // [D-SIXTH]

  // Thresholds (D3, final; Curator added [D-SIXTH]).
  var ACH_GOAL_CRUSHER_TARGET = 5;          // goals completed lifetime
  var ACH_STREAK_TARGET       = 7;          // consecutive days (First Week + Consistency)
  var ACH_VARIETY_TAGS_TARGET = 5;          // distinct tags in the rolling window
  var ACH_VARIETY_WINDOW_MS   = 7 * 24 * 60 * 60 * 1000;  // rolling 7-day window
  var ACH_DEEP_DIVER_MS       = 2 * 60 * 60 * 1000;        // 7,200,000 — a single 2h session
  var ACH_CURATOR_TARGET      = 50;         // live shortcuts across all workspaces

  function emptyAchievements() {
    return {
      version: ACHIEVEMENTS_VERSION,
      // seeded flips true after the one-time retro pass has run (D7). It is the
      // guard that makes the pre-seed window race-free: completion events before
      // the retro are no-ops (the retro snapshot captures current state), so a
      // completion cannot both be counted incrementally AND by the snapshot.
      seeded: false,
      earned: {},                                   // badgeId -> { earnedAt, retro }
      // [1.0.24 item 0] Goal Crusher is DISTINCT: the SET of goal ids ever
      // completed (5 different goals lifetime). Recompleting a reactivated goal
      // does not recount; a purged goal's id persists in the set. Supersedes R1's
      // goalCompletions transition-counter (Samson's ruling 2026-07-20).
      counters: { completedGoalIds: [] },
      streaks: {
        openDays:       { lastDay: null, streak: 0 },
        completionDays: { lastDay: null, streak: 0 }
      },
      pendingCelebrations: []                        // [{ badgeId, earnedAt, retro, type }] — consumed R2
    };
  }

  function achNormStreak(s) {
    if (!s || typeof s !== "object") return { lastDay: null, streak: 0 };
    return {
      lastDay: (typeof s.lastDay === "string") ? s.lastDay : null,
      streak: (typeof s.streak === "number" && s.streak >= 0) ? s.streak : 0
    };
  }

  // Defaulting READER — non-mutating, returns a normalized snapshot even when
  // data.achievements is absent or partial. Use for reads (harness, R2 display).
  // Engine writes go through ensureAchievements (the live object).
  function getAchievements(data) {
    var a = (data && data.achievements && typeof data.achievements === "object") ? data.achievements : null;
    if (!a) return emptyAchievements();
    return {
      version: (typeof a.version === "number") ? a.version : ACHIEVEMENTS_VERSION,
      seeded: !!a.seeded,
      earned: (a.earned && typeof a.earned === "object") ? a.earned : {},
      counters: { completedGoalIds: (a.counters && Array.isArray(a.counters.completedGoalIds)) ? a.counters.completedGoalIds : [] },
      streaks: {
        openDays: achNormStreak(a.streaks && a.streaks.openDays),
        completionDays: achNormStreak(a.streaks && a.streaks.completionDays)
      },
      pendingCelebrations: Array.isArray(a.pendingCelebrations) ? a.pendingCelebrations : []
    };
  }

  // Mutating ENSURE (the ensure*Array convention): guarantees data.achievements
  // exists and is well-shaped, and returns the LIVE object for the engine to
  // mutate. Callers own the saveAll.
  function ensureAchievements(data) {
    if (!data.achievements || typeof data.achievements !== "object") {
      data.achievements = emptyAchievements();
      return data.achievements;
    }
    var a = data.achievements;
    if (typeof a.version !== "number") a.version = ACHIEVEMENTS_VERSION;
    if (typeof a.seeded !== "boolean") a.seeded = false;
    if (!a.earned || typeof a.earned !== "object") a.earned = {};
    if (!a.counters || typeof a.counters !== "object") a.counters = {};
    // [1.0.24 item 0] Migrate the R1 transition-counter to the distinct SET.
    // A seeded R1 record carries counters.goalCompletions (a number) and no
    // completedGoalIds. Re-derive the set HONESTLY from live completed goals —
    // the same snapshot the retro seed uses — then drop the old field. Runs once
    // (the array is present thereafter). Fresh records already have the array
    // from emptyAchievements, so this never fires spuriously.
    if (!Array.isArray(a.counters.completedGoalIds)) {
      a.counters.completedGoalIds = achCompletedGoalIdsSnapshot(data);
    }
    if ("goalCompletions" in a.counters) delete a.counters.goalCompletions;
    if (!a.streaks || typeof a.streaks !== "object") a.streaks = {};
    a.streaks.openDays = achNormStreak(a.streaks.openDays);
    a.streaks.completionDays = achNormStreak(a.streaks.completionDays);
    if (!Array.isArray(a.pendingCelebrations)) a.pendingCelebrations = [];
    return a;
  }

  // ---- Pure date helpers (local calendar day) ----
  function achDayKey(ts) {
    var d = new Date(ts == null ? Date.now() : ts);
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }
  // Whole calendar days from a to b (b - a). Both keys parsed identically via
  // Date.UTC, so the zone offset cancels — this is a pure day-count, DST-safe.
  function achDayDiff(a, b) {
    var pa = a.split("-"), pb = b.split("-");
    return Math.round(
      (Date.UTC(+pb[0], +pb[1] - 1, +pb[2]) - Date.UTC(+pa[0], +pa[1] - 1, +pa[2])) / 86400000
    );
  }

  // Advance a {lastDay, streak} record with a new activity day. Same day -> no
  // change; consecutive (+1) -> streak+1; gap (>1) -> reset to 1; a past-dated
  // day (<0, defensive — live completedAt is always "now") is ignored, never
  // rewinds the streak.
  function achAdvanceStreak(streakObj, dayKey) {
    var s = achNormStreak(streakObj);
    if (s.lastDay == null) return { lastDay: dayKey, streak: 1 };
    var diff = achDayDiff(s.lastDay, dayKey);
    if (diff === 0) return { lastDay: s.lastDay, streak: s.streak };
    if (diff === 1) return { lastDay: dayKey, streak: s.streak + 1 };
    if (diff > 1)   return { lastDay: dayKey, streak: 1 };
    return { lastDay: s.lastDay, streak: s.streak };
  }

  // ---- Pure condition evaluators ----
  function achCondGoalCrusher(ach)  { return ach.counters.completedGoalIds.length >= ACH_GOAL_CRUSHER_TARGET; }
  function achCondFirstWeek(ach)    { return ach.streaks.openDays.streak >= ACH_STREAK_TARGET; }
  function achCondConsistency(ach)  { return ach.streaks.completionDays.streak >= ACH_STREAK_TARGET; }
  function achCondDeepDiver(maxLongestSessionMs) { return (maxLongestSessionMs || 0) >= ACH_DEEP_DIVER_MS; }

  // [D-SIXTH] Curator is STATELESS — a live count, not a persisted counter, so
  // the achievements record shape is unchanged (no seed, no migration). Retro is
  // inherent: a 50+ user earns on the first open with this build.
  //
  // COUNTING RULE: LIVE TOP-LEVEL shortcuts across ALL workspaces. A shortcut
  // counts iff neither it nor its group is soft-deleted. Variants (auto-nested
  // domain-alias aliases under a parent, e.g. sheets.google.com under a
  // docs.google.com parent) are NOT counted — they are aliases of a shortcut,
  // not independently-organized entries, and counting them would inflate the
  // milestone opaquely. Trashed shortcuts and shortcuts inside trashed groups
  // are excluded (they are in the bin, not organized).
  function achLiveShortcutCount(data) {
    var n = 0;
    (data && data.workspaces || []).forEach(function (ws) {
      if (!ws || !Array.isArray(ws.groups)) return;
      ws.groups.forEach(function (g) {
        if (!g || g.deletedAt != null || !Array.isArray(g.shortcuts)) return;
        g.shortcuts.forEach(function (sc) {
          if (sc && sc.deletedAt == null) n++;
        });
      });
    });
    return n;
  }
  function achCondCurator(count) { return (count || 0) >= ACH_CURATOR_TARGET; }

  // Variety: distinct tags across LIVE completed tasks whose completedAt is
  // within the rolling window ending at nowMs. Global (all workspaces). Tags
  // are namespaced by workspace id so ids from different workspaces never
  // collide into one bucket.
  function achVarietyDistinctTags(data, nowMs) {
    var cutoff = nowMs - ACH_VARIETY_WINDOW_MS;
    var set = {};
    (data.workspaces || []).forEach(function (ws) {
      if (!ws) return;
      (ws.tasks || []).forEach(function (t) {
        if (!t || t.deletedAt != null) return;
        if (!t.completed || typeof t.completedAt !== "number") return;
        if (t.completedAt < cutoff) return;
        (Array.isArray(t.tagIds) ? t.tagIds : []).forEach(function (id) {
          if (id) set[ws.id + ":" + id] = true;
        });
      });
    });
    return Object.keys(set).length;
  }

  // ---- Retro snapshots (D7) ----
  // The DISTINCT ids of live completed goals. Undercount is accepted and honest:
  // completed-then-purged goals are gone (30-day trash TTL) and reactivation
  // clears status — so this floors the true lifetime set. That is exactly why
  // the set is persisted from the seed forward (ids added at completion, never
  // removed) rather than recomputed: a goal completed today then purged next
  // month keeps its id in the set even though this snapshot could not find it.
  function achCompletedGoalIdsSnapshot(data) {
    var ids = [];
    var seen = {};
    (data.workspaces || []).forEach(function (ws) {
      if (!ws) return;
      (ws.goals || []).forEach(function (g) {
        if (g && g.deletedAt == null && g.status === "completed" && g.id && !seen[g.id]) {
          seen[g.id] = true;
          ids.push(g.id);
        }
      });
    });
    return ids;
  }

  // Current completion-day streak from live tasks: the run of consecutive days
  // ending at the most recent completion day. Purge-lossy by nature (only live
  // tasks carry completedAt) — a best-effort reconstruction, not a guarantee.
  function achCompletionStreakSnapshot(data) {
    var daySet = {};
    (data.workspaces || []).forEach(function (ws) {
      if (!ws) return;
      (ws.tasks || []).forEach(function (t) {
        if (t && t.deletedAt == null && t.completed && typeof t.completedAt === "number") {
          daySet[achDayKey(t.completedAt)] = true;
        }
      });
    });
    var days = Object.keys(daySet).sort();
    if (!days.length) return { lastDay: null, streak: 0 };
    var last = days[days.length - 1];
    var streak = 1;
    for (var i = days.length - 1; i > 0; i--) {
      if (achDayDiff(days[i - 1], days[i]) === 1) streak++;
      else break;
    }
    return { lastDay: last, streak: streak };
  }

  // Earn a badge once. Idempotent: an already-earned badge is a no-op and is
  // NOT re-queued. Returns true only on the first earn. The queued entry carries
  // type:"badge-unlock" so the [1.0.24] splash consumer can filter (goal
  // completions are IMMEDIATE, never queued — the queue is unlocks only).
  function achEarn(ach, badgeId, nowMs, retro) {
    if (ach.earned[badgeId]) return false;
    ach.earned[badgeId] = { earnedAt: nowMs, retro: !!retro };
    ach.pendingCelebrations.push({ badgeId: badgeId, earnedAt: nowMs, retro: !!retro, type: "badge-unlock" });
    return true;
  }

  // [1.0.24 item 2] Shift the OLDEST pending celebration (optionally of a given
  // type; an R1 entry with no type reads as "badge-unlock"). Mutate-only — the
  // caller owns the provenance-correct saveAll. Returns the entry or null.
  function dequeueCelebration(data, type) {
    var ach = ensureAchievements(data);
    var q = ach.pendingCelebrations;
    for (var i = 0; i < q.length; i++) {
      var t = (q[i] && q[i].type) || "badge-unlock";
      if (!type || t === type) return q.splice(i, 1)[0];
    }
    return null;
  }

  // ---- Engine entry point 1: completion events (mutate-only, synchronous) ----
  //
  // Called from completeTask/completeGoal BEFORE their existing saveAll, so the
  // achievements mutation rides that single provenance-tagged write — no extra
  // save, no second onChanged. Returns the badgeIds newly earned (for R2).
  //
  // Pre-seed gate: while !seeded the retro pass has not run, so incremental
  // evaluation is skipped entirely — the just-completed goal/task is part of the
  // current state the retro snapshot will read, and double-counting it (once
  // here, once by the snapshot) is exactly what the gate prevents.
  function achievementsOnCompletion(data, eventType, ctx, nowMs) {
    var ach = ensureAchievements(data);
    if (!ach.seeded) return [];
    var now = (typeof nowMs === "number") ? nowMs : Date.now();
    var earned = [];

    if (eventType === "goal-completed") {
      // DISTINCT: add the goal's id to the set iff new. Recompleting a
      // reactivated goal (same id) is a no-op; a purged goal keeps its id.
      var gid = ctx && ctx.goal && ctx.goal.id;
      if (gid && ach.counters.completedGoalIds.indexOf(gid) === -1) ach.counters.completedGoalIds.push(gid);
      if (achCondGoalCrusher(ach) && achEarn(ach, BADGE_GOAL_CRUSHER, now, false)) earned.push(BADGE_GOAL_CRUSHER);
    } else if (eventType === "task-completed") {
      var task = ctx && ctx.task;
      var day = achDayKey(task && typeof task.completedAt === "number" ? task.completedAt : now);
      ach.streaks.completionDays = achAdvanceStreak(ach.streaks.completionDays, day);
      if (achCondConsistency(ach) && achEarn(ach, BADGE_CONSISTENCY, now, false)) earned.push(BADGE_CONSISTENCY);
      if (achVarietyDistinctTags(data, now) >= ACH_VARIETY_TAGS_TARGET && achEarn(ach, BADGE_VARIETY, now, false)) earned.push(BADGE_VARIETY);
    }
    return earned;
  }

  // ---- Engine entry point 2: day-opened (mutate-only; caller reads Tracking) ----
  //
  // Runs the one-time retro seed (guarded by !seeded), advances the open-day
  // streak, and evaluates the day-opened badges (First Week, Deep Diver). Deep
  // Diver needs one tracking read (max longestSessionMs across retained
  // aggregates), passed in by the caller so this stays pure/clock-injectable and
  // storage.js keeps no dependency on the tracking module.
  //
  // Returns { earned, changed }. `changed` lets the caller skip a needless write
  // on a same-day reopen with nothing new.
  function achievementsOnDayOpened(data, opts) {
    opts = opts || {};
    var ach = ensureAchievements(data);
    var now = (typeof opts.nowMs === "number") ? opts.nowMs : Date.now();
    var today = opts.todayKey || achDayKey(now);
    var maxLongest = (typeof opts.maxLongestSessionMs === "number") ? opts.maxLongestSessionMs : 0;
    var retro = !ach.seeded;            // the whole first-open evaluation is "retro"
    var earned = [];
    var changed = false;

    // ONE-TIME RETRO SEED (D7): counter + completion streak from live data,
    // plus the data-only earn checks. Deep Diver's retro is handled by the
    // unconditional check below (earn is permanent, so it is naturally retro on
    // the first open). openDays has no history to seed — First Week from zero.
    if (!ach.seeded) {
      ach.counters.completedGoalIds = achCompletedGoalIdsSnapshot(data);
      ach.streaks.completionDays = achCompletionStreakSnapshot(data);
      ach.seeded = true;
      changed = true;
      if (achCondGoalCrusher(ach) && achEarn(ach, BADGE_GOAL_CRUSHER, now, true)) earned.push(BADGE_GOAL_CRUSHER);
      if (achCondConsistency(ach) && achEarn(ach, BADGE_CONSISTENCY, now, true)) earned.push(BADGE_CONSISTENCY);
      if (achVarietyDistinctTags(data, now) >= ACH_VARIETY_TAGS_TARGET && achEarn(ach, BADGE_VARIETY, now, true)) earned.push(BADGE_VARIETY);
    }

    // OPEN-DAY STREAK — every open; only the first open of a new day changes it.
    var prevOpen = ach.streaks.openDays;
    var nextOpen = achAdvanceStreak(prevOpen, today);
    if (nextOpen.lastDay !== prevOpen.lastDay || nextOpen.streak !== prevOpen.streak) changed = true;
    ach.streaks.openDays = nextOpen;
    if (achCondFirstWeek(ach) && achEarn(ach, BADGE_FIRST_WEEK, now, retro)) { earned.push(BADGE_FIRST_WEEK); changed = true; }

    // DEEP DIVER — every open (a 2h session that closed since the last open of
    // the same day must still land). Permanent once earned.
    if (achCondDeepDiver(maxLongest) && achEarn(ach, BADGE_DEEP_DIVER, now, retro)) { earned.push(BADGE_DEEP_DIVER); changed = true; }

    // CURATOR [D-SIXTH] — stateless: count live shortcuts across all workspaces
    // right now. Day-opened only (like Deep Diver); the multi-site shortcut-add
    // paths, incl. background.js inline writes, would need R3's emit helpers for
    // in-the-moment earning, so a next-open earn is the accepted Flag-2 pattern.
    if (achCondCurator(achLiveShortcutCount(data)) && achEarn(ach, BADGE_CURATOR, now, retro)) { earned.push(BADGE_CURATOR); changed = true; }

    return { earned: earned, changed: changed };
  }

  // [R3-D5] Focused Curator evaluation for add-event immediacy. Stateless (a
  // live count), mutate-only, IDEMPOTENT via achEarn — so an earn here does NOT
  // double with the day-opened backstop. Returns true iff Curator newly earned
  // (queued a splash). The caller Pro-gates and owns the saveAll.
  function achievementsEvaluateCurator(data, nowMs) {
    var ach = ensureAchievements(data);
    var now = (typeof nowMs === "number") ? nowMs : Date.now();
    return !!(achCondCurator(achLiveShortcutCount(data)) && achEarn(ach, BADGE_CURATOR, now, false));
  }

  // ============================================================
  // [R3] Getting-Started checklist (free tier)
  // ============================================================
  //
  // Six steps that tick as the user performs real actions (the D17 Tips rows
  // become a live checklist). Same "small record + defaulting reader" discipline
  // as the achievements record: lives in data (survives export/restore),
  // defaulted at read (migrate is a no-op for existing installs).
  //
  // Ticks are booleans, so they are naturally idempotent — no pre-seed gate is
  // needed (unlike the achievements counter). A tick rides the SAME storage
  // write its funnel already makes (recordChecklistStep is mutate-only). Demo-
  // seeded content never ticks (R3-D2) and never retro-ticks (R3-D3).

  var GS_VERSION = 1;
  var GS_STEP_SHORTCUT   = "1";   // add a shortcut (any add funnel)
  var GS_STEP_RIGHTCLICK = "2";   // add via the right-click context menu ONLY
  var GS_STEP_NEST       = "3";   // nest one tile on another (any nest funnel)
  var GS_STEP_GROUP      = "4";   // create a group (user-created, not auto-ungrouped)
  var GS_STEP_WORKSPACE  = "5";   // switch workspaces
  var GS_STEP_BACKGROUND = "6";   // pick a background
  var GS_STEP_IDS = ["1", "2", "3", "4", "5", "6"];

  function emptyGettingStarted() {
    return { version: GS_VERSION, steps: {}, dismissed: false, retroDone: false };
  }

  // Defaulting READER — non-mutating, normalized even when absent/partial.
  function getGettingStarted(data) {
    var g = (data && data.gettingStarted && typeof data.gettingStarted === "object") ? data.gettingStarted : null;
    if (!g) return emptyGettingStarted();
    return {
      version: (typeof g.version === "number") ? g.version : GS_VERSION,
      steps: (g.steps && typeof g.steps === "object") ? g.steps : {},
      dismissed: !!g.dismissed,
      retroDone: !!g.retroDone
    };
  }

  // Mutating ENSURE — returns the live object for the engine to mutate.
  function ensureGettingStarted(data) {
    if (!data.gettingStarted || typeof data.gettingStarted !== "object") {
      data.gettingStarted = emptyGettingStarted();
      return data.gettingStarted;
    }
    var g = data.gettingStarted;
    if (typeof g.version !== "number") g.version = GS_VERSION;
    if (!g.steps || typeof g.steps !== "object") g.steps = {};
    if (typeof g.dismissed !== "boolean") g.dismissed = false;
    if (typeof g.retroDone !== "boolean") g.retroDone = false;
    return g;
  }

  // Tick a step. Mutate-only (caller saves); permanent and idempotent.
  function recordChecklistStep(data, stepId) {
    if (!data || stepId == null) return false;
    var g = ensureGettingStarted(data);
    var k = String(stepId);
    if (g.steps[k]) return false;
    g.steps[k] = true;
    return true;
  }

  // Manual dismiss (the always-available escape hatch, R3-D4). Mutate-only.
  function dismissGettingStarted(data) {
    var g = ensureGettingStarted(data);
    if (g.dismissed) return false;
    g.dismissed = true;
    return true;
  }

  // [2.0] One-time Pro-activation celebration flag. Per-field setter, no-op
  // guarded, mutate-only — the caller saveAll's, matching dismissGettingStarted.
  //
  // TOP-LEVEL, deliberately NOT inside data.pro: clearLicense() wipes the whole
  // pro block's licence fields, so a flag living there would reset on any
  // clear-and-reapply and replay the celebration to someone who has already had
  // it. "Once ever" has to outlive the licence it was triggered by. Same
  // placement reasoning as __devProOverride.
  function markProCelebrated(data) {
    if (!data) return false;
    if (data.proCelebrated === true) return false;
    data.proCelebrated = true;
    return true;
  }

  // Dev-only replay support (the caller is IS_UNPACKED-gated). Separate from the
  // setter so nothing in the product can un-set the flag by accident.
  function clearProCelebrated(data) {
    if (!data) return false;
    if (!data.proCelebrated) return false;
    data.proCelebrated = false;
    return true;
  }

  // One-time HONEST retro (R3-D3). Existing real content pre-ticks what it
  // proves; DEMO content proves nothing. Step 2 (right-click) is unknowable
  // retroactively and never retro-ticks. Step 6's source (the background) is a
  // separate storage key, so the caller reads it and passes
  // opts.hasNonDefaultBackground. Mutate-only; guarded by retroDone so it runs
  // once. Returns true iff anything changed (incl. the flag flip).
  function retroTickGettingStarted(data, opts) {
    var g = ensureGettingStarted(data);
    if (g.retroDone) return false;
    opts = opts || {};
    var ws = getActiveWorkspace(data);
    var groups = (ws && Array.isArray(ws.groups)) ? ws.groups : [];
    var liveGroups = groups.filter(function (gr) { return gr && gr.deletedAt == null && !isDemoGroup(gr); });

    // Step 1: a real (non-demo, live) shortcut exists.
    if (liveGroups.some(function (gr) {
      return (gr.shortcuts || []).some(function (s) { return s && s.deletedAt == null && !isDemoShortcut(s); });
    })) g.steps[GS_STEP_SHORTCUT] = true;

    // Step 3: a real live shortcut carries a live variant (nested).
    if (liveGroups.some(function (gr) {
      return (gr.shortcuts || []).some(function (s) {
        return s && s.deletedAt == null && !isDemoShortcut(s) &&
          Array.isArray(s.variants) && s.variants.some(function (v) { return v && v.deletedAt == null; });
      });
    })) g.steps[GS_STEP_NEST] = true;

    // Step 4: a user-created group — non-demo, live, and not the auto "ungrouped".
    if (liveGroups.some(function (gr) { return gr.id !== "ungrouped"; })) g.steps[GS_STEP_GROUP] = true;

    // Step 5: more than one workspace.
    if (Array.isArray(data.workspaces) && data.workspaces.length > 1) g.steps[GS_STEP_WORKSPACE] = true;

    // Step 6: a persisted non-default background (caller-provided; separate key).
    if (opts.hasNonDefaultBackground) g.steps[GS_STEP_BACKGROUND] = true;

    // Step 2 is deliberately NOT touched.
    g.retroDone = true;
    return true;
  }

  // ============================================================
  // [2.0] Today cockpit readers
  // ============================================================
  //
  // The Dashboard's "today" surface composes its five modules from these. They
  // live HERE rather than in the page for the reason focusArmState states in its
  // own comment: the page owns the wording, storage owns the state — and state
  // that lives here is harnessable in a Node VM against the real module, which
  // page-side logic is not (BUGS.md P5 / Q1). Every one of them is PURE: no
  // clock, no storage read, no mutation. The caller supplies the day key, the
  // "today" stamp and the range map, so every boundary case is testable without
  // mocking Date.
  //
  // ZERO NEW CAPTURE. Each reads a field some existing writer already maintains:
  // focusStats.byDay (incrementFocusStat, since [1.2.0]), task.completedAt
  // (completeTask), the goalId back-reference (createTask), task.dueAt, and the
  // tracking engine's own windowed range map.

  // The local calendar day key, PUBLIC. Same function the focusStats writer keys
  // on (achDayKey) — deliberately the same one, not a copy, so a reader can never
  // disagree with the writer about which bucket "today" is. Byte-identical in
  // output to Tracking._localDayKey (both are YYYY-MM-DD off the local calendar
  // date), which is what lets the strip's blocked count and the streak's day
  // window speak about the same days. The suite asserts that equality rather than
  // assuming it, because the two are separate implementations in separate files.
  function localDayKey(ts) {
    return achDayKey(ts);
  }

  // Distractions blocked on a given local day. focusStats is GLOBAL, not
  // workspace-keyed (the C8 decision — see FOCUS_STATS_VERSION above), so this is
  // deliberately an all-workspaces figure regardless of the Dashboard's scope;
  // the page labels it plainly rather than implying a scope it does not have.
  //
  // An absent day is 0, never NaN or undefined — the honest reading of "nothing
  // was blocked today" and of "this install has never blocked anything". Runs
  // through ensureFocusStats so a malformed or missing record normalizes instead
  // of throwing, but takes a COPY of the count: this is a read, and callers on
  // the render path must not be mutating `data`.
  function focusBlockedOnDay(data, dayKey) {
    if (!data || typeof dayKey !== "string") return 0;
    var stats = ensureFocusStats(data);
    var bucket = stats.byDay[dayKey];
    return (bucket && typeof bucket.blocked === "number") ? bucket.blocked : 0;
  }

  // Tasks completed on a given local day, in one workspace.
  //
  // Three filters, each load-bearing:
  //   - !deletedAt   a trashed task KEEPS its completedAt, so trash would
  //                  otherwise inflate today's count (the getAllTasks/J5 trap in
  //                  the other direction).
  //   - completed    reactivateTask nulls completedAt, so this is belt-and-
  //                  braces; a task can never carry a stamp while incomplete.
  //   - day match    on the LOCAL calendar day, which is what makes the count
  //                  roll over at the user's midnight rather than UTC's.
  function tasksCompletedOnDay(workspace, dayKey) {
    if (!workspace || typeof dayKey !== "string") return 0;
    var tasks = ensureTasksArray(workspace);
    if (!tasks) return 0;
    var n = 0;
    tasks.forEach(function (t) {
      if (!t || t.deletedAt || !t.completed) return;
      if (typeof t.completedAt !== "number") return;
      if (achDayKey(t.completedAt) === dayKey) n++;
    });
    return n;
  }

  // Active goals with their done-ratios, most-recently-ACTIVE first.
  //
  // "Recently active" is DERIVED, and that is a deliberate call rather than an
  // oversight: a goal record carries createdAt / completedAt / deletedAt /
  // displayOrder and NOTHING that any writer touches when work happens under it.
  // There is no lastActiveAt to read. Rather than add a writer (this round ships
  // zero new capture), recency is the newest signal its own tasks already carry —
  // a child's completedAt if it has one, else its createdAt — falling back to the
  // goal's createdAt for a goal with no tasks yet. displayOrder breaks ties so the
  // order is total and the list cannot flicker between two equal-recency goals.
  //
  // The done-ratio counts over getAllTasks' population (live, completed included),
  // which is the only population a ratio can be taken over — getActiveTasks drops
  // the completed half of the fraction. Unlike the Dashboard's previous top-goals
  // reader this does NOT filter out fully-done goals: a goal at 5 of 5 that has
  // not yet been closed is exactly what a progress module should be showing.
  function goalProgressList(workspace) {
    if (!workspace) return [];
    var all = getAllTasks(workspace);
    return getActiveGoals(workspace).map(function (g) {
      var children = all.filter(function (t) { return t.goalId === g.id; });
      var done = 0;
      var lastActiveAt = (typeof g.createdAt === "number") ? g.createdAt : 0;
      children.forEach(function (t) {
        if (t.completed) done++;
        var at = (t.completed && typeof t.completedAt === "number")
          ? t.completedAt
          : (typeof t.createdAt === "number" ? t.createdAt : 0);
        if (at > lastActiveAt) lastActiveAt = at;
      });
      return {
        goal: g,
        done: done,
        total: children.length,
        // A goal with no tasks is 0%, not NaN — the division is guarded, and 0
        // is the truthful reading of "nothing done under it yet".
        pct: children.length ? Math.round((done / children.length) * 100) : 0,
        lastActiveAt: lastActiveAt
      };
    }).sort(function (a, b) {
      if (a.lastActiveAt !== b.lastActiveAt) return b.lastActiveAt - a.lastActiveAt;
      var ao = typeof a.goal.displayOrder === "number" ? a.goal.displayOrder : 0;
      var bo = typeof b.goal.displayOrder === "number" ? b.goal.displayOrder : 0;
      return ao - bo;
    });
  }

  // Incomplete, live tasks due on or before `todayUtcDay`, earliest first — so
  // overdue tasks lead naturally, oldest first, without a second pass or a second
  // sort key. The caller decides which of them to badge as overdue by comparing
  // utcDay(dueAt) against the same stamp it passed in.
  //
  // `todayUtcDay` is UTC-MIDNIGHT OF THE LOCAL CALENDAR DATE, the space dueAt
  // actually lives in — see the long note on the page's dashboardTodayAsUtcDay
  // for why neither a local-midnight timestamp nor utcDay(Date.now()) is that
  // stamp. Taking it as an argument keeps this function pure and puts the one
  // encoding decision at a single call site.
  function tasksDueByDay(workspace, todayUtcDay) {
    if (!workspace || typeof todayUtcDay !== "number") return [];
    return getActiveTasks(workspace)
      .filter(function (t) { return typeof t.dueAt === "number" && utcDay(t.dueAt) <= todayUtcDay; })
      .sort(function (a, b) {
        if (a.dueAt !== b.dueAt) return a.dueAt - b.dueAt;
        return (a.createdAt || 0) - (b.createdAt || 0);
      });
  }

  // Consecutive days with focused time, ending today. Composed page-side from the
  // Insights range reader's output ({ dayKey: ms }, oldest-first keys, last =
  // today) — which is why it takes the map rather than reading anything: it adds
  // ZERO delta to tracking.js.
  //
  // TODAY-ZERO GRACE. A day is not over until it is over, so a zero today does
  // not break a streak — it just does not extend it. Walking back from today when
  // today is 0 would report a 0-day streak at 09:00 to someone who has focused
  // every day for a month. So: if today has time, the count starts at today; if it
  // does not, the count is the streak through YESTERDAY and the page says so.
  //
  // RETENTION CAP. The map only holds the days that were asked for, and the
  // engine only retains 30, so a walk that runs off the START of the window
  // learned nothing about the day before it — the count is a FLOOR, not a total.
  // `capped` says which of the two it is, so the page can render "30+ days"
  // instead of asserting an exact 30 it cannot see. It is returned rather than
  // re-derived page-side from a window length the page would have to restate.
  // (With the today-zero grace below, a user mid-streak before their first
  // focused minute of the day caps one lower — "29+" — which is the honest
  // number: 29 whole days observed, and an unknown beyond the window.)
  function focusStreakFromRange(range, keys) {
    var out = { days: 0, capped: false, todayCounted: false };
    if (!range || !Array.isArray(keys) || keys.length === 0) return out;
    var i = keys.length - 1;
    if ((range[keys[i]] || 0) > 0) {
      out.todayCounted = true;
    } else {
      i--;   // today is still open — count the streak through yesterday
    }
    for (; i >= 0; i--) {
      if ((range[keys[i]] || 0) <= 0) break;
      out.days++;
    }
    // Ran off the start of the window rather than stopping at a zero day.
    out.capped = (i < 0 && out.days > 0);
    return out;
  }

  return {
    // [1.0.11.2] Write-provenance hooks — see saveAll() above.
    TAB_INSTANCE_ID: TAB_INSTANCE_ID,
    _pendingWriteIds: _pendingWriteIds,
    getDefaultData: getDefaultData,
    getAll: getAll,
    saveAll: saveAll,
    migrate: migrate,
    emptyTrackingState: emptyTrackingState,
    ensureTrackingState: ensureTrackingState,
    // [1.0.26] Exposed for tracking attribution: a session carries its own
    // workspaceId and must resolve against THAT workspace, not the active one
    // (backfill rolls up sessions from workspaces the user is not currently in).
    resolveWorkspaceFromData: resolveWorkspaceFromData,
    isTrackingEnabled: isTrackingEnabled,
    setTrackingEnabled: setTrackingEnabled,
    isTrackingPaused: isTrackingPaused,
    // [1.0.20] Dashboard end-of-day boundary (minutes since local midnight).
    getEndOfDayMinutes: getEndOfDayMinutes,
    // [2.0] Text size — free accessibility setting, small | medium | large.
    getTextSize: getTextSize,
    setTextSize: setTextSize,
    TEXT_SIZES: TEXT_SIZES.slice(),
    // [1.0.20 F2] Combined-analytics toggle setter (Dashboard's cross-workspace view).
    setCombinedAnalyticsEnabled: setCombinedAnalyticsEnabled,
    getInsightsRangeDays: getInsightsRangeDays,
    setInsightsRangeDays: setInsightsRangeDays,
    setTrackingPaused: setTrackingPaused,

    // [1.0.18] Pomodoro settings — defaulting reader + four per-field updaters.
    getPomodoroSettings: getPomodoroSettings,
    setPomodoroWorkMin: setPomodoroWorkMin,
    setPomodoroShortBreakMin: setPomodoroShortBreakMin,
    setPomodoroLongBreakMin: setPomodoroLongBreakMin,
    setPomodoroCyclesBeforeLongBreak: setPomodoroCyclesBeforeLongBreak,
    setPomodoroNotificationsEnabled: setPomodoroNotificationsEnabled,
    // [1.0.18 B-2] Boundary chime: the enum setter, the canonical id list (the
    // settings radios are authored in newtab.html; this is what validates them),
    // the asset resolver, and the pure playback router shared by page and worker.
    setPomodoroSound: setPomodoroSound,
    POMODORO_SOUND_IDS: POMODORO_SOUND_IDS,
    pomodoroSoundFile: pomodoroSoundFile,
    pomodoroSoundTarget: pomodoroSoundTarget,

    // [1.0.23] Achievements (R1). Public: the defaulting reader + the two engine
    // entry points. The completion entry point is also called internally by
    // completeTask/completeGoal; it is exported for the harness and for R2.
    getAchievements: getAchievements,
    ensureAchievements: ensureAchievements,
    achievementsOnCompletion: achievementsOnCompletion,
    achievementsOnDayOpened: achievementsOnDayOpened,
    // [1.0.24 item 2] Splash queue consumer (mutate-only; caller saveAll's).
    dequeueCelebration: dequeueCelebration,
    // [R3-D5] Add-event Curator immediacy (mutate-only; caller Pro-gates + saves).
    achievementsEvaluateCurator: achievementsEvaluateCurator,
    // [R3] Getting-Started checklist (free tier).
    getGettingStarted: getGettingStarted,
    ensureGettingStarted: ensureGettingStarted,
    recordChecklistStep: recordChecklistStep,
    dismissGettingStarted: dismissGettingStarted,
    retroTickGettingStarted: retroTickGettingStarted,
    // [2.0] Pro-activation celebration flag (mutate-only; caller saveAll's).
    markProCelebrated: markProCelebrated,
    clearProCelebrated: clearProCelebrated,
    GS_STEPS: { SHORTCUT: GS_STEP_SHORTCUT, RIGHTCLICK: GS_STEP_RIGHTCLICK, NEST: GS_STEP_NEST, GROUP: GS_STEP_GROUP, WORKSPACE: GS_STEP_WORKSPACE, BACKGROUND: GS_STEP_BACKGROUND, IDS: GS_STEP_IDS },
    // Underscore hooks — pure condition/helper fns exposed for the R1 harness,
    // not for UI (same discipline as tracking's _ hooks).
    _emptyAchievements: emptyAchievements,
    _achDayKey: achDayKey,
    _achDayDiff: achDayDiff,
    _achAdvanceStreak: achAdvanceStreak,
    _achVarietyDistinctTags: achVarietyDistinctTags,
    _achCompletedGoalIdsSnapshot: achCompletedGoalIdsSnapshot,
    _achCompletionStreakSnapshot: achCompletionStreakSnapshot,
    _achLiveShortcutCount: achLiveShortcutCount,
    _achConditions: {
      goalCrusher: achCondGoalCrusher,
      firstWeek: achCondFirstWeek,
      consistency: achCondConsistency,
      deepDiver: achCondDeepDiver,
      curator: achCondCurator
    },
    _ACH: {
      GOAL_CRUSHER_TARGET: ACH_GOAL_CRUSHER_TARGET,
      STREAK_TARGET: ACH_STREAK_TARGET,
      VARIETY_TAGS_TARGET: ACH_VARIETY_TAGS_TARGET,
      VARIETY_WINDOW_MS: ACH_VARIETY_WINDOW_MS,
      DEEP_DIVER_MS: ACH_DEEP_DIVER_MS,
      CURATOR_TARGET: ACH_CURATOR_TARGET,
      BADGES: { FIRST_WEEK: BADGE_FIRST_WEEK, GOAL_CRUSHER: BADGE_GOAL_CRUSHER, DEEP_DIVER: BADGE_DEEP_DIVER, VARIETY: BADGE_VARIETY, CONSISTENCY: BADGE_CONSISTENCY, CURATOR: BADGE_CURATOR }
    },
    anchorBrowserSession: anchorBrowserSession,

    // [2.0] Browser-closed time is paused time. The heartbeat lives in its own
    // storage key (see the note above HEARTBEAT_KEY for why it is not in `data`).
    HEARTBEAT_KEY: HEARTBEAT_KEY,
    readHeartbeat: readHeartbeat,
    writeHeartbeat: writeHeartbeat,
    clearHeartbeat: clearHeartbeat,
    closedBrowserFoldMs: closedBrowserFoldMs,
    foldClosedBrowserSpan: foldClosedBrowserSpan,
    consumeClosedPauseNotice: consumeClosedPauseNotice,
    setIdleState: setIdleState,
    // [1.0.19] First-run example content
    seedDemoContent: seedDemoContent,
    clearDemoContent: clearDemoContent,
    hasDemoContent: hasDemoContent,
    hasRealShortcut: hasRealShortcut,
    isDemoGroup: isDemoGroup,
    isDemoShortcut: isDemoShortcut,
    getActiveWorkspace: getActiveWorkspace,
    getActiveWorkspaceIndex: getActiveWorkspaceIndex,
    addShortcut: addShortcut,
    removeShortcut: removeShortcut,
    addGroup: addGroup,
    removeGroup: removeGroup,
    reorderShortcuts: reorderShortcuts,
    reorderGroups: reorderGroups,
    getBackground: getBackground,
    saveBackground: saveBackground,
    getProAccessLevel: getProAccessLevel,
    getOnboardingComplete: getOnboardingComplete,
    setOnboardingComplete: setOnboardingComplete,
    // Workspace-shape array helpers (lazy-init on read)
    ensureGroupsArray: ensureGroupsArray,
    ensureWorkspaceOrderArray: ensureWorkspaceOrderArray,
    ensureRecurringTemplatesArray: ensureRecurringTemplatesArray,
    ensureGoalTemplatesArray: ensureGoalTemplatesArray,
    // [1.0.15] Goal templates
    createGoalTemplate: createGoalTemplate,
    renameGoalTemplate: renameGoalTemplate,
    updateGoalTemplateDescription: updateGoalTemplateDescription,
    updateGoalTemplateOffset: updateGoalTemplateOffset,
    updateGoalTemplateTaskList: updateGoalTemplateTaskList,
    duplicateGoalTemplate: duplicateGoalTemplate,
    deleteGoalTemplate: deleteGoalTemplate,
    getActiveGoalTemplates: getActiveGoalTemplates,
    getGoalTemplateById: getGoalTemplateById,
    saveGoalAsTemplate: saveGoalAsTemplate,
    instantiateGoalTemplate: instantiateGoalTemplate,
    // Item-level helper (bookmarks + groups, [1.0.9.2])
    ensureTagIdsArray: ensureTagIdsArray,
    // Goals (Pro tasks layer — see docs/SPECS/tasks-and-goals.md)
    createGoal: createGoal,
    renameGoal: renameGoal,
    updateGoalDescription: updateGoalDescription,
    updateGoalDeadline: updateGoalDeadline,
    updateGoalCollapsed: updateGoalCollapsed,
    reorderGoals: reorderGoals,
    completeGoal: completeGoal,
    reactivateGoal: reactivateGoal,
    deleteGoal: deleteGoal,
    restoreGoal: restoreGoal,
    deleteGoalPermanent: deleteGoalPermanent,
    getActiveGoals: getActiveGoals,
    getCompletedGoals: getCompletedGoals,
    getAllGoals: getAllGoals,
    getDeletedGoals: getDeletedGoals,
    getGoalById: getGoalById,
    getGoalAutoTagId: getGoalAutoTagId,
    // Tasks (Pro tasks layer — see docs/SPECS/tasks-and-goals.md)
    createTask: createTask,
    renameTask: renameTask,
    updateTaskDescription: updateTaskDescription,
    updateTaskDueAt: updateTaskDueAt,
    updateTaskPriority: updateTaskPriority,
    completeTask: completeTask,
    reactivateTask: reactivateTask,
    duplicateTask: duplicateTask,
    deleteTask: deleteTask,
    restoreTask: restoreTask,
    deleteTaskPermanent: deleteTaskPermanent,
    getDeletedTasks: getDeletedTasks,
    purgeExpiredTrash: purgeExpiredTrash,

    // [1.3.0 R2] Backup. One builder, shared by the manual export and the
    // weekly alarm.
    BACKUP_SCHEMA: BACKUP_SCHEMA,
    BACKUP_STORE_KEYS: BACKUP_STORE_KEYS,
    backupFilename: backupFilename,
    buildBackupEnvelope: buildBackupEnvelope,
    backupDataUrl: backupDataUrl,
    getAutoBackupEnabled: getAutoBackupEnabled,
    setAutoBackupEnabled: setAutoBackupEnabled,
    getLastBackupAt: getLastBackupAt,
    setLastBackupAt: setLastBackupAt,
    onTasksPurged: onTasksPurged,
    // [Tasks] Bottom-box bulk actions (batched, one saveAll each)
    emptyTrash: emptyTrash,
    restoreAllTrash: restoreAllTrash,
    clearCompletedItems: clearCompletedItems,
    moveTaskToGoal: moveTaskToGoal,
    reassignTaskToGoal: reassignTaskToGoal,
    hasTaskNameCollision: hasTaskNameCollision,
    generateUniqueTaskName: generateUniqueTaskName,
    getActiveTasks: getActiveTasks,
    getCompletedTasks: getCompletedTasks,
    getAllTasks: getAllTasks,
    getTaskById: getTaskById,
    // Active task ([1.0.16]) — data.activeTask is the OBJECT; a tracking
    // session's activeTaskId is the bare id. resolveActiveTask is pure.
    getActiveTask: getActiveTask,
    setActiveTask: setActiveTask,
    clearActiveTask: clearActiveTask,

    // [2.0] The per-task worked clock. activationWorkedMs is the one definition
    // of "worked span of an activation"; taskWorkedMs is the one definition of
    // the number the UI shows.
    activationWorkedMs: activationWorkedMs,
    bankWorkedTime: bankWorkedTime,
    taskWorkedMs: taskWorkedMs,
    resolveActiveTask: resolveActiveTask,
    isActiveTaskCardMinimized: isActiveTaskCardMinimized,
    setActiveTaskCardMinimized: setActiveTaskCardMinimized,
    // [1.0.18] Pomodoro phase state (rides data.activeTask.pomodoroState).
    emptyPomodoroState: emptyPomodoroState,
    hydratePomodoroState: hydratePomodoroState,
    startPomodoroPhase: startPomodoroPhase,
    stopPomodoro: stopPomodoro,
    // [1.0.18 A2] auto-advance / expiry / cycle reset + the pure phase-transition
    // helper (exported for the harness).
    reconcilePomodoro: reconcilePomodoro,
    resetPomodoroCycleCount: resetPomodoroCycleCount,
    nextPomodoroPhase: nextPomodoroPhase,
    POMODORO_GRACE_MS: POMODORO_GRACE_MS,
    // Due-date hierarchy checks ([1.0.13]) — pure reads, no mutation
    // [1.0.20] utcDay is exported so UI day-comparisons (the Dashboard's
    // due-today / overdue labels) use the SAME basis the due-date engine does,
    // rather than each caller re-deriving it and drifting. dueAt is UTC-midnight
    // epoch ms; comparing it against a local-midnight timestamp shifts the day
    // by one for users away from UTC (Bali is UTC+8, so it is visible here).
    utcDay: utcDay,
    checkTaskDueConflict: checkTaskDueConflict,
    checkGoalDeadlineConflict: checkGoalDeadlineConflict,
    // Tags (Pro tasks layer — see docs/SPECS/tasks-and-goals.md)
    TAG_PALETTE: TAG_PALETTE,
    createTag: createTag,
    renameTag: renameTag,
    updateTagColor: updateTagColor,
    deleteTag: deleteTag,
    // [Trash] The un-delete half. Blocks on an active same-name collision.
    restoreTag: restoreTag,
    getActiveTags: getActiveTags,
    getAllTags: getAllTags,
    getTagById: getTagById,
    getTagByName: getTagByName,
    nextAutoTagColor: nextAutoTagColor,
    // Notes ([1.1.0]) - pure mutations, caller pairs saveAll
    NOTE_COLORS: NOTE_COLORS,
    ensureNotesArray: ensureNotesArray,
    createNote: createNote,
    updateNote: updateNote,
    deleteNote: deleteNote,
    restoreNote: restoreNote,
    getAllNotes: getAllNotes,
    getDeletedNotes: getDeletedNotes,
    getNoteById: getNoteById,
    reorderNotes: reorderNotes,
    getDefaultNoteColor: getDefaultNoteColor,
    setDefaultNoteColor: setDefaultNoteColor,
    deleteNotePermanent: deleteNotePermanent,
    emptyNotesTrash: emptyNotesTrash,
    NOTE_TRASH_TTL_MS: TRASH_TTL_MS,
    // Named sessions ([1.4.0]) - pure mutations, caller pairs saveAll, except
    // reorderNamedSessions which saves itself per the notes/goals precedent.
    ensureNamedSessionsArray: ensureNamedSessionsArray,
    createNamedSession: createNamedSession,
    updateNamedSession: updateNamedSession,
    touchNamedSessionLaunched: touchNamedSessionLaunched,
    deleteNamedSession: deleteNamedSession,
    restoreNamedSession: restoreNamedSession,
    getAllNamedSessions: getAllNamedSessions,
    getDeletedNamedSessions: getDeletedNamedSessions,
    getNamedSessionById: getNamedSessionById,
    reorderNamedSessions: reorderNamedSessions,
    // [1.4.2] Attachment. Per-field updaters; both halves of the one-to-one
    // invariant are enforced in attachNamedSessionToTask, not in the UI.
    attachNamedSessionToTask: attachNamedSessionToTask,
    detachNamedSession: detachNamedSession,
    getNamedSessionForTask: getNamedSessionForTask,
    // Recurring task templates ([1.0.10] schema landing; [1.0.14] adds
    // alarm-driven instance materialization)
    createRecurringTemplate: createRecurringTemplate,
    updateRecurringTemplate: updateRecurringTemplate,
    deleteRecurringTemplate: deleteRecurringTemplate,
    getActiveRecurringTemplates: getActiveRecurringTemplates,
    getAllRecurringTemplates: getAllRecurringTemplates,
    getRecurringTemplateById: getRecurringTemplateById,
    // [1.0.14] Recurring instance generation
    runRecurringSweep: runRecurringSweep,
    nextRecurrenceUTC: nextRecurrenceUTC,
    // [1.2.0 R1] Focus blocking — storage foundations. The intercept (R2) reads
    // focusBlockingActive + getBlockList + matchesBlockedDomain +
    // getActiveFocusSnooze from a single `data` snapshot.
    isFocusManuallyArmed: isFocusManuallyArmed,
    setFocusArmed: setFocusArmed,
    getFocusSettings: getFocusSettings,
    setFocusAutoArm: setFocusAutoArm,
    focusBlockingActive: focusBlockingActive,
    focusArmState: focusArmState,
    normalizeBlockEntry: normalizeBlockEntry,
    matchesBlockedDomain: matchesBlockedDomain,
    getBlockList: getBlockList,
    addBlockedDomain: addBlockedDomain,
    removeBlockedDomain: removeBlockedDomain,
    setFocusSnooze: setFocusSnooze,
    getActiveFocusSnooze: getActiveFocusSnooze,
    pruneExpiredFocusSnoozes: pruneExpiredFocusSnoozes,
    ensureFocusStats: ensureFocusStats,
    incrementFocusStat: incrementFocusStat,
    FOCUS_SNOOZE_MS: FOCUS_SNOOZE_MS,
    FOCUS_STATS_MAX_DAYS: FOCUS_STATS_MAX_DAYS,
    // [2.0] Today cockpit readers — all pure, all over data an existing writer
    // already maintains. See the section above for why they live here.
    localDayKey: localDayKey,
    focusBlockedOnDay: focusBlockedOnDay,
    tasksCompletedOnDay: tasksCompletedOnDay,
    goalProgressList: goalProgressList,
    tasksDueByDay: tasksDueByDay,
    focusStreakFromRange: focusStreakFromRange
  };
})();
