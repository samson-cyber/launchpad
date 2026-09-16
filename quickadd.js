// ===========================================================================
// [TD.1] THE QUICK-ADD PARSER. "Call Nadia tomorrow 3pm !high #acme".
//
// PURE, LOCAL, AND ARGUMENT-DRIVEN (PLAN decision A). No AI, no network, no
// permission, no clock. `now` and `zone` are ARGUMENTS, which is what lets the
// three-zone harness drive Los Angeles, London and Sydney without touching a
// real clock or an environment variable. Nothing in this file reads Date.now(),
// the system zone, chrome.*, or the DOM - it loads in the page today and could
// load in the worker tomorrow, for the same reason i18n.js is DOM-free.
//
// ---------------------------------------------------------------------------
// THE ONE THING THAT MATTERS MOST: WHAT A DUE DATE IS IN THIS CODEBASE.
//
// `dueAt` is NOT a wall-clock instant. It is the UTC-MIDNIGHT STAMP OF THE
// USER'S LOCAL CALENDAR DATE - `Date.UTC(localY, localM, localD)` - which is
// the [1.0.13] lesson, and both shipped writers already encode it that way
// (newtab.js parseDateInputToTs, dashboardTodayAsUtcDay). getDueWork reads it
// back with utcDay() against that same stamp.
//
// SO STORING THE TRUE UTC INSTANT OF A PARSED TIME WOULD BE WRONG, and wrong in
// the exact way [1.0.13] cost a round to establish. Two worked counter-examples,
// both of which the three-zone harness asserts:
//
//   Los Angeles, "tonight 11pm" on 17 Sep -> the instant is 18 Sep 06:00Z,
//     so utcDay() reads 18 Sep. The user's calendar says the 17th.
//   Sydney, "today 8am" on 17 Sep        -> the instant is 16 Sep 22:00Z,
//     so utcDay() reads 16 Sep. The user's calendar says the 17th.
//
// Both land a day out, in OPPOSITE directions, which is why testing one zone
// either side of UTC is the only proof. The encoding below never converts a
// wall-clock time into an instant at all: it resolves the LOCAL CALENDAR DATE
// and stamps that. Zone-conversion error is not reduced, it is absent.
//
// THE TIME OF DAY THEREFORE HAS NOWHERE TO LIVE. A task record has `dueAt` and
// no time field, so "3pm" cannot be stored by this round. It is still PARSED,
// for two reasons, and returned as `dueTime` rather than folded into `dueAt`:
//   1. It RESOLVES THE DAY. A bare "3pm" after 3pm means tomorrow.
//   2. The preview shows the user that the time was read and only the date is
//      kept. A time silently swallowed is the same failure as a due date
//      silently attached, one level down.
// `dueTime` IS NOT PERSISTED BY TD.1. Any round that adds a reminder time
// should read this note first.
// ===========================================================================
(function (root) {
  "use strict";

  // ---- the grammar, and its edges, stated once ----------------------------
  //
  // PRIORITY IS THE WORD SYNTAX, NOT !1/!2/!3. The brief offered both and this
  // picks words because the stored enum has FOUR values - low, medium, high,
  // urgent - and a three-number scale cannot address it. A numeric scale would
  // also have to pick a direction, and nothing in the product says whether !1
  // is the most or least urgent; a reader would have to guess, which is the one
  // thing this parser must never make anyone do.
  var PRIORITY_WORDS = {
    low: "low",
    med: "medium",
    medium: "medium",
    high: "high",
    urgent: "urgent"
  };

  var WEEKDAYS = {
    sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2,
    wednesday: 3, wed: 3, thursday: 4, thu: 4, thurs: 4,
    friday: 5, fri: 5, saturday: 6, sat: 6
  };

  var MONTHS = {
    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
    may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
    sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
    dec: 11, december: 11
  };

  var DAY_MS = 86400000;

  var MONTH_ALT = Object.keys(MONTHS)
    .sort(function (a, b) { return b.length - a.length; })
    .join("|");
  var ORD = "(?:st|nd|rd|th)?";
  var MONTH_DAY_RE = new RegExp(
    "(^|\\s)(?:(" + MONTH_ALT + ")\\s+(\\d{1,2})" + ORD +
    "|(\\d{1,2})" + ORD + "\\s+(" + MONTH_ALT + "))\\b", "gi");

  // Decompose an instant into the user's LOCAL civil fields, in `zone`, without
  // touching the host's own zone. Intl is the only thing in the platform that
  // can answer "what does the wall clock say in Sydney right now" from a
  // timestamp, and it is available in both the page and Node.
  function civilInZone(ts, zone) {
    var parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false
    }).formatToParts(new Date(ts));
    var o = {};
    for (var i = 0; i < parts.length; i++) o[parts[i].type] = parts[i].value;
    // hour12:false yields "24" for midnight in some ICU versions; normalise.
    var hh = parseInt(o.hour, 10) % 24;
    return {
      year: parseInt(o.year, 10),
      month: parseInt(o.month, 10) - 1,
      day: parseInt(o.day, 10),
      hour: hh,
      minute: parseInt(o.minute, 10)
    };
  }

  // Civil-calendar arithmetic done in UTC space, which is DST-free by
  // construction: adding a day here can never land on a 23- or 25-hour day and
  // silently shift the date. The result is ALSO the storage encoding, so this
  // is one operation rather than a calculation plus a conversion.
  function utcDayStamp(y, m, d) { return Date.UTC(y, m, d); }
  function addDays(stamp, n) { return stamp + n * DAY_MS; }
  function dowOf(stamp) { return new Date(stamp).getUTCDay(); }

  // ---- token scanning -----------------------------------------------------
  //
  // Every matcher records the SPAN it consumed so the title can be rebuilt with
  // exactly those characters removed and nothing else. Spans are collected and
  // stripped in one pass at the end, so an earlier match can never shift a
  // later match's indices.
  function scan(text, re, onMatch) {
    var spans = [];
    var m;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      if (onMatch(m) === false) continue;
      spans.push([m.index, m.index + m[0].length]);
      break; // FIRST MATCH WINS - see stripSpans' note.
    }
    return spans;
  }

  function stripSpans(text, spans) {
    if (!spans.length) return text.trim();
    var sorted = spans.slice().sort(function (a, b) { return a[0] - b[0]; });
    var out = "";
    var cursor = 0;
    for (var i = 0; i < sorted.length; i++) {
      out += text.slice(cursor, sorted[i][0]);
      cursor = sorted[i][1];
    }
    out += text.slice(cursor);
    // Collapse the hole the removal left. A token taken out of the middle of a
    // sentence leaves two spaces; taken off the end it leaves a trailing one.
    return out.replace(/\s{2,}/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
  }

  /**
   * Parse a quick-add sentence.
   *
   * @param {string} text
   * @param {object} opts  { now: number (required), zone: string (required) }
   * @returns {{
   *   title: string,          the sentence with every consumed token removed
   *   dueAt: number|null,     UTC-midnight stamp of the LOCAL calendar date
   *   dueTime: {hour:number,minute:number}|null,   parsed, NOT persisted
   *   priority: string|null,  one of low|medium|high|urgent
   *   tags: string[],         tag NAMES, in order, de-duplicated within the text
   *   matched: string[]       which kinds fired, for the preview and the tests
   * }}
   */
  function parse(text, opts) {
    var o = opts || {};
    var src = typeof text === "string" ? text : "";
    var result = {
      title: src.trim(), dueAt: null, dueTime: null,
      priority: null, tags: [], matched: []
    };
    if (!src.trim()) return result;
    if (typeof o.now !== "number" || !o.zone) {
      // PURE MEANS PURE. Falling back to Date.now() here would make the
      // function untestable in the one dimension this round exists to test,
      // and would do it silently. Refuse instead.
      throw new Error("parseQuickAdd: now (number) and zone (IANA string) are required");
    }

    var nowCivil = civilInZone(o.now, o.zone);
    var todayStamp = utcDayStamp(nowCivil.year, nowCivil.month, nowCivil.day);
    var spans = [];

    // ---- priority: !word ----------------------------------------------------
    // A bare "!" is not a priority and neither is "!banana" - an unrecognised
    // word stays in the title rather than being guessed at or swallowed.
    spans = spans.concat(scan(src, /(^|\s)!([a-z]+)\b/gi, function (m) {
      var word = m[2].toLowerCase();
      if (!Object.prototype.hasOwnProperty.call(PRIORITY_WORDS, word)) return false;
      if (result.priority) return false;
      result.priority = PRIORITY_WORDS[word];
      result.matched.push("priority");
      return true;
    }));

    // ---- tags: #token, every one of them ------------------------------------
    // Unlike the single-valued fields, tags ACCUMULATE - a task can carry
    // several. "#" alone is not a tag; a token must start alphanumeric.
    var tagRe = /(^|\s)#([A-Za-z0-9][A-Za-z0-9_-]*)/g;
    var tm;
    while ((tm = tagRe.exec(src)) !== null) {
      var name = tm[2];
      var seen = result.tags.some(function (t) { return t.toLowerCase() === name.toLowerCase(); });
      if (!seen) result.tags.push(name);
      spans.push([tm.index + tm[1].length, tm.index + tm[0].length]);
    }
    if (result.tags.length) result.matched.push("tags");

    // ---- an explicit time, wherever it sits ---------------------------------
    var timeSpans = scan(src, /(^|\s)(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|(^|\s)([01]?\d|2[0-3]):([0-5]\d)\b/gi, function (m) {
      var hour, minute;
      if (m[2] !== undefined) {
        hour = parseInt(m[2], 10);
        minute = m[3] ? parseInt(m[3], 10) : 0;
        if (hour < 1 || hour > 12) return false;
        var mer = m[4].toLowerCase();
        if (mer === "pm" && hour !== 12) hour += 12;
        if (mer === "am" && hour === 12) hour = 0;
      } else {
        hour = parseInt(m[6], 10);
        minute = parseInt(m[7], 10);
      }
      result.dueTime = { hour: hour, minute: minute };
      result.matched.push("time");
      return true;
    });
    spans = spans.concat(timeSpans);

    // ---- a date phrase ------------------------------------------------------
    var dateStamp = null;

    // today / tonight / tomorrow
    var wordSpans = scan(src, /(^|\s)(today|tonight|tomorrow)\b/gi, function (m) {
      var w = m[2].toLowerCase();
      dateStamp = (w === "tomorrow") ? addDays(todayStamp, 1) : todayStamp;
      // "tonight" carries an implied evening hour, but ONLY when the user did
      // not write one. It is used for day resolution and shown in the preview;
      // it is not stored, like every other time here.
      if (w === "tonight" && !result.dueTime) result.dueTime = { hour: 20, minute: 0 };
      return true;
    });
    spans = spans.concat(wordSpans);

    // in N days
    if (dateStamp === null) {
      spans = spans.concat(scan(src, /(^|\s)in\s+(\d{1,3})\s+days?\b/gi, function (m) {
        var n = parseInt(m[2], 10);
        if (n < 1 || n > 365) return false;   // a typo'd 9999 is not a due date
        dateStamp = addDays(todayStamp, n);
        return true;
      }));
    }

    // [next] weekday
    //
    // THE EDGE, DECIDED AND STATED: a bare weekday means the next occurrence
    // STRICTLY AFTER today, so "friday" written on a Friday is SEVEN days away,
    // not today. Someone who means today writes "today"; a weekday name on its
    // own day overwhelmingly means the coming one. "next friday" is then seven
    // days beyond that, which on a Friday is fourteen. That is a consequence
    // rather than a special case, and it is stated rather than smoothed over.
    if (dateStamp === null) {
      spans = spans.concat(scan(src, /(^|\s)(next\s+)?(sunday|sun|monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thu|friday|fri|saturday|sat)\b/gi, function (m) {
        var target = WEEKDAYS[m[3].toLowerCase()];
        if (target === undefined) return false;
        var delta = (target - dowOf(todayStamp) + 7) % 7;
        if (delta === 0) delta = 7;
        if (m[2]) delta += 7;
        dateStamp = addDays(todayStamp, delta);
        return true;
      }));
    }

    // "sep 20" / "20 sep"
    //
    // THE EDGE: no year is accepted, and a date already past THIS year rolls to
    // NEXT year. Numeric forms like 20/9 are refused outright - 3/4 is March 4th
    // to one reader and April 3rd to another, and there is no signal in the box
    // to settle it. Refusing is the only answer that cannot be silently wrong.
    if (dateStamp === null) {
      // THE MONTH ALTERNATION IS BUILT FROM THE MONTH NAMES, not from a generic
      // [a-z]{3,9}. A generic word class matches "Renew 20" in "Renew 20 sep"
      // and consumes the number before the real pattern can see it, so "20 sep"
      // silently parsed to nothing. Longest-first so "sept" wins over "sep" and
      // "march" over "mar". The ordinal suffix belongs to the NUMBER, in either
      // position - "20th sep" and "sep 20th" are both ordinary things to write.
      spans = spans.concat(scan(src, MONTH_DAY_RE, function (m) {
        var monName = (m[2] || m[5] || "").toLowerCase();
        var dayNum = parseInt(m[3] || m[4], 10);
        if (!Object.prototype.hasOwnProperty.call(MONTHS, monName)) return false;
        if (!(dayNum >= 1 && dayNum <= 31)) return false;
        var mon = MONTHS[monName];
        var candidate = utcDayStamp(nowCivil.year, mon, dayNum);
        // Reject a day the month does not have (31 Feb) rather than letting
        // Date.UTC roll it silently into the next month.
        var c = new Date(candidate);
        if (c.getUTCMonth() !== mon || c.getUTCDate() !== dayNum) return false;
        if (candidate < todayStamp) candidate = utcDayStamp(nowCivil.year + 1, mon, dayNum);
        dateStamp = candidate;
        return true;
      }));
    }

    // ---- a bare time with no date word --------------------------------------
    //
    // THE EDGE: "3pm" on its own means TODAY if 3pm is still ahead, and
    // TOMORROW if it has already gone. Anything else either invents a date in
    // the past or refuses a perfectly ordinary sentence.
    if (dateStamp === null && result.dueTime) {
      var minutesNow = nowCivil.hour * 60 + nowCivil.minute;
      var minutesDue = result.dueTime.hour * 60 + result.dueTime.minute;
      dateStamp = (minutesDue > minutesNow) ? todayStamp : addDays(todayStamp, 1);
    }

    if (dateStamp !== null) {
      result.dueAt = dateStamp;
      result.matched.push("date");
    }

    result.title = stripSpans(src, spans);
    // A SENTENCE THAT IS NOTHING BUT TOKENS still needs a title, and an empty
    // one would be refused by createTask. Give the tokens back rather than
    // creating something the user cannot see or name.
    if (!result.title) {
      result.title = src.trim();
      result.dueAt = null; result.dueTime = null; result.priority = null;
      result.tags = []; result.matched = [];
    }
    return result;
  }

  root.QuickAdd = { parse: parse, PRIORITY_WORDS: PRIORITY_WORDS };
})(typeof self !== "undefined" ? self : this);
