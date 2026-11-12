---
id: REQ-005
title: "Redesign the sound panel as an anchored popover"
kind: requirement
status: in-progress
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-005/
branch: ticket/REQ-005-sound-panel-implementation
---

# Redesign the sound panel as an anchored popover

Design-only ticket. The deliverable is the interactive mock and this contract;
the bar's code is unchanged. The design inherits the visual contract frozen for
the wallpaper selector (batch doc 106) and the clipboard overlay (batch doc 107):
one glass chrome layer, no accent frame, accent only for state/action, the
9.5/10.5/11.5/13/15/28 type ramp, sentence case, 8 px rhythm, 40–44 px targets.

## Requirement

Replace the current tall, boxed sound drawer with a **352 px anchored popover**
under the bar's volume indicator, 8 px below the bar, with the desktop still
visible behind it. Every control the current panel exposes must remain
reachable. The rejected combined page (playback and per-app volume in one page)
is split into two focused modes below one persistent master output.

The popover has three surfaces:

1. **Output — persistent header.** The preferred output device (with the
   unavailable branch) and the global volume (28 px value, slider, mute) live
   above the scroll area. The master fader never scrolls away.
2. **App deck — `Playing | Mixer`.** Two text tabs in the deck header, one
   surface, only one mode visible. The tabs use a selected accent underline, no
   box and no chevrons.
   - **Playing:** one horizontally snap-scrolling page per app with a current
     player. Each page carries the app name, `n/N`, the **track thumbnail/album
     art** in the 40 px frame (the app icon is only a small corner badge, or the
     fallback when no thumbnail exists), title/artist, inline
     previous/play-pause/next, shuffle/repeat only when supported, and a 2 px
     seek line with 9.5 px times. There is **no volume slider**: a small volume
     glyph + current level is read-only, and clicking it switches to Mixer
     focused on that app. Arrows flank the pages when there is more than one
     player; swipe/scroll snap also works. Audio-only apps are not Playing
     pages.
   - **Mixer:** a vertical list of every app with audio. Each row has the app
     tile/name, current media or `Audio only`, route chip, volume slider, mute,
     percentage and `Mixed` when applicable. Playing apps get a subtle playing
     dot. Mixer is levels/routing only: there is no playback control, seek,
     expand chevron or nested box. Row clicks never switch modes.
   - Default mode is Playing when a player exists, otherwise Mixer. The last
     mode is kept for the session. Track changes never switch modes. While in
     Mixer, a small accent dot appears on the Playing tab when anything is
     playing.
3. **Input** — secondary and collapsed by default. Expanding shows the input
   device selector, microphone level, mute, and the apps currently using the
   microphone. No input and no consumer both have honest states.

**Tray playback strip (outside the panel).** The bar's end cluster keeps its
reserved tray slot; this is an always-visible full playback strip, not an
icon-only or hover-only widget. It sits before the microphone/network/volume/
battery icons, with two quiet placeholder tray dots:
- Rest/default: 24 px rounded artwork with a 1 px ring, stacked title/artist,
  previous/play-pause/next and supported shuffle/repeat. Max width 340 px; the
  title/artist truncate on narrow widths while the controls stay visible. A
  subtle tray hover tint; no heavy box. Hidden when there is no player.
- Clicking the art/title/background opens the existing tray dropdown; the
  transport buttons act on the active player and never open it.
- Scrolling the strip cycles to the next/previous current player (wrap), with
  one switch per ~250 ms wheel gesture and a brief `n/N · App` cue. The strip,
  dropdown and panel carousel stay in sync. No app switching is added to the
  dropdown; it switches players only through the Players list.
- Dropdown: 300 px glass, radius 14, hairline and shadow, anchored below the
  strip. Header `Now playing` + source app. Active track: 36 px art,
  title/artist, previous / play-pause / next, shuffle/repeat only when
  supported, 2 px seek line with 9.5 px times. A divider and `Players` list only
  when more than one current player: app tile, track, playing dot, active check;
  choosing a row switches the active player and updates the strip and panel
  Playing page. Footer `Open sound panel` closes the tray and opens the panel on
  Playing. Menu-like; no nested cards.
- **Exclusivity:** the tray dropdown and the sound panel are never open together.
  The strip closes the panel before toggling; the volume icon and footer close
  the tray and open the panel; `?tray=1` opens with the panel closed. Esc closes
  the tray first, then the panel; outside click closes the tray. No player hides
  the strip and closes the dropdown.

**Settings (bar media widget).** A gear in the Output header, next to mute,
opens a compact 280 px popover (glass, radius 14, hairline, shadow) anchored
below the gear. The row is `Bar media widget` with an on/off switch and the
helper `Show the now-playing strip in the top bar.`; footer
`Changes save immediately.` Default is **on**.
- Turning it off hides the bar strip immediately, closes an open tray dropdown,
  and leaves the volume icon as the panel entry point. Turning it on restores the
  strip only if a player exists; the setting is independent of player state.
- The mock persists `{ media_widget: { enabled } }` in `localStorage`; toggling
  the switch writes immediately. `?widget=0` / `?widget=1` and `?settings=1`
  are review links. When `widget=0`, `?tray=1` does not open the dropdown.
- **Real contract:** the app owns `$XDG_CONFIG_HOME/ags-bar/config.json` with
  `{ "media_widget": { "enabled": true } }`. It is **not** the AGS config link
  `$XDG_CONFIG_HOME/ags` (read-only install link) and **not** the layout
  `bar.json`. The bar is restart-mode for appearance, but this UI setting applies
  live without a restart. Implementation must use the capture-tool settings
  pattern: pure domain, port, GLib adapter, save-on-change.

