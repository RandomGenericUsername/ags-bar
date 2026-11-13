---
id: REQ-013
title: "Sound panel feedback round 2: fit, owner icons, strip and tray"
kind: requirement
status: done
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-013/
branch: ticket/REQ-013-sound-round2
---

# Sound panel feedback round 2

1. Input collapse refits the panel after the visibility change settles; no dead height.
2. Owner icon art integrated through assets/platform: `media-controls`
   (shuffle, shuffle-active, repeat, repeat-once, repeat-off) and the
   `settings`/`settings-panel` gear; text glyphs removed; capability hiding
   preserved.
3. Bar media strip: 32px track thumbnail, no tile fill, text uses available
   width.
4. Tray: transport centered and larger.
5. Mock/ticket/hash updated; bar/assets/platform/engine/composition cutover;
   live terminal-host verification; no skin retune, no `surface.window`.

## Live verification (2026-11-12)

Final installed tags: bar **v0.6.14**, assets **v0.21.0**, platform
**v1.2.0**, engine **v0.1.75**, composition **v0.1.83**; live verify
`ok=337 failed=0`; terminal-host/dark generation
`fb0106c60257…`; host radius 0.

### Input

Live layer heights: initial **509**, expanded **659**, collapsed **509**,
reopened **509**. The debug metrics at collapse: `inputOpen=false`,
`measured=296`, `target=296`, `request=296`, `rootHeight=509`. The conditional
Input body plus the window natural-height refresh remove the dead bottom.

- `/tmp/opencode/req005/r3-final-input-expanded.png`
- `/tmp/opencode/req005/r3-final-input-collapsed.png` (footer at the bottom)

### Icons and capability hiding

- `current/icons` has `media-controls-shuffle(-active)`, `repeat`,
  `repeat-once`, `repeat-off`, `settings-panel-settings` and the new
  `status-bar-settings`; the bar registry resolves them, no text glyphs.
- Chrome/video page: only previous/play/next (no shuffle/repeat).
- Tidal page: shuffle + repeat controls (shuffle active, repeat-off shape).
- Glass verification generation `06799bd0442b…`: active fill `#b9c3ff`,
  inactive fill `#e3e1e9`; the gear renders on glass.
- `/tmp/opencode/req005/r3-final-tidal.png`,
  `r3-final-input-collapsed.png` (video), `r3-glass-tidal.png`,
  `r3-glass-icons.png`.

### Strip, tray and first-round regression

- `/tmp/opencode/req005/r3-final-bar-top.png`,
  `r3-final-strip-zoom.png` (32 px transparent thumbnail, title uses width).
- `/tmp/opencode/req005/r3-final-tray2.png` (centered 36/18 transport, new
  icons, Tidal controls).
- `/tmp/opencode/req005/r3-final-muted.png` (dimmed value, small pill).
- `/tmp/opencode/req005/r3-final-settings.png` (one settings surface, square
  host-0 corners; no double frame).
- No AGS overlay uses `surface.window`; the skin was not retuned.

## Final residuals (v0.6.15)

- **Shuffle-off opacity:** assets v0.21.1 copies the owner's
  `shuffle-disabled.svg` into `media-controls/shuffle` with
  `fill-opacity="0.5"`; `shuffle-active` stays full. Live Tidal off
  `r4-final-tidal-off.png`, on `r4-final-tidal-on.png`; Chrome/video
  `r4-final-video.png` has no shuffle/repeat.
- **Strip centering:** 340 px slot with the art/title/controls group
  horizontally centered; 32 px transparent art, no tile. Real 1920 bar
  `r4-final-strip-tidal-zoom.png`; mock `r4-mock-1920-strip.png`,
  `r4-mock-1280-strip.png`.
- **Canonicalization:** fast-forwarded the final tags to `main`/`master`:
  bar main `215066e` (v0.6.15), assets master `8776419` (v0.21.1), platform
  main `85d35b8` (v1.2.0), engine main `79b720d` (v0.1.76), composition master
  `d09aa0c4` (v0.1.84). Tags pushed.
- Final live: bar v0.6.15, assets v0.21.1, platform v1.2.0, engine v0.1.76,
  composition v0.1.84; generation `249c3428…`; verify 337. Muted/settings
  first-round screenshots `r4-final-muted.png`, `r4-final-settings.png`.
