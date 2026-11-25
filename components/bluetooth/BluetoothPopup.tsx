import { Gdk } from "ags/gtk4"
import {
  bluetoothIconX,
  bluetoothPopupVisible,
  closeBluetoothPopup,
} from "./state"
import { BluetoothPanelContent } from "./BluetoothPanelContent"
import { dismissUnpairConfirm } from "./confirm-state"
import { PopupCatcher, PopupHost, type PopupSurfaceSpec } from "../../kit/popup-host"

/**
 * The REQ-009 Bluetooth surface body (spine AD-10): a factory mounted by
 * `PopupHost` only while the popup is visible.
 *
 * 352 px, bar-anchored, one `surface.panel` glass box. Header, adapter line and
 * footer are siblings of the scrolledwindow so they stay pinned.
 *
 * Keymode NONE, permanently — unlike the Wi-Fi popup this surface never widens
 * it. An unconditional ON_DEMAND grabs the keyboard, the bar swallows the first
 * click, and same-spot collapse stops working. The shipped pairing agent is
 * NoInputNoOutput (Just Works), so there is no password prompt, no Gtk.Entry
 * and no PIN/passkey field. If one is ever added, add a `keyboard` accessor
 * that reads true only while that field is on screen — never unconditionally.
 */
export const bluetoothSurface: PopupSurfaceSpec = {
  id: "bluetooth",
  width: 352,
  body: ({ visible }) => <BluetoothPanelContent visible={visible} />,
}

export function BluetoothPopupCatcher(gdkmonitor: Gdk.Monitor) {
  return (
    <PopupCatcher
      name="bluetooth-popup-catcher"
      gdkmonitor={gdkmonitor}
      visible={bluetoothPopupVisible}
      onClose={() => {
        // Order is the requirement, not a style preference: an open unpair
        // confirm is dismissed BEFORE the surface closes, so the two events are
        // never conflated into one and a confirm can never outlive the popup it
        // was opened in.
        dismissUnpairConfirm()
        closeBluetoothPopup()
      }}
    />
  )
}

export function BluetoothPopup(gdkmonitor: Gdk.Monitor) {
  return (
    <PopupHost
      spec={bluetoothSurface}
      name="bluetooth-popup"
      windowClass="bluetooth-popup"
      surfaceClass="bt-surface"
      gdkmonitor={gdkmonitor}
      visible={bluetoothPopupVisible}
      anchorX={bluetoothIconX}
      /* The REQ-009 anchor gap: the bar is 48 px tall, +8 px under the icon. */
      marginTop={56}
      onClose={() => {
        // Same before-the-surface ordering as the catcher.
        dismissUnpairConfirm()
        closeBluetoothPopup()
      }}
    />
  )
}