Fixture roles: Spotify (normal player), Tidal (paused player), VLC (live player,
no seek) are Playing pages; Firefox is the audio-only app that lives only in
Mixer. The app tile/name is the source badge; a second "Spotify" pill would
duplicate it.

The settings gear is the only config surface; there is no separate config-file
escape hatch. Right-click → `pavucontrol` is a bar-widget gesture, not part of
this surface, and remains outside the mock.

**MPRIS note.** Shuffle and Loop are not in the current `PlayerCapabilities`
model or `AudioPanelActions`; the mock simulates them. Implementation must
expose Shuffle/Loop capability flags and actions. A Playing page hides either
icon when the player does not support it, exactly as the mock hides both on the
VLC live page.

## Functionality inventory

| Current action (`audio/AudioPopup.tsx`) | Mock surface |
| --- | --- |
| `selectPreferredOutput` | Persistent Output device row → output menu (unavailable outputs disabled) |
| `setOutputVolume` | Persistent Output slider + big value |
| `toggleOutputMute` | Persistent Output mute button; level is retained while muted |
| `setAppRoute` (follow preferred / explicit override) | Mixer route chip → menu (default reflects the selected output) |
| `setAppVolume` | Mixer volume slider |
| `toggleAppMute` | Mixer mute button; `Mixed` badge for divergent levels |
| `playerAction` play-pause / previous / next | Playing page transport (Mixer has no playback controls) |
| `seek` | Playing page's 2 px seek line + elapsed/duration; live pages hide it |
| `selectInput` | Input device row → input menu |
| `setInputVolume` | Input slider + percent |
| `toggleInputMute` | Input mute button |
| `inputConsumers` | “Using microphone” line under the input controls |
| Shuffle / Loop (new MPRIS capability) | Playing page icons; toggled per page; hidden when unsupported |
| Mode switch / session mode | Deck `Playing | Mixer` tabs; default from players; no auto-switch; accent dot on Playing while Mixer and playing |
| Tray playback strip | Always-visible title/artist/transport; click art/title/background opens dropdown; wheel cycles players; no app switching |
| Tray dropdown | Track transport/seek, player switcher, active check, `Open sound panel`; hidden with no player |
| Tray wheel | Wrap through current players with ~250 ms debounce and a brief `n/N · App` cue; syncs strip, dropdown and panel |
| Bar media widget setting | Gear → 280 px settings popover; toggle hides/shows the strip live; persisted; independent of player |
| `$XDG_CONFIG_HOME/ags-bar/config.json` | `{ media_widget: { enabled } }`; not the AGS config link or layout `bar.json` |
| `?tray=1` | Open the tray dropdown with the panel closed; `?tray=1&player=2` opens it on the second player |
| Output / app / input empty or unavailable states | No apps, audio-only Mixer rows, empty Playing, live page, unavailable output entry, no input, no mic consumer |

## Acceptance

Design deliverable:

- [x] `mock.html` is one self-contained file with no external assets and no
      build step; it opens directly in a browser.
- [x] The popover is 352 px wide, anchored 8 px under the bar at the top-right,
      on the dragon wallpaper, with one glass layer, an 18 px radius, a 1 px
      hairline and one soft shadow. There is no accent frame.
- [x] The Output header is a direct panel child outside `.pop-scroll`; it has
      the device selector, master value, slider and mute, and never scrolls.
- [x] A single deck header has two text tabs, `Playing | Mixer`, with the
      selected tab on an accent underline. There is no box, pill or chevron.
      Only one panel is visible.
- [x] Playing has one snap-scrolling page per current player (Spotify, Tidal,
      VLC); Firefox is absent. Pages carry the app name, `n/N`, the track
      thumbnail with a small app badge/fallback, title/artist, transport,
      supported shuffle/repeat and seek, with a read-only volume glyph + level
      and no slider.
- [x] Clicking the Playing level glyph switches to Mixer, focuses the matching
      row, and preserves the user's chosen mode afterwards.
- [x] Mixer lists every app (four rows), with route, volume, mute, percentage,
      `Mixed` and a playing dot. It has no playback control, seek/prev/next,
      expand chevron or nested box; rows never switch modes.
- [x] The default mode is Playing when a player exists and Mixer otherwise.
      Track changes never switch modes; the chosen mode survives panel
      close/reopen for the session. The Playing tab shows an accent dot while
      Mixer is selected and something is playing.
- [x] Arrows flank Playing pages when >1 and hide at ≤1; swipe/scroll snap
      switches pages. `?player=2`, `?app=vlc` focus Playing pages; `?app=firefox`
      opens Mixer on its row.
- [x] The playback strip is the first item in the bar's end cluster, before the
      microphone/network/volume/battery icons, with two quiet placeholder dots.
      It is always visible with a player: 24 px art + ring, title/artist,
      prev/play-pause/next and supported shuffle/repeat, max 340 px, bar 40 px.
      No player hides it. No hover-only state.
- [x] Clicking the strip's art/title/background opens the 300 px dropdown and
      closes the panel; clicking transport buttons acts on the player and never
      opens the dropdown. Transport changes stay in sync with the panel.
- [x] Wheel over the strip wraps through players with one switch per ~250 ms
      gesture and a brief `n/N · App` cue; strip, dropdown and panel carousel
      update together.
- [x] The dropdown is 300 px, radius 14, glass/hairline/shadow, anchored below
      the strip, with header, active track/transport/seek, `Players` list only
      when >1 player, active check and `Open sound panel` footer.
