import {
  type EndpointId,
  canonicalAppKey, playerSupportsSeek, routeLabel,
  type AppIdentity, type AudioPlayer, type AudioSession, type AudioStream,
  type EndpointState, type LoopStatus, type PlayerCapabilities, type RouteIntent, type VolumeState,
} from "../domain/audio-model.ts"
import { mprisAppDisplayName } from "../../services/mpris-core.ts"

export interface AudioPanelStreamView {
  id: AudioStream["id"]
  /** Honest PipeWire stream/media label, or "Audio stream" when absent. */
  name: string
  endpointId: AudioStream["endpointId"]
  routeIntent: RouteIntent
  routeLabel: string
  volume: VolumeState
}

export interface AudioAppRowView {
  /** Stable canonical app key, independent of metadata, position, and stream relinks. */
  id: string
  appId: string
  appName: string
  desktopId?: string
  iconName: string
  artworkUri: string | null
  /** Every current player's artwork URI for this app, best candidates first. */
  artworkUris: readonly string[]
  /** Local bounded-cache path; populated by composition after async artwork resolution. */
  artworkPath: string | null
  title: string
  artist: string
  album: string
  playback: AudioPlayer["playback"] | null
  playerId: AudioPlayer["id"] | null
  playerIds: readonly AudioPlayer["id"][]
  /** Raw MPRIS Identity/DesktopEntry (or PID fallback) for this player. */
  playerIdentity: string | null
  playerProcessId: number | null
  playerBusName: string | null
  /** MPRIS Shuffle/Loop for the row's displayed player; unsupported flags hide both controls. */
  shuffle: boolean
  loop: LoopStatus
  canShuffle: boolean
  canLoop: boolean
  positionUs: number | null
  durationUs: number | null
  capabilities: PlayerCapabilities
  canSeek: boolean
  hasCurrentPlayer: boolean
  hasCurrentStream: boolean
  /** Stream and player identifiers stay distinct; app actions affect all listed streams. */
  streamIds: readonly AudioStream["id"][]
  streams: readonly AudioPanelStreamView[]
  /** Mean gain; mixed flags indicate that fan-out streams don't share one value. */
  volume: VolumeState
  mixedLevel: boolean
  mixedMuted: boolean
  observedEndpointId: string | null
  routeIntent: RouteIntent | null
  routeLabel: string
}

export interface AudioInputConsumerView {
  id: string
  appId: string
  appName: string
  iconName: string
}

export interface AudioPanelViewModel {
  preferredOutputId: string | null
  preferredOutput: EndpointState | null
  outputs: readonly EndpointState[]
  preferredInputId: string | null
  input: AudioSession["input"]
  inputs: readonly EndpointState[]
  inputConsumers: readonly AudioInputConsumerView[]
  rows: readonly AudioAppRowView[]
  /** Rows with a current MPRIS player, in the same stable row order (Playing pages). */
  playingRows: readonly AudioAppRowView[]
  /** True when any current player reports `playing` (the Mixer tab's accent dot). */
  anyPlaying: boolean
  /** App-scoped route intent, keyed by app id. Exposed for inspection. */
  appIntents: Readonly<Record<string, RouteIntent>>
  appVolumes: Readonly<Record<string, VolumeState>>
  appLastIntents: Readonly<Record<string, RouteIntent>>
  appEndpoints: Readonly<Record<string, EndpointId | null>>
}

const clean = (value: string | null | undefined): string => value?.trim() ?? ""

function playerMediaKey(player: AudioPlayer): string {
  const media = player.media
  // Title/artist/album is the cross-transport identity: native Tidal and its
  // Electron mirror can publish different xesam:url values for the same track.
  // Fall back to the published URL/artwork only when no textual identity exists.
  const identity = [clean(media.title), clean(media.artist), clean(media.album)].filter(Boolean).join("\u0000")
  return identity || clean(media.trackKey) || clean(media.artworkUri)
}

function hasPlaybackMedia(player: AudioPlayer): boolean {
  const media = player.media
  return Boolean(clean(media.title) || clean(media.artist) || clean(media.album) ||
    clean(media.artworkUri) || clean(media.trackKey))
}

/** Native MPRIS owners have no `.instanceN` suffix; browser mirrors do. */
function isNativePlayer(player: AudioPlayer): boolean {
  const bus = player.busName ?? ""
  return bus !== "" && !bus.includes(".instance")
}

function controlsScore(player: AudioPlayer): number {
  return (player.capabilities.canShuffle ? 1 : 0) + (player.capabilities.canLoop ? 1 : 0) +
    (player.capabilities.canSeek ? 1 : 0) + (player.capabilities.canGoNext ? 1 : 0) +
    (player.capabilities.canGoPrevious ? 1 : 0)
}

