import { Accessor, createComputed, createEffect } from "ags"
import GLib from "gi://GLib?version=2.0"
import { Gtk } from "ags/gtk4"
import Pango from "gi://Pango?version=1.0"
import { registry } from "ags-platform/adapters/icon-registry"
import { launchScopedApp } from "../../lib/scopedLauncher"
import { WifiSwitch } from "../primitives/WifiSwitch"
import {
  bluetoothAdapterAddress,
  bluetoothDevices,
  bluetoothDiscovering,
  bluetoothPowered,
  bluetoothReady,
  setBluetoothPowered,
} from "../../services/bluetooth-service"
import {
  adapterLine,
  adapterLineVisible,
  displayName,
  headerSubtitle,
  partitionDevices,
  stateBlock,
} from "./panel-model"
import {
  BluetoothDeviceSections,
  ConnectedSection,
  PairedSection,
  NearbySection,
} from "./BluetoothSections"
import { dismissUnpairConfirm } from "./confirm-state"
import { useBluetoothView } from "./use-bluetooth-view"

/**
 * The REQ-009 Bluetooth popover body: 352 px, bar-anchored, one
 * `surface.panel` glass box.
 *
 * Header, adapter line and footer are siblings of the scrolledwindow so they
 * stay pinned; only the device sections scroll. Structure/content/layout are
 * app-owned; the skin paints `.bt-*` with role tokens. The popover is
 * bar-anchored (`PopupHost`), not the in-page `.settings-pop` pattern.
 *
 * Keyboard stays NONE: the pairing agent is NoInputNoOutput, so there is no
 * PIN/passkey field. Blueman is the only way to complete a passkey pairing.
 */

function accessibleLabel(widget: Gtk.Widget, label: string): void {
  const accessible = widget as Gtk.Widget & {
    update_property?: (properties: Gtk.AccessibleProperty[], values: unknown[]) => void
  }
  accessible.update_property?.([Gtk.AccessibleProperty.LABEL], [label])
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

/** Bare Bluetooth rune, generated with the skin's CSS colour. The status-bar
 * icon family has the right bare shape, but its SVG bakes `on_backdrop`; the
 * header needs the panel ink/primary ramp like the Wi-Fi bare mark. */
const BT_RUNE_ON = "M324 699.5L699 324.5L511.5 137V887L699 699.5L324 324.5"
const BT_RUNE_OFF =
  "M324 699.5L511.5 512M511.5 512V887L699 699.5M511.5 512L174 174.5M511.5 512L849 849.5M617.445 406.055L699 324.5L511.5 137V300.11"

function btGlyphSvg(name: string, colour: string, off: boolean): string {
  const path = off ? BT_RUNE_OFF : BT_RUNE_ON
  const svg =
    '<svg width="20" height="20" viewBox="0 0 1024 1024" fill="none" ' +
    `stroke="${colour}" stroke-width="66.6667" stroke-linecap="round" ` +
    `stroke-linejoin="round" aria-hidden="true"><path d="${path}"></path></svg>`
  const file = `${GLib.get_user_runtime_dir()}/ags-${name}.svg`
  GLib.file_set_contents(file, svg)
  return file
}

function BluetoothHeadGlyph() {
  return (
    <image
      class="bt-head-glyph-image"
      pixel_size={20}
      $={(self: Gtk.Image) => {
        const sync = () => {
          const c = self.get_style_context().get_color()
          const hex =
            "#" +
            [c.red, c.green, c.blue]
              .map((n) => Math.round(n * 255).toString(16).padStart(2, "0"))
              .join("")
          const off = !(bluetoothReady() && bluetoothPowered())
          self.set_from_file(btGlyphSvg(`bt-head-${off ? "off" : "on"}-${hex}`, hex, off))
        }
        createEffect(() => {
          bluetoothReady()
          bluetoothPowered()
          GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            sync()
            return false
          })
        })
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
          sync()
          return false
        })
      }}
    />
  )
}

function PanelHeader() {
  const subtitle = createComputed(() => {
    const connected = partitionDevices(bluetoothDevices()).connected
    return headerSubtitle({
      ready: bluetoothReady(),
      powered: bluetoothPowered(),
      connectedNames: connected.map((device) => displayName(device)),
      scanning: bluetoothDiscovering(),
    })
  })

  // Powered state uses the skin primary (same reading as the Wi-Fi header);
  // the off/no-adapter state falls back to dim ink. The rune itself is bare,
  // with no circular badge.
  const glyphClass = createComputed(() =>
    !bluetoothReady() || !bluetoothPowered()
      ? "bt-head-glyph is-off"
      : "bt-head-glyph",
  )

  return (
    <box class="bt-head" spacing={10}>
      <box class={glyphClass} valign={Gtk.Align.CENTER}>
        <BluetoothHeadGlyph />
      </box>
      <box class="bt-head-text" orientation={1} hexpand>
        <label class="bt-head-title" xalign={0} label="Bluetooth" />
        <label
          class="bt-head-sub"
          xalign={0}
          ellipsize={Pango.EllipsizeMode.END}
          label={subtitle}
          tooltipText={subtitle}
        />
      </box>
      <box class="bt-head-actions" valign={Gtk.Align.CENTER}>
        <WifiSwitch
          active={bluetoothPowered}
          sensitive={bluetoothReady}
          onToggled={(value) => {
            // Turning the radio off clears any open confirm; the service
            // remains the source of the power state.
            if (!value) dismissUnpairConfirm()
            void setBluetoothPowered(value)
          }}
        />
      </box>
    </box>
  )
}

