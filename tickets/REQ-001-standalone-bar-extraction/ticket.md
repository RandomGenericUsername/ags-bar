---
id: REQ-001
title: "Extract the bar into the standalone ags-bar repo"
kind: requirement
status: done
lane: 4
links:
  openspec: none
  bmad: none
worktree: none
branch: main
---

# Extract the bar into the standalone ags-bar repo

## Requirement

Create `ags-bar` from `ags-apps` v0.5.0 `bar/`, with the repo root as the app
package. Keep the bar whole: the `requestHandler`/popup surface, `icons.json`,
the vendored generated contract, the pure/validation tests and the validators.
The identity is `app=bar`, `instance=ags`, `configDir=ags`, `mode=restart`,
`holdsUnsavedState=false`. The bar is the explicit restart app and has **no**
`palette-refresh` handler.

The standalone dev flow (AGENTS, tickets, worktree guard, Makefile, CI, tests)
comes from `ags-clipboard/templates/ags-app/`, adapted for restart. The local
program tuple is `ags-platform`/`contracts` v0.3.0. This ticket does not
provision, cut over, run a GUI, or push.

## Acceptance

- [x] All bar sources are at the repo root (`app.tsx`, `style.css`,
      `icons.json`) with the inner `bar/` package intact.
- [x] `app.manifest.json` is the `bar` / `ags` / `ags` / `restart` /
      no-unsaved-state tuple and the platform manifest validator agrees.
- [x] `app.tsx` keeps the complete request surface (`popup-close`,
      `settings-close`, `audio-panel-open`, `audio-panel-debug`, unknown
      request) and never imports/registers `palette-refresh`.
- [x] `icons.json`, the vendored generated contract and all copied test suites
      are present and pass without the desktop stack.
- [x] `colors.css`, `icons.json` and `wifi-speedtest` state are documented as
      install-time/cutover concerns; no writable state is added to the repo.
- [x] `AGENTS.md`, tickets, worktree guard, Makefile, CI and tests are present
      and the platform template-conformance gate passes.
- [x] Local gates pass: `make test`, `make conformance`, `make drift`,
      `make typecheck`, `make bundle` (or `ags bundle`).
- [x] Annotated tag `v0.1.0` is created after the gates pass; nothing is pushed.

## Evidence

- Source extraction: `git archive v0.5.0 bar | tar -x --strip-components=1`
  from `ags-apps`; `diff -r` against `ags-apps/bar` shows only the intended
  additions plus `instanceName: "ags"` in `app.tsx`, the
  `tsconfig.bar.json` -> `tsconfig.app.json` rename, the repo-relative symbol
  check comment, and the mocks README note.
- `make gates` → exit 0, 25.6 s warm wall (`test + conformance + drift +
  bundle + typecheck`), log: `/tmp/opencode/ags-bar-gates.log`:
  - `make test` → 139/139 `tests/ts` tests pass; 20/20 validation tests pass;
    `SYMBOL CHECK OK`; test program `tsc` → 0 type errors.
  - `make conformance` → 14/14 pass, including the platform `checkAppRepo`
    template gate, the manifest identity, the restart/no-handler assertion and
    the install-time/state documentation checks.
  - `make drift` → 20 checks pass against `contracts` v0.3.0.
  - `make bundle` → `build/ags-bar.js`, 2,527,800 bytes.
  - `make typecheck` → 0 errors in the ags-bar tree (29 tolerated
    `/usr/share/ags/js` errors, 0 platform errors).
- Restart evidence: `app.manifest.json` is `bar/ags/ags/restart/false`;
  `tests/app-contract.test.mjs` asserts no `PALETTE_REFRESH_COMMAND`,
  `createPaletteRefreshHandler` or `palette-refresh` import exists, and
  `theme.apply()` runs once at startup.
- Request-surface evidence: `app.tsx` keeps `popup-close` (all five overlay
  closes), `settings-close`, `audio-panel-open`, `audio-panel-debug`, and the
  `unknown request: ...` response; `tests/app-contract.test.mjs` pins them.
- State/cutover evidence: `README.md` documents `colors.css` as the
  install-time pointer, `icons.json` as a single-producer artifact, the
  config-dir audio stylesheet, and the `wifi-speedtest` migration;
  `tickets/OPS-001-cutover-state-migration/ticket.md` owns the app-side
  prerequisite.
- No GUI/host change: no `ags run`, no link/provisioning edit, no push.

## Dependencies

- `ags-apps` v0.5.0 source and the REQ-008/REQ-015 contract.
- `ags-platform` v0.3.0 and `contracts` v0.3.0 (local-only tags).
- `dotfiles-runtime` safe restart lane (BUG-003) for the eventual cutover.
