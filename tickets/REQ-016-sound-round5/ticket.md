---
id: REQ-016
title: "Sound panel round five: per-player dedupe and per-stream Mixer"
kind: requirement
status: done
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-016/
branch: ticket/REQ-016-sound-round5
---

# Sound panel round five

1. Dedupe Playing pages and Players rows by app identity + media track identity
   (title/artist/album; native owner wins a same-track tie). Tidal native and
   Electron are one canonical Tidal page/row; distinct media of one app (Chrome
   WhatsApp vs YouTube) stays separate.
2. Exclude `PlaybackStatus=Stopped` and no-media players from Playing/Players.
   Keep paused-with-media. `Live` only when playback is actually playing.
3. Add per-stream Mixer detail from PipeWire output streams under the app-level
   rows: stream name, volume, mute, route, level. Keep app controls. If a
   browser exposes one stream, state that per-tab splitting is unavailable; if
   it exposes several, show each. Playing remains MPRIS-only; audio-only
   streams never invent metadata.
4. Update mock/ticket/hash, gates, releases, live verification under
   terminal-host and one other skin. No skin retune.


## Live verification (2026-11-13)

- Final tags installed: bar `v0.6.19`, assets `v0.21.3` (unchanged),
  platform `v1.2.0` (unchanged), engine `v0.1.80`, composition `v0.1.88`;
  runtime `1.5.3`.
- The live post-cutover session exposed only a stopped Google Chrome MPRIS
  player. It correctly did **not** appear as a Playing page or Players row;
  the panel opened in Mixer with the Chrome app row.
- Under glass, Chrome exposed one PipeWire stream; the Mixer showed the app row
  and `One PipeWire stream · per-tab split unavailable`. It did not invent a
  per-tab row. The skin was restored to terminal-host.
- The mock shows the same-app two-stream Chrome case (WhatsApp Web and YouTube)
  with per-stream route/mute/level rows, and only one canonical Tidal page.
- Tidal native/Electron dedupe and stopped/no-media exclusion are covered by
  the view-model tests; the live session had no Tidal/Firefox players after
  cutover, so those two cases could not be exercised live.
- No skin retune; no CSS max-width/height errors; no `surface.window` selector.
- Mock hash `1abcb074…`.
- Limitation: live Chrome exposed one PipeWire stream, not two; the two-stream
  rows are mock/unit verified. A browser mixing tabs into one stream cannot be
  split by this UI.

Screenshots:
- `/tmp/opencode/req005/r7-live-mixer-stopped-chrome.png`
- `/tmp/opencode/req005/r7-live-glass-mixer.png`
- `/tmp/opencode/req005/r7-mock-tidal.png`
- `/tmp/opencode/req005/r7-mock-mixer.png`
