---
id: REQ-009
title: "Redesign the Bluetooth panel as an anchored popover"
kind: requirement
status: in-progress
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-009/
branch: ticket/REQ-009-bluetooth-panel-design
---

# Redesign the Bluetooth panel as an anchored popover

Design-only ticket. The deliverable is the interactive mock and this criteria
contract; bar source is unchanged. This is the Bluetooth sibling of the approved
sound panel (REQ-005), Wi-Fi panel (REQ-007) and battery panel (REQ-008), using
the same control-centre language: one glass chrome layer, no accent frame,
accent only for connected state and the primary action, sentence case, 8 px
rhythm and 40–44 px primary targets.

> **Ticket id.** `tickets/INDEX.md` ends at REQ-008; the next free id is REQ-009.

## Design status

- Design commit: `2651c58`; review commit `fb37490`.
- Mock sha256: `0df4939a4c02b1df38f8f966d0539b9569ad27c17aa1c55532fb8807d3d57eed`
  (recorded in `mock.sha256`).
- The mock is the normative look/interaction source and this ticket the criteria
  source; both are frozen as of 2026-11-09. The old 312 px Bluetooth drawer
  remains live until implementation.
- No bar source, service or CSS was changed.

## Frozen final (approved 2026-11-09)

This is the approved Bluetooth panel design and the **intent** for the feature.

- Design commit: `2651c58`; review commit `fb37490`.
- Mock sha256: `0df4939a4c02b1df38f8f966d0539b9569ad27c17aa1c55532fb8807d3d57eed`
  (recorded in `mock.sha256`).
- The design deliverable below is the criteria; implementation follows.
- The old 312 px Bluetooth drawer remains live until implementation.
- `Nearby` auto-open is approved as the default; collapsed remains available
  (`?nearby=0` / `?nearby=1`).

## Current inventory (kept, not replaced)

These are the real behaviours the redesign must preserve. Evidence is the
current source at `f6e82f3`.

| Behaviour | Current source |
| --- | --- |
| Header power switch; switch insensitive when no `Adapter1` exists | `components/bluetooth/BluetoothPopup.tsx:36-45`; `services/bluetooth-service.ts:135` |
| Adapter address (`Adapter1.Address`), `—` when unpublished | `BluetoothContent.tsx:741-751`; `bluetooth-service.ts:124, 253` |
| Paired list with a `Connected` badge on connected rows | `BluetoothContent.tsx:268-303` |
| Device battery shown only while connected | `BluetoothContent.tsx:328-346` |
| Signal glyph; exact dBm lives only in the glyph tooltip; no glyph when unseen | `BluetoothContent.tsx:106-154` |
| Out-of-range paired devices dimmed; Connect refused; Unpair stays | `BluetoothContent.tsx:178-183, 226-249`; `style.css:398-402` |
| Pair / Connect / Disconnect / Unpair | `BluetoothContent.tsx:214-266`; `bluetooth-service.ts:1095-1147` |
| Inline unpair confirm (`Keep` / `Unpair device`), no row reflow | `BluetoothContent.tsx:185-212, 366-456` |
| BlueZ single-flight; other row actions unavailable while busy | `bluetooth-service.ts:763-792`; `BluetoothContent.tsx:173-178, 226` |
| Busy spinner + `Pairing…/Connecting…/Disconnecting…/Unpairing…` + `Can take up to 30 s` | `BluetoothContent.tsx:214-223, 316-364`; `bluetooth-service.ts:35, 612-625` |
| Discovery runs while the surface is visible and powered | `BluetoothContent.tsx:577-587`; `bluetooth-service.ts:942-1029` |
| `Available Devices` tri-state auto-open, count, header/placeholder scanning cue | `BluetoothContent.tsx:533-575, 629-666, 774-861` |
| Failures are notification cards, never in-panel rows | `bluetooth-service.ts:113-120, 722-761` |
| Audio routing on connect is silent; no audio-route row | `BluetoothContent.tsx:589-616`; `bluetooth-service.ts:809-908` |
| Footer opens `blueman-manager`; Blueman also completes PIN/passkey pairing | `BluetoothContent.tsx:462-523`; `BluetoothPopup.tsx:26-30` |
| Keyboard mode is permanently NONE; no `Gtk.Entry`/PIN prompt | `BluetoothPopup.tsx:20-30` |
| The body is shared with the settings subview (`owner="subview"`) | `settings-panel/views/BluetoothView.tsx:10-20` |

