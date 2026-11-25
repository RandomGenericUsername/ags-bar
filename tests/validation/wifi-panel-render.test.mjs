#!/usr/bin/env node
// Static render gate for the REQ-007 Wi-Fi popover.
//
// The panel is a GTK tree, so this does not instantiate it. It pins the parts
// the ticket's acceptance criteria name and that a refactor can silently lose:
// the 352 px bar-anchored surface, the persistent header, the Known/Nearby
// partition, the single collapsed-by-default disclosure with accessible
// expanded/controls state, the password routing, the in-row spinner, the hero
// states and the visibility-tied scan. Runtime look/interaction is the owner's
// visual pass and the frozen mock.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, resolve } from "node:path"

const HERE = dirname(fileURLToPath(import.meta.url))
const AGS = resolve(HERE, "../..")
const read = (p) => readFileSync(join(AGS, p), "utf8")

/** Strip comments so prose about a removed pattern cannot satisfy a check. */
function stripComments(text) {
  let out = ""
  for (let i = 0; i < text.length; i++) {
    const two = text.slice(i, i + 2)
    if (two === "/*") {
      const end = text.indexOf("*/", i + 2)
      i = end === -1 ? text.length : end + 1
      continue
    }
    if (two === "//") {
      const end = text.indexOf("\n", i)
      i = end === -1 ? text.length : end
      continue
    }
    out += text[i]
  }
  return out
}

const popup = stripComments(read("components/wifi/WifiPopup.tsx"))
const panel = stripComments(read("components/wifi/WifiPanelContent.tsx"))
const model = stripComments(read("components/wifi/panel-model.ts"))
const state = stripComments(read("components/wifi/wifi-panel-state.ts"))
const settings = stripComments(read("components/wifi/WifiSpeedTestSettings.tsx"))
const service = stripComments(read("services/wifi-service.ts"))
const css = read("style.css")
const networkWidget = stripComments(read("bar/widgets/network-descriptor.tsx"))
const kit = stripComments(read("kit/popup-host.tsx"))

const checks = []
const check = (name, fn) => {
  try {
    fn()
    checks.push({ name, ok: true })
  } catch (error) {
    checks.push({ name, ok: false, error })
  }
}

check("Wi-Fi is a 352 px bar-anchored popover on surface.panel", () => {
  assert.match(popup, /width:\s*352/, "the surface width must stay the 352 app literal")
  assert.match(popup, /windowClass="wifi-popup"/)
  assert.match(popup, /surfaceClass="wifi-surface"/)
  assert.match(popup, /<PopupHost/, "the panel must use the bar-anchored PopupHost")
  assert.doesNotMatch(popup, /settings-surface|\.settings-pop/, "not the in-page settings panel pattern")
  assert.doesNotMatch(popup, /appearance\.value/, "app code must not read appearance tokens")
})

check("header is persistent and carries glyph/title/status/switch/gear", () => {
  const header = panel.indexOf('class="wifi-head"')
  const scroll = panel.indexOf('class="wifi-scroll"')
  assert.ok(header >= 0, "header not found in WifiPanelContent")
  assert.ok(scroll > header, "header must be a sibling before the scrolled window")
  for (const needle of [
    'class="wifi-head-title"',
    'class="wifi-head-sub"',
    "WifiSwitch",
    'class={createComputed(() => settingsOpen() ? "wifi-gear is-active" : "wifi-gear")}',
  ]) {
    assert.ok(panel.includes(needle), `header is missing ${needle}`)
  }
  assert.ok(panel.indexOf("<PanelFooter />") > scroll, "footer must be pinned after the scroller")
})

check("hero owns SSID, signal/quality, security, green Connected, weak warning, IP/MAC", () => {
  for (const needle of [
    'class="wifi-hero-ssid"',
    "SignalBars",
    "quality",
    "securityLabel",
    "wifi-pill-connected wifi-state-connected",
    'name="IP / iface"',
    'name="MAC"',
    "weakSecurity",
    'class="wifi-weak"',
  ]) {
    assert.ok(panel.includes(needle), `hero is missing ${needle}`)
  }
})

check("speed test keeps previous numbers, shows spinner and typed error", () => {
  for (const needle of [
    "lastResult",
    "lastRunAt",
    "lastError",
    "speedTestRunning",
    "runSpeedTest",
    'label="Download"',
    'label="Upload"',
    'label="Ping"',
    'label="Ran"',
    '"—"',
    "Not run yet",
    "Testing…",
    "previous result kept",
  ]) {
    assert.ok(panel.includes(needle) || model.includes(needle), `speed test is missing ${needle}`)
  }
})

check("Known is always visible and Nearby is the only disclosure", () => {
  assert.match(panel, /label="Known"/)
  assert.match(panel, /label="Nearby"/)
  assert.doesNotMatch(panel, /Other Networks/, "the old Other Networks expander must be gone")
  assert.match(panel, /partitionNetworks/, "the list must use the pure known/nearby partition")
  assert.match(model, /connected \|\| network\.saved/)
  assert.match(model, /!network\.connected && !network\.saved/)
})

