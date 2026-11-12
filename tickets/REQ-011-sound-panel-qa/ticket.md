---
id: REQ-011
title: "Sound panel QA: single surfaces, honest controls, live position"
kind: requirement
status: in-progress
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-011/
branch: ticket/REQ-011-sound-panel-qa
---

# Sound panel QA

Owner QA on the live REQ-005 panel. Fix in the bar, the mock/ticket and the
skin target; do not retune the skin (terminal-host stays configured).

1. Settings popover is one skin surface: reset the native popover chrome and
   paint only `.audio-settings` (panel role); it stays a sibling `Gtk.Popover`.
2. Output header: gear (gear glyph, opens settings), mute, device row, 28 px
   value/slider; the muted state is the small mock pill.
3. Remove the `Muted — the level is kept.` note from code and mock.
4. Remove per-row play/pause from Mixer (levels/routing only).
5. Playing page: track thumbnail/album art with a small app badge/fallback;
   capability-gated shuffle/loop; prefer the player that exposes the controls
   when playback rank ties (Tidal native vs its Chromium mirror); videos hide
   shuffle/loop.
6. Poll MPRIS `Position` while the panel is visible; update seek/time; drag
   still seeks.
7. Size the panel to its content/footer (measure the body, cap/scroll) — no
   fixed dead space.
8. Icon-only buttons are bare: no `surface.control` paint around gear, mute,
   transport, carousel or the read-only level; device/route fields and sliders
   stay painted.

Also: update the mock/hash and the REQ-005 ticket, assets `ags.gtk.css.j2`
mapping/tests, then release bar/assets/engine/composition and install live.
