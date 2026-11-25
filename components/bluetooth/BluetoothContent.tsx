import { Accessor, createComputed, createEffect, createState, For } from "ags"
import { Gtk } from "ags/gtk4"
import Pango from "gi://Pango?version=1.0"
import { registry } from "ags-platform/adapters/icon-registry"
import { appearance } from "../../lib/appearance"
import { launchScopedApp } from "../../lib/scopedLauncher"
import {
  bluetoothAdapterAddress,
  bluetoothBusy,
  bluetoothDevices,
  bluetoothDiscovering,
  bluetoothPowered,
  connectDevice,
  disconnectDevice,
  pairDevice,
  unpairDevice,
  type BluetoothDevice,
} from "../../services/bluetooth-service"
import { batteryVariant, signalVariant } from "./panel-model"
import {
  closeUnpairConfirm,
  confirmingAddress,
  dismissUnpairConfirm,
  openUnpairConfirm,
} from "./confirm-state"
import { useBluetoothView } from "./use-bluetooth-view"

/**
 * Bluetooth list rhythm is a TSX-owned layout token in the v2 appearance plane
 * (`layout.ags.bt-list-spacing`).
 *
 * gnim's JSX prop type accepts its own `Accessor` class, not the platform's
 * structural `ReadAccessor`, so the boxes read `.peek()` at mount. That is
 * sufficient here: the bar is restart-mode, so an appearance change restarts
 * the app rather than remounting the list. Missing/invalid tokens fall back
 * to 4.
 */
const btListSpacing = appearance.value("layout.ags.bt-list-spacing", 4)

/**
 * Bluetooth capability body (design §4, mock `mockups/panel.html`).
 *
 * State is owned by BlueZ D-Bus and exposed through the service's accessors;
 * this component only reads them and forwards user intent (`pairDevice`,
 * `connectDevice`, `disconnectDevice`, `unpairDevice`). There is no subprocess
 * and no bus call here — the ONE subprocess is the footer row's scoped
 * `blueman-manager` launch, the same single escape hatch
 * `WifiContent`'s `nm-connection-editor` row uses.
 *
 * The one timer is the reachability tick, and it exists because BlueZ emits
 * `RSSI` only when the value CHANGES — so silence is ambiguous and the panel
 * has to decide when to stop believing a reading. The tick is a timestamp
 * comparison over the local cache, never a bus call, and it refuses to run
 * unless a scan is active (see `ageOutStaleReadings`).
 */

export {
  bluetoothBusy,
  bluetoothDevices,
  bluetoothDiscovering,
  bluetoothPowered,
}
export type { BluetoothDevice }

/**
 * The single confirm slot lives in `confirm-state.ts`, shared with the REQ-009
 * popover. Re-exported here because this module's consumers historically
 * imported it from the settings body.
 */
export { dismissUnpairConfirm }

/**
 * Leading circle-badged signal glyph, at the Wi-Fi row's size: `.settings-net-signal`
 * is `min-width/min-height: 30px` and `WifiContent` draws `<image pixel_size={30}>`.
 *
 * NOTHING is rendered when `rssi >= 0` — BlueZ reports 0 for "not seen"
 * (asleep / out of range), so there is no level to draw. The variant is not
 * resolved either: `signalVariant(0)` would answer "full", which is a lie about
 * a device nobody has heard from. No glyph means no tooltip, which is precisely
 * why the row's WORD subtitle is load-bearing — see `subtitle` below.
 */
function BluetoothSignalIcon({ rssi }: { rssi: Accessor<number> }) {
  const seen = createComputed(() => rssi() < 0)
  const src = createComputed(() =>
    seen()
      ? registry.resolve("settings-panel", "bluetooth-signal-" + signalVariant(rssi()))
      : null,
  )
  return (
    <image
      class="settings-net-signal"
      pixel_size={30}
      valign={Gtk.Align.CENTER}
      visible={seen}
      // The exact reading lives HERE and only here. `""` when unseen, so an
      // out-of-range row carries no tooltip at all.
      tooltipText={createComputed(() =>
        seen() ? `Signal: −${Math.abs(rssi())} dBm` : "",
      )}
      $={(self) => {
        createEffect(() => {
          self.set_from_file(src() ?? "")
        })
      }}
    />
  )
}

