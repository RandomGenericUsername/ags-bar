---
id: REQ-019
title: "Sound final correctness: Tidal suppression, first-click stability, bar-only deploy"
kind: requirement
status: in-progress
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-019/
branch: ticket/REQ-019-sound-final
---

# Sound final correctness

1. When a current native Tidal MPRIS player exists, suppress its Electron /
   Chromium mirror entirely, even if the mirror carries a stale different
   track. Do not suppress genuine Chrome multi-tab media.
2. Stabilize the selected Playing page across model updates by keying the page
   by id; verify pause/play and page switching dispatch on the first click.
   Reduce redundant panel fitting: fit only on layout-affecting state changes,
   not every 1 s position poll. Keep the 250 ms local progress interpolation.
3. Preserve and validate the same-PID two-Chrome sink-input case; the model
   must keep both node/serial stream IDs and the Mixer must render two rows.
4. Bar-only live deploy: build/stage the bar tag under
   `~/.local/share/dotfiles/apps/bar/<tag>`, repoint `~/.config/ags`, restart
   AGS. Do not run bootstrap/provision or change assets/platform/engine/
   composition tags. No skin retune; no `surface.window`.

## Additional canonical Tidal pass

Live still had a native Tidal + native-style duplicate (the Electron/Chromium
transport was already suppressed). Tidal now collapses to one canonical current
page across all Tidal transports: prefer native, then non-ended current media.
Chrome remains multi-tab/per-player.

## Selected-page stability

The selected app id is retained alongside the player id. If a canonical Tidal
player id changes after a transport action, the page remains on Tidal instead
of reverting to the first page. Carousel and tray selections record the app id.
