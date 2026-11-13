---
id: REQ-019
title: "Sound final correctness: Tidal suppression, first-click stability, bar-only deploy"
kind: requirement
status: done
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-019/
branch: ticket/REQ-019-sound-final
---

# Sound final correctness

1. When a current native Tidal MPRIS player exists, suppress its Electron /
   Chromium mirror entirely, even if the mirror carries a stale different
   track. Do not suppress genuine Chrome multi-tab media.
2. Stabilize the selected Playing page across model updates by keying the page
   by id; verify pause/play and page switching dispatch on the first click.
   Reduce redundant panel fitting: fit only on layout-affecting state changes,
   not every 1 s position poll. Keep the 250 ms local progress interpolation.
3. Preserve and validate the same-PID two-Chrome sink-input case; the model
   must keep both node/serial stream IDs and the Mixer must render two rows.
4. Bar-only live deploy: build/stage the bar tag under
   `~/.local/share/dotfiles/apps/bar/<tag>`, repoint `~/.config/ags`, restart
   AGS. Do not run bootstrap/provision or change assets/platform/engine/
   composition tags. No skin retune; no `surface.window`.

## Additional canonical Tidal pass

Live still had a native Tidal + native-style duplicate (the Electron/Chromium
transport was already suppressed). Tidal now collapses to one canonical current
page across all Tidal transports: prefer native, then non-ended current media.
Chrome remains multi-tab/per-player.

## Selected-page stability

The selected app id is retained alongside the player id. If a canonical Tidal
player id changes after a transport action, the page remains on Tidal instead
of reverting to the first page. Carousel and tray selections record the app id.


## Bar-only live deployment (2026-11-13)

- Built/staged preseed checkout at
  `~/.local/share/dotfiles/apps/bar/v0.6.24` from tag `v0.6.24`.
- Pointed both `~/.config/ags` and the service spine
  `~/.local/share/dotfiles/config/ags` at `v0.6.24`; restarted
  `dotfiles-ags-bar.service`. No `bootstrap.sh` / provision was run.
- Assets `v0.21.3`, platform `v1.2.0`, engine `v0.1.82`, composition
  `v0.1.90` tags are unchanged.
- Live Tidal app row: one canonical player (`playerIds` length 1); tray shows
  one Tidal Players row; panel Playing page count 1/2 with the single Tidal
  page.
- Chrome app row `playerId` is
  `org.mpris.MediaPlayer2.chromium.instance6837#1`.
- First-click transport: Chrome `Playing -> Paused` and `Paused -> Playing`
  with one click each; the page remained Chrome.
- Scripted carousel/tray page-switch verification was not reliable in this
  session because the panel anchor moved under the injected pointer; the code
  now keys pages by stable id and preserves the selected app across a player-id
  change. Owner live testing remains for the first-click switch interaction.
- Same-PID two-Chrome live shape was not reproduced after the probe was removed;
  the exact same-app/same-PID node 80/node 48 case is covered by the graph-union
  regression test. A prior live two-Chrome pair was two processes and is not
  claimed as same-PID.
- Progress v0.6.20 code is unchanged; no skin retune; no `surface.window`.

Screenshots:
- `/tmp/opencode/req005/r10-final24-page.png` (Chrome + one Tidal page, 1/2)
- `/tmp/opencode/req005/r10-tray-final.png` (one Tidal Players row)
- `/tmp/opencode/req005/r10-first-play-click.png`
- `/tmp/opencode/req005/r10-second-play-click.png`
- `/tmp/opencode/req005/r10-play-first-click.png`
- `/tmp/opencode/req005/r9-live-mixer-two-chrome.png` (earlier two-sink-input Mixer; provenance noted above)
