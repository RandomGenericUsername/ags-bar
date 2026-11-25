import { Accessor, For, createComputed, createEffect, createState } from "ags"
import { Gtk } from "ags/gtk4"
import Pango from "gi://Pango?version=1.0"
import { registry } from "ags-platform/adapters/icon-registry"
import {
  bluetoothBusy,
  bluetoothDevices,
  bluetoothDiscovering,
  bluetoothPowered,
  connectDevice,
  disconnectDevice,
  pairDevice,
  unpairDevice,
  type BluetoothAction,
  type BluetoothDevice,
} from "../../services/bluetooth-service"
import {
  actionWord,
  batteryVariant,
  batteryVisible,
  confirmQuestion,
  displayName,
  isInRange,
  nearbyExpanded,
  nearbyIndicators,
  partitionDevices,
  signalVariant,
} from "./panel-model"
import {
  closeUnpairConfirm,
  confirmingAddress,
  openUnpairConfirm,
} from "./confirm-state"

/**
 * The shared device sections for the REQ-009 Bluetooth popover and the
 * settings subview.
 *
 * This module owns ROW/SECTION logic only: the partition, the busy/confirm
 * rules, the single-flight guards and the one Nearby disclosure. Chrome — the
 * popover header, the pinned adapter line and the footers — belongs to each
 * surface. Both surfaces render these sections so a connected device cannot be
 * grouped differently in one of them.
 */

function accessibleLabel(widget: Gtk.Widget, label: string): void {
  const accessible = widget as Gtk.Widget & {
    update_property?: (properties: Gtk.AccessibleProperty[], values: unknown[]) => void
  }
  accessible.update_property?.([Gtk.AccessibleProperty.LABEL], [label])
}

function accessibleExpanded(widget: Gtk.Widget, expanded: boolean): void {
  const accessible = widget as Gtk.Widget & {
    update_state?: (states: Gtk.AccessibleState[], values: unknown[]) => void
  }
  accessible.update_state?.([Gtk.AccessibleState.EXPANDED], [expanded])
}

function accessibleControls(widget: Gtk.Widget, controlled: Gtk.Widget): void {
  const accessible = widget as Gtk.Widget & {
    update_relation?: (relations: Gtk.AccessibleRelation[], values: unknown[]) => void
  }
  accessible.update_relation?.([Gtk.AccessibleRelation.CONTROLS], [controlled])
}

function Glyph({
  name,
  pixelSize,
  cls,
}: {
  name: string
  pixelSize: number
  cls?: string
}) {
  const src = registry.resolve("settings-panel", name)
  return (
    <image
      class={cls ?? ""}
      pixel_size={pixelSize}
      $={(self: Gtk.Image) => {
        if (src !== null) self.set_from_file(src)
      }}
    />
  )
}

/**
 * Leading signal glyph at the Wi-Fi row's 30 px slot, using the existing
 * `settings-panel` `bluetooth-signal-*` family — never a parallel ladder.
 *
 * NOTHING is rendered when `rssi >= 0`: BlueZ reports 0 for "not seen", so
 * there is no honest level to draw. No glyph also means no tooltip, which is
 * why the row's WORD subtitle is load-bearing. The exact dBm lives here and
 * only here.
 */
export function BluetoothSignalIcon({ rssi }: { rssi: Accessor<number> }) {
  const seen = createComputed(() => rssi() < 0)
  const src = createComputed(() =>
    seen()
      ? registry.resolve("settings-panel", "bluetooth-signal-" + signalVariant(rssi()))
      : null,
  )
  return (
    <box class="bt-sig-slot" valign={Gtk.Align.CENTER}>
      <image
        class="bt-sig"
        pixel_size={30}
        visible={seen}
        tooltipText={createComputed(() =>
          seen() ? `Signal: −${Math.abs(rssi())} dBm` : "",
        )}
        $={(self: Gtk.Image) => {
          createEffect(() => {
            self.set_from_file(src() ?? "")
          })
        }}
      />
    </box>
  )
}