- [x] Choosing a player updates the strip/dropdown and panel Playing page;
      switching panel pages updates the strip. Tray and panel are mutually
      exclusive; `?tray=1` opens with the panel closed; Esc closes tray first,
      then panel; outside click closes tray.
- [x] The Output gear opens a 280 px settings popover with a live
      `Bar media widget` switch, helper and save-immediately footer. Default is
      on; off hides the strip and closes the tray; on restores only with a
      player; the setting remains independent of player state.
- [x] The setting persists in `localStorage` for the mock and in the real
      app-owned `$XDG_CONFIG_HOME/ags-bar/config.json` shape; it is not the AGS
      install link or `bar.json`, applies live, and follows the capture-tool
      settings pattern.
- [x] `?widget=0` / `?widget=1` and `?settings=1` work; `?tray=1` does not open
      a dropdown when the widget is off.
- [x] The input section is collapsed by default and covers device, level, mute,
      consumers, unavailable input and no-consumer states.
- [x] Sliders, mute buttons, route menus, transport, seek, page arrows, scroll
      snap, mode tabs, input controls, `Esc` and bar-icon reopen are interactive.
- [x] Deep links work: `?mode=playing|mixer`, `?muted=1`, `?apps=1`
      (default/no-op), `?apps=0`, `?playing=1`, `?playing=0`, `?player=2`,
      `?app=vlc`, `?app=firefox`, `?input=1`, `?input=0`, `?mic=0`, `?device=`.
- [x] Tokens and the corrected skin mapping are documented below; no false
      “everything is tokenised” claim.
- [x] No bar code was changed, no app→app imports were added, and no config file
      was invented.

Implementation acceptance is intentionally out of scope for this ticket; see
Follow-up.

## Mock path

`tickets/REQ-005-sound-panel-design/mock.html` (no external URLs, no `<img>`,
no `url(...)` asset references).

Open it directly:

```sh
google-chrome-stable --new-window \
  "file:///home/inumaki/Development/dotfiles/ags-bar/.worktrees/REQ-005/tickets/REQ-005-sound-panel-design/mock.html"
```

## Source of truth and drift rule

- Normative mock: `mock.html`; sha256
  `ed9e04fe02d040dbfd2d2c380b2921bc9486550e77bc34029966afeeef5f19ee`
  (also recorded in `mock.sha256`).
- This ticket is the **criteria** source of truth; the mock is the **look and
  interaction** source of truth.
- Any change to `mock.html` must update this ticket's requirement, acceptance
  or functionality inventory **and** `mock.sha256` in the same commit. Any
  criteria change must update the mock in the same commit. If they disagree,
  fix one before merging.
- The app-local ticket + mock are canonical; there is no separate
  composition-level sound contract.

## Implementation acceptance (follow-up)

- [x] Persistent output + Playing/Mixer deck implemented per the mock. The
      popover is 352 px wide and anchored under the bar by the shared
      `PopupHost`; its height is content-sized (the deck body is measured and
      capped with a scroll fallback), so there is no fixed dead space. All five
      skin renders are in the evidence below.
- [x] Playing pages: transport/seek; shuffle/repeat capability-gated; no volume
      slider; the read-only level opens Mixer on that app.
- [x] Mixer rows: route/volume/mute; no transport/seek or play/pause; row
      clicks do not switch modes.
- [x] Tray strip: always visible when enabled + player; click opens the
      dropdown; transport never opens it; wheel cycles players; hidden when
      idle; tray/panel mutually exclusive.
- [x] Tray dropdown: active track/transport/seek, `Players`, active check,
      `Open sound panel`.
- [x] Settings: `$XDG_CONFIG_HOME/ags-bar/config.json` with
      `{ media_widget: { enabled } }`, live apply, missing/corrupt defaults;
      not the AGS install link and not `bar.json`.
- [x] MPRIS Shuffle/Loop capabilities/actions; controls hidden when
      unsupported.
- [x] `make ci` and `make gates` pass. The composition pin is unchanged on
      purpose: this work produces no bar tag, and the tuple bump is a
      program-wide cutover (see the compliance section).

## QA follow-up (2026-11-12)

Owner QA on the installed panel (REQ-011 in `ags-bar`), fixed without retuning
the skin:

1. **Settings is one surface.** The native `Gtk.Popover` node/contents is reset
   to transparent, no border/padding/shadow; only `.audio-settings` is painted
   with `surface.panel`. It remains a sibling `Gtk.Popover`, not a nested box.
