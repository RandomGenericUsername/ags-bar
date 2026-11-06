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
line next to every app row.

The popover has five surfaces:

1. **Hero** — output volume (28 px value, slider, mute) and the preferred output
   device with a compact selector.
2. **Now playing** — a **compact horizontal strip**, not a card: 40 px CSS-art
   artwork, title 13/600, artist 10.5/dim, a small source-app badge and an
   `n/N` player indicator. Inline transport lives on the right: previous,
   play/pause, next, shuffle, repeat. A slim 2 px interactive seek line with
   9.5 px elapsed/duration sits under the strip. The strip stays 64–72 px tall
   and has no panel/card background. A live stream hides seek and any transport
   action it cannot support. Empty when nothing is playing.
3. **Carousel** — when more than one app has a current player (playing or
   paused), left/right arrows flank the strip and cycle through those players;
   the arrows are hidden at ≤1 player. The strip's transport always acts on the
   displayed app. Clicking an app row also focuses that app's strip, with a
   subtle row highlight; the transport exists only in the strip.
4. **Apps · N** — always visible, with no expand/collapse chevron. Each row is
   icon, name, current media/`Audio only`, a compact route chip/menu, volume and
   mute, plus a `Mixed` badge when streams disagree. There are no per-app
   transport icons.
5. **Input** — secondary and collapsed by default. Expanding shows the input
   device selector, microphone level, mute, and the apps currently using the
   microphone. No input and no consumer both have honest states.

No settings gear or config-file escape hatch is added: the current popup has
none. Right-click → `pavucontrol` is a bar-widget gesture, not part of this
surface, and remains outside the mock.

**MPRIS note.** Shuffle and Loop are not in the current `PlayerCapabilities`
model or `AudioPanelActions`; the mock simulates them. Implementation must
expose Shuffle/Loop capability flags and actions. The strip hides either icon
when the displayed player does not support it, exactly as the mock hides both
on the Firefox live stream.

## Functionality inventory

| Current action (`audio/AudioPopup.tsx`) | Mock surface |
| --- | --- |
| `selectPreferredOutput` | Hero device row → output menu (unavailable outputs disabled) |
| `setOutputVolume` | Hero slider + big value |
| `toggleOutputMute` | Hero mute button; level is retained while muted |
| `setAppRoute` (follow preferred / explicit override) | App row route chip → menu (default reflects the selected output) |
| `setAppVolume` | App row slider + percent |
| `toggleAppMute` | App row mute button; `Mixed` badge for divergent levels |
| `playerAction` play-pause / previous / next | Strip transport, acting on the displayed app; app rows only select it |
| `seek` | Strip's 2 px seek line + elapsed/duration; live streams hide it |
| `selectInput` | Input device row → input menu |
| `setInputVolume` | Input slider + percent |
| `toggleInputMute` | Input mute button |
| `inputConsumers` | “Using microphone” line under the input controls |
| Shuffle / Loop (new MPRIS capability) | Strip icons; toggled per displayed player; hidden when unsupported |
| Output / app / input empty or unavailable states | No apps, nothing playing, audio-only apps, unavailable output entry, no input, no mic consumer |

## Acceptance

Design deliverable:

- [x] `mock.html` is one self-contained file with no external assets and no
      build step; it opens directly in a browser.
- [x] The popover is 352 px wide, anchored 8 px under the bar at the top-right,
      on the dragon wallpaper, with one glass layer, an 18 px radius, a 1 px
      hairline and one soft shadow. There is no accent frame.
- [x] The hero carries output volume/mute and the output device selector; the
      value uses the 21+ display size and the primary controls meet 40–44 px.
- [x] The now-playing surface is a 64 px compact strip with 40 px artwork,
      title/artist, inline transport, source badge, `n/N`, and a 2 px seek line
      with 9.5 px times. It has no card background.
- [x] More than one current player shows flanking carousel arrows; ≤1 hides
      them; transport acts on the displayed app; app row clicks focus the strip.
- [x] The Apps list is always visible with no expand/collapse chevron, keeps
      route/volume/mute, has no per-app transport icons, and highlights the
      focused row.
- [x] Shuffle and repeat appear only when supported, reflect state, and repeat
      cycles off → all → one.
- [x] The input section is collapsed by default and covers device, level, mute,
      consumers, unavailable input and no-consumer states.
- [x] Sliders, mute buttons, device selection, route selection, carousel,
      transport, seek, input controls, `Esc` and bar-icon reopen are interactive.