interface LiveDevice {
  readonly live: Accessor<BluetoothDevice>
  readonly name: Accessor<string>
  readonly connected: Accessor<boolean>
  readonly paired: Accessor<boolean>
  readonly rssi: Accessor<number>
  readonly battery: Accessor<number>
  readonly busy: Accessor<boolean>
  readonly anyBusy: Accessor<boolean>
  readonly confirming: Accessor<boolean>
}

function useLiveDevice(device: BluetoothDevice): LiveDevice {
  const live = createComputed(
    () =>
      bluetoothDevices().find((entry) => entry.address === device.address) ??
      device,
  )
  return {
    live,
    name: createComputed(() => displayName(live())),
    connected: createComputed(() => live().connected),
    paired: createComputed(() => live().paired),
    rssi: createComputed(() => live().rssi),
    battery: createComputed(() => live().battery),
    busy: createComputed(() => {
      const pending = bluetoothBusy()
      return pending.address === device.address && pending.action !== null
    }),
    anyBusy: createComputed(() => bluetoothBusy().address !== null),
    confirming: createComputed(
      () => confirmingAddress() === device.address,
    ),
  }
}

function busyLabel(address: string): Accessor<string> {
  return createComputed(() => {
    const pending = bluetoothBusy()
    if (pending.address !== address || pending.action === null) return ""
    return actionWord(pending.action as BluetoothAction)
  })
}

function BatteryStat({ battery }: { battery: Accessor<number> }) {
  return (
    <box class="bt-meta-stat" spacing={5}>
      <image
        class="bt-meta-icon"
        pixel_size={14}
        $={(self: Gtk.Image) => {
          createEffect(() => {
            self.set_from_file(
              registry.resolve("battery", batteryVariant(battery())) ?? "",
            )
          })
        }}
      />
      <label label={createComputed(() => `${battery()}%`)} />
    </box>
  )
}

function BusyMeta({ label }: { label: Accessor<string> }) {
  return (
    <box class="bt-busy-meta" orientation={1} spacing={1}>
      <box class="bt-busy-line" spacing={6}>
        <Gtk.Spinner class="bt-spinner" spinning={true} />
        <label label={label} />
      </box>
      <label class="bt-dev-note" xalign={0} label="Can take up to 30 s" />
    </box>
  )
}

// ---------------------------------------------------------------------------
// Connected card
// ---------------------------------------------------------------------------

function ConnectedDeviceCard({ device }: { device: BluetoothDevice }) {
  const state = useLiveDevice(device)
  const { live, name, connected, rssi, battery, busy, anyBusy, confirming } = state
  const word = busyLabel(device.address)
  const question = createComputed(() => confirmQuestion(name()))

  const cardClass = createComputed(() => {
    if (confirming()) return "bt-card is-connected is-confirming"
    if (busy()) return "bt-card is-connected is-busy"
    return "bt-card is-connected"
  })

  function act(): void {
    // A click on the confirm card's background is click-OUTSIDE for that card:
    // it dismisses rather than disconnecting mid-unpair.
    if (confirming()) {
      closeUnpairConfirm()
      return
    }
    if (busy() || anyBusy()) return
    disconnectDevice(device.address)
  }

  function openConfirm(): void {
    if (anyBusy()) return
    openUnpairConfirm(device.address)
  }

  function confirmUnpair(): void {
    if (anyBusy()) return
    closeUnpairConfirm()
    unpairDevice(device.address)
  }

  return (
    <box
      class={cardClass}
      orientation={1}
      spacing={0}
      $={(self: Gtk.Widget) => {
        const click = new Gtk.GestureClick({ button: 1 })
        click.connect("released", () => act())
        self.add_controller(click)
        createEffect(() =>
          accessibleLabel(self, `${name()}, connected`),
        )
      }}
    >
      <box class="bt-card-top" spacing={9}>
        <BluetoothSignalIcon rssi={rssi} />
        <box class="bt-dev-text" orientation={1} hexpand>
          <label
            class="bt-dev-name"
            xalign={0}
            ellipsize={Pango.EllipsizeMode.END}
            label={name}
            tooltipText={name}
          />
        </box>
        <label
          class="bt-badge"
          valign={Gtk.Align.CENTER}
          label="Connected"
          visible={connected}
        />
      </box>
      <box class="bt-card-foot" spacing={8}>
        <box class="bt-card-meta" orientation={1} spacing={2} hexpand>
          {/* Every branch stays mounted; `visible` is reactive. A JSX ternary
              here would be chosen once at construction and never swap. */}
          <box visible={busy}>
            <BusyMeta label={word} />
          </box>
          <label
            class="bt-confirm-q"
            xalign={0}
            wrap
            maxWidthChars={22}
            label={question}
            tooltipText={question}
            visible={createComputed(() => confirming() && !busy())}
          />
          <box
            visible={createComputed(
              () => batteryVisible(live()) && !busy() && !confirming(),
            )}
          >
            <BatteryStat battery={battery} />
          </box>
        </box>
        <box
          class="bt-actions"
          spacing={6}
          valign={Gtk.Align.CENTER}
          visible={createComputed(() => !busy())}
        >
          <button
            class="bt-pill"
            onClicked={() => closeUnpairConfirm()}
            canFocus={false}
            visible={confirming}
          >
            <label label="Keep" />
          </button>
          <button
            class="bt-pill danger"
            sensitive={createComputed(() => !anyBusy())}
            onClicked={confirmUnpair}
            canFocus={false}
            visible={confirming}
          >
            <label label="Unpair device" />
          </button>
          <button
            class="bt-pill accent"
            sensitive={createComputed(() => !anyBusy())}
            onClicked={act}
            canFocus={false}
            visible={createComputed(() => !confirming())}
          >
            <label label="Disconnect" />
          </button>
          <button
            class="bt-pill quiet"
            sensitive={createComputed(() => !anyBusy())}
            onClicked={openConfirm}
            canFocus={false}
            visible={createComputed(() => !confirming())}
          >
            <label label="Unpair" />
          </button>
        </box>
      </box>
    </box>
  )
}

