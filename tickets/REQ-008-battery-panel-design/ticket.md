---
id: REQ-008
title: "Redesign the battery panel as an anchored popover"
kind: requirement
status: in-progress
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-008/
branch: ticket/REQ-008-battery-panel-design
---

# Redesign the battery panel as an anchored popover

Design-only ticket. The deliverable is the interactive mock and this criteria
contract; bar source is unchanged. This is the battery sibling of the approved
sound panel (REQ-005) and Wi-Fi panel (REQ-007), using the same control-centre
language: one glass chrome layer, no accent frame, accent only for
selected/action, sentence case, 8 px rhythm and 40–44 px primary targets.

> **Ticket id.** `tickets/INDEX.md` ends at REQ-007; the next free id is REQ-008.

## Two problems to fix

1. **Charging with no estimate reserves an empty hero.** `formatBatteryTime()`
   returns `{ primary: "", sub: "Charging" }` when `timeToFull` is absent or
   invalid (`components/battery/presentation.ts:335-349`). The hero renders
   `primary` and `sub` as two labels (`BatteryContent.tsx:301-315`), so the 30 px
   primary line is blank and the panel reserves height for a number that never
   comes. The fix is a hero that always carries a fill bar, a percentage, a
   primary state word or time, and a detail line. **Never invent a time.**
2. **The panel wastes vertical space.** The 312 px surface
   (`BatteryPopup.tsx:14-18`) combines a 72×54 mode rail, a conditional variant
   block, a two-line meta block and the hero (`style.css:1238-1362`). The mode
   rail also uses an uppercase micro-label (`style.css:1296-1307`). The 352 px
   surface should be used deliberately: compact header, useful hero, compact
   mode control, a variant row only when needed, one meta line and a quiet
   footer.

## Requirement

Replace the current drawer with a **352 px anchored popover** 8 px under the
bar's battery indicator, with the desktop and an editor window visible behind
it. It is one glass surface: 18 px radius, 1 px hairline, one soft shadow, no
accent frame and no nested cards. The bar's battery icon is highlighted while
the popover is open.

The surface has four parts.

1. **Compact header.** Battery glyph, `Battery`, percentage right. No switch and
   no gear: the current panel has neither, so the mock adds neither.
2. **Hero, always full.** A horizontal battery fill bar with a charging bolt
   when charging, plus the percentage in the header and detail line. The hero
   always carries:
   - a fill bar (green when charging/full, neutral when discharging, empty when
     unknown);
   - a **primary** line: the estimate (`1h 12m`) when available, otherwise the
     honest state word (`Charging`, `Discharging`, `Full`, `—`);
   - a **sub** line: `full in`, `remaining`, `Estimating full time…`,
     `Plugged in`, or `No estimate`;
   - a **detail** line: `72% · 18.4 W`, `72% · estimating`,
     `100% · plugged in`, or `Capacity unavailable`.
   The primary line keeps the same height in every state, so the no-estimate
   branch looks deliberate rather than half-loaded.
3. **Power mode.** A compact three-option segmented control with the existing
   glyphs/labels `Powersave`, `Balanced`, `Performance`, one selected state and
   `disabled` until `powerReady`. There is no tall icon rail and no uppercase
   section label. A fourth `Unlisted` segment appears only when an undeclared
   tier is actually present.
4. **Variants.** Rendered only when the selected mode declares more than one
   variant, as compact chips (`Powersave++`, `Powersave`). The selected chip
   carries the accent. One line beneath names the active profile and tier
   (`Powersave++ · Superpowersave tier`); unlisted reads
   `Quiet · unlisted mode · unmapped tier`. Balanced has no variant row.
5. **Quiet footer.** A `Power Options` row that preserves the
   `power-options-gtk` handoff. The whole row is the target; there is no
   decorative chevron. A small external-link cue plus
   `opens power-options-gtk` says where it goes.

### Hero states

