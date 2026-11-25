import { Accessor, createEffect } from "ags"
import GLib from "gi://GLib?version=2.0"
import {
  ageOutStaleReadings,
  bluetoothDevices,
  bluetoothPowered,
  refreshBluetoothDevices,
  routeAudioToDevice,
  startBluetoothDiscovery,
  stopBluetoothDiscovery,
} from "../../services/bluetooth-service"
import { dismissUnpairConfirm } from "./confirm-state"

/** How often the reachability clock is re-checked while a panel is visible. */
export const TICK_MS = 10000

/**
 * The effects every Bluetooth surface needs, extracted so the popover and the
 * settings subview cannot drift: discovery tied to visibility and power, the
 * audio-routing transition, confirm dismissal on hide, a fresh reachability
 * read on open and the reachability tick.
 *
 * Durable state stays in `bluetooth-service`; this file registers effects only.
 * Neither surface calls BlueZ directly.
 */
export function useBluetoothView(
  visible: Accessor<boolean>,
  owner: string,
): void {
  // Discovery runs while this content is visible and the adapter is powered;
  // hiding it (or powering off) stops it so BlueZ does not scan forever. The
  // service keys holders by OWNER ID, so a popup close racing a subview open
  // cannot stop a scan the other surface just started — and a leaked effect
  // re-acquiring this same surface is a no-op rather than a leak.
  createEffect(() => {
    if (!visible()) return
    if (!bluetoothPowered()) return
    startBluetoothDiscovery(owner)
    return () => stopBluetoothDiscovery(owner)
  })

  // Devices that connected outside the panel (auto-connect) still need the audio
  // sink defaulted.
  //
  // Transition-triggered, NOT on every device-list change. `bluetoothDevices()`
  // is re-published on every RSSI update, and an active scan produces those
  // constantly, so an effect that routed on each run would re-route the same
  // headset over and over. `routeAudioToDevice` also guards re-entry by label.
  const routedAddresses = new Set<string>()
  createEffect(() => {
    if (!visible()) return
    if (!bluetoothPowered()) return
    const connected = bluetoothDevices().filter((device) => device.connected)
    const stillConnected = new Set(connected.map((device) => device.address))
    for (const device of connected) {
      if (routedAddresses.has(device.address)) continue
      routedAddresses.add(device.address)
      void routeAudioToDevice(device.alias || device.name)
    }
    // Forget devices that dropped, so reconnecting routes again.
    for (const address of [...routedAddresses]) {
      if (!stillConnected.has(address)) routedAddresses.delete(address)
    }
  })

  // Click-outside / Escape dismissal, as far as this body can own it. The
  // popup's catcher and `app.tsx`'s `popup-close` handler both call
  // `dismissUnpairConfirm()` first; resetting here means an open confirm can
  // never outlive its surface either way.
  createEffect(() => {
    if (visible()) return
    dismissUnpairConfirm()
  })

  // Re-read reachability whenever the surface becomes visible. BlueZ emits no
  // event when a paired device merely stops advertising — it just stops
  // reporting RSSI — so the cached value can be minutes or hours old. A fresh
  // read costs one GetAll per cached device and only happens while someone is
  // looking.
  createEffect(() => {
    if (!visible()) return
    void refreshBluetoothDevices()
  })

  // The reachability tick. `ageOutStaleReadings` is a timestamp comparison over
  // the local cache — no D-Bus, no discovery — and it no-ops unless a scan is
  // running. The source is created INSIDE the effect so the first hide removes
  // this one and the next show creates a fresh one.
  createEffect(() => {
    if (!visible()) return
    ageOutStaleReadings()
    const ticker = GLib.timeout_add(GLib.PRIORITY_DEFAULT, TICK_MS, () => {
      ageOutStaleReadings()
      return GLib.SOURCE_CONTINUE
    })
    return () => GLib.source_remove(ticker)
  })
}
