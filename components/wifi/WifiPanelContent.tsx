import { Accessor, For, createComputed, createEffect, createState } from "ags"
import GLib from "gi://GLib?version=2.0"
import Pango from "gi://Pango?version=1.0"
import { Gtk } from "ags/gtk4"
import { registry } from "ags-platform/adapters/icon-registry"
import { launchScopedApp } from "../../lib/scopedLauncher"
import { WifiSwitch } from "../primitives/WifiSwitch"
import {
  activate,
  connectState,
  deviceInfo,
  scanNow,
  setWifiEnabled,
  startScanning,
  stopScanning,
  submitPassword,
  wifiEnabled,
  wifiNetworks,
  wifiReady,
  wifiScanning,
  type WifiNetwork,
} from "../../services/wifi-service"
import {
  getConfig,
  lastError,
  lastResult,
  lastRunAt,
  runSpeedTest,
  running as speedTestRunning,
} from "../../services/speedtest-service"
import {
  formatMbps,
  formatPing,
  formatRanAt,
  headerSubtitle,
  partitionNetworks,
  qualityLabel,
  securityLabel,
  signalLevel,
} from "./panel-model"
import {
  clearPromptTarget,
  closePrompt,
  dismissedFailure,
  dismissFailure,
  nearbyOpen,
  openPrompt,
  promptSsid,
  promptVisible,
  resetFailureDismissal,
  setSettingsOpenState,
  settingsOpen,
  syncPromptToConnection,
  toggleNearby,
} from "./wifi-panel-state"
import { openWifiSettingsPopover } from "./WifiSpeedTestSettings"

/**
 * The REQ-007 Wi-Fi popover body.
 *
 * One glass surface, persistent header, a connected hero, Known + a single
 * collapsed-by-default Nearby disclosure, the password view that replaces the
 * lists, and the pinned `Network settings` footer. Structure/content/layout
 * are app-owned; the skin paints `.wifi-*` with role tokens.
 *
 * The popover is bar-anchored (`PopupHost`), never the in-page `.settings-pop`
 * pattern: the ticket keeps the anchored popover and the existing ON_DEMAND
 * keyboard rule (password field or the settings interval field only).
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

function RevealGlyph({ revealed }: { revealed: Accessor<boolean> }) {
  const src = createComputed(() =>
    registry.resolve("settings-panel", revealed() ? "password-hide" : "password-show"),
  )
  return (
    <image
      pixel_size={16}
      $={(self: Gtk.Image) => {
        createEffect(() => {
          const path = src()
          if (path !== null) self.set_from_file(path)
          else self.set_from_file("")
        })
      }}
    />
  )
}

function SignalBars({
  strength,
  connected = false,
  big = false,
  valign = Gtk.Align.END,
}: {
  strength: Accessor<number>
  connected?: boolean
  big?: boolean
  valign?: Gtk.Align
}) {
  const level = createComputed(() => signalLevel(strength()))
  return (
    <box
      class={`wifi-sig${big ? " wifi-sig-big" : ""}${connected ? " is-connected" : ""}`}
      spacing={big ? 3 : 2}
      valign={valign}
    >
      {[0, 1, 2, 3].map((index) => (
        <box
          class={createComputed(() => (index < level() ? `wifi-sig-bar bar-${index + 1} on` : `wifi-sig-bar bar-${index + 1}`))}
          // Without END every bar fills the tallest sibling's height, so the
          // four bars render as an equal-height block instead of the ladder.
          valign={Gtk.Align.END}
        />
      ))}
    </box>
  )
}

function qualityWord(strength: number): string {
  return qualityLabel(strength)
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

/**
 * The mock's header glyph is the standard three-arc Wi-Fi mark drawn with
 * `currentColor` at 19 px. The icon registry's `settings-panel/wifi` is the
 * capability badge and is contract-painted primary; the theme's symbolic
 * `network-wireless` is Qogir's filled wedge. Neither matches. These are the
 * mock's exact paths, written once into the runtime dir with the semantic
 * state colour baked in (the same app-owned green literal the CSS uses).
 */
