---
id: REQ-018
title: "Sound stream identity and Chrome MPRIS player join"
kind: requirement
status: in-progress
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