function dedupePlayers(players: readonly AudioPlayer[]): AudioPlayer[] {
  const groups = new Map<string, AudioPlayer[]>()
  for (const player of players) {
    if (!hasPlaybackMedia(player)) continue
    const appId = canonicalAppKey(player.appId) || player.appId
    const key = `${appId}\u0000${playerMediaKey(player)}`
    const group = groups.get(key)
    if (group) group.push(player)
    else groups.set(key, [player])
  }
  const chosen: AudioPlayer[] = []
  for (const group of groups.values()) {
    chosen.push([...group].sort((a, b) => {
      const state = (player: AudioPlayer): number => player.playback === "playing" ? 4 :
        player.playback === "paused" ? 3 : player.playback === "stopped" ? 1 : 2
      return state(b) - state(a) || Number(isNativePlayer(b)) - Number(isNativePlayer(a)) ||
        controlsScore(b) - controlsScore(a) || a.id.localeCompare(b.id)
    })[0])
  }
  return chosen
}

function isTidalApp(player: AudioPlayer): boolean {
  return (canonicalAppKey(player.appId) || player.appId) === "tidal-hifi"
}

function isElectronTidalMirror(player: AudioPlayer): boolean {
  if (!isTidalApp(player)) return false
  const bus = (player.busName ?? "").toLowerCase()
  return bus.includes(".chromium.") || bus.includes(".electron.") || bus.includes(".chrome.")
}

/**
 * Tidal is one app with native and Electron/Chromium MPRIS transports. When a
 * native current player exists, its mirror can be a stale duplicate with an
 * older track; keep exactly one canonical Tidal player (native/current first)
 * and suppress every other Tidal transport. This is Tidal-specific: Chrome
 * tabs with distinct media must remain separate pages.
 */
function canonicalTidalPlayers(players: readonly AudioPlayer[]): AudioPlayer[] {
  const tidals = players.filter((player) => player.current && isTidalApp(player))
  if (tidals.length <= 1) return [...players]
  const natives = tidals.filter((player) => !isElectronTidalMirror(player))
  const pool = natives.filter(hasPlaybackMedia).length
    ? natives.filter(hasPlaybackMedia)
    : natives.length ? natives : tidals
  const chosen = [...pool].sort((a, b) => {
    const playback = (player: AudioPlayer): number => player.playback === "playing" ? 4 :
      player.playback === "paused" ? 3 : player.playback === "stopped" ? 1 : 2
    const ended = (player: AudioPlayer): boolean => {
      const length = player.media.lengthUs
      const position = player.media.positionUs
      return typeof length === "number" && typeof position === "number" && length > 0 &&
        position >= length - 1_000_000
    }
    return playback(b) - playback(a) || Number(!ended(b)) - Number(!ended(a)) ||
      Number(!isElectronTidalMirror(b)) - Number(!isElectronTidalMirror(a)) ||
      controlsScore(b) - controlsScore(a) || a.id.localeCompare(b.id)
  })[0]
  return players.filter((player) => !isTidalApp(player) || !player.current || player.id === chosen.id)
}

function sameIntent(a: RouteIntent, b: RouteIntent): boolean {
  return a.kind === b.kind && (a.kind !== "explicit" || (b.kind === "explicit" && a.endpointId === b.endpointId))
}

function choosePlayer(players: readonly AudioPlayer[]): AudioPlayer | null {
  const rank = (player: AudioPlayer): number => {
    const state = player.playback === "playing" ? 4 : player.playback === "paused" ? 3 :
      player.playback === "stopped" ? 2 : 1
    return state * 2 + (clean(player.media.title) ? 1 : 0)
  }
  // One app can expose several MPRIS players: a native app and a browser mirror
  // of the same service (Tidal + its Chromium tab) both canonicalise to one
  // app key. Playback still dominates. On a tie, prefer the player that
  // advertises more optional controls; otherwise the browser mirror wins by
  // bus-name sort and the row hides Shuffle/Loop that the native player has.
  const controls = (player: AudioPlayer): number =>
    (player.capabilities.canShuffle ? 1 : 0) +
    (player.capabilities.canLoop ? 1 : 0) +
    (player.capabilities.canSeek ? 1 : 0) +
    (player.capabilities.canGoNext ? 1 : 0) +
    (player.capabilities.canGoPrevious ? 1 : 0)
  return [...players].sort((a, b) =>
    rank(b) - rank(a) || controls(b) - controls(a) || a.id.localeCompare(b.id))[0] ?? null
}

