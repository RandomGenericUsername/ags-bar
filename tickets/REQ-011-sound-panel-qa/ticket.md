---
id: REQ-011
title: "Sound panel QA: single surfaces, honest controls, live position"
kind: requirement
status: done
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

## Release

- Bar `v0.6.5` (QA implementation) and `v0.6.6` (artwork-cache mkdir guard +
  header alignment); worktree `.worktrees/REQ-011/`, branch
  `ticket/REQ-011-sound-panel-qa`.
- Assets `v0.20.1` (bare icon-only mapping, thumbnail styles); engine
  `v0.1.66`/`v0.1.67`; composition `v0.1.74`/`v0.1.75`.
- Bar gates: `make gates` PASS (179 + 28 tests, conformance 14, drift, bundle,
  typecheck 0). Assets: `validate-skins` PASS, `test-skins` 182 passed / 3
  skipped. Engine: `gates-pin`, `assets-parity`, `build` PASS. Composition:
  `make gates-ci` PASS.
- Live: installed from `.worktrees/REQ-117` with bar v0.6.6, assets v0.20.1,
  engine v0.1.67; terminal-host generation; verify `ok=337 failed=0`.

## Final live release (v0.6.7)

The follow-up installs were needed because the first live probe found two
composition-level bugs: Gio's `make_directory_with_parents()` threw
`File exists` for the prepared artwork cache (v0.6.6), and the artwork overlay
mapped only `model.rows`, not the `playingRows` the Playing deck renders
(v0.6.7).

- Bar `v0.6.7`; assets `v0.20.1`; engine `v0.1.68`; composition `v0.1.76`.
- Live: terminal-host dark, generation
  `27ecb6be1d76eccae525d9552cfc311e14f0cb7da570654f7647acd490f4d349`;
  bar link `apps/bar/v0.6.7`; engine `v0.1.68`; verify `ok=337 failed=0`.
- Appearance: the bare icon-only group, `.audio-track-art`/badge and
  `.audio-settings` panel are present; no `surface.window` selector (only the
  source comment naming the retired role).
- Screenshots: `/tmp/opencode/req005/final-normal.png`,
  `final-progress.png`, `final-muted.png`, `final-settings.png`,
  `final-mixer.png`, `final-tidal.png`.
- Panel layer: `361x509` at `1346,52` (content-sized; footer at the bottom).
