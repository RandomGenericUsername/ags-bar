# Changelog

## Unreleased — REQ-005 sound panel

### Added

- Replace the tall sound drawer with the frozen 352 px anchored popover: a
  persistent Output header, a `Playing | Mixer` deck (one page per current
  player; every app with audio in Mixer), a collapsed Input section and the
  footer. The read-only Playing level opens Mixer focused on that app.
- Add MPRIS `Shuffle` and `LoopStatus` to `PlayerCapabilities`/`AudioPlayer`,
  the MPRIS adapter, the action layer and the panel; each control is hidden
  when the player does not publish the optional property.
- Add the always-visible now-playing strip to the bar's end cluster
  (`media-strip` layout id, before the tray and the status icons): artwork,
  title/artist, capability-gated transport, wheel-to-cycle players and an
  inline `n/N · App` cue.
- Add the 300 px tray dropdown (`TrayPopup`/catcher) with the active track,
  transport/seek, a `Players` list when more than one player exists and an
  `Open sound panel` footer. It shares the overlay budget with the panel.
- Add the Output-gear settings popover with the live `Bar media widget`
  switch, persisted in the app-owned `$XDG_CONFIG_HOME/ags-bar/config.json`
  (`settings/`: pure domain, port, GLib adapter, save-on-change state) —
  never the AGS config link, never `bar.json`, never the clipboard config.
- Tests: `audio-controls.test.mjs` (MPRIS shuffle/loop, page projection),
  `settings-domain.test.ts` (merge/defaults/write shape/path), and expanded
  `audio-panel-render.test.mjs` checks for the surface roles, the tray/strip
  wiring, the app-owned settings path and the no-literal-colour rule.

### Changed

- Move the sound paint/geometry into the app-owned skin target
  (`dotfiles-assets` `skins/templates/ags.gtk.css.j2`, req-028): `surface.panel`
  for the popover/dropdown/settings/menus, `surface.card` for a Playing page,
  `surface.cell` for list rows, `surface.control` for buttons/fields,
  `surface.pill` for badges, plus state and ink/type. All five built-in skins
  paint it; `audio/audio-panel.css` is structural only (dimensions, spacing,
  layout, content art, the semantic live green). No `surface.window` (doc 113
  W-10: AGS overlays stay `surface.panel`).
- Delete the retired drawer's dead `.audio-*` rules from `style.css`, keeping
  only the bar microphone wrapper and the live dot.
- The bar's default layout gains `media-strip` as the first end-cluster item;
  the SNI tray keeps its slot (the mock's two placeholder dots stand in for
  the real tray icons).

### Notes

- Tuple unchanged on purpose: the composition program tuple is still
  `ags-platform` v1.0.1 / `contracts` v0.11.0 / `dotfiles-assets` v0.18.1.
  The v1.1.0/v0.12.0/v0.19.0 layer (required `surface.window`) is a
  program-wide cutover; this app uses only the five live roles and is
  forward-compatible.
- `dotfiles-assets` req-028 carries the sound classes in
  `skins/templates/ags.gtk.css.j2`; its release is a separate assets tag and
  the program tuple moves in a program-wide cutover.

## v0.6.2 — 2026-11-11

### Added

- Add `lib/scopedApp.ts`, a pure scoped-launch core, and
  `lib/scopedLauncher.ts`, its live AGS/Notifier wiring. Long-lived GUI apps
  now launch through `systemd-run --user --scope --collect --quiet`, giving
  them their own transient scope instead of living in
  `dotfiles-ags-bar.service`'s cgroup. This fixes apps such as `hyprmod` and
  `power-options-gtk` being SIGKILLed by `KillMode=mixed` when AGS restarts.
- Forward `WAYLAND_DISPLAY`, `XDG_RUNTIME_DIR` and
  `DBUS_SESSION_BUS_ADDRESS` with `--setenv` when present, and surface launch
  failures through the journal and a session notification.
- Add `tests/ts/scoped-app.test.ts` for argv construction, environment
  forwarding, allowlist rejection, success and failure/toast handling.

### Changed

- Route `hyprmod`, `power-options-gtk`, `pavucontrol`, `thunderbird`,
  `kitty -- btop`, `kitty -- wifitui tui`, `blueman-manager` and
  `nm-connection-editor` through the shared scoped launcher.
- Short-lived commands (`brightnessctl`, `wpctl`, `pw-dump`, MPRIS/speedtest
  helpers, capture-cluster requests) and the transient `wlogout` overlay keep
  their direct launches and still die with AGS.

