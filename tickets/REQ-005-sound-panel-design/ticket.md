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
10.5/11.5/13/15/28 type ramp, sentence case, 8 px rhythm, 40–44 px targets.

## Requirement

Replace the current tall, boxed sound drawer with a **352 px anchored popover**
under the bar's volume indicator, 8 px below the bar, with the desktop still
visible behind it. Every control the current panel exposes must remain
reachable, with output volume promoted to a single hero instead of a competing
line next to every app row.

The popover has four surfaces:

1. **Hero** — output volume (28 px value, slider, mute) and the preferred output
   device with a compact selector.
2. **Now playing** — CSS-art artwork, title/artist/album, previous/play-pause/
   next, seek + times; an honest empty state. A live stream hides seek and
   transport actions it cannot support.
3. **Apps · N** — collapsed by default. Expanding shows one row per app: icon,
   name, current media/“Audio only”, output route, volume slider, mute, and a
   `Mixed` badge when the app's streams disagree. Clicking an app row focuses
   that app's player in the now-playing card, so per-app transport/seek survives
   without duplicating controls in every row.
4. **Input** — secondary and collapsed by default. Expanding shows the input
   device selector, microphone level, mute, and the apps currently using the
   microphone. No input and no consumer both have honest states.

No settings gear or config-file escape hatch is added: the current popup has
none. Right-click → `pavucontrol` is a bar-widget gesture, not part of this
surface, and remains outside the mock.

## Functionality inventory

| Current action (`audio/AudioPopup.tsx`) | Mock surface |
| --- | --- |
| `selectPreferredOutput` | Hero device row → output menu (unavailable outputs disabled) |
| `setOutputVolume` | Hero slider + big value |
| `toggleOutputMute` | Hero mute button; level is retained while muted |
| `setAppRoute` (follow preferred / explicit override) | App row route chip → menu (default reflects the selected output) |
| `setAppVolume` | App row slider + percent |
| `toggleAppMute` | App row mute button; `Mixed` badge for divergent levels |
| `playerAction` play-pause / previous / next | Now-playing card; the focused app follows the row click |
| `seek` | Now-playing seek slider + elapsed/duration; live streams hide it |
| `selectInput` | Input device row → input menu |
| `setInputVolume` | Input slider + percent |
| `toggleInputMute` | Input mute button |
| `inputConsumers` | “Using microphone” line under the input controls |
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
- [x] The app mixer is collapsed by default, shows `Apps · N`, and expands to
      volume/mute/route rows with the mixed state.
- [x] Now-playing, transport, seek, live-stream, paused and empty states work.
- [x] The input section is collapsed by default and covers device, level, mute,
      consumers, unavailable input and no-consumer states.
- [x] Sliders, mute buttons, device selection, app expand, route selection,
      transport, seek, input controls, `Esc` and bar-icon reopen are interactive.
- [x] Deep links work: `?muted=1`, `?apps=1`, `?apps=0`, `?playing=1`,
      `?playing=0`, `?input=1`, `?input=0`, `?mic=0`, `?device=`, `?app=`.
- [x] Tokens live in `:root`; the skin remap seam is documented below.
- [x] No bar code was changed, no app→app imports were added, and no config file
      was invented.

Implementation acceptance is intentionally out of scope for this ticket; see
Follow-up.

## Mock path

`tickets/REQ-005-sound-panel-design/mock.html` (1970 lines, no external URLs,
no `<img>`, no `url(...)` asset references).

Open it directly:

```sh
google-chrome-stable --new-window \
  "file:///home/inumaki/Development/dotfiles/ags-bar/.worktrees/REQ-005/tickets/REQ-005-sound-panel-design/mock.html"
```

## Deep links

| Query | State |
| --- | --- |
| `?muted=1` | Preferred output muted; the level is kept and labelled |
| `?apps=1` / `?apps=0` | App mixer expanded / zero apps (empty mixer) |
| `?playing=1` / `?playing=0` | Explicit playing (the default) / no MPRIS media; app rows fall back to `Audio only` |
| `?input=1` / `?input=0` | Input expanded / no input device (disabled controls) |
| `?mic=0` | Input available, no microphone consumers |
| `?device=headphones` | Select an available output (`speakers`, `headphones`) |
| `?app=firefox` | Focus that app's player; Firefox is the live-stream case |

