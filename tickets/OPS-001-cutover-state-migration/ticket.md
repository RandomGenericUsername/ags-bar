---
id: OPS-001
title: "Move wifi-speedtest state and verify install-time artifacts before cutover"
kind: ops-task
status: proposed
lane: 4
links:
  openspec: none
  bmad: none
worktree: none
branch: none
---

# Move wifi-speedtest state and verify install-time artifacts before cutover

## Why

`ags-bar` is an immutable installed tag (AD-37), but the current deployment
points `config/ags` at that tag. `bar/services/speedtest-service.ts` writes
`$XDG_CONFIG_HOME/ags/wifi-speedtest.json` and `wifi-speedtest-last.json`, which
therefore land inside the tag. A tag bump resets the user's interval, server
mode and last measurement. `wifi-speedtest.json` at the repo root is only a
legacy seed default, not user state.

## Scope

App-side prerequisite only. The host-side link flip, app-list entry and restart
lane stay with `ags-apps` REQ-015 and the runtime/provisioning repos.

## Done when

- [ ] The service reads/writes its config and last-run JSON under
      `$XDG_STATE_HOME/ags/` (or an equivalently stable XDG path outside the
      install tree), with a one-time migration from the existing
      `$XDG_CONFIG_HOME/ags/` files.
- [ ] `wifi-speedtest.json` in the repo is either retired or explicitly a seed
      that provisioning owns; it is never the read/write target after cutover.
- [ ] A tag-bump test proves interval, server mode and last measurement survive.
- [ ] `colors.css` is verified as the stable runtime pointer outside the tag;
      the app does not create or write it.
- [ ] `icons.json` has one producer (pinned `dotfiles-assets` artifact) and
      provisioning verifies byte equality instead of writing it.
- [ ] No GUI or host change is made by this repo; the cutover evidence lands in
      `ags-apps` REQ-015.

## Evidence

- `bar/services/speedtest-service.ts:64,72` — current config/last-run paths.
- `app.tsx:141,152` — `theme.apply()` and the config-dir audio stylesheet.
- `README.md#cutover-state-migration-wifi-speedtest` — documented migration.
- `ags-apps/tickets/REQ-015-migrate-bar-standalone/ticket.md` — cutover
  acceptance.
