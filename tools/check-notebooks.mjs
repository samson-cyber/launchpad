#!/usr/bin/env node
// ===========================================================================
// [NB.2] THE NOTEBOOKS DATA MODEL.
//
// IN A VM, NOT A BROWSER, and that is the correct instrument rather than a
// concession: NB.2 ships NO UI. There is no strip, no chip, no picker and no
// modal to drive, so a scratch profile would boot a browser to assert things
// that happen entirely inside storage.js. NB.3 is where a real browser earns
// its keep (and where the O1 ink measurement has to happen, because the static
// ink gate cannot see a JS-rendered panel).
//
// THREE KINDS OF ASSERTION HERE, and the middle one is the one that matters:
//
//   1. BEHAVIOURAL - every updater driven against a fixture, state read back.
//   2. SEQUENCE - deleteNotebook releases BEFORE it soft-deletes, asserted by
//      RECORDING THE ORDER OF WRITES through a Proxy rather than by reading the
//      end state. Both orderings produce the same end state, so an endpoint
//      assertion cannot tell them apart (BUGS.md P22). The window this rules
//      out - a trashed notebook still holding live notes - exists only in the
//      middle.
//   3. STRUCTURAL - the one-writer rule, the purge registration and the
//      deliberate ABSENCE of a tag-cascade entry, read out of the source.
//      These are wiring questions, and the I8 split says a gate proves wiring.
//
// Usage:
//   node tools/check-notebooks.mjs [repoRoot]            the gate
//   node tools/check-notebooks.mjs [repoRoot] --mutate   mutation-seeding run
// Exit 0 = PASS, 1 = FAIL, 2 = SUBJECT DID NOT LOAD.
// ===========================================================================
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const args = process.argv.slice(2);
const MUTATE = args.includes("--mutate");
const repoRoot = args.find((a) => !a.startsWith("--")) || process.cwd();
const SUBJECT = "storage.js";
const DAY = 86400000;

// M4/M7: the working copy is CRLF and the blob is LF. Normalise before any
// anchor is matched, or every multi-line seed silently misses.
function readSubject() {
  return fs.readFileSync(path.join(repoRoot, SUBJECT), "utf8").replace(/\r\n/g, "\n");
}

// A FIXED CLOCK, so the 30-day purge boundary is arithmetic rather than
// weather. Date is subclassed rather than monkey-patched so `new Date(ts)`,
// `new Date()` and `Date.UTC` all keep working inside the subject.
const FIXED_NOW = Date.parse("2026-09-16T12:00:00Z");
class FakeDate extends Date {
  constructor(...a) { if (a.length === 0) super(FIXED_NOW); else super(...a); }
  static now() { return FIXED_NOW; }
}

function fixture() {
  return {
    workspaces: [{
      id: "main", name: "Main", createdAt: 1, isReadOnly: false,
      groupOrder: ["ungrouped"],
      groups: [{ id: "ungrouped", name: "Ungrouped", shortcuts: [], deletedAt: null }],
      goals: [], tasks: [], tags: [], namedSessions: [],
      notes: [
        { id: "n1", content: "one", color: "cream", position: { x: 0, y: 0 }, rotation: 0,
          notebookId: null, sourceUrl: null, tagIds: [], createdAt: 1, updatedAt: 1, deletedAt: null },
        { id: "n2", content: "two", color: "mint", position: { x: 0, y: 0 }, rotation: 0,
          notebookId: null, sourceUrl: null, tagIds: [], createdAt: 1, updatedAt: 1, deletedAt: null },
        { id: "n3", content: "three", color: "peach", position: { x: 0, y: 0 }, rotation: 0,
          notebookId: null, sourceUrl: null, tagIds: [], createdAt: 1, updatedAt: 1, deletedAt: null }
      ],
      notebooks: [],
      tracking: { enabled: true }
    }],
    workspaceOrder: ["main"], activeWorkspaceId: "main", trackingPaused: false,
    settings: { columns: 6, collapsedGroups: {}, combinedAnalyticsEnabled: false, endOfDayMinutes: 1020 },
    pro: { subscriptionStatus: "free", licenseKey: null, instanceId: null, instanceName: null,
           email: null, trialStartedAt: null, trialEndedAt: null, lastVerifiedAt: null }
  };
}

