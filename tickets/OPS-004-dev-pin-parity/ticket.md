---
id: OPS-004
title: "Bump the local program tuple to ags-platform v1.1.0 / contracts v0.12.0"
kind: ops-task
status: in-progress
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

<fill after implementation>

## Evidence

<fill after gates and release>

## Deviations

- Requested release `v0.6.3` was already published as the sound-panel release;
  this ticket releases `v0.6.4` instead of moving the existing tag.
- Work is based on current `main` (`d01d8be`, tag `v0.6.3`), not `v0.6.2`, so
  the already-released sound-panel work is preserved.
