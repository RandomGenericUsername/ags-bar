import { interpolatePosition } from "../../services/mpris-core"

/**
 * Display-only position clock (REQ-025, invariant I1).
 *
 * MPRIS `Position` is not an event. The adapter stores an authoritative
 * snapshot (`positionUs` + the monotonic time it was read); the UI advances the
 * DISPLAY locally from that snapshot while the player is playing. This is a
 * render tick, never a D-Bus/MPRIS read.
 *
 * The same rule fixes the page-switch flash: a page selected after spending
 * time in the background extrapolates from its stored snapshot immediately
 * (`base + elapsed`), so it never renders the stale base for one frame.
 */
export interface PositionSnapshot {
  positionUs: number | null
  positionSyncedAtMs: number | null
  playing: boolean
}

export function displayPositionUs(snapshot: PositionSnapshot, nowMs: number): number | null {
  const { positionUs, positionSyncedAtMs, playing } = snapshot
  if (positionUs === null) return null
  // No snapshot timestamp (a fake/older producer): show the raw value rather
  // than inventing elapsed time from an unknown base.
  if (positionSyncedAtMs === null) return positionUs
  return interpolatePosition(positionUs, positionSyncedAtMs, playing, nowMs)
}

/** Clamp a displayed position to a known duration (unknown duration → 0 floor). */
export function clampPositionUs(positionUs: number, durationUs: number | null): number {
  const floor = Math.max(0, positionUs)
  return durationUs !== null && durationUs > 0 ? Math.min(durationUs, floor) : floor
}
