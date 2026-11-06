---
id: REQ-003
title: "Pilot the skin plane in the bar at USER priority"
kind: requirement
status: in-progress
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

Environment repair (local-only, not committed): `node_modules/ags-platform`
pointed at a deleted worktree checkout; it is re-linked to the local
`ags-platform` repo before the gates run.

## Acceptance

- [ ] `app.tsx` imports `skin` from `ags-platform/adapters/skin` and calls
      `theme.apply()` then `skin.apply()` in `main()`, once each.
- [ ] No new request handler, no `palette-refresh`/skin-refresh path, no
      `wallpaper.state` subscription; the restart-mode conformance assertion
      is unchanged and passes.
- [ ] `SettingsPanel.tsx` reads `skinValue("layout.panel-width", 312)` and
      `BluetoothContent.tsx` reads
      `skinValue("layout.bt-list-spacing", 4)` on both list boxes, with the
      reasons recorded where a JSX prop/spec cannot take an accessor.
- [ ] `style.css` still carries the bundled glass fallback declarations; no
      structure, gesture, class or handler change.
- [ ] Makefile tuple is `ags-platform v0.7.0` / `contracts v0.6.0`; the
      conformance pin test agrees.
- [ ] Source-level validation tests assert the startup order, the absent
      refresh handler and the two token reads with fallbacks.
- [ ] `make gates` green with the local overrides recorded below.
- [ ] External render evidence is recorded: `/tmp/opencode/real-panel/fb2.png`
      vs `glass2.png` vs `flat2.png`; runtime-expanded CSS byte-identical to
      the assets-expanded CSS with sha256.
- [ ] `README.md`, `AGENTS.md` and `CHANGELOG.md` describe theme+skin
      application and the restart lane.
- [ ] Released as the next minor (`v0.4.0`) after gates; branch fast-forwarded
      into `main` and not left unmerged.

## Environment notes

- `node_modules/ags-platform` was re-linked with
  `make platform-dev AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform`
  after it pointed at the deleted
  `…/ags-platform/.worktrees/SPIKE-003` checkout. `node_modules/` is
  gitignored and not committed.
- The pins are local-only tags. Gates run with
  `AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform` and
  `CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts`; the Makefile
  defaults still name the frozen tuple for CI.
- Frozen pins: contracts `v0.6.0`, dotfiles-assets `v0.10.0`,
  ags-platform `v0.7.0`, dotfiles-runtime `v0.8.1`.

## Implementation

- `app.tsx`: `import { skin } from "ags-platform/adapters/skin"`;
  `skin.apply()` immediately after `theme.apply()` in `main()`.
- `settings-panel/SettingsPanel.tsx`: surface width through
  `skinValue("layout.panel-width", 312)`. The surface spec declares a plain
  `number` (`kit/surface.ts`), so the read is the accessor's `.peek()` at the
  point the host reads the width (after `skin.apply()`).
- `components/bluetooth/BluetoothContent.tsx`: the two list boxes
  (Paired, Available Devices) read
  `skinValue("layout.bt-list-spacing", 4)`; gnim's JSX props accept an
  `Accessor`, so they receive the accessor directly.
- `tests/validation/skin-plane.test.mjs`: source-level contract assertions.
- `Makefile`, `tests/app-contract.test.mjs`, `README.md`, `AGENTS.md`,
  `CHANGELOG.md`: tuple and documentation.
- `.github/workflows/ci.yml`: tuple refs.

## Evidence

Evidence is recorded after implementation and gates; see the closeout section.
