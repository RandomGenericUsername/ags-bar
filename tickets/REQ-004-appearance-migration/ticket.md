---
id: REQ-004
title: "Migrate the bar to the v2 Appearance plane"
kind: requirement
status: in-progress
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-004/
branch: ticket/REQ-004-appearance-migration
---

# Migrate the bar to the v2 Appearance plane

## Requirement

Consume the v2 Appearance plane instead of the split Theme + Skin pair. The
runtime publishes palette + skin + mode as one immutable generation behind
`$XDG_STATE_HOME/dotfiles/current/appearance`; the app installs one composed
provider at USER priority from the current generation.

- `app.tsx` no longer imports `theme` or `skin`; it applies ONE
  `createAppearance({ configDir: "ags" })` instance in `main()`.
- The bar stays `restart` with NO `palette-refresh` request handler, no
  wallpaper subscription and no skin-refresh request. The runtime's serialized
  restart lane remains the refresh path.
- Layout tokens are namespaced by app: the settings surface reads
  `appearance.value("layout.ags.panel-width", 312)` and both Bluetooth list
  boxes read `appearance.value("layout.ags.bt-list-spacing", 4)` with
  `.peek()` where a static number is required (unchanged pattern).
- The glass manifest `[groups.layout.ags]` is the token source:
  `panel-width = 312`, `bt-list-spacing = 4`, `bar-row-height = 0`,
  `chip-min = 0`. The two fallbacks stay `312` / `4`.
- `style.css` stays the bundled glass fallback, untouched. No structure,
  class, gesture or behavior change.
- Local pins move to `ags-platform v0.9.0` / `contracts v0.7.0`; gates run
  with local checkout overrides.
- `tests/validation/skin-plane.test.mjs` asserts the Appearance apply
  (`configDir: "ags"`), the namespaced layout tokens, no request handler and
  the retained `style.css` fallback.

## Acceptance

- [ ] `app.tsx` has no `theme`/`skin` import and calls `appearance.apply()`
      exactly once in `main()`.
- [ ] One module-level `createAppearance({ configDir: "ags" })` instance is
      shared by `app.tsx`, `SettingsPanel.tsx` and `BluetoothContent.tsx`, so
      the app owns one watcher and one provider.
- [ ] Both layout reads use the `layout.ags.*` namespace with the same
      fallbacks and `.peek()` at the static-number sites.
- [ ] The request surface is unchanged and no `palette-refresh`/
      `skin-refresh`/`wallpaper.state` path is added.
- [ ] `style.css` is unchanged and still carries the glass fallback.
- [ ] Makefile pins are `ags-platform v0.9.0` / `contracts v0.7.0`; the
      conformance pin test agrees and the CI workflow names the same tuple.
- [ ] `make gates` is green with the local overrides recorded.
- [ ] Release is the next minor after `v0.4.0` (`v0.5.0`), the branch is
      fast-forwarded into `main`, and nothing is pushed.

## Environment notes

- Local checkouts: `ags-platform` `v0.9.0`, `contracts` `v0.7.0`,
  `dotfiles-assets` `v0.12.0` (`v0.12.0-1-gfb123ac`), `dotfiles-runtime`
  `v0.9.1`.
- Gates use `AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform`
  and `CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts`; the
  Makefile defaults name the same tuple for CI.
