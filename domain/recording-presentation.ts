// ---------------------------------------------------------------------------
// The bar's read-only projection of the capture-tool recording-controls mode.
//
// The full rule and migration live in ags-capture-tool. The bar only needs the
// one question “is the top bar the chosen surface?”; keeping that small and
// pure avoids importing app code and pins the string contract in a test.
// ---------------------------------------------------------------------------

export type RecordingControlsMode = "top-bar" | "hover" | "always"

export const DEFAULT_RECORDING_CONTROLS: RecordingControlsMode = "top-bar"

export function isTopBarControls(value: unknown): boolean {
  return value === "top-bar"
}
