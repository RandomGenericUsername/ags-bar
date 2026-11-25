#!/usr/bin/env node
// Static render gate for the REQ-009 Bluetooth popover.
//
// The panel is a GTK tree, so this does not instantiate it. It pins the parts
// the ticket's acceptance criteria name and that a refactor can silently lose:
// the 352 px bar-anchored surface, the persistent header/adapter/footer, the
// connected/paired/nearby split, the confirm/busy rules, the single-flight
// guards, the one Nearby disclosure and the no-keyboard rule. Runtime
// look/interaction is the owner's visual pass and the frozen mock.

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

const popup = stripComments(read("components/bluetooth/BluetoothPopup.tsx"))
const panel = stripComments(read("components/bluetooth/BluetoothPanelContent.tsx"))
const sections = stripComments(read("components/bluetooth/BluetoothSections.tsx"))
const content = stripComments(read("components/bluetooth/BluetoothContent.tsx"))
const model = stripComments(read("components/bluetooth/panel-model.ts"))
const view = stripComments(read("components/bluetooth/use-bluetooth-view.ts"))
const confirm = stripComments(read("components/bluetooth/confirm-state.ts"))
const settingsView = stripComments(read("settings-panel/views/BluetoothView.tsx"))
const service = stripComments(read("services/bluetooth-service.ts"))
const widget = stripComments(read("bar/widgets/bluetooth.tsx"))
const css = read("style.css")
const btCss = css.slice(css.indexOf("Bluetooth popover (REQ-009)"))

const checks = []
const check = (name, fn) => {
  try {
    fn()
    checks.push({ name, ok: true })
  } catch (error) {
    checks.push({ name, ok: false, error })
  }
}

check("Bluetooth is a 352 px bar-anchored popover on surface.panel", () => {
  assert.match(popup, /width:\s*352/, "the surface width must stay the 352 app literal")
  assert.match(popup, /windowClass="bluetooth-popup"/)
  assert.match(popup, /surfaceClass="bt-surface"/)
  assert.match(popup, /marginTop=\{56\}/, "8 px under the 48 px bar")
  assert.match(popup, /<PopupHost/, "the panel must use the bar-anchored PopupHost")
  assert.doesNotMatch(popup, /settings-surface|\.settings-pop/, "not the in-page settings panel pattern")
  assert.doesNotMatch(popup, /keyboard:/, "keyboard must stay NONE with no widening")
  assert.doesNotMatch(panel, /appearance\.value/, "app code must not read appearance tokens")
  assert.doesNotMatch(sections, /appearance\.value/, "app code must not read appearance tokens")
})

check("header, adapter line and footer are siblings that stay pinned", () => {
  const header = panel.indexOf('class="bt-head"')
  const scroll = panel.indexOf('class="bt-scroll"')
  const adapter = panel.indexOf("<AdapterLine />")
  const footer = panel.indexOf("<PanelFooter />")
  assert.ok(header >= 0, "header not found")
  assert.ok(scroll > header, "header must precede the scrolled window")
  assert.ok(adapter > scroll, "adapter line must be pinned after the scroller")
  assert.ok(footer > adapter, "footer must be pinned after the adapter line")
  for (const needle of ["bt-head-title", "bt-head-sub", "WifiSwitch"]) {
    assert.ok(panel.includes(needle), `header is missing ${needle}`)
  }
})

