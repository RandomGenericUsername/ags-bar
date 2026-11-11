// ---------------------------------------------------------------------------
// ADAPTER: GLib persistence for `$XDG_CONFIG_HOME/ags-bar/config.json`
// (REQ-005).
//
// The only place that touches `GLib.file_*`/`GLib.mkdir_with_parents` for the
// bar's settings. `GLib.get_user_config_dir()` resolves `XDG_CONFIG_HOME` and
// falls back to `~/.config`, so the path is the same contract the paper names
// without hard-coding `$HOME`.
//
// Degradation rules (capture-tool pattern):
//   * missing  -> silent defaults (first run, not an error)
//   * corrupt  -> loud log, then defaults
// Writes are atomic enough for a single small JSON file: mkdir, then
// `file_set_contents` (replace). A write failure is returned, never thrown.
// ---------------------------------------------------------------------------

import GLib from "gi://GLib?version=2.0"
import type { BarSettings } from "./domain.ts"
import {
  SETTINGS_RELATIVE_PATH,
  barSettingsRecord,
  defaultBarSettings,
  mergeBarSettings,
} from "./domain.ts"
import type { BarSettingsStore } from "./port.ts"

export function barSettingsPath(): string {
  return GLib.build_filenamev([GLib.get_user_config_dir(), SETTINGS_RELATIVE_PATH])
}

function configDirectory(): string {
  return GLib.path_get_dirname(barSettingsPath())
}

function loadSettings(): BarSettings {
  const path = barSettingsPath()
  try {
    if (!GLib.file_test(path, GLib.FileTest.EXISTS)) return defaultBarSettings()
    const [ok, bytes] = GLib.file_get_contents(path)
    if (!ok || bytes === null) return defaultBarSettings()
    const raw = JSON.parse(new TextDecoder().decode(bytes)) as unknown
    return mergeBarSettings(raw)
  } catch (error) {
    console.error(`ags-bar: cannot read settings ${path}: ${error}`)
    return defaultBarSettings()
  }
}

function saveSettings(settings: BarSettings): string | null {
  const path = barSettingsPath()
  try {
    GLib.mkdir_with_parents(configDirectory(), 0o755)
    GLib.file_set_contents(path, `${JSON.stringify(barSettingsRecord(settings), null, 2)}\n`)
    return null
  } catch (error) {
    console.error(`ags-bar: cannot write settings ${path}: ${error}`)
    return `Could not save settings: ${error}`
  }
}

/** The composition root's `BarSettingsStore`. */
export function glibBarSettingsStore(): BarSettingsStore {
  return { load: loadSettings, save: saveSettings }
}
