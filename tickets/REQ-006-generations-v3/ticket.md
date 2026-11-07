---
id: REQ-006
title: "Consume Generations v3 from the current state pointer"
kind: requirement
status: done
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-006/
branch: ticket/REQ-006-generations-v3
---

# Consume Generations v3 from the current state pointer

## Requirement

Move the bar's local program tuple to the Generations v3 releases
(`ags-platform` `v1.0.0` / `contracts` `v0.8.0`) and assert the app-side
consumer contract: one shared `createAppearance({ configDir: "ags" })` instance
applied once at startup, reading the single committed
`$XDG_STATE_HOME/dotfiles/current` generation.

- `app.tsx` keeps one `appearance.apply()` in `main()` and no request
  handler; the bar stays `restart` and the runtime's serialized restart lane
  remains the refresh path. No `appearance-refresh` or `palette-refresh`
  handler and no `wallpaper.state` subscription are added.
- `lib/appearance.ts` remains the single module-level
  `createAppearance({ configDir: "ags" })`. It delegates current-state and
  generation resolution to the platform's v3 adapter; the bar hardcodes no
  XDG state/config path.
- Layout tokens stay TSX-owned and app-namespaced:
  `layout.ags.panel-width` with fallback `312` and
  `layout.ags.bt-list-spacing` with fallback `4`.
- `style.css` stays the bundled glass fallback, untouched.
- Makefile, CI and the conformance pin test move to
  `ags-platform v1.0.0` / `contracts v0.8.0`; local gates run with sibling
  checkout overrides.
- `tests/validation/skin-plane.test.mjs` asserts the v3 pins and the
  current-state consumer, and keeps the style.css fallback assertions.
  `tests/app-contract.test.mjs` asserts the v0.8.0 manifest schema and the
  v1.0.0/v0.8.0 tuple.

## Acceptance

- [x] Makefile pins are `AGS_PLATFORM_VERSION := v1.0.0` and
      `CONTRACTS_VERSION := v0.8.0`; CI checks out the same tags and the
      conformance pin test agrees.
- [x] `lib/appearance.ts` still owns exactly one
      `createAppearance({ configDir: "ags" })`; `app.tsx` calls
      `appearance.apply()` exactly once in `main()`.
- [x] No `appearance-refresh`/`palette-refresh` handler, no
      `wallpaper.state` subscription, and the request surface is unchanged.
- [x] Both `layout.ags.*` token reads and fallbacks are unchanged.
- [x] `style.css` is byte-unchanged and keeps the glass fallback.
- [x] Source validation asserts the v3 pins and the current-state consumer.
- [x] `make gates` is green with the local overrides recorded.
- [x] Release is the next minor after `v0.5.0` (`v0.6.0`); the branch is
      fast-forwarded into `main`, then `main` and the tag are pushed.

## Environment notes

- Local checkouts: `ags-platform` `v1.0.0` (commit
  `ca85672048ebddb278ea55d1e01b391ad3a6d780`, exactly the tag),
  `contracts` `v0.8.0` (commit
  `8906f1ad95e10d649ff67d5f7be9dd662eb65fec`, exactly the tag).
- Gates use `AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform`
  and `CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts`.

## Implementation

- `Makefile:9-10`: `AGS_PLATFORM_VERSION := v1.0.0`,
  `CONTRACTS_VERSION := v0.8.0`; the help text, drift comment and CI workflow
  name the same tuple. `.github/workflows/ci.yml:38,45,50` checks out
  `.dev/ags-platform/v1.0.0` and `contracts` `v0.8.0`.
- `lib/appearance.ts:14`: the bar's ONE
  `export const appearance = createAppearance({ configDir: "ags" })`, imported
  from `ags-platform/adapters/appearance` (`:12`). The v3 adapter resolves
  `$XDG_STATE_HOME/dotfiles/current`; the module hardcodes no XDG state/config
  path and has no refresh path.
- `app.tsx:151`: one `appearance.apply()` in `main()`. The request handler is
  untouched: `popup-close`, `settings-close`, `audio-panel-open`,
  `audio-panel-debug` and the unknown-request response. No `appearance-refresh`
  or `palette-refresh` handler was added.
- `settings-panel/SettingsPanel.tsx:24` and
  `components/bluetooth/BluetoothContent.tsx:40` still read
  `layout.ags.panel-width` (`312`) and `layout.ags.bt-list-spacing` (`4`).