const WIFI_GLYPH_PATHS =
  '<path d="M2.5 8.5a15 15 0 0 1 19 0"></path>' +
  '<path d="M5.5 12a10.5 10.5 0 0 1 13 0"></path>' +
  '<path d="M8.7 15.4a6 6 0 0 1 6.6 0"></path>'

function wifiGlyph(name: string, colour: string, off = false): string {
  const slash = off
    ? '<path d="M4 4l16 16"></path>'
    : '<circle cx="12" cy="19" r="1" fill="' + colour + '" stroke="none"></circle>'
  const svg =
    '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" ' +
    `stroke="${colour}" stroke-width="1.7" stroke-linecap="round" ` +
    `aria-hidden="true">${WIFI_GLYPH_PATHS}${slash}</svg>`
  const path = `${GLib.get_user_runtime_dir()}/ags-${name}.svg`
  GLib.file_set_contents(path, svg)
  return path
}

const WIFI_GLYPH_CONNECTED = wifiGlyph("wifi-connected", "#4ade80")
const WIFI_GLYPH_IDLE = wifiGlyph("wifi-idle", "#c6c5d0")
const WIFI_GLYPH_OFF = wifiGlyph("wifi-off", "#90909a", true)

function HeadGlyph() {
  const src = createComputed(() => {
    if (!wifiEnabled()) return WIFI_GLYPH_OFF
    return wifiNetworks().some((network) => network.connected)
      ? WIFI_GLYPH_CONNECTED
      : WIFI_GLYPH_IDLE
  })
  return (
    <image
      class="wifi-head-glyph-image"
      pixel_size={19}
      $={(self: Gtk.Image) => {
        createEffect(() => {
          self.set_from_file(src())
        })
      }}
    />
  )
}

let activeSettingsPopover: Gtk.Popover | null = null

/** Escape/close path for the sibling settings surface (owned by the gear). */
export function closeWifiSettingsSurface(): void {
  activeSettingsPopover?.popdown()
  activeSettingsPopover = null
  setSettingsOpenState(false)
}

function PanelHeader({ visible }: { visible: Accessor<boolean> }) {
  function toggleSettings(anchor: Gtk.Widget): void {
    if (settingsOpen()) {
      closeWifiSettingsSurface()
      return
    }
    activeSettingsPopover = openWifiSettingsPopover(anchor, () => {
      activeSettingsPopover = null
    })
  }

  const subtitle = createComputed(() => {
    const conn = connectState()
    const connected = wifiNetworks().find((network) => network.connected) ?? null
    const connecting =
      conn.phase === "preparing" || conn.phase === "activating" ? conn.ssid : null
    return headerSubtitle({
      enabled: wifiEnabled(),
      connectedSsid: connected?.ssid ?? null,
      connectingSsid: connecting,
      promptSsid: promptSsid(),
      promptJoining: connecting !== null && promptSsid() !== null && connecting === promptSsid(),
      failure: conn.phase === "failed" ? conn.reason ?? "Connection failed" : null,
      scanning: wifiScanning(),
    })
  })

  const glyphClass = createComputed(() => {
    if (!wifiEnabled()) return "wifi-head-glyph is-off"
    return wifiNetworks().some((network) => network.connected)
      ? "wifi-head-glyph is-connected"
      : "wifi-head-glyph is-idle"
  })

  // Closing the window tears down a popover parented inside it without a
  // `closed` signal, so make the keyboard/paint state honest on panel close.
  createEffect(() => {
    if (visible()) return
    closeWifiSettingsSurface()
  })

  return (
    <box class="wifi-head" spacing={10}>
      <box class="wifi-head-id" spacing={10} hexpand>
        <box class={glyphClass} valign={Gtk.Align.CENTER}>
          <HeadGlyph />
        </box>
        <box class="wifi-head-text" orientation={1} hexpand>
          <label class="wifi-head-title" xalign={0} label="Wi-Fi" />
          <label
            class="wifi-head-sub"
            xalign={0}
            ellipsize={Pango.EllipsizeMode.END}
            label={subtitle}
          />
        </box>
      </box>
      <box class="wifi-head-actions" spacing={2} valign={Gtk.Align.CENTER}>
        <WifiSwitch
          active={wifiEnabled}
          sensitive={wifiReady}
          onToggled={(value) => {
            if (!value) {
              // Turning Wi-Fi off closes the prompt and cancels the in-flight
              // attempt; the service remains the source of the power state.
              closePrompt()
              setSettingsOpenState(false)
            }
            void setWifiEnabled(value)
          }}
        />
        <button
          class={createComputed(() => settingsOpen() ? "wifi-gear is-active" : "wifi-gear")}
          tooltipText="Speed test settings"
          onClicked={(self: Gtk.Button) => toggleSettings(self)}
          $={(self: Gtk.Button) =>
            createEffect(() => {
              accessibleLabel(self, "Speed test settings")
            })
          }
        >
          <Glyph name="settings" pixelSize={18} />
        </button>
      </box>
    </box>
  )
}