function volumeSummary(streams: readonly AudioStream[]): {
  volume: VolumeState; mixedLevel: boolean; mixedMuted: boolean
} {
  if (!streams.length) return { volume: { level: 0, muted: false }, mixedLevel: false, mixedMuted: false }
  const levels = streams.map((stream) => stream.volume.level)
  const mutes = streams.map((stream) => stream.volume.muted)
  return {
    // The MAX level, not the mean.
    //
    // Measured 2026-10-07 with a per-row trace: Firefox spawns short-lived
    // extra PipeWire streams while seeking, and the row briefly reported 2 and
    // then 3 streams with means of 0.500 and 0.333 -- (1.0+0)/2 and
    // (1.0+0+0)/3. Those spooks read 0, dragging the average down and making
    // the volume visibly flick to another value and back. The user described it
    // exactly: "it changes to another value and then to the normal".
    //
    // An app's level is its level, not the average of however many streams it
    // currently happens to have. setAppVolume writes the same level to every
    // stream of the app, so in steady state max === mean; they diverge only
    // when a transient stream appears with a default of 0, which is precisely
    // the case that must not be allowed to move the display.
    //
    // Mute stays "all muted": one unmuted stream means audio is audible, and
    // reporting muted while sound plays would be the same class of lie.
    volume: { level: Math.max(...levels), muted: mutes.every(Boolean) },
    mixedLevel: levels.some((level) => Math.abs(level - levels[0]) > 0.0001),
    mixedMuted: mutes.some((muted) => muted !== mutes[0]),
  }
}