| State | Primary | Sub | Detail | Fill |
| --- | --- | --- | --- | --- |
| Charging, estimate | `1h 12m` | `full in` | `72% · 18.4 W` | 72%, green, bolt |
| **Charging, no estimate** | `Charging` | `Estimating full time…` | `72% · 18.4 W` | 72%, green, bolt |
| Discharging, estimate | `1h 47m` | `remaining` | `68% · 9.6 W` | 68%, neutral |
| Discharging, no estimate | `Discharging` | `No estimate` | `68% · estimating` | 68%, neutral |
| Full / plugged in | `Full` | `Plugged in` | `100% · plugged in` | 100%, green |
| Unknown | `—` | `No estimate` | `Capacity unavailable` | empty |

The no-estimate case is the key review state: it uses the same hero height as
the estimate case, fills the former number slot with `Charging`/`Discharging`,
and keeps the percentage and rate/estimate detail. `—` is only for a missing
capacity reading, never for a missing time.

## Interaction

- **Mode click** selects that mode. If it is already active, the current variant
  is kept; otherwise the mode's first daemon-order variant is selected. The
  selected segment, variant chips and meta line update together.
- **Variant click** changes the active profile; the mode stays selected and the
  meta line updates.
- **Footer click** simulates `power-options-gtk` with a toast. No real process is
  started, no D-Bus call is made and no profile is written by the mock. The real
  panel keeps `setPowerProfile` through `power-service.ts`.
- **Battery / unlisted / loading.** A missing daemon leaves the mode control
  visibly disabled with `Loading power profiles…`; an undeclared tier is shown,
  not dropped; an unknown capacity is stated honestly.
- **Dismissal.** Esc closes the panel; an outside click closes it; the bar icon
  toggles it. The bar icon is active while open.

## States

| State | What the surface says |
| --- | --- |
| Charging + estimate | Time, `full in`, `% · rate`, green fill + bolt. |
| Charging, no estimate | `Charging`, `Estimating full time…`, `% · rate`; same hero height. |
| Discharging + estimate | Time, `remaining`, `% · rate`, neutral fill. |
| Discharging, no estimate | `Discharging`, `No estimate`, `% · estimating`. |
| Full / plugged in | `Full`, `Plugged in`, `100% · plugged in`, no bolt. |
| Unknown | `—`, `No estimate`, `Capacity unavailable`, empty bar. |
| Profile loading | Modes disabled, `Loading power profiles…`; no fake selection. |
| Unlisted tier | Fourth `Unlisted` segment selected; `Quiet · unlisted mode · unmapped tier`. |
| Mode with one variant | No variant row; meta names the profile and tier. |
| Mode with >1 variants | Chips plus one meta line. |

## Acceptance

Design deliverable:

- [x] `mock.html` is one self-contained file with no external URLs, `<img>`,
      `url(...)` assets or build step.
- [x] The popover is 352 px wide, anchored 8 px under the bar's battery icon,
      over a visible desktop/editor, with one glass layer, 18 px radius, 1 px
      hairline and one soft shadow. No accent frame.
- [x] The bar's battery icon is highlighted while open.
- [x] The header is compact: battery glyph, `Battery`, percentage right. No
      switch and no gear.
- [x] The hero always carries a fill bar, primary, sub and detail. The
      no-estimate charging state reads `Charging` / `Estimating full time…` /
      `72% · 18.4 W` at the same hero height as the estimate state. No invented
      time and no reserved blank.
- [x] The hero carries the percentage in the header and detail line, and the
      fill bar turns green with a bolt when charging, is neutral when
      discharging and is empty when unknown.
- [x] The primary line covers `1h 12m`, `Charging`, `1h 47m`, `Discharging`,
      `Full`, and `—`; the sub line covers `full in`, `Estimating full time…`,
      `remaining`, `No estimate` and `Plugged in`.
- [x] The detail line covers `% · rate`, `% · estimating`, `100% · plugged in`
      and `Capacity unavailable`.
- [x] Power mode is a compact three-option segmented control with the existing
      glyphs/labels, selected state and disabled-until-`powerReady` behaviour.
      No tall rail and no uppercase section label.
