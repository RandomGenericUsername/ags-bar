---
id: REQ-007
title: "Redesign the Wi-Fi panel as an anchored popover"
kind: requirement
status: in-progress
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-007/
branch: ticket/REQ-007-wifi-panel-design
---

# Redesign the Wi-Fi panel as an anchored popover

Design-only ticket. The deliverable is the interactive mock and this criteria
contract; bar source is unchanged. The design inherits the control-centre
language approved for the sound panel (REQ-005): one glass chrome layer, no
accent frame, accent only for state/action, the 10.5/11.5/13/15–16 type ramp,
sentence case, 8 px rhythm and 40–44 px primary targets.

> **Ticket id.** The brief asked for REQ-006, but `tickets/INDEX.md` already has
> `REQ-006-generations-v3` (done). The next free id is REQ-007; that is this
> ticket.

## Requirement

Replace the current boxed Wi-Fi drawer with a **352 px anchored popover** 8 px
under the bar's Wi-Fi indicator, with the desktop and an editor window still
visible behind it. It is one glass surface: 18 px radius, 1 px hairline, one
soft shadow, no accent frame and no nested cards. The bar's Wi-Fi icon is
highlighted while the popover is open.

The surface has four parts.

1. **Header.** Wi-Fi glyph, title `Wi-Fi`, a live status subtitle
   (`Connected to <SSID>`, `Wi-Fi off`, `Scanning…`, `Join <SSID>`,
   `Connection failed`), the on/off switch and a settings gear. The header is
   persistent above the scroll area.
2. **Current connection hero** (only when connected). SSID, signal bars and
   quality, security, a green `Connected` state, and a weak-security warning
   when the link uses WPA/WEP-grade security. A compact details area carries
   `IP / iface` and `MAC`, followed by the latest speed-test result:
   `Download`, `Upload`, `Ping`, `Ran`. The hero has a `Run test` action that
   shows a spinner, keeps the previous numbers while running, and surfaces a
   typed error without blanking the last result.
3. **Networks list.** `Known` first (connected network, then saved networks),
   then `Nearby`. There is no `Other Networks` chevron and no expand/collapse.
   Each row has a signal glyph, SSID, a sub-line (`Saved`, `Secured`,
   `Open network`), a green `Connected` badge when applicable, and a `Connect`
   action or an in-row spinner. Clicking the row connects. A secured network
   that is not saved opens the password prompt instead of connecting; saved
   and open networks connect without a password. Scanning stays automatic while
   the surface is visible and there is a quiet `Scan` affordance.
4. **Password prompt.** Replaces the list while active: network name, password
   field with reveal, inline error, `Cancel` and `Join`. Failure keeps the
   prompt open for retry; a cancelled prompt returns to the list.
5. **Settings popover.** A sibling surface anchored under the gear, not a nested
   card. It owns the existing speed-test settings: interval chips
   `5m / 15m / 30m / Off`, the custom millisecond field (same commit rules as
   the current entry: digits only, empty/≤0 = Off, `<1000` clamps to 1000),
   `Auto-run on connect`, `Notify on each test`, and `Run now`. The existing
   `wifi-speedtest.json` is the source; no new config file is introduced.
6. **Footer.** A `Network settings` row, always reachable, opens
   `nm-connection-editor`. In the mock it reports the launch as a toast.

## Interaction

- **Switch.** Turning Wi-Fi off closes the prompt, cancels an in-flight connect
  and shows the off state. Turning it on starts a scan cue. The setting remains
  backend-driven in the app; the mock is a view.
- **Rows.** Row click and the `Connect` action are the same intent. The row is
  a keyboard target (`Enter` / `Space`). The action shows `Connecting…` with a
  spinner and is not clickable twice.
- **Password.** The field receives focus on open (ON_DEMAND). `Enter` joins.
  Reveal toggles the visible password and reports `aria-pressed`. Empty input
  produces an inline error. A failed join stays on the prompt and allows a
  retry.
- **Settings.** Chips and switches save immediately to the existing config
  shape. The custom field commits on Enter or leave; non-digit text reverts to
  the committed value. `Run now` shares the speed-test state with the hero
  action.
- **Keyboard focus.** The popover uses `ON_DEMAND` only while a text field is
  on screen: the password field or the settings interval field. With neither
  visible, keyboard mode is `NONE`, matching the current `WifiPopup` rule.
- **Escape / outside click.** Esc closes the settings popover first, then the
  password prompt (back to the list), then the panel. An outside click closes
  the settings popover and the panel. Clicking the bar icon toggles the panel.
