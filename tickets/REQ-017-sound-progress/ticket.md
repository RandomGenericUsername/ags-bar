---
id: REQ-017
title: "Sound panel progress tick: refreshPosition must reach the model and SeekLine"
kind: requirement
status: done
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-017/
branch: ticket/REQ-017-sound-progress
---

# Sound panel progress fix

- The visible panel refreshes the active seekable page even when its last
  projected playback flag is stale; the adapter's `player-changed` event must
  reach runtime players, the projection and `playingRows`.
- `SeekLine` locally advances between polls while actually playing, at 250 ms;
  it never advances while paused or while dragging. Poll updates reset the
  interpolation base.
- Polls still update the authoritative model; paused players return a static
  position.
- Keep drag/seek behavior and the `seeking` guard intact.
- Preserve round-five behavior and the skin; add regression tests, gates,
  releases, live timed captures.

## Live verification (2026-11-13)

- Final install: bar `v0.6.20`, assets `v0.21.3` (unchanged), platform
  `v1.2.0` (unchanged), engine `v0.1.81`, composition `v0.1.89`; runtime
  `1.5.3`.
- Real Chrome MPRIS player (title `Lost & Found`, duration 5:14), playing:
  timed screenshots without touching play/pause show `0:26` -> `0:41` over
  15 seconds on the same page. The model/debug position moved from ~26s to
  ~41s.
- Paused: `1:20` -> `1:20` over 5 seconds; the local tick is disabled while
  paused.
- Runtime/model regression test `audio-progress.test.mjs` verifies a
  `player-changed` position event reaches `runtime.current().players`, the
  projection and `playingRows`; pure interpolation test verifies playing,
  paused and duration cap.
- Drag/seek guard unchanged. No skin retune; no CSS max errors; no
  `surface.window` selector.
- Mock hash unchanged `1abcb074…`.

Screenshots:
- `/tmp/opencode/req005/r8-live-fixed-chrome-t0.png`
- `/tmp/opencode/req005/r8-live-fixed-chrome-t15.png`
- `/tmp/opencode/req005/r8-live-paused-t0.png`
- `/tmp/opencode/req005/r8-live-paused-t5.png`
