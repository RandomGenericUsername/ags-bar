// ---------------------------------------------------------------------------
// PORT: persistence for the bar's app-owned settings (REQ-005).
//
// Declares the SEAM only. The vocabulary/merge live in `domain.ts`; the GLib
// file reads/writes live in `glib-store.ts`. Keeping the interface here lets
// the state module be constructed with an in-memory store in a test and keeps
// `domain.ts` free of platform imports.
//
// NOTHING CONCRETE HERE: no `ags/*`, no `gi://*`, no class with a body.
// ---------------------------------------------------------------------------

import type { BarSettings } from "./domain.ts"

export interface BarSettingsStore {
  /**
   * Read the settings; a missing file is first run (defaults) and a corrupt
   * one logs loudly then returns defaults. Never throws.
   */
  load(): BarSettings

  /** Persist the settings, creating the config directory. Returns an error string or null. */
  save(settings: BarSettings): string | null
}