## Two problems to fix

1. **The surface is a 312 px drawer, not a control-centre popover.** The width
   is `312` (`BluetoothPopup.tsx:22`) and the body stacks an adapter details
   block, a divider, an uppercase `Paired` section label (`style.css:732-739`),
   a chevron row and a footer inside one scroller. There is no live header
   subtitle and no persistent footer.
2. **Connected devices are not structurally distinguished.** Connected rows sit
   in the same `Paired` list with a `.sel` fill
   (`BluetoothContent.tsx:190-194`), so a headset and a keyboard connected at the
   same time are two tinted rows, not the panel's centrepiece. The design makes
   `Connected` its own stacked-card section and keeps `Paired` flat.

The footer also ends in a decorative `›` (`style.css:791-794`); the redesign
replaces it with an external-link cue and a whole-row target.

## Requirement

Replace the drawer with a **352 px anchored popover** 8 px under the bar's
Bluetooth icon, with the desktop and an editor window visible behind it. It is
one glass surface: 18 px radius, 1 px hairline, one soft shadow, no accent frame
and no nested glass cards. The bar's Bluetooth icon is highlighted while the
popover is open.

Header and footer are persistent. Only the device sections scroll; the adapter
line and footer stay pinned so the footer never leaves the viewport.

### 1. Header (persistent)

Bluetooth glyph, title `Bluetooth`, a live subtitle, and the power switch on the
right. No gear.

- `Connected to <name>` when exactly one device is connected.
- `2 devices connected` when several are (the count is live).
- `Scanning…` while discovering with no connected device.
- `On` when powered and idle.
- `Bluetooth off` when off.
- `No adapter` when `bluetoothReady` is false.
- The switch keeps the current `WifiSwitch` behaviour and is disabled when no
  adapter exists.

### 2. Connected section

BlueZ can connect several devices at once, so there is **no single hero**. Render
one connected card per connected device, stacked; a connected device never also
appears in `Paired`.

- Signal glyph, device name (ellipsized with a title tooltip), green `Connected`
  badge.
- Meta: battery `85%` when connected (current rule); the exact dBm is in the
  glyph tooltip; no glyph and no invented reading when unseen.
- Actions: `Disconnect` primary and a quiet `Unpair` that opens the inline
  confirm. Card click and the primary action are the same intent.
- The card is the visual centrepiece: a faint accent wash/hairline, distinct
  from the flat paired rows. Multiple cards stack.
- Confirm: `Remove <name> from paired devices?` + `Keep` / `Unpair device`
  (danger). Card height stays stable, the meta slot is retained and nothing
  reflows.
- Busy: spinner + `Disconnecting…` / `Unpairing…` + `Can take up to 30 s`;
  actions are unavailable.
- The section hides when empty. Label `Connected` (sentence case).

### 3. Paired section

Paired but not connected devices. Flat rows in the Wi-Fi family; hidden when
empty; label `Paired`.

- Signal glyph, name, sub-line `Paired` or `Not in range`; `Connect` and a quiet
  `Unpair`; row click connects.
- Out of range dims the row, shows `Not in range`, disables Connect (a real
  refusal) and keeps Unpair available.
- Inline confirm and busy states mirror the connected card. The confirm does not
  reflow the row; busy may add the watchdog note.
- No battery on a paired-but-idle device: the BlueZ reading is stale.

### 4. Nearby — the only disclosure

`Nearby (n)` header with a disclosure chevron, live count and scanning spinner.
It is the surface's only expander; no other section collapses.

- Preserve the current tri-state: auto-open when the first nearby device
  appears unless the user has collapsed it. The count stays visible collapsed;
  the scanning spinner stays in the header collapsed.
- No separate `Scan` button: discovery is continuous and starts on open. Do not
  invent a restart.
- Expanded + no nearby rows + scanning: a centred `Scanning…` placeholder in the
  rows' place (and no duplicate header cue).
- Expanded + no rows + idle: `No devices found` +
  `Make sure the device is in pairing mode.`
- Nearby rows: `Pair`, `Ready to pair`, signal glyph, name; busy `Pairing…` +
  `Can take up to 30 s`.
- `aria-expanded` / `aria-controls`; the header or chevron toggles it; no other
  chevron exists in the surface.

### 5. Adapter line + footer (pinned outside the scroll)

- The adapter address moves from the top details block to a quiet muted line
  above the footer: `Adapter XX:XX:XX:XX:XX:XX`, or `Adapter —` when unknown.
  It is shown only while powered; there is no divider and no copy action. It
  stays discoverable.
