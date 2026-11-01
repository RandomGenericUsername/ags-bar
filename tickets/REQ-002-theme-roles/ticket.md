---
id: REQ-002
title: "Migrate the bar CSS to semantic tpr roles (Phase B)"
kind: requirement
status: in-progress
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-002/
branch: ticket/REQ-002-theme-roles
---

# Migrate the bar CSS to semantic tpr roles (Phase B)

## Requirement

Replace every legacy `@color_*` reference in the bar's GTK CSS with the
semantic `palette.v1` role names that `ags-platform` v0.4.0 projects into the
one composed provider. The legacy sheet stays applied; the bar keeps its
startup-only `theme.apply()` path and its `restart` mode.

The migration maps by **intent per site**, not by carrier index. Geometry,
spacing, radii, alpha values, selectors and behaviour do not change. Only the
color token (and, where a solid fill changes polarity, the matching ink token)
changes.

## Acceptance

- [ ] `style.css` and `audio/audio-panel.css` contain zero `@color_*` tokens
      (including comments); no other CSS/TS/TSX file references them.
- [ ] Every replacement is a role in the live `palette.v1` vocabulary
      (`@surface`, `@on_surface`, `@primary`, `@on_primary`, `@tertiary`, …).
- [ ] The palette is still applied once at startup through the platform Theme
      port; no `palette-refresh` handler, no `colors.css` edit, no `app.tsx`
      change.
- [ ] Slider/switch/selection contrast is preserved where the old token was a
      fill behind text; deviations from the carrier-index table are recorded
      below with old-palette evidence.
- [ ] `make test`, `make conformance`, `make drift`, `make bundle` and
      `make typecheck` pass on the branch.
- [ ] Before/after visual evidence is captured where Hyprland IPC allows it;
      otherwise the exact eyeball checklist is recorded.

## Migration table

Legend: **old** is the CSG carrier the bar was written against; **role** is the
tpr semantic role. The old-palette values quoted below are from the cached CSG
palette the comments themselves cite (`bf8d752…`, where `color_13 = #dbab67`).

### `style.css`

