---
id: REQ-010
title: "Launch long-lived GUI apps in transient systemd scopes"
kind: requirement
status: done
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

- [x] `lib/scopedApp.ts` builds
      `systemd-run --user --scope --collect --quiet [--setenv=…] -- <argv…>`
      from an argv array and rejects apps outside the registry/allowlist.
- [x] `WAYLAND_DISPLAY`, `XDG_RUNTIME_DIR` and `DBUS_SESSION_BUS_ADDRESS` are
      forwarded with `--setenv` when present.
- [x] `lib/scopedLauncher.ts` logs launch failures and posts a notification;
      the helper resolves `false` instead of throwing.
- [x] All eight long-lived GUI launch sites use the helper; short-lived
      commands and `wlogout` stay on their current path.
- [x] `tests/ts/scoped-app.test.ts` covers command construction, environment
      forwarding, allowlist rejection, success and failure/toast handling.
- [x] The cgroup/restart rationale is documented in code and `README.md`.
- [x] `make gates` is green with the local platform/contracts checkouts.
- [x] Release is the next minor after `v0.6.1` (`v0.6.2`); the branch is
      fast-forwarded into `main`, then `main` and the tag are pushed.

## Environment notes

- Local checkouts: `ags-platform` v1.0.1 and `contracts` v0.8.0.
- Gates use `AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform`
  and `CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts`.

## Implementation

- `lib/scopedApp.ts:1-34` documents the cgroup/`KillMode=mixed` reason for the
  transient scope, `--collect`, environment forwarding and the allowlist, then
  declares the three preserved session variables.
- `lib/scopedApp.ts:42-95` is the fixed registry and executable allowlist:
  `hyprmod`, `power-options-gtk`, `pavucontrol`, `thunderbird`,
  `kitty -- btop`, `kitty -- wifitui tui`, `blueman-manager`,
  `nm-connection-editor`.
- `lib/scopedApp.ts:117-154` resolves an id (rejecting unknown or tampered
  argv) and builds the argv array
  `systemd-run --user --scope --collect --quiet [--setenv=…] -- <argv…>`.
  `--` keeps app arguments out of systemd option parsing; no shell is involved.
- `lib/scopedApp.ts:163-190` dispatches through injected `exec`, logging and
  notifying on failure and returning `{ ok: false }` instead of rejecting.
- `lib/scopedLauncher.ts:26-43` supplies `execAsync`, `GLib.getenv`, the
  `Notifier` card and the icon registry; returns `Promise<boolean>` so the Wi-Fi
  row can keep its inline remediation message.
- Launch sites migrated:
  - `settings-panel/controls/hyprmod.tsx:18` — `hyprmod`
  - `bar/widgets/audio.tsx:72` — `pavucontrol`
  - `bar/widgets/battery.tsx:79` — `power-options-gtk`
  - `components/battery/BatteryContent.tsx:162` — `power-options-gtk`
  - `bar/widgets/btop.tsx:20` — `kitty -- btop`
  - `bar/widgets/network-descriptor.tsx:49` — `kitty -- wifitui tui`
  - `bar/widgets/thunderbird.tsx:13` — `thunderbird`
  - `components/bluetooth/BluetoothContent.tsx:484` — `blueman-manager`
  - `components/wifi/WifiContent.tsx:610` — `nm-connection-editor`
- `bar/widgets/power-menu.tsx:18-23` keeps `wlogout` direct and records why:
  it is a transient logout overlay, not a long-lived app.
- `README.md:53-82`, `AGENTS.md:54-62` and `CHANGELOG.md:3-27` document the
  rationale, the fixed app set and the v0.6.2 release.
- `tests/tsconfig.tests.json` adds the pure `lib/scopedApp.ts` to the test
  program; `tests/ts/scoped-app.test.ts` has 11 tests.

## Evidence

### Scope and app audit

`rg -n 'execAsync' --include='*.ts' --include='*.tsx'` on the branch leaves
only these direct launches: MPRIS/pipewire commands (`wpctl`, `pw-dump`), the
capture-cluster client, `brightnessctl`, `pw-dump`/speedtest and `wlogout`.
All eight long-lived GUI launches listed above use `launchScopedApp`.

`rg -n 'launchScopedApp\('` finds exactly the nine call sites above (the two
`power-options-gtk` entry points share one registry id).

### Tests

```
node --import ./tests/ts/resolve-hooks.mjs --test tests/ts/scoped-app.test.ts
tests 11, pass 11, fail 0
```

The suite pins the exact `systemd-run` argv, the separate `kitty -- btop`
arguments, present/non-empty `--setenv` handling, unknown-id and tampered-argv
rejection, success without a toast, rejected and synchronous-throw failures
with both `logError` and `notifyFailure`, and no registry mutation.

### Gates

Command (worktree `.worktrees/REQ-010/`, branch
`ticket/REQ-010-scoped-app-launch`, implementation commit `025602f`):

```sh
AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform \
CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts \
make gates
```

Result: `GATES_EXIT=0`. Full log:
`/tmp/opencode/ags-bar-req010-gates.log`.

| Gate | Result |
| --- | --- |
| `make test` — `tests/ts` | `tests 173`, `pass 173`, `fail 0` (includes `scoped-app.test.ts` 11/11) |
| `make test` — `tests/validation` | `tests 22`, `pass 22`, `fail 0` |
| `make test` — symbol check | `SYMBOL CHECK OK` |
| `make test` — test-program tsc | `OK: 0 type errors in the pure-module test program` |
| `make conformance` | `tests 14`, `pass 14`, `fail 0` |
| `make drift` | `all checks passed` (contracts v0.8.0) |
| `make bundle` | `OK: build/ags-bar.js (2861488 bytes)` |
| `make typecheck` | `OK: 0 errors in the ags-bar tree`; 29 tolerated `/usr/share/ags/js` errors, 0 `ags-platform` errors |

`platform-dev` linked
`node_modules/ags-platform -> /home/inumaki/Development/dotfiles/ags-platform`
(v1.0.1); drift read
`CONTRACTS_REPO=/home/inumaki/Development/dotfiles/contracts` (v0.8.0). No
network fetch and no committed artifact.

### Commits and release

- Planning commit on `main`: `366d3b9` —
  `tickets: file REQ-010 scoped app launch`.
- Implementation commit: `025602f` —
  `feat(REQ-010): launch long-lived GUI apps in transient scopes`.
- Docs commit: `7e9788b` —
  `docs(REQ-010): document scoped launch rationale and v0.6.2`.
- This closeout commit records the evidence and is fast-forwarded into `main`
  (no merge commit), then annotated as `v0.6.2`, the minor after `v0.6.1`.
- `main` and the `v0.6.2` tag are pushed to `origin`; no existing tag is moved.
- Convention is tag-only: this repo has no GitHub Release workflow and prior
  releases are annotated tags without releases.

## Downstream pins (not edited here)

- `ags-apps`/engine app tag must move to `ags-bar` `v0.6.2`.
- `dotfiles-composition` (and any provision/runtime app-list) must pin the same
  `ags-bar` tag when this release is adopted.

No provisioning, runtime, assets, composition, contracts or live state was
edited, and nothing was applied.