## Token / skin mapping

All chrome tokens are custom properties in `:root` (`mock.html:38-76`) so the
parallel skin work can remap them without touching structure:

| Mock token | Appearance mapping |
| --- | --- |
| `--ink`, `--ink-dim`, `--ink-faint` | palette on-surface ramp |
| `--glass`, `--glass-strong` | palette surface at two opacities |
| `--hairline`, `--hairline-soft` | palette outline at two alphas |
| `--accent`, `--on-accent` | palette primary / on-primary |
| `--live` | semantic green, not a palette role |
| `--panel-w` | skin layout token (352 px default) |
| `--r-panel`, `--r-card`, `--r-chip` | skin radii |
| `--surface`, `--outline`, `--focus-ring` | alias seam: the only remap points the skin needs |

Content art (dragon wallpaper, album covers, app tile gradients) is deliberately
not tokenised: it is content, not skin. Geometry and structure stay in the
mock's CSS, mirroring 106's rule that the appearance plane has no structure.

## Assumptions and deviations

1. **The output line returns as the hero.** `AudioPopup.tsx:278-290` records a
   2026-10-04 owner decision to drop a device-level volume/mute line because it
   competed with each app's own line. The new brief requires output volume in
   the hero. The resolution is hierarchy: exactly one output control at the top;
   per-app levels stay inside the collapsed mixer. The existing
   `setOutputVolume` / `toggleOutputMute` actions are already present.
2. **Per-app transport is not duplicated.** The current row renders its own
   transport/seek. The mock keeps one now-playing card and lets an app row focus
   its player, preserving previous/next/seek for every app without a wall of
   sliders. This is an interaction change to validate at implementation.
3. **No gear or settings link.** The current popup has no settings entry, so the
   mock does not invent one. No JSON file is written.
4. **Unavailable devices stay visible but disabled.** `HDMI · Display` exercises
   the disabled branch; selecting it is a no-op, not a fake success.
5. **Simulation.** Data is in-memory; position advances once per second while
   playing. `?playing=0` removes players but keeps app audio streams (the
   `Audio only` case). There is no real PipeWire/MPRIS access.
6. **Mixed mute.** The `Mixed` badge demonstrates the divergent-level branch;
   mixed mute shares that same badge/active-mute path rather than adding a second
   app-row state.

## Evidence

- `node --check` on the extracted script: exit 0 (syntax).
- Chrome 154.0.8037.92 headless screenshots at 1600×1000 and 1280×800 for the
  default, `?apps=1&input=1`, `?playing=0&apps=1&input=0&muted=1`,
  `?app=firefox`, `?input=1&mic=0`, and the two device/route menus.
- A DOM interaction harness (outside the repo, `/tmp/opencode/sound-harness.html`)
  passed: output slider/mute, device menu + selection, route menu + override,
  play/pause, next track, seek, app volume/mute, app focus switch, input
  volume/mute, `Esc` close and bar-icon reopen.
- `mock.html` was checked for external URLs and `url(...)`: none.

## Follow-up

Implementation maps onto the existing composition without new actions:

- Hero → `selectPreferredOutput`, `setOutputVolume`, `toggleOutputMute`
  (`audio/application/audio-actions.ts:15-90`).
- Mixer → `setAppVolume`, `toggleAppMute`, `setAppRoute`
  (`audio-actions.ts:42-107`).
- Now playing → `playerAction` / `seek` (`audio-actions.ts:123-154`), driven by
  the focused row from `projectAudioPanel` (`audio-panel-view-model.ts:118-225`).
- Input → `selectInput`, `setInputVolume`, `toggleInputMute`
  (`audio-actions.ts:69-121`).
- The menus replace the current `openChoicePopover` lists with the same
  selected/disabled semantics.
- The skin work consumes only the `:root` aliases above; no structure changes.