// ---------------------------------------------------------------------------
// Paired row
// ---------------------------------------------------------------------------

function PairedDeviceRow({ device }: { device: BluetoothDevice }) {
  const state = useLiveDevice(device)
  const { live, name, rssi, busy, anyBusy, confirming } = state
  const word = busyLabel(device.address)
  const inRange = createComputed(() => isInRange(live()))
  const out = createComputed(() => !inRange())

  const rowClass = createComputed(() => {
    if (confirming()) return "bt-row is-confirming"
    if (busy()) return "bt-row is-busy"
    return out() ? "bt-row out-of-range" : "bt-row"
  })

  const caption = createComputed(() => {
    if (confirming()) return "Remove from paired devices"
    if (out()) return "Not in range"
    return "Paired"
  })

  function act(): void {
    if (confirming()) {
      closeUnpairConfirm()
      return
    }
    if (busy() || anyBusy()) return
    // `!inRange()` IS a refusal: unreachable hardware must not look actionable.
    if (!inRange()) return
    connectDevice(device.address)
  }

  function openConfirm(): void {
    if (anyBusy()) return
    openUnpairConfirm(device.address)
  }

  function confirmUnpair(): void {
    if (anyBusy()) return
    closeUnpairConfirm()
    unpairDevice(device.address)
  }

  return (
    <box
      class={rowClass}
      spacing={8}
      $={(self: Gtk.Widget) => {
        const click = new Gtk.GestureClick({ button: 1 })
        click.connect("released", () => act())
        self.add_controller(click)
        createEffect(() =>
          accessibleLabel(self, `${name()}, ${out() ? "not in range" : "paired"}`),
        )
      }}
    >
      <BluetoothSignalIcon rssi={rssi} />
      <box class="bt-dev-text" orientation={1} hexpand>
        <label
          class="bt-dev-name"
          xalign={0}
          ellipsize={Pango.EllipsizeMode.END}
          label={name}
          tooltipText={name}
        />
        <box visible={busy}>
          <box class="bt-busy-line" spacing={6}>
            <Gtk.Spinner class="bt-spinner" spinning={true} />
            <label label={word} />
          </box>
        </box>
        <label class="bt-dev-sub" xalign={0} label={caption} visible={createComputed(() => !busy())} />
        <label class="bt-dev-note" xalign={0} label="Can take up to 30 s" visible={busy} />
      </box>
      <box
        class="bt-actions"
        spacing={6}
        valign={Gtk.Align.CENTER}
        visible={createComputed(() => !busy())}
      >
        <button
          class="bt-pill"
          onClicked={() => closeUnpairConfirm()}
          canFocus={false}
          visible={confirming}
        >
          <label label="Keep" />
        </button>
        <button
          class="bt-pill danger"
          sensitive={createComputed(() => !anyBusy())}
          onClicked={confirmUnpair}
          canFocus={false}
          visible={confirming}
        >
          <label label="Unpair device" />
        </button>
        <button
          class="bt-pill"
          sensitive={createComputed(() => inRange() && !anyBusy())}
          onClicked={act}
          canFocus={false}
          visible={createComputed(() => !confirming())}
        >
          <label label="Connect" />
        </button>
        <button
          class="bt-pill quiet"
          sensitive={createComputed(() => !anyBusy())}
          onClicked={openConfirm}
          canFocus={false}
          visible={createComputed(() => !confirming())}
        >
          <label label="Unpair" />
        </button>
      </box>
    </box>
  )
}