check("Nearby defaults collapsed with accessible expanded/controls", () => {
  assert.match(state, /createState\(false\)/, "Nearby must default to closed")
  assert.match(panel, /accessibleExpanded\(self, nearbyOpen\(\)\)/)
  assert.match(panel, /AccessibleState\.EXPANDED/)
  assert.match(panel, /AccessibleRelation\.CONTROLS/)
  assert.match(panel, /`\(\$\{nearby\(\)\.length\}\)`/, "the count must stay visible while collapsed")
  assert.match(panel, /visible=\{nearbyOpen\}/)
})

check("Scan is outside the Nearby toggle and works in both states", () => {
  const head = panel.indexOf('class="wifi-list-head wifi-nearby-head"')
  const toggle = panel.indexOf('class="wifi-nearby-toggle"', head)
  const scan = panel.indexOf('class="wifi-scan"', head)
  assert.ok(toggle > head && scan > toggle, "Scan must be a sibling of the toggle")
  assert.match(panel, /onClicked=\{\(\) => scanNow\(\)\}/)
  assert.doesNotMatch(panel.slice(toggle, scan), /scanNow/, "the toggle must not scan")
  assert.match(service, /export function scanNow/)
})

check("row click and the visual Connect both use one intent; secured-unsaved prompts", () => {
  assert.match(panel, /onClicked=\{act\}/, "the row is the keyboard/pointer target")
  assert.match(panel, /item\.secured && !live\(\)\.saved/)
  assert.match(panel, /openPrompt\(item\.ssid\)/)
  assert.match(panel, /activate\(item\.ssid\)/)
  assert.match(panel, /"Connect"/)
  assert.match(panel, /"Connecting…"/)
  assert.match(panel, /Gtk\.Spinner[^>]*spinning=\{busy\}/)
})

check("password prompt replaces the list, focuses ON_DEMAND, retries", () => {
  assert.match(panel, /visible=\{promptVisible\}/)
  assert.match(panel, /label="Join network"/)
  assert.match(panel, /placeholderText="Network password"/)
  assert.match(panel, /entry\?\.grab_focus\(\)/)
  assert.match(panel, /label="Cancel"/)
  assert.match(panel, /submitPassword\(password\(\)\)/)
  assert.match(panel, /activate\(target, password\(\)\)/)
  assert.match(panel, /Incorrect password|Connection failed/, "failure keeps an inline error")
  assert.match(state, /promptVisible\(\) \|\| settingsOpen\(\)/, "ON_DEMAND only for the two text fields")
})

check("settings surface is a sibling, reuses the shipped controls, and does not invent config", () => {
  for (const needle of [
    "IntervalMsControl",
    "setConfigValue",
    "runSpeedTest",
    'label="Auto-run on connect"',
    'label="Notify on each test"',
    '"Run now"',
    "new Gtk.Popover",
  ]) {
    assert.ok(settings.includes(needle), `settings surface is missing ${needle}`)
  }
  assert.match(settings, /wifi-speedtest\.json|existing wifi-speedtest/i)
})

check("footer always opens nm-connection-editor", () => {
  assert.match(panel, /label="Network settings"/)
  assert.match(panel, /opens nm-connection-editor/)
  assert.match(panel, /launchScopedApp\("network-connections"\)/)
})

check("scanning is visibility-tied at the service's 6 s cadence", () => {
  assert.match(panel, /startScanning\(\)/)
  assert.match(panel, /stopScanning\(\)/)
  assert.match(service, /SCAN_INTERVAL_MS = 6000/)
  assert.match(service, /export function scanNow/)
})

check("bar glyph is highlighted while the popover is open", () => {
  assert.match(networkWidget, /wifiOpen: wifiPopupVisible\(\)/)
  assert.match(networkWidget, /wifi-open/)
  assert.match(css, /\.network-widget\.wifi-open/)
})

check("Escape is staged: settings, then prompt, then panel", () => {
  assert.match(kit, /onEscape \?\? onClose/)
  const start = popup.indexOf("function wifiEscape")
  const body = popup.slice(start, popup.indexOf("export function WifiPopup("))
  assert.ok(body.indexOf("settingsOpen()") < body.indexOf("promptVisible()"))
  assert.ok(body.indexOf("promptVisible()") < body.indexOf("closeWifiPopup()"))
})

check("off, empty, failure and dismissed states are all present", () => {
  assert.match(panel, /label="Wi-Fi is off"/)
  assert.match(panel, /label="No networks found"/)
  assert.match(panel, /label="Scan again"/)
  assert.match(panel, /label="Couldn't connect"/)
  assert.match(panel, /dismissFailure/)
  assert.match(panel, /No saved networks yet\./)
  assert.match(panel, /No other networks nearby\./)
})

const failed = checks.filter((entry) => !entry.ok)
for (const entry of checks) {
  console.log(`${entry.ok ? "ok" : "not ok"} - ${entry.name}`)
  if (!entry.ok) console.error(`  ${entry.error?.message ?? entry.error}`)
}
if (failed.length > 0) {
  console.error(`\nFAIL: ${failed.length} Wi-Fi panel render check(s) failed`)
  process.exit(1)
}
console.log(`\nPASS: ${checks.length} Wi-Fi panel render checks`)
