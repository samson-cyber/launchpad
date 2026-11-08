# tools/promo - product footage for the store video

Instruments, not gates: `build.sh` runs none of these. They need a browser and
take minutes. Added 2026-11-08 (DP5) for the promo video.

Run them in this order. `<pkg>` is an UNPACKED build of the zip, never the
working tree, so the footage shows what ships.

1. `node --experimental-websocket tools/promo/record.mjs <repo> <pkg> <out> <port>`
   records one take of the five shots: Home (drag + Open All), Tasks (tick),
   Focus (Start task + Dashboard ring), blocked site, Insights. Each shot goes
   through real controls in a fresh scratch profile, on the store fixture with
   `{ wallpaper: "default", distinctTagColors: true }`. The output per shot is
   screencast JPEGs plus `index.json`, which holds the frame times and the
   pointer path on one clock.
2. `node tools/promo/score.mjs <takes-dir> t2 t3 t4` scores the takes by
   stutter inside frame bursts. A still screen sends no frames, so long gaps
   are not stutter. It writes `best.json`.
3. `node --experimental-websocket tools/promo/render.mjs <repo> <pkg> <spec.json> <out.webm>`
   renders a spec of clips OFFLINE through `compositor.html`: every frame is
   drawn, encoded with WebCodecs VP9 at an exact timestamp, and muxed by
   `webm-muxer` into a seekable WebM. It draws the cursor, and the dragged
   tile while a drag is held. Real-time MediaRecorder rendering dropped about
   15% of frames and wrote an unseekable file, which is why this is offline.
4. `node --experimental-websocket tools/promo/verify-video.mjs <repo> <pkg> <file.webm> <outdir> <secs>`
   plays the result and measures every presented frame. It grabs stills as
   playback crosses the given seconds, because headless seeking proved
   unreliable even with Range support.

Traps met building them:
- A screencast frame is the CSS viewport size. An emulated device pixel ratio
  does not raise it, so the frames are 1920 x 1080.
- Chrome paints a native drag image outside the page. The compositor crops
  the tile from the frame before the press instead.
- "Start task" (the row's play button) starts the focus session. The tab
  bar's circled number is the due-work bell, not focus.
- A tip toast ("Right-click any webpage...") can appear mid-shot.
  `record.mjs` dismisses it before each shot.

## The narrated cut (added 2026-11-08, DP7)

The 52 s store video is built from these files, in this order. `<work>` is a scratch folder. `cards.html` needs `fonts/figtree-latin.woff2`, `default.webp`, `shots/` (the five review frames) and `end-bg.jpg` beside it. The compositor needs `fonts/` beside it.

1. `narration-segments.mjs <repo> <pkg> <take.mp3> [gapMs]` finds a take's pauses (280 ms for lines, 90 ms for the commas inside one). Every cue below comes from these measured times, not estimates.
2. `record-cut.mjs <repo> <pkg> <out> <port>` records the five shots cued to the narration. Every action waits on an ABSOLUTE time (`rec.at(ms)`), and every move is TIME-BASED (position from elapsed time), because step-counted moves ran about twice as long as asked and pushed each later cue late. Insights is recorded FIRST: Open All in the Home shot loads five real sites, and the tracker logs them as an "Untagged" row.
3. `extract-frames.mjs` turns the opening MP4 into a frame folder plus its last frame (the end card's background). The Eromify clip came back 3:2 even when asked for 16:9, and the compositor cover-fits any source.
4. `render-cards.mjs ... --video cues.json` renders the comparison card and the six captioned store frames. `render-layers.mjs` renders the transparent wordmark and the end card. `card-contrast.py <out>` measures every text run against the real ground behind it. Run it with the ftenv venv's Python, `-I`.
5. `mix.mjs` mixes voice over music (voice at 0.6 s, music 10 dB under speech). `music-measure.mjs` measures a music take's build and ending.
6. `render.mjs <repo> <pkg> spec.json out.webm` renders the cut offline: clips with crop, speed and crossfade, the wordmark overlay, captions in Figtree, and the mix encoded to Opus. It writes `<out>.captions.json` with what was actually drawn.
7. `verify-audio.mjs` proves the audio track is whole and in sync: length, level, and the envelope lag against the mix, which must be 0 ms. `verify-video.mjs` measures playback and grabs stills.

Traps met in this round:
- `Page.captureScreenshot` keeps an alpha channel only when the page's ROOT element is transparent too, not just the body.
- A text box for contrast must be the text RUN's own range. A whole cell includes its dot, border and rounded corners, and fails on pixels no letter sits on.