- **Scanning.** The real service scans every 6 s while a surface is visible;
  the mock shows the scanning cue on the same cadence and keeps the list
  stable. No background polling outside the open popover.

## States

| State | What the surface says |
| --- | --- |
| Off | `Wi-Fi off`; honest copy; footer remains. |
| Scanning | `Scanning…`; list remains usable; `Scan` becomes a spinner note. |
| Connected | Hero + green `Connected` badge; known and nearby lists. |
| Disconnected | `Not connected`; no hero; list still available. |
| No networks | `No networks found` + `Scan again`; no fake rows. |
| Empty known / nearby | Honest `No saved networks yet.` / `No other networks nearby.` |
| Connection failure | `Connection failed` + dismissible notice; no fake success. |
| Need auth / retry | Password prompt, inline error, retry stays available. |
| Weak security | Warning inside the hero; the link otherwise works. |
| Speed test running | Spinner, `Testing…`, previous values retained. |
| Speed test error | Typed error; previous result and `Ran` retained. |
| No speed-test result | `—` values and `Not run yet`; no invented numbers. |
| Joining / connecting | Subtitle and row spinner name the target. |

## Acceptance

Design deliverable:

- [x] `mock.html` is one self-contained file with no external URLs, `<img>`,
      `url(...)` assets or build step.
- [x] The popover is 352 px wide, anchored 8 px under the bar's Wi-Fi icon, over
      a visible desktop/editor, with one glass layer, 18 px radius, 1 px
      hairline and one soft shadow. No accent frame.
- [x] The bar's Wi-Fi icon is highlighted while open.
- [x] The header carries the Wi-Fi glyph, title, live status subtitle, on/off
      switch and settings gear.
- [x] The hero shows SSID, signal/quality, security, connected state, weak
      warning when applicable, `IP / iface`, `MAC`, and the latest
      `Download / Upload / Ping / Ran` result.
- [x] `Run test` has a spinner state and a typed error state; the previous
      result is retained on failure.
- [x] `Known` (connected + saved) is followed by `Nearby`; the old
      `Other Networks` chevron/expand is gone.
- [x] Rows carry signal, SSID, sub-line, connected badge and `Connect`/spinner;
      row click and the action connect.
- [x] Secured + unsaved opens the password prompt; saved and open networks
      connect directly.
- [x] The password prompt replaces the list, names the network, has reveal,
      inline error, `Cancel`/`Join`, and preserves failure/retry.
- [x] The settings gear opens a sibling popover with interval chips, custom
      milliseconds, auto-run, notify, `Run now`, and the existing
      `wifi-speedtest.json` as source. No new config file.
- [x] The `Network settings` footer row remains and reports
      `nm-connection-editor`.
- [x] Off, scanning, empty, failure, password, weak-security and speed-test
      running/error/last-result states are present with honest copy.
- [x] Keyboard: switch, rows, connect, password field, reveal, Join/Cancel,
      settings controls, Run test and footer are reachable. ON_DEMAND is
      represented by `data-keyboard="on-demand"` only while a text field is
      visible.
- [x] No uppercase micro-labels and no chevrons; sentence case throughout.
- [x] Deep links cover the review states listed below.
- [x] No bar source was changed and no app→app import was added.

Implementation acceptance is out of scope here; see Follow-up.

## Mock path

`tickets/REQ-007-wifi-panel-design/mock.html`

```sh
google-chrome-stable --new-window \
  "file:///home/inumaki/Development/dotfiles/ags-bar/.worktrees/REQ-007/tickets/REQ-007-wifi-panel-design/mock.html"
```

## Source of truth and drift rule

- Normative mock: `mock.html`; sha256
  `64cce26ad4b5ef70dc4b851ee6896874acd03341d427826d3832f3355cbeb8aa`
  (also recorded in `mock.sha256`).
- This ticket is the **criteria** source of truth; the mock is the **look and
  interaction** source of truth.
- Any change to `mock.html` must update this ticket and `mock.sha256` in the
  same commit. Any criteria change must update the mock in the same commit.
  If they disagree, fix one before merging.
- The app-local ticket + mock are canonical; there is no separate
  composition-level Wi-Fi contract.

## Deep links

