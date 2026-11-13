---
id: REQ-017
title: "Sound panel progress tick: refreshPosition must reach the model and SeekLine"
kind: requirement
status: in-progress
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
