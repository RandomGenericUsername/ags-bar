---
id: OPS-003
title: "Bump the local ags-platform pin to v1.0.1"
kind: ops-task
status: done
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/OPS-003/
branch: ticket/OPS-003-dev-pin-parity
---

# Bump the local ags-platform pin to v1.0.1

## Work

Move only the local `ags-platform` dev pin from `v1.0.0` to `v1.0.1`; keep
`contracts` at `v0.8.0`. `v1.0.1` is the appearance CSS hex-literal validation
patch (ags-platform `BUG-002`): the live-refresh CSS check no longer mistakes a
CSS ID selector for a hex colour. The bar is `restart` and does not use the
live-refresh path, so this is pin parity with no app behaviour change.

- Makefile: `AGS_PLATFORM_VERSION := v1.0.1`, help/comment tuple.
- CI: check out `ags-platform` `v1.0.1` at `.dev/ags-platform/v1.0.1`.
- Conformance/validation tests: assert the `v1.0.1` platform pin (keep the
  `v0.8.0` contracts pin).
- `README.md`, `AGENTS.md`, `CHANGELOG.md`: name the new local tuple.
- Do not change bar runtime code, `style.css`, layout tokens, handler/lane
  policy or behaviour. Do not touch historical ticket records.

## Done when

- `AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts make gates` passes.
- Release is the patch tag `v0.6.1` (annotated), fast-forwarded into `main`,
  then `main` and the tag are pushed.

## Implementation

- `Makefile:3-10`: `AGS_PLATFORM_VERSION := v1.0.1`; `CONTRACTS_VERSION`
  stays `v0.8.0`; the tuple comment names the appearance CSS hex-literal
  validation patch (ags-platform BUG-002). Help text (`:32`) links
  `.dev/ags-platform/v1.0.1`.
- `.github/workflows/ci.yml:11,38-39,50`: checks out `ags-platform` `v1.0.1`
  at `.dev/ags-platform/v1.0.1` and asserts its `index.ts`; the `contracts`
  checkout stays `v0.8.0`.
- `tests/validation/skin-plane.test.mjs:6,16,168`: section 4 asserts
  `^AGS_PLATFORM_VERSION := v1\.0\.1$` and keeps
  `^CONTRACTS_VERSION := v0\.8\.0$`; all consumer assertions are unchanged.
- `tests/app-contract.test.mjs:14,293-295`: the conformance test name and regex
  pin `v1.0.1` / `v0.8.0`.
- `README.md:237,242`, `AGENTS.md:107`: local tuple and symlink example name
  `ags-platform` `v1.0.1`; `dotfiles-assets` `v0.12.0` /
  `dotfiles-runtime` `v1.0.0` are untouched.
- `CHANGELOG.md`: new `v0.6.1` patch section; the historical `v0.6.0` section
  is unchanged.
- `app.tsx:144`: one comment line now names `ags-platform v1.0.1`. No code,
  import, handler, lane or layout token changed.

## Evidence

### Pin diff

`git diff --stat 78370ea..HEAD` touches only the eight files above; the
`app.tsx` change is the single comment line (`git diff -U0 -- app.tsx`).
`git diff --quiet 78370ea..HEAD -- style.css` exits `0`.

### Gates

Command (worktree `.worktrees/OPS-003/`, branch
`ticket/OPS-003-dev-pin-parity`, implementation commit `83832eb`):

```sh
AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform \
CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts \
make gates
```

Result: `GATES_EXIT=0`. Full log:
`/tmp/opencode/ags-bar-ops003-gates.log`.

| Gate | Result |
| --- | --- |
| `make test` — `tests/ts` | `tests 162`, `pass 162`, `fail 0` |
| `make test` — `tests/validation` | `tests 22`, `pass 22`, `fail 0` (includes `skin-plane.test.mjs`) |
| `make test` — symbol check | `SYMBOL CHECK OK` |
| `make test` — test-program tsc | `OK: 0 type errors in the pure-module test program` |
| `make conformance` | `tests 14`, `pass 14`, `fail 0` |
| `make drift` | `all checks passed` (contracts v0.8.0) |
| `make bundle` | `OK: build/ags-bar.js (2836620 bytes)` |
| `make typecheck` | `OK: 0 errors in the ags-bar tree`; 29 tolerated `/usr/share/ags/js` errors, 0 `ags-platform` errors |

`platform-dev` linked
`node_modules/ags-platform -> /home/inumaki/Development/dotfiles/ags-platform`
(the local `v1.0.1` checkout, commit `10b4d11` = tag `v1.0.1`); drift read
`CONTRACTS_REPO=/home/inumaki/Development/dotfiles/contracts` (v0.8.0). No
network fetch and no committed artifact.

### Release and merge

- Planning commit: `78370ea` — `tickets: file OPS-003 dev pin parity`.
- Implementation commit: `83832eb` —
  `chore(OPS-003): bump local ags-platform pin to v1.0.1`.
- Docs commit: `9ab0d23` —
  `docs(OPS-003): name the v1.0.1 tuple in README/AGENTS/CHANGELOG`.
- This closeout commit records the evidence and is fast-forwarded into `main`
  (no merge commit), then annotated as `v0.6.1`, the patch after `v0.6.0`.
- `main` and the `v0.6.1` tag are pushed to `origin`; no existing tag is moved.
- Convention is tag-only: this repo has no GitHub Release workflow and prior
  releases (`v0.1.x`…`v0.6.0`) are annotated tags without releases.

## Deviations

- `app.tsx:144` carries a documentation comment that named the platform pin;
  it was updated with the pin. No runtime code or behaviour changed.
- Historical ticket records (`tickets/REQ-006-…`) keep their `v1.0.0`
  references; they describe the state at that release and are not rewritten.
- `README.md` still lists `dotfiles-runtime v1.0.0`; only the `ags-platform`
  gate pin moved.
