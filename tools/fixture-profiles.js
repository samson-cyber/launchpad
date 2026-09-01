/* eslint-disable */
// ===========================================================================
// FIXTURE PROFILES — the page-side half of tools/seed-fixture.mjs.
//
// Injected into a scratch newtab page and run there, because that is where
// window.Storage and window.Tracking are. The node driver holds the guard and
// the browser; this file holds the data.
//
// THREE PROFILES
//   calm   not here. It IS tools/capture-fixture.js, which the driver injects
//          and calls directly. Store frames must not drift because this file
//          changed, so calm is absorbed by reference rather than copied.
//   busy   the coverage list on Asana 1218051227216172.
//   empty  a fresh Pro profile with nothing in it.
//
// EVERYTHING GOES THROUGH THE PRODUCT'S OWN FACTORIES (BUGS.md Q13). Where no
// factory exists the assumed shape is declared at the call site, in caps, so a
// later reader can tell measurement from assumption. Three such places:
// workspaces, shortcuts, and the age of a trashed item.
//
// NO REAL PERSONAL DATA and no placeholder junk. Names are plausible studio
// work, invented for this file.
// ===========================================================================

var __FIXTURE_PROFILES = (function () {
  var DAY = 24 * 60 * 60 * 1000;
  var now = function () { return Date.now(); };
  var ago = function (days) { return Date.now() - days * DAY; };

  // ---------------------------------------------------------------- helpers

  // NO WORKSPACE FACTORY EXISTS. createWorkspace lives in newtab.js inside the
  // page IIFE and is not exported, so storage.js offers only getters. The shape
  // below is copied VERBATIM from newtab.js createWorkspace (the groupOrder /
  // "ungrouped" group pair especially, which several readers assume). If that
  // function grows a field, this goes stale silently — the Q13 exposure.
  function pushWorkspace(data, name, trackingEnabled) {
    var id = "ws_" + Math.random().toString(36).slice(2, 11);
    if (!Array.isArray(data.workspaces)) data.workspaces = [];
    if (!Array.isArray(data.workspaceOrder)) data.workspaceOrder = [];
    data.workspaces.push({
      id: id,
      name: name,
      createdAt: Date.now(),
      isReadOnly: false,
      groupOrder: ["ungrouped"],
      groups: [{ id: "ungrouped", name: "Ungrouped", shortcuts: [], deletedAt: null }],
      goals: [], tasks: [], tags: [],
      tracking: { enabled: trackingEnabled !== false }
    });
    data.workspaceOrder.push(id);
    return id;
  }

  // addGroup()/addShortcut() are workspace-implicit: they act on the ACTIVE
  // workspace and save internally. So seeding a non-active workspace means
  // switching to it first. Done explicitly rather than by reaching past them.
  async function withActiveWorkspace(S, wsId, fn) {
    var data = await S.getAll();
    var prev = data.activeWorkspaceId;
    data.activeWorkspaceId = wsId;
    await S.saveAll(data);
    try { await fn(); } finally {
      var d2 = await S.getAll();
      d2.activeWorkspaceId = prev;
      await S.saveAll(d2);
    }
  }

  // NO SHORTCUT OBJECT FACTORY EXISTS. addShortcut(groupId, shortcut) stamps
  // id/addedAt/deletedAt and applies group tag inheritance, but the caller
  // assembles the record.
  //
  // THE FIELD IS `title`, NOT `name`, AND THIS IS THE Q13 TRAP ARRIVING EXACTLY
  // WHERE IT WAS PREDICTED. Seeded as { name, url } every shortcut stored fine,
  // every count was right, and the grid rendered HOSTNAMES for all 48 of them,
  // because the renderer reads `s.title || getDomain(s.url)` and silently fell
  // back. Nothing failed; the long-name and same-name coverage simply was not
  // being exercised. Shape taken from newtab.js's own add-shortcut modal:
  // { url, title, favicon }, with `variants` added for the auto-nest case.
  function sc(title, url) {
    return { url: url, title: title, favicon: "https://" + hostOf(url) + "/favicon.ico" };
  }
  function hostOf(u) { try { return new URL(u).hostname; } catch (e) { return "example.com"; } }

  // ------------------------------------------------------------------ busy

  var STUDIO_GROUPS = [
    ["Daily", [
      ["Mail", "https://mail.proton.me"],
      ["Calendar", "https://calendar.google.com"],
      ["Drive", "https://drive.google.com"],
      ["Notion", "https://www.notion.so"],
      ["Slack", "https://app.slack.com"],
      ["Linear", "https://linear.app"],
      ["Figma", "https://www.figma.com"],
      ["Height", "https://height.app"]
    ]],
    // 24 entries: this is the group that must scroll.
    ["Build", [
      ["GitHub", "https://github.com"], ["GitLab", "https://gitlab.com"],
      ["Vercel", "https://vercel.com"], ["Netlify", "https://app.netlify.com"],
      ["Cloudflare", "https://dash.cloudflare.com"], ["Fly.io", "https://fly.io/dashboard"],
      ["Railway", "https://railway.app"], ["Render", "https://dashboard.render.com"],
      ["Supabase", "https://supabase.com/dashboard"], ["PlanetScale", "https://app.planetscale.com"],
      ["Neon", "https://console.neon.tech"], ["Upstash", "https://console.upstash.com"],
      ["Sentry", "https://sentry.io"], ["Datadog", "https://app.datadoghq.com"],
      ["Grafana", "https://grafana.com"], ["Posthog", "https://app.posthog.com"],
      ["MDN", "https://developer.mozilla.org"], ["Can I Use", "https://caniuse.com"],
      ["Regex101", "https://regex101.com"], ["Excalidraw", "https://excalidraw.com"],
      ["Bundlephobia", "https://bundlephobia.com"], ["npm", "https://www.npmjs.com"],
      ["Chrome status", "https://chromestatus.com"], ["Web.dev", "https://web.dev"]
    ]],
    ["Reading", [
      ["Ink and Switch", "https://www.inkandswitch.com"],
      ["Nielsen Norman Group on progressive disclosure in dense interfaces", "https://www.nngroup.com"],
      ["Julia Evans", "https://jvns.ca"],
      ["Increment", "https://increment.com"],
      ["Overreacted", "https://overreacted.io"],
      ["Rachel by the bay", "https://rachelbythebay.com"],
      ["Dan Luu", "https://danluu.com"],
      ["Signal v Noise", "https://signalvnoise.com"],
      ["Stratechery", "https://stratechery.com"],
      ["The Morning Paper", "https://blog.acolyer.org"]
    ]],
    ["Clients", [
      ["Northwind brief", "https://www.notion.so/northwind-brief"],
      ["Northwind assets", "https://www.notion.so/northwind-assets"],
      ["Harbour invoice", "https://app.harvestapp.com"],
      ["Harbour contract", "https://app.harvestapp.com"],
      ["Meridian roadmap", "https://linear.app/meridian"],
      ["Meridian retro", "https://linear.app/meridian"]
    ]],
    ["Someday", []]                                   // the zero-shortcut group
  ];

  var STUDIO_TAGS = [
    "deep work", "admin", "writing", "review", "client",
    "research", "infrastructure and platform work"      // long: truncates the pill
  ];

  async function seedBusy(S, T) {
    var log = [];
    var data = await S.getAll();

    // ---- workspaces. Populated DIFFERENTLY on purpose: switching workspace is
    // the route to a sparse or zero state, so a zero state never needs a rebuild.
    data.workspaces = [];
    data.workspaceOrder = [];
    var studio = pushWorkspace(data, "Studio", true);
    var side   = pushWorkspace(data, "Side projects", true);
    var archive= pushWorkspace(data, "Archive", false);
    data.activeWorkspaceId = studio;
    await S.saveAll(data);
    log.push("workspaces: Studio (busy), Side projects (sparse), Archive (empty)");

    // ---- Home: groups and shortcuts, through addGroup/addShortcut
    await withActiveWorkspace(S, studio, async function () {
      for (var gi = 0; gi < STUDIO_GROUPS.length; gi++) {
        var g = await S.addGroup(STUDIO_GROUPS[gi][0]);
        var rows = STUDIO_GROUPS[gi][1];
        for (var si = 0; si < rows.length; si++) {
          await S.addShortcut(g.id, sc(rows[si][0], rows[si][1]));
        }
      }
    });

    // The auto-nest case, written the way background.js's nesting leaves it: a
    // parent carrying variants. ASSUMED SHAPE (no factory): variants are plain
    // {id,name,url,addedAt,deletedAt} siblings under the parent's `variants`.
    data = await S.getAll();
    var sws = data.workspaces.find(function (w) { return w.id === studio; });
    var daily = sws.groups.find(function (g) { return g.name === "Daily"; });
    var drive = daily.shortcuts.find(function (s) { return s.title === "Drive"; });
    drive.variants = [
      { id: "var_sheets", title: "Sheets", url: "https://sheets.google.com", favicon: "https://sheets.google.com/favicon.ico", addedAt: ago(40), deletedAt: null },
      { id: "var_docs",   title: "Docs",   url: "https://docs.google.com",   favicon: "https://docs.google.com/favicon.ico", addedAt: ago(40), deletedAt: null }
    ];
    await S.saveAll(data);
    log.push("home: 5 groups, " + (8 + 24 + 10 + 6) + " shortcuts, one 24-deep scrolling group, one empty group, a nested pair under Drive, two same-name-same-host pairs in Clients, one 70-char name in Reading");

    // ---- tags, through createTag
    data = await S.getAll();
    var tagIds = {};
    for (var ti = 0; ti < STUDIO_TAGS.length; ti++) {
      var tag = await S.createTag(data, { name: STUDIO_TAGS[ti] }, studio);
      if (tag) tagIds[STUDIO_TAGS[ti]] = tag.id;
    }
    await S.saveAll(data);

    // ---- goals and tasks, through createGoal/createTask/completeTask
    data = await S.getAll();
    var T_ = function (n) { return tagIds[n] ? [tagIds[n]] : []; };
    var GOALS = [
      // name, tag, [task, priority, dueOffsetDays|null, done]
      ["Rebuild onboarding flow", "deep work", [
        ["Wireframe the shortened flow", "high", -2, false],
        ["Write the empty-state copy", "medium", 0, false],
        ["Cut the third step entirely", "low", 6, false],
        ["Instrument the drop-off", "medium", 14, false]
      ]],
      ["Ship the Q3 report", "writing", [
        ["Pull regional revenue numbers", "urgent", -1, true],
        ["Draft the executive summary", "high", 0, true],
        ["Chart the quarter-over-quarter split", "medium", 3, false],
        ["Circulate for comment", "low", 9, false],
        ["Book the studio for Thursday", "medium", -4, false]
      ]],
      ["Migrate the design system", "infrastructure and platform work", [
        ["Audit the token population", "high", -30, true],
        ["Move the ink ramp", "medium", -25, true],
        ["Retire the old shadow scale", "low", -20, true]
      ]],
      ["Rework the pricing page", "client", [
        ["Interview three lapsed trials", "high", 2, false],
        ["Rewrite the comparison table", "medium", 8, false]
      ]],
      ["Learn the new render pipeline", "research", [
        ["Finish the generics chapter", "low", 21, false],
        ["Build a tiny scheduler", "medium", 30, false]
      ]],
      ["Reduce onboarding support load", "admin", [
        ["Tag the last 90 tickets", "medium", 5, false]
      ]],
      ["A goal whose name runs long enough to test how the card header truncates it", "review", [
        ["Check the header at narrow widths", "low", 11, false]
      ]]
    ];

    // ORDER IS LOAD-BEARING: EVERY TASK IS CREATED BEFORE ANY IS COMPLETED.
    //
    // completeTask auto-completes the parent goal when its last ACTIVE child is
    // ticked, and the goal does not re-open when a new active child arrives
    // later. Creating and completing task-by-task therefore closed "Ship the
    // Q3 report" on its FIRST completion, when that task was momentarily the
    // goal's only child - and the part-way goal the coverage list asks for
    // silently became a second 100% goal. Two passes keeps the intended shape.
    var taskByName = {};
    var toComplete = [];
    for (var gi2 = 0; gi2 < GOALS.length; gi2++) {
      var G = GOALS[gi2];
      var goal = await S.createGoal(data, { name: G[0], tagIds: T_(G[1]) }, studio);
      if (!goal) continue;
      for (var k = 0; k < G[2].length; k++) {
        var row = G[2][k];
        var fields = { name: row[0], goalId: goal.id, priority: row[1], tagIds: T_(G[1]) };
        if (row[2] !== null) fields.dueAt = ago(-row[2]);
        var task = await S.createTask(data, fields, studio);
        if (!task) continue;
        taskByName[row[0]] = task.id;
        if (row[3]) toComplete.push(task.id);
      }
      // The 100%-complete goal is also collapsed, so that state renders too.
      if (G[0] === "Migrate the design system") {
        goal.status = "completed";
        goal.completedAt = ago(18);
        goal.isCollapsed = true;
      }
    }
    for (var c = 0; c < toComplete.length; c++) await S.completeTask(data, toComplete[c], studio);

    // standalone tasks, every priority, dues spanning overdue/today/future
    var STANDALONE = [
      ["Reply to the design review thread", "high", -3],
      ["Renew the domain", "urgent", -1],
      ["Swap the studio lightbulbs", "low", 0],
      ["Reconcile August invoices", "medium", 0],
      ["Draft the retro agenda", "medium", 4],
      ["Back up the archive drive", "low", 12],
      ["A standalone task with a deliberately long name, to see where the row clips it", "high", 7],
      ["File the quarterly paperwork", null, 25]
    ];
    for (var s2 = 0; s2 < STANDALONE.length; s2++) {
      var st = STANDALONE[s2];
      var f2 = { name: st[0], tagIds: T_(s2 % 2 ? "admin" : "deep work") };
      if (st[1]) f2.priority = st[1];
      if (st[2] !== null) f2.dueAt = ago(-st[2]);
      var t2 = await S.createTask(data, f2, studio);
      if (t2) taskByName[st[0]] = t2.id;
    }
    await S.saveAll(data);
    log.push("tasks: 7 goals (one at 0%, several part-way, one at 100% and collapsed), " +
             Object.keys(taskByName).length + " tasks, all priorities, dues overdue/today/future");

    // ---- recurring templates
    data = await S.getAll();
    // THE FIELD IS `frequency`, NOT `cadence`, and weekly/monthly carry a
    // required pattern field of their own (validateRecurringPattern rejects a
    // weekly with no daysOfWeek and a monthly with no dayOfMonth). Seeded with
    // `cadence` these came back non-null-looking but never rendered a row.
    var recurCount = 0;
    var RECUR = [
      { name: "Weekly review",  frequency: "weekly",  daysOfWeek: [5],  timeOfDay: "16:00", tagIds: T_("review") },
      { name: "Invoice run",    frequency: "monthly", dayOfMonth: 1,    timeOfDay: "09:30", tagIds: T_("admin") },
      { name: "Morning triage", frequency: "daily",                     timeOfDay: "08:45", tagIds: T_("admin") },
      { name: "Backup check",   frequency: "weekly",  daysOfWeek: [1, 3], timeOfDay: "18:00", tagIds: T_("admin"), isActive: false }
    ];
    for (var r = 0; r < RECUR.length; r++) {
      var tpl = await S.createRecurringTemplate(data, RECUR[r], studio);
      if (tpl) recurCount++;
    }
    await S.saveAll(data);
    log.push("recurring: " + recurCount + " of " + RECUR.length +
             " templates (daily, weekly, monthly, plus one paused)");

    // ---- notes: > 6 so the search field earns its place, every paper colour
    data = await S.getAll();
    var COLORS = ["cream", "butter-yellow", "soft-pink", "mint", "sky-blue", "peach", "lavender"];
    var NOTES = [
      "Call the studio back about the October shoot.",
      "Groceries: oat milk, coffee, the good bread.",
      "Idea: a weekly review ritual on Friday afternoons.",
      "Book flights before prices climb again.",
      "Read the piece on deep work that Sam sent.",
      "Ask about the lease renewal terms before signing anything.",
      "The client prefers Tuesday for the handover call.",
      "Try the shorter onboarding copy on the next cohort.",
      "Remember: the archive drive is nearly full.",
      "Follow up on the invoice from August.",
      "A longer note, kept deliberately long so the card has to clip it. It starts with a " +
        "reminder about the shoot, wanders into the question of whether the second location is " +
        "worth the extra day, notes that the permit takes a fortnight, and ends without resolving " +
        "any of it, which is roughly how these notes actually go.",
      "Promoted from a task: rewrite the comparison table with the new pricing tiers."
    ];
    for (var n = 0; n < NOTES.length; n++) {
      // THE FIELD IS `content`, NOT `text` — the third instance of this trap in
      // one seeder (title/frequency/content). newNoteObject coerces an undefined
      // body to "", so twelve notes stored cleanly and the panel rendered twelve
      // cards reading "Empty note".
      await S.createNote(data, { content: NOTES[n], color: COLORS[n % COLORS.length] }, studio);
    }
    await S.saveAll(data);
    log.push("notes: " + NOTES.length + " (all 7 paper colours, one long enough to clip)");

    // ---- named sessions, one attached to a task
    data = await S.getAll();
    var SESSIONS = [
      ["Q3 report research", ["https://stratechery.com", "https://blog.acolyer.org", "https://danluu.com"]],
      ["Onboarding teardown", ["https://www.nngroup.com", "https://web.dev", "https://excalidraw.com"]],
      ["Platform migration", ["https://supabase.com/dashboard", "https://console.neon.tech"]],
      ["Client handover", ["https://app.harvestapp.com", "https://linear.app/meridian"]],
      ["Friday reading", ["https://jvns.ca", "https://overreacted.io", "https://increment.com", "https://rachelbythebay.com"]]
    ];
    var sessIds = [];
    for (var q = 0; q < SESSIONS.length; q++) {
      var tabs = SESSIONS[q][1].map(function (u) {
        // favicons as the product stores them: resolved from the tab at save time
        // normalizeNamedSessionTabs keeps url/title/FAVICON and drops anything
        // else, so favIconUrl (the chrome.tabs spelling) normalised to null.
        return { url: u, title: u.replace(/^https?:\/\//, ""), favicon: "https://" + hostOf(u) + "/favicon.ico" };
      });
      var ns = await S.createNamedSession(data, { name: SESSIONS[q][0], tabs: tabs }, studio);
      if (ns) sessIds.push(ns.id);
    }
    if (sessIds.length && taskByName["Draft the executive summary"]) {
      var ws0 = data.workspaces.find(function (w) { return w.id === studio; });
      var s0 = (ws0.namedSessions || []).find(function (x) { return x.id === sessIds[0]; });
      if (s0) s0.taskId = taskByName["Draft the executive summary"];
    }
    await S.saveAll(data);
    log.push("sessions: " + sessIds.length + " named, one attached to a task");

    // ---- trash: every trashable entity, at spread ages, one near the 30-day purge
    //
    // Deleted THROUGH the delete functions so deletedAt is stamped by the
    // product; the AGE is then backdated, which is the one thing no factory can
    // do (nothing takes a deletion timestamp). Declared as an assumption: the
    // only field touched is deletedAt, which is exactly what the purge reads.
    data = await S.getAll();
    var trashed = [];
    var doomedTask = taskByName["File the quarterly paperwork"];
    if (doomedTask) { await S.deleteTask(data, doomedTask, studio); trashed.push(["task", doomedTask, 29]); }
    var wsT = data.workspaces.find(function (w) { return w.id === studio; });
    var doomedGoal = (wsT.goals || []).find(function (g) { return g.name === "Reduce onboarding support load"; });
    if (doomedGoal) { await S.deleteGoal(data, doomedGoal.id, studio); trashed.push(["goal", doomedGoal.id, 12]); }
    var doomedTag = tagIds["research"];
    if (doomedTag) { await S.deleteTag(data, doomedTag, studio); trashed.push(["tag", doomedTag, 3]); }
    if (sessIds.length >= 3) {
      S.deleteNamedSession(data, sessIds[3], studio); trashed.push(["session", sessIds[3], 1]);
      S.deleteNamedSession(data, sessIds[4], studio); trashed.push(["session", sessIds[4], 21]);
    }
    // backdate
    wsT = data.workspaces.find(function (w) { return w.id === studio; });
    function backdate(list, id, days) {
      var it = (list || []).find(function (x) { return x && x.id === id; });
      if (it && it.deletedAt) it.deletedAt = ago(days);
    }
    trashed.forEach(function (row) {
      backdate(wsT.tasks, row[1], row[2]);
      backdate(wsT.goals, row[1], row[2]);
      backdate(wsT.tags, row[1], row[2]);
      backdate(wsT.namedSessions, row[1], row[2]);
    });
    // a deleted shortcut too (soft-delete is a deletedAt stamp on the shortcut)
    var readingG = wsT.groups.find(function (g) { return g.name === "Reading"; });
    if (readingG && readingG.shortcuts.length) {
      readingG.shortcuts[readingG.shortcuts.length - 1].deletedAt = ago(7);
      trashed.push(["shortcut", "(last Reading row)", 7]);
    }
    await S.saveAll(data);
    log.push("trash: " + trashed.length + " items across task/goal/tag/session/shortcut, ages 1-29 days (one at the 30-day boundary)");

    // ---- the sparse workspace, deliberately thin
    data = await S.getAll();
    await S.createTask(data, { name: "Sketch the album layout", priority: "low" }, side);
    await S.createTask(data, { name: "Price the risograph run", priority: "medium" }, side);
    await S.createNote(data, { content: "The paper stock sample arrived. Thicker than expected.", color: "mint" }, side);
    await S.saveAll(data);
    await withActiveWorkspace(S, side, async function () {
      var g = await S.addGroup("Reference");
      await S.addShortcut(g.id, sc("Are.na", "https://www.are.na"));
      await S.addShortcut(g.id, sc("Risotto", "https://risotto.studio"));
    });
    log.push("Side projects: 2 tasks, 1 note, 1 group of 2 — sparse on purpose");
    log.push("Archive: nothing at all — the in-profile route to every zero state");

    // ---- tracking. See seedTracking for why this is the delicate half.
    var track = await seedTracking(S, T, studio, taskByName, log);

    // ---- Pro on, onboarding quiet
    data = await S.getAll();
    data.__devProOverride = true;
    await S.saveAll(data);
    await chrome.storage.local.set({
      promoState: { lastPromoOpen: now(), openCount: 1, rateDismissed: true, coffeeDismissed: true },
      launchpad_onboarding: { complete: true, dismissed: true, tipsSeen: true }
    });

    return { ok: true, profile: "busy", log: log, tracking: track };
  }

  // ------------------------------------------------------------- tracking
  //
  // THE WHOLE POINT OF DOING IT THIS WAY: raw sessions are seeded and the
  // ENGINE rolls them up. Hand-writing tracking_days (which the capture fixture
  // does) skips rollupSessionInto entirely, and rollup is where byTag is
  // DERIVED — a session's tags come from the shortcuts whose URL matches its
  // domain plus the active task's tags, computed at rollup time. A hand-written
  // aggregate can therefore carry byTag entries the engine would never produce.
  //
  // THE LIFETIME TRAP, and it is not where the brief expected it. The gate on
  // the lifetime line is satLifetimeIsInformative(since): lifetime.since must
  // be at least satWindowDays() days old. backfillLifetime sets `since` from
  // the OLDEST DAY AGGREGATE, is one-time-guarded on backfilledAt, and runs
  // BEFORE the rollup in the same pass. So seeding sessions and rolling up once
  // sets since = now (there were no aggregates yet when backfill looked) and the
  // line can never render, however much history is present.
  //
  // The fix is two passes, and it is not a hack: it is exactly the path a real
  // 2.0 install takes when it upgrades to 2.1 with aggregates already on disk.
  //   pass 1  sessions in, rollup builds the aggregates
  //   reset   lifetime back to its empty shape
  //   pass 2  backfill now sees a populated day map and anchors `since` to the
  //           oldest day; nothing double-counts because every session is
  //           already stamped aggregated.
  var HISTORY_DAYS = 75;                 // materially more than the 30-day window

  function seedTrackingSessions(wsId, taskIds) {
    var out = [];
    var DOMAINS = [
      "github.com", "figma.com", "linear.app", "notion.so", "stratechery.com",
      "app.slack.com", "developer.mozilla.org", "supabase.com", "excalidraw.com"
    ];
    var CLOSED_BY = [
      "domain-change", "tab-switch", "window-focus", "state-change",
      "window-blur", "no-active-tab", "not-trackable", "paused",
      "tracking-disabled", "no-workspace", "entitlement-lost", "no-data",
      "orphan-reconciled", "import", "unknown"
    ];
    var ids = Object.keys(taskIds).map(function (k) { return taskIds[k]; });
    var seq = 0;
    for (var d = HISTORY_DAYS; d >= 0; d--) {
      // Shape rather than a flat row: a weekly rhythm, one idle day and one
      // very deep day, so the chart has something to say.
      var dow = new Date(Date.now() - d * DAY).getDay();
      var base = (dow === 0 || dow === 6) ? 0.25 : 1;
      if (d === 3) base = 0.06;                       // the idle day
      if (d === 5) base = 2.6;                        // the deep-work day
      if (d % 11 === 0) base *= 1.7;
      var blocks = Math.max(0, Math.round(base * (3 + (d % 4))));
      var dayStart = new Date(Date.now() - d * DAY);
      dayStart.setHours(9, 0, 0, 0);
      var cursor = dayStart.getTime();
      for (var b = 0; b < blocks; b++) {
        var mins = 12 + ((d * 7 + b * 13) % 48);
        if (d === 5 && b === 0) mins = 135;           // clears the 2h Deep Diver bar
        var start = cursor + (b * 9 * 60 * 1000);
        var end = start + mins * 60 * 1000;
        out.push({
          id: "sess_seed_" + (seq++),
          workspaceId: wsId,
          domain: DOMAINS[(d + b) % DOMAINS.length],
          start: start,
          end: end,
          // Attribution needs a live task id for byTask and for the lifetime
          // accumulator; a share of sessions deliberately carry none, because
          // untasked focus is real and lands only in totalFocusedMs/byDomain.
          activeTaskId: (b % 3 === 2) ? null : (ids.length ? ids[(d + b) % ids.length] : null),
          closedBy: CLOSED_BY[(d * 3 + b) % CLOSED_BY.length],
          aggregated: false
        });
        cursor = end;
      }
    }
    return out;
  }

  async function seedTracking(S, T, wsId, taskByName, log) {
    if (!T || typeof T.restoreStores !== "function") {
      log.push("tracking: SKIPPED — window.Tracking is not on this page");
      return { seeded: false };
    }
    // Only tasks that still exist can be attributed; the trashed one is excluded
    // on purpose so nothing points at a purged id.
    var attributable = {};
    Object.keys(taskByName).forEach(function (k) {
      if (k !== "File the quarterly paperwork") attributable[k] = taskByName[k];
    });
    var sessions = seedTrackingSessions(wsId, attributable);

    // pass 1 — the engine builds the aggregates from raw sessions
    await T.restoreStores({ sessions: sessions, open: null }, {});

    // reset the accumulator so backfill runs against the now-populated day map
    var store = (await chrome.storage.local.get("tracking_sessions")).tracking_sessions || {};
    var days  = (await chrome.storage.local.get("tracking_days")).tracking_days || {};
    store.lifetime = { byTask: {}, since: null, backfilledAt: null };

    // pass 2 — backfill anchors `since` to the oldest day it actually holds
    await T.restoreStores(store, days);

    var after = (await chrome.storage.local.get("tracking_sessions")).tracking_sessions || {};
    var afterDays = (await chrome.storage.local.get("tracking_days")).tracking_days || {};
    var life = after.lifetime || {};
    log.push("tracking: " + sessions.length + " sessions over " + HISTORY_DAYS +
             " days, " + Object.keys(afterDays).length + " day aggregates, every closedBy reason");
    return {
      seeded: true,
      sessionsSeeded: sessions.length,
      dayAggregates: Object.keys(afterDays).length,
      sessionsRetained: (after.sessions || []).length,
      lifetimeSince: life.since || null,
      lifetimeSinceAgeDays: life.since ? Math.round((Date.now() - life.since) / DAY) : null,
      lifetimeByTask: life.byTask || {}
    };
  }

  // ----------------------------------------------------------------- empty
  //
  // A fresh Pro profile: default data, Pro on, onboarding quiet, nothing else.
  // The point is that every zero state is one command away instead of a
  // sequence of modals.
  async function seedEmpty(S) {
    var data = await S.getAll();
    data.workspaces = [];
    data.workspaceOrder = [];
    var only = pushWorkspace(data, "Main", true);
    data.activeWorkspaceId = only;
    data.__devProOverride = true;
    await S.saveAll(data);
    await chrome.storage.local.set({
      promoState: { lastPromoOpen: now(), openCount: 1, rateDismissed: true, coffeeDismissed: true },
      launchpad_onboarding: { complete: true, dismissed: true, tipsSeen: true },
      tracking_sessions: { sessions: [], open: null, lifetime: { byTask: {}, since: null, backfilledAt: null } },
      tracking_days: {}
    });
    return { ok: true, profile: "empty", log: ["one empty workspace, Pro on, no records of any kind"] };
  }

  return { seedBusy: seedBusy, seedEmpty: seedEmpty, HISTORY_DAYS: HISTORY_DAYS };
})();

async function __seedProfile(name) {
  var S = window.Storage, T = window.Tracking;
  if (!S) return { ok: false, error: "window.Storage is not on this page" };
  try {
    if (name === "busy")  return await __FIXTURE_PROFILES.seedBusy(S, T);
    if (name === "empty") return await __FIXTURE_PROFILES.seedEmpty(S);
    return { ok: false, error: "unknown profile: " + name };
  } catch (e) {
    return { ok: false, error: String((e && e.stack) || e) };
  }
}