- [x] A fourth `Unlisted` segment appears only when an undeclared tier exists;
      the four labels are not clipped.
- [x] The variant row renders only when the selected mode has more than one
      variant; Balanced renders no row. Chips and the one-line meta update on
      click and deep link.
- [x] The footer is a quiet `Power Options` row with an external-link cue, no
      decorative chevron, and preserves the `power-options-gtk` handoff
      (simulated in the mock).
- [x] Profile loading, unlisted, variant present/absent, battery unknown and
      no-estimate states are present with honest copy.
- [x] Deep links work for every review state listed below.
- [x] No uppercase micro-labels; sentence case throughout. Accent is used only
      for the selected mode/variant, not as a panel frame.
- [x] The DOM harness passes 90/90 checks at 1600×1000 and 1280×800.
- [x] No bar source was changed and no app→app import was added.

Implementation acceptance is intentionally out of scope for this ticket; see
Follow-up.

## Mock path

`tickets/REQ-008-battery-panel-design/mock.html` (no external URLs, no `<img>`,
no `url(...)` asset references).

Open it directly:

```sh
google-chrome-stable --new-window \
  "file:///home/inumaki/Development/dotfiles/ags-bar/.worktrees/REQ-008/tickets/REQ-008-battery-panel-design/mock.html"
```

## Deep links

| Query | State |
| --- | --- |
| `?charge=eta` | Charging 72%, `1h 12m`, `full in`, `72% · 18.4 W`. |
| `?charge=noeta` | Charging 72%, no full-time estimate; **the key empty-hero fix**. |
| `?discharge=eta` | Discharging 68%, `1h 47m`, `remaining`, `68% · 9.6 W`. |
| `?discharge=noeta` | Discharging 68%, no estimate, `68% · estimating`. |
| `?full=1` | Full 100%, `Full`, `Plugged in`, `100% · plugged in`. |
| `?unknown=1` | No capacity reading; `—`, `No estimate`, `Capacity unavailable`. |
| `?mode=powersave` | Powersave mode with its variants; `Powersave++` selected by default. |
| `?mode=balanced` | Balanced mode; no variant row. |
| `?mode=performance` | Performance mode; `Performance` / `Ultraperformance` chips. |
| `?variant=superpowersave` | Select `Powersave++`; implies Powersave mode. |
| `?variant=powersave` | Select `Powersave`; implies Powersave mode. |
| `?unlisted=1` | Add `Quiet` on the undeclared `Lowpower` tier and select it. |
| `?loading=1` | Power profiles not answered; modes disabled. |
| `?rate=0` | Review helper: no rate binding, so the detail falls back to `% · estimating`. |
| `?panel=closed` | Review helper: start with the popover closed; the bar icon reopens it. |

Precedence: `loading` > `unlisted` > `variant` > `mode` > battery state.

## Source of truth and drift rule

- Normative mock: `mock.html`; sha256
  `2944b329d2e69a73b4c6e1fe8a59efdace2336e53ab83613e2051362872ef3f1`
  (recorded in `mock.sha256`).
- This ticket is the **criteria** source of truth; the mock is the **look and
  interaction** source of truth.
- Any change to `mock.html` must update this ticket and `mock.sha256` in the
  same commit. Any criteria change must update the mock in the same commit. If
  they disagree, fix one before merging.
- The app-local ticket + mock are canonical; there is no separate
  composition-level battery contract.

## Assumptions and deviations

1. **Design only.** No bar source, service or CSS was changed; the worktree
   contains only the ticket, mock, index and README entry.
2. **Charge rate is a proposal.** The current panel binds only
   `percentage`, `charging`, `timeToFull` and `timeToEmpty`
   (`BatteryContent.tsx:50-54`); it does not bind `energyRate`. Implementation
   may add an `energyRate` (or UPower `energy-rate`) binding and render one
   decimal in watts. Until then the detail must fall back to
   `% · estimating`, never blank. `?rate=0` shows that fallback.
