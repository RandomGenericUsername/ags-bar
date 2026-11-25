import assert from "node:assert/strict"
import { test } from "node:test"
import {
  actionWord,
  adapterLine,
  adapterLineVisible,
  batteryVariant,
  batteryVisible,
  confirmQuestion,
  displayName,
  headerSubtitle,
  isInRange,
  nearbyExpanded,
  nearbyIndicators,
  partitionDevices,
  signalVariant,
  stateBlock,
  type BluetoothDeviceLike,
} from "../../components/bluetooth/panel-model.ts"

function device(overrides: Partial<BluetoothDeviceLike> = {}): BluetoothDeviceLike {
  return {
    address: "AA:BB:CC:DD:EE:FF",
    alias: "Headphones",
    name: "Headphones",
    connected: false,
    paired: true,
    rssi: -55,
    battery: 0,
    ...overrides,
  }
}

test("partition: connected is its own section and never duplicated in paired", () => {
  const headset = device({
    address: "AA",
    alias: "Headset",
    connected: true,
    paired: true,
    battery: 85,
  })
  const keyboard = device({
    address: "BB",
    alias: "Keyboard",
    connected: true,
    paired: true,
  })
  const mouse = device({
    address: "CC",
    alias: "Mouse",
    paired: true,
    connected: false,
    rssi: 0,
  })
  const speaker = device({
    address: "DD",
    alias: "Speaker",
    paired: false,
    connected: false,
    rssi: -45,
  })

  const result = partitionDevices([headset, keyboard, mouse, speaker])

  assert.deepEqual(result.connected.map((item) => item.alias), ["Headset", "Keyboard"])
  assert.deepEqual(result.paired.map((item) => item.alias), ["Mouse"])
  assert.deepEqual(result.nearby.map((item) => item.alias), ["Speaker"])
  for (const connectedDevice of result.connected) {
    assert.equal(
      result.paired.some((item) => item.address === connectedDevice.address),
      false,
      "a connected device must not also be a paired row",
    )
  }
})

test("header subtitle precedence: no adapter, off, one, several, scanning, On", () => {
  const base = {
    ready: true,
    powered: true,
    connectedNames: [] as string[],
    scanning: false,
  }
  assert.equal(headerSubtitle({ ...base, ready: false }), "No adapter")
  assert.equal(headerSubtitle({ ...base, powered: false }), "Bluetooth off")
  assert.equal(
    headerSubtitle({ ...base, connectedNames: ["Headset"] }),
    "Connected to Headset",
  )
  assert.equal(
    headerSubtitle({ ...base, connectedNames: ["Headset", "Keyboard"] }),
    "2 devices connected",
  )
  assert.equal(headerSubtitle({ ...base, scanning: true }), "Scanning…")
  assert.equal(headerSubtitle(base), "On")
})

test("reachability: RSSI 0 is unseen; connected is always in range", () => {
  assert.equal(isInRange({ connected: false, rssi: 0 }), false)
  assert.equal(isInRange({ connected: false, rssi: -1 }), true)
  assert.equal(isInRange({ connected: true, rssi: 0 }), true)
})

test("signal and battery variants use the shared contract thresholds", () => {
  assert.equal(signalVariant(-60), "full")
  assert.equal(signalVariant(-61), "good")
  assert.equal(signalVariant(-70), "good")
  assert.equal(signalVariant(-71), "medium")
  assert.equal(signalVariant(-80), "medium")
  assert.equal(signalVariant(-81), "low")
  assert.equal(batteryVariant(24), "system-battery-0")
  assert.equal(batteryVariant(25), "system-battery-25")
  assert.equal(batteryVariant(74), "system-battery-50")
  assert.equal(batteryVariant(99), "system-battery-75")
  assert.equal(batteryVariant(100), "system-battery-100")
})

test("battery is shown only while connected; a stale idle reading is hidden", () => {
  assert.equal(batteryVisible({ connected: true, battery: 85 }), true)
  assert.equal(batteryVisible({ connected: true, battery: 0 }), false)
  assert.equal(batteryVisible({ connected: false, battery: 51 }), false)
})

test("busy words match the mock's four actions", () => {
  assert.equal(actionWord("pair"), "Pairing…")
  assert.equal(actionWord("connect"), "Connecting…")
  assert.equal(actionWord("disconnect"), "Disconnecting…")
  assert.equal(actionWord("unpair"), "Unpairing…")
})

test("Nearby is a tri-state: auto-open, then the user's decision wins", () => {
  assert.equal(nearbyExpanded(null, 0), false)
  assert.equal(nearbyExpanded(null, 2), true)
  assert.equal(nearbyExpanded(false, 2), false)
  assert.equal(nearbyExpanded(true, 0), true)
})

test("one scanning indicator: header cue, or the expanded-empty placeholder", () => {
  assert.deepEqual(nearbyIndicators({ scanning: true, expanded: true, count: 0 }), {
    headerCue: false,
    placeholder: true,
  })
  assert.deepEqual(nearbyIndicators({ scanning: true, expanded: true, count: 2 }), {
    headerCue: true,
    placeholder: false,
  })
  assert.deepEqual(nearbyIndicators({ scanning: true, expanded: false, count: 2 }), {
    headerCue: true,
    placeholder: false,
  })
  assert.deepEqual(nearbyIndicators({ scanning: false, expanded: true, count: 0 }), {
    headerCue: false,
    placeholder: false,
  })
})

test("adapter line is pinned metadata, visible only with a powered adapter", () => {
  assert.equal(adapterLineVisible(true, true), true)
  assert.equal(adapterLineVisible(false, true), false)
  assert.equal(adapterLineVisible(true, false), false)
  assert.equal(adapterLine("A4:7B:9D:2C:60:1F"), "Adapter A4:7B:9D:2C:60:1F")
  assert.equal(adapterLine(""), "Adapter —")
})

test("off and no-adapter are distinct states", () => {
  assert.deepEqual(stateBlock(true), {
    title: "Bluetooth is off",
    copy: "Turn it on to pair a mouse, keyboard, or headset.",
  })
  assert.deepEqual(stateBlock(false), {
    title: "No Bluetooth adapter found on this system.",
    copy: "Pairing and discovery are unavailable without a Bluetooth radio.",
  })
})

test("names fall back honestly and the confirm is per device", () => {
  assert.equal(displayName(device({ alias: "", name: "KB" })), "KB")
  assert.equal(displayName(device({ alias: "", name: "" })), "Unknown device")
  assert.equal(
    confirmQuestion("Headset"),
    "Remove Headset from paired devices?",
  )
})
