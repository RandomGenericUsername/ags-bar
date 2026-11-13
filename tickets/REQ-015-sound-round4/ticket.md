---
id: REQ-015
title: "Sound panel round 4: bare artwork, MPRIS identity, per-player pages"
kind: requirement
status: done
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-015/
branch: ticket/REQ-015-sound-round4
---

# Sound panel round 4

1. Artwork is app-owned layout/content. The skin template no longer paints
   `.audio-track-art`, `.audio-artwork.audio-app-tile` or
   `.audio-strip-art.audio-app-tile`; the app container is transparent,
   borderless, shadowless and the thumbnail/app fallback is the only visual.
2. MPRIS app identity resolves from Identity/DesktopEntry and, when needed, the
   owner executable; never from the bus-name prefix. Chrome-vs-Tidal Electron
   has a regression test; Tidal must label as Tidal.
3. Playing pages and Players rows are per MPRIS player, retaining app
   name/icon, track and player identity. Mixer stays app/stream-scoped; a tab
   with audio but no MPRIS session gets no Playing page.
4. Mock/ticket/hash, gates, releases, live verification under terminal-host and
   one other skin. No skin retune; no `surface.window`.


## Live verification (2026-11-12)

- Final tags installed: bar `v0.6.18`, assets `v0.21.3`, platform
  `v1.2.0` (unchanged), engine `v0.1.79`, composition `v0.1.87`; runtime
  `1.5.3`.
- Live MPRIS rows: Firefox (`Mozilla firefox`), Google Chrome (`Chrome`), Tidal
  (`Tidal`); Tidal Electron and native share the Tidal app key but are separate
  pages/rows. The tray showed four Players: Firefox, Google Chrome, Tidal
  (Tidal Hi-Fi), Tidal (tidal-hifi). The Tidal page rendered `Tidal` +
  `tidal-hifi`, not Google Chrome.
- Bare artwork verified in Playing (40 px), tray (36 px), Players rows (22 px)
  and strip (32 px); no skin frame/background/border. The generated appearance
  only has `.audio-track-art-fallback` / `.audio-app-tile-fallback` text rules.
- Terminal-host and glass were both live; glass showed the same bare artwork
  and Tidal/Chrome rows. Live skin restored to terminal-host; no skin retune.
- No CSS `max-width`/`max-height` errors after v0.6.18; no `surface.window`
  selector.
- Mock hash `0ef38c46…`; assets v0.21.3.
- Limitation: the live Chrome exposed one MPRIS session (WhatsApp); the mock
  shows two Chrome sessions. A Chrome tab with audio but no MPRIS session is
  Mixer-only and correctly gets no invented Playing page.
