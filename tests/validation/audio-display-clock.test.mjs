#!/usr/bin/env node
// REQ-025 — display-clock wiring (source-level).
//
// The clock math is pure and tested in `tests/ts/display-clock.test.ts`. These
// checks pin the GTK wiring: no periodic MPRIS read, a local 250 ms render
// tick, snapshot + playback passed to SeekLine, and no per-channel/Mixer code.

import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, resolve } from "node:path"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "../..")
const AUDIO = join(ROOT, "audio")
const read = (path) => readFileSync(path, "utf8")

test("the panel has no periodic MPRIS Position poll or refreshPosition call", () => {
  const popup = read(join(AUDIO, "AudioPopup.tsx"))
  assert.doesNotMatch(popup, /const poll = GLib\.timeout_add/, "a position poll is still mounted")
  assert.doesNotMatch(popup, /refreshPosition/, "the panel still reads MPRIS Position")
  assert.doesNotMatch(popup, /GLib\.timeout_add\([^)]*1000/, "a 1 s timer remains in the panel")
})

test("the tray does not read MPRIS Position either", () => {
  const tray = read(join(AUDIO, "TrayPopup.tsx"))
  assert.doesNotMatch(tray, /refreshPosition/, "the tray still reads MPRIS Position")
})

test("SeekLine uses the display clock and only a local 250 ms tick", () => {
  const controls = read(join(AUDIO, "ui/controls.tsx"))
  assert.match(controls, /displayPositionUs/, "SeekLine does not use the display clock")
  assert.match(controls, /GLib\.timeout_add\(GLib\.PRIORITY_DEFAULT, 250/,
    "SeekLine has no 250 ms local render tick")
  assert.doesNotMatch(controls, /refreshPosition/, "SeekLine performs an MPRIS read")
  const seek = controls.slice(controls.indexOf("export function SeekLine"), controls.indexOf("/** A 40/28 px app tile"))
  assert.match(seek, /positionSyncedAtMs/, "SeekLine has no snapshot timestamp")
  assert.match(seek, /playing: Accessor<boolean>/, "SeekLine has no playback input")
  assert.match(seek, /setDisplayUs\(/, "SeekLine does not maintain a display clock")
})

test("panel and tray pass the snapshot + playback state to SeekLine", () => {
  const popup = read(join(AUDIO, "AudioPopup.tsx"))
  const tray = read(join(AUDIO, "TrayPopup.tsx"))
  assert.match(popup, /positionSyncedAtMs=\{createComputed\(\(\) => row\(\)\.positionSyncedAtMs\)\}/)
  assert.match(popup, /playing=\{createComputed\(\(\) => row\(\)\.playback === "playing"\)\}/)
  assert.match(tray, /positionSyncedAtMs=\{createComputed\(\(\) => active\(\)\?\.positionSyncedAtMs \?\? null\)\}/)
  assert.match(tray, /playing=\{createComputed\(\(\) => active\(\)\?\.playback === "playing"\)\}/)
})

test("the adapter carries the snapshot and freezes it at a playback transition", () => {
  const adapter = read(join(AUDIO, "adapters/mpris/mpris-adapter.ts"))
  assert.match(adapter, /positionSyncedAtMs: record\.positionSyncedAtMs/, "the player record does not reach the model")
  assert.match(adapter, /interpolatePosition\(/, "playback transitions do not freeze the clock")
  assert.match(adapter, /current\.playback === "playing" && current\.media\.positionUs !== null/,
    "a playing->paused transition does not extrapolate the position")
  const projection = read(join(AUDIO, "presentation/audio-panel-view-model.ts"))
  assert.match(projection, /positionSyncedAtMs: canSeek \? player\?\.positionSyncedAtMs \?\? null : null/,
    "the row does not carry the snapshot timestamp")
})

test("the app-level Mixer is untouched (no per-channel code)", () => {
  const projection = read(join(AUDIO, "presentation/audio-panel-view-model.ts"))
  assert.doesNotMatch(projection, /mixerRows|MixerChannelView/, "per-channel Mixer code leaked in")
  const popup = read(join(AUDIO, "AudioPopup.tsx"))
  assert.match(popup, /function MixerDeck[\s\S]*binding\.model\(\)\.rows/, "the app-level Mixer changed")
})