## v0.6.1 — 2026-11-07

### Changed

- Bump the local `ags-platform` dev pin from v1.0.0 to v1.0.1 (appearance CSS
  hex-literal validation, ags-platform `BUG-002`); `contracts` stays v0.8.0.
  The Makefile, CI workflow and the conformance/validation pin tests name the
  same tuple.

### Unchanged

- No bar runtime code, `style.css`, layout token, handler/lane policy or
  behaviour change. The v1.0.1 patch only affects the live-refresh CSS
  validation path, which this restart-mode bar does not use.

## v0.6.0 — 2026-11-07

### Changed

- Bump the local program tuple to Generations v3: `ags-platform` v1.0.0 /
  `contracts` v0.8.0 (`dotfiles-assets` v0.12.0 / `dotfiles-runtime` v1.0.0).
  The Makefile, CI workflow and conformance pin test name the same tuple.
- Keep the bar's ONE shared `createAppearance({ configDir: "ags" })` instance
  and its single `appearance.apply()` at startup. The platform now resolves
  `$XDG_STATE_HOME/dotfiles/current` (manifest/appearance/tokens); the bar
  hardcodes no state path and reads no `$XDG_CONFIG_HOME` appearance link.

### Tests

- `tests/validation/skin-plane.test.mjs` asserts the v1.0.0/v0.8.0 pins, the
  platform v3 adapter import, no hardcoded current-state path, no
  `appearance-refresh` handler and the unchanged `layout.ags.*` reads.
- `tests/app-contract.test.mjs` asserts the contracts v0.8.0 manifest schema
  and rejects the v3 live refresh command alongside `palette-refresh`.

### Unchanged

- `style.css` stays the bundled glass fallback; the bar remains `restart` with
  no request handler for appearance changes. `layout.ags.*` tokens and their
  `312` / `4` fallbacks are unchanged.

## v0.5.0 — 2026-11-06

### Added

- Migrate the bar to the v2 Appearance plane: one
  `createAppearance({ configDir: "ags" })` instance in `lib/appearance.ts`,
  applied once by `appearance.apply()` in `main()`. It installs the composed
  palette + skin generation from `$XDG_STATE_HOME/dotfiles/current/appearance`
  as one last-installed USER-priority provider.
- Read namespaced layout tokens: the settings surface reads
  `appearance.value("layout.ags.panel-width", 312)` and both Bluetooth list
  boxes read `appearance.value("layout.ags.bt-list-spacing", 4)`.
- Update `tests/validation/skin-plane.test.mjs` to assert the shared
  Appearance instance, the namespaced token reads, the restart lane (no
  request handler) and the retained bundled glass fallback.

### Changed

- Remove the split `theme.apply()` / `skin.apply()` startup path and the
  `ags-platform/adapters/theme` / `adapters/skin` imports.
- Program tuple is `ags-platform` v0.9.0 / `contracts` v0.7.0 /
  `dotfiles-assets` v0.12.0 / `dotfiles-runtime` v0.9.1. `style.css` is
  unchanged and keeps the glass fallback.

## v0.4.0 — 2026-11-05

### Added

- Apply the frozen skin plane at startup: `skin.apply()` runs immediately
  after `theme.apply()`, installing the composed provider (palette roles +
  runtime-expanded `skin.css`) last at USER priority. Missing skin artifacts
  are a no-op, so the bundled `style.css` glass fallback keeps today's
  rendering.
- Consume two TSX-owned layout tokens with their fallbacks: the settings
  surface reads `skinValue("layout.panel-width", 312)` and both Bluetooth list
  boxes read `skinValue("layout.bt-list-spacing", 4)`.
- Add `tests/validation/skin-plane.test.mjs`: startup order, restart lane (no
  new request handler / refresh path), token reads and the retained glass
  fallback.

### Changed

- Program tuple is `ags-platform` v0.7.0 / `contracts` v0.6.0 /
  `dotfiles-assets` v0.10.0 / `dotfiles-runtime` v0.8.1; the manifest schema
  and template gates agree.
- Migrate `style.css` and `audio/audio-panel.css` from legacy CSG `@color_*`
  carrier names to the semantic `palette.v1` roles the platform Theme provider
  projects (`@surface`, `@on_surface`, `@primary`, `@on_primary`,
  `@primary_container`, `@tertiary`, …). Geometry, spacing, alpha values,
  selectors and behavior are unchanged; solid fills use their matching ink
  (`on_primary` / `on_primary_container`) instead of the page background.

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
