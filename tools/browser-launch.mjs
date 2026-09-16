// ===========================================================================
// THE CANONICAL BROWSER LAUNCH FLAGS FOR EVERY HARNESS IN THIS REPO.
//
// WHY THIS FILE EXISTS, AND IT IS NOT THE FOUR COMMITTED HARNESSES.
//
// Those four already default to `--headless=new`, each with a comment saying
// why ("a launching browser steals focus"). The browsers that actually
// interrupted a fortnight of work were the PER-ROUND harnesses - the ones
// written into a scratchpad to drive one round's feature, used, and deleted.
// They are headed because they have to be (see below), they hand-roll their
// own spawn(), and there is nothing left to fix afterwards because the file is
// gone. A flag added to the four would not have reached a single one of them.
//
// So the fix is a MODULE the next harness imports instead of hand-rolling a
// flag array, and a ledger entry (BUGS.md I30) pointing at it. That is the only
// shape of fix that reaches a harness nobody has written yet.
//
// ---------------------------------------------------------------------------
// WHAT WAS MEASURED, 2026-09-15, Edge on Windows. None of this is assumed.
//
//   1. --window-position=-32000,-32000 IS HONOURED, NOT CLAMPED. The window
//      reports back at exactly {left:-32000, top:-32000}. This machine's
//      displays are at (3440,165,1920,1080) and (0,0,3440,1440), so the
//      leftmost pixel of any display is x=0 and a window at -32000 overlaps
//      none of them. Some platforms drag a window back on-screen; this one
//      does not. RE-MEASURE IF THE DISPLAY LAYOUT CHANGES - a negative
//      coordinate is only off-screen relative to where the displays are.
//
//   2. Page.captureScreenshot READS THE COMPOSITOR, NOT THE SCREEN. The same
//      frosted frame captured off-screen and on-screen is BYTE-IDENTICAL:
//      136328 bytes, sha256 abad203e… both times. Nothing a pixel harness
//      measures changes when the window moves off the desktop.
//
//   3. FOCUS IS STILL CONTROLLABLE OFF-SCREEN, in both directions. A window
//      manager off the visible desktop is still a window manager:
//      chrome.windows.update({focused:true}) moves last-focus TO a decoy
//      window and BACK again, identically to on-screen. The control that makes
//      this meaningful is (4).
//
//   4. HEADLESS CANNOT DO EITHER OF THOSE, and that is why off-screen is the
//      fix rather than headless.
//        - focus: under --headless=new last-focus never moved at all across
//          the same sequence - it stuck on whichever window was created last.
//          This is BUGS I23 reconfirmed on this build, and it is why a
//          two-window assertion run headless passes while testing one window.
//        - pixels: the same frosted frame renders DIFFERENTLY headless
//          (137535 bytes, a different sha) than headed. backdrop-filter is the
//          likely reason. So a pixel-contrast harness may NOT go headless, and
//          "just use headless" was ruled out by measurement rather than taste.
//
// ---------------------------------------------------------------------------
// THE OFF-SCREEN FLAG IS UNCONDITIONAL, INCLUDING FOR HEADLESS RUNS. Headless
// ignores it harmlessly, and making it unconditional means a harness that later
// flips to headed - by a flag, an env var, or someone debugging - is off-screen
// ALREADY. A conditional would put the window back on the desktop at exactly
// the moment someone is not thinking about it.
// ===========================================================================

// Far enough negative to clear any plausible multi-monitor arrangement, and the
// value Chromium's own test infrastructure uses for the same purpose.
export const OFFSCREEN_POSITION = "-32000,-32000";

export const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
export const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

/**
 * The canonical flag array. Every harness in this repo should build its
 * command line from this rather than writing one out.
 *
 * @param {object}  o
 * @param {string}  o.profileDir  isolated scratch profile (I6). REQUIRED - a
 *                                harness must never touch a real profile.
 * @param {string}  o.extDir      the unpacked extension to load.
 * @param {number}  o.port        CDP port. UNIQUE PER RUN (I25).
 * @param {boolean} o.headless    default TRUE. Pass false only when the run
 *                                needs a compositor or a window manager.
 * @param {string}  o.windowSize  "W,H". Ignored by headless.
 * @param {string}  o.url         initial page, default about:blank.
 * @param {boolean} o.onScreen    escape hatch for a human who wants to WATCH a
 *                                run. Never set it from a script.
 */