- [x] Deep links work: `?muted=1`, `?apps=1` (default/no-op), `?apps=0`,
      `?playing=1`, `?playing=0`, `?input=1`, `?input=0`, `?mic=0`,
      `?device=`, `?app=`, and `?player=2` (1-based carousel preset).
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
| `?apps=1` / `?apps=0` | Default alias (apps are always visible) / zero apps |
| `?playing=1` / `?playing=0` | Explicit playing (the default) / no MPRIS media; app rows fall back to `Audio only` |
| `?player=2` | Preset the carousel to the 2nd current player (1-based) |
| `?input=1` / `?input=0` | Input expanded / no input device (disabled controls) |
| `?mic=0` | Input available, no microphone consumers |
| `?device=headphones` | Select an available output (`speakers`, `headphones`) |
| `?app=firefox` | Focus that app's player; Firefox is the live-stream case |

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
   per-app levels stay inside the Apps list. The existing `setOutputVolume` /
   `toggleOutputMute` actions are already present.
2. **Transport lives only in the strip.** App rows no longer carry playback or
   seek controls; clicking a row focuses that player in the strip. This is the
   deliberate change requested by the reference, and it preserves per-app
   prev/next/seek through the carousel.
3. **No gear or settings link.** The current popup has no settings entry, so the
   mock does not invent one. No JSON file is written.
4. **Unavailable devices stay visible but disabled.** `HDMI · Display` exercises
   the disabled branch; selecting it is a no-op, not a fake success.
5. **Simulation.** Data is in-memory; position advances once per second while
   playing. `?playing=0` removes players but keeps app audio streams (the
   `Audio only` case). Carousel membership is “apps with a current player”
   (playing or paused), not only actively playing apps.
6. **Mixed mute.** The `Mixed` badge demonstrates the divergent-level branch;
   mixed mute shares that same badge/active-mute path rather than adding a second
   app-row state.
7. **Strip density exception.** Five actions share one 64 px row. The secondary
   transport buttons are 26×40 px and play is 34 px, so the strip stays compact
   and the title/artist remain readable. If strict 40×40 is required for every
   transport action, the panel must widen or move transport to a second row.
8. **Height trade.** Always-visible Apps makes the panel taller than the old
   collapsed state. The compact strip and tighter row padding remove the card's
   cost, and the result remains much shorter than the old expanded panel; the
   two instructions (no expand chevron + shorter panel) are balanced this way.

## Evidence

- `node --check` on the extracted script: exit 0 (syntax).
- Chrome 154.0.8037.92 headless screenshots at 1600×1000 and 1280×800 for the
  default, `?input=1`, `?player=2`, `?player=3`, `?playing=0&input=0&muted=1`,
  and the device/route menus.
- The existing DOM interaction harness passed 45 checks, including the new
  carousel (1/3 → 2/3 → 3/3 → 1/3), unsupported shuffle/repeat hiding, shuffle
  toggling, repeat cycling, app-row focus, and all prior output/app/input/
  escape checks.
- An 18-check states harness passed for `?playing=0` (no carousel, empty
  media), `?player=2` (Firefox, 2/3, live seek hidden), `?apps=0` (empty list)
  and `?muted=1`.
- `mock.html` was checked for external URLs and `url(...)`: none.

## Follow-up

Implementation maps onto the existing composition plus the new MPRIS surface:

- Hero → `selectPreferredOutput`, `setOutputVolume`, `toggleOutputMute`
  (`audio/application/audio-actions.ts:15-90`).
- Mixer → `setAppVolume`, `toggleAppMute`, `setAppRoute`
  (`audio-actions.ts:42-107`).
- Strip → `playerAction` / `seek` (`audio-actions.ts:123-154`) for the displayed
  player; carousel order from `projectAudioPanel` rows with a current player
  (`audio-panel-view-model.ts:118-225`).
- Shuffle/Loop → extend `PlayerCapabilities`, `AudioPlayer` and
  `AudioPanelActions`, and add the MPRIS toggle calls. Hide each control when
  the capability flag is false.
- Input → `selectInput`, `setInputVolume`, `toggleInputMute`
  (`audio-actions.ts:69-121`).
- The menus replace the current `openChoicePopover` lists with the same
  selected/disabled semantics.
- The skin work consumes the corrected `:root` roles/radii; `--panel-w` stays
  app-owned until a layout token exists.
