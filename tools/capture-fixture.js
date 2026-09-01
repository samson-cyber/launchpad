// Fixture for tools/capture-screenshots.mjs. Evaluated INSIDE the extension
// page, so it can call the product's own creation APIs.
//
// EVERYTHING HERE IS INVENTED. No real personal data of any kind: the previous
// store set showed genuine browsing history including Seller Central and a
// Shopify admin, which is both a privacy leak and a thing a stranger should
// never see. Equally, no placeholder junk - no "test", no "asdf", no
// "Untitled", no lorem ipsum. Either extreme reads as an unfinished product;
// what a listing needs is a plausible working day.
//
// Seeded through Storage.createTask / createGoal / createTag / createNote /
// createNamedSession and addShortcut rather than by writing records by hand
// (I12, Q13): a hand-built record can encode the same wrong assumption as the
// reader, and then the fixture agrees with the bug instead of exposing it.
//
// Tracking data is written in tracking.js's OWN shape, read from that file
// rather than invented: `tracking_days` keyed `<workspaceId>:<dayKey>`, each
// value { day, workspaceId, totalFocusedMs, byDomain, byTag, byTask,
// longestSessionMs }.

async function __seedCaptureFixture() {
  try {
    const S = window.Storage;
    if (!S) return { ok: false, error: "Storage is not on the page" };

    // ---------------------------------------------------------- wallpaper
    // Painted here rather than fetched. All twelve gallery images in this build
    // are runtime Unsplash URLs and nothing is bundled, so a fetched wallpaper
    // would make the set non-reproducible and raise a licensing question on a
    // public listing. This is ours, deterministic, dark and low-detail: a busy
    // photo fights the frosted panels, and dark is the default surface and the
    // best-tested ink branch.
    const cv = document.createElement("canvas");
    cv.width = 1600; cv.height = 1000;
    const g = cv.getContext("2d");
    const grad = g.createLinearGradient(0, 0, 1600, 1000);
    grad.addColorStop(0, "#101a2b");
    grad.addColorStop(0.55, "#0d1420");
    grad.addColorStop(1, "#080b12");
    g.fillStyle = grad; g.fillRect(0, 0, 1600, 1000);
    const glow = g.createRadialGradient(1180, 200, 40, 1180, 200, 900);
    glow.addColorStop(0, "rgba(80,120,190,0.20)");
    glow.addColorStop(1, "rgba(80,120,190,0)");
    g.fillStyle = glow; g.fillRect(0, 0, 1600, 1000);
    const vign = g.createRadialGradient(800, 500, 200, 800, 500, 1100);
    vign.addColorStop(0, "rgba(0,0,0,0)");
    vign.addColorStop(1, "rgba(0,0,0,0.45)");
    g.fillStyle = vign; g.fillRect(0, 0, 1600, 1000);
    await S.saveBackground(cv.toDataURL("image/jpeg", 0.86));

    // ------------------------------------------------------------ shortcuts
    let data = await S.getAll();
    const ws = S.getActiveWorkspace(data);
    ws.name = "Main";

    const GROUPS = [
      ["Daily", [
        ["Gmail", "https://mail.google.com"],
        ["Calendar", "https://calendar.google.com"],
        ["Drive", "https://drive.google.com"],
        ["Notion", "https://www.notion.so"],
        ["Slack", "https://slack.com"],
      ]],
      ["Build", [
        ["GitHub", "https://github.com"],
        ["Figma", "https://www.figma.com"],
        ["Linear", "https://linear.app"],
        ["Vercel", "https://vercel.com"],
        ["MDN", "https://developer.mozilla.org"],
      ]],
      ["Read", [
        ["Hacker News", "https://news.ycombinator.com"],
        ["The Verge", "https://www.theverge.com"],
        ["Ars Technica", "https://arstechnica.com"],
        ["YouTube", "https://www.youtube.com"],
      ]],
      ["Admin", [
        ["Stripe", "https://dashboard.stripe.com"],
        ["Google Analytics", "https://analytics.google.com"],
        ["Docs", "https://docs.google.com"],
      ]],
    ];

    // Clear the seeded example groups so the grid is the fixture's, not the
    // first-run demo's.
    ws.groups = [{ id: "ungrouped", name: "Ungrouped", shortcuts: [], deletedAt: null }];
    ws.groupOrder = ["ungrouped"];
    let gi = 0;
    for (const [name, items] of GROUPS) {
      const id = "grp_cap_" + (gi++);
      ws.groups.push({ id: id, name: name, shortcuts: [], deletedAt: null, collapsed: false });
      ws.groupOrder.splice(ws.groupOrder.length - 1, 0, id);
      for (const [title, url] of items) {
        ws.groups[ws.groups.length - 1].shortcuts.push({
          id: "sc_cap_" + Math.random().toString(36).slice(2, 9),
          title: title, url: url, variants: [], createdAt: Date.now(),
        });
      }
    }
    await S.saveAll(data);

    // ------------------------------------------------------------ tags
    data = await S.getAll();
    const TAGS = ["deep work", "admin", "writing", "review"];
    for (const t of TAGS) { await S.createTag(data, { name: t }); data = await S.getAll(); }
    const tagByName = {};
    for (const t of S.getAllTags(S.getActiveWorkspace(data))) tagByName[t.name] = t.id;

    // ------------------------------------------------------------ goals
    const GOALS = [
      { name: "Ship the Q3 report", tag: "writing" },
      { name: "Rebuild onboarding flow", tag: "deep work" },
    ];
    const goalIds = {};
    for (const g2 of GOALS) {
      const made = await S.createGoal(data, { name: g2.name, tagId: tagByName[g2.tag] || null });
      data = await S.getAll();
      if (made && made.id) goalIds[g2.name] = made.id;
    }

    // ------------------------------------------------------------ tasks
    // A mix of priorities, some complete and some not, and one goal LEFT PART
    // DONE so the progress bar is neither empty nor full.
    const TASKS = [
      { n: "Pull the regional revenue numbers", g: "Ship the Q3 report", p: "high", done: true },
      { n: "Draft the executive summary", g: "Ship the Q3 report", p: "urgent", done: true },
      { n: "Chart the quarter-over-quarter split", g: "Ship the Q3 report", p: "medium", done: false },
      { n: "Circulate for comment", g: "Ship the Q3 report", p: "low", done: false },
      { n: "Audit the current sign-up steps", g: "Rebuild onboarding flow", p: "high", done: true },
      { n: "Wireframe the shortened flow", g: "Rebuild onboarding flow", p: "high", done: false },
      { n: "Write the empty-state copy", g: "Rebuild onboarding flow", p: "medium", done: false },
      { n: "Reply to the design review thread", g: null, p: "urgent", done: false },
      { n: "Book the studio for Thursday", g: null, p: "medium", done: false },
      { n: "Renew the domain", g: null, p: "low", done: false },
    ];
    const taskIds = {};
    for (const t of TASKS) {
      const made = await S.createTask(data, {
        name: t.n,
        goalId: t.g ? (goalIds[t.g] || null) : null,
        priority: t.p,
        tagIds: t.g === "Ship the Q3 report" ? [tagByName["writing"]].filter(Boolean)
              : t.g ? [tagByName["deep work"]].filter(Boolean) : [tagByName["admin"]].filter(Boolean),
      });
      data = await S.getAll();
      if (made && made.id) taskIds[t.n] = made.id;
    }
    // COMPLETIONS COME AFTER EVERY TASK EXISTS. Completing a task while it is
    // its goal's only live child trips the [1.4.7] auto-complete branch and
    // completes the GOAL, which emptied Active Goals on the first run.
    for (const t of TASKS) {
      if (!t.done || !taskIds[t.n]) continue;
      await S.completeTask(data, taskIds[t.n]);
      data = await S.getAll();
    }

    // ------------------------------------------------------------ notes
    const NOTES = [
      ["Ask finance whether the Q3 cut-off moved. If it did, the summary needs a new date range.", "butter-yellow"],
      ["Onboarding: three steps is the target. Anything that cannot justify itself gets cut.", "mint"],
      ["Studio said Thursday works if we confirm by Tuesday.", "soft-pink"],
      ["Reading list: the piece on attention residue, and the follow-up on context switching.", "sky-blue"],
      ["Renewal is annual, not monthly. Do not let it lapse again.", "peach"],
      ["Draft opening line: the quarter was steadier than it looked from inside it.", "lavender"],
    ];
    // createNote MUTATES `data` and does NOT save. Re-reading storage between
    // calls discarded every note on the first run; build them all, save once.
    for (const [content, color] of NOTES) S.createNote(data, { content: content, color: color });
    await S.saveAll(data);
    data = await S.getAll();

    // ------------------------------------------------------- named sessions
    // Favicons captured at save time, per the never-derived rule: the fixture
    // supplies each tab's own favIconUrl rather than deriving one from the host
    // or reaching for an icon service.
    const SESSIONS = [
      ["Q3 report writing", [
        ["Google Docs", "https://docs.google.com", "https://www.google.com/favicon.ico"],
        ["Analytics", "https://analytics.google.com", "https://www.google.com/favicon.ico"],
        ["Notion", "https://www.notion.so", "https://www.notion.so/favicon.ico"],
      ]],
      ["Onboarding rebuild", [
        ["Figma", "https://www.figma.com", "https://www.figma.com/favicon.ico"],
        ["Linear", "https://linear.app", "https://linear.app/favicon.ico"],
        ["GitHub", "https://github.com", "https://github.com/favicon.ico"],
        ["MDN", "https://developer.mozilla.org", "https://developer.mozilla.org/favicon.ico"],
      ]],
      ["Monday review", [
        ["Stripe", "https://dashboard.stripe.com", "https://stripe.com/favicon.ico"],
        ["Calendar", "https://calendar.google.com", "https://www.google.com/favicon.ico"],
      ]],
    ];
    for (const [name, tabs] of SESSIONS) {
      S.createNamedSession(data, {
        name: name,
        // The normaliser reads `favicon`; `favIconUrl` was silently dropped to null
        // and every row rendered the generic globe. Read the producer, do not guess
        // the field (I12/Q13).
        tabs: tabs.map(([title, url, fav]) => ({ title: title, url: url, favicon: fav })),
      });
    }
    await S.saveAll(data);
    data = await S.getAll();

    // ------------------------------------------------------------ tracking
    // tracking.js's own shape, keyed <workspaceId>:<dayKey>. Thirty days of
    // varied history so the Insights bars have a silhouette rather than a flat
    // wall, and today in the one-to-three-hour band.
    const wsId = S.getActiveWorkspace(data).id;
    const dayKey = (back) => {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - back);
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    };
    const MIN = 60000;
    const DOMAINS = ["docs.google.com", "github.com", "figma.com", "linear.app",
                     "developer.mozilla.org", "notion.so", "analytics.google.com"];
    // A fixed, hand-shaped 30-day curve: weekends low, a couple of strong days,
    // one near-zero. Deterministic, so every re-run produces the same chart.
    const CURVE = [96, 142, 168, 74, 31, 12, 8, 121, 155, 187, 133, 92, 24, 15,
                   148, 176, 205, 118, 87, 19, 11, 134, 162, 149, 171, 103, 28, 17, 128, 158];
    const days = {};
    for (let back = 29; back >= 0; back--) {
      const mins = back === 0 ? 104 : CURVE[29 - back];
      const total = mins * MIN;
      const byDomain = {}, byTag = {}, byTask = {};
      let left = total;
      DOMAINS.forEach((d, i) => {
        const share = i === 0 ? 0.34 : i === 1 ? 0.24 : i === 2 ? 0.16 : 0.065;
        const v = Math.round(total * share);
        byDomain[d] = v; left -= v;
      });
      if (left > 0) byDomain["docs.google.com"] += left;
      const tw = tagByName["deep work"], ta = tagByName["writing"], tb = tagByName["admin"];
      if (tw) byTag[tw] = Math.round(total * 0.52);
      if (ta) byTag[ta] = Math.round(total * 0.31);
      if (tb) byTag[tb] = total - (byTag[tw] || 0) - (byTag[ta] || 0);
      const t1 = taskIds["Wireframe the shortened flow"], t2 = taskIds["Chart the quarter-over-quarter split"],
            t3 = taskIds["Draft the executive summary"];
      if (t1) byTask[t1] = Math.round(total * 0.45);
      if (t2) byTask[t2] = Math.round(total * 0.33);
      if (t3) byTask[t3] = total - (byTask[t1] || 0) - (byTask[t2] || 0);
      days[wsId + ":" + dayKey(back)] = {
        day: dayKey(back), workspaceId: wsId, totalFocusedMs: total,
        byDomain: byDomain, byTag: byTag, byTask: byTask,
        longestSessionMs: Math.round(total * 0.42),
      };
    }
    await chrome.storage.local.set({ tracking_days: days });

    // Blocking armed with a believable list, so frame 4's gate is a real state
    // rather than a page opened out of context.
    // Blocking is TOP-LEVEL state: `focusArmed` is the manual arm and
    // `blockList` the entries. The first run invented ws.focusBlocking and the
    // pill correctly read "off, no sites listed".
    // Two tasks due today and one overdue, so the Dashboard's DUE TODAY module
    // shows the list it exists for rather than "Nothing due today".
    data = await S.getAll();
    {
      const w3 = S.getActiveWorkspace(data);
      const midnightUtc = (offsetDays) => {
        const dt = new Date(); dt.setHours(0, 0, 0, 0); dt.setDate(dt.getDate() + offsetDays);
        return Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate());
      };
      const due = {
        "Chart the quarter-over-quarter split": midnightUtc(0),
        "Reply to the design review thread": midnightUtc(0),
        "Book the studio for Thursday": midnightUtc(-1),
      };
      for (const t of S.getAllTasks(w3)) {
        if (due[t.name] !== undefined) t.dueAt = due[t.name];
      }
      await S.saveAll(data);
    }

    data = await S.getAll();
    data.focusArmed = true;
    data.blockList = ["news.ycombinator.com", "youtube.com", "reddit.com", "x.com"];
    // A believable blocked count, so the strip is not a row of zeroes.
    data.focusStats = Object.assign({}, data.focusStats || {}, { blockedTotal: 34 });
    await S.saveAll(data);

    return {
      ok: true, groups: GROUPS.length, shortcuts: GROUPS.reduce((n, g3) => n + g3[1].length, 0),
      goals: GOALS.length, tasks: TASKS.length, notes: NOTES.length,
      sessions: SESSIONS.length, trackingDays: Object.keys(days).length,
    };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