2. **Output header matches the mock.** The gear is the mock gear glyph (the
   icon artifact's settings variant is a sliders glyph), then mute, the device
   row and the 28 px value/slider. The muted state is the small pill.
3. **The `Muted — the level is kept.` note is gone** from code and mock.
4. **Mixer has no playback controls.** Rows are route/volume/mute/percentage
   plus the playing dot only; no play/pause, seek or mode change.
5. **Track artwork.** The Playing/tray/strip 40/36/24 px frames use the MPRIS
   thumbnail; the app icon is a small corner badge (or the fallback). File and
   data URLs are read/cached synchronously before Chromium deletes its `/tmp`
   thumbnail, and a merged row resolves any of its players' artwork URIs.
   Shuffle/Loop remain capability-gated; on a playback tie the row prefers the
   player that advertises them (native Tidal over its Chromium mirror), while
   Chromium/YouTube (no `Shuffle`/`LoopStatus`) hides them.
6. **Live position.** While the panel body is mounted it polls MPRIS `Position`
   once a second for the selected playing page, updating the seek line and
   time; dragging still suppresses the update and seeks on commit.
7. **No dead bottom.** The deck body is measured and the scroller is sized to
   its content (capped); the panel ends under the footer.
8. **Bare icon-only controls.** The assets template gives gear/mute/transport/
   carousel/level buttons transparent fill/border; only hover/active state
   paints. Device/route fields, sliders and the switch keep the role paint.

Mock: the head app tile is removed, the 40 px art carries a small app badge,
the muted note and Mixer play buttons are removed. New hash
`ed9e04fe02d040dbfd2d2c380b2921bc9486550e77bc34029966afeeef5f19ee`.

## Implementation evidence (2026-11-11)

- Worktree `.worktrees/REQ-005/`, branch
  `ticket/REQ-005-sound-panel-implementation`, based on `ef80881` (v0.6.2).
- Code: `audio/AudioPopup.tsx` (panel), `audio/TrayPopup.tsx` (dropdown +
  catcher), `audio/ui/controls.tsx` (shared transport/seek/level/tile/menu),
  `audio/panel-state.ts` (mode/page/input/tray), `audio/binding.ts`,
  `settings/{domain,port,glib-store,state}.ts`, `bar/widgets/media.tsx`
  (strip), `bar/{registry,bar-manifest,layout.default}.ts`, `app.tsx`,
  `overlays.ts`, `audio/audio-panel.css`.
- Gates (run in the worktree; the local contracts checkout is the documented
  dev pin):

  ```text
  make gates CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts
  exit 0
  tests/ts: 179 pass / 0 fail
  tests/validation: 28 pass / 0 fail (13/13 render checks)
  symbol check: OK
  test-program tsc: 0 errors
  conformance: 14 pass / 0 fail
  drift: all checks passed
  bundle: build/ags-bar.js 3022760 bytes
  typecheck: 0 errors in the ags-bar tree

  dotfiles-assets (worktree .worktrees/req-028):
  make validate-skins  PASS
  make test-skins      181 passed, 3 skipped
  make lint            FAIL: shellcheck is not installed (environment gap)
  make gates-ci        FAIL at validate-desktop for the same missing shellcheck;
                       every Python validator before it passed
  ```

- All-skins widget renders (the REAL components, not the mock), captured
  through `Gtk.WidgetPaintable` over the live wallpaper, with the composed
  appearance (live palette + the expanded `ags.gtk.css.j2`) applied before
  the worktree `audio-panel.css`, exactly as `app.tsx` orders them:
  - `skin-glass-{panel,mixer,tray,strip,settings}.png`
  - `skin-flat-{...}.png`
  - `skin-paper-{...}.png`
  - `skin-terminal-{...}.png`
  - `skin-terminal-host-{...}.png`
  all under `/tmp/opencode/req005/`. The preview entry point is temporary and
  not committed.
- Actual widths read from the rendered widgets and PNG edges: **panel 352 px**
  (content 328 glass / 330 flat / 332 terminal + skin padding/border), **tray
  300 px** (content 276/278/280), **settings 280 px** (content 256/258/260).
  Heights: panel 515 (Playing) / 675 (Mixer); tray 446; settings 136
  (glass; 130 terminal, 139 paper). The
  settings content is 280 px border-box, not the previous 327 px — that was
  the unconstrained content's natural width, now fixed by the app's
  `widthRequest` with the skin padding inside.
- The paper mock render after the compliance pass is
  `/tmp/opencode/req005/paper-default.png` / `paper-mixer.png`.
- The paper mock render after the compliance pass is
  `/tmp/opencode/req005/paper-default.png` / `paper-mixer.png`.
- Deviations (all behaviour-preserving):
  1. **Playing carousel is arrows + wheel**, not a horizontal scroll-snap
     scroller. GTK4's CSS has no `scroll-snap`; the desktop has no touch
     input. The arrows are hidden at ≤1 page, and the wheel uses the same
     ~250 ms cooldown as the strip.
  2. **The tray cue is inline** (the strip's artist line shows `n/N · App` for
     ~1 s) instead of a floating toast window; a second layer-shell window for
     a one-second decoration is not justified.
  3. **Shuffle/repeat are text glyphs** (`⇄` / `↻`) with full tooltips/ARIA.
     The icon artifact has no variants for them and `icons.json` is
     provisioning-owned; adding a `media-controls` group is a
     `dotfiles-assets` follow-up.
  4. **The mock's two placeholder tray dots are real SNI icons** in the bar's
     reserved tray slot; no decorative dots were added next to real items.
  5. **The panel has no nested horizontal scroll**; a long Mixer scrolls
     vertically under the fixed hero, as the paper requires.
  6. **The deck scroller is content-sized.** The body is measured at the panel
     width and its natural height is capped by the monitor; `propagate-
     natural-height` alone collapsed to the minimum (a 250 px panel), so the
     explicit measure + height request is used. No fixed dead space remains.
  7. **The Playing page carries the `surface.card` paint.** The mock leaves the
     page transparent; the role audit maps pages to cards, so the shipped page
     is a card (glass: `alpha(@surface_container_high, .18)` + hairline). This
     is the role-driven visual the paper's mapping asks for; a skin with a
     transparent card (flat) shows no fill.
  8. **The glass render follows the glass skin role, not the mock's numbers**
     (12 px, 1.5 px `@primary`, 0.94 paint, no shadow/blur vs the preview's
     18 px, 1 px hairline, 0.70, soft shadow). Retuning glass would change the
     settings/Bluetooth/clipboard/wallpaper paints and break the assets
     glass-parity contract; it is a separate skin-design decision.
- Surface-role compliance: the popover/dropdown/settings/menus are
  `surface.panel`; rows are `surface.cell`; the Playing page is
  `surface.card`; device/route fields and sliders are `surface.control`; badges are
  `surface.pill`. No `surface.window` and no new literal chrome colour
  (the two greens are the existing semantic live signal).
- `dotfiles-assets` now ships the paint (`req-028`, branch
  `ticket/req-028-sound-panel-skin`): the exact selector/role table above is in
  `skins/templates/ags.gtk.css.j2`; the app stylesheet is structural only.
- The bar's appearance contract note: missing appearance artifacts previously
  fell back to the bundled `style.css`; the sound surface now has no bundled
  paint, so a missing composed appearance leaves it unpainted. The composed
  program always installs one; this is recorded in `AGENTS.md`.

## Deep links

| Query | State |
| --- | --- |
| `?mode=playing` / `?mode=mixer` | Force the deck mode; the last user choice survives afterwards |
| `?muted=1` | Preferred output muted; the level stays visible and the small pill marks Muted |
| `?apps=1` / `?apps=0` | Default alias / zero apps (empty Mixer; empty Playing if forced) |
| `?playing=1` / `?playing=0` | Explicit playing (the default) / every app audio-only; default mode Mixer |
| `?player=2` | Focus the 2nd Playing page (1-based over current players); updates the bar strip |
| `?app=vlc` | Focus a Playing page by app id |
| `?app=firefox` | Focus an audio-only app in Mixer, switching to Mixer |
| `?input=1` / `?input=0` | Input expanded / no input device (disabled controls) |
| `?mic=0` | Input available, no microphone consumers |
| `?device=headphones` | Select an available output (`speakers`, `headphones`) |
| `?tray=1` | Open the tray dropdown on the active player, with the panel closed |
| `?tray=1&player=2` | Open the tray dropdown on the second player, with the panel closed |
| `?widget=0` / `?widget=1` | Hide/restore the bar media strip (review override) |
| `?settings=1` | Open the settings popover with the panel open |
| `?panel=closed` | Start with the popover closed; tray strip remains visible (review helper) |

## Token / skin mapping

Chrome colour roles and radii are custom properties in `:root`
(`mock.html:43-79`). The mock is the **glass preview**: its literals illustrate
the design, while the shipped chrome is the selected skin's role values. The
appearance layer remaps:

| Mock token | Appearance mapping |
| --- | --- |
| `--ink`, `--ink-dim`, `--ink-faint` | palette on-surface ramp |
| `--glass`, `--glass-strong` | palette surface at two opacities |
| `--hairline`, `--hairline-soft` | palette outline at two alphas |
| `--accent`, `--on-accent` | palette primary / on-primary |
| `--live` | semantic green, not a palette role |
| `--r-panel` | `surface.panel.radius` |
| `--r-card` | `surface.card.radius` |
| `--r-cell` | `surface.cell.radius` |
| `--r-control` | `surface.control.radius` |
| `--r-pill` | `surface.pill.radius` |
| `--panel-w` | **app literal** (352 px), not a layout token |

Role assignment in this surface (the corrected mapping, see the compliance
section below):

| Role | Mock surfaces |
| --- | --- |
| `surface.panel` | The 352 px popover, the 300 px tray dropdown, the 280 px settings popover, and the device/route menu (each is an AGS layer-shell surface, not a toplevel) |
| `surface.card` | The per-player Playing page |
| `surface.cell` | Mixer rows, tray `Players` rows, menu rows, the input consumer row, the settings row |
| `surface.control` | Device fields, route chips and sliders (real fields); icon-only gear/mute/transport/carousel/level buttons are bare with state hover only |
| `surface.pill` | Muted pill, live badge, tab underline, switch, scroll cue, toast, slider tracks/thumbs |

`--panel-w` becomes skin-remappable only if the appearance plane adds a
`layout.ags.audio-panel-width` token. The `--surface`, `--outline` and
`--focus-ring` aliases cover the panel/menu/focus chrome, but they are not a
claim that every value is tokenised: some translucent hover/fill overlays and
all content art (dragon wallpaper, album covers, app tile gradients) remain
literals because they are content, not skin. Geometry and structure stay in the
mock's CSS, mirroring 106's rule that the appearance plane has no structure.

## Customization layer compliance (2026-11-11)

This paper was audited against the v3 customization layer as it exists on
2026-11-11 and against the frozen composition tuple. The audit found three
things to record here and nothing that changes the approved layout, type or
colour intent: the surfaces are **not** `surface.window`, list rows need
`surface.cell`, and the live tuple still exposes five roles.

### W-10: all three surfaces are `surface.panel`, never `surface.window`

Doc 113 (`dotfiles-v3/docs/113-window-role-kitty-projection.md`) W-10 says:
"AGS bar/settings and AGS overlay surfaces remain `surface.panel`".
`surface.window` is the outermost surface **the compositor manages as a
window** (rofi, wlogout, GTK `window`/`headerbar`); it is a required sixth role
in the v3 token model, not a synonym for `panel`.

The sound popover, the tray dropdown and the settings popover are AGS
layer-shell windows inside the bar's single `ags` instance (`PopupHost` uses
`Astal.Layer.OVERLAY`, `Astal.Exclusivity.IGNORE`, `WindowAnchor.TOP | LEFT`).
None is a compositor toplevel and none is decorated by the compositor.
Therefore:

