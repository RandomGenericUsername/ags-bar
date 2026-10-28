---
id: OPS-001
title: "Move wifi-speedtest state and verify install-time artifacts before cutover"
kind: ops-task
status: done
lane: 4
links:
  openspec: none
  bmad: none
worktree: .worktrees/OPS-001/
branch: ticket/OPS-001-cutover-state-migration
---

# Move wifi-speedtest state and verify install-time artifacts before cutover

## Why

`ags-bar` is an immutable installed tag (AD-37), but the current deployment
points `config/ags` at that tag. `services/speedtest-service.ts` wrote
`$XDG_CONFIG_HOME/ags/wifi-speedtest.json` and `wifi-speedtest-last.json`,
which therefore landed inside the tag. A tag bump reset the user's interval,
server mode and last measurement. `wifi-speedtest.json` at the repo root is
only a legacy seed default, not user state.

## Scope

App-side prerequisite only. The host-side link flip, app-list entry and restart
lane stay with `ags-apps` REQ-015 and the runtime/provisioning repos. This
change does not provision, cut over, push, or touch another repo.

## Done when

- [x] The service reads/writes its config and last-run JSON under
      `$XDG_STATE_HOME/ags/`, outside the install tree, with a one-time
      migration from the existing `$XDG_CONFIG_HOME/ags/` files.
- [x] `wifi-speedtest.json` in the repo is explicitly a seed that provisioning
      owns; it is never the read/write target after cutover.
- [x] A tag-bump test proves interval, server mode and last measurement survive.
- [x] `colors.css` is verified as the stable runtime pointer outside the tag;
      the app does not create or write it.
- [x] `icons.json` has one producer (pinned `dotfiles-assets` artifact) and
      provisioning verifies byte equality instead of writing it.
- [x] No GUI or host change is made by this repo; the cutover evidence lands in
      `ags-apps` REQ-015.

## Implementation

- `services/speedtest-state.ts` (new, pure): resolves the XDG state paths,
  defines the narrow `StateFs` port and owns `migrateLegacySpeedTestState`.
  Targets are `<stateHome>/ags/wifi-speedtest.json` and
  `wifi-speedtest-last.json`; legacy sources are the same names under
  `<configHome>/ags`.
- `services/speedtest-service.ts`: targets now come from
  `speedTestStatePaths(GLib.get_user_state_dir(), GLib.get_user_config_dir())`;
  `migrateLegacyState()` runs before the first `loadConfig()`; the GLib adapter
  normalises `file_get_contents`/`file_set_contents`/`mkdir_with_parents`.
  `saveConfig`/`saveLastRun` create the state dir on demand.
- Migration rules: existing state wins (idempotent, one-time per file), sources
  are copied byte-for-byte and never modified/deleted (read-only tag, rollback
  safety), a non-object source is not adopted and stays retryable, and a
  failure is logged without blocking startup.
- `tests/ts/speedtest-state.test.ts` (new): path layout, adoption, state-wins
  idempotency, corrupt-source retry, fresh-install no-op and the tag-bump proof.
  Listed by name in `tests/tsconfig.tests.json` (the purity contract).
- `tests/app-contract.test.mjs`: pins XDG state targets, forbids config-dir
  read/write targets, asserts migration-before-read wiring, the seed default,
  the tag-bump test and the updated docs; also pins no `colors.css` write and no
  `icons.json` write from `app.tsx`.
- `README.md#cutover-state-migration-wifi-speedtest`, `AGENTS.md` §3,
  `CHANGELOG.md` and `package.json` (`0.1.1`) document the behavior.
- `wifi-speedtest.json` stays as the tracked provisioning seed with unchanged
  content (`interval_ms`, `run_on_connect`, `server_mode`), and is now
  documented as never a read/write target.

## Evidence

- State paths: `services/speedtest-state.ts:47-63` (path resolver);
  `services/speedtest-service.ts:70-89` (state-root wiring).
- Migration wiring before the first read:
  `services/speedtest-service.ts:138-160` (migration function) and
  `services/speedtest-service.ts:553-554` (`migrateLegacyState()` →
  `loadConfig()`).
- One-time rule: `services/speedtest-state.ts:113-147` (`exists(target)` wins,
  source never written); tests at `tests/ts/speedtest-state.test.ts:139-157`
  ("existing XDG state always wins over the legacy copy").
- Tag-bump proof: `tests/ts/speedtest-state.test.ts:182-211` — seeds the old
  config dir, migrates, deletes it, creates a fresh empty one, and asserts
  `interval_ms`, `server_mode`, `run_on_connect` and the last measurement.
- Seed semantics: `README.md#install-time-concerns-not-repo-state`;
  `tests/app-contract.test.mjs` asserts the repo file parses to the documented
  seed and that both service targets come from `get_user_state_dir()`.
- `colors.css`: unchanged install-time pointer; `app.tsx` applies it only via
  `theme.apply()`, and the conformance test rejects a `file_set_contents`
  write to it. `icons.json` unchanged, single `dotfiles-assets` producer, with
  the conformance test pinning "provisioning verifies byte equality".
- Gates (`make gates`, run in `.worktrees/OPS-001/`, log
  `/tmp/opencode/ags-bar-ops001-gates.log`) → exit 0:
  - `make test` → 145/145 `tests/ts` tests (139 existing + 6 new), 20/20
    validation tests, `SYMBOL CHECK OK`, test-program `tsc` → 0 errors.
  - `make conformance` → 14/14 pass (platform `checkAppRepo`, manifest
    identity, restart/no-handler, state/install-time docs).
  - `make drift` → all checks passed against `contracts` v0.3.0.
  - `make bundle` → `build/ags-bar.js`, 2,551,516 bytes.
  - `make typecheck` → 0 errors in the ags-bar tree (29 tolerated
    `/usr/share/ags/js` errors, 0 platform errors).
- No GUI/host change: no `ags run`, no link/provisioning edit, no push; only
  files in this repo changed.

## Dependencies

- AD-37 (installed tags immutable; writable state under XDG).
- `ags-apps` REQ-015 owns the host-side cutover evidence.
