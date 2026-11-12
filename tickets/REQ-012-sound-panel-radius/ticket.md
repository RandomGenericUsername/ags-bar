---
id: REQ-012
title: "Sound panel feedback round 1: muted value and spawned-window radius"
kind: requirement
status: done
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

## Live verification (2026-11-12)

Final tags installed: bar **v0.6.9**, assets **v0.20.2**, engine
**v0.1.70**, composition **v0.1.78**. Live verify `ok=337 failed=0`; configured
skin `terminal-host` dark; host `decoration:rounding` **0** at the end.

### Current host radius (0)

Generation `028c27636174...` (terminal-host/dark), generated
`.audio-settings`/`.tray-surface`/`.audio-playing-page` radius **0px**. The
outer layer windows/popover are square; only the skin surface is visible.

- `/tmp/opencode/req005/r2-final-host0-muted-clean.png` (dimmed big value)
- `/tmp/opencode/req005/r2-final-host0-settings.png` (square settings)
- `/tmp/opencode/req005/r2-final-host0-tray-clean.png` (square tray)

### Changed host radius (14)

Temporarily set `hyprland-gui.lua` `rounding = 14`, reloaded Hyprland; the
runtime host watch committed generation `0b846fc680a9` with settings/tray/card
radius **14px**. The outer containers stayed transparent/borderless/square.

- `/tmp/opencode/req005/r2-host14-card.png`
- `/tmp/opencode/req005/r2-host14-settings.png`
- `/tmp/opencode/req005/r2-host14-tray.png`

### Other skin (glass) at host 14

Temporary desired skin `glass`; generation `35cb860757b9` (glass/dark) with
settings/tray/card radius **14px** and glass paint.

- `/tmp/opencode/req005/r2-glass14-card.png`
- `/tmp/opencode/req005/r2-glass14-settings.png`
- `/tmp/opencode/req005/r2-glass14-tray2.png`

Restored `terminal-host` + host 0 (generation `028c...`) after capture. No
skin retune; the config and desired intent are back to the owner's settings.
The mock already had the muted `opacity: .42`; no mock/hash change was needed.