export function BluetoothRow({ device: item }: { device: BluetoothDevice }) {
  // The service re-emits the list and a row widget may be reused for the same
  // address; read the live entry so status/battery stay correct.
  const live = createComputed(
    () =>
      bluetoothDevices().find((device) => device.address === item.address) ??
      item,
  )

  const name = createComputed(
    () => live().alias || live().name || "Unknown device",
  )
  const connected = createComputed(() => live().connected)
  const paired = createComputed(() => live().paired)
  const rssi = createComputed(() => live().rssi)
  const battery = createComputed(() => live().battery)

  const busy = createComputed(() => {
    const pending = bluetoothBusy()
    return pending.address === item.address && pending.action !== null
  })
  const anyBusy = createComputed(() => bluetoothBusy().address !== null)

  // BlueZ reports RSSI 0 when the device has not been seen (asleep / out of
  // range); a negative value means it is currently present. A paired device
  // that is not present is shown dimmed with Connect disabled.
  const inRange = createComputed(() => connected() || rssi() < 0)
  const absent = createComputed(() => paired() && !connected() && !inRange())

  const confirming = createComputed(() => confirmingAddress() === item.address)

  // `.sel` on the connected row is the mock's contract and matches `WifiRow`,
  // which also fills its connected row. `.confirming` wins over `.sel` because
  // an open confirm is the row's whole story right now.
  const rowClass = createComputed(() => {
    if (confirming()) return "settings-net confirming"
    if (connected()) return "settings-net sel"
    return absent() ? "settings-net out-of-range" : "settings-net"
  })

  /**
   * The row's WORD layer — `Not in range` / `Paired` / `Ready to pair`,
   * mirroring `WifiRow`'s `Saved` / `Secured` / `Open network`. No strength
   * figure ever appears here; the number moved to the glyph tooltip.
   *
   * LOAD-BEARING, not decorative: an `rssi >= 0` row has no glyph and therefore
   * no tooltip, so this word is the ONLY channel carrying the state, alongside
   * `.settings-net.out-of-range`'s opacity and the unavailable primary action.
   * Do not "simplify" this away when the subtitle looks redundant on rows that
   * do have a glyph.
   */
  const subtitle = createComputed(() => {
    if (confirming()) return "Remove from paired devices"
    if (!paired()) return "Ready to pair"
    if (!inRange()) return "Not in range"
    return "Paired"
  })

  const actionLabel = createComputed(() =>
    connected() ? "Disconnect" : paired() ? "Connect" : "Pair",
  )
  // `<Action>ing…` — Pairing… / Connecting… / Disconnecting… / Unpairing…
  const busyLabel = createComputed(() => {
    const pending = bluetoothBusy()
    if (pending.address !== item.address || pending.action === null) return ""
    const action = pending.action
    return `${action.charAt(0).toUpperCase()}${action.slice(1)}ing…`
  })
  // BlueZ is single-flight (`runAction` returns early while any address is
  // busy), so every other row's primary action goes unavailable too.
  const primaryAvailable = createComputed(() => inRange() && !anyBusy())

  function act() {
    // Clicking a confirming row's background is click-OUTSIDE for that row: it
    // dismisses rather than, say, disconnecting a device mid-unpair.
    if (confirming()) {
      closeUnpairConfirm()
      return
    }
    // `!inRange()` IS a refusal. OWNER DECISION 2026-10-05: out of range means
    // you cannot click Connect, full stop.
    //
    // History, because this guard and the reachability rule are load-bearing on
    // each other and both have been changed repeatedly:
    // - The guard was once lifted so a press would surface BlueZ's real reason
    //   instead of silence. Rejected: unreachable hardware looked actionable.
    // - The reachability rule has been through: no clock (off devices offered
    //   Connect forever), a 20s clock (present devices read "Not in range" ~half
    //   the time — MEASURED `-55` stable 30s+ and a present device silent 59.5s),
    //   and now a 120s clock that only runs while a scan is active.
    // The two are one decision: "Not in range" is what disables this button, so
    // the window must be sized from measured reception gaps (see RSSI_STALE_MS
    // in the service), not chosen for how quickly it looks responsive.
    if (busy() || !inRange()) return
    if (connected()) disconnectDevice(item.address)
    else if (paired()) connectDevice(item.address)
    else pairDevice(item.address)
  }

  function openConfirm() {
    console.error(`BluetoothContent: openConfirm(${item.address}) busy=${anyBusy()}`)
    if (anyBusy()) return
    openUnpairConfirm(item.address)
  }

  function confirmUnpair() {
    console.error(`BluetoothContent: confirmUnpair(${item.address}) busy=${anyBusy()}`)
    if (anyBusy()) return
    closeUnpairConfirm()
    unpairDevice(item.address)
  }

  return (
    <box
      class={rowClass}
      orientation={1}
      spacing={3}
      $={(self) => {
        // The WHOLE ROW is the primary action (6.3), wired exactly like
        // `WifiRow`. The action controls are real `Gtk.Button`s, and a
        // `Gtk.Button` claims the click sequence in the gesture arena on press —
        // so this row-level gesture only ever fires for a click that MISSED
        // them. That is the "the action button claims its own click first" rule;
        // it is why the actions must be buttons and not the bare boxes
        // `WifiRow` uses for its single Connect affordance.
        const click = new Gtk.GestureClick({ button: 1 })
        click.connect("released", () => act())
        self.add_controller(click)
      }}
    >
      <box spacing={8}>
        <BluetoothSignalIcon rssi={rssi} />
        <label
          class="settings-net-name"
          xalign={0}
          label={name}
          hexpand
          maxWidthChars={26}
          ellipsize={Pango.EllipsizeMode.END}
          tooltipText={name}
        />
        <label
          class="settings-badge conn"
          label="Connected"
          valign={Gtk.Align.CENTER}
          visible={connected}
        />
      </box>
      {/* Line 2 — the row's second line. "Two-line geometry" in the no-reflow
          requirement means THIS line 1 / line 2 split, not two sub-lines inside
          the meta stack: the confirm swaps the meta stack's CONTENT in place and
          both lines stay. Below, the confirm branch keeps the battery slot
          occupied exactly as the idle branch does, so a connected row's meta
          stack is the same two sub-lines before and after and its height is
          identical — that is what makes "the row above it has not moved" true.

          Note the busy branch DOES grow the meta stack by one sub-line, and that
          is deliberate: the mock's own pairing state draws the busy row with
          `spin + Pairing…` AND `Can take up to 30 s` beside a one-line idle row.
          Only the confirm is held to zero reflow. */}
      <box class="settings-row-meta" spacing={8}>
        <box orientation={1} spacing={2} hexpand>
          {/* Slot 1: the in-flight line, else the connected-device battery. A
              paired-but-idle `Battery1` reading is stale, so battery shows only
              while connected — showing it would be a lie. Note it stays visible
              while confirming: dropping it would remove a sub-line from a
              connected row and reflow the list, which is the one thing the
              confirm must never do. */}
          <box class="settings-meta-stat" spacing={6} visible={busy}>
            <Gtk.Spinner class="settings-spinner" spinning={busy} />
            <label label={busyLabel} />
          </box>
          <box
            class="settings-meta-stat"
            spacing={6}
            visible={createComputed(() => connected() && battery() > 0 && !busy())}
          >
            <image
              class="settings-meta-icon"
              pixel_size={14}
              $={(self) => {
                createEffect(() => {
                  self.set_from_file(
                    registry.resolve("battery", batteryVariant(battery())) ??
                      "",
                  )
                })
              }}
            />
            <label label={createComputed(() => `${battery()}%`)} />
          </box>
          {/* Slot 2: the watchdog note while busy, else the word layer. The
              note is STATIC on purpose — a countdown needs a timer in the view,
              which the architecture forbids. The watchdog itself stays in
              `bluetooth-service`, bounded and self-cancelling; its failure
              surfaces as a notification card (`postBluetoothNotification`),
              never as panel text — there is deliberately no failure row. */}
          <label
            class="settings-net-sub"
            xalign={0}
            label="Can take up to 30 s"
            visible={busy}
          />
          <label
            class="settings-net-sub"
            xalign={0}
            label={subtitle}
            visible={createComputed(() => !busy())}
          />
        </box>
        <box
          spacing={8}
          valign={Gtk.Align.CENTER}
          visible={createComputed(() => !busy())}
        >
          {/* WHY ALL FOUR ARE ALWAYS MOUNTED AND ONLY `visible` TOGGLES.
              This was a structural `{cond ? <A/> : <B/>}` pair, which is the
              bug this comment exists to prevent repeating: AGS builds a STATIC
              widget tree, so a JSX ternary is evaluated once, at construction.
              Nothing subscribes to `confirming()`, so whichever branch was
              chosen when the row was built was chosen forever. MEASURED
              consequence: clicking `Unpair` called `openConfirm` (logged nine
              times) but `confirmUnpair` was NEVER reached -- the confirm
              buttons did not exist, so unpairing was impossible and nothing on
              screen or in the log said why.

              The fix is the idiom this file already uses 22 times: mount both
              branches and drive `visible` from a computed. That subscribes, so
              the swap actually happens. Kept as four explicit buttons rather
              than a computed-wrapped fragment because `visible` is reactive
              here and JSX shape is not. */}
          <button
            class="settings-rowact"
            onClicked={() => closeUnpairConfirm()}
            canFocus={false}
            valign={Gtk.Align.CENTER}
            visible={createComputed(() => confirming())}
          >
            <label label="Keep" />
          </button>
          {/* `disabled` is the visual; `sensitive` is the guard. BOTH are required and
              they must agree -- this has now been got wrong three times, so:
                64078268  class + sensitive={inRange() && !anyBusy()}   correct
                rework    class only, sensitive deleted                 wrong: a CSS
                          class does not disable a GTK button, so the button
                          stayed activatable and focusable while looking dead
                6ec8202d  sensitive narrowed to !anyBusy()              wrong: made
                          unreachable hardware look clickable. OWNER REJECTED.
              FINAL: class for looks, sensitive for truth, both driven by the
              same `primaryAvailable`. Never "simplify" one into the other.

              The load-bearing dependency, updated 2026-10-07: "Not in range"
              is now driven by a 120s reachability clock that only runs while a
              scan is active (RSSI_STALE_MS + ageOutStaleReadings in the
              service). A disabled Connect is therefore self-explanatory — the
              panel has genuinely failed to hear the device across two minutes
              of scanning. The window is sized from MEASURED reception gaps, not
              from how responsive it looks; shrinking it below the real gap
              distribution turns present hardware into a disabled button, which
              is the dead end the owner already rejected once. */}
          <button
            class={createComputed(() =>
              primaryAvailable() ? "settings-rowact" : "settings-rowact disabled",
            )}
            sensitive={primaryAvailable}
            onClicked={act}
            canFocus={false}
            valign={Gtk.Align.CENTER}
            visible={createComputed(() => !confirming())}
          >
            <label label={actionLabel} />
          </button>
          {/* The ONE new class this change introduces (design §2/§7).
              `confirmUnpair` re-checks `anyBusy()` rather than trusting the
              button's visibility: a confirm can already be open when a
              different row's action starts, and BlueZ's single-flight
              `runAction` would drop the unpair silently. Better to refuse
              loudly than to look like it worked. */}
          <button
            class="settings-rowact danger"
            onClicked={confirmUnpair}
            canFocus={false}
            valign={Gtk.Align.CENTER}
            visible={createComputed(() => confirming())}
          >
            <label label="Unpair device" />
          </button>
          {/* Hidden entirely while busy: `runAction` is single-flight, so an
              Unpair issued during another row's action would be dropped. */}
          <button
            class="settings-rowact subtle"
            onClicked={openConfirm}
            canFocus={false}
            valign={Gtk.Align.CENTER}
            visible={createComputed(() =>
              !confirming() && paired() && !anyBusy(),
            )}
          >
            <label label="Unpair" />
          </button>
        </box>
      </box>
    </box>
  )
}

