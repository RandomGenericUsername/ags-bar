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

## Implementation record (2026-11-17)

Commits on `ticket/REQ-025-display-clock` (base tag `v0.6.16`):

- `ac444ee` docs(REQ-025): spec the display-only position clock
- `4c4fc9d` feat(REQ-025): display-only position clock, no MPRIS poll

### What changed

- `audio/domain/audio-model.ts`: `AudioPlayer.positionSyncedAtMs?` (monotonic
  snapshot time).
- `audio/adapters/mpris/mpris-adapter.ts`: `toPlayer` carries the snapshot;
  a `PlaybackStatus` transition extrapolates the stored position to the event
  instant (`interpolatePosition`, local) before changing state, so pause
  freezes at the right time and play resumes from it. No read is added.
- `audio/presentation/audio-panel-view-model.ts`: `positionSyncedAtMs` on
  `AudioAppRowView` (chosen player's snapshot).
- `audio/presentation/display-clock.ts` (new): pure
  `displayPositionUs(snapshot, nowMs)` using the reference
  `interpolatePosition`; unknown snapshot time → raw position; `clampPositionUs`.
- `audio/ui/controls.tsx` `SeekLine`: new `positionSyncedAtMs` + `playing`;
  rebases on every authoritative snapshot and shows the extrapolated value
  immediately; local 250 ms `GLib.timeout_add` render tick; drag/commit resets
  the base. No MPRIS read.
- `audio/AudioPopup.tsx`: removed the 1 s `refreshPosition` poll (and the
  `onCleanup` import); passes snapshot + playback to `SeekLine`.
- `audio/TrayPopup.tsx`: passes snapshot + playback; the local clock advances
  while the tray is open.
- No Mixer/per-channel, `panel-state`, transport or skin change.

### Gates

```text
$ make test
tests/ts:          186 tests 186 pass 0 fail
tests/validation:   36 tests  36 pass 0 fail
symbol check:      SYMBOL CHECK OK
test tsc:          0 type errors   (exit 0)
$ make typecheck   OK: 0 errors in the ags-bar tree
$ make bundle      OK: build/ags-bar.js (3088260 bytes)
$ make conformance exit 0
$ make drift       exit 0
```

New/updated tests:
- `tests/ts/display-clock.test.ts` (7): stale snapshot advances; paused static;
  page switch shows each player's current position immediately; seek rebases;
  backwards/unknown snapshot clamps; duration clamp; projection carries the
  snapshot.
- `tests/validation/audio-display-clock.test.mjs` (6): no panel/tray
  `refreshPosition` or 1 s poll; SeekLine uses the display clock + only a
  250 ms tick; panel/tray pass snapshot + playback; adapter carries/freeze
  behavior; app-level Mixer untouched.
- `tests/validation/audio-panel-render.test.mjs`: the old "panel poll" check
  becomes "display clock, not a periodic MPRIS poll" (contract change).

### Offline / staged verification

- Staged `~/.local/share/dotfiles/apps/bar/v0.6.32` from HEAD; no pointer
  switch or service restart.
- Staged-tree probe: a Tidal snapshot at 0:34 read 5 s ago displays 0:39 at the
  switch; paused shows 0:34; a seek at now shows the target; the projection row
  carries the snapshot time.
- Staged source has no `refreshPosition`/1 s poll in the panel or tray; no
  `mixerRows`.
- No staged AGS launch (duplicate bar windows would disturb the live desktop).

### Owner test plan (when ready)

1. Both live links point at `apps/bar/v0.6.16`.
2. `ln -sfn ~/.local/share/dotfiles/apps/bar/v0.6.32 ~/.config/ags`
   `ln -sfn ~/.local/share/dotfiles/apps/bar/v0.6.32 ~/.local/share/dotfiles/config/ags`
   `systemctl --user restart dotfiles-ags-bar.service`
3. Firefox in Playing: the time advances smoothly every 250 ms without any
   interaction; pause holds; seek jumps and continues from the new point.
4. Switch Tidal → Chrome → Tidal after leaving Tidal playing in the background:
   the Tidal page immediately shows its current position (no 0:34 frame);
   selection stays.
5. Confirm the panel/tray make no periodic MPRIS reads (no repeated
   `refreshPosition` in the logs); the app-level Mixer is unchanged.
6. Rollback: point both links at `apps/bar/v0.6.16` and restart.
