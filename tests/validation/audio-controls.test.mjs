import test from "node:test"
import assert from "node:assert/strict"
import {
  nextLoopStatus, volumeState,
} from "../../audio/domain/audio-model.ts"
import { cyclePlayerLoop, refreshPlayerPosition, setPlayerShuffle } from "../../audio/application/audio-actions.ts"
import { projectAudioPanel } from "../../audio/presentation/audio-panel-view-model.ts"

/**
 * MPRIS Shuffle/Loop (REQ-005) and the deck projection.
 *
 * Both properties are OPTIONAL in MPRIS, so the contract has two halves: a
 * player that publishes them exposes a usable control, and a player that omits
 * them never gets a control that silently does nothing. These tests pin both,
 * plus the Playing-page projection the panel and the strip share.
 */

const endpoint = (id, name) => ({ id, name, available: true, volume: volumeState(0.6, false) })
const media = (overrides = {}) => ({
  title: "Weightless", artist: "Marconi Union", album: "Ambient Transmissions",
  artworkUri: "file:///cover.jpg", lengthUs: 120_000_000, positionUs: 3_000_000, ...overrides,
})
const capabilities = (overrides = {}) => ({
  canPlay: true, canPause: true, canPlayPause: true, canGoNext: true, canGoPrevious: true,
  canSeek: true, canShuffle: true, canLoop: true, ...overrides,
})
const player = (overrides = {}) => ({
  id: "mpris:spotify#1", appId: "spotify", current: true, playback: "playing",
  capabilities: capabilities(), shuffle: false, loop: "none", media: media(), ...overrides,
})
const session = (overrides = {}) => ({
  preferredOutputId: "A", preferredInputId: null, outputs: [endpoint("A", "Studio monitors")],
  inputs: [], input: null,
  apps: [{ id: "spotify", displayName: "Spotify" }, { id: "firefox", displayName: "Firefox" }],
  streams: [], players: [player()], appIntents: {}, appVolumes: {}, appLastIntents: {}, appEndpoints: {},
  ...overrides,
})

function ports(state) {
  const calls = []
  const record = (name) => (...args) => { calls.push([name, ...args]); return Promise.resolve() }
  return {
    calls,
    session: { current: () => state },
    mpris: {
      setShuffle: record("setShuffle"),
      setLoop: record("setLoop"),
      refreshPosition: record("refreshPosition"),
    },
  }
}

test("loop cycles off -> all -> one -> off", () => {
  assert.equal(nextLoopStatus("none"), "playlist")
  assert.equal(nextLoopStatus("playlist"), "track")
  assert.equal(nextLoopStatus("track"), "none")
})

test("the projection exposes shuffle/loop capability, the selected Playing pages and anyPlaying", () => {
  const model = projectAudioPanel(session({
    streams: [{
      id: "pw:1", appId: "firefox", direction: "output", endpointId: "A", requestedEndpointId: null,
      routeIntent: { kind: "follow-preferred" }, volume: volumeState(0.5, false), current: true,
    }],
    players: [player({ shuffle: true, loop: "playlist" })],
  }))
  assert.equal(model.rows.length, 2, "the audio-only app stays in Mixer")
  assert.deepEqual(model.playingRows.map((row) => row.id), ["spotify"], "only current players are Playing pages")
  assert.equal(model.anyPlaying, true)
  const spotify = model.rows.find((row) => row.id === "spotify")
  assert.equal(spotify.shuffle, true)
  assert.equal(spotify.loop, "playlist")
  assert.equal(spotify.canShuffle, true)
  assert.equal(spotify.canLoop, true)
  const firefox = model.rows.find((row) => row.id === "firefox")
  assert.equal(firefox.canShuffle, false, "an audio-only row has no MPRIS controls")
  assert.equal(firefox.canLoop, false)
})

