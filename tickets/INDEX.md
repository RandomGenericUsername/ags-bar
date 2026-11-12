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
- [REQ-005-sound-panel-design/ticket.md](./REQ-005-sound-panel-design/ticket.md) — Redesign the sound panel as an anchored popover | `in-progress` | links: worktree `.worktrees/REQ-005/`, branch `ticket/REQ-005-sound-panel-design`
- [REQ-006-generations-v3/ticket.md](./REQ-006-generations-v3/ticket.md) — Consume Generations v3 from the current state pointer | `done` | links: worktree `.worktrees/REQ-006/`, branch `ticket/REQ-006-generations-v3`
- [REQ-007-wifi-panel-design/ticket.md](./REQ-007-wifi-panel-design/ticket.md) — Redesign the Wi-Fi panel as an anchored popover | `in-progress` | links: worktree `.worktrees/REQ-007/`, branch `ticket/REQ-007-wifi-panel-design`
- [REQ-008-battery-panel-design/ticket.md](./REQ-008-battery-panel-design/ticket.md) — Redesign the battery panel as an anchored popover | `in-progress` | links: worktree `.worktrees/REQ-008/`, branch `ticket/REQ-008-battery-panel-design`
- [REQ-009-bluetooth-panel-design/ticket.md](./REQ-009-bluetooth-panel-design/ticket.md) — Redesign the Bluetooth panel as an anchored popover | `in-progress` | links: worktree `.worktrees/REQ-009/`, branch `ticket/REQ-009-bluetooth-panel-design`
- [REQ-010-scoped-app-launch/ticket.md](./REQ-010-scoped-app-launch/ticket.md) — Launch long-lived GUI apps in transient systemd scopes | `done` | links: worktree `.worktrees/REQ-010/`, branch `ticket/REQ-010-scoped-app-launch`

## Bugs

(none)

## Ops tasks

- [OPS-001-cutover-state-migration/ticket.md](./OPS-001-cutover-state-migration/ticket.md) — Move wifi-speedtest state and verify install-time artifacts before cutover | `done` | links: worktree `.worktrees/OPS-001/`, branch `ticket/OPS-001-cutover-state-migration`
- [OPS-002-green-colors-pointer-conformance/ticket.md](./OPS-002-green-colors-pointer-conformance/ticket.md) — Green the conformance gate for the committed colors.css pointer | `done` | links: worktree none, branch main
- [OPS-003-dev-pin-parity/ticket.md](./OPS-003-dev-pin-parity/ticket.md) — Bump the local ags-platform pin to v1.0.1 | `done` | links: worktree `.worktrees/OPS-003/`, branch `ticket/OPS-003-dev-pin-parity`
- [OPS-004-dev-pin-parity/ticket.md](./OPS-004-dev-pin-parity/ticket.md) — Bump the local program tuple to ags-platform v1.1.0 / contracts v0.12.0 | `done` | links: worktree `.worktrees/OPS-004/`, branch `ticket/OPS-004-dev-pin-parity`

## Spikes

(none)

## Tasks

(none)

## Done (links only, newest last)

(none)
- [REQ-011-sound-panel-qa/ticket.md](./REQ-011-sound-panel-qa/ticket.md) — Sound panel QA: single settings surface, mock header, no Mixer playback, thumbnails, position poll, content height, bare icons | `in-progress` | worktree: .worktrees/REQ-011/ | branch: ticket/REQ-011-sound-panel-qa
- [REQ-012-sound-panel-radius/ticket.md](./REQ-012-sound-panel-radius/ticket.md) — Muted big value + spawned settings/tray outer radius; host-radius verification | `in-progress` | worktree: .worktrees/REQ-012/ | branch: ticket/REQ-012-sound-panel-radius
