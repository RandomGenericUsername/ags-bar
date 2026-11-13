---
id: REQ-016
title: "Sound panel round five: per-player dedupe and per-stream Mixer"
kind: requirement
status: in-progress
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