/** Pure projection: one stable canonical row while either a current player or stream exists. */
export function projectAudioPanel(session: AudioSession): AudioPanelViewModel {
  const groups = new Map<string, { streams: AudioStream[]; players: AudioPlayer[] }>()
  const ensure = (appId: string) => {
    const key = canonicalAppKey(appId) || appId
    let group = groups.get(key)
    if (!group) { group = { streams: [], players: [] }; groups.set(key, group) }
    return { key, group }
  }
  for (const stream of session.streams) if (stream.current) ensure(stream.appId).group.streams.push(stream)
  for (const player of session.players) if (player.current) ensure(player.appId).group.players.push(player)

  const identityByKey = new Map<string, AppIdentity>()
  for (const app of session.apps) {
    const key = canonicalAppKey(app.id)
    if (key && !identityByKey.has(key)) identityByKey.set(key, app)
  }

  const appRows = [...groups.entries()].map(([key, group]): AudioAppRowView => {
    const app = identityByKey.get(key)
    const streams = group.streams.filter((stream) => stream.direction === "output")
      .sort((a, b) => a.id.localeCompare(b.id))
    const players = [...group.players].sort((a, b) => a.id.localeCompare(b.id))
    const displayPlayers = canonicalTidalPlayers(players)
    const player = choosePlayer(displayPlayers)
    const media = player?.media
    const appName = displayPlayers[0]?.appName?.trim() || app?.displayName?.trim() ||
      mprisAppDisplayName(key) || group.streams[0]?.appId || key
    const intents = streams.map((stream) => stream.routeIntent)
    // With no stream there is no stream intent to show, so fall back to the
    // app-scoped one the user set while the app was silent. This is what keeps
    // the route control meaningful for a paused app instead of collapsing to
    // "No current route" and losing the choice.
    const appIntent = session.appIntents?.[key] ?? session.appLastIntents?.[key] ?? null
    const routeIntent = intents.length && intents.every((intent) => sameIntent(intent, intents[0]))
      ? intents[0]
      : streams.length === 0 ? appIntent : null
    const endpoints = new Set(streams.map((stream) => stream.endpointId))
    const observedEndpointId = endpoints.size === 1
      ? streams[0]?.endpointId ?? null
      : streams.length === 0 ? session.appEndpoints?.[key] ?? null : null
    // With no stream, hold the app's last known level instead of reporting 0.
    // A one-frame 0 is indistinguishable from "you turned it down", and it is
    // what made every Firefox seek flick the row.
    const volume = streams.length === 0 && session.appVolumes?.[key]
      ? { volume: { ...session.appVolumes[key] }, mixedLevel: false, mixedMuted: false }
      : volumeSummary(streams)
    const canSeek = player !== null && playerSupportsSeek(player)
    const routeText = routeIntent
      ? routeLabel(routeIntent, session.preferredOutputId, observedEndpointId, session.outputs)
      : streams.length > 1 ? "Multiple routes · Mixed intent" : "No current route"
    return {
      id: key,
      appId: key,
      appName,
      desktopId: app?.desktopId,
      iconName: displayPlayers[0]?.appId || app?.aliases?.[0] || app?.desktopId || key,
      artworkUri: media?.artworkUri ?? null,
      artworkUris: [...new Set(displayPlayers.map((item) => item.media.artworkUri)
        .filter((uri): uri is string => typeof uri === "string" && uri !== ""))],
      artworkPath: null,
      title: clean(media?.title) || appName,
      artist: clean(media?.artist),
      album: clean(media?.album),
      playback: player?.playback ?? null,
      playerId: player?.id ?? null,
      playerIds: displayPlayers.map((item) => item.id),
      playerIdentity: player?.playerIdentity ?? null,
      playerProcessId: player?.processId ?? null,
      playerBusName: player?.busName ?? null,
      shuffle: player?.shuffle ?? false,
      loop: player?.loop ?? "none",
      canShuffle: player?.capabilities.canShuffle ?? false,
      canLoop: player?.capabilities.canLoop ?? false,
      positionUs: canSeek ? media?.positionUs ?? null : null,
      durationUs: canSeek ? media?.lengthUs ?? null : null,
      capabilities: player ? { ...player.capabilities } : {
        canPlay: false, canPause: false, canPlayPause: false,
        canGoNext: false, canGoPrevious: false, canSeek: false,
        canShuffle: false, canLoop: false,
      },
      canSeek,
      hasCurrentPlayer: player !== null,
      hasCurrentStream: streams.length > 0,
      streamIds: streams.map((stream) => stream.id),
      streams: streams.map((stream) => ({
        id: stream.id, name: clean(stream.name) || "Audio stream",
        endpointId: stream.endpointId, routeIntent: stream.routeIntent,
        routeLabel: routeLabel(stream.routeIntent, session.preferredOutputId, stream.endpointId, session.outputs),
        volume: { ...stream.volume },
      })),
      volume: volume.volume,
      mixedLevel: volume.mixedLevel,
      mixedMuted: volume.mixedMuted,
      observedEndpointId,
      routeIntent,
      routeLabel: routeText,
    }
  }).sort((a, b) => a.appName.localeCompare(b.appName) || a.id.localeCompare(b.id))
  const rows = appRows

  // Playing pages are PER MPRIS PLAYER, not per app. An app row stays the
  // Mixer grouping; two Chrome sessions (or Tidal native + its Electron mirror)
  // are two pages with their own metadata, transport and identity.
  const rowByApp = new Map(rows.map((row) => [row.id, row]))
  const playablePlayers = dedupePlayers(canonicalTidalPlayers(session.players.filter((player) =>
    player.current && player.playback !== "stopped" && hasPlaybackMedia(player))))
  const playerRows = playablePlayers
    .map((player): AudioAppRowView | null => {
      const appId = canonicalAppKey(player.appId) || player.appId
      const appRow = rowByApp.get(appId)
      if (appRow === undefined) return null
      const media = player.media
      const canSeek = playerSupportsSeek(player)
      const appName = player.appName?.trim() || appRow.appName
      return {
        ...appRow,
        id: player.id,
        appId,
        appName,
        iconName: player.appId || appRow.iconName,
        artworkUri: media.artworkUri,
        artworkUris: media.artworkUri ? [media.artworkUri] : [],
        artworkPath: null,
        title: clean(media.title) || appName,
        artist: clean(media.artist),
        album: clean(media.album),
        playback: player.playback,
        playerId: player.id,
        playerIds: [player.id],
        playerIdentity: player.playerIdentity || player.busName || player.id,
        playerProcessId: player.processId ?? null,
        playerBusName: player.busName ?? null,
        shuffle: player.shuffle,
        loop: player.loop,
        canShuffle: player.capabilities.canShuffle,
        canLoop: player.capabilities.canLoop,
        positionUs: canSeek ? media.positionUs : null,
        durationUs: canSeek ? media.lengthUs : null,
        capabilities: { ...player.capabilities },
        canSeek,
        hasCurrentPlayer: true,
      }
    }).filter((row): row is AudioAppRowView => row !== null)
    .sort((a, b) => a.appName.localeCompare(b.appName) ||
      (a.playerIdentity ?? "").localeCompare(b.playerIdentity ?? "") || a.id.localeCompare(b.id))

  const consumers = session.streams.filter((stream) => stream.current && stream.direction === "input")
    .sort((a, b) => a.appId.localeCompare(b.appId) || a.id.localeCompare(b.id))
    .map((stream) => {
      const key = canonicalAppKey(stream.appId)
      const app = identityByKey.get(key)
      return { id: stream.id, appId: key, appName: app?.displayName || stream.appId, iconName: app?.aliases?.[0] || app?.desktopId || key }
    })

  return {
    preferredOutputId: session.preferredOutputId,
    preferredOutput: session.outputs.find((item) => item.id === session.preferredOutputId) ?? null,
    outputs: session.outputs,
    preferredInputId: session.preferredInputId,
    input: session.input,
    inputs: session.inputs,
    appIntents: session.appIntents ?? {},
    appVolumes: session.appVolumes ?? {},
    appLastIntents: session.appLastIntents ?? {},
    appEndpoints: session.appEndpoints ?? {},
    inputConsumers: consumers,
    rows,
    playingRows: playerRows,
    anyPlaying: playerRows.some((row) => row.playback === "playing"),
  }
}
