/*
 * tracking-prototype.js — LaunchPad Pro v1 validation prototype
 *
 * NOT PRODUCTION CODE. This file exists to collect a few days of real-world
 * tab-focus / idle data to decide whether the full Pro tracking engine is
 * viable. It is loaded via importScripts() from background.js and runs
 * alongside the free-tier extension without touching any of its code paths.
 *
 * Architecture:
 *   Every tracked Chrome event (tabs.onActivated, tabs.onUpdated with
 *   changeInfo.url on the active tab, windows.onFocusChanged,
 *   idle.onStateChanged) writes a single event record directly to
 *   chrome.storage.local["tracking_prototype"] via a read-modify-write.
 *   There is NO in-memory buffer — the MV3 service worker can suspend after
 *   ~30 s of idle and anything held in module-level state would be lost.
 *   Writes are serialized through a module-level promise chain so concurrent
 *   events cannot race the read-modify-write.
 *
 * Before shipping any release build:
 *   - Remove the `importScripts('tracking-prototype.js')` line at the top of
 *     background.js.
 *   - The file is already excluded from launchpad.zip because build.sh uses
 *     an explicit file allowlist (not a glob) — tracking-prototype.js is not
 *     in that list.
 *
 * Storage:
 *   chrome.storage.local["tracking_prototype"] = { startedAt, events }
 *   accumulates events across all days (not pruned). The key is disposable —
 *   to wipe it during development:
 *     chrome.storage.local.remove("tracking_prototype")
 *
 * Debug helpers exposed on the service-worker global scope
 * (DevTools → chrome://extensions → "Inspect views: service worker"):
 *   trackingExport()    — print summary + raw events, return events.
 *   trackingAggregate() — walk today's events, return per-URL/per-domain
 *                         active-minute totals plus idle/focus minutes.
 */

/* global chrome */

