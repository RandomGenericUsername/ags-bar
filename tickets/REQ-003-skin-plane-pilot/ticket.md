---
id: REQ-003
title: "Pilot the skin plane in the bar at USER priority"
kind: requirement
status: done
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-003/
branch: ticket/REQ-003-skin-plane-pilot
---

# Pilot the skin plane in the bar at USER priority

## Requirement

Consume the frozen skin plane in the bar without redesigning it. A skin is
palette/ink + paint + rhythm; it carries no structure or variant, so layout
tokens remain TSX-owned.

The app composes appearance in this order at startup:

1. `theme.apply()` installs the palette provider (as today);
2. `skin.apply()` installs the runtime-expanded skin provider **last**, at
   `GTK_STYLE_PROVIDER_PRIORITY_USER` (800), so it overrides the bundled
   `style.css` glass fallback.

Artifacts (runtime-owned, never written by the app):

- `$XDG_CONFIG_HOME/ags/skin.css` — runtime-expanded CSS;
- `$XDG_STATE_HOME/dotfiles/current/skin.json` — grouped token map, raw
  numbers.

Manifest skins in scope: `glass` (default; parity with today), `flat`, `paper`.

The bar stays `restart` with no `palette-refresh` handler, no wallpaper
subscription and no skin-refresh request. The runtime's serialized restart lane
is the refresh path.

Two TSX-owned layout tokens are consumed:

- `layout.panel-width` (fallback `312`) at the settings surface width;
- `layout.bt-list-spacing` (fallback `4`) for the Bluetooth list rhythm.

All other spacing/size constants, widget structure, class vocabulary, gestures,
handlers and the request surface stay untouched. `style.css` remains the
bundled glass fallback: absence of skin artifacts must keep today's rendering.

## Acceptance

- [x] `app.tsx` imports `skin` from `ags-platform/adapters/skin` and calls
      `theme.apply()` then `skin.apply()` in `main()`, once each.
- [x] No new request handler, no `palette-refresh`/skin-refresh path, no
      `wallpaper.state` subscription; the restart-mode conformance assertion
      is unchanged and passes.
- [x] `SettingsPanel.tsx` reads `skinValue("layout.panel-width", 312)` and
      `BluetoothContent.tsx` reads
      `skinValue("layout.bt-list-spacing", 4)` on both list boxes, with the
      reasons recorded where a JSX prop/spec cannot take an accessor.
- [x] `style.css` still carries the bundled glass fallback declarations; no
      structure, gesture, class or handler change.
- [x] Makefile tuple is `ags-platform v0.7.0` / `contracts v0.6.0`; the
      conformance pin test agrees.
- [x] Source-level validation tests assert the startup order, the absent
      refresh handler and the two token reads with fallbacks.
- [x] `make gates` green with the local overrides recorded below.
- [x] External render evidence is recorded: `/tmp/opencode/real-panel/fb2.png`
      vs `glass2.png` vs `flat2.png`; runtime-expanded CSS byte-identical to
      the assets-expanded CSS with sha256.
- [x] `README.md`, `AGENTS.md` and `CHANGELOG.md` describe theme+skin
      application and the restart lane.
- [x] Released as the next minor (`v0.4.0`) after gates; branch fast-forwarded
      into `main` and not left unmerged.

## Environment notes

- `node_modules/ags-platform` was re-linked with
  `make platform-dev AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform`
  after it pointed at the deleted
  `…/ags-platform/.worktrees/SPIKE-003` checkout. `node_modules/` is
  gitignored and was not committed.
- The pins are local-only tags. Gates ran with
  `AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform` and
  `CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts`; the Makefile
  defaults still name the frozen tuple for CI.
- Frozen pins: contracts `v0.6.0`, dotfiles-assets `v0.10.0`,
  ags-platform `v0.7.0`, dotfiles-runtime `v0.8.1`.

## Implementation

- `app.tsx`: `import { skin } from "ags-platform/adapters/skin"`;
  `skin.apply()` immediately after `theme.apply()` in `main()`. No handler,
  no wallpaper subscription, no other startup change.
