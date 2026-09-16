// THE REAL ENGINE AND THE REAL CATALOGUE, for gates whose subject calls t().
//
// WHY THIS EXISTS. Three gates extracted a function out of newtab.js into a
// bare VM and asserted its output against HARDCODED ENGLISH. That is BUGS.md
// P20 - "an assertion that requires a literal value format BLOCKS THAT VALUE
// FROM EVER BEING TOKENISED" - and it blocked the last i18n clusters from
// migrating: the moment a sentence became t("key"), the function threw
// `t is not defined` and the gate reported SUBJECT DID NOT LOAD.
//
// WHY THE REAL CATALOGUE RATHER THAN A STUB. A stub returning the key would
// make every assertion key-shaped, which is honest but throws away what those
// gates are actually for: the licence line must SAY THE RIGHT THING for each
// state, and "says the right thing" is about English. Loading i18n.js and
// locales/en.js for real means a gate can assert the rendered sentence while
// SOURCING IT FROM THE CATALOGUE, so a copy change moves both sides together
// and the gate follows instead of failing. That is the property the round was
// asked to prove by mutation.
//
// It is also the real plural engine: Intl.PluralRules, "=0" exact forms and
// {named} interpolation all behave exactly as they do in the product, so a
// singular/plural boundary assertion tests the shipped rule rather than a
// re-implementation of it.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

/**
 * @param {string} repoRoot
 * @returns {{ t: Function, th: Function, I18n: object, keyCount: number }}
 */
export function loadI18n(repoRoot) {
  const ctx = {
    Intl, JSON, Object, Array, String, Number, Boolean, Math, Date, RegExp, Error,
    console: { log() {}, warn() {}, error() {} },
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ["i18n.js", "locales/en.js"]) {
    vm.runInContext(fs.readFileSync(path.join(repoRoot, f), "utf8"), ctx, { filename: f });
  }
  if (!ctx.I18n || typeof ctx.I18n.t !== "function") {
    throw new Error("I18n.t missing after loading i18n.js + locales/en.js");
  }
  // ANTI-VACUITY (P2). An engine that loaded but a catalogue that did not would
  // make t() return key names, every assertion would compare a key against a
  // key, and the gate would pass while proving nothing about any sentence.
  const probe = ctx.I18n.t("common_remove");
  if (!probe || probe === "common_remove") {
    throw new Error("the catalogue did not register - t() is returning key names");
  }
  return {
    t: (k, p) => ctx.I18n.t(k, p),
    th: (k, p) => ctx.I18n.th(k, p),
    I18n: ctx.I18n,
    keyCount: typeof ctx.I18n.count === "function" ? ctx.I18n.count() : -1,
  };
}
