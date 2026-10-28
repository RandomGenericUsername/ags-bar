---
id: OPS-002
title: "Green the conformance gate for the committed colors.css pointer"
kind: ops-task
status: done
lane: 4
links:
  openspec: none
  bmad: none
worktree: none
branch: main
---

# Green the conformance gate for the committed colors.css pointer

## Why

v0.1.2 ships `colors.css` as the runtime-pointer symlink the engine's
`barPalettePointer` contract requires (AD-37), but `tests/app-contract.test.mjs`
still asserted the file did not exist and both `AGENTS.md` and `README.md`
described it as uncommitted. `make conformance` therefore failed on the
released tag.

## Change

- Assert `colors.css` is a symlink whose target ends in
  `dotfiles/current/colors.gtk.css` and stays outside the tag.
- Document the committed symlink in `AGENTS.md` and `README.md`.
- Keep the no-write rule: the app applies the palette through the Theme port
  and never writes `colors.css`.

## Done when

- `make gates` passes (test, conformance, drift, bundle, typecheck).
- Tagged `v0.1.3`.

## Evidence

- `make gates` — all five gates pass on this branch.
- `git tag -n v0.1.3` — annotated release tag.