// ---------------------------------------------------------------------------
// Connected hero
// ---------------------------------------------------------------------------

function DetailRow({ name, value }: { name: string; value: Accessor<string> }) {
  return (
    <box class="wifi-detail-row" spacing={12}>
      <label class="wifi-detail-key" xalign={0} label={name} />
      <label class="wifi-detail-val" xalign={1} hexpand ellipsize={Pango.EllipsizeMode.END} label={value} />
    </box>
  )
}

function TestCell({
  value,
  unit,
  label,
}: {
  value: Accessor<string>
  unit: string | Accessor<string>
  label: string
}) {
  return (
    <box class="wifi-test-cell" orientation={1} hexpand>
      <box spacing={2}>
        <label class="wifi-test-value" label={value} />
        <label
          class="wifi-test-unit"
          valign={Gtk.Align.END}
          label={unit}
          visible={createComputed(
            () =>
              value() !== "—" &&
              (typeof unit === "string" ? unit !== "" : unit() !== ""),
          )}
        />
      </box>
      <label class="wifi-test-label" xalign={0} label={label} />
    </box>
  )
}

function ConnectedHero({ nowMs }: { nowMs: Accessor<number> }) {
  const network = createComputed(
    () => wifiNetworks().find((item) => item.connected) ?? null,
  )
  const visible = createComputed(() => wifiEnabled() && network() !== null && !promptVisible())

  const ssid = createComputed(() => network()?.ssid ?? "")
  const strength = createComputed(() => network()?.strength ?? 0)
  const quality = createComputed(() => qualityWord(strength()))
  const security = createComputed(() => {
    const item = network()
    return item === null ? "—" : securityLabel(item)
  })
  const ipIface = createComputed(() => {
    const info = deviceInfo()
    if (info.ip && info.iface) return `${info.ip} · ${info.iface}`
    return info.ip ?? info.iface ?? "—"
  })
  const mac = createComputed(() => deviceInfo().mac ?? "—")

  const down = createComputed(() => formatMbps(lastResult()?.down_mbps))
  const up = createComputed(() => formatMbps(lastResult()?.up_mbps))
  const ping = createComputed(() => formatPing(lastResult()?.latency_ms))
  // The Ran cell is a value + unit, exactly like the mock: "8 min" at the
  // numeric size and "ago" at the small unit size. Passing the whole
  // "8 min ago" through the value label made the cell 99 px wide; with a
  // homogeneous four-column grid that forced the whole panel to 474 px and
  // pushed its right edge off-screen. No result is the mock's "—" (the foot
  // carries "No speed test has run…").
  const ran = createComputed(() => {
    nowMs()
    if (lastRunAt() === null) return "—"
    const label = formatRanAt(Date.now(), lastRunAt())
    return label.endsWith(" ago") ? label.slice(0, -4) : label
  })
  const ranUnit = createComputed(() => {
    if (lastRunAt() === null) return ""
    return formatRanAt(Date.now(), lastRunAt()).endsWith(" ago") ? "ago" : ""
  })

  const foot = createComputed(() => {
    nowMs()
    if (speedTestRunning()) {
      return "Running… this can take about 30 s. The previous result stays visible."
    }
    if (lastError() !== null) {
      return lastRunAt() !== null
        ? `Last attempt ${formatRanAt(Date.now(), lastRunAt())}; previous result kept.`
        : "Last attempt failed."
    }
    if (lastRunAt() === null) return "No speed test has run on this network yet."
    return `Ran ${formatRanAt(Date.now(), lastRunAt())} · measured on the connected network.`
  })

  return (
    <box class="wifi-hero" orientation={1} visible={visible}>
      <box class="wifi-hero-top" spacing={12}>
        <box class="wifi-hero-main" orientation={1} hexpand>
          <label class="wifi-hero-ssid" xalign={0} ellipsize={Pango.EllipsizeMode.END} label={ssid} />
          <box class="wifi-hero-meta" spacing={6}>
            <SignalBars strength={strength} connected />
            <label label={quality} />
            <label class="wifi-meta-dot" label="•" />
            <label label={security} />
            <label class="wifi-pill-connected wifi-state-connected" valign={Gtk.Align.CENTER} label="Connected" />
          </box>
        </box>
        <box class="wifi-hero-signal" orientation={1} spacing={4}>
          <SignalBars strength={strength} connected big />
          <label class="wifi-hero-percent" xalign={1} label={createComputed(() => `${strength()}%`)} />
        </box>
      </box>

      <box
        class="wifi-weak"
        spacing={8}
        visible={createComputed(() => network()?.weakSecurity ?? false)}
      >
        <Glyph name="info-caution" pixelSize={15} cls="wifi-weak-icon" />
        <label
          class="wifi-weak-text"
          xalign={0}
          wrap
          maxWidthChars={32}
          label="Weak security (WPA). This network uses an older encryption standard."
        />
      </box>

      <box class="wifi-details" orientation={1} spacing={0}>
        <DetailRow name="IP / iface" value={ipIface} />
        <DetailRow name="MAC" value={mac} />
      </box>

      <box class={createComputed(() => speedTestRunning() ? "wifi-test-block is-running" : "wifi-test-block")} orientation={1}>
        <box class="wifi-test-head" spacing={10}>
          <label class="wifi-test-title" xalign={0} hexpand label="Speed test" />
          <button
            class="wifi-run-btn"
            sensitive={createComputed(() => !speedTestRunning())}
            onClicked={() => {
              if (!speedTestRunning()) void runSpeedTest("manual")
            }}
            $={(self: Gtk.Button) => accessibleLabel(self, "Run speed test")}
          >
            <box spacing={6}>
              <Gtk.Spinner class="wifi-spinner" spinning={speedTestRunning} visible={speedTestRunning} />
              <label label={createComputed(() => speedTestRunning() ? "Testing…" : "Run test")} />
            </box>
          </button>
        </box>
        <box class="wifi-test-grid" spacing={6} homogeneous>
          <TestCell value={down} unit="Mbps" label="Download" />
          <TestCell value={up} unit="Mbps" label="Upload" />
          <TestCell value={ping} unit="ms" label="Ping" />
          <TestCell value={ran} unit={ranUnit} label="Ran" />
        </box>
        <label
          class="wifi-test-error"
          xalign={0}
          wrap
          maxWidthChars={34}
          label={createComputed(() => lastError() ?? "")}
          visible={createComputed(() => lastError() !== null)}
        />
        <label class="wifi-test-foot" xalign={0} wrap maxWidthChars={36} label={foot} />
      </box>
    </box>
  )
}

