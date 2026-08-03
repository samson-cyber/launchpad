#!/usr/bin/env node
// Offline generator for the three Focus-session boundary chimes ([1.0.18 B-2]).
//
// The shipped /sounds/*.wav files are SYNTHESIZED HERE, from scratch, by summing
// decaying sinusoids — no sample libraries, no downloads, no third-party audio.
// That is the whole point: the assets are provably our own, so there is no
// licence to track and nothing in the package we cannot account for. This script
// is committed so the assets stay reproducible; re-running it must reproduce the
// same bytes (the synthesis is fully deterministic — no randomness anywhere).
//
// Usage: node tools/make-chimes.mjs [outDir]     (default outDir: <repo>/sounds)
//
// Format: 22050 Hz, mono, 16-bit PCM WAV. Chosen so each file lands around
// 55-70 KB — comfortably under the 100 KB budget — while staying well above
// Nyquist for the ~1 kHz partials these chimes actually use.

import fs from "node:fs";
import path from "node:path";

const SAMPLE_RATE = 22050;
const PEAK = 0.5;          // gentle: normalise every chime to half full-scale
const ATTACK_S = 0.006;    // short ramp-in per partial, kills the click on strike
const TAIL_FADE_S = 0.05;  // ramp the last 50 ms to zero, kills the click at EOF

// One struck partial: a sine at `freq`, starting at `at` seconds, whose amplitude
// decays exponentially with time-constant `tau`. Real struck bodies (bells, bars)
// are exactly this — a sum of exponentially-decaying modes — which is why a few
// of these read as "chime" rather than "beep".
function strike(buf, { at, freq, amp, tau }) {
  const start = Math.floor(at * SAMPLE_RATE);
  const attack = Math.max(1, Math.floor(ATTACK_S * SAMPLE_RATE));
  for (let i = start; i < buf.length; i++) {
    const t = (i - start) / SAMPLE_RATE;
    const decay = Math.exp(-t / tau);
    // Test the DECAY alone for the early-out. Testing the attack-multiplied
    // envelope would break on the very first sample, where the ramp is still 0 —
    // which silences every partial and renders an empty file.
    if (decay < 1e-5) break;                     // decayed below audibility
    const env = decay * Math.min(1, (i - start) / attack);
    buf[i] += amp * env * Math.sin(2 * Math.PI * freq * t);
  }
}

// Peak-normalise to PEAK, then fade the tail so the file cannot end mid-cycle.
function finish(buf) {
  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  const gain = peak > 0 ? PEAK / peak : 0;
  const fade = Math.floor(TAIL_FADE_S * SAMPLE_RATE);
  for (let i = 0; i < buf.length; i++) {
    const tail = i > buf.length - fade ? (buf.length - i) / fade : 1;
    buf[i] *= gain * tail;
  }
  return buf;
}

function toWav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    // Clamp before quantising: normalisation keeps us at 0.5, but a clamp here
    // means no future tweak to the recipes can silently wrap-around and buzz.
    const s = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(s * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);            // PCM fmt chunk size
  header.writeUInt16LE(1, 20);             // format = PCM
  header.writeUInt16LE(1, 22);             // channels = mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate (mono, 2 bytes/sample)
  header.writeUInt16LE(2, 32);             // block align
  header.writeUInt16LE(16, 34);            // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

function render(seconds, partials) {
  const buf = new Float64Array(Math.floor(seconds * SAMPLE_RATE));
  partials.forEach((p) => strike(buf, p));
  return finish(buf);
}

// --- the three recipes -------------------------------------------------------
// Deliberately distinct in CHARACTER, not just pitch, so they are tellable apart
// through a laptop speaker at low volume: two strikes / three strikes / one.
const CHIMES = {
  // Soft two-tone bell: E5 then B5, each with an inharmonic partial at 2.76x the
  // fundamental (the classic bell ratio) to give a struck-metal timbre.
  chime1: () => render(1.5, [
    { at: 0.00, freq: 659.25, amp: 1.00, tau: 0.50 },
    { at: 0.00, freq: 659.25 * 2.76, amp: 0.18, tau: 0.22 },
    { at: 0.00, freq: 659.25 * 2, amp: 0.22, tau: 0.30 },
    { at: 0.28, freq: 987.77, amp: 0.90, tau: 0.55 },
    { at: 0.28, freq: 987.77 * 2.76, amp: 0.14, tau: 0.20 },
    { at: 0.28, freq: 987.77 * 2, amp: 0.18, tau: 0.30 }
  ]),

  // Rising major triad: C5 - E5 - G5 in quick succession, near-pure tones with a
  // touch of octave. The last note rings longest so the phrase resolves upward.
  chime2: () => render(1.4, [
    { at: 0.00, freq: 523.25, amp: 0.85, tau: 0.30 },
    { at: 0.00, freq: 523.25 * 2, amp: 0.12, tau: 0.18 },
    { at: 0.13, freq: 659.25, amp: 0.90, tau: 0.32 },
    { at: 0.13, freq: 659.25 * 2, amp: 0.12, tau: 0.18 },
    { at: 0.26, freq: 783.99, amp: 1.00, tau: 0.62 },
    { at: 0.26, freq: 783.99 * 2, amp: 0.15, tau: 0.30 }
  ]),

  // Single warm tone: G4 with strong 2nd/3rd harmonics and a long decay. Lower
  // and rounder than the other two — the "quiet nudge" option.
  chime3: () => render(1.7, [
    { at: 0.00, freq: 392.00, amp: 1.00, tau: 0.85 },
    { at: 0.00, freq: 392.00 * 2, amp: 0.30, tau: 0.55 },
    { at: 0.00, freq: 392.00 * 3, amp: 0.10, tau: 0.32 }
  ])
};

const outDir = process.argv[2] || path.join(process.cwd(), "sounds");
fs.mkdirSync(outDir, { recursive: true });
for (const [name, build] of Object.entries(CHIMES)) {
  const wav = toWav(build());
  const file = path.join(outDir, name + ".wav");
  fs.writeFileSync(file, wav);
  console.log(`${name}.wav  ${(wav.length / 1024).toFixed(1)} KB  ${(wav.length - 44) / 2 / SAMPLE_RATE}s`);
}
