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
branch: ticket/REQ-005-sound-panel-design
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
reachable, with output volume promoted to a single hero instead of a competing
line next to every app page.

The popover has three surfaces:

1. **Hero** — output volume (28 px value, slider, mute) and the preferred output
   device with a compact selector.
2. **Audio** — one **horizontally snap-scrolling page per app**, under a single
   `Audio · N` header. There is no separate Apps list, no app-row expand
   chevron and no per-app transport outside a page. Each page top carries the
   app tile/name (the source badge), `n/N`, and a compact route chip. Then:
   - **Player page:** 40 px artwork, title 13/600, artist 10.5/dim, inline
     previous/play-pause/next, shuffle/repeat only when supported, and a 2 px
     interactive seek line with 9.5 px elapsed/duration.
   - **Audio-only page:** app name + `Audio only` + route; no transport or seek.
   - **Live page:** `Live` badge, artwork/title/artist, play/pause only; no seek
     or unsupported transport.
   - **Always:** the app volume row (mute + slider + percentage + `Mixed`) sits
     directly inside the page.
   Left/right arrows flank the pages and switch apps when there is more than one
   page; horizontal swipe/scroll snap does the same. The `n/N` indicator remains
   on each page. The active page sets the section height so the panel stays
   compact.
3. **Input** — secondary and collapsed by default. Expanding shows the input
   device selector, microphone level, mute, and the apps currently using the
   microphone. No input and no consumer both have honest states.

The fixture demonstrates all page kinds: Spotify (player), Firefox (audio-only),
Tidal (paused player), VLC (live stream). A source badge is the app tile/name
itself; adding a second "Spotify" pill would duplicate it.

No settings gear or config-file escape hatch is added: the current popup has
none. Right-click → `pavucontrol` is a bar-widget gesture, not part of this
surface, and remains outside the mock.

**MPRIS note.** Shuffle and Loop are not in the current `PlayerCapabilities`
model or `AudioPanelActions`; the mock simulates them. Implementation must
expose Shuffle/Loop capability flags and actions. A page hides either icon when
the player does not support it, exactly as the mock hides both on the VLC live
page and all transport on the Firefox audio-only page.

## Functionality inventory

| Current action (`audio/AudioPopup.tsx`) | Mock surface |
| --- | --- |
| `selectPreferredOutput` | Hero device row → output menu (unavailable outputs disabled) |
| `setOutputVolume` | Hero slider + big value |
| `toggleOutputMute` | Hero mute button; level is retained while muted |
| `setAppRoute` (follow preferred / explicit override) | Route chip inside each page → menu (default reflects the selected output) |
| `setAppVolume` | Volume row inside each page |
| `toggleAppMute` | Mute button inside each page; `Mixed` badge for divergent levels |
| `playerAction` play-pause / previous / next | Inline transport on a player page; pages switch via arrows/scroll |
| `seek` | Player page's 2 px seek line + elapsed/duration; live/audio-only pages hide it |
| `selectInput` | Input device row → input menu |
| `setInputVolume` | Input slider + percent |
| `toggleInputMute` | Input mute button |
| `inputConsumers` | “Using microphone” line under the input controls |
| Shuffle / Loop (new MPRIS capability) | Player page icons; toggled per page; hidden when unsupported |
| Output / app / input empty or unavailable states | No apps, audio-only pages, live page, unavailable output entry, no input, no mic consumer |

## Acceptance

Design deliverable:

- [x] `mock.html` is one self-contained file with no external assets and no
      build step; it opens directly in a browser.
- [x] The popover is 352 px wide, anchored 8 px under the bar at the top-right,
      on the dragon wallpaper, with one glass layer, an 18 px radius, a 1 px
      hairline and one soft shadow. There is no accent frame.
- [x] The hero carries output volume/mute and the output device selector; the
      value uses the 21+ display size and the primary controls meet 40–44 px.
- [x] A single `Audio · N` section replaces the separate Now playing and Apps
      sections. There is no Apps list, expand chevron or app-row focus state.
- [x] Each app is one snap-scrolling page with app tile/name, `n/N` and a route
      chip; every page has its own volume, mute, percentage and `Mixed` state.
- [x] Player pages carry artwork, title/artist, inline transport, supported
      shuffle/repeat and the 2 px seek line with 9.5 px times. Audio-only and
      live pages have the specified reduced content.
- [x] Carousel arrows show when there is more than one page, hide at ≤1, and
      horizontal swipe/scroll snap switches pages. `?player=2` and `?app=vlc`
      focus the matching page.
- [x] The active page controls the section height, so the panel is shorter than
      the previous strip + Apps version.
- [x] The input section is collapsed by default and covers device, level, mute,
      consumers, unavailable input and no-consumer states.
- [x] Sliders, mute buttons, route menus, transport, seek, page arrows, scroll
      snap, input controls, `Esc` and bar-icon reopen are interactive.
- [x] Deep links work: `?muted=1`, `?apps=1` (default/no-op), `?apps=0`,
      `?playing=1`, `?playing=0`, `?player=2`, `?app=vlc`, `?input=1`,
      `?input=0`, `?mic=0`, `?device=`.
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

## Deep links

