/** Pure display interpolation for the seek line; testable without GTK. */
export function nextDisplayPosition(
  baseUs: number,
  baseAtMs: number,
  nowMs: number,
  playing: boolean,
  durationUs: number,
): number {
  const total = Number.isFinite(durationUs) && durationUs > 0 ? durationUs : Number.POSITIVE_INFINITY
  const boundedBase = Math.max(0, Math.min(total, baseUs))
  if (!playing) return boundedBase
  const elapsedMs = Math.max(0, nowMs - baseAtMs)
  return Math.max(0, Math.min(total, boundedBase + elapsedMs * 1000))
}