// ---------------------------------------------------------------------------
// WINDOWS MAX_PATH, AND WHY THIS IS A THROW RATHER THAN A COMMENT (I31).
//
// The extension's chrome.storage.local is a LevelDB under
//   <profile>\\Default\\Local Extension Settings\\<32-char id>\\MANIFEST-000001
// and when that path crosses 260 characters the database NEVER OPENS. Nothing
// errors. chrome.storage.local.get simply never settles, the page's init awaits
// its first read forever, and the product presents as dead - no sidebar panel
// responds, and the console is clean. An hour was lost to it once already.
//
// THE THRESHOLD IS MEASURED, NOT ASSUMED. Sweeping profile-path lengths on
// Edge/Windows 2026-09-16, with everything else identical:
//   profile 150 -> db 229          storage.local answers in 1ms
//   profile 175 -> db 254          storage.local answers in 1ms
//   profile 185 -> db 264 (OVER)   storage.local NEVER RETURNS
//   profile 195 -> db 274 (OVER)   the extension does not even register
//
// THE CHECK CANNOT FALSE-POSITIVE, which is the only reason it is allowed to
// throw: it refuses exactly the paths on which the storage this product cannot
// run without is arithmetically unopenable. A path it refuses would not have
// worked. The band below the limit warns instead, because 20 characters of
// slack is a judgement rather than a fact.
const WINDOWS_MAX_PATH = 260;
// "\Default" + "\Local Extension Settings" + "\<32-char id>" + "\MANIFEST-000001"
const EXT_STORAGE_SUFFIX = 8 + 25 + 33 + 16;
const MAX_SAFE_PROFILE_LEN = WINDOWS_MAX_PATH - EXT_STORAGE_SUFFIX;   // 178

export function browserArgs(o) {
  if (!o || !o.profileDir) throw new Error("browserArgs: profileDir is required (I6: never a real profile)");
  if (!o.port) throw new Error("browserArgs: port is required, and must be unique per run (I25)");

  // Only on Windows: MAX_PATH is a Windows limit and a POSIX path of any length
  // is fine, so a check that fired everywhere would be refusing a working setup.
  if (process.platform === "win32") {
    const len = String(o.profileDir).length;
    if (len > MAX_SAFE_PROFILE_LEN) {
      throw new Error(
        `browserArgs: profileDir is ${len} characters, over the ${MAX_SAFE_PROFILE_LEN} this can be (I31).\n` +
        `  The extension-storage LevelDB would land at ~${len + EXT_STORAGE_SUFFIX} characters, past Windows' ${WINDOWS_MAX_PATH}.\n` +
        `  It would never open, chrome.storage.local would never settle, and the page would\n` +
        `  present as DEAD with a clean console. Use a shorter --user-data-dir, e.g. C:\\lp1.\n` +
        `  Refused: ${o.profileDir}`);
    }
    if (len > MAX_SAFE_PROFILE_LEN - 20) {
      console.warn(`[browser-launch] profileDir is ${len} characters, within 20 of the ${MAX_SAFE_PROFILE_LEN} ` +
        `limit (I31). A slightly longer id or filename would hang chrome.storage.local silently.`);
    }
  }

  const args = [
    `--user-data-dir=${o.profileDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    // I6: both of these are load-bearing on Chrome/Edge 137+, which otherwise
    // ignores --load-extension whenever a remote-debugging port is open. The
    // target then lands on chrome-error://chromewebdata, where chrome.runtime
    // is undefined and the failure reads as a broken feature.
    "--disable-features=DisableLoadExtensionCommandLineSwitch",
    "--enable-unsafe-extension-debugging",
  ];

  if (o.extDir) {
    // --disable-extensions-except WITH --load-extension. Plain
    // --disable-extensions would disable the subject too.
    args.push(`--disable-extensions-except=${o.extDir}`, `--load-extension=${o.extDir}`);
  }

  args.push(`--remote-debugging-port=${o.port}`);
  if (o.windowSize !== null) args.push(`--window-size=${o.windowSize || "1400,900"}`);

  // THE POINT OF THIS MODULE.
  if (!o.onScreen) args.push(`--window-position=${OFFSCREEN_POSITION}`);

  if (o.headless !== false) args.push("--headless=new");

  args.push(o.url || "about:blank");
  return args;
}

/**
 * Where a window actually ended up, for a harness that wants to ASSERT it is
 * off-screen rather than trust the flag. Takes the bounds CDP reports and the
 * display rectangles, and answers the only question that matters: does it
 * overlap anything the user can see?
 *
 * Kept here rather than in a harness because the next person to doubt the flag
 * should find the check next to the flag.
 */
export function isOffScreen(bounds, displays) {
  if (!bounds || !Array.isArray(displays) || !displays.length) return null;
  return !displays.some((d) =>
    bounds.left < d.x + d.width && bounds.left + bounds.width > d.x &&
    bounds.top < d.y + d.height && bounds.top + bounds.height > d.y);
}
