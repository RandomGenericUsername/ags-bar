# Changelog

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