/**
 * `Bluetooth Settings ›` footer row.
 *
 * Launches `blueman-manager`, NOT `bluetoothctl`: bluetoothctl is a terminal
 * TUI, which a click from a panel is the worst possible way to open. Blueman is
 * also what makes a PIN/passkey pairing completable at all — the panel's own
 * agent registers `NoInputNoOutput` and cannot answer `RequestPinCode`.
 */
function BluetoothSettingsFooter({
  visible,
}: {
  visible: Accessor<boolean>
}) {
  return (
    <box
      class="settings-wifi-settings-row"
      spacing={8}
      visible={visible}
      $={(self) => {
        const click = new Gtk.GestureClick({ button: 1 })
        click.connect("released", () => {
          // Long-lived GUI: scoped so an AGS restart does not SIGKILL it. The
          // shared launcher logs and toasts a missing blueman-manager.
          void launchScopedApp("bluetooth-manager")
        })
        self.add_controller(click)
      }}
    >
      {/* WHY maxWidthChars IS REQUIRED HERE, copied from WifiContent's
          `nm-connection-editor` row: an unwrapped Gtk.Label reports its FULL
          text width as natural width, which is what grew that surface off the
          right edge of the monitor. Ellipsize is kept ONLY on the short row
          label, where losing the tail is acceptable. */}
      <label
        class="settings-wifi-settings-label"
        hexpand
        xalign={0}
        maxWidthChars={14}
        ellipsize={Pango.EllipsizeMode.END}
        label="Bluetooth Settings"
      />
      {/* wrap, NOT ellipsize, for the same reason as the Wi-Fi row: this note is
          the actionable part of the row and truncating it destroys the only
          information it carries. Wrapping costs one extra line instead. */}
      <label
        class="settings-wifi-settings-note"
        valign={Gtk.Align.CENTER}
        xalign={1}
        wrap
        maxWidthChars={22}
        label="opens Blueman"
      />
      <label class="settings-wifi-settings-arrow" label="›" />
    </box>
  )
}

