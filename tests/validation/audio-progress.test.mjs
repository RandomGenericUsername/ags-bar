import test from "node:test"
import assert from "node:assert/strict"
import { AudioSessionRuntime } from "../../audio/application/runtime/audio-session-runtime.ts"
import { projectAudioPanel } from "../../audio/presentation/audio-panel-view-model.ts"
import { nextDisplayPosition } from "../../audio/ui/seek-progress.ts"

const endpoint = (id, name) => ({ id, name, available: true, volume: { level: 0.6, muted: false } })
const player = (positionUs = 0) => ({
  id: "mpris:chromium.instance42#1", appId: "google-chrome", appName: "Google Chrome", current: true,
  playback: "playing",
  capabilities: { canPlay: true, canPause: true, canPlayPause: true, canGoNext: false, canGoPrevious: false,
    canSeek: true, canShuffle: false, canLoop: false },
  shuffle: false, loop: "none",
  media: { title: "Progress track", artist: "Artist", album: "Album", artworkUri: null,
    lengthUs: 200_000_000, positionUs, trackKey: "progress-track" },
})
const session = (players = [player()]) => ({
  preferredOutputId: "A", preferredInputId: null, outputs: [endpoint("A", "Speakers")],
  inputs: [], input: null, apps: [{ id: "google-chrome", displayName: "Google Chrome" }],
  streams: [], players, appIntents: {}, appVolumes: {}, appLastIntents: {}, appEndpoints: {},
})

class FakePipeWire {
  listeners = new Set()
  async hydrate() { return { kind: "snapshot", session: session() } }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  emit(event) { for (const listener of this.listeners) listener(event) }
}
class FakeMpris {
  listeners = new Set()
  async hydrate() { return { kind: "snapshot", players: [player(0)] } }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  emit(event) { for (const listener of this.listeners) listener(event) }
}
const commands = { setStreamTarget: async () => {}, setPreferredOutput: async () => {} }

test("a refreshPosition player-changed event updates runtime players and playingRows", async () => {
  const pw = new FakePipeWire()
  const mpris = new FakeMpris()
  const runtime = new AudioSessionRuntime(pw, mpris, commands)
  await runtime.start()
  const before = projectAudioPanel(runtime.current())
  assert.equal(before.playingRows.length, 1)
  assert.equal(before.playingRows[0].positionUs, 0)

  // This is exactly the event the MPRIS adapter emits after a Position read.
  mpris.emit({ kind: "player-changed", player: player(15_000_000) })
  const after = projectAudioPanel(runtime.current())
  assert.equal(runtime.current().players[0].media.positionUs, 15_000_000,
    "the runtime did not adopt the refreshed position")
  assert.equal(after.playingRows[0].positionUs, 15_000_000,
    "playingRows did not receive the refreshed position")
  assert.equal(after.playingRows[0].playback, "playing")
  assert.equal(after.playingRows[0].durationUs, 200_000_000)

  mpris.emit({ kind: "player-changed", player: { ...player(20_000_000), playback: "paused" } })
  assert.equal(projectAudioPanel(runtime.current()).playingRows[0].positionUs, 20_000_000,
    "a paused refresh still reflects the authoritative static position")
  assert.equal(projectAudioPanel(runtime.current()).playingRows[0].playback, "paused")
  runtime.dispose()
})

test("seek display advances while playing, holds while paused, and caps at duration", () => {
  assert.equal(nextDisplayPosition(10_000_000, 1000, 16_000, true, 100_000_000), 25_000_000)
  assert.equal(nextDisplayPosition(10_000_000, 1000, 16_000, false, 100_000_000), 10_000_000)
  assert.equal(nextDisplayPosition(95_000_000, 1000, 16_000, true, 100_000_000), 100_000_000)
})
