---
id: REQ-025
title: "Display-only position clock (no MPRIS poll)"
kind: requirement
status: in-progress
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-025/
branch: ticket/REQ-025-display-clock
---

# Display-only position clock

> Stable v0.6.16 line. Owner decision locked: focused-tab playback +
> app-level Mixer, no per-channel. No skin/assets/full provision. Bar-only
> staging; do not switch/restart the live service.

## Goal

Remove the periodic MPRIS Position poll and fix the stale page-switch flash with
a **local, display-only clock** built from the adapter's authoritative snapshot
(`positionUs`, `positionSyncedAtMs`, playback state), using the old
`services/mpris-core.ts` `interpolatePosition` (invariant I1) as the reference.

- While playing, the displayed position advances locally from the snapshot +
  monotonic elapsed time on a local render tick. No D-Bus/MPRIS reads.
- On page switch, compute the displayed position from that player's stored
  snapshot immediately (`base + elapsed`), so there is no old-value frame.
- Paused freezes. Seek/drag resets the clock to the new position. The player's
  `Seeked`/playback events remain the authoritative corrections.
- No recurring `refreshPosition`/MPRIS reads. No one-time correction read is
  needed: the snapshot timestamp already covers time spent deselected.
- Firefox progress advances via the clock; no poll.
- No Mixer/per-channel, panel-selection, transport or skin change.

## Implementation

- `AudioPlayer.positionSyncedAtMs?` (monotonic ms) and
  `AudioAppRowView.positionSyncedAtMs` (chosen player's snapshot).
- `MprisAdapter.toPlayer` carries `positionSyncedAtMs`; on a `PlaybackStatus`
  transition the adapter extrapolates the stored position to the event time
  before changing state, so a pause freezes at the correct time and a play
  starts from it. `fromProps`/`Seeked`/refresh keep setting a fresh snapshot.
- `audio/presentation/display-clock.ts`: pure `displayPositionUs(snapshot,
  nowMs)` using `interpolatePosition`; missing timestamp → raw position.
- `SeekLine` gains `positionSyncedAtMs` + `playing`, computes the display from
  the snapshot immediately on every rebase, and advances it on a 250 ms local
  `GLib.timeout_add` (render tick only). Drag/commit resets the base.
- Remove the `AudioPopup` 1 s Position poll (and any `refreshPosition` UI call).
  Panel and tray pass the snapshot + playback to `SeekLine`.

## Tests

- `tests/ts/display-clock.test.ts`: stale snapshot advances; paused static;
  switch computes each player's current position immediately; seek reset;
  backward clock clamps; the projection carries the snapshot timestamp.
- `tests/validation/audio-display-clock.test.mjs`: no panel poll/refreshPosition
  timer; `SeekLine` has only the 250 ms local tick, not a D-Bus read; panel and
  tray pass `positionSyncedAtMs`/`playing`; no skin change.
- Bar gates; stage `apps/bar/v0.6.32`; no live switch/restart.

## Verify

Offline model/source tests + staged-artifact probe (stale snapshot advances,
switch immediate, pause static). No staged AGS launch (duplicate windows).
Owner test plan: Firefox progress, Tidal → Chrome → Tidal switch, pause/seek,
long title unaffected; rollback to v0.6.16.
