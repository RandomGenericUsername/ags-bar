---
id: REQ-015
title: "Sound panel round 4: bare artwork, MPRIS identity, per-player pages"
kind: requirement
status: in-progress
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
