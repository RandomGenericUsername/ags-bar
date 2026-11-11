// ---------------------------------------------------------------------------
// The bar's app-owned settings — PURE domain (REQ-005).
//
// `$XDG_CONFIG_HOME/ags-bar/config.json` is the app's own writable state file:
//
//   { "media_widget": { "enabled": true } }
//
// It is NOT the AGS install link (`$XDG_CONFIG_HOME/ags/`, read-only), NOT the
// layout `bar.json`, and NOT the clipboard's config. The bar is a restart-mode
// app for APPEARANCE, but this is a UI setting and applies live.
//
// Follows the capture-tool settings pattern: the vocabulary and the merge live
// here (pure), persistence lives in `glib-store.ts`, and the seam between them
// is `port.ts`. Missing is first run (silent defaults); corrupt degrades to
// defaults with a loud log in the adapter.
//
// PURE: no `ags`, no `gi://*`, no I/O. Node can run this module directly.
// ---------------------------------------------------------------------------

/** The one setting this surface owns today. */
export interface MediaWidgetSetting {
  /** Show the now-playing strip in the top bar. */
  enabled: boolean
}

export interface BarSettings {
  media_widget: MediaWidgetSetting
}

/** Relative to `$XDG_CONFIG_HOME`; the adapter joins the absolute base. */
export const SETTINGS_RELATIVE_PATH = "ags-bar/config.json"

export const DEFAULT_BAR_SETTINGS: BarSettings = Object.freeze({
  media_widget: Object.freeze({ enabled: true }),
}) as BarSettings

export function defaultBarSettings(): BarSettings {
  return { media_widget: { enabled: DEFAULT_BAR_SETTINGS.media_widget.enabled } }
}

/**
 * Merge an on-disk record into the current shape.
 *
 * Total and non-throwing: an absent file, a non-object, a missing key or a
 * wrong-typed value all fall back to the default. `false` is a real value, so
 * `typeof value === "boolean"` (not truthiness) is what decides.
 */
export function mergeBarSettings(raw: unknown): BarSettings {
  const record = raw !== null && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {}
  const media = record.media_widget !== null && typeof record.media_widget === "object" &&
    !Array.isArray(record.media_widget)
    ? record.media_widget as Record<string, unknown>
    : {}
  return {
    media_widget: {
      enabled: typeof media.enabled === "boolean"
        ? media.enabled
        : DEFAULT_BAR_SETTINGS.media_widget.enabled,
    },
  }
}

/** The exact object written to disk; callers cannot widen it by accident. */
export function barSettingsRecord(settings: BarSettings): Record<string, unknown> {
  return { media_widget: { enabled: settings.media_widget.enabled } }
}

export function mediaWidgetEnabled(settings: BarSettings): boolean {
  return settings.media_widget.enabled
}
