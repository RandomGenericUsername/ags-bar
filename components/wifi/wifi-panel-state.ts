import { Accessor, createComputed, createState } from "ags"
import {
  cancel,
  connectState,
  wifiNetworks,
} from "../../services/wifi-service"

/**
 * UI-local state for the REQ-007 popover.
 *
 * Durable network state stays in `wifi-service`; only the things the surface
 * itself owns live here: the password target chosen from a row, the Nearby
 * disclosure, whether the sibling speed-test settings surface is open, and
 * which failure notice the user dismissed.
 */

const [promptTarget, setPromptTarget] = createState<string | null>(null)
const [nearbyOpen, setNearbyOpen] = createState(false)
const [settingsOpen, setSettingsOpen] = createState(false)
const [dismissedFailure, setDismissedFailure] = createState<string | null>(null)

/**
 * The prompt target: a row that needs a password, or the service asking for
 * one (`needAuth`, e.g. a saved profile whose secret changed). While idle we
 * still keep a row-chosen target, because the REQ-007 design opens the prompt
 * before calling `activate` for a secured, unsaved network.
 */
export const promptSsid: Accessor<string | null> = createComputed(() => {
  const conn = connectState()
  if (conn.phase === "needAuth") return conn.ssid
  return promptTarget()
})

export const promptVisible: Accessor<boolean> = createComputed(
  () => promptSsid() !== null,
)

export const wifiPanelKeyboard: Accessor<boolean> = createComputed(
  () => promptVisible() || settingsOpen(),
)

export function openPrompt(ssid: string): void {
  setDismissedFailure(null)
  setPromptTarget(ssid)
}

/** Cancel the prompt and the service attempt it may represent. */
export function closePrompt(): void {
  setPromptTarget(null)
  cancel()
}

/** Row-chosen target is cleared once that network is authoritatively connected. */
export function syncPromptToConnection(): void {
  const target = promptTarget()
  if (target === null) return
  const connected = wifiNetworks().some(
    (network) => network.connected && network.ssid === target,
  )
  if (connected) setPromptTarget(null)
}

export function clearPromptTarget(): void {
  setPromptTarget(null)
}

export { nearbyOpen, settingsOpen, dismissedFailure }

export function toggleNearby(): void {
  setNearbyOpen(!nearbyOpen())
}

export function setNearbyOpenState(open: boolean): void {
  setNearbyOpen(open)
}

export function setSettingsOpenState(open: boolean): void {
  setSettingsOpen(open)
}

export function dismissFailure(reason: string): void {
  setDismissedFailure(reason)
}

export function resetFailureDismissal(): void {
  setDismissedFailure(null)
}