- `Bluetooth Settings` row: whole row is the target, `opens Blueman`, small
  external-link cue, no decorative chevron. It opens `blueman-manager` in the
  real app and shows a toast in the mock.
- The footer stays reachable in off/no-adapter states; the adapter line hides
  when off or no adapter.
- Header and footer are persistent; only the device sections scroll; the panel
  max height fits 1280×800 and 1600×1000 without the footer leaving the viewport.

### 6. Off / no adapter

- Off: header `Bluetooth off`; a centred muted Bluetooth glyph,
  `Bluetooth is off`, `Turn it on to pair a mouse, keyboard, or headset.`; the
  header switch; footer. No device sections and no adapter line.
- No adapter: header `No adapter`; switch disabled;
  `No Bluetooth adapter found on this system.`; footer. Do not present this as
  merely "off".

## States

| State | What the surface says |
| --- | --- |
| Connected | One or more connected cards; `Connected to <name>` or `n devices connected`; paired list below. |
| Multi-connected | Two stacked connected cards (headset + keyboard); no duplicate in `Paired`. |
| Paired, in range | Flat row, `Paired`, Connect enabled. |
| Paired, out of range | Dimmed row, `Not in range`, Connect disabled, Unpair available. |
| Pairing / connecting / disconnecting / unpairing | Spinner + `…ing…` + `Can take up to 30 s`; all other actions unavailable. |
| Unpair confirm | `Remove <name> from paired devices?` + `Keep` / `Unpair device`; no reflow. |
| Nearby auto-expanded | Count `(n)`, rows, scanning cue in the header. |
| Nearby collapsed | Count and scanning cue remain; rows hidden. |
| Scanning, expanded and empty | Centred `Scanning…` placeholder; no duplicate header cue. |
| Idle, expanded and empty | `No devices found` + `Make sure the device is in pairing mode.` |
| Off | `Bluetooth off` + centred off copy; no devices or adapter line. |
| No adapter | `No adapter`, switch disabled, explicit no-radio copy. |
| Action failure | A notification card/toast, never an in-panel row. |
| Long name | Ellipsized with a title tooltip. |
| Unknown adapter address | `Adapter —`. |

## Interaction

- **Switch.** Toggling off clears any busy/confirm state, hides the sections and
  adapter line, and shows the off block. Toggling on resumes discovery. With no
  adapter the switch is disabled. The mock changes only local state.
- **Cards and rows.** Card click and `Disconnect` are the same intent; row click
  and `Connect` are the same intent; nearby row click and `Pair` are the same
  intent. An out-of-range row refuses the primary action. Busy rows/actions are
  not clickable twice.
- **Single-flight.** While any action is in flight, every other card/row action
  is disabled. The mock resolves a user-triggered action after a short delay and
  applies the result (connect, disconnect, pair→connected, unpair→remove). A
  deep-linked busy state is held for review and does not auto-resolve.
- **Unpair.** `Unpair` opens one inline confirm at a time. `Keep` dismisses it;
  `Unpair device` starts the unpair. Clicking the row/card background while a
  confirm is open dismisses it rather than acting.
- **Nearby.** The header (or its chevron) toggles the body. A user toggle wins
  over auto-open from then on. Discovery is continuous while powered.
- **Footer.** The whole row is clickable and shows a toast in the mock; the real
  app keeps the `blueman-manager` handoff.
- **Keyboard.** Mode stays `NONE`; the mock declares `data-keyboard="none"` and
  contains no `<input>`, no PIN/passkey prompt and no `ON_DEMAND`. Blueman is the
  only way to complete a passkey pairing.
- **Dismissal.** Esc closes the panel; an outside click closes it; the bar icon
  toggles it.

## Acceptance

Design deliverable:

- [x] `mock.html` is one self-contained file with no external URLs, `<img>`,
      `url(...)` assets or build step.
- [x] The popover is 352 px wide, anchored 8 px under the bar's Bluetooth icon,
      over a visible desktop/editor, with one glass layer, 18 px radius, 1 px
      hairline and one soft shadow. No accent frame, no nested glass cards.
- [x] The bar's Bluetooth icon is highlighted while open.
- [x] The header carries the glyph, `Bluetooth`, a live subtitle and the power
      switch; the switch is disabled with no adapter; there is no gear.
- [x] The subtitle covers `Connected to <name>`, `2 devices connected`,
      `Scanning…`, `On`, `Bluetooth off` and `No adapter`.
