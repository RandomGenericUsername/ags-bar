---
id: REQ-018
title: "Sound stream identity and Chrome MPRIS player join"
kind: requirement
status: done
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-018/
branch: ticket/REQ-018-sound-stream-join
---

# Sound stream identity and player join

1. Keep every distinct PipeWire sink-input. Union AstalWp `wp.nodes` with
   `pw-dump` graph streams so a graph-only node is not dropped when the same
   app/PID/media already has another node. Stream identity remains
   `pipewire:<node>:<serial>`; the app row exposes every stream ID.
2. Preserve independent per-stream volume/mute; graph-only streams fall back
   to `wpctl` for volume/mute.
3. Populate the app row `playerId`/`playerIds` from the current MPRIS player
   and expose them in the debug dump. Add a regression test for
   `hasCurrentPlayer=true => playerId`.
4. Preserve v0.6.20 progress interpolation/pause behavior and the skin.


## Live verification (2026-11-13)

- Final install: bar `v0.6.21`, assets `v0.21.3` (unchanged), platform
  `v1.2.0` (unchanged), engine `v0.1.82`, composition `v0.1.90`; runtime
  `1.5.3`.
- The live model kept both Google Chrome sink-inputs:
  `pipewire:80:143927` and `pipewire:95:150527`; the app row
  `google-chrome` had `playerId =
  org.mpris.MediaPlayer2.chromium.instance6837#1`.
- Mixer showed the Chrome app row with `2 PipeWire streams` and two independent
  `Playback` rows (volume/mute/route), plus Tidal.
- With the two streams present, the Chrome Playing page advanced
  `1:13` -> `1:28` over 15 seconds without interaction; pausing held `0:20`
  for 5 seconds.
- Progress v0.6.20 behavior and the skin are unchanged.

Live provenance/limitation: the existing Chrome exposed one sink-input in this
session; the second live Chrome sink-input was a local `probe.html` page in a
second Chrome process. Therefore the live pair had different PIDs. The
same-app/same-PID two-node case (the reported node 80/node 48 shape) is covered
by `tests/validation/pipewire-adapter.test.mjs` with two nodes and PID 777.
Chrome can still mix tabs into one sink-input inside one process; this UI never
invents per-tab streams.

Screenshots:
- `/tmp/opencode/req005/r9-live-mixer-two-chrome.png`
- `/tmp/opencode/req005/r9-live-progress-two-streams-t0.png`
- `/tmp/opencode/req005/r9-live-progress-two-streams-t15.png`
- `/tmp/opencode/req005/r9-live-paused-two-streams-t0.png`
- `/tmp/opencode/req005/r9-live-paused-two-streams-t5.png`
