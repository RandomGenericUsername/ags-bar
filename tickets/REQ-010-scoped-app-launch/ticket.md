---
id: REQ-010
title: "Launch long-lived GUI apps in transient systemd scopes"
kind: requirement
status: in-progress
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-010/
branch: ticket/REQ-010-scoped-app-launch
---

# Launch long-lived GUI apps in transient systemd scopes

## Requirement

Implement decision D1-B: long-lived GUI applications launched from the AGS bar
or settings panel must run in their own transient systemd user scope, not as
children of `dotfiles-ags-bar.service`. The bar's unit uses `KillMode=mixed`, so
an AGS restart (explicit restart lane or crash) currently SIGKILLs a child such
as `hyprmod`, `power-options-gtk`, `pavucontrol` or Thunderbird.

Route every such launch through one shared helper:

- `lib/scopedApp.ts` is the pure core: a fixed registry/allowlist of launchable
  apps, argv construction for
  `systemd-run --user --scope --collect --quiet`, environment preservation and
  an injectable exec/log/notify surface.
- `lib/scopedLauncher.ts` is the live adapter: `execAsync`, `GLib.getenv`, the
  platform `Notifier` and the icon registry. Failures are logged and posted as
  a visible notification; they are never swallowed silently.
- No shell string concatenation: the command is always an argv array.

Long-lived apps migrated: `hyprmod`, `power-options-gtk`, `pavucontrol`,
`thunderbird`, `kitty -- btop`, `kitty -- wifitui tui`, `blueman-manager` and
`nm-connection-editor`.

Deliberately not migrated: short-lived commands owned by AGS (`brightnessctl`,
`wpctl`, `pw-dump`, MPRIS/speedtest helpers, the capture-cluster requests) and
the transient `wlogout` overlay, whose lifetime is the logout action itself.

Document the cgroup/restart rationale in `lib/scopedApp.ts` and `README.md`,
and add `v0.6.2` to `CHANGELOG.md`.

## Acceptance

- [ ] `lib/scopedApp.ts` builds
      `systemd-run --user --scope --collect --quiet [--setenv=…] -- <argv…>`
      from an argv array and rejects apps outside the registry/allowlist.
- [ ] `WAYLAND_DISPLAY`, `XDG_RUNTIME_DIR` and `DBUS_SESSION_BUS_ADDRESS` are
      forwarded with `--setenv` when present.
- [ ] `lib/scopedLauncher.ts` logs launch failures and posts a notification;
      the helper resolves `false` instead of throwing.
- [ ] All eight long-lived GUI launch sites use the helper; short-lived
      commands and `wlogout` stay on their current path.
- [ ] `tests/ts/scoped-app.test.ts` covers command construction, environment
      forwarding, allowlist rejection, success and failure/toast handling.
- [ ] The cgroup/restart rationale is documented in code and `README.md`.
- [ ] `make gates` is green with the local platform/contracts checkouts.
- [ ] Release is the next minor after `v0.6.1` (`v0.6.2`); the branch is
      fast-forwarded into `main`, then `main` and the tag are pushed.

## Environment notes

- Local checkouts: `ags-platform` v1.0.1 and `contracts` v0.8.0.
- Gates use `AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform`
  and `CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts`.

## Downstream pins (not edited here)

- `ags-apps`/engine app tag must move to `ags-bar` `v0.6.2`.
- `dotfiles-composition` (and any provision/runtime app-list) must pin the same
  `ags-bar` tag when this release is adopted.
