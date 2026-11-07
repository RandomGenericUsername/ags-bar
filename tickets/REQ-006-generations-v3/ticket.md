---
id: REQ-006
title: "Consume Generations v3 from the current state pointer"
kind: requirement
status: in-progress
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

- [ ] Makefile pins are `AGS_PLATFORM_VERSION := v1.0.0` and
      `CONTRACTS_VERSION := v0.8.0`; CI checks out the same tags and the
      conformance pin test agrees.
- [ ] `lib/appearance.ts` still owns exactly one
      `createAppearance({ configDir: "ags" })`; `app.tsx` calls
      `appearance.apply()` exactly once in `main()`.
- [ ] No `appearance-refresh`/`palette-refresh` handler, no
      `wallpaper.state` subscription, and the request surface is unchanged.
- [ ] Both `layout.ags.*` token reads and fallbacks are unchanged.
- [ ] `style.css` is byte-unchanged and keeps the glass fallback.
- [ ] Source validation asserts the v3 pins and the current-state consumer.
- [ ] `make gates` is green with the local overrides recorded.
- [ ] Release is the next minor after `v0.5.0` (`v0.6.0`); the branch is
      fast-forwarded into `main`, then `main` and the tag are pushed.

## Environment notes

- Local checkouts: `ags-platform` `v1.0.0` (commit
  `ca85672048ebddb278ea55d1e01b391ad3a6d780`, exactly the tag),
  `contracts` `v0.8.0` (commit
  `8906f1ad95e10d649ff67d5f7be9dd662eb65fec`, exactly the tag).
- Gates use `AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform`
  and `CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts`.
