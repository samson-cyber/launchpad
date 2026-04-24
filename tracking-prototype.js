/*
 * tracking-prototype.js — LaunchPad Pro v1 validation prototype
 *
 * NOT PRODUCTION CODE. This file exists to collect a few days of real-world
 * tab-focus / idle data to decide whether the full Pro tracking engine is
 * viable. It is loaded via importScripts() from background.js and runs
 * alongside the free-tier extension without touching any of its code paths.
 *
 * Before shipping any release build:
 *   - Remove the `importScripts('tracking-prototype.js')` line at the top of
 *     background.js.
 *   - The file is already excluded from launchpad.zip because build.sh uses
 *     an explicit file allowlist (not a glob) — tracking-prototype.js is not
 *     in that list.
 *
 * Storage:
 *   chrome.storage.local["tracking_prototype"] accumulates events across all
 *   days (not pruned). The key is disposable — to wipe it during development:
 *     chrome.storage.local.remove("tracking_prototype")
 *
 * Debug helpers exposed on the service-worker global scope
 * (DevTools → chrome://extensions → "Inspect views: service worker"):
 *   trackingExport()    — flush + print summary + raw events, return events.
 *   trackingAggregate() — walk today's events, return per-URL/per-domain
 *                         active-minute totals plus idle/focus minutes.
 */

/* global chrome */

(function () {
  "use strict";

  const STORAGE_KEY = "tracking_prototype";
  const ALARM_NAME = "tracking-prototype-flush";
  const IDLE_THRESHOLD_SEC = 60;

  // In-memory event buffer. Note: MV3 service workers reset global scope
  // between wakes, so this buffer only coalesces events within a single wake.
  let pendingEvents = [];
  let flushing = false;

  function record(evt) {
    pendingEvents.push(evt);
  }

  async function flush() {
    if (flushing) return;
    if (!pendingEvents.length) return;
    flushing = true;
    const batch = pendingEvents;
    pendingEvents = [];
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const store = result[STORAGE_KEY] || { startedAt: null, events: [] };
      if (!store.startedAt) store.startedAt = batch[0].ts;
      store.events = (store.events || []).concat(batch);
      await chrome.storage.local.set({ [STORAGE_KEY]: store });
    } catch (err) {
      // Requeue the batch so we try again next flush.
      pendingEvents = batch.concat(pendingEvents);
      console.error("[tracking-prototype] flush failed:", err);
    } finally {
      flushing = false;
    }
  }

  // Idle detection threshold. Safe to call on every SW wake (idempotent).
  try {
    chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SEC);
  } catch (e) {
    console.error("[tracking-prototype] setDetectionInterval failed:", e);
  }

  // Periodic flush. Chrome's minimum alarm periodInMinutes is 0.5 (30 s), so
  // "every 10 seconds" is not achievable via chrome.alarms; 30 s is the
  // closest. Called out in the Asana review notes.
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 0.5, delayInMinutes: 0.5 });

  chrome.alarms.onAlarm.addListener(function (alarm) {
    if (alarm.name === ALARM_NAME) flush();
  });

  chrome.tabs.onActivated.addListener(function (info) {
    record({
      ts: Date.now(),
      type: "tab_activated",
      tabId: info.tabId,
      url: null,
      windowId: info.windowId,
      idleState: null
    });
  });

  chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (!changeInfo.url) return;
    if (!tab || tab.active !== true) return;
    record({
      ts: Date.now(),
      type: "tab_updated",
      tabId: tabId,
      url: changeInfo.url,
      windowId: tab.windowId != null ? tab.windowId : null,
      idleState: null
    });
  });

  chrome.windows.onFocusChanged.addListener(function (windowId) {
    record({
      ts: Date.now(),
      type: "window_focus",
      tabId: null,
      url: null,
      windowId: windowId,
      idleState: null
    });
  });

  chrome.idle.onStateChanged.addListener(function (newState) {
    record({
      ts: Date.now(),
      type: "idle_state",
      tabId: null,
      url: null,
      windowId: null,
      idleState: newState
    });
    // Flush on every idle transition per spec.
    flush();
  });

  function msToMinutes(ms) {
    return Math.round((ms / 60000) * 100) / 100;
  }

  function safeDomain(url) {
    try { return new URL(url).hostname; } catch (e) { return null; }
  }

  async function trackingExport() {
    await flush();
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
    await flush();
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