// ---------------------------------------------------------------------------
// Network rows + Known / Nearby
// ---------------------------------------------------------------------------

function rowSubline(network: { saved: boolean; secured: boolean }): string {
  if (network.saved) return "Saved"
  return network.secured ? "Secured" : "Open network"
}

function NetworkRow({ network: item }: { network: WifiNetwork }) {
  const live = createComputed(
    () => wifiNetworks().find((network) => network.ssid === item.ssid) ?? item,
  )
  const connected = createComputed(() => live().connected)
  const busy = createComputed(() => {
    const conn = connectState()
    return (
      conn.ssid === item.ssid &&
      (conn.phase === "preparing" || conn.phase === "activating")
    )
  })
  const pending = createComputed(() => {
    const conn = connectState()
    return (
      conn.ssid === item.ssid &&
      (conn.phase === "preparing" || conn.phase === "activating" || conn.phase === "needAuth")
    )
  })

  function act(): void {
    if (connected() || busy()) return
    resetFailureDismissal()
    if (item.secured && !live().saved) {
      // Secured + unsaved: open the prompt instead of trying to connect.
      openPrompt(item.ssid)
      return
    }
    activate(item.ssid)
  }

  const cls = createComputed(() =>
    [
      "wifi-row",
      connected() ? "is-connected wifi-state-connected" : "",
      busy() ? "is-busy" : "",
    ]
      .filter(Boolean)
      .join(" "),
  )

  return (
    <button
      class={cls}
      onClicked={act}
      $={(self: Gtk.Button) =>
        createEffect(() =>
          accessibleLabel(
            self,
            `${live().ssid}, ${rowSubline(live())}${connected() ? ", connected" : ""}`,
          ),
        )
      }
    >
      <box spacing={9} hexpand>
        <SignalBars
          strength={createComputed(() => live().strength)}
          connected={false}
          valign={Gtk.Align.CENTER}
        />
        <box class="wifi-row-text" orientation={1} hexpand>
          <label class="wifi-row-name" xalign={0} ellipsize={Pango.EllipsizeMode.END} label={createComputed(() => live().ssid)} />
          <label class="wifi-row-sub" xalign={0} label={createComputed(() => rowSubline(live()))} />
        </box>
        <label
          class="wifi-pill-connected wifi-state-connected wifi-row-badge"
          valign={Gtk.Align.CENTER}
          label="Connected"
          visible={connected}
        />
        <box
          class={createComputed(() => busy() ? "wifi-row-action is-busy" : "wifi-row-action")}
          valign={Gtk.Align.CENTER}
          visible={createComputed(() => !connected())}
        >
          <box spacing={5}>
            <Gtk.Spinner class="wifi-spinner" spinning={busy} visible={busy} />
            <label label={createComputed(() => busy() ? "Connecting…" : "Connect")} />
          </box>
        </box>
        {/* The row itself is the action; `pending` keeps the in-row spinner
            state explicit for tests and for the needAuth phase. */}
        <label class="wifi-row-pending" visible={false} label={createComputed(() => pending() ? "pending" : "")} />
      </box>
    </button>
  )
}

