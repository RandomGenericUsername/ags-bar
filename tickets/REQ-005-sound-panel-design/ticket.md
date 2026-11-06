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
     player. Each page carries the app tile/name (the source badge), `n/N`, 40 px
     artwork, title/artist, inline previous/play-pause/next, shuffle/repeat only
     when supported, and a 2 px seek line with 9.5 px times. There is **no
     volume slider**: a small volume glyph + current level is read-only, and
     clicking it switches to Mixer focused on that app. Arrows flank the pages
     when there is more than one player; swipe/scroll snap also works. Audio-only
     apps are not Playing pages.
   - **Mixer:** a vertical list of every app with audio. Each row has the app
     tile/name, current media or `Audio only`, route chip, volume slider, mute,
     percentage and `Mixed` when applicable. Playing apps get a subtle playing
     dot and a single play/pause button. There is no seek/prev/next, no expand
     chevron and no nested box. Row and play/pause clicks keep the user in Mixer;
     they never switch modes.
   - Default mode is Playing when a player exists, otherwise Mixer. The last
     mode is kept for the session. Track changes never switch modes. While in
     Mixer, a small accent dot appears on the Playing tab when anything is
     playing.
3. **Input** — secondary and collapsed by default. Expanding shows the input
   device selector, microphone level, mute, and the apps currently using the
   microphone. No input and no consumer both have honest states.

**Tray now-playing (outside the panel).** The bar's end cluster keeps a quiet
reserved tray slot; this widget is its first item, before the microphone,
network, volume and battery icons, with up to two placeholder tray dots. It is a
tray icon, not a custom expanding strip:
- At rest: 20 px rounded album art with a 1 px ring, a playing dot (paused shows
  a small play glyph), no title/artist text, tooltip `Title — Artist`. Click
  toggles a dropdown; hover never opens it. Hidden when there is no player.
  **Exclusivity:** the tray dropdown and the sound panel are never open together.
  The tray icon closes the panel before toggling; the volume icon and the
  dropdown footer close the tray and open the panel; `?tray=1` opens with the
  panel closed. Esc closes the tray first, then the panel; outside click closes
  the tray.
- Dropdown: 300 px glass, radius 14, hairline and shadow, anchored below the
  icon. Header `Now playing` + source app. Active track: 36 px art,
  title/artist, previous / play-pause / next, shuffle/repeat only when
  supported, 2 px seek line with 9.5 px times. A divider and `Players` list only
  when more than one current player: app tile, track, playing dot, active check;
  choosing a row switches the active player and updates the panel Playing page.
  Footer `Open sound panel` closes the tray and opens the panel on Playing.
  Menu-like; no nested cards.
- The tray follows the panel carousel's active player; switching carousel pages
  updates the icon/dropdown, and selecting a dropdown player updates the panel.
  Pausing shows a play glyph; no player hides the tray and closes the dropdown.
  `?tray=1` opens the dropdown; `?tray=1&player=2` opens it on the second player.

Fixture roles: Spotify (normal player)Fixture roles: Spotify (normal player), Tidal (paused player), VLC (live player,
no seek) are Playing pages; Firefox is the audio-only app that lives only in
Mixer. The app tile/name is the source badge; a second "Spotify" pill would
duplicate it.

No settings gear or config-file escape hatch is added: the current popup has
none. Right-click → `pavucontrol` is a bar-widget gesture, not part of this
surface, and remains outside the mock.

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
| `playerAction` play-pause / previous / next | Playing page transport and Mixer's single play/pause |
| `seek` | Playing page's 2 px seek line + elapsed/duration; live pages hide it |
| `selectInput` | Input device row → input menu |
| `setInputVolume` | Input slider + percent |
| `toggleInputMute` | Input mute button |
| `inputConsumers` | “Using microphone” line under the input controls |
| Shuffle / Loop (new MPRIS capability) | Playing page icons; toggled per page; hidden when unsupported |
| Mode switch / session mode | Deck `Playing | Mixer` tabs; default from players; no auto-switch; accent dot on Playing while Mixer and playing |
| Tray now-playing | Tray icon reports the active player; click opens a dropdown; dropdown transport acts on the same player; no app switching |
| Tray dropdown | Track transport/seek, player switcher, active check, `Open sound panel`; hidden with no player |
| `?tray=1` | Open the tray dropdown; `?tray=1&player=2` opens it on the second player |
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
      VLC); Firefox is absent. Pages carry app tile/name, `n/N`, artwork,
      title/artist, transport, supported shuffle/repeat and seek, with a
      read-only volume glyph + level and no slider.
- [x] Clicking the Playing level glyph switches to Mixer, focuses the matching
      row, and preserves the user's chosen mode afterwards.
- [x] Mixer lists every app (four rows), with route, volume, mute, percentage,
      `Mixed`, a playing dot and one play/pause. It has no seek/prev/next,
      expand chevron or nested box; row and play/pause stay in Mixer.
- [x] The default mode is Playing when a player exists and Mixer otherwise.
      Track changes never switch modes; the chosen mode survives panel
      close/reopen for the session. The Playing tab shows an accent dot while
      Mixer is selected and something is playing.
- [x] Arrows flank Playing pages when >1 and hide at ≤1; swipe/scroll snap
      switches pages. `?player=2`, `?app=vlc` focus Playing pages; `?app=firefox`
      opens Mixer on its row.
