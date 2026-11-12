## v0.6.11 — 2026-11-12

- Fix the v0.6.10 Input regression: a `Gtk.Revealer` retained the expanded
  natural height in the initial/collapsed panel. The Input body is
  visibility-bound again, with an immediate idle fit and an 80 ms post-layout
  fit; the collapsed panel returns to its content height.

## v0.6.10 — 2026-11-12

Owner feedback round 2:

- Input collapse now refits the panel after the revealer settles (an 80 ms
  layout pass plus the revealer's child-revealed signal); no dead bottom.
- Shuffle/repeat and the Output gear resolve the new assets
  `media-controls`/`settings-panel` art; the text glyphs (`⇄`, `↻`, `⚙`) are
  gone. Active/inactive and repeat once/off are icon variants; capability
  hiding is unchanged.
- The bar strip uses a 32 px transparent track thumbnail and lets the title
  use the available width; the tray transport is centered and larger.
- Requires assets v0.21.0, platform v1.2.0, engine v0.1.71.

## v0.6.9 — 2026-11-12

- Add a debug-only `ags request -i ags tray-open` door beside
  `audio-panel-open` so the tray radius can be measured when the bar strip's
  pointer gesture cannot be driven by an automation harness. The strip remains
  the shipped entry point; no user-facing behavior changes.

## v0.6.8 — 2026-11-12

Owner feedback round 1:

- **Muted big value.** The hero carries `is-output-muted` and
  `.audio-big-value` drops to `opacity: .42`; the value, unit and slider keep
  their exact layout. The small Muted pill remains the only label.
- **Spawned windows leave radius to the skin.** `window.audio-popup`,
  `window.tray-popup`, the settings popover node and its contents are
  transparent, borderless, square and shadowless; `.audio-settings` and
  `.tray-surface` own `surface.panel` radius/border/shadow. No hard-coded
  outer radius.
- Mixer row artwork and the measured 361 px width are unchanged (accepted).
- Requires assets v0.20.2, which removes the dead `.audio-hero-note` selector.

## v0.6.7 — 2026-11-12

- **Playing pages receive resolved artwork.** The composition overlaid the
  solved `artworkPath` onto the Mixer rows only; the Playing deck renders
  `playingRows`, so its 40 px frame stayed on the app icon even after the
  thumbnail cache succeeded. The overlay now maps both arrays (the app icon
  remains the corner badge/fallback only).

## v0.6.6 — 2026-11-12

Live follow-ups from the v0.6.5 install:

- **Thumbnail cache writes succeed.** Gio's `make_directory_with_parents()`
  throws `File exists` on the already-prepared cache directory, so every
  resolution in v0.6.5 failed silently and the panel kept the app icon. The
  cache now creates the directory only when `query_exists()` says it is absent
  (prepare/async/sync paths); Chromium's `/tmp` thumbnail and Tidal's HTTPS
  cover both resolve.
- **Header actions are right-aligned like the mock.** The Output caption row
  expands, so the gear and mute sit at the right edge instead of immediately
  after the caption.

## v0.6.5 — 2026-11-12

Owner QA on the REQ-005 sound panel. No skin retune; the configured skin still
paints the surface.

### Fixed

- **Settings popover is one skin surface.** The native `Gtk.Popover` node and
  its contents are reset to transparent/no border/padding/shadow; only the
  `.audio-settings` panel-role box paints. It stays a sibling popover, not a
  nested box in the audio panel.
- **Output header matches the mock.** The gear is the mock gear glyph (the
  icon artifact's settings variant is a sliders glyph), followed by mute, the
  device row and the 28 px value/slider; the muted state is the small pill.
- **Removed the `Muted — the level is kept.` note** from the shipped code and
  the mock.
- **Mixer is levels/routing only.** Per-row play/pause was removed from the
  code, mock and ticket; the row keeps the playing dot but no playback/seek.
- **Track artwork.** Playing/tray/strip frames show the MPRIS thumbnail; the
  app icon is a small corner badge or the fallback. `file:`/`data:` artwork is
  read/cached synchronously (Chromium's `/tmp` thumbnails disappear), and a
  merged row resolves any player's artwork URI. Shuffle/Loop stay
  capability-gated; on a playback tie the row prefers the player that exposes
  them (native Tidal over its Chromium mirror); YouTube/Chromium hides them.
- **Live progress.** While the panel is visible it polls MPRIS `Position`
  once a second for the selected playing page; the seek line and elapsed time
  update without interaction. Dragging still seeks on commit.
- **No dead bottom.** The deck body is measured and the scroller is sized to
  its content (capped by the monitor), so the panel ends under the footer.
- **Bare icon-only buttons.** The assets `ags` target gives gear/mute/
  transport/carousel/level controls transparent fill/border; only hover/active
  state paints. Device/route fields, sliders and the switch keep role paint.

# Changelog

## v0.6.4 — 2026-11-12

### Changed

- Bump the local program tuple from `ags-platform` v1.0.1 / `contracts`
  v0.8.0 to `ags-platform` v1.1.0 / `contracts` v0.12.0. The v1.1.0 release
  adds the required `surface.window` outer-toplevel role; this bar's overlays
  stay on `surface.panel` (doc 113 W-10), so the role is unused here. The
  Makefile, CI workflow and conformance/validation pin tests name the same
  tuple.

### Unchanged

- No bar runtime code, `style.css`, layout token, handler/lane policy or
  behaviour change. The bar remains a `restart` app with no
  `appearance-refresh`/`palette-refresh` handler.

## v0.6.3 — 2026-11-11 — REQ-005 sound panel

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
