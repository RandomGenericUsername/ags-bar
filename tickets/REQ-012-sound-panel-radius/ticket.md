---
id: REQ-012
title: "Sound panel feedback round 1: muted value and spawned-window radius"
kind: requirement
status: in-progress
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-012/
branch: ticket/REQ-012-sound-panel-radius
---

# Sound panel feedback round 1

1. **Dim the big output value when muted.** Add the mock's muted marker to the
   hero and apply `opacity: .42` to `.audio-big-value` only; no layout shift.
2. **Mixer row media artwork:** accepted; no change.
3. **361 px measured width:** accepted; no change.
4. **Remove the dead `.audio-hero-note` selector** from the assets `ags`
   target (text/element already gone).
5. **Spawned settings/tray outer radius.** Reset the outer layer window and
   settings popover to transparent, borderless, radius 0, no shadow; the inner
   `.audio-settings`/`.tray-surface` skin surface owns `surface.panel`
   radius/border/shadow. Remove hard-coded outer radius.
   Verify terminal-host + glass and a changed Hyprland host radius: settings,
   tray and the Playing card all follow the same generated skin/host radius.

No skin retune; the configured skin remains terminal-host. No AGS overlay uses
`surface.window`.
