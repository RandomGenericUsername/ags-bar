# Ticket index

> Counting rule: completeness checks cover item files (`tickets/<id>-<slug>/ticket.md`) only.
> `tickets/_template/` (and any `tickets/_fixtures/`) are excluded from INDEX completeness counting.
> Entry format: link — title | `status` | execution links. Epics add `done/total children done`, done-when, and one nested line per child. Bugs add severity. Spikes add timebox state.

## Epics

(none)

## Requirements

- [REQ-001-standalone-bar-extraction/ticket.md](./REQ-001-standalone-bar-extraction/ticket.md) — Extract the bar into the standalone ags-bar repo | `done` | links: worktree none, branch main
- [REQ-002-theme-roles/ticket.md](./REQ-002-theme-roles/ticket.md) — Migrate the bar CSS to semantic tpr roles (Phase B) | `done` | links: worktree `.worktrees/REQ-002/`, branch `ticket/REQ-002-theme-roles`
- [REQ-003-skin-plane-pilot/ticket.md](./REQ-003-skin-plane-pilot/ticket.md) — Pilot the skin plane in the bar at USER priority | `done` | links: worktree `.worktrees/REQ-003/`, branch `ticket/REQ-003-skin-plane-pilot`
- [REQ-004-appearance-migration/ticket.md](./REQ-004-appearance-migration/ticket.md) — Migrate the bar to the v2 Appearance plane | `done` | links: worktree `.worktrees/REQ-004/`, branch `ticket/REQ-004-appearance-migration`

## Bugs

(none)

## Ops tasks

- [OPS-001-cutover-state-migration/ticket.md](./OPS-001-cutover-state-migration/ticket.md) — Move wifi-speedtest state and verify install-time artifacts before cutover | `done` | links: worktree `.worktrees/OPS-001/`, branch `ticket/OPS-001-cutover-state-migration`
- [OPS-002-green-colors-pointer-conformance/ticket.md](./OPS-002-green-colors-pointer-conformance/ticket.md) — Green the conformance gate for the committed colors.css pointer | `done` | links: worktree none, branch main

## Spikes

(none)

## Tasks

(none)

## Done (links only, newest last)

(none)
