---
id: REQ-004
title: "Migrate the bar to the v2 Appearance plane"
kind: requirement
status: done
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

- [x] `app.tsx` has no `theme`/`skin` import and calls `appearance.apply()`
      exactly once in `main()`.
- [x] One module-level `createAppearance({ configDir: "ags" })` instance is
      shared by `app.tsx`, `SettingsPanel.tsx` and `BluetoothContent.tsx`, so
      the app owns one watcher and one provider.
- [x] Both layout reads use the `layout.ags.*` namespace with the same
      fallbacks and `.peek()` at the static-number sites.
- [x] The request surface is unchanged and no `palette-refresh`/
      `skin-refresh`/`wallpaper.state` path is added.
- [x] `style.css` is unchanged and still carries the glass fallback.
- [x] Makefile pins are `ags-platform v0.9.0` / `contracts v0.7.0`; the
      conformance pin test agrees and the CI workflow names the same tuple.
- [x] `make gates` is green with the local overrides recorded.
- [x] Release is the next minor after `v0.4.0` (`v0.5.0`), the branch is
      fast-forwarded into `main`, and nothing is pushed.

## Environment notes

- Local checkouts: `ags-platform` `v0.9.0`, `contracts` `v0.7.0`,
  `dotfiles-assets` `v0.12.0` (`v0.12.0-1-gfb123ac`), `dotfiles-runtime`
  `v0.9.1`.
- Gates use `AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform`
  and `CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts`; the
  Makefile defaults name the same tuple for CI.

## Implementation

- `lib/appearance.ts:14`: the bar's ONE
  `export const appearance = createAppearance({ configDir: "ags" })`.
  `app.tsx`, `SettingsPanel.tsx` and `BluetoothContent.tsx` import this same
  instance, so there is one watcher and one provider per app rather than a
  second instance per consumer.
- `app.tsx:18`: imports the shared instance; `app.tsx:150` calls
  `appearance.apply()` once in `main()`. The v1
  `ags-platform/adapters/theme` and `adapters/skin` imports are gone.
- `settings-panel/SettingsPanel.tsx:24`:
  `appearance.value("layout.ags.panel-width", 312)`; the width getter at
  `:34` still resolves it with `.peek()` because the surface contract types
  `width` as a plain number.
- `components/bluetooth/BluetoothContent.tsx:40`:
  `appearance.value("layout.ags.bt-list-spacing", 4)`; both list boxes still
  read `spacing={btListSpacing.peek()}` at `:763` and `:811`.
- `style.css` is byte-unchanged (`git diff --quiet HEAD^ -- style.css`).
- `Makefile:8-9`: `AGS_PLATFORM_VERSION := v0.9.0`,
  `CONTRACTS_VERSION := v0.7.0`; `.github/workflows/ci.yml` and
  `tests/app-contract.test.mjs` name the same tuple.
- `tests/validation/skin-plane.test.mjs`: asserts the shared `configDir: "ags"`
  instance, one `appearance.apply()` in `main()`, no v1 theme/skin imports,
  the unchanged request surface/restart lane, both `layout.ags.*` reads with
  fallbacks and the retained `style.css` glass fallback.
- `AGENTS.md`, `README.md`, `CHANGELOG.md`: describe the Appearance plane,
  namespaced layout tokens, the restart lane and the new program tuple.

## Evidence

### Token source

`dotfiles-assets` `v0.12.0-1-gfb123ac`,
`skins/manifests/glass.toml:89-93`:

```toml
[groups.layout.ags]
panel-width = 312
bt-list-spacing = 4
bar-row-height = 0
chip-min = 0
```

Only the two tokens the bar consumes are read; `bar-row-height` and `chip-min`
stay manifest-only because no current bar widget consumes them.

### Static contract

`tests/validation/skin-plane.test.mjs` passes inside `make test` with the
assertions listed in Implementation. It strips comments before scanning, so
the prose that names forbidden paths cannot read as the defect it forbids.

### Gates

Command (worktree `.worktrees/REQ-004/`, branch
`ticket/REQ-004-appearance-migration`, implementation commit `1e78d10`):

```sh
AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform \
CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts \
make gates
```

Result: `GATES_EXIT=0`. Full log:
`/tmp/opencode/ags-bar-req004-gates-final.log`.

| Gate | Result |
| --- | --- |
| `make test` — `tests/ts` | `tests 162`, `pass 162`, `fail 0` |
| `make test` — `tests/validation` | `tests 22`, `pass 22`, `fail 0` (includes `skin-plane.test.mjs`) |
| `make test` — symbol check | `SYMBOL CHECK OK` |
| `make test` — test-program tsc | `OK: 0 type errors in the pure-module test program` |
| `make conformance` | `tests 14`, `pass 14`, `fail 0` |
| `make drift` | `all checks passed` (contracts v0.7.0) |
| `make bundle` | `OK: build/ags-bar.js (2763972 bytes)` |
| `make typecheck` | `OK: 0 errors in the ags-bar tree`; 29 tolerated `/usr/share/ags/js` errors, 0 `ags-platform` errors |

`make conformance` includes the unchanged restart/no-handler assertion and
the request-surface assertion. Pins resolve from local checkouts with no
network fetch: `platform-dev` reported
`node_modules/ags-platform -> /home/inumaki/Development/dotfiles/ags-platform`
and drift read `CONTRACTS_REPO=/home/inumaki/Development/dotfiles/contracts`.

### Release and merge

- Planning commit: `0ac7f88` — `tickets: file REQ-004 appearance migration`.
- Implementation commit: `1e78d10` —
  `feat(REQ-004): migrate the bar to the v2 appearance plane`.
- This closeout commit records the evidence, is fast-forwarded into `main`
  (no merge commit) and is annotated as `v0.5.0`, the next minor after
  `v0.4.0`.
- Nothing is pushed. No tag is moved; `v0.4.0` and older remain untouched.

## Deviations

- The shared instance lives in `lib/appearance.ts` rather than directly in
  `app.tsx`. `value()` subscribes to the one watched pointer, so putting a
  separate `createAppearance` in each consumer would install a second watcher
  and provider; the module keeps the bar at one instance while `app.tsx` still
  owns the single `apply()` call. This is recorded at `lib/appearance.ts:1-10`.
- Full live launch evidence is not repeated in this ticket: the bar is the
  user's live session and a second instance starts the shared services. The
  bundle gate proves the Appearance import resolves, the platform's Appearance
  suite covers the pointer/apply/provider contract, and the source gate pins
  the app-side wiring. The runtime host-side provisioning remains the cutover
  path.
