---
id: REQ-026
title: "Long-label truncation on the v0.6.32 display-clock candidate"
kind: requirement
status: in-progress
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-025/
branch: ticket/REQ-025-display-clock
---

# Long-label truncation (ported to v0.6.32)

> Port the v0.6.31 label cap onto the staged v0.6.32 display-clock candidate.
> No 1 s MPRIS poll, no per-channel/Mixer code, no skin change, no live switch.

## Fix

- Panel Playing page: app name `maxWidthChars={22}`, title `{30}`, artist `{30}`
  with `Pango.EllipsizeMode.END`; the title keeps its full-text tooltip.
- Tray: source name `{18}`, title `{26}`, artist `{26}`, Players name `{18}`,
  Players track `{20}` with end ellipsis; the title keeps its tooltip.
- Fixed surface widths stay 352 px (panel) / 300 px (tray). No CSS/skin width
  rule; no Mixer change.

## Preserve

- Display-only clock: `displayPositionUs` from the adapter snapshot + local
  250 ms render tick; no periodic MPRIS read; page switch immediate; pause
  static; seek rebases.
- App-level Mixer/focused-tab behavior untouched.

## Tests

- `tests/validation/audio-label-truncation.test.mjs` (5): panel/tray labels
  capped, tooltips retained, widths 352/300, no CSS width rule.
- The display-clock regressions continue to assert no poll/refreshPosition and
  the local clock.
- Bar gates; stage `apps/bar/v0.6.33`; no live switch/restart.

## Implementation record (2026-11-17)

Commit: `3556faa` fix(REQ-026): cap panel and tray media labels on the
display-clock candidate.

```text
$ make test
tests/ts:          186 tests 186 pass 0 fail
tests/validation:   41 tests  41 pass 0 fail
symbol check:      SYMBOL CHECK OK
test tsc:          0 type errors   (exit 0)
$ make typecheck   OK: 0 errors in the ags-bar tree
$ make bundle      OK: build/ags-bar.js (3088876 bytes)
$ make conformance exit 0
$ make drift       exit 0
```

Label test: `tests/validation/audio-label-truncation.test.mjs` 5/5.
Display-clock tests still green (TS 7/7, validation 6/6); no `refreshPosition`
or 1 s timer in the panel/tray, no `mixerRows`.

Staged at `~/.local/share/dotfiles/apps/bar/v0.6.33`; live links remain
`apps/bar/v0.6.16` and the service was not restarted.

Owner test plan (same as v0.6.32, plus labels):

1. Point both links at `apps/bar/v0.6.33` and restart.
2. Firefox progress advances; pause holds; seek jumps and continues.
3. Tidal → Chrome → Tidal shows the current Tidal position immediately.
4. Thanatos/Neon Genesis long title: panel and tray truncate with an ellipsis
   and do not widen; the Players rows stay inside 300 px; the title tooltip
   shows the full text.
5. Rollback to `apps/bar/v0.6.16` and restart.