// ---------------------------------------------------------------------------
// Nearby row
// ---------------------------------------------------------------------------

function NearbyDeviceRow({ device }: { device: BluetoothDevice }) {
  const state = useLiveDevice(device)
  const { name, rssi, busy, anyBusy } = state
  const word = busyLabel(device.address)

  function act(): void {
    if (busy() || anyBusy()) return
    pairDevice(device.address)
  }

  return (
    <box
      class={createComputed(() => (busy() ? "bt-row is-busy" : "bt-row"))}
      spacing={8}
      $={(self: Gtk.Widget) => {
        const click = new Gtk.GestureClick({ button: 1 })
        click.connect("released", () => act())
        self.add_controller(click)
        createEffect(() =>
          accessibleLabel(self, `${name()}, ready to pair`),
        )
      }}
    >
      <BluetoothSignalIcon rssi={rssi} />
      <box class="bt-dev-text" orientation={1} hexpand>
        <label
          class="bt-dev-name"
          xalign={0}
          ellipsize={Pango.EllipsizeMode.END}
          label={name}
          tooltipText={name}
        />
        <box visible={busy}>
          <box class="bt-busy-line" spacing={6}>
            <Gtk.Spinner class="bt-spinner" spinning={true} />
            <label label={word} />
          </box>
        </box>
        <label
          class="bt-dev-sub"
          xalign={0}
          label="Ready to pair"
          visible={createComputed(() => !busy())}
        />
        <label class="bt-dev-note" xalign={0} label="Can take up to 30 s" visible={busy} />
      </box>
      <box class="bt-actions" spacing={6} valign={Gtk.Align.CENTER} visible={createComputed(() => !busy())}>
        <button
          class="bt-pill"
          sensitive={createComputed(() => !anyBusy())}
          onClicked={act}
          canFocus={false}
        >
          <label label="Pair" />
        </button>
      </box>
    </box>
  )
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function usePartition() {
  const partition = createComputed(() => partitionDevices(bluetoothDevices()))
  return {
    connected: createComputed(() => partition().connected),
    paired: createComputed(() => partition().paired),
    nearby: createComputed(() => partition().nearby),
  }
}

export function ConnectedSection() {
  const { connected } = usePartition()
  return (
    <box
      class="bt-section"
      orientation={1}
      visible={createComputed(
        () => bluetoothPowered() && connected().length > 0,
      )}
    >
      <label class="bt-section-label" xalign={0} label="Connected" />
      <box class="bt-card-list" orientation={1}>
        <For each={connected} id={(device) => device.address}>
          {(device) => <ConnectedDeviceCard device={device} />}
        </For>
      </box>
    </box>
  )
}

export function PairedSection() {
  const { paired } = usePartition()
  return (
    <box
      class="bt-section"
      orientation={1}
      visible={createComputed(() => bluetoothPowered() && paired().length > 0)}
    >
      <label class="bt-section-label" xalign={0} label="Paired" />
      <box class="bt-row-list" orientation={1}>
        <For each={paired} id={(device) => device.address}>
          {(device) => <PairedDeviceRow device={device} />}
        </For>
      </box>
    </box>
  )
}

export function NearbySection() {
  const { nearby } = usePartition()
  // TRI-STATE: `null` means the user has not expressed an intent yet, so the
  // section auto-opens when discovery finds a device. A real boolean is a
  // decision and wins from then on — including "collapsed" while devices exist.
  const [manuallyToggled, setManuallyToggled] = createState<boolean | null>(null)

  const expanded = createComputed(() =>
    nearbyExpanded(manuallyToggled(), nearby().length),
  )
  const scanning = createComputed(
    () => bluetoothPowered() && bluetoothDiscovering(),
  )
  const indicators = createComputed(() =>
    nearbyIndicators({
      scanning: scanning(),
      expanded: expanded(),
      count: nearby().length,
    }),
  )
  const empty = createComputed(() => expanded() && nearby().length === 0)

  let toggle: Gtk.Button | null = null

  return (
    <box
      class="bt-section bt-nearby"
      orientation={1}
      visible={createComputed(() => bluetoothPowered())}
    >
      <box class="bt-nearby-head" spacing={4}>
        <button
          class="bt-nearby-toggle"
          hexpand
          onClicked={() => setManuallyToggled(!expanded())}
          $={(self: Gtk.Button) => {
            toggle = self
            createEffect(() => {
              accessibleExpanded(self, expanded())
              accessibleLabel(
                self,
                `${expanded() ? "Hide" : "Show"} nearby devices, ${nearby().length} found`,
              )
            })
          }}
        >
          {/* Gtk.Button takes ONE child: the chevron, label, count and cue
              live in this single horizontal box. */}
          <box spacing={7} hexpand>
            <image
              class="bt-nearby-chevron"
              pixel_size={10}
              $={(self: Gtk.Image) => {
                createEffect(() => {
                  self.set_from_icon_name(
                    expanded() ? "pan-down-symbolic" : "pan-end-symbolic",
                  )
                })
              }}
            />
            <label class="bt-nearby-label" xalign={0} label="Nearby" />
            <label
              class="bt-nearby-count"
              label={createComputed(() => `(${nearby().length})`)}
            />
            <box
              class="bt-scan-cue"
              spacing={5}
              hexpand
              halign={Gtk.Align.END}
              visible={createComputed(() => indicators().headerCue)}
            >
              <Gtk.Spinner
                class="bt-spinner"
                spinning={createComputed(() => indicators().headerCue)}
              />
              <label label="Scanning…" />
            </box>
          </box>
        </button>
      </box>

      <box
        class="bt-nearby-body"
        orientation={1}
        visible={expanded}
        $={(self: Gtk.Widget) => {
          if (toggle !== null) accessibleControls(toggle, self)
        }}
      >
        <box class="bt-row-list" orientation={1}>
          <For each={nearby} id={(device) => device.address}>
            {(device) => <NearbyDeviceRow device={device} />}
          </For>
        </box>

        <box class="bt-nearby-empty" orientation={1} visible={empty}>
          <box
            class="bt-placeholder-row"
            spacing={7}
            halign={Gtk.Align.CENTER}
            visible={createComputed(() => indicators().placeholder)}
          >
            <Gtk.Spinner
              class="bt-spinner"
              spinning={createComputed(() => indicators().placeholder)}
            />
            <label label="Scanning…" />
          </box>
          <box
            orientation={1}
            visible={createComputed(() => !scanning())}
          >
            <label class="bt-empty-title" halign={Gtk.Align.CENTER} label="No devices found" />
            <label
              class="bt-empty-copy"
              xalign={0}
              wrap
              maxWidthChars={32}
              label="Make sure the device is in pairing mode."
            />
          </box>
        </box>
      </box>
    </box>
  )
}

/** The shared body: connected cards, flat paired rows, Nearby disclosure. */
export function BluetoothDeviceSections() {
  return (
    <box class="bt-body" orientation={1}>
      <ConnectedSection />
      <PairedSection />
      <NearbySection />
    </box>
  )
}