function NetworksSection() {
  let nearbyToggle: Gtk.Button | null = null
  const partition = createComputed(() => partitionNetworks(wifiNetworks()))
  const known = createComputed(() => partition().known)
  const nearby = createComputed(() => partition().nearby)
  const total = createComputed(() => wifiNetworks().length)
  const nearbyBodyAvailable = createComputed(() => nearby().length > 0)

  return (
    <box class="wifi-networks" orientation={1}>
      <box class="wifi-list-groups" orientation={1} visible={createComputed(() => total() > 0)}>
        <box class="wifi-list-head" spacing={8}>
          <label class="wifi-list-title" xalign={0} label="Known" />
          <label class="wifi-list-count" xalign={0} label={createComputed(() => known().length > 0 ? String(known().length) : "")} />
        </box>
        <box class="wifi-net-list" orientation={1}>
          <For each={known} id={(network) => network.ssid}>
            {(network) => <NetworkRow network={network} />}
          </For>
          <label
            class="wifi-list-empty"
            xalign={0}
            label="No saved networks yet."
            visible={createComputed(() => known().length === 0)}
          />
        </box>

        <box class="wifi-list-head wifi-nearby-head" spacing={4}>
          <button
            class="wifi-nearby-toggle"
            hexpand
            onClicked={toggleNearby}
            $={(self: Gtk.Button) => {
              nearbyToggle = self
              createEffect(() => {
                accessibleExpanded(self, nearbyOpen())
                accessibleLabel(
                  self,
                  `${nearbyOpen() ? "Hide" : "Show"} nearby networks, ${nearby().length} found`,
                )
              })
            }}
          >
            {/* Gtk.Button takes ONE child. Three sibling labels kept only the
                last one, so the header rendered as "(8) Scan" with no chevron
                or "Nearby". Wrap them in the button's horizontal box. */}
            <box spacing={4} hexpand>
              {/* A symbolic chevron follows the skin's ink; the text glyph
                  (▸/▾) fell back to a dot in the mono face. */}
              <image
                class="wifi-nearby-chevron"
                pixel_size={10}
                $={(self: Gtk.Image) => {
                  createEffect(() => {
                    self.set_from_icon_name(
                      nearbyOpen() ? "pan-down-symbolic" : "pan-end-symbolic",
                    )
                  })
                }}
              />
              <label class="wifi-list-title" xalign={0} label="Nearby" />
              <label class="wifi-list-count" label={createComputed(() => `(${nearby().length})`)} />
            </box>
          </button>
          <button
            class="wifi-scan"
            sensitive={createComputed(() => !wifiScanning())}
            onClicked={() => scanNow()}
            $={(self: Gtk.Button) =>
              createEffect(() =>
                accessibleLabel(self, wifiScanning() ? "Scanning for networks" : "Scan for networks"),
              )
            }
          >
            <label label={createComputed(() => wifiScanning() ? "Scanning…" : "Scan")} />
          </button>
        </box>

        <box
          class="wifi-nearby-body"
          orientation={1}
          visible={nearbyOpen}
          $={(self: Gtk.Widget) => {
            // GTK exposes ARIA `aria-controls` as a CONTROLS relation; the
            // toggle is built first, so the body can declare it here.
            if (nearbyToggle !== null) accessibleControls(nearbyToggle, self)
          }}
        >
          <box class="wifi-net-list" orientation={1}>
            <For each={nearby} id={(network) => network.ssid}>
              {(network) => <NetworkRow network={network} />}
            </For>
            <label
              class="wifi-list-empty"
              xalign={0}
                label="No other networks nearby."
              visible={createComputed(() => !nearbyBodyAvailable())}
            />
          </box>
        </box>
      </box>

      <box class="wifi-empty-state" orientation={1} visible={createComputed(() => total() === 0)}>
        <box class="wifi-empty-glyph" halign={Gtk.Align.CENTER}>
          <Glyph name="wifi-off" pixelSize={22} />
        </box>
        <label class="wifi-empty-title" halign={Gtk.Align.CENTER} label="No networks found" />
        <label
          class="wifi-empty-copy"
          xalign={0}
          wrap
          maxWidthChars={34}
          label="Move closer to the router, then scan again. Saved networks remain available when they return."
        />
        <button class="wifi-empty-action" halign={Gtk.Align.CENTER} onClicked={() => scanNow()}>
          <label label="Scan again" />
        </button>
      </box>
    </box>
  )
}

