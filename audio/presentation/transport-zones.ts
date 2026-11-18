import type { PlayerCapabilities } from "../domain/audio-model"

/**
 * Fixed transport zones (REQ-027).
 *
 * The shared row is left [shuffle] — center [previous, play, next] — right
 * [repeat]. Capability hiding only hides the ICON; every slot keeps its width,
 * so the center never shifts when capabilities appear/disappear or when the
 * user switches players. Widths match the app CSS button min-widths per
 * surface (compact strip / full panel / tray).
 */
export type TransportSurface = "panel" | "tray" | "strip"

export type TransportSlotKey = "shuffle" | "previous" | "play" | "next" | "repeat"

export interface TransportSlotLayout {
  key: TransportSlotKey
  /** Fixed slot width in px; independent of capability. */
  width: number
  /** Whether the icon is shown; the slot exists either way. */
  visible: boolean
}

export interface TransportZones {
  left: TransportSlotLayout
  center: readonly [TransportSlotLayout, TransportSlotLayout, TransportSlotLayout]
  right: TransportSlotLayout
}

export const TRANSPORT_SLOT_WIDTHS: Readonly<
  Record<TransportSurface, { readonly side: number; readonly play: number }>
> = Object.freeze({
  panel: { side: 24, play: 34 },
  tray: { side: 30, play: 36 },
  strip: { side: 26, play: 30 },
})

export function transportZones(
  surface: TransportSurface,
  capabilities: PlayerCapabilities,
): TransportZones {
  const widths = TRANSPORT_SLOT_WIDTHS[surface]
  return {
    left: { key: "shuffle", width: widths.side, visible: capabilities.canShuffle },
    center: [
      { key: "previous", width: widths.side, visible: capabilities.canGoPrevious },
      { key: "play", width: widths.play, visible: capabilities.canPlayPause },
      { key: "next", width: widths.side, visible: capabilities.canGoNext },
    ],
    right: { key: "repeat", width: widths.side, visible: capabilities.canLoop },
  }
}