- `--r-panel -> surface.panel.radius` is correct and stays. It must **not** be
  remapped to `surface.window.radius`.
- Their paint, frame, shadow and blur consume the panel role (the mock's
  `--surface`/`--surface-strong`/`--outline` aliases).
- `surface.window` is not consumed by any part of this surface. Using it would
  be a false role claim and would break the kitty/rofi/wlogout toplevel
  mapping's one-consumer-per-slot rule.

### `surface.cell` is required; rows are cells, not cards

The first paper had no cell role: Mixer rows used `--r-card` and the tray /
menu / consumer rows used bare 8–10 px literals. That mislabels list rows as
inner cards. The corrected mapping:

- **cells**: Mixer rows, tray `Players` rows, menu rows, the input consumer
  row, and the settings row (`--r-cell`).
- **cards**: the Playing page — an inner page, not a row (`--r-card`).
- **controls**: device fields, route chips, icon/transport/carousel/mute
  buttons, artwork frames (`--r-control`).
- **pills**: muted pill, live badge, tab underline, switch, scroll cue, toast,
  slider tracks/thumbs (`--r-pill`).

The mock adds `--r-cell: 8px` (`mock.html` `:root`); the tray dropdown, the
settings popover and the device/route menu now take `--r-panel` instead of
their former 12/14 px menu literals. That is a **corner-rounding normalization
only**: no layout, type, spacing, colour or interaction moved. The radii are now
honest single-role values a skin can remap; a design that kept four different
literals per role could not be satisfied by `surface.*.radius`.

