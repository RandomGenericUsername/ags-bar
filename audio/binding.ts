import type { Accessor } from "ags"
import type { AudioPanelViewModel } from "./presentation/audio-panel-view-model"

/**
 * The surface contract between the GTK views and the composition root.
 *
 * The views own no audio policy: they render the projected model and dispatch
 * these actions. Kept in its own module so the panel, the bar strip and the
 * tray dropdown can all share the type without importing a view (which would
 * cycle back through AGS).
 */

export type RouteChoice = { kind: "follow-preferred" } | { kind: "explicit"; endpointId: string }
export type TransportAction = "play-pause" | "previous" | "next"

export interface AudioPanelActions {
  selectPreferredOutput(endpointId: string): void
  setOutputVolume(endpointId: string, percent: number): void
  toggleOutputMute(endpointId: string): void
  setAppRoute(appId: string, route: RouteChoice): void
  setAppVolume(appId: string, percent: number): void
  toggleAppMute(appId: string): void
  playerAction(playerId: string, action: TransportAction): void
  seek(playerId: string, positionUs: number): void
  /** MPRIS Shuffle/Loop; the controls are hidden when the player lacks the capability. */
  toggleShuffle(playerId: string): void
  cycleLoop(playerId: string): void
  /** Re-read MPRIS Position while the panel is visible (progress bar tick). */
  refreshPosition(playerId: string): void
  selectInput(endpointId: string): void
  setInputVolume(endpointId: string, percent: number): void
  /** Acts on the session's default input, so no endpoint argument is needed. */
  toggleInputMute(): void
}

export interface AudioPanelBinding {
  model: Accessor<AudioPanelViewModel>
  actions: AudioPanelActions
}
