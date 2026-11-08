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