- `settings-panel/SettingsPanel.tsx`: `panelWidth = skinValue("layout.panel-width", 312)`;
  the surface spec's `width` is a getter returning `panelWidth.peek()`.
  Reason: `kit/surface.ts` types `width` as a plain `number`, not an
  accessor, and the host reads it from `PopupHost(...)` after `skin.apply()`
  has loaded the token map. A module-level literal read would always see the
  fallback.
- `components/bluetooth/BluetoothContent.tsx`:
  `btListSpacing = skinValue("layout.bt-list-spacing", 4)`; both list boxes
  (Paired at `:761`, Available Devices at `:809`) use
  `spacing={btListSpacing.peek()}`. Reason: gnim's JSX prop accepts its own
  `Accessor` class, not the platform's structural `ReadAccessor`, so the
  accessor is not assignable; the read happens at mount, which is sufficient
  in a restart-mode app. The unrelated `spacing={8}` at `:710` is the outer
  body layout, not the list rhythm, and is untouched.
- `tests/validation/skin-plane.test.mjs`: static assertions for startup
  order, unchanged request surface/restart lane, both layout-token reads and
  the retained glass fallback in `style.css`.
- `Makefile`, `.github/workflows/ci.yml`, `tests/app-contract.test.mjs`:
  tuple bumped to `ags-platform v0.7.0` / `contracts v0.6.0`.
- `README.md`, `AGENTS.md`, `CHANGELOG.md`: palette-then-skin startup,
  restart lane, skin artifacts and TSX-owned layout tokens.

## Evidence

### Environment repair

```text
$ make platform-dev AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform
==> platform-dev: node_modules/ags-platform -> /home/inumaki/Development/dotfiles/ags-platform
$ readlink -f node_modules/ags-platform
/home/inumaki/Development/dotfiles/ags-platform
$ test -f node_modules/ags-platform/adapters/skin.ts && echo SKIN_ADAPTER_OK
SKIN_ADAPTER_OK
```

`node_modules/` is gitignored; nothing from the repair is in a commit.

### Gates

Command (worktree root, branch `ticket/REQ-003-skin-plane-pilot` at
implementation commit `46c856c`):

```sh
AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform \
CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts \
make gates
```

Result: exit 0. Full log: `/tmp/opencode/ags-bar-req003-gates.log`.

| Gate | Result |
| --- | --- |
| `make test` — `tests/ts` | `tests 162`, `pass 162`, `fail 0` |
| `make test` — `tests/validation` | `tests 22`, `pass 22`, `fail 0` (includes `skin-plane.test.mjs`) |
| `make test` — symbol check | `SYMBOL CHECK OK` |
| `make test` — test-program tsc | `OK: 0 type errors in the pure-module test program` |
| `make conformance` | `tests 14`, `pass 14`, `fail 0` |
| `make drift` | `all checks passed` (20 checks, contracts v0.6.0) |
| `make bundle` | `OK: build/ags-bar.js (2772880 bytes)` |
| `make typecheck` | `OK: 0 errors in the ags-bar tree`; 29 tolerated `/usr/share/ags/js` errors, 0 `ags-platform` errors |

`make conformance` includes the unchanged restart/no-handler assertion
(`the bar is restart with no palette-refresh handler`) and the request-surface
assertion (`the bar keeps its complete request handler surface`). The new
`skin-plane` suite independently asserts the same source contract and the
startup order.

### Layout-token reads

- `settings-panel/SettingsPanel.tsx:23`: accessor with fallback `312`;
  `get width() { return panelWidth.peek() }` at `:32-34`.
- `components/bluetooth/BluetoothContent.tsx:38`: accessor with fallback
  `4`; `spacing={btListSpacing.peek()}` at `:761` and `:809`.
- The reason for `.peek()` at both sites is recorded in the source comments
  and in Implementation above.

### External render evidence

Directory: `/tmp/opencode/real-panel/`.

