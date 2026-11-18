---
id: REQ-027
title: "Transport row: fixed left/center/right zones"
kind: requirement
status: in-progress
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-027/
branch: ticket/REQ-027-transport-zones
---

# Transport row fixed zones

> Stable v0.6.33 line. Bar-only; no per-channel/Mixer, selection, clock or skin
> change. Do not switch/restart the live service.

## Fix

Pin the shared `TransportRow` into three zones:
- **left:** shuffle;
- **center:** previous / play-pause / next, at fixed positions;
- **right:** repeat.

Capability hiding is preserved (the button is hidden when unsupported), but
every slot keeps its width, so the center controls do not shift when shuffle or
repeat appears/disappears (including when switching players). The center slots
are fixed too, so play-pause stays centered even if previous/next are
unavailable. Compact (strip) and full (panel/tray) sizes are unchanged.

Implement with a pure `transportZones(surface, capabilities)` helper returning
five fixed-width slots + visibility; the GTK row renders three zone boxes with
fixed-width slot wrappers. Surface widths: panel 24/34, tray 30/36, strip 26/30
(side/play), matching the existing app CSS min-widths. No skin change; app CSS
is not touched except if needed for the wrappers (prefer widthRequest from the
helper).

## Tests

- `tests/ts/transport-zones.test.ts`: a player with both shuffle/repeat vs none
  yields identical zone/slot widths and positions on panel, tray and strip;
  visibility follows capability; order is left/center/right.
- `tests/validation/audio-transport-zones.test.mjs`: the shared TransportRow
  renders the zone/slot wrappers and hidden-capability slots; the three call
  sites pass the right surface; the helper widths match the app CSS column
  widths; no Mixer/per-channel change.
- Bar gates; stage `apps/bar/v0.6.34`; no live switch/restart.

## Implementation record (2026-11-17)

Commit: `1f686b6` feat(REQ-027): pin transport controls into fixed
left/center/right zones.

### What changed

- `audio/presentation/transport-zones.ts` (new): `transportZones(surface,
  capabilities)` returns `left` (shuffle), `center` (previous/play/next) and
  `right` (repeat), each with a fixed width and a capability-driven `visible`.
  Widths: panel 24/34, tray 30/36, strip 26/30 (side/play), matching the app CSS.
- `audio/ui/controls.tsx` `TransportRow`: new `surface` prop; three zone boxes
  with always-present `audio-transport-slot` wrappers (`widthRequest`), the
  center group, and capability-gated icons. Dispatch still captures the page's
  own `playerId`; no selection state read.
- Call sites pass `surface="panel"` / `"tray"` / `"strip"`; no CSS/skin change.
- Mixer/per-channel, selection, clock, transport actions and labels untouched.

### Gates

```text
$ make test
tests/ts:          194 tests 194 pass 0 fail
tests/validation:   45 tests  45 pass 0 fail
symbol check:      SYMBOL CHECK OK
test tsc:          0 type errors   (exit 0)
$ make typecheck   OK: 0 errors in the ags-bar tree
$ make bundle      OK: build/ags-bar.js (3099312 bytes)
$ make conformance exit 0
$ make drift       exit 0
```

New tests:
- `tests/ts/transport-zones.test.ts` (8): panel/tray/strip geometry identical
  with shuffle+repeat vs none (widths and cumulative positions), surface width
  constants, icon-only hiding, play slot centered between fixed sides.
- `tests/validation/audio-transport-zones.test.mjs` (4): zone/slot wrappers,
  capability-gated icons, surface selection in all three callers, geometry
  constants match the CSS button min-widths, Mixer/per-channel untouched.
- `audio-panel-render`: the capability-gating check now follows the zoned
  visibility (same contract, new implementation).

### Offline / staged verification

- Staged `~/.local/share/dotfiles/apps/bar/v0.6.34` from HEAD; no pointer
  switch or service restart.
- Staged tests: transport-zones TS 8/8, validation 4/4; the full gates above
  were run in the worktree.
- Staged source: three zone wrappers present, no `mixerRows`; live links remain
  `apps/bar/v0.6.33` and the service was not restarted.

### Owner test plan (when ready)

1. Both live links point at `apps/bar/v0.6.33`.
2. `ln -sfn ~/.local/share/dotfiles/apps/bar/v0.6.34 ~/.config/ags`
   `ln -sfn ~/.local/share/dotfiles/apps/bar/v0.6.34 ~/.local/share/dotfiles/config/ags`
   `systemctl --user restart dotfiles-ags-bar.service`
3. Play a player with shuffle/repeat (e.g. Tidal) then one without (Chrome):
   the play-pause button stays in the same screen position; the side icons
   disappear without moving the center. Check both the bar strip and the
   panel/tray.
4. First click on play/previous/next/shuffle/repeat still acts on the visible
   page; capability-hidden actions remain hidden.
5. Rollback to `apps/bar/v0.6.33` and restart.