function OffState() {
  const block = createComputed(() => stateBlock(bluetoothReady()))
  return (
    <box
      class="bt-state"
      orientation={1}
      visible={createComputed(
        () => !bluetoothReady() || !bluetoothPowered(),
      )}
    >
      <box class="bt-state-glyph" halign={Gtk.Align.CENTER}>
        <Glyph name="bluetooth-off" pixelSize={26} />
      </box>
      <label
        class="bt-state-title"
        halign={Gtk.Align.CENTER}
        justify={Gtk.Justification.CENTER}
        wrap
        maxWidthChars={30}
        label={createComputed(() => block().title)}
      />
      <label
        class="bt-state-copy"
        halign={Gtk.Align.CENTER}
        justify={Gtk.Justification.CENTER}
        wrap
        maxWidthChars={34}
        label={createComputed(() => block().copy)}
      />
    </box>
  )
}

function AdapterLine() {
  const text = createComputed(() =>
    adapterLine(bluetoothAdapterAddress()),
  )
  return (
    <label
      class="bt-adapter"
      xalign={0}
      ellipsize={Pango.EllipsizeMode.END}
      label={text}
      visible={createComputed(() =>
        adapterLineVisible(bluetoothPowered(), bluetoothReady()),
      )}
    />
  )
}

function PanelFooter() {
  return (
    <box class="bt-foot">
      <button
        class="bt-foot-row"
        onClicked={() => {
          // Long-lived GUI: scoped so an AGS restart does not SIGKILL Blueman.
          void launchScopedApp("bluetooth-manager")
        }}
        $={(self: Gtk.Button) =>
          accessibleLabel(self, "Bluetooth Settings, opens Blueman")
        }
      >
        {/* Gtk.Button takes ONE child: icon, text and external cue live in
            this single horizontal box. */}
        <box spacing={10} hexpand>
          <box class="bt-foot-icon" valign={Gtk.Align.CENTER}>
            <Glyph name="bluetooth-off" pixelSize={16} />
          </box>
          <box class="bt-foot-text" orientation={1} hexpand>
            <label class="bt-foot-title" xalign={0} label="Bluetooth Settings" />
            <label class="bt-foot-sub" xalign={0} ellipsize={Pango.EllipsizeMode.END} label="opens Blueman" />
          </box>
          <image
            class="bt-foot-cue"
            pixel_size={12}
            valign={Gtk.Align.CENTER}
            $={(self: Gtk.Image) => self.set_from_icon_name("external-link-symbolic")}
          />
        </box>
      </button>
    </box>
  )
}

export function BluetoothPanelContent({
  visible,
}: {
  visible: Accessor<boolean>
}) {
  useBluetoothView(visible, "popup")

  // Turning the radio off (from any caller) must not strand a confirm.
  createEffect(() => {
    if (bluetoothPowered()) return
    dismissUnpairConfirm()
  })

  return (
    <box
      class="bt-panel"
      orientation={1}
      $={(self: Gtk.Widget) => {
        // A layer-shell surface keeps its initial size when the scroller's
        // content shrinks (Nearby collapsed). Ask the toplevel to re-measure
        // after the section/visibility state settles, so the popover height
        // follows the content instead of leaving a blank block.
        createEffect(() => {
          bluetoothDevices()
          bluetoothPowered()
          visible()
          GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            const root = self.get_root() as Gtk.Window | null
            if (!root) return false
            const [, natH] = self.measure(
              Gtk.Orientation.VERTICAL,
              self.get_width(),
            )
            if (natH <= 0) return false
            const target = natH + 2
            root.set_default_size(-1, target)
            root.set_size_request(-1, target)
            root.queue_resize()
            return false
          })
        })
      }}
    >
      <PanelHeader />
      <scrolledwindow
        class="bt-scroll"
        vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
        hscrollbarPolicy={Gtk.PolicyType.NEVER}
        propagateNaturalHeight
        propagateNaturalWidth={false}
        maxContentHeight={560}
      >
        <box class="bt-scroll-body" orientation={1}>
          <OffState />
          <box
            class="bt-device-area"
            orientation={1}
            visible={createComputed(
              () => bluetoothPowered() && bluetoothReady(),
            )}
          >
            <ConnectedSection />
            <PairedSection />
            <NearbySection />
          </box>
        </box>
      </scrolledwindow>
      <AdapterLine />
      <PanelFooter />
    </box>
  )
}

/**
 * Exported for a future settings variant that wants the shared body without the
 * popover chrome. The settings subview keeps its own header/scroll chrome.
 */
export { BluetoothDeviceSections }