/** The embeddable body: off/scanning states + the device sections. */
export function BluetoothContent({
  visible,
  owner,
}: {
  visible: Accessor<boolean>
  owner: string
}) {
  // WHY THIS IS A TRI-STATE (`boolean | null`) AND NOT A PLAIN BOOLEAN.
// With `createState(false)` the expansion rule was
// `manuallyToggled() || nearbyDevices().length > 0`, which is
// unconditionally TRUE whenever any device is in range. MEASURED
// consequence: the chevron was inert. Clicking it set the flag to `true`
// (still expanded, no visible change) and clicking again set it to `false`
// (still expanded, because `nearbyCount > 0` won) -- so the section could
// never be collapsed and the arrow was a control that did nothing.
//
// `null` means "the user has not expressed an intent yet", so the section
// still auto-opens when devices are found. A real boolean means the user has
// decided and wins from then on. That is what an arrow is supposed to do.
const [manuallyToggled, setManuallyToggled] = createState<boolean | null>(
  null,
)

  const powered = createComputed(() => bluetoothPowered())
  const pairedDevices = createComputed(() =>
    bluetoothDevices().filter((device) => device.paired),
  )
  // "Available" is everything discovery found that is not already paired: the
  // `Ready to pair` rows.
  const nearbyDevices = createComputed(() =>
    bluetoothDevices().filter((device) => !device.paired),
  )
  const hasDevices = createComputed(() => bluetoothDevices().length > 0)
  const hasPaired = createComputed(() => pairedDevices().length > 0)

  // WHY the section AUTO-OPENS on discovery: a discovery run starts the moment
  // the surface becomes visible, so a section that only opened on a click
  // would show an empty popup and then silently populate a section the user
  // never opened. So with no manual decision recorded, it opens as soon as
  // devices are found, and closes again when they go away.
  //
  // What it does NOT do any more: refuse to collapse while devices are
  // present. That was the previous rule and it made the chevron inert -- see
  // the tri-state note above. The user can now always collapse what they are
  // looking at, which is the whole point of an arrow.
  const expanded = createComputed(() => {
    const manual = manuallyToggled()
    if (manual !== null) return manual
    return nearbyDevices().length > 0
  })

  useBluetoothView(visible, owner)

  // The one scanning indicator's two exhaustive positions, unchanged from the
  // pre-REQ-009 body: expanded-and-empty owns the centred placeholder; every
  // other scanning state puts the spinner in the section header.
  const scanning = createComputed(() => powered() && bluetoothDiscovering())
  const scanningPlaceholder = createComputed(
    () => scanning() && expanded() && nearbyDevices().length === 0,
  )
  const scanningInHeader = createComputed(
    () => scanning() && (!expanded() || nearbyDevices().length > 0),
  )

  return (
    <box
      orientation={1}
      spacing={8}
      $={(self) => {
        // Click-outside for an open confirm, at the body level. A click on a
        // row's action BUTTON is claimed by that button and cancels this
        // gesture, so clicking `Keep` dismisses through its own handler rather
        // than through here.
        const click = new Gtk.GestureClick({ button: 1 })
        click.connect("released", () => closeUnpairConfirm())
        self.add_controller(click)
      }}
    >
      <label
        class="settings-empty"
        xalign={0}
        label="Bluetooth is off"
        visible={createComputed(() => !powered())}
      />

      {/* Adapter detail row — the LOCAL CONTROLLER's own address
          (`Adapter1.Address`), never a device's. Hidden entirely while powered
          off, `—` when BlueZ has not published one.

          THERE IS DELIBERATELY NO AUDIO-OUTPUT ROW HERE. `bluetoothAudioTarget`
          exists so a failed routing attempt is recorded in state instead of
          vanishing — a device can read `Connected` while the sound stayed on
          the speakers with nothing to indicate which half of the chain failed.
          It is a record, not a readout: PipeWire routing state inside a
          Bluetooth surface mixes concerns (owner ruling), so do not
          "helpfully" add the row back. */}
      <box class="settings-conn-details" visible={powered}>
        <box class="settings-detail-row" spacing={8}>
          <label class="settings-detail" xalign={0} label="Adapter" />
          <label
            class="settings-detail"
            xalign={1}
            hexpand
            label={createComputed(() => bluetoothAdapterAddress() || "—")}
          />
        </box>
      </box>

      <box class="settings-divider" visible={powered} />

      <label
        class="settings-section-label"
        xalign={0}
        label="Paired"
        visible={createComputed(() => powered() && hasPaired())}
      />
      <box
        orientation={1}
        spacing={btListSpacing.peek()}
        visible={createComputed(() => powered() && hasPaired())}
      >
        <For
          each={pairedDevices}
          id={(device: BluetoothDevice) => device.address}
        >
          {(device: BluetoothDevice) => <BluetoothRow device={device} />}
        </For>
      </box>

      <button
        class="settings-chevron-row"
        onClicked={() => setManuallyToggled(!expanded())}
        canFocus={false}
        visible={powered}
      >
        {/* ONE child, always: a Gtk.Button takes a single child. An earlier version
            put the label and a spinner here as siblings; the label was dropped
            and the spinner was left alone in the row, which rendered as a large
            empty box. Both contents go inside one box instead.

            `hexpand` on the label pushes the spinner to the right edge, which
            is what the mock's `.chev` does with `justify-content:space-between`.

            This is the SECOND position of the one indicator: it is visible only
            while the Available Devices list is non-empty, in which case the
            centred placeholder is hidden (see `scanningPlaceholder`). */}
        <box>
          <label
            class="settings-chevron-label"
            xalign={0}
            hexpand
            label={createComputed(() =>
              expanded() ? "Available Devices ▾" : "Available Devices ▸",
            )}
          />
          <Gtk.Spinner
            class="settings-spinner"
            spinning={scanningInHeader}
            visible={scanningInHeader}
          />
        </box>
      </button>

      <box
        class="settings-other-networks"
        orientation={1}
        spacing={btListSpacing.peek()}
        visible={createComputed(() => powered() && expanded())}
      >
        <For
          each={nearbyDevices}
          id={(device: BluetoothDevice) => device.address}
        >
          {(device: BluetoothDevice) => <BluetoothRow device={device} />}
        </For>
      </box>

      {/* The Available Devices EMPTY STATE, directly under the list it belongs
          to, replacing "No devices found" (owner ruling, 2026-10-05). It is the
          list's placeholder, so it lives where the list's rows would be -- not
          up between the paired section and the section header, which is where it
          used to sit and where it read as a stray status line between two lists.

          One indicator, two positions: while the list is empty this is the only
          one showing; once the list has items, `scanningInHeader` puts the
          spinner in the section header instead and this row is hidden.

          The mock centres this row (`justify-content:center`). The OUTER box
          must be vertical for that to work: `halign` positions a child on its
          parent's CROSS axis, so in a horizontal box -- which is AGS's default
          -- it is main-axis packing and is ignored and the row sits at the start
          with its natural width. MEASURED, see
          prototypes/halign-centring-probe.js. */}
      <box orientation={1} class="settings-empty" hexpand visible={scanningPlaceholder}>
        <box spacing={7} halign={Gtk.Align.CENTER}>
          <Gtk.Spinner
            class="settings-spinner"
            spinning={scanningPlaceholder}
          />
          <label label="Scanning…" />
        </box>
      </box>

      <label
        class="settings-empty"
        xalign={0}
        label="No devices found"
        visible={createComputed(
          // Also gated on `expanded()`: this is the same slot as the scanning
          // placeholder, so it must not appear under a collapsed header either.
          () =>
            powered() &&
            expanded() &&
            !bluetoothDiscovering() &&
            !hasDevices(),
        )}
      />

      <BluetoothSettingsFooter
        visible={powered}
      />
    </box>
  )
}