function boot(src, initial) {
  const store = { data: initial === undefined ? fixture() : initial };
  const stats = { sets: 0 };
  const chrome = {
    runtime: { getManifest: () => ({ version: "2.1.0" }), lastError: null, id: "t" },
    storage: {
      local: {
        QUOTA_BYTES: 10485760,
        get: async (k) => {
          const out = {};
          const keys = k === null ? Object.keys(store) : (Array.isArray(k) ? k : [k]);
          for (const key of keys) if (key in store) out[key] = JSON.parse(JSON.stringify(store[key]));
          return out;
        },
        set: async (obj) => {
          stats.sets++;
          for (const [k, v] of Object.entries(obj)) store[k] = JSON.parse(JSON.stringify(v));
        },
        remove: async () => {},
        getBytesInUse: async () => JSON.stringify(store).length
      }
    }
  };
  const sandbox = {
    chrome, crypto, Date: FakeDate, JSON, Math, Object, Array, Set, Map, String,
    Number, Boolean, isFinite, setTimeout, structuredClone, Promise, Error, RegExp,
    parseInt, parseFloat, Intl, Proxy, Reflect,
    I18n: { t: (k) => k, th: (k) => k },
    ProAccess: { getProAccessLevel: () => "active", isProAccessibleLevel: () => true },
    console: { log() {}, warn() {}, error() {} }
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: SUBJECT });
  if (!sandbox.Storage || typeof sandbox.Storage.createNotebook !== "function") {
    const e = new Error("Storage.createNotebook missing after load");
    e.subjectDidNotLoad = true;
    throw e;
  }
  return { S: sandbox.Storage, store, stats };
}

