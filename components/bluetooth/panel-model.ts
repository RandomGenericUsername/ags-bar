/**
 * Pure presentation model for the REQ-009 Bluetooth popover.
 *
 * Everything here decides *what the panel says*, never how it is painted:
 * the connected/paired/nearby partition, the header subtitle, the signal and
 * battery glyph variants, the busy word and the Nearby disclosure rules.
 * Keeping it pure lets the acceptance criteria (no duplicate connected row,
 * out-of-range refusal, battery only while connected, one scanning indicator)
 * be unit tested on a stock runner without GTK or BlueZ.
 *
 * The device shape is declared structurally here rather than imported from
 * `bluetooth-service` (which imports `gi://*`): a `import type` would still
 * pull the service into the pure test program's typecheck, so this module owns
 * the minimal shape it reads. `bluetooth-service`'s `BluetoothDevice` is a
 * structural superset.
 */

export type BluetoothAction = "pair" | "connect" | "disconnect" | "unpair"

export interface BluetoothDeviceLike {
  readonly address: string
  readonly alias: string
  readonly name: string
  readonly connected: boolean
  readonly paired: boolean
  readonly rssi: number
  readonly battery: number
}

export interface BluetoothPartition<T extends BluetoothDeviceLike> {
  /** Every connected device, in the service's order. Never also in `paired`. */
  readonly connected: T[]
  /** Paired but not connected. */
  readonly paired: T[]
  /** Not paired at all — the Nearby rows. */
  readonly nearby: T[]
}

/**
 * The three device sections. `connected` is the centrepiece and `paired`
 * deliberately EXCLUDES connected devices, so a headset that is connected
 * cannot appear twice (the old drawer showed it in both lists).
 */
export function partitionDevices<T extends BluetoothDeviceLike>(
  devices: readonly T[],
): BluetoothPartition<T> {
  return {
    connected: devices.filter((device) => device.connected),
    paired: devices.filter((device) => device.paired && !device.connected),
    nearby: devices.filter((device) => !device.paired),
  }
}

export function displayName(
  device: Pick<BluetoothDeviceLike, "alias" | "name">,
): string {
  return device.alias || device.name || "Unknown device"
}

/** BlueZ reports RSSI 0 for "not seen"; a negative value means present. */
export function isInRange(
  device: Pick<BluetoothDeviceLike, "connected" | "rssi">,
): boolean {
  return device.connected || device.rssi < 0
}

/**
 * RSSI (dBm, negative = present) → `settings-panel` signal level.
 * Fixed contract thresholds (design D5): ≥−60 full, ≥−70 good, ≥−80 medium,
 * else low. Callers must not resolve a variant when `rssi >= 0`.
 */
export function signalVariant(rssi: number): string {
  if (rssi >= -60) return "full"
  if (rssi >= -70) return "good"
  if (rssi >= -80) return "medium"
  return "low"
}

/**
 * Battery level (BlueZ integer 0-100) → the panel's guard-exempt glyph
 * variant. Bucket boundaries mirror the bar's `getBatteryStateKey`
 * (`<25 / <50 / <75 / <100`): one threshold set serves both surfaces.
 */
export function batteryVariant(level: number): string {
  if (level < 25) return "system-battery-0"
  if (level < 50) return "system-battery-25"
  if (level < 75) return "system-battery-50"
  if (level < 100) return "system-battery-75"
  return "system-battery-100"
}

/**
 * The reading is only honest while connected: a paired-but-idle `Battery1`
 * value is stale, so the panel hides it (`0` is "no reading").
 */
export function batteryVisible(
  device: Pick<BluetoothDeviceLike, "connected" | "battery">,
): boolean {
  return device.connected && device.battery > 0
}

export function actionWord(action: BluetoothAction): string {
  switch (action) {
    case "pair":
      return "Pairing…"
    case "connect":
      return "Connecting…"
    case "disconnect":
      return "Disconnecting…"
    case "unpair":
      return "Unpairing…"
  }
}

export interface BluetoothHeaderState {
  readonly ready: boolean
  readonly powered: boolean
  /** Connected devices, in the service's order. */
  readonly connectedNames: readonly string[]
  readonly scanning: boolean
}

/**
 * The live subtitle. Order is the mock's: no adapter, off, connected (one or
 * several), scanning, idle. A connected device outranks the scan cue because
 * it is the state the panel is centred on.
 */
export function headerSubtitle(state: BluetoothHeaderState): string {
  if (!state.ready) return "No adapter"
  if (!state.powered) return "Bluetooth off"
  if (state.connectedNames.length === 1) {
    return `Connected to ${state.connectedNames[0]}`
  }
  if (state.connectedNames.length > 1) {
    return `${state.connectedNames.length} devices connected`
  }
  if (state.scanning) return "Scanning…"
  return "On"
}

/** The mock's `?nearby=0` / auto-open tri-state. */
export function nearbyExpanded(
  manuallyToggled: boolean | null,
  nearbyCount: number,
): boolean {
  if (manuallyToggled !== null) return manuallyToggled
  return nearbyCount > 0
}

export interface NearbyIndicators {
  /** The header spinner. Collapsed always shows it; expanded-empty does not. */
  readonly headerCue: boolean
  /** The centred placeholder in the rows' place. */
  readonly placeholder: boolean
}

/**
 * ONE indicator, TWO positions: expanded-and-empty owns the centred
 * placeholder and hides the header cue; every other scanning state puts the
 * cue in the header (including while collapsed).
 */
export function nearbyIndicators(input: {
  readonly scanning: boolean
  readonly expanded: boolean
  readonly count: number
}): NearbyIndicators {
  const expandedEmpty = input.expanded && input.count === 0
  return {
    headerCue: input.scanning && !expandedEmpty,
    placeholder: input.scanning && expandedEmpty,
  }
}

/** `Adapter …` is metadata, visible only with a powered adapter present. */
export function adapterLineVisible(powered: boolean, ready: boolean): boolean {
  return powered && ready
}

export function adapterLine(address: string): string {
  return `Adapter ${address === "" ? "—" : address}`
}

export interface BluetoothStateBlock {
  readonly title: string
  readonly copy: string
}

/**
 * Off and no-adapter are DISTINCT states. A missing radio must not read as
 * merely "off": there is nothing the switch can turn on.
 */
export function stateBlock(ready: boolean): BluetoothStateBlock {
  if (!ready) {
    return {
      title: "No Bluetooth adapter found on this system.",
      copy: "Pairing and discovery are unavailable without a Bluetooth radio.",
    }
  }
  return {
    title: "Bluetooth is off",
    copy: "Turn it on to pair a mouse, keyboard, or headset.",
  }
}

/** The confirm question is per device and never truncates into a second state. */
export function confirmQuestion(name: string): string {
  return `Remove ${name} from paired devices?`
}
