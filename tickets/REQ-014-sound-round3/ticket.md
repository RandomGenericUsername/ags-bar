---
id: REQ-014
title: "Sound panel feedback round 3: footer, labels, switch"
kind: requirement
status: in-progress
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-014/
branch: ticket/REQ-014-sound-round3
---

# Sound panel feedback round 3

1. Remove the panel footer copy (`Changes apply immediately.` / `Esc closes`)
   and the settings footer (`Changes save immediately.`) from code, mock and
   ticket; no footer element/rule remains and the panel height collapses.
2. Output and Input use `.audio-section-label` with the same size, weight,
   ink, casing and start alignment; positions/roles are unchanged.
3. The settings switch is fixed to the compact 42x24 track / 20px knob, so
   the skin pill paint cannot inflate it; verify terminal-host and glass.
4. Update mock/ticket/hash; bar/assets/engine/composition releases; live
   verification. No skin retune, no `surface.window`.
