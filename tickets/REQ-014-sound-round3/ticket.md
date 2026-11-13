---
id: REQ-014
title: "Sound panel feedback round 3: footer, labels, switch"
kind: requirement
status: done
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


## Live verification (2026-11-12)

- Released and installed: bar `v0.6.16`, assets `v0.21.2`, platform
  `v1.2.0` (unchanged), engine `v0.1.77`, composition `v0.1.85`.
- Panel footer and settings footer are absent; normal panel `rootHeight=423`
  (short playing row) and 476 (full row), Input expanded `626`, collapsed
  `476`, reopened `476`; no dead footer strip.
- Output/Input both render `.audio-section-label` (same size/ink/alignment);
  Output image y=61 and Input image y=459 in the terminal-host capture.
- Settings switch is 42x24 with a 20px knob (`widthRequest`/`heightRequest`
  42/24, CSS max 42/24, padding 0); terminal-host live capture; glass/paper
  live panels use the same fixed widget and their template `.audio-switch`
  paint only adds border/radius/background (assets expansion gates pass), so
  the skin cannot inflate it.
- No skin retune; live skin restored to `terminal-host`; no `surface.window`
  selector in the generated appearance.