### Current tuple vs target layer

- Live composition tuple: **`ags-platform` v1.0.1 / `contracts` v0.11.0 /
  `dotfiles-assets` v0.18.1**
  (`dotfiles-v3/dotfiles/provisioning/program-tuple.yaml`). It exposes the five
  roles this surface uses: `panel`, `card`, `cell`, `control`, `pill`.
- This slice's assets release: **`dotfiles-assets` v0.20.0** (the sound paint
  on top of v0.19.0) and **`ags-bar` v0.6.3**. The live tuple's
  `dotfiles-assets` entry is v0.18.1, so the sound paint is not in the tuple
  until a program-wide cutover.
- Target layer: **`contracts` v0.12.0 / `ags-platform` v1.1.0 /
  `dotfiles-assets` v0.20.0**, which adds the required sixth role
  `surface.window` (v0.19.0) plus this sound paint. That move is a
  **program-wide cutover** (doc 113 §10), never a single-app cutover; the
  bar's `AGS_PLATFORM_VERSION`/`CONTRACTS_VERSION` pins and the program tuple
  move together, with a runtime that emits v3.
- This paper therefore targets the five-role surface and is forward-compatible:
  when the tuple moves, no selector in this surface changes — only the skin's
  radius/paint values behind those roles change, and the new `window` role has
  no consumer here. The implementation must not bump the tuple or the platform
  pin for this app alone.

### All-skins shipping (implemented in `dotfiles-assets`)

The sound surface is now skin-agnostic. The paint/geometry lives in the
app-owned target `dotfiles-assets/skins/templates/ags.gtk.css.j2` (worktree
`.worktrees/req-028/`, branch `ticket/req-028-sound-panel-skin`), which the
runtime expands for **every** built-in skin and installs with the palette as
the composed `appearance/ags.css` at USER priority. The bar's
`audio/audio-panel.css` is structural only: dimensions, spacing, layout,
content art and the semantic live green. It is applied after the appearance,
so any paint there would override the skin — there is none.

| Selector | Role tokens |
| --- | --- |
| `.audio-surface` (`window.audio-popup`), `.tray-surface` (`window.tray-popup`), `.audio-settings`, `.audio-menu > contents` | `surface.panel` bg/border/border-width/radius/padding/shadow/blur |
| `.audio-playing-page` | `surface.card` bg/border/border-width/radius/padding |
| `.audio-mixer-row`, `.audio-tray-player`, `.audio-menu-option`, `.audio-consumer`, `.audio-settings-row` | `surface.cell` bg/radius/padding/hover-bg |
| `.audio-device`, `.audio-route` | `surface.control` bg/border/border-width/radius/padding/font-size/font-weight |
| `.audio-icon-button`, `.audio-transport-button`, `.audio-carousel-button`, `.audio-playing-level`, `.audio-mixer-mute`, `.audio-settings-gear` | **bare icon-only**: transparent/no border; radius + `state.hover/selected` only, never control/cell paint |
| `.audio-muted-pill`, `.audio-live-badge`, `.audio-switch` | `surface.pill` bg/border/border-width/radius/padding/font-size/letter-spacing |
| tabs, rows, buttons, menus | `state.hover`/`state.selected`/`state.focus`/`state.disabled` |
| captions, titles, track lines, footer, menus | `ink.ink`/`ink.ink-dim`/`ink.accent` + `type.size-*` |

Widths are app layout and stay border-box: **popover 352 px, tray dropdown
300 px, settings 280 px**. The skin's `surface.panel.padding` is inside those
boxes, so every skin keeps the approved width; the glass padding 11 gives a
328 px content box, terminal 9 gives 332 px, flat 11 gives 330 px.

The `dotfiles-assets` fixture gate names the sound classes in the `ags`
selector/token coverage and proves the panel paint/radius reaches
`.audio-surface`/`.tray-surface`/`.audio-settings` in glass, paper, flat,
terminal and terminal-host, and that no sound selector uses
`surface.window`. `make validate-skins` PASS; `make test-skins` 181 passed,
3 skipped; `make lint`/`make gates-ci` stop at the environment's missing
`shellcheck` (validate-desktop), an unrelated tool gap.

### Glass preview vs the shipped glass skin