check("header subtitle covers one/many/scanning/on/off/no-adapter", () => {
  assert.match(model, /Connected to \$\{state\.connectedNames\[0\]\}/)
  assert.match(model, /devices connected/)
  assert.match(model, /return "Scanning…"/)
  assert.match(model, /return "No adapter"/)
  assert.match(model, /return "Bluetooth off"/)
  assert.match(model, /return "On"/)
  assert.match(panel, /headerSubtitle\(/)
})

check("connected devices stack as cards and never duplicate in Paired", () => {
  assert.match(model, /device\.connected/)
  assert.match(model, /device\.paired && !device\.connected/)
  assert.match(model, /!device\.paired/)
  assert.match(sections, /class="bt-card-list"/)
  assert.match(sections, /<For each=\{connected\} id=\{\(device\) => device\.address\}>/)
  assert.match(sections, /<ConnectedDeviceCard device=\{device\} \/>/)
  assert.match(sections, /"bt-card is-connected is-confirming"/)
  assert.match(btCss, /\.bt-card\.is-connected \{/)
  assert.match(panel, /<ConnectedSection \/>/)
  assert.match(panel, /<PairedSection \/>/)
  assert.match(panel, /<NearbySection \/>/)
})

check("connected card: signal, name + tooltip, badge, connected-only battery, dBm tooltip", () => {
  for (const needle of [
    "BluetoothSignalIcon",
    "bluetooth-signal-",
    "bt-dev-name",
    "tooltipText={name}",
    'label="Connected"',
    "BatteryStat",
    "Signal: −${Math.abs(rssi())} dBm",
    "bt-sig-slot",
  ]) {
    assert.ok(sections.includes(needle), `connected card is missing ${needle}`)
  }
  assert.match(model, /return device\.connected && device\.battery > 0/)
  assert.match(model, /rssi\(\) < 0|\bseen\(\)|rssi < 0/, "no glyph when unseen")
})

check("inline unpair confirm keeps the meta slot and offers Keep / Unpair device", () => {
  assert.match(model, /Remove \$\{name\} from paired devices\?/)
  assert.match(sections, /label="Keep"/)
  assert.match(sections, /label="Unpair device"/)
  assert.match(sections, /class="bt-card-foot"/)
  assert.match(sections, /class="bt-card-meta"/)
  assert.match(css, /\.bt-card-foot \{[^}]*min-height: 56px/)
  assert.match(sections, /confirming\(\) && !busy\(\)/, "confirm reuses the slot")
})

check("out-of-range dims the row, refuses Connect and keeps Unpair", () => {
  assert.match(model, /device\.connected \|\| device\.rssi < 0/)
  assert.match(sections, /out\(\) \? "bt-row out-of-range" : "bt-row"/)
  assert.match(sections, /if \(!inRange\(\)\) return/)
  assert.match(sections, /inRange\(\) && !anyBusy\(\)/)
  assert.match(btCss, /\.bt-row\.out-of-range \{ opacity: 0\.45; \}/)
  assert.match(sections, /label="Unpair"/)
})

check("single-flight: busy row hides actions, every other action is disabled", () => {
  assert.match(service, /if \(bluetoothBusy\(\)\.address !== null\)/)
  assert.match(model, /"Unpairing…"/)
  assert.match(sections, /anyBusy: createComputed\(\(\) => bluetoothBusy\(\)\.address !== null\)/)
  assert.match(sections, /sensitive=\{createComputed\(\(\) => !anyBusy\(\)\)\}/)
  assert.match(sections, /sensitive=\{createComputed\(\(\) => inRange\(\) && !anyBusy\(\)\)\}/)
  assert.match(sections, /visible=\{createComputed\(\(\) => !busy\(\)\)\}/)
  assert.match(sections, /label="Can take up to 30 s"/)
})

check("Nearby is the only disclosure, with count, cue and tri-state auto-open", () => {
  assert.match(sections, /createState<boolean \| null>\(null\)/)
  assert.match(model, /if \(manuallyToggled !== null\) return manuallyToggled/)
  assert.match(sections, /label="Nearby"/)
  assert.match(sections, /`\(\$\{nearby\(\)\.length\}\)`/)
  assert.match(sections, /AccessibleState\.EXPANDED/)
  assert.match(sections, /AccessibleRelation\.CONTROLS/)
  assert.match(sections, /headerCue/)
  assert.match(sections, /placeholder/)
  assert.match(sections, /label="No devices found"/)
  assert.match(sections, /label="Make sure the device is in pairing mode\."/)
  assert.match(sections, /label="Ready to pair"/)
  assert.match(sections, /label="Pair"/)
  assert.doesNotMatch(sections, /label="Available Devices"/)
  assert.doesNotMatch(sections, /label="Scan"/, "no separate Scan button")
})

check("one scanning indicator: header cue or expanded-empty placeholder", () => {
  assert.match(model, /headerCue: input\.scanning && !expandedEmpty/)
  assert.match(model, /placeholder: input\.scanning && expandedEmpty/)
  assert.match(sections, /visible=\{createComputed\(\(\) => indicators\(\)\.headerCue\)\}/)
  assert.match(sections, /visible=\{createComputed\(\(\) => indicators\(\)\.placeholder\)\}/)
})

check("adapter line is quiet metadata above the footer and hidden off/no-adapter", () => {
  assert.match(model, /return powered && ready/)
  assert.match(model, /`Adapter \$\{address === "" \? "—" : address\}`/)
  assert.match(panel, /adapterLineVisible\(bluetoothPowered\(\), bluetoothReady\(\)\)/)
  assert.match(panel, /class="bt-adapter"/)
  assert.match(btCss, /\.bt-adapter \{[^}]*font-size: 10\.5px/)
})

check("off and no-adapter copy is distinct", () => {
  assert.match(model, /No Bluetooth adapter found on this system\./)
  assert.match(model, /Pairing and discovery are unavailable without a Bluetooth radio\./)
  assert.match(model, /Bluetooth is off/)
  assert.match(model, /Turn it on to pair a mouse, keyboard, or headset\./)
  assert.match(panel, /<OffState \/>/)
})

check("footer is a whole-row target that opens Blueman with an external cue", () => {
  assert.match(panel, /class="bt-foot-row"/)
  assert.match(panel, /label="Bluetooth Settings"/)
  assert.match(panel, /label="opens Blueman"/)
  assert.match(panel, /launchScopedApp\("bluetooth-manager"\)/)
  assert.match(panel, /external-link-symbolic/)
  assert.doesNotMatch(panel, /label="›"/, "no decorative chevron")
})

check("discovery is visibility-tied and failures are notifications, not rows", () => {
  assert.match(view, /startBluetoothDiscovery\(owner\)/)
  assert.match(view, /return \(\) => stopBluetoothDiscovery\(owner\)/)
  assert.match(view, /if \(!bluetoothPowered\(\)\) return/)
  assert.match(service, /postBluetoothNotification/)
  assert.doesNotMatch(panel, /failure|failed/i, "no failure row in the panel")
})

check("audio routing stays silent and no audio-route row is added", () => {
  assert.match(view, /routeAudioToDevice/)
  assert.doesNotMatch(panel, /audio-route|Audio output|PipeWire/i)
})

check("keyboard mode stays NONE: no entry, input or PIN prompt", () => {
  assert.doesNotMatch(popup, /Gtk\.Entry|<entry|ON_DEMAND|RequestPinCode/)
  assert.doesNotMatch(panel, /Gtk\.Entry|<entry|ON_DEMAND|RequestPinCode/)
  assert.doesNotMatch(sections, /Gtk\.Entry|<entry|ON_DEMAND|RequestPinCode/)
})

check("the settings subview keeps its body and shares state/effects/confirm", () => {
  assert.match(settingsView, /<BluetoothContent/)
  assert.match(settingsView, /owner="subview"/)
  assert.match(content, /useBluetoothView\(visible, owner\)/)
  assert.match(content, /from "\.\/panel-model"/, "shared pure row decisions")
  assert.match(confirm, /createState<string \| null>\(null\)/)
  assert.match(panel, /useBluetoothView\(visible, "popup"\)/)
})

check("bar Bluetooth glyph is highlighted while the popover is open", () => {
  assert.match(widget, /class: "bluetooth-widget"/)
  assert.match(widget, /bluetoothPopupVisible\(\)/)
  assert.match(widget, /bluetooth-open/)
  assert.match(btCss, /\.bluetooth-widget\.bluetooth-open/)
})

check("new Bluetooth CSS is role-based: no uppercase transform or hex colour", () => {
  assert.doesNotMatch(btCss, /text-transform/)
  assert.doesNotMatch(btCss, /#[0-9a-fA-F]{3,8}\b/)
  assert.match(btCss, /@primary/)
  assert.match(btCss, /@error/)
  assert.match(btCss, /alpha\(@on_surface,/)
})

const failed = checks.filter((entry) => !entry.ok)
for (const entry of checks) {
  console.log(`${entry.ok ? "ok" : "not ok"} - ${entry.name}`)
  if (!entry.ok) console.error(`  ${entry.error?.message ?? entry.error}`)
}
if (failed.length > 0) {
  console.error(`\nFAIL: ${failed.length} Bluetooth panel render check(s) failed`)
  process.exit(1)
}
console.log(`\nPASS: ${checks.length} Bluetooth panel render checks`)
