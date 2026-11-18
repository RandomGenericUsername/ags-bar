#!/usr/bin/env node
// REQ-027 — fixed transport zones (source-level).
//
// The geometry is pure and tested in `tests/ts/transport-zones.test.ts`. These
// checks pin the shared GTK row: three zone boxes with always-present slot
// wrappers, hidden icons driven by capability, the surface selection from each
// caller, and the app CSS widths the geometry constants must match.

import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, resolve } from "node:path"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "../..")
const AUDIO = join(ROOT, "audio")
const read = (path) => readFileSync(path, "utf8")

test("TransportRow renders left/center/right zones with reserved slots", () => {
  const controls = read(join(AUDIO, "ui/controls.tsx"))
  const row = controls.slice(controls.indexOf("export function TransportRow"), controls.indexOf("/** A menu-like picker"))
  assert.match(row, /transportZones\(surface, capabilities\(\)\)/, "the row does not use the fixed-zone geometry")
  assert.match(row, /class="audio-transport-slot" widthRequest=\{zones\(\)\.left\.width\}/, "no fixed shuffle slot")
  assert.match(row, /class="audio-transport-slot" widthRequest=\{zones\(\)\.right\.width\}/, "no fixed repeat slot")
  assert.match(row, /class="audio-transport-center"/, "no center zone")
  assert.match(row, /zones\(\)\.center\[1\]\.width/, "the play slot is not fixed")
  // Visibility is capability-driven, but the wrappers are unconditional.
  assert.match(row, /visible=\{createComputed\(\(\) => zones\(\)\.left\.visible\)\}/, "shuffle visibility is not zoned")
  assert.match(row, /visible=\{createComputed\(\(\) => zones\(\)\.right\.visible\)\}/, "repeat visibility is not zoned")
  assert.match(row, /const id = playerId\(\)/, "first-click dispatch lost the page's own player id")
  assert.doesNotMatch(row, /playingId|selectedPage/, "transport dispatch reaches into selection state")
})

test("all three surfaces select their own zone widths", () => {
  assert.match(read(join(AUDIO, "AudioPopup.tsx")), /surface="panel"/, "the panel does not use panel widths")
  assert.match(read(join(AUDIO, "TrayPopup.tsx")), /surface="tray"/, "the tray does not use tray widths")
  assert.match(read(join(ROOT, "bar/widgets/media.tsx")), /surface="strip"/, "the strip does not use strip widths")
})

test("the geometry constants match the app CSS button widths", () => {
  const zones = read(join(AUDIO, "presentation/transport-zones.ts"))
  assert.match(zones, /panel: \{ side: 24, play: 34 \}/)
  assert.match(zones, /tray: \{ side: 30, play: 36 \}/)
  assert.match(zones, /strip: \{ side: 26, play: 30 \}/)

  const css = read(join(AUDIO, "audio-panel.css"))
  const block = (selector) => {
    const start = css.indexOf(selector)
    assert.ok(start >= 0, `missing CSS selector ${selector}`)
    return css.slice(start, css.indexOf("}", start))
  }
  assert.match(block(".audio-transport-button {"), /min-width:\s*24px/)
  assert.match(block(".audio-transport-button.play {"), /min-width:\s*34px/)
  assert.match(block(".audio-tray-transport .audio-transport-button {"), /min-width:\s*30px/)
  assert.match(block(".audio-tray-transport .audio-transport-button.play {"), /min-width:\s*36px/)
  assert.match(block(".audio-strip-controls .audio-transport-button {"), /min-width:\s*26px/)
  assert.match(block(".audio-strip-controls .audio-transport-button.play {"), /min-width:\s*30px/)
})

test("the Mixer, per-channel data and skin are untouched", () => {
  const model = read(join(AUDIO, "presentation/audio-panel-view-model.ts"))
  assert.doesNotMatch(model, /mixerRows|MixerChannelView/, "per-channel code is present")
  const popup = read(join(AUDIO, "AudioPopup.tsx"))
  assert.match(popup, /function MixerDeck[\s\S]*binding\.model\(\)\.rows/, "the app-level Mixer changed")
})