3. **Full needs a state, not just the boolean.** The current `charging` binding
   cannot distinguish “charging toward full” from “fully charged”. The mock
   uses a `Full` state for 100% and plugged in. Implementation should read the
   battery `state` (fully charged) where available; if only `charging` exists,
   `100% + plugged in` is the fallback.
4. **Unlisted is a fourth segment, not a second rail.** It appears only when
   the daemon reports an undeclared tier, so the normal control stays three
   options and the panel does not grow a second row.
5. **Panel width is an app literal.** 352 px is not a layout token; it becomes
   skin-remappable only if the appearance plane adds a
   `layout.ags.battery-panel-width` token.
6. **No settings entry.** The current panel has no switch or gear, so the mock
   adds no settings surface and no config file. The footer is the only handoff.
7. **No writes in the mock.** Mode and variant clicks update the mock’s local
   state. The real app keeps `setPowerProfile` and the daemon’s
   `active_profile` index as the source of selection.
8. **Ticket id.** REQ-008, the next free id after REQ-007.
9. **“Power Options” casing** is the existing product label, not an uppercase
   micro-label; the section label is sentence-case `Power mode`.

## Evidence

- `node --check` on the extracted mock script: exit 0.
- Static scan: no `http(s)://`, `<img>` or `url(...)`; no duplicate ids.
- `make test`: 22/22 unit suites, the symbol check and the test-program
  typecheck pass (docs-only change; no bar source touched).
- Chrome 154.0.8037.92 headless screenshots at 1600×1000 and 1280×800.
- DOM harness: 90/90 checks passed. It covers panel geometry and chrome,
  default charging estimate, **charging with no estimate and equal hero
  height**, discharging with/without estimate, full, unknown, Balanced without
  variants, Performance chip selection, variant deep links, mode clicks,
  unlisted (four segments, no clipping), loading/disabled, footer toast, Esc,
  outside click, bar-icon reopen and the 1280 fit.
- Screenshots:
  - `/tmp/opencode/req008-charging-eta-1600.png`
  - `/tmp/opencode/req008-charging-noeta-1600.png` (the empty-space fix)
  - `/tmp/opencode/req008-discharging-1600.png`
  - `/tmp/opencode/req008-full-1600.png`
  - `/tmp/opencode/req008-variant-1600.png`
  - `/tmp/opencode/req008-balanced-1600.png`
  - `/tmp/opencode/req008-charging-eta-1280.png`

## Follow-up (implementation)

- **Surface.** Change `batterySurface.width` from 312 to 352
  (`BatteryPopup.tsx:14-18`); keep the existing `PopupHost` anchor and
  `keyboard: none`.
- **Hero.** Replace the two-label hero (`BatteryContent.tsx:301-315`) with the
  fill bar + primary/sub/detail block. Extend the pure presentation layer with
  the detail decision and the charging/discharging/full/unknown state. Keep
  `formatBatteryTime` as the one place that decides the words, but stop
  returning an empty `primary`; update `formatBatteryStatusLine`
  (`presentation.ts:351-372`) and its tooltip caller together, because it
  currently keys off `primary === ""`.
- **Rate.** Bind `energyRate`/`energy-rate` or fall back to `% · estimating`.
  Do not invent a wattage.
- **Power mode.** Replace the 72×54 `ModeRail` and the uppercase
  `.battery-mode-label` with the compact segmented control. Keep the existing
  mode glyphs and the daemon-index selection logic.
- **Variants and meta.** Keep `showVariantControl` (mode has >1 profile) and
  collapse the current name + mode + tier lines into the single meta line.
  Remove the `VARIANT` uppercase label.
- **Footer.** Keep `openPowerOptionsGtk`; replace the `›` chevron with the
  external-link cue and keep the whole row clickable
  (`BatteryContent.tsx:350-359`).
- **Tests.** Add presentation cases for the no-estimate primary/sub and detail
  fallback, plus a render test that the hero has non-zero primary height in
  every state. Keep the rate absent path blank-free.
- `make test` / `make typecheck` / `make gates`; bump the composition pin if the
  bar tag changes.