| File | sha256 | Shows |
| --- | --- | --- |
| `fb2.png` | `cc3a59787e5c947a47c120d47abbe945bdc1ee333a53ca21e0878037fcf3e7e3` | bundled `style.css` glass fallback, BT panel tree, 50 px rows |
| `glass2.png` | `21601ed768b555cc9dcce0b3e7103b593ebb49ef54e840dc2f3f63f672c4b2e5` | composed palette + expanded `glass` skin, 50 px rows |
| `flat2.png` | `6f876f3a8a4316f5918251e0785dbeaa2e67a84ae39d37fde683fd4d4b6ff7f8` | composed palette + expanded `flat` skin, transparent panel |

- `compare -metric AE fb2.png glass2.png` → `350.766 (0.000169158)`: glass is
  visually identical to the bundled fallback (0.017% of 2,073,600 pixels).
- `compare -metric AE fb2.png flat2.png` → `7119.76 (0.00343352)`: flat is the
  intentional transparent variant.
- Geometry from `/tmp/opencode/real-panel/log9.txt` (same probe run): glass
  rows `row1 794 376 350 50`, `row2 794 430 350 50`; flat rows
  `row1 794 376 350 47`, `row2 794 427 350 47`.
- The render probe composes the real `style.css` vocabulary and the actual
  runtime-expanded skin CSS in one GTK provider. It photographed the live
  session without stopping the user's bar. The probe installs the sheet at
  APPLICATION priority; USER-priority precedence is the platform adapter's
  tested contract and is not re-proven by this screenshot.

### Runtime-expanded vs assets-expanded CSS

`/tmp/opencode/skin-integration/sha256.txt`:

```text
assets-expanded (dotfiles-runtime v0.8.1 expander, assets v0.10.0)
342803184bc863f397d6eea0f965928d07c2d5864e86c82df83d7b70cc3f6f08  skin-integration/glass/ags.css
6a552ebe8db6bac3036f9cb437a7f6cf48d31ce4d7e7335ba17f74d1a0830167  skin-integration/flat/ags.css
dc89597b64008c03511f5bb3ed1d826242e40f82fff0b46b02cb3ecb6a02d060  skin-integration/paper/ags.css

runtime-expanded (used by the real-panel renders)
342803184bc863f397d6eea0f965928d07c2d5864e86c82df83d7b70cc3f6f08  real-panel/skin-glass-expanded.css
6a552ebe8db6bac3036f9cb437a7f6cf48d31ce4d7e7335ba17f74d1a0830167  real-panel/skin-flat-expanded.css
dc89597b64008c03511f5bb3ed1d826242e40f82fff0b46b02cb3ecb6a02d060  real-panel/skin-paper-expanded.css
```

The hashes match for all three skins. `dotfiles-assets` HEAD is
`v0.10.0-1-gd5f6e6d`; `git diff --stat v0.10.0..HEAD -- skins` is empty, so
the expanded artifacts are the pinned v0.10.0 artifacts.

### Runtime e2e

A full app launch is deferred to the provisioning integration ticket. The bar
is the user's live session, and a second instance still calls
`registerBluetoothAgent()` and starts the live services on the shared session
bus; an isolated XDG config would not isolate that. The bundle gate proves the
skin import resolves, and the external render evidence above exercises the
actual runtime-expanded CSS; the remaining end-to-end check is the host-side
provisioning of `skin.css`/`skin.json` plus the restart lane.

### Release and merge

- Planning commit: `ce793b4` — `tickets: file REQ-003 skin plane pilot`.
- Implementation commit: `46c856c` — `feat(REQ-003): pilot the skin plane at startup`.
- This closeout commit records the evidence and is fast-forwarded into `main`
  (no merge commit), then annotated as `v0.4.0` after the gates above.
- No tag was moved; `v0.3.0` and older remain untouched.

## Deviations

- `spacing`/`width` cannot take the platform `ReadAccessor` directly: gnim's
  JSX prop expects its own `Accessor` class, and the surface contract types a
  plain number. Both sites therefore use `.peek()` with the required fallback,
  as recorded above.
- The external render probe installs at APPLICATION priority; the app path's
  USER-priority ordering is the platform contract, not measured in that
  screenshot. Full app-level runtime evidence is deferred with the reason
  above.