- [x] Connected devices render as one stacked card per device, with signal,
      name + tooltip, `Connected` badge, connected-only battery, dBm tooltip,
      primary `Disconnect` and quiet `Unpair`; the section hides when empty.
- [x] Multiple connected cards stack and a connected device does not also appear
      in `Paired`.
- [x] The inline confirm shows `Remove <name> from paired devices?` +
      `Keep` / `Unpair device`, retains the meta slot and does not change the
      card/row height.
- [x] Busy states show the spinner, `…ing…` and `Can take up to 30 s`; every
      other action is unavailable.
- [x] `Paired` is a flat row list with `Paired` / `Not in range`; out-of-range
      rows dim, refuse Connect and keep Unpair; no battery on idle devices.
- [x] `Nearby (n)` is the only disclosure: chevron, live count, scanning cue,
      `aria-expanded` / `aria-controls`, collapsed count preserved, auto-open
      tri-state, scanning placeholder, idle empty copy and `Pair` rows.
- [x] There is no separate `Scan` button and no other chevron.
- [x] The adapter line is a quiet pinned `Adapter …` / `Adapter —` above the
      footer, visible only while powered, with no divider or copy action.
- [x] The `Bluetooth Settings` footer row is a whole-row target with
      `opens Blueman` and an external-link cue, no decorative chevron; it toasts
      in the mock.
- [x] Off and no-adapter states are distinct and both keep the footer reachable;
      the off state hides devices and the adapter line.
- [x] Header/footer persistent; only device sections scroll; no footer or panel
      viewport escape at 1600×1000 and 1280×800.
- [x] No uppercase micro-labels; sentence case throughout; no `<input>`; the
      panel declares `data-keyboard="none"`.
- [x] Deep links cover every review state listed below.
- [x] The DOM harness passes 516/516 checks at both sizes.
- [x] No bar source was changed and no app→app import was added.

Implementation acceptance is tracked below; the design deliverable above is
frozen.

## Implementation acceptance (follow-up)

- [ ] The Bluetooth drawer is replaced by the 352 px anchored popover: persistent
      header, `Connected` cards, flat `Paired` rows, `Nearby (n)` disclosure,
      pinned adapter line and `Bluetooth Settings` footer.
- [ ] The popover body is split from the settings body without regressing
      `settings-panel/views/BluetoothView.tsx` (see the sharing note below).
- [ ] Multiple connected devices render as stacked cards; no connected device is
      duplicated in `Paired`; connected-only battery and the dBm tooltip are
      preserved.
- [ ] Out-of-range refusal, inline confirm with no reflow, single-flight busy
      state and the 30 s note are preserved.
- [ ] `Nearby` keeps the tri-state auto-open and collapsed count/spinner; the
      scanning placeholder and idle empty copy match the mock.
- [ ] Discovery stays visibility-tied; failures stay notifications; audio
      routing stays silent and no audio-route row is added.
- [ ] Keyboard mode stays NONE; no PIN/passkey prompt is added.
- [ ] `make test` / `make typecheck` / `make gates` pass; composition pin bumped
      if the bar tag changes.

## Mock path

`tickets/REQ-009-bluetooth-panel-design/mock.html` (no external URLs, no
`<img>`, no `url(...)` asset references).

Open it directly:

```sh
google-chrome-stable --new-window \
  "file:///home/inumaki/Development/dotfiles/ags-bar/.worktrees/REQ-009/tickets/REQ-009-bluetooth-panel-design/mock.html"
```

The DOM harness is the sibling `harness.mjs`; run
`node tickets/REQ-009-bluetooth-panel-design/harness.mjs` from this worktree.

## Deep links