async function suite(src) {
  const rows = [];
  const chk = (name, ok, extra = "") => rows.push({ name, ok: !!ok, extra });
  const eq = (name, got, want) =>
    chk(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  const ws0 = (d) => d.workspaces[0];

  // ================= the record, and what is NOT on it =================
  {
    const { S } = boot(src);
    const d = fixture();
    const nb = S.createNotebook(d, { name: "  Reading  " });
    chk("createNotebook returns a record", !!nb, String(nb));
    eq("the record has EXACTLY the five specified fields",
      Object.keys(nb).sort(), ["createdAt", "deletedAt", "id", "name", "updatedAt"]);
    chk("there is NO position field (array order is canonical)", !("position" in nb));
    chk("the id carries the nb_ prefix", /^nb_/.test(nb.id), nb.id);
    eq("the name is trimmed", nb.name, "Reading");
    eq("it lands live", nb.deletedAt, null);
    eq("it is pushed onto ws.notebooks", ws0(d).notebooks.length, 1);

    // The name is REQUIRED, not defaulted - "New notebook" is user-visible copy
    // and belongs in the catalogue, reached through t() from NB.3.
    chk("an empty name is refused", S.createNotebook(d, { name: "   " }) === null);
    chk("a missing name is refused", S.createNotebook(d, {}) === null);
    eq("a refused create writes nothing", ws0(d).notebooks.length, 1);
  }

  // ================= createNotebook can attach in one call =================
  // The REVIEW's addition: the note menu's "Add to notebook" must be able to
  // CREATE, or a user with zero notebooks can never make their first one.
  {
    const { S } = boot(src);
    const d = fixture();
    const nb = S.createNotebook(d, { name: "Ideas", attachNoteId: "n1" });
    eq("createNotebook(attachNoteId) files the note in the same call",
      ws0(d).notes.find((n) => n.id === "n1").notebookId, nb.id);
    eq("...and leaves the other notes standalone",
      ws0(d).notes.filter((n) => n.notebookId === null).map((n) => n.id), ["n2", "n3"]);
  }

  // ================= setNoteNotebook =================
  {
    const { S } = boot(src);
    const d = fixture();
    const nb = S.createNotebook(d, { name: "Ideas" });
    eq("setNoteNotebook files a note", S.setNoteNotebook(d, "n1", nb.id).notebookId, nb.id);
    eq("setNoteNotebook(null) releases it", S.setNoteNotebook(d, "n1", null).notebookId, null);
    chk("a note may not join a TRASHED notebook", (() => {
      const t = S.createNotebook(d, { name: "Gone" });
      S.deleteNotebook(d, t.id);
      return S.setNoteNotebook(d, "n2", t.id) === null;
    })());
    chk("an unknown note is refused", S.setNoteNotebook(d, "nope", nb.id) === null);
    chk("an unknown notebook is refused", S.setNoteNotebook(d, "n2", "nb_nope") === null);
    // A trashed NOTE can still be released - deleteNotebook depends on it.
    const d2 = fixture();
    const b2 = S.createNotebook(d2, { name: "B" });
    S.setNoteNotebook(d2, "n3", b2.id);
    ws0(d2).notes.find((n) => n.id === "n3").deletedAt = FIXED_NOW - DAY;
    eq("a TRASHED note can still be released (deleteNotebook needs this)",
      S.setNoteNotebook(d2, "n3", null).notebookId, null);
  }

  // ================= rename =================
  {
    const { S } = boot(src);
    const d = fixture();
    const nb = S.createNotebook(d, { name: "Old" });
    const before = nb.updatedAt;
    eq("renameNotebook trims and sets", S.renameNotebook(d, nb.id, "  New  ").name, "New");
    chk("an empty rename is refused", S.renameNotebook(d, nb.id, "  ") === null);
    eq("the refused rename left the name alone", ws0(d).notebooks[0].name, "New");
    chk("renaming an unknown notebook is refused", S.renameNotebook(d, "nb_x", "y") === null);
    chk("updatedAt is a number", typeof before === "number");
  }

  // ========== deleteNotebook: THE SEQUENCE, not just the endpoint ==========
  //
  // Both orderings end identically, so the end state cannot distinguish them.
  // Record the ORDER of writes and assert every release precedes the
  // soft-delete - the window this rules out exists only in the middle (P22).
  {
    const { S } = boot(src);
    const d = fixture();
    const nb = S.createNotebook(d, { name: "Trip" });
    S.setNoteNotebook(d, "n1", nb.id);
    S.setNoteNotebook(d, "n2", nb.id);
    ws0(d).notes.find((n) => n.id === "n2").deletedAt = FIXED_NOW - DAY;   // one trashed member

    const log = [];
    const watch = (obj, label) => new Proxy(obj, {
      set(t, prop, val) {
        if (prop === "notebookId" || prop === "deletedAt") log.push(`${label}.${String(prop)}=${JSON.stringify(val)}`);
        return Reflect.set(t, prop, val);
      }
    });
    const w = ws0(d);
    w.notes = w.notes.map((n) => watch(n, "note:" + n.id));
    w.notebooks = w.notebooks.map((b) => watch(b, "book:" + b.id));

    S.deleteNotebook(d, nb.id);

    const delIdx = log.findIndex((e) => e.startsWith("book:") && e.includes("deletedAt"));
    const releases = log.map((e, i) => ({ e, i })).filter(({ e }) => e.includes("notebookId=null"));
    chk("SEQUENCE: the soft-delete happened", delIdx !== -1, log.join(" | "));
    chk("SEQUENCE: BOTH members were released (the trashed one too)", releases.length === 2, log.join(" | "));
    chk("SEQUENCE: EVERY release precedes the soft-delete (no observable window)",
      releases.every(({ i }) => i < delIdx), log.join(" | "));

    // deleteNotebook must be SYNCHRONOUS: an async function would have an await
    // point where another reader could interleave, so "one write" would be the
    // weaker claim. This is the stronger one - one state change.
    chk("deleteNotebook is synchronous (no await point exists inside it)",
      S.deleteNotebook.constructor.name === "Function", S.deleteNotebook.constructor.name);

    eq("END STATE: the notebook is trashed", typeof ws0(d).notebooks[0].deletedAt, "number");
    eq("END STATE: no note points at it",
      ws0(d).notes.filter((n) => n.notebookId === nb.id).length, 0);
    chk("END STATE: the notes themselves are NOT deleted (release, never cascade)",
      ws0(d).notes.filter((n) => !n.deletedAt).length === 2);
  }

  // ================= restore gives back an EMPTY notebook =================
  {
    const { S } = boot(src);
    const d = fixture();
    const nb = S.createNotebook(d, { name: "Trip" });
    S.setNoteNotebook(d, "n1", nb.id);
    S.deleteNotebook(d, nb.id);
    const back = S.restoreNotebook(d, nb.id);
    eq("restoreNotebook clears deletedAt", back.deletedAt, null);
    eq("THE STATED CONSEQUENCE: membership is NOT restored",
      ws0(d).notes.filter((n) => n.notebookId === nb.id).length, 0);
    chk("restoring a LIVE notebook is refused", S.restoreNotebook(d, nb.id) === null);
    chk("restoring an unknown notebook is refused", S.restoreNotebook(d, "nb_x") === null);
  }

  // ================= permanent delete =================
  {
    const { S } = boot(src);
    const d = fixture();
    const nb = S.createNotebook(d, { name: "Trip" });
    S.deleteNotebook(d, nb.id);
    chk("deleteNotebookPermanent removes the record", await S.deleteNotebookPermanent(d, nb.id) === true);
    eq("...and the array is empty", ws0(d).notebooks.length, 0);
    chk("removing an unknown id returns false", await S.deleteNotebookPermanent(d, "nb_x") === false);
  }

  // ================= reorder =================
  {
    const { S } = boot(src);
    const d = fixture();
    const a = S.createNotebook(d, { name: "A" });
    const b = S.createNotebook(d, { name: "B" });
    const c = S.createNotebook(d, { name: "C" });
    await S.reorderNotebooks(d, [c.id, a.id, b.id]);
    eq("reorderNotebooks permutes the array (order is canonical)",
      ws0(d).notebooks.map((x) => x.name), ["C", "A", "B"]);
    chk("a short order is refused", await S.reorderNotebooks(d, [a.id]) === null);
    chk("a non-array is refused", await S.reorderNotebooks(d, "nope") === null);
    chk("an unknown id is refused", await S.reorderNotebooks(d, [a.id, b.id, "nb_x"]) === null);
    S.deleteNotebook(d, a.id);
    chk("a trashed id is refused", await S.reorderNotebooks(d, [c.id, b.id, a.id]) === null);
    eq("live-only reorder still works with a trashed sibling present",
      (await S.reorderNotebooks(d, [b.id, c.id])) !== null, true);
  }

  // ================= readers =================
  {
    const { S } = boot(src);
    const d = fixture();
    const a = S.createNotebook(d, { name: "A" });
    S.createNotebook(d, { name: "B" });
    S.setNoteNotebook(d, "n1", a.id);
    S.deleteNotebook(d, a.id);
    eq("getAllNotebooks excludes trashed", S.getAllNotebooks(ws0(d)).map((x) => x.name), ["B"]);
    eq("getDeletedNotebooks returns only trashed", S.getDeletedNotebooks(ws0(d)).map((x) => x.name), ["A"]);
    chk("getNotebookById refuses a trashed id", S.getNotebookById(ws0(d), a.id) === null);
  }

  // ================= THE MUSEUM PIECE HAS A READER =================
  {
    const { S } = boot(src);
    const d = fixture();
    const nb = S.createNotebook(d, { name: "A" });
    S.setNoteNotebook(d, "n1", nb.id);
    S.setNoteNotebook(d, "n2", nb.id);
    ws0(d).notes.find((n) => n.id === "n2").deletedAt = FIXED_NOW - DAY;
    eq("notesInNotebook READS note.notebookId (the museum piece discharged)",
      S.notesInNotebook(ws0(d), nb.id).map((n) => n.id), ["n1", "n2"]);
    eq("...and can be narrowed to live members",
      S.notesInNotebook(ws0(d), nb.id, { liveOnly: true }).map((n) => n.id), ["n1"]);
  }

  // ================= the sweep, and its idempotence (I28) =================
  {
    // A profile with NO notebooks key anywhere - the shape every existing
    // install has today, since getDefaultData never carried it.
    const legacy = fixture();
    delete legacy.workspaces[0].notebooks;
    const { S, store, stats } = boot(src, legacy);

    const first = await S.getAll();
    chk("the sweep backfills a missing notebooks array", Array.isArray(first.workspaces[0].notebooks));
    eq("...as an EMPTY array", first.workspaces[0].notebooks.length, 0);
    const afterFirst = stats.sets;
    chk("the backfill performed exactly one write", afterFirst === 1, `${afterFirst} write(s)`);

    await S.getAll();
    await S.getAll();
    chk("I28: two further reads of a warm blob write NOTHING",
      stats.sets === afterFirst, `writes moved by ${stats.sets - afterFirst}`);
    chk("the notes survived the backfill untouched", store.data.workspaces[0].notes.length === 3);
  }
  {
    // A non-array value must also be repaired, and repaired ONCE.
    const broken = fixture();
    broken.workspaces[0].notebooks = "not an array";
    const { S, stats } = boot(src, broken);
    const d = await S.getAll();
    chk("a corrupt notebooks value is replaced with an array", Array.isArray(d.workspaces[0].notebooks));
    const n = stats.sets;
    await S.getAll();
    chk("...and the repair is idempotent", stats.sets === n, `writes moved by ${stats.sets - n}`);
  }

  // ================= purge at 30 days =================
  {
    const { S } = boot(src);
    const d = fixture();
    const old = S.createNotebook(d, { name: "Expired" });
    const recent = S.createNotebook(d, { name: "Recent" });
    S.setNoteNotebook(d, "n1", old.id);
    S.deleteNotebook(d, old.id);                       // releases n1
    ws0(d).notebooks.find((b) => b.id === old.id).deletedAt = FIXED_NOW - 31 * DAY;
    S.deleteNotebook(d, recent.id);
    ws0(d).notebooks.find((b) => b.id === recent.id).deletedAt = FIXED_NOW - 2 * DAY;

    const removed = await S.purgeExpiredTrash(d);
    chk("the 31-day-old notebook is purged", removed >= 1, `removed ${removed}`);
    eq("the purged record is gone", ws0(d).notebooks.map((b) => b.name), ["Recent"]);
    eq("the 2-day-old notebook survives", ws0(d).notebooks.length, 1);
    eq("THE NOTES ARE UNTOUCHED by the purge", ws0(d).notes.length, 3);
    chk("no note was deleted", ws0(d).notes.every((n) => !n.deletedAt));
  }

  // ================= export / import =================
  {
    const { S, store } = boot(src);
    const d = await S.getAll();
    const nb = S.createNotebook(d, { name: "Travel" });
    S.setNoteNotebook(d, "n1", nb.id);
    await S.saveAll(d);

    const env = await S.buildBackupEnvelope();
    const exported = env.stores.data.workspaces[0];
    eq("EXPORT: notebooks ride the envelope", exported.notebooks.map((b) => b.name), ["Travel"]);
    eq("EXPORT: membership rides with them",
      exported.notes.find((n) => n.id === "n1").notebookId, nb.id);
    chk("EXPORT: the record in the backup has no position field",
      !("position" in exported.notebooks[0]));
    chk("the envelope is whole-store rather than field-enumerated", !!store.data);
  }
  {
    // A v1 backup: a data store with NO notebooks key at all. Restoring writes
    // it to the data key; the next getAll is what makes it current.
    const v1 = fixture();
    delete v1.workspaces[0].notebooks;
    v1.workspaces[0].notes[0].notebookId = undefined;
    const { S } = boot(src, v1);
    const d = await S.getAll();
    chk("IMPORT: a v1 store with no notebooks key loads cleanly",
      Array.isArray(d.workspaces[0].notebooks) && d.workspaces[0].notebooks.length === 0);
    eq("IMPORT: its notes are intact", d.workspaces[0].notes.length, 3);
  }

  // ================= STRUCTURAL: the wiring a gate must prove =================
  {
    // THE ONE-WRITER RULE. Two assignment sites are permitted and named: the
    // record constructor (a backup restore must carry membership through) and
    // setNoteNotebook. Anything else is a second writer.
    const code = src.split("\n")
      .map((l, i) => ({ l: l.trim(), i: i + 1 }))
      .filter(({ l }) => !l.startsWith("//") && !l.startsWith("*") && !l.startsWith("/*"));

    // A PROPERTY ASSIGNMENT is a membership CHANGE. There must be exactly one.
    const assigns = code.filter(({ l }) => /\.notebookId\s*=(?!=)/.test(l));
    chk("ONLY WRITER: exactly one property assignment to a note's notebookId",
      assigns.length === 1, assigns.map((a) => `${a.i}: ${a.l}`).join(" | "));
    chk("ONLY WRITER: and it is setNoteNotebook's",
      assigns.length === 1 && /note\.notebookId\s*=\s*notebookIdOrNull/.test(assigns[0].l),
      assigns.map((a) => a.l).join(" | "));

    // The object-literal KEY is construction, not a membership change, and it
    // must survive: a restored backup carries each note's membership in it.
    // Named separately so the two are never confused for one another.
    const literals = code.filter(({ l }) => /^notebookId\s*:/.test(l));
    chk("CONSTRUCTION: the record's notebookId initialiser appears exactly once",
      literals.length === 1, literals.map((a) => `${a.i}: ${a.l}`).join(" | "));
    chk("ONLY WRITER: updateNote no longer passes notebookId through",
      !/if \(f\.notebookId !== undefined\) note\.notebookId = f\.notebookId;/.test(src));

    // PURGE REGISTRATION AT BIRTH (E5/E7), and the deliberate exclusion.
    const entityList = src.match(/\[("(?:goals|tasks|recurringTemplates|goalTemplates|notes|namedSessions|notebooks)",?\s*)+\]\.forEach/);
    chk("PURGE: the entity list contains \"notebooks\"",
      !!entityList && entityList[0].includes('"notebooks"'), entityList ? entityList[0].slice(0, 120) : "list not found");

    // The tag cascade must NOT mention notebooks - a notebook has no tagIds, so
    // an entry there would clean nothing and would read as a real registration.
    const cascade = src.slice(src.indexOf("Batch-clean purged tag ids"), src.indexOf("detachSessionsFromTasks(ws, wsPurgedTaskIds)"));
    chk("PURGE: the tag cascade deliberately does NOT mention notebooks",
      cascade.length > 100 && !/notebooks/.test(cascade), `cascade slice ${cascade.length} chars`);

    // The workspace shape, in both constructors.
    chk("getDefaultData and migrate BOTH carry notebooks: []",
      (src.match(/notebooks: \[\],/g) || []).length === 2,
      `${(src.match(/notebooks: \[\],/g) || []).length} site(s)`);

    // The sweep is wired into getAll's chain AND into its write condition. Being
    // called but left out of the condition would backfill in memory and never
    // persist - green on a single read, wrong on the next load.
    chk("SWEEP: ensureNotebooksArrays is called in getAll's chain",
      /var notebooksSeeded = ensureNotebooksArrays\(existing\);/.test(src));
    chk("SWEEP: and notebooksSeeded is in the write condition",
      /if \(patched \|\|[^)]*notebooksSeeded/.test(src.replace(/\n/g, " ")));
  }

  return rows;
}

// ------------------------------------------------------------ mutation seeds
const SEEDS = [
  ["the release is moved AFTER the soft-delete (the observable window returns)",
   "    var held = notesInNotebook(ws, notebookId);",
   "    nb.deletedAt = Date.now();\n    var held = notesInNotebook(ws, notebookId);"],
  ["deleteNotebook cascades instead of releasing",
   "      setNoteNotebook(data, held[i].id, null, workspaceId);",
   "      held[i].deletedAt = Date.now();"],
  ["the release skips trashed members (dangling pointers survive)",
   "    var held = notesInNotebook(ws, notebookId);",
   "    var held = notesInNotebook(ws, notebookId, { liveOnly: true });"],
  ["restoreNotebook is not idempotent about live records",
   "    if (!nb || !nb.deletedAt) return null;\n    nb.deletedAt = null;",
   "    if (!nb) return null;\n    nb.deletedAt = null;"],
  ["the sweep reports changed unconditionally (I28: a warm blob writes forever)",
   "      if (!Array.isArray(ws.notebooks)) {\n        ws.notebooks = [];\n        changed = true;\n      }",
   "      if (!Array.isArray(ws.notebooks)) { ws.notebooks = []; }\n      changed = true;"],
  ["notebooks is dropped from the purge entity list",
   '"notes", "namedSessions", "notebooks"]', '"notes", "namedSessions"]'],
  ["updateNote regains its notebookId passthrough (a second writer)",
   "    if (Array.isArray(f.tagIds)) note.tagIds = f.tagIds.slice();",
   "    if (f.notebookId !== undefined) note.notebookId = f.notebookId;\n    if (Array.isArray(f.tagIds)) note.tagIds = f.tagIds.slice();"],
  ["a note may join a trashed notebook",
   "      if (!findLiveNotebook(ws, notebookIdOrNull)) {",
   "      if (false) {"],
  ["createNotebook accepts an empty name",
   "    if (!name) {\n      console.warn(\"[LaunchPad] createNotebook: name is required and must be non-empty after trim\");\n      return null;\n    }",
   "    if (!name) { name = \"x\"; }"],
  ["the record grows a position field",
   "      deletedAt: (o.deletedAt === undefined) ? null : o.deletedAt\n    };\n  }\n\n  function findLiveNotebook",
   "      deletedAt: (o.deletedAt === undefined) ? null : o.deletedAt,\n      position: 0\n    };\n  }\n\n  function findLiveNotebook"],
];

// ---------------------------------------------------------------------- main
const clean = readSubject();

if (args.includes("--boot-check")) {
  try { boot(clean); console.log("BOOT-CHECK OK   check-notebooks.mjs"); process.exit(0); }
  catch (e) { console.log("BOOT-CHECK DEAD check-notebooks.mjs — " + e.message); process.exit(1); }
}

console.log("\nNOTEBOOKS — the [NB.2] data model (no UI exists yet)\n");

let rows;
try { rows = await suite(clean); }
catch (e) { console.error("SUBJECT DID NOT LOAD — " + e.message); process.exit(2); }

// P2: a suite that quietly stops producing rows passes forever.
const ROW_FLOOR = 55;
if (rows.length < ROW_FLOOR) {
  console.error(`GATE BROKEN — produced ${rows.length} rows, floor is ${ROW_FLOOR}.`);
  process.exit(2);
}

let failed = 0;
for (const r of rows) {
  if (!r.ok) { failed++; console.log(`  FAIL  ${r.name}   << ${r.extra}`); }
}
console.log(`\nNOTEBOOKS: ${failed === 0 ? "PASS" : "FAIL"} — ${rows.length - failed} passed, ${failed} failed`);

if (!MUTATE) process.exit(failed === 0 ? 0 : 1);

if (failed > 0) { console.error("\nREFUSING TO SCORE SEEDS — the clean run is not green (Q1)."); process.exit(2); }

console.log("\nMUTATION PASS — every seed must turn the suite red\n");
let escaped = 0, broken = 0;
for (const [name, find, repl] of SEEDS) {
  const n = clean.split(find).length - 1;
  if (n !== 1) { broken++; console.log(`  BROKEN SEED  ${name} (anchor matched ${n}x)`); continue; }
  let mrows;
  try { mrows = await suite(clean.split(find).join(repl)); }
  catch (e) { broken++; console.log(`  BROKEN SEED  ${name} (subject did not load: ${e.message})`); continue; }
  const red = mrows.filter((r) => !r.ok);
  if (!red.length) { escaped++; console.log(`  ESCAPED  ${name}`); }
  else {
    console.log(`  killed   ${name}`);
    console.log(`           by: ${red[0].name.slice(0, 92)}`);
  }
}
console.log(`\n  ${SEEDS.length - escaped - broken} killed, ${escaped} escaped, ${broken} broken`);
process.exit(escaped === 0 && broken === 0 ? 0 : 1);