- `style.css` is byte-unchanged; `git diff --quiet HEAD~1 HEAD -- style.css`
  exits `0` for the implementation commit and the closeout commit.
- `tests/validation/skin-plane.test.mjs:2` is now the Generations v3 consumer
  gate: it asserts the one shared instance, the v3 adapter import, no
  hardcoded current path, no refresh handler, both `layout.ags.*` reads and the
  Makefile `v1.0.0`/`v0.8.0` pins (`:168,173`). The `style.css` glass fallback
  assertions remain under section 5.
- `tests/app-contract.test.mjs:115` rejects the v3 live refresh command
  (`appearance-refresh`) alongside `palette-refresh`; `:274` and `:293` pin the
  contracts `v0.8.0` schema and the `v1.0.0`/`v0.8.0` Makefile tuple.
- `AGENTS.md`, `README.md`, `CHANGELOG.md` describe Generations v3, the single
  current pointer, the restart lane and the new tuple.

## Evidence

### Consumer contract

`ags-platform` `v1.0.0` (`adapters/appearance.ts:1-40`) reads
`$XDG_STATE_HOME/dotfiles/current/manifest.json`,
`current/appearance/<configDir>.css` and `current/appearance/tokens.json`, and
watches `current` only. The bar delegates that resolution to the adapter, so no
app source names the state path.

Verify: `rg -n "appearance\.css|appearance/tokens|dotfiles/current" lib/appearance.ts`
returns only the module comment; the platform adapter owns the read path.

### Gates

Command (worktree `.worktrees/REQ-006/`, branch
`ticket/REQ-006-generations-v3`, implementation commit `19b0d47`):

```sh
AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform \
CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts \
make gates
```

Result: `GATES_EXIT=0`. Full log:
`/tmp/opencode/ags-bar-req006-gates.log`.

| Gate | Result |
| --- | --- |
| `make test` — `tests/ts` | `tests 162`, `pass 162`, `fail 0` |
| `make test` — `tests/validation` | `tests 22`, `pass 22`, `fail 0` (includes `skin-plane.test.mjs`) |
| `make test` — symbol check | `SYMBOL CHECK OK` |
| `make test` — test-program tsc | `OK: 0 type errors in the pure-module test program` |
| `make conformance` | `tests 14`, `pass 14`, `fail 0` |
| `make drift` | `all checks passed` (contracts v0.8.0) |
| `make bundle` | `OK: build/ags-bar.js (2833544 bytes)` |
| `make typecheck` | `OK: 0 errors in the ags-bar tree`; 29 tolerated `/usr/share/ags/js` errors, 0 `ags-platform` errors |

`platform-dev` reported
`node_modules/ags-platform -> /home/inumaki/Development/dotfiles/ags-platform`
(the `v1.0.0` checkout) and drift read
`CONTRACTS_REPO=/home/inumaki/Development/dotfiles/contracts` (the `v0.8.0`
checkout). No network fetch and no committed artifact.

### Release and merge

- Planning commit: `1782081` — `tickets: file REQ-006 generations v3`.
- Implementation commit: `19b0d47` —
  `feat(REQ-006): consume generations v3 current state`.
- This closeout commit records the evidence and is fast-forwarded into `main`
  (no merge commit), then annotated as `v0.6.0`, the next minor after `v0.5.0`.
- `main` and the `v0.6.0` tag are pushed to `origin`; no existing tag is moved.

## Deviations

- The v3 platform still exports `createAppearanceRefreshHandler` and
  `appearance-refresh` for live apps. The bar does not import or register
  either; the restart lane stays its only refresh path, as asserted at
  `tests/app-contract.test.mjs:115` and
  `tests/validation/skin-plane.test.mjs`.
- The validation file keeps its historical name `skin-plane.test.mjs` although
  it now gates Generations v3. Renaming it would churn the `make test` glob and
  prior ticket evidence for no behavioral gain.
- `README.md` lists `dotfiles-runtime v1.0.0` as the surrounding release tuple;
  only `ags-platform` and `contracts` are gate pins in the Makefile/CI.
- Full live-session launch evidence is not repeated here. The bar is the user's
  live session and a second instance starts the shared services; the bundle
  gate proves the v3 adapter import resolves, and the platform's own v3 suite
  covers pointer/generation apply semantics.
