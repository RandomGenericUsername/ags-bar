import { Gtk } from "ags/gtk4"
import { createComputed } from "ags"
import { WifiSwitch } from "../primitives/WifiSwitch"
import { IntervalMsControl } from "./WifiContent"
import {
  getConfig,
  lastError,
  runSpeedTest,
  running as speedTestRunning,
  setConfigValue,
} from "../../services/speedtest-service"
import {
  setSettingsOpenState,
} from "./wifi-panel-state"

/**
 * The sibling speed-test settings surface (REQ-007 §5).
 *
 * This is deliberately NOT a nested card in the Wi-Fi list: the gear opens a
 * Gtk.Popover parented to the gear, painted as its own `surface.panel` box.
 * It reuses the shipped control (`IntervalMsControl`, `STC_CHIPS`,
 * `setConfigValue`) and the shared speed-test state, so `wifi-speedtest.json`
 * stays the one source and `Run now` is the same run as the hero action.
 */

function setLabel(widget: Gtk.Widget, label: string): void {
  const accessible = widget as Gtk.Widget & {
    update_property?: (properties: Gtk.AccessibleProperty[], values: unknown[]) => void
  }
  accessible.update_property?.([Gtk.AccessibleProperty.LABEL], [label])
}

function SettingsContent() {
  const runOnConnect = createComputed(() => getConfig().run_on_connect)
  const notifyOnTest = createComputed(() => getConfig().notify_on_test)

  return (
    <box class="wifi-settings-surface" orientation={1} spacing={0}>
      <label class="wifi-settings-head" xalign={0} label="Speed test" />
      <label
        class="wifi-settings-sub"
        xalign={0}
        wrap
        maxWidthChars={34}
        label="Shared by the Wi-Fi panel and automatic runs."
      />

      <box class="wifi-settings-section" orientation={1} spacing={0}>
        <label class="wifi-settings-label" xalign={0} label="Interval" />
        <IntervalMsControl />
      </box>

      <box class="wifi-settings-row" spacing={10}>
        <label class="wifi-settings-name" xalign={0} hexpand label="Auto-run on connect" />
        <WifiSwitch
          active={runOnConnect}
          onToggled={(value) => setConfigValue({ run_on_connect: value })}
        />
      </box>

      <box class="wifi-settings-row" spacing={10}>
        <box orientation={1} spacing={1} hexpand>
          <label class="wifi-settings-name" xalign={0} label="Notify on each test" />
          <label
            class="wifi-settings-help"
            xalign={0}
            wrap
            maxWidthChars={26}
            label="A card per run, in the notification stack."
          />
        </box>
        <WifiSwitch
          active={notifyOnTest}
          onToggled={(value) => setConfigValue({ notify_on_test: value })}
        />
      </box>

      <button
        class={createComputed(() => speedTestRunning() ? "wifi-run-now running" : "wifi-run-now")}
        sensitive={createComputed(() => !speedTestRunning())}
        onClicked={() => {
          if (!speedTestRunning()) void runSpeedTest("manual")
        }}
        $={(self: Gtk.Button) => setLabel(self, "Run speed test now")}
      >
        <box spacing={6} halign={Gtk.Align.CENTER}>
          <Gtk.Spinner class="wifi-spinner" spinning={speedTestRunning} visible={speedTestRunning} />
          <label label={createComputed(() => speedTestRunning() ? "Testing…" : "Run now")} />
        </box>
      </button>

      <label
        class="wifi-test-error"
        xalign={0}
        wrap
        maxWidthChars={32}
        label={createComputed(() => lastError() ?? "")}
        visible={createComputed(() => lastError() !== null)}
      />

      <label
        class="wifi-settings-foot"
        xalign={0}
        wrap
        maxWidthChars={34}
        label="Uses the existing wifi-speedtest.json. Changes save immediately."
      />
    </box>
  )
}

/**
 * Build and pop the settings surface under its gear. One popover per open; the
 * caller registers `closed` so the keyboard condition and Escape staging see
 * the change.
 */
export function openWifiSettingsPopover(
  anchor: Gtk.Widget,
  onClosed: () => void,
): Gtk.Popover {
  const popover = new Gtk.Popover({ autohide: true })
  popover.set_has_arrow(false)
  popover.add_css_class("wifi-settings-popover")
  popover.set_parent(anchor)
  popover.set_child((<SettingsContent />) as unknown as Gtk.Widget)
  popover.connect("closed", () => {
    setSettingsOpenState(false)
    onClosed()
    popover.unparent()
  })
  setSettingsOpenState(true)
  popover.popup()
  return popover
}