(function () {
  "use strict";

  const STORAGE_KEY = "tracking_prototype";
  const IDLE_THRESHOLD_SEC = 60;

  // Serialized write chain. Each event handler appends its write onto this
  // promise so the read-modify-write cycle cannot race itself under bursts.
  // The .catch after each enqueue swallows failures so one bad write does
  // not poison the chain for all subsequent events.
  let writeChain = Promise.resolve();

  async function doWrite(evt) {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const store = result[STORAGE_KEY] || { startedAt: null, events: [] };
    if (!store.startedAt) store.startedAt = evt.ts;
    store.events = (store.events || []).concat(evt);
    await chrome.storage.local.set({ [STORAGE_KEY]: store });
  }

  function enqueueWrite(evt) {
    writeChain = writeChain
      .then(function () { return doWrite(evt); })
      .catch(function (err) {
        console.error("[tracking-prototype] write failed:", err);
      });
  }

  // Idle detection threshold. Safe to call on every SW wake (idempotent).
  try {
    chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SEC);
  } catch (e) {
    console.error("[tracking-prototype] setDetectionInterval failed:", e);
  }

  chrome.tabs.onActivated.addListener(function (info) {
    try {
      enqueueWrite({
        ts: Date.now(),
        type: "tab_activated",
        tabId: info.tabId,
        url: null,
        windowId: info.windowId,
        idleState: null
      });
    } catch (err) {
      console.error("[tracking-prototype] onActivated handler failed:", err);
    }
  });

  chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    try {
      if (!changeInfo.url) return;
      if (!tab || tab.active !== true) return;
      enqueueWrite({
        ts: Date.now(),
        type: "tab_updated",
        tabId: tabId,
        url: changeInfo.url,
        windowId: tab.windowId != null ? tab.windowId : null,
        idleState: null
      });
    } catch (err) {
      console.error("[tracking-prototype] onUpdated handler failed:", err);
    }
  });

  chrome.windows.onFocusChanged.addListener(function (windowId) {
    try {
      enqueueWrite({
        ts: Date.now(),
        type: "window_focus",
        tabId: null,
        url: null,
        windowId: windowId,
        idleState: null
      });
    } catch (err) {
      console.error("[tracking-prototype] onFocusChanged handler failed:", err);
    }
  });

  chrome.idle.onStateChanged.addListener(function (newState) {
    try {
      enqueueWrite({
        ts: Date.now(),
        type: "idle_state",
        tabId: null,
        url: null,
        windowId: null,
        idleState: newState
      });
    } catch (err) {
      console.error("[tracking-prototype] onStateChanged handler failed:", err);
    }
  });

  function msToMinutes(ms) {
    return Math.round((ms / 60000) * 100) / 100;
  }

  function safeDomain(url) {
    try { return new URL(url).hostname; } catch (e) { return null; }
  }

  async function trackingExport() {
    // Wait for any in-flight writes to land before reading.
    await writeChain;
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const store = result[STORAGE_KEY] || { startedAt: null, events: [] };
    const events = store.events || [];

    const first = events.length ? events[0].ts : null;
    const last = events.length ? events[events.length - 1].ts : null;
    const urls = new Set();
    const perHour = {};
    events.forEach(function (e) {
      if (e.url) urls.add(e.url);
      const d = new Date(e.ts);
      const hourKey = d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0") + " " +
        String(d.getHours()).padStart(2, "0");
      perHour[hourKey] = (perHour[hourKey] || 0) + 1;
    });

    const summary = {
      totalEvents: events.length,
      startedAt: store.startedAt ? new Date(store.startedAt).toISOString() : null,
      firstEvent: first ? new Date(first).toISOString() : null,
      lastEvent: last ? new Date(last).toISOString() : null,
      uniqueURLs: urls.size,
      eventsPerHour: perHour
    };

    console.log("[tracking-prototype] summary:", summary);
    console.log("[tracking-prototype] events:", events);
    return events;
  }

  async function trackingAggregate() {
    await writeChain;
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const store = result[STORAGE_KEY] || { events: [] };
    const allEvents = store.events || [];

    const now = Date.now();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayStartMs = dayStart.getTime();
    const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;
    const dateStr = dayStart.getFullYear() + "-" +
      String(dayStart.getMonth() + 1).padStart(2, "0") + "-" +
      String(dayStart.getDate()).padStart(2, "0");

    const today = allEvents
      .filter(function (e) { return e.ts >= dayStartMs && e.ts < dayEndMs; })
      .sort(function (a, b) { return a.ts - b.ts; });

    const perURL = {};
    const perDomain = {};
    let idleMs = 0;
    let focusMs = 0;

    let activeURL = null;
    let isFocused = true;
    let isActive = true;
    let segmentStart = today.length ? today[0].ts : null;

    function closeSegment(endTs) {
      if (segmentStart == null || endTs <= segmentStart) return;
      const delta = endTs - segmentStart;
      if (isFocused) focusMs += delta;
      if (!isActive) idleMs += delta;
      if (isFocused && isActive && activeURL) {
        perURL[activeURL] = (perURL[activeURL] || 0) + delta;
        const d = safeDomain(activeURL);
        if (d) perDomain[d] = (perDomain[d] || 0) + delta;
      }
    }

    for (const e of today) {
      closeSegment(e.ts);
      segmentStart = e.ts;
      switch (e.type) {
        case "tab_updated":
          if (e.url) activeURL = e.url;
          break;
        case "window_focus":
          isFocused = e.windowId !== -1 && e.windowId != null;
          break;
        case "idle_state":
          isActive = e.idleState === "active";
          break;
        case "tab_activated":
          // tabId captured but URL is not — leave activeURL as-is until the
          // next tab_updated event pins a URL.
          break;
      }
    }
    closeSegment(Math.min(now, dayEndMs));

    const perURLMin = {};
    const perDomainMin = {};
    Object.keys(perURL).forEach(function (k) { perURLMin[k] = msToMinutes(perURL[k]); });
    Object.keys(perDomain).forEach(function (k) { perDomainMin[k] = msToMinutes(perDomain[k]); });

    const out = {
      date: dateStr,
      perURL: perURLMin,
      perDomain: perDomainMin,
      idleMinutes: msToMinutes(idleMs),
      focusMinutes: msToMinutes(focusMs)
    };

    console.log("[tracking-prototype] aggregate:", out);
    return out;
  }

  globalThis.trackingExport = trackingExport;
  globalThis.trackingAggregate = trackingAggregate;
})();
