import { createComputed, createState } from "ags"
import type { AudioPanelViewModel } from "./presentation/audio-panel-view-model"
import { mediaWidgetEnabled } from "../settings/state"

/**
 * UI-local sound surface state.
 *
 * These are SURFACE concerns — which deck mode is visible, which player page is
 * selected, whether the input section is expanded, whether the tray dropdown is
 * open, and where its follower anchor sits. They are NOT audio-graph state, so
 * nothing here reads or re-reads the PipeWire/MPRIS session.
 *
 * Session semantics from the frozen paper:
 *   - the deck defaults to Playing when a current player exists, Mixer otherwise;
 *   - the user's chosen mode survives panel close/reopen for the session;
 *   - track changes never switch modes;
 *   - the panel and the tray dropdown are mutually exclusive.
 */

export type AudioDeckMode = "playing" | "mixer"

const [deckMode, setDeckMode] = createState<AudioDeckMode>("playing")
const [playingId, setPlayingIdRaw] = createState<string | null>(null)
const [mixerFocusId, setMixerFocusId] = createState<string | null>(null)
const [inputOpen, setInputOpen] = createState(false)
const [settingsOpen, setSettingsOpen] = createState(false)
const [trayOpen, setTrayOpen] = createState(false)
const [trayAnchorX, setTrayAnchorX] = createState<number | null>(null)
const [trayCue, setTrayCue] = createState<string | null>(null)
const [trayPlayerCount, setTrayPlayerCountState] = createState(0)

/**
 * Whether the tray dropdown should be on screen.
 *
 * The dropdown shares the enabled setting and the current-player set with the
 * strip: no player or the widget switched off closes/hides it. `trayPlayerCount`
 * is published by the tray view from the shared binding (the overlay
 * coordinator registers by id and cannot import the composition root).
 */
export const trayPopupVisible = createComputed(() =>
  trayOpen() && mediaWidgetEnabled() && trayPlayerCount() > 0)

export function setTrayPlayerCount(count: number): void {
  if (count === trayPlayerCount()) return
  setTrayPlayerCountState(count)
}

export {
  deckMode,
  playingId,
  mixerFocusId,
  inputOpen,
  settingsOpen,
  trayOpen,
  trayAnchorX,
  trayCue,
}

/**
 * Whether the user has made an explicit mode choice this session.
 *
 * The default is resolved on each panel open until the user picks a tab, so a
 * cold start that momentarily has no players cannot latch Mixer forever.
 */
let modeChosen = false

/** Apply the paper's default mode unless the user already chose one. */
export function resolveDeckMode(hasPlayer: boolean): void {
  if (modeChosen) return
  setDeckMode(hasPlayer ? "playing" : "mixer")
}

export function chooseDeckMode(mode: AudioDeckMode): void {
  modeChosen = true
  setDeckMode(mode)
}

/** Select a Playing page; keeps the mode as-is (a page switch is not a mode switch). */
export function selectPlaying(id: string): void {
  setPlayingIdRaw(id)
}

/** The read-only level control in Playing switches to Mixer focused on that app. */
export function openMixerFor(appId: string): void {
  modeChosen = true
  setMixerFocusId(appId)
  setDeckMode("mixer")
}

/** Keep the selected page valid when players appear/disappear. */
export function reconcilePlaying(model: AudioPanelViewModel): void {
  const pages = model.playingRows
  const current = playingId()
  if (current !== null && pages.some((row) => row.id === current)) return
  setPlayingIdRaw(pages[0]?.id ?? null)
}

/** Move the selected page by one, wrapping; returns the new index+1/length. */
export function cyclePlaying(model: AudioPanelViewModel, delta: number): void {
  const pages = model.playingRows
  if (pages.length <= 1) return
  const current = Math.max(0, pages.findIndex((row) => row.id === playingId()))
  const next = (current + delta + pages.length) % pages.length
  setPlayingIdRaw(pages[next].id)
}

export function toggleInputOpen(): void {
  setInputOpen(!inputOpen())
}

export function setSettingsOpenState(open: boolean): void {
  setSettingsOpen(open)
}

export function openTray(anchorX: number | null = null): void {
  if (anchorX !== null) setTrayAnchorX(anchorX)
  setTrayOpen(true)
}

export function closeTray(): void {
  setTrayOpen(false)
}

export function toggleTray(anchorX: number | null = null): void {
  if (trayOpen()) closeTray()
  else openTray(anchorX)
}

export function showTrayCue(text: string): void {
  setTrayCue(text)
}

export function clearTrayCue(): void {
  setTrayCue(null)
}