| Query | State |
| --- | --- |
| `?muted=1` | Preferred output muted; the level is kept and labelled |
| `?apps=1` / `?apps=0` | Default alias (pages are always visible) / zero apps (empty state) |
| `?playing=1` / `?playing=0` | Explicit playing (the default) / every page becomes audio-only |
| `?player=2` | Focus the 2nd app page (1-based); Firefox is audio-only |
| `?app=vlc` | Focus a page by app id; VLC is the live-stream page |
| `?input=1` / `?input=0` | Input expanded / no input device (disabled controls) |
| `?mic=0` | Input available, no microphone consumers |
| `?device=headphones` | Select an available output (`speakers`, `headphones`) |

## Token / skin mapping

Chrome colour roles and radii are custom properties in `:root`
(`mock.html:43-79`). The appearance layer can remap:

| Mock token | Appearance mapping |
| --- | --- |
| `--ink`, `--ink-dim`, `--ink-faint` | palette on-surface ramp |
| `--glass`, `--glass-strong` | palette surface at two opacities |
| `--hairline`, `--hairline-soft` | palette outline at two alphas |
| `--accent`, `--on-accent` | palette primary / on-primary |
| `--live` | semantic green, not a palette role |
| `--r-panel` | `surface.panel.radius` |
| `--r-card` | `surface.card.radius` |
| `--r-control` | `surface.control.radius` |
| `--r-pill` | `surface.pill.radius` |
| `--panel-w` | **app literal** (352 px), not a layout token |

`--panel-w` becomes skin-remappable only if the appearance plane adds a
`layout.ags.audio-panel-width` token. The `--surface`, `--outline` and
`--focus-ring` aliases cover the panel/menu/focus chrome, but they are not a
claim that every value is tokenised: some translucent hover/fill overlays and
all content art (dragon wallpaper, album covers, app tile gradients) remain
literals because they are content, not skin. Geometry and structure stay in the
mock's CSS, mirroring 106's rule that the appearance plane has no structure.

## Assumptions and deviations

1. **The output line returns as the hero.** `AudioPopup.tsx:278-290` records a
   2026-10-04 owner decision to drop a device-level volume/mute line because it
   competed with each app's own line. The new brief requires output volume in
   the hero. The resolution is hierarchy: exactly one output control at the top;
   per-app levels live inside the pages. The existing `setOutputVolume` /
   `toggleOutputMute` actions are already present.
2. **One page per app; transport only inside a player page.** The separate Apps
   list is retired. Volume/mute/route stay with the app page, so switching pages
   is the only navigation. This is the requested single-carousel model.
3. **Fixture roles.** Spotify is the normal player; Firefox is the audio-only
   page (no player); Tidal is a paused player; VLC is the live stream. The
   `?playing=0` deep link turns every page audio-only, preserving the old
   audio-only state.
4. **No gear or settings link.** The current popup has no settings entry, so the
   mock does not invent one. No JSON file is written.
5. **Unavailable devices stay visible but disabled.** `HDMI · Display` exercises
   the disabled branch; selecting it is a no-op, not a fake success.
6. **Simulation.** Data is in-memory; every playing seekable page advances once
   per second while playing. The carousel includes every app page (players and
   audio-only), not only players. There is no real PipeWire/MPRIS access.
7. **Mixed mute.** The `Mixed` badge demonstrates the divergent-level branch;
   mixed mute shares that same badge/active-mute path rather than adding a second
   page state.
8. **Page height.** The active page's natural height sets the section height, so
   audio-only and live pages shorten the panel. The 180 ms height transition is
   decorative; no state depends on it.
9. **Transport density exception.** Five actions share one player row. The
   secondary buttons are 24×40 px and play is 34 px, so the page stays compact
   and the title/artist remain readable. If strict 40×40 is required for every
   transport action, the panel must widen or move transport to a second row.

## Evidence

- `node --check` on the extracted script: exit 0 (syntax).
- Chrome 154.0.8037.92 headless screenshots at 1600×1000 and 1280×800 for the
  default player page, Firefox audio-only, Tidal player, VLC live, empty, and
  the device/route menus.
- The DOM interaction harness passed 53 checks: page count/section, scroll snap,
  arrow carousel wrap, scroll focus sync, per-page volume/mute/route, output
  device route relabel, transport, seek, shuffle/repeat, audio-only/live page
  content, input and escape/reopen.
- The states harness passed 27 checks for `?player=2`, `?app=vlc`, `?apps=0`,
  `?playing=0`, `?muted=1`, `?input=0` and `?mic=0`.
- `mock.html` was checked for external URLs and `url(...)`: none.

## Follow-up

Implementation maps onto the existing composition plus the new MPRIS surface:

- Hero → `selectPreferredOutput`, `setOutputVolume`, `toggleOutputMute`
  (`audio/application/audio-actions.ts:15-90`).
- Page mixer → `setAppVolume`, `toggleAppMute`, `setAppRoute`
  (`audio-actions.ts:42-107`).
- Player page → `playerAction` / `seek` (`audio-actions.ts:123-154`) for that
  page's player; carousel order is the projected app rows, including audio-only
  apps (`audio-panel-view-model.ts:118-225`).
- Shuffle/Loop → extend `PlayerCapabilities`, `AudioPlayer` and
  `AudioPanelActions`, and add the MPRIS toggle calls. Hide each control when
  the capability flag is false.
- Input → `selectInput`, `setInputVolume`, `toggleInputMute`
  (`audio-actions.ts:69-121`).
- The menus replace the current `openChoicePopover` lists with the same
  selected/disabled semantics.
- The skin work consumes the corrected `:root` roles/radii; `--panel-w` stays
  app-owned until a layout token exists.
