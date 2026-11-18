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
