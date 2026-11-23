import assert from "node:assert/strict"
import { test } from "node:test"
import {
  formatMbps,
  formatPing,
  formatRanAt,
  headerSubtitle,
  humanizeMs,
  partitionNetworks,
  qualityLabel,
  securityLabel,
  signalLevel,
} from "../../components/wifi/panel-model.ts"

const network = (overrides: Record<string, unknown>) => ({
  ssid: "Home",
  strength: 50,
  secured: true,
  connected: false,
  saved: false,
  weakSecurity: false,
  ...overrides,
}) as never

test("known/nearby partition: connected first, saved next, nearby strongest first", () => {
  const { known, nearby } = partitionNetworks([
    network({ ssid: "Nearby weak", strength: 20 }),
    network({ ssid: "Saved", strength: 90, saved: true }),
    network({ ssid: "Connected", strength: 10, connected: true, saved: true }),
    network({ ssid: "Nearby strong", strength: 80 }),
    network({ ssid: "Saved weak", strength: 40, saved: true }),
  ])
  assert.deepEqual(
    known.map((item) => item.ssid),
    ["Connected", "Saved", "Saved weak"],
  )
  assert.deepEqual(
    nearby.map((item) => item.ssid),
    ["Nearby strong", "Nearby weak"],
  )
})

test("signal steps and quality words match the shared >=75/50/25 table", () => {
  assert.equal(signalLevel(100), 4)
  assert.equal(signalLevel(75), 4)
  assert.equal(signalLevel(74), 3)
  assert.equal(signalLevel(50), 3)
  assert.equal(signalLevel(49), 2)
  assert.equal(signalLevel(25), 2)
  assert.equal(signalLevel(24), 1)
  assert.equal(signalLevel(0), 0)
  assert.equal(qualityLabel(80), "Excellent")
  assert.equal(qualityLabel(60), "Good")
  assert.equal(qualityLabel(30), "Fair")
  assert.equal(qualityLabel(10), "Weak")
})

test("security label never claims WPA2 when RSN was not negotiated", () => {
  assert.equal(securityLabel({ secured: false, weakSecurity: false }), "Open")
  assert.equal(securityLabel({ secured: true, weakSecurity: true }), "WPA")
  assert.equal(securityLabel({ secured: true, weakSecurity: false }), "WPA2")
})

test("header subtitle precedence: off, prompt, connecting, connected, failure, scanning", () => {
  const base = {
    enabled: true,
    connectedSsid: "Home",
    connectingSsid: null,
    promptSsid: null,
    promptJoining: false,
    failure: null,
    scanning: true,
  }
  assert.equal(headerSubtitle({ ...base, enabled: false }), "Wi-Fi off")
  assert.equal(
    headerSubtitle({ ...base, promptSsid: "Cafe", promptJoining: false }),
    "Join Cafe",
  )
  assert.equal(
    headerSubtitle({ ...base, promptSsid: "Cafe", promptJoining: true }),
    "Joining Cafe…",
  )
  assert.equal(
    headerSubtitle({ ...base, connectingSsid: "Home" }),
    "Connecting to Home…",
  )
  assert.equal(headerSubtitle(base), "Connected to Home")
  assert.equal(headerSubtitle({ ...base, connectedSsid: null, failure: "bad" }), "Connection failed")
  assert.equal(
    headerSubtitle({ ...base, connectedSsid: null, failure: null }),
    "Scanning…",
  )
  assert.equal(
    headerSubtitle({ ...base, connectedSsid: null, failure: null, scanning: false }),
    "Not connected",
  )
})

test("Ran is honest: no result invents no age", () => {
  const now = 1_000_000_000
  assert.equal(formatRanAt(now, null), "Not run yet")
  assert.equal(formatRanAt(now, now - 2_000), "just now")
  assert.equal(formatRanAt(now, now - 20_000), "20 s ago")
  assert.equal(formatRanAt(now, now - 4 * 60_000), "4 min ago")
  assert.equal(formatRanAt(now, now - 3 * 3_600_000), "3 h ago")
})

test("speed cells keep previous numbers and use an em dash when absent", () => {
  assert.equal(formatMbps(412.6), "412.6")
  assert.equal(formatMbps(400), "400")
  assert.equal(formatMbps(null), "—")
  assert.equal(formatMbps(undefined), "—")
  assert.equal(formatPing(9.4), "9")
  assert.equal(formatPing(null), "—")
})

test("interval hint follows the existing commit vocabulary", () => {
  assert.equal(humanizeMs(0), "Off")
  assert.equal(humanizeMs(1500), "2 s")
  assert.equal(humanizeMs(900000), "15 min")
})