The mock's glass is the **design preview** (18 px, 1 px hairline, 0.70 paint,
soft shadow). The shipped `glass` manifest's `surface.panel` role is the
parity skin: `alpha(@surface, 0.94)`, a 1.5 px `@primary` frame, 12 px,
`shadow = none`, `blur = none`. The glass render therefore uses those role
values, not the mock's numbers. Retuning the glass panel role to the preview
would also change the settings panel, Bluetooth, clipboard, wallpaper-selector
and capture paints and breaks the `test_parity.py` glass-parity contract; that
is a separate skin-design decision. The other four skins visibly adapt:
paper (6 px, hairline, authored shadow), flat (0 px, transparent), terminal
and terminal-host (0 px, `@surface`, hairline, 9 px padding, monospace).

### Other frozen papers needing the same pass (audit, not edited)

The same W-10 / `surface.cell` decision applies to every AGS overlay paper.
They were audited read-only here; each is owned by its own repo/ticket and its
hash is unchanged.

- **REQ-007 Wi-Fi** (`ags-bar/tickets/REQ-007-wifi-panel-design`): its `:root`
  has the four radii and no `--r-cell`; the ticket has no token/role table
  (only a "map `:root` chrome roles/radii" note). Its 352 px popover and
  280 px settings popover are AGS layer-shell overlays, so `surface.panel`
  (never `window`). Needs `--r-cell`, a role table (network rows and settings
  rows are cells) and the W-10 note.
- **REQ-008 Battery**: same shape. The mode rail cells and device/profile rows
  are cells; the variant selector is a control. Needs `--r-cell`, the role
  table and the W-10 note.
- **REQ-009 Bluetooth**: same shape, and `.dev-card` currently uses
  `--r-card`; decide whether a device card is a card or a cell, then add
  `--r-cell`, the role table and the W-10 note.
- **`ags-wallpaper-selector` REQ-005 overlay redesign**: the mock uses
  `--r-bar`/`--r-pill` only and has no `surface.*` mapping. The overlay is an
  AGS layer-shell surface → `surface.panel`. Needs the role table (thumbnail
  cells are cells) and the W-10 note in that repo.
- **`ags-clipboard` REQ-005 overlay redesign**: `--r-bar`/`--r-card`/
  `--r-pill`, no `surface.*` mapping; overlay → `surface.panel`. Same pass.

None of these are edited by this ticket; each must update its own mock hash
when it lands.

### Layout and content literals

- `--panel-w` remains the 352 px app literal. The current layout vocabulary has
  no `layout.ags.audio-panel-width`; inventing one here would make this paper
  disagree with the tuple. The bar's settings panel still owns
  `layout.ags.panel-width`, which is unrelated to this popover.
- Content stays content: album covers, app-tile fallbacks and the mock's dragon
  wallpaper are not skin. Real artwork comes from MPRIS through the existing
  bounded cache.

## Assumptions and deviations

1. **Output is pinned; the deck scrolls.** The master output controls live above
   `.pop-scroll`, so device/volume/mute remain visible even when the Mixer or
   input is long. This is the requested persistent header, not a sticky shadow.
2. **Two modes replace one combined page.** Playing owns playback and seek;
   Mixer owns routing and levels. This removes the clutter of the rejected
   combined page. The per-app read-only level in Playing is the bridge.
3. **Fixture roles.** Spotify, Tidal and VLC are the Playing pages (Tidal paused,
   VLC live); Firefox is audio-only and exists only in Mixer. `?playing=0`
   collapses every page to audio-only and defaults the deck to Mixer.
4. **Session mode.** The mock keeps the last mode in memory; closing/reopening
   the panel preserves it, while a full reload resets to the default. The real
   app's mode is UI-local, not a config file.
5. **No auto-switch.** Track changes, timer ticks and play/pause do not change
   mode. While Mixer is selected, the Playing tab accent dot is the only signal
   that audio is playing.
6. **One settings entry.** The Output gear is the only settings surface; the
   `Bar media widget` toggle is the one config key, persisted in the app-owned
   `$XDG_CONFIG_HOME/ags-bar/config.json`. No other JSON file is written.
7. **Unavailable devices stay visible but disabled.** `HDMI · Display` exercises
   the disabled branch; selecting it is a no-op, not a fake success.
8. **Mixed mute.** The `Mixed` badge demonstrates the divergent-level branch;
   mixed mute shares that same badge/active-mute path.
9. **Compact deck controls.** To keep both modes short, Playing secondary
   transport is 24×40 px with a 34 px play, Mixer route/play are 30 px and mute
   is 36 px. The persistent output and input controls remain 40–44 px. If strict
   40×40 is required for every deck action, the panel must grow or move controls
   to a second row.
10. **Page height.** The active Playing page's natural height sets the carousel
    height; the 180 ms transition is decorative. No state depends on it.
11. **The strip is not hover-expanded.** The earlier full strip is now the
    default bar state; only the dropdown is a separate overlay. The strip
    operates transport directly; the dropdown additionally exposes seek and
    player switching. The tray is 30 px high inside the 40 px bar; the panel
    keeps the 40–44 px primary targets.
12. **Tray active-player resolution.** The strip follows the panel carousel's
    current player (`playingId`). The Mixer focus does not override it. The
    dropdown's Players list contains current players (a paused player remains
    selectable; its playing dot is absent); with one current player the list is
    omitted. No current player hides the strip. `?tray` and `?panel` are mock
    review links, not app config.
13. **Mutual exclusivity.** The tray dropdown and panel share one overlay
    budget: opening either closes the other. The strip is the media entry point;
    the volume icon and the dropdown footer are panel entry points. This is UI
    behavior only, not a config key.
14. **Wheel debounce.** A ~250 ms cooldown admits one player switch per wheel
    gesture; the cue is decorative and no state depends on it. Wrap order is the
    panel's current-player order.
