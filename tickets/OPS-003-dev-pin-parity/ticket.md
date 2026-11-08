---
id: OPS-003
title: "Bump the local ags-platform pin to v1.0.1"
kind: ops-task
status: in-progress
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