// Starts a real focus session so frame 3 shows time on the clock rather than a
// zero state. Driven through the product's own activation path.
async function __captureStartFocus() {
  try {
    const S = window.Storage;
    let data = await S.getAll();
    const ws = S.getActiveWorkspace(data);
    const open = S.getAllTasks(ws).filter((t) => !t.completed && !t.deletedAt);
    const target = open.find((t) => t.name === "Wireframe the shortened flow") || open[0];
    if (!target) return { ok: false, why: "no open task to activate" };

    // Activate through the product's own funnel, then write the phase into the
    // shape the readers actually hydrate. The first run invented
    // `data.pomodoro = {phase, startedAt, durationMs}` and the card correctly
    // read 0:00: the state lives on the ACTIVE TASK as `pomodoroState`, and
    // hydratePomodoroState forces phaseEndsAt/phaseDurationMs null unless phase
    // is one of work / shortBreak / longBreak.
    await S.setActiveTask(data, target.id);
    data = await S.getAll();
    const active = S.getActiveTask(data);
    if (!active) return { ok: false, why: "setActiveTask did not take" };

    const WORK_MS = 45 * 60000;
    const ELAPSED = 22 * 60000;                     // time on the clock, not a zero state
    active.pomodoroState = {
      cycleCount: 2,
      phase: "work",
      phaseEndsAt: Date.now() + (WORK_MS - ELAPSED),
      phaseDurationMs: WORK_MS,
      sessionComplete: false
    };
    // Backdate the activation so the worked clock reads a real elapsed figure
    // rather than a few seconds.
    if (typeof active.startedAt === "number") active.startedAt = Date.now() - ELAPSED;
    if (typeof active.activatedAt === "number") active.activatedAt = Date.now() - ELAPSED;
    await S.saveAll(data);

    return {
      ok: true, task: target.name,
      phase: active.pomodoroState.phase,
      remainingMin: Math.round((active.pomodoroState.phaseEndsAt - Date.now()) / 60000),
      focusArmed: !!data.focusArmed, blockList: (data.blockList || []).length
    };
  } catch (e) {
    return { ok: false, why: String((e && e.message) || e) };
  }
}

// Promo toasts are transient and must never appear in a listing frame: the
// first run caught the Rate ask and the right-click tip mid-grid. Consumed
// through their own storage rather than by hiding nodes, so they do not
// reappear on the next render.
async function __captureSilenceToasts() {
  try {
    const now = Date.now();
    await chrome.storage.local.set({
      promoState: { lastPromoOpen: now, openCount: 1, rateDismissed: true, coffeeDismissed: true },
      launchpad_onboarding: { complete: true, dismissed: true, tipsSeen: true }
    });
    let data = await window.Storage.getAll();
    const gs = (data.gettingStarted = data.gettingStarted || {});
    gs.dismissed = true;
    await window.Storage.saveAll(data);
    for (const el of document.querySelectorAll(".toast, .promo-toast, #promo-toast, .tip-toast, .undo-toast")) {
      el.classList.remove("visible");
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, why: String((e && e.message) || e) };
  }
}
