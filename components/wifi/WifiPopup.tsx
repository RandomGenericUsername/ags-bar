import { createEffect } from "ags"
import { Gdk } from "ags/gtk4"
import {
  closeWifiPopup,
  wifiIconX,
  wifiPopupVisible,
} from "./state"
import {
  WifiPanelContent,
  closeWifiSettingsSurface,
} from "./WifiPanelContent"
import {
  clearPromptTarget,
  closePrompt,
  promptVisible,
  settingsOpen,
  wifiPanelKeyboard,
} from "./wifi-panel-state"
import { PopupCatcher, PopupHost, type PopupSurfaceSpec } from "../../kit/popup-host"

/**
 * The REQ-007 Wi-Fi surface (spine AD-10): a factory mounted only while the
 * popover is visible.
 *
 * 352 px, bar-anchored, one `surface.panel` glass box. The header is a sibling
 * of the scrolledwindow so it stays pinned; the footer is a sibling too.
 *
 * Keyboard stays NONE unless typed input is on screen: the password field or
 * the settings interval field (`wifiPanelKeyboard`). An unconditional
 * ON_DEMAND would grab focus, make the bar swallow the first click and break
 * same-spot collapse — the same rule the old WifiPopup documented.
 */
export const wifiSurface: PopupSurfaceSpec = {
  id: "wifi",
  width: 352,
  keyboard: wifiPanelKeyboard,
  body: ({ visible }) => <WifiPanelContent visible={visible} />,
}

export function WifiPopupCatcher(gdkmonitor: Gdk.Monitor) {
  return (
    <PopupCatcher
      name="wifi-popup-catcher"
      gdkmonitor={gdkmonitor}
      visible={wifiPopupVisible}
      onClose={closeWifiPopup}
    />
  )
}

/**
 * Escape is staged: close the sibling settings surface first, then the
 * password prompt (back to the lists), then the popover. An outside click
 * still dismisses the whole overlay through the catcher.
 */
function wifiEscape(): void {
  if (settingsOpen()) {
    closeWifiSettingsSurface()
    return
  }
  if (promptVisible()) {
    closePrompt()
    return
  }
  closeWifiPopup()
}

export function WifiPopup(gdkmonitor: Gdk.Monitor) {
  // The body (and the gear's popover) is unmounted on close; reset the
  // UI-local surface state here so reopening never resurrects a prompt or
  // flips ON_DEMAND for a settings field that is no longer on screen.
  createEffect(() => {
    if (wifiPopupVisible()) return
    closeWifiSettingsSurface()
    clearPromptTarget()
  })

  return (
    <PopupHost
      spec={wifiSurface}
      name="wifi-popup"
      windowClass="wifi-popup"
      surfaceClass="wifi-surface"
      gdkmonitor={gdkmonitor}
      visible={wifiPopupVisible}
      anchorX={wifiIconX}
      /* The REQ-007 anchor gap: the bar is 48 px tall, +8 px under the icon. */
      marginTop={56}
      onClose={closeWifiPopup}
      onEscape={wifiEscape}
    />
  )
}