| Query | State |
| --- | --- |
| `?off=1` | Wi-Fi off; switch off; no hero or lists. |
| `?scanning=1` | Persistent scanning cue; pair with `connected=none` for `Scanning…` in the header. |
| `?empty=1` | No networks found; `Scan again`. |
| `?password=<ssid>` | Open the prompt for an SSID. `?password=1` picks the first secured nearby network. |
| `?password=<ssid>&fail=1` | Prompt open with an inline `Incorrect password` error; the next Join succeeds. |
| `?weak=0` / `?weak=1` | Hide / show the weak-security warning on the connected network. |
| `?error=1` | Connection-failure notice. Disconnects unless `connected` is explicit. |
| `?settings=1` | Open the speed-test settings popover. |
| `?test=running` / `done` / `error` / `none` | Speed-test spinner / last result / typed error / no result. |
| `?connected=<ssid>` / `?connected=none` | Choose the connected sample network, or disconnect. |
| `?nearby=0` / `?known=0` | Empty nearby / empty known list. `known=0` disconnects unless `connected` is explicit. |
| `?connecting=<ssid>` | Show the row spinner and `Connecting to…` without completing. |
| `?panel=closed` | Start closed; the bar icon reopens it. |

## Functionality inventory

| Current action | Mock surface |
| --- | --- |
| `setWifiEnabled` / `WifiSwitch` | Header switch; off state; bar icon changes. |
| `WifiRow` click → `activate` | Known/nearby row or `Connect`, with spinner. |
| `wifiNetworks` grouping | `Known` (connected + saved) then `Nearby`; no chevron. |
| `WifiPasswordPrompt` | Password view replacing the list, reveal, error, retry. |
| `deviceInfo` + `lastResult`/`lastRunAt`/`lastError` | Hero details and speed-test cells. |
| `runSpeedTest` (currently settings-only) | Hero `Run test` and settings `Run now`. |
| `IntervalMsControl`, `run_on_connect`, `notify_on_test` | Settings popover; existing `wifi-speedtest.json` shape. |
| `nm-connection-editor` row | Footer `Network settings`. |
| Scanning / `startScanning` | Automatic cue while open + `Scan`. |

## Assumptions and deviations

1. **Ticket id.** REQ-007, because REQ-006 is already used by
   `REQ-006-generations-v3`.
2. **Design only.** No bar code, service or CSS was changed; the worktree
   contains only the ticket, mock, index and README entry.
3. **Config stand-in.** The mock stores the existing
   `{ interval_ms, run_on_connect, server_mode, notify_on_test }` shape in
   `localStorage` under `wifi-speedtest.json`. The real app reads/writes
   `$XDG_STATE_HOME/ags/wifi-speedtest.json` through `speedtest-service.ts`;
   the mock does not invent a second file.
4. **Deliberate weak sample.** `Jupiter 5G` is WPA so the weak-security branch
   is visible in the default capture. `?weak=0` (or `?connected=Home`) shows the
   strong branch.
5. **Empty-known coherence.** `?known=0` disconnects unless `connected` is
   explicit, so a connected hero never contradicts an empty known list.
6. **Icons.** Wi-Fi and gear glyphs are inline SVG; row signal strength is CSS
   bars. There are no external assets, fonts or images.
7. **ON_DEMAND.** The mock exposes the real rule as
   `#panel[data-keyboard="on-demand"]`; the app keeps the existing
   `PopupHost` computed condition (password prompt or the interval entry only).
8. **Scan cadence.** The mock's 7 s cue is decorative; the service scans every
   6 s while a surface is visible and stops when it closes.
9. **Network settings.** The footer click is a toast in the mock; the real row
   still spawns `nm-connection-editor`.
10. **Panel width.** `--panel-w: 352px` is an app literal until a
    `layout.ags` width token exists; no layout token is invented here.

## Follow-up

Implementation maps onto the current Wi-Fi service and `WifiContent`:

- Header/hero → `wifiEnabled`, `wifiNetworks`, `deviceInfo`, `lastResult`,
  `lastRunAt`, `lastError`, `running`, `runSpeedTest`.
- Known/nearby → partition `wifiNetworks` into
  `connected || saved` and `!connected && !saved`; the service already sorts
  connected, saved, strength.
- Row intent → `activate(ssid)` for saved/open, password prompt for
  `secured && !saved`, `submitPassword` for `needAuth`, `cancel` for Cancel.
- Password prompt → keep the existing `WifiPasswordPrompt` behaviour; drop the
  `Other Networks` chevron and `stcExpanded` from the popup into the sibling
  settings surface.
- Settings → reuse `IntervalMsControl`, `STC_CHIPS`, `setConfigValue`,
  `runSpeedTest("manual")`; keep `wifi-speedtest.json` under XDG state.
- ON_DEMAND → keep the existing `wifiSurface.keyboard` condition (password or
  interval entry), which is already correct.
- Visual → map `:root` chrome roles/radii to the appearance layer; the hero and
  lists use semantic state colours, not a palette role for green.