| Query | State |
| --- | --- |
| `?state=connected` | Default: connected headset (85%), paired in-range keyboard, paired out-of-range mouse, two nearby; Nearby auto-expanded. |
| `?state=multi&multi=1` | Two connected cards (headset + keyboard), `2 devices connected`. |
| `?nearby=0` | Collapsed `Nearby`; count `(2)` and scanning cue remain. |
| `?nearby=1` | Expanded `Nearby`. |
| `?state=scanning` | No rows; centred `Scanning…` placeholder. |
| `?state=empty` | Idle; `No devices found` + pairing-mode copy. |
| `?state=off` | `Bluetooth off`; off block; no devices or adapter line. |
| `?state=noadapter` | `No adapter`; switch disabled; explicit no-radio copy. |
| `?state=busy&action=pair&device=speaker` | Held `Pairing…` row + 30 s note. |
| `?state=busy&action=connect&device=keyboard` | Held `Connecting…` row. |
| `?state=busy&action=disconnect&device=headset` | Held `Disconnecting…` card. |
| `?state=busy&action=unpair&device=headset` | Held `Unpairing…` card. |
| `?state=confirm&device=headset` | Card confirm, `Keep` / `Unpair device`. |
| `?state=confirm&device=keyboard` | Paired-row confirm, no reflow. |
| `?outofrange=1` | Both paired rows dimmed, `Not in range`, Connect refused. |
| `?long=1` | Long names, ellipsis + tooltip. |
| `?unknown=1` | Adapter address `—`. |
| `?adapter=AA:BB:CC:DD:EE:FF` | Adapter address override. |
| `?panel=closed` | Review helper: start with the popover closed; the bar icon reopens it. |

## Sharing `BluetoothContent` with the settings subview

`BluetoothContent` is mounted twice today: the popover
(`BluetoothPopup.tsx:59`) and the settings subview
(`settings-panel/views/BluetoothView.tsx:13-18`). The settings subview must not
regress. Implementation may either:

1. keep one body and add a `variant: "popover" | "settings"` prop that selects
   the card/list chrome while sharing the state, row logic and service calls; or
2. extract the device sections into a shared body and let each surface own its
   header, adapter line and footer.

Either way the service accessors, the single confirm slot, the reachability tick,
the single-flight guard and the `owner` split for discovery stay shared. The
settings subview keeps its existing header and scroll container; the 352 px
width, pinned adapter line and footer belong to the popover variant only.

## Source of truth and drift rule

- Normative mock: `mock.html`; sha256
  `0df4939a4c02b1df38f8f966d0539b9569ad27c17aa1c55532fb8807d3d57eed`
  (recorded in `mock.sha256`).
- This ticket is the **criteria** source of truth; the mock is the **look and
  interaction** source of truth.
- Any change to `mock.html` must update this ticket and `mock.sha256` in the same
  commit. Any criteria change must update the mock in the same commit. If they
  disagree, fix one before merging.
- The app-local ticket + mock are canonical; there is no separate
  composition-level Bluetooth contract.

## Assumptions and deviations

1. **Design only.** No bar source, service or CSS was changed; the worktree
   contains only the ticket, mock, index and README entry.
2. **Nearby auto-open is preserved, unlike Wi-Fi's collapsed default.** The
   current Bluetooth section auto-opens when discovery finds a device
   (`BluetoothContent.tsx:561-575`), and that is deliberate: discovery starts the
   moment the surface opens, so a collapsed-only section would show an empty
   popover and then silently populate a section the user never opened. The
   approved Wi-Fi `Nearby` starts collapsed because its `Known` list is always
   populated. Bluetooth has no such always-visible list in the empty case, so the
   panel uses the current auto-open tri-state. **Approved 2026-11-09:** auto-open
   remains the default; the mock supports both: `?nearby=0` forces collapsed,
   `?nearby=1` expands.
3. **Keyboard mode is NONE.** The agent is `NoInputNoOutput`
   (`BluetoothPopup.tsx:26-30`), so there is no PIN/passkey field and no
   `ON_DEMAND`. Blueman completes passkey pairing. The mock has no `<input>` and
   declares `data-keyboard="none"`.
4. **Battery only while connected.** A paired-but-idle `Battery1` reading is
   stale (`BluetoothContent.tsx:318-323`); the mock deliberately hides `51%` on
   the idle mouse. The connected card shows `85%` / `64%` only while connected.
5. **Signal unseen = no glyph.** `rssi >= 0` means BlueZ has not seen the device,
   so the mock draws no glyph and no dBm tooltip; the word layer (`Not in range`,
   `Ready to pair`, `Connected`) carries the state (`BluetoothContent.tsx:119-154`).
6. **Failures are notifications.** There is deliberately no failure row in the
   mock or the design. The real service posts a notification card
   (`bluetooth-service.ts:113-120, 722-761`); the mock's only toast is the footer
   handoff.
7. **Audio routing stays silent.** Connecting a headset routes PipeWire audio in
   the service, but the panel shows no audio-route row
   (`BluetoothContent.tsx:589-616`). The mock does not add one.
8. **Single-flight is shown as disabled, not removed.** The real busy state hides
   other rows' Unpair; the mock disables every other action to keep the row
   geometry stable while still refusing the intent. Both express the same
   BlueZ single-flight rule.