- [x] The tray icon is the first item in the bar's end cluster, before the
      microphone/network/volume/battery icons, with two quiet placeholder dots.
      Rest is 20 px art + ring + playing dot/paused glyph, no text, tooltip
      `Title — Artist`, and a 40 px bar height. It is hidden with no player.
- [x] Hover never opens the dropdown; click toggles it. The dropdown is 300 px,
      radius 14, glass/hairline/shadow, anchored below the icon, with a header,
      active track/transport/seek, a `Players` list only when >1 player, active
      check, and `Open sound panel` footer.
- [x] Choosing a player updates the tray icon and the panel Playing page;
      switching panel pages updates the tray. Pausing shows the play glyph;
      no player hides the tray/dropdown. `?tray=1` and
      `?tray=1&player=2` open the dropdown.
- [x] Tray and panel are mutually exclusive: the tray icon closes the panel
      before toggling; the volume icon and `Open sound panel` close the tray and
      open the panel; `?tray=1` opens with the panel closed; Esc closes the tray
      first, then the panel.
- [x] The panel is shorter than the previous carousel + apps version: Playing is
      compact; Mixer uses four tight rows.
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

## Deep links

| Query | State |
| --- | --- |
| `?mode=playing` / `?mode=mixer` | Force the deck mode; the last user choice survives afterwards |
| `?muted=1` | Preferred output muted; the level is kept and labelled |
| `?apps=1` / `?apps=0` | Default alias / zero apps (empty Mixer; empty Playing if forced) |
| `?playing=1` / `?playing=0` | Explicit playing (the default) / every app audio-only; default mode Mixer |
| `?player=2` | Focus the 2nd Playing page (1-based over current players) |
| `?app=vlc` | Focus a Playing page by app id |
| `?app=firefox` | Focus an audio-only app in Mixer, switching to Mixer |
| `?input=1` / `?input=0` | Input expanded / no input device (disabled controls) |
| `?mic=0` | Input available, no microphone consumers |
| `?device=headphones` | Select an available output (`speakers`, `headphones`) |
| `?tray=1` | Open the tray dropdown on the active player, with the panel closed |
| `?tray=1&player=2` | Open the tray dropdown on the second player, with the panel closed |
| `?panel=closed` | Start with the popover closed; tray icon remains visible (review helper) |

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
6. **No gear or settings link.** The current popup has no settings entry, so the
   mock does not invent one. No JSON file is written.
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
11. **Tray reports; the dropdown operates.** The rest icon has no text and no
    inline expansion; only the dropdown carries transport. It switches players
    but never adds bar app-switching controls. The tray icon is 28 px inside a
    40 px bar; the panel keeps the 40–44 px primary targets.
12. **Tray active-player resolution.** The tray follows the panel carousel's
    current player (`playingId`). The Mixer focus does not override it. The
    dropdown's Players list contains current players (a paused player remains
    selectable; its playing dot is absent); with one current player the list is
    omitted. No current player hides the tray. `?tray` and `?panel` are mock
    review links, not app config.
13. **Mutual exclusivity.** The tray dropdown and the panel share one overlay
    budget: opening either closes the other. The tray icon is the media
    entry point; the volume icon and the footer are panel entry points. This is
    UI behavior only, not a config key.

## Evidence

- `node --check` on the extracted script: exit 0 (syntax).
- Chrome 154.0.8037.92 headless screenshots at 1600×1000 and 1280×800 for the
  default Playing mode, Mixer, focused Mixer row, audio-only state, empty, and
  the device/route menus.
- The DOM interaction harness passed 78 checks: persistent header geometry,
  default mode, tab/dot state, Playing pages and transport/seek, read-only level
  → Mixer focus, Mixer rows/volume/mute/route, row and play/pause staying in
  Mixer, mode dot, and mode persistence through switching.
- The states harness passed 46 checks for `?mode=playing`, `?mode=mixer`,
  `?player=2`, `?app=vlc`, `?app=firefox`, `?playing=0`,
  `?mode=playing&playing=0`, `?apps=0`, `?mode=playing&apps=0`, `?muted=1`,
  `?input=0`, `?mic=0` and `?device=headphones`.
- The tray harness passed 93 checks: tray placement/height, placeholders, rest
  tooltip/dot, hover-does-not-open, click toggle, dropdown content, player
  switching, panel carousel sync, transport/seek, footer toggle, Esc order,
  outside click, hidden idle states, and `?tray=1` / `?tray=1&player=2` / `?panel=closed`.
- Tray screenshots: `/tmp/opencode/tray-rest-final.png`,
  `tray-open-panel-closed-final.png` (`?tray=1` with panel closed), and
  `tray-closed-final.png`; panel states remain the `final-twomode-*` captures.
- `mock.html` was checked for external URLs and `url(...)`: none.

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
- Tray → consume the same `AudioPanelBinding`/projection for the active player;
  the dropdown dispatches `playerAction`/`seek` and player selection updates the
  panel's `playingId`; the tray itself has no app-switch control. `openAudio`/
  `toggle` handles the footer. `?tray`/`?panel` are mock-only review links, not
  persisted config.
- The skin work consumes the corrected `:root` roles/radii; `--panel-w` stays
  app-owned until a layout token exists.
