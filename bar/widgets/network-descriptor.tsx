import type { BarWidgetSpec } from "../../kit/widget"
import { iconByStateKey } from "ags-platform/adapters/icon"
import { overlays } from "../../kit/overlay"
import { launchScopedApp } from "../../lib/scopedLauncher"
import { isRunning as speedTestRunning } from "../../services/speedtest-service"
import { createNetworkReadModel } from "../../domains/network/astal"
import { wifiPopupVisible } from "../../components/wifi/state"
import {
  networkIconState,
  networkLabel,
  type NetworkReading,
} from "../../lib/network-icon"

/**
 * The status-bar network indicator, reproduced as a widget DESCRIPTOR — the
 * stateful case the launchers did not cover.
 *
 * Compare with `network.tsx` (kept beside it in the bar, unchanged): that file
 * owns the Astal binding, the state→variant table, the label rule, the pointer
 * tracking, the gestures and the close-settings-first exclusion. Here the read
 * model is the `domains/network` adapter, the mapping is the pure
 * `lib/network-icon.ts`, and the behaviour is three fields. The overlay is
 * opened through the coordinator (`overlays.toggle("wifi", anchorX)`), which
 * closes the other overlays for us.
 */

/** The reading plus the one piece of speed-test state the widget styles on. */
export interface NetworkWidgetState extends NetworkReading {
  /** True while the Wi-Fi speed test runs — drives the `speedtesting` class. */
  speedTesting: boolean
  /** True while the REQ-007 popover is open — keeps the bar glyph highlighted. */
  wifiOpen: boolean
}

const networkReading = createNetworkReadModel()

function read(): NetworkWidgetState {
  // Reading the adapter registers its reactive dependency inside the kit's
  // `createComputed`, so the icon re-resolves on every device property change.
  return {
    ...networkReading(),
    speedTesting: speedTestRunning(),
    wifiOpen: wifiPopupVisible(),
  }
}

export const networkWidget: BarWidgetSpec<NetworkWidgetState> = {
  id: "network",
  read,
  class: "network-widget",
  stateClass: (state) => {
    const classes = [
      state.speedTesting ? "speedtesting" : "",
      state.wifiOpen ? "wifi-open" : "",
    ].filter(Boolean)
    return classes.length > 0 ? classes.join(" ") : null
  },
  icon: iconByStateKey("network", networkIconState),
  label: networkLabel,
  primary: (_state, anchorX) => overlays.toggle("wifi", anchorX),
  secondary: () => {
    void launchScopedApp("wifi-tui")
  },
}
