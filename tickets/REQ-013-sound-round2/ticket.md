---
id: REQ-013
title: "Sound panel feedback round 2: fit, owner icons, strip and tray"
kind: requirement
status: in-progress
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-013/
branch: ticket/REQ-013-sound-round2
---

# Sound panel feedback round 2

1. Input collapse refits the panel after the revealer settles; no dead height.
2. Owner icon art integrated through assets/platform: `media-controls`
   (shuffle, shuffle-active, repeat, repeat-once, repeat-off) and the
   `settings`/`settings-panel` gear; text glyphs removed; capability hiding
   preserved.
3. Bar media strip: 32px track thumbnail, no tile fill, text uses available
   width.
4. Tray: transport centered and larger.
5. Mock/ticket/hash updated; bar/assets/platform/engine/composition cutover;
   live terminal-host verification; no skin retune, no `surface.window`.