// ---------------------------------------------------------------------------
// Password prompt
// ---------------------------------------------------------------------------

function PasswordPrompt() {
  const [password, setPassword] = createState("")
  const [revealed, setRevealed] = createState(false)
  const [localError, setLocalError] = createState("")
  let entry: Gtk.Entry | null = null

  const ssid = promptSsid
  const network = createComputed(
    () => wifiNetworks().find((item) => item.ssid === ssid()) ?? null,
  )
  const joining = createComputed(() => {
    const conn = connectState()
    return (
      conn.ssid === ssid() &&
      (conn.phase === "preparing" || conn.phase === "activating")
    )
  })
  const promptError = createComputed(() => {
    if (localError() !== "") return localError()
    const conn = connectState()
    if (conn.phase !== "failed") return ""
    return conn.reason ?? "Connection failed"
  })
  const subline = createComputed(() => {
    const item = network()
    if (item !== null && !item.secured) {
      return "This network is open. Joining does not require a password."
    }
    const label = item !== null ? securityLabel(item) : "secured"
    return `Enter the password for this ${label} network.`
  })

  createEffect(() => {
    if (ssid() === null) return
    setPassword("")
    setRevealed(false)
    setLocalError("")
    entry?.grab_focus()
  })

  function join(): void {
    if (joining()) return
    const target = ssid()
    if (target === null) return
    const item = network()
    const secured = item?.secured ?? true
    if (secured && password().length === 0) {
      setLocalError("Enter the password to join this network.")
      entry?.grab_focus()
      return
    }
    setLocalError("")
    resetFailureDismissal()
    if (connectState().phase === "needAuth") submitPassword(password())
    else activate(target, password())
  }

  return (
    <box class="wifi-password" orientation={1}>
      <label class="wifi-pw-kicker" xalign={0} label="Join network" />
      <label
        class="wifi-pw-title"
        xalign={0}
        ellipsize={Pango.EllipsizeMode.END}
        label={createComputed(() => ssid() ?? "")}
      />
      <label class="wifi-pw-sub" xalign={0} wrap maxWidthChars={34} label={subline} />

      <label class="wifi-pw-label" xalign={0} label="Password" />
      <box class="wifi-pw-field" spacing={6}>
        <entry
          class="wifi-pw-input"
          hexpand
          visibility={revealed}
          placeholderText="Network password"
          onActivate={join}
          onNotifyText={(self: { text: string }) => {
            setPassword(self.text)
            if (localError() !== "") setLocalError("")
          }}
          $={(self: Gtk.Entry) => {
            entry = self
          }}
        />
        <button
          class={createComputed(() => revealed() ? "wifi-pw-reveal is-on" : "wifi-pw-reveal")}
          tooltipText={createComputed(() => revealed() ? "Hide password" : "Show password")}
          onClicked={() => {
            setRevealed(!revealed())
            entry?.grab_focus()
          }}
          canFocus={false}
          $={(self: Gtk.Button) =>
            createEffect(() => accessibleLabel(self, revealed() ? "Hide password" : "Show password"))
          }
        >
          <RevealGlyph revealed={revealed} />
        </button>
      </box>

      <box
        class="wifi-pw-error"
        spacing={6}
        visible={createComputed(() => promptError() !== "")}
      >
        <Glyph name="info-caution" pixelSize={14} />
        <label xalign={0} wrap maxWidthChars={32} label={promptError} />
      </box>

      <box class="wifi-pw-actions" spacing={8} homogeneous>
        <button class="wifi-btn cancel" onClicked={closePrompt}>
          <label label="Cancel" />
        </button>
        <button
          class="wifi-btn join"
          sensitive={createComputed(() => !joining())}
          onClicked={join}
        >
          <box spacing={6} halign={Gtk.Align.CENTER}>
            <Gtk.Spinner class="wifi-spinner" spinning={joining} visible={joining} />
            <label label={createComputed(() => joining() ? "Joining…" : "Join")} />
          </box>
        </button>
      </box>
    </box>
  )
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function PanelFooter() {
  const [message, setMessage] = createState("")
  return (
    <box class="wifi-foot" orientation={1}>
      <label
        class="wifi-foot-message"
        xalign={0}
        wrap
        maxWidthChars={38}
        label={message}
        visible={createComputed(() => message() !== "")}
      />
      <button
        class="wifi-foot-row"
        onClicked={() => {
          setMessage("")
          void launchScopedApp("network-connections").then((ok) => {
            if (!ok) {
              setMessage("nm-connection-editor is unavailable — run provisioning to install it.")
            }
          })
        }}
        $={(self: Gtk.Button) => accessibleLabel(self, "Network settings, opens nm-connection-editor")}
      >
        {/* Gtk.Button takes ONE child; three sibling boxes kept only the
            trailing "Open" hint. Wrap the footer row in its horizontal box. */}
        <box spacing={9} hexpand>
          <box class="wifi-foot-icon" valign={Gtk.Align.CENTER}>
            <Glyph name="settings" pixelSize={16} />
          </box>
          <box class="wifi-foot-text" orientation={1} hexpand>
            <label class="wifi-foot-title" xalign={0} label="Network settings" />
            <label class="wifi-foot-sub" xalign={0} ellipsize={Pango.EllipsizeMode.END} label="opens nm-connection-editor" />
          </box>
          <label class="wifi-foot-hint" valign={Gtk.Align.CENTER} label="Open" />
        </box>
      </button>
    </box>
  )
}

// ---------------------------------------------------------------------------
// Surface body
// ---------------------------------------------------------------------------

export function WifiPanelContent({ visible }: { visible: Accessor<boolean> }) {
  const [nowMs, setNowMs] = createState(Date.now())
  let clockId = 0
  let observedConnectedSsid: string | null = null
  let connectionObserved = false

  const enabled = createComputed(() => wifiEnabled())
  const showMain = createComputed(() => wifiEnabled() && !promptVisible())
  const failureReason = createComputed(() => {
    const conn = connectState()
    if (conn.phase !== "failed") return null
    return conn.reason ?? "Connection failed"
  })
  const failureVisible = createComputed(() => {
    const reason = failureReason()
    return reason !== null && reason !== dismissedFailure() && showMain()
  })

  // The "Ran" clock is live only while the surface is on screen.
  createEffect(() => {
    if (!visible()) return
    setNowMs(Date.now())
    const tick = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
      setNowMs(Date.now())
      return true
    })
    clockId = tick
    return () => {
      if (clockId !== 0) {
        try {
          GLib.source_remove(clockId)
        } catch {
          /* already removed */
        }
        clockId = 0
      }
    }
  })

  // Scanning is visibility-tied: every 6 s while any Wi-Fi surface is mounted,
  // and zero timers after it closes. The mock's 7 s cue is decorative.
  createEffect(() => {
    if (!visible()) return
    startScanning()
    return () => stopScanning()
  })

  // Clear a row-chosen prompt target once that network is connected; keep a
  // prompt open on failure so the user can retry.
  createEffect(() => {
    if (!visible()) return
    wifiNetworks()
    syncPromptToConnection()
  })

  // Turning the radio off (from any caller) must not strand a prompt/settings.
  createEffect(() => {
    if (wifiEnabled()) return
    clearPromptTarget()
    setSettingsOpenState(false)
  })

  // Auto-run on a successful connection uses the existing service config.
  createEffect(() => {
    if (!visible()) return
    const connectedSsid =
      wifiNetworks().find((network) => network.connected)?.ssid ?? null
    if (!connectionObserved) {
      connectionObserved = true
      observedConnectedSsid = connectedSsid
      return
    }
    if (
      connectedSsid !== null &&
      connectedSsid !== observedConnectedSsid &&
      getConfig().run_on_connect
    ) {
      void runSpeedTest("connect")
    }
    observedConnectedSsid = connectedSsid
  })

  return (
    <box class="wifi-panel" orientation={1}>
      <PanelHeader visible={visible} />
      <scrolledwindow
        class="wifi-scroll"
        vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
        hscrollbarPolicy={Gtk.PolicyType.NEVER}
        propagateNaturalHeight
        propagateNaturalWidth={false}
        maxContentHeight={560}
      >
        <box class="wifi-scroll-body" orientation={1}>
          <box class="wifi-off-state" orientation={1} visible={createComputed(() => !enabled())}>
            <box class="wifi-off-glyph" halign={Gtk.Align.CENTER}>
              <Glyph name="wifi-off" pixelSize={22} />
            </box>
            <label class="wifi-off-title" halign={Gtk.Align.CENTER} label="Wi-Fi is off" />
            <label
              class="wifi-off-copy"
              xalign={0}
              wrap
              maxWidthChars={34}
              label="Turn Wi-Fi on to see nearby networks and connect. Saved networks stay remembered."
            />
          </box>

          <ConnectedHero nowMs={nowMs} />

          <box
            class="wifi-notice"
            spacing={9}
            visible={failureVisible}
          >
            <Glyph name="info-caution" pixelSize={15} cls="wifi-notice-icon" />
            <box class="wifi-notice-text" orientation={1} hexpand>
              <label class="wifi-notice-title" xalign={0} label="Couldn't connect" />
              <label class="wifi-notice-body" xalign={0} wrap maxWidthChars={32} label={createComputed(() => failureReason() ?? "")} />
            </box>
            <button
              class="wifi-notice-dismiss"
              onClicked={() => {
                const reason = failureReason()
                if (reason !== null) dismissFailure(reason)
              }}
            >
              <label label="Dismiss" />
            </button>
          </box>

          <box class="wifi-main-networks" orientation={1} visible={showMain}>
            <NetworksSection />
          </box>

          <box class="wifi-prompt-wrap" orientation={1} visible={promptVisible}>
            <PasswordPrompt />
          </box>
        </box>
      </scrolledwindow>
      <PanelFooter />
    </box>
  )
}