test("a player that omits Shuffle/LoopStatus projects unsupported, not 'off'", () => {
  const legacy = player()
  delete legacy.shuffle
  delete legacy.loop
  legacy.capabilities = capabilities({ canShuffle: false, canLoop: false })
  const row = projectAudioPanel(session({ players: [legacy] })).rows[0]
  assert.equal(row.canShuffle, false)
  assert.equal(row.canLoop, false)
  assert.equal(row.shuffle, false)
  assert.equal(row.loop, "none")
})

test("shuffle writes the intended target and loop writes the next wire status", async () => {
  const state = session()
  const bag = ports(state)
  assert.equal((await setPlayerShuffle(bag, "mpris:spotify#1", true)).ok, true)
  assert.equal((await cyclePlayerLoop(bag, "mpris:spotify#1")).ok, true)
  assert.deepEqual(bag.calls, [
    ["setShuffle", "mpris:spotify#1", true],
    ["setLoop", "mpris:spotify#1", "playlist"],
  ])
})

test("unsupported players and stale ids reject instead of pretending", async () => {
  const bag = ports(session({ players: [player({ capabilities: capabilities({ canShuffle: false, canLoop: false }) })] }))
  assert.equal((await setPlayerShuffle(bag, "mpris:spotify#1", true)).reason, "unsupported")
  assert.equal((await cyclePlayerLoop(bag, "mpris:spotify#1")).reason, "unsupported")
  assert.equal((await setPlayerShuffle(bag, "stale", true)).reason, "missing-player")
  assert.equal((await cyclePlayerLoop(bag, "stale")).reason, "missing-player")
  assert.deepEqual(bag.calls, [], "no port call is made for a rejected action")
})

test("a merged row prefers the player that exposes optional controls", () => {
  const mirror = player({
    id: "mpris:chromium.instance9#1",
    appId: "tidal-hifi",
    playback: "paused",
    capabilities: capabilities({ canShuffle: false, canLoop: false }),
    media: media({ title: "Black Horizons", artworkUri: "file:///tmp/.com.google.Chrome.abc" }),
  })
  const native = player({
    id: "mpris:tidal-hifi#1",
    appId: "tidal-hifi",
    playback: "paused",
    shuffle: true,
    loop: "playlist",
    capabilities: capabilities(),
    media: media({ title: "Black Horizons", artworkUri: "https://resources.tidal.com/cover.jpg" }),
  })
  const row = projectAudioPanel(session({
    apps: [{ id: "tidal-hifi", displayName: "Tidal" }],
    players: [mirror, native],
  })).rows[0]
  assert.equal(row.appId, "tidal-hifi")
  assert.equal(row.playerId, "mpris:tidal-hifi#1", "native Tidal wins the capability tie")
  assert.equal(row.canShuffle, true)
  assert.equal(row.canLoop, true)
  assert.equal(row.shuffle, true)
  assert.equal(row.loop, "playlist")
  assert.deepEqual(row.artworkUris.sort(), [
    "file:///tmp/.com.google.Chrome.abc",
    "https://resources.tidal.com/cover.jpg",
  ].sort(), "the row keeps every player artwork candidate")
})

test("the position action re-reads the MPRIS position", async () => {
  const bag = ports(session())
  assert.equal((await refreshPlayerPosition(bag, "mpris:spotify#1")).ok, true)
  assert.deepEqual(bag.calls, [["refreshPosition", "mpris:spotify#1"]])
  assert.equal((await refreshPlayerPosition(bag, "stale")).reason, "missing-player")
})

test("a paused player remains a Playing page and an empty session has none", () => {
  const paused = projectAudioPanel(session({ players: [player({ playback: "paused" })] }))
  assert.equal(paused.playingRows.length, 1)
  assert.equal(paused.anyPlaying, false)
  const empty = projectAudioPanel(session({ players: [] }))
  assert.equal(empty.playingRows.length, 0)
  assert.equal(empty.anyPlaying, false)
})