9. **The adapter line is metadata, not a control.** It is pinned above the footer
   and hides off/no-adapter; there is no divider or copy action. It remains
   discoverable without occupying the top of the panel.
10. **Panel width is an app literal.** 352 px is not a layout token; it becomes
    skin-remappable only if the appearance plane adds a
    `layout.ags.bluetooth-panel-width` token.
11. **"Bluetooth Settings" casing** is the existing product label, not an
    uppercase micro-label; the section labels are sentence-case `Connected`,
    `Paired` and `Nearby`.
12. **No failure deep link.** The brief does not ask for a failure state and the
    design forbids an in-panel failure row. If a reviewer wants the notification
    path, it belongs on the notification surface, not in this popover.

## Evidence

- `main` clean at `f6e82f3`; worktree `.worktrees/REQ-009/`, branch
  `ticket/REQ-009-bluetooth-panel-design`.
- `node --check` on the extracted mock script: exit 0.
- Static scan: no `http(s)://`, `<img>`, `url(...)`, `<input>` or
  `text-transform`; no duplicate ids.
- Chrome headless DOM harness: **516/516 checks passed** at 1600×1000 and
  1280×800. It covers width/anchoring, chrome, no external assets, no `<input>`,
  `data-keyboard="none"`, one chevron, no uppercase labels, `aria-expanded` /
  `aria-controls` / count, connected/multi/paired rows, battery-only-connected,
  dBm tooltip, out-of-range refusal, confirm no-reflow for card and row,
  single-flight busy states, Nearby collapsed/expanded/scanning/empty, off/no
  adapter, footer reachability, viewport fit, every deep link, and the toggle /
  switch / confirm / busy→result / footer-toast interactions.
- Harness source: `tickets/REQ-009-bluetooth-panel-design/harness.mjs`; rerun
  with `node tickets/REQ-009-bluetooth-panel-design/harness.mjs` (it launches
  Chrome headless and reads the sibling `mock.html`).
- Chrome 154.0.8037.92 headless screenshots:
  - `/tmp/opencode/req009-connected-1600.png`
  - `/tmp/opencode/req009-nearby-collapsed-1600.png`
  - `/tmp/opencode/req009-scanning-1600.png`
  - `/tmp/opencode/req009-empty-1600.png`
  - `/tmp/opencode/req009-off-1600.png`
  - `/tmp/opencode/req009-noadapter-1600.png`
  - `/tmp/opencode/req009-busy-pair-1600.png`
  - `/tmp/opencode/req009-confirm-1600.png`
  - `/tmp/opencode/req009-multi-1600.png`
  - `/tmp/opencode/req009-connected-1280.png`
- `git diff --stat` against `main` shows only the ticket, mock, index and README.

## Follow-up (implementation)

- **Surface.** Change `bluetoothSurface.width` from 312 to 352
  (`BluetoothPopup.tsx:22`); keep the existing `PopupHost` anchor and
  `keyboard: none`.
- **Header.** Add the live subtitle beside the existing title and `WifiSwitch`;
  keep `sensitive={bluetoothReady}` and the no-adapter copy.
- **Body split.** Extract the connected/paired/nearby sections so the popover and
  the settings subview share state and row logic but not chrome (see above).
- **Connected section.** Partition `bluetoothDevices()` into
  `connected`, `paired && !connected` and `!paired`; render cards for the first,
  flat rows for the second, and no duplicate.
- **Confirm/busy.** Keep the single `confirmingAddress` slot, the busy accessor,
  the `Can take up to 30 s` note and the refusal on out-of-range Connect.
- **Nearby.** Keep the tri-state `manuallyToggled` and the one-indicator
  header/placeholder rule; rename `Available Devices` to `Nearby (n)`.
- **Adapter/footer.** Move the address to the pinned line above the footer;
  replace the `›` with the external-link cue; keep `execAsync(["blueman-manager"])`.
- **CSS.** Add the 352 px popover chrome, card wash, pinned adapter line and
  sentence-case labels; remove the uppercase `Paired` transform from this
  surface's section label.
- **Tests.** Add render cases for multi-connected stacking, out-of-range refusal,
  confirm no-reflow, single-flight disabling, Nearby auto/collapsed/scanning, the
  adapter line visibility and the off/no-adapter copy.
- `make test` / `make typecheck` / `make gates`; bump the composition pin if the
  bar tag changes.
