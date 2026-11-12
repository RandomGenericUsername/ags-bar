---
id: OPS-004
title: "Bump the local program tuple to ags-platform v1.1.0 / contracts v0.12.0"
kind: ops-task
status: done
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/OPS-004/
branch: ticket/OPS-004-dev-pin-parity
---

# Bump the local program tuple to ags-platform v1.1.0 / contracts v0.12.0

## Work

Move only the local dev pins from `ags-platform` `v1.0.1` / `contracts`
`v0.8.0` to `ags-platform` `v1.1.0` / `contracts` `v0.12.0`. `v1.1.0` is the
required `surface.window` role release (ags-platform REQ-020), built against
`contracts` `v0.12.0`. This bar renders no outer toplevel surface: its overlays
stay on `surface.panel` (doc 113 W-10), so the pin moves for parity with no app
behaviour change.

- Makefile: `AGS_PLATFORM_VERSION := v1.1.0`,
  `CONTRACTS_VERSION := v0.12.0`, tuple comment and help text.
- CI: check out `ags-platform` `v1.1.0` at `.dev/ags-platform/v1.1.0` and
  `contracts` `v0.12.0`.
- Conformance/validation tests: assert the `v1.1.0` / `v0.12.0` pins.
- `README.md`, `AGENTS.md`, `CHANGELOG.md`: name the new local tuple.
- Do not change bar runtime code, `style.css`, layout tokens, handler/lane
  policy or behaviour. Do not touch historical ticket records.

## Done when

- `AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts make gates` passes.
- Release is the patch tag `v0.6.4` (annotated), fast-forwarded into `main`,
  then `main` and the tag are pushed.

## Why v0.6.4, not v0.6.3

`v0.6.3` already exists as an annotated tag locally and on `origin`
(`d01d8be`, the REQ-005 sound panel release). Repo policy forbids moving a
published tag, so the pin-parity patch takes the next free patch tag,
`v0.6.4`.

## Implementation

- `Makefile:3-11`: `AGS_PLATFORM_VERSION := v1.1.0`,
  `CONTRACTS_VERSION := v0.12.0`; the tuple comment names the required
  `surface.window` role and records that this bar's overlays stay on
  `surface.panel`. Help text (`:32-33`) links `.dev/ags-platform/v1.1.0` and
  `.dev/contracts/v0.12.0`.
- `.github/workflows/ci.yml:11,38-39,45,50`: checks out `ags-platform` `v1.1.0`
  at `.dev/ags-platform/v1.1.0`, checks out `contracts` `v0.12.0`, and asserts
  the platform `index.ts`.
- `tests/validation/skin-plane.test.mjs:4-6,16,168-176`: section 4 asserts
  `^AGS_PLATFORM_VERSION := v1\.1\.0$` and
  `^CONTRACTS_VERSION := v0\.12\.0$`; consumer assertions are unchanged.
- `tests/app-contract.test.mjs:14,274,293-296`: the conformance test names and
  regex pin `v1.1.0` / `v0.12.0`.
- `README.md:352-358`, `AGENTS.md:125`: the local tuple and symlink examples
  name `ags-platform` `v1.1.0` / `contracts` `v0.12.0`.
- `CHANGELOG.md:3-19`: new `v0.6.4` patch section. The already-published
  sound-panel section is labelled `v0.6.3` (it had remained `Unreleased`).
- `app.tsx:153`: one comment line now names the new tuple. No code, import,
  handler, lane or layout token changed.

## Evidence

### Pin diff

`git diff --stat d01d8be..HEAD` touches only the ticket, INDEX and the eight
files above. The `app.tsx` change is one comment line. `style.css`,
`audio/audio-panel.css`, the handlers and the layout tokens are untouched.

### Gates

Command (worktree `.worktrees/OPS-004/`, branch
`ticket/OPS-004-dev-pin-parity`, implementation commit `8a98460`, docs commit
`e199f73`):

```sh
AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform \
CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts \
make gates
```

Result: exit status `0`. Full log:
`/tmp/opencode/ags-bar-ops004-gates.log`.

| Gate | Result |
| --- | --- |
| `make test` — `tests/ts` | `tests 179`, `pass 179`, `fail 0` |
| `make test` — `tests/validation` | `tests 28`, `pass 28`, `fail 0` |
| `make test` — symbol check | `SYMBOL CHECK OK` |
| `make test` — test-program tsc | `OK: 0 type errors in the pure-module test program` |
| `make conformance` | `tests 14`, `pass 14`, `fail 0` |
| `make drift` | `all checks passed` (contracts v0.12.0) |
| `make bundle` | `OK: build/ags-bar.js (3025588 bytes)` |
| `make typecheck` | `OK: 0 errors in the ags-bar tree`; 29 tolerated `/usr/share/ags/js` errors, 0 `ags-platform` errors |

`platform-dev` linked
`node_modules/ags-platform -> /home/inumaki/Development/dotfiles/ags-platform`
(tag `v1.1.0`, commit `f20a685`); drift read
`CONTRACTS_REPO=/home/inumaki/Development/dotfiles/contracts` (tag `v0.12.0`,
commit `a03b563`). No network fetch and no committed artifact.

### Release and merge

- Planning commit: `85fae36` — `tickets: file OPS-004 dev pin parity`.
- Implementation commit: `8a98460` —
  `chore(OPS-004): bump local tuple to ags-platform v1.1.0 / contracts v0.12.0`.
- Docs commit: `e199f73` —
  `docs(OPS-004): name the v1.1.0/v0.12.0 tuple and release v0.6.4`.
- This closeout commit records the evidence and is fast-forwarded into `main`
  (no merge commit), then annotated as `v0.6.4`, the patch after `v0.6.3`.
- `main` and the `v0.6.4` tag are pushed to `origin`; no existing tag is moved.
- Convention is tag-only: this repo has no GitHub Release workflow and prior
  releases (`v0.1.x`…`v0.6.3`) are annotated tags without releases.

## Deviations

- Requested release `v0.6.3` was already published as the sound-panel release;
  this ticket releases `v0.6.4` instead of moving the existing tag.
- Work is based on current `main` (`d01d8be`, tag `v0.6.3`), not `v0.6.2`, so
  the already-released sound-panel work is preserved.
