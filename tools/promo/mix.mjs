// Draft mix: the narration over the music, voice 0.6 s in, the music ducked
// 10 dB under speech with 120 ms attack and 400 ms release, rendered offline in
// Edge to a 48 kHz stereo 16-bit WAV. Reports the mix's peak and loudness so
// a clipping mix cannot pass as done.
//   node --experimental-websocket mix.mjs <repo> <pkg> <voice.mp3> <music.mp3> <out.wav>
import fs from "node:fs";
import path from "node:path";
import { launch } from "./lib.mjs";
const [REPO, PKG, VOICE, MUSIC, OUT] = process.argv.slice(2);
const b = await launch({ repo: REPO, ext: PKG, port: 9883, profile: path.join(REPO, ".scratch-profile-mix"), dpr: 1 });
try {
  const tab = await b.open("about:blank");
  const v64 = fs.readFileSync(VOICE).toString("base64"), m64 = fs.readFileSync(MUSIC).toString("base64");
  const r = await tab.ev(`(async () => {
    const dec = async (b64) => new OfflineAudioContext(2, 1, 48000).decodeAudioData(Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer);
    const voice = await dec(${JSON.stringify(v64)}), music = await dec(${JSON.stringify(m64)});
    const SR = 48000, LEAD = 0.6, dur = Math.max(music.duration, LEAD + voice.duration + 1.0);
    const ctx = new OfflineAudioContext(2, Math.ceil(dur * SR), SR);
    // Speech envelope from the voice itself (20 ms RMS), to drive the duck.
    const vd = voice.getChannelData(0), W = Math.round(voice.sampleRate * 0.02), on = [];
    let vpk = 0; for (const x of vd) vpk = Math.max(vpk, Math.abs(x));
    for (let i = 0; i + W <= vd.length; i += W) { let e = 0; for (let k = 0; k < W; k++) e += vd[i + k] * vd[i + k]; on.push(Math.sqrt(e / W) > vpk * 0.0079); }
    const ms = ctx.createBufferSource(); ms.buffer = music;
    const duck = ctx.createGain(), mg = ctx.createGain(); mg.gain.value = 0.62;
    const DUCK = Math.pow(10, -10 / 20);
    duck.gain.setValueAtTime(1, 0);
    let state = false;
    for (let i = 0; i < on.length; i++) {
      // Hold the duck across short gaps (< 400 ms) so it does not pump between words.
      let speaking = on[i]; if (!speaking) { for (let j = 1; j <= 20 && i + j < on.length; j++) if (on[i + j]) { speaking = true; break; } }
      if (speaking !== state) {
        const t = LEAD + i * 0.02;
        duck.gain.setTargetAtTime(speaking ? DUCK : 1, speaking ? Math.max(0, t - 0.12) : t, speaking ? 0.04 : 0.13);
        state = speaking;
      }
    }
    ms.connect(mg).connect(duck).connect(ctx.destination); ms.start(0);
    const vs = ctx.createBufferSource(); vs.buffer = voice; const vg = ctx.createGain(); vg.gain.value = 1.0;
    vs.connect(vg).connect(ctx.destination); vs.start(LEAD);
    const out = await ctx.startRendering();
    let pk = 0, sq = 0; const L = out.getChannelData(0), R = out.getChannelData(1);
    for (let i = 0; i < out.length; i++) { pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); sq += L[i] * L[i] + R[i] * R[i]; }
    // Normalise the mix peak to -1 dBFS, then write 16-bit stereo PCM.
    const g = Math.pow(10, -1 / 20) / pk, n = out.length, buf = new DataView(new ArrayBuffer(44 + n * 4));
    const w = (o, s) => { for (let i = 0; i < s.length; i++) buf.setUint8(o + i, s.charCodeAt(i)); };
    w(0, "RIFF"); buf.setUint32(4, 36 + n * 4, true); w(8, "WAVE"); w(12, "fmt "); buf.setUint32(16, 16, true); buf.setUint16(20, 1, true); buf.setUint16(22, 2, true);
    buf.setUint32(24, SR, true); buf.setUint32(28, SR * 4, true); buf.setUint16(32, 4, true); buf.setUint16(34, 16, true); w(36, "data"); buf.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) { buf.setInt16(44 + i * 4, Math.max(-32768, Math.min(32767, Math.round(L[i] * g * 32767))), true); buf.setInt16(46 + i * 4, Math.max(-32768, Math.min(32767, Math.round(R[i] * g * 32767))), true); }
    const u8 = new Uint8Array(buf.buffer); let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return { b64: btoa(s), secs: +(n / SR).toFixed(2), rawPeakDb: +(20 * Math.log10(pk)).toFixed(1), rmsAfterNormDb: +(10 * Math.log10(sq / (2 * n)) + 20 * Math.log10(g)).toFixed(1) };
  })()`, 180000);
  fs.writeFileSync(OUT, Buffer.from(r.b64, "base64"));
  console.log(JSON.stringify({ out: path.basename(OUT), bytes: fs.statSync(OUT).size, secs: r.secs, rawPeakDb: r.rawPeakDb, rmsAfterNormDb: r.rmsAfterNormDb }));
} finally { await b.close(); }
process.exit(0);
