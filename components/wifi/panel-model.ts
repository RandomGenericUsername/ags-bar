/**
 * Pure presentation model for the REQ-007 Wi-Fi popover.
 *
 * Everything here is a decision about *what the panel says*, never how it is
 * painted: partition order, header copy, the quality/security words and the
 * speed-test/Ran formatting. Keeping it pure means the acceptance criteria
 * (known/nearby split, weak-security label, "no invented time") are unit
 * tested on a stock runner without GTK.
 *
 * The network shape is declared structurally here rather than imported from
 * `wifi-service` (which imports `gi://`): a `import type` would still pull the
 * service into the pure test program's typecheck, so this module owns the
 * minimal shape it reads.
 */

export interface WifiNetworkLike {
  readonly ssid: string
  readonly strength: number
  readonly secured: boolean
  readonly connected: boolean
  readonly saved: boolean
  readonly weakSecurity: boolean
}

export interface NetworkPartition {
  /** Connected first, then saved, strongest first. */
  readonly known: WifiNetworkLike[]
  /** Not connected and not saved, strongest first. */
  readonly nearby: WifiNetworkLike[]
}

/** The mock's known/nearby partition and ordering. */
export function partitionNetworks(networks: readonly WifiNetworkLike[]): NetworkPartition {
  const known = networks
    .filter((network) => network.connected || network.saved)
    .slice()
    .sort((a, b) => {
      if (a.connected !== b.connected) return a.connected ? -1 : 1
      return b.strength - a.strength
    })
  const nearby = networks
    .filter((network) => !network.connected && !network.saved)
    .slice()
    .sort((a, b) => b.strength - a.strength)
  return { known, nearby }
}

/** 0–4 bars, the same ≥75/≥50/≥25 steps as the icon table. */
export function signalLevel(strength: number): number {
  if (strength >= 75) return 4
  if (strength >= 50) return 3
  if (strength >= 25) return 2
  if (strength > 0) return 1
  return 0
}

export function qualityLabel(strength: number): string {
  if (strength >= 75) return "Excellent"
  if (strength >= 50) return "Good"
  if (strength >= 25) return "Fair"
  return "Weak"
}

/**
 * The service exposes `secured` + `weakSecurity` (WPA/WEP-grade without RSN),
 * not the negotiated suite. This is the honest reading of those two booleans:
 * never claim WPA2 when the link did not negotiate RSN.
 */
export function securityLabel(
  network: Pick<WifiNetworkLike, "secured" | "weakSecurity">,
): string {
  if (!network.secured) return "Open"
  return network.weakSecurity ? "WPA" : "WPA2"
}

export interface HeaderState {
  readonly enabled: boolean
  readonly connectedSsid: string | null
  /** In-flight row/activation target, when one exists. */
  readonly connectingSsid: string | null
  /** Prompt target, when the password view is open. */
  readonly promptSsid: string | null
  readonly promptJoining: boolean
  /** A typed connection failure reason, or null. */
  readonly failure: string | null
  readonly scanning: boolean
}

/**
 * The live subtitle. Order is the mock's: off, prompt, connecting, connected,
 * failure, scanning, not connected. A failure is more important than a scan cue
 * because it is the state the user has to act on.
 */
export function headerSubtitle(state: HeaderState): string {
  if (!state.enabled) return "Wi-Fi off"
  if (state.promptSsid !== null && state.promptJoining) return `Joining ${state.promptSsid}…`
  if (state.promptSsid !== null) return `Join ${state.promptSsid}`
  if (state.connectingSsid !== null) return `Connecting to ${state.connectingSsid}…`
  if (state.connectedSsid !== null) return `Connected to ${state.connectedSsid}`
  if (state.failure !== null && state.failure !== "") return "Connection failed"
  if (state.scanning) return "Scanning…"
  return "Not connected"
}

/**
 * Relative `Ran` label. `null` is the explicit no-result state (`Not run yet`);
 * there is no fabricated age. The just-now window matches the mock.
 */
export function formatRanAt(nowMs: number, ranAt: number | null): string {
  if (ranAt === null) return "Not run yet"
  const seconds = Math.max(0, Math.round((nowMs - ranAt) / 1000))
  if (seconds <= 4) return "just now"
  if (seconds < 60) return `${seconds} s ago`
  const mins = Math.round(seconds / 60)
  if (mins < 60) return `${mins} min ago`
  return `${Math.round(mins / 60)} h ago`
}

/** The settings' interval hint (`Off`, seconds, or minutes). */
export function humanizeMs(ms: number): string {
  if (!ms || ms <= 0) return "Off"
  if (ms < 1000) return `${ms} ms`
  if (ms < 60000) return `${Math.round(ms / 1000)} s`
  return `${Math.round((ms / 60000) * 10) / 10} min`
}

/** `412.6` keeps one decimal; a whole number stays whole; no result is `—`. */
export function formatMbps(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—"
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function formatPing(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—"
  return String(Math.round(value))
}
