import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  clampPositionUs, displayPositionUs,
} from "../../audio/presentation/display-clock.ts"
import { interpolatePosition } from "../../services/mpris-core.ts"
import { projectAudioPanel } from "../../audio/presentation/audio-panel-view-model.ts"
import type { AudioPlayer, AudioSession } from "../../audio/domain/audio-model.ts"

/**
 * REQ-025 — display-only position clock.
 *
 * The UI extrapolates the displayed position from the adapter's snapshot
 * (`positionUs` at `positionSyncedAtMs`) while playing. No MPRIS read is
 * involved. These tests pin: stale snapshots advance, pause freezes, a page
 * switch computes the current position immediately (no old-value frame), a
 * seek rebases the clock, and the projection carries the snapshot timestamp.
 */

const CAPABILITIES = {
  canPlay: true, canPause: true, canPlayPause: true, canGoNext: false,
  canGoPrevious: false, canSeek: true, canShuffle: false, canLoop: false,
}

function player(overrides: Partial<AudioPlayer> = {}): AudioPlayer {
  return {
    id: "org.mpris.MediaPlayer2.tidal-hifi#1", appId: "tidal-hifi", current: true,
    playback: "playing", capabilities: { ...CAPABILITIES }, shuffle: false, loop: "none",
    media: {
      title: "Thanatos — Neon Genesis Evangelion", artist: "Shiro Sagisu", album: "",
      artworkUri: null, lengthUs: 600_000_000, positionUs: 225_000_000,
    },
    positionSyncedAtMs: 1_000,
    ...overrides,
  }
}

function session(players: AudioPlayer[]): AudioSession {
  return {
    preferredOutputId: "A", preferredInputId: null,
    outputs: [{ id: "A", name: "Speakers", available: true, volume: { level: 0.5, muted: false } }],
    inputs: [], input: null,
    apps: [{ id: "tidal-hifi", displayName: "Tidal" }],
    streams: [], players,
    appIntents: {}, appVolumes: {}, appLastIntents: {}, appEndpoints: {},
  }
}

describe("REQ-025 display clock", () => {
  it("advances from a stale snapshot without a read", () => {
    const shown = displayPositionUs(
      { positionUs: 225_000_000, positionSyncedAtMs: 1_000, playing: true },
      6_000,
    )
    assert.equal(shown, 230_000_000, "5 s of elapsed time is displayed locally")
  })

  it("freezes a paused snapshot", () => {
    assert.equal(displayPositionUs(
      { positionUs: 225_000_000, positionSyncedAtMs: 1_000, playing: false },
      60_000,
    ), 225_000_000)
  })

  it("shows the current position immediately on a page switch", () => {
    // Tidal was deselected at 0:34 and has been playing for 5 s; Chrome's
    // snapshot is 1 s old. Both must render their CURRENT position on the
    // first frame after selection, never the raw base.
    const now = 6_000
    const tidal = displayPositionUs({ positionUs: 34_000_000, positionSyncedAtMs: 1_000, playing: true }, now)
    const chrome = displayPositionUs({ positionUs: 50_000_000, positionSyncedAtMs: 5_000, playing: true }, now)
    assert.equal(tidal, 39_000_000, "Tidal is 0:39 at the switch, not 0:34")
    assert.equal(chrome, 51_000_000)
  })

  it("rebases on a seek", () => {
    const target = 120_000_000
    const now = 10_000
    assert.equal(displayPositionUs({ positionUs: target, positionSyncedAtMs: now, playing: true }, now), target)
    assert.equal(displayPositionUs({ positionUs: target, positionSyncedAtMs: now, playing: true }, now + 2_000), target + 2_000_000)
  })

  it("clamps a backwards clock and an unknown snapshot time", () => {
    assert.equal(displayPositionUs(
      { positionUs: 10_000_000, positionSyncedAtMs: 5_000, playing: true }, 4_000,
    ), 10_000_000, "a now before the snapshot never moves backwards")
    assert.equal(displayPositionUs(
      { positionUs: 10_000_000, positionSyncedAtMs: null, playing: true }, 99_000,
    ), 10_000_000, "no snapshot time means no invented elapsed time")
    assert.equal(interpolatePosition(10_000_000, 5_000, true, 4_000), 10_000_000)
  })

  it("clamps the display to a known duration", () => {
    assert.equal(clampPositionUs(610_000_000, 600_000_000), 600_000_000)
    assert.equal(clampPositionUs(10_000_000, null), 10_000_000)
    assert.equal(clampPositionUs(-1, 600_000_000), 0)
  })

  it("carries the snapshot timestamp through the projection", () => {
    const model = projectAudioPanel(session([player()]))
    const row = model.playingRows[0]
    assert.equal(row.positionUs, 225_000_000)
    assert.equal(row.positionSyncedAtMs, 1_000)
    assert.equal(row.canSeek, true)
    assert.equal(displayPositionUs(
      { positionUs: row.positionUs, positionSyncedAtMs: row.positionSyncedAtMs, playing: row.playback === "playing" },
      6_000,
    ), 230_000_000)
  })
})