| Old token | Site (selector / line) | Role | Rationale |
|---|---|---|---|
| `@color_foreground` | all text/ink + `alpha()` hairlines/washes | `@on_surface` | The bar's ink role; the comments call it `FOREGROUND` text. |
| `@color_00` | `.rec-cluster`, `.rec-popup`, `.settings-catcher-fill`, `.settings-surface`, `.audio-surface`, live-dot ring | `@surface` | Panel/dish background (`surface-panel = alpha(color_00,.94)`). |
| `@color_background` | `.workspace-indicator button.active` text | `@on_primary` | Inverted text on the solid field; the fill is now `@primary`. |
| `@color_background` | `.rec-popup-action` fill | `@surface` | This is a translucent panel fill, not text. |
| `@color_01` | `.workspace-indicator button.active` fill | `@primary` | The one solid field with inverted text; the table's primary/on-primary pair. |
| `@color_01` | `.settings-card`, `.settings-tile`, `.settings-mini`, `.settings-password`, `.audio-section` card tints | `@surface_container_high` | Old `color_01` was a neutral raised field (`#575660` in the cited palette), not the accent. A neutral surface container keeps the cards subtle instead of tinting them accent. |
| `@color_01` | `.settings-field-input` solid fill | `@surface_container_highest` | The comment says "fields are surfaces, not holes"; old `color_01` was neutral `#575660`. A primary fill would invert a dark field to a bright accent and make the caret/placeholder pairing wrong. |
| `@color_03` | capture paused/danger, `.settings-rowact.danger`, field error/message/security text | `@tertiary` | Attention/paused/destructive role. |
| `@color_04` | `.settings-surface`, `.audio-surface`, `.settings-mini:hover` borders | `@primary` | Accent border. |
| `@color_06` | `.settings-btn.join` fill | `@surface_container_high` | Muted pill/button fill. |
| `@color_10` | `.settings-net.sel` fill | `@primary_container` | Selected **container** behind nested labels/actions; keeps the existing light ink readable. |
| `@color_10` | `.settings-net.sel` text | `@on_primary_container` | Matching ink for the selected container. |
| `@color_10` | `.settings-net.sel .settings-net-sub` text | `alpha(@on_primary_container, 0.85)` | Same ink, dimmed. |
| `@color_10` | `.settings-switch:checked` track | `@primary` | ON/selected control state (the mock's blue ON). |
| `@color_10` | `.settings-rowact:hover`, `.audio-routing:hover/:active`, battery indicator/borders, run-button ink/tint | `@primary` | Hover/selected indicator and accent ink. |
| `@color_10` | `.audio-route-item:hover/:focus`, `.audio-device.active`, `.audio-master:hover/:focus` fills | `@primary_container` | Selected/focused **containers** behind existing light ink; a light `@primary` fill would erase the labels/icons. |
| `@color_10` | `.audio-menu-option.selected` fill / text | `@primary_container` / `@on_primary_container` | Selected menu container plus matching ink. |
| `@color_11` | `.settings-rowact.danger:hover` border/text | `@secondary` | Muted neutral counterpart to `@tertiary`. `@secondary_container` is a dark *fill* (2.0:1 as ink on surface) and would disappear. |
| `@color_11` | `.settings-stc-error` text | `@error` | The class is an error message; `@error` is the semantic role. |
| `@color_13` | accents: slider highlights, badge/chip/eye/spinner/check, connector badge, keyframes, caret | `@primary` | Accent fill/border/ink. |
| `@color_15` | slider thumb, switch knob, join hover border, audio badge text | `@on_surface` | Near-white knob/highlight. |

### `audio/audio-panel.css`

| Old token | Site | Role | Rationale |
|---|---|---|---|
| `@color_foreground` | all text/ink + `alpha()` hairlines/washes | `@on_surface` | Panel ink. |
| `@color_01` | `.audio-section` card tint | `@surface_container_high` | Neutral raised card, same as the settings cards. |
| `@color_06` | `.audio-transport .audio-icon-button:nth-child(2)` color | `@on_primary` | The icon art's circle is `primary` and its glyph is `on_primary`; this is the only role that stays visible if the CSS color is ever applied to the image. |
| `@color_10` | focus outlines, device-select/route-selector hover borders | `@primary` | Accent focus/hover indicator. |
| `@color_10` | `.audio-menu-option.selected` fill | `@primary_container` | Selected container behind text. |
| `@color_background` | `.audio-menu-option.selected` text | `@on_primary_container` | Matching ink for the selected container (never the page background). |
| `@color_13` | seek/level slider highlights | `@primary` | Accent fill. |
| `@color_15` | seek/level slider thumbs | `@on_surface` | Near-white knob. |

## Ambiguous sites (called out, not guessed silently)

- `@color_01` solid field: the proposed table says `@primary`, but the cited
  old palette resolves `color_01` to neutral `#575660`, and the field comment
  says "fields are surfaces, not holes". Used `@surface_container_highest` for
  the input and `@surface_container_high` for card tints; only the active
  workspace solid field (inverted text) uses `@primary`/`@on_primary`.
- `@color_10` selected rows: `@primary` is a light fill; the selected row and
  the route/device menu rows contain nested labels with their own ink. Used
  `@primary_container`/`@on_primary_container` for containers; `@primary` for
  borders, indicators, slider fills and button ink.
- `@color_11` as ink: `@secondary_container` is a dark container fill; as text
  on `@surface` it is ~2.0:1. Used `@secondary` for the danger hover and
  `@error` for the error message.
- `@color_06` on the audio transport button: the muted-pill rule points at
  `@surface_container_high`, but this site is the ink over the icon art's
  primary circle. Used `@on_primary`.
- `@color_15` knob on a light `@primary` switch track: `on_surface` is the
  prescribed near-white knob and is kept; the knob shadow provides separation.

## Evidence

Pending: gates, live palette role check and screenshots.
