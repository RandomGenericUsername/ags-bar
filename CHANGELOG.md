# Changelog

## v0.3.0 — 2026-11-04

### Added

- The bar reserves a recording slot and asks capture (via the AGS request
  channel) to draw the cluster at that slot; the bar itself no longer carries
  the timer, popover or action controls.
- The bar reads `recording_controls` from the capture-tool config and only
  reserves a slot in `top-bar` mode. `hover`/`always` hide the slot and use the
  capture tool's native bar.
- A 15 s liveness update recovers the capture-drawn cluster after a capture
  restart.

### Changed

- Platform pin is `v0.5.0` (new `capture-cluster` port). Compact/full controls
  remain governed by `bar_compact_controls`.

## Unreleased

- Migrate `style.css` and `audio/audio-panel.css` from legacy CSG `@color_*`
  carrier names to the semantic `palette.v1` roles the `ags-platform` v0.4.0
  Theme provider projects (`@surface`, `@on_surface`, `@primary`,
  `@on_primary`, `@primary_container`, `@tertiary`, …). Geometry, spacing,
  alpha values, selectors and behavior are unchanged; solid fills use their
  matching ink (`on_primary` / `on_primary_container`) instead of the page
  background.
- Pin the platform tuple at v0.4.0 (contracts stays v0.3.0) so local gates and
  CI exercise the provider that defines the roles. No refresh mechanism change:
  the legacy sheet is still applied verbatim and `theme.apply()` still runs
  once at startup.

## v0.1.3 — 2026-10-28

- Fix the stale conformance test and docs that rejected the committed
  `colors.css` runtime-pointer symlink shipped in v0.1.2. The test now asserts
  the link target (`<state>/dotfiles/current/colors.gtk.css`) and that it stays
  outside the immutable tag, matching the engine's `barPalettePointer` contract.
- Document the committed symlink in `AGENTS.md` and `README.md`; the app still
  never writes it.

## v0.1.2 — 2026-10-28

- Ship `colors.css` as the stable runtime-pointer symlink the AGS app-role
  verifies (`barPalettePointer`). The target lives under the runtime's current
  state dir, outside the immutable tag.

## v0.1.1 — 2026-10-28

- Move the speed-test service's writable state out of the installed tag (AD-37):
  settings and last measurement now live at
  `$XDG_STATE_HOME/ags/wifi-speedtest.json` and
  `$XDG_STATE_HOME/ags/wifi-speedtest-last.json`.
- Add a one-time migration from the old `$XDG_CONFIG_HOME/ags/` files. Existing
  state always wins, the legacy source is never written or deleted, and a
  corrupt source is retried instead of adopted.
- Add the pure `services/speedtest-state.ts` path/migration core and
  `tests/ts/speedtest-state.test.ts`, including the tag-bump persistence proof
  for interval, server mode and last measurement.
- Keep `wifi-speedtest.json` as an explicit provisioning-owned seed default and
  document that it is never the read/write target after cutover.

## v0.1.0 — 2026-10-27

- Extract the bar from `ags-apps` v0.5.0 into the standalone `ags-bar` repo
  (repo root is the app package; the inner `bar/` widget directory is kept).
- Identity stays `app=bar`, `instance=ags`, `configDir=ags`, with the explicit
  `mode=restart` and `holdsUnsavedState=false` manifest.
- Keep the bar's complete `requestHandler`/popup surface: `popup-close`,
  `settings-close`, `audio-panel-open` and `audio-panel-debug`.
- No `palette-refresh` handler: appearance changes restart the bar through the
  runtime's serialized restart lane.
- Carry `icons.json`, the vendored generated contract, the pure/validation test
  suites and the install-gate validators.
- Add the standalone dev flow (`AGENTS.md`, tickets, worktree guard, Makefile,
  CI, tests) and the manifest/restart conformance gate.
- Pin the local-only v0.3.0 `ags-platform`/`contracts` tuple via `.dev/`.