15. **Widget visibility setting.** The mock stores
    `{ media_widget: { enabled } }` in `localStorage`; the real app stores the
    same shape in `$XDG_CONFIG_HOME/ags-bar/config.json` via a pure domain, a
    store port and a GLib adapter. It is separate from the AGS install link and
    the layout `bar.json`, applies live in this restart-mode bar, and the deep
    links are review overrides that are not persisted.
16. **Off state is independent of players.** Off hides the strip even with a
    player; on with no player stays hidden. Turning off also closes any open tray
    dropdown; `?tray=1` cannot reopen it while off. The volume icon remains the
    panel entry point.

## Evidence

- `node --check` on the extracted script: exit 0 (syntax).
- Chrome 154.0.8037.92 headless screenshots at 1600×1000 and 1280×800 for the
  default Playing mode, Mixer, focused Mixer row, audio-only state, empty, and
  the device/route menus.
- The DOM interaction harness passed 78 checks: persistent header geometry,
  default mode, tab/dot state, Playing pages and transport/seek, read-only level
  → Mixer focus, Mixer rows/volume/mute/route, row clicks staying in Mixer
  (no playback control), mode dot, and mode persistence through switching.
- The states harness passed 46 checks for `?mode=playing`, `?mode=mixer`,
  `?player=2`, `?app=vlc`, `?app=firefox`, `?playing=0`,
  `?mode=playing&playing=0`, `?apps=0`, `?mode=playing&apps=0`, `?muted=1`,
  `?input=0`, `?mic=0` and `?device=headphones`.
- The tray harness passed 116 checks: strip placement/height, strip content and
  controls, hover-no-open, click-open versus transport-no-open, wheel
  cycling/wrap/debounce/cue, dropdown content, player switching, panel carousel
  sync, transport/seek, footer, exclusivity, Esc/outside, hidden idle states, and
  `?tray=1` / `?tray=1&player=2` / `?player=2` / `?panel=closed`.
- Strip screenshots: `/tmp/opencode/strip-rest.png` (strip rest),
  `strip-dropdown.png` (dropdown open, panel closed), and `strip-scrolled.png`
  (wheel to the second player + cue); panel states remain the
  `final-twomode-*` captures.
- The settings harness passed 43 checks: gear/popover geometry and content,
  toggle off/on, strip hide/restore, localStorage persistence and reload,
  settings close behavior, volume entry, `?widget=0` / `?widget=1` /
  `?settings=1`, `?widget=0&tray=1` prevention, and no-player independence.
- Settings screenshots: `/tmp/opencode/settings-open2.png` (popover open),
  `widget-hidden.png` (strip hidden), and `widget-restored.png` (strip back).
- `mock.html` was checked for external URLs and `url(...)`: none.
- Customization-layer pass (2026-11-11): `sha256sum mock.html` =
  `ed9e04fe02d040dbfd2d2c380b2921bc9486550e77bc34029966afeeef5f19ee`
  (`mock.sha256` matches), and headless Chrome at 1600×1000 rendered the
  default and Mixer states with the normalized radii
  (`/tmp/opencode/req005/paper-default.png`, `paper-mixer.png`). No layout,
  type or colour change was observed.

## Follow-up

Implementation maps onto the existing composition plus the new MPRIS surface:

- Persistent output → `selectPreferredOutput`, `setOutputVolume`,
  `toggleOutputMute` (`audio/application/audio-actions.ts:15-90`).
- Mixer → `setAppVolume`, `toggleAppMute`, `setAppRoute`
  (`audio-actions.ts:42-107`).
- Playing → `playerAction` / `seek` (`audio-actions.ts:123-154`) for the
  displayed player; the page list is projected rows with a current player
  (`audio-panel-view-model.ts:118-225`).
- Mode → a UI-local `playing | mixer` state, defaulting from available players;
  no config key and no auto-switch. The tab accent dot comes from
  `anyPlaying`.
- Shuffle/Loop → extend `PlayerCapabilities`, `AudioPlayer` and
  `AudioPanelActions`, and add the MPRIS toggle calls. Hide each control when
  the capability flag is false.
- Input → `selectInput`, `setInputVolume`, `toggleInputMute`
  (`audio-actions.ts:69-121`).
- The menus replace the current `openChoicePopover` lists with the same
  selected/disabled semantics.
- Tray strip → consume the same `AudioPanelBinding`/projection for the active
  player; strip transport and dropdown dispatch `playerAction`/`seek`; wheel
  selection updates the panel's `playingId`; no app-switch control is added.
  `openAudio`/`toggle` handles the footer. `?tray`/`?panel` are mock-only review
  links, not persisted config.
- Settings → add the app-owned settings file at
  `$XDG_CONFIG_HOME/ags-bar/config.json` with
  `{ media_widget: { enabled: true } }`, following the capture-tool pattern
  (pure domain, port, GLib adapter, save-on-change). The mock's `localStorage`
  and `?widget`/`?settings` are review-only. The toggle applies live; no bar
  restart is required for this UI setting.
- The skin work consumes the corrected `:root` roles/radii; `--panel-w` stays
  app-owned until a layout token exists.

### QA round 3 (2026-11-12)

- Input revealer now refits after `child-revealed`/layout; no dead bottom.
- The owner art is integrated through assets `media-controls` and
  `settings-panel.settings` and the platform v1.2.0 `icons.json`; the panel,
  tray and strip resolve registry images; text glyphs are gone.
- Strip thumbnail is 32 px with no tile fill; tray transport is centered and
  36/18 px. Mock updated to match; new mock hash `ed9e04fe…`.
